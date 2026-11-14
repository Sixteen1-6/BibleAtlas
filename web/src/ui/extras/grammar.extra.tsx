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
// The points are the tagged text's own, so the panel is not commentary. What a
// form means is shown only in a grammarian's own words, with the page they
// were read on (config/grammar.json). The data is written and checked by
// crates/atlas-cli/src/extra_grammar.rs; a book's points load when its panel
// opens, and the panel's code the first time a reader opens it.

import './grammar.css';
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { readerHere } from './first-move';
import { type Data, hasOutline, lineAt, load } from './grammar/model';
import { type ChapterPanelProps, type PanelProps, defineExtra } from './types';

interface Panels {
  Panel: ComponentType<PanelProps<Data>>;
  ChapterPanel: ComponentType<ChapterPanelProps<Data>>;
}

let panels: Promise<Panels> | null = null;

/** The panels' code, fetched the first time a reader opens one. */
function loadPanels(): Promise<Panels> {
  if (!panels) {
    panels = import('./grammar/Panel');
    panels.catch(() => (panels = null));
  }
  return panels;
}

function usePanels(): Panels | null {
  const [got, setGot] = useState<Panels | null>(null);
  useEffect(() => {
    let live = true;
    loadPanels().then(
      (p) => live && setGot(p),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  return got;
}

function Panel(props: PanelProps<Data>) {
  const p = usePanels();
  return p ? <p.Panel {...props} /> : <p class="xt-lead xt-wait">…</p>;
}

function ChapterPanel(props: ChapterPanelProps<Data>) {
  const p = usePanels();
  return p ? <p.ChapterPanel {...props} /> : <p class="xt-lead xt-wait">…</p>;
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
