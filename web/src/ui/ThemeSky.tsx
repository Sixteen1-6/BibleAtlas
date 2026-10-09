// Small night skies for the themes, painted on 2D canvases (no WebGL).
//
// MiniSky: a strip on each theme card showing the theme's own strongly voted
// links, painted only when the card scrolls into view and cached per theme.
// ThemeHero: the chosen theme's links, faint, with its gold thread on top.
//
// The links are drawn the way the main map draws them: their light is added
// up in a float buffer and tone-mapped over the same night-sky gradient, so a
// card looks like a small window onto the big map. Additive light never
// saturates to a flat blob, and the cost is a fixed amount of plain
// JavaScript (no GPU work waits behind it).

import { useEffect, useRef } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import { type Atlas, type Theme, label } from '../data/atlas';
import { ALL_VOTES, THREAD_VOTES, type Thread, themeLinksOf, warmTheme } from '../data/thread';
import { SHAPE, verseX } from '../gl/layout';
import * as S from '../state';
import { ARC, type ArcColorMode, GENRE, SKY, SPECTRUM, rgb } from './colors';
import './themes.css';

// ------------------------------------------------------------ colours

const xsCache = new WeakMap<Atlas, Float32Array>();
function xsOf(a: Atlas): Float32Array {
  let xs = xsCache.get(a);
  if (!xs) {
    xs = verseX(a);
    xsCache.set(a, xs);
  }
  return xs;
}

const SPEC = SPECTRUM.map(rgb);
const REACH = [ARC.sameBook, ARC.near, ARC.far, ARC.testaments].map(rgb);
const GENRE_RGB: Record<string, [number, number, number]> = Object.fromEntries(Object.entries(GENRE).map(([k, g]) => [k, rgb(g.color)]));
const SKY_TOP = rgb(SKY.top);
const SKY_HORIZON = rgb(SKY.horizon);
const SKY_GLOW = rgb(SKY.glow);

/** Per link: x0, x1 (0..1 across the map), r, g, b (the map shader's colour
 *  for the link), strength. */
function linkData(a: Atlas, edges: ArrayLike<number>, mode: ArcColorMode): Float32Array {
  const xs = xsOf(a);
  const ntStart = a.books.find((b) => b.testament === 'NT')?.start ?? a.n;
  const out = new Float32Array(edges.length * 6);
  for (let i = 0, o = 0; i < edges.length; i++, o += 6) {
    const e = edges[i];
    const s = a.xSrc[e];
    const d = a.xDst[e];
    // The colour is c0, or a mix t of the way from c0 to c1.
    let c0 = SPEC[0];
    let c1 = c0;
    let t = 0;
    if (mode === 'genre') {
      c0 = c1 = GENRE_RGB[a.books[a.verseBook[s]].genre] ?? SPEC[0];
    } else if (mode === 'reach') {
      if (a.verseBook[s] === a.verseBook[d]) c0 = c1 = REACH[0];
      else if (s < ntStart !== d < ntStart) c0 = c1 = REACH[3];
      else {
        c0 = REACH[1];
        c1 = REACH[2];
        t = Math.min(1, Math.max(0, Math.log(1 + Math.abs(xs[d] - xs[s]) * 400) / Math.log(401)));
      }
    } else {
      const f = Math.min(1, Math.max(0, Math.min(xs[s], xs[d]))) * (SPEC.length - 1);
      const k = Math.min(Math.floor(f), SPEC.length - 2);
      c0 = SPEC[k];
      c1 = SPEC[k + 1];
      t = f - k;
    }
    out[o] = xs[s];
    out[o + 1] = xs[d];
    out[o + 2] = c0[0] + (c1[0] - c0[0]) * t;
    out[o + 3] = c0[1] + (c1[1] - c0[1]) * t;
    out[o + 4] = c0[2] + (c1[2] - c0[2]) * t;
    out[o + 5] = 0.25 + 0.75 * Math.min(1, Math.max(0, Math.log(Math.max(a.xVotes[e], 1)) / Math.log(150)));
  }
  return out;
}

interface SkyData {
  /** linkData() of the theme's links. */
  data: Float32Array;
  /** How many links. */
  count: number;
}
const skyDataCache = new WeakMap<Atlas, Map<string, SkyData>>();

