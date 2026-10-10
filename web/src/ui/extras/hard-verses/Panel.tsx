// The panel behind an "Often asked" line.
//
// Simple: the question, a plain answer in two or three sentences, and the
//   verses it is about, side by side.
// Study: the main ways Christians explain it, each with how widely it is held
//   and its verses, and the passages that help.
// Deep: what the answer rests on, where to read more, and a way to suggest a
//   correction.

import { type Atlas } from '../../../data/atlas';
import { GoDeeper } from '../../Depth';
import { CitedSource } from '../../Sources';
import { useJson } from '../data';
import { Lead, Passage, SideBySide, SourceNote, Unsure, refName } from '../kit';
import { levelAtLeast } from '../level';
import type { PanelProps, VerseRef } from '../types';
import { CARDS_FILE, type Card, type CardsFile, type Data, type Span } from './model';

const REPO = 'https://github.com/Sixteen1-6/BibleAtlas';
/** Passages shown side by side under the answer, at most. */
const SIDE_BY_SIDE = 3;

/** Curly quotes and apostrophes for display; the config keeps plain ones so quotes stay easy to check. */
function smart(text: string): string {
  return text.replace(/"([^"]*)"/g, '“$1”').replace(/(\w)'(\w)/g, '$1’$2');
}

function issueLink(a: Atlas, c: Card): string {
  const title = `Often asked: ${c.question}`;
  const body = `Question: ${c.question} (${c.id}, ${refName(a, c.v, c.end)})\n\n> ${c.answer}\n\nWhat should change, and why (a verse, a footnote or a source helps):\n`;
  return `${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function Refs({ a, spans, navigate }: { a: Atlas; spans: Span[]; navigate: (v: VerseRef) => void }) {
  if (!spans.length) return null;
  return (
    <span class="x-hard-verses-refs">
      {spans.map(([s, e]) => (
        <button key={`${s}-${e}`} type="button" class="x-hard-verses-ref" data-lv={s} onClick={() => navigate(s)}>
          {refName(a, s, e)}
        </button>
      ))}
    </span>
  );
}

function CardView({ a, c, verse, navigate }: { a: Atlas; c: Card; verse: VerseRef; navigate: (v: VerseRef) => void }) {
  const study = levelAtLeast('study');
  const deep = levelAtLeast('deep');
  // The verse the reader came from first, then the others.
  const all: Span[] = [[c.v, c.end], ...c.also];
  const passages = [...all.filter(([s, e]) => s <= verse && verse <= e), ...all.filter(([s, e]) => !(s <= verse && verse <= e))].slice(0, SIDE_BY_SIDE);
  return (
    <article class="x-hard-verses-card">
      <h3 class="x-hard-verses-q">
        {c.question}
        {c.draft && <Unsure title="Not yet reviewed by a person">draft</Unsure>}
      </h3>
      <Lead>{smart(c.answer)}</Lead>
      <SideBySide>
        {passages.map(([s, e]) => (
          <Passage key={s} a={a} from={s} to={e > s ? e : undefined} navigate={navigate} />
        ))}
      </SideBySide>
      {study && c.views.length > 0 && (
        <>
          <h4 class="x-hard-verses-h">How Christians explain it</h4>
          <ul class="x-hard-verses-views">
            {c.views.map((v, i) => (
              <li key={i}>
                <p class="x-hard-verses-label">
                  {v.label} <span class="x-hard-verses-strength">{v.strength}</span>
                </p>
                <p>{smart(v.text)}</p>
                <Refs a={a} spans={v.refs} navigate={navigate} />
              </li>
            ))}
          </ul>
        </>
      )}
      {study && c.helps.length > 0 && (
        <>
          <h4 class="x-hard-verses-h">Passages that help</h4>
          <Refs a={a} spans={c.helps} navigate={navigate} />
        </>
      )}
      {deep && (
        <div class="x-hard-verses-deep">
          {c.evidence && <p>Behind this answer: {smart(c.evidence.replace(/\.\s*$/, ''))}.</p>}
          {c.read_more.length > 0 && (
            <>
              <h4 class="x-hard-verses-h">Read more</h4>
              <ul class="x-hard-verses-links">
                {c.read_more.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.title}
                    </a>{' '}
                    <span class="x-hard-verses-site">
                      <CitedSource a={a} text={l.site} />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p class="x-hard-verses-meta">
            {c.source}
            {c.reviewed_by.length > 0 && ` Reviewed by ${c.reviewed_by.join(', ')}.`}{' '}
            <a href={issueLink(a, c)} target="_blank" rel="noopener">
              Suggest a correction
            </a>
          </p>
        </div>
      )}
    </article>
  );
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const file = useJson<CardsFile>(a, CARDS_FILE);
  const mine = data.at.get(verse) ?? [];
  if (file === undefined) return <p class="xt-lead xt-wait">…</p>;
  if (file === null) return <p class="xt-lead">Sorry, this could not be shown right now.</p>;
  const cards = mine.map((i) => file.cards[i]).filter((c): c is Card => !!c);
  return (
    <>
      {cards.map((c) => (
        <CardView key={c.id} a={a} c={c} verse={verse} navigate={navigate} />
      ))}
      <GoDeeper to="study">How Christians explain it</GoDeeper>
      <SourceNote>Answers written for this app with AI help, from the Bible (BSB), and reviewed by a person before they are shown.</SourceNote>
    </>
  );
}
