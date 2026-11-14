// node trace13.cjs <questions.json> <out.json>: for each message that is not the help page or an exact
// phrasing, the matcher's best sense and its p, whether the model was used, whether that answer holds a
// cited verse, and what the word router would open; plus each candidate answer's first 6 parts.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const [inp, outp] = process.argv.slice(2);
const qs = JSON.parse(fs.readFileSync(inp, 'utf8')).map((x) => (typeof x === 'string' ? { q: x } : x));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + (process.env.PORT || '5192') + '/#v=John.3.16', { waitUntil: 'networkidle' });
  await page.waitForSelector('.searchbox', { timeout: 120000 });
  const res = await page.evaluate(async ({ qs }) => {
    const S = await import('/src/state.ts');
    while (!S.atlas.value) await new Promise((r) => setTimeout(r, 200));
    const a = S.atlas.value;
    const A = await import('/src/ui/ask/ask.ts');
    const R = await import('/src/ui/ask/route.ts');
    const M = await import('/src/ui/ask/meaning.ts');
    const B = await import('/src/ui/ask/books.ts').catch(() => null);
    const L = await import('/src/data/atlas.ts');
    const ix = await A.loadAsk(a);
    await R.loadSignals(a).catch(() => null);
    await M.loadMeaning(a);
    for (let i = 0; i < 100 && M.meaningOf && !M.meaningOf('test'); i++) await new Promise((r) => setTimeout(r, 200));
    const holds = (q, vs) => vs.some((v) => q.r.some(([s, e]) => v >= s && v <= e));
    const out = [], ids = new Map();
    for (const item of qs) {
      const rows = A.matchAsk(ix, item.q);
      if (rows[0]?.kind === 'care' || A.isCare(item.q) || rows[0]?.kind === 'question') continue;
      const cited = B && B.citedVerses ? B.citedVerses(a, item.q) : [];
      const fits = (q) => !cited.length || holds(q, cited);
      const ss = M.meanings(ix, item.q, 2);
      const model = M.usesModel(ix, item.q);
      const [best, next] = R.routes(ix, item.q, 2);
      let words = null;
      if (best && best.said >= R.OPEN.said && best.covers >= R.OPEN.covers && best.score >= R.OPEN.score && !(next && best.score - next.score < R.OPEN.margin && next.said >= R.OPEN.said) && R.couldMean(ix, item.q, best.q) && fits(best.q)) words = best.q.id;
      const s = ss[0];
      out.push({ q: item.q, sense: s ? s.q.id : null, p: s ? s.p : 0, p2: ss[1] ? ss[1].p : 0, model, fits: s ? fits(s.q) : true, cited: cited.length, words });
      for (const q of [s && s.q, best && best.q]) if (q && !ids.has(q.id)) ids.set(q.id, q);
    }
    const chains = {};
    for (const [id, q] of ids) {
      const d = await A.questionData(a, q);
      chains[id] = d.chain.slice(0, 6).map((p) => (p.r[0] === p.r[1] ? L.label(a, p.r[0]) : L.label(a, p.r[0]) + '-' + L.label(a, p.r[1]).split(':').pop()));
    }
    return { out, chains };
  }, { qs });
  fs.writeFileSync(outp, JSON.stringify(res));
  console.log('traced', res.out.length, 'answers', Object.keys(res.chains).length);
  await browser.close();
})();
