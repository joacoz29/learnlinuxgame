export interface LevelDef {
  level: number;
  title: string;
  /** total XP needed to reach this level */
  xp: number;
}

export const LEVELS: readonly LevelDef[] = [
  { level: 1, title: 'Filesystem Apprentice', xp: 0 },
  { level: 2, title: 'Shell Operator', xp: 100 },
  { level: 3, title: 'Text Wrangler', xp: 300 },
  { level: 4, title: 'Pipeline Builder', xp: 600 },
  { level: 5, title: 'Permission Handler', xp: 1000 },
  { level: 6, title: 'Process Engineer', xp: 1500 },
];
