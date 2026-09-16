import { Matrix4 } from 'three';

/** Android-first image tracking. Video frames stay in the browser. */
export async function startARSession({ host, view, onTracking, onStatus, onError, signal }) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera mode needs HTTPS and a camera-enabled browser. Try Chrome on Android.');
  }
  if (signal.aborted) throw new DOMException('Camera setup cancelled', 'AbortError');
  const video = document.createElement('video');
  video.className = 'ar-video';
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('aria-hidden', 'true');
  let stream;
  let controller;
  let observer;
  let resizeVideo;
  let stopped = false;
  let found = false;
  let loop = null;
  let lastTrackingTime = 0;
  const sourceMatrix = new Matrix4();
  const modelMatrix = new Matrix4();
  let targetTransform;

  function stop() {
    if (stopped) return;
    stopped = true;
    if (loop !== null) cancelAnimationFrame(loop);
    observer?.disconnect();
    if (resizeVideo) video.removeEventListener('resize', resizeVideo);
    controller?.dispose();
    controller?.worker?.terminate();
    stream?.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    video.remove();
    signal.removeEventListener('abort', stop);
    view.exitAR();
  }
  signal.addEventListener('abort', stop, { once: true });
  const assertActive = () => { if (signal.aborted || stopped) throw new DOMException('Camera setup cancelled', 'AbortError'); };

  try {
    onStatus('Opening camera…');
    // Register cancellation before awaiting permission; late permission grants are cleaned up.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
    });
    if (stopped || signal.aborted) {
      stream.getTracks().forEach(track => track.stop());
      assertActive();
    }
    stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
      if (stopped) return;
      stop();
      onError(new Error('The camera connection ended. You can return to AR or continue in 3D.'));
    }, { once: true }));
    host.prepend(video);
    video.srcObject = stream;
    await video.play();
    assertActive();
    video.width = video.videoWidth;
    video.height = video.videoHeight;
    onStatus('Preparing image tracking…');
    const [{ Controller }, targetResponse] = await Promise.all([
      import('../vendor/mindar-image.prod.js'),
      fetch(new URL('../assets/demo-target.mind', import.meta.url), { signal }),
    ]);
    assertActive();
    if (!targetResponse.ok) throw new Error('The tracking card could not load. Try camera mode again.');
    const targetBuffer = await targetResponse.arrayBuffer();
    assertActive();
    controller = new Controller({
      inputWidth: video.videoWidth, inputHeight: video.videoHeight,
      maxTrack: 1, warmupTolerance: 4, missTolerance: 4,
      onUpdate: data => {
        if (stopped || data.type !== 'updateMatrix' || data.targetIndex !== 0) return;
        const visible = data.worldMatrix !== null;
        if (visible) {
          lastTrackingTime = performance.now();
          sourceMatrix.fromArray(data.worldMatrix);
          modelMatrix.multiplyMatrices(sourceMatrix, targetTransform);
          view.trackAR(modelMatrix, true);
        } else view.trackAR(null, false);
        if (found !== visible) { found = visible; onTracking(visible); }
      },
    });
    const { dimensions } = controller.addImageTargetsFromBuffer(targetBuffer);
    const [width, height] = dimensions[0];
    const size = Math.min(width, height) * .92 / 18.4;
    targetTransform = new Matrix4().makeTranslation(width / 2, height / 2, 0)
      .multiply(new Matrix4().makeRotationX(Math.PI / 2))
      .multiply(new Matrix4().makeScale(size, size, size));

    function resize() {
      const bounds = host.getBoundingClientRect();
      if (!bounds.width || !bounds.height || stopped) return;
      // Match projection to the exact center-crop used by object-fit: cover.
      video.width = video.videoWidth;
      video.height = video.videoHeight;
      const cover = Math.max(bounds.width / video.videoWidth, bounds.height / video.videoHeight);
      const projection = [...controller.getProjectionMatrix()];
      projection[0] *= controller.inputWidth * cover / bounds.width;
      projection[5] *= controller.inputHeight * cover / bounds.height;
      view.setARProjection(projection);
    }
    view.enterAR();
    resize();
    resizeVideo = resize;
    video.addEventListener('resize', resize);
    observer = new ResizeObserver(resize);
    observer.observe(host);
    controller.dummyRun(video);
    assertActive();
    controller.processVideo(video);
    onStatus('Point at the demo card');
    function render() {
      if (stopped) return;
      // A stalled tracker must not leave a game running on a frozen anchor.
      if (found && performance.now() - lastTrackingTime > 900) {
        found = false;
        view.trackAR(null, false);
        onTracking(false);
      }
      view.renderAR();
      loop = requestAnimationFrame(render);
    }
    loop = requestAnimationFrame(render);
    return { stop };
  } catch (error) {
    stop();
    if (error.name === 'NotAllowedError') throw new Error('Camera permission was denied. Allow it in your browser settings, or keep playing in 3D.');
    if (error.name === 'NotFoundError') throw new Error('No camera was found. You can keep playing in 3D.');
    throw error;
  }
}
