// The pieces each commentary surface uses:
// - useGate: for a surface that draws its own closed state (the Layers card).
// - <Commentary line button>: commentary that shows one quiet line and one
//   button until the reader finishes the notice, then itself.
// - <CommentaryFoot/>: the small line at the end of each commentary surface,
//   once open: "Commentary, not God’s Word · See the notice again".
// - <NoticeHost/>: mounted once, outside #app (main.tsx); it loads and shows
//   the notice when something asks for it.
//
// Every control that asks for the notice carries aria-haspopup="dialog" and
// data-cn-ask. Pointing at one, or focusing it, fetches the notice's code
// ahead of the tap.

import './commentary.css';
import type { ComponentChildren, ComponentType } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { accepted, askNotice, notice, noticeDone, noticeOpener, reviewNotice } from './state';

/** The attributes of a control that asks for the notice. */
export const ASKS = { 'aria-haspopup': 'dialog', 'data-cn-ask': '' } as const;

/** For a surface that draws its own closed state. `open` says whether
 * commentary is open; `ask` (its button) asks for the notice; once the reader
 * finishes it, the focus moves to `start`, the start of the commentary. */
export function useGate<T extends HTMLElement = HTMLElement>(): { open: boolean; ask: () => void; start: { current: T | null } } {
  const open = accepted.value;
  const start = useRef<T>(null);
  const asked = useRef(false);
  useLayoutEffect(() => {
    if (!open) return;
    if (asked.current) start.current?.focus({ preventScroll: true });
    asked.current = false;
  }, [open]);
  const ask = () => {
    asked.current = true;
    void askNotice().then((ok) => {
      if (!ok) asked.current = false;
    });
  };
  return { open, ask, start };
}

/** A closed commentary surface: one quiet line, then one button that opens the notice. */
export function Closed({ line, button, onAsk }: { line: ComponentChildren; button: string; onAsk: () => void }) {
  return (
    <div class="cn-closed">
      <p class="cn-line">{line}</p>
      <p class="cn-act">
        <button type="button" class="cn-open" onClick={onAsk} {...ASKS}>
          {button}
        </button>
      </p>
    </div>
  );
}

/** Commentary behind the notice: until the reader finishes it, `line` and a
 * button (`button`) in its place; then `children`. */
export function Commentary({ line, button, children }: { line: ComponentChildren; button: string; children: ComponentChildren }) {
  const g = useGate<HTMLDivElement>();
  if (!g.open) return <Closed line={line} button={button} onAsk={g.ask} />;
  return (
    <div class="cn-start" ref={g.start} tabIndex={-1}>
      {children}
    </div>
  );
}

/** The quiet reminder at the end of a commentary surface, once it is open. */
export function CommentaryFoot() {
  if (!accepted.value) return null;
  return (
    <p class="cn-again">
      Commentary, not God’s Word ·{' '}
      <button type="button" onClick={() => void reviewNotice()} {...ASKS}>
        See the notice again
      </button>
    </p>
  );
}

type NoticeType = ComponentType<{ review: boolean }>;
let code: Promise<NoticeType> | null = null;

/** The notice's code, fetched the first time it is asked for. */
function loadNotice(): Promise<NoticeType> {
  if (!code) {
    code = import('./Notice').then((m) => m.Notice);
    code.catch(() => (code = null));
  }
  return code;
}

// Fetch the notice's code as soon as the reader points at, touches or
// focuses a control that asks for it, so the tap rarely waits.
if (typeof document !== 'undefined') {
  const warm = (e: Event) => {
    const t = e.target;
    if (!code && t instanceof Element && t.closest('[data-cn-ask]')) loadNotice().catch(() => undefined);
  };
  for (const type of ['pointerover', 'touchstart', 'focusin']) document.addEventListener(type, warm, { capture: true, passive: true });
}

/** Shows the notice while one is asked for. While its code is still on the
 * way, a clear layer over the page takes the taps (keys wait in state.ts),
 * the asking control is busy, and after a moment "Opening the notice…" shows.
 * If the code cannot load, the commentary stays closed and a short message
 * says so. Renders nothing otherwise. */
export function NoticeHost() {
  const n = notice.value;
  const [C, setC] = useState<{ C: NoticeType } | null>(null);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!n || C) return;
    let live = true;
    setFailed(false);
    const by = noticeOpener();
    by?.setAttribute('aria-busy', 'true');
    const timer = window.setTimeout(() => live && setSlow(true), 300);
    loadNotice().then(
      (got) => live && setC({ C: got }),
      () => {
        if (!live) return;
        setFailed(true);
        noticeDone(false);
      },
    );
    return () => {
      live = false;
      window.clearTimeout(timer);
      setSlow(false);
      by?.removeAttribute('aria-busy');
    };
  }, [n, C]);
  useEffect(() => {
    if (!failed) return;
    const t = window.setTimeout(() => setFailed(false), 6000);
    return () => window.clearTimeout(t);
  }, [failed]);
  if (n && C) return <C.C review={n.review} />;
  if (n)
    return (
      <div class="cn-wait">
        <p role="status">{slow ? 'Opening the notice…' : ''}</p>
      </div>
    );
  if (failed)
    return (
      <p class="cn-fail" role="alert">
        The notice could not open. Check your connection, then try again.
      </p>
    );
  return null;
}
