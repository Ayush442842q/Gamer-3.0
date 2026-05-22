/**
 * Candy Crush Saga - Sound Effects Synthesizer using Web Audio API
 * Generates retro arcade audio dynamically without requiring external audio assets.
 */

class CandyAudioController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  // Initialize AudioContext on first user interaction
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    // Resume context if suspended (common browser autoplay policy)
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  enable(status) {
    this.enabled = status;
    if (status) {
      this.init();
    }
  }

  // Helper to create oscillator, gain, filter nodes
  createSynthChain() {
    if (!this.ctx) return null;
    
    // Ensure context is active
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    return { osc, gain, filter, ctx: this.ctx };
  }

  // Play swap sound (short slide/swoosh)
  playSwap() {
    if (!this.enabled) return;
    this.init();
    const synth = this.createSynthChain();
    if (!synth) return;

    const { osc, gain, ctx } = synth;
    const now = ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Play match sound (happy arpeggio)
  playMatch(comboCount = 0) {
    if (!this.enabled) return;
    this.init();
    const synth = this.createSynthChain();
    if (!synth) return;

    const { osc, gain, ctx } = synth;
    const now = ctx.currentTime;

    // Shift pitch up based on cascading combo count
    const baseFreq = 261.63 * Math.pow(1.2, Math.min(comboCount, 6)); // Middle C, scaled
    const notes = [1, 1.25, 1.5, 2.0]; // Major chord ratios: root, 3rd, 5th, octave

    osc.type = 'sine';
    gain.gain.setValueAtTime(0.0, now);

    notes.forEach((ratio, index) => {
      const time = now + index * 0.06;
      osc.frequency.setValueAtTime(baseFreq * ratio, time);
      gain.gain.linearRampToValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    });

    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Play explosion sound (bassy, noise-like rumble for special candies)
  playExplosion() {
    if (!this.enabled) return;
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;

    // Create a synthesized noise burst/deep impact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(10, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc.start(now);
    osc.stop(now + 0.4);

    // Add a quick secondary white-noise like burst for treble crunch
    const noiseSynth = this.createSynthChain();
    if (noiseSynth) {
      const nOsc = noiseSynth.osc;
      const nGain = noiseSynth.gain;
      const nFilter = noiseSynth.filter;

      nOsc.type = 'square';
      nOsc.frequency.setValueAtTime(1000, now);
      nOsc.frequency.setValueAtTime(Math.random() * 500 + 100, now + 0.05);
      
      nFilter.type = 'bandpass';
      nFilter.frequency.setValueAtTime(1000, now);

      nGain.gain.setValueAtTime(0.12, now);
      nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      nOsc.start(now);
      nOsc.stop(now + 0.16);
    }
  }

  // Play error sound (low buzz)
  playError() {
    if (!this.enabled) return;
    this.init();
    const synth = this.createSynthChain();
    if (!synth) return;

    const { osc, gain, ctx } = synth;
    const now = ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.setValueAtTime(95, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Play level completed sound (ascending scale, triumphant fanfare)
  playLevelUp() {
    if (!this.enabled) return;
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const tempo = 0.08;
    const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 659.25, 783.99, 1046.50]; // C major scale up to C6

    scale.forEach((freq, index) => {
      const synth = this.createSynthChain();
      if (!synth) return;
      const { osc, gain } = synth;
      const playTime = now + index * tempo;

      osc.type = index >= 8 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, playTime);

      gain.gain.setValueAtTime(0.0, playTime);
      gain.gain.linearRampToValueAtTime(0.12, playTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, playTime + 0.15);

      osc.start(playTime);
      osc.stop(playTime + 0.2);
    });
  }

  // Play game over sound (melancholic slide down)
  playGameOver() {
    if (!this.enabled) return;
    this.init();
    const synth = this.createSynthChain();
    if (!synth) return;

    const { osc, gain, ctx } = synth;
    const now = ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(147, now + 0.25);
    osc.frequency.linearRampToValueAtTime(110, now + 0.6);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.start(now);
    osc.stop(now + 0.75);
  }
}

// Global instance
const GameAudio = new CandyAudioController();
