// Reading a Bible dictionary on the Sources shelf: Easton's (1897) or Smith's
// (1884), both public domain, from the Christian Classics Ethereal Library's
// editions as NEUU's Bible Dictionary Dataset keeps them.
//
// Simple: search the names (those that start with the words first, and names
//   with every word in any order: "holy spirit" finds "Spirit, Holy") or pick
//   a letter, then read an entry. The verses it cites are links that take the
//   reader there, and an entry the other dictionary also has links across.
// Study: adds where the text comes from and its license.
// Deep: adds every verse the entry cites.
//
// The open entry is part of the link: #tab=sources&read=easton&term=quails.
// Opening a dictionary or an entry is a step Back undoes (S.step). The names
// load when the dictionary opens, and each letter's entries the first time
// one of them is read.

import './shelf.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Atlas } from '../data/atlas';
import { type DictEntry, type IndexRow, type Piece, type Shelf, licenseWords, loadDictIndex, loadEntry, searchIndex, useLoaded } from '../data/shelf';
import { atLeast } from '../depth';
import * as S from '../state';
import { refName, verseHash } from './extras/kit';

/** Take the reader to a verse from the shelf, keeping the shelf open beside it
 * (on phones, the reader pane comes forward). */
export function goToVerse(v: number): void {
  S.selectVerse(v, { openTab: false });
  S.mobilePane.value = 'read';
}

/** A verse or passage as a link that takes the reader there. */
export function VerseLink({ a, verse, to, text, cls = 'shelf-ref', go = goToVerse }: { a: Atlas; verse: number; to?: number; text?: string; cls?: string; go?: (v: number) => void }) {
  return (
    <a
      class={cls}
      href={verseHash(a, verse)}
      data-lv={verse}
      onClick={(e) => {
        // Let a middle click or Ctrl/Cmd-click open a new tab.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        go(verse);
      }}
    >
      {text ?? refName(a, verse, to)}
    </a>
  );
}

/** Scroll the study column (never the page) so `el` sits just under its tab
 * row; with `ifHidden`, only when its top is out of sight above. */
export function scrollStudyTo(el: Element | null | undefined, ifHidden = false): void {
  const box = el?.closest<HTMLElement>('.study');
  if (!el || !box) return;
  const tabs = box.querySelector('.tabs')?.getBoundingClientRect().height ?? 0;
  const at = el.getBoundingClientRect().top - box.getBoundingClientRect().top - tabs;
  if (!ifHidden || at < 0) box.scrollTop += at - 8;
}

/** Move the focus to a view that has just opened (its heading, or the item
 * the reader came back to), without scrolling, so keyboards and screen
 * readers follow the change. Never while the reader is typing in a box. */
export function focusView(el: HTMLElement | null | undefined): void {
  const at = document.activeElement;
  if (!el || at instanceof HTMLInputElement || at instanceof HTMLTextAreaElement) return;
  el.focus({ preventScroll: true });
}

/** Entries to try, shown before the reader has searched. */
const TRY = ['manna', 'jerusalem', 'passover', 'quails'];

/** An entry's text, with each verse it names as a link. Two meanings of one
 * term are separate paragraphs. */
export function EntryText({ a, text, go }: { a: Atlas; text: string | Piece[]; go: (v: number) => void }) {
  const parts = typeof text === 'string' ? [text] : text;
  return (
    <div class="dict-text">
      {parts.map((p, i) => (typeof p === 'string' ? p : <VerseLink key={i} a={a} verse={p.verse} to={p.to} text={p.text} cls="dict-ref" go={go} />))}
    </div>
  );
}

/** One entry, loaded with its letter: undefined while it loads (or while
 * `slug` is null), 'missing' if the dictionary has no such entry, null if it
 * failed to load. Given the dictionary's letters, a letter it lacks is not
 * fetched. */
export function useEntry(a: Atlas, dict: string, slug: string | null, letters?: readonly string[]): DictEntry | 'missing' | null | undefined {
  return useLoaded(slug === null ? null : `${dict}/${slug}`, () => loadEntry(a, dict, slug!, letters));
}

