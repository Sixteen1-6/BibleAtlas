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
import { readerHere } from './first-move';
import { type Data, load } from './hard-verses/model';
import { type PanelProps, defineExtra } from './types';
import { Waiting, lazyCode, useCode } from './lazy';

const loadPanel = lazyCode(() => import('./hard-verses/Panel').then((m) => m.Panel));

function Panel(props: PanelProps<Data>) {
  const code = useCode(loadPanel);
  const P = code.got;
  return P ? <P {...props} /> : <Waiting code={code} />;
}

export default defineExtra<Data>({
  id: 'hard-verses',
  order: 11,
  title: 'Often asked',
  level: 'study',
  async load(a) {
    await readerHere('hard-verses');
    return load(a);
  },
  note(verse, d) {
    return d.lines.get(verse) ?? null;
  },
  Panel,
  commentary: true,
  closed(verse, d) {
    const qs = d.at.get(verse) ?? [];
    if (!qs.length) return null;
    const more = qs.length - 1;
    const line = `People often ask: ${d.questions[qs[0]].q}${more ? ` And ${more} more ${more === 1 ? 'question' : 'questions'}.` : ''}`;
    // No source line while closed: it credits the answers, which are not shown yet.
    return { line, button: more ? 'Show the answers' : 'Show the answer' };
  },
});
