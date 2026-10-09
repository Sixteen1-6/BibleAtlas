// Grammar codes in plain English.
// Hebrew/Aramaic: OpenScriptures/ETCBC codes as used by STEPBible TAHOT
//   (e.g. "HVqp3ms" = Hebrew verb, Qal perfect, 3rd person masculine singular).
// Greek: Robinson-style codes as used by STEPBible TAGNT
//   (e.g. "V-AAI-3S" = verb, aorist active indicative, 3rd person singular).

const HEB_STEM: Record<string, string> = {
  q: 'Qal', N: 'Niphal', p: 'Piel', P: 'Pual', h: 'Hiphil', H: 'Hophal', t: 'Hithpael', o: 'Polel', O: 'Polal',
  r: 'Hithpolel', m: 'Poel', M: 'Poal', k: 'Palel', K: 'Pulal', Q: 'Qal passive', l: 'Pilpel', L: 'Polpal',
  f: 'Hithpalpel', D: 'Nithpael', j: 'Pealal', i: 'Pilel', u: 'Hothpaal', c: 'Tiphil', v: 'Hishtaphel',
  w: 'Nithpalel', y: 'Nithpoel', z: 'Hithpoel',
};
const ARA_STEM: Record<string, string> = {
  q: 'Peal', Q: 'Peil', u: 'Hithpeel', p: 'Pael', P: 'Ithpaal', M: 'Hithpaal', a: 'Aphel', h: 'Haphel', s: 'Saphel',
  e: 'Shaphel', H: 'Hophal', i: 'Ithpeel', t: 'Hishtaphel', v: 'Ishtaphel', w: 'Hithaphel', o: 'Polel', z: 'Ithpoel',
  r: 'Hithpolel', f: 'Hithpalpel', b: 'Hephal', c: 'Tiphel', m: 'Poel', l: 'Palpel', L: 'Ithpalpel', O: 'Ithpolel',
  G: 'Ittaphal',
};
const HEB_VERB_FORM: Record<string, string> = {
  p: 'perfect', q: 'sequential perfect', i: 'imperfect', w: 'sequential imperfect', h: 'cohortative', j: 'jussive',
  v: 'imperative', r: 'active participle', s: 'passive participle', a: 'infinitive absolute', c: 'infinitive construct',
  u: 'imperfect after "and"',
};
const PERSON: Record<string, string> = { '1': '1st person', '2': '2nd person', '3': '3rd person' };
const GENDER: Record<string, string> = { m: 'masculine', f: 'feminine', b: 'both genders', c: 'common gender', n: 'neuter' };
const NUMBER: Record<string, string> = { s: 'singular', p: 'plural', d: 'dual' };
const STATE: Record<string, string> = { a: 'absolute', c: 'construct', d: 'determined' };

function pgn(s: string, i: number): string[] {
  const out: string[] = [];
  if (PERSON[s[i]]) out.push(PERSON[s[i]]);
  else i--;
  if (GENDER[s[i + 1]]) out.push(GENDER[s[i + 1]]);
  if (NUMBER[s[i + 2]]) out.push(NUMBER[s[i + 2]]);
  return out;
}

function hebSegment(seg: string, aramaic: boolean): string {
  const t = seg[0];
  const rest = seg.slice(1);
  switch (t) {
    case 'A': {
      const kind = { a: 'adjective', c: 'number', g: 'gentilic adjective', o: 'ordinal number' }[rest[0]] ?? 'adjective';
      return [kind, GENDER[rest[1]], NUMBER[rest[2]], STATE[rest[3]]].filter(Boolean).join(', ');
    }
    case 'C':
      return 'conjunction';
    case 'c':
      return 'conjunction (vav)';
    case 'D':
      return 'adverb';
    case 'N': {
      const kind = { c: 'noun', g: 'gentilic noun', p: 'proper noun', x: 'noun' }[rest[0]] ?? 'noun';
      if (rest[0] === 'p') return 'proper name';
      return [kind, GENDER[rest[1]], NUMBER[rest[2]], STATE[rest[3]]].filter(Boolean).join(', ');
    }
    case 'P': {
      const kind = { d: 'demonstrative pronoun', f: 'indefinite pronoun', i: 'interrogative pronoun', p: 'personal pronoun', r: 'relative pronoun' }[rest[0]] ?? 'pronoun';
      return [kind, ...pgn(rest, 1)].join(', ');
    }
    case 'R':
      return rest[0] === 'd' ? 'preposition with article' : 'preposition';
    case 'S': {
      if (rest[0] === 'd') return 'directional ending';
      if (rest[0] === 'h' || rest[0] === 'n') return 'paragogic ending';
      return ['pronoun suffix', ...pgn(rest, 1)].join(', ');
    }
    case 'T': {
      const kind = { a: 'affirmation particle', d: 'definite article', e: 'exhortation particle', i: 'interrogative particle', j: 'interjection', m: 'demonstrative particle', n: 'negative particle', o: 'object marker', r: 'relative particle' }[rest[0]] ?? 'particle';
      return kind;
    }
    case 'V': {
      const stem = (aramaic ? ARA_STEM : HEB_STEM)[rest[0]] ?? 'verb';
      // TAHOT marks a cohortative ("let me…", "let us…") as "c" with a person.
      const form = rest[1] === 'c' && PERSON[rest[2]] ? 'cohortative' : (HEB_VERB_FORM[rest[1]] ?? '');
      const parts = [`verb, ${stem}${form ? ' ' + form : ''}`];
      if (rest[1] === 'r' || rest[1] === 's') {
        if (GENDER[rest[2]]) parts.push(GENDER[rest[2]]);
        if (NUMBER[rest[3]]) parts.push(NUMBER[rest[3]]);
        if (STATE[rest[4]]) parts.push(STATE[rest[4]]);
      } else if (rest[1] !== 'a' && (rest[1] !== 'c' || PERSON[rest[2]])) {
        parts.push(...pgn(rest, 2));
      }
      return parts.join(', ');
    }
    default:
      return seg;
  }
}

