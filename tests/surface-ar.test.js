import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector3, Matrix4 } from 'three';
import { surfaceBoardMatrix, startSurfaceSession } from '../src/surface-ar.js';

test('surface board has physical width and faces the viewer from either side', () => {
  const center = new Vector3(1, .8, -2);
  for (const viewer of [new Vector3(1, 1.5, 0), new Vector3(3, 1.5, -2)]) {
    const matrix = surfaceBoardMatrix(center, viewer, .24);
    const left = new Vector3(-9.2, 0, 0).applyMatrix4(matrix);
    const right = new Vector3(9.2, 0, 0).applyMatrix4(matrix);
    assert.ok(Math.abs(left.distanceTo(right) - .24) < 1e-10);
    assert.ok(new Vector3().applyMatrix4(matrix).distanceTo(center) < 1e-10);
    const facing = new Vector3(0, 0, 1).transformDirection(matrix);
    const towardViewer = viewer.clone().sub(center).setY(0).normalize();
    assert.ok(facing.dot(towardViewer) > .999);
  }
});

function fixture() {
  const abort = new AbortController();
  const session = new EventTarget();
  let ended = 0, cancelled = 0, loop, tracking, ready;
  const counts = { hits: 0, requests: 0, transforms: 0, placement: 0, renders: 0 };
  session.end = async () => { ended++; session.dispatchEvent(new Event('end')); };
  session.visibilityState = 'visible';
  session.requestReferenceSpace = async () => ({});
  session.requestHitTestSource = async () => { counts.requests++; return { cancel() { cancelled++; } }; };
  const scene = new Scene();
  const renderer = { xr: { enabled: false, setReferenceSpaceType() {}, setFramebufferScaleFactor(value) { counts.scale = value; }, async setSession() { assert.equal(counts.scale, .8); }, getReferenceSpace() { return {}; } },
    setAnimationLoop(value) { loop = value; }, render() { counts.renders++; } };
  const options = {
    sessionPromise: Promise.resolve(session), signal: abort.signal, overlay: new EventTarget(),
    view: { getXRContext: () => ({ scene, renderer, camera: {} }), enterAR() {}, exitAR() {}, trackAR(matrix, visible) { tracking = visible; counts.transforms++; } },
    onStatus() {}, onTracking() {}, onPlacement(value) { ready = value; counts.placement++; }, onFrame() {}, onEnd() {},
  };
  return { options, session, abort, scene, renderer, counts, get ended() { return ended; }, get cancelled() { return cancelled; },
    get tracking() { return tracking; }, get ready() { return ready; },
    frame(hit = true, visible = true) { loop(1, { getViewerPose: () => visible ? ({ transform: { position: new Vector3(0, 1, 1) } }) : null,
      getHitTestResults: () => { counts.hits++; return hit ? [{ getPose: () => ({ transform: { position: new Vector3(), matrix: new Matrix4().elements } }) }] : []; } }); },
  };
}

test('surface placement requires a hit, supports resize and reposition, and cleans up', async () => {
  const f = fixture();
  const ar = await startSurfaceSession(f.options);
  assert.equal(ar.place(), false);
  f.frame();
  assert.equal(f.ready, true);
  assert.equal(ar.place(), true);
  assert.equal(f.tracking, true);
  assert.equal(ar.resize(10), 45);
  assert.equal(ar.resize(-10), 15);
  ar.reposition();
  assert.equal(f.tracking, false);
  assert.equal(ar.place(), false);
  await ar.stop();
  assert.equal(f.ended, 1);
  assert.equal(f.cancelled, 2);
  assert.equal(f.scene.children.length, 0);
  assert.equal(f.renderer.xr.enabled, false);
});

test('permission granted after cancellation closes the late XR session', async () => {
  const f = fixture();
  let grant;
  f.options.sessionPromise = new Promise(resolve => { grant = resolve; });
  const starting = startSurfaceSession(f.options);
  f.abort.abort();
  grant(f.session);
  await assert.rejects(starting, { name: 'AbortError' });
  assert.equal(f.scene.children.length, 0);
  assert.ok(f.ended >= 1);
  assert.equal(f.renderer.xr.enabled, false);
});


test('placed gameplay cancels hit testing, reuses its transform and renders once per XR frame', async () => {
  const f = fixture();
  const ar = await startSurfaceSession(f.options);
  f.frame();
  assert.equal(ar.place(), true);
  assert.equal(f.cancelled, 1);
  const before = { ...f.counts };
  for (let i = 0; i < 120; i++) f.frame();
  assert.equal(f.counts.hits, before.hits);
  assert.equal(f.counts.transforms, before.transforms);
  assert.equal(f.counts.placement, before.placement);
  assert.equal(f.counts.renders - before.renders, 120);
  await ar.stop();
});

test('lost tracking is reported once and cannot place using a stale hit', async () => {
  const f = fixture(); const ar = await startSurfaceSession(f.options);
  f.frame();
  for (let i = 0; i < 60; i++) f.frame(false, false);
  assert.equal(ar.place(), false);
  assert.equal(f.counts.placement, 2);
  f.frame(); ar.place();
  f.frame(false, false);
  const transforms = f.counts.transforms;
  for (let i = 0; i < 60; i++) f.frame(false, false);
  assert.equal(f.counts.transforms, transforms);
  f.frame();
  assert.equal(f.tracking, true);
  await ar.stop();
});

test('reposition reacquires hit testing and cancels a source returned after exit', async () => {
  const f = fixture(); const ar = await startSurfaceSession(f.options);
  f.frame(); ar.place();
  let resolve;
  let lateCancelled = 0;
  f.session.requestHitTestSource = () => new Promise(r => { resolve = r; });
  ar.reposition();
  f.frame(); assert.equal(ar.place(), false);
  await ar.stop();
  resolve({ cancel() { lateCancelled++; } });
  await new Promise(r => setImmediate(r));
  assert.equal(lateCancelled, 1);
});

test('reposition gets a fresh surface before placing again', async () => {
  const f = fixture(); const ar = await startSurfaceSession(f.options);
  f.frame(); ar.place(); ar.reposition();
  await new Promise(r => setImmediate(r));
  f.frame(); assert.equal(ar.place(), true);
  assert.equal(f.counts.requests, 2);
  assert.equal(f.cancelled, 2);
  await ar.stop();
});
