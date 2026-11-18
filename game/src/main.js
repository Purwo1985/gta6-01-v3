// IRON TIDE — main: Mara Voss and the port city of Rustport. This is
// the game itself: a Three.js open world with a 10x10 district grid, a
// river and a steel bridge, traffic and pedestrians, a five-star wanted
// system with roadblocks and a helicopter, twelve story missions, a
// two-person crew, three street races, taxi fares, vigilante work,
// twenty hidden packages, stunt jumps, four radio stations, garage
// upgrades and three safehouses. Boot reads ?shot= and ?seed= so the
// screenshot tooling can stage any scene deterministically.
import { THREE } from './three.js';
import { STEP, WORLD_SEED, CITY, MISSIONS, RACES, STUNT_JUMPS, COLLECTIBLES } from './tuning.js';
import { makeRng } from './rng.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { City, districtAt } from './city.js';
import { Car, spawnParkedCars } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Walkers } from './walkers.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Shops } from './shops.js';
import { Hud } from './hud.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const $ = (id) => document.getElementById(id);

class IronTide {
  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.seed = Number(params.get('seed') || WORLD_SEED);
    this.shotName = params.get('shot') || null;
    this.rng = makeRng(this.seed);
    this.input = new Input();
    this.audio = new AudioEngine();
    this.screen = 'start'; // start | play | pause | busted | over
    this.dayTime = 8.0;    // hours, 0-24
    this.raining = false;
    this.rainTimer = 40;
    this.crew = [];
    this.standing = {};
    this.packagesFound = 0;
    this.bestRace = null;
    this.race = null;      // free-roam street race state
    this.chaseTrucks = [];
    this.shopHint = '';
    this.cameraMode = 'chase';
    this.camYaw = 0;
    this.slowmo = 0;
    this.shake = 0;
    this.vigilanteTarget = null;
    this.vigilanteTimer = 0;
    this.accum = 0;
    this.lastT = 0;
    this.buildRenderer();
    this.buildWorld();
    this.hud = new Hud(this);
    this.loop = this.loop.bind(this);
    window.__game = this; // debug handle: lets smoke tooling inspect state
    if (this.shotName) {
      // screenshot mode: run the staging in 'play' so the simulation
      // (driving, police, missions) actually steps, then switch to the
      // screen the shot wants and render one final frame.
      this.screen = 'play';
      const which = stageShot(this.shotName, this);
      this.screen = which;
      if (which === 'start') this.showStart(true);
      else this.hud.hideScreen();
      window.__shotReady = true;
      this.render(0);
    } else {
      this.showStart(false);
      this._looping = true;
      requestAnimationFrame(this.loop);
    }
  }

  buildRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e14);
    this.scene.fog = new THREE.Fog(0x0a0e14, 120, 420);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.sun = new THREE.DirectionalLight(0xffe0b3, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -160; this.sun.shadow.camera.right = 160;
    this.sun.shadow.camera.top = 160; this.sun.shadow.camera.bottom = -160;
    this.sun.shadow.camera.far = 600;
    this.scene.add(this.sun);
    this.scene.add(new THREE.HemisphereLight(0x8fb8dd, 0x1a2027, 0.7));
    this.moon = new THREE.DirectionalLight(0x8fb8ff, 0.5);
    this.scene.add(this.moon);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  buildWorld() {
    this.city = new City(this.scene, this.seed);
    this.traffic = new Traffic(this.scene, this.seed);
    this.walkers = new Walkers(this.scene, this.seed);
    this.player = new Player(this.scene, 23, -69);
    this.parked = spawnParkedCars(this.scene, makeRng(this.seed + 5), this.city);
    this.police = new Police(this.scene, this.city, this.seed);
    this.combat = new Combat(this.scene);
    this.missions = new Missions(this.scene, this);
    this.shops = new Shops(this);
    this.chaseTrucks = [];
  }

  resetWorld() {
    // Tear the world down and rebuild it fresh (screenshot staging).
    // Order matters: rebuild the city first, then the police, so the
    // police line-of-sight raycast reads the new building boxes.
    for (const c of this.parked) c.dispose();
    for (const c of this.traffic.cars) c.dispose();
    for (const t of this.chaseTrucks) t.dispose();
    this.scene.clear();
    this.scene.background = new THREE.Color(0x0a0e14);
    this.scene.fog = new THREE.Fog(0x0a0e14, 120, 420);
    this.scene.add(this.sun);
    this.scene.add(new THREE.HemisphereLight(0x8fb8dd, 0x1a2027, 0.7));
    this.scene.add(this.moon);
    this.crew = [];
    this.standing = {};
    this.packagesFound = 0;
    this.buildWorld2();
    this.police = new Police(this.scene, this.city, this.seed);
  }

  buildWorld2() {
    this.city = new City(this.scene, this.seed);
    this.traffic = new Traffic(this.scene, this.seed);
    this.walkers = new Walkers(this.scene, this.seed);
    this.player = new Player(this.scene, 23, -69);
    this.parked = spawnParkedCars(this.scene, makeRng(this.seed + 5), this.city);
    this.combat = new Combat(this.scene);
    this.missions = new Missions(this.scene, this);
    this.shops = new Shops(this);
    this.chaseTrucks = [];
    this.race = null;
    this.vigilanteTarget = null;
  }

  // ---------- screens ----------
  showStart(fromShot) {
    const save = loadSave();
    const cont = save ? `<button id="btn-continue">CONTINUE — ${save.missionTitle}</button>` : '';
    this.hud.showScreen(`
      <h1>IRON TIDE</h1>
      <h2>RUSTPORT · A PORT-CITY CRIME STORY</h2>
      <p>Mara Voss owes the dock union a fortune. Twelve jobs stand between her
      and a clean slate — steal cars, run crates, outrun the port police, pull
      the Big Score and fly out of Rustport. Fourteen districts, five stars of
      heat, a helicopter, and a radio that never stops.</p>
      <div class="keys">WASD drive / walk · SHIFT NOS · E enter car / use shop · F punch · G shoot ·
      1-4 weapons · Q radio · M mission · R race · SPACE brake · P pause</div>
      <button id="btn-start">START ENGINE</button>${cont}
      <p style="font-size:12px;color:#7d8ea3">Original game — no Rockstar / GTA content. Three.js r160, WebAudio radio, all procedural.</p>`);
    $('btn-start').addEventListener('click', () => this.startGame(false));
    const bc = $('btn-continue');
    if (bc) bc.addEventListener('click', () => this.startGame(true));
    if (fromShot) this.hud.showScreen(`<h1>IRON TIDE</h1><h2>RUSTPORT · A PORT-CITY CRIME STORY</h2>`);
  }

  startGame(continueSave) {
    this.audio.unlock();
    if (continueSave) this.applySave(loadSave());
    this.screen = 'play';
    this.hud.hideScreen();
    this.hud.toast('Welcome to Rustport — press M to start the first job');
    if (!this._looping) { this._looping = true; requestAnimationFrame(this.loop); }
  }

  showPause() {
    this.screen = 'pause';
    this.hud.showScreen(`<h1>PAUSED</h1><p>Mara is catching her breath.</p>
      <button id="btn-resume">RESUME</button>`);
    $('btn-resume').addEventListener('click', () => { this.screen = 'play'; this.hud.hideScreen(); });
  }

  showBusted() {
    this.screen = 'busted';
    this.audio.busted();
    this.hud.showScreen(`<h1>BUSTED</h1><p>The port police hauled Mara in. Bail: $500 — or start the job over.</p>
      <button id="btn-bail">PAY BAIL &amp; CONTINUE</button>`);
    $('btn-bail').addEventListener('click', () => {
      this.player.cash = Math.max(0, this.player.cash - 500);
      this.player.health = 100;
      this.police.clearWanted();
      this.player.pos.set(23, 0, -69);
      this.screen = 'play';
      this.hud.hideScreen();
    });
  }

  showOver() {
    this.screen = 'over';
    this.hud.showScreen(`<h1>FLATLINED</h1><p>Mara went down in the streets of Rustport.</p>
      <button id="btn-retry">TRY AGAIN</button>`);
    $('btn-retry').addEventListener('click', () => {
      this.player.health = 100;
      this.player.pos.set(23, 0, -69);
      this.police.clearWanted();
      this.screen = 'play';
      this.hud.hideScreen();
    });
  }

  // ---------- helpers used by HUD, missions and shots ----------
  districtName() { return districtAt(this.player.pos.x, this.player.pos.z).name; }
  say(who, text) { this.hud.say(who, text); }
  toast(text) { this.hud.toast(text); }

  saveGame() {
    const p = this.player;
    writeSave({
      missionIdx: this.missions.idx,
      missionTitle: this.missions.current ? this.missions.current.title : 'All jobs done',
      cash: p.cash,
      weapons: p.weapons.map((w) => ({ id: w.id, ammo: w.ammo })),
      packagesFound: this.packagesFound,
      crew: this.crew,
      standing: this.standing,
      bestRace: this.bestRace,
      dayTime: this.dayTime,
    });
  }

  applySave(s) {
    if (!s) return;
    this.missions.idx = s.missionIdx ?? 0;
    this.player.cash = s.cash ?? 150;
    for (const w of s.weapons ?? []) this.player.giveWeapon(w.id, 0);
    this.packagesFound = s.packagesFound ?? 0;
    this.crew = s.crew ?? [];
    this.standing = s.standing ?? {};
    this.bestRace = s.bestRace ?? null;
    this.dayTime = s.dayTime ?? 8;
    // mark found packages as taken
    for (let i = 0; i < this.packagesFound && i < this.city.packages.length; i += 1) {
      const pkg = this.city.packages[i];
      pkg.taken = true;
      pkg.mesh.visible = false;
    }
  }

  spawnChaseTrucks() {
    for (const [x, z] of [[-140, -180], [-120, -160], [-160, -140]]) {
      const t = new Car(this.scene, 'truck', x, z, Math.PI / 2, { headlights: false });
      t.speed = 14;
      t.isChaseTruck = true;
      this.chaseTrucks.push(t);
    }
  }

  // ---------- debug surface (screenshots + smoke tests) ----------
  debugDrive(d) { this._debugDrive = d; }
  debugWalk(d) { this._debugWalk = d; }
  debugPlaceCar(x, z, heading) {
    const car = this.parked[0] || new Car(this.scene, 'sport', x, z, heading);
    car.pos.set(x, 0, z);
    car.heading = heading;
    car.speed = 8;
    // paint the hero car signal red so it reads in dusk screenshots
    if (car.group.children[0]?.material) car.group.children[0].material.color.setHex(0xc0392b);
    this.player.enterCar(car);
  }
  debugPlacePlayer(x, z) {
    this.player.pos.set(x, 0, z);
    this.player.heading = Math.PI;
  }
  debugSetWanted(n) { this.police.setStars(n, this.player.pos); }
  debugSetTime(h) { this.dayTime = h; }
  debugCamera(mode) { this.cameraMode = mode; }
  debugStartMission(i) { this.missions.idx = i; this.missions.start(i); }
  debugGatherWalkers(x, z, n) {
    for (let i = 0; i < Math.min(n, this.walkers.list.length); i += 1) {
      const w = this.walkers.list[i];
      w.x = x + (this.rng.range(-6, 6));
      w.z = z + (this.rng.range(-6, 6));
    }
  }
  debugSpawnPolice(n) { for (let i = 0; i < n; i += 1) this.police.spawnPatrol(this.player.pos); }

  // ---------- one fixed step ----------
  // `render` false lets the screenshot staging run the simulation many
  // steps without paying for a WebGL frame each time; the caller renders
  // once at the end. The live loop always renders.
  step(dt, render = true) {
    const effDt = this.slowmo > 0 ? dt * 0.35 : dt;
    this.slowmo = Math.max(0, this.slowmo - dt);
    this.shake = Math.max(0, this.shake - dt * 2);
    // clock + weather
    this.dayTime = (this.dayTime + effDt / 240) % 24; // a full day in 4 minutes
    this.rainTimer -= effDt;
    if (this.rainTimer <= 0) {
      this.raining = !this.raining;
      this.rainTimer = this.raining ? 35 + Math.random() * 30 : 50 + Math.random() * 60;
    }
    this.updateLighting();
    this.city.updateRain(effDt, this.raining, this.player.pos.x, this.player.pos.z);
    const input = this.input;
    const p = this.player;

    if (this.screen === 'play') {
      // camera yaw from mouse drag
      this.camYaw += input.dragX * 0.004;
      input.dragX = 0;
      // --- driving / walking ---
      if (p.inCar) {
        const car = p.inCar;
        const dbg = this._debugDrive;
        const fwd = dbg ? dbg.forward : input.axis('KeyS', 'KeyW');
        const steer = dbg ? dbg.steer : input.axis('KeyA', 'KeyD');
        const boosting = car.update(effDt, {
          forward: fwd,
          steer,
          brake: input.held('Space'),
          nos: input.held('ShiftLeft', 'ShiftRight'),
        }, this.city);
        // the HUD, the minimap and the police all track Mara's position,
        // so it follows the car while she drives
        p.pos.copy(car.pos);
        p.heading = car.heading;
        if (boosting && Math.random() < 0.3) this.shake = Math.max(this.shake, 0.12);
        // stunt jumps
        for (const j of STUNT_JUMPS) {
          const dx = car.pos.x - j.x;
          const dz = car.pos.z - j.z;
          if (dx * dx + dz * dz < 16 && Math.abs(car.speed) > 26 && !j.used) {
            j.used = true;
            p.cash += 150;
            this.slowmo = 1.1;
            this.audio.jump();
            this.toast(`STUNT JUMP — ${j.name} · +$150`);
          }
        }
        if (input.tap('KeyE')) p.exitCar();
        if (car.health <= 0) {
          this.audio.explosion();
          this.shake = 1;
          p.exitCar();
          p.hurt(30);
          car.health = 20;
          this.toast('Your car is wrecked!');
        }
      } else {
        const dbg = this._debugWalk;
        const fwd = dbg ? dbg.forward : input.axis('KeyS', 'KeyW');
        const strafe = input.axis('KeyA', 'KeyD');
        p.updateOnFoot(effDt, {
          forward: fwd, strafe,
          run: input.held('ShiftLeft', 'ShiftRight'),
        }, this.city);
        if (input.tap('KeyE')) this.tryEnterCarOrShop();
        if (input.tap('KeyF') && p.punchTimer <= 0) {
          p.punchTimer = 0.42;
          if (this.combat.punch(p, this.walkers, this.police)) {
            this.audio.punch();
            this.police.addStars(1, p.pos);
            this.walkers.scare(p.pos.x, p.pos.z, 12);
          }
        }
        if (input.tap('KeyG') && p.shootTimer <= 0) {
          p.shootTimer = p.weapon.rate;
          const res = this.combat.shoot(p, this.camera, this.police);
          if (res === 'empty') this.toast('Out of ammo — visit Iron & Lead');
          else if (res) {
            this.audio.shot();
            if (res.kind === 'police') this.police.addStars(1, p.pos);
            if (res.kind === 'enemy') this.police.addStars(0, p.pos);
            this.walkers.scare(p.pos.x, p.pos.z, 18);
          }
        }
      }
      // --- one-shot keys ---
      if (input.tap('KeyQ')) { this.audio.unlock(); this.toast(`Radio: ${this.audio.nextStation()}`); }
      if (input.tap('Digit1')) p.selectWeapon(0);
      if (input.tap('Digit2')) p.selectWeapon(1);
      if (input.tap('Digit3')) p.selectWeapon(2);
      if (input.tap('Digit4')) p.selectWeapon(3);
      if (input.tap('KeyM') && !this.missions.active) {
        if (this.missions.done) this.toast('All twelve jobs are done — Rustport is yours.');
        else { this.missions.start(); this.audio.mission(); }
      }
      if (input.tap('KeyR') && !this.race) this.startRace();
      if (input.tap('KeyP') || input.tap('Escape')) this.showPause();
      if (input.tap('KeyH')) { this.audio.unlock(); this.audio.horn(); }

      // --- world systems ---
      this.traffic.update(effDt, p.inCar);
      this.walkers.update(effDt, p.pos, p.inCar ? Math.abs(p.inCar.speed) : 0);
      this.police.update(effDt, p.pos, p.inCar, () => this.showBusted(), this.audio);
      this.combat.update(effDt, p.pos, p);
      this.missions.update(effDt);
      this.updateRace(effDt);
      this.updateVigilante(effDt);
      this.updateChaseTrucks(effDt);
      this.updateCollectibles();
      this.updateShopHint();

      // --- health / death ---
      if (p.health <= 0) this.showOver();
      if (this._prevHealth !== undefined && p.health < this._prevHealth) this.hud.damageFlash();
      this._prevHealth = p.health;
    }

    this._debugDrive = null;
    this._debugWalk = null;
    input.consume();
    this.updateCamera(effDt);
    this.hud.update(effDt);
    if (render) this.render(effDt);
  }

  tryEnterCarOrShop() {
    const p = this.player;
    const shop = this.shops.nearShop();
    if (shop) { this.shops.use(shop); return; }
    let best = null;
    let bestD = 1e9;
    for (const c of [...this.parked, ...this.traffic.cars]) {
      const dx = c.pos.x - p.pos.x;
      const dz = c.pos.z - p.pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best && bestD < 3.4 * 3.4) {
      p.enterCar(best);
      this.audio.unlock();
      this.toast(`Stole the ${best.spec.label}${best.isPolice ? ' — the port police will notice!' : ''}`);
      if (best.isPolice || Math.random() < 0.35) this.police.addStars(1, p.pos);
      this.walkers.scare(p.pos.x, p.pos.z, 10);
    }
  }

  updateShopHint() {
    const shop = this.shops.nearShop();
    this.shopHint = shop ? this.shops.menuText(shop) : '';
  }

  updateCollectibles() {
    const p = this.player.pos;
    for (const pkg of this.city.packages) {
      if (pkg.taken) continue;
      const dx = pkg.x - p.x;
      const dz = pkg.z - p.z;
      if (dx * dx + dz * dz < 9) {
        pkg.taken = true;
        pkg.mesh.visible = false;
        this.packagesFound += 1;
        this.player.cash += 100;
        this.audio.pickup();
        this.toast(`Hidden package ${this.packagesFound}/20 — +$100`);
        this.saveGame();
      }
      pkg.mesh.rotation.y += 0.02;
    }
  }

  startRace() {
    const p = this.player.pos;
    let best = null;
    let bestD = 1e9;
    const starts = [
      { id: 'r1', name: 'River Run', x: -160, z: 0, cps: [{ x: 0, z: -160 }, { x: 160, z: 0 }, { x: 160, z: 160 }] },
      { id: 'r2', name: 'Bridge Sprint', x: 180, z: 0, cps: [{ x: 300, z: 0 }, { x: 330, z: -60 }, { x: 180, z: 0 }] },
      { id: 'r3', name: 'Port Loop', x: -180, z: -180, cps: [{ x: -180, z: 0 }, { x: 0, z: -180 }, { x: -180, z: -180 }] },
    ];
    for (const s of starts) {
      const d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best || bestD > 40 * 40) { this.toast('No race start nearby — find the checkered markers'); return; }
    this.race = { ...best, cpIdx: 0, timer: 90 };
    this.missions.moveBeacon(best.cps[0]);
    this.say('Kess the Racer', `${best.name} — three checkpoints, ninety seconds. Go!`);
  }

  updateRace(dt) {
    if (!this.race) return;
    const r = this.race;
    r.timer -= dt;
    if (r.timer <= 0) {
      this.toast(`${r.name} — out of time`);
      this.race = null;
      this.missions.moveBeacon(this.missions.active?.target ?? null);
      return;
    }
    const p = this.player.pos;
    const cp = r.cps[r.cpIdx];
    const dx = p.x - cp.x;
    const dz = p.z - cp.z;
    if (dx * dx + dz * dz < 36) {
      r.cpIdx += 1;
      this.audio.pickup();
      if (r.cpIdx >= r.cps.length) {
        const reward = RACES.find((x) => x.id === r.id)?.reward ?? 400;
        this.player.cash += reward;
        this.bestRace = Math.min(this.bestRace ?? 999, 90 - r.timer);
        this.toast(`${r.name} WON — +$${reward} · best ${this.bestRace.toFixed(1)}s`);
        this.audio.cash();
        this.race = null;
        this.missions.moveBeacon(this.missions.active?.target ?? null);
        this.saveGame();
      } else {
        this.missions.moveBeacon(r.cps[r.cpIdx]);
      }
    }
  }

  updateVigilante(dt) {
    // free-roam vigilante: a marked criminal appears now and then while
    // Mara is on foot with no heat; stopping them pays $200.
    this.vigilanteTimer -= dt;
    if (!this.vigilanteTarget && this.vigilanteTimer <= 0 && this.police.stars === 0 && !this.player.inCar) {
      const x = this.player.pos.x + (Math.random() - 0.5) * 60;
      const z = this.player.pos.z + (Math.random() - 0.5) * 60;
      this.vigilanteTarget = this.combat.spawnEnemy(x, z, 50);
      this.vigilanteTarget.isVigilante = true;
      this.toast('VIGILANTE — a marked criminal is nearby. Take them down: +$200');
      this.vigilanteTimer = 60;
    }
    if (this.vigilanteTarget && !this.vigilanteTarget.alive) {
      this.player.cash += 200;
      this.audio.cash();
      this.toast('Vigilante payout +$200');
      this.vigilanteTarget = null;
      this.vigilanteTimer = 45;
    }
  }

  updateChaseTrucks(dt) {
    for (const t of this.chaseTrucks) {
      if (t.health <= 0) continue;
      // flee toward the bridge
      const tx = CITY.half + 40;
      const tz = CITY.bridgeZ;
      const dx = tx - t.pos.x;
      const dz = tz - t.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const want = Math.atan2(dx, dz);
      let dh = want - t.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      t.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
      t.speed = Math.min(20, t.speed + 4 * dt);
      const nx = t.pos.x + Math.sin(t.heading) * t.speed * dt;
      const nz = t.pos.z + Math.cos(t.heading) * t.speed * dt;
      if (!this.city.collide(nx, nz, 1.8)) { t.pos.x = nx; t.pos.z = nz; }
      t.group.position.copy(t.pos);
      t.group.rotation.y = t.heading;
      // Mara's car ramming a truck damages it
      const pc = this.player.inCar;
      if (pc) {
        const ddx = pc.pos.x - t.pos.x;
        const ddz = pc.pos.z - t.pos.z;
        if (ddx * ddx + ddz * ddz < 12 && Math.abs(pc.speed) > 6) {
          t.damage(Math.abs(pc.speed) * 0.9 * dt * 10);
          pc.speed *= 0.7;
          this.shake = 0.3;
          if (t.health <= 0) { this.audio.explosion(); this.toast('Union truck stopped!'); }
        }
      }
    }
  }

  updateLighting() {
    const t = this.dayTime;
    // sun angle from the clock: noon overhead, dusk low and orange
    const ang = ((t - 6) / 12) * Math.PI;
    const elev = Math.sin(ang);
    this.sun.position.set(Math.cos(ang) * 220, Math.max(20, elev * 260), 120);
    const day = Math.max(0, Math.min(1, elev * 1.4));
    const dusk = Math.max(0, 1 - Math.abs(elev) * 3) * (t > 12 ? 1 : 0.4);
    this.sun.intensity = 0.25 + day * 2.2;
    this.sun.color.setHSL(0.09 + dusk * 0.02, 0.55 + dusk * 0.3, 0.55 + day * 0.15);
    this.moon.intensity = day < 0.15 ? 0.55 : 0.05;
    this.scene.background.setHSL(0.6, 0.5, 0.03 + day * 0.12 + dusk * 0.06);
    this.scene.fog.color.copy(this.scene.background);
    this.renderer.toneMappingExposure = 0.9 + day * 0.35;
  }

  updateCamera(dt) {
    const p = this.player;
    const focus = p.inCar ? p.inCar.pos : p.pos;
    const heading = p.inCar ? p.inCar.heading : p.heading;
    const t = performance.now() * 0.001;
    let target;
    if (this.cameraMode === 'aerial') {
      target = new THREE.Vector3(focus.x + 40, 150, focus.z + 90);
      this.camera.position.lerp(target, 0.05);
      this.camera.lookAt(focus.x, 0, focus.z);
      return;
    }
    const dist = p.inCar ? 11 : 6.5;
    const height = p.inCar ? 4.6 : 3.0;
    const yaw = heading + Math.PI + this.camYaw;
    target = new THREE.Vector3(
      focus.x + Math.sin(yaw) * dist,
      height,
      focus.z + Math.cos(yaw) * dist,
    );
    this.camera.position.lerp(target, Math.min(1, dt * 6));
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
    }
    this.camera.lookAt(focus.x, p.inCar ? 1.4 : 1.6, focus.z);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  loop(t) {
    if (this.screen === 'start' || this.screen === 'pause' || this.screen === 'busted' || this.screen === 'over') {
      // menus still render the world behind them
      this.render();
      requestAnimationFrame(this.loop);
      return;
    }
    const now = t / 1000;
    if (!this.lastT) this.lastT = now;
    let frame = Math.min(0.1, now - this.lastT);
    this.lastT = now;
    this.accum += frame;
    while (this.accum >= STEP) {
      this.step(STEP);
      this.accum -= STEP;
    }
    requestAnimationFrame(this.loop);
  }
}

try {
  new IronTide();
} catch (err) {
  console.error(err);
  document.getElementById('screen').innerHTML = `<h1>IRON TIDE</h1><p>Could not start: ${err.message}</p>`;
  window.__shotReady = false;
}
