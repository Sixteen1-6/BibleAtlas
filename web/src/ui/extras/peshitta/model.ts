// The data behind the Syriac extra, as crates/atlas-cli/src/extra_peshitta.rs
// writes it, and the lookup the line makes over it.

import type { Atlas } from '../../../data/atlas';
import { loadJson } from '../data';
import type { VerseRef } from '../types';

/** web/public/data/extras/peshitta.json: runs of verses [from, to]. */
interface IndexFile {
  format: number;
  /** Verses that have Syriac. */
  have: [number, number][];
  /** Of those, the verses the early Peshitta did not have, taken from a later Syriac version. */
  later: [number, number][];
}

/** web/public/data/extras/peshitta/<Book>.json, loaded when the panel opens. */
export interface BookFile {
  format: number;
  /** The book's first verse: index i in syc and rom is verse first + i. */
  first: number;
  /** The Syriac of each verse, with its vowel points ("" where there is none). */
  syc: string[];
  /** An approximate romanization of each verse, letter by letter. */
  rom: string[];
  /** Verses placed on the BSB's numbering by name: [kind, the source's number]. */
  notes: Record<string, [Kind, string] | undefined>;
  /** Verses the BSB leaves out of its text (it gives them in a footnote). */
  omitted: number[];
  /** The source's revision status, e.g. "UncorrectedTranscription". */
  status: string;
  /** The years the source gives for the translation, e.g. [350, 450]. */
  date: [number, number];
}

export type Kind = 'coded' | 'order' | 'number' | 'split';

/** 1: a verse of the early Peshitta; 2: from a later Syriac version. */
export const EARLY = 1;
export const LATER = 2;

export interface Data {
  /** By verse number: 0 (no Syriac), EARLY or LATER. */
  kind: Uint8Array;
}

export async function load(a: Atlas): Promise<Data> {
  const file = await loadJson<IndexFile>(a, 'extras/peshitta.json');
  const kind = new Uint8Array(a.n);
  const fill = (runs: [number, number][], k: number) => {
    for (const [from, to] of runs) {
      for (let v = Math.max(0, from); v <= Math.min(to, a.n - 1); v++) kind[v] = k;
    }
  };
  fill(file.have, EARLY);
  fill(file.later, LATER);
  return { kind };
}

/** The verse's slot in its book file, or -1. */
export function slot(file: BookFile, verse: VerseRef): number {
  const i = verse - file.first;
  return i >= 0 && i < file.syc.length ? i : -1;
}
