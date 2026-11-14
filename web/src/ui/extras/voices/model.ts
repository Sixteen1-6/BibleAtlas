// The data behind the "Christian writers" extra, as
// crates/atlas-cli/src/extra_voices.rs writes it, and the works it comes from.
// Whether the reader sees what they wrote is the commentary notice's to say
// (ui/commentary/state.ts).

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
  /** Who wrote each book of Henry's complete commentary from Romans on, after
   * his death, by book index, from a printed list. */
  finished?: [number, string][];
}

/** Words, or [from, to, words] naming verses. */
export type Run = string | [number, number, string];
/** A note's words: one string, or words and verse names. Paragraphs are
 * split by a blank line. */
export type Text = string | Run[];
/** One note: [work, first verse, last verse, voices, left], each voice [who,
 * text]; `who` is a Father's name in the Catena, a heading such as "Henry's
 * notes on 2 Kings 18:17-37" where Henry sends the reader to another passage,
 * or "Calvin's notes on Matthew 3:13-17, in his Harmony of the Gospels", else
 * "". `left`, when there, says why a passage of the note is left out; the
 * note shows "[passage left out]" where it was. */
export type Item = [number, number, number, [string, Text][], string[]?];

/** What stands in a note where a passage is left out. */
export const LEFT_OUT = '[passage left out]';

/** web/public/data/extras/voices/<Book>.<k>.json. */
export interface PartFile {
  format: number;
  items: Item[];
}


export interface Work {
  /** How the line names the work. */
  short: string;
  /** How the line names it when the full names make the line too long. */
  brief: string;
  /** The heading over its notes. */
  name: string;
  /** Under the heading: the book and when it was written. */
  book: string;
  /** Its card on the Sources shelf (config/shelf.json). */
  shelf: string;
}

/** The panel's source line. */
export const SOURCE =
  'Public domain: the Catena Aurea in the Oxford translation (1841–45), from the Catena project; Matthew Henry’s complete and Concise commentaries, John Wesley’s Notes and John Calvin’s Commentaries (in the Calvin Translation Society’s English; Henry’s and Calvin’s transcribed by the Christian Classics Ethereal Library), from the CrossWire SWORD modules via Let’s Church.';

/** The works, in the order the build numbers them (oldest first is OLDEST_FIRST). */
export const WORKS: readonly Work[] = [
  {
    short: 'the Church Fathers',
    brief: 'the Church Fathers',
    name: 'The Church Fathers',
    book: 'As Thomas Aquinas gathered them in the Catena Aurea (the Golden Chain), 1260s; translated 1841–45',
    shelf: 'catena-aurea',
  },
  {
    short: 'Matthew Henry',
    brief: 'Henry',
    name: 'Matthew Henry’s Concise Commentary',
    book: 'Concise Commentary on the Whole Bible, from his commentary of 1706–21',
    shelf: 'henry-concise',
  },
  {
    short: 'John Wesley',
    brief: 'Wesley',
    name: 'John Wesley',
    book: 'Explanatory Notes on the Old and New Testaments, 1755–66',
    shelf: 'wesley-notes',
  },
  {
    short: 'John Calvin',
    brief: 'Calvin',
    name: 'John Calvin',
    book: 'Commentaries on the New Testament, written 1540–64 (the dates the copy gives his commentaries); in the Calvin Translation Society’s English, from 1844',
    shelf: 'calvin-commentaries',
  },
  {
    short: 'Matthew Henry',
    brief: 'Henry',
    name: 'Matthew Henry, his full commentary',
    book: 'An Exposition of the Old and New Testament, published from 1708, the whole of what he wrote, section by section; he wrote as far as Acts before his death in 1714',
    shelf: 'henry-complete',
  },
  {
    short: 'a minister who finished Matthew Henry’s commentary',
    brief: 'Henry’s finishers',
    name: 'The ministers who finished Matthew Henry’s commentary',
    book: 'Henry died in 1714, having written as far as Acts. Other ministers wrote Romans to Revelation for his Exposition',
    shelf: 'henry-complete',
  },
];

/** Henry's complete commentary, his own notes and those of the ministers who finished it. */
export const FULL = 4;
export const FINISHED = 5;

export interface Data {
  a: Atlas;
  has: string;
  parts: number[][];
  /** Who finished each book of Henry's commentary, by book index. */
  finished: Map<number, string>;
}

export async function load(a: Atlas): Promise<Data> {
  const file = await loadJson<IndexFile>(a, 'extras/voices.json');
  return { a, has: file.has, parts: file.parts, finished: new Map(file.finished ?? []) };
}

/** The works by when they were written: the Fathers, Calvin, Henry's full
 * commentary and its finishers, his Concise, Wesley. */
export const OLDEST_FIRST: readonly number[] = [0, 3, FULL, FINISHED, 1, 2];

/** The works with a note on a verse, oldest first. */
export function worksOn(d: Data, verse: VerseRef): number[] {
  const bits = (d.has.charCodeAt(verse) || 48) - 48;
  return OLDEST_FIRST.filter((w) => bits & (1 << w));
}

/** The file that holds a verse's notes from Henry's complete commentary, or
 * null if it has none: one file for each chapter. */
export function fullOf(d: Data, verse: VerseRef): string | null {
  if (!worksOn(d, verse).some((w) => w >= FULL)) return null;
  const l = locate(d.a, verse);
  return `extras/voices/full/${d.a.books[l.book].osis}.${l.chapter}.json`;
}

/** Who wrote a verse's notes in the finishers' part of Henry's commentary. */
export function finisher(d: Data, verse: VerseRef): string | null {
  return d.finished.get(locate(d.a, verse).book) ?? null;
}

/** The file that holds a verse's other notes, or null if it has none. */
export function partOf(d: Data, verse: VerseRef): string | null {
  if (!worksOn(d, verse).some((w) => w < FULL)) return null;
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

/** The writers on a verse as the line names them: in full, or by surname
 * when the full names would make the line longer than about 70 characters. */
export function writersLine(d: Data, verse: VerseRef, ws: readonly number[]): string {
  const names = (pick: (w: Work) => string) => {
    const who = finisher(d, verse);
    const out: string[] = [];
    for (const w of ws) {
      const n = w === FINISHED && who ? who : pick(WORKS[w]);
      if (!out.includes(n)) out.push(n);
    }
    return out;
  };
  const full = listWords(names((w) => w.short));
  return full.length <= 50 ? full : listWords(names((w) => w.brief));
}
