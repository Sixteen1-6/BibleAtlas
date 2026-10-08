// Echoes of a verse: the other verses that use the studied word together with
// more of this verse's less common words.
//
// Everything here works on the root postings already in atlas.bin (which
// verses hold each Hebrew, Aramaic or Greek root) and on the study verse's own
// word row. Nothing is fetched and no other verse's text is read.
//
// A candidate is any other verse with the studied root. Each of the study
// verse's counted roots that the candidate also holds adds ln(N / df) to its
// score, so rare shared words weigh most. A candidate scoring THRESHOLD or
// more is an echo.
//
// The file is pure (no imports at runtime, no DOM, no signals, no module
// state) so Node can load it directly to check it against the reference.

/** A root rarer than this (in fewer verses) counts whatever its word type. */
export const RARE = 300;
/** A root in this many verses or more never counts, and is never studied. */
export const MAXDF = 1500;
/** Lowest score that makes a candidate an echo. */
export const THRESHOLD = 4.0;

/** Bit in a word row's flags for words found only in other editions. */
const OTHER_EDITIONS = 2;

/** A word row from text/<Book>.json: [surface, translit, gloss, root, morph, flags, note?]. */
export type EchoWord = [string, string, string, number, string, number, ...unknown[]];

export interface EchoInput {
  /** Verse count. */
  n: number;
  lOff: Uint32Array;
  lVerse: Uint32Array;
  /** Gloss per root (lemmas.json). */
  gloss: string[];
  /** PageRank per verse, used to break ties. */
  rank: Float32Array;
  /** The study verse's word rows. */
  words: EchoWord[];
  verse: number;
  root: number;
}

export interface Echo {
  v: number;
  score: number;
  /** Counted roots this verse also holds, rarest first. */
  shared: number[];
}

export interface EchoResult {
  /** The study verse's counted roots, ascending. */
  counted: number[];
  /** How many other verses hold the root. */
  others: number;
  /** Candidates at or above THRESHOLD, best first. */
  echoes: Echo[];
}

/** Proper names have a capitalized gloss ("Boaz", "Jerusalem"). */
export function isProper(gloss: string): boolean {
  const m = gloss.match(/\p{L}/u);
  return !!m && /\p{Lu}/u.test(m[0]);
}

/** Noun, verb or adjective (not a number), by the word's grammar code here. */
export function isContent(morph: string): boolean {
  if (morph.startsWith('H') || morph.startsWith('A')) {
    // TAHOT: a prefix chain such as "HC/Ncfsa"; any stem counts. "Ac" and
    // "Ao" are cardinal and ordinal numbers.
    return morph
      .slice(1)
      .split('/')
      .some((p) => p[0] === 'N' || p[0] === 'V' || (p[0] === 'A' && p[1] !== 'c' && p[1] !== 'o'));
  }
  return /^(N|V|A)-/.test(morph) && !morph.startsWith('A-NUI');
}

/** Distinct verses holding root q, in Bible order. Postings are in verse
 *  order, so dropping consecutive repeats is enough. */
function versesOf(q: number, lOff: Uint32Array, lVerse: Uint32Array, cache?: Map<number, Uint32Array>): Uint32Array {
  const hit = cache?.get(q);
  if (hit) return hit;
  const s = lOff[q];
  const e = lOff[q + 1];
  const out = new Uint32Array(e - s);
  let k = 0;
  let last = -1;
  for (let i = s; i < e; i++) {
    const v = lVerse[i];
    if (v !== last) {
      out[k++] = v;
      last = v;
    }
  }
  const vs = out.slice(0, k);
  cache?.set(q, vs);
  return vs;
}

/** Distinct verses holding root q, counting no further than `cap`. */
function dfUpTo(q: number, lOff: Uint32Array, lVerse: Uint32Array, cap: number): number {
  let k = 0;
  let last = -1;
  for (let i = lOff[q], e = lOff[q + 1]; i < e; i++) {
    const v = lVerse[i];
    if (v !== last) {
      if (++k >= cap) return k;
      last = v;
    }
  }
  return k;
}

export function rankEchoes(input: EchoInput, cache?: Map<number, Uint32Array>): EchoResult {
  const { n, lOff, lVerse, gloss, rank, words, verse, root } = input;

  // Distinct verses of each counted root. Common roots are ruled out by a
  // capped count first, so "and" or "the" never build a big list.
  const counted = new Map<number, Uint32Array>();
  for (const w of words) {
    const q = w[3];
    if (q < 0 || q === root || w[5] & OTHER_EDITIONS || counted.has(q) || isProper(gloss[q] ?? '')) continue;
    const vs = cache?.get(q) ?? (dfUpTo(q, lOff, lVerse, MAXDF) < MAXDF ? versesOf(q, lOff, lVerse, cache) : null);
    if (!vs || vs.length >= MAXDF) continue;
    if (vs.length < RARE || isContent(w[4])) counted.set(q, vs);
  }
  const roots = [...counted.keys()].sort((x, y) => x - y);

  // Candidates: every other verse with the root, scored by walking each
  // counted root's verses.
  const score = new Map<number, number>();
  for (const c of versesOf(root, lOff, lVerse, cache)) if (c !== verse) score.set(c, 0);
  const others = score.size;
  const sharedBy = new Map<number, number[]>();
  for (const q of roots) {
    const vs = counted.get(q)!;
    const idf = Math.log(n / vs.length);
    for (const c of vs) {
      const s = score.get(c);
      if (s === undefined) continue;
      score.set(c, s + idf);
      const list = sharedBy.get(c);
      if (list) list.push(q);
      else sharedBy.set(c, [q]);
    }
  }

  const df = (q: number) => counted.get(q)!.length;
  const echoes: Echo[] = [];
  for (const [v, s] of score) {
    if (s < THRESHOLD) continue;
    const shared = sharedBy.get(v)!.sort((x, y) => df(x) - df(y) || x - y);
    echoes.push({ v, score: s, shared });
  }
  echoes.sort((x, y) => y.score - x.score || rank[y.v] - rank[x.v] || x.v - y.v);
  return { counted: roots, others, echoes };
}
