// Ask the Bible: which prepared question answers what someone typed.
//
// Every prepared question comes with the ways people ask it ("also"), written
// for search, and the everyday words people use about it ("signals": layoffs,
// severance). What someone types is matched against those: a question opens
// when one of its ways of asking is said, nearly whole, in what they typed
// ("my husband is hooked on pills and lies about it" says most of "husband
// hooked on pills"), and its question covers most of what they typed. Words
// that many questions share count for little, rare ones for much. First,
// though, the meaning matcher (./meaning) opens the question people plainly
// mean by what they typed, even when it shares no word with it.

import type { Atlas } from '../../data/atlas';
import { loadJson } from '../extras/data';
import { type AskIndex, type Question, exactQuestion } from './ask';
import { meanings } from './meaning';
import { terms } from './words';

/** The everyday words that point to each question ("layoffs", "chemo"), in
 * the index's order, once loaded. */
let signals: string[][] | null = null;

/** Loads the signal words, with the first question typed. */
export function loadSignals(a: Atlas): Promise<string[][]> {
  return loadJson<string[][]>(a, 'ask/signals.json').then((s) => (signals = s));
}

interface Routing {
  ix: AskIndex;
  signals: string[][] | null;
  /** Each question's ways of asking, as term sets. */
  ways: Set<string>[][];
  /** Each question's signal words, as term sets. */
  sig: Set<string>[][];
  /** Each question's terms, all ways together. */
  all: Set<string>[];
  /** Each question's own title's terms. */
  title: Set<string>[];
  idf: Map<string, number>;
  /** How many questions use each term. */
  df: Map<string, number>;
  /** The weight of a term no question uses. */
  unknown: number;
}

let routing: Routing | null = null;

function prepare(ix: AskIndex): Routing {
  if (routing?.ix === ix && routing.signals === signals) return routing;
  const ways = ix.questions.map((q) => [q.q, ...q.also].map(terms).filter((t) => t.size));
  const sig = ix.questions.map((_, i) => (signals?.[i] ?? []).map(terms).filter((t) => t.size));
  const all = ways.map((ts, i) => new Set([...ts, ...sig[i]].flatMap((t) => [...t])));
  const df = new Map<string, number>();
  for (const a of all) for (const t of a) df.set(t, (df.get(t) ?? 0) + 1);
  const n = ix.questions.length;
  const idf = new Map([...df].map(([t, c]) => [t, Math.log(1 + n / c)]));
  routing = { ix, signals, ways, sig, all, title: ix.questions.map((q) => terms(q.q)), idf, df, unknown: Math.log(1 + n) };
  return routing;
}

export interface Route {
  q: Question;
  /** How much of its best way of asking was said, by weight (0 to 1). */
  said: number;
  /** How much of what was typed the question covers, by weight (0 to 1). */
  covers: number;
  /** How much of what was typed its title says, by weight (0 to 1). */
  own: number;
  /** How much its best way of asking weighs, rare words counting more. */
  weight: number;
  score: number;
}

/** Prepared questions for `text`, best first. */
export function routes(ix: AskIndex, text: string, limit = 3): Route[] {
  const r = prepare(ix);
  const typed = terms(text);
  if (!typed.size) return [];
  const w = (t: string) => r.idf.get(t) ?? r.unknown;
  const total = [...typed].reduce((s, t) => s + w(t), 0);
  const out: Route[] = [];
  ix.questions.forEach((q, i) => {
    let said = 0;
    let weight = 0;
    const n = r.ways[i].length;
    for (const [k, way] of [...r.ways[i], ...r.sig[i]].entries()) {
      // One word says too little ("is God angry with me" is not "is it wrong to
      // be angry"), unless it is all that was typed and few questions use it:
      // "I feel like a failure", but not "God" alone. A signal word counts
      // alone when it points to this question only: "severance".
      const df = way.size < 2 ? (r.df.get([...way][0]) ?? 0) : 0;
      if (way.size < 2 && (k < n ? typed.size > 1 || df > 20 : df > 1)) continue;
      let hit = 0;
      let all = 0;
      for (const t of way) {
        all += w(t);
        if (typed.has(t)) hit += w(t);
      }
      if (hit / all > said || (hit / all === said && hit > weight)) {
        said = hit / all;
        weight = hit;
      }
    }
    if (!said) return;
    let covered = 0;
    let own = 0;
    for (const t of typed) {
      if (r.all[i].has(t)) covered += w(t);
      if (r.title[i].has(t)) own += w(t);
    }
    const covers = covered / total;
    // Of two that say it equally, the one whose title says it: "anxiety" is
    // "What do I do with worry and anxiety?" before "How do I stop being afraid?".
    out.push({ q, said, covers, own: own / total, weight, score: said * (0.4 + 0.6 * covers) + 0.1 * (own / total) });
  });
  out.sort((x, y) => y.score - x.score);
  return out.slice(0, limit);
}

/** The thresholds a route must pass to open its question. */
export const OPEN = { said: 0.75, covers: 0.5, score: 0.6, margin: 0.08 };

/** How sure the meaning matcher must be to open its question. */
export const MEANT = 0.8;

/** The prepared question that plainly answers `text`, or null. */
export function route(ix: AskIndex, text: string): Question | null {
  // Asked as one of its ways, word for word.
  const exact = exactQuestion(ix, text);
  if (exact) return exact;
  // Plainly what people mean by such words ("car got repossessed": debt).
  const [sense] = meanings(ix, text, 1);
  if (sense && sense.p >= MEANT) return sense.q;
  const [best, next] = routes(ix, text, 2);
  if (!best || best.said < OPEN.said || best.covers < OPEN.covers || best.score < OPEN.score) return null;
  if (next && best.score - next.score < OPEN.margin && next.said >= OPEN.said) return null;
  return best.q;
}
