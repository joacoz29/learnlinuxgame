import * as THREE from 'three';
import type { Facing, LightDef, RegionDef, ZoneDef } from '../data/world/types';
import { approach, lerp } from '../utils/math';
import { CollisionGrid } from './collision';
import {
  COLORS,
  WALL_HEIGHT,
  cameraYaw,
  dashTexture,
  floorTexture,
  wallTexture,
} from './materials';
import {
  animateRacks,
  createCrate,
  createDoor,
  createHolo,
  createNpc,
  createRack,
  createTerminal,
  type Interactable,
  type Prop,
  type ZoneActions,
} from './props';

export interface Zone {
  def: ZoneDef;
  group: THREE.Group;
  collision: CollisionGrid;
  interactables: Interactable[];
  spawn: THREE.Vector3;
  spawnYaw: number;
  update(dt: number, time: number, player: THREE.Vector3): void;
  syncFlags(flags: ReadonlySet<string>, instant: boolean): void;
  dispose(): void;
}

const DIRS: { facing: Facing; dx: number; dz: number }[] = [
  { facing: 's', dx: 0, dz: 1 },
  { facing: 'n', dx: 0, dz: -1 },
  { facing: 'e', dx: 1, dz: 0 },
  { facing: 'w', dx: -1, dz: 0 },
];

const POWER_SPEED = 0.7;
const _tmpColor = new THREE.Color();

