// The data behind the study notes extra, as crates/atlas-cli/src/extra_notes.rs
// writes it, and the lookups the line and the panel make over it.

import { type Atlas, locate } from '../../../data/atlas';
import { loadJson } from '../data';
import { refName } from '../kit';
import type { VerseRef } from '../types';

/** web/public/data/extras/notes.json. */
export interface IndexFile {
  format: number;
  /** The source's version, e.g. "1.1.2". */
  version: string;
  /** Two numbers per note, in order of first verse: the first verse minus the
   * previous note's, then the number of verses after the first. */
  n: number[];
  /** How many notes each book has, in book order. */
  per: number[];
}

/** A piece of a note: words, [words] in italics, or [from, to, words] naming verses. */
export type Run = string | [string] | [number, number, string];
export type Block = ['p', Run[]] | ['ul' | 'ol', Run[][]];

/** web/public/data/extras/notes/<Book>.json, loaded when the panel opens:
 * the book's notes in the same order as the index. */
export interface BookFile {
  format: number;
  notes: { id: string; b: Block[] }[];
}

/** A note on a passage of up to this many verses counts as a note on each of
 * its verses. Wider ones are notes on the passage around the verse. */
const OWN_SPAN = 3;

/** One note that covers a verse: its place in the book file, and its verses. */
export interface Hit {
  i: number;
  from: VerseRef;
  to: VerseRef;
}

export interface Hits {
  /** Notes on the verse itself (or on up to three verses with it), narrowest first. */
  own: Hit[];
  /** Notes on a wider passage around it, narrowest first. */
  wide: Hit[];
}

export interface Data {
  a: Atlas;
  version: string;
  from: Uint32Array;
  to: Uint32Array;
  /** The index of each book's first note, and one past the last book's. */
  start: number[];
  cache: Map<VerseRef, Hits>;
}

export async function load(a: Atlas): Promise<Data> {
  const file = await loadJson<IndexFile>(a, 'extras/notes.json');
  const count = file.n.length >> 1;
  const from = new Uint32Array(count);
  const to = new Uint32Array(count);
  let at = 0;
  for (let k = 0; k < count; k++) {
    at += file.n[2 * k];
    from[k] = at;
    to[k] = at + file.n[2 * k + 1];
  }
  const start = [0];
  for (const c of file.per) start.push(start[start.length - 1] + c);
  return { a, version: file.version, from, to, start, cache: new Map() };
}

function byWidth(x: Hit, y: Hit): number {
  return x.to - x.from - (y.to - y.from) || x.from - y.from;
}

/** The notes that cover a verse. */
export function hits(d: Data, verse: VerseRef): Hits {
  let h = d.cache.get(verse);
  if (h) return h;
  h = { own: [], wide: [] };
  if (verse >= 0 && verse < d.a.n) {
    const book = locate(d.a, verse).book;
    const lo = d.start[book] ?? 0;
    const hi = d.start[book + 1] ?? lo;
    for (let k = lo; k < hi && d.from[k] <= verse; k++) {
      if (d.to[k] < verse) continue;
      const hit = { i: k - lo, from: d.from[k], to: d.to[k] };
      (hit.to - hit.from < OWN_SPAN ? h.own : h.wide).push(hit);
    }
    h.own.sort(byWidth);
    h.wide.sort(byWidth);
  }
  d.cache.set(verse, h);
  return h;
}

/** A passage's name as seen from a verse: "this verse", "verses 6–8" in the
 * same chapter, or its full name ("Genesis 1:1–2:3"). */
export function nameFrom(a: Atlas, verse: VerseRef, from: VerseRef, to: VerseRef): string {
  if (from === verse && to === verse) return 'this verse';
  const v = locate(a, verse);
  const s = locate(a, from);
  const e = locate(a, to);
  if (s.book === v.book && s.chapter === v.chapter && e.chapter === v.chapter) {
    return from === to ? `verse ${s.verse}` : `verses ${s.verse}–${e.verse}`;
  }
  return refName(a, from, to);
}
