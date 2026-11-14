// The data behind "Patterns": details that fit (one passage explained by
// another written apart from it), key words carried through a passage, and
// repeated scenes. The index (extras/patterns.json) is small and says where
// each one is; a book's file, with the words and the writers, loads the first
// time one of its patterns is shown. Built and checked by
// crates/atlas-cli/src/extra_patterns.rs.

import { type Signal, signal } from '@preact/signals';
import type { Atlas } from '../../../data/atlas';
import * as S from '../../../state';
import type { Cite, Strength } from '../figures/model';
import { loadJson } from '../data';
import type { VerseRef } from '../types';

export const SOURCE = 'From the Christian writers named in each note. Bible text: the BSB. Hebrew and Greek: STEPBible (CC BY 4.0).';

export type Kind = 'coincidence' | 'keyword' | 'scene';

export interface KindInfo {
  label: string;
  about: string;
}

/** BSB words in a verse: the verse, their UTF-16 offset there, the words. */
export interface Words {
  v: VerseRef;
  at: number;
  t: string;
}

export interface Side {
  label: string;
  s: VerseRef;
  e: VerseRef;
  w: Words[];
}

export interface Key {
  s: VerseRef;
  e: VerseRef;
  /** "In Hebrew", "In John's Greek". */
  lang: string;
  strong: string[];
  /** How often the root comes in the passage, counted by the build. */
  n: number;
  /** The verses it comes in. */
  verses: VerseRef[];
  forms: string[];
  /** Every BSB form found in those verses. */
  marks: Words[];
  /** Each place the root comes: [verse, word position, root index]. */
  words: [VerseRef, number, number][];
}

export interface Part {
  id: string;
  label: string;
}

export interface Telling {
  who: string;
  s: VerseRef;
  e: VerseRef;
  /** The words of each part shown, by part id. */
  w: Record<string, Words>;
}

export interface Note {
  id: string;
  kind: Kind;
  v: VerseRef;
  end: VerseRef;
  r: [VerseRef, VerseRef][];
  strength: Strength;
  writers?: number;
  short: string;
  about: string;
  sides?: Side[];
  key?: Key;
  parts?: Part[];
  scenes?: Telling[];
  evidence?: string;
  limit?: string;
  checked?: string;
  cites: Cite[];
}

interface Row {
  id: string;
  kind: Kind;
  short: string;
  r: [VerseRef, VerseRef][];
  b: string[];
}

type Book = Map<string, Note> | 'loading' | 'failed';

export interface Data {
  a: Atlas;
  kinds: Record<Kind, KindInfo>;
  rows: Row[];
  /** The rows over each verse, by verse. */
  at: Map<VerseRef, number[]>;
  books: Signal<ReadonlyMap<string, Book>>;
}

export async function load(a: Atlas): Promise<Data> {
  const f = await loadJson<{ format: number; kinds: Record<Kind, KindInfo>; rows: Row[] }>(a, 'extras/patterns.json');
  const at = new Map<VerseRef, number[]>();
  f.rows.forEach((row, i) => {
    for (const [s, e] of row.r)
      for (let v = s; v <= e; v++) {
        const l = at.get(v);
        if (!l) at.set(v, [i]);
        else if (!l.includes(i)) l.push(i);
      }
  });
  const d: Data = { a, kinds: f.kinds, rows: f.rows, at, books: signal(new Map()) };
  const v = S.selected.peek();
  if (v !== null) await Promise.all(booksAt(d, v).map((b) => fetchBook(d, b)));
  return d;
}

/** The book file a row is read from: the first book it touches. */
function bookOf(row: Row): string {
  return row.b[0];
}

function booksAt(d: Data, v: VerseRef): string[] {
  const out: string[] = [];
  for (const i of d.at.get(v) ?? []) {
    const b = bookOf(d.rows[i]);
    if (!out.includes(b)) out.push(b);
  }
  return out;
}

const failedAt = new Map<string, number>();

function fetchBook(d: Data, osis: string): Promise<void> {
  const put = (b: Book) => {
    const next = new Map(d.books.peek());
    next.set(osis, b);
    d.books.value = next;
  };
  put('loading');
  return loadJson<{ format: number; notes: Note[] }>(d.a, `extras/patterns/${osis}.json`).then(
    (f) => put(new Map((f?.notes ?? []).map((n) => [n.id, n]))),
    () => {
      failedAt.set(osis, Date.now());
      put('failed');
    },
  );
}

/** Kinds in the order a panel shows them: details first, then key words, then scenes. */
const ORDER: Record<Kind, number> = { coincidence: 0, keyword: 1, scene: 2 };

function rowsAt(d: Data, verse: VerseRef): Row[] {
  return (d.at.get(verse) ?? []).map((i) => d.rows[i]).sort((p, q) => ORDER[p.kind] - ORDER[q.kind]);
}

/** The patterns over a verse, or null while their book loads. Reading it
 * subscribes the caller; the first read starts the download. */
export function notesAt(d: Data, verse: VerseRef): Note[] | null {
  const rows = rowsAt(d, verse);
  if (!rows.length) return [];
  const books = d.books.value;
  const out: Note[] = [];
  let waiting = false;
  for (const row of rows) {
    const osis = bookOf(row);
    const b = books.get(osis);
    if (b === undefined || (b === 'failed' && Date.now() - (failedAt.get(osis) ?? 0) > 30_000)) {
      void fetchBook(d, osis);
      waiting = true;
    } else if (b === 'loading') waiting = true;
    else if (b !== 'failed') {
      const n = b.get(row.id);
      if (n) out.push(n);
    }
  }
  return waiting ? null : out;
}

/** The line under a verse: the first pattern's own line, and how many more. */
export function lineAt(d: Data, verse: VerseRef): string | null {
  const rows = rowsAt(d, verse);
  if (!rows.length) return null;
  const more = rows.length - 1;
  return more ? `${rows[0].short}, and ${more} more` : rows[0].short;
}
