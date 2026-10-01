import { CommandEngine } from '../commands/CommandEngine';
import type { ShellState } from '../commands/types';
import { EventBus } from '../core/EventBus';
import { CODEX } from '../data/commands/codex';
import { BASE_FILESYSTEM, INITIAL_SHELL } from '../data/world/base-filesystem';
import { QUESTS } from '../data/quests';
import { VirtualFileSystem, type DirNode } from '../filesystem/VirtualFileSystem';
import { applyFsSpec } from '../filesystem/spec';
import { DIFFICULTY_RULES } from '../progression/difficulty';
import { ProgressionSystem, emptyProgression, type LevelInfo, type ProgressionState } from '../progression/ProgressionSystem';
import { QuestSystem } from '../quests/QuestSystem';
import type { Objective, QuestDefinition, QuestProgress } from '../quests/types';
import { TerminalSystem, type OutputLine, type SubmitResult } from '../terminal/TerminalSystem';
import type { KeyValueStore } from '../utils/storage';

export const SAVE_KEY = 'linuxquest.save.v1';

export interface Settings {
  suggestions: boolean;
  muted: boolean;
}

export interface GameEvents {
  'objective-complete': { objective: Objective };
  'quest-complete': { quest: QuestDefinition; xp: number; level: LevelInfo; leveledUp: boolean };
  'codex-discovered': { command: string };
  'flag-set': { flag: string };
  'sound': { id: string; delayMs?: number };
  'notify': { text: string };
  'region-discovered': { id: string; name: string };
  'command-run': { ok: boolean };
  'reset': Record<string, never>;
}

interface SaveData {
  version: 1;
  fs: DirNode;
  cwd: string;
  vars: Record<string, string>;
  history: string[];
  flags: string[];
  quests: Record<string, QuestProgress>;
  progression: ProgressionState;
  settings: Settings;
}

const DEFAULT_SETTINGS: Settings = { suggestions: true, muted: false };

/**
 * The whole non-visual game: virtual machine, terminal, quests, progression and persistence.
 * Rendering code observes it through `bus` and queries; it never needs Three.js, so it is fully testable.
 */
export class GameSession {
  readonly bus = new EventBus<GameEvents>();
  readonly fs: VirtualFileSystem;
  readonly shell: ShellState;
  readonly terminal: TerminalSystem;
  readonly quests: QuestSystem;
  readonly progression: ProgressionSystem;
  readonly flags: Set<string>;
  readonly settings: Settings;
  readonly isNewGame: boolean;
  private resetting = false;

  constructor(
    private readonly store: KeyValueStore,
    private readonly questDefs: readonly QuestDefinition[] = QUESTS,
  ) {
    const save = this.loadSave();
    this.isNewGame = save === null;
    this.fs = save ? VirtualFileSystem.restore(save.fs) : new VirtualFileSystem();
    this.shell = save ? shellFromSave(save) : newShell();
    if (!save) applyFsSpec(this.fs, BASE_FILESYSTEM);
    this.flags = new Set(save?.flags ?? []);
    this.settings = { ...DEFAULT_SETTINGS, ...save?.settings };
    this.progression = new ProgressionSystem(save?.progression ?? emptyProgression());
    this.quests = new QuestSystem(questDefs, save?.quests ?? {});

    const engine = new CommandEngine(this.fs);
    this.terminal = new TerminalSystem(this.fs, engine, this.shell, {
      allowedCommands: () => {
        const names = this.quests.active()?.allowedCommands;
        return names ? new Set(names) : null;
      },
      coachLevel: () => {
        const quest = this.quests.active();
        return quest ? DIFFICULTY_RULES[quest.difficulty].coach : 'full';
      },
    });
    if (save) this.terminal.history.push(...save.history);
    this.registerMetaCommands();
    this.quests.ensureStarted({ fs: this.fs, shell: this.shell });
    this.save();
  }

  hasFlag(flag: string): boolean {
    return this.flags.has(flag);
  }

  suggestionsAvailable(): boolean {
    const quest = this.quests.active();
    return quest ? DIFFICULTY_RULES[quest.difficulty].suggestions : true;
  }

  /** Lines shown when a terminal is opened with an empty screen. */
  terminalBanner(): string[] {
    const active = this.quests.active();
    if (active) return active.terminal.banner;
    const completed = [...this.questDefs].reverse().find((q) => this.quests.isCompleted(q.id));
    return completed?.terminal.completedBanner ?? ['SYSTEM ACCESS TERMINAL'];
  }

  /** Runs one line typed by the player and applies every gameplay consequence. */
  runCommand(line: string): SubmitResult {
    const result = this.terminal.submit(line);
    if (result.execution) {
      const ok = result.execution.exitCode === 0;
      this.bus.emit('command-run', { ok });
      result.lines.push(...this.afterExecution(result));
    }
    this.save();
    return result;
  }

  discoverRegion(id: string, name: string): void {
    if (!this.progression.discoverRegion(id)) return;
    this.bus.emit('region-discovered', { id, name });
    this.save();
  }

