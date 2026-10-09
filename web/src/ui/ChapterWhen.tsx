// One quiet line after a chapter's last verse: when its events happened and
// when its book was written, in the words of the Tyndale Open Bible Dictionary.
// "More" opens in layers: the timeline and the map button first, then the era
// and each dating view in a line or two, and one more tap, "Sources and
// evidence", for every citation, the chart rows and why each chapter sits
// where it does.

import { Fragment } from 'preact';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Atlas } from '../data/atlas';
import {
  type BookDates,
  type Cite,
  type DatedView,
  type Era,
  type EraRange,
  type Eras,
  appliesTo,
  bookDates,
  chapterEra,
  eraSummary,
  eraVerses,
  excerpt,
  formatYears,
  lineLabel,
  loadEras,
  settledYears,
  shownLabel,
  viewsFor,
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
  const here = `${book}:${chapter}`;

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
  // Leaving a chapter closes its panel, so it is closed again on coming back.
  useEffect(() => setOpenAt((o) => (o === here ? o : null)), [here]);

  if (!ready || !data) return null;
  const dates = bookDates(data, book);
  const placed = chapterEra(a, data, book, chapter);
  const written = dates ? writtenSummary(dates, chapter) : '';
  if (!placed && !written) return null;
  const open = openAt === here;

  return (
    <>
      <p class="tp-when">
        {placed && <span class="tp-part">When: {eraSummary(placed.era)}</span>}
        {placed && written && <span aria-hidden="true"> · </span>}
        {written && <span class="tp-part">Written: {written}</span>}
        <button class="tp-more" aria-expanded={open} aria-controls={`${id}-more`} onClick={() => setOpenAt(open ? null : here)}>
          {open ? 'Less' : 'More'}
          <span class="sr-only"> about when this chapter happened and was written</span>
        </button>
      </p>
      {open && <More id={`${id}-more`} a={a} data={data} book={book} chapter={chapter} placed={placed} dates={dates} />}
    </>
  );
}

type Placed = { era: Era; index: number; range: EraRange } | null;

function More({ id, a, data, book, chapter, placed, dates }: { id: string; a: Atlas; data: Eras; book: number; chapter: number; placed: Placed; dates: BookDates | null }) {
  const { here, elsewhere } = dates ? viewsFor(dates, chapter) : { here: [], elsewhere: [] };
  // The views about this chapter first, then those the dictionary gives other chapters.
  const written = groups([...here, ...elsewhere]);
  return (
    <div class="tp-panel" id={id}>
      <p class="tp-frame">{FRAMING}</p>
      <Timeline a={a} data={data} book={book} current={placed?.index ?? -1} written={here} />
      {placed && <MapButton a={a} data={data} era={placed.era} index={placed.index} />}
      {placed && (
        <section class="tp-sec">
          <h3 class="tp-h">When it happened</h3>
          <EraBlock era={placed.era} />
        </section>
      )}
      {written.length > 0 && (
        <section class="tp-sec">
          <h3 class="tp-h">When it was written</h3>
          <Views a={a} book={book} chapter={chapter} items={written} />
        </section>
      )}
      <Evidence a={a} placed={placed} written={written} />
      {/* On a phone the sources list lives in the study pane: show it there. */}
      <div onClick={(e) => (e.target as HTMLElement).closest('.provenance button') && (S.mobilePane.value = 'study')}>
        <Provenance work="tyndale-tbd">Adapted from the Tyndale Open Bible Dictionary (Tyndale House Publishers, CC BY-SA 4.0). Quotations are word for word; the choice of era for each chapter is this app's.</Provenance>
      </div>
    </div>
  );
}

function CiteLine({ c, chart, lead }: { c?: Cite; chart?: string; lead?: string }) {
  return (
    <p class="tp-cite">
      {lead && <span class="tp-key">{lead} · </span>}
      {DICTIONARY}, {chart ? <>chart “{chart}”</> : c && <>“{c.title}”{c.heading && <> › {c.heading}</>}</>}
    </p>
  );
}

/** "who: label", both in the dictionary's words. */
function ViewLabel({ v }: { v: DatedView }) {
  return (
    <>
      {v.who && <span class="tp-who">{v.who}: </span>}
      <b>{shownLabel(v)}</b>
    </>
  );
}

