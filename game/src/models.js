/* ============================================================
   FUNDIÇÃO 7 — modelos 3D estilo brinquedo, feitos por código
   Cada máquina = uma malha estática (partes coladas com cores por vértice)
   + poucas partes animadas. Tudo modelado olhando para +x (a saída).
   ============================================================ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { ITEMS } from './data.js';

const tmpC = new THREE.Color();
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

export const toyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.02 });

/* ---------- peças básicas ---------- */
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
const rb = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const cyl = (rt, rbm, h, seg = 16) => new THREE.CylinderGeometry(rt, rbm, h, seg);
const cone = (r, h, seg = 14) => new THREE.ConeGeometry(r, h, seg);
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const tor = (r, t, rs = 8, ts = 18) => new THREE.TorusGeometry(r, t, rs, ts);
export function merge(parts) {
  const g = mergeGeometries(parts, false);
  g.computeBoundingSphere();
  return g;
}
const mesh = (geo, mat = toyMat) => {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const darker = (hex, k = 0.72) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

/* ---------- base + seta da saída (todas as máquinas com direção) ---------- */
function arrowGeo(color) {
  const s = new THREE.Shape();
  s.moveTo(0.42, 0); s.lineTo(0.26, 0.11); s.lineTo(0.26, -0.11); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  g.translate(0, 0.175, 0);
  return paint(g, color);
}
function base(color, h = 0.14) {
  return [P(rb(0.92, h, 0.92, 0.05), darker(color, 0.55), { y: h / 2 }), arrowGeo('#fff6d8')];
}

/* ---------- construtores de máquinas ----------
   cada um devolve { stat: [geo], parts: [{geo, name, pos}] } — geometria em cache por tipo */
const BUILD = {
  mina(c = '#ffb000', two = false) {
    const stat = [...base(c),
      P(rb(0.62, 0.38, 0.62), c, { y: 0.33 }),
      P(rb(0.52, 0.08, 0.52), darker(c, 0.85), { y: 0.55 }),
      P(rb(0.2, 0.16, 0.3), '#6b7a8a', { x: 0.36, y: 0.24 }),
      P(cyl(0.035, 0.035, 0.5, 8), '#56606c', { x: -0.14, y: 0.8, z: -0.2, rx: 0.25 }),
      P(cyl(0.035, 0.035, 0.5, 8), '#56606c', { x: -0.14, y: 0.8, z: 0.2, rx: -0.25 }),
      P(sph(0.07), '#ff5a4e', { x: 0.2, y: 0.64, z: 0.2 }),
    ];
    const wheel = merge([
      P(tor(0.16, 0.035), '#33404d'),
      P(rb(0.3, 0.03, 0.03, 0.01), '#56606c'),
      P(rb(0.03, 0.3, 0.03, 0.01), '#56606c'),
      P(cyl(0.05, 0.05, 0.08, 10), '#ffd23f', { rx: Math.PI / 2 }),
    ]);
    const parts = [{ geo: wheel, name: 'wheel', pos: [-0.14, 1.02, 0] }];
    if (two) parts.push({ geo: wheel, name: 'wheel2', pos: [0.16, 0.86, 0] });
    return { stat, parts };
  },
  mina2() { return BUILD.mina('#ffd23f', true); },
  bomba() {
    const c = '#7a5cff';
    const stat = [...base(c),
      P(rb(0.3, 0.26, 0.3), darker(c, 0.8), { x: -0.26, y: 0.26 }),
      P(rb(0.06, 0.62, 0.08, 0.02), '#3b2f73', { x: 0.02, y: 0.45, z: 0.1, rz: 0.12 }),
      P(rb(0.06, 0.62, 0.08, 0.02), '#3b2f73', { x: 0.02, y: 0.45, z: -0.1, rz: 0.12 }),
      P(cyl(0.05, 0.05, 0.3, 10), '#2a2340', { x: 0.3, y: 0.3 }),
    ];
    const beam = merge([
      P(rb(0.78, 0.09, 0.09, 0.03), c),
      P(rb(0.12, 0.22, 0.12, 0.04), darker(c, 0.7), { x: 0.4, y: -0.04 }),
      P(rb(0.16, 0.12, 0.14, 0.04), '#ffd23f', { x: -0.38 }),
    ]);
    const crank = merge([P(cyl(0.12, 0.12, 0.05, 14), '#ffd23f', { rx: Math.PI / 2 }), P(rb(0.06, 0.2, 0.06, 0.02), '#3b2f73', { y: 0.08 })]);
    return { stat, parts: [{ geo: beam, name: 'beam', pos: [0.02, 0.78, 0] }, { geo: crank, name: 'crank', pos: [-0.26, 0.42, 0.18] }] };
  },
  fornalha() {
    const c = '#ff6b4a';
    const stat = [...base(c),
      P(rb(0.7, 0.55, 0.7, 0.1), c, { y: 0.41 }),
      P(rb(0.74, 0.08, 0.74, 0.04), darker(c, 0.8), { y: 0.7 }),
      P(cyl(0.11, 0.13, 0.5, 14), '#8a8f99', { x: -0.18, y: 0.95, z: -0.18 }),
      P(cyl(0.14, 0.14, 0.06, 14), '#5f646d', { x: -0.18, y: 1.2, z: -0.18 }),
      P(rb(0.06, 0.28, 0.4, 0.03), '#3a2320', { x: 0.34, y: 0.34 }),
    ];
    const glow = rb(0.05, 0.2, 0.3, 0.02);
    return { stat, parts: [{ geo: glow, name: 'glow', pos: [0.355, 0.34, 0], glow: '#ffae33' }] };
  },
  prensa() {
    const c = '#b46bff';
    const stat = [...base(c),
      P(rb(0.46, 0.18, 0.5), '#8a95a3', { y: 0.23 }),
      P(rb(0.14, 0.86, 0.14, 0.05), c, { y: 0.55, z: 0.3 }),
      P(rb(0.14, 0.86, 0.14, 0.05), c, { y: 0.55, z: -0.3 }),
      P(rb(0.24, 0.16, 0.76, 0.06), darker(c, 0.85), { y: 1.0 }),
    ];
    const piston = merge([P(rb(0.38, 0.18, 0.38), '#dfe7ef'), P(cyl(0.05, 0.05, 0.4, 10), '#8a95a3', { y: 0.25 })]);
    return { stat, parts: [{ geo: piston, name: 'piston', pos: [0, 0.62, 0] }] };
  },
  torno() {
    const c = '#4fd18b';
    const stat = [...base(c),
      P(rb(0.74, 0.3, 0.5), c, { y: 0.28 }),
      P(rb(0.24, 0.32, 0.46), darker(c, 0.8), { x: -0.24, y: 0.58 }),
      P(rb(0.12, 0.22, 0.3), darker(c, 0.8), { x: 0.3, y: 0.52 }),
    ];
    const spindle = merge([
      P(cyl(0.07, 0.07, 0.5, 12), '#dfe7ef', { rz: Math.PI / 2 }),
      P(cyl(0.12, 0.12, 0.06, 8), '#ffd23f', { rz: Math.PI / 2, x: -0.06 }),
      P(rb(0.03, 0.2, 0.03, 0.01), '#33404d', { x: -0.06 }),
    ]);
    return { stat, parts: [{ geo: spindle, name: 'spindle', pos: [0.04, 0.6, 0] }] };
  },
  trefiladora() {
    const c = '#ff9f43';
    const stat = [...base(c), P(rb(0.72, 0.3, 0.6), c, { y: 0.28 }), P(rb(0.6, 0.06, 0.08, 0.02), '#ffb35c', { y: 0.46 })];
    const spool = merge([
      P(cyl(0.1, 0.1, 0.2, 14), '#ffb35c', { rx: Math.PI / 2 }),
      P(cyl(0.16, 0.16, 0.03, 16), '#56606c', { rx: Math.PI / 2, z: 0.11 }),
      P(cyl(0.16, 0.16, 0.03, 16), '#56606c', { rx: Math.PI / 2, z: -0.11 }),
    ]);
    return { stat, parts: [{ geo: spool, name: 'spool', pos: [-0.16, 0.62, 0] }, { geo: spool, name: 'spool2', pos: [0.18, 0.62, 0] }] };
  },
  montadora() {
    const c = '#4d8dff';
    const stat = [...base(c),
      P(rb(0.74, 0.34, 0.74, 0.08), c, { y: 0.31 }),
      P(rb(0.5, 0.05, 0.5, 0.02), '#dfe7ef', { y: 0.5 }),
      P(cyl(0.1, 0.12, 0.14, 14), '#33404d', { x: -0.18, y: 0.56, z: -0.18 }),
    ];
    const arm = merge([
      P(cyl(0.06, 0.06, 0.34, 10), '#ffd23f', { y: 0.17 }),
      P(rb(0.36, 0.07, 0.07, 0.03), '#ffd23f', { x: 0.16, y: 0.34 }),
      P(sph(0.07), '#ff5a4e', { y: 0.34 }),
      P(rb(0.05, 0.14, 0.12, 0.02), '#33404d', { x: 0.34, y: 0.27 }),
    ]);
    return { stat, parts: [{ geo: arm, name: 'arm', pos: [-0.18, 0.6, -0.18] }] };
  },
  refinaria() {
    const c = '#ff5fa2';
    const stat = [...base(c),
      P(cyl(0.2, 0.2, 0.52, 18), c, { x: -0.16, y: 0.4, z: -0.16 }),
      P(sph(0.2, 18, 10), darker(c, 0.9), { x: -0.16, y: 0.66, z: -0.16, s: [1, 0.55, 1] }),
      P(cyl(0.16, 0.16, 0.4, 16), '#ffd1e4', { x: -0.14, y: 0.34, z: 0.2 }),
      P(cyl(0.07, 0.08, 1.0, 12), '#dfe7ef', { x: 0.2, y: 0.64, z: -0.02 }),
      P(tor(0.1, 0.025), '#ff5fa2', { x: 0.2, y: 0.5, z: -0.02, rx: Math.PI / 2 }),
      P(tor(0.1, 0.025), '#ff5fa2', { x: 0.2, y: 0.82, z: -0.02, rx: Math.PI / 2 }),
      P(tor(0.14, 0.03, 8, 12), '#8a95a3', { x: 0.02, y: 0.38, z: 0.2, rz: Math.PI / 2, ry: Math.PI / 2 }),
    ];
    const lamp = sph(0.06);
    return { stat, parts: [{ geo: lamp, name: 'lamp', pos: [0.2, 1.18, -0.02], glow: '#ff3355' }] };
  },
  fabrica() {
    const c = '#ffc93c';
    const stat = [...base(c),
      P(rb(0.84, 0.46, 0.84, 0.08), c, { y: 0.37 }),
      P(rb(0.06, 0.26, 0.36, 0.03), '#5a4a1a', { x: 0.42, y: 0.28 }),
      P(cyl(0.07, 0.08, 0.5, 12), '#8a8f99', { x: -0.28, y: 0.85, z: -0.28 }),
    ];
    for (let i = 0; i < 3; i++) {
      stat.push(P(cyl(0.16, 0.16, 0.78, 3), i % 2 ? '#ff5a4e' : '#ff7b6e', { x: -0.26 + i * 0.26, y: 0.66, rx: Math.PI / 2, rz: -Math.PI / 2 }));
    }
    const gear = merge([P(cyl(0.16, 0.16, 0.06, 10), '#4d8dff', { rx: Math.PI / 2 }), P(cyl(0.05, 0.05, 0.1, 8), '#dfe7ef', { rx: Math.PI / 2 })]);
    return { stat, parts: [{ geo: gear, name: 'gear', pos: [0.05, 0.36, 0.44] }] };
  },
  inducao() {
    const c = '#5ad8ff';
    const stat = [...base(c),
      P(rb(0.66, 0.4, 0.66, 0.1), c, { y: 0.33 }),
      P(cyl(0.14, 0.18, 0.26, 16), '#33404d', { y: 0.64 }),
    ];
    const ring = tor(0.26, 0.05, 10, 24);
    const core = sph(0.1);
    return { stat, parts: [{ geo: ring, name: 'ring', pos: [0, 0.8, 0], glow: '#7df9ff' }, { geo: core, name: 'core', pos: [0, 0.82, 0], glow: '#ffffff' }] };
  },
  gerador() {
    const c = '#39c5b8';
    const stat = [...base(c),
      P(rb(0.7, 0.42, 0.6, 0.1), c, { y: 0.35 }),
      P(cyl(0.2, 0.2, 0.06, 20), darker(c, 0.7), { y: 0.58 }),
      P(cyl(0.08, 0.1, 0.46, 12), '#8a8f99', { x: -0.24, y: 0.8, z: 0.2 }),
      P(rb(0.2, 0.14, 0.34), '#33404d', { x: -0.3, y: 0.28 }),
    ];
    const fan = merge([P(cyl(0.05, 0.05, 0.08, 10), '#dfe7ef'),
      ...[0, 1, 2, 3].map((k) => P(rb(0.3, 0.02, 0.07, 0.01), '#ffd23f', { x: Math.cos(k * Math.PI / 2) * 0.1, z: Math.sin(k * Math.PI / 2) * 0.1, ry: -k * Math.PI / 2, rx: 0.3 }))]);
    return { stat, parts: [{ geo: fan, name: 'fan', pos: [0.04, 0.64, 0] }] };
  },
  turbina() {
    const stat = [P(rb(0.5, 0.12, 0.5, 0.05), '#8fa3b5', { y: 0.06 }),
      P(cyl(0.05, 0.1, 1.6, 12), '#f4f8fb', { y: 0.9 }),
      P(rb(0.28, 0.14, 0.14, 0.05), '#e9f1f7', { y: 1.72 }),
      P(sph(0.06), '#ff5a4e', { x: -0.12, y: 1.78 }),
    ];
    const rotor = merge([P(sph(0.07), '#ff5a4e'),
      ...[0, 1, 2].map((k) => P(rb(0.03, 0.62, 0.08, 0.015), '#ffffff', { y: 0.31, rx: 0 }).applyMatrix4(new THREE.Matrix4().makeRotationX(k * 2 * Math.PI / 3)))]);
    return { stat, parts: [{ geo: rotor, name: 'rotor', pos: [0.16, 1.72, 0] }] };
  },
  divisor() {
    const c = '#8a7dff';
    const stat = [P(rb(0.9, 0.12, 0.9, 0.05), darker(c, 0.55), { y: 0.06 }),
      P(rb(0.44, 0.26, 0.44, 0.1), c, { y: 0.25 }),
      ...[0, 1, 2, 3].map((k) => P(cone(0.07, 0.14, 4), '#fff6d8', { x: Math.cos(k * Math.PI / 2) * 0.33, z: Math.sin(k * Math.PI / 2) * 0.33, y: 0.16, rz: -Math.PI / 2, ry: -k * Math.PI / 2 })),
    ];
    const top = merge([P(cyl(0.12, 0.12, 0.06, 6), '#ffd23f'), P(sph(0.05), '#ff5a4e', { y: 0.05 })]);
    return { stat, parts: [{ geo: top, name: 'top', pos: [0, 0.42, 0] }], noArrow: true };
  },
  cruzamento() {
    const c = '#4ac6ff';
    const stat = [P(rb(0.92, 0.1, 0.92, 0.04), darker(c, 0.55), { y: 0.05 }),
      P(rb(0.94, 0.06, 0.34, 0.02), '#5f6b7a', { y: 0.13 }),
      P(rb(0.34, 0.06, 0.4, 0.02), '#5f6b7a', { y: 0.34 }),
      P(rb(0.34, 0.06, 0.34, 0.02), '#5f6b7a', { y: 0.24, z: 0.33, rx: -0.6 }),
      P(rb(0.34, 0.06, 0.34, 0.02), '#5f6b7a', { y: 0.24, z: -0.33, rx: 0.6 }),
      P(rb(0.06, 0.24, 0.06, 0.02), c, { x: 0.2, y: 0.22, z: 0.2 }),
      P(rb(0.06, 0.24, 0.06, 0.02), c, { x: -0.2, y: 0.22, z: 0.2 }),
      P(rb(0.06, 0.24, 0.06, 0.02), c, { x: 0.2, y: 0.22, z: -0.2 }),
      P(rb(0.06, 0.24, 0.06, 0.02), c, { x: -0.2, y: 0.22, z: -0.2 }),
    ];
    return { stat, parts: [], noArrow: true };
  },
  plataforma() {
    const c = '#ff5a4e';
    const stat = [P(rb(0.96, 0.2, 0.96, 0.06), '#f4f8fb', { y: 0.1 }),
      P(cyl(0.34, 0.34, 0.04, 24), c, { y: 0.22 }),
      P(cyl(0.22, 0.22, 0.045, 24), '#f4f8fb', { y: 0.225 }),
      P(rb(0.08, 1.7, 0.08, 0.02), '#ffd23f', { x: -0.38, y: 1.05, z: -0.38 }),
      P(rb(0.08, 1.7, 0.08, 0.02), '#ffd23f', { x: -0.38, y: 1.05, z: -0.18 }),
      ...[0.5, 0.95, 1.4].map((y) => P(rb(0.06, 0.06, 0.26, 0.02), '#ffd23f', { x: -0.38, y, z: -0.28 })),
      P(rb(0.26, 0.05, 0.05, 0.02), '#ffd23f', { x: -0.26, y: 1.35, z: -0.28 }),
    ];
    return { stat, parts: [], noArrow: true };
  },

  /* ---------- enfeites ---------- */
  arvore() { return { stat: [treeGeos()[0]], parts: [], noArrow: true }; },
  flores() {
    const stat = [P(rb(0.86, 0.12, 0.86, 0.05), '#8a5a3b', { y: 0.06 }), P(rb(0.78, 0.04, 0.78, 0.03), '#5cc95a', { y: 0.13 })];
    const cols = ['#ff6fa8', '#ffd23f', '#ffffff', '#ff5a4e', '#8a7dff', '#ff9f1a'];
    for (let i = 0; i < 9; i++) {
      const x = -0.26 + (i % 3) * 0.26, z = -0.26 + Math.floor(i / 3) * 0.26;
      stat.push(P(cyl(0.012, 0.012, 0.14, 5), '#3ba34a', { x, y: 0.2, z }));
      stat.push(P(sph(0.06, 8, 6), cols[i % cols.length], { x, y: 0.28, z, s: [1, 0.7, 1] }));
      stat.push(P(sph(0.025, 6, 4), '#ffe9a8', { x, y: 0.31, z }));
    }
    return { stat, parts: [], noArrow: true };
  },
  banco() {
    const wood = '#c98a4a', dark = '#56606c';
    const stat = [
      P(rb(0.74, 0.05, 0.24, 0.02), wood, { y: 0.26 }),
      P(rb(0.74, 0.18, 0.04, 0.02), wood, { y: 0.42, z: -0.12, rx: -0.15 }),
      ...[-0.3, 0.3].map((x) => P(rb(0.05, 0.26, 0.24, 0.02), dark, { x, y: 0.13 })),
      P(cyl(0.02, 0.02, 0.2, 6), '#56606c', { x: 0.44, y: 0.1, z: 0.2 }),
      P(cyl(0.07, 0.06, 0.12, 12), '#3ccf7a', { x: 0.44, y: 0.2, z: 0.2 }),
    ];
    return { stat, parts: [], noArrow: true };
  },
  poste() {
    const stat = [P(cyl(0.1, 0.12, 0.08, 12), '#33404d', { y: 0.04 }), P(cyl(0.035, 0.045, 1.1, 10), '#33404d', { y: 0.6 }),
      P(cyl(0.12, 0.08, 0.06, 12), '#33404d', { y: 1.2 })];
    return { stat, parts: [{ geo: sph(0.1, 14, 10), name: 'lamp', pos: [0, 1.1, 0], glow: '#fff2b0' }], noArrow: true };
  },
  bandeira() {
    const stat = [P(cyl(0.12, 0.14, 0.1, 12), '#dfe7ef', { y: 0.05 }), P(cyl(0.025, 0.025, 1.5, 8), '#dfe7ef', { y: 0.8 }), P(sph(0.045), '#ffd23f', { y: 1.57 })];
    const flag = merge([P(rb(0.5, 0.32, 0.02, 0.01), '#ff5a4e', { x: 0.25 }), P(sph(0.07, 10, 8), '#fff4e3', { x: 0.25, s: [1, 1, 0.3] })]);
    return { stat, parts: [{ geo: flag, name: 'flag', pos: [0.02, 1.32, 0] }], noArrow: true };
  },
  fonte() {
    const stat = [
      P(cyl(0.44, 0.46, 0.2, 24), '#dfe7ef', { y: 0.1 }),
      P(cyl(0.38, 0.38, 0.05, 24), '#4ac6ff', { y: 0.19 }),
      P(cyl(0.08, 0.1, 0.4, 12), '#dfe7ef', { y: 0.36 }),
      P(cyl(0.2, 0.14, 0.06, 18), '#dfe7ef', { y: 0.56 }),
      P(cyl(0.16, 0.16, 0.03, 18), '#4ac6ff', { y: 0.6 }),
    ];
    const jet = merge([P(cyl(0.03, 0.05, 0.4, 10), '#bdf0ff', { y: 0.2 }), P(sph(0.07, 10, 8), '#e6fbff', { y: 0.42 })]);
    return { stat, parts: [{ geo: jet, name: 'jet', pos: [0, 0.6, 0] }], noArrow: true };
  },
  estatua() {
    const stat = [P(rb(0.6, 0.3, 0.6, 0.06), '#dfe7ef', { y: 0.15 }), P(rb(0.5, 0.08, 0.5, 0.04), '#ffd23f', { y: 0.34 })];
    const gear = merge([
      P(cyl(0.3, 0.3, 0.1, 12), '#ffc400', { rx: Math.PI / 2 }),
      P(cyl(0.12, 0.12, 0.12, 12), '#fff3a8', { rx: Math.PI / 2 }),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => P(rb(0.1, 0.12, 0.1, 0.02), '#ffc400', { x: Math.cos(k * Math.PI / 4) * 0.34, y: Math.sin(k * Math.PI / 4) * 0.34, rz: k * Math.PI / 4 })),
    ]);
    return { stat, parts: [{ geo: gear, name: 'gear', pos: [0, 0.82, 0] }], noArrow: true };
  },
  monumento() {
    const stat = [P(rb(0.7, 0.24, 0.7, 0.06), '#dfe7ef', { y: 0.12 }), P(rb(0.56, 0.06, 0.56, 0.03), '#ff5a4e', { y: 0.27 })];
    rocketGeos().forEach((g) => { g = g.clone(); g.scale(0.8, 0.8, 0.8); g.translate(0, 0.3, 0); stat.push(g); });
    return { stat, parts: [], noArrow: true };
  },
  balao() {
    const stat = [P(cyl(0.18, 0.2, 0.06, 14), '#8a5a3b', { y: 0.03 }), P(cyl(0.012, 0.012, 0.9, 5), '#56606c', { y: 0.45, x: 0.14 })];
    const balloon = merge([
      P(sph(0.42, 20, 14), '#ff9f1a', { y: 0.55, s: [1, 1.15, 1] }),
      P(tor(0.42, 0.03, 6, 24), '#ff5a4e', { y: 0.55, rx: Math.PI / 2 }),
      P(sph(0.425, 20, 14), '#ffd23f', { y: 0.55, s: [0.4, 1.16, 1.01] }),
      ...[0, 1, 2, 3].map((k) => P(cyl(0.008, 0.008, 0.36, 4), '#56606c', { x: Math.cos(k * 1.57) * 0.1, z: Math.sin(k * 1.57) * 0.1, y: 0.02 })),
      P(rb(0.22, 0.14, 0.22, 0.04), '#c98a4a', { y: -0.16 }),
    ]);
    return { stat, parts: [{ geo: balloon, name: 'balloon', pos: [0, 1.4, 0] }], noArrow: true };
  },
};

