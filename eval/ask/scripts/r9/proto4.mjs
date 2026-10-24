// node proto4.mjs: all-text kNN found through short binary codes, then reranked exactly.
import { readFileSync } from 'node:fs';
import { loadModel, tokenize } from './emb.mjs';
const S = process.env.ASK_WORK + '/scratchpad';
const WEB = process.env.ATLAS_REPO + '/web';
const J = (f) => JSON.parse(readFileSync(f, 'utf8'));
const m = loadModel(`${S}/model/m`);
const index = J(`${WEB}/public/data/ask/index.json`);
const also = J(`${WEB}/public/data/ask/also.json`);
const examples = J(`${WEB}/../config/ask-examples.json`).examples;
const ids = index.questions.map((q) => q.id);
const at = new Map(ids.map((id, i) => [id, i]));
const C = ids.length, D = 256;
const norm = (s) => s.toLowerCase().replace(/['’‘ʼ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const texts = [];
index.questions.forEach((q, i) => {
  texts.push([i, q.q]);
  for (const a of also[i] ?? []) texts.push([i, a]);
  for (const e of examples[q.id] ?? []) texts.push([i, e]);
});
const toks = texts.map(([, s]) => tokenize(m, s).filter((t) => t !== m.unk));
const cls = Int32Array.from(texts.map((t) => t[0]));
const keys = texts.map((t) => norm(t[1]));
const used = new Set(); for (const t of toks) for (const id of t) used.add(id);
// used-only int8 table
const E = new Float32Array(m.E.length);
for (let i = 0; i < m.rows; i++) {
  if (!used.has(i)) continue;
  let mx = 0; for (let d = 0; d < D; d++) mx = Math.max(mx, Math.abs(m.E[i * D + d]));
  const sc = mx / 127 || 1;
  for (let d = 0; d < D; d++) E[i * D + d] = Math.round(m.E[i * D + d] / sc) * sc;
}
function emb(ts) {
  if (!ts.length) return null;
  const v = new Float32Array(D);
  for (const id of ts) for (let d = 0; d < D; d++) v[d] += E[id * D + d];
  const len = Math.hypot(...v) || 1;
  for (let d = 0; d < D; d++) v[d] /= len;
  return v;
}
const N = texts.length;
const TV = new Float32Array(N * D);
toks.forEach((t, r) => { const v = emb(t); if (v) TV.set(v, r * D); });
const mean = new Float32Array(D);
for (let r = 0; r < N; r++) for (let d = 0; d < D; d++) mean[d] += TV[r * D + d] / N;
// Projections for codes: either the first B dims of a seeded random rotation, or plain dims.
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gaussian(r) { return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()); }
function proj(B) { const r = rng(7); const P = new Float32Array(B * D); for (let i = 0; i < P.length; i++) P[i] = gaussian(r); return P; }
function codes(P, B, v) {
  const W = B / 32, out = new Uint32Array(W);
  for (let b = 0; b < B; b++) { let s = 0; for (let d = 0; d < D; d++) s += P[b * D + d] * (v[d] - mean[d]); if (s > 0) out[b >> 5] |= 1 << (b & 31); }
  return out;
}
const pop = (x) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0xf0f0f0f) * 0x1010101) >>> 24; };
const relabel = {};
for (let i = 1; i <= 17; i++) for (const p of J(`${S}/r7/relabel/out-${i}.json`)) relabel[p.q] = p;
const sets = [
  ['dev2', J(`${S}/r6/dev2/picks.json`), J(`${S}/g7/nr-d-new-built.json`)],
  ['dev3', J(`${S}/g7/dev3/picks.json`), J(`${S}/g7/nr-f-new-k20p4.json`)],
].map(([name, picks, rt]) => {
  const R = new Map(rt.map((r) => [r.q, r]));
  return [name, Object.entries(picks).map(([q, p]) => ({ q, fits: new Set([...p.fits, ...(relabel[q]?.fits ?? [])]), r: R.get(q), t: tokenize(m, q).filter((t) => t !== m.unk) })).filter((x) => x.r && !x.r.care)];
});
function run(label, B, rerank, k = 20, power = 8) {
  let P = null, TC = null;
  if (B) { P = proj(B); TC = new Uint32Array(N * (B / 32)); for (let r = 0; r < N; r++) TC.set(codes(P, B, TV.subarray(r * D, r * D + D)), r * (B / 32)); }
  for (const [name, rows] of sets) {
    const res = { e1: 0, e3: 0, b1: 0, b3: 0 };
    for (const x of rows) {
      const e = emb(x.t);
      const z = new Float64Array(C);
      if (e) {
        const qk = norm(x.q);
        let cand;
        if (B) {
          const qc = codes(P, B, e), W = B / 32;
          const ham = new Int32Array(N);
          for (let r = 0; r < N; r++) { let h = 0; for (let w = 0; w < W; w++) h += pop(qc[w] ^ TC[r * W + w]); ham[r] = h; }
          cand = [...ham.keys()].sort((a, b) => ham[a] - ham[b]).slice(0, rerank);
        } else cand = [...Array(N).keys()];
        const sims = cand.map((r) => { if (keys[r] === qk) return [r, -1]; let s = 0; for (let d = 0; d < D; d++) s += e[d] * TV[r * D + d]; return [r, s]; });
        sims.sort((a, b) => b[1] - a[1]);
        let sum = 0;
        for (const [r, s] of sims.slice(0, k)) { const v = Math.max(0, s) ** power; z[cls[r]] += v; sum += v; }
        if (sum) for (let c = 0; c < C; c++) z[c] /= sum;
      }
      const lex = new Float64Array(C);
      for (const mm of x.r.meant) lex[at.get(mm.id)] = mm.p;
      const rank = (zz) => [...zz.keys()].sort((a, b) => zz[b] - zz[a]).slice(0, 3).map((i) => ids[i]);
      const te = rank(z), tb = rank(lex.map((v, i) => 0.5 * v + 0.5 * z[i]));
      res.e1 += x.fits.has(te[0]); res.e3 += te.some((i) => x.fits.has(i));
      res.b1 += x.fits.has(tb[0]); res.b3 += tb.some((i) => x.fits.has(i));
    }
    console.log(`${name} ${label.padEnd(34)} model ${res.e1}/${res.e3}  blend .5 ${res.b1}/${res.b3}  of ${rows.length}`);
  }
}
for (const v of (process.env.V || 'b128r300,b128r1000,b256r300,b64r1000').split(',')) {
  const [, b, r] = v.match(/b(\d+)r(\d+)/);
  run(`${b}-bit codes, rerank ${r}`, +b, +r);
}
