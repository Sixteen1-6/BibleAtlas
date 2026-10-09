// One Hebrew, Aramaic or Greek root: meaning, grammar in this verse,
// manuscript evidence, and every place it occurs.

import type { ComponentProps, ComponentType } from 'preact';
import { effect } from '@preact/signals';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { WordSky } from './WordSky';
import { type Atlas, label, langName, versesWithRoot } from '../data/atlas';
import { type Forms, type Relation, formAt, getForms, relation, versesWithForm, versesWithRoots } from '../data/forms';
import { type LexEntry, getLex } from '../data/lex';
import { describeMorph } from '../data/morph';
import { FLAG } from '../data/text';
import { describeVariant, describeVariantNote } from '../data/variants';
import { atLeast } from '../depth';
import * as S from '../state';
import { Distribution, Provenance, RootChip, useVerseRow } from './common';
import { GoDeeper } from './Depth';

type WordWorldType = ComponentType<ComponentProps<typeof import('./WordWorld').WordWorld>>;
let wordWorld: Promise<WordWorldType> | null = null;

/** "Outside the Bible" and its data code, fetched with the first word study. */
function loadWordWorld(): Promise<WordWorldType> {
  if (!wordWorld) {
    wordWorld = import('./WordWorld').then((m) => m.WordWorld);
    wordWorld.catch(() => (wordWorld = null));
  }
  return wordWorld;
}

