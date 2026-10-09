// The panel behind the dictionary line.
//
// Study: a plain sentence, then each entry that cites the verse (its name and
//   which dictionary). Tapping one shows its text, with the verses it names as
//   links, and a way to read on in the dictionary on the Sources shelf.
// Deep: adds which dictionaries these are and how entries are matched to verses.
// Loaded the first time a reader opens it (dictionary.extra.tsx).

import { useState } from 'preact/hooks';
import { EntryText, useEntry } from '../../Dictionary';
import { Facts, Lead, SourceNote, refName, showSources } from '../kit';
import { levelAtLeast } from '../level';
import type { PanelProps, VerseRef } from '../types';
import { type Data, listingsAt, year } from './model';
import type { Atlas } from '../../../data/atlas';

function Body({ a, dict, slug, title, navigate }: { a: Atlas; dict: string; slug: string; title: string; navigate: (v: VerseRef) => void }) {
  const e = useEntry(a, dict, slug);
  if (e === undefined) return <p class="xt-wait">…</p>;
  if (e === null) return <p class="x-dictionary-hint">Couldn’t load this entry. Check your connection.</p>;
  if (e === 'missing') return <p class="x-dictionary-hint">Couldn’t find this entry in the dictionary.</p>;
  return (
    <div class="x-dictionary-body">
      <EntryText a={a} text={e.text} go={navigate} />
      <button type="button" class="x-dictionary-open" onClick={() => showSources(dict, slug)}>
        Read on in {title} ›
      </button>
    </div>
  );
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const list = listingsAt(data, verse);
  const [open, setOpen] = useState<string | null>(null);
  if (list === undefined) return <p class="xt-lead xt-wait">…</p>;
  const name = (id: string) => data.titles.get(id)?.title ?? id;
  const ids = [...new Set(list.map((l) => l[0]))];
  return (
    <>
      <Lead>
        {list.length === 1 ? 'An entry' : 'Entries'} in {ids.length === 1 ? 'an old Bible dictionary' : 'old Bible dictionaries'} that cite {refName(a, verse)}. They were written in the 1800s, so some of what they say is out of date.
      </Lead>
      <ul class="x-dictionary-list">
        {list.map(([dict, slug, entry]) => {
          const key = `${dict}/${slug}`;
          const on = open === key;
          const t = data.titles.get(dict);
          return (
            <li key={key} class={`x-dictionary-item${on ? ' x-dictionary-on' : ''}`}>
              <button type="button" class="x-dictionary-head" aria-expanded={on} onClick={() => setOpen(on ? null : key)}>
                <span class="x-dictionary-name">{entry}</span>
                <span class="x-dictionary-from">
                  {name(dict)}
                  {t ? `, ${year(t.when)}` : ''}
                </span>
                <span class="x-dictionary-chev" aria-hidden="true">
                  ›
                </span>
              </button>
              {on && <Body a={a} dict={dict} slug={slug} title={name(dict)} navigate={navigate} />}
            </li>
          );
        })}
      </ul>
      {levelAtLeast('deep') && (
        <Facts
          rows={[
            ['Dictionaries', [...data.titles].map(([, t]) => `${t.title}, ${t.when}`).join('; ')],
            ['How entries are matched', 'An entry is listed under each verse it cites: every verse of a passage of up to ten verses, and the first verse of a longer one. Entries named in the verse come first, then those that cite it most narrowly.'],
            ['Entries here', String(list.length)],
          ]}
        />
      )}
      <SourceNote>
        Easton’s Bible Dictionary (1897) and Smith’s Bible Dictionary (1884), both public domain, in the Christian Classics Ethereal Library’s transcription, by way of Jon Craton’s CCEL Paragraphs (CC BY-SA 4.0) and NEUU’s Bible Dictionary Dataset (CC BY 4.0).
      </SourceNote>
    </>
  );
}
