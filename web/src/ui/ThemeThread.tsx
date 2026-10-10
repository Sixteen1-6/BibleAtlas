// A theme as a journey: its gold thread through the whole Bible, one tap per
// verse, with every link of the theme one more tap away.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { type Atlas, type Theme, label, rangeLabel } from '../data/atlas';
import { type BridgeTable, loadBridges } from '../data/bridges';
import { type ThemeLevel, inTheme, linksBetween, shownAt, themesThroughLinks, verseThemes, whereItFits } from '../data/themes';
import { ALL_VOTES, THREAD_VOTES, type Thread, linksWithinRows, themeLinkCount, themeThread, themeVerses } from '../data/thread';
import { atLeast } from '../depth';
import * as S from '../state';
import { OrigLine, RootChip, Snippet, useVerseRow } from './common';
import { GENRE, KIND } from './colors';
import { ThemeHero } from './ThemeSky';
import './themes.css';

type Mode = 'thread' | 'all';
type Group = NonNullable<typeof S.groupEdges.value>;

/** What the Themes panel last put on the map, so it can tell when something
 *  else (a word, a neighborhood, Esc) has replaced it. */
const lit = signal<{ id: string; mode: Mode; group: Group | null } | null>(null);
let generation = 0;

/** Light a theme on the map: its verses as ticks, and either its thread
 *  ('thread') or every link between its verses with ALL_VOTES or more votes
 *  ('all', the view the Themes panel has always shown). A theme without a
 *  thread shows all its links. */
export async function lightTheme(a: Atlas, id: string, mode: Mode = 'thread', opts: { keepSelection?: boolean } = {}): Promise<void> {
  const th = a.themes.find((x) => x.id === id);
  if (!th) return;
  const gen = ++generation;
  const keep = opts.keepSelection ? S.selected.peek() : null;
  if (S.theme.peek() !== id) handOff = document.activeElement?.closest('.study') ? id : null;
  // The verse it was opened from is let go with the selection.
  if (!opts.keepSelection) themeFrom.value = null;
  S.theme.value = id;
  S.path.value = null;
  S.selected.value = keep;
  const verses = themeVerses(a, th);
  S.marks.value = { verses, label: `theme:${id}` };
  const thread = themeThread(a, th);
  if (mode === 'thread' && thread.kind === 'thread') {
    const group: Group = { edges: Uint32Array.from(thread.edges), label: `${th.name}: the thread, ${thread.verses.length} verses`, color: KIND.thread };
    S.groupEdges.value = group;
    lit.value = { id, mode, group };
    return;
  }
  lit.value = { id, mode: 'all', group: null };
  let edges: Uint32Array | undefined;
  try {
    edges = await S.engine.peek()?.linksWithin(a.n, verses, ALL_VOTES);
  } catch {
    edges = undefined;
  }
  if (gen !== generation || S.theme.peek() !== id) return;
  edges ??= linksWithinRows(a, verses, ALL_VOTES);
  const group: Group = { edges, label: `${th.name}: ${edges.length.toLocaleString()} links between ${verses.length.toLocaleString()} verses` };
  S.groupEdges.value = group;
  lit.value = { id, mode: 'all', group };
}

/** The verse a theme was opened from (a chip on its themes card, or a theme
 *  name under the journey), while that theme stays open with the verse kept. */
export const themeFrom = signal<{ verse: number; theme: string } | null>(null);
S.theme.subscribe((t) => {
  if (themeFrom.peek() && themeFrom.peek()!.theme !== t) themeFrom.value = null;
});

/** The theme just chosen from a control in the study panel (a card, a chip,
 *  the list). That control goes away with the list or the old journey, so
 *  the new journey takes the focus in its place. */
let handOff: string | null = null;

/** Put the map back to plain: no theme, path, ticks or lit links. The
 *  selected verse stays. */
export function closeTheme(): void {
  themeFrom.value = null;
  S.theme.value = null;
  S.path.value = null;
  S.marks.value = null;
  S.groupEdges.value = null;
}

