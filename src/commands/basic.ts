import type { Command } from './types';
import { fail, ok } from './util';

export const pwd: Command = {
  name: 'pwd',
  description: 'Print the current working directory',
  usage: 'pwd',
  execute: (ctx) => ok(`${ctx.state.cwd}\n`),
};

export const whoami: Command = {
  name: 'whoami',
  description: 'Print the current user name',
  usage: 'whoami',
  execute: (ctx) => ok(`${ctx.state.user}\n`),
};

export const hostname: Command = {
  name: 'hostname',
  description: 'Print the name of this machine',
  usage: 'hostname',
  execute: (ctx) => ok(`${ctx.state.hostname}\n`),
};

export const clear: Command = {
  name: 'clear',
  description: 'Clear the terminal screen',
  usage: 'clear',
  execute: () => ({ ...ok(), clear: true }),
};

export const echo: Command = {
  name: 'echo',
  description: 'Print text to the output',
  usage: 'echo [-n] [text...]',
  ownsHelpFlag: true,
  execute: (_ctx, args) => {
    const noNewline = args[0] === '-n';
    const text = (noNewline ? args.slice(1) : args).join(' ');
    return ok(noNewline ? text : `${text}\n`);
  },
};

export const help: Command = {
  name: 'help',
  description: 'List the commands available to you',
  usage: 'help',
  execute: (ctx) => {
    const list = [...ctx.commands].sort((a, b) => a.name.localeCompare(b.name));
    const width = Math.max(...list.map((c) => c.name.length)) + 2;
    const rows = list.map((c) => `  ${c.name.padEnd(width)}${c.description}`);
    return ok(`Available commands:\n${rows.join('\n')}\n\nTip: <command> --help shows how a command is used.\n`);
  },
};

export const unknownCommandResult = (name: string) => fail(`bash: ${name}: command not found`, 'ENOCMD', 127);
