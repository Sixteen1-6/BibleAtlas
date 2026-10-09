// Echoes of a verse: the other verses that use the studied word together with
// more of this verse's less common words.
//
// Everything here works on the root postings already in atlas.bin (which
// verses hold each Hebrew, Aramaic or Greek root) and on the study verse's own
// word row. Nothing is fetched and no other verse's text is read.
//
// A candidate is any other verse with the studied root. Each of the study
// verse's counted roots that the candidate also holds adds ln(N / df) to its
// score, so rare shared words weigh most. A candidate scoring THRESHOLD or
// more is an echo.
//
// Before ranking, countable() sets aside the study verse's words that should
// never make an echo: a reading the manuscripts dispute, a Hebrew suffix that
// STEPBible tags as its own root, and the music words of a psalm's heading.
// The last part of the file says how a shared word is shown in a row.
//
// The file is pure (no imports at runtime, no DOM, no signals, no module
// state) so Node can load it directly to check it against the reference.

/** A root rarer than this (in fewer verses) counts whatever its word type. */
export const RARE = 300;
/** A root in this many verses or more never counts, and is never studied. */
export const MAXDF = 1500;
/** Lowest score that makes a candidate an echo. */
export const THRESHOLD = 4.0;

/** Bits in a word row's flags (FLAG in text.ts): found only in other
 *  editions, and a difference between manuscripts that changes the meaning. */
const OTHER_EDITIONS = 2;
const SIGNIFICANT = 8;

/** A word row from text/<Book>.json: [surface, translit, gloss, root, morph, flags, note?]. */
export type EchoWord = [string, string, string, number, string, number, ...unknown[]];

export interface EchoInput {
  /** Verse count. */
  n: number;
  lOff: Uint32Array;
  lVerse: Uint32Array;
  /** Gloss per root (lemmas.json). */
  gloss: string[];
  /** PageRank per verse, used to break ties. */
  rank: Float32Array;
  /** The study verse's word rows. */
  words: EchoWord[];
  verse: number;
  root: number;
}

export interface Echo {
  v: number;
  score: number;
  /** Counted roots this verse also holds, rarest first. */
  shared: number[];
}

export interface EchoResult {
  /** The study verse's counted roots, ascending. */
  counted: number[];
  /** How many other verses hold the root. */
  others: number;
  /** Candidates at or above THRESHOLD, best first. */
  echoes: Echo[];
}

/** Proper names have a capitalized gloss ("Boaz", "Jerusalem"). */
export function isProper(gloss: string): boolean {
  const m = gloss.match(/\p{L}/u);
  return !!m && /\p{Lu}/u.test(m[0]);
}

/** A content word, by its grammar code in this verse: in Hebrew and Aramaic
 *  a noun, verb or adjective that is not a number; in Greek a noun or verb. */
export function isContent(morph: string): boolean {
  // TAGNT (Greek) codes put a hyphen after the part of speech: "N-NSM",
  // "V-PAI-3S", "A-NSM". Greek adjectives, such as πᾶς "all" and πολύς
  // "much", are left out, as in the reference rule: they are too common to
  // mark an echo.
  if (/^[A-Z]+-/.test(morph)) return /^[NV]-/.test(morph);
  // TAHOT codes start with the language, H or A, and chain the parts with
  // "/": "HC/Ncfsa" is "and" + a noun. Any noun, verb or adjective part
  // counts; "Ac" and "Ao" are cardinal and ordinal numbers. (The Greek
  // adverb code "ADV" also starts with A, and reads as no content word here.)
  if (morph.startsWith('H') || morph.startsWith('A')) {
    return morph
      .slice(1)
      .split('/')
      .some((p) => p[0] === 'N' || p[0] === 'V' || (p[0] === 'A' && p[1] !== 'c' && p[1] !== 'o'));
  }
  // The other Greek codes without a hyphen are particles: "CONJ", "PREP".
  return false;
}

/** Distinct verses holding root q, in Bible order. Postings are in verse
 *  order, so dropping consecutive repeats is enough. */
