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
// Input is the output of `tokens()` (lowercase, apostrophes dropped).

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  // King James counting in scores.
  score: 20, twoscore: 40, threescore: 60, fourscore: 80,
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

export function addCompounds(list: string[]): void {
  for (const w of list) {
    const [a, b] = w.split(' ');
    if (a && b) COMPOUNDS.set(`${a} ${b}`, a + b);
  }
}
export function addSpellings(groups: string[][]): void {
  // The first form in each group is the one search uses.
  for (const g of groups) for (const w of g.slice(1)) SPELL.set(w, g[0]);
}
export function addExpansions(pairs: [string, string][]): void {
  for (const [short, long] of pairs) EXPAND.set(short, long.split(' '));
}

const isDigits = (w: string) => /^\d+$/.test(w);

function ordinalDigits(w: string): number | null {
  const m = /^(\d+)(st|nd|rd|th)$/.exec(w);
  return m ? +m[1] : null;
}

/**
 * Read a number starting at toks[i]. Returns the value, how many tokens it
 * used and whether it was an ordinal, or null when no number starts there.
 */
function readNumber(toks: string[], i: number): { value: number; used: number; ordinal: boolean } | null {
  let total = 0;
  let current = 0;
  let j = i;
  let any = false;
  let ordinal = false;
  while (j < toks.length) {
    const w = toks[j];
    const next = toks[j + 1];
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
      current += od;
      any = true;
      ordinal = true;
      j++;
      break;
    }
    if (w in UNITS) {
      const v = UNITS[w];
      // "twenty two", "threescore and ten" and King James "five and twenty"
      // add up; "twenty thirty" is two numbers.
      const rem = current % 100;
      if (any && rem >= 10 && v >= 10 && v >= rem && w !== 'score') break;
      if (w === 'score') current = (current || 1) * 20;
      else current += v;
      any = true;
      j++;
      continue;
    }
    if (w in ORDINALS) {
      current += ORDINALS[w];
      any = true;
      ordinal = true;
      j++;
      break;
    }
    if (w in SCALES) {
      if (!any) break;
      const s = SCALES[w];
      if (s === 100) current = (current || 1) * 100;
      else {
        total += (current || 1) * s;
        current = 0;
      }
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
    // "two hundred and fifty", "threescore and ten", "five and twenty".
    if (w === 'and' && any && next && (next in UNITS || isDigits(next)) && !(next === 'one' && toks[j + 2] === 'another')) {
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

export function foldSpans(toks: string[]): Folded[] {
  const out: Folded[] = [];
  for (let i = 0; i < toks.length; ) {
    // Joined words first, so "first-born" is "firstborn", not a number.
    if (i + 1 < toks.length) {
      const joined = COMPOUNDS.get(`${SPELL.get(toks[i]) ?? toks[i]} ${SPELL.get(toks[i + 1]) ?? toks[i + 1]}`);
      if (joined) {
        out.push({ tok: joined, from: i, to: i + 2 });
        i += 2;
        continue;
      }
    }
    const n = readNumber(toks, i);
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

export function fold(toks: string[]): string[] {
  return foldSpans(toks).map((f) => f.tok);
}
