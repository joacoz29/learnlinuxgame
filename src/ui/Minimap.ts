import type { ZoneDef } from '../data/world/types';
import type { GameSession } from '../game/GameSession';
import { el } from './dom';

const CELL = 7;

/** Top-down map of the zone. Rooms stay hidden until the player discovers their region. */
export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;
  readonly element: HTMLDivElement;

  constructor(
    parent: HTMLElement,
    private readonly def: ZoneDef,
    private readonly session: GameSession,
  ) {
    this.element = el('div', 'hud-card', undefined, parent);
    this.element.id = 'hud-minimap';
    const canvas = el('canvas', '', undefined, this.element);
    canvas.width = Math.max(...def.layout.map((r) => r.length)) * CELL;
    canvas.height = def.layout.length * CELL;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    this.ctx = ctx;
  }

  draw(playerX: number, playerZ: number, yaw: number): void {
    const { ctx, def, session } = this;
    const discovered = new Set(session.progression.state.regions);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    def.layout.forEach((row, tz) => {
      [...row].forEach((c, tx) => {
        if (c === ' ') return;
        const region = def.regions.find((r) => tx >= r.bounds[0] && tz >= r.bounds[1] && tx <= r.bounds[2] && tz <= r.bounds[3]);
        const known = !region || discovered.has(region.id);
        const object = def.objects[c];
        if (def.tiles[c]?.kind === 'wall') ctx.fillStyle = known ? '#2a4a78' : '#162238';
        else if (object?.kind === 'door') ctx.fillStyle = session.hasFlag(object.unlockFlag) ? '#3dff9a' : object.teaserFlag && session.hasFlag(object.teaserFlag) ? '#ffb13d' : '#ff3355';
        else if (!known) return;
        else if (object?.kind === 'terminal') ctx.fillStyle = '#35e0ff';
        else if (object?.kind === 'npc') ctx.fillStyle = '#ff3df2';
        else if (def.tiles[c]?.kind === 'rack' || def.tiles[c]?.kind === 'crate') ctx.fillStyle = '#1d3a5c';
        else ctx.fillStyle = '#0f2a44';
        ctx.fillRect(tx * CELL, tz * CELL, CELL, CELL);
      });
    });
    const px = (playerX / def.tileSize) * CELL;
    const pz = (playerZ / def.tileSize) * CELL;
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-yaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3.5, 4);
    ctx.lineTo(-3.5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
