// Echoes of the studied verse: the few other verses that use this word
// together with more of the verse's less common words. One tap further, the
// same echoes are drawn as gold arcs over the map.
//
// The list is computed in the browser from the root postings already loaded
// (data/echoes.ts), so nothing new is fetched. A row loads its verse's text
// only when it comes near the view. The drawing is a 2D canvas laid over the
// arc map, found by its classes. It never writes the app's selection, marks
// or view: a row click selecting its verse is the only state it changes.

import { Fragment } from 'preact';
import { effect, signal, type Signal } from '@preact/signals';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Atlas, label, locate, versesWithRoot } from '../data/atlas';
import { type Echo, type EchoWord, MAXDF, RARE, countable, describeShared, holdsRoot, isContent, isDisputed, rankEchoes } from '../data/echoes';
import { FLAG, isBookLoaded } from '../data/text';
import { atLeast } from '../depth';
import { BASELINE, arcHeight, toScreen, verseX } from '../gl/layout';
import * as S from '../state';
import { ARC, SKY } from './colors';
import { Provenance, Snippet, useVerseRow } from './common';
import './wordsky.css';

/** Rows shown at first; the first "Show more" goes up to SECOND, the next shows all. */
const FIRST = 3;
const SECOND = FIRST + 20;

// Per atlas, shared by every study: each root's distinct verses, and where
// each verse sits on the map.
const rootVerses = new WeakMap<Atlas, Map<number, Uint32Array>>();
const layouts = new WeakMap<Atlas, Float32Array>();

function versesCache(a: Atlas): Map<number, Uint32Array> {
  let c = rootVerses.get(a);
  if (!c) rootVerses.set(a, (c = new Map()));
  return c;
}

function layoutOf(a: Atlas): Float32Array {
  let xs = layouts.get(a);
  if (!xs) layouts.set(a, (xs = verseX(a)));
  return xs;
}

/** What the map overlay draws. */
interface Sky {
  verse: number;
  /** Echo verses, best first. */
  echoes: number[];
  /** The other verses with the root that are not echoes. */
  faint: number[];
}

/** An echo with the (up to) two shared words its row names. */
interface Shown {
  e: Echo;
  name: number[];
}

/** Calls `near` once, when the element comes within 400 px of the view, so a
 *  row loads its verse only if someone may read it. One observer serves every
 *  row of the block; its root is the panel that scrolls. */
type Watch = (el: Element, near: () => void) => () => void;

function useRowWatch(): Watch {
  const io = useMemo(() => ({ obs: null as IntersectionObserver | null, waiting: new Map<Element, () => void>() }), []);
  useEffect(
    () => () => {
      io.obs?.disconnect();
      io.waiting.clear();
    },
    [io],
  );
  return useCallback(
    (el: Element, near: () => void) => {
      if (typeof IntersectionObserver === 'undefined') {
        near();
        return () => {};
      }
      if (!io.obs) {
        let root: Element | null = el.parentElement;
        while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
        io.obs = new IntersectionObserver(
          (entries) => {
            for (const en of entries) {
              if (!en.isIntersecting) continue;
              const f = io.waiting.get(en.target);
              io.waiting.delete(en.target);
              io.obs?.unobserve(en.target);
              f?.();
            }
          },
          { root, rootMargin: '400px 0px' },
        );
      }
      io.waiting.set(el, near);
      io.obs.observe(el);
      return () => {
        io.waiting.delete(el);
        io.obs?.unobserve(el);
      };
    },
    [io],
  );
}

