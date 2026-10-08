// The words two parallel passages share, by the same rules the build uses to
// line them up (crates/atlas-cli/src/extra_parallels.rs: STOP, english(),
// stem() and content()). Keep the two in step.

import { FLAG, type VerseRow, type WordRow } from '../../../data/text';

/** English words too common to count as shared. */
const STOP = new Set(
  (
    'a an the and or but if of to in on at by for with from into onto upon as is are was were be been being am ' +
    'do does did done have has had having i me my mine we us our ours you your yours he him his she her hers it ' +
    'its they them their theirs this that these those there here then than so not no nor yes all any each every ' +
    'some such who whom whose which what when where why how will would shall should may might can could must also ' +
    'just very only even up down out over under again about against between through before after above below off ' +
    'own same too more most other others both few once because while until unto o oh let lets said says say one two'
  ).split(' '),
);

/** A word reduced to a form its plural, past and -ing forms share: "kings"
 * and "king", "loved" and "love", "cities" and "city". */
export function stem(w: string): string {
  let s = w;
  if (s.length >= 5 && s.endsWith('ies')) s = `${s.slice(0, -3)}y`;
  else if (s.length >= 4 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  if (s.length >= 5 && s.endsWith('ied')) s = `${s.slice(0, -3)}y`;
  else if (s.length >= 6 && s.endsWith('ing')) s = s.slice(0, -3);
  else if (s.length >= 5 && s.endsWith('ed')) s = s.slice(0, -2);
  if (s.length >= 4 && s.endsWith('e')) s = s.slice(0, -1);
  return s;
}

/** The English words of a text that can count as shared, each stemmed. */
export function englishKeys(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[ʼ’]/g, "'")
    .replace(/'s/g, '')
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

/** A verse's English in pieces: words (letters, with any apostrophes inside)
 * and what lies between them, in order. Words are at the odd places. */
export function pieces(text: string): string[] {
  return text.split(/([A-Za-zʼ’']+)/);
}

/** Whether a word counts towards the words two passages share: a verb, noun
 * or adjective. Hebrew codes look like "HC/Vqw3ms" (any part counts), Greek
 * ones like "V-AAI-3S". */
export function content(morph: string): boolean {
  const c0 = morph[0];
  const c1 = morph[1];
  if ((c0 === 'H' || c0 === 'A') && c1 !== undefined && ((c1 >= 'A' && c1 <= 'Z') || c1 === 'c')) {
    return morph
      .slice(1)
      .split('/')
      .some((seg) => seg[0] === 'V' || seg[0] === 'N' || seg[0] === 'A');
  }
  const head = morph.split(/[ -]/)[0];
  return head === 'V' || head === 'N' || head === 'A';
}

/** The original words a verse shows: the base text, or for a verse the base
 * text lacks but the BSB prints (Mark 16:9–20, John 7:53–8:11) the words of the
 * editions that have it. `other` says which. Each word comes with its place in
 * the verse. A verse the BSB leaves to a footnote shows none. */
export function shownWords(row: VerseRow): { words: [WordRow, number][]; other: boolean } {
  if (!row[0].trim()) return { words: [], other: false };
  const all = row[1].map((w, i) => [w, i] as [WordRow, number]);
  const base = all.filter(([w]) => !(w[5] & FLAG.otherEditions));
  return base.length ? { words: base, other: false } : { words: all, other: all.length > 0 };
}

/** The roots of a verse's verbs, nouns and adjectives, as the build counts them. */
export function contentRoots(row: VerseRow): Set<number> {
  const out = new Set<number>();
  for (const [w] of shownWords(row).words) if (w[3] >= 0 && content(w[4])) out.add(w[3]);
  return out;
}
