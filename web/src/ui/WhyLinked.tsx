// Why a link between the testaments holds together at the level of the words:
// a Hebrew word of the Old Testament verse that the Greek Old Testament (the
// Septuagint) translates with a Greek word the New Testament verse uses.
//
// Simple first: the rarest bridge as two word chips joined by a small arc of
// light, and one plain sentence. The other bridges, what the Septuagint is and
// where the pairs come from are one tap away.

import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Atlas } from '../data/atlas';
import { type Bridge, bridgeTable, bridges, loadBridges } from '../data/bridges';
import type { VerseRow } from '../data/text';
import { Provenance, RootChip, useVerseRow } from './common';
import './bridges.css';

const isOT = (a: Atlas, v: number) => a.books[a.verseBook[v]].testament === 'OT';

/** The bridge table, loaded on first use; re-renders once it arrives. */
function useBridgeTable(a: Atlas, wanted: boolean) {
  const table = bridgeTable(a);
  const [, arrived] = useState(0);
  useEffect(() => {
    if (!wanted || table) return;
    let live = true;
    loadBridges(a).then(
      () => live && arrived((n) => n + 1),
      () => {}, // No bridges this time; the link still shows as before.
    );
    return () => {
      live = false;
    };
  }, [a, wanted, table]);
  return wanted ? table : null;
}

function Greek({ a, root }: { a: Atlas; root: number }) {
  return (
    <span class="gr br-w" lang="grc">
      {a.lemmas.word[root]}
    </span>
  );
}

function Hebrew({ a, root }: { a: Atlas; root: number }) {
  return (
    <bdi class="he br-w" lang={a.lemmas.lang[root] === 'A' ? 'arc' : 'hbo'}>
      {a.lemmas.word[root]}
    </bdi>
  );
}

/** Hebrew chip, an arc, Greek chip: tap either word for its word study. */
function Pair({ a, b }: { a: Atlas; b: Bridge }) {
  const L = a.lemmas;
  return (
    <div class="br-pair" role="group" aria-label={`Word bridge: ${L.gloss[b.hebrew]} in Hebrew, ${L.gloss[b.greek]} in Greek`}>
      <RootChip a={a} root={b.hebrew} />
      <svg class="br-arc" viewBox="0 0 34 16" aria-hidden="true">
        <path d="M3 14 C 9 1, 25 1, 31 14" />
        <circle cx="31" cy="14" r="1.9" />
      </svg>
      <RootChip a={a} root={b.greek} />
    </div>
  );
}

/**
 * Word bridges between two linked verses, one in each testament. Renders
 * nothing when both are in the same testament or no bridge is known. Pass
 * the verse rows if they are already loading (null while they load);
 * otherwise they are fetched here.
 */
export function WhyLinked({ a, from, to, fromRow, toRow }: { a: Atlas; from: number; to: number; fromRow?: VerseRow | null; toRow?: VerseRow | null }) {
  const crosses = isOT(a, from) !== isOT(a, to);
  const ownFrom = useVerseRow(a, crosses && fromRow === undefined ? from : null);
  const ownTo = useVerseRow(a, crosses && toRow === undefined ? to : null);
  const table = useBridgeTable(a, crosses);
  const [open, setOpen] = useState(false);
  const rf = fromRow === undefined ? ownFrom : fromRow;
  const rt = toRow === undefined ? ownTo : toRow;
  const found = useMemo(() => {
    if (!crosses || !table || !rf || !rt) return [];
    return isOT(a, from) ? bridges(a, rf, rt) : bridges(a, rt, rf);
  }, [a, crosses, table, rf, rt, from]);
  if (!found.length) return null;

  const [first, ...rest] = found;
  const id = `br-${from}-${to}`;
  const toggle = open ? 'Less' : rest.length ? `${rest.length} more ${rest.length === 1 ? 'bridge' : 'bridges'}` : 'How we know';
  return (
    <div class="br" onClick={(e) => e.stopPropagation()}>
      <Pair a={a} b={first} />
      <p class="br-says">
        The Greek Old Testament (the Septuagint) uses <Greek a={a} root={first.greek} /> for <Hebrew a={a} root={first.hebrew} />.{' '}
        <button class="br-more" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
          {toggle}
        </button>
      </p>
      {open && (
        <div class="br-deep" id={id}>
          {rest.map((b) => (
            <div key={`${b.greek}-${b.hebrew}`} class="br-item">
              <Pair a={a} b={b} />
              <p class="br-says">
                The Septuagint also uses <Greek a={a} root={b.greek} /> for <Hebrew a={a} root={b.hebrew} />.
              </p>
            </div>
          ))}
          <p class="br-note">
            The Septuagint is the ancient Greek translation of the Old Testament. A word bridge pairs a Hebrew word of the Old Testament verse with the Greek word the Septuagint uses for it, when the New
            Testament verse has that Greek word too. Tap a word for its full lexicon entry, with the verses Abbott-Smith cites.
          </p>
          <div class="br-prov">
            <Provenance>Word bridges: Abbott-Smith’s notes on Septuagint usage, in STEPBible’s TBESG (CC BY 4.0).</Provenance>
          </div>
        </div>
      )}
    </div>
  );
}
