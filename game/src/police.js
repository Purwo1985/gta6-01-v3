// IRON TIDE — police: the five-star wanted system. Crimes raise stars;
// patrol cars spawn, chase and ram; at three stars roadblocks bar the
// road ahead and a helicopter circles with a searchlight. The heat only
// fades when the police lose sight of Mara — line of sight is a real
// raycast against the building boxes, and hiding, swapping cars, a new
// paint job or a safehouse all break it.
import { THREE } from './three.js';
import { POLICE_TUNE, CITY } from './tuning.js';
import { Car } from './vehicles.js';
import { makeRng } from './rng.js';

export class Police {
  constructor(scene, city, seed) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(seed + 55);
    this.stars = 0;
    this.cars = [];
    this.roadblocks = [];
    this.heli = null;
    this.heliLight = null;
    this.unseenTimer = 0;
    this.spawnTimer = 0;
    this.sirenTimer = 0;
    this.lastSeenPos = new THREE.Vector3();
  }

  get wanted() { return this.stars; }

  addStars(n, pos) {
    this.stars = Math.min(5, this.stars + n);
    if (pos) this.lastSeenPos.copy(pos);
    this.unseenTimer = 0;
    this.ensureHelicopter();
    this.ensureRoadblocks();
  }

  setStars(n, pos) {
    this.stars = Math.max(0, Math.min(5, n));
    if (pos) this.lastSeenPos.copy(pos);
    this.unseenTimer = 0;
    this.ensureHelicopter();
    this.ensureRoadblocks();
  }

  clearWanted() {
    this.stars = 0;
    this.unseenTimer = 0;
    this.clearRoadblocks();
    this.removeHelicopter();
    for (const c of this.cars) c.dispose();
    this.cars = [];
  }

  // Line of sight: true when no building box sits between the two points.
  seesPlayer(from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dist = Math.hypot(dx, dz);
    if (dist > POLICE_TUNE.sightRange) return false;
    const steps = Math.ceil(dist / 3);
    for (let i = 1; i < steps; i += 1) {
      const x = from.x + (dx * i) / steps;
      const z = from.z + (dz * i) / steps;
      for (const b of this.city.buildings) {
        if (Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd) return false;
      }
    }
    return true;
  }

  anySees(playerPos) {
    for (const c of this.cars) {
      if (this.seesPlayer(c.pos, playerPos)) return true;
    }
    if (this.heli && this.heli.position.distanceTo(playerPos) < POLICE_TUNE.sightRange) return true;
    return false;
  }

  ensureHelicopter() {
    if (this.stars >= POLICE_TUNE.heliStars && !this.heli) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 1.6, 2.2),
        new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.4, metalness: 0.5 }),
      );
      const rotor = new THREE.Mesh(
        new THREE.BoxGeometry(9, 0.12, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }),
      );
      rotor.position.y = 1.1;
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xfff6c8 }),
      );
      lamp.position.set(0, -1.1, 1.6);
      g.add(body, rotor, lamp);
      this.heli = g;
      this.heliRotor = rotor;
      this.heliLight = new THREE.SpotLight(0xfff2c0, 220, 90, 0.35, 0.45, 1.2);
      this.heliLight.position.set(0, -1, 1.6);
      const tgt = new THREE.Object3D();
      tgt.position.set(0, -40, 0);
      g.add(tgt);
      this.heliLight.target = tgt;
      g.add(this.heliLight);
      this.scene.add(g);
    }
    if (this.stars < POLICE_TUNE.heliStars && this.heli) this.removeHelicopter();
  }

  removeHelicopter() {
    if (!this.heli) return;
    this.scene.remove(this.heli);
    this.heli = null;
    this.heliLight = null;
  }

  ensureRoadblocks() {
    this.clearRoadblocks();
    if (this.stars < POLICE_TUNE.roadblockStars) return;
    // two roadblocks: a pair of patrol cars parked across the road ahead
    for (let i = 0; i < 2; i += 1) {
      const p = this.lastSeenPos;
      const ang = this.rng.range(0, Math.PI * 2);
      const x = p.x + Math.sin(ang) * 55;
      const z = p.z + Math.cos(ang) * 55;
      const pair = [];
      for (const off of [-4, 4]) {
        const c = new Car(this.scene, 'interceptor', x + off, z, ang + Math.PI / 2, { police: true, headlights: false });
        pair.push(c);
      }
      this.roadblocks.push({ cars: pair, x, z });
    }
  }

  clearRoadblocks() {
    for (const rb of this.roadblocks) for (const c of rb.cars) c.dispose();
    this.roadblocks = [];
  }

  spawnPatrol(playerPos) {
    if (this.cars.length >= Math.min(POLICE_TUNE.maxCars, this.stars + 1)) return;
    const ang = this.rng.range(0, Math.PI * 2);
    const x = playerPos.x + Math.sin(ang) * POLICE_TUNE.spawnDistance;
    const z = playerPos.z + Math.cos(ang) * POLICE_TUNE.spawnDistance;
    const car = new Car(this.scene, 'interceptor', x, z, Math.atan2(playerPos.x - x, playerPos.z - z), { police: true });
    car.speed = 12;
    this.cars.push(car);
  }

  update(dt, playerPos, playerCar, onBusted, audio) {
    if (this.stars === 0) {
      if (this.cars.length) { for (const c of this.cars) c.dispose(); this.cars = []; }
      this.removeHelicopter();
      this.clearRoadblocks();
      return;
    }
    // line-of-sight decay: unseen long enough and the heat cools off
    if (this.anySees(playerPos)) {
      this.unseenTimer = 0;
      this.lastSeenPos.copy(playerPos);
    } else {
      this.unseenTimer += dt;
      if (this.unseenTimer > POLICE_TUNE.loseSightSeconds) {
        this.stars = Math.max(0, this.stars - 1);
        this.unseenTimer = 0;
        this.ensureHelicopter();
        this.ensureRoadblocks();
      }
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnPatrol(playerPos);
      this.spawnTimer = this.stars >= 3 ? 2.5 : 5;
    }
    this.sirenTimer -= dt;
    if (this.sirenTimer <= 0 && audio) { audio.siren(); this.sirenTimer = 3.2; }
    // patrol cars chase and ram
    for (const car of this.cars) {
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      car.speed += (POLICE_TUNE.chaseSpeed - car.speed) * Math.min(1, dt * 1.2);
      const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
      if (!this.city.collide(nx, nz, 1.6)) { car.pos.x = nx; car.pos.z = nz; }
      else car.speed *= 0.4;
      car.group.position.copy(car.pos);
      car.group.rotation.y = car.heading;
      if (car.strobe) car.strobe.material.color.setHex(Math.floor(performance.now() / 260) % 2 ? 0x2266ff : 0xff2222);
      // ram the player's car or bust Mara on foot
      if (dist < 3.4) {
        if (playerCar) {
          playerCar.damage(POLICE_TUNE.ramDamage * dt * 2);
          car.speed *= 0.6;
        } else if (dist < POLICE_TUNE.bustRange && this.stars >= 1) {
          onBusted();
        }
      }
    }
    // helicopter circles overhead, spotlight tracking the last seen spot
    if (this.heli) {
      const t = performance.now() * 0.00035;
      const cx = this.lastSeenPos.x + Math.sin(t) * 26;
      const cz = this.lastSeenPos.z + Math.cos(t) * 26;
      this.heli.position.set(cx, 46, cz);
      this.heli.rotation.y = t;
      this.heliRotor.rotation.y += dt * 22;
      this.heliLight.target.position.set(
        this.lastSeenPos.x - cx, -46, this.lastSeenPos.z - cz,
      );
    }
  }
}
