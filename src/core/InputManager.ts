const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight']);

/** Keyboard + mouse state. Gameplay reads it only while `enabled`; UI panels own the keyboard otherwise. */
export class InputManager {
  enabled = false;
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onLockChange: (locked: boolean) => void,
  ) {
    window.addEventListener('keydown', (e) => {
      if (isTypingTarget(e.target)) return;
      if (this.enabled && GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    window.addEventListener('mousemove', (e) => {
      if (!this.isLocked()) return;
      this.mouseX += e.movementX;
      this.mouseY += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      if (!this.isLocked()) this.down.clear();
      this.onLockChange(this.isLocked());
    });
  }

  isLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  requestLock(): void {
    // Rejected when the browser's post-Escape cooldown is active; the pause overlay lets the user click again.
    void Promise.resolve(this.canvas.requestPointerLock()).catch(() => undefined);
  }

  releaseLock(): void {
    if (this.isLocked()) document.exitPointerLock();
  }

  isDown(code: string): boolean {
    return this.enabled && this.down.has(code);
  }

  /** True once per key press (for the frame in which it happened). */
  wasPressed(code: string): boolean {
    return this.enabled && this.pressed.has(code);
  }

  consumeMouse(): { dx: number; dy: number } {
    const delta = { dx: this.mouseX, dy: this.mouseY };
    this.mouseX = 0;
    this.mouseY = 0;
    return this.enabled ? delta : { dx: 0, dy: 0 };
  }

  endFrame(): void {
    this.pressed.clear();
  }
}

export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}
