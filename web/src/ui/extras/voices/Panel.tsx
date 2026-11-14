// The panel behind the "Christian writers" line: each writer's own words,
// oldest first, long ones folded, with places elsewhere to read more on the
// verse. It shows only once the reader has finished the commentary notice
// (VerseExtras.tsx shows its closed state until then). Never presented as the
// app's own claim, or as Scripture.

import '../voices.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Atlas } from '../../../data/atlas';
import { CommentaryFoot } from '../../commentary/Gate';
import { useJson } from '../data';
import { Facts, Lead, SourceNote, refName, showSources, verseHash } from '../kit';
import type { PanelProps, VerseRef } from '../types';
import { elsewhere } from './links';
import { type Data, FINISHED, type Item, JFB, KD, LEFT_OUT, OLDEST_FIRST, type PartFile, type Run, type Text, SOURCE, WORKS, fullOf, kdOf, nameFrom, notesOn, partOf, writerOf } from './model';

/** About this many characters of a long note show before "Read all". */
const FOLD = 600;
/** The Fathers shown on a passage before "Show more". */
const FIRST_FATHERS = 4;

/** Who some of the Catena's names are, where the name alone could mislead. */
const WHO: Record<string, string> = {
  Gloss: 'notes written in the margins of medieval Bibles',
  'Greek Expositor': 'a Greek writer Aquinas does not name',
  'Pseudo-Chrysostom': 'a writer once thought to be Chrysostom',
  'Pseudo-Jerome': 'a writer once thought to be Jerome',
  'Pseudo-Augustine': 'a writer once thought to be Augustine',
  'Pseudo-Athanasius': 'a writer once thought to be Athanasius',
  Josephus: 'the Jewish historian of the first century',
};

/** A note's words as paragraphs of runs. */
function paragraphs(text: Text): Run[][] {
  const runs = typeof text === 'string' ? [text] : text;
  const out: Run[][] = [[]];
  for (const r of runs) {
    if (typeof r !== 'string') {
      out[out.length - 1].push(r);
      continue;
    }
    r.split('\n\n').forEach((part, k) => {
      if (k > 0) out.push([]);
      if (part) out[out.length - 1].push(part);
    });
  }
  return out.filter((p) => p.length > 0);
}

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

/** A Father's quotation opens with where it comes from, in brackets:
 * "(Hom. iv. in Joan.) While all ...". */
function leadingCite(ps: Run[][]): [string, Run[][]] {
  const first = ps[0]?.[0];
  if (typeof first !== 'string') return ['', ps];
  const m = /^(\([^()]{1,80}\))\s+/.exec(first);
  if (!m) return ['', ps];
  const rest = first.slice(m[0].length);
  return [m[1], [[...(rest ? [rest] : []), ...ps[0].slice(1)], ...ps.slice(1)]];
}

