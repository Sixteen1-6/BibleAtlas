// The Places extra's data, as crates/atlas-cli/src/extra_real_map.rs writes
// it, and the plain words the panel says about each place.

import type { VerseRef } from '../types';

// ------------------------------------------------------------------ files

/** extras/real-map.json: loads the first time a verse is selected. */
export interface IndexFile {
  format: 1;
  /** Each place's usual name in the BSB, by place number. */
  names: string[];
  /** [place, another name a verse uses for it] ("Syria" for Aram). */
  alts: [number, string][];
  /** Per verse: [verse step, count, place, ...]. A place written -(k + 1) is
   * alts[k], called there by that other name. */
  at: number[];
}

/** [longitude × 10⁴, latitude × 10⁴, confidence out of 1000, modern name] */
export type Site = [number, number, number, string];

/** [OpenBible.info id, its page name, kind, modern country (-1 near Jerusalem),
 * proposed sites (most confident first), 0 or [another reading, its score]] */
export type PlaceRow = [string, string, number, number, Site[], 0 | [string, number]];

/** extras/real-map/places.json: loads when the panel opens. */
export interface PlacesFile {
  format: 1;
  jerusalem: [number, number];
  deadSea: [number, number];
  /** A site this confident (out of 1000) is shown on the map by default. */
  confident: number;
  kinds: string[];
  countries: string[];
  places: PlaceRow[];
}

/** extras/real-map/base.json: the map, cut to the Bible lands. Rings and
 * lines are whole thousandths of a degree, delta-encoded. */
export interface BaseFile {
  format: 1;
  q: number;
  box: [number, number, number, number];
  land: number[][];
  lakes: number[][];
  /** [name, longitude, latitude, importance (lower is more important)] */
  lakeNames: [string, number, number, number][];
  /** [river (index into riverNames) or -1, x0, y0, dx, dy, ...] */
  rivers: number[][];
  riverNames: string[];
  /** [river, longitude, latitude] */
  riverLabels: [number, number, number][];
  /** [name, importance, [longitude, latitude, open water around it in degrees][]] */
  seas: [string, number, [number, number, number][]][];
}

/** extras/real-map/people.json, from Theographic Bible Metadata (CC BY-SA 4.0). */
export interface PeopleFile {
  format: 1;
  license: string;
  source: string;
  names: string[];
  /** Per place: 0, or [person, ties (1 born here, 2 died here, 4 was here), a verse or -1]. */
  places: (0 | [number, number, number][])[];
}

// ------------------------------------------------------------------ the index

/** One place named in one verse, by the name the verse uses. */
export interface Mention {
  place: number;
  name: string;
}

export interface Data {
  /** Each place's usual name. */
  names: string[];
  /** The other names each place goes by in the BSB. */
  aka: Map<number, string[]>;
  /** The places each verse names, in reading order. */
  byVerse: Map<VerseRef, Mention[]>;
  /** Every verse that names each place, in order. */
  versesOf: number[][];
  /** The quiet line for each verse, made on first use. */
  lines: Map<VerseRef, string>;
}

export function decodeIndex(f: IndexFile, verses: number): Data {
  const names = f.names;
  const aka = new Map<number, string[]>();
  for (const [p, name] of f.alts) {
    const list = aka.get(p);
    if (!list) aka.set(p, [name]);
    else if (!list.includes(name)) list.push(name);
  }
  const byVerse = new Map<VerseRef, Mention[]>();
  const versesOf: number[][] = names.map(() => []);
  const at = f.at;
  let v = 0;
  for (let i = 0; i + 1 < at.length; ) {
    v += at[i];
    const k = at[i + 1];
    if (!(k > 0) || i + 2 + k > at.length || v >= verses) break;
    const ms: Mention[] = [];
    for (let j = i + 2; j < i + 2 + k; j++) {
      const tok = at[j];
      const m: Mention | null =
        tok >= 0 ? (tok < names.length ? { place: tok, name: names[tok] } : null) : alt(f.alts[-tok - 1], names.length);
      if (m) {
        ms.push(m);
        versesOf[m.place].push(v);
      }
    }
    if (ms.length) byVerse.set(v, ms);
    i += 2 + k;
  }
  return { names, aka, byVerse, versesOf, lines: new Map() };
}

