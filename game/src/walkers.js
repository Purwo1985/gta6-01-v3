// IRON TIDE — walkers: pedestrians strolling the sidewalks. They walk
// block to block, turn at corners, and panic — sprinting away — when a
// car screams past, a shot rings out, or the player punches nearby.
// A walker is a capsule body with a coloured shirt and a dark head.
import { THREE } from './three.js';
import { CITY, TRAFFIC_TUNE } from './tuning.js';
import { makeRng } from './rng.js';

const SHIRTS = [0xd64545, 0x4a90d9, 0x7bc47f, 0xe6c34a, 0x9b59b6, 0xe67e22, 0xecf0f1, 0x1abc9c];

export class Walkers {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = makeRng(seed + 31);
    this.list = [];
    for (let i = 0; i < TRAFFIC_TUNE.walkers; i += 1) this.spawnOne();
  }

  spawnOne() {
    const rng = this.rng;
    const p = CITY.pitch;
    const roadIdx = rng.int(0, CITY.blocks);
    const c = -CITY.half + roadIdx * p - CITY.roadWidth / 2;
    const along = rng.range(-CITY.half, CITY.half);
    const vertical = rng.chance(0.5);
    const x = vertical ? c + rng.pick([-6.5, 6.5]) : along;
    const z = vertical ? along : c + rng.pick([-6.5, 6.5]);
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.85, 3, 8),
      new THREE.MeshStandardMaterial({ color: SHIRTS[rng.int(0, SHIRTS.length - 1)], roughness: 0.8 }),
    );
    body.position.y = 0.95;
    body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7 }),
    );
    head.position.y = 1.78;
    g.add(body, head);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.list.push({
      group: g, body, head,
      x, z, heading: rng.range(0, Math.PI * 2),
      speed: TRAFFIC_TUNE.walkerSpeed * rng.range(0.8, 1.3),
      panic: 0, retarget: 0,
    });
  }

  scare(x, z, radius) {
    for (const w of this.list) {
      const dx = w.x - x;
      const dz = w.z - z;
      if (dx * dx + dz * dz < radius * radius) {
        w.panic = 3 + Math.random() * 2;
        w.heading = Math.atan2(dx, dz);
      }
    }
  }

  update(dt, playerPos, playerSpeed) {
    for (const w of this.list) {
      w.retarget -= dt;
      if (w.panic > 0) {
        w.panic -= dt;
      } else if (w.retarget <= 0) {
        // pick a new sidewalk heading at random
        w.heading = Math.floor(this.rng.range(0, 4)) * Math.PI / 2;
        w.retarget = this.rng.range(3, 9);
      }
      const sp = w.panic > 0 ? w.speed * 3.2 : w.speed;
      const nx = w.x + Math.sin(w.heading) * sp * dt;
      const nz = w.z + Math.cos(w.heading) * sp * dt;
      // stay on the sidewalks: turn around at the map edge or in the river
      if (Math.abs(nx) > CITY.half + 8 || Math.abs(nz) > CITY.half + 8 || nx > CITY.riverX - 30) {
        w.heading += Math.PI;
      } else {
        w.x = nx; w.z = nz;
      }
      w.group.position.set(w.x, 0, w.z);
      w.group.rotation.y = w.heading;
      // little bob while walking
      w.body.position.y = 0.95 + Math.abs(Math.sin(performance.now() * 0.008 + w.x)) * 0.05;
    }
  }
}
