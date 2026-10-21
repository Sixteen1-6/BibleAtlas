// Gate G, rule 8 of AUDIT-FIXES-PLAN.md: Ask the Bible and the search box must
// read the same before and after a module. This captures, for the fixed list in
// same-ask-queries.json, the text of each Ask sheet (opened at Deep, so every
// tie reason shows) and of the search palette's rows and footer, from one
// running copy of the site. Run it on the module's base and on its commit, then
// compare the two files (`--compare a.json b.json`).
//
// Usage:
//   PLAYWRIGHT_DIR=<folder holding node_modules/playwright> node ask-search-capture.mjs <site url> <out.json>
//   node ask-search-capture.mjs --compare <base.json> <module.json>
// The site url is a vite preview of a build (http://localhost:4180) or the
// live site when it serves the base commit (check data/meta.json's buildId).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

if (process.argv[2] === '--compare') {
  const [a, b] = [process.argv[3], process.argv[4]].map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  let same = 0;
  const differ = [];
  for (const kind of ['ask', 'search']) {
    for (const [k, v] of Object.entries(a[kind])) {
      if (b[kind][k] === v) same++;
      else differ.push(`${kind} ${k}`);
    }
  }
  const empty = [...Object.entries(a.ask), ...Object.entries(a.search)].filter(([, v]) => !v.trim()).map(([k]) => k);
  console.log(JSON.stringify({ same, differ, emptyInBase: empty }, null, 1));
  process.exit(differ.length || empty.length ? 1 : 0);
}

const base = process.argv[2].replace(/\/$/, '');
const out = process.argv[3];
const list = JSON.parse(fs.readFileSync(path.join(here, 'same-ask-queries.json'), 'utf8'));
const pwDir = process.env.PLAYWRIGHT_DIR;
const { chromium } = pwDir ? await import(pathToFileURL(path.join(pwDir, 'node_modules', 'playwright', 'index.mjs')).href) : await import('playwright');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('atlas.depth', 'deep');
    localStorage.setItem('atlas.welcome', 'hidden');
  } catch {}
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const result = { site: base, at: new Date().toISOString(), buildId: null, ask: {}, search: {}, errors };

/** Wait until an element's text stops changing (data arrives in pieces). */
async function settled(read) {
  let last = '';
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250);
    const now = await read();
    if (now && now === last) return now;
    last = now;
  }
  return last;
}

await page.goto(`${base}/`);
await page.waitForSelector('.searchbox', { timeout: 120000 });
result.buildId = await page.evaluate(async () => (await (await fetch(`${location.pathname.replace(/\/$/, '')}/data/meta.json?t=${Date.now()}`)).json()).buildId);

for (const id of list.ask) {
  await page.goto(`${base}/#ask=${encodeURIComponent(id)}`);
  await page.reload();
  try {
    await page.waitForSelector('.xt-panel .xt-body', { timeout: 60000 });
    result.ask[id] = await settled(() => page.evaluate(() => document.querySelector('.xt-panel')?.innerText ?? ''));
  } catch (e) {
    result.ask[id] = `NOT OPENED: ${String(e).split('\n')[0]}`;
  }
}

for (const q of list.search) {
  await page.goto(`${base}/`);
  await page.reload();
  await page.waitForSelector('.searchbox', { timeout: 60000 });
  await page.click('.searchbox');
  await page.fill('.palette input', q);
  result.search[q] = await settled(() => page.evaluate(() => document.querySelector('.palette ul')?.innerText + '\n--\n' + (document.querySelector('.palette .foot')?.innerText ?? '')));
}

await browser.close();
result.sha256 = crypto.createHash('sha256').update(JSON.stringify([result.ask, result.search])).digest('hex');
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log(JSON.stringify({ buildId: result.buildId, ask: Object.keys(result.ask).length, search: Object.keys(result.search).length, errors: errors.length, sha256: result.sha256 }));
