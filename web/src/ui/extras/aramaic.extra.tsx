// Aramaic and Hebrew: where the Bible keeps a word in Aramaic or Hebrew instead
// of translating it, and the parts of the Old Testament written in Aramaic.
//
// The line, under a verse it applies to:
//   "Jesus’ words in Aramaic: Talitha koum, ‘Little girl, get up!’"  (Mark 5:41)
//   "From here to Daniel 7:28, the text is in Aramaic, not Hebrew"   (Daniel 2:4)
// and under a chapter heading: "From the middle of verse 4, this chapter is in
// Aramaic, not Hebrew" (Daniel 2). Nothing shows under any other verse, and
// never a line on every verse of Daniel.
//
// The panel says why the rest is in Greek; Study shows the word in Hebrew
// square letters beside the Greek letters the writer used (or the verse with
// its Hebrew and Aramaic marked); Deep adds the scholarly detail, how sure it
// is, the word studies and the sources. The words are curated in
// config/aramaic.json and checked against the BSB and STEPBible's TAGNT and
// TAHOT by crates/atlas-cli/src/extra_aramaic.rs. Only the line's data loads
// with the page; the panel's code loads the first time a reader opens it.

import './aramaic.css';
import type { ComponentType } from 'preact';
import { type Data, chapterKey, load } from './aramaic/model';
import { readerHere } from './first-move';
import { type ChapterPanelProps, type PanelProps, defineExtra } from './types';
import { Waiting, lazyCode, useCode } from './lazy';

interface Panels {
  Panel: ComponentType<PanelProps<Data>>;
  ChapterPanel: ComponentType<ChapterPanelProps<Data>>;
}

/** The panel's code, fetched the first time a reader opens it. */
const loadPanels = lazyCode((): Promise<Panels> => import('./aramaic/Panel'));

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
  id: 'aramaic',
  order: 15,
  title: 'Aramaic and Hebrew',
  async load(a) {
    await readerHere('aramaic');
    return load(a);
  },
  note(verse, d) {
    return d.verses.get(verse)?.line ?? null;
  },
  chapterNote(chapter, d) {
    return d.chapters.get(chapterKey(chapter))?.line ?? null;
  },
  Panel,
  ChapterPanel,
});
