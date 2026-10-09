// The data behind the "Often asked" line, as crates/atlas-cli/src/extra_hard_verses.rs
// writes it from config/hard-verses.json (drafts left out). The line needs only
// the questions; the cards themselves load when a panel opens.

import type { Atlas } from '../../../data/atlas';
import { loadJson } from '../data';
import type { NoteLine, VerseRef } from '../types';

/** First and last verse, inclusive. */
export type Span = [VerseRef, VerseRef];

export interface View {
  label: string;
  strength: 'widely held' | 'commonly held' | 'some interpreters';
  text: string;
  refs: Span[];
}

export interface Card {
  id: string;
  v: VerseRef;
  end: VerseRef;
  also: Span[];
  question: string;
  answer: string;
  views: View[];
  helps: Span[];
  read_more: { site: string; title: string; url: string }[];
  evidence: string;
  source: string;
  reviewed_by: string[];
  /** Not yet reviewed by a person (only present in local preview builds). */
  draft: boolean;
}

/** extras/hard-verses.json */
interface IndexFile {
  format: number;
  questions: { id: string; q: string }[];
  /** [verse, question index] */
  lines: [VerseRef, number][];
}

/** extras/hard-verses/cards.json, in the same order as the questions. */
export interface CardsFile {
  format: number;
  cards: Card[];
}

export const CARDS_FILE = 'extras/hard-verses/cards.json';

export interface Data {
  questions: { id: string; q: string }[];
  /** The questions under each verse, by index. */
  at: Map<VerseRef, number[]>;
  lines: Map<VerseRef, NoteLine>;
}

export async function load(a: Atlas): Promise<Data> {
  const file = await loadJson<IndexFile>(a, 'extras/hard-verses.json');
  const at = new Map<VerseRef, number[]>();
  for (const [v, i] of file.lines) {
    const list = at.get(v);
    if (list) list.push(i);
    else at.set(v, [i]);
  }
  const lines = new Map<VerseRef, NoteLine>();
  for (const [v, is] of at) {
    const first = `Often asked: ${file.questions[is[0]].q}`;
    lines.set(v, is.length > 1 ? `${first}, and ${is.length - 1} more` : first);
  }
  return { questions: file.questions, at, lines };
}
