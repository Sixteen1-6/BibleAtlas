// Chapter reader: English (BSB, NET or ESV) with the original-language text under
// each verse. Every original word opens its word study.

import { Fragment } from 'preact';
import { ChapterWhen } from './ChapterWhen';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import { type Atlas, chapterName, chapterRange, linkCount } from '../data/atlas';
import { type EsvChapter, loadEsvChapter } from '../data/esv';
import { type NetChapter, NET_COPYRIGHT, NET_COPYRIGHT_LINK, NET_COPYRIGHT_URL, NET_HOME, NET_SERVICE, loadNetChapter, netVerseUrl } from '../data/net';
import { passages } from '../data/layers';
import { ChapterExtras, VerseExtras } from './extras/VerseExtras';
import { FLAG, LINE, type BookText, type WordRow, loadBook } from '../data/text';
import { atLeast } from '../depth';
import * as S from '../state';
import { ASKS } from './commentary/Gate';
import { accepted, askNotice } from './commentary/state';
import { CardLink, PairedEnglish, PairedWords, PairsNote, WordsNote, grammarTip, pairsOn } from './Pairs';
import { Welcome } from './Welcome';
import { TourBar } from './TourBar';
import { READ_AFTER_MS, markRead } from '../data/reading';
import { OMITTED } from './common';

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
  const [net, setNet] = useState<{ key: string; data?: NetChapter; error?: string } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const b = a.books[book];
  // Until the new book arrives, show nothing rather than the last book's text.
  const text = loaded?.book === b.osis ? loaded : null;
  const [start] = chapterRange(a, book, chapter);
  const isHebrew = b.testament === 'OT';
  const tr = S.translation.value;
  const studyRoot = S.study.value?.root ?? -1;
  // The studied word's relatives (ἀγαπάω beside ἀγάπη) are underlined.
  const kin = S.studyKin.value;
  // Simple shows the English alone; Study adds the original words; Deep adds
  // words found only in other editions.
  const orig = atLeast('study');
  const other = S.showOtherEditions.value && atLeast('deep');
  const inter = S.interlinear.value;
  // Side by side: the version being read, then its partner. The BSB's partner
  // is the NET, read live like the NET itself; the NET's and the ESV's is the BSB.
  const side = orig && S.sideBySide.value === 'on';
  const partner = tr === 'BSB' ? 'NET' : 'BSB';
  const netWanted = tr === 'NET' || (side && tr === 'BSB');

  // A chapter open for half a minute counts as read (data/reading.ts).
  useEffect(() => {
    const c = a.bookChapterStart[book] + chapter - 1;
    const t = setTimeout(() => markRead(c), READ_AFTER_MS);
    return () => clearTimeout(t);
  }, [a, book, chapter]);

  useEffect(() => {
    let live = true;
    loadBook(a, book).then((t) => live && setLoaded(t));
    return () => {
      live = false;
    };
  }, [a, book]);

  useEffect(() => {
    if (!netWanted) return;
    const key = `${book}:${chapter}`;
    let live = true;
    setNet({ key });
    loadNetChapter(book, chapter)
      .then((data) => live && setNet({ key, data }))
      .catch((e: Error) => live && setNet({ key, error: e.message }));
    return () => {
      live = false;
    };
  }, [netWanted, book, chapter]);

  // The translators' notes stay on netbible.org: the selected verse links to them.
  // They are the NET's own commentary, so the link waits for the commentary notice.
  const notesOn = S.netNotes.value && accepted.value;
  const notesWanted = tr === 'NET' && orig && notesOn;
  const toggleNotes = () => {
    if (notesOn) S.netNotes.value = false;
    else if (accepted.peek()) S.netNotes.value = true;
    else void askNotice().then((ok) => ok && (S.netNotes.value = true));
  };

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
  const netReady = netWanted && net?.key === `${book}:${chapter}` ? net : null;
  // The verses of the version being read, when it is not the BSB and has arrived.
  const liveVerses = tr === 'BSB' ? null : (esvReady?.data?.verses ?? netReady?.data?.verses ?? null);
  // The partner's verses: the NET's beside the BSB once they arrive, or the
  // BSB's own beside a version that has arrived.
  const sideVerses = !side ? null : tr === 'BSB' ? (netReady?.data?.verses ?? null) : liveVerses ? 'BSB' : null;
  const showNetCredit = !!netReady?.data && (tr === 'NET' || sideVerses !== null);
  const VERSION_LONG = { BSB: 'Berean Standard Bible', NET: 'NET Bible', ESV: 'English Standard Version' } as const;
  // The NET acknowledgment around its address, which is shown as a link.
  const [netBefore, netAfter] = NET_COPYRIGHT.split(NET_COPYRIGHT_URL);
  // Each English version on the page is credited, the one being read first.
  const mainEsv = tr === 'ESV' && !!esvReady?.data;
  const mainNet = tr === 'NET' && !!netReady?.data;
  const bsbShown = !mainEsv && !mainNet;
  const netCredit = (
    <>
      English: NET Bible (
      <a href={NET_HOME} target="_blank" rel="noopener">
        NET
      </a>
      ). {netBefore}
      <a href={NET_COPYRIGHT_LINK} target="_blank" rel="noopener">
        {NET_COPYRIGHT_URL}
      </a>
      {netAfter} Read live from{' '}
      <a href={NET_SERVICE} target="_blank" rel="noopener">
        labs.bible.org
      </a>
      .{' '}
    </>
  );
  // How many alignment links the build left out (meta.json, written by align.rs).
  const leftOut = (a.meta as typeof a.meta & { alignment?: { shiftedLinksLeftOut?: number } }).alignment?.shiftedLinksLeftOut;

  return (
    <div class="reader" ref={root}>
      <TourBar />
      <Welcome />
      <div class="readhead">
        <h1>
          {chapterName(b)} {chapter}
        </h1>
        <span class="muted">{orig ? `${!isHebrew ? 'Greek' : aramaicRows === 0 ? 'Hebrew' : aramaicRows === rows.length ? 'Aramaic' : 'Hebrew and Aramaic'} with ${sideVerses ? `${tr} and ${partner}` : tr}` : VERSION_LONG[tr]}</span>
        <div class="nav">
          <button class="btn" onClick={() => go(-1)} aria-label="Previous chapter" title="Previous chapter. The J and K keys step through the verses.">
            ‹ Prev
          </button>
          <button class="btn" onClick={() => go(1)} aria-label="Next chapter" title="Next chapter. The J and K keys step through the verses.">
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
          <button class="btn" aria-pressed={side} onClick={() => (S.sideBySide.value = side ? 'off' : 'on')} title={`Show the ${tr} and the ${partner} side by side, verse by verse`}>
            Side by side
          </button>
          {tr === 'NET' && (
            <button class="btn" aria-pressed={notesOn} onClick={toggleNotes} {...(accepted.value ? {} : ASKS)} title="A link under the selected verse to the NET translators’ own notes on netbible.org: why they chose their words, and other ways to read the Hebrew and Greek">
              Translators’ notes
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
      {orig && inter && <WordsNote hebrew={isHebrew} />}
      {orig && inter && pairsOn.value && !liveVerses && <PairsNote hebrew={isHebrew} leftOut={leftOut} />}
      {tr === 'ESV' && esvReady?.error && <div class="notice">{esvReady.error} Showing the BSB instead.</div>}
      {netReady?.error && (
        <div class="notice">
          The NET could not be loaded just now ({netReady.error.replace(/\.$/, '')}). Showing the BSB {tr === 'NET' ? 'instead' : 'alone'}.
        </div>
      )}
      {netReady && !netReady.data && !netReady.error && <p class="muted" style="max-width:760px;margin:0 auto">Loading the NET…</p>}
      {!text && <p class="empty" style="max-width:760px;margin:0 auto">Loading {b.name}…</p>}
      <ChapterExtras a={a} book={book} chapter={chapter} />
      <div class={sideVerses ? 'verses two' : 'verses'}>
        {sideVerses && (
          <div class="sidehead" aria-hidden="true">
            <span>{VERSION_LONG[tr]}</span>
            <span>{VERSION_LONG[partner]}</span>
          </div>
        )}
        {rows.map((row, i) => {
          const v = start + i;
          const english = liveVerses ? liveVerses[String(i + 1)] ?? '' : row[0];
          const words = other ? row[1] : row[1].filter((w) => !(w[5] & FLAG.otherEditions));
          const xc = linkCount(a, v);
          const lang = isHebrew ? 'he' : 'gr';
          const indexOf = (w: WordRow) => row[1].indexOf(w);
          // Pairs follow the BSB, so they are off while another version is shown.
          const al = orig && inter && pairsOn.value && !liveVerses ? row[2] : undefined;
          const poem = text?.lines?.[`${chapter}.${i + 1}`];
          // The partner's words for this verse, beside the main text.
          const other2 = sideVerses === 'BSB' ? row[0] : sideVerses ? sideVerses[String(i + 1)] ?? '' : null;
          return (
            <div class={`verse${sel.value === v ? ' sel' : ''}`} key={v} data-v={v} data-lv={v}>
              <div class="en" onClick={() => S.selectVerse(v)}>
                <button class="num" onClick={() => S.selectVerse(v)} aria-label={`Select verse ${i + 1}`}>
                  {i + 1}
                </button>
                {al ? (
                  <PairedEnglish v={v} text={english} al={al} />
                ) : !liveVerses && poem ? (
                  <PoetryLines text={english} lines={poem} />
                ) : english || <span class="muted">{liveVerses ? `The ${tr} does not include this verse in its main text.` : OMITTED}</span>}
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
              {other2 !== null && (
                <div class="en side" onClick={() => S.selectVerse(v)}>
                  <span class="sidetag">{partner}</span>
                  {sideVerses === 'BSB' && poem ? (
                    <PoetryLines text={other2} lines={poem} />
                  ) : (
                    other2 || <span class="muted">{sideVerses === 'BSB' ? OMITTED : `The ${partner} does not include this verse in its main text.`}</span>
                  )}
                </div>
              )}
              {!orig ? null : al ? (
                <PairedWords v={v} row={row} al={al} hebrew={isHebrew} other={other} studyRoot={studyRoot} kin={kin} />
              ) : inter ? (
                <div class={`inter ${lang}`}>
                  {words.map((w) => (
                    <button key={indexOf(w)} class={`cell ${lang} ${wordClass(w, w[3] === studyRoot, !!kin?.has(w[3]))}`} data-lr={w[3] >= 0 ? w[3] : undefined} onClick={() => w[3] >= 0 && S.openRoot(w[3], v, indexOf(w))} title={grammarTip(w[4], isHebrew)}>
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
                      <button class={wordClass(w, w[3] === studyRoot, !!kin?.has(w[3]))} data-lr={w[3] >= 0 ? w[3] : undefined} onClick={() => w[3] >= 0 && S.openRoot(w[3], v, indexOf(w))} title={`${w[1]} · ${w[2]}`}>
                        {w[0]}
                      </button>{' '}
                    </Fragment>
                  ))}
                </div>
              )}
              {sel.value === v && notesWanted && <NetVerseNotes book={book} chapter={chapter} verse={i + 1} />}
              {sel.value === v && <VerseExtras a={a} verse={v} />}
            </div>
          );
        })}
      </div>
      <ChapterWhen a={a} book={book} chapter={chapter} ready={!!text} />
      {text && (
        <p class="copyright">
          {mainEsv && (
            <>
              {esvReady?.data?.copyright} Read more at <a href="https://www.esv.org" target="_blank" rel="noopener">esv.org</a>.{' '}
            </>
          )}
          {mainNet && netCredit}
          {(bsbShown || sideVerses === 'BSB') && (
            <>
              English: <CardLink work="bsb">Berean Standard Bible</CardLink>, by the Berean Bible Translation Committee (2016; public domain since 2023).{' '}
            </>
          )}
          {!mainNet && showNetCredit && netCredit}
          {isHebrew ? (
            <>
              Hebrew and Aramaic: Leningrad Codex (about AD 1008), tagged by STEPBible (<CardLink work="tahot">TAHOT</CardLink>, CC BY 4.0).
            </>
          ) : (
            <>
              Greek: all the major printed editions, tagged by STEPBible (<CardLink work="tagnt">TAGNT</CardLink>, CC BY 4.0).
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** A poetry verse set out in the BSB's own lines: a line set one step in, a
 * refrain such as "Selah" further in, a psalm's title in italics, and a gap
 * where a new stanza starts. Lines break with <br> so the verse's link
 * buttons stay at the end of its last line. */
function PoetryLines({ text, lines }: { text: string; lines: [number, number][] }) {
  return (
    <span class="poem">
      {lines.map(([at, k], j) => {
        const end = j + 1 < lines.length ? lines[j + 1][0] : text.length;
        const kind = k & 7;
        const cls = kind === LINE.indent ? 'pl in' : kind === LINE.refrain ? 'pl rf' : kind === LINE.title ? 'pl ti' : 'pl';
        return (
          <Fragment key={j}>
            {j > 0 && (k & LINE.gap ? <span class="pgap" /> : <br />)}
            <span class={cls}>{text.slice(at, end).trimEnd()}</span>{' '}
          </Fragment>
        );
      })}
    </span>
  );
}

/** Where to read the NET translators' notes on one verse. The NET's
 *  permissions cover its text but not its notes, so the notes are read on
 *  netbible.org, the publisher's own free study site. */
function NetVerseNotes({ book, chapter, verse }: { book: number; chapter: number; verse: number }) {
  return (
    <div class="netnotes">
      <a href={netVerseUrl(book, chapter, verse)} target="_blank" rel="noopener">
        Read the NET translators’ notes on this verse at netbible.org ›
      </a>
    </div>
  );
}
