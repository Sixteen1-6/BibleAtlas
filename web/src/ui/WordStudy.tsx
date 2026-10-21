// One Hebrew, Aramaic or Greek root: meaning, grammar in this verse,
// manuscript evidence, and every place it occurs.

import type { ComponentChildren, ComponentProps, ComponentType } from 'preact';
import { Fragment } from 'preact';
import { effect } from '@preact/signals';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { WordSky } from './WordSky';
import { type Atlas, label, versesWithRoot } from '../data/atlas';
import { type Forms, type Relation, formAt, getForms, relation, versesWithForm, versesWithRoots } from '../data/forms';
import { type LexEntry, type Segment, getLex, langLabel, wordType } from '../data/lex';
import { loadJson } from './extras/data';
import { openExtra } from './extras/open';
import { NOT_NUMBERS, describeMorph } from '../data/morph';
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
let kinOf = -1;
effect(() => {
  const st = S.study.value;
  const a = S.atlas.value;
  const root = st && a ? st.root : -1;
  // Another verse of the same word keeps its underlines.
  if (root === kinOf) return;
  kinOf = root;
  // The last word's family stays underlined until this one's arrives otherwise.
  S.studyKin.value = null;
  if (!a || root < 0) return;
  getForms(a, root).then(
    (f) => {
      if (kinOf === root) S.studyKin.value = f?.r?.length ? new Set(f.r.map((x) => x[0])) : null;
    },
    () => kinOf === root && (kinOf = -1),
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
  // The Wheel does not draw marks.
  if (S.mapMode.value === 'wheel') S.mapMode.value = 'arcs';
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
  /** Other spellings of the same form (οὐκ, οὐχ beside οὐ). */
  also: string[];
}

/** The forms as rows, merging the ones a reader can't tell apart, most used first.
 *  `key` is the word's Strong's key. */
function formRows(fm: Forms, lang: string, key: string): FormRow[] {
  const greek = lang === 'G';
  const rows = new Map<string, FormRow>();
  fm.f.forEach(([spelling, code, count, also], i) => {
    let grammar = describeMorph(code, greek ? 'G' : 'H', key);
    // A Hebrew word used in an Aramaic passage, or the other way round.
    if (!greek && code[0] === 'A' && lang !== 'A') grammar += ' (Aramaic)';
    if (!greek && code[0] === 'H' && lang === 'A') grammar += ' (Hebrew)';
    const k = `${spelling}\u0000${grammar}`;
    const row = rows.get(k) ?? { spelling, grammar, count: 0, forms: new Set<number>(), also: [] };
    row.count += count;
    row.forms.add(i);
    for (const x of also ?? []) if (x !== spelling && !row.also.includes(x)) row.also.push(x);
    rows.set(k, row);
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

/** A form named for the map's caption: its spelling and what tells it from
 *  the others, or the headword it is a form of ("ἀγάπης (ἀγάπη)"). */
function formCaption(row: FormRow, rows: FormRow[], headword: string): string {
  const tell = telling(row, rows);
  if (tell) return `${row.spelling}, ${tell}`;
  if (row.spelling !== headword) return `${row.spelling} (${headword})`;
  // Spelled like the headword: its grammar, without the word class, tells it.
  const parts = row.grammar.split(', ');
  return `${row.spelling}, ${(parts.length > 1 ? parts.slice(1) : parts).join(', ')}`;
}

/** The pronoun a Hebrew word's ending adds ("his", "him"), from its grammar
 *  code: empty when it has none. `root` and `gloss` are the tapped word's. */
function ending(code: string, root: string, gloss: string): string {
  const segs = code.slice(1).split('/');
  const i = segs.findIndex((x) => x.startsWith('Sp'));
  if (i < 1) return '';
  const s = segs[i];
  const k = s[2] + s[4];
  const f = s[3] === 'f';
  const host = segs[i - 1];
  const own: Record<string, string> = { '1s': 'my', '2s': 'your', '3s': f ? 'her/its' : 'his/its', '1p': 'our', '2p': 'your', '3p': 'their' };
  const obj: Record<string, string> = { '1s': 'me', '2s': 'you', '3s': f ? 'her/it' : 'him/it', '1p': 'us', '2p': 'you', '3p': 'them' };
  // A finite verb or a preposition takes the pronoun as its object; a noun,
  // adjective or participle, as its owner ("my shepherd").
  if (host[0] === 'R' || (host[0] === 'V' && 'pqiwuhjv'.includes(host[2]))) return obj[k] ?? '';
  const free = host[0] === 'V' || host[0] === 'T' || host[0] === 'D' || NOT_NUMBERS.has(root) || root === 'H0369';
  if (!free) return own[k] ?? '';
  // An infinitive ("when he went out", "to kill him") or a word like אֵין or
  // אַחַר ("he is not", "after him") can take it either way: the verse's own
  // English says which.
  const all: Record<string, string[]> = {
    '1s': ['my', 'me', 'i'], '2s': ['your', 'you'], '3s': f ? ['her', 'she', 'its', 'it'] : ['his', 'him', 'he', 'its', 'it'],
    '1p': ['our', 'us', 'we'], '2p': ['your', 'you'], '3p': ['their', 'them', 'they'],
  };
  const words = gloss.toLowerCase().split(/[^a-z]+/);
  const said = words.find((w) => all[k]?.includes(w));
  if (said) return said === 'i' ? 'I' : said;
  return (all[k] ?? []).filter((w) => w !== 'i' && w !== 'its' && w !== 'it').join('/');
}

/** Every form the word takes in the Bible, each one tap from lighting its verses.
 *  `hereCode` and `hereGloss` are the tapped word's grammar code and English. */
function EveryForm({ a, r, fm, here, hereCode, hereGloss, total }: { a: Atlas; r: number; fm: Forms; here: number; hereCode: string; hereGloss: string; total: number }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setOpen(false);
    setAll(false);
  }, [r]);
  const L = a.lemmas;
  const greek = L.lang[r] === 'G';
  const rows = useMemo(() => formRows(fm, L.lang[r], L.key[r]), [fm, r]);
  // The tapped word's row stays in view even when it is not among the first.
  const at = rows.findIndex((x) => x.forms.has(here));
  // After "Show all", the first row it added takes the focus.
  useEffect(() => {
    if (!all) return;
    const added = [...(list.current?.querySelectorAll<HTMLButtonElement>('.formrow') ?? [])].find((b) => {
      const i = Number(b.dataset.i);
      return i >= FIRST_FORMS && i !== at;
    });
    added?.focus();
  }, [all]);
  // "See every form" goes away when pressed, so the list's heading takes the focus.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open]);
  const n = rows.length;
  if (n < 2) {
    // One form, written more than one way: οὐ and οὐκ. The headword may carry
    // accents or two spellings (אֲבִיגַ֫יִל, אֲבִיגַ֫ל) that the forms do not.
    const bare = (x: string) => x.replace(/[\u0591-\u05AF]/g, '').replace(/\u05C7/g, '\u05B8').trim();
    const head = new Set(L.word[r].split(',').map(bare));
    const other = rows[0] ? [rows[0].spelling, ...rows[0].also].filter((x) => !head.has(bare(x))) : [];
    if (!other.length || !rows[0].also.length) return null;
    return (
      <p class="muted">
        It is also spelled{' '}
        <span class={greek ? 'gr' : 'he'} lang={greek ? 'grc' : 'hbo'}>
          {other.join(', ')}
        </span>
        , counted above.
      </p>
    );
  }
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
  const shown = rows.map((x, i) => [x, i] as const).filter(([, i]) => all || i < FIRST_FORMS || i === at);
  // A row gathers a form with and without a pronoun ending; say which the tapped word has.
  const hereEnding = !greek && at >= 0 && !rows[at].grammar.includes('pronoun suffix') ? ending(hereCode, L.key[r], hereGloss) : '';
  return (
    <>
      <h3 ref={heading} tabIndex={-1}>
        Every form ({n})
      </h3>
      <p class="muted">{S.TAP} a form to light the verses that use it.</p>
      <div class="forms" ref={list}>
        {shown.map(([row, i]) => {
          const key = `form:${r}:${i}`;
          const lit = S.marks.value?.label === key;
          return (
            <button
              key={i}
              data-i={i}
              class={`formrow${i === at ? ' here' : ''}`}
              aria-pressed={lit}
              onClick={() => {
                const vs = versesWithForm(a, r, fm, row.forms);
                lightUp(a, vs, key, `${formCaption(row, rows, L.word[r])}: ${vs.length.toLocaleString()} of ${total.toLocaleString()} verses`);
              }}
            >
              <span class={greek ? 'o gr' : 'o he'} lang={greek ? 'grc' : 'hbo'}>
                {row.spelling}
              </span>
              <span class="g">
                {row.grammar}
                {row.also.length > 0 && (
                  <>
                    {' · also '}
                    <span class={greek ? 'gr' : 'he'} lang={greek ? 'grc' : 'hbo'}>
                      {row.also.join(', ')}
                    </span>
                  </>
                )}
                {i === at && <b> · this verse{hereEnding && `, with the ending “${hereEnding}”`}</b>}
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

/** A root's forms with what crates/atlas-cli/src/family.rs says of who made
 *  its links: `h` the relatives (by the root heading their word) linked only
 *  by this app's corrections of slips in Strong's numbers, `t` the Aramaic
 *  twins STEPBible pairs that Strong's does not tie, and `x` 1 where this
 *  root's own derivation was corrected, 2 where it is left out. */
type FormsBy = Forms & { h?: number[]; t?: number[]; x?: 1 | 2 };

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

/** The senses in an "other senses" row, one per word and gloss, most used first. */
function senses(a: Atlas, roots: number[]): number[] {
  const L = a.lemmas;
  const seen = new Map<string, number>();
  for (const j of [...roots].sort((x, y) => L.count[y] - L.count[x])) {
    const k = `${L.word[j]}|${L.gloss[j].replace(/`/g, '').toLowerCase()}`;
    if (!seen.has(k)) seen.set(k, j);
  }
  return [...seen.values()];
}

/** Sense chips shown before "+N more". */
const FIRST_SENSES = 3;

/** The studied word's other senses: the label first, then a few chips. */
function OtherSenses({ a, r, row }: { a: Atlas; r: number; row: KinRow }) {
  const [all, setAll] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // After "+N more", the first chip it added takes the focus.
  useEffect(() => {
    if (all) box.current?.querySelectorAll<HTMLElement>('.chip')[FIRST_SENSES]?.focus();
  }, [all]);
  const L = a.lemmas;
  const list = senses(a, row.roots);
  const shown = all ? list : list.slice(0, FIRST_SENSES);
  const same = (j: number) => L.word[j] === L.word[r] && L.gloss[j].replace(/`/g, '').toLowerCase() === L.gloss[r].replace(/`/g, '').toLowerCase();
  return (
    <div class="kinrow" ref={box}>
      <span class="muted">
        {list.length === 1 ? 'Same word, another sense' : 'Same word, other senses'} · {row.count.toLocaleString()}×
      </span>
      {shown.map((j) => (
        <Fragment key={j}>
          <RootChip a={a} root={j} />
          {/* A sense glossed just like this one is told apart by its count. */}
          {same(j) && <span class="muted">{L.count[j].toLocaleString()}×</span>}
        </Fragment>
      ))}
      {list.length > shown.length && (
        <button class="chip more" onClick={() => setAll(true)}>
          +{list.length - shown.length} more
        </button>
      )}
    </div>
  );
}

/** Words from the same root, each one tap from its own study. */
function Family({ a, r, fm }: { a: Atlas; r: number; fm: Forms }) {
  const [all, setAll] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => setAll(false), [r]);
  // After "Show all", the first word it added takes the focus.
  useEffect(() => {
    if (all) list.current?.querySelectorAll<HTMLElement>('.kinrow.word .chip')[FIRST_KIN]?.focus();
  }, [all]);
  const rel = fm.r ?? [];
  const rows = useMemo(() => kinRows(a, rel), [a, fm]);
  const members = useMemo(() => [r, ...rel.map((x) => x[0])], [r, fm]);
  const verses = useMemo(() => versesWithRoots(a, members), [a, members]);
  if (!rel.length) return null;
  const L = a.lemmas;
  const key = `family:${r}`;
  const lit = S.marks.value?.label === key;
  const words = rows.filter((x) => x.rel !== 'n');
  const sense = rows.find((x) => x.rel === 'n');
  const shown = all ? words : words.slice(0, FIRST_KIN);
  const by = fm as FormsBy;
  return (
    <>
      <h3>Words related to {L.word[r]}</h3>
      <p class="muted">Other forms of it and words from the same root. In the text they are underlined. {S.TAP} one to study it.</p>
      <div class="kin" ref={list}>
        {shown.map((row) => (
          <div class="kinrow word" key={`${row.rel}:${row.head}`}>
            <RootChip a={a} root={row.head} />
            <span class="muted">
              {relation(row.rel, L.lang[row.head])} · {row.count.toLocaleString()}×{row.roots.length > 1 ? ' in all senses' : ''}
              {by.h?.includes(row.head) && ' · linked by this app, where Strong’s number is a slip'}
              {by.t?.includes(row.head) && ' · paired by STEPBible; Strong’s does not tie them'}
            </span>
          </div>
        ))}
        {sense && <OtherSenses key={r} a={a} r={r} row={sense} />}
      </div>
      {words.length > shown.length && (
        <button class="btn more" onClick={() => setAll(true)}>
          Show all {words.length} related words
        </button>
      )}
      <button class="btn more" aria-pressed={lit} onClick={() => lightUp(a, verses, key, `${L.word[r]} and related words: ${verses.length.toLocaleString()} verses`)}>
        {lit ? 'Hide them on the map' : `Light up ${L.word[r]} and every related word (${verses.length.toLocaleString()} verses)`}
      </button>
    </>
  );
}

function Segments({ d }: { d: Segment[] }) {
  return (
    <div class="def">
      {d.map(([text, style, ref], i) => {
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

/** A definition's segments split where STEPBible marks, with "§", that
 *  Brown-Driver-Briggs' entry follows its own note: [note, BDB's entry]. The
 *  mark itself goes, since a label says the same. */
function splitAtMark(d: Segment[]): [Segment[], Segment[]] {
  const at = d.findIndex((s) => s[0].includes('§'));
  if (at < 0) return [d, []];
  const [text, style, ref] = d[at];
  const i = text.indexOf('§');
  const head = text.slice(0, i).replace(/\s+$/, '');
  const tail = text.slice(i + 1).replace(/^\s+/, '');
  const before = [...d.slice(0, at), ...(head ? [[head, style, ref] as Segment] : [])];
  const after = [...(tail ? [[tail, style, ref] as Segment] : []), ...d.slice(at + 1)];
  const blank = (x: Segment[]) => x.every((s) => !s[0].trim());
  return blank(before) ? [after, []] : [before, blank(after) ? [] : after];
}

/** "§" left in an entry whose whole text is BDB's (only STEPBible's link to
 *  another entry before it) says nothing a reader needs. */
function withoutMark(d: Segment[]): Segment[] {
  return d.map(([t, s, r]) => [t.replace(/\s*§\s*/g, '\n'), s, r] as Segment).filter((x, i) => i > 0 || x[0].trim());
}

/** Text with Strong's numbers in it ("from G25 (ἀγαπάω)"), each number a link
 *  to that word's own study. */
function StrongsText({ a, text }: { a: Atlas; text: string }) {
  const roots = useMemo(() => strongsRoots(a), [a]);
  const parts: ComponentChildren[] = [];
  let last = 0;
  for (const m of text.matchAll(/\b([HG])0*(\d{1,5})\b(\s\([^()]*\))?/g)) {
    const j = roots.get(`${m[1]}${m[2]}`);
    if (j === undefined) continue;
    parts.push(text.slice(last, m.index));
    const go = () => S.openRoot(j);
    parts.push(
      <span key={m.index} class="r" role="link" tabIndex={0} onClick={go} onKeyDown={(e) => e.key === 'Enter' && go()}>
        {m[0]}
      </span>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(text.slice(last));
  return <div class="def">{parts}</div>;
}

const numberRoots = new WeakMap<Atlas, Map<string, number>>();

/** Each Strong's number ("H1", "G26") to its most used root. */
function strongsRoots(a: Atlas): Map<string, number> {
  let m = numberRoots.get(a);
  if (m) return m;
  m = new Map();
  const L = a.lemmas;
  for (let i = 0; i < L.key.length; i++) {
    const k = /^([HG])0*(\d+)/.exec(L.key[i]);
    if (!k) continue;
    const n = `${k[1]}${k[2]}`;
    const was = m.get(n);
    if (was === undefined || L.count[i] > L.count[was]) m.set(n, i);
  }
  numberRoots.set(a, m);
  return m;
}

/** One credit, by level (the shape AF-K's credit line takes): Simple and Study
 *  show a short line that one tap opens, in place, into the full credit Deep
 *  shows, with its links; the reader's level does not change. */
interface Cite {
  simple: string;
  study: string;
  deep: ComponentChildren;
  links: [string, string][];
}

const CREDIT_STYLE = 'margin:6px 0 14px;font-size:12.5px;line-height:1.5';
const CREDIT_BUTTON = 'display:inline;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px';

function CreditLine({ c }: { c: Cite }) {
  const [open, setOpen] = useState(false);
  const full = (
    <>
      {c.deep}
      {c.links.map(([href, text]) => (
        <Fragment key={href}>
          {' '}
          <a href={href} target="_blank" rel="noopener noreferrer">
            {text}
          </a>
          .
        </Fragment>
      ))}
    </>
  );
  if (atLeast('deep')) {
    return (
      <p class="muted" style={CREDIT_STYLE}>
        {full}
      </p>
    );
  }
  return (
    <p class="muted" style={CREDIT_STYLE}>
      <button type="button" style={CREDIT_BUTTON} aria-expanded={open} onClick={() => setOpen(!open)}>
        {atLeast('study') ? c.study : c.simple}
      </button>
      {open && <span style="display:block;margin-top:4px">{full}</span>}
    </p>
  );
}

/** "2026-10-05" as "5 Oct 2026". */
function day(iso: unknown): string | null {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  return month ? `${d} ${month} ${y}` : null;
}

/** Where the app read a dataset: its commit, and, once sources.json records
 *  them (`version`, the upstream commit's date, and `copied`, the day the pin
 *  was set), both dates. Nothing is said of a date no record gives. */
function readFrom(a: Atlas, id: string): { commit: string; dates: string; file: (path: string) => string } {
  const s = a.meta.sources.find((x) => x.id === id) as (Atlas['meta']['sources'][number] & { version?: unknown; copied?: unknown }) | undefined;
  const commit = s?.commit ?? '';
  const v = day(s?.version);
  const c = day(s?.copied);
  const dates = [v && `version of ${v}`, c && `copied ${c}`].filter(Boolean).join(', ');
  const repo = (s?.repo ?? '').replace(/\/$/, '');
  return { commit: commit.slice(0, 8), dates: dates ? `, ${dates}` : '', file: (path) => `${repo}/blob/${commit}/${path.split('/').map(encodeURIComponent).join('/')}` };
}

const STEP_GREEK = 'Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt';
const STEP_HEBREW = 'Lexicons/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt';

/** The works STEPBible's Hebrew lines name in brackets, for the lines that carry them. */
const MARKED: [string, string][] = [
  ['(CLBL)', 'J. P. Green, Concise Lexicon to the Biblical Languages'],
  ['(TWOT)', 'R. Laird Harris, Gleason L. Archer and Bruce K. Waltke, Theological Wordbook of the Old Testament (1980)'],
  ['(BDB)', 'Brown-Driver-Briggs (1906)'],
];

/** Who wrote a lexicon entry, from its origin (crates/atlas-cli/src/parse.rs). */
function lexCite(a: Atlas, e: LexEntry): Cite {
  const step = readFrom(a, e.s);
  const file = step.file(e.s === 'tbesg' ? STEP_GREEK : STEP_HEBREW);
  const at = `read at STEPBible's commit ${step.commit}${step.dates}`;
  const text = e.d.map((s) => s[0]).join('');
  const marked = MARKED.filter(([m]) => text.includes(m));
  const key = marked.length ? ` Lines marked ${marked.map(([m, w]) => `${m} are from ${w}`).join('; ')}.` : '';
  const bdbBook: [string, string] = ['https://archive.org/details/hebrewenglishlex00browuoft', 'The book (Internet Archive)'];
  const stepFile: [string, string] = [file, 'STEPBible’s file'];
  switch (e.o) {
    case 'as':
      return {
        simple: 'From G. Abbott-Smith (1922).',
        study: 'G. Abbott-Smith, A Manual Greek Lexicon of the New Testament (1922), through STEPBible.',
        deep: `G. Abbott-Smith, professor of New Testament literature at the Montreal Diocesan Theological College, A Manual Greek Lexicon of the New Testament (Edinburgh: T. & T. Clark, 1922), his entry on ${e.w}. Typed from the 1922 printing by the translatable-exegetical-tools project (public domain), corrected and adapted by Tyndale House scholars as STEPBible’s Greek lexicon (TBESG, CC BY 4.0), ${at}.`,
        links: [stepFile, ['https://archive.org/details/manualgreeklexic00abbo', 'The book (Internet Archive)']],
      };
    case 'ml':
      return {
        simple: 'From Liddell and Scott (1889).',
        study: 'H. G. Liddell and R. Scott, An Intermediate Greek-English Lexicon (1889), through STEPBible.',
        deep: `Henry George Liddell and Robert Scott, An Intermediate Greek-English Lexicon (Oxford: Clarendon Press, 1889), founded on the seventh edition of their Greek-English Lexicon, its entry on ${e.w}. STEPBible uses it where Abbott-Smith has no entry, from the Perseus Digital Library’s text (Tufts University), in its Greek lexicon (TBESG, CC BY 4.0), ${at}.`,
        links: [stepFile, ['https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0058', 'Perseus'], ['https://archive.org/details/intermediategree00lidd', 'The book (Internet Archive)']],
      };
    case 'sg':
      return {
        simple: 'From STEPBible (Tyndale House).',
        study: 'Written by STEPBible (Tyndale House, Cambridge); no older lexicon is marked for it.',
        deep: `Written by STEPBible’s scholars at Tyndale House, Cambridge, for its Greek lexicon (TBESG, CC BY 4.0), which marks each entry it takes from an older lexicon and says those without a mark were added by STEPBible; ${at}.`,
        links: [stepFile],
      };
    case 'sn':
      return {
        simple: 'STEPBible’s note, then Brown-Driver-Briggs (1906), abridged.',
        study: `The note on this person or place is STEPBible’s (Tyndale House); the entry after it is abridged from Brown, Driver and Briggs (1906).${key}`,
        deep: `STEPBible’s scholars at Tyndale House, Cambridge, wrote the note on this person or place. The entry after it is from Francis Brown, with S. R. Driver and Charles A. Briggs, A Hebrew and English Lexicon of the Old Testament (Oxford: Clarendon Press, 1906), abridged by Larry Pierce for the Online Bible and edited by Tyndale House, as STEPBible’s Hebrew lexicon (TBESH, CC BY 4.0), ${at}.${key}`,
        links: [stepFile, bdbBook],
      };
    case 's':
      return {
        simple: 'From STEPBible (Tyndale House).',
        study: `Written by STEPBible (Tyndale House, Cambridge).${key}`,
        deep: `Written by STEPBible’s scholars at Tyndale House, Cambridge, for its Hebrew lexicon (TBESH, CC BY 4.0), whose other meanings are abridged from Brown-Driver-Briggs (1906); ${at}.${key}`,
        links: [stepFile],
      };
    default:
      return {
        simple: 'Abridged from Brown-Driver-Briggs (1906).',
        study: `Abridged from Brown, Driver and Briggs, A Hebrew and English Lexicon of the Old Testament (1906), through STEPBible.${key}`,
        deep: `Francis Brown, with S. R. Driver and Charles A. Briggs, A Hebrew and English Lexicon of the Old Testament (Oxford: Clarendon Press, 1906), its entry on ${e.w}, abridged by Larry Pierce for the Online Bible and edited by Tyndale House to fit STEPBible’s numbering, as STEPBible’s Hebrew lexicon (TBESH, CC BY 4.0), ${at}. Brown and Briggs taught at Union Theological Seminary, New York, and Driver at Oxford.${key}`,
        links: [stepFile, bdbBook],
      };
  }
}

/** James Strong's own entry, credited to him. */
function strongsCite(a: Atlas, key: string): Cite {
  const s = readFrom(a, 'strongs');
  const hebrew = key.startsWith('H');
  const no = Number(/\d+/.exec(key)?.[0] ?? 0);
  const book = hebrew ? 'Hebrew' : 'Greek';
  return {
    simple: 'From James Strong (1890).',
    study: `James Strong, The Exhaustive Concordance of the Bible (1890), its ${book} dictionary, no. ${no}.`,
    deep: `James Strong, professor at Drew Theological Seminary, The Exhaustive Concordance of the Bible (copyright 1890; first printed 1894), its ${book} dictionary, no. ${no}: where the word comes from and what it means, without the King James renderings he lists after them. Read in the JSON edition by Open Scriptures (CC BY-SA), at commit ${s.commit}${s.dates}; meanings its editors supplied in braces, where Strong gave none, are left out.`,
    links: [
      [s.file(hebrew ? 'hebrew/strongs-hebrew-dictionary.js' : 'greek/strongs-greek-dictionary.js'), 'The data file'],
      ['https://archive.org/details/exhaustiveconcor0000jame_t4t6', 'The book (Internet Archive)'],
    ],
  };
}

/** Strong's short definition first, then the fuller lexicon entry, each with
 *  its credit. Nothing shows for a part that has no text. */
function Meanings({ a, r, entry, fm }: { a: Atlas; r: number; entry: LexEntry; fm: FormsBy | null }) {
  const L = a.lemmas;
  const greek = L.lang[r] === 'G';
  const [note, bdb] = entry.o === 'sn' ? splitAtMark(entry.d) : [withoutMark(entry.d), []];
  const fuller = note.some((s) => s[0].trim());
  return (
    <>
      {entry.k && (
        <>
          <p class="muted" style="margin:0 0 2px;font-size:12.5px">
            In Strong’s dictionary
          </p>
          <StrongsText a={a} text={entry.k} />
          {fm?.x === 1 && atLeast('study') && <p class="muted" style="margin:4px 0 0;font-size:12.5px">The word family above links it to another word: the number in this line is a slip, corrected by this app.</p>}
          {fm?.x === 2 && atLeast('study') && <p class="muted" style="margin:4px 0 0;font-size:12.5px">The word family above leaves this derivation out: it is a slip or an old guess now given up.</p>}
          <CreditLine c={strongsCite(a, L.key[r])} />
        </>
      )}
      {fuller && (
        <>
          {entry.k && (
            <p class="muted" style="margin:0 0 2px;font-size:12.5px">
              {entry.o === 'sn' || entry.o === 's' ? 'In STEPBible’s lexicon' : greek ? 'A fuller entry' : 'A fuller entry, abridged'}
            </p>
          )}
          <Segments d={note} />
          {bdb.length > 0 && (
            <>
              <p class="muted" style="margin:8px 0 2px;font-size:12.5px">
                In Brown-Driver-Briggs, abridged
              </p>
              <Segments d={bdb} />
            </>
          )}
          <CreditLine c={lexCite(a, entry)} />
        </>
      )}
      {!entry.k && !fuller && <p class="muted">No lexicon entry for this root.</p>}
    </>
  );
}

/** How sure config/aramaic.json is of a root's language, and the verses whose
 *  Aramaic panel gives the reasons, from extras/aramaic.json: the file the
 *  Aramaic line under a verse already loads, asked for only for a root the
 *  build counts Aramaic or Hebrew. */
interface LanguageNote {
  certainty: string;
  verses: number[];
}

interface AramaicFile {
  format: number;
  verses: { v: number; entries?: number[] }[];
  entries: { verses: number[]; roots: number[] }[];
  roots: [number, string, string][];
}

function useLanguageNote(a: Atlas, root: number): LanguageNote | null {
  const [got, setGot] = useState<{ root: number; note: LanguageNote | null } | null>(null);
  useEffect(() => {
    if (!a.lemmas.origin?.[root]) return;
    let live = true;
    loadJson<AramaicFile>(a, 'extras/aramaic.json').then(
      (f) => {
        if (!live || f.format !== 1 || !Array.isArray(f.roots)) return;
        const row = f.roots.find((x) => x[0] === root);
        const lined = new Set(f.verses.filter((x) => x.entries?.length).map((x) => x.v));
        const verses = [...new Set(f.entries.filter((e) => e.roots.includes(root)).flatMap((e) => e.verses.filter((v) => lined.has(v))))].sort((x, y) => x - y);
        setGot({ root, note: row ? { certainty: row[2], verses } : null });
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [a, root]);
  return got?.root === root ? got.note : null;
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
  const langNote = useLanguageNote(a, st?.root ?? -1);

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
  const language = langLabel(L, r, langNote?.certainty);
  // A disputed language opens the Aramaic panel, where the reasons are: on this
  // verse if it has the word's note, else on the first verse that does.
  const reasons = langNote?.certainty === 'scholars differ' && langNote.verses.length ? (st.verse !== undefined && langNote.verses.includes(st.verse) ? st.verse : langNote.verses[0]) : null;
  const openReasons = (from: HTMLElement) => {
    if (reasons === null) return;
    if (S.selected.peek() !== reasons) S.selectVerse(reasons, { openTab: false });
    openExtra('aramaic', 'verse', reasons, from);
  };
  const type = lex?.m ? wordType(lex.m, lex.s) : null;

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
          {reasons !== null ? (
            <button type="button" class="godeeper" style="display:inline;margin:0;font-size:inherit" title="Why scholars differ: the Aramaic panel" onClick={(e) => openReasons(e.currentTarget)}>
              {language}
            </button>
          ) : (
            language
          )}{' '}
          · Strong’s {L.key[r]}
        </dd>
        <dt>Occurs</dt>
        <dd>
          {count.toLocaleString()} times in {verses.length.toLocaleString()} verses across {books} {books === 1 ? 'book' : 'books'}
        </dd>
        {type && (
          <>
            <dt>Word type</dt>
            <dd>{type}</dd>
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
            <dd>{describeMorph(word[4], word[5] & FLAG.aramaic ? 'A' : greek ? 'G' : 'H', L.key[r])}</dd>
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
      {fm && <EveryForm a={a} r={r} fm={fm} here={here} hereCode={word?.[4] ?? ''} hereGloss={word?.[2] ?? ''} total={verses.length} />}
      {fm && <Family a={a} r={r} fm={fm} />}

      <h3>Definition</h3>
      {lex === undefined ? <p class="muted">Loading…</p> : lex ? <Meanings a={a} r={r} entry={lex} fm={fm as FormsBy | null} /> : <p class="muted">No lexicon entry for this root.</p>}
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
      <Provenance work={greek ? 'tbesg' : 'tbesh'}>
        {fm?.r && "Related words: from the derivations in James Strong's dictionaries (1890, public domain; JSON by Open Scriptures, CC BY-SA) and the senses, spellings and Aramaic twins in STEPBible's Hebrew and Greek lexicons (CC BY 4.0); a link marked as this app's corrects a slip in Strong's numbers. "}
        {lex && 'Each definition names its writer under it. '}
        {type && "Word type: in STEPBible's own words for its codes. "}
        Words, forms and grammar: STEPBible {greek ? 'TAGNT' : 'TAHOT'}. Counts are computed from the base text ({greek ? 'Nestle-Aland family' : 'Leningrad Codex'}).
      </Provenance>
    </div>
  );
}
