// ESV text through the server-side proxy (server/esv.mjs). The key never
// reaches the browser. To stay within Crossway's limits this client keeps at
// most two chapters in memory and never stores ESV text anywhere else.

export interface EsvChapter {
  verses: Record<string, string>;
  copyright: string;
}

const MAX_CHAPTERS = 2;
const cache = new Map<string, Promise<EsvChapter>>();

export function loadEsvChapter(book: number, chapter: number): Promise<EsvChapter> {
  const key = `${book}:${chapter}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const p = fetch(`/api/esv?book=${book}&chapter=${chapter}`).then(async (r) => {
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error ?? `ESV request failed (${r.status})`);
    return body as EsvChapter;
  });
  p.catch(() => cache.delete(key));
  cache.set(key, p);
  while (cache.size > MAX_CHAPTERS) cache.delete(cache.keys().next().value!);
  return p;
}
