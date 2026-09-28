/* ============================================================
   FUNDIÇÃO 7 — simulação
   Sem DOM e sem three.js: roda igual no navegador e nos testes (node).
   A interface lê o estado e drena `game.ev` (eventos) a cada quadro.
   ============================================================ */
import {
  N, C, TICK, HUB_R, ERA_RADIUS, DX, DY, ITEMS, ORES, MACHINES, RECIPES, ERAS, MAX_ERA,
  BASE_POWER, UPGRADES, START_COINS, BELT_SPEED, BELT_GAP, MACHINE_CAP, OUT_CAP,
} from './data.js';

export const idx = (x, y) => y * N + x;
export const inGrid = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const isHubTile = (x, y) => Math.abs(x - C) <= HUB_R && Math.abs(y - C) <= HUB_R;

/* ---------- aleatório com semente ---------- */
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function randomSeed() {
  return (Math.random() * 1679616 | 0).toString(36).toUpperCase().padStart(4, '0');
}

/* ---------- geração da ilha ---------- */
// depósitos: tipo, era em que aparecem, quantos, tamanho e faixa de distância do centro
const PATCHES = [
  { ore: 'ferro',    era: 1, n: 2, size: 7, d: [3.2, 6.2] },
  { ore: 'cobre',    era: 1, n: 1, size: 7, d: [3.2, 6.2] },
  { ore: 'carvao',   era: 2, n: 2, size: 7, d: [7.2, 9.4] },
  { ore: 'ferro',    era: 2, n: 1, size: 8, d: [7.2, 9.4] },
  { ore: 'cobre',    era: 3, n: 1, size: 8, d: [10.2, 12.4] },
  { ore: 'ferro',    era: 3, n: 1, size: 8, d: [10.2, 12.4] },
  { ore: 'areia',    era: 4, n: 2, size: 8, d: [13.2, 15.4] },
  { ore: 'carvao',   era: 4, n: 1, size: 7, d: [13.2, 15.4] },
  { ore: 'petroleo', era: 5, n: 2, size: 6, d: [16.2, 18.4] },
  { ore: 'cobre',    era: 5, n: 1, size: 8, d: [16.2, 18.4] },
  { ore: 'titanio',  era: 6, n: 2, size: 8, d: [19.2, 21.4] },
  { ore: 'carvao',   era: 6, n: 1, size: 7, d: [19.2, 21.4] },
];

