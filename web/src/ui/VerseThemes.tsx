// A verse's themes, in three sizes:
// - VerseThemeCard: the card at the top of the Themes tab (and in the reader's
//   themes panel). Its own themes as chips quoting the BSB words that carry
//   them; then, labelled, the themes one of its words is a related word of
//   ("Sabbath rest, a related word: “rested”"); or, with neither, up to two
//   dashed rows reached through its strongest links; or one quiet line. Study
//   adds the Hebrew or Greek word (and how a related word is related), the
//   broad words and a separate "Linked themes" section; Deep adds the rule.
//   Where no theme reaches the verse, Study names the Nave's subjects that
//   list it instead of the quiet line (data/naves.ts), each a way into Ask
//   the Bible.
// - themeLine / VerseThemesLine: one plain line, for the reader's extras and
//   for the Links tab on phones.
// Themes come from data/themes.ts: nothing is chosen by hand but the reviewed
// list of related words (config/theme-related.json), which never adds a verse
// to a theme. Nave's rows come from data/naves.ts and are never themes.

import type { ComponentChildren } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import { type Atlas, type Theme, label, rangeLabel } from '../data/atlas';
import { type NavesPassage, type NavesTopic, navesRow, navesRowNow } from '../data/naves';
import { useLoaded } from '../data/shelf';
import {
  type OwnTheme,
  type RelatedTheme,
  type ThemeLevel,
  type ThroughTheme,
  linkRule,
  relatedThemes,
  relatedWordsIn,
  strongestLinks,
  themeWordsIn,
  themesThroughLinks,
  verseThemes,
} from '../data/themes';
import type { VerseRow } from '../data/text';
import { atLeast } from '../depth';
import * as S from '../state';
import { openAsk } from './ask/ask';
import { RootChip, Snippet, useVerseRow } from './common';
import { showSources } from './extras/kit';
import { RelatedTie, moreLinks, openThemeFromVerse, themeLevel, useHoverPreview } from './ThemeThread';
import './themes.css';

/** Own themes shown before "+N more". */
const OWN_SHOWN = 4;
/** Themes through links shown when the verse has none of its own. */
const THROUGH_SHOWN = 2;
/** Themes through links in Study's separate section. */
const LINKED_SHOWN = 3;
/** Nave's subjects shown before "+N more". */
const NAVES_SHOWN = 3;
/** Themes through a related word: all Simple shows, and Study before "+N more". */
const RELATED_SHOWN = 2;
const RELATED_STUDY = 3;

/** "Genesis 2:6's" */
function possessive(s: string): string {
  return `${s}’s`;
}

/** Deep: how many of the verse's strong links share a theme. */
function shareLine(shared: number, strong: number): string {
  if (strong === 1) return shared ? 'Its one strong link shares it' : 'Its one strong link does not share it';
  if (shared === 0) return `None of its ${strong} strongest links share it`;
  return `${shared} of its ${strong} strongest links ${shared === 1 ? 'shares' : 'share'} it`;
}

function OwnChip({ a, theme, row, own, strong, onOpen }: { a: Atlas; theme: Theme; row: VerseRow | null; own: OwnTheme; strong: number; onOpen: () => void }) {
  const study = atLeast('study');
  const deep = atLeast('deep');
  const words = useMemo(() => (row ? themeWordsIn(a, row, theme) : null), [a, row, theme]);
  const quote = words?.quotes.join(' / ') ?? '';
  const roots = words ? [...new Set(words.words.map((w) => w.root))] : [];
  return (
    <li class="vt-own">
      <button type="button" class="vt-chip" data-theme={theme.id} onClick={onOpen}>
        <span class="vt-chiptext">
          <b>{theme.name}</b>
          {quote &&
            (words?.gloss ? (
              <span class="vt-gloss" title="The word’s own gloss: the word-by-word alignment does not show which BSB words carry it in this verse">
                {quote}
              </span>
            ) : (
              <q class="vt-q">{quote}</q>
            ))}
        </span>
      </button>
      {study && theme.level === 'study' && <span class="tj-broad">broad word</span>}
      {study && roots.map((r) => <RootChip key={r} a={a} root={r} />)}
      {deep && strong > 0 && <span class="vt-share">{shareLine(own.shared, strong)}</span>}
    </li>
  );
}

