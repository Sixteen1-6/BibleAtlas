// The arc map: WebGL field + SVG overlay + influence strip, with pan, zoom,
// hover and selection.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { type Atlas, label, shortName } from '../data/atlas';
import { getVerse, isBookLoaded } from '../data/text';
import { ArcField, edgeInstances } from '../gl/arcs';
import { BASELINE, BOOK_GAP, arcHeight, arcPath, clampView, toScreen, verseAt, verseX, type View } from '../gl/layout';
import * as S from '../state';
import { ARC, type ArcColorMode, GENRE, SPECTRUM_CSS } from './colors';

/** Edges touching a verse (outgoing and incoming), strongest first. */
export function verseEdges(a: Atlas, v: number, limit = 600): Uint32Array {
  const list: number[] = [];
  for (let e = a.xOff[v]; e < a.xOff[v + 1]; e++) list.push(e);
  for (let i = a.xInOff[v]; i < a.xInOff[v + 1]; i++) list.push(a.xInEdge[i]);
  list.sort((x, y) => a.xVotes[y] - a.xVotes[x]);
  return Uint32Array.from(list.slice(0, limit));
}

function useSize(ref: { current: HTMLElement | null }): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return size;
}

const COLOR_MODES: [ArcColorMode, string][] = [
  ['spectrum', 'Spectrum'],
  ['reach', 'Reach'],
  ['genre', 'Genre'],
];

function Legend({ a, mode }: { a: Atlas; mode: ArcColorMode }) {
  if (mode === 'spectrum') {
    return (
      <span class="legend">
        <span>Genesis</span>
        <i class="wide" style={`background:${SPECTRUM_CSS}`} />
        <span>Revelation</span>
      </span>
    );
  }
  if (mode === 'reach') {
    return (
      <span class="legend">
        <span><i style={`background:${ARC.sameBook}`} />same book</span>
        <span><i style={`background:linear-gradient(90deg, ${ARC.near}, ${ARC.far})`} />near to far</span>
        <span><i style={`background:${ARC.testaments}`} />Old ↔ New Testament</span>
      </span>
    );
  }
  const used = Object.keys(GENRE).filter((g) => a.books.some((b) => b.genre === g));
  return (
    <span class="legend">
      {used.map((g) => (
        <span key={g}><i class="dot" style={`background:${GENRE[g].color}`} />{GENRE[g].label}</span>
      ))}
    </span>
  );
}

