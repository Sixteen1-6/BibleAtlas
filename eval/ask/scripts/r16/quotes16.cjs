// node quotes16.cjs <questions.json> <out.json>: the verses each message quotes, as quote.ts finds them
// (BSB, KJV and ASV loaded first); KNOBS='{"QUOTE":{...}}' sets its knobs. PORT as run14.cjs.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const [inp, outp] = process.argv.slice(2);
const qs = JSON.parse(fs.readFileSync(inp, 'utf8')).map((x) => (typeof x === 'string' ? x : x.q));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + (process.env.PORT || '5191') + '/#v=John.3.16', { waitUntil: 'networkidle' });
  await page.waitForSelector('.searchbox', { timeout: 120000 });
  const t0 = Date.now();
  const res = await page.evaluate(async ({ qs, knobs }) => {
    const S = await import('/src/state.ts');
    while (!S.atlas.value) await new Promise((r) => setTimeout(r, 200));
    const a = S.atlas.value;
    const P = await import('/src/data/plain.ts');
    const L = await import('/src/data/atlas.ts');
    const Q = await import('/src/ui/ask/quote.ts');
    if (knobs) Object.assign(Q.QUOTE, knobs.QUOTE || {});
    const texts = await P.loadPlainText(a);
    await P.loadExtraText(a);
    const t = performance.now();
    const out = qs.map((q) => ({ q, verses: Q.quotedVerses(a, q).map((v) => ({ v, ref: L.label(a, v), text: texts[v] })) }));
    return { out, ms: performance.now() - t };
  }, { qs, knobs: process.env.KNOBS ? JSON.parse(process.env.KNOBS) : null });
  fs.writeFileSync(outp, JSON.stringify(res.out, null, 1));
  console.log('messages', qs.length, 'quoting', res.out.filter((r) => r.verses.length).length, 'ms', res.ms.toFixed(0), 'seconds', ((Date.now() - t0) / 1000).toFixed(0));
  await browser.close();
})();
