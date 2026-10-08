// The BSB as plain text, one line per verse (data/bsb.txt, about 1.2 MB
// compressed). Search loads it on first use to rank phrases by word order and
// to show result previews without fetching every book's study data.

import { type Atlas, DATA_BASE } from './atlas';

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
