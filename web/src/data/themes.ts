// Themes for one verse, and themes next to each other. Everything here is
// read from the build output (themes.json, meta.json and the cross-references
// in atlas.bin), never chosen by hand, and cached per atlas.
//
// A verse's own themes: the themes one of whose words is among the verse's
// main-edition words (themeVerses in thread.ts, less skipWith verses). The
// focused themes come first and Study's broad words after them; each part is
// ordered by how many of the verse's strongest links carry the same theme,
// then the rarer theme first.
//
// Themes through links: for a verse, take its `top` strongest links with
// `votes` or more (either direction, the best votes per linked verse). A
// theme counts when `carriers` of those linked verses carry it, or one link
// has `soloVotes` or more. Themes of more than `maxThemeSize` verses, themes
// the verse already has, and themes whose left-out sense is in the verse are
// skipped. Ranked by carrying links, then the summed log2(1 + votes), then
// the smaller theme. The same rule, with the same constants from
// meta.themeLinks, runs in crates/atlas-cli/src/themes.rs for atlas verify.

import { englishParts } from './align';
import { type Atlas, type Theme, type ThemeLinkRule, versesWithRoot } from './atlas';
import { FLAG, type VerseRow } from './text';
import { THREAD_VOTES, themeThread, themeVerses } from './thread';

/** Which themes show: Simple shows the focused ones, Study (and Deep) the
 *  broad words too. */
export type ThemeLevel = 'simple' | 'study';

/** The rule as config/themes.json had it when this code was written, for a
 *  build whose meta.json predates themeLinks. */
const DEFAULT_LINKS: ThemeLinkRule = { votes: 3, top: 10, carriers: 2, soloVotes: 10, maxThemeSize: 500 };
/** How many themes the first screen offers when meta.json names none. */
const FEATURED = 8;

export function linkRule(a: Atlas): ThemeLinkRule {
  return a.meta.themeLinks ?? DEFAULT_LINKS;
}

/** Whether a theme shows at a level. */
export function shownAt(t: Theme, level: ThemeLevel): boolean {
  return level === 'study' || t.level !== 'study';
}

/** How many themes show at a level. */
export function themeCount(a: Atlas, level: ThemeLevel): number {
  return a.themes.filter((t) => shownAt(t, level)).length;
}

/** The themes the Themes panel starts with: meta.themeFeatured, else the
 *  first few Simple themes. */
export function featuredThemes(a: Atlas): Theme[] {
  const ids = a.meta.themeFeatured;
  const out = ids ? ids.map((id) => a.themes.find((t) => t.id === id)).filter((t): t is Theme => !!t && shownAt(t, 'simple')) : [];
  return out.length ? out : a.themes.filter((t) => shownAt(t, 'simple')).slice(0, FEATURED);
}

export interface ThemeGroup {
  id: string;
  name: string;
  /** Theme indices in config order, shown at the level asked for. */
  themes: number[];
}

/** The theme groups in display order, each with its themes at `level`.
 *  Groups with no theme at that level are left out. */
export function themeGroups(a: Atlas, level: ThemeLevel): ThemeGroup[] {
  const meta = a.meta.themeGroups ?? [];
  const groups: ThemeGroup[] = meta.map((g) => ({ id: g.id, name: g.name, themes: [] }));
  const other: ThemeGroup = { id: '', name: meta.length ? 'Other themes' : 'All themes', themes: [] };
  a.themes.forEach((t, j) => {
    if (!shownAt(t, level)) return;
    (groups.find((g) => g.id === t.group) ?? other).themes.push(j);
  });
  return [...groups, other].filter((g) => g.themes.length);
}

// ------------------------------------------------------------ the index

interface Index {
  /** Themes of verse v (every level): theme[off[v]..off[v + 1]], ascending. */
  off: Uint32Array;
  theme: Uint16Array;
  /** Verses per theme. */
  size: Uint32Array;
  /** Verse -> themes one of whose left-out senses it holds. */
  blocked: Map<number, number[]>;
  /** Themes through links, per level and verse. */
  through: Map<string, ThroughTheme[]>;
}

const indexes = new WeakMap<Atlas, Index>();

/** Verse -> themes, built once from the root postings (lOff/lVerse) through
 *  themeVerses, so it matches the build: main-edition words, skipWith applied. */
