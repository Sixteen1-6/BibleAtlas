// The panels behind the wordplay lines.
//
// Verse panel. Simple: one plain sentence, then each play's note.
//   A "wordplay walk" steps through every play in Bible order, inside the
//   panel; the verse name above each one takes the reader there.
// Study: how sure each note is, the words as readers say them (with the
//   letters they share lit), and the verses they are in, side by side.
// Deep: what the note rests on.
//
// Chapter panel (an alphabet poem): the letters from aleph to tav, each with
//   the verse its part starts at; Deep adds what is unusual and how it was checked.

import { useEffect, useRef, useState } from 'preact/hooks';
import { type Atlas, label } from '../../../data/atlas';
import { type VerseRow, getVerse } from '../../../data/text';
import { TAP } from '../../../state';
import { GoDeeper } from '../../Depth';
import { Facts, Lead, Passage, SideBySide, SourceNote, Unsure, openWord, refName } from '../kit';
import { levelAtLeast } from '../level';
import type { ChapterPanelProps, PanelProps, VerseRef } from '../types';
import { type Data, LETTER_NAMES, MARK, type Play, type Poem, type WordAt, chapterKey, neighbours, say } from './model';

/** Curly quotes and apostrophes for display, as the Layers card shows them. */
function smart(text: string): string {
  return text.replace(/"([^"]*)"/g, '“$1”').replace(/(\w)'(\w)/g, '$1’$2');
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const FINAL: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ', ς: 'σ' };
const LETTER = /[א-תͰ-Ͽἀ-῿]/u;

/** The letters of a word, each with its vowel points and accents. */
function clusters(word: string): string[] {
  return word.match(/\P{M}\p{M}*/gu) ?? [];
}

/** A letter without its marks, final forms folded, so "ם" matches "מ" and "έ" matches "ε". */
function bare(cluster: string): string {
  const c = cluster.normalize('NFD').charAt(0).toLowerCase();
  return FINAL[c] ?? c;
}

/** Which letters of a word to light: those in a run it shares with another
 * word of its play (two Hebrew letters in a row, or three Greek), so
 * adam/adamah and shaqed/shoqed light up and a lone shared letter does not. */
function sharedRuns(word: string, others: string[], min: number): Set<number> {
  const mine = clusters(word)
    .map((c, i) => [i, bare(c)] as const)
    .filter(([i]) => LETTER.test(clusters(word)[i].charAt(0)));
  const lit = new Set<number>();
  for (const o of others) {
    const theirs = clusters(o)
      .filter((c) => LETTER.test(c.charAt(0)))
      .map(bare);
    for (let i = 0; i < mine.length; i++) {
      for (let j = 0; j < theirs.length; j++) {
        let k = 0;
        while (i + k < mine.length && j + k < theirs.length && mine[i + k][1] === theirs[j + k]) k++;
        if (k >= min) for (let m = 0; m < k; m++) lit.add(mine[i + m][0]);
      }
    }
  }
  return lit;
}

function Letters({ word, others, greek }: { word: string; others: string[]; greek: boolean }) {
  const lit = sharedRuns(word, others, greek ? 3 : 2);
  return (
    <>
      {clusters(word).map((c, i) =>
        lit.has(i) ? (
          <mark key={i} class="x-wordplay-same">
            {c}
          </mark>
        ) : (
          <span key={i}>{c}</span>
        ),
      )}
    </>
  );
}

const LANGUAGE: Record<string, string> = { H: 'Hebrew', A: 'Aramaic', G: 'Greek' };

/** The languages the plays' words are in, Hebrew first. */
function languages(a: Atlas, plays: Play[]): string[] {
  const got = new Set(plays.flatMap((p) => p.words.map((w) => a.lemmas.lang[w[2]])));
  return ['H', 'A', 'G'].filter((l) => got.has(l)).map((l) => LANGUAGE[l]);
}

function lead(a: Atlas, plays: Play[]): string {
  if (plays.every((p) => p.layer.kind === 'name meaning')) return 'A name here carries a meaning that English does not show.';
  const langs = languages(a, plays);
  // A Hebrew word and the Greek that renders or recalls it echo each other; they do not pun.
  if (langs.includes('Greek') && langs.length > 1) return 'Hebrew and Greek words echo each other here. English hides it.';
  return langs.length ? `Words here play on each other in the ${list(langs)}. English hides it.` : 'Words here play on each other. English hides it.';
}

