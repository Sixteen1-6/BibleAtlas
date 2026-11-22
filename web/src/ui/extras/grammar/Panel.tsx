// Word choice: the panels. A verse's panel shows what stands out (a doubled
// "not", a chain, a list), its linking words and what each looks back to, every
// verb's form, and its rare words; then what each form is. Every point sits
// on a word the reader can tap for its word study, and each verb carries its
// tag with STEPBible's own expansion of it. What a form means is shown only
// in a grammarian's own words, with the page it was read on, and those words
// wait behind the commentary notice: they are people's words, where the
// forms are the text's own. So does a Christian writer's sentence on what a
// form shows in this one verse (config/grammar-notes.json): his words, under
// his name and his work, with the way to his whole note.
//
// A chapter's panel is its outline: paragraph by paragraph, the linking
// words, chains and lists, each a link to its verse.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { type Atlas, chapterRange, label, locate } from '../../../data/atlas';
import { FLAG, type VerseRow, type WordRow, loadBook } from '../../../data/text';
import { Commentary, CommentaryFoot } from '../../commentary/Gate';
import { useJson } from '../data';
import { Lead, Passage, SourceNote, Unsure, openWord, refName, showSources, usePassage } from '../kit';
import { openExtra } from '../open';
import type { ChapterPanelProps, PanelProps, VerseRef } from '../types';
import { type IndexFile as VoicesIndex, WORKS } from '../voices/model';
import { type At, type BookFile, type CodesFile, type Data, type Note, type Point, SOURCE, type Term, bookFile, day, verbCode } from './model';

const WAIT = <p class="xt-lead xt-wait">…</p>;

