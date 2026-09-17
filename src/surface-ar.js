import { Matrix4, Vector3, Quaternion, BufferGeometry, LineLoop, LineBasicMaterial } from 'three';

const BOARD_WIDTH = 18.4;
const BOARD_SCALE = new Vector3();

/** Create a level board facing the player, independent of arbitrary hit-test yaw. */
export function surfaceBoardMatrix(position, viewer, size, target = new Matrix4()) {
  const yaw = Math.atan2(viewer.x - position.x, viewer.z - position.z);
  return target.makeRotationY(yaw).scale(BOARD_SCALE.setScalar(size / BOARD_WIDTH)).setPosition(position);
}

/** sessionPromise must be created directly in the user's click handler. */
export async function startSurfaceSession({ sessionPromise, view, overlay, signal, onStatus, onTracking, onPlacement, onFrame, onEnd }) {
  let session;
  let initialized = false;
  let ending = null;
  const placementViewer = new Vector3();
  const viewer = new Vector3();
  const center = new Vector3();
  let boardMatrix;
  let viewerSpace;
  let hitRequest = 0;
  let hitSource;
  let stopped = false;
  let placed = false;
  let tracked = false;
  let canPlace = false;
  let size = .24;
  let position = null;
  let lastHit = null;
  let lastHitTime = -Infinity;
  let lastQueryTime = -Infinity;
  let placementKind = null;
  const forward = new Vector3();
  const orientation = new Quaternion();
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
  function reportPlacement(value, kind = null) {
    if (canPlace !== value || placementKind !== kind) {
      canPlace = value;
      placementKind = kind;
      onPlacement(value, kind);
    }
  }
  async function findSurface() {
    const request = ++hitRequest;
    const source = await session.requestHitTestSource({ space: viewerSpace });
    if (stopped || request !== hitRequest) { source.cancel(); return; }
    hitSource = source;
  }
  function suppressSelection(event) { event.preventDefault(); }
  function cleanup() {
    if (stopped) return;
    stopped = true;
    hitRequest++;
    hitSource?.cancel();
    hitSource = null;
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
    // 80% per axis requests 36% fewer scene pixels; DOM controls stay crisp.
    renderer.xr.setFramebufferScaleFactor(.8);
    await renderer.xr.setSession(session);
    assertActive();
    session.addEventListener('end', cleanup, { once: true });
    baseSpace = renderer.xr.getReferenceSpace();
    viewerSpace = await session.requestReferenceSpace('viewer');
    assertActive();
    // A slow or unavailable hit-test service must not block manual placement.
    findSurface().catch(() => {
      if (!stopped) onStatus('Surface detection unavailable · place the preview manually');
    });
    overlay.addEventListener('beforexrselect', suppressSelection);
    initialized = true;
    onStatus('Point at a table or floor · move slowly');

    renderer.setAnimationLoop((time, frame) => {
      if (stopped || !frame) return;
      const pose = frame.getViewerPose(baseSpace);
      if (!pose || session.visibilityState !== 'visible') {
        guide.visible = false;
        lastHit = null;
        reportPlacement(false);
        if (tracked) view.trackAR(null, false);
        reportTracking(false);
      } else {
        if (!placed) {
          viewer.copy(pose.transform.position);
          // Keep a recent result through short detection gaps, including the tap.
          if (time - lastQueryTime >= 50) {
            lastQueryTime = time;
            for (const result of hitSource ? frame.getHitTestResults(hitSource) : []) {
              const hit = result.getPose(baseSpace);
              if (hit && hit.transform.matrix[5] > .9) {
                lastHit = hit;
                lastHitTime = time;
                break;
              }
            }
          }
          const detected = lastHit && time - lastHitTime <= 1500;
          if (detected) {
            center.copy(lastHit.transform.position);
          } else {
            // Explicit manual fallback: a level preview in front of the camera.
            // This is an estimate, not a claim that a physical surface was found.
            orientation.copy(pose.transform.orientation);
            forward.set(0, 0, -1).applyQuaternion(orientation);
            center.copy(viewer).addScaledVector(forward, .65);
            center.y = Math.min(center.y, viewer.y - .2);
          }
          guide.visible = true;
          material.color.setHex(detected ? 0x19eb83 : 0xffc857);
          surfaceBoardMatrix(center, viewer, size * BOARD_WIDTH, guide.matrix);
          guide.matrixWorldNeedsUpdate = true;
          reportPlacement(true, detected ? 'surface' : 'manual');
        } else if (!tracked) {
          view.trackAR(boardMatrix, true);
          reportTracking(true);
        }
      }
      onFrame(time);
      renderer.render(scene, camera);
    });
    return {
      stop: end,
      place() {
        if (stopped || !canPlace || placed) return false;
        position = center.clone();
        placementViewer.copy(viewer);
        placed = true;
        guide.visible = false;
        boardMatrix = surfaceBoardMatrix(position, placementViewer, size);
        view.trackAR(boardMatrix, true);
        // Placement is fixed in local space. Stop surface queries until repositioning.
        hitRequest++;
        hitSource?.cancel();
        hitSource = null;
        reportTracking(true);
        onStatus('Board placed · drag the joystick to steer');
        return true;
      },
      resize(delta) {
        size = Math.max(.15, Math.min(.45, Math.round((size + delta) * 100) / 100));
        if (placed && !stopped) {
          boardMatrix = surfaceBoardMatrix(position, placementViewer, size);
          view.trackAR(boardMatrix, tracked);
        }
        return Math.round(size * 100);
      },
      reposition() {
        if (stopped || !placed) return;
        placed = false;
        reportPlacement(false);
        lastHit = null;
        lastHitTime = lastQueryTime = -Infinity;
        view.trackAR(null, false);
        reportTracking(false);
        onStatus('Find a flat surface for the square guide');
        findSurface().catch(() => {
          if (!stopped) onStatus('Surface detection unavailable · place the preview manually');
        });
      },
    };
  } catch (error) {
    if (session) await session.end().catch(() => {});
    cleanup();
    throw error;
  }
}
