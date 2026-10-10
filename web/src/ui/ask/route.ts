// Ask the Bible: which prepared question answers what someone typed.
//
// Every prepared question comes with the ways people ask it ("also"), written
// for search. What someone types is matched against those: a question opens
// when one of its ways of asking is said, nearly whole, in what they typed
// ("my husband is hooked on pills and lies about it" says most of "husband
// hooked on pills"), and its question covers most of what they typed. Words
// that many questions share count for little, rare ones for much.

import { type AskIndex, type Question, askKey, contentWords, stem } from './ask';

/** Words too plain to tell one question from another. */
const PLAIN = new Set(['bible', 'want', 'need', 'feel', 'feeling', 'keep', 'going', 'doing', 'done', 'now', 'got', 'gets', 'getting', 'said', 'told', 'tells', 'every', 'always', 'never', 'today', 'last', 'week', 'year', 'years', 'day', 'days', 'time', 'times', 'good', 'bad', 'okay', 'life', 'lot', 'lots', 'dont', 'doesnt', 'didnt', 'cant', 'wont', 'isnt', 'im', 'ive', 'id', 'ill', 'its', 'thats']);

function terms(s: string): Set<string> {
  return new Set(
    contentWords(s)
      .filter((w) => !PLAIN.has(w) && !/^\d+$/.test(w))
      .map(stem),
  );
}

interface Routing {
  ix: AskIndex;
  /** Each question's ways of asking, by the words that must match (askKey). */
  keys: Map<string, Question>;
  /** Each question's ways of asking, as term sets. */
  ways: Set<string>[][];
  /** Each question's terms, all ways together. */
  all: Set<string>[];
  idf: Map<string, number>;
  /** The weight of a term no question uses. */
  unknown: number;
}

let routing: Routing | null = null;

function prepare(ix: AskIndex): Routing {
  if (routing?.ix === ix) return routing;
  const ways = ix.questions.map((q) => [q.q, ...q.also].map(terms).filter((t) => t.size));
  const all = ways.map((ts) => new Set(ts.flatMap((t) => [...t])));
  const df = new Map<string, number>();
  for (const a of all) for (const t of a) df.set(t, (df.get(t) ?? 0) + 1);
  const n = ix.questions.length;
  const idf = new Map([...df].map(([t, c]) => [t, Math.log(1 + n / c)]));
  const keys = new Map<string, Question>();
  for (const q of ix.questions) for (const k of [q.q, ...q.also].map(askKey)) if (k && !keys.has(k)) keys.set(k, q);
  routing = { ix, keys, ways, all, idf, unknown: Math.log(1 + n) };
  return routing;
}

export interface Route {
  q: Question;
  /** How much of its best way of asking was said, by weight (0 to 1). */
  said: number;
  /** How much of what was typed the question covers, by weight (0 to 1). */
  covers: number;
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
    for (const way of r.ways[i]) {
      // One word says too little: "is God angry with me" is not "is it wrong to be angry".
      if (way.size < 2) continue;
      let hit = 0;
      let all = 0;
      for (const t of way) {
        all += w(t);
        if (typed.has(t)) hit += w(t);
      }
      said = Math.max(said, hit / all);
    }
    if (!said) return;
    let covered = 0;
    for (const t of typed) if (r.all[i].has(t)) covered += w(t);
    const covers = covered / total;
    out.push({ q, said, covers, score: said * (0.4 + 0.6 * covers) });
  });
  out.sort((x, y) => y.score - x.score);
  return out.slice(0, limit);
}

/** The thresholds a route must pass to open its question. */
export const OPEN = { said: 0.75, covers: 0.5, score: 0.6, margin: 0.08 };

/** The prepared question that plainly answers `text`, or null. */
export function route(ix: AskIndex, text: string): Question | null {
  // Asked as one of its ways, word for word.
  const exact = prepare(ix).keys.get(askKey(text));
  if (exact) return exact;
  const [best, next] = routes(ix, text, 2);
  if (!best || best.said < OPEN.said || best.covers < OPEN.covers || best.score < OPEN.score) return null;
  if (next && best.score - next.score < OPEN.margin && next.said >= OPEN.said) return null;
  return best.q;
}
