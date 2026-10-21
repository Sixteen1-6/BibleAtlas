// Commentary: people's words about the Bible (notes, answers, interpretations,
// dating views), as against the Bible's own words. It stays closed until the
// reader reaches for it; the first time they do, a two-page notice says it is
// commentary, not God's Word. Finishing the notice opens every kind of
// commentary on this device; "Not now" leaves it closed. Scripture is never
// behind the notice, and the notice never opens on arrival: only a tap asks.
//
// This module is the small part every visit loads. The notice itself
// (Notice.tsx) loads the first time it is asked for.

import { computed, signal } from '@preact/signals';

/** localStorage: the version of the notice the reader finished. Raise it if
 * the words ever change enough to ask again. */
const KEY = 'atlas.commentary';
const VERSION = '1';
/** The one-click opt-in this notice replaced; removed on finishing. */
const OLD_KEY = 'atlas.voices';

function stored(): boolean {
  try {
    return localStorage.getItem(KEY) === VERSION;
  } catch {
    // Storage blocked (some private windows): ask once per visit.
    return false;
  }
}

/** Whether commentary is open on this device: the reader finished the notice. */
export const accepted = signal(stored());

/** The notice on screen: "review" when the reader asked to see it again after
 * finishing it, or null. */
export const notice = signal<{ review: boolean } | null>(null);
/** True while the notice is open. extras/Sheet.tsx leaves Escape to it. */
export const noticeOpen = computed(() => notice.value !== null);

let pending: Promise<boolean> | null = null;
let settle: ((finished: boolean) => void) | null = null;
/** The element that had the focus when the notice was asked for. */
let opener: HTMLElement | null = null;

/** Ask before showing commentary. Resolves true when the reader finishes the
 * notice (or already had), false on "Not now". A second call while the notice
 * is open gets the same answer. */
export function askNotice(): Promise<boolean> {
  if (accepted.peek() && !pending) return Promise.resolve(true);
  return show(false);
}

/** "See the notice again": the same two pages, with "Close" and "I understand". */
export function reviewNotice(): Promise<boolean> {
  return show(accepted.peek());
}

/** "Close commentary again": forget the choice, so every commentary surface
 * closes and the notice comes again next time. */
export function closeCommentary(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the choice only lived in memory anyway.
  }
  accepted.value = false;
}

function show(review: boolean): Promise<boolean> {
  if (pending) return pending;
  pending = new Promise<boolean>((resolve) => (settle = resolve));
  const at = typeof document === 'undefined' ? null : document.activeElement;
  opener = at instanceof HTMLElement && at !== document.body ? at : null;
  pushEntry();
  notice.value = { review };
  return pending;
}

/** The element to give the focus back to when the notice closes. */
export function noticeOpener(): HTMLElement | null {
  return opener && opener.isConnected ? opener : null;
}

/** Notice.tsx: the reader finished the notice (true) or left it (false). */
export function noticeDone(finished: boolean): void {
  const n = notice.peek();
  if (!n) return;
  if (finished && !n.review) {
    try {
      localStorage.setItem(KEY, VERSION);
      localStorage.removeItem(OLD_KEY);
    } catch {
      // Storage blocked: open for this visit only.
    }
    accepted.value = true;
  }
  notice.value = null;
  const resolve = settle;
  pending = null;
  settle = null;
  // Answer once the notice's history entry is gone, so a panel that opens
  // next adds its own entry in the right place.
  void popEntry().then(() => resolve?.(finished));
}

// Phone Back counts as "Not now": while open, the notice is one history entry,
// as the extras panels are. Closing it any other way takes that entry back off.

/** Our history entry is the current one. */
let entry = false;
/** history.back() was called to take it off; its popstate has not arrived. */
let backing: (() => void) | null = null;

function pushEntry(): void {
  try {
    history.pushState(history.state, '', location.href);
    entry = true;
  } catch {
    entry = false;
  }
}

function popEntry(): Promise<void> {
  if (!entry) return Promise.resolve();
  entry = false;
  return new Promise<void>((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      backing = null;
      resolve();
    };
    const timer = window.setTimeout(done, 800);
    backing = done;
    try {
      history.back();
    } catch {
      done();
    }
  });
}

/** When Escape was last pressed while the notice was open, so the dialog's
 * cancel event can tell Escape (ignored) from a phone's Back (Not now). */
let escapeAt = -Infinity;

/** Notice.tsx: the dialog's cancel event came from Escape. */
export function escapeJustPressed(): boolean {
  return performance.now() - escapeAt < 500;
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (backing) return backing();
    // Back while the notice is open: "Not now".
    if (entry && notice.peek()) {
      entry = false;
      noticeDone(false);
    }
  });

  // Registered before any of the app's own key handlers, so while the notice
  // is open none of them hears a key: Escape does nothing at all (it does not
  // close the notice, an open panel or the selection), and "/" or Ctrl+K do
  // not open search behind it. The browser's own keys (Tab, Enter, Space on
  // the notice's buttons) still work.
  window.addEventListener(
    'keydown',
    (e) => {
      if (!notice.peek()) return;
      if (e.key === 'Escape') {
        escapeAt = performance.now();
        e.preventDefault();
      }
      e.stopImmediatePropagation();
      if (e.key === 'Tab') keepTabInside(e);
    },
    true,
  );
}

/** For a browser without <dialog>: Tab wraps around inside the notice. */
function keepTabInside(e: KeyboardEvent): void {
  const box = document.querySelector<HTMLElement>('.cn-dialog[data-fallback]');
  if (!box) return;
  const all = [...box.querySelectorAll<HTMLElement>('button:not([disabled])')];
  if (!all.length) return;
  const i = all.indexOf(document.activeElement as HTMLElement);
  if (e.shiftKey && i <= 0) {
    e.preventDefault();
    all[all.length - 1].focus();
  } else if (!e.shiftKey && (i === -1 || i === all.length - 1)) {
    e.preventDefault();
    all[0].focus();
  }
}
