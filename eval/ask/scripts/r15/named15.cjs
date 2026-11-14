// node named15.cjs <questions.json> <out.json>: for each message that names a book or chapter, what it names
// (books.ts) and, for every verse a cache label could touch, its kind: a cited verse, 1 or 2 verses from one,
// the rest of a named chapter, a cross-reference of a cited verse (with its votes) or of a verse of the chapter.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const [inp, outp] = process.argv.slice(2);
const qs = JSON.parse(fs.readFileSync(inp, 'utf8')).map((x) => (typeof x === 'string' ? { q: x } : x));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + (process.env.PORT || '5191') + '/#v=John.3.16', { waitUntil: 'networkidle' });
  await page.waitForSelector('.searchbox', { timeout: 120000 });
  const res = await page.evaluate(async ({ qs }) => {
    const S = await import('/src/state.ts');
    while (!S.atlas.value) await new Promise((r) => setTimeout(r, 200));
    const a = S.atlas.value;
    const B = await import('/src/ui/ask/books.ts');
    const L = await import('/src/data/atlas.ts');
    const out = [];
    for (const item of qs) {
      let rest = item.q.toLowerCase().replace(/\b(\p{L}+)['’]s\b/gu, '$1').replace(/[’‘']/g, '');
      rest = rest.replace(B.CITE, (_, w, c, v, t) => `${w} ${c} v${v}${t ? ` w${t}` : ''}`);
      const toks = rest.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      const { named } = B.namedBooks(a, toks);
      if (!named.length) continue;
      const cites = [], chapters = [], books = [];
      for (const b of named) (b.verse ? cites : b.chapter ? chapters : books).push([b.from, b.to]);
      const xref = {};
      for (const [f, t] of cites) for (let u = f; u < t; u++) {
        for (let e = a.xOff[u]; e < a.xOff[u + 1]; e++) xref[L.label(a, a.xDst[e])] = Math.max(xref[L.label(a, a.xDst[e])] ?? 0, a.xVotes[e]);
        for (let k = a.xInOff[u]; k < a.xInOff[u + 1]; k++) { const e = a.xInEdge[k]; xref[L.label(a, a.xSrc[e])] = Math.max(xref[L.label(a, a.xSrc[e])] ?? 0, a.xVotes[e]); }
      }
      const lab = (rs) => rs.map(([f, t]) => [L.label(a, f), L.label(a, t - 1), f, t]);
      out.push({ q: item.q, cites: lab(cites), chapters: lab(chapters), books: lab(books), xref });
    }
    return out;
  }, { qs });
  fs.writeFileSync(outp, JSON.stringify(res));
  console.log('named', res.length, 'of', qs.length);
  await browser.close();
})();
