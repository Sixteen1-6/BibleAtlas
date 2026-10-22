// node rt.cjs questions.json out.json [index.json]: the top routes for each question
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
(async () => {
  const [inp, outp, ixfile] = process.argv.slice(2);
  const qs = JSON.parse(fs.readFileSync(inp, 'utf8')).map((x) => (typeof x === 'string' ? x : x.q));
  const ixj = ixfile ? JSON.parse(fs.readFileSync(ixfile, 'utf8')) : null;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + (process.env.PORT || '5191') + '/#v=John.3.16', { waitUntil: 'networkidle' });
  await page.waitForSelector('.searchbox', { timeout: 120000 });
  const out = await page.evaluate(async ([qs, ixj, topn, topn2]) => {
    const S = await import('/src/state.ts');
    while (!S.atlas.value) await new Promise((r) => setTimeout(r, 200));
    const A = await import('/src/ui/ask/ask.ts');
    const R = await import('/src/ui/ask/route.ts');
    const ix = ixj || (await A.loadAsk(S.atlas.value));
    if (R.loadSignals) await R.loadSignals(S.atlas.value).catch(() => null);
    let M = null;
    try { M = await import('/src/ui/ask/meaning.ts'); await M.loadMeaning(S.atlas.value); } catch (e) { M = null; }
    return qs.map((q) => ({ q, care: A.isCare(q), exact: A.exactQuestion(ix, q)?.id ?? null, open: R.route(ix, q)?.id ?? null, meant: M ? M.meanings(ix, q, +(topn2)).map((m) => ({ id: m.q.id, p: +m.p.toFixed(3) })) : [], top: R.routes(ix, q, topn).map((r) => ({ id: r.q.id, said: +r.said.toFixed(2), covers: +r.covers.toFixed(2), score: +r.score.toFixed(2), own: +(r.own ?? 0).toFixed(2), weight: +(r.weight ?? 0).toFixed(2) })) }));
  }, [qs, ixj, +(process.env.TOPN || 3), +(process.env.MTOP || 3)]);
  fs.writeFileSync(outp, JSON.stringify(out, null, 1));
  console.log('routed', out.filter((r) => r.open).length, 'of', out.length);
  await browser.close();
})();
