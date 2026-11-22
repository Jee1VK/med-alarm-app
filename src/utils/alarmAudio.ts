import type { AlarmTone } from '../types';

/**
 * Dual-layer Alarm Audio Engine (Generated PCM WAV <audio loop> + Web Audio API).
 * - 10 original, 100% royalty-free mathematically synthesized alarm tones.
 * - Never hangs on suspended AudioContext.resume() outside user gestures.
 * - Works 100% offline with zero external sound files.
 */

interface NoteSpec {
  freq: number;
  endFreq?: number;
  start: number;
  dur: number;
  amp: number;
  bright?: boolean;
}

function getToneNotes(tone: AlarmTone): NoteSpec[] {
  switch (tone) {
    case 'classic_bell':
      return [
        { freq: 880, start: 0.0, dur: 0.14, amp: 0.65, bright: true },
        { freq: 880, start: 0.18, dur: 0.14, amp: 0.65, bright: true },
        { freq: 880, start: 0.36, dur: 0.14, amp: 0.65, bright: true },
        { freq: 880, start: 0.72, dur: 0.14, amp: 0.65, bright: true },
        { freq: 880, start: 0.9, dur: 0.14, amp: 0.65, bright: true },
      ];
    case 'urgent_pulse':
      return [
        { freq: 987.77, start: 0.0, dur: 0.18, amp: 0.7, bright: true },
        { freq: 1318.51, start: 0.22, dur: 0.18, amp: 0.75, bright: true },
        { freq: 987.77, start: 0.44, dur: 0.18, amp: 0.7, bright: true },
        { freq: 1318.51, start: 0.66, dur: 0.28, amp: 0.75, bright: true },
      ];
    case 'gentle_dawn':
      return [
        { freq: 392.0, start: 0.0, dur: 0.45, amp: 0.55 },
        { freq: 493.88, start: 0.25, dur: 0.45, amp: 0.55 },
        { freq: 587.33, start: 0.5, dur: 0.65, amp: 0.6 },
      ];
    case 'morning_birds':
      return [
        { freq: 1450, endFreq: 2150, start: 0.0, dur: 0.14, amp: 0.45 },
        { freq: 1950, endFreq: 1500, start: 0.16, dur: 0.13, amp: 0.4 },
        { freq: 1600, endFreq: 2450, start: 0.42, dur: 0.16, amp: 0.48 },
        { freq: 2300, endFreq: 1800, start: 0.62, dur: 0.14, amp: 0.42 },
        { freq: 1750, endFreq: 2600, start: 0.9, dur: 0.18, amp: 0.48 },
      ];
    case 'marimba_breeze':
      return [
        { freq: 523.25, start: 0.0, dur: 0.22, amp: 0.62 },
        { freq: 659.25, start: 0.16, dur: 0.22, amp: 0.62 },
        { freq: 783.99, start: 0.32, dur: 0.22, amp: 0.62 },
        { freq: 880.0, start: 0.48, dur: 0.26, amp: 0.65 },
        { freq: 1046.5, start: 0.68, dur: 0.36, amp: 0.68 },
      ];
    case 'crystal_harp':
      return [
        { freq: 523.25, start: 0.0, dur: 0.55, amp: 0.48 },
        { freq: 659.25, start: 0.1, dur: 0.55, amp: 0.48 },
        { freq: 783.99, start: 0.2, dur: 0.55, amp: 0.48 },
        { freq: 987.77, start: 0.3, dur: 0.6, amp: 0.48 },
        { freq: 1174.66, start: 0.4, dur: 0.75, amp: 0.52 },
      ];
    case 'digital_radar':
      return [
        { freq: 1046.5, start: 0.0, dur: 0.1, amp: 0.65, bright: true },
        { freq: 1046.5, start: 0.14, dur: 0.1, amp: 0.65, bright: true },
        { freq: 1318.51, start: 0.28, dur: 0.12, amp: 0.7, bright: true },
        { freq: 1046.5, start: 0.75, dur: 0.1, amp: 0.65, bright: true },
        { freq: 1046.5, start: 0.89, dur: 0.1, amp: 0.65, bright: true },
        { freq: 1318.51, start: 1.03, dur: 0.14, amp: 0.7, bright: true },
      ];
    case 'zen_gong':
      return [
        { freq: 261.63, start: 0.0, dur: 1.45, amp: 0.55 },
        { freq: 392.0, start: 0.02, dur: 1.35, amp: 0.35 },
        { freq: 523.25, start: 0.04, dur: 1.2, amp: 0.25 },
      ];
    case 'loud_siren':
      return [
        { freq: 740, endFreq: 1240, start: 0.0, dur: 0.36, amp: 0.78, bright: true },
        { freq: 1240, endFreq: 740, start: 0.38, dur: 0.36, amp: 0.78, bright: true },
        { freq: 740, endFreq: 1240, start: 0.78, dur: 0.36, amp: 0.78, bright: true },
        { freq: 1240, endFreq: 740, start: 1.16, dur: 0.36, amp: 0.78, bright: true },
      ];
    case 'temple_chime':
    default:
      return [
        { freq: 523.25, start: 0.0, dur: 0.55, amp: 0.65 },
        { freq: 783.99, start: 0.16, dur: 0.55, amp: 0.6 },
        { freq: 1046.5, start: 0.34, dur: 0.75, amp: 0.65 },
      ];
  }
}

