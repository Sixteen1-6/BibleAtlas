// Lexicon definitions, sharded by root index.
// Each definition is a list of plain segments [text, style bits, verse index];
// they are rendered with text nodes only, never as HTML.

import { type Atlas, DATA_BASE, type Lemmas, langName } from './atlas';

export type Segment = [string, number, number];

/**
 * Whose words a definition is (crates/atlas-cli/src/parse.rs, `origin`):
 * - as: G. Abbott-Smith's Manual Greek Lexicon of the New Testament (1922),
 *   marked "(AS)" in STEPBible's TBESG;
 * - ml: Liddell and Scott's Intermediate Greek-English Lexicon (1889), "(ML)";
 * - sg: added by STEPBible (no mark);
 * - bdb: Brown, Driver and Briggs (1906), abridged by Online Bible, in TBESH;
 * - sn: STEPBible's own note on a person or place, then BDB's entry after "§";
 * - s: STEPBible's own note alone.
 */
export type Origin = 'as' | 'ml' | 'sg' | 'bdb' | 'sn' | 's';

export interface LexEntry {
  /** Lexical form. */
  w: string;
  t: string;
  /** Lexicon part-of-speech code, e.g. "H:N-M". */
  m: string;
  g: string;
  /** Which lexicon: "tbesh" or "tbesg". */
  s: string;
  /** Whose words the definition is. */
  o?: Origin;
  /** Strong's own entry for the word's number, derivation then definition
   *  (crates/atlas-cli/src/family.rs, `strongs_line`); null where he has none. */
  k?: string | null;
  d: Segment[];
}

const shards = new Map<number, Promise<(LexEntry | null)[]>>();

export async function getLex(a: Atlas, root: number): Promise<LexEntry | null> {
  const k = Math.floor(root / a.meta.lexShard);
  let p = shards.get(k);
  if (!p) {
    p = fetch(`${DATA_BASE}lex/${k}.json?${a.version}`).then((r) => {
      if (!r.ok) throw new Error(`lex/${k}.json: HTTP ${r.status}`);
      return r.json() as Promise<(LexEntry | null)[]>;
    });
    p.catch(() => shards.delete(k));
    shards.set(k, p);
  }
  return (await p)[root % a.meta.lexShard] ?? null;
}

/**
 * A root's language in words, as `langName` gives it, with "(scholars differ)"
 * where config/aramaic.json rates the root so (its `certainty`, which
 * extras/aramaic.json ships): "Aramaic, written in Greek letters (scholars
 * differ)" for γαββαθά. Only the word study calls it; `langName` and its other
 * callers (Ask, search, the Aramaic panel) are unchanged.
 */
export function langLabel(L: Lemmas, root: number, certainty: string | null | undefined): string {
  const name = langName(L, root);
  return certainty === 'scholars differ' && L.origin?.[root] ? `${name} (scholars differ)` : name;
}

// ------------------------------------------------------------ word type

/**
 * STEPBible's own words for the brief codes its lexicons give each word
 * ("Brief lexical morphology codes", in TEHMC for the Hebrew lexicon and TEGMC
 * for the Greek; STEPBible-Data at 1f3423d4, CC BY 4.0). Three spellings are
 * mended ("Interogative", "Intjection", "DemonstrativePronoun").
 */
