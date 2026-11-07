// The Literary devices card, beside the Layers card on the verse panel at
// Deep: one line for each note on how the verse is written (figures) and how
// its passage is built (structure), each opening that note's panel. The lines
// are the extras' own short lines, as under the verse in the reader; the
// panels stay behind the commentary notice, as they do there. Nothing shows
// on a verse with neither, or below Deep.

import { useEffect } from 'preact/hooks';
import type { Atlas } from '../../../data/atlas';
import { atLeast } from '../../../depth';
import { dataState, ensureData } from '../data';
import { type Data as Figures, notesAt as figuresAt } from '../figures/model';
import { openExtra } from '../open';
import { extraById } from '../registry';
import type { VerseRef } from '../types';
import { type Data as Structures, notesAt as structuresAt } from './model';

const MOST = 5;

function ready<D>(id: string): D | null {
  const x = extraById(id);
  const s = x ? dataState(x) : undefined;
  return s?.state === 'ready' ? (s.data as D) : null;
}

export function DevicesCard({ a, v }: { a: Atlas; v: VerseRef }) {
  const deep = atLeast('deep');
  useEffect(() => {
    if (!deep) return;
    for (const id of ['figures', 'structure']) {
      const x = extraById(id);
      if (x) ensureData(x, a);
    }
  }, [deep, a]);
  if (!deep) return null;
  const f = ready<Figures>('figures');
  const s = ready<Structures>('structure');
  const items: { id: string; key: string; kind: string; text: string }[] = [];
  for (const n of (s && structuresAt(s, v)) ?? []) items.push({ id: 'structure', key: n.id, kind: s?.kinds[n.kind]?.label ?? '', text: n.short });
  for (const n of (f && figuresAt(f, v)) ?? []) items.push({ id: 'figures', key: n.id, kind: f?.forms[n.form]?.label ?? '', text: n.short });
  if (!items.length) return null;
  return (
    <section class="layers x-devices" aria-label="Literary devices">
      <h3>Literary devices</h3>
      <ul>
        {items.slice(0, MOST).map((it) => (
          <li key={`${it.id}:${it.key}`}>
            <button type="button" class="x-devices-item" onClick={(e) => openExtra(it.id, 'verse', v, e.currentTarget)}>
              {it.kind && <span class="x-devices-kind">{it.kind}</span>}
              {it.text} <span aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>
      {items.length > MOST && <p class="x-devices-more">And {items.length - MOST} more under the verse.</p>}
    </section>
  );
}
