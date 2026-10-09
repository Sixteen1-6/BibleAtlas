// A theme's "thread": one readable chain of links through the whole Bible,
// computed from the data, never picked by hand.
//
// The rule (ported from the planner's prototype, thread_final.py):
// - The theme's verses are every verse that contains one of its Hebrew,
//   Aramaic or Greek words.
// - Its links are the cross-references between two of those verses with 3 or
//   more votes, read from the earlier verse to the later one.
// - A chain starts at an Old Testament verse and moves forward through the
//   canon. Each verse scores by how central it is (its PageRank percentile),
//   each hop by its votes, with a bonus for stepping into a later group of
//   books (law, history, wisdom, prophets, gospels, Acts, letters, Revelation).
// - It ends at one of the theme's 8 most central New Testament verses, with a
//   bonus for the more central ones, and holds 4 to 10 verses.
// - When no such chain exists, the theme shows its 6 most central verses
//   instead, plainly labelled as not a linked chain.

import { type Atlas, type Theme, versesWithRoot } from './atlas';

/** Fewest votes a link needs to join the thread. */
export const THREAD_VOTES = 3;
/** Fewest votes for a link in a theme's full set ("All N links"), as the
 *  Themes panel has always shown it. */
export const ALL_VOTES = 2;
/** Most verses in a thread. */
export const THREAD_MAX = 10;
/** Fewest verses in a thread. */
const THREAD_MIN = 4;
/** How many of the theme's most central New Testament verses can end the thread. */
const END_CANDIDATES = 8;
/** Bonus for ending at the most central candidate; it falls off linearly down the list. */
const END_BONUS = 30;
/** Verses shown when a theme has no chain. */
const KEY_VERSES = 6;

/** Book groups in canon order; a hop into a later group earns a bonus. */
const GROUPS = ['law', 'history', 'wisdom', 'major-prophets', 'minor-prophets', 'gospels', 'acts', 'pauline', 'general', 'apocalyptic'];

export interface Thread {
  /** 'thread': a chain of links. 'key': the most central verses, not linked. */
  kind: 'thread' | 'key';
  /** In canon order. */
  verses: number[];
  /** edges[i] is the cross-reference joining verses[i] and verses[i + 1]; empty for key verses. */
  edges: number[];
}

interface Cache {
  verses: Map<string, Uint32Array>;
  links: Map<string, Uint32Array>;
  threads: Map<string, Thread>;
  counts: Map<string, number>;
  pct?: Float64Array;
}
const caches = new WeakMap<Atlas, Cache>();
function cacheOf(a: Atlas): Cache {
  let c = caches.get(a);
  if (!c) {
    c = { verses: new Map(), links: new Map(), threads: new Map(), counts: new Map() };
    caches.set(a, c);
  }
  return c;
}

/** Every verse that contains one of the theme's words, in canon order. */
export function themeVerses(a: Atlas, theme: Theme): Uint32Array {
  const c = cacheOf(a);
  let out = c.verses.get(theme.id);
  if (!out) {
    const mask = new Uint8Array(a.n);
    let count = 0;
    const all = [...theme.roots.map((r) => versesWithRoot(a, r)), ...(theme.near ?? []).map((n) => n.verses)];
    for (const vs of all) {
      for (const v of vs) {
        if (!mask[v]) count++;
        mask[v] = 1;
      }
    }
    out = new Uint32Array(count);
    for (let v = 0, i = 0; v < a.n; v++) if (mask[v]) out[i++] = v;
    c.verses.set(theme.id, out);
  }
  return out;
}

/** Cross-references with both ends in `verses` (and the ends distinct) and at
 *  least `minVotes` votes. A pair joined by several rows (both directions, or
 *  duplicates) is one link: the row with the most votes. Ordered by the
 *  earlier verse, then the later one. */
