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

import './shelf.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Atlas, SourceMeta } from '../data/atlas';
import { ESV_ENABLED } from '../data/esv';
import { type Cited, type Shelf, type Work, licenseWords, useShelf, workFor } from '../data/shelf';
import { type Depth, atLeast } from '../depth';
import * as S from '../state';
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

/** Which notes cite a work, by the build's `where`: in plain words, the level
 * at which those notes show their sources, and how to say it below that. */
const WHERE: Record<string, { words: string; level: Depth; below: string } | undefined> = {
  aramaic: { words: 'the notes on Aramaic and Hebrew words', level: 'deep', below: 'the detailed notes on Aramaic and Hebrew words (shown at Deep)' },
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

      {deep && (
        <>
          <h3>Checks</h3>
          <p>
            Every dataset is openly licensed, pinned to an exact git commit and checked against a SHA-256 hash before every build. Nothing is typed in by hand except the theme word lists, the sets of parallel passages (config/parallels.json), the Aramaic and Hebrew
            words the Gospels and Acts keep (config/aramaic.json), the layers of meaning notes (config/layers.json), a short list of corrections to the Greek lexicon used by the Outside the Bible notes, the table that assigns chapters and books to the Tyndale
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
