// The places for the panel: how sure each site is, in plain words. Loaded
// with the panel (MapPanel.tsx), not with the quiet line.

import type { PlaceRow, PlacesFile, Reading, Site } from './model';

export interface PlaceInfo {
  row: PlaceRow;
  kind: string;
  /** The plain line after the name. */
  line: string;
  /** The label after the line, or null when the site is well established. */
  label: string | null;
  /** The strongest site the map can draw, if any. */
  best: Site | undefined;
  /** How sure that site is, out of 1000 (0 without one). */
  score: number;
  /** Marked on the map by default: a site at least fairly sure that is the
   * strongest proposed. */
  confident: boolean;
  /** Marked only roughly: the dataset places it by another place ("within 8
   * km of Jerusalem"). */
  rough: boolean;
  /** The strongest site, when the map cannot draw it. */
  off: [string, number] | null;
  /** A region, river, sea or other area: drawn as a name, not a dot. */
  area: boolean;
}

const AREAS = new Set(['region', 'river', 'body of water', 'mountain range', 'natural area', 'people group', 'wadi', 'mountain ridge', 'forest']);

export function info(f: PlacesFile, place: number): PlaceInfo | null {
  const row = f.places[place];
  if (!row) return null;
  const kind = f.kinds[row[2]] ?? 'place';
  const best = row[4][0];
  const off = row[10] || null;
  const score = best ? row[11] : 0;
  return {
    row,
    kind,
    line: row[3],
    label: row[9] || null,
    best,
    score,
    confident: !!best && !off && score >= f.confident,
    rough: (row[8] & 1) !== 0,
    off,
    area: AREAS.has(kind),
  };
}

/** Sites to draw as rings for a place whose location is uncertain. None when
 * the map cannot draw the strongest one and it is likely, since the others
 * would point the wrong way, or when the word is most likely not a place. */
export function proposals(f: PlacesFile, p: PlaceInfo): Site[] {
  if (p.confident || (p.off && p.off[1] >= f.confident)) return [];
  const r = p.row[5];
  if (r && r[2] && (r[0] === 'not_a_place' || r[0] === 'not_a_proper_name')) return [];
  return p.row[4].slice(0, 4);
}

export const lonOf = (s: Site) => s[0] / 1e4;
export const latOf = (s: Site) => s[1] / 1e4;

/** "about 37 in 100": OpenBible.info's confidence, as a share of 100. */
export function inHundred(score: number): string {
  return score >= 1000 ? '100 in 100' : `about ${Math.max(1, Math.min(99, Math.round(score / 10)))} in 100`;
}

const NOT_DRAWN =
  'is not on this map, because the only position the data gives for it comes from a source whose license this app does not use';

/** How sure the identification is, in plain sentences, for Deep. */
export function sureLine(f: PlacesFile, place: number): string {
  const p = info(f, place);
  if (!p) return '';
  const sites = p.row[4];
  const reading = p.row[5];
  const how = p.row[6];
  if (reading && reading[2]) {
    switch (reading[0]) {
      case 'multiple_locations':
        return 'It stood in more than one place, so no single site is shown.';
      case 'unknown_place':
        return 'Where it was is unknown.';
      case 'nonspecific_place':
        return 'It may not be a single real place.';
      default:
        return 'The word here may not be the name of a place.';
    }
  }
  if (p.off) {
    const [name, score] = p.off;
    return score >= f.confident
      ? `The most likely site, ${name} (${inHundred(score)}), ${NOT_DRAWN}.`
      : `Location uncertain. The strongest proposal, ${name} (${inHundred(score)}), ${NOT_DRAWN}.`;
  }
  if (!p.best) {
    return how ? `The data places it ${how}, and gives it no site of its own.` : 'Location unknown: no site has been proposed with confidence.';
  }
  const same = sites.filter((s, k) => k > 0 && km(s, sites[0]) <= 1).length;
  const counting = same ? `, counting ${same === 1 ? 'another site' : `${same} other sites`} at the same spot` : '';
  if (p.rough && p.score >= f.confident) return `The data places it ${how} (${inHundred(p.score)}), so the map marks it only roughly.`;
  if (p.confident && p.row[8] & 2) return `The data identifies it with ${sites[0][3]} (${inHundred(p.score)}${counting}), but the name may be symbolic here.`;
  if (p.score >= 800) return `The site is well established (${inHundred(p.score)}${counting}).`;
  if (p.confident) return `The site is likely (${inHundred(p.score)}${counting})${sites.length > 1 + same ? `; ${others(sites.length - 1 - same)}` : ''}.`;
  return `Location uncertain: ${sites.length === 1 ? '1 proposed site' : `${sites.length} proposed sites`}. The strongest, ${sites[0][3]}, is ${inHundred(sites[0][2])}.`;
}

function others(n: number): string {
  return n === 1 ? '1 other site has been proposed' : `${n} other sites have been proposed`;
}

/** Distance on the ground in km between two sites. */
function km(a: Site, b: Site): number {
  const r = Math.PI / 180;
  const [lon1, lat1, lon2, lat2] = [lonOf(a), latOf(a), lonOf(b), latOf(b)];
  const h = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Another reading of the word, in the dataset's words: "Not a place (person):
 * about 27 in 100." */
export function readingLine(r: Reading): string {
  const [what, score, , words] = r;
  const share = inHundred(score);
  if (words) return `${words.charAt(0).toUpperCase()}${words.slice(1)}: ${share}.`;
  switch (what) {
    case 'not_a_place':
      return `Not a place: ${share}.`;
    case 'not_a_proper_name':
      return `Not a proper name: ${share}.`;
    case 'unknown_place':
      return `Unknown location: ${share}.`;
    case 'nonspecific_place':
      return `Not a specific place: ${share}.`;
    case 'multiple_locations':
      return `More than one location: ${share}.`;
    default:
      return `Another reading: ${share}.`;
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
