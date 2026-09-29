/* ============================================================
   BALSA FURADA — modelos 3D feitos por código
   Cada peça estática = partes coladas numa malha só, com cor por
   vértice. Só o que mexe (leme, alavanca, bonecos) fica separado.
   ============================================================ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { RAFT, ESTACOES } from './data.js';

const tmpC = new THREE.Color();
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

export const toyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02 });
export const flatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });

function paint(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  tmpC.set(color);
  for (let i = 0; i < n; i++) { c[i * 3] = tmpC.r; c[i * 3 + 1] = tmpC.g; c[i * 3 + 2] = tmpC.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
// peça posicionada: {x,y,z, rx,ry,rz, s:[sx,sy,sz]}
function P(geo, color, o = {}) {
  const g = paint(geo, color);
  tmpE.set(o.rx || 0, o.ry || 0, o.rz || 0);
  tmpQ.setFromEuler(tmpE);
  const s = o.s || [1, 1, 1];
  tmpM.compose(new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0), tmpQ, new THREE.Vector3(s[0], s[1], s[2]));
  g.applyMatrix4(tmpM);
  return g;
}
const rb = (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const cyl = (rt, rbm, h, seg = 14) => new THREE.CylinderGeometry(rt, rbm, h, seg);
const cone = (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg);
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const tor = (r, t, rs = 6, ts = 16) => new THREE.TorusGeometry(r, t, rs, ts);
export function merge(parts) {
  const g = mergeGeometries(parts, false);
  g.computeBoundingSphere();
  return g;
}
export const mesh = (geo, mat = toyMat, sombra = true) => {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = sombra;
  m.receiveShadow = true;
  return m;
};

/* ---------- a balsa ---------- */
export function makeRaft() {
  const g = new THREE.Group();
  const { W, L, DECK_Y } = RAFT;
  const parts = [];
  const n = 7, r = W / n / 2;
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + r + i * r * 2;
    const tom = ['#b77b45', '#a86f3c', '#c08650'][i % 3];
    parts.push(P(cyl(r * 0.98, r * 0.98, L, 10), tom, { x, y: DECK_Y - r, rx: Math.PI / 2 }));
    parts.push(P(cyl(r * 0.7, r * 0.7, 0.04, 10), '#e0b27a', { x, y: DECK_Y - r, z: L / 2 + 0.01, rx: Math.PI / 2 }));
    parts.push(P(cyl(r * 0.7, r * 0.7, 0.04, 10), '#e0b27a', { x, y: DECK_Y - r, z: -L / 2 - 0.01, rx: Math.PI / 2 }));
  }
  // amarras de corda
  for (const z of [-2.7, -0.2, 2.5]) parts.push(P(rb(W + 0.08, 0.12, 0.16, 0.05), '#e9d7a8', { y: DECK_Y - 0.02, z }));
  // área de carga: cerquinha de corda na frente
  const cz = RAFT.CARGA_Z;
  for (const [x, z] of [[-W / 2 + 0.15, cz], [W / 2 - 0.15, cz], [-W / 2 + 0.15, L / 2 - 0.15], [W / 2 - 0.15, L / 2 - 0.15], [0, L / 2 - 0.15]]) {
    parts.push(P(cyl(0.06, 0.07, 0.62, 8), '#8a5a2b', { x, y: DECK_Y + 0.31, z }));
  }
  parts.push(P(cyl(0.025, 0.025, W - 0.3, 6), '#f0e0b0', { y: DECK_Y + 0.5, z: L / 2 - 0.15, rz: Math.PI / 2 }));
  parts.push(P(cyl(0.025, 0.025, L / 2 - cz, 6), '#f0e0b0', { x: -W / 2 + 0.15, y: DECK_Y + 0.5, z: (cz + L / 2) / 2, rx: Math.PI / 2 }));
  parts.push(P(cyl(0.025, 0.025, L / 2 - cz, 6), '#f0e0b0', { x: W / 2 - 0.15, y: DECK_Y + 0.5, z: (cz + L / 2) / 2, rx: Math.PI / 2 }));
  // faixa amarela no chão marcando a área de carga
  parts.push(P(rb(W - 0.3, 0.02, 0.12, 0.01), '#ffd23f', { y: DECK_Y + 0.01, z: cz }));

  // bomba d'água (a alavanca mexe)
  const B = ESTACOES.bomba;
  parts.push(P(rb(0.5, 0.7, 0.5, 0.06), '#4d8dff', { x: B.x, y: DECK_Y + 0.35, z: B.z }));
  parts.push(P(cyl(0.07, 0.07, 0.9, 8), '#8fa2c0', { x: B.x - 0.35, y: DECK_Y + 0.35, z: B.z, rz: Math.PI / 2 }));
  parts.push(P(cyl(0.09, 0.07, 0.14, 8), '#8fa2c0', { x: B.x - 0.82, y: DECK_Y + 0.3, z: B.z }));

  // pilha de tábuas
  const T = ESTACOES.tabuas;
  for (let i = 0; i < 5; i++) parts.push(P(rb(0.9, 0.07, 0.24, 0.02), i % 2 ? '#d9a066' : '#c98f55', { x: T.x, y: DECK_Y + 0.04 + i * 0.075, z: T.z + (i % 2 ? 0.08 : -0.08), ry: (i % 3) * 0.1 }));

  // poste da boia
  const Bo = ESTACOES.boia;
  parts.push(P(cyl(0.06, 0.07, 1.1, 8), '#8a5a2b', { x: Bo.x, y: DECK_Y + 0.55, z: Bo.z }));
  parts.push(P(cyl(0.05, 0.05, 0.4, 6), '#8a5a2b', { x: Bo.x, y: DECK_Y + 0.95, z: Bo.z - 0.18, rx: Math.PI / 2 }));

  // poste do lampião
  parts.push(P(cyl(0.05, 0.06, 1.6, 8), '#6b4524', { x: -W / 2 + 0.2, y: DECK_Y + 0.8, z: -1.9 }));
  parts.push(P(rb(0.22, 0.28, 0.22, 0.04), '#3a2a1a', { x: -W / 2 + 0.2, y: DECK_Y + 1.62, z: -1.9 }));

  // suporte do leme
  const Lm = ESTACOES.leme;
  parts.push(P(cyl(0.09, 0.11, 0.5, 8), '#6b4524', { x: Lm.x, y: DECK_Y + 0.25, z: Lm.z - 0.2 }));
  const base = mesh(merge(parts));
  g.add(base);

  // leme (gira)
  const leme = new THREE.Group();
  leme.position.set(Lm.x, DECK_Y + 0.5, Lm.z - 0.2);
  leme.add(mesh(merge([
    P(cyl(0.05, 0.05, 2.6, 8), '#8a5a2b', { z: -0.9, y: -0.2, rx: Math.PI / 2 - 0.15 }),
    P(rb(0.08, 0.7, 0.9, 0.03), '#a86f3c', { z: -2.1, y: -0.45, rx: -0.15 }),
    P(cyl(0.06, 0.06, 0.3, 8), '#e9d7a8', { z: 0.35, y: 0.02, rx: Math.PI / 2 }),
  ])));
  g.add(leme);

  // alavanca da bomba
  const alavanca = new THREE.Group();
  alavanca.position.set(B.x, DECK_Y + 0.72, B.z);
  alavanca.add(mesh(merge([
    P(cyl(0.04, 0.04, 0.9, 8), '#ffd23f', { x: 0.3, rz: Math.PI / 2 }),
    P(sph(0.08), '#ff5a4e', { x: 0.75 }),
  ])));
  g.add(alavanca);

  // boia pendurada
  const boia = mesh(merge([
    P(tor(0.28, 0.09, 8, 18), '#ff5a4e'),
    ...[0, 1, 2, 3].map((i) => P(cyl(0.1, 0.1, 0.18, 8), '#ffffff', { x: Math.cos(i * Math.PI / 2 + 0.78) * 0.28, y: Math.sin(i * Math.PI / 2 + 0.78) * 0.28, rz: i * Math.PI / 2 + 0.78 })),
  ]));
  boia.position.set(Bo.x + 0.05, DECK_Y + 0.72, Bo.z - 0.36);
  boia.rotation.y = Math.PI / 2;
  g.add(boia);

  // lampião
  const luzLamp = new THREE.PointLight('#ffb347', 0, 12, 1.6);
  luzLamp.position.set(-W / 2 + 0.2, DECK_Y + 1.62, -1.9);
  const vidro = mesh(sph(0.1), new THREE.MeshBasicMaterial({ color: '#ffcf70' }), false);
  vidro.position.copy(luzLamp.position);
  g.add(luzLamp, vidro);

  // água dentro da balsa
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, L - 0.1), new THREE.MeshStandardMaterial({ color: '#4fb7e0', transparent: true, opacity: 0, roughness: 0.1 }));
  agua.rotation.x = -Math.PI / 2;
  agua.position.y = DECK_Y + 0.02;
  agua.renderOrder = 2;
  g.add(agua);

  return { g, leme, alavanca, boia, agua, luzLamp, vidro };
}

