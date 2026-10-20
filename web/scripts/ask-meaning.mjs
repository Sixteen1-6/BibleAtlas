// Ask the Bible's meaning matcher: which prepared question fits what someone
// typed, learned from how people say each one.
//
// For every prepared question the repository holds its title and other ways of
// asking (config/questions.json), the everyday words that point to it, and
// example messages people might type (config/ask-examples.json): "the repo man
// took my truck at 5am" for "drowning in debt". This trains a softmax
// regression over the words Ask the Bible reads (web/src/ui/ask/words.ts, the
// same code the page runs), so words like "rehab", "repo" and "chemo" come to
// weigh toward the questions people use them about. It writes the weights
// worth keeping to public/data/ask/meaning.json, with the words of every text
// it learned from, so the page can also find the texts closest to what was
// typed; the page loads it with the first question typed
// (web/src/ui/ask/meaning.ts).
//
// It also writes public/data/ask/model.bin, when `atlas fetch` has fetched
// the word-meaning model potion-base-8M (sources.json "potion-base-8m"): a
// vector for each English word piece, so that texts which mean alike point
// alike though they share no word. The file holds the vectors of
// the pieces the texts use, and every text as its pieces and a short code, so
// the page can find the texts that mean most nearly what was typed (see
// web/src/ui/ask/pieces.ts and meaning.ts). Without the model the page
// matches as before.
//
// Runs before `npm run build` and `npm run dev`, after `make data` has written
// public/data/ask. It is deterministic, and skips its work when its inputs
// have not changed.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const ASK = join(WEB, 'public/data/ask');
const EXAMPLES = join(WEB, '../config/ask-examples.json');
const OUT = join(ASK, 'meaning.json');
const MODEL_OUT = join(ASK, 'model.bin');
const LOCK = join(WEB, '../data/raw/manifest.lock.json');

/** The texts' short codes: how many bits, and the seed of the directions
 * they are taken along. */
export const CODES = { bits: 128, seed: 7 };

/** How much each kind of text counts in training. */
export const KINDS = { title: 2, also: 2, signal: 1, example: 1 };
export const TRAIN = { epochs: 8, rate: 0.5, l2: 1e-3, seed: 1 };
/** Weights are written as whole numbers of 1/SCALE; those under KEEP are
 * dropped. */
