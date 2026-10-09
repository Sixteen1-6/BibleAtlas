// Study notes: what Bible scholars note about a verse and the passage around
// it, from the Aquifer Open Study Notes, a plain-English adaptation of the
// Tyndale Open Study Notes (both CC BY-SA 4.0). Always shown as these
// scholars' notes, never as the app's own claim.
//
// The line, under a verse with a note of its own (or on up to three verses
// with it):
//   "A study note on this verse", "A study note on verses 6–8"
// At Study and Deep, a verse with only a note on its wider passage gets one
// too: "A study note on verses 1–18". Nothing shows under any other verse.
//
// The panel: the verse's own notes in full, then the notes on its wider
// passage, folded at Simple and open from Study; verse names inside a note take
// the reader there. At Deep, where each note comes from. The small index loads
// with the reader's first move; each book's notes and the panel's code load the
// first time a reader opens the panel. Built by crates/atlas-cli/src/extra_notes.rs.

import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { levelAtLeast } from './level';
import { type Data, hits, load, nameFrom } from './notes/model';
import { type PanelProps, defineExtra } from './types';

type PanelType = ComponentType<PanelProps<Data>>;

/** The address the reader arrived at, read before the app rewrites it. */
const ARRIVED = typeof location === 'undefined' ? '' : location.hash;
/** The reader's own first move. The app writes the address with replaceState
 * and pushState, which fire no hashchange, so a hashchange is the reader's. */
const FIRST_TOUCH = ['pointerdown', 'touchstart', 'keydown', 'wheel', 'click', 'hashchange', 'popstate'] as const;
let touched: Promise<void> | null = null;

/** On a plain first visit the app selects a verse by itself, and the index
 * waits for the reader's first tap, key, scroll or change of address, so that
 * visit downloads nothing new. A link to a verse or to this panel loads it at once. */
function readerHere(): Promise<void> {
  if (!touched) {
    const h = new URLSearchParams(ARRIVED.slice(1));
    touched =
      h.has('v') || h.get('x')?.split('.')[0] === 'notes' || typeof addEventListener !== 'function'
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const go = () => {
              for (const t of FIRST_TOUCH) removeEventListener(t, go, true);
              resolve();
            };
            for (const t of FIRST_TOUCH) addEventListener(t, go, { capture: true, passive: true });
          });
  }
  return touched;
}

let panel: Promise<PanelType> | null = null;

/** The panel's code, fetched the first time a reader opens it. */
function loadPanel(): Promise<PanelType> {
  if (!panel) {
    panel = import('./notes/Panel').then((m) => m.Panel);
    panel.catch(() => (panel = null));
  }
  return panel;
}

function Panel(props: PanelProps<Data>) {
  const [impl, setImpl] = useState<{ C: PanelType } | null>(null);
  useEffect(() => {
    let live = true;
    loadPanel().then(
      (C) => live && setImpl({ C }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  if (!impl) return <p class="xt-lead xt-wait">…</p>;
  return <impl.C {...props} />;
}

export default defineExtra<Data>({
  id: 'notes',
  order: 50,
  title: 'Study notes',
  async load(a) {
    await readerHere();
    return load(a);
  },
  note(verse, d) {
    const h = hits(d, verse);
    const first = h.own[0] ?? (levelAtLeast('study') ? h.wide[0] : undefined);
    if (!first) return null;
    const many = h.own.length > 1 && first === h.own[0] && h.own.every((x) => x.from === first.from && x.to === first.to);
    return `${many ? 'Study notes' : 'A study note'} on ${nameFrom(d.a, verse, first.from, first.to)}`;
  },
  Panel,
});