/* ---------- furo no convés ---------- */
const furoGeo = merge([
  P(cyl(0.3, 0.3, 0.03, 12), '#2a1a0e', { y: 0.005 }),
  ...[0, 1, 2, 3, 4].map((i) => P(rb(0.16, 0.04, 0.05, 0.01), '#e0b27a', { x: Math.cos(i * 1.26) * 0.3, z: Math.sin(i * 1.26) * 0.3, y: 0.02, ry: -i * 1.26 + 0.4, rz: 0.3 })),
]);
export function makeHole() {
  const g = new THREE.Group();
  g.add(mesh(furoGeo, toyMat, false));
  const jato = mesh(cone(0.12, 0.35, 8), new THREE.MeshStandardMaterial({ color: '#bfeaff', transparent: true, opacity: 0.8 }), false);
  jato.position.y = 0.18;
  g.add(jato);
  g.userData.jato = jato;
  return g;
}

/* ---------- boneco ---------- */
const corpoGeo = new THREE.CapsuleGeometry(0.3, 0.42, 6, 14);
export function makePlayer(cor) {
  const g = new THREE.Group();
  const corpo = new THREE.Group();
  g.add(corpo);
  const mat = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.55 });
  const b = mesh(corpoGeo, mat);
  b.position.y = 0.6;
  corpo.add(b);
  const rosto = mesh(merge([
    P(sph(0.075, 10, 8), '#ffffff', { x: -0.11, y: 0.8, z: 0.26 }),
    P(sph(0.075, 10, 8), '#ffffff', { x: 0.11, y: 0.8, z: 0.26 }),
    P(sph(0.04, 8, 6), '#1b2033', { x: -0.11, y: 0.8, z: 0.325 }),
    P(sph(0.04, 8, 6), '#1b2033', { x: 0.11, y: 0.8, z: 0.325 }),
  ]), toyMat, false);
  corpo.add(rosto);
  // chapéu de palha
  const chapeu = mesh(merge([
    P(cyl(0.46, 0.46, 0.04, 18), '#f2d27a', { y: 1.1 }),
    P(cyl(0.2, 0.25, 0.22, 14), '#e8c35e', { y: 1.21 }),
    P(cyl(0.255, 0.255, 0.06, 14), '#ff5a4e', { y: 1.15 }),
  ]));
  corpo.add(chapeu);
  // mãos
  const maoMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(cor).multiplyScalar(0.8), roughness: 0.6 });
  const maoE = mesh(sph(0.1, 10, 8), maoMat), maoD = mesh(sph(0.1, 10, 8), maoMat);
  maoE.position.set(-0.36, 0.52, 0.08);
  maoD.position.set(0.36, 0.52, 0.08);
  corpo.add(maoE, maoD);
  // onde o item carregado fica
  const mao = new THREE.Group();
  mao.position.set(0, 0.95, 0.42);
  corpo.add(mao);
  return { g, corpo, chapeu, maoE, maoD, mao, mat };
}

