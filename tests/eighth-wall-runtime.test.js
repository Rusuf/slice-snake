import test from 'node:test';
import assert from 'node:assert/strict';

function browser(t) {
  const window = new EventTarget();
  const scripts = [];
  const document = { head: { appendChild: script => scripts.push(script) }, createElement() {
    const script = new EventTarget();
    script.setAttribute = (name, value) => { script[name] = value; };
    return script;
  } };
  for (const [name, value] of Object.entries({ window, document })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => { if (previous) Object.defineProperty(globalThis, name, previous); else delete globalThis[name]; });
  }
  return { window, scripts };
}

test('runtime is lazy, shared, and preloads the pinned image-tracking chunk', async t => {
  const { window, scripts } = browser(t);
  const { loadEighthWallRuntime } = await import('../src/eighth-wall-runtime.js?success');
  assert.equal(scripts.length, 0);
  const first = loadEighthWallRuntime();
  const second = loadEighthWallRuntime();
  assert.equal(first, second);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0]['data-preload-chunks'], 'slam');
  assert.match(scripts[0].src, /vendor\/8thwall\/xr.js$/);
  window.XR8 = { XrController: {} };
  window.dispatchEvent(new Event('xrloaded'));
  assert.equal(await first, window.XR8);
});

test('script failure is recoverable through reload and never injects competing runtimes', async t => {
  const { scripts } = browser(t);
  const { loadEighthWallRuntime } = await import('../src/eighth-wall-runtime.js?failure');
  const loading = loadEighthWallRuntime();
  scripts[0].dispatchEvent(new Event('error'));
  await assert.rejects(loading, /Reload to retry/);
  assert.equal(loadEighthWallRuntime(), loading);
  assert.equal(scripts.length, 1);
});

test('cancelling one waiter does not cancel the shared engine for the next session', async () => {
  const { abortable } = await import('../src/eighth-wall-runtime.js');
  let resolve;
  const engine = new Promise(r => { resolve = r; });
  const abort = new AbortController();
  const waiting = abortable(engine, abort.signal);
  abort.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
  resolve('runtime');
  assert.equal(await abortable(engine, new AbortController().signal), 'runtime');
});
