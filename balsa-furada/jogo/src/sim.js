/* ============================================================
   BALSA FURADA — simulação (só roda no anfitrião)
   O anfitrião manda na balsa, nos furos, na água, nos itens e no
   dinheiro. Cada jogador manda na própria posição e pede ações
   ("pegar", "tapar", "apostar"...), que o anfitrião confere aqui.
   ============================================================ */
import { RAFT, ESTACOES, LOOT, MELHORIAS, ROLETA, PAGA, CORES, pedagio, clamp, MAX_JOGADORES } from './data.js';
import { makeRiver } from './river.js';

const HX = RAFT.W / 2, HZ = RAFT.L / 2;
const r2 = (v) => Math.round(v * 100) / 100;

export class Sim {
  constructor(net) {
    this.net = net;
    this.players = new Map();
    this.rand = Math.random;
    this.snapT = 0;
    this.novaViagem();
  }

  novaViagem() {
    this.runSeed = (Math.random() * 1e9) | 0;
    this.phase = 'lobby';
    this.level = 0;
    this.cofre = 0;
    this.planks = 6;
    this.up = { bomba: 0, casco: 0, leme: 0, rede: 0, boia: 0 };
    this.stats = { ganho: 0, trechos: 0, apostado: 0, melhor: null, motivo: '' };
    this.roleta = null;
    this.porto = null;
    this.itemId = 1;
    this.holeId = 1;
    this.prepararRio(0);
    for (const p of this.players.values()) { p.ready = false; p.m = 'deck'; }
  }

  // nível 0 = porto de saída (saguão)
  prepararRio(level) {
    this.level = level;
    this.seed = (this.runSeed + level * 7919) >>> 0;
    this.river = makeRiver(this.seed, Math.max(1, level));
    this.t = 0;
    // a balsa sai encostada no cais da margem direita
    const z = 8;
    this.raft = { x: this.river.cx(z) + this.river.hw(z) - HX - 1.7, z, vx: 0, vz: 0, water: 0, rudder: 0, hitCd: 0 };
    this.holes = [];
    this.items = [];
    this.rockCd = new Map();
    this.lemeBy = null;
    this.boiaCd = 0;
    this.sunkT = 0;
    if (level > 0) this.river.loot.forEach((l) => this.items.push({ id: this.itemId++, k: l.kind, s: 'f', x: l.x, z: l.z, v: LOOT[l.kind].v }));
  }

  /* ---------- jogadores ---------- */
  addPlayer(id, name, cor) {
    if (this.players.size >= MAX_JOGADORES && !this.players.has(id)) return false;
    const n = this.players.size;
    if (!/^#[0-9a-f]{6}$/i.test(cor)) cor = CORES[n % CORES.length];
    this.players.set(id, { id, name: String(name || 'Marujo').slice(0, 16), cor, m: 'deck', x: -1.2 + (n % 3) * 1.2, y: 0, z: 0.5 - Math.floor(n / 3) * 1.2, ry: 0, an: 0, ready: false, pump: false });
    return true;
  }
  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    for (const it of this.items) if (it.s === 'c' && it.by === id) this.soltar(it, this.worldOf(p));
    if (this.lemeBy === id) this.lemeBy = null;
    this.players.delete(id);
    this.net.broadcast({ t: 'ev', e: 'saiu', name: p.name });
    this.confereProntos();
  }
  worldOf(p) {
    if (p.m === 'water' || p.m === 'ghost') return { x: p.x, z: p.z };
    return { x: this.raft.x + p.x, z: this.raft.z + p.z };
  }

  /* ---------- mensagens dos jogadores ---------- */
  onMsg(id, m) {
    const p = this.players.get(id);
    if (!p || !m || typeof m !== 'object') return;
    switch (m.t) {
      case 'me':
        p.m = ['deck', 'water', 'ghost', 'leme'].includes(m.m) ? m.m : 'deck';
        p.x = +m.x || 0; p.y = +m.y || 0; p.z = +m.z || 0; p.ry = +m.ry || 0; p.an = m.an | 0;
        if (this.lemeBy === id && p.m !== 'leme') this.lemeBy = null;
        break;
      case 'act': this.acao(p, m); break;
    }
  }

