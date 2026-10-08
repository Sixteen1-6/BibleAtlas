// Parallel passages: where the Bible tells the same event, teaching, song,
// list, law or prophecy more than once.
//
// The line, under a verse it applies to:
//   "Also told in Matthew 9:1–8 and Luke 5:17–26"     (the Gospels, the histories)
//   "Also sung in Psalm 18:1–50"                      (a song)
//   "Also given in Deuteronomy 5:6–21"                (a law)
// Nothing shows under any other verse.
//
// The panel lines the passages up verse by verse (two columns with room, one
// passage at a time on phones). Study underlines the words they share; Deep
// adds the Hebrew or Greek and how each set was found. The sets come from the
// Berean Standard Bible's section headings (crates/atlas-cli/src/extra_parallels.rs).

import './parallels.css';
import { type Data, load } from './parallels/model';
import { Panel } from './parallels/Panel';
import { defineExtra } from './types';

export default defineExtra<Data>({
  id: 'parallels',
  order: 20,
  title: 'Parallel passages',
  load,
  note(verse, d) {
    return d.lines.get(verse) ?? null;
  },
  Panel,
});