function versesOf(q: number, lOff: Uint32Array, lVerse: Uint32Array, cache?: Map<number, Uint32Array>): Uint32Array {
  const hit = cache?.get(q);
  if (hit) return hit;
  const s = lOff[q];
  const e = lOff[q + 1];
  const out = new Uint32Array(e - s);
  let k = 0;
  let last = -1;
  for (let i = s; i < e; i++) {
    const v = lVerse[i];
    if (v !== last) {
      out[k++] = v;
      last = v;
    }
  }
  const vs = out.slice(0, k);
  cache?.set(q, vs);
  return vs;
}

/** Distinct verses holding root q, counting no further than `cap`. */
function dfUpTo(q: number, lOff: Uint32Array, lVerse: Uint32Array, cap: number): number {
  let k = 0;
  let last = -1;
  for (let i = lOff[q], e = lOff[q + 1]; i < e; i++) {
    const v = lVerse[i];
    if (v !== last) {
      if (++k >= cap) return k;
      last = v;
    }
  }
  return k;
}

export function rankEchoes(input: EchoInput, cache?: Map<number, Uint32Array>): EchoResult {
  const { n, lOff, lVerse, gloss, rank, words, verse, root } = input;

  // Distinct verses of each counted root. Common roots are ruled out by a
  // capped count first, so "and" or "the" never build a big list.
  const counted = new Map<number, Uint32Array>();
  for (const w of words) {
    const q = w[3];
    if (q < 0 || q === root || w[5] & OTHER_EDITIONS || counted.has(q) || isProper(gloss[q] ?? '')) continue;
    const vs = cache?.get(q) ?? (dfUpTo(q, lOff, lVerse, MAXDF) < MAXDF ? versesOf(q, lOff, lVerse, cache) : null);
    if (!vs || vs.length >= MAXDF) continue;
    if (vs.length < RARE || isContent(w[4])) counted.set(q, vs);
  }
  const roots = [...counted.keys()].sort((x, y) => x - y);

  // Candidates: every other verse with the root, scored by walking each
  // counted root's verses.
  const score = new Map<number, number>();
  for (const c of versesOf(root, lOff, lVerse, cache)) if (c !== verse) score.set(c, 0);
  const others = score.size;
  const sharedBy = new Map<number, number[]>();
  for (const q of roots) {
    const vs = counted.get(q)!;
    const idf = Math.log(n / vs.length);
    for (const c of vs) {
      const s = score.get(c);
      if (s === undefined) continue;
      score.set(c, s + idf);
      const list = sharedBy.get(c);
      if (list) list.push(q);
      else sharedBy.set(c, [q]);
    }
  }

  const df = (q: number) => counted.get(q)!.length;
  const echoes: Echo[] = [];
  for (const [v, s] of score) {
    if (s < THRESHOLD) continue;
    const shared = sharedBy.get(v)!.sort((x, y) => df(x) - df(y) || x - y);
    echoes.push({ v, score: s, shared });
  }
  echoes.sort((x, y) => y.score - x.score || rank[y.v] - rank[x.v] || x.v - y.v);
  return { counted: roots, others, echoes };
}

// ------------------------------------------------------------ what may count

/** Strong's numbers of the music and worship words of the psalm headings:
 *  מִזְמוֹר "psalm", נָצַח "for the choirmaster", נְגִינָה "with stringed
 *  instruments", שׁוּשַׁן "lilies" (a tune), שִׁיר "song" and מַעֲלָה
 *  "ascents". English Bibles print a heading as part of verse 1, so in a
 *  psalm's first verse these words belong to the heading, not the prayer, and
 *  would make every other psalm heading an echo. Names in headings, such as
 *  "Maskil" or "David", are proper nouns and never count anyway. */
export const PSALM_HEADING = ['H4210', 'H5329', 'H5058', 'H7799', 'H7892A', 'H4609B'];

/** Strong's codes named in a word's reading note, that is the other
 *  reading's words: `D= ka.'a.Ru (כָּ֝אֲרוּ) "they dug" (H3738A=HVqp3cp)`. */