/** A theme's links with `minVotes` or more votes, ready to paint in colour
 *  mode `mode`. Cached per theme, so a sky painted again only redraws. */
function skyData(a: Atlas, theme: Theme, minVotes: number, mode: ArcColorMode): SkyData {
  let m = skyDataCache.get(a);
  if (!m) {
    m = new Map();
    skyDataCache.set(a, m);
  }
  const key = `${theme.id}|${minVotes}|${mode}`;
  let d = m.get(key);
  if (!d) {
    const edges = themeLinksOf(a, theme, minVotes);
    d = { data: linkData(a, edges, mode), count: edges.length };
    m.set(key, d);
  }
  return d;
}

// ------------------------------------------------------------ painting

interface SkyStyle {
  /** Baseline, as a fraction of the height from the top. */
  base: number;
  /** Light per link; more links get less each so dense themes keep their shape. */
  gain: number;
  /** Book-group colour band under the baseline, in device pixels (0 for none). */
  band: number;
}

/** Arc height for a span, like the map: short arcs rise steeply, long ones nest. */
function rise(span: number, width: number, hmax: number): number {
  return hmax * Math.pow(Math.min(1, span / width), SHAPE);
}

// The light buffer, reused from one sky to the next.
let scratch = new Float32Array(0);

// Painting runs in three small passes rather than one long function: the
// JavaScript engine then optimizes each pass as soon as it runs hot, instead
// of compiling one big function and throwing the result away when it reaches
// code that has not run yet. That halves the cost of the first few skies.

/** Adds up the light of every link, as RGB floats per pixel. */
function accumulate(links: Float32Array, w: number, h: number, baseY: number, gain: number): Float32Array {
  if (scratch.length < w * h * 3) scratch = new Float32Array(w * h * 3);
  const acc = scratch.subarray(0, w * h * 3);
  acc.fill(0);
  const hmax = baseY * 0.95;
  const n = links.length / 6;
  const row = w * 3;
  for (let i = 0; i < n; i++) {
    const o = i * 6;
    const x0 = links[o] * w;
    const x1 = links[o + 1] * w;
    const span = Math.abs(x1 - x0);
    const ht = rise(span, w, hmax);
    // The arc is x = x0 + (x1 - x0) t, y = baseY - ht sin(πt), so it moves at
    // most hypot(span, π ht) pixels per unit of t: that many samples keeps
    // them a pixel or less apart. Each adds its share of light into the four
    // pixels around it, so lines come out smooth at any slope.
    const lift = Math.PI * ht;
    const steps = Math.max(2, Math.ceil(Math.sqrt(span * span + lift * lift)));
    const inv = 1 / steps;
    const k = links[o + 5] * gain * inv;
    const cr = links[o + 2] * k;
    const cg = links[o + 3] * k;
    const cb = links[o + 4] * k;
    const span2 = span * span;
    const lift2 = lift * lift;
    const cd = Math.cos(Math.PI * inv);
    const sd = Math.sin(Math.PI * inv);
    const dx = (x1 - x0) * inv;
    const y0 = baseY - 0.5;
    let x = x0 - 0.5;
    let sn = 0;
    let cs = 1;
    for (let j = 0; j <= steps; j++, x += dx) {
      const y = y0 - ht * sn;
      // Light in proportion to the length this sample stands for.
      const ds = Math.sqrt(span2 + lift2 * cs * cs);
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      if (ix >= 0 && iy >= 0 && ix < w - 1 && iy < h - 1) {
        const ax = x - ix;
        const ay = y - iy;
        const p = (iy * w + ix) * 3;
        const q = p + row;
        const lo = ay * ds;
        const hi = ds - lo;
        const w10 = ax * hi;
        const w00 = hi - w10;
        const w11 = ax * lo;
        const w01 = lo - w11;
        acc[p] += cr * w00;
        acc[p + 1] += cg * w00;
        acc[p + 2] += cb * w00;
        acc[p + 3] += cr * w10;
        acc[p + 4] += cg * w10;
        acc[p + 5] += cb * w10;
        acc[q] += cr * w01;
        acc[q + 1] += cg * w01;
        acc[q + 2] += cb * w01;
        acc[q + 3] += cr * w11;
        acc[q + 4] += cg * w11;
        acc[q + 5] += cb * w11;
      }
      const s2 = sn * cd + cs * sd;
      cs = cs * cd - sn * sd;
      sn = s2;
    }
  }
  return acc;
}

