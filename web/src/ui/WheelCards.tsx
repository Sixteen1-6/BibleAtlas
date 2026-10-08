// The cards the Wheel opens. A ribbon's card answers "what do these two books
// say to each other?" with the verse pairs readers voted strongest. A book's
// card shows the verses the rest of the Bible leans on most, and the books it
// talks with. Each opens short, with more one tap away.

import { useMemo, useState } from 'preact/hooks';
import { type Atlas, locate, rangeLabel } from '../data/atlas';
import { ARC, GENRE } from './colors';
import { Provenance, Snippet } from './common';

/** Rows a card shows before "Show more". */
const FIRST_ROWS = 3;

const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
/** "Tap" on touch screens, "Click" with a mouse, for instructions. */
export const TAP = TOUCH ? 'Tap' : 'Click';

// ------------------------------------------------------------------ data

/** One verse pair between two books; `a` is in the first book, `b` in the second. */
export interface PairRow {
  a: number;
  aSpan: number;
  b: number;
  bSpan: number;
  votes: number;
}

export interface PairInfo {
  i: number;
  j: number;
  /** Positively voted cross-references between the books, both directions (the ribbon's size). */
  total: number;
  /** Distinct verse pairs among them (a link both ways counts once). */
  pairs: number;
  rows: PairRow[];
}

/** One past the last verse of book i. */
export function bookEnd(a: Atlas, i: number): number {
  return i + 1 < a.books.length ? a.books[i + 1].start : a.n;
}

/** Cross-references between two books, both directions, as the wheel draws them. */
export function pairTotal(a: Atlas, i: number, j: number): number {
  const B = a.books.length;
  return i === j ? a.bookFlow[i * B + i] : a.bookFlow[i * B + j] + a.bookFlow[j * B + i];
}

/**
 * The strongest verse pairs joining books i and j. Links in both directions are
 * merged into one row per verse pair, keeping the stronger direction's votes
 * (as Connections does). Only positively voted pairs count. Rows are strongest
 * first, and no verse appears in more than `perVerse` rows, so one famous verse
 * cannot fill the list.
 */
export function pairRows(a: Atlas, i: number, j: number, limit = 8, perVerse = 2): PairInfo {
  const by = new Map<number, PairRow>();
  const scan = (from: number, to: number) => {
    const forward = from === i;
    for (let v = a.books[from].start, end = bookEnd(a, from); v < end; v++) {
      for (let e = a.xOff[v]; e < a.xOff[v + 1]; e++) {
        const w = a.xDst[e];
        if (a.verseBook[w] !== to) continue;
        const votes = a.xVotes[e];
        const va = forward ? v : w;
        const vb = forward ? w : v;
        const key = va * a.n + vb;
        const had = by.get(key);
        if (!had || votes > had.votes) {
          by.set(key, { a: va, aSpan: forward ? 1 : a.xSpan[e], b: vb, bSpan: forward ? a.xSpan[e] : 1, votes });
        }
      }
    }
  };
  scan(i, j);
  if (j !== i) scan(j, i);
  const all = [...by.values()].filter((p) => p.votes > 0).sort((x, y) => y.votes - x.votes || x.a - y.a || x.b - y.b);
  const used = new Map<number, number>();
  const rows: PairRow[] = [];
  for (const p of all) {
    if (rows.length >= limit) break;
    const ua = used.get(p.a) ?? 0;
    const ub = used.get(p.b) ?? 0;
    if (ua >= perVerse || ub >= perVerse) continue;
    used.set(p.a, ua + 1);
    used.set(p.b, ub + 1);
    rows.push(p);
  }
  return { i, j, total: pairTotal(a, i, j), pairs: all.length, rows };
}

export interface BookFacts {
  i: number;
  verses: number;
  chapters: number;
  /** The book's most central verses (PageRank), strongest first. */
  top: number[];
  /** Books it shares the most links with, both directions. */
  partners: { j: number; n: number }[];
  /** Links to other books. */
  between: number;
  /** Of those, links to the other Testament. */
  cross: number;
}

export function bookFacts(a: Atlas, i: number, topN = 6, partnerN = 5): BookFacts {
  const start = a.books[i].start;
  const end = bookEnd(a, i);
  const top: number[] = [];
  const better = (x: number, y: number) => a.rank[x] > a.rank[y] || (a.rank[x] === a.rank[y] && x < y);
  for (let v = start; v < end && topN > 0; v++) {
    if (top.length === topN && !better(v, top[topN - 1])) continue;
    let k = top.length < topN ? top.length : topN - 1;
    while (k > 0 && better(v, top[k - 1])) {
      if (k < topN) top[k] = top[k - 1];
      k--;
    }
    top[k] = v;
  }
  const partners: { j: number; n: number }[] = [];
  let between = 0;
  let cross = 0;
  for (let j = 0; j < a.books.length; j++) {
    if (j === i) continue;
    const n = pairTotal(a, i, j);
    if (!n) continue;
    between += n;
    if (a.books[j].testament !== a.books[i].testament) cross += n;
    partners.push({ j, n });
  }
  partners.sort((x, y) => y.n - x.n || x.j - y.j);
  return { i, verses: end - start, chapters: a.books[i].chapters.length, top, partners: partners.slice(0, partnerN), between, cross };
}

