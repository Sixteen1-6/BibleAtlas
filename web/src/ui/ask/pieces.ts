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
  (cp >= 0x2b920 && cp <= 0x2ceaf) ||
  (cp >= 0xf900 && cp <= 0xfaff) ||
  (cp >= 0x2f800 && cp <= 0x2fa1f);

function isPunct(ch: string): boolean {
  const cp = ch.codePointAt(0)!;
  if ((cp >= 33 && cp <= 47) || (cp >= 58 && cp <= 64) || (cp >= 91 && cp <= 96) || (cp >= 123 && cp <= 126)) return true;
  return /\p{P}/u.test(ch);
}

/** The words BERT's basic tokenizer makes of `text`: control characters
 * dropped, accents stripped, lowercased, split at spaces and around every
 * punctuation mark and Chinese character. */
export function basicWords(text: string): string[] {
  let s = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0 || cp === 0xfffd) continue;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || /\p{Zs}|\p{Zl}|\p{Zp}/u.test(ch)) {
      s += ' ';
      continue;
    }
    if (/\p{Cc}|\p{Cf}|\p{Cn}|\p{Co}|\p{Cs}/u.test(ch)) continue;
    s += isCJK(cp) ? ` ${ch} ` : ch;
  }
  // Accents first, then each character lowercased on its own, as the
  // tokenizer does (so a final capital sigma becomes σ, not ς).
  s = Array.from(s.normalize('NFD').replace(/\p{Mn}/gu, ''), (c) => c.toLowerCase()).join('');
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

/** The model's vectors as the page keeps them: one row of whole numbers for
 * every word piece, each row times its scale. */
export interface Vectors {
  dims: number;
  scales: Float32Array;
  table: Int8Array;
}

/** The direction the pieces' vectors point together, with length 1 (the
 * mean of the vectors, as the model reads a text); null for no pieces. */
export function embed(v: Vectors, ids: ArrayLike<number>, out = new Float64Array(v.dims)): Float64Array | null {
  const D = v.dims;
  out.fill(0);
  for (let i = 0; i < ids.length; i++) {
    const r = ids[i];
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

/** Texts as the model reads them: each text's pieces and its code. */
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
  // Every text at least as near as `cut` bits, the smallest cut that takes
  // `rerank` of them (all at the cut, so none is favoured for its place).
  let cut = 0;
  let nearer = count[0];
  while (cut < x.bits && nearer < rerank) nearer += count[++cut];
  const D = x.v.dims;
  const e = new Float64Array(D);
  const best: [number, number][] = [];
  for (let t = 0; t < N; t++) {
    if (t === skip || dist[t] > cut) continue;
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

/** The word-meaning model as ask/model.bin holds it (written by
 * web/scripts/ask-meaning.mjs, which reads it back with this to check it). */
export interface ModelFile {
  /** The trainer's key; ask/meaning.json carries the same one. */
  key: string;
  /** The fingerprint of the question ids its texts belong to. */
  ids: string;
  /** Each word piece's place in the vocabulary. */
  vocab: Map<string, number>;
  unk: number;
  texts: Texts;
  /** Each text's question, by its place in the index. */
  of: Uint16Array;
}

/** Reads ask/model.bin: a little-endian uint32 giving the header's length,
 * the header (JSON), then the sections it lists as [byte offset, count]:
 * vocab (the word pieces as UTF-8 joined by "\n"), scales (float32, one per
 * piece), table (each piece's vector as whole multiples of its scale: int8,
 * or two to a byte when the header's q is 4, low half first, stored plus 8),
 * mean and proj (float32, the codes' centre and directions), counts (uint16,
 * how many texts each question has), lengths (uint8, how many pieces each
 * text has), pieces (uint16, every text's pieces in order) and codes (uint32).
 * The header's size is the file's length. Throws on anything that does not
 * fit together. */
export function readModelFile(buf: ArrayBuffer): ModelFile {
  const bad = (why: string): never => {
    throw new Error(`ask/model.bin: ${why}`);
  };
  if (buf.byteLength < 4) bad('too short');
  const size = new DataView(buf).getUint32(0, true);
  if (4 + size > buf.byteLength) bad('cut short');
  const h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, size))) as {
    format: number;
    key: string;
    ids: string;
    dims: number;
    q: number;
    bits: number;
    unk: number;
    vocab: number;
    texts: number;
    size: number;
    sections: Record<string, [number, number]>;
  };
  if (h.format !== 2) bad(`format ${h.format}`);
  if (h.size !== buf.byteLength) bad(`${buf.byteLength} bytes, not ${h.size}`);
  if (h.q !== 4 && h.q !== 8) bad(`${h.q}-bit vectors`);
  const at = <T>(name: string, A: { new (b: ArrayBuffer, offset: number, length: number): T; BYTES_PER_ELEMENT: number }, count?: number): T => {
    const s = h.sections[name];
    if (!s) bad(`no ${name}`);
    const [offset, length] = s;
    if (count !== undefined && length !== count) bad(`${name} holds ${length}, not ${count}`);
    if (offset % A.BYTES_PER_ELEMENT || offset + length * A.BYTES_PER_ELEMENT > buf.byteLength) bad(`${name} is out of place`);
    return new A(buf, offset, length);
  };
  const words = new TextDecoder().decode(at('vocab', Uint8Array)).split('\n');
  if (words.length !== h.vocab) bad('vocabulary length');
  const D = h.dims;
  const packed = at('table', Uint8Array, (h.vocab * D * h.q) / 8);
  let table: Int8Array;
  if (h.q === 8) table = new Int8Array(packed.buffer, packed.byteOffset, packed.length);
  else {
    table = new Int8Array(h.vocab * D);
    for (let i = 0; i < packed.length; i++) {
      table[2 * i] = (packed[i] & 15) - 8;
      table[2 * i + 1] = (packed[i] >> 4) - 8;
    }
  }
  const lengths = at('lengths', Uint8Array, h.texts);
  const starts = new Uint32Array(h.texts + 1);
  for (let t = 0; t < h.texts; t++) starts[t + 1] = starts[t] + lengths[t];
  const pieces = at('pieces', Uint16Array, starts[h.texts]);
  for (let i = 0; i < pieces.length; i++) if (pieces[i] >= h.vocab) bad('a piece outside the vocabulary');
  const of = new Uint16Array(h.texts);
  let t = 0;
  for (const [c, n] of at('counts', Uint16Array).entries()) {
    if (t + n > h.texts) bad('more texts counted than held');
    of.fill(c, t, (t += n));
  }
  if (t !== h.texts) bad('fewer texts counted than held');
  return {
    key: h.key,
    ids: h.ids,
    vocab: new Map(words.map((w, i) => [w, i])),
    unk: h.unk,
    of,
    texts: {
      v: { dims: D, scales: at('scales', Float32Array, h.vocab), table },
      bits: h.bits,
      mean: at('mean', Float32Array, D),
      proj: at('proj', Float32Array, h.bits * D),
      starts,
      pieces,
      codes: at('codes', Uint32Array, (h.texts * h.bits) / 32),
    },
  };
}