const TEHMC: Record<string, string> = {
  'H:A': 'Hebrew Adjective',
  'H:A-F': 'Hebrew Adjective (Feminine)',
  'H:A-M': 'Hebrew Adjective (Masculine)',
  'H:A / H:N-M': 'Hebrew Adjective OR Noun (Masculine)',
  'H:Adv': 'Hebrew Adverb',
  'H:Cond': 'Hebrew Conditional',
  'H:Conj': 'Hebrew Conjunction',
  'H:DemP': 'Hebrew Demonstrative Pronoun',
  'H:IndP': 'Hebrew Indefinite Pronoun',
  'H:Intg': 'Hebrew Interrogative',
  'H:Intj': 'Hebrew Interjection',
  'H:INJ': 'Hebrew Interjection',
  'H:Neg': 'Hebrew Negative',
  'H:N': 'Hebrew Noun',
  'H:N-F': 'Hebrew Noun (Feminine)',
  'H:N-M': 'Hebrew Noun (Masculine)',
  'H:N-M / H:A': 'Hebrew Noun (Masculine) OR Adjective',
  'H:N-M / H:Adv': 'Hebrew Noun (Masculine) OR Adverb',
  'H:N-M/F': 'Hebrew Noun (Masculine or Feminine)',
  'H:N-M / N:N--L': 'Hebrew Noun (Masculine) OR Proper Name of a Location',
  'H:N-M / N:N--T': 'Hebrew Noun (Masculine) OR Proper Name of some kind',
  'H:N-M / N:N-M-T': 'Hebrew Noun (Masculine) OR Proper Name (Masculine) of some kind',
  'H:Part': 'Hebrew Particle',
  'H:PerP-CP': 'Hebrew Personal Pronoun (Common Plural)',
  'H:PerP-CS': 'Hebrew Personal Pronoun (Common Singular)',
  'H:PerP-FP': 'Hebrew Personal Pronoun (Feminine Plural)',
  'H:PerP-FS': 'Hebrew Personal Pronoun (Feminine Singular)',
  'H:PerP-MP': 'Hebrew Personal Pronoun (Masculine Plural)',
  'H:PerP-MS': 'Hebrew Personal Pronoun (Masculine Singular)',
  'H:Prep': 'Hebrew Preposition',
  'H:Prep / H:Conj': 'Hebrew Preposition OR Conjunction',
  'H:Prep+H:RelP': 'Hebrew Preposition JOINED TO Relative Pronoun',
  'H:RelP': 'Hebrew Relative Pronoun',
  'H:V': 'Hebrew Verb',
  'N:N': 'Proper Name of a Location or Person with no stated gender',
  'N:N-F-L': 'Proper Name (Feminine) of a Location',
  'N:N-F-P': 'Proper Name of a Female Person',
  'N:N-F-P / N:N--L': 'Proper Name of a Female Person OR of a Location',
  'N:N-F-PG': 'Proper Name of a Female Person in Gentilic sense',
  'N:N-F-T': 'Proper Name of a Female of some kind',
  'N:N-F-T / N:N--L': 'Proper Name of a Female of some kind OR of a Location',
  'N:N--L': 'Proper Name of a Location',
  'N:N--L / N:N--LG': 'Proper Name of a Location OR of a Location in Gentilic sense',
  'N:N--L / N:N-M-P': 'Proper Name of a Location OR of a Male Person',
  'N:N--LG': 'Proper Name of a Location in Gentilic sense',
  'N:N--LG / N:N-M-P': 'Proper Name of a Location in Gentilic sense OR of a Male Person',
  'N:N-M-P': 'Proper Name of a Male Person',
  'N:N-M-P / N:N-M-PG': 'Proper Name of a Male Person OR of a Male Person in Gentilic sense',
  'N:N-M-PG': 'Proper Name of a Male Person in Gentilic sense',
  'N:N-M-T': 'Proper Name of a Male some kind',
  'N:N--PG': 'Proper Name of a Person in Gentilic sense',
  'N:N--T': 'Proper Name of some kind',
  'N:N--TG': 'Proper Name of some kind in Gentilic sense',
  Os1c: 'Object suffix: 1st person common singular',
  Os2m: 'Object suffix: 2nd person masculine singular',
  Os2f: 'Object suffix: 2nd person feminine singular',
  Os3m: 'Object suffix: 3rd person masculine singular',
  Os3f: 'Object suffix: 3rd person feminine singular',
  Op1c: 'Object suffix: 1st person common plural',
  Op2m: 'Object suffix: 2nd person masculine plural',
  Op2f: 'Object suffix: 2nd person feminine plural',
  Op3m: 'Object suffix: 3rd person masculine plural',
  Op3f: 'Object suffix: 3rd person feminine plural',
};

