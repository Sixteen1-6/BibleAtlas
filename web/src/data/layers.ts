// Layers of meaning: short notes on one passage, from the plain meaning
// outward. Written in config/layers.json and checked by `atlas build`, which
// resolves every reference and word and leaves unreviewed drafts out.

import { signal } from '@preact/signals';
import { type Atlas, DATA_BASE } from './atlas';

export type Strength = 'widely agreed' | 'commonly held' | 'some interpreters';

export interface LayerRef {
  /** First and last verse index. */
  s: number;
  e: number;
  /** The cross-reference map already draws an arc for this link. */
  arc: boolean;
}

export interface Layer {
  kind: string;
  strength: Strength;
  text: string;
  evidence?: string;
  refs: LayerRef[];
  /** [verse, word position, root index] for each Hebrew or Greek word the layer rests on. */
  words: [number, number, number][];
}

export interface Passage {
  id: string;
  v: number;
  end: number;
  saying: string;
  source: string;
  reviewed_by: string[];
  /** Not yet reviewed by a person (only present in local preview builds). */
  draft: boolean;
  layers: Layer[];
}

/** Every layered passage, in reading order of the config. Empty until loaded. */
export const passages = signal<Passage[]>([]);

export async function loadLayers(a: Atlas): Promise<void> {
  try {
    const r = await fetch(`${DATA_BASE}layers.json?${a.version}`);
    if (r.ok) passages.value = (await r.json()) as Passage[];
  } catch {
    // Older data builds have no layers; the app works without them.
  }
}

export function passageAt(list: Passage[], v: number): Passage | null {
  return list.find((p) => p.v <= v && v <= p.end) ?? null;
}

/** Layered passages elsewhere whose notes point at verse v. */
export function pointingAt(list: Passage[], v: number): Passage[] {
  return list.filter((p) => !(p.v <= v && v <= p.end) && p.layers.some((l) => l.refs.some((r) => r.s <= v && v <= r.e)));
}

/** The note shown first: the first deeper layer that is widely agreed, else the first deeper one. */
export function leadLayer(p: Passage): Layer | null {
  const deeper = p.layers.filter((l) => l.kind !== 'plain meaning');
  return deeper.find((l) => l.strength === 'widely agreed') ?? deeper[0] ?? null;
}