const GK_CASE: Record<string, string> = { N: 'nominative', G: 'genitive', D: 'dative', A: 'accusative', V: 'vocative' };
const GK_NUM: Record<string, string> = { S: 'singular', P: 'plural' };
const GK_GEN: Record<string, string> = { M: 'masculine', F: 'feminine', N: 'neuter' };
/** Whose it is, for possessive pronouns ("S-1SNSF" = my, of a feminine noun). */
const GK_OWNER: Record<string, string> = { '1S': 'my', '1P': 'our', '2S': 'your (one person)', '2P': 'your (more than one)' };
const GK_TENSE: Record<string, string> = { P: 'present', I: 'imperfect', F: 'future', A: 'aorist', R: 'perfect', L: 'pluperfect', X: 'no tense stated' };
const GK_VOICE: Record<string, string> = { A: 'active', M: 'middle', P: 'passive', E: 'middle or passive', D: 'middle deponent', O: 'passive deponent', N: 'middle or passive deponent', X: '' };
const GK_MOOD: Record<string, string> = { I: 'indicative', S: 'subjunctive', O: 'optative', M: 'imperative', N: 'infinitive', P: 'participle', R: 'imperative participle' };
const GK_POS: Record<string, string> = {
  A: 'adjective', C: 'reciprocal pronoun', CONJ: 'conjunction', COND: 'conditional', D: 'demonstrative pronoun', F: 'reflexive pronoun',
  I: 'interrogative pronoun', K: 'correlative pronoun', N: 'noun', P: 'personal pronoun', PREP: 'preposition', PRT: 'particle',
  Q: 'correlative pronoun', R: 'relative pronoun', S: 'possessive pronoun', T: 'article', X: 'indefinite pronoun', ADV: 'adverb',
  INJ: 'interjection', HEB: 'Hebrew word', ARAM: 'Aramaic word', V: 'verb',
};

function cng(s: string): string[] {
  return [GK_CASE[s[0]], GK_NUM[s[1]], GK_GEN[s[2]]].filter(Boolean) as string[];
}

function greek(code: string): string {
  const [pos, a, b, c] = code.split('-');
  const name = GK_POS[pos] ?? code;
  if (pos === 'V' && a) {
    const second = a.startsWith('2');
    const t = second ? a.slice(1) : a;
    const tense = (second ? '2nd ' : '') + (GK_TENSE[t[0]] ?? '');
    const parts = [`verb, ${[tense, GK_VOICE[t[1]], GK_MOOD[t[2]]].filter(Boolean).join(' ')}`];
    if (b) {
      if (/^[123]/.test(b)) parts.push(`${PERSON[b[0]]}, ${GK_NUM[b[1]] ?? ''}`.replace(/, $/, ''));
      else parts.push(...cng(b));
    }
    return parts.join(', ');
  }
  const parts = [name];
  for (const x of [a, b, c]) {
    if (!x) continue;
    if (/^[123][SP]$/.test(x)) parts.push(PERSON[x[0]], GK_NUM[x[1]]);
    else if (/^[123][SP][NGDAV][SP][MFN]?$/.test(x)) parts.push(GK_OWNER[x.slice(0, 2)], ...cng(x.slice(2)));
    else if (/^[123][NGDAV][SP][MFN]$/.test(x)) parts.push(PERSON[x[0]], ...cng(x.slice(1)));
    else if (/^[123][NGDAV][SP]$/.test(x)) parts.push(PERSON[x[0]], ...cng(x.slice(1)));
    else if (/^[NGDAV][SP][MFN]?$/.test(x)) parts.push(...cng(x));
    else if (x === 'P') parts[0] = 'proper name';
    else if (x === 'C') parts.push('comparative');
    else if (x === 'S') parts.push('superlative');
    else if (x === 'L') parts.push('place');
    else if (x === 'T') parts.push('title');
  }
  return parts.join(', ');
}

/** Plain-English description of a grammar code. Unknown codes are returned as-is.
 *  `lang` is the word's language (H, A or G); the code alone is ambiguous
 *  (Greek adjectives start with "A", like Aramaic codes). */
export function describeMorph(code: string, lang: string): string {
  if (!code) return '';
  const c = code.trim();
  if (lang === 'H' || lang === 'A') {
    const aramaic = c[0] === 'A';
    return c
      .slice(1)
      .split('/')
      .filter(Boolean)
      // "Rd" before a pronoun ending is a preposition: the article can't take one.
      .map((s, i, all) => (s === 'Rd' && all[i + 1]?.[0] === 'S' ? 'preposition' : hebSegment(s, aramaic)))
      .join(' + ');
  }
  // Crasis forms combine two words: "CONJ + G1565=D".
  return c
    .split(' + ')
    .map((part) => greek(part.includes('=') ? part.split('=')[1] : part))
    .join(' + ');
}
