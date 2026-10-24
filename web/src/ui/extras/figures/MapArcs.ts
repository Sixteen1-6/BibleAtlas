// How it is written, on the map: at Deep, once the reader has finished the
// commentary notice, the selected verse's notes are drawn over the arc map in
// this extra's violet. A note whose lines or people sit in different verses
// gets arcs between those verses (broken for opposite lines, dashed between
// two people) and a bar under the verses it covers; a note inside one verse
// gets a small arc over that verse, since its words are too close to part at
// any zoom. Each note's form is named once, over its arc.
//
// The drawing is a 2D canvas in the map's overlay slot (ui/mapSlot.ts), as
// Word sky's echoes are. It never changes the map's selection or view.

import { effect } from '@preact/signals';
import type { Atlas } from '../../../data/atlas';
import { atLeast } from '../../../depth';
import { BASELINE, arcHeight, toScreen, verseX } from '../../../gl/layout';
import * as S from '../../../state';
import { accepted } from '../../commentary/state';
import { mapSlot } from '../../mapSlot';
import { type Data, type Line, type Note, notesAt } from './model';

const VIOLET = '#d7a0ff';
const VIOLET_SOFT = 'rgba(215, 160, 255, 0.55)';
const TAG_FILL = 'rgba(14, 17, 38, 0.86)';

interface Arc {
  from: number;
  to: number;
  style: 'solid' | 'broken' | 'dashed';
}

/** Verse-to-verse arcs for a note: only between different verses. */
function arcsOf(n: Note): Arc[] {
  const out: Arc[] = [];
  const seen = new Set<string>();
  const add = (from: number, to: number, style: Arc['style']) => {
    if (from === to) return;
    const k = `${Math.min(from, to)}:${Math.max(from, to)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ from: Math.min(from, to), to: Math.max(from, to), style });
  };
  if (n.kind === 'contrast' && n.sides?.length === 2) {
    const [p, q] = n.sides;
    if (p.s !== q.s) add(p.s, q.s, 'dashed');
    else add(n.v, Math.max(p.e, q.e), 'dashed');
  }
  if (n.kind === 'parallelism') {
    const lines: Line[] = n.lines ?? [];
    const style = n.form === 'opposite' ? 'broken' : 'solid';
    const marked = lines.filter((l) => l.mark && !l.mark.endsWith("'"));
    if (marked.length) {
      for (const l of marked) {
        const m = lines.find((x) => x.mark === `${l.mark}'`);
        if (m) add(l.v, m.v, style);
      }
    } else for (let i = 1; i < lines.length; i++) add(lines[i - 1].v, lines[i].v, style);
  }
  return out;
}

