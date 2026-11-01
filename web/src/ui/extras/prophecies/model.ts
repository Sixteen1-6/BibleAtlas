// Prophecy and fulfilment: the data, and the one quiet line under a verse.
//
// extras/prophecies.json (small, loaded with the first selected verse) lists
// the pairs; extras/prophecies/notes.json (loaded when a panel opens) holds,
// for each pair in the same order, the New Testament's own words and the
// writers who state it. crates/atlas-cli/src/extra_prophecies.rs builds and
// checks both from config/prophecies.json.
//
// A pair the New Testament itself calls fulfilled is Scripture's own claim and
// shows at every level. A pair only Christian writers name is commentary: it
// shows only at Deep, once the reader has finished the commentary notice.

import type { Atlas } from '../../../data/atlas';
import { atLeast } from '../../../depth';
import { accepted } from '../../commentary/state';
import { loadJson } from '../data';
import { refName } from '../kit';
import type { NoteLine, VerseLink, VerseRef } from '../types';

/** extras/prophecies.json: [otFrom, otTo, ntFrom, ntTo, says, writers]. */
export interface IndexFile {
  format: 1;
  pairs: [number, number, number, number, number, number][];
}

/** One writer who states a pair, credited as decision 10 asks. */
export interface Cite {
  by: string;
  writer: string;
  work: string;
  when: string;
  key: string;
  on: [number, number];
  quote: string;
  url: string;
  read: string;
  retrieved: string;
  edition?: string;
  label?: string;
}

/** extras/prophecies/notes.json */
export interface NotesFile {
  format: 1;
  notes: { says?: [number, string]; cites: Cite[] }[];
}

export interface Pair {
  /** Its place in notes.json. */
  i: number;
  ot: VerseRef;
  otTo: VerseRef;
  nt: VerseRef;
  ntTo: VerseRef;
  /** The New Testament says so in its own words. */
  says: boolean;
  /** How many different writers state it. */
  writers: number;
}

export interface Data {
  pairs: Pair[];
  /** Every verse of either side: the pairs it is part of. */
  at: Map<VerseRef, Pair[]>;
}

export const SOURCE =
  'From the Berean Standard Bible, and at Deep the words of Matthew Henry, John Calvin, John Wesley, the Geneva Bible notes and the Church Fathers in the Catena Aurea (all public domain).';

export async function load(a: Atlas): Promise<Data> {
  const f = await loadJson<IndexFile>(a, 'extras/prophecies.json');
  const pairs = f.pairs.map(([ot, otTo, nt, ntTo, says, writers], i) => ({ i, ot, otTo, nt, ntTo, says: says === 1, writers }));
  const at = new Map<VerseRef, Pair[]>();
  for (const p of pairs) {
    for (const [from, to] of [
      [p.ot, p.otTo],
      [p.nt, p.ntTo],
    ]) {
      for (let v = from; v <= to; v++) {
        const list = at.get(v);
        if (list) list.push(p);
        else at.set(v, [p]);
      }
    }
  }
  return { pairs, at };
}

/** Whether writers' pairs show: at Deep, after the commentary notice.
 * Reading it subscribes the caller to both. */
export function writersShown(): boolean {
  return atLeast('deep') && accepted.value;
}

export function isOt(a: Atlas, v: VerseRef): boolean {
  return a.books[a.verseBook[v]].testament !== 'NT';
}

/** The pairs a verse is part of that show now: the New Testament's own first,
 * then by how many writers state them. */
export function pairsAt(d: Data, v: VerseRef): Pair[] {
  const all = d.at.get(v) ?? [];
  const shown = writersShown() ? all : all.filter((p) => p.says);
  return [...shown].sort((p, q) => Number(q.says) - Number(p.says) || q.writers - p.writers || p.i - q.i);
}

/** The other side of a pair, seen from verse `v`. */
export function otherSide(a: Atlas, p: Pair, v: VerseRef): { from: VerseRef; to: VerseRef } {
  return isOt(a, v) ? { from: p.nt, to: p.ntTo } : { from: p.ot, to: p.otTo };
}

const MAX_CHARS = 70;

function link(r: { from: VerseRef; to: VerseRef }): VerseLink {
  return r.to > r.from ? { verse: r.from, to: r.to } : { verse: r.from };
}

/** "Fulfilled in Matthew 1:23", "Fulfilling Isaiah 7:14 and 2 more". */
export function lineAt(a: Atlas, d: Data, v: VerseRef): NoteLine | null {
  const ps = pairsAt(d, v);
  if (!ps.length) return null;
  const seen = new Set<string>();
  const others = ps
    .map((p) => otherSide(a, p, v))
    .filter((r) => {
      const k = `${r.from}-${r.to}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  const head = isOt(a, v) ? 'Fulfilled in ' : 'Fulfilling ';
  for (let n = Math.min(others.length, 3); n >= 1; n--) {
    const parts: (string | VerseLink)[] = [head];
    others.slice(0, n).forEach((r, i) => {
      if (i > 0) parts.push(i === n - 1 && n === others.length ? ' and ' : ', ');
      parts.push(link(r));
    });
    if (others.length > n) parts.push(` and ${others.length - n} more`);
    const len = parts.reduce((s, p) => s + (typeof p === 'string' ? p.length : refName(a, p.verse, p.to).length), 0);
    if (len <= MAX_CHARS || n === 1) return parts;
  }
  return null;
}

/** "widely agreed", "commonly held", "some interpreters" (CLAUDE.md). */
export function strength(writers: number): string {
  return writers >= 3 ? 'widely agreed' : writers === 2 ? 'commonly held' : 'some interpreters';
}
