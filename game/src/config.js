// Aurora Skies — Island Hopper: every tuning number, airport, aircraft and mission in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size. The world is a single long route measured in pixels of distance;
// the aircraft stays near the left third of the screen and the terrain scrolls past it.

export const FIELD = { width: 1280, height: 720, horizonY: 180, groundScreenY: 648 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Altitude in feet maps to the screen: 0 ft sits on the ground line, 12000 ft near the top. */
export const ALTITUDE = { maxFeet: 12000, groundY: 648, topY: 88 };

/** The aircraft's fixed screen position; the world scrolls underneath it. */
export const PLANE = { screenX: 380, width: 118, height: 34 };

export const FUEL = { start: 100, drainIdle: 0.22, drainThrottle: 0.85, ringBonus: 6, lowWarn: 25 };
export const HULL = { start: 100, stormHit: 20, birdHit: 12, hardLanding: 30 };

/** Six real airports along the island-hopping route, in flying order, with their real codes. */
export const AIRPORTS = [
  { code: 'SGN', name: 'Tan Son Nhat', city: 'Ho Chi Minh City', distance: 0, runway: 900 },
  { code: 'HAN', name: 'Noi Bai', city: 'Hanoi', distance: 9000, runway: 900 },
  { code: 'SIN', name: 'Changi', city: 'Singapore', distance: 18000, runway: 900 },
  { code: 'HND', name: 'Haneda', city: 'Tokyo', distance: 27000, runway: 900 },
  { code: 'LHR', name: 'Heathrow', city: 'London', distance: 36000, runway: 900 },
  { code: 'LAX', name: 'Los Angeles Intl', city: 'Los Angeles', distance: 45000, runway: 900 },
];

/** Three flyable aircraft. The first is free; the others unlock with career points. */
export const AIRCRAFT = [
  { id: 'kite', name: 'Kite-172 Skyhawk', kind: 'Prop trainer', unlock: 0, maxSpeed: 210, climb: 1.0, fuelUse: 1.0, handling: 1.0, color: '#e8b64c' },
  { id: 'cormorant', name: 'Cormorant T-44', kind: 'Twin turboprop', unlock: 1500, maxSpeed: 300, climb: 1.35, fuelUse: 1.15, handling: 1.15, color: '#4fc3f7' },
  { id: 'aurora', name: 'Aurora Jet X-9', kind: 'Light jet', unlock: 4000, maxSpeed: 420, climb: 1.8, fuelUse: 1.4, handling: 1.3, color: '#c792ea' },
];

/** Twelve named career missions. Each is one leg of the route with its own rings and weather. */
export const MISSIONS = [
  { name: 'Dawn Patrol', from: 0, to: 1, rings: 4, weather: 'clear', time: 'dawn', briefing: 'First light over the delta. Fly SGN to HAN and thread 4 rings.' },
  { name: 'Monsoon Crossing', from: 1, to: 2, rings: 5, weather: 'monsoon', time: 'day', briefing: 'Rain bands over the gulf. HAN to SIN through 5 rings — mind the storm cells.' },
  { name: 'Island Hop', from: 2, to: 3, rings: 5, weather: 'clear', time: 'day', briefing: 'Blue water all the way. SIN to HND, 5 rings, gentle crosswind.' },
  { name: 'Night Freight', from: 3, to: 4, rings: 6, weather: 'fog', time: 'night', briefing: 'Red-eye cargo run. HND to LHR in fog — trust the instruments.' },
  { name: 'Atlantic Leap', from: 4, to: 5, rings: 6, weather: 'storm', time: 'dusk', briefing: 'The long hop. LHR to LAX through 6 rings and a storm front.' },
  { name: 'Cyclone Alley', from: 0, to: 2, rings: 7, weather: 'storm', time: 'day', briefing: 'Two legs, one storm. SGN to SIN non-stop, 7 rings, heavy weather.' },
  { name: 'Golden Hour Mail', from: 2, to: 4, rings: 8, weather: 'clear', time: 'dusk', briefing: 'Sunset mail run. SIN to LHR, 8 rings, land before dark.' },
  { name: 'Typhoon Edge', from: 3, to: 5, rings: 8, weather: 'monsoon', time: 'night', briefing: 'Ride the edge of the typhoon. HND to LAX, 8 rings, no room for error.' },
  { name: 'Polar Shortcut', from: 4, to: 0, rings: 9, weather: 'fog', time: 'dawn', briefing: 'Over the pole and home. LHR to SGN, 9 rings in thin dawn fog.' },
  { name: 'Ring Rush Grand Prix', from: 1, to: 3, rings: 10, weather: 'clear', time: 'day', briefing: 'Ten rings, one clock. HAN to HND as fast as your throttle allows.' },
  { name: 'Storm Chaser', from: 0, to: 3, rings: 10, weather: 'storm', time: 'dusk', briefing: 'Three legs inside the front. SGN to HND — the storm is the course.' },
  { name: 'Around the World Finale', from: 0, to: 5, rings: 12, weather: 'monsoon', time: 'day', briefing: 'The whole route. SGN to LAX, 12 rings, every weather the sky owns.' },
];

/** Three timed challenge modes, separate from the career. */
export const CHALLENGES = [
  { id: 'ring-rush', name: 'Ring Rush', goal: 'Fly 8 rings before the clock runs out', seconds: 90 },
  { id: 'storm-runner', name: 'Storm Runner', goal: 'Thread the storm line without a scratch', seconds: 120 },
  { id: 'fuel-saver', name: 'Fuel Saver', goal: 'Reach Haneda on half a tank', seconds: 150 },
];

export const RING = { radius: 46, points: 100, comboStep: 1 };
export const STORM = { radius: 120, push: 260 };
export const BIRD = { speed: 90, radius: 14 };

export const PALETTE = {
  skyDawn: ['#2b3a67', '#e8907c', '#f7c873'],
  skyDay: ['#3f8fd2', '#8ec8ee', '#dff2fb'],
  skyDusk: ['#3a2b5c', '#e86a6a', '#f7b267'],
  skyNight: ['#0b1026', '#1b2a52', '#2c4a7a'],
  sea: '#1d6f8e',
  seaDeep: '#14506b',
  island: '#3f7a4a',
  islandHigh: '#6a8f5a',
  city: '#5a5f6e',
  runway: '#3a3f4a',
  ring: '#ffd94a',
  storm: '#4a4a58',
  text: '#f2f5f8',
  muted: '#b9c4d0',
  panel: 'rgba(10, 18, 32, 0.72)',
  warn: '#ff5a4e',
  good: '#7be495',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where career points and the best score are kept between visits (this browser only). */
export const SAVE_KEY = 'aurora-skies.save.v1';
