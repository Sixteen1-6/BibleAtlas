// Life in Bible times: the customs behind a verse, in the words of James M.
// Freeman's Hand-Book of Bible Manners and Customs (1874), public domain:
// what the words meant to the people who first heard them. Study and Deep;
// Freeman's words show only once the reader has finished the commentary
// notice (ui/commentary), since they are a writer's words about the Bible.
//
// The line, under a verse Freeman heads an entry with:
//   "In Bible times: Camels' Furniture"
// The panel: each entry in Freeman's words, the King James words he explains
// above it, long ones folded behind "Read all". Deep adds who Freeman was and
// where the text was read. Built by crates/atlas-cli/src/extra_customs.rs.

import './customs.css';
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { type Data, SOURCE, load } from './customs/model';
import { readerHere } from './first-move';
import { refName } from './kit';
import { type PanelProps, defineExtra } from './types';

const LEAD = 'In Bible times';
/** The line stays under this many characters. */
const MAX = 64;

type PanelType = ComponentType<PanelProps<Data>>;

let panel: Promise<PanelType> | null = null;

/** The panel's code, fetched the first time a reader opens it. */
function loadPanel(): Promise<PanelType> {
  if (!panel) {
    panel = import('./customs/Panel').then((m) => m.Panel);
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
  id: 'customs',
  order: 52,
  title: 'Life in Bible times',
  level: 'study',
  async load(a) {
    await readerHere('customs');
    return load(a);
  },
  note(verse, d) {
    const list = d.at.get(verse);
    if (!list?.length) return null;
    const titles = list.map(([, t]) => t);
    const line = (shown: number) => {
      const rest = titles.length - shown;
      return `${LEAD}: ${titles.slice(0, shown).join(', ')}${rest > 0 ? ` and ${rest} more` : ''}`;
    };
    let shown = 0;
    while (shown < Math.min(3, titles.length) && line(shown + 1).length <= MAX) shown++;
    if (shown === 0) return `${LEAD}: the customs behind this verse`;
    return line(shown);
  },
  Panel,
  commentary: true,
  closed(verse, d, a) {
    const n = d.at.get(verse)?.length ?? 0;
    const line = `James M. Freeman, a minister writing in 1874, explains ${n > 1 ? 'customs' : 'a custom'} behind ${refName(a, verse)}.`;
    return { line, button: 'Show what he wrote', source: SOURCE };
  },
});
