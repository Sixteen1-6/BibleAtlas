// node run.cjs <questions.json> <out.json> [K]
// questions.json: [{q, id?}] — id set evaluates a prepared question as the site shows it unapproved.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const [inp, outp, K = '12'] = process.argv.slice(2);
const qs = JSON.parse(fs.readFileSync(inp, 'utf8'));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://127.0.0.1:' + (process.env.PORT || '5191') + '/#v=John.3.16', { waitUntil: 'networkidle' });
  await page.waitForSelector('.searchbox', { timeout: 120000 });
  const res = await page.evaluate(async ({ qs, K }) => {
    const S = await import('/src/state.ts');
    while (!S.atlas.value) await new Promise((r) => setTimeout(r, 200));
    const a = S.atlas.value;
    const A = await import('/src/ui/ask/ask.ts');
    const G = await import('/src/ui/ask/gather.ts');
    const P = await import('/src/data/plain.ts');
    const L = await import('/src/data/atlas.ts');
    const ix = await A.loadAsk(a);
    const texts = await P.loadPlainText(a);
    const loc = (v) => { const l = L.locate(a, v); return `${l.book}:${l.chapter}`; };
    const ctx = (v) => {
      const out = [];
      for (let d = -2; d <= 2; d++) {
        const u = v + d;
        if (u < 0 || u >= a.n || loc(u) !== loc(v)) continue;
        out.push(`${d === 0 ? '>>' : '  '} ${L.label(a, u)} ${texts[u]}`);
      }
      return out.join('\n');
    };
    const res = [];
    for (const item of qs) {
      const rows = A.matchAsk(ix, item.q);
      // A prepared question asked in its own words opens its chain, not gathered verses.
      if (rows[0]?.kind === 'question') {
        res.push({ q: item.q, chain: rows[0].q.id, asked: rows[0].q.q, parts: rows[0].q.chain.map((p) => ({ ref: L.label(a, p.r[0]) + (p.r[1] > p.r[0] ? '-' + L.label(a, p.r[1]).split(':').pop() : ''), text: p.w ?? texts.slice(p.r[0], p.r[1] + 1).join(' ') })), rows: [], top: [], all: [] });
        continue;
      }
      if (rows[0]?.kind === 'care') { res.push({ q: item.q, care: true, rows: ['care'], top: [], all: [] }); continue; }
      const t0 = performance.now();
      const g = await G.gather(a, item.q);
      const ms = Math.round(performance.now() - t0);
      res.push({
        q: item.q, ms,
        rows: rows.map((r) => (r.kind === 'question' ? `Q: ${r.q.q}` : r.kind === 'topic' ? `T: ${r.title}` : r.kind)),
        n: g.verses.length,
        concepts: g.concepts.map((c) => `${c.word}[${c.found}]`).join(' '),
        subjects: g.subjects, questions: g.questions,
        top: g.verses.slice(0, K).map((v) => ({ v, ref: L.label(a, v), text: texts[v], context: ctx(v) })),
        all: g.verses.slice(0, 120).map((v) => L.label(a, v)),
      });
    }
    return res;
  }, { qs, K: +K });
  fs.writeFileSync(outp, JSON.stringify(res, null, 1));
  console.log('questions:', res.length, 'errors:', errors, 'avg ms:', Math.round(res.reduce((s, r) => s + r.ms, 0) / res.length));
  await browser.close();
})();
