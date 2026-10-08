// Quotations: the data, and the one quiet line under a verse.
//
// extras/quotes.json (small, loaded with the first selected verse) lists the
// links; extras/quotes/notes.json (loaded when a panel opens) holds the
// evidence for each one, in the same order. Both come from the Berean Standard
// Bible's own footnotes; crates/atlas-cli/src/extra_quotes.rs builds them.

import type { Atlas } from '../../../data/atlas';
import { loadJson } from '../data';
import { refName } from '../kit';
import type { NoteLine, VerseLink, VerseRef } from '../types';

/** extras/quotes.json */
export interface QuotesFile {
  format: 1;
  /** [first and last New Testament verse, first and last Old Testament verse,
   * kind]: kind 0 is a quotation, 1 an echo. */
  links: [number, number, number, number, number][];
}

/** extras/quotes/notes.json */
export interface NotesFile {
  format: 1;
  notes: LinkNote[];
}

/** The evidence for one link. */
export interface LinkNote {
  /** How close the BSB's English is: 0 word for word, 1 close, 2 loose. */
  c: number;
  /** Flags, see FLAG. */
  x: number;
  /** Why it is a quotation (1 to 5) or an echo (6 to 9), see WHY. */
  r: number;
  /** The New Testament footnote, as printed in the BSB. */
  n: string;
  /** [longest run of words in common, key words in common, key words in all]. */
  k: [number, number, number];
  /** The words that introduce the quotation. */
  f?: string;
  /** The Old Testament verse's own footnote, where it names this passage too. */
  m?: string;
  /** The quoted words: first verse, start, last verse, end (UTF-16 places). */
  s?: [number, number, number, number];
  /** Words the two passages share: [verse, start, end, start, end, ...]. */
  h?: number[][];
  /** A Greek word and the Hebrew word it stands for: [verse, word, verse, word]. */
  w?: [number, number, number, number][];
}

export const FLAG = { lxx: 1, dss: 2, both: 4, marks: 8, see: 16, joined: 32, part: 64 } as const;

/** Why a link is a quotation or an echo, in plain words (notes.json `r`). */
export const WHY: Record<number, string> = {
  1: 'A quotation: in quotation marks and introduced as one.',
  2: 'A quotation: in quotation marks, and the footnote points to the Septuagint, whose wording the English cannot be checked against.',
  3: 'A quotation: in quotation marks, with five or more words in a row the same.',
  4: 'A quotation: in quotation marks and word for word.',
  5: 'A quotation: in quotation marks, with most or all of its key words the same.',
  6: 'An echo: the footnote says “See”.',
  7: 'An echo: the words at the footnote are not in quotation marks.',
  8: 'An echo: not introduced as a quotation, and too few words are the same.',
  9: 'An echo: no word is the same as here.',
};

export interface Link {
  /** Its place in notes.json. */
  i: number;
  nt: VerseRef;
  ntTo: VerseRef;
  ot: VerseRef;
  otTo: VerseRef;
  echo: boolean;
}

export interface Data {
  links: Link[];
  /** How many links quotes.json lists, and so how many notes notes.json must have. */
  count: number;
  /** A New Testament verse: the links whose quoted words it holds. */
  byNt: Map<VerseRef, Link[]>;
  /** An Old Testament verse: the links that quote or echo it. */
  byOt: Map<VerseRef, Link[]>;
  /** The line for each verse at Simple (quotations only). */
  simple: Map<VerseRef, NoteLine>;
  /** The line at Study and Deep (echoes too). */
  study: Map<VerseRef, NoteLine>;
}

export function isNt(a: Atlas, v: VerseRef): boolean {
  return a.books[a.verseBook[v]].testament === 'NT';
}

/** A passage: its first and last verse. */
export interface Range {
  from: VerseRef;
  to: VerseRef;
}

/** The passage on the other side of a link: the Old Testament one, seen from
 * the New Testament (`ntSide`), or the New Testament one. */
export function otherSide(l: Link, ntSide: boolean): Range {
  return ntSide ? { from: l.ot, to: l.otTo } : { from: l.nt, to: l.ntTo };
}

/** The links at a verse that show at the reader's level: quotations first. */
export function linksAt(d: Data, a: Atlas, v: VerseRef, echoes: boolean): Link[] {
  const all = (isNt(a, v) ? d.byNt : d.byOt).get(v) ?? [];
  return [...all.filter((l) => !l.echo), ...(echoes ? all.filter((l) => l.echo) : [])];
}

function add(m: Map<VerseRef, Link[]>, from: VerseRef, to: VerseRef, l: Link): void {
  for (let v = from; v <= to; v++) {
    const list = m.get(v);
    if (list) list.push(l);
    else m.set(v, [l]);
  }
}