/** Tone map like the map's second pass: compress the brightest channel and
 *  keep the hue, over a sky that deepens upward and glows along the baseline. */
function toneMap(acc: Float32Array, w: number, h: number, baseY: number): ImageData {
  const img = new ImageData(w, h);
  const px = img.data;
  // Whole pixels at a time, as RGBA bytes in memory order (little-endian,
  // which the atlas data views already assume).
  const px32 = new Uint32Array(px.buffer, px.byteOffset, w * h);
  const exposure = 1.15;
  for (let y = 0; y < h; y++) {
    const above = Math.min(1, Math.max(0, (baseY - (y + 0.5)) / baseY));
    const m = Math.pow(above, 0.7);
    const glow = Math.exp((-Math.abs(y + 0.5 - baseY) / h) * 18) * 0.35;
    const sr = SKY_HORIZON[0] + (SKY_TOP[0] - SKY_HORIZON[0]) * m + SKY_GLOW[0] * glow;
    const sg = SKY_HORIZON[1] + (SKY_TOP[1] - SKY_HORIZON[1]) * m + SKY_GLOW[1] * glow;
    const sb = SKY_HORIZON[2] + (SKY_TOP[2] - SKY_HORIZON[2]) * m + SKY_GLOW[2] * glow;
    // Light lands on the sky as sky + light × (1 − sky), in 0..255.
    const br = sr * 255 + 0.5;
    const bg = sg * 255 + 0.5;
    const bb = sb * 255 + 0.5;
    const qr = (1 - sr) * 255;
    const qg = (1 - sg) * 255;
    const qb = (1 - sb) * 255;
    const bare = (0xff000000 | (bb << 16) | (bg << 8) | br) >>> 0;
    for (let x = 0, p = y * w * 3, o = y * w; x < w; x++, p += 3, o++) {
      let r = acc[p] * exposure;
      let g = acc[p + 1] * exposure;
      let b = acc[p + 2] * exposure;
      const peak = Math.max(r, g, b);
      if (peak <= 0) {
        px32[o] = bare;
        continue;
      }
      const f = (1 - Math.exp(-peak)) / peak;
      r *= f;
      g *= f;
      b *= f;
      if (peak > 2.5) {
        const u = Math.min(1, (peak - 2.5) / 6.5);
        const wv = u * u * (3 - 2 * u) * 0.35;
        r += (1 - r) * wv;
        g += (1 - g) * wv;
        b += (1 - b) * wv;
      }
      px32[o] = (0xff000000 | ((bb + b * qb) << 16) | ((bg + g * qg) << 8) | (br + r * qr)) >>> 0;
    }
  }
  return img;
}

/** Book groups under the baseline, as on the map: `band` pixels tall. */
function bands(a: Atlas, img: ImageData, baseY: number, band: number): void {
  const { width: w, height: h, data: px } = img;
  const xs = xsOf(a);
  const y0 = Math.min(h - 1, Math.round(baseY) + 1);
  const y1 = Math.min(h, y0 + band);
  a.books.forEach((b, bi) => {
    const end = bi + 1 < a.books.length ? a.books[bi + 1].start - 1 : a.n - 1;
    const c = GENRE_RGB[b.genre] ?? SPEC[0];
    const xa = Math.max(0, Math.floor(xs[b.start] * w));
    const xb = Math.min(w, Math.max(xa + 1, Math.ceil(xs[end] * w)));
    for (let y = y0; y < y1; y++) {
      for (let x = xa; x < xb; x++) {
        const o = (y * w + x) * 4;
        px[o] += (c[0] * 255 - px[o]) * 0.7;
        px[o + 1] += (c[1] * 255 - px[o + 1]) * 0.7;
        px[o + 2] += (c[2] * 255 - px[o + 2]) * 0.7;
      }
    }
  });
}

/** Paints links into an ImageData of w × h device pixels. */
function paintSky(a: Atlas, links: Float32Array, w: number, h: number, st: SkyStyle): ImageData {
  const baseY = st.base * h;
  const img = toneMap(accumulate(links, w, h, baseY, st.gain), w, h, baseY);
  if (st.band > 0) bands(a, img, baseY, st.band);
  return img;
}

