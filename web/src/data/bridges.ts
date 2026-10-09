// Septuagint word bridges: the Hebrew words that the Greek Old Testament (the
// Septuagint) translates with a Greek word. Built by crates/atlas-cli/src/lxx.rs
// from Abbott-Smith's notes on Septuagint usage in STEPBible's TBESG. The file
// holds root indices only and loads the first time a link between the
// testaments needs it.

import { type Atlas, DATA_BASE } from './atlas';
import { type VerseRow, rootsOf } from './text';

/** lxx.json: the Hebrew roots of `greek[i]` are `hebrew[offsets[i]..offsets[i + 1]]`. */
interface LxxFile {
  greek: number[];
  offsets: number[];
  hebrew: number[];
}

/** Greek root -> the Hebrew roots the Septuagint uses it for. */
export type BridgeTable = Map<number, Set<number>>;

/** A Greek root of the New Testament verse that the Septuagint uses for a
 *  Hebrew root of the Old Testament verse. */
export interface Bridge {
  greek: number;
  hebrew: number;
}

let loading: { version: string; table: Promise<BridgeTable> } | null = null;
let ready: { version: string; table: BridgeTable } | null = null;

/** Fetches lxx.json for this build once; later calls share the same promise. */
export function loadBridges(a: Atlas): Promise<BridgeTable> {
  if (loading?.version !== a.version) {
    const version = a.version;
    const table = fetch(`${DATA_BASE}lxx.json?${version}`)
      .then((r) => {
        if (!r.ok) throw new Error(`lxx.json: HTTP ${r.status}`);
        return r.json() as Promise<LxxFile>;
      })
      .then((f) => {
        const t: BridgeTable = new Map();
        f.greek.forEach((g, i) => t.set(g, new Set(f.hebrew.slice(f.offsets[i], f.offsets[i + 1]))));
        ready = { version, table: t };
        return t;
      });
    // A failed download may be tried again later.
    table.catch(() => {
      if (loading?.table === table) loading = null;
    });
    loading = { version, table };
  }
  return loading.table;
}

/** The table, once it has loaded for this build. */
export function bridgeTable(a: Atlas): BridgeTable | null {
  return ready?.version === a.version ? ready.table : null;
}

/** Words used this often (and, the, LORD, son) say little about a link. sharedRoots uses the same bar, per root. */
const COMMON = 1500;

/** Strong's number without STEPBible's sub-entry letter: "H1121G" is H1121.
 *  An extended number ("G20286") is a number of its own. */
function numberOf(key: string): string {
  return key.length > 5 && key[5] >= '0' && key[5] <= '9' ? key : key.slice(0, 5);
}

let totals: { version: string; uses: number[] } | null = null;

/** Uses of each root's Strong's number, all its senses together: בֵּן (son)
 *  is split into many senses of a few hundred uses each, but is still one of
 *  the commonest words. atlas verify counts the same way. */
function numberUses(a: Atlas): number[] {
  if (totals?.version !== a.version) {
    const { key, count } = a.lemmas;
    const sum = new Map<string, number>();
    key.forEach((k, i) => sum.set(numberOf(k), (sum.get(numberOf(k)) ?? 0) + count[i]));
    totals = { version: a.version, uses: key.map((k) => sum.get(numberOf(k)) ?? 0) };
  }
  return totals.uses;
}

/** Up to `max` word bridges between an Old Testament verse and a New Testament
 *  verse, rarest first. Only base-text words count on either side. Empty
 *  until `loadBridges` has finished. */
export function bridges(a: Atlas, otRow: VerseRow, ntRow: VerseRow, max = 4): Bridge[] {
  const t = bridgeTable(a);
  if (!t) return [];
  const uses = numberUses(a);
  const ot = rootsOf(otRow);
  const out: Bridge[] = [];
  for (const g of rootsOf(ntRow)) {
    if (uses[g] >= COMMON) continue;
    for (const h of t.get(g) ?? []) if (ot.has(h) && uses[h] < COMMON) out.push({ greek: g, hebrew: h });
  }
  const rarer = (b: Bridge) => Math.min(uses[b.greek], uses[b.hebrew]);
  const commoner = (b: Bridge) => Math.max(uses[b.greek], uses[b.hebrew]);
  out.sort((x, y) => rarer(x) - rarer(y) || commoner(x) - commoner(y) || x.greek - y.greek || x.hebrew - y.hebrew);
  return out.slice(0, max);
}
