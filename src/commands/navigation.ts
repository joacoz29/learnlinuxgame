import { VirtualFileSystem } from '../filesystem/VirtualFileSystem';
import { ansi } from '../utils/ansi';
import type { Command } from './types';
import { fail, formatMode, invalidOption, ok, parseFlags } from './util';

export const cd: Command = {
  name: 'cd',
  description: 'Change the current directory',
  usage: 'cd [directory]',
  execute: (ctx, args) => {
    if (args.length > 1) return fail('bash: cd: too many arguments', 'EUSAGE');
    const { state, fs } = ctx;
    const arg = args[0];
    let printTarget = false;
    let target: string;
    if (arg === undefined) {
      target = state.vars.HOME ?? '/';
    } else if (arg === '-') {
      target = state.vars.OLDPWD ?? state.cwd;
      printTarget = true;
    } else {
      target = arg;
    }
    const abs = ctx.resolve(target);
    if (!fs.exists(abs)) return fail(`bash: cd: ${target}: No such file or directory`, 'ENOENT');
    if (!fs.isDir(abs)) return fail(`bash: cd: ${target}: Not a directory`, 'ENOTDIR');
    state.vars.OLDPWD = state.cwd;
    state.cwd = abs;
    state.vars.PWD = abs;
    return ok(printTarget ? `${abs}\n` : '');
  },
};

interface Entry {
  name: string;
  type: 'file' | 'dir';
  size: number;
  mode: number;
  owner: string;
  group: string;
}

function entryFor(fs: VirtualFileSystem, abs: string, name: string): Entry {
  const s = fs.stat(abs);
  return { name, type: s.type, size: s.size, mode: s.mode, owner: s.owner, group: s.group };
}

function renderEntries(entries: Entry[], long: boolean, piped: boolean): string {
  const label = (e: Entry): string => (e.type === 'dir' && !piped ? ansi.blue(e.name) : e.name);
  if (long) {
    const lines = entries.map(
      (e) =>
        `${formatMode(e.type, e.mode)} 1 ${e.owner.padEnd(6)} ${e.group.padEnd(6)} ${String(e.size).padStart(5)} Jan  1 00:00 ${label(e)}`,
    );
    return `total ${entries.length * 4}\n${lines.join('\n')}\n`;
  }
  if (entries.length === 0) return '';
  return `${entries.map(label).join(piped ? '\n' : '  ')}\n`;
}

export const ls: Command = {
  name: 'ls',
  description: 'List directory contents (-a hidden files, -l details)',
  usage: 'ls [-a] [-l] [path...]',
  execute: (ctx, args) => {
    const { flags, operands, invalid } = parseFlags(args, 'al1');
    if (invalid) return invalidOption('ls', invalid);
    const { fs } = ctx;
    const targets = operands.length > 0 ? operands : ['.'];
    const long = flags.has('l');
    const sections: string[] = [];
    let stderr = '';
    let failed = false;

    const files: Entry[] = [];
    const dirs: { shown: string; abs: string }[] = [];
    for (const target of targets) {
      const abs = ctx.resolve(target);
      if (!fs.exists(abs)) {
        stderr += `ls: cannot access '${target}': No such file or directory\n`;
        failed = true;
      } else if (fs.isDir(abs)) {
        dirs.push({ shown: target, abs });
      } else {
        files.push(entryFor(fs, abs, target));
      }
    }
    if (files.length > 0) sections.push(renderEntries(files, long, ctx.piped));
    for (const dir of dirs) {
      const names = fs.readdir(dir.abs).filter((n) => flags.has('a') || !n.startsWith('.'));
      const entries: Entry[] = [];
      if (flags.has('a')) {
        entries.push(entryFor(fs, dir.abs, '.'), entryFor(fs, VirtualFileSystem.dirname(dir.abs), '..'));
      }
      for (const name of names) {
        entries.push(entryFor(fs, VirtualFileSystem.normalize(name, dir.abs), name));
      }
      const header = targets.length > 1 ? `${dir.shown}:\n` : '';
      sections.push(header + renderEntries(entries, long, ctx.piped));
    }
    return {
      stdout: sections.join('\n'),
      stderr,
      exitCode: failed ? 2 : 0,
      errorCode: failed ? 'ENOENT' : undefined,
    };
  },
};

