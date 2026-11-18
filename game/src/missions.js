// IRON TIDE — missions: twelve story jobs for Mara Voss, played in
// order. Each mission is a small state machine over waypoints: go to a
// marker, hold a spot, lose the heat, drive fares, beat a race clock,
// recruit the crew, survive a chase, steal a car, pull the heist and
// escape the city. A gold beacon column marks the active target; the
// HUD shows the objective text and the briefing dialogue. Completing a
// mission pays cash, raises district standing and unlocks the next.
import { THREE } from './three.js';
import { MISSIONS, CITY } from './tuning.js';
import { makeRng } from './rng.js';

function beacon(scene) {
  const g = new THREE.Group();
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
  );
  col.position.y = 30;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.22, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc93c }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  g.add(col, ring);
  g.visible = false;
  scene.add(g);
  return g;
}

export class Missions {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.idx = 0;              // next mission to play
    this.active = null;        // {def, stage, timer, ...}
    this.beacon = beacon(scene);
    this.rng = makeRng(777);
  }

  get current() { return MISSIONS[this.idx] ?? null; }
  get done() { return this.idx >= MISSIONS.length; }

  start(idx = this.idx) {
    const def = MISSIONS[idx];
    if (!def) return null;
    const g = this.game;
    const st = { def, stage: 0, timer: 0, hold: 0, fares: 0, target: null, checkpoints: [], cpIdx: 0 };
    // per-type setup
    if (def.type === 'steal' && idx === 0) {
      st.target = { x: -180, z: -180, label: 'the dock sedan' };
      g.say('Old Barto', 'Take the sedan at the Portside docks. Any sedan will do — just get moving.');
    } else if (def.type === 'deliver') {
      st.target = { x: 115, z: -161, label: 'Foundry warehouse' };
      g.say('Old Barto', 'Crate is in the trunk. Foundry warehouse, north side. No speeding past the patrols.');
    } else if (def.type === 'lose') {
      g.police.addStars(3, g.player.pos);
      g.say('Mara Voss', 'Tail picked me up at the docks. I need to vanish — break line of sight until the stars drop.');
    } else if (def.type === 'taxi') {
      st.target = { x: 23, z: -115, label: 'first fare' };
      g.say('Rust Cab Co.', 'Two fares tonight. First pickup is outside the Old Town hotel.');
    } else if (def.type === 'hold') {
      const spots = { 4: { x: 69, z: 69 }, 6: { x: -69, z: 69 } };
      const s = spots[idx] || { x: 69, z: 69 };
      st.target = { x: s.x, z: s.z, label: 'the safe' };
      g.say(def.giver, 'Stand on the marker until the safe opens. Hold your ground — the alarm is already counting.');
      g.combat.spawnEnemy(s.x + 6, s.z + 4);
      g.combat.spawnEnemy(s.x - 6, s.z - 4);
    } else if (def.type === 'race') {
      st.checkpoints = [
        { x: -160, z: 0 }, { x: 0, z: -160 }, { x: 160, z: 0 },
      ];
      st.target = st.checkpoints[0];
      st.timer = 75;
      g.say('Kess the Racer', 'Three checkpoints, seventy-five seconds. Beat my time and the River Run is yours.');
    } else if (def.type === 'recruit') {
      st.target = { x: -161, z: 115, label: 'Jax at the Ironworks' };
      g.say('Mara Voss', 'Jax is drinking at the Ironworks. Then Lena at the Marina. I need a crew for the big one.');
    } else if (def.type === 'chase') {
      st.target = { x: 160, z: -160, label: 'union trucks' };
      g.say('Old Barto', 'Three union trucks are leaving the port with the evidence. Run them down before the bridge.');
      g.spawnChaseTrucks();
    } else if (def.type === 'steal' && idx === 9) {
      st.target = { x: -150, z: -100, label: 'the interceptor' };
      g.say('Kess the Racer', 'The port interceptor is parked at Northgate. Take it — quiet, fast, no witnesses.');
    } else if (def.type === 'heist') {
      st.target = { x: -180, z: -180, label: 'the container vault' };
      g.say('Old Barto', 'The ledger is in the container vault at Portside. Your crew rides with you. Go.');
      g.police.addStars(2, g.player.pos);
    } else if (def.type === 'escape') {
      st.target = { x: CITY.airportX, z: CITY.airportZ, label: 'the runway' };
      g.say('Mara Voss', 'Five stars. The whole city is awake. The runway is the only way out of Rustport.');
      g.police.setStars(5, g.player.pos);
    }
    this.active = st;
    this.moveBeacon(st.target);
    return st;
  }

  moveBeacon(t) {
    if (!t) { this.beacon.visible = false; return; }
    this.beacon.visible = true;
    this.beacon.position.set(t.x, 0, t.z);
  }

  objectiveText() {
    if (!this.active) {
      if (this.done) return 'All twelve jobs done — Rustport is yours, Mara.';
      const c = this.current;
      return `Next job: ${c.title} — press M to start.`;
    }
    const st = this.active;
    const d = st.def;
    switch (d.type) {
      case 'steal': return `Steal a car and reach: ${st.target?.label ?? ''}`;
      case 'deliver': return `Deliver the crate to the Foundry warehouse.`;
      case 'lose': return `Lose the heat — stay unseen until the stars fade. Wanted: ${this.game.police.stars}★`;
      case 'taxi': return `Taxi fares: ${st.fares}/2 — ${st.stage === 0 ? 'pick up the fare' : 'drop off the fare'}.`;
      case 'hold': return `Hold the safe — ${Math.ceil(st.hold)}s of ${st.holdTotal ?? 12}s. Clear the guards first.`;
      case 'race': return `River Run checkpoint ${st.cpIdx + 1}/3 — ${Math.ceil(st.timer)}s left.`;
      case 'recruit': return `Recruit the crew: ${st.stage === 0 ? 'find Jax at the Ironworks' : 'find Lena at the Marina'} (${st.stage}/2).`;
      case 'chase': return `Stop the union trucks: ${st.trucksDown ?? 0}/3 down.`;
      case 'heist': return `The Big Score — grab the ledger at the container vault, then lose the helicopter.`;
      case 'escape': return `Reach the Airfield runway — five stars, no stopping.`;
      default: return d.text;
    }
  }

  near(x, z, r = 5) {
    const p = this.game.player.pos;
    const dx = p.x - x;
    const dz = p.z - z;
    return dx * dx + dz * dz < r * r;
  }

  complete() {
    const g = this.game;
    const st = this.active;
    const def = st.def;
    g.player.cash += def.reward;
    g.audio.cash();
    g.toast(`JOB DONE — ${def.title} · +$${def.reward}`);
    g.say(def.giver, def.id === 'm12'
      ? 'Clean slate. The plane is waiting, Mara. Rustport is behind you now.'
      : 'Good work. The next job is waiting when you are ready.');
    g.standing[g.districtName()] = (g.standing[g.districtName()] ?? 0) + 2;
    this.idx += 1;
    this.active = null;
    this.beacon.visible = false;
    g.combat.clearEnemies();
    g.saveGame();
  }

  fail(reason) {
    const g = this.game;
    g.toast(`JOB FAILED — ${reason}`);
    this.active = null;
    this.beacon.visible = false;
    g.combat.clearEnemies();
  }

  update(dt) {
    const g = this.game;
    const st = this.active;
    if (!st) return;
    const d = st.def;
    // beacon pulse
    if (this.beacon.visible) this.beacon.rotation.y += dt * 1.2;

    if (d.type === 'steal') {
      if (g.player.inCar) {
        const t = st.target;
        if (t && this.near(t.x, t.z, 6)) this.complete();
        else if (st.stage === 0) { st.stage = 1; st.target = { x: -23, z: 69, label: 'Voss Garage' }; this.moveBeacon(st.target); }
      }
    } else if (d.type === 'deliver') {
      if (this.near(st.target.x, st.target.z, 6)) this.complete();
    } else if (d.type === 'lose') {
      if (g.police.stars === 0) this.complete();
    } else if (d.type === 'taxi') {
      if (this.near(st.target.x, st.target.z, 5)) {
        if (st.stage === 0) {
          st.stage = 1; st.fares += 0;
          const drops = [{ x: 161, z: -23 }, { x: -23, z: 161 }];
          st.target = drops[st.fares];
          g.say('Fare', 'Downtown, please — and step on it.');
          this.moveBeacon(st.target);
        } else {
          st.fares += 1;
          g.player.cash += 120;
          g.audio.cash();
          if (st.fares >= 2) { this.complete(); return; }
          st.stage = 0;
          st.target = { x: -115, z: -69, label: 'second fare' };
          g.say('Rust Cab Co.', 'Second fare is waiting at Northgate.');
          this.moveBeacon(st.target);
        }
      }
    } else if (d.type === 'hold') {
      st.holdTotal = 12;
      if (this.near(st.target.x, st.target.z, 6)) {
        st.hold += dt;
        if (g.combat.enemies.some((e) => e.alive)) st.hold += dt * 0.2; // guards slow the crack
        if (st.hold >= st.holdTotal) this.complete();
      }
    } else if (d.type === 'race') {
      st.timer -= dt;
      if (st.timer <= 0) { this.fail('Out of time on the River Run'); return; }
      const cp = st.checkpoints[st.cpIdx];
      if (cp && this.near(cp.x, cp.z, 6)) {
        st.cpIdx += 1;
        g.audio.pickup();
        if (st.cpIdx >= st.checkpoints.length) {
          g.bestRace = Math.min(g.bestRace ?? 999, 75 - st.timer);
          this.complete();
          return;
        }
        st.target = st.checkpoints[st.cpIdx];
        this.moveBeacon(st.target);
      }
    } else if (d.type === 'recruit') {
      if (this.near(st.target.x, st.target.z, 5)) {
        if (st.stage === 0) {
          st.stage = 1;
          g.crew.push('Jax');
          g.say('Jax', 'Ironworks owes me a favour. I am in — but Lena drives the getaway.');
          st.target = { x: -69, z: 115, label: 'Lena at the Marina' };
          this.moveBeacon(st.target);
        } else {
          g.crew.push('Lena');
          this.complete();
        }
      }
    } else if (d.type === 'chase') {
      const down = g.chaseTrucks.filter((t) => t.health <= 0).length;
      st.trucksDown = down;
      if (down >= 3) this.complete();
      else {
        const alive = g.chaseTrucks.find((t) => t.health > 0);
        if (alive) { st.target = { x: alive.pos.x, z: alive.pos.z, label: 'union truck' }; this.moveBeacon(st.target); }
      }
    } else if (d.type === 'heist') {
      if (st.stage === 0 && this.near(st.target.x, st.target.z, 6)) {
        st.stage = 1;
        g.player.cash += 500;
        g.say('Lena', 'Ledger secured! Jax, get the van moving — the helicopter is already up!');
        g.police.addStars(2, g.player.pos);
        st.target = { x: -23, z: 69, label: 'Voss Garage — lose the heat' };
        this.moveBeacon(st.target);
      } else if (st.stage === 1 && g.police.stars === 0) {
        this.complete();
      }
    } else if (d.type === 'escape') {
      if (this.near(st.target.x, st.target.z, 10)) this.complete();
    }
  }
}
