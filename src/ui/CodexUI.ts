import { CODEX, type CodexEntry } from '../data/commands/codex';
import { CONCEPT_LABELS } from '../data/commands/concepts';
import type { GameSession } from '../game/GameSession';
import { el } from './dom';

/** Command encyclopedia: entries unlock the first time the player uses a command successfully. */
export class CodexUI {
  readonly element: HTMLDivElement;
  private selected: string | null = null;
  private readonly list: HTMLDivElement;
  private readonly detail: HTMLDivElement;
  private readonly tools: HTMLDivElement;
  private readonly concepts: HTMLDivElement;

  constructor(
    root: HTMLElement,
    private readonly session: GameSession,
    private readonly onClose: () => void,
  ) {
    this.element = el('div', 'overlay hidden', undefined, root);
    this.element.id = 'codex';
    const win = el('div', 'panel codex-window', undefined, this.element);
    this.tools = el('div', 'codex-tools', undefined, win);
    const body = el('div', 'codex-body', undefined, win);
    this.list = el('div', 'codex-list', undefined, body);
    this.detail = el('div', 'codex-detail', undefined, body);
    this.concepts = el('div', 'codex-concepts', undefined, win);
    this.element.addEventListener('mousedown', (e) => {
      if (e.target === this.element) this.onClose();
    });
  }

  get isOpen(): boolean {
    return !this.element.classList.contains('hidden');
  }

  open(): void {
    this.render();
    this.element.classList.remove('hidden');
  }

  close(): void {
    this.element.classList.add('hidden');
  }

  private render(): void {
    const known = new Set(this.session.progression.state.codex);
    this.selected ??= CODEX.find((e) => known.has(e.command))?.command ?? null;

    this.tools.replaceChildren();
    el('div', '', `TOOLS DISCOVERED ${known.size}/${CODEX.length}`, this.tools);
    const chips = el('div', '', undefined, this.tools);
    for (const entry of CODEX) if (known.has(entry.command)) el('span', 'chip', entry.command, chips);

    this.list.replaceChildren();
    for (const entry of CODEX) {
      const unlocked = known.has(entry.command);
      const button = el('button', `${unlocked ? '' : 'locked'} ${entry.command === this.selected ? 'sel' : ''}`.trim(), unlocked ? entry.command : '???', this.list);
      button.type = 'button';
      if (unlocked) {
        button.addEventListener('click', () => {
          this.selected = entry.command;
          this.render();
        });
      }
    }

    const entry = CODEX.find((e) => e.command === this.selected && known.has(e.command));
    this.renderDetail(entry);

    const learned = this.session.progression.state.concepts;
    this.concepts.textContent = learned.length
      ? `CONCEPTS LEARNED: ${learned.map((c) => CONCEPT_LABELS[c] ?? c).join(' · ')}`
      : 'CONCEPTS LEARNED: none yet — complete missions to master concepts.';
  }

  private renderDetail(entry: CodexEntry | undefined): void {
    this.detail.replaceChildren();
    if (!entry) {
      el('div', '', 'Usá un comando con éxito en una terminal para registrarlo en el Codex.', this.detail);
      return;
    }
    el('h2', '', entry.command, this.detail);
    el('h4', '', 'DESCRIPTION', this.detail);
    el('div', '', entry.description, this.detail);
    el('h4', '', 'EXAMPLES', this.detail);
    for (const example of entry.examples) el('code', '', `$ ${example}`, this.detail);
    el('h4', '', 'UNLOCKED BY', this.detail);
    el('div', '', entry.unlockedBy, this.detail);
  }
}
