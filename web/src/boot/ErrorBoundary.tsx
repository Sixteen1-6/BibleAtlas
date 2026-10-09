// A calm way out when rendering fails: the sky, what happened in a sentence,
// one button, and the details (the error itself, the build, a report link)
// one tap away. It wraps <App/> in main.tsx and takes over only when the page
// could not be drawn:
// - An error while rendering leaves the page blank or half-drawn, so the error
//   screen replaces it.
// - An error in an effect that runs after the page is drawn (useEffect) leaves
//   the page as it was, so it is logged and the app keeps running. (On an
//   iPhone short of canvas memory, a 2D canvas can come back null: a missing
//   strip of colour is better than an error screen.)
// - Panels that handle their own failures (the map without WebGL, a chapter
//   that will not load) keep handling them.
// When the same view stops again right after a reload, the button opens the
// atlas from the start instead, since that view would only stop again.

import { Component, Fragment, options, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { appBuild, bootSky, clearOfflineData } from '../arrival';
import * as S from '../state';

const BASE = import.meta.env.BASE_URL;

// Preact runs every useEffect and its cleanup from this scheduler, after the
// page is drawn. Counting the runs lets the boundary tell their errors apart.
let afterPaint = 0;
const scheduleEffects = options.requestAnimationFrame;
options.requestAnimationFrame = (flush) => {
  const run = () => {
    afterPaint++;
    try {
      flush();
    } finally {
      afterPaint--;
    }
  };
  if (scheduleEffects) scheduleEffects(run);
  else nextFrame(run);
};

/** Preact's own timing: just after the next frame, or after 35 ms in a hidden tab. */
function nextFrame(run: () => void): void {
  const done = () => {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    setTimeout(run);
  };
  const timer = setTimeout(done, 35);
  const raf = requestAnimationFrame(done);
}

interface State {
  error: Error | null;
  /** This same view stopped a moment ago too. */
  again: boolean;
}

export class ErrorBoundary extends Component<{ children: ComponentChildren }, State> {
  state: State = { error: null, again: false };

  static getDerivedStateFromError(error: unknown): Partial<State> | null {
    if (afterPaint) return null; // the page is drawn: see componentDidCatch
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown): void {
    if (afterPaint) {
      // Handling it here (with an empty update) is what lets the remaining
      // effects run; the page itself does not change.
      console.error('Bible Atlas: a background step failed; the page keeps running.', error);
      this.setState({});
      return;
    }
    console.error('Bible Atlas stopped on an error:', error);
    // The error screen shows alone, not under the boot sky as it fades.
    document.getElementById('boot')?.remove();
    this.setState({ again: stoppedHereBefore() });
  }

  render() {
    const { error, again } = this.state;
    return error ? <Fallback error={error} again={again} /> : this.props.children;
  }
}

const STOPPED_KEY = 'atlas.stopped';

/** Did this same view stop a moment ago? Then reloading it would only stop again. */
function stoppedHereBefore(): boolean {
  const here = location.hash;
  try {
    const last = JSON.parse(sessionStorage.getItem(STOPPED_KEY) ?? 'null') as { hash?: string; at?: number } | null;
    sessionStorage.setItem(STOPPED_KEY, JSON.stringify({ hash: here, at: Date.now() }));
    return !!last && last.hash === here && Date.now() - (last.at ?? 0) < 10 * 60_000;
  } catch {
    return false; // storage blocked: offer Reload, as on a first stop
  }
}

/** The repository to report to: this site's own on github.io, else the original. */
function repo(): string {
  const owner = location.hostname.match(/^([\w-]+)\.github\.io$/i)?.[1];
  const name = BASE.split('/').filter(Boolean)[0];
  return owner && name ? `https://github.com/${owner}/${name}` : 'https://github.com/Sixteen1-6/BibleAtlas';
}

function facts(): [string, string][] {
  return [
    ['Page', location.href],
    ['App', appBuild],
    ['Data', S.atlas.peek()?.meta.buildId ?? 'not loaded'],
    ['Browser', navigator.userAgent],
  ];
}

/** A prefilled new-issue link. Nothing is sent unless the visitor submits it on GitHub. */
function reportUrl(error: Error): string {
  const stack = (error.stack ?? '')
    .split('\n')
    .slice(0, 8)
    .map((l) => l.slice(0, 200))
    .join('\n');
  const body = [
    '**What were you doing when it stopped?**',
    '',
    '',
    '**Error**',
    '```',
    stack.includes(error.message) ? stack : `${error.message}\n${stack}`,
    '```',
    '',
    ...facts().map(([k, v]) => `- ${k}: ${v}`),
  ].join('\n');
  const title = `Error: ${error.message}`.slice(0, 100);
  return `${repo()}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body.slice(0, 6000))}`;
}

function Fallback({ error, again }: { error: Error; again: boolean }) {
  const [clearing, setClearing] = useState(false);
  const message = (error.message || String(error)).slice(0, 300);
  // The view in the address is what stops: open the atlas without it.
  const fresh = again && location.hash.length > 1;
  const say = fresh
    ? 'It stopped again on this view. Starting from the beginning should get you back in.'
    : again
      ? 'It stopped again. Please try again in a little while.'
      : 'The page hit an error and stopped. Reloading usually fixes it.';
  // Only when there is an offline copy to clear, and a connection to fetch the site again.
  const canClear = navigator.onLine && !!navigator.serviceWorker?.controller;
  return (
    <div class="arr-fallback" role="alert">
      {bootSky && <div class="arr-backdrop" aria-hidden="true" dangerouslySetInnerHTML={{ __html: bootSky }} />}
      <div class="arr-card">
        <p class="arr-kicker">Bible Atlas</p>
        <h1>Something went wrong</h1>
        <p class="arr-say">{say}</p>
        <div class="arr-actions">
          {fresh ? (
            <button class="arr-btn" onClick={() => location.replace(BASE)}>
              Start from the beginning
            </button>
          ) : (
            <button class="arr-btn" onClick={() => location.reload()}>
              Reload
            </button>
          )}
          {canClear && (
            <button
              class="arr-linkbtn"
              disabled={clearing}
              onClick={async () => {
                setClearing(true);
                await clearOfflineData();
                location.replace(BASE);
              }}
            >
              {clearing ? 'Clearing…' : 'Clear the offline copy and start again'}
            </button>
          )}
        </div>
        <details class="arr-more">
          <summary>Details</summary>
          <p class="arr-err">{message}</p>
          <dl>
            {facts().map(([k, v]) => (
              <Fragment key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </Fragment>
            ))}
          </dl>
          <a href={reportUrl(error)} target="_blank" rel="noopener noreferrer">
            Report on GitHub
          </a>
          <p class="arr-fine">Opens a prefilled issue on GitHub. Nothing is sent unless you submit it there.</p>
        </details>
      </div>
    </div>
  );
}
