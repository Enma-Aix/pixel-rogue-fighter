type Cue = 'title' | 'ash' | 'molten' | 'sanctum' | 'boss' | 'none';

interface Pattern {
  bpm: number;
  root: number;
  scale: number[];
  bass: number[];
  lead: number[];
  harmony: number[];
  hat: number;
  kick: number[];
  snare: number[];
  wave: OscillatorType;
  pad: number;
}

const PATTERNS: Record<Exclude<Cue, 'none'>, Pattern> = {
  title: {
    bpm: 72,
    root: 196,
    scale: [0, 3, 5, 7, 10, 12],
    bass: [0, 0, 5, 0, 3, 3, 7, 5],
    lead: [12, -1, 10, 7, 12, 15, 10, 7, 5, 7, 10, -1, 5, 3, 0, 3],
    harmony: [7, 5, 3, 7, 10, 7, 5, 3],
    hat: 0.03,
    kick: [1, 0, 0, 0, 1, 0, 0, 1],
    snare: [0, 0, 1, 0, 0, 0, 1, 0],
    wave: 'triangle',
    pad: 0.04,
  },
  ash: {
    bpm: 92,
    root: 174,
    scale: [0, 2, 3, 7, 8, 12],
    bass: [0, 0, 7, 3, 0, 8, 7, 5],
    lead: [7, 8, 12, 7, 3, 2, 0, 3, 8, 7, 12, 8, 3, 2, 0, -1],
    harmony: [3, 7, 8, 3, 0, 2, 7, 5],
    hat: 0.045,
    kick: [1, 0, 0, 1, 0, 0, 1, 0],
    snare: [0, 0, 1, 0, 0, 1, 0, 0],
    wave: 'triangle',
    pad: 0.035,
  },
  molten: {
    bpm: 112,
    root: 146,
    scale: [0, 1, 5, 7, 8, 12],
    bass: [0, 0, 0, 5, 1, 1, 7, 5, 0, 1, 0, 5, 7, 7, 8, 5],
    lead: [12, 8, 7, 5, 8, 12, 15, 12, 8, 5, 1, 0, 7, 8, 12, 7],
    harmony: [0, 1, 5, 7, 1, 0, 8, 5],
    hat: 0.06,
    kick: [1, 0, 1, 0, 1, 0, 1, 1],
    snare: [0, 0, 1, 0, 0, 1, 0, 1],
    wave: 'sawtooth',
    pad: 0.02,
  },
  sanctum: {
    bpm: 78,
    root: 220,
    scale: [0, 3, 5, 7, 10, 12],
    bass: [0, 7, 3, 10, 0, 5, 7, 3],
    lead: [15, 12, 10, 12, 7, 10, 12, 15, 19, 15, 12, 10, 7, 12, 10, 7],
    harmony: [10, 7, 5, 7, 3, 5, 7, 10],
    hat: 0.025,
    kick: [1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 1, 0, 0, 1, 0],
    wave: 'sine',
    pad: 0.05,
  },
  boss: {
    bpm: 128,
    root: 138,
    scale: [0, 1, 3, 6, 7, 10],
    bass: [0, 0, 1, 0, 6, 6, 7, 1, 0, 0, 3, 1, 6, 7, 1, 0],
    lead: [7, 6, 3, 1, 0, 3, 6, 10, 7, 6, 10, 7, 3, 1, 6, 7],
    harmony: [1, 6, 7, 3, 0, 1, 6, 10],
    hat: 0.07,
    kick: [1, 0, 1, 0, 1, 0, 1, 0],
    snare: [0, 0, 1, 0, 0, 1, 0, 1],
    wave: 'sawtooth',
    pad: 0.03,
  },
};

