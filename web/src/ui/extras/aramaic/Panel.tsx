// The panel behind the Aramaic and Hebrew line.
//
// Simple: one plain sentence, the word as readers say it with its meaning,
//   who says it, a plain note, the verse in the BSB, and a short answer to
//   "why is the rest in Greek?" (or "why Aramaic here?" in the Old Testament).
// Study: the word in Hebrew square letters, labelled by its language (and
//   marked where the form is only a suggestion), beside the Greek letters of
//   the Greek text (marked where the English follows other manuscripts); in
//   the Old Testament, the verse in the original with its Hebrew and Aramaic
//   marked.
// Deep: the scholarly detail, how sure it is, the word studies of its roots,
//   and the sources.

import type { ComponentChildren } from 'preact';
import { type Atlas, langName, verseIndex } from '../../../data/atlas';
import { FLAG, type VerseRow } from '../../../data/text';
import { GoDeeper } from '../../Depth';
import { useJson } from '../data';
import { Facts, Lead, Passage, SourceNote, Unsure, openWord, refName, usePassage } from '../kit';
import { levelAtLeast } from '../level';
import type { ChapterPanelProps, PanelProps, VerseRef } from '../types';
import { type Certainty, type Data, type DeepFile, type Entry, type Language, type Rich, type Section, chapterKey } from './model';

type Go = (v: VerseRef) => void;

/** Who wrote each book that keeps a word, as the line names them. */
const WRITER: Record<string, string> = {
  Matt: 'Matthew',
  Mark: 'Mark',
  Luke: 'Luke',
  John: 'John',
  Acts: 'Luke',
  Rom: 'Paul',
  '1Cor': 'Paul',
  Gal: 'Paul',
  Heb: 'the writer of Hebrews',
  Rev: 'John',
};
const GOSPELS = new Set(['Matt', 'Mark', 'Luke', 'John']);
const LETTERS_OF_PAUL = new Set(['Rom', '1Cor', 'Gal']);
const NUMBER = ['no', 'one', 'two', 'three', 'four', 'five'];

function osisOf(a: Atlas, v: VerseRef): string {
  return a.books[a.verseBook[v]].osis;
}