function noteKeys(w: EchoWord): string[] {
  const note = (w[6] as { v?: unknown } | undefined)?.v;
  return typeof note === 'string' ? (note.match(/[HG]\d{4}[A-Za-z]?/g) ?? []) : [];
}

/** True when this word's reading is in dispute: the manuscripts or editions
 *  differ in meaning here and the other reading is not this same word. In
 *  Psalm 22:16 the Leningrad Codex reads כָּאֲרִי "like a lion" where other
 *  manuscripts read "they dug"; where the readings differ only in an ending,
 *  as in "his tent" written two ways, the word itself is not in doubt. */
export function isDisputed(w: EchoWord, key: string[]): boolean {
  if (!(w[5] & SIGNIFICANT)) return false;
  const own = key[w[3]];
  return !own || !noteKeys(w).includes(own);
}

/** A Hebrew suffix that STEPBible tags as its own root (numbers from H9001,
 *  such as נוּ "us" in לָנוּ "for us"): grammar, not a word. */
export function isAffix(k: string | undefined): boolean {
  return !!k && /^H9\d{3}/.test(k);
}

/** Does the verse hold the root in its base text, in a reading no manuscript
 *  disputes? Only then are its echoes shown. */
export function holdsRoot(words: EchoWord[], root: number, key: string[]): boolean {
  return words.some((w) => w[3] === root && !(w[5] & OTHER_EDITIONS) && !isDisputed(w, key));
}

/** The study verse's words that may make an echo. A word is set aside when
 *  its reading is disputed, when it is a suffix, and, in the first verse of a
 *  psalm, when it is one of the heading's music words. */
export function countable(words: EchoWord[], key: string[], psalmOpening: boolean): EchoWord[] {
  return words.filter((w) => {
    const k = key[w[3]];
    return !isDisputed(w, key) && !isAffix(k) && !(psalmOpening && PSALM_HEADING.includes(k));
  });
}

// ------------------------------------------------------------ how a shared word reads

/** A dictionary gloss without STEPBible's notation: the general meaning
 *  before ": " ("to turn: surround" is "to turn"), without endings glued on in
 *  brackets ("thus(-ly)", "seed(s)") and with optional words kept ("far
 *  (away)" is "far away"). */
