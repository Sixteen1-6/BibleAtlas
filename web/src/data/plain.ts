// The BSB as plain text, one line per verse (data/bsb.txt, about 1.2 MB
// compressed). Search loads it on first use to rank phrases by word order and
// to show result previews without fetching every book's study data.

import { type Atlas, DATA_BASE } from './atlas';
import type { Extra } from './search';

let cache: Promise<string[]> | null = null;
let ready: string[] | null = null;

export function loadPlainText(a: Atlas): Promise<string[]> {
  if (!cache) {
    cache = fetch(`${DATA_BASE}bsb.txt?${a.version}`)
      .then((r) => {
        if (!r.ok) throw new Error(`bsb.txt: HTTP ${r.status}`);
        return r.text();
      })
      .then((t) => {
        const lines = t.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        ready = lines;
        return lines;
      });
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}

/** The plain text if it has already loaded. */
export function plainText(): string[] | null {
  return ready;
}

// ---------------------------------------------------------------- other translations

let extraCache: Promise<Extra> | null = null;
let extraReady: Extra | null = null;

/** KJV and ASV wording for search (data/search/*.txt), loaded and indexed in
 *  a worker. Search works without it and gets better once it arrives. */
export function loadExtraText(a: Atlas): Promise<Extra> {
  if (!extraCache) {
    extraCache = new Promise<Extra>((resolve, reject) => {
      const names = ['KJV', 'ASV'];
      const urls = ['kjv', 'asv'].map((id) => new URL(`${DATA_BASE}search/${id}.txt?${a.version}`, location.href).href);
      const w = new Worker(new URL('./extra.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e) => {
        w.terminate();
        const d = e.data;
        if (!d.ok) return reject(new Error(d.error));
        const index = new Map<string, Uint32Array>();
        (d.words as string[]).forEach((word, i) => index.set(word, d.verses.subarray(d.off[i], d.off[i + 1])));
        extraReady = { names: d.names, lines: d.lines, index };
        resolve(extraReady);
      };
      w.onerror = (e) => {
        w.terminate();
        reject(new Error(e.message));
      };
      w.postMessage({ names, urls });
    });
    extraCache.catch(() => {
      extraCache = null;
    });
  }
  return extraCache;
}

/** The other translations' text if it has already loaded. */
export function extraText(): Extra | null {
  return extraReady;
}
