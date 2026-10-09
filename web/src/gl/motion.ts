// Motion for the arc map: one clock, a few easing curves, a live "reduce
// motion" flag, and a single requestAnimationFrame driver shared by every
// animated thing on the page. The driver stops as soon as nothing is moving,
// so a still map costs no frames at all.

/** Seconds on the page's monotonic clock (the clock requestAnimationFrame uses). */
export function now(): number {
  return performance.now() / 1000;
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Fast start, gentle landing: for light growing along an arc and for fades. */
export function easeOut(x: number): number {
  const y = 1 - clamp01(x);
  return 1 - y * y * y;
}

/** Gentle start and landing: for the opening reveal and the theme sweep. */
export function easeInOut(x: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * clamp01(x));
}

// ------------------------------------------------------------ reduced motion

const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
let reduce = !!motionQuery?.matches;
motionQuery?.addEventListener?.('change', (e) => {
  reduce = e.matches;
});

/** True while the visitor has asked their system for less motion. It follows the setting live. */
export function reducedMotion(): boolean {
  return reduce;
}

// ------------------------------------------------------------ frame driver

/** A frame callback. It receives the clock in seconds and returns true while it needs more frames. */
export type Tick = (t: number) => boolean;

const ticks = new Set<Tick>();
let pending = 0;
let running = false;

/** Run `tick` on the next animation frame, and on every frame after that while it returns true. */
export function wake(tick: Tick): void {
  ticks.add(tick);
  if (!pending && !running) pending = requestAnimationFrame(frame);
}

/** Stop calling `tick`. The loop stops once no tick is left. */
export function sleep(tick: Tick): void {
  ticks.delete(tick);
  if (!ticks.size && pending) {
    cancelAnimationFrame(pending);
    pending = 0;
  }
}

function frame(): void {
  pending = 0;
  running = true;
  const t = now();
  const batch = [...ticks];
  ticks.clear();
  for (const tick of batch) {
    let again = false;
    try {
      again = tick(t);
    } catch (e) {
      // One broken animation must not stop the others; report it and drop it.
      console.error(e);
    }
    if (again) ticks.add(tick);
  }
  running = false;
  if (ticks.size && !pending) pending = requestAnimationFrame(frame);
}
