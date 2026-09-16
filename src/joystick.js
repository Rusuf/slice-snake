const DEAD_ZONE = 6;
const CHANGE_BIAS = 1.3;

/** Snap a thumb vector to a cardinal direction; retain direction around diagonals. */
export function joystickDirection(x, y, previous = null) {
  if (Math.hypot(x, y) < DEAD_ZONE) return null;
  const horizontal = Math.abs(x);
  const vertical = Math.abs(y);
  if (previous && Math.max(horizontal, vertical) < Math.min(horizontal, vertical) * CHANGE_BIAS) {
    if ((previous === 'left' && x < 0) || (previous === 'right' && x > 0) ||
        (previous === 'up' && y < 0) || (previous === 'down' && y > 0)) return previous;
  }
  return horizontal > vertical ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
}

export function bindJoystick(element, onDirection, signal) {
  let enabled = false;
  let pointer = null;
  let previous = null;
  let bounds;
  let originX = 0;
  let originY = 0;
  const on = (event, handler) => element.addEventListener(event, handler, { signal });

  function reset() {
    if (pointer !== null && element.hasPointerCapture(pointer)) element.releasePointerCapture(pointer);
    pointer = null;
    previous = null;
    element.style.setProperty('--stick-x', '0px');
    element.style.setProperty('--stick-y', '0px');
    element.removeAttribute('data-direction');
    element.removeAttribute('data-dragging');
  }
  function move(event) {
    const x = event.clientX - originX;
    const y = event.clientY - originY;
    const distance = Math.hypot(x, y);
    const radius = Math.max(0, bounds.width / 2 - 30);
    const scale = distance > radius ? radius / distance : 1;
    element.style.setProperty('--stick-x', `${x * scale}px`);
    element.style.setProperty('--stick-y', `${y * scale}px`);
    const direction = joystickDirection(x, y, previous);
    if (direction && direction !== previous) {
      onDirection(direction);
      element.dataset.direction = direction;
    }
    previous = direction;
  }
  on('pointerdown', event => {
    if (!enabled || event.button !== 0 || pointer !== null) return;
    event.preventDefault();
    bounds = element.getBoundingClientRect();
    originX = bounds.left + bounds.width / 2;
    originY = bounds.top + bounds.height / 2;
    // Grabbing the thumb must not jump toward an off-centre contact point.
    if (Math.hypot(event.clientX - originX, event.clientY - originY) <= 28) {
      originX = event.clientX;
      originY = event.clientY;
    }
    element.dataset.dragging = 'true';
    pointer = event.pointerId;
    element.setPointerCapture(pointer);
    element.focus({ preventScroll: true });
    move(event);
  });
  on('pointermove', event => { if (event.pointerId === pointer) move(event); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    on(type, event => { if (event.pointerId === pointer) reset(); });
  }
  signal.addEventListener('abort', reset, { once: true });
  return {
    getDirection() { return pointer === null ? null : previous; },
    setEnabled(value) {
      enabled = value;
      element.setAttribute('aria-disabled', String(!value));
      if (!value) reset();
    },
  };
}
