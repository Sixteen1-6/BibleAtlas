// One Hebrew, Aramaic or Greek root: meaning, grammar in this verse,
// manuscript evidence, and every place it occurs.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { WordSky } from './WordSky';
import { type Atlas, label, langName, versesWithRoot } from '../data/atlas';
import { type LexEntry, getLex } from '../data/lex';
import { describeMorph } from '../data/morph';
import { FLAG } from '../data/text';
import { describeVariant, describeVariantNote } from '../data/variants';
import { atLeast } from '../depth';
import * as S from '../state';
import { Distribution, Provenance, useVerseRow } from './common';
import { GoDeeper } from './Depth';

function Definition({ entry }: { entry: LexEntry }) {
  return (
    <div class="def">
      {entry.d.map(([text, style, ref], i) => {
        const body = style & 1 ? <b>{text}</b> : text;
        const el = style & 2 ? <i>{body}</i> : body;
        if (ref >= 0) {
          return (
            <span key={i} class="r" role="link" tabIndex={0} onClick={() => S.selectVerse(ref)} onKeyDown={(e) => e.key === 'Enter' && S.selectVerse(ref)}>
              {el}
            </span>
          );
        }
        return <span key={i}>{el}</span>;
      })}
    </div>
  );
}

function Occurrence({ a, v, root }: { a: Atlas; v: number; root: number }) {
  const row = useVerseRow(a, v);
  const words = row ? row[1].filter((w) => w[3] === root) : [];
  return (
    <div class="refrow" onClick={() => S.selectVerse(v, { openTab: false })}>
      <span class="ref">{label(a, v)}</span>
      <span class="vt">{words.map((w) => w[2]).join(', ')}</span>
      <span class="snip">{row ? (row[0].length > 170 ? row[0].slice(0, 169) + '…' : row[0]) : '…'}</span>
    </div>
  );
}

export function WordStudy({ a }: { a: Atlas }) {
  const st = S.study.value;
  const [entry, setEntry] = useState<{ root: number; e: LexEntry | null } | null>(null);
  const [limit, setLimit] = useState(40);
  const verses = useMemo(() => (st ? versesWithRoot(a, st.root) : new Uint32Array()), [a, st?.root]);
  const row = useVerseRow(a, st?.verse);
  const onMap = S.marks.value?.label === `root:${st?.root}`;

  useEffect(() => {
    if (!st) return;
    let live = true;
    setLimit(40);
    getLex(a, st.root).then((e) => live && setEntry({ root: st.root, e }));
    return () => {
      live = false;
    };
  }, [a, st?.root]);

  if (!st) {
    return (
      <div class="panel">
        <h2>Word study</h2>
        <p class="empty">{S.TAP} any Hebrew or Greek word in the text. You will see what it means, how it is used in that verse, whether manuscripts differ, and every other place it appears.</p>
      </div>
    );
  }

  const L = a.lemmas;
  const r = st.root;
  const lang = L.lang[r];
  const greek = lang === 'G';
  const count = L.count[r];
  const books = new Set(Array.from(verses, (v) => a.verseBook[v])).size;
  const word = row && st.pos !== undefined && row[1][st.pos]?.[3] === r ? row[1][st.pos] : null;
  const variant = word && word[5] & FLAG.variant && word[6] ? describeVariant(word[6].k, greek, word[6].e, !!(word[5] & FLAG.significant)) : null;
  const lex = entry?.root === r ? entry.e : undefined;

  const toggleMap = async () => {
    if (onMap) {
      S.marks.value = null;
      S.groupEdges.value = null;
      return;
    }
    S.marks.value = { verses, label: `root:${r}` };
    const edges = await S.engine.value?.linksWithin(a.n, verses, 1);
    if (edges && S.marks.value?.label === `root:${r}`) {
      S.groupEdges.value = { edges, label: `${L.word[r]} in ${verses.length.toLocaleString()} verses` };
      S.selected.value = null;
    }
  };

  return (
    <div class="panel">
      <div class="lemma">
        <span class={`big ${greek ? 'gr' : 'he'}`} lang={greek ? 'grc' : 'hbo'}>
          {L.word[r]}
        </span>
        <h2>
          {L.translit[r] && <i>{L.translit[r]}</i>} “{L.gloss[r]}”
          {count === 1 && <span class="badge">used only once</span>}
        </h2>
      </div>
      <dl class="facts">
        <dt>Language</dt>
        <dd>
          {langName(L, r)} · Strong’s {L.key[r]}
        </dd>
        <dt>Occurs</dt>
        <dd>
          {count.toLocaleString()} times in {verses.length.toLocaleString()} verses across {books} {books === 1 ? 'book' : 'books'}
        </dd>
        {lex?.m && (
          <>
            <dt>Word type</dt>
            <dd>{lex.m.replace(/^[HAG]:/, '')}</dd>
          </>
        )}
      </dl>

      {word && st.verse !== undefined && (
        <>
          <h3>In {label(a, st.verse)}</h3>
          <dl class="facts">
            <dt>Form</dt>
            <dd>
              <span class={greek ? 'gr' : 'he'} style="font-size:20px;display:inline-block">
                {word[0]}
              </span>
            </dd>
            <dt>Sounds like</dt>
            <dd>{word[1]}</dd>
            <dt>Here means</dt>
            <dd>{word[2]}</dd>
            <dt>Grammar</dt>
            <dd>{describeMorph(word[4], word[5] & FLAG.aramaic ? 'A' : greek ? 'G' : 'H')}</dd>
          </dl>
          {variant && !atLeast('deep') && (
            <p class="muted">
              {variant.significant ? 'Manuscripts differ here.' : 'Manuscripts differ slightly here.'} <GoDeeper to="deep">See how</GoDeeper>
            </p>
          )}
          {variant && atLeast('deep') && (
            <div class="variantbox">
              <b>{variant.significant ? 'Manuscripts differ here' : 'Minor manuscript difference'}</b>
              <p>{variant.summary}</p>
              {variant.witnesses.length > 0 && <p class="muted">Found in: {variant.witnesses.join('; ')}.</p>}
              {word[6]?.v && <p class="muted">{describeVariantNote(word[6].v, greek)}</p>}
            </div>
          )}
        </>
      )}

      <h3>Where it appears</h3>
      <Distribution a={a} verses={verses} />
      <button class="btn more" aria-pressed={onMap} onClick={toggleMap}>
        {onMap ? 'Hide on map' : 'Light up every use on the map'}
      </button>

      <h3>Definition</h3>
      {lex === undefined ? <p class="muted">Loading…</p> : lex ? <Definition entry={lex} /> : <p class="muted">No lexicon entry for this root.</p>}
      <WordSky a={a} root={r} verse={st.verse} pos={st.pos} />

      <h3>Every occurrence ({verses.length.toLocaleString()} verses)</h3>
      {Array.from(verses.subarray(0, limit), (v) => (
        <Occurrence key={v} a={a} v={v} root={r} />
      ))}
      {verses.length > limit && (
        <button class="btn more" onClick={() => setLimit(limit + 100)}>
          Show more
        </button>
      )}
      <Provenance>
        Definition: STEPBible {lex?.s === 'tbesg' ? 'TBESG, abridged from Abbott-Smith' : 'TBESH, abridged from Brown-Driver-Briggs'} (CC BY 4.0). Words and grammar: STEPBible {greek ? 'TAGNT' : 'TAHOT'}. Counts are computed from the base text ({greek ? 'Nestle-Aland family' : 'Leningrad Codex'}).
      </Provenance>
    </div>
  );
}
