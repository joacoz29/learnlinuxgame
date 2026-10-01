import type { GameSession } from '../game/GameSession';
import { el } from './dom';

/** Title/continue menu. */
export class MenuOverlay {
  readonly element: HTMLDivElement;

  constructor(
    root: HTMLElement,
    session: GameSession,
    onStart: () => void,
  ) {
    this.element = el('div', 'overlay', undefined, root);
    this.element.id = 'menu';
    const box = el('div', 'panel box', undefined, this.element);
    el('h1', '', 'LINUX//QUEST', box);
    el('div', 'sub', 'APRENDÉ LINUX RESOLVIENDO PROBLEMAS', box);
    const start = el('button', 'btn', session.isNewGame ? 'START' : 'CONTINUE', box);
    start.addEventListener('click', onStart);
    if (!session.isNewGame) {
      const reset = el('button', 'btn secondary', 'NEW GAME', box);
      reset.addEventListener('click', () => {
        if (window.confirm('¿Borrar todo el progreso y empezar de nuevo?')) session.reset();
      });
    }
    const table = el('table', '', undefined, box);
    for (const [key, action] of [
      ['WASD', 'moverse'], ['MOUSE', 'mirar'], ['SHIFT', 'correr'], ['E', 'interactuar'], ['C', 'codex de comandos'], ['ESC', 'cerrar terminal / pausa'],
    ] as const) {
      const row = el('tr', '', undefined, table);
      el('td', '', key, row);
      el('td', '', action, row);
    }
  }

  setVisible(visible: boolean): void {
    this.element.classList.toggle('hidden', !visible);
  }
}

export class PauseOverlay {
  readonly element: HTMLDivElement;

  constructor(root: HTMLElement, onResume: () => void) {
    this.element = el('div', 'overlay hidden', 'PAUSED — CLICK TO RESUME', root);
    this.element.id = 'pause';
    this.element.addEventListener('click', onResume);
  }

  setVisible(visible: boolean): void {
    this.element.classList.toggle('hidden', !visible);
  }
}

/** NPC dialogue box; E / Enter / click advances. */
export class DialogueBox {
  private readonly element: HTMLDivElement;
  private readonly who: HTMLDivElement;
  private readonly text: HTMLDivElement;
  private lines: string[] = [];
  private index = 0;
  private onDone: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.element = el('div', 'hidden', undefined, root);
    this.element.id = 'dialogue';
    this.who = el('div', 'who', '', this.element);
    this.text = el('div', 'text', '', this.element);
    el('div', 'more', '[E] continue · [ESC] close', this.element);
    this.element.addEventListener('click', () => this.advance());
  }

  get isOpen(): boolean {
    return !this.element.classList.contains('hidden');
  }

  open(speaker: string, lines: string[], onDone: () => void): void {
    this.lines = lines;
    this.index = 0;
    this.onDone = onDone;
    this.who.textContent = speaker;
    this.render();
    this.element.classList.remove('hidden');
  }

  advance(): void {
    this.index++;
    if (this.index >= this.lines.length) this.close();
    else this.render();
  }

  close(): void {
    if (!this.isOpen) return;
    this.element.classList.add('hidden');
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  private render(): void {
    this.text.textContent = this.lines[this.index] ?? '';
  }
}
