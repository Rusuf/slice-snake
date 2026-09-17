import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { startEighthWallSession } from '../src/eighth-wall-session.js';
import { createTargetPose } from '../src/eighth-wall-pose.js';

const detail = { name: 'slice-snake-square', position: { x: 1, y: 2, z: -3 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 2, scaledWidth: .75, scaledHeight: 1 };
const target = { name: detail.name, type: 'PLANAR', resources: { luminanceImage: 'slice-snake-square_luminance.png' } };
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(t, run = module => module.onStart()) {
  const calls = { stopped: 0, removed: [], entered: 0, exited: 0, tracking: [], status: [], errors: [], frames: 0, draws: 0, streams: 0, disconnected: 0 };
  const canvas = { width: 0, height: 0, setAttribute() {}, remove() { calls.canvasRemoved = true; } };
  const globals = {
    window: { isSecureContext: true, devicePixelRatio: 1 },
    navigator: { mediaDevices: { getUserMedia() {} } },
    document: { createElement: () => canvas },
    ResizeObserver: class { observe() {} disconnect() { calls.disconnected++; } },
  };
  for (const [name, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => { if (original) Object.defineProperty(globalThis, name, original); else delete globalThis[name]; });
  }
  const abort = new AbortController();
  t.after(() => abort.abort());
  let pipeline;
  const runtime = {
    XrController: {
      configure(options) { calls.config = options; },
      pipelineModule() { assert.equal(calls.config.disableWorldTracking, true); return { name: 'reality' }; },
      updateCameraProjectionMatrix(options) { calls.origin = options.origin.clone(); },
    },
    GlTextureRenderer: { pipelineModule: () => ({ name: 'camera' }) },
    XrConfig: { device: () => ({ MOBILE: 'mobile' }), camera: () => ({ BACK: 'back' }) },
    addCameraPipelineModules(modules) { pipeline = modules.at(-1); },
    removeCameraPipelineModule(name) { calls.removed.push(name); },
    run(options) { calls.run = options; run(pipeline); },
    stop() { calls.stopped++; },
  };
  const camera = new PerspectiveCamera();
  const options = {
    host: { prepend() {}, getBoundingClientRect: () => ({ width: 320, height: 400 }) },
    view: { getXRContext: () => ({ camera }), enterAR(opts) { calls.entered++; assert.equal(opts.externalFrames, true); },
      exitAR() { calls.exited++; }, trackAR(matrix, visible) { calls.visible = visible; if (matrix) calls.matrix = matrix.clone(); },
      setARProjection(projection) { calls.projection = projection; }, renderAR() { calls.draws++; } },
    signal: abort.signal, onStatus: value => calls.status.push(value), onTracking: value => calls.tracking.push(value),
    onError: error => calls.errors.push(error), onFrame: () => calls.frames++,
    loadRuntime: async () => runtime, fetchTarget: async () => ({ ok: true, json: async () => structuredClone(target) }),
  };
  const track = new EventTarget();
  track.stop = () => calls.streams++;
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  return { options, abort, calls, runtime, camera, stream, track, pipeline: () => pipeline,
    emit(event, value = detail) { pipeline.listeners.find(item => item.event === `reality.${event}`).process({ detail: value }); } };
}

test('square pose uses full height, points board top toward image top and raises pieces out of paper', () => {
  const pose = createTargetPose()(detail);
  const center = new Vector3().applyMatrix4(pose);
  assert.deepEqual(center.toArray(), [1, 2, -3]);
  const top = new Vector3(0, 0, -9.2).applyMatrix4(pose).sub(center);
  assert.ok(Math.abs(top.y - .92) < 1e-10);
  const up = new Vector3(0, 1, 0).applyMatrix4(pose).sub(center);
  assert.ok(up.z > 0);
  assert.equal(createTargetPose()({ ...detail, scale: NaN }), null);
});

test('already-aborted request does not load a runtime or open the camera', async t => {
  const s = setup(t); s.abort.abort();
  let loaded = false;
  await assert.rejects(startEighthWallSession({ ...s.options, loadRuntime() { loaded = true; } }), { name: 'AbortError' });
  assert.equal(loaded, false);
});

test('cancelled runtime loading cannot start a late camera', async t => {
  const s = setup(t); let resolve;
  const start = startEighthWallSession({ ...s.options, loadRuntime: () => new Promise(r => { resolve = r; }) });
  s.abort.abort();
  resolve(s.runtime);
  await assert.rejects(start, { name: 'AbortError' });
  assert.equal(s.calls.run, undefined);
  assert.equal(s.calls.entered, 0);
});

test('cancel during permission request cleans up, rejects startup and stops a late delivered stream', async t => {
  const s = setup(t, () => {});
  const start = startEighthWallSession(s.options);
  await flush();
  const pipeline = s.pipeline();
  s.abort.abort();
  await assert.rejects(start, { name: 'AbortError' });
  pipeline.onCameraStatusChange({ status: 'hasStream', stream: s.stream });
  pipeline.onStart();
  assert.equal(s.calls.streams, 1);
  assert.equal(s.calls.stopped, 1);
  assert.equal(s.calls.exited, 1);
  assert.equal(s.calls.removed.length, 3);
  assert.equal(s.calls.canvasRemoved, true);
});

test('tracking loss hides the board and emits pause once; reacquisition reports ready without driving game itself', async t => {
  const s = setup(t); const session = await startEighthWallSession(s.options);
  s.emit('imagefound'); s.emit('imageupdated');
  s.emit('imagelost'); s.emit('imagelost');
  assert.equal(s.calls.visible, false);
  s.emit('imagefound');
  assert.deepEqual(s.calls.tracking, [true, false, true]);
  assert.equal(s.calls.frames, 0);
  session.stop(); session.stop();
  assert.equal(s.calls.stopped, 1);
});

test('ignores unrelated targets, updates world camera and renders from XR8 callbacks only', async t => {
  const s = setup(t); await startEighthWallSession(s.options);
  s.emit('imagefound', { ...detail, name: 'another-card' });
  assert.deepEqual(s.calls.tracking, []);
  const intrinsics = new PerspectiveCamera().projectionMatrix.elements;
  s.pipeline().onUpdate({ processCpuResult: { reality: { intrinsics, position: detail.position, rotation: detail.rotation } } });
  s.pipeline().onRender();
  assert.deepEqual(s.camera.position.toArray(), [1, 2, -3]);
  assert.equal(s.calls.frames, 1);
  assert.equal(s.calls.draws, 1);
  assert.equal(s.calls.run.ownRunLoop, true);
  assert.match(s.calls.config.imageTargetData[0].imagePath, /image-targets\/slice-snake-square_luminance.png$/);
});

test('camera denial rejects startup with recovery instructions and restores 3D', async t => {
  const s = setup(t, module => module.onException(new DOMException('Denied', 'NotAllowedError')));
  await assert.rejects(startEighthWallSession(s.options), /permission was denied/);
  assert.equal(s.calls.exited, 1);
  assert.equal(s.calls.stopped, 1);
});

test('ended camera reports a recoverable error and stops the active session', async t => {
  const s = setup(t); await startEighthWallSession(s.options);
  s.pipeline().onCameraStatusChange({ status: 'hasStream', stream: s.stream });
  s.track.dispatchEvent(new Event('ended'));
  assert.match(s.calls.errors[0].message, /camera connection ended/);
  assert.equal(s.calls.stopped, 1);
  assert.equal(s.calls.streams, 1);
});

test('missing target fails before camera setup and allows a subsequent session', async t => {
  const s = setup(t);
  await assert.rejects(startEighthWallSession({ ...s.options, fetchTarget: async () => ({ ok: false }) }), /target could not load/);
  assert.equal(s.calls.run, undefined);
  const session = await startEighthWallSession(s.options);
  session.stop();
  assert.equal(s.calls.stopped, 1);
});

test('one session at a time owns XR8, and stopping permits re-entry', async t => {
  const s = setup(t); const first = await startEighthWallSession(s.options);
  await assert.rejects(startEighthWallSession(s.options), /previous AR session/);
  first.stop();
  const second = await startEighthWallSession(s.options);
  second.stop();
  assert.equal(s.calls.stopped, 2);
});


test('XR8 starts with a nonzero responsive scale despite the ordinary AR camera origin', async t => {
  const s = setup(t);
  s.camera.position.set(0, 0, 0);
  await startEighthWallSession(s.options);
  assert.deepEqual(s.calls.origin.toArray(), [0, 1, 0]);
});

test('stationary target stays tracked across frames without imageupdated events', async t => {
  const s = setup(t);
  let now = 100;
  t.mock.method(performance, 'now', () => now);
  await startEighthWallSession(s.options);
  s.emit('imagefound');
  const reality = { intrinsics: s.camera.projectionMatrix.elements, position: detail.position, rotation: detail.rotation, detectedImages: [detail] };
  for (now = 1100; now <= 5100; now += 1000) {
    s.pipeline().onUpdate({ processCpuResult: { reality } });
    assert.equal(s.calls.visible, true);
  }
  assert.deepEqual(s.calls.tracking, [true]);
  s.pipeline().onUpdate({ processCpuResult: { reality: { ...reality, detectedImages: [] } } });
  assert.equal(s.calls.visible, false);
  assert.deepEqual(s.calls.tracking, [true, false]);
});
