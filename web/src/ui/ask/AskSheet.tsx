// Ask the Bible, the panel: one question at a time, in the same frame as the
// verse extras' panels. It speaks only in the Bible's words.
//
//   A prepared question: its chain of Scripture, whole verses and parts of
//   verses set one after another, with nothing of ours between.
//   Any other question: the verses gathered for its words, best first, with
//   those words highlighted.
//   A Nave's subject: its verses.
//
//   Simple  the chain, or the best few verses.
//   Study   every verse found, lit on the map with the links between them.
//   Deep    the full list, and how the verses were found or why each is there.

import './ask.css';
import { createPortal } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { type Atlas, langName, locate, verseIndex } from '../../data/atlas';
import { plainText } from '../../data/plain';
import { wordPieces } from '../../data/search';
import { ALL_VOTES, linksWithinRows } from '../../data/thread';
import { atLeast, deepen } from '../../depth';
import * as S from '../../state';
import { Passage, SourceNote, refName } from '../extras/kit';
import { Shell } from '../extras/Sheet';
import { useVerseLoad } from '../common';
import { PreviewRow } from '../ThemeThread';
import { type Asked, type Part, type Range, askId, askIndex, askOpen, askVerses, closeAsk, findAsked, lastClose, loadAsk, topicData } from './ask';
import type { Gathered } from './gather';
import { route } from './route';

const dismiss = () => closeAsk('dismiss');

/** Verses shown in full at Simple, and at Study. */
const FIRST = 6;
const MORE = 12;

/** Move the reader to a verse; Back returns to the question. */
function go(v: number): void {
  closeAsk('navigate');
  S.selectVerse(v);
  S.mobilePane.value = 'read';
}

function expand(rs: Range[]): number[] {
  const out: number[] = [];
  for (const [s, e] of rs) for (let v = s; v <= e; v++) out.push(v);
  return out;
}

function toRanges(vs: number[]): Range[] {
  const sorted = [...vs].sort((x, y) => x - y);
  const out: Range[] = [];
  for (const v of sorted) {
    const last = out[out.length - 1];
    if (last && v === last[1] + 1) last[1] = v;
    else if (!last || v > last[1]) out.push([v, v]);
  }
  return out;
}

// ------------------------------------------------------------ the map

/** What this panel last put on the map, so closing it can take it off again. */
let litLabel: string | null = null;
let generation = 0;

async function lightOnMap(a: Atlas, id: string, list: number[], name: string): Promise<void> {
  const gen = ++generation;
  const verses = Uint32Array.from([...new Set(list)].sort((x, y) => x - y));
  const label = `ask:${id}`;
  litLabel = label;
  S.theme.value = null;
  S.path.value = null;
  S.marks.value = { verses, label };
  let edges: Uint32Array | undefined;
  try {
    edges = await S.engine.peek()?.linksWithin(a.n, verses, ALL_VOTES);
  } catch {
    edges = undefined;
  }
  if (gen !== generation || S.marks.peek()?.label !== label) return;
  edges ??= linksWithinRows(a, verses, ALL_VOTES);
  S.groupEdges.value = { edges, label: `${name}: ${edges.length.toLocaleString()} links between ${verses.length.toLocaleString()} verses` };
}

function unlight(): void {
  generation++;
  if (litLabel && S.marks.peek()?.label === litLabel) {
    S.marks.value = null;
    S.groupEdges.value = null;
  }
  litLabel = null;
}

// ------------------------------------------------------------ data hooks

/** undefined while loading, null if it failed. */
function useAsync<T>(key: string, run: () => Promise<T>): T | null | undefined {
  const [got, setGot] = useState<{ key: string; value: T | null } | null>(null);
  useEffect(() => {
    let live = true;
    run().then(
      (value) => live && setGot({ key, value }),
      () => live && setGot({ key, value: null }),
    );
    return () => {
      live = false;
    };
  }, [key]);
  return got && got.key === key ? got.value : undefined;
}

// ------------------------------------------------------------ pieces

