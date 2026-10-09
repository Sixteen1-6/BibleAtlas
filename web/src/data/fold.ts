// One spelling for things the Bible text and people write several ways, so
// search treats them as the same word. Applied the same way to a query and to
// every verse, so it can never make the two disagree:
//
// - Numbers: "7000", "7,000", "seven thousand", "7 thousand" and King James
//   counting like "threescore and ten" or "five and twenty" all become one
//   token ("#7000", "#70", "#25"). Ordinals too: "first", "1st" -> "#1st".
// - Words joined, split or hyphenated: "first-born", "first born" and
//   "firstborn" become "firstborn".
// - Short forms: "don't" -> "do not".
// - Spellings: British and older spellings and the Greek forms of Old
//   Testament names in the King James New Testament ("honour" -> "honor",
//   "Elias" -> "elijah").
//
// Input is the output of `tokens()` (lowercase, apostrophes dropped), with
// `breaks[i]` set where punctuation stood before word i: "a thousand, and
// two" (Deuteronomy 32:30, King James) is two numbers, not 1002.

import { COMPOUND_WORDS, SHORT_FORMS, SPELLINGS } from './fold-words';

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  // King James counting in scores.
  score: 20, twoscore: 40, threescore: 60, fourscore: 80, sixscore: 120,
  twain: 2,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1_000_000 };
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19,
  twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50, sixtieth: 60, seventieth: 70, eightieth: 80, ninetieth: 90,
  hundredth: 100, thousandth: 1000,
};

/** Joined forms, keyed by the split pair "a b". */
const COMPOUNDS = new Map<string, string>();
/** Single tokens spelled another way -> the spelling search uses. */
const SPELL = new Map<string, string>();
/** Short forms -> their words. */
const EXPAND = new Map<string, string[]>();

const groups = (list: string, sep: string) => list.split('|').map((g) => g.split(sep));
// The first form in each group is the one search uses.
for (const g of groups(SPELLINGS, ' ')) for (const w of g.slice(1)) SPELL.set(w, g[0]);
for (const g of groups(COMPOUND_WORDS, ',')) {
  for (const w of g.slice(1)) {
    const parts = w.split(' ').map((x) => SPELL.get(x) ?? x);
    if (parts.length === 2) COMPOUNDS.set(parts.join(' '), g[0]);
    else SPELL.set(w, g[0]);
  }
}
for (const [short, long] of groups(SHORT_FORMS, ',')) EXPAND.set(short, long.split(' '));
/** Words a number in words can start with. */
const STARTS = new Set([...Object.keys(UNITS), ...Object.keys(ORDINALS), ...Object.keys(SCALES), 'a', 'an']);
/** Number words, for finishing one that is still being typed. */
export const NUMBER_WORDS = [...STARTS].filter((w) => w.length > 2);
/** First words of joined forms, to skip the lookup for most words. */
const FIRSTS = new Set([...COMPOUNDS.keys()].map((k) => k.split(' ')[0]));

const isDigits = (w: string) => /^\d+$/.test(w);

function ordinalDigits(w: string): number | null {
  const m = /^(\d+)(st|nd|rd|th)$/.exec(w);
  return m ? +m[1] : null;
}

/** Whether number word `w` adds to the number read so far. */
function continues(current: number, w: string, joined: boolean): boolean {
  if (w === 'score') return true;
  const v = UNITS[w] ?? ORDINALS[w];
  const rem = current % 100;
  if (rem >= 10 && v >= 10 && v >= rem) return false;
  // A unit never follows a unit ("two and two"); a tens word follows one
  // only with "and" ("five and twenty", not "seven seventy").
  if (rem % 10 && (v < 10 || !joined)) return false;
  return true;
}

const isNumberWord = (w: string | undefined) => !!w && (w in UNITS || (w in ORDINALS && ORDINALS[w] < 100));

/**
 * Read a number starting at toks[i]. Returns the value, how many tokens it
 * used and whether it was an ordinal, or null when no number starts there.
 */
