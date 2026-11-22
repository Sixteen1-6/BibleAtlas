// Places: one quiet line naming the places a verse names ("Places: Bethlehem,
// Judea"), and behind it a map of the Bible lands that the app draws itself,
// with no map service, so it works offline. The list of places loads with the
// reader's first tap; the map, its code, styles and data, and the people at
// Deep, only when the panel opens.
//
// Data: OpenBible.info Bible Geocoding Data (CC BY 4.0), Natural Earth
// (public domain) and Theographic Bible Metadata (CC BY-SA 4.0), built by
// crates/atlas-cli/src/extra_real_map.rs.

import type { ComponentType } from 'preact';
import { loadJson } from './data';
import { type Data, type IndexFile, decodeIndex, placesLine } from './real-map/model';
import { type PanelProps, defineExtra } from './types';
import { Waiting, lazyCode, useCode } from './lazy';

type PanelType = ComponentType<PanelProps<Data>>;

/** The address the reader arrived at, read before the app rewrites it. */
const ARRIVED = typeof location === 'undefined' ? '' : location.hash;
/** The reader's own first move. The app writes the address with replaceState
 * and pushState, which fire no hashchange, so a hashchange is the reader's. */
const FIRST_TOUCH = ['pointerdown', 'touchstart', 'keydown', 'wheel', 'click', 'hashchange', 'popstate'] as const;
let touched: Promise<void> | null = null;

/** On a plain first visit the app selects a verse by itself, and this extra's
 * index waits for the reader's first tap, key, scroll or change of address, so
 * that visit downloads nothing new. A link to a verse or to this panel loads
 * it at once. */
function readerHere(): Promise<void> {
  if (!touched) {
    const h = new URLSearchParams(ARRIVED.slice(1));
    touched =
      h.has('v') || h.get('x') === 'real-map' || typeof addEventListener !== 'function'
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

/** The panel's code, fetched the first time a reader opens it. */
const loadPanel = lazyCode((): Promise<PanelType> => import('./real-map/MapPanel').then((m) => m.MapPanel));

function Panel(props: PanelProps<Data>) {
  const code = useCode(loadPanel);
  const C = code.got;
  return C ? <C {...props} /> : <Waiting code={code} />;
}

export default defineExtra<Data>({
  id: 'real-map',
  order: 30,
  title: 'Places',
  tall: true,
  async load(a) {
    await readerHere();
    return decodeIndex(await loadJson<IndexFile>(a, 'extras/real-map.json'), a.n);
  },
  note(verse, d) {
    let line = d.lines.get(verse);
    if (line === undefined) {
      const ms = d.byVerse.get(verse);
      if (!ms) return null;
      line = placesLine(ms);
      d.lines.set(verse, line);
    }
    return line;
  },
  Panel,
});
