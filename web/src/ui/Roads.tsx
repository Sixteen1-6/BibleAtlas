// Many roads: up to three chains of cross-references between two verses that
// share no verse except their two ends, each drawn on its own small night sky.
// Choosing a road lights it on the map (it becomes S.path).

import { batch, signal, useSignalEffect } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { type Atlas, label } from '../data/atlas';
import type { PathResult } from '../engine/client';
import { BASELINE, arcHeight, arcPath, verseX } from '../gl/layout';
import * as S from '../state';
import { ROAD_GOLD, SKY } from './colors';
import './roads.css';

export type Road = PathResult & { ms: number };

const MAX_ROADS = 3;
const COUNT_WORDS = ['No', 'One', 'Two', 'Three'];

type Status = { kind: 'busy' } | { kind: 'note'; text: string; retry?: boolean } | { kind: 'error'; text: string; detail: string } | null;

// Kept outside the component, so the roads are still there after a visit to another tab.
const from = signal('Genesis 3:15');
const to = signal('Revelation 12:9');
const minVotes = signal(5);
const roads = signal<Road[] | null>(null);
/** The fewest votes a link needed when the roads shown were found. Null while
 *  they only stand in for a search that has not answered (a shared link's road). */
const foundAt = signal<number | null>(null);
/** Index of the chosen road, or -1 while none is lit (after Esc, say). */
const chosen = signal(-1);
const status = signal<Status>(null);
/** How long the engine took to find the roads, in ms (0 while none are shown). */
const took = signal(0);
/** What screen readers hear when a search ends. `n` changes every time, so the same words are read again. */
const said = signal({ text: '', n: 0 });
/** Only the latest query may change anything. */
let ticket = 0;
/** The road a shared link asked for (road=2 is index 1), used once by adopt(). */
let linkedPick = 0;

/** From the link: light road `n` (1 to 3) once the restored path's roads are found. */
export function pickLinkedRoad(n: number): void {
  linkedPick = Number.isInteger(n) && n >= 1 && n <= MAX_ROADS ? n - 1 : 0;
}

/** Index of the lit road (-1 for none), for the link. */
export function chosenRoad(): number {
  return chosen.value;
}

const votesWord = (n: number) => `${n} ${n === 1 ? 'vote' : 'votes'}`;

function engineFailed(e: unknown): Status {
  return {
    kind: 'error',
    text: 'The path engine isn’t working, so roads can’t be found right now. Try reloading the page.',
    detail: e instanceof Error ? e.message : String(e),
  };
}

function say(text: string): void {
  said.value = { text, n: said.peek().n + 1 };
}

/** "Three roads from Genesis 3:15 to Revelation 12:9", or without the count
 *  while the search has not answered (`at` is null). */
function headline(a: Atlas, list: Road[], at: number | null): string {
  const ends = list[0].verses;
  const span = `from ${label(a, ends[0])} to ${label(a, ends[ends.length - 1])}`;
  if (at === null) return `Roads ${span}`;
  const n = list.length;
  return `${COUNT_WORDS[n] ?? n} ${n === 1 ? 'road' : 'roads'} ${span}`;
}

/** Light a road list on the map (road `pick` of it, or nothing). `at` is the
 *  vote threshold the list was found with. */
function show(list: Road[] | null, pick: number, at: number | null = null): void {
  batch(() => {
    roads.value = list;
    foundAt.value = list ? at : null;
    chosen.value = list && pick >= 0 ? pick : -1;
    S.path.value = list && pick >= 0 ? list[pick] : null;
    if (!list) took.value = 0;
  });
}

/** Say something in place of the roads: roads shown before, and their light
 *  on the map, go, so nothing on screen belongs to an older question. */
function note(text: string, retry = false): void {
  batch(() => {
    show(null, -1);
    status.value = { kind: 'note', text, retry };
  });
  say(text);
}

/** A road is the whole picture on the map: a theme's ticks, a word's links
 *  or a verse picked from the steps would muddle it. */
function clearOthers(): void {
  S.theme.value = null;
  S.marks.value = null;
  S.groupEdges.value = null;
  S.selected.value = null;
}