export function genWorld(seed) {
  const rnd = mulberry32(hashStr(String(seed)));
  // ruído suave: grade grossa interpolada
  const G = 8, S = N / G + 2;
  const coarse = Array.from({ length: S * S }, () => rnd() * 2 - 1);
  const cv = (i, j) => coarse[Math.min(S - 1, j) * S + Math.min(S - 1, i)];
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const fx = x / G, fy = y / G, i = Math.floor(fx), j = Math.floor(fy);
    const u = smooth(fx - i), v = smooth(fy - j);
    const a = cv(i, j) * (1 - u) + cv(i + 1, j) * u;
    const b = cv(i, j + 1) * (1 - u) + cv(i + 1, j + 1) * u;
    return a * (1 - v) + b * v;
  };

  const landEra = new Uint8Array(N * N).fill(99);
  const dist = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + 0.5 - C, y + 0.5 - C);
    dist[idx(x, y)] = d;
    const n = noise(x, y) * 1.4;
    for (let e = 1; e <= MAX_ERA; e++) {
      if (d <= ERA_RADIUS[e] + n || isHubTile(x, y) || (e === 1 && d <= 4)) { landEra[idx(x, y)] = e; break; }
    }
  }

  const ore = new Array(N * N).fill(null);
  const free = (x, y, e) => inGrid(x, y) && landEra[idx(x, y)] <= e && !ore[idx(x, y)] &&
    Math.max(Math.abs(x - C), Math.abs(y - C)) > HUB_R + 1;
  const nearOre = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (inGrid(x + dx, y + dy) && ore[idx(x + dx, y + dy)]) return true;
    }
    return false;
  };

  for (const P of PATCHES) {
    for (let k = 0; k < P.n; k++) {
      let placed = false;
      for (let tries = 0; tries < 400 && !placed; tries++) {
        const relax = tries > 250 ? 1.5 : 0;
        const ang = rnd() * Math.PI * 2;
        const r = P.d[0] - relax + rnd() * (P.d[1] - P.d[0] + relax * 2);
        const cx = Math.floor(C + Math.cos(ang) * r), cy = Math.floor(C + Math.sin(ang) * r);
        if (!free(cx, cy, P.era) || landEra[idx(cx, cy)] !== P.era && P.era > 1 && tries < 200) continue;
        if (nearOre(cx, cy)) continue;
        // cresce o depósito
        const cells = [[cx, cy]];
        ore[idx(cx, cy)] = P.ore;
        let guard = 0;
        while (cells.length < P.size && guard++ < 200) {
          const [bx, by] = cells[(rnd() * cells.length) | 0];
          const d = (rnd() * 4) | 0;
          const nx = bx + DX[d], ny = by + DY[d];
          if (!free(nx, ny, P.era)) continue;
          // não encosta em depósito de outro tipo
          let bad = false;
          for (let dy = -1; dy <= 1 && !bad; dy++) for (let dx = -1; dx <= 1; dx++) {
            const o = inGrid(nx + dx, ny + dy) ? ore[idx(nx + dx, ny + dy)] : null;
            if (o && o !== P.ore) { bad = true; break; }
          }
          if (bad) continue;
          ore[idx(nx, ny)] = P.ore;
          cells.push([nx, ny]);
        }
        placed = true;
      }
    }
  }

  // árvores de enfeite (somem quando você constrói em cima)
  const tree = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const x = i % N, y = (i / N) | 0;
    if (landEra[i] > MAX_ERA || ore[i] || Math.max(Math.abs(x - C), Math.abs(y - C)) <= 3) continue;
    const edge = dist[i] > ERA_RADIUS[landEra[i]] - 2.5;
    if (rnd() < (edge ? 0.22 : 0.07)) tree[i] = 1 + ((rnd() * 3) | 0);
  }
  return { landEra, ore, tree };
}

/* ---------- jogo ---------- */
const recipeById = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export { recipeById };

export class Game {
  constructor(seed = randomSeed()) {
    this.seed = String(seed);
    const w = genWorld(this.seed);
    this.landEra = w.landEra;
    this.ore = w.ore;
    this.tree = w.tree;
    this.era = 1;
    this.goal = 0;
    this.prog = {};                  // progresso do marco atual { item: n }
    this.coins = START_COINS;
    this.unlocked = new Set(ERAS[1].unlock);
    this.up = { esteiras: 0, maquinas: 0, minas: 0, vendas: 0 };
    this.ents = new Map();
    this.occ = new Int32Array(N * N);
    this.nextId = 1;
    this.produced = {};              // total produzido (minas contam minério extraído)
    this.delivered = {};             // total entregue na Sede
    this.pad = 0;
    this.time = 0;
    this.won = false;
    this.acc = 0;
    this.ev = [];
    this.power = { supply: 0, demand: 0, ratio: 1 };
    this.earnLog = [];               // [tempo, moedas] das entregas do último minuto
    this.revenue = 0;
    this.placeHub();
  }

  placeHub() {
    const e = { id: this.nextId++, type: 'sede', kind: 'hub', x: C, y: C, dir: 0 };
    this.ents.set(e.id, e);
    for (let y = C - HUB_R; y <= C + HUB_R; y++) for (let x = C - HUB_R; x <= C + HUB_R; x++) {
      this.occ[idx(x, y)] = e.id;
      this.tree[idx(x, y)] = 0;
    }
    this.hubId = e.id;
  }

