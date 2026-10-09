// Themes, connection paths and the most-connected verses.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { RoadCards, RoadsStatus, useRoads } from './Roads';
import { type Atlas, type Theme, label, linkCount, versesWithRoot } from '../data/atlas';
import { featuredThemes, shownAt, themeCount, themeGroups } from '../data/themes';
import { WhyLinked } from './WhyLinked';
import { atLeast } from '../depth';
import * as S from '../state';
import { Distribution, Provenance, RootChip, Snippet, sharedRoots, useVerseRow } from './common';
import { themeVerses } from '../data/thread';
import { MiniSky, warmThemes } from './ThemeSky';
import { Few, OftenLinked, PreviewRow, SeptuagintPairs, ThemeJourney, closeTheme, lightTheme, themeLevel } from './ThemeThread';
import { VerseThemeCard } from './VerseThemes';

// ------------------------------------------------------------ themes

/** The list of every theme is open (it stays open while a theme is chosen,
 *  so "All themes" comes back to it), which groups are open, and the filter. */
const listOpen = signal(false);
const openGroups = signal<ReadonlySet<string>>(new Set());
const filter = signal('');

/** Theme names as buttons that choose the theme, wrapping onto new lines. */
function ThemeChips({ a, themes, onPick }: { a: Atlas; themes: number[]; onPick: (id: string) => void }) {
  const study = atLeast('study');
  return (
    <div class="tj-chips">
      {themes.map((j) => {
        const t = a.themes[j];
        return (
          <button key={t.id} type="button" class="tj-chip" data-theme={t.id} onClick={() => onPick(t.id)}>
            {t.name}
            {study && t.level === 'study' && <span class="tj-broad">broad word</span>}
          </button>
        );
      })}
    </div>
  );
}

/** "All 154 themes": closed until asked for, then the groups, each closed
 *  until opened. Study adds a filter over every theme. */
function ThemeList({ a, onPick }: { a: Atlas; onPick: (id: string) => void }) {
  const level = themeLevel();
  const study = atLeast('study');
  const count = themeCount(a, level);
  const groups = useMemo(() => themeGroups(a, level), [a, level]);
  const q = study ? filter.value.trim().toLowerCase() : '';
  const found = useMemo(
    () => (q ? a.themes.flatMap((t, j) => (shownAt(t, level) && (t.name.toLowerCase().includes(q) || t.blurb.toLowerCase().includes(q)) ? [j] : [])) : []),
    [a, level, q],
  );
  const isOpen = listOpen.value;
  // One button opens and hides the list, so the focus stays on it.
  const head = (
    <button type="button" class={isOpen ? 'tj-listhead' : 'btn tj-allbtn'} aria-expanded={isOpen} onClick={() => (listOpen.value = !isOpen)}>
      All {count} themes {isOpen ? <span class="tj-hide">Hide</span> : '›'}
    </button>
  );
  if (!isOpen) return <section class="tj-list is-closed">{head}</section>;
  const toggle = (id: string) => {
    const next = new Set(openGroups.peek());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    openGroups.value = next;
  };
  return (
    <section class="tj-list" aria-label={`All ${count} themes`}>
      {head}
      {study && (
        <label class="tj-find">
          <span class="sr-only">Find a theme</span>
          <input type="search" placeholder="Find a theme" value={filter.value} onInput={(e) => (filter.value = (e.target as HTMLInputElement).value)} />
        </label>
      )}
      {q ? (
        found.length ? (
          <ThemeChips a={a} themes={found} onPick={onPick} />
        ) : (
          <p class="muted tj-none">No theme’s name or description has these words.</p>
        )
      ) : (
        groups.map((g) => {
          const shown = openGroups.value.has(g.id);
          const sample = g.themes.slice(0, 3).map((j) => a.themes[j].name);
          return (
            <div key={g.id} class={`tj-group${shown ? ' is-open' : ''}`}>
              <button type="button" class="tj-grow" aria-expanded={shown} onClick={() => toggle(g.id)}>
                <span class="tj-gname">{g.name}</span>
                <span class="tj-gcount">{g.themes.length}</span>
                <span class="tj-gsample">
                  {sample.join(', ')}
                  {g.themes.length > sample.length ? '…' : ''}
                </span>
              </button>
              {shown && <ThemeChips a={a} themes={g.themes} onPick={onPick} />}
            </div>
          );
        })
      )}
    </section>
  );
}

/** Study: the words a theme follows, with the verses each lights, and the
 *  senses deliberately left out. Deep: the count rule, where it is set. */
