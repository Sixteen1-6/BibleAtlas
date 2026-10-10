// The pointers to hard passages, as crates/atlas-cli/src/extra_hard_verses.rs
// writes them into extras/hard-verses.json: each one's verses and the pages on
// other websites that answer it, with none of the draft answer's words.

import type { Atlas } from '../../../data/atlas';
import { loadJson } from '../data';
import type { NoteLine, VerseRef } from '../types';

/** First and last verse, inclusive. */
export type Span = [VerseRef, VerseRef];

export interface Link {
  site: string;
  /** The page's own title on its site. */
  title: string;
  url: string;
}

export interface Pointer {
  v: VerseRef;
  end: VerseRef;
  also: Span[];
  links: Link[];
}

/** The parts of extras/hard-verses.json read here. */
interface IndexFile {
  format: number;
  pointers?: Pointer[];
  /** [verse, pointer index] */
  pointer_lines?: [VerseRef, number][];
}

export interface Data {
  pointers: Pointer[];
  /** The pointers under each verse, by index. */
  at: Map<VerseRef, number[]>;
  lines: Map<VerseRef, NoteLine>;
}

/** "GotQuestions", "GotQuestions and Bible.org", "GotQuestions and 2 more". */
function sitesOf(pointers: Pointer[]): string {
  const sites = [...new Set(pointers.flatMap((p) => p.links.map((l) => l.site)))];
  return sites.length < 3 ? sites.join(' and ') : `${sites[0]} and ${sites.length - 1} more`;
}

export async function load(a: Atlas): Promise<Data> {
  const file = await loadJson<IndexFile>(a, 'extras/hard-verses.json');
  const pointers = file.pointers ?? [];
  const at = new Map<VerseRef, number[]>();
  for (const [v, i] of file.pointer_lines ?? []) {
    if (!pointers[i]) continue;
    const list = at.get(v);
    if (list) list.push(i);
    else at.set(v, [i]);
  }
  const lines = new Map<VerseRef, NoteLine>();
  for (const [v, is] of at) lines.set(v, `A hard passage: answers on ${sitesOf(is.map((i) => pointers[i]))}`);
  return { pointers, at, lines };
}

/** The passages of the pointers on a verse, the reader's own first, each once. */
export function passagesOn(d: Data, verse: VerseRef): Span[] {
  const all: Span[] = (d.at.get(verse) ?? []).flatMap((i) => [[d.pointers[i].v, d.pointers[i].end] as Span, ...d.pointers[i].also]);
  const here = ([s, e]: Span) => s <= verse && verse <= e;
  const seen = new Set<string>();
  return [...all.filter(here), ...all.filter((x) => !here(x))].filter(([s, e]) => {
    const key = `${s}-${e}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The pages that answer the pointers on a verse, each once. */
export function linksOn(d: Data, verse: VerseRef): Link[] {
  const seen = new Set<string>();
  return (d.at.get(verse) ?? [])
    .flatMap((i) => d.pointers[i].links)
    .filter((l) => {
      if (seen.has(l.url)) return false;
      seen.add(l.url);
      return true;
    });
}
