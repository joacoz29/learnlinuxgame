import type { FsErrorCode, VirtualFileSystem } from '../filesystem/VirtualFileSystem';

export type ErrorCode =
  | FsErrorCode
  | 'EUSAGE' // missing/extra operands
  | 'EOPT' // unknown option
  | 'ENOCMD' // command does not exist
  | 'ELOCKED' // command exists but is not unlocked in the current mission
  | 'EPARSE'; // shell syntax error

/** Mutable state of one shell session (the player's terminal). */
export interface ShellState {
  cwd: string;
  user: string;
  hostname: string;
  /** environment variables, e.g. HOME, PWD, OLDPWD */
  vars: Record<string, string>;
  lastExitCode: number;
}

export interface CommandContext {
  fs: VirtualFileSystem;
  state: ShellState;
  /** data coming from a previous pipeline stage or `<`; null when attached to the terminal */
  stdin: string | null;
  /** true when stdout goes to a pipe or file (affects formatting such as colors) */
  piped: boolean;
  /** resolves a user-supplied path against the current directory */
  resolve(path: string): string;
  /** commands currently available to the player */
  commands: readonly Command[];
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  errorCode?: ErrorCode;
  /** ask the terminal UI to clear the screen */
  clear?: boolean;
}

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  /** set when the command wants to receive `--help` itself (e.g. echo) */
  ownsHelpFlag?: boolean;
  execute(ctx: CommandContext, args: string[]): CommandResult;
}
