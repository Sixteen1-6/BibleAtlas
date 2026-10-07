// Per-book text shards, loaded on first use and kept in memory.

import { type Atlas, DATA_BASE, locate } from './atlas';

/** [surface, transliteration, contextual English, root index (-1 if none), grammar code, flags, note?] */
export type WordRow = [string, string, string, number, string, number, WordNote?];
export interface WordNote {
  /** Source word-type code, e.g. "N(k)O" or "Q(K)". */
  k: string;
  /** Greek editions containing the word. */
  e?: string;
  /** Manuscript / reading notes. */
  v?: string;
}
/** [BSB English, original-language words] */
export type VerseRow = [string, WordRow[]];
export interface BookText {
  book: string;
  chapters: VerseRow[][];
}

export const FLAG = { aramaic: 1, otherEditions: 2, variant: 4, significant: 8 } as const;

const cache = new Map<number, Promise<BookText>>();

export function loadBook(a: Atlas, book: number): Promise<BookText> {
  let p = cache.get(book);
  if (!p) {
    const osis = a.books[book].osis;
    p = fetch(`${DATA_BASE}text/${osis}.json?${a.version}`).then((r) => {
      if (!r.ok) throw new Error(`text/${osis}.json: HTTP ${r.status}`);
      return r.json() as Promise<BookText>;
    });
    p.catch(() => cache.delete(book));
    cache.set(book, p);
  }
  return p;
}

export function isBookLoaded(book: number): boolean {
  return cache.has(book);
}

export async function getVerse(a: Atlas, v: number): Promise<VerseRow> {
  const l = locate(a, v);
  const t = await loadBook(a, l.book);
  return t.chapters[l.chapter - 1][l.verse - 1];
}

export async function getVerses(a: Atlas, vs: ArrayLike<number>): Promise<VerseRow[]> {
  return Promise.all(Array.from(vs, (v) => getVerse(a, v)));
}

/** Root indices used in a verse's base text (not words found only in other editions). */
export function rootsOf(row: VerseRow): Set<number> {
  const s = new Set<number>();
  for (const w of row[1]) if (w[3] >= 0 && !(w[5] & FLAG.otherEditions)) s.add(w[3]);
  return s;
}
