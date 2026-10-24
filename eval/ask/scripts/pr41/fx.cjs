// node fx.cjs in.json out.json: for each never-routed message, the gatherer's candidates and their features.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const [inp, outp] = process.argv.slice(2);
const qs = JSON.parse(fs.readFileSync(inp, 'utf8')).map((x) => (typeof x === 'string' ? x : x.q));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://127.0.0.1:' + (process.env.PORT || '5191') + '/#v=John.3.16', { waitUntil: 'networkidle' });
  await page.waitForSelector('.searchbox', { timeout: 120000 });
  const res = await page.evaluate(async ({ qs, mt }) => {
    const S = await import('/src/state.ts');
    while (!S.atlas.value) await new Promise((r) => setTimeout(r, 200));
    const a = S.atlas.value;
    const A = await import('/src/ui/ask/ask.ts');
    const G = await import('/src/ui/ask/gather_x.ts');
    const P = await import('/src/data/plain.ts');
    const L = await import('/src/data/atlas.ts');
    const R = await import('/src/ui/ask/route.ts');
    const ix = await A.loadAsk(a);
    await R.loadSignals(a).catch(() => null);
    const M = await import('/src/ui/ask/meaning.ts'); await M.loadMeaning(a);
    const texts = await P.loadPlainText(a);
    const loc = (v) => { const l = L.locate(a, v); return `${l.book}:${l.chapter}`; };
    const ctx = (v) => { const out = []; for (let d = -2; d <= 2; d++) { const u = v + d; if (u < 0 || u >= a.n || loc(u) !== loc(v)) continue; out.push(`${d === 0 ? '>>' : '  '} ${L.label(a, u)} ${texts[u]}`); } return out.join('\n'); };
    const res = [];
    for (const q of qs) {
      const rows = A.matchAsk(ix, q);
      if (rows[0]?.kind === 'care' || A.isCare(q)) { res.push({ q, how: 'care' }); continue; }
      if (rows[0]?.kind === 'question') { res.push({ q, how: 'exact', id: rows[0].q.id }); continue; }
      const r = R.route(ix, q);
      if (r) { res.push({ q, how: 'routed', id: r.id }); continue; }
      const g = await G.gatherX(a, q, mt);
      for (const f of g.feats) { f.ref = L.label(a, f.v); f.words = texts[f.v]; f.context = ctx(f.v); }
      res.push({ q, how: 'live', ...g, verses: g.verses.slice(0, 40) });
    }
    return res;
  }, { qs, mt: +(process.env.MT || 10) });
  fs.writeFileSync(outp, JSON.stringify(res));
  const c = {};
  for (const r of res) c[r.how] = (c[r.how] || 0) + 1;
  console.log('questions:', res.length, JSON.stringify(c), 'errors:', errors.slice(0, 3));
  await browser.close();
})();