/** Open a theme from a verse's themes card: the theme lights up and the verse
 *  stays selected, so the journey can say where the verse fits. */
export function openThemeFromVerse(a: Atlas, id: string, verse: number): void {
  void lightTheme(a, id, 'thread', { keepSelection: true });
  themeFrom.value = { verse, theme: id };
}

/** The level whose themes show: Simple, or Study (which Deep includes). */
export function themeLevel(): ThemeLevel {
  return atLeast('study') ? 'study' : 'simple';
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

/** A clickable verse row that previews its verse on the map under a mouse.
 *  It works from the keyboard too: Tab to it, then Enter or Space. */
export function PreviewRow({ v, class: cls, onClick, children }: { v: number; class?: string; onClick?: () => void; children: ComponentChildren }) {
  const hover = useHoverPreview(v);
  return (
    <div
      class={cls}
      data-lv={v}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onClick?.();
      }}
      {...hover}
    >
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

/** Where the visible part of a scroller begins: below any sticky bar pinned
 *  to its top, such as the study panel's tabs. */
function visibleTop(box: HTMLElement): number {
  let top = box.getBoundingClientRect().top;
  for (const child of Array.from(box.children)) {
    if (getComputedStyle(child).position !== 'sticky') continue;
    const r = child.getBoundingClientRect();
    if (r.top <= top + 1 && r.bottom > top) top = r.bottom;
  }
  return top;
}

const smooth = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/** Scroll the panel just enough to show a step whole (its top, if it is taller
 *  than the panel), clear of the tab bar at the top and of the "Back to the
 *  thread" button at the bottom. */
function reveal(el: Element | null | undefined): void {
  const box = scroller(el as HTMLElement | null);
  if (!el || !box) return;
  const r = el.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const top = visibleTop(box);
  let d = Math.max(0, r.bottom - (b.bottom - 64));
  d = Math.min(d, r.top - (top + 8));
  if (d > 0 || r.top < top) box.scrollBy({ top: d, behavior: smooth() });
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
      <button class="tj-link" onClick={() => S.selectVerse(v, { openTab: true })}>
        Every link of {label(a, v)} ›
      </button>
    </div>
  );
}

/** One of the verses a theme's description speaks of: a tap selects it,
 *  and the line under the sky says where it fits. */
function KeyVerse({ a, v }: { a: Atlas; v: number }) {
  const hover = useHoverPreview(v);
  return (
    <button type="button" class="tj-key" data-lv={v} onClick={() => S.selectVerse(v, { openTab: false })} {...hover}>
      {label(a, v)}
    </button>
  );
}

