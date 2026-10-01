import { LEVELS, type LevelDef } from '../data/levels/levels';

export interface ProgressionState {
  xp: number;
  concepts: string[];
  /** commands the player has used successfully and that appear in the Codex */
  codex: string[];
  /** map regions the player has visited */
  regions: string[];
}

export interface LevelInfo extends LevelDef {
  xpIntoLevel: number;
  /** XP span of the current level; 0 at the maximum level */
  xpForNext: number;
}

export function emptyProgression(): ProgressionState {
  return { xp: 0, concepts: [], codex: [], regions: [] };
}

export function levelForXp(xp: number, levels: readonly LevelDef[] = LEVELS): LevelInfo {
  let index = 0;
  levels.forEach((l, i) => {
    if (xp >= l.xp) index = i;
  });
  const current = levels[index] as LevelDef;
  const next = levels[index + 1];
  return { ...current, xpIntoLevel: xp - current.xp, xpForNext: next ? next.xp - current.xp : 0 };
}

export class ProgressionSystem {
  constructor(readonly state: ProgressionState = emptyProgression()) {}

  info(): LevelInfo {
    return levelForXp(this.state.xp);
  }

  /** Adds XP; returns the new level info if the player leveled up. */
  addXp(amount: number): LevelInfo | null {
    const before = this.info().level;
    this.state.xp += amount;
    const after = this.info();
    return after.level > before ? after : null;
  }

  learnConcepts(ids: string[]): void {
    for (const id of ids) if (!this.state.concepts.includes(id)) this.state.concepts.push(id);
  }

  /** Returns true the first time a command is discovered. */
  discoverCommand(name: string): boolean {
    if (this.state.codex.includes(name)) return false;
    this.state.codex.push(name);
    return true;
  }

  /** Returns true the first time a region is visited. */
  discoverRegion(id: string): boolean {
    if (this.state.regions.includes(id)) return false;
    this.state.regions.push(id);
    return true;
  }
}
