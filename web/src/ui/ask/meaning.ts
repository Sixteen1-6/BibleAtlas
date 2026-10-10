// Ask the Bible's meaning matcher: which prepared question someone most likely
// means, though they share no word with it. "car got repossessed this
// morning" means "I'm drowning in debt". The weights are learned at build time
// (web/scripts/ask-meaning.mjs) from thousands of examples of how people say
// each prepared question, over the same words the router reads (./words).

import type { Atlas } from '../../data/atlas';
import { loadJson } from '../extras/data';
import type { AskIndex, Question } from './ask';
import { terms } from './words';

interface Meaning {
  format: 1;
  /** The fingerprint of the question ids the weights were learned for. */
  ids: string;
  scale: number;
  /** For each word, [question, weight, question, weight, ...] in whole
   * 1/scale units, the question by its place in the index. */
  w: Record<string, number[]>;
}

let meaning: Meaning | null = null;

/** Loads the weights, with the first question typed. */
export function loadMeaning(a: Atlas): Promise<Meaning> {
  return loadJson<Meaning>(a, 'ask/meaning.json').then((m) => (meaning = m));
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

let fits: { ix: AskIndex; m: Meaning; ok: boolean } | null = null;

export interface Sense {
  q: Question;
  /** How likely it is what was meant (0 to 1). */
  p: number;
}

/** How likely each prepared question is what `text` means, by its place in
 * the index; null before the weights load, or when none of its words is known. */
function likelihoods(ix: AskIndex, text: string): Float64Array | null {
  const m = meaning;
  if (!m) return null;
  if (fits?.ix !== ix || fits.m !== m) fits = { ix, m, ok: m.ids === idsHash(ix.questions.map((q) => q.id)) };
  // Weights learned for another list of questions would point to the wrong ones.
  if (!fits.ok) return null;
  const z = new Float64Array(ix.questions.length);
  let known = false;
  for (const t of terms(text)) {
    const e = m.w[t];
    if (!e) continue;
    known = true;
    for (let k = 0; k < e.length; k += 2) z[e[k]] += e[k + 1] / m.scale;
  }
  if (!known) return null;
  const max = Math.max(...z);
  let sum = 0;
  for (let k = 0; k < z.length; k++) sum += z[k] = Math.exp(z[k] - max);
  for (let k = 0; k < z.length; k++) z[k] /= sum;
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
