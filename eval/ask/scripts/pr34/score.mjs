// node score.mjs questions.json out.json '<cfg>': softmax and nearest-neighbour blend scores for each question (trained on all data)
import { readFileSync, writeFileSync } from 'node:fs';
const { createServer } = await import(process.env.ATLAS_REPO + '/web/node_modules/vite/dist/node/index.js');
const WEB = process.env.ATLAS_REPO + '/web';
const M = await import(WEB + '/scripts/ask-meaning.mjs');
const ASK = WEB + '/public/data/ask';
const rd = (f) => JSON.parse(readFileSync(f, 'utf8'));
const index = rd(ASK + '/index.json'), also = rd(ASK + '/also.json'), signals = rd(ASK + '/signals.json');
const exfile = process.env.EXAMPLES || WEB + '/../config/ask-examples.json';
const examples = rd(exfile).examples;
const server = await createServer({ root: WEB, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true } });
const words = await server.ssrLoadModule('/src/ui/ask/words.ts');
await server.close();
const [inp, outp, cfgs] = process.argv.slice(2);
const cfg = { K: 30, a: 3, b: 0.5, ...(cfgs ? JSON.parse(cfgs) : {}) };
const C = index.questions.length;
const ids = index.questions.map((q) => q.id);
const train = M.rows(index, also, signals, examples).map(([c, k, s]) => [c, k, words.terms(s)]);
const df = new Map();
for (const [, , ts] of train) for (const t of ts) df.set(t, (df.get(t) ?? 0) + 1);
const N = train.length;
const idf = (t) => Math.log(1 + N / (df.get(t) ?? 0.5));
const vec = (ts) => { const v = new Map(); let s = 0; for (const t of ts) { const w = idf(t); v.set(t, w); s += w * w; } s = Math.sqrt(s) || 1; for (const [t, w] of v) v.set(t, w / s); return v; };
const inv = new Map();
train.forEach(([c, k, ts], i) => { for (const [t, w] of vec(ts)) { let l = inv.get(t); if (!l) inv.set(t, (l = [])); l.push([i, w]); } });
const model = M.train(train, C, M.TRAIN);
const w = M.prune(model, C, M.KEEP);
function soft(ts) { const z = new Float64Array(C); let known = false; for (const t of ts) { const e = w[t]; if (e) { known = true; for (let k = 0; k < e.length; k += 2) z[e[k]] += e[k + 1] / M.SCALE; } } const max = Math.max(...z); let s = 0; for (let k = 0; k < C; k++) s += z[k] = Math.exp(z[k] - max); for (let k = 0; k < C; k++) z[k] /= s; return known ? z : null; }
function nn(ts) { const q = vec(ts); const sim = new Map(); for (const [t, wq] of q) for (const [i, wd] of inv.get(t) ?? []) sim.set(i, (sim.get(i) ?? 0) + wq * wd); const nb = [...sim].sort((x, y) => y[1] - x[1]).slice(0, cfg.K); const z = new Float64Array(C); for (const [i, s] of nb) z[train[i][0]] += Math.pow(s, cfg.a); let zs = 0; for (let k = 0; k < C; k++) zs += z[k]; if (zs) for (let k = 0; k < C; k++) z[k] /= zs; return { z, top: nb[0] ? nb[0][1] : 0 }; }
const qs = rd(inp).map((x) => (typeof x === 'string' ? x : x.q));
const top = (z, n) => [...z.keys()].sort((x, y) => z[y] - z[x]).slice(0, n).map((k) => ({ id: ids[k], p: +z[k].toFixed(3) }));
const out = qs.map((q) => {
  const ts = words.terms(q);
  const p = soft(ts);
  if (!p) return { q, soft: [], blend: [], sim: 0 };
  const { z, top: sim } = nn(ts);
  const b = new Float64Array(C);
  for (let k = 0; k < C; k++) b[k] = (1 - cfg.b) * z[k] + cfg.b * p[k];
  return { q, soft: top(p, 3), blend: top(b, 3), sim: +sim.toFixed(3) };
});
writeFileSync(outp, JSON.stringify(out));
console.log('scored', out.length);