const TEGMC: Record<string, string> = {
  'A:PRT-I': 'Aramaic Interrogative',
  'A:N': 'Aramaic Noun',
  'A:V': 'Aramaic Verb',
  'G:A': 'Greek Adjective',
  'G:A--C': 'Greek Adjective - Comparative',
  'G:A--S': 'Greek Adjective - Superlative',
  'G:A / G:ADV': 'Greek Adjective OR Greek Adverb',
  'G:ADV / G:A': 'Greek Adverb OR Greek Adjective',
  'G:ADV-N': 'Greek Adverb Negative',
  'G:A-NUI': 'Greek Number (Indeclinable)',
  'G:ADV': 'Greek Adverb',
  'G:ADV-I': 'Greek Adverb - Interrogative',
  'G:ADV-C': 'Greek Adverb - Comparative',
  'G:ADV-S': 'Greek Adverb - Superlative',
  'G:ADV-T': 'Greek Adverb - Title (upper case for other than a person or place)',
  'G:C': 'Greek Reciprocal Pronoun',
  'G:T': 'Greek Article',
  'G:COND': 'Greek Conditional',
  'G:CONJ': 'Greek Conjunction',
  'G:CONJ-N': 'Greek Conjunction - Negative',
  'G:K': 'Greek Correlative',
  'G:D': 'Greek Demonstrative Pronoun',
  'G:I': 'Greek Interrogative',
  'G:INJ': 'Greek Interjection',
  'G:N-LI': 'Greek Letter (Indeclinable)',
  'G:PRT-I': 'Greek Particle - Interrogative',
  'G:PRT-N': 'Greek Particle - Negative',
  'G:PRT-N+G:CONJ': 'Greek Negative JOINED TO Greek Conjunction',
  'G:N': 'Greek Noun',
  'G:N-F': 'Greek Noun (Feminine)',
  'G:N-F / N:N--T': 'Greek Noun (Feminine) OR Proper Noun of some kind',
  'G:N-M': 'Greek Noun (Masculine)',
  'G:N-M/F': 'Greek Noun (Masculine or Feminine)',
  'G:N-M/N': 'Greek Noun (Masculine or Neuter)',
  'G:N-N': 'Greek Noun Neuter',
  'G:PRT': 'Greek Particle',
  'G:P-1': 'Greek Personal Pronoun (1st person)',
  'G:P-2': 'Greek Personal Pronoun (2nd person)',
  'G:P': 'Greek Personal Pronoun (3rd person)',
  'G:Q': 'Greek Correlative or Interrogative',
  'G:S': 'Greek Possessive Pronoun (3rd person)',
  'G:PREP': 'Greek Preposition',
  'G:PREP / G:A': 'Greek Preposition OR Greek Adjective',
  'G:F-3': 'Greek Reflexive Pronoun (3rd person)',
  'G:R': 'Greek Relative Pronoun',
  'G:V': 'Greek Verb',
  'G:X': 'Greek Indefinite Pronoun',
  'N:N-F-L': 'Proper Name (Feminine) of a Location',
  'N:N-F-LG': 'Proper Name (Feminine) of a Location in Gentilic sense',
  'N:N-F-P': 'Proper Name (Feminine) of a Person',
  'N:N--L': 'Proper Name of a Location with no gender',
  'N:N--LG': 'Proper Name of a Location in Gentilic sense',
  'N:N-M-L': 'Proper Name (Masculine) of a Location',
  'N:N-M-LG': 'Proper Name (Masculine) of a Location in Gentilic sense',
  'N:N-M-P': 'Proper Name (Masculine) of a Person',
  'N:N-M-T': 'Proper Name (Masculine) of some kind',
  'N:N--PG': 'Proper Name of a Person in Gentilic sense',
  'N:N--T': 'Proper Name Title (ie not the name of a person or place)',
  'N:A--L': 'Proper Name Adjective - Location',
  'N:A--LG': 'Proper Name Adjective - Location Gentilic',
  'N:A--PG': 'Proper Name Adjective - Person Gentilic',
};

const LANGUAGE_WORD: Record<string, string> = { H: 'Hebrew', A: 'Aramaic', G: 'Greek' };

/** One part of a code ("H:N-M"), in the keys' words, or null if they do not
 *  give it. A code the keys give only in another language ("A:N-M" beside
 *  "H:N-M") takes that one's words with its own language, as the keys write
 *  "A: ... Aramaic word" beside "H: ... Hebrew word". */
function part(code: string, key: Record<string, string>, other: Record<string, string>): string | null {
  const c = code.trim().replace(/-+$/, '');
  const got = key[c] ?? other[c];
  if (got) return got;
  const m = /^([HAG]):(.+)$/.exec(c);
  if (!m) return null;
  for (const lang of ['H', 'A', 'G']) {
    if (lang === m[1]) continue;
    const words = key[`${lang}:${m[2]}`] ?? other[`${lang}:${m[2]}`];
    if (words?.startsWith(LANGUAGE_WORD[lang])) return LANGUAGE_WORD[m[1]] + words.slice(LANGUAGE_WORD[lang].length);
  }
  return null;
}

/**
 * A lexicon's code for the kind of word, in STEPBible's own words: "H:N-M" is
 * "Hebrew Noun (Masculine)", "N:N-M-P" "Proper Name of a Male Person". A code
 * for several uses ("G:N-F / G:V") joins its parts with "OR", and one for
 * several words with "WITH" or "JOINED TO", as the keys do. Null when the keys
 * do not give a part, so no raw code is ever shown.
 */
export function wordType(m: string, lexicon: string): string | null {
  const [key, other] = lexicon === 'tbesg' ? [TEGMC, TEHMC] : [TEHMC, TEGMC];
  // " / " parts uses; "M/F" without spaces is one code's genders.
  const whole = m.trim().replace(/\s+\/\s*|\s*\/\s+/g, ' / ');
  if (!whole) return null;
  const direct = key[whole] ?? other[whole];
  if (direct) return direct;
  const alts = whole.split(' / ').map((alt) => {
    const words = alt.split(' + ').map((w) => {
      const joined = w.split('+').map((p) => part(p, key, other));
      return joined.includes(null) ? null : joined.join(' JOINED TO ');
    });
    return words.includes(null) ? null : words.join(' WITH ');
  });
  return alts.includes(null) ? null : alts.join(' OR ');
}