/** "Isa.40.8": a stable reference for tests and links. */
export function osisRef(a: Atlas, v: number): string {
  const l = locate(a, v);
  return `${a.books[l.book].osis}.${l.chapter}.${l.verse}`;
}

const fmt = (n: number) => n.toLocaleString('en-US');

// ------------------------------------------------------------------ cards

interface Common {
  a: Atlas;
  /** The verse selected in the app, marked when it appears in a card. */
  selected: number | null;
  /** Select a verse (the reader and Links follow). */
  onPick: (v: number) => void;
  /** Show a verse pair, or one verse, on the wheel while it is pointed at. */
  onPreview: (p: { a: number; b?: number } | null) => void;
  onClose: () => void;
}

function Head({ id, children, sub, action, onClose }: { id: string; children: preact.ComponentChildren; sub: preact.ComponentChildren; action?: preact.ComponentChildren; onClose: () => void }) {
  return (
    <header class="wh-head">
      <div class="wh-titles">
        <h2 id={id} tabIndex={-1}>
          {children}
        </h2>
        <p class="wh-sub">{sub}</p>
      </div>
      {action}
      <button class="wh-x" onClick={onClose} aria-label="Close this card" title="Close (Esc)">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </button>
    </header>
  );
}

function Dot({ color }: { color: string }) {
  return <i class="wh-dot" style={`background:${color}`} aria-hidden="true" />;
}

function VerseButton({ a, v, span, selected, onPick, max = 170 }: { a: Atlas; v: number; span: number; selected: number | null; onPick: (v: number) => void; max?: number }) {
  return (
    <button class={`wh-verse${selected === v ? ' wh-cur' : ''}`} onClick={() => onPick(v)} aria-current={selected === v ? 'true' : undefined}>
      <span class="wh-ref">{rangeLabel(a, v, span)}</span>
      <Snippet a={a} v={v} max={max} />
    </button>
  );
}

function More({ hidden, open, onOpen }: { hidden: number; open: boolean; onOpen: () => void }) {
  if (open || hidden <= 0) return null;
  return (
    <button class="wh-more" onClick={onOpen}>
      Show {hidden} more
    </button>
  );
}

export function PairCard({ a, i, j, titleId, onBook, ...c }: Common & { i: number; j: number; titleId: string; onBook: (i: number) => void }) {
  const info = useMemo(() => pairRows(a, i, j), [a, i, j]);
  const [all, setAll] = useState(false);
  const A = a.books[i];
  const Bk = a.books[j];
  const shown = all ? info.rows : info.rows.slice(0, FIRST_ROWS);
  const max = Math.max(1, info.rows[0]?.votes ?? 1);
  const cross = A.testament !== Bk.testament;
  return (
    <>
      <Head
        id={titleId}
        onClose={c.onClose}
        sub={
          <>
            <b>{fmt(info.total)} links</b> between them <span class="wh-quiet">({fmt(info.pairs)} verse pairs)</span>
          </>
        }
      >
        <button class="wh-bookbtn" onClick={() => onBook(i)} title={`About ${A.name}`}>
          <Dot color={GENRE[A.genre].color} />
          {A.name}
        </button>
        <span class="wh-amp" style={cross ? `color:${ARC.testaments}` : undefined} aria-hidden="true">
          ↔
        </span>
        <span class="sr-only">and</span>
        <button class="wh-bookbtn" onClick={() => onBook(j)} title={`About ${Bk.name}`}>
          <Dot color={GENRE[Bk.genre].color} />
          {Bk.name}
        </button>
      </Head>
      <div class="wh-body">
        {info.rows.length === 0 ? (
          <p class="wh-lead">No links between these two books have positive votes yet.</p>
        ) : (
          <>
            <p class="wh-lead">Strongest first, by readers’ votes. {TAP} a verse to read it.</p>
            <ol class="wh-pairs">
              {shown.map((r, k) => (
                <li
                  key={`${r.a}-${r.b}`}
                  class="wh-pair"
                  data-a={osisRef(a, r.a)}
                  data-b={osisRef(a, r.b)}
                  data-votes={r.votes}
                  onPointerEnter={() => c.onPreview({ a: r.a, b: r.b })}
                  onPointerLeave={() => c.onPreview(null)}
                  onFocusIn={() => c.onPreview({ a: r.a, b: r.b })}
                  onFocusOut={() => c.onPreview(null)}
                >
                  <VerseButton a={a} v={r.a} span={r.aSpan} selected={c.selected} onPick={c.onPick} />
                  <span class="wh-bridge" title={`${fmt(r.votes)} votes on OpenBible.info`}>
                    <i style={`height:${(1.5 + 2.5 * Math.sqrt(r.votes / max)).toFixed(1)}px`} />
                    <b>{fmt(r.votes)}</b>
                    <span class="sr-only">votes, pair {k + 1}</span>
                  </span>
                  <VerseButton a={a} v={r.b} span={r.bSpan} selected={c.selected} onPick={c.onPick} />
                </li>
              ))}
            </ol>
            <More hidden={info.rows.length - shown.length} open={all} onOpen={() => setAll(true)} />
          </>
        )}
        <details class="wh-how">
          <summary>How these are chosen</summary>
          <p>
            Each row is one pair of verses, strongest first by readers’ votes on OpenBible.info. A link that runs both ways counts once, with its stronger vote. A verse can appear in at most two rows,
            so one famous verse cannot fill the list. The {fmt(info.total)} links are what sizes this ribbon on the wheel.
          </p>
        </details>
        <Provenance>Links and votes: OpenBible.info cross-references (CC BY 4.0).</Provenance>
      </div>
    </>
  );
}