function ThroughRow({ a, t, onOpen, go }: { a: Atlas; t: ThroughTheme; onOpen: () => void; go: (v: number) => void }) {
  const study = atLeast('study');
  const [peek, setPeek] = useState(false);
  const [u, votes] = t.via[0];
  const hover = useHoverPreview(u);
  const theme = a.themes[t.theme];
  return (
    <li class="vt-thr">
      <span class="vt-thrline">
        <button type="button" class="vt-thrname" data-theme={theme.id} onClick={onOpen}>
          {theme.name}
        </button>
        {theme.level === 'study' && study && <span class="tj-broad">broad word</span>}
        <span>, through </span>
        <button type="button" class="vt-thrref" data-lv={u} aria-expanded={peek} onClick={() => setPeek(!peek)} title={`Show ${label(a, u)}`} {...hover}>
          {label(a, u)}
        </button>
        {study && <span class="vt-votes"> ({votes} votes)</span>}
        <span>{moreLinks(t.via.length - 1)}</span>
      </span>
      {peek && (
        <span class="vt-peek">
          <Snippet a={a} v={u} max={400} />{' '}
          <button type="button" class="tj-link" onClick={() => go(u)}>
            Go to {label(a, u)} ›
          </button>
        </span>
      )}
    </li>
  );
}

/** A theme one of the verse's words is a related word of: labelled, and never
 *  taken for the verse's own words. Study adds the Hebrew or Greek word,
 *  opening its word study, and how it is related. */
function RelatedRow({ a, t, row, onOpen }: { a: Atlas; t: RelatedTheme; row: VerseRow | null; onOpen: () => void }) {
  const study = atLeast('study');
  const theme = a.themes[t.theme];
  const words = useMemo(() => (row ? relatedWordsIn(a, row, theme, t.words) : null), [a, row, theme, t.words]);
  return (
    <li class="vt-rel">
      <span class="vt-thrline">
        <button type="button" class="vt-thrname" data-theme={theme.id} onClick={onOpen}>
          {theme.name}
        </button>
        {theme.level === 'study' && study && <span class="tj-broad">broad word</span>}
        <span>, {t.words.length > 1 ? 'related words' : 'a related word'}</span>
        {words && (
          <>
            {': '}
            {words.map((w, i) => (
              <span key={w.root}>
                {i > 0 && ' / '}
                {w.gloss ? (
                  <span class="vt-gloss" title="The word’s own gloss: the word-by-word alignment does not show which BSB words carry it in this verse">
                    {w.quote}
                  </span>
                ) : (
                  <q class="vt-relq">{w.quote}</q>
                )}
              </span>
            ))}
          </>
        )}
      </span>
      {study &&
        words?.map((w) => (
          <span key={w.root} class="vt-tie">
            <RootChip a={a} root={w.root} /> <RelatedTie a={a} theme={theme} w={w} />
          </span>
        ))}
    </li>
  );
}

/** A Nave's subject, opened in Ask the Bible with the verses Nave lists for it. */
function NavesName({ t }: { t: NavesTopic }) {
  const [i, title, n] = t;
  return (
    <button type="button" class="vt-nname" onClick={(e) => openAsk({ kind: 'topic', i, title, n }, e.currentTarget)} title={`Open ${title} in Ask the Bible (${n.toLocaleString()} verses)`}>
      {title}
    </button>
  );
}

/** "A, B and C", with JSX in place of the names. */
function andList(xs: ComponentChildren[], and = ' and ', sep = ', '): ComponentChildren[] {
  return xs.flatMap((x, k) => (k === 0 ? [x] : [k === xs.length - 1 ? and : sep, x]));
}

