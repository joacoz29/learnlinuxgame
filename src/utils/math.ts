export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Frame-rate independent smoothing toward a target. */
export const damp = (current: number, target: number, rate: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-rate * dt));
export const approach = (current: number, target: number, maxStep: number): number =>
  current < target ? Math.min(target, current + maxStep) : Math.max(target, current - maxStep);
