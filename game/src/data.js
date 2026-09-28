/* ============================================================
   FUNDIÇÃO 7 — dados do jogo
   Tudo que define conteúdo e equilíbrio mora aqui: itens, máquinas,
   receitas, eras, marcos e melhorias. A simulação só lê estes dados.
   ============================================================ */

export const N = 48;              // tamanho da grade (N x N)
export const C = 24;              // centro da ilha
export const TICK = 0.05;         // passo fixo da simulação (s)
export const HUB_R = 1;           // a Sede ocupa C-1..C+1 (3x3)

// raio da ilha em cada era (índice = era)
export const ERA_RADIUS = [0, 7, 10, 13, 16, 19, 22];

// direções: 0 = +x, 1 = +y, 2 = -x, 3 = -y
export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];

/* ---------- itens ----------
   shape: forma do brinquedo 3D; price: quanto a Sede paga */
export const ITEMS = {
  minerio_ferro:  { shape: 'rock',   color: '#b9825a', price: 1 },
  minerio_cobre:  { shape: 'rock',   color: '#f08a3c', price: 1 },
  carvao:         { shape: 'rock',   color: '#3d3f4a', price: 1 },
  areia:          { shape: 'pile',   color: '#f2d37a', price: 1 },
  petroleo:       { shape: 'barrel', color: '#4a3b6b', price: 2 },
  minerio_titanio:{ shape: 'rock',   color: '#9fc4e8', price: 3 },
  barra_ferro:    { shape: 'bar',    color: '#c9d2dc', price: 3 },
  barra_cobre:    { shape: 'bar',    color: '#ff9b4a', price: 3 },
  vidro:          { shape: 'pane',   color: '#8fe3f5', price: 6 },
  chapa:          { shape: 'plate',  color: '#dfe7ef', price: 6 },
  engrenagem:     { shape: 'gear',   color: '#aab6c3', price: 6 },
  fio:            { shape: 'coil',   color: '#ffb35c', price: 3 },
  motor:          { shape: 'motor',  color: '#5b8def', price: 30 },
  circuito:       { shape: 'chip',   color: '#3ccf7a', price: 40 },
  plastico:       { shape: 'ball',   color: '#ff6fa8', price: 12 },
  robo:           { shape: 'robot',  color: '#ffd23f', price: 250 },
  lingote_ti:     { shape: 'bar',    color: '#e8f3ff', price: 25 },
  chapa_ti:       { shape: 'plate',  color: '#b8d8ff', price: 45 },
  peca_foguete:   { shape: 'cone',   color: '#ff5a4e', price: 0 },
};

// minério de cada depósito do mapa
export const ORES = {
  ferro:   'minerio_ferro',
  cobre:   'minerio_cobre',
  carvao:  'carvao',
  areia:   'areia',
  petroleo:'petroleo',
  titanio: 'minerio_titanio',
};

/* ---------- máquinas ----------
   cost: moedas; pw: MW que consome trabalhando; era: quando libera
   kind: mine | belt | splitter | cross | machine | generator | turbine | hub | pad
   Todas saem pela frente (dir) e aceitam insumos pelos outros lados. */
