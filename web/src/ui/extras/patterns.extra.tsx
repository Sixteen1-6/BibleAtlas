// Patterns: at Deep, where Christian writers point out a pattern in how the
// Bible is told. Three kinds:
//   a detail that fits: a passage mentions something in passing that another
//     passage, written apart from it, explains (undesigned coincidences);
//   a key word: one word carried again and again through a passage;
//   a repeated scene: the same kind of scene told of different people.
// The line, under every verse a pattern shows, is its own short line:
//   "Why Herod spoke of Jesus to his servants"
// The panel shows the passages side by side, the key word marked in each
// verse it comes in with the build's count, or a scene's tellings part by
// part, then the writers who name it, each in his own words.
//
// The notes are drawn from Christian writers, so the panel stays closed until
// the reader finishes the commentary notice (ui/commentary). The data is
// written and checked by crates/atlas-cli/src/extra_patterns.rs.

import './patterns.css';
import { readerHere } from './first-move';
import { type Data, SOURCE, lineAt, load, notesAt } from './patterns/model';
import { type PanelProps, defineExtra } from './types';
import { Waiting, lazyCode, useCode } from './lazy';

const loadPanel = lazyCode(() => import('./patterns/Panel').then((m) => m.Panel));

function Panel(props: PanelProps<Data>) {
  const code = useCode(loadPanel);
  const P = code.got;
  return P ? <P {...props} /> : <Waiting code={code} />;
}

export default defineExtra<Data>({
  id: 'patterns',
  order: 15,
  title: 'Patterns',
  level: 'deep',
  async load(a) {
    await readerHere('patterns');
    return load(a);
  },
  note(verse, d) {
    return lineAt(d, verse);
  },
  Panel,
  commentary: 'verse',
  closed(verse, d) {
    const ns = notesAt(d, verse) ?? [];
    if (!ns.length && !lineAt(d, verse)) return null;
    return { line: 'Christian writers note a pattern here.', button: ns.length > 1 ? 'Show the notes' : 'Show the note', source: SOURCE };
  },
});
