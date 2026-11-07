// Guided tours (crates/atlas-cli/src/tours.rs, from config/tours.json): a few
// verses to step through in order. A tour shows only Scripture: each step
// selects its verse, so the reader shows it in its chapter, and the map lights
// the cross-references among the tour's verses.

import { computed, signal } from '@preact/signals';
import { loadJson } from '../ui/extras/data';
import type { PathResult } from '../engine/client';
import type { Atlas } from './atlas';
import * as S from '../state';

export interface Tour {
  id: string;
  title: string;
  /** Verse indexes, in order. */
  steps: number[];
}

/** The tour being followed and its step. */
export const touring = signal<{ tour: Tour; at: number } | null>(null);

export function loadTours(a: Atlas): Promise<Tour[]> {
  return loadJson<{ format: number; tours: Tour[] }>(a, 'tours.json').then((f) => f.tours);
}

/** The cross-references among a tour's verses that have at least one net vote. */
function edgesAmong(a: Atlas, steps: number[]): number[] {
  const set = new Set(steps);
  const out: number[] = [];
  for (const v of steps) {
    for (let e = a.xOff[v]; e < a.xOff[v + 1]; e++) {
      if (a.xVotes[e] <= 0) continue;
      const d = a.xDst[e];
      const span = Math.max(1, a.xSpan[e]);
      for (const u of set) if (u !== v && u >= d && u < d + span) out.push(e);
    }
  }
  return [...new Set(out)];
}

const edgeCache = new Map<string, number[]>();

/** The tour drawn on the map, while the reader is on its current step: its
 *  verses as points and the links among them, as a road is drawn. */
export const tourRoad = computed<(PathResult & { tour: true; at: number }) | null>(() => {
  const t = touring.value;
  const a = S.atlas.value;
  if (!t || !a || S.selected.value !== t.tour.steps[t.at]) return null;
  let edges = edgeCache.get(t.tour.id);
  if (!edges) edgeCache.set(t.tour.id, (edges = edgesAmong(a, t.tour.steps)));
  return { verses: t.tour.steps, edges, tour: true, at: t.at };
});

/** Follow a tour from step `at`. */
export function startTour(tour: Tour, at = 0): void {
  touring.value = { tour, at };
  goTo(at);
}

/** Move to step `at` of the tour being followed. */
export function goTo(at: number): void {
  const t = touring.peek();
  if (!t || at < 0 || at >= t.tour.steps.length) return;
  S.theme.value = null;
  S.marks.value = null;
  S.groupEdges.value = null;
  touring.value = { tour: t.tour, at };
  S.selectVerse(t.tour.steps[at], { openTab: true });
}

export function endTour(): void {
  touring.value = null;
}
