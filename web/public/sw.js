// Bible Atlas service worker. Plain JavaScript, no build step; registered by
// src/arrival.ts in production builds only.
//
// What it keeps, and how:
// - Pages (navigations): network first, waiting about 3 s; then the saved
//   index.html. A typed link such as /John.3.16 gets the saved 404 page, which
//   turns it into the verse.
// - data/meta.json: network first, saved without its ?t= cache-buster. It
//   names the data build in use.
// - Data files with ?v=<buildId> and Vite's hashed files under assets/: saved
//   the first time they are used, then served from the copy. Nothing large is
//   downloaded ahead of time (atlas.bin is 8 MB).
// - Never anything under /api/ (the ESV proxy): the ESV is never stored.
// - Only same-origin GET requests; everything else goes straight to the network.
//
// Staying safe:
// - Caches are versioned and pruned: one data build at a time, and only the
//   hashed files the current and previous page still use.
// - KILL = true, deployed, removes this worker and its caches for everyone.
//   ?sw=off in the address does the same in one browser (see src/arrival.ts).
// - A new worker waits until the visitor chooses "Reload".

const KILL = false;
const SW_VERSION = 'v1';

const SCOPE = self.registration.scope; // e.g. https://sixteen1-6.github.io/BibleAtlas/
const BASE = new URL(SCOPE).pathname; // e.g. /BibleAtlas/
const SHELL = `atlas-shell-${SW_VERSION}@${BASE}`;
const DATA = `atlas-data@${BASE}`;
const OURS = (name) => name.startsWith('atlas-') && name.endsWith(`@${BASE}`);

const INDEX = SCOPE; // the app's page
const NOT_FOUND = `${SCOPE}404.html`;
const PREVIOUS = `${SCOPE}__sw/previous-index.html`; // the page before the latest deploy
const META = `${SCOPE}data/meta.json`;
const LATEST = `${SCOPE}__sw/latest-build`; // the newest data build meta.json has named
const NAV_TIMEOUT_MS = 3000;
const HTML = { 'Content-Type': 'text/html; charset=utf-8' };
/** The page is removing the offline copy (?sw=off, or "Clear saved data" on
 * the error screen): from now on this worker saves nothing and steps aside. */
let stopped = false;

if (KILL) {
  // Take over at once, then remove every trace and reload the pages that this
  // worker (or an older one) was running, so they load from the network.
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        const pages = await self.clients.matchAll({ type: 'window' });
        for (const name of await caches.keys()) if (OURS(name)) await caches.delete(name);
        await self.registration.unregister();
        for (const page of pages) page.navigate(page.url).catch(() => {});
      })(),
    );
  });
} else {
  self.addEventListener('install', (event) => event.waitUntil(install()));
  self.addEventListener('activate', (event) => event.waitUntil(activate()));
  self.addEventListener('message', (event) => {
    const msg = event.data || {};
    if (msg.type === 'SKIP_WAITING') self.skipWaiting();
    else if (msg.type === 'STOP') stopped = true;
    else if (msg.type === 'WARM' && Array.isArray(msg.urls)) event.waitUntil(warm(msg.urls));
  });
  self.addEventListener('fetch', onFetch);
}

// ------------------------------------------------------------ lifecycle

async function install() {
  const shell = await caches.open(SHELL);
  const page = await fetch(INDEX, { cache: 'no-cache' });
  if (!page.ok) throw new Error(`index.html: HTTP ${page.status}`);
  const html = await page.text();
  await shell.put(INDEX, new Response(html, { headers: HTML }));
  try {
    const nf = await fetch(NOT_FOUND, { cache: 'no-cache' });
    if (nf.ok) await shell.put(NOT_FOUND, new Response(await nf.text(), { headers: HTML }));
  } catch {
    // Without it, typed links fall back to the app page when offline.
  }
  // Hashed files an older worker saved are still good: carry them over, so
  // an update never costs the offline copy. Its page becomes the previous
  // one, so tabs still open on it keep their files.
  for (const name of await caches.keys()) {
    if (!OURS(name) || !name.startsWith('atlas-shell-') || name === SHELL) continue;
    const old = await caches.open(name);
    const oldPage = await old.match(INDEX);
    const oldHtml = oldPage ? await oldPage.text() : null;
    const previous = oldHtml && oldHtml !== html ? new Response(oldHtml, { headers: HTML }) : await old.match(PREVIOUS);
    if (previous) await shell.put(PREVIOUS, previous);
    for (const req of await old.keys()) {
      if (!new URL(req.url).pathname.startsWith(`${BASE}assets/`) || (await shell.match(req))) continue;
      const res = await old.match(req);
      if (res) await shell.put(req, res);
    }
  }
}

