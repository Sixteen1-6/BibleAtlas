// Book-to-book wheel: all 66 books around a circle (arc length = number of
// verses), with ribbons sized by how many cross-references join each pair.
//
// It answers one question: what do these two books say to each other? Tap a
// ribbon for the verse pairs that join two books, or a book for its key verses
// and closest partners. The selected verse's book glows, and its own links are
// drawn as gold chords.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Atlas, label, shortName } from '../data/atlas';
import * as S from '../state';
import { ARC, GENRE, GENRE_IDS } from './colors';
import { BookCard, PairCard, TAP, bookEnd, bookFacts, pairTotal } from './WheelCards';
import './wheel.css';

const GAP = 0.006;
const TOP_PAIRS = 420;
/** The selected verse's strongest links drawn as chords, as on the arc map. */
const MAX_CHORDS = 60;
/** At or below this width the card docks under the wheel instead of beside it. */
const PHONE = 700;
/** Book-label font size, in px. */
const FONT = 10;
/** Labels sit this far out from the ribbons' rim. */
const LABEL_OUT = 14;
/** How far a label may slide past its book's edge to make room (radians). */
const LABEL_TOL = 0.3 * Math.PI * 2 * GAP;
const ENTER_KEY = 'atlas.wheelEntrance';
const TAU = Math.PI * 2;

const fmt = (n: number) => n.toLocaleString('en-US');

// ------------------------------------------------------------------ geometry

interface Seg {
  a0: number;
  a1: number;
}
interface Pair {
  i: number;
  j: number;
  n: number;
}
interface Geo {
  books: Seg[];
  /** The strongest book pairs, strongest first: one ribbon each. */
  top: Pair[];
  /** Each ribbon's two ends: on book i, then on book j. */
  ends: [Seg, Seg][];
  max: number;
  /** Ribbons touching each book. */
  byBook: number[][];
  /** Ribbon index by book pair (i * B + j, i < j). */
  index: Map<number, number>;
  /** Books from longest to shortest: who keeps a label when space runs out. */
  byLength: number[];
}

function geometry(a: Atlas): Geo {
  const B = a.books.length;
  const usable = TAU * (1 - GAP * B);
  const books: Seg[] = [];
  let ang = -Math.PI / 2;
  for (let i = 0; i < B; i++) {
    const span = (usable * (bookEnd(a, i) - a.books[i].start)) / a.n;
    books.push({ a0: ang, a1: ang + span });
    ang += span + TAU * GAP;
  }
  // Symmetric flows between distinct books.
  const pairs: Pair[] = [];
  for (let i = 0; i < B; i++)
    for (let j = i + 1; j < B; j++) {
      const n = pairTotal(a, i, j);
      if (n) pairs.push({ i, j, n });
    }
  pairs.sort((x, y) => y.n - x.n || x.i - y.i || x.j - y.j);
  const top = pairs.slice(0, TOP_PAIRS);
  // Each book's arc is shared among its ribbons, in order around the circle.
  const perBook: { k: number; other: number }[][] = Array.from({ length: B }, () => []);
  top.forEach((p, k) => {
    perBook[p.i].push({ k, other: p.j });
    perBook[p.j].push({ k, other: p.i });
  });
  const ends: [Seg, Seg][] = top.map(() => [
    { a0: 0, a1: 0 },
    { a0: 0, a1: 0 },
  ]);
  for (let i = 0; i < B; i++) {
    const list = perBook[i].sort((x, y) => ((x.other - i + B) % B) - ((y.other - i + B) % B));
    const sum = list.reduce((s, x) => s + top[x.k].n, 0);
    let at = books[i].a0;
    for (const x of list) {
      const span = ((books[i].a1 - books[i].a0) * top[x.k].n) / sum;
      ends[x.k][top[x.k].i === i ? 0 : 1] = { a0: at, a1: at + span };
      at += span;
    }
  }
  const index = new Map<number, number>();
  top.forEach((p, k) => index.set(p.i * B + p.j, k));
  const byLength = [...Array(B).keys()].sort((x, y) => bookEnd(a, y) - a.books[y].start - (bookEnd(a, x) - a.books[x].start) || x - y);
  return { books, top, ends, max: top[0]?.n ?? 1, byBook: perBook.map((l) => l.map((x) => x.k)), index, byLength };
}

/** Where a verse sits on the circle. */
function verseAngle(a: Atlas, geo: Geo, v: number): number {
  const b = a.verseBook[v];
  const s = geo.books[b];
  const start = a.books[b].start;
  return s.a0 + ((v - start + 0.5) / (bookEnd(a, b) - start)) * (s.a1 - s.a0);
}

