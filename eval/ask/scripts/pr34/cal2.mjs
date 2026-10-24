// node cal2.mjs '<configs>': held-out accuracy of matcher variants (bigrams, epochs, rate)
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const { createServer } = await import(process.env.ATLAS_REPO + '/web/node_modules/vite/dist/node/index.js');
const WEB = process.env.ATLAS_REPO + '/web';
const M = await import(WEB + '/scripts/ask-meaning.mjs');
const ASK = WEB + '/public/data/ask';
const rd = (f) => JSON.parse(readFileSync(f, 'utf8'));
const index = rd(ASK + '/index.json'), also = rd(ASK + '/also.json'), signals = rd(ASK + '/signals.json');
const examples = rd(WEB + '/../config/ask-examples.json').examples;
const server = await createServer({ root: WEB, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true } });
const words = await server.ssrLoadModule('/src/ui/ask/words.ts');
await server.close();
const C = index.questions.length;
// Ordered terms: each content word mapped as terms() maps it.
function seq(s) {
  const out = [];
  for (const w of words.contentWords(s)) { const t = words.terms(w); for (const x of t) out.push(x); }
  return out;
}
function feats(s, bi) {
  const u = words.terms(s);
  if (!bi) return u;
  const q = seq(s); const f = new Set(u);
  for (let i = 0; i + 1 < q.length; i++) f.add(q[i] + '_' + q[i + 1]);
  return f;
}
const configs = JSON.parse(process.argv[2] || '[{}]');
for (const cfg of configs) {
  const all = M.rows(index, also, signals, examples).map(([c, k, s]) => [c, k, feats(s, cfg.bi), s]);
  let n = 0; const held = [], train = [];
  for (const r of all) (r[1] === 'example' && n++ % 10 === 3 ? held : train).push(r);
  const opts = { ...M.TRAIN, ...cfg };
  const model = M.train(train.map(([c, k, t]) => [c, k, t]), C, opts);
  const w = M.prune(model, C, cfg.keep ?? M.KEEP);
  const gz = gzipSync(JSON.stringify(w)).length;
  let right = 0, top3 = 0, open = 0, openRight = 0, tot = 0, o7 = 0, o7r = 0;
  for (const [c, , ts] of held) {
    if (!ts.size) continue; tot++;
    const z = new Float64Array(C);
    for (const t of ts) { const e = w[t]; if (e) for (let k = 0; k < e.length; k += 2) z[e[k]] += e[k + 1] / M.SCALE; }
    const max = Math.max(...z); let s = 0; for (let k = 0; k < C; k++) s += z[k] = Math.exp(z[k] - max);
    const order = [...z.keys()].sort((a, b) => z[b] - z[a]);
    const top = order[0]; const p = z[top] / s;
    if (top === c) right++; if (order.slice(0, 3).includes(c)) top3++;
    if (p >= 0.8) { open++; if (top === c) openRight++; }
    if (p >= 0.7) { o7++; if (top === c) o7r++; }
  }
  console.log(JSON.stringify(cfg), `${(gz / 1e3).toFixed(0)} KB gz; held ${tot}: top1 ${(right / tot * 100).toFixed(1)}% top3 ${(top3 / tot * 100).toFixed(1)}%, >=.8 ${open} (${(openRight / open * 100).toFixed(1)}%), >=.7 ${o7} (${(o7r / o7 * 100).toFixed(1)}%)`);
}
