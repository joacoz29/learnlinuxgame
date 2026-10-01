export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  parent?.append(node);
  return node;
}

const ANSI_CLASSES: Record<number, string> = { 1: 'ansi-bold', 34: 'ansi-blue', 36: 'ansi-cyan', 32: 'ansi-green', 31: 'ansi-red' };

/** Converts the SGR color codes our commands emit into spans, without ever using innerHTML. */
export function ansiToFragment(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const pattern = /\x1b\[([0-9;]*)m/g;
  let classes: string[] = [];
  let last = 0;
  const emit = (chunk: string): void => {
    if (!chunk) return;
    if (classes.length === 0) fragment.append(chunk);
    else el('span', classes.join(' '), chunk, fragment as unknown as HTMLElement);
  };
  for (const match of text.matchAll(pattern)) {
    emit(text.slice(last, match.index));
    last = (match.index ?? 0) + match[0].length;
    const codes = (match[1] ?? '').split(';').map((c) => Number(c || 0));
    if (codes.includes(0)) classes = [];
    for (const code of codes) {
      const cls = ANSI_CLASSES[code];
      if (cls && !classes.includes(cls)) classes.push(cls);
    }
  }
  emit(text.slice(last));
  return fragment;
}