async function activate() {
  for (const name of await caches.keys()) {
    if (OURS(name) && name.startsWith('atlas-shell-') && name !== SHELL) await caches.delete(name);
  }
  await pruneAssets();
  await self.clients.claim();
}

// ------------------------------------------------------------ routing

function isApi(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith(`${BASE}api/`);
}

function classify(url) {
  const p = url.pathname;
  if (p.startsWith(`${BASE}assets/`)) return 'asset';
  if (p === `${BASE}data/meta.json`) return 'meta';
  if (p.startsWith(`${BASE}data/`) && url.searchParams.has('v')) return 'data';
  return null;
}

function onFetch(event) {
  const req = event.request;
  if (stopped || req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE) || isApi(url)) return;
  if (req.mode === 'navigate') {
    event.respondWith(orNetwork(navigate(event, url), req));
    return;
  }
  const route = classify(url);
  if (route === 'meta') event.respondWith(orNetwork(meta(event), req));
  else if (route) event.respondWith(cacheFirst(event, route === 'asset' ? SHELL : DATA, url.href));
}

/** Never worse than no worker: if anything here fails (storage blocked, a
 * bug), ask the network as the page would have. (cacheFirst does this itself,
 * so a file that is not saved is not asked for twice while offline.) */
function orNetwork(promise, req) {
  return promise.catch(() => fetch(req));
}

/** Pages that were given the saved index.html because the network was slow.
 * They get the saved data build too, so an older page never meets newer data. */
const stale = new Set();

