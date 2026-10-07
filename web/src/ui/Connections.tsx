// Everything a selected verse connects to, and why.

import { useMemo, useState } from 'preact/hooks';
import { type Atlas, label, rangeLabel } from '../data/atlas';
import * as S from '../state';
import { OrigLine, Provenance, RootChip, Snippet, sharedRoots, useVerseRow } from './common';

const STARTERS = ['John 3:16', 'Isaiah 53:5', 'Genesis 1:1', 'Psalm 22:1', 'Romans 8:28', 'Micah 5:2'];

interface Link {
  v: number;
  span: number;
  votes: number;
  dir: 'out' | 'in' | 'both';
}

function links(a: Atlas, v: number): Link[] {
  const by = new Map<number, Link>();
  for (let e = a.xOff[v]; e < a.xOff[v + 1]; e++) {
    by.set(a.xDst[e], { v: a.xDst[e], span: a.xSpan[e], votes: a.xVotes[e], dir: 'out' });
  }
  for (let i = a.xInOff[v]; i < a.xInOff[v + 1]; i++) {
    const e = a.xInEdge[i];
    const u = a.xSrc[e];
    const had = by.get(u);
    if (had) by.set(u, { ...had, votes: Math.max(had.votes, a.xVotes[e]), dir: 'both' });
    else by.set(u, { v: u, span: 1, votes: a.xVotes[e], dir: 'in' });
  }
  return [...by.values()].sort((x, y) => y.votes - x.votes || x.v - y.v);
}

function LinkRow({ a, from, link, max }: { a: Atlas; from: number; link: Link; max: number }) {
  const src = useVerseRow(a, from);
  const dst = useVerseRow(a, link.v);
  const sameLang = (a.books[a.verseBook[from]].testament === 'OT') === (a.books[a.verseBook[link.v]].testament === 'OT');
  const shared = src && dst && sameLang ? sharedRoots(a, src, dst) : [];
  return (
    <div class="refrow" onClick={() => S.selectVerse(link.v)}>
      <span class="ref">{rangeLabel(a, link.v, link.span)}</span>
      <span class="vt" title={`${link.votes} community votes on OpenBible.info`}>
        <span class="bar" style={`width:${Math.max(3, (40 * Math.max(0, link.votes)) / max)}px`} />
        {link.votes}
      </span>
      <Snippet a={a} v={link.v} />
      {shared.length > 0 && (
        <span class="why" title="Hebrew or Greek roots both verses use">
          {shared.map((r) => (
            <RootChip key={r} a={a} root={r} />
          ))}
        </span>
      )}
    </div>
  );
}

export function Connections({ a }: { a: Atlas }) {
  const v = S.selected.value;
  const [all, setAll] = useState(false);
  const [near, setNear] = useState<{ v: number; verses: number[] } | null>(null);
  const row = useVerseRow(a, v);
  const list = useMemo(() => (v === null ? [] : links(a, v)), [a, v]);
  const hubRank = useMemo(() => {
    if (v === null) return 0;
    let higher = 0;
    for (let i = 0; i < a.n; i++) if (a.rank[i] > a.rank[v]) higher++;
    return higher + 1;
  }, [a, v]);

  if (v === null) {
    return (
      <div class="panel">
        <h2>Connections</h2>
        <p class="empty">Tap a verse on the map or in the text to see every passage it is linked to, how strongly, and which Hebrew or Greek words they share.</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          {STARTERS.map((s) => (
            <button
              key={s}
              class="btn"
              onClick={async () => {
                const r = await S.engine.value?.parseRef(s);
                if (r) S.selectVerse(r[0]);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const out = a.xOff[v + 1] - a.xOff[v];
  const inc = a.xInOff[v + 1] - a.xInOff[v];
  const max = Math.max(1, list[0]?.votes ?? 1);
  const shown = all ? list : list.slice(0, 40);

  const explore = async () => {
    const r = await S.engine.value?.near(v, 2, 10, 80);
    if (!r) return;
    setNear({ v, verses: r.verses });
    S.marks.value = { verses: Uint32Array.from(r.verses).sort(), label: `2 steps from ${label(a, v)}` };
    S.groupEdges.value = { edges: Uint32Array.from(r.edges), label: `${r.verses.length} verses within 2 steps` };
  };

  return (
    <div class="panel">
      <h2>{label(a, v)}</h2>
      {row ? <p style="font:17px/1.6 var(--font-read)">{row[0]}</p> : <p class="muted">…</p>}
      {row && <OrigLine a={a} v={v} row={row} />}
      <dl class="facts">
        <dt>Points to</dt>
        <dd>{out.toLocaleString()} passages</dd>
        <dt>Pointed to by</dt>
        <dd>{inc.toLocaleString()} passages</dd>
        <dt>Centrality</dt>
        <dd>
          #{hubRank.toLocaleString()} of {a.n.toLocaleString()} verses (PageRank)
        </dd>
      </dl>
      <button class="btn" onClick={explore}>
        Map its neighborhood, 2 steps out
      </button>
      {near?.v === v && <p class="muted" style="margin-top:6px">{near.verses.length} verses lit on the map. Tap the map background or another verse to move on.</p>}
      <h3>
        Linked passages ({list.length.toLocaleString()}), strongest first
      </h3>
      {shown.map((l) => (
        <LinkRow key={l.v} a={a} from={v} link={l} max={max} />
      ))}
      {list.length > shown.length && (
        <button class="btn more" onClick={() => setAll(true)}>
          Show all {list.length}
        </button>
      )}
      <Provenance>Links and vote counts: OpenBible.info cross-references (CC BY 4.0). Shared words: STEPBible tagged Hebrew and Greek. Words are compared only within one language, so Old-to-New Testament links show none.</Provenance>
    </div>
  );
}