  /* ---------- consultas ---------- */
  isLand(x, y) { return inGrid(x, y) && this.landEra[idx(x, y)] <= this.era; }
  oreAt(x, y) { return inGrid(x, y) && this.isLand(x, y) ? this.ore[idx(x, y)] : null; }
  entAt(x, y) { return inGrid(x, y) ? this.ents.get(this.occ[idx(x, y)]) || null : null; }
  get powerOn() { return this.era >= 2; }
  get goalDef() { return ERAS[this.era] && ERAS[this.era].goals[this.goal] || null; }
  count(type) { let n = 0; for (const e of this.ents.values()) if (e.type === type) n++; return n; }
  recipesFor(type) {
    return RECIPES.filter((r) => r.m === type && r.era <= this.era && this.unlocked.has(r.m));
  }
  upgradeMult(key) { return 1 + UPGRADES[key].per * this.up[key]; }

  canPlace(type, x, y) {
    const M = MACHINES[type];
    if (!M || M.kind === 'hub') return { ok: false, why: 'invalid' };
    if (!this.unlocked.has(type)) return { ok: false, why: 'locked' };
    if (!this.isLand(x, y)) return { ok: false, why: 'water' };
    const cur = this.entAt(x, y);
    if (cur) {
      if (type === 'esteira' && cur.type === 'esteira') return { ok: true, reorient: true };
      return { ok: false, why: 'occupied' };
    }
    if (M.unique && this.count(type) > 0) return { ok: false, why: 'unique' };
    if (M.kind === 'mine') {
      const o = this.oreAt(x, y);
      if (!o || !M.ores.includes(o)) return { ok: false, why: M.ores.includes('petroleo') ? 'needoil' : 'needore' };
    }
    if (this.coins < M.cost) return { ok: false, why: 'money' };
    return { ok: true };
  }

  place(type, x, y, dir = 0) {
    const c = this.canPlace(type, x, y);
    if (!c.ok) return null;
    if (c.reorient) {
      const b = this.entAt(x, y);
      if (b.dir !== dir) { b.dir = dir; this.ev.push({ t: 'rotate', id: b.id }); }
      return b;
    }
    const M = MACHINES[type];
    this.coins -= M.cost;
    const e = { id: this.nextId++, type, kind: M.kind, x, y, dir };
    this.initEnt(e);
    this.ents.set(e.id, e);
    this.occ[idx(x, y)] = e.id;
    const hadTree = this.tree[idx(x, y)];
    this.tree[idx(x, y)] = 0;
    this.ev.push({ t: 'place', id: e.id, tree: !!hadTree });
    return e;
  }

  initEnt(e) {
    switch (e.kind) {
      case 'belt': e.items = []; break;
      case 'splitter': e.buf = []; e.rr = 0; break;
      case 'cross': e.slots = [null, null]; break;
      case 'mine': e.prog = 0; e.outb = 0; e.item = ORES[this.ore[idx(e.x, e.y)]]; break;
      case 'machine': e.recipe = null; e.inb = {}; e.outb = 0; e.prog = 0; e.working = false; break;
      case 'generator': e.fuel = 0; e.burn = 0; break;
      case 'pad': e.count = 0; break;
    }
    e.st = 'ok';
  }

  remove(x, y) {
    const e = this.entAt(x, y);
    if (!e || e.kind === 'hub') return false;
    this.coins += MACHINES[e.type].cost;
    this.ents.delete(e.id);
    this.occ[idx(x, y)] = 0;
    this.ev.push({ t: 'remove', id: e.id, type: e.type, x, y });
    return true;
  }

  rotate(x, y, turns = 1) {
    const e = this.entAt(x, y);
    if (!e || e.kind === 'hub' || e.kind === 'pad' || e.kind === 'turbine') return false;
    e.dir = (e.dir + turns + 4) % 4;
    this.ev.push({ t: 'rotate', id: e.id });
    return true;
  }

