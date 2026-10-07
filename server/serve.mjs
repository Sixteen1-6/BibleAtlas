// Production server: serves web/dist and the /api/esv proxy. No dependencies.
//   ESV_API_KEY=... node server/serve.mjs   (PORT defaults to 8080)
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { createGzip } from 'node:zlib';
import { createEsvHandler } from './esv.mjs';

const root = resolve(new URL('../web/dist', import.meta.url).pathname);
const port = Number(process.env.PORT || 8080);
const esv = createEsvHandler({ apiKey: process.env.ESV_API_KEY });

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.bin', '.svg', '.wasm']);

createServer((req, res) => {
  if (req.url.startsWith('/api/esv')) return esv(req, res);
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) {
    res.statusCode = 403;
    return res.end();
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  const ext = extname(file);
  res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
  // Hashed assets and versioned data never change; the page itself is revalidated.
  res.setHeader('Cache-Control', ext === '.html' || file.endsWith('meta.json') ? 'no-cache' : 'public, max-age=31536000, immutable');
  if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    res.setHeader('Content-Encoding', 'gzip');
    return createReadStream(file).pipe(createGzip({ level: 6 })).pipe(res);
  }
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Bible Atlas on http://localhost:${port}`));
