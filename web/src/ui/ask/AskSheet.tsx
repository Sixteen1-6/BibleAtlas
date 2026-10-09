// Ask the Bible, the panel. One question (or one Nave's subject) at a time,
// in the same frame as the verse extras' panels:
//   Simple  the short answer, every sentence with the verses it comes from,
//           and the key verses in full. A question not yet reviewed shows its
//           verses only, with no words of ours.
//   Study   every verse on the question lit on the map, with the links between them.
//   Deep    the full list of verses, and where they were gathered from.
// The answers say only what their verses say: the Bible explaining the Bible.

import './ask.css';
import { createPortal } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { type Atlas, locate } from '../../data/atlas';
import { atLeast, deepen } from '../../depth';
import * as S from '../../state';
import { ALL_VOTES, linksWithinRows } from '../../data/thread';
import { Passage, SourceNote, refName } from '../extras/kit';
import { Shell } from '../extras/Sheet';
import { PreviewRow } from '../ThemeThread';
import { type Asked, type Range, type Sentence, askId, askIndex, askOpen, askVerses, closeAsk, findAsked, lastClose, loadAsk, topicData } from './ask';

const dismiss = () => closeAsk('dismiss');

/** Move the reader to a verse; Back returns to the question. */
function go(v: number): void {
  closeAsk('navigate');
  S.selectVerse(v);
  S.mobilePane.value = 'read';
}

function expand(rs: Range[]): Uint32Array {
  let n = 0;
  for (const [s, e] of rs) n += e - s + 1;
  const out = new Uint32Array(n);
  let i = 0;
  for (const [s, e] of rs) for (let v = s; v <= e; v++) out[i++] = v;
  return out;
}

/** What this panel last put on the map, so closing it can take it off again. */
let litLabel: string | null = null;
let generation = 0;

async function lightOnMap(a: Atlas, asked: Asked, rs: Range[], name: string): Promise<void> {
  const gen = ++generation;
  const verses = expand(rs);
  const label = `ask:${askId(asked)}`;
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

function useVerses(a: Atlas, asked: Asked): Range[] | null | undefined {
  const id = askId(asked);
  const [got, setGot] = useState<{ id: string; rs: Range[] | null } | null>(null);
  useEffect(() => {
    let live = true;
    askVerses(a, asked).then(
      (rs) => live && setGot({ id, rs }),
      () => live && setGot({ id, rs: null }),
    );
    return () => {
      live = false;
    };
  }, [a, id]);
  return got && got.id === id ? got.rs : undefined;
}

function useTopTopic(a: Atlas, asked: Asked): Range[] | null | undefined {
  const i = asked.kind === 'topic' ? asked.i : -1;
  const [got, setGot] = useState<{ i: number; top: Range[] | null } | null>(null);
  useEffect(() => {
    if (i < 0) return;
    let live = true;
    topicData(a, i).then(
      (t) => live && setGot({ i, top: t.top }),
      () => live && setGot({ i, top: null }),
    );
    return () => {
      live = false;
    };
  }, [a, i]);
  if (asked.kind === 'question') return asked.q.top;
  return got && got.i === i ? got.top : undefined;
}

function Refs({ a, rs }: { a: Atlas; rs: Range[] }) {
  return (
    <span class="ask-refs">
      {rs.map(([s, e], i) => (
        <button key={i} type="button" class="ask-ref" data-lv={s} onClick={() => go(s)}>
          {refName(a, s, e)}
        </button>
      ))}
    </span>
  );
}

function Answer({ a, sentences }: { a: Atlas; sentences: Sentence[] }) {
  return (
    <div class="ask-answer">
      {sentences.map((s, i) => (
        <p key={i}>
          {s.t} <Refs a={a} rs={s.r} />
        </p>
      ))}
    </div>
  );
}

/** Every verse, by book, at Deep: each a row that lights its verse under a mouse and takes the reader there. */
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

function Body({ a, asked }: { a: Atlas; asked: Asked }) {
  const verses = useVerses(a, asked);
  const top = useTopTopic(a, asked);
  const study = atLeast('study');
  const deep = atLeast('deep');
  const answer = asked.kind === 'question' ? asked.q.answer : undefined;
  const name = asked.kind === 'question' ? asked.q.q : asked.title;
  const total = asked.kind === 'question' ? asked.q.n : asked.n;

  // At Study and Deep the question's verses light up on the map.
  const id = askId(asked);
  useEffect(() => {
    if (study && verses) void lightOnMap(a, asked, verses, name);
  }, [a, id, study, verses]);

  return (
    <>
      {asked.kind === 'question' && asked.q.draft && <p class="ask-draft">Draft answer, not yet approved. Only preview builds show it.</p>}
      {answer ? (
        <Answer a={a} sentences={answer} />
      ) : (
        <p class="xt-lead">{asked.kind === 'question' ? 'Here is what the Bible says, in its own words.' : `Verses about ${asked.title.toLowerCase()}.`}</p>
      )}
      {answer && <h3>Key verses</h3>}
      {top === undefined ? (
        <p class="xt-wait">…</p>
      ) : (
        (top ?? []).map(([s, e]) => <Passage key={s} a={a} from={s} to={e} navigate={go} />)
      )}
      {total > (top?.length ?? 0) &&
        (study ? (
          <p class="ask-more">
            {total.toLocaleString()} verses in all, lit on the map{deep ? '' : '.'}
            {deep ? ':' : ''}
          </p>
        ) : (
          <button type="button" class="godeeper ask-more" onClick={() => deepen('study')}>
            See all {total.toLocaleString()} verses on the map ›
          </button>
        ))}
      {deep && verses && <AllVerses a={a} rs={verses} />}
      {deep && (
        <SourceNote>
          {asked.kind === 'question' && answer
            ? 'Every sentence says only what the verses after it say. The wider set of verses was gathered with Nave’s Topical Bible (1896; this edition CC BY 4.0, Brady Stephenson).'
            : 'Verses gathered with Nave’s Topical Bible (1896; this edition CC BY 4.0, Brady Stephenson), used as an index only.'}
        </SourceNote>
      )}
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
  const title = asked.kind === 'question' ? asked.q.q : asked.title;
  const at = asked.kind === 'question' ? 'Ask the Bible' : 'Ask the Bible · a subject';
  return createPortal(
    <Shell key={id} title={title} at={at} onDismiss={dismiss}>
      <Body a={a} asked={asked} />
    </Shell>,
    document.body,
  );
}
