import * as THREE from 'three';
import type { DoorDef, Facing, HoloDef, NpcDef, TerminalDef } from '../data/world/types';
import { approach, damp } from '../utils/math';
import { COLORS, WALL_HEIGHT, createTextPanel, facingVector, objectYaw, rackTexture } from './materials';

export interface Interactable {
  id: string;
  position: THREE.Vector3;
  radius: number;
  /** prompt text; null hides the prompt (nothing to do right now) */
  label(): string | null;
  interact(): void;
}

export interface Prop {
  object: THREE.Object3D;
  interactable?: Interactable;
  /** true while the prop blocks movement; omitted for props the grid already treats as solid */
  solid?: () => boolean;
  update?(dt: number, time: number, player: THREE.Vector3): void;
  sync?(flags: ReadonlySet<string>, instant: boolean): void;
}

/** What props may ask the game to do. Keeps the world code free of UI and audio dependencies. */
export interface ZoneActions {
  openTerminal(def: TerminalDef): void;
  dialogue(speaker: string, lines: string[]): void;
  toast(text: string, tone?: 'info' | 'warn'): void;
  play(sound: string): void;
}

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const metal = (color: number, emissive = 0x000000): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, emissive });
const glow = (color: number): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color });

function box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

// ---------------------------------------------------------------- door

type DoorState = 'locked' | 'teaser' | 'open';
const DOOR_COLORS: Record<DoorState, number> = { locked: COLORS.red, teaser: COLORS.amber, open: COLORS.green };

export function createDoor(
  def: DoorDef,
  axis: 'x' | 'z',
  at: THREE.Vector3,
  tileSize: number,
  actions: ZoneActions,
): Prop {
  const doorHeight = 2.7;
  const lintelHeight = WALL_HEIGHT - doorHeight;
  const root = new THREE.Group();
  root.position.copy(at);
  const frame = new THREE.Group();
  frame.rotation.y = axis === 'x' ? Math.PI / 2 : 0;
  root.add(frame);

  const panelMaterial = metal(0x1b2540);
  const stateMaterial = glow(COLORS.red);
  const left = new THREE.Group();
  const right = new THREE.Group();
  for (const [group, side] of [[left, -1], [right, 1]] as const) {
    group.add(box(tileSize / 2, doorHeight, 0.16, panelMaterial, 0, doorHeight / 2, 0));
    group.add(box(0.07, doorHeight * 0.92, 0.2, stateMaterial, -side * (tileSize / 4 - 0.06), doorHeight / 2, 0));
    frame.add(group);
  }
  frame.add(box(tileSize, lintelHeight, 0.42, metal(0x0e1424), 0, doorHeight + lintelHeight / 2, 0));

  const signs = [0.22, -0.22].map((z) => {
    const panel = createTextPanel(tileSize * 0.88, lintelHeight * 0.85, 640, 160);
    panel.mesh.position.set(0, doorHeight + lintelHeight / 2, z);
    if (z < 0) panel.mesh.rotation.y = Math.PI;
    frame.add(panel.mesh);
    return panel;
  });

  let state: DoorState | null = null;
  let open = 0;
  let target = 0;
  let flicker = 0;

  const prop: Prop = {
    object: root,
    solid: () => open < 0.85,
    sync(flags, instant) {
      const next: DoorState = flags.has(def.unlockFlag)
        ? 'open'
        : def.teaserFlag && flags.has(def.teaserFlag)
          ? 'teaser'
          : 'locked';
      target = next === 'open' ? 1 : 0;
      if (instant) open = target;
      if (next === state) return;
      state = next;
      const lines = def.signs[next] ?? def.signs.locked;
      for (const sign of signs) sign.draw(lines, hex(DOOR_COLORS[next]), { background: 'rgba(5,8,16,0.85)' });
    },
    update(dt, time) {
      open = approach(open, target, dt / 1.2);
      const eased = open * open * (3 - 2 * open);
      const slide = tileSize / 4 + eased * (tileSize / 4 + 0.2);
      left.position.x = -slide;
      right.position.x = slide;
      flicker = state === 'locked' ? 0.65 + 0.35 * Math.sin(time * 4) : 1;
      stateMaterial.color.setHex(DOOR_COLORS[state ?? 'locked']).multiplyScalar(flicker);
    },
    interactable: {
      id: def.id,
      position: at.clone().setY(1.2),
      radius: 3.4,
      label: () => (target === 1 ? null : 'Inspect door'),
      interact: () => {
        actions.toast(def.deniedMessage, 'warn');
        actions.play('error');
      },
    },
  };
  return prop;
}

