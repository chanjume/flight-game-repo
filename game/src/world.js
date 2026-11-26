// Aurora Skies — the flight model, with no drawing and no browser in it: the aircraft, the route,
// rings, storms, birds, terrain, fuel, hull, score and missions. step() advances one fixed step
// and returns what happened as bit flags, so the caller can react without the world knowing about
// screens or sound. The route is generated from the seed, so the same seed always flies the same sky.
import {
  AIRCRAFT, AIRPORTS, ALTITUDE, BIRD, CHALLENGES, FUEL, HULL, MISSIONS, RING, STORM,
} from './config.js';

export const EVENT_RING = 1;
export const EVENT_HIT = 2;
export const EVENT_LANDED = 4;
export const EVENT_CRASHED = 8;
export const EVENT_FUEL_LOW = 16;
export const EVENT_FUEL_EMPTY = 32;

const KNOTS_PER_PX = 1.15;
const CRUISE_CLIMB = 1500;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/** A rolling island peak: a gaussian bump in terrain elevation, in feet. */
function makePeaks(random, fromDist, toDist) {
  const peaks = [];
  for (let d = fromDist + 1200; d < toDist - 600; d += 1400 + random() * 900) {
    peaks.push({
      distance: d + random() * 600,
      heightFeet: 700 + random() * 1900,
      width: 420 + random() * 520,
    });
  }
  return peaks;
}

function makeRings(random, fromDist, toDist, count) {
  const rings = [];
  const span = toDist - fromDist;
  for (let index = 0; index < count; index += 1) {
    const distance = fromDist + (span * (index + 0.7)) / (count + 0.4) + (random() - 0.5) * 500;
    rings.push({
      distance,
      altFeet: 1800 + random() * 5200,
      taken: false,
    });
  }
  return rings;
}

function makeStorms(random, fromDist, toDist, weather) {
  const density = weather === 'storm' ? 5 : weather === 'monsoon' ? 4 : weather === 'fog' ? 1 : 2;
  const storms = [];
  const span = toDist - fromDist;
  for (let index = 0; index < density; index += 1) {
    storms.push({
      distance: fromDist + (span * (index + 0.6)) / (density + 0.3) + (random() - 0.5) * 700,
      altFeet: 2500 + random() * 4500,
      radius: STORM.radius * (0.85 + random() * 0.4),
      hit: false,
      phase: random() * Math.PI * 2,
    });
  }
  return storms;
}

function makeBirds(random, fromDist, toDist) {
  const birds = [];
  for (let d = fromDist + 1500; d < toDist - 500; d += 1700 + random() * 1200) {
    birds.push({ distance: d, altFeet: 900 + random() * 2600, hit: false, phase: random() * Math.PI * 2 });
  }
  return birds;
}