/** Distinct passages, in the order given. */
function distinct(rs: Range[], skip: Range[] = []): Range[] {
  const seen = new Set(skip.map((r) => `${r.from}-${r.to}`));
  const out: Range[] = [];
  for (const r of rs) {
    const k = `${r.from}-${r.to}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

/** Passages that follow on from each other in one book, as one: Exodus 20:13
 * and Exodus 20:14 read "Exodus 20:13–14". Keeps the order given. */
export function joined(a: Atlas, rs: Range[]): Range[] {
  const out: Range[] = [];
  for (const r of rs) {
    const last = out[out.length - 1];
    if (last && r.from >= last.from && r.from <= last.to + 1 && a.verseBook[r.from] === a.verseBook[last.from]) last.to = Math.max(last.to, r.to);
    else out.push({ ...r });
  }
  return out;
}

// ------------------------------------------------------------ the line

/** The longest a line may be, and the most verses it names (README). */
const MAX_CHARS = 70;
const MAX_NAMES = 3;

type Part = string | VerseLink;

function link(r: Range): VerseLink {
  return r.to > r.from ? { verse: r.from, to: r.to } : { verse: r.from };
}

/** "A", "A and B", "A, B and C", or with `named` fewer than all: "A, B and 2 more". */
function list(rs: Range[], named: number): Part[] {
  const shown = rs.slice(0, named);
  const out: Part[] = [];
  shown.forEach((r, i) => {
    if (i > 0) out.push(i === shown.length - 1 && shown.length === rs.length ? ' and ' : ', ');
    out.push(link(r));
  });
  if (rs.length > named) out.push(` and ${rs.length - named} more`);
  return out;
}

/** How many to name at most: all of three or fewer, two of more. */
function most(n: number): number {
  return n <= MAX_NAMES ? n : 2;
}

function plainLength(a: Atlas, parts: Part[]): number {
  return parts.reduce((n, p) => n + (typeof p === 'string' ? p.length : refName(a, p.verse, p.to).length), 0);
}

function echoCount(n: number): string {
  return n === 1 ? '1 echo' : `${n} echoes`;
}

/**
 * The line: "Quoting Isaiah 40:3", "Quoted in Matthew 3:3, Mark 1:3 and 2 more",
 * and at Study "Quoting Deuteronomy 25:4, echoing Leviticus 19:13 and 1 more",
 * "Echoing Psalm 110:1 and Daniel 7:13".
 * Tries the fullest wording first and takes the first that fits one short line.
 */
function line(a: Atlas, nt: boolean, q: Range[], e: Range[]): NoteLine | null {
  const [quoting, echoing, Echoing] = nt ? ['Quoting ', 'echoing ', 'Echoing '] : ['Quoted in ', 'echoed in ', 'Echoed in '];
  const tries: Part[][] = [];
  if (q.length) {
    for (let nq = most(q.length); nq >= 1; nq--) {
      const head: Part[] = [quoting, ...list(q, nq)];
      if (!e.length) {
        tries.push(head);
        continue;
      }
      for (let ne = Math.min(most(e.length), MAX_NAMES - nq); ne >= 1; ne--) tries.push([...head, ', ', echoing, ...list(e, ne)]);
      tries.push([...head, `, with ${echoCount(e.length)}`]);
    }
  } else if (e.length) {
    for (let ne = most(e.length); ne >= 1; ne--) tries.push([Echoing, ...list(e, ne)]);
  }
  if (!tries.length) return null;
  return tries.find((t) => plainLength(a, t) <= MAX_CHARS) ?? tries[tries.length - 1];
}

function lineAt(a: Atlas, v: VerseRef, links: Link[], echoes: boolean): NoteLine | null {
  const nt = isNt(a, v);
  const side = (l: Link) => otherSide(l, nt);
  const q = distinct(links.filter((l) => !l.echo).map(side));
  const e = echoes ? distinct(links.filter((l) => l.echo).map(side), q) : [];
  return line(a, nt, joined(a, q), joined(a, e));
}

// ------------------------------------------------------------ loading

export async function load(a: Atlas): Promise<Data> {
  const file = await loadJson<QuotesFile>(a, 'extras/quotes.json');
  const links: Link[] = [];
  const byNt = new Map<VerseRef, Link[]>();
  const byOt = new Map<VerseRef, Link[]>();
  if (file.format !== 1 || !Array.isArray(file.links)) throw new Error('extras/quotes.json: unknown format');
  file.links.forEach(([nt, ntTo, ot, otTo, kind], i) => {
    // Skip anything out of range rather than trust the file.
    const inRange = [nt, ntTo, ot, otTo].every((x) => Number.isInteger(x) && x >= 0 && x < a.n);
    if (!inRange || nt > ntTo || ot > otTo || !isNt(a, nt) || !isNt(a, ntTo) || isNt(a, ot) || isNt(a, otTo)) return;
    const l: Link = { i, nt, ntTo, ot, otTo, echo: kind !== 0 };
    links.push(l);
    add(byNt, nt, ntTo, l);
    add(byOt, ot, otTo, l);
  });
  const simple = new Map<VerseRef, NoteLine>();
  const study = new Map<VerseRef, NoteLine>();
  for (const m of [byNt, byOt]) {
    for (const [v, ls] of m) {
      const s = lineAt(a, v, ls, false);
      const t = lineAt(a, v, ls, true);
      if (s) simple.set(v, s);
      if (t) study.set(v, t);
    }
  }
  return { links, count: file.links.length, byNt, byOt, simple, study };
}