// plaquinha com o nome em cima da cabeça
export function makeLabel(texto, cor) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = '600 34px Fredoka, sans-serif';
  const w = Math.min(248, x.measureText(texto).width + 30);
  x.fillStyle = 'rgba(20,24,40,.62)';
  x.beginPath();
  x.roundRect((256 - w) / 2, 8, w, 48, 22);
  x.fill();
  x.fillStyle = cor;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(texto, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.4, 1);
  s.renderOrder = 10;
  return s;
}

/* ---------- tesouros ---------- */
const ITEM_GEO = {};
function itemGeo(k) {
  if (ITEM_GEO[k]) return ITEM_GEO[k];
  let parts;
  switch (k) {
    case 'garrafa': parts = [
      P(cyl(0.12, 0.12, 0.34, 12), '#4fbf7f', { y: 0.17 }), P(cyl(0.05, 0.1, 0.12, 10), '#4fbf7f', { y: 0.4 }),
      P(cyl(0.045, 0.045, 0.06, 8), '#b77b45', { y: 0.49 }), P(rb(0.1, 0.16, 0.02, 0.01), '#fff3d0', { y: 0.18, z: 0.05 })]; break;
    case 'caixote': parts = [
      P(rb(0.56, 0.5, 0.56, 0.03), '#c98a4b', { y: 0.25 }),
      P(rb(0.6, 0.08, 0.6, 0.02), '#a86f3c', { y: 0.47 }), P(rb(0.6, 0.08, 0.6, 0.02), '#a86f3c', { y: 0.04 }),
      P(rb(0.08, 0.5, 0.6, 0.02), '#a86f3c', { x: 0, y: 0.25, ry: 0.78 })]; break;
    case 'barril': parts = [
      P(cyl(0.3, 0.3, 0.7, 14), '#a0612f', { y: 0.35 }), P(cyl(0.33, 0.33, 0.62, 14), '#b8753c', { y: 0.35, s: [1, 0.72, 1] }),
      P(cyl(0.335, 0.335, 0.05, 14), '#555c66', { y: 0.16 }), P(cyl(0.335, 0.335, 0.05, 14), '#555c66', { y: 0.54 })]; break;
    case 'vaso': {
      const pts = [[0.0, 0], [0.18, 0], [0.26, 0.12], [0.28, 0.28], [0.18, 0.46], [0.12, 0.55], [0.17, 0.62]].map(([x, y]) => new THREE.Vector2(x, y));
      parts = [P(new THREE.LatheGeometry(pts, 14), '#4d8dff'), P(cyl(0.285, 0.285, 0.06, 14), '#ffd23f', { y: 0.28 })]; break;
    }
    case 'bau': parts = [
      P(rb(0.9, 0.5, 0.6, 0.04), '#8a5a2b', { y: 0.25 }), P(cyl(0.3, 0.3, 0.9, 14), '#9c6a36', { y: 0.5, rz: Math.PI / 2 }),
      P(rb(0.94, 0.07, 0.64, 0.02), '#ffc400', { y: 0.5 }), P(rb(0.14, 0.18, 0.06, 0.02), '#ffc400', { y: 0.46, z: 0.32 }),
      P(rb(0.07, 0.8, 0.64, 0.02), '#ffc400', { x: -0.3, y: 0.4 }), P(rb(0.07, 0.8, 0.64, 0.02), '#ffc400', { x: 0.3, y: 0.4 })]; break;
    case 'idolo': parts = [
      P(rb(0.3, 0.1, 0.3, 0.02), '#d9a400', { y: 0.05 }), P(rb(0.24, 0.34, 0.2, 0.05), '#ffc400', { y: 0.27 }),
      P(sph(0.15), '#ffd23f', { y: 0.52 }), P(cone(0.1, 0.16, 8), '#ffc400', { y: 0.7 }),
      P(sph(0.035, 8, 6), '#ff5a4e', { x: -0.05, y: 0.54, z: 0.13 }), P(sph(0.035, 8, 6), '#ff5a4e', { x: 0.05, y: 0.54, z: 0.13 })]; break;
    case 'tabua': parts = [P(rb(1.0, 0.07, 0.26, 0.02), '#d9a066', { y: 0.04 }), P(rb(0.06, 0.075, 0.26, 0.01), '#b77b45', { x: 0.3, y: 0.04 })]; break;
    default: parts = [P(rb(0.4, 0.4, 0.4), '#ff00ff', { y: 0.2 })];
  }
  ITEM_GEO[k] = merge(parts);
  return ITEM_GEO[k];
}
export function makeItem(k) {
  const g = new THREE.Group();
  const m = mesh(itemGeo(k));
  g.add(m);
  if (k === 'idolo') {
    const brilho = new THREE.PointLight('#ffd23f', 1.2, 4, 2);
    brilho.position.y = 0.5;
    g.add(brilho);
  }
  return g;
}

