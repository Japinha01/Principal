/* ============================================================
   BALSA FURADA — o seu marujo
   Cada jogador calcula o próprio movimento (fica sem atraso) e
   manda a posição para o anfitrião. No convés a posição é local
   (relativa à balsa); na água é a posição no mundo.
   ============================================================ */
import { RAFT, ESTACOES, LOOT, clamp } from './data.js';

const HX = RAFT.W / 2, HZ = RAFT.L / 2;
// obstáculos no convés (círculos): estações e o poste do leme
const OBST = [
  { x: ESTACOES.bomba.x, z: ESTACOES.bomba.z, r: 0.38 },
  { x: ESTACOES.tabuas.x, z: ESTACOES.tabuas.z, r: 0.5 },
  { x: ESTACOES.boia.x, z: ESTACOES.boia.z, r: 0.18 },
  { x: ESTACOES.leme.x, z: ESTACOES.leme.z - 0.2, r: 0.2 },
];
export const SPAWN = [[-1, 0.4], [1, 0.4], [0, -0.8], [-1, -1.9], [1, -1.3], [0, 1.2]];

export class Marujo {
  constructor() { this.reset(0); }

  reset(i) {
    const s = SPAWN[i % SPAWN.length];
    this.m = 'deck';
    this.x = s[0]; this.z = s[1]; this.y = 0; this.vy = 0;
    this.kx = 0; this.kz = 0;
    this.ry = 0;
    this.an = 0;
    this.moving = false;
  }

  // posição no mundo (para câmera, alcance de itens etc.)
  world(raft) {
    if (this.m === 'water' || this.m === 'ghost') return { x: this.x, z: this.z };
    return { x: raft.x + this.x, z: raft.z + this.z };
  }

  caiNaAgua(raft) {
    this.x = raft.x + this.x;
    this.z = raft.z + this.z;
    this.m = 'water';
    this.vy = 0;
    this.y = 0;
  }

  sobe(raft) {
    this.x = clamp(this.x - raft.x, -HX + 0.4, HX - 0.4);
    this.z = clamp(this.z - raft.z, -HZ + 0.4, HZ - 0.4);
    this.m = 'deck';
    this.y = 0.3;
    this.vy = 2;
    this.kx = this.kz = 0;
  }

  empurrao(dx, dz, forca = 7) {
    if (this.m === 'leme') this.m = 'deck';
    this.kx += dx * forca;
    this.kz += dz * forca;
    if (this.m === 'deck') this.vy = Math.max(this.vy, 3.5);
  }

  // in: { f, s (frente/lado -1..1), run, jump }, yaw da câmera
  // ctx: { raft, river, others: [{x,z,m}], pesado }
  update(dt, inp, yaw, ctx) {
    const { raft, river } = ctx;
    const eventos = [];
    // direção pedida em relação à câmera
    // frente da câmera = (sen, cos); direita = (-cos, sen)
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let dx = fx * inp.f - fz * inp.s;
    let dz = fz * inp.f + fx * inp.s;
    const len = Math.hypot(dx, dz);
    if (len > 1) { dx /= len; dz /= len; }
    this.moving = len > 0.1;
    const amort = Math.exp(-dt * 4);
    this.kx *= amort; this.kz *= amort;

    if (this.m === 'leme') {
      this.x = ESTACOES.leme.x; this.z = ESTACOES.leme.z + 0.45; this.y = 0;
      this.ry = 0;
      this.an = 4;
      return eventos;
    }

    if (this.m === 'deck') {
      const vel = (inp.run ? 5.6 : 3.8) * (ctx.pesado ? 0.58 : 1);
      this.x += (dx * vel + this.kx) * dt;
      this.z += (dz * vel + this.kz) * dt;
      // pulo e gravidade (a altura é relativa ao convés)
      if (inp.jump && this.y <= 0.001) { this.vy = 5.4; eventos.push('pulo'); }
      this.vy -= 16 * dt;
      this.y = Math.max(0, this.y + this.vy * dt);
      if (this.y === 0) this.vy = 0;
      // obstáculos
      for (const o of OBST) {
        const ox = this.x - o.x, oz = this.z - o.z, d = Math.hypot(ox, oz), min = o.r + 0.3;
        if (d < min && d > 1e-4) { this.x = o.x + ox / d * min; this.z = o.z + oz / d * min; }
      }
      // outros marujos no convés
      for (const q of ctx.others) {
        if (q.m !== 'deck' && q.m !== 'leme') continue;
        const ox = this.x - q.x, oz = this.z - q.z, d = Math.hypot(ox, oz);
        if (d < 0.62 && d > 1e-4) { this.x = q.x + ox / d * 0.62; this.z = q.z + oz / d * 0.62; }
      }
      // a área de carga tem corda em volta: dali ninguém cai
      if (this.z > RAFT.CARGA_Z + 0.1) {
        this.x = clamp(this.x, -HX + 0.35, HX - 0.35);
        this.z = Math.min(this.z, HZ - 0.35);
      }
      if (this.moving) this.ry = turn(this.ry, Math.atan2(dx, dz), dt * 12);
      this.an = this.moving && this.y === 0 ? 1 : 0;
      // saiu da balsa? cai no rio
      if (Math.abs(this.x) > HX + 0.05 || Math.abs(this.z) > HZ + 0.05) {
        this.caiNaAgua(raft);
        eventos.push('caiu');
      }
      return eventos;
    }

    if (this.m === 'water') {
      const cur = river.current(this.z);
      const vel = 2.3 * (ctx.pesado ? 0.7 : 1);
      this.x += (dx * vel + this.kx + river.slope(this.z) * cur * 0.85) * dt;
      this.z += (dz * vel + this.kz + cur * 0.85) * dt;
      const c = river.cx(this.z), w = river.hw(this.z) - 0.35;
      this.x = clamp(this.x, c - w, c + w);
      for (const k of river.rocks) {
        if (Math.abs(k.z - this.z) > 4) continue;
        const ox = this.x - k.x, oz = this.z - k.z, d = Math.hypot(ox, oz), min = k.r + 0.35;
        if (d < min && d > 1e-4) { this.x = k.x + ox / d * min; this.z = k.z + oz / d * min; }
      }
      // a balsa empurra quem está embaixo dela
      const lx = this.x - raft.x, lz = this.z - raft.z;
      if (Math.abs(lx) < HX + 0.3 && Math.abs(lz) < HZ + 0.3) {
        const px = HX + 0.3 - Math.abs(lx), pz = HZ + 0.3 - Math.abs(lz);
        if (px < pz) this.x = raft.x + Math.sign(lx || 1) * (HX + 0.3); else this.z = raft.z + Math.sign(lz || 1) * (HZ + 0.3);
      }
      if (this.moving) this.ry = turn(this.ry, Math.atan2(dx, dz), dt * 8);
      this.an = 2;
      // subir de volta: perto da borda + espaço
      const bx = Math.max(Math.abs(this.x - raft.x) - HX, 0), bz = Math.max(Math.abs(this.z - raft.z) - HZ, 0);
      this.pertoDaBalsa = Math.hypot(bx, bz) < 0.9;
      if (this.pertoDaBalsa && inp.jump) { this.sobe(raft); eventos.push('subiu'); }
      return eventos;
    }

    // fantasma: acompanha a balsa de longe
    this.x = raft.x; this.z = raft.z - 4;
    this.an = 0;
    return eventos;
  }
}

function turn(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}

export const pesa = (k) => !!(LOOT[k] && LOOT[k].pesado);
