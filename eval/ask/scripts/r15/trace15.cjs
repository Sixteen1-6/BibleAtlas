// node trace15.cjs <questions.json> <out.json> [verses.bin]: for each message, how the Ask sheet answers it
// (care, exact, routed or gathered) and, when gathered, what FIT weighed for each verse (TRACE in gather.ts),
// with the word-meaning model's direction for the message (base64 Float32). With a third argument, also
// writes the model's direction for every verse of the BSB there (Float32, n x dims). PORT, default 5191.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const [inp, outp, vout] = process.argv.slice(2);
const qs = JSON.parse(fs.readFileSync(inp, 'utf8')).map((x) => (typeof x === 'string' ? { q: x } : x));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://127.0.0.1:' + (process.env.PORT || '5191') + '/#v=John.3.16', { waitUntil: 'networkidle' });
  await page.waitForSelector('.searchbox', { timeout: 120000 });
  const t0 = Date.now();
  const res = await page.evaluate(async ({ qs, more, verses }) => {
    const S = await import('/src/state.ts');
    while (!S.atlas.value) await new Promise((r) => setTimeout(r, 200));
    const a = S.atlas.value;
    const A = await import('/src/ui/ask/ask.ts');
    const G = await import('/src/ui/ask/gather.ts');
    const P = await import('/src/data/plain.ts');
    const L = await import('/src/data/atlas.ts');
    const R = await import('/src/ui/ask/route.ts');
    const M = await import('/src/ui/ask/meaning.ts');
    if (more) for (const [k, v] of Object.entries(more)) { const t = G[k] ?? R[k]; if (t) Object.assign(t, v); else throw new Error('no knob ' + k); }
    G.TRACE.on = true;
    const ix = await A.loadAsk(a);
    await R.loadSignals(a).catch(() => null);
    await M.loadMeaning(a);
    for (let i = 0; i < 100 && !M.meaningOf('test'); i++) await new Promise((r) => setTimeout(r, 200));
    const texts = await P.loadPlainText(a);
    const b64 = (f) => { const u = new Uint8Array(Float32Array.from(f).buffer); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
    const out = [];
    for (const item of qs) {
      const rows = A.matchAsk(ix, item.q);
      if (rows[0]?.kind === 'care' || A.isCare(item.q)) { out.push({ q: item.q, how: 'care' }); continue; }
      let q = rows[0]?.kind === 'question' ? rows[0].q : null;
      let how = q ? 'exact' : null;
      if (!q) { q = R.route(ix, item.q, a); how = q ? 'routed' : null; }
      if (q) { out.push({ q: item.q, how, chain: q.id }); continue; }
      const g = await G.gather(a, item.q);
      const tr = G.TRACE.rows[0];
      for (const r of tr.rows) r.ref = L.label(a, r.v);
      const e = M.meaningOf(item.q);
      out.push({ q: item.q, how: 'live', trace: tr, e: e ? b64(e) : null, shown: g.verses.slice(0, 10).map((v) => ({ ref: L.label(a, v), v })) });
    }
    let vb = null, dims = 0;
    if (verses) {
      const e0 = M.meaningOf('test');
      dims = e0.length;
      const all = new Float32Array(a.n * dims);
      for (let v = 0; v < a.n; v++) { const e = texts[v] ? M.meaningOf(texts[v]) : null; if (e) all.set(e, v * dims); }
      vb = b64(all);
    }
    return { out, vb, dims, n: a.n };
  }, { qs, more: process.env.KNOBS ? JSON.parse(process.env.KNOBS) : null, verses: !!vout });
  fs.writeFileSync(outp, JSON.stringify(res.out));
  if (vout) { fs.writeFileSync(vout, Buffer.from(res.vb, 'base64')); console.log('verses', res.n, 'dims', res.dims); }
  const c = {};
  for (const r of res.out) c[r.how] = (c[r.how] || 0) + 1;
  console.log('questions:', res.out.length, JSON.stringify(c), 'errors:', errors, 'seconds', ((Date.now() - t0) / 1000).toFixed(0));
  await browser.close();
})();