/* ---------- natureza ---------- */
export const rockGeo = (() => {
  const g = new THREE.DodecahedronGeometry(1, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setY(i, y * (y > 0 ? 0.75 : 1.3));
    p.setX(i, p.getX(i) * (1 + Math.sin(i * 1.7) * 0.08));
  }
  g.computeVertexNormals();
  return paint(g, '#8e8f95');
})();
export const trunkGeo = paint(cyl(0.14, 0.2, 1.4, 7).translate(0, 0.7, 0), '#7a4f2a');
export const pineGeo = merge([P(cone(1.1, 1.8, 8), '#2f8f4e', { y: 1.9 }), P(cone(0.85, 1.5, 8), '#38a35a', { y: 2.7 }), P(cone(0.55, 1.1, 8), '#44b566', { y: 3.4 })]);
export const bushGeo = merge([P(new THREE.IcosahedronGeometry(1.2, 0), '#4caf5b', { y: 2.1 }), P(new THREE.IcosahedronGeometry(0.8, 0), '#5cc26a', { y: 2.9, x: 0.3 })]);
export const reedGeo = merge([0, 1, 2].map((i) => P(cyl(0.02, 0.03, 1.1, 5), '#7fae4a', { x: (i - 1) * 0.12, y: 0.55, rz: (i - 1) * 0.15 })).concat(
  [0, 2].map((i) => P(cyl(0.05, 0.05, 0.22, 6), '#7a4f2a', { x: (i - 1) * 0.2, y: 1.12, rz: (i - 1) * 0.15 }))));