function WordsTraced({ a, theme, verses }: { a: Atlas; theme: Theme; verses: Uint32Array }) {
  const deep = atLeast('deep');
  const skip = theme.skipWith ?? [];
  // Verses that hold a skipWith word and so are not counted.
  const skipped = useMemo(() => {
    if (!skip.length) return 0;
    const all = new Set<number>();
    for (const r of theme.roots) for (const v of versesWithRoot(a, r)) all.add(v);
    return all.size - verses.length;
  }, [a, theme, verses]);
  return (
    <>
      <h3>Words traced</h3>
      <div class="tj-roots">
        {theme.roots.map((r) => (
          <span key={r} class="tj-root">
            <RootChip a={a} root={r} />
            <span class="tj-rootn">{versesWithRoot(a, r).length.toLocaleString()} verses</span>
          </span>
        ))}
      </div>
      {(theme.left?.length ?? 0) > 0 && (
        <>
          <h3>Left out</h3>
          <p class="tj-why">Other senses of these words, not traced, and never offered through links on a verse that holds one:</p>
          <div class="tj-roots">
            {theme.left!.map((r) => (
              <RootChip key={r} a={a} root={r} />
            ))}
          </div>
        </>
      )}
      {deep && skip.length > 0 && (
        <>
          <h3>Count rule</h3>
          <p class="tj-why">
            A verse that also holds {skip.length === 1 ? 'this word' : 'one of these words'} is not counted, so a number inside a larger count is left out:{' '}
            {skipped.toLocaleString()} {skipped === 1 ? 'verse' : 'verses'}.
          </p>
          <div class="tj-roots">
            {skip.map((r) => (
              <RootChip key={r} a={a} root={r} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** Deep: where the theme is defined and what it was resolved against. */
function ThemeSource({ a }: { a: Atlas }) {
  const file = a.meta.files['themes.json'];
  const step = a.meta.sources.find((s) => s.id === 'tahot');
  return (
    <p class="tj-why tj-source">
      Defined in <code>config/themes.json</code> and resolved against STEPBible’s Strong’s numbers{step ? <> (TAHOT and TAGNT, commit {step.commit.slice(0, 10)})</> : null} when the data
      is built. Build <code>{a.meta.buildId}</code>
      {file ? <>, themes.json SHA-256 {file.sha256.slice(0, 16)}…</> : null}.
    </p>
  );
}

export function Themes({ a }: { a: Atlas }) {
  const active = S.theme.value;
  const t = a.themes.find((x) => x.id === active) ?? null;
  const sel = S.selected.value;
  const study = atLeast('study');
  const deep = atLeast('deep');
  const mode = S.arcColor.value;
  const verses = useMemo(() => (t ? themeVerses(a, t) : new Uint32Array()), [a, t]);
  const top = useMemo(() => Array.from(verses).sort((x, y) => a.rank[y] - a.rank[x]).slice(0, 30), [a, verses]);
  const featured = useMemo(() => featuredThemes(a), [a]);

  // The chosen theme and the themes often linked with it are a tap away:
  // work out what choosing them needs in idle moments.
  useEffect(() => {
    if (!t) return;
    const partners = (t.near ?? []).map(([j]) => a.themes[j]).filter(Boolean);
    warmThemes(a, [t, ...partners], mode, ['pick', 'hero']);
  }, [a, t, mode]);

  const pick = (id: string) => lightTheme(a, id, 'thread');
  const allThemes = (e: MouseEvent) => {
    if (!t) return;
    const id = t.id;
    const group = t.group ?? '';
    let keys = false;
    try {
      keys = (e.currentTarget as HTMLElement).matches(':focus-visible');
    } catch {
      // Older browsers: treat it as a click.
    }
    closeTheme();
    // Back to the list, with the theme's group open; the focus moves to the
    // theme's card or chip, scrolled into view when it came from the keyboard.
    listOpen.value = true;
    if (!featured.includes(t)) openGroups.value = new Set([...openGroups.peek(), group]);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`.tj-pick [data-theme="${CSS.escape(id)}"]`)?.focus({ preventScroll: !keys }));
  };

  return (
    <div class="panel">
      <div class="tj-head">
        <h2>Themes and images</h2>
        {t && (
          <button class="tj-all" onClick={allThemes}>
            All themes
          </button>
        )}
      </div>
      {t ? (
        <>
          <ThemeJourney key={t.id} a={a} theme={t} />
          <OftenLinked a={a} theme={t} />
          {study && <WordsTraced a={a} theme={t} verses={verses} />}
          {deep && <SeptuagintPairs a={a} theme={t} />}
          <h3>{verses.length.toLocaleString()} verses</h3>
          <Distribution a={a} verses={verses} />
          <h3>Most connected of them</h3>
          <Few key={t.id} items={top} first={5}>
            {(v) => (
              <PreviewRow key={v} v={v} class="refrow" onClick={() => S.selectVerse(v, { openTab: true })}>
                <span class="ref">{label(a, v)}</span>
                <span class="vt">{linkCount(a, v).toLocaleString()} links</span>
                <Snippet a={a} v={v} />
              </PreviewRow>
            )}
          </Few>
          {deep && <ThemeSource a={a} />}
        </>
      ) : (
        <div class="tj-pick">
          {sel !== null && <VerseThemeCard key={sel} a={a} v={sel} />}
          <p class="muted">Each theme follows specific Hebrew and Greek words, not a hand-picked list, so every lit verse can be checked in the original text.</p>
          <h3>Start with</h3>
          <div class="cards tj-grid" role="group" aria-label="Themes to start with">
            {featured.map((th) => (
              <button key={th.id} class="card tj-card" data-theme={th.id} onClick={() => pick(th.id)}>
                <MiniSky a={a} theme={th} height={44} />
                <span class="tj-cardtext">
                  <b>{th.name}</b>
                  <span class="tj-blurb">{th.blurb}</span>
                </span>
              </button>
            ))}
          </div>
          <ThemeList a={a} onPick={pick} />
        </div>
      )}
      <Provenance>
        Theme definitions: config/themes.json in the repository, resolved against STEPBible Strong’s numbers at build time. Links between verses and between themes: OpenBible.info
        cross-references.
      </Provenance>
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
      <div class="refrow" style="border:0;padding-block:2px" data-lv={v} onClick={() => S.selectVerse(v, { openTab: true })}>
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
          <PreviewRow key={v} v={v} class="refrow" onClick={() => S.selectVerse(v, { openTab: true })}>
            <span class="ref">
              {i + 1}. {label(a, v)}
            </span>
            <span class="vt">{linkCount(a, v).toLocaleString()} links</span>
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
