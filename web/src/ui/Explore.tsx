// Themes, connection paths and the most-connected verses.

import { useMemo, useState } from 'preact/hooks';
import { type Atlas, label, versesWithRoot } from '../data/atlas';
import { WhyLinked } from './WhyLinked';
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

const EXAMPLES: [string, string][] = [
  ['Genesis 3:15', 'Revelation 12:9'],
  ['Genesis 22:8', 'John 1:29'],
  ['Isaiah 7:14', 'Matthew 1:23'],
  ['Exodus 12:13', '1 Corinthians 5:7'],
  ['Psalm 110:1', 'Hebrews 1:13'],
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
      {prev !== undefined && !sameLang && <WhyLinked a={a} from={prev} to={v} fromRow={prevRow} toRow={row} />}
    </li>
  );
}

export function Paths({ a }: { a: Atlas }) {
  const [from, setFrom] = useState('Genesis 3:15');
  const [to, setTo] = useState('Revelation 12:9');
  const [minVotes, setMinVotes] = useState(5);
  const [msg, setMsg] = useState<string | null>(null);
  const p = S.path.value;

  const run = async (f = from, t = to) => {
    const eng = S.engine.value;
    if (!eng) return;
    setMsg(null);
    const [ra, rb] = await Promise.all([eng.parseRef(f), eng.parseRef(t)]);
    if (!ra || !rb) {
      setMsg(`Could not read ${!ra ? `“${f}”` : `“${t}”`}. Try a form like “John 3:16”.`);
      return;
    }
    const res = await eng.path(ra[0], rb[0], minVotes);
    if (!res) {
      S.path.value = null;
      setMsg(`No chain of links with at least ${minVotes} votes joins these verses. Lower the threshold and try again.`);
      return;
    }
    S.theme.value = null;
    S.marks.value = null;
    S.groupEdges.value = null;
    S.selected.value = null;
    S.path.value = { ...res, ms: eng.lastMs };
  };

  return (
    <div class="panel">
      <h2>Connection paths</h2>
      <p class="muted">Finds the chain of cross-references between any two verses, preferring short chains of strongly voted links.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <label class="field">
          <span>From</span>
          <input value={from} onInput={(e) => setFrom((e.target as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>To</span>
          <input value={to} onInput={(e) => setTo((e.target as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>Use links with at least {minVotes} votes</span>
          <input type="range" min={1} max={60} value={minVotes} onInput={(e) => setMinVotes(Number((e.target as HTMLInputElement).value))} />
        </label>
        <button class="btn" type="submit">
          Find path
        </button>
      </form>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
        {EXAMPLES.map(([f, t]) => (
          <button
            key={f + t}
            class="chip"
            onClick={() => {
              setFrom(f);
              setTo(t);
              run(f, t);
            }}
          >
            {f} → {t}
          </button>
        ))}
      </div>
      {msg && <p class="notice" style="margin-top:12px">{msg}</p>}
      {p && (
        <>
          <h3>
            {p.verses.length - 1} {p.verses.length === 2 ? 'step' : 'steps'} · found in {p.ms.toFixed(1)} ms by the Rust engine
          </h3>
          <ol class="steps">
            {p.verses.map((v, i) => (
              <Step key={v} a={a} v={v} prev={i ? p.verses[i - 1] : undefined} edge={i ? p.edges[i - 1] : undefined} />
            ))}
          </ol>
        </>
      )}
      <Provenance>Paths run Dijkstra’s algorithm over the OpenBible.info links in WebAssembly (crates/atlas-core). Each step costs 1, plus up to 3 more for weakly voted links.</Provenance>
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