/** A verse's BSB words with the question's words marked. */
function Marked({ a, v, marks }: { a: Atlas; v: number; marks: Set<string> }) {
  const known = plainText()?.[v];
  const { row, failed } = useVerseLoad(a, known ? null : v);
  const t = known ?? row?.[0];
  if (!t) return <span class="xt-wait">{failed ? 'Couldn’t load this verse.' : '…'}</span>;
  return <>{wordPieces(t).map((p, i) => (p.word && marks.has(p.word) ? <mark key={i}>{p.text}</mark> : p.text))}</>;
}

function Found({ a, v, marks }: { a: Atlas; v: number; marks: Set<string> }) {
  return (
    <section class="xt-passage ask-found" aria-label={refName(a, v)}>
      <button type="button" class="xt-pref" data-lv={v} onClick={() => go(v)} title={`Read ${refName(a, v)} in its chapter`}>
        {refName(a, v)} <span aria-hidden="true">›</span>
      </button>
      <p class="xt-ptext" data-lv={v}>
        <Marked a={a} v={v} marks={marks} />
      </p>
    </section>
  );
}

/** The chain of Scripture: each part as the Bible words it, then where it is from. */
function Chain({ a, parts }: { a: Atlas; parts: Part[] }) {
  return (
    <div class="ask-chain">
      {parts.map((p, i) => (
        <ChainPart key={i} a={a} part={p} />
      ))}
    </div>
  );
}

function ChainPart({ a, part }: { a: Atlas; part: Part }) {
  const [s, e] = part.r;
  const [whole, setWhole] = useState(false);
  return (
    <blockquote class="ask-part" data-lv={s}>
      {part.w && !whole ? (
        <p>
          {part.a && '… '}
          {part.w}
          {part.z && ' …'}
        </p>
      ) : (
        <WholeText a={a} s={s} e={e} />
      )}
      <footer>
        <button type="button" class="ask-ref" onClick={() => go(s)}>
          {refName(a, s, e)}
        </button>
        {part.w && (part.a || part.z) && (
          <button type="button" class="ask-whole" onClick={() => setWhole((x) => !x)} aria-expanded={whole}>
            {whole ? 'show the part' : 'read the whole verse'}
          </button>
        )}
      </footer>
    </blockquote>
  );
}

function WholeText({ a, s, e }: { a: Atlas; s: number; e: number }) {
  const vs: number[] = [];
  for (let v = s; v <= e; v++) vs.push(v);
  return (
    <p>
      {vs.map((v) => (
        <span key={v}>
          {e > s && <sup>{locate(a, v).verse}</sup>}
          <Marked a={a} v={v} marks={new Set()} />{' '}
        </span>
      ))}
    </p>
  );
}

