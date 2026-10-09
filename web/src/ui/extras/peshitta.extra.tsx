// Syriac: the verse in the Peshitta, an early translation of the New
// Testament into Syriac, a dialect of Aramaic, made from the Greek around
// AD 350-450. Deep only: it is a translation centuries after Jesus, never his
// own words, and the page says so wherever it appears.
//
// The line, under a New Testament verse at Deep:
//   "Syriac: an early Aramaic translation, made from the Greek"
//   "Syriac (a later version): an Aramaic translation from the Greek"
//     (2 Peter, 2 and 3 John, Jude, Revelation and John 7:53-8:11, which the
//     early Peshitta did not have)
// Nothing shows under an Old Testament verse, or at Simple or Study.
//
// The panel: the Syriac right to left with an approximate romanization, the
// BSB beside it (with the Greek, at Deep), and where the text comes from. Data:
// the Digital Syriac Corpus (CC BY 4.0), built by
// crates/atlas-cli/src/extra_peshitta.rs. Only the small index loads for the
// line; each book's Syriac, the panel's code and the Syriac font load the first
// time a reader opens the panel.

import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { type Data, EARLY, LATER, load } from './peshitta/model';
import { type PanelProps, defineExtra } from './types';

type PanelType = ComponentType<PanelProps<Data>>;

let panel: Promise<PanelType> | null = null;

/** The panel's code, fetched the first time a reader opens it. */
function loadPanel(): Promise<PanelType> {
  if (!panel) {
    panel = import('./peshitta/Panel').then((m) => m.Panel);
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
  id: 'peshitta',
  order: 40,
  title: 'Syriac translation',
  level: 'deep',
  load,
  note(verse, d) {
    const k = d.kind[verse];
    if (k === EARLY) return 'Syriac: an early Aramaic translation, made from the Greek';
    if (k === LATER) return 'Syriac (a later version): an Aramaic translation from the Greek';
    return null;
  },
  Panel,
});
