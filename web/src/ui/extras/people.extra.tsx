// People: the people a verse names, and every other verse that names them.
//
// The line, under a verse that names someone (the most often named first):
//   "People: Aaron, Moses"
// The panel: each person, how many verses name them, a button that marks
// those verses on the map, the first few verses in the BSB, and their family
// (father, mother, husband or wife, children, brothers and sisters), each a
// tap away. At Study and Deep. Built by crates/atlas-cli/src/extra_people.rs
// from Theographic Bible Metadata (CC BY-SA 4.0).

import './people.css';
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { readerHere } from './first-move';
import { type Data, load } from './people/model';
import { type PanelProps, defineExtra } from './types';

const LEAD = 'People';
/** The line stays under this many characters. */
const MAX = 64;

type PanelType = ComponentType<PanelProps<Data>>;

let panel: Promise<PanelType> | null = null;

/** The panel's code, fetched the first time a reader opens it. */
function loadPanel(): Promise<PanelType> {
  if (!panel) {
    panel = import('./people/Panel').then((m) => m.Panel);
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
  return impl ? <impl.C {...props} /> : <p class="xt-lead xt-wait">Loading…</p>;
}

export default defineExtra<Data>({
  id: 'people',
  order: 32,
  title: 'People',
  level: 'study',
  async load(a) {
    await readerHere('people');
    return load(a);
  },
  note(verse, d) {
    const names = (d.at.get(verse) ?? []).map((i) => d.people[i].name);
    if (!names.length) return null;
    const line = (shown: number) => {
      const rest = names.length - shown;
      return `${LEAD}: ${names.slice(0, shown).join(', ')}${rest > 0 ? ` and ${rest} more` : ''}`;
    };
    let shown = 1;
    while (shown < names.length && line(shown + 1).length <= MAX) shown++;
    return line(shown);
  },
  Panel,
});
