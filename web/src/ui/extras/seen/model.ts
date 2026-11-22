// The data behind "Seen in the words": places where the Bible's own words
// show a figure of speech or a pattern of lines, with no writer quoted. The
// Layers build writes them from config/figures-seen/<OSIS>.json:
//
//   extras/figures-seen.json        {format, has}: one digit per verse, the
//                                   same bits as figures.json (1 lines,
//                                   2 a figure, 4 two people)
//   extras/figures-seen/<OSIS>.json {format, notes: [{id, form, v, e?, words,
//                                   original?, whole?}]}, sorted by v
//
// The forms (their names, plain sentences and Bullinger's definitions) are
// the figures' own, from extras/figures.json. A book's places load the first
// time one of its verses is shown at Deep.

import { type Signal, signal } from '@preact/signals';
import type { Atlas } from '../../../data/atlas';
import * as S from '../../../state';
import { loadJson } from '../data';
import type { Form } from '../figures/model';
import type { VerseRef } from '../types';

export const SOURCE = 'Bible text: the BSB. Hebrew and Greek: STEPBible (CC BY 4.0). What each figure is: E. W. Bullinger, Figures of Speech Used in the Bible (1898).';

export interface Note {
  id: string;
  form: string;
  /** The verse, or the first verse of a range inside one chapter. */
  v: VerseRef;
  e?: VerseRef;
  /** Exact BSB words, each from one verse between v and e. For lines, the
   * BSB's own poetry lines. */
  words: string[];
  /** Strong's tags of the Hebrew or Greek words that show it ("H5315J"). */
  original?: string[];
  /** The one words entry is the whole verse. */
  whole?: boolean;
}

interface IndexFile {
  format: number;
  has: string;
}

interface FormsFile {
  forms: Record<string, Form>;
}

interface BookFile {
  format: number;
  notes: Note[];
}

type Book = BookFile | 'loading' | 'failed';

export interface Data {
  a: Atlas;
  forms: Record<string, Form>;
  has: string;
  books: Signal<ReadonlyMap<string, Book>>;
}

export async function load(a: Atlas): Promise<Data> {
  // Until the first places are built the index is not there, and nothing shows.
  const [f, g] = await Promise.all([loadJson<IndexFile>(a, 'extras/figures-seen.json').catch(() => ({ format: 1, has: '' })), loadJson<FormsFile>(a, 'extras/figures.json')]);
  const d: Data = { a, forms: g.forms, has: f.has, books: signal<ReadonlyMap<string, Book>>(new Map()) };
  // The selected verse's book comes with the index, so a link to the panel
  // finds its places there.
  const v = S.selected.peek();
  const name = v === null ? null : fileOf(d, v);
  if (name) {
    fetchBook(d, name);
    await loadJson(a, name).catch(() => {});
  }
  return d;
}

function bits(d: Data, verse: VerseRef): number {
  return (d.has.charCodeAt(verse) || 48) - 48;
}

function fileOf(d: Data, verse: VerseRef): string | null {
  if (!bits(d, verse)) return null;
  const b = d.a.books[d.a.verseBook[verse]];
  return b ? `extras/figures-seen/${b.osis}.json` : null;
}

const failedAt = new Map<string, number>();

function fetchBook(d: Data, name: string): void {
  const put = (p: Book) => {
    const next = new Map(d.books.peek());
    next.set(name, p);
    d.books.value = next;
  };
  put('loading');
  loadJson<BookFile>(d.a, name).then(
    (f) => put(f && Array.isArray(f.notes) ? f : 'failed'),
    () => {
      failedAt.set(name, Date.now());
      put('failed');
    },
  );
}

/** Kinds first by how much they show: two people, lines, then figures. */
const KIND_ORDER: Record<string, number> = { contrast: 0, parallelism: 1, figure: 2 };

/** The places on a verse, or null while its book loads. Reading it subscribes
 * the caller to the book's arrival; the first read starts the download. */
export function notesAt(d: Data, verse: VerseRef): Note[] | null {
  const name = fileOf(d, verse);
  if (!name) return [];
  const got = d.books.value.get(name);
  if (got === undefined) {
    queueMicrotask(() => d.books.peek().has(name) || fetchBook(d, name));
    return null;
  }
  if (got === 'loading') return null;
  if (got === 'failed') {
    const t = failedAt.get(name) ?? 0;
    if (Date.now() - t > 30_000) {
      failedAt.set(name, Date.now());
      queueMicrotask(() => d.books.peek().get(name) === 'failed' && fetchBook(d, name));
    }
    return [];
  }
  return got.notes
    .filter((n) => n.v <= verse && verse <= (n.e ?? n.v) && d.forms[n.form] && n.words?.length > 0)
    .sort((x, y) => (KIND_ORDER[d.forms[x.form].kind] ?? 3) - (KIND_ORDER[d.forms[y.form].kind] ?? 3));
}

/** The line under a verse: the first place's form, and how many more. */
export function lineAt(d: Data, verse: VerseRef): string | null {
  const ns = notesAt(d, verse);
  if (ns === null) return bits(d, verse) ? 'Seen in the words' : null;
  if (!ns.length) return null;
  const names = [...new Set(ns.map((n) => d.forms[n.form].label))];
  const more = names.length - 1;
  const line = `Seen in the words: ${names[0]}${more ? `, and ${more} more` : ''}`;
  return line.length <= 70 ? line : `Seen in the words: ${names.length} figures of speech`;
}
