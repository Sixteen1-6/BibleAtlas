// node run3.cjs <[{q,id}].json> <out.json>: the chain prepared question `id` would show for each question (run2's shape).
// (from run2.cjs:) what the Ask sheet shows for each question, as the
// site does it: the help line; a prepared question asked in its own words; else (new site) the
// prepared question the router opens; else the gathered verses. Up to 8 shown verses each.
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
  const res = await page.evaluate(async ({ qs, lean, open, meant }) => {
    const S = await import('/src/state.ts');
    while (!S.atlas.value) await new Promise((r) => setTimeout(r, 200));
    const a = S.atlas.value;
    const A = await import('/src/ui/ask/ask.ts');
    const G = await import('/src/ui/ask/gather.ts');
    const P = await import('/src/data/plain.ts');
    const L = await import('/src/data/atlas.ts');
    const D = await import('/src/ui/extras/data.ts');
    let R = null;
    try { R = await import('/src/ui/ask/route.ts'); } catch {}
    if (lean && G.LEAN) Object.assign(G.LEAN, lean);
    if (open && R) Object.assign(R.OPEN, open);
    const ix = await A.loadAsk(a);
    if (R && R.loadSignals) await R.loadSignals(a).catch(() => null);
    try { const M = await import('/src/ui/ask/meaning.ts'); await M.loadMeaning(a); } catch {}
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
    const chainOf = async (q) => (q.chain ? q.chain : (await D.loadJson(a, `ask/q/${q.id}.json`)).chain);
    const shownChain = async (q) => (await chainOf(q)).map((p) => ({ ref: L.label(a, p.r[0]) + (p.r[1] > p.r[0] ? '-' + L.label(a, p.r[1]).split(':').pop() : ''), v: p.r[0], text: p.w ?? texts.slice(p.r[0], p.r[1] + 1).join(' '), context: ctx(p.r[0], p.r[1]) }));
    const res = [];
    const byId = new Map(ix.questions.map((q) => [q.id, q]));
    for (const item of qs) {
      const q = byId.get(item.id);
      if (!q) { res.push({ q: item.q, how: 'missing', shown: [] }); continue; }
      res.push({ q: item.q, how: 'alt', chain: q.id, asked: q.q, shown: await shownChain(q) });
    }
    return res;
  }, { qs, lean: process.env.LEAN ? JSON.parse(process.env.LEAN) : null, open: process.env.OPEN ? JSON.parse(process.env.OPEN) : null, meant: null });
  fs.writeFileSync(outp, JSON.stringify(res, null, 1));
  const c = {};
  for (const r of res) c[r.how] = (c[r.how] || 0) + 1;
  console.log('questions:', res.length, JSON.stringify(c), 'errors:', errors);
  await browser.close();
})();
