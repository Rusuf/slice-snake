import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createDevServer } from '../server.mjs';

let server;
let origin;
before(async () => {
  server = createDevServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test('serves the page and the complete module dependency chain', async () => {
  for (const path of [
    '/', '/src/main.js', '/src/game.js', '/src/scene.js', '/src/storage.js', '/src/style.css',
    '/node_modules/three/build/three.module.js', '/node_modules/three/build/three.core.js',
  ]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const expected = path === '/' ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'text/javascript';
    assert.ok(response.headers.get('content-type').startsWith(expected), path);
    assert.ok((await response.text()).length > 0, path);
  }
});

test('does not expose repository metadata or arbitrary local files', async () => {
  for (const path of ['/.git/config', '/.env', '/package.json', '/server.mjs', '/README.md', '/src/%2e%2e%2f.git%2fconfig', '/src/missing.js']) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 404, path);
    await response.text();
  }
});

test('supports HEAD without a body and rejects unsupported methods', async () => {
  const head = await fetch(origin, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.ok(Number(head.headers.get('content-length')) > 0);
  assert.equal(await head.text(), '');
  const post = await fetch(origin, { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
  await post.text();
});

test('malformed percent encoding is a bad request', async () => {
  const response = await fetch(origin + '/%ZZ');
  assert.equal(response.status, 400);
  await response.text();
});

test('serves the branded assets, printable target, and pinned AR runtime', async () => {
  for (const [path, type] of [
    ['/target.html', 'text/html'],
    ['/assets/pizza-inn-logo.png', 'image/png'],
    ['/assets/demo-target.png', 'image/png'],
    ['/assets/demo-target.mind', 'application/octet-stream'],
    ['/vendor/mindar-image.prod.js', 'text/javascript'],
    ['/vendor/controller-mGt1s8dJ.js', 'text/javascript'],
    ['/vendor/ui-fBadYuor.js', 'text/javascript'],
  ]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.ok(response.headers.get('content-type').startsWith(type), path);
    assert.ok((await response.arrayBuffer()).byteLength > 0, path);
  }
  for (const path of ['/assets/%2e%2e%2f.env', '/vendor/.env', '/public/vendor/mindar-image.prod.js']) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 404, path);
    await response.text();
  }
});