/** Nave's headings side by side. Some hold a comma or "and" ("Intolerance,
 *  Religious"), so a dot, which none holds, keeps each one whole. */
const headings = (xs: ComponentChildren[]) => andList(xs, ' · ', ' · ');

const tie = (s: string) => s.replace(/ /g, '\u00a0');

/** "(1 Chronicles 1:1–24)", breaking only before the chapter and verse. */
function RangeRef({ a, from, to }: { a: Atlas; from: number; to: number }) {
  const ref = rangeLabel(a, from, to - from + 1);
  const cut = ref.lastIndexOf(' ');
  return (
    <>
      ({tie(ref.slice(0, cut))} <span class="vt-nref">{ref.slice(cut + 1)})</span>
    </>
  );
}

/** Passages to name: one entry per range, with every subject Nave lists it under. */
function byRange(ps: NavesPassage[]): { from: number; to: number; topics: NavesTopic[] }[] {
  const out: { from: number; to: number; topics: NavesTopic[] }[] = [];
  for (const p of ps) {
    const same = out.find((r) => r.from === p.from && r.to === p.to);
    if (same) same.topics.push(p.topic);
    else out.push({ from: p.from, to: p.to, topics: [p.topic] });
  }
  return out;
}

/** In place of the quiet line, at Study: the Nave's subjects that list the
 *  verse, or the passages Nave lists it in, or else the quiet line itself. */
function NavesRows({ a, v, quiet }: { a: Atlas; v: number; quiet: string }) {
  const deep = atLeast('deep');
  // At once when the book is loaded; the first verse of a book waits for it.
  const now = navesRowNow(a, v);
  const later = useLoaded(now === undefined ? `naves ${a.version} ${v}` : null, () => navesRow(a, v));
  const got = now !== undefined ? now : later;
  // "+N more" opens in place, for this verse only, and hands the focus to the
  // first subject it shows.
  const [allFor, setAllFor] = useState<number | null>(null);
  const line = useRef<HTMLParagraphElement>(null);
  const showAll = () => {
    setAllFor(v);
    requestAnimationFrame(() => line.current?.querySelectorAll<HTMLElement>('.vt-nname')[NAVES_SHOWN]?.focus());
  };
  // While the book loads, an empty line of the same height.
  if (got === undefined) return <p class="vt-quiet" aria-hidden="true">&nbsp;</p>;
  if (!got) return <p class="vt-quiet">{quiet}</p>;
  let row;
  if (got.kind === 'direct') {
    const shown = allFor === v ? got.topics : got.topics.slice(0, NAVES_SHOWN);
    const more = got.topics.length - shown.length;
    row = (
      <p class="vt-naves" ref={line}>
        Nave’s Topical Bible (1896) lists this verse under {headings(shown.map((t) => <NavesName key={t[0]} t={t} />))}
        {more > 0 && (
          <>
            {' '}
            <button type="button" class="vt-more vt-nmore" onClick={showAll}>
              +{more} more
            </button>
          </>
        )}
      </p>
    );
  } else {
    const ranges = byRange(got.passages);
    const one = ranges.length === 1;
    row = (
      <p class="vt-naves">
        Part of {one ? 'a passage' : 'passages'} Nave’s lists under{' '}
        {andList(
          ranges.map((r) => (
            <span key={`${r.from}-${r.to}`}>
              {headings(r.topics.map((t) => <NavesName key={t[0]} t={t} />))} <RangeRef a={a} from={r.from} to={r.to} />
            </span>
          )),
        )}
      </p>
    );
  }
  return (
    <>
      {row}
      {deep && (
        <p class="vt-src">
          From Nave’s Topical Bible (Orville J. Nave, 1896), in Brady Stephenson’s table edition (CC BY 4.0).{' '}
          <button type="button" class="tj-link" onClick={() => showSources('naves')}>
            About this source
          </button>
        </p>
      )}
    </>
  );
}

