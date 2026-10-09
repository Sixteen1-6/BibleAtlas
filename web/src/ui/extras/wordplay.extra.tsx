// Wordplay: where the Hebrew or Greek plays on words, or a name carries a
// meaning, and the alphabet poems, where each part starts with the next
// Hebrew letter.
//
// The line, under a verse it applies to:
//   "A play on words: adam and adamah"            (Genesis 2:7, 2:5, 3:19)
//   "What a name means: Jacob"                    (a name-meaning layer)
// and under the chapter heading of an alphabet poem:
//   "An alphabet poem: every 8 verses start with the next Hebrew letter" (Psalm 119)
//
// The plays come from the reviewed layers in layers.json, so a draft never
// shows on the live site. The alphabet poems are checked letter by letter
// against the Hebrew by crates/atlas-cli/src/extra_wordplay.rs. The panel's
// code loads the first time a reader opens it.

import './wordplay.css';
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
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
  order: 12,
  title: 'Wordplay',
  load,
  note(verse, d) {
    return d.lines.get(verse) ?? null;
  },
  chapterNote(chapter, d) {
    return d.poems.get(chapterKey(chapter))?.line ?? null;
  },
  Panel,
  ChapterPanel,
});
