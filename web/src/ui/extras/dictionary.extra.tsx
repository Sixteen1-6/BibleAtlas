// Old Bible dictionaries: entries in Easton's (1897) and Smith's (1884) Bible
// dictionaries, both public domain, that cite the selected verse. Study only:
// they are 19th-century reference works, so some of what they say is out of
// date, and the panel says so.
//
// The line, under a verse an entry cites:
//   "In old Bible dictionaries: Quails, Camp and 2 more"   (Exodus 16:13)
// and when even the first name will not fit: "In old Bible dictionaries: 3
// entries". Nothing shows under any other verse, or at Simple.
//
// The panel lists each entry (its name and dictionary); tapping one shows its
// text with the verses it names as links, and a way to read on in the
// dictionary on the Sources shelf. Deep adds how entries are matched to verses.
// Data: the Christian Classics Ethereal Library's editions, as NEUU's Bible
// Dictionary Dataset keeps them, built by crates/atlas-cli/src/extra_dictionary.rs
// (which also gives each listing its name in plain word order, "The Sea" for
// "Sea, The"). Only the list of verses loads for the line; each book's entries
// load the first time a verse in it is shown, and the panel's code the first
// time a reader opens it.

import './dictionary.css';
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { type Data, listingsAt, load, names } from './dictionary/model';
import { readerHere } from './first-move';
import { type PanelProps, defineExtra } from './types';

const LEAD = 'In old Bible dictionaries';
/** The line stays under this many characters. */
const MAX = 64;

type PanelType = ComponentType<PanelProps<Data>>;

let panel: Promise<PanelType> | null = null;

/** The panel's code, fetched the first time a reader opens it. */
function loadPanel(): Promise<PanelType> {
  if (!panel) {
    panel = import('./dictionary/Panel').then((m) => m.Panel);
    panel.catch(() => (panel = null));
  }
  return panel;
}

function Panel(props: PanelProps<Data>) {
  const [impl, setImpl] = useState<{ C: PanelType } | null>(null);
  useEffect(() => {
    let live = true;
    loadPanel().then(
      (C) => live && setImpl({ C }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  return impl ? <impl.C {...props} /> : <p class="xt-lead xt-wait">…</p>;
}

export default defineExtra<Data>({
  id: 'dictionary',
  order: 50,
  title: 'Old Bible dictionaries',
  level: 'study',
  async load(a) {
    await readerHere('dictionary');
    return load(a);
  },
  note(verse, d) {
    const list = listingsAt(d, verse);
    // Its book is still loading: the verse has entries, their names follow.
    if (list === undefined) return LEAD;
    if (!list.length) return null;
    const all = names(list);
    const line = (shown: number) => {
      const rest = all.length - shown;
      return `${LEAD}: ${all.slice(0, shown).join(', ')}${rest > 0 ? ` and ${rest} more` : ''}`;
    };
    let shown = 0;
    while (shown < Math.min(3, all.length) && line(shown + 1).length <= MAX) shown++;
    if (shown === 0) return `${LEAD}: ${all.length === 1 ? 'one entry' : `${all.length} entries`}`;
    return line(shown);
  },
  Panel,
});
