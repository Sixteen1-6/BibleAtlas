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
// Only the line's data loads with the page; the panel's code loads the first
// time a reader opens it.

import './parallels.css';
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { type Data, load } from './parallels/model';
import { readerHere } from './first-move';
import { type PanelProps, defineExtra } from './types';

type PanelType = ComponentType<PanelProps<Data>>;

let panel: Promise<PanelType> | null = null;

/** The panel's code, fetched the first time a reader opens it. */
function loadPanel(): Promise<PanelType> {
  if (!panel) {
    panel = import('./parallels/Panel').then((m) => m.Panel);
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
  if (!impl) return <p class="xt-lead xt-wait">…</p>;
  return <impl.C {...props} />;
}

export default defineExtra<Data>({
  id: 'parallels',
  order: 20,
  title: 'Parallel passages',
  async load(a) {
    await readerHere('parallels');
    return load(a);
  },
  note(verse, d) {
    return d.lines.get(verse) ?? null;
  },
  Panel,
});
