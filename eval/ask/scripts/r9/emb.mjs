// Static-embedding helpers for the prototype: BERT-style WordPiece tokenizing and
// mean-pooled potion-base-8M vectors, as model2vec does it.
import { readFileSync } from 'node:fs';

export function loadModel(dir) {
  const tok = JSON.parse(readFileSync(`${dir}/tokenizer.json`, 'utf8'));
  const vocab = new Map(Object.entries(tok.model.vocab));
  const b = readFileSync(`${dir}/model.safetensors`);
  const n = Number(b.readBigUInt64LE(0));
  const h = JSON.parse(b.subarray(8, 8 + n).toString('utf8'));
  const e = h.embeddings;
  const [rows, dims] = e.shape;
  const start = 8 + n + e.data_offsets[0];
  const E = new Float32Array(rows * dims);
  for (let i = 0; i < rows * dims; i++) E[i] = b.readFloatLE(start + 4 * i);
  return { vocab, E, rows, dims, unk: vocab.get('[UNK]') };
}

const isCJK = (cp) =>
  (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x20000 && cp <= 0x2a6df) || (cp >= 0x2a700 && cp <= 0x2b73f) ||
  (cp >= 0x2b740 && cp <= 0x2b81f) || (cp >= 0x2b820 && cp <= 0x2ceaf) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x2f800 && cp <= 0x2fa1f);
const isPunct = (ch) => {
  const cp = ch.codePointAt(0);
  if ((cp >= 33 && cp <= 47) || (cp >= 58 && cp <= 64) || (cp >= 91 && cp <= 96) || (cp >= 123 && cp <= 126)) return true;
  return /\p{P}/u.test(ch);
};

/** The words BERT's basic tokenizer splits text into: cleaned, lowercased,
 * accents stripped, split at spaces and around every punctuation mark. */
export function basic(text) {
  let s = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === 0 || cp === 0xfffd) continue;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || /\p{Zs}/u.test(ch)) { s += ' '; continue; }
    if (/\p{Cc}|\p{Cf}/u.test(ch)) continue;
    s += isCJK(cp) ? ` ${ch} ` : ch;
  }
  s = s.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
  const out = [];
  for (const w of s.split(' ')) {
    if (!w) continue;
    let cur = '';
    for (const ch of w) {
      if (isPunct(ch)) { if (cur) out.push(cur); out.push(ch); cur = ''; } else cur += ch;
    }
    if (cur) out.push(cur);
  }
  return out;
}

/** Greedy longest-match-first WordPiece. */
export function wordpiece(vocab, word, unk) {
  const chars = Array.from(word);
  if (chars.length > 100) return [unk];
  const ids = [];
  let start = 0;
  while (start < chars.length) {
    let end = chars.length;
    let cur = null;
    while (start < end) {
      let sub = chars.slice(start, end).join('');
      if (start > 0) sub = '##' + sub;
      const id = vocab.get(sub);
      if (id !== undefined) { cur = id; break; }
      end--;
    }
    if (cur === null) return [unk];
    ids.push(cur);
    start = end;
  }
  return ids;
}

export function tokenize(m, text) {
  return basic(text).flatMap((w) => wordpiece(m.vocab, w, m.unk));
}

/** The normalized mean of the tokens' vectors, unknown tokens left out; null if none. */
export function embed(m, text, out = new Float32Array(m.dims)) {
  out.fill(0);
  let n = 0;
  for (const id of tokenize(m, text)) {
    if (id === m.unk) continue;
    const o = id * m.dims;
    for (let d = 0; d < m.dims; d++) out[d] += m.E[o + d];
    n++;
  }
  if (!n) return null;
  let len = 0;
  for (let d = 0; d < m.dims; d++) len += out[d] * out[d];
  len = Math.sqrt(len) || 1;
  for (let d = 0; d < m.dims; d++) out[d] /= len;
  return out;
}