  setRecipe(id, recipeId) {
    const e = this.ents.get(id);
    if (!e || e.kind !== 'machine') return false;
    if (recipeId && !this.recipesFor(e.type).some((r) => r.id === recipeId)) return false;
    if (e.recipe === recipeId) return true;
    e.recipe = recipeId || null;
    e.inb = {}; e.outb = 0; e.prog = 0; e.working = false;
    this.ev.push({ t: 'recipe', id });
    return true;
  }

  buyUpgrade(key) {
    const U = UPGRADES[key], lv = this.up[key];
    if (lv >= U.cost.length || this.era < U.minEra[lv] || this.coins < U.cost[lv]) return false;
    this.coins -= U.cost[lv];
    this.up[key]++;
    this.ev.push({ t: 'upgrade', key, lv: this.up[key] });
    return true;
  }

  /* ---------- transferência de itens ---------- */
  // md = direção em que o item está andando ao entrar nesta casa
  accept(e, it, md) {
    const from = (md + 2) % 4; // lado por onde entra
    switch (e.kind) {
      case 'belt': {
        if (from === e.dir) return false;
        const last = e.items[e.items.length - 1];
        if (last && last.p < BELT_GAP) return false;
        e.items.push({ it, p: 0 });
        return true;
      }
      case 'splitter':
        if (e.buf.length >= 2) return false;
        e.buf.push({ it, from, t: 0 });
        return true;
      case 'cross': {
        const a = md % 2;
        if (e.slots[a]) return false;
        e.slots[a] = { it, d: md, t: 0 };
        return true;
      }
      case 'machine': {
        if (from === e.dir) return false;
        let r = e.recipe && recipeById[e.recipe];
        if (!r) {
          r = this.recipesFor(e.type).find((q) => q.in[it]);
          if (!r) return false;
          e.recipe = r.id;
          this.ev.push({ t: 'recipe', id: e.id });
        }
        const need = r.in[it];
        if (!need) return false;
        const cap = Math.max(MACHINE_CAP, need * 3);
        if ((e.inb[it] || 0) >= cap) return false;
        e.inb[it] = (e.inb[it] || 0) + 1;
        return true;
      }
      case 'generator':
        if (it !== MACHINES[e.type].fuel || e.fuel >= 10) return false;
        e.fuel++;
        return true;
      case 'hub':
        this.deliver(it, false);
        return true;
      case 'pad':
        if (it !== 'peca_foguete') return false;
        e.count++;
        this.deliver(it, true);
        return true;
    }
    return false;
  }

  pushOut(e, it, d) {
    const x = e.x + DX[d], y = e.y + DY[d];
    const t = this.entAt(x, y);
    return t ? this.accept(t, it, d) : false;
  }

  deliver(it, atPad) {
    if (atPad) this.pad++;
    else {
      const v = Math.round(ITEMS[it].price * this.upgradeMult('vendas'));
      this.coins += v;
      if (v) this.earnLog.push([this.time, v]);
      this.delivered[it] = (this.delivered[it] || 0) + 1;
      this.ev.push({ t: 'deliver', it, v });
    }
    const g = this.goalDef;
    if (!g || this.won) return;
    if ((g.at === 'pad') !== atPad) return;
    if (!g.need[it] || (this.prog[it] || 0) >= g.need[it]) return;
    this.prog[it] = (this.prog[it] || 0) + 1;
    if (Object.keys(g.need).every((k) => (this.prog[k] || 0) >= g.need[k])) this.completeGoal();
  }

  completeGoal() {
    const g = this.goalDef;
    this.coins += g.reward;
    const unlocks = (g.unlock || []).filter((u) => !this.unlocked.has(u));
    unlocks.forEach((u) => this.unlocked.add(u));
    this.ev.push({ t: 'goal', era: this.era, goal: this.goal, reward: g.reward, unlocks });
    this.goal++;
    this.prog = {};
    if (this.goal < ERAS[this.era].goals.length) return;
    if (this.era < MAX_ERA) {
      this.era++;
      this.goal = 0;
      const E = ERAS[this.era];
      const eu = E.unlock.filter((u) => !this.unlocked.has(u));
      eu.forEach((u) => this.unlocked.add(u));
      this.ev.push({ t: 'era', era: this.era, unlocks: eu, ores: E.ores || [] });
    } else {
      this.won = true;
      this.ev.push({ t: 'victory' });
    }
  }

