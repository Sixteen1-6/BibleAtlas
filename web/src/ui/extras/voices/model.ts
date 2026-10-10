// The data behind the "Christian writers" extra, as
// crates/atlas-cli/src/extra_voices.rs writes it, the works it comes from, and
// the reader's choice to see what they wrote.

import { signal } from '@preact/signals';
import { type Atlas, locate } from '../../../data/atlas';
import { loadJson } from '../data';
import { refName } from '../kit';
import type { VerseRef } from '../types';

/** web/public/data/extras/voices.json. */
export interface IndexFile {
  format: number;
  /** One character per verse: '0' plus a bit for each work with a note on it. */
  has: string;
  /** Each book's files, as the first chapter of each. */
  parts: number[][];
}

/** Words, or [from, to, words] naming verses. */
export type Run = string | [number, number, string];
/** A note's words: one string, or words and verse names. Paragraphs are
 * split by a blank line. */
export type Text = string | Run[];
/** One note: [work, first verse, last verse, voices], each voice [who, text];
 * `who` is a Father's name in the Catena, else "". */
export type Item = [number, number, number, [string, Text][]];

/** web/public/data/extras/voices/<Book>.<k>.json. */
export interface PartFile {
  format: number;
  items: Item[];
}

/** web/public/data/extras/voices/hebrew.json, for the link to Sefaria. */
export interface HebrewFile {
  format: number;
  runs: [number, number, number, number][];
}

export const HEBREW_FILE = 'extras/voices/hebrew.json';

export interface Work {
  /** How the line names the work. */
  short: string;
  /** The heading over its notes. */
  name: string;
  /** Under the heading: the book and when it was written. */
  book: string;
  /** Its card on the Sources shelf (config/shelf.json). */
  shelf: string;
}

/** The works, oldest first, in the order the build numbers them. */
export const WORKS: readonly Work[] = [
  {
    short: 'the Church Fathers',
    name: 'The Church Fathers',
    book: 'As Thomas Aquinas gathered them in the Catena Aurea (the Golden Chain), 1260s; translated 1841–45',
    shelf: 'catena-aurea',
  },
  {
    short: 'Matthew Henry',
    name: 'Matthew Henry',
    book: 'Concise Commentary on the Whole Bible, from his commentary of 1706–21',
    shelf: 'henry-concise',
  },
  {
    short: 'John Wesley',
    name: 'John Wesley',
    book: 'Explanatory Notes on the Old and New Testaments, 1755–66',
    shelf: 'wesley-notes',
  },
];

export interface Data {
  a: Atlas;
  has: string;
  parts: number[][];
}

export async function load(a: Atlas): Promise<Data> {
  const file = await loadJson<IndexFile>(a, 'extras/voices.json');
  return { a, has: file.has, parts: file.parts };
}

/** The works with a note on a verse, oldest first. */
export function worksOn(d: Data, verse: VerseRef): number[] {
  const bits = (d.has.charCodeAt(verse) || 48) - 48;
  return WORKS.map((_, w) => w).filter((w) => bits & (1 << w));
}

/** The file that holds a verse's notes, or null if it has none. */
export function partOf(d: Data, verse: VerseRef): string | null {
  if (worksOn(d, verse).length === 0) return null;
  const l = locate(d.a, verse);
  const starts = d.parts[l.book] ?? [];
  let k = -1;
  for (let i = 0; i < starts.length && starts[i] <= l.chapter; i++) k = i;
  return k < 0 ? null : `extras/voices/${d.a.books[l.book].osis}.${k}.json`;
}

/** The notes on a verse, oldest work first. */
export function notesOn(file: PartFile, verse: VerseRef): Item[] {
  return file.items.filter((x) => x[1] <= verse && verse <= x[2]).sort((x, y) => x[0] - y[0] || x[2] - x[1] - (y[2] - y[1]));
}

/** A passage's name as seen from a verse: "this verse", "verses 6–8" in the
 * same chapter, or its full name. */
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

/** The words of a list: "a", "a and b", "a, b and c". */
export function listWords(xs: readonly string[]): string {
  return xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/** Whether the reader has chosen to see the writers' notes. Off until they
 * do; remembered per browser. */
export const voicesAllowed = (() => {
  const key = 'atlas.voices';
  let initial = false;
  try {
    initial = localStorage.getItem(key) === '1';
  } catch {
    // Storage blocked (private window): ask again next time.
  }
  const s = signal(initial);
  s.subscribe((v) => {
    try {
      localStorage.setItem(key, v ? '1' : '0');
    } catch {
      // Ignore: the choice just won't be remembered.
    }
  });
  return s;
})();