/* foguete: 5 estágios que aparecem conforme as peças chegam */
export function rocketGeos() {
  return [
    merge([P(cyl(0.13, 0.16, 0.14, 16), '#56606c', { y: 0.07 }),
      ...[0, 1, 2].map((k) => P(rb(0.04, 0.22, 0.16, 0.02), '#ff5a4e', { y: 0.14, x: Math.cos(k * 2.094) * 0.17, z: Math.sin(k * 2.094) * 0.17, ry: -k * 2.094 }))]),
    P(cyl(0.16, 0.16, 0.3, 18), '#f4f8fb', { y: 0.29 }),
    merge([P(cyl(0.16, 0.16, 0.3, 18), '#f4f8fb', { y: 0.59 }), P(cyl(0.05, 0.05, 0.02, 12), '#5b8def', { y: 0.62, z: 0.16, rx: Math.PI / 2 })]),
    merge([P(cyl(0.16, 0.16, 0.26, 18), '#ff5a4e', { y: 0.87 }), P(tor(0.16, 0.02, 6, 18), '#ffd23f', { y: 0.74, rx: Math.PI / 2 })]),
    P(cone(0.16, 0.36, 18), '#f4f8fb', { y: 1.18 }),
  ];
}

const cache = new Map();
const glowMats = new Map();
function glowMat(color) {
  if (!glowMats.has(color)) glowMats.set(color, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1, roughness: 0.4 }));
  return glowMats.get(color);
}

