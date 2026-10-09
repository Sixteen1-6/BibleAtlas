// The Sources shelf: every work the app draws on or cites (shelf.json, which
// crates/atlas-cli/src/shelf.rs writes from config/shelf.json and
// sources.json), and the two public-domain Bible dictionaries the app can
// show in full (dict/<id>/). Nothing loads until the shelf, a dictionary or a
// citation needs it; each file is fetched once.

import { useEffect, useState } from 'preact/hooks';
import { type Atlas, DATA_BASE } from './atlas';

export type License = 'public-domain' | 'cc-by-4.0' | 'cc-by-sa-4.0' | 'copyrighted';

/** Each license in plain words. */
export const LICENSE_WORDS: Record<License, string> = {
  'public-domain': 'Free to read and share (public domain)',
  'cc-by-4.0': 'Free to share with credit (CC BY 4.0)',
  'cc-by-sa-4.0': 'Free to share with credit, on the same terms (CC BY-SA 4.0)',
  copyrighted: 'Copyrighted: cited here, not copied',
};

/** A work's license in plain words, or its own words when the build could
 * not tell which license they name (a plain card for a new dataset). */
export function licenseWords(w: Work): string {
  return (LICENSE_WORDS as Record<string, string | undefined>)[w.license] ?? w.license;
}

export interface ShelfGroup {
  id: string;
  name: string;
}

/** A place the app cites a work: a verse or passage, and which notes cite it. */
export interface Cited {
  verse: number;
  to?: number;
  /** "aramaic": the notes on Aramaic and Hebrew words. */
  where: string;
}

export interface Work {
  id: string;
  group: string;
  /** What Simple shows: the kind of work and when ("Bible dictionary, 1897"). */
  plain: string;
  title: string;
  by: string;
  /** Empty on a plain card the build made for a dataset with no work. */
  when: string;
  what: string;
  /** One of the four, or a dataset's own license words when the build could not tell. */
  license: License | (string & {});
  licenseNote?: string;
  /** sources.json ids whose pinned files are this work. */
  datasets: string[];
  /** Read it in the app (a dictionary, or the Bible itself) or at a free full copy. Never for a copyrighted work. */
  read?: { app?: 'bible' | 'dictionary'; url?: string; label?: string };
  /** A link for the citation: a DOI, the publisher or a library catalog. */
  find?: { url: string; label: string };
  /** The full citation, for Deep. */
  citation: string;
  /** Parts of the source strings the app shows that name this work. */
  cites?: string[];
  /** Where the app cites it (at most 100), and how many places in all. */
  cited: Cited[];
  citedCount: number;
}

export interface Shelf {
  format: number;
  groups: ShelfGroup[];
  works: Work[];
  /** The dictionaries the app can show in full, by work id. */
  dictionaries: Record<string, { entries: number; letters: string[] } | undefined>;
}

/** A dictionary's index row: [name, slug, letter file]. */
export type IndexRow = [string, string, string];

/** Text with verse links in reading order, as the build writes it. */
export type Piece = string | { verse: number; to?: number; text?: string };

export interface DictEntry {
  name: string;
  /** A plain string, or words and verse links. Two meanings are split by a blank line. */
  text: string | Piece[];
  /** The verses it cites: a verse, or [first, last]. */
  refs: (number | [number, number])[];
}

const files = new Map<string, Promise<unknown>>();

/** web/public/data/<file>, fetched once; a failed fetch is tried again next time. */
function json<T>(a: Atlas, file: string): Promise<T> {
  let p = files.get(file) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${DATA_BASE}${file}?${a.version}`).then((r) => {
      if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    files.set(file, p);
    p.catch(() => files.delete(file));
  }
  return p;
}

export function loadShelf(a: Atlas): Promise<Shelf> {
  return json<Shelf>(a, 'shelf.json').then((s) => {
    if (s.format !== 1 || !Array.isArray(s.works) || !Array.isArray(s.groups)) throw new Error('shelf.json: unknown format');
    return s;
  });
}

/** The loaded value of a promise-returning loader: undefined while it loads,
 * null if it failed. Pass null as the key to load nothing. */
export function useLoaded<T>(key: string | null, load: () => Promise<T>): T | null | undefined {
  const [got, setGot] = useState<{ key: string; value: T | null } | null>(null);
  useEffect(() => {
    if (key === null) return;
    let live = true;
    load().then(
      (value) => live && setGot({ key, value }),
      () => live && setGot({ key, value: null }),
    );
    return () => {
      live = false;
    };
  }, [key]);
  return key !== null && got && got.key === key ? got.value : undefined;
}

/** The shelf, loaded on first use (pass on = false to load nothing yet). */
export function useShelf(a: Atlas, on = true): Shelf | null | undefined {
  return useLoaded(on ? `shelf ${a.version}` : null, () => loadShelf(a));
}

/** The work a citation string names, matched the way the build matches it:
 * the first work one of whose `cites` the string contains. */
export function workFor(shelf: Shelf, citation: string): Work | null {
  return shelf.works.find((w) => w.cites?.some((c) => citation.includes(c))) ?? null;
}

// ------------------------------------------------------------ dictionaries

const ID = /^[a-z0-9-]{1,64}$/;

export function loadDictIndex(a: Atlas, dict: string): Promise<IndexRow[]> {
  if (!ID.test(dict)) return Promise.reject(new Error(`no dictionary ${dict}`));
  return json<IndexRow[]>(a, `dict/${dict}/index.json`);
}

/** One entry, from its letter file (the first character of its slug), or
 * 'missing' when the dictionary has no entry by that name. Given the
 * dictionary's letters, a letter it lacks is not fetched. Fails only if the
 * file does not load. */
export async function loadEntry(a: Atlas, dict: string, slug: string, letters?: readonly string[]): Promise<DictEntry | 'missing'> {
  if (!ID.test(dict) || !ID.test(slug) || (letters && !letters.includes(slug[0]))) return 'missing';
  const letter = await json<Record<string, DictEntry | undefined>>(a, `dict/${dict}/${slug[0]}.json`);
  return Object.prototype.hasOwnProperty.call(letter, slug) ? letter[slug] ?? 'missing' : 'missing';
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .toLowerCase();
}

/** "1 Corinthians" is filed as "Corinthians, First Epistle to the". */
const ORDINALS: Record<string, string | undefined> = { '1': 'first', '2': 'second', '3': 'third', '1st': 'first', '2nd': 'second', '3rd': 'third' };

function words(folded: string): string[] {
  return folded
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => ORDINALS[w] ?? w);
}

/** Index rows whose name matches the query: names that start with it first,
 * then names with a word that starts with it, then names with a word starting
 * with each word of the query, in any order ("holy spirit" finds "Spirit,
 * Holy"), then names that contain it. */
export function searchIndex(rows: readonly IndexRow[], query: string, max = 60): IndexRow[] {
  const q = fold(query.trim());
  if (!q) return [];
  const qw = words(q);
  const starts: IndexRow[] = [];
  const word: IndexRow[] = [];
  const every: IndexRow[] = [];
  const within: IndexRow[] = [];
  for (const r of rows) {
    const n = fold(r[0]);
    if (n.startsWith(q)) {
      starts.push(r);
      continue;
    }
    const nw = words(n);
    if (nw.some((w) => w.startsWith(q))) word.push(r);
    else if (qw.length > 0 && qw.every((x) => nw.some((w) => w.startsWith(x)))) every.push(r);
    else if (n.includes(q)) within.push(r);
  }
  return [...starts, ...word, ...every, ...within].slice(0, max);
}
