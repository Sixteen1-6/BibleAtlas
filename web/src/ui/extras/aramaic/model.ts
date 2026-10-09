// The data behind Aramaic and Hebrew words, as crates/atlas-cli/src/extra_aramaic.rs
// writes it from config/aramaic.json, and the lookups the lines and the panel
// make over it. The build writes every line, so a line here is one Map.get.

import type { Atlas } from '../../../data/atlas';
import { loadJson } from '../data';
import type { ChapterRef, NoteLine, VerseLink, VerseRef } from '../types';

export type Language = 'Aramaic' | 'Hebrew' | 'Aramaic or Hebrew';
export type Certainty = 'widely agreed' | 'commonly held' | 'scholars differ';
export type Kind = 'saying' | 'prayer' | 'word' | 'name' | 'place' | 'title';

/** Text with the verse names in it as links, in reading order. */
export type Rich = string | readonly (string | VerseLink)[];

/** A word the New Testament keeps in Aramaic or Hebrew. */
export interface Entry {
  id: string;
  /** The verses it is kept in. bsb and greek follow the same order. */
  verses: VerseRef[];
  /** The word as English readers say it: "Talitha koum". */
  word: string;
  meaning: string;
  /** "verse" when the verse itself gives the meaning. */
  meaningFrom: 'verse' | 'gloss';
  /** For each verse, who says or uses it there: "Jesus", "the writer (Mark)". */
  speaker: string[];
  /** Jesus himself says it there. */
  jesus: boolean;
  kind: Kind;
  language: Language;
  certainty: Certainty;
  note: Rich;
  /** The word in Hebrew square letters (Aramaic or Hebrew, as `language` says). */
  aramaic: string;
  /** The caption over the letters where the language alone would mislead, or "". */
  lettersCaption: string;
  /** How sure the letters are, in a plain sentence for Study, or "". */
  lettersNote: string;
  /** For each verse, the BSB's words for it ("Talitha koum", or a translation: "hell"). */
  bsb: string[];
  /** For each verse, the word as TAGNT prints it in Greek letters. */
  greek: string[];
  /** For each verse: null where that Greek is TAGNT's main text; otherwise
   * the main text's word there ("Βηθζαθά" at John 5:2), or "" if it has none. */
  mainReading: (string | null)[];
  /** Its roots (indices into lemmas). */
  roots: number[];
}

/** A part of the Old Testament written in Aramaic. */
export interface Section {
  id: string;
  from: VerseRef;
  to: VerseRef;
  startsMidVerse: boolean;
  endsMidVerse: boolean;
  /** TAHOT word numbers (from 1) when only some words of its one verse are Aramaic. */
  words: number[];
  /** TAHOT tags the words Aramaic (otherwise the lexicon and the BSB's footnote say so). */
  tahot: boolean;
  line: Rich;
  note: Rich;
}

/** extras/aramaic.json */
interface AramaicFile {
  format: number;
  verses: { v: VerseRef; line: NoteLine; entries?: number[]; section?: number }[];
  chapters: { book: number; chapter: number; line: NoteLine; section: number }[];
  entries: Entry[];
  sections: Section[];
  /** [root, language, certainty] for each Greek root counted Aramaic or Hebrew. */
  roots: [number, Language, Certainty][];
}

/** extras/aramaic/deep.json, loaded when a panel opens at Deep. */
export interface DeepFile {
  format: number;
  entries: Record<string, { deep: Rich; aramaicNote: Rich; sources: string[] } | undefined>;
  sections: Record<string, { deep: Rich; sources: string[] } | undefined>;
  /** Why each root counts as Aramaic or Hebrew, by root index. */
  roots: Record<string, string | undefined>;
}

/** What one verse has: its line, and the entries or the section behind it. */
export interface At {
  line: NoteLine;
  entries: Entry[];
  section?: Section;
}

export interface Data {
  verses: Map<VerseRef, At>;
  /** By chapterKey(). */
  chapters: Map<string, { line: NoteLine; section: Section }>;
  roots: Map<number, { language: Language; certainty: Certainty }>;
}

export function chapterKey(c: ChapterRef): string {
  return `${c.book}.${c.chapter}`;
}

export async function load(a: Atlas): Promise<Data> {
  const file = await loadJson<AramaicFile>(a, 'extras/aramaic.json');
  if (file.format !== 1 || !Array.isArray(file.verses)) throw new Error('extras/aramaic.json: unknown format');
  // Skip anything out of range rather than trust the file.
  const ok = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < a.n;
  const sections = file.sections.filter((s) => ok(s.from) && ok(s.to) && s.from <= s.to);
  const verses = new Map<VerseRef, At>();
  for (const row of file.verses) {
    if (!ok(row.v)) continue;
    const entries = (row.entries ?? []).map((i) => file.entries[i]).filter((e) => e && e.verses.includes(row.v));
    const section = row.section === undefined ? undefined : file.sections[row.section];
    if (!entries.length && !(section && sections.includes(section))) continue;
    verses.set(row.v, { line: row.line, entries, section });
  }
  const chapters = new Map<string, { line: NoteLine; section: Section }>();
  for (const c of file.chapters) {
    const section = file.sections[c.section];
    if (section && sections.includes(section) && a.books[c.book]?.chapters[c.chapter - 1]) chapters.set(chapterKey(c), { line: c.line, section });
  }
  const roots = new Map(file.roots.map(([r, language, certainty]) => [r, { language, certainty }]));
  return { verses, chapters, roots };
}