// ---------------------------------------------------------------- terminal

export function createTerminal(def: TerminalDef, at: THREE.Vector3, tileSize: number, actions: ZoneActions): Prop {
  const front = facingVector(def.facing);
  const root = new THREE.Group();
  root.position.set(at.x - front.x * (tileSize / 2 - 0.6), 0, at.z - front.z * (tileSize / 2 - 0.6));
  root.rotation.y = objectYaw(def.facing);

  const bodyMaterial = metal(0x182038);
  root.add(box(1.2, 1.0, 0.7, bodyMaterial, 0, 0.5, 0));
  root.add(box(1.24, 0.06, 0.74, glow(COLORS.cyan), 0, 1.0, 0));
  root.add(box(1.1, 0.8, 0.22, metal(0x0c1222), 0, 1.5, -0.12));
  root.add(box(0.9, 0.06, 0.3, metal(0x222c4a), 0, 1.06, 0.3));
  const screen = createTextPanel(1.0, 0.64, 512, 320);
  screen.mesh.position.set(0, 1.52, -0.005);
  root.add(screen.mesh);

  let unlocked = false;
  let drawn: boolean | null = null;
  const world = root.position.clone().setY(1.2).add(new THREE.Vector3(front.x * 0.6, 0, front.z * 0.6));

  return {
    object: root,
    sync(flags) {
      unlocked = flags.has(def.flag);
      if (drawn === unlocked) return;
      drawn = unlocked;
      screen.draw(unlocked ? def.screen.unlocked : def.screen.locked, hex(unlocked ? COLORS.green : COLORS.red), {
        background: '#050912',
      });
    },
    update(_dt, time) {
      screen.material.opacity = 0.88 + 0.12 * Math.sin(time * 9);
    },
    interactable: {
      id: def.id,
      position: world,
      radius: 3.2,
      label: () => 'Use terminal',
      interact: () => actions.openTerminal(def),
    },
  };
}

// ---------------------------------------------------------------- npc

export function createNpc(def: NpcDef, at: THREE.Vector3, actions: ZoneActions): Prop {
  const root = new THREE.Group();
  root.position.copy(at);
  const body = new THREE.Group();
  root.add(body);

  body.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 6, 14), metal(0x2c3a5e, 0x0a1428)));
  body.children[0]?.position.set(0, 1.0, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 14), metal(0x3a4a74, 0x0a1428));
  head.position.set(0, 1.78, 0);
  body.add(head);
  body.add(box(0.36, 0.1, 0.14, glow(COLORS.cyan), 0, 1.8, 0.2));
  body.add(box(0.04, 0.3, 0.04, metal(0x56648c), 0.1, 2.15, 0));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), glow(COLORS.magenta));
  tip.position.set(0.1, 2.33, 0);
  body.add(tip);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 32), glow(COLORS.magenta));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  root.add(ring);

  let yaw = objectYaw(def.facing);
  const rest = yaw;
  return {
    object: root,
    update(dt, time, player) {
      body.position.y = 0.12 + Math.sin(time * 1.6) * 0.06;
      const dx = player.x - at.x;
      const dz = player.z - at.z;
      const near = dx * dx + dz * dz < 64;
      let goal = near ? Math.atan2(dx, dz) : rest;
      while (goal - yaw > Math.PI) goal -= Math.PI * 2;
      while (goal - yaw < -Math.PI) goal += Math.PI * 2;
      yaw = damp(yaw, goal, 5, dt);
      root.rotation.y = yaw;
    },
    interactable: {
      id: def.id,
      position: at.clone().setY(1.3),
      radius: 3.0,
      label: () => `Talk to ${def.name}`,
      interact: () => actions.dialogue(def.name, def.dialogue),
    },
  };
}

