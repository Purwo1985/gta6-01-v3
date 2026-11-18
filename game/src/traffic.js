// IRON TIDE — traffic: cars that follow the road grid and turn at
// intersections, plus a light pedestrian system in walkers.js. Traffic
// cars pick a lane, drive to the next intersection, sometimes turn,
// and brake when something is directly ahead. They are simple meshes
// built from the same Car factory but driven by a route brain.
import { THREE } from './three.js';
import { CITY, TRAFFIC_TUNE } from './tuning.js';
import { makeRng } from './rng.js';
import { Car } from './vehicles.js';

const KINDS = ['sedan', 'pickup', 'taxi', 'van', 'muscle'];

export class Traffic {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = makeRng(seed + 77);
    this.cars = [];
    for (let i = 0; i < TRAFFIC_TUNE.cars; i += 1) this.spawnOne(true);
  }

  randomRoadPoint() {
    const rng = this.rng;
    const p = CITY.pitch;
    const roadIdx = rng.int(0, CITY.blocks);
    const c = -CITY.half + roadIdx * p - CITY.roadWidth / 2;
    const along = rng.range(-CITY.half + 6, CITY.half - 6);
    if (rng.chance(0.5)) return { x: c + rng.pick([-3, 3]), z: along, heading: rng.chance(0.5) ? 0 : Math.PI };
    return { x: along, z: c + rng.pick([-3, 3]), heading: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 };
  }

  spawnOne(anywhere) {
    const spot = this.randomRoadPoint();
    const car = new Car(this.scene, this.rng.pick(KINDS), spot.x, spot.z, spot.heading, { headlights: false });
    car.speed = TRAFFIC_TUNE.carSpeed * this.rng.range(0.8, 1.15);
    car.targetSpeed = car.speed;
    this.cars.push(car);
    return car;
  }

  aheadBlocked(car) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    for (const other of this.cars) {
      if (other === car) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 9 && side < 2.4) return true;
    }
    return false;
  }

  update(dt, playerCar) {
    const p = CITY.pitch;
    for (const car of this.cars) {
      // at an intersection, sometimes turn
      const mx = ((car.pos.x + CITY.half) % p + p) % p;
      const mz = ((car.pos.z + CITY.half) % p + p) % p;
      const onCross = (mx < CITY.roadWidth && mz < CITY.roadWidth);
      if (onCross && this.rng.chance(TRAFFIC_TUNE.turnChance * dt * 8)) {
        car.heading += this.rng.pick([-Math.PI / 2, Math.PI / 2]);
      }
      const blocked = this.aheadBlocked(car);
      if (playerCar) {
        const dx = playerCar.pos.x - car.pos.x;
        const dz = playerCar.pos.z - car.pos.z;
        const along = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
        if (along > 0 && along < 8 && side < 2.4) {
          // player in the way: brake, and honk sometimes
          car.speed = Math.max(0, car.speed - 20 * dt);
        }
      }
      const want = blocked ? 0 : car.targetSpeed;
      car.speed += (want - car.speed) * Math.min(1, dt * 2);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      // recycle far outside the grid
      if (Math.abs(car.pos.x) > CITY.half + 40 || Math.abs(car.pos.z) > CITY.half + 40) {
        const spot = this.randomRoadPoint();
        car.pos.set(spot.x, 0, spot.z);
        car.heading = spot.heading;
      }
      car.group.position.copy(car.pos);
      car.group.rotation.y = car.heading;
      for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.4;
    }
  }
}
