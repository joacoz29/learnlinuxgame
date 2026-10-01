import type { GameSession } from '../game/GameSession';
import type { LevelInfo } from '../progression/ProgressionSystem';
import { DIFFICULTY_RULES } from '../progression/difficulty';
import type { QuestDefinition } from '../quests/types';
import { el } from './dom';

export type ToastTone = 'info' | 'warn' | 'good';

/** Always-on overlay: objective, level, prompts, toasts and mission banners. */
export class HUD {
  private readonly objectiveCard: HTMLDivElement;
  private readonly levelCard: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly region: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  private readonly flashEl: HTMLDivElement;
  private readonly hudLayer: HTMLDivElement;

  constructor(
    root: HTMLElement,
    private readonly session: GameSession,
  ) {
    this.hudLayer = el('div', '', undefined, root);
    this.hudLayer.id = 'hud';
    const layer = this.hudLayer;
    this.objectiveCard = el('div', 'hud-card', undefined, layer);
    this.objectiveCard.id = 'hud-objective';
    this.levelCard = el('div', 'hud-card', undefined, layer);
    this.levelCard.id = 'hud-level';
    this.region = el('div', 'hud-card', undefined, layer);
    this.region.id = 'hud-region';
    el('div', '', undefined, layer).id = 'hud-crosshair';
    this.prompt = el('div', 'hidden', undefined, layer);
    this.prompt.id = 'hud-prompt';
    this.toasts = el('div', '', undefined, layer);
    this.toasts.id = 'toasts';
    this.flashEl = el('div', '', undefined, layer);
    this.flashEl.id = 'flash';
    const controls = el('div', 'hud-card', undefined, layer);
    controls.id = 'hud-controls';
    controls.innerHTML = '<b>WASD</b> move · <b>MOUSE</b> look · <b>SHIFT</b> run · <b>E</b> interact · <b>C</b> codex · <b>M</b> mute';
    this.refresh();
  }

  get layer(): HTMLElement {
    return this.hudLayer;
  }

  setVisible(visible: boolean): void {
    this.hudLayer.classList.toggle('hidden', !visible);
  }

  setPrompt(label: string | null): void {
    this.prompt.classList.toggle('hidden', label === null);
    if (label === null) return;
    this.prompt.replaceChildren(el('kbd', '', 'E'), document.createTextNode(label));
  }

  setRegion(name: string): void {
    this.region.textContent = name;
  }

  toast(text: string, tone: ToastTone = 'info', durationMs = 3600): void {
    const node = el('div', `toast ${tone === 'info' ? '' : tone}`, text, this.toasts);
    window.setTimeout(() => node.classList.add('fade'), durationMs);
    window.setTimeout(() => node.remove(), durationMs + 600);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
  }

  flash(): void {
    this.flashEl.classList.remove('on');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('on');
  }

  showMissionComplete(quest: QuestDefinition, xp: number, level: LevelInfo, leveledUp: boolean): void {
    const banner = el('div', '', undefined, this.hudLayer);
    banner.id = 'banner';
    el('div', 'kicker', 'MISSION COMPLETE', banner);
    el('div', 'name', quest.title, banner);
    el('div', 'xp', `+${xp} XP`, banner);
    if (leveledUp) el('div', 'level', `LEVEL UP  ·  ${level.title}`, banner);
    window.setTimeout(() => banner.remove(), 5200);
  }

  /** Re-renders the objective and level cards from session state. */
  refresh(): void {
    this.renderObjective();
    this.renderLevel();
  }

  private renderObjective(): void {
    const quest = this.session.quests.active();
    const card = this.objectiveCard;
    card.replaceChildren();
    if (!quest) {
      el('div', 'hud-label', 'STATUS', card);
      el('div', 'title', 'FREE EXPLORATION', card);
      el('div', 'objective', 'Sector 02 is open. Explore it — the next mission arrives in the next milestone.', card);
      return;
    }
    const views = this.session.quests.objectives();
    const done = views.filter((v) => v.done).length;
    el('div', 'hud-label', 'CURRENT MISSION', card);
    el('div', 'title', quest.title, card);
    el('div', 'objective', views.find((v) => v.current)?.objective.text ?? '', card);
    el('div', 'meta', `${done}/${views.length} objectives · ${DIFFICULTY_RULES[quest.difficulty].label}`, card);
  }

  private renderLevel(): void {
    const info = this.session.progression.info();
    this.levelCard.replaceChildren();
    el('div', 'hud-label', `LEVEL ${info.level}`, this.levelCard);
    el('div', 'name', info.title, this.levelCard);
    const bar = el('div', 'bar', undefined, this.levelCard);
    const fill = el('i', '', undefined, bar);
    const ratio = info.xpForNext > 0 ? info.xpIntoLevel / info.xpForNext : 1;
    fill.style.width = `${Math.round(ratio * 100)}%`;
    const text = info.xpForNext > 0 ? `${info.xpIntoLevel} / ${info.xpForNext} XP` : `${this.session.progression.state.xp} XP (max)`;
    el('div', 'xp', text, this.levelCard);
  }
}
