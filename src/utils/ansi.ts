const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

export const ansi = {
  reset: '\x1b[0m',
  bold: (s: string): string => `\x1b[1m${s}\x1b[0m`,
  blue: (s: string): string => `\x1b[1;34m${s}\x1b[0m`,
  cyan: (s: string): string => `\x1b[36m${s}\x1b[0m`,
};

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}
