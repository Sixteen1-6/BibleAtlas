// The Layers card: what a passage says plainly, and the meanings stacked on
// top of it. Simple opens on one note with the rest a tap away; Study shows
// every layer with its Hebrew or Greek words; Deep adds the evidence, who
// reviewed it, and a way to suggest a correction.

import { useState } from 'preact/hooks';
import { type Atlas, label, rangeLabel } from '../data/atlas';
import { type Layer, type LayerRef, type Passage, SECTIONS, type Section, leadLayer, passageAt, passages, pointingAt } from '../data/layers';
import { atLeast } from '../depth';
import * as S from '../state';

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

function RefChip({ a, p, r }: { a: Atlas; p: Passage; r: LayerRef }) {
  return (
    <button
      class={`layerref${r.arc ? '' : ' noarc'}`}
      onClick={(e) => (e.stopPropagation(), S.selectVerse(r.s))}
      title={r.arc ? 'Open this passage' : 'Open this passage. The cross-reference map has no arc for this link, so it is drawn dashed.'}
    >
      {rangeLabel(a, r.s, r.e - r.s + 1)}
      {!r.arc && p.v !== r.s && <span class="dash" aria-hidden="true" />}
    </button>
  );
}

function WordChip({ a, w }: { a: Atlas; w: [number, number, number] }) {
  const [verse, pos, root] = w;
  const L = a.lemmas;
  const lang = L.lang[root];
  return (
    <button class="chip" onClick={(e) => (e.stopPropagation(), S.openRoot(root, verse, pos))} title={`${L.key[root]} in ${label(a, verse)}`}>
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

function LayerItem({ a, p, l }: { a: Atlas; p: Passage; l: Layer }) {
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
      </div>
      <p>{smart(l.text)}</p>
      {(refs.length > 0 || (study && words.length > 0)) && (
        <div class="layerlinks">
          {refs.map((r) => (
            <RefChip key={`${r.s}-${r.e}`} a={a} p={p} r={r} />
          ))}
          {study && words.map((w) => <WordChip key={w[2]} a={a} w={w} />)}
        </div>
      )}
      {deep && (
        <p class="layerdeep">
          {l.evidence && <>Behind this note: {smart(l.evidence.replace(/\.\s*$/, ''))}. </>}
          <a href={issueLink(a, p, l)} target="_blank" rel="noopener">
            Suggest a correction
          </a>
        </p>
      )}
    </li>
  );
}

/** The card for the selected verse, or a pointer to a layered passage that points here. */
export function LayersCard({ a, v }: { a: Atlas; v: number }) {
  const list = passages.value;
  const [openFor, setOpenFor] = useState<string | null>(null);
  const p = passageAt(list, v);
  if (!p) {
    const from = pointingAt(list, v);
    if (!from.length) return null;
    return (
      <div class="layerpointer">
        {from.slice(0, 3).map((q) => (
          <button key={q.id} class="godeeper" onClick={() => S.selectVerse(q.v)}>
            {label(a, q.v)} has layers of meaning that lead here ›
          </button>
        ))}
      </div>
    );
  }
  const study = atLeast('study');
  const open = study || openFor === p.id;
  const lead = leadLayer(p);
  const shown = open ? p.layers : lead ? [lead] : p.layers.slice(0, 1);
  return (
    <section class="layers" aria-label="Layers of meaning">
      <h3>
        Layers of meaning
        {p.draft && (
          <span class="badge draft" title="Not yet reviewed by a person. Drafts only appear in preview builds.">
            Draft
          </span>
        )}
      </h3>
      <ol>
        {shown.map((l, i) => (
          <LayerItem key={i} a={a} p={p} l={l} />
        ))}
      </ol>
      {!open && p.layers.length > shown.length && (
        <button class="godeeper" onClick={() => setOpenFor(p.id)}>
          See all {p.layers.length} layers
          {' ›'}
        </button>
      )}
      {atLeast('deep') && (
        <p class="layerdeep">
          {p.source} {p.reviewed_by.length ? `Reviewed by ${p.reviewed_by.join(' and ')}.` : 'Not yet reviewed by a person.'} Every quotation of four or more words is checked
          against the BSB when the data is built.
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
              <button key={p.id} class="btn" onClick={() => (S.selectVerse(p.v), (S.mobilePane.value = 'study'))}>
                {label(a, p.v)}
              </button>
            ))}
          </div>
        </details>
      ))}
    </>
  );
}
