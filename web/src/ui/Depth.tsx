// The Simple / Study / Deep switch, and the "go deeper" links that step down
// one level from wherever a reader is.

import type { ComponentChildren } from 'preact';
import { DEPTHS, DEPTH_INFO, type Depth, TAB_DEPTH, atLeast, deepen, depth } from '../depth';
import * as S from '../state';

export function DepthControl() {
  const cur = depth.value;
  const pick = (d: Depth) => {
    depth.value = d;
    if (!atLeast(TAB_DEPTH[S.tab.peek()])) S.tab.value = 'connections';
  };
  return (
    <div class="seg depthseg" role="group" aria-label="How deep to go">
      {DEPTHS.map((d) => (
        <button key={d} aria-pressed={cur === d} title={DEPTH_INFO[d].about} onClick={() => pick(d)}>
          {DEPTH_INFO[d].label}
        </button>
      ))}
    </div>
  );
}

/** A quiet link that steps down to `to`; hidden once the reader is that deep.
 * With `toTop`, the study panel scrolls back up to show what just appeared. */
export function GoDeeper({ to, toTop, children }: { to: Depth; toTop?: boolean; children: ComponentChildren }) {
  if (atLeast(to)) return null;
  const go = (e: MouseEvent) => {
    if (toTop) (e.currentTarget as HTMLElement).closest('.study')?.scrollTo({ top: 0 });
    deepen(to);
  };
  return (
    <button class="godeeper" onClick={go} title={`Switch to ${DEPTH_INFO[to].label}. ${DEPTH_INFO[to].about}.`}>
      {children} ›
    </button>
  );
}
