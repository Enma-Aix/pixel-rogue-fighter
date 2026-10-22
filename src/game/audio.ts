import type { Sfx } from "./types";
import { loadSave, writeSave } from "./storage";

class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  constructor() {
    this.muted = loadSave().mute;
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.22;
      this.master.connect(this.ctx.destination);
      const count = Math.floor(this.ctx.sampleRate * 0.4);
      const buffer = this.ctx.createBuffer(1, count, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.22;
  }

  toggleMute(): boolean {
    const save = loadSave();
    save.mute = !save.mute;
    writeSave(save);
    this.setMuted(save.mute);
    if (!save.mute) this.play("ui");
    return save.mute;
  }

  play(kind: Sfx): void {
    this.unlock();
    if (!this.ctx || !this.master || this.muted) return;
    switch (kind) {
      case "swing":
        this.burst(0.05, 0.05);
        this.tone(540, 0.07, "square", 0.05, -320);
        break;
      case "hit":
        this.tone(150, 0.09, "square", 0.08, -40);
        this.burst(0.06, 0.07);
        break;
      case "hurt":
        this.tone(120, 0.16, "sawtooth", 0.07, -70);
        break;
      case "jump":
        this.tone(280, 0.08, "square", 0.05, 240);
        break;
      case "dash":
        this.burst(0.09, 0.06);
        this.tone(220, 0.08, "square", 0.04, -80);
        break;
      case "special":
        this.tone(680, 0.2, "sine", 0.07, -420);
        this.burst(0.08, 0.04);
        break;
      case "coin":
        this.tone(880, 0.06, "square", 0.05, 0);
        this.tone(1320, 0.08, "square", 0.04, 0);
        break;
      case "ui":
        this.tone(720, 0.05, "square", 0.05, 0);
        break;
      case "death":
        this.tone(220, 0.45, "triangle", 0.08, -160);
        break;
      case "win":
        this.tone(523, 0.12, "square", 0.05, 0);
        this.tone(659, 0.12, "square", 0.05, 0);
        this.tone(784, 0.14, "square", 0.05, 0);
        this.tone(1046, 0.22, "square", 0.05, 0);
        break;
      case "slam":
        this.burst(0.14, 0.09);
        this.tone(70, 0.18, "sawtooth", 0.08, -20);
        break;
      case "arrow":
        this.tone(980, 0.05, "square", 0.03, -600);
        break;
      case "boss":
        this.tone(78, 0.28, "sawtooth", 0.07, -20);
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
    if (slide !== 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + dur);
    }
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private burst(dur: number, gain: number): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const amp = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 400;
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
