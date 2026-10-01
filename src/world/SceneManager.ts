import * as THREE from 'three';
import type { ZoneDef } from '../data/world/types';
import { COLORS } from './materials';
import type { ZoneActions } from './props';
import { buildZone, type Zone } from './ZoneBuilder';

/** Owns the Three.js scene, global lighting/fog and the currently loaded zone. */
export class SceneManager {
  readonly scene = new THREE.Scene();
  zone: Zone | null = null;

  constructor() {
    this.scene.background = new THREE.Color(COLORS.void);
    this.scene.fog = new THREE.FogExp2(COLORS.void, 0.02);
    this.scene.add(new THREE.HemisphereLight(0x9bb2ff, 0x2a1d52, 2.4));
  }

  loadZone(def: ZoneDef, actions: ZoneActions, flags: ReadonlySet<string>): Zone {
    this.unloadZone();
    const zone = buildZone(def, actions);
    zone.syncFlags(flags, true);
    this.scene.add(zone.group);
    this.zone = zone;
    return zone;
  }

  unloadZone(): void {
    if (!this.zone) return;
    this.scene.remove(this.zone.group);
    this.zone.dispose();
    this.zone = null;
  }

  update(dt: number, time: number, player: THREE.Vector3): void {
    this.zone?.update(dt, time, player);
  }
}
