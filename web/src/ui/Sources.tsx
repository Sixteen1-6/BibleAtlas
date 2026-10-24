// The Sources shelf: every work the app draws on or cites, one card each.
//
// Simple: a plain label ("Bible dictionary, 1897") and the title, grouped.
//   Tapping a card opens it in place: what it is, who made it, when, its
//   license in plain words, where the app cites it, and "Read it" (in the app
//   or at a free full copy) or "Find it" (a citation link). A long group (the
//   scholars' books and articles) waits behind one tap.
// Study: adds what the app takes from each dataset, and how the ESV is used.
// Deep: adds the full citation, the license detail, each dataset's commit and
//   checksums, the counts, the build id and how to check it all yourself.
//
// The works come from shelf.json (config/shelf.json, built by
// crates/atlas-cli/src/shelf.rs), loaded the first time the shelf opens.
// "Read it" on a dictionary opens it here (Dictionary.tsx).
// Under the opening line, a short Commentary section: see the notice again,
// or close commentary again on this device (ui/commentary).

import './shelf.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Atlas, SourceMeta } from '../data/atlas';
import { ESV_ENABLED } from '../data/esv';
import { type Cited, type HowWeKnow, type Shelf, type Work, type WriterRow, licenseWords, useShelf, workFor } from '../data/shelf';
import { type Depth, atLeast } from '../depth';
import * as S from '../state';
import { ASKS, useGate } from './commentary/Gate';
import { closeCommentary, reviewNotice } from './commentary/state';
import { Dictionary, VerseLink, focusView, scrollStudyTo } from './Dictionary';
import { showSources } from './extras/kit';

const LABELS: Record<string, string> = {
  verses: 'verses',
  crossReferences: 'cross-references',
  roots: 'Hebrew, Aramaic and Greek roots',
  hebrewWords: 'Hebrew words',
  aramaicWords: 'Aramaic words',
  greekWords: 'Greek words',
  significantVariants: 'words where manuscripts differ in meaning',
  englishWords: 'distinct English words indexed',
};

/** How the themes are made, in numbers read from the build. */
function ThemesNote({ a }: { a: Atlas }) {
  const groups = a.meta.themeGroups?.length ?? 0;
  const broad = a.themes.filter((t) => t.level === 'study');
  const counted = a.themes.filter((t) => t.skipWith?.length);
  // The larger numbers that keep a verse out of a counting theme, in their own glosses.
  const larger = [...new Set(counted.flatMap((t) => t.skipWith!.map((r) => a.lemmas.gloss[r])))];
  const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);
  const r = a.meta.themeLinks;
  const near = a.meta.themeNear;
  const related = a.themes.reduce((n, t) => n + (t.related?.length ?? 0), 0);
  return (
    <>
      <h3>Themes</h3>
      <p>
        {a.themes.length} themes{groups ? ` in ${groups} groups` : ''}, each defined in config/themes.json by the Strong’s numbers of its Hebrew, Aramaic and Greek words. A verse is in a theme when one
        of those words is in its main text, so every lit verse can be checked in the original.
        {broad.length > 0 && ` ${broad.length} broad words (${broad.map((t) => t.name).join(', ')}) show only at Study, because they mostly light family lines, court stories and counts.`}
        {counted.length > 0 &&
          ` ${counted.map((t) => t.name).join(' and ')} leave out any verse that also holds a word for ${list(larger)}, so a number inside a larger count is not counted.`}
      </p>
      {r && (
        <p>
          A verse with no theme word of its own can reach a theme through its links: of its {r.top} strongest links with {r.votes} or more votes, {r.carriers} must lead to verses of that theme,
          or one link with {r.soloVotes} or more votes. Themes of more than {r.maxThemeSize} verses are never offered this way, nor a theme whose deliberately left-out sense is in the verse.
          Each such theme is shown with the verse it comes through.
        </p>
      )}
      {related > 0 && (
        <p>
          A verse can also show a theme through a related word, a word of the same family as one of the theme’s words (שָׁבַת “rested” in Genesis 2:2, from which שַׁבָּת Sabbath comes),
          from {related} pairs, each listed with its reason in config/theme-related.json; it is labelled as a related word and adds no verse to the theme.
        </p>
      )}
      <p>
        At Study, a verse no theme reaches shows the subjects Nave’s Topical Bible (1896) lists it under, each opening in Ask the Bible: subjects whose references of 3 verses or fewer cite it,
        those citing it in the most lines first, then the smaller; else up to two passages of 4 to 60 verses that hold it. Only subjects about a concept are shown, never people, places or
        other names or those config/naves-display.json leaves out, and none becomes a theme.
      </p>
      {near && (
        <p>
          Themes are “often linked with” each other when, among the {near.pairs.toLocaleString()} pairs of verses joined by a link with {near.votes} or more votes, {near.minLinks} or more join
          the two themes, at least {near.minLift} times what chance would give for themes of their size.
        </p>
      )}
    </>
  );
}

