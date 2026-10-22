// node knn.mjs: held-out accuracy of a tf-idf nearest-neighbour matcher, alone and blended with the softmax
import { readFileSync } from 'node:fs';
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
const all = M.rows(index, also, signals, examples).map(([c, k, s]) => [c, k, words.terms(s), s]);
let n = 0; const held = [], train = [];
for (const r of all) (r[1] === 'example' && n++ % 10 === 3 ? held : train).push(r);
// idf over training texts
const df = new Map();
for (const [, , ts] of train) for (const t of ts) df.set(t, (df.get(t) ?? 0) + 1);
const N = train.length;
const idf = (t) => Math.log(1 + N / (df.get(t) ?? 0.5));
const vec = (ts) => { const v = new Map(); let s = 0; for (const t of ts) { const w = idf(t); v.set(t, w); s += w * w; } s = Math.sqrt(s) || 1; for (const [t, w] of v) v.set(t, w / s); return v; };
const inv = new Map();
const tv = train.map(([c, k, ts]) => vec(ts));
tv.forEach((v, i) => { for (const [t, w] of v) { let l = inv.get(t); if (!l) inv.set(t, (l = [])); l.push([i, w]); } });
// softmax model for blending
const model = M.train(train.map(([c, k, t]) => [c, k, t]), C, M.TRAIN);
const w = M.prune(model, C, M.KEEP);
function soft(ts) { const z = new Float64Array(C); for (const t of ts) { const e = w[t]; if (e) for (let k = 0; k < e.length; k += 2) z[e[k]] += e[k + 1] / M.SCALE; } const max = Math.max(...z); let s = 0; for (let k = 0; k < C; k++) s += z[k] = Math.exp(z[k] - max); for (let k = 0; k < C; k++) z[k] /= s; return z; }
const cfgs = JSON.parse(process.argv[2] || '[{"K":20,"a":2,"b":0}]');
for (const cfg of cfgs) {
  let r1 = 0, r3 = 0, tot = 0; const conf = [];
  for (const [c, , ts] of held) {
    if (!ts.size) continue; tot++;
    const q = vec(ts); const sim = new Map();
    for (const [t, wq] of q) for (const [i, wd] of inv.get(t) ?? []) sim.set(i, (sim.get(i) ?? 0) + wq * wd);
    const nb = [...sim].sort((x, y) => y[1] - x[1]).slice(0, cfg.K);
    const z = new Float64Array(C);
    for (const [i, s] of nb) z[train[i][0]] += Math.pow(s, cfg.a);
    let zs = 0; for (let k = 0; k < C; k++) zs += z[k]; if (zs) for (let k = 0; k < C; k++) z[k] /= zs;
    if (cfg.b) { const p = soft(ts); for (let k = 0; k < C; k++) z[k] = (1 - cfg.b) * z[k] + cfg.b * p[k]; }
    const order = [...z.keys()].sort((x, y) => z[y] - z[x]);
    if (order[0] === c) r1++; if (order.slice(0, 3).includes(c)) r3++;
    conf.push([z[order[0]], order[0] === c]);
  }
  conf.sort((x, y) => y[0] - x[0]);
  const at = (prec) => { let ok = 0, best = 0; for (let i = 0; i < conf.length; i++) { if (conf[i][1]) ok++; if (ok / (i + 1) >= prec) best = i + 1; } return best; };
  console.log(JSON.stringify(cfg), `held ${tot}: top1 ${(r1 / tot * 100).toFixed(1)}% top3 ${(r3 / tot * 100).toFixed(1)}%; opens at 90% precision ${at(0.9)}, at 85% ${at(0.85)}`);
}
