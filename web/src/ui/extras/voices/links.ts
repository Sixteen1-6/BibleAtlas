// Places on other websites to read more about a verse, built from each site's
// own address pattern. Every book's address was opened on the site and
// checked to show the right verse or chapter (October 2026); where a site has
// notes on only part of the Bible, the link shows only there. Each comes from
// writers who hold the whole Bible to be God's true word (October 2026, at
// Shubhanshu's request): from Bible Hub, one older commentary at a time
// rather than its page that mixes in critical ones. Links only: nothing from
// these sites is copied into the app or fetched by it.

import { type Atlas, locate } from '../../../data/atlas';
import type { VerseRef } from '../types';

export interface Link {
  /** What the reader finds there, in plain words. */
  label: string;
  url: string;
  /** The site's name, as shown. */
  site: string;
  /** Its card on the Sources shelf (config/shelf.json). */
  shelf: string;
}

/** biblehub.com/commentaries/<commentary>/<book>/<c>.htm */
const BIBLEHUB = [
  'genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy', 'joshua', 'judges', 'ruth', '1_samuel', '2_samuel', '1_kings', '2_kings',
  '1_chronicles', '2_chronicles', 'ezra', 'nehemiah', 'esther', 'job', 'psalms', 'proverbs', 'ecclesiastes', 'songs', 'isaiah', 'jeremiah',
  'lamentations', 'ezekiel', 'daniel', 'hosea', 'joel', 'amos', 'obadiah', 'jonah', 'micah', 'nahum', 'habakkuk', 'zephaniah', 'haggai',
  'zechariah', 'malachi', 'matthew', 'mark', 'luke', 'john', 'acts', 'romans', '1_corinthians', '2_corinthians', 'galatians', 'ephesians',
  'philippians', 'colossians', '1_thessalonians', '2_thessalonians', '1_timothy', '2_timothy', 'titus', 'philemon', 'hebrews', 'james',
  '1_peter', '2_peter', '1_john', '2_john', '3_john', 'jude', 'revelation',
];

/** classic.net.bible.org/verse.php?book=<book>&chapter=<c>&verse=<v> */
const NET = [
  'Gen', 'Exo', 'Lev', 'Num', 'Deu', 'Jos', 'Jdg', 'Rut', '1Sa', '2Sa', '1Ki', '2Ki', '1Ch', '2Ch', 'Ezr', 'Neh', 'Est', 'Job', 'Psa', 'Pro',
  'Ecc', 'Sos', 'Isa', 'Jer', 'Lam', 'Eze', 'Dan', 'Hos', 'Joe', 'Amo', 'Oba', 'Jon', 'Mic', 'Nah', 'Hab', 'Zep', 'Hag', 'Zec', 'Mal', 'Mat',
  'Mar', 'Luk', 'Joh', 'Act', 'Rom', '1Co', '2Co', 'Gal', 'Eph', 'Phi', 'Col', '1Th', '2Th', '1Ti', '2Ti', 'Tit', 'Phm', 'Heb', 'Jam', '1Pe',
  '2Pe', '1Jo', '2Jo', '3Jo', 'Jud', 'Rev',
];

/** gotquestions.org/questions-about-<book>.html, and bibleref.com/<book>/<c>/<book>-<c>-<v>.html */
const NAMES = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1-Samuel', '2-Samuel', '1-Kings', '2-Kings',
  '1-Chronicles', '2-Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song-Solomon', 'Isaiah',
  'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
  'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1-Corinthians', '2-Corinthians', 'Galatians',
  'Ephesians', 'Philippians', 'Colossians', '1-Thessalonians', '2-Thessalonians', '1-Timothy', '2-Timothy', 'Titus', 'Philemon', 'Hebrews',
  'James', '1-Peter', '2-Peter', '1-John', '2-John', '3-John', 'Jude', 'Revelation',
];

/** Where BibleRef has notes on single verses, as [first chapter, first verse,
 * last chapter, last verse] per book; a book left out has none, and an empty
 * list means the whole book. Elsewhere its verse pages say "coming soon". */
const BIBLEREF: Record<number, readonly (readonly [number, number, number, number])[]> = {
  0: [],
  1: [[1, 1, 20, 17]],
  6: [],
  7: [],
  8: [],
  9: [[7, 12, 7, 12]],
  18: [[1, 1, 66, 999], [100, 1, 100, 999], [139, 1, 139, 999]],
  19: [],
  22: [[1, 1, 28, 1]],
  26: [],
  30: [],
  38: [],
};

function inBibleRef(book: number, c: number, v: number): boolean {
  if (book >= 39) return true;
  const ranges = BIBLEREF[book];
  if (!ranges) return false;
  if (ranges.length === 0) return true;
  return ranges.some(([c1, v1, c2, v2]) => (c > c1 || (c === c1 && v >= v1)) && (c < c2 || (c === c2 && v <= v2)));
}

/** The places to read more about a verse, most plainly helpful first. */
export function elsewhere(a: Atlas, verse: VerseRef): Link[] {
  if (verse < 0 || verse >= a.n) return [];
  const { book: b, chapter: c, verse: v } = locate(a, verse);
  if (b < 0 || b > 65) return [];
  const name = a.books[b].name;
  const links: Link[] = [];
  if (inBibleRef(b, c, v)) {
    const folder = NAMES[b];
    const file = b === 18 ? 'Psalm' : folder;
    links.push({ label: 'What this verse means', url: `https://www.bibleref.com/${folder}/${c}/${file}-${c}-${v}.html`, site: 'BibleRef', shelf: 'bibleref' });
  }
  links.push({ label: `Questions about ${name}`, url: `https://www.gotquestions.org/questions-about-${NAMES[b]}.html`, site: 'GotQuestions', shelf: 'gotquestions' });
  if (b < 39) {
    links.push({ label: 'Keil and Delitzsch on this chapter', url: `https://biblehub.com/commentaries/kad/${BIBLEHUB[b]}/${c}.htm`, site: 'Bible Hub', shelf: 'biblehub' });
  }
  links.push({ label: 'Jamieson, Fausset and Brown on this chapter', url: `https://biblehub.com/commentaries/jfb/${BIBLEHUB[b]}/${c}.htm`, site: 'Bible Hub', shelf: 'biblehub' });
  links.push({ label: 'Translators’ notes on this verse', url: `https://classic.net.bible.org/verse.php?book=${NET[b]}&chapter=${c}&verse=${v}`, site: 'NET Bible (Bible.org)', shelf: 'bible-org' });
  return links;
}
