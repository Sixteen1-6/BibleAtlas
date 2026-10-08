// The data behind Parallel passages, as crates/atlas-cli/src/extra_parallels.rs
// writes it, and the lookups the line and the panel make over it.

import { type Atlas, chapterName, locate } from '../../../data/atlas';
import { loadJson } from '../data';
import { refName } from '../kit';
import type { NoteLine, VerseLink, VerseRef } from '../types';

export type Kind = 'account' | 'event' | 'song' | 'list' | 'law' | 'prophecy' | 'letter';
const KINDS: readonly Kind[] = ['account', 'event', 'song', 'list', 'law', 'prophecy', 'letter'];

/** web/public/data/extras/parallels.json: each set as [kind, from, to, from, to, ...]. */
interface IndexFile {
  format: number;
  kinds: string[];
  sets: number[][];
}

/** web/public/data/extras/parallels/<Book>.json: every set with a passage in that book. */
export interface BookFile {
  format: number;
  sets: Record<string, SetDetail | undefined>;
}

export interface SetDetail {
  /** The BSB section heading over each passage's first verse. */
  titles: string[];
  /** Whether the BSB headings name each passage with another of its set. */
  listed: boolean[];
  /** [i, j, roots in common %, English words in common %, rows as verse counts [i, j, i, j, ...]] */
  pairs: [number, number, number, number, number[]][];
  /** Passages some link with this set that are left out of it: [from, to, why]. */
  apart: [number, number, string][];
}

export interface Span {
  from: VerseRef;
  to: VerseRef;
}

export interface PSet {
  id: number;
  kind: Kind;
  /** In the order of the Bible. */
  passages: Span[];
}

export interface Data {
  a: Atlas;
  /** By set id: the set's place in parallels.json, which the book files use too. */
  sets: Map<number, PSet>;
  /** The sets each verse is in (almost always one). */
  at: Map<VerseRef, number[]>;
  /** The line under each verse that has parallels. */
  lines: Map<VerseRef, NoteLine>;
}

const SAYS: Record<Kind, string> = {
  account: 'Also told in ',
  event: 'Also told in ',
  song: 'Also sung in ',
  list: 'Also listed in ',
  law: 'Also given in ',
  prophecy: 'Much the same prophecy in ',
  letter: 'Much the same in ',
};

/** The longest line, in letters, before it names fewer passages. */
const LONG = 70;

/** "Also told in Mark 2:1–12 and Luke 5:17–26": the other passages of the
 * sets a verse is in, at most three named. */
function lineFor(a: Atlas, sets: PSet[], verse: VerseRef): NoteLine | null {
  const others: Span[] = [];
  for (const s of sets) {
    const home = passageAt(s, verse);
    for (const [i, p] of s.passages.entries()) {
      if (i !== home && !others.some((q) => q.from === p.from && q.to === p.to)) others.push(p);
    }
  }
  if (!sets.length || !others.length) return null;
  others.sort((p, q) => p.from - q.from);
  const says = SAYS[sets[0].kind];
  const length = (named: number) => says.length + others.slice(0, named).reduce((n, p) => n + nameOf(a, p).length + 2, 0) + (named < others.length ? 12 : 0);
  let named = others.length > 3 ? 2 : others.length;
  while (named > 1 && length(named) > LONG) named--;
  const out: (string | VerseLink)[] = [says];
  others.slice(0, named).forEach((p, i) => {
    if (i > 0) out.push(i === named - 1 && named === others.length ? ' and ' : ', ');
    out.push({ verse: p.from, to: p.to });
  });
  if (named < others.length) out.push(` and ${others.length - named} more`);
  return out;
}

