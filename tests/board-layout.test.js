import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { BOARD_BOUNDS, fitBoardCamera } from '../src/board-layout.js';

test('all board corners fit the fixed perspective camera across viewport shapes', () => {
  for (const aspect of [.45, .75, 1, 1.5, 2.8]) {
    const camera = new PerspectiveCamera(38, 1, .1, 120);
    fitBoardCamera(camera, aspect);
    for (const x of [BOARD_BOUNDS.min[0], BOARD_BOUNDS.max[0]]) {
      for (const y of [BOARD_BOUNDS.min[1], BOARD_BOUNDS.max[1]]) {
        for (const z of [BOARD_BOUNDS.min[2], BOARD_BOUNDS.max[2]]) {
          const projected = new Vector3(x, y, z).project(camera);
          assert.ok(Math.abs(projected.x) < 1, `Horizontal clipping at aspect ${aspect}`);
          assert.ok(Math.abs(projected.y) < 1, `Vertical clipping at aspect ${aspect}`);
          assert.ok(projected.z > -1 && projected.z < 1, `Depth clipping at aspect ${aspect}`);
        }
      }
    }
  }
});

test('AR resets desktop clipping so a board within arm’s reach stays visible', async () => {
  const { configureARCamera } = await import('../src/board-layout.js');
  for (const aspect of [.45, .75, 1, 1.5, 2.8]) {
    const camera = new PerspectiveCamera(38, 1, .1, 120);
    fitBoardCamera(camera, aspect);
    configureARCamera(camera);
    for (const distance of [.15, .65, 2.5]) {
      const projected = new Vector3(0, 0, -distance).project(camera);
      assert.ok(projected.z > -1 && projected.z < 1, `AR board clipped at ${distance}m after aspect ${aspect}`);
    }
    fitBoardCamera(camera, aspect);
    const corner = new Vector3(...BOARD_BOUNDS.max).project(camera);
    assert.ok(corner.z > -1 && corner.z < 1, 'Desktop camera restored on exit');
  }
});
