/* ============================================================
   BALSA FURADA — números do jogo
   Balsa olha para +z (rio abaixo). x = lado, y = cima.
   Coordenadas "locais" = relativas ao centro da balsa.
   ============================================================ */

export const VERSAO = '1.0.0';
export const MAX_JOGADORES = 6;

export const RAFT = {
  W: 5,            // largura (x)
  L: 7,            // comprimento (z)
  DECK_Y: 0.42,    // altura do convés com a balsa vazia
  CARGA_Z: 1.9,    // de lz > CARGA_Z até a frente é a área de carga (protegida)
};

// estações fixas no convés (posição local)
export const ESTACOES = {
  leme: { x: 0, z: -3.05, r: 0.45, nome: 'Leme' },
  bomba: { x: -1.75, z: -1.1, r: 0.4, nome: 'Bomba d’água' },
  tabuas: { x: 1.75, z: -2.45, r: 0.45, nome: 'Pilha de tábuas' },
  boia: { x: 2.1, z: 0.4, r: 0.3, nome: 'Boia' },
};

export const LOOT = {
  garrafa: { nome: 'Garrafa com bilhete', v: 15, w: 1, cor: '#6fd49a', peso: 5 },
  caixote: { nome: 'Caixote', v: 30, w: 4, cor: '#c98a4b', peso: 5 },
  barril: { nome: 'Barril', v: 45, w: 6, cor: '#a0612f', peso: 4 },
  vaso: { nome: 'Vaso antigo', v: 85, w: 3, cor: '#4d8dff', peso: 3, fragil: true },
  bau: { nome: 'Baú', v: 140, w: 14, cor: '#8a5a2b', peso: 2, pesado: true },
  idolo: { nome: 'Ídolo dourado', v: 230, w: 8, cor: '#ffc400', peso: 1, fragil: true },
  tabua: { nome: 'Tábua', v: 0, w: 1, cor: '#d9a066', peso: 0, ferramenta: true },
};

export const MELHORIAS = [
  { id: 'tabuas', nome: 'Feixe de tábuas', desc: '+4 tábuas para tapar furos', preco: 35, max: 99 },
  { id: 'bomba', nome: 'Bomba turbo', desc: 'Bombeia 50% mais rápido', preco: 120, max: 2 },
  { id: 'casco', nome: 'Casco reforçado', desc: '30% menos furos nas batidas', preco: 150, max: 2 },
  { id: 'leme', nome: 'Leme comprido', desc: 'Curva 35% mais forte', preco: 90, max: 2 },
  { id: 'rede', nome: 'Rede na carga', desc: 'Nada cai nem quebra na área de carga', preco: 110, max: 1 },
  { id: 'boia', nome: 'Corda longa', desc: 'A boia alcança 50% mais longe', preco: 60, max: 1 },
];

export const NOMES_TRECHO = ['Rio Manso', 'Corredeira do Sapo', 'Curva do Defunto', 'Garganta Seca',
  'Remanso Escuro', 'Pedral da Onça', 'Volta do Cachimbo', 'Estreito das Almas'];

// pedágio cobrado pelo Barqueiro para seguir depois do porto do trecho n
export const pedagio = (n) => Math.round(90 * Math.pow(1.38, n - 1) / 10) * 10;

// roleta de 15 casas: 7 vermelhas, 7 pretas, 1 verde (a casa 0)
export const ROLETA = Array.from({ length: 15 }, (_, i) => (i === 0 ? 'verde' : i % 2 ? 'vermelho' : 'preto'));
export const PAGA = { vermelho: 2, preto: 2, verde: 14 };

export const CORES = ['#ff5a4e', '#4d8dff', '#3ccf7a', '#ffd23f', '#8a7dff', '#ff9f1a', '#ff7ac8', '#2ed3c8'];

// momentos do dia por trecho (ciclo)
export const CEUS = [
  { nome: 'manhã', ceu: '#9fd8f7', nevoa: '#cdeefc', sol: '#fff1d6', hemi: '#e8f6ff', chao: '#6f9a5c', agua: '#3aa7c9', luz: 2.2, noite: 0 },
  { nome: 'meio-dia', ceu: '#7fcaf5', nevoa: '#bfe9ff', sol: '#ffffff', hemi: '#eef8ff', chao: '#76a35f', agua: '#34a2d0', luz: 2.5, noite: 0 },
  { nome: 'tarde', ceu: '#f7c68b', nevoa: '#f5d7ae', sol: '#ffd29a', hemi: '#ffe7c7', chao: '#7a8f55', agua: '#3f98b5', luz: 2.0, noite: 0.1 },
  { nome: 'pôr do sol', ceu: '#f08a6c', nevoa: '#d7837a', sol: '#ff9a5c', hemi: '#ffc2a8', chao: '#5b5a48', agua: '#35708f', luz: 1.5, noite: 0.4 },
  { nome: 'noite', ceu: '#101a38', nevoa: '#1a2748', sol: '#9db2ff', hemi: '#5a6aa8', chao: '#20283f', agua: '#1d4a78', luz: 0.7, noite: 1 },
];

// gerador de números aleatórios com semente (todos geram o mesmo rio)
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
