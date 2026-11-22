import type { AlarmTone } from '../types';

/**
 * Dual-layer Alarm Audio Engine (Generated PCM WAV <audio loop> + Web Audio API).
 * - Never hangs on suspended AudioContext.resume() outside user gestures.
 * - Unlocks both <audio> and AudioContext on first user interaction.
 * - Works 100% offline with zero external sound files.
 */

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
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const notes: { freq: number; start: number; dur: number; amp: number }[] =
    tone === 'classic_bell'
      ? [
          { freq: 880, start: 0.0, dur: 0.14, amp: 0.65 },
          { freq: 880, start: 0.18, dur: 0.14, amp: 0.65 },
          { freq: 880, start: 0.36, dur: 0.14, amp: 0.65 },
          { freq: 880, start: 0.72, dur: 0.14, amp: 0.65 },
          { freq: 880, start: 0.9, dur: 0.14, amp: 0.65 },
        ]
      : tone === 'urgent_pulse'
        ? [
            { freq: 987.77, start: 0.0, dur: 0.18, amp: 0.7 },
            { freq: 1318.51, start: 0.22, dur: 0.18, amp: 0.75 },
            { freq: 987.77, start: 0.44, dur: 0.18, amp: 0.7 },
            { freq: 1318.51, start: 0.66, dur: 0.28, amp: 0.75 },
          ]
        : tone === 'gentle_dawn'
          ? [
              { freq: 392.0, start: 0.0, dur: 0.45, amp: 0.55 },
              { freq: 493.88, start: 0.25, dur: 0.45, amp: 0.55 },
              { freq: 587.33, start: 0.5, dur: 0.65, amp: 0.6 },
            ]
          : [
              // temple_chime
              { freq: 523.25, start: 0.0, dur: 0.55, amp: 0.65 },
              { freq: 783.99, start: 0.16, dur: 0.55, amp: 0.6 },
              { freq: 1046.5, start: 0.34, dur: 0.75, amp: 0.65 },
            ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    for (const n of notes) {
      if (t >= n.start && t <= n.start + n.dur) {
        const localT = t - n.start;
        const attack = Math.min(1, localT / 0.015);
        const decay = Math.exp(-3.2 * (localT / n.dur));
        const wave =
          tone === 'classic_bell' || tone === 'urgent_pulse'
            ? Math.sin(2 * Math.PI * n.freq * localT) + 0.3 * Math.sin(6 * Math.PI * n.freq * localT)
            : Math.sin(2 * Math.PI * n.freq * localT);
        sample += wave * n.amp * attack * decay;
      }
    }
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, Math.floor(clamped * 32767), true);
  }

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

class AlarmAudioEngine {
  private ctx: AudioContext | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private wavUrls: Partial<Record<AlarmTone, string>> = {};
  private loopTimer: number | null = null;
  private vibrateTimer: number | null = null;
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

  /** Call from any user gesture (click/tap) to unlock both Web Audio & <audio>. */
  async unlock(): Promise<boolean> {
    let unlocked = false;

    // 1. Unlock Web Audio Context
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

    // 2. Unlock HTMLAudioElement with a silent play/pause
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
    const freqs =
      tone === 'classic_bell'
        ? [880, 880, 880]
        : tone === 'urgent_pulse'
          ? [987.77, 1318.51, 987.77]
          : tone === 'gentle_dawn'
            ? [392, 493.88, 587.33]
            : [523.25, 783.99, 1046.5];

    freqs.forEach((freq, idx) => {
      const start = now + idx * 0.2;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone === 'classic_bell' ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.45 * vol, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  }

  /** Preview a tone once (non-looping). */
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

  /** Play a short, pleasant 2-note chime when a dose is marked Taken. */
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

  /**
   * Start persistent looping alarm + optional vibration until stop() is called.
   * Non-blocking: starts immediately without awaiting suspended AudioContext.
   */
  startLoop(tone: AlarmTone, volume = 0.9, vibrate = true): void {
    this.stop();
    this.isPlaying = true;
    const vol = Math.max(0.1, Math.min(1, volume));

    // Primary: real looping WAV <audio> element (most reliable on mobile & desktop)
    try {
      const el = this.getAudioElement();
      el.loop = true;
      el.muted = false;
      el.volume = vol;
      el.src = this.getWavUrl(tone);
      el.currentTime = 0;
      void el.play().catch(() => {
        // Fallback to Web Audio loop if <audio>.play() was blocked
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
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }
}

export const alarmAudio = new AlarmAudioEngine();
