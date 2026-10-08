// English search over the BSB.
//
// Two stages. The inverted index built in Rust finds every verse that holds
// any query word (or a close form of it), scored by how much of the query it
// covers, rare words counting more. Then, once the plain text has loaded, the
// best few hundred are re-ranked by word order, so the verse whose wording
// matches the phrase someone typed comes first.
//
// A query word also matches its other forms ("loved" finds "love"), King James
// wording ("thou shalt", "strengtheneth"), small typos ("shepard"), and, for the
// word still being typed, any word it starts. A verse need not hold every word:
// people quote from memory and from other translations, so the closest matches
// still come back, after the verses that do hold them all.
//
// Normalization must match crates/atlas-cli/src/english.rs exactly.

import type { Atlas } from './atlas';

export function tokens(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[^\p{L}\p{N}'’]+/u)) {
    const w = norm(raw);
    if (w) out.push(w);
  }
  return out;
}

function norm(raw: string): string {
  let w = raw.toLowerCase().replace(/’/g, "'");
  w = w.replace(/^'+|'+$/g, '');
  if (w.endsWith("'s")) w = w.slice(0, -2);
  return w.replace(/'/g, '');
}

/** Split text into alternating [other, word, other, word, ...] pieces, with
 *  each word's normalized form, for highlighting. */
export function wordPieces(text: string): { text: string; word: string }[] {
  const out: { text: string; word: string }[] = [];
  const re = /[\p{L}\p{N}'’]+/gu;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), word: '' });
    out.push({ text: m[0], word: norm(m[0]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), word: '' });
  return out;
}

function lowerBound(words: string[], key: string): number {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid] < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function find(words: string[], w: string): number {
  const i = lowerBound(words, w);
  return words[i] === w ? i : -1;
}

/** King James (and other older) wording -> the words the BSB uses. */
const OLDER: Record<string, string[]> = {
  thou: ['you'],
  thee: ['you'],
  ye: ['you'],
  thy: ['your'],
  thine: ['your', 'yours'],
  thyself: ['yourself'],
  shalt: ['shall', 'will'],
  wilt: ['will'],
  hath: ['has', 'have'],
  hast: ['have', 'has'],
  hadst: ['had'],
  doth: ['does'],
  dost: ['do'],
  didst: ['did'],
  art: ['are'],
  canst: ['can'],
  unto: ['to'],
  saith: ['says', 'said'],
  spake: ['spoke'],
  shew: ['show'],
  whosoever: ['whoever', 'everyone'],
  whatsoever: ['whatever'],
  wherefore: ['therefore'],
  begat: ['fathered'],
  brethren: ['brothers'],
  ere: ['before'],
  nay: ['no'],
  yea: ['yes'],
  verily: ['truly'],
  charity: ['love'],
  ghost: ['spirit'],
  kill: ['murder'],
  sufficeth: ['sufficient', 'enough'],
  peradventure: ['perhaps'],
  lest: ['so'],
  vanity: ['futility'],
  vanities: ['futilities'],
  mansions: ['rooms'],
  labour: ['labor'],
  neighbour: ['neighbor'],
  honour: ['honor'],
  saviour: ['savior'],
};

/** Small words left unhighlighted in results. */
const QUIET = new Set(
  'a an and are as at be but by for from had has have he her him his i in is it its me my no not of on or our she so that the their them they this to us was we were who will with you your'.split(' '),
);

const SUFFIXES = ['eth', 'est', 'ing', 'ed', 'es', 's', 'd', 'ly'];

/** Other forms of a word that exist in the index: "loved" -> love, loves, loving. */
function forms(words: string[], w: string): string[] {
  const stems = new Set<string>([w]);
  for (const s of SUFFIXES) {
    if (w.length - s.length >= 3 && w.endsWith(s)) {
      const stem = w.slice(0, -s.length);
      stems.add(stem);
      stems.add(`${stem}e`);
      // "begged" -> "beg"
      if (stem.length >= 4 && stem[stem.length - 1] === stem[stem.length - 2]) stems.add(stem.slice(0, -1));
    }
  }
  const out = new Set<string>();
  for (const stem of stems) {
    for (const s of ['', 's', 'es', 'd', 'ed', 'ing', 'eth', 'est']) {
      const f = stem + s;
      if (f !== w && find(words, f) >= 0) out.add(f);
    }
    if (stem.endsWith('e')) {
      const f = `${stem.slice(0, -1)}ing`;
      if (f !== w && find(words, f) >= 0) out.add(f);
    }
  }
  return [...out];
}

/** Edit distance with adjacent swaps, giving up once it exceeds `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const w = b.length + 1;
  const d = new Uint8Array((a.length + 1) * w);
  for (let j = 0; j < w; j++) d[j] = j;
  for (let i = 1; i <= a.length; i++) {
    d[i * w] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[(i - 1) * w + j] + 1, d[i * w + j - 1] + 1, d[(i - 1) * w + j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[(i - 2) * w + j - 2] + 1);
      d[i * w + j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length * w + b.length];
}

/** Consonant outline: "shepard" and "shepherd" both read "shprd". */
function skeleton(w: string): string {
  return w[0] + w.slice(1).replace(/[aeiouyh]/g, '').replace(/(.)\1+/g, '$1');
}

/** Index words within one or two typos of `w` ("shepard" -> shepherd).
 *  Among equally close words, ones that sound alike win, then common ones. */
function nearWords(a: Atlas, w: string): string[] {
  const words = a.englishWords;
  if (w.length < 4 || /\d/.test(w)) return [];
  const max = w.length >= 7 ? 2 : 1;
  const sk = skeleton(w);
  const hits: { x: string; d: number; df: number }[] = [];
  for (let i = 0; i < words.length; i++) {
    const x = words[i];
    if (Math.abs(x.length - w.length) > max || /\d/.test(x)) continue;
    let d = distance(w, x, max);
    if (d > max) continue;
    // Sounding alike counts as one typo closer.
    if (skeleton(x) === sk) d -= 0.5;
    hits.push({ x, d, df: a.eOff[i + 1] - a.eOff[i] });
  }
  const best = Math.min(...hits.map((h) => h.d));
  return hits
    .filter((h) => h.d === best)
    .sort((p, q) => q.df - p.df)
    .slice(0, 3)
    .map((h) => h.x);
}

export interface Term {
  /** The word as typed (normalized). */
  text: string;
  /** Index word -> how well it stands for the typed word (1 = exactly). */
  alts: Map<string, number>;
  /** Read as a typo of these words. */
  guessed: string[];
}

function buildTerm(a: Atlas, w: string, prefix: boolean): Term {
  const words = a.englishWords;
  const alts = new Map<string, number>();
  const put = (x: string, weight: number) => alts.set(x, Math.max(alts.get(x) ?? 0, weight));
  if (find(words, w) >= 0) put(w, 1);
  for (const x of OLDER[w] ?? []) if (find(words, x) >= 0) put(x, 0.95);
  for (const x of forms(words, w)) put(x, 0.8);
  for (const x of OLDER[w] ?? []) for (const f of forms(words, x)) put(f, 0.7);
  if (prefix && w.length >= 2) {
    let i = lowerBound(words, w);
    for (let k = 0; i < words.length && words[i].startsWith(w) && k < 64; i++, k++) put(words[i], 0.85);
  }
  const guessed = alts.size ? [] : nearWords(a, w);
  for (const x of guessed) put(x, 0.7);
  return { text: w, alts, guessed };
}

export function parseQuery(a: Atlas, query: string): Term[] {
  const ws = tokens(query);
  const typing = !/\s$/.test(query);
  return ws.map((w, i) => buildTerm(a, w, typing && i === ws.length - 1));
}

export interface SearchResult {
  verses: number[];
  /** Verses that hold every query word (or a form of it). */
  total: number;
  /** Every index word that matched, for highlighting. */
  words: Set<string>;
  /** Query words that matched nothing at all. */
  unknown: string[];
  /** Typos read as other words: ["shepard", ["shepherd"]]. */
  guesses: [string, string[]][];
}

const EMPTY: SearchResult = { verses: [], total: 0, words: new Set(), unknown: [], guesses: [] };

/**
 * Best verses for an English query. `texts` (the BSB, one string per verse)
 * is optional; without it results are ranked on words alone.
 */
export function searchEnglish(a: Atlas, query: string, limit = 60, texts?: string[] | null): SearchResult {
  const terms = parseQuery(a, query);
  if (!terms.length) return EMPTY;
  const n = a.rank.length;
  const score = new Float32Array(n);
  const hits = new Uint8Array(n);
  const touched: number[] = [];
  const idf: number[] = [];
  const words = new Set<string>();
  const unknown: string[] = [];
  for (const t of terms) {
    // Best weight per verse for this term.
    const best = new Map<number, number>();
    for (const [x, weight] of t.alts) {
      const i = find(a.englishWords, x);
      for (let p = a.eOff[i]; p < a.eOff[i + 1]; p++) {
        const v = a.eVerse[p];
        if ((best.get(v) ?? 0) < weight) best.set(v, weight);
      }
    }
    if (!best.size) unknown.push(t.text);
    // Highlight the words that carry the query, not every "the" and "is".
    if (!QUIET.has(t.text) || terms.length === 1) for (const x of t.alts.keys()) words.add(x);
    const f = Math.log(1 + n / Math.max(1, best.size));
    idf.push(f);
    for (const [v, weight] of best) {
      if (!hits[v] && !score[v]) touched.push(v);
      score[v] += f * weight;
      if (weight >= 0.7) hits[v] = Math.min(255, hits[v] + 1);
    }
  }
  const mass = idf.reduce((x, y) => x + y, 0) || 1;
  const all = terms.length;
  let total = 0;
  for (const v of touched) if (hits[v] >= all) total++;

  // Word-level ranking: coverage first, then how connected the verse is.
  const cover = (v: number) => score[v] / mass;
  // Short queries must match fully; long ones (quotes from memory) may miss a few words.
  const floor = all <= 2 ? 0.99 : all <= 4 ? 0.6 : 0.45;
  let cands = touched.filter((v) => cover(v) >= floor * 0.999);
  if (!cands.length) cands = touched;
  cands.sort((x, y) => cover(y) - cover(x) || a.rank[y] - a.rank[x] || x - y);

  if (texts && all >= 2) {
    cands = cands.slice(0, 600);
    const pos = terms.map((t) => t.alts);
    const fine = new Map<number, number>();
    for (const v of cands) {
      const toks = tokens(texts[v] ?? '');
      // Longest stretch of the verse that reads like the query: consecutive
      // verse words matching query words in order. Skipping a query word
      // ("eye for an eye" vs "eye for eye") or swapping one ("looks at the
      // heart" vs "looks on the heart") costs half a word.
      let run = 0;
      for (let i = 0; i < toks.length; i++) {
        for (let q = 0; q < pos.length; q++) {
          if (!pos[q].has(toks[i])) continue;
          let got = 1;
          let qi = q;
          for (let j = i + 1; j < toks.length; j++) {
            if (qi + 1 < pos.length && pos[qi + 1].has(toks[j])) {
              qi += 1;
              got += 1;
            } else if (qi + 2 < pos.length && pos[qi + 2].has(toks[j])) {
              qi += 2;
              got += 0.5;
            } else if (qi + 2 < pos.length && j + 1 < toks.length && pos[qi + 2].has(toks[j + 1])) {
              // A different word in the same place ("looks on the heart").
              qi += 2;
              j += 1;
              got += 1.5;
            } else break;
          }
          run = Math.max(run, got);
        }
      }
      let pairs = 0;
      for (let q = 0; q + 1 < pos.length; q++) {
        for (let i = 0; i + 1 < toks.length; i++) {
          if (pos[q].has(toks[i]) && pos[q + 1].has(toks[i + 1])) {
            pairs++;
            break;
          }
        }
      }
      const order = run / all + pairs / (all - 1);
      // Shorter verses that are mostly the query read as the quote itself.
      const focus = Math.min(1, all / Math.max(1, toks.length));
      fine.set(v, cover(v) * 4 + order * 2 + focus * 0.5 + a.rank[v] * 0.5);
    }
    cands.sort((x, y) => fine.get(y)! - fine.get(x)! || x - y);
  }
  const guesses = terms.filter((t) => t.guessed.length).map((t): [string, string[]] => [t.text, t.guessed]);
  return { verses: cands.slice(0, limit), total, words, unknown, guesses };
}

/** Lowercase ASCII-ish form for comparing transliterations ("agapē" -> "agape"). */
function plain(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[.\-'ʼʾʿ]/g, '');
}

/** Roots whose transliteration, gloss or Strong's number matches. */
export function searchRoots(a: Atlas, query: string, limit = 8): number[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const L = a.lemmas;
  const strong = /^[hg]\d{1,4}[a-z]?$/i.test(q);
  const hits: [number, number][] = [];
  for (let i = 0; i < L.key.length; i++) {
    let score = 0;
    if (strong) {
      const k = L.key[i].toLowerCase();
      const want = q[0] + q.slice(1).replace(/^(\d+)/, (d) => d.padStart(4, '0'));
      if (k === want) score = 3;
      else if (k.startsWith(want)) score = 2;
    } else {
      const g = L.gloss[i].toLowerCase();
      const t = plain(L.translit[i]);
      if (g === q) score = 3;
      else if (t === plain(q)) score = 3;
      else if (g.startsWith(q) || g.includes(`: ${q}`)) score = 2;
      else if (t.startsWith(plain(q))) score = 1;
    }
    if (score) hits.push([i, score * 1e6 + L.count[i]]);
  }
  hits.sort((x, y) => y[1] - x[1]);
  return hits.slice(0, limit).map((h) => h[0]);
}
