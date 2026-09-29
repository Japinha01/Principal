/* ============================================================
   BALSA FURADA — cena 3D
   Margens, pedras, árvores, água com ondinhas, a balsa, os
   bonecos, os tesouros, respingos e a câmera em terceira pessoa.
   ============================================================ */
import * as THREE from 'three';
import { RAFT, ESTACOES, CEUS, clamp, lerp } from './data.js';
import { groundY } from './river.js';
import * as MD from './models.js';

const dummy = new THREE.Object3D();
const tmpV = new THREE.Vector3();
const tmpC = new THREE.Color();
const DISTS = [-3.5, -1.2, 0, 0.5, 1.4, 2.8, 4.6, 7, 10, 14, 19, 26, 35, 48, 65, 85];

export class View {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#bfe9ff', 40, 150);
    scene.background = new THREE.Color('#7fcaf5');
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);

    this.hemi = new THREE.HemisphereLight('#e6f6ff', '#6f9a5c', 1.2);
    const sun = this.sun = new THREE.DirectionalLight('#fff4dc', 2.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    scene.add(this.hemi, sun, sun.target);

    // água que acompanha a balsa
    const wg = new THREE.PlaneGeometry(200, 200, 70, 70);
    wg.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.MeshStandardMaterial({ color: '#3aa7c9', roughness: 0.15, metalness: 0.08, transparent: true, opacity: 0.88, flatShading: true });
    this.water = new THREE.Mesh(wg, this.waterMat);
    this.water.receiveShadow = true;
    scene.add(this.water);

    // espuma que desce o rio
    this.foamN = 260;
    this.foam = new THREE.InstancedMesh(new THREE.CircleGeometry(0.22, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }), this.foamN);
    this.foam.frustumCulled = false;
    this.foamP = Array.from({ length: this.foamN }, () => ({ x: 0, z: -9999, s: 1 }));
    scene.add(this.foam);

    // respingos
    this.dropN = 300;
    this.drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.08, 0), new THREE.MeshStandardMaterial({ color: '#e6f7ff', roughness: 0.2 }), this.dropN);
    this.drops.frustumCulled = false;
    this.dropP = Array.from({ length: this.dropN }, () => ({ life: 0 }));
    this.dropI = 0;
    scene.add(this.drops);

    // balsa
    this.raft = MD.makeRaft();
    scene.add(this.raft.g);
    this.holeMeshes = new Map();
    this.itemMeshes = new Map();
    this.playerMeshes = new Map();

    // corda da boia
    this.corda = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#f0e0b0' }));
    this.corda.visible = false;
    this.cordaT = 0;
    scene.add(this.corda);
    this.boiaVoando = MD.mesh(new THREE.TorusGeometry(0.28, 0.09, 8, 18), new THREE.MeshStandardMaterial({ color: '#ff5a4e' }));
    this.boiaVoando.visible = false;
    scene.add(this.boiaVoando);

    this.world = new THREE.Group();
    scene.add(this.world);

    this.shake = 0;
    this.camYaw = 0;
    this.camPitch = 0.35;
    this.camDist = 6;
    this.camPos = new THREE.Vector3(0, 5, -8);
    this.camTarget = new THREE.Vector3();
    this.t = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ---------- monta o cenário de um trecho ---------- */
  setRiver(river, level) {
    this.river = river;
    const w = this.world;
    while (w.children.length) {
      const c = w.children.pop();
      c.traverse((o) => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); });
    }
    const ceu = this.ceu = CEUS[(Math.max(1, level) - 1) % CEUS.length];
    this.scene.background.set(ceu.ceu);
    this.scene.fog.color.set(ceu.nevoa);
    this.scene.fog.near = ceu.noite > 0.5 ? 18 : 40;
    this.scene.fog.far = ceu.noite > 0.5 ? 85 : 150;
    this.hemi.color.set(ceu.hemi);
    this.hemi.groundColor.set(ceu.chao);
    this.hemi.intensity = 0.55 + (1 - ceu.noite) * 0.75;
    this.sun.color.set(ceu.sol);
    this.sun.intensity = ceu.luz;
    this.waterMat.color.set(ceu.agua);
    this.foam.material.opacity = 0.55 - ceu.noite * 0.4;
    this.raft.luzLamp.intensity = ceu.noite > 0.3 ? 5 * ceu.noite + 1 : 0;
    this.raft.vidro.material.color.set(ceu.noite > 0.3 ? '#ffcf70' : '#8a7a5a');

    // terreno: uma grade que segue a curva do rio
    const z0 = -90, z1 = river.len + 140, dz = 2;
    const rows = Math.ceil((z1 - z0) / dz) + 1;
    const cols = [];
    for (let i = DISTS.length - 1; i >= 0; i--) cols.push([-1, DISTS[i]]);
    cols.push([0, 0]);
    for (const d of DISTS) cols.push([1, d]);
    const nc = cols.length;
    const pos = new Float32Array(rows * nc * 3), col = new Float32Array(rows * nc * 3);
    const areia = new THREE.Color('#e3cf98'), fundo = new THREE.Color('#7d6c50'), grama = new THREE.Color(ceu.chao).lerp(new THREE.Color('#7fbf5a'), 0.55), grama2 = new THREE.Color(ceu.chao), terra = new THREE.Color('#9a7a52');
    for (let r = 0; r < rows; r++) {
      const z = z0 + r * dz, c = river.cx(z), hw = river.hw(z);
      for (let k = 0; k < nc; k++) {
        const [s, d] = cols[k];
        const x = s === 0 ? c : c + s * (hw + d);
        const y = s === 0 ? -1.6 : groundY(river, x, z);
        const o = (r * nc + k) * 3;
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
        const ruido = (Math.sin(x * 0.37 + z * 0.23) + Math.sin(x * 0.11 - z * 0.3)) * 0.25 + 0.5;
        if (s === 0 || d < -0.5) tmpC.copy(fundo);
        else if (d < 1.0) tmpC.copy(areia);
        else if (d < 2.2) tmpC.copy(areia).lerp(grama, 0.6);
        else tmpC.copy(grama).lerp(grama2, ruido).lerp(terra, d > 40 ? 0.25 * ruido : 0);
        col[o] = tmpC.r; col[o + 1] = tmpC.g; col[o + 2] = tmpC.b;
      }
    }
    const idx = [];
    for (let r = 0; r < rows - 1; r++) for (let k = 0; k < nc - 1; k++) {
      const a = r * nc + k, b = a + 1, c2 = a + nc, d2 = c2 + 1;
      idx.push(a, c2, b, b, c2, d2);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    tg.setIndex(idx);
    tg.computeVertexNormals();
    const terreno = new THREE.Mesh(tg, MD.flatMat);
    terreno.receiveShadow = true;
    w.add(terreno);

    // pedras do rio
    const rocks = new THREE.InstancedMesh(MD.rockGeo, MD.flatMat, river.rocks.length + 200);
    rocks.castShadow = true; rocks.receiveShadow = true;
    let n = 0;
    for (const k of river.rocks) {
      dummy.position.set(k.x, -0.2, k.z);
      dummy.rotation.set(0, k.id * 1.3, 0);
      dummy.scale.set(k.r * 1.05, k.r * 0.9 + 0.3, k.r * 1.05);
      dummy.updateMatrix();
      rocks.setMatrixAt(n++, dummy.matrix);
    }
    // pedras de enfeite nas margens
    for (let i = 0; i < 200; i++) {
      const z = z0 + 30 + ((i * 97) % (z1 - z0 - 60)), s = i % 2 ? 1 : -1;
      const d = ((i * 37) % 60) / 10;
      const x = river.cx(z) + s * (river.hw(z) + d);
      const r = 0.3 + ((i * 13) % 10) / 12;
      dummy.position.set(x, groundY(river, x, z) - 0.1, z);
      dummy.rotation.set(0, i, 0);
      dummy.scale.set(r, r * 0.8, r);
      dummy.updateMatrix();
      rocks.setMatrixAt(n++, dummy.matrix);
    }
    rocks.count = n;
    rocks.computeBoundingSphere();
    w.add(rocks);

    // espuma em volta das pedras
    const rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.85, 1.15, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45 - ceu.noite * 0.3, depthWrite: false }), Math.max(1, river.rocks.length));
    river.rocks.forEach((k, i) => {
      dummy.position.set(k.x, 0.06, k.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(k.r * 1.1, 1, k.r * 1.25);
      dummy.updateMatrix();
      rings.setMatrixAt(i, dummy.matrix);
    });
    rings.computeBoundingSphere();
    w.add(rings);
    this.rings = rings;

    // árvores
    const tr = river.trees;
    const trunks = new THREE.InstancedMesh(MD.trunkGeo, MD.toyMat, tr.length);
    const pines = new THREE.InstancedMesh(MD.pineGeo, MD.flatMat, tr.length);
    const bushes = new THREE.InstancedMesh(MD.bushGeo, MD.flatMat, tr.length);
    let np = 0, nb = 0;
    tr.forEach((t, i) => {
      const y = groundY(river, t.x, t.z) - 0.05;
      dummy.position.set(t.x, y, t.z);
      dummy.rotation.set(0, t.k * 6.28, 0);
      dummy.scale.setScalar(t.s * 1.3);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      if (t.k < 0.6) pines.setMatrixAt(np++, dummy.matrix); else bushes.setMatrixAt(nb++, dummy.matrix);
    });
    pines.count = np; bushes.count = nb;
    for (const m of [trunks, pines, bushes]) { m.castShadow = true; m.receiveShadow = true; m.computeBoundingSphere(); w.add(m); }

    // juncos na beira
    const reeds = new THREE.InstancedMesh(MD.reedGeo, MD.toyMat, 260);
    let nr = 0;
    for (let i = 0; i < 260; i++) {
      const z = z0 + 40 + ((i * 53.3) % (z1 - z0 - 80)), s = i % 2 ? 1 : -1;
      const x = river.cx(z) + s * (river.hw(z) + 0.2 + ((i * 7) % 10) / 12);
      dummy.position.set(x, groundY(river, x, z) - 0.1, z);
      dummy.rotation.set(0, i * 2.1, 0);
      dummy.scale.setScalar(0.8 + ((i * 3) % 5) / 10);
      dummy.updateMatrix();
      reeds.setMatrixAt(nr++, dummy.matrix);
    }
    reeds.computeBoundingSphere();
    w.add(reeds);

    // cais de saída e porto de chegada (margem direita)
    const zs = 8, cais = MD.makeDock(false);
    cais.position.set(river.cx(zs) + river.hw(zs) - 1.5, 0, zs);
    w.add(cais);
    const zp = river.len - 6, porto = MD.makeDock(true);
    porto.position.set(river.cx(zp) + river.hw(zp) - 1.5, 0, zp);
    w.add(porto);
    this.porto = porto;
    for (const l of porto.userData.luzes || []) l.intensity = ceu.noite > 0.3 ? 8 : 0;

    // limpa espuma velha
    for (const f of this.foamP) f.z = -9999;
  }

  /* ---------- efeitos ---------- */
  splash(x, z, s = 1, y = 0) {
    const n = Math.round(10 + s * 18);
    for (let i = 0; i < n; i++) {
      const p = this.dropP[this.dropI = (this.dropI + 1) % this.dropN];
      const a = Math.random() * 6.28, v = (1 + Math.random() * 2.5) * s;
      Object.assign(p, { x, y: y + 0.05, z, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 2.5 + Math.random() * 3.5 * s, life: 0.6 + Math.random() * 0.6, sc: 0.6 + Math.random() * 1.1 });
    }
  }
  kick(a) { this.shake = Math.max(this.shake, a); }
  lancaBoia(from, to) {
    this.cordaFrom = from.clone();
    this.cordaTo = to.clone();
    this.cordaT = 0.001;
  }

  /* ---------- sincroniza com o estado a cada quadro ---------- */
  // v: { raft, holes, items, players, meId, me, pumpAnim, boiaCd, t }
  update(dt, v) {
    this.t += dt;
    const t = this.t, R = v.raft, rio = this.river;
    if (!rio) return;
    const raftG = this.raft.g;

    // balsa: afunda com a água e com o peso, balança nas ondas
    const bob = Math.sin(t * 1.6) * 0.04 + Math.sin(t * 2.7 + 1) * 0.02;
    const afund = v.phase === 'afundou' ? Math.min(1.6, v.sunkT * 0.5) : 0;
    const sink = R.water * 0.28 + Math.min(0.15, v.carga * 0.0025) + afund;
    raftG.position.set(R.x, bob - sink, R.z);
    const rapids = rio.inRapids(R.z) ? 1 : 0;
    raftG.rotation.z = Math.sin(t * 1.3) * 0.02 + clamp(-R.vx * 0.02, -0.08, 0.08) + rapids * Math.sin(t * 7) * 0.015 + (Math.random() - 0.5) * this.shake * 0.05;
    raftG.rotation.x = Math.sin(t * 1.1 + 2) * 0.015 + rapids * Math.sin(t * 5.3) * 0.02 + afund * 0.15;
    this.raft.leme.rotation.y = lerp(this.raft.leme.rotation.y, -R.rudder * 0.55, Math.min(1, dt * 8));
    this.raft.alavanca.rotation.z = v.pumping ? Math.sin(t * 11) * 0.45 : lerp(this.raft.alavanca.rotation.z, 0, dt * 5);
    this.raft.boia.visible = !v.boiaCd;
    const ag = this.raft.agua;
    ag.material.opacity = Math.min(0.78, R.water * 3.2);
    ag.position.y = RAFT.DECK_Y + 0.02 + R.water * 0.3;
    ag.visible = R.water > 0.005;

    // furos
    const hs = new Set();
    for (const h of v.holes) {
      hs.add(h[0]);
      let m = this.holeMeshes.get(h[0]);
      if (!m) { m = MD.makeHole(); this.holeMeshes.set(h[0], m); raftG.add(m); }
      m.position.set(h[1], RAFT.DECK_Y + 0.005, h[2]);
      const j = m.userData.jato;
      j.scale.y = 0.6 + Math.abs(Math.sin(t * 9 + h[0])) * 0.8;
      j.visible = R.water < 0.9;
    }
    for (const [id, m] of this.holeMeshes) if (!hs.has(id)) { raftG.remove(m); this.holeMeshes.delete(id); }

    // bonecos
    const ps = new Set();
    for (const p of v.players) {
      ps.add(p.id);
      let m = this.playerMeshes.get(p.id);
      if (!m || m.cor !== p.cor || m.nome !== p.name) {
        if (m) m.g.parent?.remove(m.g);
        m = MD.makePlayer(p.cor);
        m.cor = p.cor; m.nome = p.name;
        m.label = MD.makeLabel(p.name, p.cor);
        m.label.position.y = 1.75;
        m.g.add(m.label);
        this.playerMeshes.set(p.id, m);
      }
      m.label.visible = p.id !== v.meId;
      const naAgua = p.m === 'water' || p.m === 'ghost';
      const pai = naAgua ? this.scene : raftG;
      if (m.g.parent !== pai) pai.add(m.g);
      m.g.visible = p.m !== 'ghost';
      if (naAgua) m.g.position.set(p.x, -0.62 + Math.sin(t * 3 + p.x) * 0.06, p.z);
      else m.g.position.set(p.x, RAFT.DECK_Y + p.y, p.z);
      m.g.rotation.y = p.ry;
      // animação
      const andando = p.an === 1, rema = p.an === 2;
      m.corpo.rotation.x = rema ? 0.9 : andando ? 0.08 : 0;
      m.corpo.position.y = andando ? Math.abs(Math.sin(t * 11 + p.x)) * 0.08 : 0;
      m.corpo.rotation.z = andando ? Math.sin(t * 11 + p.x) * 0.06 : 0;
      const bomba = p.an === 3, leme = p.an === 4, carrega = !!p.carry;
      m.maoE.position.set(-0.36, carrega ? 0.95 : bomba ? 0.6 + Math.sin(t * 11) * 0.12 : rema ? 0.7 + Math.sin(t * 6) * 0.2 : 0.52, carrega || leme || bomba ? 0.3 : 0.08);
      m.maoD.position.set(0.36, carrega ? 0.95 : bomba ? 0.6 + Math.sin(t * 11) * 0.12 : rema ? 0.7 - Math.sin(t * 6) * 0.2 : 0.52, carrega || leme || bomba ? 0.3 : 0.08);
      m.chapeu.rotation.z = Math.sin(t * 2 + p.x) * 0.04;
      if (rema && Math.random() < dt * 3) this.splash(p.x + Math.sin(p.ry) * 0.5, p.z + Math.cos(p.ry) * 0.5, 0.2);
    }
    for (const [id, m] of this.playerMeshes) if (!ps.has(id)) { m.g.parent?.remove(m.g); this.playerMeshes.delete(id); }

    // itens
    const is = new Set();
    for (const it of v.items) {
      const [id, k, s, x, z, , by] = it;
      is.add(id);
      let m = this.itemMeshes.get(id);
      if (!m) { m = MD.makeItem(k); m.userData.rot = (id * 1.7) % 6.28; this.itemMeshes.set(id, m); }
      if (s === 'c') {
        const dono = this.playerMeshes.get(by);
        if (dono) {
          if (m.parent !== dono.mao) dono.mao.add(m);
          m.position.set(0, -0.25, 0);
          m.rotation.set(0, 0, 0);
          m.scale.setScalar(k === 'bau' ? 0.8 : 1);
        } else if (m.parent) m.parent.remove(m);
      } else if (s === 'd') {
        if (m.parent !== raftG) raftG.add(m);
        m.position.set(x, RAFT.DECK_Y, z);
        m.rotation.set(0, m.userData.rot, 0);
        m.scale.setScalar(1);
      } else {
        if (m.parent !== this.scene) this.scene.add(m);
        m.position.set(x, -0.18 + Math.sin(t * 2 + id) * 0.06, z);
        m.rotation.set(Math.sin(t * 1.3 + id) * 0.15, m.userData.rot + t * 0.2, Math.cos(t * 1.1 + id) * 0.15);
        m.scale.setScalar(1);
      }
    }
    for (const [id, m] of this.itemMeshes) if (!is.has(id)) { m.parent?.remove(m); this.itemMeshes.delete(id); }

    // barqueiro olha a balsa
    const bq = this.porto?.userData.barqueiro;
    if (bq) bq.corpo.position.y = Math.abs(Math.sin(t * 2)) * 0.04;

    // água com ondinhas, sempre em volta da balsa
    const cx = Math.round(R.x / 200 * 70) * 200 / 70, cz = Math.round(R.z / 200 * 70) * 200 / 70;
    this.water.position.set(cx, 0, cz);
    const wp = this.water.geometry.attributes.position;
    const amp = 1 + rapids * 1.5;
    for (let i = 0; i < wp.count; i++) {
      const x = wp.getX(i) + cx, z = wp.getZ(i) + cz;
      wp.setY(i, (Math.sin(x * 0.6 + t * 1.4) * 0.06 + Math.sin(z * 0.45 - t * 2.2 + x * 0.3) * 0.05) * amp);
    }
    wp.needsUpdate = true;

    // espuma descendo o rio
    const cur = rio.current(R.z);
    for (let i = 0; i < this.foamN; i++) {
      const f = this.foamP[i];
      f.z += rio.current(f.z) * dt;
      f.x += rio.slope(f.z) * rio.current(f.z) * dt;
      if (f.z < R.z - 30 || f.z > R.z + 70 || Math.abs(f.x - rio.cx(f.z)) > rio.hw(f.z)) {
        f.z = R.z - 25 + Math.random() * 95;
        f.x = rio.cx(f.z) + (Math.random() * 2 - 1) * rio.hw(f.z);
        f.s = 0.4 + Math.random() * (rio.inRapids(f.z) ? 2.4 : 1);
        if (!rio.inRapids(f.z) && Math.random() < 0.55) f.z = -9999;
      }
      dummy.position.set(f.x, 0.09, f.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(f.s, 1, f.s * (1 + cur * 0.35));
      dummy.updateMatrix();
      this.foam.setMatrixAt(i, dummy.matrix);
    }
    this.foam.instanceMatrix.needsUpdate = true;
    // espuma na proa da balsa em movimento
    if (Math.random() < dt * (R.vz * 2.2)) this.splash(R.x + (Math.random() - 0.5) * RAFT.W, R.z + RAFT.L / 2 + 0.3, 0.25);

    // respingos
    for (let i = 0; i < this.dropN; i++) {
      const p = this.dropP[i];
      if (p.life > 0) {
        p.life -= dt;
        p.vy -= 14 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < -0.1) p.life = 0;
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(p.life > 0 ? p.sc : 0);
      } else dummy.scale.setScalar(0);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      this.drops.setMatrixAt(i, dummy.matrix);
    }
    this.drops.instanceMatrix.needsUpdate = true;

    // corda da boia
    if (this.cordaT > 0) {
      this.cordaT += dt;
      const k = Math.min(1, this.cordaT / 0.45);
      const pts = this.corda.geometry.attributes.position;
      const a = this.cordaFrom, b = this.cordaTo;
      tmpV.lerpVectors(a, b, k);
      tmpV.y += Math.sin(k * Math.PI) * 2;
      pts.setXYZ(0, a.x, a.y, a.z);
      pts.setXYZ(1, tmpV.x, tmpV.y, tmpV.z);
      pts.needsUpdate = true;
      this.corda.visible = true;
      this.boiaVoando.visible = true;
      this.boiaVoando.position.copy(tmpV);
      this.boiaVoando.rotation.x = Math.PI / 2;
      if (this.cordaT > 1.1) { this.cordaT = 0; this.corda.visible = false; this.boiaVoando.visible = false; }
    }

    // sol acompanha a balsa (sombras)
    this.sun.position.set(R.x + 18, 30, R.z - 10);
    this.sun.target.position.set(R.x, 0, R.z + 4);

    // câmera em terceira pessoa
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const alvo = v.camTarget;
    // teleporte (trecho novo, resgate): pula a câmera direto para o lugar
    const pulo = this.camTarget.distanceTo(alvo) > 12;
    this.camTarget.lerp(alvo, pulo ? 1 : Math.min(1, dt * 12));
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const want = tmpV.set(
      this.camTarget.x - Math.sin(this.camYaw) * cp * this.camDist,
      this.camTarget.y + sp * this.camDist,
      this.camTarget.z - Math.cos(this.camYaw) * cp * this.camDist);
    // não deixa a câmera entrar no chão da margem
    const chao = groundY(rio, want.x, want.z) + 0.6;
    want.y = Math.max(want.y, chao, 0.35);
    this.camPos.lerp(want, pulo ? 1 : Math.min(1, dt * 14));
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) this.camera.position.add(tmpV.set((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake).multiplyScalar(0.35));
    this.camera.lookAt(this.camTarget);
    this.renderer.render(this.scene, this.camera);
  }
}
