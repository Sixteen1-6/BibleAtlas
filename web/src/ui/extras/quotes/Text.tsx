// A passage the way the kit's <Passage> shows it (same markup and classes), plus
// what quotations need: the words two passages share marked, the words around
// a quotation in a quieter colour, and at Deep the Hebrew or Greek with the
// paired words underlined, each opening its word study.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { type Atlas, locate } from '../../../data/atlas';
import { FLAG, type VerseRow, type WordRow, getVerse } from '../../../data/text';
import { openWord, refName, usePassage } from '../kit';
import { levelAtLeast } from '../level';
import type { VerseRef } from '../types';

/** Places in a verse's English, [start, end) in UTF-16 units, by verse. */
export type Spans = Map<VerseRef, [number, number][]>;

export function addSpan(m: Spans, v: VerseRef, s: number, e: number): void {
  if (!(e > s)) return;
  const list = m.get(v);
  if (list) list.push([s, e]);
  else m.set(v, [[s, e]]);
}

/** The places in `h` rows ([verse, start, end, start, end, ...]) that lie in from..to. */
export function addRows(m: Spans, rows: readonly number[][] | undefined, from: VerseRef, to: VerseRef): void {
  for (const row of rows ?? []) {
    const v = row[0];
    if (v < from || v > to) continue;
    for (let j = 1; j + 1 < row.length; j += 2) addSpan(m, v, row[j], row[j + 1]);
  }
}

