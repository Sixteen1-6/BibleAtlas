// The panel behind "How it is written": one section per note on the verse.
// Each has the form's plain name and how widely the writers agree, one plain
// sentence, the arcs on a small night sky, the BSB words in their lines with
// the answering words marked (pointing at one lights its partner and its arc),
// the Hebrew or Greek words, what the form is in its source's own words with
// the page, and the writers who name it, each opened by the reader in his own
// words. The first note is open; later ones show their lines on a tap.

import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { type Atlas, label, locate } from '../../../data/atlas';
import type { VerseRow } from '../../../data/text';
import { CommentaryFoot } from '../../commentary/Gate';
import { OrigLine, RootChip } from '../../common';
import { Lead, SourceNote, Unsure, refName, usePassage } from '../kit';
import type { PanelProps, VerseRef } from '../types';
import { type Cite, type Data, type Form, type Line, type Note, SOURCE, notesAt, quoted, rootsFor, writerCount } from './model';
import { type StripArc, type Tick, Strip } from './Strip';

const REPO = 'https://github.com/Sixteen1-6/BibleAtlas';

/** Curly quotes and apostrophes, as the other panels show them. */
function smart(t: string): string {
  return t
    .replace(/(^|[\s(\[—–-])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s(\[—–-])'/g, '$1‘')
    .replace(/'/g, '’');
}

function list(xs: readonly string[]): string {
  return xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/** A, B, C for pair 0, 1, 2; the answering word is primed. */
const letter = (pair: number, second: boolean) => `${String.fromCharCode(65 + (pair % 26))}${second ? '′' : ''}`;
const primed = (m: string) => m.replace(/'/g, '′');

// ------------------------------------------------------------ lines and marks

interface Mark {
  /** Offset in the line's text. */
  at: number;
  len: number;
  pair: number;
  second: boolean;
}

/** Find a word or phrase in a line, as a whole word. */
function find(t: string, words: string): number {
  const re = new RegExp(`(^|[^A-Za-z’'])(${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![A-Za-z])`);
  const m = re.exec(t);
  return m ? m.index + m[1].length : -1;
}

/** Each pair's two words, found in two different lines: first in an earlier
 * line, its answer in a later one. Pairs not found are left out. */
function marksOf(lines: Line[], pairs: [string, string][]): Mark[][] {
  const out: Mark[][] = lines.map(() => []);
  pairs.forEach(([p, q], k) => {
    for (let i = 0; i < lines.length; i++) {
      const a = find(lines[i].t, p);
      if (a < 0) continue;
      for (let j = i + 1; j < lines.length; j++) {
        const b = find(lines[j].t, q);
        if (b < 0) continue;
        out[i].push({ at: a, len: p.length, pair: k, second: false });
        out[j].push({ at: b, len: q.length, pair: k, second: true });
        return;
      }
    }
    // The answer may come first in the verse ("perish ... guards").
    for (let i = 0; i < lines.length; i++) {
      const b = find(lines[i].t, q);
      if (b < 0) continue;
      for (let j = i + 1; j < lines.length; j++) {
        const a = find(lines[j].t, p);
        if (a < 0) continue;
        out[i].push({ at: b, len: q.length, pair: k, second: false });
        out[j].push({ at: a, len: p.length, pair: k, second: true });
        return;
      }
    }
  });
  for (const ms of out) ms.sort((x, y) => x.at - y.at);
  // Letter the pairs in reading order: A is the first word marked.
  const order: number[] = [];
  for (const ms of out) for (const m of ms) if (!order.includes(m.pair)) order.push(m.pair);
  for (const ms of out) for (const m of ms) m.pair = order.indexOf(m.pair);
  return out;
}

/** Line marks that pair up: A with A′, B with B′. */
function linePairs(lines: Line[]): [number, number][] {
  const out: [number, number][] = [];
  lines.forEach((l, i) => {
    if (!l.mark || l.mark.endsWith("'")) return;
    const j = lines.findIndex((m) => m.mark === `${l.mark}'`);
    if (j > i) out.push([i, j]);
  });
  return out;
}

interface Light {
  /** The pair shown now: pointed at, else pinned. */
  lit: number | null;
  /** The pair a tap or click pinned. */
  pin: number | null;
  onLight: (p: number | null) => void;
  onPin: (p: number | null) => void;
}

function Marked({ t, marks, light }: { t: string; marks: Mark[]; light: Light }) {
  const { lit, pin, onLight, onPin } = light;
  const parts: ComponentChildren[] = [];
  let at = 0;
  for (const m of marks) {
    if (m.at < at) continue;
    parts.push(smart(t.slice(at, m.at)));
    const on = lit === m.pair;
    const pinned = pin === m.pair;
    parts.push(
      <button
        type="button"
        class={`x-figures-w${on ? ' lit' : ''}`}
        onPointerEnter={(e) => e.pointerType === 'mouse' && onLight(m.pair)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && onLight(null)}
        onFocus={() => onLight(m.pair)}
        onBlur={() => onLight(null)}
        onClick={() => onPin(pinned ? null : m.pair)}
        aria-pressed={pinned}
        title={m.second ? 'Answers the word marked with the same letter' : 'Answered by the word marked with the same letter'}
      >
        {smart(t.slice(m.at, m.at + m.len))}
        <sup aria-hidden="true">{letter(m.pair, m.second)}</sup>
        <span class="sr-only">, {m.second ? 'answers' : 'answered by'} the word marked {letter(m.pair, !m.second)}</span>
      </button>,
    );
    at = m.at + m.len;
  }
  parts.push(smart(t.slice(at)));
  return <>{parts}</>;
}

/** How far a line is set in: a mirror steps in to its turn and back out; other
 * lines alternate as the BSB prints them. */
function indent(form: string, i: number, n: number): number {
  if (form === 'mirror') return Math.min(3, i < n / 2 ? i : n - 1 - i);
  if (form === 'building') return Math.min(3, i);
  return i % 2;
}

function Ladder({ a, note, marks, light, navigate }: { a: Atlas; note: Note; marks: Mark[][]; light: Light; navigate: (v: VerseRef) => void }) {
  const { lit, onLight } = light;
  const lines = note.lines ?? [];
  const pairs = linePairs(lines);
  const pairOf = (i: number) => pairs.findIndex(([p, q]) => p === i || q === i);
  let last = -1;
  return (
    <div class="x-figures-ladder">
      {lines.map((l, i) => {
        const showV = l.v !== last;
        last = l.v;
        const lp = pairOf(i);
        const on = lp >= 0 && lit === 100 + lp;
        return (
          <p key={i} class={`x-figures-line${on ? ' lit' : ''}`} style={`--step:${indent(note.form, i, lines.length)}`}>
            {showV && (
              <button type="button" class="x-figures-v" onClick={() => navigate(l.v)} title={`Read ${label(a, l.v)} in its chapter`} aria-label={`Read ${label(a, l.v)} in its chapter`}>
                {locate(a, l.v).verse}
              </button>
            )}
            {l.mark && (
              <span class="x-figures-mark" onPointerEnter={() => lp >= 0 && onLight(100 + lp)} onPointerLeave={() => onLight(null)}>
                <span class="sr-only">Line </span>
                {primed(l.mark)}
              </span>
            )}
            <Marked t={l.t} marks={marks[i] ?? []} light={light} />
          </p>
        );
      })}
    </div>
  );
}

/** The strip for parallel lines: one tick per marked word (or per line, for
 * lines marked A, B, B′, A′), and an arc for each pair. */
function ParallelStrip({ note, form, marks, light }: { note: Note; form: Form; marks: Mark[][]; light: Light }) {
  const { lit, onLight } = light;
  const lines = note.lines ?? [];
  const lp = linePairs(lines);
  if (lp.length) {
    const ticks: Tick[] = lines.map((l) => ({ label: l.key ?? '', letter: l.mark ? primed(l.mark) : undefined }));
    const arcs: StripArc[] = lp.map(([i, j], k) => ({ from: i, to: j, style: note.form === 'opposite' ? 'broken' : 'solid', pair: 100 + k }));
    const n = lines.length;
    const centre = note.form === 'mirror' && n % 2 === 0 ? (n - 1) / 2 : note.form === 'mirror' ? (n - 1) / 2 : undefined;
    return <Strip ticks={ticks} arcs={arcs} centre={centre} label={`${form.label}: ${lines.map((l) => l.mark ?? '').join(' ')}`} lit={lit} onLight={onLight} />;
  }
  const flat = marks.flatMap((ms, i) => ms.map((m) => ({ m, i, t: lines[i].t.slice(m.at, m.at + m.len) })));
  if (note.form === 'building' || flat.length < 2) {
    const ticks = lines.map((l, i) => ({ label: firstWords(l.t), letter: String(i + 1) }));
    const arcs: StripArc[] = note.form === 'building' ? [] : lines.slice(1).map((_, i) => ({ from: i, to: i + 1, style: 'solid', pair: 200 + i }));
    return <Strip ticks={ticks} arcs={arcs} stair={note.form === 'building'} label={`${form.label}: ${lines.length} lines`} lit={lit} onLight={onLight} />;
  }
  if (note.form === 'opposite') {
    // Each pair on its own, side by side, so they never nest like a mirror.
    const byPair = [...new Set(flat.map((f) => f.m.pair))].sort((p, q) => p - q);
    const ticks: Tick[] = [];
    const arcs: StripArc[] = [];
    for (const p of byPair) {
      const two = flat.filter((f) => f.m.pair === p).sort((x, y) => Number(x.m.second) - Number(y.m.second));
      if (two.length < 2) continue;
      arcs.push({ from: ticks.length, to: ticks.length + 1, style: 'broken', pair: p });
      for (const f of two.slice(0, 2)) ticks.push({ label: f.t, letter: letter(f.m.pair, f.m.second) });
    }
    return <Strip ticks={ticks} arcs={arcs} label={`${form.label}: ${byPair.map((p) => flat.filter((f) => f.m.pair === p).map((f) => f.t).join(' against ')).join('; ')}`} lit={light.lit} onLight={light.onLight} />;
  }
  const ticks: Tick[] = flat.map(({ m, t }) => ({ label: t, letter: letter(m.pair, m.second) }));
  const arcs: StripArc[] = [];
  const pairsSeen = new Set<number>();
  flat.forEach(({ m }, i) => {
    if (pairsSeen.has(m.pair)) return;
    pairsSeen.add(m.pair);
    const j = flat.findIndex((f, k) => k > i && f.m.pair === m.pair);
    if (j > i) arcs.push({ from: i, to: j, style: note.form === 'opposite' ? 'broken' : 'solid', pair: m.pair });
  });
  return <Strip ticks={ticks} arcs={arcs} label={`${form.label}: ${flat.map((f) => f.t).join(', ')}`} lit={lit} onLight={onLight} />;
}

/** The first word or two of a line, for the strip. */
function firstWords(t: string): string {
  const w = t.replace(/^(and|but|or|for|nor|then|so|that|the|make|otherwise)\s+/i, '').split(/\s+/);
  const s = w.slice(0, 2).join(' ').replace(/[,;:.!?]+$/, '');
  return s.length > 16 ? `${s.slice(0, 15)}…` : s;
}

// ------------------------------------------------------------ figures

function FigureBody({ a, note }: { a: Atlas; note: Note }) {
  const f = note.figure!;
  const rows = usePassage(a, f.v);
  const t = rows?.[0]?.[0] ?? null;
  const ok = t !== null && t.slice(f.at, f.at + f.words.length) === f.words;
  return (
    <div class="x-figures-fig">
      {t === null ? (
        <p class="x-figures-verse xt-wait">…</p>
      ) : (
        <p class="x-figures-verse">
          {ok ? (
            <>
              {smart(t.slice(0, f.at))}
              <mark class="x-figures-fw">{smart(f.words)}</mark>
              {smart(t.slice(f.at + f.words.length))}
            </>
          ) : (
            smart(t)
          )}
        </p>
      )}
      <p class="x-figures-means">
        <span class="x-figures-fw">“{smart(f.words)}”</span> <span aria-hidden="true">→</span> <span class="sr-only">stands for</span> {smart(f.means)}
      </p>
    </div>
  );
}

// ------------------------------------------------------------ two people

function ReadAcross({ a, note, navigate }: { a: Atlas; note: Note; navigate: (v: VerseRef) => void }) {
  const sides = note.sides ?? [];
  const lo = Math.min(...sides.map((s) => s.s));
  const hi = Math.max(...sides.map((s) => s.e));
  return (
    <div class="x-figures-across">
      {sides.map((s, i) => (
        <div key={i} class="x-figures-side">
          <h4>{s.who}</h4>
          {s.label && <p class="x-figures-sidelabel">{smart(s.label)}</p>}
          {s.t && <p class="x-figures-sidewords">“{smart(s.t)}”</p>}
          <button type="button" class="x-figures-ref" onClick={() => navigate(s.s)}>
            {refName(a, s.s, s.e)} <span aria-hidden="true">›</span>
          </button>
          {lo < hi && (
            <span class="x-figures-bar" aria-hidden="true">
              <span style={`left:${(((s.s - lo) / (hi - lo + 1)) * 100).toFixed(1)}%;width:${(((s.e - s.s + 1) / (hi - lo + 1)) * 100).toFixed(1)}%`} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function ContrastStrip({ a, note, verse, lit, onLight }: { a: Atlas; note: Note; verse: VerseRef; lit: number | null; onLight: (p: number | null) => void }) {
  const sides = note.sides ?? [];
  const lo = Math.min(...sides.map((s) => s.s));
  const hi = Math.max(...sides.map((s) => s.e));
  const n = Math.max(2, Math.min(hi - lo + 1, 40));
  const pos = (v: VerseRef) => ((v - lo) / Math.max(1, hi - lo)) * (n - 1);
  const ticks: Tick[] = Array.from({ length: n }, (_, i) => {
    const v = Math.round(lo + (i / (n - 1)) * (hi - lo));
    const first = i === 0 || i === n - 1;
    return { label: first ? String(locate(a, v).verse) : '', here: v === verse };
  });
  // From where one side starts to where the other does; if both start
  // together, across the whole passage.
  const s0 = sides.length === 2 ? Math.min(pos(sides[0].s), pos(sides[1].s)) : 0;
  const s1 = sides.length === 2 ? Math.max(pos(sides[0].s), pos(sides[1].s)) : 0;
  const arcs: StripArc[] = sides.length !== 2 ? [] : s1 > s0 ? [{ from: s0, to: s1, style: 'dashed', pair: 0 }] : [{ from: 0, to: n - 1, style: 'dashed', pair: 0 }];
  return (
    <Strip
      ticks={ticks}
      arcs={arcs}
      spans={sides.map((s) => ({ from: pos(s.s), to: pos(s.e), label: s.who }))}
      label={`Set side by side: ${list(sides.map((s) => s.who))}, ${refName(a, lo, hi)}`}
      lit={lit}
      onLight={onLight}
    />
  );
}

// ------------------------------------------------------------ sources

/** Which writers a reader opened, kept on this device. */
const OPEN_KEY = 'atlas.figures.open';
function openSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function saveOpen(s: Set<string>): void {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify([...s].slice(-200)));
  } catch {
    // Storage blocked: the choice lasts this visit.
  }
}

function Writers({ note }: { note: Note }) {
  const [open, setOpen] = useState<Set<string>>(openSet);
  const with_ = quoted(note);
  const toggle = (k: string) => {
    const next = new Set(open);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setOpen(next);
    saveOpen(next);
  };
  return (
    <div class="x-figures-writers">
      <h4>Who says so</h4>
      <p class="x-figures-named">Named by {list(with_.map((c) => c.name))}.</p>
      <ul>
        {with_.map((c, i) => {
          const k = `${note.id}:${c.name}`;
          if (with_.length === 1)
            return (
              <li key={i}>
                <p class="x-figures-who">
                  {c.name}
                  {c.on && <span class="x-figures-on"> on {c.on}</span>}
                </p>
                <Quote c={c} />
              </li>
            );
          const on = open.has(k);
          return (
            <li key={i}>
              <button type="button" class="x-figures-who" aria-expanded={on} onClick={() => toggle(k)}>
                {on ? 'Hide' : 'Show'} what {c.name} wrote
                {c.on && <span class="x-figures-on"> on {c.on}</span>}
                <span aria-hidden="true">{on ? ' ‹' : ' ›'}</span>
              </button>
              {on && <Quote c={c} />}
            </li>
          );
        })}
      </ul>
      {note.limit && (
        <>
          <h4>Where writers differ, or what this does not claim</h4>
          <p class="x-figures-limit">{smart(note.limit)}</p>
        </>
      )}
      {note.evidence && (
        <details class="x-figures-evidence">
          <summary>How the writers were read</summary>
          <p>{smart(note.evidence)}</p>
        </details>
      )}
    </div>
  );
}

function Quote({ c }: { c: Cite }) {
  return (
    <div class="x-figures-quote">
      <blockquote>“{c.quote}”</blockquote>
      <p class="x-figures-credit">
        {c.by && `${c.by}, `}
        {c.at ?? (c.work ? `${c.work}${c.when ? ` (${c.when})` : ''}` : c.name)}
        {c.url && (
          <>
            {' · '}
            <a href={c.url} target="_blank" rel="noopener noreferrer">
              Read it<span class="sr-only"> in {c.name} (opens a new tab)</span> <span aria-hidden="true">↗</span>
            </a>
          </>
        )}
      </p>
      {c.read && (
        <p class="x-figures-credit">
          Read in {c.read}
          {c.retrieved && `, ${c.retrieved}`}.
        </p>
      )}
    </div>
  );
}

function WhatThisIs({ form, note }: { form: Form; note: Note }) {
  const d = note.defined ?? form.defined;
  return (
    <div class="x-figures-what">
      <p class="x-figures-term">
        <b>{note.kind === 'figure' && note.figure ? `${note.figure.name}${note.figure.part ? `${/^of\b/i.test(note.figure.part) ? ' ' : ', '}${note.figure.part}` : ''}` : form.label}</b>
        {note.kind !== 'figure' && form.term && <span> · {form.term}</span>}
      </p>
      {d ? (
        <>
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
        </>
      ) : (
        <p class="x-figures-credit">It rests on the writers named below.</p>
      )}
    </div>
  );
}

/** How to read the strip, one tap away. */
function ReadArcs({ kind }: { kind: Note['kind'] }) {
  return (
    <details class="x-figures-evidence x-figures-key">
      <summary>How to read the arcs</summary>
      {kind === 'contrast' ? (
        <p>Each dot is a verse. The bars under the line are where each person is told of, and the dashed arc joins the two.</p>
      ) : (
        <p>Each arc joins words or lines that answer each other, lettered A and A′. Side by side: said again. Broken at the top: set opposite. Inside each other: a mirror, turning at the centre. Steps: each line builds on the last.</p>
      )}
    </details>
  );
}

function issueLink(a: Atlas, n: Note): string {
  const title = `Figures at Deep: ${refName(a, n.v, n.end)} (${n.id})`;
  const body = `Note ${n.id} on ${refName(a, n.v, n.end)}, ${n.strength}:\n\n${n.about}\n\nWhat should change, and the source for it:\n`;
  return `${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

/** The roots in a verse's own words, one per different word, in order. */
function inVerse(row: VerseRow, roots: number[]): number[] {
  const want = new Set(roots);
  const out: number[] = [];
  for (const w of row[1]) if (want.has(w[3]) && !out.includes(w[3])) out.push(w[3]);
  return out;
}

// ------------------------------------------------------------ the panel

function Entry({ a, data, note, verse, first, navigate }: { a: Atlas; data: Data; note: Note; verse: VerseRef; first: boolean; navigate: (v: VerseRef) => void }) {
  const form = data.forms[note.form];
  const [hover, setHover] = useState<number | null>(null);
  const [pin, setPin] = useState<number | null>(null);
  const light: Light = { lit: hover ?? pin, pin, onLight: setHover, onPin: setPin };
  const [opened, setOpened] = useState(first);
  const body = `fx-${note.id}-body`;
  const marks = note.kind === 'parallelism' ? marksOf(note.lines ?? [], note.pairs ?? []) : [];
  const rows = usePassage(a, note.v);
  const row = rows?.[0];
  // The roots the note names that are in the verse, once per word.
  const o = note.original;
  const roots = !o || !row ? [] : o.words?.length ? [...new Set(o.words.filter((w) => w[0] === note.v).map((w) => w[2]))] : inVerse(row, rootsFor(a, o.strong));
  const n = writerCount(note);
  const one = note.strength === 'some interpreters';
  return (
    <section class="x-figures-entry" aria-labelledby={`fx-${note.id}`}>
      <h3 id={`fx-${note.id}`} tabIndex={-1}>
        {form.label}
        <span class="x-figures-strength">
          {note.strength} · {n} {n === 1 ? 'writer' : 'writers'}
        </span>
        {one && note.kind !== 'figure' && <Unsure>a pattern some readers see</Unsure>}
      </h3>
      <Lead>{smart(note.about)}</Lead>
      {note.kind === 'parallelism' && <ParallelStrip note={note} form={form} marks={marks} light={light} />}
      {note.kind === 'contrast' && <ContrastStrip a={a} note={note} verse={verse} lit={light.lit} onLight={setHover} />}
      {note.kind !== 'figure' && <ReadArcs kind={note.kind} />}
      {!first && (
        <button type="button" class="x-figures-more" aria-expanded={opened} aria-controls={body} onClick={() => setOpened(!opened)}>
          {opened ? 'Hide the lines' : 'See the lines'} <span aria-hidden="true">{opened ? '‹' : '›'}</span>
        </button>
      )}
      {opened && (
        <div id={body}>
          {note.kind === 'parallelism' && <Ladder a={a} note={note} marks={marks} light={light} navigate={navigate} />}
          {note.kind === 'figure' && <FigureBody a={a} note={note} />}
          {note.kind === 'contrast' && <ReadAcross a={a} note={note} navigate={navigate} />}
          {o && (
            <div class="x-figures-orig">
              <p>{smart(o.note)}</p>
              {row && row[1].length > 0 && <OrigLine a={a} v={note.v} row={row} mark={new Set(roots)} />}
              {roots.length > 0 && (
                <div class="chips">
                  {roots.map((r) => (
                    <RootChip key={r} a={a} root={r} />
                  ))}
                </div>
              )}
            </div>
          )}
          <WhatThisIs form={form} note={note} />
          <Writers note={note} />
          <p class="x-figures-foot">
            Checked against the source{note.checked && ` on ${note.checked}`}: the BSB words, the Hebrew and Greek, and each writer’s quotation.{' '}
            <a href={issueLink(a, note)} target="_blank" rel="noopener noreferrer">
              Suggest a correction<span class="sr-only"> (opens a new tab)</span> <span aria-hidden="true">↗</span>
            </a>
          </p>
        </div>
      )}
    </section>
  );
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const notes = notesAt(data, verse);
  if (notes === null) return <p class="xt-lead xt-wait">…</p>;
  if (!notes.length) return <Lead>This verse has no note on how it is written.</Lead>;
  const jump = notes.length >= 3;
  return (
    <>
      {jump && (
        <ul class="x-figures-jump">
          {notes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  const h = document.getElementById(`fx-${n.id}`);
                  h?.scrollIntoView({ block: 'start' });
                  h?.focus({ preventScroll: true });
                }}
              >
                {data.forms[n.form].label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {notes.map((n, i) => (
        <Entry key={n.id} a={a} data={data} note={n} verse={verse} first={i === 0} navigate={navigate} />
      ))}
      <CommentaryFoot />
      <SourceNote>{SOURCE}</SourceNote>
    </>
  );
}