export function machineModel(type) {
  if (!cache.has(type)) {
    const b = BUILD[type]();
    cache.set(type, { stat: merge(b.stat), parts: b.parts }); // a seta da saída já vem de base()
  }
  const { stat, parts } = cache.get(type);
  const g = new THREE.Group();
  g.add(mesh(stat));
  g.userData.parts = {};
  for (const p of parts) {
    const m = mesh(p.geo, p.glow ? glowMat(p.glow).clone() : toyMat);
    if (p.glow) m.castShadow = false;
    m.position.set(...p.pos);
    g.add(m);
    g.userData.parts[p.name] = m;
  }
  return g;
}

/* animação de cada tipo: t = tempo, w = trabalhando (0..1 suavizado) */
// env.night: 0 de dia, 1 no meio da noite (acende postes)
export function animateMachine(type, g, t, w, phase, env = {}) {
  const p = g.userData.parts;
  const a = t * 1.0 + phase;
  switch (type) {
    case 'mina': case 'mina2':
      p.wheel.rotation.z -= 0.12 * w * (type === 'mina2' ? 2 : 1);
      if (p.wheel2) p.wheel2.rotation.z += 0.24 * w;
      g.children[0].position.y = w * Math.abs(Math.sin(a * 18)) * 0.015;
      break;
    case 'bomba':
      p.beam.rotation.z = Math.sin(a * 3) * 0.3 * w;
      p.crank.rotation.z = -a * 3 * w;
      break;
    case 'fornalha':
      p.glow.material.emissiveIntensity = 0.3 + w * (1.6 + Math.sin(a * 9) * 0.4);
      break;
    case 'prensa': {
      const s = (a * 2.2) % 1;
      p.piston.position.y = 0.62 + (s < 0.25 ? -s * 1.1 : -0.275 + (s - 0.25) * 0.366) * w + (1 - w) * 0.05;
      break;
    }
    case 'torno': p.spindle.rotation.x += 0.35 * w; break;
    case 'trefiladora': p.spool.rotation.z += 0.2 * w; p.spool2.rotation.z -= 0.2 * w; break;
    case 'montadora': p.arm.rotation.y = Math.sin(a * 2.4) * 1.2 * w; break;
    case 'refinaria': p.lamp.material.emissiveIntensity = w * (Math.sin(a * 6) > 0 ? 2 : 0.2); break;
    case 'fabrica': p.gear.rotation.z += 0.1 * w; break;
    case 'inducao':
      p.ring.rotation.set(Math.PI / 2 + Math.sin(a * 2) * 0.18 * w, Math.cos(a * 1.7) * 0.18 * w, 0);
      p.ring.position.y = 0.8 + Math.sin(a * 3) * 0.04 * w;
      p.ring.material.emissiveIntensity = 0.2 + w * 1.6;
      p.core.material.emissiveIntensity = 0.3 + w * (1.4 + Math.sin(a * 12) * 0.5);
      break;
    case 'gerador': p.fan.rotation.y += 0.4 * w; break;
    case 'turbina': p.rotor.rotation.x += 0.05; break;
    case 'divisor': p.top.rotation.y += 0.06 + 0.1 * w; break;
    // enfeites se mexem sempre
    case 'poste': p.lamp.material.emissiveIntensity = 0.15 + (env.night || 0) * 3.2; break;
    case 'bandeira': p.flag.rotation.y = Math.sin(a * 3) * 0.3; p.flag.scale.x = 1 + Math.sin(a * 5) * 0.04; break;
    case 'fonte': p.jet.scale.y = 0.85 + Math.abs(Math.sin(a * 4)) * 0.35; break;
    case 'estatua': p.gear.rotation.z += 0.012; break;
    case 'balao': p.balloon.position.y = 1.4 + Math.sin(a * 0.9) * 0.18; p.balloon.rotation.y = Math.sin(a * 0.4) * 0.3; break;
  }
}