export const MACHINES = {
  esteira:     { kind: 'belt',      cost: 1,    key: '1', color: '#5f6b7a' },
  mina:        { kind: 'mine',      cost: 15,   key: '2', pw: 2,  time: 1.2, color: '#ffb000', ores: ['ferro', 'cobre', 'carvao', 'areia', 'titanio'] },
  fornalha:    { kind: 'machine',   cost: 30,   key: '3', pw: 3,  color: '#ff6b4a' },
  divisor:     { kind: 'splitter',  cost: 8,    key: '4', color: '#8a7dff' },
  cruzamento:  { kind: 'cross',     cost: 8,    key: '5', color: '#4ac6ff' },
  prensa:      { kind: 'machine',   cost: 80,   key: '6', pw: 4,  color: '#b46bff' },
  torno:       { kind: 'machine',   cost: 80,   key: '7', pw: 4,  color: '#4fd18b' },
  gerador:     { kind: 'generator', cost: 100,  key: '8', color: '#39c5b8', fuel: 'carvao', burn: 4, out: 25 },
  trefiladora: { kind: 'machine',   cost: 150,  key: '9', pw: 3,  color: '#ff9f43' },
  montadora:   { kind: 'machine',   cost: 250,  key: '0', pw: 6,  color: '#4d8dff' },
  mina2:       { kind: 'mine',      cost: 300,  key: 'M', pw: 5,  time: 0.5, color: '#ffd23f', ores: ['ferro', 'cobre', 'carvao', 'areia', 'titanio'] },
  turbina:     { kind: 'turbine',   cost: 400,  key: 'T', color: '#e9f1f7', out: 12 },
  bomba:       { kind: 'mine',      cost: 500,  key: 'B', pw: 5,  time: 1.0, color: '#7a5cff', ores: ['petroleo'] },
  refinaria:   { kind: 'machine',   cost: 700,  key: 'N', pw: 8,  color: '#ff5fa2' },
  fabrica:     { kind: 'machine',   cost: 1200, key: 'F', pw: 12, color: '#ffc93c' },
  inducao:     { kind: 'machine',   cost: 1500, key: 'I', pw: 15, color: '#5ad8ff' },
  plataforma:  { kind: 'pad',       cost: 0,    key: 'P', color: '#ff5a4e', unique: true },
  sede:        { kind: 'hub',       cost: 0,    color: '#ffffff' },
};

// ordem da barra de construção
export const BUILD_ORDER = ['esteira', 'mina', 'fornalha', 'divisor', 'cruzamento', 'prensa', 'torno', 'gerador',
  'trefiladora', 'montadora', 'mina2', 'turbina', 'bomba', 'refinaria', 'fabrica', 'inducao', 'plataforma'];

// grupos da barra de construção
export const BUILD_GROUPS = [
  { id: 'logistica', items: ['esteira', 'divisor', 'cruzamento'] },
  { id: 'extracao',  items: ['mina', 'mina2', 'bomba'] },
  { id: 'producao',  items: ['fornalha', 'prensa', 'torno', 'trefiladora', 'montadora', 'refinaria', 'fabrica', 'inducao'] },
  { id: 'energia',   items: ['gerador', 'turbina'] },
  { id: 'especial',  items: ['plataforma'] },
];

/* ---------- receitas ----------
   era: a partir de qual era a receita existe (a máquina também precisa estar liberada) */
export const RECIPES = [
  { id: 'barra_ferro', m: 'fornalha',    in: { minerio_ferro: 1 },                    out: 'barra_ferro', q: 1, t: 1.6, era: 1 },
  { id: 'barra_cobre', m: 'fornalha',    in: { minerio_cobre: 1 },                    out: 'barra_cobre', q: 1, t: 1.6, era: 1 },
  { id: 'vidro',       m: 'fornalha',    in: { areia: 2 },                            out: 'vidro',       q: 1, t: 2.4, era: 4 },
  { id: 'chapa',       m: 'prensa',      in: { barra_ferro: 1 },                      out: 'chapa',       q: 1, t: 2.0, era: 2 },
  { id: 'chapa_ti',    m: 'prensa',      in: { lingote_ti: 1 },                       out: 'chapa_ti',    q: 1, t: 2.5, era: 6 },
  { id: 'engrenagem',  m: 'torno',       in: { barra_ferro: 1 },                      out: 'engrenagem',  q: 1, t: 2.0, era: 2 },
  { id: 'fio',         m: 'trefiladora', in: { barra_cobre: 1 },                      out: 'fio',         q: 2, t: 1.5, era: 3 },
  { id: 'motor',       m: 'montadora',   in: { engrenagem: 2, chapa: 1 },             out: 'motor',       q: 1, t: 4.0, era: 3 },
  { id: 'circuito',    m: 'montadora',   in: { fio: 3, vidro: 1 },                    out: 'circuito',    q: 1, t: 4.0, era: 4 },
  { id: 'plastico',    m: 'refinaria',   in: { petroleo: 2 },                         out: 'plastico',    q: 1, t: 2.5, era: 5 },
  { id: 'robo',        m: 'fabrica',     in: { motor: 1, circuito: 1, plastico: 2 },  out: 'robo',        q: 1, t: 6.0, era: 5 },
  { id: 'lingote_ti',  m: 'inducao',     in: { minerio_titanio: 2, carvao: 1 },       out: 'lingote_ti',  q: 1, t: 4.0, era: 6 },
  { id: 'peca_foguete',m: 'fabrica',     in: { chapa_ti: 2, circuito: 2, motor: 1 },  out: 'peca_foguete',q: 1, t: 8.0, era: 6 },
];

