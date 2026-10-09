// On a plain first visit the app selects a verse by itself, so an extra's data
// would download before the reader has done anything. readerHere() lets an
// extra's load() wait for the reader's first tap, key, scroll or change of
// address instead. A link to a verse, or to the extra's own panel, loads at once.

/** The address the reader arrived at, read before the app rewrites it. */
const ARRIVED = typeof location === 'undefined' ? '' : location.hash;
/** The reader's own first move. The app writes the address with replaceState
 * and pushState, which fire no hashchange, so a hashchange is the reader's. */
const FIRST_TOUCH = ['pointerdown', 'touchstart', 'keydown', 'wheel', 'click', 'hashchange', 'popstate'] as const;
let touched: Promise<void> | null = null;

function firstMove(): Promise<void> {
  if (!touched) {
    touched =
      typeof addEventListener !== 'function'
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const go = () => {
              for (const t of FIRST_TOUCH) removeEventListener(t, go, true);
              resolve();
            };
            for (const t of FIRST_TOUCH) addEventListener(t, go, { capture: true, passive: true });
          });
  }
  return touched;
}

/** Resolves at once when the reader arrived on a link to a verse, a chapter or this
 * extra's panel (x=<id>), else at the reader's first move. */
export function readerHere(id: string): Promise<void> {
  const h = new URLSearchParams(ARRIVED.slice(1));
  return h.has('v') || h.has('r') || h.get('x') === id ? Promise.resolve() : firstMove();
}
