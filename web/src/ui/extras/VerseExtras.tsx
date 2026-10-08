// The one shared slot for extras in the reader:
// - VerseExtras: under the selected verse, one quiet line per extra that has
//   something to say about it (two, and "and N more" when more apply).
// - ChapterExtras: the same under the chapter heading, for extras that have a
//   chapter line. It also hosts the open panel, because it is always mounted.
// Nothing at all shows while data loads, when it fails, or when no extra applies.

import './extras.css';
import { createPortal } from 'preact';
import { useEffect, useErrorBoundary, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { type Atlas, chapterName, label } from '../../data/atlas';
import { deepen } from '../../depth';
import * as S from '../../state';
import { dataState, ensureData } from './data';
import { refName, verseHash } from './kit';
import { levelAtLeast } from './level';
import { closeExtra, openExtra, openPanel } from './open';
import { type AnyExtra, EXTRAS, extraById } from './registry';
import { Shell } from './Sheet';
import type { ChapterRef, NoteLine, VerseLink, VerseRef } from './types';

/** Lines shown before "and N more". */
const SHOWN = 2;

/** Extras whose notes appear at the reader's current level. */
function visibleExtras(): AnyExtra[] {
  return EXTRAS.filter((x) => levelAtLeast(x.level ?? 'simple'));
}

function useLoad(a: Atlas, xs: readonly AnyExtra[]): void {
  const key = xs.map((x) => x.id).join(' ');
  useEffect(() => {
    for (const x of xs) ensureData(x, a);
  }, [a, key]);
}

const warned = new Set<string>();
function warnOnce(key: string, msg: string, e?: unknown): void {
  if (!import.meta.env.DEV || warned.has(key)) return;
  warned.add(key);
  console.warn(`[extras] ${msg}`, e ?? '');
}

/** Run an extra's note function; anything empty or thrown counts as "nothing to say". */
function lineFrom(a: Atlas, x: AnyExtra, f: () => NoteLine | null | undefined): NoteLine | null {
  let line: NoteLine | null | undefined;
  try {
    line = f();
  } catch (e) {
    warnOnce(`${x.id}:throw`, `${x.id}: its note threw, so it is hidden.`, e);
    return null;
  }
  if (line === null || line === undefined) return null;
  const parts = typeof line === 'string' ? [line] : line;
  if (!parts.length || !plain(a, parts).trim()) return null;
  if (import.meta.env.DEV) {
    if (plain(a, parts).length > 90) warnOnce(`${x.id}:long`, `${x.id}: keep a note to one short line (under about 70 characters): "${plain(a, parts)}"`);
    if (parts.filter((p) => typeof p !== 'string').length > 3) warnOnce(`${x.id}:links`, `${x.id}: a note should name at most 3 verses.`);
  }
  return line;
}

function plain(a: Atlas, parts: readonly (string | VerseLink)[]): string {
  return parts.map((p) => (typeof p === 'string' ? p : p.text ?? refName(a, p.verse, p.to))).join('');
}

interface Item {
  x: AnyExtra;
  line: NoteLine;
}

/** Move the reader to a verse from a note's link. */
function goTo(v: VerseRef): void {
  if (openPanel.peek()) closeExtra('navigate');
  S.selectVerse(v);
  S.mobilePane.value = 'read';
}

function VerseA({ a, link }: { a: Atlas; link: VerseLink }) {
  return (
    <a
      class="xt-ref"
      href={verseHash(a, link.verse)}
      onClick={(e) => {
        e.stopPropagation();
        // Let a middle click or Ctrl/Cmd-click open a new tab.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        goTo(link.verse);
      }}
    >
      {link.text ?? refName(a, link.verse, link.to)}
    </a>
  );
}

function Line({ a, item, kind, at, isOpen }: { a: Atlas; item: Item; kind: 'verse' | 'chapter'; at: VerseRef | ChapterRef; isOpen: boolean }) {
  const { x, line } = item;
  const parts = typeof line === 'string' ? [line] : line;
  const btn = useRef<HTMLButtonElement>(null);
  const canOpen = kind === 'verse' || !!x.ChapterPanel;
  const open = () => openExtra(x.id, kind, at, btn.current);
  const words = plain(a, parts);
  if (!parts.some((p) => typeof p !== 'string')) {
    if (!canOpen) return <p class="xt-line">{words}</p>;
    return (
      <button ref={btn} type="button" class={`xt-line xt-tap${isOpen ? ' xt-on' : ''}`} onClick={open} aria-haspopup="dialog" aria-expanded={isOpen}>
        <span class="xt-words">{words}</span>
        <span class="xt-chev" aria-hidden="true">
          ›
        </span>
      </button>
    );
  }
  return (
    <div class={`xt-line${canOpen ? ' xt-tap' : ''}${isOpen ? ' xt-on' : ''}`} onClick={canOpen ? open : undefined}>
      <span class="xt-words">{parts.map((p, i) => (typeof p === 'string' ? p : <VerseA key={i} a={a} link={p} />))}</span>
      {canOpen && (
        <button
          ref={btn}
          type="button"
          class="xt-chev"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
          aria-label={`Open ${x.title}: ${words}`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          ›
        </button>
      )}
    </div>
  );
}

function Notes({ a, items, kind, at, name }: { a: Atlas; items: Item[]; kind: 'verse' | 'chapter'; at: VerseRef | ChapterRef; name: string }) {
  const [all, setAll] = useState(false);
  const o = openPanel.value;
  const shown = all || items.length <= SHOWN ? items : items.slice(0, SHOWN);
  return (
    <div class={`xt-notes xt-${kind}`} role="group" aria-label={`More about ${name}`}>
      {shown.map((it) => (
        <Line key={it.x.id} a={a} item={it} kind={kind} at={at} isOpen={!!o && o.id === it.x.id && o.kind === kind} />
      ))}
      {items.length > SHOWN && (
        <button type="button" class="xt-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? 'Show less' : `and ${items.length - SHOWN} more`}
        </button>
      )}
    </div>
  );
}

/** The quiet block under the selected verse. Renders nothing when no extra applies. */
export function VerseExtras({ a, verse }: { a: Atlas; verse: VerseRef }) {
  const xs = visibleExtras();
  useLoad(a, xs);
  const items: Item[] = [];
  for (const x of xs) {
    const s = dataState(x);
    if (s?.state !== 'ready') continue;
    const line = lineFrom(a, x, () => x.note(verse, s.data));
    if (line) items.push({ x, line });
  }
  if (!items.length) return null;
  return <Notes key={verse} a={a} items={items} kind="verse" at={verse} name={label(a, verse)} />;
}

/** The quiet block under the chapter heading, plus the host for open panels. */
export function ChapterExtras({ a, book, chapter }: { a: Atlas; book: number; chapter: number }) {
  const xs = visibleExtras().filter((x) => x.chapterNote);
  useLoad(a, xs);
  const at: ChapterRef = { book, chapter };
  const items: Item[] = [];
  for (const x of xs) {
    const s = dataState(x);
    if (s?.state !== 'ready') continue;
    const line = lineFrom(a, x, () => x.chapterNote!(at, s.data));
    if (line) items.push({ x, line });
  }
  return (
    <>
      {items.length > 0 && <Notes key={`${book}.${chapter}`} a={a} items={items} kind="chapter" at={at} name={`${chapterName(a.books[book])} ${chapter}`} />}
      <PanelHost a={a} />
    </>
  );
}

function Guard({ id, children }: { id: string; children: ComponentChildren }) {
  const [error] = useErrorBoundary((e) => warnOnce(`${id}:panel`, `${id}: its Panel threw.`, e));
  if (error) return <p class="xt-lead">Sorry, this could not be shown right now.</p>;
  return <>{children}</>;
}

const dismiss = () => closeExtra('dismiss');
const navigate = (v: VerseRef) => {
  closeExtra('navigate');
  S.selectVerse(v);
  S.mobilePane.value = 'read';
};

/** Renders the open panel, if any, into the page (outside the reader, so the
 * reader being hidden on phones does not hide it). */
function PanelHost({ a }: { a: Atlas }) {
  const o = openPanel.value;
  const x = o ? extraById(o.id) : undefined;
  const visible = !!x && levelAtLeast(x.level ?? 'simple');
  const s = x ? dataState(x) : undefined;
  const ready = s?.state === 'ready';

  // Does the panel still apply to its verse or chapter?
  let applies = false;
  if (o && x && ready) {
    if (o.kind === 'verse') applies = o.verse !== null && lineFrom(a, x, () => x.note(o.verse!, s.data)) !== null;
    else applies = !!x.ChapterPanel && !!x.chapterNote && o.chapter !== null && lineFrom(a, x, () => x.chapterNote!(o.chapter!, s.data)) !== null;
  }

  useEffect(() => {
    if (!o) return;
    // An unknown id (an old link, a feature that was renamed): drop it.
    if (!x) return closeExtra('dismiss');
    // A shared link opens as deep as the panel it points at; a reader who
    // switches to a lighter level sees the panel go with its note.
    if (!visible) return o.fromLink ? deepen(x.level ?? 'simple') : closeExtra('dismiss');
    ensureData(x, a);
    if (s?.state === 'failed' || (ready && !applies)) closeExtra('dismiss');
  }, [o, x, visible, s, ready, applies, a]);

  if (!o || !x || !visible || !ready || !applies) return null;
  const title = x.title;
  const at = o.kind === 'verse' ? label(a, o.verse!) : `${chapterName(a.books[o.chapter!.book])} ${o.chapter!.chapter}`;
  const P = x.Panel;
  const C = x.ChapterPanel;
  return createPortal(
    <Shell key={`${o.id}.${o.kind}`} title={title} at={at} onDismiss={dismiss}>
      <Guard id={x.id}>
        {o.kind === 'verse' ? (
          <P a={a} data={s.data} verse={o.verse!} close={dismiss} navigate={navigate} />
        ) : (
          C && <C a={a} data={s.data} chapter={o.chapter!} close={dismiss} navigate={navigate} />
        )}
      </Guard>
    </Shell>,
    document.body,
  );
}
