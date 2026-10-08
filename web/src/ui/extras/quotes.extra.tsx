// Quotations: where the New Testament quotes the Old.
//
// The line, under a verse it applies to:
//   New Testament  "Quoting Isaiah 40:3"
//   Old Testament  "Quoted in Matthew 3:3, Mark 1:3 and 2 more"
// At Study and Deep the echoes join in: "Echoing Psalm 110:1 and Daniel 7:13".
// Nothing shows under any other verse.
//
// The panel: the passages side by side in the BSB with the words they share
// marked, how closely each is quoted and how it is introduced; at Deep the
// Hebrew and Greek word by word, every other place that quotes the same words,
// and how each link was found. All of it comes from the Berean Standard Bible's
// own footnotes (crates/atlas-cli/src/extra_quotes.rs).

import './quotes.css';
import { levelAtLeast } from './level';
import { type Data, load } from './quotes/model';
import { Panel } from './quotes/Panel';
import { defineExtra } from './types';

export default defineExtra<Data>({
  id: 'quotes',
  order: 10,
  title: 'Quotations',
  load,
  note(verse, d) {
    return (levelAtLeast('study') ? d.study : d.simple).get(verse) ?? null;
  },
  Panel,
});
