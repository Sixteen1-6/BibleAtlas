// The first-visit guide: a few short steps that light up one part of the
// page at a time (the map, a verse, the depth switch, search, the settings)
// and say in plain words what it does. It never shows again once finished or
// skipped; the "?" button (index.tsx) brings it back.
//
// A native <dialog> opened with showModal(): it covers the page, which goes
// inert, so a tap on the lit part does nothing by mistake, and the focus stays
// in the card. Escape skips it. The arrow keys step through it.

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { DEPTH_INFO } from '../../depth';
import * as S from '../../state';

const NATIVE = typeof HTMLDialogElement === 'function' && typeof HTMLDialogElement.prototype.showModal === 'function';
/** The room left around a lit part, and between it and the card. */
const PAD = 6;
const GAP = 14;
/** The margin the card keeps from the screen's edges. */
const EDGE = 16;

type Step = {
  id: string;
  title: string;
  body: string;
  /** The part of the page to light up; none puts the card in the middle. */
  target?: () => HTMLElement | null;
  /** Run before the step shows (to bring its part into view). */
  before?: () => void;
};

/** The first of `selectors` that is on the page and drawn. */
function find(...selectors: string[]): HTMLElement | null {
  for (const s of selectors) {
    for (const el of document.querySelectorAll<HTMLElement>(s)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

/** Bring `el` to the middle of the panel it scrolls in. Not scrollIntoView,
 *  which also scrolls the page's fixed frame and pushes the header away. */
function centreInScroller(el: HTMLElement): void {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) {
      const r = el.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      p.scrollTop += r.top - pr.top - (p.clientHeight - r.height) / 2;
      return;
    }
  }
}

function steps(): Step[] {
  const phone = S.phoneLayout();
  const tap = S.TAP;
  const out: Step[] = [
    {
      id: 'hello',
      title: 'Welcome to Bible Atlas',
      body: 'The Bible often points to itself: one passage quotes, echoes or answers another. This map draws each of those links as an arc. Here is a short look around.',
    },
  ];
  if (S.mapShown.peek() === 'show' && !S.panelWide.peek())
    out.push({
      id: 'map',
      title: 'Every link on one map',
      body: `The books run along the bottom, from Genesis on the left to Revelation on the right. Each arc joins two linked verses. ${S.TOUCH ? 'Pinch' : 'Scroll'} to zoom in, and ${tap.toLowerCase()} the map to open the verse there.`,
      target: () => find('.map'),
    });
  out.push(
    {
      id: 'verse',
      title: 'Open any verse',
      body: `${tap} a verse in the text to open it. Its links light up on the map, and ${
        phone ? 'Explore, at the top of the text,' : 'the panel beside the text'
      } lists the verses it links to.`,
      target: () => find('.reader .verse.sel', '.reader .verses'),
      before: () => {
        if (phone) S.mobilePane.value = 'read';
        S.panelWide.value = false;
        const v = document.querySelector<HTMLElement>('.reader .verse.sel');
        if (v) centreInScroller(v);
      },
    },
    {
      id: 'depth',
      title: 'Go deeper when you want',
      body: `You start at Simple: the English and its strongest links. ${DEPTH_INFO.study.about} ${DEPTH_INFO.deep.about} You can switch back at any time.`,
      target: () => find('.depthseg'),
    },
    {
      id: 'search',
      title: 'Find a verse or a word',
      body: `Type a reference like John 3:16, a few words you remember, or a Hebrew or Greek word.${S.TOUCH ? '' : ' Press / to search from anywhere.'}`,
      target: () => find('.searchbox'),
    },
  );
  const wide = find('.topbar .guidebtn');
  out.push({
    id: 'more',
    title: wide ? 'This guide, any time' : 'Settings, and this guide',
    body: wide
      ? 'The translation and light or dark are up here. This button brings the guide back whenever you want it.'
      : 'This button holds the translation, light or dark, and sharing a verse as a picture. It also brings this guide back whenever you want it.',
    target: () => find('.topbar .guidebtn', '.optsbtn'),
  });
  return out;
}

type Box = { top: number; left: number; width: number; height: number };

/** Where the card goes: under the lit part, else above it, else at the foot of the screen. */
function place(hole: Box | null, card: { w: number; h: number }, vw: number, vh: number): { top: number; left: number } {
  if (!hole) return { top: Math.max(EDGE, (vh - card.h) / 2), left: (vw - card.w) / 2 };
  const left = Math.min(Math.max(EDGE, hole.left + hole.width / 2 - card.w / 2), vw - EDGE - card.w);
  const below = hole.top + hole.height + GAP;
  if (below + card.h <= vh - EDGE) return { top: below, left };
  const above = hole.top - GAP - card.h;
  if (above >= EDGE) return { top: above, left };
  return { top: Math.max(EDGE, vh - EDGE - card.h), left };
}

export function Guide({ onClose }: { onClose: () => void }) {
  const [list] = useState(steps);
  const [i, setI] = useState(0);
  const [hole, setHole] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const done = useRef(false);
  const id = useId();
  const step = list[i];
  const last = i === list.length - 1;

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onClose();
  };
  const go = (to: number) => {
    if (to < 0) return;
    if (to >= list.length) finish();
    else setI(to);
  };

  // Open it as a modal; any way out (Escape, a phone's Back) skips the guide.
  useLayoutEffect(() => {
    const dlg = box.current!;
    const onCancel = (e: Event) => {
      e.preventDefault();
      finish();
    };
    const onClose = () => finish();
    dlg.addEventListener('cancel', onCancel);
    dlg.addEventListener('close', onClose);
    if (NATIVE) {
      try {
        dlg.showModal();
      } catch {
        dlg.setAttribute('open', '');
      }
    } else dlg.setAttribute('open', '');
    return () => {
      done.current = true;
      dlg.removeEventListener('cancel', onCancel);
      dlg.removeEventListener('close', onClose);
      if (NATIVE && dlg.open) dlg.close();
    };
  }, []);

  // Each step: bring its part into view, light it, and put the card beside it.
  const measure = () => {
    const el = step.target?.() ?? null;
    let h: Box | null = null;
    if (el) {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Keep the ring on the screen when the part is taller or wider than it.
      const top = Math.max(PAD, r.top - PAD);
      const left = Math.max(PAD, r.left - PAD);
      const bottom = Math.min(vh - PAD, r.bottom + PAD);
      const right = Math.min(vw - PAD, r.right + PAD);
      if (bottom > top && right > left) h = { top, left, width: right - left, height: bottom - top };
    }
    setHole(h);
    const c = card.current;
    if (c) setPos(place(h, { w: c.offsetWidth, h: c.offsetHeight }, window.innerWidth, window.innerHeight));
  };

  useLayoutEffect(() => {
    step.before?.();
    measure();
    head.current?.focus({ preventScroll: true });
  }, [i]);

  // Follow the page when it moves under the guide (a resize, a turn of the phone).
  useEffect(() => {
    let frame = 0;
    const again = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener('resize', again);
    window.addEventListener('scroll', again, true);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(again) : null;
    if (card.current) ro?.observe(card.current);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', again);
      window.removeEventListener('scroll', again, true);
      ro?.disconnect();
    };
  }, [i]);

  const onKey = (e: KeyboardEvent) => {
    // Keep the app's own keys (Escape clears the verse, J and K step) out of it.
    e.stopPropagation();
    const inButton = (e.target as HTMLElement)?.closest?.('button');
    if (e.key === 'ArrowRight' || (e.key === 'Enter' && !inButton)) {
      e.preventDefault();
      go(i + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(i - 1);
    }
  };

  return (
    <dialog ref={box} class="gd" aria-labelledby={`${id}-t`} aria-describedby={`${id}-b`} onKeyDown={onKey}>
      {hole ? (
        <div class="gd-hole" style={`top:${hole.top}px;left:${hole.left}px;width:${hole.width}px;height:${hole.height}px`} aria-hidden="true" />
      ) : (
        <div class="gd-veil" aria-hidden="true" />
      )}
      <div ref={card} class={`gd-card${pos ? '' : ' gd-measuring'}`} style={pos ? `top:${pos.top}px;left:${pos.left}px` : undefined} data-step={step.id}>
        {step.id === 'hello' && (
          <svg class="gd-art" viewBox="0 0 120 44" aria-hidden="true">
            <path class="gd-arc a1" d="M14 38a46 46 0 0 1 92 0" />
            <path class="gd-arc a2" d="M34 38a20 20 0 0 1 40 0" />
            <path class="gd-arc a3" d="M60 38a17 17 0 0 1 34 0" />
            <path class="gd-base" d="M6 38h108" />
            <circle class="gd-dot" cx="14" cy="38" r="2.6" />
            <circle class="gd-dot" cx="106" cy="38" r="2.6" />
          </svg>
        )}
        <p class="gd-count" aria-hidden="true">
          {list.map((s, k) => (
            <i key={s.id} class={k === i ? 'on' : k < i ? 'past' : undefined} />
          ))}
        </p>
        <h2 id={`${id}-t`} ref={head} tabIndex={-1}>
          {step.title}
          <span class="gd-sr">
            {' '}
            (step {i + 1} of {list.length})
          </span>
        </h2>
        <p id={`${id}-b`} class="gd-body">
          {step.body}
        </p>
        <div class="gd-foot">
          {!last && (
            <button type="button" class="gd-skip" onClick={finish}>
              {i === 0 ? 'Skip' : 'Skip the rest'}
            </button>
          )}
          <span class="gd-gap" />
          {i > 0 && (
            <button type="button" class="gd-back" onClick={() => go(i - 1)}>
              Back
            </button>
          )}
          <button type="button" class="gd-next" onClick={() => go(i + 1)}>
            {i === 0 ? 'Show me around' : last ? 'Start reading' : 'Next'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
