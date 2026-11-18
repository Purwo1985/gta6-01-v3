// IRON TIDE — hud: every DOM readout plus the live minimap. The
// minimap is a small canvas drawn each frame: roads, the river, the
// bridge, district tint, the player arrow, the gold mission beacon,
// police dots, roadblocks, shops, safehouses and uncollected packages.
import { CITY, DISTRICTS, SHOPS, SAFEHOUSES } from './tuning.js';

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {
      stars: document.getElementById('stars'),
      cash: document.getElementById('cash'),
      clock: document.getElementById('clock'),
      district: document.getElementById('district'),
      objective: document.getElementById('objective'),
      hp: document.querySelector('#hp i'),
      arm: document.querySelector('#arm i'),
      nos: document.querySelector('#nos i'),
      speed: document.querySelector('#speed b'),
      weapon: document.getElementById('weapon'),
      radio: document.getElementById('radio'),
      sub: document.getElementById('sub'),
      toast: document.getElementById('toast'),
      screen: document.getElementById('screen'),
      dmg: document.getElementById('dmg'),
    };
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this._toastTimer = null;
    this._subTimer = null;
  }

  fmtClock(hours) {
    const h = Math.floor(hours) % 24;
    const m = Math.floor((hours % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < g.police.stars ? '★' : '<span class="off">★</span>';
    this.el.stars.innerHTML = stars;
    this.el.cash.textContent = `$${p.cash.toLocaleString('en-US')}`;
    const weather = g.raining ? 'RAIN' : (g.dayTime > 6 && g.dayTime < 19 ? 'CLEAR' : 'NIGHT');
    this.el.clock.textContent = `${this.fmtClock(g.dayTime)} · ${weather} · PKG ${g.packagesFound}/20`;
    const d = g.districtName();
    this.el.district.innerHTML = `${d.toUpperCase()}<small>${d} · standing ${g.standing[d] ?? 0} · crew: ${g.crew.join(', ') || 'none'}</small>`;
    this.el.objective.innerHTML = `<b>${g.missions.done ? 'RUSTPORT LEGEND' : (g.missions.active ? g.missions.active.def.title : 'FREE ROAM')}</b><br>${g.missions.objectiveText()}${g.shopHint ? `<br><span style="color:#7dff9b">${g.shopHint}</span>` : ''}`;
    this.el.hp.style.width = `${p.health}%`;
    this.el.arm.style.width = `${p.armour}%`;
    const car = p.inCar;
    this.el.nos.style.width = `${car ? car.nos : 100}%`;
    this.el.speed.textContent = car ? String(Math.round(Math.abs(car.speed) * 2.2)) : '0';
    const w = p.weapon;
    this.el.weapon.textContent = w.id === 'fists' ? 'FISTS' : `${w.name} · ${w.ammo === Infinity ? '∞' : w.ammo}`;
    this.el.radio.textContent = `RADIO · ${g.audio.stationName()}  [Q]`;
    this.drawMinimap();
  }

  drawMinimap() {
    const g = this.game;
    const ctx = this.mapCtx;
    const W = 190;
    const size = CITY.half * 2 + 130;
    const toMap = (x, z) => [
      ((x + CITY.half + 40) / size) * W,
      ((z + CITY.half + 40) / size) * W,
    ];
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = 'rgba(10,18,28,0.9)';
    ctx.fillRect(0, 0, W, W);
    // river
    const [rx] = toMap(CITY.riverX, 0);
    ctx.fillStyle = '#14425e';
    ctx.fillRect(rx - 8, 0, 16, W);
    // roads
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2;
    const p = CITY.pitch;
    for (let i = 0; i <= 10; i += 1) {
      const c = -CITY.half + i * p - 6;
      const [x0, y0] = toMap(c, -CITY.half);
      const [x1, y1] = toMap(c, CITY.half);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const [hx0, hy0] = toMap(-CITY.half, c);
      const [hx1, hy1] = toMap(CITY.half, c);
      ctx.beginPath(); ctx.moveTo(hx0, hy0); ctx.lineTo(hx1, hy1); ctx.stroke();
    }
    // bridge
    ctx.strokeStyle = '#b03a2e';
    ctx.lineWidth = 3;
    const [bx0, by0] = toMap(CITY.half, 0);
    const [bx1, by1] = toMap(CITY.riverX + 30, 0);
    ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(bx1, by1); ctx.stroke();
    const dot = (x, z, color, r = 3) => {
      const [mx, my] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
    };
    for (const s of SHOPS) dot(s.x, s.z, '#33ccff', 2.5);
    for (const s of SAFEHOUSES) dot(s.x, s.z, '#7dff9b', 2.5);
    for (const pkg of g.city.packages) if (!pkg.taken) dot(pkg.x, pkg.z, '#ffd700', 2);
    for (const rb of g.police.roadblocks) dot(rb.x, rb.z, '#ff4444', 3.5);
    for (const c of g.police.cars) dot(c.pos.x, c.pos.z, '#ff2222', 3);
    if (g.missions.active?.target) {
      const t = g.missions.active.target;
      const [mx, my] = toMap(t.x, t.z);
      ctx.fillStyle = '#ffc93c';
      ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.stroke();
    }
    // player arrow
    const [px, py] = toMap(g.player.pos.x, g.player.pos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-g.player.heading + (g.player.inCar ? 0 : 0));
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  toast(text) {
    this.el.toast.textContent = text;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this.el.toast.textContent = ''; }, 3600);
  }

  say(who, text) {
    this.el.sub.innerHTML = `<b>${who}:</b> ${text}`;
    clearTimeout(this._subTimer);
    this._subTimer = setTimeout(() => { this.el.sub.innerHTML = ''; }, 5200);
  }

  damageFlash() {
    this.el.dmg.style.opacity = '1';
    setTimeout(() => { this.el.dmg.style.opacity = '0'; }, 140);
  }

  showScreen(html) {
    this.el.screen.innerHTML = html;
    this.el.screen.classList.remove('hidden');
    document.body.classList.add('menu-open');
  }

  hideScreen() {
    this.el.screen.classList.add('hidden');
    this.el.screen.innerHTML = '';
    document.body.classList.remove('menu-open');
  }
}
