/* ============================================================
   BALSA FURADA — sons sintetizados (WebAudio), sem arquivos
   ============================================================ */
export class Audio {
  constructor() {
    this.ctx = null;
    this.vol = 0.7;
    try { const v = parseFloat(localStorage.getItem('bf-vol')); if (!isNaN(v)) this.vol = v; } catch (e) { /* sem storage */ }
  }
  setVol(v) {
    this.vol = v;
    if (this.master) this.master.gain.value = v * 0.6;
    try { localStorage.setItem('bf-vol', String(v)); } catch (e) { /* ok */ }
  }

  // o navegador só libera áudio depois de um clique
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain();
      this.master.gain.value = this.vol * 0.6;
      this.master.connect(c.destination);
      // barulho do rio: ruído marrom filtrado
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
      this.noiseBuf = buf;
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = true;
      this.rioFiltro = c.createBiquadFilter();
      this.rioFiltro.type = 'lowpass';
      this.rioFiltro.frequency.value = 500;
      this.rioGain = c.createGain();
      this.rioGain.gain.value = 0;
      src.connect(this.rioFiltro).connect(this.rioGain).connect(this.master);
      src.start();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  rio(forca) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rioGain.gain.setTargetAtTime(0.18 + forca * 0.25, t, 0.3);
    this.rioFiltro.frequency.setTargetAtTime(380 + forca * 900, t, 0.3);
  }

  tone(freq, dur, { type = 'triangle', vol = 0.25, at = 0, slide = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.3, freq = 1200, q = 0.8, at = 0, type = 'bandpass', slide = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  play(nome) {
    switch (nome) {
      case 'splash': this.noise(0.5, { vol: 0.5, freq: 900, q: 0.6, slide: 0.4 }); this.tone(220, 0.15, { type: 'sine', vol: 0.1, slide: 0.5 }); break;
      case 'splashP': this.noise(0.25, { vol: 0.22, freq: 1400, q: 0.8, slide: 0.5 }); break;
      case 'batida':
        this.tone(80, 0.35, { type: 'sine', vol: 0.6, slide: 0.5 });
        this.noise(0.3, { vol: 0.5, freq: 300, q: 1.2 });
        this.tone(140, 0.25, { type: 'square', vol: 0.08, slide: 0.6, at: 0.03 }); break;
      case 'range': this.tone(110 + Math.random() * 40, 0.4, { type: 'sawtooth', vol: 0.05, slide: 0.8 }); break;
      case 'pega': this.tone(520, 0.08, { vol: 0.18 }); this.tone(780, 0.1, { vol: 0.15, at: 0.06 }); break;
      case 'solta': this.tone(330, 0.12, { vol: 0.16, slide: 0.7 }); break;
      case 'martelo': for (let i = 0; i < 3; i++) this.noise(0.08, { vol: 0.5, freq: 1800, q: 3, at: i * 0.12 }); this.tone(660, 0.2, { vol: 0.12, at: 0.4 }); break;
      case 'bomba': this.noise(0.18, { vol: 0.12, freq: 500, q: 2, slide: 1.6 }); break;
      case 'moeda': this.tone(988, 0.08, { type: 'square', vol: 0.07 }); this.tone(1319, 0.3, { type: 'square', vol: 0.07, at: 0.08 }); break;
      case 'tic': this.tone(1800, 0.03, { type: 'square', vol: 0.05 }); break;
      case 'ganhou': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, { type: 'square', vol: 0.08, at: i * 0.09 })); break;
      case 'perdeu': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, { type: 'sawtooth', vol: 0.07, at: i * 0.14 })); break;
      case 'empurra': this.tone(180, 0.15, { type: 'square', vol: 0.12, slide: 1.8 }); this.noise(0.1, { vol: 0.2, freq: 700 }); break;
      case 'pulo': this.tone(300, 0.15, { type: 'sine', vol: 0.12, slide: 1.8 }); break;
      case 'boia': this.noise(0.4, { vol: 0.2, freq: 2000, q: 0.5, slide: 0.3 }); break;
      case 'trinca': this.noise(0.15, { vol: 0.35, freq: 3500, q: 4 }); this.tone(1500, 0.1, { type: 'square', vol: 0.05, slide: 0.5 }); break;
      case 'sino': [0, 0.35].forEach((a) => { this.tone(880, 1.2, { type: 'sine', vol: 0.2, at: a }); this.tone(1320, 0.8, { type: 'sine', vol: 0.08, at: a }); }); break;
      case 'afundou': this.tone(300, 1.6, { type: 'sine', vol: 0.3, slide: 0.2 }); this.noise(1.5, { vol: 0.4, freq: 600, slide: 0.3 }); break;
      case 'chat': this.tone(700, 0.06, { vol: 0.08 }); break;
      case 'clique': this.tone(600, 0.05, { vol: 0.1 }); break;
    }
  }
}
