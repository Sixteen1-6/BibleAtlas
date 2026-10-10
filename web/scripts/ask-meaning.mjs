// Ask the Bible's meaning matcher: which prepared question fits what someone
// typed, learned from how people say each one.
//
// For every prepared question the repository holds its title and other ways of
// asking (config/questions.json), the everyday words that point to it, and
// example messages people might type (config/ask-examples.json): "car got
// repossessed this morning" for "drowning in debt". This trains a softmax
// regression over the words Ask the Bible reads (web/src/ui/ask/words.ts, the
// same code the page runs), so words like "rehab", "repo" and "chemo" come to
// weigh toward the questions people use them about. It writes the weights
// worth keeping to public/data/ask/meaning.json, which the page loads with the
// first question typed (web/src/ui/ask/meaning.ts).
//
// Runs before `npm run build` and `npm run dev`, after `make data` has written
// public/data/ask. It is deterministic, and skips training when its inputs
// have not changed.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const ASK = join(WEB, 'public/data/ask');
const EXAMPLES = join(WEB, '../config/ask-examples.json');
const OUT = join(ASK, 'meaning.json');

/** How much each kind of text counts in training. */
export const KINDS = { title: 2, also: 2, signal: 1, example: 1 };
export const TRAIN = { epochs: 8, rate: 0.5, l2: 1e-4, least: 0.1, seed: 1 };
/** Weights are written as whole numbers of 1/SCALE; smaller ones are dropped. */
export const SCALE = 100;
export const KEEP = 0.2;

/** The id list's fingerprint, so the page can tell the weights match its index. */
export function idsHash(ids) {
  let h = 0x811c9dc5;
  for (const ch of ids.join('\n')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/** A small seeded random number generator (mulberry32). */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Training rows: [question index, kind, text], every kind of text. */
export function rows(index, also, signals, examples) {
  const out = [];
  index.questions.forEach((q, i) => {
    out.push([i, 'title', q.q]);
    for (const a of also[i] ?? []) out.push([i, 'also', a]);
    for (const s of signals[i] ?? []) out.push([i, 'signal', s]);
    for (const e of examples[q.id] ?? []) out.push([i, 'example', e]);
  });
  return out;
}

/** Softmax regression trained with AdaGrad, one row at a time.
 * `data`: [class, kind, terms] rows. Returns the terms and a weight matrix
 * (term by class). */
export function train(data, classes, opts = TRAIN) {
  const vocab = new Map();
  const xs = data
    .map(([c, kind, ts]) => [c, KINDS[kind], [...ts].map((t) => vocab.get(t) ?? (vocab.set(t, vocab.size), vocab.size - 1))])
    .filter(([, , f]) => f.length);
  const C = classes;
  const W = new Float32Array(vocab.size * C);
  const H = new Float32Array(vocab.size * C);
  const z = new Float64Array(C);
  const rand = random(opts.seed);
  const order = xs.map((_, i) => i);
  for (let ep = 0; ep < opts.epochs; ep++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const r of order) {
      const [c, w, f] = xs[r];
      z.fill(0);
      for (const t of f) for (let k = 0, o = t * C; k < C; k++) z[k] += W[o + k];
      let max = -Infinity;
      for (let k = 0; k < C; k++) if (z[k] > max) max = z[k];
      let sum = 0;
      for (let k = 0; k < C; k++) sum += z[k] = Math.exp(z[k] - max);
      for (let k = 0; k < C; k++) z[k] = w * (z[k] / sum - (k === c ? 1 : 0));
      for (const t of f) {
        for (let k = 0, o = t * C; k < C; k++) {
          // Only questions the row could be taken for learn from it, so most
          // words end with weights for a few questions only.
          if (z[k] < opts.least && k !== c) continue;
          const g = z[k] + opts.l2 * W[o + k];
          H[o + k] += g * g;
          W[o + k] -= (opts.rate * g) / (Math.sqrt(H[o + k]) + 1e-6);
        }
      }
    }
  }
  return { vocab, W };
}

/** The weights worth keeping, as { term: [class, weight, class, weight, ...] }
 * in whole 1/SCALE units. A word's weights are first moved so their median is
 * 0, which changes no answer (every question moves alike), and then only
 * those that stand out from it are kept. */
export function prune({ vocab, W }, classes, keep = KEEP) {
  const w = {};
  for (const [t, i] of [...vocab].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const row = W.subarray(i * classes, (i + 1) * classes);
    const mid = [...row].sort((a, b) => a - b)[classes >> 1];
    const kept = [];
    for (let k = 0; k < classes; k++) {
      const q = Math.round((row[k] - mid) * SCALE);
      if (Math.abs(q) >= keep * SCALE) kept.push(k, q);
    }
    if (kept.length) w[t] = kept;
  }
  return w;
}

/** The best class for `terms` under pruned weights, as the page scores it. */
export function best(w, classes, terms) {
  const z = new Float64Array(classes);
  for (const t of terms) {
    const e = w[t];
    if (e) for (let k = 0; k < e.length; k += 2) z[e[k]] += e[k + 1] / SCALE;
  }
  let top = 0;
  for (let k = 1; k < classes; k++) if (z[k] > z[top]) top = k;
  return top;
}

async function main() {
  if (!existsSync(join(ASK, 'index.json'))) {
    console.log('ask-meaning: no public/data/ask yet (run make data); skipped');
    return;
  }
  const read = (f) => readFileSync(f, 'utf8');
  const inputs = [join(ASK, 'index.json'), join(ASK, 'also.json'), join(ASK, 'signals.json'), EXAMPLES, join(WEB, 'src/ui/ask/words.ts'), fileURLToPath(import.meta.url)];
  const hash = createHash('sha256');
  for (const f of inputs) hash.update(read(f));
  const key = hash.digest('hex').slice(0, 16);
  if (existsSync(OUT)) {
    try {
      if (JSON.parse(read(OUT)).key === key) return console.log('ask-meaning: up to date');
    } catch {
      // Retrain.
    }
  }
  const index = JSON.parse(read(inputs[0]));
  const also = JSON.parse(read(inputs[1]));
  const signals = JSON.parse(read(inputs[2]));
  const examples = JSON.parse(read(EXAMPLES)).examples;
  const server = await createServer({ root: WEB, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true } });
  let words;
  try {
    words = await server.ssrLoadModule('/src/ui/ask/words.ts');
  } finally {
    await server.close();
  }
  const C = index.questions.length;
  const data = rows(index, also, signals, examples).map(([c, kind, s]) => [c, kind, words.terms(s)]);
  const t0 = Date.now();
  const model = train(data, C);
  const w = prune(model, C);
  // A check that training worked: most questions' own examples find them.
  let right = 0;
  let all = 0;
  for (const [c, kind, ts] of data) {
    if (kind !== 'example' || !ts.size) continue;
    all++;
    if (best(w, C, ts) === c) right++;
  }
  if (all && right / all < 0.8) throw new Error(`ask-meaning: only ${right} of ${all} examples find their own question`);
  const out = { format: 1, key, ids: idsHash(index.questions.map((q) => q.id)), scale: SCALE, w };
  writeFileSync(OUT, JSON.stringify(out));
  const entries = Object.values(w).reduce((s, e) => s + e.length / 2, 0);
  console.log(`ask-meaning: ${data.length} texts, ${model.vocab.size} words, ${entries} weights kept; ${right} of ${all} examples find their own question; ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
