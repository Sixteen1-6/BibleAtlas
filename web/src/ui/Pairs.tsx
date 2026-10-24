// Color pairs for word-by-word mode: each original word (or prefix, stem and
// suffix of one) shares a color with the BSB English words it became. A
// "word for word" line shows the same glosses in the original order, so you
// can see how the translator moved them around. Hovering or tapping a pair
// lights it up across all three lines.

import { signal } from '@preact/signals';
import { PAIR_COLORS, type VerseAlign, englishParts, piecesOf } from '../data/align';
import { FLAG, type VerseRow, type WordRow } from '../data/text';
import * as S from '../state';

function storedFlag(key: string, fallback: boolean) {
  let initial = fallback;
  try {
    const v = localStorage.getItem(key);
    if (v === '0' || v === '1') initial = v === '1';
  } catch {
    // Storage blocked (private window): fall back to the default.
  }
  const s = signal(initial);
  s.subscribe((v) => {
    try {
      localStorage.setItem(key, v ? '1' : '0');
    } catch {
      // Ignore: the choice just won't be remembered.
    }
  });
  return s;
}

/** Color pairs on or off in word-by-word mode. Remembered per browser. */
export const pairsOn = storedFlag('atlas.pairs', true);

type Spot = { v: number; g: number } | null;
/** Pair chosen by a tap (stays until tapped again). */
const focus = signal<Spot>(null);
/** Pair under the mouse pointer. */
const hover = signal<Spot>(null);

function activeIn(v: number): number | null {
  const h = hover.value;
  if (h && h.v === v) return h.g;
  const f = focus.value;
  return f && f.v === v ? f.g : null;
}

function pairClass(g: number, active: number | null): string {
  if (g < 0) return ' pair-none';
  let c = ` pair pair-${g % PAIR_COLORS}`;
  if (active !== null) c += g === active ? ' pair-on' : ' pair-off';
  return c;
}

function handlers(v: number, g: number) {
  if (g < 0) return {};
  return {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hover.value = { v, g };
    },
    onPointerLeave: () => {
      if (hover.value?.v === v && hover.value.g === g) hover.value = null;
    },
    onClick: () => {
      const f = focus.value;
      focus.value = f && f.v === v && f.g === g ? null : { v, g };
    },
  };
}

/** The BSB verse with each English word colored by its pair. */
export function PairedEnglish({ v, text, al }: { v: number; text: string; al: VerseAlign }) {
  const active = activeIn(v);
  return (
    <>
      {englishParts(text).map((p, i) => {
        if (p.word < 0) return p.text;
        const g = al.e[p.word] ?? -1;
        return (
          <span key={i} class={`ew${pairClass(g, active)}`} {...handlers(v, g)}>
            {p.text}
          </span>
        );
      })}
    </>
  );
}

function cellClass(w: WordRow, hit: boolean, kin: boolean): string {
  let c = 'w';
  if (w[5] & FLAG.variant) c += ' var';
  if (w[5] & FLAG.otherEditions) c += ' other';
  if (hit) c += ' hit';
  if (kin) c += ' shared';
  return c;
}

