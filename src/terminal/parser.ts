/**
 * Tokenizer + parser for the shell subset used by the game:
 * words with quotes/escapes, `$VAR` expansion, pipes, `;`, `&&`, `||`,
 * and the redirections `<`, `>`, `>>`, `2>`, `2>>`.
 * The parser is pure: variable expansion happens later via `expandWord`.
 */

export interface WordPart {
  text: string;
  /** false inside single quotes or after a backslash: `$` stays literal */
  expand: boolean;
}

export interface Word {
  parts: WordPart[];
  /** unquoted leading `~` that should expand to $HOME */
  tilde: boolean;
}

export interface Redirect {
  fd: 0 | 1 | 2;
  mode: 'read' | 'write' | 'append';
  target: Word;
}

export interface SimpleCommand {
  argv: Word[];
  redirects: Redirect[];
}

export interface Pipeline {
  commands: SimpleCommand[];
}

export type Connector = ';' | '&&' | '||';

export interface ListItem {
  pipeline: Pipeline;
  /** how this item chains to the *next* one; null for the last item */
  connector: Connector | null;
}

export type ParsedLine = ListItem[];

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

type Token =
  | { kind: 'word'; word: Word }
  | { kind: 'op'; op: '|' | ';' | '&&' | '||' | '<' | '>' | '>>' | '2>' | '2>>' };

const VAR_PATTERN = /\$(\?|[A-Za-z_][A-Za-z0-9_]*|\{[A-Za-z_][A-Za-z0-9_]*\})/g;

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let parts: WordPart[] = [];
  let started = false;
  let tilde = false;
  let i = 0;

  const push = (text: string, expand: boolean): void => {
    if (!started) {
      started = true;
      tilde = false;
    }
    const last = parts[parts.length - 1];
    if (last && last.expand === expand) last.text += text;
    else parts.push({ text, expand });
  };
  const flush = (): void => {
    if (started) tokens.push({ kind: 'word', word: { parts, tilde } });
    parts = [];
    started = false;
    tilde = false;
  };
  const op = (value: Extract<Token, { kind: 'op' }>['op']): void => {
    flush();
    tokens.push({ kind: 'op', op: value });
  };

  while (i < line.length) {
    const ch = line[i] as string;
    const next = line[i + 1];

    if (ch === ' ' || ch === '\t') {
      flush();
      i++;
    } else if (ch === '#' && !started) {
      break;
    } else if (ch === "'") {
      const end = line.indexOf("'", i + 1);
      if (end === -1) throw new ParseError("unexpected EOF while looking for matching `''");
      push(line.slice(i + 1, end), false);
      i = end + 1;
    } else if (ch === '"') {
      i = readDoubleQuoted(line, i, push);
    } else if (ch === '\\') {
      if (next === undefined) throw new ParseError('unexpected EOF after backslash');
      push(next, false);
      i += 2;
    } else if (ch === '|') {
      const double = next === '|';
      op(double ? '||' : '|');
      i += double ? 2 : 1;
    } else if (ch === '&') {
      if (next !== '&') throw new ParseError('operator `&` is not supported yet');
      op('&&');
      i += 2;
    } else if (ch === ';') {
      op(';');
      i++;
    } else if (ch === '<') {
      op('<');
      i++;
    } else if (ch === '>') {
      const append = next === '>';
      op(append ? '>>' : '>');
      i += append ? 2 : 1;
    } else if (ch === '2' && !started && next === '>') {
      const append = line[i + 2] === '>';
      op(append ? '2>>' : '2>');
      i += append ? 3 : 2;
    } else {
      if (ch === '~' && !started && (next === undefined || next === '/' || next === ' ' || next === '\t')) {
        started = true;
        tilde = true;
        i++;
        continue;
      }
      push(ch, true);
      i++;
    }
  }
  flush();
  return tokens;
}

function readDoubleQuoted(line: string, start: number, push: (text: string, expand: boolean) => void): number {
  let i = start + 1;
  let buffer = '';
  while (i < line.length) {
    const ch = line[i] as string;
    if (ch === '"') {
      push(buffer, true);
      return i + 1;
    }
    if (ch === '\\' && i + 1 < line.length && '"\\$'.includes(line[i + 1] as string)) {
      push(buffer, true);
      buffer = '';
      push(line[i + 1] as string, false);
      i += 2;
      continue;
    }
    buffer += ch;
    i++;
  }
  throw new ParseError('unexpected EOF while looking for matching `"\'');
}

const REDIRECTS = {
  '<': { fd: 0, mode: 'read' },
  '>': { fd: 1, mode: 'write' },
  '>>': { fd: 1, mode: 'append' },
  '2>': { fd: 2, mode: 'write' },
  '2>>': { fd: 2, mode: 'append' },
} as const;

function syntaxError(token: Token | undefined): ParseError {
  const near = token ? (token.kind === 'op' ? token.op : wordText(token.word)) : 'newline';
  return new ParseError(`syntax error near unexpected token \`${near}'`);
}

function wordText(word: Word): string {
  return word.parts.map((p) => p.text).join('');
}

export function parseLine(line: string): ParsedLine {
  const tokens = tokenize(line);
  const items: ListItem[] = [];
  let pos = 0;

  const parseCommand = (): SimpleCommand => {
    const cmd: SimpleCommand = { argv: [], redirects: [] };
    while (pos < tokens.length) {
      const token = tokens[pos] as Token;
      if (token.kind === 'word') {
        cmd.argv.push(token.word);
        pos++;
      } else if (token.op in REDIRECTS) {
        const spec = REDIRECTS[token.op as keyof typeof REDIRECTS];
        const target = tokens[pos + 1];
        if (!target || target.kind !== 'word') throw syntaxError(target);
        cmd.redirects.push({ ...spec, target: target.word });
        pos += 2;
      } else {
        break;
      }
    }
    if (cmd.argv.length === 0 && cmd.redirects.length === 0) throw syntaxError(tokens[pos]);
    return cmd;
  };

  while (pos < tokens.length) {
    const commands: SimpleCommand[] = [parseCommand()];
    while (tokens[pos]?.kind === 'op' && (tokens[pos] as { op: string }).op === '|') {
      pos++;
      commands.push(parseCommand());
    }
    const sep = tokens[pos];
    let connector: Connector | null = null;
    if (sep) {
      if (sep.kind !== 'op') throw syntaxError(sep);
      connector = sep.op as Connector;
      pos++;
    }
    items.push({ pipeline: { commands }, connector });
    // `cmd ;` with nothing after it is valid; `cmd &&` with nothing after is not
    if (connector && connector !== ';' && pos >= tokens.length) throw syntaxError(undefined);
  }
  return items;
}

/** Expands `$VAR`, `${VAR}`, `$?` and a leading `~` into the final argument string. */
export function expandWord(word: Word, vars: Readonly<Record<string, string>>, lastExit: number): string {
  const body = word.parts
    .map((part) =>
      part.expand
        ? part.text.replace(VAR_PATTERN, (_m, name: string) => {
            if (name === '?') return String(lastExit);
            const key = name.startsWith('{') ? name.slice(1, -1) : name;
            return vars[key] ?? '';
          })
        : part.text,
    )
    .join('');
  return word.tilde ? (vars.HOME ?? '') + body : body;
}