/** A chord between two angles on the rim: through the middle when far apart, hugging the rim when close. */
function chord(c: number, r: number, p: number, q: number): string {
  let d = (q - p) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  const k = 0.82 * (1 - Math.abs(d) / Math.PI) ** 2;
  const m = p + d / 2;
  const at = (ang: number) => `${(c + Math.cos(ang) * r).toFixed(1)},${(c + Math.sin(ang) * r).toFixed(1)}`;
  return `M${at(p)} Q${(c + Math.cos(m) * r * k).toFixed(1)},${(c + Math.sin(m) * r * k).toFixed(1)} ${at(q)}`;
}

/** A verse's strongest positively voted links (both directions, one per verse), as AtlasMap picks them. */
function verseLinks(a: Atlas, v: number, limit = MAX_CHORDS): { u: number; votes: number }[] {
  const list: { u: number; votes: number }[] = [];
  for (let e = a.xOff[v]; e < a.xOff[v + 1]; e++) if (a.xVotes[e] > 0) list.push({ u: a.xDst[e], votes: a.xVotes[e] });
  for (let i = a.xInOff[v]; i < a.xInOff[v + 1]; i++) {
    const e = a.xInEdge[i];
    if (a.xVotes[e] > 0) list.push({ u: a.xSrc[e], votes: a.xVotes[e] });
  }
  list.sort((x, y) => y.votes - x.votes || x.u - y.u);
  const seen = new Set<number>();
  const out: { u: number; votes: number }[] = [];
  for (const l of list) {
    if (l.u === v || seen.has(l.u)) continue;
    seen.add(l.u);
    out.push(l);
    if (out.length >= limit) break;
  }
  return out;
}

// ------------------------------------------------------------------ labels

let measureCtx: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();

function textWidth(s: string): number {
  let w = widths.get(s);
  if (w === undefined) {
    if (measureCtx === undefined) {
      try {
        measureCtx = document.createElement('canvas').getContext('2d');
      } catch {
        measureCtx = null;
      }
    }
    if (measureCtx) {
      measureCtx.font = `400 ${FONT}px "Instrument Sans", system-ui, sans-serif`;
      w = measureCtx.measureText(s).width;
    } else {
      w = s.length * FONT * 0.58;
    }
    widths.set(s, w);
  }
  return w;
}

/**
 * Label angles, keeping neighbors at least `gap` apart so no two labels touch.
 * Labels sweep clockwise and may slide a little past their book's edge; any
 * label that cannot fit is left out. Books earlier in `order` win.
 */
function placeLabels(books: Seg[], order: number[], forced: Set<number>, gap: number): Map<number, number> {
  const sweep = (set: Set<number>) => {
    const ids = [...set].sort((x, y) => x - y);
    const pos = new Map<number, number>();
    let prev = -Infinity;
    for (const i of ids) {
      const s = books[i];
      const tol = forced.has(i) ? Math.max(LABEL_TOL, gap) : LABEL_TOL;
      const p = Math.max((s.a0 + s.a1) / 2, prev + gap);
      if (p > s.a1 + tol) return null;
      pos.set(i, p);
      prev = p;
    }
    if (ids.length > 1 && pos.get(ids[0])! + TAU - pos.get(ids[ids.length - 1])! < gap) return null;
    return pos;
  };
  const chosen = new Set<number>();
  let best = new Map<number, number>();
  for (const i of order) {
    if (chosen.has(i)) continue;
    chosen.add(i);
    const p = sweep(chosen);
    if (p) best = p;
    else chosen.delete(i);
  }
  return best;
}

// ------------------------------------------------------------------ layout

interface Box {
  W: number;
  H: number;
  bottom: number;
}
interface Frame {
  phone: boolean;
  /** SVG square: side, top-left corner, and the slide that makes room for a card. */
  s: number;
  x: number;
  y: number;
  dx: number;
  /** Ribbon radius. */
  r: number;
  capH: number;
  cardW: number;
  /** Where labels may run, in root coordinates. */
  free: { x0: number; x1: number; y0: number; y1: number };
}