/** "Word for word" line plus the interlinear cells, both colored by pair. */
export function PairedWords({ v, row, al, hebrew, other, studyRoot, kin }: { v: number; row: VerseRow; al: VerseAlign; hebrew: boolean; other: boolean; studyRoot: number; kin: Set<number> | null }) {
  const active = activeIn(v);
  const lang = hebrew ? 'he' : 'gr';
  const shown = row[1].map((w, i) => ({ w, i, pieces: piecesOf(al.w[i], w[0], w[2]) })).filter(({ w }) => other || !(w[5] & FLAG.otherEditions));
  return (
    <>
      <div class="literal" aria-label="Word for word, in the original order">
        <span class="literal-label">Word for word</span>
        {shown.map(({ i, pieces }) => (
          <span key={i} class="lw">
            {pieces.map((p, k) => (
              <span key={k} class={`lp${pairClass(p[2], active)}`} {...handlers(v, p[2])}>
                {p[1]}
              </span>
            ))}
          </span>
        ))}
      </div>
      <div class={`inter ${lang}`}>
        {shown.map(({ w, i, pieces }) => (
          <button key={i} class={`cell ${lang} ${cellClass(w, w[3] === studyRoot, !!kin?.has(w[3]))}`} data-lr={w[3] >= 0 ? w[3] : undefined} onClick={() => w[3] >= 0 && S.openRoot(w[3], v, i)} title={grammarTip(w[4], hebrew)}>
            <span class="o" lang={hebrew ? 'hbo' : 'grc'}>
              {pieces.map((p, k) => (
                <span key={k} class={`op${pairClass(p[2], active)}`} {...handlers(v, p[2])}>
                  {p[0]}
                </span>
              ))}
            </span>
            <span class="t">{w[1]}</span>
            <span class="g">
              {pieces.map((p, k) => (
                <span key={k} class={`gp${pairClass(p[2], active)}`} {...handlers(v, p[2])}>
                  {p[1]}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

/** A credit's name that opens its card on the Sources shelf. */
export function CardLink({ work, children }: { work: string; children: preact.ComponentChildren }) {
  return (
    <button type="button" class="card-link" style={CARD_LINK} onClick={() => S.openSources(work)} title="About this source, on the Sources shelf">
      {children}
    </button>
  );
}
const CARD_LINK = { padding: 0, border: 0, background: 'none', font: 'inherit', color: 'var(--link)', textDecoration: 'underline', cursor: 'pointer' };

// The dates of the pinned copies (sources.json): STEPBible's commit 1f3423d4
// is its release of 5 October 2026; Clear's commit c99bd0ae is of 11 May 2026,
// pinned here on 8 October 2026 (UTC).
const STEP_VERSION = '5 Oct 2026';
const CLEAR_TREE = 'https://github.com/Clear-Bible/Alignments/tree/c99bd0ae6946775f932517656308ca19fc706921';

/** Who wrote the English under each word, and what its brackets mean. The
 *  marks are STEPBible's (TAHOT and TAGNT): "Words in <angle brackets> are in
 *  the Hebrew but are best not included in a translation. Words in [square
 *  brackets] aren't in the Hebrew but are implied". TAGNT's English is "Based
 *  on Berean Study Bible, with permission, as at 1-July-2019 and adapted". */
export function WordsNote({ hebrew }: { hebrew: boolean }) {
  return (
    <p class="pairs-note">
      Word for word: <CardLink work={hebrew ? 'tahot' : 'tagnt'}>STEPBible</CardLink>’s English for each word (Tyndale House, version of {STEP_VERSION})
      {hebrew ? '' : ', based on the Berean Study Bible as it stood in July 2019'}. [ ] words added for sense; &lt; &gt; a word English does not translate
      {hebrew ? ', such as <obj.>, the Hebrew sign of the object' : ''}.{S.TOUCH ? '' : ' Point to a word for its grammar, from STEPBible’s key.'}
    </p>
  );
}

export function PairsNote({ hebrew, leftOut }: { hebrew: boolean; leftOut?: number }) {
  return (
    <p class="pairs-note">
      Matching colors show which English words came from which {hebrew ? 'Hebrew' : 'Greek'} word. <span class="pair-none">Gray</span> words have no partner: the translator added them, left
      the original word untranslated, or the alignment was made for an older wording of the BSB and is left out. Tap a word to follow it.{' '}
      <span class="muted">
        Links made by hand by the Berean Bible team (Greek) and BiblioNexus (Hebrew), published by{' '}
        <a href={CLEAR_TREE} target="_blank" rel="noopener" title="The alignment files at the version this app uses (GitHub)">
          Clear Bible / Biblica
        </a>{' '}
        (CC BY 4.0). Version of 11 May 2026, read 8 Oct 2026.
        {leftOut ? ` The ${leftOut.toLocaleString('en-US')} links the app could not place are left out.` : ''}
      </span>
    </p>
  );
}

// ---------------------------------------------------------------- grammar in words
//
// The grammar codes under each word ("HTd/Ncmpa", "V-AAI-3S") put in words, with
// the words of STEPBible's own keys: TEHMC for Hebrew and Aramaic and TEGMC for
// Greek ("Translators Expansion of ... Morphology Codes", in STEPBible-Data at
// the pinned commit, CC BY 4.0). Each part is read the way the keys define its
// letters; where a key spells a word two ways the spelling of its own notes is
// used ("Intensive / Resultative / Transitive"). Checked on 21 October 2026
// against the keys' phrase for every code the app shows: the same words for
// 734 of 742 Hebrew and Aramaic parts and 1,098 of 1,167 Greek codes; the rest
// are places where a key's phrase leaves out or repeats one of its own fields.

/** A word's grammar in words, for its tooltip; nothing for a code the keys do not cover. */
export function grammarTip(code: string, hebrew: boolean): string | undefined {
  return (hebrew ? hebrewGrammar(code) : greekGrammar(code)) ?? undefined;
}

const PERSON: Record<string, string> = { '1': 'First', '2': 'Second', '3': 'Third' };
const H_GENDER: Record<string, string> = { m: 'Masculine', f: 'Feminine', b: 'Either gender', c: 'Either gender' };
const H_NUMBER: Record<string, string> = { s: 'Singular', p: 'Plural', d: 'Dual' };
const H_STATE: Record<string, string> = { a: 'Absolute', c: 'Construct', d: 'Definite' };
const INT = 'Intensive/resultative/transitive';
const CAUS = 'Causative/declarative';
const REFL = 'Reflexive/iterative';
/** Verb stems, by language letter (H or A) and stem letter. */
const H_STEM: Record<string, string> = {
  Hq: 'Qal (Simple, Active)', HN: 'Niphal (Simple, Passive)', Hp: `Piel (${INT}, Active)`, HP: `Pual (${INT}, Passive)`, HO: `Pual (${INT}, Passive)`,
  Hh: `Hiphil (${CAUS}, Active)`, HH: `Hophal (${CAUS}, Passive)`, Ht: `Hithpael (${INT}, ${REFL})`, Hu: `Hothpaal (${INT}, Passive)`,
  HD: `Nithpael (${INT}, Passive)`, Hc: `Tiphil (${CAUS}, Active)`, Hv: `Hishtaphel (${CAUS}, ${REFL})`,
  Aq: 'Peal (Simple, Active)', AQ: 'Peil (Simple, Passive)', Ap: `Pael (${INT}, Active)`, AP: `Pual (${INT}, Passive)`, Aa: `Aphel (${CAUS}, Active)`,
  Ah: `Haphel (${CAUS}, Active)`, AH: `Hophal (${CAUS}, Passive)`, Ae: `Shaphel (${CAUS}, Active)`, Ai: `Hitpeel (Simple, ${REFL})`,
  AM: `Hitpaal (${INT}, ${REFL})`, Au: `Hitpael (${INT}, Passive)`, Av: `Ishtaphel (${CAUS}, ${REFL})`,
};
/** Verb forms that take a person, gender and number. */
const H_FINITE: Record<string, string> = {
  p: 'Perfect (Past/present Indicative)', q: 'Consecutive Perfect (Future/present Indicative)', i: 'Imperfect (Future/present Indicative/jussive)',
  w: 'Consecutive Imperfect (Past/present Indicative)', n: 'Imperfect (Future/present Indicative)', u: 'Conjunction+Imperfect (Future/present Indicative)',
  j: 'Imperfect (Future/present Jussive)', c: 'Imperfect (Future/present Cohortative)', h: 'Imperfect (Future/present Cohortative)', v: 'Imperative',
};
const H_PARTICLE: Record<string, string> = {
  a: 'Definite article (Aramaic)', d: 'Definite article (Hebrew)', c: 'Conditional Particle', i: 'Interrogative Particle', j: 'Interjection',
  m: 'Demonstrative Particle', n: 'Negative Particle', o: 'Object indicator', r: 'Relative Particle',
};
const H_PROPER: Record<string, string> = { m: 'Masculine individual', f: 'Feminine individual', l: 'Location', t: 'Title' };
const H_ADJ: Record<string, string> = { a: 'Adjective', c: 'Numerical Adjective', o: 'Numerical position Adjective', g: 'Gentilic Adjective' };

const pgn = (s: string) => (PERSON[s[0]] && H_GENDER[s[1]] && H_NUMBER[s[2]] ? `${PERSON[s[0]]} ${H_NUMBER[s[2]]} ${H_GENDER[s[1]]}` : null);
const gns = (s: string) => (H_GENDER[s[0]] && H_NUMBER[s[1]] && H_STATE[s[2]] ? `${H_NUMBER[s[1]]} ${H_GENDER[s[0]]}, ${H_STATE[s[2]]}` : null);

/** One part of a Hebrew or Aramaic code, such as "Ncmpa", in words. */
function hebrewPart(lang: string, p: string): string | null {
  const f = p[0];
  const rest = p.slice(1);
  if (f === 'C' && !rest) return 'Conjunction';
  if (f === 'c' && !rest) return 'Consecutive Conjunction';
  if (f === 'D' && !rest) return 'Adverb';
  if (f === 'R') return rest === '' ? 'Preposition' : rest === 'd' ? 'Preposition (Definite)' : null;
  if (f === 'T') return rest.length === 1 ? H_PARTICLE[rest] ?? null : null;
  if (f === 'S') {
    if (rest === 'd') return 'Directional Suffix';
    if (rest === 'h') return 'Paragogic Hé';
    if (rest === 'n') return 'Paragogic Nun';
    const x = rest[0] === 'p' && rest.length === 4 ? pgn(rest.slice(1)) : null;
    return x && `Suffix (${x})`;
  }
  if (f === 'P') {
    if (rest === 'i') return 'Interrogative Pronoun';
    const x = rest[0] === 'p' && rest.length === 4 ? pgn(rest.slice(1)) : null;
    return x && `Pronoun (${x})`;
  }
  if (f === 'N') {
    if (rest[0] === 'p' && rest.length === 2) return H_PROPER[rest[1]] ? `Proper Noun (${H_PROPER[rest[1]]})` : null;
    const x = rest.length === 4 ? gns(rest.slice(1)) : null;
    if (!x) return null;
    return rest[0] === 'c' ? `Noun (${x})` : rest[0] === 'g' ? `Noun (Gentilic, ${x})` : rest[0] === 't' ? `Noun (Title, ${x})` : null;
  }
  if (f === 'A') {
    const x = rest.length === 4 ? gns(rest.slice(1)) : null;
    return x && H_ADJ[rest[0]] ? `${H_ADJ[rest[0]]} (${x})` : null;
  }
  if (f === 'V') {
    const stem = H_STEM[lang + rest[0]];
    const form = rest[1];
    const tail = rest.slice(2);
    if (!stem || !form) return null;
    if ((form === 'a' || form === 'c') && tail.length === 1 && H_STATE[tail]) return `Verb: ${stem} Infinitive ${H_STATE[tail]}`;
    if ((form === 'r' || form === 's') && tail.length === 3) {
      // A passive participle makes an active stem passive (the key's notes).
      const x = gns(tail);
      return x && (form === 'r' ? `Verb: ${stem} Participle (${x})` : `Verb: ${stem.replace(', Active)', ', Passive)')} Participle passive (${x})`);
    }
    const x = tail.length === 3 ? pgn(tail) : null;
    if (!x || !H_FINITE[form]) return null;
    // In the first person an imperfect may be a cohortative ("let me"), elsewhere a jussive.
    const fm = tail[0] === '1' && form === 'i' ? 'Imperfect (Future/present Indicative/cohortative)' : tail[0] === '1' && form === 'j' ? H_FINITE.c : H_FINITE[form];
    return `Verb: ${stem} ${fm} ${x}`;
  }
  return null;
}

/** A whole Hebrew or Aramaic code ("HTd/Ncmpa": the first letter is the
 *  language, and "/" joins the parts of one word) in words. */
function hebrewGrammar(code: string): string | null {
  const lang = code[0];
  if (lang !== 'H' && lang !== 'A') return null;
  const parts = code.slice(1).split('/').filter(Boolean);
  if (!parts.length) return null;
  const words = parts.map((p) => hebrewPart(lang, p));
  return words.every(Boolean) ? (lang === 'A' ? 'Aramaic: ' : '') + words.join(' + ') : null;
}

const G_CASE: Record<string, string> = { N: 'Nominative', G: 'Genitive', D: 'Dative', A: 'Accusative', V: 'Vocative' };
const G_NUMBER: Record<string, string> = { S: 'Singular', P: 'Plural' };
const G_GENDER: Record<string, string> = { M: 'Masculine', F: 'Feminine', N: 'Neuter' };
const G_PERSON: Record<string, string> = { '1': '1st', '2': '2nd', '3': '3rd' };
const G_TENSE: Record<string, string> = {
  P: 'Present', I: 'Imperfect', F: 'Future', A: 'Aorist', R: 'Perfect', L: 'Pluperfect', X: 'indefinite tense',
  '2P': '2nd Present', '2F': '2nd Future', '2A': '2nd Aorist', '2R': '2nd Perfect', '2L': '2nd Pluperfect',
};
const G_VOICE: Record<string, string> = {
  A: 'Active', M: 'Middle', P: 'Passive', E: 'Middle or Passive', D: 'Middle Deponent', O: 'Passive Deponent', N: 'Middle or Passive Deponent', Q: 'impersonal active', X: 'indefinite voice',
};
const G_MOOD: Record<string, string> = { I: 'Indicative', S: 'Subjunctive', O: 'Optative', M: 'Imperative', N: 'Infinitive', P: 'Participle' };
const G_WORD: Record<string, string> = {
  CONJ: 'Conjunction', COND: 'Conjunction', PREP: 'Preposition', ADV: 'Adverb', PRT: 'Particle or Disjunctive Particle', INJ: 'Interjection',
  ARAM: 'Aramaic transliterated word', HEB: 'Hebrew transliterated word',
};
const G_DECLINED: Record<string, string> = {
  N: 'Noun', A: 'Adjective', T: 'Definite article', P: 'Personal pronoun', R: 'Relative pronoun', C: 'Reciprocal pronoun', D: 'Demonstrative pronoun', K: 'Correlative pronoun',
  I: 'Interrogative pronoun', X: 'Indefinite pronoun', Q: 'Correlative or Interrogative pronoun', F: 'Reflexive pronoun', S: 'Possessive pronoun',
};
const G_EXTRA: Record<string, string> = {
  C: 'Comparative', S: 'Superlative', N: 'Negative', I: 'Interrogative', P: 'Individual', L: 'Location', G: 'Gentilic', LG: 'Location Gentilic', PG: 'Person Gentilic',
  TG: 'Title Gentilic', NUI: 'Numeral', ATT: 'Attic Greek form', HEB: 'Transcribed from Hebrew', ARAM: 'Transcribed from Aramaic', ABB: 'Abbreviated', AP: 'Apocopated form',
  A: 'Aeolic', IRR: 'Irregular form', LI: 'Indeclinable Letter',
};

const cng = (s: string) => (s.length === 3 && G_CASE[s[0]] && G_NUMBER[s[1]] && G_GENDER[s[2]] ? `${G_CASE[s[0]]} ${G_NUMBER[s[1]]} ${G_GENDER[s[2]]}` : null);

/** One Greek code, "V-2AAI-3S", in words. */
function greekOne(code: string): string | null {
  const [head, ...rest] = code.split('-');
  // C compares on adjectives and adverbs; on other words it marks a contracted form.
  const describes = head === 'A' || head === 'ADV';
  const extra = (list: string[], verb: boolean) => {
    const out: string[] = [];
    for (const x of list) {
      const w = x === 'T' ? (verb ? 'Transitive' : 'Title') : x === 'C' && !describes ? 'Contracted form' : G_EXTRA[x];
      if (!w) return null;
      out.push(w);
    }
    return out;
  };
  if (G_WORD[head]) {
    const e = extra(rest, false);
    if (!e) return null;
    if (head === 'PRT' && (e[0] === 'Negative' || e[0] === 'Interrogative')) return [`${e[0]} Particle`, ...e.slice(1)].join(' ');
    if (head === 'ADV' && e[0] === 'Negative') return ['Adverb or adverb and particle combined', ...e].join(' ');
    return [G_WORD[head], ...e].join(' ');
  }
  if (head === 'V') {
    const m = rest[0]?.match(/^(2?[A-Z])([A-Z])([A-Z])$/);
    if (!m || !G_TENSE[m[1]] || !G_VOICE[m[2]] || !G_MOOD[m[3]]) return null;
    const base = `Verb ${G_TENSE[m[1]]} ${G_VOICE[m[2]]} ${G_MOOD[m[3]]}`;
    let tail = rest.slice(1);
    let words: string[] = [];
    if (m[3] === 'P') {
      const x = tail[0] ? cng(tail[0]) : null;
      if (!x) return null;
      words = [x];
      tail = tail.slice(1);
    } else if (m[3] !== 'N') {
      const pn = tail[0]?.match(/^([123])([SP])$/);
      if (!pn) return null;
      words = [`${G_PERSON[pn[1]]} ${G_NUMBER[pn[2]]}`];
      tail = tail.slice(1);
    }
    const e = extra(tail, true);
    return e ? [base, ...words, ...e].join(' ') : null;
  }
  if (head === 'N' && rest[0] === 'PRI') return 'Indeclinable Proper Noun';
  if (head === 'N' && rest[0] === 'OI') return 'Indeclinable Noun of Other type';
  if (head === 'N' && rest[0] === 'LI') return 'Indeclinable Letter';
  if (head === 'A' && rest[0] === 'NUI') {
    const e = extra(rest.slice(1), false);
    return e ? ['Adjective Indeclinable Numeral', ...e].join(' ') : null;
  }
  const fn = G_DECLINED[head];
  if (!fn || !rest[0]) return null;
  let first = rest[0];
  let person = '';
  if (head === 'S') {
    // A possessive gives the owner's person and number, then its own case, number and gender.
    const s = first.match(/^([123])([SP])(.{3})$/);
    if (!s) return null;
    person = `${G_PERSON[s[1]]} ${G_NUMBER[s[2]]}`;
    first = s[3];
  } else if (/^[123]/.test(first)) {
    person = G_PERSON[first[0]];
    first = first.slice(1);
  }
  const x = first.length === 3 ? cng(first) : first.length === 2 && G_CASE[first[0]] && G_NUMBER[first[1]] ? `${G_CASE[first[0]]} ${G_NUMBER[first[1]]}` : null;
  if (!x) return null;
  const e = extra(rest.slice(1), false);
  return e ? [fn, person, x, ...e].filter(Boolean).join(' ') : null;
}

/** A Greek code in words. Words joined in one ("CONJ + G1437=COND") have a part each. */
function greekGrammar(code: string): string | null {
  const words = code.split(/ \+ G\d{4}[A-Za-z]?=/).map((p) => greekOne(p.trim()));
  return words.every(Boolean) ? words.join(' + ') : null;
}
