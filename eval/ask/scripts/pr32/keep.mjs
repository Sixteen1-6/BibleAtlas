// node keep.mjs: how pruning harder changes size and the blind sets' meanings
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
const data = M.rows(index, also, signals, examples).map(([c, k, s]) => [c, k, words.terms(s)]);
const model = M.train(data, C);
const S = process.argv[2];
const qs = [...rd(S + '/eval2/set7.json'), ...rd(S + '/crazy9/set9.json')].map((x) => (typeof x === 'string' ? x : x.q));
function sense(w, text) {
  const z = new Float64Array(C);
  let known = false;
  for (const t of words.terms(text)) { const e = w[t]; if (!e) continue; known = true; for (let k = 0; k < e.length; k += 2) z[e[k]] += e[k + 1] / M.SCALE; }
  if (!known) return null;
  const max = Math.max(...z); let sum = 0;
  for (let k = 0; k < C; k++) sum += z[k] = Math.exp(z[k] - max);
  const ord = [...z.keys()].sort((a, b) => z[b] - z[a]).slice(0, 3);
  return ord.map((k) => [k, z[k] / sum]);
}
let base = null;
for (const keep of [0.2, 0.3, 0.4, 0.5, 0.7]) {
  const w = M.prune(model, C, keep);
  const js = JSON.stringify({ format: 1, w });
  const res = qs.map((q) => sense(w, q));
  let right = 0, all = 0;
  for (const [c, k, ts] of data) { if (k !== 'example' || !ts.size) continue; all++; if (M.best(w, C, ts) === c) right++; }
  const opens = res.map((r) => (r && r[0][1] >= 0.8 ? r[0][0] : -1));
  const lean = res.map((r) => (r ? r.filter(([, p]) => p >= 0.3).map(([k]) => k).join(',') : ''));
  if (!base) base = { opens, lean, top: res.map((r) => (r ? r[0][0] : -1)) };
  const diff = (a, b) => a.filter((x, i) => x !== b[i]).length;
  console.log(`keep ${keep}: ${(js.length / 1e6).toFixed(2)} MB, ${(gzipSync(js).length / 1e3).toFixed(0)} KB gz; self ${right}/${all}; opens ${opens.filter((x) => x >= 0).length} (changed ${diff(opens, base.opens)}), lean changed ${diff(lean, base.lean)}, top changed ${diff(res.map((r) => (r ? r[0][0] : -1)), base.top)} of ${qs.length}`);
}
