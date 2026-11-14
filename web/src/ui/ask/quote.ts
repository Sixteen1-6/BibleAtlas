// Ask the Bible: the verse a question quotes ("in my king james it says suffer
// the little children to come unto me"), found by its words in the BSB, the
// KJV or the ASV. Gathering shows it first, as it does a verse cited by
// chapter and verse (./books), and the router opens no prepared answer that
// leaves it out.

import type { Atlas } from '../../data/atlas';
import { extraText, plainText } from '../../data/plain';
import { tokens } from '../../data/search';
import { STOP } from './words';

/** A quote is `run` words in a row of one verse, `words` of them more than
 * the small words every verse has, said by no more than `most` verses (the
 * same saying in two or three Gospels). */
export const QUOTE = { on: 1, route: 1, run: 6, words: 3, most: 3 };

/** Words too common in the Bible to tell one verse from another. */
const SMALL = new Set([...STOP, 'unto', 'thee', 'thou', 'thy', 'thine', 'ye', 'lord', 'god', 'said', 'say', 'saith', 'not', 'no', 'him', 'his', 'her', 'them', 'they', 'their', 'all', 'one', 'man', 'men', 'people', 'come', 'came', 'go', 'went', 'up', 'out', 'into', 'upon', 'there', 'then', 'also', 'even', 'now', 'let', 'made', 'make', 'day', 'house', 'son', 'sons', 'king', 'israel']);

function find(words: string[], w: string): number {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid] < w) lo = mid + 1;
    else hi = mid;
  }
  return words[lo] === w ? lo : -1;
}

/** The verses `question` quotes, the closest first, or none. Needs the BSB's
 * plain text loaded (../../data/plain); the KJV and ASV count once loaded. */
export function quotedVerses(a: Atlas, question: string): number[] {
  const texts = plainText();
  if (!QUOTE.on || !texts) return [];
  const m = tokens(question);
  if (m.length < QUOTE.run) return [];
  const big = m.map((w) => !SMALL.has(w) && !/^\d+$/.test(w));
  // Verses that hold enough of the question's words to hold a quote of it.
  const extra = extraText();
  const count = new Map<number, number>();
  const seen = new Set<string>();
  m.forEach((w, i) => {
    if (!big[i] || seen.has(w)) return;
    seen.add(w);
    const vs = new Set<number>();
    const k = find(a.englishWords, w);
    if (k >= 0) for (let p = a.eOff[k]; p < a.eOff[k + 1]; p++) vs.add(a.eVerse[p]);
    const more = extra?.index.get(w);
    if (more) for (const v of more) vs.add(v);
    for (const v of vs) count.set(v, (count.get(v) ?? 0) + 1);
  });
  const versions = [texts, ...(extra?.lines ?? [])];
  const found: { v: number; run: number }[] = [];
  for (const [v, c] of count) {
    if (c < QUOTE.words) continue;
    let best = 0;
    for (const ls of versions) {
      const t = ls[v] ? tokens(ls[v]) : [];
      // The longest run of the question's words in a row that the verse says
      // in the same order, with enough words of weight in it.
      let prev = new Array<number>(t.length + 1).fill(0);
      for (let i = 0; i < m.length; i++) {
        const row = new Array<number>(t.length + 1).fill(0);
        for (let j = 0; j < t.length; j++) {
          if (m[i] !== t[j]) continue;
          const run = prev[j] + 1;
          row[j + 1] = run;
          if (run >= QUOTE.run && run > best) {
            let weight = 0;
            for (let k = i - run + 1; k <= i; k++) if (big[k]) weight++;
            if (weight >= QUOTE.words) best = run;
          }
        }
        prev = row;
      }
    }
    if (best) found.push({ v, run: best });
  }
  if (!found.length) return [];
  const top = Math.max(...found.map((f) => f.run));
  const close = found.filter((f) => f.run >= top - 1);
  // Words many verses say ("i am the way") quote none of them.
  if (close.length > QUOTE.most) return [];
  return close.sort((x, y) => y.run - x.run || a.rank[y.v] - a.rank[x.v] || x.v - y.v).map((f) => f.v);
}