export const SCALE = 100;
export const KEEP = 1;

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
      // Every question learns from every row, so a word also learns which
      // questions it does not point to ("child" in a question about a stutter
      // is not about wanting a child).
      for (const t of f) {
        for (let k = 0, o = t * C; k < C; k++) {
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

/** The words of every training text, for finding the texts closest to what
 * is typed: the words, the most common first, and for each question its
 * texts, each as its words' places in base 36 joined by spaces, the texts
 * joined by "|". */
export function texts(data, classes) {
  const df = new Map();
  for (const [, , ts] of data) for (const t of ts) df.set(t, (df.get(t) ?? 0) + 1);
  const terms = [...df.keys()].sort((a, b) => df.get(b) - df.get(a) || (a < b ? -1 : 1));
  const at = new Map(terms.map((t, i) => [t, i.toString(36)]));
  const rows = Array.from({ length: classes }, () => []);
  for (const [c, , ts] of data) if (ts.size) rows[c].push([...ts].map((t) => at.get(t)).join(' '));
  return { terms, rows: rows.map((r) => r.join('|')) };
}

/** The fetched model's files, or null when `atlas fetch` has not fetched
 * them (it checks each file's SHA-256 against sources.json). */
export function modelFiles(lock = LOCK) {
  if (!existsSync(lock)) return null;
  const src = JSON.parse(readFileSync(lock, 'utf8')).sources.find((s) => s.id === 'potion-base-8m');
  if (!src) return null;
  const at = (k) => join(dirname(lock), src.files[k].path);
  const files = { tokenizer: at('tokenizer'), embeddings: at('embeddings'), sha: `${src.files.tokenizer.sha256} ${src.files.embeddings.sha256}` };
  return existsSync(files.tokenizer) && existsSync(files.embeddings) ? files : null;
}

/** The model's vocabulary and vectors. Its tokenizer must be the lowercased
 * WordPiece that web/src/ui/ask/pieces.ts reads. */
export function readModel(files) {
  const tok = JSON.parse(readFileSync(files.tokenizer, 'utf8'));
  const m = tok.model ?? {};
  const n = tok.normalizer ?? {};
  if (m.type !== 'WordPiece' || m.continuing_subword_prefix !== '##' || m.max_input_chars_per_word !== 100 || n.type !== 'BertNormalizer' || n.lowercase !== true || n.strip_accents === false || n.clean_text !== true || n.handle_chinese_chars !== true || tok.pre_tokenizer?.type !== 'BertPreTokenizer') {
    throw new Error('ask-meaning: the model\'s tokenizer is not the lowercased WordPiece web/src/ui/ask/pieces.ts reads');
  }
  const vocab = [];
  for (const [t, id] of Object.entries(m.vocab)) vocab[id] = t;
  if (vocab.length !== Object.keys(m.vocab).length || vocab.some((t) => !t || t.includes('\n'))) throw new Error('ask-meaning: the model\'s vocabulary has gaps');
  const b = readFileSync(files.embeddings);
  const h = Number(b.readBigUInt64LE(0));
  const e = JSON.parse(b.subarray(8, 8 + h).toString('utf8')).embeddings;
  if (e?.dtype !== 'F32' || e.shape?.length !== 2 || e.shape[0] !== vocab.length) throw new Error('ask-meaning: the model\'s vectors are not one row of 32-bit numbers per word piece');
  const [rows, dims] = e.shape;
  const start = 8 + h + e.data_offsets[0];
  const E = new Float32Array(rows * dims);
  for (let i = 0; i < E.length; i++) E[i] = b.readFloatLE(start + 4 * i);
  return { vocab, unk: m.vocab[m.unk_token], E, dims };
}

/** Random directions to take the codes along (bits by dims), the same on every run. */
function directions(bits, dims, seed) {
  const rand = random(seed);
  const out = new Float32Array(bits * dims);
  for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(-2 * Math.log(rand() || 1e-12)) * Math.cos(2 * Math.PI * rand());
  return out;
}

/** model.bin: a little-endian uint32 giving the header's length, the header
 * (JSON, padded with spaces to a multiple of 4 bytes), then the sections the
 * header lists as [byte offset, count], each starting on a multiple of 4:
 * - vocab: the model's word pieces in order, as UTF-8 joined by "\n" (count: bytes)
 * - kept: uint16, the place in vocab of each piece some text uses, in order
 * - scales: float32, each kept piece's scale
 * - table: int8, each kept piece's vector as whole multiples of its scale (dims each)
 * - mean: float32, the texts' mean direction (dims)
 * - proj: float32, the directions the codes are taken along (bits by dims)
 * - counts: uint16, how many texts each question has, in the index's order
 * - lengths: uint8, how many pieces each text has
 * - pieces: uint16, each text's pieces as kept rows, the texts in order
 * - codes: uint32, each text's code (bits / 32 each)
 * A question's texts are its title, its other ways of asking and its
 * examples, each once. */
export function modelBin(model, P, index, also, examples, header) {
  const vmap = new Map(model.vocab.map((t, i) => [t, i]));
  const texts = index.questions.map((q, i) => {
    const seen = new Set();
    const out = [];
    for (const s of [q.q, ...(also[i] ?? []), ...(examples[q.id] ?? [])]) {
      const p = P.pieces(vmap, s, model.unk).slice(0, 255);
      const k = p.join(' ');
      if (p.length && !seen.has(k)) {
        seen.add(k);
        out.push(p);
      }
    }
    return out;
  });
  const flat = texts.flat();
  const kept = [...new Set(flat.flat())].sort((a, b) => a - b);
  if (kept.length > 0xffff || model.vocab.length > 0xffff) throw new Error('ask-meaning: too many word pieces for 16-bit places');
  const D = model.dims;
  const rowOf = new Int32Array(model.vocab.length).fill(-1);
  const scales = new Float32Array(kept.length);
  const table = new Int8Array(kept.length * D);
  kept.forEach((id, r) => {
    rowOf[id] = r;
    let max = 0;
    for (let d = 0; d < D; d++) max = Math.max(max, Math.abs(model.E[id * D + d]));
    scales[r] = max / 127 || 1;
    for (let d = 0; d < D; d++) table[r * D + d] = Math.max(-127, Math.min(127, Math.round(model.E[id * D + d] / scales[r])));
  });
  const V = { dims: D, rowOf, scales, table };
  const rows = flat.map((p) => p.map((id) => rowOf[id]));
  const vecs = rows.map((r) => P.embed(V, r, new Float64Array(D)));
  const sum = new Float64Array(D);
  for (const v of vecs) for (let d = 0; d < D; d++) sum[d] += v[d];
  const mean = Float32Array.from(sum, (x) => x / vecs.length);
  const { bits, seed } = CODES;
  const proj = directions(bits, D, seed);
  const W = bits >> 5;
  const codes = new Uint32Array(vecs.length * W);
  vecs.forEach((v, t) => codes.set(P.code(v, mean, proj, bits), t * W));
  const sections = {
    vocab: Buffer.from(model.vocab.join('\n'), 'utf8'),
    kept: Uint16Array.from(kept),
    scales,
    table,
    mean,
    proj,
    counts: Uint16Array.from(texts, (t) => t.length),
    lengths: Uint8Array.from(rows, (r) => r.length),
    pieces: Uint16Array.from(rows.flat()),
    codes,
  };
  const head = { format: 1, ...header, dims: D, bits, unk: model.unk, vocab: model.vocab.length, rows: kept.length, texts: vecs.length, sections: {} };
  // The offsets depend on the header's length, and it on them: grow its room
  // until it holds them.
  let room = 0;
  for (;;) {
    let at = 4 + room;
    for (const [k, v] of Object.entries(sections)) {
      head.sections[k] = [at, v.length];
      at += Math.ceil(v.byteLength / 4) * 4;
    }
    const text = JSON.stringify(head);
    const need = Math.ceil(Buffer.byteLength(text) / 4) * 4;
    if (need <= room) {
      const parts = [Buffer.alloc(4), Buffer.from(text.padEnd(room, ' '), 'utf8')];
      parts[0].writeUInt32LE(room);
      for (const v of Object.values(sections)) parts.push(Buffer.from(v.buffer, v.byteOffset, v.byteLength), Buffer.alloc(Math.ceil(v.byteLength / 4) * 4 - v.byteLength));
      const starts = new Uint32Array(rows.length + 1);
      rows.forEach((r, t) => (starts[t + 1] = starts[t] + r.length));
      return { bytes: Buffer.concat(parts), x: { v: V, bits, mean, proj, starts, pieces: sections.pieces, codes }, rows, counts: sections.counts };
    }
    room = need;
  }
}

/** A check that the codes find texts: how many of a sample of texts have a
 * nearest other text, found as the page finds them, of their own question.
 * About half do, as many as when every text is compared; a broken reading of
 * the model finds almost none. */
export function selfCheck(P, built, sample = 400) {
  const { x, rows, counts } = built;
  const of = new Int32Array(rows.length);
  let t0 = 0;
  counts.forEach((n, c) => of.fill(c, t0, (t0 += n)));
  const v = new Float64Array(x.v.dims);
  let right = 0;
  for (let s = 0; s < sample; s++) {
    const t = Math.floor(((s + 0.5) * rows.length) / sample);
    const [best] = P.nearestTexts(x, P.embed(x.v, rows[t], v), 1, 300, t);
    if (best && of[best[0]] === of[t]) right++;
  }
  return { right, sample };
}

async function main() {
  if (!existsSync(join(ASK, 'index.json'))) {
    console.log('ask-meaning: no public/data/ask yet (run make data); skipped');
    return;
  }
  const read = (f) => readFileSync(f, 'utf8');
  const inputs = [join(ASK, 'index.json'), join(ASK, 'also.json'), join(ASK, 'signals.json'), EXAMPLES, join(WEB, 'src/ui/ask/words.ts'), join(WEB, 'src/ui/ask/pieces.ts'), fileURLToPath(import.meta.url)];
  const files = modelFiles();
  const hash = createHash('sha256');
  for (const f of inputs) hash.update(read(f));
  hash.update(files ? files.sha : 'no model');
  const key = hash.digest('hex').slice(0, 16);
  if (existsSync(OUT) && (files ? existsSync(MODEL_OUT) : !existsSync(MODEL_OUT))) {
    try {
      const modelKey = () => {
        const b = readFileSync(MODEL_OUT);
        return JSON.parse(b.subarray(4, 4 + b.readUInt32LE(0)).toString('utf8')).key;
      };
      if (JSON.parse(read(OUT)).key === key && (!files || modelKey() === key)) return console.log('ask-meaning: up to date');
    } catch {
      // Build again.
    }
  }
  const index = JSON.parse(read(inputs[0]));
  const also = JSON.parse(read(inputs[1]));
  const signals = JSON.parse(read(inputs[2]));
  const examples = JSON.parse(read(EXAMPLES)).examples;
  const server = await createServer({ root: WEB, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true } });
  let words;
  let P;
  try {
    words = await server.ssrLoadModule('/src/ui/ask/words.ts');
    P = await server.ssrLoadModule('/src/ui/ask/pieces.ts');
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
  if (all && right / all < 0.7) throw new Error(`ask-meaning: only ${right} of ${all} examples find their own question`);
  const ids = idsHash(index.questions.map((q) => q.id));
  const out = { format: 2, key, ids, scale: SCALE, w, texts: texts(data, C) };
  writeFileSync(OUT, JSON.stringify(out));
  const entries = Object.values(w).reduce((s, e) => s + e.length / 2, 0);
  console.log(`ask-meaning: ${data.length} texts, ${model.vocab.size} words, ${entries} weights kept; ${right} of ${all} examples find their own question; ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (!files) {
    rmSync(MODEL_OUT, { force: true });
    console.log('ask-meaning: the word-meaning model is not fetched (make fetch); model.bin not written');
    return;
  }
  const t1 = Date.now();
  const built = modelBin(readModel(files), P, index, also, examples, { key, ids });
  const check = selfCheck(P, built);
  if (check.right / check.sample < 0.35) throw new Error(`ask-meaning: the model's codes find a text of the same question for only ${check.right} of ${check.sample} texts`);
  writeFileSync(MODEL_OUT, built.bytes);
  console.log(`ask-meaning: model.bin ${(built.bytes.length / 1e6).toFixed(1)} MB, ${built.rows.length} texts, ${built.x.v.scales.length} word pieces; ${check.right} of ${check.sample} texts find one of their own question; ${((Date.now() - t1) / 1000).toFixed(1)}s`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