function frame({ W, H }: Box, card: boolean): Frame {
  const phone = W <= PHONE;
  if (phone) {
    const capH = 36;
    const s = Math.max(180, Math.min(W - 8, H - capH - 2));
    const margin = Math.min(60, Math.max(40, 0.15 * s));
    return { phone, s, x: (W - s) / 2, y: capH + Math.max(0, (H - capH - s) / 2), dx: 0, r: s / 2 - margin, capH, cardW: W, free: { x0: 2, x1: W - 2, y0: capH, y1: H - 2 } };
  }
  const s = Math.max(200, Math.min(W, H));
  const margin = Math.min(60, Math.max(40, 0.15 * s));
  const r = s / 2 - margin;
  const x = (W - s) / 2;
  const cardW = Math.round(Math.min(460, Math.max(300, (W - s) / 2 - 24)));
  let dx = 0;
  let x1 = W - 4;
  if (card) {
    // Slide the wheel left only as far as its right-hand labels need room beside the card.
    const left = W - 16 - cardW;
    dx = Math.max(Math.min(0, left - 12 - (x + s / 2 + r + LABEL_OUT + 64)), 4 - x);
    x1 = left - 8;
  }
  return { phone, s, x, y: (H - s) / 2, dx, r, capH: 0, cardW, free: { x0: 4, x1, y0: 4, y1: H - 4 } };
}

/** Distance from the wheel's center along angle `ang` to the edge of the free area. */
function reach(f: Frame, ang: number): number {
  const cx = f.x + f.dx + f.s / 2;
  const cy = f.y + f.s / 2;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  let t = Infinity;
  if (c > 1e-6) t = Math.min(t, (f.free.x1 - cx) / c);
  if (c < -1e-6) t = Math.min(t, (f.free.x0 - cx) / c);
  if (s > 1e-6) t = Math.min(t, (f.free.y1 - cy) / s);
  if (s < -1e-6) t = Math.min(t, (f.free.y0 - cy) / s);
  return t;
}

// ------------------------------------------------------------------ entrance

let enteredThisVisit = false;

/** The ribbons grow in once per session, never under reduced motion. */
function shouldEnter(): boolean {
  if (enteredThisVisit) return false;
  enteredThisVisit = true;
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    if (sessionStorage.getItem(ENTER_KEY)) return false;
    sessionStorage.setItem(ENTER_KEY, '1');
  } catch {
    // Storage blocked: the flag above still keeps it to once per visit.
  }
  return true;
}