/** Which notes cite a work, by the build's `where`: in plain words, the level
 * at which those notes show their sources, and how to say it below that. */
const WHERE: Record<string, { words: string; level: Depth; below: string } | undefined> = {
  aramaic: { words: 'the notes on Aramaic and Hebrew words', level: 'deep', below: 'the detailed notes on Aramaic and Hebrew words (shown at Deep)' },
  'hard-verses': { words: 'the pages that answer hard passages', level: 'deep', below: 'the pages that answer hard passages (shown at Deep)' },
};

/** How many places a card names before "and N more". */
const CITED_SHOWN = 4;

/** At Simple, a group with more works than this waits behind one tap. */
const FOLD_OVER = 8;

/** A citation string as the app shows it, and, when it names a work on the
 * shelf, a link to that work's card. The text is shown as it is. */
export function CitedSource({ a, text }: { a: Atlas; text: string }) {
  const shelf = useShelf(a);
  const w = shelf ? workFor(shelf, text) : null;
  if (!w) return <>{text}</>;
  return (
    <button type="button" class="shelf-citelink" onClick={() => showSources(w.id)} title={`About this source: ${w.title}`}>
      {text}
    </button>
  );
}

export function Sources({ a }: { a: Atlas }) {
  const shelf = useShelf(a);
  const r = S.shelfRead.value;
  // A link to a dictionary the shelf does not have shows the shelf.
  if (r && (!shelf || shelf.dictionaries[r.dict])) return <Dictionary a={a} shelf={shelf} dict={r.dict} term={r.term} />;
  return <ShelfView a={a} shelf={shelf} />;
}

/** What commentary is, with the notice again, or commentary closed again. */
function CommentaryShelf() {
  const gate = useGate<HTMLButtonElement>();
  const see = useRef<HTMLButtonElement>(null);
  /** Set when the reader closes commentary here: the focus goes to "See the notice". */
  const shut = useRef(false);
  useLayoutEffect(() => {
    if (!gate.open && shut.current) see.current?.focus();
    shut.current = false;
  }, [gate.open]);
  return (
    <section class="cn-shelf" aria-label="Commentary">
      <h3>Commentary</h3>
      <p>Some parts of this app show commentary: people’s words about the Bible, not God’s Word. They open after a short notice.</p>
      {gate.open ? (
        <>
          <p class="cn-state">Commentary is open on this device.</p>
          <div class="cn-row">
            <button type="button" class="cn-link" ref={gate.start} onClick={() => void reviewNotice()} {...ASKS}>
              See the notice again
            </button>
            <button
              type="button"
              class="cn-link"
              onClick={() => {
                shut.current = true;
                closeCommentary();
              }}
            >
              Close commentary again
            </button>
          </div>
        </>
      ) : (
        <div class="cn-row">
          <button type="button" class="cn-open" ref={see} onClick={gate.ask} {...ASKS}>
            See the notice
          </button>
        </div>
      )}
    </section>
  );
}

/** The last request to bring a card into view that the shelf has followed. */
let followed = 0;

