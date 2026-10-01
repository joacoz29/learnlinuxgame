import { describe, expect, it } from 'vitest';
import { ParseError, expandWord, parseLine, type Word } from '../src/terminal/parser';

const text = (w: Word): string => w.parts.map((p) => p.text).join('');
const argv = (line: string): string[] => (parseLine(line)[0]?.pipeline.commands[0]?.argv ?? []).map(text);

describe('parser', () => {
  it('splits words and handles quotes', () => {
    expect(argv('echo hello   world')).toEqual(['echo', 'hello', 'world']);
    expect(argv('echo "hello world" \'a  b\'')).toEqual(['echo', 'hello world', 'a  b']);
    expect(argv('echo ""')).toEqual(['echo', '']);
    expect(argv('echo a\\ b')).toEqual(['echo', 'a b']);
  });

  it('parses pipes into stages', () => {
    const [item] = parseLine('cat a | cat | cat');
    expect(item?.pipeline.commands).toHaveLength(3);
  });

  it('parses redirections, including 2>', () => {
    const [item] = parseLine('echo hi > out.txt 2> err.txt < in.txt');
    const redirects = item?.pipeline.commands[0]?.redirects ?? [];
    expect(redirects.map((r) => [r.fd, r.mode, text(r.target)])).toEqual([
      [1, 'write', 'out.txt'],
      [2, 'write', 'err.txt'],
      [0, 'read', 'in.txt'],
    ]);
    const append = parseLine('echo hi >> log')[0]?.pipeline.commands[0]?.redirects[0];
    expect(append?.mode).toBe('append');
  });

  it('does not treat a 2 inside a word as a redirection', () => {
    expect(argv('echo a2 > f')).toEqual(['echo', 'a2']);
    expect(argv('echo 2')).toEqual(['echo', '2']);
  });

  it('parses connectors', () => {
    const items = parseLine('a ; b && c || d');
    expect(items.map((i) => i.connector)).toEqual([';', '&&', '||', null]);
  });

  it('allows a trailing semicolon but not a dangling &&', () => {
    expect(parseLine('ls ;')).toHaveLength(1);
    expect(() => parseLine('ls &&')).toThrow(ParseError);
  });

  it('reports syntax errors', () => {
    expect(() => parseLine('echo "oops')).toThrow(ParseError);
    expect(() => parseLine('| ls')).toThrow(/unexpected token/);
    expect(() => parseLine('ls >')).toThrow(/newline/);
    expect(() => parseLine('sleep 5 &')).toThrow(ParseError);
  });

  it('ignores comments', () => {
    expect(argv('echo hi # comment')).toEqual(['echo', 'hi']);
    expect(parseLine('# just a comment')).toEqual([]);
  });

  it('expands variables, tilde and exit status', () => {
    const vars = { HOME: '/home/player', NAME: 'Ada' };
    const expand = (line: string): string[] =>
      (parseLine(line)[0]?.pipeline.commands[0]?.argv ?? []).map((w) => expandWord(w, vars, 7));
    expect(expand('echo $NAME ${NAME}x "$NAME" \'$NAME\' $MISSING $?')).toEqual([
      'echo', 'Ada', 'Adax', 'Ada', '$NAME', '', '7',
    ]);
    expect(expand('cd ~ ~/docs \\~')).toEqual(['cd', '/home/player', '/home/player/docs', '~']);
    expect(expand('echo "\\$NAME"')).toEqual(['echo', '$NAME']);
  });
});
