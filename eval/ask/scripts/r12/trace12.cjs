// node run12.cjs <questions.json> <out.json>: what the Ask sheet shows for each message (help line,
// exact, routed, or gathered with up to N verses), as run2.cjs. MORE (JSON) sets gather's MORE;
// LIVEONLY=1 gathers every message without routing (for messages known to fall to gathering).
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const [inp, outp] = process.argv.slice(2);
const qs = JSON.parse(fs.readFileSync(inp, 'utf8')).map((x) => (typeof x === 'string' ? { q: x } : x));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://127.0.0.1:' + (process.env.PORT || '5191') + '/#v=John.3.16', { waitUntil: 'networkidle' });
  await page.waitForSelector('.searchbox', { timeout: 120000 });
  const t0 = Date.now();
  const res = await page.evaluate(async ({ process_trace, qs, more, liveOnly, N, ctxOn }) => {
    const S = await import('/src/state.ts');
    while (!S.atlas.value) await new Promise((r) => setTimeout(r, 200));
    const a = S.atlas.value;
    const A = await import('/src/ui/ask/ask.ts');
    const G = await import('/src/ui/ask/gather.ts');
    const P = await import('/src/data/plain.ts');
    const L = await import('/src/data/atlas.ts');
    const D = await import('/src/ui/extras/data.ts');
    const R = await import('/src/ui/ask/route.ts');
    const M = await import('/src/ui/ask/meaning.ts');
    if (more && G.MORE) Object.assign(G.MORE, more);
    if (process_trace) G.TRACE.on = true;
    const ix = await A.loadAsk(a);
    await R.loadSignals(a).catch(() => null);
    await M.loadMeaning(a);
    // wait for the model itself
    for (let i = 0; i < 100 && M.meaningOf && !M.meaningOf('test'); i++) await new Promise((r) => setTimeout(r, 200));
    const texts = await P.loadPlainText(a);
    const loc = (v) => { const l = L.locate(a, v); return `${l.book}:${l.chapter}`; };
    const ctx = (v, w) => {
      const out = [];
      for (let d = -2; d <= 2 + (w - v); d++) {
        const u = v + d;
        if (u < 0 || u >= a.n || loc(u) !== loc(v)) continue;
        out.push(`${u >= v && u <= w ? '>>' : '  '} ${L.label(a, u)} ${texts[u]}`);
      }
      return out.join('\n');
    };
    const res = [];
    for (const item of qs) {
      if (!liveOnly) {
        const rows = A.matchAsk(ix, item.q);
        if (rows[0]?.kind === 'care' || A.isCare(item.q)) { res.push({ q: item.q, how: 'care', shown: [] }); continue; }
        let q = rows[0]?.kind === 'question' ? rows[0].q : null;
        let how = q ? 'exact' : null;
        if (!q) { q = R.route(ix, item.q); how = q ? 'routed' : null; }
        if (q) { res.push({ q: item.q, how, chain: q.id }); continue; }
      }
      const g = await G.gather(a, item.q);
      const tr = G.TRACE.on ? G.TRACE.rows[0] : null;
      if (tr) for (const r of tr.rows) r.ref = L.label(a, r.v);
      res.push({ q: item.q, how: 'live', ...(tr ? { trace: tr } : {}), subjects: g.subjects, near: g.questions.slice(0, 3), shown: g.verses.slice(0, N).map((v) => ({ ref: L.label(a, v), v, text: texts[v], ...(ctxOn ? { context: ctx(v, v) } : {}) })) });
    }
    return res;
  }, { process_trace: !!process.env.TRACE, qs, more: process.env.MORE ? JSON.parse(process.env.MORE) : null, liveOnly: !!process.env.LIVEONLY, N: +(process.env.N || 10), ctxOn: !!process.env.CTX });
  fs.writeFileSync(outp, JSON.stringify(res, null, 1));
  const c = {};
  for (const r of res) c[r.how] = (c[r.how] || 0) + 1;
  console.log('questions:', res.length, JSON.stringify(c), 'errors:', errors, 'seconds', ((Date.now() - t0) / 1000).toFixed(0));
  await browser.close();
})();
