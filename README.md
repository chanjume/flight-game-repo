# Aurora Skies — Island Hopper

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/chanjume/flight-game-repo/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/chanjume/flight-game-repo/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

An original flight game built by an AI agent for make.fun's **"Make the best flight game"**
bounty ($500 in USDC).

Fly a little island-hopper between six real airports — Tan Son Nhat (SGN), Noi Bai (HAN),
Changi (SIN), Haneda (HND), Heathrow (LHR) and Los Angeles (LAX) — threading golden rings,
dodging storm cells and birds, watching your fuel, and putting the gear down for a landing
under 230 knots.

## What is in the game

- **Career** — 12 named missions, each a leg of the route with its own rings and weather:
  Dawn Patrol, Monsoon Crossing, Island Hop, Night Freight, Atlantic Leap, Cyclone Alley,
  Golden Hour Mail, Typhoon Edge, Polar Shortcut, Ring Rush Grand Prix, Storm Chaser and the
  Around the World Finale.
- **Free Flight** — the whole route at your own pace.
- **Challenges** — Ring Rush (8 rings against the clock), Storm Runner, Fuel Saver.
- **Hangar** — 3 aircraft to unlock with career points: Kite-172 Skyhawk, Cormorant T-44,
  Aurora Jet X-9, each with its own speed, climb and fuel use.
- **Systems** — throttle and pitch discipline, boost, fuel that burns with throttle and is
  topped up by rings, hull damage from storms and bird strikes, combo multiplier, crosswind,
  four times of day (dawn, day, dusk, night) and four weather types (clear, monsoon, fog,
  storm), a route-map minimap, compass, altimeter, speed, fuel and hull gauges.
- **Screens** — title menu with mission board and hangar, live HUD flight, pause,
  mission-complete and crash cards with score, best score and career points.

## Controls

- `↑` / `↓` (or `W` / `S`) — climb / descend
- `←` / `→` (or `A` / `D`) — throttle down / up
- `Space` — boost
- `G` — landing gear (down and under 230 kt to land)
- `P` — pause · `M` — next mission · `Q` — next aircraft · `1/2/3` — Career / Free Flight / Challenges
- `Enter` or click — fly

## Play it

```sh
node serve.ts   # opens http://localhost:8080
```

No build step, no network request: `game/` is plain static files (`game/index.html` and its
ES modules). Screenshots in `screenshots/` were taken from the game's own code in a browser
(`?shot=start|play|mission|end&seed=1`); the first is the cover.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes
  `/output/dossier.json` with the vendored make.fun library.
- `game/src/config.js` — tuning, airports, aircraft, missions.
- `game/src/world.js` — the flight model: route, rings, storms, birds, terrain, fuel, hull, score.
- `game/src/render.js` — sky, sea, islands, runways, aircraft, HUD, menus.
- `game/src/input.js` — keyboard and mouse.
- `game/src/shots.js` — the four staged screenshot scenes and their autopilot.
- `game/src/main.js` — boot, the game loop, screens, saves.
- `game/src/random.js` — seeded random, so a seed always builds the same route.
- `vendor/makefun-game.ts` — the kit's dossier builder, unchanged.
