// Echoes of the studied verse: the few other verses that use this word
// together with more of the verse's less common words. One tap further, the
// same echoes are drawn as gold arcs over the map.
//
// The list is computed in the browser from the root postings already loaded
// (data/echoes.ts), so nothing new is fetched. The drawing is a 2D canvas laid
// over the arc map, found by its classes. It never writes the app's
// selection, marks or view: a row click selecting its verse is the only state
// it changes.

import { Fragment } from 'preact';
import { effect, signal, type Signal } from '@preact/signals';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { type Atlas, label, versesWithRoot } from '../data/atlas';
import { type Echo, MAXDF, rankEchoes } from '../data/echoes';
import { FLAG, type WordRow } from '../data/text';
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

/** A base-text word (not one found only in other editions) of this root. */
function inBase(w: WordRow | undefined, root: number): boolean {
  return !!w && w[3] === root && !(w[5] & FLAG.otherEditions);
}

/** What the map overlay draws. */
interface Sky {
  verse: number;
  /** Echo verses, best first. */
  echoes: number[];
  /** The other verses with the root that are not echoes. */
  faint: number[];
}

export function WordSky({ a, root, verse, pos }: { a: Atlas; root: number; verse?: number; pos?: number }) {
  const row = useVerseRow(a, verse);
  // Everything below resets when the word or the study verse changes.
  const key = `${root}:${verse}`;
  const [shown, setShown] = useState<{ key: string; n: number } | null>(null);
  const [drawFor, setDrawFor] = useState<string | null>(null);
  const [hasMap, setHasMap] = useState(true);
  // The row under the pointer, so its arc can glow. Local to this block.
  const hot = useMemo(() => signal<number | null>(null), []);
  const mode = S.mapMode.value;

  // The verse must hold the root in its base text. pos points at the tapped
  // word, but a stale or other-edition pos is not trusted alone: the whole
  // row is checked.
  const holds = !!row && (inBase(row[1][pos ?? -1], root) || row[1].some((w) => inBase(w, root)));

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
    const res = rankEchoes({ n: a.n, lOff: a.lOff, lVerse: a.lVerse, gloss: a.lemmas.gloss, rank: a.rank, words: row[1], verse, root }, cache);
    if (!res.echoes.length) return null;
    const lit = new Set(res.echoes.map((e) => e.v));
    const sky: Sky = { verse, echoes: res.echoes.map((e) => e.v), faint: Array.from(vs).filter((v) => v !== verse && !lit.has(v)) };
    return { echoes: res.echoes, sky };
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

  if (!found || verse === undefined) return null;

  const L = a.lemmas;
  const greek = L.lang[root] === 'G';
  const echoes = found.echoes;
  const limit = Math.min(echoes.length, shown?.key === key ? shown.n : FIRST);
  const next = limit < SECOND ? Math.min(echoes.length, SECOND) : echoes.length;
  const where = label(a, verse);

  return (
    <section class="ws-echoes" aria-labelledby={`ws-h-${root}`}>
      <h3 id={`ws-h-${root}`}>Echoes of {where}</h3>
      <p class="muted ws-lede">
        Other verses that use{' '}
        <span class={`ws-o ${greek ? 'gr' : 'he'}`} lang={greek ? 'grc' : 'hbo'}>
          {L.word[root]}
        </span>{' '}
        together with more of this verse’s less common words.
      </p>
      {echoes.slice(0, limit).map((e) => (
        <EchoRow key={e.v} a={a} e={e} lit={on} hot={hot} />
      ))}
      <div class="ws-actions">
        {next > limit && (
          <button class="btn more" onClick={() => setShown({ key, n: next })}>
            Show {next - limit} more
          </button>
        )}
        {deep && (
          <button class="btn more ws-draw" aria-pressed={on} disabled={!canDraw} onClick={() => setDrawFor(on ? null : key)}>
            {!canDraw ? 'Switch the map to Arcs to draw echoes' : on ? 'Hide echoes on the map' : 'Draw these echoes on the map'}
          </button>
        )}
      </div>
      <details class="ws-how">
        <summary>How are echoes found?</summary>
        <Provenance>
          Echoes are verses that use this word together with other, less common words from {where}. They are ranked by how rare the shared words are and computed in your browser from STEPBible’s tagged Hebrew and Greek (TAHOT, TAGNT). A shared word is a clue, not proof that one passage draws on the other.
        </Provenance>
      </details>
    </section>
  );
}

function EchoRow({ a, e, lit, hot }: { a: Atlas; e: Echo; lit: boolean; hot: Signal<number | null> }) {
  const L = a.lemmas;
  const open = () => S.selectVerse(e.v, { openTab: false });
  // A mouse over the row, or keyboard focus on it, spotlights its arc. Taps
  // are left out: on a touch screen the tap selects the verse instead.
  const enter = () => (hot.value = e.v);
  const leave = () => {
    if (hot.value === e.v) hot.value = null;
  };
  return (
    <div
      class={`refrow ws-row${lit ? ' ws-lit' : ''}`}
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
        {e.shared.slice(0, 2).map((q, i, all) => {
          const g = L.lang[q] === 'G';
          // Lines break only between whole word-and-gloss pairs.
          return (
            <Fragment key={q}>
              {i > 0 && ' '}
              <span class="ws-also">
                {i === 0 && 'also '}
                <span class={`ws-o ${g ? 'gr' : 'he'}`} lang={g ? 'grc' : 'hbo'}>
                  {L.word[q]}
                </span>{' '}
                “{L.gloss[q]}”{i < all.length - 1 && ','}
              </span>
            </Fragment>
          );
        })}
      </span>
      <Snippet a={a} v={e.v} max={170} />
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

/** The half-sine arc of arcPath, from x0 towards x1, cut at fraction p. */
function trace(ctx: CanvasRenderingContext2D, x0: number, x1: number, base: number, top: number, p: number): void {
  ctx.moveTo(x0, base);
  const steps = Math.max(1, Math.ceil(SEGMENTS * p));
  for (let i = 1; i <= steps; i++) {
    const t = Math.min(i / SEGMENTS, p);
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
  const dpr = window.devicePixelRatio || 1;
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

  // 3. The echoes in lamp gold, the top three a little heavier and on top.
  ctx.shadowColor = GLOW;
  ctx.shadowBlur = 6 * dpr;
  ctx.strokeStyle = ARC.lamp;
  ctx.globalAlpha = focus === null ? 1 : 0.5;
  const feet: [number, number][] = [];
  for (const [from, to, width] of [
    [3, sky.echoes.length, 2],
    [0, 3, 2.5],
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
      canvas.remove();
    };
  }, [a, sky, hot]);
}
