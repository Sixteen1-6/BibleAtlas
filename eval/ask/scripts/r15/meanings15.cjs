// node trace15.cjs <messages.json> <out.json>: for each message, the matcher's top 8 meanings with likelihoods,
// whether the model was used, and the word router's top 3 routes with their scores (PORT, default 5191).
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const [inp, outp] = process.argv.slice(2);
const qs = JSON.parse(fs.readFileSync(inp, 'utf8')).map((x) => (typeof x === 'string' ? { q: x } : x));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + (process.env.PORT || '5191') + '/#v=John.3.16', { waitUntil: 'networkidle' });
  await page.waitForSelector('.searchbox', { timeout: 120000 });
  const res = await page.evaluate(async ({ qs, limit }) => {
    const S = await import('/src/state.ts');
    while (!S.atlas.value) await new Promise((r) => setTimeout(r, 200));
    const a = S.atlas.value;
    const A = await import('/src/ui/ask/ask.ts');
    const R = await import('/src/ui/ask/route.ts');
    const M = await import('/src/ui/ask/meaning.ts');
    const ix = await A.loadAsk(a);
    await R.loadSignals(a).catch(() => null);
    await M.loadMeaning(a);
    for (let i = 0; i < 100 && M.meaningOf && !M.meaningOf('test'); i++) await new Promise((r) => setTimeout(r, 200));
    const out = [];
    for (const item of qs) {
      const ss = M.meanings(ix, item.q, limit);
      const rs = R.routes(ix, item.q, 3);
      out.push({ q: item.q, model: M.usesModel(ix, item.q), meanings: ss.map((s) => [s.q.id, Math.round(s.p * 1000) / 1000]),
        routes: rs.map((r) => ({ id: r.q.id, said: r.said, covers: r.covers, score: Math.round(r.score * 1000) / 1000 })) });
    }
    return out;
  }, { qs, limit: +(process.env.LIMIT || 8) });
  fs.writeFileSync(outp, JSON.stringify(res, null, 1));
  console.log('traced', res.length);
  await browser.close();
})();
