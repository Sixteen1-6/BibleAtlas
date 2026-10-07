// Book-to-book wheel: all 66 books around a circle (arc length = number of
// verses), with ribbons sized by how many cross-references join each pair.

import { useMemo, useRef, useState, useEffect } from 'preact/hooks';
import type { Atlas } from '../data/atlas';
import * as S from '../state';
import { ARC, GENRE } from './colors';

const GAP = 0.006;
const TOP_PAIRS = 420;

interface Seg {
  a0: number;
  a1: number;
}

export function Wheel({ a }: { a: Atlas }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(300);
  const [hot, setHot] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(Math.max(200, Math.min(el.clientWidth, el.clientHeight))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const B = a.books.length;
  const layout = useMemo(() => {
    const total = a.n;
    const usable = Math.PI * 2 * (1 - GAP * B);
    const books: Seg[] = [];
    let ang = -Math.PI / 2;
    for (let i = 0; i < B; i++) {
      const verses = (i + 1 < B ? a.books[i + 1].start : a.n) - a.books[i].start;
      const span = (usable * verses) / total;
      books.push({ a0: ang, a1: ang + span });
      ang += span + Math.PI * 2 * GAP;
    }
    // Symmetric flows between distinct books.
    const pairs: { i: number; j: number; n: number }[] = [];
    for (let i = 0; i < B; i++)
      for (let j = i + 1; j < B; j++) {
        const n = a.bookFlow[i * B + j] + a.bookFlow[j * B + i];
        if (n) pairs.push({ i, j, n });
      }
    pairs.sort((x, y) => y.n - x.n);
    const top = pairs.slice(0, TOP_PAIRS);
    // Each book's arc is shared among its ribbons, in order around the circle.
    const perBook: { k: number; other: number }[][] = Array.from({ length: B }, () => []);
    top.forEach((p, k) => {
      perBook[p.i].push({ k, other: p.j });
      perBook[p.j].push({ k, other: p.i });
    });
    const ends = new Map<string, Seg>();
    for (let i = 0; i < B; i++) {
      const list = perBook[i].sort((x, y) => ((x.other - i + B) % B) - ((y.other - i + B) % B));
      const sum = list.reduce((s, x) => s + top[x.k].n, 0);
      let at = books[i].a0;
      for (const x of list) {
        const span = ((books[i].a1 - books[i].a0) * top[x.k].n) / sum;
        ends.set(`${x.k}:${i}`, { a0: at, a1: at + span });
        at += span;
      }
    }
    const max = top[0]?.n ?? 1;
    return { books, top, ends, max };
  }, [a]);

  const r = size / 2 - 58;
  const c = size / 2;
  const pt = (ang: number, rad = r) => `${(c + Math.cos(ang) * rad).toFixed(1)},${(c + Math.sin(ang) * rad).toFixed(1)}`;
  const ntStart = a.books.findIndex((b) => b.testament === 'NT');

  const ribbons = layout.top.map((p, k) => {
    const s = layout.ends.get(`${k}:${p.i}`)!;
    const t = layout.ends.get(`${k}:${p.j}`)!;
    const d = `M${pt(s.a0)} A${r},${r} 0 0 1 ${pt(s.a1)} Q${c},${c} ${pt(t.a0)} A${r},${r} 0 0 1 ${pt(t.a1)} Q${c},${c} ${pt(s.a0)}Z`;
    const cross = p.i < ntStart !== p.j < ntStart;
    const lit = hot === null || hot === p.i || hot === p.j;
    const color = cross ? ARC.testaments : GENRE[a.books[p.i].genre].color;
    return <path key={k} class="ribbon" d={d} fill={color} opacity={lit ? 0.18 + 0.6 * (p.n / layout.max) : 0.03} />;
  });

  const labels = layout.books.map((s, i) => {
    const mid = (s.a0 + s.a1) / 2;
    const deg = (mid * 180) / Math.PI;
    const flip = deg > 90 && deg < 270;
    const name = s.a1 - s.a0 > 0.035 ? a.books[i].name : a.books[i].osis;
    return (
      <g key={i} onPointerEnter={() => setHot(i)} onPointerLeave={() => setHot(null)} onClick={() => (S.reading.value = { book: i, chapter: 1 })} style="cursor:pointer">
        <path d={`M${pt(s.a0, r + 2)} A${r + 2},${r + 2} 0 0 1 ${pt(s.a1, r + 2)} L${pt(s.a1, r + 9)} A${r + 9},${r + 9} 0 0 0 ${pt(s.a0, r + 9)}Z`} fill={GENRE[a.books[i].genre].color} opacity={hot === null || hot === i ? 1 : 0.4} />
        <text class={`booklabel${hot === i ? ' on' : ''}`} transform={`translate(${pt(mid, r + 14)}) rotate(${flip ? deg + 180 : deg})`} text-anchor={flip ? 'end' : 'start'} dominant-baseline="middle" style="font-size:10px">
          {name}
        </text>
      </g>
    );
  });

  let caption = 'Hover a book to see its strongest connections. Tap to open it.';
  if (hot !== null) {
    const partners = layout.top.filter((p) => p.i === hot || p.j === hot).slice(0, 3);
    caption = `${a.books[hot].name}: most linked with ${partners.map((p) => `${a.books[p.i === hot ? p.j : p.i].name} (${p.n.toLocaleString()})`).join(', ')}`;
  }

  return (
    <div class="wheel" ref={box}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Wheel of the 66 books with ribbons sized by cross-references between them">
        <g>{ribbons}</g>
        <g>{labels}</g>
      </svg>
      <div class="hud" style="left:12px;top:10px;position:absolute;max-width:46%">
        <span>{caption}</span>
      </div>
    </div>
  );
}