/** The selected verse's themes. `onTheme` opens a theme (by default: lit on
 *  the map with the verse kept); `go` moves to a linked verse; `title` shows
 *  "In Genesis 22:8" (left out where the frame already names the verse). */
export function VerseThemeCard({ a, v, onTheme, go, title = true }: { a: Atlas; v: number; onTheme?: (id: string) => void; go?: (v: number) => void; title?: boolean }) {
  const level = themeLevel();
  const study = atLeast('study');
  const deep = atLeast('deep');
  const row = useVerseRow(a, v);
  const own = useMemo(() => verseThemes(a, v, level), [a, v, level]);
  const related = useMemo(() => relatedThemes(a, v, level), [a, v, level]);
  // A theme shown through a related word is not offered again through links.
  const through = useMemo(() => themesThroughLinks(a, v, level).filter((t) => !related.some((r) => r.theme === t.theme)), [a, v, level, related]);
  const strong = useMemo(() => strongestLinks(a, v).length, [a, v]);
  // "+N more" opens in place, for this verse only, and hands the focus to
  // the first chip or row it shows (the button itself goes away).
  const [allFor, setAllFor] = useState<number | null>(null);
  const [allRelFor, setAllRelFor] = useState<number | null>(null);
  const chips = useRef<HTMLUListElement>(null);
  const rels = useRef<HTMLUListElement>(null);
  const showAll = () => {
    setAllFor(v);
    requestAnimationFrame(() => chips.current?.querySelectorAll<HTMLElement>('.vt-chip')[OWN_SHOWN]?.focus());
  };
  const showAllRel = () => {
    setAllRelFor(v);
    requestAnimationFrame(() => rels.current?.querySelectorAll<HTMLElement>('.vt-thrname')[RELATED_STUDY]?.focus());
  };
  const open = onTheme ?? ((id: string) => openThemeFromVerse(a, id, v));
  const goTo = go ?? ((u: number) => S.selectVerse(u, { openTab: false }));
  const name = label(a, v);
  const quiet = `No theme runs through ${possessive(name)} words or its strongest links.`;
  const rule = linkRule(a);
  const shownOwn = allFor === v ? own : own.slice(0, OWN_SHOWN);
  const shownRel = !study ? related.slice(0, RELATED_SHOWN) : allRelFor === v ? related : related.slice(0, RELATED_STUDY);
  const linked = study && (own.length || related.length) ? through.slice(0, LINKED_SHOWN) : [];

  return (
    <section class="vt-card" aria-label={`Themes in ${name}`}>
      {title && <h3 class="vt-title">In {name}</h3>}
      {own.length > 0 && (
        <ul class="vt-chips" ref={chips}>
          {shownOwn.map((o) => (
            <OwnChip key={o.theme} a={a} theme={a.themes[o.theme]} row={row} own={o} strong={strong} onOpen={() => open(a.themes[o.theme].id)} />
          ))}
          {own.length > shownOwn.length && (
            <li>
              <button type="button" class="vt-more" onClick={showAll}>
                +{own.length - shownOwn.length} more
              </button>
            </li>
          )}
        </ul>
      )}
      {related.length > 0 && (
        <ul class={`vt-thrs vt-rels${own.length ? ' is-after' : ''}`} ref={rels}>
          {shownRel.map((t) => (
            <RelatedRow key={t.theme} a={a} t={t} row={row} onOpen={() => open(a.themes[t.theme].id)} />
          ))}
          {study && related.length > shownRel.length && (
            <li>
              <button type="button" class="vt-more" onClick={showAllRel}>
                +{related.length - shownRel.length} more
              </button>
            </li>
          )}
        </ul>
      )}
      {own.length > 0 || related.length > 0 ? null : through.length > 0 ? (
        <>
          <p class="vt-lead">{name} has no theme words of its own. Its strongest links lead to:</p>
          <ul class="vt-thrs">
            {through.slice(0, study ? LINKED_SHOWN : THROUGH_SHOWN).map((t) => (
              <ThroughRow key={t.theme} a={a} t={t} onOpen={() => open(a.themes[t.theme].id)} go={goTo} />
            ))}
          </ul>
        </>
      ) : study ? (
        <NavesRows a={a} v={v} quiet={quiet} />
      ) : (
        <p class="vt-quiet">{quiet}</p>
      )}
      {linked.length > 0 && (
        <>
          <h4 class="vt-sub">Linked themes</h4>
          <ul class="vt-thrs">
            {linked.map((t) => (
              <ThroughRow key={t.theme} a={a} t={t} onOpen={() => open(a.themes[t.theme].id)} go={goTo} />
            ))}
          </ul>
        </>
      )}
      {deep && (
        <p class="vt-rule">
          Own themes: a theme’s Hebrew or Greek word is in this verse. They are ordered by how many of the verse’s {rule.top} strongest links ({rule.votes} or more votes) share the theme,
          then the rarer theme, with the broad words after the others. A related word: one of the verse’s words is in the same family as a theme’s word, from a reviewed list
          (config/theme-related.json), never on a verse with the theme’s left-out sense; it adds no verse to the theme. Themes through links: carried by {rule.carriers} of those links, or by one link with {rule.soloVotes} or more votes; themes of more than {rule.maxThemeSize}{' '}
          verses, and themes whose left-out sense is in this verse, are never offered.
        </p>
      )}
    </section>
  );
}

