// The panel behind "Patterns": one section per pattern over the verse. Each
// has its plain name and how widely the writers agree, one plain sentence,
// then what it shows in the BSB's words:
//   a detail that fits: its passages side by side, each with its lines;
//   a key word: how often its root comes in the passage (counted by the
//     build), and each verse it comes in with the word marked;
//   a repeated scene: each telling, part by part; a tap on a part lights it
//     in every telling.
// Then the writers who name it, each in his own words.

import { useState } from 'preact/hooks';
import type { Atlas } from '../../../data/atlas';
import { CommentaryFoot } from '../../commentary/Gate';
import { Writers } from '../figures/Panel';
import { Lead, Passage, SideBySide, SourceNote, Unsure, openWord, refName, usePassage } from '../kit';
import type { PanelProps, VerseRef } from '../types';
import { type Data, type Key, type Note, type Side, type Telling, type Words, SOURCE, notesAt } from './model';

/** The most verses a key word lists before "Show all". */
const KEY_FIRST = 6;

/** A verse's BSB text with some of its words marked. */
function Marked({ text, marks }: { text: string; marks: readonly Words[] }) {
  const ms = [...marks].sort((p, q) => p.at - q.at);
  const out = [];
  let at = 0;
  ms.forEach((m, i) => {
    if (m.at < at || text.slice(m.at, m.at + m.t.length) !== m.t) return;
    out.push(text.slice(at, m.at));
    out.push(
      <mark key={i} class="x-patterns-mark">
        {m.t}
      </mark>,
    );
    at = m.at + m.t.length;
  });
  out.push(text.slice(at));
  return <>{out}</>;
}

function SideColumn({ a, side, navigate }: { a: Atlas; side: Side; navigate: (v: VerseRef) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div class="x-patterns-side">
      <h4>{side.label}</h4>
      <button type="button" class="x-patterns-ref" onClick={() => navigate(side.s)}>
        {refName(a, side.s, side.e)}
      </button>
      <ul>
        {side.w.map((w, i) => (
          <li key={i}>
            <p class="x-patterns-words">{w.t}</p>
          </li>
        ))}
      </ul>
      <button type="button" class="x-figures-more" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide the verses' : 'Read the verses'} <span aria-hidden="true">{open ? '‹' : '›'}</span>
      </button>
      {open && <Passage a={a} from={side.s} to={side.e} navigate={navigate} />}
    </div>
  );
}

function Sides({ a, note, navigate }: { a: Atlas; note: Note; navigate: (v: VerseRef) => void }) {
  const sides = note.sides ?? [];
  return (
    <>
      <p class="sr-only">{sides.map((s) => `${s.label}, ${refName(a, s.s, s.e)}`).join('; set beside ')}</p>
      <SideBySide>
        {sides.map((s) => (
          <SideColumn key={s.s} a={a} side={s} navigate={navigate} />
        ))}
      </SideBySide>
    </>
  );
}

function KeyWord({ a, k, navigate }: { a: Atlas; k: Key; navigate: (v: VerseRef) => void }) {
  const rows = usePassage(a, k.s, k.e);
  const [all, setAll] = useState(false);
  const shown = all ? k.verses : k.verses.slice(0, KEY_FIRST);
  const first = k.words[0];
  const forms = k.forms.map((f) => `“${f}”`);
  const formList = forms.length > 1 ? `${forms.slice(0, -1).join(', ')} or ${forms[forms.length - 1]}` : forms[0];
  return (
    <div class="x-patterns-key">
      <p class="x-patterns-count">
        {k.lang}, the word comes <strong>{k.n} times</strong> in {refName(a, k.s, k.e)}, in {k.verses.length} {k.verses.length === 1 ? 'verse' : 'verses'}. The BSB gives it as {formList}.
      </p>
      <ul class="x-patterns-verses">
        {shown.map((v) => {
          const row = rows?.[v - k.s];
          return (
            <li key={v}>
              <button type="button" class="x-patterns-ref" onClick={() => navigate(v)}>
                {refName(a, v)}
              </button>
              <p class="x-patterns-words">{row ? <Marked text={row[0]} marks={k.marks.filter((m) => m.v === v)} /> : '…'}</p>
            </li>
          );
        })}
      </ul>
      {k.verses.length > KEY_FIRST && (
        <button type="button" class="x-figures-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${k.verses.length} verses`} <span aria-hidden="true">{all ? '‹' : '›'}</span>
        </button>
      )}
      {first && (
        <button type="button" class="x-figures-more" onClick={() => openWord(first[2], first[0], first[1])}>
          Study the word <span aria-hidden="true">›</span>
        </button>
      )}
      <p class="x-patterns-hint">Marked: the BSB words in the verses where the word comes. A form outside those verses renders another word, so it is not marked.</p>
    </div>
  );
}

