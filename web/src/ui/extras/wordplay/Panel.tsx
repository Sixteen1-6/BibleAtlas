// The panels behind the wordplay lines.
//
// Verse panel. Simple: one plain sentence, then for each play the words as
//   readers say them, with the letters they share lit in both, and the note.
//   A "wordplay walk" steps to the next and previous verse with a play.
// Study: how sure the note is, and the verses the words are in, side by side.
// Deep: what the note rests on, and the sources.
//
// Chapter panel (an alphabet poem): the letters from aleph to tav, each with
//   the verse its part starts at; Deep adds what is unusual and how it was checked.

import { type Atlas, label } from '../../../data/atlas';
import { GoDeeper } from '../../Depth';
import { Facts, Lead, Passage, SideBySide, SourceNote, Unsure, openWord } from '../kit';
import { levelAtLeast } from '../level';
import { openExtra } from '../open';
import type { ChapterPanelProps, PanelProps, VerseRef } from '../types';
import { type Data, LETTER_NAMES, MARK, type Play, type Poem, chapterKey, neighbours, say } from './model';

/** Curly quotes and apostrophes for display, as the Layers card shows them. */
function smart(text: string): string {
  return text.replace(/"([^"]*)"/g, '“$1”').replace(/(\w)'(\w)/g, '$1’$2');
}

const FINAL: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ', ς: 'σ' };

/** The letters of a word, each with its vowel points and accents. */
function clusters(word: string): string[] {
  return word.match(/\P{M}\p{M}*/gu) ?? [];
}

/** A letter without its marks, final forms folded, so "ם" matches "מ" and "έ" matches "ε". */
function bare(cluster: string): string {
  const c = cluster.normalize('NFD').charAt(0).toLowerCase();
  return FINAL[c] ?? c;
}

const LETTER = /[א-תͰ-Ͽἀ-῿]/u;

/** A word with the letters it shares with the other words of its play lit. */
function Letters({ word, others }: { word: string; others: string[] }) {
  const pool = new Set(others.flatMap((o) => clusters(o).map(bare)));
  return (
    <>
      {clusters(word).map((c, i) =>
        LETTER.test(c.charAt(0)) && pool.has(bare(c)) ? (
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

function language(a: Atlas, play: Play): string {
  const langs = new Set(play.words.map(([, , r]) => a.lemmas.lang[r]));
  if (langs.size === 1 && langs.has('G')) return 'Greek';
  if (langs.size === 1 && langs.has('A')) return 'Aramaic';
  if (!langs.has('G')) return 'Hebrew';
  return 'Hebrew and Greek';
}

function lead(a: Atlas, plays: Play[]): string {
  if (plays.every((p) => p.layer.kind === 'name meaning')) return 'A name here carries a meaning that English does not show.';
  const langs = new Set(plays.map((p) => language(a, p)));
  const lang = langs.size === 1 ? [...langs][0] : 'the original languages';
  return `Words here play on each other in ${lang === 'the original languages' ? lang : `the ${lang}`}. English hides it.`;
}

function Word({ a, w, others }: { a: Atlas; w: [VerseRef, number, number]; others: string[] }) {
  const [verse, pos, root] = w;
  const L = a.lemmas;
  const greek = L.lang[root] === 'G';
  return (
    <button type="button" class="x-wordplay-word" onClick={() => openWord(root, verse, pos)} title={`Word study: ${L.key[root]} in ${label(a, verse)}`}>
      <span class={`x-wordplay-orig ${greek ? 'gr' : 'he'}`} lang={greek ? 'grc' : 'he'} dir={greek ? 'ltr' : 'rtl'}>
        <Letters word={L.word[root]} others={others} />
      </span>
      <span class="x-wordplay-say">{say(L.translit[root] || '')}</span>
      <span class="x-wordplay-gloss">{(L.gloss[root] || '').split(':')[0]}</span>
    </button>
  );
}

function PlayView({ a, play, navigate, here }: { a: Atlas; play: Play; navigate: (v: VerseRef) => void; here: VerseRef }) {
  const study = levelAtLeast('study');
  const deep = levelAtLeast('deep');
  const L = a.lemmas;
  const words = play.words.map(([, , r]) => L.word[r]);
  // The verses the words are in, this one first; at most three.
  const verses = [...new Set([here, ...play.words.map((w) => w[0])])].slice(0, 3);
  return (
    <article class="x-wordplay-play">
      <p class="x-wordplay-kind">
        {play.layer.kind === 'name meaning' ? 'Name' : 'Wordplay'}
        {study && <span class="x-wordplay-strength"> · {play.layer.strength}</span>}
        {play.passage.draft && <Unsure title="Not yet reviewed by a person">draft</Unsure>}
      </p>
      {play.words.length > 0 && (
        <div class="x-wordplay-words">
          {play.words.map((w, i) => (
            <Word key={w[2]} a={a} w={w} others={words.filter((_, j) => j !== i)} />
          ))}
        </div>
      )}
      <p class="x-wordplay-text">{smart(play.layer.text)}</p>
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

/** Step to the previous or next verse with a play, with its panel open. */
function Walk({ a, data, verse, navigate }: { a: Atlas; data: Data; verse: VerseRef; navigate: (v: VerseRef) => void }) {
  const { prev, next, at } = neighbours(data, verse);
  const go = (v: VerseRef) => {
    navigate(v);
    openExtra('wordplay', 'verse', v);
  };
  return (
    <nav class="x-wordplay-walk" aria-label="Wordplay walk">
      <button type="button" disabled={prev === null} onClick={() => prev !== null && go(prev)} title={prev !== null ? label(a, prev) : undefined}>
        <span aria-hidden="true">‹</span> Previous
      </button>
      <span class="x-wordplay-at">
        Wordplay walk{at > 0 && `: ${at} of ${data.walk.length}`}
      </span>
      <button type="button" disabled={next === null} onClick={() => next !== null && go(next)} title={next !== null ? label(a, next) : undefined}>
        Next <span aria-hidden="true">›</span>
      </button>
    </nav>
  );
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const plays = data.plays.get(verse) ?? [];
  return (
    <>
      <Lead>{lead(a, plays)}</Lead>
      {plays.map((p, i) => (
        <PlayView key={i} a={a} play={p} navigate={navigate} here={verse} />
      ))}
      <GoDeeper to="study">See the verses side by side</GoDeeper>
      <Walk a={a} data={data} verse={verse} navigate={navigate} />
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
      <p class="x-wordplay-hint">Tap a letter to read its verse. English cannot keep the pattern, so a translation hides it.</p>
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