function readNumber(toks: string[], i: number, breaks?: boolean[]): { value: number; used: number; ordinal: boolean } | null {
  const w0 = toks[i];
  const c = w0.charCodeAt(0);
  if (!(c >= 48 && c <= 57) && !STARTS.has(w0)) return null;
  let total = 0;
  let current = 0;
  let j = i;
  let any = false;
  let ordinal = false;
  const scale = (s: number) => {
    if (s === 100) current = (current || 1) * 100;
    else if (!current && total && toks[j - 1] in SCALES) total *= s; // "a thousand thousand"
    else {
      total += (current || 1) * s;
      current = 0;
    }
  };
  while (j < toks.length) {
    if (j > i && breaks?.[j]) break;
    const w = toks[j];
    const next = breaks?.[j + 1] ? undefined : toks[j + 1];
    if (isDigits(w)) {
      // "7,000" arrives as "7", "000"; "144,000" as "144", "000".
      let d = w;
      while (j + 1 < toks.length && /^\d{3}$/.test(toks[j + 1]) && d.length <= 3 + Math.floor((d.length - 1) / 3) * 3) {
        d += toks[j + 1];
        j++;
      }
      // Digits start a number ("7 thousand") but never continue one: "1 2 3" is three.
      if (any) break;
      current += +d;
      any = true;
      j++;
      continue;
    }
    const od = ordinalDigits(w);
    if (od !== null) {
      if (any) break;
      current += od;
      any = true;
      ordinal = true;
      j++;
      break;
    }
    if (w in UNITS) {
      // "twenty two", "threescore and ten" and King James "five and twenty"
      // add up; "twenty thirty", "seven seventy" and "two and two" are not
      // one number.
      if (any && !continues(current, w, toks[j - 1] === 'and')) break;
      if (w === 'score') current = (current || 1) * 20;
      else current += UNITS[w];
      any = true;
      j++;
      continue;
    }
    if (w in ORDINALS) {
      const v = ORDINALS[w];
      if (v >= 100 && any) {
        // "six hundredth", and King James "six hundredth and first" (601st).
        scale(v);
        j++;
        if (toks[j] === 'and' && !breaks?.[j] && !breaks?.[j + 1] && isNumberWord(toks[j + 1]) && toks[j + 1] in ORDINALS) {
          current += ORDINALS[toks[j + 1]];
          j += 2;
        }
      } else {
        // "twenty-fourth", King James "four and twentieth".
        if (any && !continues(current, w, toks[j - 1] === 'and')) break;
        current += v;
        j++;
      }
      any = true;
      ordinal = true;
      break;
    }
    if (w in SCALES) {
      // A scale on its own is one of it, as "a hundred" is: "hundred sheep",
      // "the hundred and forty and four thousand" (Revelation 14:3).
      if (!any) {
        current = 1;
        any = true;
      } else if (!current && !total) break;
      scale(SCALES[w]);
      j++;
      continue;
    }
    // "a thousand", "an hundred": an article right before a scale counts as one.
    if ((w === 'a' || w === 'an') && !any && next && next in SCALES) {
      current = 1;
      any = true;
      j++;
      continue;
    }
    // "two hundred and fifty", "threescore and ten", "five and twenty",
    // "four and twentieth".
    if (w === 'and' && any && next && isNumberWord(next) && continues(current, next, true) && !(next === 'one' && toks[j + 2] === 'another')) {
      j++;
      continue;
    }
    break;
  }
  if (!any) return null;
  // A bare "one" is usually a pronoun ("the one who"): leave it be unless a
  // scale or another number word came with it.
  if (j - i === 1 && toks[i] === 'one') return null;
  return { value: total + current, used: j - i, ordinal };
}

/** Number token as search stores it. */
export function numberToken(value: number, ordinal: boolean): string {
  return ordinal ? `#${value}th` : `#${value}`;
}

/** A folded token and the input tokens [from, to) it stands for. */
export interface Folded {
  tok: string;
  from: number;
  to: number;
}

export function foldSpans(toks: string[], breaks?: boolean[]): Folded[] {
  const out: Folded[] = [];
  for (let i = 0; i < toks.length; ) {
    // Joined words first, so "first-born" is "firstborn", not a number.
    const first = SPELL.get(toks[i]) ?? toks[i];
    if (i + 1 < toks.length && FIRSTS.has(first) && !breaks?.[i + 1]) {
      const joined = COMPOUNDS.get(`${first} ${SPELL.get(toks[i + 1]) ?? toks[i + 1]}`);
      if (joined) {
        out.push({ tok: joined, from: i, to: i + 2 });
        i += 2;
        continue;
      }
    }
    const n = readNumber(toks, i, breaks);
    if (n) {
      out.push({ tok: numberToken(n.value, n.ordinal), from: i, to: i + n.used });
      i += n.used;
      continue;
    }
    const w = SPELL.get(toks[i]) ?? toks[i];
    for (const x of EXPAND.get(w) ?? [w]) out.push({ tok: x, from: i, to: i + 1 });
    i++;
  }
  return out;
}

export function fold(toks: string[], breaks?: boolean[]): string[] {
  return foldSpans(toks, breaks).map((f) => f.tok);
}