/* ---------- Sede (3x3), cresce um andar por era ---------- */
export function hubModel(era, roof = '#ff5a4e') {
  const parts = [
    P(rb(2.92, 0.26, 2.92, 0.1), '#fff1d6', { y: 0.13 }),
    P(rb(2.6, 0.06, 2.6, 0.03), '#ffd23f', { y: 0.28 }),
    P(rb(1.9, 0.8, 1.9, 0.14), '#fff4e3', { y: 0.7 }),
  ];
  // portas nos quatro lados (onde as esteiras entram)
  for (let k = 0; k < 4; k++) {
    const x = Math.cos(k * Math.PI / 2) * 0.96, z = Math.sin(k * Math.PI / 2) * 0.96;
    parts.push(P(rb(0.06, 0.42, 0.6, 0.03), '#3b4a5c', { x, z, y: 0.5, ry: -k * Math.PI / 2 }));
    parts.push(P(rb(0.08, 0.06, 0.7, 0.02), '#ff5a4e', { x: x * 1.01, z: z * 1.01, y: 0.74, ry: -k * Math.PI / 2 }));
  }
  // janelas (malha à parte: acendem à noite)
  const wins = [];
  for (let k = 0; k < 4; k++) for (const o of [-0.5, 0.5]) {
    const ang = k * Math.PI / 2, nx = Math.cos(ang), nz = Math.sin(ang), tx = -nz, tz = nx;
    wins.push(P(rb(0.04, 0.16, 0.2, 0.02), '#5b8def', { x: nx * 0.96 + tx * o, z: nz * 0.96 + tz * o, y: 0.9, ry: -ang }));
  }
  let y = 1.1, w = 1.6;
  const floors = Math.max(0, era - 1);
  const floorColors = ['#ffe3b3', '#c8f0ff', '#e0d4ff', '#d4ffe4', '#ffd6e7'];
  for (let f = 0; f < floors; f++) {
    parts.push(P(rb(w, 0.42, w, 0.1), floorColors[f % floorColors.length], { y: y + 0.21 }));
    for (let k = 0; k < 4; k++) {
      const ang = k * Math.PI / 2;
      wins.push(P(rb(0.04, 0.14, w * 0.5, 0.02), '#5b8def', { x: Math.cos(ang) * (w / 2 + 0.005), z: Math.sin(ang) * (w / 2 + 0.005), y: y + 0.22, ry: -ang }));
    }
    y += 0.42;
    w -= 0.2;
  }
  parts.push(P(rb(w + 0.12, 0.14, w + 0.12, 0.06), roof, { y: y + 0.07 }));
  parts.push(P(cyl(0.025, 0.025, 0.8, 8), '#dfe7ef', { y: y + 0.54, x: -w * 0.36, z: -w * 0.36 }));
  const g = new THREE.Group();
  g.add(mesh(merge(parts)));
  const winMesh = mesh(merge(wins), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: '#ffc862', emissiveIntensity: 0 }));
  winMesh.castShadow = false;
  g.add(winMesh);
  g.userData.windows = winMesh;
  const flag = mesh(P(rb(0.34, 0.2, 0.02, 0.01), roof, { x: 0.17 }));
  flag.position.set(-w * 0.36, y + 0.82, -w * 0.36);
  g.add(flag);
  g.userData.flag = flag;
  g.userData.top = y;
  // emblema "7"
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(64, 64, 60, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#ff5a4e'; x.beginPath(); x.arc(64, 64, 50, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff'; x.font = 'bold 84px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('7', 64, 70);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
  badge.rotation.x = -Math.PI / 2;
  badge.position.set(0, y + 0.145, 0);
  g.add(badge);
  return g;
}

