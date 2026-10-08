import { useEffect, useState } from 'preact/hooks';
import { type Atlas, DATA_BASE, loadAtlas } from './data/atlas';
import { loadLayers } from './data/layers';
import { ESV_ENABLED } from './data/esv';
import { TAB_DEPTH, atLeast } from './depth';
import { Engine } from './engine/client';
import * as S from './state';
import { fromOsis, pathFromHash, restoreFromHash, syncHash } from './url';
import { AtlasMap } from './ui/AtlasMap';
import { Connections } from './ui/Connections';
import { DepthControl } from './ui/Depth';
import { Hubs, Paths, Themes } from './ui/Explore';
import { Palette } from './ui/Palette';
import { Reader } from './ui/Reader';
import { Sources } from './ui/Sources';
import { lightTheme } from './ui/ThemeThread';
import { Wheel } from './ui/Wheel';
import { WordStudy } from './ui/WordStudy';

const TABS: [S.Tab, string][] = [
  ['connections', 'Links'],
  ['word', 'Word'],
  ['themes', 'Themes'],
  ['paths', 'Paths'],
  ['hubs', 'Top verses'],
  ['sources', 'Sources'],
];

/** Where a first visit opens: a link the Bible makes itself (1 Peter 2:24 quotes it). */
const FIRST_VERSE = 'Isa.53.5';

const THEME_NEXT = { system: 'light', light: 'dark', dark: 'system' } as const;
const THEME_ICON = {
  system: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
    </svg>
  ),
  light: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="3.2" fill="currentColor" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  ),
  dark: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7z" fill="currentColor" />
    </svg>
  ),
};

/** After restoreFromHash: light a linked theme's thread, find a linked path,
 *  and on a phone open the Explore pane when the link points at a study view. */
async function followLink(atlas: Atlas, eng: Engine, p: [number, number] | null, linked: boolean): Promise<void> {
  const h = new URLSearchParams(location.hash.slice(1));
  const t = S.theme.value;
  if (t) await lightTheme(atlas, t, 'thread', { keepSelection: true });
  if (p) {
    try {
      const res = await eng.path(p[0], p[1], 1);
      if (res) S.path.value = { ...res, ms: eng.lastMs };
    } catch (e) {
      // The map and reader still work; Paths shows its own notice.
      console.warn('Could not restore the linked path', e);
    }
  }
  if (linked && (h.has('t') || h.has('p') || h.has('w'))) S.mobilePane.value = 'study';
}

export function App() {
  const [progress, setProgress] = useState('Starting');
  const [error, setError] = useState<string | null>(null);
  const a = S.atlas.value;

  useEffect(() => {
    let stop: (() => void) | undefined;
    loadAtlas(setProgress)
      .then(async (atlas) => {
        S.atlas.value = atlas;
        void loadLayers(atlas);
        const eng = new Engine(`${DATA_BASE}atlas.bin?${atlas.version}`);
        S.engine.value = eng;
        // Read everything from the link before the address bar starts syncing.
        const linked = location.hash.length > 1;
        restoreFromHash(atlas);
        if (!linked && S.welcome.value === 'show') {
          const first = fromOsis(atlas, FIRST_VERSE);
          if (first !== null) {
            S.holdReaderScroll.value = first;
            S.selectVerse(first);
          }
        }
        const p = pathFromHash(atlas);
        stop = syncHash(atlas);
        await followLink(atlas, eng, p, linked);
        // A link pasted into the same tab only changes the hash; follow it.
        window.addEventListener('hashchange', () => {
          const target = pathFromHash(atlas);
          restoreFromHash(atlas);
          void followLink(atlas, eng, target, true);
        });
      })
      .catch((e: Error) => setError(e.message));
    return () => stop?.();
  }, []);

  // A new tab starts at its top, wherever the last one was scrolled to.
  const tabNow = S.tab.value;
  useEffect(() => {
    const study = document.querySelector('.study');
    if (study) study.scrollTop = 0;
  }, [tabNow]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        S.paletteOpen.value = true;
      } else if (e.key === 'Escape' && !S.paletteOpen.value) {
        S.clearAll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (error) {
    return (
      <div class="loading">
        <div>
          <h1 style="font-family:var(--font-read)">The data did not load</h1>
          <p>{error}</p>
          <p>If you are running from source, build the data first: make data</p>
        </div>
      </div>
    );
  }
  if (!a) {
    return (
      <div class="loading">
        <div>
          <h1 style="font-family:var(--font-read);font-weight:600">Bible Atlas</h1>
          <p>{progress}…</p>
        </div>
      </div>
    );
  }

  const tab = atLeast(TAB_DEPTH[S.tab.value]) ? S.tab.value : 'connections';
  const wheel = S.mapMode.value === 'wheel' && atLeast('study');
  return (
    <div class="app">
      <header class="topbar">
        <div class="brand">
          Bible Atlas<small>{a.meta.counts.crossReferences.toLocaleString()} links · Hebrew, Aramaic and Greek</small>
        </div>
        <button class="searchbox" onClick={() => (S.paletteOpen.value = true)}>
          <span class="ph">Search a verse, phrase or Hebrew/Greek word</span> <kbd>/</kbd>
        </button>
        <span class="spacer" />
        <DepthControl />
        {ESV_ENABLED && (
          <div class="seg" role="group" aria-label="English translation">
            {(['BSB', 'ESV'] as const).map((t) => (
              <button key={t} aria-pressed={S.translation.value === t} onClick={() => (S.translation.value = t)}>
                {t}
              </button>
            ))}
          </div>
        )}
        <button
          class="iconbtn"
          onClick={() => (S.pageTheme.value = THEME_NEXT[S.pageTheme.value])}
          title={`Theme: ${S.pageTheme.value}. Click to change.`}
          aria-label={`Page theme: ${S.pageTheme.value}`}
        >
          {THEME_ICON[S.pageTheme.value]}
        </button>
        {atLeast('study') && (
          <div class="seg mapstyle" role="group" aria-label="Map style">
            <button aria-pressed={!wheel} onClick={() => (S.mapMode.value = 'arcs')}>
              Arcs
            </button>
            <button aria-pressed={wheel} onClick={() => (S.mapMode.value = 'wheel')}>
              Wheel
            </button>
          </div>
        )}
      </header>
      {!wheel ? (
        <AtlasMap a={a} />
      ) : (
        <div class="map">
          <Wheel a={a} />
        </div>
      )}
      <main class="work" data-pane={S.mobilePane.value}>
        <nav class="mobtabs" role="tablist">
          <button role="tab" aria-selected={S.mobilePane.value === 'read'} onClick={() => (S.mobilePane.value = 'read')}>
            Read
          </button>
          <button role="tab" aria-selected={S.mobilePane.value === 'study'} onClick={() => (S.mobilePane.value = 'study')}>
            Explore
          </button>
        </nav>
        <Reader a={a} />
        <aside class="study">
          <div class="tabs" role="tablist">
            {TABS.filter(([id]) => atLeast(TAB_DEPTH[id])).map(([id, name]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => (S.tab.value = id)}>
                {name}
              </button>
            ))}
          </div>
          {tab === 'connections' && <Connections a={a} />}
          {tab === 'word' && <WordStudy a={a} />}
          {tab === 'themes' && <Themes a={a} />}
          {tab === 'paths' && <Paths a={a} />}
          {tab === 'hubs' && <Hubs a={a} />}
          {tab === 'sources' && <Sources a={a} />}
        </aside>
      </main>
      {S.paletteOpen.value && <Palette a={a} />}
    </div>
  );
}
