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
import * as S from '../state';

function num(el: Element | null, attr: string): number | null {
  const s = el?.getAttribute(attr);
  if (s === null || s === undefined || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function point(target: EventTarget | null): void {
  const el = target instanceof Element ? target : null;
  const v = num(el?.closest('[data-lv]') ?? null, 'data-lv');
  const r = num(el?.closest('[data-lr]') ?? null, 'data-lr');
  if (S.pointedVerse.peek() !== v) S.pointedVerse.value = v;
  if (S.pointedRoot.peek() !== r) S.pointedRoot.value = r;
}

function clear(): void {
  S.pointedVerse.value = null;
  S.pointedRoot.value = null;
}

let installed = false;

/** Start listening. Safe to call more than once. */
export function installPointing(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'mouse') point(e.target);
  });
  document.documentElement.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') clear();
  });
  // Keyboard: only a visible focus ring points, so a click does not leave
  // something lit after the mouse moves away.
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (el instanceof Element && el.matches(':focus-visible')) point(el);
  });
  document.addEventListener('focusout', (e) => {
    const next = (e as FocusEvent).relatedTarget;
    if (!(next instanceof Element) || !next.matches(':focus-visible')) clear();
  });
  // A new selection rebuilds the panel under a resting pointer.
  S.selected.subscribe(() => (S.pointedVerse.value = null));
  S.study.subscribe(() => (S.pointedRoot.value = null));

  const style = document.createElement('style');
  style.id = 'pointing';
  document.head.appendChild(style);
  effect(() => {
    // A verse lights in the text and the panels when pointed at from elsewhere
    // (the one under the pointer already shows its own hover look). The map's
    // own hover counts too, so a verse picked out on the map shows in the text.
    const v = S.pointedVerse.value ?? S.hovered.value;
    const r = S.pointedRoot.value;
    let css = '';
    if (v !== null) css += `.verse[data-lv="${v}"]:not(:hover):not(.sel),.refrow[data-lv="${v}"]:not(:hover){background:var(--lit-soft);box-shadow:inset 3px 0 0 var(--lit-edge)}`;
    if (r !== null) css += `.w[data-lr="${r}"],.cell[data-lr="${r}"],.chip[data-lr="${r}"]{background:var(--accent-soft);box-shadow:0 0 0 1px var(--accent)}`;
    style.textContent = css;
  });
}
