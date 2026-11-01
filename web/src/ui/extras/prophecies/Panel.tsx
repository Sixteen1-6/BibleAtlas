// The panel behind the prophecy line: each Old Testament passage beside the
// New Testament passage that fulfils it, with the New Testament's own words
// that say so. At Deep, once the reader has finished the commentary notice,
// the Christian writers who state the pair, each in his own words, and how
// many writers that is. At the end, every pair the app has, by book.

import type { Atlas } from '../../../data/atlas';
import { Commentary, CommentaryFoot } from '../../commentary/Gate';
import { useJson } from '../data';
import { Lead, Passage, SideBySide, SourceNote, refName } from '../kit';
import { levelAtLeast } from '../level';
import type { PanelProps, VerseRef } from '../types';
import { type Cite, type Data, type NotesFile, type Pair, SOURCE, isOt, pairsAt, strength, writersShown } from './model';

function Writers({ a, cites, writers }: { a: Atlas; cites: Cite[]; writers: number }) {
  return (
    <div class="x-prophecies-writers">
      <p class="x-prophecies-strength">
        Christian writers who say so: {writers} {writers === 1 ? 'writer' : 'writers'} ({strength(writers)})
      </p>
      {cites.map((c, i) => (
        <blockquote key={i} class="x-prophecies-cite">
          <p>“{c.quote}”</p>
          <footer>
            {c.by}, {c.work} ({c.when}), on {refName(a, c.on[0], c.on[1])}
            {c.edition ? `, ${c.edition}` : ''}
            {c.label ? `; shown on the linked page as ${c.label}` : ''}. Read in {c.read}, {c.retrieved}.{' '}
            <a href={c.url} target="_blank" rel="noopener noreferrer">
              Read it
            </a>
          </footer>
        </blockquote>
      ))}
    </div>
  );
}

function One({ a, p, notes, navigate }: { a: Atlas; p: Pair; notes: NotesFile | null | undefined; navigate: (v: VerseRef) => void }) {
  const n = notes?.notes[p.i];
  const deep = levelAtLeast('deep');
  return (
    <div class="x-prophecies-pair">
      <SideBySide>
        <Passage a={a} from={p.ot} to={p.otTo} navigate={navigate} note="The prophecy" />
        <Passage a={a} from={p.nt} to={p.ntTo} navigate={navigate} note="Its fulfilment" />
      </SideBySide>
      {n?.says && (
        <p class="x-prophecies-says">
          <button type="button" class="xt-pref" onClick={() => navigate(n.says![0])}>
            {refName(a, n.says[0])}
          </button>
          : “{n.says[1]}”
        </p>
      )}
      {deep && n && n.cites.length > 0 && (
        <Commentary line="Christian writers also name this fulfilment." button="Show what they wrote">
          <Writers a={a} cites={n.cites} writers={p.writers} />
        </Commentary>
      )}
      {deep && notes === undefined && <p class="xt-wait">…</p>}
    </div>
  );
}

/** Every pair, by the book of its prophecy, as links. */
function Every({ a, d, navigate }: { a: Atlas; d: Data; navigate: (v: VerseRef) => void }) {
  const all = writersShown() ? d.pairs : d.pairs.filter((p) => p.says);
  const books = new Map<number, Pair[]>();
  for (const p of all) {
    const b = a.verseBook[p.ot];
    const list = books.get(b);
    if (list) list.push(p);
    else books.set(b, [p]);
  }
  return (
    <details class="x-prophecies-every">
      <summary>Every prophecy and fulfilment here ({all.length})</summary>
      {[...books].map(([b, ps]) => (
        <section key={b}>
          <h4>{a.books[b].name}</h4>
          <ul>
            {ps.map((p) => (
              <li key={p.i}>
                <button type="button" class="xt-pref" onClick={() => navigate(p.ot)}>
                  {refName(a, p.ot, p.otTo)}
                </button>{' '}
                fulfilled in{' '}
                <button type="button" class="xt-pref" onClick={() => navigate(p.nt)}>
                  {refName(a, p.nt, p.ntTo)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </details>
  );
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const ps = pairsAt(data, verse);
  const notes = useJson<NotesFile>(a, 'extras/prophecies/notes.json');
  const ot = isOt(a, verse);
  const said = ps.filter((p) => p.says).length;
  const lead = ot
    ? said
      ? 'The New Testament says this was fulfilled.'
      : 'Christian writers say this was fulfilled.'
    : said
      ? 'The New Testament says this fulfils an older passage.'
      : 'Christian writers say this fulfils an older passage.';
  return (
    <>
      <Lead>{lead}</Lead>
      {ps.map((p) => (
        <One key={p.i} a={a} p={p} notes={notes} navigate={navigate} />
      ))}
      {levelAtLeast('study') && <Every a={a} d={data} navigate={navigate} />}
      {levelAtLeast('deep') && <CommentaryFoot />}
      <SourceNote>{SOURCE}</SourceNote>
    </>
  );
}
