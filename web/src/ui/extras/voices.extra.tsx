// Christian writers: what Christian writers of the past wrote about a verse,
// in their own words. At Deep only, and their words show only once the reader
// has finished the commentary notice (ui/commentary): the Church Fathers on
// the Gospels (as Thomas Aquinas gathered them in the Catena Aurea), Matthew
// Henry's Concise Commentary and John Wesley's Explanatory Notes, all public
// domain. Never shown as the app's own claim, or as Scripture.
//
// The line, under a verse one of them wrote about:
//   "Christian writers: the Church Fathers, Matthew Henry and John Wesley"
//
// The panel: each writer's notes, oldest first, folded where long, with places
// elsewhere to read more on the verse. Opened by a link before the notice, it
// says who wrote about the verse, with "Show what they wrote". The small index
// loads with the reader's first move; the notes and the panel's code load when
// the panel opens. Built by crates/atlas-cli/src/extra_voices.rs.

import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { readerHere } from './first-move';
import { refName } from './kit';
import { type PanelProps, defineExtra } from './types';
import { type Data, SOURCE, WORKS, listWords, load, worksOn } from './voices/model';

type PanelType = ComponentType<PanelProps<Data>>;

let panel: Promise<PanelType> | null = null;

/** The panel's code, fetched the first time a reader opens it. */
function loadPanel(): Promise<PanelType> {
  if (!panel) {
    panel = import('./voices/Panel').then((m) => m.Panel);
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
    return ws.length ? `Christian writers: ${listWords(ws.map((w) => WORKS[w].short))}` : null;
  },
  Panel,
  commentary: true,
  closed(verse, d, a) {
    const who = listWords(worksOn(d, verse).map((w) => WORKS[w].short));
    return { line: `${who.charAt(0).toUpperCase()}${who.slice(1)} wrote about ${refName(a, verse)}.`, button: 'Show what they wrote', source: SOURCE };
  },
});
