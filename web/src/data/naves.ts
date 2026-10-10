// Nave's Topical Bible rows, per book, loaded on first use and kept in memory.
//
// crates/atlas-cli/src/naves.rs writes naves/<Book>.json: for each verse, the
// Nave's subjects whose short references (3 verses or fewer) cite it, most
// specific first, or else up to two passages of 4 to 60 verses it is part of.
// Only subjects about a concept: never people, places or other names, and
// never those config/naves-display.json hides. The Themes tab shows them at
// Study for a verse no theme reaches. Nave's never becomes a theme.

import { type Atlas, DATA_BASE, locate } from './atlas';

/** [Ask topic number (in ask/index.json), title, verse count]. */
export type NavesTopic = [number, string, number];
/** 0: nothing. Numbers: the subjects citing the verse (places in `topics`).
 * Triples: [subject, first verse, last verse] of the passages it is part of. */
type NavesEntry = 0 | number[] | [number, number, number][];
interface NavesBook {
  book: string;
  topics: NavesTopic[];
  chapters: NavesEntry[][];
}

export interface NavesPassage {
  topic: NavesTopic;
  from: number;
  to: number;
}

export type NavesRow = { kind: 'direct'; topics: NavesTopic[] } | { kind: 'passage'; passages: NavesPassage[] } | null;

const cache = new Map<number, Promise<NavesBook>>();

function loadBook(a: Atlas, book: number): Promise<NavesBook> {
  let p = cache.get(book);
  if (!p) {
    const osis = a.books[book].osis;
    p = fetch(`${DATA_BASE}naves/${osis}.json?${a.version}`).then((r) => {
      if (!r.ok) throw new Error(`naves/${osis}.json: HTTP ${r.status}`);
      return r.json() as Promise<NavesBook>;
    });
    p.catch(() => cache.delete(book));
    cache.set(book, p);
  }
  return p;
}

/** What Nave's lists the verse under, or null when it lists none we show. */
export async function navesRow(a: Atlas, v: number): Promise<NavesRow> {
  const l = locate(a, v);
  const b = await loadBook(a, l.book);
  const e = b.chapters[l.chapter - 1]?.[l.verse - 1];
  if (!e || e.length === 0) return null;
  if (typeof e[0] === 'number') return { kind: 'direct', topics: (e as number[]).map((t) => b.topics[t]) };
  return { kind: 'passage', passages: (e as [number, number, number][]).map(([t, from, to]) => ({ topic: b.topics[t], from, to })) };
}
