import * as THREE from 'three';
import type { InputManager } from '../core/InputManager';
import type { CollisionGrid } from '../world/collision';
import { clamp, damp } from '../utils/math';

const EYE_HEIGHT = 1.65;
const RADIUS = 0.38;
const WALK_SPEED = 4.2;
const RUN_SPEED = 7.2;
const ACCELERATION = 12;
const MOUSE_SENSITIVITY = 0.0022;
const KEY_TURN_SPEED = 1.9;
const BASE_FOV = 75;
const RUN_FOV = 81;

/** First-person controller: WASD + mouse look, Shift to run, tile collision with wall sliding. */
export class PlayerController {
  readonly position = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  private readonly velocity = new THREE.Vector2();
  private bobPhase = 0;

  constructor(readonly camera: THREE.PerspectiveCamera) {
    camera.rotation.order = 'YXZ';
  }

  teleport(x: number, z: number, yaw: number): void {
    this.position.set(x, 0, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.velocity.set(0, 0);
    this.applyCamera(0);
  }

  /** Unit vector the player is walking toward, on the ground plane. */
  forward(): THREE.Vector2 {
    return new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
  }

  update(dt: number, input: InputManager, collision: CollisionGrid): void {
    const { dx, dy } = input.consumeMouse();
    this.yaw -= dx * MOUSE_SENSITIVITY;
    this.pitch = clamp(this.pitch - dy * MOUSE_SENSITIVITY, -1.45, 1.45);
    this.yaw += (Number(input.isDown('ArrowLeft')) - Number(input.isDown('ArrowRight'))) * KEY_TURN_SPEED * dt;
    this.pitch = clamp(this.pitch + (Number(input.isDown('ArrowUp')) - Number(input.isDown('ArrowDown'))) * KEY_TURN_SPEED * dt, -1.45, 1.45);

    const forwardAxis = Number(input.isDown('KeyW')) - Number(input.isDown('KeyS'));
    const strafeAxis = Number(input.isDown('KeyD')) - Number(input.isDown('KeyA'));
    const running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = running ? RUN_SPEED : WALK_SPEED;

    const f = this.forward();
    const wish = new THREE.Vector2(f.x * forwardAxis - f.y * strafeAxis, f.y * forwardAxis + f.x * strafeAxis);
    if (wish.lengthSq() > 1) wish.normalize();
    this.velocity.x = damp(this.velocity.x, wish.x * speed, ACCELERATION, dt);
    this.velocity.y = damp(this.velocity.y, wish.y * speed, ACCELERATION, dt);

    this.moveWithCollision(this.velocity.x * dt, this.velocity.y * dt, collision);
    const moving = this.velocity.length();
    this.bobPhase += moving * dt * 1.7;
    this.applyCamera(moving / RUN_SPEED, running && moving > 1);
  }

  private moveWithCollision(dx: number, dz: number, collision: CollisionGrid): void {
    const { x, z } = this.position;
    if (!collision.blocksCircle(x + dx, z, RADIUS)) this.position.x += dx;
    if (!collision.blocksCircle(this.position.x, z + dz, RADIUS)) this.position.z += dz;
  }

  private applyCamera(movement: number, running = false): void {
    const bob = Math.sin(this.bobPhase) * 0.045 * clamp(movement * 1.6, 0, 1);
    this.camera.position.set(this.position.x, EYE_HEIGHT + bob, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    const fov = damp(this.camera.fov, running ? RUN_FOV : BASE_FOV, 6, 1 / 60);
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