function TellingCard({ a, note, t, lit, navigate }: { a: Atlas; note: Note; t: Telling; lit: string | null; navigate: (v: VerseRef) => void }) {
  return (
    <li class="x-patterns-telling">
      <h4>
        {t.who}{' '}
        <button type="button" class="x-patterns-ref" onClick={() => navigate(t.s)}>
          {refName(a, t.s, t.e)}
        </button>
      </h4>
      <dl>
        {(note.parts ?? []).map((p) => {
          const w = t.w[p.id];
          if (!w) return null;
          return (
            <div key={p.id} class={lit === p.id ? 'lit' : undefined}>
              <dt>{p.label}</dt>
              <dd>
                <button type="button" class="x-patterns-words x-patterns-plain" onClick={() => navigate(w.v)} title={`Read ${refName(a, w.v)}`}>
                  {w.t}
                </button>
              </dd>
            </div>
          );
        })}
      </dl>
    </li>
  );
}

function Scene({ a, note, navigate }: { a: Atlas; note: Note; navigate: (v: VerseRef) => void }) {
  const [lit, setLit] = useState<string | null>(null);
  const parts = note.parts ?? [];
  const tellings = note.scenes ?? [];
  return (
    <>
      <p class="x-patterns-hint">Tap a part to light it in every telling.</p>
      <div class="x-patterns-parts" role="group" aria-label="The parts of the scene">
        {parts.map((p, i) => {
          const n = tellings.filter((t) => t.w[p.id]).length;
          return (
            <button key={p.id} type="button" aria-pressed={lit === p.id} onClick={() => setLit(lit === p.id ? null : p.id)}>
              <span aria-hidden="true">{i + 1}. </span>
              {p.label}
              <span class="sr-only">, in {n} of the {tellings.length} tellings</span>
            </button>
          );
        })}
      </div>
      <ol class="x-patterns-tellings">
        {tellings.map((t) => (
          <TellingCard key={t.s} a={a} note={note} t={t} lit={lit} navigate={navigate} />
        ))}
      </ol>
    </>
  );
}

function Entry({ a, data, note, navigate }: { a: Atlas; data: Data; note: Note; navigate: (v: VerseRef) => void }) {
  const kind = data.kinds[note.kind];
  const n = note.writers ?? new Set(note.cites.map((c) => c.by ?? c.name)).size;
  return (
    <section class="x-figures-entry x-patterns-entry" aria-labelledby={`px-${note.id}`}>
      <h3 id={`px-${note.id}`} tabIndex={-1}>
        {kind?.label ?? note.kind}
        <span class="x-figures-strength">
          {note.strength} · {n} {n === 1 ? 'writer' : 'writers'}
        </span>
        {note.strength === 'some interpreters' && <Unsure>a pattern some readers see</Unsure>}
      </h3>
      <Lead>{note.about}</Lead>
      {note.sides && <Sides a={a} note={note} navigate={navigate} />}
      {note.key && <KeyWord a={a} k={note.key} navigate={navigate} />}
      {note.scenes && <Scene a={a} note={note} navigate={navigate} />}
      {kind && <p class="x-patterns-what">{kind.about}</p>}
      <Writers note={note} />
      <p class="x-figures-foot">Checked against the source{note.checked && ` on ${note.checked}`}: the BSB words and each writer’s quotation.</p>
    </section>
  );
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const notes = notesAt(data, verse);
  if (notes === null) return <p class="xt-lead xt-wait">…</p>;
  if (!notes.length) return <Lead>No pattern is noted on this verse.</Lead>;
  return (
    <>
      {notes.map((n) => (
        <Entry key={n.id} a={a} data={data} note={n} navigate={navigate} />
      ))}
      <CommentaryFoot />
      <SourceNote>{SOURCE}</SourceNote>
    </>
  );
}
