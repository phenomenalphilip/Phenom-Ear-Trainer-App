
import { InstrumentType } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.4; // Normalized master volume
  }

  private getFrequency(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  async playNote(midi: number, duration = 0.5, type: InstrumentType = InstrumentType.PIANO) {
    if (!this.ctx || !this.masterGain) this.init();
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const freq = this.getFrequency(midi);

    // Create a specific gain for this note to shape its envelope independently
    const noteGain = ctx.createGain();
    noteGain.connect(this.masterGain!);

    if (type === InstrumentType.PIANO) {
      // --- High Quality Piano Synthesis ---
      // A mix of Sine (Fundamental), Triangle (Body), and Filtered Saw (Harmonics/Hammer)

      // 1. Fundamental (Pure Tone)
      const oscSine = ctx.createOscillator();
      oscSine.type = 'sine';
      oscSine.frequency.value = freq;

      // 2. Body (Warmth)
      const oscTri = ctx.createOscillator();
      oscTri.type = 'triangle';
      oscTri.frequency.value = freq;

      // 3. Hammer/Harmonics (Brightness)
      const oscSaw = ctx.createOscillator();
      oscSaw.type = 'sawtooth';
      oscSaw.frequency.value = freq;

      // Filter for the Sawtooth to create the "plucked/struck" damping effect
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0; // No resonance, just damping
      filter.frequency.setValueAtTime(freq * 4, t); // Start bright
      filter.frequency.exponentialRampToValueAtTime(freq, t + 0.2); // Quickly dampen to fundamental

      // Mix Gains
      const gainSine = ctx.createGain(); gainSine.gain.value = 0.6;
      const gainTri = ctx.createGain(); gainTri.gain.value = 0.3;
      const gainSaw = ctx.createGain(); gainSaw.gain.value = 0.15;

      // Connections
      oscSine.connect(gainSine);
      oscTri.connect(gainTri);
      oscSaw.connect(filter);
      filter.connect(gainSaw);

      gainSine.connect(noteGain);
      gainTri.connect(noteGain);
      gainSaw.connect(noteGain);

      // Amplitude Envelope (ADSR approximation)
      noteGain.gain.setValueAtTime(0, t);
      noteGain.gain.linearRampToValueAtTime(0.8, t + 0.015); // Fast, percussive attack
      // Decay to silence over time, allowing a tail beyond the strict duration for realism
      noteGain.gain.exponentialRampToValueAtTime(0.01, t + duration + 0.5); 

      // Start/Stop
      oscSine.start(t);
      oscTri.start(t);
      oscSaw.start(t);

      const stopTime = t + duration + 1.0;
      oscSine.stop(stopTime);
      oscTri.stop(stopTime);
      oscSaw.stop(stopTime);

      // Garbage collection helper
      setTimeout(() => {
        try { noteGain.disconnect(); } catch(e) {}
      }, (duration + 1.0) * 1000);

    } else if (type === InstrumentType.RHODES) {
      // Rhodes-ish sound (Sine with softer attack and longer sustain)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      osc.connect(noteGain);
      
      noteGain.gain.setValueAtTime(0, t);
      noteGain.gain.linearRampToValueAtTime(0.6, t + 0.03); // Softer attack
      noteGain.gain.exponentialRampToValueAtTime(0.01, t + duration + 0.2);
      
      osc.start(t);
      osc.stop(t + duration + 0.5);
      
      setTimeout(() => {
          try { noteGain.disconnect(); } catch(e) {}
      }, (duration + 0.5) * 1000);

    } else {
      // Generic/Guitar fallback
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      
      // Lowpass to remove harsh digital edge
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq * 3;

      osc.connect(filter);
      filter.connect(noteGain);

      noteGain.gain.setValueAtTime(0, t);
      noteGain.gain.linearRampToValueAtTime(0.2, t + 0.01);
      noteGain.gain.exponentialRampToValueAtTime(0.01, t + duration);
      
      osc.start(t);
      osc.stop(t + duration + 0.1);
      
      setTimeout(() => {
          try { noteGain.disconnect(); } catch(e) {}
      }, (duration + 0.2) * 1000);
    }
  }

  async playCadence(rootMidi: number) {
    // Use Rhodes for the cadence to establish tonality warmly
    await this.playNote(rootMidi, 1.5, InstrumentType.RHODES);
    await new Promise(r => setTimeout(r, 1000));
  }

  async playMelody(notes: number[], bpm: number = 100) {
    const noteDuration = 60 / bpm;
    for (const note of notes) {
      // Play note slightly shorter than the interval to allow articulation, 
      // but the tail in playNote will make it sound legato.
      this.playNote(note, noteDuration);
      await new Promise(r => setTimeout(r, noteDuration * 1000));
    }
  }
}

export const audioEngine = new AudioEngine();
