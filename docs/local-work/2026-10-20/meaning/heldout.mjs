// Held-out check: the shipped matcher (softmax + tf-idf nearest examples, as meaning.ts) vs potion-base-8M
// (Model2Vec) nearest examples, on every 10th example of each question, trained on the rest.
import { readFileSync, writeFileSync } from 'node:fs';
import { rows, train, prune, texts, SCALE } from './am.mjs';
import * as words from './words.ts';
import { load, embed, dot } from '../potion/m2v.mjs';
const [R, P, OUT] = process.argv.slice(2);
const qs = JSON.parse(readFileSync(R + '/config/questions.json', 'utf8')).questions;
const examples = JSON.parse(readFileSync(R + '/config/ask-examples.json', 'utf8')).examples;
const index = { questions: qs.map((q) => ({ id: q.id, q: q.question.trim() })) };
const C = qs.length;
const trainEx = {}, held = [];
qs.forEach((q, c) => { trainEx[q.id] = []; (examples[q.id] ?? []).forEach((e, i) => (i % 10 === 0 ? held.push([c, e]) : trainEx[q.id].push(e))); });
const raw = rows(index, qs.map((q) => q.also), qs.map((q) => q.signals ?? []), trainEx);
const data = raw.map(([c, kind, s]) => [c, kind, words.terms(s)]);
let t0 = Date.now();
const w = prune(train(data, C), C);
console.log('trained', ((Date.now() - t0) / 1000).toFixed(0), 's; held out', held.length);
// meaning.ts, closest() and weigh(), over the training texts.
const tx = texts(data, C);
const of = [], trows = [];
tx.rows.forEach((r, c) => { if (!r) return; for (const t of r.split('|')) { of.push(c); trows.push(t.split(' ').map((x) => tx.terms[parseInt(x, 36)])); } });
const df = new Map(); for (const r of trows) for (const t of r) df.set(t, (df.get(t) ?? 0) + 1);
const idf = new Map([...df].map(([t, n]) => [t, Math.log(1 + trows.length / n)]));
const holding = new Map();
trows.forEach((r, i) => { const len = Math.hypot(...r.map((t) => idf.get(t))) || 1; for (const t of r) { let l = holding.get(t); if (!l) holding.set(t, (l = [])); l.push([i, idf.get(t) / len]); } });
const NEAR = { k: 20, power: 4, share: 0.5 };
function closestTf(ws) { const z = new Float64Array(C); const q = [...ws].map((t) => [t, idf.get(t) ?? Math.log(1 + 2 * of.length)]); const len = Math.hypot(...q.map((e) => e[1])) || 1; const sim = new Map(); for (const [t, wt] of q) for (const [i, v] of holding.get(t) ?? []) sim.set(i, (sim.get(i) ?? 0) + (wt / len) * v); const best = [...sim].sort((a, b) => b[1] - a[1]).slice(0, NEAR.k); let sum = 0; for (const [i, s] of best) { const v = s ** NEAR.power; z[of[i]] += v; sum += v; } if (sum) for (let k = 0; k < C; k++) z[k] /= sum; return z; }
function softmax(ws) { const z = new Float64Array(C); let known = false; for (const t of ws) { const e = w[t]; if (!e) continue; known = true; for (let k = 0; k < e.length; k += 2) z[e[k]] += e[k + 1] / SCALE; } if (!known) return null; const max = Math.max(...z); let sum = 0; for (let k = 0; k < C; k++) sum += z[k] = Math.exp(z[k] - max); for (let k = 0; k < C; k++) z[k] /= sum; return z; }
// potion: embed every training text (titles, also, signals, examples), nearest 20 with the same weighting.
const m = load(P);
t0 = Date.now();
const D = m.dim, emb = new Float32Array(raw.length * D), eof = new Int32Array(raw.length);
raw.forEach(([c, , s], i) => { emb.set(embed(m, s), i * D); eof[i] = c; });
console.log('embedded', raw.length, 'texts in', ((Date.now() - t0) / 1000).toFixed(1), 's');
function closestPotion(v) { const z = new Float64Array(C); const top = []; for (let i = 0; i < raw.length; i++) { let s = 0; const o = i * D; for (let k = 0; k < D; k++) s += v[k] * emb[o + k]; if (top.length < NEAR.k || s > top[top.length - 1][1]) { top.push([i, s]); top.sort((a, b) => b[1] - a[1]); if (top.length > NEAR.k) top.pop(); } } let sum = 0; for (const [i, s] of top) { const x = Math.max(s, 0) ** NEAR.power; z[eof[i]] += x; sum += x; } if (sum) for (let k = 0; k < C; k++) z[k] /= sum; return z; }
const rank = (z, c) => { if (!z) return Infinity; let r = 0; for (let k = 0; k < C; k++) if (z[k] > z[c]) r++; return r; };
const N = Math.min(held.length, Number(process.env.N ?? 2000));
const step = held.length / N;
const names = ['softmax only', 'shipped (softmax + tf-idf near, half and half)', 'potion near only', 'shipped + potion (thirds)', 'softmax + potion near (halves)'];
const top1 = names.map(() => 0), top3 = names.map(() => 0), sure = names.map(() => [0, 0]);
t0 = Date.now();
for (let j = 0; j < N; j++) {
  const [c, e] = held[Math.floor(j * step)];
  const ws = words.terms(e);
  const sm = softmax(ws), tf = closestTf(ws), pn = closestPotion(embed(m, e));
  const mix = (parts) => { if (parts.some((p) => !p.z)) return null; const z = new Float64Array(C); for (const { z: q, s } of parts) for (let k = 0; k < C; k++) z[k] += s * q[k]; return z; };
  const zs = [sm, sm && mix([{ z: sm, s: 0.5 }, { z: tf, s: 0.5 }]), pn, sm && mix([{ z: sm, s: 1 / 3 }, { z: tf, s: 1 / 3 }, { z: pn, s: 1 / 3 }]), sm && mix([{ z: sm, s: 0.5 }, { z: pn, s: 0.5 }])];
  zs.forEach((z, i) => { const r = rank(z, c); if (r === 0) top1[i]++; if (r < 3) top3[i]++; if (z) { let b = 0; for (let k = 1; k < C; k++) if (z[k] > z[b]) b = k; if (z[b] >= 0.35) { sure[i][0]++; if (b === c) sure[i][1]++; } } });
}
const res = names.map((n, i) => ({ method: n, top1: top1[i], top3: top3[i], of: N, opensAt035: sure[i][0], rightOpens: sure[i][1] }));
console.table(res);
console.log('scored in', ((Date.now() - t0) / 1000).toFixed(0), 's');
writeFileSync(OUT, JSON.stringify(res, null, 1));
