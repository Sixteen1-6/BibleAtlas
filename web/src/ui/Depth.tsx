// The Simple / Study / Deep switch, and the "go deeper" links that step down
// one level from wherever a reader is.
//
// What each level adds is said in one plain sentence under the switch: while
// a mouse rests on a level or the keyboard is on it, and for a few seconds
// after the level changes, whatever changed it (a tap on the switch, a "go
// deeper" link, a word study). Touch screens get it from the tap.

import type { ComponentChildren } from 'preact';
import { signal } from '@preact/signals';
import { DEPTHS, DEPTH_INFO, type Depth, TAB_DEPTH, atLeast, deepen, depth } from '../depth';
import * as S from '../state';

/** How long the hint stays after a change, in ms. */
const HINT_MS = 5000;

/** The level the hint describes, and whether it is pinned by a pointer or focus. */
const hint = signal<{ d: Depth; held: boolean } | null>(null);
let timer = 0;
/** The last level described, kept so the hint fades out with its words. */
let shown: Depth | null = null;

function showFor(d: Depth): void {
  window.clearTimeout(timer);
  hint.value = { d, held: false };
  timer = window.setTimeout(() => {
    if (hint.peek()?.held === false) hint.value = null;
  }, HINT_MS);
}

function hold(d: Depth): void {
  window.clearTimeout(timer);
  hint.value = { d, held: true };
}

function release(d: Depth): void {
  if (hint.peek()?.d === d && hint.peek()?.held) hint.value = null;
}

// Any change of level, from anywhere, says what the new level adds.
let last = depth.peek();
depth.subscribe((d) => {
  if (d === last) return;
  last = d;
  showFor(d);
});

export function DepthControl() {
  const cur = depth.value;
  const h = hint.value;
  if (h) shown = h.d;
  const pick = (d: Depth) => {
    depth.value = d;
    if (!atLeast(TAB_DEPTH[S.tab.peek()])) S.tab.value = 'connections';
    // Tapping the level already on still says what it is.
    showFor(d);
  };
  return (
    <div class="depthwrap">
      <div class="seg depthseg" role="group" aria-label="How deep to go">
        {DEPTHS.map((d) => (
          <button
            key={d}
            aria-pressed={cur === d}
            aria-describedby={h?.d === d ? 'depth-hint' : undefined}
            onClick={() => pick(d)}
            onPointerEnter={(e) => e.pointerType === 'mouse' && hold(d)}
            onPointerLeave={() => release(d)}
            onFocus={(e) => (e.currentTarget as HTMLElement).matches(':focus-visible') && hold(d)}
            onBlur={() => release(d)}
          >
            {DEPTH_INFO[d].label}
          </button>
        ))}
      </div>
      <p id="depth-hint" class={`depthhint${h ? ' on' : ''}`} role="status" aria-hidden={!h}>
        {shown ? DEPTH_INFO[shown].about : ''}
      </p>
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
    <button class="godeeper" onClick={go} title={`Switch to ${DEPTH_INFO[to].label}. ${DEPTH_INFO[to].about}`}>
      {children} ›
    </button>
  );
}
