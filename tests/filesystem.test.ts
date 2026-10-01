import { describe, expect, it } from 'vitest';
import { FsError, VirtualFileSystem } from '../src/filesystem/VirtualFileSystem';
import { applyFsSpec } from '../src/filesystem/spec';

const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return e instanceof FsError ? e.code : 'other';
  }
  return undefined;
};

describe('VirtualFileSystem', () => {
  it('normalizes paths', () => {
    expect(VirtualFileSystem.normalize('a/b/../c', '/home')).toBe('/home/a/c');
    expect(VirtualFileSystem.normalize('/../..')).toBe('/');
    expect(VirtualFileSystem.normalize('./x//y/', '/')).toBe('/x/y');
    expect(VirtualFileSystem.dirname('/a/b/c')).toBe('/a/b');
    expect(VirtualFileSystem.basename('/a/b/c')).toBe('c');
  });

  it('creates directories and files', () => {
    const fs = new VirtualFileSystem();
    fs.mkdir('/home');
    fs.writeFile('/home/a.txt', 'hi');
    expect(fs.readFile('/home/a.txt')).toBe('hi');
    fs.writeFile('/home/a.txt', '!', { append: true });
    expect(fs.readFile('/home/a.txt')).toBe('hi!');
    expect(fs.readdir('/home')).toEqual(['a.txt']);
  });

  it('reports POSIX-like errors', () => {
    const fs = new VirtualFileSystem();
    fs.mkdir('/d');
    fs.writeFile('/f', 'x');
    expect(code(() => fs.mkdir('/d'))).toBe('EEXIST');
    expect(code(() => fs.mkdir('/nope/child'))).toBe('ENOENT');
    expect(code(() => fs.readFile('/d'))).toBe('EISDIR');
    expect(code(() => fs.readFile('/missing'))).toBe('ENOENT');
    expect(code(() => fs.readdir('/f'))).toBe('ENOTDIR');
    expect(code(() => fs.writeFile('/f/x', ''))).toBe('ENOTDIR');
    expect(code(() => fs.writeFile('/d', 'x'))).toBe('EISDIR');
  });

  it('supports mkdir -p and idempotence', () => {
    const fs = new VirtualFileSystem();
    fs.mkdir('/a/b/c', { parents: true });
    fs.mkdir('/a/b/c', { parents: true });
    expect(fs.isDir('/a/b/c')).toBe(true);
  });

  it('removes with the right guards', () => {
    const fs = new VirtualFileSystem();
    fs.mkdir('/a/b', { parents: true });
    expect(code(() => fs.remove('/a'))).toBe('ENOTEMPTY');
    fs.remove('/a', { recursive: true });
    expect(fs.exists('/a')).toBe(false);
    expect(code(() => fs.remove('/'))).toBe('EINVAL');
  });

  it('touch does not overwrite existing content', () => {
    const fs = new VirtualFileSystem();
    fs.writeFile('/f', 'keep');
    fs.touch('/f');
    expect(fs.readFile('/f')).toBe('keep');
  });

  it('round-trips through snapshots without sharing state', () => {
    const fs = new VirtualFileSystem();
    applyFsSpec(fs, { dirs: ['/x'], files: { '/x/y/z.txt': 'deep' } });
    const copy = VirtualFileSystem.restore(fs.snapshot());
    copy.writeFile('/x/y/z.txt', 'changed');
    expect(fs.readFile('/x/y/z.txt')).toBe('deep');
    expect(copy.readFile('/x/y/z.txt')).toBe('changed');
  });
});