// ---------------------------------------------------------------- hologram

export function createHolo(def: HoloDef, at: THREE.Vector3, poweredBy: string | undefined): Prop {
  const root = new THREE.Group();
  root.position.copy(at);
  root.rotation.y = objectYaw(def.facing);
  root.add(box(0.8, 0.3, 0.8, metal(0x141c30), 0, 0.15, 0));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 32), glow(COLORS.cyan));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.32;
  root.add(ring);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 1.5, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beam.position.y = 1.05;
  beam.rotation.x = Math.PI;
  root.add(beam);
  const panel = createTextPanel(2.4, 1.4, 640, 360, true);
  panel.mesh.position.y = 2.0;
  panel.draw(def.lines, hex(COLORS.cyan));
  root.add(panel.mesh);

  let powered = !poweredBy;
  return {
    object: root,
    sync(flags) {
      powered = !poweredBy || flags.has(poweredBy);
      root.visible = powered;
    },
    update(_dt, time) {
      if (!powered) return;
      panel.mesh.position.y = 2.0 + Math.sin(time * 1.4) * 0.05;
      panel.material.opacity = 0.8 + 0.2 * Math.sin(time * 13) * Math.sin(time * 2.3);
    },
  };
}

// ---------------------------------------------------------------- racks & crates

const rackTextures = [rackTexture(7), rackTexture(19), rackTexture(31)];
let rackMaterials: { on: THREE.MeshBasicMaterial[]; off: THREE.MeshBasicMaterial } | null = null;

function sharedRackMaterials(): NonNullable<typeof rackMaterials> {
  rackMaterials ??= {
    on: rackTextures.map((map) => new THREE.MeshBasicMaterial({ map })),
    off: new THREE.MeshBasicMaterial({ color: 0x0a0e1a }),
  };
  return rackMaterials;
}

/** Scrolls the LED textures so powered racks look busy. Call once per frame. */
export function animateRacks(time: number): void {
  rackTextures.forEach((t, i) => (t.offset.y = (time * (0.05 + i * 0.03)) % 1));
}

const rackBody = metal(0x0d1322);
const rackGeometry = new THREE.BoxGeometry(1.3, 2.5, 1.1);
const rackFaceGeometry = new THREE.PlaneGeometry(1.15, 2.3);

export function createRack(at: THREE.Vector3, facing: Facing, poweredBy: string | undefined, variant: number): Prop {
  const root = new THREE.Group();
  root.position.copy(at);
  root.rotation.y = objectYaw(facing);
  const body = new THREE.Mesh(rackGeometry, rackBody);
  body.position.y = 1.25;
  root.add(body);
  const face = new THREE.Mesh(rackFaceGeometry, sharedRackMaterials().off);
  face.position.set(0, 1.25, 0.56);
  root.add(face);
  return {
    object: root,
    sync(flags) {
      const mats = sharedRackMaterials();
      face.material = !poweredBy || flags.has(poweredBy) ? (mats.on[variant % mats.on.length] ?? mats.off) : mats.off;
    },
  };
}

const crateMaterial = metal(0x1a2238);
const crateTrim = glow(COLORS.cyan);
const crateGeometry = new THREE.BoxGeometry(1.3, 1.1, 1.3);
const crateTrimGeometry = new THREE.BoxGeometry(1.34, 0.06, 1.34);

export function createCrate(at: THREE.Vector3): Prop {
  const root = new THREE.Group();
  root.position.copy(at);
  root.rotation.y = (at.x * 7.13 + at.z * 3.1) % Math.PI;
  const crate = new THREE.Mesh(crateGeometry, crateMaterial);
  crate.position.y = 0.55;
  const trim = new THREE.Mesh(crateTrimGeometry, crateTrim);
  trim.position.y = 0.9;
  root.add(crate, trim);
  return { object: root };
}

