// Hard verses: the questions people most often ask about a verse.
//
// The line, under the verse a question is about (and the other verses it
// names, such as the second account of Judas's death):
//   "Often asked: How did Judas die?"
// The panel answers in a few plain sentences with the verses beside it;
// Study adds the main ways Christians explain it and the passages that help;
// Deep adds what the answer rests on and where to read more.
//
// The questions are written in config/hard-verses.json and checked by
// crates/atlas-cli/src/extra_hard_verses.rs; a card nobody has reviewed never
// reaches the live site. The cards and the panel's code load on first open.

import './hard-verses.css';
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { readerHere } from './first-move';
import { type Data, load } from './hard-verses/model';
import { type PanelProps, defineExtra } from './types';

let panel: Promise<{ Panel: ComponentType<PanelProps<Data>> }> | null = null;

function usePanel(): ComponentType<PanelProps<Data>> | null {
  const [got, setGot] = useState<ComponentType<PanelProps<Data>> | null>(null);
  useEffect(() => {
    let live = true;
    if (!panel) {
      panel = import('./hard-verses/Panel');
      panel.catch(() => (panel = null));
    }
    panel.then(
      (m) => live && setGot(() => m.Panel),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  return got;
}

function Panel(props: PanelProps<Data>) {
  const P = usePanel();
  return P ? <P {...props} /> : <p class="xt-lead xt-wait">…</p>;
}

export default defineExtra<Data>({
  id: 'hard-verses',
  order: 11,
  title: 'Often asked',
  async load(a) {
    await readerHere('hard-verses');
    return load(a);
  },
  note(verse, d) {
    return d.lines.get(verse) ?? null;
  },
  Panel,
});