export function plainGloss(g: string): string {
  const t = g
    .split(': ')[0]
    .replace(/(\p{L})\([^)]*\)/gu, '$1')
    .replace(/[()[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t || g;
}

// Words trimmed from either end of a gloss in a verse: they come from the
// Hebrew prefixes and suffixes ("and", "the", "his") or from English tense.
const LEAD = new Set(
  'a according am an and are as at be been being but by did do does even for from had has have he her his i in into is it its let like may might must my nor o of oh on or our shall she should so that the their them then these they this those to upon was we were what when which who whom will with would you your'.split(' '),
);
const TRAIL = new Set('a and be by for from her him his in is it its me my of on our the their them to toward towards us was were with you your'.split(' '));

/** How one verse renders a word, from STEPBible's gloss there: "and [the]
 *  covenant loyalty of" is "covenant loyalty", "they have surrounded me" is
 *  "surrounded". Words the English leaves out (<…>) are dropped. */
export function senseIn(raw: string): string {
  const t = raw
    .replace(/i<es>/g, 'y')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[[\]“”"¶]/g, '')
    .replace(/[,.;:!?·]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  while (t.length && LEAD.has(t[0].toLowerCase())) t.shift();
  while (t.length && TRAIL.has(t[t.length - 1].toLowerCase())) t.pop();
  return t.join(' ');
}

const IRREGULAR: Record<string, string> = Object.fromEntries(
  (
    'arose:arise ate:eat began:begin begun:begin bore:bear born:bear borne:bear bought:buy bound:bind brethren:brother broke:break broken:break brought:bring built:build calves:calf came:come caught:catch children:child chose:choose chosen:choose dealt:deal did:do done:do drank:drink drew:draw drawn:draw drunk:drink dug:dig dwelt:dwell eaten:eat fallen:fall fed:feed feet:foot fell:fall felt:feel fled:flee flew:fly forgave:forgive forgiven:forgive fought:fight found:find gave:give given:give gone:go grew:grow grown:grow heard:hear held:hold hid:hide hidden:hide hung:hang kept:keep knew:know known:know laid:lay lain:lie led:lead left:leave lives:life loaves:loaf lost:lose made:make men:man met:meet oxen:ox paid:pay ran:run risen:rise rode:ride rose:rise said:say sang:sing sank:sink sat:sit saw:see seen:see sent:send shook:shake slain:slay slept:sleep slew:slay smote:strike sold:sell sought:seek spoke:speak spoken:speak stole:steal stolen:steal stood:stand struck:strike sung:sing swore:swear sworn:swear taken:take taught:teach teeth:tooth thought:think threw:throw thrown:throw told:tell took:take tore:tear torn:tear went:go wept:weep wives:wife women:woman wore:wear written:write wrote:write'
  )
    .split(' ')
    .map((p) => p.split(':')),
);

/** A word without its English ending, keeping at least three letters:
 *  "rulers" is "ruler", "cities" is "city", "denied" is "deny", "seed" and
 *  "lies" stay. */
function stem(t: string): string {
  t = (IRREGULAR[t] ?? t).replace(/(\p{L}{3})i(?:es|ed)$/u, '$1y');
  const end = t.match(/(?:ings?|ed|e?s|ly|ness)$/)?.[0];
  return end && t.length - end.length >= 3 ? t.slice(0, -end.length) : t;
}

/** Meaning words of a gloss, lower-case and roughly stemmed. */
function stems(g: string): string[] {
  return g
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((t) => t.length > 1 && !LEAD.has(t) && !TRAIL.has(t))
    .map(stem);
}

/** Do two glosses share a meaning word, allowing for plurals and tenses? */
export function sameSense(a: string, b: string): boolean {
  const x = stems(a);
  const y = stems(b);
  if (!x.length || !y.length) return true;
  return y.some((s) => x.some((t) => s === t || (Math.min(s.length, t.length) >= 3 && (s.startsWith(t) || t.startsWith(s)))));
}

/** A noun or adjective (not a number) by its grammar code: where a verse's
 *  own rendering says most about which sense of the word is meant. */
function nounOrAdjective(morph: string): boolean {
  if (/^[A-Z]+-/.test(morph)) return /^[NA]-/.test(morph);
  if (!morph.startsWith('H') && !morph.startsWith('A')) return false;
  const parts = morph.slice(1).split('/');
  return !parts.some((p) => p[0] === 'V') && parts.some((p) => p[0] === 'N' || (p[0] === 'A' && p[1] !== 'c' && p[1] !== 'o'));
}

export interface SharedGloss {
  /** The word's meaning, from the dictionary. */
  gloss: string;
  /** How the echo verse renders it, when that is another sense. */
  here?: string;
}

/** How an echo row glosses a shared word, given its dictionary gloss and, once
 *  the echo verse is loaded, the word as it stands there and the verse's
 *  English. Normally the general meaning; the narrower sense STEPBible lists
 *  when that is the one the verse uses ("to turn: surround" in "dogs surround
 *  me" reads "to surround"); and for a noun or adjective the verse renders
 *  another way, that rendering too, so ἀρχή reads "beginning", here "rulers".
 *  The rendering is left out when the English printed under the row already
 *  uses the dictionary word. */
export function describeShared(dict: string, w?: EchoWord, english?: string): SharedGloss {
  const [general, sense] = dict.split(': ');
  const gloss = plainGloss(general);
  if (!w) return { gloss };
  const here = senseIn(w[2]);
  if (!here || sameSense(general, here)) return { gloss };
  if (sense && sameSense(sense, here)) {
    const s = plainGloss(sense);
    return { gloss: gloss.startsWith('to ') && !/^(?:to|be) /.test(s) ? `to ${s}` : s };
  }
  return nounOrAdjective(w[4]) && !(english && sameSense(general, english)) ? { gloss, here } : { gloss };
}
