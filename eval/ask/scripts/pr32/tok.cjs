// node tok.cjs in.json out.json: the router's terms for each string of a JSON array
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
(async () => {
  const [inp, outp] = process.argv.slice(2);
  const xs = JSON.parse(fs.readFileSync(inp, 'utf8'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5191/#v=John.3.16', { waitUntil: 'networkidle' });
  await page.waitForSelector('.searchbox', { timeout: 120000 });
  const out = await page.evaluate(async (xs) => {
    const R = await import('/src/ui/ask/route.ts');
    return xs.map((s) => [...R.terms(s)]);
  }, xs);
  fs.writeFileSync(outp, JSON.stringify(out));
  console.log(out.length, 'tokenized');
  await browser.close();
})();
