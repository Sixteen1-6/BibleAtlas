// Study notes: what Bible scholars note about a verse and the passage around
// it, from the Aquifer Open Study Notes, a plain-English adaptation of the
// Tyndale Open Study Notes (both CC BY-SA 4.0). Always shown as these
// scholars' notes, never as the app's own claim.
//
// The line, from Study on (Simple keeps to the verse and its strongest links),
// under a verse with a note of its own (or on up to three verses with it):
//   "A study note on this verse", "A study note on verses 6–8"
// A verse with only a note on its wider passage gets one too: "A study note on
// verses 1–18". Nothing shows under any other verse.
//
// The panel: the verse's own notes in full, then the notes on its wider
// passage; verse names inside a note take the reader there. At Deep, where
// each note comes from. The small index loads
// with the reader's first move; each book's notes and the panel's code load the
// first time a reader opens the panel. Built by crates/atlas-cli/src/extra_notes.rs.

import type { ComponentType } from 'preact';
import { readerHere } from './first-move';
import { type Data, SOURCE, hits, load, nameFrom } from './notes/model';
import { type PanelProps, defineExtra } from './types';
import { Waiting, lazyCode, useCode } from './lazy';

type PanelType = ComponentType<PanelProps<Data>>;

/** The panel's code, fetched the first time a reader opens it. */
const loadPanel = lazyCode((): Promise<PanelType> => import('./notes/Panel').then((m) => m.Panel));

function Panel(props: PanelProps<Data>) {
  const code = useCode(loadPanel);
  const C = code.got;
  return C ? <C {...props} /> : <Waiting code={code} />;
}

export default defineExtra<Data>({
  id: 'notes',
  order: 50,
  title: 'Study notes',
  level: 'study',
  async load(a) {
    await readerHere('notes');
    return load(a);
  },
  note(verse, d) {
    const h = hits(d, verse);
    const first = h.own[0] ?? h.wide[0];
    if (!first) return null;
    const many = h.own.length > 1 && first === h.own[0] && h.own.every((x) => x.from === first.from && x.to === first.to);
    return `${many ? 'Study notes' : 'A study note'} on ${nameFrom(d.a, verse, first.from, first.to)}`;
  },
  Panel,
  commentary: true,
  closed(verse, d) {
    const h = hits(d, verse);
    const own = h.own[0];
    const where = own && nameFrom(d.a, verse, own.from, own.to);
    const line = !own
      ? `Bible scholars wrote ${h.wide.length > 1 ? 'notes' : 'a note'} on the passage around this verse.`
      : h.wide.length
        ? `Bible scholars wrote notes on ${where} and the passage around it.`
        : `Bible scholars wrote ${h.own.length > 1 ? 'notes' : 'a note'} on ${where}.`;
    return { line, button: h.own.length + h.wide.length > 1 ? 'Show the notes' : 'Show the note', source: SOURCE };
  },
});