class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private cue: Cue = 'none';
  private step = 0;
  private nextAt = 0;
  musicVol = 0.7;
  sfxVol = 0.85;

  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.applyVolumes();
  }

  applyVolumes(): void {
    if (!this.music || !this.sfx || !this.ctx) return;
    this.music.gain.setTargetAtTime(this.musicVol * 0.22, this.ctx.currentTime, 0.05);
    this.sfx.gain.setTargetAtTime(this.sfxVol * 0.9, this.ctx.currentTime, 0.02);
  }

  setCue(cue: Cue): void {
    if (this.cue === cue) return;
    this.cue = cue;
    this.step = 0;
    this.nextAt = 0;
  }

  pump(): void {
    if (!this.ctx || !this.music || this.cue === 'none') return;
    const pattern = PATTERNS[this.cue];
    const beat = 60 / pattern.bpm / 2;
    const now = this.ctx.currentTime;
    if (this.nextAt < now) this.nextAt = now + 0.05;
    while (this.nextAt < now + 0.25) {
      this.schedule(pattern, this.nextAt, this.step);
      this.step = (this.step + 1) % 32;
      this.nextAt += beat;
    }
  }

  private schedule(pattern: Pattern, when: number, step: number): void {
    if (!this.ctx || !this.music) return;
    const degree = (n: number) => {
      const scale = pattern.scale;
      const oct = Math.floor(n / scale.length);
      const idx = ((n % scale.length) + scale.length) % scale.length;
      return pattern.root * 2 ** (oct + scale[idx]! / 12);
    };
    const music = this.music;
    if (step % 8 === 0) this.tone(pattern.root / 2, when, 1.4, 'sine', pattern.pad, music);
    if (step % 2 === 0) {
      const bass = pattern.bass[(step / 2) % pattern.bass.length]!;
      this.tone(degree(bass) / 2, when, 0.22, pattern.wave === 'sawtooth' ? 'sawtooth' : 'triangle', pattern.wave === 'sawtooth' ? 0.07 : 0.11, music);
    }
    const lead = pattern.lead[step % pattern.lead.length]!;
    if (lead >= 0 && step % 2 === 0) {
      this.tone(degree(lead), when, 0.16, pattern.wave === 'sine' ? 'triangle' : 'square', 0.035, music);
      this.tone(degree(lead) * 2, when, 0.08, 'triangle', 0.012, music);
    }
    if (step % 4 === 2) {
      const harm = pattern.harmony[(step / 4) % pattern.harmony.length]!;
      if (harm >= 0) this.tone(degree(harm), when, 0.2, 'triangle', 0.028, music);
    }
    if (pattern.kick[step % pattern.kick.length]) this.noise(when, 0.08, 0.16, 140, music);
    if (pattern.snare[step % pattern.snare.length]) this.noise(when, 0.1, pattern.hat * 3.2, 900, music);
    if (step % 2 === 1) this.noise(when, 0.03, pattern.hat, 2400, music);
  }

  play(id: string): void {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const out = this.sfx;
    switch (id) {
      case 'swing':
        this.noise(t, 0.06, 0.18, 900);
        this.tone(520, t, 0.05, 'square', 0.05, out);
        break;
      case 'swingHammer':
        this.noise(t, 0.08, 0.22, 420);
        this.tone(140, t, 0.09, 'sawtooth', 0.07, out);
        break;
      case 'swingDagger':
        this.noise(t, 0.04, 0.12, 1600);
        this.tone(880, t, 0.04, 'square', 0.04, out);
        break;
      case 'swingHeavy':
        this.noise(t, 0.1, 0.28, 500);
        this.tone(180, t, 0.12, 'sawtooth', 0.08, out);
        break;
      case 'hit':
      case 'hitSword':
        this.tone(240, t, 0.05, 'square', 0.1, out);
        this.tone(720, t, 0.04, 'square', 0.05, out);
        this.noise(t, 0.05, 0.16, 1600);
        break;
      case 'hitSwordHeavy':
        this.tone(160, t, 0.1, 'square', 0.14, out);
        this.tone(90, t + 0.02, 0.12, 'triangle', 0.08, out);
        this.noise(t, 0.08, 0.22, 900);
        break;
      case 'hitHammer':
      case 'hitHammerLight':
        this.tone(90, t, 0.12, 'square', 0.16, out);
        this.tone(48, t, 0.16, 'sine', 0.1, out);
        this.noise(t, 0.1, 0.24, 400);
        break;
      case 'hitDagger':
        this.tone(980, t, 0.03, 'square', 0.07, out);
        this.tone(640, t + 0.02, 0.04, 'square', 0.04, out);
        this.noise(t, 0.03, 0.1, 2200);
        break;
      case 'hitHeavy':
        this.tone(120, t, 0.12, 'square', 0.16, out);
        this.noise(t, 0.08, 0.22, 700);
        break;
      case 'hurt':
        this.tone(160, t, 0.14, 'sawtooth', 0.1, out);
        this.tone(90, t, 0.16, 'square', 0.08, out);
        break;
      case 'death':
        this.tone(220, t, 0.4, 'sawtooth', 0.1, out);
        this.tone(110, t + 0.08, 0.5, 'triangle', 0.12, out);
        break;
      case 'die':
        this.noise(t, 0.12, 0.2, 600);
        this.tone(300, t, 0.1, 'square', 0.06, out);
        this.tone(180, t + 0.04, 0.12, 'triangle', 0.04, out);
        break;
      case 'bossDie':
        this.tone(80, t, 0.5, 'sawtooth', 0.14, out);
        this.noise(t, 0.3, 0.25, 400);
        break;
      case 'dash':
        this.noise(t, 0.1, 0.16, 1200);
        this.noise(t, 0.14, 0.08, 400);
        this.tone(640, t, 0.08, 'square', 0.04, out);
        break;
      case 'jump':
        this.tone(420, t, 0.07, 'square', 0.05, out);
        this.tone(640, t + 0.03, 0.06, 'square', 0.04, out);
        break;
      case 'land':
        this.noise(t, 0.05, 0.12, 300);
        this.tone(90, t, 0.06, 'triangle', 0.05, out);
        break;
      case 'parry':
        this.tone(880, t, 0.08, 'square', 0.08, out);
        this.tone(1320, t + 0.04, 0.12, 'square', 0.06, out);
        break;
      case 'dodge':
        this.tone(760, t, 0.08, 'triangle', 0.06, out);
        break;
      case 'skill':
        this.tone(300, t, 0.1, 'sawtooth', 0.07, out);
        this.tone(520, t + 0.05, 0.12, 'square', 0.06, out);
        break;
      case 'heal':
      case 'heal2':
        this.tone(520, t, 0.1, 'triangle', 0.06, out);
        this.tone(780, t + 0.06, 0.12, 'triangle', 0.05, out);
        break;
      case 'pickup':
      case 'buy':
      case 'chest':
        this.tone(660, t, 0.08, 'square', 0.06, out);
        this.tone(880, t + 0.06, 0.1, 'square', 0.05, out);
        break;
      case 'ui':
        this.tone(700, t, 0.04, 'square', 0.04, out);
        break;
      case 'deny':
        this.tone(140, t, 0.1, 'square', 0.07, out);
        break;
      case 'clear':
        this.tone(520, t, 0.1, 'triangle', 0.06, out);
        this.tone(780, t + 0.08, 0.14, 'triangle', 0.05, out);
        break;
      case 'stepRoom':
        this.noise(t, 0.08, 0.08, 400);
        break;
      case 'tele':
        this.tone(200, t, 0.12, 'sawtooth', 0.05, out);
        break;
      case 'teleBoss':
        this.tone(110, t, 0.2, 'sawtooth', 0.08, out);
        break;
      case 'roar':
        this.tone(70, t, 0.35, 'sawtooth', 0.12, out);
        this.tone(42, t, 0.4, 'square', 0.06, out);
        this.noise(t, 0.25, 0.18, 250);
        break;
      case 'boom':
        this.noise(t, 0.16, 0.28, 280);
        this.tone(90, t, 0.16, 'square', 0.1, out);
        break;
      case 'break':
        this.noise(t, 0.1, 0.16, 900);
        break;
      case 'win':
        this.tone(523, t, 0.16, 'triangle', 0.07, out);
        this.tone(659, t + 0.12, 0.16, 'triangle', 0.07, out);
        this.tone(784, t + 0.24, 0.28, 'triangle', 0.08, out);
        break;
      default:
        break;
    }
  }

  private tone(
    freq: number,
    when: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    dest: AudioNode,
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  private noise(when: number, dur: number, vol: number, freq: number, dest?: AudioNode): void {
    if (!this.ctx || !this.sfx) return;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = freq < 240 ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(freq, when);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest ?? this.sfx);
    src.start(when);
    src.stop(when + dur + 0.02);
  }
}

export const audio = new AudioBus();
