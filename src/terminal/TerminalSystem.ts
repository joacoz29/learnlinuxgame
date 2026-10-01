import { CommandEngine, type ExecutedCommand, type ExecutionResult } from '../commands/CommandEngine';
import type { ErrorCode, ShellState } from '../commands/types';
import { VirtualFileSystem } from '../filesystem/VirtualFileSystem';
import { coachMessage, type CoachLevel } from './coach';
import { complete, type Completion } from './completion';

export type LineKind = 'echo' | 'out' | 'err' | 'coach' | 'system' | 'lesson';

export interface OutputLine {
  kind: LineKind;
  text: string;
  /** for `echo` lines: the prompt that was shown when the command was typed */
  prompt?: string;
}

export interface SubmitResult {
  lines: OutputLine[];
  clear: boolean;
  /** raw engine result; undefined for built-in game commands such as `hint` */
  execution?: ExecutionResult;
}

/** Built-in game commands (not Linux): `hint`, `quest`, ... They never touch the virtual machine. */
export type MetaHandler = (args: string[]) => OutputLine[];

export interface TerminalPolicy {
  /** commands usable right now (null = everything) */
  allowedCommands(): ReadonlySet<string> | null;
  coachLevel(): CoachLevel;
}

const MAX_HISTORY = 200;

/** Glue between the player's typed line, the command engine, and the explanations shown to the player. */
export class TerminalSystem {
  readonly history: string[] = [];
  private readonly meta = new Map<string, { handler: MetaHandler; description: string }>();

  constructor(
    private readonly fs: VirtualFileSystem,
    private readonly engine: CommandEngine,
    readonly state: ShellState,
    private readonly policy: TerminalPolicy,
  ) {}

  registerMeta(name: string, description: string, handler: MetaHandler): void {
    this.meta.set(name, { handler, description });
  }

  prompt(): string {
    const { user, hostname, cwd, vars } = this.state;
    const home = vars.HOME ?? '';
    const shown = home && (cwd === home || cwd.startsWith(`${home}/`)) ? `~${cwd.slice(home.length)}` : cwd;
    return `${user}@${hostname}:${shown}$ `;
  }

  submit(rawLine: string): SubmitResult {
    const line = rawLine.trim();
    const echo: OutputLine = { kind: 'echo', text: rawLine, prompt: this.prompt() };
    if (!line) return { lines: [echo], clear: false };

    if (this.history[this.history.length - 1] !== line) this.history.push(line);
    if (this.history.length > MAX_HISTORY) this.history.shift();

    const [first = '', ...rest] = line.split(/\s+/);
    const metaCommand = this.meta.get(first);
    if (metaCommand) return { lines: [echo, ...metaCommand.handler(rest)], clear: false };

    const execution = this.engine.run(line, this.state, { allowed: this.policy.allowedCommands() });
    const lines: OutputLine[] = [echo];
    for (const chunk of execution.chunks) {
      const kind: LineKind = chunk.stream === 'out' ? 'out' : 'err';
      lines.push(...splitLines(chunk.text).map((text) => ({ kind, text })));
    }
    if (execution.executed.some((c) => c.name === 'help')) lines.push(...this.metaHelp());
    lines.push(...this.coach(execution.executed));
    return { lines, clear: execution.cleared, execution };
  }

  complete(input: string): Completion {
    const names = [
      ...this.engine.availableCommands(this.policy.allowedCommands()).map((c) => c.name),
      ...this.meta.keys(),
    ];
    return complete(input, this.state.cwd, this.fs, names);
  }

  private metaHelp(): OutputLine[] {
    const rows = [...this.meta].map(([name, { description }]) => `  ${name.padEnd(8)}${description}`);
    return [{ kind: 'system', text: 'Game commands:' }, ...rows.map((text) => ({ kind: 'system' as const, text }))];
  }

  private coach(executed: ExecutedCommand[]): OutputLine[] {
    const failure = executed.find((c) => c.errorCode);
    if (!failure?.errorCode) return [];
    const message = coachMessage(
      failure.errorCode as ErrorCode,
      { command: failure.name, cwd: this.state.cwd },
      this.policy.coachLevel(),
    );
    return message ? [{ kind: 'coach', text: message }] : [];
  }
}

export function splitLines(text: string): string[] {
  const body = text.endsWith('\n') ? text.slice(0, -1) : text;
  return body.split('\n');
}