async function navigate(event, url) {
  const app = url.pathname === BASE || url.pathname === `${BASE}index.html`;
  let saving = Promise.resolve();
  let answer = null; // what the server said, even if it was an error
  const network = fetch(event.request).then((res) => {
    answer = res;
    const html = (res.headers.get('content-type') || '').includes('text/html');
    if (app && res.ok && html) saving = saveShell(res.clone(), event.resultingClientId).catch(() => {});
    if (app && res.status >= 500) throw new Error(`HTTP ${res.status}`); // the host is down: prefer the saved page
    return res;
  });
  event.waitUntil(network.then(() => saving, () => {}));
  try {
    return await withTimeout(network, NAV_TIMEOUT_MS);
  } catch {
    const shell = await caches.open(SHELL);
    const saved = (await shell.match(app ? INDEX : NOT_FOUND)) || (await shell.match(INDEX));
    if (!saved) return network.catch((err) => answer || Promise.reject(err)); // nothing saved yet: wait for the network
    if (app) stale.add(event.resultingClientId);
    return saved;
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Keep the newest index.html, and the one before it for tabs still open on
 * it. A page that was served the older copy hears that a new one is ready. */
async function saveShell(res, clientId) {
  if (stopped) return;
  const shell = await caches.open(SHELL);
  const html = await res.text();
  const old = await shell.match(INDEX);
  const oldHtml = old ? await old.text() : null;
  if (oldHtml === html) {
    stale.delete(clientId); // the saved page was the current one after all
    return;
  }
  if (oldHtml) await shell.put(PREVIOUS, new Response(oldHtml, { headers: HTML }));
  await shell.put(INDEX, new Response(html, { headers: HTML }));
  await pruneAssets();
  if (stale.has(clientId)) {
    stale.delete(clientId);
    const page = await self.clients.get(clientId);
    page?.postMessage({ type: 'NEW_VERSION' });
  }
}

async function meta(event) {
  const data = await caches.open(DATA);
  if (stale.has(event.clientId)) {
    const kept = await data.match(META);
    if (kept) return kept;
  }
  try {
    const res = await fetch(event.request);
    if (res.ok) event.waitUntil(noteMeta(res.clone()).catch(() => {}));
    return res;
  } catch (err) {
    const latest = await data.match(LATEST);
    const kept = (await data.match(META)) || (latest && (await data.match(`${META}?v=${await latest.text()}`)));
    if (kept) return kept;
    throw err;
  }
}

// ------------------------------------------------------------ saved copies

const inflight = new Map(); // url -> the promise of it being saved

async function cacheFirst(event, cacheName, key) {
  let cache = null;
  try {
    cache = await caches.open(cacheName);
    const hit = await cache.match(key, { ignoreVary: true });
    if (hit) return hit;
    if (inflight.has(key)) {
      // Another request is saving the same file (the engine and the page both
      // load atlas.bin): wait for it rather than download it twice.
      await inflight.get(key);
      const now = await cache.match(key, { ignoreVary: true });
      if (now) return now;
    }
  } catch {
    cache = null; // storage is unavailable: use the network as if there were no worker
  }
  const res = await fetch(event.request);
  if (cache && res.status === 200 && res.type === 'basic') event.waitUntil(store(cache, cacheName, key, res.clone()));
  return res;
}

function store(cache, cacheName, key, res) {
  if (stopped) return Promise.resolve();
  const saving = cache
    .put(key, res)
    .then(() => (cacheName === DATA ? dataSaved(key) : undefined))
    .catch(() => {}) // out of space, or the download broke off: just don't keep it
    .finally(() => inflight.delete(key));
  inflight.set(key, saving);
  return saving;
}

/** meta.json names the data build. Remember it, and switch to it once its
 * atlas.bin is saved, so offline always has one complete build. */
async function noteMeta(res) {
  const id = String((await res.clone().json()).buildId || '');
  if (stopped || !/^[\w.-]{1,64}$/.test(id)) return;
  const data = await caches.open(DATA);
  await data.put(`${META}?v=${id}`, res);
  await data.put(LATEST, new Response(id));
  await settle(id);
}

async function dataSaved(key) {
  const url = new URL(key);
  if (stopped || url.pathname !== `${BASE}data/atlas.bin`) return;
  const latest = await (await caches.open(DATA)).match(LATEST);
  if (latest && url.searchParams.get('v') === (await latest.text())) await settle(url.searchParams.get('v'));
}

async function settle(id) {
  if (stopped) return;
  const data = await caches.open(DATA);
  if (!(await data.match(`${SCOPE}data/atlas.bin?v=${id}`, { ignoreVary: true }))) return;
  const m = await data.match(`${META}?v=${id}`);
  if (m) await data.put(META, m);
  for (const req of await data.keys()) {
    const url = new URL(req.url);
    const v = url.searchParams.get('v');
    if (v !== null && v !== id && url.pathname.startsWith(`${BASE}data/`)) await data.delete(req);
  }
}

/** Hashed files a text (a page, a script, a stylesheet) refers to. */
function refs(text, base) {
  const out = [];
  for (const m of text.matchAll(/[\w./:%-]*assets\/[\w.-]+\.(?:js|css|wasm|woff2?|png|svg|jpe?g|webp)(?![\w.])/g)) {
    try {
      const url = new URL(m[0], base);
      if (url.origin === self.location.origin && url.pathname.startsWith(`${BASE}assets/`)) out.push(url.href);
    } catch {
      // not a URL after all
    }
  }
  return out;
}

/** Drop hashed files that neither the current page nor the previous one can
 * reach (following scripts and stylesheets to the worker, the engine and the
 * fonts), so the copy does not grow with every deploy. */
async function pruneAssets() {
  if (stopped) return;
  const shell = await caches.open(SHELL);
  const keep = new Set();
  const visit = async (text, base) => {
    for (const ref of refs(text, base)) {
      if (keep.has(ref)) continue;
      keep.add(ref);
      if (/\.(js|css)$/.test(new URL(ref).pathname)) {
        const r = await shell.match(ref, { ignoreVary: true });
        if (r) await visit(await r.text(), ref);
      }
    }
  };
  for (const key of [INDEX, PREVIOUS]) {
    const page = await shell.match(key);
    if (page) await visit(await page.text(), key);
  }
  if (!keep.size) return; // no page to judge by: keep everything
  for (const req of await shell.keys()) {
    if (new URL(req.url).pathname.startsWith(`${BASE}assets/`) && !keep.has(req.url)) await shell.delete(req);
  }
}

/** On a first visit the page loads before this worker is in control. The page
 * then lists what it loaded; save the files that belong here. The engine's
 * own worker loads its script and the wasm out of the page's sight, so follow
 * scripts to the scripts and wasm they load. Fonts are kept when used. */
async function warm(urls) {
  const queue = urls.slice(0, 500);
  const seen = new Set();
  while (queue.length && !stopped) {
    let url;
    try {
      url = new URL(queue.shift(), SCOPE);
    } catch {
      continue;
    }
    if (seen.has(url.href) || url.origin !== self.location.origin || !url.pathname.startsWith(BASE) || isApi(url)) continue;
    seen.add(url.href);
    const route = classify(url);
    if (!route) continue;
    try {
      if (route === 'meta') {
        const res = await fetch(url.href, { cache: 'force-cache' });
        if (res.ok) await noteMeta(res);
        continue;
      }
      const res = await ensure(route === 'asset' ? SHELL : DATA, url.href);
      if (res && route === 'asset' && url.pathname.endsWith('.js')) {
        for (const ref of refs(await res.clone().text(), url.href)) if (/\.(js|wasm)$/.test(ref)) queue.push(ref);
      }
    } catch {
      // Offline or out of space: the next visit tries again.
    }
  }
}

async function ensure(cacheName, key) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(key, { ignoreVary: true });
  if (hit) return hit;
  if (inflight.has(key)) {
    await inflight.get(key);
    return cache.match(key, { ignoreVary: true });
  }
  const res = await fetch(key, { cache: 'force-cache' });
  if (res.status !== 200 || res.type !== 'basic') return null;
  await store(cache, cacheName, key, res.clone());
  return res;
}
