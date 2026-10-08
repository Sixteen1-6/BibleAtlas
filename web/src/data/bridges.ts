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

/** Roots this common (and, the, LORD) say little about a link; sharedRoots skips them too. */
const COMMON = 1500;

/** Up to `max` word bridges between an Old Testament verse and a New Testament
 *  verse, rarest first. Only base-text words count on either side. Empty
 *  until `loadBridges` has finished. */
export function bridges(a: Atlas, otRow: VerseRow, ntRow: VerseRow, max = 4): Bridge[] {
  const t = bridgeTable(a);
  if (!t) return [];
  const count = a.lemmas.count;
  const ot = rootsOf(otRow);
  const out: Bridge[] = [];
  for (const g of rootsOf(ntRow)) {
    if (count[g] >= COMMON) continue;
    for (const h of t.get(g) ?? []) if (ot.has(h) && count[h] < COMMON) out.push({ greek: g, hebrew: h });
  }
  const rarer = (b: Bridge) => Math.min(count[b.greek], count[b.hebrew]);
  const commoner = (b: Bridge) => Math.max(count[b.greek], count[b.hebrew]);
  out.sort((x, y) => rarer(x) - rarer(y) || commoner(x) - commoner(y) || x.greek - y.greek || x.hebrew - y.hebrew);
  return out.slice(0, max);
}
