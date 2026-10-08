// A calm way out when rendering fails: the sky, what happened in a sentence,
// Reload, and the details (the error itself, the build, a report link) one tap
// away. It wraps <App/> in main.tsx and only
// catches errors that would otherwise stop the whole page; panels that handle
// their own failures (the map without WebGL, a chapter that will not load)
// keep handling them.

import { Component, Fragment, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { appBuild, bootSky, clearOfflineData } from '../arrival';
import * as S from '../state';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ComponentChildren }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown): void {
    console.error('Bible Atlas stopped on an error:', error);
  }

  render() {
    return this.state.error ? <Fallback error={this.state.error} /> : this.props.children;
  }
}

/** The repository to report to: this site's own on github.io, else the original. */
function repo(): string {
  const owner = location.hostname.match(/^([\w-]+)\.github\.io$/i)?.[1];
  const name = import.meta.env.BASE_URL.split('/').filter(Boolean)[0];
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

function Fallback({ error }: { error: Error }) {
  const [clearing, setClearing] = useState(false);
  const message = (error.message || String(error)).slice(0, 300);
  return (
    <div class="arr-fallback" role="alert">
      {bootSky && <div class="arr-backdrop" aria-hidden="true" dangerouslySetInnerHTML={{ __html: bootSky }} />}
      <div class="arr-card">
        <p class="arr-kicker">Bible Atlas</p>
        <h1>Something went wrong</h1>
        <p class="arr-say">The page hit an error and stopped. Reloading usually fixes it.</p>
        <div class="arr-actions">
          <button class="arr-btn" onClick={() => location.reload()}>
            Reload
          </button>
          <button
            class="arr-linkbtn"
            disabled={clearing}
            onClick={async () => {
              setClearing(true);
              await clearOfflineData();
              location.reload();
            }}
          >
            {clearing ? 'Clearing…' : 'Clear saved data and reload'}
          </button>
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
