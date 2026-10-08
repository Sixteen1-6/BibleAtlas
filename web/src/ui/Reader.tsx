// Chapter reader: English (BSB or ESV) with the original-language text under
// each verse. Every original word opens its word study.

import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import { type Atlas, chapterRange } from '../data/atlas';
import { type EsvChapter, loadEsvChapter } from '../data/esv';
import { FLAG, type BookText, type WordRow, loadBook } from '../data/text';
import * as S from '../state';
import { PairedEnglish, PairedWords, PairsNote, pairsOn } from './Pairs';

function wordClass(w: WordRow, hit: boolean, shared: boolean): string {
  let c = 'w';
  if (w[5] & FLAG.variant) c += ' var';
  if (w[5] & FLAG.otherEditions) c += ' other';
  if (hit) c += ' hit';
  if (shared) c += ' shared';
  return c;
}

export function Reader({ a }: { a: Atlas }) {
  const { book, chapter } = S.reading.value;
  const [text, setText] = useState<BookText | null>(null);
  const [esv, setEsv] = useState<{ key: string; data?: EsvChapter; error?: string } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const b = a.books[book];
  const [start] = chapterRange(a, book, chapter);
  const isHebrew = b.testament === 'OT';
  const tr = S.translation.value;
  const studyRoot = S.study.value?.root ?? -1;
  const other = S.showOtherEditions.value;
  const inter = S.interlinear.value;

  useEffect(() => {
    let live = true;
    setText(null);
    loadBook(a, book).then((t) => live && setText(t));
    return () => {
      live = false;
    };
  }, [a, book]);

  useEffect(() => {
    if (tr !== 'ESV') return;
    const key = `${book}:${chapter}`;
    let live = true;
    setEsv({ key });
    loadEsvChapter(book, chapter)
      .then((data) => live && setEsv({ key, data }))
      .catch((e: Error) => live && setEsv({ key, error: e.message }));
    return () => {
      live = false;
    };
  }, [tr, book, chapter]);

  // Keep the selected verse in view.
  const sel = useComputed(() => S.selected.value);
  useEffect(() => {
    const v = sel.value;
    if (v === null || !text) return;
    root.current?.querySelector(`[data-v="${v}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [sel.value, text, chapter]);

  const go = (delta: number) => {
    let bk = book;
    let ch = chapter + delta;
    if (ch < 1) {
      if (bk === 0) return;
      bk--;
      ch = a.books[bk].chapters.length;
    } else if (ch > b.chapters.length) {
      if (bk === a.books.length - 1) return;
      bk++;
      ch = 1;
    }
    S.reading.value = { book: bk, chapter: ch };
    root.current?.scrollTo({ top: 0 });
  };

  const rows = text?.chapters[chapter - 1] ?? [];
  const esvReady = tr === 'ESV' && esv?.key === `${book}:${chapter}` ? esv : null;

  return (
    <div class="reader" ref={root}>
      <div class="readhead">
        <h1>
          {b.name} {chapter}
        </h1>
        <span class="muted">{isHebrew ? 'Hebrew' : 'Greek'} with {tr}</span>
        <div class="nav">
          <button class="btn" onClick={() => go(-1)} aria-label="Previous chapter">
            ‹ Prev
          </button>
          <button class="btn" onClick={() => go(1)} aria-label="Next chapter">
            Next ›
          </button>
        </div>
      </div>
      <div class="toggles">
        <button class="btn" aria-pressed={inter} onClick={() => (S.interlinear.value = !inter)}>
          Word by word
        </button>
        {inter && (
          <button class="btn" aria-pressed={pairsOn.value} onClick={() => (pairsOn.value = !pairsOn.value)} title="Color each original word and the English words it became">
            Color pairs
          </button>
        )}
        <button class="btn" aria-pressed={other} onClick={() => (S.showOtherEditions.value = !other)} title="Show words that appear only in other Greek editions or Hebrew manuscripts">
          Words from other editions
        </button>
      </div>
      {inter && pairsOn.value && <PairsNote hebrew={isHebrew} />}
      {tr === 'ESV' && esvReady?.error && <div class="notice">{esvReady.error} Showing the BSB instead.</div>}
      {!text && <p class="empty" style="max-width:760px;margin:0 auto">Loading {b.name}…</p>}
      <div class="verses">
        {rows.map((row, i) => {
          const v = start + i;
          const english = tr === 'ESV' && esvReady?.data ? esvReady.data.verses[String(i + 1)] ?? '' : row[0];
          const words = other ? row[1] : row[1].filter((w) => !(w[5] & FLAG.otherEditions));
          const xc = a.xOff[v + 1] - a.xOff[v] + a.xInOff[v + 1] - a.xInOff[v];
          const lang = isHebrew ? 'he' : 'gr';
          const indexOf = (w: WordRow) => row[1].indexOf(w);
          // Pairs follow the BSB, so they are off while the ESV is shown.
          const al = inter && pairsOn.value && !(tr === 'ESV' && esvReady?.data) ? row[2] : undefined;
          return (
            <div class={`verse${sel.value === v ? ' sel' : ''}`} key={v} data-v={v}>
              <div class="en" onClick={() => S.selectVerse(v)}>
                <button class="num" onClick={() => S.selectVerse(v)} aria-label={`Select verse ${i + 1}`}>
                  {i + 1}
                </button>
                {al ? <PairedEnglish v={v} text={english} al={al} /> : english || <span class="muted">{tr === 'ESV' && esvReady?.data ? 'The ESV does not include this verse in its main text.' : ''}</span>}
                {xc > 0 && <span class="xc">{xc} links</span>}
              </div>
              {al ? (
                <PairedWords v={v} row={row} al={al} hebrew={isHebrew} other={other} studyRoot={studyRoot} />
              ) : inter ? (
                <div class={`inter ${lang}`}>
                  {words.map((w) => (
                    <button key={indexOf(w)} class={`cell ${lang} ${wordClass(w, w[3] === studyRoot, false)}`} onClick={() => w[3] >= 0 && S.openRoot(w[3], v, indexOf(w))} title={w[4]}>
                      <span class="o">{w[0]}</span>
                      <span class="t">{w[1]}</span>
                      <span class="g">{w[2]}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div class={`orig ${lang}`} lang={isHebrew ? 'hbo' : 'grc'}>
                  {words.map((w) => (
                    <Fragment key={indexOf(w)}>
                      <button class={wordClass(w, w[3] === studyRoot, false)} onClick={() => w[3] >= 0 && S.openRoot(w[3], v, indexOf(w))} title={`${w[1]} · ${w[2]}`}>
                        {w[0]}
                      </button>{' '}
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {text && (
        <p class="copyright">
          {tr === 'ESV' && esvReady?.data ? (
            <>
              {esvReady.data.copyright} Read more at <a href="https://www.esv.org" target="_blank" rel="noopener">esv.org</a>.
            </>
          ) : (
            'English: Berean Standard Bible (public domain). '
          )}{' '}
          {isHebrew ? 'Hebrew and Aramaic: Leningrad Codex via STEPBible TAHOT (CC BY 4.0).' : 'Greek: STEPBible TAGNT, all major editions (CC BY 4.0).'}
        </p>
      )}
    </div>
  );
}
