// One quiet line after a chapter's last verse: when its events happened and
// when its book was written, in the words of the Tyndale Open Bible Dictionary.
// "More" opens the dictionary's own sentences, every dating view it names, a
// small timeline and a button that lights the era up on the map.

import { Fragment } from 'preact';
import { useEffect, useId, useState } from 'preact/hooks';
import type { Atlas } from '../data/atlas';
import {
  type BookDates,
  type Cite,
  type DatedView,
  type Era,
  type EraRange,
  type Eras,
  bookDates,
  chapterEra,
  eraSummary,
  eraVerses,
  excerpt,
  formatYears,
  loadEras,
  shownLabel,
  writtenSummary,
} from '../data/eras';
import * as S from '../state';
import { Provenance } from './common';
import './when.css';

const FRAMING = "One reference work's view. Scholars date some books differently; where this dictionary names other positions, they are shown.";
const DICTIONARY = 'Tyndale Open Bible Dictionary';
/** Views shown before "Show more". */
const FEW = 3;

export function ChapterWhen({ a, book, chapter, ready }: { a: Atlas; book: number; chapter: number; ready: boolean }) {
  const [data, setData] = useState<Eras | null>(null);
  const [openAt, setOpenAt] = useState<string | null>(null);
  const id = useId();

  useEffect(() => {
    if (!ready || data) return;
    let live = true;
    // Nothing is shown until the file arrives, and nothing if it never does.
    // A failed fetch is tried again on the next chapter.
    loadEras(a)
      .then((d) => live && setData(d))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [a, ready, data, book, chapter]);

  if (!ready || !data) return null;
  const dates = bookDates(data, book);
  const placed = chapterEra(a, data, book, chapter);
  if (!dates && !placed) return null;
  const here = `${book}:${chapter}`;
  const open = openAt === here;

  return (
    <>
      <p class="tp-when">
        {placed && <span class="tp-part">When: {eraSummary(placed.era)}</span>}
        {placed && dates && <span aria-hidden="true"> · </span>}
        {dates && <span class="tp-part">Written: {writtenSummary(dates)}</span>}
        <button class="tp-more" aria-expanded={open} aria-controls={`${id}-more`} onClick={() => setOpenAt(open ? null : here)}>
          {open ? 'Less' : 'More'}
        </button>
      </p>
      {open && <More id={`${id}-more`} a={a} data={data} book={book} placed={placed} dates={dates} />}
    </>
  );
}

type Placed = { era: Era; index: number; range: EraRange } | null;

function More({ id, a, data, book, placed, dates }: { id: string; a: Atlas; data: Eras; book: number; placed: Placed; dates: BookDates | null }) {
  return (
    <div class="tp-panel" id={id}>
      <p class="tp-frame">{FRAMING}</p>
      {placed && (
        <section class="tp-sec">
          <h3 class="tp-h">When it happened</h3>
          <EraBlock a={a} era={placed.era} range={placed.range} />
        </section>
      )}
      {dates && (
        <section class="tp-sec">
          <h3 class="tp-h">When it was written</h3>
          <Views views={dates.written} />
        </section>
      )}
      <Timeline a={a} data={data} book={book} current={placed?.index ?? -1} dates={dates} />
      {placed && <MapButton a={a} data={data} era={placed.era} index={placed.index} />}
      {/* On a phone the sources list lives in the study pane: show it there. */}
      <div onClick={(e) => (e.target as HTMLElement).closest('.provenance button') && (S.mobilePane.value = 'study')}>
        <Provenance>Adapted from the Tyndale Open Bible Dictionary (Tyndale House Publishers, CC BY-SA 4.0). Quotations are word for word; the choice of era for each chapter is this app's.</Provenance>
      </div>
    </div>
  );
}

function CiteLine({ c, chart }: { c?: Cite; chart?: string }) {
  return (
    <p class="tp-cite">
      {DICTIONARY}, {chart ? <>chart “{chart}”</> : c && <>“{c.title}”{c.heading && <> › {c.heading}</>}</>}
    </p>
  );
}

function EraBlock({ a, era, range }: { a: Atlas; era: Era; range: EraRange }) {
  const views = era.views ?? [];
  // Years beside the name only when the dictionary gives no other view of them.
  const settled = !views.length && era.from !== undefined && era.to !== undefined && !/\d/.test(era.name);
  const b = a.books[range.book];
  const where = `${b.name} ${range.from === range.to ? range.from : `${range.from}–${range.to}`}`;
  return (
    <>
      <p class="tp-era">
        {era.name}
        {settled && <span class="tp-years"> · {formatYears(era.from!, era.to!)}</span>}
      </p>
      <blockquote class="tp-q">“{excerpt(era.quote)}”</blockquote>
      <CiteLine c={era.cite} />
      <Ends era={era} />
      {views.length > 0 && <Views views={views} />}
      <div class="tp-why">
        <span class="tp-whyh">Why this chapter ({where}):</span>{' '}
        {range.quote ? (
          <>
            “{excerpt(range.quote)}”
            <CiteLine c={range.cite} />
          </>
        ) : (
          range.row && (
            <figure class="tp-row">
              <table>
                {range.row.header && (
                  <thead>
                    <tr>
                      {range.row.header.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  <tr>
                    {range.row.cells.map((c, i) => (
                      <td key={i}>{c}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <CiteLine chart={range.row.chart} />
            </figure>
          )
        )}
      </div>
    </>
  );
}

/** Where the era's years come from: a row of a date chart, or a label in a quotation. */
function Ends({ era }: { era: Era }) {
  const rows: [string, NonNullable<Era['start']>, number][] = [];
  if (era.start && era.end && era.start.event && era.start.event === era.end.event) rows.push(['Date', era.start, era.from!]);
  else {
    if (era.start && era.from !== undefined) rows.push(['From', era.start, era.from]);
    if (era.end && era.to !== undefined) rows.push(['To', era.end, era.to]);
  }
  if (!rows.length) return null;
  return (
    <dl class="tp-ends">
      {rows.map(([k, s, y]) => (
        <Fragment key={k}>
          <dt>{k}</dt>
          <dd>
            {s.event ? (
              <>
                {s.event}, {s.label} · chart “{s.chart}”
              </>
            ) : (
              <>
                {formatYears(y, y)} · “{s.cite?.title}”{s.cite?.heading && <> › {s.cite.heading}</>}
              </>
            )}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** Consecutive views quoting the same sentence are shown together. */
function groups(views: DatedView[]): DatedView[][] {
  const out: DatedView[][] = [];
  for (const v of views) {
    const last = out[out.length - 1]?.[0];
    if (last && last.quote === v.quote && last.cite.article === v.cite.article && last.cite.heading === v.cite.heading) out[out.length - 1].push(v);
    else out.push([v]);
  }
  return out;
}

function Views({ views }: { views: DatedView[] }) {
  const [all, setAll] = useState(false);
  const items = groups(views);
  const shown = all ? items : items.slice(0, FEW);
  const hidden = items.slice(shown.length).reduce((n, g) => n + g.length, 0);
  return (
    <>
      <ul class="tp-views">
        {shown.map((g, i) => {
          const pref = g.find((v) => v.prefers);
          return (
            <li class="tp-view" key={i}>
              {g.map(
                (v, j) =>
                  !v.undated && (
                    <p class="tp-vlabel" key={j}>
                      {v.who && <span class="tp-who">{v.who}: </span>}
                      <b>{shownLabel(v)}</b>
                    </p>
                  ),
              )}
              <blockquote class="tp-q">“{excerpt(g[0].quote)}”</blockquote>
              {pref?.prefersQuote && (
                <p class="tp-pref">
                  {g[0].quote.includes(pref.prefersQuote) ? (
                    'The dictionary prefers this view.'
                  ) : (
                    <>The dictionary prefers this view: “{excerpt(pref.prefersQuote)}”</>
                  )}
                </p>
              )}
              <CiteLine c={g[0].cite} />
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <button class="tp-more tp-show" onClick={() => setAll(true)}>
          Show {hidden} more
        </button>
      )}
    </>
  );
}

function MapButton({ a, data, era, index }: { a: Atlas; data: Eras; era: Era; index: number }) {
  const label = `era:${era.id}`;
  const on = S.marks.value?.label === label;
  const toggle = () => {
    if (on) {
      if (S.marks.value?.label === label) S.marks.value = null;
      return;
    }
    S.marks.value = { verses: eraVerses(a, data, index), label };
    S.groupEdges.value = null;
  };
  return (
    <button class="btn tp-map" aria-pressed={on} onClick={toggle}>
      {on ? 'Hide on map' : 'Light up this era on the map'}
    </button>
  );
}

// ------------------------------------------------------------ timeline

const AXES = {
  OT: { lo: -2200, hi: -100, step: 500, name: '2200 BC to 100 BC' },
  NT: { lo: -10, hi: 110, step: 20, name: '10 BC to AD 110' },
};
/** Plot area, in percent of the width; the left edge holds the row names. */
const LEFT = 16;
const RIGHT = 98;
const BAND_Y = 4;
const BAND_H = 14;
const LANE_Y = 21;
const ROW_Y = 28;
const ROW_STEP = 6;
const MAX_ROWS = 4;

interface Bar {
  from: number;
  to: number;
  /** Fade toward the side whose date the dictionary leaves open. */
  fade?: 'left' | 'right';
  title: string;
}

/** A span on the axis, with an open end drawn as a fade of `fadeLen` years. */
function bar(from: number | undefined, to: number | undefined, fadeLen: number, title: string): Bar | null {
  if (from !== undefined && to !== undefined) return { from, to, title };
  if (from !== undefined) return { from, to: from + fadeLen, fade: 'right', title };
  if (to !== undefined) return { from: to - fadeLen, to, fade: 'left', title };
  return null;
}

function Timeline({ a, data, book, current, dates }: { a: Atlas; data: Eras; book: number; current: number; dates: BookDates | null }) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const nt = a.books[book].testament === 'NT';
  const ax = nt ? AXES.NT : AXES.OT;
  const span = ax.hi - ax.lo;
  const x = (y: number) => LEFT + ((Math.min(Math.max(y, ax.lo), ax.hi) - ax.lo) / span) * (RIGHT - LEFT);
  const fadeLen = span * 0.12;

  // The eras of this testament, plus eras without chapters that fall on this axis.
  const testamentOf = new Map<number, boolean>();
  for (const r of data.ranges) testamentOf.set(r.era, a.books[r.book].testament === 'NT');
  const bands: { i: number; e: Era; b: Bar; lane: boolean }[] = [];
  data.eras.forEach((e, i) => {
    const t = testamentOf.get(i);
    const lane = t === undefined;
    if (!lane && t !== nt) return;
    const years = e.from !== undefined && e.to !== undefined ? `, ${formatYears(e.from, e.to)}` : '';
    const b = bar(e.from, e.to, lane ? span : fadeLen, `${e.name}${years}`);
    if (b && b.to >= ax.lo && b.from <= ax.hi) bands.push({ i, e, b, lane });
  });
  const main = bands.filter((x) => !x.lane);
  const order = [...main.filter((x) => x.i !== current), ...main.filter((x) => x.i === current)];
  const lanes = bands.filter((x) => x.lane);

  const written = (dates?.written ?? [])
    .map((v) => ({ v, b: v.from !== undefined || v.to !== undefined ? bar(v.from, v.to, fadeLen, `${v.who ? `${v.who}: ` : ''}${shownLabel(v)}`) : null }))
    .filter((w): w is { v: DatedView; b: Bar } => w.b !== null)
    .slice(0, MAX_ROWS);
  const rows = Math.max(1, written.length);
  const axisY = ROW_Y + rows * ROW_STEP + 2;
  const height = axisY + 16;
  const ticks: number[] = [];
  for (let y = Math.ceil((ax.lo + 1) / ax.step) * ax.step; y < ax.hi; y += ax.step) if (y !== 0) ticks.push(y);

  const cur = current >= 0 ? data.eras[current] : null;
  const aria = [
    `Timeline, ${ax.name}.`,
    `Eras: ${bands.map((x) => x.b.title).join('; ')}.`,
    cur ? `This chapter: ${eraSummary(cur)}.` : '',
    written.length ? `Written: ${written.map((w) => w.b.title).join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  /** `tone` colors the fade of an open end: the current era, a written view, or a plain band. */
  const rect = (b: Bar, y: number, h: number, cls: string, key: string, tone = '') => {
    const x0 = x(b.from);
    const w = x(b.to) - x0;
    // A point in time, or a span too short to see: a tick a little taller than the bar.
    if (w < 0.6)
      return (
        <line key={key} class={`${cls} tp-tick`} x1={`${x0 + w / 2}%`} x2={`${x0 + w / 2}%`} y1={y - 1} y2={y + h + 1}>
          <title>{b.title}</title>
        </line>
      );
    const id = `${gid}-${key}`;
    return (
      <Fragment key={key}>
        {b.fade && (
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" class={`tp-stop${tone}`} stop-opacity={b.fade === 'left' ? 0 : 1} />
            <stop offset="1" class={`tp-stop${tone}`} stop-opacity={b.fade === 'left' ? 1 : 0} />
          </linearGradient>
        )}
        <rect class={cls} x={`${x0}%`} width={`${w}%`} y={y} height={h} rx={2} style={b.fade ? `fill:url(#${id})` : undefined}>
          <title>{b.title}</title>
        </rect>
      </Fragment>
    );
  };

  return (
    <svg class="tp-time" width="100%" height={height} role="img" aria-label={aria}>
      <text class="tp-rowname" x="0" y={BAND_Y + BAND_H - 3}>
        Eras
      </text>
      {order.map(({ i, b }, k) => rect(b, BAND_Y, BAND_H, `tp-band${i === current ? ' cur' : k % 2 ? ' alt' : ''}`, `e${i}`, i === current ? ' cur' : ''))}
      {lanes.map(({ i, b }) => rect(b, LANE_Y, 3, 'tp-band tp-lane', `l${i}`))}
      {written.length > 0 && (
        <text class="tp-rowname" x="0" y={ROW_Y + 5}>
          Written
        </text>
      )}
      {written.map(({ v, b }, k) => rect(b, ROW_Y + k * ROW_STEP, 4, `tp-wbar${k === 0 || v.prefers ? ' first' : ''}`, `w${k}`, ' w'))}
      <line class="tp-axis" x1={`${LEFT}%`} x2={`${RIGHT}%`} y1={axisY} y2={axisY} />
      {ticks.map((y) => (
        <text key={y} class="tp-label" x={`${x(y)}%`} y={axisY + 12} text-anchor="middle">
          {formatYears(y, y)}
        </text>
      ))}
    </svg>
  );
}
