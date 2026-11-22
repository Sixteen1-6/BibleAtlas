// Christian writers: what Christian writers of the past wrote about a verse,
// in their own words. At Deep only, and their words show only once the reader
// has finished the commentary notice (ui/commentary): the Church Fathers on
// the Gospels (as Thomas Aquinas gathered them in the Catena Aurea), John
// Calvin's New Testament commentaries, Matthew Henry's complete commentary
// (finished from Romans on by other ministers) and his Concise Commentary,
// and John Wesley's Explanatory Notes, all public domain. Never shown as the app's own claim, or as Scripture.
//
// The line, under a verse one of them wrote about:
//   "Christian writers: the Church Fathers, Matthew Henry and John Wesley"
//
// The panel: each writer's notes, oldest first, folded where long, with places
// elsewhere to read more on the verse. Opened by a link before the notice, it
// says who wrote about the verse, with "Show what they wrote". The small index
// loads with the reader's first move; a verse's notes (a file of about 20 KB
// compressed) and the panel's code load as soon as its line shows to a reader
// who has finished the commentary notice, else when the panel opens. Built by crates/atlas-cli/src/extra_voices.rs.

import type { ComponentType } from 'preact';
import { accepted } from '../commentary/state';
import { loadJson } from './data';
import { readerHere } from './first-move';
import { refName } from './kit';
import { type PanelProps, defineExtra } from './types';
import { type Data, SOURCE, barnesOf, fullOf, kdOf, load, lutherOf, partOf, worksOn, writersLine } from './voices/model';
import { Waiting, lazyCode, useCode } from './lazy';

type PanelType = ComponentType<PanelProps<Data>>;

/** Once the line shows under a verse, and the reader has finished the
 * commentary notice, fetch that verse's notes and the panel's code ahead, so
 * the panel opens without a wait. Both are kept, so this costs nothing twice. */
function warm(d: Data, verse: number): void {
  if (!accepted.value) return;
  for (const file of [partOf(d, verse), fullOf(d, verse), kdOf(d, verse), barnesOf(d, verse), lutherOf(d, verse)]) if (file) loadJson(d.a, file).catch(() => {});
  loadPanel().catch(() => {});
}

/** The panel's code, fetched the first time a reader opens it. */
const loadPanel = lazyCode((): Promise<PanelType> => import('./voices/Panel').then((m) => m.Panel));

function Panel(props: PanelProps<Data>) {
  const code = useCode(loadPanel);
  const C = code.got;
  return C ? <C {...props} /> : <Waiting code={code} text="Loading what they wrote…" />;
}

export default defineExtra<Data>({
  id: 'voices',
  order: 55,
  title: 'Christian writers',
  level: 'deep',
  async load(a) {
    await readerHere('voices');
    return load(a);
  },
  note(verse, d) {
    const ws = worksOn(d, verse);
    if (ws.length) warm(d, verse);
    return ws.length ? `Christian writers: ${writersLine(d, verse, ws)}` : null;
  },
  Panel,
  commentary: true,
  closed(verse, d, a) {
    const who = writersLine(d, verse, worksOn(d, verse));
    return { line: `${who.charAt(0).toUpperCase()}${who.slice(1)} wrote about ${refName(a, verse)}.`, button: 'Show what they wrote', source: SOURCE };
  },
});