/** Turns declarative zone data into a Three.js scene graph, collision grid and interactables. */
export function buildZone(def: ZoneDef, actions: ZoneActions): Zone {
  const S = def.tileSize;
  const rows = def.layout;
  const width = Math.max(...rows.map((r) => r.length));
  const height = rows.length;
  const charAt = (tx: number, tz: number): string => rows[tz]?.[tx] ?? ' ';
  const center = (tx: number, tz: number, y = 0): THREE.Vector3 => new THREE.Vector3((tx + 0.5) * S, y, (tz + 0.5) * S);

  const isWall = (c: string): boolean => def.tiles[c]?.kind === 'wall';
  const isGround = (c: string): boolean => c !== ' ' && !isWall(c);
  const regionAt = (tx: number, tz: number): RegionDef | undefined =>
    def.regions.find((r) => tx >= r.bounds[0] && tz >= r.bounds[1] && tx <= r.bounds[2] && tz <= r.bounds[3]);

  const group = new THREE.Group();
  const collision = new CollisionGrid(width, height, S);
  const props: Prop[] = [];
  const interactables: Interactable[] = [];
  const powers = new Map<string, { value: number; target: number }>();
  const trackFlag = (flag: string): void => {
    if (!powers.has(flag)) powers.set(flag, { value: 0, target: 0 });
  };

  // --- gather tiles
  const walls: [number, number][] = [];
  const floors: [number, number][] = [];
  let spawnTile: [number, number] = [1, 1];
  for (let tz = 0; tz < height; tz++) {
    for (let tx = 0; tx < width; tx++) {
      const c = charAt(tx, tz);
      if (c === '@') spawnTile = [tx, tz];
      if (isWall(c)) {
        walls.push([tx, tz]);
        collision.setSolid(tx, tz);
      } else if (isGround(c)) {
        floors.push([tx, tz]);
      }
    }
  }

  // --- static architecture (instanced)
  const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.4, metalness: 0.15 });
  const wallMaterial = new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.8, metalness: 0.05 });
  const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x141c34, roughness: 0.9 });

  const floorGeo = new THREE.PlaneGeometry(S, S).rotateX(-Math.PI / 2);
  const floorMesh = new THREE.InstancedMesh(floorGeo, floorMaterial, floors.length);
  const ceilingMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(S, S).rotateX(Math.PI / 2),
    ceilingMaterial,
    floors.length,
  );
  const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(S, WALL_HEIGHT, S), wallMaterial, walls.length);
  const matrix = new THREE.Matrix4();
  floors.forEach(([tx, tz], i) => {
    floorMesh.setMatrixAt(i, matrix.makeTranslation((tx + 0.5) * S, 0, (tz + 0.5) * S));
    ceilingMesh.setMatrixAt(i, matrix.makeTranslation((tx + 0.5) * S, WALL_HEIGHT, (tz + 0.5) * S));
  });
  walls.forEach(([tx, tz], i) => {
    wallMesh.setMatrixAt(i, matrix.makeTranslation((tx + 0.5) * S, WALL_HEIGHT / 2, (tz + 0.5) * S));
  });
  group.add(floorMesh, ceilingMesh, wallMesh);

  // --- neon trims and ceiling strips; each belongs to a region and may be power-gated
  const trimMaterials = new Map<string, THREE.MeshBasicMaterial>();
  const trimMaterial = (flag: string | undefined): THREE.MeshBasicMaterial => {
    const key = flag ?? '';
    let material = trimMaterials.get(key);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color: flag ? 0x331018 : COLORS.cyan });
      trimMaterials.set(key, material);
      if (flag) trackFlag(flag);
    }
    return material;
  };
  const instanced = new Map<string, { geo: THREE.BufferGeometry; flag?: string; matrices: THREE.Matrix4[] }>();
  const addInstance = (kind: string, geo: () => THREE.BufferGeometry, flag: string | undefined, m: THREE.Matrix4): void => {
    const key = `${kind}|${flag ?? ''}`;
    const entry = instanced.get(key) ?? { geo: geo(), flag, matrices: [] };
    entry.matrices.push(m);
    instanced.set(key, entry);
  };
  const alongX = (): THREE.BufferGeometry => new THREE.BoxGeometry(S, 0.08, 0.06);
  const alongZ = (): THREE.BufferGeometry => new THREE.BoxGeometry(0.06, 0.08, S);
  for (const [tx, tz] of walls) {
    for (const d of DIRS) {
      if (!isGround(charAt(tx + d.dx, tz + d.dz))) continue;
      const flag = regionAt(tx + d.dx, tz + d.dz)?.poweredByFlag;
      const x = (tx + 0.5 + d.dx * 0.5) * S - d.dx * 0.04;
      const z = (tz + 0.5 + d.dz * 0.5) * S - d.dz * 0.04;
      for (const y of [0.1, WALL_HEIGHT - 0.14]) {
        addInstance(d.dx === 0 ? 'x' : 'z', d.dx === 0 ? alongX : alongZ, flag, new THREE.Matrix4().makeTranslation(x, y, z));
      }
    }
  }
  for (const [tx, tz] of floors) {
    if ((tx + tz) % 2 !== 0) continue;
    const flag = regionAt(tx, tz)?.poweredByFlag;
    addInstance('strip', () => new THREE.BoxGeometry(S * 0.5, 0.03, 0.16), flag, new THREE.Matrix4().makeTranslation((tx + 0.5) * S, WALL_HEIGHT - 0.03, (tz + 0.5) * S));
  }
  for (const { geo, flag, matrices } of instanced.values()) {
    const mesh = new THREE.InstancedMesh(geo, trimMaterial(flag), matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    group.add(mesh);
  }

  // --- props from the layout
  const addProp = (prop: Prop, tx: number, tz: number, solid = true): void => {
    group.add(prop.object);
    props.push(prop);
    if (prop.interactable) interactables.push(prop.interactable);
    if (prop.solid) collision.setDynamic(tx, tz, prop.solid);
    else if (solid) collision.setSolid(tx, tz);
  };
  const frontFacing = (tx: number, tz: number): Facing =>
    DIRS.find((d) => isGround(charAt(tx + d.dx, tz + d.dz)))?.facing ?? 's';
  let rackIndex = 0;
  for (let tz = 0; tz < height; tz++) {
    for (let tx = 0; tx < width; tx++) {
      const c = charAt(tx, tz);
      const at = center(tx, tz);
      const tile = def.tiles[c];
      const object = def.objects[c];
      const region = regionAt(tx, tz);
      if (tile?.kind === 'rack') {
        addProp(createRack(at, frontFacing(tx, tz), region?.poweredByFlag, rackIndex++), tx, tz);
      } else if (tile?.kind === 'crate') {
        addProp(createCrate(at), tx, tz);
      } else if (object?.kind === 'door') {
        const axis = isGround(charAt(tx - 1, tz)) || isGround(charAt(tx + 1, tz)) ? 'x' : 'z';
        addProp(createDoor(object, axis, at, S, actions), tx, tz);
      } else if (object?.kind === 'terminal') {
        addProp(createTerminal(object, at, S, actions), tx, tz);
      } else if (object?.kind === 'npc') {
        addProp(createNpc(object, at, actions), tx, tz);
      } else if (object?.kind === 'holo') {
        addProp(createHolo(object, at, region?.poweredByFlag), tx, tz);
      }
    }
  }
  for (const region of def.regions) if (region.poweredByFlag) trackFlag(region.poweredByFlag);

  // --- data lines: animated dashes flowing along the floor
  const dash = dashTexture();
  const dataLines = def.dataLines.flatMap((line) => {
    if (line.flag) trackFlag(line.flag);
    const material = new THREE.MeshBasicMaterial({ map: dash.clone(), color: line.color, transparent: true, depthWrite: false });
    material.map!.needsUpdate = true;
    let firstLength = 0;
    for (let i = 0; i < line.points.length - 1; i++) {
      const [ax, az] = line.points[i] as [number, number];
      const [bx, bz] = line.points[i + 1] as [number, number];
      const a = center(ax, az);
      const b = center(bx, bz);
      const length = a.distanceTo(b);
      if (i === 0) firstLength = length;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, 0.16).rotateX(-Math.PI / 2), material);
      mesh.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
      mesh.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
      group.add(mesh);
    }
    material.map!.repeat.set(Math.max(1, Math.round(firstLength / 1.2)), 1);
    return [{ line, material }];
  });

  // --- lights (few, region-sized) with flag-driven mood changes
  const lights = def.lights.map((l: LightDef) => {
    if (l.flag) trackFlag(l.flag);
    const light = new THREE.PointLight(l.color, l.intensity, l.distance, 2);
    const p = center(l.at[0], l.at[1], 2.8);
    light.position.copy(p);
    group.add(light);
    return { def: l, light };
  });

  const powerOf = (flag: string | undefined): number => (flag ? (powers.get(flag)?.value ?? 0) : 1);

  const applyPower = (): void => {
    for (const [flag, material] of trimMaterials) {
      if (flag) material.color.setHex(0x331018).lerp(_tmpColor.setHex(COLORS.cyan), powerOf(flag));
    }
    for (const { def: l, light } of lights) {
      const p = powerOf(l.flag);
      light.color.setHex(l.color).lerp(_tmpColor.setHex(l.colorOn ?? l.color), p);
      light.intensity = lerp(l.intensity, l.intensityOn ?? l.intensity, p);
    }
    for (const { line, material } of dataLines) {
      material.color.setHex(line.color).lerp(_tmpColor.setHex(line.colorOn ?? line.color), powerOf(line.flag));
    }
  };

  const zone: Zone = {
    def,
    group,
    collision,
    interactables,
    spawn: center(spawnTile[0], spawnTile[1]),
    spawnYaw: cameraYaw(def.spawnFacing),
    update(dt, time, player) {
      for (const power of powers.values()) power.value = approach(power.value, power.target, dt * POWER_SPEED);
      applyPower();
      for (const { material } of dataLines) {
        if (material.map) material.map.offset.x = -(time * 0.6) % 1;
      }
      animateRacks(time);
      for (const prop of props) prop.update?.(dt, time, player);
    },
    syncFlags(flags, instant) {
      for (const [flag, power] of powers) {
        power.target = flags.has(flag) ? 1 : 0;
        if (instant) power.value = power.target;
      }
      for (const prop of props) prop.sync?.(flags, instant);
      applyPower();
    },
    dispose() {
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        [material ?? []].flat().forEach((m) => m.dispose());
      });
    },
  };
  return zone;
}