  updateSettings(patch: Partial<Settings>): void {
    Object.assign(this.settings, patch);
    this.save();
  }

  save(): void {
    if (this.resetting) return;
    const data: SaveData = {
      version: 1,
      fs: this.fs.snapshot(),
      cwd: this.shell.cwd,
      vars: this.shell.vars,
      history: this.terminal.history,
      flags: [...this.flags],
      quests: this.quests.progress,
      progression: this.progression.state,
      settings: this.settings,
    };
    try {
      this.store.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* storage full or unavailable: the game keeps running without persistence */
    }
  }

  reset(): void {
    this.resetting = true;
    this.store.removeItem(SAVE_KEY);
    this.bus.emit('reset', {});
  }

  private loadSave(): SaveData | null {
    try {
      const raw = this.store.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      return data.version === 1 && data.fs?.type === 'dir' ? data : null;
    } catch {
      return null;
    }
  }

  private afterExecution(result: SubmitResult): OutputLine[] {
    const lines: OutputLine[] = [];
    const execution = result.execution;
    if (!execution) return lines;

    for (const command of execution.executed) {
      if (command.exitCode === 0 && CODEX.some((e) => e.command === command.name) && this.progression.discoverCommand(command.name)) {
        this.bus.emit('codex-discovered', { command: command.name });
        lines.push({ kind: 'system', text: `CODEX UPDATED: ${command.name}` });
      }
    }

    const update = this.quests.evaluate({ fs: this.fs, shell: this.shell, commands: execution.executed });
    for (const objective of update.newlyDone) {
      this.bus.emit('objective-complete', { objective });
      lines.push({ kind: 'system', text: `✔ OBJECTIVE COMPLETE: ${objective.text}` });
      if (objective.lesson) lines.push({ kind: 'lesson', text: objective.lesson });
    }
    if (update.completed) lines.push(...this.completeQuest(update.completed));
    return lines;
  }

  private completeQuest(quest: QuestDefinition): OutputLine[] {
    const levelUp = this.progression.addXp(quest.reward.xp);
    this.progression.learnConcepts(quest.concepts);
    for (const event of quest.onComplete) {
      if (event.type === 'setFlag') {
        this.flags.add(event.flag);
        this.bus.emit('flag-set', { flag: event.flag });
      } else if (event.type === 'sound') {
        this.bus.emit('sound', { id: event.id, delayMs: event.delayMs });
      } else {
        this.bus.emit('notify', { text: event.text });
      }
    }
    const level = this.progression.info();
    this.bus.emit('quest-complete', { quest, xp: quest.reward.xp, level, leveledUp: levelUp !== null });
    this.quests.ensureStarted({ fs: this.fs, shell: this.shell });

    const lines: OutputLine[] = [
      { kind: 'system', text: '' },
      { kind: 'system', text: `★ MISSION COMPLETE: ${quest.title}  (+${quest.reward.xp} XP)` },
      ...quest.completionMessage.map((text) => ({ kind: 'lesson' as const, text })),
    ];
    if (levelUp) lines.push({ kind: 'system', text: `▲ LEVEL UP: ${levelUp.title} (level ${levelUp.level})` });
    lines.push({ kind: 'system', text: 'Presioná ESC para salir de la terminal y ver qué cambió.' });
    return lines;
  }

  private registerMetaCommands(): void {
    this.terminal.registerMeta('hint', 'ask for a hint about the current objective', () => {
      const hint = this.quests.requestHint();
      this.save();
      return [
        hint.ok
          ? { kind: 'system', text: `HINT ${hint.index}/${hint.total}: ${hint.text}` }
          : { kind: 'system', text: hint.reason },
      ];
    });
    this.terminal.registerMeta('quest', 'show the current mission and its objectives', () => {
      const quest = this.quests.active();
      if (!quest) return [{ kind: 'system', text: 'No hay misiones activas. Explorá libremente.' }];
      const rows: OutputLine[] = this.quests.objectives().map(({ objective, done, current }) => ({
        kind: 'system',
        text: `  ${done ? '[x]' : current ? '[>]' : '[ ]'} ${done || current ? objective.text : '???'}`,
      }));
      return [{ kind: 'system', text: `MISSION: ${quest.title} — ${quest.description}` }, ...rows];
    });
    this.terminal.registerMeta('game', 'game options: "game reset --yes" erases your progress', (args) => {
      if (args[0] === 'reset' && args[1] === '--yes') {
        this.reset();
        return [{ kind: 'system', text: 'Progress erased. Restarting...' }];
      }
      return [{ kind: 'system', text: 'Usage: game reset --yes' }];
    });
  }
}

function newShell(): ShellState {
  const { user, hostname, home } = INITIAL_SHELL;
  return {
    cwd: home,
    user,
    hostname,
    lastExitCode: 0,
    vars: { HOME: home, USER: user, PWD: home, SHELL: '/bin/bash', PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'en_US.UTF-8' },
  };
}

function shellFromSave(save: SaveData): ShellState {
  return { ...newShell(), cwd: save.cwd, vars: { ...save.vars } };
}
