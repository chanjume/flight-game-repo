// Keyboard and mouse input, read once per frame. Pitch and throttle are held keys; the rest are
// one-shot actions the game consumes. Arrow keys and WASD both fly; Space is boost, G drops the
// landing gear, P pauses, Enter or a click confirms on menus.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_GEAR = 4;
export const ACTION_NEXT_MISSION = 8;
export const ACTION_NEXT_PLANE = 16;
export const ACTION_MODE_CAREER = 32;
export const ACTION_MODE_FREE = 64;
export const ACTION_MODE_CHALLENGE = 128;

const PITCH_UP = ['ArrowUp', 'KeyW'];
const PITCH_DOWN = ['ArrowDown', 'KeyS'];
const THROTTLE_UP = ['ArrowRight', 'KeyD'];
const THROTTLE_DOWN = ['ArrowLeft', 'KeyA'];

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyG') actions |= ACTION_GEAR;
    if (event.code === 'KeyM') actions |= ACTION_NEXT_MISSION;
    if (event.code === 'KeyQ') actions |= ACTION_NEXT_PLANE;
    if (event.code === 'Digit1') actions |= ACTION_MODE_CAREER;
    if (event.code === 'Digit2') actions |= ACTION_MODE_FREE;
    if (event.code === 'Digit3') actions |= ACTION_MODE_CHALLENGE;
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onPointerDown() {
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);

  function hasAny(codes) {
    return codes.some((code) => held.has(code));
  }

  return {
    /** -1 to climb, +1 to descend, 0 to hold level. */
    pitch() {
      if (hasAny(PITCH_UP)) return -1;
      if (hasAny(PITCH_DOWN)) return 1;
      return 0;
    },
    /** -1 to pull the throttle back, +1 to push it forward, 0 to hold it. */
    throttle() {
      if (hasAny(THROTTLE_UP)) return 1;
      if (hasAny(THROTTLE_DOWN)) return -1;
      return 0;
    },
    boost() {
      return held.has('Space');
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
