// Themes, connection paths and the most-connected verses.

import { useMemo, useState } from 'preact/hooks';
import { RoadCards, RoadsStatus, useRoads } from './Roads';
import { type Atlas, label, versesWithRoot } from '../data/atlas';
import * as S from '../state';
import { Distribution, Provenance, RootChip, Snippet, sharedRoots, useVerseRow } from './common';

// ------------------------------------------------------------ themes

export function Themes({ a }: { a: Atlas }) {
  const active = S.theme.value;
  const t = a.themes.find((x) => x.id === active) ?? null;
  const verses = useMemo(() => {
    if (!t) return new Uint32Array();
    const set = new Set<number>();
    for (const r of t.roots) for (const v of versesWithRoot(a, r)) set.add(v);
    return Uint32Array.from([...set].sort((x, y) => x - y));
  }, [a, t]);
  const top = useMemo(() => Array.from(verses).sort((x, y) => a.rank[y] - a.rank[x]).slice(0, 30), [a, verses]);

  const pick = async (id: string | null) => {
    S.theme.value = id;
    S.path.value = null;
    if (!id) {
      S.marks.value = null;
      S.groupEdges.value = null;
      return;
    }
    const th = a.themes.find((x) => x.id === id)!;
    const set = new Set<number>();
    for (const r of th.roots) for (const v of versesWithRoot(a, r)) set.add(v);
    const vs = Uint32Array.from([...set].sort((x, y) => x - y));
    S.marks.value = { verses: vs, label: `theme:${id}` };
    S.selected.value = null;
    const edges = await S.engine.value?.linksWithin(a.n, vs, 2);
    if (edges && S.theme.value === id) S.groupEdges.value = { edges, label: `${th.name}: ${edges.length.toLocaleString()} links between ${vs.length.toLocaleString()} verses` };
  };

  return (
    <div class="panel">
      <h2>Themes and images</h2>
      <p class="muted">Each theme follows specific Hebrew and Greek words, not a hand-picked list, so every lit verse can be checked in the original text.</p>
      <div class="cards">
        {a.themes.map((th) => (
          <button key={th.id} class="card" aria-pressed={active === th.id} onClick={() => pick(active === th.id ? null : th.id)}>
            <b>{th.name}</b>
            <p>{th.blurb}</p>
          </button>
        ))}
      </div>
      {t && (
        <>
          <h3>Words traced</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            {t.roots.map((r) => (
              <RootChip key={r} a={a} root={r} />
            ))}
          </div>
          <h3>{verses.length.toLocaleString()} verses</h3>
          <Distribution a={a} verses={verses} />
          <h3>Most connected of them</h3>
          {top.map((v) => (
            <div key={v} class="refrow" onClick={() => S.selectVerse(v)}>
              <span class="ref">{label(a, v)}</span>
              <span class="vt">{(a.xOff[v + 1] - a.xOff[v] + a.xInOff[v + 1] - a.xInOff[v]).toLocaleString()} links</span>
              <Snippet a={a} v={v} />
            </div>
          ))}
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
      <div class="refrow" style="border:0;padding:2px 0" onClick={() => S.selectVerse(v)}>
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
      <p class="muted">Find the roads of cross-references between two verses.</p>
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
            Find path
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
              to the best-attested links.
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
      <RoadCards a={a} />
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
        Roads: Dijkstra’s algorithm over the OpenBible.info links, in WebAssembly (crates/atlas-core){r.took ? `, found in ${r.took.toFixed(1)} ms` : ''}. Each road after the first avoids the inner
        verses of the roads before it.
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
      {top.map((v, i) => (
        <div key={v} class="refrow" onClick={() => S.selectVerse(v)}>
          <span class="ref">
            {i + 1}. {label(a, v)}
          </span>
          <span class="vt">{(a.xOff[v + 1] - a.xOff[v] + a.xInOff[v + 1] - a.xInOff[v]).toLocaleString()} links</span>
          <Snippet a={a} v={v} max={140} />
        </div>
      ))}
      <Provenance>
        PageRank (damping {a.meta.pagerank.damping}, {a.meta.pagerank.iterations} iterations) computed at build time in Rust over positively voted links, weighted by votes.
      </Provenance>
    </div>
  );
}
