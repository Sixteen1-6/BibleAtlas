// Application state as signals: any component reading a signal re-renders
// when it changes, and nothing else does.

import { computed, signal } from '@preact/signals';
import type { Atlas } from './data/atlas';
import type { Engine, PathResult } from './engine/client';
import type { View } from './gl/layout';
import type { ArcColorMode } from './ui/colors';

export type Tab = 'connections' | 'word' | 'themes' | 'paths' | 'hubs' | 'sources';
export type Translation = 'BSB' | 'ESV';

export const atlas = signal<Atlas | null>(null);
export const engine = signal<Engine | null>(null);

/** Selected verse (drives the map focus, the reader highlight and Connections). */
export const selected = signal<number | null>(null);
/** Verse under the pointer on the map. */
export const hovered = signal<number | null>(null);
/** Chapter shown in the reader. */
export const reading = signal<{ book: number; chapter: number }>({ book: 42, chapter: 1 });
/** Root shown in Word study, with the occurrence that was clicked. */
export const study = signal<{ root: number; verse?: number; pos?: number } | null>(null);
export const tab = signal<Tab>('connections');
export const theme = signal<string | null>(null);
export const path = signal<(PathResult & { ms: number }) | null>(null);

/** Verses marked with ticks on the map (theme, word or search hits). */
export const marks = signal<{ verses: Uint32Array; label: string } | null>(null);
/** Edges drawn bright on the map besides the selection (theme or word links). */
export const groupEdges = signal<{ edges: Uint32Array; label: string } | null>(null);

export const minVotes = signal(8);
export const translation = signal<Translation>('BSB');
export const mapMode = signal<'arcs' | 'wheel'>('arcs');

function stored<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  let initial = fallback;
  try {
    const v = localStorage.getItem(key);
    if (v && (allowed as readonly string[]).includes(v)) initial = v as T;
  } catch {
    // Storage blocked (private window): fall back to the default.
  }
  const s = signal<T>(initial);
  s.subscribe((v) => {
    try {
      localStorage.setItem(key, v);
    } catch {
      // Ignore: the choice just won't be remembered.
    }
  });
  return s;
}

/** How the arcs are colored. Remembered per browser. */
export const arcColor = stored<ArcColorMode>('atlas.arcColor', ['spectrum', 'reach', 'genre'], 'spectrum');
export const view = signal<View>({ scale: 1, offset: 0 });
/** The first-visit card above the reader. Hidden for good once dismissed. */
export const welcome = stored<'show' | 'hidden'>('atlas.welcome', ['show', 'hidden'], 'show');
export const interlinear = signal(false);
export const showOtherEditions = signal(false);
export const paletteOpen = signal(false);
/** Set when a selection should not scroll the reader (the first-visit default). */
export const holdReaderScroll = signal(false);
export const mobilePane = signal<'read' | 'study'>('read');

/** How many cross-references pass the current vote filter. */
export const visibleEdges = computed(() => {
  const a = atlas.value;
  if (!a) return 0;
  const m = minVotes.value;
  let c = 0;
  for (let i = 0; i < a.xVotes.length; i++) if (a.xVotes[i] >= m) c++;
  return c;
});

// ------------------------------------------------------------ URL state
// Every view is linkable: #v=John.3.16&w=G0026&t=lamb&p=Gen.3.15~Rev.12.9

export function selectVerse(v: number | null, opts: { scroll?: boolean; openTab?: boolean } = {}): void {
  const a = atlas.value;
  selected.value = v;
  path.value = null;
  if (v !== null && a) {
    const b = a.verseBook[v];
    let c = 0;
    // Chapter of v: largest chapter start <= v within the book.
    for (let i = a.bookChapterStart[b]; i < a.bookChapterStart[b + 1]; i++) if (a.chapterStart[i] <= v) c = i;
    reading.value = { book: b, chapter: c - a.bookChapterStart[b] + 1 };
    if (opts.openTab !== false) tab.value = 'connections';
  }
}

/** Back to the plain map: no selection, path, theme or highlighted words. */
export function clearAll(): void {
  selected.value = null;
  path.value = null;
  marks.value = null;
  groupEdges.value = null;
  theme.value = null;
}

/** True while anything is highlighted on the map, so there is something to clear. */
export const anythingLit = computed(() => selected.value !== null || path.value !== null || marks.value !== null || groupEdges.value !== null);

export function openRoot(root: number, verse?: number, pos?: number): void {
  study.value = { root, verse, pos };
  tab.value = 'word';
  mobilePane.value = 'study';
}

/** Page theme: follow the system, or force light or dark. Remembered per browser. */
export const pageTheme = stored<'system' | 'light' | 'dark'>('atlas.theme', ['system', 'light', 'dark'], 'system');
pageTheme.subscribe((t) => {
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
});
