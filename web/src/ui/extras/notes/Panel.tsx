// The panel behind the study notes line: the verse's own notes in full, then
// the notes on the wider passage around it (folded at Simple, open from
// Study), and at Deep where each note comes from. The notes are Bible
// scholars' words, so the panel says whose they are and never presents them as
// the app's own claim, or as Scripture.

import '../notes.css';
import type { ComponentChildren } from 'preact';
import { locate } from '../../../data/atlas';
import { useJson } from '../data';
import { Facts, Lead, SourceNote, refName, verseHash } from '../kit';
import { levelAtLeast } from '../level';
import type { PanelProps, VerseRef } from '../types';
import { type Block, type BookFile, type Data, type Hit, type Run, hits, nameFrom } from './model';

function Runs({ runs, a, navigate }: { runs: Run[]; a: PanelProps<Data>['a']; navigate: (v: VerseRef) => void }) {
  return (
    <>
      {runs.map((r, k) => {
        if (typeof r === 'string') return r;
        if (r.length === 1) return <em key={k}>{r[0]}</em>;
        const [from, to, text] = r;
        const name = refName(a, from, to);
        return (
          <a
            key={k}
            class="x-notes-ref"
            href={verseHash(a, from)}
            data-lv={from}
            onClick={(e) => {
              e.preventDefault();
              navigate(from);
            }}
            title={`Read ${name}`}
          >
            {text}
          </a>
        );
      })}
    </>
  );
}

function Body({ blocks, a, navigate }: { blocks: Block[]; a: PanelProps<Data>['a']; navigate: (v: VerseRef) => void }) {
  return (
    <>
      {blocks.map((b, k) => {
        if (b[0] === 'p') {
          return (
            <p key={k} class="x-notes-p">
              <Runs runs={b[1]} a={a} navigate={navigate} />
            </p>
          );
        }
        const items = b[1].map((runs, j) => (
          <li key={j}>
            <Runs runs={runs} a={a} navigate={navigate} />
          </li>
        ));
        return b[0] === 'ol' ? (
          <ol key={k} class="x-notes-list">
            {items}
          </ol>
        ) : (
          <ul key={k} class="x-notes-list">
            {items}
          </ul>
        );
      })}
    </>
  );
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const book = a.books[locate(a, verse).book];
  const file = useJson<BookFile>(a, `extras/notes/${book.osis}.json`);
  const h = hits(data, verse);
  const study = levelAtLeast('study');
  const deep = levelAtLeast('deep');
  const name = (x: Hit) => nameFrom(a, verse, x.from, x.to);
  const where = refName(a, verse);

  const note = (x: Hit, heading: ComponentChildren) => {
    const n = file?.notes[x.i];
    return (
      <article key={x.i} class="x-notes-note" aria-label={`Study note on ${refName(a, x.from, x.to)}`}>
        {heading}
        {file === undefined ? <p class="x-notes-p xt-wait">…</p> : n ? <Body blocks={n.b} a={a} navigate={navigate} /> : null}
      </article>
    );
  };
  // Folded at Simple; at Study and Deep the narrowest passage note is open.
  const wide = h.wide.map((x, k) => (
    <details key={x.i} class="x-notes-more" open={study && (k === 0 || deep)}>
      <summary>About {name(x)}</summary>
      {note(x, null)}
    </details>
  ));

  if (file === null) return <p class="xt-lead">Sorry, these notes could not be shown right now.</p>;
  const ids = [...h.own, ...h.wide].map((x) => file?.notes[x.i]?.id).filter(Boolean);
  return (
    <>
      <Lead>
        What Bible scholars note about {h.own.length > 0 ? 'this verse' : 'the passage around this verse'}, {where}. These are their notes, written to help, not the words of the Bible.
      </Lead>
      {h.own.map((x) => note(x, h.own.length > 1 || x.from !== x.to ? <h3 class="x-notes-h">On {name(x)}</h3> : null))}
      {wide.length > 0 && (
        <section class="x-notes-wide" aria-label="Notes on the wider passage">
          {h.own.length > 0 && <h3 class="x-notes-h">The passage around it</h3>}
          {wide}
        </section>
      )}
      {deep && (
        <>
          <h3>Where these notes come from</h3>
          <Facts
            rows={[
              ['Written by', 'Bible scholars at Tyndale House Publishers, as the Tyndale Open Study Notes (2023)'],
              ['Adapted by', `Mission Mutual, in plain English, as the Aquifer Open Study Notes${data.version ? `, version ${data.version}` : ''} (2026)`],
              ['How matched', 'Each note names the passage it is about. A note on up to three verses shows with each of them; a longer passage’s note shows with every verse in it.'],
              ['Changed here', 'Shown as plain text: links, empty headings and styling are left out. Verse names that the Berean Standard Bible numbers differently are left as plain words. Where a note points to one of Tyndale’s theme notes, profiles or book introductions, which this app does not include, its words are kept as written.'],
              ['Note numbers', ids.join(', ')],
            ]}
          />
        </>
      )}
      <SourceNote>Study notes from the Aquifer Open Study Notes by Mission Mutual, adapted from the Tyndale Open Study Notes by Tyndale House Publishers, CC BY-SA 4.0.</SourceNote>
    </>
  );
}
