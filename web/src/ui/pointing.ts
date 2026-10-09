// Pointing: resting the mouse (or keyboard focus) on a verse or a Hebrew or
// Greek word anywhere lights the same verse or word everywhere else: the
// linked passage's arc on the map and its verse in the reader, or every
// place the word shows on screen. Elements opt in with data attributes:
//   data-lv="<verse>"  a verse row or verse in the text
//   data-lr="<root>"   a Hebrew or Greek word, or a chip for one
// One listener on the document reads them, so nothing re-renders as the
// pointer moves; the lit look is a single generated style rule. Touch does
// nothing new: a tap already selects or opens what it lands on.

import { effect } from '@preact/signals';
import { depth } from '../depth';
import * as S from '../state';
import { openPanel } from './extras/open';

function num(el: Element | null, attr: string): number | null {
  const s = el?.getAttribute(attr);
  if (s === null || s === undefined || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** The element that last pointed, and whether the mouse or keyboard focus did. */
let lastEl: Element | null = null;
let from: 'mouse' | 'focus' | null = null;
let recheckFrame = 0;
/** Where the mouse last was, to find what it rests on once the view changes. */
let mouseX = 0;
let mouseY = 0;

function point(target: EventTarget | null, how: 'mouse' | 'focus'): void {
  const el = target instanceof Element ? target : null;
  lastEl = el;
  from = how;
  const v = num(el?.closest('[data-lv]') ?? null, 'data-lv');
  const r = num(el?.closest('[data-lr]') ?? null, 'data-lr');
  if (S.pointedVerse.peek() !== v) S.pointedVerse.value = v;
  if (S.pointedRoot.peek() !== r) S.pointedRoot.value = r;
}

function clear(): void {
  lastEl = null;
  from = null;
  S.pointedVerse.value = null;
  S.pointedRoot.value = null;
}

// Subscribers run before Preact re-renders, so check on the next frame. The
// pointed element may be gone by then, with no focusout (Firefox, Safari) and
// no pointerover (a resting mouse), or kept and moved, or reused for another
// verse or word (a list keyed by index). So read again whatever the resting
// mouse is over, or whatever has the visible focus, now.
function recheck(): void {
  if (recheckFrame) return;
  recheckFrame = requestAnimationFrame(() => {
    recheckFrame = 0;
    if (!from) return;
    const el = from === 'mouse' ? document.elementFromPoint(mouseX, mouseY) : document.activeElement;
    if (el && (from === 'mouse' || el.matches(':focus-visible'))) point(el, from);
    else clear();
  });
}

let installed = false;

/** Start listening. Safe to call more than once. */
export function installPointing(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') {
      // A finger or pen took over: the mouse no longer rests anywhere.
      if (from === 'mouse') clear();
      return;
    }
    mouseX = e.clientX;
    mouseY = e.clientY;
    point(e.target, 'mouse');
  });
  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'mouse') (mouseX = e.clientX), (mouseY = e.clientY);
    },
    { passive: true },
  );
  // Scrolling moves the text under a resting mouse, and not every browser
  // sends a pointerover for it. (Only a scroll of what the mouse is over.)
  document.addEventListener(
    'scroll',
    (e) => {
      const t = e.target;
      if (from === 'mouse' && lastEl && (t === document || (t instanceof Node && t.contains(lastEl)))) recheck();
    },
    { capture: true, passive: true },
  );
  document.documentElement.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && from === 'mouse') clear();
  });
  // Keyboard: only a visible focus ring points, so a click does not leave
  // something lit after the mouse moves away.
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (el instanceof Element && el.matches(':focus-visible')) point(el, 'focus');
  });
  // Only what focus pointed at goes when focus moves on (the next focusin
  // points again); a click moving focus leaves the mouse's pointing alone.
  document.addEventListener('focusout', () => {
    if (from === 'focus') clear();
  });
  // A new selection rebuilds the panel under a resting pointer: let go at once,
  // and recheck reads what is there a frame later.
  S.selected.subscribe(() => (S.pointedVerse.value = null));
  S.study.subscribe(() => (S.pointedRoot.value = null));
  // Opening, switching or closing a panel takes away whatever the pointer rested on in it.
  openPanel.subscribe(() => clear());
  // Any other change of view may remove what was pointed at.
  for (const s of [S.selected, S.study, S.tab, S.reading, S.translation, S.interlinear, depth]) s.subscribe(recheck);

  const style = document.createElement('style');
  style.id = 'pointing';
  document.head.appendChild(style);
  effect(() => {
    // A verse lights in the text and the panels when pointed at from elsewhere
    // (the one under the pointer already shows its own hover look). The map's
    // own hover counts too, so a verse picked out on the map shows in the text.
    // Panel verses with no side padding get the edge just outside instead, and
    // the wheel's dark cards their own tokens.
    const v = S.pointedVerse.value ?? S.hovered.value;
    const r = S.pointedRoot.value;
    let css = '';
    if (v !== null) {
      css += `.verse[data-lv="${v}"]:not(:hover):not(.sel),.refrow[data-lv="${v}"]:not(:hover),.tj-step[data-lv="${v}"]:not(:hover):not([aria-current]),.x-parallels-one .x-parallels-v[data-lv="${v}"]:not(:hover):not(.x-parallels-here),.x-parallels-cols tr:not(.x-parallels-here) .x-parallels-v[data-lv="${v}"]:not(:hover){background:var(--lit-soft);box-shadow:inset 3px 0 0 var(--lit-edge)}`;
      css += `.layerref[data-lv="${v}"]{background:var(--lit-soft);border-color:var(--lit-edge)}`;
      css += `.xt-pverse[data-lv="${v}"]:not(:hover){background:var(--lit-soft);box-shadow:-3px 0 0 var(--lit-edge),0 0 0 3px var(--lit-soft);border-radius:var(--r-sm)}`;
      css += `.wh-verse[data-lv="${v}"]:not(:hover):not(.wh-cur){background:var(--wh-hover);box-shadow:inset 2px 0 0 var(--wh-accent)}`;
    }
    // A word: softer than the studied word's own mark, which stays as it is.
    if (r !== null) css += `.w[data-lr="${r}"]:not(.hit),.cell[data-lr="${r}"]:not(.hit),.chip[data-lr="${r}"],.x-quotes-word[data-lr="${r}"],.ws-o[data-lr="${r}"]{background:var(--lit-soft);box-shadow:0 0 0 1px var(--lit-edge)}`;
    style.textContent = css;
  });
}
