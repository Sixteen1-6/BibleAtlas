// node proto2.mjs: smaller forms of the meaning model, so the page download stays small.
// Variants: PCA to fewer dims, int8 table, and per-question prototypes instead of every text.
import { readFileSync, existsSync } from 'node:fs';
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
const C = ids.length;
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

// PCA of the token table, weighted by how often tokens occur in the texts.
function pca(dims) {
  const D = m.dims, N = m.rows;
  const freq = new Float64Array(N);
  for (const t of toks) for (const id of t) freq[id]++;
  const mean = new Float64Array(D);
  let tot = 0;
  for (let i = 0; i < N; i++) { const w = freq[i] + 1; tot += w; for (let d = 0; d < D; d++) mean[d] += w * m.E[i * D + d]; }
  for (let d = 0; d < D; d++) mean[d] /= tot;
  const cov = new Float64Array(D * D);
  for (let i = 0; i < N; i++) {
    const w = freq[i] + 1;
    const x = new Float64Array(D);
    for (let d = 0; d < D; d++) x[d] = m.E[i * D + d] - mean[d];
    for (let a = 0; a < D; a++) { const xa = w * x[a]; for (let b = a; b < D; b++) cov[a * D + b] += xa * x[b]; }
  }
  for (let a = 0; a < D; a++) for (let b = 0; b < a; b++) cov[a * D + b] = cov[b * D + a];
  // Power iteration with deflation for the top components.
  const V = [];
  for (let k = 0; k < dims; k++) {
    let v = new Float64Array(D).map((_, i) => Math.sin(i * 7.1 + k * 3.3) + 0.01);
    for (let it = 0; it < 60; it++) {
      const u = new Float64Array(D);
      for (let a = 0; a < D; a++) { let s = 0; for (let b = 0; b < D; b++) s += cov[a * D + b] * v[b]; u[a] = s; }
      for (const p of V) { let dot = 0; for (let a = 0; a < D; a++) dot += u[a] * p[a]; for (let a = 0; a < D; a++) u[a] -= dot * p[a]; }
      const len = Math.hypot(...u) || 1;
      v = u.map((x) => x / len);
    }
    V.push(v);
  }
  // Project every token (no centering: the mean is shared and the vectors are normalized after pooling).
  const out = new Float32Array(N * dims);
  for (let i = 0; i < N; i++) for (let k = 0; k < dims; k++) { let s = 0; for (let d = 0; d < D; d++) s += m.E[i * D + d] * V[k][d]; out[i * dims + k] = s; }
  return out;
}
function int8(E, dims) {
  const out = new Float32Array(E.length);
  for (let i = 0; i < E.length / dims; i++) {
    let mx = 0;
    for (let d = 0; d < dims; d++) mx = Math.max(mx, Math.abs(E[i * dims + d]));
    const sc = mx / 127 || 1;
    for (let d = 0; d < dims; d++) out[i * dims + d] = Math.round(E[i * dims + d] / sc) * sc;
  }
  return out;
}
function embedWith(E, dims, ts) {
  const v = new Float32Array(dims);
  if (!ts.length) return null;
  for (const id of ts) for (let d = 0; d < dims; d++) v[d] += E[id * dims + d];
  const len = Math.hypot(...v) || 1;
  for (let d = 0; d < dims; d++) v[d] /= len;
  return v;
}
const relabel = {};
for (let i = 1; i <= 17; i++) for (const p of J(`${S}/r7/relabel/out-${i}.json`)) relabel[p.q] = p;
const sets = [
  ['dev2', J(`${S}/r6/dev2/picks.json`), J(`${S}/g7/nr-d-new-built.json`)],
  ['dev3', J(`${S}/g7/dev3/picks.json`), J(`${S}/g7/nr-f-new-k20p4.json`)],
].map(([name, picks, rt]) => {
  const R = new Map(rt.map((r) => [r.q, r]));
  return [name, Object.entries(picks).map(([q, p]) => ({ q, fits: new Set([...p.fits, ...(relabel[q]?.fits ?? [])]), r: R.get(q), t: tokenize(m, q).filter((t) => t !== m.unk) })).filter((x) => x.r && !x.r.care)];
});
function evaluate(label, E, dims, mode, k = 20, power = 8, protos = 1) {
  const TV = new Float32Array(texts.length * dims);
  toks.forEach((t, r) => { const v = embedWith(E, dims, t); if (v) TV.set(v, r * dims); });
  let P = null, pc = null;
  if (mode === 'protos') {
    // Up to `protos` prototypes per question by a few rounds of k-means over its texts.
    const list = [], lc = [];
    for (let c = 0; c < C; c++) {
      const rows = [];
      for (let r = 0; r < texts.length; r++) if (cls[r] === c) rows.push(r);
      const kk = Math.min(protos, rows.length);
      let cent = Array.from({ length: kk }, (_, j) => TV.slice(rows[Math.floor((j * rows.length) / kk)] * dims, rows[Math.floor((j * rows.length) / kk)] * dims + dims));
      for (let it = 0; it < 8; it++) {
        const sum = cent.map(() => new Float32Array(dims)), n = cent.map(() => 0);
        for (const r of rows) {
          let b = 0, bs = -9;
          cent.forEach((cv, j) => { let s = 0; for (let d = 0; d < dims; d++) s += cv[d] * TV[r * dims + d]; if (s > bs) { bs = s; b = j; } });
          for (let d = 0; d < dims; d++) sum[b][d] += TV[r * dims + d]; n[b]++;
        }
        cent = sum.map((sv, j) => { if (!n[j]) return cent[j]; const len = Math.hypot(...sv) || 1; return sv.map((x) => x / len); });
      }
      for (const cv of cent) { list.push(cv); lc.push(c); }
    }
    P = new Float32Array(list.length * dims); list.forEach((v, i) => P.set(v, i * dims)); pc = Int32Array.from(lc);
  }
  for (const [name, rows] of sets) {
    const res = { e1: 0, e3: 0, b1: 0, b3: 0 };
    for (const x of rows) {
      const e = embedWith(E, dims, x.t);
      const z = new Float64Array(C);
      if (e) {
        const M = P ?? TV, MC = P ? pc : cls, n = MC.length;
        const qk = norm(x.q);
        const sims = new Float32Array(n);
        for (let r = 0; r < n; r++) { let s = 0; for (let d = 0; d < dims; d++) s += e[d] * M[r * dims + d]; sims[r] = !P && keys[r] === qk ? -1 : s; }
        const top = [...sims.keys()].sort((a, b) => sims[b] - sims[a]).slice(0, k);
        let sum = 0;
        for (const r of top) { const v = Math.max(0, sims[r]) ** power; z[MC[r]] += v; sum += v; }
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
const V = process.env.V || 'full,int8,pca128,pca128i8,pca64i8,protos8,protos4,centroid';
for (const v of V.split(',')) {
  if (v === 'full') evaluate('256 float, all texts', m.E, 256, 'all');
  if (v === 'int8') evaluate('256 int8, all texts', int8(m.E, 256), 256, 'all');
  if (v === 'pca128') evaluate('pca 128 float, all texts', pca(128), 128, 'all');
  if (v === 'pca128i8') evaluate('pca 128 int8, all texts', int8(pca(128), 128), 128, 'all');
  if (v === 'pca64i8') evaluate('pca 64 int8, all texts', int8(pca(64), 64), 64, 'all');
  if (v === 'protos8') evaluate('256 int8, 8 prototypes', int8(m.E, 256), 256, 'protos', 20, 8, 8);
  if (v === 'protos4') evaluate('256 int8, 4 prototypes', int8(m.E, 256), 256, 'protos', 20, 8, 4);
  if (v === 'centroid') evaluate('256 int8, centroid', int8(m.E, 256), 256, 'protos', 10, 8, 1);
}
