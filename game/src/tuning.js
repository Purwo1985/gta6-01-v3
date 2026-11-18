// IRON TIDE — tuning: every number the game balances on lives here.
// Rustport is a 10x10 block grid on the west bank of the River Voss;
// the port and the container yard sit north, the airport south-east
// across the river, the steel bridge at z = 0. One step is 1/60 s.
export const STEP = 1 / 60;
export const WORLD_SEED = 20261118;

export const CITY = {
  blocks: 10,
  blockSize: 34,
  roadWidth: 12,
  get pitch() { return this.blockSize + this.roadWidth; },
  get half() { return (this.blocks * this.pitch) / 2; },
  riverX: 262,          // centreline of the River Voss, east of the grid
  riverWidth: 52,
  bridgeZ: 0,           // steel bridge crosses the river at z = 0
  airportX: 330,        // airstrip on the far bank
  airportZ: -60,
};

// Fourteen named districts, in a 10x10 grid. Each entry lists the block
// columns/rows it covers; the HUD names the district the player stands in.
export const DISTRICTS = [
  { name: 'Portside',     x0: -5, x1: -3, z0: -5, z1: -3, color: '#e8a33d' },
  { name: 'Docklands',    x0: -2, x1: 0,  z0: -5, z1: -3, color: '#7fb3d5' },
  { name: 'Foundry',      x0: 1,  x1: 4,  z0: -5, z1: -3, color: '#d98841' },
  { name: 'Northgate',    x0: -5, x1: -3, z0: -2, z1: 0,  color: '#9aa5b1' },
  { name: 'Old Town',     x0: -2, x1: 0,  z0: -2, z1: 0,  color: '#c9a86a' },
  { name: 'Downtown',     x0: 1,  x1: 4,  z0: -2, z1: 0,  color: '#5ec8e8' },
  { name: 'Canal Row',    x0: -5, x1: -3, z0: 1,  z1: 2,  color: '#7fd0a8' },
  { name: 'Marina',       x0: -2, x1: 0,  z0: 1,  z1: 2,  color: '#4fc3f7' },
  { name: 'Market Square',x0: 1,  x1: 4,  z0: 1,  z1: 2,  color: '#f2c14e' },
  { name: 'Ironworks',    x0: -5, x1: -3, z0: 3,  z1: 4,  color: '#b08968' },
  { name: 'Southbank',    x0: -2, x1: 0,  z0: 3,  z1: 4,  color: '#a1887f' },
  { name: 'Riverside',    x0: 1,  x1: 4,  z0: 3,  z1: 4,  color: '#81d4fa' },
  { name: 'Harbor View',  x0: -5, x1: -1, z0: 5,  z1: 5,  color: '#ce93d8' },
  { name: 'Airfield',     x0: 0,  x1: 4,  z0: 5,  z1: 5,  color: '#90a4ae' },
];

export const PLAYER_TUNE = {
  walkSpeed: 6.5,
  runSpeed: 12,
  radius: 0.6,
  height: 1.8,
  maxHealth: 100,
  maxArmour: 100,
  punchRange: 2.6,
  punchDamage: 30,
  punchCooldown: 0.42,
  punchKnockback: 5,
  shootRange: 46,
  enterRange: 3.4,
};

export const CAR_KINDS = {
  sedan:       { label: 'Voss Sedan',    accel: 1.0,  top: 1.0,  turn: 1.0,  grip: 1.0,  color: 0x8a9ba8, price: 0 },
  pickup:      { label: 'Dock Pickup',   accel: 0.85, top: 0.9,  turn: 0.88, grip: 1.2,  color: 0x7a5c3e, price: 0 },
  sport:       { label: 'Tide Runner',   accel: 1.4,  top: 1.32, turn: 1.28, grip: 1.12, color: 0xc0392b, price: 0 },
  truck:       { label: 'Haul Truck',    accel: 0.55, top: 0.68, turn: 0.66, grip: 1.5,  color: 0x5d6d7e, price: 0 },
  taxi:        { label: 'Rust Cab',      accel: 0.95, top: 0.98, turn: 1.05, grip: 1.0,  color: 0xf1c40f, price: 0 },
  van:         { label: 'Cargo Van',     accel: 0.75, top: 0.82, turn: 0.8,  grip: 1.25, color: 0x7d8c99, price: 0 },
  muscle:      { label: 'Iron Muscle',   accel: 1.2,  top: 1.12, turn: 0.95, grip: 1.05, color: 0x2e4053, price: 0 },
  interceptor: { label: 'Port Interceptor', accel: 1.5, top: 1.45, turn: 1.35, grip: 1.15, color: 0x1a1a2e, price: 0 },
};

export const CAR_TUNE = {
  accel: 26, brake: 46, reverseAccel: 16, maxSpeed: 40, maxReverse: 12,
  turnRate: 2.0, drag: 0.5, grip: 6.0, maxHealth: 100,
  nosBoost: 1.65, nosDrain: 0.55, nosRegen: 0.06, nosMax: 100,
};

export const TRAFFIC_TUNE = { cars: 18, walkers: 34, carSpeed: 9.5, walkerSpeed: 1.7, turnChance: 0.32 };

export const POLICE_TUNE = {
  maxCars: 6, chaseSpeed: 36, ramDamage: 8, bustRange: 2.8,
  spawnDistance: 60, decaySeconds: 15, heliStars: 3, roadblockStars: 3,
  sightRange: 70, loseSightSeconds: 9,
};

