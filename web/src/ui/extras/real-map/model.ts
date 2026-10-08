// The Places extra's data, as crates/atlas-cli/src/extra_real_map.rs writes
// it, and the index that the quiet line needs. What only the panel needs is
// in places.ts, so it loads with the panel. The build writes each place's
// plain line and label too, so the panel only arranges them.

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

/** Another reading of the word: [kind ("not_a_place"), its score, 1 if it is
 * the strongest reading of all, the dataset's words ("not a place (person)")]. */
export type Reading = [string, number, 0 | 1, string];

/** One place, as places.json has it. */
export type PlaceRow = [
  /** OpenBible.info id */
  string,
  /** its page name there */
  string,
  /** kind, an index into PlacesFile.kinds */
  number,
  /** the plain line after the name: "a town about 8 km south of Jerusalem" */
  string,
  /** proposed sites the map can draw, most confident first */
  Site[],
  /** 0 or another reading */
  0 | Reading,
  /** the dataset's identification, when it places this one by another
   * ("within 8 km of Jerusalem"), or "" */
  string,
  /** the dataset's note ("In Benjamin"), or "" */
  string,
  /** 1: marked only roughly (by another place's point); 2: may be symbolic */
  number,
  /** the label after the line ("location uncertain"), or "" */
  string,
  /** 0, or the strongest proposed site when the map cannot draw it (its only
   * position is one the app leaves out for its license): [name, score] */
  0 | [string, number],
  /** how sure the strongest drawn site is, out of 1000, counting other
   * sites at the same spot */
  number,
];

/** extras/real-map/places.json: loads when the panel opens. */
export interface PlacesFile {
  format: 2;
  jerusalem: [number, number];
  /** A site this confident (out of 1000) is shown on the map by default. */
  confident: number;
  kinds: string[];
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
