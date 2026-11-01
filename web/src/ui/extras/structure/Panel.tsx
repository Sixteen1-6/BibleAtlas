// The panel behind "How it is built": one section per structure over the
// verse. Each has its plain name and how widely the writers agree, one plain
// sentence, its parts drawn as arcs on the small night sky (bookends as one
// arc from first to last, a mirror's arcs inside one another, a refrain's or
// turn's arcs from each return to the next), then a ladder of the parts with
// the BSB words and the words they share underlined; a foil's two people sit
// in two columns. Then the writers who name it, each in his own words.

import { useState } from 'preact/hooks';
import { type Atlas, locate } from '../../../data/atlas';
import { CommentaryFoot } from '../../commentary/Gate';
import { Writers } from '../figures/Panel';
import { type StripArc, type Tick, Strip } from '../figures/Strip';
import { Lead, Passage, SideBySide, SourceNote, Unsure, refName } from '../kit';
import type { PanelProps, VerseRef } from '../types';
import { type Data, type Member, type Note, type Side, SOURCE, notesAt } from './model';

const primed = (m: string) => m.replace(/'/g, '′');

/** Members that answer one another: A with A', every R, every A of a turn. */
function groupOf(note: Note, m: Member): string {
  return note.kind === 'refrain' ? 'R' : m.mark.replace(/'/g, '');
}

/** How far in a ladder row sits: a mirror steps in toward its centre and back
 * out (four steps at most, so it holds at phone width); turns indent their
 * second thread. */
function indent(note: Note, i: number, n: number): number {
  if (note.kind === 'chiasm') return Math.min(i, n - 1 - i, 3);
  if (note.kind === 'alternation') {
    const letters = [...new Set((note.members ?? []).map((m) => m.mark))];
    return Math.min(letters.indexOf((note.members ?? [])[i].mark), 3);
  }
  return 0;
}

/** The arcs between members: the first and last of a mirror's pairs, and
 * each return of a refrain or a turn joined to the one before. */
function arcsOf(note: Note): { arcs: StripArc[]; groups: string[] } {
  const ms = note.members ?? [];
  const groups = [...new Set(ms.map((m) => groupOf(note, m)))];
  const arcs: StripArc[] = [];
  if (note.kind === 'inclusio' || note.kind === 'chiasm') {
    for (let i = 0; i < Math.floor(ms.length / 2); i++) arcs.push({ from: i, to: ms.length - 1 - i, style: 'solid', pair: groups.indexOf(groupOf(note, ms[i])) });
  } else {
    const last = new Map<string, number>();
    ms.forEach((m, i) => {
      const g = groupOf(note, m);
      const p = last.get(g);
      if (p !== undefined) arcs.push({ from: p, to: i, style: 'solid', pair: groups.indexOf(g) });
      last.set(g, i);
    });
  }
  return { arcs, groups };
}

/** "8:1", or "Psalm 43:5" when the structure crosses into another chapter's
 * book name; ranges as "2:12–17". */
function tickLabel(a: Atlas, m: Member): string {
  const s = locate(a, m.s);
  const e = locate(a, m.e);
  if (m.s === m.e) return `${s.chapter}:${s.verse}`;
  return s.chapter === e.chapter ? `${s.chapter}:${s.verse}–${e.verse}` : `${s.chapter}:${s.verse}–${e.chapter}:${e.verse}`;
}

/** The member's words with its group's shared words underlined. */
function Tied({ t, tie, lit }: { t: string; tie?: string; lit: boolean }) {
  const i = tie ? t.indexOf(tie) : -1;
  if (!tie || i < 0) return <>{t}</>;
  return (
    <>
      {t.slice(0, i)}
      <mark class={`x-structure-tie${lit ? ' lit' : ''}`}>{tie}</mark>
      {t.slice(i + tie.length)}
    </>
  );
}

function Members({ a, note, verse, navigate }: { a: Atlas; note: Note; verse: VerseRef; navigate: (v: VerseRef) => void }) {
  const ms = note.members ?? [];
  const [hover, setHover] = useState<number | null>(null);
  const [pin, setPin] = useState<number | null>(null);
  const lit = hover ?? pin;
  const { arcs, groups } = arcsOf(note);
  const ties = new Map<string, string>();
  for (const m of ms) if (m.tie) ties.set(groupOf(note, m), m.tie);
  const ticks: Tick[] = ms.map((m) => ({ label: tickLabel(a, m), letter: primed(m.mark), here: verse >= m.s && verse <= m.e }));
  const centre = note.kind === 'chiasm' && ms.length % 2 === 1 ? Math.floor(ms.length / 2) : undefined;
  const label = `${ms.length} parts, ${ms.map((m) => primed(m.mark)).join(' ')}, from ${refName(a, note.v, note.end)}`;
  return (
    <>
      <Strip ticks={ticks} arcs={arcs} centre={centre} label={label} lit={lit} onLight={setHover} />
      <ol class="x-structure-ladder">
        {ms.map((m, i) => {
          const g = groups.indexOf(groupOf(note, m));
          const on = lit === g;
          return (
            <li key={i} class={on ? 'lit' : undefined} style={`--step:${indent(note, i, ms.length)}`}>
              <button
                type="button"
                class="x-structure-mark"
                aria-pressed={pin === g}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(g)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
                onFocus={() => setHover(g)}
                onBlur={() => setHover(null)}
                onClick={() => setPin(pin === g ? null : g)}
                title="Light the parts that answer this one"
              >
                {primed(m.mark)}
                <span class="sr-only">, light the parts marked the same</span>
              </button>
              <div>
                <button type="button" class="x-structure-ref" onClick={() => navigate(m.v)}>
                  {refName(a, m.s, m.e)}
                </button>
                <p class="x-structure-words">
                  <Tied t={m.t} tie={ties.get(groupOf(note, m))} lit={on} />
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {ties.size > 0 && <p class="x-structure-hint">The underlined words are in each part that answers it.</p>}
    </>
  );
}

function SideColumn({ a, side, navigate }: { a: Atlas; side: Side; navigate: (v: VerseRef) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div class="x-structure-side">
      <h4>
        {side.who}
        <span class="x-structure-label">{side.label}</span>
      </h4>
      <ul>
        {side.w.map((w, i) => (
          <li key={i}>
            <p class="x-structure-words">{w.t}</p>
            <button type="button" class="x-structure-ref" onClick={() => navigate(w.v)}>
              {refName(a, w.v)}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" class="x-figures-more" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide the verses' : `Read ${side.r.length > 1 ? 'all the verses' : 'the verses'}`} <span aria-hidden="true">{open ? '‹' : '›'}</span>
      </button>
      {open && side.r.map(([s, e]) => <Passage key={s} a={a} from={s} to={e} navigate={navigate} />)}
    </div>
  );
}

function Foil({ a, note, navigate }: { a: Atlas; note: Note; navigate: (v: VerseRef) => void }) {
  const sides = note.sides ?? [];
  const label = sides.map((s) => `${s.who}, ${s.r.map(([x, y]) => refName(a, x, y)).join(' and ')}`).join('; set beside ');
  return (
    <>
      <p class="sr-only">{label}</p>
      <SideBySide>
        {sides.map((s) => (
          <SideColumn key={s.who} a={a} side={s} navigate={navigate} />
        ))}
      </SideBySide>
    </>
  );
}

function Entry({ a, data, note, verse, navigate }: { a: Atlas; data: Data; note: Note; verse: VerseRef; navigate: (v: VerseRef) => void }) {
  const kind = data.kinds[note.kind];
  const n = note.writers ?? new Set(note.cites.map((c) => c.by ?? c.name)).size;
  return (
    <section class="x-figures-entry x-structure-entry" aria-labelledby={`sx-${note.id}`}>
      <h3 id={`sx-${note.id}`} tabIndex={-1}>
        {kind?.label ?? note.kind}
        <span class="x-figures-strength">
          {note.strength} · {n} {n === 1 ? 'writer' : 'writers'}
        </span>
        {note.strength === 'some interpreters' && <Unsure>a pattern some readers see</Unsure>}
      </h3>
      <Lead>{note.about}</Lead>
      {note.members && <Members a={a} note={note} verse={verse} navigate={navigate} />}
      {note.sides && <Foil a={a} note={note} navigate={navigate} />}
      {kind && <p class="x-structure-what">{kind.about}</p>}
      <Writers note={note} />
      <p class="x-figures-foot">Checked against the source{note.checked && ` on ${note.checked}`}: the BSB words and each writer’s quotation.</p>
    </section>
  );
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const notes = notesAt(data, verse);
  if (notes === null) return <p class="xt-lead xt-wait">…</p>;
  if (!notes.length) return <Lead>This verse is not part of a structure here.</Lead>;
  return (
    <>
      {notes.map((n) => (
        <Entry key={n.id} a={a} data={data} note={n} verse={verse} navigate={navigate} />
      ))}
      <CommentaryFoot />
      <SourceNote>{SOURCE}</SourceNote>
    </>
  );
}
