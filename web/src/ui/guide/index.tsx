// The first-visit guide: its starter, and the small "?" that brings it back.
// The guide itself (Guide.tsx) is fetched only when it opens, so a returning
// visitor downloads none of it.

import { useEffect, useState } from 'preact/hooks';
import type { Guide as GuideType } from './Guide';
import { noticeOpen } from '../commentary/state';
import * as S from '../../state';
import './guide.css';

/** How long after the map arrives the guide waits, so the loading sky has faded. */
const SETTLE_MS = 900;

let guideModule: Promise<typeof GuideType> | null = null;
function loadGuide(): Promise<typeof GuideType> {
  if (!guideModule) {
    guideModule = import('./Guide').then((m) => m.Guide);
    guideModule.catch(() => (guideModule = null));
  }
  return guideModule;
}

/** The element that had the focus before the guide opened, to give it back. */
let opener: HTMLElement | null = null;

export function openGuide(): void {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  S.viewMenu.value = false;
  S.guideOpen.value = true;
}

/** Starts the guide on a first visit, and shows it while it is open. */
export function GuideHost() {
  const [impl, setImpl] = useState<{ C: typeof GuideType } | null>(null);
  const open = S.guideOpen.value;

  // A first visit: once the map is drawn, unless something else is already open.
  useEffect(() => {
    if (S.guide.peek() !== 'new') return;
    const t = window.setTimeout(() => {
      if (S.guide.peek() === 'new' && !S.paletteOpen.peek() && !noticeOpen.peek() && !S.panelWide.peek()) S.guideOpen.value = true;
    }, SETTLE_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open || impl) return;
    let live = true;
    loadGuide().then(
      (C) => live && setImpl({ C }),
      () => (S.guideOpen.value = false),
    );
    return () => {
      live = false;
    };
  }, [open]);

  if (!open || !impl) return null;
  const close = () => {
    S.guide.value = 'done';
    S.guideOpen.value = false;
    const back = opener;
    opener = null;
    if (back?.isConnected) back.focus({ preventScroll: true });
  };
  return <impl.C onClose={close} />;
}

const HELP_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5" />
    <path d="M6.2 6.3a1.9 1.9 0 1 1 2.6 1.75c-.5.22-.8.6-.8 1.15v.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    <circle cx="8" cy="11.6" r="0.95" fill="currentColor" />
  </svg>
);

/** In the header on a wide screen, in the "..." menu on a smaller one. */
export function GuideButton() {
  return (
    <button class="iconbtn themebtn guidebtn" onClick={openGuide} title="A short look around the map" aria-label="Show the guide">
      {HELP_ICON}
      <span class="optlabel">Show the guide</span>
    </button>
  );
}