function createWavBlobUrl(tone: AlarmTone): string {
  const sampleRate = 22050;
  const durationSec = 1.6;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const notes = getToneNotes(tone);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    for (const n of notes) {
      if (t >= n.start && t <= n.start + n.dur) {
        const localT = t - n.start;
        const progress = localT / n.dur;
        const attack = Math.min(1, localT / 0.015);
        const decay = tone === 'loud_siren' ? Math.min(1, (1 - progress) * 8) : Math.exp(-3.0 * progress);
        const endF = n.endFreq ?? n.freq;
        // Continuous phase integral for linear frequency sweep
        const phase = 2 * Math.PI * (n.freq * localT + 0.5 * ((endF - n.freq) / n.dur) * localT * localT);
        const wave = n.bright
          ? Math.sin(phase) + 0.45 * Math.sin(2 * phase) + 0.35 * Math.sin(3 * phase)
          : Math.sin(phase) + 0.3 * Math.sin(2 * phase);
        sample += wave * Math.min(1, n.amp * 1.35) * attack * decay;
      }
    }
    // Soft-clip limiter for maximum perceived loudness without harsh distortion
    const boosted = Math.tanh(sample * 1.45);
    const clamped = Math.max(-0.98, Math.min(0.98, boosted));
    view.setInt16(44 + i * 2, Math.floor(clamped * 32767), true);
  }

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

const MAX_RING_DURATION_MS = 3 * 60 * 1000; // Ring up to 3 minutes or until stopped

class AlarmAudioEngine {
  private ctx: AudioContext | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private wavUrls: Partial<Record<AlarmTone, string>> = {};
  private loopTimer: number | null = null;
  private vibrateTimer: number | null = null;
  private autoStopTimer: number | null = null;
  private isPlaying = false;

  private getWavUrl(tone: AlarmTone): string {
    if (!this.wavUrls[tone]) {
      this.wavUrls[tone] = createWavBlobUrl(tone);
    }
    return this.wavUrls[tone]!;
  }

  private getAudioElement(): HTMLAudioElement {
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.preload = 'auto';
    }
    return this.audioEl;
  }

  private getContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  async unlock(): Promise<boolean> {
    let unlocked = false;

    const ctx = this.getContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.01);
        unlocked = true;
      } catch {
        // Ignore
      }
    }

    try {
      const el = this.getAudioElement();
      if (!el.src) {
        el.src = this.getWavUrl('temple_chime');
      }
      el.muted = true;
      await el.play();
      el.pause();
      el.currentTime = 0;
      el.muted = false;
      unlocked = true;
    } catch {
      // Ignore if autoplay still restricted
    }

    return unlocked;
  }

  private playWebAudioBurst(tone: AlarmTone, volume: number): void {
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    if (ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const vol = Math.max(0.1, Math.min(1, volume));
    for (const n of getToneNotes(tone)) {
      const start = now + n.start;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.bright ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(n.freq, start);
      if (n.endFreq) {
        osc.frequency.linearRampToValueAtTime(n.endFreq, start + n.dur);
      }
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(n.amp * 0.55 * vol, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + n.dur + 0.02);
    }
  }

  preview(tone: AlarmTone, volume = 0.85): void {
    this.stop();
    try {
      const el = this.getAudioElement();
      el.loop = false;
      el.muted = false;
      el.volume = Math.max(0.1, Math.min(1, volume));
      el.src = this.getWavUrl(tone);
      el.currentTime = 0;
      void el.play().catch(() => {
        this.playWebAudioBurst(tone, volume);
      });
    } catch {
      this.playWebAudioBurst(tone, volume);
    }
  }

  playSuccessChime(volume = 0.7): void {
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    try {
      const now = ctx.currentTime;
      const vol = Math.max(0.1, Math.min(1, volume)) * 0.45;
      const notes = [
        { freq: 523.25, offset: 0.0, dur: 0.22 },
        { freq: 783.99, offset: 0.11, dur: 0.35 },
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.offset);
        gain.gain.setValueAtTime(0.001, now + n.offset);
        gain.gain.exponentialRampToValueAtTime(vol, now + n.offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.offset + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.offset);
        osc.stop(now + n.offset + n.dur + 0.02);
      }
    } catch {
      // Ignore
    }
  }

  startLoop(tone: AlarmTone, volume = 1.0, vibrate = true): void {
    this.stop();
    this.isPlaying = true;
    const vol = Math.max(0.2, Math.min(1, volume));

    // Automatically stop after 3 minutes if not dismissed earlier
    this.autoStopTimer = window.setTimeout(() => {
      this.stop();
    }, MAX_RING_DURATION_MS);

    try {
      const el = this.getAudioElement();
      el.loop = true;
      el.muted = false;
      el.volume = vol;
      el.src = this.getWavUrl(tone);
      el.currentTime = 0;
      void el.play().catch(() => {
        if (this.isPlaying) {
          this.playWebAudioBurst(tone, vol);
          this.loopTimer = window.setInterval(() => {
            if (this.isPlaying) this.playWebAudioBurst(tone, vol);
          }, 1600);
        }
      });
    } catch {
      this.playWebAudioBurst(tone, vol);
      this.loopTimer = window.setInterval(() => {
        if (this.isPlaying) this.playWebAudioBurst(tone, vol);
      }, 1600);
    }

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
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      } catch {
        // Ignore
      }
    }
    if (this.loopTimer !== null) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.vibrateTimer !== null) {
      clearInterval(this.vibrateTimer);
      this.vibrateTimer = null;
    }
    if (this.autoStopTimer !== null) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }
}

export const alarmAudio = new AlarmAudioEngine();
