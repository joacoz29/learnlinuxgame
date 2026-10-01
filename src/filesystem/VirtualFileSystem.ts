export type FsErrorCode = 'ENOENT' | 'EEXIST' | 'EISDIR' | 'ENOTDIR' | 'ENOTEMPTY' | 'EINVAL';

export class FsError extends Error {
  constructor(
    readonly code: FsErrorCode,
    readonly path: string,
  ) {
    super(`${code}: ${path}`);
    this.name = 'FsError';
  }
}

interface NodeBase {
  mode: number;
  owner: string;
  group: string;
}
export interface FileNode extends NodeBase {
  type: 'file';
  content: string;
}
export interface DirNode extends NodeBase {
  type: 'dir';
  children: Record<string, FsNode>;
}
export type FsNode = FileNode | DirNode;

export interface NodeStat {
  type: 'file' | 'dir';
  name: string;
  size: number;
  mode: number;
  owner: string;
  group: string;
}

const DIR_MODE = 0o755;
const FILE_MODE = 0o644;

function newDir(owner: string): DirNode {
  return { type: 'dir', children: {}, mode: DIR_MODE, owner, group: owner };
}

function newFile(owner: string, content = ''): FileNode {
  return { type: 'file', content, mode: FILE_MODE, owner, group: owner };
}

/**
 * In-memory POSIX-like filesystem. All paths passed to instance methods must be
 * absolute and normalized (use `VirtualFileSystem.normalize` to build them).
 * Permissions are stored but not enforced yet (arrives with the permissions sector).
 */
export class VirtualFileSystem {
  private root: DirNode;

  constructor(root?: DirNode) {
    this.root = root ?? newDir('root');
  }

  /** Resolves `path` against `cwd`, collapsing `.`, `..` and duplicate slashes. */
  static normalize(path: string, cwd = '/'): string {
    const full = path.startsWith('/') ? path : `${cwd}/${path}`;
    const parts: string[] = [];
    for (const part of full.split('/')) {
      if (part === '' || part === '.') continue;
      if (part === '..') parts.pop();
      else parts.push(part);
    }
    return `/${parts.join('/')}`;
  }

  static basename(path: string): string {
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? '/';
  }

  static dirname(path: string): string {
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    return `/${parts.join('/')}`;
  }

  private lookup(path: string): FsNode | undefined {
    let node: FsNode = this.root;
    for (const part of path.split('/').filter(Boolean)) {
      if (node.type !== 'dir') return undefined;
      const next: FsNode | undefined = node.children[part];
      if (!next) return undefined;
      node = next;
    }
    return node;
  }

  private getNode(path: string): FsNode {
    const node = this.lookup(path);
    if (!node) throw new FsError('ENOENT', path);
    return node;
  }

  private getDir(path: string): DirNode {
    const node = this.getNode(path);
    if (node.type !== 'dir') throw new FsError('ENOTDIR', path);
    return node;
  }

  exists(path: string): boolean {
    return this.lookup(path) !== undefined;
  }

  isDir(path: string): boolean {
    return this.lookup(path)?.type === 'dir';
  }

  isFile(path: string): boolean {
    return this.lookup(path)?.type === 'file';
  }

  stat(path: string): NodeStat {
    const node = this.getNode(path);
    return {
      type: node.type,
      name: VirtualFileSystem.basename(path),
      size: node.type === 'file' ? node.content.length : 4096,
      mode: node.mode,
      owner: node.owner,
      group: node.group,
    };
  }

  readFile(path: string): string {
    const node = this.getNode(path);
    if (node.type === 'dir') throw new FsError('EISDIR', path);
    return node.content;
  }

  /** Lists entry names (sorted, including hidden ones). */
  readdir(path: string): string[] {
    return Object.keys(this.getDir(path).children).sort((a, b) => a.localeCompare(b));
  }

  writeFile(path: string, content: string, options: { append?: boolean; owner?: string } = {}): void {
    const parent = this.getDir(VirtualFileSystem.dirname(path));
    const name = VirtualFileSystem.basename(path);
    const existing = parent.children[name];
    if (existing?.type === 'dir') throw new FsError('EISDIR', path);
    if (existing) {
      existing.content = options.append ? existing.content + content : content;
    } else {
      parent.children[name] = newFile(options.owner ?? 'player', content);
    }
  }

  touch(path: string, owner = 'player'): void {
    if (this.exists(path)) return;
    this.writeFile(path, '', { owner });
  }

  mkdir(path: string, options: { parents?: boolean; owner?: string } = {}): void {
    const owner = options.owner ?? 'player';
    if (path === '/') {
      if (options.parents) return;
      throw new FsError('EEXIST', path);
    }
    const existing = this.lookup(path);
    if (existing) {
      if (options.parents && existing.type === 'dir') return;
      throw new FsError('EEXIST', path);
    }
    const parentPath = VirtualFileSystem.dirname(path);
    if (options.parents && !this.exists(parentPath)) this.mkdir(parentPath, options);
    this.getDir(parentPath).children[VirtualFileSystem.basename(path)] = newDir(owner);
  }

  remove(path: string, options: { recursive?: boolean } = {}): void {
    if (path === '/') throw new FsError('EINVAL', path);
    const node = this.getNode(path);
    if (node.type === 'dir' && !options.recursive && Object.keys(node.children).length > 0) {
      throw new FsError('ENOTEMPTY', path);
    }
    delete this.getDir(VirtualFileSystem.dirname(path)).children[VirtualFileSystem.basename(path)];
  }

  snapshot(): DirNode {
    return JSON.parse(JSON.stringify(this.root)) as DirNode;
  }

  static restore(snapshot: DirNode): VirtualFileSystem {
    return new VirtualFileSystem(JSON.parse(JSON.stringify(snapshot)) as DirNode);
  }
}
