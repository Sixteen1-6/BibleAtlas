// The map itself: the Bible lands drawn on a canvas from base.json, with the
// places on top. No tiles and no keys, so it works offline. Drag or use one
// finger to pan, pinch or use the wheel to zoom, double-tap to zoom in.
//
// Coordinates are projected once: x = longitude × cos 32°, y = −latitude, so
// distances look right in the middle of the map (32° N).

import type { BaseFile } from './model';

const K = Math.cos((32 * Math.PI) / 180);
export const projX = (lon: number) => lon * K;
export const projY = (lat: number) => -lat;
/** Kilometres in one projected unit (one degree of latitude). */
const KM_PER_UNIT = 111.32;
/** The closest the map zooms in, in pixels per projected unit (about 11 px per km). */
const MAX_SCALE = 1200;
/** The smallest stretch of land a fitted view shows, in projected units (about 90 km). */
const MIN_SPAN = 0.8;
/** Room kept around fitted places, in pixels, for their names and the scale. */
const PAD = { left: 28, right: 28, top: 28, bottom: 36 };

// ------------------------------------------------------------------ geometry

interface Label {
  name: string;
  x: number;
  y: number;
  rank: number;
}

interface Sea {
  name: string;
  rank: number;
  spots: { x: number; y: number; open: number }[];
}

export interface Geometry {
  land: Path2D;
  lakes: Path2D;
  /** Coastlines and lake shores, without the cuts along the map's edge. */
  shore: Path2D;
  rivers: Path2D;
  namedRivers: Path2D;
  lakeNames: Label[];
  riverNames: Label[];
  seas: Sea[];
  box: { x0: number; y0: number; x1: number; y1: number };
}

const cache = new WeakMap<BaseFile, Geometry>();

/** Decode a delta-encoded ring or line into projected points. */
function points(a: readonly number[], from: number, q: number): [number, number][] {
  const out: [number, number][] = [];
  let x = 0;
  let y = 0;
  for (let i = from; i + 1 < a.length; i += 2) {
    if (i === from) {
      x = a[i];
      y = a[i + 1];
    } else {
      x += a[i];
      y += a[i + 1];
    }
    out.push([projX(x / q), projY(y / q)]);
  }
  return out;
}

export function geometry(b: BaseFile): Geometry {
  const hit = cache.get(b);
  if (hit) return hit;
  const q = b.q || 1000;
  const [w, s, e, n] = b.box;
  const box = { x0: projX(w), y0: projY(n), x1: projX(e), y1: projY(s) };
  const onEdge = (p: [number, number], r: [number, number]) =>
    (Math.abs(p[0] - box.x0) < 1e-6 && Math.abs(r[0] - box.x0) < 1e-6) ||
    (Math.abs(p[0] - box.x1) < 1e-6 && Math.abs(r[0] - box.x1) < 1e-6) ||
    (Math.abs(p[1] - box.y0) < 1e-6 && Math.abs(r[1] - box.y0) < 1e-6) ||
    (Math.abs(p[1] - box.y1) < 1e-6 && Math.abs(r[1] - box.y1) < 1e-6);
  const shore = new Path2D();
  const rings = (list: readonly number[][]) => {
    const fill = new Path2D();
    for (const r of list) {
      const pts = points(r, 0, q);
      if (pts.length < 3) continue;
      fill.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) fill.lineTo(pts[i][0], pts[i][1]);
      fill.closePath();
      // The shore: every edge of the ring except those along the map's edge.
      let pen = false;
      for (let i = 0; i <= pts.length; i++) {
        const a = pts[(i + pts.length - 1) % pts.length];
        const c = pts[i % pts.length];
        if (i === 0) continue;
        if (onEdge(a, c)) {
          pen = false;
          continue;
        }
        if (!pen) shore.moveTo(a[0], a[1]);
        shore.lineTo(c[0], c[1]);
        pen = true;
      }
    }
    return fill;
  };
  const land = rings(b.land);
  const lakes = rings(b.lakes);
  const rivers = new Path2D();
  const namedRivers = new Path2D();
  for (const r of b.rivers) {
    const pts = points(r, 1, q);
    if (pts.length < 2) continue;
    const p = r[0] >= 0 ? namedRivers : rivers;
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  }
  const g: Geometry = {
    land,
    lakes,
    shore,
    rivers,
    namedRivers,
    lakeNames: b.lakeNames.map(([name, lon, lat, rank]) => ({ name, x: projX(lon), y: projY(lat), rank })),
    riverNames: b.riverLabels.map(([i, lon, lat]) => ({ name: b.riverNames[i] ?? '', x: projX(lon), y: projY(lat), rank: 0 })).filter((l) => l.name),
    seas: b.seas.map(([name, rank, spots]) => ({ name, rank, spots: spots.map(([lon, lat, open]) => ({ x: projX(lon), y: projY(lat), open })) })),
    box,
  };
  cache.set(b, g);
  return g;
}

