// The screenshot scenes behind ?shot=start|play|mission|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot (climb
// toward the next ring, descend toward the runway with the gear down, dodge storm cells by
// altitude), so the frame is what a short game really looks like and the same seed always gives
// the same frame.
import { STEP } from './config.js';
import { EVENT_CRASHED, EVENT_LANDED } from './world.js';
import { SCREEN_MISSION, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 30;
const LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** Steer the aircraft: toward the next ring's altitude, or down to the runway when it is close. */
export function autopilot(world, cautious) {
  const state = world.state;
  const plane = state.plane;
  const controls = { pitch: 0, throttle: 0, boost: false, gear: plane.gear };
  const toDist = state.toAirport.distance;
  const remain = toDist - plane.distance;
  const nextRing = state.rings.find((ring) => !ring.taken && ring.distance > plane.distance - 50);
  let targetAlt = nextRing ? nextRing.altFeet : 3500;
  // Approach: stay high over the islands, then descend steeply once the flat runway zone is near.
  if (remain < 2600) targetAlt = Math.max(1800, remain * 0.6);
  if (remain < 1000) {
    targetAlt = Math.max(world.terrainElevation(plane.distance + 400) + 250, remain * 0.5, 150);
    controls.gear = true;
  }
  if (plane.distance >= toDist - state.toAirport.runway / 2) targetAlt = 40; // Final flare over the flat runway.
  // Storm ahead at our altitude: climb over it, or duck under it, whichever is closer.
  for (const storm of state.storms) {
    const dx = storm.distance - plane.distance;
    if (dx > 0 && dx < 700 && Math.abs(plane.altFeet - storm.altFeet) < storm.radius) {
      targetAlt = plane.altFeet > storm.altFeet ? storm.altFeet + storm.radius + 500 : storm.altFeet - storm.radius - 500;
    }
  }
  // Never plan a descent into the island ahead — except on the runway itself.
  if (plane.distance < toDist - state.toAirport.runway / 2) {
    targetAlt = Math.max(targetAlt, world.terrainElevation(plane.distance + 800) + 300);
  }
  const error = targetAlt - plane.altFeet;
  controls.pitch = error > 60 ? -1 : error < -60 ? 1 : 0;
  // A cautious pilot keeps the throttle mid-range; a hurried one pushes it and never gears down.
  controls.throttle = cautious ? 0 : 1;
  if (!cautious && remain < 900) controls.gear = false;
  return controls;
}

/**
 * Set `world` to the named scene (start, play, mission or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name !== 'play' && name !== 'mission' && name !== 'end') {
    world.reset('career', 0, 0, 0, 0);
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(world, true), true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const cautious = name !== 'end';
  world.reset('career', 0, 0, 0, 0);
  const limit = name === 'play' ? PLAY_SECONDS : LIMIT_SECONDS;
  for (let index = 0; index < limit / STEP; index += 1) {
    const events = world.step(STEP, autopilot(world, cautious), false);
    if (events & EVENT_LANDED) return { screen: SCREEN_MISSION, best: state.score };
    if (events & EVENT_CRASHED) break;
  }
  const over = state.status !== 'flying';
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
}