export function Dictionary({ a, shelf, dict, term }: { a: Atlas; shelf: Shelf | null | undefined; dict: string; term: string | null }) {
  const w = shelf?.works.find((x) => x.id === dict);
  const info = shelf?.dictionaries[dict];
  const title = w?.title ?? 'Bible dictionary';
  // Once the shelf is in, so a dictionary it does not have is never fetched.
  const index = useLoaded(shelf === undefined ? null : `index ${dict}`, () => loadDictIndex(a, dict));
  const [query, setQuery] = useState('');
  const [letter, setLetter] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const study = atLeast('study');
  const deep = atLeast('deep');
  /** Where the list was when an entry was opened from it. */
  const listAt = useRef<{ slug: string; scroll: number } | null>(null);
  const shown = useRef<string | null>(term);
  /** Set when the entry closes because the reader searched or picked a letter. */
  const listing = useRef(false);

  // A dictionary opens at its top, its title in focus (an entry brings
  // itself into view).
  useEffect(() => {
    const box = top.current?.closest('.study');
    if (box && !term) box.scrollTop = 0;
    if (!term) focusView(heading.current);
    listAt.current = null;
  }, [dict]);

  // Back from an entry: the list where it was, with the entry's name in
  // focus (or the dictionary's top, when the entry was not opened from it).
  useEffect(() => {
    const was = shown.current;
    shown.current = term;
    const searched = listing.current;
    listing.current = false;
    if (term || !was || searched) return;
    const box = top.current?.closest('.study');
    const at = listAt.current;
    if (box) box.scrollTop = at && at.slug === was ? at.scroll : 0;
    focusView(top.current?.querySelector<HTMLElement>(`[data-slug="${was}"]`) ?? heading.current);
  }, [term]);

  const open = (slug: string) => {
    listAt.current = { slug, scroll: top.current?.closest('.study')?.scrollTop ?? 0 };
    S.step(() => (S.shelfRead.value = { dict, term: slug }));
  };
  const toList = () => (S.shelfRead.value = { dict, term: null });
  // Searching or picking a letter closes the open entry where the reader is.
  const toNewList = () => {
    if (!term) return;
    listing.current = true;
    toList();
  };
  // Back to the list: the browser's Back, when the entry was opened from it.
  const backToList = () => S.stepBack((h) => h.get('read') === dict && !h.has('term'), toList);
  const back = () =>
    S.stepBack(
      (h) => h.get('tab') === 'sources' && !h.has('read'),
      () => {
        S.shelfRead.value = null;
        S.shelfWork.value = dict;
        S.shelfJump.value++;
      },
    );

  let list: IndexRow[] | null = null;
  if (index && query.trim()) list = searchIndex(index, query);
  else if (index && letter) list = index.filter((r) => r[2] === letter);
  const letters = info?.letters ?? (index ? [...new Set(index.map((r) => r[2]))] : []);
  const tries = index ? TRY.map((slug) => index.find((r) => r[1] === slug)).filter((r): r is IndexRow => !!r) : [];

  return (
    <div class="panel dict" ref={top}>
      <button type="button" class="shelf-back" onClick={back}>
        ‹ All sources
      </button>
      <h2 tabIndex={-1} ref={heading}>
        {title}
      </h2>
      <p class="muted dict-sub">
        {[w?.plain, info && `${info.entries.toLocaleString()} entries`, w && licenseWords(w)].filter(Boolean).join(' · ')}
      </p>
      <input
        class="dict-search"
        type="search"
        value={query}
        placeholder="Find a word, such as Manna"
        aria-label={`Search ${title}`}
        onInput={(e) => {
          setQuery((e.currentTarget as HTMLInputElement).value);
          toNewList();
        }}
      />
      <nav class="dict-az" aria-label="Entries by letter">
        {letters.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={!query.trim() && letter === l}
            onClick={() => {
              setQuery('');
              setLetter(l);
              toNewList();
            }}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </nav>

      {index === null && <p class="muted">Couldn’t load the dictionary. Check your connection.</p>}
      {/* Always in place, so a screen reader hears each new count. */}
      <p class="muted dict-count" role="status">
        {!term && list && (list.length === 0 ? `No entry matches “${query.trim()}”.` : query.trim() ? `${list.length === 60 ? 'The first 60' : list.length} ${list.length === 1 ? 'entry' : 'entries'}` : `${list.length} entries under ${letter!.toUpperCase()}`)}
      </p>
      {term ? (
        <Entry a={a} shelf={shelf} dict={dict} title={title} slug={term} deep={deep} onBack={backToList} open={(d, slug) => S.step(() => (S.shelfRead.value = { dict: d, term: slug }))} />
      ) : list ? (
        <ul class="dict-list">
          {list.map((r) => (
            <li key={r[1]}>
              <button type="button" data-slug={r[1]} onClick={() => open(r[1])}>
                {r[0]}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        index && (
          <p class="dict-start">
            Search for a word or pick a letter.
            {tries.length > 0 && (
              <>
                {' '}
                Try{' '}
                {tries.map((r, i) => (
                  <span key={r[1]}>
                    {i > 0 && (i === tries.length - 1 ? ' or ' : ', ')}
                    <button type="button" class="dict-try" data-slug={r[1]} onClick={() => open(r[1])}>
                      {r[0]}
                    </button>
                  </span>
                ))}
                .
              </>
            )}
          </p>
        )
      )}
      <p class="dict-credit">
        {w?.license === 'public-domain' ? 'Free to read (public domain). ' : ''}Written in the 1800s, so some of it is out of date.
        {study && ' The text is the Christian Classics Ethereal Library’s transcription, by way of Jon Craton’s CCEL Paragraphs (CC BY-SA 4.0) and NEUU’s Bible Dictionary Dataset (CC BY 4.0).'}
      </p>
    </div>
  );
}

function Entry({
  a,
  shelf,
  dict,
  title,
  slug,
  deep,
  onBack,
  open,
}: {
  a: Atlas;
  shelf: Shelf | null | undefined;
  dict: string;
  title: string;
  slug: string;
  deep: boolean;
  onBack: () => void;
  open: (dict: string, slug: string) => void;
}) {
  // Once the shelf is in, so a letter the dictionary lacks is never fetched.
  const e = useEntry(a, dict, shelf === undefined ? null : slug, shelf?.dictionaries[dict]?.letters);
  const box = useRef<HTMLElement>(null);
  const name = useRef<HTMLHeadingElement>(null);
  const found = e !== undefined && e !== null && e !== 'missing';
  // A new entry opens at its top, under the tab row, its name in focus.
  useEffect(() => {
    if (!found) return;
    scrollStudyTo(box.current);
    focusView(name.current);
  }, [dict, slug, found]);
  // The other dictionary's entry for the same term, if it has one.
  const other = shelf ? Object.keys(shelf.dictionaries).find((d) => d !== dict) : undefined;
  const otherIndex = useLoaded(other && found ? `index ${other}` : null, () => loadDictIndex(a, other!));
  const twin = otherIndex?.find((r) => r[1] === slug);
  const otherTitle = shelf?.works.find((w) => w.id === other)?.title;
  if (e === undefined) return <p class="xt-wait">…</p>;
  if (e === null) return <p class="muted">Couldn’t load this entry. Check your connection.</p>;
  if (e === 'missing') return <p class="muted">There is no entry here by that name. Search for it above.</p>;
  return (
    <article class="dict-entry" aria-label={e.name} ref={box}>
      {/* Always shown, so the dictionary's name and the way back stay in view. */}
      <button type="button" class="shelf-back" aria-label={`Back to ${title}`} onClick={onBack}>
        ‹ {title}
      </button>
      <h3 class="dict-name" tabIndex={-1} ref={name}>
        {e.name}
      </h3>
      <EntryText a={a} text={e.text} go={goToVerse} />
      {twin && other && (
        <p class="dict-twin">
          Also in {otherTitle ?? 'the other dictionary'}:{' '}
          <button type="button" class="dict-try" onClick={() => open(other, twin[1])}>
            {twin[0]} ›
          </button>
        </p>
      )}
      {deep && e.refs.length > 0 && (
        <details class="src-files dict-refs">
          <summary>{e.refs.length === 1 ? 'The verse it cites' : `All ${e.refs.length} verses and passages it cites`}</summary>
          <p>
            {e.refs.map((r, i) => {
              const [from, to] = typeof r === 'number' ? [r, undefined] : r;
              return (
                <span key={i}>
                  {i > 0 && ', '}
                  <VerseLink a={a} verse={from} to={to} cls="dict-ref" />
                </span>
              );
            })}
          </p>
        </details>
      )}
    </article>
  );
}
