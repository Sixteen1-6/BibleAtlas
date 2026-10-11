// Layers of meaning: short notes on one passage, from the plain meaning
// outward. Written in config/layers.json and checked by `atlas build`, which
// resolves every reference and word and publishes a note once a person has
// reviewed its passage or it cites a source from config/layer-sources.json
// (the Bible-believing sources the owner's rule allows); the rest are drafts.

import { signal } from '@preact/signals';
import { type Atlas, DATA_BASE } from './atlas';

export type Strength = 'widely agreed' | 'commonly held' | 'some interpreters';

/** The four groups passages are listed in, in Bible order. */
export const SECTIONS = {
  'law-history': 'Law and history',
  'prophets-poetry': 'Prophets and poetry',
  jesus: 'Jesus',
  'letters-revelation': 'Letters and Revelation',
} as const;
export type Section = keyof typeof SECTIONS;

export interface LayerRef {
  /** First and last verse index. */
  s: number;
  e: number;
  /** The cross-reference map already draws an arc for this link. */
  arc: boolean;
}

/** A source a note cites: a commentary on a verse, or a writer and work. */
export interface Cite {
  name: string;
  /** The verse it comments on, as written: "Genesis 2:7". */
  on?: string;
  /** The writer and work, when it is not a commentary on a verse. */
  at?: string;
  /** Where to read it. */
  url?: string;
}

export interface Layer {
  kind: string;
  strength: Strength;
  text: string;
  /** Where the note comes from, and detail it had no room for (shown at Deep). */
  evidence?: string;
  refs: LayerRef[];
  /** [verse, word position, root index] for each Hebrew or Greek word the layer rests on. */
  words: [number, number, number][];
  /** The sources it rests on (shown at Deep). */
  cites?: Cite[];
  /** Neither reviewed nor cited (only present in local preview builds). */
  draft?: boolean;
}

export interface Passage {
  id: string;
  section: Section;
  v: number;
  end: number;
  saying: string;
  source: string;
  reviewed_by: string[];
  /** No note beyond the plain meaning is reviewed or cited (only present in local preview builds). */
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
