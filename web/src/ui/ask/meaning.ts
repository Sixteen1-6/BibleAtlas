// Ask the Bible's meaning matcher: which prepared question someone most likely
// means, though they share no word with it. "car got repossessed this
// morning" means "I'm drowning in debt". The weights are learned at build time
// (web/scripts/ask-meaning.mjs) from thousands of examples of how people say
// each prepared question, over the same words the router reads (./words). The
// examples closest to what was typed have an equal say: "he left me for his
// secretary" is nearest to things people say of a spouse who cheated.
//
// When the build had the word-meaning model (potion-base-8M, see
// web/scripts/ask-meaning.mjs), the texts it finds closest in meaning have as
// much say as those two together, though they may share no word with what
// was typed: "my mom passed in her sleep" is near "my mother died".

import type { Atlas } from '../../data/atlas';
import { loadBytes, loadJson } from '../extras/data';
import type { AskIndex, Question } from './ask';
import { type Texts, embed, nearestTexts, pieces } from './pieces';
import { terms } from './words';

interface Meaning {
  format: 2;
  /** The fingerprint of the question ids the weights were learned for. */
  ids: string;
  scale: number;
  /** For each word, [question, weight, question, weight, ...] in whole
   * 1/scale units, the question by its place in the index. */
  w: Record<string, number[]>;
  /** The texts learned from: the words, most common first, and for each
   * question (by its place) its texts, as their words' places in base 36
   * joined by spaces, the texts joined by "|". */
  texts: { terms: string[]; rows: string[] };
}

/** How the closest examples count: how many, how much closeness counts
 * (a power), and their share beside the weights. With 1,584 questions,
 * fewer and closer examples kept the matcher as sure as it was with 1,224. */
export const NEAR = { k: 20, power: 4, share: 0.5 };

/** The training texts as weighted words: for each word, the texts holding it
 * and its weight in each (rarer words weigh more; each text's weights have
 * length 1). */
interface Words {
  of: Int32Array;
  idf: Map<string, number>;
  holding: Map<string, [number, number][]>;
}

/** The word-meaning model, as ask/model.bin holds it. */
interface Model {
  /** The fingerprint of the question ids its texts belong to. */
  ids: string;
  /** Each word piece's place in the vocabulary. */
  vocab: Map<string, number>;
  unk: number;
  texts: Texts;
  /** Each text's question, by its place in the index. */
  of: Uint16Array;
}

/** How the model's texts count: how many are compared in full (those whose
 * codes are nearest), how many of the closest have a say, how much closeness
 * counts (a power), and their share beside the words. */
export const MODEL = { rerank: 300, k: 20, power: 8, share: 0.5 };

let meaning: Meaning | null = null;
let near: Words | null = null;
let model: Model | null = null;

/** Loads the weights, and the model when the build wrote it, with the first
 * question typed. */
/** The trainer's key, which vite.config.ts reads from ask/meaning.json as the
 * site is built. Both files carry it in their address, so a deploy that
 * retrains the matcher without changing the data build is never served the
 * old weights from a cache that keys data by the build id alone. */
const KEY = __ASK_KEY__ ? `?k=${__ASK_KEY__}` : '';

export function loadMeaning(a: Atlas): Promise<Meaning> {
  return Promise.all([loadJson<Meaning>(a, `ask/meaning.json${KEY}`), loadBytes(a, `ask/model.bin${KEY}`).then(readModel).catch(() => null)]).then(([m, mm]) => {
    near = null;
    last = null;
    model = mm;
    return (meaning = m);
  });
}

/** Whether the word-meaning model weighs what is typed: it has loaded, and
 * its texts belong to these questions. */
export const usesModel = (): boolean => model !== null && fits?.mm === model && fits.modelOk;

/** ask/model.bin, laid out as web/scripts/ask-meaning.mjs describes. */
function readModel(buf: ArrayBuffer): Model {
  const size = new DataView(buf).getUint32(0, true);
  const h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, size))) as {
    format: number;
    ids: string;
    dims: number;
    bits: number;
    unk: number;
    vocab: number;
    sections: Record<string, [number, number]>;
  };
  if (h.format !== 1) throw new Error(`ask/model.bin: format ${h.format}`);
  const at = <T>(name: string, A: new (b: ArrayBuffer, offset: number, length: number) => T): T => {
    const [offset, length] = h.sections[name];
    return new A(buf, offset, length);
  };
  const words = new TextDecoder().decode(at('vocab', Uint8Array)).split('\n');
  const rowOf = new Int32Array(h.vocab).fill(-1);
  at('kept', Uint16Array).forEach((id, r) => (rowOf[id] = r));
  const lengths = at('lengths', Uint8Array);
  const starts = new Uint32Array(lengths.length + 1);
  for (let t = 0; t < lengths.length; t++) starts[t + 1] = starts[t] + lengths[t];
  const of = new Uint16Array(lengths.length);
  let t = 0;
  at('counts', Uint16Array).forEach((n, c) => of.fill(c, t, (t += n)));
  return {
    ids: h.ids,
    vocab: new Map(words.map((w, i) => [w, i])),
    unk: h.unk,
    of,
    texts: {
      v: { dims: h.dims, rowOf, scales: at('scales', Float32Array), table: at('table', Int8Array) },
      bits: h.bits,
      mean: at('mean', Float32Array),
      proj: at('proj', Float32Array),
      starts,
      pieces: at('pieces', Uint16Array),
      codes: at('codes', Uint32Array),
    },
  };
}