export function themeLinks(a: Atlas, verses: ArrayLike<number>, minVotes = THREAD_VOTES): Uint32Array {
  const mask = new Uint8Array(a.n);
  for (let i = 0; i < verses.length; i++) mask[verses[i]] = 1;
  const best = new Map<number, number>();
  for (let i = 0; i < verses.length; i++) {
    const s = verses[i];
    for (let e = a.xOff[s]; e < a.xOff[s + 1]; e++) {
      const d = a.xDst[e];
      if (d === s || !mask[d] || a.xVotes[e] < minVotes) continue;
      const key = s < d ? s * a.n + d : d * a.n + s;
      const prev = best.get(key);
      if (prev === undefined || a.xVotes[e] > a.xVotes[prev]) best.set(key, e);
    }
  }
  const keys = [...best.keys()].sort((x, y) => x - y);
  return Uint32Array.from(keys, (k) => best.get(k)!);
}

/** Cached themeLinks for a theme's own verses. */
export function themeLinksOf(a: Atlas, theme: Theme, minVotes = THREAD_VOTES): Uint32Array {
  const c = cacheOf(a);
  const key = `${theme.id}|${minVotes}`;
  let out = c.links.get(key);
  if (!out) {
    out = themeLinks(a, themeVerses(a, theme), minVotes);
    c.links.set(key, out);
  }
  return out;
}

/** Each verse's PageRank percentile among all verses, 0 (least central) to 1. */
function rankPercentile(a: Atlas): Float64Array {
  const c = cacheOf(a);
  if (!c.pct) {
    const order = rankOrder(a);
    const pct = new Float64Array(a.n);
    const d = Math.max(1, a.n - 1);
    for (let i = 0; i < order.length; i++) pct[order[i]] = i / d;
    c.pct = pct;
  }
  return c.pct;
}

/** Every verse, by PageRank from least to most central, ties in canon order
 *  (a stable sort by rank, as in the prototype). */
function rankOrder(a: Atlas): ArrayLike<number> {
  const n = a.n;
  // Fast path, about three times quicker than a comparator sort: the bits of
  // a float32 that is positive (or +0) sort like its value, so the bits and
  // the verse packed into one float64 (exact below 2^53) sort natively into
  // the same order. It needs at most 65,536 verses.
  if (n <= 65536 && a.rank instanceof Float32Array && a.rank.length >= n) {
    const bits = new Uint32Array(a.rank.buffer, a.rank.byteOffset, n);
    const keys = new Float64Array(n);
    let v = 0;
    // Below 0x7f800000: +0, or positive and finite (no NaN, infinity or sign bit).
    for (; v < n && bits[v] < 0x7f800000; v++) keys[v] = bits[v] * 65536 + v;
    if (v === n) {
      keys.sort();
      const order = new Uint32Array(n);
      for (let i = 0; i < n; i++) order[i] = keys[i] % 65536;
      return order;
    }
  }
  return Array.from({ length: n }, (_, i) => i).sort((x, y) => a.rank[x] - a.rank[y] || x - y);
}

/** Verses ordered by PageRank, most central first (ties: canon order). */
function byRank(a: Atlas, vs: ArrayLike<number>): number[] {
  return Array.from(vs).sort((x, y) => a.rank[y] - a.rank[x] || x - y);
}

