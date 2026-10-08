// Data for extras: JSON files the atlas build writes into web/public/data/, and
// the per-extra cache of what each extra's load() returned.

import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { type Atlas, DATA_BASE } from '../../data/atlas';
import type { AnyExtra } from './registry';

const files = new Map<string, Promise<unknown>>();

/** Fetch web/public/data/<file> as JSON, e.g. loadJson(a, 'extras/quotes.json').
 * The site's base path (/BibleAtlas/ on GitHub Pages) and the build id are
 * added for you, so a new build is never served from a stale cache. Cached:
 * asking twice fetches once. Rejects if the file is missing or broken, and a
 * later call tries again. */
export function loadJson<T>(a: Atlas, file: string): Promise<T> {
  const url = `${DATA_BASE}${file.replace(/^\/+/, '')}?${a.version}`;
  let p = files.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    files.set(url, p);
    p.catch(() => files.delete(url));
  }
  return p;
}

/** For a Panel that needs a heavier file only once it opens: undefined while
 * loading, null if it failed, then the parsed JSON. Pass null to load nothing. */
export function useJson<T>(a: Atlas, file: string | null): T | null | undefined {
  const [got, setGot] = useState<{ file: string; value: T | null } | null>(null);
  useEffect(() => {
    if (file === null) return;
    let live = true;
    loadJson<T>(a, file).then(
      (value) => live && setGot({ file, value }),
      () => live && setGot({ file, value: null }),
    );
    return () => {
      live = false;
    };
  }, [a, file]);
  return got && got.file === file ? got.value : undefined;
}

// ------------------------------------------------------- per-extra data

/** Where an extra's data stands. */
export type DataState = { state: 'loading' } | { state: 'ready'; data: unknown } | { state: 'failed'; at: number };

/** By extra id. Components that read it re-render when an extra finishes
 * loading or fails. */
const states = signal<ReadonlyMap<string, DataState>>(new Map());
/** After a failed load, wait this long before trying again. */
const RETRY_MS = 30_000;

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

/** Start loading an extra's data unless it is loaded, loading, or failed less
 * than RETRY_MS ago. Call it from an effect, not during render. */
export function ensureData(x: AnyExtra, a: Atlas): void {
  const s = states.peek().get(x.id);
  if (s && (s.state !== 'failed' || Date.now() - s.at < RETRY_MS)) return;
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
      put(x.id, { state: 'failed', at: Date.now() });
      // Quiet for readers: the note simply does not show.
      if (import.meta.env.DEV) console.warn(`[extras] ${x.id}: load() failed, so its note is hidden.`, e);
    },
  );
}
