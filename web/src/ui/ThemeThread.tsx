// A theme as a journey: its gold thread through the whole Bible, one tap per
// verse, with every link of the theme one more tap away.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { type Atlas, type Theme, label } from '../data/atlas';
import { THREAD_VOTES, type Thread, linksWithinRows, themeLinksOf, themeThread, themeVerses } from '../data/thread';
import * as S from '../state';
import { OrigLine, Snippet, useVerseRow } from './common';
import { GENRE } from './colors';
import { ThemeHero } from './ThemeSky';
import './themes.css';

type Mode = 'thread' | 'all';
type Group = NonNullable<typeof S.groupEdges.value>;

/** What the Themes panel last put on the map, so it can tell when something
 *  else (a word, a neighborhood, Esc) has replaced it. */
const lit = signal<{ id: string; mode: Mode; group: Group | null } | null>(null);
let generation = 0;

/** Light a theme on the map: its verses as ticks, and either its thread
 *  ('thread') or every link between its verses with 2 or more votes ('all',
 *  the view the Themes panel has always shown). A theme without a thread
 *  shows all its links. */
export async function lightTheme(a: Atlas, id: string, mode: Mode = 'thread', opts: { keepSelection?: boolean } = {}): Promise<void> {
  const th = a.themes.find((x) => x.id === id);
  if (!th) return;
  const gen = ++generation;
  const keep = opts.keepSelection ? S.selected.peek() : null;
  S.theme.value = id;
  S.path.value = null;
  S.selected.value = keep;
  const verses = themeVerses(a, th);
  S.marks.value = { verses, label: `theme:${id}` };
  const thread = themeThread(a, th);
  if (mode === 'thread' && thread.kind === 'thread') {
    const group: Group = { edges: Uint32Array.from(thread.edges), label: `${th.name}: the thread, ${thread.verses.length} verses` };
    S.groupEdges.value = group;
    lit.value = { id, mode, group };
    return;
  }
  lit.value = { id, mode: 'all', group: null };
  let edges: Uint32Array | undefined;
  try {
    edges = await S.engine.peek()?.linksWithin(a.n, verses, 2);
  } catch {
    edges = undefined;
  }
  if (gen !== generation || S.theme.peek() !== id) return;
  edges ??= linksWithinRows(a, verses, 2);
  const group: Group = { edges, label: `${th.name}: ${edges.length.toLocaleString()} links between ${verses.length.toLocaleString()} verses` };
  S.groupEdges.value = group;
  lit.value = { id, mode: 'all', group };
}

// ------------------------------------------------------------ hover previews

/** The verse a study-panel row is previewing on the map, if any. */
let previewing: number | null = null;

/** Mouse-only preview: moving the pointer onto a verse row lights that verse
 *  on the map, and leaving puts the map back. Touch does nothing (a tap
 *  selects). A row that slides under a resting pointer, as when the button
 *  over it goes away, waits for the mouse to move. */
export function useHoverPreview(v: number) {
  useEffect(
    () => () => {
      // The row went away under the pointer (a click that changed the panel).
      if (previewing === v) {
        previewing = null;
        if (S.hovered.peek() === v) S.hovered.value = null;
      }
    },
    [v],
  );
  return {
    onPointerMove: (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || (previewing === v && S.hovered.peek() === v)) return;
      previewing = v;
      S.hovered.value = v;
    },
    onPointerLeave: (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      if (previewing === v) previewing = null;
      if (S.hovered.peek() === v) S.hovered.value = null;
    },
  };
}

/** A clickable verse row that previews its verse on the map under a mouse. */
export function PreviewRow({ v, class: cls, onClick, children }: { v: number; class?: string; onClick?: () => void; children: ComponentChildren }) {
  const hover = useHoverPreview(v);
  return (
    <div class={cls} data-lv={v} onClick={onClick} {...hover}>
      {children}
    </div>
  );
}

/** The first few items, then a button for the rest. */
export function Few<T>({ items, first, more, children }: { items: T[]; first: number; more?: (n: number) => string; children: (item: T, i: number) => ComponentChildren }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, first);
  return (
    <>
      {shown.map((x, i) => children(x, i))}
      {items.length > shown.length && (
        <button class="btn tj-more" onClick={() => setAll(true)}>
          {more ? more(items.length) : `Show all ${items.length}`}
        </button>
      )}
    </>
  );
}

// ------------------------------------------------------------ the journey