// ------------------------------------------------------------ one line

export type ThemeLineData = { kind: 'own'; names: string[]; more: number } | { kind: 'related'; theme: string } | { kind: 'through'; theme: string; via: number } | null;

/** Longest a one-line list of theme names gets before "and N more". */
const LINE_CHARS = 52;

/** The verse's themes as one plain line's worth of data: its own theme
 *  names (as many as fit), else the first theme through a related word, else
 *  the first through its links, else null. */
export function themeLine(a: Atlas, v: number, level: ThemeLevel): ThemeLineData {
  const own = verseThemes(a, v, level);
  if (own.length) {
    const names: string[] = [];
    let len = 0;
    for (const o of own) {
      const n = a.themes[o.theme].name;
      if (names.length && len + 3 + n.length > LINE_CHARS) break;
      names.push(n);
      len += (names.length > 1 ? 3 : 0) + n.length;
    }
    return { kind: 'own', names, more: own.length - names.length };
  }
  const r = relatedThemes(a, v, level)[0];
  if (r) return { kind: 'related', theme: a.themes[r.theme].name };
  const t = themesThroughLinks(a, v, level)[0];
  return t ? { kind: 'through', theme: a.themes[t.theme].name, via: t.via[0][0] } : null;
}

/** "Themes: Lamb · Sacrifice and offering" */
export function ownLineText(d: { names: string[]; more: number }): string {
  return `Themes: ${d.names.join(' · ')}${d.more > 0 ? ` and ${d.more} more` : ''}`;
}

/** "Sabbath rest, through a related word" */
export function relatedLineText(d: { theme: string }): string {
  return `${d.theme}, through a related word`;
}

/** The one-line form as a button, for the Links tab on phones (hidden on
 *  wider screens, where the reader's own line shows beside it). Nothing when
 *  the verse has no theme. */
export function VerseThemesLine({ a, v, onOpen, class: cls }: { a: Atlas; v: number; onOpen: () => void; class?: string }) {
  const level = themeLevel();
  const d = useMemo(() => themeLine(a, v, level), [a, v, level]);
  if (!d) return null;
  return (
    <button type="button" class={`vt-line${cls ? ` ${cls}` : ''}`} onClick={onOpen}>
      <span>{d.kind === 'own' ? ownLineText(d) : d.kind === 'related' ? relatedLineText(d) : `Linked to ${d.theme}, through ${label(a, d.via)}`}</span>
      <span aria-hidden="true">›</span>
    </button>
  );
}
