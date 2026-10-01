import { FsError, type FsErrorCode } from '../filesystem/VirtualFileSystem';
import type { CommandResult, ErrorCode } from './types';

export const ok = (stdout = ''): CommandResult => ({ stdout, stderr: '', exitCode: 0 });

export const fail = (stderr: string, errorCode: ErrorCode, exitCode = 1): CommandResult => ({
  stdout: '',
  stderr: stderr.endsWith('\n') ? stderr : `${stderr}\n`,
  exitCode,
  errorCode,
});

const FS_MESSAGES: Record<FsErrorCode, string> = {
  ENOENT: 'No such file or directory',
  EEXIST: 'File exists',
  EISDIR: 'Is a directory',
  ENOTDIR: 'Not a directory',
  ENOTEMPTY: 'Directory not empty',
  EINVAL: 'Invalid argument',
};

export function fsMessage(error: unknown): { message: string; code: FsErrorCode } {
  if (error instanceof FsError) return { message: FS_MESSAGES[error.code], code: error.code };
  throw error;
}

export interface ParsedFlags {
  flags: Set<string>;
  operands: string[];
  /** first unknown option, if any */
  invalid?: string;
}

/** Parses short flags (`-a`, `-la`) against the allowed letters; `--` ends options. */
export function parseFlags(args: string[], allowed: string): ParsedFlags {
  const flags = new Set<string>();
  const operands: string[] = [];
  let invalid: string | undefined;
  let optionsDone = false;
  for (const arg of args) {
    if (optionsDone || arg === '-' || !arg.startsWith('-')) {
      operands.push(arg);
    } else if (arg === '--') {
      optionsDone = true;
    } else if (arg.startsWith('--')) {
      invalid ??= arg;
    } else {
      for (const letter of arg.slice(1)) {
        if (allowed.includes(letter)) flags.add(letter);
        else invalid ??= `-${letter}`;
      }
    }
  }
  return { flags, operands, invalid };
}

export function invalidOption(command: string, option: string): CommandResult {
  const shown = option.startsWith('--') ? `unrecognized option '${option}'` : `invalid option -- '${option.slice(1)}'`;
  return fail(`${command}: ${shown}\nTry '${command} --help' for more information.`, 'EOPT');
}

/** Renders `-rwxr-xr-x` style permission strings. */
export function formatMode(type: 'file' | 'dir', mode: number): string {
  const triplet = (bits: number): string =>
    `${bits & 4 ? 'r' : '-'}${bits & 2 ? 'w' : '-'}${bits & 1 ? 'x' : '-'}`;
  return `${type === 'dir' ? 'd' : '-'}${triplet((mode >> 6) & 7)}${triplet((mode >> 3) & 7)}${triplet(mode & 7)}`;
}