/** Focus that came from the keyboard (or a script after keyboard use), not from a click or tap. */
function keyboardFocus(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

// ------------------------------------------------------------------ component

type Hot = { kind: 'rib'; k: number } | { kind: 'book'; i: number } | null;
type Card = { kind: 'pair'; i: number; j: number } | { kind: 'book'; i: number } | null;
type Preview = { a: number; b?: number } | null;

const CARD_TITLE = 'wh-card-title';

export function Wheel({ a }: { a: Atlas }) {
  const root = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [hot, setHot] = useState<Hot>(null);
  const [card, setCard] = useState<Card>(null);
  const [preview, setPreview] = useState<Preview>(null);
  const [focusK, setFocusK] = useState(0);
  const [focusBook, setFocusBook] = useState<number | null>(null);
  const [entering, setEntering] = useState(false);
  const [fontsV, setFontsV] = useState(0);
  const enterChecked = useRef(false);
  /** The ribbon or book that opened the card from the keyboard, to return focus to. */
  const opener = useRef<Element | null>(null);
  /** Move focus into the card after the next render (keyboard opening). */
  const focusCard = useRef(false);
  /** When a touch last opened a card on lifting the finger; the click that follows is ignored. */
  const touchOpened = useRef(0);
  /** The highlight came from keyboard focus, so losing focus clears it. */
  const focusLit = useRef(false);
  const sel = S.selected.value;

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const rc = el.getBoundingClientRect();
      setBox((b) => (b && b.W === rc.width && b.H === rc.height && b.bottom === rc.bottom ? b : { W: rc.width, H: rc.height, bottom: rc.bottom }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Label widths are measured with the UI font; measure again once it has loaded.
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => {
      if (!live) return;
      widths.clear();
      setFontsV((v) => v + 1);
    });
    return () => {
      live = false;
    };
  }, []);

  // The entrance: decided before the first paint, so the wheel never flashes in whole first.
  useLayoutEffect(() => {
    if (!box || enterChecked.current) return;
    enterChecked.current = true;
    if (shouldEnter()) setEntering(true);
  }, [box]);
  useEffect(() => {
    if (!entering) return;
    const t = setTimeout(() => setEntering(false), 1200);
    return () => clearTimeout(t);
  }, [entering]);

  // Esc closes the card first; a second Esc reaches the app and clears the selection.
  // Listening from mount (not from when a card opens) leaves no moment where Esc misses an open card.
  const cardNow = useRef<Card>(null);
  cardNow.current = card;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !cardNow.current || S.paletteOpen.peek()) return;
      e.stopPropagation();
      e.preventDefault();
      closeCard();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Keyboard openings move focus into the card; swapping cards keeps it there. Done right
  // after the card renders, so a fast next key press lands where the user expects.
  useLayoutEffect(() => {
    if (!card) return;
    const active = document.activeElement;
    if (focusCard.current || !active || active === document.body) root.current?.querySelector<HTMLElement>(`#${CARD_TITLE}`)?.focus();
    focusCard.current = false;
  }, [card]);

  const geo = useMemo(() => geometry(a), [a]);
  const B = a.books.length;
  const f = box ? frame(box, card !== null) : null;

  const openCard = (next: Card, from: Element | null, viaKeyboard: boolean) => {
    opener.current = viaKeyboard ? from : null;
    focusCard.current = viaKeyboard;
    setPreview(null);
    setCard(next);
  };
  // Uses only refs and state setters, so the Esc listener set up at mount can call it.
  const closeCard = () => {
    const back = opener.current;
    opener.current = null;
    setCard(null);
    setPreview(null);
    if (back && back.isConnected) (back as SVGElement).focus();
  };
  const openPair = (k: number, from: Element | null = null, viaKeyboard = false) => {
    const p = geo.top[k];
    if (p) openCard({ kind: 'pair', i: p.i, j: p.j }, from, viaKeyboard);
  };
  const openBook = (i: number, from: Element | null = null, viaKeyboard = false) => openCard({ kind: 'book', i }, from, viaKeyboard);

  // --- what is lit -------------------------------------------------------
  const lit: number[] = useMemo(() => {
    if (hot?.kind === 'rib') return [hot.k];
    if (hot?.kind === 'book') return geo.byBook[hot.i];
    if (card?.kind === 'pair') {
      const k = geo.index.get(Math.min(card.i, card.j) * B + Math.max(card.i, card.j));
      return k === undefined ? [] : [k];
    }
    if (card?.kind === 'book') return geo.byBook[card.i];
    return [];
  }, [geo, hot, card, B]);

  const litBooks = new Set<number>();
  if (hot?.kind === 'rib') {
    litBooks.add(geo.top[hot.k].i);
    litBooks.add(geo.top[hot.k].j);
  } else if (hot?.kind === 'book') litBooks.add(hot.i);
  else if (card?.kind === 'pair') {
    litBooks.add(card.i);
    litBooks.add(card.j);
  } else if (card?.kind === 'book') litBooks.add(card.i);
  const selBook = sel !== null ? a.verseBook[sel] : null;
  const focusing = hot !== null || card !== null;

  // Gold chords: the card's pointed-at verse, or else the selected verse.
  const chordFrom = preview && preview.b === undefined ? preview.a : sel;
  const chords = useMemo(() => (chordFrom === null ? [] : verseLinks(a, chordFrom)), [a, chordFrom]);

  // --- layers --------------------------------------------------------------
  const s = f?.s ?? 0;
  const r = f?.r ?? 0;
  const c = s / 2;
  const pt = (ang: number, rad = r) => `${(c + Math.cos(ang) * rad).toFixed(1)},${(c + Math.sin(ang) * rad).toFixed(1)}`;
  const ntStart = useMemo(() => a.books.findIndex((b) => b.testament === 'NT'), [a]);

  const paths = useMemo(
    () =>
      geo.top.map((_, k) => {
        const [p, q] = geo.ends[k];
        return `M${pt(p.a0)} A${r},${r} 0 0 1 ${pt(p.a1)} Q${c},${c} ${pt(q.a0)} A${r},${r} 0 0 1 ${pt(q.a1)} Q${c},${c} ${pt(p.a0)}Z`;
      }),
    [geo, s, r],
  );
  const colors = useMemo(() => geo.top.map((p) => (p.i < ntStart !== p.j < ntStart ? ARC.testaments : GENRE[a.books[p.i].genre].color)), [geo, a, ntStart]);

  const ribbons = useMemo(
    () =>
      paths.map((d, k) => (
        <path key={k} class="wh-rib" d={d} fill={colors[k]} opacity={(0.18 + 0.6 * (geo.top[k].n / geo.max)).toFixed(3)} style={`--d:${Math.round((380 * k) / Math.max(1, paths.length - 1))}ms`} />
      )),
    [paths, colors, geo],
  );

  const names = useMemo(() => geo.top.map((p) => `${a.books[p.i].name} and ${a.books[p.j].name}: ${fmt(p.n)} links`), [geo, a]);
  // Hit areas: wider than the ribbons, strongest on top so a tap in the crowded middle finds the big ones.
  const hits = useMemo(
    () =>
      paths
        .map((d, k) => <path key={k} class="wh-hit" d={d} data-k={k} role="button" aria-label={names[k]} tabindex={k === focusK ? 0 : -1} />)
        .reverse(),
    [paths, names, focusK],
  );

  // Threads: a focused book's strongest partners that have no ribbon of their own
  // (small books like Obadiah or Jude), or an opened pair too small for a ribbon.
  const threadKey = hot?.kind === 'book' ? `b${hot.i}` : hot?.kind === 'rib' ? '' : card?.kind === 'book' ? `b${card.i}` : card?.kind === 'pair' ? `p${card.i}-${card.j}` : '';
  const threads = useMemo(() => {
    const out: { i: number; j: number; n: number }[] = [];
    const has = (i: number, j: number) => geo.index.has(Math.min(i, j) * B + Math.max(i, j));
    if (threadKey[0] === 'b') {
      const i = Number(threadKey.slice(1));
      for (const p of bookFacts(a, i, 0, 5).partners) if (!has(i, p.j)) out.push({ i, j: p.j, n: p.n });
    } else if (threadKey[0] === 'p') {
      const [i, j] = threadKey.slice(1).split('-').map(Number);
      if (!has(i, j)) out.push({ i, j, n: pairTotal(a, i, j) });
    }
    return out;
  }, [a, geo, B, threadKey]);
  for (const t of threads) {
    litBooks.add(t.i);
    litBooks.add(t.j);
  }
  const threadEls = f
    ? threads.map((t) => {
        const p = (geo.books[t.i].a0 + geo.books[t.i].a1) / 2;
        const q = (geo.books[t.j].a0 + geo.books[t.j].a1) / 2;
        const [lo, hi] = t.i < t.j ? [t.i, t.j] : [t.j, t.i];
        const color = (lo < ntStart) !== (hi < ntStart) ? ARC.testaments : GENRE[a.books[lo].genre].color;
        return (
          <path
            key={`${t.i}-${t.j}`}
            class="wh-thread"
            d={chord(c, r, p, q)}
            stroke={color}
            stroke-width={(1.2 + 2.2 * Math.sqrt(t.n / Math.max(1, threads[0].n))).toFixed(2)}
            data-pair={`${lo}-${hi}`}
          >
            <title>{`${a.books[lo].name} and ${a.books[hi].name}: ${fmt(t.n)} links`}</title>
          </path>
        );
      })
    : null;

  // One ribbon pointed at shines fully; a book's many ribbons keep their relative strengths.
  const highlight = lit.map((k) => (
    <path key={k} class="wh-hl" d={paths[k]} fill={colors[k]} stroke={colors[k]} opacity={lit.length === 1 ? 0.95 : (0.42 + 0.58 * (geo.top[k].n / geo.max)).toFixed(3)} />
  ));

  const chordEls = useMemo(() => {
    if (!f || chordFrom === null || !chords.length) return null;
    const p0 = verseAngle(a, geo, chordFrom);
    const max = chords[0].votes;
    const els = chords.map((l, n) => {
      const q = verseAngle(a, geo, l.u);
      const w = Math.sqrt(l.votes / max);
      return (
        <g key={`${chordFrom}:${l.u}`}>
          <path
            class="wh-chord"
            pathLength={1}
            d={chord(c, r, p0, q)}
            stroke={ARC.lamp}
            stroke-width={(0.8 + 1.5 * w).toFixed(2)}
            opacity={(0.32 + 0.6 * w).toFixed(2)}
            style={`--d:${Math.round(n * 9)}ms`}
          />
          <circle class="wh-end" cx={c + Math.cos(q) * (r - 1.5)} cy={c + Math.sin(q) * (r - 1.5)} r={1.6} fill={ARC.lamp} />
        </g>
      );
    });
    return els;
  }, [a, geo, chords, chordFrom, s, r]);

  // A verse pair pointed at in the card: one bright chord between its two verses.
  let pairChord: preact.JSX.Element | null = null;
  if (f && preview && preview.b !== undefined) {
    const p = verseAngle(a, geo, preview.a);
    const q = verseAngle(a, geo, preview.b);
    pairChord = (
      <g class="wh-pairchord">
        <path d={chord(c, r, p, q)} />
        <circle cx={c + Math.cos(p) * r} cy={c + Math.sin(p) * r} r={3} />
        <circle cx={c + Math.cos(q) * r} cy={c + Math.sin(q) * r} r={3} />
      </g>
    );
  }

  // --- labels --------------------------------------------------------------
  const forced = new Set<number>(litBooks);
  if (selBook !== null) forced.add(selBook);
  const forcedKey = [...forced].sort((x, y) => x - y).join(',');
  const labelSpots = useMemo(() => {
    if (!f) return new Map<number, { ang: number; text: string }>();
    const R0 = r + LABEL_OUT;
    // Neighbors stay a full label height (plus a hair) apart where labels start.
    const gap = (FONT * 1.32) / R0;
    const order = [...forced, ...geo.byLength.filter((i) => !forced.has(i))];
    const pos = placeLabels(geo.books, order, forced, gap);
    const out = new Map<number, { ang: number; text: string }>();
    for (const [i, ang] of pos) {
      const room = reach(f, ang) - R0 - 5;
      const full = a.books[i].name;
      const short = shortName(a.books[i]);
      let text: string | null = null;
      if (textWidth(full) <= room) text = full;
      else if (textWidth(short) <= room || forced.has(i)) text = short;
      if (text) out.set(i, { ang, text });
    }
    return out;
  }, [a, geo, forcedKey, f?.s, f?.r, f?.x, f?.y, f?.dx, f?.free.x1, f?.free.y0, f?.free.y1, fontsV]);

  const bookEls = f
    ? geo.books.map((g, i) => {
        const on = litBooks.has(i);
        const isSel = i === selBook;
        const spot = labelSpots.get(i);
        let text: preact.JSX.Element | null = null;
        if (spot) {
          const deg = (spot.ang * 180) / Math.PI;
          const flip = deg > 90 && deg < 270;
          text = (
            <text
              class={`wh-label${on || forced.has(i) ? ' wh-on' : ''}${isSel ? ' wh-sel' : ''}`}
              transform={`translate(${pt(spot.ang, r + LABEL_OUT)}) rotate(${(flip ? deg + 180 : deg).toFixed(2)})`}
              text-anchor={flip ? 'end' : 'start'}
              dominant-baseline="central"
            >
              {spot.text}
            </text>
          );
        }
        const book = a.books[i];
        return (
          <g
            key={i}
            class={`wh-book${on ? ' wh-on' : ''}${focusing && !on ? ' wh-off' : ''}`}
            data-i={i}
            role="button"
            tabindex={i === (focusBook ?? selBook ?? 0) ? 0 : -1}
            aria-label={`${book.name}: key verses and the books it talks with`}
          >
            <path class="wh-bhit" d={`M${pt(g.a0, r + 1)} A${r + 1},${r + 1} 0 0 1 ${pt(g.a1, r + 1)} L${pt(g.a1, r + 13)} A${r + 13},${r + 13} 0 0 0 ${pt(g.a0, r + 13)}Z`} />
            <path
              class={`wh-arc${isSel ? ' wh-glow' : ''}`}
              d={`M${pt(g.a0, r + 2)} A${r + 2},${r + 2} 0 0 1 ${pt(g.a1, r + 2)} L${pt(g.a1, r + 9)} A${r + 9},${r + 9} 0 0 0 ${pt(g.a0, r + 9)}Z`}
              fill={GENRE[book.genre].color}
            />
            {text}
          </g>
        );
      })
    : null;

  // The selected verse's place on its book.
  let selMark: preact.JSX.Element | null = null;
  if (f && sel !== null) {
    const p = verseAngle(a, geo, sel);
    selMark = (
      <g class="wh-selmark" aria-hidden="true">
        <circle cx={c + Math.cos(p) * (r + 5.5)} cy={c + Math.sin(p) * (r + 5.5)} r={6.5} class="wh-halo" />
        <circle cx={c + Math.cos(p) * (r + 5.5)} cy={c + Math.sin(p) * (r + 5.5)} r={2.6} fill={ARC.lamp} />
      </g>
    );
  }

  // --- interaction -----------------------------------------------------------
  const ribbonOf = (t: EventTarget | null): { el: Element; k: number } | null => {
    const el = (t as Element | null)?.closest?.('[data-k]');
    return el ? { el, k: Number(el.getAttribute('data-k')) } : null;
  };
  const bookOf = (t: EventTarget | null): { el: Element; i: number } | null => {
    const el = (t as Element | null)?.closest?.('[data-i]');
    return el ? { el, i: Number(el.getAttribute('data-i')) } : null;
  };

  const onPointerOver = (e: PointerEvent) => {
    const rb = ribbonOf(e.target);
    if (rb) return setHot((h) => (h?.kind === 'rib' && h.k === rb.k ? h : { kind: 'rib', k: rb.k }));
    const bk = bookOf(e.target);
    if (bk) return setHot((h) => (h?.kind === 'book' && h.i === bk.i ? h : { kind: 'book', i: bk.i }));
    setHot(null);
  };
  const onPointerDown = (e: PointerEvent) => {
    // A finger can scrub across the wheel: let other ribbons see it pass.
    if (e.pointerType === 'touch') {
      const el = e.target as Element;
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    }
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const rb = ribbonOf(under);
    const bk = rb ? null : bookOf(under);
    if (rb) openPair(rb.k);
    else if (bk) openBook(bk.i);
    if (rb || bk) touchOpened.current = performance.now();
    setHot(null);
  };
  const onClick = (e: MouseEvent) => {
    // A tap was already handled when the finger lifted; its click can land on a neighbor.
    if (performance.now() - touchOpened.current < 500) return;
    const th = (e.target as Element | null)?.closest?.('[data-pair]');
    if (th) {
      const [i, j] = th.getAttribute('data-pair')!.split('-').map(Number);
      return openCard({ kind: 'pair', i, j }, null, false);
    }
    const rb = ribbonOf(e.target);
    if (rb) return openPair(rb.k, rb.el, e.detail === 0);
    const bk = bookOf(e.target);
    if (bk) return openBook(bk.i, bk.el, e.detail === 0);
    // A tap on empty sky closes the card.
    if (card && e.target === e.currentTarget) closeCard();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const rb = ribbonOf(e.target);
    const bk = rb ? null : bookOf(e.target);
    if (!rb && !bk) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (rb) openPair(rb.k, rb.el, true);
      else if (bk) openBook(bk.i, bk.el, true);
      return;
    }
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const count = rb ? geo.top.length : B;
    const at = rb ? rb.k : bk!.i;
    let next: number | null = null;
    if (step !== undefined) next = (at + step + count) % count;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    if (next === null) return;
    e.preventDefault();
    if (rb) setFocusK(next);
    else setFocusBook(next);
    root.current?.querySelector<SVGElement>(rb ? `.wh-hit[data-k="${next}"]` : `.wh-book[data-i="${next}"]`)?.focus();
  };
  const onFocusIn = (e: FocusEvent) => {
    const rb = ribbonOf(e.target);
    const bk = rb ? null : bookOf(e.target);
    if (rb) setFocusK(rb.k);
    else if (bk) setFocusBook(bk.i);
    else return;
    // Keyboard focus lights what it lands on; a click or tap has already lit it by pointing.
    if (!keyboardFocus(e.target as Element)) return;
    focusLit.current = true;
    setHot(rb ? { kind: 'rib', k: rb.k } : { kind: 'book', i: bk!.i });
  };
  const onFocusOut = () => {
    if (!focusLit.current) return;
    focusLit.current = false;
    setHot(null);
  };

  const pick = (v: number) => {
    S.selectVerse(v);
    if (f?.phone) closeCard();
  };

  // --- caption ---------------------------------------------------------------
  let caption: preact.ComponentChildren = (
    <>
      <span>{TAP} a ribbon to see the verses that join two books.</span> <span>{TAP} a book for its key verses.</span>
    </>
  );
  if (hot?.kind === 'rib') {
    const p = geo.top[hot.k];
    caption = (
      <>
        <b>
          {a.books[p.i].name} and {a.books[p.j].name}
        </b>
        : {fmt(p.n)} links. {TAP} to see the verses that join them.
      </>
    );
  } else if (hot?.kind === 'book') {
    const partners = bookFacts(a, hot.i, 0, 3).partners;
    caption = (
      <>
        <b>{a.books[hot.i].name}</b>: most linked with {partners.map((p) => `${a.books[p.j].name} (${fmt(p.n)})`).join(', ')}
      </>
    );
  }

  const dim = focusing ? ' wh-dim' : chordFrom !== null && chords.length ? ' wh-soft' : '';
  return (
    <div
      class={`wh-root${f?.phone ? ' wh-phone' : ''}${entering ? ' wh-enter' : ''}${dim}`}
      ref={root}
      style={box ? `--wh-top:${Math.round(box.bottom)}px` : undefined}
      // Focus listeners live here, not on the <svg>: Chromium puts an SVG with focus listeners in the tab order.
      onFocusIn={onFocusIn}
      onFocusOut={onFocusOut}
      onClick={(e) => {
        if (card && e.target === e.currentTarget && performance.now() - touchOpened.current >= 500) closeCard();
      }}
    >
      {f && (
        <svg
          class="wh-svg"
          width={s}
          height={s}
          viewBox={`0 0 ${s} ${s}`}
          style={`left:${f.x.toFixed(1)}px;top:${f.y.toFixed(1)}px;transform:translateX(${f.dx.toFixed(1)}px)`}
          role="group"
          aria-label="Wheel of the 66 books. Ribbons join books that cite each other, sized by how many links they share."
          aria-describedby="wh-hint"
          onPointerOver={onPointerOver}
          onPointerLeave={() => setHot(null)}
          onPointerCancel={() => setHot(null)}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClick={onClick}
          onKeyDown={onKeyDown}
        >
          <g class="wh-ribs">{ribbons}</g>
          <g class="wh-hls">{highlight}</g>
          <g class="wh-chords">{chordEls}</g>
          <g class="wh-hits">{hits}</g>
          <g class={`wh-threads${card ? ' wh-live' : ''}`}>{threadEls}</g>
          <g class="wh-books">{bookEls}</g>
          {selMark}
          {pairChord}
        </svg>
      )}
      <p id="wh-hint" class="sr-only">
        Arrow keys move between ribbons, strongest first, or between books. Enter opens a card; Escape closes it.
      </p>
      <p class="wh-caption" style={f && !f.phone ? `max-width:${Math.max(170, Math.min(420, f.x + f.dx - 28)).toFixed(0)}px` : undefined}>
        {caption}
      </p>
      {f && <Legend a={a} phone={f.phone} chordFrom={chordFrom} chordCount={chords.length} maxWidth={f.phone ? undefined : Math.max(170, Math.min(420, f.x + f.dx - 28))} />}
      {f && card && (
        <aside class="wh-card" role="region" aria-labelledby={CARD_TITLE} style={f.phone ? undefined : `width:${f.cardW}px`}>
          {card.kind === 'pair' ? (
            <PairCard key={`p${card.i}-${card.j}`} a={a} i={card.i} j={card.j} titleId={CARD_TITLE} selected={sel} onPick={pick} onPreview={setPreview} onClose={closeCard} onBook={(i) => openBook(i, null, false)} />
          ) : (
            <BookCard
              key={`b${card.i}`}
              a={a}
              i={card.i}
              titleId={CARD_TITLE}
              selected={sel}
              onPick={pick}
              onPreview={setPreview}
              onClose={closeCard}
              onPair={(j) => openCard({ kind: 'pair', i: Math.min(card.i, j), j: Math.max(card.i, j) }, null, false)}
              onRead={() => {
                S.reading.value = { book: card.i, chapter: 1 };
                if (f.phone) {
                  S.mobilePane.value = 'read';
                  closeCard();
                }
              }}
            />
          )}
        </aside>
      )}
    </div>
  );
}

