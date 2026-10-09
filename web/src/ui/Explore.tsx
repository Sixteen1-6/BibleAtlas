// Themes, connection paths and the most-connected verses.

import { useMemo, useState } from 'preact/hooks';
import { RoadCards, RoadsStatus, useRoads } from './Roads';
import { type Atlas, label, versesWithRoot } from '../data/atlas';
import { WhyLinked } from './WhyLinked';
import * as S from '../state';
import { Distribution, Provenance, RootChip, Snippet, sharedRoots, useVerseRow } from './common';
import { themeVerses } from '../data/thread';
import { MiniSky } from './ThemeSky';
import { Few, PreviewRow, ThemeJourney, lightTheme } from './ThemeThread';

// ------------------------------------------------------------ themes

export function Themes({ a }: { a: Atlas }) {
  const active = S.theme.value;
  const t = a.themes.find((x) => x.id === active) ?? null;
  const verses = useMemo(() => (t ? themeVerses(a, t) : new Uint32Array()), [a, t]);
  const top = useMemo(() => Array.from(verses).sort((x, y) => a.rank[y] - a.rank[x]).slice(0, 30), [a, verses]);

  const pick = (id: string | null) => {
    if (id) {
      lightTheme(a, id, 'thread');
      return;
    }
    S.theme.value = null;
    S.path.value = null;
    S.marks.value = null;
    S.groupEdges.value = null;
  };
  // Once a theme is chosen the cards fold into a strip, the chosen one first.
  const cards = t ? [t, ...a.themes.filter((x) => x !== t)] : a.themes;

  return (
    <div class="panel">
      <div class="tj-head">
        <h2>Themes and images</h2>
        {t && (
          <button
            class="tj-all"
            onClick={(e) => {
              const id = t.id;
              let keys = false;
              try {
                keys = (e.currentTarget as HTMLElement).matches(':focus-visible');
              } catch {
                // Older browsers: treat it as a click.
              }
              pick(null);
              // This button goes away: its focus moves to the theme's card in
              // the grid, scrolled into view when it came from the keyboard.
              requestAnimationFrame(() => document.querySelector<HTMLElement>(`.tj-grid .tj-card[data-theme="${CSS.escape(id)}"]`)?.focus({ preventScroll: !keys }));
            }}
          >
            All themes
          </button>
        )}
      </div>
      {t ? (
        <ThemeJourney key={t.id} a={a} theme={t} />
      ) : (
        <p class="muted">Each theme follows specific Hebrew and Greek words, not a hand-picked list, so every lit verse can be checked in the original text.</p>
      )}
      {t && <h3>More themes</h3>}
      <div class={t ? 'tj-strip' : 'cards tj-grid'} role="group" aria-label="Themes">
        {cards.map((th) => (
          <button key={th.id} class="card tj-card" data-theme={th.id} aria-pressed={active === th.id} onClick={() => pick(active === th.id ? null : th.id)}>
            <MiniSky a={a} theme={th} height={t ? 30 : 44} />
            <span class="tj-cardtext">
              <b>{th.name}</b>
              {!t && <span class="tj-blurb">{th.blurb}</span>}
            </span>
          </button>
        ))}
      </div>
      {t && (
        <>
          <h3>Words traced</h3>
          <div class="tj-roots">
            {t.roots.map((r) => (
              <span key={r} class="tj-root">
                <RootChip a={a} root={r} />
                <span class="tj-rootn">{versesWithRoot(a, r).length.toLocaleString()} verses</span>
              </span>
            ))}
          </div>
          <h3>{verses.length.toLocaleString()} verses</h3>
          <Distribution a={a} verses={verses} />
          <h3>Most connected of them</h3>
          <Few key={t.id} items={top} first={5}>
            {(v) => (
              <PreviewRow key={v} v={v} class="refrow" onClick={() => S.selectVerse(v)}>
                <span class="ref">{label(a, v)}</span>
                <span class="vt">{(a.xOff[v + 1] - a.xOff[v] + a.xInOff[v + 1] - a.xInOff[v]).toLocaleString()} links</span>
                <Snippet a={a} v={v} />
              </PreviewRow>
            )}
          </Few>
        </>
      )}
      <Provenance>Theme definitions: config/themes.json in the repository, resolved against STEPBible Strong’s numbers at build time.</Provenance>
    </div>
  );
}

// ------------------------------------------------------------ paths

/** [from, to, a short caption for the pair] */
const EXAMPLES: [string, string, string][] = [
  ['Genesis 3:15', 'Revelation 12:9', 'The serpent crushed'],
  ['Genesis 22:8', 'John 1:29', 'The lamb God provides'],
  ['Isaiah 7:14', 'Matthew 1:23', 'God with us'],
  ['Exodus 12:13', '1 Corinthians 5:7', 'The Passover lamb'],
  ['Psalm 110:1', 'Hebrews 1:13', 'At God’s right hand'],
];

