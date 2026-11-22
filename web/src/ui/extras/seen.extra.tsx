// Seen in the words: at Deep, the figures of speech and patterns of lines that
// a verse's own words show, where no writer is quoted for that place. The
// founder chose this on 2026-11-14 ("Words too, every figure"). The places
// have no strength label and nothing says who or what found them; a place
// where a cited note has the same form is left out by the build, so the
// cited note in "How it is written" wins.
//
// The line:  "Seen in the words: Said twice, and 1 more"
// The panel: the verse with the words that show each figure marked, the BSB's
// own poetry lines for lines, the Hebrew or Greek words when the figure is in
// the original, and what the figure is in Bullinger's words.
//
// It is commentary (people's naming of figures), so it stays closed until the
// reader finishes the commentary notice. A book's places load the first time
// one of its verses is shown at Deep; the panel's code loads when opened.

import './seen.css';
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { readerHere } from './first-move';
import { type Data, SOURCE, lineAt, load, notesAt } from './seen/model';
import { type PanelProps, defineExtra } from './types';

let panel: Promise<{ Panel: ComponentType<PanelProps<Data>> }> | null = null;

function loadPanel() {
  if (!panel) {
    panel = import('./seen/Panel');
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
  id: 'seen',
  order: 15,
  title: 'Seen in the words',
  level: 'deep',
  async load(a) {
    await readerHere('seen');
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
    return { line: 'Figures of speech seen in this verse’s own words.', button: 'Show them', source: SOURCE };
  },
});
