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

/** One play on words (or name meaning) from a layered passage. */
export interface Play {
  passage: Passage;
  layer: Layer;
  /** The verses it shows under, in order. */
  verses: VerseRef[];
  /** Where the wordplay walk stops for it: the layered passage's verse if the
   * line shows there, else its first verse. */
  anchor: VerseRef;
  /** One [verse, position, root] per different word, in order. */
  words: [VerseRef, number, number][];
}

export interface Data {
  letters: string[];
  poems: Map<string, Poem>;
  plays: Map<VerseRef, Play[]>;
  /** Where each play is anchored, in Bible order, once each: the wordplay walk. */
  walk: VerseRef[];
  lines: Map<VerseRef, NoteLine>;
}

export const LETTER_NAMES = ['Aleph', 'Bet', 'Gimel', 'Dalet', 'He', 'Vav', 'Zayin', 'Het', 'Tet', 'Yod', 'Kaf', 'Lamed', 'Mem', 'Nun', 'Samekh', 'Ayin', 'Pe', 'Tsade', 'Qof', 'Resh', 'Shin', 'Tav'];

const KINDS = new Set(['wordplay', 'name meaning']);
/** A layer's ref this short (in verses) gets the line; longer ones are context. */
const SHORT_REF = 3;
/** Words named on the line, at most. */
const LINE_WORDS = 3;

export function chapterKey(c: ChapterRef): string {
  return `${c.book}.${c.chapter}`;
}

/** A transliteration as plain letters: "a.da.mah" -> "adamah". */
export function say(translit: string): string {
  return translit.replace(/[.ʼ’'-]/g, '').toLowerCase();
}

/** A name as its gloss gives it ("Jacob"), when the root is a name. */
function nameOf(a: Atlas, root: number): string | null {
  const g = a.lemmas.gloss[root] ?? '';
  return /^[A-Z][a-z]/.test(g) ? g.split(/[:(]/)[0].trim() : null;
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function lineFor(a: Atlas, play: Play): string {
  const L = a.lemmas;
  if (play.layer.kind === 'name meaning') {
    const names = [...new Set(play.words.map(([, , r]) => nameOf(a, r)).filter((n): n is string => !!n))];
    return names.length ? `What a name means: ${list(names.slice(0, 2))}` : 'What a name means here';
  }
  const said = [...new Set(play.words.map(([, , r]) => say(L.translit[r] || '')).filter(Boolean))];
  if (said.length < 2) return 'A play on words here';
  const shown = said.slice(0, LINE_WORDS);
  return `A play on words: ${list(shown)}${said.length > LINE_WORDS ? ' and more' : ''}`;
}

function playOf(p: Passage, l: Layer, a: Atlas): Play {
  // One word per different root, as Layers shows them.
  const seen = new Set<string>();
  const words: [VerseRef, number, number][] = [];
  for (const w of l.words) {
    const key = a.lemmas.word[w[2]];
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(w);
  }
  const vs = new Set<VerseRef>(l.words.map((w) => w[0]));
  for (const r of l.refs) if (r.e - r.s < SHORT_REF) for (let v = r.s; v <= r.e; v++) vs.add(v);
  if (!vs.size) for (let v = p.v; v <= p.end; v++) vs.add(v);
  const verses = [...vs].sort((x, y) => x - y);
  return { passage: p, layer: l, verses, anchor: vs.has(p.v) ? p.v : verses[0], words };
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
  for (const p of layered) {
    for (const l of p.layers) {
      if (!KINDS.has(l.kind)) continue;
      const play = playOf(p, l, a);
      for (const v of play.verses) {
        const at = plays.get(v);
        if (at) at.push(play);
        else plays.set(v, [play]);
      }
    }
  }
  const lines = new Map<VerseRef, NoteLine>();
  for (const [v, ps] of plays) {
    const first = lineFor(a, ps[0]);
    lines.set(v, ps.length > 1 ? `${first} (and ${ps.length - 1} more)` : first);
  }
  const walk = [...new Set([...plays.values()].flat().map((p) => p.anchor))].sort((x, y) => x - y);
  return { letters: file.letters, poems, plays, walk, lines };
}

/** The walk around a verse: the nearest stops before and after it that are
 * not the plays shown at `v`, and the number of the stop `v` shows (from 1). */
export function neighbours(d: Data, v: VerseRef): { prev: VerseRef | null; next: VerseRef | null; at: number } {
  const plays = d.plays.get(v) ?? [];
  const here = new Set(plays.map((p) => p.anchor));
  let prev: VerseRef | null = null;
  let next: VerseRef | null = null;
  for (const s of d.walk) {
    if (here.has(s) || s === v) continue;
    if (s < v) prev = s;
    else if (next === null) next = s;
  }
  const stop = here.has(v) ? v : plays[0]?.anchor;
  return { prev, next, at: stop === undefined ? 0 : d.walk.indexOf(stop) + 1 };
}
