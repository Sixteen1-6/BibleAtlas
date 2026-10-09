// What the STEPBible word-type codes say about manuscripts and editions.

const GREEK_EDITIONS: Record<string, string> = {
  NA28: 'Nestle-Aland 28th edition',
  NA27: 'Nestle-Aland 27th edition',
  Tyn: 'Tyndale House Greek New Testament',
  SBL: 'SBL Greek New Testament',
  WH: 'Westcott and Hort (1881)',
  Treg: 'Tregelles (1879)',
  TR: 'Textus Receptus (Scrivener 1894), the Greek behind the KJV',
  Byz: 'Byzantine text (Robinson-Pierpont 2005)',
};

const GREEK_FAMILY: Record<string, string> = {
  N: 'the Nestle-Aland text used by most modern translations',
  K: 'the Textus Receptus used by the KJV',
  O: 'other major editions',
};

const HEBREW_SOURCE: Record<string, string> = {
  L: 'the Leningrad Codex',
  Q: 'the Qere (the scribes’ marginal reading)',
  K: 'the Ketiv (the consonants as written)',
  R: 'text restored from a parallel passage',
  X: 'text reconstructed from the Greek Septuagint',
  A: 'the Aleppo Codex',
  B: 'Biblia Hebraica Stuttgartensia',
  C: 'the Cairo Codex',
  D: 'a Dead Sea Scroll or other Judean Desert manuscript',
  E: 'a scholarly emendation',
  F: 'a different word division or pointing',
  H: 'the Ben Chaim Rabbinic Bible',
  P: 'different punctuation in major manuscripts',
  S: 'scribal traditions',
  V: 'another ancient version',
};

export interface VariantInfo {
  /** One-sentence summary. */
  summary: string;
  /** Editions or sources that contain this word as printed. */
  witnesses: string[];
  /** Sources that differ. */
  differ: string[];
  /** The difference changes the meaning (vs spelling or word order only). */
  significant: boolean;
}

function split(kind: string): { outside: string; inside: string } {
  let outside = '';
  let inside = '';
  let depth = 0;
  for (const c of kind) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (/[A-Za-z]/.test(c)) depth > 0 ? (inside += c) : (outside += c);
  }
  return { outside, inside };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function describeVariant(kind: string, greek: boolean, editions?: string, significant = false): VariantInfo {
  const { outside, inside } = split(kind);
  if (greek) {
    const present = [...new Set(outside.toUpperCase())].filter((c) => GREEK_FAMILY[c]);
    const absent = ['N', 'K', 'O'].filter((c) => !outside.toUpperCase().includes(c) && !inside.toUpperCase().includes(c));
    const varies = [...new Set(inside.toUpperCase())].filter((c) => GREEK_FAMILY[c]);
    const witnesses = (editions ?? '').split('+').map((e) => e.trim()).filter(Boolean).map((e) => GREEK_EDITIONS[e] ?? e);
    // Words STEPBible does not class as Ancient (no N) that its data still
    // lists in Nestle-Aland. With the 27th edition listed they are Mark
    // 16:8-20 and John 7:53-8:11, which Nestle-Aland prints in double
    // brackets (atlas verify checks this). With the 28th alone, most are
    // slips of STEPBible's NA28 column in Mark and Acts and a few are real
    // changes in James to 2 Peter, so the note says only what the data says.
    const listed = (editions ?? '').split('+').map((e) => e.trim());
    const kjv = present.includes('K') ? 'has it' : varies.includes('K') ? 'has it in a different form' : 'does not have it';
    let summary: string;
    if (!present.includes('N') && listed.includes('NA27'))
      summary = `Nestle-Aland prints this word in double brackets [[ ]], which its editors use for very early passages they judge were not part of the original text. The Greek text behind the KJV ${kjv}.`;
    else if (!present.includes('N') && listed.includes('NA28'))
      summary = `STEPBible’s data lists this word in Nestle-Aland’s 28th edition but not the 27th. The Greek text behind the KJV ${kjv}.`;
    else if (!present.includes('N')) summary = `This word is not in ${GREEK_FAMILY.N}. It comes from ${present.map((c) => GREEK_FAMILY[c]).join(' and ')}.`;
    else if (absent.length) summary = `This word is missing from ${absent.map((c) => GREEK_FAMILY[c]).join(' and ')}.`;
    else if (varies.length) summary = `${varies.map((c) => GREEK_FAMILY[c]).join(' and ')} ${significant ? 'has a different word here' : 'spells or orders this word differently'}.`;
    else summary = 'The editions agree on this word.';
    return { summary: capitalize(summary), witnesses, differ: [...absent, ...varies].map((c) => GREEK_FAMILY[c]), significant };
  }
  const base = outside[0]?.toUpperCase() ?? 'L';
  const witnesses = [...new Set(outside.toUpperCase())].map((c) => HEBREW_SOURCE[c]).filter(Boolean);
  const differ = [...new Set(inside.toUpperCase())].map((c) => HEBREW_SOURCE[c]).filter(Boolean);
  let summary: string;
  if (base === 'Q') summary = `Read as the Qere, the scribes’ marginal correction. The written consonants (Ketiv) ${significant ? 'give a different word' : 'differ only in spelling'}.`;
  else if (base === 'X') summary = 'Not in the Leningrad Codex; reconstructed from the Greek Septuagint, as in the BHS apparatus.';
  else if (base === 'R') summary = 'Missing from the Leningrad Codex and restored from a parallel passage.';
  else if (differ.length) summary = `${differ.join(' and ')} ${significant ? 'has a different reading here' : 'differs only slightly here'}.`;
  else summary = 'From the Leningrad Codex.';
  return { summary: capitalize(summary), witnesses, differ, significant };
}

/** Turn a source note like `D= ka.'a.Ru (כָּ֝אֲרוּ) "they dug"` into
 *  `In a Dead Sea Scroll or other Judean Desert manuscript: ka.'a.Ru (כָּ֝אֲרוּ) "they dug"`. */
export function describeVariantNote(note: string, greek: boolean): string {
  // Drop raw tagging codes like "(H3738A=HVqp3cp)"; the words themselves stay.
  note = note.replace(/\s*\([HG]\d{4}[A-Za-z]?=[^)]*\)/g, '');
  if (greek) return note;
  return note.replace(/(^|[;¦]\s*)([A-Z])=\s*/g, (_m, pre: string, letter: string) => {
    const src = HEBREW_SOURCE[letter];
    return src ? `${pre}In ${src}: ` : _m;
  });
}
