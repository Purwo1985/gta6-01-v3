// IRON TIDE — shots: the four screenshot scenes. Each one stages the
// real game — the real city, the real systems, a short autopilot drive
// — and then lets it render, so every screenshot is a frame the game
// itself produced, never a mock-up. ?shot=chase|street|mission|start
// picks one; the URL seed keeps the city identical between runs.
import { STEP } from './tuning.js';

function driveForward(game, seconds) {
  const ticks = Math.floor(seconds / STEP);
  for (let i = 0; i < ticks; i += 1) {
    game.debugDrive({ forward: 1, steer: 0 });
    game.step(STEP, false);
  }
}

function walkForward(game, seconds) {
  const ticks = Math.floor(seconds / STEP);
  for (let i = 0; i < ticks; i += 1) {
    game.debugWalk({ forward: 1 });
    game.step(STEP, false);
  }
}

const STAGES = {
  chase(game) {
    // Cover shot: five stars on the steel bridge at dusk, two patrol
    // cars closing in and the helicopter overhead, the skyline ahead.
    game.debugPlaceCar(300, 0, -Math.PI / 2);
    game.debugSetWanted(5);
    game.debugSetTime(18.4);
    game.debugCamera('chase');
    driveForward(game, 1.4);
    game.debugSpawnPolice(2);
    // pull one patrol car into view ahead on the bridge, so the chase
    // reads in a single frame instead of only behind the camera
    const lead = game.police.cars[0];
    if (lead) {
      lead.pos.set(game.player.pos.x - 26, 0, 2);
      lead.heading = -Math.PI / 2;
      lead.speed = 10;
    }
    driveForward(game, 0.7);
    return 'play';
  },
  street(game) {
    // On foot in Old Town at night: crowd, traffic, neon shop signs.
    // Mara starts ON the north-south road at x=40 (a road centreline),
    // so the walk camera stays on asphalt instead of inside a block.
    game.debugSetTime(21.5);
    game.debugStartMission(0);
    game.debugPlacePlayer(40, -92);
    // crowd on the east sidewalk, clear of the camera-player sightline
    // so Mara herself stays visible in the middle of the frame
    game.debugGatherWalkers(54, -100, 10);
    game.debugCamera('walk');
    walkForward(game, 1.5);
    return 'play';
  },
  mission(game) {
    // The Big Score in progress: Mara driving into Portside with the
    // gold beacon ahead and the crew riding along. She starts on the
    // north-south road at x=-190 heading for the container vault, so
    // the drive stays on asphalt instead of into a building block.
    game.debugSetTime(17.2);
    game.debugStartMission(10);
    game.debugPlaceCar(-190, -120, Math.PI);
    game.debugCamera('chase');
    driveForward(game, 1.8);
    return 'play';
  },
  start(game) {
    // Aerial view of the whole port city at golden hour, title on top.
    // Many steps so the aerial camera finishes its slow lerp from the
    // origin to its high perch before the frame is taken.
    game.debugSetTime(17.8);
    game.debugCamera('aerial');
    for (let i = 0; i < 120; i += 1) game.step(STEP, false);
    return 'start';
  },
};

// Stage `name` on a fresh game and hand back the screen the HUD should
// show over the finished frame.
export function stageShot(name, game) {
  game.resetWorld();
  const stage = STAGES[name] ?? STAGES.start;
  return stage(game);
}
