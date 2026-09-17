import { Matrix4, Vector3, Quaternion, Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';

const BOARD_WIDTH = 18.4;
const BOARD_SCALE = new Vector3();

/** Create a level board facing the player, independent of arbitrary hit-test yaw. */
export function surfaceBoardMatrix(position, viewer, size, target = new Matrix4()) {
  const yaw = Math.atan2(viewer.x - position.x, viewer.z - position.z);
  return target.makeRotationY(yaw).scale(BOARD_SCALE.setScalar(size / BOARD_WIDTH)).setPosition(position);
}

/** sessionPromise must be created directly in the user's click handler. */
export async function startSurfaceSession({ sessionPromise, view, overlay, signal, onStatus, onTracking, onPlacement, onFrame, onEnd, onError = () => {} }) {
  let session;
  let initialized = false;
  let ending = null;
  const placementViewer = new Vector3();
  const viewer = new Vector3();
  const center = new Vector3();
  const targetCenter = new Vector3();
  const liftedCenter = new Vector3();
  const boardMatrix = new Matrix4();
  let viewerSpace;
  let hitRequest = 0;
  let hitSource;
  let stopped = false;
  let placed = false;
  let tracked = false;
  let canPlace = false;
  let previewVisible = false;
  let size = .24;
  let position = null;
  let lastHit = null;
  let lastHitTime = -Infinity;
  let lastQueryTime = -Infinity;
  let lastFrameTime = null;
  let lostSince = null;
  let placementKind = null;
  const forward = new Vector3();
  const orientation = new Quaternion();
  let baseSpace;
  const { renderer, scene, camera } = view.getXRContext();
  // A thick, raised frame remains legible against both dark and light surfaces.
  const outline = new BoxGeometry(1.04, .012, .014);
  const material = new MeshBasicMaterial({ color: 0x19eb83, depthTest: false });
  const guide = new Group();
  for (const side of [-1, 1]) {
    const horizontal = new Mesh(outline, material);
    horizontal.position.set(0, .006, side * .52);
    const vertical = new Mesh(outline, material);
    vertical.position.set(side * .52, .006, 0);
    vertical.rotation.y = Math.PI / 2;
    guide.add(horizontal, vertical);
  }
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
  function transformBoard(at, facing) {
    // The feet, rather than the middle of the box, rest on the target surface.
    liftedCenter.copy(at).y += 1.44 * size / BOARD_WIDTH;
    surfaceBoardMatrix(liftedCenter, facing, size, boardMatrix);
    view.trackAR(boardMatrix, true);
    previewVisible = true;
  }
  function cancelSurface() {
    hitRequest++;
    const source = hitSource;
    hitSource = null;
    try { source?.cancel(); } catch { /* An ended XR session may already have cancelled it. */ }
  }
  async function findSurface() {
    const request = ++hitRequest;
    const source = await session.requestHitTestSource({ space: viewerSpace });
    if (stopped || request !== hitRequest) {
      try { source.cancel(); } catch { /* Session already ended. */ }
      return;
    }
    hitSource = source;
  }
  function suppressSelection(event) { event.preventDefault(); }
  function cleanup() {
    if (stopped) return;
    stopped = true;
    cancelSurface();
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
    view.enterAR({ externalFrames: true, solidBoard: true });
    view.setARPreview(true);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    renderer.xr.setFramebufferScaleFactor(.8);
    await renderer.xr.setSession(session);
    assertActive();
    session.addEventListener('end', cleanup, { once: true });
    baseSpace = renderer.xr.getReferenceSpace();
    viewerSpace = await session.requestReferenceSpace('viewer');
    assertActive();
    findSurface().catch(() => {
      if (!stopped && !placed) onStatus('Surface detection unavailable · place the preview manually');
    });
    overlay.addEventListener('beforexrselect', suppressSelection);
    initialized = true;
    onStatus('Aim the board · tap it or Place & Play');

    renderer.setAnimationLoop((time, frame) => {
      if (stopped || !frame) return;
      try {
        const delta = lastFrameTime === null ? 16 : Math.max(0, Math.min(time - lastFrameTime, 100));
        lastFrameTime = time;
        const pose = frame.getViewerPose(baseSpace);
        if (!pose || session.visibilityState !== 'visible') {
          lostSince ??= time;
          guide.visible = false;
          lastHit = null;
          reportPlacement(false);
          // Pause immediately, but don't flash the board off for one missing pose.
          if (previewVisible && (!placed || time - lostSince > 500 || session.visibilityState !== 'visible')) {
            view.trackAR(null, false);
            previewVisible = false;
          }
          reportTracking(false);
        } else {
          lostSince = null;
          view.layoutARControls(pose);
          if (!placed) {
            viewer.copy(pose.transform.position);
            if (time - lastQueryTime >= 50) {
              lastQueryTime = time;
              try {
                for (const result of hitSource ? frame.getHitTestResults(hitSource) : []) {
                  const hit = result.getPose(baseSpace);
                  if (!hit || hit.transform.matrix[5] <= .9) continue;
                  targetCenter.copy(hit.transform.position);
                  const distance = targetCenter.distanceTo(viewer);
                  if (distance < .15 || distance > 2.5 || targetCenter.y > viewer.y - .05) continue;
                  lastHit = hit;
                  lastHitTime = time;
                  break;
                }
              } catch {
                cancelSurface();
                onStatus('Surface detection interrupted · manual placement is still available');
              }
            }
            const detected = lastHit && time - lastHitTime <= 1500;
            if (detected) targetCenter.copy(lastHit.transform.position);
            else {
              orientation.copy(pose.transform.orientation);
              forward.set(0, 0, -1).applyQuaternion(orientation);
              targetCenter.copy(viewer).addScaledVector(forward, .65);
              targetCenter.y = Math.min(targetCenter.y, viewer.y - .2);
            }
            const kind = detected ? 'surface' : 'manual';
            if (!previewVisible || placementKind !== kind) center.copy(targetCenter);
            else center.lerp(targetCenter, 1 - Math.exp(-delta / 65));
            guide.visible = true;
            material.color.setHex(detected ? 0x19eb83 : 0xffc857);
            surfaceBoardMatrix(center, viewer, size * BOARD_WIDTH, guide.matrix);
            guide.matrixWorldNeedsUpdate = true;
            transformBoard(center, viewer);
            reportPlacement(true, kind);
          } else if (!tracked) {
            view.trackAR(boardMatrix, true);
            previewVisible = true;
            reportTracking(true);
          }
        }
        onFrame(time);
        renderer.render(scene, camera);
      } catch (error) {
        // A frame failure must produce a recoverable UI, never a silent blank camera.
        end();
        onError(error);
      }
    });
    return {
      stop: end,
      place() {
        if (stopped || !canPlace || placed) return false;
        position = center.clone();
        placementViewer.copy(viewer);
        placed = true;
        guide.visible = false;
        view.setARPreview(false);
        // Keep exactly the already-rendered preview transform on the placement tap.
        cancelSurface();
        reportTracking(true);
        onStatus('Board placed · use the 3D arrows to steer');
        return true;
      },
      resize(delta) {
        size = Math.max(.15, Math.min(.45, Math.round((size + delta) * 100) / 100));
        if (placed && !stopped && tracked) transformBoard(position, placementViewer);
        return Math.round(size * 100);
      },
      reposition() {
        if (stopped || !placed) return;
        placed = false;
        view.setARPreview(true);
        reportPlacement(false);
        lastHit = null;
        lastHitTime = lastQueryTime = -Infinity;
        previewVisible = false;
        reportTracking(false);
        onStatus('Aim the board · tap it or Place & Play');
        findSurface().catch(() => {
          if (!stopped && !placed) onStatus('Surface detection unavailable · place the preview manually');
        });
      },
    };
  } catch (error) {
    if (session) await session.end().catch(() => {});
    cleanup();
    throw error;
  }
}
