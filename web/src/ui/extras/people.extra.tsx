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
import { readerHere } from './first-move';
import { type Data, load } from './people/model';
import { type PanelProps, defineExtra } from './types';
import { Waiting, lazyCode, useCode } from './lazy';

const LEAD = 'People';
/** The line stays under this many characters. */
const MAX = 64;

type PanelType = ComponentType<PanelProps<Data>>;

/** The panel's code, fetched the first time a reader opens it. */
const loadPanel = lazyCode((): Promise<PanelType> => import('./people/Panel').then((m) => m.Panel));

function Panel(props: PanelProps<Data>) {
  const code = useCode(loadPanel);
  const C = code.got;
  return C ? <C {...props} /> : <Waiting code={code} text="Loading…" />;
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
