/** Synthesized placeholder sounds. Swap a recipe for a sample later without touching callers. */
export interface Tone {
  /** start and end frequency in Hz */
  freq: [number, number];
  duration: number;
  type?: OscillatorType;
  gain?: number;
  /** seconds after the sound starts */
  at?: number;
}

export const SOUNDS: Record<string, Tone[]> = {
  command: [{ freq: [660, 880], duration: 0.07, type: 'square', gain: 0.05 }],
  error: [
    { freq: [220, 150], duration: 0.18, type: 'sawtooth', gain: 0.08 },
    { freq: [165, 110], duration: 0.22, type: 'sawtooth', gain: 0.07, at: 0.1 },
  ],
  interact: [{ freq: [440, 660], duration: 0.09, type: 'triangle', gain: 0.12 }],
  objective: [
    { freq: [523, 523], duration: 0.1, type: 'triangle', gain: 0.12 },
    { freq: [784, 784], duration: 0.16, type: 'triangle', gain: 0.12, at: 0.09 },
  ],
  codex: [
    { freq: [1046, 1046], duration: 0.12, type: 'sine', gain: 0.1 },
    { freq: [1568, 1568], duration: 0.2, type: 'sine', gain: 0.08, at: 0.1 },
  ],
  'quest-complete': [
    { freq: [523, 523], duration: 0.16, type: 'triangle', gain: 0.14 },
    { freq: [659, 659], duration: 0.16, type: 'triangle', gain: 0.14, at: 0.14 },
    { freq: [784, 784], duration: 0.16, type: 'triangle', gain: 0.14, at: 0.28 },
    { freq: [1046, 1046], duration: 0.5, type: 'triangle', gain: 0.16, at: 0.42 },
  ],
  'door-unlocked': [
    { freq: [90, 60], duration: 0.45, type: 'sawtooth', gain: 0.14 },
    { freq: [180, 720], duration: 0.8, type: 'sine', gain: 0.07, at: 0.05 },
    { freq: [60, 40], duration: 0.3, type: 'square', gain: 0.1, at: 0.55 },
  ],
  'area-discovered': [
    { freq: [392, 392], duration: 0.25, type: 'sine', gain: 0.1 },
    { freq: [587, 587], duration: 0.4, type: 'sine', gain: 0.1, at: 0.18 },
  ],
  'level-up': [
    { freq: [392, 392], duration: 0.12, type: 'square', gain: 0.07 },
    { freq: [523, 523], duration: 0.12, type: 'square', gain: 0.07, at: 0.12 },
    { freq: [659, 659], duration: 0.12, type: 'square', gain: 0.07, at: 0.24 },
    { freq: [784, 1046], duration: 0.5, type: 'square', gain: 0.08, at: 0.36 },
  ],
};