// ------------------------------------------------------------------ shapes

/** A shaded area: a region's shape, or a tribe's land. Both are approximate,
 * so they are drawn soft, with a dashed edge. */
export interface Shade {
  path: Path2D;
  /** 0: the chosen place, 1: named in this verse or this passage, 2: shown for reference (the tribes). */
  tier: 0 | 1 | 2;
}

/** Projected rings of a delta-encoded shape, as a path, with its bounding box. */
export function shadePath(rings: readonly (readonly number[])[], q: number): { path: Path2D; box: [number, number, number, number] } {
  const path = new Path2D();
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const r of rings) {
    const pts = points(r, 0, q);
    if (pts.length < 3) continue;
    path.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) {
      path.lineTo(x, y);
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
    path.closePath();
  }
  return { path, box };
}

// ------------------------------------------------------------------ markers

export interface Marker {
  place: number;
  label: string;
  /** Projected position. */
  x: number;
  y: number;
  /** 0: chosen, 1: named in this verse, 2: named elsewhere in the chapter. */
  tier: 0 | 1 | 2;
  /** A region, river or other area: its name, without a dot. */
  area: boolean;
  /** One of the sites proposed for a place whose location is uncertain. */
  proposed: boolean;
}

interface Colors {
  water: string;
  land: string;
  shore: string;
  river: string;
  waterInk: string;
  ink: string;
  muted: string;
  accent: string;
  halo: string;
  dot: string;
}

export type Rect = [number, number, number, number];

/** Whether two boxes overlap by more than a pixel (names may touch). */
const overlaps = (a: Rect, b: Rect) => a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1;

interface Hit {
  place: number;
  x: number;
  y: number;
  rect: Rect | null;
  tier: number;
}

interface ViewState {
  cx: number;
  cy: number;
  s: number;
}

// ------------------------------------------------------------------ the view

export class MapView {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private v: ViewState = { cx: 30, cy: -31, s: 20 };
  private home: ViewState | null = null;
  private pendingFit: [number, number][] | null = [];
  /** Where the zoom buttons sit, in canvas pixels: kept clear of names and fitted places. */
  private reserved: Rect | null = null;
  private markers: Marker[] = [];
  private shades: Shade[] = [];
  private hits: Hit[] = [];
  private frame = 0;
  private anim: { from: ViewState; to: ViewState; t0: number; ms: number } | null = null;
  private colors: Colors | null = null;
  private font = 'system-ui, sans-serif';
  private pointers = new Map<number, { x: number; y: number }>();
  private pan: { x: number; y: number; v: ViewState; moved: boolean; t: number; id: number } | null = null;
  private pinch: { d: number; mx: number; my: number; v: ViewState } | null = null;
  private widths = new Map<string, number>();
  private readonly off: (() => void)[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private geo: Geometry,
    private onTap: (place: number) => void,
  ) {
    this.ctx = canvas.getContext('2d')!;
    const on = <K extends keyof HTMLElementEventMap>(type: K, f: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      canvas.addEventListener(type, f as EventListener, opts);
      this.off.push(() => canvas.removeEventListener(type, f as EventListener, opts));
    };
    on('pointerdown', (e) => this.down(e));
    on('pointermove', (e) => this.move(e));
    on('pointerup', (e) => this.up(e, true));
    on('pointercancel', (e) => this.up(e, false));
    on('wheel', (e) => this.wheel(e), { passive: false });
    on('dblclick', (e) => {
      const p = this.local(e);
      this.zoomAt(2, p.x, p.y, true);
    });
    this.readTheme();
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    for (const f of this.off) f();
  }

