const RUNTIME_URL = new URL('../vendor/8thwall/xr.js', import.meta.url);
let runtimePromise;

/** Load once on demand. Cancelling a session does not create a second global engine. */
export function loadEighthWallRuntime() {
  if (runtimePromise) return runtimePromise;
  runtimePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const finish = (error, runtime) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener('xrloaded', loaded);
      script.removeEventListener('error', failed);
      if (error) reject(error);
      else resolve(runtime);
    };
    const loaded = () => {
      const runtime = window.XR8;
      if (!runtime?.XrController) return;
      finish(null, runtime);
    };
    const failed = () => finish(new Error('The AR engine could not load. Reload to retry, or play in 3D.'));
    // A timed-out script can still execute later. Keep the settled promise to avoid
    // installing another global engine over a live one; reloading is the retry boundary.
    const timer = setTimeout(() => finish(new Error('AR loading timed out. Reload to retry, or play in 3D.')), 30000);
    script.src = RUNTIME_URL.href;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-preload-chunks', 'slam');
    window.addEventListener('xrloaded', loaded);
    script.addEventListener('error', failed, { once: true });
    document.head.appendChild(script);
  });
  return runtimePromise;
}

export function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(new DOMException('Camera setup cancelled', 'AbortError'));
  return new Promise((resolve, reject) => {
    const cancel = () => { cleanup(); reject(new DOMException('Camera setup cancelled', 'AbortError')); };
    const cleanup = () => signal.removeEventListener('abort', cancel);
    signal.addEventListener('abort', cancel, { once: true });
    Promise.resolve(promise).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}
