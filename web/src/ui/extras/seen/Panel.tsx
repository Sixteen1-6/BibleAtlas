// The panel behind "Seen in the words": one section per figure the verse's
// own words show. Each has the figure's plain name and its own term, one plain
// sentence on what it is, then the verse with the words that show it marked
// (for lines, the BSB's own poetry lines, one under another), the Hebrew or
// Greek words when the figure is in the original, and what the figure is in
// Bullinger's words. No writer is quoted for the place itself, so there is no
// strength label, and nothing says who or what found it.

import type { ComponentChildren } from 'preact';
import type { Atlas } from '../../../data/atlas';
import { CommentaryFoot } from '../../commentary/Gate';
import { OrigLine, RootChip } from '../../common';
import type { Form } from '../figures/model';
import { rootsFor } from '../figures/model';
import { Lead, SourceNote, refName, usePassage } from '../kit';
import type { PanelProps, VerseRef } from '../types';
import { type Data, type Note, SOURCE, notesAt } from './model';

/** The spans of a verse's text that the words cover, in order and apart. */
function spans(t: string, words: readonly string[]): [number, number][] {
  const out: [number, number][] = [];
  for (const w of words) {
    const at = t.indexOf(w);
    if (at >= 0 && w) out.push([at, at + w.length]);
  }
  out.sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  return merged;
}

function Marked({ t, words }: { t: string; words: readonly string[] }) {
  const ss = spans(t, words);
  const out: ComponentChildren[] = [];
  let at = 0;
  ss.forEach(([s, e], i) => {
    if (s > at) out.push(t.slice(at, s));
    out.push(
      <mark key={i} class="x-seen-mark">
        {t.slice(s, e)}
      </mark>,
    );
    at = e;
  });
  if (at < t.length) out.push(t.slice(at));
  return <>{out}</>;
}

/** The verses of the place, each with its words marked. Lines are shown one
 * under another, as the BSB sets them. */
function Words({ a, note, form, navigate }: { a: Atlas; note: Note; form: Form; navigate: (v: VerseRef) => void }) {
  const end = note.e ?? note.v;
  const rows = usePassage(a, note.v, end);
  if (!rows) return <p class="xt-lead xt-wait">…</p>;
  const lines = form.kind === 'parallelism' && !note.whole;
  return (
    <div class="x-seen-verses">
      {rows.map((row, i) => {
        const v = note.v + i;
        const t = row[0];
        const mine = note.words.filter((w) => t.includes(w));
        return (
          <div key={v} class="x-seen-verse">
            <button type="button" class="x-seen-ref" onClick={() => navigate(v)}>
              {refName(a, v)}
            </button>
            {lines && mine.length > 1 ? (
              <ol class="x-seen-lines">
                {mine.map((w, k) => (
                  <li key={k}>{w}</li>
                ))}
              </ol>
            ) : (
              <p class="x-seen-text">{note.whole ? t : <Marked t={t} words={mine} />}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Original({ a, note }: { a: Atlas; note: Note }) {
  const rows = usePassage(a, note.v);
  const row = rows?.[0];
  if (!note.original?.length || !row || !row[1].length) return null;
  const want = new Set(rootsFor(a, note.original));
  const roots: number[] = [];
  for (const w of row[1]) if (want.has(w[3]) && !roots.includes(w[3])) roots.push(w[3]);
  if (!roots.length) return null;
  const he = a.books[a.verseBook[note.v]].testament === 'OT';
  return (
    <div class="x-figures-orig">
      <p>In the {he ? 'Hebrew' : 'Greek'}, the marked words show it.</p>
      <OrigLine a={a} v={note.v} row={row} mark={new Set(roots)} />
      <div class="chips">
        {roots.map((r) => (
          <RootChip key={r} a={a} root={r} />
        ))}
      </div>
    </div>
  );
}

function Defined({ form }: { form: Form }) {
  const d = form.defined;
  if (!d) return null;
  return (
    <details class="x-figures-evidence">
      <summary>What this figure is, in Bullinger’s words</summary>
      <blockquote>“{d.quote}”</blockquote>
      <p class="x-figures-credit">
        {d.by ?? 'E. W. Bullinger'},{' '}
        <a href={d.url} target="_blank" rel="noopener noreferrer">
          {d.at}
          <span class="sr-only"> (opens a new tab)</span> <span aria-hidden="true">↗</span>
        </a>
      </p>
      {d.read && (
        <p class="x-figures-credit">
          Read in {d.read}
          {d.retrieved && `, ${d.retrieved}`}.
        </p>
      )}
    </details>
  );
}

function Entry({ a, data, note, navigate }: { a: Atlas; data: Data; note: Note; navigate: (v: VerseRef) => void }) {
  const form = data.forms[note.form];
  return (
    <section class="x-figures-entry x-seen-entry" aria-labelledby={`sn-${note.id}`}>
      <h3 id={`sn-${note.id}`} tabIndex={-1}>
        {form.label}
        {form.term && form.term !== form.label && <span class="x-figures-strength">{form.term}</span>}
      </h3>
      <Lead>{form.about}</Lead>
      <Words a={a} note={note} form={form} navigate={navigate} />
      <Original a={a} note={note} />
      <Defined form={form} />
    </section>
  );
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const notes = notesAt(data, verse);
  if (notes === null) return <p class="xt-lead xt-wait">…</p>;
  if (!notes.length) return <Lead>This verse has no figure marked in its words.</Lead>;
  return (
    <>
      <p class="x-seen-intro">No writer is quoted here. The marked words are the Bible’s own, and they show the figure.</p>
      {notes.map((n) => (
        <Entry key={n.id} a={a} data={data} note={n} navigate={navigate} />
      ))}
      <CommentaryFoot />
      <SourceNote>{SOURCE}</SourceNote>
    </>
  );
}