  /** Read the colours and font from CSS, so both themes work. */
  readTheme(): void {
    const css = getComputedStyle(this.canvas);
    const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    this.colors = {
      water: get('--x-real-map-water', '#dfe7ea'),
      land: get('--x-real-map-land', '#f7f2e7'),
      shore: get('--x-real-map-shore', '#b9b09c'),
      river: get('--x-real-map-river', '#8fb0c4'),
      waterInk: get('--x-real-map-water-ink', '#5f7d8f'),
      ink: get('--ink', '#1c1f30'),
      muted: get('--muted', '#625f72'),
      accent: get('--accent', '#9a5a06'),
      halo: get('--x-real-map-halo', '#fffcf6'),
      dot: get('--x-real-map-dot', '#fffcf6'),
    };
    this.font = get('--font-ui', 'system-ui, sans-serif');
    this.widths.clear();
    this.request();
  }

  resize(w: number, h: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    if (this.pendingFit) this.fit(this.pendingFit, false);
    else this.v = this.clamp(this.v);
    this.request();
  }

  /** Keep this part of the canvas (the zoom buttons) clear. */
  reserve(r: Rect | null): void {
    this.reserved = r;
    this.request();
  }

  /** The room kept clear around fitted places: the padding, and on the right the zoom buttons. */
  private pads(): { left: number; right: number; top: number; bottom: number } {
    const r = this.reserved;
    return { ...PAD, right: r ? Math.max(PAD.right, this.w - r[0] + 10) : PAD.right };
  }

  setMarkers(ms: Marker[]): void {
    this.markers = ms;
    this.request();
  }

  setShades(ss: Shade[]): void {
    this.shades = ss;
    this.request();
  }

  /** Show these projected points (or the land around Jerusalem, for none). */
  fit(pts: [number, number][], animate: boolean): void {
    if (!this.w || !this.h) {
      this.pendingFit = pts;
      return;
    }
    this.pendingFit = null;
    const xs = pts.length ? pts.map((p) => p[0]) : [projX(33.9), projX(36.9)];
    const ys = pts.length ? pts.map((p) => p[1]) : [projY(29.6), projY(33.5)];
    const target = this.framed(xs, ys, Infinity);
    this.home = target;
    this.go(target, animate);
  }

  /** Back to the fitted view. */
  refit(): void {
    if (this.home) this.go(this.home, true);
  }

  /** Make sure these points are in view, moving as little as needed. */
  reveal(pts: [number, number][]): void {
    if (!pts.length || !this.w) return;
    const p = this.pads();
    const inView = pts.every(([x, y]) => {
      const sx = (x - this.v.cx) * this.v.s + this.w / 2;
      const sy = (y - this.v.cy) * this.v.s + this.h / 2;
      return sx > p.left && sx < this.w - p.right && sy > p.top && sy < this.h - p.bottom;
    });
    if (inView) return;
    const xs = pts.map((p) => p[0]).concat([this.v.cx]);
    const ys = pts.map((p) => p[1]).concat([this.v.cy]);
    this.go(this.framed(xs, ys, this.v.s), true);
  }

  /** The view that shows these projected coordinates in the canvas less its
   * padding and the zoom buttons, centred there, zoomed in no further than `most`. */
  private framed(xs: number[], ys: number[], most: number): ViewState {
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const sw = Math.max(x1 - x0, MIN_SPAN) * 1.2;
    const sh = Math.max(y1 - y0, MIN_SPAN) * 1.2;
    const p = this.pads();
    const iw = Math.max(40, this.w - p.left - p.right);
    const ih = Math.max(40, this.h - p.top - p.bottom);
    const s = this.clampScale(Math.min(most, iw / sw, ih / sh));
    const dx = (p.left + (this.w - p.right)) / 2 - this.w / 2;
    const dy = (p.top + (this.h - p.bottom)) / 2 - this.h / 2;
    return this.clamp({ cx: (x0 + x1) / 2 - dx / s, cy: (y0 + y1) / 2 - dy / s, s });
  }