function ShelfView({ a, shelf }: { a: Atlas; shelf: Shelf | null | undefined }) {
  const study = atLeast('study');
  const deep = atLeast('deep');
  const open = S.shelfWork.value;
  const jump = S.shelfJump.value;
  const box = useRef<HTMLDivElement>(null);
  const [unfolded, setUnfolded] = useState<readonly string[]>([]);

  // Bring the open card into view: to the top when it was asked for from
  // elsewhere, and just into view when a card above it closed. When asked
  // for, the focus follows: to the card, or to the shelf's title.
  useEffect(() => {
    if (!shelf) return;
    const asked = followed !== jump;
    followed = jump;
    if (!open && !asked) return;
    // After the tab's own scroll back to the top.
    const t = window.setTimeout(() => {
      const card = open ? box.current?.querySelector<HTMLElement>(`[data-work="${open}"]`) : null;
      if (card) scrollStudyTo(card, !asked);
      if (asked) focusView(card?.querySelector<HTMLElement>('.shelf-head') ?? box.current?.querySelector<HTMLElement>('h2'));
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, jump, !!shelf]);

  const m = a.meta;
  const unmapped = Object.values(m.unmapped).reduce((s, x) => s + x, 0);
  return (
    <div class="panel shelf" ref={box}>
      <h2 tabIndex={-1}>Sources</h2>
      <p class="shelf-lead">Everything in this app comes from the works below. {S.TAP} one to see what it is, who made it and where to read it.</p>
      <CommentaryShelf />
      {shelf === undefined && <p class="muted">…</p>}
      {shelf === null && <p class="muted">Couldn’t load the list of sources. Check your connection.</p>}
      {shelf &&
        shelf.groups.map((g) => {
          const works = shelf.works.filter((w) => w.group === g.id);
          if (!works.length) return null;
          const folded = !study && works.length > FOLD_OVER && !unfolded.includes(g.id) && !works.some((w) => w.id === open);
          return (
            <section key={g.id} class="shelf-group" aria-label={g.name}>
              <h3>{g.name}</h3>
              {folded ? (
                <button type="button" class="shelf-btn shelf-unfold" onClick={() => setUnfolded([...unfolded, g.id])}>
                  Show all {works.length} ›
                </button>
              ) : (
                <ul class="shelf-list">
                  {works.map((w) => (
                    <Card key={w.id} a={a} shelf={shelf} w={w} open={open === w.id} study={study} deep={deep} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}

      {study && (
        <>
          <h3>ESV</h3>
          <p>
            The ESV text is requested one chapter at a time from Crossway’s API through this site’s server, which holds the API key and never stores more than 500 verses, as the{' '}
            <a href="https://api.esv.org/" target="_blank" rel="noopener">
              ESV API terms
            </a>{' '}
            require. Search, the map and the word links use the BSB, which is public domain.
            {!ESV_ENABLED && ' This copy of the site has no server, so the ESV is turned off here. Run it yourself with an ESV API key to read the ESV.'}
          </p>
        </>
      )}

      {study && (
        <>
          <h3>NET</h3>
          <p>
            The NET Bible is read one chapter at a time from its publisher’s free web service (labs.bible.org) while you read it, and is never stored in the app or on your device. Its{' '}
            <a href="https://netbible.com/copyright/" target="_blank" rel="noopener">
              permissions
            </a>{' '}
            let free apps quote it when the quotation ends with (NET) linked to netbible.org, which the reader shows under every NET chapter. Its permissions do not cover the translators’ notes, so at Study the “Translators’ notes” button puts a link under the selected verse to its notes on netbible.org.
          </p>
        </>
      )}

      {study && <ThemesNote a={a} />}

      {deep && (
        <>
          <h3>Checks</h3>
          <p>
            Every dataset is openly licensed, pinned to an exact git commit and checked against a SHA-256 hash before every build. Nothing is typed in by hand except the theme word lists and their reviewed related words (config/theme-related.json), the sets of parallel passages (config/parallels.json), the Aramaic and Hebrew
            words the Gospels and Acts keep (config/aramaic.json), the layers of meaning notes (config/layers.json), which Nave’s headings the Themes tab leaves out or lets through, and the few Nave’s references it corrects (config/naves-display.json), a short list of corrections to the Greek lexicon used by the Outside the Bible notes, the table that assigns chapters and books to the Tyndale
            Open Bible Dictionary’s eras and dates, and this shelf: what each work is, who made it, when, and where to read or find it (config/shelf.json). Every quotation in the eras table is checked word for word against the dictionary when the data is built.
          </p>
          <div class="stats">
            {Object.entries(LABELS).map(([k, l]) => (
              <div key={k}>
                <b>{(m.counts[k] ?? 0).toLocaleString()}</b>
                <span>{l}</span>
              </div>
            ))}
          </div>
          <p class="muted">
            {unmapped === 0 ? 'Every cross-reference and every original-language word in the sources was mapped to a verse; nothing was dropped.' : `${unmapped} source rows could not be mapped to a verse.`} Build <code>{m.buildId}</code>.
          </p>
          <h3>How to check it yourself</h3>
          <p>
            Clone the repository and run <code>make data</code>. It downloads the same files, verifies their hashes, rebuilds every output and runs the verification suite, which checks, among other things, that Genesis 1:1 begins בראשית, that John 1:1 uses
            λόγος three times, that Daniel 2:5 is Aramaic, and that every word index points at the right word. The build is deterministic: the same inputs give the same build id.
          </p>
        </>
      )}

      <h3>What the map does and does not show</h3>
      <p>A link means readers judged two passages related; the vote count shows how many agreed. The map shows connections, not proof, and each one can be traced to its source here.</p>
    </div>
  );
}

function Card({ a, shelf, w, open, study, deep }: { a: Atlas; shelf: Shelf; w: Work; open: boolean; study: boolean; deep: boolean }) {
  const body = `shelf-${w.id}`;
  const datasets = w.datasets.map((id) => a.meta.sources.find((s) => s.id === id)).filter((s): s is SourceMeta => !!s);
  const dict = w.read?.app === 'dictionary' ? shelf.dictionaries[w.id] : undefined;
  return (
    <li class={`shelf-card${open ? ' shelf-on' : ''}`} data-work={w.id}>
      <button type="button" class="shelf-head" aria-expanded={open} aria-controls={open ? body : undefined} onClick={() => (S.shelfWork.value = open ? null : w.id)}>
        <span class="shelf-plain">{w.plain}</span>
        <span class="shelf-title">{w.title}</span>
        <span class="shelf-chev" aria-hidden="true">
          ›
        </span>
      </button>
      {open && (
        <div class="shelf-body" id={body}>
          <p class="shelf-what">{w.what}</p>
          <dl class="facts shelf-facts">
            <dt>By</dt>
            <dd>{w.by}</dd>
            {w.when && (
              <>
                <dt>When</dt>
                <dd>{w.when}</dd>
              </>
            )}
            <dt>License</dt>
            <dd>{licenseWords(w)}</dd>
            {dict && (
              <>
                <dt>Entries</dt>
                <dd>{dict.entries.toLocaleString()}</dd>
              </>
            )}
          </dl>
          {/* What is copyrighted is said plainly at every level ("the scroll is ancient; the edition is under copyright"). */}
          {w.license === 'copyrighted' && w.licenseNote && <p class="muted shelf-note">{w.licenseNote}</p>}
          <Actions w={w} canRead={!!dict || w.read?.app !== 'dictionary'} />
          <CitedIn a={a} w={w} />
          {study && w.writers && w.writers.length > 0 && <Writers w={w} />}
          {study &&
            datasets.map((s) => (
              <p key={s.id} class="shelf-provides">
                {datasets.length > 1 && <b>{s.title}: </b>}
                {s.provides}
              </p>
            ))}
          {deep && (
            <div class="shelf-deep">
              <h4>Full citation</h4>
              <p class="shelf-citation">{w.citation}</p>
              {w.licenseNote && w.license !== 'copyrighted' && <p class="muted">{w.licenseNote}</p>}
              {datasets.map((s) => (
                <Dataset key={s.id} s={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** "Read it" and "Find it". A copyrighted work is never offered to read. */
function Actions({ w, canRead }: { w: Work; canRead: boolean }) {
  const r = w.license === 'copyrighted' || !canRead ? undefined : w.read;
  const f = w.find;
  if (!r && !f) return null;
  return (
    <div class="shelf-actions">
      {r?.app === 'dictionary' && (
        <button type="button" class="shelf-btn shelf-main" onClick={() => S.step(() => (S.shelfRead.value = { dict: w.id, term: null }))}>
          Read it <small>in this app</small>
        </button>
      )}
      {r?.app === 'bible' && (
        <button
          type="button"
          class="shelf-btn shelf-main"
          onClick={() => {
            // On a phone the reader is the other pane. On a wide screen it is
            // beside the shelf already: the reader's place is kept, with the
            // selected verse brought into sight if it is not.
            S.mobilePane.value = 'read';
            document.querySelector('.reader .verse.sel')?.scrollIntoView({ block: 'nearest' });
          }}
        >
          Read it <small>in this app</small>
        </button>
      )}
      {r?.url && (
        <a class="shelf-btn shelf-main" href={r.url} target="_blank" rel="noopener">
          Read it <small>free at {r.label ?? 'its site'} ↗</small>
        </a>
      )}
      {f && (
        <a class="shelf-btn" href={f.url} target="_blank" rel="noopener">
          Find it <small>{f.label} ↗</small>
        </a>
      )}
    </div>
  );
}

/** Where the app cites a work: "Cited in the notes on Aramaic and Hebrew
 * words at Mark 5:41, Mark 7:34 and 3 more." The button names how many places
 * it shows; any the shelf has no room for are counted after. */
function CitedIn({ a, w }: { a: Atlas; w: Work }) {
  const [all, setAll] = useState(false);
  if (!w.cited.length) return null;
  const by = new Map<string, Cited[]>();
  for (const c of w.cited) by.set(c.where, [...(by.get(c.where) ?? []), c]);
  // Places the shelf has no room to list (it lists at most 100).
  const unlisted = Math.max(0, w.citedCount - w.cited.length);
  return (
    <>
      {[...by].map(([where, places], k) => {
        const shown = all ? places : places.slice(0, CITED_SHOWN);
        const hidden = places.length - shown.length;
        const extra = k === by.size - 1 ? unlisted : 0;
        const notes = WHERE[where];
        const words = !notes ? 'the notes' : atLeast(notes.level) ? notes.words : notes.below;
        return (
          <p key={where} class="shelf-cited">
            Cited in {words} at{' '}
            {shown.map((c, i) => (
              <span key={i}>
                {i > 0 && (i === shown.length - 1 && hidden === 0 ? ' and ' : ', ')}
                <VerseLink a={a} verse={c.verse} to={c.to} />
              </span>
            ))}
            {hidden > 0 && (
              <>
                {' and '}
                <button type="button" class="shelf-more" onClick={() => setAll(true)}>
                  {hidden} more
                </button>
              </>
            )}
            .{extra > 0 && ` Also ${extra} more ${extra === 1 ? 'place' : 'places'} not listed here.`}
          </p>
        );
      })}
    </>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-10-20" as "20 October 2026". */
function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** A reference as a reader reads it: "Psalm 118:14", not "Psalms 118:14". */
const refWords = (on: string) => on.replace(/^Psalms /, 'Psalm ');

/** "Psalm 86, Proverbs 1 and Ecclesiastes". */
const andList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Where the naming words are: "the title page of the printed volume", "the
 * page's credit line", "the list of the continuation's writers in Edmund
 * Calamy's account ...". Null when nothing names the writer, or when there is
 * no scan or page a reader can open to check the words. */
function namedWhere(n: HowWeKnow['named_by']): string | null {
  if (!n.leaf || !(n.scan || n.page)) return null;
  if (n.of) return `the ${n.leaf} ${n.leaf.includes(' of ') ? 'in' : 'of'} ${n.of}`;
  if (n.scan) return n.leaf === 'library record' ? 'the library record of the scan' : `the ${n.leaf} of the printed volume`;
  return `the page's ${n.leaf}`;
}

/** Whether a leaf is more than one thing ("title pages", "opening lines"), for the verb. */
function plural(leaf: string): boolean {
  const head = leaf.split(' of ')[0].replace(/\s*\(.*\)$/, '').split(' ').pop() ?? '';
  return head.endsWith('s') && !head.endsWith("'s");
}

/** Who names the writer, in words true of the row: "The title page of the
 * printed volume names the writer: “…”", "The page's credit line says: “…”"
 * when the words name no one, "The page names no writer." */
function NamedSentence({ row, h }: { row: WriterRow; h: HowWeKnow }) {
  const n = h.named_by;
  const link = n.scan ? `https://archive.org/details/${n.scan}` : n.page;
  const writers = row.writer.includes(' and ') ? 'writers' : 'writer';
  const linked = (words: string) =>
    link ? (
      <a href={link} target="_blank" rel="noopener">
        {words}
      </a>
    ) : (
      words
    );
  const where = namedWhere(n);
  if (!where) {
    if (!n.page) return null;
    const read = n.read ? ` (read ${longDate(n.read)})` : '';
    if (h.level === 'none' || !n.names) return <>{linked('The page')} names no writer{read}. </>;
    return <>{linked('The page')} names its {writers}{read}. </>;
  }
  const many = plural(n.leaf!);
  const verb = n.names ? `${many ? 'name' : 'names'} the ${writers}` : many ? 'say' : 'says';
  const ends = /[.!?]["'”’]?$/.test(n.words);
  return (
    <>
      {linked(where[0].toUpperCase() + where.slice(1))}
      {` ${verb}: “${n.words}”`}
      {n.read ? ` (read ${longDate(n.read)}).` : ends ? '' : '.'}{' '}
    </>
  );
}

/** How many of the comments the app cites from the part were found in the
 * printed commentary, each comment counted once however many notes cite it,
 * with subject and verb agreeing. Nothing when none was found: the note says why. */
function countWords(c: NonNullable<HowWeKnow['count']>): string | null {
  if (!c.found) return null;
  const from = c.of === 'book' ? 'this book' : c.of === 'books' ? 'these books' : 'these chapters';
  const when = longDate(c.on);
  const chapter = !c.chapter ? '' : c.found === 1 ? ' (only as part of the whole chapter)' : ` (${c.chapter === 1 ? 'one' : c.chapter} of them only as part of the whole chapter)`;
  if (c.checked < c.comments) {
    const found = c.found === c.checked ? (c.checked === 1 ? 'it was' : c.checked === 2 ? 'both were' : `all ${c.checked} were`) : `${c.found} of them ${c.found === 1 ? 'was' : 'were'}`;
    return `Of the ${c.comments} comments the app cites from ${from}, ${c.checked} ${c.checked === 1 ? 'was' : 'were'} checked against the printed commentary on ${when}, and ${found} found in it${chapter}.`;
  }
  const subject =
    c.comments === 1 ? `The one comment the app cites from ${from} was` : c.found === c.comments ? `${c.comments === 2 ? 'Both' : `All ${c.comments}`} comments the app cites from ${from} were` : `Of the ${c.comments} comments the app cites from ${from}, ${c.found} ${c.found === 1 ? 'was' : 'were'}`;
  return `${subject} found in the printed commentary when checked on ${when}${chapter}.`;
}

/** How we know who wrote a part: where the writer is named and in what
 * words, how many of the comments the app cites now were found in the printed
 * book (or that the site's text was matched to it), one of them to search for,
 * and what is still weaker or missing. A writer the notes no longer cite gets
 * only the words that name him. */
function HowWeKnowLine({ row }: { row: WriterRow }) {
  const h = row.how;
  if (!h) return null;
  const named = <NamedSentence row={row} h={h} />;
  const hasNamed = !!namedWhere(h.named_by) || !!h.named_by.page;
  const count = h.count ? countWords(h.count) : null;
  // Where the writer is named in another printing than the one matched, the match says which.
  const volume = h.matched?.of ?? 'the printed volume';
  const matched = h.matched ? `The site's text${h.level === 'chapter' ? ' of a chapter of this book' : ''} was matched to ${volume} on ${longDate(h.matched.on)}.` : null;
  const e = h.example;
  const example =
    e && e.words && e.check ? (
      <>
        {'For example, '}
        <a href={e.page} target="_blank" rel="noopener">
          its comment on {refWords(e.on)}
        </a>
        {` has the words “${e.words}”${e.read ? ` (read ${longDate(e.read)})` : ''}. `}
        <a href={e.check} target="_blank" rel="noopener">
          Search {volume} for those words ›
        </a>{' '}
      </>
    ) : e && count ? (
      <>
        {'One of them is '}
        <a href={e.page} target="_blank" rel="noopener">
          its comment on {refWords(e.on)}
        </a>
        .{' '}
      </>
    ) : null;
  if (!hasNamed && !count && !matched && !example && !h.note) return null;
  return (
    <p class="shelf-how">
      <b>How we know: </b>
      {named}
      {count && `${count} `}
      {matched && `${matched} `}
      {example}
      {h.note}
    </p>
  );
}

/** Who wrote the words of each part of a work the Layers notes cite. A part
 * printed without a writer's name says so as the Layers credit line does; a
 * writer the notes no longer cite, or a part `denies` leaves out, is marked. */
function Writers({ w }: { w: Work }) {
  const rows = w.writers ?? [];
  const says = [...new Map(rows.filter((r) => r.site_says).map((r) => [r.site_says!, r.site!])).entries()];
  const cap = (x: string) => x[0].toUpperCase() + x.slice(1);
  return (
    <div class="shelf-writers">
      <h4>Who wrote it</h4>
      {says.map(([s, site]) => (
        <p key={s} class="muted">
          The app reads it on a site that files it as “{site}”, with the credit line “{s}”{/[.!?]$/.test(s) ? '' : '.'} Each part below names who wrote the words.
        </p>
      ))}
      <ul>
        {rows.map((r, i) => (
          <li key={i}>
            {(w.layer?.length ?? 0) > 1 && r.work && !r.books && <i>{r.work}: </i>}
            {r.books && <b>{cap(r.books)}: </b>}
            {r.named === 'attributed'
              ? `${r.books ? 'printed' : 'Printed'} without a writer's name and generally credited to ${r.writer}`
              : r.named === 'unnamed'
                ? cap(r.writer)
                : r.writer}
            {r.about && ` (${r.about})`}
            {r.volume && `, ${r.volume}`}
            {r.edition && `, ${r.edition}`}
            {`, ${r.written}.`}
            {r.excluded && ' No longer cited.'}
            {!r.excluded && r.left_out && (r.left_out_all ? ' Not cited now.' : ` Not cited on ${andList(r.left_out)}.`)}
            {!r.excluded && r.left_out && ' A passage is left out here until a decision on it is made.'}
            <HowWeKnowLine row={r} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A dataset's pins, for Deep: its license, attribution, commit and checksums. */
function Dataset({ s }: { s: SourceMeta }) {
  return (
    <div class="src">
      <b>{s.title}</b>
      <p class="muted">
        License: {s.license}.{' '}
        <a href={s.homepage} target="_blank" rel="noopener">
          Project page
        </a>{' '}
        ·{' '}
        <a href={`${s.repo}/tree/${s.commit}`} target="_blank" rel="noopener">
          Commit {s.commit.slice(0, 10)}
        </a>
      </p>
      <p class="muted shelf-small">{s.attribution}</p>
      {s.note && <p class="muted shelf-small">{s.note}</p>}
      {s.files.length > 0 && (
        <details class="src-files">
          <summary>{s.files.length === 1 ? 'The file and its checksum' : `${s.files.length} files and their checksums`}</summary>
          {s.files.map((f) => (
            <div key={f.path} class="hash">
              <code>{f.path}</code>
              <br />
              SHA-256 {f.sha256}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