  acao(p, m) {
    const rio = this.phase === 'rio';
    switch (m.a) {
      case 'pegar': {
        const it = this.items.find((i) => i.id === m.id);
        if (!it || it.s === 'c' || this.carregando(p.id)) return;
        it.s = 'c'; it.by = p.id;
        this.net.broadcast({ t: 'ev', e: 'pegou', id: p.id, k: it.k });
        break;
      }
      case 'soltar': {
        const it = this.items.find((i) => i.s === 'c' && i.by === p.id);
        if (it) this.soltar(it, { x: +m.x, z: +m.z }, !!m.jogou);
        break;
      }
      case 'tabua': {
        if (this.carregando(p.id) || this.planks <= 0) return;
        this.planks--;
        this.items.push({ id: this.itemId++, k: 'tabua', s: 'c', by: p.id, x: 0, z: 0, v: 0 });
        break;
      }
      case 'tapar': {
        const it = this.items.find((i) => i.s === 'c' && i.by === p.id && i.k === 'tabua');
        const h = this.holes.find((k) => k.id === m.id);
        if (!it || !h) return;
        this.holes.splice(this.holes.indexOf(h), 1);
        this.items.splice(this.items.indexOf(it), 1);
        this.net.broadcast({ t: 'ev', e: 'tapou', x: h.x, z: h.z, id: p.id });
        break;
      }
      case 'bomba': p.pump = !!m.on && rio; break;
      case 'leme':
        if (m.on) { if (!this.lemeBy || !this.players.has(this.lemeBy)) { this.lemeBy = p.id; this.raft.rudder = 0; } }
        else if (this.lemeBy === p.id) { this.lemeBy = null; this.raft.rudder = 0; }
        break;
      case 'virar': if (this.lemeBy === p.id) this.raft.rudder = clamp(+m.v || 0, -1, 1); break;
      case 'boia': this.jogarBoia(p); break;
      case 'caiu': this.net.broadcast({ t: 'ev', e: 'splash', x: +m.x || 0, z: +m.z || 0, s: 1 }); break;
      case 'empurrar': {
        const alvo = this.players.get(m.id);
        if (!alvo) return;
        const d = Math.hypot(m.dx, m.dz) || 1;
        this.net.sendTo(alvo.id, { t: 'ev', e: 'empurrao', dx: m.dx / d, dz: m.dz / d, por: p.name });
        this.net.broadcast({ t: 'ev', e: 'som', s: 'empurra', id: alvo.id });
        break;
      }
      case 'chat': {
        const txt = String(m.txt || '').slice(0, 120).trim();
        if (txt) this.net.broadcast({ t: 'ev', e: 'chat', name: p.name, cor: p.cor, txt });
        break;
      }
      case 'comprar': this.comprar(p, m.id); break;
      case 'apostar': this.apostar(p, m.qt, m.cor); break;
      case 'pronto': p.ready = !!m.v; this.confereProntos(); break;
    }
  }

  carregando(id) { return this.items.some((i) => i.s === 'c' && i.by === id); }

  // item cai onde foi solto: no convés vira carga, fora dele sai boiando
  soltar(it, w, jogou = false) {
    const lx = w.x - this.raft.x, lz = w.z - this.raft.z;
    it.by = null;
    if (Math.abs(lx) < HX - 0.25 && Math.abs(lz) < HZ - 0.25 && this.phase !== 'afundou') {
      it.s = 'd'; it.x = lx; it.z = lz;
      if (jogou && LOOT[it.k].fragil) this.quebra(it, 0.2);
    } else {
      it.s = 'w'; it.x = w.x; it.z = w.z;
      this.net.broadcast({ t: 'ev', e: 'splash', x: w.x, z: w.z, s: 0.6 });
    }
  }

  quebra(it, k) {
    const antes = it.v;
    it.v = Math.max(5, Math.round(it.v * (1 - k)));
    if (it.v < antes) this.net.broadcast({ t: 'ev', e: 'trinca', id: it.id, v: it.v });
  }

  jogarBoia(p) {
    if (this.boiaCd > 0 || (this.phase !== 'rio' && this.phase !== 'porto')) return;
    const st = ESTACOES.boia;
    const bx = this.raft.x + st.x, bz = this.raft.z + st.z;
    const alcance = 9 * (this.up.boia ? 1.5 : 1);
    let alvo = null, best = alcance;
    for (const q of this.players.values()) {
      if (q.m !== 'water') continue;
      const d = Math.hypot(q.x - bx, q.z - bz);
      if (d < best) { best = d; alvo = q; }
    }
    this.boiaCd = 2.2;
    if (alvo) {
      this.net.broadcast({ t: 'ev', e: 'boia', de: p.id, x: alvo.x, z: alvo.z, alvo: alvo.id });
      this.net.sendTo(alvo.id, { t: 'ev', e: 'resgate', x: st.x - 0.5, z: st.z });
      return;
    }
    // sem ninguém na água: a boia fisga o tesouro mais perto
    let item = null; best = alcance;
    for (const it of this.items) {
      if (it.s !== 'f' && it.s !== 'w') continue;
      const d = Math.hypot(it.x - bx, it.z - bz);
      if (d < best) { best = d; item = it; }
    }
    this.net.broadcast({ t: 'ev', e: 'boia', de: p.id, x: item ? item.x : bx + 6, z: item ? item.z : bz + 3, item: item ? item.id : 0 });
    if (item) { item.s = 'd'; item.x = st.x - 0.6 - this.rand() * 0.5; item.z = st.z + (this.rand() - 0.5) * 1.2; }
  }