export const WEAPONS = [
  { id: 'fists',   name: 'FISTS',   price: 0,    ammo: Infinity, damage: 30, range: 2.6,  rate: 0.42 },
  { id: 'pistol',  name: 'PISTOL',  price: 250,  ammo: 60,       damage: 34, range: 46,   rate: 0.3 },
  { id: 'smg',     name: 'SMG',     price: 700,  ammo: 180,      damage: 22, range: 40,   rate: 0.09 },
  { id: 'shotgun', name: 'SHOTGUN', price: 1200, ammo: 40,       damage: 70, range: 18,   rate: 0.8 },
];

// Twelve story missions for Mara Voss, in order. `type` drives the
// mission engine: goto / deliver / lose / taxi / hold / race / heist /
// recruit / chase / steal / escape.
export const MISSIONS = [
  { id: 'm01', title: 'First Wheels',   giver: 'Mara Voss',     reward: 250,  type: 'steal',   text: 'The union took my car. Take the sedan at the Portside docks and bring it to the garage on Canal Row.' },
  { id: 'm02', title: 'The Crate Run',  giver: 'Old Barto',     reward: 400,  type: 'deliver', text: 'A crate of "machine parts" needs to reach the Foundry warehouse. Drive careful — the port watch is awake.' },
  { id: 'm03', title: 'Shake the Tail', giver: 'Mara Voss',     reward: 350,  type: 'lose',    text: 'A union tail is on you. Lose the heat — break line of sight and stay hidden until the stars fade.' },
  { id: 'm04', title: 'Night Cab',      giver: 'Rust Cab Co.',  reward: 500,  type: 'taxi',    text: 'Two fares across town before dawn. Pick up the markers, drop them off, keep the meter honest.' },
  { id: 'm05', title: 'Pawn Shop Hold', giver: 'Old Barto',     reward: 650,  type: 'hold',    text: 'Hold the pawn shop on Market Square until the safe opens. The clerk will call it in — be quick.' },
  { id: 'm06', title: 'River Run',      giver: 'Kess the Racer',reward: 550,  type: 'race',    text: 'Three checkpoints, one river road. Beat the clock and the River Run trophy is yours.' },
  { id: 'm07', title: 'Marina Vault',   giver: 'Old Barto',     reward: 800,  type: 'hold',    text: 'The marina office safe holds the union ledger. Crack it and get out before the patrol boats notice.' },
  { id: 'm08', title: 'The Crew',       giver: 'Mara Voss',     reward: 450,  type: 'recruit', text: 'Find Jax at the Ironworks and Lena at the Marina. A heist needs hands you can trust.' },
  { id: 'm09', title: 'Dockside Chase', giver: 'Old Barto',     reward: 700,  type: 'chase',   text: 'Union trucks are hauling the evidence out of the port. Run them down before they reach the bridge.' },
  { id: 'm10', title: 'Interceptor',    giver: 'Kess the Racer',reward: 900,  type: 'steal',   text: 'The port police interceptor is parked at Northgate. Steal it — we need its speed for the big one.' },
  { id: 'm11', title: 'The Big Score',  giver: 'Old Barto',     reward: 1500, type: 'heist',   text: 'The container vault at Portside. Your crew rides with you. Grab the ledger, beat the helicopter, vanish.' },
  { id: 'm12', title: 'Clean Slate',    giver: 'Mara Voss',     reward: 2000, type: 'escape',  text: 'Five stars and the whole city awake. Reach the Airfield runway and fly out of Rustport for good.' },
];

export const RACES = [
  { id: 'r1', name: 'River Run',    reward: 400 },
  { id: 'r2', name: 'Bridge Sprint', reward: 600 },
  { id: 'r3', name: 'Port Loop',    reward: 800 },
];

export const STATIONS = [
  { id: 'rust',  name: 'RUST FM',       desc: 'harbour rock' },
  { id: 'neon',  name: 'NEON 88',       desc: 'synthwave nights' },
  { id: 'talk',  name: 'PORT TALK',     desc: 'dockside talk radio' },
  { id: 'jazz',  name: 'TIDE JAZZ',     desc: 'rainy piano' },
];

export const SHOPS = [
  { id: 'gun',    kind: 'gun',    name: 'Iron & Lead',   x: 69,  z: 69,  district: 'Market Square' },
  { id: 'clinic', kind: 'clinic', name: 'Dock Clinic',   x: -69, z: 23,  district: 'Canal Row' },
  { id: 'paint',  kind: 'paint',  name: 'Neon Paint',    x: 23,  z: -69, district: 'Old Town' },
  { id: 'garage', kind: 'garage', name: 'Voss Garage',   x: -23, z: 69,  district: 'Southbank' },
  { id: 'diner',  kind: 'diner',  name: 'Tide Diner',    x: 115, z: -23, district: 'Downtown' },
];

export const SAFEHOUSES = [
  { id: 'apt',   name: 'Riverside Apartment', x: 161, z: 115, district: 'Riverside' },
  { id: 'motel', name: 'Northgate Motel',     x: -161, z: -115, district: 'Northgate' },
  { id: 'boat',  name: 'Marina Boathouse',    x: -69, z: 115, district: 'Marina' },
];

export const COLLECTIBLES = 20;
export const STUNT_JUMPS = [
  { x: 207, z: 0, name: 'Bridge Leap' },
  { x: -207, z: -138, name: 'Foundry Ramp' },
  { x: 69, z: 207, name: 'Southbank Jump' },
];
