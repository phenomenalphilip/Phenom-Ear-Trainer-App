
import { InstrumentType } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.5; // Slightly boosted master
    
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  private getFrequency(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  async playNote(midi: number, duration = 0.5, type: InstrumentType = InstrumentType.PIANO) {
    if (!this.ctx || !this.masterGain) await this.init();
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const freq = this.getFrequency(midi);

    const noteGain = ctx.createGain();
    noteGain.connect(this.masterGain!);

    if (type === InstrumentType.PIANO) {
      const oscSine = ctx.createOscillator();
      oscSine.type = 'sine';
      oscSine.frequency.value = freq;

      const oscTri = ctx.createOscillator();
      oscTri.type = 'triangle';
      oscTri.frequency.value = freq;

      const oscSaw = ctx.createOscillator();
      oscSaw.type = 'sawtooth';
      oscSaw.frequency.value = freq;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0;
      filter.frequency.setValueAtTime(freq * 4, t);
      filter.frequency.exponentialRampToValueAtTime(freq, t + 0.2);

      const gainSine = ctx.createGain(); gainSine.gain.value = 0.6;
      const gainTri = ctx.createGain(); gainTri.gain.value = 0.3;
      const gainSaw = ctx.createGain(); gainSaw.gain.value = 0.15;

      oscSine.connect(gainSine);
      oscTri.connect(gainTri);
      oscSaw.connect(filter);
      filter.connect(gainSaw);

      gainSine.connect(noteGain);
      gainTri.connect(noteGain);
      gainSaw.connect(noteGain);

      noteGain.gain.setValueAtTime(0, t);
      noteGain.gain.linearRampToValueAtTime(0.8, t + 0.015);
      noteGain.gain.exponentialRampToValueAtTime(0.01, t + duration + 0.5); 

      oscSine.start(t);
      oscTri.start(t);
      oscSaw.start(t);

      const stopTime = t + duration + 1.0;
      oscSine.stop(stopTime);
      oscTri.stop(stopTime);
      oscSaw.stop(stopTime);

      setTimeout(() => {
        try { noteGain.disconnect(); } catch(e) {}
      }, (duration + 1.1) * 1000);

    } else if (type === InstrumentType.RHODES) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      osc.connect(noteGain);
      
      noteGain.gain.setValueAtTime(0, t);
      // Rhodes is used for Cadence/Root - Needs to be very clear
      noteGain.gain.linearRampToValueAtTime(0.9, t + 0.03); 
      noteGain.gain.exponentialRampToValueAtTime(0.01, t + duration + 0.4);
      
      osc.start(t);
      osc.stop(t + duration + 0.5);
      
      setTimeout(() => {
          try { noteGain.disconnect(); } catch(e) {}
      }, (duration + 0.6) * 1000);

    } else {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      
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
    await this.init(); // Ensure context is ready
    await this.playNote(rootMidi, 1.2, InstrumentType.RHODES);
    await new Promise(r => setTimeout(r, 800));
  }

  async playMelody(notes: number[], bpm: number = 100) {
    const noteDuration = 60 / bpm;
    for (const note of notes) {
      this.playNote(note, noteDuration);
      await new Promise(r => setTimeout(r, noteDuration * 1000));
    }
  }

  async playFailSound() {
    if (!this.ctx || !this.masterGain) await this.init();
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    
    // Create a dissonant cluster for a "fail" sound
    const freqs = [146.83, 110.00]; // D3, A2 roughly
    
    freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = i === 0 ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.linearRampToValueAtTime(f * 0.8, t + 0.3); // Slight pitch drop
        
        const gain = ctx.createGain();
        gain.connect(this.masterGain!);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        
        osc.start(t);
        osc.stop(t + 0.45);
        
        setTimeout(() => {
           try { gain.disconnect(); } catch(e){}
        }, 500);
    });
  }
}

export const audioEngine = new AudioEngine();
