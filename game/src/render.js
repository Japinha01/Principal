/* ============================================================
   FUNDIÇÃO 7 — cena 3D
   Lê o estado da simulação a cada quadro e desenha: ilha, minério,
   árvores, máquinas (com animação), esteiras e itens, fantasma de
   construção, seta de dica, câmera e o lançamento do foguete.
   ============================================================ */
import * as THREE from 'three';
import { N, C, DX, DY, MACHINES, ITEMS, ERA_RADIUS, MAX_ERA, BELT_SPEED, UPGRADES } from './data.js';
import { idx, inGrid, recipeById } from './sim.js';
import * as MD from './models.js';
import { FX } from './fx.js';

export const wx = (x) => x - C + 0.5;
export const wz = (y) => y - C + 0.5;
const hash01 = (i, s = 0) => { let h = Math.imul(i + 1, 2654435761) ^ Math.imul(s + 7, 40503); h ^= h >>> 15; return ((h >>> 0) % 10000) / 10000; };
const dummy = new THREE.Object3D();
const tmpCol = new THREE.Color();
// lote instanciado: recalcula a área que ele ocupa depois de mudar as instâncias.
// Sem isso o three.js usa a área antiga e esconde o lote inteiro quando a câmera
// enquadra um ponto fora dela (ex.: zoom máximo em minério de era nova ou esteira nova).
const refit = (...ms) => ms.forEach((m) => { m.computeBoundingSphere(); m.boundingBox = null; });
const ease = { backOut: (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); } };

// altura do topo de cada máquina (para os balões de status)
const TOP = { mina: 1.2, mina2: 1.2, bomba: 1.0, fornalha: 1.3, prensa: 1.15, torno: 0.85, trefiladora: 0.85, montadora: 1.05,
  refinaria: 1.3, fabrica: 1.1, inducao: 1.1, gerador: 1.1, turbina: 2.0, divisor: 0.6, cruzamento: 0.5, plataforma: 1.9 };
// chaminés (fumaça quando trabalha): deslocamento no modelo olhando para +x
const SMOKE = { fornalha: [-0.18, 1.25, -0.18], gerador: [-0.24, 1.06, 0.2], fabrica: [-0.28, 1.12, -0.28], refinaria: [0.2, 1.25, -0.02] };

export class View {
  constructor(canvas) {
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.mobile = mobile;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile || devicePixelRatio < 2, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#bfe9ff', 55, 130);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.3, 400);

    scene.add(new THREE.HemisphereLight('#e6f6ff', '#6f9a5c', 1.35));
    const sun = this.sun = new THREE.DirectionalLight('#fff4dc', 2.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);

    // água
    const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: '#3fb8ea', roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.86 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.34;
    water.receiveShadow = true;
    scene.add(water);
    this.water = water;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: '#2a8fc4' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.2;
    scene.add(floor);

    this.fx = new FX(scene);
    this.cam = { tx: 0.5, tz: 0.5, dist: 26, az: Math.PI / 4, el: 0.92, gtx: 0.5, gtz: 0.5, gdist: 26, gaz: Math.PI / 4, shake: 0, ty: 0, gty: 0 };
    this.objs = new Map();      // id → { g, type, w, phase, pop }
    this.t = 0;
    this.itemMeshes = {};
    this.initStatic();
    this.resize();
  }

