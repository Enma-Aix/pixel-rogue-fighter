import type { Sfx } from "./types";
import { loadSave, writeSave } from "./storage";

const VOLUME = [0, 0.1, 0.2, 0.32];
const VOLUME_NAME = ["关", "低", "中", "高"];

interface Track {
  bpm: number;
  bass: number[];
  lead: number[];
}

const REST = 0;
const A2 = 110;
const C3 = 130.81;
const D3 = 146.83;
const E3 = 164.81;
const F3 = 174.61;
const G3 = 196;
const A3 = 220;
const C4 = 261.63;
const D4 = 293.66;
const E4 = 329.63;
const F4 = 349.23;
const G4 = 392;
const A4 = 440;
const B3 = 246.94;

const TRACKS: Record<number, Track> = {
  0: {
    bpm: 76,
    bass: [A2, REST, E3, REST, A2, REST, D3, REST, C3, REST, E3, REST, A2, REST, G3, REST],
    lead: [E4, REST, REST, G4, REST, A4, REST, REST, D4, REST, E4, REST, C4, REST, REST, REST],
  },
  1: {
    bpm: 96,
    bass: [A2, A2, C3, REST, D3, D3, E3, REST, G3, REST, E3, REST, D3, C3, A2, REST],
    lead: [E4, REST, G4, A4, REST, G4, E4, REST, D4, E4, REST, C4, D4, REST, E4, REST],
  },
  2: {
    bpm: 112,
    bass: [D3, REST, F3, REST, G3, A3, REST, D3, C3, REST, D3, F3, G3, REST, A3, REST],
    lead: [A4, REST, G4, F4, REST, G4, A4, REST, D4, F4, G4, REST, A4, REST, G4, REST],
  },
  3: {
    bpm: 108,
    bass: [E3, E3, REST, F3, E3, REST, B3, REST, A2, REST, E3, F3, E3, REST, D3, REST],
    lead: [B3, REST, E4, REST, F4, E4, REST, D4, E4, REST, B3, REST, A3, REST, G3, E4],
  },
};

class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volume = 2;
  private musicStage = -1;
  private musicStep = 0;
  private nextNote = 0;
  private timer = 0;

  constructor() {
    const save = loadSave();
    this.volume = save.volume;
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = VOLUME[this.volume] ?? 0.2;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.45;
      this.musicGain.connect(this.master);
      const count = Math.floor(this.ctx.sampleRate * 0.4);
      const buffer = this.ctx.createBuffer(1, count, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  volumeName(): string {
    return VOLUME_NAME[this.volume] ?? "中";
  }

  cycleVolume(): number {
    this.unlock();
    const save = loadSave();
    save.volume = (save.volume + 1) % 4;
    save.mute = save.volume === 0;
    writeSave(save);
    this.apply(save.volume);
    if (save.volume > 0) this.play("ui");
    return save.volume;
  }

  private apply(level: number): void {
    this.volume = level;
    if (this.master) this.master.gain.value = VOLUME[level] ?? 0;
  }

  startMusic(stage: 0 | 1 | 2 | 3): void {
    this.unlock();
    if (!this.ctx) return;
    if (this.musicStage === stage && this.timer) return;
    this.musicStage = stage;
    this.musicStep = 0;
    this.nextNote = this.ctx.currentTime + 0.05;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.pump(), 40);
  }

  stopMusic(): void {
    this.musicStage = -1;
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = 0;
    }
  }

  private pump(): void {
    if (!this.ctx || this.musicStage < 0) return;
    const track = TRACKS[this.musicStage];
    if (!track) return;
    const step = 60 / track.bpm / 2;
    const horizon = this.ctx.currentTime + 0.16;
    while (this.nextNote < horizon) {
      const i = this.musicStep % track.bass.length;
      this.blip(this.nextNote, track.bass[i], step * 0.9, "triangle", 0.05);
      this.blip(this.nextNote, track.lead[i], step * 0.7, "square", 0.028);
      this.musicStep += 1;
      this.nextNote += step;
    }
  }

  private blip(time: number, freq: number, dur: number, type: OscillatorType, gain: number): void {
    if (!this.ctx || !this.musicGain || freq <= 0) return;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    amp.gain.setValueAtTime(gain, time);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(amp);
    amp.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  play(kind: Sfx): void {
    this.unlock();
    if (!this.ctx || !this.master || this.volume === 0) return;
    switch (kind) {
      case "swing":
        this.burst(0.05, 0.07, 900);
        this.tone(620, 0.06, "square", 0.045, -380);
        break;
      case "hit":
        this.tone(180, 0.07, "square", 0.08, -60);
        this.burst(0.05, 0.09, 200);
        this.tone(420, 0.04, "square", 0.03, -200);
        break;
      case "ko":
        this.burst(0.12, 0.1, 180);
        this.tone(240, 0.16, "sawtooth", 0.07, -140);
        this.tone(90, 0.2, "triangle", 0.06, -30);
        break;
      case "hurt":
        this.tone(140, 0.14, "sawtooth", 0.07, -80);
        this.burst(0.08, 0.05, 300);
        break;
      case "jump":
        this.tone(320, 0.07, "square", 0.04, 280);
        break;
      case "dash":
        this.burst(0.1, 0.07, 700);
        this.tone(240, 0.09, "square", 0.04, -140);
        break;
      case "special":
        this.tone(520, 0.08, "square", 0.05, 180);
        this.tone(880, 0.18, "sine", 0.05, -360);
        this.burst(0.1, 0.04, 1200);
        break;
      case "coin":
        this.tone(880, 0.05, "square", 0.045, 0);
        this.tone(1320, 0.09, "square", 0.04, 40);
        break;
      case "ui":
        this.tone(660, 0.04, "square", 0.04, 80);
        break;
      case "death":
        this.tone(196, 0.28, "triangle", 0.07, -90);
        this.tone(98, 0.4, "sawtooth", 0.05, -40);
        break;
      case "win":
        this.tone(523, 0.1, "square", 0.045, 0);
        this.tone(659, 0.1, "square", 0.045, 0);
        this.tone(784, 0.12, "square", 0.045, 0);
        this.tone(1046, 0.22, "square", 0.05, 0);
        break;
      case "slam":
        this.burst(0.16, 0.11, 120);
        this.tone(64, 0.2, "sawtooth", 0.08, -16);
        break;
      case "arrow":
        this.tone(1100, 0.04, "square", 0.03, -700);
        this.burst(0.03, 0.03, 2000);
        break;
      case "boss":
        this.tone(70, 0.32, "sawtooth", 0.07, -18);
        this.tone(140, 0.22, "square", 0.04, -40);
        this.burst(0.18, 0.06, 150);
        break;
      default:
        break;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slide: number): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freq), now);
    if (slide !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + dur);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private burst(dur: number, gain: number, cutoff: number): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const amp = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.master);
    src.start(now);
    src.stop(now + dur);
  }
}

export const audio = new AudioBus();
