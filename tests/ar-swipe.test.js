import test from 'node:test';
import assert from 'node:assert/strict';
import { bindARSwipe } from '../src/ar-swipe.js';

function fixture() {
  const target = new EventTarget();
  const signal = new AbortController();
  const directions = [];
  let enabled = true;
  let canStart = true;
  const swipe = bindARSwipe(target, { enabled: () => enabled, canStart: () => canStart, onDirection: value => directions.push(value), signal: signal.signal });
  return { directions, swipe, signal,
    enable(value) { enabled = value; }, allow(value) { canStart = value; },
    event(type, x = 0, y = 0, id = 1) {
      const event = new Event(type, { cancelable: true });
      Object.assign(event, { clientX: x, clientY: y, pointerId: id, button: 0 });
      target.dispatchEvent(event);
    },
  };
}

test('swipes ignore small movement and allow successive turns without visible controls', () => {
  const f = fixture();
  f.event('pointerdown');
  f.event('pointermove', 12, 0);
  assert.deepEqual(f.directions, []);
  f.event('pointermove', 30, 0);
  f.event('pointermove', 30, -30);
  f.event('pointerup');
  f.event('pointermove', 60, -30);
  assert.deepEqual(f.directions, ['right', 'up']);
});

test('pause, control taps, cancellation and a second finger cannot produce unwanted turns', () => {
  const f = fixture();
  f.allow(false);
  f.event('pointerdown'); f.event('pointermove', 60);
  assert.deepEqual(f.directions, []);
  f.allow(true);
  f.event('pointerdown'); f.event('pointermove', 60, 0, 2);
  assert.deepEqual(f.directions, []);
  f.enable(false); f.event('pointermove', 60);
  f.enable(true); f.event('pointermove', 90);
  assert.deepEqual(f.directions, []);
  f.event('pointerdown'); f.event('pointercancel'); f.event('pointermove', 60);
  assert.deepEqual(f.directions, []);
  f.event('pointerdown'); f.swipe.reset(); f.event('pointermove', 60);
  assert.deepEqual(f.directions, []);
  f.signal.abort(); f.event('pointerdown'); f.event('pointermove', 60);
  assert.deepEqual(f.directions, []);
});
