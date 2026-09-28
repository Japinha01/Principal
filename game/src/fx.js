/* ============================================================
   FUNDIÇÃO 7 — partículas: fumaça, poeira, faíscas e confete
   Duas malhas instanciadas; nada é criado por partícula.
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
    for (const m of [this.puffMesh, this.bitMesh]) {
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

  update(dt) {
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
  }
}