  /** Zoom by a factor about a point on the canvas (its centre by default). */
  zoomAt(f: number, sx = this.w / 2, sy = this.h / 2, animate = false): void {
    const from = this.anim ? this.anim.to : this.v;
    const mx = from.cx + (sx - this.w / 2) / from.s;
    const my = from.cy + (sy - this.h / 2) / from.s;
    const s = this.clampScale(from.s * f);
    const to = this.clamp({ cx: mx - (sx - this.w / 2) / s, cy: my - (sy - this.h / 2) / s, s });
    this.go(to, animate);
  }

  // ---------------------------------------------------------------- view state

  private minScale(): number {
    const b = this.geo.box;
    return Math.min(this.w / (b.x1 - b.x0), this.h / (b.y1 - b.y0));
  }

  private clampScale(s: number): number {
    return Math.min(MAX_SCALE, Math.max(this.minScale(), s));
  }

  private clamp(v: ViewState): ViewState {
    const b = this.geo.box;
    const s = this.clampScale(v.s);
    const hw = this.w / 2 / s;
    const hh = this.h / 2 / s;
    const fitX = (c: number, lo: number, hi: number, half: number) => (hi - lo <= half * 2 ? (lo + hi) / 2 : Math.min(hi - half, Math.max(lo + half, c)));
    return { cx: fitX(v.cx, b.x0, b.x1, hw), cy: fitX(v.cy, b.y0, b.y1, hh), s };
  }