/** The era, its one quotation, and the other dates the dictionary gives it, one line each. */
function EraBlock({ era }: { era: Era }) {
  const views = era.views ?? [];
  return (
    <>
      <p class="tp-era">
        {era.name}
        {settledYears(era) && <span class="tp-years"> · {formatYears(era.from!, era.to!)}</span>}
      </p>
      <blockquote class="tp-q">“{excerpt(era.quote)}”</blockquote>
      {views.length > 0 && (
        <ul class="tp-lines">
          {views.map((v, i) => (
            <li key={i}>
              <ViewLabel v={v} />
              {v.prefers && <span class="tp-pref"> The dictionary prefers this view.</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** "Chapters 9–14", "Psalm 137", "Psalms 107, 126". */
function chaptersName(a: Atlas, book: number, pairs: [number, number][]): string {
  const count = pairs.reduce((n, [x, y]) => n + y - x + 1, 0);
  const unit = a.books[book].osis === 'Ps' ? (count === 1 ? 'Psalm' : 'Psalms') : count === 1 ? 'Chapter' : 'Chapters';
  return `${unit} ${pairs.map(([x, y]) => (x === y ? `${x}` : `${x}–${y}`)).join(', ')}`;
}

/** Views quoting the same sentence are shown together, where the first of them stands. */
function groups(views: DatedView[]): DatedView[][] {
  const out: DatedView[][] = [];
  for (const v of views) {
    const same = out.find(([w]) => w.quote === v.quote && w.cite.article === v.cite.article && w.cite.heading === v.cite.heading);
    if (same) same.push(v);
    else out.push([v]);
  }
  return out;
}

/**
 * Each dating view: its label and its quotation. Views about this chapter come
 * first; views the dictionary gives other chapters of the book follow, marked
 * with those chapters.
 */
function Views({ a, book, chapter, items }: { a: Atlas; book: number; chapter: number; items: DatedView[][] }) {
  const [all, setAll] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const shown = all ? items : items.slice(0, FEW);
  const hidden = items.slice(shown.length).reduce((n, g) => n + g.length, 0);
  // The button goes away once pressed: keep the reader's place on the first view it revealed.
  useEffect(() => {
    if (all) (list.current?.children[FEW] as HTMLElement | undefined)?.focus();
  }, [all]);
  return (
    <>
      <ul class="tp-views" ref={list}>
        {shown.map((g, i) => (
          <li class="tp-view" key={i} tabIndex={i >= FEW ? -1 : undefined}>
            {g.map((v, j) => (
              <Fragment key={j}>
                {v.chapters && !appliesTo(v, chapter) && <p class="tp-chs">{chaptersName(a, book, v.chapters)}</p>}
                {!v.undated && (
                  <p class="tp-vlabel">
                    <ViewLabel v={v} />
                  </p>
                )}
              </Fragment>
            ))}
            <blockquote class="tp-q">“{excerpt(g[0].quote)}”</blockquote>
            {g.some((v) => v.prefers) && <p class="tp-pref">The dictionary prefers this view.</p>}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button class="tp-more tp-show" onClick={() => setAll(true)}>
          Show {hidden} more {hidden === 1 ? 'view' : 'views'}
          <span class="sr-only"> of when this book was written</span>
        </button>
      )}
    </>
  );
}

/** One tap deeper: where every quotation comes from, the chart rows behind the era's years, and why this chapter is in the era. */
function Evidence({ a, placed, written }: { a: Atlas; placed: Placed; written: DatedView[][] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const era = placed?.era;
  return (
    <div class="tp-evidence">
      <button class="tp-more tp-evbtn" aria-expanded={open} aria-controls={`${id}-ev`} onClick={() => setOpen(!open)}>
        Sources and evidence
      </button>
      {open && (
        <div class="tp-ev" id={`${id}-ev`}>
          {placed && era && (
            <section class="tp-evsec">
              <h4 class="tp-h">When it happened</h4>
              <CiteLine c={era.cite} lead={era.name} />
              <Ends era={era} />
              {groups(era.views ?? []).map((g, i) => (
                <div class="tp-evview" key={i}>
                  {g.map((v, j) => (
                    <p class="tp-vlabel" key={j}>
                      <ViewLabel v={v} />
                    </p>
                  ))}
                  <blockquote class="tp-q">“{excerpt(g[0].quote)}”</blockquote>
                  <Preference views={g} />
                  <CiteLine c={g[0].cite} />
                </div>
              ))}
              <Why a={a} range={placed.range} />
            </section>
          )}
          {written.length > 0 && (
            <section class="tp-evsec">
              <h4 class="tp-h">When it was written</h4>
              {written.map((g, i) => (
                <Fragment key={i}>
                  <Preference views={g} />
                  <CiteLine c={g[0].cite} lead={evidenceKey(g)} />
                </Fragment>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/** What a citation in the evidence is for: the views' labels, or the opening words of an undated view's quotation. */
function evidenceKey(g: DatedView[]): string {
  const labels = g.filter((v) => !v.undated).map(lineLabel);
  if (labels.length) return labels.join('; ');
  const words = g[0].quote.split(' ');
  return `“${words.slice(0, 7).join(' ')}${words.length > 7 ? ' …' : ''}”`;
}

/** The dictionary's own words for its preference, when the view's quotation does not already hold them. */
function Preference({ views }: { views: DatedView[] }) {
  const pref = views.find((v) => v.prefers);
  if (!pref?.prefersQuote || views[0].quote.includes(pref.prefersQuote)) return null;
  return <p class="tp-pref">The dictionary prefers this view: “{excerpt(pref.prefersQuote)}”</p>;
}

/** Where the era's years come from: a row of a date chart, or a label in a quotation, and any sentence that qualifies them. */
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
            {s.hedge && <span class="tp-hedge"> “{excerpt(s.hedge)}”</span>}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

function Why({ a, range }: { a: Atlas; range: EraRange }) {
  const b = a.books[range.book];
  const where = `${b.name} ${range.from === range.to ? range.from : `${range.from}–${range.to}`}`;
  return (
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
  );
}

function MapButton({ a, data, era, index }: { a: Atlas; data: Eras; era: Era; index: number }) {
  const label = `era:${era.id}`;
  const on = S.marks.value?.label === label;
  const toggle = async () => {
    if (on) {
      if (S.marks.value?.label === label) {
        S.marks.value = null;
        S.groupEdges.value = null;
      }
      return;
    }
    const verses = eraVerses(a, data, index);
    // The era takes the map over, as a theme and a path do from each other.
    S.theme.value = null;
    S.path.value = null;
    S.selected.value = null;
    S.groupEdges.value = null;
    S.marks.value = { verses, label };
    // The Wheel does not draw marks.
    if (S.mapMode.value === 'wheel') S.mapMode.value = 'arcs';
    // The links among the era's verses make even a short era easy to find.
    const edges = await S.engine.value?.linksWithin(a.n, verses, 2);
    if (edges && S.marks.value?.label === label) {
      S.groupEdges.value = { edges, label: `${era.name}: ${edges.length.toLocaleString()} links between ${verses.length.toLocaleString()} verses` };
    }
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
/** Baseline of the current era's name, above its band. */
const NAME_Y = 9;
const BAND_Y = 12;
const BAND_H = 14;
const ROW_STEP = 6;
const MAX_ROWS = 4;
/** Rough width of one 10 px character, to keep labels inside the picture. */
const CHAR_W = 5.6;

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

/** The width the picture has on screen, so labels can be fitted inside it. */
function useWidth<T extends Element>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function Timeline({ a, data, book, current, written }: { a: Atlas; data: Eras; book: number; current: number; written: DatedView[] }) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [ref, width] = useWidth<SVGSVGElement>();
  const nt = a.books[book].testament === 'NT';
  const ax = nt ? AXES.NT : AXES.OT;
  const span = ax.hi - ax.lo;
  const x = (y: number) => LEFT + ((Math.min(Math.max(y, ax.lo), ax.hi) - ax.lo) / span) * (RIGHT - LEFT);
  const px = (pct: number) => (pct / 100) * width;
  const fadeLen = span * 0.12;
  // Years the era's own section hedges read "about" here; the line leaves them out.
  const titled = (e: Era) => `${e.name}${e.from !== undefined && e.to !== undefined ? `, ${e.approx ? 'about ' : ''}${formatYears(e.from, e.to)}` : ''}`;
  const viewTitle = (v: DatedView) => `${v.who ? `${v.who}: ` : ''}${shownLabel(v)}`;
  const onAxis = (b: Bar | null): b is Bar => b !== null && b.to >= ax.lo && b.from <= ax.hi;

  // The eras of this testament in time order, and eras without chapters as thin lanes.
  const testamentOf = new Map<number, boolean>();
  for (const r of data.ranges) testamentOf.set(r.era, a.books[r.book].testament === 'NT');
  const main: { i: number; e: Era }[] = [];
  const laneEras: { i: number; e: Era }[] = [];
  data.eras.forEach((e, i) => {
    if (e.from === undefined && e.to === undefined) return;
    const t = testamentOf.get(i);
    if (t === undefined) laneEras.push({ i, e });
    else if (t === nt) main.push({ i, e });
  });
  const start = (e: Era) => e.from ?? e.to! - fadeLen;
  main.sort((p, q) => start(p.e) - start(q.e));
  // An open end fades toward the next era and stops where that era starts;
  // two open ends that face each other share the gap between them.
  const bands = main
    .map(({ i, e }, k) => {
      const b = bar(e.from, e.to, fadeLen, titled(e))!;
      const prev = main[k - 1]?.e;
      const next = main[k + 1]?.e;
      if (b.fade === 'right' && next) b.to = Math.max(b.from, Math.min(b.to, next.from ?? (b.from + next.to!) / 2));
      if (b.fade === 'left' && prev) b.from = Math.min(b.to, Math.max(b.from, prev.to ?? (prev.from! + b.to) / 2));
      return { i, e, b };
    })
    .filter(({ b }) => onAxis(b));
  const lanes = laneEras.map(({ i, e }) => ({ i, e, b: bar(e.from, e.to, span, titled(e)) })).filter((l): l is { i: number; e: Era; b: Bar } => onAxis(l.b));
  const order = [...bands.filter((x) => x.i !== current), ...bands.filter((x) => x.i === current)];
  const cur = bands.find((x) => x.i === current) ?? null;

  // The current era's other dated views, just under its band.
  const eraViews = (cur?.e.views ?? []).map((v) => bar(v.from, v.to, fadeLen, viewTitle(v))).filter(onAxis);
  // Rows under the bands, each only when it has something to draw.
  let below = BAND_Y + BAND_H + 2;
  const viewY = below;
  if (eraViews.length) below += 5;
  const laneY = below;
  if (lanes.length) below += 5;
  // Room above the first written row for its label.
  const rowY = below + 4;

  const rows = written
    .map((v) => ({ v, b: bar(v.from, v.to, fadeLen, viewTitle(v)) }))
    .filter((w): w is { v: DatedView; b: Bar } => w.b !== null)
    .slice(0, MAX_ROWS);
  const axisY = rowY + Math.max(1, rows.length) * ROW_STEP + 2;
  const height = axisY + 16;
  const ticks: number[] = [];
  for (let y = Math.ceil((ax.lo + 1) / ax.step) * ax.step; y < ax.hi; y += ax.step) if (y !== 0) ticks.push(y);

  const aria = [
    `Timeline, ${ax.name}.`,
    `Eras: ${[...bands, ...lanes].map((x) => x.b.title).join('; ')}.`,
    cur ? `This chapter: ${eraSummary(cur.e)}.` : '',
    eraViews.length ? `Other dates for this era: ${eraViews.map((b) => b.title).join('; ')}.` : '',
    rows.length ? `Written: ${rows.map((w) => w.b.title).join('; ')}.` : '',
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
        <rect class={cls} x={`${x0}%`} width={`${w}%`} y={y} height={h} rx={2} style={b.fade ? `fill:url(#${id});stroke:url(#${id})` : undefined}>
          <title>{b.title}</title>
        </rect>
      </Fragment>
    );
  };

  // Text labels, placed in pixels once the width is known, and left out where they would not fit.
  let name: preact.JSX.Element | null = null;
  if (cur && width) {
    const tw = cur.e.name.length * CHAR_W;
    const mid = px((x(cur.b.from) + x(cur.b.to)) / 2);
    name = (
      <text class="tp-name" x={Math.max(0, Math.min(mid - tw / 2, width - tw))} y={NAME_Y} aria-hidden="true">
        {cur.e.name}
      </text>
    );
  }
  let lead: preact.JSX.Element | null = null;
  if (rows.length && width) {
    const { v, b } = rows[0];
    const text = lineLabel(v);
    const tw = text.length * CHAR_W;
    const x0 = px(x(b.from));
    const x1 = Math.max(px(x(b.to)), x0 + 2);
    if (x1 + 5 + tw <= width)
      lead = (
        <text class="tp-wlabel" x={x1 + 5} y={rowY + 4} aria-hidden="true">
          {text}
        </text>
      );
    else if (x0 - 5 - tw >= px(LEFT))
      lead = (
        <text class="tp-wlabel" x={x0 - 5} y={rowY + 4} text-anchor="end" aria-hidden="true">
          {text}
        </text>
      );
  }

  return (
    <svg ref={ref} class="tp-time" width="100%" height={height} role="img" aria-label={aria}>
      {name}
      <text class="tp-rowname" x="0" y={BAND_Y + BAND_H - 3}>
        Eras
      </text>
      {order.map(({ i, b }, k) => rect(b, BAND_Y, BAND_H, `tp-band${i === current ? ' cur' : k % 2 ? ' alt' : ''}`, `e${i}`, i === current ? ' cur' : ''))}
      {eraViews.map((b, k) => rect(b, viewY, 3, 'tp-eview', `v${k}`, ' w'))}
      {lanes.map(({ i, b }) => rect(b, laneY, 3, 'tp-band tp-lane', `l${i}`))}
      {rows.length > 0 && (
        <text class="tp-rowname" x="0" y={rowY + 5}>
          Written
        </text>
      )}
      {rows.map(({ v, b }, k) => rect(b, rowY + k * ROW_STEP, 4, `tp-wbar${k === 0 || v.prefers ? ' first' : ''}`, `w${k}`, ' w'))}
      {lead}
      <line class="tp-axis" x1={`${LEFT}%`} x2={`${RIGHT}%`} y1={axisY} y2={axisY} />
      {ticks.map((y) => (
        <text key={y} class="tp-label" x={`${x(y)}%`} y={axisY + 12} text-anchor="middle">
          {formatYears(y, y)}
        </text>
      ))}
    </svg>
  );
}
