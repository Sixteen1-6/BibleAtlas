// The panel behind the "Life in Bible times" line: each of Freeman's entries
// on the verse, in his own words, never as the app's own claim. Study: the
// King James words he explains, then his entry, long ones folded behind
// "Read all". Deep adds who he was and where the text was read. It shows only
// once the reader has finished the commentary notice (VerseExtras.tsx shows
// its closed state until then).

import { useState } from 'preact/hooks';
import type { Atlas } from '../../../data/atlas';
import { CommentaryFoot } from '../../commentary/Gate';
import { useJson } from '../data';
import { Facts, Lead, SourceNote, refName, verseHash } from '../kit';
import { levelAtLeast } from '../level';
import type { PanelProps, VerseRef } from '../types';
import { type BookFile, type Data, type Entry, type Run, SOURCE, filesFor } from './model';

/** About this many characters of a long entry show before "Read all". */
const FOLD = 600;

function runLength(r: Run): number {
  return typeof r === 'string' ? r.length : r[2].length;
}

/** The first `limit` characters or so, cut at a word. */
function clip(ps: Run[][], limit: number): Run[][] {
  const out: Run[][] = [];
  let left = limit;
  for (const p of ps) {
    const q: Run[] = [];
    for (const r of p) {
      if (left <= 0) break;
      if (typeof r !== 'string' || r.length <= left) {
        q.push(r);
        left -= runLength(r);
        continue;
      }
      const cut = r.lastIndexOf(' ', left);
      q.push(r.slice(0, cut > left / 2 ? cut : left).replace(/[\s,;:]+$/, ''));
      left = 0;
    }
    if (q.length) out.push(q);
    if (left <= 0) break;
  }
  return out;
}

function Runs({ a, runs, navigate }: { a: Atlas; runs: Run[]; navigate: (v: VerseRef) => void }) {
  return (
    <>
      {runs.map((r, k) => {
        if (typeof r === 'string') return r;
        const [from, to, text] = r;
        return (
          <a
            key={k}
            class="x-customs-ref"
            href={verseHash(a, from)}
            data-lv={from}
            onClick={(e) => {
              e.preventDefault();
              navigate(from);
            }}
            title={`Read ${refName(a, from, to)}`}
          >
            {text}
          </a>
        );
      })}
    </>
  );
}

function Item({ a, e, navigate }: { a: Atlas; e: Entry; navigate: (v: VerseRef) => void }) {
  const [open, setOpen] = useState(false);
  const long = e.text.reduce((n, p) => n + p.reduce((m, r) => m + runLength(r), 0), 0) > FOLD * 1.25;
  const shown = long && !open ? clip(e.text, FOLD) : e.text;
  const on = e.at.map(([f, t]) => refName(a, f, t)).join(' and ');
  return (
    <article class="x-customs-entry">
      <h3 class="x-customs-title">{e.title}</h3>
      <p class="x-customs-quote">
        <span class="x-customs-on">{on}, as Freeman quotes it (KJV): </span>“{e.quote}”
      </p>
      {shown.map((p, k) => (
        <p key={k} class="x-customs-p">
          <Runs a={a} runs={p} navigate={navigate} />
          {long && !open && k === shown.length - 1 ? '…' : ''}
        </p>
      ))}
      {long && (
        <button type="button" class="x-customs-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Show less' : 'Read all'}
        </button>
      )}
      <p class="x-customs-from">
        James M. Freeman, Hand-Book of Bible Manners and Customs (1874), no. {e.no}
      </p>
    </article>
  );
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const file = useJson<BookFile>(a, filesFor(data, verse)[0] ?? null);
  if (file === null) return <p class="xt-lead">Sorry, these notes could not be shown right now.</p>;
  if (file === undefined) return <p class="xt-lead xt-wait">…</p>;
  const list = file.entries.filter((e) => e.at.some(([f, t]) => f <= verse && verse <= t));
  return (
    <>
      <Lead>
        The way of life behind {refName(a, verse)}, as its first hearers knew it, explained by James M. Freeman, a Methodist minister, in 1874. These are his words, not the Bible’s, and some of what was known in his day has since been learned more fully.
      </Lead>
      {list.map((e) => (
        <Item key={e.no} a={a} e={e} navigate={navigate} />
      ))}
      {levelAtLeast('deep') && (
        <Facts
          rows={[
            ['Writer', 'James Midwinter Freeman (1827–1900), a Methodist Episcopal minister and assistant editor of his church’s Sunday-school publications'],
            ['The book', 'Hand-Book of Bible Manners and Customs, New York: Nelson and Phillips, 1874. 891 short entries in Bible order, each headed by the verse it explains.'],
            [
              'Where it was read',
              <>
                Bible Truth Publishers’ transcription, which its own note says was not proofread, as kept in the UniqueBible.app module on GitHub (darrelwright/UniqueBible_Books, commit 4017a67), read on 1 November 2026. The title page and the first entry were checked against the source, the{' '}
                <a href="https://archive.org/details/handbookofbiblem00free" target="_blank" rel="noopener noreferrer">
                  Library of Congress copy of the 1874 printing
                </a>
                , on 1 November 2026. Letters in Greek and Hebrew words may be misread.
              </>,
            ],
            ['How entries are placed', 'Each entry is shown under the verses Freeman heads it with, and only where those verses hold the King James words he prints under the heading.'],
          ]}
        />
      )}
      <CommentaryFoot />
      <SourceNote>{SOURCE}</SourceNote>
    </>
  );
}