  comprar(p, id) {
    if (this.phase !== 'porto' && this.phase !== 'lobby') return;
    const up = MELHORIAS.find((u) => u.id === id);
    if (!up) return;
    const n = id === 'tabuas' ? 0 : this.up[id];
    if (n >= up.max || this.cofre < up.preco) return;
    this.cofre -= up.preco;
    if (id === 'tabuas') this.planks += 4; else this.up[id]++;
    this.net.broadcast({ t: 'ev', e: 'comprou', name: p.name, cor: p.cor, nome: up.nome });
  }

  apostar(p, qt, cor) {
    if (this.phase !== 'porto' || this.roleta || !PAGA[cor]) return;
    qt = Math.floor(+qt || 0);
    if (qt <= 0 || qt > this.cofre) return;
    this.cofre -= qt;
    this.stats.apostado += qt;
    const casa = Math.floor(this.rand() * ROLETA.length);
    this.roleta = { casa, cor, qt, name: p.name, pcor: p.cor, fim: this.t + 4.2 };
    this.net.broadcast({ t: 'ev', e: 'roleta', casa, cor, qt, name: p.name, pcor: p.cor });
  }

  confereProntos() {
    const ps = [...this.players.values()];
    if (!ps.length || !ps.every((p) => p.ready) || this.roleta) return;
    for (const p of ps) p.ready = false;
    if (this.phase === 'lobby') this.comecaTrecho(1);
    else if (this.phase === 'porto') {
      const cobra = pedagio(this.level);
      if (this.cofre >= cobra) {
        this.cofre -= cobra;
        this.net.broadcast({ t: 'ev', e: 'pagou', v: cobra });
        this.comecaTrecho(this.level + 1);
      } else this.fim('pedagio');
    } else if (this.phase === 'fim') {
      this.novaViagem();
      this.net.broadcast({ t: 'ev', e: 'lobby' });
    }
  }

  comecaTrecho(n) {
    this.prepararRio(n);
    this.phase = 'rio';
    this.porto = null;
    this.net.broadcast({ t: 'ev', e: 'inicio', level: n });
  }

  fim(motivo) {
    this.phase = 'fim';
    this.stats.motivo = motivo;
    this.stats.trechos = motivo === 'pedagio' ? this.level : this.level - 1;
    this.net.broadcast({ t: 'ev', e: 'fim', motivo, stats: this.stats, level: this.level });
  }