function writerOf(a: Atlas, v: VerseRef): string {
  return WRITER[osisOf(a, v)] ?? 'the writer';
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Talitha koum" is several words; "Abba" is one. */
function many(e: Entry): boolean {
  return /[\s,]/.test(e.word.trim());
}

/** What the writer keeps, in plain words: "Jesus’ words", "a name". */
function what(e: Entry): string {
  if (e.jesus && e.kind !== 'name' && e.kind !== 'place') return many(e) ? 'Jesus’ words' : 'a word Jesus used';
  return { saying: 'a saying', prayer: 'a prayer', word: 'a word', name: 'a name', place: 'a place name', title: 'a title' }[e.kind];
}

/** The kind of thing kept, without an article: "words", "name", "place name". */
function nounOf(e: Entry): string {
  if (e.kind === 'name') return 'name';
  if (e.kind === 'place') return 'place name';
  if (e.kind === 'title') return 'title';
  return many(e) ? 'words' : 'word';
}

/** "said by" for a saying, prayer or word; "used by" for a name, place or title. */
function verbOf(e: Entry): string {
  return e.kind === 'name' || e.kind === 'place' || e.kind === 'title' ? 'used by' : 'said by';
}

/** Who says or uses it at this verse. */
function speakerAt(e: Entry, verse: VerseRef): string {
  return e.speaker[Math.max(0, e.verses.indexOf(verse))] ?? e.speaker[0] ?? '';
}

function entryLead(a: Atlas, verse: VerseRef, es: Entry[]): string {
  const kept = es.length > 1 ? `${NUMBER[es.length] ?? es.length} ${es.every((e) => e.jesus) ? 'of Jesus’ words' : 'words'}` : what(es[0]);
  return `The New Testament was written in Greek, but here ${writerOf(a, verse)} keeps the sound of ${kept}.`;
}

/** The short answer to the reader's question, in plain words: why the Greek,
 * and so why the app shows these words in Greek letters. */
function why(a: Atlas, verse: VerseRef, es: Entry[]): { title: string; body: string } {
  const osis = osisOf(a, verse);
  const writer = writerOf(a, verse);
  const gospel = GOSPELS.has(osis);
  const written = gospel ? `${cap(writer)}’s Gospel was written in Greek` : LETTERS_OF_PAUL.has(osis) ? 'Paul wrote this letter in Greek' : `${a.books[a.verseBook[verse]].name} was written in Greek`;
  const world = 'the shared language of the eastern Roman world';
  const several = es.length > 1;
  const noun = several ? `${NUMBER[es.length] ?? es.length} words` : nounOf(es[0]);
  const plural = several || noun === 'words';
  // The owner's question, answered outright.
  const letters = `So the Greek text, and the Greek in this app, spell ${plural ? 'them' : 'it'} in Greek letters.`;
  const lang: Language | null = es.every((e) => e.language === es[0].language) ? es[0].language : null;
  if (lang === 'Hebrew') {
    return {
      title: 'Why Hebrew here?',
      body: `${written}, ${world}. Hebrew is the language of most of the Old Testament, and here ${writer} kept the sound of ${plural ? `Hebrew ${noun}` : `a Hebrew ${noun}`}. ${letters}`,
    };
  }
  // "Jesus most likely taught in Aramaic" fits his words in the Gospels, not
  // the risen Jesus' voice in Acts, nor a name or a place others use.
  const teaching = gospel && es.some((e) => e.jesus);
  const opener = teaching
    ? 'Jesus most likely taught in Aramaic, the language most people in Galilee spoke every day.'
    : 'In Jesus’ time many Jews in Galilee and Judea spoke Aramaic every day, alongside Hebrew and Greek.';
  const record = teaching ? `${written}, ${world}, and the oldest record we have of his words is in Greek.` : `${written}, ${world}.`;
  let kept: string;
  if (lang === null) {
    // Matthew 5:22: Raca (Aramaic) and Gehenna (Aramaic or Hebrew), each named.
    const each = es.map((e) => `${e.word} ${e.language === 'Aramaic or Hebrew' ? 'could be Aramaic or Hebrew' : `is ${e.language}`}`);
    kept = `Here ${writer} kept the sound of ${noun}: ${each.join(', and ')}.`;
  } else if (lang === 'Aramaic') {
    kept = es.every((e) => e.certainty === 'widely agreed') ? `Here ${writer} kept the sound of the Aramaic ${noun}.` : `Here ${writer} kept the sound of the ${noun}, which most read as Aramaic.`;
  } else {
    kept = `Here ${writer} kept the sound of the original ${noun}, Aramaic or Hebrew: the two languages are close.`;
  }
  return { title: 'Why is the rest in Greek?', body: `${opener} ${record} ${kept} ${letters}` };
}

/** Text with verse names as links that take the reader there. */
function RichText({ a, text, navigate }: { a: Atlas; text: Rich; navigate: Go }) {
  if (typeof text === 'string') return <>{text}</>;
  return (
    <>
      {text.map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : (
          <button key={i} type="button" class="x-aramaic-go" onClick={() => navigate(p.verse)}>
            {p.text ?? refName(a, p.verse, p.to)}
          </button>
        ),
      )}
    </>
  );
}

function Sure({ c }: { c: Certainty }) {
  return c === 'widely agreed' ? <>widely agreed</> : <Unsure>{c}</Unsure>;
}

/** "A, B and C". */
function Joined({ children }: { children: ComponentChildren[] }) {
  return (
    <>
      {children.map((c, i) => (
        <span key={i}>
          {i > 0 && (i === children.length - 1 ? ' and ' : ', ')}
          {c}
        </span>
      ))}
    </>
  );
}

function hebrewLang(l: Language): string {
  return l === 'Hebrew' ? 'hbo' : 'arc';
}

// ------------------------------------------------------------ a word

/** Simple: the word as readers say it, its meaning, who says it, and the note. */
function Word({ a, e, verse, navigate }: { a: Atlas; e: Entry; verse: VerseRef; navigate: Go }) {
  const i = Math.max(0, e.verses.indexOf(verse));
  const bsb = e.bsb[i];
  // A translation ("hell") or a respelling ("Saul, Saul"): say what the English has.
  const differs = bsb.toLowerCase() !== e.word.toLowerCase();
  return (
    <section class="x-aramaic-word" aria-label={e.word}>
      <p class="x-aramaic-say">
        {e.word}
        {e.certainty === 'scholars differ' && (
          <>
            {' '}
            <Unsure>scholars differ</Unsure>
          </>
        )}
      </p>
      <p class="x-aramaic-means">{e.meaningFrom === 'verse' ? `“${e.meaning}”` : `Meaning: ${e.meaning}`}</p>
      {differs && <p class="x-aramaic-meta">The English here has “{bsb}”.</p>}
      <p class="x-aramaic-meta">
        {e.language} · {verbOf(e)} {speakerAt(e, verse)}
      </p>
      <p class="x-aramaic-note">
        <RichText a={a} text={e.note} navigate={navigate} />
      </p>
    </section>
  );
}

