// Looking around from inside a panel without losing it.
//
// A verse named inside a panel (a link in a writer's words, a passage's name)
// opens a look at that passage inside the same panel, with Back in the
// panel's header to return to where the reader was, scrolled as they left it.
// Looks can go several deep. Each one is a history entry carrying the list of
// verses looked at, so the browser's Back and a phone's back gesture step back
// through them too, and coming Back from the reader returns to the look the
// reader left from. "Read in the Bible" in a look takes the reader there.
//
// The panel's Back steps back through the looks, and with none left closes
// the panel, so the side column's own Back (ui/PanelNav.tsx) carries on from
// there: one Back for the whole side. Its Full page is the side column's too
// (S.panelWide), so both say and do the same thing.

import { signal } from '@preact/signals';
import type { VerseRef } from './types';

/** The verses being looked at from the open panel, the latest last. */
export const peeks = signal<VerseRef[]>([]);

const KEY = 'atlasPeek';

function fromState(state: unknown): VerseRef[] {
  const list = (state as Record<string, unknown> | null)?.[KEY];
  return Array.isArray(list) ? list.filter((v): v is number => Number.isInteger(v) && v >= 0) : [];
}

/** Where each level was scrolled when the reader looked further, to return there. */
export const places: number[] = [];

/** Look at a verse from inside the panel: a new history entry, so Back returns. */
export function peek(v: VerseRef): void {
  const cur = peeks.peek();
  if (cur[cur.length - 1] === v) return;
  places[cur.length] = document.querySelector<HTMLElement>('.xt-panel .xt-body')?.scrollTop ?? 0;
  const next = [...cur, v];
  try {
    const base = history.state && typeof history.state === 'object' ? history.state : {};
    history.pushState({ ...base, [KEY]: next }, '', location.href);
  } catch {
    // No history: the panel's own Back still works.
  }
  peeks.value = next;
}

/** Back one look (the panel's Back button). */
export function unpeek(): void {
  if (!peeks.peek().length) return;
  if (fromState(history.state).length === peeks.peek().length) history.back();
  else peeks.value = peeks.peek().slice(0, -1);
}

/** The panel closed: forget the looks (their history entries stay, and Back
 * through them brings the panel and the look back). */
export function clearPeeks(): void {
  if (peeks.peek().length) peeks.value = [];
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (e) => {
    peeks.value = fromState(e.state);
  });
}