  private go(to: ViewState, animate: boolean): void {
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || still || !this.w) {
      this.anim = null;
      this.v = to;
    } else {
      this.anim = { from: { ...this.v }, to, t0: performance.now(), ms: 320 };
    }
    this.request();
  }

  private request(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame((t) => {
      this.frame = 0;
      if (this.anim) {
        const k = Math.min(1, (t - this.anim.t0) / this.anim.ms);
        const e = 1 - (1 - k) ** 3;
        const { from, to } = this.anim;
        const s = Math.exp(Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * e);
        this.v = { cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e, s };
        if (k >= 1) this.anim = null;
        else this.request();
      }
      this.draw();
    });
  }

  // ---------------------------------------------------------------- gestures

  private local(e: MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety: dragging still works without it.
    }
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    this.anim = null;
    if (this.pointers.size === 1) {
      this.pan = { x: p.x, y: p.y, v: { ...this.v }, moved: false, t: performance.now(), id: e.pointerId };
      this.pinch = null;
    } else if (this.pointers.size === 2) {
      this.startPinch();
    }
  }

  private startPinch(): void {
    const [a, b] = [...this.pointers.values()];
    this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, v: { ...this.v } };
    if (this.pan) this.pan.moved = true;
  }

  private move(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const v0 = this.pinch.v;
      const s = this.clampScale(v0.s * (d / this.pinch.d));
      // Keep the point that was under the fingers under them.
      const gx = v0.cx + (this.pinch.mx - this.w / 2) / v0.s;
      const gy = v0.cy + (this.pinch.my - this.h / 2) / v0.s;
      this.v = this.clamp({ cx: gx - (mx - this.w / 2) / s, cy: gy - (my - this.h / 2) / s, s });
      this.request();
      return;
    }
    const pan = this.pan;
    if (!pan || pan.id !== e.pointerId) return;
    const dx = p.x - pan.x;
    const dy = p.y - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 6) return;
    pan.moved = true;
    this.v = this.clamp({ cx: pan.v.cx - dx / pan.v.s, cy: pan.v.cy - dy / pan.v.s, s: pan.v.s });
    this.request();
  }

  private up(e: PointerEvent, done: boolean): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    const pan = this.pan;
    if (this.pointers.size === 1) {
      // One finger left after a pinch: carry on panning from where it is.
      const [[id, p]] = [...this.pointers.entries()];
      this.pinch = null;
      this.pan = { x: p.x, y: p.y, v: { ...this.v }, moved: true, t: 0, id };
      return;
    }
    if (this.pointers.size === 0) {
      this.pinch = null;
      this.pan = null;
      if (done && pan && !pan.moved && performance.now() - pan.t < 600) this.tap(pan.x, pan.y);
    }
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const p = this.local(e);
    const unit = e.deltaMode === 1 ? 0.06 : e.deltaMode === 2 ? 0.6 : 0.0018;
    this.zoomAt(Math.exp(-e.deltaY * unit), p.x, p.y, false);
  }

  private tap(x: number, y: number): void {
    let best: Hit | null = null;
    let bestD = Infinity;
    for (const h of this.hits) {
      const inRect = h.rect && x >= h.rect[0] - 3 && x <= h.rect[2] + 3 && y >= h.rect[1] - 3 && y <= h.rect[3] + 3;
      const d = inRect ? 0 : Math.hypot(x - h.x, y - h.y);
      if (d > 22) continue;
      if (d < bestD || (d === bestD && best && h.tier < best.tier)) {
        best = h;
        bestD = d;
      }
    }
    if (best) this.onTap(best.place);
  }

  // ---------------------------------------------------------------- drawing

  private width(text: string, font: string): number {
    const key = `${font}|${text}`;
    let w = this.widths.get(key);
    if (w === undefined) {
      this.ctx.font = font;
      w = this.ctx.measureText(text).width;
      this.widths.set(key, w);
    }
    return w;
  }

  private draw(): void {
    const c = this.colors;
    if (!c || !this.w || !this.h) return;
    const { ctx, dpr, w, h, geo } = this;
    const { cx, cy, s } = this.v;
    const sx = (x: number) => (x - cx) * s + w / 2;
    const sy = (y: number) => (y - cy) * s + h / 2;

    // Water, land, lakes, rivers: in map units.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = c.water;
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (w / 2 - cx * s), dpr * (h / 2 - cy * s));
    ctx.fillStyle = c.land;
    ctx.fill(geo.land, 'evenodd');
    ctx.fillStyle = c.water;
    ctx.fill(geo.lakes, 'evenodd');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = c.river;
    if (s > 40) {
      ctx.lineWidth = 0.9 / s;
      ctx.stroke(geo.rivers);
    }
    ctx.lineWidth = Math.min(2.4, 1 + s / 300) / s;
    ctx.stroke(geo.namedRivers);
    ctx.strokeStyle = c.shore;
    ctx.lineWidth = 0.9 / s;
    ctx.stroke(geo.shore);

    // Regions and the tribes' lands, on land only, softly: their edges are
    // approximate. Reference shapes first, the chosen one last.
    if (this.shades.length) {
      ctx.save();
      ctx.clip(geo.land, 'evenodd');
      for (const sh of [...this.shades].sort((a, b) => b.tier - a.tier)) {
        const ink = sh.tier === 2 ? c.muted : c.accent;
        ctx.fillStyle = ink;
        ctx.globalAlpha = sh.tier === 0 ? 0.16 : sh.tier === 1 ? 0.1 : 0.05;
        ctx.fill(sh.path, 'evenodd');
        ctx.globalAlpha = sh.tier === 2 ? 0.55 : 0.8;
        ctx.strokeStyle = ink;
        ctx.lineWidth = (sh.tier === 0 ? 1.5 : 1.1) / s;
        ctx.setLineDash([5 / s, 4 / s]);
        ctx.stroke(sh.path);
      }
      ctx.restore();
    }

    // Names and places: in pixels.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textBaseline = 'middle';
    // Names keep clear of the zoom buttons and the scale bar.
    const taken: Rect[] = [this.bar().rect];
    if (this.reserved) taken.push(this.reserved);
    const hits: Hit[] = [];
    const font = this.font;
    const fonts = {
      0: `700 14px ${font}`,
      1: `600 13px ${font}`,
      2: `500 11.5px ${font}`,
    } as const;
    const areaFonts = {
      0: `700 12.5px ${font}`,
      1: `600 11.5px ${font}`,
      2: `500 10.5px ${font}`,
    } as const;
    const margin = 4;
    const inside = (r: Rect) => r[0] >= margin && r[1] >= margin && r[2] <= w - margin && r[3] <= h - margin;
    const free = (r: Rect) => inside(r) && !taken.some((t) => overlaps(t, r));

    // Places, most important first, so the chosen place and this verse's
    // places always get their names.
    const order = [...this.markers].sort((a, b) => a.tier - b.tier);
    const drawn: { m: Marker; x: number; y: number; r: number; label: Rect | null }[] = [];
    for (const m of order) {
      const x = sx(m.x);
      const y = sy(m.y);
      if (x < -40 || y < -40 || x > w + 40 || y > h + 40) continue;
      const r = m.area ? 0 : m.proposed ? 6 : m.tier === 0 ? 6 : m.tier === 1 ? 4.5 : 3.2;
      if (r) taken.push([x - r - 1, y - r - 1, x + r + 1, y + r + 1]);
      drawn.push({ m, x, y, r, label: null });
    }
    // How much a spot overlaps what is already placed, to pick the least bad
    // spot for a name that must show.
    const crowding = (r: Rect) => {
      let a = 0;
      for (const t of taken) {
        const dx = Math.min(t[2], r[2]) - Math.max(t[0], r[0]);
        const dy = Math.min(t[3], r[3]) - Math.max(t[1], r[1]);
        if (dx > 0 && dy > 0) a += dx * dy;
      }
      return a;
    };
    // Names next to dots go first, then the names of regions and rivers,
    // which can sit anywhere near their point.
    const labelOrder = [...drawn].sort((a, b) => a.m.tier - b.m.tier || Number(a.m.area) - Number(b.m.area));
    for (const d of labelOrder) {
      const { m, x, y, r } = d;
      if (!m.label) {
        hits.push({ place: m.place, x, y, rect: null, tier: m.tier });
        continue;
      }
      const text = m.area ? m.label.toUpperCase() : m.label;
      const f = m.area ? areaFonts[m.tier] : fonts[m.tier];
      const tw = this.width(text, f) + (m.area ? text.length * 1.2 : 0);
      const th = m.tier === 2 ? 13 : 16;
      const spots: Rect[] = [];
      const at = (dx: number, dy: number) => spots.push([x + dx - tw / 2, y + dy - th / 2, x + dx + tw / 2, y + dy + th / 2]);
      if (m.area) {
        const side = tw / 2 + 12;
        at(0, 0);
        for (const k of [1, 2, 3]) {
          at(0, -k * th);
          at(0, k * th);
        }
        for (const dy of [0, -th, th]) {
          at(-side, dy);
          at(side, dy);
        }
      } else {
        at(r + 4 + tw / 2, 0);
        at(-(r + 4 + tw / 2), 0);
        at(0, -(r + 3 + th / 2));
        at(0, r + 3 + th / 2);
      }
      let spot = spots.find(free) ?? null;
      // This verse's names always show, in the least crowded spot if need be.
      if (!spot && m.tier < 2) {
        const fits = spots.filter(inside);
        spot = (fits.length ? fits : spots).reduce((a, b) => (crowding(b) < crowding(a) ? b : a));
      }
      if (spot) taken.push(spot);
      d.label = spot;
      hits.push({ place: m.place, x, y, rect: spot, tier: m.tier });
    }

    // Water names where there is room.
    ctx.textAlign = 'center';
    const waterFont = (px: number) => `italic 500 ${px}px ${font}`;
    const seaText = (name: string) => name.toUpperCase();
    for (const sea of [...geo.seas].sort((a, b) => a.rank - b.rank)) {
      const px = sea.rank <= 1 ? 12 : 11;
      const text = seaText(sea.name);
      const f = waterFont(px);
      const tw = this.width(text, f) + text.length * 1.6;
      let best: Rect | null = null;
      let bx = 0;
      let by = 0;
      for (const spot of sea.spots) {
        if (spot.open * s < tw * 0.42) continue;
        const x = sx(spot.x);
        const y = sy(spot.y);
        const r: Rect = [x - tw / 2, y - 8, x + tw / 2, y + 8];
        if (free(r)) {
          best = r;
          bx = x;
          by = y;
          break;
        }
      }
      if (!best) continue;
      taken.push(best);
      this.text(text, bx, by, f, c.waterInk, c.water, 1.6);
    }
    for (const l of geo.lakeNames) {
      if (s < (l.rank <= 5 ? 140 : 60)) continue;
      const f = waterFont(11);
      const tw = this.width(l.name, f);
      const x = sx(l.x);
      const y = sy(l.y);
      const r: Rect = [x - tw / 2, y - 7, x + tw / 2, y + 7];
      if (!free(r)) continue;
      taken.push(r);
      this.text(l.name, x, y, f, c.waterInk, c.water, 0);
    }
    if (s > 70) {
      const seen = new Map<string, [number, number][]>();
      for (const l of geo.riverNames) {
        const x = sx(l.x);
        const y = sy(l.y);
        const near = seen.get(l.name) ?? [];
        if (near.some(([px, py]) => Math.hypot(px - x, py - y) < 220)) continue;
        const f = waterFont(10.5);
        const tw = this.width(l.name, f);
        const r: Rect = [x + 6, y - 7, x + 6 + tw, y + 7];
        if (!free(r)) continue;
        taken.push(r);
        near.push([x, y]);
        seen.set(l.name, near);
        ctx.textAlign = 'left';
        this.text(l.name, x + 6, y, f, c.waterInk, c.land, 0);
        ctx.textAlign = 'center';
      }
    }

    // The places themselves, least important first so the chosen one is on top.
    for (let i = drawn.length - 1; i >= 0; i--) {
      const { m, x, y, r, label } = drawn[i];
      const ink = m.tier === 2 ? c.muted : m.tier === 0 ? c.ink : c.ink;
      if (r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        if (m.proposed) {
          ctx.setLineDash([2.5, 2.5]);
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = m.tier === 2 ? c.muted : c.accent;
          ctx.fillStyle = c.halo;
          ctx.globalAlpha = 0.65;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = m.tier === 2 ? c.muted : c.accent;
          ctx.fill();
          ctx.lineWidth = m.tier === 0 ? 2.5 : 1.5;
          ctx.strokeStyle = c.dot;
          ctx.stroke();
          if (m.tier === 0) {
            ctx.beginPath();
            ctx.arc(x, y, r + 4, 0, Math.PI * 2);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = c.accent;
            ctx.stroke();
          }
        }
      }
      if (label) {
        const text = m.area ? m.label.toUpperCase() : m.label;
        const f = m.area ? areaFonts[m.tier] : fonts[m.tier];
        ctx.textAlign = 'left';
        this.text(text, label[0], (label[1] + label[3]) / 2, f, m.area && m.tier > 0 ? c.muted : ink, c.halo, m.area ? 1.2 : 0);
      }
    }
    ctx.textAlign = 'left';
    this.scaleBar(c);
    this.hits = hits;
  }

  /** Text with a soft halo, so it reads over land, water and lines. */
  private text(t: string, x: number, y: number, font: string, ink: string, halo: string, spacing: number): void {
    const ctx = this.ctx;
    ctx.font = font;
    const any = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    if (spacing && 'letterSpacing' in any) any.letterSpacing = `${spacing}px`;
    ctx.lineWidth = 3.2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = halo;
    ctx.globalAlpha = 0.9;
    ctx.strokeText(t, x, y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink;
    ctx.fillText(t, x, y);
    if (spacing && 'letterSpacing' in any) any.letterSpacing = '0px';
  }

  /** The scale bar's length in km and pixels, and the box it takes. */
  private bar(): { km: number; len: number; x: number; y: number; rect: Rect } {
    const pxPerKm = this.v.s / KM_PER_UNIT;
    const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const km = steps.find((k) => k * pxPerKm >= 56) ?? 1000;
    const len = km * pxPerKm;
    const x = 12;
    const y = this.h - 14;
    const tw = this.width(`${km} km`, `500 11px ${this.font}`);
    return { km, len, x, y, rect: [x - 4, y - 12, x + len + 6 + tw + 4, y + 6] };
  }

  private scaleBar(c: Colors): void {
    const ctx = this.ctx;
    const { km, len, x, y } = this.bar();
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.lineTo(x + len, y - 4);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = c.halo;
    ctx.stroke();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = c.muted;
    ctx.stroke();
    ctx.textAlign = 'left';
    this.text(`${km} km`, x + len + 6, y - 2, `500 11px ${this.font}`, c.muted, c.halo, 0);
  }
}
