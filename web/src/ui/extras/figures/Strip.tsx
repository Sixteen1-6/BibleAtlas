// A small night sky in the map's own language, with the pairs of a note drawn
// as arcs over the words (or verses) they join: arcs side by side for lines
// said again, a broken arc for lines set opposite, arcs inside arcs for a
// mirror, crossing arcs for lines that take turns, steps for lines that build,
// and a dashed arc between two people. The night is the same in both page
// themes, as on the map.

import { useEffect, useRef, useState } from 'preact/hooks';
import { BASELINE, arcHeight } from '../../../gl/layout';
import { ARC, SKY } from '../../colors';

export type ArcStyle = 'solid' | 'broken' | 'dashed';

export interface Tick {
  /** Words under the tick. */
  label: string;
  /** A, A' and so on, after the label. */
  letter?: string;
  /** The verse the panel opened from. */
  here?: boolean;
}

export interface StripArc {
  from: number;
  to: number;
  style: ArcStyle;
  /** Which pair it is, for lighting it with its words. */
  pair: number;
}

export interface Span {
  /** From and to, as tick positions (may be fractional). */
  from: number;
  to: number;
  label: string;
}

const H = 112;
const PAD = 22;

function useWidth(ref: { current: HTMLElement | null }): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return w;
}

/** A point at fraction t along an arc path, as arcPath draws it. */
function along(x0: number, x1: number, h: number, t: number): [number, number] {
  return [x0 + (x1 - x0) * t, H * BASELINE - h * Math.sin(Math.PI * t)];
}

/** The ticks spread over the strip; arcs between them; for lines that build,
 * `stair` draws rising steps instead; `spans` draws bars under the baseline
 * (two people's verses). `lit` is the pair being pointed at. */
export function Strip({ ticks, arcs, stair, spans, centre, label, lit, onLight }: { ticks: Tick[]; arcs: StripArc[]; stair?: boolean; spans?: Span[]; centre?: number; label: string; lit: number | null; onLight: (pair: number | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const w = useWidth(box);
  const iw = Math.max(1, w - 2 * PAD);
  const n = ticks.length;
  const x = (i: number) => PAD + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const base = H * BASELINE;
  const below = spans?.length ? spans.length * 26 + 2 : 0;
  // Steps that fit under the top of the strip, however many lines build.
  const step = Math.min(16, (base - 22) / Math.max(1, n - 1));
  // Words under the ticks in one row, in two staggered rows, or letters only.
  const room = n <= 1 ? iw : iw / (n - 1);
  const need = Math.max(0, ...ticks.map((t) => t.label.length * 6.6 + (t.letter ? 14 : 0)));
  const fit = need <= room - 6 ? 'one' : need <= 2 * room - 8 ? 'two' : 'letters';
  return (
    <div class="x-figures-sky" ref={box} style={`background:linear-gradient(180deg, ${SKY.top}, ${SKY.horizon} 64%, ${SKY.glow} ${(BASELINE * 100).toFixed(0)}%, ${SKY.top})`}>
      {w > 0 && (
        <svg width={w} height={H + 46 + below} viewBox={`0 0 ${w} ${H + 46 + below}`} role="img" aria-label={label}>
          <path class="x-figures-base" d={`M${PAD - 8},${base.toFixed(1)}H${w - PAD + 8}`} />
          {spans?.map((s, i) => {
            const y = base + 10 + i * 26;
            const x0 = x(s.from);
            const x1 = Math.max(x(s.to), x0 + 3);
            // The name under its bar, from where the bar starts, kept inside the strip.
            const lx = Math.max(4, Math.min(x0, w - 4 - s.label.length * 6.6));
            return (
              <g key={`s${i}`}>
                <path class="x-figures-span" d={`M${x0.toFixed(1)},${y}H${x1.toFixed(1)}`} />
                <text class="x-figures-label" x={lx} y={y + 15}>
                  {s.label}
                </text>
              </g>
            );
          })}
          {stair &&
            ticks.slice(1).map((_, i) => {
              const x0 = x(i);
              const x1 = x(i + 1);
              const y0 = base - 14 - i * step;
              const y1 = base - 14 - (i + 1) * step;
              return <path key={`st${i}`} class={`x-figures-arc${lit === null || lit === i ? '' : ' dim'}`} d={`M${x0.toFixed(1)},${(i === 0 ? base : y0).toFixed(1)}V${y0.toFixed(1)}H${x1.toFixed(1)}V${y1.toFixed(1)}`} />;
            })}
          {arcs.map((a, i) => {
            const x0 = x(a.from);
            const x1 = x(a.to);
            const h = Math.max(14, 0.8 * arcHeight(x0, x1, H, iw));
            const on = lit === a.pair;
            const cls = `x-figures-arc ${a.style}${on ? ' lit' : lit !== null ? ' dim' : ''}`;
            if (a.style === 'broken') {
              // Two halves with a gap at the top: the second line turns the first.
              const half = (t0: number, t1: number) => {
                let d = '';
                for (let k = 0; k <= 20; k++) {
                  const [px, py] = along(x0, x1, h, t0 + ((t1 - t0) * k) / 20);
                  d += `${k ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
                }
                return d;
              };
              return (
                <g key={i} class={cls} onPointerEnter={() => onLight(a.pair)} onPointerLeave={() => onLight(null)}>
                  <path d={half(0, 0.42)} />
                  <path d={half(0.58, 1)} />
                </g>
              );
            }
            return <path key={i} class={cls} d={arcPathMin(x0, x1, h)} onPointerEnter={() => onLight(a.pair)} onPointerLeave={() => onLight(null)} />;
          })}
          {centre !== undefined && (
            <g class="x-figures-turn">
              <path d={`M${x(centre).toFixed(1)},${(base - 4).toFixed(1)}v-10`} />
              <text x={x(centre)} y={base + 22 + below} text-anchor="middle">
                turn
              </text>
            </g>
          )}
          {ticks.map((t, i) => {
            const fits = fit === 'one' || fit === 'two';
            const y = base + 22 + below + (fit === 'two' && i % 2 ? 15 : 0);
            return (
            <g key={`t${i}`}>
              {t.here && <circle cx={x(i)} cy={base} r={7} class="x-figures-here" />}
              <circle cx={x(i)} cy={base} r={t.here ? 3.6 : 2.8} fill={t.here ? ARC.lamp : undefined} class={t.here ? '' : 'x-figures-dot'} />
              <text class="x-figures-label" x={x(i)} y={y} text-anchor={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'} dx={n > 1 && i === 0 ? -6 : n > 1 && i === n - 1 ? 6 : 0}>
                {fits || !t.letter ? t.label : ''}
                {t.letter && <tspan class="x-figures-letter" dy={fits ? -4 : 0}>{fits ? ` ${t.letter}` : t.letter}</tspan>}
              </text>
            </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** The map's arc between two points, at least h high, so close pairs still show. */
function arcPathMin(x0: number, x1: number, h: number): string {
  let d = '';
  for (let k = 0; k <= 32; k++) {
    const [px, py] = along(x0, x1, h, k / 32);
    d += `${k ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
  }
  return d;
}