async function run(a: Atlas, f: string, t: string, mv: number): Promise<void> {
  const eng = S.engine.peek();
  if (!eng) return;
  const my = ++ticket;
  status.value = { kind: 'busy' };
  try {
    const [ra, rb] = await Promise.all([eng.parseRef(f), eng.parseRef(t)]);
    if (my !== ticket) return;
    if (!ra || !rb) return note(`Could not read ${!ra ? `“${f}”` : `“${t}”`}. Try a form like “John 3:16”.`);
    if (ra[0] === rb[0]) return note(`“${f}” and “${t}” are the same verse. Pick two different verses.`);
    const found = await eng.paths(ra[0], rb[0], mv, MAX_ROADS);
    if (my !== ticket) return;
    if (!found.length) {
      const ends = `${label(a, ra[0])} and ${label(a, rb[0])}`;
      return note(mv > 1 ? `No chain of links with at least ${votesWord(mv)} joins ${ends}.` : `No chain of cross-references joins ${ends}.`, mv > 1);
    }
    const ms = eng.lastMs;
    const list = found.map((r) => ({ ...r, ms }));
    batch(() => {
      clearOthers();
      took.value = ms;
      status.value = null;
      show(list, 0, mv);
    });
    say(`${headline(a, list, mv)}.`);
  } catch (e) {
    if (my === ticket) {
      batch(() => {
        show(null, -1);
        status.value = engineFailed(e);
      });
    }
  }
}

/** A path that arrived from outside (a shared #p= link): fill in its two ends
 *  and find its other roads with every link, as the link itself was restored. */
function adopt(a: Atlas, p: Road): void {
  const eng = S.engine.peek();
  const first = p.verses[0];
  const last = p.verses[p.verses.length - 1];
  const my = ++ticket;
  const want = linkedPick;
  linkedPick = 0;
  batch(() => {
    from.value = label(a, first);
    to.value = label(a, last);
    minVotes.value = 1;
  });
  if (first === last) {
    note(`This link starts and ends at ${label(a, first)}. Pick two different verses.`);
    return;
  }
  batch(() => {
    // The restored path stands in as road 1 until every road is found.
    roads.value = [p];
    foundAt.value = null;
    chosen.value = 0;
    took.value = 0;
    status.value = eng ? { kind: 'busy' } : null;
  });
  if (!eng) return;
  eng.paths(first, last, 1, MAX_ROADS).then(
    (found) => {
      if (my !== ticket) return;
      const ms = eng.lastMs;
      const list: Road[] = found.map((r) => ({ ...r, ms }));
      // Same engine, same links: road 1 is the restored path. Keep that very
      // object, so the map does not draw it again.
      if (list.length && list[0].verses.join() === p.verses.join() && list[0].edges.join() === p.edges.join()) list[0] = p;
      batch(() => {
        status.value = null;
        if (!list.length) return;
        took.value = ms;
        const lit = S.path.peek();
        show(list, lit === p ? (want < list.length ? want : 0) : list.indexOf(lit as Road), 1);
      });
      if (list.length) say(`${headline(a, list, 1)}.`);
    },
    (e) => {
      if (my === ticket) status.value = engineFailed(e);
    },
  );
}

/** State and actions for the Paths panel. */
export function useRoads(a: Atlas) {
  // Follow the map: a path set from outside (a shared link) gets its roads,
  // and a cleared map (Esc, or a verse picked) leaves the roads unlit.
  useSignalEffect(() => {
    const p = S.path.value;
    if (p === null) {
      chosen.value = -1;
      return;
    }
    const list = roads.peek();
    if (list?.includes(p)) return;
    adopt(a, p);
  });
  return {
    from: from.value,
    to: to.value,
    minVotes: minVotes.value,
    status: status.value,
    roads: roads.value,
    chosen: chosen.value,
    took: took.value,
    setFrom: (s: string) => (from.value = s),
    setTo: (s: string) => (to.value = s),
    setMinVotes: (n: number) => (minVotes.value = n),
    /** Find the roads; with two arguments, for that pair. */
    run: (f?: string, t?: string) => {
      if (f !== undefined && t !== undefined) {
        from.value = f;
        to.value = t;
      }
      return run(a, from.peek(), to.peek(), minVotes.peek());
    },
    /** After "no chain": try again with every link. */
    retryAll: () => {
      minVotes.value = 1;
      return run(a, from.peek(), to.peek(), 1);
    },
  };
}

// ------------------------------------------------------------ choosing

function choose(i: number): void {
  const list = roads.peek();
  if (!list?.[i]) return;
  batch(() => {
    clearOthers();
    chosen.value = i;
    S.path.value = list[i];
  });
}

/** Mouse hover: show a road on the map without choosing it. */
function preview(i: number | null): void {
  const list = roads.peek();
  if (!list) return;
  const c = chosen.peek();
  const next = i !== null ? list[i] : c >= 0 ? list[c] : null;
  if (next !== undefined && S.path.peek() !== next) S.path.value = next;
}

// ------------------------------------------------------------ the cards

let layout: { a: Atlas; xs: Float32Array } | null = null;
/** The map's horizontal layout (one slot per verse, gaps between books). */
function xsFor(a: Atlas): Float32Array {
  if (layout?.a !== a) layout = { a, xs: verseX(a) };
  return layout.xs;
}

function useWidth(ref: { current: HTMLElement | null }): number {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}

const STRIP_H = 46;
const PAD = 6;

