// The data behind the dictionary line, as crates/atlas-cli/src/extra_dictionary.rs
// writes it: which verses the old Bible dictionaries cite (extras/dictionary.json,
// small, loaded with the line), and each book's entries by verse
// (extras/dictionary/<book>.json, loaded the first time a verse in that book is
// shown). The line is one lookup once its book is in.

import { type Signal, signal } from '@preact/signals';
import type { Atlas } from '../../../data/atlas';
import * as S from '../../../state';
import { loadJson } from '../data';
import type { VerseRef } from '../types';

/** An entry that cites a verse: [dictionary id, slug, entry name]. */
export type Listing = [string, string, string];

/** extras/dictionary.json */
interface IndexFile {
  format: number;
  /** Each dictionary's title and date, as its card on the Sources shelf gives them. */
  dictionaries: { id: string; title: string; when: string }[];
  /** The verses that have entries, sorted. */
  verses: number[];
}

/** extras/dictionary/<book>.json: the entries citing each verse, the likeliest first. */
type BookFile = Record<string, Listing[] | undefined>;

export interface Data {
  /** Book of each verse (a.verseBook). */
  verseBook: Uint8Array;
  /** 1 where a verse has entries. */
  has: Uint8Array;
  titles: Map<string, { title: string; when: string }>;
  /** The books loaded so far: by book, the entries citing each verse. */
  books: Signal<ReadonlyMap<number, ReadonlyMap<VerseRef, Listing[]>>>;
  /** Fetch a book's file, once. */
  want: (book: number) => Promise<void>;
}

export async function load(a: Atlas): Promise<Data> {
  const file = await loadJson<IndexFile>(a, 'extras/dictionary.json');
  if (file.format !== 1 || !Array.isArray(file.verses) || !Array.isArray(file.dictionaries)) throw new Error('extras/dictionary.json: unknown format');
  const has = new Uint8Array(a.n);
  for (const v of file.verses) if (Number.isInteger(v) && v >= 0 && v < a.n) has[v] = 1;
  const titles = new Map(file.dictionaries.map((d) => [d.id, { title: d.title, when: d.when }]));
  const books = signal<ReadonlyMap<number, ReadonlyMap<VerseRef, Listing[]>>>(new Map());
  const asked = new Map<number, Promise<void>>();
  const want = (book: number): Promise<void> => {
    let p = asked.get(book);
    if (!p) {
      p = loadJson<BookFile>(a, `extras/dictionary/${book}.json`).then((f) => {
        const m = new Map<VerseRef, Listing[]>();
        for (const [k, list] of Object.entries(f)) {
          const v = Number(k);
          if (has[v] && Array.isArray(list)) m.set(v, list.filter((x) => Array.isArray(x) && x.length === 3 && titles.has(x[0])));
        }
        const next = new Map(books.peek());
        next.set(book, m);
        books.value = next;
      });
      asked.set(book, p);
      // Tried again the next time a verse in the book is shown.
      p.catch(() => asked.delete(book));
    }
    return p;
  };
  // A link to a verse (or to this panel) finds its entries ready.
  const sel = S.selected.peek();
  if (sel !== null && sel < a.n && has[sel]) await want(a.verseBook[sel]).catch(() => {});
  return { verseBook: a.verseBook, has, titles, books, want };
}

/** The entries citing a verse: [] if none, undefined while its book loads
 * (asking for it). Reading it subscribes the caller to the books as they arrive. */
export function listingsAt(d: Data, verse: VerseRef): Listing[] | undefined {
  if (!d.has[verse]) return [];
  const book = d.verseBook[verse];
  const m = d.books.value.get(book);
  if (!m) {
    void d.want(book).catch(() => {});
    return undefined;
  }
  return m.get(verse) ?? [];
}

/** The entry names to show, each once ("Quails" is in both dictionaries). */
export function names(list: readonly Listing[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const [, , name] of list) {
    const k = name.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(name);
    }
  }
  return out;
}

/** "1897" from "1897", "1884" from "1884 (first published 1860–1863)". */
export function year(when: string): string {
  return /\d{4}/.exec(when)?.[0] ?? when;
}