export function themeIndex(a: Atlas): Index {
  let ix = indexes.get(a);
  if (ix) return ix;
  const sets = a.themes.map((t) => themeVerses(a, t));
  const off = new Uint32Array(a.n + 1);
  for (const set of sets) for (const v of set) off[v + 1]++;
  for (let v = 0; v < a.n; v++) off[v + 1] += off[v];
  const cursor = off.slice(0, a.n);
  const theme = new Uint16Array(off[a.n]);
  sets.forEach((set, j) => {
    for (const v of set) theme[cursor[v]++] = j;
  });
  const blocked = new Map<number, number[]>();
  a.themes.forEach((t, j) => {
    for (const r of t.left ?? []) {
      for (const v of versesWithRoot(a, r)) {
        const list = blocked.get(v);
        if (!list) blocked.set(v, [j]);
        else if (list[list.length - 1] !== j) list.push(j);
      }
    }
  });
  ix = { off, theme, size: Uint32Array.from(sets, (s) => s.length), blocked, through: new Map() };
  indexes.set(a, ix);
  return ix;
}

/** The themes a verse's own words carry at a level, in config order. */
export function ownThemes(a: Atlas, v: number, level: ThemeLevel): number[] {
  const ix = themeIndex(a);
  const out: number[] = [];
  for (let i = ix.off[v]; i < ix.off[v + 1]; i++) if (shownAt(a.themes[ix.theme[i]], level)) out.push(ix.theme[i]);
  return out;
}

function hasTheme(ix: Index, v: number, j: number): boolean {
  for (let i = ix.off[v]; i < ix.off[v + 1]; i++) if (ix.theme[i] === j) return true;
  return false;
}

/** True if the verse is one of the theme's verses. */
export function inTheme(a: Atlas, j: number, v: number): boolean {
  return hasTheme(themeIndex(a), v, j);
}

/** Verses per theme. */
export function themeSize(a: Atlas, j: number): number {
  return themeIndex(a).size[j];
}

// ------------------------------------------------------------ links

/** Every verse linked to `v`, either direction, with the best votes of the
 *  rows joining them (votes may be zero or less). */
export function neighbourVotes(a: Atlas, v: number): Map<number, number> {
  const best = new Map<number, number>();
  const add = (u: number, w: number) => {
    if (u === v) return;
    const b = best.get(u);
    if (b === undefined || w > b) best.set(u, w);
  };
  for (let e = a.xOff[v]; e < a.xOff[v + 1]; e++) add(a.xDst[e], a.xVotes[e]);
  for (let i = a.xInOff[v]; i < a.xInOff[v + 1]; i++) {
    const e = a.xInEdge[i];
    add(a.xSrc[e], a.xVotes[e]);
  }
  return best;
}

/** The verse's `rule.top` strongest links with `rule.votes` or more, as
 *  [linked verse, votes]: strongest first, ties in canon order. */
export function strongestLinks(a: Atlas, v: number, rule: ThemeLinkRule = linkRule(a)): [number, number][] {
  return [...neighbourVotes(a, v)]
    .filter(([, w]) => w >= rule.votes)
    .sort((p, q) => q[1] - p[1] || p[0] - q[0])
    .slice(0, rule.top);
}

export interface OwnTheme {
  theme: number;
  /** How many of the verse's strongest links carry the same theme. */
  shared: number;
}

/** The verse's own themes at a level: the focused themes before Study's
 *  broad words (so Study only adds to what Simple shows), and within each,
 *  the theme most of its strongest links share first, then the rarer theme. */
export function verseThemes(a: Atlas, v: number, level: ThemeLevel): OwnTheme[] {
  const own = ownThemes(a, v, level);
  if (!own.length) return [];
  const ix = themeIndex(a);
  const links = strongestLinks(a, v);
  const broad = (j: number) => (a.themes[j].level === 'study' ? 1 : 0);
  return own
    .map((j) => ({ theme: j, shared: links.filter(([u]) => hasTheme(ix, u, j)).length }))
    .sort((p, q) => broad(p.theme) - broad(q.theme) || q.shared - p.shared || ix.size[p.theme] - ix.size[q.theme] || p.theme - q.theme);
}

export interface ThroughTheme {
  theme: number;
  /** The linked verses that carry it, as [verse, votes], strongest first. */
  via: [number, number][];
}

/** Themes reached through the verse's strongest links (see the rule at the
 *  top of this file). Never one of the verse's own themes at `level`. */
export function themesThroughLinks(a: Atlas, v: number, level: ThemeLevel): ThroughTheme[] {
  const ix = themeIndex(a);
  const key = `${level}|${v}`;
  const hit = ix.through.get(key);
  if (hit) return hit;
  const rule = linkRule(a);
  const carry = new Map<number, [number, number][]>();
  for (const [u, w] of strongestLinks(a, v, rule)) {
    for (const j of ownThemes(a, u, level)) {
      const list = carry.get(j);
      if (list) list.push([u, w]);
      else carry.set(j, [[u, w]]);
    }
  }
  const own = new Set(ownThemes(a, v, level));
  const blocked = ix.blocked.get(v) ?? [];
  const weight = (via: [number, number][]) => via.reduce((s, [, w]) => s + Math.log2(1 + w), 0);
  const out = [...carry]
    .filter(([j, via]) => !own.has(j) && !blocked.includes(j) && ix.size[j] <= rule.maxThemeSize && (via.length >= rule.carriers || via[0][1] >= rule.soloVotes))
    .map(([theme, via]) => ({ theme, via, w: weight(via) }))
    .sort((p, q) => q.via.length - p.via.length || q.w - p.w || ix.size[p.theme] - ix.size[q.theme] || p.theme - q.theme)
    .map(({ theme, via }) => ({ theme, via }));
  ix.through.set(key, out);
  return out;
}

