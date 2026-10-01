import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { InputManager, isTypingTarget } from '../core/InputManager';
import { SECTOR_01 } from '../data/world/sector01';
import { PlayerController } from '../player/PlayerController';
import { CodexUI } from '../ui/CodexUI';
import { HUD } from '../ui/HUD';
import { Minimap } from '../ui/Minimap';
import { DialogueBox, MenuOverlay, PauseOverlay } from '../ui/Overlays';
import { TerminalUI } from '../ui/TerminalUI';
import { SceneManager } from '../world/SceneManager';
import type { ZoneActions } from '../world/props';
import type { Zone } from '../world/ZoneBuilder';
import type { GameSession } from './GameSession';
import { InteractionSystem } from './InteractionSystem';

type Mode = 'menu' | 'play' | 'paused' | 'terminal' | 'codex' | 'dialogue';

/** Wires the simulation (GameSession) to rendering, input, audio and UI. */
export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera = new THREE.PerspectiveCamera(75, 1, 0.1, 120);
  private readonly sceneManager = new SceneManager();
  private readonly input: InputManager;
  private readonly player: PlayerController;
  private readonly interaction = new InteractionSystem();
  private readonly audio = new AudioManager();
  private readonly hud: HUD;
  private readonly terminalUI: TerminalUI;
  private readonly codexUI: CodexUI;
  private readonly dialogue: DialogueBox;
  private readonly menu: MenuOverlay;
  private readonly pause: PauseOverlay;
  private readonly minimap: Minimap;
  private readonly zone: Zone;
  private lastFrame = performance.now();
  private mode: Mode = 'menu';
  private time = 0;
  private currentRegion: string | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
    readonly session: GameSession,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.input = new InputManager(canvas, (locked) => this.onLockChange(locked));
    this.player = new PlayerController(this.camera);
    this.audio.setMuted(session.settings.muted);

    this.zone = this.sceneManager.loadZone(SECTOR_01, this.zoneActions(), session.flags);
    this.interaction.setTargets(this.zone.interactables);
    this.player.teleport(this.zone.spawn.x, this.zone.spawn.z, this.zone.spawnYaw);

    this.hud = new HUD(uiRoot, session);
    this.minimap = new Minimap(this.hud.layer, SECTOR_01, session);
    this.dialogue = new DialogueBox(uiRoot);
    this.terminalUI = new TerminalUI(uiRoot, session);
    this.terminalUI.onClose = () => this.resumePlay();
    this.codexUI = new CodexUI(uiRoot, session, () => this.closeCodex());
    this.pause = new PauseOverlay(uiRoot, () => this.resumePlay());
    this.menu = new MenuOverlay(uiRoot, session, () => this.startPlaying());

    this.bindSession();
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.setMode('menu');
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Test/debug access; exposed on `window.__game` when running with `?debug`. */
  debug() {
    return {
      teleport: (x: number, z: number, yaw = 0) => this.player.teleport(x, z, yaw),
      position: () => ({ x: this.player.position.x, z: this.player.position.z, yaw: this.player.yaw }),
      mode: () => this.mode,
      session: this.session,
    };
  }

  private zoneActions(): ZoneActions {
    return {
      openTerminal: (def) => this.openTerminal(def.title),
      dialogue: (speaker, lines) => this.openDialogue(speaker, lines),
      toast: (text, tone) => this.hud.toast(text, tone === 'warn' ? 'warn' : 'info'),
      play: (id) => this.audio.play(id),
    };
  }

  private bindSession(): void {
    const { bus } = this.session;
    bus.on('command-run', ({ ok }) => this.audio.play(ok ? 'command' : 'error'));
    bus.on('objective-complete', () => {
      this.audio.play('objective');
      this.hud.refresh();
    });
    bus.on('quest-complete', ({ quest, xp, level, leveledUp }) => {
      this.audio.play('quest-complete');
      if (leveledUp) this.audio.play('level-up', 1300);
      this.hud.showMissionComplete(quest, xp, level, leveledUp);
      this.hud.flash();
      this.hud.refresh();
    });
    bus.on('sound', ({ id, delayMs }) => this.audio.play(id, delayMs));
    bus.on('notify', ({ text }) => this.hud.toast(text, 'good', 5200));
    bus.on('codex-discovered', ({ command }) => {
      this.hud.toast(`CODEX UPDATED · ${command}`);
      this.audio.play('codex');
    });
    bus.on('region-discovered', ({ name }) => {
      this.hud.toast(`AREA DISCOVERED · ${name}`);
      this.audio.play('area-discovered');
    });
    bus.on('flag-set', () => this.zone.syncFlags(this.session.flags, false));
    bus.on('reset', () => window.location.reload());
  }

  // ------------------------------------------------------------ modes

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.input.enabled = mode === 'play';
    this.menu.setVisible(mode === 'menu');
    this.pause.setVisible(mode === 'paused');
    this.hud.setVisible(mode !== 'menu');
    if (mode !== 'play') this.hud.setPrompt(null);
  }

  private startPlaying(): void {
    this.audio.unlock();
    this.resumePlay();
  }

  private resumePlay(): void {
    this.setMode('play');
    this.input.requestLock();
  }

  private onLockChange(locked: boolean): void {
    if (!locked && this.mode === 'play') this.setMode('paused');
  }

  private openTerminal(title: string): void {
    this.audio.play('interact');
    this.setMode('terminal');
    this.input.releaseLock();
    this.terminalUI.open(title);
  }

  private openCodex(): void {
    this.setMode('codex');
    this.input.releaseLock();
    this.codexUI.open();
  }

  private closeCodex(): void {
    this.codexUI.close();
    this.resumePlay();
  }

  private openDialogue(speaker: string, lines: string[]): void {
    this.audio.play('interact');
    this.setMode('dialogue');
    this.dialogue.open(speaker, lines, () => this.resumePlay());
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;
    if (e.code === 'Escape') {
      if (this.mode === 'terminal') this.terminalUI.close();
      else if (this.mode === 'codex') this.closeCodex();
      else if (this.mode === 'dialogue') this.dialogue.close();
      return;
    }
    if (isTypingTarget(e.target)) return;
    if (this.mode === 'dialogue' && (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space')) {
      this.dialogue.advance();
    } else if (this.mode === 'codex' && e.code === 'KeyC') {
      this.closeCodex();
    } else if (this.mode === 'play') {
      if (e.code === 'KeyE' && this.interaction.interact()) e.preventDefault();
      else if (e.code === 'KeyC') this.openCodex();
    }
    if (e.code === 'KeyM' && this.mode !== 'menu') {
      const muted = !this.audio.muted;
      this.audio.setMuted(muted);
      this.session.updateSettings({ muted });
      this.hud.toast(muted ? 'AUDIO MUTED' : 'AUDIO ON');
    }
  }

  // ------------------------------------------------------------ frame

  private frame(): void {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    this.time += dt;
    if (this.mode === 'play') this.updatePlay(dt);
    this.sceneManager.update(dt, this.time, this.player.position);
    this.minimap.draw(this.player.position.x, this.player.position.z, this.player.yaw);
    this.renderer.render(this.sceneManager.scene, this.camera);
    this.input.endFrame();
  }

  private updatePlay(dt: number): void {
    this.player.update(dt, this.input, this.zone.collision);
    const target = this.interaction.update(this.player.position, this.player.forward());
    this.hud.setPrompt(target?.label() ?? null);
    this.trackRegion();
  }

  private trackRegion(): void {
    const { x, z } = this.player.position;
    const size = this.zone.def.tileSize;
    const tx = Math.floor(x / size);
    const tz = Math.floor(z / size);
    const region = this.zone.def.regions.find(
      (r) => tx >= r.bounds[0] && tz >= r.bounds[1] && tx <= r.bounds[2] && tz <= r.bounds[3],
    );
    if (!region || region.id === this.currentRegion) return;
    this.currentRegion = region.id;
    this.hud.setRegion(region.name);
    this.session.discoverRegion(region.id, region.name);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