/* ---------- eras e marcos ----------
   Cada era tem 3 marcos. Entregar os itens na Sede (ou na Plataforma, quando at='pad')
   completa o marco, paga a recompensa e libera máquinas. O último marco abre a próxima era. */
export const ERAS = [
  null,
  { // 1 — Primeira faísca
    unlock: ['esteira', 'mina'],
    ores: ['ferro', 'cobre'],
    goals: [
      { need: { minerio_ferro: 10 }, reward: 50,  unlock: ['fornalha'] },
      { need: { barra_ferro: 20 },   reward: 100, unlock: ['divisor', 'cruzamento'] },
      { need: { barra_ferro: 40, barra_cobre: 20 }, reward: 150 },
    ],
  },
  { // 2 — Oficina
    unlock: ['prensa', 'torno', 'gerador'],
    ores: ['carvao'],
    power: true,
    goals: [
      { need: { chapa: 30 },                   reward: 200 },
      { need: { engrenagem: 30 },              reward: 250 },
      { need: { chapa: 50, engrenagem: 50 },   reward: 400 },
    ],
  },
  { // 3 — Motores
    unlock: ['trefiladora', 'montadora', 'mina2'],
    goals: [
      { need: { fio: 50 },                     reward: 400 },
      { need: { motor: 10 },                   reward: 600 },
      { need: { motor: 30, fio: 60 },          reward: 900 },
    ],
  },
  { // 4 — Eletrônica
    unlock: ['turbina'],
    ores: ['areia'],
    goals: [
      { need: { vidro: 30 },                   reward: 800 },
      { need: { circuito: 15 },                reward: 1200 },
      { need: { circuito: 40, motor: 20 },     reward: 1800 },
    ],
  },
  { // 5 — Petróleo e robôs
    unlock: ['bomba', 'refinaria', 'fabrica'],
    ores: ['petroleo'],
    goals: [
      { need: { plastico: 40 },                reward: 2000 },
      { need: { robo: 5 },                     reward: 3000 },
      { need: { robo: 20 },                    reward: 5000 },
    ],
  },
  { // 6 — Rumo às estrelas
    unlock: ['inducao', 'plataforma'],
    ores: ['titanio'],
    goals: [
      { need: { lingote_ti: 30 },              reward: 5000 },
      { need: { chapa_ti: 30 },                reward: 8000 },
      { need: { peca_foguete: 20 }, at: 'pad', reward: 0 },
    ],
  },
];
export const MAX_ERA = ERAS.length - 1;

// rede base que chega junto com a energia (era 2) — cobre uma fábrica típica da era 1
export const BASE_POWER = 20;

/* ---------- melhorias (compradas com moedas) ----------
   nível n custa cost[n] e exige era >= minEra[n] */
export const UPGRADES = {
  esteiras: { per: 0.25, cost: [150, 600, 2000, 6000], minEra: [2, 3, 4, 5] },
  maquinas: { per: 0.20, cost: [300, 1200, 4000, 10000], minEra: [2, 3, 4, 5] },
  minas:    { per: 0.25, cost: [200, 800, 3000, 8000], minEra: [2, 3, 4, 5] },
  vendas:   { per: 0.15, cost: [500, 2000, 6000, 15000], minEra: [2, 3, 4, 5] },
};

export const START_COINS = 60;
export const BELT_SPEED = 2.0;     // tiles por segundo
export const BELT_GAP = 0.5;       // distância mínima entre itens na esteira
export const MACHINE_CAP = 8;      // estoque de cada insumo numa máquina
export const OUT_CAP = 6;          // estoque de saída de uma máquina
