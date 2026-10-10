// Loads the KJV and ASV search text and indexes their words, with the folded
// words of the BSB (fold.ts), off the main thread: indexing whole Bibles takes
// long enough to stall typing.

import { buildExtra } from './search';

interface Req {
  names: string[];
  urls: string[];
  /** The BSB plain text; the browser has it cached from the search preview. */
  baseUrl: string;
}

self.onmessage = async (e: MessageEvent<Req>) => {
  try {
    const [base, ...lines] = await Promise.all(
      [e.data.baseUrl, ...e.data.urls].map(async (u) => {
        const r = await fetch(u);
        if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`);
        const ls = (await r.text()).split('\n');
        if (ls[ls.length - 1] === '') ls.pop();
        return ls;
      }),
    );
    const x = buildExtra(e.data.names, lines, base);
    // Send the index as one flat list so it crosses threads as two buffers.
    const words = [...x.index.keys()];
    const off = new Uint32Array(words.length + 1);
    words.forEach((w, i) => (off[i + 1] = off[i] + x.index.get(w)!.length));
    const verses = new Uint32Array(off[words.length]);
    words.forEach((w, i) => verses.set(x.index.get(w)!, off[i]));
    self.postMessage({ ok: true, names: x.names, lines, words, off, verses, apart: [...x.apart] }, { transfer: [off.buffer, verses.buffer] });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
