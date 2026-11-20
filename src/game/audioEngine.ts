/**
 * 100% procedural Web Audio synthesizer for vehicle engine RPM, tire drift screech,
 * collision impact thuds, and tactile UI feedback. Zero external audio files.
 */
export class DrivingAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private skidGain: GainNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;
  private muted = false;
  private started = false;
  private active = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        mute || !this.active ? 0 : 0.34,
        this.ctx.currentTime,
        0.04,
      );
    }
  }

  public setActive(active: boolean): void {
    this.active = active;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.muted || !active ? 0 : 0.34,
        this.ctx.currentTime,
        0.06,
      );
    }
  }

  public initFromGesture(): void {
    if (this.started) {
      if (this.ctx?.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      this.masterGain = master;

      // Engine harmonic synth (warm twin-oscillator GT inline-6 hum)
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 260;
      engineFilter.Q.value = 2.2;

      const engineGain = ctx.createGain();
      engineGain.gain.value = 0.24;

      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 54;

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 108;

      osc1.connect(engineFilter);
      osc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);

      osc1.start();
      osc2.start();

      this.engineOsc1 = osc1;
      this.engineOsc2 = osc2;
      this.engineFilter = engineFilter;
      this.engineGain = engineGain;

      // Tire drift screech noise loop (bandpass-filtered noise)
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;
      noiseSrc.loop = true;

      const skidFilter = ctx.createBiquadFilter();
      skidFilter.type = 'bandpass';
      skidFilter.frequency.value = 1480;
      skidFilter.Q.value = 4.5;

      const skidGain = ctx.createGain();
      skidGain.gain.value = 0;

      noiseSrc.connect(skidFilter);
      skidFilter.connect(skidGain);
      skidGain.connect(master);
      noiseSrc.start();

      this.skidFilter = skidFilter;
      this.skidGain = skidGain;
      this.started = true;

      if (this.active && !this.muted) {
        master.gain.setTargetAtTime(0.34, ctx.currentTime, 0.08);
      }
    } catch {
      // Headless browsers without audio hardware gracefully no-op
    }
  }

  public update(rpmRatio: number, speedKmh: number, throttle: boolean, isDrifting: boolean): void {
    if (!this.started || !this.ctx || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.engineGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const baseFreq = 48 + rpmRatio * 125 + Math.min(35, speedKmh * 0.22);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.05);

    const cutoff = throttle ? 320 + rpmRatio * 740 : 190 + rpmRatio * 280;
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.06);
    this.engineGain.gain.setTargetAtTime(throttle ? 0.3 : 0.16, now, 0.08);

    if (this.skidGain && this.skidFilter) {
      const targetSkid = isDrifting ? Math.min(0.26, 0.08 + (speedKmh / 140) * 0.18) : 0;
      this.skidGain.gain.setTargetAtTime(targetSkid, now, 0.05);
      this.skidFilter.frequency.setTargetAtTime(1280 + Math.min(600, speedKmh * 3.5), now, 0.08);
    }
  }

  public playImpact(strength: number): void {
    if (!this.started || !this.ctx || !this.masterGain || this.muted || !this.active) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const startFreq = 110 + strength * 55;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.18);

    gain.gain.setValueAtTime(Math.min(0.75, 0.22 + strength * 0.55), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.started = false;
  }
}
