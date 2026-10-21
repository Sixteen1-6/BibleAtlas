// The data behind "How it is written": parallel lines, figures of speech and
// two people set side by side, as crates/atlas-cli/src/extra_figures.rs writes
// them from config/figures/<Book>.json. The index (extras/figures.json) holds
// the forms and one character per verse; a book's notes are in
// extras/figures/<Book>.<k>.json and load the first time a verse of that part
// is shown. note() reads them through a signal, so the line appears as soon
// as its part has arrived.

import { type Signal, signal } from '@preact/signals';
import { type Atlas, locate } from '../../../data/atlas';
import * as S from '../../../state';
import { loadJson } from '../data';
import type { VerseRef } from '../types';

/** The panel's source line, and its closed state's. */
export const SOURCE = 'From the Christian writers named in each note. Bible text: the BSB. Hebrew and Greek: STEPBible (CC BY 4.0).';

export type Kind = 'parallelism' | 'figure' | 'contrast';
export type Strength = 'widely agreed' | 'commonly held' | 'some interpreters';

/** A form's own definition, in its source's words. */
export interface Defined {
  quote: string;
  /** The work and page: "Figures of Speech Used in the Bible (1898), Antithetic, or Opposite, p. 351". */
  at: string;
  url: string;
}

export interface Form {
  kind: Kind;
  /** The plain name: "Opposite lines". */
  label: string;
  /** One plain sentence on what the form is. */
  about: string;
  /** The source's own term: "Antithetic parallelism". */
  term: string;
  defined?: Defined;
}

export interface Line {
  v: VerseRef;
  /** The BSB words of the line, exactly. */
  t: string;
  /** Where t starts in verse v's BSB text (UTF-16 units). */
  at: number;
  /** A, B, C, C', B', A' for a mirror; A, B, A', B' for lines that take turns. */
  mark?: string;
}

export interface Side {
  who: string;
  /** A few plain words on this side. */
  label?: string;
  s: VerseRef;
  e: VerseRef;
  /** BSB words from s..e that show it. */
  t?: string;
}

export interface Cite {
  name: string;
  on?: string;
  at?: string;
  url?: string;
  /** The writer's own words, checked against his text. */
  quote?: string;
}

export interface Note {
  id: string;
  kind: Kind;
  form: string;
  /** The verses the note sits under. */
  v: VerseRef;
  end: VerseRef;
  strength: Strength;
  /** The line under the verse. */
  short: string;
  /** One or two plain sentences: what the writers below say. */
  about: string;
  lines?: Line[];
  /** Words in different lines that answer each other. */
  pairs?: [string, string][];
  figure?: { name: string; part?: string; words: string; means: string; v: VerseRef; at: number };
  sides?: Side[];
  defined?: Defined;
  hebrew?: { note: string; strong: string[] };
  evidence?: string;
  /** Where the writers part ways, or what the note does not claim. */
  limit?: string;
  cites: Cite[];
}

interface IndexFile {
  format: number;
  forms: Record<string, Form>;
  /** One character per verse: '0' plus 1 parallel lines, 2 a figure, 4 two people. */
  has: string;
  /** Each book's part files, as the first chapter of each. */
  parts: number[][];
}

interface PartFile {
  format: number;
  notes: Note[];
}

type Part = PartFile | 'loading' | 'failed';

export interface Data {
  a: Atlas;
  forms: Record<string, Form>;
  has: string;
  parts: number[][];
  /** Part files by name, as they arrive. */
  files: Signal<ReadonlyMap<string, Part>>;
}

export async function load(a: Atlas): Promise<Data> {
  const f = await loadJson<IndexFile>(a, 'extras/figures.json');
  const d: Data = { a, forms: f.forms, has: f.has, parts: f.parts, files: signal<ReadonlyMap<string, Part>>(new Map()) };
  // The selected verse's notes come with the index, so a link to its panel
  // finds them there and does not close for want of them.
  const v = S.selected.peek();
  const name = v === null ? null : partOf(d, v);
  if (name) {
    fetchPart(d, name);
    await loadJson(a, name).catch(() => {});
  }
  return d;
}

/** The part file that holds a verse's notes, or null when it has none. */
function partOf(d: Data, verse: VerseRef): string | null {
  if (((d.has.charCodeAt(verse) || 48) - 48) === 0) return null;
  const l = locate(d.a, verse);
  const starts = d.parts[l.book] ?? [];
  let k = -1;
  for (let i = 0; i < starts.length && starts[i] <= l.chapter; i++) k = i;
  return k < 0 ? null : `extras/figures/${d.a.books[l.book].osis}.${k}.json`;
}

function fetchPart(d: Data, name: string): void {
  const put = (p: Part) => {
    const next = new Map(d.files.peek());
    next.set(name, p);
    d.files.value = next;
  };
  put('loading');
  loadJson<PartFile>(d.a, name).then(
    (f) => put(f && Array.isArray(f.notes) ? f : 'failed'),
    () => put('failed'),
  );
}

/** Kinds shown first: two people, then lines, then figures. */
const KIND_ORDER: Record<Kind, number> = { contrast: 0, parallelism: 1, figure: 2 };

/** The notes on a verse, or null while its part loads. Reading it subscribes
 * the caller to the part's arrival; the first read starts the download. */
export function notesAt(d: Data, verse: VerseRef): Note[] | null {
  const name = partOf(d, verse);
  if (!name) return [];
  const got = d.files.value.get(name);
  if (got === undefined) {
    // Not during a render: start it just after.
    queueMicrotask(() => d.files.peek().has(name) || fetchPart(d, name));
    return null;
  }
  if (got === 'loading') return null;
  if (got === 'failed') return [];
  return got.notes
    .filter((n) => n.v <= verse && verse <= n.end && usable(d, n))
    .sort((x, y) => KIND_ORDER[x.kind] - KIND_ORDER[y.kind]);
}

/** Nothing opens empty: a note shows only with a form, a writer's words, and
 * the words its kind is drawn from. */
function usable(d: Data, n: Note): boolean {
  if (!d.forms[n.form] || !n.short || !n.about) return false;
  if (!n.cites.some((c) => c.quote)) return false;
  if (n.kind === 'parallelism') return (n.lines?.length ?? 0) >= 2;
  if (n.kind === 'figure') return !!n.figure?.words;
  return (n.sides?.length ?? 0) === 2;
}

/** The line under a verse: the first note's own line, and how many more. */
export function lineAt(d: Data, verse: VerseRef): string | null {
  const ns = notesAt(d, verse);
  if (!ns || !ns.length) return null;
  const more = ns.length - 1;
  return more ? `${ns[0].short}, and ${more} more here` : ns[0].short;
}

/** The same writer under two works counts once: Bullinger's two books, and
 * Matthew Henry's commentary and its Concise abridgement. */
function writerOf(name: string): string {
  if (/bullinger|companion bible/i.test(name)) return 'bullinger';
  if (/matthew henry/i.test(name)) return 'henry';
  return name.toLowerCase();
}

/** The number of different writers a note cites. */
export function writerCount(n: Note): number {
  return new Set(n.cites.map((c) => writerOf(c.name))).size;
}

/** A Strong's number ("H1870", "G3162") to the app's root indices. */
export function rootsFor(a: Atlas, strong: readonly string[]): number[] {
  const want = new Set(strong.map((s) => s.toUpperCase()));
  const out: number[] = [];
  a.lemmas.key.forEach((k, i) => {
    if (want.has(k) || want.has(k.replace(/[A-Z]$/, ''))) out.push(i);
  });
  return out;
}
