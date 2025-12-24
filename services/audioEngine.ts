
import { InstrumentType } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.3;
  }

  private getFrequency(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  async playNote(midi: number, duration = 0.5, type: InstrumentType = InstrumentType.PIANO) {
    if (!this.ctx || !this.masterGain) this.init();
    const ctx = this.ctx!;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Simplistic instrument modeling
    if (type === InstrumentType.PIANO) {
      osc.type = 'triangle';
    } else if (type === InstrumentType.RHODES) {
      osc.type = 'sine';
    } else {
      osc.type = 'square';
    }
    
    osc.frequency.setValueAtTime(this.getFrequency(midi), ctx.currentTime);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.masterGain!);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  async playCadence(rootMidi: number) {
    // Just the root note as a reference anchor
    // Playing it slightly longer and lower volume to establish key center
    await this.playNote(rootMidi, 1.5, InstrumentType.RHODES);
    await new Promise(r => setTimeout(r, 1000));
  }

  async playMelody(notes: number[], bpm: number = 100) {
    const noteDuration = 60 / bpm;
    for (const note of notes) {
      this.playNote(note, noteDuration * 0.9);
      await new Promise(r => setTimeout(r, noteDuration * 1000));
    }
  }
}

export const audioEngine = new AudioEngine();
