// Chapters read: a chapter counts as read once it has been open in the reader
// for half a minute. Kept only in this browser (localStorage atlas.read), as
// the chapters' indexes through the whole Bible. The map lights them on its
// baseline from Study up, so over time the map fills in.

import { signal } from '@preact/signals';

const KEY = 'atlas.read';
/** How long a chapter stays open before it counts as read. */
export const READ_AFTER_MS = 30_000;

function load(): Set<number> {
  try {
    const s = localStorage.getItem(KEY);
    return new Set((s ?? '').split(',').filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0));
  } catch {
    return new Set();
  }
}

/** The chapters read, by index through the Bible (Genesis 1 is 0). */
export const readChapters = signal<ReadonlySet<number>>(load());

export function markRead(chapter: number): void {
  if (readChapters.peek().has(chapter)) return;
  const next = new Set(readChapters.peek());
  next.add(chapter);
  readChapters.value = next;
  try {
    localStorage.setItem(KEY, [...next].sort((x, y) => x - y).join(','));
  } catch {
    // Storage blocked: remembered for this visit only.
  }
}

export function forgetRead(): void {
  readChapters.value = new Set();
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}
