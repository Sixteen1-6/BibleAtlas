// The panel behind the Parallel passages line: one plain sentence, then the
// passages lined up verse by verse. Study underlines the words they share;
// Deep adds the Hebrew or Greek, a note on what kind of parallel this is, how
// the passages compare, what was left out and why, and every parallel in the
// book.

import type { ComponentChildren } from 'preact';
import type { Atlas } from '../../../data/atlas';
import { GoDeeper } from '../../Depth';
import { useJson } from '../data';
import { Facts, Lead, SourceNote, refName } from '../kit';
import { levelAtLeast } from '../level';
import type { PanelProps, VerseRef } from '../types';
import { Compare, type Texts, lacksBase, useTexts } from './Compare';
import { type BookFile, type Data, type PSet, type SetDetail, and, nameOf, passageAt, sharesOf, shortNames } from './model';
import { KindNote, lead } from './notes';

/** "about 7 in 10", in plain words. */
function share(pct: number): string {
  if (pct >= 95) return 'almost all';
  if (pct < 5) return 'almost none';
  return `about ${Math.min(9, Math.max(1, Math.round(pct / 10)))} in 10`;
}

function Lines({ items }: { items: ComponentChildren[] }) {
  return (
    <>
      {items.map((x, i) => (
        <span key={i} class="x-parallels-line">
          {x}
        </span>
      ))}
    </>
  );
}

