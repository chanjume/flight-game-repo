// Aurora Skies — every pixel: the sky, the sea, the islands, the runways, the aircraft and the
// instruments. The renderer only reads the world state and the screen; it never changes the rules.
// One logical field (1280x720) is scaled to the window, so the HUD reads the same at any size.
import { AIRPORTS, ALTITUDE, FIELD, PALETTE } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_MISSION = 4;
export const SCREEN_FAILED = 5;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/** Deterministic pseudo-random from an index, so clouds and city blocks never flicker. */
function hash(index) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function altToY(altFeet) {
  return ALTITUDE.groundY - (clamp(altFeet, 0, ALTITUDE.maxFeet) / ALTITUDE.maxFeet) * (ALTITUDE.groundY - ALTITUDE.topY);
}

function skyColors(time) {
  if (time === 'dawn') return PALETTE.skyDawn;
  if (time === 'dusk') return PALETTE.skyDusk;
  if (time === 'night') return PALETTE.skyNight;
  return PALETTE.skyDay;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fitCanvas() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    canvas.width = Math.round(FIELD.width * scale * (window.devicePixelRatio || 1));
    canvas.height = Math.round(FIELD.height * scale * (window.devicePixelRatio || 1));
    ctx.setTransform(canvas.width / FIELD.width, 0, 0, canvas.height / FIELD.height, 0, 0);
  }

  function drawSky(state) {
    const colors = skyColors(state.mission.time);
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.55, colors[1]);
    gradient.addColorStop(1, colors[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Sun or moon, low on the horizon for dawn and dusk flights.
    const sunX = 1020;
    const sunY = state.mission.time === 'night' ? 110 : state.mission.time === 'day' ? 120 : 300;
    ctx.fillStyle = state.mission.time === 'night' ? '#e8ecf5' : '#ffd97a';
    ctx.beginPath();
    ctx.arc(sunX, sunY, state.mission.time === 'night' ? 30 : 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 217, 122, 0.18)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
    ctx.fill();
    if (state.mission.time === 'night') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 40; i += 1) {
        ctx.fillRect(hash(i) * FIELD.width, hash(i + 100) * 220, 2, 2);
      }
    }
  }

  function drawClouds(state) {
    const plane = state.plane;
    const parallax = plane.distance * 0.25;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < 16; i += 1) {
      const x = (((hash(i) * 2600 - parallax * (0.6 + hash(i + 40) * 0.7)) % 1500) + 1500) % 1500 - 110;
      const y = 60 + hash(i + 80) * 260;
      const w = 90 + hash(i + 20) * 130;
      ctx.beginPath();
      ctx.ellipse(x, y, w, 16 + hash(i + 60) * 10, 0, 0, Math.PI * 2);
      ctx.ellipse(x + w * 0.4, y + 8, w * 0.55, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSeaAndTerrain(state) {
    const plane = state.plane;
    // Sea fills the lower half; the islands rise out of it.
    const sea = ctx.createLinearGradient(0, 420, 0, FIELD.height);
    sea.addColorStop(0, PALETTE.sea);
    sea.addColorStop(1, PALETTE.seaDeep);
    ctx.fillStyle = sea;
    ctx.fillRect(0, 420, FIELD.width, FIELD.height - 420);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i += 1) {
      const y = 460 + i * 26;
      ctx.beginPath();
      for (let x = 0; x <= FIELD.width; x += 32) {
        const wave = Math.sin(x / 90 + state.elapsed * 1.4 + i * 2.1) * 3;
        if (x === 0) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
    // Island silhouette, sampled from the world's own terrain function.
    ctx.beginPath();
    ctx.moveTo(0, FIELD.height);
    for (let x = 0; x <= FIELD.width; x += 16) {
      const worldDistance = plane.distance - 380 + x;
      const elev = state.__terrain ? state.__terrain(worldDistance) : 0;
      ctx.lineTo(x, altToY(elev) + 26);
    }
    ctx.lineTo(FIELD.width, FIELD.height);
    ctx.closePath();
    const land = ctx.createLinearGradient(0, 300, 0, FIELD.height);
    land.addColorStop(0, PALETTE.islandHigh);
    land.addColorStop(1, PALETTE.island);
    ctx.fillStyle = land;
    ctx.fill();
    // Beach line where the islands meet the sea.
    ctx.strokeStyle = '#e8d9a0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= FIELD.width; x += 16) {
      const worldDistance = plane.distance - 380 + x;
      const elev = state.__terrain ? state.__terrain(worldDistance) : 0;
      const y = altToY(elev) + 26;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawAirport(state, airport) {
    const plane = state.plane;
    const screenX = 380 + (airport.distance - plane.distance);
    if (screenX < -500 || screenX > FIELD.width + 500) return;
    const runwayY = ALTITUDE.groundY;
    // City blocks with lit windows beside the runway.
    ctx.fillStyle = PALETTE.city;
    for (let i = 0; i < 9; i += 1) {
      const bx = screenX - 460 + i * 52 + hash(i + airport.distance) * 20;
      const bh = 26 + hash(i + 30) * 54;
      ctx.fillRect(bx, runwayY - bh, 40, bh);
      ctx.fillStyle = '#ffd97a';
      for (let w = 0; w < 3; w += 1) {
        if (hash(i * 7 + w) > 0.45) ctx.fillRect(bx + 6 + w * 12, runwayY - bh + 8 + hash(w + i) * (bh - 16), 6, 8);
      }
      ctx.fillStyle = PALETTE.city;
    }
    // Control tower.
    ctx.fillStyle = '#8a8f9c';
    ctx.fillRect(screenX + 330, runwayY - 96, 16, 96);
    ctx.fillStyle = '#4fc3f7';
    ctx.fillRect(screenX + 324, runwayY - 112, 28, 18);
    // The runway itself: strip, centre line, threshold lights and a windsock.
    ctx.fillStyle = PALETTE.runway;
    ctx.fillRect(screenX - airport.runway / 2, runwayY - 6, airport.runway, 14);
    ctx.fillStyle = '#f2f5f8';
    for (let x = screenX - airport.runway / 2 + 30; x < screenX + airport.runway / 2 - 20; x += 60) {
      ctx.fillRect(x, runwayY - 1, 34, 4);
    }
    ctx.fillStyle = '#7be495';
    for (let x = screenX - airport.runway / 2; x <= screenX + airport.runway / 2; x += 60) {
      ctx.fillRect(x - 3, runwayY - 12, 6, 5);
    }
    ctx.strokeStyle = '#e8b64c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(screenX + 300, runwayY - 6);
    ctx.lineTo(screenX + 300, runwayY - 52);
    ctx.stroke();
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath();
    ctx.moveTo(screenX + 300, runwayY - 52);
    ctx.lineTo(screenX + 326, runwayY - 46);
    ctx.lineTo(screenX + 300, runwayY - 40);
    ctx.closePath();
    ctx.fill();
    // Airport sign: code and name, readable from the air.
    ctx.fillStyle = 'rgba(10, 18, 32, 0.78)';
    ctx.fillRect(screenX - 130, runwayY - 168, 260, 44);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(airport.code, screenX, runwayY - 138);
    ctx.fillStyle = '#f2f5f8';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`${airport.name} — ${airport.city}`, screenX, runwayY - 132 + 16);
    ctx.textAlign = 'left';
  }

  function drawRings(state) {
    const plane = state.plane;
    for (const ring of state.rings) {
      const x = 380 + (ring.distance - plane.distance);
      if (x < -80 || x > FIELD.width + 80 || ring.taken) continue;
      const y = altToY(ring.altFeet);
      const pulse = 1 + Math.sin(state.elapsed * 4 + ring.distance) * 0.08;
      ctx.strokeStyle = PALETTE.ring;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(x, y, 46 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 217, 74, 0.35)';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(x, y, 46 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#1a1200';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RING', x, y + 5);
      ctx.textAlign = 'left';
    }
  }

  function drawStorms(state) {
    const plane = state.plane;
    for (const storm of state.storms) {
      const x = 380 + (storm.distance - plane.distance);
      if (x < -220 || x > FIELD.width + 220) continue;
      const y = altToY(storm.altFeet);
      const flash = Math.sin(state.elapsed * 7 + storm.phase) > 0.92;
      ctx.fillStyle = flash ? 'rgba(255, 240, 160, 0.9)' : 'rgba(74, 74, 88, 0.92)';
      ctx.beginPath();
      ctx.ellipse(x, y, storm.radius, storm.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.ellipse(x - storm.radius * 0.5, y + 18, storm.radius * 0.6, storm.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.ellipse(x + storm.radius * 0.5, y + 16, storm.radius * 0.6, storm.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff5a4e';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STORM CELL', x, y - storm.radius * 0.55 - 8);
      ctx.textAlign = 'left';
      if (flash) {
        ctx.strokeStyle = '#ffe9a0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y + storm.radius * 0.4);
        ctx.lineTo(x - 12, y + storm.radius * 0.8);
        ctx.lineTo(x + 4, y + storm.radius * 1.05);
        ctx.stroke();
      }
    }
  }

  function drawBirds(state) {
    const plane = state.plane;
    ctx.strokeStyle = '#22242c';
    ctx.lineWidth = 3;
    for (const bird of state.birds) {
      if (bird.hit) continue;
      const x = 380 + (bird.distance - plane.distance) + Math.sin(state.elapsed * 2 + bird.phase) * 20;
      if (x < -30 || x > FIELD.width + 30) continue;
      const y = altToY(bird.altFeet) + Math.sin(state.elapsed * 3 + bird.phase) * 14;
      const flap = Math.sin(state.elapsed * 10 + bird.phase) * 6;
      ctx.beginPath();
      ctx.moveTo(x - 12, y - flap);
      ctx.quadraticCurveTo(x, y + 4, x + 12, y - flap);
      ctx.stroke();
    }
  }

  /** The aircraft, drawn as a built machine: fuselage, tail, wing, windows, livery and gear. */
  function drawPlane(state, aircraft) {
    const plane = state.plane;
    const x = 380;
    const y = altToY(plane.altFeet);
    const shakeX = plane.shake > 0 ? (Math.random() - 0.5) * plane.shake * 10 : 0;
    const shakeY = plane.shake > 0 ? (Math.random() - 0.5) * plane.shake * 10 : 0;
    const bank = clamp(-plane.pitch * 0.22, -0.3, 0.3);
    ctx.save();
    ctx.translate(x + shakeX, y + shakeY);
    ctx.rotate(bank);
    // Exhaust and speed lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const len = 30 + plane.throttle * 60;
      ctx.beginPath();
      ctx.moveTo(-62, -6 + i * 8);
      ctx.lineTo(-62 - len, -6 + i * 8);
      ctx.stroke();
    }
    // Wing.
    ctx.fillStyle = aircraft.color;
    ctx.beginPath();
    ctx.moveTo(-8, 2);
    ctx.lineTo(-34, 26);
    ctx.lineTo(-18, 28);
    ctx.lineTo(16, 4);
    ctx.closePath();
    ctx.fill();
    // Fuselage.
    ctx.fillStyle = '#f2f5f8';
    ctx.beginPath();
    ctx.moveTo(-62, 0);
    ctx.quadraticCurveTo(-58, -14, -30, -15);
    ctx.lineTo(34, -13);
    ctx.quadraticCurveTo(58, -10, 60, 0);
    ctx.quadraticCurveTo(40, 10, 0, 11);
    ctx.lineTo(-40, 10);
    ctx.quadraticCurveTo(-58, 8, -62, 0);
    ctx.closePath();
    ctx.fill();
    // Livery stripe and tail.
    ctx.fillStyle = aircraft.color;
    ctx.fillRect(-56, -4, 104, 5);
    ctx.beginPath();
    ctx.moveTo(-58, -12);
    ctx.lineTo(-44, -38);
    ctx.lineTo(-30, -38);
    ctx.lineTo(-38, -12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8b64c';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(aircraft.id === 'kite' ? 'KITE-172' : aircraft.id === 'cormorant' ? 'T-44' : 'X-9', -20, -18);
    // Cockpit windows, lit.
    ctx.fillStyle = '#bfe8ff';
    ctx.beginPath();
    ctx.moveTo(34, -11);
    ctx.lineTo(48, -8);
    ctx.lineTo(48, -2);
    ctx.lineTo(34, -3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2b3a67';
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.arc(-6 + i * 12, -6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Landing gear, down when the pilot asks for it.
    if (plane.gear) {
      ctx.strokeStyle = '#22242c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-24, 10);
      ctx.lineTo(-24, 22);
      ctx.moveTo(28, 10);
      ctx.lineTo(28, 22);
      ctx.stroke();
      ctx.fillStyle = '#22242c';
      ctx.beginPath();
      ctx.arc(-24, 24, 5, 0, Math.PI * 2);
      ctx.arc(28, 24, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Altitude ribbon under the aircraft, so height reads even over open sea.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(x, y + 14);
    ctx.lineTo(x, ALTITUDE.groundY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawHud(state, best) {
    const plane = state.plane;
    const aircraft = state.__aircraft();
    // Top bar: score, combo, mission, destination and clock.
    panel(12, 10, FIELD.width - 24, 52);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`SCORE ${Math.round(state.score)}`, 28, 44);
    ctx.fillStyle = state.combo > 1 ? '#ffd94a' : PALETTE.muted;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`COMBO x${state.combo}`, 230, 42);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${state.mission.name.toUpperCase()}  •  ${state.fromAirport.code} → ${state.toAirport.code}`, FIELD.width / 2, 42);
    ctx.textAlign = 'right';
    ctx.fillText(`RINGS ${state.ringsCollected}/${state.ringsTotal}`, FIELD.width - 200, 42);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(state.timeLeft > 0 ? `⏱ ${Math.ceil(state.timeLeft)}s` : `${Math.floor(state.elapsed)}s`, FIELD.width - 28, 42);
    ctx.textAlign = 'left';

    // Left instruments: altitude, speed, heading.
    panel(12, 74, 190, 132);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('ALTITUDE', 26, 96);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(`${Math.round(plane.altFeet)}`, 26, 128);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('FEET', 150, 126);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('SPEED', 26, 156);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(`${plane.speedKnots}`, 26, 188);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('KNOTS', 130, 186);

    // Compass strip along the bottom, with the heading bug.
    panel(220, 656, FIELD.width - 440, 44);
    const heading = 90 + Math.round(Math.sin(state.elapsed * 0.5) * 3);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 15) {
      const x = FIELD.width / 2 + d * 4;
      const hdg = ((heading + d) % 360 + 360) % 360;
      ctx.fillText(d === 0 ? `HDG ${heading}°` : `${hdg}°`, x, 682);
    }
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.moveTo(FIELD.width / 2, 660);
    ctx.lineTo(FIELD.width / 2 - 6, 668);
    ctx.lineTo(FIELD.width / 2 + 6, 668);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = 'left';

    // Right instruments: fuel gauge, hull, throttle, gear.
    panel(FIELD.width - 202, 74, 190, 168);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('FUEL', FIELD.width - 188, 96);
    const fuelW = 162 * (plane.fuel / 100);
    ctx.fillStyle = '#22242c';
    ctx.fillRect(FIELD.width - 188, 104, 162, 16);
    ctx.fillStyle = plane.fuel <= FUEL_LOW ? '#ff5a4e' : '#7be495';
    ctx.fillRect(FIELD.width - 188, 104, fuelW, 16);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`${Math.round(plane.fuel)}%`, FIELD.width - 188, 140);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('HULL', FIELD.width - 188, 162);
    ctx.fillStyle = '#22242c';
    ctx.fillRect(FIELD.width - 188, 170, 162, 16);
    ctx.fillStyle = plane.hull > 50 ? '#7be495' : plane.hull > 25 ? '#ffd94a' : '#ff5a4e';
    ctx.fillRect(FIELD.width - 188, 170, 162 * (plane.hull / 100), 16);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`${Math.round(plane.hull)}%`, FIELD.width - 188, 206);
    ctx.fillStyle = plane.gear ? '#7be495' : PALETTE.muted;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(plane.gear ? 'GEAR DOWN  [G]' : 'GEAR UP  [G]', FIELD.width - 188, 232);
    // Throttle bar under the fuel panel, with the aircraft's name on its own line.
    panel(FIELD.width - 202, 254, 190, 64);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`THROTTLE ${Math.round(plane.throttle * 100)}%`, FIELD.width - 188, 272);
    ctx.fillStyle = '#22242c';
    ctx.fillRect(FIELD.width - 188, 280, 162, 10);
    ctx.fillStyle = '#4fc3f7';
    ctx.fillRect(FIELD.width - 188, 280, 162 * plane.throttle, 10);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(aircraft.name.toUpperCase(), FIELD.width - 188, 308);

    // Minimap: the whole leg, airports, rings and the aircraft's place on it.
    panel(12, 620, 300, 88);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('ROUTE MAP', 26, 640);
    const mapX0 = 30;
    const mapX1 = 294;
    const span = state.toAirport.distance - state.fromAirport.distance;
    const mapX = (d) => mapX0 + ((d - state.fromAirport.distance) / span) * (mapX1 - mapX0);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mapX(state.fromAirport.distance), 672);
    ctx.lineTo(mapX(state.toAirport.distance), 672);
    ctx.stroke();
    for (const airport of AIRPORTS) {
      if (airport.distance < state.fromAirport.distance || airport.distance > state.toAirport.distance) continue;
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(mapX(airport.distance), 672, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(airport.code, mapX(airport.distance) - 10, 692);
    }
    for (const ring of state.rings) {
      ctx.fillStyle = ring.taken ? '#7be495' : '#ffd94a';
      ctx.beginPath();
      ctx.arc(mapX(ring.distance), 672, ring.taken ? 2.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const px = mapX(plane.distance);
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath();
    ctx.moveTo(px, 660);
    ctx.lineTo(px - 6, 672);
    ctx.lineTo(px + 6, 672);
    ctx.closePath();
    ctx.fill();
    const remain = Math.max(0, Math.round((state.toAirport.distance - plane.distance) / 100));
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`${remain} NM TO ${state.toAirport.code}`, 26, 660 - 6);

    // Callout banner: rings, storm hits, low fuel — the game talking to the pilot.
    if (state.calloutTime > 0 && state.callout) {
      ctx.fillStyle = 'rgba(10, 18, 32, 0.8)';
      ctx.font = 'bold 20px system-ui, sans-serif';
      const w = ctx.measureText(state.callout).width + 36;
      ctx.beginPath();
      ctx.roundRect((FIELD.width - w) / 2, 78, w, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#ffd94a';
      ctx.textAlign = 'center';
      ctx.fillText(state.callout, FIELD.width / 2, 105);
      ctx.textAlign = 'left';
    }
    // Weather banner, top right under the fuel panel.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`WX: ${state.mission.weather.toUpperCase()}  •  WIND ${state.windKnots} KT  •  BEST ${Math.round(best)}`, FIELD.width - 220, 336);
    ctx.textAlign = 'left';
    // Controls hint, faint at the bottom left.
    ctx.fillStyle = 'rgba(242, 245, 248, 0.75)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('↑↓ pitch   ←→ throttle   SPACE boost   G gear   P pause', 330, 716);
  }

  function drawTitle(state, best, save) {
    // The title screen flies the attract world behind the menu, so the first frame is already a game.
    ctx.fillStyle = 'rgba(8, 14, 26, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('AURORA SKIES', FIELD.width / 2, 128);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('— ISLAND HOPPER —', FIELD.width / 2, 164);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Six airports. Twelve missions. Three aircraft. One sky.', FIELD.width / 2, 192);
    ctx.textAlign = 'left';

    // Modes.
    panel(60, 220, 360, 150);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('FLY NOW', 80, 248);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('[1] CAREER — 12 named missions', 80, 278);
    ctx.fillText('[2] FREE FLIGHT — the whole route', 80, 306);
    ctx.fillText('[3] CHALLENGES — 3 timed modes', 80, 334);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('ENTER flies the selected mission.', 80, 358);

    // Mission board: the career, with its airports and weather.
    panel(440, 220, 400, 260);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('CAREER MISSIONS  [M] next', 460, 248);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '15px system-ui, sans-serif';
    for (let i = 0; i < 6; i += 1) {
      const mission = state.__missions[(state.missionIndex + i) % state.__missions.length];
      const selected = i === 0;
      ctx.fillStyle = selected ? '#ffd94a' : PALETTE.text;
      ctx.fillText(`${selected ? '▸ ' : '   '}${mission.name} — ${AIRPORTS[mission.from].code}→${AIRPORTS[mission.to].code} · ${mission.rings} rings · ${mission.weather}`, 460, 276 + i * 30);
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '14px system-ui, sans-serif';
    const current = state.__missions[state.missionIndex % state.__missions.length];
    const briefing = current.briefing.length > 46 ? current.briefing.slice(0, 46) + '…' : current.briefing;
    ctx.fillText(`Selected: ${briefing}`, 460, 466);

    // Hangar: three aircraft, locked ones show their price in career points.
    panel(860, 220, 360, 260);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('HANGAR  [Q] next aircraft', 880, 248);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '15px system-ui, sans-serif';
    state.__aircraftList.forEach((craft, i) => {
      const unlocked = save.careerPoints >= craft.unlock;
      const selected = i === state.aircraftIndex;
      ctx.fillStyle = selected ? '#ffd94a' : PALETTE.text;
      ctx.fillText(`${selected ? '▸ ' : '   '}${craft.name} — ${craft.kind}`, 880, 278 + i * 56);
      ctx.fillStyle = unlocked ? PALETTE.muted : '#ff5a4e';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(unlocked ? `Max ${craft.maxSpeed} kt · climb x${craft.climb}` : `Locked — ${craft.unlock} career pts (you have ${save.careerPoints})`, 880, 298 + i * 56);
      ctx.font = '15px system-ui, sans-serif';
    });
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Career points: ' + save.careerPoints + '   ·   Best score: ' + Math.round(save.best), 880, 452);

    // Airports strip and controls footer.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('SGN Tan Son Nhat  ·  HAN Noi Bai  ·  SIN Changi  ·  HND Haneda  ·  LHR Heathrow  ·  LAX Los Angeles', FIELD.width / 2, 528);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('↑ ↓ climb & descend     ← → throttle     SPACE boost     G landing gear     P pause     ENTER fly', FIELD.width / 2, 556);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('PRESS ENTER OR CLICK TO FLY', FIELD.width / 2, 600);
    ctx.textAlign = 'left';
  }

  function drawEndCard(state, best, screen, save) {
    const landed = screen === SCREEN_MISSION;
    ctx.fillStyle = 'rgba(8, 14, 26, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(FIELD.width / 2 - 300, 150, 600, 380);
    ctx.textAlign = 'center';
    ctx.fillStyle = landed ? '#7be495' : '#ff5a4e';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(landed ? 'MISSION COMPLETE' : screen === SCREEN_FAILED ? 'MISSION FAILED' : 'CRASHED', FIELD.width / 2, 220);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px system-ui, sans-serif';
    if (landed) {
      ctx.fillText(`Touchdown at ${state.toAirport.name} (${state.toAirport.code})`, FIELD.width / 2, 258);
      ctx.fillText(`Mission bonus +${state.missionBonus}  ·  Rings ${state.ringsCollected}/${state.ringsTotal}`, FIELD.width / 2, 290);
    } else {
      ctx.fillText(state.crashReason || 'The sky wins this time.', FIELD.width / 2, 258);
      ctx.fillText(`Rings ${state.ringsCollected}/${state.ringsTotal}  ·  Distance flown ${Math.round((state.plane.distance - state.fromAirport.distance) / 100)} NM`, FIELD.width / 2, 290);
    }
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(`SCORE ${Math.round(state.score)}`, FIELD.width / 2, 350);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText(`Best ${Math.round(best)}   ·   Career points ${save.careerPoints}`, FIELD.width / 2, 386);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '16px system-ui, sans-serif';
    const next = state.__missions[(state.missionIndex + 1) % state.__missions.length];
    ctx.fillText(landed ? `Next: ${next.name} — ${AIRPORTS[next.from].code} → ${AIRPORTS[next.to].code}` : 'Tip: gear down [G] and slow below 230 kt before the runway.', FIELD.width / 2, 424);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('PRESS ENTER TO FLY AGAIN', FIELD.width / 2, 480);
    ctx.textAlign = 'left';
  }

  function draw(state, screen, best, save) {
    fitCanvas();
    drawSky(state);
    drawClouds(state);
    drawSeaAndTerrain(state);
    for (const airport of AIRPORTS) drawAirport(state, airport);
    drawRings(state);
    drawStorms(state);
    drawBirds(state);
    // Fog weather dims the world; rain streaks fall in monsoon and storm weather.
    if (state.mission.weather === 'fog') {
      ctx.fillStyle = 'rgba(200, 210, 220, 0.28)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (state.mission.weather === 'monsoon' || state.mission.weather === 'storm') {
      ctx.strokeStyle = 'rgba(180, 210, 235, 0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 40; i += 1) {
        const x = (hash(i + 200) * FIELD.width + state.elapsed * 300) % FIELD.width;
        const y = (hash(i + 300) * FIELD.height + state.elapsed * 500) % FIELD.height;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 8, y + 22);
        ctx.stroke();
      }
    }
    drawPlane(state, state.__aircraft());
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best, save);
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8, 14, 26, 0.6)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 48px system-ui, sans-serif';
      ctx.fillText('PAUSED', FIELD.width / 2, 350);
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText('Press P or Enter to keep flying', FIELD.width / 2, 392);
      ctx.textAlign = 'left';
    }
    if (screen === SCREEN_OVER || screen === SCREEN_MISSION || screen === SCREEN_FAILED) {
      drawEndCard(state, best, screen, save);
    }
  }

  return { draw };
}

// The low-fuel threshold is shared with the HUD's fuel bar colour.
const FUEL_LOW = 25;
