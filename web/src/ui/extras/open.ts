// Which extra's panel is open, and how it opens and closes.
//
// - The open panel is part of the link: #v=Matt.3.3&tab=connections&x=quotes
//   (a verse panel, for the selected verse) or &x=places.chapter (a chapter
//   panel, for the chapter being read). url.ts calls extraFromHash and
//   extraToHash, one line each.
// - Opening a panel from its note adds one history entry, so Back (and the
//   phone's back gesture) closes it. Closing it with Escape, the close button,
//   a tap outside or a swipe down takes that entry back off again.
// - A verse panel closes when another verse is selected; a chapter panel when
//   the reader moves to another chapter.

import { effect, signal } from '@preact/signals';
import * as S from '../../state';
import type { ChapterRef, VerseRef } from './types';

export interface OpenPanel {
  id: string;
  kind: 'verse' | 'chapter';
  /** The verse a verse panel belongs to. */
  verse: VerseRef | null;
  /** The chapter a chapter panel belongs to. */
  chapter: ChapterRef | null;
  /** Opened from a link rather than a tap. */
  fromLink: boolean;
}

export const openPanel = signal<OpenPanel | null>(null);

/** The control that opened the panel, to get focus back on close. */
let opener: HTMLElement | null = null;
/** Set while the history entry added by opening is the current one. */
let pushed: { hash: string } | null = null;
/** history.back() was called and its popstate has not arrived yet. */
let backPending = false;

const ID = /^[a-z][a-z0-9-]{0,31}$/;

export function openerElement(): HTMLElement | null {
  return opener && opener.isConnected ? opener : null;
}

/** Name the control that opened a panel some other way (Ask the Bible from a
 *  Nave's heading), so closing hands the focus back to it. */
export function setOpener(el: HTMLElement | null): void {
  opener = el;
}

/** Open an extra's panel from a tap on its note. */
export function openExtra(id: string, kind: 'verse' | 'chapter', at: VerseRef | ChapterRef, from?: HTMLElement | null): void {
  if (backPending || S.paletteOpen.peek()) return;
  const cur = openPanel.peek();
  if (!cur) {
    try {
      history.pushState(history.state, '', location.href);
      pushed = { hash: location.hash };
    } catch {
      pushed = null;
    }
  }
  opener = from ?? null;
  openPanel.value =
    kind === 'verse'
      ? { id, kind, verse: at as VerseRef, chapter: null, fromLink: false }
      : { id, kind, verse: null, chapter: { ...(at as ChapterRef) }, fromLink: false };
}

/**
 * Close the open panel.
 * - 'dismiss': the reader closed it (Escape, the close button, a tap outside, a
 *   swipe down), or it no longer applies. The history entry that opening it
 *   added is taken back off, if the address is otherwise unchanged.
 * - 'navigate': it is closing to move the reader to a verse. That history
 *   entry stays, so Back returns to where the reader was.
 * - 'quiet': something else is taking over the view (another verse, a word
 *   study, the sources, search). No history step is taken.
 */
export function closeExtra(how: 'dismiss' | 'navigate' | 'quiet' = 'dismiss'): void {
  if (!openPanel.peek()) return;
  const p = pushed;
  pushed = null;
  openPanel.value = null;
  // url.ts has now rewritten the address without x=. If it matches the entry
  // under ours, step back onto it: same address, so nothing else reloads.
  if (how === 'dismiss' && p && location.hash === p.hash) {
    backPending = true;
    window.setTimeout(() => (backPending = false), 800);
    try {
      history.back();
    } catch {
      backPending = false;
    }
  }
}

/** url.ts, restoreFromHash: read x= after the verse and chapter are restored. */
export function extraFromHash(h: URLSearchParams): void {
  pushed = null;
  const x = h.get('x');
  const [id, kind, extra] = (x ?? '').split('.');
  if (!x || !ID.test(id) || extra !== undefined || (kind !== undefined && kind !== 'chapter')) {
    openPanel.value = null;
    return;
  }
  const sel = S.selected.peek();
  if (kind === 'chapter') openPanel.value = { id, kind: 'chapter', verse: null, chapter: { ...S.reading.peek() }, fromLink: true };
  else openPanel.value = sel === null ? null : { id, kind: 'verse', verse: sel, chapter: null, fromLink: true };
}

/** url.ts, syncHash: write x= for the open panel. */
export function extraToHash(h: URLSearchParams): void {
  const o = openPanel.value;
  if (o) h.set('x', o.kind === 'chapter' ? `${o.id}.chapter` : o.id);
}

// A verse panel belongs to its verse, a chapter panel to its chapter.
effect(() => {
  const sel = S.selected.value;
  const r = S.reading.value;
  const o = openPanel.peek();
  if (!o) return;
  const stale = o.kind === 'verse' ? o.verse !== sel : o.chapter?.book !== r.book || o.chapter?.chapter !== r.chapter;
  if (stale) closeExtra('quiet');
});

// Search opens on top of everything; the panel gives way to it.
effect(() => {
  if (S.paletteOpen.value) closeExtra('quiet');
});

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    backPending = false;
  });
}
