// The panel behind the "People" line: each person the verse names, the
// verses that name them (marked on the map with one tap, the first few shown
// in the BSB), and their family, each a tap away. Facts from the text and the
// data only: no one's words about them.

import { useState } from 'preact/hooks';
import { label } from '../../../data/atlas';
import * as S from '../../../state';
import { Lead, Passage, SourceNote, showSources } from '../kit';
import { levelAtLeast } from '../level';
import type { PanelProps } from '../types';
import { type Data, type Person, SOURCE } from './model';

/** Verses shown in full under a person before "Show all". */
const FIRST = 3;

const FAMILY: [keyof Person, string][] = [
  ['father', 'Father'],
  ['mother', 'Mother'],
  ['partners', 'Married to'],
  ['children', 'Children'],
  ['siblings', 'Brothers and sisters'],
];

function PersonView({ props, i, open }: { props: PanelProps<Data>; i: number; open: (i: number) => void }) {
  const { a, data, verse, navigate } = props;
  const p = data.people[i];
  const [all, setAll] = useState(false);
  const n = p.verses.length;
  // The verse being read first, then the rest in Bible order.
  const others = p.verses.filter((v) => v !== verse);
  const shown = others.slice(0, FIRST);
  const family = FAMILY.map(([k, name]) => [name, p[k] as number[]] as const).filter(([, l]) => l.length > 0);
  const marked = S.marks.value?.label === p.name;
  return (
    <section class="x-people-person" aria-label={p.name}>
      <h3 class="x-people-name">{p.name}</h3>
      <p class="x-people-count">
        Named in {n.toLocaleString()} {n === 1 ? 'verse' : 'verses'}.{' '}
        {n > 1 && (
          <button type="button" class="x-people-btn" aria-pressed={marked} onClick={() => (S.marks.value = marked ? null : { verses: Uint32Array.from(p.verses), label: p.name })}>
            {marked ? 'Clear them from the map' : 'Mark them on the map'}
          </button>
        )}
      </p>
      {family.length > 0 && (
        <p class="x-people-family">
          {family.map(([name, l], k) => (
            <span key={name}>
              {k > 0 && ' · '}
              {name}:{' '}
              {l.map((j, m) => (
                <span key={j}>
                  {m > 0 && ', '}
                  <button type="button" class="x-people-link" onClick={() => open(j)}>
                    {data.people[j].name}
                  </button>
                </span>
              ))}
            </span>
          ))}
        </p>
      )}
      {shown.map((v) => (
        <Passage key={v} a={a} from={v} navigate={navigate} />
      ))}
      {others.length > FIRST &&
        (all ? (
          <p class="x-people-all">
            {others.slice(FIRST).map((v, k) => (
              <span key={v}>
                {k > 0 && ' · '}
                <button type="button" class="x-people-link" data-lv={v} onClick={() => navigate(v)}>
                  {label(a, v)}
                </button>
              </span>
            ))}
          </p>
        ) : (
          <button type="button" class="x-people-btn" onClick={() => setAll(true)}>
            Every verse that names {p.name.replace(/ \(.*\)$/, '')} ({others.length - FIRST} more)
          </button>
        ))}
    </section>
  );
}

export function Panel(props: PanelProps<Data>) {
  const { a, data, verse } = props;
  const here = data.at.get(verse) ?? [];
  // People opened from a family line, shown after the verse's own people.
  const [added, setAdded] = useState<{ verse: number; list: number[] }>({ verse, list: [] });
  const extra = added.verse === verse ? added.list : [];
  const open = (i: number) => {
    if (!here.includes(i) && !extra.includes(i)) setAdded({ verse, list: [...extra, i] });
    requestAnimationFrame(() => document.querySelector(`.x-people-person[aria-label="${CSS.escape(data.people[i].name)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };
  const deep = levelAtLeast('deep');
  return (
    <>
      <Lead>
        The people {label(a, verse)} names, and the other verses that name them.
      </Lead>
      {[...here, ...extra].map((i) => (
        <PersonView key={i} props={props} i={i} open={open} />
      ))}
      {deep && (
        <p class="x-people-how">
          A person is listed in a verse only where the Berean Standard Bible’s own words there use one of their names, so verses that speak of them only as “he” or “she” are not counted.{' '}
          <button type="button" class="x-people-link" onClick={() => showSources('theographic')}>
            About this data
          </button>
        </p>
      )}
      <SourceNote>{SOURCE}</SourceNote>
    </>
  );
}
