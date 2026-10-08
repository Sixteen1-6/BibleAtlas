// What a word meant in its world: Greek usage outside the Bible (LSJ, via
// STEPBible TFLSJ) and the UBS Fauna, Flora and Realia handbook articles
// linked to a root. Built by crates/atlas-cli/src/world.rs; every file is
// fetched lazily, once, and only when something will be shown from it.

import { type Atlas, DATA_BASE } from './atlas';
import type { Segment } from './lex';

/** Roots per world/<k>.json shard and entries per world/ubs/<n>.json shard (world.rs). */
const ROOT_SHARD = 500;
const ARTICLE_SHARD = 40;

/** One LSJ sense: [gloss, century, writer or "", flags "" | "p" | "i" | "pi"]. */
export type Sense = [string, string, string, string];
/** A handbook link: [entry index, 1 general or 0 verse-only, the root's verses the entry cites]. */
export type UbsLink = [number, 0 | 1, number[]];

export interface RootWorld {
  /** Up to five LSJ senses. Present (maybe empty) for every Greek root LSJ has. */
  l?: Sense[];
  /** The earliest dated citation: [century, writer or ""]. */
  f?: [string, string];
  /** LSJ also cites papyri / inscriptions somewhere in the entry. */
  p?: 1;
  i?: 1;
  /**
   * A grammar word (article, conjunction, particle, preposition, pronoun):
   * LSJ's entry is about constructions, so the study shows no LSJ line.
   */
  g?: 1;
  u?: UbsLink[];
}

export type Handbook = 'realia' | 'fauna' | 'flora';
/** [handbook, Key, title, lead]. */
export type UbsEntry = [Handbook, string, string, string];
export interface UbsIndex {
  format: number;
  source: { title: string; license: string; attribution: string; changes: string };
  entries: UbsEntry[];
}
/** Kept sections: [heading ("" for none), segments]; paragraphs are split by "\n" segments. */
export type Article = [string, Segment[]][];

export const HANDBOOK_TITLE: Record<Handbook, string> = {
  realia: 'Human-made Things in the Bible',
  fauna: 'Animals in the Bible',
  flora: 'Plants and Trees in the Bible',
};

function cached<T>(cache: Map<string, Promise<T>>, a: Atlas, path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(`${DATA_BASE}${path}?${a.version}`).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    // A failed fetch is forgotten, so a later study can try again.
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

const rootShards = new Map<string, Promise<(RootWorld | null)[]>>();
const indexes = new Map<string, Promise<UbsIndex>>();
const articleShards = new Map<string, Promise<Article[]>>();

/** The world data of one root, or null when there is none. */
export async function rootWorld(a: Atlas, root: number): Promise<RootWorld | null> {
  const shard = await cached(rootShards, a, `world/${Math.floor(root / ROOT_SHARD)}.json`);
  return shard[root % ROOT_SHARD] ?? null;
}

export function ubsIndex(a: Atlas): Promise<UbsIndex> {
  return cached(indexes, a, 'world/ubs.json');
}

export async function ubsArticle(a: Atlas, entry: number): Promise<Article> {
  const shard = await cached(articleShards, a, `world/ubs/${Math.floor(entry / ARTICLE_SHARD)}.json`);
  const art = shard[entry % ARTICLE_SHARD];
  if (!art) throw new Error(`no article ${entry}`);
  return art;
}

/** Does the root really occur in verse v? (Its postings are in verse order.) */
function occursIn(a: Atlas, root: number, v: number): boolean {
  let lo = a.lOff[root];
  let hi = a.lOff[root + 1];
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const x = a.lVerse[mid];
    if (x === v) return true;
    if (x < v) lo = mid + 1;
    else hi = mid;
  }
  return false;
}

function cites(link: UbsLink, v: number): boolean {
  const vs = link[2];
  let lo = 0;
  let hi = vs.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (vs[mid] === v) return true;
    if (vs[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return false;
}

/**
 * Which handbook entries a study shows (the same rule as world::verify):
 * the ones that cite the study verse, if any do; otherwise the general ones.
 * A verse-only entry is shown only at a verse it cites. The study verse
 * counts only if the root occurs in it. Fewer verses first, then handbook
 * (realia, fauna, flora) and key, which is the entry order.
 */
export function entriesFor(a: Atlas, w: RootWorld | null, root: number, verse?: number): UbsLink[] {
  const links = w?.u ?? [];
  if (!links.length) return [];
  const v = verse !== undefined && occursIn(a, root, verse) ? verse : undefined;
  const cited = v === undefined ? [] : links.filter((l) => cites(l, v));
  const pick = cited.length ? cited : links.filter((l) => l[1] === 1);
  return pick.sort((x, y) => x[2].length - y[2].length || x[0] - y[0]);
}