  /* ---------- simulação ---------- */
  update(dt) {
    this.acc += Math.min(dt, 0.5);
    while (this.acc >= TICK) { this.step(TICK); this.acc -= TICK; }
  }

  step(dt) {
    this.time += dt;
    const ents = this.ents;

    // quem quer trabalhar agora (para a conta de energia)
    let demand = 0;
    const wants = (e) => {
      if (e.kind === 'mine') return e.outb < OUT_CAP;
      if (e.kind === 'machine') {
        if (e.working) return true;
        const r = e.recipe && recipeById[e.recipe];
        return !!r && e.outb + r.q <= OUT_CAP && Object.keys(r.in).every((k) => (e.inb[k] || 0) >= r.in[k]);
      }
      return false;
    };
    const gens = [];
    let fixed = 0;
    for (const e of ents.values()) {
      e.want = wants(e);
      if (e.want) demand += MACHINES[e.type].pw || 0;
      if (e.kind === 'generator') gens.push(e);
      else if (e.kind === 'turbine') fixed += MACHINES[e.type].out;
    }
    let supply = 0, ratio = 1;
    if (this.powerOn) {
      supply = BASE_POWER + fixed;
      let need = demand - supply;
      for (const g of gens) {
        const G = MACHINES[g.type];
        g.on = false;
        if (need > 0 && (g.burn > 0 || g.fuel > 0)) {
          if (g.burn <= 0) { g.fuel--; g.burn = G.burn; }
          g.on = true;
          g.burn -= dt;
          supply += G.out;
          need -= G.out;
        }
        g.st = g.on ? 'ok' : (need > 0 && g.fuel <= 0 && g.burn <= 0 ? 'nofuel' : 'idle');
      }
      ratio = demand > 0 ? Math.min(1, supply / demand) : 1;
    } else {
      for (const g of gens) { g.on = false; g.st = 'idle'; }
    }
    this.power = { supply, demand, ratio };

    const mSpeed = this.upgradeMult('maquinas') * ratio;
    const mineSpeed = this.upgradeMult('minas') * ratio;

    for (const e of ents.values()) {
      switch (e.kind) {
        case 'mine': {
          const M = MACHINES[e.type];
          if (e.outb < OUT_CAP) {
            e.prog += dt * mineSpeed;
            if (e.prog >= M.time) {
              e.prog -= M.time;
              e.outb++;
              this.produced[e.item] = (this.produced[e.item] || 0) + 1;
              this.ev.push({ t: 'make', id: e.id });
            }
          }
          if (e.outb > 0 && this.pushOut(e, e.item, e.dir)) e.outb--;
          e.st = e.outb >= OUT_CAP ? 'blocked' : (this.powerOn && ratio < 0.6 ? 'nopower' : 'ok');
          break;
        }
        case 'machine': {
          const r = e.recipe && recipeById[e.recipe];
          if (!r) { e.st = 'idle'; break; }
          if (!e.working && e.outb + r.q <= OUT_CAP && Object.keys(r.in).every((k) => (e.inb[k] || 0) >= r.in[k])) {
            for (const k in r.in) e.inb[k] -= r.in[k];
            e.working = true;
            e.prog = 0;
          }
          if (e.working) {
            e.prog += dt * mSpeed;
            if (e.prog >= r.t) {
              e.working = false;
              e.prog = 0;
              e.outb += r.q;
              this.produced[r.out] = (this.produced[r.out] || 0) + r.q;
              this.ev.push({ t: 'make', id: e.id });
            }
          }
          if (e.outb > 0 && this.pushOut(e, r.out, e.dir)) e.outb--;
          if (e.working) e.st = this.powerOn && ratio < 0.6 ? 'nopower' : 'ok';
          else if (e.outb + r.q > OUT_CAP) e.st = 'blocked';
          else e.st = 'noinput';
          break;
        }
        case 'splitter': {
          for (let i = 0; i < e.buf.length; i++) {
            const b = e.buf[i];
            b.t += dt;
            if (b.t < 0.12) continue;
            for (let k = 0; k < 4; k++) {
              const d = (e.rr + k) % 4;
              if (d === b.from) continue;
              if (this.pushOut(e, b.it, d)) { e.rr = (d + 1) % 4; e.buf.splice(i, 1); i--; break; }
            }
          }
          break;
        }
        case 'cross': {
          for (let a = 0; a < 2; a++) {
            const s = e.slots[a];
            if (!s) continue;
            s.t += dt;
            if (s.t >= 0.15 && this.pushOut(e, s.it, s.d)) e.slots[a] = null;
          }
          break;
        }
      }
    }

    // esteiras por último: itens que acabaram de entrar só andam no próximo passo
    const bs = BELT_SPEED * this.upgradeMult('esteiras') * dt;
    for (const e of ents.values()) {
      if (e.kind !== 'belt' || !e.items.length) continue;
      const its = e.items;
      const f = its[0];
      f.p += bs;
      if (f.p >= 1) {
        if (this.pushOut(e, f.it, e.dir)) its.shift();
        else f.p = 1;
      }
      for (let i = its[0] === f ? 1 : 0; i < its.length; i++) {
        its[i].p = Math.min(its[i].p + bs, its[i - 1] ? its[i - 1].p - BELT_GAP : 1);
      }
    }

    // receita por minuto (janela de 60 s)
    while (this.earnLog.length && this.earnLog[0][0] < this.time - 60) this.earnLog.shift();
    let sum = 0;
    for (const [, v] of this.earnLog) sum += v;
    this.revenue = this.time < 60 ? sum * 60 / Math.max(this.time, 10) : sum;
  }

