import type { GameSession } from '../game/GameSession';
import { DIFFICULTY_RULES } from '../progression/difficulty';
import { commonPrefix } from '../terminal/completion';
import type { OutputLine } from '../terminal/TerminalSystem';
import { ansiToFragment, el } from './dom';

/** HTML terminal window. All behavior comes from `session.runCommand`; this only renders and captures input. */
export class TerminalUI {
  readonly element: HTMLDivElement;
  onClose: () => void = () => undefined;
  private readonly output: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly promptEl: HTMLSpanElement;
  private readonly suggest: HTMLDivElement;
  private readonly title: HTMLSpanElement;
  private readonly side: HTMLDivElement;
  private historyIndex = -1;
  private draft = '';
  private printedBanner = false;

  constructor(
    root: HTMLElement,
    private readonly session: GameSession,
  ) {
    this.element = el('div', 'overlay hidden', undefined, root);
    this.element.id = 'terminal';
    const window_ = el('div', 'panel terminal-window', undefined, this.element);
    const bar = el('div', 'term-titlebar', undefined, window_);
    this.title = el('span', '', 'TERMINAL', bar);
    el('span', '', 'ESC to close · TAB complete · ↑↓ history', bar);
    const body = el('div', 'term-body', undefined, window_);
    const main = el('div', 'term-main', undefined, body);
    this.output = el('div', 'term-output', undefined, main);
    this.suggest = el('div', 'term-suggest', undefined, main);
    const row = el('div', 'term-inputrow', undefined, main);
    this.promptEl = el('span', 'prompt', '', row);
    this.input = el('input', '', undefined, row);
    this.input.spellcheck = false;
    this.input.autocomplete = 'off';
    this.input.setAttribute('autocapitalize', 'off');
    this.side = el('div', 'term-side', undefined, body);

    main.addEventListener('click', () => this.input.focus());
    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.input.addEventListener('input', () => this.renderSuggestions());
    for (const event of ['objective-complete', 'quest-complete', 'command-run'] as const) {
      session.bus.on(event, () => this.renderSide());
    }
  }

  get isOpen(): boolean {
    return !this.element.classList.contains('hidden');
  }

  open(title: string): void {
    this.title.textContent = title;
    this.element.classList.remove('hidden');
    if (!this.printedBanner) {
      this.printedBanner = true;
      this.append(this.session.terminalBanner().map((text) => ({ kind: 'system', text }) as OutputLine), 'banner');
    }
    this.refreshPrompt();
    this.renderSide();
    this.renderSuggestions();
    // Focus after the opening keypress has fully propagated so "E" is not typed into the input.
    window.setTimeout(() => this.input.focus(), 0);
  }

  close(): void {
    if (!this.isOpen) return;
    this.element.classList.add('hidden');
    this.input.blur();
    this.onClose();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.submit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.complete();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.browseHistory(e.key === 'ArrowUp' ? -1 : 1);
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      this.output.replaceChildren();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      this.append([{ kind: 'echo', text: `${this.input.value}^C`, prompt: this.session.terminal.prompt() }]);
      this.input.value = '';
      this.renderSuggestions();
    }
  }

  private submit(): void {
    const line = this.input.value;
    this.input.value = '';
    this.historyIndex = -1;
    const result = this.session.runCommand(line);
    if (result.clear) this.output.replaceChildren();
    else this.append(result.lines);
    this.refreshPrompt();
    this.renderSuggestions();
  }

  private append(lines: OutputLine[], extraClass = ''): void {
    for (const line of lines) {
      const node = el('div', `term-line ${line.kind} ${extraClass}`.trim());
      if (line.kind === 'echo') {
        el('span', 'prompt', line.prompt ?? '', node);
        node.append(line.text);
      } else if (line.kind === 'out') {
        node.append(ansiToFragment(line.text));
      } else {
        node.textContent = line.text;
      }
      this.output.append(node);
    }
    this.output.scrollTop = this.output.scrollHeight;
  }

  private refreshPrompt(): void {
    this.promptEl.textContent = this.session.terminal.prompt();
  }

  private complete(): void {
    const value = this.input.value;
    const { start, candidates } = this.session.terminal.complete(value);
    if (candidates.length === 0) return;
    const prefix = commonPrefix(candidates);
    const completed = candidates.length === 1 && !prefix.endsWith('/') ? `${prefix} ` : prefix;
    this.input.value = value.slice(0, start) + completed;
    this.renderSuggestions();
  }

  private browseHistory(direction: -1 | 1): void {
    const history = this.session.terminal.history;
    if (history.length === 0) return;
    if (this.historyIndex === -1) {
      if (direction === 1) return;
      this.draft = this.input.value;
      this.historyIndex = history.length - 1;
    } else {
      this.historyIndex += direction;
      if (this.historyIndex >= history.length) {
        this.historyIndex = -1;
        this.input.value = this.draft;
        return;
      }
      this.historyIndex = Math.max(0, this.historyIndex);
    }
    this.input.value = history[this.historyIndex] ?? '';
  }

  private renderSuggestions(): void {
    this.suggest.replaceChildren();
    if (!this.session.settings.suggestions || !this.session.suggestionsAvailable()) return;
    const value = this.input.value;
    const { start, candidates } = this.session.terminal.complete(value);
    for (const candidate of candidates.slice(0, 10)) {
      const chip = el('button', 'chip', candidate, this.suggest);
      chip.type = 'button';
      chip.addEventListener('click', () => {
        this.input.value = value.slice(0, start) + candidate + (candidate.endsWith('/') ? '' : ' ');
        this.input.focus();
        this.renderSuggestions();
      });
    }
  }

  private renderSide(): void {
    const { session, side } = this;
    side.replaceChildren();
    const quest = session.quests.active();
    el('h3', '', 'MISSION', side);
    if (!quest) {
      el('div', 'quest', 'Free exploration', side);
      el('div', 'diff', 'No active missions.', side);
    } else {
      el('div', 'quest', quest.title, side);
      el('div', 'diff', `${DIFFICULTY_RULES[quest.difficulty].label} · ${quest.sector}`, side);
      el('h3', '', 'OBJECTIVES', side);
      const list = el('ul', '', undefined, side);
      for (const view of session.quests.objectives()) {
        if (!view.done && !view.current) continue;
        el('li', view.done ? 'done' : 'current', view.objective.text, list);
      }
      const hint = el('button', 'btn', 'HINT', side);
      hint.type = 'button';
      hint.addEventListener('click', () => {
        this.input.value = 'hint';
        this.submit();
        this.input.focus();
      });
    }
    if (session.suggestionsAvailable()) {
      const label = el('label', '', undefined, side);
      const box = el('input', '', undefined, label);
      box.type = 'checkbox';
      box.checked = session.settings.suggestions;
      box.addEventListener('change', () => {
        session.updateSettings({ suggestions: box.checked });
        this.renderSuggestions();
      });
      label.append(' Show suggestions');
    }
    const keys = el('div', 'keys', undefined, side);
    keys.innerHTML = '<b>help</b> list commands<br><b>hint</b> ask for a hint<br><b>quest</b> mission status<br><b>cmd --help</b> usage';
  }
}