/* ---------- porto (cais + barraca da roleta + barqueiro) ---------- */
export function makeDock(comBarraca) {
  const g = new THREE.Group();
  const parts = [];
  // plataforma: de x=0 (beira) até x=6 (terra), z de -7 a 7
  for (let i = 0; i < 14; i++) parts.push(P(rb(6.5, 0.14, 0.95, 0.03), i % 2 ? '#b98552' : '#a8763f', { x: 3, y: 0.62, z: -6.5 + i }));
  for (const z of [-6.8, -3.4, 0, 3.4, 6.8]) for (const x of [0.2, 3, 5.8]) parts.push(P(cyl(0.14, 0.16, 2.6, 8), '#6b4524', { x, y: -0.5, z }));
  for (const z of [-6.8, 6.8]) parts.push(P(cyl(0.16, 0.16, 1.3, 8), '#6b4524', { x: 0.2, y: 1.1, z }), P(tor(0.18, 0.05, 6, 12), '#e9d7a8', { x: 0.2, y: 1.3, z, rx: Math.PI / 2 }));
  if (comBarraca) {
    // barraca
    parts.push(P(rb(3.2, 2.2, 3.2, 0.05), '#e8d0a0', { x: 4.4, y: 1.8, z: 3.6 }));
    parts.push(P(cone(2.7, 1.4, 4), '#ff5a4e', { x: 4.4, y: 3.6, z: 3.6, ry: Math.PI / 4 }));
    parts.push(P(rb(1.1, 1.5, 0.08, 0.02), '#5a3a1a', { x: 3.2, y: 1.45, z: 2.0 }));
    parts.push(P(rb(0.2, 1.0, 3.2, 0.03), '#ffd23f', { x: 2.78, y: 1.3, z: 3.6 }));
    // pilha de caixas do comerciante
    parts.push(P(rb(0.7, 0.7, 0.7, 0.03), '#c98a4b', { x: 5, y: 1.04, z: -2 }), P(rb(0.6, 0.6, 0.6, 0.03), '#b77b45', { x: 5.1, y: 1.69, z: -2.1, ry: 0.4 }));
    parts.push(P(cyl(0.3, 0.3, 0.7, 12), '#a0612f', { x: 4.2, y: 1.04, z: -3.2 }));
    // lampiões
    for (const z of [-5, 5]) parts.push(P(cyl(0.06, 0.07, 2.2, 8), '#3a2a1a', { x: 0.6, y: 1.8, z }), P(rb(0.26, 0.32, 0.26, 0.04), '#3a2a1a', { x: 0.6, y: 2.95, z }));
  }
  g.add(mesh(merge(parts)));
  if (comBarraca) {
    // placa da roleta
    const c = document.createElement('canvas');
    c.width = 512; c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#27304a'; x.fillRect(0, 0, 512, 160);
    x.strokeStyle = '#ffd23f'; x.lineWidth = 10; x.strokeRect(8, 8, 496, 144);
    x.fillStyle = '#ffd23f'; x.font = '700 70px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('ROLETA', 256, 70);
    x.font = '600 30px Fredoka, sans-serif'; x.fillStyle = '#fff'; x.fillText('do Barqueiro', 256, 126);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    placa.position.set(2.75, 3.1, 3.6);
    placa.rotation.y = -Math.PI / 2;
    g.add(placa);
    // o barqueiro
    const b = makePlayer('#3a3f55');
    b.chapeu.visible = false;
    const cartola = mesh(merge([P(cyl(0.42, 0.42, 0.04, 16), '#1b1d26', { y: 1.1 }), P(cyl(0.24, 0.24, 0.5, 14), '#1b1d26', { y: 1.35 }), P(cyl(0.245, 0.245, 0.08, 14), '#8a7dff', { y: 1.16 })]));
    const barba = mesh(merge([P(sph(0.26, 12, 8), '#e8e8ee', { y: 0.55, z: 0.14, s: [1, 0.8, 0.7] })]));
    b.corpo.add(cartola, barba);
    b.g.position.set(2.2, 0.69, 0.5);
    b.g.rotation.y = -Math.PI / 2;
    g.add(b.g);
    g.userData.barqueiro = b;
    for (const z of [-5, 5]) {
      const l = new THREE.PointLight('#ffb347', 0, 14, 1.5);
      l.position.set(0.6, 2.95, z);
      g.add(l);
      (g.userData.luzes ||= []).push(l);
    }
  }
  return g;
}

// geometrias compartilhadas não são descartadas quando o cenário troca
for (const g of [rockGeo, trunkGeo, pineGeo, bushGeo, reedGeo, corpoGeo, furoGeo]) g.userData.keep = true;
