// node tt.cjs out.json signals.json set.json...: router terms for every way, signal and typed text
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
(async () => {
  const [outp, sigf, ...sets] = process.argv.slice(2);
  const sig = sigf && sigf !== '-' ? JSON.parse(fs.readFileSync(sigf, 'utf8')) : {};
  const typed = [...new Set(sets.flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')).map((x) => (typeof x === 'string' ? x : x.q))))];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5191/#v=John.3.16', { waitUntil: 'networkidle' });
  await page.waitForSelector('.searchbox', { timeout: 120000 });
  const out = await page.evaluate(async ([typed, sig]) => {
    const S = await import('/src/state.ts');
    while (!S.atlas.value) await new Promise((r) => setTimeout(r, 200));
    const A = await import('/src/ui/ask/ask.ts');
    const R = await import('/src/ui/ask/route.ts');
    const ix = await A.loadAsk(S.atlas.value);
    const T = (s) => [...R.terms(s)];
    return {
      questions: ix.questions.map((q) => ({ id: q.id, title: T(q.q), ways: [q.q, ...q.also].map(T), sig: (sig[q.id] || []).map((s) => [s, T(s)]) })),
      typed: Object.fromEntries(typed.map((t) => [t, { terms: T(t), care: A.isCare(t), exact: A.exactQuestion(ix, t)?.id ?? null }])),
    };
  }, [typed, sig]);
  fs.writeFileSync(outp, JSON.stringify(out));
  console.log(out.questions.length, 'questions', Object.keys(out.typed).length, 'typed');
  await browser.close();
})();
