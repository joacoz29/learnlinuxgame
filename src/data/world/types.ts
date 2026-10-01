/** Data model for zones. Pure data: nothing here imports Three.js. */

/** Direction an object faces: n = -z, s = +z, e = +x, w = -x */
export type Facing = 'n' | 's' | 'e' | 'w';

export type TileKind = 'wall' | 'floor' | 'rack' | 'crate';

export interface TileDef {
  kind: TileKind;
}

export interface DoorDef {
  kind: 'door';
  id: string;
  unlockFlag: string;
  /** optional intermediate state (key acquired, door still closed) */
  teaserFlag?: string;
  signs: { locked: string[]; teaser?: string[]; open: string[] };
  deniedMessage: string;
}

export interface TerminalDef {
  kind: 'terminal';
  id: string;
  title: string;
  facing: Facing;
  flag: string;
  screen: { locked: string[]; unlocked: string[] };
}

export interface NpcDef {
  kind: 'npc';
  id: string;
  name: string;
  facing: Facing;
  dialogue: string[];
}

export interface HoloDef {
  kind: 'holo';
  id: string;
  facing: Facing;
  lines: string[];
}

export type ObjectDef = DoorDef | TerminalDef | NpcDef | HoloDef;

export interface RegionDef {
  id: string;
  name: string;
  /** inclusive tile bounds: [minX, minZ, maxX, maxZ] */
  bounds: [number, number, number, number];
  /** while this flag is unset the region looks powered down */
  poweredByFlag?: string;
}

export interface LightDef {
  at: [number, number];
  color: number;
  intensity: number;
  distance: number;
  /** when set, the light eases toward `colorOn` / `intensityOn` as the flag turns on */
  flag?: string;
  colorOn?: number;
  intensityOn?: number;
}

export interface DataLineDef {
  /** tile coordinates, connected in order */
  points: [number, number][];
  color: number;
  flag?: string;
  colorOn?: number;
}

export interface ZoneDef {
  id: string;
  name: string;
  tileSize: number;
  spawnFacing: Facing;
  /**
   * One char per tile. ' ' void, '@' player spawn, plus the keys of `tiles` and `objects`.
   * Rows are z, columns are x.
   */
  layout: string[];
  tiles: Record<string, TileDef>;
  objects: Record<string, ObjectDef>;
  regions: RegionDef[];
  lights: LightDef[];
  dataLines: DataLineDef[];
}
