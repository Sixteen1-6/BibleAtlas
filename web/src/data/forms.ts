// Every form of a root, and its family of related words, sharded by root
// index like the lexicon (built by crates/atlas-cli/src/family.rs).

import { type Atlas, DATA_BASE } from './atlas';

/** How a relative is related to the word studied. */
export type Relation = 'p' | 'c' | 's' | 'n';

export interface Forms {
  /** [spelling, grammar code, count], most used first. */
  f: [string, string, number][];
  /** Which form each of the root's postings is (index into f), when it has more than one. */
  o?: number[];
  /** Related roots: [root, relation], closest first. */
  r?: [number, Relation][];
}

const shards = new Map<number, Promise<(Forms | null)[]>>();

export async function getForms(a: Atlas, root: number): Promise<Forms | null> {
  const k = Math.floor(root / a.meta.lexShard);
  let p = shards.get(k);
  if (!p) {
    p = fetch(`${DATA_BASE}forms/${k}.json?${a.version}`).then((r) => {
      if (!r.ok) throw new Error(`forms/${k}.json: HTTP ${r.status}`);
      return r.json() as Promise<(Forms | null)[]>;
    });
    p.catch(() => shards.delete(k));
    shards.set(k, p);
  }
  return (await p)[root % a.meta.lexShard] ?? null;
}

/** The distinct verses where one form of a root is used. */
export function versesWithForm(a: Atlas, root: number, forms: Forms, form: number): Uint32Array {
  const s = a.lOff[root];
  const e = a.lOff[root + 1];
  const out: number[] = [];
  for (let i = s; i < e; i++) {
    if ((forms.o ? forms.o[i - s] : 0) !== form) continue;
    const v = a.lVerse[i];
    if (out[out.length - 1] !== v) out.push(v);
  }
  return Uint32Array.from(out);
}

/** The distinct verses where any of these roots is used, in Bible order. */
export function versesWithRoots(a: Atlas, roots: number[]): Uint32Array {
  const seen = new Set<number>();
  for (const r of roots) for (let i = a.lOff[r]; i < a.lOff[r + 1]; i++) seen.add(a.lVerse[i]);
  return Uint32Array.from(seen).sort();
}

/** A relative's tie to the studied word, in plain words. */
export const RELATION: Record<Relation, string> = {
  p: 'the word it comes from',
  c: 'comes from it',
  s: 'shares its root',
  n: 'same word, another sense',
};
