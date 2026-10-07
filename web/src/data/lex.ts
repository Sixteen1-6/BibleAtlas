// Lexicon definitions, sharded by root index.
// Each definition is a list of plain segments [text, style bits, verse index];
// they are rendered with text nodes only, never as HTML.

import { type Atlas, DATA_BASE } from './atlas';

export type Segment = [string, number, number];
export interface LexEntry {
  /** Lexical form. */
  w: string;
  t: string;
  /** Lexicon part-of-speech code, e.g. "H:N-M". */
  m: string;
  g: string;
  /** Which lexicon: "tbesh" or "tbesg". */
  s: string;
  d: Segment[];
}

const shards = new Map<number, Promise<(LexEntry | null)[]>>();

export async function getLex(a: Atlas, root: number): Promise<LexEntry | null> {
  const k = Math.floor(root / a.meta.lexShard);
  let p = shards.get(k);
  if (!p) {
    p = fetch(`${DATA_BASE}lex/${k}.json?${a.version}`).then((r) => {
      if (!r.ok) throw new Error(`lex/${k}.json: HTTP ${r.status}`);
      return r.json() as Promise<(LexEntry | null)[]>;
    });
    p.catch(() => shards.delete(k));
    shards.set(k, p);
  }
  return (await p)[root % a.meta.lexShard] ?? null;
}