function alt(a: [number, string] | undefined, n: number): Mention | null {
  return a && a[0] >= 0 && a[0] < n && a[1] ? { place: a[0], name: a[1] } : null;
}

/** "Places: Bethlehem, Judea", at most three names and about 60 characters. */
export function placesLine(ms: readonly Mention[]): string {
  const names: string[] = [];
  for (const m of ms) if (!names.includes(m.name)) names.push(m.name);
  const head = names.length === 1 ? 'Place: ' : 'Places: ';
  const shown: string[] = [];
  let len = head.length;
  for (const n of names) {
    if (shown.length === 3 || (shown.length > 0 && len + n.length + 12 > 62)) break;
    shown.push(n);
    len += n.length + 2;
  }
  const rest = names.length - shown.length;
  return `${head}${shown.join(', ')}${rest ? ` and ${rest} more` : ''}`;
}

// ------------------------------------------------------------------ places

export interface PlaceInfo {
  row: PlaceRow;
  kind: string;
  /** The strongest proposed site, if any. */
  best: Site | undefined;
  /** Its confidence out of 1000 (0 without a site). */
  score: number;
  /** Shown on the map by default. */
  confident: boolean;
  /** A region, river, sea or other area: drawn as a name, not a dot. */
  area: boolean;
}

const AREAS = new Set(['region', 'river', 'body of water', 'mountain range', 'natural area', 'people group', 'wadi', 'mountain ridge', 'forest']);

export function info(f: PlacesFile, place: number): PlaceInfo | null {
  const row = f.places[place];
  if (!row) return null;
  const kind = f.kinds[row[2]] ?? 'place';
  const best = row[4][0];
  const score = best ? best[2] : 0;
  return { row, kind, best, score, confident: !!best && score >= f.confident, area: AREAS.has(kind) };
}

export const lonOf = (s: Site) => s[0] / 1e4;
export const latOf = (s: Site) => s[1] / 1e4;