/* ---------- itens (pequenos, instanciados) ---------- */
export function itemGeo(it) {
  const c = ITEMS[it].color;
  switch (ITEMS[it].shape) {
    case 'rock': return merge([P(new THREE.IcosahedronGeometry(0.11, 0), c, { y: 0.1 }), P(new THREE.IcosahedronGeometry(0.06, 0), darker(c, 0.8), { x: 0.07, y: 0.06, z: 0.04 })]);
    case 'pile': return P(cone(0.13, 0.14, 8), c, { y: 0.07 });
    case 'barrel': return merge([P(cyl(0.09, 0.09, 0.2, 12), c, { y: 0.1 }), P(tor(0.09, 0.015, 6, 12), '#ffd23f', { y: 0.1, rx: Math.PI / 2 })]);
    case 'bar': return P(rb(0.26, 0.09, 0.13, 0.03), c, { y: 0.05 });
    case 'pane': return P(rb(0.24, 0.04, 0.22, 0.015), c, { y: 0.03 });
    case 'plate': return P(rb(0.24, 0.05, 0.24, 0.02), c, { y: 0.03 });
    case 'gear': return merge([P(cyl(0.11, 0.11, 0.07, 8), c, { y: 0.04 }), P(cyl(0.04, 0.04, 0.08, 8), '#56606c', { y: 0.04 })]);
    case 'coil': return P(tor(0.07, 0.035, 8, 14), c, { y: 0.05, rx: Math.PI / 2 });
    case 'motor': return merge([P(rb(0.2, 0.14, 0.16, 0.04), c, { y: 0.08 }), P(cyl(0.03, 0.03, 0.12, 8), '#dfe7ef', { x: 0.14, y: 0.08, rz: Math.PI / 2 })]);
    case 'chip': return merge([P(rb(0.22, 0.04, 0.2, 0.015), c, { y: 0.03 }), P(rb(0.08, 0.03, 0.08, 0.01), '#1d2733', { y: 0.06 })]);
    case 'ball': return P(sph(0.1), c, { y: 0.1 });
    case 'robot': return merge([P(rb(0.16, 0.14, 0.14, 0.04), c, { y: 0.08 }), P(rb(0.12, 0.1, 0.1, 0.03), '#dfe7ef', { y: 0.2 }), P(sph(0.02), '#4d8dff', { x: 0.06, y: 0.21 })]);
    case 'cone': return merge([P(cone(0.1, 0.22, 12), c, { y: 0.11 }), P(cyl(0.1, 0.1, 0.03, 12), '#dfe7ef', { y: 0.01 })]);
  }
  return P(rb(0.16, 0.16, 0.16, 0.04), c, { y: 0.08 });
}

