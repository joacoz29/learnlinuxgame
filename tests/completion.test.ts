import { describe, expect, it } from 'vitest';
import { commonPrefix, complete } from '../src/terminal/completion';
import { makeShell } from './helpers';

const world = {
  dirs: ['/home/player/docs', '/home/player/downloads'],
  files: { '/home/player/readme.txt': 'x', '/home/player/.hidden': 'y', '/home/player/docs/a.txt': 'z' },
};

describe('completion', () => {
  const { fs } = makeShell(world);
  const names = ['ls', 'cat', 'cd', 'clear'];

  it('completes command names for the first word and after pipes', () => {
    expect(complete('c', '/home/player', fs, names).candidates).toEqual(['cat', 'cd', 'clear']);
    expect(complete('ls | c', '/home/player', fs, names).candidates).toEqual(['cat', 'cd', 'clear']);
  });

  it('completes paths, marking directories and hiding dotfiles', () => {
    expect(complete('cat re', '/home/player', fs, names).candidates).toEqual(['readme.txt']);
    expect(complete('cd d', '/home/player', fs, names).candidates).toEqual(['docs/', 'downloads/']);
    expect(complete('cat ', '/home/player', fs, names).candidates).not.toContain('.hidden');
    expect(complete('cat .h', '/home/player', fs, names).candidates).toEqual(['.hidden']);
    expect(complete('cat docs/', '/home/player', fs, names)).toEqual({ start: 4, candidates: ['docs/a.txt'] });
  });

  it('computes common prefixes', () => {
    expect(commonPrefix(['docs/', 'downloads/'])).toBe('do');
    expect(commonPrefix([])).toBe('');
  });
});
