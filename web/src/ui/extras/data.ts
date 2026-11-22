// Data for extras: JSON files the atlas build writes into web/public/data/, and
// the per-extra cache of what each extra's load() returned.

import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { type Atlas, DATA_BASE } from '../../data/atlas';
import { fetchRetry, onBackOnline } from '../../data/fetch';
import type { AnyExtra } from './registry';

const files = new Map<string, Promise<unknown>>();

/** The address of web/public/data/<file> for this build. A query the file
 * names itself, as in 'ask/meaning.json?k=<key>', goes after the build id. */
function dataUrl(a: Atlas, file: string): string {
  const [path, own] = file.replace(/^\/+/, '').split('?', 2);
  return `${DATA_BASE}${path}?${a.version}${own ? `&${own}` : ''}`;
}

/** Fetch web/public/data/<file> as JSON, e.g. loadJson(a, 'extras/quotes.json').
 * The site's base path (/BibleAtlas/ on GitHub Pages) and the build id are
 * added for you, so a new build is never served from a stale cache. Cached:
 * asking twice fetches once. Rejects if the file is missing or broken, and a
 * later call tries again. */
export function loadJson<T>(a: Atlas, file: string): Promise<T> {
  const url = dataUrl(a, file);
  let p = files.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetchRetry(url).then((r) => {
      if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    files.set(url, p);
    p.catch(() => files.delete(url));
  }
  return p;
}

/** Fetch web/public/data/<file> as bytes, as loadJson fetches JSON. */
export function loadBytes(a: Atlas, file: string): Promise<ArrayBuffer> {
  const url = dataUrl(a, file);
  let p = files.get(url) as Promise<ArrayBuffer> | undefined;
  if (!p) {
    p = fetchRetry(url).then((r) => {
      if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
      return r.arrayBuffer();
    });
    files.set(url, p);
    p.catch(() => files.delete(url));
  }
  return p;
}

/** Bumped to have every panel file that failed to load try again: by "Try
 * again" (retryFailed), when the connection comes back, when the page is
 * shown again, and a little while after a failure. */
const nudge = signal(0);
let nudgeTimer: ReturnType<typeof setTimeout> | null = null;
/** Automatic tries after a failure; "Try again" always works. */
const AUTO_TRIES = 5;
const AUTO_MS = 8_000;

/** Have every file a panel is waiting on, and every extra whose data failed,
 * try again now. For a "Try again" button. */
export function retryFailed(): void {
  if (nudgeTimer) clearTimeout(nudgeTimer);
  nudgeTimer = null;
  nudge.value++;
  retryExtras();
}

if (typeof window !== 'undefined') onBackOnline(retryFailed);

/** For a Panel that needs a heavier file only once it opens: undefined while
 * loading, null if it failed, then the parsed JSON. Pass null to load nothing.
 * A failed file is tried again by itself a few times, and whenever
 * retryFailed() is called, and stays null until one of those works. */
export function useJson<T>(a: Atlas, file: string | null): T | null | undefined {
  const [got, setGot] = useState<{ file: string; value: T | null } | null>(null);
  const tries = useRef({ file: '', n: 0 });
  // Reading the signal only while failed keeps loaded panels from redrawing.
  const again = got !== null && got.file === file && got.value === null ? nudge.value : 0;
  useEffect(() => {
    if (file === null) return;
    if (tries.current.file !== file) tries.current = { file, n: 0 };
    let live = true;
    loadJson<T>(a, file).then(
      (value) => {
        if (!live) return;
        tries.current.n = 0;
        setGot({ file, value });
      },
      () => {
        if (!live) return;
        const n = ++tries.current.n;
        setGot({ file, value: null });
        if (n < AUTO_TRIES && !nudgeTimer) {
          nudgeTimer = setTimeout(() => {
            nudgeTimer = null;
            nudge.value++;
          }, AUTO_MS * n);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [a, file, again]);
  return got && got.file === file ? got.value : undefined;
}

// ------------------------------------------------------- per-extra data

/** Where an extra's data stands. */
export type DataState = { state: 'loading' } | { state: 'ready'; data: unknown } | { state: 'failed'; at: number; tries: number };

/** By extra id. Components that read it re-render when an extra finishes
 * loading or fails. */
const states = signal<ReadonlyMap<string, DataState>>(new Map());
/** After a failed load, wait this long before trying again by itself: the
 * first wait, growing with each failure. */
const RETRY_MS = 10_000;
/** Failed loads try again by themselves this many times in all. */
const AUTO_LOADS = 6;
/** What each failed extra was loading for, to try it again. */
const failedWith = new Map<string, { x: AnyExtra; a: Atlas; timer: ReturnType<typeof setTimeout> | null }>();

/** Try every failed extra again now. */
function retryExtras(): void {
  for (const [id, f] of [...failedWith]) {
    failedWith.delete(id);
    if (f.timer) clearTimeout(f.timer);
    const s = states.peek().get(id);
    if (s?.state !== 'failed') continue;
    put(id, { ...s, at: 0 });
    ensureData(f.x, f.a);
  }
}

function put(id: string, s: DataState): void {
  const next = new Map(states.peek());
  next.set(id, s);
  states.value = next;
}

/** The extra's data state, or undefined before anything asked for it.
 * Reading it subscribes the caller. */
export function dataState(x: AnyExtra): DataState | undefined {
  return states.value.get(x.id);
}

/** Start loading an extra's data unless it is loaded, loading, or failed
 * too recently (RETRY_MS, longer after each failure). Call it from an effect,
 * not during render. */
export function ensureData(x: AnyExtra, a: Atlas): void {
  const s = states.peek().get(x.id);
  const tries = s?.state === 'failed' ? s.tries : 0;
  if (s && (s.state !== 'failed' || Date.now() - s.at < RETRY_MS * tries)) return;
  put(x.id, { state: 'loading' });
  let p: Promise<unknown>;
  try {
    p = Promise.resolve(x.load(a));
  } catch (e) {
    p = Promise.reject(e);
  }
  p.then(
    (data) => put(x.id, { state: 'ready', data }),
    (e) => {
      put(x.id, { state: 'failed', at: Date.now(), tries: tries + 1 });
      // Try again by itself after a while (the note simply shows once it
      // loads), sooner when the connection comes back (retryFailed).
      const prev = failedWith.get(x.id);
      if (prev?.timer) clearTimeout(prev.timer);
      const timer =
        tries + 1 < AUTO_LOADS
          ? setTimeout(() => {
              failedWith.delete(x.id);
              const now = states.peek().get(x.id);
              if (now?.state !== 'failed') return;
              put(x.id, { ...now, at: 0 });
              ensureData(x, a);
            }, RETRY_MS * (tries + 1))
          : null;
      failedWith.set(x.id, { x, a, timer });
      // Quiet for readers: the note simply does not show.
      if (import.meta.env.DEV) console.warn(`[extras] ${x.id}: load() failed, so its note is hidden.`, e);
    },
  );
}