function Step({ a, i, v, edge, on, roots }: { a: Atlas; i: number; v: number; edge?: number; on: boolean; roots: Set<number> }) {
  const hover = useHoverPreview(v);
  const genre = a.books[a.verseBook[v]].genre;
  const votes = edge !== undefined ? a.xVotes[edge] : undefined;
  return (
    <li class={`tj-li${on ? ' is-on' : ''}`} data-step={i} style={`--tj-g:${GENRE[genre]?.color ?? 'var(--accent)'}`}>
      <button class="tj-step" data-lv={v} aria-current={on ? 'step' : undefined} aria-expanded={on} onClick={() => S.selectVerse(v, { openTab: false })} {...hover}>
        <span class="tj-n" aria-hidden="true">
          {i + 1}
        </span>
        <span class="tj-ref">{label(a, v)}</span>
        {edge !== undefined && votes !== undefined && (
          // The step's link is the best-voted row between the two verses, which
          // may run either way: name the row's own direction.
          <span class="tj-votes" title={`${votes} community votes on OpenBible.info for the link from ${label(a, a.xSrc[edge])} to ${rangeLabel(a, a.xDst[edge], a.xSpan[edge])}`}>
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
  const allCount = useMemo(() => themeLinkCount(a, theme), [a, theme]);
  const roots = useMemo(() => new Set(theme.roots), [theme]);
  const sel = S.selected.value;
  const g = S.groupEdges.value;
  const l = lit.value;
  // What the map shows for this theme right now (null: something else).
  const mode: Mode | null = l && l.id === theme.id && (l.group === null || l.group === g) ? l.mode : null;
  const on = sel === null ? -1 : thread.verses.indexOf(sel);
  const isThread = thread.kind === 'thread';
  const from = themeFrom.value;
  // Chosen from this verse's themes card: "Back to <verse>" takes its place.
  const fromHere = sel !== null && from !== null && from.verse === sel && from.theme === theme.id;

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

  // A newly chosen theme opens at the top of the panel, hero first. Chosen
  // from a card, chip or list in this panel, it also takes the focus, which
  // went away with that control, so the next Tab goes into the thread.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const box = scroller(el);
    if (box && el.getBoundingClientRect().top < visibleTop(box)) box.scrollTop = 0;
    const focus = document.activeElement;
    if (handOff === theme.id && (focus === null || focus === document.body)) el.focus({ preventScroll: true });
    handOff = null;
  }, [theme.id]);

  const step = (i: number) => {
    S.selectVerse(thread.verses[i], { openTab: false });
    reveal(root.current?.querySelector(`[data-step="${i}"]`));
  };

  return (
    <section class="tj-journey" ref={root} tabIndex={-1} aria-label={`${theme.name}, traced through the Bible`}>
      <ThemeHero a={a} theme={theme} thread={thread} mode={mode} total={allCount} onStep={step} />
      {sel !== null && <FitLine key={sel} a={a} theme={theme} v={sel} fromHere={fromHere} onStep={(i) => reveal(root.current?.querySelector(`[data-step="${i}"]`))} />}
      <p class="tj-intro">
        <b>{theme.name}</b> {theme.blurb}
      </p>
      {atLeast('study') && (theme.keyVerses?.length ?? 0) > 0 && (
        <p class="tj-keys">
          <span>The verses it speaks of:</span>
          {theme.keyVerses!.map((v) => (
            <KeyVerse key={v} a={a} v={v} />
          ))}
        </p>
      )}
      {thread.verses.length > 0 && (
        <>
          <h3 class="tj-h">
            {isThread ? 'The thread' : 'Key verses (not a linked chain)'}
            <span>{isThread ? ` · ${label(a, thread.verses[0])} to ${label(a, thread.verses[thread.verses.length - 1])}` : ` · ${thread.verses.length} verses`}</span>
          </h3>
          <ol class={`tj-steps${isThread ? '' : ' is-key'}`}>
            {thread.verses.map((v, i) => (
              <Step key={v} a={a} i={i} v={v} edge={isThread && i > 0 ? thread.edges[i - 1] : undefined} on={i === on} roots={roots} />
            ))}
          </ol>
        </>
      )}
      {sel !== null && !fromHere && (
        <button class="tj-back" onClick={() => (S.selected.value = null)}>
          {!isThread ? 'Back to the theme' : mode === 'all' ? 'Back to all links' : 'Back to the thread'}
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
          ? `The thread is computed, not chosen by hand. A fixed rule follows links between this theme's verses that OpenBible.info readers voted for (${THREAD_VOTES} or more votes), always moving forward through the Bible. It favours well-voted links and well-connected verses, and ends at one of the theme's most connected New Testament verses.`
          : `These verses are not a linked chain: no chain of 4 or more verses, joined by links with ${THREAD_VOTES} or more votes, moves forward through this theme's verses to one of its most connected New Testament verses. They are its most connected verses, in Bible order.`}
      </p>
    </section>
  );
}

// ------------------------------------------------------------ where a verse fits

/** " and 4 more links" (nothing for none). */
export function moreLinks(n: number): string {
  return n > 0 ? ` and ${n} more ${n === 1 ? 'link' : 'links'}` : '';
}

/** Theme names as small buttons that open each theme from the verse. */
function ThemeNames({ a, v, themes }: { a: Atlas; v: number; themes: number[] }) {
  return (
    <span class="tj-names">
      {themes.map((j) => (
        <button key={j} type="button" class="tj-chip" data-theme={a.themes[j].id} onClick={() => openThemeFromVerse(a, a.themes[j].id, v)}>
          {a.themes[j].name}
        </button>
      ))}
    </span>
  );
}

/** Close the theme and go back to the verse's themes card. */
function backToVerse(id: string): void {
  closeTheme();
  requestAnimationFrame(() => {
    document.querySelector('.study')?.scrollTo({ top: 0 });
    document.querySelector<HTMLElement>(`.vt-card [data-theme="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  });
}

/** One line under the hero for the selected verse: its step of the thread,
 *  the step it links to, or one of the theme's verses; or, for a verse
 *  outside the theme, plainly that it is not one of them, and its own themes. */
function FitLine({ a, theme, v, fromHere, onStep }: { a: Atlas; theme: Theme; v: number; fromHere: boolean; onStep: (i: number) => void }) {
  const level = themeLevel();
  const study = atLeast('study');
  const j = a.themes.indexOf(theme);
  const name = label(a, v);
  const fit = useMemo(() => whereItFits(a, theme, v), [a, theme, v]);
  const mine = inTheme(a, j, v);
  const own = useMemo(() => verseThemes(a, v, level).map((o) => o.theme), [a, v, level]);
  const through = useMemo(() => themesThroughLinks(a, v, level), [a, v, level]);
  const stepLink = (i: number) => (
    <button type="button" class="tj-steplink" onClick={() => onStep(i)}>
      step {i + 1}
    </button>
  );
  const linkLine =
    fit.kind === 'link' ? (
      <>
        links to {stepLink(fit.step)} of this thread, {label(a, fit.verse)}
        {study && ` (${fit.votes} votes)`}.
      </>
    ) : null;
  const back = fromHere && (
    <button type="button" class="btn tj-backto" onClick={() => backToVerse(theme.id)}>
      ‹ Back to {name}
    </button>
  );

  if (mine) {
    const also = fromHere ? own.filter((k) => k !== j) : [];
    return (
      <div class="tj-fit">
        <p>
          {name}{' '}
          {fit.kind === 'step' ? (
            <>is {stepLink(fit.step)} of this thread.</>
          ) : fit.kind === 'key' ? (
            <>is one of its key verses.</>
          ) : linkLine ? (
            linkLine
          ) : (
            <>is one of its {themeVerses(a, theme).length.toLocaleString()} verses.</>
          )}
        </p>
        {also.length > 0 && (
          <p class="tj-also">
            Also in this verse: <ThemeNames a={a} v={v} themes={also} />
          </p>
        )}
        {back}
      </div>
    );
  }

  const reached = through.find((t) => t.theme === j);
  return (
    <div class="tj-fit is-out">
      <p>
        {name} is not one of the {theme.name} verses.{' '}
        {reached ? (
          <>
            Its strongest links reach this theme through {label(a, reached.via[0][0])}
            {study && ` (${reached.via[0][1]} votes)`}
            {moreLinks(reached.via.length - 1)}.{linkLine && <> It {linkLine}</>}
          </>
        ) : own.length ? (
          <>
            Its themes: <ThemeNames a={a} v={v} themes={own.slice(0, 4)} />
            {own.length > 4 && ` and ${own.length - 4} more`}
          </>
        ) : through.length ? (
          <>
            Its strongest links lead to: <ThemeNames a={a} v={v} themes={through.slice(0, 2).map((t) => t.theme)} />
          </>
        ) : (
          <>No theme runs through its words or its strongest links.</>
        )}
      </p>
      {back}
    </div>
  );
}

// ------------------------------------------------------------ often linked with

/** The links between a theme and a partner, last put on the map from here. */
const nearShown = signal<{ key: string; group: Group } | null>(null);

/** Themes whose verses the cross-references join to this theme's far more
 *  often than chance (the build's `near` list). Simple: three names. Study:
 *  up to five, with how many links join them and a button to draw those
 *  links. Deep: how far above chance, and the rule. */
export function OftenLinked({ a, theme }: { a: Atlas; theme: Theme }) {
  const study = atLeast('study');
  const deep = atLeast('deep');
  const level = themeLevel();
  const near = (theme.near ?? []).filter(([j]) => a.themes[j] && shownAt(a.themes[j], level)).slice(0, study ? 5 : 3);
  const g = S.groupEdges.value;
  const shown = nearShown.value;
  if (!near.length) return null;
  // The selected verse stays, so the partner's journey says where it fits.
  const open = (id: string) => lightTheme(a, id, 'thread', { keepSelection: true });
  if (!study) {
    return (
      <>
        <h3>Often linked with</h3>
        <div class="tj-chips">
          {near.map(([j]) => (
            <button key={j} type="button" class="tj-chip" data-theme={a.themes[j].id} onClick={() => open(a.themes[j].id)}>
              {a.themes[j].name}
            </button>
          ))}
        </div>
      </>
    );
  }
  const show = (other: Theme) => {
    const edges = linksBetween(a, theme, other);
    const group: Group = { edges, label: `${edges.length.toLocaleString()} links between ${theme.name} and ${other.name}` };
    nearShown.value = { key: `${theme.id}|${other.id}`, group };
    S.groupEdges.value = group;
  };
  const rule = a.meta.themeNear;
  return (
    <>
      <h3>Often linked with</h3>
      <ul class="tj-near">
        {near.map(([j, links, lift]) => {
          const other = a.themes[j];
          const on = !!shown && shown.key === `${theme.id}|${other.id}` && shown.group === g;
          return (
            <li key={j}>
              <button type="button" class="tj-chip" data-theme={other.id} onClick={() => open(other.id)}>
                {other.name}
                {other.level === 'study' && <span class="tj-broad">broad word</span>}
              </button>
              <span class="tj-nearn">
                {links.toLocaleString()} links join {theme.name} and {other.name}
                {deep && `, ${lift.toLocaleString()} times what chance would give`}
              </span>
              <button type="button" class="tj-link" aria-pressed={on} onClick={() => (on ? lightTheme(a, theme.id, 'thread', { keepSelection: true }) : show(other))}>
                {on ? 'Back to the thread' : 'Show these links on the map'}
              </button>
            </li>
          );
        })}
      </ul>
      {deep && rule && (
        <p class="tj-why">
          Counted over the {rule.pairs.toLocaleString()} pairs of verses joined by a link with {rule.votes} or more votes, each pair once. A theme is listed when {rule.minLinks} or more of those
          links join the two themes and that is at least {rule.minLift} times what chance would give for themes of their size; the strongest {rule.max} are kept.
        </p>
      )}
    </>
  );
}

// ------------------------------------------------------------ Septuagint pairs

/** Deep: the Greek and Hebrew words of a theme that the Septuagint (the Greek
 *  Old Testament) uses for each other, from lxx.json. Nothing until it loads,
 *  or when the theme has none. */
export function SeptuagintPairs({ a, theme }: { a: Atlas; theme: Theme }) {
  const [table, setTable] = useState<BridgeTable | null>(null);
  useEffect(() => {
    let live = true;
    loadBridges(a).then(
      (t) => live && setTable(t),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [a]);
  if (!table) return null;
  const roots = new Set(theme.roots);
  const pairs: [number, number][] = [];
  for (const g of theme.roots) {
    if (a.lemmas.lang[g] !== 'G') continue;
    for (const h of table.get(g) ?? []) if (roots.has(h)) pairs.push([g, h]);
  }
  if (!pairs.length) return null;
  return (
    <>
      <h3>In the Greek Old Testament</h3>
      <p class="tj-why">The Septuagint uses the theme’s Greek words for its Hebrew words:</p>
      <ul class="tj-lxx">
        {pairs.map(([g, h]) => (
          <li key={`${g}-${h}`}>
            <RootChip a={a} root={g} /> for <RootChip a={a} root={h} />
          </li>
        ))}
      </ul>
    </>
  );
}
