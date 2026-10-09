// The data behind the wordplay line: the plays on words and name meanings in
// the reviewed layers (layers.json, written by `atlas build` from
// config/layers.json, drafts left out), and the alphabet poems that
// crates/atlas-cli/src/extra_wordplay.rs checks letter by letter against the
// Hebrew (extras/wordplay.json). load() does all the work, so a line is one
// Map.get.

import type { Atlas } from '../../../data/atlas';
import type { Layer, Passage } from '../../../data/layers';
import { loadJson } from '../data';
import type { ChapterRef, NoteLine, VerseRef } from '../types';

/** A part of an alphabet poem: letter index (0 is aleph), verse, word position, mark. */
export type Part = [number, VerseRef, number, number];
export const MARK = { normal: 0, extra: 1, otherCopies: 2, afterAnd: 3 } as const;

export interface Poem {
  book: number;
  chapter: number;
  /** The first and last verse of the poem. */
  from: VerseRef;
  to: VerseRef;
  line: string;
  /** What is unusual about this poem, for Deep, or "". */
  note: string;
  parts: Part[];
  /** Letters no line starts with. */
  missing: number[];
}

interface WordplayFile {
  format: number;
  letters: string[];
  acrostics: Poem[];
}

/** [verse, word position, root] */
export type WordAt = [VerseRef, number, number];

/** One play on words (or name meaning) from a layered passage. */
export interface Play {
  passage: Passage;
  layer: Layer;
  /** The verses its line shows under: the verses its words are in, or the
   * layered passage's verse when it names no words. */
  verses: VerseRef[];
  /** Where the wordplay walk stops for it: the layered passage's verse if the
   * line shows there, else its first verse. */
  anchor: VerseRef;
  /** Every word it rests on, in order. */
  words: WordAt[];
  /** The first of each different root, in order: one card per word. */
  roots: WordAt[];
}

export interface Data {
  letters: string[];
  poems: Map<string, Poem>;
  /** The plays whose line shows under each verse. */
  plays: Map<VerseRef, Play[]>;
  /** The wordplay walk: each play's anchor, in Bible order, once each. */
  walk: VerseRef[];
  /** The plays anchored at each stop of the walk. */
  stops: Map<VerseRef, Play[]>;
  lines: Map<VerseRef, NoteLine>;
}

export const LETTER_NAMES = ['Aleph', 'Bet', 'Gimel', 'Dalet', 'He', 'Vav', 'Zayin', 'Het', 'Tet', 'Yod', 'Kaf', 'Lamed', 'Mem', 'Nun', 'Samekh', 'Ayin', 'Pe', 'Tsade', 'Qof', 'Resh', 'Shin', 'Tav'];

const KINDS = new Set(['wordplay', 'name meaning']);
/** Words named on the line, at most. */
const LINE_WORDS = 3;
/** Glosses that start with a capital but name God, not a person or place. */
const GOD = /^(the )?(lord|god)\b|^yhwh|^most high|^almighty/i;
/** A gloss that is a name: "Jacob", "No Mercy". */
const NAME = /^[A-Z][a-z]+(?: [A-Z][a-z]+)*$/;

export function chapterKey(c: ChapterRef): string {
  return `${c.book}.${c.chapter}`;
}

