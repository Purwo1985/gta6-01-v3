// IRON TIDE — vehicles: eight drivable kinds with distinct handling,
// NOS boost, headlights and damage. A car is a small group of boxes
// (body, cabin, wheels, light cones) driven by a bicycle-ish arcade
// model: forward speed, steering that scales with speed, drag and a
// grip that pulls velocity toward the heading. Parked cars dot the
// streets and can be stolen; traffic cars are a lighter sibling in
// traffic.js.
import { THREE } from './three.js';
import { CAR_KINDS, CAR_TUNE, CITY } from './tuning.js';
import { makeRng } from './rng.js';

export class Car {
  constructor(scene, kind, x, z, heading, opts = {}) {
    this.scene = scene;
    this.kind = kind;
    this.spec = CAR_KINDS[kind];
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.health = CAR_TUNE.maxHealth;
    this.nos = opts.nos ?? CAR_TUNE.nosMax;
    this.upgrades = opts.upgrades ?? { engine: 0, armor: 0, nos: 0 };
    this.isPolice = kind === 'interceptor' && !!opts.police;
    this.steerVis = 0;
    this.group = this.buildMesh();
    this.group.position.copy(this.pos);
    this.group.rotation.y = heading;
    scene.add(this.group);
    this.headlight = null;
    if (opts.headlights !== false) this.addHeadlights();
  }

  buildMesh() {
    const g = new THREE.Group();
    const bodyColor = this.isPolice ? 0x11131a : this.spec.color;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.62, this.kind === 'truck' ? 5.4 : 4.2),
      new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.55 }),
    );
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.55, this.kind === 'truck' ? 1.4 : 2.1),
      new THREE.MeshStandardMaterial({ color: 0x1b2733, roughness: 0.15, metalness: 0.7 }),
    );
    cabin.position.set(0, 1.1, this.kind === 'truck' ? 1.6 : -0.2);
    cabin.castShadow = true;
    g.add(cabin);
    // wheels
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 });
    this.wheels = [];
    for (const [wx, wz] of [[-1.0, 1.4], [1.0, 1.4], [-1.0, -1.4], [1.0, -1.4]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.36, wz);
      g.add(w);
      this.wheels.push(w);
    }
    if (this.kind === 'taxi') {
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.25, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xffe14d }),
      );
      sign.position.set(0, 1.5, -0.2);
      g.add(sign);
    }
    if (this.isPolice) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.16, 0.4),
        new THREE.MeshBasicMaterial({ color: 0x2266ff }),
      );
      bar.position.set(0, 1.42, -0.2);
      g.add(bar);
      this.strobe = bar;
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(2.04, 0.3, 1.6),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      door.position.set(0, 0.55, 0);
      g.add(door);
    }
    if (this.kind === 'truck') {
      const bed = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.9, 2.6),
        new THREE.MeshStandardMaterial({ color: 0x6b7a8a, roughness: 0.6, metalness: 0.4 }),
      );
      bed.position.set(0, 1.0, -1.2);
      g.add(bed);
    }
    return g;
  }

  addHeadlights() {
    const light = new THREE.SpotLight(0xfff2c0, 60, 42, 0.5, 0.5, 1.4);
    light.position.set(0, 0.9, 2.0);
    const target = new THREE.Object3D();
    target.position.set(0, 0.2, 14);
    this.group.add(target);
    light.target = target;
    this.group.add(light);
    this.headlight = light;
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
    for (const sx of [-0.6, 0.6]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), glowMat);
      lamp.position.set(sx, 0.62, 2.12);
      this.group.add(lamp);
    }
  }

  topSpeed() {
    return CAR_TUNE.maxSpeed * this.spec.top * (1 + 0.12 * this.upgrades.engine);
  }
  maxHealth() {
    return CAR_TUNE.maxHealth * (1 + 0.5 * this.upgrades.armor);
  }

  // Drive one step. `drive` = {forward, steer, brake, nos}.
  update(dt, drive, city) {
    const spec = this.spec;
    const top = this.topSpeed();
    if (drive.forward > 0) this.speed += CAR_TUNE.accel * spec.accel * drive.forward * dt;
    if (drive.forward < 0) this.speed += CAR_TUNE.reverseAccel * drive.forward * dt;
    if (drive.brake) this.speed -= Math.sign(this.speed) * CAR_TUNE.brake * dt;
    // drag
    this.speed -= this.speed * CAR_TUNE.drag * dt;
    const boosting = drive.nos && this.nos > 0 && this.speed > 4;
    if (boosting) {
      this.speed += CAR_TUNE.accel * 0.9 * dt;
      this.nos = Math.max(0, this.nos - CAR_TUNE.nosDrain * 100 * dt * (1 - 0.2 * this.upgrades.nos));
    } else {
      this.nos = Math.min(CAR_TUNE.nosMax * (1 + 0.25 * this.upgrades.nos), this.nos + CAR_TUNE.nosRegen * 100 * dt);
    }
    const cap = top * (boosting ? CAR_TUNE.nosBoost : 1);
    this.speed = Math.max(-CAR_TUNE.maxReverse, Math.min(cap, this.speed));
    if (Math.abs(this.speed) < 0.05 && !drive.forward) this.speed = 0;
    const steerAmount = drive.steer * CAR_TUNE.turnRate * spec.turn * Math.min(1, Math.abs(this.speed) / 8);
    this.heading += steerAmount * dt * Math.sign(this.speed || 1);
    this.steerVis = drive.steer;
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    if (city && city.collide(nx, nz, 1.6)) {
      if (Math.abs(this.speed) > 9) this.health -= Math.abs(this.speed) * 0.55;
      this.speed *= -0.28; // bounce off the wall
    } else {
      this.pos.x = nx; this.pos.z = nz;
    }
    // keep inside the playable map (river east bank is the airport)
    this.pos.x = Math.max(-CITY.half - 30, Math.min(CITY.airportX + 90, this.pos.x));
    this.pos.z = Math.max(-CITY.half - 30, Math.min(CITY.half + 30, this.pos.z));
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    for (const w of this.wheels) w.rotation.x += this.speed * dt * 2.4;
    if (this.strobe) this.strobe.material.color.setHex(Math.floor(performance.now() / 260) % 2 ? 0x2266ff : 0xff2222);
    return boosting;
  }

  damage(amount) { this.health = Math.max(0, this.health - amount); }
  dispose() { this.scene.remove(this.group); }
}

export function spawnParkedCars(scene, rng, city) {
  // Parked cars along the roads, one per few blocks, stealable.
  const kinds = Object.keys(CAR_KINDS).filter((k) => k !== 'interceptor');
  const cars = [];
  const p = CITY.pitch;
  for (let i = 0; i < 26; i += 1) {
    const along = rng.range(-CITY.half, CITY.half);
    const roadIdx = rng.int(0, CITY.blocks);
    const roadC = -CITY.half + roadIdx * p - CITY.roadWidth / 2;
    const vertical = rng.chance(0.5);
    const x = vertical ? roadC + rng.pick([-3.4, 3.4]) : along;
    const z = vertical ? along : roadC + rng.pick([-3.4, 3.4]);
    if (city.collide(x, z, 2)) continue;
    const heading = vertical ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    cars.push(new Car(scene, rng.pick(kinds), x, z, heading, { headlights: false }));
  }
  // the mission interceptor, parked at Northgate
  const interceptor = new Car(scene, 'interceptor', -150, -100, Math.PI / 2, { police: true, headlights: false });
  cars.push(interceptor);
  return cars;
}

export function makeRngFor(scene) { return makeRng; }
