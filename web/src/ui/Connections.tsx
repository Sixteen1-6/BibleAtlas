// Everything a selected verse connects to, and why.

import { useMemo, useState } from 'preact/hooks';
import { type Atlas, label, rangeLabel } from '../data/atlas';
import { atLeast } from '../depth';
import * as S from '../state';
import { GoDeeper } from './Depth';
import { LayeredPassages, LayersCard } from './Layers';
import { NOT_LOADED, OrigLine, Provenance, RootChip, Snippet, sharedRoots, useVerseLoad, useVerseRow } from './common';
import { openStarter } from './Welcome';
import { VerseThemesLine } from './VerseThemes';
import { WhyLinked } from './WhyLinked';

const STARTERS = ['Isaiah 53:5', 'John 3:14', 'Genesis 22:8', 'Psalm 22:1', 'John 3:16', 'Micah 5:2'];

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

/** Plain words for a PageRank position. */
function centralWords(rank: number, n: number): string {
  const pct = Math.max(1, Math.ceil((100 * rank) / n));
  return pct <= 50 ? `Among the top ${pct}% most central verses` : 'Less central than most verses';
}

/** `bridge`: look for a Septuagint word bridge (kept to the first few rows, to keep the list calm). */
function LinkRow({ a, from, link, max, bridge }: { a: Atlas; from: number; link: Link; max: number; bridge: boolean }) {
  const src = useVerseRow(a, from);
  const dst = useVerseRow(a, link.v);
  const study = atLeast('study');
  const sameLang = (a.books[a.verseBook[from]].testament === 'OT') === (a.books[a.verseBook[link.v]].testament === 'OT');
  const shared = study && src && dst && sameLang ? sharedRoots(a, src, dst) : [];
  return (
    <div class="refrow" data-lv={link.v} onClick={() => S.selectVerse(link.v)}>
      <button type="button" class="ref">{rangeLabel(a, link.v, link.span)}</button>
      <span class="vt" title={`${link.votes} community votes on OpenBible.info`}>
        <span class="bar" style={`width:${Math.max(3, (40 * Math.max(0, link.votes)) / max)}px`} />
        {study && link.votes}
      </span>
      <Snippet a={a} v={link.v} />
      {shared.length > 0 && (
        <span class="why" title="Hebrew or Greek roots both verses use">
          {shared.map((r) => (
            <RootChip key={r} a={a} root={r} />
          ))}
        </span>
      )}
      {study && bridge && !sameLang && src && dst && <WhyLinked a={a} from={from} to={link.v} fromRow={src} toRow={dst} />}
    </div>
  );
}

export function Connections({ a }: { a: Atlas }) {
  const v = S.selected.value;
  // Both reset on their own when another verse is selected.
  const [allFor, setAllFor] = useState<number | null>(null);
  const [disputedFor, setDisputedFor] = useState<number | null>(null);
  const all = allFor === v;
  const disputed = disputedFor === v;
  const [near, setNear] = useState<{ v: number; verses: number[] } | null>(null);
  const { row, failed } = useVerseLoad(a, v);
  const every = useMemo(() => (v === null ? [] : links(a, v)), [a, v]);
  // Links that readers voted down (zero or fewer votes) stay hidden until asked for.
  const weak = every.filter((l) => l.votes <= 0).length;
  const list = disputed ? every : every.filter((l) => l.votes > 0);
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
        <p class="empty">{S.TAP} a verse on the map or in the text to see every passage it is linked to, how strongly, and which Hebrew or Greek words they share.</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          {STARTERS.map((s) => (
            <button
              key={s}
              class="btn"
              onClick={() => openStarter(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <LayeredPassages a={a} />
      </div>
    );
  }

  const study = atLeast('study');
  const deep = atLeast('deep');
  const linked = every.length - weak;
  const max = Math.max(1, list[0]?.votes ?? 1);
  // Simple opens on a verse's few strongest links; the rest are one tap away.
  const shown = all ? list : list.slice(0, study ? 40 : 5);
  const hebrew = a.books[a.verseBook[v]].testament === 'OT';

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
      {row ? <p style="font:17px/1.6 var(--font-read)">{row[0]}</p> : <p class="muted">{failed ? NOT_LOADED : '…'}</p>}
      {row && study && <OrigLine a={a} v={v} row={row} />}
      {/* Phones only: the reader's extras line with the themes is on the other pane. */}
      <VerseThemesLine a={a} v={v} class="vt-phone" onOpen={() => (S.tab.value = 'themes')} />
      <LayersCard a={a} v={v} />
      <p class="muted linkfacts">
        Linked to {linked.toLocaleString()} {linked === 1 ? 'passage' : 'passages'}
        {study && (
          <>
            {' · '}
            <span title={`#${hubRank.toLocaleString()} of ${a.n.toLocaleString()} verses by PageRank: verses that well-linked passages point to rank higher`}>{centralWords(hubRank, a.n)}</span>
            {deep && ` (#${hubRank.toLocaleString()} of ${a.n.toLocaleString()} by PageRank)`}
          </>
        )}
      </p>
      {study && (
        <button class="btn" onClick={explore}>
          Map its neighborhood, 2 steps out
        </button>
      )}
      {study && near?.v === v && <p class="muted" style="margin-top:6px">{near.verses.length} verses lit on the map. {S.TAP} Clear on the map, or another verse, to move on.</p>}
      <h3>{study ? `Linked passages (${list.length.toLocaleString()}), strongest first` : 'Strongest links'}</h3>
      {study && <p class="muted votesnote">The number is the net votes OpenBible.info readers gave each link: votes for it, minus votes against.</p>}
      {shown.map((l, i) => (
        <LinkRow key={l.v} a={a} from={v} link={l} max={max} bridge={i < 5} />
      ))}
      {list.length > shown.length && (
        <button class="btn more" onClick={() => setAllFor(v)}>
          Show all {list.length}
        </button>
      )}
      {deep && weak > 0 && !disputed && (all || list.length <= shown.length) && (
        <button class="btn more" onClick={() => setDisputedFor(v)}>
          Show {weak} weak or disputed {weak === 1 ? 'link' : 'links'} (zero or fewer net votes)
        </button>
      )}
      <GoDeeper to="study" toTop>See the {hebrew ? 'Hebrew' : 'Greek'} behind this verse</GoDeeper>
      {study && <GoDeeper to="deep" toTop>Go deep: weak links, the numbers behind them and the sources</GoDeeper>}
      <Provenance work="openbible-xref">Links and vote counts: OpenBible.info cross-references (CC BY 4.0). Shared words: STEPBible tagged Hebrew and Greek. Words are compared within one language; for the strongest Old-to-New Testament links, a word bridge shows where the Septuagint (the Greek Old Testament) uses the New Testament verse’s Greek word for a Hebrew word of the Old.</Provenance>
    </div>
  );
}
