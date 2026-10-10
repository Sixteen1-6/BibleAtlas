// Every form of a root, and its family of related words, sharded by root
// index like the lexicon (built by crates/atlas-cli/src/family.rs).

import { type Atlas, DATA_BASE } from './atlas';

/** How a relative is related to the word studied. */
export type Relation = 'f' | 'p' | 'c' | 's' | 'a' | 'n';

export interface Forms {
  /** [spelling, grammar code, count, other spellings of the same form],
   *  most used first. */
  f: [string, string, number, string[]?][];
  /** Which form each of the root's postings is (index into f, -1 for none),
   *  when it has more than one or some use has none. */
  o?: number[];
  /** Related roots: [root, relation, the root heading its dictionary word],
   *  closest first. Senses of one word share a head and show as one row. */
  r?: [number, Relation, number][];
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

/** Which form (index into f) the root's use at word `pos` of `verse` is:
 *  -1 when that use has no form or the root isn't used there. */
export function formAt(a: Atlas, root: number, forms: Forms, verse: number, pos: number): number {
  const s = a.lOff[root];
  const e = a.lOff[root + 1];
  let lo = s;
  let hi = e;
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (a.lVerse[m] < verse) lo = m + 1;
    else hi = m;
  }
  for (let i = lo; i < e && a.lVerse[i] === verse; i++) {
    if (a.lPos[i] === pos) return forms.o ? forms.o[i - s] : 0;
  }
  return -1;
}

/** The distinct verses where any of these forms of a root is used. */
export function versesWithForm(a: Atlas, root: number, forms: Forms, which: Set<number>): Uint32Array {
  const s = a.lOff[root];
  const e = a.lOff[root + 1];
  const out: number[] = [];
  for (let i = s; i < e; i++) {
    if (!which.has(forms.o ? forms.o[i - s] : 0)) continue;
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

/** A relative's tie to the studied word, in plain words. `lang` is the
 *  relative's language letter (G, H or A). */
export function relation(rel: Relation, lang: string): string {
  switch (rel) {
    case 'f':
      return 'another form of the same word';
    case 'p':
      return 'the word it comes from';
    case 'c':
      return 'comes from it';
    case 's':
      return 'shares its root';
    case 'a':
      return lang === 'A' ? 'the same word in Aramaic' : 'the same word in Hebrew';
    case 'n':
      return 'same word, another sense';
  }
}
