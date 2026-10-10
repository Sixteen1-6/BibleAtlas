// Every view is a link: #v=John.3.16&w=G0026&wv=John.3.16&wp=4&t=lamb&p=Gen.3.15~Rev.12.9&road=2&tab=word
// (wv and wp: the verse and word position a word study was opened from; road:
// which of the roads between the two ends of p is lit, when it is not the first).
// The Sources shelf: tab=sources&src=easton (a work's card open), and
// tab=sources&read=easton&term=quails (reading a dictionary, at an entry).

import { effect } from '@preact/signals';
import { type Atlas, locate, verseIndex } from './data/atlas';
import { TAB_DEPTH, deepen } from './depth';
import * as S from './state';
import { extraFromHash, extraToHash } from './ui/extras/open';
import { askFromHash, askToHash } from './ui/ask/ask';
import { chosenRoad, pickLinkedRoad } from './ui/Roads';

function osis(a: Atlas, v: number): string {
  const l = locate(a, v);
  return `${a.books[l.book].osis}.${l.chapter}.${l.verse}`;
}

export function fromOsis(a: Atlas, s: string): number | null {
  const [b, c, v] = s.split('.');
  const book = a.books.findIndex((x) => x.osis === b);
  const ch = Number(c);
  const vs = Number(v);
  if (book < 0 || !ch || !vs || ch > a.books[book].chapters.length || vs > a.books[book].chapters[ch - 1]) return null;
  return verseIndex(a, book, ch, vs);
}

export function restoreFromHash(a: Atlas): void {
  const h = new URLSearchParams(location.hash.slice(1));
  const v = h.get('v');
  if (v) {
    const i = fromOsis(a, v);
    if (i !== null) S.selectVerse(i);
  } else {
    const r = h.get('r');
    const [b, c] = (r ?? '').split('.');
    const book = a.books.findIndex((x) => x.osis === b);
    if (book >= 0 && Number(c) >= 1 && Number(c) <= a.books[book].chapters.length) S.reading.value = { book, chapter: Number(c) };
  }
  const w = h.get('w');
  if (w) {
    const root = a.lemmas.key.indexOf(w);
    if (root >= 0) {
      const wv = h.get('wv');
      const verse = wv ? fromOsis(a, wv) ?? undefined : undefined;
      const wp = Number(h.get('wp'));
      const pos = verse !== undefined && Number.isInteger(wp) && wp >= 0 && h.has('wp') ? wp : undefined;
      S.study.value = { root, verse, pos };
      deepen('study');
    }
  }
  const t = h.get('t');
  const th = t ? a.themes.find((x) => x.id === t) : undefined;
  if (th) {
    S.theme.value = th.id;
    // A broad word's theme shows from Study on, as it does everywhere else.
    if (th.level === 'study') deepen('study');
  }
  const tab = h.get('tab') as S.Tab | null;
  if (tab && tab in TAB_DEPTH) {
    S.tab.value = tab;
    // A shared link opens as deep as the view it points at; the Sources
    // shelf opens at any level.
    if (tab === 'sources') S.sourcesAsked.value = true;
    else deepen(TAB_DEPTH[tab]);
  }
  shelfFromHash(h);
  if (h.has('p')) pickLinkedRoad(Number(h.get('road')));
  extraFromHash(h);
  askFromHash(h);
}

const SHELF_ID = /^[a-z0-9-]{1,64}$/;

/** src= (the open card), read= and term= (the dictionary and entry being read).
 * src=easton&term=quails is read as reading that entry too. */
function shelfFromHash(h: URLSearchParams): void {
  const id = (k: string) => {
    const x = h.get(k);
    return x && SHELF_ID.test(x) ? x : null;
  };
  const src = id('src');
  const term = id('term');
  const read = id('read') ?? (term ? src : null);
  S.shelfWork.value = read ?? src;
  S.shelfRead.value = read ? { dict: read, term } : null;
  if (src || read) S.shelfJump.value++;
}

function shelfToHash(h: URLSearchParams): void {
  if (S.tab.value !== 'sources') return;
  const r = S.shelfRead.value;
  if (r) {
    h.set('read', r.dict);
    if (r.term) h.set('term', r.term);
  } else if (S.shelfWork.value) h.set('src', S.shelfWork.value);
}

export function pathFromHash(a: Atlas): [number, number] | null {
  const p = new URLSearchParams(location.hash.slice(1)).get('p');
  if (!p) return null;
  const [x, y] = p.split('~').map((s) => fromOsis(a, s));
  return x !== null && y !== null && x !== undefined && y !== undefined ? [x, y] : null;
}

/** Keep the address bar in sync, adding a history entry only for a step (S.step). */
export function syncHash(a: Atlas): () => void {
  return effect(() => {
    const h = new URLSearchParams();
    const sel = S.selected.value;
    if (sel !== null) h.set('v', osis(a, sel));
    else h.set('r', `${a.books[S.reading.value.book].osis}.${S.reading.value.chapter}`);
    const st = S.study.value;
    if (st) {
      h.set('w', a.lemmas.key[st.root]);
      if (st.verse !== undefined) {
        h.set('wv', osis(a, st.verse));
        if (st.pos !== undefined) h.set('wp', String(st.pos));
      }
    }
    if (S.theme.value) h.set('t', S.theme.value);
    const p = S.path.value;
    if (p) {
      h.set('p', `${osis(a, p.verses[0])}~${osis(a, p.verses[p.verses.length - 1])}`);
      const road = chosenRoad();
      if (road > 0) h.set('road', String(road + 1));
    }
    h.set('tab', S.tab.value);
    shelfToHash(h);
    extraToHash(h);
    askToHash(h);
    const next = `#${h.toString()}`;
    if (location.hash !== next) S.writeAddress(next);
  });
}
