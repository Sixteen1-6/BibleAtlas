// Wordplay: where the Hebrew or Greek plays on words, or a name carries a
// meaning, and the alphabet poems, where each part starts with the next
// Hebrew letter.
//
// The line, under a verse that holds the words (words in this verse first):
//   "A play on words: adam and adamah"            (Genesis 2:7, 2:5, 3:19)
//   "What a name means: Levi"                     (Genesis 29:34)
// and under the chapter heading of an alphabet poem:
//   "An alphabet poem in 22 parts of 8 verses, from aleph to tav" (Psalm 119)
//
// Its order puts it after the quotations, Aramaic, parallels and places, so a
// more specific line keeps its place when a verse has several.
//
// The plays come from the reviewed layers in layers.json, so a draft never
// shows on the live site. The alphabet poems are checked letter by letter
// against the Hebrew by crates/atlas-cli/src/extra_wordplay.rs. The panel's
// code loads the first time a reader opens it.

import './wordplay.css';
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { readerHere } from './first-move';
import { type ChapterPanelProps, type PanelProps, defineExtra } from './types';
import { type Data, chapterKey, load } from './wordplay/model';

interface Panels {
  Panel: ComponentType<PanelProps<Data>>;
  ChapterPanel: ComponentType<ChapterPanelProps<Data>>;
}

let panels: Promise<Panels> | null = null;

/** The panel's code, fetched the first time a reader opens it. */
function loadPanels(): Promise<Panels> {
  if (!panels) {
    panels = import('./wordplay/Panel');
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
  id: 'wordplay',
  order: 35,
  title: 'Wordplay',
  async load(a) {
    await readerHere('wordplay');
    return load(a);
  },
  note(verse, d) {
    return d.lines.get(verse) ?? null;
  },
  chapterNote(chapter, d) {
    return d.poems.get(chapterKey(chapter))?.line ?? null;
  },
  Panel,
  ChapterPanel,
});