/** Distance on the ground in km. */
export function km(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

const DIRS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

/** Which way from the first point the second lies: "south", "northeast". */
export function direction(lon1: number, lat1: number, lon2: number, lat2: number): string {
  const r = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  const deg = (Math.atan2(y, x) / r + 360) % 360;
  return DIRS[Math.round(deg / 45) % 8];
}

/** "about 9 km", rounded the way people say distances. */
export function aboutKm(d: number): string {
  const step = d < 12 ? 1 : d < 60 ? 5 : d < 250 ? 10 : 50;
  return `about ${Math.max(1, Math.round(d / step) * step)} km`;
}

const KIND: Record<string, string> = {
  settlement: 'a town',
  region: 'a region',
  river: 'a river',
  'mountain range': 'a range of mountains',
  'body of water': 'a body of water',
  mountain: 'a mountain',
  hill: 'a hill',
  campsite: 'a camping place',
  valley: 'a valley',
  gate: 'a gate',
  'natural area': 'an area',
  island: 'an island',
  structure: 'a building',
  spring: 'a spring',
  road: 'a road',
  altar: 'an altar',
  pool: 'a pool',
  well: 'a well',
  wadi: 'a stream bed',
  tree: 'a tree',
  garden: 'a garden',
  'district in settlement': 'a part of a city',
  field: 'a field',
  room: 'a room',
  'stone heap': 'a heap of stones',
  cliff: 'a cliff',
  rock: 'a rock',
  'mountain pass': 'a pass',
  canal: 'a canal',
  promontory: 'a headland',
  forest: 'a forest',
  hall: 'a hall',
  'mountain ridge': 'a ridge',
  'people group': 'the land of a people',
};

/** "a town", or "a city" for a settlement the Bible names often. */
export function kindWords(kind: string, mentions: number): string {
  if (kind === 'settlement' && mentions >= 50) return 'a city';
  return KIND[kind] ?? 'a place';
}

/** One plain line about where a place was: "a town about 9 km south of
 * Jerusalem", "a town in what is now Turkey". Uncertain places get no
 * distance, because their sites are only proposals. */
export function whereLine(f: PlacesFile, place: number, mentions: number): string {
  const p = info(f, place);
  if (!p) return 'a place';
  const what = kindWords(p.kind, mentions);
  const special = p.row[5];
  if (special && special[0] === 'nonspecific_place') return `${what} that may not be a single real place`;
  if (special && special[0] === 'multiple_locations') return `${what} that stood in more than one place`;
  // The label after the line says when the site is unknown or uncertain.
  if (!p.best) return what;
  const country = p.row[3] >= 0 ? f.countries[p.row[3]] : undefined;
  if (!p.confident) return country ? `${what}, probably in what is now ${country}` : what;
  if (country) return `${what} in what is now ${country}`;
  const [jlon, jlat] = f.jerusalem;
  const lon = lonOf(p.best);
  const lat = latOf(p.best);
  const d = km(jlon, jlat, lon, lat);
  if (d < 1.5 && p.kind === 'settlement') {
    const [dlon, dlat] = f.deadSea;
    return `${what} ${aboutKm(km(dlon, dlat, jlon, jlat))} ${direction(dlon, dlat, jlon, jlat)} of the Dead Sea`;
  }
  if (d < 2) return `${what} in Jerusalem`;
  if (d < 5) return `${what} near Jerusalem`;
  const dir = direction(jlon, jlat, lon, lat);
  return p.area ? `${what} ${dir} of Jerusalem` : `${what} ${aboutKm(d)} ${dir} of Jerusalem`;
}

/** The small uncertainty label, or null when the site is well established. */
export function unsureLabel(f: PlacesFile, place: number): string | null {
  const p = info(f, place);
  if (!p) return null;
  const special = p.row[5];
  if (special && special[0] === 'nonspecific_place') return 'may be symbolic';
  if (special && special[0] === 'multiple_locations') return 'more than one place';
  if (!p.best) return 'location unknown';
  if (!p.confident) return 'location uncertain';
  if (p.score < 800) return 'likely site';
  return null;
}

/** "about 37 in 100": OpenBible.info's confidence, as a share of 100. */
export function inHundred(score: number): string {
  return `about ${Math.max(1, Math.round(score / 10))} in 100`;
}

/** How sure the identification is, in one plain sentence. */
export function sureLine(f: PlacesFile, place: number): string {
  const p = info(f, place);
  if (!p) return '';
  const sites = p.row[4];
  const special = p.row[5];
  if (special && special[0] === 'multiple_locations') return 'It stood in more than one place, so no single site is shown.';
  if (!p.best) return 'Location unknown: no site has been proposed with confidence.';
  if (p.score >= 800) return `The site is well established (${inHundred(p.score)}).`;
  if (p.confident) return `The site is likely (${inHundred(p.score)})${sites.length > 1 ? `; ${others(sites.length - 1)}` : ''}.`;
  return `Location uncertain: ${sites.length === 1 ? '1 proposed site' : `${sites.length} proposed sites`}. The strongest, ${p.best[3]}, is ${inHundred(p.score)}.`;
}

function others(n: number): string {
  return n === 1 ? '1 other site has been proposed' : `${n} other sites have been proposed`;
}

/** Plain words for another reading of the word ("not_a_place"). */
export function readingLine(special: [string, number]): string {
  const [what, score] = special;
  const share = inHundred(score);
  switch (what) {
    case 'not_a_place':
      return `Some sources read this word as a name that is not a place (${share}).`;
    case 'not_a_proper_name':
      return `Some sources read this word as an ordinary word, not a name (${share}).`;
    case 'unknown_place':
      return `Some sources hold that where it was cannot be known (${share}).`;
    case 'nonspecific_place':
      return `Some sources read it as a symbolic or prophetic place (${share}).`;
    case 'multiple_locations':
      return `It refers to more than one location (${share}).`;
    default:
      return `Some sources read it another way (${share}).`;
  }
}

/** "31.70° N, 35.21° E" */
export function coords(s: Site): string {
  const lat = latOf(s);
  const lon = lonOf(s);
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
}

/** "born here", "died here", "was here", "born and died here". */
export function tieWords(bits: number): string {
  if (bits & 1 && bits & 2) return 'born and died here';
  if (bits & 1) return 'born here';
  if (bits & 2) return 'died here';
  return 'was here';
}

/** Up to n verses spread across the list (first, middle, last), leaving one out. */
export function spread(vs: readonly number[], n: number, skip: number): number[] {
  const rest = vs.filter((v) => v !== skip);
  if (rest.length <= n) return rest;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rest[Math.round((i * (rest.length - 1)) / (n - 1))]);
  return [...new Set(out)];
}
