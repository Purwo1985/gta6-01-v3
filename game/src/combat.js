// IRON TIDE — combat: fists and three guns. Punching knocks walkers and
// enemies back; shooting raycasts from the camera centre against enemy
// hit-spheres and cop cars. Tracer lines and a muzzle flash are drawn
// for a few frames. Enemies are simple armed figures used by missions.
import { THREE } from './three.js';
import { WEAPONS } from './tuning.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.tracers = [];
    this.flash = new THREE.PointLight(0xffe08a, 0, 18, 1.6);
    scene.add(this.flash);
  }

  spawnEnemy(x, z, hp = 60) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.36, 0.9, 3, 8),
      new THREE.MeshStandardMaterial({ color: 0x2c2c34, roughness: 0.8 }),
    );
    body.position.y = 0.95;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xc98d5f, roughness: 0.7 }),
    );
    head.position.y = 1.8;
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.6 }),
    );
    gun.position.set(0.4, 1.2, 0.5);
    g.add(body, head, gun);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const e = { group: g, x, z, hp, maxHp: hp, shootTimer: 1 + Math.random() * 2, alive: true };
    this.enemies.push(e);
    return e;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.group);
    this.enemies = [];
  }

  // A punch: anything hostile within range and in front takes damage.
  punch(player, walkers, police) {
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    let hitAny = false;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - player.pos.x;
      const dz = e.z - player.pos.z;
      if (dx * dx + dz * dz < 2.6 * 2.6 && dx * fx + dz * fz > 0) {
        e.hp -= 30;
        e.x += fx * 1.5; e.z += fz * 1.5;
        hitAny = true;
        if (e.hp <= 0) { e.alive = false; this.scene.remove(e.group); }
      }
    }
    for (const w of walkers.list) {
      const dx = w.x - player.pos.x;
      const dz = w.z - player.pos.z;
      if (dx * dx + dz * dz < 2.6 * 2.6 && dx * fx + dz * fz > -0.5) {
        walkers.scare(player.pos.x, player.pos.z, 8);
        hitAny = true;
      }
    }
    return hitAny;
  }

  // A shot: pick the nearest living enemy or police car inside the aim
  // cone; draw a tracer from the player to the hit point.
  shoot(player, camera, police) {
    const w = player.weapon;
    if (!w || w.id === 'fists') return null;
    if (w.ammo !== Infinity) {
      if (w.ammo <= 0) return 'empty';
      w.ammo -= 1;
    }
    const origin = new THREE.Vector3(player.pos.x, 1.5, player.pos.z);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0; dir.normalize();
    let best = null;
    let bestDist = w.range;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - origin.x;
      const dz = e.z - origin.z;
      const along = dx * dir.x + dz * dir.z;
      const side = Math.abs(dx * dir.z - dz * dir.x);
      if (along > 0 && along < bestDist && side < 1.2) { best = e; bestDist = along; }
    }
    let hitPolice = null;
    for (const c of police.cars) {
      const dx = c.pos.x - origin.x;
      const dz = c.pos.z - origin.z;
      const along = dx * dir.x + dz * dir.z;
      const side = Math.abs(dx * dir.z - dz * dir.x);
      if (along > 0 && along < bestDist && side < 2.0) { hitPolice = c; bestDist = along; }
    }
    const end = origin.clone().addScaledVector(dir, bestDist);
    this.addTracer(origin, end);
    this.flash.position.copy(origin).addScaledVector(dir, 2);
    this.flash.intensity = 60;
    setTimeout(() => { this.flash.intensity = 0; }, 60);
    if (best) {
      best.hp -= w.damage;
      if (best.hp <= 0) { best.alive = false; this.scene.remove(best.group); }
      return { kind: 'enemy', target: best };
    }
    if (hitPolice) {
      hitPolice.damage(w.damage * 0.5);
      return { kind: 'police', target: hitPolice };
    }
    return { kind: 'miss' };
  }

  addTracer(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  update(dt, playerPos, player) {
    for (const t of this.tracers) {
      t.life -= dt;
      if (t.life <= 0) { this.scene.remove(t.line); }
    }
    this.tracers = this.tracers.filter((t) => t.life > 0);
    // enemies shuffle toward the player and shoot back
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = playerPos.x - e.x;
      const dz = playerPos.z - e.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 14) continue;
      e.group.rotation.y = Math.atan2(dx, dz);
      if (dist > 6) {
        e.x += (dx / dist) * 3.4 * dt;
        e.z += (dz / dist) * 3.4 * dt;
        e.group.position.set(e.x, 0, e.z);
      }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 26) {
        e.shootTimer = 1.4 + Math.random();
        this.addTracer(new THREE.Vector3(e.x, 1.3, e.z), new THREE.Vector3(playerPos.x, 1.2, playerPos.z));
        if (player) player.hurt(7);
      }
    }
  }
}
