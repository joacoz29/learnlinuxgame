import { VirtualFileSystem } from '../filesystem/VirtualFileSystem';

export interface Completion {
  /** index in the input where the completed word starts */
  start: number;
  candidates: string[];
}

/** Tab completion: command names for the first word, paths for the rest. */
export function complete(input: string, cwd: string, fs: VirtualFileSystem, commandNames: string[]): Completion {
  const start = Math.max(input.lastIndexOf(' '), input.lastIndexOf('|'), input.lastIndexOf(';')) + 1;
  const word = input.slice(start);
  const isFirstWord = input.slice(0, start).trim() === '' || /[|;]\s*$/.test(input.slice(0, start));

  if (isFirstWord && !word.includes('/')) {
    return { start, candidates: commandNames.filter((n) => n.startsWith(word)).sort() };
  }

  const slash = word.lastIndexOf('/');
  const dirPart = slash >= 0 ? word.slice(0, slash + 1) : '';
  const prefix = word.slice(slash + 1);
  const dirAbs = VirtualFileSystem.normalize(dirPart || '.', cwd);
  if (!fs.isDir(dirAbs)) return { start, candidates: [] };
  const candidates = fs
    .readdir(dirAbs)
    .filter((n) => n.startsWith(prefix) && (prefix.startsWith('.') || !n.startsWith('.')))
    .map((n) => `${dirPart}${n}${fs.isDir(VirtualFileSystem.normalize(n, dirAbs)) ? '/' : ''}`);
  return { start, candidates };
}

export function commonPrefix(values: string[]): string {
  if (values.length === 0) return '';
  let prefix = values[0] as string;
  for (const value of values) {
    while (!value.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}
