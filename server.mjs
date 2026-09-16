import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJECT_ROOT = import.meta.dirname;
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mind': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};
const THREE_FILES = new Set([
  '/node_modules/three/build/three.module.js',
  '/node_modules/three/build/three.core.js',
]);

function isPublicAsset(path) {
  return path === '/index.html' || path === '/target.html' ||
    /^\/(assets|vendor)\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|svg|mind|js|txt)$/.test(path) || THREE_FILES.has(path) ||
    /^\/src\/[a-zA-Z0-9_-]+\.(js|css)$/.test(path);
}

/** A small development-only server. Repository files are not public assets. */
export function createDevServer(root = PROJECT_ROOT) {
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');

    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end('Method not allowed');
      return;
    }

    let path;
    try {
      path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400);
      response.end('Invalid URL');
      return;
    }

    if (path === '/') path = '/index.html';
    if (!isPublicAsset(path)) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    try {
      const publicAsset = path === '/target.html' || path.startsWith('/assets/') || path.startsWith('/vendor/');
      const file = resolve(root, publicAsset ? 'public' : '.', '.' + path);
      // Refuse symlinks so an asset cannot expose another local file.
      if (await realpath(file) !== file) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      const content = await readFile(file);
      response.writeHead(200, {
        'Content-Type': CONTENT_TYPES[extname(file)],
        'Content-Length': content.length,
      });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Unable to serve asset');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 5173);
  const host = process.env.HOST ?? '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT must be an integer between 1 and 65535.');
    process.exitCode = 1;
  } else {
    const server = createDevServer();
    server.on('error', error => {
      console.error(`Cannot start Slice Snake: ${error.message}`);
      process.exitCode = 1;
    });
    server.listen(port, host, () => console.log(`Slice Snake: http://${host}:${port}`));
  }
}
