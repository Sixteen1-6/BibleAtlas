// The frame every extra's panel opens in.
// - Phones (900 px and narrower, the app's own breakpoint): a bottom sheet over
//   a dimmed page. The page behind it is inert, so focus stays in the sheet.
//   A tap outside, a swipe down, the close button, Escape or Back closes it.
// - Wider screens: a side panel over the study column, the app's usual detail
//   area, widened into the reader's empty margin when there is room so two
//   passages fit side by side. The reader and the map stay usable.
// Focus moves to the panel's heading on open and back to the note on close.

import type { ComponentChildren } from 'preact';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import * as S from '../../state';
import { openerElement } from './open';

const PHONE = '(max-width: 900px)';
/** Widest the desktop panel grows into the reader's margin. */
const MAX_SIDE = 600;

function usePhone(): boolean {
  const [phone, setPhone] = useState(() => typeof matchMedia === 'function' && matchMedia(PHONE).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const q = matchMedia(PHONE);
    const on = () => setPhone(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return phone;
}

interface Dock {
  top: number;
  width: number;
}

function measureDock(): Dock {
  const vw = document.documentElement.clientWidth;
  const study = document.querySelector<HTMLElement>('.study')?.getBoundingClientRect();
  const text = document.querySelector<HTMLElement>('.reader .verses')?.getBoundingClientRect();
  const base = study && study.width > 0 ? study.width : Math.min(440, vw);
  const room = text && text.width > 0 ? vw - text.right - 24 : base;
  return {
    top: Math.max(0, Math.round(study && study.height > 0 ? study.top : 0)),
    width: Math.round(Math.min(vw, Math.max(base, Math.min(MAX_SIDE, room)))),
  };
}

/** Where the desktop panel sits: over the study column, measured live. */
function useDock(on: boolean): Dock | null {
  const [dock, setDock] = useState<Dock | null>(null);
  useLayoutEffect(() => {
    if (!on) return;
    const update = () => setDock(measureDock());
    update();
    window.addEventListener('resize', update);
    const study = document.querySelector('.study');
    const ro = study && typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    if (study) ro?.observe(study);
    return () => {
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, [on]);
  return on ? dock : null;
}

export function Shell({ title, at, onDismiss, children }: { title: string; at: string; onDismiss: () => void; children: ComponentChildren }) {
  const phone = usePhone();
  const dock = useDock(!phone);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  // On phones the sheet is modal: the page behind it cannot be focused or read.
  // This comes before the focus effect so that, on close, the page is no
  // longer inert when focus goes back to the note that opened the panel.
  useLayoutEffect(() => {
    if (!phone) return;
    const app = document.getElementById('app');
    if (!app) return;
    const was = app.inert;
    app.inert = true;
    return () => {
      app.inert = was;
    };
  }, [phone]);

  // Focus the heading on open (and when the layout switches), and hand focus
  // back to the note that opened the panel on close.
  useLayoutEffect(() => {
    head.current?.focus({ preventScroll: true });
    return () => {
      const back = openerElement();
      const active = document.activeElement;
      if (back && (!active || active === document.body || box.current?.contains(active))) back.focus({ preventScroll: true });
    };
  }, [phone]);

  // Escape closes the panel before anything else hears it (the app would
  // otherwise clear the selection). Search, when open, keeps its own Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || S.paletteOpen.peek()) return;
      e.preventDefault();
      e.stopPropagation();
      dismiss.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Swipe the sheet down by its top edge to close it.
  const drag = useRef<{ id: number; y0: number; dy: number } | null>(null);
  const endDrag = (e: PointerEvent, done: boolean) => {
    const d = drag.current;
    const el = box.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!el) return;
    el.style.transition = '';
    if (done && d.dy > 80) dismiss.current();
    else el.style.transform = '';
  };
  const swipe = phone
    ? {
        onPointerDown: (e: PointerEvent) => {
          if ((e.target as Element).closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return;
          drag.current = { id: e.pointerId, y0: e.clientY, dy: 0 };
          try {
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          } catch {
            // Capture is a nicety: the drag still works without it.
          }
        },
        onPointerMove: (e: PointerEvent) => {
          const d = drag.current;
          const el = box.current;
          if (!d || d.id !== e.pointerId || !el) return;
          d.dy = Math.max(0, e.clientY - d.y0);
          el.style.transition = 'none';
          el.style.transform = d.dy ? `translateY(${d.dy}px)` : '';
        },
        onPointerUp: (e: PointerEvent) => endDrag(e, true),
        onPointerCancel: (e: PointerEvent) => endDrag(e, false),
      }
    : {};

  const place = !phone && dock ? { top: `${dock.top}px`, width: `${dock.width}px` } : undefined;
  return (
    <>
      {phone && <div class="xt-scrim" onClick={() => dismiss.current()} />}
      <div ref={box} class={`xt-panel ${phone ? 'xt-sheet' : 'xt-dock'}`} style={place} role="dialog" aria-modal={phone ? 'true' : 'false'} aria-labelledby={id}>
        <header class="xt-head" {...swipe}>
          {phone && <span class="xt-grab" aria-hidden="true" />}
          <div class="xt-titles">
            <h2 id={id} ref={head} tabIndex={-1}>
              {title}
            </h2>
            <p class="xt-at">{at}</p>
          </div>
          <button type="button" class="xt-close" onClick={() => dismiss.current()} aria-label={`Close ${title}`}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </button>
        </header>
        <div class="xt-body">{children}</div>
      </div>
    </>
  );
}
