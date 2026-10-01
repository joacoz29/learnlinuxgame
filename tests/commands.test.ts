import { describe, expect, it } from 'vitest';
import { makeShell } from './helpers';

const world = {
  dirs: ['/home/player/docs', '/var/log'],
  files: {
    '/home/player/readme.txt': 'hello\n',
    '/home/player/.hidden': 'secret\n',
    '/home/player/docs/a.txt': 'A\n',
    '/var/log/boot.log': 'ok\n',
  },
};

describe('basic commands', () => {
  it('pwd, whoami, hostname', () => {
    const { run } = makeShell(world);
    expect(run('pwd').out).toBe('/home/player\n');
    expect(run('whoami').out).toBe('player\n');
    expect(run('hostname').out).toBe('test-box\n');
  });

  it('echo handles -n and quotes', () => {
    const { run } = makeShell();
    expect(run('echo hello   world').out).toBe('hello world\n');
    expect(run('echo -n hi').out).toBe('hi');
    expect(run('echo "a   b"').out).toBe('a   b\n');
    expect(run('echo $USER ~').out).toBe('player /home/player\n');
  });

  it('clear sets the clear flag', () => {
    expect(makeShell().run('clear').cleared).toBe(true);
  });
});

describe('navigation', () => {
  it('ls hides dotfiles unless -a, and works with paths', () => {
    const { run } = makeShell(world);
    expect(run('ls').out).toBe('docs  readme.txt\n');
    expect(run('ls -a').out).toBe('.  ..  .hidden  docs  readme.txt\n');
    expect(run('ls /var/log').out).toBe('boot.log\n');
    expect(run('ls docs readme.txt').out).toBe('readme.txt\n\ndocs:\na.txt\n');
  });

  it('ls output is one-per-line when piped and colorless', () => {
    const { run } = makeShell(world);
    expect(run('ls | cat').out).toBe('docs\nreadme.txt\n');
  });

  it('ls -l shows modes and sizes', () => {
    const { run } = makeShell(world);
    const out = run('ls -l docs').out;
    expect(out).toContain('total');
    expect(out).toMatch(/-rw-r--r-- 1 player player\s+2 Jan  1 00:00 a\.txt/);
  });

  it('ls reports missing paths with exit code 2', () => {
    const { run } = makeShell(world);
    const r = run('ls nope');
    expect(r.err).toBe("ls: cannot access 'nope': No such file or directory\n");
    expect(r.exitCode).toBe(2);
  });

  it('cd moves around and updates PWD/OLDPWD', () => {
    const { run, state } = makeShell(world);
    run('cd docs');
    expect(state.cwd).toBe('/home/player/docs');
    run('cd ..');
    run('cd /var/log');
    expect(state.vars.PWD).toBe('/var/log');
    expect(run('cd -').out).toBe('/home/player\n');
    run('cd');
    expect(state.cwd).toBe('/home/player');
    run('cd /var/log');
    run('cd ~');
    expect(state.cwd).toBe('/home/player');
  });

  it('cd explains failures', () => {
    const { run } = makeShell(world);
    expect(run('cd nowhere').err).toBe('bash: cd: nowhere: No such file or directory\n');
    expect(run('cd readme.txt').err).toBe('bash: cd: readme.txt: Not a directory\n');
    expect(run('cd a b').exitCode).toBe(1);
  });
});

describe('files', () => {
  it('mkdir, touch and cat', () => {
    const { run, fs } = makeShell(world);
    expect(run('mkdir work').exitCode).toBe(0);
    expect(fs.isDir('/home/player/work')).toBe(true);
    expect(run('mkdir work').err).toContain('File exists');
    expect(run('mkdir a/b/c').err).toContain('No such file or directory');
    expect(run('mkdir -p a/b/c').exitCode).toBe(0);
    run('touch work/new.txt');
    expect(fs.readFile('/home/player/work/new.txt')).toBe('');
    expect(run('cat readme.txt').out).toBe('hello\n');
    expect(run('cat missing').err).toBe('cat: missing: No such file or directory\n');
    expect(run('cat docs').err).toBe('cat: docs: Is a directory\n');
  });

  it('mkdir and touch require operands', () => {
    const { run } = makeShell();
    expect(run('mkdir').err).toContain('missing operand');
    expect(run('touch').executed[0]?.errorCode).toBe('EUSAGE');
  });

  it('cat concatenates and keeps going after an error', () => {
    const { run } = makeShell(world);
    const r = run('cat readme.txt missing docs/a.txt');
    expect(r.out).toBe('hello\nA\n');
    expect(r.err).toContain('missing');
    expect(r.exitCode).toBe(1);
  });
});

describe('redirections and pipes', () => {
  it('echo > creates and truncates, >> appends', () => {
    const { run, fs } = makeShell(world);
    run('echo one > f.txt');
    run('echo two >> f.txt');
    expect(fs.readFile('/home/player/f.txt')).toBe('one\ntwo\n');
    run('echo three > f.txt');
    expect(fs.readFile('/home/player/f.txt')).toBe('three\n');
  });

  it('redirect errors are reported like bash', () => {
    const { run } = makeShell(world);
    expect(run('echo x > nodir/f').err).toBe('bash: nodir/f: No such file or directory\n');
    expect(run('echo x > docs').err).toBe('bash: docs: Is a directory\n');
    expect(run('cat < missing').err).toBe('bash: missing: No such file or directory\n');
  });

  it('< feeds stdin and pipes pass output along', () => {
    const { run } = makeShell(world);
    expect(run('cat < readme.txt').out).toBe('hello\n');
    expect(run('echo hi | cat | cat').out).toBe('hi\n');
  });

  it('2> captures stderr', () => {
    const { run, fs } = makeShell(world);
    const r = run('cat missing 2> err.txt');
    expect(r.err).toBe('');
    expect(fs.readFile('/home/player/err.txt')).toBe('cat: missing: No such file or directory\n');
  });

  it('; && || chain on exit codes', () => {
    const { run } = makeShell(world);
    expect(run('echo a ; echo b').out).toBe('a\nb\n');
    expect(run('cat missing && echo yes').out).toBe('');
    expect(run('cat missing || echo fallback').out).toBe('fallback\n');
    expect(run('echo ok && echo next').out).toBe('ok\nnext\n');
    expect(run('cat missing ; echo $?').out).toBe('1\n');
  });
});

describe('errors and policy', () => {
  it('unknown commands exit 127', () => {
    const { run } = makeShell();
    const r = run('frobnicate');
    expect(r.err).toBe('bash: frobnicate: command not found\n');
    expect(r.exitCode).toBe(127);
    expect(r.executed[0]?.errorCode).toBe('ENOCMD');
  });

  it('commands outside the allowed set behave as not found but are flagged', () => {
    const { engine, state } = makeShell();
    const r = engine.run('cat x', state, { allowed: new Set(['ls']) });
    expect(r.executed[0]?.errorCode).toBe('ELOCKED');
    expect(r.exitCode).toBe(127);
  });

  it('syntax errors do not crash', () => {
    const { run } = makeShell();
    const r = run('echo "unclosed');
    expect(r.exitCode).toBe(2);
    expect(r.executed[0]?.errorCode).toBe('EPARSE');
  });

  it('--help prints usage, unknown flags are rejected', () => {
    const { run } = makeShell();
    expect(run('ls --help').out).toContain('Usage: ls');
    expect(run('echo --help').out).toBe('--help\n');
    expect(run('ls -z').err).toContain("invalid option -- 'z'");
  });
});
