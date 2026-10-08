// Every view is a link: #v=John.3.16&w=G0026&wv=John.3.16&wp=4&t=lamb&p=Gen.3.15~Rev.12.9&road=2&tab=word
// (wv and wp: the verse and word position a word study was opened from; road:
// which of the roads between the two ends of p is lit, when it is not the first).

import { effect } from '@preact/signals';
import { type Atlas, locate, verseIndex } from './data/atlas';
import { TAB_DEPTH, deepen } from './depth';
import * as S from './state';
import { extraFromHash, extraToHash } from './ui/extras/open';
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
  if (t && a.themes.some((x) => x.id === t)) S.theme.value = t;
  const tab = h.get('tab') as S.Tab | null;
  if (tab && tab in TAB_DEPTH) {
    // A shared link opens as deep as the view it points at.
    S.tab.value = tab;
    deepen(TAB_DEPTH[tab]);
  }
  if (h.has('p')) pickLinkedRoad(Number(h.get('road')));
  extraFromHash(h);
}

export function pathFromHash(a: Atlas): [number, number] | null {
  const p = new URLSearchParams(location.hash.slice(1)).get('p');
  if (!p) return null;
  const [x, y] = p.split('~').map((s) => fromOsis(a, s));
  return x !== null && y !== null && x !== undefined && y !== undefined ? [x, y] : null;
}

/** Keep the address bar in sync without adding history entries. */
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
    extraToHash(h);
    const next = `#${h.toString()}`;
    if (location.hash !== next) history.replaceState(null, '', next);
  });
}