// ------------------------------------------------------------ the words

export interface ThemeWords {
  /** The BSB words each theme word became, in English order, without repeats
   *  ("the lamb"); or, where the word-by-word alignment gives no clear BSB
   *  English for it, the word's own gloss, with `gloss` set. */
  quotes: string[];
  gloss: boolean;
  /** The theme's original words in the verse: position in the row, root. */
  words: { pos: number; root: number }[];
}

/** Words that never carry a theme on their own. An alignment that gives a
 *  theme word only these ("and", "of the") has gone astray, so the word's own
 *  gloss is shown instead of a misleading quote; at the end of a quote they
 *  are left out ("loving devotion and"). */
const SMALL = new Set(
  (
    'a an the and of to in on at by for with from into onto upon or but nor as so than that which who whom whose this these those ' +
    'it its he him his she her they them their we us our you your i me my is are was were be been being am shall will would should ' +
    'may might can could do does did has have had not no then there here when where what how also all'
  ).split(' '),
);

/** A word's contextual gloss without the source's markings for implied words
 *  ("[are] dust" is "dust", "<the> seventh" is "seventh"). */
function plainGloss(g: string): string {
  return g
    .replace(/\[[^\]]*\]|<[^>]*>|[¿¡]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A gloss as a chip shows it: without small words or punctuation at either
 *  end, which belong to the word's prefixes and suffixes ("and gracious" is
 *  "gracious", "blood of" is "blood"); unchanged if nothing else is left. */
