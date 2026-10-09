// Word alignment: which BSB English words came from which original word.
// Built by crates/atlas-cli/src/align.rs from the Clear Bible alignments.

/** [surface, gloss, group] for one prefix, stem or suffix of a split word. */
export type PieceRow = [string, string, number];

/** Groups are numbered from 0 in English reading order; -1 has no partner. */
export interface VerseAlign {
  /** Group of each English word, as split by `englishWords`. */
  e: number[];
  /** Per original word: its group, or its pieces when it is split. */
  w: (number | PieceRow[])[];
}

/** Same split as `english_words` in align.rs: letters and digits, joined
 *  across an apostrophe or hyphen with a letter or digit on both sides. */
const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** The verse cut into English words (with their index) and the text between. */
export function englishParts(s: string): { text: string; word: number }[] {
  const out: { text: string; word: number }[] = [];
  let last = 0;
  let n = 0;
  for (const m of s.matchAll(WORD)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), word: -1 });
    out.push({ text: m[0], word: n++ });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), word: -1 });
  return out;
}

/** Pieces of an original word: its own pieces, or the whole word as one. */
export function piecesOf(entry: number | PieceRow[] | undefined, surface: string, gloss: string): PieceRow[] {
  if (Array.isArray(entry)) return entry;
  return [[surface, gloss, entry ?? -1]];
}

export const PAIR_COLORS = 8;
