// IRON TIDE — rng: a small deterministic generator so the city, the
// traffic and the mission layouts are identical for a given seed. The
// game uses one seeded stream for the world layout and a second, free
// stream for moment-to-moment randomness, so a screenshot seed replays
// the same Rustport every time.
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    // mulberry32 — tiny, fast, good enough for procedural placement.
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range(a, b) { return a + (b - a) * next(); },
    int(a, b) { return Math.floor(this.range(a, b + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}
