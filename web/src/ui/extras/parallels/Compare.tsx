// The passages of a set, lined up verse by verse.
// - With room (a desktop panel), two columns: the passage being read beside
//   one other, each row holding the verses that tell the same thing.
// - Without room (phones), one passage at a time: buttons to switch, or a
//   swipe sideways, with the verses that line up with the reader's verse marked.
// From Study, the words two passages share are underlined; at Deep the Hebrew
// or Greek sits under each verse, with the shared roots marked the same way.

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Atlas, locate } from '../../../data/atlas';
import { FLAG, type VerseRow, getVerse } from '../../../data/text';
import { Passage, SideBySide, Unsure, openWord } from '../kit';
import { levelAtLeast } from '../level';
import type { VerseRef } from '../types';
import { type PSet, type Row, type SetDetail, type Span, nameOf, passageAt, rowsOf, shortNames } from './model';
import { content, contentRoots, englishKeys, pieces, shownWords } from './words';

/** Two columns from this panel width (each column then holds about 30 letters a line). */
const WIDE = 460;
/** A sideways swipe this long (and mostly sideways) moves to the next passage. */
const SWIPE = 56;

export type Texts = Map<VerseRef, VerseRow>;

/** Every verse of a set's passages, or null while they load. */
export function useTexts(a: Atlas, s: PSet): Texts | null {
  const key = s.passages.map((p) => `${p.from}-${p.to}`).join(',');
  const [got, setGot] = useState<{ key: string; texts: Texts } | null>(null);
  useEffect(() => {
    let live = true;
    const vs: VerseRef[] = [];
    for (const p of s.passages) for (let v = p.from; v <= p.to; v++) vs.push(v);
    Promise.all(vs.map((v) => getVerse(a, v))).then(
      (rows) => live && setGot({ key, texts: new Map(vs.map((v, i) => [v, rows[i]])) }),
      () => live && setGot({ key, texts: new Map() }),
    );
    return () => {
      live = false;
    };
  }, [a, key]);
  return got && got.key === key ? got.texts : null;
}

/** Whether a passage holds a verse the base text lacks but the BSB prints. */
export function lacksBase(texts: Texts | null, p: Span): boolean {
  if (!texts) return false;
  for (let v = p.from; v <= p.to; v++) {
    const row = texts.get(v);
    if (row && shownWords(row).other) return true;
  }
  return false;
}

/** For each verse, the English words and roots of the verses it lines up with. */
interface Shared {
  en: Map<VerseRef, Set<string>>;
  roots: Map<VerseRef, Set<number>>;
}

function addShared(out: Shared, rows: Row[] | null, mine: 'a' | 'b', texts: Texts): void {
  for (const r of rows ?? []) {
    const [me, them] = mine === 'a' ? [r.a, r.b] : [r.b, r.a];
    if (!me.length || !them.length) continue;
    const en = new Set<string>();
    const roots = new Set<number>();
    for (const v of them) {
      const row = texts.get(v);
      if (!row) continue;
      for (const k of englishKeys(row[0])) en.add(k);
      for (const x of contentRoots(row)) roots.add(x);
    }
    for (const v of me) {
      const e = out.en.get(v);
      out.en.set(v, e ? new Set([...e, ...en]) : en);
      const o = out.roots.get(v);
      out.roots.set(v, o ? new Set([...o, ...roots]) : roots);
    }
  }
}

function useWide(box: { current: HTMLElement | null }): boolean {
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const on = () => setWide(el.clientWidth >= WIDE);
    on();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(on) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  return wide;
}

/** Bring the marked row into view in the panel body when it starts out of
 * view, leaving room above it for the sticky names and some context. A row
 * whose top is already in view stays put, so the panel opens on its plain
 * sentence and the way deeper. */
function useShowHere(box: { current: HTMLElement | null }, on: boolean, deps: unknown[]): void {
  useLayoutEffect(() => {
    const root = on ? box.current : null;
    const body = root?.closest<HTMLElement>('.xt-body');
    if (!root || !body) return;
    const target = root.querySelector<HTMLElement>('.x-parallels-here') ?? root.querySelector<HTMLElement>('.x-parallels-one');
    if (!target) return;
    const t = target.getBoundingClientRect();
    const b = body.getBoundingClientRect();
    const sticky = root.querySelector<HTMLElement>('.x-parallels-float, .x-parallels-cols thead')?.getBoundingClientRect().height ?? 0;
    if (t.top >= b.top + sticky && t.top <= b.bottom - 48) return;
    body.scrollTop += t.top - b.top - Math.max(sticky + 12, 0.3 * b.height);
  }, deps);
}

/** Underline the words of a verse that the verses it lines up with also use. */
function Marked({ text, keys }: { text: string; keys?: Set<string> }) {
  if (!keys || !keys.size) return <>{text}</>;
  return (
    <>
      {pieces(text).map((t, i) =>
        i % 2 === 1 && englishKeys(t).some((k) => keys.has(k)) ? (
          <span key={i} class="x-parallels-same">
            {t}
          </span>
        ) : (
          t
        ),
      )}
    </>
  );
}

