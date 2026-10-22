// The Layers card: what a passage says plainly, and the meanings stacked on
// top of it. Simple opens on one note with the rest a tap away; Study shows
// every layer with its Hebrew or Greek words; Deep adds the evidence, the
// sources each note cites (with a link to read them), who reviewed it, and a
// way to suggest a correction.
//
// The notes are drawn from Christian writers, so the card stays closed (its
// heading, one line and "Read the notes") until the reader finishes the
// commentary notice (ui/commentary).
//
// A link that quotes the passage, or another passage in the same note, word
// for word or nearly, carries a quotation mark. That comes from the quotations
// extra's data (the BSB's own footnotes, crates/atlas-cli/src/extra_quotes.rs),
// which the reader's quotation line loads with the first selected verse.

import { useEffect, useState } from 'preact/hooks';
import { type Atlas, label, rangeLabel } from '../data/atlas';
import { type Cite, type Layer, type LayerRef, type Passage, SECTIONS, type Section, leadLayer, passageAt, passages, pointingAt } from '../data/layers';
import { atLeast } from '../depth';
import * as S from '../state';
import { Closed, CommentaryFoot, useGate } from './commentary/Gate';
import { dataState, ensureData } from './extras/data';
import { type Data as Quotes, isNt } from './extras/quotes/model';
import { extraById } from './extras/registry';

const REPO = 'https://github.com/Sixteen1-6/BibleAtlas';

const KIND_LABEL: Record<string, string> = {
  'plain meaning': 'Plain meaning',
  quotation: 'Quotation',
  allusion: 'Allusion',
  wordplay: 'Wordplay',
  'name meaning': 'Name',
  pattern: 'Pattern',
  irony: 'Irony',
  fulfillment: 'Fulfillment',
  setting: 'Setting',
};

const KIND_ABOUT: Record<string, string> = {
  'plain meaning': 'What the passage says in its own setting',
  quotation: 'Another passage quotes these words',
  allusion: 'Another passage borrows these words or images without saying so',
  wordplay: 'A play on Hebrew or Greek words that English can hide',
  'name meaning': 'What a name means, and why it matters here',
  pattern: 'A story shape or image that repeats elsewhere',
  irony: 'Words that mean more than the speaker knows',
  fulfillment: 'A promise or picture that comes true later',
  setting: 'Background that changes how the passage reads',
};

/** Curly quotes and apostrophes for display; the config keeps plain ones so quotes stay easy to check. */
function smart(text: string): string {
  return text.replace(/"([^"]*)"/g, '“$1”').replace(/(\w)'(\w)/g, '$1’$2');
}

const QUOTES = extraById('quotes');

/** The quotations data once it has loaded, else null (the marks simply wait). */
function useQuotes(a: Atlas): Quotes | null {
  useEffect(() => {
    if (QUOTES) ensureData(QUOTES, a);
  }, [a]);
  const s = QUOTES ? dataState(QUOTES) : undefined;
  return s?.state === 'ready' ? (s.data as Quotes) : null;
}

type Span = { s: number; e: number };

