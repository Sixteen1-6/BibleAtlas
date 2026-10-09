// Links the map draws in colors of their own for the selected verse: where the
// New Testament quotes the Old (and, from Study on, echoes it), and where the
// same event, song or law is told again. They come from the Quotations and
// Parallel passages extras, and show only once the reader's own lines for
// that verse have loaded their data, so the map never fetches anything and
// never draws a link the text does not also name.

import type { Atlas } from '../data/atlas';
import { atLeast } from '../depth';
import { dataState } from './extras/data';
import { type Data as Parallels, passageAt } from './extras/parallels/model';
import { type Data as Quotes, isNt, linksAt, otherSide } from './extras/quotes/model';
import { extraById } from './extras/registry';

export type LinkKind = 'quote' | 'echo' | 'parallel';

export interface KindLink {
  /** The other passage's first verse, where the arc lands. */
  to: number;
  kind: LinkKind;
}

/** At most this many of each kind, so a much-told passage stays readable. */
const MOST = 8;

function ready<D>(id: string): D | null {
  const x = extraById(id);
  const s = x ? dataState(x) : undefined;
  return s?.state === 'ready' ? (s.data as D) : null;
}

/** The colored links of verse `v`: quotations first, then echoes (Study and
 *  deeper, as in its line), then parallels. A passage is named once, under
 *  the first kind that names it. Reading this subscribes the caller to the
 *  extras' data and the reader's level. */
export function kindLinks(a: Atlas, v: number): KindLink[] {
  const out: KindLink[] = [];
  const seen = new Set<number>();
  const add = (to: number, kind: LinkKind, cap: number) => {
    if (to === v || seen.has(to) || out.filter((l) => l.kind === kind).length >= cap) return;
    seen.add(to);
    out.push({ to, kind });
  };
  const q = ready<Quotes>('quotes');
  if (q) {
    const nt = isNt(a, v);
    for (const l of linksAt(q, a, v, atLeast('study'))) add(otherSide(l, nt).from, l.echo ? 'echo' : 'quote', MOST);
  }
  const p = ready<Parallels>('parallels');
  if (p) {
    for (const id of p.at.get(v) ?? []) {
      const set = p.sets.get(id);
      if (!set) continue;
      const home = passageAt(set, v);
      set.passages.forEach((s, i) => i !== home && add(s.from, 'parallel', MOST));
    }
  }
  return out;
}
