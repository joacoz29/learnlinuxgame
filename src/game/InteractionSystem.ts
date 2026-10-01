import type * as THREE from 'three';
import type { Interactable } from '../world/props';

const MAX_ANGLE_COS = 0.55;
const CLOSE_RANGE = 1.8;

/** Picks the interactable the player is near and facing; fires it on request. */
export class InteractionSystem {
  private targets: Interactable[] = [];
  current: Interactable | null = null;

  setTargets(targets: Interactable[]): void {
    this.targets = targets;
    this.current = null;
  }

  update(position: THREE.Vector3, forward: THREE.Vector2): Interactable | null {
    let best: Interactable | null = null;
    let bestDistance = Infinity;
    for (const target of this.targets) {
      if (target.label() === null) continue;
      const dx = target.position.x - position.x;
      const dz = target.position.z - position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > target.radius) continue;
      const facing = distance < 0.001 ? 1 : (dx * forward.x + dz * forward.y) / distance;
      if (facing < MAX_ANGLE_COS && distance > CLOSE_RANGE) continue;
      if (distance < bestDistance) {
        best = target;
        bestDistance = distance;
      }
    }
    this.current = best;
    return best;
  }

  interact(): boolean {
    if (!this.current) return false;
    this.current.interact();
    return true;
  }
}
