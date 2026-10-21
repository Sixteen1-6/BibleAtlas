// AF-BT check: no NET text in the build output or the service worker.
//
// Usage: node check-net-not-stored.mjs <worktree>
//
// Reads two NET chapters (Genesis 1 and John 3) live from the publisher's web
// service into memory only, the same way the app does, and looks for every
// verse of them in web/public/data, web/dist (if built) and web/public/sw.js.
// A verse the NET words exactly like the BSB, or too short to tell, is not
// searched (it would match the BSB). Nothing of the NET is written anywhere:
// the script prints only counts and verse numbers.

import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('usage: node check-net-not-stored.mjs <worktree>');

async function chapter(passage) {
  const url = `https://labs.bible.org/api/?passage=${encodeURIComponent(passage)}&type=json&formatting=plain`;
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`${passage}: HTTP ${r.status}`);
  return (await r.json()).map((v) => ({ ref: `${passage}:${v.verse}`, text: String(v.text).replace(/\s+/g, ' ').trim() }));
}

function files(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, out);
    else out.push(p);
  }
  return out;
}

const targets = [path.join(root, 'web/public/data'), path.join(root, 'web/dist'), path.join(root, 'web/public/sw.js')];
const list = targets.flatMap((t) => (fs.existsSync(t) && fs.statSync(t).isFile() ? [t] : files(t)));
const texts = list.filter((f) => !/\.(bin|wasm|png|jpg|woff2?|ico)$/i.test(f));
const bsbPath = path.join(root, 'web/public/data/bsb.txt');
const bsb = fs.existsSync(bsbPath) ? fs.readFileSync(bsbPath, 'utf8') : '';

const verses = [...(await chapter('Genesis 1')), ...(await chapter('John 3'))];
// A probe is a run of 70 characters from the middle of the verse, so quotes
// and punctuation at the edges do not matter, long enough that an older
// translation quoted by a writer (the KJV says John 3:17 much as the NET does)
// does not match by chance. A probe the BSB also has is not used.
const LEN = 70;
const probes = [];
for (const v of verses) {
  if (v.text.length < LEN + 10) continue;
  const mid = Math.floor((v.text.length - LEN) / 2);
  const p = v.text.slice(mid, mid + LEN);
  if (bsb.includes(p)) continue;
  probes.push({ ref: v.ref, p });
}

let hits = 0;
let bytes = 0;
for (const f of texts) {
  const s = fs.readFileSync(f, 'utf8');
  bytes += s.length;
  for (const { ref, p } of probes) {
    if (s.includes(p)) {
      hits++;
      console.log(`FOUND ${ref} in ${path.relative(root, f)}`);
    }
  }
}
console.log(`NET verses read live: ${verses.length}; probes (not shared with the BSB): ${probes.length}`);
console.log(`files searched: ${texts.length} (${(bytes / 1e6).toFixed(1)} MB of text) in ${targets.map((t) => path.relative(root, t)).join(', ')}`);
console.log(hits ? `FAIL: ${hits} NET passages found` : 'PASS: no NET text found');
process.exit(hits ? 1 : 0);
