import test from 'node:test';
import assert from 'node:assert/strict';
import { Raycaster, Vector3, PerspectiveCamera, Quaternion, Scene } from 'three';
import { createARControls } from '../src/ar-controls.js';

function fixture() {
  let draws = 0;
  const controls = createARControls(() => ({ getContext: () => ({ clearRect() {}, strokeText() {}, fillRect() {}, fillText() { draws++; } }) }));
  controls.group.visible = true;
  const camera = new PerspectiveCamera(65, .55, .01, 30);
  controls.layout({ transform: { position: new Vector3(), orientation: new Quaternion() }, views: [{ projectionMatrix: camera.projectionMatrix.elements }] });
  const pick = id => {
    const target = controls.group.getObjectByName(id).getWorldPosition(new Vector3());
    return controls.pick(new Raycaster(new Vector3(), target.normalize()));
  };
  return { controls, pick, get draws() { return draws; } };
}

test('placement has only a hint; gameplay has a compact score and pause control', () => {
  const f = fixture();
  const visible = () => f.controls.group.children.filter(panel => panel.visible).map(panel => panel.name).sort();
  f.controls.update({ ready: true });
  assert.deepEqual(visible(), ['hint']);
  assert.equal(f.pick('start'), null);
  f.controls.update({ ready: true, placed: true, status: 'playing', swipeUsed: true });
  assert.deepEqual(visible(), ['pause', 'score']);
  assert.equal(f.pick('pause'), 'pause');
  assert.equal(f.pick('restart'), null);
  f.controls.update({ ready: true, placed: true, status: 'paused' });
  assert.equal(f.pick('start'), 'start');
  assert.equal(f.pick('reposition'), 'reposition');
  assert.equal(f.pick('restart'), 'restart');
  f.controls.update({ ready: false, placed: true, status: 'paused' });
  assert.equal(f.pick('start'), null);
  f.controls.dispose();
});

test('spatial UI reuses score textures and respects size limits and visibility', () => {
  const f = fixture();
  const state = { ready: true, placed: true, status: 'paused', score: 30, size: 15 };
  f.controls.update(state);
  const draws = f.draws;
  f.controls.update(state);
  assert.equal(f.draws, draws);
  assert.equal(f.pick('smaller'), null);
  assert.equal(f.pick('larger'), 'larger');
  f.controls.update({ ...state, size: 45 });
  assert.equal(f.pick('larger'), null);
  f.controls.group.visible = false;
  assert.equal(f.pick('start'), null);
  f.controls.dispose();
});


test('floating HUD follows the viewer independently and remains inside portrait and landscape views', () => {
  const f = fixture();
  const world = new Scene();
  world.add(f.controls.group);
  f.controls.update({ ready: true, placed: true, status: 'playing' });
  for (const aspect of [.45, .75, 1.8]) {
    const camera = new PerspectiveCamera(65, aspect, .01, 30);
    camera.position.set(2, 1.6, -3);
    camera.rotation.set(-.3, .7, 0);
    camera.updateMatrixWorld();
    f.controls.layout({ transform: { position: camera.position, orientation: camera.quaternion }, views: [{ projectionMatrix: camera.projectionMatrix.elements }] });
    for (const panel of f.controls.group.children.filter(panel => panel.visible)) {
      for (const x of [-.5, .5]) for (const y of [-.5, .5]) {
        const projected = panel.localToWorld(new Vector3(x, y, 0)).project(camera);
        assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1, `${panel.name} clipped at ${aspect}`);
      }
    }
    const pause = f.controls.group.getObjectByName('pause').getWorldPosition(new Vector3());
    const ray = new Raycaster(camera.position, pause.sub(camera.position).normalize());
    assert.equal(f.controls.pick(ray), 'pause');
    assert.equal(f.controls.group.parent, world);
  }
  f.controls.dispose();
});