/** "A", "A and B", "A, B and C". */
function and(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** For each link in a layer ("s-e"), the quotation it takes part in: "Quotes
 * Psalm 8:2" or "Quoted in Matthew 21:16". Only quotations between the link
 * and the passage, or another link in the same layer, count, and echoes never. */
function quotedLinks(a: Atlas, q: Quotes, p: Passage, l: Layer): Map<string, string> {
  const partners: Span[] = [{ s: p.v, e: p.end }, ...l.refs];
  const out = new Map<string, string>();
  for (const r of l.refs) {
    const nt = isNt(a, r.s);
    const seen = new Set<string>();
    const names: string[] = [];
    for (let v = r.s; v <= r.e; v++) {
      for (const link of (nt ? q.byNt : q.byOt).get(v) ?? []) {
        const [from, to] = nt ? [link.ot, link.otTo] : [link.nt, link.ntTo];
        if (link.echo || seen.has(`${from}-${to}`) || !partners.some((x) => x.s <= to && from <= x.e)) continue;
        seen.add(`${from}-${to}`);
        names.push(rangeLabel(a, from, to - from + 1));
      }
    }
    if (names.length) out.set(`${r.s}-${r.e}`, `${nt ? 'Quotes' : 'Quoted in'} ${and(names)}`);
  }
  return out;
}

function RefChip({ a, p, r, quote }: { a: Atlas; p: Passage; r: LayerRef; quote?: string }) {
  const open = r.arc ? 'Open this passage' : 'Open this passage. The cross-reference map has no arc for this link, so it is drawn dashed.';
  return (
    <button
      class={`layerref${r.arc ? '' : ' noarc'}${quote ? ' quoted' : ''}`}
      data-lv={r.s}
      onClick={(e) => (e.stopPropagation(), S.selectVerse(r.s))}
      title={quote ? `${quote}, as the BSB's own footnotes show. ${open}` : open}
    >
      {quote && (
        <span class="qmark" aria-hidden="true">
          “
        </span>
      )}
      {rangeLabel(a, r.s, r.e - r.s + 1)}
      {quote && <span class="sr-only">, {quote[0].toLowerCase() + quote.slice(1)}</span>}
      {!r.arc && p.v !== r.s && <span class="dash" aria-hidden="true" />}
    </button>
  );
}

function WordChip({ a, w }: { a: Atlas; w: [number, number, number] }) {
  const [verse, pos, root] = w;
  const L = a.lemmas;
  const lang = L.lang[root];
  return (
    <button class="chip" data-lr={root} onClick={(e) => (e.stopPropagation(), S.openRoot(root, verse, pos))} title={`${L.key[root]} in ${label(a, verse)}`}>
      <span class={`o ${lang === 'G' ? 'gr' : 'he'}`}>{L.word[root]}</span>
      <span>{L.translit[root] || L.gloss[root]}</span>
    </button>
  );
}

function issueLink(a: Atlas, p: Passage, l: Layer): string {
  const title = `Layer: ${label(a, p.v)}, ${KIND_LABEL[l.kind] ?? l.kind}`;
  const body = `Passage: ${label(a, p.v)} (${p.id})\nLayer: ${l.kind}, ${l.strength}\n\n> ${l.text}\n\nWhat should change, and why (a verse, a footnote or a source helps):\n`;
  return `${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-10-20" as "20 October 2026". */
function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** When the app read the page, or, where no reading was recorded, when it was checked. */
function dateWords(c: Cite): string {
  if (c.read_on) return `retrieved ${longDate(c.read_on)}`;
  return `checked against the source by ${longDate(c.checked ?? '')}; the date it was read was not recorded`;
}

/** "Genesis 2:7", "2:7" when the book is the one before. */
function shortRef(on: string, first: string): string {
  const book = (r: string) => r.replace(/\s+\d+(:[\d-]+)?(-[\d:]+)?$/, '');
  return book(on) === book(first) ? on.slice(book(on).length + 1) : on;
}

/** One writer's credit in a note: who wrote the words and who he was, the
 * work and its date, the place cited, where the app read it and when, and a
 * link to read it there. Cites of one writer, work and date are one line. */
function CreditLine({ g }: { g: Cite[] }) {
  const c = g[0];
  const name = (
    <button type="button" class="credit-writer" onClick={() => S.openSources(c.shelf)} title={`About ${c.work}, on the Sources shelf`}>
      {c.named === 'unnamed' ? c.writer[0].toUpperCase() + c.writer.slice(1) : c.writer}
    </button>
  );
  const about = c.about ? ` (${c.about})` : '';
  const ons = g.map((x) => x.on ?? '').filter(Boolean);
  const place = g.length > 1 ? `on ${ons[0]}${ons.slice(1).map((o, i) => (i === ons.length - 2 ? ' and ' : ', ') + shortRef(o, ons[0])).join('')}` : c.part;
  const tail = `${c.edition ? `, ${c.edition}` : ''}, ${c.written}, ${place}. Read on ${c.read_from}`;
  return (
    <li>
      {c.named === 'unnamed' ? (
        <>
          {name}
          {`, ${c.work}`}
        </>
      ) : c.named === 'attributed' ? (
        <>
          {`${c.work}, printed without a writer's name and generally credited to `}
          {name}
          {about}
        </>
      ) : (
        <>
          {name}
          {`${about}, ${c.work}`}
        </>
      )}
      {tail}
      {c.label && <>, which labels it “{c.label}”</>}
      {`; ${dateWords(c)}. `}
      {g.length === 1 ? (
        <a href={c.url} target="_blank" rel="noopener">
          Read it there ›
        </a>
      ) : (
        <>
          Read them there:{' '}
          {g.map((x, i) => (
            <span key={i}>
              {i > 0 && ', '}
              <a href={x.url} target="_blank" rel="noopener">
                {shortRef(x.on ?? '', ons[0])} ›
              </a>
            </span>
          ))}
        </>
      )}
    </li>
  );
}

/** A note's sources, one line per writer, in the order the note cites them. */
function Credits({ cites }: { cites: Cite[] }) {
  const groups: Cite[][] = [];
  const same = (a: Cite, b: Cite) =>
    a.writer === b.writer && a.work === b.work && a.written === b.written && a.read_from === b.read_from && a.label === b.label && dateWords(a) === dateWords(b) && !a.at && !b.at && !!a.on && !!b.on;
  for (const c of cites) {
    const g = groups.find((x) => same(x[0], c));
    if (g) g.push(c);
    else groups.push([c]);
  }
  return (
    <div class="layercredits">
      <h4>Sources</h4>
      <ul>
        {groups.map((g, i) => (
          <CreditLine key={i} g={g} />
        ))}
      </ul>
    </div>
  );
}

