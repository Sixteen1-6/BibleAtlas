// Ask the Bible: the Bible books and verses a question names ("in john 1",
// "proverbs 16:31"). Shared by gathering (./gather), which looks there first,
// and the router (./route), which opens no prepared answer that leaves out a
// verse the question cites.

import { type Atlas, chapterRange } from '../../data/atlas';

/** The slips that turn the BSB word `x` into the typed `w`: letters left out
 * ("intrest"), two neighbours swapped ("freinds") and, in long words, one
 * vowel for another ("sacrafice"). Other changes make another word
 * ("quitting" is not "quoting", "witch" not "watch"), so they never count. */
export function slips(w: string, x: string): number {
  const vowel = (c: string) => 'aeiou'.includes(c);
  const d = [Array.from({ length: x.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= w.length; i++) {
    d[i] = [Infinity];
    for (let j = 1; j <= x.length; j++) {
      const [a, b] = [w[i - 1], x[j - 1]];
      let best = d[i][j - 1] + 1;
      if (a === b) best = Math.min(best, d[i - 1][j - 1]);
      else if (w.length >= 8 && vowel(a) && vowel(b)) best = Math.min(best, d[i - 1][j - 1] + 1);
      if (i > 1 && j > 1 && a === x[j - 2] && w[i - 2] === b) best = Math.min(best, d[i - 2][j - 2] + 1);
      d[i][j] = best;
    }
  }
  return d[w.length][x.length];
}

/** Consonant outline: "zacheus" and "zacchaeus" both read "zchs". */
export function skeleton(w: string): string {
  return w[0] + w.slice(1).replace(/[aeiouyh]/g, '').replace(/(.)\1+/g, '$1');
}

/** Books named for a person: "john" is the book only as "john 3" or "the
 * gospel of john". Books that are also everyday words need the same. */
const PERSON_BOOKS = new Set(['solomon', 'joshua', 'ruth', 'samuel', 'ezra', 'nehemiah', 'esther', 'job', 'isaiah', 'jeremiah', 'ezekiel', 'daniel', 'hosea', 'joel', 'amos', 'obadiah', 'jonah', 'micah', 'nahum', 'habakkuk', 'zephaniah', 'haggai', 'zechariah', 'malachi', 'matthew', 'mark', 'luke', 'john', 'james', 'peter', 'jude', 'timothy', 'titus', 'philemon']);
const WORD_BOOKS = new Set(['numbers', 'judges', 'kings', 'chronicles', 'psalms', 'psalm', 'proverbs', 'lamentations', 'acts', 'romans', 'song', 'songs']);
const ORDINALS: Record<string, number> = { '1': 1, '2': 2, '3': 3, first: 1, second: 2, third: 3 };

/** "16:31" and "16:31-33" after a word are marked as a verse ("16 v31 w33")
 * so the book named before them can take them; marks no book takes are dropped. */
export const CITE = /\b(\p{L}+)\s+(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/gu;
export const VERSE_AT = /^v(\d{1,3})$/;
export const VERSE_TILL = /^w(\d{1,3})$/;

export interface Named {
  /** Verses of the books or chapters named. */
  from: number;
  to: number;
  chapter: boolean;
  /** The verses themselves, as in "proverbs 16:31". */
  verse?: boolean;
}

/** The Bible books a question names as books ("in john 1", "leviticus",
 * "matthew says ... but acts says"), and which of its words did. */
export function namedBooks(a: Atlas, toks: string[]): { named: Named[]; used: Set<number> } {
  const byWord = new Map<string, { book: number; ord: number }[]>();
  a.books.forEach((b, book) => {
    const parts = b.name.toLowerCase().split(' ');
    const ord = /^\d$/.test(parts[0]) ? +parts[0] : 0;
    const last = parts[parts.length - 1];
    for (const w of last === 'psalms' ? ['psalms', 'psalm'] : [last]) byWord.set(w, [...(byWord.get(w) ?? []), { book, ord }]);
  });
  // "philipians 4:13" is Philippians.
  const keys = [...byWord.keys()];
  toks = toks.map((w) => {
    if (byWord.has(w) || w.length < 6) return w;
    const x = keys.find((k) => k[0] === w[0] && skeleton(k) === skeleton(w) && slips(w, k) <= 2);
    return x ?? w;
  });
  const isBook = (w: string | undefined) => !!w && byWord.has(w);
  const SAYS = ['says', 'say', 'said', 'writes', 'wrote'];
  // "matthew says ... but acts says": a book that speaks, when another does too.
  const speaking = toks.filter((w, i) => isBook(w) && SAYS.includes(toks[i + 1])).length;
  const named: Named[] = [];
  const used = new Set<number>();
  toks.forEach((w, i) => {
    const books = byWord.get(w);
    if (!books) return;
    const [prev, next] = [toks[i - 1], toks[i + 1]];
    const chapter = next && /^\d+$/.test(next) ? +next : 0;
    const asBook =
      chapter > 0 ||
      (!PERSON_BOOKS.has(w) && !WORD_BOOKS.has(w)) ||
      prev === 'in' ||
      (prev === 'of' && ['book', 'gospel', 'letter', 'epistle'].includes(toks[i - 2])) ||
      (SAYS.includes(next) && speaking > 1) ||
      (prev === 'and' && isBook(toks[i - 2])) ||
      (next === 'and' && isBook(toks[i + 2]));
    if (!asBook) return;
    const ord = ORDINALS[prev] ?? 0;
    const pick = books.filter((b) => b.ord === ord);
    for (const { book } of pick.length ? pick : books) {
      const meta = a.books[book];
      const end = book + 1 < a.books.length ? a.books[book + 1].start : a.n;
      if (chapter > 0 && chapter <= meta.chapters.length) {
        const [from, to] = chapterRange(a, book, chapter);
        // "16:31", "16:31-33": the verses asked about.
        const at = VERSE_AT.exec(toks[i + 2] ?? '');
        const till = VERSE_TILL.exec(toks[i + 3] ?? '');
        if (at && +at[1] >= 1 && from + +at[1] - 1 < to) {
          const first = from + +at[1] - 1;
          const last = till ? Math.min(to - 1, from + +till[1] - 1, first + 5) : first;
          if (last >= first) named.push({ from: first, to: last + 1, chapter: false, verse: true });
        }
        named.push({ from, to, chapter: true });
      }
      named.push({ from: meta.start, to: end, chapter: false });
    }
    used.add(i);
    if (chapter > 0) used.add(i + 1);
    if (chapter > 0 && VERSE_AT.test(toks[i + 2] ?? '')) used.add(i + 2);
    if (chapter > 0 && VERSE_AT.test(toks[i + 2] ?? '') && VERSE_TILL.test(toks[i + 3] ?? '')) used.add(i + 3);
    if (ORDINALS[prev]) used.add(i - 1);
    // "the book of romans", "psalm 23 verse 4": words about the book, not of the question.
    for (const j of [i - 2, i - 1, i + 1, i + 2]) if (['book', 'books', 'gospel', 'letter', 'epistle', 'chapter', 'verse'].includes(toks[j])) used.add(j);
  });
  return { named, used };
}

/** The verses a question cites by chapter and verse ("proverbs 16:31",
 * "1 cor 13:4-7"), as gathering reads them. */
export function citedVerses(a: Atlas, question: string): number[] {
  const rest = question
    .toLowerCase()
    .replace(/\b(\p{L}+)['’]s\b/gu, '$1')
    .replace(/[’‘']/g, '')
    .replace(CITE, (_, w: string, c: string, v: string, t?: string) => `${w} ${c} v${v}${t ? ` w${t}` : ''}`);
  const toks = rest.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!toks.some((w) => VERSE_AT.test(w))) return [];
  const out: number[] = [];
  for (const b of namedBooks(a, toks).named) if (b.verse) for (let v = b.from; v < b.to; v++) out.push(v);
  return out;
}