function Step({ a, v, prev, edge }: { a: Atlas; v: number; prev?: number; edge?: number }) {
  const row = useVerseRow(a, v);
  const prevRow = useVerseRow(a, prev);
  const sameLang = prev !== undefined && (a.books[a.verseBook[prev]].testament === 'OT') === (a.books[a.verseBook[v]].testament === 'OT');
  const shared = row && prevRow && sameLang ? sharedRoots(a, prevRow, row, 3) : [];
  return (
    <li>
      {edge !== undefined && <div class="hop">{a.xVotes[edge]} votes for this link</div>}
      <div class="refrow" style="border:0;padding-block:2px" data-lv={v} onClick={() => S.selectVerse(v)}>
        <span class="ref">{label(a, v)}</span>
        <span />
        <span class="snip">{row ? row[0] : '…'}</span>
        {shared.length > 0 && (
          <span class="why">
            {shared.map((r) => (
              <RootChip key={r} a={a} root={r} />
            ))}
          </span>
        )}
      </div>
      {prev !== undefined && !sameLang && <WhyLinked key={`${prev}-${v}`} a={a} from={prev} to={v} fromRow={prevRow} toRow={row} />}
    </li>
  );
}

export function Paths({ a }: { a: Atlas }) {
  const r = useRoads(a);
  const p = r.roads && r.chosen >= 0 ? r.roads[r.chosen] : null;
  // The slider's value while it is being dragged; it is used once let go.
  const [drag, setDrag] = useState<number | null>(null);
  const votes = drag ?? r.minVotes;

  return (
    <div class="panel">
      <h2>Connection paths</h2>
      <p class="muted">Up to three roads of cross-references between two verses.</p>
      <form
        class="roads-form"
        onSubmit={(e) => {
          e.preventDefault();
          r.run();
        }}
      >
        <label class="field">
          <span>From</span>
          <input value={r.from} onInput={(e) => r.setFrom((e.target as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>To</span>
          <input value={r.to} onInput={(e) => r.setTo((e.target as HTMLInputElement).value)} />
        </label>
        <div class="roads-go">
          <button class="btn roads-find" type="submit">
            Find roads
          </button>
          <details class="roads-opts">
            <summary>
              Use links with at least {votes} {votes === 1 ? 'vote' : 'votes'}
            </summary>
            <input
              type="range"
              min={1}
              max={60}
              value={votes}
              aria-label="Fewest votes a link needs to be used"
              onInput={(e) => setDrag(Number((e.target as HTMLInputElement).value))}
              onChange={(e) => {
                r.setMinVotes(Number((e.target as HTMLInputElement).value));
                setDrag(null);
                if (r.roads) r.run();
              }}
            />
            <p>
              Votes come from OpenBible.info readers. Roads prefer strong links: each step counts 1, plus up to 3 more when its link has few votes. A lower number finds more roads; a higher one keeps
              to the most-voted links. The search is Dijkstra’s algorithm, run in WebAssembly by the app’s Rust engine (crates/atlas-core).
            </p>
          </details>
        </div>
      </form>
      <div class="roads-try">
        <span>Try</span>
        {EXAMPLES.map(([f, t, caption]) => (
          <button key={f + t} type="button" class="chip" title={`${f} → ${t}`} aria-label={`${caption}: ${f} to ${t}`} onClick={() => r.run(f, t)}>
            {caption}
          </button>
        ))}
      </div>
      <RoadsStatus onRetry={r.retryAll} />
      <RoadCards a={a} onRetry={r.retryAll} />
      {p && (
        <>
          <h3>
            Road {r.chosen + 1} · {p.verses.length - 1} {p.verses.length === 2 ? 'step' : 'steps'}
          </h3>
          <ol class="steps">
            {p.verses.map((v, i) => (
              <Step key={v} a={a} v={v} prev={i ? p.verses[i - 1] : undefined} edge={i ? p.edges[i - 1] : undefined} />
            ))}
          </ol>
        </>
      )}
      <Provenance>
        Roads found by the app’s own engine in OpenBible.info’s reader-voted cross-references{r.took ? `, in ${r.took.toFixed(1)} ms` : ''}. Each road after the first avoids every verse the
        earlier roads pass through.
      </Provenance>
    </div>
  );
}

// ------------------------------------------------------------ hubs

export function Hubs({ a }: { a: Atlas }) {
  const top = useMemo(() => {
    const idx = Array.from({ length: a.n }, (_, i) => i);
    idx.sort((x, y) => a.rank[y] - a.rank[x]);
    return idx.slice(0, 50);
  }, [a]);
  return (
    <div class="panel">
      <h2>Most connected verses</h2>
      <p class="muted">Ranked by PageRank over the cross-reference graph: a verse ranks high when strongly linked verses point to it, the same idea search engines use for pages.</p>
      <Few items={top} first={10}>
        {(v, i) => (
          <PreviewRow key={v} v={v} class="refrow" onClick={() => S.selectVerse(v)}>
            <span class="ref">
              {i + 1}. {label(a, v)}
            </span>
            <span class="vt">{(a.xOff[v + 1] - a.xOff[v] + a.xInOff[v + 1] - a.xInOff[v]).toLocaleString()} links</span>
            <Snippet a={a} v={v} max={140} />
          </PreviewRow>
        )}
      </Few>
      <Provenance>
        PageRank (damping {a.meta.pagerank.damping}, {a.meta.pagerank.iterations} iterations) computed at build time in Rust over positively voted links, weighted by votes.
      </Provenance>
    </div>
  );
}
