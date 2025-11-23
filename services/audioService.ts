
// Simple synthesizer for game sounds
class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private nextNoteTime: number = 0;
  private timerID: number | null = null;
  private isPlaying: boolean = false;
  private tempo: number = 145; // High tempo for combat
  private lookahead: number = 25.0;
  private scheduleAheadTime: number = 0.1;
  private beatCount: number = 0;

  initialize() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- Sound Effects (One-shots) ---

  playShoot(isPlayer: boolean, type: 'normal' | 'laser' | 'cannon' = 'normal') {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    if (type === 'laser') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    } else if (type === 'cannon') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    } else {
        osc.type = isPlayer ? 'triangle' : 'sawtooth';
        osc.frequency.setValueAtTime(isPlayer ? 600 : 300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    }
    
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + (type === 'cannon' ? 0.3 : 0.1));
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + (type === 'cannon' ? 0.3 : 0.1));
  }

  playMissile() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(200, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playJump() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(500, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playExplosion() {
    if (!this.ctx || !this.masterGain) return;
    // White noise buffer
    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    
    // Filter for boom
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start();
  }

  playHit() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playPowerUp() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(880, this.ctx.currentTime + 0.1);
    osc.frequency.linearRampToValueAtTime(1320, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  // --- Music Sequencer ---

  private playNote(time: number, freq: number, duration: number, type: OscillatorType = 'sawtooth', vol: number = 0.1) {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

      // Simple filter envelope
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, time);
      filter.frequency.linearRampToValueAtTime(2000, time + 0.05);
      filter.frequency.exponentialRampToValueAtTime(500, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + duration);
  }

  private playDrum(time: number, type: 'kick' | 'hat') {
      if (!this.ctx || !this.masterGain) return;
      if (type === 'kick') {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.frequency.setValueAtTime(150, time);
          osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
          gain.gain.setValueAtTime(0.7, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(time);
          osc.stop(time + 0.5);
      } else {
          // Hi-hat noise
          const bufferSize = this.ctx.sampleRate * 0.05;
          const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
             data[i] = (Math.random() * 2 - 1) * 0.5;
          }
          const noise = this.ctx.createBufferSource();
          noise.buffer = buffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = 5000;
          const gain = this.ctx.createGain();
          gain.gain.value = 0.1;
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterGain);
          noise.start(time);
      }
  }

  private scheduler() {
      if (!this.ctx) return;
      while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
          this.scheduleNote(this.beatCount, this.nextNoteTime);
          this.nextStep();
      }
      if (this.isPlaying) {
          this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
      }
  }

  private nextStep() {
      const secondsPerBeat = 60.0 / this.tempo;
      this.nextNoteTime += 0.25 * secondsPerBeat; // 16th notes
      this.beatCount++;
  }

  private scheduleNote(beatNumber: number, time: number) {
      // 16 steps per bar
      const step = beatNumber % 16;
      
      // Kick: 0, 4, 8, 12 (Four on the floor)
      if (step % 4 === 0) {
          this.playDrum(time, 'kick');
      }

      // Hi-hats: Off beats
      if (step % 2 !== 0) {
          this.playDrum(time, 'hat');
      }

      // Bass: Driving 16th note octave bounce
      const root = 55; // A1
      if (step % 2 === 0) {
          this.playNote(time, root, 0.1, 'sawtooth', 0.15);
      } else {
          this.playNote(time, root * 2, 0.1, 'sawtooth', 0.1);
      }

      // Lead Arpeggio (A Minor: A, C, E)
      // Pattern: A C E C A C E G
      const melody = [440, 523.25, 659.25, 523.25, 440, 523.25, 659.25, 783.99];
      if (step % 2 === 0) {
          const noteIdx = Math.floor(step / 2) % melody.length;
          // Randomize octave occasionally for tension
          const freq = melody[noteIdx] * (Math.random() > 0.9 ? 2 : 1);
          this.playNote(time, freq, 0.1, 'square', 0.05);
      }
  }

  startMusic() {
    if (!this.ctx) this.initialize();
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.beatCount = 0;
    this.nextNoteTime = this.ctx!.currentTime + 0.1;
    this.scheduler();
  }

  stopMusic() {
    this.isPlaying = false;
    if (this.timerID) window.clearTimeout(this.timerID);
  }
}

export const audioService = new AudioService();