export function AtlasMap({ a }: { a: Atlas }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const strip = useRef<HTMLCanvasElement>(null);
  const field = useRef<ArcField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { w, h } = useSize(wrap);
  const xs = useMemo(() => verseX(a), [a]);
  const view = S.view.value;
  const [tip, setTip] = useState<{ v: number; x: number; y: number; text?: string } | null>(null);

  // --- WebGL setup -------------------------------------------------------
  useEffect(() => {
    if (!canvas.current) return;
    try {
      const f = new ArcField(canvas.current, edgeInstances(a, xs));
      f.setOptions({ minVotes: S.minVotes.value, colorMode: S.arcColor.value });
      f.resize();
      f.setView(S.view.value);
      field.current = f;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [a, xs]);

  useEffect(() => {
    field.current?.resize();
    field.current?.request(true);
  }, [w, h]);

  useSignalEffect(() => {
    field.current?.setView(S.view.value);
  });
  useSignalEffect(() => {
    field.current?.setOptions({ minVotes: S.minVotes.value, colorMode: S.arcColor.value });
  });

  // --- Focus: what is drawn bright --------------------------------------------
  useSignalEffect(() => {
    const f = field.current;
    if (!f) return;
    const hv = S.hovered.value;
    const p = S.path.value;
    const sel = S.selected.value;
    const group = S.groupEdges.value;
    let edges: Uint32Array | null = null;
    if (hv !== null) edges = verseEdges(a, hv);
    else if (p) edges = Uint32Array.from(p.edges);
    else if (sel !== null) edges = verseEdges(a, sel);
    else if (group) edges = group.edges;
    f.setFocus(edges && edges.length ? edgeInstances(a, xs, edges) : null);
    f.setDim(edges ? (edges.length > 2000 ? 0.55 : 0.4) : 1);
  });

  // --- Influence strip: how central each stretch of verses is ------------------
  useEffect(() => {
    const c = strip.current;
    if (!c || !w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(w * dpr);
    c.height = Math.round(8 * dpr);
    const ctx = c.getContext('2d')!;
    const cols = new Float32Array(c.width);
    for (let v = 0; v < a.n; v++) {
      const x = Math.floor(toScreen(xs[v], view, w) * dpr);
      if (x >= 0 && x < cols.length && a.rank[v] > cols[x]) cols[x] = a.rank[v];
    }
    ctx.clearRect(0, 0, c.width, c.height);
    for (let x = 0; x < cols.length; x++) {
      if (!cols[x]) continue;
      ctx.fillStyle = `rgba(255, 210, 122, ${Math.min(0.9, Math.pow(cols[x], 0.6)).toFixed(3)})`;
      ctx.fillRect(x, 0, 1, c.height);
    }
  }, [a, xs, view, w]);

  // --- Interaction -------------------------------------------------------
  interface Drag {
    x: number;
    view: View;
    moved: boolean;
    pointers: Map<number, number>;
    pinch?: { d: number; view: View; mid: number };
  }
  const drag = useRef<Drag | null>(null);

  const setView = (v: View) => {
    S.view.value = clampView(v);
  };

  const zoomAround = (px: number, factor: number, from: View = S.view.value) => {
    const xn = from.offset + px / (from.scale * w);
    const scale = Math.min(Math.max(from.scale * factor, 1), 4000);
    setView({ scale, offset: xn - px / (scale * w) });
  };

  const localX = (e: PointerEvent | WheelEvent) => e.clientX - wrap.current!.getBoundingClientRect().left;

  const onPointerDown = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const d: Drag = drag.current ?? { x: localX(e), view: S.view.value, moved: false, pointers: new Map() };
    d.pointers.set(e.pointerId, localX(e));
    if (d.pointers.size === 2) {
      const [p1, p2] = [...d.pointers.values()];
      d.pinch = { d: Math.abs(p1 - p2), view: S.view.value, mid: (p1 + p2) / 2 };
    }
    drag.current = d;
  };

  const hoverTimer = useRef(0);
  const onPointerMove = (e: PointerEvent) => {
    const x = localX(e);
    const d = drag.current;
    if (d) {
      d.pointers.set(e.pointerId, x);
      if (d.pinch && d.pointers.size === 2) {
        const [p1, p2] = [...d.pointers.values()];
        const dist = Math.max(10, Math.abs(p1 - p2));
        zoomAround(d.pinch.mid, dist / Math.max(10, d.pinch.d), d.pinch.view);
        d.moved = true;
        return;
      }
      if (Math.abs(x - d.x) > 4) d.moved = true;
      if (d.moved) {
        setView({ scale: d.view.scale, offset: d.view.offset - (x - d.x) / (d.view.scale * w) });
        S.hovered.value = null;
        setTip(null);
        return;
      }
    }
    if (e.pointerType === 'touch') return;
    const v = verseAt(xs, x, S.view.value, w);
    if (S.hovered.value !== v) {
      S.hovered.value = v;
      const y = e.clientY - wrap.current!.getBoundingClientRect().top;
      setTip({ v, x, y });
      window.clearTimeout(hoverTimer.current);
      const book = a.verseBook[v];
      const show = () => getVerse(a, v).then((row) => setTip((t) => (t && t.v === v ? { ...t, text: row[0] } : t)));
      if (isBookLoaded(book)) show();
      else hoverTimer.current = window.setTimeout(show, 300);
    } else {
      const y = e.clientY - wrap.current!.getBoundingClientRect().top;
      setTip((t) => (t ? { ...t, x, y } : t));
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.pointers.delete(e.pointerId);
    if (d.pointers.size === 0) {
      if (!d.moved) {
        const v = verseAt(xs, localX(e), S.view.value, w);
        S.selectVerse(v);
        S.mobilePane.value = 'study';
      }
      drag.current = null;
    }
  };

  const onLeave = () => {
    S.hovered.value = null;
    setTip(null);
    window.clearTimeout(hoverTimer.current);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    if (Math.abs(e.deltaX) > Math.abs(dy)) {
      const v = S.view.value;
      setView({ scale: v.scale, offset: v.offset + e.deltaX / (v.scale * w) });
    } else zoomAround(localX(e), Math.exp(-dy * 0.0015));
  };

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const onKey = (e: KeyboardEvent) => {
    const sel = S.selected.value;
    if (e.key === 'ArrowRight' && sel !== null) S.selectVerse(Math.min(a.n - 1, sel + 1));
    else if (e.key === 'ArrowLeft' && sel !== null) S.selectVerse(Math.max(0, sel - 1));
    else if (e.key === '+' || e.key === '=') zoomAround(w / 2, 1.5);
    else if (e.key === '-') zoomAround(w / 2, 1 / 1.5);
    else if (e.key === '0') setView({ scale: 1, offset: 0 });
    else return;
    e.preventDefault();
  };

  // --- Overlay ------------------------------------------------------------
  const base = h * BASELINE;
  const sx = (v: number) => toScreen(xs[v], view, w);
  const verseW = (view.scale * w) / (a.n + BOOK_GAP * (a.books.length - 1));

  const bookBands = a.books.map((b, i) => {
    const end = i + 1 < a.books.length ? a.books[i + 1].start - 1 : a.n - 1;
    const x0 = sx(b.start) - verseW / 2;
    const x1 = sx(end) + verseW / 2;
    if (x1 < 0 || x0 > w) return null;
    const width = x1 - x0;
    const sel = S.selected.value;
    const on = sel !== null && a.verseBook[sel] === i;
    const name = width > 90 ? b.name : width > 26 ? shortName(b) : '';
    const cx = Math.min(Math.max((Math.max(x0, 0) + Math.min(x1, w)) / 2, 14), w - 14);
    const chapters: preact.JSX.Element[] = [];
    const cw = width / b.chapters.length;
    if (cw > 7) {
      let v = b.start;
      b.chapters.forEach((n, ci) => {
        const x = sx(v) - verseW / 2;
        if (x > -20 && x < w + 20) {
          chapters.push(<line key={`t${ci}`} x1={x} x2={x} y1={base + 2} y2={base + (cw > 22 ? 9 : 6)} stroke="rgba(241,236,223,0.3)" />);
          if (cw > 22 && (cw > 40 || (ci + 1) % 5 === 0 || ci === 0)) {
            chapters.push(
              <text key={`n${ci}`} class="chaplabel" x={x + 3} y={base + 18}>
                {ci + 1}
              </text>,
            );
          }
        }
        v += n;
      });
    }
    return (
      <g key={b.osis}>
        <rect x={x0} y={base + 1} width={Math.max(1, width)} height={3} fill={GENRE[b.genre].color} opacity={on ? 1 : 0.75} rx={1} />
        {chapters}
        {name && (
          <text class={`booklabel${on ? ' on' : ''}`} x={cx} y={base + (cw > 22 ? 34 : 22)} text-anchor="middle">
            {name}
          </text>
        )}
      </g>
    );
  });

  // Selected verse and its strongest neighbors.
  const selV = S.selected.value;
  const p = S.path.value;
  let selection: preact.JSX.Element | null = null;
  if (selV !== null && !p) {
    const x = sx(selV);
    const top = verseEdges(a, selV, 14);
    const placed: number[] = [x];
    const labels = Array.from(top)
      .map((e) => (a.xSrc[e] === selV ? a.xDst[e] : a.xSrc[e]))
      .filter((u, i, arr) => arr.indexOf(u) === i)
      .map((u) => {
        const ux = sx(u);
        if (ux < 0 || ux > w || placed.some((px) => Math.abs(px - ux) < 64)) return null;
        placed.push(ux);
        return (
          <g key={u}>
            <circle cx={ux} cy={base} r={2.5} fill={ARC.lamp} />
            <text class="nodelabel" x={ux} y={base - 8} text-anchor="middle" style="font-weight:500;font-size:10.5px">
              {label(a, u, true)}
            </text>
          </g>
        );
      });
    selection = (
      <g>
        <line x1={x} x2={x} y1={base} y2={base + 40} stroke="rgba(255,210,122,0.5)" stroke-dasharray="2 3" />
        <circle cx={x} cy={base} r={4} fill={ARC.lamp} />
        <text class="nodelabel" x={Math.min(Math.max(x, 50), w - 50)} y={base + 52} text-anchor="middle" style="fill:var(--lamp)">
          {label(a, selV)}
        </text>
        {labels}
      </g>
    );
  }

  // Connection path, drawn as animated arcs.
  let pathLayer: preact.JSX.Element | null = null;
  if (p) {
    const pts = p.verses.map(sx);
    pathLayer = (
      <g>
        {pts.slice(1).map((x1, i) => {
          const x0 = pts[i];
          const len = Math.PI * (Math.abs(x1 - x0) / 2 + arcHeight(x0, x1, h, w)) / 2 + 10;
          return <path key={`${p.verses[i]}-${p.verses[i + 1]}`} class="patharc" d={arcPath(x0, x1, h, w)} style={`--len:${len.toFixed(0)};animation-delay:${i * 0.5}s`} />;
        })}
        {p.verses.map((v, i) => (
          <g key={v}>
            <circle cx={pts[i]} cy={base} r={4.5} fill={ARC.lamp} />
            <text class="nodelabel" x={Math.min(Math.max(pts[i], 44), w - 44)} y={base + 48 + (i % 2) * 14} text-anchor="middle">
              {label(a, v, true)}
            </text>
          </g>
        ))}
      </g>
    );
  }

  // Ticks for theme, word or search hits.
  const m = S.marks.value;
  let marksLayer: preact.JSX.Element | null = null;
  if (m) {
    let d = '';
    let last = -10;
    for (const v of m.verses) {
      const x = sx(v);
      if (x < 0 || x > w || x - last < 0.8) continue;
      last = x;
      d += `M${x.toFixed(1)},${base - 1}v-9`;
    }
    marksLayer = <path d={d} stroke={ARC.lamp} stroke-width={1} opacity={0.9} />;
  }

  const hv = S.hovered.value;
  const hoverLine = hv !== null ? <line x1={sx(hv)} x2={sx(hv)} y1={base - 14} y2={base + 6} stroke={ARC.lamp} stroke-width={1.5} /> : null;

  const n = S.visibleEdges.value;
  const group = S.groupEdges.value;

  return (
    <div class="map" ref={wrap} tabIndex={0} aria-label="Cross-reference map. Arrow keys move the selection, plus and minus zoom, 0 resets." onKeyDown={onKey}>
      <canvas class="arcs" ref={canvas} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={onLeave} onDblClick={() => setView({ scale: 1, offset: 0 })} />
      <svg class="overlay" width={w} height={h} aria-hidden="true">
        {bookBands}
        {marksLayer}
        {selection}
        {pathLayer}
        {hoverLine}
      </svg>
      <canvas class="strip" ref={strip} style={`top:${h - 10}px`} aria-hidden="true" />
      <div class="hud">
        <span>
          <strong>{n.toLocaleString()}</strong> of {a.xDst.length.toLocaleString()} cross-references
          {group ? ` · ${group.label}` : ''}
        </span>
        <label class="votes">
          <span>Min. votes</span>
          <input type="range" min={1} max={100} value={S.minVotes.value} onInput={(e) => (S.minVotes.value = Number((e.target as HTMLInputElement).value))} aria-label="Minimum community votes for a cross-reference to be drawn" />
          <strong>{S.minVotes.value}</strong>
        </label>
        <div class="seg mini" role="group" aria-label="Arc colors">
          {COLOR_MODES.map(([m, name]) => (
            <button key={m} aria-pressed={S.arcColor.value === m} onClick={() => (S.arcColor.value = m)}>
              {name}
            </button>
          ))}
        </div>
        <Legend a={a} mode={S.arcColor.value} />
      </div>
      <div class="zoomhint">
        {view.scale > 1.01 ? `${view.scale.toFixed(view.scale < 10 ? 1 : 0)}×` : 'Scroll or pinch to zoom'}
        {view.scale > 1.01 && <button onClick={() => setView({ scale: 1, offset: 0 })}>Reset</button>}
      </div>
      {tip && (
        <div class="tip" style={`left:${Math.min(tip.x + 14, w - 350)}px;top:${Math.min(tip.y + 14, h - 110)}px`}>
          <b>
            {label(a, tip.v)} · {(a.xOff[tip.v + 1] - a.xOff[tip.v] + a.xInOff[tip.v + 1] - a.xInOff[tip.v]).toLocaleString()} links
          </b>
          {tip.text && <p>{tip.text.length > 160 ? tip.text.slice(0, 157) + '…' : tip.text}</p>}
        </div>
      )}
      {error && (
        <div class="tip" style="left:12px;top:44px">
          <b>The map could not start</b>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

