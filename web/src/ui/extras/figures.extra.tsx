// How it is written: at Deep, where Scripture sets two lines side by side
// (said again, set opposite, built up, mirrored or taking turns), speaks in a
// figure (one thing named for another, God spoken of in human terms), or sets
// two people side by side.
//
// The line, under the verses a note sits under, is the note's own short line:
//   "Two lines, two ways: the righteous and the wicked"     (Psalm 1:6)
//   "A mirror: hearts, ears, eyes, then eyes, ears, hearts"  (Isaiah 6:10)
// The panel shows the BSB words in their lines with the pairs joined by arcs
// on a small night sky, what the form is in its source's own words, and the
// writers who name it, each in his own words.
//
// The notes are drawn from Christian writers, so the panel stays closed until
// the reader finishes the commentary notice (ui/commentary). The data is
// written and checked by crates/atlas-cli/src/extra_figures.rs; a book's notes
// load the first time one of its verses is shown at Deep. The panel's code
// loads the first time a reader opens it.

import './figures.css';
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { readerHere } from './first-move';
import { type Data, SOURCE, lineAt, load, notesAt } from './figures/model';
import { type PanelProps, defineExtra } from './types';

let panel: Promise<{ Panel: ComponentType<PanelProps<Data>> }> | null = null;

function loadPanel() {
  if (!panel) {
    panel = import('./figures/Panel');
    panel.catch(() => (panel = null));
  }
  return panel;
}

function Panel(props: PanelProps<Data>) {
  const [got, setGot] = useState<ComponentType<PanelProps<Data>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let live = true;
    loadPanel().then(
      (p) => live && setGot(() => p.Panel),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [tries]);
  const P = got;
  if (P) return <P {...props} />;
  if (failed)
    return (
      <p class="xt-lead">
        This could not load.{' '}
        <button
          type="button"
          class="x-figures-more"
          onClick={() => {
            setFailed(false);
            setTries(tries + 1);
          }}
        >
          Try again
        </button>
      </p>
    );
  return <p class="xt-lead xt-wait">…</p>;
}

export default defineExtra<Data>({
  id: 'figures',
  order: 13,
  title: 'How it is written',
  level: 'deep',
  async load(a) {
    await readerHere('figures');
    return load(a);
  },
  note(verse, d) {
    return lineAt(d, verse);
  },
  Panel,
  commentary: 'verse',
  closed(verse, d) {
    const ns = notesAt(d, verse) ?? [];
    if (!ns.length) return null;
    return { line: 'Christian writers note how this verse is written.', button: ns.length > 1 ? 'Show the notes' : 'Show the note', source: SOURCE };
  },
});