function WordWorld(props: ComponentProps<WordWorldType>) {
  const [impl, setImpl] = useState<{ C: WordWorldType } | null>(null);
  useEffect(() => {
    let live = true;
    loadWordWorld().then(
      (C) => live && setImpl({ C }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  return impl ? <impl.C {...props} /> : null;
}

// The studied word's family, underlined in the reader wherever a word study
// is open (a shared link opens one without this panel).
effect(() => {
  const st = S.study.value;
  const a = S.atlas.value;
  if (!st || !a) {
    S.studyKin.value = null;
    return;
  }
  const root = st.root;
  // The last word's family stays underlined until this one's arrives otherwise.
  S.studyKin.value = null;
  getForms(a, root).then(
    (f) => {
      if (S.study.peek()?.root !== root) return;
      S.studyKin.value = f?.r?.length ? new Set(f.r.map((x) => x[0])) : null;
    },
    () => {},
  );
});

/** Light a set of verses on the map with the links among them, or put them
 *  out if they are already lit. */
async function lightUp(a: Atlas, verses: Uint32Array, key: string, text: string): Promise<void> {
  if (S.marks.value?.label === key) {
    S.marks.value = null;
    S.groupEdges.value = null;
    return;
  }
  S.marks.value = { verses, label: key };
  const edges = await S.engine.value?.linksWithin(a.n, verses, 1);
  if (edges && S.marks.value?.label === key) {
    S.groupEdges.value = { edges, label: text };
    S.selected.value = null;
  }
}

/** Forms shown before "Show all". */
const FIRST_FORMS = 8;

/** One row of "Every form": a spelling and its grammar, which may gather
 *  several of the data's forms that read the same. */
interface FormRow {
  spelling: string;
  grammar: string;
  count: number;
  forms: Set<number>;
}

/** The forms as rows, merging the ones a reader can't tell apart, most used first. */
function formRows(fm: Forms, lang: string): FormRow[] {
  const greek = lang === 'G';
  const rows = new Map<string, FormRow>();
  fm.f.forEach(([spelling, code, count], i) => {
    let grammar = describeMorph(code, greek ? 'G' : 'H');
    // A Hebrew word used in an Aramaic passage, or the other way round.
    if (!greek && code[0] === 'A' && lang !== 'A') grammar += ' (Aramaic)';
    if (!greek && code[0] === 'H' && lang === 'A') grammar += ' (Hebrew)';
    const key = `${spelling}\u0000${grammar}`;
    const row = rows.get(key) ?? { spelling, grammar, count: 0, forms: new Set<number>() };
    row.count += count;
    row.forms.add(i);
    rows.set(key, row);
  });
  return [...rows.values()].sort((x, y) => y.count - x.count);
}

/** What tells a row from the other rows spelled the same way ("vocative"), for
 *  the map's caption; empty when its spelling is its own. */
function telling(row: FormRow, rows: FormRow[]): string {
  const same = rows.filter((x) => x !== row && x.spelling === row.spelling);
  if (!same.length) return '';
  const parts = row.grammar.split(/, | \+ /);
  const differ = parts.filter((p) => same.some((x) => !x.grammar.split(/, | \+ /).includes(p)));
  return (differ.length ? differ : parts).join(', ');
}

/** Every form the word takes in the Bible, each one tap from lighting its verses. */
function EveryForm({ a, r, fm, here }: { a: Atlas; r: number; fm: Forms; here: number }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setOpen(false);
    setAll(false);
  }, [r]);
  const L = a.lemmas;
  const greek = L.lang[r] === 'G';
  const rows = useMemo(() => formRows(fm, L.lang[r]), [fm, r]);
  // After "Show all", the first row it added takes the focus.
  useEffect(() => {
    if (all) list.current?.querySelectorAll<HTMLButtonElement>('.formrow')[FIRST_FORMS]?.focus();
  }, [all]);
  const n = rows.length;
  if (n < 2) return null;
  if (!open) {
    const spellings = new Set(rows.map((x) => x.spelling));
    return (
      <p class="muted">
        {spellings.size === 1 ? (
          <>
            It is always spelled{' '}
            <span class={greek ? 'gr' : 'he'} lang={greek ? 'grc' : 'hbo'}>
              {rows[0].spelling}
            </span>
            , but it is used {n} ways in a sentence, all counted above.
          </>
        ) : (
          <>Its spelling changes with how it is used in a sentence, so it appears in {n} forms, all counted above.</>
        )}{' '}
        <button class="godeeper" onClick={() => setOpen(true)}>
          See every form ›
        </button>
      </p>
    );
  }
  // The tapped word's row stays in view even when it is not among the first.
  const at = rows.findIndex((x) => x.forms.has(here));
  const shown = rows.map((x, i) => [x, i] as const).filter(([, i]) => all || i < FIRST_FORMS || i === at);
  return (
    <>
      <h3>Every form ({n})</h3>
      <p class="muted">{S.TAP} a form to light the verses that use it.</p>
      <div class="forms" ref={list}>
        {shown.map(([row, i]) => {
          const key = `form:${r}:${i}`;
          const lit = S.marks.value?.label === key;
          const tell = telling(row, rows);
          return (
            <button
              key={i}
              class={`formrow${i === at ? ' here' : ''}`}
              aria-pressed={lit}
              onClick={() => lightUp(a, versesWithForm(a, r, fm, row.forms), key, `${row.spelling}${tell ? `, ${tell}` : ''} (${L.word[r]})`)}
            >
              <span class={greek ? 'o gr' : 'o he'} lang={greek ? 'grc' : 'hbo'}>
                {row.spelling}
              </span>
              <span class="g">
                {row.grammar}
                {i === at && <b> · this verse</b>}
              </span>
              <span class="n">{row.count.toLocaleString()}</span>
            </button>
          );
        })}
      </div>
      {n > shown.length && (
        <button class="btn more" onClick={() => setAll(true)}>
          Show all {n} forms
        </button>
      )}
    </>
  );
}

/** Rows of the family shown before "Show all". */
const FIRST_KIN = 6;

/** One row of the family: a dictionary word (all its senses) and how it is related. */
interface KinRow {
  rel: Relation;
  head: number;
  roots: number[];
  count: number;
}

function kinRows(a: Atlas, rel: [number, Relation, number][]): KinRow[] {
  const rows = new Map<string, KinRow>();
  for (const [j, how, head] of rel) {
    // Senses of the studied word itself are one row, whatever heads them.
    const key = how === 'n' ? 'n' : `${how}:${head}`;
    const row = rows.get(key) ?? { rel: how, head, roots: [], count: 0 };
    row.roots.push(j);
    row.count += a.lemmas.count[j];
    rows.set(key, row);
  }
  return [...rows.values()];
}

/** The senses in an "other senses" row, one per gloss, most used first. */
function senses(a: Atlas, roots: number[]): number[] {
  const L = a.lemmas;
  const byGloss = new Map<string, number>();
  for (const j of [...roots].sort((x, y) => L.count[y] - L.count[x])) {
    const g = L.gloss[j].replace(/`/g, '').toLowerCase();
    if (!byGloss.has(g)) byGloss.set(g, j);
  }
  return [...byGloss.values()];
}

/** Words from the same root, each one tap from its own study. */
function Family({ a, r, fm }: { a: Atlas; r: number; fm: Forms }) {
  const [all, setAll] = useState(false);
  useEffect(() => setAll(false), [r]);
  const rel = fm.r ?? [];
  const rows = useMemo(() => kinRows(a, rel), [a, fm]);
  const members = useMemo(() => [r, ...rel.map((x) => x[0])], [r, fm]);
  const verses = useMemo(() => versesWithRoots(a, members), [a, members]);
  if (!rel.length) return null;
  const L = a.lemmas;
  const key = `family:${r}`;
  const lit = S.marks.value?.label === key;
  const words = rows.filter((x) => x.rel !== 'n').length;
  const shown = all ? rows : rows.slice(0, FIRST_KIN);
  return (
    <>
      <h3>Word family</h3>
      <p class="muted">Words from the same root as {L.word[r]}. In the text they are underlined. {S.TAP} one to study it.</p>
      <div class="kin">
        {shown.map((row) => (
          <div class="kinrow" key={`${row.rel}:${row.head}`}>
            {row.rel === 'n' ? senses(a, row.roots).map((j) => <RootChip key={j} a={a} root={j} />) : <RootChip a={a} root={row.head} />}
            <span class="muted">
              {row.rel === 'n' ? (row.roots.length === 1 ? 'same word, another sense' : 'same word, other senses') : relation(row.rel, L.lang[row.head])} · {row.count.toLocaleString()}×
            </span>
          </div>
        ))}
      </div>
      {rows.length > shown.length && (
        <button class="btn more" onClick={() => setAll(true)}>
          Show all {words} related {words === 1 ? 'word' : 'words'}
        </button>
      )}
      <button class="btn more" aria-pressed={lit} onClick={() => lightUp(a, verses, key, `${L.word[r]} and its family in ${verses.length.toLocaleString()} verses`)}>
        {lit ? 'Hide the family on map' : `Light up the whole family (${verses.length.toLocaleString()} verses)`}
      </button>
    </>
  );
}

function Definition({ entry }: { entry: LexEntry }) {
  return (
    <div class="def">
      {entry.d.map(([text, style, ref], i) => {
        const body = style & 1 ? <b>{text}</b> : text;
        const el = style & 2 ? <i>{body}</i> : body;
        if (ref >= 0) {
          return (
            <span key={i} class="r" role="link" tabIndex={0} data-lv={ref} onClick={() => S.selectVerse(ref)} onKeyDown={(e) => e.key === 'Enter' && S.selectVerse(ref)}>
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
    <div class="refrow" data-lv={v} onClick={() => S.selectVerse(v, { openTab: false })}>
      <button type="button" class="ref">{label(a, v)}</button>
      <span class="vt">{words.map((w) => w[2]).join(', ')}</span>
      <span class="snip">{row ? (row[0].length > 170 ? row[0].slice(0, 169) + '…' : row[0]) : '…'}</span>
    </div>
  );
}

export function WordStudy({ a }: { a: Atlas }) {
  const st = S.study.value;
  const [entry, setEntry] = useState<{ root: number; e: LexEntry | null } | null>(null);
  const [forms, setForms] = useState<{ root: number; f: Forms | null } | null>(null);
  const [limit, setLimit] = useState(40);
  const verses = useMemo(() => (st ? versesWithRoot(a, st.root) : new Uint32Array()), [a, st?.root]);
  const row = useVerseRow(a, st?.verse);
  const onMap = S.marks.value?.label === `root:${st?.root}`;

  useEffect(() => {
    if (!st) return;
    let live = true;
    setLimit(40);
    getLex(a, st.root).then((e) => live && setEntry({ root: st.root, e }));
    // A new word starts at its top, wherever the last one was scrolled to.
    document.querySelector('.study')?.scrollTo({ top: 0 });
    getForms(a, st.root).then(
      (f) => live && setForms({ root: st.root, f }),
      () => {},
    );
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
  const fm = forms?.root === r ? forms.f : null;
  // Which form the tapped word is, read from the root's postings.
  const here = word && fm && st.verse !== undefined && st.pos !== undefined ? formAt(a, r, fm, st.verse, st.pos) : -1;

  const toggleMap = () => lightUp(a, verses, `root:${r}`, `${L.word[r]} in ${verses.length.toLocaleString()} verses`);

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
      <WordWorld a={a} root={r} verse={st.verse} />

      <h3>Where it appears</h3>
      <Distribution a={a} verses={verses} />
      <button class="btn more" aria-pressed={onMap} onClick={toggleMap}>
        {onMap ? 'Hide on map' : fm && fm.f.length > 1 ? 'Light up every use, in every form' : 'Light up every use on the map'}
      </button>
      {fm && <EveryForm a={a} r={r} fm={fm} here={here} />}
      {fm && <Family a={a} r={r} fm={fm} />}

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
        {fm?.r && "Word family: from the derivations in Strong's dictionaries (1890, public domain; JSON by Open Scriptures, CC BY-SA) and the senses, spellings and Aramaic twins in STEPBible's TBESH and TBESG (CC BY 4.0). "}
        Definition: STEPBible {lex?.s === 'tbesg' ? 'TBESG, abridged from Abbott-Smith' : 'TBESH, abridged from Brown-Driver-Briggs'} (CC BY 4.0). Words and grammar: STEPBible {greek ? 'TAGNT' : 'TAHOT'}. Counts are computed from the base text ({greek ? 'Nestle-Aland family' : 'Leningrad Codex'}).
      </Provenance>
    </div>
  );
}
