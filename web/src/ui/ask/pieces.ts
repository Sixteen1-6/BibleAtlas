// The word-meaning model's reading of text: its word pieces, split as its
// tokenizer splits them (BERT's lowercased WordPiece: "repossessed" -> rep,
// ##oss, ##essed), and the direction their vectors point together. The build
// (web/scripts/ask-meaning.mjs) reads every example with this same code, and
// the page reads what was typed with it (./meaning), so this file imports
// nothing.

const isCJK = (cp: number): boolean =>
  (cp >= 0x4e00 && cp <= 0x9fff) ||
  (cp >= 0x3400 && cp <= 0x4dbf) ||
  (cp >= 0x20000 && cp <= 0x2a6df) ||
  (cp >= 0x2a700 && cp <= 0x2b73f) ||
  (cp >= 0x2b740 && cp <= 0x2b81f) ||
  (cp >= 0x2b820 && cp <= 0x2ceaf) ||
  (cp >= 0xf900 && cp <= 0xfaff) ||
  (cp >= 0x2f800 && cp <= 0x2fa1f);

function isPunct(ch: string): boolean {
  const cp = ch.codePointAt(0)!;
  if ((cp >= 33 && cp <= 47) || (cp >= 58 && cp <= 64) || (cp >= 91 && cp <= 96) || (cp >= 123 && cp <= 126)) return true;
  return /\p{P}/u.test(ch);
}

/** The words BERT's basic tokenizer makes of `text`: control characters
 * dropped, lowercased, accents stripped, split at spaces and around every
 * punctuation mark and Chinese character. */
export function basicWords(text: string): string[] {
  let s = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0 || cp === 0xfffd) continue;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || /\p{Zs}/u.test(ch)) {
      s += ' ';
      continue;
    }
    if (/\p{Cc}|\p{Cf}/u.test(ch)) continue;
    s += isCJK(cp) ? ` ${ch} ` : ch;
  }
  s = s.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
  const out: string[] = [];
  for (const w of s.split(' ')) {
    if (!w) continue;
    let cur = '';
    for (const ch of w) {
      if (isPunct(ch)) {
        if (cur) out.push(cur);
        out.push(ch);
        cur = '';
      } else cur += ch;
    }
    if (cur) out.push(cur);
  }
  return out;
}

/** A word's pieces, longest first from the left, by their places in `vocab`;
 * the unknown piece alone when it cannot be split. */
export function wordPieces(vocab: Map<string, number>, word: string, unknown: number): number[] {
  const chars = Array.from(word);
  if (chars.length > 100) return [unknown];
  const ids: number[] = [];
  let start = 0;
  while (start < chars.length) {
    let end = chars.length;
    let found = -1;
    while (start < end) {
      const sub = (start > 0 ? '##' : '') + chars.slice(start, end).join('');
      const id = vocab.get(sub);
      if (id !== undefined) {
        found = id;
        break;
      }
      end--;
    }
    if (found < 0) return [unknown];
    ids.push(found);
    start = end;
  }
  return ids;
}

/** The known pieces of `text`, by their places in `vocab`. */
export function pieces(vocab: Map<string, number>, text: string, unknown: number): number[] {
  return basicWords(text)
    .flatMap((w) => wordPieces(vocab, w, unknown))
    .filter((id) => id !== unknown);
}

/** The model's vectors as the page keeps them: one row of whole numbers per
 * word piece that some text uses, each row times its scale. */
export interface Vectors {
  dims: number;
  /** Each piece's row, by its place in the vocabulary; -1 for a piece no text uses. */
  rowOf: Int32Array;
  scales: Float32Array;
  table: Int8Array;
}

/** The direction the rows' vectors point together, with length 1 (the mean
 * of the vectors, as the model reads a text); null for no rows. */
export function embed(v: Vectors, rows: ArrayLike<number>, out = new Float64Array(v.dims)): Float64Array | null {
  const D = v.dims;
  out.fill(0);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const s = v.scales[r];
    for (let d = 0, o = r * D; d < D; d++) out[d] += v.table[o + d] * s;
  }
  let n = 0;
  for (let d = 0; d < D; d++) n += out[d] * out[d];
  if (!n) return null;
  n = 1 / Math.sqrt(n);
  for (let d = 0; d < D; d++) out[d] *= n;
  return out;
}

/** A direction's short code: a bit for each row of `proj` (bits by dims), set
 * where the direction, less `mean`, leans that way. Directions close together
 * share most bits. */
export function code(vec: ArrayLike<number>, mean: ArrayLike<number>, proj: ArrayLike<number>, bits: number, out = new Uint32Array(bits >> 5)): Uint32Array {
  const D = mean.length;
  out.fill(0);
  for (let b = 0; b < bits; b++) {
    let s = 0;
    for (let d = 0, o = b * D; d < D; d++) s += proj[o + d] * (vec[d] - mean[d]);
    if (s > 0) out[b >> 5] |= 1 << (b & 31);
  }
  return out;
}

/** How many bits are set in a 32-bit number. */
export function bitCount(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
}

/** Texts as the model reads them: each text's pieces (as rows of the
 * vectors) and its code. */
export interface Texts {
  v: Vectors;
  bits: number;
  mean: Float32Array;
  proj: Float32Array;
  /** Where each text's pieces start, and where the last one's end. */
  starts: Uint32Array;
  pieces: Uint16Array;
  codes: Uint32Array;
}

/** The `k` texts that mean most nearly what `vec` (length 1) does, as [text,
 * closeness] pairs, closest first: of the `rerank` texts whose codes share
 * most bits with its code, those whose own directions are closest. `skip`
 * leaves one text out. */
export function nearestTexts(x: Texts, vec: Float64Array, k: number, rerank: number, skip = -1): [number, number][] {
  const W = x.bits >> 5;
  const N = x.starts.length - 1;
  const q = code(vec, x.mean, x.proj, x.bits);
  const dist = new Uint8Array(N);
  const count = new Uint32Array(x.bits + 1);
  for (let t = 0; t < N; t++) {
    let h = 0;
    for (let w = 0, o = t * W; w < W; w++) h += bitCount(q[w] ^ x.codes[o + w]);
    dist[t] = h;
    if (t !== skip) count[h]++;
  }
  // Every text nearer than `cut` bits, and the first of those at it.
  let cut = 0;
  let nearer = 0;
  while (cut < x.bits && nearer + count[cut] < rerank) nearer += count[cut++];
  let room = rerank - nearer;
  const D = x.v.dims;
  const e = new Float64Array(D);
  const best: [number, number][] = [];
  for (let t = 0; t < N; t++) {
    if (t === skip || dist[t] > cut) continue;
    if (dist[t] === cut && room-- <= 0) continue;
    if (!embed(x.v, x.pieces.subarray(x.starts[t], x.starts[t + 1]), e)) continue;
    let s = 0;
    for (let d = 0; d < D; d++) s += vec[d] * e[d];
    if (best.length === k && s <= best[k - 1][1]) continue;
    // Into its place, the last dropping out once there are k.
    let i = Math.min(best.length, k - 1);
    for (; i > 0 && best[i - 1][1] < s; i--) best[i] = best[i - 1];
    best[i] = [t, s];
  }
  return best;
}
