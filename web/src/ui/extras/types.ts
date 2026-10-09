// The contract every extra follows. An extra adds at most one quiet line under
// the selected verse (and, if it wants, one under the chapter heading), shown
// only where it has something to say, and one panel that opens from that line.
// README.md in this folder is the recipe.

import type { ComponentType } from 'preact';
import type { Atlas } from '../../data/atlas';
import type { Level } from './level';

/** A verse, numbered the way the app numbers them: 0 is Genesis 1:1 and
 * a.n - 1 is Revelation 22:21. The same number as S.selected. */
export type VerseRef = number;

/** A chapter: book index (0 is Genesis, 65 is Revelation) and chapter number
 * from 1. The same shape as S.reading. */
export interface ChapterRef {
  book: number;
  chapter: number;
}

/** A verse or passage named inside a note. The app writes its name
 * ("Isaiah 40:3", "Mark 2:1–12") and makes it a link to that verse. */
export interface VerseLink {
  /** The verse, or the first verse of the passage. */
  verse: VerseRef;
  /** The last verse of a passage, inclusive. Leave it out for one verse. */
  to?: VerseRef;
  /** Words to show instead of the reference. Rarely needed. */
  text?: string;
}

/** One line of plain words: a string, or words and verse links in reading
 * order, e.g. ['Quoted in ', { verse: m }, ' and 3 more']. */
export type NoteLine = string | readonly (string | VerseLink)[];

/** What a verse panel receives. */
export interface PanelProps<D> {
  a: Atlas;
  /** What load() returned. */
  data: D;
  /** The verse whose note was tapped. */
  verse: VerseRef;
  /** Close the panel. */
  close: () => void;
  /** Close the panel and move the reader to a verse. */
  navigate: (verse: VerseRef) => void;
}

/** What a chapter panel receives. */
export interface ChapterPanelProps<D> {
  a: Atlas;
  data: D;
  /** The chapter whose line was tapped. */
  chapter: ChapterRef;
  close: () => void;
  navigate: (verse: VerseRef) => void;
}

export interface Extra<D> {
  /** Lowercase letters, digits and hyphens, the same as the file name:
   * quotes.extra.tsx has id 'quotes'. It is the value of the x= link parameter. */
  id: string;
  /** Position in the block of notes, lowest first. */
  order: number;
  /** A short plain name, the heading of the panel: 'Quotations'. */
  title: string;
  /** The level at which the note appears. Default 'simple'. */
  level?: Level;
  /** Loads what note() and the panel need. Runs once, the first time a verse
   * (or a chapter, with chapterNote) is shown at this extra's level; the result
   * is kept. If it fails, the note does not show, and it is tried again later. */
  load(a: Atlas): Promise<D>;
  /** The line for a verse, or null when this extra has nothing to say about it.
   * Called on every render: make it a lookup, and do the work in load(). */
  note(verse: VerseRef, data: D): NoteLine | null;
  /** The one-tap depth view behind the note. */
  Panel: ComponentType<PanelProps<D>>;
  /** Optional: on wider screens, the panel reaches up over the map of links
   * to just under the top bar, for a panel that needs the height (Places). */
  tall?: boolean;
  /** Optional: a line under the chapter heading, or null. */
  chapterNote?(chapter: ChapterRef, data: D): NoteLine | null;
  /** Optional: the panel behind the chapter line. Without it, the chapter line
   * cannot be tapped and only its verse links work. */
  ChapterPanel?: ComponentType<ChapterPanelProps<D>>;
}

/** Wrap your extra in this so TypeScript checks that load(), note() and Panel
 * agree on the type of the data: export default defineExtra({ ... }). */
export function defineExtra<D>(extra: Extra<D>): Extra<D> {
  return extra;
}
