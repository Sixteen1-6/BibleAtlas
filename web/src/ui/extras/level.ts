// The depth level an extra's note appears at, wired to the app's
// Simple / Study / Deep switch (src/depth.ts).
//
//   simple  one plain line a first-time reader understands
//   study   the texts side by side
//   deep    the original words, the data and the sources

import { atLeast, type Depth } from '../../depth';

export type Level = Depth;
export const LEVELS: readonly Level[] = ['simple', 'study', 'deep'];

/** True when the reader is at `level` or deeper. Calling it during render
 * re-renders the component when the reader changes level. */
export function levelAtLeast(level: Level): boolean {
  return atLeast(level);
}