/* ---------- natureza e minério ---------- */
export function treeGeos() {
  return [
    merge([P(cyl(0.05, 0.06, 0.26, 8), '#8a5a3b', { y: 0.13 }), P(sph(0.26, 12, 8), '#4fbf5a', { y: 0.45 }), P(sph(0.17, 10, 8), '#6fd46a', { x: 0.12, y: 0.58, z: 0.06 })]),
    merge([P(cyl(0.05, 0.06, 0.2, 8), '#8a5a3b', { y: 0.1 }), P(cone(0.28, 0.42, 10), '#2e9e5b', { y: 0.38 }), P(cone(0.2, 0.34, 10), '#3bb56a', { y: 0.62 })]),
    merge([P(sph(0.2, 10, 8), '#5cc95a', { y: 0.12, s: [1, 0.7, 1] }), P(sph(0.14, 10, 8), '#7ddc66', { x: 0.14, y: 0.12, z: 0.1, s: [1, 0.7, 1] }), P(sph(0.05), '#ff6fa8', { x: -0.05, y: 0.25, z: 0.08 })]),
  ];
}

export function oreGeo(ore) {
  const col = { ferro: '#b9825a', cobre: '#f08a3c', carvao: '#3d3f4a', areia: '#f7dc8a', petroleo: '#2c2440', titanio: '#9fc4e8' }[ore];
  if (ore === 'petroleo') {
    return merge([P(cyl(0.34, 0.36, 0.04, 20), col, { y: 0.02 }), P(sph(0.06), '#5b4a8a', { x: 0.12, y: 0.05, z: -0.08 }), P(sph(0.04), '#5b4a8a', { x: -0.1, y: 0.04, z: 0.1 })]);
  }
  if (ore === 'areia') {
    return merge([P(sph(0.26, 12, 8), col, { x: -0.1, y: 0.0, z: -0.08, s: [1, 0.45, 1] }), P(sph(0.2, 12, 8), darker(col, 0.92), { x: 0.14, y: 0.0, z: 0.12, s: [1, 0.5, 1] })]);
  }
  const shine = ore === 'titanio' ? '#e8f6ff' : darker(col, 1.25);
  return merge([
    P(new THREE.IcosahedronGeometry(0.17, 0), col, { x: -0.1, y: 0.08, z: -0.06 }),
    P(new THREE.IcosahedronGeometry(0.13, 0), darker(col, 0.85), { x: 0.14, y: 0.06, z: 0.1 }),
    P(new THREE.IcosahedronGeometry(0.08, 0), shine, { x: 0.08, y: 0.05, z: -0.16 }),
  ]);
}

