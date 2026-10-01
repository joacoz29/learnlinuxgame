import type { Command, CommandResult } from './types';
import { fail, fsMessage, invalidOption, ok, parseFlags } from './util';

export const mkdir: Command = {
  name: 'mkdir',
  description: 'Create directories (-p creates parents as needed)',
  usage: 'mkdir [-p] directory...',
  execute: (ctx, args) => {
    const { flags, operands, invalid } = parseFlags(args, 'p');
    if (invalid) return invalidOption('mkdir', invalid);
    if (operands.length === 0) return fail("mkdir: missing operand\nTry 'mkdir --help' for more information.", 'EUSAGE');
    let result: CommandResult = ok();
    for (const operand of operands) {
      try {
        ctx.fs.mkdir(ctx.resolve(operand), { parents: flags.has('p'), owner: ctx.state.user });
      } catch (e) {
        const { message, code } = fsMessage(e);
        const err = fail(`mkdir: cannot create directory ‘${operand}’: ${message}`, code);
        result = { ...err, stderr: result.stderr + err.stderr, errorCode: result.errorCode ?? code };
      }
    }
    return result;
  },
};

export const touch: Command = {
  name: 'touch',
  description: 'Create empty files',
  usage: 'touch file...',
  execute: (ctx, args) => {
    if (args.length === 0) return fail("touch: missing file operand\nTry 'touch --help' for more information.", 'EUSAGE');
    let result: CommandResult = ok();
    for (const operand of args) {
      try {
        ctx.fs.touch(ctx.resolve(operand), ctx.state.user);
      } catch (e) {
        const { message, code } = fsMessage(e);
        const err = fail(`touch: cannot touch ‘${operand}’: ${message}`, code);
        result = { ...err, stderr: result.stderr + err.stderr, errorCode: result.errorCode ?? code };
      }
    }
    return result;
  },
};

export const cat: Command = {
  name: 'cat',
  description: 'Print the contents of files',
  usage: 'cat [file...]',
  execute: (ctx, args) => {
    if (args.length === 0) return ok(ctx.stdin ?? '');
    let stdout = '';
    let stderr = '';
    let errorCode: CommandResult['errorCode'];
    for (const operand of args) {
      try {
        stdout += ctx.fs.readFile(ctx.resolve(operand));
      } catch (e) {
        const { message, code } = fsMessage(e);
        stderr += `cat: ${operand}: ${message}\n`;
        errorCode ??= code;
      }
    }
    return { stdout, stderr, exitCode: errorCode ? 1 : 0, errorCode };
  },
};
