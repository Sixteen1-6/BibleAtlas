// When each part of the Bible happened and when each book was written, in the
// words of the Tyndale Open Bible Dictionary (CC BY-SA 4.0).
//
// eras.json is built by crates/atlas-cli/src/eras.rs from config/eras.json;
// every quotation in it was checked word for word against the dictionary.
// Years are BC negative.

import { type Atlas, DATA_BASE } from './atlas';

export interface Cite {
  article: string;
  /** The article's title, e.g. "Israel, History of". */
  title: string;
  heading?: string;
}

/** Where one end of an era comes from: a chart row, or a label cut from a quotation. */
export interface DateSource {
  event?: string;
  chart?: string;
  label: string;
  quote?: string;
  cite?: Cite;
  /** A sentence of the era's own section that qualifies this year; the year is then approximate. */
  hedge?: string;
}

export interface DatedView {
  /** The dictionary's own phrase for whoever holds the view. */
  who?: string;
  label?: string;
  from?: number;
  to?: number;
  approx?: true;
  /** States no year: shown as text only, off the timeline. */
  relative?: true;
  /** The dictionary says the date cannot be known. */
  undated?: true;
  /** Set when the label gives a bare year or century of the BC era. */
  era?: 'BC';
  prefers?: true;
  prefersQuote?: string;
  quote: string;
  cite: Cite;
  /** Book views only: the chapters the view is about, as [first, last] pairs. Absent: the whole book. */
  chapters?: [number, number][];
}

export interface Era {
  id: string;
  name: string;
  from?: number;
  to?: number;
  approx?: true;
  /** The years written out ("930–722 BC") when both ends are dated. */
  label?: string;
  start?: DateSource;
  end?: DateSource;
  quote: string;
  cite: Cite;
  views?: DatedView[];
}

export interface EraRange {
  /** 0-based book. */
  book: number;
  from: number;
  to: number;
  /** Index into `eras`. */
  era: number;
  quote?: string;
  cite?: Cite;
  /** A row of a dictionary chart, in place of a quotation. */
  row?: { chart: string; header?: string[]; cells: string[] };
}

export interface BookDates {
  article: string;
  title: string;
  /** The views are stages of writing, not alternatives. */
  stages?: true;
  /** In display order: a preferred view first. */
  written: DatedView[];
}

export interface ChartEvent {
  chart: 'ot' | 'nt';
  event: string;
  from: number;
  to: number;
  label: string;
  approx?: true;
  alt?: [number, number];
  basis?: string;
  corrected?: string;
}

export interface Eras {
  format: number;
  source: { title: string; license: string; attribution: string; changes: string };
  eras: Era[];
  ranges: EraRange[];
  /** One entry per chapter: an index into `ranges`, or -1. */
  chapters: number[];
  books: BookDates[];
  chart: ChartEvent[];
}

let cache: Promise<Eras> | null = null;

/** Fetched once and cached; a failed fetch is tried again on a later chapter. */
export function loadEras(a: Atlas): Promise<Eras> {
  if (!cache) {
    const p = fetch(`${DATA_BASE}eras.json?${a.version}`)
      .then((r) => {
        if (!r.ok) throw new Error(`eras.json: HTTP ${r.status}`);
        return r.json() as Promise<Eras>;
      })
      .then((d) => {
        if (d.format !== 1 || !Array.isArray(d.chapters)) throw new Error('eras.json: unknown format');
        return d;
      });
    p.catch(() => {
      if (cache === p) cache = null;
    });
    cache = p;
  }
  return cache;
}

/** The era of a chapter (book 0-based, chapter 1-based), with the range that places it there. */
export function chapterEra(a: Atlas, data: Eras, book: number, chapter: number): { era: Era; index: number; range: EraRange } | null {
  const r = data.chapters[a.bookChapterStart[book] + chapter - 1];
  const range = r === undefined || r < 0 ? undefined : data.ranges[r];
  const era = range && data.eras[range.era];
  return range && era ? { era, index: range.era, range } : null;
}

export function bookDates(data: Eras, book: number): BookDates | null {
  return data.books[book] ?? null;
}

/** Every verse in the chapters assigned to an era, in canonical order. */
export function eraVerses(a: Atlas, data: Eras, eraIndex: number): Uint32Array {
  const spans: [number, number][] = [];
  for (const r of data.ranges) {
    if (r.era !== eraIndex) continue;
    const c = a.bookChapterStart[r.book];
    spans.push([a.chapterStart[c + r.from - 1], a.chapterStart[c + r.to]]);
  }
  spans.sort((x, y) => x[0] - y[0]);
  const out = new Uint32Array(spans.reduce((n, [s, e]) => n + e - s, 0));
  let k = 0;
  for (const [s, e] of spans) for (let v = s; v < e; v++) out[k++] = v;
  return out;
}

