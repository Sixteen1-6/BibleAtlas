// Arrival: the first seconds and the bad days. Imported first by main.tsx.
//
// - Hands the night sky in index.html (#boot) over to the app once the atlas
//   has loaded, with a short fade.
// - Registers the service worker (production builds only), so the site can be
//   installed as an app and keeps working offline for everything already
//   opened. The worker never stores anything under /api/, where the ESV is
//   served; see public/sw.js.
// - Tells visitors when a new version is ready, and when they are offline.
// - With ?sw=off in the address, removes the worker and its saved copies, and
//   keeps that tab without one until it closes (for support).

import { effect } from '@preact/signals';
import * as S from './state';
import './arrival.css';

const BASE = import.meta.env.BASE_URL;
/** The worker's scope, e.g. https://sixteen1-6.github.io/BibleAtlas/. */
const SCOPE = new URL(BASE, location.href).href;
const SCOPE_PATH = new URL(SCOPE).pathname;

/** This build's script (index-<hash>.js), for error reports and update checks. */
export const appBuild = new URL(import.meta.url).pathname.split('/').pop() || 'dev';

/** The boot sky's drawing, kept so the error screen can show it after #boot is gone. */
export const bootSky = document.querySelector('#boot svg')?.outerHTML ?? '';

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------ boot hand-off

// The script did start, so the "still on its way" note is not needed. It is
// hidden rather than removed: index.html shows it again if the app stops on an
// error before drawing anything.
{
  const note = document.getElementById('boot-note');
  if (note) note.hidden = true;
}

{
  const boot = document.getElementById('boot');
  let gone = false;
  if (boot) {
    effect(() => {
      if (gone || !S.atlas.value) return;
      gone = true;
      if (reduceMotion() || document.visibilityState === 'hidden') {
        boot.remove();
        return;
      }
      // The sky comes to the front (it looks just like the loading screen it
      // covers) and fades out over the map.
      boot.classList.add('arr-leave');
      const done = () => boot.remove();
      boot.addEventListener('transitionend', done, { once: true });
      window.setTimeout(done, 800);
    });
  }
}

// ------------------------------------------------------------ notices

let toastEl: HTMLElement | null = null;

function toast(message: string, action?: { label: string; run: () => void }): HTMLElement {
  toastEl?.remove();
  const el = document.createElement('div');
  el.className = 'arr-toast';
  el.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.className = 'arr-msg';
  text.textContent = message;
  el.append(text);
  if (action) {
    const go = document.createElement('button');
    go.className = 'arr-go';
    go.textContent = action.label;
    go.addEventListener('click', action.run);
    el.append(go);
  }
  const close = document.createElement('button');
  close.className = 'arr-x';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '×';
  close.addEventListener('click', () => el.remove());
  el.append(close);
  // First in the page, so from the top the keyboard reaches it with one Tab
  // (on a verse link, Tab starts at the verse, where the reader scrolled). It
  // is drawn at the bottom of the screen all the same.
  document.body.prepend(el);
  toastEl = el;
  return el;
}

// ------------------------------------------------------------ offline and updates

const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
const hadController = !!sw?.controller;
let registration: ServiceWorkerRegistration | undefined;
let offered = false;
let switching = false;

const isOurCache = (name: string) => name.startsWith('atlas-') && name.endsWith(`@${SCOPE_PATH}`);

/** Unregister this site's worker and delete its saved copies. Other sites on
 * the same address keep theirs. */
export async function clearOfflineData(): Promise<void> {
  try {
    for (const r of (await sw?.getRegistrations()) ?? []) {
      if (r.scope !== SCOPE) continue;
      // Tell the running worker to stop saving first, or it could write the
      // copies back while this page is still using it.
      for (const w of [r.active, r.waiting, r.installing]) w?.postMessage({ type: 'STOP' });
      await r.unregister();
    }
  } catch {
    // Nothing registered, or storage is blocked.
  }
  try {
    for (const name of await caches.keys()) if (isOurCache(name)) await caches.delete(name);
  } catch {
    // No Cache Storage here (an insecure address, or storage blocked).
  }
}

function offerUpdate(): void {
  if (offered) return;
  offered = true;
  toast('A new version is ready', {
    label: 'Reload',
    run: () => {
      const waiting = registration?.waiting;
      if (!waiting) {
        location.reload();
        return;
      }
      // Let the new worker take over, then reload under it.
      switching = true;
      waiting.postMessage({ type: 'SKIP_WAITING' });
      window.setTimeout(() => location.reload(), 4000);
    },
  });
}

async function register(): Promise<void> {
  if (!sw) return;
  try {
    registration = await sw.register(`${BASE}sw.js`, { scope: BASE });
  } catch {
    return; // Some private windows refuse workers; the site still works online.
  }
  const reg = registration;
  if (!reg) return; // a test harness that blocks workers
  // A new worker that installs while an older one runs this page waits for
  // the visitor's go-ahead.
  const track = (w: ServiceWorker | null) => {
    if (!w) return;
    const check = () => {
      // Only for a worker that really waits. The kill switch (sw.js KILL)
      // passes through 'installed' too, but takes over at once.
      if (w.state === 'installed' && sw.controller) window.setTimeout(() => reg.waiting === w && offerUpdate(), 1000);
    };
    w.addEventListener('statechange', check);
    check();
  };
  if (reg.waiting && sw.controller) offerUpdate();
  track(reg.installing);
  reg.addEventListener('updatefound', () => track(reg.installing));
  // Installed as an app: ask the browser to keep the offline copy.
  if (matchMedia('(display-mode: standalone)').matches) navigator.storage?.persist?.().catch(() => {});
}

