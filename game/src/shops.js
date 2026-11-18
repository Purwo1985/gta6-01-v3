// IRON TIDE — shops: the places that take Mara's money and give her
// something back. Gun shop (weapons + ammo, cheaper where standing is
// high), clinic (health), paint shop (new colour, −1 star), garage
// (engine / armour / NOS upgrades for the car she drives), diner
// (health + a little gossip). Three safehouses heal her and clear the
// wanted level. Standing is per district and grows from jobs done there.
import { WEAPONS, SHOPS, SAFEHOUSES } from './tuning.js';

export class Shops {
  constructor(game) {
    this.game = game;
  }

  price(base, district) {
    const standing = this.game.standing[district] ?? 0;
    const discount = Math.min(0.3, standing * 0.03);
    return Math.max(1, Math.round(base * (1 - discount)));
  }

  // Returns a menu description for the HUD when Mara is near a shop.
  nearShop() {
    const p = this.game.player.pos;
    for (const s of SHOPS) {
      const dx = p.x - s.x;
      const dz = p.z - s.z;
      if (dx * dx + dz * dz < 9 * 9) return s;
    }
    for (const s of SAFEHOUSES) {
      const dx = p.x - s.x;
      const dz = p.z - s.z;
      if (dx * dx + dz * dz < 9 * 9) return { ...s, kind: 'safehouse' };
    }
    return null;
  }

  use(shop) {
    const g = this.game;
    const p = g.player;
    if (shop.kind === 'gun') {
      // buy the next weapon Mara does not own, else ammo for the current one
      const next = WEAPONS.find((w) => !p.weapons.some((o) => o.id === w.id));
      if (next) {
        const price = this.price(next.price, shop.district);
        if (p.cash >= price) {
          p.cash -= price;
          p.giveWeapon(next.id, next.ammo);
          g.toast(`Bought ${next.name} — $${price}`);
          g.audio.cash();
        } else g.toast(`Need $${price} for the ${next.name}`);
      } else {
        const w = p.weapon;
        const price = this.price(60, shop.district);
        if (p.cash >= price && w.id !== 'fists') {
          p.cash -= price;
          w.ammo = Math.min(w.ammo + 60, 999);
          g.toast(`Ammo +60 for ${w.name} — $${price}`);
        } else g.toast('Ammo full or fists equipped');
      }
    } else if (shop.kind === 'clinic') {
      const price = this.price(80, shop.district);
      if (p.cash >= price) { p.cash -= price; p.heal(100); p.armour = 100; g.toast('Patched up — health + armour full'); }
      else g.toast(`Clinic costs $${price}`);
    } else if (shop.kind === 'paint') {
      const price = this.price(150, shop.district);
      if (p.inCar && p.cash >= price) {
        p.cash -= price;
        const colors = [0xc0392b, 0x2471a3, 0x1e8449, 0xd4ac0d, 0x7d3c98, 0x111111];
        const c = colors[Math.floor(Math.random() * colors.length)];
        p.inCar.group.children[0].material.color.setHex(c);
        g.police.setStars(Math.max(0, g.police.stars - 1), p.pos);
        g.toast('Fresh paint — the heat drops a star');
      } else if (!p.inCar) g.toast('Bring a car to the paint shop');
      else g.toast(`Repaint costs $${price}`);
    } else if (shop.kind === 'garage') {
      if (!p.inCar) { g.toast('Bring a car to the garage'); return; }
      const car = p.inCar;
      const up = car.upgrades;
      const next = up.engine < 3 ? ['engine', up.engine] : up.armor < 3 ? ['armor', up.armor] : up.nos < 3 ? ['nos', up.nos] : null;
      if (!next) { g.toast('This car is fully upgraded'); return; }
      const price = this.price(400 * (next[1] + 1), shop.district);
      if (p.cash >= price) {
        p.cash -= price;
        up[next[0]] += 1;
        car.health = car.maxHealth();
        g.toast(`${next[0].toUpperCase()} upgraded to level ${up[next[0]]} — $${price}`);
        g.audio.cash();
      } else g.toast(`Upgrade costs $${price}`);
    } else if (shop.kind === 'diner') {
      const price = this.price(25, shop.district);
      if (p.cash >= price) { p.cash -= price; p.heal(40); g.toast('Tide Diner special — health +40'); }
      else g.toast(`A meal costs $${price}`);
    } else if (shop.kind === 'safehouse') {
      p.heal(100);
      g.police.clearWanted();
      g.toast(`${shop.name} — rested, heat cleared`);
      g.audio.mission();
      g.saveGame();
    }
  }

  menuText(shop) {
    switch (shop.kind) {
      case 'gun': return 'E — Gun shop: buy weapons & ammo';
      case 'clinic': return 'E — Clinic: heal + armour ($80)';
      case 'paint': return 'E — Paint shop: new colour, −1 star ($150)';
      case 'garage': return 'E — Garage: upgrade engine / armour / NOS';
      case 'diner': return 'E — Diner: eat, heal +40 ($25)';
      case 'safehouse': return 'E — Safehouse: rest & clear wanted';
      default: return '';
    }
  }
}