function index(m: Meaning): Words {
  const of: number[] = [];
  const rows: string[][] = [];
  m.texts.rows.forEach((r, c) => {
    if (!r) return;
    for (const t of r.split('|')) {
      of.push(c);
      rows.push(t.split(' ').map((x) => m.texts.terms[parseInt(x, 36)]));
    }
  });
  const df = new Map<string, number>();
  for (const r of rows) for (const t of r) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = new Map([...df].map(([t, n]) => [t, Math.log(1 + rows.length / n)]));
  const holding = new Map<string, [number, number][]>();
  rows.forEach((r, i) => {
    const len = Math.hypot(...r.map((t) => idf.get(t)!)) || 1;
    for (const t of r) {
      let l = holding.get(t);
      if (!l) holding.set(t, (l = []));
      l.push([i, idf.get(t)! / len]);
    }
  });
  return { of: Int32Array.from(of), idf, holding };
}

/** How much each question's closest examples resemble `words`, summing to 1;
 * all 0 when no example shares a word. */
function closest(m: Meaning, words: Set<string>, n: number): Float64Array {
  const x = (near ??= index(m));
  const z = new Float64Array(n);
  // A word no example holds is as rare as can be.
  const q = [...words].map((t) => [t, x.idf.get(t) ?? Math.log(1 + 2 * x.of.length)] as const);
  const len = Math.hypot(...q.map((e) => e[1])) || 1;
  const sim = new Map<number, number>();
  for (const [t, w] of q) for (const [i, v] of x.holding.get(t) ?? []) sim.set(i, (sim.get(i) ?? 0) + (w / len) * v);
  const best = [...sim].sort((a, b) => b[1] - a[1]).slice(0, NEAR.k);
  let sum = 0;
  for (const [i, s] of best) {
    const v = s ** NEAR.power;
    z[x.of[i]] += v;
    sum += v;
  }
  if (sum) for (let k = 0; k < n; k++) z[k] /= sum;
  return z;
}

/** How much each question's texts the model finds closest to `text` resemble
 * it, summing to 1; null when the model knows none of its pieces. */
function closestMeant(mm: Model, text: string, n: number): Float64Array | null {
  const rows = pieces(mm.vocab, text, mm.unk)
    .map((id) => mm.texts.v.rowOf[id])
    .filter((r) => r >= 0);
  const vec = embed(mm.texts.v, rows);
  if (!vec) return null;
  const z = new Float64Array(n);
  let sum = 0;
  for (const [t, s] of nearestTexts(mm.texts, vec, MODEL.k, MODEL.rerank)) {
    const v = Math.max(0, s) ** MODEL.power;
    z[mm.of[t]] += v;
    sum += v;
  }
  if (!sum) return null;
  for (let k = 0; k < n; k++) z[k] /= sum;
  return z;
}

/** FNV-1a over the ids, one per line, as the build writes it. */
function idsHash(ids: string[]): string {
  let h = 0x811c9dc5;
  for (const ch of ids.join('\n')) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

let fits: { ix: AskIndex; m: Meaning; mm: Model | null; ok: boolean; modelOk: boolean } | null = null;

export interface Sense {
  q: Question;
  /** How likely it is what was meant (0 to 1). */
  p: number;
}

/** The last text weighed: a question is weighed several times as it is routed and gathered. */
let last: { ix: AskIndex; m: Meaning; mm: Model | null; text: string; z: Float64Array | null } | null = null;

/** How likely each prepared question is what `text` means, by its place in
 * the index; null before the weights load, or when none of its words is known. */
function likelihoods(ix: AskIndex, text: string): Float64Array | null {
  const m = meaning;
  if (!m) return null;
  if (last?.ix === ix && last.m === m && last.mm === model && last.text === text) return last.z;
  const z = weigh(ix, m, model, text);
  last = { ix, m, mm: model, text, z };
  return z;
}

function weigh(ix: AskIndex, m: Meaning, mm: Model | null, text: string): Float64Array | null {
  if (fits?.ix !== ix || fits.m !== m || fits.mm !== mm) {
    const ids = idsHash(ix.questions.map((q) => q.id));
    fits = { ix, m, mm, ok: m.ids === ids, modelOk: mm?.ids === ids };
  }
  // Weights learned for another list of questions would point to the wrong ones.
  if (!fits.ok) return null;
  const z = new Float64Array(ix.questions.length);
  const words = terms(text);
  let known = false;
  for (const t of words) {
    const e = m.w[t];
    if (!e) continue;
    known = true;
    for (let k = 0; k < e.length; k += 2) z[e[k]] += e[k + 1] / m.scale;
  }
  if (!known) return null;
  const max = Math.max(...z);
  let sum = 0;
  for (let k = 0; k < z.length; k++) sum += z[k] = Math.exp(z[k] - max);
  const c = closest(m, words, z.length);
  for (let k = 0; k < z.length; k++) z[k] = (1 - NEAR.share) * (z[k] / sum) + NEAR.share * c[k];
  const meant = mm && fits.modelOk ? closestMeant(mm, text, z.length) : null;
  if (meant) for (let k = 0; k < z.length; k++) z[k] = (1 - MODEL.share) * z[k] + MODEL.share * meant[k];
  return z;
}

/** The prepared questions `text` most likely means, likeliest first; none
 * before the weights load, or when none of its words is known. */
export function meanings(ix: AskIndex, text: string, limit = 3): Sense[] {
  const z = likelihoods(ix, text);
  if (!z) return [];
  return [...z.keys()]
    .sort((x, y) => z[y] - z[x])
    .slice(0, limit)
    .map((k) => ({ q: ix.questions[k], p: z[k] }));
}

/** How likely `text` means question `q`; null when the matcher cannot tell. */
export function likelihood(ix: AskIndex, text: string, q: Question): number | null {
  const z = likelihoods(ix, text);
  const k = ix.questions.indexOf(q);
  return z && k >= 0 ? z[k] : null;
}
