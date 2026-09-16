import test from 'node:test';
import assert from 'node:assert/strict';
import { startARSession } from '../src/ar-session.js';

function browser(t, getUserMedia) {
  const replacements = {
    window: { isSecureContext: true },
    navigator: { mediaDevices: { getUserMedia } },
    document: { createElement: () => ({ setAttribute() {}, remove() {} }) },
  };
  for (const [name, value] of Object.entries(replacements)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    });
  }
}
const options = signal => ({
  host: {}, view: { exitAR() {} }, onStatus() {}, onTracking() {}, onError() {}, signal,
});

test('an already-cancelled AR request never opens the camera', async t => {
  let requested = false;
  browser(t, () => { requested = true; });
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(startARSession(options(abort.signal)), { name: 'AbortError' });
  assert.equal(requested, false);
});

test('a camera permission grant arriving after cancellation releases its stream', async t => {
  let grant;
  let stopped = false;
  browser(t, () => new Promise(resolve => { grant = resolve; }));
  const abort = new AbortController();
  const starting = startARSession(options(abort.signal));
  abort.abort();
  grant({ getTracks: () => [{ stop() { stopped = true; } }] });
  await assert.rejects(starting, { name: 'AbortError' });
  assert.equal(stopped, true);
});

test('camera denial provides a recoverable message', async t => {
  browser(t, async () => { throw new DOMException('Denied', 'NotAllowedError'); });
  await assert.rejects(startARSession(options(new AbortController().signal)), /permission was denied/);
});