/** Light per link, so a theme with 50 links and one with 2,000 both read well. */
function gainFor(count: number, scale: number): number {
  return Math.min(1, Math.max(0.3, 1.1 * Math.pow(150 / Math.max(1, count), 0.35))) * scale;
}

// Painted skies, newest last. The oldest go once they hold more than
// CACHE_BYTES of pixels.
const CACHE_BYTES = 12 * 1024 * 1024;
const painted = new Map<string, ImageData>();
let paintedBytes = 0;
function cached(key: string, make: () => ImageData): ImageData {
  const hit = painted.get(key);
  if (hit) {
    painted.delete(key);
    painted.set(key, hit);
    return hit;
  }
  const img = make();
  painted.set(key, img);
  paintedBytes += img.data.byteLength;
  for (const [k, old] of painted) {
    if (paintedBytes <= CACHE_BYTES || k === key) break;
    painted.delete(k);
    paintedBytes -= old.data.byteLength;
  }
  return img;
}
/** Drops the painted skies whose keys pass `test`. */
function forget(test: (key: string) => boolean): void {
  for (const [k, img] of painted) {
    if (!test(k)) continue;
    painted.delete(k);
    paintedBytes -= img.data.byteLength;
  }
}

/** Records how long a fresh paint took, for the browser's performance tools.
 *  With `replace`, a new entry replaces the last one of that name. */
function measure(name: string, t0: number, replace = false): void {
  try {
    if (replace) performance.clearMeasures(name);
    performance.measure(name, { start: t0, end: performance.now() });
  } catch {
    // Older browsers: no detailed timing, nothing else changes.
  }
}

const dprOf = () => Math.min(2, Math.max(1, window.devicePixelRatio || 1));

// ------------------------------------------------------------ idle work

interface Deadline {
  readonly didTimeout: boolean;
  timeRemaining(): number;
}
/** Runs `run` when the browser has nothing else to do, or after `timeout` ms. */
function onIdle(run: (d: Deadline) => void, timeout: number): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout });
  else setTimeout(() => run({ didTimeout: false, timeRemaining: () => 6 }), 40);
}

// Skies waiting to be painted. They paint in idle moments, a few at a time,
// so a screenful of new cards never holds up scrolling or the app's start,
// and within a tenth of a second even on a busy page.
const waiting = new Set<() => void>();
let paintPending = false;
function later(job: () => void): void {
  waiting.add(job);
  if (!paintPending) {
    paintPending = true;
    onIdle(paintWaiting, 100);
  }
}
function paintWaiting(d: Deadline): void {
  paintPending = false;
  const t0 = performance.now();
  for (const job of waiting) {
    waiting.delete(job);
    // One sky that fails to paint must not leave the others blank.
    try {
      job();
    } catch (e) {
      console.error(e);
    }
    // On a busy page, once the wait is over, up to 8 ms of skies at a time.
    if (performance.now() - t0 > 8 || (!d.didTimeout && d.timeRemaining() < 2)) break;
  }
  if (waiting.size) {
    paintPending = true;
    onIdle(paintWaiting, 100);
  }
}

const idleJobs: (() => void)[] = [];
let idlePending = false;
/** Runs a small job when the browser has nothing else to do, after any
 *  skies still waiting to be painted. */
function whenIdle(job: () => void): void {
  idleJobs.push(job);
  if (!idlePending) {
    idlePending = true;
    onIdle(runIdle, 3000);
  }
}
function runIdle(d: Deadline): void {
  idlePending = false;
  const start = performance.now();
  // At least one job each time, even when the timeout ran it on a busy page,
  // and never more than about 10 ms, so a tap is never kept waiting. Skies
  // waiting to be painted go first: the rest waits for the next idle moment.
  while (idleJobs.length && !waiting.size) {
    const job = idleJobs.shift()!;
    const t0 = performance.now();
    try {
      job();
    } catch (e) {
      console.error(e);
    }
    try {
      performance.measure('tj-warm', { start: t0, end: performance.now() });
    } catch {
      // No detailed timing in older browsers.
    }
    if (d.timeRemaining() <= 3 || performance.now() - start >= 10) break;
  }
  if (idleJobs.length) {
    idlePending = true;
    onIdle(runIdle, 3000);
  }
}