/** Deep: what kind of parallel, how the passages compare, and what was left out. */
function Deeper({ a, s, d, texts, verse, navigate }: { a: Atlas; s: PSet; d: SetDetail | null | undefined; texts: Texts | null; verse: VerseRef; navigate: (v: VerseRef) => void }) {
  const home = passageAt(s, verse);
  const lang = a.books[a.verseBook[verse]].testament === 'OT' ? 'Hebrew' : 'Greek';
  const late = s.passages.filter((p) => lacksBase(texts, p));
  const rows: [ComponentChildren, ComponentChildren][] = [];
  if (d) {
    const shares = s.passages.flatMap((p, o) => {
      const sh = o === home ? null : sharesOf(d, home, o);
      return sh ? [`${nameOf(a, p)}: ${lang} ${share(sh[0])}, English ${share(sh[1])}`] : [];
    });
    if (shares.length) rows.push(['Words in common', <Lines items={shares} />]);
    const listed = s.passages.filter((_, i) => d.listed[i]).map((p) => nameOf(a, p));
    const added = s.passages.filter((_, i) => d.listed[i] === false).map((p) => nameOf(a, p));
    if (listed.length) rows.push(['Named in the BSB headings', and(listed)]);
    if (added.length) rows.push(['Added by hand', and(added)]);
    const titles = s.passages.flatMap((p, i) => (d.titles[i] ? [`${nameOf(a, p)}: ${d.titles[i]}`] : []));
    if (titles.length) rows.push(['BSB headings', <Lines items={titles} />]);
  }
  return (
    <>
      <h3>What kind of parallel</h3>
      <KindNote a={a} s={s} />
      {late.map((p) => (
        <p key={p.from}>Some of the earliest manuscripts do not have {nameOf(a, p)}.</p>
      ))}
      {rows.length > 0 && (
        <>
          <h3>How they compare</h3>
          <Facts rows={rows} />
        </>
      )}
      {d && d.apart.length > 0 && (
        <>
          <h3>Not counted here</h3>
          <ul class="x-parallels-list">
            {d.apart.map(([from, to, why]) => (
              <li key={from}>
                <button type="button" class="x-parallels-go" data-lv={from} onClick={() => navigate(from)}>
                  {refName(a, from, to)}
                </button>
                : {why}.
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** Deep: every parallel with a passage in this book, in order. */
function InBook({ a, data, file, book, current, navigate }: { a: Atlas; data: Data; file: BookFile; book: number; current: Set<number>; navigate: (v: VerseRef) => void }) {
  const items: { s: PSet; i: number; title: string }[] = [];
  for (const [id, detail] of Object.entries(file.sets)) {
    const s = data.sets.get(Number(id));
    if (!s || !detail) continue;
    s.passages.forEach((p, i) => {
      if (a.verseBook[p.from] === book) items.push({ s, i, title: detail.titles[i] ?? '' });
    });
  }
  if (!items.length) return null;
  items.sort((x, y) => x.s.passages[x.i].from - y.s.passages[y.i].from);
  return (
    <details class="x-parallels-book">
      <summary>
        Every parallel in {a.books[book].name} ({items.length})
      </summary>
      <ul class="x-parallels-list">
        {items.map(({ s, i, title }) => {
          const names = shortNames(a, s);
          const p = s.passages[i];
          return (
            <li key={`${s.id}.${i}`} aria-current={current.has(s.id) ? 'true' : undefined}>
              <button type="button" class="x-parallels-go" data-lv={p.from} onClick={() => navigate(p.from)}>
                {nameOf(a, p)}
              </button>
              {title && ` ${title}`}
              <span class="x-parallels-also"> · also in {and(names.filter((_, k) => k !== i))}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function SetView({ a, s, d, verse, navigate, first, says, deeper }: { a: Atlas; s: PSet; d: SetDetail | null | undefined; verse: VerseRef; navigate: (v: VerseRef) => void; first: boolean; says: string | null; deeper?: ComponentChildren }) {
  const texts = useTexts(a, s);
  const deep = levelAtLeast('deep');
  return (
    <div class="x-parallels-set">
      {says && <Lead>{says}</Lead>}
      <Compare a={a} s={s} d={d} texts={texts} verse={verse} navigate={navigate} scroll={first} deeper={deeper} />
      {deep && <Deeper a={a} s={s} d={d} texts={texts} verse={verse} navigate={navigate} />}
    </div>
  );
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const ids = data.at.get(verse) ?? [];
  // A verse in more than one set: the closest parallel first, the one whose
  // passage around this verse is shortest.
  const span = (s: PSet) => {
    const p = s.passages[passageAt(s, verse)];
    return p ? p.to - p.from : 0;
  };
  const sets = ids.flatMap((id) => data.sets.get(id) ?? []).sort((x, y) => span(x) - span(y));
  const book = a.verseBook[verse];
  const file = useJson<BookFile>(a, `extras/parallels/${a.books[book].osis}.json`);
  const study = levelAtLeast('study');
  const deep = levelAtLeast('deep');
  const lang = a.books[book].testament === 'OT' ? 'Hebrew' : 'Greek';
  const detail = (s: PSet) => (file === undefined ? undefined : (file?.sets[String(s.id)] ?? null));
  // A verse in two sets: the second says its sentence only if it differs.
  const says = sets.map((s) => lead(a, s));
  // One way deeper, near the top, where it is in view when the panel opens.
  const deeper = !study ? <GoDeeper to="study">Underline the words they share</GoDeeper> : !deep ? <GoDeeper to="deep">See the {lang} words they share</GoDeeper> : null;
  return (
    <>
      {sets.map((s, k) => (
        <SetView key={`${s.id}.${verse}`} a={a} s={s} d={detail(s)} verse={verse} navigate={navigate} first={k === 0} says={k > 0 && says[k] === says[k - 1] ? null : says[k]} deeper={k === 0 ? deeper : undefined} />
      ))}
      {deep && (
        <>
          <h3>How these were found</h3>
          <p>
            The section headings of the Berean Standard Bible name the passages that tell the same thing. These sets keep the clear ones, checked against the text, with a few added by hand. A computer lines each pair up verse by verse, by the Hebrew or Greek and the English words their verses share, rare words counting for more, so now and then a row may be off by a verse. A verse on its own has no close partner in the other passage. “Words in common” counts how many of the shorter passage’s words the other also uses; in the Hebrew and Greek, rare words count for more.
          </p>
          {file && <InBook a={a} data={data} file={file} book={book} current={new Set(ids)} navigate={navigate} />}
        </>
      )}
      <SourceNote>Parallels named in the section headings of the Berean Standard Bible (public domain), with a few added by hand.</SourceNote>
    </>
  );
}
