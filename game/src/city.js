// IRON TIDE — city: Rustport, a rainy industrial port town on the River
// Voss. A 10x10 grid of blocks west of the river, a container yard and
// cranes in the north, a steel bridge at z = 0, a runway across the
// river, and fourteen named districts. Buildings are procedural boxes
// with lit windows (an emissive canvas texture), street lamps, neon
// shop signs, stacked containers, cranes, a moored freighter and rain.
// The module also answers the gameplay questions: is a point on a road,
// which district is it in, and does a car-sized box hit a building.
import { THREE } from './three.js';
import { CITY, DISTRICTS, SHOPS, SAFEHOUSES, STUNT_JUMPS, COLLECTIBLES } from './tuning.js';
import { makeRng } from './rng.js';

function windowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#11141c'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      const lit = rng.chance(0.42);
      g.fillStyle = lit ? (rng.chance(0.7) ? '#ffd27a' : '#7fd0ff') : '#1c2433';
      g.fillRect(x, y, 8, 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function roadAt(x, z) {
  const p = CITY.pitch;
  const half = CITY.half;
  if (Math.abs(x) > half + CITY.roadWidth || Math.abs(z) > half + CITY.roadWidth) {
    // bridge deck counts as road
    if (Math.abs(z - CITY.bridgeZ) < CITY.roadWidth / 2 && x > -half && x < CITY.riverX + CITY.riverWidth) return true;
    return false;
  }
  const mx = ((x + half) % p + p) % p;
  const mz = ((z + half) % p + p) % p;
  return mx < CITY.roadWidth || mx > p - 1 || mz < CITY.roadWidth || mz > p - 1
    || mx < 1 || mz < 1;
}

export function districtAt(x, z) {
  const p = CITY.pitch;
  const bx = Math.floor((x + CITY.half) / p) - 5;
  const bz = Math.floor((z + CITY.half) / p) - 5;
  for (const d of DISTRICTS) {
    if (bx >= d.x0 && bx <= d.x1 && bz >= d.z0 && bz <= d.z1) return d;
  }
  if (x > CITY.riverX) return { name: 'Airfield', x0: 0, x1: 4, z0: 5, z1: 5, color: '#90a4ae' };
  return DISTRICTS[5];
}

export class City {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = makeRng(seed);
    this.buildings = [];   // {x, z, hw, hd, h}
    this.lamps = [];
    this.neonSigns = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildGround();
    this.buildBlocks();
    this.buildPort();
    this.buildBridge();
    this.buildAirport();
    this.buildShops();
    this.buildRain();
    this.buildCollectibles();
  }

  buildGround() {
    const g = new THREE.Group();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshStandardMaterial({ color: 0x2c3430, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    g.add(ground);
    // river
    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.riverWidth + 30, 900),
      new THREE.MeshStandardMaterial({ color: 0x14324a, roughness: 0.25, metalness: 0.55 }),
    );
    river.rotation.x = -Math.PI / 2;
    river.position.set(CITY.riverX + 10, 0.05, 0);
    g.add(river);
    // roads: dark asphalt strips over the grid
    const p = CITY.pitch;
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.6, metalness: 0.25 });
    for (let i = 0; i <= CITY.blocks; i += 1) {
      const c = -CITY.half + i * p - CITY.roadWidth / 2;
      const h = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + CITY.roadWidth, CITY.roadWidth), roadMat);
      h.rotation.x = -Math.PI / 2; h.position.set(0, 0.06, c); g.add(h);
      const v = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, CITY.half * 2 + CITY.roadWidth), roadMat);
      v.rotation.x = -Math.PI / 2; v.position.set(c, 0.06, 0); g.add(v);
    }
    // centre dashes
    const dashMat = new THREE.MeshBasicMaterial({ color: 0x8a8f5a });
    for (let i = 0; i <= CITY.blocks; i += 1) {
      const c = -CITY.half + i * p - CITY.roadWidth / 2;
      for (let d = -CITY.half; d < CITY.half; d += 8) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), dashMat);
        dash.rotation.x = -Math.PI / 2; dash.position.set(d + 4, 0.08, c); g.add(dash);
      }
    }
    this.group.add(g);
  }

  buildBlocks() {
    const rng = this.rng;
    const winTex = windowTexture(rng);
    const p = CITY.pitch;
    const palette = [0x3a4250, 0x4a3f35, 0x39424e, 0x51463a, 0x333d47, 0x5a4a3a];
    for (let bx = 0; bx < CITY.blocks; bx += 1) {
      for (let bz = 0; bz < CITY.blocks; bz += 1) {
        const cx = -CITY.half + CITY.roadWidth + bx * p + CITY.blockSize / 2;
        const cz = -CITY.half + CITY.roadWidth + bz * p + CITY.blockSize / 2;
        // skip the port yard blocks (north-west corner is containers)
        if (bz === 0 && bx <= 1) continue;
        const n = rng.int(1, 3);
        for (let k = 0; k < n; k += 1) {
          const w = rng.range(8, 15);
          const d = rng.range(8, 15);
          const h = rng.range(7, 34) * (bx >= 7 ? 1.6 : 1);
          const ox = rng.range(-8, 8);
          const oz = rng.range(-8, 8);
          const mat = new THREE.MeshStandardMaterial({
            color: palette[rng.int(0, palette.length - 1)],
            roughness: 0.85, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.55,
          });
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          b.position.set(cx + ox, h / 2, cz + oz);
          b.castShadow = true; b.receiveShadow = true;
          this.group.add(b);
          this.buildings.push({ x: cx + ox, z: cz + oz, hw: w / 2 + 0.4, hd: d / 2 + 0.4, h });
        }
        // street lamps at the block corners
        for (const [lx, lz] of [[cx - 17, cz - 17], [cx + 17, cz + 17]]) {
          if (rng.chance(0.6)) this.addLamp(lx, lz);
        }
      }
    }
  }

  addLamp(x, z) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 }),
    );
    pole.position.set(x, 2.7, z);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd27a }),
    );
    bulb.position.set(x, 5.5, z);
    this.group.add(pole, bulb);
    // Real point lights are expensive: only every ninth lamp gets one,
    // the rest read as lit bulbs. Night still glows; the GPU survives.
    if (this.lamps.length % 9 === 0) {
      const light = new THREE.PointLight(0xffc46b, 14, 26, 1.8);
      light.position.set(x, 5.4, z);
      this.group.add(light);
      this.lamps.push(light);
    }
  }

  buildPort() {
    const rng = this.rng;
    // container yard in the north-west blocks
    const contColors = [0xc0392b, 0x2471a3, 0x1e8449, 0xd4ac0d, 0x7d3c98, 0xca6f1e];
    for (let i = 0; i < 42; i += 1) {
      const x = -CITY.half + 20 + rng.range(0, 70);
      const z = -CITY.half + 8 + rng.range(0, 40);
      const stack = rng.int(1, 3);
      for (let s = 0; s < stack; s += 1) {
        const c = new THREE.Mesh(
          new THREE.BoxGeometry(12, 2.6, 2.6),
          new THREE.MeshStandardMaterial({ color: contColors[rng.int(0, 5)], roughness: 0.7, metalness: 0.3 }),
        );
        c.position.set(x, 1.3 + s * 2.6, z);
        c.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
        c.castShadow = true;
        this.group.add(c);
      }
      this.buildings.push({ x, z, hw: 6.4, hd: 6.4, h: 8 });
    }
    // two gantry cranes
    for (const cx of [-170, -110]) {
      const crane = new THREE.Group();
      const legMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, roughness: 0.6, metalness: 0.4 });
      for (const [lx, lz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 34, 1.2), legMat);
        leg.position.set(lx, 17, lz);
        crane.add(leg);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(46, 2, 3), legMat);
      beam.position.set(10, 34, 0);
      crane.add(beam);
      const hook = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), legMat);
      hook.position.set(24, 28, 0);
      crane.add(hook);
      crane.position.set(cx, 0, -CITY.half + 24);
      this.group.add(crane);
    }
    // moored freighter on the river
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(60, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.6, metalness: 0.4 }),
    );
    hull.position.set(CITY.riverX + 8, 2.5, -120);
    this.group.add(hull);
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(14, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xecf0f1, roughness: 0.7 }),
    );
    deck.position.set(CITY.riverX + 8, 9, -142);
    this.group.add(deck);
  }

  buildBridge() {
    // A thin deck flush with the road surface, so cars drive ON the
    // bridge instead of under it, with twin steel arches over the road.
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(CITY.riverWidth + 90, 0.24, CITY.roadWidth + 4),
      new THREE.MeshStandardMaterial({ color: 0x3d4450, roughness: 0.6, metalness: 0.4 }),
    );
    deck.position.set(CITY.half + 40, -0.02, CITY.bridgeZ);
    deck.receiveShadow = true;
    this.group.add(deck);
    // twin steel arches
    const archMat = new THREE.MeshStandardMaterial({ color: 0xb03a2e, roughness: 0.5, metalness: 0.5 });
    for (const dz of [-7, 7]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(11, 0.8, 8, 24, Math.PI), archMat);
      arch.position.set(CITY.half + 40, 0.2, CITY.bridgeZ + dz);
      arch.rotation.y = Math.PI / 2;
      this.group.add(arch);
    }
    // approach ramps on both banks
    for (const rx of [CITY.half - 20, CITY.riverX + CITY.riverWidth / 2 + 18]) {
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(42, 0.24, CITY.roadWidth + 4),
        new THREE.MeshStandardMaterial({ color: 0x3d4450, roughness: 0.7 }),
      );
      ramp.position.set(rx, -0.02, CITY.bridgeZ);
      this.group.add(ramp);
    }
  }

  buildAirport() {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 16),
      new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.5 }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(CITY.airportX, 0.07, CITY.airportZ);
    this.group.add(strip);
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 4, 22, 10),
      new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.8 }),
    );
    tower.position.set(CITY.airportX - 40, 11, CITY.airportZ + 24);
    this.group.add(tower);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(9, 4, 9),
      new THREE.MeshStandardMaterial({ color: 0x2e86c1, roughness: 0.4, emissive: 0x2e86c1, emissiveIntensity: 0.4 }),
    );
    cab.position.set(CITY.airportX - 40, 24, CITY.airportZ + 24);
    this.group.add(cab);
    this.buildings.push({ x: CITY.airportX - 40, z: CITY.airportZ + 24, hw: 5, hd: 5, h: 26 });
  }

  buildShops() {
    for (const s of [...SHOPS, ...SAFEHOUSES]) {
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(10, 2.2, 0.6),
        new THREE.MeshBasicMaterial({ color: s.kind === 'gun' ? 0xff5533 : s.kind === 'garage' ? 0xffb02e : 0x33ccff }),
      );
      sign.position.set(s.x, 6.5, s.z - 6);
      this.group.add(sign);
      this.neonSigns.push(sign);
      const hut = new THREE.Mesh(
        new THREE.BoxGeometry(12, 5, 10),
        new THREE.MeshStandardMaterial({ color: 0x4a4a55, roughness: 0.85 }),
      );
      hut.position.set(s.x, 2.5, s.z);
      hut.castShadow = true;
      this.group.add(hut);
      this.buildings.push({ x: s.x, z: s.z, hw: 6.2, hd: 5.2, h: 5 });
    }
  }

  buildRain() {
    // rain as a Points cloud that falls and recycles; toggled by weather
    const count = 2600;
    const pos = new Float32Array(count * 3);
    const rng = makeRng(99);
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = rng.range(-260, 380);
      pos[i * 3 + 1] = rng.range(0, 60);
      pos[i * 3 + 2] = rng.range(-260, 260);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x9fc8e8, size: 0.35, transparent: true, opacity: 0.55,
    }));
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  buildCollectibles() {
    // 20 hidden packages: small glowing gold crates scattered on rooftops
    // of low blocks and beside landmarks; positions are deterministic.
    const rng = makeRng(4242);
    this.packages = [];
    const spots = [];
    for (let i = 0; i < COLLECTIBLES; i += 1) {
      const x = rng.range(-CITY.half + 20, CITY.half - 20);
      const z = rng.range(-CITY.half + 20, CITY.half - 20);
      spots.push({ x, z });
    }
    for (const s of spots) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 1.4, 1.4),
        new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 1.2, roughness: 0.3 }),
      );
      m.position.set(s.x, 1.2, s.z);
      this.scene.add(m);
      this.packages.push({ mesh: m, x: s.x, z: s.z, taken: false });
    }
  }

  // Push a circle (player or car) out of every building box it overlaps.
  // Returns true when a collision happened.
  collide(x, z, radius) {
    let hit = false;
    for (const b of this.buildings) {
      const dx = Math.max(Math.abs(x - b.x) - b.hw, 0);
      const dz = Math.max(Math.abs(z - b.z) - b.hd, 0);
      if (dx * dx + dz * dz < radius * radius) hit = true;
    }
    // river water blocks ground movement except on the bridge deck
    if (x > CITY.riverX - CITY.riverWidth / 2 && x < CITY.riverX + CITY.riverWidth / 2 + 30) {
      if (Math.abs(z - CITY.bridgeZ) > CITY.roadWidth / 2 + 2) hit = true;
    }
    return hit;
  }

  updateRain(dt, active, focusX, focusZ) {
    if (!this.rain) return;
    this.rain.visible = active;
    if (!active) return;
    const pos = this.rain.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      let y = pos.getY(i) - dt * 55;
      if (y < 0) {
        y = 55;
        pos.setX(i, focusX + (Math.random() - 0.5) * 320);
        pos.setZ(i, focusZ + (Math.random() - 0.5) * 320);
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }
}
