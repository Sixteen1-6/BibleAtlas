// Loads the build output and exposes it as typed-array views.
//
// atlas.bin is an `.atlas` container (see crates/atlas-core/src/container.rs):
// every section is 8-byte aligned, so each one becomes a typed array view over
// the fetched ArrayBuffer with no parsing and no copying.

export interface BookMeta {
  osis: string;
  step: string;
  name: string;
  testament: 'OT' | 'NT';
  genre: string;
  start: number;
  chapters: number[];
}

export interface SourceMeta {
  id: string;
  title: string;
  provides: string;
  license: string;
  attribution: string;
  homepage: string;
  repo: string;
  commit: string;
  note?: string | null;
  files: { path: string; sha256: string; bytes: number }[];
}

export interface Meta {
  format: number;
  buildId: string;
  counts: Record<string, number>;
  unmapped: Record<string, number>;
  pagerank: { damping: number; iterations: number };
  lexShard: number;
  flags: { aramaic: number; otherEditionsOnly: number; variant: number; significant: number };
  books: BookMeta[];
  sources: SourceMeta[];
  sections: { name: string; type: string; count: number }[];
  files: Record<string, { bytes: number; sha256: string }>;
}

export interface Lemmas {
  key: string[];
  word: string[];
  translit: string[];
  gloss: string[];
  /** One character per root: H (Hebrew), A (Aramaic), G (Greek). */
  lang: string;
  count: number[];
}

export interface Theme {
  id: string;
  name: string;
  blurb: string;
  roots: number[];
}

export interface Atlas {
  meta: Meta;
  books: BookMeta[];
  /** Verse count. */
  n: number;
  /** First chapter index of each book (len books + 1). */
  bookChapterStart: Uint32Array;
  /** First verse index of each chapter (len chapters + 1). */
  chapterStart: Uint32Array;
  verseBook: Uint8Array;
  /** PageRank normalized so the top verse is 1. */
  rank: Float32Array;
  degree: Uint32Array;
  xOff: Uint32Array;
  xDst: Uint32Array;
  xSpan: Uint16Array;
  xVotes: Int16Array;
  /** Source verse of each edge (derived). */
  xSrc: Uint32Array;
  /** Incoming edges per verse (derived CSR): xInEdge[xInOff[v]..xInOff[v+1]]. */
  xInOff: Uint32Array;
  xInEdge: Uint32Array;
  bookFlow: Uint32Array;
  lOff: Uint32Array;
  lVerse: Uint32Array;
  lPos: Uint16Array;
  eOff: Uint32Array;
  eVerse: Uint32Array;
  lemmas: Lemmas;
  englishWords: string[];
  themes: Theme[];
  /** Appended to data URLs so a new build is never served from a stale cache. */
  version: string;
}

const CTORS = {
  u8: Uint8Array,
  u16: Uint16Array,
  u32: Uint32Array,
  i16: Int16Array,
  f32: Float32Array,
  i32: Int32Array,
} as const;
type DT = keyof typeof CTORS;
const DT_BY_CODE: DT[] = ['u8', 'u16', 'u32', 'i16', 'f32', 'i32'];

export function readContainer(buf: ArrayBuffer): Map<string, ArrayBufferView> {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'ATLS') throw new Error('atlas.bin is not an atlas container');
  if (dv.getUint32(4, true) !== 1) throw new Error(`unsupported atlas.bin version ${dv.getUint32(4, true)}`);
  const n = dv.getUint32(8, true);
  const out = new Map<string, ArrayBufferView>();
  for (let i = 0; i < n; i++) {
    const at = 16 + i * 32;
    let name = '';
    for (let j = 0; j < 16; j++) {
      const c = dv.getUint8(at + j);
      if (!c) break;
      name += String.fromCharCode(c);
    }
    const dt = DT_BY_CODE[dv.getUint32(at + 16, true)];
    const count = dv.getUint32(at + 20, true);
    const offset = dv.getUint32(at + 24, true);
    out.set(name, new CTORS[dt](buf, offset, count));
  }
  return out;
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export const DATA_BASE = `${import.meta.env.BASE_URL}data/`;

