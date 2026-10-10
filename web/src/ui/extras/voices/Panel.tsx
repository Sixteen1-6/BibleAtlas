// The panel behind the "Christian writers" line. Until the reader chooses to
// see them, it says who wrote about the verse and what these notes are, with
// one button to show them. Then each writer's own words, oldest first, long
// ones folded, with places elsewhere to read more on the verse, and a button
// to hide them again. Never presented as the app's own claim, or as Scripture.

import '../voices.css';
import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { type Atlas, locate } from '../../../data/atlas';
import { useJson } from '../data';
import { Facts, Lead, SourceNote, refName, showSources, verseHash } from '../kit';
import type { PanelProps, VerseRef } from '../types';
import { elsewhere } from './links';
import { type Data, HEBREW_FILE, type HebrewFile, type Item, type PartFile, type Run, type Text, WORKS, listWords, nameFrom, notesOn, partOf, voicesAllowed, worksOn } from './model';

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
        if (typeof r === 'string') return r;
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

function Voice({ a, who, text, navigate, focus }: { a: Atlas; who: string; text: Text; navigate: (v: VerseRef) => void; focus?: boolean }) {
  const [open, setOpen] = useState(false);
  const here = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus) here.current?.focus();
  }, [focus]);
  const [cite, ps] = who ? leadingCite(paragraphs(text)) : ['', paragraphs(text)];
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
  const [work, from, to, voices] = item;
  const more = work === 0 && !all ? voices.length - FIRST_FATHERS : 0;
  const shown = more > 0 ? voices.slice(0, FIRST_FATHERS) : voices;
  return (
    <div class="x-voices-note">
      {(from !== verse || to !== verse) && <p class="x-voices-on">On {nameFrom(a, verse, from, to)}</p>}
      {shown.map(([who, text], k) => (
        <Voice key={k} a={a} who={who} text={text} navigate={navigate} focus={all && k === FIRST_FATHERS} />
      ))}
      {more > 0 && (
        <button type="button" class="x-voices-more" onClick={() => setAll(true)}>
          Show {more} more of the Fathers
        </button>
      )}
    </div>
  );
}

function Elsewhere({ a, verse }: { a: Atlas; verse: VerseRef }) {
  const oldTestament = locate(a, verse).book < 39;
  const hebrew = useJson<HebrewFile>(a, oldTestament ? HEBREW_FILE : null);
  const links = elsewhere(a, verse, hebrew?.runs);
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
      <p class="x-voices-quiet">Other websites, with their own views. Nothing from them is copied here.</p>
    </section>
  );
}

const SOURCES = (
  <SourceNote>
    Public domain: the Catena Aurea in the Oxford translation (1841–45), from the Catena project; Matthew Henry’s Concise Commentary and John Wesley’s Notes, from the CrossWire SWORD modules via Let’s Church.
  </SourceNote>
);

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const allowed = voicesAllowed.value;
  const file = useJson<PartFile>(a, allowed ? partOf(data, verse) : null);
  const where = refName(a, verse);
  const names = worksOn(data, verse).map((w) => WORKS[w].short);
  // After the reader shows or hides the notes, focus goes to what replaced the button.
  const moved = useRef(false);
  const top = useRef<HTMLDivElement>(null);
  const ask = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    (allowed ? top.current : ask.current)?.focus();
  }, [allowed]);
  const choose = (show: boolean) => {
    moved.current = true;
    voicesAllowed.value = show;
  };

  if (!allowed) {
    const who = listWords(names);
    return (
      <Fragment key="ask">
        <Lead>
          {who.charAt(0).toUpperCase() + who.slice(1)} wrote about {where}.
        </Lead>
        <p class="x-voices-p">
          These are Christian writers of the past, in their own words. They wrote to help readers understand the Bible, but what they wrote is not Scripture, and they do not always agree with each other.
        </p>
        <p class="x-voices-ask">
          <button type="button" class="x-voices-allow" ref={ask} onClick={() => choose(true)}>
            Show what they wrote
          </button>
        </p>
        <p class="x-voices-quiet">Your choice is remembered on this device. You can hide them again at the end of this panel.</p>
        <Elsewhere a={a} verse={verse} />
        {SOURCES}
      </Fragment>
    );
  }

  if (file === null) return <p class="xt-lead">Sorry, these notes could not be shown right now.</p>;
  const notes = file ? notesOn(file, verse) : [];
  return (
    <Fragment key="shown">
      <div ref={top} tabIndex={-1} class="x-voices-top">
        <Lead>What Christian writers of the past wrote about {where}, in their own words. They are not Scripture, and they do not always agree.</Lead>
      </div>
      {file === undefined ? (
        <p class="x-voices-p xt-wait">…</p>
      ) : (
        WORKS.map((w, k) => {
          const mine = notes.filter((x) => x[0] === k);
          if (mine.length === 0) return null;
          return (
            <section key={k} class="x-voices-work" aria-label={w.name}>
              <h3 class="x-voices-h">{w.name}</h3>
              <p class="x-voices-book">
                {w.book}.{' '}
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
          ['Matthew Henry', 'Placed by his own headings, such as “Verses 1–9”. A chapter he wrote about as a whole shows with every verse in it.'],
          ['John Wesley', 'Each note shows with the verse it is on.'],
          ['Verse numbers', 'The notes are placed by the King James Version’s verse numbers, which match the Berean Standard Bible’s almost everywhere.'],
        ]}
      />
      <p class="x-voices-ask">
        <button type="button" class="x-voices-hide" onClick={() => choose(false)}>
          Hide writers’ notes
        </button>
      </p>
      {SOURCES}
    </Fragment>
  );
}
