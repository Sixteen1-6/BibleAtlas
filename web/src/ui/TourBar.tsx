// The bar at the top of the reader while a guided tour is followed
// (data/tours.ts): its title, where the reader is, and Back, Next and End.

import { label } from '../data/atlas';
import { endTour, goTo, touring } from '../data/tours';
import * as S from '../state';

export function TourBar() {
  const t = touring.value;
  const a = S.atlas.value;
  if (!t || !a) return null;
  const n = t.tour.steps.length;
  // The reader may tap other verses on the way: the bar then offers the way back.
  const here = S.selected.value === t.tour.steps[t.at];
  const last = t.at === n - 1;
  return (
    <div class="tourbar" role="region" aria-label={`Guided tour: ${t.tour.title}`}>
      <span class="tb-name">
        <b>{t.tour.title}</b>
        <span class="tb-at">
          {t.at + 1} of {n} · {label(a, t.tour.steps[t.at])}
        </span>
      </span>
      <span class="tb-go">
        {here ? (
          <>
            <button class="btn" disabled={t.at === 0} onClick={() => goTo(t.at - 1)}>
              ‹ Back
            </button>
            {last ? (
              <button class="btn tb-next" onClick={endTour}>
                Finish
              </button>
            ) : (
              <button class="btn tb-next" onClick={() => goTo(t.at + 1)}>
                Next ›
              </button>
            )}
          </>
        ) : (
          <button class="btn tb-next" onClick={() => goTo(t.at)}>
            Back to the tour
          </button>
        )}
        <button class="btn tb-end" onClick={endTour} aria-label="End the tour" title="End the tour">
          ×
        </button>
      </span>
    </div>
  );
}
