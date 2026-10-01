import { CommandEngine, type ExecutionResult } from '../src/commands/CommandEngine';
import type { ShellState } from '../src/commands/types';
import { VirtualFileSystem } from '../src/filesystem/VirtualFileSystem';
import { applyFsSpec, type FsSpec } from '../src/filesystem/spec';
import { stripAnsi } from '../src/utils/ansi';

export function makeShell(spec: FsSpec = {}) {
  const fs = new VirtualFileSystem();
  applyFsSpec(fs, { dirs: ['/home/player'], ...spec, files: spec.files });
  const state: ShellState = {
    cwd: '/home/player',
    user: 'player',
    hostname: 'test-box',
    lastExitCode: 0,
    vars: { HOME: '/home/player', PWD: '/home/player', USER: 'player' },
  };
  const engine = new CommandEngine(fs);
  const run = (line: string): ExecutionResult & { out: string; err: string } => {
    const result = engine.run(line, state);
    const join = (s: 'out' | 'err'): string =>
      stripAnsi(result.chunks.filter((c) => c.stream === s).map((c) => c.text).join(''));
    return { ...result, out: join('out'), err: join('err') };
  };
  return { fs, state, engine, run };
}
