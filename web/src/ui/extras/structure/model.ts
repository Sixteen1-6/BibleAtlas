// The data behind "How it is built": structures across verses and chapters
// (bookends, refrains, turns, mirrors) and foils, two people set side by side.
// The index (extras/structure.json) is small and says where each one is; a
// book's file, with the words and the writers, loads the first time one of
// its structures is shown. Built and checked by
// crates/atlas-cli/src/extra_structure.rs.

import { type Signal, signal } from '@preact/signals';
import type { Atlas } from '../../../data/atlas';
import * as S from '../../../state';
import type { Cite, Strength } from '../figures/model';
import { loadJson } from '../data';
import type { VerseRef } from '../types';

export const SOURCE = 'From the Christian writers named in each note. Bible text: the BSB.';

export type Kind = 'inclusio' | 'refrain' | 'alternation' | 'chiasm' | 'foil';

export interface KindInfo {
  label: string;
  about: string;
}

export interface Member {
  mark: string;
  /** The member's verses. */
  s: VerseRef;
  e: VerseRef;
  /** The verse its words are in, their UTF-16 offset there, and the words. */
  v: VerseRef;
  at: number;
  t: string;
  /** On the first member of a group: the words every member of it shares. */
  tie?: string;
}

export interface Side {
  who: string;
  label: string;
  r: [VerseRef, VerseRef][];
  w: { v: VerseRef; at: number; t: string }[];
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
  members?: Member[];
  sides?: Side[];
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
  const f = await loadJson<{ format: number; kinds: Record<Kind, KindInfo>; rows: Row[] }>(a, 'extras/structure.json');
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
  // The selected verse's book comes with the index, so a link to its panel
  // finds its structures there.
  const v = S.selected.peek();
  if (v !== null) await Promise.all(booksAt(d, v).map((b) => fetchBook(d, b)));
  return d;
}

function booksAt(d: Data, v: VerseRef): string[] {
  const out: string[] = [];
  for (const i of d.at.get(v) ?? []) {
    const b = d.rows[i].b[0];
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
  return loadJson<{ format: number; notes: Note[] }>(d.a, `extras/structure/${osis}.json`).then(
    (f) => put(new Map((f?.notes ?? []).map((n) => [n.id, n]))),
    () => {
      failedAt.set(osis, Date.now());
      put('failed');
    },
  );
}

/** The rows over a verse: mirrors and bookends first, then the rest. */
function rowsAt(d: Data, verse: VerseRef): Row[] {
  return (d.at.get(verse) ?? []).map((i) => d.rows[i]);
}

/** The structures over a verse, or null while their book loads. Reading it
 * subscribes the caller; the first read starts the download. */
export function notesAt(d: Data, verse: VerseRef): Note[] | null {
  const rows = rowsAt(d, verse);
  if (!rows.length) return [];
  const books = d.books.value;
  const out: Note[] = [];
  let waiting = false;
  for (const row of rows) {
    const osis = row.b[0];
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

/** The line under a verse: the first structure's own line, and how many more. */
export function lineAt(d: Data, verse: VerseRef): string | null {
  const rows = rowsAt(d, verse);
  if (!rows.length) return null;
  const more = rows.length - 1;
  return more ? `${rows[0].short}, and ${more} more` : rows[0].short;
}

/** Every structure in the index, for the map: its kind and ranges. */
export function rowsOver(d: Data, verse: VerseRef): readonly Row[] {
  return rowsAt(d, verse);
}
