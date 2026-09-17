/** One-finger steering in open camera space; no permanent directional buttons. */
export function bindARSwipe(target, { enabled, canStart, onDirection, signal }) {
  let pointer = null;
  function reset() { pointer = null; }
  target.addEventListener('pointerdown', event => {
    if (pointer || event.button !== 0 || !enabled() || !canStart(event)) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }, { signal });
  target.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer?.id) return;
    if (!enabled()) { reset(); return; }
    const x = event.clientX - pointer.x;
    const y = event.clientY - pointer.y;
    if (Math.hypot(x, y) < 24) return;
    event.preventDefault();
    const direction = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    onDirection(direction);
  }, { signal });
  for (const event of ['pointerup', 'pointercancel']) target.addEventListener(event, value => {
    if (value.pointerId === pointer?.id) reset();
  }, { signal });
  signal.addEventListener('abort', reset, { once: true });
  return { reset };
}
