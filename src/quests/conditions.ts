import type { ExecutedCommand } from '../commands/CommandEngine';
import type { ShellState } from '../commands/types';
import { VirtualFileSystem } from '../filesystem/VirtualFileSystem';
import type { Condition } from './types';

export interface EvalContext {
  fs: VirtualFileSystem;
  shell: ShellState;
  /** commands executed by the line that was just run */
  commands: readonly ExecutedCommand[];
}

export function evaluateCondition(condition: Condition, ctx: EvalContext): boolean {
  switch (condition.type) {
    case 'commandRan':
      return ctx.commands.some(
        (c) =>
          c.name === condition.command &&
          (condition.succeeded === false || c.exitCode === 0) &&
          (condition.argIncludes === undefined || c.args.some((a) => a.includes(condition.argIncludes as string))),
      );
    case 'fileExists':
      return ctx.fs.isFile(condition.path);
    case 'dirExists':
      return ctx.fs.isDir(condition.path);
    case 'fileContains':
      return ctx.fs.isFile(condition.path) && ctx.fs.readFile(condition.path).includes(condition.text);
    case 'cwdIs':
      return VirtualFileSystem.normalize(condition.path) === ctx.shell.cwd;
    case 'all':
      return condition.conditions.every((c) => evaluateCondition(c, ctx));
    case 'any':
      return condition.conditions.some((c) => evaluateCondition(c, ctx));
  }
}