  /* ---------- dica do próximo passo ---------- */
  hint() {
    const g = this.goalDef;
    if (this.won || !g) return { k: 'hint_free' };
    if (g.at === 'pad' && this.count('plataforma') === 0) return { k: 'hint_build', p: { m: 'plataforma' } };
    if (this.powerOn && this.power.ratio < 0.75 && this.power.demand > 0) {
      if (this.count('gerador') === 0 && this.count('turbina') === 0) return { k: 'hint_power_build' };
      return { k: 'hint_power_more' };
    }
    for (const it of Object.keys(g.need)) {
      if ((this.prog[it] || 0) >= g.need[it]) continue;
      const h = this.hintFor(it, true, g.at === 'pad', 0);
      if (h) return h;
    }
    return { k: 'hint_scale' };
  }

  hintFor(it, isGoal, atPad, depth) {
    if (depth > 6) return null;
    const oreKey = Object.keys(ORES).find((k) => ORES[k] === it);
    if (oreKey) {
      const mineType = oreKey === 'petroleo' ? 'bomba' : 'mina';
      let hasMine = false;
      for (const e of this.ents.values()) if (e.kind === 'mine' && e.item === it) { hasMine = true; break; }
      if (!hasMine) {
        if (!this.unlocked.has(mineType)) return { k: 'hint_wait_unlock', p: { m: mineType } };
        return { k: 'hint_mine', p: { it, m: mineType }, at: this.nearestOre(oreKey) };
      }
      if (isGoal && !this.delivered[it]) return { k: 'hint_to_hub', p: { it }, at: [C, C] };
      return null;
    }
    const r = RECIPES.find((q) => q.out === it && q.era <= this.era && this.unlocked.has(q.m));
    if (!r) return null;
    const machines = [...this.ents.values()].filter((e) => e.type === r.m);
    if (!machines.length) return { k: 'hint_build', p: { m: r.m, it } };
    if (!this.produced[it]) {
      const hasRecipe = machines.some((e) => e.recipe === r.id);
      const free = machines.some((e) => !e.recipe);
      if (!hasRecipe && !free) return { k: 'hint_recipe', p: { m: r.m, it } };
      for (const inp of Object.keys(r.in)) {
        if (!this.produced[inp]) {
          const h = this.hintFor(inp, false, false, depth + 1);
          if (h) return h;
        }
      }
      return { k: 'hint_feed', p: { m: r.m, it: Object.keys(r.in)[0] } };
    }
    if (isGoal) {
      if (atPad && !this.pad) return { k: 'hint_to_pad', p: { it } };
      if (!atPad && !this.delivered[it]) return { k: 'hint_to_hub', p: { it }, at: [C, C] };
    }
    return null;
  }

