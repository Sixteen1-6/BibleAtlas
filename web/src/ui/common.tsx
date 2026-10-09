// Small shared pieces for the study panels.

import { useEffect, useState } from 'preact/hooks';
import { type Atlas, chapterName, langName } from '../data/atlas';
import { FLAG, type VerseRow, getVerse, rootsOf } from '../data/text';
import { deepen } from '../depth';
import * as S from '../state';
import { GENRE } from './colors';

export function useVerseRow(a: Atlas, v: number | null | undefined): VerseRow | null {
  const [row, setRow] = useState<{ v: number; row: VerseRow } | null>(null);
  useEffect(() => {
    if (v === null || v === undefined) return;
    let live = true;
    getVerse(a, v).then((r) => live && setRow({ v, row: r }));
    return () => {
      live = false;
    };
  }, [a, v]);
  return row && row.v === v ? row.row : null;
}

export function Snippet({ a, v, max = 180 }: { a: Atlas; v: number; max?: number }) {
  const row = useVerseRow(a, v);
  if (!row) return <span class="snip">…</span>;
  const t = row[0];
  return <span class="snip">{t.length > max ? t.slice(0, max - 1) + '…' : t}</span>;
}

/** Original-language line for a verse; `mark` highlights roots. */
export function OrigLine({ a, v, row, mark }: { a: Atlas; v: number; row: VerseRow; mark?: Set<number> }) {
  const he = a.books[a.verseBook[v]].testament === 'OT';
  return (
    <div class={`orig ${he ? 'he' : 'gr'}`} lang={he ? 'hbo' : 'grc'}>
      {row[1]
        .filter((w) => !(w[5] & FLAG.otherEditions))
        .map((w, i) => (
          <span key={i}>
            <button class={`w${mark?.has(w[3]) ? ' shared' : ''}${w[5] & FLAG.variant ? ' var' : ''}`} onClick={() => w[3] >= 0 && S.openRoot(w[3], v, row[1].indexOf(w))} title={`${w[1]} · ${w[2]}`}>
              {w[0]}
            </button>{' '}
          </span>
        ))}
    </div>
  );
}

/** Roots two verses share, rarest first (very common words like "and" are skipped). */
export function sharedRoots(a: Atlas, x: VerseRow, y: VerseRow, max = 4): number[] {
  const rx = rootsOf(x);
  const out: number[] = [];
  for (const r of rootsOf(y)) if (rx.has(r) && a.lemmas.count[r] < 1500) out.push(r);
  out.sort((p, q) => a.lemmas.count[p] - a.lemmas.count[q]);
  return out.slice(0, max);
}

export function RootChip({ a, root }: { a: Atlas; root: number }) {
  const L = a.lemmas;
  const lang = L.lang[root];
  return (
    <button class="chip" onClick={(e) => (e.stopPropagation(), S.openRoot(root))} title={`${langName(L, root)} ${L.key[root]}, ${L.count[root]} occurrences`}>
      <span class={`o ${lang === 'G' ? 'gr' : 'he'}`}>{L.word[root]}</span>
      <span>{L.gloss[root]}</span>
    </button>
  );
}

/** Bar per book showing how a set of verses is spread across the Bible. */
export function Distribution({ a, verses, height = 64 }: { a: Atlas; verses: ArrayLike<number>; height?: number }) {
  const B = a.books.length;
  const counts = new Array<number>(B).fill(0);
  for (let i = 0; i < verses.length; i++) counts[a.verseBook[verses[i]]]++;
  const max = Math.max(1, ...counts);
  const w = 400;
  const bw = w / B;
  const top = counts
    .map((c, i) => [c, i] as const)
    .sort((x, y) => y[0] - x[0])
    .slice(0, 3)
    .filter((x) => x[0] > 0);
  return (
    <figure style="margin:0">
      <svg class="dist" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Spread across the 66 books. Most in ${top.map(([c, i]) => `${a.books[i].name} (${c})`).join(', ')}`}>
        <line x1={bw * 39} x2={bw * 39} y1={0} y2={height} stroke="var(--line)" />
        {counts.map((c, i) => (
          <rect key={i} x={i * bw + 0.5} width={bw - 1} y={height - (c / max) * (height - 4)} height={(c / max) * (height - 4)} fill={GENRE[a.books[i].genre].color}>
            <title>
              {a.books[i].name}: {c}
            </title>
          </rect>
        ))}
      </svg>
      <figcaption class="muted" style="font-size:12px;display:flex;justify-content:space-between">
        <span>Genesis</span>
        <span>{top.map(([c, i]) => `${chapterName(a.books[i])} ${c}`).join(' · ')}</span>
        <span>Revelation</span>
      </figcaption>
    </figure>
  );
}

export function Provenance({ children }: { children: preact.ComponentChildren }) {
  return (
    <p class="provenance">
      {children}{' '}
      <button
        onClick={() => {
          // The Sources tab is Deep material; asking for it goes that deep.
          deepen('deep');
          S.tab.value = 'sources';
        }}
      >
        All sources and checksums
      </button>
    </p>
  );
}
