// How deep the app goes. Everyone starts at Simple and can step down one level
// at a time, so nothing is ever more than a tap away and nothing shows before
// it is wanted.
//
//   Simple  The English text, a verse's strongest links, and plain notes.
//           Anything a first-time reader understands without explanation.
//   Study   The Hebrew and Greek under the English, word studies, word-by-word
//           mode, shared words between linked verses, paths and top verses.
//           Anything that needs the original languages or a short explanation.
//   Deep    Manuscript differences, every link (weak ones too), the numbers
//           behind them, controls for how the map is drawn, and the sources.
//
// New features pick a level and gate their UI with atLeast('study') or
// atLeast('deep'); nothing compares level names directly.

import { signal } from '@preact/signals';
import type { Tab } from './state';

export type Depth = 'simple' | 'study' | 'deep';
export const DEPTHS: readonly Depth[] = ['simple', 'study', 'deep'];

/** Each level's name, and what it adds in one plain sentence: the one cue the
 *  switch's hint and every "go deeper" link share. */
export const DEPTH_INFO: Record<Depth, { label: string; about: string }> = {
  simple: { label: 'Simple', about: 'Simple shows the English and its strongest links.' },
  study: { label: 'Study', about: 'Study adds the Hebrew and Greek, word studies and paths.' },
  deep: { label: 'Deep', about: 'Deep adds manuscripts, every link, the numbers and the sources.' },
};

function initial(): Depth {
  try {
    const v = localStorage.getItem('atlas.depth');
    if (v && (DEPTHS as readonly string[]).includes(v)) return v as Depth;
  } catch {
    // Storage blocked (private window): start simple.
  }
  return 'simple';
}

/** The current level. Remembered per browser. */
export const depth = signal<Depth>(initial());
depth.subscribe((v) => {
  try {
    localStorage.setItem('atlas.depth', v);
  } catch {
    // Ignore: the level just won't be remembered.
  }
});

/** True when the current level is `d` or deeper. Reading it subscribes the caller. */
export function atLeast(d: Depth): boolean {
  return DEPTHS.indexOf(depth.value) >= DEPTHS.indexOf(d);
}

/** Step down to `d` if the reader is not that deep yet (never back up). */
export function deepen(d: Depth): void {
  if (DEPTHS.indexOf(depth.peek()) < DEPTHS.indexOf(d)) depth.value = d;
}

/** The level each study tab appears at. */
export const TAB_DEPTH: Record<Tab, Depth> = {
  connections: 'simple',
  themes: 'simple',
  word: 'study',
  paths: 'study',
  hubs: 'study',
  sources: 'deep',
};
