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
// Two more public-domain translations (KJV, ASV) can be added as `Extra`
// text: their words count as matches and their wording counts for word order,
// so a verse remembered in older or other wording is found. A few words that
// translations swap for one another (looks/sees, anxious/worry) count too, at
// a lower weight. Words spread over two neighboring verses can match the pair.
//
// Numbers, joined words, short forms and other spellings are folded to one
// form on both sides (fold.ts), so "7,000", "7000" and "seven thousand" are the
// same word. The Rust index holds the words as written, so the folded forms
// live in the `Extra` index, built for the BSB as well.
//
// Normalization must match crates/atlas-cli/src/english.rs exactly.

import type { Atlas } from './atlas';
import { fold, foldSpans, NUMBER_WORDS } from './fold';

const WORD = /[\p{L}\p{N}'’]+/gu;

/** Words of `text`, normalized. With `breaks`, also notes which words come
 *  right after punctuation that ends a number or a phrase (fold.ts). */
export function tokens(text: string, breaks?: boolean[]): string[] {
  const out: string[] = [];
  let end = 0;
  WORD.lastIndex = 0;
  for (let m = WORD.exec(text); m; m = WORD.exec(text)) {
    const w = norm(m[0]);
    if (!w) continue;
    if (breaks) breaks[out.length] = BREAK.test(text.slice(end, m.index));
    end = m.index + m[0].length;
    out.push(w);
  }
  return out;
}

/** Punctuation between words that a number never runs across. Not a comma
 *  between digits: "7,000" is one number. */
const BREAK = /[,;:.!?()]/;

/** Words of `text` folded to the forms search uses (fold.ts). */
export function foldedTokens(text: string): string[] {
  const breaks: boolean[] = [];
  return fold(tokens(text, breaks), breaks);
}

function norm(raw: string): string {
  if (raw.indexOf("'") < 0 && raw.indexOf('’') < 0) return raw.toLowerCase();
  let w = raw.toLowerCase().replace(/’/g, "'");
  w = w.replace(/^'+|'+$/g, '');
  if (w.endsWith("'s")) w = w.slice(0, -2);
  return w.replace(/'/g, '');
}

/** Split text into pieces for showing a verse with `words` (from a search)
 *  marked, reading it the way search does: "seven thousand" is marked when
 *  the search was for 7,000. */
export function markWords(text: string, words: Set<string>): { text: string; mark: boolean }[] {
  const ps = wordPieces(text).map((p) => ({ text: p.text, word: p.word, mark: !!p.word && words.has(p.word) }));
  const at: number[] = [];
  ps.forEach((p, i) => p.word && at.push(i));
  const breaks = at.map((i, k) => k > 0 && at[k - 1] < i - 1 && BREAK.test(ps[i - 1].text));
  for (const f of foldSpans(at.map((i) => ps[i].word), breaks)) {
    if (!words.has(f.tok)) continue;
    for (let k = f.from; k < f.to; k++) {
      ps[at[k]].mark = true;
      // The space or comma inside "seven thousand" or "7,000" too.
      if (k + 1 < f.to) for (let g = at[k] + 1; g < at[k + 1]; g++) ps[g].mark = true;
    }
  }
  return ps;
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

/** Words translations use for one another. Each group's words stand in for
 *  each other at a lower weight than a word's own forms. */
const SWAPS: string[][] = [
  ['look', 'looks', 'see', 'sees', 'behold'],
  ['steadfast', 'lovingkindness', 'unfailing', 'devotion', 'mercy', 'kindness'],
  ['anxious', 'anxiety', 'worry', 'worried', 'careful'],
  ['afraid', 'fear', 'fearful', 'dismayed', 'terrified'],
  ['everlasting', 'eternal', 'forever'],
  ['compassion', 'mercy', 'pity'],
  ['jehovah', 'lord'],
  ['wrath', 'anger', 'fury'],
  ['glad', 'joy', 'rejoice', 'joyful'],
  ['trouble', 'tribulation', 'distress', 'affliction'],
  ['perish', 'destroyed', 'die'],
  ['strong', 'mighty', 'strength'],
  ['courage', 'courageous'],
  ['savior', 'saviour', 'deliverer', 'redeemer'],
  ['save', 'deliver', 'rescue'],
  ['iniquity', 'iniquities', 'sin', 'sins', 'transgression', 'transgressions'],
  ['righteous', 'just', 'upright'],
  ['wicked', 'evil', 'ungodly'],
  ['weary', 'tired', 'faint'],
  ['heavy', 'burdened', 'laden'],
  ['rest', 'repose'],
  ['children', 'sons', 'offspring'],
  ['faithful', 'trustworthy'],
  ['trust', 'rely', 'hope'],
  ['abide', 'remain', 'dwell', 'live'],
  ['grace', 'favor', 'favour'],
  ['comfort', 'console', 'encourage'],
  ['seek', 'search', 'look'],
  ['heaven', 'heavens', 'sky'],
  ['nations', 'gentiles', 'peoples'],
  ['meek', 'humble', 'gentle'],
  ['labor', 'labour', 'work', 'toil'],
  ['spirit', 'ghost'],
  ['spoke', 'said', 'spake'],
  ['gift', 'present', 'offering'],
  ['worry', 'troubled'],
];
const SWAP = new Map<string, string[]>();
for (const g of SWAPS) for (const w of g) SWAP.set(w, [...new Set([...(SWAP.get(w) ?? []), ...g.filter((x) => x !== w)])]);

const SUFFIXES = ['eth', 'est', 'ing', 'ed', 'es', 's', 'd', 'ly'];

/** Other forms of a word that exist in the index: "loved" -> love, loves, loving. */
function forms(has: (w: string) => boolean, w: string): string[] {
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
      if (f !== w && has(f)) out.add(f);
    }
    if (stem.endsWith('e')) {
      const f = `${stem.slice(0, -1)}ing`;
      if (f !== w && has(f)) out.add(f);
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
  /** The words as typed, when folding changed them ("seven thousand"). */
  typed?: string;
}

/** Text from more translations, one array of lines (one per verse) each,
 *  with an index of which verses each word appears in. */
export interface Extra {
  names: string[];
  lines: string[][];
  index: Map<string, Uint32Array>;
  /** Word pairs the texts write apart even though they also join them
   *  ("pass over", "every day"): a query never joins these. */
  apart: Set<string>;
}

/** Index the words of other translations' text, as written and folded,
 *  plus the folded words of the BSB (`base`), whose words as written are in
 *  the Rust index already. Takes a second or two for three whole Bibles, so
 *  callers run it in a worker. */
export function buildExtra(names: string[], lines: string[][], base?: string[]): Extra {
  const lists = new Map<string, number[]>();
  const n = Math.max(base?.length ?? 0, ...lines.map((l) => l.length));
  const put = (w: string, v: number) => {
    let l = lists.get(w);
    if (!l) lists.set(w, (l = []));
    if (l[l.length - 1] !== v) l.push(v);
  };
  const bsb = new Set<string>();
  const folded: string[][] = [];
  const index1 = (line: string, v: number, all: boolean) => {
    const breaks: boolean[] = [];
    const toks = tokens(line, breaks);
    const fs = foldSpans(toks, breaks);
    for (const w of toks) {
      if (all) put(w, v);
      else bsb.add(w);
    }
    for (const f of fs) if (f.to - f.from > 1 || f.tok !== toks[f.from]) put(f.tok, v);
    folded.push(fs.map((f) => f.tok));
  };
  // Verse by verse across all translations, so every list comes out sorted
  // and unique without a second pass.
  for (let v = 0; v < n; v++) {
    if (base?.[v]) index1(base[v], v, false);
    for (const ls of lines) if (ls[v]) index1(ls[v], v, true);
  }
  const apart = new Set<string>();
  for (const toks of folded) {
    for (let i = 0; i + 1 < toks.length; i++) if (joinable(toks[i], toks[i + 1]) && (lists.has(toks[i] + toks[i + 1]) || bsb.has(toks[i] + toks[i + 1]))) apart.add(`${toks[i]} ${toks[i + 1]}`);
  }
  const index = new Map<string, Uint32Array>();
  for (const [w, l] of lists) index.set(w, Uint32Array.from(l));
  return { names, lines, index, apart };
}

/** `raw` is the word as typed when folding changed it ("honour" for honor). */
function buildTerm(a: Atlas, w: string, prefix: boolean, extra?: Extra | null, raw?: string): Term {
  const words = a.englishWords;
  const has = (x: string) => find(words, x) >= 0 || !!extra?.index.has(x);
  const alts = new Map<string, number>();
  const put = (x: string, weight: number) => alts.set(x, Math.max(alts.get(x) ?? 0, weight));
  if (has(w)) put(w, 1);
  // Until the extra index loads, the folded form may not be found yet. After,
  // "three" still finds "three thousand", below verses that say three.
  if (raw && !raw.includes(' ')) {
    const weight = !extra ? 1 : w[0] === '#' ? 0.6 : 0;
    if (weight && has(raw)) put(raw, weight);
    // "thousand" finds "thousands".
    if (weight && w[0] === '#') for (const x of forms(has, raw)) put(x, weight * 0.8);
  }
  for (const x of OLDER[w] ?? []) if (has(x)) put(x, 0.95);
  for (const x of forms(has, w)) put(x, 0.8);
  for (const x of OLDER[w] ?? []) for (const f of forms(has, x)) put(f, 0.7);
  for (const x of SWAP.get(w) ?? []) if (has(x)) put(x, 0.6);
  const start = raw ?? w;
  if (prefix && start.length >= 2) {
    let i = lowerBound(words, start);
    for (let k = 0; i < words.length && words[i].startsWith(start) && k < 64; i++, k++) put(words[i], 0.85);
  }
  const guessed = alts.size ? [] : nearWords(a, w);
  for (const x of guessed) put(x, 0.7);
  return { text: w, alts, guessed, typed: raw };
}

/** Spoken short forms the Bible writes out ("it's" is "it is", not "it"). */
function spoken(q: string): string {
  return q
    .replace(/\b(it|that|there|here|he|she|what|who|where|how)['’]s\b/gi, '$1 is')
    .replace(/\b(i|you|we|they|he|she|it)['’]ll\b/gi, '$1 will')
    .replace(/\bi['’]m\b/gi, 'i am')
    .replace(/\b(you|we|they)['’]re\b/gi, '$1 are')
    .replace(/\b(i|you|we|they)['’]ve\b/gi, '$1 have')
    .replace(/\bwon['’]t\b/gi, 'will not')
    .replace(/\blet['’]s\b/gi, 'let us');
}

/** A word typed in two parts ("peace makers", "breast plate") that the Bible
 *  writes as one, and never as two. */
const plainWord = (x: string) => x.length >= 3 && !QUIET.has(x) && !(x.charCodeAt(0) <= 57);
const joinable = (x: string, y: string) => plainWord(x) && plainWord(y);

function joins(a: Atlas, x: string, y: string | undefined, extra: Extra): string | null {
  if (!y || !joinable(x, y)) return null;
  const w = x + y;
  if (extra.apart.has(`${x} ${y}`) || !(find(a.englishWords, w) >= 0 || extra.index.has(w))) return null;
  return w;
}

export function parseQuery(a: Atlas, query: string, extra?: Extra | null): Term[] {
  const breaks: boolean[] = [];
  const ws = tokens(spoken(query), breaks);
  // A last word that spoken() wrote out ("it's") is finished, not being typed.
  const tail = /\S*$/.exec(query)![0];
  const typing = !/\s$/.test(query) && spoken(tail) === tail;
  const out = parseTokens(a, ws, breaks, typing, extra);
  // A number still being typed ("seven thous"): the last word also stands for
  // the numbers it could finish. The words before it still count on their own.
  const last = ws[ws.length - 1];
  if (extra && typing && ws.length >= 2 && last.length >= 2 && !breaks[ws.length - 1] && !NUMBER_WORDS.includes(last)) {
    const t = out[out.length - 1];
    for (const c of NUMBER_WORDS) {
      if (!c.startsWith(last)) continue;
      const f = foldSpans([...ws.slice(0, -1), c], breaks).at(-1)!;
      if (f.to - f.from < 2 || f.tok[0] !== '#' || !extra.index.has(f.tok)) continue;
      // So does the start of that number ("seven" in "seven thous").
      const before = new Set(ws.slice(f.from, -1));
      for (const u of out) {
        if (u === t || u.text[0] !== '#' || !(u.typed ?? '').split(' ').every((x) => before.has(x))) continue;
        u.alts.set(f.tok, Math.max(u.alts.get(f.tok) ?? 0, 0.9));
      }
      t.alts.set(f.tok, Math.max(t.alts.get(f.tok) ?? 0, 0.9));
    }
  }
  return out;
}

function parseTokens(a: Atlas, ws: string[], breaks: boolean[], typing: boolean, extra?: Extra | null): Term[] {
  const out: Term[] = [];
  const fs = foldSpans(ws, breaks);
  for (let k = 0; k < fs.length; k++) {
    const f = fs[k];
    const g = fs[k + 1];
    const w = extra && g && f.to - f.from === 1 && g.to - g.from === 1 && !breaks[g.from] ? joins(a, ws[f.from], ws[g.from], extra) : null;
    if (w) {
      out.push(buildTerm(a, w, typing && g.to === ws.length, extra));
      k++;
      continue;
    }
    const last = typing && f.to === ws.length;
    if (f.to - f.from > 1) {
      // Folded forms of several words are only in the extra index; until it
      // loads, or when no verse has that number ("forty and four thousand" is
      // part of 144,000), look for the words one by one.
      if (extra && (extra.index.has(f.tok) || find(a.englishWords, f.tok) >= 0)) out.push(buildTerm(a, f.tok, false, extra, ws.slice(f.from, f.to).join(' ')));
      else for (let i = f.from; i < f.to; i++) out.push(buildTerm(a, ws[i], last && i === f.to - 1, extra));
    } else {
      const raw = ws[f.from];
      out.push(buildTerm(a, f.tok, last, extra, raw !== f.tok ? raw : undefined));
    }
  }
  return out;
}

export interface SearchResult {
  /** First verse of each result. */
  verses: number[];
  /** How many verses each result covers: 1, or 2 when the words were
   *  spread over a verse and the next. */
  spans: number[];
  /** The translation whose wording matched best, when it was not the BSB. */
  via: (string | null)[];
  /** Verses that hold every query word (or a form of it). */
  total: number;
  /** Every index word that matched, for highlighting. */
  words: Set<string>;
  /** Query words that matched nothing at all. */
  unknown: string[];
  /** Typos read as other words: ["shepard", ["shepherd"]]. */
  guesses: [string, string[]][];
}

const EMPTY: SearchResult = { verses: [], spans: [], via: [], total: 0, words: new Set(), unknown: [], guesses: [] };

/** How closely a run of words reads like the query: the longest stretch
 *  matching query words in order, plus how many neighboring query word pairs
 *  appear side by side. */
function orderScore(toks: string[], pos: Map<string, number>[]): number {
  const all = pos.length;
  // Skipping a query word ("eye for an eye" vs "eye for eye") or swapping one
  // ("walk in the light" vs "walk into the light") costs half a word.
  let run = 0;
  for (let i = 0; i < toks.length; i++) {
    for (let q = 0; q < all; q++) {
      if (!pos[q].has(toks[i])) continue;
      let got = 1;
      let qi = q;
      // One number can stand for several query words ("seven thous" while
      // "seven thousand" is being typed).
      const spread = (t: string) => {
        while (t[0] === '#' && qi + 1 < all && pos[qi + 1].has(t)) {
          qi += 1;
          got += 1;
        }
      };
      spread(toks[i]);
      for (let j = i + 1; j < toks.length; j++) {
        spread(toks[j - 1]);
        if (qi + 1 < all && pos[qi + 1].has(toks[j])) {
          qi += 1;
          got += 1;
        } else if (qi + 2 < all && pos[qi + 2].has(toks[j])) {
          qi += 2;
          got += 0.5;
        } else if (qi + 2 < all && j + 1 < toks.length && pos[qi + 2].has(toks[j + 1])) {
          // A different word in the same place ("into" for "in").
          qi += 2;
          j += 1;
          got += 1.5;
        } else break;
      }
      run = Math.max(run, got);
    }
  }
  let pairs = 0;
  for (let q = 0; q + 1 < all; q++) {
    for (let i = 0; i < toks.length; i++) {
      if (pos[q].has(toks[i]) && (pos[q + 1].has(toks[i + 1]) || (toks[i][0] === '#' && pos[q + 1].has(toks[i])))) {
        pairs++;
        break;
      }
    }
  }
  return run / all + pairs / (all - 1);
}

/** Tokens per verse per text, kept across searches: typing re-ranks the
 *  same verses on every key. */
const tokCache = new WeakMap<string[], (string[] | undefined)[]>();
const rawCache = new WeakMap<string[], (string[] | undefined)[]>();
/** Folded once the extra index (which holds the folded forms) has loaded;
 *  until then queries look for the words as written. */
function verseTokens(ls: string[], v: number, folded: boolean): string[] {
  const m = folded ? tokCache : rawCache;
  let c = m.get(ls);
  if (!c) m.set(ls, (c = []));
  return (c[v] ??= folded ? foldedTokens(ls[v] ?? '') : tokens(ls[v] ?? ''));
}

interface Unit {
  v: number;
  span: number;
  cover: number;
}

/**
 * Best verses for an English query. `texts` (the BSB, one string per verse)
 * is optional; without it results are ranked on words alone. `extra` adds
 * other translations' wording.
 */
export function searchEnglish(a: Atlas, query: string, limit = 60, texts?: string[] | null, extra?: Extra | null): SearchResult {
  const terms = parseQuery(a, query, extra);
  if (!terms.length) return EMPTY;
  const n = a.rank.length;
  const score = new Float32Array(n);
  const hits = new Uint8Array(n);
  const touched: number[] = [];
  const idf: number[] = [];
  const bests: Map<number, number>[] = [];
  const words = new Set<string>();
  const unknown: string[] = [];
  for (const t of terms) {
    // Best weight per verse for this term, in any translation.
    const best = new Map<number, number>();
    const add = (v: number, weight: number) => {
      if ((best.get(v) ?? 0) < weight) best.set(v, weight);
    };
    for (const [x, weight] of t.alts) {
      const i = find(a.englishWords, x);
      if (i >= 0) for (let p = a.eOff[i]; p < a.eOff[i + 1]; p++) add(a.eVerse[p], weight);
      const more = extra?.index.get(x);
      if (more) for (const v of more) add(v, weight);
    }
    bests.push(best);
    if (!best.size) unknown.push(t.typed ?? t.text);
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

  // Short queries must match fully; long ones (quotes from memory) may miss a few words.
  const floor = (all <= 2 ? 0.99 : all <= 4 ? 0.6 : 0.45) * 0.999;
  let units: Unit[] = [];
  // (Fully: each word or a form of it, or the start of the word being typed.)
  for (const v of touched) if (score[v] / mass >= floor || (all <= 2 && hits[v] >= all)) units.push({ v, span: 1, cover: score[v] / mass });
  // Words remembered from around a verse: a verse and the next, together,
  // when together they hold clearly more of the query than either alone.
  if (all >= 3) {
    for (const v of touched) {
      const w = v + 1;
      if (w >= n || a.verseBook[w] !== a.verseBook[v] || !score[w]) continue;
      let s2 = 0;
      for (let t = 0; t < all; t++) s2 += idf[t] * Math.max(bests[t].get(v) ?? 0, bests[t].get(w) ?? 0);
      const c2 = s2 / mass;
      if (c2 >= floor && c2 >= Math.max(score[v], score[w]) / mass + 0.2) units.push({ v, span: 2, cover: c2 - 0.05 });
    }
  }
  if (!units.length) units = touched.map((v) => ({ v, span: 1, cover: score[v] / mass }));
  units.sort((x, y) => y.cover - x.cover || a.rank[y.v] - a.rank[x.v] || x.v - y.v);

  const via = new Map<Unit, string>();
  if (texts && all >= 2) {
    units = units.slice(0, 600);
    const pos = terms.map((t) => t.alts);
    const fine = new Map<Unit, number>();
    const versions: [string | null, string[]][] = [[null, texts], ...(extra?.names.map((nm, i): [string, string[]] => [nm, extra.lines[i]]) ?? [])];
    for (const u of units) {
      let order = -1;
      let bsbToks = 0;
      for (const [name, ls] of versions) {
        const f = !!extra;
        const toks = u.span === 2 ? [...verseTokens(ls, u.v, f), ...verseTokens(ls, u.v + 1, f)] : verseTokens(ls, u.v, f);
        if (!name) bsbToks = toks.length;
        const o = orderScore(toks, pos);
        // Another translation's wording wins only when it reads clearly closer.
        if (name ? o > order + 0.25 : o > order) {
          // Name it only when that wording really reads like the query.
          if (name && o >= 0.8) via.set(u, name);
          else via.delete(u);
          order = o;
        }
      }
      // Shorter verses that are mostly the query read as the quote itself.
      const focus = Math.min(1, all / Math.max(1, bsbToks));
      fine.set(u, u.cover * 4 + order * 2 + focus * 0.5 + a.rank[u.v] * 0.5);
    }
    units.sort((x, y) => fine.get(y)! - fine.get(x)! || x.v - y.v);
  }
  // A verse shows once: drop results that overlap a better one.
  const taken = new Set<number>();
  const out: Unit[] = [];
  for (const u of units) {
    if (out.length >= limit) break;
    if (taken.has(u.v) || (u.span === 2 && taken.has(u.v + 1))) continue;
    out.push(u);
    for (let k = 0; k < u.span; k++) taken.add(u.v + k);
  }
  const guesses = terms.filter((t) => t.guessed.length).map((t): [string, string[]] => [t.typed ?? t.text, t.guessed]);
  return {
    verses: out.map((u) => u.v),
    spans: out.map((u) => u.span),
    via: out.map((u) => via.get(u) ?? null),
    total,
    words,
    unknown,
    guesses,
  };
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