/** A small night sky with faint book ticks and one road drawn across it. */
function NightStrip({ a, road, color }: { a: Atlas; road: Road; color: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const w = useWidth(box);
  const xs = xsFor(a);
  const iw = Math.max(1, w - 2 * PAD);
  const x = (v: number) => PAD + xs[v] * iw;
  const base = STRIP_H * BASELINE;
  let ticks = '';
  let divide = '';
  if (w > 0) {
    for (let b = 1; b < a.books.length; b++) {
      const s = a.books[b].start;
      const tx = (PAD + ((xs[s - 1] + xs[s]) / 2) * iw).toFixed(1);
      if (a.books[b].testament !== a.books[b - 1].testament) divide = `M${tx},${(base - 3).toFixed(1)}v9`;
      else ticks += `M${tx},${(base + 1.5).toFixed(1)}v3`;
    }
  }
  const pts = road.verses.map(x);
  return (
    <span class="roads-sky" ref={box} style={`background:linear-gradient(180deg, ${SKY.top}, ${SKY.horizon} 64%, ${SKY.glow} ${(BASELINE * 100).toFixed(0)}%, ${SKY.top})`} aria-hidden="true">
      {w > 0 && (
        <svg width={w} height={STRIP_H} viewBox={`0 0 ${w} ${STRIP_H}`}>
          <path class="roads-base" d={`M${PAD},${base.toFixed(1)}H${w - PAD}`} />
          <path class="roads-ticks" d={ticks} />
          <path class="roads-divide" d={divide} />
          {pts.slice(1).map((x1, i) => {
            const x0 = pts[i];
            const r = Math.abs(x1 - x0) / 2;
            const h = arcHeight(x0, x1, STRIP_H, iw);
            // Half an ellipse's perimeter, near enough to draw the arc in.
            const len = (Math.PI * Math.sqrt((r * r + h * h) / 2) + 4).toFixed(0);
            const d = arcPath(x0, x1, STRIP_H, iw, 32);
            const style = `--len:${len};--delay:${(i * 0.18).toFixed(2)}s`;
            return (
              <g key={`${road.verses[i]}-${road.verses[i + 1]}`}>
                <path class="roads-glow" d={d} stroke={color} style={style} />
                <path class="roads-arc" d={d} stroke={color} style={style} />
              </g>
            );
          })}
          {pts.map((px, i) => (
            <circle key={road.verses[i]} cx={px} cy={base} r={i === 0 || i === pts.length - 1 ? 2.3 : 1.7} fill={color} />
          ))}
        </svg>
      )}
    </span>
  );
}

/** The road's best-known inner verse (by PageRank; ties go to the earlier verse). */
function viaVerse(a: Atlas, road: Road): number | null {
  let best: number | null = null;
  for (const v of road.verses.slice(1, -1)) if (best === null || a.rank[v] > a.rank[best] || (a.rank[v] === a.rank[best] && v < best)) best = v;
  return best;
}

/** Keep a phrase on one line. */
const tie = (s: string) => s.replace(/ /g, '\u00a0');

/** "via 1 Thessalonians 1:10", which may wrap before the book or before
 *  "1:10" but never inside either, so "1:10" cannot read as "1:1". */
function ViaLabel({ text }: { text: string }) {
  const cut = text.lastIndexOf(' ');
  if (cut < 0) return <>via {text}</>;
  return (
    <>
      via {tie(text.slice(0, cut))} <span class="roads-cv">{text.slice(cut + 1)}</span>
    </>
  );
}

function RoadCard({ a, road, i, checked, tabbable }: { a: Atlas; road: Road; i: number; checked: boolean; tabbable: boolean }) {
  const via = viaVerse(a, road);
  const steps = road.verses.length - 1;
  const weakest = road.edges.length ? Math.min(...road.edges.map((e) => a.xVotes[e])) : 0;
  const name = steps === 0 ? 'The same verse' : via === null ? 'Direct link' : `via ${label(a, via)}`;
  const stepWord = `${steps} ${steps === 1 ? 'step' : 'steps'}`;
  // One link has no weakest link: it simply has its votes.
  const strength = steps === 1 ? votesWord(weakest) : steps > 1 ? `weakest link ${votesWord(weakest)}` : '';
  return (
    <button
      type="button"
      role="radio"
      class="roads-card"
      aria-checked={checked}
      tabIndex={tabbable ? 0 : -1}
      aria-label={`Road ${i + 1}: ${name}, ${stepWord}${strength ? `, ${strength}` : ''}`}
      onClick={() => choose(i)}
      // A move, not an enter: cards that appear under a resting mouse (after
      // "Try with every link", say) must not light a road nobody pointed at.
      onPointerMove={(e) => e.pointerType === 'mouse' && preview(i)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && preview(null)}
    >
      <NightStrip a={a} road={road} color={ROAD_GOLD[i % ROAD_GOLD.length]} />
      <span class="roads-text">
        <b class="roads-via">{via === null ? name : <ViaLabel text={label(a, via)} />}</b>
        <span class="roads-meta">
          {tie(stepWord)}
          {steps === 1 && ` · ${tie(strength)}`}
        </span>
        {steps > 1 && <span class="roads-meta">weakest link {tie(votesWord(weakest))}</span>}
      </span>
    </button>
  );
}

/** What the roads found do and do not show. Every claim holds for the
 *  threshold the roads were found with (`at`), and only for it: each road
 *  after the first is the cheapest that avoids the earlier roads' inner
 *  verses, so when fewer than three come back, every other road meets one of
 *  them along the way (or, for a lone direct link, none exists at all). */
function RoadsNote({ list, at, onRetry }: { list: Road[]; at: number; onRetry: () => void }) {
  const n = list.length;
  const links = at > 1 ? ` with links of at least ${votesWord(at)}` : '';
  let fewer = '';
  if (n < MAX_ROADS) {
    if (n === 1 && list[0].verses.length <= 2) fewer = at > 1 ? `No other chain of links with at least ${votesWord(at)} joins them.` : 'No other chain of cross-references joins them.';
    else fewer = `Every other road${links} meets ${n === 1 ? 'this one' : 'one of these'} along the way.`;
  }
  return (
    <>
      {n > 1 && (
        <p class="roads-note">
          {n === 2 ? 'The two roads share no verse except the two ends.' : 'Each road shares no verse with the others except the two ends.'} Pick one to light it on the map.
        </p>
      )}
      {fewer && (
        <p class="roads-note">
          {fewer}
          {at > 1 && (
            <>
              {' '}
              <button type="button" class="roads-retry" onClick={onRetry}>
                Try with every link
              </button>
            </>
          )}
        </p>
      )}
    </>
  );
}

/** The road cards: a radio group that lights the chosen road on the map. */
export function RoadCards({ a, onRetry }: { a: Atlas; onRetry: () => void }) {
  const list = roads.value;
  const sel = chosen.value;
  // While a search runs, the cards shown may not be its answer: no count, no claims.
  const at = status.value?.kind === 'busy' ? null : foundAt.value;
  const box = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  // Bring fresh roads into view: below the form, they can start out of sight.
  useEffect(() => {
    if (!list) return;
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.current?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }, [list]);
  if (!list?.length) return null;
  const focusAt = sel >= 0 ? sel : 0;

  const onKey = (e: KeyboardEvent) => {
    const n = list.length;
    let next: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (focusAt + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (focusAt - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else return;
    e.preventDefault();
    choose(next);
    group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <div class="roads" ref={box}>
      <h3 class="roads-head" id="roads-head">
        {headline(a, list, at)}
      </h3>
      <div class="roads-cards" role="radiogroup" aria-labelledby="roads-head" ref={group} onKeyDown={onKey} style={`--n:${list.length}`}>
        {list.map((r, i) => (
          <RoadCard key={i} a={a} road={r} i={i} checked={i === sel} tabbable={i === focusAt} />
        ))}
      </div>
      {at !== null && <RoadsNote list={list} at={at} onRetry={onRetry} />}
    </div>
  );
}

/** Screen readers hear how each search ended: the roads' heading, or the note
 *  shown instead. The region is always there, so the change is announced. */
function Announcer() {
  const s = said.value;
  // Words left from before a visit to another tab are not news on return.
  useEffect(() => () => void (said.value = { text: '', n: said.peek().n + 1 }), []);
  // The wrapper holds the hidden region inside the panel's scroll box (see roads.css).
  return (
    <div class="roads-live">
      <p class="sr-only" role="status">
        <span key={s.n}>{s.text}</span>
      </p>
    </div>
  );
}

/** "Finding roads…", or what went wrong, in plain words. */
export function RoadsStatus({ onRetry }: { onRetry: () => void }) {
  const s = status.value;
  let shown = null;
  if (s?.kind === 'busy') {
    shown = (
      <p class="roads-busy" role="status">
        Finding roads…
      </p>
    );
  } else if (s?.kind === 'error') {
    shown = (
      <p class="notice roads-notice" role="alert">
        {s.text} <span class="roads-detail">({s.detail})</span>
      </p>
    );
  } else if (s) {
    // Read out through the Announcer, so not a live region itself.
    shown = (
      <p class="notice roads-notice">
        {s.text}{' '}
        {s.retry && (
          <button type="button" class="roads-retry" onClick={onRetry}>
            Try with every link
          </button>
        )}
      </p>
    );
  }
  return (
    <>
      <Announcer />
      {shown}
    </>
  );
}