  /* ---------- peças fixas criadas uma vez ---------- */
  initStatic() {
    const s = this.scene;
    // ilha: tampa de grama + corpo de terra, uma instância por casa que um dia vira terra
    this.tileTop = new THREE.InstancedMesh(new THREE.BoxGeometry(0.985, 0.3, 0.985), new THREE.MeshStandardMaterial({ roughness: 0.85 }), N * N);
    this.tileBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.96, 1.4, 0.96), new THREE.MeshStandardMaterial({ color: '#b98a5e', roughness: 0.95 }), N * N);
    this.tileTop.receiveShadow = true;
    this.tileBody.receiveShadow = true;
    s.add(this.tileTop, this.tileBody);

    // esteiras
    const bg = MD.beltGeos();
    this.beltTex = MD.beltTexture();
    this.beltBody = new THREE.InstancedMesh(bg.body, MD.toyMat, 64);
    this.beltTop = new THREE.InstancedMesh(bg.top, new THREE.MeshStandardMaterial({ map: this.beltTex, roughness: 0.7 }), 64);
    this.beltBody.castShadow = this.beltBody.receiveShadow = true;
    this.beltTop.receiveShadow = true;
    s.add(this.beltBody, this.beltTop);
    this.beltGeo = bg;

    // itens
    for (const it of Object.keys(ITEMS)) {
      const m = new THREE.InstancedMesh(MD.itemGeo(it), MD.toyMat, 256);
      m.castShadow = true;
      m.count = 0;
      m.frustumCulled = false;
      s.add(m);
      this.itemMeshes[it] = m;
    }

    // árvores e minério
    this.treeMeshes = MD.treeGeos().map((g) => {
      const m = new THREE.InstancedMesh(g, MD.toyMat, N * N);
      m.castShadow = true; m.receiveShadow = true; m.count = 0;
      s.add(m);
      return m;
    });
    this.oreMeshes = {};
    for (const o of ['ferro', 'cobre', 'carvao', 'areia', 'petroleo', 'titanio']) {
      const m = new THREE.InstancedMesh(MD.oreGeo(o), MD.toyMat, N * N);
      m.castShadow = o !== 'petroleo' && o !== 'areia';
      m.receiveShadow = true; m.count = 0;
      s.add(m);
      this.oreMeshes[o] = m;
    }

    // fantasma de construção
    this.ghostMat = new THREE.MeshStandardMaterial({ color: '#7dff9b', transparent: true, opacity: 0.55, depthWrite: false });
    this.ghost = new THREE.Group();
    s.add(this.ghost);
    this.ghostBelts = new THREE.InstancedMesh(bg.body, this.ghostMat, 256);
    this.ghostBelts.count = 0;
    this.ghostBelts.frustumCulled = false;
    s.add(this.ghostBelts);
    this.ghostArrows = new THREE.InstancedMesh(new THREE.ConeGeometry(0.14, 0.3, 3).rotateZ(-Math.PI / 2).translate(0.1, 0.22, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 256);
    this.ghostArrows.count = 0;
    this.ghostArrows.frustumCulled = false;
    s.add(this.ghostArrows);
    const sel = document.createElement('canvas');
    sel.width = sel.height = 64;
    const cx = sel.getContext('2d');
    cx.strokeStyle = '#fff'; cx.lineWidth = 6; cx.beginPath(); cx.roundRect(5, 5, 54, 54, 12); cx.stroke();
    const selTex = new THREE.CanvasTexture(sel);
    this.cursor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: selTex, transparent: true, depthWrite: false, color: '#ffffff' }));
    this.cursor.rotation.x = -Math.PI / 2;
    this.cursor.position.y = 0.03;
    this.cursor.renderOrder = 5;
    s.add(this.cursor);

    this.pointer = MD.pointerModel();
    this.pointer.visible = false;
    s.add(this.pointer);

    this.bubbleTex = {};
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 44 : 32;
    this.camera.updateProjectionMatrix();
  }

  /* ---------- troca de jogo (novo / carregar) ---------- */
  setGame(game, icons) {
    this.game = game;
    this.icons = icons;
    for (const o of this.objs.values()) this.scene.remove(o.g);
    this.objs.clear();
    if (this.hub) this.scene.remove(this.hub);
    this.hub = null;
    this.rise = null;
    this.orePop = null;
    for (const k in this.oreMeshes) this.oreMeshes[k].scale.setScalar(1);
    this.launched = false;
    this.launch = null;
    this.buildIsland(false);
    this.buildOres();
    this.buildTrees();
    this.beltDirty = true;
    this.syncEnts(true);
    const R = ERA_RADIUS[game.era];
    this.cam.gdist = this.cam.dist = Math.min(52, 12 + R * 1.6);
  }

  tileColor(i, era) {
    const g = this.game, x = i % N, y = (i / N) | 0;
    const o = g.ore[i];
    if (o === 'areia' && g.landEra[i] <= era) return '#f5d98a';
    let beach = false;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (!inGrid(nx, ny) || g.landEra[idx(nx, ny)] > era) { beach = true; break; }
    }
    if (beach) return '#ffe4a3';
    const k = hash01(i, 3);
    return k < 0.33 ? '#7ed957' : k < 0.66 ? '#76d052' : '#86de61';
  }

  // monta as casas da ilha; underwater = casas da próxima era aparecem como banco de areia
  buildIsland(animateEra) {
    const g = this.game, era = g.era;
    let n = 0;
    this.tileIndex = new Int32Array(N * N).fill(-1);
    this.tileAnim = [];
    for (let i = 0; i < N * N; i++) {
      const le = g.landEra[i];
      if (le > MAX_ERA) continue;
      if (le > era + 1) continue;
      const x = i % N, y = (i / N) | 0;
      const under = le > era;
      let yy = under ? -0.62 : 0;
      if (animateEra && le === era) {
        const d = Math.hypot(x + 0.5 - C, y + 0.5 - C);
        this.tileAnim.push({ n, i, delay: Math.max(0, d - ERA_RADIUS[era - 1] + 1.2) * 0.09 + hash01(i, 9) * 0.25 });
        yy = -0.62;
      }
      this.placeTile(n, x, y, yy);
      this.tileTop.setColorAt(n, tmpCol.set(under ? '#e8c982' : this.tileColor(i, era)));
      this.tileIndex[i] = n;
      n++;
    }
    this.tileTop.count = this.tileBody.count = n;
    this.tileTop.instanceMatrix.needsUpdate = this.tileBody.instanceMatrix.needsUpdate = true;
    this.tileTop.instanceColor.needsUpdate = true;
    refit(this.tileTop, this.tileBody);
    if (animateEra) this.rise = { t: 0 };
  }

  placeTile(n, x, y, yy) {
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.position.set(wx(x), yy - 0.15, wz(y));
    dummy.updateMatrix();
    this.tileTop.setMatrixAt(n, dummy.matrix);
    dummy.position.set(wx(x), yy - 1.0, wz(y));
    dummy.updateMatrix();
    this.tileBody.setMatrixAt(n, dummy.matrix);
  }

  buildOres(pop = false) {
    const g = this.game;
    const counts = {};
    for (const k in this.oreMeshes) counts[k] = 0;
    if (pop) this.orePop = { t: 0 };
    for (let i = 0; i < N * N; i++) {
      const o = g.ore[i];
      if (!o || g.landEra[i] > g.era) continue;
      // embaixo de esteira ou máquina o minério some (a mina fica em cima dele, então ele aparece)
      const on = g.occ[i] && g.ents.get(g.occ[i]);
      if (on && on.kind !== 'mine') continue;
      const m = this.oreMeshes[o];
      dummy.position.set(wx(i % N), 0, wz((i / N) | 0));
      dummy.rotation.set(0, hash01(i, 1) * 6.28, 0);
      const s = 0.85 + hash01(i, 2) * 0.3;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      m.setMatrixAt(counts[o]++, dummy.matrix);
    }
    for (const k in this.oreMeshes) {
      this.oreMeshes[k].count = counts[k];
      this.oreMeshes[k].instanceMatrix.needsUpdate = true;
      refit(this.oreMeshes[k]);
    }
  }

  // skipEra: durante a subida da ilha, as árvores das casas novas só brotam no fim
  buildTrees(skipEra = 0) {
    const g = this.game;
    const c = [0, 0, 0];
    for (let i = 0; i < N * N; i++) {
      const t = g.tree[i];
      if (!t || g.landEra[i] > g.era || g.occ[i] || g.landEra[i] === skipEra) continue;
      const m = this.treeMeshes[t - 1];
      dummy.position.set(wx(i % N) + (hash01(i, 4) - 0.5) * 0.3, 0, wz((i / N) | 0) + (hash01(i, 5) - 0.5) * 0.3);
      dummy.rotation.set(0, hash01(i, 6) * 6.28, 0);
      const s = 0.8 + hash01(i, 7) * 0.45;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      m.setMatrixAt(c[t - 1]++, dummy.matrix);
    }
    this.treeMeshes.forEach((m, k) => { m.count = c[k]; m.instanceMatrix.needsUpdate = true; refit(m); });
  }

  /* ---------- eventos da simulação ---------- */
  onEvent(e) {
    const g = this.game;
    switch (e.t) {
      case 'place': case 'remove': case 'rotate':
        this.beltDirty = true;
        if (e.t === 'place' && e.tree) this.buildTrees();
        if (e.t !== 'rotate') this.buildOres();
        if (e.t === 'remove') {
          this.fx.dust(wx(e.x), wz(e.y), '#e9dfcc', 12);
          this.fx.confetti(wx(e.x), 0.3, wz(e.y), 8, { power: 3, colors: [MACHINES[e.type].color, '#8a95a3'], life: 1 });
        }
        break;
      case 'deliver':
        this.hubBounce = 1;
        break;
      case 'era':
        this.eraUp();
        break;
    }
  }

  eraUp() {
    this.buildIsland(true);
    this.buildOres(true);
    this.buildTrees(this.game.era);
    this.rebuildHub();
    const R = ERA_RADIUS[this.game.era];
    this.focus(0.5, 0.5, Math.min(56, 14 + R * 1.7));
  }

  rebuildHub() {
    if (this.hub) this.scene.remove(this.hub);
    this.hub = MD.hubModel(this.game.era);
    this.hub.position.set(wx(C), 0, wz(C));
    this.scene.add(this.hub);
    this.hubEra = this.game.era;
  }

  /* ---------- máquinas: cria/remove objetos conforme a simulação ---------- */
  syncEnts(initial = false) {
    const g = this.game;
    if (!this.hub || this.hubEra !== g.era) this.rebuildHub();
    const seen = new Set();
    for (const e of g.ents.values()) {
      if (e.kind === 'belt' || e.kind === 'hub') continue;
      seen.add(e.id);
      let o = this.objs.get(e.id);
      if (!o) {
        const grp = MD.machineModel(e.type);
        grp.position.set(wx(e.x), 0, wz(e.y));
        this.scene.add(grp);
        o = { g: grp, type: e.type, w: 0, phase: Math.random() * 10, pop: initial ? 1 : 0, smokeT: Math.random() };
        if (e.type === 'plataforma') {
          o.rocket = MD.rocketGeos().map((geo) => {
            const m = new THREE.Mesh(geo, MD.toyMat);
            m.castShadow = true;
            m.position.y = 0.24;
            grp.add(m);
            return m;
          });
        }
        this.objs.set(e.id, o);
        if (!initial) this.fx.dust(wx(e.x), wz(e.y));
      }
      o.g.rotation.y = -e.dir * Math.PI / 2;
    }
    for (const [id, o] of this.objs) {
      if (!seen.has(id)) { this.scene.remove(o.g); if (o.bubble) this.scene.remove(o.bubble); this.objs.delete(id); }
    }
  }

  rebuildBelts() {
    const g = this.game;
    const belts = [];
    for (const e of g.ents.values()) if (e.kind === 'belt') belts.push(e);
    if (belts.length > this.beltBody.instanceMatrix.count) {
      const cap = Math.max(belts.length * 2, 64);
      for (const k of ['beltBody', 'beltTop']) {
        const old = this[k];
        const m = new THREE.InstancedMesh(old.geometry, old.material, cap);
        m.castShadow = old.castShadow; m.receiveShadow = old.receiveShadow;
        this.scene.remove(old);
        this.scene.add(m);
        this[k] = m;
      }
    }
    belts.forEach((e, n) => {
      dummy.position.set(wx(e.x), 0, wz(e.y));
      dummy.rotation.set(0, -e.dir * Math.PI / 2, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.beltBody.setMatrixAt(n, dummy.matrix);
      this.beltTop.setMatrixAt(n, dummy.matrix);
    });
    this.beltBody.count = this.beltTop.count = belts.length;
    this.beltBody.instanceMatrix.needsUpdate = this.beltTop.instanceMatrix.needsUpdate = true;
    refit(this.beltBody, this.beltTop);
    this.beltDirty = false;
  }

  updateItems() {
    const g = this.game;
    const counts = {};
    for (const k in this.itemMeshes) counts[k] = 0;
    const put = (it, x, y, z, rot) => {
      const m = this.itemMeshes[it];
      let n = counts[it];
      if (n >= m.instanceMatrix.count) {
        const bigger = new THREE.InstancedMesh(m.geometry, m.material, m.instanceMatrix.count * 2);
        bigger.castShadow = true; bigger.frustumCulled = false;
        for (let i = 0; i < n; i++) { m.getMatrixAt(i, dummy.matrix); bigger.setMatrixAt(i, dummy.matrix); }
        this.scene.remove(m); this.scene.add(bigger);
        this.itemMeshes[it] = bigger;
        return put(it, x, y, z, rot);
      }
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1.35, 1.35, 1.35);
      dummy.updateMatrix();
      m.setMatrixAt(n, dummy.matrix);
      counts[it] = n + 1;
    };
    for (const e of g.ents.values()) {
      if (e.kind === 'belt') {
        const dx = DX[e.dir], dz = DY[e.dir];
        for (const q of e.items) put(q.it, wx(e.x) + dx * (q.p - 0.5), 0.12, wz(e.y) + dz * (q.p - 0.5), -e.dir * Math.PI / 2);
      } else if (e.kind === 'splitter') {
        for (const b of e.buf) put(b.it, wx(e.x), 0.5, wz(e.y), this.t);
      } else if (e.kind === 'cross') {
        for (const s of e.slots) if (s) {
          const k = Math.min(1, s.t / 0.15) - 0.5;
          put(s.it, wx(e.x) + DX[s.d] * k * 0.8, s.d % 2 ? 0.4 : 0.18, wz(e.y) + DY[s.d] * k * 0.8, 0);
        }
      }
    }
    for (const k in this.itemMeshes) {
      const m = this.itemMeshes[k];
      m.count = counts[k];
      m.instanceMatrix.needsUpdate = true;
    }
  }

  /* ---------- balões de status acima das máquinas ---------- */
  bubble(key, draw) {
    if (!this.bubbleTex[key]) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const x = cv.getContext('2d');
      draw(x);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      this.bubbleTex[key] = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true });
    }
    return this.bubbleTex[key];
  }
  bubbleFor(e) {
    const circle = (x, fill, stroke) => { x.fillStyle = fill; x.beginPath(); x.arc(64, 60, 50, 0, 7); x.fill(); x.lineWidth = 8; x.strokeStyle = stroke; x.stroke(); x.beginPath(); x.moveTo(50, 104); x.lineTo(64, 124); x.lineTo(78, 104); x.fillStyle = stroke; x.fill(); };
    const glyph = (key, fill, stroke, text) => this.bubble(key, (x) => { circle(x, fill, stroke); x.fillStyle = '#fff'; x.font = 'bold 64px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 64); });
    switch (e.st) {
      case 'noinput': {
        const r = e.recipe && recipeById[e.recipe];
        const miss = r && Object.keys(r.in).find((k) => (e.inb[k] || 0) < r.in[k]);
        if (miss && this.icons && this.icons.canvas[miss]) {
          return this.bubble('need_' + miss, (x) => { circle(x, '#fff7e0', '#ff9f1a'); x.drawImage(this.icons.canvas[miss], 18, 14, 92, 92); x.fillStyle = '#ff5a4e'; x.beginPath(); x.arc(100, 26, 20, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 32px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 100, 28); });
        }
        return glyph('noinput', '#ff9f1a', '#c96a00', '!');
      }
      case 'blocked': return glyph('blocked', '#ff5a4e', '#b8322a', '■');
      case 'nopower': return glyph('nopower', '#ffd23f', '#c79a00', '⚡');
      case 'nofuel': return glyph('nofuel', '#56606c', '#2a3038', '⚡');
      case 'idle': return e.kind === 'machine' ? glyph('idle', '#8a95a3', '#56606c', '?') : null;
    }
    return null;
  }

  /* ---------- fantasma e cursor (chamados pela interface) ---------- */
  setGhost(type, x, y, dir, ok) {
    if (this.ghostType !== type) {
      this.ghost.clear();
      this.ghostType = type;
      if (type && type !== 'esteira' && type !== 'remove') {
        const m = MD.machineModel(type);
        m.traverse((o) => { if (o.isMesh) { o.material = this.ghostMat; o.castShadow = false; } });
        this.ghost.add(m);
      }
    }
    const show = type && x != null;
    this.ghost.visible = !!show && type !== 'esteira' && type !== 'remove';
    this.cursor.visible = x != null;
    if (x == null) return;
    this.ghostMat.color.set(ok ? '#7dff9b' : '#ff6b6b');
    this.cursor.material.color.set(type === 'remove' ? '#ff6b6b' : ok || !type ? '#ffffff' : '#ff6b6b');
    this.cursor.position.set(wx(x), 0.03, wz(y));
    this.ghost.position.set(wx(x), 0.02, wz(y));
    this.ghost.rotation.y = -dir * Math.PI / 2;
  }
  setGhostPath(path, ok) {
    this.ghostMat.color.set(ok ? '#7dff9b' : '#ff6b6b');
    const n = path ? path.length : 0;
    path && path.forEach((p, i) => {
      dummy.position.set(wx(p.x), 0.02, wz(p.y));
      dummy.rotation.set(0, -p.dir * Math.PI / 2, 0);
      dummy.scale.set(1, 1.3, 1);
      dummy.updateMatrix();
      this.ghostBelts.setMatrixAt(i, dummy.matrix);
      this.ghostArrows.setMatrixAt(i, dummy.matrix);
    });
    this.ghostBelts.count = this.ghostArrows.count = Math.min(n, 256);
    this.ghostBelts.instanceMatrix.needsUpdate = this.ghostArrows.instanceMatrix.needsUpdate = true;
  }
  setPointer(at) {
    this.pointer.visible = !!at;
    if (at) this.pointer.position.set(wx(at[0]), 0, wz(at[1]));
  }

  /* ---------- câmera ---------- */
  // pan por pixels (teclado): o mapa anda junto com o "arrasto", na hora, sem deslizar
  pan(dx, dy) {
    const c = this.cam;
    const k = 2 * c.dist * Math.tan(this.camera.fov * Math.PI / 360) / innerHeight;
    const sa = Math.sin(c.az), ca = Math.cos(c.az), v = 1 / Math.sin(c.el);
    c.gtx += (-ca * dx - sa * dy * v) * k;
    c.gtz += (sa * dx - ca * dy * v) * k;
    this.clampTarget();
    c.tx = c.gtx; c.tz = c.gtz;
  }
  // arrastar com o mouse/dedo: o ponto do chão que você pegou fica preso embaixo do cursor
  groundAt(sx, sy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1, 0.5).unproject(this.camera);
    const o = this.camera.position, d = v.sub(o).normalize();
    if (d.y >= -0.02) return null;
    const t = -o.y / d.y;
    return { x: o.x + d.x * t, z: o.z + d.z * t };
  }
  grabStart(sx, sy) { this.grab = this.groundAt(sx, sy); }
  grabMove(sx, sy) {
    if (!this.grab) { this.grabStart(sx, sy); return; }
    const p = this.groundAt(sx, sy);
    if (!p) return;
    const c = this.cam;
    c.gtx = c.tx + this.grab.x - p.x;
    c.gtz = c.tz + this.grab.z - p.z;
    this.clampTarget();
    c.tx = c.gtx; c.tz = c.gtz;
    this.applyCamera();
  }
  grabEnd() { this.grab = null; }
  applyCamera(sh = 0) {
    const c = this.cam, ce = Math.cos(c.el);
    this.camera.position.set(c.tx + Math.sin(c.az) * ce * c.dist + sh, c.ty + Math.sin(c.el) * c.dist + sh, c.tz + Math.cos(c.az) * ce * c.dist);
    this.camera.lookAt(c.tx, c.ty, c.tz);
    this.camera.updateMatrixWorld();
  }
  zoom(f) { this.cam.gdist = Math.max(7, Math.min(60, this.cam.gdist * f)); }
  turn(s) { this.cam.gaz += s * Math.PI / 2; }
  focus(x, z, dist) { this.cam.gtx = x; this.cam.gtz = z; if (dist) this.cam.gdist = dist; this.clampTarget(); }
  focusTile(tx, ty) { this.focus(wx(tx), wz(ty)); }
  clampTarget() {
    const R = ERA_RADIUS[this.game ? this.game.era : 1] + 2, c = this.cam;
    const d = Math.hypot(c.gtx, c.gtz);
    if (d > R) { c.gtx *= R / d; c.gtz *= R / d; }
  }
  // tela → casa da grade
  pick(sx, sy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1, 0.5).unproject(this.camera);
    const o = this.camera.position, d = v.sub(o).normalize();
    if (d.y >= -1e-4) return null;
    const t = -o.y / d.y;
    const px = o.x + d.x * t, pz = o.z + d.z * t;
    const x = Math.floor(px + C), y = Math.floor(pz + C);
    return inGrid(x, y) ? { x, y } : null;
  }
  // mundo → tela (para textos flutuantes)
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, vis: v.z < 1 };
  }

  /* ---------- lançamento do foguete ---------- */
  startLaunch(onDone) {
    let pad = null;
    for (const e of this.game.ents.values()) if (e.kind === 'pad') pad = e;
    if (!pad) { onDone && onDone(); return; }
    const o = this.objs.get(pad.id);
    this.launch = { t: 0, pad, o, onDone, x: wx(pad.x), z: wz(pad.y) };
    this.focus(this.launch.x, this.launch.z, 16);
  }

  updateLaunch(dt) {
    const L = this.launch;
    if (!L) return;
    L.t += dt;
    const { x, z, o } = L;
    const y0 = 0.24;
    let ry = 0;
    if (L.t < 2) {
      this.cam.shake = 0.08 * L.t;
      this.fx.puff(x + (Math.random() - 0.5) * 0.6, 0.3, z + (Math.random() - 0.5) * 0.6, { color: '#ffffff', size: 0.3, rise: 0.4, life: 1.6, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2 });
    } else {
      const k = L.t - 2;
      ry = k * k * 3.2;
      this.cam.shake = Math.max(0, 0.18 - k * 0.04);
      this.fx.puff(x, y0 + ry, z, { n: 2, color: Math.random() < 0.5 ? '#ffb13b' : '#ffffff', size: 0.24, rise: -1.2, life: 1.2, spread: 0.15 });
      this.cam.gty = Math.min(ry * 0.8, 30);
    }
    if (o && o.rocket) o.rocket.forEach((m) => { m.visible = true; m.position.y = y0 + ry; });
    if (L.t > 2 && !L.boom && ry > 22) {
      L.boom = true;
      for (let k = 0; k < 5; k++) this.fx.confetti(x + (Math.random() - 0.5) * 6, ry * 0.5 + 4 + Math.random() * 4, z + (Math.random() - 0.5) * 6, 70, { power: 7, gravity: 3.5, life: 3.5 });
    }
    if (L.t > 6.5) {
      if (o && o.rocket) o.rocket.forEach((m) => { m.visible = false; });
      this.launched = true;
      this.launch = null;
      this.cam.gty = 0;
      this.cam.shake = 0;
      L.onDone && L.onDone();
    }
  }

  /* ---------- quadro ---------- */
  frame(dt) {
    const g = this.game;
    this.t += dt;
    if (!g) return;
    this.syncEnts();
    if (this.beltDirty) this.rebuildBelts();
    this.updateItems();

    // esteiras rolando
    const bspeed = BELT_SPEED * (1 + UPGRADES.esteiras.per * g.up.esteiras);
    this.beltTex.offset.x = (this.beltTex.offset.x - bspeed * dt) % 1;

    // ilha subindo do mar numa era nova
    if (this.rise) {
      this.rise.t += dt;
      let busy = false;
      for (const a of this.tileAnim) {
        const k = Math.min(1, Math.max(0, (this.rise.t - a.delay) / 0.7));
        if (k < 1) busy = true;
        this.placeTile(a.n, a.i % N, (a.i / N) | 0, -0.62 + 0.62 * ease.backOut(k));
        if (k > 0 && !a.col) { a.col = true; this.tileTop.setColorAt(a.n, tmpCol.set(this.tileColor(a.i, g.era))); this.tileTop.instanceColor.needsUpdate = true; if (hash01(a.i, 11) < 0.08) this.fx.puff(wx(a.i % N), 0, wz((a.i / N) | 0), { color: '#e8fbff', size: 0.25, rise: 0.5, life: 0.9 }); }
      }
      this.tileTop.instanceMatrix.needsUpdate = this.tileBody.instanceMatrix.needsUpdate = true;
      if (!busy) { this.rise = null; this.buildTrees(); refit(this.tileTop, this.tileBody); }
    }
    if (this.orePop) {
      this.orePop.t += dt;
      const s = ease.backOut(Math.min(1, Math.max(0, (this.orePop.t - 1.2) / 0.6)));
      for (const k in this.oreMeshes) this.oreMeshes[k].scale.setScalar(s || 0.001);
      if (this.orePop.t > 1.8) { for (const k in this.oreMeshes) this.oreMeshes[k].scale.setScalar(1); this.orePop = null; }
    }

    // máquinas: animação, fumaça e balões
    for (const [id, o] of this.objs) {
      const e = g.ents.get(id);
      if (!e) continue;
      const working = e.kind === 'mine' ? e.st === 'ok' : e.kind === 'machine' ? e.working : e.kind === 'generator' ? e.on : e.kind === 'splitter' ? e.buf.length > 0 : e.kind === 'turbine';
      o.w += ((working ? 1 : 0) - o.w) * Math.min(1, dt * 4);
      if (o.pop < 1) {
        o.pop = Math.min(1, o.pop + dt * 3);
        o.g.scale.setScalar(Math.max(0.01, ease.backOut(o.pop)));
      }
      MD.animateMachine(o.type, o.g, this.t, o.w, o.phase);
      if (SMOKE[o.type] && o.w > 0.5) {
        o.smokeT -= dt;
        if (o.smokeT <= 0) {
          o.smokeT = 0.35 + Math.random() * 0.25;
          const [sx, sy, sz] = SMOKE[o.type];
          const a = -e.dir * Math.PI / 2;
          const px = sx * Math.cos(a) + sz * Math.sin(a), pz = -sx * Math.sin(a) + sz * Math.cos(a);
          this.fx.puff(o.g.position.x + px, sy, o.g.position.z + pz, { color: o.type === 'inducao' ? '#e0f7ff' : '#f2f2f2', size: 0.16, rise: 0.7, life: 1.8 });
        }
      }
      if (o.rocket && !this.launch) {
        const k = e.count || 0;
        const stages = this.launched ? 0 : Math.min(5, Math.ceil(k / 4));
        o.rocket.forEach((m, i) => { m.visible = i < stages; m.position.y = 0.24; });
      }
      const mat = this.bubbleFor(e);
      if (mat) {
        if (!o.bubble) { o.bubble = new THREE.Sprite(mat); o.bubble.scale.setScalar(0.5); o.bubble.renderOrder = 10; this.scene.add(o.bubble); }
        o.bubble.material = mat;
        o.bubble.visible = true;
        o.bubble.position.set(o.g.position.x, (TOP[o.type] || 1) + 0.28 + Math.sin(this.t * 3 + o.phase) * 0.05, o.g.position.z);
      } else if (o.bubble) o.bubble.visible = false;
    }

    // Sede: bandeira e pulinho a cada entrega
    if (this.hub) {
      this.hubBounce = Math.max(0, (this.hubBounce || 0) - dt * 4);
      const b = Math.sin((1 - this.hubBounce) * Math.PI) * this.hubBounce * 0.05;
      this.hub.scale.set(1 + b * 0.5, 1 + b, 1 + b * 0.5);
      if (this.hub.userData.flag) this.hub.userData.flag.rotation.y = Math.sin(this.t * 3) * 0.35;
    }

    // seta de dica
    if (this.pointer.visible) {
      this.pointer.userData.arrow.position.y = 0.9 + Math.abs(Math.sin(this.t * 3.2)) * 0.35;
      const k = (this.t * 1.2) % 1;
      this.pointer.userData.ring.scale.setScalar(0.7 + k * 0.8);
      this.pointer.userData.ring.material.opacity = 0.9 * (1 - k);
    }

    this.updateLaunch(dt);
    this.fx.update(dt);

    // câmera suave
    const c = this.cam, k = 1 - Math.pow(0.0015, dt);
    c.tx += (c.gtx - c.tx) * k; c.tz += (c.gtz - c.tz) * k; c.ty += (c.gty - c.ty) * k * 0.7;
    c.dist += (c.gdist - c.dist) * k; c.az += (c.gaz - c.az) * k;
    this.applyCamera(c.shake ? (Math.random() - 0.5) * c.shake : 0);

    // sombra acompanha a câmera
    const ext = Math.min(52, Math.max(12, c.dist * 1.5));
    const sc = this.sun.shadow.camera;
    if (sc.right !== ext) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }
    this.sun.position.set(c.tx + 14, 26, c.tz + 9);
    this.sun.target.position.set(c.tx, 0, c.tz);

    this.water.position.y = -0.34 + Math.sin(this.t * 0.8) * 0.02;
    this.renderer.render(this.scene, this.camera);
  }
}

