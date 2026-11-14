// The data behind the "People" extra, as crates/atlas-cli/src/extra_people.rs
// writes it from Theographic Bible Metadata (CC BY-SA 4.0): each person, the
// verses whose BSB words name them, and their family among the people listed.

import type { Atlas } from '../../../data/atlas';
import { loadJson } from '../data';
import type { VerseRef } from '../types';

export const SOURCE =
  'People and their families from Theographic Bible Metadata by Robert Rouse (viz.bible), CC BY-SA 4.0, kept only in the verses whose Berean Standard Bible words use one of their names. God, the Holy Spirit and Satan are not listed.';

/** extras/people.json: [name, verse gaps, [father, mother, partners, children, siblings]]. */
interface File {
  format: number;
  people: [string, number[], number[][]][];
}

export interface Person {
  name: string;
  verses: VerseRef[];
  father: number[];
  mother: number[];
  partners: number[];
  children: number[];
  siblings: number[];
}

export interface Data {
  people: Person[];
  /** The people each verse names, in the file's order. */
  at: Map<VerseRef, number[]>;
}

export async function load(a: Atlas): Promise<Data> {
  const f = await loadJson<File>(a, 'extras/people.json');
  const at = new Map<VerseRef, number[]>();
  const people = f.people.map(([name, gaps, fam], i) => {
    let v = 0;
    const verses = gaps.map((g) => (v += g));
    for (const w of verses) {
      const l = at.get(w);
      if (l) l.push(i);
      else at.set(w, [i]);
    }
    const [father = [], mother = [], partners = [], children = [], siblings = []] = fam;
    return { name, verses, father, mother, partners, children, siblings };
  });
  // In a verse, the person named most often in the Bible comes first.
  for (const l of at.values()) l.sort((x, y) => people[y].verses.length - people[x].verses.length);
  return { people, at };
}