export async function load(a: Atlas): Promise<Data> {
  const file = await loadJson<IndexFile>(a, 'extras/parallels.json');
  if (file.format !== 1) throw new Error('extras/parallels.json: unknown format');
  const sets = new Map<number, PSet>();
  const at = new Map<VerseRef, number[]>();
  for (const [id, row] of file.sets.entries()) {
    const kind = KINDS.find((k) => k === file.kinds[row[0]]);
    const passages: Span[] = [];
    for (let i = 1; i + 1 < row.length; i += 2) {
      const [from, to] = [row[i], row[i + 1]];
      if (Number.isInteger(from) && Number.isInteger(to) && from >= 0 && from <= to && to < a.n) passages.push({ from, to });
    }
    if (!kind || passages.length < 2 || passages.length * 2 + 1 !== row.length) continue;
    sets.set(id, { id, kind, passages });
    for (const p of passages) {
      for (let v = p.from; v <= p.to; v++) {
        const ids = at.get(v);
        if (!ids) at.set(v, [id]);
        else if (!ids.includes(id)) ids.push(id);
      }
    }
  }
  const lines = new Map<VerseRef, NoteLine>();
  const made = new Map<string, NoteLine | null>();
  for (const [v, ids] of at) {
    const list = ids.flatMap((id) => sets.get(id) ?? []);
    const key = list.map((s) => `${s.id}.${passageAt(s, v)}`).join(' ');
    let line = made.get(key);
    if (line === undefined) {
      line = lineFor(a, list, v);
      made.set(key, line);
    }
    if (line) lines.set(v, line);
  }
  return { a, sets, at, lines };
}

/** The passage of a set that holds a verse, or -1. */
export function passageAt(s: PSet, verse: VerseRef): number {
  return s.passages.findIndex((p) => p.from <= verse && verse <= p.to);
}

/** A row that lines two passages up: the verses of each side. One side is
 * empty where a verse has no partner in the other passage. */
export interface Row {
  a: VerseRef[];
  b: VerseRef[];
}

/** The rows that line passage i of a set up with passage j, with i's verses
 * on side a, or null if the detail does not have them. */
export function rowsOf(s: PSet, d: SetDetail | null | undefined, i: number, j: number): Row[] | null {
  const pair = d?.pairs.find((p) => (p[0] === i && p[1] === j) || (p[0] === j && p[1] === i));
  if (!pair) return null;
  const flip = pair[0] !== i;
  const [pa, pb] = [s.passages[i], s.passages[j]];
  let [va, vb] = [pa.from, pb.from];
  const rows: Row[] = [];
  const counts = pair[4];
  for (let k = 0; k + 1 < counts.length; k += 2) {
    const [na, nb] = flip ? [counts[k + 1], counts[k]] : [counts[k], counts[k + 1]];
    const row: Row = { a: [], b: [] };
    for (let n = 0; n < na; n++) row.a.push(va++);
    for (let n = 0; n < nb; n++) row.b.push(vb++);
    rows.push(row);
  }
  // Rows that do not use up both passages exactly are not to be trusted.
  return va === pa.to + 1 && vb === pb.to + 1 ? rows : null;
}

/** [roots in common %, English words in common %] for passages i and j. */
export function sharesOf(d: SetDetail | null | undefined, i: number, j: number): [number, number] | null {
  const pair = d?.pairs.find((p) => (p[0] === i && p[1] === j) || (p[0] === j && p[1] === i));
  return pair ? [pair[2], pair[3]] : null;
}

/** "A", "A and B", "A, B and C". */
export function and(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function nameOf(a: Atlas, p: Span): string {
  return refName(a, p.from, p.to);
}

export function bookOf(a: Atlas, p: Span): number {
  return a.verseBook[p.from];
}

/** The books of a set, each once, in order: ["Matthew", "Mark", "Luke"]. */
export function bookNames(a: Atlas, s: PSet): string[] {
  const out: string[] = [];
  for (const p of s.passages) {
    const name = a.books[bookOf(a, p)].name;
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/** The shortest name that tells a set's passages apart: the book ("Mark"),
 * else the chapter ("Psalm 14"), else the passage ("Psalm 106:1"). */
export function shortNames(a: Atlas, s: PSet): string[] {
  const books = s.passages.map((p) => bookOf(a, p));
  const chapters = s.passages.map((p) => {
    const l = locate(a, p.from);
    const e = locate(a, p.to);
    const b = chapterName(a.books[l.book]);
    return l.chapter === e.chapter ? `${b} ${l.chapter}` : `${b} ${l.chapter}–${e.chapter}`;
  });
  return s.passages.map((p, i) => {
    if (books.filter((b) => b === books[i]).length === 1) return a.books[books[i]].name;
    if (chapters.filter((c) => c === chapters[i]).length === 1) return chapters[i];
    return nameOf(a, p);
  });
}