function merged(list: readonly [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [s, e] of [...list].sort((x, y) => x[0] - y[0])) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

function within(list: readonly [number, number][], at: number): boolean {
  return list.some(([s, e]) => s <= at && at < e);
}

/**
 * A verse's English with `marks` highlighted. With `quoted`, the words outside
 * it are quieter; without it, all of the verse counts as quoted.
 */
function Marked({ text, marks, quoted }: { text: string; marks?: [number, number][]; quoted?: [number, number][] }) {
  const m = merged(marks ?? []);
  const q = quoted ? merged(quoted) : undefined;
  if (!m.length && !q) return <>{text}</>;
  const cuts = new Set<number>([0, text.length]);
  for (const [s, e] of [...m, ...(q ?? [])]) {
    cuts.add(Math.max(0, Math.min(text.length, s)));
    cuts.add(Math.max(0, Math.min(text.length, e)));
  }
  const at = [...cuts].sort((x, y) => x - y);
  const out: ComponentChildren[] = [];
  let run = '';
  let kind = '';
  const flush = () => {
    if (!run) return;
    const inQuote = kind[0] === 'q';
    const marked = kind[1] === 'm';
    const key = out.length;
    const words = marked ? <mark key={key} class="x-quotes-mark">{run}</mark> : run;
    out.push(inQuote ? words : <span key={key} class="x-quotes-around">{words}</span>);
    run = '';
  };
  for (let i = 0; i + 1 < at.length; i++) {
    const [s, e] = [at[i], at[i + 1]];
    if (e <= s) continue;
    const k = `${!q || within(q, s) ? 'q' : '-'}${within(m, s) ? 'm' : '-'}`;
    if (k !== kind) {
      flush();
      kind = k;
    }
    run += text.slice(s, e);
  }
  flush();
  return <>{out}</>;
}

/** The Hebrew or Greek of a verse, as the app's OrigLine shows it, with the
 * words in `paired` underlined. Each word opens its word study. */
function Orig({ a, v, row, paired }: { a: Atlas; v: VerseRef; row: VerseRow; paired?: Set<number> }) {
  const he = !isNtVerse(a, v);
  return (
    <div class="xt-porig">
      <div class={`orig ${he ? 'he' : 'gr'}`} lang={he ? 'hbo' : 'grc'}>
        {row[1].map((w, pos) =>
          w[5] & FLAG.otherEditions ? null : (
            <span key={pos}>
              <button
                type="button"
                class={`w${paired?.has(pos) ? ' shared' : ''}${w[5] & FLAG.variant ? ' var' : ''}`}
                data-lr={w[3] >= 0 ? w[3] : undefined}
                onClick={() => w[3] >= 0 && openWord(w[3], v, pos)}
                title={`${w[1]} · ${w[2]}`}
              >
                {w[0]}
              </button>{' '}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

function isNtVerse(a: Atlas, v: VerseRef): boolean {
  return a.books[a.verseBook[v]].testament === 'NT';
}

/**
 * A passage: its name (which takes the reader there), short plain notes under
 * it, and its words in the BSB, with the shared words marked. At Deep the
 * Hebrew or Greek sits under each verse.
 */
export function QPassage({
  a,
  from,
  to,
  navigate,
  notes,
  marks,
  quoted,
  paired,
}: {
  a: Atlas;
  from: VerseRef;
  to: VerseRef;
  navigate: (v: VerseRef) => void;
  notes?: ComponentChildren[];
  marks?: Spans;
  /** The quoted words, when known; the rest of each verse is quieter. */
  quoted?: Spans;
  /** Word positions paired with the other passage, by verse. */
  paired?: Map<VerseRef, Set<number>>;
}) {
  const rows = usePassage(a, from, to);
  const deep = levelAtLeast('deep');
  const name = refName(a, from, to);
  const many = to > from;
  return (
    <section class="xt-passage" aria-label={name}>
      <button type="button" class="xt-pref" data-lv={from} onClick={() => navigate(from)} title={`Read ${name} in its chapter`}>
        {name} <span aria-hidden="true">›</span>
      </button>
      {(notes ?? []).map((n, i) => (
        <p key={i} class="xt-pnote">
          {n}
        </p>
      ))}
      {rows === null ? (
        <p class="xt-ptext xt-wait">…</p>
      ) : (
        rows.map((row, i) => {
          const v = from + i;
          return (
            <div key={v} class="xt-pverse" data-lv={v}>
              <p class="xt-ptext">
                {many && <sup>{locate(a, v).verse}</sup>}
                <Marked text={row[0]} marks={marks?.get(v)} quoted={quoted ? quoted.get(v) ?? [] : undefined} />
              </p>
              {deep && row[1].length > 0 && <Orig a={a} v={v} row={row} paired={paired?.get(v)} />}
            </div>
          );
        })
      )}
    </section>
  );
}

/** Verse rows for a set of verses, or null while they load. */
export function useRows(a: Atlas, verses: readonly VerseRef[]): Map<VerseRef, VerseRow> | null {
  const key = verses.join(',');
  const [got, setGot] = useState<{ key: string; rows: Map<VerseRef, VerseRow> } | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(verses.map((v) => getVerse(a, v))).then(
      (rows) => live && setGot({ key, rows: new Map(verses.map((v, i) => [v, rows[i]])) }),
      () => live && setGot({ key, rows: new Map() }),
    );
    return () => {
      live = false;
    };
  }, [a, key]);
  return got && got.key === key ? got.rows : null;
}

/** A word without the punctuation that follows it in the text. */
function bare(w: WordRow): string {
  return w[0].replace(/[\s,.;:!?·;·¶׃׀־]+$/u, '');
}

/** One word of a pair: the word, which opens its word study, and its sense here. */
export function PairWord({ a, v, pos, row }: { a: Atlas; v: VerseRef; pos: number; row: VerseRow | undefined }) {
  const w = row?.[1][pos];
  if (!w) return <span class="x-quotes-pw" />;
  const he = !isNtVerse(a, v);
  const word = bare(w);
  return (
    <span class="x-quotes-pw">
      {w[3] >= 0 ? (
        <button type="button" class={`x-quotes-word ${he ? 'he' : 'gr'}`} lang={he ? 'hbo' : 'grc'} data-lr={w[3]} onClick={() => openWord(w[3], v, pos)} title={`${w[1]}: open the word study`}>
          {word}
        </button>
      ) : (
        <span class={`x-quotes-word ${he ? 'he' : 'gr'}`} lang={he ? 'hbo' : 'grc'}>
          {word}
        </span>
      )}
      <span class="x-quotes-gloss">{w[2]}</span>
    </span>
  );
}