const warmed = new WeakMap<Atlas, Set<string>>();
/** Once the theme cards are on screen, in idle moments and one theme at a
 *  time: gather the links of the skies still to come, then work out what
 *  choosing each theme needs (its thread, its links), so a tap only draws. */
function warmThemes(a: Atlas, mode: ArcColorMode): void {
  let done = warmed.get(a);
  if (!done) {
    done = new Set();
    warmed.set(a, done);
  }
  const todo = (key: string) => !done.has(key) && !!done.add(key);
  for (const t of a.themes) if (todo(`sky|${t.id}|${mode}`)) whenIdle(() => skyData(a, t, THREAD_VOTES, mode));
  for (const t of a.themes) if (todo(`pick|${t.id}`)) whenIdle(() => warmTheme(a, t));
  for (const t of a.themes) if (todo(`hero|${t.id}|${mode}`)) whenIdle(() => skyData(a, t, ALL_VOTES, mode));
}

// ------------------------------------------------------------ MiniSky

/** A theme's own links (3 or more votes) as a small sky, painted on first sight. */
export function MiniSky({ a, theme, height = 44 }: { a: Atlas; theme: Theme; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mode = S.arcColor.value;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    warmThemes(a, mode);
    let shown = '';
    let visible = false;
    const paint = () => {
      // One canvas pixel per CSS pixel, even on sharper screens: the sky is a
      // soft strip 44 pixels tall, and a phone's two pixels per CSS pixel
      // would paint four times as many for little visible gain.
      const w = Math.round(c.clientWidth);
      const h = Math.round(height);
      if (!visible || w < 2 || h < 2) return;
      const key = `mini|${theme.id}|${w}x${h}|${mode}`;
      if (key === shown) return;
      shown = key;
      const t0 = performance.now();
      let fresh = false;
      const img = cached(key, () => {
        fresh = true;
        const { data, count } = skyData(a, theme, THREAD_VOTES, mode);
        return paintSky(a, data, w, h, { base: 0.86, gain: gainFor(count, 1), band: 2 });
      });
      c.width = w;
      c.height = h;
      c.getContext('2d')?.putImageData(img, 0, 0);
      if (fresh) measure(`tj-sky ${theme.id}`, t0);
    };
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        later(paint);
      },
      // The cards scroll inside the study panel: look ahead within it.
      { root: c.closest('.study'), rootMargin: '160px 0px' },
    );
    io.observe(c);
    const ro = new ResizeObserver(() => later(paint));
    ro.observe(c);
    return () => {
      io.disconnect();
      ro.disconnect();
      waiting.delete(paint);
    };
  }, [a, theme, mode, height]);
  return <canvas ref={ref} class="tj-sky" style={`height:${height}px`} aria-hidden="true" />;
}

// ------------------------------------------------------------ ThemeHero

/** Spread numbered labels along a line so neighbours never overlap: crowded
 *  labels gather into a group centred on where they belong. */
function spread(xs: number[], gap: number, lo: number, hi: number): number[] {
  const groups: { first: number; n: number; left: number }[] = [];
  for (let i = 0; i < xs.length; i++) {
    groups.push({ first: i, n: 1, left: xs[i] });
    for (;;) {
      const b = groups[groups.length - 1];
      const p = groups[groups.length - 2];
      if (!p || p.left + p.n * gap <= b.left) break;
      const n = p.n + b.n;
      let sum = 0;
      for (let k = p.first; k < p.first + n; k++) sum += xs[k];
      groups.splice(groups.length - 2, 2, { first: p.first, n, left: sum / n - ((n - 1) * gap) / 2 });
    }
  }
  const out: number[] = [];
  for (const g of groups) for (let k = 0; k < g.n; k++) out.push(g.left + k * gap);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i], lo + i * gap, i ? out[i - 1] + gap : lo);
  for (let i = out.length - 1; i >= 0; i--) out[i] = Math.min(out[i], hi - (out.length - 1 - i) * gap, i < out.length - 1 ? out[i + 1] - gap : hi);
  return out;
}

const HERO_BASE = 0.72;
const LABEL_R = 7.5;
const LABEL_GAP = 17;

