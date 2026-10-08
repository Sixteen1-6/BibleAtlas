// The Places panel. The map comes first, with this verse's places marked and
// the chapter's other places fainter. Under it, the verse's places by name;
// the chosen one gets one plain line about where it was, a label when that is
// uncertain, and other verses that name it. Deep adds how sure each site is,
// the other proposed sites and their coordinates, other readings of the word,
// and the people tied to the place.
//
// Only sites at least fairly sure (500 in 1000 or more) are marked by default.
// An uncertain place shows its proposed sites as dashed rings once it is
// chosen, or for all of this verse's places with "Show proposed sites".

import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { type Atlas, chapterName, chapterRange, locate } from '../../../data/atlas';
import { useJson } from '../data';
import { Facts, Lead, SourceNote, Unsure, refName } from '../kit';
import { levelAtLeast } from '../level';
import type { PanelProps, VerseRef } from '../types';
import { MapCanvas } from './MapCanvas';
import {
  type BaseFile,
  type Data,
  type Mention,
  type PeopleFile,
  type PlacesFile,
  coords,
  inHundred,
  info,
  latOf,
  lonOf,
  readingLine,
  spread,
  sureLine,
  tieWords,
  unsureLabel,
  whereLine,
} from './model';
import { type Marker, projX, projY } from './view';

/** People shown before "all N people". */
const PEOPLE_SHOWN = 8;

