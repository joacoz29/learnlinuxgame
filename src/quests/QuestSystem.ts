import { applyFsSpec } from '../filesystem/spec';
import { DIFFICULTY_RULES } from '../progression/difficulty';
import { evaluateCondition, type EvalContext } from './conditions';
import type { Objective, QuestDefinition, QuestProgress } from './types';

export interface QuestUpdate {
  newlyDone: Objective[];
  completed?: QuestDefinition;
}

export interface ObjectiveView {
  objective: Objective;
  done: boolean;
  /** the first unfinished objective */
  current: boolean;
}

export type HintResult = { ok: true; text: string; index: number; total: number } | { ok: false; reason: string };

/** Data-driven quest tracking. Knows nothing about rendering; consumes engine results. */
export class QuestSystem {
  constructor(
    private readonly defs: readonly QuestDefinition[],
    readonly progress: Record<string, QuestProgress> = {},
  ) {}

  definition(id: string): QuestDefinition | undefined {
    return this.defs.find((d) => d.id === id);
  }

  isCompleted(id: string): boolean {
    return this.progress[id]?.status === 'completed';
  }

  /** First quest that is not completed and whose prerequisites are done. */
  active(): QuestDefinition | undefined {
    return this.defs.find((d) => !this.isCompleted(d.id) && (d.requires ?? []).every((r) => this.isCompleted(r)));
  }

  /** Creates the progress entry and seeds the world for a newly active quest. Returns it if just started. */
  ensureStarted(ctx: Pick<EvalContext, 'fs' | 'shell'>): QuestDefinition | undefined {
    const quest = this.active();
    if (!quest || this.progress[quest.id]) return undefined;
    this.progress[quest.id] = { status: 'active', done: [], hintsUsed: {} };
    applyFsSpec(ctx.fs, quest.world);
    if (quest.world.cwd) {
      ctx.shell.cwd = quest.world.cwd;
      ctx.shell.vars.PWD = quest.world.cwd;
    }
    return quest;
  }

  objectives(): ObjectiveView[] {
    const quest = this.active();
    const progress = quest && this.progress[quest.id];
    if (!quest || !progress) return [];
    const firstOpen = quest.objectives.find((o) => !progress.done.includes(o.id));
    return quest.objectives.map((objective) => ({
      objective,
      done: progress.done.includes(objective.id),
      current: objective === firstOpen,
    }));
  }

  currentObjective(): Objective | undefined {
    return this.objectives().find((o) => o.current)?.objective;
  }

  /** Checks every pending objective against the world after a command ran. */
  evaluate(ctx: EvalContext): QuestUpdate {
    const quest = this.active();
    const progress = quest && this.progress[quest.id];
    if (!quest || !progress) return { newlyDone: [] };
    const newlyDone = quest.objectives.filter(
      (o) => !progress.done.includes(o.id) && evaluateCondition(o.condition, ctx),
    );
    for (const objective of newlyDone) progress.done.push(objective.id);
    if (progress.done.length === quest.objectives.length) {
      progress.status = 'completed';
      return { newlyDone, completed: quest };
    }
    return { newlyDone };
  }

  /** Next hint for the current objective, honoring the quest difficulty's hint budget. */
  requestHint(): HintResult {
    const quest = this.active();
    const objective = this.currentObjective();
    const progress = quest && this.progress[quest.id];
    if (!quest || !objective || !progress) return { ok: false, reason: 'No hay una misión activa.' };
    const rules = DIFFICULTY_RULES[quest.difficulty];
    const used = progress.hintsUsed[objective.id] ?? 0;
    if (rules.maxHintsPerObjective === 0) {
      return { ok: false, reason: 'En dificultad Expert no hay pistas. Confiá en lo que sabés.' };
    }
    const budget = Math.min(rules.maxHintsPerObjective, objective.hints.length);
    if (used >= budget) {
      const again = objective.hints[budget - 1];
      return again && rules.maxHintsPerObjective === Infinity
        ? { ok: true, text: again, index: budget, total: budget }
        : { ok: false, reason: 'Ya usaste todas las pistas de este objetivo.' };
    }
    progress.hintsUsed[objective.id] = used + 1;
    return { ok: true, text: objective.hints[used] as string, index: used + 1, total: budget };
  }
}
