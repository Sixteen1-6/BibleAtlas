// Hard passages: at Deep, the passages people most often find hard, with
// pages on other websites that answer them. These are the "Often asked"
// questions whose own answers are still waiting for review: until a person
// approves one, this shows only the Bible's words and the links, never the
// app's draft.
//
// The line, under each verse of such a passage:
//   "A hard passage: answers on GotQuestions and The Gospel Coalition"
// The panel: the passages side by side, then the pages that answer them.
// Built by crates/atlas-cli/src/extra_hard_verses.rs, in the same file as the
// "Often asked" questions. The panel's code loads when it first opens.

import './hard-passages.css';
import type { ComponentType } from 'preact';
import { readerHere } from './first-move';
import { type Data, load } from './hard-passages/model';
import { type PanelProps, defineExtra } from './types';
import { Waiting, lazyCode, useCode } from './lazy';

type PanelType = ComponentType<PanelProps<Data>>;

const loadPanel = lazyCode((): Promise<PanelType> => import('./hard-passages/Panel').then((m) => m.Panel));

function Panel(props: PanelProps<Data>) {
  const code = useCode(loadPanel);
  const C = code.got;
  return C ? <C {...props} /> : <Waiting code={code} />;
}

export default defineExtra<Data>({
  id: 'hard-passages',
  order: 12,
  title: 'Hard passages',
  level: 'deep',
  async load(a) {
    await readerHere('hard-passages');
    return load(a);
  },
  note(verse, d) {
    return d.lines.get(verse) ?? null;
  },
  Panel,
});