function LayerItem({ a, p, l, quotes }: { a: Atlas; p: Passage; l: Layer; quotes: Map<string, string> }) {
  const study = atLeast('study');
  const deep = atLeast('deep');
  // The passage itself needs no chip; the others are where the layer leads.
  const refs = l.refs.filter((r) => !(r.s >= p.v && r.e <= p.end));
  // Unique words, in order (one chip per Hebrew or Greek word, however many verses it is in).
  const L = a.lemmas;
  const words = l.words.filter((w, i) => l.words.findIndex((x) => L.word[x[2]] === L.word[w[2]]) === i);
  return (
    <li class={`layer k-${l.kind.replace(' ', '-')}`}>
      <div class="layerhead">
        <span class="kind" title={KIND_ABOUT[l.kind]}>
          {KIND_LABEL[l.kind] ?? l.kind}
        </span>
        <span class="strength">{l.strength}</span>
        {l.draft && (
          <span class="badge draft" title="Neither reviewed by a person nor cited from a listed source. Drafts only appear in preview builds.">
            Draft
          </span>
        )}
      </div>
      <p>{smart(l.text)}</p>
      {(refs.length > 0 || (study && words.length > 0)) && (
        <div class="layerlinks">
          {refs.map((r) => (
            <RefChip key={`${r.s}-${r.e}`} a={a} p={p} r={r} quote={quotes.get(`${r.s}-${r.e}`)} />
          ))}
          {study && words.map((w) => <WordChip key={w[2]} a={a} w={w} />)}
        </div>
      )}
      {deep && (
        <>
          {l.evidence && <p class="layerdeep">Behind this note: {smart(l.evidence.replace(/\.\s*$/, ''))}.</p>}
          {l.cites && l.cites.length > 0 && <Credits cites={l.cites} />}
          <p class="layerdeep">
            <a href={issueLink(a, p, l)} target="_blank" rel="noopener">
              Suggest a correction
            </a>
          </p>
        </>
      )}
    </li>
  );
}

/** The card for the selected verse, or a pointer to a layered passage that points here. */
export function LayersCard({ a, v }: { a: Atlas; v: number }) {
  const list = passages.value;
  const [openFor, setOpenFor] = useState<string | null>(null);
  const q = useQuotes(a);
  const gate = useGate<HTMLHeadingElement>();
  const p = passageAt(list, v);
  if (!p) {
    const from = pointingAt(list, v);
    if (!from.length) return null;
    return (
      <div class="layerpointer">
        {from.slice(0, 3).map((q) => (
          <button key={q.id} class="godeeper" data-lv={q.v} onClick={() => S.selectVerse(q.v)}>
            {label(a, q.v)} has layers of meaning that lead here ›
          </button>
        ))}
      </div>
    );
  }
  if (!gate.open) {
    return (
      <section class="layers" aria-label="Layers of meaning">
        <h3>Layers of meaning</h3>
        <Closed line="Notes on what this passage means, drawn from Christian writers." button="Read the notes" onAsk={gate.ask} />
      </section>
    );
  }
  const study = atLeast('study');
  const open = study || openFor === p.id;
  const lead = leadLayer(p);
  const shown = open ? p.layers : lead ? [lead] : p.layers.slice(0, 1);
  const quotes = shown.map((l) => (q ? quotedLinks(a, q, p, l) : new Map<string, string>()));
  return (
    <section class="layers" aria-label="Layers of meaning">
      <h3 class="cn-start" ref={gate.start} tabIndex={-1}>
        Layers of meaning
        {p.draft && (
          <span class="badge draft" title="No note here is reviewed by a person or cited from a listed source yet. Drafts only appear in preview builds.">
            Draft
          </span>
        )}
      </h3>
      <ol>
        {shown.map((l, i) => (
          <LayerItem key={i} a={a} p={p} l={l} quotes={quotes[i]} />
        ))}
      </ol>
      {!open && p.layers.length > shown.length && (
        <button class="godeeper" onClick={() => setOpenFor(p.id)}>
          See all {p.layers.length} layers
          {' ›'}
        </button>
      )}
      <CommentaryFoot />
      {atLeast('deep') && (
        <p class="layerdeep">
          {p.source} Each note names the writers it rests on, with a link to read each one.{' '}
          {p.reviewed_by.length > 0 && `Reviewed by ${p.reviewed_by.join(' and ')}. `}
          Every quotation of four or more words is checked against the BSB when the data is built.
          {quotes.some((m) => m.size > 0) && ' A “ on a link marks a direct quotation, as the BSB’s own footnotes show it.'}
        </p>
      )}
    </section>
  );
}

/** Every layered passage, for the Links panel before anything is selected: one closed group per section. */
export function LayeredPassages({ a }: { a: Atlas }) {
  const list = passages.value;
  if (!list.length) return null;
  const groups = (Object.keys(SECTIONS) as Section[])
    .map((s) => [s, list.filter((p) => p.section === s).sort((x, y) => x.v - y.v)] as const)
    .filter(([, ps]) => ps.length > 0);
  return (
    <>
      <h3>Passages with layers of meaning</h3>
      {groups.map(([s, ps]) => (
        <details key={s} class="layersection">
          <summary>
            {SECTIONS[s]} <span class="muted">({ps.length})</span>
          </summary>
          <div class="startrow">
            {ps.map((p) => (
              <button key={p.id} class="btn" data-lv={p.v} onClick={() => (S.selectVerse(p.v), (S.mobilePane.value = 'study'))}>
                {label(a, p.v)}
              </button>
            ))}
          </div>
        </details>
      ))}
    </>
  );
}
