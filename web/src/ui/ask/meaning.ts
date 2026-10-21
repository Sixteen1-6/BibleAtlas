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
import { type ModelFile, embed, nearestTexts, pieces, readModelFile } from './pieces';
import { terms } from './words';

interface Meaning {
  format: 2;
  /** The trainer's key (web/scripts/ask-meaning.mjs). */
  key: string;
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

type Model = ModelFile;

/** How the model's texts count: how many are compared in full (those whose
 * codes are nearest), how many of the closest have a say, how much closeness
 * counts (a power), and their share beside the words. Comparing 1,000 rather
 * than 300 made the model's own first pick right for 783 of 1,493 labelled
 * messages rather than 766, for about 8 ms more a question. */
export const MODEL = { rerank: 1000, k: 20, power: 8, share: 0.5 };

let meaning: Meaning | null = null;
let near: Words | null = null;
let model: Model | null = null;

/** The trainer's key, which vite.config.ts reads from ask/meaning.json as the
 * site is built. Both files carry it in their address, so a deploy that
 * retrains the matcher without changing the data build is never served the
 * old weights from a cache that keys data by the build id alone. */
const KEY = __ASK_KEY__ ? `?k=${__ASK_KEY__}` : '';

/** How long the first answer waits for the model once the weights are in,
 * in milliseconds. On a slow line it answers by the words alone, and the
 * model joins in for the questions after, once it has come. */
export const MODEL_WAIT = 4000;

let loading: { a: Atlas; p: Promise<Meaning> } | null = null;

/** Loads the weights, and the model when the build wrote it, with the first
 * question typed. */
export function loadMeaning(a: Atlas): Promise<Meaning> {
  if (loading?.a === a) return loading.p;
  const words = loadJson<Meaning>(a, `ask/meaning.json${KEY}`);
  const meant = loadBytes(a, `ask/model.bin${KEY}`)
    .then(readModelFile)
    .catch((e) => {
      if (import.meta.env.DEV) console.warn('Ask: the word-meaning model did not load;', e);
      return null;
    });
  const p = words.then((m) => {
    near = null;
    last = null;
    meaning = m;
    model = null;
    void meant.then((mm) => {
      // A model trained beside other weights would not fit them.
      if (!mm || mm.key !== m.key || meaning !== m) return;
      model = mm;
      last = null;
    });
    return Promise.race([meant, new Promise((done) => setTimeout(done, MODEL_WAIT))]).then(() => m);
  });
  const entry = { a, p };
  loading = entry;
  p.catch(() => {
    if (loading === entry) loading = null;
  });
  return p;
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
  const vec = embed(mm.texts.v, pieces(mm.vocab, text, mm.unk));
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

/** What weighing a text found: each question's likelihood, and whether the
 * model's closest texts had their say. */
interface Weighed {
  z: Float64Array;
  meant: boolean;
}

/** The last text weighed: a question is weighed several times as it is routed and gathered. */
let last: { ix: AskIndex; m: Meaning; mm: Model | null; text: string; w: Weighed | null } | null = null;

/** How likely each prepared question is what `text` means, by its place in
 * the index; null before the weights load, or when none of its words is known. */
function likelihoods(ix: AskIndex, text: string): Weighed | null {
  const m = meaning;
  if (!m) return null;
  if (last?.ix === ix && last.m === m && last.mm === model && last.text === text) return last.w;
  const w = weigh(ix, m, model, text);
  last = { ix, m, mm: model, text, w };
  return w;
}

/** Whether the word-meaning model had a say in how `text` was weighed (it
 * loaded, its texts belong to these questions, and it knows some of the
 * text's pieces), so the likelihoods are the blend MEANT.model was set for. */
export const usesModel = (ix: AskIndex, text: string): boolean => likelihoods(ix, text)?.meant ?? false;

function weigh(ix: AskIndex, m: Meaning, mm: Model | null, text: string): Weighed | null {
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
  return { z, meant: meant !== null };
}

/** The prepared questions `text` most likely means, likeliest first; none
 * before the weights load, or when none of its words is known. */
export function meanings(ix: AskIndex, text: string, limit = 3): Sense[] {
  const z = likelihoods(ix, text)?.z;
  if (!z) return [];
  return [...z.keys()]
    .sort((x, y) => z[y] - z[x])
    .slice(0, limit)
    .map((k) => ({ q: ix.questions[k], p: z[k] }));
}

/** How likely `text` means question `q`; null when the matcher cannot tell. */
export function likelihood(ix: AskIndex, text: string, q: Question): number | null {
  const z = likelihoods(ix, text)?.z;
  const k = ix.questions.indexOf(q);
  return z && k >= 0 ? z[k] : null;
}
