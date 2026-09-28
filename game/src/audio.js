/* ============================================================
   FUNDIÇÃO 7 — sons sintetizados (WebAudio), sem arquivos
   ============================================================ */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

export class Audio {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.lastCoin = 0;
    this.coinStep = 0;
    try {
      const s = JSON.parse(localStorage.getItem('f7-audio') || '{}');
      if (s.sfx === false) this.sfxOn = false;
      if (s.music === false) this.musicOn = false;
    } catch (e) { /* sem storage */ }
  }
  save() { try { localStorage.setItem('f7-audio', JSON.stringify({ sfx: this.sfxOn, music: this.musicOn })); } catch (e) { /* ok */ } }

  // o navegador só libera áudio depois de um toque/clique
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.16 : 0;
      this.musicBus.connect(this.master);
      this.startMusic();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(freq, dur, { type = 'triangle', vol = 0.25, at = 0, slide = 0, bus } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, { vol = 0.2, at = 0, freq = 900, q = 0.8 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + at;
    const buf = c.createBuffer(1, Math.max(1, (c.sampleRate * dur) | 0), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t);
  }
  note(semi) { return 523.25 * Math.pow(2, semi / 12); }

  play(name) {
    if (!this.sfxOn || !this.ctx) return;
    switch (name) {
      case 'place': this.tone(660, 0.09, { type: 'square', vol: 0.08 }); this.tone(990, 0.12, { vol: 0.12, at: 0.04 }); break;
      case 'belt': this.tone(520 + Math.random() * 60, 0.05, { type: 'square', vol: 0.04 }); break;
      case 'remove': this.tone(420, 0.2, { type: 'sawtooth', vol: 0.06, slide: 0.4 }); this.noise(0.15, { vol: 0.1, freq: 500 }); break;
      case 'rotate': this.tone(700, 0.06, { vol: 0.1 }); break;
      case 'click': this.tone(880, 0.05, { type: 'sine', vol: 0.1 }); break;
      case 'error': this.tone(180, 0.18, { type: 'square', vol: 0.07, slide: 0.8 }); break;
      case 'coin': {
        const now = this.ctx.currentTime;
        if (now - this.lastCoin < 0.09) return;
        this.coinStep = now - this.lastCoin < 0.6 ? (this.coinStep + 1) % PENTA.length : 0;
        this.lastCoin = now;
        this.tone(this.note(PENTA[this.coinStep] + 12), 0.14, { type: 'sine', vol: 0.07 });
        break;
      }
      case 'goal':
        [0, 4, 7, 12].forEach((s, i) => this.tone(this.note(s), 0.3, { vol: 0.16, at: i * 0.09 }));
        this.tone(this.note(19), 0.6, { type: 'sine', vol: 0.12, at: 0.36 });
        break;
      case 'era':
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(this.note(s - 12), 0.45, { vol: 0.15, at: i * 0.08 }));
        [0, 7, 12].forEach((s) => this.tone(this.note(s), 1.2, { type: 'sine', vol: 0.1, at: 0.6 }));
        this.noise(1.0, { vol: 0.05, freq: 4000, at: 0.1 });
        break;
      case 'unlock': this.tone(this.note(12), 0.18, { vol: 0.12 }); this.tone(this.note(19), 0.3, { vol: 0.12, at: 0.08 }); break;
      case 'launch':
        this.noise(4.5, { vol: 0.35, freq: 180, q: 0.5 });
        this.tone(60, 4.5, { type: 'sawtooth', vol: 0.12, slide: 3 });
        break;
      case 'boom': { // fogos: estalo + chiado das faíscas
        const now = this.ctx.currentTime;
        if (now - (this.lastBoom || 0) < 0.12) return;
        this.lastBoom = now;
        this.noise(0.35, { vol: 0.22, freq: 260, q: 0.6 });
        this.noise(0.9, { vol: 0.05, freq: 5200, q: 0.4, at: 0.08 });
        break;
      }
      case 'ach':
        [7, 12, 16, 19].forEach((s, i) => this.tone(this.note(s), 0.22, { type: 'sine', vol: 0.12, at: i * 0.07 }));
        this.tone(this.note(24), 0.5, { vol: 0.1, at: 0.28 });
        break;
      case 'contract':
        [0, 7, 12].forEach((s, i) => this.tone(this.note(s + 5), 0.2, { vol: 0.13, at: i * 0.06 }));
        this.tone(this.note(17), 0.35, { type: 'sine', vol: 0.1, at: 0.2 });
        break;
      case 'shutter': this.noise(0.06, { vol: 0.25, freq: 3000 }); this.noise(0.08, { vol: 0.18, freq: 1800, at: 0.09 }); break;
      case 'victory':
        [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(this.note(s), 0.35, { vol: 0.15, at: i * 0.11 }));
        break;
    }
  }

  setSfx(on) { this.sfxOn = on; this.save(); }
  setMusic(on) {
    this.musicOn = on;
    this.save();
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.3);
  }

  // trilha: marimba suave em pentatônica, 4 acordes em loop, nunca repete igual
  startMusic() {
    const chords = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];
    const beat = 60 / 92;
    let step = 0;
    const tick = () => {
      if (!this.ctx) return;
      if (this.musicOn) {
        const ch = chords[Math.floor(step / 8) % chords.length];
        if (step % 8 === 0) ch.forEach((s) => this.tone(this.note(s - 24), beat * 7, { type: 'sine', vol: 0.18, bus: this.musicBus }));
        if (Math.random() < (step % 2 ? 0.35 : 0.7)) {
          const s = PENTA[(Math.random() * 7) | 0] + (Math.random() < 0.3 ? 12 : 0);
          this.tone(this.note(s - 12), beat * 1.4, { type: 'triangle', vol: 0.12, bus: this.musicBus });
        }
      }
      step++;
      this.musicTimer = setTimeout(tick, beat * 500);
    };
    tick();
  }
}