function and(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The chapter's other places: the name each goes by there, and the first verse naming it. */
function chapterPlaces(a: Atlas, data: Data, verse: VerseRef, here: readonly Mention[]): Map<number, { name: string; verse: VerseRef }> {
  const l = locate(a, verse);
  const [start, end] = chapterRange(a, l.book, l.chapter);
  const mine = new Set(here.map((m) => m.place));
  const out = new Map<number, { name: string; verse: VerseRef }>();
  for (let v = start; v < end; v++) {
    for (const m of data.byVerse.get(v) ?? []) if (!mine.has(m.place) && !out.has(m.place)) out.set(m.place, { name: m.name, verse: v });
  }
  return out;
}

const WATERS = new Set(['body of water', 'river']);

/** "the Red Sea", "the Jordan": waters take "the" in a sentence. */
function inSentence(name: string, kind: string): string {
  return WATERS.has(kind) && !/^the /i.test(name) ? `the ${name}` : name;
}

/** "where Migdol was is uncertain"; for waters, "which waters the Red Sea means here is uncertain". */
function unsureWords(items: readonly { name: string; kind: string }[]): string {
  const names = items.map((x) => inSentence(x.name, x.kind));
  if (items.length > 3) return 'where some of them were is uncertain';
  if (items.every((x) => WATERS.has(x.kind))) return `which waters ${and(names)} ${items.length === 1 ? 'means' : 'mean'} here is uncertain`;
  return `where ${and(names)} ${items.length === 1 ? 'was' : 'were'} is uncertain`;
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function lead(places: PlacesFile, here: readonly Mention[]): string {
  const names = [...new Set(here.map((m) => m.name))];
  const seen = new Set<string>();
  const unsure: { name: string; kind: string }[] = [];
  for (const m of here) {
    const p = info(places, m.place);
    if (p?.confident || seen.has(m.name)) continue;
    seen.add(m.name);
    unsure.push({ name: m.name, kind: p?.kind ?? 'place' });
  }
  const list = names.length <= 4 ? and(names) : `The ${names.length} places this verse names`;
  if (!unsure.length) return `${list} on a map of the Bible lands.`;
  if (unsure.length === names.length) return `${capital(unsureWords(unsure))}, so the map marks only the sites that have been proposed.`;
  return `${list} on a map of the Bible lands. ${capital(unsureWords(unsure))}.`;
}

const at = (lon: number, lat: number): [number, number] => [projX(lon), projY(lat)];

export function MapPanel({ a, data, verse, navigate }: PanelProps<Data>) {
  const places = useJson<PlacesFile>(a, 'extras/real-map/places.json');
  const base = useJson<BaseFile>(a, 'extras/real-map/base.json');
  const deep = levelAtLeast('deep');
  const people = useJson<PeopleFile>(a, deep ? 'extras/real-map/people.json' : null);
  const here = useMemo(() => data.byVerse.get(verse) ?? [], [data, verse]);
  const chapter = useMemo(() => chapterPlaces(a, data, verse, here), [a, data, verse, here]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [proposed, setProposed] = useState(false);
  const sel = chosen ?? here[0]?.place ?? null;

  const markers = useMemo(() => {
    const out: Marker[] = [];
    if (!places) return out;
    const add = (place: number, label: string, tier: 0 | 1 | 2, showProposed: boolean) => {
      const p = info(places, place);
      if (!p || !p.best) return;
      if (p.confident) {
        out.push({ place, label, x: projX(lonOf(p.best)), y: projY(latOf(p.best)), tier, area: p.area, proposed: false });
        return;
      }
      if (!showProposed) return;
      p.row[4].slice(0, 4).forEach((s, k) => {
        const text = k === 0 ? `${label}?` : tier === 0 && deep ? s[3] : '';
        out.push({ place, label: text, x: projX(lonOf(s)), y: projY(latOf(s)), tier, area: false, proposed: true });
      });
    };
    for (const [p, c] of chapter) add(p, c.name, p === sel ? 0 : 2, p === sel);
    for (const m of here) add(m.place, m.name, m.place === sel ? 0 : 1, proposed || m.place === sel);
    // Jerusalem, faintly, so there is always somewhere to get one's bearings
    // (the place lines say how far each place is from it).
    const jerusalem = places.places.findIndex((r) => r[1] === 'jerusalem');
    if (jerusalem >= 0 && !out.some((m) => m.place === jerusalem)) add(jerusalem, data.names[jerusalem] ?? 'Jerusalem', jerusalem === sel ? 0 : 2, false);
    return out;
  }, [places, here, chapter, sel, proposed, deep, data]);

  // Fit the verse's places that are fairly sure; if none are, the area of
  // the sites proposed for them.
  const fitPoints = useMemo(() => {
    const pts: [number, number][] = [];
    if (!places) return pts;
    for (const m of here) {
      const p = info(places, m.place);
      if (p?.confident && p.best) pts.push(at(lonOf(p.best), latOf(p.best)));
    }
    if (!pts.length) {
      for (const m of here) for (const s of info(places, m.place)?.row[4].slice(0, 3) ?? []) pts.push(at(lonOf(s), latOf(s)));
    }
    return pts;
  }, [places, here]);

  const revealPoints = useMemo(() => {
    const p = sel === null || !places ? null : info(places, sel);
    if (!p || !p.best) return [];
    return p.confident ? [at(lonOf(p.best), latOf(p.best))] : p.row[4].slice(0, 4).map((s) => at(lonOf(s), latOf(s)));
  }, [places, sel]);

  if (!places || !base) return <p class="xt-lead xt-wait">…</p>;

  // The chosen place shows its proposed sites anyway; the switch is for the others.
  const anyUnsure = here.some((m) => {
    const p = info(places, m.place);
    return m.place !== sel && !!p && !!p.best && !p.confident;
  });
  const nameOf = (p: number) => here.find((m) => m.place === p)?.name ?? chapter.get(p)?.name ?? data.names[p];
  const mapLabel = `Map of ${and([...new Set(here.map((m) => m.name))].slice(0, 6))}${chapter.size ? ', with the chapter’s other places' : ''}`;

  return (
    <>
      <Lead>{lead(places, here)}</Lead>
      <MapCanvas
        base={base}
        markers={markers}
        fitKey={String(verse)}
        fitPoints={fitPoints}
        revealKey={String(sel)}
        revealPoints={revealPoints}
        onTap={(p) => setChosen(p)}
        label={mapLabel}
      />
      <div class="x-real-map-under">
        <ul class="x-real-map-chips" aria-label="Places in this verse">
          {here.map((m) => {
            const unsure = unsureLabel(places, m.place);
            const on = m.place === sel;
            return (
              <li key={m.place}>
                <button type="button" class={`x-real-map-chip${on ? ' x-real-map-on' : ''}`} aria-pressed={on} onClick={() => setChosen(m.place)}>
                  <span class={`x-real-map-mark${unsure && unsure !== 'likely site' ? ' x-real-map-open' : ''}`} aria-hidden="true" />
                  {m.name}
                  {unsure && unsure !== 'likely site' && <span class="x-real-map-vh">, {unsure}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {anyUnsure && (
          <button type="button" class="x-real-map-toggle" aria-pressed={proposed} onClick={() => setProposed(!proposed)}>
            {proposed ? 'Hide proposed sites' : 'Show proposed sites'}
          </button>
        )}
      </div>
      {sel !== null && (
        <PlaceCard
          key={sel}
          a={a}
          data={data}
          places={places}
          people={deep ? people : undefined}
          place={sel}
          name={nameOf(sel)}
          verse={verse}
          chapterVerse={chapter.get(sel)?.verse}
          navigate={navigate}
          deep={deep}
        />
      )}
      <SourceNote>
        Places and their proposed sites from OpenBible.info’s Bible Geocoding Data, CC BY 4.0. The map is drawn from Natural Earth (public domain); its coastlines and rivers are today’s.
        {deep && ' People from Theographic Bible Metadata, CC BY-SA 4.0.'}
      </SourceNote>
    </>
  );
}

interface CardProps {
  a: Atlas;
  data: Data;
  places: PlacesFile;
  people: PeopleFile | null | undefined;
  place: number;
  name: string;
  verse: VerseRef;
  /** The first verse in this chapter naming it, when this verse does not. */
  chapterVerse: VerseRef | undefined;
  navigate: (v: VerseRef) => void;
  deep: boolean;
}

function Ref({ a, v, navigate, current }: { a: Atlas; v: VerseRef; navigate: (v: VerseRef) => void; current?: boolean }) {
  return (
    <button type="button" class={`x-real-map-ref${current ? ' x-real-map-here' : ''}`} onClick={() => navigate(v)} aria-current={current ? 'true' : undefined}>
      {refName(a, v)}
    </button>
  );
}

function PlaceCard({ a, data, places, people, place, name, verse, chapterVerse, navigate, deep }: CardProps) {
  const [all, setAll] = useState(false);
  const vs = data.versesOf[place] ?? [];
  const inVerse = vs.includes(verse);
  const unsure = unsureLabel(places, place);
  const p = info(places, place);
  const aka = [...new Set([data.names[place], ...(data.aka.get(place) ?? [])])].filter((n) => n !== name);
  const others = spread(vs, 3, verse);
  const sites = p?.row[4] ?? [];
  return (
    <section class="x-real-map-card" aria-label={name}>
      <p class="x-real-map-where">
        <strong>{name}</strong>: {whereLine(places, place, vs.length)}.
        {unsure && <Unsure title={!p?.best || p.confident ? undefined : `${sites.length} proposed ${sites.length === 1 ? 'site' : 'sites'}`}>{unsure}</Unsure>}
      </p>
      {aka.length > 0 && <p class="x-real-map-aka">Also called {and(aka)}.</p>}
      {!inVerse && chapterVerse !== undefined && (
        <p class="x-real-map-also">
          Named in this chapter in <Ref a={a} v={chapterVerse} navigate={navigate} />.
        </p>
      )}
      {others.length > 0 && (
        <p class="x-real-map-also">
          {inVerse ? 'Also named in ' : 'Named in '}
          {others.map((v, k) => (
            <span key={v}>
              {k > 0 && (k === others.length - 1 ? ' and ' : ', ')}
              <Ref a={a} v={v} navigate={navigate} />
            </span>
          ))}
          {vs.length > others.length + (inVerse ? 1 : 0) && (
            <>
              {' · '}
              <button type="button" class="x-real-map-more" aria-expanded={all} onClick={() => setAll(!all)}>
                {all ? 'fewer' : `all ${vs.length} verses`}
              </button>
            </>
          )}
        </p>
      )}
      {all && <AllVerses a={a} vs={vs} current={verse} navigate={navigate} />}
      {deep && <Deep a={a} places={places} people={people} place={place} name={name} navigate={navigate} />}
    </section>
  );
}

/** Every verse naming the place, by book: "Ruth 1:1, 1:2, 1:19". */
function AllVerses({ a, vs, current, navigate }: { a: Atlas; vs: readonly VerseRef[]; current: VerseRef; navigate: (v: VerseRef) => void }) {
  const groups: { book: number; items: VerseRef[] }[] = [];
  for (const v of vs) {
    const b = locate(a, v).book;
    const g = groups[groups.length - 1];
    if (g && g.book === b) g.items.push(v);
    else groups.push({ book: b, items: [v] });
  }
  return (
    <div class="x-real-map-allvs">
      {groups.map((g) => (
        <p key={g.book}>
          <span class="x-real-map-book">{chapterName(a.books[g.book])}</span>{' '}
          {g.items.map((v, k) => {
            const l = locate(a, v);
            return (
              <span key={v}>
                {k > 0 && ', '}
                <button
                  type="button"
                  class={`x-real-map-ref${v === current ? ' x-real-map-here' : ''}`}
                  onClick={() => navigate(v)}
                  aria-label={refName(a, v)}
                  aria-current={v === current ? 'true' : undefined}
                >
                  {l.chapter}:{l.verse}
                </button>
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

function Deep({ a, places, people, place, name, navigate }: { a: Atlas; places: PlacesFile; people: PeopleFile | null | undefined; place: number; name: string; navigate: (v: VerseRef) => void }) {
  const [all, setAll] = useState(false);
  const p = info(places, place);
  if (!p) return null;
  const [id, slug, , , sites, special] = p.row;
  const rows: [ComponentChildren, ComponentChildren][] = [];
  const site = (s: (typeof sites)[number]) => (
    <>
      {s[3]}
      <span class="x-real-map-num">
        {' '}
        {inHundred(s[2])} · {coords(s)}
      </span>
    </>
  );
  if (sites.length === 1) rows.push(['Site', site(sites[0])]);
  if (sites.length > 1) {
    rows.push([
      'Proposed sites',
      <ol class="x-real-map-sites">
        {sites.map((s, k) => (
          <li key={k}>{site(s)}</li>
        ))}
      </ol>,
    ]);
  }
  if (special) rows.push(['Another reading', readingLine(special)]);
  rows.push([
    'In the data',
    <a href={`https://www.openbible.info/geo/ancient/${id}/${slug}`} target="_blank" rel="noopener noreferrer">
      OpenBible.info: {name}
    </a>,
  ]);
  const tied = people ? people.places[place] : 0;
  const shown = tied ? (all ? tied : tied.slice(0, PEOPLE_SHOWN)) : [];
  return (
    <>
      <h3>How sure</h3>
      <p class="x-real-map-sure">{sureLine(places, place)}</p>
      <Facts rows={rows} />
      {tied !== 0 && tied.length > 0 && people && (
        <>
          <h3>People tied to this place</h3>
          <ul class="x-real-map-people">
            {shown.map(([who, bits, v]) => (
              <li key={who}>
                <span class="x-real-map-who">{people.names[who]}</span>: {tieWords(bits)}
                {v >= 0 && v < a.n && (
                  <>
                    {' · '}
                    <Ref a={a} v={v} navigate={navigate} />
                  </>
                )}
              </li>
            ))}
          </ul>
          {tied.length > PEOPLE_SHOWN && (
            <button type="button" class="x-real-map-more" aria-expanded={all} onClick={() => setAll(!all)}>
              {all ? 'fewer' : `all ${tied.length} people`}
            </button>
          )}
          <p class="x-real-map-fine">Who was born, died or was at each place, from Theographic Bible Metadata by Robert Rouse (CC BY-SA 4.0). Each verse shown names both the person and the place.</p>
        </>
      )}
    </>
  );
}
