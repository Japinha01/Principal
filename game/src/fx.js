/* ============================================================
   FUNDIÇÃO 7 — partículas: fumaça, poeira, confete e fogos de artifício
   Três malhas instanciadas; nada é criado por partícula.
   ============================================================ */
import * as THREE from 'three';

const CONFETTI = ['#ff5a4e', '#ffd23f', '#4d8dff', '#3ccf7a', '#ff6fa8', '#8a7dff', '#ffffff'];
const dummy = new THREE.Object3D();
const col = new THREE.Color();

export class FX {
  constructor(scene, max = 700) {
    this.max = max;
    this.puffs = [];
    this.bits = [];
    this.puffMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.5, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.9, transparent: true, opacity: 0.92 }),
      max,
    );
    this.bitMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.12, 0.02, 0.08),
      new THREE.MeshStandardMaterial({ roughness: 0.5, side: THREE.DoubleSide }),
      max,
    );
    // faíscas dos fogos: sem luz (brilham até à noite)
    this.sparks = [];
    this.shells = [];
    this.sparkMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.1, 1),
      new THREE.MeshBasicMaterial({ toneMapped: false }),
      max,
    );
    for (const m of [this.puffMesh, this.bitMesh, this.sparkMesh]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      m.setColorAt(0, col.set('#fff'));
      scene.add(m);
    }
  }

  // fumaça/poeira: sobe, cresce e some
  puff(x, y, z, { n = 1, color = '#ffffff', size = 0.22, spread = 0.08, rise = 0.6, life = 1.6, vx = 0, vz = 0 } = {}) {
    for (let i = 0; i < n && this.puffs.length < this.max; i++) {
      this.puffs.push({
        x: x + (Math.random() - 0.5) * spread, y, z: z + (Math.random() - 0.5) * spread,
        vx: vx + (Math.random() - 0.5) * 0.3, vy: rise * (0.7 + Math.random() * 0.6), vz: vz + (Math.random() - 0.5) * 0.3,
        s: size * (0.7 + Math.random() * 0.6), t: 0, life: life * (0.8 + Math.random() * 0.4), c: color,
      });
    }
  }

  // anel de poeira ao construir/demolir
  dust(x, z, color = '#f4ead8', n = 10) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.puff(x + Math.cos(a) * 0.35, 0.1, z + Math.sin(a) * 0.35, { color, size: 0.18, rise: 0.25, life: 0.8, vx: Math.cos(a) * 0.9, vz: Math.sin(a) * 0.9, spread: 0.05 });
    }
  }

  // confete e faíscas: caem com gravidade e giram
  confetti(x, y, z, n = 60, { power = 5, colors = CONFETTI, gravity = 7, life = 2.6 } = {}) {
    for (let i = 0; i < n && this.bits.length < this.max; i++) {
      const a = Math.random() * Math.PI * 2, s = power * (0.4 + Math.random() * 0.6);
      this.bits.push({
        x, y, z, vx: Math.cos(a) * s * 0.35, vy: s * (0.6 + Math.random() * 0.6), vz: Math.sin(a) * s * 0.35,
        rx: Math.random() * 6, ry: Math.random() * 6, wr: (Math.random() - 0.5) * 14, g: gravity,
        t: 0, life: life * (0.7 + Math.random() * 0.5), c: colors[(Math.random() * colors.length) | 0],
      });
    }
  }

  // fogos de artifício: um rojão sobe deixando rastro e estoura numa esfera de faíscas
  firework(x, z, { h = 5.5 + Math.random() * 2.5, colors, delay = 0 } = {}) {
    const pal = colors || [CONFETTI[(Math.random() * 6) | 0], CONFETTI[(Math.random() * 6) | 0], '#ffffff'];
    this.shells.push({ x, y: 0.4, z, vy: 8 + Math.random() * 1.5, h, t: -delay, pal, trail: 0 });
  }
  spark(x, y, z, { n = 60, colors = CONFETTI, power = 6, life = 1.6, gravity = 2.2, size = 1 } = {}) {
    for (let i = 0; i < n && this.sparks.length < this.max; i++) {
      // direção uniforme na esfera
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const s = power * (0.75 + Math.random() * 0.25);
      this.sparks.push({ x, y, z, vx: r * Math.cos(a) * s, vy: u * s, vz: r * Math.sin(a) * s, g: gravity, t: 0,
        life: life * (0.7 + Math.random() * 0.5), c: colors[(Math.random() * colors.length) | 0], s: size });
    }
  }

  update(dt) {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const f = this.shells[i];
      f.t += dt;
      if (f.t < 0) continue;
      f.y += f.vy * dt;
      f.vy = Math.max(3, f.vy - 6 * dt);
      f.trail -= dt;
      if (f.trail <= 0) { f.trail = 0.03; this.spark(f.x, f.y, f.z, { n: 1, colors: ['#ffe9a8'], power: 0.4, life: 0.5, gravity: 1, size: 0.7 }); }
      if (f.y >= f.h) {
        this.spark(f.x, f.y, f.z, { n: 90, colors: f.pal, power: 4.5 + Math.random() * 1.5 });
        this.shells.splice(i, 1);
        if (this.onBoom) this.onBoom();
      }
    }
    let n = 0;
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.t += dt;
      if (p.t >= p.life) { this.puffs.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vx *= 0.96; p.vz *= 0.96;
      const k = p.t / p.life;
      const s = p.s * (k < 0.2 ? k / 0.2 : 1 + (k - 0.2) * 0.8) * (1 - k * k);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(Math.max(0.001, s));
      dummy.updateMatrix();
      this.puffMesh.setMatrixAt(n, dummy.matrix);
      this.puffMesh.setColorAt(n, col.set(p.c));
      n++;
    }
    this.puffMesh.count = n;
    this.puffMesh.instanceMatrix.needsUpdate = true;
    if (this.puffMesh.instanceColor) this.puffMesh.instanceColor.needsUpdate = true;

    n = 0;
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.t += dt;
      if (b.t >= b.life) { this.bits.splice(i, 1); continue; }
      b.vy -= b.g * dt;
      b.vx *= 0.985; b.vz *= 0.985;
      if (b.vy < -2.2) b.vy = -2.2;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.y < 0.05) { b.y = 0.05; b.vy = 0; b.vx *= 0.8; b.vz *= 0.8; b.wr *= 0.8; }
      b.rx += b.wr * dt; b.ry += b.wr * 0.7 * dt;
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(b.rx, b.ry, 0);
      dummy.scale.setScalar(Math.min(1, (b.life - b.t) * 3));
      dummy.updateMatrix();
      this.bitMesh.setMatrixAt(n, dummy.matrix);
      this.bitMesh.setColorAt(n, col.set(b.c));
      n++;
    }
    this.bitMesh.count = n;
    this.bitMesh.instanceMatrix.needsUpdate = true;
    if (this.bitMesh.instanceColor) this.bitMesh.instanceColor.needsUpdate = true;

    n = 0;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.t += dt;
      if (p.t >= p.life) { this.sparks.splice(i, 1); continue; }
      p.vy -= p.g * dt;
      p.vx *= 0.97; p.vy *= 0.97; p.vz *= 0.97;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = p.t / p.life;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, 0);
      // pisca no fim, como fogo de verdade
      dummy.scale.setScalar(Math.max(0.001, p.s * (1 - k * k) * (k > 0.6 && Math.random() < 0.3 ? 0.3 : 1)));
      dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(n, dummy.matrix);
      this.sparkMesh.setColorAt(n, col.set(p.c).multiplyScalar(1.6));
      n++;
    }
    this.sparkMesh.count = n;
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
  }
  get busy() { return this.shells.length > 0; }
}