function chipGloss(g: string): string {
  const ws = g.split(' ');
  const bare = (w: string) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  let i = 0;
  let j = ws.length;
  while (i < j && SMALL.has(bare(ws[i]))) i++;
  while (j > i && SMALL.has(bare(ws[j - 1]))) j--;
  const out = ws.slice(i, j).join(' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  return out || g;
}

/** The lowercase words of a text, less the small ones. */
function stemWords(s: string): string[] {
  return (s.toLowerCase().match(/\p{L}+/gu) ?? []).filter((w) => !SMALL.has(w));
}

/** True when two words look like forms of one word: they share their first
 *  four letters, or all of the shorter one ("son" and "sons"), which needs
 *  three letters at least. */
function sameStem(x: string, y: string): boolean {
  const n = Math.min(4, x.length, y.length);
  return n >= 3 && x.slice(0, n) === y.slice(0, n);
}

/** Index of the last item that passes, or -1 (Array.findLastIndex is newer
 *  than the build's ES2022 target). */
function lastIndex<T>(xs: T[], ok: (x: T) => boolean): number {
  for (let i = xs.length - 1; i >= 0; i--) if (ok(xs[i])) return i;
  return -1;
}

/** The theme's words in a verse, and the BSB English aligned to them. Only
 *  main-edition words count, as they do for the theme's verses.
 *
 *  Each theme word's quote is the English the alignment gives it, less two
 *  kinds of stray words a boundary a word off lets in: small words at its end
 *  ("loving devotion and" is "loving devotion"), and, where a punctuation
 *  mark splits it, the parts on the far side of the mark when only the other
 *  part looks like the word (a form of its gloss, of its dictionary gloss or
 *  of the theme's name): "in loving devotion—One who" is "in loving
 *  devotion". When the alignment gives the word no English, or only small
 *  words (it is missing there, or the build left it out as numbered for an
 *  older BSB), the word's own gloss is shown instead, with `gloss` set. */
export function themeWordsIn(a: Atlas, row: VerseRow, theme: Theme): ThemeWords {
  const roots = new Set(theme.roots);
  const al = row[2];
  // The English words, and after which of them a punctuation mark stands.
  const tokens: string[] = [];
  const mark: boolean[] = [];
  if (al) {
    for (const p of englishParts(row[0])) {
      if (p.word >= 0) {
        tokens.push(p.text);
        mark.push(false);
      } else if (tokens.length && /[^\s'’]/u.test(p.text)) mark[tokens.length - 1] = true;
    }
  }
  const name = stemWords(theme.name);
  const runs: { at: number; text: string }[] = [];
  const glosses: string[] = [];
  const words: { pos: number; root: number }[] = [];
  row[1].forEach((w, pos) => {
    if (w[3] < 0 || !roots.has(w[3]) || w[5] & FLAG.otherEditions) return;
    words.push({ pos, root: w[3] });
    const gloss = plainGloss(w[2] ?? '');
    if (al) {
      const entry = al.w[pos];
      const groups = new Set((Array.isArray(entry) ? entry.map((p) => p[2]) : [entry ?? -1]).filter((g) => g >= 0));
      let ks: number[] = [];
      al.e.forEach((g, k) => groups.has(g) && k < tokens.length && ks.push(k));
      // Parts of the quote between punctuation marks.
      const parts: number[][] = [];
      ks.forEach((k, i) => {
        if (i === 0 || mark.slice(ks[i - 1], k).some(Boolean)) parts.push([k]);
        else parts[parts.length - 1].push(k);
      });
      if (parts.length > 1) {
        const like = [...name, ...stemWords(gloss), ...stemWords(a.lemmas.gloss[w[3]] ?? '')];
        const looks = parts.map((part) => part.some((k) => like.some((x) => sameStem(x, tokens[k].toLowerCase()))));
        const first = looks.indexOf(true);
        if (first >= 0) ks = parts.slice(first, lastIndex(looks, Boolean) + 1).flat();
      }
      const end = lastIndex(ks, (k) => !SMALL.has(tokens[k].toLowerCase())) + 1;
      if (end > 0) {
        runs.push({ at: ks[0], text: ks.slice(0, end).map((k) => tokens[k]).join(' ') });
        return;
      }
    }
    if (gloss) glosses.push(chipGloss(gloss));
  });
  runs.sort((p, q) => p.at - q.at);
  const quotes = [...new Set(runs.map((r) => r.text))];
  if (quotes.length) return { quotes, gloss: false, words };
  return { quotes: [...new Set(glosses)], gloss: glosses.length > 0, words };
}

// ------------------------------------------------------------ in a theme's journey

export type Fit =
  /** The verse is step `step` of the theme's thread. */
  | { kind: 'step'; step: number }
  /** The verse is one of the theme's key verses (it has no linked thread). */
  | { kind: 'key'; step: number }
  /** The verse's best-voted link to a step of the thread (THREAD_VOTES or more). */
  | { kind: 'link'; step: number; verse: number; votes: number }
  /** None of these: one of the theme's `count` verses. */
  | { kind: 'one'; count: number };

/** Where a verse fits a theme's journey: its step of the thread, else the
 *  step it links to with the most votes (3 or more), else one of the theme's
 *  verses. For a verse outside the theme, 'one' only means it links to no step. */
export function whereItFits(a: Atlas, theme: Theme, v: number): Fit {
  const thread = themeThread(a, theme);
  const i = thread.verses.indexOf(v);
  if (i >= 0) return thread.kind === 'thread' ? { kind: 'step', step: i } : { kind: 'key', step: i };
  if (thread.kind === 'thread') {
    const nb = neighbourVotes(a, v);
    let step = -1;
    let votes = THREAD_VOTES - 1;
    thread.verses.forEach((u, k) => {
      const w = nb.get(u);
      // A tie goes to the later step, as the plan's measurements counted it.
      if (w !== undefined && w >= THREAD_VOTES && w >= votes) {
        step = k;
        votes = w;
      }
    });
    if (step >= 0) return { kind: 'link', step, verse: thread.verses[step], votes };
  }
  return { kind: 'one', count: themeVerses(a, theme).length };
}

// ------------------------------------------------------------ theme to theme

/** The links counted in the `near` list between two themes: one row per
 *  distinct verse pair with meta.themeNear.votes or more votes (the best-voted
 *  row), one end in each theme. Ordered by the earlier verse, then the later. */
export function linksBetween(a: Atlas, t1: Theme, t2: Theme): Uint32Array {
  const votes = a.meta.themeNear?.votes ?? THREAD_VOTES;
  const A = new Uint8Array(a.n);
  const B = new Uint8Array(a.n);
  for (const v of themeVerses(a, t1)) A[v] = 1;
  for (const v of themeVerses(a, t2)) B[v] = 1;
  const best = new Map<number, number>();
  for (let s = 0; s < a.n; s++) {
    if (!A[s] && !B[s]) continue;
    for (let e = a.xOff[s]; e < a.xOff[s + 1]; e++) {
      const d = a.xDst[e];
      if (d === s || a.xVotes[e] < votes || !((A[s] && B[d]) || (B[s] && A[d]))) continue;
      const key = s < d ? s * a.n + d : d * a.n + s;
      const prev = best.get(key);
      if (prev === undefined || a.xVotes[e] > a.xVotes[prev]) best.set(key, e);
    }
  }
  return Uint32Array.from([...best.keys()].sort((x, y) => x - y), (k) => best.get(k)!);
}
