import type { AlarmTone } from '../types';

/**
 * Web Audio API synthesizer for loud, persistent, zero-dependency alarms.
 * Plays distinct melodic/pulse patterns and loops until explicitly stopped.
 */
class AlarmAudioEngine {
  private ctx: AudioContext | null = null;
  private loopTimer: number | null = null;
  private activeNodes: AudioNode[] = [];
  private isPlaying = false;
  private vibrateTimer: number | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /** Must be called from a user gesture so browser autoplay policy unlocks audio. */
  async unlock(): Promise<boolean> {
    try {
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      // Play an inaudible 1ms buffer to permanently unlock iOS/Chrome audio
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
      return ctx.state === 'running';
    } catch {
      return false;
    }
  }

  getState(): AudioContextState | 'uninitialized' {
    return this.ctx ? this.ctx.state : 'uninitialized';
  }

  private playToneBurst(tone: AlarmTone, volume: number): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const vol = Math.max(0.1, Math.min(1, volume));

    const scheduleNote = (
      freq: number,
      startOffset: number,
      duration: number,
      type: OscillatorType,
      peakGain: number
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + startOffset);

      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(peakGain * vol, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
      this.activeNodes.push(osc, gain);
    };

    switch (tone) {
      case 'temple_chime':
        // Resonant harmonic fifth + octave chime
        scheduleNote(523.25, 0.0, 0.55, 'triangle', 0.7);
        scheduleNote(783.99, 0.16, 0.55, 'triangle', 0.65);
        scheduleNote(1046.5, 0.34, 0.75, 'sine', 0.7);
        break;
      case 'classic_bell':
        // Loud double-ring alarm clock
        scheduleNote(880, 0.0, 0.14, 'square', 0.45);
        scheduleNote(880, 0.18, 0.14, 'square', 0.45);
        scheduleNote(880, 0.36, 0.14, 'square', 0.45);
        scheduleNote(880, 0.72, 0.14, 'square', 0.45);
        scheduleNote(880, 0.90, 0.14, 'square', 0.45);
        break;
      case 'urgent_pulse':
        // High-visibility medical alert beep sequence
        scheduleNote(987.77, 0.0, 0.18, 'sawtooth', 0.45);
        scheduleNote(1318.51, 0.22, 0.18, 'sawtooth', 0.5);
        scheduleNote(987.77, 0.44, 0.18, 'sawtooth', 0.45);
        scheduleNote(1318.51, 0.66, 0.28, 'sawtooth', 0.5);
        break;
      case 'gentle_dawn':
        // Warm ascending triad
        scheduleNote(392.0, 0.0, 0.45, 'sine', 0.55);
        scheduleNote(493.88, 0.25, 0.45, 'sine', 0.55);
        scheduleNote(587.33, 0.5, 0.65, 'sine', 0.6);
        break;
    }
  }

  /** Preview a tone once (non-looping). */
  preview(tone: AlarmTone, volume = 0.8): void {
    this.stop();
    this.playToneBurst(tone, volume);
  }

  /** Start persistent looping alarm + optional vibration until stop() is called. */
  startLoop(tone: AlarmTone, volume = 0.9, vibrate = true): void {
    this.stop();
    this.isPlaying = true;

    const trigger = () => {
      if (!this.isPlaying) return;
      this.playToneBurst(tone, volume);
    };

    trigger();
    this.loopTimer = window.setInterval(trigger, 1600);

    if (vibrate && 'vibrate' in navigator) {
      navigator.vibrate([400, 200, 400, 600]);
      this.vibrateTimer = window.setInterval(() => {
        if (this.isPlaying && 'vibrate' in navigator) {
          navigator.vibrate([400, 200, 400, 600]);
        }
      }, 1700);
    }
  }

  stop(): void {
    this.isPlaying = false;
    if (this.loopTimer !== null) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.vibrateTimer !== null) {
      clearInterval(this.vibrateTimer);
      this.vibrateTimer = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
    for (const node of this.activeNodes) {
      try {
        node.disconnect();
      } catch {
        // Ignore already-stopped nodes
      }
    }
    this.activeNodes = [];
  }
}

export const alarmAudio = new AlarmAudioEngine();