/* ---------- ícones: renderiza cada item e máquina uma vez para a interface ---------- */
export function makeIcons() {
  const size = 128;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(size, size);
  r.setPixelRatio(1);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a9aa8', 2.2));
  const d = new THREE.DirectionalLight('#ffffff', 2.2);
  d.position.set(3, 5, 4);
  scene.add(d);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const out = { url: {}, canvas: {} };
  const shoot = (key, obj) => {
    scene.add(obj);
    const box = new THREE.Box3().setFromObject(obj);
    const sph = box.getBoundingSphere(new THREE.Sphere());
    const dist = sph.radius / Math.sin((cam.fov * Math.PI / 180) / 2) * 1.02;
    cam.position.set(sph.center.x + dist * 0.62, sph.center.y + dist * 0.55, sph.center.z + dist * 0.56);
    cam.lookAt(sph.center);
    r.render(scene, cam);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    cv.getContext('2d').drawImage(r.domElement, 0, 0);
    out.canvas[key] = cv;
    out.url[key] = cv.toDataURL();
    scene.remove(obj);
  };
  for (const it of Object.keys(ITEMS)) shoot(it, new THREE.Mesh(MD.itemGeo(it), MD.toyMat));
  for (const m of Object.keys(MACHINES)) {
    if (m === 'sede') { shoot(m, MD.hubModel(3)); continue; }
    if (m === 'esteira') {
      const g = new THREE.Group();
      const bg = MD.beltGeos();
      g.add(new THREE.Mesh(bg.body, MD.toyMat));
      const t = new THREE.Mesh(bg.top, new THREE.MeshStandardMaterial({ map: MD.beltTexture() }));
      g.add(t);
      const it = new THREE.Mesh(MD.itemGeo('barra_cobre'), MD.toyMat);
      it.position.set(0.1, 0.12, 0);
      g.add(it);
      shoot(m, g);
      continue;
    }
    const g = MD.machineModel(m);
    if (m === 'plataforma') MD.rocketGeos().forEach((geo) => { const x = new THREE.Mesh(geo, MD.toyMat); x.position.y = 0.24; g.add(x); });
    shoot(m, g);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}
