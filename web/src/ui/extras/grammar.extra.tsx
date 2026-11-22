// Word choice: at Deep, what the forms of a verse's own words show. Every
// point is read from the grammar tag on a Hebrew, Aramaic or Greek word, or
// counted from those tags: a verb's tense, voice and mood (or its Hebrew stem
// and form), a doubled "not", a verb said twice, a chain of "to" verbs or
// commands, a list, a linking word and what it looks back to, a word used
// only once.
//
// The line, under a verse that has a point:
//   "Word choice: a chain of 5 “to” verbs"                    (Titus 3:1)
//   "Word choice: “therefore”: a conclusion from what came before" (Romans 12:1)
//   "Word choice: the same verb said twice, side by side"       (Genesis 2:17)
// and under a chapter heading whose chapter has three or more links, chains
// or lists:
//   "Word choice: how this chapter’s thoughts are joined"
//
// The points are the tagged text's own, so the line and the panel are not
// commentary. What a form means is shown only in a grammarian's own words,
// with the page they were read on (config/grammar.json), and that one part
// of the panel stays closed until the reader has finished the commentary
// notice. The data is written and checked by
// crates/atlas-cli/src/extra_grammar.rs; a book's points load when its panel
// opens, and the panel's code the first time a reader opens it.

import './grammar.css';
import type { ComponentType } from 'preact';
import { readerHere } from './first-move';
import { type Data, hasOutline, lineAt, load } from './grammar/model';
import { type ChapterPanelProps, type PanelProps, defineExtra } from './types';
import { Waiting, lazyCode, useCode } from './lazy';

interface Panels {
  Panel: ComponentType<PanelProps<Data>>;
  ChapterPanel: ComponentType<ChapterPanelProps<Data>>;
}

/** The panels' code, fetched the first time a reader opens one. */
const loadPanels = lazyCode((): Promise<Panels> => import('./grammar/Panel'));

function Panel(props: PanelProps<Data>) {
  const code = useCode(loadPanels);
  const p = code.got;
  return p ? <p.Panel {...props} /> : <Waiting code={code} />;
}

function ChapterPanel(props: ChapterPanelProps<Data>) {
  const code = useCode(loadPanels);
  const p = code.got;
  return p ? <p.ChapterPanel {...props} /> : <Waiting code={code} />;
}

export default defineExtra<Data>({
  id: 'grammar',
  order: 36,
  title: 'Word choice',
  level: 'deep',
  async load(a) {
    await readerHere('grammar');
    return load(a);
  },
  note(verse, d) {
    return lineAt(d, verse);
  },
  chapterNote(chapter, d) {
    return hasOutline(d, chapter) ? 'Word choice: how this chapter’s thoughts are joined' : null;
  },
  Panel,
  ChapterPanel,
});
