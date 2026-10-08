// Pieces for building an extra's Panel so that every panel looks like the rest
// of the app and like each other: passages in the reading font, side by side
// when there is room, the original words at Deep, and a quiet source line.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { type Atlas, label, locate, rangeLabel, verseIndex } from '../../data/atlas';
import { type VerseRow, getVerse } from '../../data/text';
import { deepen } from '../../depth';
import * as S from '../../state';
import { OrigLine } from '../common';
import { levelAtLeast } from './level';
import { closeExtra } from './open';
import type { VerseRef } from './types';

/** The most verses one Passage shows. */
const MAX_VERSES = 80;

/** The name of a verse or passage as the app writes it: "Psalm 22:1",
 * "Mark 2:1–12", "Mark 1:40–2:12". */
export function refName(a: Atlas, verse: VerseRef, to?: VerseRef): string {
  return to === undefined || to <= verse ? label(a, verse) : rangeLabel(a, verse, to - verse + 1);
}

/** The app's link to a verse: "#v=Isa.40.3". */
export function verseHash(a: Atlas, verse: VerseRef): string {
  const l = locate(a, verse);
  return `#v=${a.books[l.book].osis}.${l.chapter}.${l.verse}`;
}

/** A verse from its OSIS id as the app writes it ("Isa.40.3", "1Pet.2.24",
 * "Ps.23.1"), or null if there is no such verse in the BSB numbering. Prefer
 * data keyed by verse number (see README); this is for ids that come from a source. */
export function verseOf(a: Atlas, osis: string): VerseRef | null {
  const [b, c, v] = osis.split('.');
  const book = a.books.findIndex((x) => x.osis === b);
  const ch = Number(c);
  const vs = Number(v);
  if (book < 0 || !Number.isInteger(ch) || !Number.isInteger(vs) || ch < 1 || vs < 1) return null;
  if (ch > a.books[book].chapters.length || vs > a.books[book].chapters[ch - 1]) return null;
  return verseIndex(a, book, ch, vs);
}

/** The verse rows (BSB English and the original words) from `from` to `to`,
 * or null while they load. Loads each verse's book on first use. */
export function usePassage(a: Atlas, from: VerseRef, to: VerseRef = from): VerseRow[] | null {
  const end = Math.min(Math.max(from, to), from + MAX_VERSES - 1, a.n - 1);
  const key = `${from}-${end}`;
  const [got, setGot] = useState<{ key: string; rows: VerseRow[] } | null>(null);
  useEffect(() => {
    let live = true;
    const vs: number[] = [];
    for (let v = from; v <= end; v++) vs.push(v);
    Promise.all(vs.map((v) => getVerse(a, v))).then(
      (rows) => live && setGot({ key, rows }),
      () => live && setGot({ key, rows: [] }),
    );
    return () => {
      live = false;
    };
  }, [a, key]);
  return got && got.key === key ? got.rows : null;
}

/** A passage: its name, which takes the reader there, and its words in the
 * BSB. At Deep the Hebrew or Greek sits under each verse. `note` is a short
 * plain line under the name, such as "Matthew, about John the Baptist". */
export function Passage({ a, from, to, navigate, note, children }: { a: Atlas; from: VerseRef; to?: VerseRef; navigate: (v: VerseRef) => void; note?: ComponentChildren; children?: ComponentChildren }) {
  const rows = usePassage(a, from, to);
  const deep = levelAtLeast('deep');
  const name = refName(a, from, to);
  const many = to !== undefined && to > from;
  return (
    <section class="xt-passage" aria-label={name}>
      <button type="button" class="xt-pref" onClick={() => navigate(from)} title={`Read ${name} in its chapter`}>
        {name} <span aria-hidden="true">›</span>
      </button>
      {note && <p class="xt-pnote">{note}</p>}
      {rows === null ? (
        <p class="xt-ptext xt-wait">…</p>
      ) : (
        rows.map((row, i) => (
          <div key={from + i} class="xt-pverse">
            <p class="xt-ptext">
              {many && <sup>{locate(a, from + i).verse}</sup>}
              {row[0]}
            </p>
            {deep && row[1].length > 0 && (
              <div class="xt-porig" onClickCapture={noteStudy} onClick={yieldToStudy}>
                <OrigLine a={a} v={from + i} row={row} />
              </div>
            )}
          </div>
        ))
      )}
      {children}
    </section>
  );
}

// A tap on an original word opens its word study in the study column, under
// the panel, so the panel then gives way. It closes on the way back up from the
// word, after the word's own click has run: closing first would take the word
// off the page before it could act. A word with no study leaves the panel open.
let studyBefore: unknown;
function noteStudy() {
  studyBefore = S.study.peek();
}
function yieldToStudy() {
  if (S.study.peek() !== studyBefore) closeExtra('quiet');
}

/** Passages next to each other when the panel has room (desktop), one above
 * the other when it does not (phones). */
export function SideBySide({ children }: { children: ComponentChildren }) {
  return <div class="xt-cols">{children}</div>;
}

/** The plain sentence at the top of a panel, in the reading font. */
export function Lead({ children }: { children: ComponentChildren }) {
  return <p class="xt-lead">{children}</p>;
}

/** A small plain label for anything uncertain, next to what it qualifies:
 * <Unsure>location uncertain</Unsure>, <Unsure>scholars differ</Unsure>. */
export function Unsure({ children, title }: { children: ComponentChildren; title?: string }) {
  return (
    <span class="xt-unsure" title={title}>
      {children}
    </span>
  );
}

/** The data behind a panel, for Deep: short label and value pairs, such as
 * [['Source', 'OpenBible.info'], ['Confidence', 'about 80 in 100']]. */
export function Facts({ rows }: { rows: readonly (readonly [ComponentChildren, ComponentChildren])[] }) {
  return (
    <dl class="xt-facts">
      {rows.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A quiet credit at the bottom of a panel, with a way to every source and checksum. */
export function SourceNote({ children }: { children: ComponentChildren }) {
  return (
    <p class="xt-source">
      {children}{' '}
      <button type="button" onClick={showSources}>
        All sources
      </button>
    </p>
  );
}

/** Open a word study from a panel. The panel closes first, because the word
 * study opens where the panel was. */
export function openWord(root: number, verse?: VerseRef, pos?: number): void {
  closeExtra('quiet');
  S.openRoot(root, verse, pos);
}

/** Open the Sources screen (it lives at Deep), closing the panel. */
export function showSources(): void {
  closeExtra('quiet');
  deepen('deep');
  S.tab.value = 'sources';
  S.mobilePane.value = 'study';
}