export function BookCard({ a, i, titleId, onPair, onRead, ...c }: Common & { i: number; titleId: string; onPair: (j: number) => void; onRead: () => void }) {
  const f = useMemo(() => bookFacts(a, i), [a, i]);
  const [all, setAll] = useState(false);
  const b = a.books[i];
  const g = GENRE[b.genre];
  const shown = all ? f.top : f.top.slice(0, FIRST_ROWS);
  const share = f.between ? Math.round((100 * f.cross) / f.between) : 0;
  return (
    <>
      <Head
        id={titleId}
        onClose={c.onClose}
        action={
          <button class="wh-read" onClick={onRead} aria-label={`Open ${b.name} in the reader`}>
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 3.5C6.6 2.6 4.6 2.2 2 2.3v10c2.6-.1 4.6.3 6 1.2 1.4-.9 3.4-1.3 6-1.2v-10c-2.6-.1-4.6.3-6 1.2zM8 3.5v10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
            </svg>
            Open in reader
          </button>
        }
        sub={
          <>
            {g.label} · {fmt(f.chapters)} {f.chapters === 1 ? 'chapter' : 'chapters'} · {fmt(f.verses)} verses
          </>
        }
      >
        <span class="wh-booktitle">
          <Dot color={g.color} />
          {b.name}
        </span>
      </Head>
      <div class="wh-body">
        <h3 class="wh-h3">Key verses</h3>
        <ol class="wh-keys">
          {shown.map((v) => (
            <li key={v} data-v={osisRef(a, v)} onPointerEnter={() => c.onPreview({ a: v })} onPointerLeave={() => c.onPreview(null)} onFocusIn={() => c.onPreview({ a: v })} onFocusOut={() => c.onPreview(null)}>
              <VerseButton a={a} v={v} span={1} selected={c.selected} onPick={c.onPick} max={190} />
            </li>
          ))}
        </ol>
        <More hidden={f.top.length - shown.length} open={all} onOpen={() => setAll(true)} />

        {f.partners.length > 0 && (
          <>
            <h3 class="wh-h3">Talks most with</h3>
            <div class="wh-partners">
              {f.partners.map((p) => (
                <button key={p.j} class="wh-partner" onClick={() => onPair(p.j)} aria-label={`${a.books[p.j].name}: ${fmt(p.n)} links. Open the verses that join them.`}>
                  <Dot color={GENRE[a.books[p.j].genre].color} />
                  {a.books[p.j].name}
                  <span class="wh-n">{fmt(p.n)}</span>
                </button>
              ))}
            </div>
            <p class="wh-reach">
              Reaches {b.testament === 'OT' ? 'into the New Testament' : 'back into the Old Testament'} <b>{fmt(f.cross)}</b> times: {share}% of its links to other books.
            </p>
          </>
        )}

        <details class="wh-how">
          <summary>How these are chosen</summary>
          <p>
            Key verses are ranked by PageRank over the {fmt(a.meta.counts.crossReferencesPositive ?? a.meta.counts.crossReferences)} links readers voted up, weighted by their votes: a verse ranks high
            when many passages point to it, and higher still when those passages are themselves widely linked. “Talks most with” and the share above count the links between two books in both
            directions.
          </p>
        </details>
        <Provenance>Links: OpenBible.info cross-references (CC BY 4.0).</Provenance>
      </div>
    </>
  );
}