  nearestOre(oreKey) {
    let best = null, bd = 1e9;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (this.oreAt(x, y) !== oreKey || this.entAt(x, y)) continue;
      const d = Math.abs(x - C) + Math.abs(y - C);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  }

  /* ---------- salvar / carregar ---------- */
  serialize() {
    const ents = [];
    for (const e of this.ents.values()) {
      if (e.kind === 'hub') continue;
      const o = { t: e.type, x: e.x, y: e.y, d: e.dir };
      if (e.kind === 'belt' && e.items.length) o.i = e.items.map((q) => [q.it, +q.p.toFixed(2)]);
      if (e.kind === 'machine') { o.r = e.recipe; o.ib = e.inb; o.ob = e.outb; }
      if (e.kind === 'mine') o.ob = e.outb;
      if (e.kind === 'generator') o.f = e.fuel;
      if (e.kind === 'pad') o.c = e.count;
      ents.push(o);
    }
    return {
      v: 1, seed: this.seed, era: this.era, goal: this.goal, prog: this.prog, coins: this.coins,
      unlocked: [...this.unlocked], up: this.up, produced: this.produced, delivered: this.delivered,
      pad: this.pad, time: Math.round(this.time), won: this.won, revenue: Math.round(this.revenue), ents,
    };
  }

  static load(o) {
    if (!o || o.v !== 1) throw new Error('save inválido');
    const g = new Game(o.seed);
    g.era = Math.min(MAX_ERA, Math.max(1, o.era | 0));
    g.goal = o.goal | 0;
    g.prog = o.prog || {};
    g.coins = +o.coins || 0;
    g.unlocked = new Set(o.unlocked || ERAS[1].unlock);
    Object.assign(g.up, o.up || {});
    g.produced = o.produced || {};
    g.delivered = o.delivered || {};
    g.pad = o.pad | 0;
    g.time = +o.time || 0;
    g.won = !!o.won;
    for (const s of o.ents || []) {
      if (!MACHINES[s.t] || !inGrid(s.x, s.y) || g.occ[idx(s.x, s.y)]) continue;
      const e = { id: g.nextId++, type: s.t, kind: MACHINES[s.t].kind, x: s.x, y: s.y, dir: s.d & 3 };
      g.initEnt(e);
      if (e.kind === 'belt' && s.i) e.items = s.i.filter((q) => ITEMS[q[0]]).map((q) => ({ it: q[0], p: q[1] }));
      if (e.kind === 'machine') { e.recipe = recipeById[s.r] ? s.r : null; e.inb = s.ib || {}; e.outb = s.ob | 0; }
      if (e.kind === 'mine') e.outb = s.ob | 0;
      if (e.kind === 'generator') e.fuel = s.f | 0;
      if (e.kind === 'pad') e.count = s.c | 0;
      g.ents.set(e.id, e);
      g.occ[idx(e.x, e.y)] = e.id;
      g.tree[idx(e.x, e.y)] = 0;
    }
    g.ev = [];
    return g;
  }
}
