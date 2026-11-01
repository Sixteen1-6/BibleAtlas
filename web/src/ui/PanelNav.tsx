// The bar on top of the side panel: Back and Forward through the places the
// panel has shown (a verse's links, a word, a theme, a path), and a switch
// that opens the panel over the whole page.
//
// The places are kept here, not in the browser's history, so the browser's own
// Back button keeps working as it always has. Each place is the part of the
// address that says what the panel shows (url.ts writes it); going back puts
// that address back and lets the app follow it as it follows a pasted link.

import { effect, signal } from '@preact/signals';
import { type Atlas, label } from '../data/atlas';
import { fromOsis } from '../url';
import * as S from '../state';

/** The address keys that name a place; the rest (open extras, Ask, the shelf) are left out. */
const PLACE_KEYS = ['v', 'r', 'w', 'wv', 'wp', 't', 'p', 'road', 'tab'];
/** Wait this long after the last change before keeping a place, so arrow keys
 *  stepping through a chapter keep one place, not twenty. */
const SETTLE_MS = 700;
const MAX = 60;

const TAB_NAME: Record<S.Tab, string> = {
  connections: 'Links',
  word: 'Word',
  themes: 'Themes',
  paths: 'Paths',
  hubs: 'Top verses',
  sources: 'Sources',
};

const places = signal<{ list: string[]; at: number }>({ list: [], at: -1 });
let restoring = false;
let timer = 0;

function placeNow(): string {
  const h = new URLSearchParams(location.hash.slice(1));
  const keep = new URLSearchParams();
  for (const k of PLACE_KEYS) {
    const v = h.get(k);
    if (v !== null) keep.set(k, v);
  }
  return keep.toString();
}

function keep(): void {
  const p = placeNow();
  const { list, at } = places.peek();
  if (!p || list[at] === p) return;
  // A new place after going back drops the places that were ahead.
  const next = [...list.slice(0, at + 1), p].slice(-MAX);
  places.value = { list: next, at: next.length - 1 };
}

let started = false;
/** Start keeping places. Call once, after the address starts syncing. */
export function startPanelNav(): void {
  if (started) return;
  started = true;
  keep();
  effect(() => {
    // Any change to what the panel shows.
    void S.selected.value;
    void S.study.value;
    void S.theme.value;
    void S.path.value;
    void S.tab.value;
    window.clearTimeout(timer);
    // url.ts writes the address in its own effect; read it once it has.
    timer = window.setTimeout(() => {
      if (restoring) restoring = false;
      else keep();
    }, SETTLE_MS);
  });
}

function go(step: -1 | 1): void {
  const { list, at } = places.peek();
  const to = at + step;
  if (to < 0 || to >= list.length) return;
  places.value = { list, at: to };
  restoring = true;
  // If following the place changes nothing, stop waiting for it to.
  window.setTimeout(() => (restoring = false), SETTLE_MS * 2);
  const h = new URLSearchParams(list[to]);
  // The address only says what is there; clear what is not before following it.
  if (!h.has('w')) S.study.value = null;
  if (!h.has('t')) S.theme.value = null;
  if (!h.has('p')) S.path.value = null;
  if (!h.has('v')) S.selected.value = null;
  if (!h.has('tab')) S.tab.value = 'connections';
  history.replaceState(history.state, '', `#${list[to]}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** What a place shows, in a few words. */
function describe(a: Atlas, place: string | undefined): string {
  if (!place) return '';
  const h = new URLSearchParams(place);
  const tab = (h.get('tab') as S.Tab | null) ?? 'connections';
  const v = h.get('v');
  const i = v ? fromOsis(a, v) : null;
  const where = i !== null ? label(a, i, true) : '';
  const what = TAB_NAME[tab] ?? '';
  return where ? `${where} · ${what}` : what;
}

function placeTitle(a: Atlas, place: string | undefined, dir: string): string {
  const d = describe(a, place);
  return d ? `${dir} to ${d}` : dir;
}

const BACK = (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);
const FORWARD = (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);
const GROW = (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);
const SHRINK = (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M13.5 6.5h-4v-4M2.5 9.5h4v4M9.5 6.5 14 2M6.5 9.5 2 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);

export function PanelNav({ a }: { a: Atlas }) {
  const { list, at } = places.value;
  const wide = S.panelWide.value;
  const canBack = at > 0;
  const canFwd = at >= 0 && at < list.length - 1;
  return (
    <div class="panelnav">
      <button class="pnbtn" disabled={!canBack} onClick={() => go(-1)} title={placeTitle(a, list[at - 1], 'Back')} aria-label={placeTitle(a, list[at - 1], 'Back')}>
        {BACK}
        <span>Back</span>
      </button>
      <button class="pnbtn" disabled={!canFwd} onClick={() => go(1)} title={placeTitle(a, list[at + 1], 'Forward')} aria-label={placeTitle(a, list[at + 1], 'Forward')}>
        <span class="fwdlabel">Forward</span>
        {FORWARD}
      </button>
      <span class="pnwhere" aria-live="polite">
        {describe(a, list[at])}
      </span>
      <button
        class="pnbtn pnwide"
        aria-pressed={wide}
        onClick={() => (S.panelWide.value = !wide)}
        title={wide ? 'Go back to the text beside this panel' : 'Open this panel over the whole page'}
      >
        {wide ? SHRINK : GROW}
        <span>{wide ? 'Back to reading' : 'Full page'}</span>
      </button>
    </div>
  );
}