export async function loadAtlas(onProgress?: (msg: string) => void): Promise<Atlas> {
  onProgress?.('Reading the build manifest');
  const meta = await getJson<Meta>(`${DATA_BASE}meta.json?t=${Date.now()}`);
  const v = `v=${meta.buildId}`;
  onProgress?.('Loading 344,000 cross-references');
  const [bin, lemmas, englishWords, themes] = await Promise.all([
    fetch(`${DATA_BASE}atlas.bin?${v}`).then((r) => {
      if (!r.ok) throw new Error(`atlas.bin: HTTP ${r.status}`);
      return r.arrayBuffer();
    }),
    getJson<Lemmas>(`${DATA_BASE}lemmas.json?${v}`),
    getJson<string[]>(`${DATA_BASE}words.json?${v}`),
    getJson<Theme[]>(`${DATA_BASE}themes.json?${v}`),
  ]);
  const s = readContainer(bin);
  const get = <T extends ArrayBufferView>(name: string) => {
    const a = s.get(name);
    if (!a) throw new Error(`atlas.bin has no section ${name}`);
    return a as T;
  };
  const xOff = get<Uint32Array>('x_off');
  const n = xOff.length - 1;
  const xSrc = new Uint32Array(xOff[n]);
  for (let vtx = 0; vtx < n; vtx++) xSrc.fill(vtx, xOff[vtx], xOff[vtx + 1]);
  // Reverse index so a verse also lists the passages that point at it.
  const xDst = get<Uint32Array>('x_dst');
  const xInOff = new Uint32Array(n + 1);
  for (let e = 0; e < xDst.length; e++) xInOff[xDst[e] + 1]++;
  for (let i = 0; i < n; i++) xInOff[i + 1] += xInOff[i];
  const cursor = xInOff.slice(0, n);
  const xInEdge = new Uint32Array(xDst.length);
  for (let e = 0; e < xDst.length; e++) xInEdge[cursor[xDst[e]]++] = e;
  return {
    xInOff,
    xInEdge,
    meta,
    books: meta.books,
    n,
    bookChapterStart: get('vz_bchap'),
    chapterStart: get('vz_chap'),
    verseBook: get('v_book'),
    rank: get('v_rank'),
    degree: get('v_degree'),
    xOff,
    xDst: get('x_dst'),
    xSpan: get('x_span'),
    xVotes: get('x_votes'),
    xSrc,
    bookFlow: get('b_flow'),
    lOff: get('l_off'),
    lVerse: get('l_verse'),
    lPos: get('l_pos'),
    eOff: get('e_off'),
    eVerse: get('e_verse'),
    lemmas,
    englishWords,
    themes,
    version: v,
  };
}

// ---------------------------------------------------------------- references

export interface Loc {
  book: number;
  chapter: number;
  verse: number;
}

/** Largest i with arr[i] <= x. */
function floorIndex(arr: Uint32Array, x: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arr[mid] <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function locate(a: Atlas, v: number): Loc {
  const c = floorIndex(a.chapterStart, v);
  const b = a.verseBook[v];
  return { book: b, chapter: c - a.bookChapterStart[b] + 1, verse: v - a.chapterStart[c] + 1 };
}

export function verseIndex(a: Atlas, book: number, chapter: number, verse: number): number {
  const c = a.bookChapterStart[book] + chapter - 1;
  return a.chapterStart[c] + verse - 1;
}

export function chapterRange(a: Atlas, book: number, chapter: number): [number, number] {
  const c = a.bookChapterStart[book] + chapter - 1;
  return [a.chapterStart[c], a.chapterStart[c + 1]];
}

/** A book's name before a chapter number: "Psalm 23", not "Psalms 23". */
export function chapterName(b: BookMeta): string {
  return b.osis === 'Ps' ? 'Psalm' : b.name;
}

/** How many passages a verse is linked to: a two-way link counts once, and links
 * readers voted down (zero or fewer net votes) are left out. */
export function linkCount(a: Atlas, v: number): number {
  const seen = new Set<number>();
  for (let e = a.xOff[v]; e < a.xOff[v + 1]; e++) if (a.xVotes[e] > 0) seen.add(a.xDst[e]);
  for (let i = a.xInOff[v]; i < a.xInOff[v + 1]; i++) {
    const e = a.xInEdge[i];
    if (a.xVotes[e] > 0) seen.add(a.xSrc[e]);
  }
  return seen.size;
}

export function label(a: Atlas, v: number, short = false): string {
  const l = locate(a, v);
  const b = a.books[l.book];
  return `${short ? shortName(b) : chapterName(b)} ${l.chapter}:${l.verse}`;
}

export function rangeLabel(a: Atlas, v: number, span: number): string {
  if (span <= 1) return label(a, v);
  const s = locate(a, v);
  const e = locate(a, v + span - 1);
  const b = a.books[s.book];
  if (s.book !== e.book) return `${label(a, v)} – ${label(a, v + span - 1)}`;
  if (s.chapter !== e.chapter) return `${chapterName(b)} ${s.chapter}:${s.verse}–${e.chapter}:${e.verse}`;
  return `${chapterName(b)} ${s.chapter}:${s.verse}–${e.verse}`;
}

export function shortName(b: BookMeta): string {
  return b.osis.replace(/^(\d)/, '$1 ');
}

/** Iterate the edges leaving verse v (strongest first). */
export function edgesFrom(a: Atlas, v: number): [number, number] {
  return [a.xOff[v], a.xOff[v + 1]];
}

/** All verses that contain a root, in canonical order (deduplicated). */
export function versesWithRoot(a: Atlas, root: number): Uint32Array {
  const s = a.lOff[root];
  const e = a.lOff[root + 1];
  const out: number[] = [];
  for (let i = s; i < e; i++) {
    const v = a.lVerse[i];
    if (out[out.length - 1] !== v) out.push(v);
  }
  return Uint32Array.from(out);
}

export const LANG_NAME: Record<string, string> = { H: 'Hebrew', A: 'Aramaic', G: 'Greek' };
