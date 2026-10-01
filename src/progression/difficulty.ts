import type { CoachLevel } from '../terminal/coach';
import type { Difficulty } from '../quests/types';

export interface DifficultyRules {
  label: string;
  /** hints a player may request per objective */
  maxHintsPerObjective: number;
  /** how much the terminal explains after a mistake */
  coach: CoachLevel;
  /** whether the tab-completion suggestion strip is offered */
  suggestions: boolean;
}

export const DIFFICULTY_RULES: Record<Difficulty, DifficultyRules> = {
  tutorial: { label: 'Tutorial', maxHintsPerObjective: Infinity, coach: 'full', suggestions: true },
  beginner: { label: 'Beginner', maxHintsPerObjective: Infinity, coach: 'full', suggestions: true },
  intermediate: { label: 'Intermediate', maxHintsPerObjective: 2, coach: 'brief', suggestions: true },
  advanced: { label: 'Advanced', maxHintsPerObjective: 1, coach: 'brief', suggestions: false },
  expert: { label: 'Expert', maxHintsPerObjective: 0, coach: 'none', suggestions: false },
};
