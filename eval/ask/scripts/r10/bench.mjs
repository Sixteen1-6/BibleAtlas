// node bench.mjs: how well the model's own vote (k nearest texts, power 8)
// picks a fitting prepared question on the labelled dev messages, for several
// ways of storing the vectors. Exact search (no codes), so only storage differs.
import { readFileSync } from 'node:fs';
const { createServer } = await import(process.env.ATLAS_REPO + '/web/node_modules/vite/dist/node/index.js');
const { readModel, modelFiles } = await import(process.env.ATLAS_REPO + '/web/scripts/ask-meaning.mjs');

const S = process.env.ASK_WORK + '/scratchpad';
const WEB = process.env.ATLAS_REPO + '/web';
const ASK = `${WEB}/public/data/ask`;
const server = await createServer({ root: WEB, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true } });
const P = await server.ssrLoadModule('/src/ui/ask/pieces.ts');
await server.close();
const model = readModel(modelFiles());
const { vocab, E, dims: D } = model;
const R = vocab.length;
const vmap = new Map(vocab.map((t, i) => [t, i]));

// Variance per dim, to see whether the dims are in PCA order.
{
  const v = new Float64Array(D);
  for (let r = 0; r < R; r++) for (let d = 0; d < D; d++) v[d] += E[r * D + d] ** 2;
  const tot = v.reduce((a, b) => a + b, 0);
  let c = 0;
  const at = {};
  for (let d = 0; d < D; d++) { c += v[d]; if ([32, 64, 96, 128, 160, 192, 256].includes(d + 1)) at[d + 1] = +(c / tot).toFixed(3); }
  let sorted = true;
  for (let d = 1; d < D; d++) if (v[d] > v[d - 1] * 1.05) sorted = false;
  console.log('energy kept by first dims', JSON.stringify(at), 'roughly sorted', sorted);
}

const index = JSON.parse(readFileSync(`${ASK}/index.json`, 'utf8'));
const also = JSON.parse(readFileSync(`${ASK}/also.json`, 'utf8'));
const examples = JSON.parse(readFileSync(`${WEB}/../config/ask-examples.json`, 'utf8')).examples;
const ids = index.questions.map((q) => q.id);
const texts = [];
const of = [];
index.questions.forEach((q, i) => {
  const seen = new Set();
  for (const s of [q.q, ...(also[i] ?? []), ...(examples[q.id] ?? [])]) {
    const p = P.pieces(vmap, s, model.unk).slice(0, 255);
    const k = p.join(' ');
    if (p.length && !seen.has(k)) { seen.add(k); texts.push(p); of.push(i); }
  }
});
const used = new Set(texts.flat());
console.log('texts', texts.length, 'pieces used', used.size, 'of', R);

// Labels.
const labels = {};
const relabel = {};
for (let i = 1; i <= 17; i++) for (const p of JSON.parse(readFileSync(`${S}/r7/relabel/out-${i}.json`, 'utf8'))) relabel[p.q] = p;
for (const [name, f] of [['dev2', 'r6/dev2/picks.json'], ['dev3', 'g7/dev3/picks.json']]) {
  labels[name] = {};
  for (const [q, p] of Object.entries(JSON.parse(readFileSync(`${S}/${f}`, 'utf8')))) {
    const n = relabel[q] ?? { fits: [], near: [] };
    labels[name][q] = new Set([...p.fits, ...n.fits]);
  }
}
labels.dev4 = {};
for (const [q, p] of Object.entries(JSON.parse(readFileSync(`${S}/r9/lab/picks.json`, 'utf8')))) labels.dev4[q] = new Set(p.fits);

/** A storage variant: a function giving the (approximate) float row of a piece, or null when it has none. */
function variant(kind) {
  const rows = new Float32Array(R * D);
  const has = new Uint8Array(R);
  for (let r = 0; r < R; r++) {
    const keep = kind.all || used.has(r);
    if (!keep) continue;
    has[r] = 1;
    const dd = kind.dims ?? D;
    const src = E.subarray(r * D, r * D + D);
    if (kind.bits === 32) { for (let d = 0; d < dd; d++) rows[r * D + d] = src[d]; continue; }
    const L = (1 << (kind.bits - 1)) - 1; // 127 or 7
    let max = 0;
    let ss = 0;
    for (let d = 0; d < dd; d++) { max = Math.max(max, Math.abs(src[d])); ss += src[d] ** 2; }
    const lim = kind.rms ? Math.min(max, kind.rms * Math.sqrt(ss / dd)) : max;
    const s = lim / L || 1;
    for (let d = 0; d < dd; d++) rows[r * D + d] = Math.max(-L, Math.min(L, Math.round(src[d] / s))) * s;
  }
  return { rows, has };
}
function emb(v, ps, drop) {
  const out = new Float64Array(D);
  let any = false;
  for (const p of ps) {
    if (!v.has[p]) { if (drop) continue; else continue; }
    any = true;
    for (let d = 0; d < D; d++) out[d] += v.rows[p * D + d];
  }
  if (!any) return null;
  const n = Math.hypot(...out);
  if (!n) return null;
  for (let d = 0; d < D; d++) out[d] /= n;
  return out;
}

const KINDS = {
  'f32 all (11.6+ MB ref)': { bits: 32, all: true },
  'i8 256 kept (now)': { bits: 8 },
  'i8 256 all (+3.6 MB)': { bits: 8, all: true },
  'i4 256 all': { bits: 4, all: true },
  'i4 256 all rms3': { bits: 4, all: true, rms: 3 },
  'i4 256 all rms2.5': { bits: 4, all: true, rms: 2.5 },
  'i8 128 all': { bits: 8, all: true, dims: 128 },
};
const K = 20, POW = 8;
for (const [name, kind] of Object.entries(KINDS)) {
  const v = variant(kind);
  const TV = new Float32Array(texts.length * D);
  texts.forEach((ps, t) => { const e = emb(v, ps); if (e) TV.set(e, t * D); });
  const res = [];
  for (const [set, lab] of Object.entries(labels)) {
    let n = 0, top1 = 0, top3 = 0, none = 0, canfit = 0;
    for (const [q, fits] of Object.entries(lab)) {
      if (!fits.size) continue;
      canfit++;
      const ps = P.pieces(vmap, q, model.unk);
      const e = emb(v, ps);
      n++;
      if (!e) { none++; continue; }
      const best = [];
      for (let t = 0; t < texts.length; t++) {
        let s = 0;
        for (let d = 0, o = t * D; d < D; d++) s += e[d] * TV[o + d];
        if (best.length === K && s <= best[K - 1][1]) continue;
        let i = Math.min(best.length, K - 1);
        for (; i > 0 && best[i - 1][1] < s; i--) best[i] = best[i - 1];
        best[i] = [t, s];
      }
      const z = new Map();
      for (const [t, s] of best) z.set(of[t], (z.get(of[t]) ?? 0) + Math.max(0, s) ** POW);
      const top = [...z].sort((a, b) => b[1] - a[1]).map((x) => ids[x[0]]);
      if (fits.has(top[0])) top1++;
      if (top.slice(0, 3).some((x) => fits.has(x))) top3++;
    }
    res.push(`${set} top1 ${top1} top3 ${top3} none ${none} of ${n}`);
  }
  console.log(name.padEnd(24), res.join(' | '));
}