  /* ---------- passo da simulação ---------- */
  tick(dt) {
    this.t += dt;
    const R = this.raft, rio = this.river;
    if (this.boiaCd > 0) this.boiaCd -= dt;

    if (this.roleta && this.t >= this.roleta.fim) {
      const r = this.roleta;
      const ganhou = ROLETA[r.casa] === r.cor;
      const premio = ganhou ? r.qt * PAGA[r.cor] : 0;
      this.cofre += premio;
      this.roleta = null;
      this.net.broadcast({ t: 'ev', e: 'roletaFim', ganhou, premio, qt: r.qt, name: r.name });
      this.confereProntos();
    }

    if (this.phase === 'rio') this.tickRio(dt);
    else if (this.phase === 'porto') {
      // encosta no cais da margem direita
      const tz = rio.len - 6, tx = rio.cx(tz) + rio.hw(tz) - HX - 1.7;
      R.vx = 0; R.vz = 0;
      R.x += (tx - R.x) * Math.min(1, dt * 1.5);
      R.z += (tz - R.z) * Math.min(1, dt * 1.5);
      R.water = Math.max(0, R.water - dt * 0.3);
    } else if (this.phase === 'afundou') {
      this.sunkT += dt;
      R.vz *= 1 - dt;
      R.z += R.vz * dt;
      if (this.sunkT > 4.5) this.fim('afundou');
    } else if (this.phase === 'lobby') {
      R.water = 0;
    }

    // itens soltos na correnteza
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.s !== 'w') continue;
      it.z += rio.current(it.z) * 0.72 * dt;
      it.x += rio.slope(it.z) * rio.current(it.z) * 0.72 * dt;
      const c = rio.cx(it.z), w = rio.hw(it.z) - 0.6;
      it.x = clamp(it.x, c - w, c + w);
      if (it.z < R.z - 70 || it.z > rio.len + 30) this.items.splice(i, 1);
    }

    this.snapT -= dt;
    if (this.snapT <= 0) {
      this.snapT = 1 / 15;
      this.net.broadcast(this.snapshot());
    }
  }

  tickRio(dt) {
    const R = this.raft, rio = this.river, up = this.up;
    R.hitCd = Math.max(0, R.hitCd - dt);
    const cur = rio.current(R.z);
    R.vz += (cur * 1.08 - R.vz) * Math.min(1, dt * 0.9);
    const flow = rio.slope(R.z + 6) * R.vz * 0.78;
    const vento = Math.sin(this.t * 0.37 + this.seed) * 0.35 * Math.min(this.level, 4) / 4;
    const steer = 2.9 * (1 + 0.35 * up.leme);
    const rud = this.lemeBy ? R.rudder : 0;
    R.vx += (flow + vento + rud * steer - R.vx) * Math.min(1, dt * 1.7);
    if (rio.inRapids(R.z) && this.rand() < dt * 0.9) {
      R.vx += (this.rand() - 0.5) * 3.5;
      this.net.broadcast({ t: 'ev', e: 'tranco', f: 0.35 });
    }
    R.x += R.vx * dt;
    R.z += R.vz * dt;

    // pedras
    for (const k of rio.rocks) {
      if (Math.abs(k.z - R.z) > HZ + 3) continue;
      const px = clamp(k.x, R.x - HX, R.x + HX), pz = clamp(k.z, R.z - HZ, R.z + HZ);
      let dx = k.x - px, dz = k.z - pz, d = Math.hypot(dx, dz);
      if (d >= k.r) continue;
      if (d < 1e-4) { dx = k.x > R.x ? 1 : -1; dz = 0; d = 1; }
      const nx = dx / d, nz = dz / d, pen = k.r - d;
      R.x -= nx * pen; R.z -= nz * pen;
      const vel = Math.hypot(R.vx, R.vz);
      if (Math.abs(nz) > Math.abs(nx)) { R.vz *= 0.25; R.vx += (R.x < k.x ? -1 : 1) * 2.2; } else R.vx = -nx * 2.6;
      const cd = this.rockCd.get(k.id) || 0;
      if (this.t > cd) {
        this.rockCd.set(k.id, this.t + 1.4);
        this.batida(vel > 4.6 ? 2 : 1, 1, k.x, k.z);
      }
    }
    // margens
    for (const oz of [-HZ, 0, HZ]) {
      const z = R.z + oz, c = rio.cx(z), w = rio.hw(z);
      // raspar devagar na margem não fura; bater de lado com força, sim
      if (R.x - HX < c - w) { const f = -R.vx; R.x = c - w + HX; R.vx = Math.max(0, f) * 0.35 + 0.6; if (f > 1.1) this.batidaMargem(); }
      else if (R.x + HX > c + w) { const f = R.vx; R.x = c + w - HX; R.vx = -Math.max(0, f) * 0.35 - 0.6; if (f > 1.1) this.batidaMargem(); }
    }

    // água entrando e saindo
    const carga = this.items.reduce((s, it) => s + (it.s === 'd' || it.s === 'c' ? LOOT[it.k].w : 0), 0);
    this.carga = carga;
    const entra = this.holes.length * 0.0125 * (1 + carga / 55) + (carga > 40 ? (carga - 40) * 0.0004 : 0);
    let bombas = 0;
    for (const p of this.players.values()) if (p.pump && p.m === 'deck') bombas++;
    const sai = Math.min(bombas, 2) * 0.052 * (1 + 0.5 * up.bomba) + 0.003;
    R.water = clamp(R.water + (entra - sai) * dt, 0, 1);
    if (R.water >= 1) return this.afunda();

    // jogadores que ficaram muito para trás
    for (const p of this.players.values()) {
      if (p.m !== 'water') continue;
      if (Math.hypot(p.x - R.x, p.z - R.z) > 40) {
        p.m = 'ghost';
        this.net.sendTo(p.id, { t: 'ev', e: 'perdido' });
        this.net.broadcast({ t: 'ev', e: 'aviso', txt: `${p.name} ficou pra trás! Volta no porto.` });
      }
    }

    // tesouros que ficaram para trás somem
    this.items = this.items.filter((it) => !(it.s === 'f' && it.z < R.z - 80));

    if (R.z >= rio.len - 26) this.chegaPorto();
  }

  batidaMargem() {
    if (this.raft.hitCd > 0) return;
    this.raft.hitCd = 1.6;
    this.batida(this.rand() < 0.55 ? 1 : 0, 0.6, this.raft.x, this.raft.z + HZ);
  }

  batida(furos, forca, x, z) {
    const casco = 1 - 0.3 * this.up.casco;
    let novos = 0;
    for (let i = 0; i < furos; i++) if (this.rand() < casco) { this.novoFuro(); novos++; }
    // o que está solto no convés (fora da área de carga) pode cair
    const rede = this.up.rede > 0;
    for (const it of this.items) {
      const naCarga = it.s === 'd' && it.z > 1.9;
      if (LOOT[it.k].fragil && (it.s === 'd' || it.s === 'c') && !(rede && naCarga)) this.quebra(it, 0.3 * forca);
      if (it.s === 'd' && !naCarga && this.rand() < 0.33 * forca) {
        const lado = it.x >= 0 ? 1 : -1;
        it.s = 'w';
        it.x = this.raft.x + lado * (HX + 0.8);
        it.z = this.raft.z + it.z;
        this.net.broadcast({ t: 'ev', e: 'splash', x: it.x, z: it.z, s: 0.7 });
      }
    }
    this.net.broadcast({ t: 'ev', e: 'batida', f: forca, furos: novos, x, z });
  }

  novoFuro() {
    if (this.holes.length >= 9) return;
    for (let t = 0; t < 12; t++) {
      const x = (this.rand() * 2 - 1) * (HX - 0.5), z = -2.7 + this.rand() * 4.3;
      const livre = Object.values(ESTACOES).every((s) => Math.hypot(s.x - x, s.z - z) > s.r + 0.6)
        && this.holes.every((h) => Math.hypot(h.x - x, h.z - z) > 0.9);
      if (livre) { this.holes.push({ id: this.holeId++, x: r2(x), z: r2(z) }); return; }
    }
  }

  afunda() {
    this.phase = 'afundou';
    this.sunkT = 0;
    for (const it of this.items) {
      if (it.s !== 'd' && it.s !== 'c') continue;
      const noConves = it.s === 'd';
      it.s = 'w';
      it.x = this.raft.x + (noConves ? it.x : (this.rand() - 0.5) * 3);
      it.z = this.raft.z + (noConves ? it.z : (this.rand() - 0.5) * 3);
      it.by = null;
    }
    this.net.broadcast({ t: 'ev', e: 'afundou' });
  }

  chegaPorto() {
    this.phase = 'porto';
    this.lemeBy = null;
    let vendido = 0;
    const lista = [];
    this.items = this.items.filter((it) => {
      const noBarco = it.s === 'd' || (it.s === 'c' && this.players.get(it.by)?.m !== 'water' && this.players.get(it.by)?.m !== 'ghost');
      if (!noBarco) return false;
      if (it.k === 'tabua') { this.planks++; return false; } // tábua que sobrou volta para a pilha
      vendido += it.v;
      lista.push({ k: it.k, v: it.v });
      if (!this.stats.melhor || it.v > this.stats.melhor.v) this.stats.melhor = { k: it.k, v: it.v };
      return false;
    });
    this.holes = [];
    this.cofre += vendido;
    this.stats.ganho += vendido;
    for (const p of this.players.values()) { p.ready = false; p.pump = false; }
    this.porto = { vendido, lista, pedagio: pedagio(this.level), level: this.level };
    this.net.broadcast({ t: 'ev', e: 'porto', ...this.porto });
  }

  /* ---------- o que vai para todo mundo ~15x por segundo ---------- */
  snapshot() {
    const R = this.raft;
    return {
      t: 'snap',
      ph: this.phase, lv: this.level, seed: this.seed, tm: r2(this.t),
      r: [r2(R.x), r2(R.z), r2(R.vx), r2(R.vz), Math.round(R.water * 1000) / 1000, r2(R.rudder)],
      h: this.holes.map((h) => [h.id, h.x, h.z]),
      i: this.items.map((it) => [it.id, it.k, it.s, r2(it.x), r2(it.z), it.v, it.by || 0]),
      p: [...this.players.values()].map((p) => [p.id, p.name, p.cor, p.m, r2(p.x), r2(p.y), r2(p.z), r2(p.ry), p.an, p.ready ? 1 : 0]),
      c: this.cofre, pl: this.planks, up: this.up, lm: this.lemeBy || 0, cg: Math.round(this.carga || 0),
      pd: pedagio(Math.max(1, this.level)), rl: this.roleta ? 1 : 0, bc: this.boiaCd > 0 ? 1 : 0,
      st: this.stats, po: this.porto,
    };
  }
}