/** The name a root's gloss gives ("Jacob"), when the root is a person's or a place's name. */
export function nameOf(a: Atlas, root: number): string | null {
  const g = (a.lemmas.gloss[root] ?? '').split(/[:(]/)[0].trim();
  return NAME.test(g) && !GOD.test(g) ? g : null;
}

/** A root's dictionary form as a reader would say it: "a.da.mah" -> "adamah",
 * "me.at" -> "me’at", "ye.ho.vah" -> "Yahweh", "hudōr, hudatos" -> "hudōr". */
export function say(a: Atlas, root: number): string {
  const L = a.lemmas;
  let t = (L.translit[root] || '').split(',')[0].trim();
  if (L.lang[root] !== 'G') {
    // The divine name as the verse rows give it, not the Masoretic reading.
    t = t.replace(/ye\.ho\.v[ai]h/g, 'Yahweh');
    // A Hebrew syllable starts with a consonant, so a later syllable that
    // starts with a vowel began with aleph or ayin: mark it. A last "ach"
    // is the vowel slipped in before a final het (no.ach), not a letter.
    t = t
      .split(/([ -])/)
      .map((w) =>
        w
          .split('.')
          .map((syl, i, all) => (i > 0 && /^[aeiou]/.test(syl) && !(i === all.length - 1 && syl === 'ach') ? `’${syl}` : syl))
          .join(''),
      )
      .join('');
  }
  t = t.replace(/\./g, '');
  return nameOf(a, root) ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** The roots of a play at verse v, then its other roots in the same language. */
function rootsFor(a: Atlas, play: Play, v: VerseRef): number[] {
  const here = play.words.filter((w) => w[0] === v).map((w) => w[2]);
  const langs = new Set(here.map((r) => a.lemmas.lang[r]));
  const rest = play.roots.map((w) => w[2]).filter((r) => langs.has(a.lemmas.lang[r]));
  const seen = new Set<string>();
  return [...here, ...rest].filter((r) => {
    const k = a.lemmas.word[r];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** The line for one play under verse v, naming the words in v first. */
function lineFor(a: Atlas, play: Play, v: VerseRef): string {
  const roots = rootsFor(a, play, v);
  if (play.layer.kind === 'name meaning') {
    const here = new Set(play.words.filter((w) => w[0] === v).map((w) => w[2]));
    const names = [...new Set(roots.map((r) => (here.has(r) ? nameOf(a, r) : null)).filter((n): n is string => !!n))];
    const elsewhere = roots.map((r) => nameOf(a, r)).find((n) => !!n);
    if (names.length) return `What a name means: ${list(names.slice(0, 2))}`;
    return elsewhere ? `What a name means: ${elsewhere}` : 'What a name means here';
  }
  const said = [...new Set(roots.map((r) => say(a, r)).filter(Boolean))];
  if (said.length >= 2) return `A play on words: ${list(said.slice(0, LINE_WORDS))}`;
  // One word, used again and again.
  const word = roots.length === 1 ? a.lemmas.word[roots[0]] : null;
  if (word !== null && play.words.filter((w) => a.lemmas.word[w[2]] === word).length > 1) return `A word repeated: ${said[0]}`;
  return 'A play on words here';
}

/** How well a play's line fits verse v: two of its words here, one, or none. */
function fit(a: Atlas, play: Play, v: VerseRef): number {
  const here = new Set(play.words.filter((w) => w[0] === v).map((w) => a.lemmas.word[w[2]]));
  return here.size >= 2 ? 2 : here.size;
}

function playOf(p: Passage, l: Layer, a: Atlas): Play {
  const seen = new Set<string>();
  const roots: WordAt[] = [];
  for (const w of l.words) {
    const key = a.lemmas.word[w[2]];
    if (seen.has(key)) continue;
    seen.add(key);
    roots.push(w);
  }
  const vs = new Set<VerseRef>(l.words.map((w) => w[0]));
  if (!vs.size) vs.add(p.v);
  const verses = [...vs].sort((x, y) => x - y);
  return { passage: p, layer: l, verses, anchor: vs.has(p.v) ? p.v : verses[0], words: l.words, roots };
}

function add<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const at = m.get(k);
  if (at) at.push(v);
  else m.set(k, [v]);
}

export async function load(a: Atlas): Promise<Data> {
  const [file, layered] = await Promise.all([
    loadJson<WordplayFile>(a, 'extras/wordplay.json'),
    // Older builds have no layers; the alphabet poems still show.
    loadJson<Passage[]>(a, 'layers.json').catch(() => [] as Passage[]),
  ]);
  const poems = new Map<string, Poem>();
  for (const p of file.acrostics) poems.set(chapterKey(p), p);
  const plays = new Map<VerseRef, Play[]>();
  const stops = new Map<VerseRef, Play[]>();
  for (const p of layered) {
    for (const l of p.layers) {
      if (!KINDS.has(l.kind)) continue;
      const play = playOf(p, l, a);
      for (const v of play.verses) add(plays, v, play);
      add(stops, play.anchor, play);
    }
  }
  const lines = new Map<VerseRef, NoteLine>();
  for (const [v, ps] of plays) {
    // The play with the most of its words in this verse leads.
    ps.sort((x, y) => fit(a, y, v) - fit(a, x, v));
    const first = lineFor(a, ps[0], v);
    lines.set(v, ps.length > 1 ? `${first}, and ${ps.length - 1} more` : first);
  }
  const walk = [...stops.keys()].sort((x, y) => x - y);
  return { letters: file.letters, poems, plays, walk, stops, lines };
}

/** Where the walk goes from the panel at verse v: `at` is the stop being
 * shown (null for v's own plays). Previous and Next are walk indexes; a stop
 * whose plays all show already is passed over. `n` numbers the stop shown
 * (from 1), or is 0 when v is between stops. */
export function neighbours(d: Data, v: VerseRef, at: number | null): { prev: number | null; next: number | null; n: number } {
  if (at !== null) return { prev: at > 0 ? at - 1 : null, next: at < d.walk.length - 1 ? at + 1 : null, n: at + 1 };
  const shown = new Set(d.plays.get(v) ?? []);
  const fresh = (s: VerseRef) => (d.stops.get(s) ?? []).some((p) => !shown.has(p));
  let prev: number | null = null;
  let next: number | null = null;
  d.walk.forEach((s, i) => {
    if (s < v && fresh(s)) prev = i;
    else if (s > v && next === null && fresh(s)) next = i;
  });
  return { prev, next, n: d.walk.indexOf(v) + 1 };
}