/** Deep: a verse's Hebrew or Greek; each word opens its word study. */
function Orig({ a, v, row, shared }: { a: Atlas; v: VerseRef; row: VerseRow; shared?: Set<number> }) {
  const { words, other } = shownWords(row);
  if (!words.length) return null;
  const he = a.books[a.verseBook[v]].testament === 'OT';
  return (
    <div class={`orig ${he ? 'he' : 'gr'} x-parallels-orig`} lang={he ? 'hbo' : 'grc'}>
      {words.map(([w, pos]) => {
        const same = !!shared && w[3] >= 0 && shared.has(w[3]) && content(w[4]);
        return (
          <span key={pos}>
            <button type="button" class={`w${same ? ' shared' : ''}${other ? ' other' : ''}${w[5] & FLAG.variant ? ' var' : ''}`} data-lr={w[3] >= 0 ? w[3] : undefined} onClick={() => w[3] >= 0 && openWord(w[3], v, pos)} title={`${w[1]} · ${w[2]}`}>
              {w[0]}
            </button>{' '}
          </span>
        );
      })}
    </div>
  );
}

/** The number before a verse: "5", or "16:1" where a new chapter starts inside a passage. */
function num(a: Atlas, p: Span, v: VerseRef): string {
  const l = locate(a, v);
  return l.verse === 1 && v !== p.from ? `${l.chapter}:1` : String(l.verse);
}

interface VerseProps {
  a: Atlas;
  p: Span;
  v: VerseRef;
  texts: Texts;
  shared: Shared | null;
  /** In the one-passage view: this verse lines up with the reader's verse. */
  here?: string;
}

function Verse({ a, p, v, texts, shared, here }: VerseProps) {
  const row = texts.get(v);
  const deep = levelAtLeast('deep');
  if (!row) return null;
  return (
    <div class={`x-parallels-v${here ? ' x-parallels-here' : ''}`} data-lv={v}>
      <p class="x-parallels-text">
        <sup>{num(a, p, v)}</sup>
        {here && <span class="x-parallels-sr">{here} </span>}
        {row[0].trim() ? <Marked text={row[0]} keys={shared?.en.get(v)} /> : <span class="x-parallels-gap">Some manuscripts add a verse here.</span>}
      </p>
      {deep && <Orig a={a} v={v} row={row} shared={shared?.roots.get(v)} />}
    </div>
  );
}

/** A passage's name, which takes the reader there. */
function Head({ a, p, texts, navigate }: { a: Atlas; p: Span; texts: Texts; navigate: (v: VerseRef) => void }) {
  const name = nameOf(a, p);
  return (
    <div class="x-parallels-head">
      <button type="button" class="xt-pref" data-lv={p.from} onClick={() => navigate(p.from)} title={`Read ${name} in its chapter`}>
        {name} <span aria-hidden="true">›</span>
      </button>
      {lacksBase(texts, p) && <Unsure>not in some early manuscripts</Unsure>}
    </div>
  );
}

/** Buttons that pick one passage, the way the app's own switches work. */
function Pick({ label, shown, float, names, ids, cur, set }: { label: string; shown?: boolean; float?: boolean; names: string[]; ids: number[]; cur: number; set: (i: number) => void }) {
  return (
    <div class={`x-parallels-pick${float ? ' x-parallels-float' : ''}`} role="group" aria-label={label}>
      {shown && (
        <span class="x-parallels-pick-label" aria-hidden="true">
          {label}
        </span>
      )}
      {ids.map((i) => (
        <button key={i} type="button" aria-pressed={i === cur} onClick={() => set(i)}>
          {names[i]}
        </button>
      ))}
    </div>
  );
}

export interface CompareProps {
  a: Atlas;
  s: PSet;
  /** undefined while loading, null if it could not be loaded */
  d: SetDetail | null | undefined;
  texts: Texts | null;
  verse: VerseRef;
  navigate: (v: VerseRef) => void;
  /** Bring the reader's verse into view (the first set of a panel only). */
  scroll: boolean;
  /** The way deeper, shown above the texts so it is in view when the panel opens. */
  deeper?: ComponentChildren;
}

