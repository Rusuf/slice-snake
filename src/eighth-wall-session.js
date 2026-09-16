import { loadEighthWallRuntime, abortable } from './eighth-wall-runtime.js';
import { createTargetPose } from './eighth-wall-pose.js';

const TARGET_URL = new URL('../image-targets/slice-snake-square.json', import.meta.url);
let activeSession = null;

/** XR8 owns one camera and frame loop. The existing Three.js renderer remains owned by the game. */
export async function startEighthWallSession({
  host, view, signal, onStatus, onTracking, onError, onFrame,
  loadRuntime = loadEighthWallRuntime, fetchTarget = fetch,
}) {
  if (signal.aborted) throw new DOMException('Camera setup cancelled', 'AbortError');
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera mode needs HTTPS and a camera-enabled browser. Try Chrome on Android.');
  }
  if (activeSession) throw new Error('The previous AR session is still closing. Try again.');
  const token = {};
  activeSession = token;
  let runtime, canvas, observer, stream, watchdog, startupTimer;
  let stopped = false;
  let entered = false;
  let modules = [];
  let found = false;
  let lastTracking = 0;
  let resolveStart, rejectStart;
  let started = false;
  const toPose = createTargetPose();
  let camera;
  const endListeners = [];

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(watchdog);
    clearTimeout(startupTimer);
    observer?.disconnect();
    signal.removeEventListener('abort', stop);
    rejectStart?.(new DOMException('Camera setup cancelled', 'AbortError'));
    endListeners.forEach(([track, ended]) => track.removeEventListener('ended', ended));
    // The pinned engine invalidates pending getUserMedia attempts on stop and
    // stops their late streams. Also release the stream already delivered to us.
    const release = action => {
      try { action(); } catch (error) { console.warn('AR cleanup failed:', error); }
    };
    if (runtime && modules.length) {
      release(() => runtime.stop());
      for (const module of modules) release(() => runtime.removeCameraPipelineModule(module.name));
    }
    stream?.getTracks().forEach(track => release(() => track.stop()));
    canvas?.remove();
    if (entered) release(() => view.exitAR());
    if (activeSession === token) activeSession = null;
  }
  function fail(error) {
    if (stopped) return;
    const message = error?.name === 'NotAllowedError' || error?.type === 'permission'
      ? 'Camera permission was denied. Allow it in browser settings, or keep playing in 3D.'
      : error?.message || 'Image tracking stopped. Try again or keep playing in 3D.';
    const failure = new Error(message);
    rejectStart?.(failure);
    const notify = started;
    stop();
    if (notify) onError(failure);
  }
  function tracking(visible) {
    if (!visible) view.trackAR(null, false);
    if (found !== visible) {
      found = visible;
      onTracking(visible);
    }
  }
  const assertActive = () => {
    if (stopped || signal.aborted) throw new DOMException('Camera setup cancelled', 'AbortError');
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    camera = view.getXRContext().camera;
    onStatus('Loading experimental image tracking…');
    const [engine, response] = await abortable(Promise.all([
      loadRuntime(), fetchTarget(TARGET_URL, { signal }),
    ]), signal);
    assertActive();
    if (!response.ok) throw new Error('The prototype target could not load. Keep playing in 3D.');
    const target = await abortable(response.json(), signal);
    assertActive();
    if (target.name !== 'slice-snake-square' || target.type !== 'PLANAR') throw new Error('The prototype target data is invalid.');
    // CLI imagePath is relative to the application. Resolve its emitted resource
    // against this JSON URL so nested previews work without relying on the page URL.
    target.imagePath = new URL(target.resources.luminanceImage, TARGET_URL).href;
    runtime = engine;
    canvas = document.createElement('canvas');
    canvas.className = 'eighth-wall-camera';
    canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);
    const resize = () => {
      const bounds = host.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * ratio));
      canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    };
    resize();
    observer = new ResizeObserver(resize);
    observer.observe(host);
    view.enterAR({ externalFrames: true });
    entered = true;
    const pose = ({ detail }) => {
      if (stopped || detail?.name !== target.name) return;
      const matrix = toPose(detail);
      if (!matrix) { tracking(false); return; }
      lastTracking = performance.now();
      view.trackAR(matrix, true);
      tracking(true);
    };
    const ready = new Promise((resolve, reject) => { resolveStart = resolve; rejectStart = reject; });
    // Observe immediately: a synchronous runtime callback can reject during run().
    ready.catch(() => {});
    const pipeline = {
      name: 'slice-snake-image-target',
      onStart() {
        if (stopped) return;
        runtime.XrController.updateCameraProjectionMatrix({ origin: camera.position, facing: camera.quaternion });
        clearTimeout(startupTimer);
        started = true;
        onStatus('Point at the square prototype card');
        resolveStart();
      },
      onCameraStatusChange({ status, stream: nextStream }) {
        if (stopped) { nextStream?.getTracks().forEach(track => track.stop()); return; }
        if (nextStream) {
          stream = nextStream;
          stream.getVideoTracks().forEach(track => {
            const ended = () => fail(new Error('The camera connection ended. You can keep playing in 3D.'));
            track.addEventListener('ended', ended, { once: true });
            endListeners.push([track, ended]);
          });
        }
        if (status === 'requesting') onStatus('Allow camera access to find the printed square');
        if (status === 'failed') fail(new Error('Camera access failed. Check browser camera permission, or keep playing in 3D.'));
      },
      onException: fail,
      onUpdate({ processCpuResult }) {
        if (stopped) return;
        const reality = processCpuResult?.reality;
        if (!reality?.intrinsics || !reality.position || !reality.rotation) { tracking(false); return; }
        view.setARProjection(reality.intrinsics);
        camera.position.copy(reality.position);
        camera.quaternion.copy(reality.rotation);
        camera.updateMatrixWorld();
        if (found && performance.now() - lastTracking > 900) tracking(false);
        onFrame(performance.now());
      },
      onRender() { if (!stopped) view.renderAR(); },
      listeners: [
        { event: 'reality.imagefound', process: pose },
        { event: 'reality.imageupdated', process: pose },
        { event: 'reality.imagelost', process: ({ detail }) => {
          if (!stopped && detail?.name === target.name) tracking(false);
        } },
      ],
    };
    runtime.XrController.configure({ disableWorldTracking: true, imageTargetData: [target] });
    modules = [runtime.GlTextureRenderer.pipelineModule(), runtime.XrController.pipelineModule(), pipeline];
    runtime.addCameraPipelineModules(modules);
    watchdog = setInterval(() => {
      if (!stopped && found && performance.now() - lastTracking > 900) {
        tracking(false);
        view.renderAR();
      }
    }, 300);
    startupTimer = setTimeout(() => fail(new Error('Camera startup timed out. Try again or keep playing in 3D.')), 45000);
    runtime.run({ canvas, webgl2: true, ownRunLoop: true,
      allowedDevices: runtime.XrConfig.device().MOBILE,
      cameraConfig: { direction: runtime.XrConfig.camera().BACK },
    });
    await abortable(ready, signal);
    assertActive();
    return { stop };
  } catch (error) {
    stop();
    throw error;
  }
}
