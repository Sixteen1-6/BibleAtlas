// Guided tours (data/tours.ts): under a verse that is a step of a tour, the
// line "On the tour: The Lamb, Genesis to Revelation". The panel lists the
// tour's steps and follows it from this verse or from the start. A tour shows
// only Scripture and its title.

import './tours.css';
import type { Atlas } from '../../data/atlas';
import { type Tour, loadTours, startTour } from '../../data/tours';
import { readerHere } from './first-move';
import { refName } from './kit';
import { type PanelProps, defineExtra } from './types';

interface Data {
  tours: Tour[];
  /** The tours each verse is a step of. */
  at: Map<number, Tour[]>;
}

async function load(a: Atlas): Promise<Data> {
  const tours = await loadTours(a);
  const at = new Map<number, Tour[]>();
  for (const t of tours) for (const v of t.steps) at.set(v, [...(at.get(v) ?? []), t]);
  return { tours, at };
}

function Panel({ a, data, verse, close }: PanelProps<Data>) {
  const here = data.at.get(verse) ?? [];
  const follow = (t: Tour, i: number) => {
    close();
    startTour(t, i);
  };
  return (
    <div>
      {here.map((t) => {
        const i = t.steps.indexOf(verse);
        return (
          <section key={t.id} class="x-tours-tour" aria-label={t.title}>
            <h3 class="x-tours-title">{t.title}</h3>
            <p class="x-tours-count">
              {t.steps.length} verses. This is step {i + 1}.
            </p>
            <p class="x-tours-go">
              <button type="button" class="x-tours-btn" onClick={() => follow(t, i)}>
                Follow it from here ›
              </button>
              {i > 0 && (
                <button type="button" class="x-tours-btn" onClick={() => follow(t, 0)}>
                  Start at the beginning
                </button>
              )}
            </p>
            <ol class="x-tours-steps">
              {t.steps.map((v, k) => (
                <li key={v} aria-current={k === i ? 'step' : undefined}>
                  <button type="button" class="x-tours-link" data-lv={v} onClick={() => follow(t, k)}>
                    {refName(a, v)}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

export default defineExtra<Data>({
  id: 'tours',
  order: 28,
  title: 'Guided tour',
  async load(a) {
    await readerHere('tours');
    return load(a);
  },
  note(verse, d) {
    const ts = d.at.get(verse);
    if (!ts?.length) return null;
    return ts.length === 1 ? `On the tour: ${ts[0].title}` : `On ${ts.length} tours: ${ts[0].title} and more`;
  },
  Panel,
});
