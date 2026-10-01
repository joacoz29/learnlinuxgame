import { describe, expect, it } from 'vitest';
import { ProgressionSystem, levelForXp } from '../src/progression/ProgressionSystem';

describe('progression', () => {
  it('maps xp to levels', () => {
    expect(levelForXp(0).level).toBe(1);
    expect(levelForXp(99).level).toBe(1);
    expect(levelForXp(100).title).toBe('Shell Operator');
    expect(levelForXp(100).xpIntoLevel).toBe(0);
  });

  it('reports level ups once', () => {
    const p = new ProgressionSystem();
    expect(p.addXp(50)).toBeNull();
    expect(p.addXp(60)?.level).toBe(2);
    expect(p.addXp(10)).toBeNull();
  });

  it('tracks discoveries without duplicates', () => {
    const p = new ProgressionSystem();
    expect(p.discoverCommand('ls')).toBe(true);
    expect(p.discoverCommand('ls')).toBe(false);
    expect(p.discoverRegion('a')).toBe(true);
    expect(p.discoverRegion('a')).toBe(false);
  });
});
