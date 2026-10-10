// Chapter reader: English (BSB or ESV) with the original-language text under
// each verse. Every original word opens its word study.

import { Fragment } from 'preact';
import { ChapterWhen } from './ChapterWhen';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import { type Atlas, chapterName, chapterRange, linkCount } from '../data/atlas';
import { type EsvChapter, loadEsvChapter } from '../data/esv';
import { passages } from '../data/layers';
import { ChapterExtras, VerseExtras } from './extras/VerseExtras';
import { FLAG, type BookText, type WordRow, loadBook } from '../data/text';
import { atLeast } from '../depth';
import * as S from '../state';
import { PairedEnglish, PairedWords, PairsNote, pairsOn } from './Pairs';
import { Welcome } from './Welcome';

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
  const [loaded, setLoaded] = useState<BookText | null>(null);
  const [esv, setEsv] = useState<{ key: string; data?: EsvChapter; error?: string } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const b = a.books[book];
  // Until the new book arrives, show nothing rather than the last book's text.
  const text = loaded?.book === b.osis ? loaded : null;
  const [start] = chapterRange(a, book, chapter);
  const isHebrew = b.testament === 'OT';
  const tr = S.translation.value;
  const studyRoot = S.study.value?.root ?? -1;
  // Simple shows the English alone; Study adds the original words; Deep adds
  // words found only in other editions.
  const orig = atLeast('study');
  const other = S.showOtherEditions.value && atLeast('deep');
  const inter = S.interlinear.value;

  useEffect(() => {
    let live = true;
    loadBook(a, book).then((t) => live && setLoaded(t));
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

  // Keep the selected verse in view. The Hebrew and Greek fonts load after the
  // text and reflow it, so center again as the layout settles, until the
  // reader scrolls on their own.
  const sel = useComputed(() => S.selected.value);
  useEffect(() => {
    const v = sel.value;
    const box = root.current;
    if (v === null || !text || !box) return;
    if (S.holdReaderScroll.peek() === v) {
      S.holdReaderScroll.value = null;
      return;
    }
    let user = false;
    const stop = () => (user = true);
    const center = () => {
      const el = box.querySelector<HTMLElement>(`[data-v="${v}"]`);
      if (user || !el) return;
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (r.top >= b.top && r.bottom <= b.bottom) return;
      box.scrollTop += r.top - b.top - Math.max(16, (b.height - r.height) / 2);
    };
    center();
    document.fonts?.ready.then(center);
    const ro = new ResizeObserver(center);
    const list = box.querySelector('.verses');
    if (list) ro.observe(list);
    const done = window.setTimeout(() => ro.disconnect(), 4000);
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    for (const ev of events) box.addEventListener(ev, stop, { passive: true });
    return () => {
      user = true;
      ro.disconnect();
      window.clearTimeout(done);
      for (const ev of events) box.removeEventListener(ev, stop);
    };
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
  const aramaicRows = isHebrew ? rows.filter((r) => r[1].some((w) => w[5] & FLAG.aramaic)).length : 0; // Daniel 2–7, Ezra 4–7, Jeremiah 10
  const layered = new Set(passages.value.map((p) => p.v));
  const esvReady = tr === 'ESV' && esv?.key === `${book}:${chapter}` ? esv : null;

  return (
    <div class="reader" ref={root}>
      <Welcome />
      <div class="readhead">
        <h1>
          {chapterName(b)} {chapter}
        </h1>
        <span class="muted">{orig ? `${!isHebrew ? 'Greek' : aramaicRows === 0 ? 'Hebrew' : aramaicRows === rows.length ? 'Aramaic' : 'Hebrew and Aramaic'} with ${tr}` : tr === 'ESV' ? 'English Standard Version' : 'Berean Standard Bible'}</span>
        <div class="nav">
          <button class="btn" onClick={() => go(-1)} aria-label="Previous chapter">
            ‹ Prev
          </button>
          <button class="btn" onClick={() => go(1)} aria-label="Next chapter">
            Next ›
          </button>
        </div>
      </div>
      {orig && (
        <div class="toggles">
          <button class="btn" aria-pressed={inter} onClick={() => (S.interlinear.value = !inter)}>
            Word by word
          </button>
          {inter && (
            <button class="btn" aria-pressed={pairsOn.value} onClick={() => (pairsOn.value = !pairsOn.value)} title="Color each original word and the English words it became">
              Color pairs
            </button>
          )}
          {atLeast('deep') && (
            <button class="btn" aria-pressed={other} onClick={() => (S.showOtherEditions.value = !other)} title="Show words that appear only in other Greek editions or Hebrew manuscripts">
              Words from other editions
            </button>
          )}
          <span class="hint">{S.TAP} a Hebrew or Greek word to study it.</span>
        </div>
      )}
      {orig && inter && pairsOn.value && <PairsNote hebrew={isHebrew} />}
      {tr === 'ESV' && esvReady?.error && <div class="notice">{esvReady.error} Showing the BSB instead.</div>}
      {!text && <p class="empty" style="max-width:760px;margin:0 auto">Loading {b.name}…</p>}
      <ChapterExtras a={a} book={book} chapter={chapter} />
      <div class="verses">
        {rows.map((row, i) => {
          const v = start + i;
          const english = tr === 'ESV' && esvReady?.data ? esvReady.data.verses[String(i + 1)] ?? '' : row[0];
          const words = other ? row[1] : row[1].filter((w) => !(w[5] & FLAG.otherEditions));
          const xc = linkCount(a, v);
          const lang = isHebrew ? 'he' : 'gr';
          const indexOf = (w: WordRow) => row[1].indexOf(w);
          // Pairs follow the BSB, so they are off while the ESV is shown.
          const al = orig && inter && pairsOn.value && !(tr === 'ESV' && esvReady?.data) ? row[2] : undefined;
          return (
            <div class={`verse${sel.value === v ? ' sel' : ''}`} key={v} data-v={v} data-lv={v}>
              <div class="en" onClick={() => S.selectVerse(v)}>
                <button class="num" onClick={() => S.selectVerse(v)} aria-label={`Select verse ${i + 1}`}>
                  {i + 1}
                </button>
                {al ? <PairedEnglish v={v} text={english} al={al} /> : english || <span class="muted">{tr === 'ESV' && esvReady?.data ? 'The ESV does not include this verse in its main text.' : ''}</span>}
                {xc > 0 && (
                  <button
                    class="xc"
                    onClick={(e) => {
                      e.stopPropagation();
                      S.selectVerse(v, { openTab: true });
                      S.mobilePane.value = 'study';
                    }}
                    aria-label={`Show the ${xc} links for verse ${i + 1}`}
                  >
                    {xc} {xc === 1 ? 'link' : 'links'} ›
                  </button>
                )}
                {layered.has(v) && (
                  <button
                    class="xc layersmark"
                    onClick={(e) => {
                      e.stopPropagation();
                      S.selectVerse(v, { openTab: true });
                      S.mobilePane.value = 'study';
                    }}
                    title="This verse has layers of meaning"
                  >
                    Layers ›
                  </button>
                )}
              </div>
              {!orig ? null : al ? (
                <PairedWords v={v} row={row} al={al} hebrew={isHebrew} other={other} studyRoot={studyRoot} />
              ) : inter ? (
                <div class={`inter ${lang}`}>
                  {words.map((w) => (
                    <button key={indexOf(w)} class={`cell ${lang} ${wordClass(w, w[3] === studyRoot, false)}`} data-lr={w[3] >= 0 ? w[3] : undefined} onClick={() => w[3] >= 0 && S.openRoot(w[3], v, indexOf(w))} title={w[4]}>
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
                      <button class={wordClass(w, w[3] === studyRoot, false)} data-lr={w[3] >= 0 ? w[3] : undefined} onClick={() => w[3] >= 0 && S.openRoot(w[3], v, indexOf(w))} title={`${w[1]} · ${w[2]}`}>
                        {w[0]}
                      </button>{' '}
                    </Fragment>
                  ))}
                </div>
              )}
              {sel.value === v && <VerseExtras a={a} verse={v} />}
            </div>
          );
        })}
      </div>
      <ChapterWhen a={a} book={book} chapter={chapter} ready={!!text} />
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