/** Study: the word in square letters beside the Greek letters of the Greek
 * text, each marked where it is uncertain. */
function Scripts({ e, verse }: { e: Entry; verse: VerseRef }) {
  const i = Math.max(0, e.verses.indexOf(verse));
  // null: the Greek shown is the main Greek text. Otherwise the English
  // follows other manuscripts (Bethesda), and the main text reads `main`.
  const main = e.mainReading[i] ?? null;
  return (
    <>
      <div class="x-aramaic-scripts">
        <figure class="x-aramaic-script">
          <figcaption>
            {e.lettersCaption || e.language}
            {!e.lettersCaption && e.certainty === 'scholars differ' && (
              <>
                {' '}
                <Unsure>a suggested form</Unsure>
              </>
            )}
          </figcaption>
          <p class="he x-aramaic-sq" lang={hebrewLang(e.language)}>
            {e.aramaic}
          </p>
        </figure>
        <figure class="x-aramaic-script">
          <figcaption>
            {main === null ? (
              'In the Greek text'
            ) : (
              <>
                The spelling the English follows <Unsure>manuscripts differ</Unsure>
              </>
            )}
          </figcaption>
          <p class="gr x-aramaic-gk" lang="grc">
            {e.greek[i]}
          </p>
        </figure>
      </div>
      {e.lettersNote && <p class="x-aramaic-hint">{e.lettersNote}</p>}
      {main && (
        <p class="x-aramaic-hint">
          The main Greek text, shown under the verse, reads{' '}
          <span class="gr" lang="grc">
            {main}
          </span>
          .
        </p>
      )}
    </>
  );
}