/** On a first visit the app's files arrive before the worker is in control.
 * List the ones it did not see (their workerStart is 0), so it can keep a copy
 * of what was opened. The worker decides what to keep, and never keeps /api/. */
function forwardUnseen(): void {
  if (!sw || typeof PerformanceObserver === 'undefined') return;
  const pending = new Set<string>();
  let timer = 0;
  const flush = () => {
    timer = 0;
    const urls = [...pending];
    pending.clear();
    if (urls.length) void sw.ready.then((reg) => reg.active?.postMessage({ type: 'WARM', urls }));
  };
  const po = new PerformanceObserver((list) => {
    for (const e of list.getEntries() as PerformanceResourceTiming[]) {
      if (e.workerStart === 0 && e.name.startsWith(SCOPE)) pending.add(e.name);
    }
    if (pending.size && !timer) timer = window.setTimeout(flush, 1500);
  });
  try {
    po.observe({ type: 'resource', buffered: true });
  } catch {
    return;
  }
  window.setTimeout(() => po.disconnect(), 120_000);
}

/** A tab left open across a deploy: look for a newer page when it comes back
 * into view, at most every ten minutes. */
let lastCheck = Date.now();
async function checkForUpdate(): Promise<void> {
  if (offered || !navigator.onLine || Date.now() - lastCheck < 10 * 60_000) return;
  lastCheck = Date.now();
  registration?.update().catch(() => {});
  if (!/^index-.+\.js$/.test(appBuild)) return;
  try {
    const res = await fetch(`${BASE}index.html`, { cache: 'no-cache' });
    if (res.ok && !(await res.text()).includes(appBuild)) offerUpdate();
  } catch {
    // Offline: try again next time.
  }
}

/** ?sw=off keeps this tab without a worker until it closes: 'reload' while
 * the page reloads without the old worker, then 'on'. */
const OFF_KEY = 'atlas.sw-off';
function offState(set?: 'reload' | 'on'): string | null {
  try {
    if (set) sessionStorage.setItem(OFF_KEY, set);
    return sessionStorage.getItem(OFF_KEY);
  } catch {
    return null; // storage blocked
  }
}

// ------------------------------------------------------------ offline notice

let offlineEl: HTMLElement | null = null;

/** Offline (going, or opening the site so): say once what still works. */
function sayOffline(): void {
  if (offlineEl?.isConnected || (offered && toastEl?.isConnected)) return; // already said, or the update notice is up
  offlineEl = toast(
    sw?.controller ? 'You’re offline. Chapters you’ve opened before still work.' : 'You’re offline. Some parts need a connection.',
  );
}
window.addEventListener('offline', sayOffline);
window.addEventListener('online', () => {
  offlineEl?.remove();
  offlineEl = null;
});
if (!navigator.onLine) sayOffline();

// ------------------------------------------------------------ start

const params = new URLSearchParams(location.search);
const swParam = params.get('sw');
if (swParam !== null) {
  // Keep the address clean: ?sw=off is the support switch, and ?sw=reset is
  // the kill switch loading this page again (public/sw.js).
  params.delete('sw');
  const q = params.toString();
  history.replaceState(history.state, '', `${location.pathname}${q ? `?${q}` : ''}${location.hash}`);
}
if (swParam === 'off') {
  // Support switch: remove the worker and its copies.
  void clearOfflineData().then(() => {
    // The old worker still runs this page and would save files again: reload
    // without it. (The address no longer says sw=off, so this happens once.)
    if (sw?.controller && offState('reload') === 'reload') location.reload();
    else toast('The offline copy was removed.');
  });
} else if (offState()) {
  if (offState() === 'reload') {
    // Delete again now that no worker runs this page: the old one may have
    // saved files after the first pass.
    offState('on');
    void clearOfflineData().then(() => toast('The offline copy was removed.'));
  }
} else if (import.meta.env.PROD && sw) {
  sw.addEventListener('controllerchange', () => {
    if (switching) location.reload();
    // Another tab switched to a newer version. Asked again a moment later, as
    // the kill switch also takes over this way: by then it has removed itself
    // (and has this page load again).
    else if (hadController) {
      window.setTimeout(() => {
        void sw
          .getRegistration(SCOPE)
          .then((r) => r?.active && offerUpdate())
          .catch(() => {});
      }, 1500);
    }
  });
  sw.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === 'NEW_VERSION') offerUpdate();
    else if (e.data?.type === 'RELOAD') location.reload(); // the kill switch: load again from the network
  });
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
  if (!hadController) forwardUnseen();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
} else if (sw) {
  // Development: never register, and drop a worker a production build may
  // have left on this address, so it cannot serve stale files.
  void sw.getRegistrations().then((rs) => rs.forEach((r) => r.scope === SCOPE && void r.unregister()));
}
