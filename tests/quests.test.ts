import { describe, expect, it } from 'vitest';
import { QUESTS } from '../src/data/quests';
import { GameSession, SAVE_KEY } from '../src/game/GameSession';
import { MemoryStore } from '../src/utils/storage';

const stdout = (lines: { kind: string; text: string }[]): string => lines.map((l) => l.text).join('\n');

describe('quest data', () => {
  it('has unique ids and sane definitions', () => {
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
    for (const quest of QUESTS) {
      expect(quest.objectives.length).toBeGreaterThan(0);
      expect(new Set(quest.objectives.map((o) => o.id)).size).toBe(quest.objectives.length);
      expect(quest.objectives.every((o) => o.hints.length > 0)).toBe(true);
      expect(quest.reward.xp).toBeGreaterThan(0);
    }
  });

  // Scales to hundreds of quests: every quest must be solvable by its own reference solution.
  for (const quest of QUESTS) {
    it(`"${quest.id}" is solvable with its reference solution`, () => {
      const session = new GameSession(new MemoryStore(), QUESTS);
      for (const other of QUESTS) {
        if (other.id === quest.id) break;
        expect(session.quests.isCompleted(other.id)).toBe(true);
      }
      expect(session.quests.active()?.id).toBe(quest.id);
      for (const line of quest.solution) session.runCommand(line);
      expect(session.quests.isCompleted(quest.id)).toBe(true);
    });
  }
});

describe('The Locked Sector', () => {
  const setup = () => new GameSession(new MemoryStore());

  it('starts at the player home with the mission seeded', () => {
    const s = setup();
    expect(s.shell.cwd).toBe('/home/player');
    expect(s.fs.isFile('/home/player/readme.txt')).toBe(true);
    expect(s.quests.currentObjective()?.id).toBe('pwd');
    expect(s.terminalBanner()[0]).toBe('SYSTEM ACCESS TERMINAL');
  });

  it('completes objectives in order and unlocks the door when finished', () => {
    const s = setup();
    const events: string[] = [];
    s.bus.on('objective-complete', ({ objective }) => events.push(objective.id));
    s.bus.on('flag-set', ({ flag }) => events.push(`flag:${flag}`));

    s.runCommand('pwd');
    expect(s.quests.currentObjective()?.id).toBe('ls');
    expect(s.hasFlag('sector02.unlocked')).toBe(false);

    for (const line of QUESTS[0]!.solution.slice(1)) s.runCommand(line);
    expect(s.hasFlag('sector02.unlocked')).toBe(true);
    expect(s.hasFlag('sector03.available')).toBe(true);
    expect(events[0]).toBe('pwd');
    expect(events).toContain('flag:sector02.unlocked');
    expect(s.progression.state.xp).toBe(120);
    expect(s.progression.info().title).toBe('Shell Operator');
    expect(s.terminalBanner()).toContain('Sector 02 unlocked.');
  });

  it('does not credit a failed command', () => {
    const s = setup();
    s.runCommand('cat readme');
    expect(s.quests.progress['locked-sector']?.done).toEqual([]);
  });

  it('rejects wrong passphrase content', () => {
    const s = setup();
    for (const line of QUESTS[0]!.solution.slice(0, 8)) s.runCommand(line);
    s.runCommand('echo WRONG > access.conf');
    expect(s.quests.isCompleted('locked-sector')).toBe(false);
    expect(s.quests.currentObjective()?.id).toBe('write-passphrase');
  });

  it('accepts a different valid route (absolute paths, touch skipped)', () => {
    const s = setup();
    for (const line of [
      'pwd', 'ls', 'cat readme.txt', 'cat /var/lock/sector02/NOTICE.txt',
      'cat /var/lock/sector02/.passphrase', 'mkdir ~/clearance', 'echo CYAN-OWL-42 > ~/clearance/access.conf', 'cd clearance',
    ]) s.runCommand(line);
    expect(s.quests.isCompleted('locked-sector')).toBe(true);
  });

  it('explains mistakes with the coach, including unknown commands', () => {
    const s = setup();
    const missing = s.runCommand('cat nothing.txt');
    expect(missing.lines.some((l) => l.kind === 'coach' && /no existe/.test(l.text))).toBe(true);
    const locked = s.runCommand('grep a b');
    expect(stdout(locked.lines)).toContain('command not found');
    expect(locked.lines.some((l) => l.kind === 'coach' && /no lo tenés disponible/.test(l.text))).toBe(true);
  });

  it('serves progressive hints', () => {
    const s = setup();
    const first = s.runCommand('hint').lines.at(-1)?.text ?? '';
    const second = s.runCommand('hint').lines.at(-1)?.text ?? '';
    expect(first).toMatch(/^HINT 1\/2/);
    expect(second).toMatch(/^HINT 2\/2/);
  });

  it('adds commands to the codex on first successful use only', () => {
    const s = setup();
    const discovered: string[] = [];
    s.bus.on('codex-discovered', ({ command }) => discovered.push(command));
    s.runCommand('pwd');
    s.runCommand('pwd');
    s.runCommand('cat missing');
    s.runCommand('ls');
    expect(discovered).toEqual(['pwd', 'ls']);
  });

  it('persists and restores everything through the store', () => {
    const store = new MemoryStore();
    const a = new GameSession(store);
    for (const line of ['pwd', 'ls', 'mkdir scratch', 'cd scratch', 'echo hi > note.txt']) a.runCommand(line);
    a.discoverRegion('sector-01', 'Boot Bay');
    expect(store.getItem(SAVE_KEY)).not.toBeNull();

    const b = new GameSession(store);
    expect(b.isNewGame).toBe(false);
    expect(b.shell.cwd).toBe('/home/player/scratch');
    expect(b.fs.readFile('/home/player/scratch/note.txt')).toBe('hi\n');
    expect(b.quests.progress['locked-sector']?.done).toEqual(['pwd', 'ls']);
    expect(b.progression.state.codex).toContain('pwd');
    expect(b.progression.state.regions).toEqual(['sector-01']);
    expect(b.terminal.history).toContain('mkdir scratch');
  });

  it('restores completed state (flags) and ignores corrupt saves', () => {
    const store = new MemoryStore();
    const a = new GameSession(store);
    for (const line of QUESTS[0]!.solution) a.runCommand(line);
    expect(new GameSession(store).hasFlag('sector02.unlocked')).toBe(true);

    store.setItem(SAVE_KEY, '{not json');
    expect(new GameSession(store).isNewGame).toBe(true);
  });

  it('game reset clears the save', () => {
    const store = new MemoryStore();
    const s = new GameSession(store);
    let reset = false;
    s.bus.on('reset', () => (reset = true));
    s.runCommand('game reset --yes');
    expect(reset).toBe(true);
    expect(store.getItem(SAVE_KEY)).toBeNull();
  });
});