export function WordSky({ a, root, verse }: { a: Atlas; root: number; verse?: number; pos?: number }) {
  const row = useVerseRow(a, verse);
  // Everything below resets when the word or the study verse changes.
  const key = `${root}:${verse}`;
  const [shown, setShown] = useState<{ key: string; n: number } | null>(null);
  const [drawFor, setDrawFor] = useState<string | null>(null);
  const [hasMap, setHasMap] = useState(true);
  // The row under the pointer, so its arc can glow. Local to this block.
  const hot = useMemo(() => signal<number | null>(null), []);
  const section = useRef<HTMLElement>(null);
  // After "Show more", the first new row takes the focus the button had.
  const focusRow = useRef<number | null>(null);
  const watch = useRowWatch();
  const mode = S.mapMode.value;
  const K = a.lemmas.key;

  // The verse must hold the root in its base text, in a reading no
  // manuscript disputes. The whole row is checked, not just the tapped word.
  const holds = !!row && holdsRoot(row[1], root, K);

  const found = useMemo(() => {
    if (verse === undefined || !row || !holds) return null;
    const cache = versesCache(a);
    let vs = cache.get(root);
    if (!vs) {
      vs = versesWithRoot(a, root);
      if (vs.length >= MAXDF) return null;
      cache.set(root, vs);
    }
    if (vs.length >= MAXDF) return null;
    const l = locate(a, verse);
    const words = countable(row[1], K, a.books[l.book].osis === 'Ps' && l.verse === 1);
    const res = rankEchoes({ n: a.n, lOff: a.lOff, lVerse: a.lVerse, gloss: a.lemmas.gloss, rank: a.rank, words, verse, root }, cache);
    if (!res.echoes.length) return null;
    // A row names two of the shared words: rare content words first, then
    // the rest, each group rarest first.
    const content = new Set<number>();
    for (const w of words) if (!(w[5] & FLAG.otherEditions) && isContent(w[4])) content.add(w[3]);
    const first = (q: number) => content.has(q) && (cache.get(q)?.length ?? MAXDF) < RARE;
    const rows: Shown[] = res.echoes.map((e) => ({ e, name: [...e.shared.filter(first), ...e.shared.filter((q) => !first(q))].slice(0, 2) }));
    const lit = new Set(res.echoes.map((e) => e.v));
    const sky: Sky = { verse, echoes: res.echoes.map((e) => e.v), faint: Array.from(vs).filter((v) => v !== verse && !lit.has(v)) };
    return { rows, sky };
  }, [a, root, verse, row, holds]);

  // The map must be in Arcs mode to draw on; leaving it turns the drawing off.
  useEffect(() => {
    setHasMap(!!document.querySelector('.map canvas.arcs'));
    if (mode !== 'arcs') setDrawFor(null);
  }, [mode]);

  const canDraw = mode === 'arcs' && hasMap;
  // Drawing echoes on the map is Deep; Study shows the list.
  const deep = atLeast('deep');
  const on = deep && canDraw && drawFor === key && !!found;
  useEchoSky(a, on && found ? found.sky : null, hot);

  // Leaving Deep ends the drawing, so it does not come back on by itself.
  useEffect(() => {
    if (!deep) setDrawFor(null);
  }, [deep]);

  // The drawing never outlives its off switch: Escape (the app's key for
  // clearing the map) ends it, as does an "atlas:clear" event on window (for
  // any other control that clears the map), and so does the block being
  // hidden, as on a phone when the Read pane replaces the Study pane.
  useEffect(() => {
    const el = section.current;
    if (!on || !el) return;
    const off = () => setDrawFor(null);
    const esc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !S.paletteOpen.value) off();
    };
    const ro = new ResizeObserver(() => {
      if (!el.getClientRects().length) off();
    });
    window.addEventListener('keydown', esc);
    window.addEventListener('atlas:clear', off);
    ro.observe(el);
    return () => {
      window.removeEventListener('keydown', esc);
      window.removeEventListener('atlas:clear', off);
      ro.disconnect();
    };
  }, [on]);

  useEffect(() => {
    const i = focusRow.current;
    if (i === null) return;
    focusRow.current = null;
    section.current?.querySelectorAll<HTMLElement>('.ws-row')[i]?.focus();
  });

  if (!found || verse === undefined) return null;

  const L = a.lemmas;
  const greek = L.lang[root] === 'G';
  const rows = found.rows;
  const limit = Math.min(rows.length, shown?.key === key ? shown.n : FIRST);
  const next = limit < SECOND ? Math.min(rows.length, SECOND) : rows.length;
  const where = label(a, verse);

  return (
    <section class="ws-echoes" ref={section} aria-labelledby={`ws-h-${root}`}>
      <h3 id={`ws-h-${root}`}>Echoes of {where}</h3>
      <p class="muted ws-lede">
        Other verses that use{' '}
        <span class={`ws-o ${greek ? 'gr' : 'he'}`} lang={greek ? 'grc' : 'hbo'}>
          {L.word[root]}
        </span>{' '}
        together with more of this verse’s less common words.
      </p>
      {rows.slice(0, limit).map((r) => (
        <EchoRow key={r.e.v} a={a} row={r} root={root} lit={on} hot={hot} watch={watch} />
      ))}
      <div class="ws-actions">
        {next > limit && (
          <button
            class="btn more"
            onClick={(ev) => {
              if (document.activeElement === ev.currentTarget) focusRow.current = limit;
              setShown({ key, n: next });
            }}
          >
            Show {next - limit} more
          </button>
        )}
        {deep && (
          <button class="btn more ws-draw" aria-pressed={on} aria-disabled={!canDraw} onClick={() => canDraw && setDrawFor(on ? null : key)}>
            {!canDraw ? 'Switch the map to Arcs to draw echoes' : on ? 'Hide echoes on the map' : 'Draw these echoes on the map'}
          </button>
        )}
      </div>
      <details class="ws-how">
        <summary>How are echoes found?</summary>
        <Provenance>
          Echoes are verses that use this word together with other, less common words from {where}. They are ranked by how rare the shared words are and computed in your browser from STEPBible’s tagged Hebrew and Greek (TAHOT, TAGNT). Words whose reading the manuscripts dispute, and the music words of psalm headings, are left out. A shared word is a clue, not proof that one passage draws on the other.
        </Provenance>
      </details>
    </section>
  );
}

