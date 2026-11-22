// Word choice: the data the build writes (crates/atlas-cli/src/extra_grammar.rs)
// and what the line and the panels read from it.

import type { Atlas } from '../../../data/atlas';
import { loadJson } from '../data';
import type { ChapterRef, VerseRef } from '../types';

/** A grammar a term quotes. */
export interface Work {
  id: string;
  writer: string;
  about: string;
  title: string;
  written: string;
  url: string;
  site: string;
  /** Its card on the Sources shelf. */
  shelf: string;
}

/** A grammarian's own words on a form. */
export interface Say {
  work: string;
  quote: string;
  page: string;
  url: string;
  read: string;
}

export interface Term {
  id: string;
  lang: 'greek' | 'hebrew' | 'aramaic' | 'any';
  name: string;
  /** What the tags show. */
  fact: string;
  /** What the form conveys; present only with `says`. */
  plain?: string;
  care?: string;
  says?: Say[];
}

export interface LinkWord {
  id: string;
  name: string;
  plain: string;
  /** It looks back to what was just said. */
  back: boolean;
}

/** web/public/data/extras/grammar.json */
export interface IndexFile {
  format: 1;
  works: Work[];
  terms: Term[];
  links: LinkWord[];
  /** The lines; the first is empty. */
  lines: string[];
  /** One character per verse: its line's place in ALPHABET. */
  at: string;
  /** One character per chapter, '1' where it has an outline. */
  chapters: string;
}

/** One point on a verse:
 * ['v', word, terms]           a verb's form
 * ['x', term, words]           a construction
 * ['j', word, link, from?, to?] a linking word, and the verses it looks back to
 * ['r', word, uses, other?]    a rare word, and its other verse when there are two
 * ['c', chain]                 the verse has part of a chain
 * ['l', list]                  a list starts here */
export type Point =
  | ['v', number, number[]]
  | ['x', number, number[]]
  | ['j', number, number, number?, number?]
  | ['r', number, number, number?]
  | ['c', number]
  | ['l', number];

/** A word's place: [verse, position among the verse's words]. */
export type At = [VerseRef, number];

/** A Christian writer's own sentence on the verse's words: [work, word,
 * terms, words, link?]. The work is numbered as the Christian writers extra
 * numbers it (ui/extras/voices/model.ts); the word is its place among the
 * verse's words, or -1 when the sentence is tied to none. The terms are the
 * forms or the construction it speaks of, or the rare-word term; the link is
 * the linking word it is on. With neither, it is on why that word is used. */
export type Note = [number, number, number[], string, number?];

/** web/public/data/extras/grammar/<Book>.json */
export interface BookFile {
  format: 1;
  v: Record<string, Point[]>;
  /** The writers' sentences, by verse. */
  notes?: Record<string, Note[]>;
  /** [term, members] */
  chains: [number, At[]][];
  lists: At[][];
  /** The verses that start a paragraph. */
  starts: VerseRef[];
}

/** web/public/data/extras/grammar/codes-g.json and codes-h.json: STEPBible's
 * expansion of each verb tag, as [the form in words, what it means, an example]. */
export interface CodesFile {
  format: 1;
  codes: Record<string, [string, string, string]>;
}

export interface Data extends IndexFile {
  /** Each book's first chapter, counted through the whole Bible. */
  firstChapter: ArrayLike<number>;
}

const ALPHABET = "!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~";

export const SOURCE = 'Forms from STEPBible’s tagged Hebrew, Aramaic and Greek texts, with STEPBible’s expansion of each grammar tag, CC BY 4.0.';

export async function load(a: Atlas): Promise<Data> {
  const file = await loadJson<IndexFile>(a, 'extras/grammar.json');
  return { ...file, firstChapter: a.bookChapterStart };
}

/** The verse's line, or null. */
export function lineAt(d: Data, verse: VerseRef): string | null {
  const i = ALPHABET.indexOf(d.at[verse] ?? '!');
  const line = i > 0 ? d.lines[i] : undefined;
  return line ? `Word choice: ${line}` : null;
}

/** Whether the chapter has an outline. */
export function hasOutline(d: Data, c: ChapterRef): boolean {
  return d.chapters[d.firstChapter[c.book] + c.chapter - 1] === '1';
}

export function bookFile(a: Atlas, book: number): string {
  return `extras/grammar/${a.books[book].osis}.json`;
}

/** The tag STEPBible expands for a word: a Greek word's whole tag, or a
 * Hebrew or Aramaic word's verb part with its language letter ("HVqw3ms"). */
export function verbCode(tag: string): string {
  if (tag[0] !== 'H' && tag[0] !== 'A') return tag;
  if (tag.startsWith('A-') || tag.startsWith('ADV')) return tag;
  const seg = tag
    .slice(1)
    .split('/')
    .find((s) => s[0] === 'V');
  return seg ? tag[0] + seg : tag;
}

/** "3 Sept 2026" from "2026-09-03". */
export function day(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const name = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'][m - 1];
  return name && d ? `${d} ${name} ${y}` : iso;
}