/** Nearest scrolling ancestor of an element. */
function scroller(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

const smooth = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/** Scroll the panel just enough to show a step whole (its top, if it is taller
 *  than the panel), clear of the "Back to the thread" button at the bottom. */
function reveal(el: Element | null | undefined): void {
  const box = scroller(el as HTMLElement | null);
  if (!el || !box) return;
  const r = el.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  let d = Math.max(0, r.bottom - (b.bottom - 64));
  d = Math.min(d, r.top - (b.top + 8));
  if (d > 0 || r.top < b.top) box.scrollBy({ top: d, behavior: smooth() });
}

/** A tapped step, opened up: the whole verse, and its Hebrew or Greek with the theme's word marked. */
function StepDetail({ a, v, roots }: { a: Atlas; v: number; roots: Set<number> }) {
  const row = useVerseRow(a, v);
  const ref = useRef<HTMLDivElement>(null);
  // Once its text is in, the opened step scrolls into view.
  useEffect(() => reveal(ref.current?.closest('li')), [row !== null]);
  return (
    <div class="tj-detail" ref={ref}>
      {row ? <p class="tj-full">{row[0]}</p> : <p class="tj-full muted">…</p>}
      {row && <OrigLine a={a} v={v} row={row} mark={roots} />}
      <button class="tj-link" onClick={() => S.selectVerse(v)}>
        Every link of {label(a, v)} ›
      </button>
    </div>
  );
}

function Step({ a, i, v, prev, edge, on, roots }: { a: Atlas; i: number; v: number; prev?: number; edge?: number; on: boolean; roots: Set<number> }) {
  const hover = useHoverPreview(v);
  const genre = a.books[a.verseBook[v]].genre;
  const votes = edge !== undefined ? a.xVotes[edge] : undefined;
  return (
    <li class={`tj-li${on ? ' is-on' : ''}`} data-step={i} style={`--tj-g:${GENRE[genre]?.color ?? 'var(--accent)'}`}>
      <button class="tj-step" data-lv={v} aria-current={on ? 'step' : undefined} onClick={() => S.selectVerse(v, { openTab: false })} {...hover}>
        <span class="tj-n" aria-hidden="true">
          {i + 1}
        </span>
        <span class="tj-ref">{label(a, v)}</span>
        {votes !== undefined && prev !== undefined && (
          <span class="tj-votes" title={`OpenBible.info readers gave the link from ${label(a, prev)} to ${label(a, v)} ${votes} net votes`}>
            {votes} votes
          </span>
        )}
        <Snippet a={a} v={v} max={160} />
      </button>
      {on && <StepDetail a={a} v={v} roots={roots} />}
    </li>
  );
}

/** The chosen theme: its sky, its thread as numbered steps, and what the map
 *  shows. Mount it with key={theme.id}. */
export function ThemeJourney({ a, theme }: { a: Atlas; theme: Theme }) {
  const root = useRef<HTMLElement>(null);
  const thread: Thread = useMemo(() => themeThread(a, theme), [a, theme]);
  const verses = useMemo(() => themeVerses(a, theme), [a, theme]);
  const allCount = useMemo(() => linksWithinRows(a, verses, 2).length, [a, verses]);
  const skyLinks = useMemo(() => themeLinksOf(a, theme, 2), [a, theme]);
  const roots = useMemo(() => new Set(theme.roots), [theme]);
  const sel = S.selected.value;
  const g = S.groupEdges.value;
  const l = lit.value;
  // What the map shows for this theme right now (null: something else).
  const mode: Mode | null = l && l.id === theme.id && (l.group === null || l.group === g) ? l.mode : null;
  const on = sel === null ? -1 : thread.verses.indexOf(sel);
  const isThread = thread.kind === 'thread';

  // A shared #t= link restores the theme's ticks but not its light. Light the
  // thread, once, unless something else has taken the map since.
  useEffect(() => {
    const m = S.marks.peek();
    const ge = S.groupEdges.peek();
    const mine = `theme:${theme.id}`;
    const staleTheme = m === null || (m.label.startsWith('theme:') && m.label !== mine);
    const ours = ge === null || ge === lit.peek()?.group;
    if ((m?.label === mine && ge === null) || (staleTheme && ours)) lightTheme(a, theme.id, 'thread', { keepSelection: true });
  }, [a, theme.id]);

  // A newly chosen theme opens at the top of the panel, hero first.
  useEffect(() => {
    const el = root.current;
    const box = scroller(el);
    if (!el || !box) return;
    if (el.getBoundingClientRect().top < box.getBoundingClientRect().top) box.scrollTop = 0;
  }, [theme.id]);

  const step = (i: number) => {
    S.selectVerse(thread.verses[i], { openTab: false });
    reveal(root.current?.querySelector(`[data-step="${i}"]`));
  };

  return (
    <section class="tj-journey" ref={root} aria-label={`${theme.name}, traced through the Bible`}>
      <ThemeHero a={a} theme={theme} thread={thread} mode={mode} links={skyLinks} onStep={step} />
      <p class="tj-intro">
        <b>{theme.name}</b> {theme.blurb}
      </p>
      {thread.verses.length > 0 && (
        <>
          <h3 class="tj-h">
            {isThread ? 'The thread' : 'Key verses (not a linked chain)'}
            <span> · {thread.verses.length} verses</span>
          </h3>
          <ol class={`tj-steps${isThread ? '' : ' is-key'}`}>
            {thread.verses.map((v, i) => (
              <Step key={v} a={a} i={i} v={v} prev={thread.verses[i - 1]} edge={isThread && i > 0 ? thread.edges[i - 1] : undefined} on={i === on} roots={roots} />
            ))}
          </ol>
        </>
      )}
      {sel !== null && (
        <button class="tj-back" onClick={() => (S.selected.value = null)}>
          {isThread ? 'Back to the thread' : 'Back to the theme'}
        </button>
      )}
      {isThread ? (
        <div class="tj-seg" role="group" aria-label="What the map shows">
          <button aria-pressed={mode === 'thread'} onClick={() => lightTheme(a, theme.id, 'thread')}>
            Just the thread
          </button>
          <button aria-pressed={mode === 'all'} onClick={() => lightTheme(a, theme.id, 'all')}>
            All {allCount.toLocaleString()} links
          </button>
        </div>
      ) : (
        mode === null &&
        allCount > 0 && (
          <button class="btn tj-relight" onClick={() => lightTheme(a, theme.id, 'all')}>
            Show its {allCount.toLocaleString()} links on the map
          </button>
        )
      )}
      <p class="tj-why">
        {isThread
          ? `The thread is computed, not chosen by hand: the strongest chain of links with ${THREAD_VOTES} or more votes between this theme's verses that moves forward through the Bible and ends at one of its most central New Testament verses.`
          : `These verses are not a linked chain: no chain of 4 or more links with ${THREAD_VOTES} or more votes moves forward through this theme's verses to one of its most central New Testament verses. They are its most central verses, in Bible order.`}
      </p>
    </section>
  );
}
