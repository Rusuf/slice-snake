# Asset provenance

- `public/assets/pizza-inn-logo.png`: Pizza Inn logo served by Simbisa Brands at https://www.simbisabrands.com/assets/img/1293/pi-updated-logos-95x122-2.png, referenced by https://www.simbisabrands.com/our-brands/pizza-inn/. Used as supplied for the requested brand concept; no logo redraw.
- `public/assets/demo-target.png` and `demo-target.mind`: paired image-tracking example from https://github.com/hiukim/mind-ar-js/tree/v1.2.5/examples/image-tracking/assets/card-example. These are test assets, not Pizza Inn packaging.
- `public/vendor/mindar-image.prod.js`, `controller-mGt1s8dJ.js`, and `ui-fBadYuor.js`: unmodified distribution files from MindAR 1.2.5, https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/. MIT license in `public/vendor/MINDAR-LICENSE.txt`. The distributed controller includes TensorFlow.js components (Apache 2.0); its license is included beside the runtime.
- Three.js remains an npm dependency, with its license copied into the published output by the existing packaging script.

The AR runtime is served locally and downloaded only when camera mode is requested. No runtime CDN is used.
