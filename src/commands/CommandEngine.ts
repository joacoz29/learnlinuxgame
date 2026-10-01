import { FsError, VirtualFileSystem } from '../filesystem/VirtualFileSystem';
import { ParseError, expandWord, parseLine, type Pipeline, type Redirect, type SimpleCommand } from '../terminal/parser';
import { unknownCommandResult } from './basic';
import { CommandRegistry } from './index';
import type { Command, CommandContext, CommandResult, ErrorCode, ShellState } from './types';

export interface ExecutedCommand {
  name: string;
  args: string[];
  exitCode: number;
  errorCode?: ErrorCode;
}

export interface OutputChunk {
  stream: 'out' | 'err';
  text: string;
}

export interface ExecutionResult {
  chunks: OutputChunk[];
  exitCode: number;
  cleared: boolean;
  /** every command that actually ran (or failed to), in order — quests validate against this */
  executed: ExecutedCommand[];
}

export interface RunOptions {
  /** names of commands the player may use right now; null means all */
  allowed?: ReadonlySet<string> | null;
}

/** Runs shell lines against a virtual filesystem. Has no dependency on rendering or UI. */
export class CommandEngine {
  constructor(
    private readonly fs: VirtualFileSystem,
    private readonly registry = new CommandRegistry(),
  ) {}

  availableCommands(allowed?: ReadonlySet<string> | null): Command[] {
    return this.registry.list().filter((c) => !allowed || allowed.has(c.name));
  }

  run(line: string, state: ShellState, options: RunOptions = {}): ExecutionResult {
    const result: ExecutionResult = { chunks: [], exitCode: 0, cleared: false, executed: [] };
    let items;
    try {
      items = parseLine(line);
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      result.chunks.push({ stream: 'err', text: `bash: ${e.message}\n` });
      result.exitCode = 2;
      result.executed.push({ name: '', args: [], exitCode: 2, errorCode: 'EPARSE' });
      state.lastExitCode = 2;
      return result;
    }

    let previous = 0;
    items.forEach((item, index) => {
      const before = index > 0 ? items[index - 1]?.connector : null;
      const skip = (before === '&&' && previous !== 0) || (before === '||' && previous === 0);
      if (skip) return;
      previous = this.runPipeline(item.pipeline, state, options, result);
      state.lastExitCode = previous;
    });
    result.exitCode = previous;
    return result;
  }

  private runPipeline(pipeline: Pipeline, state: ShellState, options: RunOptions, out: ExecutionResult): number {
    let stdin: string | null = null;
    let exitCode = 0;
    pipeline.commands.forEach((command, index) => {
      const isLast = index === pipeline.commands.length - 1;
      const stage = this.runStage(command, state, options, out, stdin, !isLast);
      exitCode = stage.exitCode;
      stdin = stage.passOn;
    });
    return exitCode;
  }

  private runStage(
    command: SimpleCommand,
    state: ShellState,
    options: RunOptions,
    out: ExecutionResult,
    stdin: string | null,
    toPipe: boolean,
  ): { exitCode: number; passOn: string | null } {
    const expand = (w: Parameters<typeof expandWord>[0]): string => expandWord(w, state.vars, state.lastExitCode);
    const resolve = (p: string): string => VirtualFileSystem.normalize(p, state.cwd);
    const redirects = this.prepareRedirects(command.redirects, expand, resolve, state, out);
    if (!redirects.ok) return { exitCode: 1, passOn: toPipe ? '' : null };

    const input = redirects.stdin ?? stdin;
    const argv = command.argv.map(expand);
    const name = argv[0];
    let result: CommandResult;
    if (name === undefined) {
      result = { stdout: '', stderr: '', exitCode: 0 };
    } else {
      result = this.execute(name, argv.slice(1), state, options, input, toPipe || redirects.stdout !== undefined);
      out.executed.push({ name, args: argv.slice(1), exitCode: result.exitCode, errorCode: result.errorCode });
      if (result.clear) out.cleared = true;
    }

    const stdoutText = this.deliver(result.stdout, redirects.stdout, resolve, out, toPipe ? 'pipe' : 'out');
    this.deliver(result.stderr, redirects.stderr, resolve, out, 'err');
    return { exitCode: result.exitCode, passOn: toPipe ? stdoutText : null };
  }

  private execute(
    name: string,
    args: string[],
    state: ShellState,
    options: RunOptions,
    stdin: string | null,
    piped: boolean,
  ): CommandResult {
    const command = this.registry.get(name);
    if (!command) return unknownCommandResult(name);
    if (options.allowed && !options.allowed.has(command.name)) {
      return { ...unknownCommandResult(name), errorCode: 'ELOCKED' };
    }
    if (!command.ownsHelpFlag && args.includes('--help')) {
      return { stdout: `Usage: ${command.usage}\n${command.description}\n`, stderr: '', exitCode: 0 };
    }
    const ctx: CommandContext = {
      fs: this.fs,
      state,
      stdin,
      piped,
      resolve: (p) => VirtualFileSystem.normalize(p, state.cwd),
      commands: this.availableCommands(options.allowed),
    };
    return command.execute(ctx, args);
  }

  /** Routes text to its destination; returns what should flow to the next pipe stage. */
  private deliver(
    text: string,
    redirect: { path: string; append: boolean } | undefined,
    resolve: (p: string) => string,
    out: ExecutionResult,
    target: 'out' | 'err' | 'pipe',
  ): string {
    if (redirect) {
      this.fs.writeFile(resolve(redirect.path), text, { append: true });
      return '';
    }
    if (target === 'pipe') return text;
    if (text) out.chunks.push({ stream: target, text });
    return text;
  }

  private prepareRedirects(
    redirects: Redirect[],
    expand: (w: Redirect['target']) => string,
    resolve: (p: string) => string,
    state: ShellState,
    out: ExecutionResult,
  ): { ok: boolean; stdin?: string; stdout?: { path: string; append: boolean }; stderr?: { path: string; append: boolean } } {
    const prepared: { ok: boolean; stdin?: string; stdout?: { path: string; append: boolean }; stderr?: { path: string; append: boolean } } = { ok: true };
    for (const redirect of redirects) {
      const path = expand(redirect.target);
      try {
        if (redirect.mode === 'read') {
          prepared.stdin = this.fs.readFile(resolve(path));
        } else {
          const abs = resolve(path);
          if (redirect.mode === 'write') this.fs.writeFile(abs, '');
          else this.fs.touch(abs, state.user);
          const dest = { path, append: true };
          if (redirect.fd === 1) prepared.stdout = dest;
          else prepared.stderr = dest;
        }
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        const reason = { ENOENT: 'No such file or directory', EISDIR: 'Is a directory', ENOTDIR: 'Not a directory' }[e.code as string] ?? 'Invalid argument';
        out.chunks.push({ stream: 'err', text: `bash: ${path}: ${reason}\n` });
        out.executed.push({ name: '', args: [], exitCode: 1, errorCode: e.code });
        return { ok: false };
      }
    }
    return prepared;
  }
}
