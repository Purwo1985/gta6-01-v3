// IRON TIDE — player: Mara Voss on foot and behind the wheel. On foot
// she walks, runs, punches and shoots; near a car she can climb in (E)
// and climb out again. The player owns health, armour, cash, weapons
// and the NOS state of the car she drives. The camera lives in main.js;
// this module only moves Mara and reports what she is doing.
import { THREE } from './three.js';
import { PLAYER_TUNE, WEAPONS } from './tuning.js';

export class Player {
  constructor(scene, x, z) {
    this.scene = scene;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = Math.PI;
    this.health = PLAYER_TUNE.maxHealth;
    this.armour = 0;
    this.cash = 150;
    this.inCar = null;
    this.weapons = [{ ...WEAPONS[0], owned: true, ammo: Infinity }];
    this.weaponIdx = 0;
    this.punchTimer = 0;
    this.shootTimer = 0;
    this.group = this.buildMesh();
    this.group.position.copy(this.pos);
    scene.add(this.group);
  }

  buildMesh() {
    const g = new THREE.Group();
    const coat = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.36, 0.9, 3, 10),
      // bright red coat so Mara reads at night as well as by day
      new THREE.MeshStandardMaterial({ color: 0xd64545, roughness: 0.7 }),
    );
    coat.position.y = 0.95;
    coat.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7 }),
    );
    head.position.y = 1.82;
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.9 }),
    );
    hair.position.y = 1.86;
    g.add(coat, head, hair);
    this.coat = coat;
    return g;
  }

  get weapon() { return this.weapons[this.weaponIdx]; }

  giveWeapon(id, ammo) {
    const def = WEAPONS.find((w) => w.id === id);
    if (!def) return false;
    const have = this.weapons.find((w) => w.id === id);
    if (have) {
      have.ammo = Math.min(have.ammo + ammo, 999);
    } else {
      this.weapons.push({ ...def, owned: true, ammo });
    }
    return true;
  }

  cycleWeapon(dir = 1) {
    this.weaponIdx = (this.weaponIdx + dir + this.weapons.length) % this.weapons.length;
  }

  selectWeapon(n) {
    if (n >= 0 && n < this.weapons.length) this.weaponIdx = n;
  }

  hurt(amount) {
    let rest = amount;
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, rest * 0.6);
      this.armour -= absorbed;
      rest -= absorbed;
    }
    this.health = Math.max(0, this.health - rest);
  }

  heal(amount) { this.health = Math.min(PLAYER_TUNE.maxHealth, this.health + amount); }

  // On-foot movement. Returns the displacement so main.js can check
  // collisions; punching is handled by combat through punchTimer.
  updateOnFoot(dt, move, city) {
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.shootTimer = Math.max(0, this.shootTimer - dt);
    const speed = move.run ? PLAYER_TUNE.runSpeed : PLAYER_TUNE.walkSpeed;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = Math.cos(this.heading);
    const rz = -Math.sin(this.heading);
    let mx = fx * move.forward + rx * move.strafe;
    let mz = fz * move.forward + rz * move.strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx = (mx / len) * speed * dt;
      mz = (mz / len) * speed * dt;
      const nx = this.pos.x + mx;
      const nz = this.pos.z + mz;
      if (!city.collide(nx, this.pos.z, PLAYER_TUNE.radius)) this.pos.x = nx;
      if (!city.collide(this.pos.x, nz, PLAYER_TUNE.radius)) this.pos.z = nz;
      // face the direction of travel when moving
      if (move.forward !== 0 || move.strafe !== 0) {
        this.heading = Math.atan2(mx, mz);
      }
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    this.group.visible = !this.inCar;
  }

  enterCar(car) {
    this.inCar = car;
    this.pos.copy(car.pos);
    this.heading = car.heading;
    this.group.visible = false;
  }

  exitCar() {
    const car = this.inCar;
    this.inCar = null;
    if (car) {
      // step out to the driver's side
      this.pos.set(
        car.pos.x + Math.cos(car.heading) * 2.2,
        0,
        car.pos.z - Math.sin(car.heading) * 2.2,
      );
      this.heading = car.heading;
    }
    this.group.visible = true;
    this.group.position.copy(this.pos);
  }
}