export function createWorld(random) {
  const plane = {
    distance: 0, altFeet: 800, throttle: 0.55, pitch: 0, gear: false,
    fuel: FUEL.start, hull: HULL.start, speedKnots: 0, shake: 0,
  };
  const state = {
    plane,
    mode: 'career',
    missionIndex: 0,
    aircraftIndex: 0,
    challengeIndex: 0,
    mission: MISSIONS[0],
    fromAirport: AIRPORTS[0],
    toAirport: AIRPORTS[1],
    rings: [],
    storms: [],
    birds: [],
    peaks: [],
    score: 0,
    combo: 1,
    ringsCollected: 0,
    ringsTotal: 0,
    elapsed: 0,
    timeLeft: 0,
    status: 'flying',
    crashReason: '',
    callout: '',
    calloutTime: 0,
    windKnots: 0,
    fuelWarned: false,
    missionBonus: 0,
    careerPoints: 0,
  };

  function terrainElevation(distance) {
    // Flat and safe on every runway; rolling island peaks everywhere else.
    for (const airport of AIRPORTS) {
      if (Math.abs(distance - airport.distance) < airport.runway / 2 + 320) return 0;
    }
    let elevation = 0;
    for (const peak of state.peaks) {
      const dx = (distance - peak.distance) / peak.width;
      elevation = Math.max(elevation, peak.heightFeet * Math.exp(-dx * dx * 2.2));
    }
    return elevation + 260 * Math.max(0, Math.sin(distance / 1700));
  }

  function buildRoute() {
    const from = state.fromAirport.distance;
    const to = state.toAirport.distance;
    const mission = state.mission;
    const weather = mission.weather;
    state.peaks = makePeaks(random, from, to);
    state.rings = makeRings(random, from, to, mission.rings);
    state.storms = makeStorms(random, from, to, weather);
    state.birds = makeBirds(random, from, to);
    state.ringsTotal = state.rings.length;
    state.windKnots = weather === 'storm' ? 18 + random() * 10 : weather === 'monsoon' ? 12 : 6;
  }

  function reset(mode, missionIndex, aircraftIndex, challengeIndex, careerPoints) {
    state.mode = mode;
    state.missionIndex = missionIndex;
    state.aircraftIndex = aircraftIndex;
    state.challengeIndex = challengeIndex;
    state.careerPoints = careerPoints || 0;
    if (mode === 'challenge') {
      const challenge = CHALLENGES[challengeIndex];
      state.mission = challenge.id === 'ring-rush'
        ? { ...MISSIONS[9], name: 'Ring Rush', rings: 8 }
        : challenge.id === 'storm-runner'
          ? { ...MISSIONS[10], name: 'Storm Runner', weather: 'storm' }
          : { ...MISSIONS[1], name: 'Fuel Saver', weather: 'clear' };
      state.timeLeft = challenge.seconds;
    } else if (mode === 'free') {
      state.mission = { name: 'Free Flight', from: 0, to: 5, rings: 10, weather: 'clear', time: 'day', briefing: 'The whole route, your pace, your rules.' };
      state.timeLeft = 0;
    } else {
      state.mission = MISSIONS[missionIndex % MISSIONS.length];
      state.timeLeft = 0;
    }
    state.fromAirport = AIRPORTS[state.mission.from];
    state.toAirport = AIRPORTS[state.mission.to];
    // Some missions fly the route backwards (LHR home to SGN): build the leg in flying order.
    if (state.toAirport.distance < state.fromAirport.distance) {
      const leg = { from: state.toAirport, to: state.fromAirport };
      state.fromAirport = leg.from;
      state.toAirport = leg.to;
    }
    buildRoute();
    plane.distance = state.fromAirport.distance + 100;
    plane.altFeet = 600;
    plane.throttle = 0.55;
    plane.pitch = 0;
    plane.gear = false;
    plane.fuel = state.mode === 'challenge' && state.challengeIndex === 2 ? 50 : FUEL.start;
    plane.hull = HULL.start;
    plane.speedKnots = 0;
    plane.shake = 0;
    state.score = 0;
    state.combo = 1;
    state.ringsCollected = 0;
    state.elapsed = 0;
    state.status = 'flying';
    state.crashReason = '';
    state.callout = `${state.fromAirport.code} → ${state.toAirport.code} — ${state.mission.name}`;
    state.calloutTime = 3;
    state.fuelWarned = false;
    state.missionBonus = 0;
  }

  function say(text, seconds) {
    state.callout = text;
    state.calloutTime = seconds;
  }

  function crash(reason) {
    state.status = 'crashed';
    state.crashReason = reason;
    plane.shake = 1;
  }

  function land(hard) {
    state.status = 'landed';
    const timeBonus = Math.max(0, Math.round(300 - state.elapsed));
    state.missionBonus = 500 + timeBonus + state.ringsCollected * 50;
    state.score += state.missionBonus;
    say(hard ? 'HARD LANDING — but you made it!' : `TOUCHDOWN at ${state.toAirport.code}! +${state.missionBonus}`, 4);
  }

  function step(dt, controls, attract) {
    if (state.status !== 'flying') return 0;
    let events = 0;
    const aircraft = AIRCRAFT[state.aircraftIndex];
    state.elapsed += dt;
    if (state.timeLeft > 0) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.status = 'failed';
        state.crashReason = 'OUT OF TIME';
        return EVENT_CRASHED;
      }
    }
    if (state.calloutTime > 0) state.calloutTime -= dt;
    if (plane.shake > 0) plane.shake = Math.max(0, plane.shake - dt * 1.4);

    // Throttle and pitch answer at every speed; boost trades fuel for climb and speed.
    if (!attract) {
      plane.throttle = clamp(plane.throttle + controls.throttle * dt * 0.55, 0, 1);
      plane.pitch = controls.pitch;
      if (controls.gear !== undefined) plane.gear = controls.gear;
    }
    const boosting = !attract && controls.boost && plane.fuel > 0;
    const speedPx = (30 + plane.throttle * aircraft.maxSpeed) * (boosting ? 1.35 : 1);
    plane.speedKnots = Math.round(speedPx * KNOTS_PER_PX);
    plane.distance += speedPx * dt;
    state.score += speedPx * dt * 0.02;

    // Climb and descent: pitch, throttle, wind and the storm's push all move the aircraft.
    let vertical = -plane.pitch * CRUISE_CLIMB * aircraft.climb * (0.35 + 0.65 * plane.throttle);
    if (boosting) vertical += 500 * aircraft.climb;
    if (plane.fuel <= 0) vertical = -420; // Out of fuel: the aircraft glides down, always.
    vertical += Math.sin(state.elapsed * 0.7) * state.windKnots * 6;
    plane.altFeet = clamp(plane.altFeet + vertical * dt, 0, ALTITUDE.maxFeet);

    // Fuel burns with throttle; a ring tops it up a little.
    if (!attract) {
      plane.fuel = Math.max(0, plane.fuel - (FUEL.drainIdle + FUEL.drainThrottle * plane.throttle * aircraft.fuelUse + (boosting ? 0.9 : 0)) * dt);
      if (plane.fuel <= FUEL.lowWarn && !state.fuelWarned) {
        state.fuelWarned = true;
        say('LOW FUEL — find a ring or land soon', 3);
        events |= EVENT_FUEL_LOW;
      }
      if (plane.fuel <= 0) {
        say('FUEL EMPTY — GLIDING', 2);
        events |= EVENT_FUEL_EMPTY;
      }
    }

    // Rings: fly through the glowing hoop for points, combo and fuel.
    for (const ring of state.rings) {
      if (ring.taken) continue;
      if (Math.abs(plane.distance - ring.distance) < 90 && Math.abs(plane.altFeet - ring.altFeet) < RING.radius + 60) {
        ring.taken = true;
        state.ringsCollected += 1;
        const gained = RING.points * state.combo;
        state.score += gained;
        state.combo = Math.min(8, state.combo + RING.comboStep);
        plane.fuel = Math.min(100, plane.fuel + FUEL.ringBonus);
        say(`RING ${state.ringsCollected}/${state.ringsTotal}  +${gained}  COMBO x${state.combo}`, 2);
        events |= EVENT_RING;
      }
    }

    // Storm cells: a hit costs hull, breaks the combo and shakes the airframe.
    for (const storm of state.storms) {
      if (storm.hit || attract) continue;
      const dx = Math.abs(plane.distance - storm.distance);
      const dy = Math.abs(plane.altFeet - storm.altFeet);
      if (dx < storm.radius && dy < storm.radius * 0.62) {
        storm.hit = true;
        plane.hull -= HULL.stormHit;
        state.combo = 1;
        plane.shake = 1;
        plane.altFeet += (random() - 0.5) * 900;
        say(`STORM HIT! HULL -${HULL.stormHit} — combo lost`, 3);
        events |= EVENT_HIT;
        if (plane.hull <= 0) { crash('TORN APART BY THE STORM'); return events | EVENT_CRASHED; }
      } else if (dx < storm.radius * 1.6) {
        plane.altFeet += Math.sin(state.elapsed * 3 + storm.phase) * STORM.push * dt * 0.4;
      }
    }

    // Birds: small, fast, and easy to miss until they are not.
    for (const bird of state.birds) {
      if (bird.hit || attract) continue;
      if (Math.abs(plane.distance - bird.distance) < 46 && Math.abs(plane.altFeet - bird.altFeet) < 60) {
        bird.hit = true;
        plane.hull -= HULL.birdHit;
        plane.shake = 0.7;
        say(`BIRD STRIKE! HULL -${HULL.birdHit}`, 2);
        events |= EVENT_HIT;
        if (plane.hull <= 0) { crash('BIRD STRIKE — ENGINE OUT'); return events | EVENT_CRASHED; }
      }
    }

    // The destination runway: gear down and slow means a landing; anything else is a crash.
    const toDist = state.toAirport.distance;
    const runwayHalf = state.toAirport.runway / 2;
    if (plane.distance >= toDist - runwayHalf && plane.distance <= toDist + runwayHalf + 200) {
      if (plane.altFeet <= 70) {
        if (plane.gear && plane.speedKnots < 230) { land(plane.speedKnots > 180); return events | EVENT_LANDED; }
        if (!plane.gear) { crash('BELLY LANDING — GEAR UP'); return events | EVENT_CRASHED; }
        plane.hull -= HULL.hardLanding;
        plane.altFeet = 320;
        plane.speedKnots = Math.round(plane.speedKnots * 0.5);
        say(`TOO FAST — BOUNCED! HULL -${HULL.hardLanding}`, 3);
        events |= EVENT_HIT;
        if (plane.hull <= 0) { crash('RUNWAY OVERRUN'); return events | EVENT_CRASHED; }
      }
    }

    // Terrain: any island peak the aircraft meets below its crest ends the flight.
    // (Attract mode, behind the title menu, flies through everything: it never crashes.)
    const ground = terrainElevation(plane.distance);
    if (!attract && plane.altFeet <= ground && plane.distance > state.fromAirport.distance + state.fromAirport.runway / 2 + 100) {
      crash(plane.distance < toDist - runwayHalf ? 'CONTROLLED FLIGHT INTO TERRAIN' : 'CRASHED SHORT OF THE RUNWAY');
      return events | EVENT_CRASHED;
    }

    // Taking off again: leaving the departure runway without climbing is a crash too.
    if (plane.distance > state.fromAirport.distance + state.fromAirport.runway && plane.altFeet <= 0) {
      crash('NEVER GOT AIRBORNE');
      return events | EVENT_CRASHED;
    }
    return events;
  }

  return {
    state,
    reset,
    step,
    terrainElevation,
    aircraft() { return AIRCRAFT[state.aircraftIndex]; },
    destinationDistance() { return state.toAirport.distance - plane.distance; },
  };
}
