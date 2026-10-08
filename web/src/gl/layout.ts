// Where each verse sits on the map's horizontal axis, and the arc geometry
// shared by the WebGL shader and the SVG overlay.

import type { Atlas } from '../data/atlas';

/** Space between books, measured in verse widths. */
export const BOOK_GAP = 40;
/** Baseline position as a fraction of the canvas height from the top. */
export const BASELINE = 0.8;
/** Tallest arc as a fraction of the space above the baseline. */
export const HEIGHT = 0.95;
/** Shape exponent: < 1 makes short arcs taller than a semicircle. */
export const SHAPE = 0.6;

export interface View {
  /** Zoom factor, >= 1. */
  scale: number;
  /** Left edge of the visible window, in normalized [0, 1] units. */
  offset: number;
}

/** Normalized x in [0, 1] for every verse, with gaps between books. */
export function verseX(a: Atlas): Float32Array {
  const total = a.n + BOOK_GAP * (a.books.length - 1);
  const xs = new Float32Array(a.n);
  for (let v = 0; v < a.n; v++) xs[v] = (v + 0.5 + BOOK_GAP * a.verseBook[v]) / total;
  return xs;
}

export function clampView(v: View): View {
  const scale = Math.min(Math.max(v.scale, 1), 4000);
  const offset = Math.min(Math.max(v.offset, 0), 1 - 1 / scale);
  return { scale, offset };
}

export function toScreen(xNorm: number, view: View, width: number): number {
  return (xNorm - view.offset) * view.scale * width;
}

/** Nearest verse to a screen x (binary search over the monotonic layout). */
export function verseAt(xs: Float32Array, screenX: number, view: View, width: number): number {
  const target = view.offset + screenX / (view.scale * width);
  let lo = 0;
  let hi = xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(xs[lo - 1] - target) < Math.abs(xs[lo] - target)) lo--;
  return lo;
}

/** Arc height in CSS pixels for two screen x positions (mirrors the shader).
 *  Height grows with span relative to half the map width, so arcs nest
 *  inside each other instead of flattening at the top. */
export function arcHeight(x0: number, x1: number, height: number, width: number): number {
  // Before the map is measured its width is 0: draw nothing rather than NaN.
  if (!(width > 0)) return 0;
  const hmax = height * BASELINE * HEIGHT;
  const r = Math.abs(x1 - x0) / 2;
  return hmax * Math.pow(Math.min(1, r / (width / 2)), SHAPE);
}

/** SVG path for an arc between two screen x positions. */
export function arcPath(x0: number, x1: number, height: number, width: number, segments = 40): string {
  const base = height * BASELINE;
  const h = arcHeight(x0, x1, height, width);
  let d = `M${x0.toFixed(1)},${base.toFixed(1)}`;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    d += `L${(x0 + (x1 - x0) * t).toFixed(1)},${(base - h * Math.sin(Math.PI * t)).toFixed(1)}`;
  }
  return d;
}
