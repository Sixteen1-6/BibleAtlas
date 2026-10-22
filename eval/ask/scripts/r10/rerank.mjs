// node rerank.mjs: the model-only vote (k 20, power 8) on the labelled dev
// messages, read from the built model.bin, at several rerank sizes.
import { readFileSync } from 'node:fs';
const { createServer } = await import(process.env.ATLAS_REPO + '/web/node_modules/vite/dist/node/index.js');
const S = process.env.ASK_WORK + '/scratchpad';
const WEB = process.env.ATLAS_REPO + '/web';
const server = await createServer({ root: WEB, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true } });
const P = await server.ssrLoadModule('/src/ui/ask/pieces.ts');
await server.close();
const b = readFileSync(`${WEB}/public/data/ask/model.bin`);
const m = P.readModelFile(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const index = JSON.parse(readFileSync(`${WEB}/public/data/ask/index.json`, 'utf8'));
const ids = index.questions.map((q) => q.id);
const labels = {};
const relabel = {};
for (let i = 1; i <= 17; i++) for (const p of JSON.parse(readFileSync(`${S}/r7/relabel/out-${i}.json`, 'utf8'))) relabel[p.q] = p;
for (const [name, f] of [['dev2', 'r6/dev2/picks.json'], ['dev3', 'g7/dev3/picks.json']]) {
  labels[name] = {};
  for (const [q, p] of Object.entries(JSON.parse(readFileSync(`${S}/${f}`, 'utf8')))) labels[name][q] = new Set([...p.fits, ...(relabel[q]?.fits ?? [])]);
}
labels.dev4 = {};
for (const [q, p] of Object.entries(JSON.parse(readFileSync(`${S}/r9/lab/picks.json`, 'utf8')))) labels.dev4[q] = new Set(p.fits);
const N = m.texts.starts.length - 1;
for (const rerank of [300, 1000, 3000]) {
  const res = [];
  let ms = 0, n = 0;
  for (const [set, lab] of Object.entries(labels)) {
    let top1 = 0, top3 = 0, cnt = 0;
    for (const [q, fits] of Object.entries(lab)) {
      if (!fits.size) continue;
      cnt++;
      const vec = P.embed(m.texts.v, P.pieces(m.vocab, q, m.unk));
      if (!vec) continue;
      const t0 = performance.now();
      const best = P.nearestTexts(m.texts, vec, 20, rerank);
      ms += performance.now() - t0; n++;
      const z = new Map();
      for (const [t, s] of best) z.set(m.of[t], (z.get(m.of[t]) ?? 0) + Math.max(0, s) ** 8);
      const top = [...z].sort((a, b) => b[1] - a[1]).map((x) => ids[x[0]]);
      if (fits.has(top[0])) top1++;
      if (top.slice(0, 3).some((x) => fits.has(x))) top3++;
    }
    res.push(`${set} ${top1}/${top3} of ${cnt}`);
  }
  console.log(`rerank ${rerank}: ${res.join(' | ')}  ${(ms / n).toFixed(1)} ms`);
}
