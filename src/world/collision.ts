/** Tile-based collision: solid tiles are fixed, dynamic ones (doors) are queried each time. */
export class CollisionGrid {
  private readonly solid: Uint8Array;
  private readonly dynamic = new Map<number, () => boolean>();

  constructor(
    readonly width: number,
    readonly height: number,
    readonly tileSize: number,
  ) {
    this.solid = new Uint8Array(width * height);
  }

  private index(tx: number, tz: number): number {
    return tz * this.width + tx;
  }

  setSolid(tx: number, tz: number): void {
    this.solid[this.index(tx, tz)] = 1;
  }

  setDynamic(tx: number, tz: number, isSolid: () => boolean): void {
    this.dynamic.set(this.index(tx, tz), isSolid);
  }

  isSolid(tx: number, tz: number): boolean {
    if (tx < 0 || tz < 0 || tx >= this.width || tz >= this.height) return true;
    const i = this.index(tx, tz);
    return this.solid[i] === 1 || (this.dynamic.get(i)?.() ?? false);
  }

  /** True when a circle (world units) overlaps any solid tile. */
  blocksCircle(x: number, z: number, radius: number): boolean {
    const s = this.tileSize;
    const minX = Math.floor((x - radius) / s);
    const maxX = Math.floor((x + radius) / s);
    const minZ = Math.floor((z - radius) / s);
    const maxZ = Math.floor((z + radius) / s);
    for (let tz = minZ; tz <= maxZ; tz++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (!this.isSolid(tx, tz)) continue;
        const nearestX = Math.max(tx * s, Math.min(x, (tx + 1) * s));
        const nearestZ = Math.max(tz * s, Math.min(z, (tz + 1) * s));
        if ((x - nearestX) ** 2 + (z - nearestZ) ** 2 < radius * radius) return true;
      }
    }
    return false;
  }
}
