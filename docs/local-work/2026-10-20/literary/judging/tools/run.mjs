// run.mjs jobs.json : one headless Chrome, jobs run one after another, browser closed at the end.
// Each job: { name, file, hash, query, w, h, scheme, full, steps: [ {click: selector|text}, {wait: ms}, {eval: js} ], dump: true, shot: true }
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const LIT = path.resolve(here, '..', '..');
const OUT = process.env.OUTDIR ? path.resolve(process.env.OUTDIR) : path.resolve(here, '..', 'shots-reader');
const DUMP = path.resolve(here, 'out');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(DUMP, { recursive: true });

const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--disable-extensions', '--js-flags=--max-old-space-size=256'],
});
try {
  for (const j of jobs) {
    const ctx = await browser.newContext({
      viewport: { width: j.w || 1440, height: j.h || 900 },
      colorScheme: j.scheme || 'light',
      deviceScaleFactor: 1,
      isMobile: (j.w || 1440) < 700,
      hasTouch: (j.w || 1440) < 700,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    const url = 'file:///' + path.join(LIT, j.file).replace(/\\/g, '/') + (j.query ? '?' + j.query : '') + (j.hash ? '#' + j.hash : '');
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(j.settle || 900);
    const log = [];
    for (const s of j.steps || []) {
      try {
        if (s.click) {
          const loc = s.click.startsWith('text=') || s.click.startsWith('role=') ? page.locator(s.click) : page.locator(s.click);
          await loc.nth(s.nth || 0).click({ timeout: 3000 });
          log.push('clicked ' + s.click);
        }
        if (s.scrollTo) {
          const ok = await page.evaluate(([sel, text]) => {
            const els = [...document.querySelectorAll(sel)].filter((e) => !text || (e.innerText || '').includes(text));
            const e = els.find((x) => x.getClientRects().length) || els[0];
            if (!e) return false;
            e.scrollIntoView({ block: 'start' });
            return true;
          }, [s.scrollTo.sel, s.scrollTo.text || '']);
          log.push('scrollTo ' + JSON.stringify(s.scrollTo) + ' ' + ok);
          await page.waitForTimeout(250);
        }
        if (s.clickText) {
          const ok = await page.evaluate(([sel, text]) => {
            const els = [...document.querySelectorAll(sel)].filter((e) => (e.innerText || e.getAttribute('aria-label') || '').includes(text) && e.getClientRects().length);
            if (!els.length) return false;
            els[0].click();
            return true;
          }, [s.clickText.sel, s.clickText.text]);
          log.push('clickText ' + JSON.stringify(s.clickText) + ' ' + ok);
          await page.waitForTimeout(s.clickText.wait || 500);
        }
        if (s.eshot) {
          await page.locator(s.esel || '#frame').first().screenshot({ path: path.join(OUT, s.eshot + '.png') });
          log.push('eshot ' + s.eshot);
        }
        if (s.etext) {
          const t = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => e.innerText).join('\n-----\n'), s.tsel || '#frame');
          fs.writeFileSync(path.join(DUMP, s.etext + '.txt'), t);
          log.push('etext ' + s.etext);
        }
        if (s.wait) await page.waitForTimeout(s.wait);
        if (s.eval) log.push('eval: ' + JSON.stringify(await page.evaluate(s.eval)).slice(0, 4000));
        if (s.shot) {
          await page.screenshot({ path: path.join(OUT, s.shot + '.png'), fullPage: !!s.full });
          log.push('shot ' + s.shot);
        }
        if (s.dump) {
          const t = await page.evaluate(() => document.body.innerText);
          fs.writeFileSync(path.join(DUMP, s.dump + '.txt'), t);
          log.push('dump ' + s.dump);
        }
      } catch (e) { log.push('STEP FAIL ' + JSON.stringify(s) + ' ' + e.message.split('\n')[0]); }
    }
    if (j.shot && j.esel) await page.locator(j.esel).first().screenshot({ path: path.join(OUT, j.name + '.png') });
    else if (j.shot) await page.screenshot({ path: path.join(OUT, j.name + '.png'), fullPage: !!j.full });
    if (j.dump) fs.writeFileSync(path.join(DUMP, j.name + '.txt'), await page.evaluate(() => document.body.innerText));
    if (j.controls) {
      const c = await page.evaluate(() => [...document.querySelectorAll('button, a, [role=button], [tabindex="0"]')]
        .filter((e) => e.offsetParent !== null || e.getClientRects().length)
        .map((e) => `${e.tagName.toLowerCase()} | ${(e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 80)} | ${e.getAttribute('href') || ''} | ${[...e.attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.name + '=' + a.value).join(' ')}`));
      fs.writeFileSync(path.join(DUMP, j.name + '.controls.txt'), c.join('\n'));
    }
    const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight }));
    console.log(j.name, JSON.stringify(ov), errors.length ? errors.join(' || ').slice(0, 600) : '', log.length ? '\n  ' + log.join('\n  ') : '');
    await ctx.close();
  }
} finally {
  await browser.close();
}
