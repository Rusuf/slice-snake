import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist');

// Publish only browser assets. The development server must never become a function.
await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, 'vendor'), { recursive: true });
await cp(resolve(root, 'src'), resolve(output, 'src'), { recursive: true });

const html = await readFile(resolve(root, 'index.html'), 'utf8');
await writeFile(resolve(output, 'index.html'),
  html.replace('./node_modules/three/build/three.module.js', './vendor/three.module.js'));

for (const file of ['three.module.js', 'three.core.js']) {
  await cp(resolve(root, 'node_modules/three/build', file), resolve(output, 'vendor', file));
}
await cp(resolve(root, 'node_modules/three/LICENSE'), resolve(output, 'vendor/THREE-LICENSE.txt'));
await writeFile(resolve(output, '.nojekyll'), '');
console.log('Static site ready in dist/. No server functions required.');
