// The commentary notice: two big, calm pages before the reader first sees
// people's words about the Bible. Page 1 says this is commentary, not God's
// Word; page 2 asks them to check it against the Bible, in the words of
// Acts 17:11. It closes only by finishing page 2 or by "Not now" (or a phone's
// Back, which counts as "Not now"). Escape and a click outside do nothing.
//
// A native <dialog> opened with showModal(): it sits in the top layer, the page
// behind it is inert, and focus stays inside. Without <dialog>, a fallback
// does the same by hand. Loaded the first time the notice is asked for.

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { escapeJustPressed, noticeDone, noticeOpener } from './state';

const NATIVE = typeof HTMLDialogElement === 'function' && typeof HTMLDialogElement.prototype.showModal === 'function';

// Acts 17:11, copied from the repository's BSB data (web/public/data/bsb.txt,
// line 27535; data/raw/examples.bsb@48a9feb71f/45ACTBSB.usfm, line 1083).
const BEREANS =
  'Now the Bereans were more noble-minded than the Thessalonians, for they received the message with great eagerness and examined the Scriptures every day to see if these teachings were true.';

/** An open book: the Bible. */
const BOOK = (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path
      d="M3.5 7.5c4.2-1.7 8.4-1.4 12.5 1.2v17c-4.1-2.6-8.3-2.9-12.5-1.2z M28.5 7.5c-4.2-1.7-8.4-1.4-12.5 1.2v17c4.1-2.6 8.3-2.9 12.5-1.2z"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
    />
  </svg>
);

/** A speech bubble: people's words. */
const TALK = (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M6 6.5h20a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 1-2.5 2.5H14l-6 5v-5H6A2.5 2.5 0 0 1 3.5 20V9A2.5 2.5 0 0 1 6 6.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
    <path d="M9 12.5h14M9 16.5h9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  </svg>
);

export function Notice({ review }: { review: boolean }) {
  const [page, setPage] = useState<1 | 2>(1);
  const box = useRef<HTMLDialogElement & HTMLDivElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  /** Set once the notice is on its way out, so its close event is not taken for "Not now". */
  const closing = useRef(false);
  const id = useId();

  // Open it. On the way out (any way out), close it and hand the focus back
  // to whatever asked for it, unless the commentary it opened took it.
  useLayoutEffect(() => {
    const el = box.current!;
    let undo = () => {};
    if (NATIVE) {
      const dlg = el;
      const onCancel = (e: Event) => {
        // Escape does nothing. Any other close request (a phone's Back) is "Not now".
        if (escapeJustPressed()) e.preventDefault();
      };
      const onClose = () => {
        if (closing.current) return;
        closing.current = true;
        noticeDone(false);
      };
      dlg.addEventListener('cancel', onCancel);
      dlg.addEventListener('close', onClose);
      try {
        dlg.showModal();
      } catch {
        // Already open, or not in the document: nothing to show.
      }
      undo = () => {
        dlg.removeEventListener('cancel', onCancel);
        dlg.removeEventListener('close', onClose);
        if (dlg.open) dlg.close();
      };
    } else {
      // Everything else on the page goes inert: the app, and an open panel.
      const host = el.closest('.cn-veil')?.parentElement;
      const others = [...document.body.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c !== host);
      const was = others.map((o) => o.inert);
      for (const o of others) o.inert = true;
      undo = () => others.forEach((o, i) => (o.inert = was[i]));
    }
    return () => {
      closing.current = true;
      undo();
      const back = noticeOpener();
      const at = document.activeElement;
      if (back && (!at || at === document.body || el.contains(at))) back.focus({ preventScroll: true });
    };
  }, []);

  // On opening and on every page, the focus goes to the page's heading, so a
  // screen reader reads the heading, then the words.
  useLayoutEffect(() => {
    head.current?.focus({ preventScroll: true });
    box.current?.querySelector('.cn-body')?.scrollTo({ top: 0 });
  }, [page]);

  // A click on the dimmed page outside keeps the focus where it was.
  useEffect(() => {
    const el = box.current!;
    const keep = (e: MouseEvent) => {
      if (e.target === el) e.preventDefault();
    };
    el.addEventListener('mousedown', keep);
    return () => el.removeEventListener('mousedown', keep);
  }, []);

  const end = (finished: boolean) => {
    if (closing.current) return;
    closing.current = true;
    const el = box.current;
    if (NATIVE && el?.open) el.close();
    noticeDone(finished);
  };

  const top = (
    <div class="cn-top">
      <p class="cn-step">
        <span class="sr-only">Page </span>
        {page} of 2
        <span class="cn-dots" aria-hidden="true">
          <i class={page === 1 ? 'on' : ''} />
          <i class={page === 2 ? 'on' : ''} />
        </span>
      </p>
      <button type="button" class="cn-not" onClick={() => end(false)}>
        {review ? 'Close' : 'Not now'}
      </button>
    </div>
  );

  const body =
    page === 1 ? (
      <div class="cn-page" key="1">
        <h2 class="cn-h" id={`${id}-h`} ref={head} tabIndex={-1}>
          This is commentary, not God’s Word
        </h2>
        <div id={`${id}-d`}>
          <ul class="cn-pair">
            <li class="cn-box cn-bible">
              {BOOK}
              <div>
                <b>The Bible</b>
                <span>God’s Word</span>
              </div>
            </li>
            <li class="cn-box cn-comm">
              {TALK}
              <div>
                <b>Commentary</b>
                <span>People’s words about the Bible</span>
              </div>
            </li>
          </ul>
          <p class="cn-p">What you are about to read was written by people. It can help you understand the Bible, but it is not the Bible.</p>
        </div>
      </div>
    ) : (
      <div class="cn-page" key="2">
        <h2 class="cn-h" id={`${id}-h`} ref={head} tabIndex={-1}>
          Check it with the Bible
        </h2>
        <div id={`${id}-d`}>
          <p class="cn-p">Test what you read against the Bible, as the people of Berea did:</p>
          <blockquote class="cn-verse">
            <p>“{BEREANS}”</p>
            <footer>Acts 17:11, Berean Standard Bible</footer>
          </blockquote>
          <p class="cn-p cn-strong">If anything here disagrees with the Bible, trust the Bible.</p>
        </div>
      </div>
    );

  const foot =
    page === 1 ? (
      <div class="cn-foot">
        <button type="button" class="cn-btn cn-go" onClick={() => setPage(2)}>
          Next <span aria-hidden="true">›</span>
        </button>
      </div>
    ) : (
      <div class="cn-foot cn-two">
        <button type="button" class="cn-btn" onClick={() => setPage(1)}>
          <span aria-hidden="true">‹</span> Back
        </button>
        <button type="button" class="cn-btn cn-go" onClick={() => end(true)}>
          {review ? 'I understand' : 'I understand. Show the commentary'}
        </button>
      </div>
    );

  const inside = (
    <>
      {top}
      <div class="cn-body">{body}</div>
      {foot}
    </>
  );

  if (NATIVE) {
    return (
      <dialog ref={box} class="cn-dialog" aria-labelledby={`${id}-h`} aria-describedby={`${id}-d`}>
        {inside}
      </dialog>
    );
  }
  return (
    <div class="cn-veil">
      <div ref={box} class="cn-dialog" data-fallback="" role="dialog" aria-modal="true" aria-labelledby={`${id}-h`} aria-describedby={`${id}-d`}>
        {inside}
      </div>
    </div>
  );
}
