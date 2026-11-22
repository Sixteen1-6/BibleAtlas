// How it is built: at Deep, where a passage is shaped across verses or
// chapters (it opens and closes with the same words, comes back to a refrain,
// moves back and forth between two threads, or mirrors itself A B B' A'), or
// sets two people side by side across chapters or books.
//
// The line, under every verse of the structure (or of a foil's two sides), is
// its own short line:
//   "Psalm 8 opens and closes with the same words"
//   "Saul falling and David rising, across two books"
// The panel draws the parts as arcs on the small night sky, lists them as a
// ladder with the words they share underlined, puts a foil's two people in two
// columns, and gives the writers who name it, each in his own words.
//
// The notes are drawn from Christian writers, so the panel stays closed until
// the reader finishes the commentary notice (ui/commentary). The data is
// written and checked by crates/atlas-cli/src/extra_structure.rs.

import './structure.css';
import { readerHere } from './first-move';
import { startMapArcs } from './structure/MapArcs';
import { type Data, SOURCE, lineAt, load, notesAt } from './structure/model';
import { type PanelProps, defineExtra } from './types';
import { Waiting, lazyCode, useCode } from './lazy';

const loadPanel = lazyCode(() => import('./structure/Panel').then((m) => m.Panel));

function Panel(props: PanelProps<Data>) {
  const code = useCode(loadPanel);
  const P = code.got;
  return P ? <P {...props} /> : <Waiting code={code} />;
}

export default defineExtra<Data>({
  id: 'structure',
  order: 14,
  title: 'How it is built',
  level: 'deep',
  async load(a) {
    await readerHere('structure');
    const d = await load(a);
    startMapArcs(a, d);
    return d;
  },
  note(verse, d) {
    return lineAt(d, verse);
  },
  Panel,
  commentary: 'verse',
  closed(verse, d) {
    const ns = notesAt(d, verse) ?? [];
    if (!ns.length && !lineAt(d, verse)) return null;
    return { line: 'Christian writers note how this passage is built.', button: ns.length > 1 ? 'Show the notes' : 'Show the note', source: SOURCE };
  },
});