/** Every verse, by book, at Deep: each lights its verse under a mouse and takes the reader there. */
function AllVerses({ a, rs }: { a: Atlas; rs: Range[] }) {
  const books: { book: number; items: Range[] }[] = [];
  for (const r of rs) {
    const b = locate(a, r[0]).book;
    const last = books[books.length - 1];
    if (last && last.book === b) last.items.push(r);
    else books.push({ book: b, items: [r] });
  }
  return (
    <div class="ask-all">
      {books.map(({ book, items }) => (
        <div key={book} class="ask-book">
          <h4>{a.books[book].name}</h4>
          <div class="ask-chips">
            {items.map(([s, e]) => (
              <PreviewRow key={s} v={s} class="ask-chip" onClick={() => go(s)}>
                {refName(a, s, e).replace(`${a.books[book].name} `, '')}
              </PreviewRow>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Why each part is in its chain, at Deep: the ties the build found between it
 * and the question or the other parts, in the Bible's own data. */
function WhyEach({ a, parts }: { a: Atlas; parts: Part[] }) {
  const L = a.lemmas;
  const name = (j: number) => refName(a, parts[j].r[0], parts[j].r[1]);
  const names = (js: number[]) => js.map(name).join(', ');
  // Matthew is the 40th book.
  const newTestament = (j: number) => locate(a, parts[j].r[0]).book >= 39;

  return (
    <>
      <h3>Why each verse is here</h3>
      <ul class="ask-how">
        {parts.map((p, i) => {
          const t = p.t ?? {};
          const why: string[] = [];
          if (t.w) why.push(`it says ${t.w.map((w) => `“${w}”`).join(', ')}`);
          if (t.s) why.push(`Nave’s lists it under ${t.s.join(', ')}`);
          if (t.x) why.push(`cross-referenced with ${names(t.x)}`);
          for (const j of t.q ?? []) why.push(newTestament(i) && !newTestament(j) ? `quotes ${name(j)}` : `quoted in ${name(j)}`);
          // One line per root, with every part that shares it.
          const byRoot = new Map<number, number[]>();
          for (const [j, root] of t.r ?? []) byRoot.set(root, [...(byRoot.get(root) ?? []), j]);
          for (const [root, js] of byRoot) why.push(`shares the ${langName(L, root)} word ${L.word[root]} (“${L.gloss[root]}”) with ${names(js)}`);
          if (t.p) why.push(`the same passage as ${names(t.p)}`);
          return (
            <li key={i}>
              <b>{name(i)}</b>: {why.join('; ')}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function SeeAll({ total }: { total: number }) {
  if (atLeast('study')) return <p class="ask-more">{total.toLocaleString()} verses in all, lit on the map.</p>;
  return (
    <button type="button" class="godeeper ask-more" onClick={() => deepen('study')}>
      See all {total.toLocaleString()} verses on the map ›
    </button>
  );
}

const NAVES = 'Nave’s Topical Bible (1896; this edition CC BY 4.0, Brady Stephenson), used as an index only';

// ------------------------------------------------------------ bodies

/** A prepared question: its chain, then its wider set. `typed`: what was
 * asked in other words, when this question is the one that answers it. */
function QuestionBody({ a, asked, typed }: { a: Atlas; asked: Asked & { kind: 'question' }; typed?: string }) {
  const q = asked.q;
  const rs = useAsync(`q:${q.id}`, () => askVerses(a, asked));
  const study = atLeast('study');
  useEffect(() => {
    if (study && rs) void lightOnMap(a, q.id, expand(rs), q.q);
  }, [q.id, study, rs]);
  return (
    <>
      <Chain a={a} parts={q.chain} />
      <SeeAll total={q.n} />
      {atLeast('deep') && <WhyEach a={a} parts={q.chain} />}
      {atLeast('deep') && rs && <AllVerses a={a} rs={rs} />}
      {atLeast('deep') && typed && <SourceNote>These verses were prepared for the question “{q.q}”.</SourceNote>}
      {atLeast('deep') && <SourceNote>Every word above is the Bible’s (BSB). The wider set of verses was gathered with {NAVES}.</SourceNote>}
    </>
  );
}

/** Anything typed: the prepared question that answers it, when one plainly
 * does, else the verses gathered for its words. */
function LiveBody({ a, text }: { a: Atlas; text: string }) {
  const ix = askIndex.value;
  const q = ix ? route(ix, text) : null;
  return q ? <QuestionBody a={a} asked={{ kind: 'question', q }} typed={text} /> : <GatheredBody a={a} text={text} />;
}

function GatheredBody({ a, text }: { a: Atlas; text: string }) {
  // The word tables load with the first live question, not with the page.
  const got = useAsync<Gathered>(`live:${text}`, () => import('./gather').then((m) => m.gather(a, text)));
  const study = atLeast('study');
  const deep = atLeast('deep');
  useEffect(() => {
    if (study && got && got.verses.length) void lightOnMap(a, `live:${text}`, got.verses, text);
  }, [text, study, got]);
  if (got === undefined) return <p class="xt-lead xt-wait">Finding the verses…</p>;
  if (!got || !got.verses.length) return <p class="xt-lead">No verses came up for these words. Try asking with other words.</p>;
  const shown = got.verses.slice(0, study ? MORE : FIRST);
  return (
    <>
      <p class="xt-lead">What the Bible says, in its own words.</p>
      {shown.map((v) => (
        <Found key={v} a={a} v={v} marks={got.marks} />
      ))}
      {got.verses.length > shown.length && <SeeAll total={got.verses.length} />}
      {deep && (
        <>
          <AllVerses a={a} rs={toRanges(got.verses)} />
          <h3>How these verses were found</h3>
          <ul class="ask-how">
            <li>
              Words looked for:{' '}
              {got.concepts
                .filter((c) => c.found)
                .map((c) => `${c.word} (${c.forms.join(', ')})`)
                .join('; ') || 'none'}
            </li>
            {got.subjects.length > 0 && <li>Subjects in Nave’s index: {got.subjects.join(', ')}</li>}
            {got.questions.length > 0 && <li>Prepared questions with these words: {got.questions.join(' · ')}</li>}
            <li>Verses that hold all the words, sit under a matching subject, and are cross-referenced by the others come first.</li>
          </ul>
          <SourceNote>Every verse is the Bible’s own words (BSB), found by words, by {NAVES}, and by cross-references, with nothing written in between.</SourceNote>
        </>
      )}
    </>
  );
}

function TopicBody({ a, asked }: { a: Atlas; asked: Asked & { kind: 'topic' } }) {
  const t = useAsync(`t:${asked.i}`, () => topicData(a, asked.i));
  const study = atLeast('study');
  useEffect(() => {
    if (study && t) void lightOnMap(a, askId(asked), expand(t.v), asked.title);
  }, [asked.i, study, t]);
  if (t === undefined) return <p class="xt-wait">…</p>;
  if (!t) return <p class="xt-lead">Sorry, these verses could not be loaded right now.</p>;
  return (
    <>
      <p class="xt-lead">Verses on {asked.title.toLowerCase()}.</p>
      {t.top.map(([s, e]) => (
        <Passage key={s} a={a} from={s} to={e} navigate={go} />
      ))}
      {asked.n > t.top.length && <SeeAll total={asked.n} />}
      {atLeast('deep') && <AllVerses a={a} rs={t.v} />}
      {atLeast('deep') && <SourceNote>Verses gathered with {NAVES}.</SourceNote>}
    </>
  );
}

/** For someone asking about ending their life, whole verses only, in this order. */
const HOPE: [string, number, number, number][] = [
  ['Ps', 34, 18, 18],
  ['1Kgs', 19, 3, 5],
  ['Ps', 42, 11, 11],
  ['2Cor', 1, 8, 10],
  ['Ps', 40, 1, 2],
  ['Lam', 3, 21, 23],
  ['Matt', 11, 28, 29],
];

/** Where to turn now, then the verses. The one place the panel speaks in words not the Bible's. */
function CareBody({ a }: { a: Atlas }) {
  const passages = HOPE.flatMap(([osis, c, v1, v2]) => {
    const b = a.books.findIndex((x) => x.osis === osis);
    return b < 0 ? [] : [[verseIndex(a, b, c, v1), verseIndex(a, b, c, v2)]];
  });
  return (
    <>
      <div class="ask-care" role="note">
        <p>
          <b>If you are thinking about ending your life, please talk to someone today.</b> In the US, call or text 988. In the UK and Ireland, call Samaritans on 116 123. Anywhere else,{' '}
          <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">
            find a helpline near you
          </a>{' '}
          or call your local emergency number.
        </p>
      </div>
      {passages.map(([s, e]) => (
        <Passage key={s} a={a} from={s} to={e} navigate={go} />
      ))}
    </>
  );
}

/** The panel, when something is asked. Mounted once by the app. */
export function AskSheet({ a }: { a: Atlas }) {
  const id = askOpen.value;
  const ix = askIndex.value;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (id && !ix) loadAsk(a).catch(() => setFailed(true));
  }, [a, id, ix]);
  const asked = id && ix ? findAsked(ix, id) : null;
  useEffect(() => {
    // An old link to a question that is gone, or data that will not load: drop it quietly.
    if (id && ((ix && !asked) || failed)) closeAsk('dismiss');
  }, [id, ix, asked, failed]);
  useEffect(() => {
    if (!id && lastClose !== 'navigate') unlight();
  }, [id]);

  if (!id || !asked) return null;
  const title = asked.kind === 'question' ? asked.q.q : asked.kind === 'topic' ? asked.title : asked.kind === 'care' ? 'Help, and hope' : asked.text;
  return createPortal(
    <Shell key={id} title={title} at="Ask the Bible" onDismiss={dismiss}>
      {asked.kind === 'question' && <QuestionBody a={a} asked={asked} />}
      {asked.kind === 'topic' && <TopicBody a={a} asked={asked} />}
      {asked.kind === 'live' && <LiveBody a={a} text={asked.text} />}
      {asked.kind === 'care' && <CareBody a={a} />}
    </Shell>,
    document.body,
  );
}
