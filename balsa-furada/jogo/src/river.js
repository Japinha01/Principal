/* ============================================================
   BALSA FURADA — o rio de cada trecho
   Tudo sai da semente: quem entra na sala gera o mesmo rio,
   então pela rede só passa o que muda (balsa, itens, furos).
   ============================================================ */
import { rng, clamp, smooth, LOOT } from './data.js';

export function makeRiver(seed, level) {
  const R = rng(seed);
  const len = 520 + Math.min(level - 1, 8) * 45;
  const amp = [5 + R() * 5 + Math.min(level, 6) * 0.6, 2 + R() * 3, 0.8 + R() * 1.4];
  const frq = [0.008 + R() * 0.005, 0.021 + R() * 0.01, 0.05 + R() * 0.02];
  const ph = [R() * 6.28, R() * 6.28, R() * 6.28, R() * 6.28];
  const larg = 10.5 - Math.min(level - 1, 6) * 0.35;

  // nas pontas (porto de saída e de chegada) o rio fica reto e largo
  const calmo = (z) => smooth(10, 60, z) * smooth(len + 10, len - 70, z);
  const cx = (z) => calmo(z) * (amp[0] * Math.sin(z * frq[0] + ph[0]) + amp[1] * Math.sin(z * frq[1] + ph[1]) + amp[2] * Math.sin(z * frq[2] + ph[2]));
  const hw = (z) => {
    const k = calmo(z);
    return (1 - k) * 12 + k * Math.max(6.2, larg + 2.6 * Math.sin(z * 0.013 + ph[3]) + 1.2 * Math.sin(z * 0.041 + ph[1]));
  };
  const slope = (z) => (cx(z + 1) - cx(z - 1)) / 2;

  // corredeiras: trechos com correnteza forte
  const rapids = [];
  if (level >= 2) {
    const n = Math.min(1 + Math.floor(level / 2), 4);
    for (let i = 0; i < n; i++) {
      const z0 = 90 + ((len - 200) / n) * i + R() * 40;
      rapids.push([z0, z0 + 35 + R() * 30]);
    }
  }
  const inRapids = (z) => rapids.some(([a, b]) => z > a && z < b);
  const base = 3.7 + Math.min(level - 1, 7) * 0.22;
  const current = (z) => {
    let c = base;
    for (const [a, b] of rapids) c *= 1 + 0.65 * smooth(a - 6, a + 6, z) * smooth(b + 6, b - 6, z);
    return c * (0.35 + 0.65 * smooth(len + 4, len - 40, z));
  };

  // pedras no meio do rio, sempre deixando passagem para a balsa
  const rocks = [];
  let z = 55;
  const gapMin = 6.8 - Math.min(level, 5) * 0.12;
  while (z < len - 45) {
    const step = Math.max(5, 16 - level * 1.3 - R() * 6) * (inRapids(z) ? 0.7 : 1);
    z += step;
    const w = hw(z), c = cx(z);
    const tries = R() < 0.35 + level * 0.05 ? 2 : 1;
    const row = [];
    for (let t = 0; t < tries; t++) {
      const r = 0.7 + R() * 1.1;
      const x = c + (R() * 2 - 1) * (w - 0.6);
      row.push({ x, z: z + (R() - 0.5) * 3, r });
    }
    // confere se sobra um vão livre
    const ivs = row.map((k) => [k.x - k.r, k.x + k.r]).concat([[-1e9, c - w], [c + w, 1e9]]).sort((a, b) => a[0] - b[0]);
    let gap = 0, end = -1e9;
    for (const [a, b] of ivs) { if (a > end) gap = Math.max(gap, a - end); end = Math.max(end, b); }
    if (gap >= gapMin) for (const k of row) rocks.push({ id: rocks.length, ...k });
  }

  // tesouros boiando (presos em galhos, parados até alguém pegar)
  const pesos = Object.entries(LOOT).filter(([, d]) => d.peso > 0).map(([k, d]) => [k, d.peso + (k === 'idolo' || k === 'vaso' ? level * 0.35 : 0)]);
  const soma = pesos.reduce((s, [, p]) => s + p, 0);
  const sorteia = () => { let r = R() * soma; for (const [k, p] of pesos) if ((r -= p) <= 0) return k; return 'caixote'; };
  const loot = [];
  const nLoot = 13 + level * 2;
  for (let i = 0; i < nLoot; i++) {
    const lz = 45 + ((len - 90) / nLoot) * (i + R());
    const w = hw(lz);
    let lx = cx(lz) + (R() * 2 - 1) * (w - 1.2);
    // alguns tesouros ficam bem colados numa pedra (mais arriscado)
    if (R() < 0.3 && rocks.length) {
      const k = rocks[Math.floor(R() * rocks.length)];
      if (Math.abs(k.z - lz) < 60) { lx = k.x + (R() < 0.5 ? -1 : 1) * (k.r + 0.9); }
    }
    loot.push({ kind: sorteia(), x: clamp(lx, cx(lz) - w + 0.8, cx(lz) + w - 0.8), z: lz });
  }

  // árvores e pedras de margem (só visual)
  const trees = [];
  for (let tz = -60; tz < len + 110; tz += 2.2) {
    for (const side of [-1, 1]) {
      if (R() < 0.55) continue;
      const d = 2.5 + Math.pow(R(), 1.6) * 38;
      trees.push({ x: cx(tz) + side * (hw(tz) + d), z: tz + R() * 2, s: 0.7 + R() * 0.8, k: R() });
    }
  }

  return { seed, level, len, cx, hw, slope, current, rapids, inRapids, rocks, loot, trees };
}

// altura do terreno das margens (e do fundo do rio)
export function groundY(river, x, z) {
  const d = Math.abs(x - river.cx(z)) - river.hw(z);
  if (d < 0) return -1.6 + Math.max(0, d + 2) * 0.35;
  const h = Math.min(0.25 + d * 0.45, 2.2 + d * 0.05);
  const ruido = Math.sin(x * 0.21 + z * 0.13) * 0.6 + Math.sin(x * 0.07 - z * 0.19) * 1.1;
  return h + Math.max(0, d - 6) * 0.06 * (2 + ruido);
}
