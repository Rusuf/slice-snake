// Exact public distribution paths; never expose arbitrary dependency/repository files.
export const EIGHTH_WALL_ASSETS = new Set([
  '/eighth-wall-target.html',
  ...['xr.js', 'xr-slam.js', 'xr-face.js', 'LICENSE',
    'resources/dom-tablet-button.glb', 'resources/dom-tablet-frame.glb',
    'resources/face-ear-model.tflite', 'resources/face-mesh-model.tflite',
    'resources/face-model.tflite', 'resources/media-worker.js',
    'resources/powered-by.svg', 'resources/semantics-model.tflite',
    'resources/semantics-worker.js',
  ].map(file => `/vendor/8thwall/${file}`),
  ...['slice-snake-square.json', 'slice-snake-square_original.png',
    'slice-snake-square_cropped.png', 'slice-snake-square_thumbnail.png',
    'slice-snake-square_luminance.png',
  ].map(file => `/image-targets/${file}`),
]);