/* esteira: corpo + faixa de cima com textura rolando */
export function beltGeos() {
  const body = merge([
    P(rb(1.0, 0.1, 0.78, 0.03), '#5f6b7a', { y: 0.06 }),
    P(rb(1.0, 0.06, 0.08, 0.02), '#ffd23f', { y: 0.13, z: 0.37 }),
    P(rb(1.0, 0.06, 0.08, 0.02), '#ffd23f', { y: 0.13, z: -0.37 }),
  ]);
  const top = new THREE.PlaneGeometry(1.0, 0.66);
  top.rotateX(-Math.PI / 2);
  top.translate(0, 0.115, 0);
  return { body, top };
}
export function beltTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const x = cv.getContext('2d');
  x.fillStyle = '#39424e'; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = '#8795a6'; x.lineWidth = 7; x.lineCap = 'round';
  x.beginPath(); x.moveTo(18, 12); x.lineTo(38, 32); x.lineTo(18, 52); x.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* seta flutuante que aponta o próximo passo */
export function pointerModel() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(merge([P(cone(0.22, 0.4, 16), '#ffd23f', { y: 0.2, rx: Math.PI }), P(cyl(0.08, 0.08, 0.36, 12), '#ffd23f', { y: 0.58 })]), toyMat);
  g.add(m);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 32), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  g.add(ring);
  g.userData = { arrow: m, ring };
  return g;
}
