// Prophecy and fulfilment: an Old Testament passage and the New Testament
// passage that fulfils it.
//
// The line, under a verse it applies to:
//   Old Testament  "Fulfilled in Matthew 1:23"
//   New Testament  "Fulfilling Isaiah 7:14"
// At every level it names the pairs the New Testament itself calls fulfilled
// ("This was to fulfill what was spoken through the prophet Isaiah"). At Deep,
// once the reader has finished the commentary notice, it adds the pairs only
// Christian writers name. The map draws each pair in green (ui/mapKinds.ts).
//
// The panel: the two passages side by side, the New Testament's own words,
// and at Deep the writers who state it, each in his own words. Built and
// checked by crates/atlas-cli/src/extra_prophecies.rs.

import './prophecies.css';
import { Panel } from './prophecies/Panel';
import { type Data, lineAt, load } from './prophecies/model';
import { type NoteLine, defineExtra } from './types';

let atlas: Parameters<typeof load>[0] | null = null;

export default defineExtra<Data>({
  id: 'prophecies',
  order: 11,
  title: 'Prophecy and fulfilment',
  async load(a) {
    atlas = a;
    return load(a);
  },
  note(verse, d): NoteLine | null {
    return atlas ? lineAt(atlas, d, verse) : null;
  },
  Panel,
});
