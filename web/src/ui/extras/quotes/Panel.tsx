// The panel behind the Quotations line: the passages side by side in the BSB
// with the words they share marked, how each is quoted, and at Deep the Hebrew
// and Greek word by word, every other place the same words are quoted, and how
// each link was found.

import type { ComponentChildren } from 'preact';
import type { Atlas } from '../../../data/atlas';
import type { VerseRow } from '../../../data/text';
import { GoDeeper } from '../../Depth';
import { useJson } from '../data';
import { Facts, Lead, SideBySide, SourceNote, Unsure, refName } from '../kit';
import { levelAtLeast } from '../level';
import type { PanelProps, VerseRef } from '../types';
import { type Data, FLAG, type Link, type LinkNote, type NotesFile, type Range, WHY, isNt, linksAt, otherSide } from './model';
import { PairWord, QPassage, type Spans, addRows, addSpan, useRows } from './Text';

const CLOSENESS = ['Quoted word for word', 'Quoted closely', 'Quoted loosely'];

/** "A", "A and B", "A, B and C". */
function and(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function name(a: Atlas, r: Range): string {
  return refName(a, r.from, r.to);
}

/** The passages a list of links reach, in order, each once. */
function sides(ls: Link[], ntSide: boolean): Range[] {
  const seen = new Set<string>();
  const out: Range[] = [];
  for (const l of ls) {
    const r = otherSide(l, ntSide);
    const k = `${r.from}-${r.to}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

/** The plain sentence at the top. It names the New Testament passage whole
 * ("Acts 2:25–28 quotes Psalm 16:8–11"), and the Old Testament verse tapped
 * ("Isaiah 40:3 is quoted in …", even where Luke quotes 40:3–5). */
function lead(a: Atlas, here: Range, verse: VerseRef, ntSide: boolean, quotes: Range[], echoes: Range[]): string {
  const me = ntSide ? name(a, here) : refName(a, verse);
  const named = (rs: Range[], many: string) => (rs.length > 4 ? many : and(rs.map((r) => name(a, r))));
  if (ntSide) {
    const q = named(quotes, `${quotes.length} passages of the Old Testament`);
    const e = named(echoes, `${echoes.length} others`);
    if (quotes.length && echoes.length) return `${me} quotes ${q} and echoes ${e}.`;
    return quotes.length ? `${me} quotes ${q}.` : `${me} echoes ${e}.`;
  }
  const q = named(quotes, `${quotes.length} times in the New Testament`);
  const e = named(echoes, `${echoes.length} times`);
  const quoted = quotes.length > 4 ? `is quoted ${q}` : `is quoted in ${q}`;
  const echoed = echoes.length > 4 ? `echoed ${e}` : `echoed in ${e}`;
  if (quotes.length && echoes.length) return `${me} ${quoted} and ${echoed}.`;
  return quotes.length ? `${me} ${quoted}.` : `${me} is ${echoed}.`;
}

/** The quoted words of each link, by verse, or undefined if any is unknown. */
function quotedWords(ls: Link[], notes: LinkNote[] | undefined): Spans | undefined {
  if (!notes || !ls.every((l) => notes[l.i]?.s)) return undefined;
  const m: Spans = new Map();
  for (const l of ls) {
    const [sv, so, ev, eo] = notes[l.i].s!;
    for (let v = sv; v <= ev; v++) addSpan(m, v, v === sv ? so : 0, v === ev ? eo : Number.MAX_SAFE_INTEGER);
  }
  return m;
}

function marksIn(ls: Link[], notes: LinkNote[] | undefined, r: Range): Spans {
  const m: Spans = new Map();
  for (const l of ls) addRows(m, notes?.[l.i]?.h, r.from, r.to);
  return m;
}

/** The paired original words on one side of the links, by verse. */
function pairedIn(ls: Link[], notes: LinkNote[] | undefined, ntSide: boolean): Map<VerseRef, Set<number>> {
  const m = new Map<VerseRef, Set<number>>();
  for (const l of ls) {
    for (const [gv, gp, hv, hp] of notes?.[l.i]?.w ?? []) {
      const [v, pos] = ntSide ? [gv, gp] : [hv, hp];
      const set = m.get(v);
      if (set) set.add(pos);
      else m.set(v, new Set([pos]));
    }
  }
  return m;
}

/** Words to set inside double quotation marks: their own double marks become single. */
function inner(s: string): string {
  return s.replace(/“/g, '‘').replace(/”/g, '’');
}

/** What a card says under its name: how it is quoted, and how it is introduced. */
function cardNotes(l: Link, n: LinkNote | undefined): ComponentChildren[] {
  if (l.echo) return ['An echo'];
  if (!n) return [];
  const out: ComponentChildren[] = [CLOSENESS[n.c] ?? CLOSENESS[2]];
  if (n.f) out.push(<>Introduced with “{inner(n.f)}”</>);
  return out;
}

function Go({ a, l, navigate }: { a: Atlas; l: Link; navigate: (v: VerseRef) => void }) {
  return (
    <button type="button" class="x-quotes-go" onClick={() => navigate(l.nt)}>
      {refName(a, l.nt, l.ntTo)}
    </button>
  );
}

/** Buttons joined as "A, B and C". */
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

/** Deep, from a New Testament verse: every other place that quotes or echoes
 * the same Old Testament words. */
function Elsewhere({ a, data, target, shown, navigate }: { a: Atlas; data: Data; target: Range; shown: Set<Link>; navigate: (v: VerseRef) => void }) {
  const seen = new Set<Link>(shown);
  const others: Link[] = [];
  for (let v = target.from; v <= target.to; v++) {
    for (const l of data.byOt.get(v) ?? []) {
      if (!seen.has(l)) {
        seen.add(l);
        others.push(l);
      }
    }
  }
  others.sort((x, y) => x.nt - y.nt || x.ntTo - y.ntTo);
  const q = others.filter((l) => !l.echo);
  const e = others.filter((l) => l.echo);
  const t = name(a, target);
  if (!q.length && !e.length) return <p>The BSB’s footnotes name no other place that quotes {t}.</p>;
  const qs = q.map((l) => <Go key={l.i} a={a} l={l} navigate={navigate} />);
  const es = e.map((l) => <Go key={l.i} a={a} l={l} navigate={navigate} />);
  return (
    <p>
      {q.length > 0 ? (
        <>
          {t} is also quoted in <Joined>{qs}</Joined>
          {e.length > 0 && (
            <>
              , and echoed in <Joined>{es}</Joined>
            </>
          )}
          .
        </>
      ) : (
        <>
          No other place quotes {t}; it is echoed in <Joined>{es}</Joined>.
        </>
      )}
    </p>
  );
}

/** Deep: the Greek and Hebrew words of a link, side by side. */
function Pairs({ a, n, rows }: { a: Atlas; n: LinkNote; rows: Map<VerseRef, VerseRow> | null }) {
  if (!rows) return <p class="xt-wait">…</p>;
  return (
    <table class="x-quotes-pairs" aria-label="Greek words and the Hebrew words they stand for">
      <tbody>
        {(n.w ?? []).map(([gv, gp, hv, hp]) => (
          <tr key={`${gv}.${gp}.${hv}.${hp}`}>
            <td>
              <PairWord a={a} v={gv} pos={gp} row={rows.get(gv)} />
            </td>
            <td class="x-quotes-eq" title="stands for">
              =
            </td>
            <td>
              <PairWord a={a} v={hv} pos={hp} row={rows.get(hv)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function sharedWords(k: [number, number, number]): string {
  const [run, shared, keys] = k;
  const inRow = run >= 2 ? `, and ${run} words in a row` : '';
  if (!keys) return `No key words to compare${inRow}, in the BSB’s English`;
  const all = keys === 1 ? 'Its one key word' : keys === 2 ? 'Both of its key words' : `All ${keys} of its key words`;
  const some = shared === keys ? all : `${shared} of its ${keys} key ${keys === 1 ? 'word' : 'words'}`;
  return `${some}${inRow}, in the BSB’s English`;
}

/** Deep: how one link was found, and on what evidence. */
function Evidence({ a, l, n }: { a: Atlas; l: Link; n: LinkNote }) {
  const rows: [ComponentChildren, ComponentChildren][] = [[`Footnote in ${refName(a, l.nt, l.ntTo)}`, `“${n.n}”`]];
  if (n.m) rows.push([`Footnote in ${refName(a, l.ot, l.otTo)}`, `“${n.m}”`]);
  if (n.x & FLAG.lxx) {
    rows.push([
      'Septuagint',
      'The footnote points to it too (“LXX”): the Greek translation of the Old Testament that the New Testament often quotes. Its wording can differ from the Hebrew, which the BSB translates.',
    ]);
  }
  if (n.x & FLAG.dss) rows.push(['Dead Sea Scrolls', 'The footnote points to them too (“DSS”): Hebrew scrolls copied in the centuries around the time of Jesus, among the oldest copies of the Old Testament known.']);
  rows.push(['Words in common', sharedWords(n.k)]);
  rows.push(['Sorted as', WHY[n.r] ?? (l.echo ? 'An echo.' : 'A quotation.')]);
  return <Facts rows={rows} />;
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const study = levelAtLeast('study');
  const deep = levelAtLeast('deep');
  const file = useJson<NotesFile>(a, 'extras/quotes/notes.json');
  // Notes are in the same order as the links; any other file is not used.
  const notes = file && file.format === 1 && Array.isArray(file.notes) && file.notes.length === data.count ? file.notes : undefined;
  const ntSide = isNt(a, verse);
  const links = linksAt(data, a, verse, study);

  // This passage: every verse of every link at this verse.
  const here: Range = { from: verse, to: verse };
  for (const l of links) {
    const r = ntSide ? { from: l.nt, to: l.ntTo } : { from: l.ot, to: l.otTo };
    here.from = Math.min(here.from, r.from);
    here.to = Math.max(here.to, r.to);
  }
  const quotes = sides(links.filter((l) => !l.echo), ntSide);
  const echoes = sides(links.filter((l) => l.echo), ntSide);

  // Original words for the word pairs, at Deep.
  const pairVerses = deep && notes ? [...new Set(links.flatMap((l) => (notes[l.i]?.w ?? []).flatMap(([gv, , hv]) => [gv, hv])))].sort((x, y) => x - y) : [];
  const rows = useRows(a, pairVerses);

  const thisCard = (
    <QPassage
      key="here"
      a={a}
      from={here.from}
      to={here.to}
      navigate={navigate}
      marks={marksIn(links, notes, here)}
      quoted={ntSide ? quotedWords(links, notes) : undefined}
      paired={pairedIn(links, notes, ntSide)}
    />
  );
  const otherCards = links.map((l) => {
    const r = otherSide(l, ntSide);
    return (
      <QPassage
        key={l.i}
        a={a}
        from={r.from}
        to={r.to}
        navigate={navigate}
        notes={cardNotes(l, notes?.[l.i])}
        marks={marksIn([l], notes, r)}
        quoted={ntSide ? undefined : quotedWords([l], notes)}
        paired={pairedIn([l], notes, !ntSide)}
      />
    );
  });
  const anyMarks = !!notes && links.some((l) => notes[l.i]?.h?.length);
  const shown = new Set(links);
  const withPairs = deep && notes ? links.filter((l) => notes[l.i]?.w?.length) : [];
  const pairName = (l: Link) => `${refName(a, l.nt, l.ntTo)} and ${refName(a, l.ot, l.otTo)}`;

  return (
    <>
      <Lead>{lead(a, here, verse, ntSide, quotes, echoes)}</Lead>
      {otherCards.length === 1 ? (
        <SideBySide>
          {thisCard}
          {otherCards[0]}
        </SideBySide>
      ) : (
        <>
          <SideBySide>{thisCard}</SideBySide>
          <SideBySide>{otherCards}</SideBySide>
        </>
      )}
      {anyMarks && (
        <p class="x-quotes-hint">
          <mark class="x-quotes-mark">Marked</mark> words are in both passages.
        </p>
      )}
      {echoes.length > 0 && <p class="x-quotes-hint">An echo recalls older words without quoting them.</p>}

      {deep && notes && (
        <>
          {withPairs.length > 0 && (
            <>
              <h3>
                Word by word <Unsure title="Paired by a program, not by hand">matched by computer</Unsure>
              </h3>
              <p class="x-quotes-hint">Each Greek word beside the Hebrew word that the Septuagint usually translates with it, as Abbott-Smith’s lexicon notes.</p>
              {withPairs.map((l) => (
                <div key={l.i}>
                  {withPairs.length > 1 && <p class="x-quotes-sub">{pairName(l)}</p>}
                  <Pairs a={a} n={notes[l.i]} rows={rows} />
                </div>
              ))}
            </>
          )}
          {ntSide && (
            <>
              <h3>Elsewhere in the New Testament</h3>
              {sides(links, true).map((t) => (
                <Elsewhere key={`${t.from}-${t.to}`} a={a} data={data} target={t} shown={shown} navigate={navigate} />
              ))}
            </>
          )}
          <h3>How {links.length === 1 ? 'this was' : 'these were'} found</h3>
          {links.map((l) =>
            notes[l.i] ? (
              <div key={l.i}>
                {links.length > 1 && <p class="x-quotes-sub">{pairName(l)}</p>}
                <Evidence a={a} l={l} n={notes[l.i]} />
              </div>
            ) : null,
          )}
          <p class="x-quotes-hint">
            The BSB’s footnotes name the passage behind each quotation, and the Old Testament’s footnotes list where a verse is cited. Words in quotation marks count as quotations here when they
            are introduced as Scripture, repeat most of the older words, or follow the Septuagint as the footnote says; the other passages the footnotes point to count as echoes. Wording is
            compared in the BSB’s English, so a quotation of the Septuagint can look loose.
          </p>
        </>
      )}
      {!deep && <GoDeeper to="deep">See the Hebrew and Greek</GoDeeper>}
      <SourceNote>
        {deep
          ? 'Quotations from the footnotes of the Berean Standard Bible (public domain). Word pairs from STEPBible’s TBESG lexicon, based on Abbott-Smith (CC BY 4.0).'
          : 'Quotations from the footnotes of the Berean Standard Bible (public domain).'}
      </SourceNote>
    </>
  );
}