/** Deep: the detail, how sure it is, its roots' word studies, and the sources. */
function EntryDeep({ a, data, deep, e, verse, row, navigate }: { a: Atlas; data: Data; deep: DeepFile; e: Entry; verse: VerseRef; row: VerseRow | undefined; navigate: Go }) {
  const d = deep.entries[e.id];
  const L = a.lemmas;
  const roots = e.roots.filter((r) => r >= 0 && r < L.key.length);
  const pos = (r: number) => {
    const at = row ? row[1].findIndex((w) => w[3] === r) : -1;
    return at >= 0 ? at : undefined;
  };
  const places = e.verses.map((v) =>
    v === verse ? (
      <span key={v}>{refName(a, v)}</span>
    ) : (
      <button key={v} type="button" class="x-aramaic-go" onClick={() => navigate(v)}>
        {refName(a, v)}
      </button>
    ),
  );
  return (
    <>
      <h3>{e.word}: more detail</h3>
      {d && (
        <p>
          <RichText a={a} text={d.deep} navigate={navigate} />
        </p>
      )}
      {d?.aramaicNote && (
        <p class="x-aramaic-hint">
          <RichText a={a} text={d.aramaicNote} navigate={navigate} />
        </p>
      )}
      <Facts
        rows={[
          ['Language', e.language],
          ['How sure', <Sure c={e.certainty} />],
          [cap(verbOf(e)), speakerAt(e, verse)],
          ['Kept in', <Joined>{places}</Joined>],
        ]}
      />
      <h3>Word study</h3>
      <ul class="x-aramaic-roots">
        {roots.map((r) => {
          const info = data.roots.get(r);
          return (
            <li key={r}>
              <button type="button" class="x-aramaic-root" onClick={() => openWord(r, verse, pos(r))} title={`Open the word study of ${L.key[r]}`}>
                <span class="gr" lang="grc">
                  {L.word[r]}
                </span>{' '}
                <span>“{L.gloss[r]}”</span> <span aria-hidden="true">›</span>
              </button>
              <span class="x-aramaic-hint">
                {' '}
                {langName(L, r)} · {L.key[r]}
                {info && (
                  <>
                    {' '}
                    · <Sure c={info.certainty} />
                  </>
                )}
              </span>
              {deep.roots[r] && <p class="x-aramaic-hint">{deep.roots[r]}</p>}
            </li>
          );
        })}
      </ul>
      {d && d.sources.length > 0 && (
        <>
          <h3>Sources</h3>
          <ul class="x-aramaic-sources">
            {d.sources.map((s, k) => (
              <li key={k}>{s}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** extras/aramaic/deep.json at Deep: undefined while it loads, null if it failed. */
function useDeep(a: Atlas): DeepFile | null | undefined {
  const file = useJson<DeepFile>(a, levelAtLeast('deep') ? 'extras/aramaic/deep.json' : null);
  if (file === undefined) return undefined;
  return file && file.format === 1 && file.entries && file.sections && file.roots ? file : null;
}

function EntriesPanel({ a, data, verse, entries, navigate }: { a: Atlas; data: Data; verse: VerseRef; entries: Entry[]; navigate: Go }) {
  const study = levelAtLeast('study');
  const deep = levelAtLeast('deep');
  const file = useDeep(a);
  const rows = usePassage(a, verse);
  const w = why(a, verse, entries);
  const langs = new Set(entries.map((e) => e.language));
  const one = langs.size === 1 ? entries[0].language : null;
  const original = one && one !== 'Aramaic or Hebrew' ? `the ${one}` : 'the original words';
  return (
    <>
      <Lead>{entryLead(a, verse, entries)}</Lead>
      {entries.map((e) => (
        <div key={e.id} class="x-aramaic-entry">
          <Word a={a} e={e} verse={verse} navigate={navigate} />
          {study && <Scripts e={e} verse={verse} />}
        </div>
      ))}
      {study && (
        <p class="x-aramaic-hint">The Greek letters are what the New Testament has. The square letters are how scholars write the word in its own language, marked where that is only a suggestion.</p>
      )}
      <Passage a={a} from={verse} navigate={navigate} />
      <h3>{w.title}</h3>
      <p>{w.body}</p>
      <GoDeeper to="study">See {original} and the Greek letters</GoDeeper>
      {study && <GoDeeper to="deep">See the scholarly detail and sources</GoDeeper>}
      {deep &&
        (file === undefined ? <p class="xt-wait">…</p> : file && entries.map((e) => <EntryDeep key={e.id} a={a} data={data} deep={file} e={e} verse={verse} row={rows?.[0]} navigate={navigate} />))}
      <SourceNote>
        {deep
          ? 'Words checked against the Berean Standard Bible (public domain) and STEPBible’s Greek text, TAGNT (CC BY 4.0); their languages rest on STEPBible’s lexicon TBESG (CC BY 4.0) and the scholarly works cited above.'
          : 'From the Berean Standard Bible (public domain) and STEPBible’s Greek and Hebrew texts (CC BY 4.0).'}
      </SourceNote>
    </>
  );
}

// ------------------------------------------------------------ an Old Testament section

/** The verse's words in the original, in runs of Hebrew and Aramaic. */
function Runs({ s, verse, row }: { s: Section; verse: VerseRef; row: VerseRow | undefined }) {
  if (!row) return <p class="xt-wait">…</p>;
  const marked = new Set(verse === s.from && !s.tahot ? s.words : []);
  const runs: { aramaic: boolean; words: { w: VerseRow[1][number]; i: number }[] }[] = [];
  row[1].forEach((w, i) => {
    if (w[5] & FLAG.otherEditions) return;
    const aramaic = !!(w[5] & FLAG.aramaic) || marked.has(i + 1);
    const last = runs[runs.length - 1];
    if (last && last.aramaic === aramaic) last.words.push({ w, i });
    else runs.push({ aramaic, words: [{ w, i }] });
  });
  return (
    <div class="x-aramaic-runs">
      {runs.map((r, k) => (
        <div key={k} class={`x-aramaic-run${r.aramaic ? ' x-aramaic-on' : ''}`}>
          <span class="x-aramaic-tag">{r.aramaic ? 'Aramaic' : 'Hebrew'}</span>
          <p class="he x-aramaic-verse" lang={r.aramaic ? 'arc' : 'hbo'}>
            {r.words.map(({ w, i }) => (
              <span key={i}>
                <button type="button" class="x-aramaic-w" onClick={() => w[3] >= 0 && openWord(w[3], verse, i)} title={`${w[1]} · ${w[2]}`}>
                  {w[0]}
                </button>{' '}
              </span>
            ))}
          </p>
        </div>
      ))}
    </div>
  );
}

function sectionLead(a: Atlas, s: Section): string {
  if (s.words.length) return `Most of the Old Testament is in Hebrew, but ${NUMBER[s.words.length] ?? s.words.length} words of ${refName(a, s.from)} are Aramaic.`;
  return `Most of the Old Testament is in Hebrew, but ${refName(a, s.from, s.to)} was written in Aramaic.`;
}

function SectionPanel({ a, s, verse, navigate }: { a: Atlas; s: Section; verse: VerseRef; navigate: Go }) {
  const study = levelAtLeast('study');
  const deep = levelAtLeast('deep');
  const file = useDeep(a);
  const rows = usePassage(a, verse);
  const d = file?.sections[s.id];
  const count = s.to - s.from + 1;
  return (
    <>
      <Lead>{sectionLead(a, s)}</Lead>
      <p class="x-aramaic-note">
        <RichText a={a} text={s.note} navigate={navigate} />
      </p>
      {study && (
        <>
          <h3>{refName(a, verse)} in the original</h3>
          <Runs s={s} verse={verse} row={rows?.[0]} />
          <p class="x-aramaic-hint">Hebrew and Aramaic are written from right to left, in the same letters. Tap a word for its word study.</p>
        </>
      )}
      <Passage a={a} from={verse} navigate={navigate} />
      <h3>Why Aramaic?</h3>
      <p>Aramaic is a language close to Hebrew and written in the same letters. It became the shared language of the Babylonian and Persian empires.</p>
      <GoDeeper to="study">See the Aramaic words</GoDeeper>
      {study && <GoDeeper to="deep">See the scholarly detail and sources</GoDeeper>}
      {deep &&
        (file === undefined ? (
          <p class="xt-wait">…</p>
        ) : (
          <>
            <h3>More detail</h3>
            {d && (
              <p>
                <RichText a={a} text={d.deep} navigate={navigate} />
              </p>
            )}
            <Facts
              rows={[
                [
                  'Where',
                  <button type="button" class="x-aramaic-go" onClick={() => navigate(s.from)}>
                    {refName(a, s.from, s.to)}
                  </button>,
                ],
                ['Verses', count === 1 ? (s.words.length ? `${NUMBER[s.words.length] ?? s.words.length} words of one verse` : 'one verse') : `${count} verses`],
                [
                  'How it was checked',
                  s.tahot
                    ? 'The build checks that STEPBible’s TAHOT tags every word here Aramaic, and the verses on either side Hebrew.'
                    : 'TAHOT tags these words Hebrew. The build checks that the lexicon (TBESH) and the BSB’s own footnote call them Aramaic, and that their roots occur nowhere else.',
                ],
              ]}
            />
            {d && d.sources.length > 0 && (
              <>
                <h3>Sources</h3>
                <ul class="x-aramaic-sources">
                  {d.sources.map((x, k) => (
                    <li key={k}>{x}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        ))}
      <SourceNote>
        {deep
          ? 'Hebrew and Aramaic: the Leningrad Codex via STEPBible’s TAHOT, with its lexicon TBESH (CC BY 4.0). English and footnotes: the Berean Standard Bible (public domain).'
          : 'From the Berean Standard Bible (public domain) and STEPBible’s Hebrew text (CC BY 4.0).'}
      </SourceNote>
    </>
  );
}

// ------------------------------------------------------------ the panels

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const at = data.verses.get(verse);
  if (at?.section) return <SectionPanel a={a} s={at.section} verse={verse} navigate={navigate} />;
  if (at?.entries.length) return <EntriesPanel a={a} data={data} verse={verse} entries={at.entries} navigate={navigate} />;
  return null;
}

export function ChapterPanel({ a, data, chapter, navigate }: ChapterPanelProps<Data>) {
  const c = data.chapters.get(chapterKey(chapter));
  if (!c) return null;
  // The section's first verse in this chapter.
  const verse = Math.max(c.section.from, verseIndex(a, chapter.book, chapter.chapter, 1));
  return <SectionPanel a={a} s={c.section} verse={verse} navigate={navigate} />;
}
