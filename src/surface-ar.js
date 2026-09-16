import { Matrix4, Vector3, Quaternion, BufferGeometry, LineLoop, LineBasicMaterial } from 'three';

const BOARD_WIDTH = 18.4;
const UP = new Vector3(0, 1, 0);

/** Create a level board facing the player, independent of arbitrary hit-test yaw. */
export function surfaceBoardMatrix(position, viewer, size) {
  const yaw = Math.atan2(viewer.x - position.x, viewer.z - position.z);
  return new Matrix4().compose(position,
    new Quaternion().setFromAxisAngle(UP, yaw), new Vector3().setScalar(size / BOARD_WIDTH));
}

/** sessionPromise must be created directly in the user's click handler. */
export async function startSurfaceSession({ sessionPromise, view, overlay, signal, onStatus, onTracking, onPlacement, onFrame, onEnd }) {
  let session;
  let initialized = false;
  let ending = null;
  let placementViewer;
  let hitSource;
  let stopped = false;
  let placed = false;
  let tracked = false;
  let canPlace = false;
  let size = .24;
  let position = null;
  let viewer = null;
  let lastHit = null;
  let baseSpace;
  const { renderer, scene, camera } = view.getXRContext();
  const outline = new BufferGeometry().setFromPoints([
    new Vector3(-.5, .004, -.5), new Vector3(.5, .004, -.5),
    new Vector3(.5, .004, .5), new Vector3(-.5, .004, .5),
  ]);
  const material = new LineBasicMaterial({ color: 0x19eb83, depthTest: false });
  const guide = new LineLoop(outline, material);
  guide.matrixAutoUpdate = false;
  guide.visible = false;
  guide.frustumCulled = false;
  scene.add(guide);

  function reportTracking(value) {
    if (tracked !== value) { tracked = value; onTracking(value); }
  }
  function suppressSelection(event) { event.preventDefault(); }
  function cleanup() {
    if (stopped) return;
    stopped = true;
    hitSource?.cancel();
    renderer.setAnimationLoop(null);
    renderer.xr.enabled = false;
    scene.remove(guide);
    outline.dispose();
    material.dispose();
    overlay.removeEventListener('beforexrselect', suppressSelection);
    signal.removeEventListener('abort', end);
    view.exitAR();
    if (initialized) onEnd();
  }
  function end() {
    if (session) {
      ending ??= session.end().catch(() => {}).finally(cleanup);
      return ending;
    }
    cleanup();
  }
  const assertActive = () => { if (stopped || signal.aborted) throw new DOMException('AR setup cancelled', 'AbortError'); };
  signal.addEventListener('abort', end, { once: true });

  try {
    session = await sessionPromise;
    if (stopped || signal.aborted) { await session.end(); assertActive(); }
    view.enterAR();
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    await renderer.xr.setSession(session);
    assertActive();
    session.addEventListener('end', cleanup, { once: true });
    baseSpace = renderer.xr.getReferenceSpace();
    const viewerSpace = await session.requestReferenceSpace('viewer');
    assertActive();
    hitSource = await session.requestHitTestSource({ space: viewerSpace });
    assertActive();
    overlay.addEventListener('beforexrselect', suppressSelection);
    initialized = true;
    onStatus('Move slowly over a table or sheet of paper');

    renderer.setAnimationLoop((time, frame) => {
      if (stopped || !frame) return;
      const pose = frame.getViewerPose(baseSpace);
      if (!pose || session.visibilityState !== 'visible') {
        guide.visible = false;
        canPlace = false;
        onPlacement(false);
        view.trackAR(null, false);
        reportTracking(false);
      } else {
        viewer = new Vector3().copy(pose.transform.position);
        if (!placed) {
          lastHit = null;
          for (const result of frame.getHitTestResults(hitSource)) {
            const hit = result.getPose(baseSpace);
            // Only accept a reasonably horizontal surface, not a nearby wall.
            if (hit && hit.transform.matrix[5] > .9) { lastHit = hit; break; }
          }
          const ready = lastHit !== null;
          if (ready !== canPlace) { canPlace = ready; onPlacement(ready); }
          guide.visible = ready;
          if (lastHit) {
            const center = new Vector3().copy(lastHit.transform.position);
            guide.matrix.copy(surfaceBoardMatrix(center, viewer, size * BOARD_WIDTH));
            guide.matrixWorldNeedsUpdate = true;
          }
        } else {
          view.trackAR(surfaceBoardMatrix(position, placementViewer, size), true);
          reportTracking(true);
        }
      }
      onFrame(time);
      renderer.render(scene, camera);
    });
    return {
      stop: end,
      place() {
        if (!canPlace || !lastHit || !viewer || placed) return false;
        position = new Vector3().copy(lastHit.transform.position);
        placementViewer = viewer.clone();
        placed = true;
        guide.visible = false;
        view.trackAR(surfaceBoardMatrix(position, placementViewer, size), true);
        reportTracking(true);
        onStatus('Board placed · drag the joystick to steer');
        return true;
      },
      resize(delta) {
        size = Math.max(.15, Math.min(.45, Math.round((size + delta) * 100) / 100));
        return Math.round(size * 100);
      },
      reposition() {
        placed = false;
        canPlace = false;
        lastHit = null;
        view.trackAR(null, false);
        reportTracking(false);
        onPlacement(false);
        onStatus('Find a flat surface for the square guide');
      },
    };
  } catch (error) {
    if (session) await session.end().catch(() => {});
    cleanup();
    throw error;
  }
}