interface HeroGeometry {
  w: number;
  h: number;
  baseY: number;
  labelY: number;
  nodes: number[];
  labels: number[];
}

function heroGeometry(a: Atlas, thread: Thread, w: number, h: number): HeroGeometry {
  const xs = xsOf(a);
  const baseY = HERO_BASE * h;
  const nodes = thread.verses.map((v) => xs[v] * w);
  const labels = spread(nodes, LABEL_GAP, LABEL_R + 3, w - LABEL_R - 3);
  return { w, h, baseY, labelY: baseY + LABEL_R + 8, nodes, labels };
}

/** The chosen theme as a wide sky: its links faint, its thread in gold, each
 *  verse of the thread numbered. A number can be clicked like its step.
 *  `total` is the theme's link count as the map and the toggle give it. */
export function ThemeHero({ a, theme, thread, mode, total, onStep }: { a: Atlas; theme: Theme; thread: Thread; mode: 'thread' | 'all' | null; total: number; onStep: (i: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const geo = useRef<HeroGeometry | null>(null);
  const colorMode = S.arcColor.value;
  const sel = useComputed(() => (S.selected.value === null ? -1 : thread.verses.indexOf(S.selected.value))).value;
  // A verse pointed at in the text or a panel counts as hovered, as pointing.ts reads them.
  const hov = useComputed(() => {
    const p = S.pointedVerse.value ?? S.hovered.value;
    return p === null ? -1 : thread.verses.indexOf(p);
  }).value;
  const bright = mode === 'all';

  // The latest drawing, so that one ResizeObserver per mount can call it. It
  // does nothing when nothing it draws has changed: a hover redraws only the
  // thread over the cached sky, and a resize to the same size draws nothing.
  const drawn = useRef('');
  const draw = useRef<() => void>(() => {});
  draw.current = () => {
    const c = ref.current;
    if (!c) return;
    const dpr = dprOf();
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    if (cw < 2 || ch < 2) return;
    const w = Math.round(cw * dpr);
    const h = Math.round(ch * dpr);
    const size = `${w}x${h}`;
    const key = `hero|${theme.id}|${colorMode}|${bright ? 1 : 0}|${size}`;
    if (drawn.current === `${key}|${sel}|${hov}`) return;
    drawn.current = `${key}|${sel}|${hov}`;
    const t0 = performance.now();
    let fresh = false;
    const base = cached(key, () => {
      fresh = true;
      // Only the current hero size is worth keeping.
      forget((k) => k.startsWith('hero|') && !k.endsWith(`|${size}`));
      const { data, count } = skyData(a, theme, ALL_VOTES, colorMode);
      return paintSky(a, data, w, h, { base: HERO_BASE, gain: gainFor(count, bright ? 1.2 : 0.42), band: Math.max(2, Math.round(dpr * 2)) });
    });
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(base, 0, 0);
    const g = heroGeometry(a, thread, cw, ch);
    geo.current = g;
    ctx.save();
    ctx.scale(dpr, dpr);
    drawThread(ctx, g, thread, sel, hov, bright);
    ctx.restore();
    if (fresh) measure(`tj-hero ${theme.id}`, t0, true);
  };
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ro = new ResizeObserver(() => draw.current());
    ro.observe(c);
    return () => ro.disconnect();
  }, []);
  useEffect(() => draw.current(), [a, theme, thread, colorMode, bright, sel, hov]);

  const hit = (e: PointerEvent): number => {
    const g = geo.current;
    const c = ref.current;
    if (!g || !c) return -1;
    const r = c.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    let best = -1;
    let bd = LABEL_R + 5;
    g.labels.forEach((lx, i) => {
      const d = Math.hypot(lx - x, g.labelY - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    // Also the node itself, where the arcs meet the baseline.
    if (best < 0 && Math.abs(y - g.baseY) < 9) {
      g.nodes.forEach((nx, i) => {
        const d = Math.abs(nx - x);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
    }
    return best;
  };

  const first = thread.verses[0];
  const last = thread.verses[thread.verses.length - 1];
  const aria =
    thread.verses.length === 0
      ? `${theme.name}: no verses to show`
      : thread.kind === 'thread'
        ? `${theme.name}: a thread of ${thread.verses.length} linked verses from ${label(a, first)} to ${label(a, last)}, drawn over the theme's ${total.toLocaleString()} links`
        : `${theme.name}: its ${thread.verses.length} most central verses, from ${label(a, first)} to ${label(a, last)}, over the theme's ${total.toLocaleString()} links`;

  return (
    <div class="tj-hero">
      <canvas
        ref={ref}
        role="img"
        aria-label={aria}
        onPointerMove={(e) => {
          const i = hit(e);
          (e.currentTarget as HTMLCanvasElement).style.cursor = i >= 0 ? 'pointer' : '';
          if (e.pointerType !== 'mouse') return;
          const v = i >= 0 ? thread.verses[i] : null;
          if (v !== null) S.hovered.value = v;
          else if (S.hovered.peek() !== null && thread.verses.includes(S.hovered.peek()!)) S.hovered.value = null;
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse' && S.hovered.peek() !== null && thread.verses.includes(S.hovered.peek()!)) S.hovered.value = null;
        }}
        onClick={(e) => {
          const i = hit(e as unknown as PointerEvent);
          if (i >= 0) onStep(i);
        }}
      />
    </div>
  );
}

const LAMP = rgb(ARC.lamp);
const lamp = (alpha: number) => `rgba(${Math.round(LAMP[0] * 255)}, ${Math.round(LAMP[1] * 255)}, ${Math.round(LAMP[2] * 255)}, ${alpha})`;

function archPath(ctx: CanvasRenderingContext2D, x0: number, x1: number, baseY: number, ht: number): void {
  const steps = Math.max(8, Math.min(48, Math.ceil(Math.abs(x1 - x0) / 6)));
  ctx.moveTo(x0, baseY);
  for (let j = 1; j <= steps; j++) {
    const t = j / steps;
    ctx.lineTo(x0 + (x1 - x0) * t, baseY - ht * Math.sin(Math.PI * t));
  }
}

function drawThread(ctx: CanvasRenderingContext2D, g: HeroGeometry, thread: Thread, sel: number, hov: number, quiet: boolean): void {
  const hmax = g.baseY * 0.95;
  const focus = sel >= 0 ? sel : hov;
  const near = (i: number) => focus >= 0 && (i === focus || i + 1 === focus);
  // The thread: a soft glow added onto the sky, then a fine gold line.
  for (const glow of [true, false]) {
    for (let i = 0; i + 1 < g.nodes.length && thread.kind === 'thread'; i++) {
      const x0 = g.nodes[i];
      const x1 = g.nodes[i + 1];
      ctx.beginPath();
      archPath(ctx, x0, x1, g.baseY, rise(Math.abs(x1 - x0), g.w, hmax));
      if (glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = lamp(near(i) ? 0.45 : quiet ? 0.12 : 0.26);
        ctx.lineWidth = near(i) ? 8 : 6;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = lamp(focus >= 0 && !near(i) ? 0.6 : quiet ? 0.7 : 1);
        ctx.lineWidth = near(i) ? 2.6 : quiet ? 1.2 : 2;
      }
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  // Leader lines from each verse on the baseline to its number.
  ctx.lineWidth = 1;
  g.nodes.forEach((nx, i) => {
    ctx.strokeStyle = lamp(i === focus ? 0.8 : 0.32);
    ctx.beginPath();
    ctx.moveTo(nx, g.baseY + 1);
    ctx.lineTo(g.labels[i], g.labelY - LABEL_R);
    ctx.stroke();
  });
  g.nodes.forEach((nx, i) => {
    ctx.fillStyle = lamp(1);
    ctx.beginPath();
    ctx.arc(nx, g.baseY, i === focus ? 3.6 : 2.4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.font = `600 10px 'Instrument Sans', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  g.labels.forEach((lx, i) => {
    const on = i === focus;
    if (on) {
      ctx.fillStyle = lamp(0.28);
      ctx.beginPath();
      ctx.arc(lx, g.labelY, LABEL_R + 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(lx, g.labelY, LABEL_R, 0, Math.PI * 2);
    ctx.fillStyle = on ? lamp(1) : 'rgba(7, 10, 22, 0.92)';
    ctx.fill();
    ctx.strokeStyle = lamp(on ? 1 : 0.85);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = on ? SKY.top : ARC.lamp;
    ctx.fillText(String(i + 1), lx, g.labelY + 0.5);
  });
}