/** The theme's thread (see the rule at the top of this file). Cached per theme. */
export function themeThread(a: Atlas, theme: Theme): Thread {
  const c = cacheOf(a);
  const hit = c.threads.get(theme.id);
  if (hit) return hit;

  const V = themeVerses(a, theme);
  const links = themeLinks(a, V, THREAD_VOTES);
  const pct = rankPercentile(a);
  const m = V.length;
  const at = new Map<number, number>();
  for (let i = 0; i < m; i++) at.set(V[i], i);
  const bookGroup = a.books.map((b) => {
    const g = GROUPS.indexOf(b.genre);
    return g >= 0 ? g : b.testament === 'OT' ? 0 : GROUPS.indexOf('gospels');
  });
  const group = (v: number) => bookGroup[a.verseBook[v]];
  const isOT = (v: number) => a.books[a.verseBook[v]].testament === 'OT';

  // Links arriving at each verse from an earlier one: [position of the earlier verse, edge].
  const inc: number[][] = Array.from({ length: m }, () => []);
  for (const e of links) {
    const s = a.xSrc[e];
    const d = a.xDst[e];
    const lo = Math.min(s, d);
    const hi = Math.max(s, d);
    inc[at.get(hi)!].push(at.get(lo)!, e);
  }

  // best[i][k]: the highest score of a chain of k verses ending at V[i].
  const K = THREAD_MAX + 1;
  const score = new Float64Array(m * K).fill(-Infinity);
  const prevAt = new Int32Array(m * K).fill(-1);
  const prevEdge = new Int32Array(m * K).fill(-1);
  for (let i = 0; i < m; i++) {
    const v = V[i];
    const gv = group(v);
    const node = 3 * pct[v];
    if (isOT(v)) score[i * K + 1] = node + Math.max(0, 3 - gv);
    const into = inc[i];
    for (let q = 0; q < into.length; q += 2) {
      const j = into[q];
      const e = into[q + 1];
      const lw = Math.log2(1 + a.xVotes[e]);
      const hop = gv > group(V[j]) ? lw + 2.5 : 0.15 * lw;
      for (let k = 1; k < THREAD_MAX; k++) {
        const sc = score[j * K + k];
        if (sc === -Infinity) continue;
        const cand = sc + hop + node;
        if (cand > score[i * K + k + 1]) {
          score[i * K + k + 1] = cand;
          prevAt[i * K + k + 1] = j;
          prevEdge[i * K + k + 1] = e;
        }
      }
    }
  }

  // Ends: the theme's most central New Testament verses.
  const ends = byRank(
    a,
    Array.from(V).filter((v) => !isOT(v)),
  ).slice(0, END_CANDIDATES);
  let top = -Infinity;
  let endAt = -1;
  let endLen = -1;
  for (let p = 0; p < ends.length; p++) {
    const i = at.get(ends[p])!;
    // Its best chain of THREAD_MIN or more verses (a tie goes to the longer one).
    let bs = -Infinity;
    let bk = -1;
    for (let k = THREAD_MIN; k <= THREAD_MAX; k++) {
      const sc = score[i * K + k];
      if (sc !== -Infinity && sc >= bs) {
        bs = sc;
        bk = k;
      }
    }
    if (bk < 0) continue;
    const total = bs + END_BONUS * (1 - p / END_CANDIDATES);
    if (total > top) {
      top = total;
      endAt = i;
      endLen = bk;
    }
  }

  let out: Thread;
  if (endAt >= 0) {
    const verses: number[] = [];
    const edges: number[] = [];
    let i = endAt;
    let k = endLen;
    for (;;) {
      verses.push(V[i]);
      const j = prevAt[i * K + k];
      if (j < 0) break;
      edges.push(prevEdge[i * K + k]);
      i = j;
      k -= 1;
    }
    verses.reverse();
    edges.reverse();
    out = { kind: 'thread', verses, edges };
  } else {
    out = { kind: 'key', verses: byRank(a, V).slice(0, KEY_VERSES).sort((x, y) => x - y), edges: [] };
  }
  c.threads.set(theme.id, out);
  return out;
}

/** How many cross-reference rows with ALL_VOTES or more votes join two of
 *  the theme's verses: the "All N links" the map shows. Cached. */
export function themeLinkCount(a: Atlas, theme: Theme): number {
  const c = cacheOf(a);
  let count = c.counts.get(theme.id);
  if (count === undefined) {
    count = linksWithinRows(a, themeVerses(a, theme), ALL_VOTES).length;
    c.counts.set(theme.id, count);
  }
  return count;
}

/** Works out ahead of time, for an idle moment, everything that choosing
 *  this theme needs, so the tap itself only has to draw. */
export function warmTheme(a: Atlas, theme: Theme): void {
  themeThread(a, theme);
  themeLinkCount(a, theme);
  themeLinksOf(a, theme, ALL_VOTES);
}

/** Cross-references with both ends among `verses` and at least `minVotes`
 *  votes, every row kept: the same rows, in the same order, as the engine's
 *  linksWithin (used when the engine is not available). */
export function linksWithinRows(a: Atlas, verses: ArrayLike<number>, minVotes: number): Uint32Array {
  const mask = new Uint8Array(a.n);
  for (let i = 0; i < verses.length; i++) mask[verses[i]] = 1;
  const out: number[] = [];
  for (let v = 0; v < a.n; v++) {
    if (!mask[v]) continue;
    for (let e = a.xOff[v]; e < a.xOff[v + 1]; e++) if (a.xVotes[e] >= minVotes && mask[a.xDst[e]]) out.push(e);
  }
  return Uint32Array.from(out);
}