function arc(ctx: CanvasRenderingContext2D, x0: number, x1: number, base: number, h: number, t0 = 0, t1 = 1): void {
  ctx.beginPath();
  for (let k = 0; k <= 40; k++) {
    const t = t0 + ((t1 - t0) * k) / 40;
    const x = x0 + (x1 - x0) * t;
    const y = base - h * Math.sin(Math.PI * t);
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
}

function paint(canvas: HTMLCanvasElement, map: HTMLElement, xs: Float32Array, notes: Note[], labels: string[], font: string): void {
  const w = map.clientWidth;
  const h = map.clientHeight;
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
  ctx.font = font;
  const view = S.view.peek();
  const base = h * BASELINE;
  const sx = (v: number) => toScreen(xs[v], view, w);
  // Where a verse's right edge is, so a bar covers the verses it names.
  const ex = (v: number) => (v + 1 < xs.length ? (sx(v) + sx(v + 1)) / 2 : sx(v) + 2);
  const tags: { x: number; y: number; text: string }[] = [];
  notes.forEach((n, i) => {
    // The bar under the verses the note covers, one row per note.
    const y = base + 5 + i * 4;
    const b0 = sx(n.v) - 2;
    const b1 = Math.max(ex(n.end), b0 + 6);
    ctx.strokeStyle = VIOLET_SOFT;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(b0, y);
    ctx.lineTo(b1, y);
    ctx.stroke();

    const arcs = arcsOf(n);
    ctx.strokeStyle = VIOLET;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(215, 160, 255, 0.6)';
    ctx.shadowBlur = 6;
    let top = base;
    let at = sx(n.v);
    if (arcs.length) {
      for (const a of arcs) {
        const x0 = sx(a.from);
        const x1 = sx(a.to);
        const ah = Math.max(18, arcHeight(x0, x1, h, w) * 0.9);
        ctx.setLineDash(a.style === 'dashed' ? [6, 5] : []);
        if (a.style === 'broken') {
          arc(ctx, x0, x1, base, ah, 0, 0.42);
          arc(ctx, x0, x1, base, ah, 0.58, 1);
        } else arc(ctx, x0, x1, base, ah);
        if (base - ah < top) {
          top = base - ah;
          at = (x0 + x1) / 2;
        }
      }
    } else {
      // Inside one verse: a small arc over it.
      const x = sx(n.v);
      const half = 9 + i * 5;
      const ah = 16 + i * 6;
      if (n.form === 'opposite') {
        arc(ctx, x - half, x + half, base, ah, 0, 0.4);
        arc(ctx, x - half, x + half, base, ah, 0.6, 1);
      } else arc(ctx, x - half, x + half, base, ah);
      top = base - ah;
      at = x;
    }
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    // A note off the screen gets no name pinned to the edge.
    if (at > -20 && at < w + 20) tags.push({ x: at, y: top - 8, text: labels[i] });
  });
  // The form's name over each arc, kept inside the map and off each other.
  let lastRight = -Infinity;
  let lastY = Infinity;
  for (const t of tags.sort((p, q) => p.x - q.x)) {
    const tw = ctx.measureText(t.text).width + 12;
    const left = Math.max(4, Math.min(t.x - tw / 2, w - tw - 4));
    let y = Math.max(14, t.y);
    if (left < lastRight + 4 && Math.abs(y - lastY) < 18) y = lastY - 20;
    ctx.fillStyle = TAG_FILL;
    ctx.beginPath();
    ctx.roundRect?.(left, y - 14, tw, 18, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(215, 160, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = VIOLET;
    ctx.textBaseline = 'middle';
    ctx.fillText(t.text, left + 6, y - 5);
    lastRight = left + tw;
    lastY = y;
  }
  canvas.dataset.notes = String(notes.length);
}

let started = false;

/** Starts drawing the selected verse's notes over the map. Runs once. */
export function startMapArcs(a: Atlas, d: Data): void {
  if (started) return;
  started = true;
  const xs = verseX(a);
  const canvas = document.createElement('canvas');
  canvas.className = 'x-figures-mapsky';
  canvas.setAttribute('aria-hidden', 'true');
  let font = '';
  let raf = 0;
  let map: HTMLElement | null = null;
  let notes: Note[] = [];
  const ro = new ResizeObserver(() => request());
  const frame = () => {
    raf = 0;
    if (!map || !notes.length) return;
    if (!font) {
      const family = getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim() || 'system-ui, sans-serif';
      font = `600 11px ${family}`;
    }
    paint(canvas, map, xs, notes, notes.map((n) => d.forms[n.form]?.label ?? ''), font);
  };
  function request() {
    if (!raf) raf = requestAnimationFrame(frame);
  }
  effect(() => {
    const m = S.mapMode.value === 'arcs' ? mapSlot.value : null;
    const v = S.selected.value;
    const on = atLeast('deep') && accepted.value && v !== null;
    void S.view.value;
    notes = on && v !== null ? (notesAt(d, v) ?? []) : [];
    const want = m && notes.length ? m : null;
    if (want !== map) {
      if (map) ro.unobserve(map);
      map = want;
      if (map) {
        map.appendChild(canvas);
        ro.observe(map);
      } else {
        canvas.remove();
        canvas.width = 0;
        canvas.height = 0;
      }
    }
    if (map) request();
  });
}