/** The word-by-word English without its marks: "certainly <to die>" is "certainly to die". */
function english(w: WordRow): string {
  return w[2]
    .replace(/[<>[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:!?]+$/, '');
}

/** The word without the punctuation that follows it. */
function bare(w: WordRow): string {
  return w[0].replace(/[.,;·:!?׃]+$/u, '');
}

/** One original word with its English, a way into its word study. */
function Word({ a, at, w }: { a: Atlas; at: At; w: WordRow | undefined }) {
  if (!w) return null;
  const he = a.books[a.verseBook[at[0]]].testament === 'OT';
  const inner = (
    <>
      <span class={`x-grammar-orig ${he ? 'he' : 'gr'}`} lang={he ? 'hbo' : 'grc'}>
        {bare(w)}
      </span>
      <span class="x-grammar-eng">{english(w)}</span>
    </>
  );
  return w[3] >= 0 ? (
    <button type="button" class="x-grammar-word" onClick={() => openWord(w[3], at[0], at[1])} title={`${w[1]}: open its word study`}>
      {inner}
    </button>
  ) : (
    <span class="x-grammar-word">{inner}</span>
  );
}

function Words({ a, ats, find }: { a: Atlas; ats: At[]; find: (at: At) => WordRow | undefined }) {
  const he = ats.length > 0 && a.books[a.verseBook[ats[0][0]]].testament === 'OT';
  return (
    <div class="x-grammar-words" dir={he ? 'rtl' : undefined}>
      {ats.map((at) => (
        <Word key={`${at[0]}.${at[1]}`} a={a} at={at} w={find(at)} />
      ))}
    </div>
  );
}

/** What the tags show of a form: true wherever the form stands. */
function TermCard({ term, where }: { term: Term; where: string }) {
  return (
    <div class="x-grammar-term">
      <h4>{term.name}</h4>
      <p>{term.fact.replace('{where}', where)}</p>
    </div>
  );
}

/** What a form conveys, in a grammarian's own words: each quotation with its
 * page, then the work they were read in, named once. People's words about
 * the language, so they wait behind the commentary notice. */
function SaysCard({ data, term }: { data: Data; term: Term }) {
  const says = term.says ?? [];
  const works = data.works.filter((w) => says.some((s) => s.work === w.id));
  if (!term.plain || !works.length) return null;
  return (
    <div class="x-grammar-term">
      <h4>{term.name}</h4>
      <p class="x-grammar-plain">{term.plain}</p>
      {works.map((work) => {
        const mine = says.filter((s) => s.work === work.id);
        const days = [...new Set(mine.map((s) => s.read))];
        return (
          <figure key={work.id} class="x-grammar-says">
            {mine.map((s, i) => (
              <blockquote key={i}>
                “{s.quote}”{' '}
                <a class="x-grammar-page" href={s.url} target="_blank" rel="noopener noreferrer">
                  page {s.page}
                  <span class="sr-only"> at {work.site} (opens a new tab)</span> <span aria-hidden="true">↗</span>
                </a>
              </blockquote>
            ))}
            <figcaption>
              {work.writer}, {work.about}:{' '}
              <button type="button" class="x-grammar-shelf" onClick={() => showSources(work.shelf)}>
                {work.title}
              </button>{' '}
              ({work.written}). Read at {work.site} on {days.map(day).join(' and ')}.
            </figcaption>
          </figure>
        );
      })}
      {term.care && <p class="x-grammar-care">{term.care}</p>}
    </div>
  );
}

/** A Christian writer's sentence on a form of this verse: the word and the
 * form it speaks of, his words, then who he is and the work, as the
 * Christian writers panel names them, and the way to his whole note. */
function NoteCard({ a, data, note, verse, by, find }: { a: Atlas; data: Data; note: Note; verse: VerseRef; by: string | null; find: (at: At) => WordRow | undefined }) {
  const [w, pos, terms, words] = note;
  const work = WORKS[w];
  if (!work) return null;
  return (
    <div class="x-grammar-term x-grammar-on">
      <div class="x-grammar-onhead">
        {pos >= 0 && <Word a={a} at={[verse, pos]} w={find([verse, pos])} />}
        <h4>{names(data, terms)}</h4>
      </div>
      <figure class="x-grammar-says">
        <blockquote>“{words}”</blockquote>
        <figcaption>
          From {by ?? work.name}’s note on this passage. {work.book}.{' '}
          <button type="button" class="x-grammar-shelf" onClick={(e) => openExtra('voices', 'verse', verse, e.currentTarget)}>
            Read the whole note
          </button>
          {' · '}
          <button type="button" class="x-grammar-shelf" onClick={() => showSources(work.shelf)}>
            Where it was read
          </button>
        </figcaption>
      </figure>
    </div>
  );
}

function names(data: Data, ids: number[]): string {
  return ids.map((i) => data.terms[i]?.name ?? '').filter(Boolean).join(' · ');
}

/** The verses a set of points reaches, around `verse`. */
function reach(book: BookFile | null | undefined, pts: Point[], verse: VerseRef): [VerseRef, VerseRef] {
  let [lo, hi] = [verse, verse];
  if (!book) return [lo, hi];
  const take = (ats: At[]) => {
    for (const [v] of ats) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  };
  for (const p of pts) {
    if (p[0] === 'c') take(book.chains[p[1]]?.[1] ?? []);
    else if (p[0] === 'l') take(book.lists[p[1]] ?? []);
  }
  return [lo, hi];
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const loc = locate(a, verse);
  const old = a.books[loc.book].testament === 'OT';
  const book = useJson<BookFile>(a, bookFile(a, loc.book));
  const codes = useJson<CodesFile>(a, `extras/grammar/codes-${old ? 'h' : 'g'}.json`);
  const pts = book?.v[String(verse)] ?? [];
  const notes = book?.notes?.[String(verse)] ?? [];
  // Who wrote a work's notes on this book, where the work has several writers.
  const voices = useJson<VoicesIndex>(a, notes.length ? 'extras/voices.json' : null);
  const by = (w: number): string | null => voices?.writers?.find((x) => x[0] === w && x[2].includes(loc.book))?.[1] ?? null;
  const [lo, hi] = reach(book, pts, verse);
  const rows = usePassage(a, lo, hi);
  if (!book || !rows) return WAIT;
  if (!pts.length) return null;

  const find = (at: At): WordRow | undefined => rows[at[0] - lo]?.[1][at[1]];
  const here = (pos: number): At => [verse, pos];
  const where = old ? 'Old Testament' : 'New Testament';

  const verbs = pts.filter((p): p is ['v', number, number[]] => p[0] === 'v');
  const made = pts.filter((p): p is ['x', number, number[]] => p[0] === 'x');
  const links = pts.filter((p): p is ['j', number, number, number?, number?] => p[0] === 'j');
  const rare = pts.filter((p): p is ['r', number, number, number?] => p[0] === 'r');
  const chains = pts.filter((p): p is ['c', number] => p[0] === 'c').map((p) => book.chains[p[1]]);
  const lists = pts.filter((p): p is ['l', number] => p[0] === 'l').map((p) => book.lists[p[1]]);

  // Every term this verse shows, in the order the reader meets them.
  const shown: number[] = [];
  const show = (i: number) => {
    if (data.terms[i] && !shown.includes(i)) shown.push(i);
  };
  for (const m of made) show(m[1]);
  for (const c of chains) show(c[0]);
  const listTerm = data.terms.findIndex((t) => t.id === 'list');
  if (lists.length) show(listTerm);
  for (const v of verbs) v[2].forEach(show);
  const rareTerm = data.terms.findIndex((t) => t.id === 'rare');
  if (rare.length) show(rareTerm);

  const said = shown.filter((i) => data.terms[i].plain && data.terms[i].says?.length);

  const span = (ats: At[]) => refName(a, ats[0][0], ats[ats.length - 1][0]);
  const stands = made.length + chains.length + lists.length > 0;

  return (
    <>
      <Lead>What the forms of this verse’s own words show. Each point sits on a word; tap the word for its meaning.</Lead>
      <Passage a={a} from={verse} navigate={navigate} />

      {stands && <h3>What stands out</h3>}
      {made.map((m, i) => (
        <section key={`x${i}`} class="x-grammar-point">
          <h4>{data.terms[m[1]].name}</h4>
          <Words a={a} ats={m[2].map(here)} find={find} />
          <p>{data.terms[m[1]].fact}</p>
        </section>
      ))}
      {chains.map((c, i) => (
        <section key={`c${i}`} class="x-grammar-point">
          <h4>
            {data.terms[c[0]].name}: {c[1].length}
            {c[1][0][0] !== c[1][c[1].length - 1][0] && <span class="x-grammar-span"> across {span(c[1])}</span>}
          </h4>
          <Words a={a} ats={c[1]} find={find} />
          <p>{data.terms[c[0]].fact}</p>
        </section>
      ))}
      {lists.map((l, i) => (
        <section key={`l${i}`} class="x-grammar-point">
          <h4>A list of {l.length}</h4>
          <Words a={a} ats={l} find={find} />
          <p>{data.terms[listTerm]?.fact} Tap a word for its meaning.</p>
        </section>
      ))}

      {links.length > 0 && <h3>Linking words</h3>}
      {links.map((j, i) => {
        const link = data.links[j[2]];
        if (!link) return null;
        return (
          <section key={`j${i}`} class="x-grammar-point x-grammar-link">
            <Word a={a} at={here(j[1])} w={find(here(j[1]))} />
            <div>
              <p>
                <strong>{link.name}.</strong> {link.plain}
              </p>
              {j[3] !== undefined && j[4] !== undefined && (
                <p class="x-grammar-back">
                  It opens this verse, so it looks back to{' '}
                  <button type="button" class="x-grammar-ref" onClick={() => navigate(j[3] as number)}>
                    {refName(a, j[3], j[4])}
                  </button>
                  , the {book.starts.includes(verse) ? 'paragraph before it' : j[3] === j[4] ? 'verse before it in this paragraph' : 'verses before it in this paragraph'}
                  .<Unsure title="The paragraphs are the Berean Standard Bible’s. How far back a linking word reaches is for the reader to weigh.">how far back is a judgment</Unsure>
                </p>
              )}
            </div>
          </section>
        );
      })}

      {verbs.length > 0 && <h3>{verbs.length === 1 ? 'The verb' : 'The verbs'}</h3>}
      {verbs.length > 0 && (
        <ul class="x-grammar-verbs">
          {verbs.map((v, i) => {
            const w = find(here(v[1]));
            if (!w) return null;
            const code = verbCode(w[4]);
            const step = codes?.codes[code];
            return (
              <li key={i}>
                <Word a={a} at={here(v[1])} w={w} />
                <div>
                  <p class="x-grammar-names">{names(data, v[2])}</p>
                  <p class="x-grammar-tag">
                    <span class="x-grammar-code">{code}</span>
                    {step && (
                      <>
                        {' '}
                        {step[0]}
                        {step[1] && <>: “{step[1]}”</>}
                      </>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {verbs.length > 0 && codes && (
        <p class="x-grammar-note">
          Under each verb: its tag, then{' '}
          <button type="button" class="x-grammar-ref" onClick={() => showSources('step-morph')}>
            STEPBible’s expansion of each grammar tag
          </button>
          , word for word.
        </p>
      )}

      {rare.length > 0 && <h3>{rare.length === 1 ? 'A rare word' : 'Rare words'}</h3>}
      {rare.map((r, i) => (
        <section key={`r${i}`} class="x-grammar-point x-grammar-link">
          <Word a={a} at={here(r[1])} w={find(here(r[1]))} />
          <p>
            {r[2] === 1 ? `Used only here in the ${where}.` : `Used only twice in the ${where}.`}
            {r[3] !== undefined && (
              <>
                {' '}
                The other place is{' '}
                <button type="button" class="x-grammar-ref" onClick={() => navigate(r[3] as number)}>
                  {label(a, r[3])}
                </button>
                .
              </>
            )}
          </p>
        </section>
      ))}

      {shown.length > 0 && <h3>What these forms are</h3>}
      {shown.map((i) => (
        <TermCard key={i} term={data.terms[i]} where={where} />
      ))}
      {said.length + notes.length > 0 && (
        <>
          <h3>What these forms convey</h3>
          <Commentary
            line={
              notes.length
                ? 'A Christian writer’s own words on this verse’s forms, and a grammarian’s on what such forms convey.'
                : 'A grammarian’s own sentences on these forms, each with the page it was read on.'
            }
            button={notes.length ? 'Show their words' : 'Show the grammarian’s words'}
          >
            {notes.length > 0 && <h4 class="x-grammar-sub">On this verse</h4>}
            {notes.map((n, i) => (
              <NoteCard key={`n${i}`} a={a} data={data} note={n} verse={verse} by={by(n[0])} find={find} />
            ))}
            {notes.length > 0 && said.length > 0 && <h4 class="x-grammar-sub">On these forms in general</h4>}
            {said.map((i) => (
              <SaysCard key={i} data={data} term={data.terms[i]} />
            ))}
          </Commentary>
          <CommentaryFoot />
        </>
      )}
      <SourceNote>{SOURCE} Paragraphs from the Berean Standard Bible.</SourceNote>
    </>
  );
}

/** The first words of a verse, to say where a point sits. */
function opening(text: string, max = 46): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20))}…`;
}

function useChapter(a: Atlas, book: number, chapter: number): VerseRow[] | null {
  const [got, setGot] = useState<{ key: string; rows: VerseRow[] } | null>(null);
  const key = `${book}.${chapter}`;
  useEffect(() => {
    let live = true;
    loadBook(a, book).then(
      (t) => live && setGot({ key, rows: t.chapters[chapter - 1] ?? [] }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [a, key]);
  return got && got.key === key ? got.rows : null;
}

export function ChapterPanel({ a, data, chapter, navigate }: ChapterPanelProps<Data>) {
  const book = useJson<BookFile>(a, bookFile(a, chapter.book));
  const rows = useChapter(a, chapter.book, chapter.chapter);
  if (!book || !rows) return WAIT;
  const [from, to] = chapterRange(a, chapter.book, chapter.chapter);
  const starts = new Set(book.starts);

  // Paragraph by paragraph, the verses that carry a link, a chain or a list.
  const paras: { from: VerseRef; to: VerseRef; rows: { v: VerseRef; marks: ComponentChildren[] }[] }[] = [];
  for (let v = from; v < to; v++) {
    if (v === from || starts.has(v)) paras.push({ from: v, to: v, rows: [] });
    const para = paras[paras.length - 1];
    para.to = v;
    const words = rows[v - from]?.[1] ?? [];
    const marks: ComponentChildren[] = [];
    for (const p of book.v[String(v)] ?? []) {
      if (p[0] === 'j') {
        const link = data.links[p[2]];
        const w = words[p[1]];
        if (link && w && !(w[5] & FLAG.otherEditions)) marks.push(<strong>{link.name}</strong>);
      } else if (p[0] === 'c') {
        const c = book.chains[p[1]];
        if (c && c[1][0][0] === v) marks.push(`${data.terms[c[0]]?.name.replace(/^A /, '').replace(/^./, (x) => x.toUpperCase())} (${c[1].length})`);
      } else if (p[0] === 'l') {
        const l = book.lists[p[1]];
        if (l) marks.push(`List of ${l.length}`);
      }
    }
    if (marks.length) para.rows.push({ v, marks });
  }
  const shown = paras.filter((p) => p.rows.length);
  const used = new Set<number>();
  for (let v = from; v < to; v++) for (const p of book.v[String(v)] ?? []) if (p[0] === 'j') used.add(p[2]);
  if (!shown.length) return null;
  return (
    <>
      <Lead>How this chapter’s thoughts are joined: its linking words, chains and lists, paragraph by paragraph. Tap a verse to read it.</Lead>
      {shown.map((p) => (
        <section key={p.from} class="x-grammar-para">
          <h4>{refName(a, p.from, p.to)}</h4>
          <ol>
            {p.rows.map((r) => (
              <li key={r.v}>
                <button type="button" class="x-grammar-ref" onClick={() => navigate(r.v)}>
                  {locate(a, r.v).verse}
                </button>
                <span>
                  {r.marks.map((m, i) => (
                    <span key={i}>
                      {i > 0 && ' · '}
                      {m}
                    </span>
                  ))}
                  <span class="x-grammar-open"> {opening(rows[r.v - from]?.[0] ?? '')}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <h3>What the linking words do</h3>
      <dl class="x-grammar-key">
        {data.links.map(
          (l, i) =>
            used.has(i) && (
              <div key={l.id}>
                <dt>{l.name}</dt>
                <dd>{l.plain}</dd>
              </div>
            ),
        )}
      </dl>
      <SourceNote>{SOURCE} Paragraphs from the Berean Standard Bible.</SourceNote>
    </>
  );
}
