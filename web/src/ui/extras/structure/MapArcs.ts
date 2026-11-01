// How it is built, on the map: at Deep, once the reader has finished the
// commentary notice, the structures over the selected verse are drawn on the
// arc map. A mirror's or bookends' parts get arcs inside one another, a
// refrain's or turn's returns get arcs from each to the next, in the figures'
// violet; a foil gets one ember arc between its two people's first verses,
// dashed; and under each structure a faint bar outlines the whole passage, so
// a psalm that opens and closes alike shows its whole length. Each is named
// once, over its highest arc.
//
// The drawing is a 2D canvas in the map's overlay slot (ui/mapSlot.ts), as
// the figures' arcs are. It never changes the map's selection or view.

import { effect } from '@preact/signals';
import type { Atlas } from '../../../data/atlas';
import { atLeast } from '../../../depth';
import { BASELINE, arcHeight, toScreen, verseX } from '../../../gl/layout';
import * as S from '../../../state';
import { ROAD_GOLD } from '../../colors';
import { accepted } from '../../commentary/state';
import { mapSlot } from '../../mapSlot';
import { type Data, type Note, notesAt } from './model';

const VIOLET = '#d7a0ff';
const OUTLINE = 'rgba(215, 160, 255, 0.28)';
const EMBER = ROAD_GOLD[2];
const TAG_FILL = 'rgba(14, 17, 38, 0.86)';

interface Arc {
  from: number;
  to: number;
  ember: boolean;
}

function arcsOf(n: Note): Arc[] {
  const out: Arc[] = [];
  if (n.kind === 'foil') {
    const [p, q] = n.sides ?? [];
    if (p?.r.length && q?.r.length && p.r[0][0] !== q.r[0][0]) out.push({ from: p.r[0][0], to: q.r[0][0], ember: true });
    return out;
  }
  const ms = n.members ?? [];
  if (n.kind === 'inclusio' || n.kind === 'chiasm') {
    for (let i = 0; i < Math.floor(ms.length / 2); i++) out.push({ from: ms[i].v, to: ms[ms.length - 1 - i].v, ember: false });
  } else {
    const last = new Map<string, number>();
    for (const m of ms) {
      const g = n.kind === 'refrain' ? 'R' : m.mark;
      const p = last.get(g);
      if (p !== undefined && p !== m.v) out.push({ from: p, to: m.v, ember: false });
      last.set(g, m.v);
    }
  }
  return out.filter((x) => x.from !== x.to);
}

function arc(ctx: CanvasRenderingContext2D, x0: number, x1: number, base: number, h: number): void {
  ctx.beginPath();
  for (let k = 0; k <= 48; k++) {
    const t = k / 48;
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
  const ex = (v: number) => (v + 1 < xs.length ? (sx(v) + sx(v + 1)) / 2 : sx(v) + 2);
  const tags: { x: number; y: number; text: string; ember: boolean }[] = [];
  notes.forEach((n, i) => {
    // The faint outline of the whole passage (or each side's verses), below
    // the figures' bars.
    const y = base + 16 + i * 4;
    ctx.strokeStyle = n.kind === 'foil' ? 'rgba(255, 179, 107, 0.35)' : OUTLINE;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    for (const [s, e] of n.r) {
      ctx.beginPath();
      ctx.moveTo(sx(s) - 2, y);
      ctx.lineTo(Math.max(ex(e), sx(s) + 4), y);
      ctx.stroke();
    }
    let top = base;
    let at = sx(n.v);
    let ember = false;
    for (const a of arcsOf(n)) {
      const x0 = sx(a.from);
      const x1 = sx(a.to);
      const ah = Math.max(20, arcHeight(x0, x1, h, w) * 0.95);
      ctx.strokeStyle = a.ember ? EMBER : VIOLET;
      ctx.shadowColor = a.ember ? 'rgba(255, 179, 107, 0.6)' : 'rgba(215, 160, 255, 0.6)';
      ctx.shadowBlur = 6;
      ctx.lineWidth = 2;
      ctx.setLineDash(a.ember ? [7, 5] : []);
      arc(ctx, x0, x1, base, ah);
      ctx.shadowBlur = 0;
      if (base - ah < top) {
        top = base - ah;
        at = (x0 + x1) / 2;
        ember = a.ember;
      }
    }
    ctx.setLineDash([]);
    if (at > -20 && at < w + 20) tags.push({ x: at, y: top - 8, text: labels[i], ember });
  });
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
    ctx.strokeStyle = t.ember ? 'rgba(255, 179, 107, 0.5)' : 'rgba(215, 160, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = t.ember ? EMBER : VIOLET;
    ctx.textBaseline = 'middle';
    ctx.fillText(t.text, left + 6, y - 5);
    lastRight = left + tw;
    lastY = y;
  }
  canvas.dataset.notes = String(notes.length);
}

let started = false;

/** Starts drawing the selected verse's structures over the map. Runs once. */
export function startMapArcs(a: Atlas, d: Data): void {
  if (started) return;
  started = true;
  const xs = verseX(a);
  const canvas = document.createElement('canvas');
  canvas.className = 'x-structure-mapsky';
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
    paint(canvas, map, xs, notes, notes.map((n) => d.kinds[n.kind]?.label ?? ''), font);
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
