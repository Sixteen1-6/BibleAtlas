// The data behind the "Life in Bible times" extra, as
// crates/atlas-cli/src/extra_customs.rs writes it: James M. Freeman's
// Hand-Book of Bible Manners and Customs (1874), each entry under the verses
// Freeman heads it with. The small index loads with the line; a book's
// entries load when a panel opens.

import type { Atlas } from '../../../data/atlas';
import { loadJson } from '../data';
import type { VerseRef } from '../types';

/** The panel's source line. */
export const SOURCE =
  'James M. Freeman, Hand-Book of Bible Manners and Customs (New York: Nelson and Phillips, 1874), public domain. Text transcribed by Bible Truth Publishers, as kept in the UniqueBible.app module on GitHub (darrelwright/UniqueBible_Books).';

/** Words, or [from, to, words] naming verses. */
export type Run = string | [VerseRef, VerseRef, string];

/** An entry in extras/customs/<Book>.json. */
export interface Entry {
  no: number;
  title: string;
  at: [VerseRef, VerseRef][];
  /** The King James words Freeman prints under his heading. */
  quote: string;
  /** Paragraphs of runs. */
  text: Run[][];
}

export interface BookFile {
  format: number;
  entries: Entry[];
}

/** extras/customs.json: [no, title, at]. */
interface IndexFile {
  format: number;
  entries: [number, string, [VerseRef, VerseRef][]][];
}

export interface Data {
  a: Atlas;
  /** Each verse's entries, as [no, title], in Freeman's order. */
  at: Map<VerseRef, [number, string][]>;
}

export async function load(a: Atlas): Promise<Data> {
  const file = await loadJson<IndexFile>(a, 'extras/customs.json');
  if (file.format !== 1 || !Array.isArray(file.entries)) throw new Error('extras/customs.json: unknown format');
  const at = new Map<VerseRef, [number, string][]>();
  for (const [no, title, ranges] of file.entries) {
    for (const [from, to] of ranges) {
      for (let v = from; v <= to && v < a.n; v++) {
        const list = at.get(v);
        if (list) list.push([no, title]);
        else at.set(v, [[no, title]]);
      }
    }
  }
  return { a, at };
}

/** The files holding a verse's entries: each entry is in the book of its first heading verse. */
export function filesFor(d: Data, verse: VerseRef): string[] {
  return d.at.has(verse) ? [`extras/customs/${d.a.books[d.a.verseBook[verse]].osis}.json`] : [];
}