export function Compare({ a, s, d, texts, verse, navigate, scroll, deeper }: CompareProps) {
  const home = passageAt(s, verse);
  const others = s.passages.map((_, i) => i).filter((i) => i !== home);
  const [cur, setCur] = useState(others[0]);
  const [other, setOther] = useState(others[0]);
  const box = useRef<HTMLDivElement>(null);
  const wide = useWide(box);
  const study = levelAtLeast('study');
  const deep = levelAtLeast('deep');
  const names = shortNames(a, s);
  const ready = texts !== null && d !== undefined;
  const choose = (i: number) => {
    setCur(i);
    if (i !== home) setOther(i);
  };
  useShowHere(box, scroll, [ready, wide, cur, other]);

  // The rows that line the home passage up with each of the others.
  const rowsWith = useMemo(() => new Map(others.map((o) => [o, rowsOf(s, d, home, o)] as const)), [s, d, home]);

  // Swipe sideways in the one-passage view to move to the next passage.
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const step = (dir: number) => {
    const next = cur + dir;
    if (next >= 0 && next < s.passages.length) choose(next);
  };
  const swipeHandlers = {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: PointerEvent) => {
      const at = swipe.current;
      swipe.current = null;
      if (!at || at.id !== e.pointerId) return;
      const [dx, dy] = [e.clientX - at.x, e.clientY - at.y];
      if (Math.abs(dx) >= SWIPE && Math.abs(dx) > 2 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
    },
    onPointerCancel: () => {
      swipe.current = null;
    },
  };

  let body: ComponentChildren;
  let hint: string | null = null;
  if (!ready) {
    body = <p class="xt-wait">…</p>;
  } else if (d === null || [...rowsWith.values()].some((r) => r === null)) {
    // Without the rows, the passages plainly side by side.
    body = (
      <SideBySide>
        {s.passages.map((p, i) => (
          <Passage key={i} a={a} from={p.from} to={p.to} navigate={navigate} />
        ))}
      </SideBySide>
    );
  } else if (wide) {
    const rows = rowsWith.get(other) ?? [];
    const shared: Shared | null = study ? { en: new Map(), roots: new Map() } : null;
    const sharedOther: Shared | null = study ? { en: new Map(), roots: new Map() } : null;
    if (shared && sharedOther) {
      addShared(shared, rows, 'a', texts);
      addShared(sharedOther, rows, 'b', texts);
    }
    const [hp, op] = [s.passages[home], s.passages[other]];
    hint = study ? `Underlined: words both passages use${deep ? ', in the English and in the original' : ''}.` : null;
    body = (
      <>
        {others.length > 1 && <Pick label={`Compare ${names[home]} with`} shown names={names} ids={others} cur={other} set={choose} />}
        <table class="x-parallels-cols">
          <caption class="x-parallels-sr">
            {nameOf(a, hp)} and {nameOf(a, op)}, verse by verse. The marked row holds {nameOf(a, { from: verse, to: verse })}.
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <Head a={a} p={hp} texts={texts} navigate={navigate} />
              </th>
              <th scope="col">
                <Head a={a} p={op} texts={texts} navigate={navigate} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => {
              const here = r.a.includes(verse);
              return (
                <tr key={k} class={here ? 'x-parallels-here' : undefined}>
                  <td>
                    {r.a.map((v) => (
                      <Verse key={v} a={a} p={hp} v={v} texts={texts} shared={shared} />
                    ))}
                  </td>
                  <td>
                    {r.b.map((v) => (
                      <Verse key={v} a={a} p={op} v={v} texts={texts} shared={sharedOther} />
                    ))}
                    {here && !r.b.length && <p class="x-parallels-gap">Nothing here lines up closely.</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </>
    );
  } else {
    // One passage at a time.
    const p = s.passages[cur];
    const shared: Shared | null = study ? { en: new Map(), roots: new Map() } : null;
    const here = new Set<VerseRef>();
    if (cur === home) {
      here.add(verse);
      if (shared) for (const o of others) addShared(shared, rowsWith.get(o) ?? null, 'a', texts);
      if (study) hint = others.length > 1 ? 'Underlined: words the other passages also use.' : `Underlined: words ${names[others[0]]} also uses.`;
    } else {
      const rows = rowsWith.get(cur) ?? [];
      for (const r of rows) if (r.a.includes(verse)) for (const v of r.b) here.add(v);
      if (shared) addShared(shared, rows, 'b', texts);
      if (study) hint = `Underlined: words ${names[home]} also uses.`;
    }
    const verses: VerseRef[] = [];
    for (let v = p.from; v <= p.to; v++) verses.push(v);
    const label = cur === home ? 'The verse you are reading.' : `Lines up with ${nameOf(a, { from: verse, to: verse })}.`;
    body = (
      <>
        <Pick label="Choose a passage" float names={names} ids={s.passages.map((_, i) => i)} cur={cur} set={choose} />
        <section class="x-parallels-one" aria-label={nameOf(a, p)} {...swipeHandlers}>
          <Head a={a} p={p} texts={texts} navigate={navigate} />
          {cur !== home && here.size === 0 && (
            <p class="x-parallels-gap">
              Nothing in {names[cur]} lines up closely with {nameOf(a, { from: verse, to: verse })}.
            </p>
          )}
          {verses.map((v) => (
            <Verse key={v} a={a} p={p} v={v} texts={texts} shared={shared} here={here.has(v) ? label : undefined} />
          ))}
        </section>
      </>
    );
  }
  return (
    <div ref={box} class="x-parallels-compare">
      {hint && <p class="x-parallels-hint">{hint}</p>}
      {deeper}
      {body}
    </div>
  );
}
