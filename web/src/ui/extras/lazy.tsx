// Panel code that downloads when a reader first opens the panel, made sturdy
// for phones: a dropped download is tried again by itself (data/fetch.ts
// retry), and if it still fails the panel says so in one quiet line with
// "Try again", instead of showing "…" for ever. The same line serves a panel
// whose files could not load (`again` from retryFailed in data.ts).

import { useEffect, useState } from 'preact/hooks';
import { retry } from '../../data/fetch';
import './lazy.css';

/** Load code once, trying again on a dropped download; a load that still
 * fails is forgotten, so the next call starts afresh. */
export function lazyCode<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => {
    if (!p) {
      const mine = retry(load);
      p = mine;
      mine.catch(() => {
        if (p === mine) p = null;
      });
    }
    return p;
  };
}

/** The loaded code, or null while it loads; `failed` once every try failed,
 * and `again` to start over. */
export function useCode<T>(load: () => Promise<T>): { got: T | null; failed: boolean; again: () => void } {
  const [got, setGot] = useState<{ v: T } | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let live = true;
    load().then(
      (v) => live && setGot({ v }),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [load, tries]);
  return {
    got: got ? got.v : null,
    failed: failed && !got,
    again: () => {
      setFailed(false);
      setTries((t) => t + 1);
    },
  };
}

/** The panel while its code loads, or the quiet line if it could not. */
export function Waiting({ code, text = '…' }: { code: { failed: boolean; again: () => void }; text?: string }) {
  if (code.failed) return <NotLoaded again={code.again} />;
  return <p class="xt-lead xt-wait">{text}</p>;
}

/** "Try again" presses in this visit. A panel's line goes away while it
 * tries again, so the count lives here. */
let asked = 0;

/** "This could not load. Try again", for a panel. After two presses that did
 * not help, the button reloads the page, which clears whatever was stuck. */
export function NotLoaded({ again, what = 'This' }: { again: () => void; what?: string }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy(false), 2500);
    return () => clearTimeout(t);
  }, [busy]);
  const reload = asked >= 2;
  return (
    <p class="xt-lead" role="status">
      {what} could not load. Check your connection, then{' '}
      <button
        type="button"
        class="xt-again"
        disabled={busy}
        onClick={() => {
          if (reload) return location.reload();
          asked++;
          setBusy(true);
          again();
        }}
      >
        {busy ? 'trying…' : reload ? 'reload the page' : 'try again'}
      </button>
      .
    </p>
  );
}
