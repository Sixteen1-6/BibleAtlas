// Places: one quiet line naming the places a verse names ("Places: Bethlehem,
// Judea"), and behind it a map of the Bible lands that the app draws itself,
// with no map service, so it works offline. The map, its data and the people
// at Deep load only when the panel opens.
//
// Data: OpenBible.info Bible Geocoding Data (CC BY 4.0), Natural Earth
// (public domain) and Theographic Bible Metadata (CC BY-SA 4.0), built by
// crates/atlas-cli/src/extra_real_map.rs.

import './real-map.css';
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { loadJson } from './data';
import { type Data, type IndexFile, decodeIndex, placesLine } from './real-map/model';
import { type PanelProps, defineExtra } from './types';

type PanelType = ComponentType<PanelProps<Data>>;

let panel: Promise<PanelType> | null = null;

/** The panel's code, fetched the first time a reader opens it. */
function loadPanel(): Promise<PanelType> {
  if (!panel) {
    panel = import('./real-map/MapPanel').then((m) => m.MapPanel);
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
  id: 'real-map',
  order: 30,
  title: 'Places',
  async load(a) {
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