function Legend({ a, phone, chordFrom, chordCount, maxWidth }: { a: Atlas; phone: boolean; chordFrom: number | null; chordCount: number; maxWidth?: number }) {
  const [open, setOpen] = useState(false);
  const genre = `linear-gradient(90deg, ${GENRE_IDS.map((g) => GENRE[g].color).join(', ')})`;
  const items = (
    <ul class="wh-keys-list">
      <li>
        <i class="wh-sw" style={`background:${genre}`} />
        Links within a Testament
      </li>
      <li>
        <i class="wh-sw" style={`background:${ARC.testaments}`} />
        Links between the Testaments
      </li>
      {chordFrom !== null && chordCount > 0 && (
        <li>
          <i class="wh-sw" style={`background:${ARC.lamp}`} />
          {label(a, chordFrom)}: its {chordCount === MAX_CHORDS ? `${MAX_CHORDS} strongest links` : `${chordCount} ${chordCount === 1 ? 'link' : 'links'}`}
        </li>
      )}
    </ul>
  );
  const groups = (
    <ul class="wh-groups">
      {GENRE_IDS.map((g) => (
        <li key={g}>
          <i class="wh-dot" style={`background:${GENRE[g].color}`} />
          {GENRE[g].label}
        </li>
      ))}
    </ul>
  );
  if (phone) {
    return (
      <div class={`wh-legend wh-legend-phone${open ? ' wh-open' : ''}`}>
        {open && (
          <div class="wh-pop" id="wh-key">
            {items}
            <p class="wh-h4">Book colors</p>
            {groups}
          </div>
        )}
        <button class="wh-keybtn" aria-expanded={open} aria-controls="wh-key" onClick={() => setOpen(!open)}>
          {chordFrom !== null && chordCount > 0 && <i class="wh-dot" style={`background:${ARC.lamp}`} />}
          {open ? 'Hide key' : 'Key'}
        </button>
      </div>
    );
  }
  return (
    <div class="wh-legend" style={maxWidth ? `max-width:${maxWidth.toFixed(0)}px` : undefined}>
      {items}
      <button class="wh-groupsbtn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide book colors' : 'Book colors'}
      </button>
      {open && groups}
    </div>
  );
}