/** The verse rows the words are in, once loaded (for each word's English there). */
function useRows(a: Atlas, verses: VerseRef[]): Map<VerseRef, VerseRow> {
  const key = verses.join(',');
  const [rows, setRows] = useState<Map<VerseRef, VerseRow>>(() => new Map());
  useEffect(() => {
    if (!verses.length) return;
    let live = true;
    Promise.all(verses.map((v) => getVerse(a, v).then((r) => [v, r] as const))).then(
      (got) => live && setRows(new Map(got)),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [a, key]);
  return rows;
}

/** A verse word's English as the reader's word-by-word row has it, without its brackets. */
function english(row: VerseRow | undefined, pos: number, root: number): string | null {
  const w = row?.[1][pos];
  if (!w || w[3] !== root) return null;
  return w[2].replace(/[[\]<>]/g, '').replace(/\s+([!?.,;:])/g, '$1').replace(/[,;:.]+$/, '').trim() || null;
}

function Word({ a, w, others, rows }: { a: Atlas; w: WordAt; others: string[]; rows: Map<VerseRef, VerseRow> }) {
  const [verse, pos, root] = w;
  const L = a.lemmas;
  const greek = L.lang[root] === 'G';
  const said = say(a, root);
  return (
    <button type="button" class="x-wordplay-word" onClick={() => openWord(root, verse, pos)} title={`Word study: ${said} in ${label(a, verse)}`}>
      <span class={`x-wordplay-orig ${greek ? 'gr' : 'he'}`} lang={greek ? 'grc' : 'he'} dir={greek ? 'ltr' : 'rtl'}>
        <Letters word={L.word[root]} others={others} greek={greek} />
      </span>
      <span class="x-wordplay-say">{said}</span>
      <span class="x-wordplay-gloss">{english(rows.get(verse), pos, root) ?? L.gloss[root] ?? ''}</span>
    </button>
  );
}

/** The verses side by side for a play: the one being read first; at most three. */
function sideBySide(play: Play, here: VerseRef): VerseRef[] {
  return [...new Set([here, ...play.words.map((w) => w[0])])].slice(0, 3);
}

function PlayView({ a, play, here, rows, navigate }: { a: Atlas; play: Play; here: VerseRef; rows: Map<VerseRef, VerseRow>; navigate: (v: VerseRef) => void }) {
  const study = levelAtLeast('study');
  const deep = levelAtLeast('deep');
  const L = a.lemmas;
  const unsure = play.layer.strength === 'some interpreters';
  const verses = sideBySide(play, here);
  return (
    <article class="x-wordplay-play">
      <p class="x-wordplay-kind">
        {play.layer.kind === 'name meaning' ? 'Name' : 'Wordplay'}
        {study && !unsure && <span class="x-wordplay-strength"> · {play.layer.strength}</span>}
        {unsure && <Unsure title="Some interpreters read it this way; others do not">some interpreters</Unsure>}
        {play.passage.draft && <Unsure title="Not yet reviewed by a person">draft</Unsure>}
      </p>
      <p class="x-wordplay-text">{smart(play.layer.text)}</p>
      {study && play.roots.length > 0 && (
        <div class="x-wordplay-words">
          {play.roots.map((w) => {
            const script = L.lang[w[2]] === 'G';
            const others = play.roots.filter((o) => o !== w && (L.lang[o[2]] === 'G') === script).map((o) => L.word[o[2]]);
            return <Word key={w[2]} a={a} w={w} others={others} rows={rows} />;
          })}
        </div>
      )}
      {study && verses.length > 1 && (
        <SideBySide>
          {verses.map((v) => (
            <Passage key={v} a={a} from={v} navigate={navigate} />
          ))}
        </SideBySide>
      )}
      {deep && play.layer.evidence && <p class="x-wordplay-deep">Behind this note: {smart(play.layer.evidence.replace(/\.\s*$/, ''))}.</p>}
    </article>
  );
}

/** Step through every play in Bible order without leaving the panel. */
function Walk({ a, data, verse, at, go }: { a: Atlas; data: Data; verse: VerseRef; at: number | null; go: (i: number) => void }) {
  const { prev, next, n } = neighbours(data, verse, at);
  return (
    <nav class="x-wordplay-walk" aria-label="Wordplay walk">
      <button type="button" disabled={prev === null} onClick={() => prev !== null && go(prev)} title={prev !== null ? label(a, data.walk[prev]) : undefined}>
        <span aria-hidden="true">‹</span> Previous
      </button>
      <span class="x-wordplay-at">
        Wordplay walk{n > 0 && `: ${n} of ${data.walk.length}`}
      </span>
      <button type="button" disabled={next === null} onClick={() => next !== null && go(next)} title={next !== null ? label(a, data.walk[next]) : undefined}>
        Next <span aria-hidden="true">›</span>
      </button>
    </nav>
  );
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  // The walk's stop being shown, or null for this verse's own plays.
  const [at, setAt] = useState<number | null>(null);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => setAt(null), [verse]);
  const here = at === null ? verse : data.walk[at];
  const plays = (at === null ? data.plays.get(verse) : data.stops.get(here)) ?? [];
  const study = levelAtLeast('study');
  const rows = useRows(a, study ? [...new Set(plays.flatMap((p) => p.roots.map((w) => w[0])))] : []);
  const langs = languages(a, plays);
  const go = (i: number) => {
    setAt(i);
    top.current?.closest('.xt-body')?.scrollTo({ top: 0 });
  };
  return (
    <>
      <div ref={top} />
      {at !== null && (
        <p class="x-wordplay-where">
          <button type="button" class="x-wordplay-go" onClick={() => navigate(here)} title={`Go to ${refName(a, here)}`}>
            {refName(a, here)} <span aria-hidden="true">›</span>
          </button>
        </p>
      )}
      <Lead>{lead(a, plays)}</Lead>
      {plays.map((p, i) => (
        <PlayView key={i} a={a} play={p} here={here} rows={rows} navigate={navigate} />
      ))}
      {langs.length > 0 && <GoDeeper to="study">See the {list(langs)} words</GoDeeper>}
      <Walk a={a} data={data} verse={verse} at={at} go={go} />
      <SourceNote>Notes from this app's Layers of meaning, checked against STEPBible's Hebrew and Greek, CC BY 4.0.</SourceNote>
    </>
  );
}

function names(letters: number[]): string {
  const n = letters.map((l) => LETTER_NAMES[l].toLowerCase());
  return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} or ${n[n.length - 1]}`;
}

function PoemGrid({ a, data, poem, navigate }: { a: Atlas; data: Data; poem: Poem; navigate: (v: VerseRef) => void }) {
  const study = levelAtLeast('study');
  const shown = poem.parts.filter((p) => study || p[3] !== MARK.extra);
  return (
    <ol class="x-wordplay-grid">
      {shown.map(([letter, verse, , mark]) => (
        <li key={`${letter}-${verse}-${mark}`} class={mark === MARK.extra ? 'x-wordplay-extra' : undefined}>
          <button type="button" onClick={() => navigate(verse)} title={`Read ${label(a, verse)}`}>
            <span class="x-wordplay-letter he" lang="he">
              {data.letters[letter]}
            </span>
            <span class="x-wordplay-lname">{LETTER_NAMES[letter]}</span>
            <span class="x-wordplay-v">v. {label(a, verse).split(':')[1]}</span>
          </button>
          {mark === MARK.otherCopies && <Unsure title="Not in most Hebrew copies; a Dead Sea Scroll and the Greek have it">other copies</Unsure>}
          {mark === MARK.extra && <Unsure title="A line outside the alphabet, or a letter used twice">extra</Unsure>}
        </li>
      ))}
    </ol>
  );
}

export function ChapterPanel({ a, data, chapter, navigate }: ChapterPanelProps<Data>) {
  const poem = data.poems.get(chapterKey(chapter));
  const deep = levelAtLeast('deep');
  if (!poem) return null;
  return (
    <>
      <Lead>Each part of this poem starts with the next letter of the Hebrew alphabet, from aleph to tav, like a poem written from A to Z.</Lead>
      <PoemGrid a={a} data={data} poem={poem} navigate={navigate} />
      {poem.missing.length > 0 && <p class="x-wordplay-missing">No line here starts with {names(poem.missing)}.</p>}
      <p class="x-wordplay-hint">{TAP} a letter to read its verse. English cannot keep the pattern, so a translation hides it.</p>
      <GoDeeper to="deep">{poem.note ? 'What is unusual in this poem' : 'How this was checked'}</GoDeeper>
      {deep && (
        <>
          {poem.note && <p>{smart(poem.note)}</p>}
          <Facts
            rows={[
              ['Verses', `${label(a, poem.from)} to ${label(a, poem.to)}`],
              ['How checked', 'Each letter is the first letter of its line in the Hebrew text of STEPBible’s TAHOT, checked when the app is built.'],
            ]}
          />
        </>
      )}
      <SourceNote>Hebrew text from STEPBible’s TAHOT, CC BY 4.0.</SourceNote>
    </>
  );
}
