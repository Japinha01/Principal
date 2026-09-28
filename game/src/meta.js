/* ============================================================
   FUNDIÇÃO 7 — progresso que atravessa as ilhas
   Engrenagens de Ouro, legado (bônus permanentes), conquistas e totais.
   Fica guardado à parte do save da ilha, então "Nova ilha" não apaga.
   ============================================================ */
import { LEGACY, GEARS, DECOS, MACHINES } from './data.js';
import { cleanLegacy } from './sim.js';

export const META_KEY = 'f7-meta-v1';

// cada conquista: ícone + condição (lida a cada segundo com a ilha atual e o meta)
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
const countKinds = (g, pred) => { let n = 0; for (const e of g.ents.values()) if (pred(e)) n++; return n; };
const FACTORY = Object.keys(MACHINES).filter((m) => !['sede', 'plataforma'].includes(m) && MACHINES[m].kind !== 'deco');
export const ACHIEVEMENTS = [
  { id: 'primeira_mina', ico: '⛏️', check: (g) => countKinds(g, (e) => e.kind === 'mine') > 0 },
  { id: 'primeira_barra', ico: '🔥', check: (g) => (g.produced.barra_ferro || 0) > 0 },
  { id: 'era3', ico: '⚙️', check: (g) => g.era >= 3 },
  { id: 'era5', ico: '🛢️', check: (g) => g.era >= 5 },
  { id: 'foguete', ico: '🚀', check: (g, m) => g.won || m.launches > 0 },
  { id: 'velocista', ico: '⏱️', check: (g) => g.won && g.stats.wonAt != null && g.stats.wonAt <= 45 * 60 },
  { id: 'foguetes5', ico: '🌌', check: (g, m) => m.launches >= 5 },
  { id: 'esteiras100', ico: '🛤️', check: (g) => g.count('esteira') >= 100 },
  { id: 'esteiras500', ico: '🗺️', check: (g) => g.count('esteira') >= 500 },
  { id: 'turbinas20', ico: '🌬️', check: (g) => g.count('turbina') >= 20 },
  { id: 'folga', ico: '🔋', check: (g) => g.power.demand >= 100 && g.power.supply >= 2 * g.power.demand },
  { id: 'todas', ico: '🏭', check: (g) => FACTORY.every((m) => g.count(m) > 0) },
  { id: 'itens10k', ico: '📦', check: (g) => sum(g.produced) >= 10000 },
  { id: 'robos100', ico: '🤖', check: (g) => (g.delivered.robo || 0) >= 100 },
  { id: 'milhao', ico: '💰', check: (g) => g.coins >= 1e6 },
  { id: 'contratos10', ico: '📜', check: (g, m) => m.contracts >= 10 },
  { id: 'relampago', ico: '⚡', check: (g) => g.stats.fastContract },
  { id: 'decorador', ico: '🌷', check: (g) => countKinds(g, (e) => e.kind === 'deco') >= 15 },
  { id: 'fotografo', ico: '📸', check: (g, m) => m.photos > 0 },
  { id: 'fogos', ico: '🎆', check: (g, m) => m.fireworks > 0 },
  { id: 'legado', ico: '✨', check: (g, m) => sum(m.legacy) >= 5 },
  { id: 'nova_ilha', ico: '🏝️', check: (g, m) => m.islands >= 2 },
];

export function freshMeta() {
  return { gears: 0, legacy: cleanLegacy(), ach: [], launches: 0, contracts: 0, islands: 1, photos: 0, fireworks: 0, gearsEarned: 0 };
}

export class Meta {
  constructor(storage) {
    this.storage = storage;
    let s = null;
    try { s = JSON.parse(storage && storage.getItem(META_KEY) || 'null'); } catch (e) { /* sem storage */ }
    this.load(s);
  }
  // troca todo o progresso (save importado); ignora campos estranhos
  load(s) {
    this.d = freshMeta();
    if (!s || typeof s !== 'object') return;
    for (const k of Object.keys(this.d)) if (typeof s[k] === 'number' && s[k] >= 0) this.d[k] = s[k];
    this.d.legacy = cleanLegacy(s.legacy);
    this.d.ach = Array.isArray(s.ach) ? s.ach.filter((id) => ACHIEVEMENTS.some((a) => a.id === id)) : [];
  }
  save() { try { this.storage && this.storage.setItem(META_KEY, JSON.stringify(this.d)); } catch (e) { /* ok */ } }
  get gears() { return this.d.gears; }
  get legacy() { return this.d.legacy; }
  addGears(n) { if (n > 0) { this.d.gears += n; this.d.gearsEarned += n; this.save(); } }

  // eventos da ilha que valem no meta; devolve as engrenagens ganhas
  onEvent(e) {
    let g = 0;
    if (e.t === 'victory' || e.t === 'launch') { this.d.launches++; g += e.gears || 0; }
    if (e.t === 'contract') { this.d.contracts++; g += e.c.gear || 0; }
    if (g) this.addGears(g); else if (e.t === 'contract') this.save();
    return g;
  }
  bump(key) { this.d[key] = (this.d[key] || 0) + 1; this.save(); }

  // confere conquistas novas; devolve as que acabaram de ser ganhas
  checkAchievements(game) {
    const got = [];
    for (const a of ACHIEVEMENTS) {
      if (this.d.ach.includes(a.id)) continue;
      let ok = false;
      try { ok = a.check(game, this.d); } catch (err) { ok = false; }
      if (ok) { this.d.ach.push(a.id); got.push(a); }
    }
    if (got.length) this.addGears(got.length * GEARS.achievement);
    return got;
  }

  legacyCost(key) { const L = LEGACY[key], lv = this.d.legacy[key]; return lv < L.cost.length ? L.cost[lv] : null; }
  buyLegacy(key) {
    const c = this.legacyCost(key);
    if (c == null || this.d.gears < c) return false;
    this.d.gears -= c;
    this.d.legacy[key]++;
    this.save();
    return true;
  }
  newIsland() { this.d.islands++; this.save(); }
}

export { DECOS };
