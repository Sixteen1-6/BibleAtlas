// English word search over the BSB, using the inverted index built in Rust.
// Normalization must match crates/atlas-cli/src/english.rs exactly.

import type { Atlas } from './atlas';

export function tokens(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[^\p{L}\p{N}'’]+/u)) {
    if (!raw) continue;
    let w = raw.toLowerCase().replace(/’/g, "'");
    w = w.replace(/^'+|'+$/g, '');
    if (w.endsWith("'s")) w = w.slice(0, -2);
    w = w.replace(/'/g, '');
    if (w) out.push(w);
  }
  return out;
}

function lowerBound(words: string[], key: string): number {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid] < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function postings(a: Atlas, wordIndex: number): Uint32Array {
  return a.eVerse.subarray(a.eOff[wordIndex], a.eOff[wordIndex + 1]);
}

/** Verses for one term; the last term of a query also matches as a prefix. */
function termVerses(a: Atlas, term: string, prefix: boolean): Set<number> {
  const words = a.englishWords;
  const out = new Set<number>();
  let i = lowerBound(words, term);
  if (!prefix) {
    if (words[i] === term) for (const v of postings(a, i)) out.add(v);
    return out;
  }
  for (let k = 0; i < words.length && words[i].startsWith(term) && k < 64; i++, k++) {
    for (const v of postings(a, i)) out.add(v);
  }
  return out;
}

export interface SearchResult {
  verses: number[];
  total: number;
}

/** All query words must appear in a verse. Results are ordered by how
 *  connected each verse is (PageRank), so central passages come first. */
export function searchEnglish(a: Atlas, query: string, limit = 60): SearchResult {
  const terms = tokens(query);
  if (!terms.length) return { verses: [], total: 0 };
  const endsWithSpace = /\s$/.test(query);
  let acc = termVerses(a, terms[0], terms.length === 1 && !endsWithSpace && terms[0].length >= 2);
  for (let i = 1; i < terms.length; i++) {
    const s = termVerses(a, terms[i], i === terms.length - 1 && !endsWithSpace && terms[i].length >= 2);
    const next = new Set<number>();
    for (const v of acc) if (s.has(v)) next.add(v);
    acc = next;
  }
  const all = [...acc];
  all.sort((x, y) => a.rank[y] - a.rank[x] || x - y);
  return { verses: all.slice(0, limit), total: all.length };
}

/** Lowercase ASCII-ish form for comparing transliterations ("agapē" -> "agape"). */
function plain(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[.\-'ʼʾʿ]/g, '');
}

/** Roots whose transliteration, gloss or Strong's number matches. */
export function searchRoots(a: Atlas, query: string, limit = 8): number[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const L = a.lemmas;
  const strong = /^[hg]\d{1,4}[a-z]?$/i.test(q);
  const hits: [number, number][] = [];
  for (let i = 0; i < L.key.length; i++) {
    let score = 0;
    if (strong) {
      const k = L.key[i].toLowerCase();
      const want = q[0] + q.slice(1).replace(/^(\d+)/, (d) => d.padStart(4, '0'));
      if (k === want) score = 3;
      else if (k.startsWith(want)) score = 2;
    } else {
      const g = L.gloss[i].toLowerCase();
      const t = plain(L.translit[i]);
      if (g === q) score = 3;
      else if (t === plain(q)) score = 3;
      else if (g.startsWith(q) || g.includes(`: ${q}`)) score = 2;
      else if (t.startsWith(plain(q))) score = 1;
    }
    if (score) hits.push([i, score * 1e6 + L.count[i]]);
  }
  hits.sort((x, y) => y[1] - x[1]);
  return hits.slice(0, limit).map((h) => h[0]);
}
