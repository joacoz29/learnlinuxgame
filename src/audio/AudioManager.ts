import { SOUNDS } from './sounds';

/** Thin Web Audio wrapper. Browsers require a user gesture, so `unlock()` is called from the first click. */
export class AudioManager {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.8;
  }

  play(id: string, delayMs = 0): void {
    const recipe = SOUNDS[id];
    const { ctx, master } = this;
    if (!recipe || !ctx || !master || this.muted) return;
    const start = ctx.currentTime + delayMs / 1000;
    for (const tone of recipe) {
      const t0 = start + (tone.at ?? 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone.type ?? 'sine';
      osc.frequency.setValueAtTime(tone.freq[0], t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, tone.freq[1]), t0 + tone.duration);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(tone.gain ?? 0.1, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.duration);
      osc.connect(gain).connect(master);
      osc.start(t0);
      osc.stop(t0 + tone.duration + 0.05);
    }
  }
}
