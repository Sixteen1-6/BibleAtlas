// node proto.mjs: how well potion-base-8M finds the fitting prepared question on the
// labelled dev messages, alone and blended with the current matcher's top 8.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { loadModel, embed } from './emb.mjs';
const S = process.env.ASK_WORK + '/scratchpad';
const WEB = process.env.ATLAS_REPO + '/web';
const J = (f) => JSON.parse(readFileSync(f, 'utf8'));
const m = loadModel(`${S}/model/m`);
const index = J(`${WEB}/public/data/ask/index.json`);
const also = J(`${WEB}/public/data/ask/also.json`);
const signals = J(`${WEB}/public/data/ask/signals.json`);
const examples = J(`${WEB}/../config/ask-examples.json`).examples;
const ids = index.questions.map((q) => q.id);
const at = new Map(ids.map((id, i) => [id, i]));
const norm = (s) => s.toLowerCase().replace(/['’‘ʼ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const texts = [];
index.questions.forEach((q, i) => {
  texts.push([i, 'title', q.q]);
  for (const a of also[i] ?? []) texts.push([i, 'also', a]);
  for (const e of examples[q.id] ?? []) texts.push([i, 'example', e]);
});
const D = m.dims;
let T, cls, keys;
const cache = `${S}/r8/mm/texts.bin`;
if (existsSync(cache) && process.env.FRESH !== '1') {
  const b = readFileSync(cache);
  T = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
} else {
  T = new Float32Array(texts.length * D);
  const v = new Float32Array(D);
  texts.forEach(([, , s], r) => { const e = embed(m, s, v); if (e) T.set(e, r * D); });
  writeFileSync(cache, Buffer.from(T.buffer));
}
cls = Int32Array.from(texts.map((t) => t[0]));
keys = texts.map((t) => norm(t[2]));
console.error('texts', texts.length);

// Labels: older picks joined with the labels that know the 360 newer answers.
const relabel = {};
for (let i = 1; i <= 17; i++) for (const p of J(`${S}/r7/relabel/out-${i}.json`)) relabel[p.q] = p;
const sets = [
  ['dev2', J(`${S}/r6/dev2/picks.json`), J(`${S}/g7/nr-d-new-built.json`)],
  ['dev3', J(`${S}/g7/dev3/picks.json`), J(`${S}/g7/nr-f-new-k20p4.json`)],
];
const C = ids.length;
function embScores(q, k, power) {
  const e = embed(m, q);
  const z = new Float64Array(C);
  if (!e) return z;
  const qk = norm(q);
  const sims = new Float32Array(cls.length);
  for (let r = 0; r < cls.length; r++) {
    let s = 0;
    const o = r * D;
    for (let d = 0; d < D; d++) s += e[d] * T[o + d];
    sims[r] = keys[r] === qk ? -1 : s; // leave the message itself out
  }
  const top = [...sims.keys()].sort((a, b) => sims[b] - sims[a]).slice(0, k);
  let sum = 0;
  for (const r of top) { const v = Math.max(0, sims[r]) ** power; z[cls[r]] += v; sum += v; }
  if (sum) for (let c = 0; c < C; c++) z[c] /= sum;
  return z;
}
const grid = (process.env.GRID || '20:4,30:4,50:4,20:8,50:8,100:8').split(',').map((x) => x.split(':').map(Number));
for (const [name, picks, rt] of sets) {
  const R = new Map(rt.map((r) => [r.q, r]));
  const rows = Object.entries(picks).map(([q, p]) => {
    const n = relabel[q] ?? { fits: [], near: [] };
    return { q, fits: new Set([...p.fits, ...n.fits]), r: R.get(q) };
  }).filter((x) => x.r && !x.r.care);
  const score = (label, f) => {
    let t1 = 0, t3 = 0;
    for (const x of rows) {
      const z = f(x);
      const top = [...z.keys()].sort((a, b) => z[b] - z[a]).slice(0, 3).map((i) => ids[i]);
      t1 += x.fits.has(top[0]); t3 += top.some((i) => x.fits.has(i));
    }
    console.log(`${name} ${label.padEnd(28)} top1 ${t1} top3 ${t3} of ${rows.length}`);
  };
  const lex = (x) => { const z = new Float64Array(C); for (const mm of x.r.meant) z[at.get(mm.id)] = mm.p; return z; };
  score('words (live)', lex);
  for (const [k, p] of grid) {
    const E = new Map(rows.map((x) => [x.q, embScores(x.q, k, p)]));
    score(`model k${k} p${p}`, (x) => E.get(x.q));
    for (const s of [0.25, 0.4, 0.5]) score(`  blend ${s}`, (x) => { const a = lex(x), b = E.get(x.q); return a.map((v, i) => (1 - s) * v + s * b[i]); });
  }
}
