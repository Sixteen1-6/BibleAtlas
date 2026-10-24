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

/** A citation's credit, as the build resolves it from config/layer-sources.json
 * and docs/evidence/: the person who wrote the words, the work and its original
 * date, where the app read it, the date it was read or checked, and the page. */
export interface Cite {
  /** Who wrote the words: a name, two joined by "and", or a plain phrase when no writer can be named. */
  writer: string;
  /** Who he was, in one short phrase (for two writers, each by surname). Absent when unnamed. */
  about?: string;
  /** "named"; "attributed" (printed without a name and generally credited to the writer); "unnamed". */
  named: 'named' | 'attributed' | 'unnamed';
  /** The work as the credit names it, with its volume: "Commentary on Genesis". */
  work: string;
  /** The original date as checked ("Andover edition of 1866"), or "date not known". */
  written: string;
  /** One checked year or decade, for the short credit below Deep. */
  year?: string;
  /** The text as read: "translated by James Martin". */
  edition?: string;
  /** The verse it comments on, as written: "Genesis 2:7". */
  on?: string;
  /** The place inside the work: "chapter 40". */
  at?: string;
  /** "on Genesis 2:7", with the place inside the work. */
  part: string;
  /** Where the app read it: "Bible Hub". */
  read_from: string;
  /** The site's own label, when it credits the page to someone else: "Barnes' Notes". */
  label?: string;
  /** The day the page was read (YYYY-MM-DD), from a record of that reading. */
  read_on?: string;
  /** When no reading was recorded: the day it had been checked against the source by. */
  checked?: string;
  /** The page read. */
  url: string;
  /** The Sources shelf card that presents the work. */
  shelf: string;
  /** The writer it counts as when a note's writers are counted. */
  key: string;
  /** False when the cite supports part of the note or is a reference work. */
  counts?: false;
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