function Runs({ a, runs, navigate }: { a: Atlas; runs: Run[]; navigate: (v: VerseRef) => void }) {
  return (
    <>
      {runs.map((r, k) => {
        if (typeof r === 'string') {
          if (!r.includes(LEFT_OUT)) return r;
          return r.split(LEFT_OUT).map((part, j) => (
            <span key={`${k}-${j}`}>
              {j > 0 && <span class="x-voices-gap">{LEFT_OUT}</span>}
              {part}
            </span>
          ));
        }
        const [from, to, text] = r;
        return (
          <a
            key={k}
            class="x-voices-ref"
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

function Voice({ a, who, text, navigate, focus, father }: { a: Atlas; who: string; text: Text; navigate: (v: VerseRef) => void; focus?: boolean; father: boolean }) {
  const [open, setOpen] = useState(false);
  const here = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus) here.current?.focus();
  }, [focus]);
  const [cite, ps] = father ? leadingCite(paragraphs(text)) : ['', paragraphs(text)];
  const long = ps.reduce((n, p) => n + p.reduce((m, r) => m + runLength(r), 0), 0) > FOLD * 1.25;
  const shown = long && !open ? clip(ps, FOLD) : ps;
  return (
    <div class="x-voices-voice" ref={here} tabIndex={focus ? -1 : undefined}>
      {who && (
        <p class="x-voices-who">
          {who}
          {WHO[who] && <span class="x-voices-cite">, {WHO[who]}</span>}
          {cite && <span class="x-voices-cite"> {cite}</span>}
        </p>
      )}
      {shown.map((p, k) => (
        <p key={k} class="x-voices-p">
          <Runs a={a} runs={p} navigate={navigate} />
          {long && !open && k === shown.length - 1 ? '…' : ''}
        </p>
      ))}
      {long && (
        <button type="button" class="x-voices-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Show less' : 'Read all'}
        </button>
      )}
    </div>
  );
}

function Note({ a, verse, item, navigate }: { a: Atlas; verse: VerseRef; item: Item; navigate: (v: VerseRef) => void }) {
  const [all, setAll] = useState(false);
  const [work, from, to, voices, left] = item;
  const more = work === 0 && !all ? voices.length - FIRST_FATHERS : 0;
  const shown = more > 0 ? voices.slice(0, FIRST_FATHERS) : voices;
  return (
    <div class="x-voices-note">
      {(from !== verse || to !== verse) && <p class="x-voices-on">On {nameFrom(a, verse, from, to)}</p>}
      {shown.map(([who, text], k) => (
        <Voice key={k} a={a} who={who} text={text} navigate={navigate} focus={all && k === FIRST_FATHERS} father={work === 0} />
      ))}
      {more > 0 && (
        <button type="button" class="x-voices-more" onClick={() => setAll(true)}>
          Show {more} more of the Fathers
        </button>
      )}
      {left?.map((l) => (
        <p key={l} class="x-voices-quiet">
          {l}
        </p>
      ))}
    </div>
  );
}

function Elsewhere({ a, verse }: { a: Atlas; verse: VerseRef }) {
  const links = elsewhere(a, verse);
  if (links.length === 0) return null;
  return (
    <section class="x-voices-elsewhere" aria-label="Read more elsewhere">
      <h3 class="x-voices-h">Read more on other websites</h3>
      <ul class="x-voices-links">
        {links.map((l) => (
          <li key={l.url}>
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              {l.label}
            </a>
            <span class="x-voices-site">
              {' '}
              <button type="button" class="x-voices-about" onClick={() => showSources(l.shelf)} title={`About ${l.site}, on the Sources shelf`}>
                {l.site}
              </button>
            </span>
          </li>
        ))}
      </ul>
      <p class="x-voices-quiet">Other websites, by writers who hold the Bible to be God’s true word. Nothing from them is copied here.</p>
    </section>
  );
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const partPath = partOf(data, verse);
  const fullPath = fullOf(data, verse);
  const kdPath = kdOf(data, verse);
  const part = useJson<PartFile>(a, partPath);
  const full = useJson<PartFile>(a, fullPath);
  const kd = useJson<PartFile>(a, kdPath);
  const where = refName(a, verse);

  // Any of the files may be missing for a verse; null is a failed fetch.
  const got = [
    [partPath, part],
    [fullPath, full],
    [kdPath, kd],
  ].filter(([path]) => path).map(([, f]) => f as PartFile | null | undefined);
  const file = got.some((f) => f === null) ? null : got.some((f) => f === undefined) ? undefined : { format: 1, items: got.flatMap((f) => (f ? f.items : [])) };
  if (file === null) return <p class="xt-lead">Sorry, these notes could not be shown right now.</p>;
  const notes = file ? notesOn(file, verse) : [];
  return (
    <>
      <Lead>What Christian writers of the past wrote about {where}, in their own words. They are not Scripture, and they do not always agree.</Lead>
      {file === undefined ? (
        <p class="x-voices-p xt-wait">Loading what they wrote…</p>
      ) : (
        OLDEST_FIRST.map((k) => {
          const w = WORKS[k];
          const mine = notes.filter((x) => x[0] === k);
          if (mine.length === 0) return null;
          const who = writerOf(data, k, verse);
          const book = !who
            ? w.book
            : k === FINISHED
              ? 'Writing for Matthew Henry’s Exposition of the Old and New Testament, which Henry wrote as far as Acts before his death in 1714'
              : k === JFB
                ? `Writing in Jamieson, Fausset and Brown’s ${w.book}`
                : k === KD
                  ? `Writing in Keil and Delitzsch’s ${w.book}`
                  : w.book;
          return (
            <section key={k} class="x-voices-work" aria-label={who ?? w.name}>
              <h3 class="x-voices-h">{who ?? w.name}</h3>
              <p class="x-voices-book">
                {book}.{' '}
                <button type="button" class="x-voices-about" onClick={() => showSources(w.shelf)}>
                  About this book
                </button>
              </p>
              {mine.map((item) => (
                <Note key={`${item[1]}-${item[2]}`} a={a} verse={verse} item={item} navigate={navigate} />
              ))}
            </section>
          );
        })
      )}
      <Elsewhere a={a} verse={verse} />
      <h3 class="x-voices-h">How these are chosen</h3>
      <Facts
        rows={[
          ['The Church Fathers', 'On the Gospels only: the early and medieval teachers Aquinas quoted on each passage, under their names. In this copy his few short words joining one quotation to the next are part of the quotation before them.'],
          ['Matthew Henry’s full commentary', 'Each of his sections shows with every verse it covers, under the title his commentary gives it. The King James verses it prints before each comment, and its prefaces and chapter outlines, are left out. He wrote as far as Acts; from Romans on, the notes are by the ministers who finished his work after he died, under their own names where a printed list names them. A passage that says a word of Scripture is a mistake is left out, and marked where it was.'],
          ['Matthew Henry’s Concise Commentary', 'A later shortening of his commentary, placed by its own headings, such as “Verses 1–9”. A chapter it treats as a whole shows with every verse in it.'],
          ['John Calvin', 'Each note shows with the verse he comments on. On Matthew, Mark and Luke he wrote one Harmony of the three, filed under Matthew: where this copy has no note of his on a passage of Mark or Luke, his notes on the same passage in Matthew show there. The verses the copy prints before his notes, in English and Latin, are left out. Not shown on 1 and 2 Timothy and Titus, which this copy keeps only in part; he wrote no commentary on 2 and 3 John or Revelation, and his Old Testament commentaries are not here yet. A passage that says a word of Scripture is a mistake is left out, and marked where it was.'],
          ['John Wesley', 'Each note shows with the verse it is on.'],
          ['Keil and Delitzsch', 'On the Old Testament: each note shows with the verses the copy links it to, under the one of the two scholars who wrote that book, C. F. Keil or Franz Delitzsch. Their introductions to the books are left out, and so is Delitzsch’s Ecclesiastes, because he holds that Solomon did not write it. A passage that denies what the text says of its writer, or says a word of Scripture is a mistake, is left out, and marked where it was. Footnotes follow their paragraph.'],
          ['Jamieson, Fausset and Brown', 'Each note shows with the verse it is on, or with every verse where the copy joins several, under the one of the three ministers who wrote that book: Robert Jamieson, A. R. Fausset or David Brown. Its introductions to the Bible, its books and chapters are left out. A passage that says a word of Scripture is a mistake is left out, and marked where it was.'],
          ['Verse numbers', 'The notes are placed by the King James Version’s verse numbers, which match the Berean Standard Bible’s almost everywhere.'],
        ]}
      />
      <CommentaryFoot />
      <SourceNote>{SOURCE}</SourceNote>
    </>
  );
}
