// Aurora Skies — boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, game over, mission complete and
// mission failed. The title screen keeps flying behind the menu in attract mode.
// ?seed=N fixes the route. ?shot=start|play|mission|end (with &seed=N) stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { AIRCRAFT, MISSIONS, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASHED, EVENT_LANDED } from './world.js';
import {
  ACTION_CONFIRM, ACTION_GEAR, ACTION_MODE_CAREER, ACTION_MODE_CHALLENGE, ACTION_MODE_FREE,
  ACTION_NEXT_MISSION, ACTION_NEXT_PLANE, ACTION_PAUSE, createInput,
} from './input.js';
import {
  SCREEN_FAILED, SCREEN_MISSION, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

// The renderer reads these helpers off the state: the terrain function, the aircraft list and the
// mission list, so the world module itself stays free of drawing.
world.state.__terrain = (distance) => world.terrainElevation(distance);
world.state.__aircraft = () => AIRCRAFT[world.state.aircraftIndex];
world.state.__aircraftList = AIRCRAFT;
world.state.__missions = MISSIONS;

function readSave() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? '{}');
    return { careerPoints: saved.careerPoints || 0, best: saved.best || 0 };
  } catch {
    return { careerPoints: 0, best: 0 };
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const save = { careerPoints: 1200, best: 2480 };
  const scene = stageShot(name, world);
  window.__shotScreen = scene.screen;
  window.__auroraState = world.state;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, save);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const save = readSave();
  let screen = SCREEN_TITLE;
  let mode = 'career';
  let challengeIndex = 0;
  let missionIndex = 0;
  let aircraftIndex = 0;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each event.
  function announce(message) {
    status.textContent = message;
  }

  function startFlight() {
    const unlocked = AIRCRAFT[aircraftIndex].unlock <= save.careerPoints;
    const plane = unlocked ? aircraftIndex : 0;
    world.state.missionIndex = missionIndex;
    world.state.aircraftIndex = plane;
    world.reset(mode, missionIndex, plane, challengeIndex, save.careerPoints);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Flying ${world.state.mission.name}, ${world.state.fromAirport.code} to ${world.state.toAirport.code}.`);
  }

  function endFlight(landed) {
    screen = landed ? SCREEN_MISSION : SCREEN_OVER;
    if (world.state.score > save.best) save.best = Math.round(world.state.score);
    if (landed) {
      save.careerPoints += Math.round(world.state.score);
      missionIndex = (missionIndex + 1) % MISSIONS.length;
    }
    writeSave(save);
    announce(landed ? `Mission complete. Score ${Math.round(world.state.score)}.` : `Crashed: ${world.state.crashReason}. Score ${Math.round(world.state.score)}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_NEXT_MISSION) missionIndex = (missionIndex + 1) % MISSIONS.length;
      if (actions & ACTION_NEXT_PLANE) aircraftIndex = (aircraftIndex + 1) % AIRCRAFT.length;
      if (actions & ACTION_MODE_CAREER) mode = 'career';
      if (actions & ACTION_MODE_FREE) mode = 'free';
      if (actions & ACTION_MODE_CHALLENGE) {
        mode = 'challenge';
        challengeIndex = (challengeIndex + 1) % 3;
      }
      if (actions & ACTION_CONFIRM) startFlight();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_OVER || screen === SCREEN_MISSION || screen === SCREEN_FAILED)) {
      startFlight();
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
    if (actions & ACTION_GEAR && screen === SCREEN_PLAY) {
      world.state.plane.gear = !world.state.plane.gear;
      announce(world.state.plane.gear ? 'Gear down.' : 'Gear up.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { pitch: 0, throttle: 0, boost: false, gear: false }, true);
      return;
    }
    const controls = {
      pitch: input.pitch(),
      throttle: input.throttle(),
      boost: input.boost(),
    };
    const events = world.step(STEP, controls, false);
    if (events & EVENT_LANDED) endFlight(true);
    else if (events & EVENT_CRASHED) {
      if (world.state.status === 'failed') {
        screen = SCREEN_FAILED;
        announce(`Mission failed: ${world.state.crashReason}.`);
      } else endFlight(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    world.state.missionIndex = missionIndex;
    world.state.aircraftIndex = aircraftIndex;
    renderer.draw(world.state, screen, save.best, save);
  }

  // Leaving the tab pauses a running flight rather than letting it fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // The title screen needs a route behind the menu: start the attract flight now.
  world.reset('career', 0, 0, 0, save.careerPoints);
  window.__auroraState = world.state;
  announce('Aurora Skies. Press Enter or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