/** "930–722 BC", "AD 30–50", "6 BC – AD 30", "1446 BC", "AD 70". */
export function formatYears(from: number, to: number): string {
  if (from === to) return from < 0 ? `${-from} BC` : `AD ${from}`;
  if (to < 0) return `${-from}–${-to} BC`;
  if (from > 0) return `AD ${from}–${to}`;
  return `${-from} BC – AD ${to}`;
}

/**
 * A view's label as shown. A bare year or century gets its era the way the
 * dictionary writes it elsewhere ("about 1440 BC", "AD 56", "from AD 62 to
 * 64"), and a quotation mark the cut left without its partner is dropped
 * (Revelation: `at the close of Domitian’s reign” (AD 81–96)`).
 */
export function shownLabel(v: DatedView): string {
  let label = v.label ?? '';
  const open = label.split('“').length - 1;
  const close = label.split('”').length - 1;
  if (close > open) label = label.replace('”', '');
  else if (open > close) label = label.replace('“', '');
  if (v.era === 'BC') return `${label} BC`;
  const year = v.from ?? v.to;
  // Decades ("in the 60s") and ordinals ("first century") are left as they are.
  if (year !== undefined && year > 0 && !/\b(AD|BC)\b/.test(label)) label = label.replace(/\b(\d{1,4})\b/, 'AD $1');
  return label;
}

/** Whether a book's view is about this chapter: it names no chapters, or names this one. */
export function appliesTo(v: DatedView, chapter: number): boolean {
  return !v.chapters || v.chapters.some(([a, b]) => a <= chapter && chapter <= b);
}

/** A book's views of one chapter, in display order, and the views it gives other chapters. */
export function viewsFor(d: BookDates, chapter: number): { here: DatedView[]; elsewhere: DatedView[] } {
  const here: DatedView[] = [];
  const elsewhere: DatedView[] = [];
  for (const v of d.written) (appliesTo(v, chapter) ? here : elsewhere).push(v);
  return { here, elsewhere };
}

/** Longest "A or B" the line joins before it shows only the first view. */
const JOIN_MAX = 50;
/** Longest join of two dated views when the dictionary prefers neither. */
const LONG_MAX = 72;

const dated = (v: DatedView) => v.from !== undefined || v.to !== undefined;

/**
 * A label as the line shows it: an aside in parentheses that holds no year is
 * left for More ("before AD 70 (before his last teaching was forgotten) and
 * after AD 60" reads "before AD 70 and after AD 60").
 */
export function lineLabel(v: DatedView): string {
  return shownLabel(v)
    .replace(/\s*\([^()]*\)/g, (m) => (/\d/.test(m) ? m : ''))
    .trim();
}

/** A label without the years in parentheses at its end: "shortly after the reign of Nero (AD 54–68)". */
function withoutTail(label: string): string {
  return label.replace(/\s*\([^()]*\)\s*$/, '');
}

/**
 * The Written part of a chapter's line, from the views that are about that
 * chapter: the preferred (or first) one, a second one joined with "or" when
 * the two are short, and "(N views)" when the line shows fewer than all of
 * them. When the dictionary prefers neither of two dated views, both are
 * named even when long, without their parenthesized years, so that neither
 * reads as settled. Empty when no view is about the chapter.
 */
export function writtenSummary(d: BookDates, chapter: number): string {
  const w = viewsFor(d, chapter).here;
  const n = w.length;
  let text = '';
  let shown = 1;
  if (!n) return '';
  if (w[0].undated) text = 'date uncertain';
  else {
    text = lineLabel(w[0]);
    const second = w[1];
    if (second && !second.undated) {
      const next = lineLabel(second);
      let joined: string | null = null;
      if (d.stages) {
        if (n === 2 && w[0].from !== undefined && second.from !== undefined) joined = `${text} to ${next}`;
      } else if (`${text} or ${next}`.length <= JOIN_MAX) joined = `${text} or ${next}`;
      else if (!w.some((v) => v.prefers) && dated(w[0]) && dated(second)) joined = `${withoutTail(text)} or ${withoutTail(next)}`;
      if (joined && joined.length <= (d.stages ? JOIN_MAX : LONG_MAX)) {
        text = joined;
        shown = 2;
      }
    }
  }
  return n > shown ? `${text} (${n} views)` : text;
}

/** Whether an era's years can stand beside its name: no other view of them, no hedge, no number in the name. */
export function settledYears(e: Era): boolean {
  return !e.views?.length && !e.approx && e.from !== undefined && e.to !== undefined && !/\d/.test(e.name);
}

/** The When part of the line: the era's name, with its years only when they are not in question. */
export function eraSummary(e: Era): string {
  return settledYears(e) ? `${e.name} (${formatYears(e.from!, e.to!)})` : e.name;
}

/** A quotation as shown: an ellipsis where it starts or stops mid-sentence. */
export function excerpt(q: string): string {
  const head = /^[a-z]/.test(q) ? '…' : '';
  const tail = /[.?!]["”’)]*$/.test(q) ? '' : '…';
  return `${head}${q}${tail}`;
}
