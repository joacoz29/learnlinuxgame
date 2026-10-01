import { VirtualFileSystem } from './VirtualFileSystem';

/** Declarative description of filesystem content, used by world and quest data. */
export interface FsSpec {
  dirs?: string[];
  /** path -> content */
  files?: Record<string, string>;
}

/** Creates the directories and files described by `spec` (parents are created as needed). */
export function applyFsSpec(fs: VirtualFileSystem, spec: FsSpec, owner = 'player'): void {
  for (const dir of spec.dirs ?? []) fs.mkdir(VirtualFileSystem.normalize(dir), { parents: true, owner });
  for (const [path, content] of Object.entries(spec.files ?? {})) {
    const abs = VirtualFileSystem.normalize(path);
    fs.mkdir(VirtualFileSystem.dirname(abs), { parents: true, owner });
    fs.writeFile(abs, content, { owner });
  }
}