function EchoRow({ a, row, root, lit, hot, watch }: { a: Atlas; row: Shown; root: number; lit: boolean; hot: Signal<number | null>; watch: Watch }) {
  const { e, name } = row;
  const L = a.lemmas;
  const el = useRef<HTMLDivElement>(null);
  // The verse's text (its snippet, and how it renders each shared word) is
  // loaded once the row comes near the view, or at once if its book is in.
  const [near, setNear] = useState(() => isBookLoaded(a.verseBook[e.v]));
  useEffect(() => (near || !el.current ? undefined : watch(el.current, () => setNear(true))), [near, watch]);
  const text = useVerseRow(a, near ? e.v : null);
  const words = text ? (text[1] as EchoWord[]).filter((w) => !(w[5] & FLAG.otherEditions)) : null;
  /** The root stands in this verse only in a reading the manuscripts dispute. */
  const doubted = (q: number) => {
    const ws = words?.filter((w) => w[3] === q) ?? [];
    return ws.length > 0 && ws.every((w) => isDisputed(w, L.key));
  };

  const open = () => S.selectVerse(e.v, { openTab: false });
  // A mouse over the row, or keyboard focus on it, spotlights its arc. Taps
  // are left out: on a touch screen the tap selects the verse instead.
  const enter = () => (hot.value = e.v);
  const leave = () => {
    if (hot.value === e.v) hot.value = null;
  };
  return (
    <div
      ref={el}
      class={`refrow ws-row${lit ? ' ws-lit' : ''}`}
      data-lv={e.v}
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(ev) => ev.key === 'Enter' && open()}
      onPointerEnter={(ev) => ev.pointerType === 'mouse' && enter()}
      onPointerLeave={leave}
      onFocus={(ev) => (ev.currentTarget as HTMLElement).matches(':focus-visible') && enter()}
      onBlur={leave}
    >
      <span class="ref">{label(a, e.v)}</span>
      <span class="vt">
        {name.map((q, i) => {
          const g = L.lang[q] === 'G';
          const d = describeShared(L.gloss[q], words?.find((w) => w[3] === q), text?.[0]);
          const doubt = doubted(q);
          const comma = i < name.length - 1 ? ',' : '';
          // Lines break only between whole pieces: the word with its gloss,
          // how this verse renders it, and a manuscript note.
          return (
            <Fragment key={q}>
              {i > 0 && ' '}
              <span class="ws-also">
                {i === 0 && 'also '}
                <span class={`ws-o ${g ? 'gr' : 'he'}`} lang={g ? 'grc' : 'hbo'} data-lr={q}>
                  {L.word[q]}
                </span>{' '}
                “{d.gloss}”{!d.here && !doubt && comma}
              </span>
              {d.here && (
                <>
                  {' '}
                  <span class="ws-here">
                    · here “{d.here}”{!doubt && comma}
                  </span>
                </>
              )}
              {doubt && (
                <>
                  {' '}
                  <span class="ws-doubt">(manuscripts differ here){comma}</span>
                </>
              )}
            </Fragment>
          );
        })}
      </span>
      {near ? <Snippet a={a} v={e.v} max={170} /> : <span class="snip">…</span>}
      {doubted(root) && (
        <span class="ws-note">
          Manuscripts differ on{' '}
          <span class={`ws-o ${L.lang[root] === 'G' ? 'gr' : 'he'}`} lang={L.lang[root] === 'G' ? 'grc' : 'hbo'}>
            {L.word[root]}
          </span>{' '}
          in this verse.
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------------ the map overlay

const SEGMENTS = 40;
const GROW_MS = 750;
const VEIL = 'rgba(4, 6, 14, 0.55)';
const FAINT = 'rgba(255, 255, 255, 0.18)';
const GLOW = 'rgba(255, 210, 122, 0.55)';
const BRIGHT = '#fff1cf';
const INK = '#f3eee2';
const TAG_FILL = 'rgba(4, 6, 14, 0.9)';
const TAG_H = 17;
const TAG_PAD = 6;
const LABEL_GAP = 6;

/** The half-sine arc of arcPath, from x0 towards x1, cut at fraction p. Short
 *  arcs need fewer segments to look smooth: about one per 12 px, 8 to 40. */
function trace(ctx: CanvasRenderingContext2D, x0: number, x1: number, base: number, top: number, p: number): void {
  const seg = Math.max(8, Math.min(SEGMENTS, Math.ceil(Math.abs(x1 - x0) / 12)));
  ctx.moveTo(x0, base);
  const steps = Math.max(1, Math.ceil(seg * p));
  for (let i = 1; i <= steps; i++) {
    const t = Math.min(i / seg, p);
    ctx.lineTo(x0 + (x1 - x0) * t, base - top * Math.sin(Math.PI * t));
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface Tag {
  x: number;
  text: string;
  color: string;
  w: number;
  left: number;
}

/** Spreads labels along one line so none overlaps, keeping each near its x. */
function spread(tags: Tag[], width: number): void {
  tags.sort((p, q) => p.x - q.x);
  let right = 4 - LABEL_GAP;
  for (const t of tags) {
    t.left = Math.max(t.x - t.w / 2, right + LABEL_GAP);
    right = t.left + t.w;
  }
  let limit = width - 4 + LABEL_GAP;
  for (let i = tags.length - 1; i >= 0; i--) {
    tags[i].left = Math.max(4, Math.min(tags[i].left, limit - LABEL_GAP - tags[i].w));
    limit = tags[i].left;
  }
}

function paint(canvas: HTMLCanvasElement, map: HTMLElement, a: Atlas, xs: Float32Array, sky: Sky, p: number, hover: number | null, font: string): void {
  const w = map.clientWidth;
  const h = map.clientHeight;
  // Backed at up to twice the CSS size, as the map's own strip is: sharper
  // costs more to fill and is not visible on a phone.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.max(1, Math.round(w * dpr));
  const H = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const view = S.view.peek();
  const base = h * BASELINE;
  const sx = (v: number) => toScreen(xs[v], view, w);
  const x0 = sx(sky.verse);
  const hidden = (x1: number) => (x0 < 0 && x1 < 0) || (x0 > w && x1 > w);
  let arcs = 0;
  let lit = 0;

  // 1. A veil over the sky, so the echoes read against the other links.
  ctx.fillStyle = VEIL;
  ctx.fillRect(0, 0, w, base);

  // 2. Faint arcs to every other verse with this word.
  ctx.beginPath();
  for (const v of sky.faint) {
    const x1 = sx(v);
    if (hidden(x1)) continue;
    trace(ctx, x0, x1, base, arcHeight(x0, x1, h, w), p);
    arcs++;
  }
  ctx.strokeStyle = FAINT;
  ctx.lineWidth = 1;
  ctx.stroke();

  // The echo under the pointer, or else the one just opened, is the focus:
  // it glows brightest and the other echoes step back.
  const sel = S.selected.peek();
  const isEcho = (v: number | null): v is number => v !== null && sky.echoes.includes(v);
  const focus = isEcho(hover) ? hover : isEcho(sel) ? sel : null;

  // 3. The echoes in lamp gold, the top three a little heavier, glowing and
  // on top. The glow is costly to draw, so the rest go without it.
  ctx.shadowColor = GLOW;
  ctx.strokeStyle = ARC.lamp;
  ctx.globalAlpha = focus === null ? 1 : 0.5;
  const feet: [number, number][] = [];
  for (const [from, to, width, blur] of [
    [3, sky.echoes.length, 2, 0],
    [0, 3, 2.5, 6],
  ] as const) {
    ctx.beginPath();
    for (let i = Math.min(to, sky.echoes.length) - 1; i >= from; i--) {
      const v = sky.echoes[i];
      const x1 = sx(v);
      if (hidden(x1)) continue;
      if (v !== focus) trace(ctx, x0, x1, base, arcHeight(x0, x1, h, w), p);
      feet.push([x1, i < 3 ? 2.6 : 2]);
      arcs++;
      lit++;
    }
    ctx.shadowBlur = blur * dpr;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const fx = focus === null ? null : sx(focus);
  if (fx !== null && !hidden(fx)) {
    ctx.beginPath();
    trace(ctx, x0, fx, base, arcHeight(x0, fx, h, w), p);
    ctx.shadowBlur = 14 * dpr;
    ctx.strokeStyle = BRIGHT;
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // 4. Where each echo lands, and the study verse itself.
  if (p >= 1) {
    ctx.fillStyle = ARC.lamp;
    for (const [x, r] of feet) {
      if (x < -4 || x > w + 4) continue;
      ctx.beginPath();
      ctx.arc(x, base, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (x0 > -6 && x0 < w + 6) {
    ctx.beginPath();
    ctx.arc(x0, base, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = ARC.lamp;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = SKY.top;
    ctx.stroke();
  }

  // 5. Labels just under the baseline, each on a small dark tag so it reads
  // over the book names, spread so none overlaps: the top three, the echo
  // under the pointer, and the study verse when it is not the selected verse
  // (the map labels the selected verse itself).
  const fade = Math.min(1, Math.max(0, (p - 0.55) / 0.45));
  if (fade > 0) {
    ctx.font = font;
    const tags: Tag[] = [];
    const add = (v: number, color: string) => {
      const x = sx(v);
      const text = label(a, v, true);
      if (x < 0 || x > w || tags.some((t) => t.text === text)) return;
      tags.push({ x, text, color, w: ctx.measureText(text).width + 2 * TAG_PAD, left: 0 });
    };
    if (sel !== sky.verse) add(sky.verse, INK);
    if (isEcho(hover) && hover !== sel) add(hover, BRIGHT);
    for (const v of sky.echoes.slice(0, 3)) if (v !== sel) add(v, ARC.lamp);
    spread(tags, w);
    ctx.globalAlpha = fade;
    ctx.textBaseline = 'middle';
    const top = base + 6;
    for (const t of tags) {
      const mid = t.left + t.w / 2;
      if (Math.abs(mid - t.x) > 6) {
        // A short leader from the arc's foot to a tag that had to move.
        ctx.beginPath();
        ctx.moveTo(t.x, base + 2);
        ctx.lineTo(Math.min(Math.max(t.x, t.left + 4), t.left + t.w - 4), top);
        ctx.strokeStyle = 'rgba(255, 210, 122, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.beginPath();
      roundRect(ctx, t.left, top, t.w, TAG_H, TAG_H / 2);
      ctx.fillStyle = TAG_FILL;
      ctx.fill();
      ctx.strokeStyle = t.color === INK ? 'rgba(243, 238, 226, 0.3)' : 'rgba(255, 210, 122, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.left + TAG_PAD, top + TAG_H / 2 + 0.5);
    }
    ctx.globalAlpha = 1;
  }

  // Test hooks: arcs drawn in all, and echo arcs drawn.
  canvas.dataset.arcs = String(arcs);
  canvas.dataset.echoes = String(lit);
}

/** Draws `sky` over the map while it is given; removes everything when it is not. */
function useEchoSky(a: Atlas, sky: Sky | null, hot: Signal<number | null>): void {
  useEffect(() => {
    if (!sky) return;
    const xs = layoutOf(a);
    const canvas = document.createElement('canvas');
    canvas.className = 'ws-sky';
    canvas.setAttribute('aria-hidden', 'true');
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim() || 'system-ui, sans-serif';
    const font = `600 11px ${family}`;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let map: HTMLElement | null = null;
    let raf = 0;
    let start = 0;
    let draws = 0;

    const ro = new ResizeObserver(() => request());
    // The map is found by its classes (it is another component's), and
    // followed if it is ever rebuilt.
    const attach = () => {
      const m = document.querySelector('.map canvas.arcs')?.closest<HTMLElement>('.map') ?? null;
      if (m === map && canvas.parentElement === m) return;
      if (map) ro.unobserve(map);
      map = m;
      if (m) {
        m.appendChild(canvas);
        ro.observe(m);
      } else canvas.remove();
    };
    const frame = (now: number) => {
      raf = 0;
      if (!map?.isConnected || canvas.parentElement !== map) attach();
      if (!map) return;
      if (!start) start = now;
      const p = still ? 1 : 1 - Math.pow(1 - Math.min(1, (now - start) / GROW_MS), 3);
      const t0 = performance.now();
      paint(canvas, map, a, xs, sky, p, hot.peek(), font);
      canvas.dataset.ms = (performance.now() - t0).toFixed(1);
      canvas.dataset.draws = String(++draws);
      if (p < 1) request();
    };
    function request() {
      if (!raf) raf = requestAnimationFrame(frame);
    }

    attach();
    // Redraw on pan and zoom, and when the focused echo changes.
    const stop = effect(() => {
      void S.view.value;
      void S.selected.value;
      void hot.value;
      request();
    });
    return () => {
      stop();
      ro.disconnect();
      cancelAnimationFrame(raf);
      // Give the pixels back now: some browsers free a detached canvas only
      // at garbage collection and refuse new ones past a memory cap.
      canvas.width = 0;
      canvas.height = 0;
      canvas.remove();
    };
  }, [a, sky, hot]);
}
