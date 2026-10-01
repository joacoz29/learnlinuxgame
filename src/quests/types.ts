import type { FsSpec } from '../filesystem/spec';

export type Difficulty = 'tutorial' | 'beginner' | 'intermediate' | 'advanced' | 'expert';

/** Declarative checks evaluated after every command. Add new variants here as sectors need them. */
export type Condition =
  | { type: 'commandRan'; command: string; argIncludes?: string; succeeded?: boolean }
  | { type: 'fileExists'; path: string }
  | { type: 'dirExists'; path: string }
  | { type: 'fileContains'; path: string; text: string }
  | { type: 'cwdIs'; path: string }
  | { type: 'all'; conditions: Condition[] }
  | { type: 'any'; conditions: Condition[] };

export interface Objective {
  id: string;
  /** shown in the HUD and terminal checklist */
  text: string;
  condition: Condition;
  /** progressively more explicit; the last one may give the command away */
  hints: string[];
  /** short explanation shown once the objective is achieved */
  lesson?: string;
}

/** Side effects triggered when a quest completes; interpreted by GameSession. */
export type QuestEvent =
  | { type: 'setFlag'; flag: string }
  | { type: 'sound'; id: string; delayMs?: number }
  | { type: 'notify'; text: string };

export interface QuestDefinition {
  id: string;
  title: string;
  sector: string;
  description: string;
  difficulty: Difficulty;
  /** quests that must be completed first */
  requires?: string[];
  /** command names usable during the quest; null allows everything */
  allowedCommands: string[] | null;
  /** extra filesystem content created when the quest starts, and the starting directory */
  world: FsSpec & { cwd?: string };
  terminal: { banner: string[]; completedBanner: string[] };
  objectives: Objective[];
  /** command lines that solve the quest; tests run every quest's solution automatically */
  solution: string[];
  reward: { xp: number };
  /** concept ids learned on completion */
  concepts: string[];
  /** command names introduced here (they appear in the Codex when first used) */
  introduces: string[];
  completionMessage: string[];
  onComplete: QuestEvent[];
}

export interface QuestProgress {
  status: 'active' | 'completed';
  done: string[];
  hintsUsed: Record<string, number>;
}
