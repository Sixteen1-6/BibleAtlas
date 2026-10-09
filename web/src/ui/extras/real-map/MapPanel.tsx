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

import '../real-map.css';
import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { type Atlas, chapterName, chapterRange, locate } from '../../../data/atlas';
import { useJson } from '../data';
import { Facts, Lead, SourceNote, Unsure, refName } from '../kit';
import { levelAtLeast } from '../level';
import type { PanelProps, VerseRef } from '../types';
import { MapCanvas } from './MapCanvas';
import type { BaseFile, Data, EventsFile, Mention, PeopleFile, PlacesFile, ShapesFile, Site } from './model';
import { coords, inHundred, info, latOf, lonOf, proposals, readingLine, spread, sureLine, tieWords } from './places';
import { type Marker, type Shade, projX, projY, shadePath } from './view';

/** People shown before "all N people". */
const PEOPLE_SHOWN = 8;
/** Events shown before "all N events". */
const EVENTS_SHOWN = 4;

/** An astronomical year in words: -1490 is "1491 BC", 30 is "AD 30". */
function yearWords(y: number): string {
  return y <= 0 ? `${1 - y} BC` : `AD ${y}`;
}

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
/** Names that are a common noun first or last take "the" in a sentence: the
 * Valley of Elah, the City of David, the Holy Place, the Sheep Gate. */
const THE_FIRST = /^(City|Valley|Vale|Sea|Mount of|Mountains?|Hills?|Hill of|Land|Pool|Tower|Wilderness|Desert|Plains?|Field|Brook|Gate|House|Rock|Spring|Waters?|Fountain|Cave|Tomb|Garden|Island|Gulf|Ascent|Pass|Way|Road|Court|Lake|Holy|Most Holy)\b/;
const THE_LAST = /\b(Place|Gate|Valley|Pool|Tower|Wall|Sea|River|Brook|Road|Spring|Well|Hall|Porch|Portico|Court|Square|Highway|Ascent|Field|Canal|Mountains|Hills|Wilderness|Desert|Plains?|Lake|Gulf)$/;

/** A name as it reads in a sentence: "the Red Sea", "the Valley of Elah", "Bethlehem". */
function inSentence(name: string, kind: string): string {
  // "Jacob’s Well" and "Beyond the River" take no article.
  if (/^(the|beyond) /i.test(name) || /['’]s\b/.test(name)) return name;
  if (THE_FIRST.test(name) || THE_LAST.test(name) || /^(Negev|Arabah|Shephelah|Decapolis)$/.test(name)) return `the ${name}`;
  // Waters do ("the Jordan"), unless the name is a compound ("Me-jarkon").
  return WATERS.has(kind) && !name.includes('-') ? `the ${name}` : name;
}

interface Named {
  name: string;
  kind: string;
}

/** "where Migdol was is uncertain"; for waters, "which waters the Red Sea means
 * here is uncertain"; for both, "where Rehoboth was is uncertain, and so is
 * which waters the Euphrates means here". */
function unsureWords(items: readonly Named[], many: string): string {
  if (items.length > 3) return `where ${many} were is uncertain`;
  const lands = items.filter((x) => !WATERS.has(x.kind)).map((x) => inSentence(x.name, x.kind));
  const waters = items.filter((x) => WATERS.has(x.kind)).map((x) => inSentence(x.name, x.kind));
  const where = lands.length ? `where ${and(lands)} ${lands.length === 1 ? 'was' : 'were'}` : '';
  const which = waters.length ? `which waters ${and(waters)} ${waters.length === 1 ? 'means' : 'mean'} here` : '';
  if (where && which) return `${where} is uncertain, and so is ${which}`;
  return `${where || which} is uncertain`;
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const letters = (t: string) => t.toLowerCase().replace(/[^\p{L}]/gu, '');

/** One to three plain sentences on what the map shows for this verse. */
function lead(places: PlacesFile, here: readonly Mention[]): string {
  const shown: string[] = [];
  const unsure: Named[] = [];
  const unmarked: string[] = [];
  let marked = 0;
  const seen = new Set<string>();
  for (const m of here) {
    if (seen.has(m.name)) continue;
    seen.add(m.name);
    const p = info(places, m.place);
    const kind = p?.kind ?? 'place';
    if (p?.confident) {
      marked++;
      shown.push(inSentence(m.name, kind));
    } else if (p && proposals(places, p).length) {
      unsure.push({ name: m.name, kind });
      shown.push(inSentence(m.name, kind));
    } else unmarked.push(inSentence(m.name, kind));
  }
  const notMarked = !unmarked.length
    ? ''
    : unmarked.length > 3
      ? 'Some of the places this verse names are not marked on this map.'
      : `${capital(and(unmarked))} ${unmarked.length === 1 ? 'is' : 'are'} not marked on this map.`;
  if (!shown.length) return notMarked;
  const all = shown.length + unmarked.length;
  const list = shown.length <= 4 ? capital(and(shown)) : unmarked.length ? `${shown.length} of the ${all} places this verse names` : `The ${shown.length} places this verse names`;
  const doubt = unsure.length ? capital(unsureWords(unsure, marked ? 'some of them' : 'these places')) : '';
  if (!marked) {
    const marks = doubt.includes(', and so is ') ? `${doubt}. The map marks only the sites that have been proposed.` : `${doubt}, so the map marks only the sites that have been proposed.`;
    return [marks, notMarked].filter(Boolean).join(' ');
  }
  return [`${list} on a map of the Bible lands.`, doubt && `${doubt}.`, notMarked].filter(Boolean).join(' ');
}

const at = (lon: number, lat: number): [number, number] => [projX(lon), projY(lat)];

export function MapPanel({ a, data, verse, navigate }: PanelProps<Data>) {
  const places = useJson<PlacesFile>(a, 'extras/real-map/places.json');
  const base = useJson<BaseFile>(a, 'extras/real-map/base.json');
  const deep = levelAtLeast('deep');
  const study = levelAtLeast('study');
  const people = useJson<PeopleFile>(a, deep ? 'extras/real-map/people.json' : null);
  const events = useJson<EventsFile>(a, study ? 'extras/real-map/events.json' : null);
  const shapes = useJson<ShapesFile>(a, 'extras/real-map/shapes.json');
  const [tribesOn, setTribesOn] = useState(false);
  const here = useMemo(() => data.byVerse.get(verse) ?? [], [data, verse]);
  const chapter = useMemo(() => chapterPlaces(a, data, verse, here), [a, data, verse, here]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [proposed, setProposed] = useState(false);
  const sel = chosen ?? here[0]?.place ?? null;
  // The tribe whose land this verse lists (Joshua 13-19), if any.
  const tribeHere = useMemo(() => (shapes ? shapes.tribes.findIndex(([, from, to]) => verse >= from && verse <= to) : -1), [shapes, verse]);
  const paths = useMemo(() => {
    if (!shapes) return null;
    const q = shapes.q || 1000;
    return {
      places: new Map<number, ReturnType<typeof shadePath>>(),
      tribes: shapes.tribes.map((t) => shadePath([t[5]], q)),
      q,
    };
  }, [shapes]);
  const shapeOf = (p: number) => {
    if (!shapes || !paths) return null;
    const rings = shapes.places[p];
    if (!rings) return null;
    let hit = paths.places.get(p);
    if (!hit) {
      hit = shadePath(rings, paths.q);
      paths.places.set(p, hit);
    }
    return hit;
  };
  const shades = useMemo(() => {
    const out: Shade[] = [];
    if (!shapes || !paths) return out;
    const seen = new Set<number>();
    for (const m of here) {
      if (seen.has(m.place)) continue;
      seen.add(m.place);
      const sh = shapeOf(m.place);
      if (sh) out.push({ path: sh.path, tier: m.place === sel ? 0 : 1 });
    }
    if (sel !== null && !seen.has(sel)) {
      const sh = shapeOf(sel);
      if (sh) out.push({ path: sh.path, tier: 0 });
    }
    paths.tribes.forEach((t, i) => {
      if (i === tribeHere) out.push({ path: t.path, tier: 1 });
      else if (tribesOn && study) out.push({ path: t.path, tier: 2 });
    });
    return out;
  }, [shapes, paths, here, sel, tribeHere, tribesOn, study]);

  const markers = useMemo(() => {
    const out: Marker[] = [];
    if (!places) return out;
    const add = (place: number, label: string, tier: 0 | 1 | 2, showProposed: boolean) => {
      const p = info(places, place);
      if (!p) return;
      if (p.confident && p.best) {
        // A place the data puts by another ("within 8 km of Jerusalem") is
        // marked with an open ring at that place's point. One that is here
        // another name for a place says so: "Babylon (Rome)".
        const other = /^(?:here )?another name for (?:the )?([^,]+)/.exec(p.line)?.[1];
        const text = other && !letters(label).includes(letters(other)) ? `${label} (${other})` : label;
        out.push({ place, label: text, x: projX(lonOf(p.best)), y: projY(latOf(p.best)), tier, area: p.area, proposed: p.rough && !p.area });
        return;
      }
      if (!showProposed) return;
      proposals(places, p).forEach((s, k) => {
        const text = k === 0 ? `${label}?` : tier === 0 && deep ? s[3] : '';
        out.push({ place, label: text, x: projX(lonOf(s)), y: projY(latOf(s)), tier, area: false, proposed: true });
      });
    };
    for (const [p, c] of chapter) add(p, c.name, p === sel ? 0 : 2, p === sel);
    for (const m of here) add(m.place, m.name, m.place === sel ? 0 : 1, proposed || m.place === sel);
    // The tribes' names, on their lands. A tribe name is not a place of
    // the panel, so its marker has no place (-1 and below).
    if (shapes) {
      shapes.tribes.forEach(([name, , , lon, lat], i) => {
        if (i === tribeHere || (tribesOn && study)) out.push({ place: -1 - i, label: name, x: projX(lon), y: projY(lat), tier: i === tribeHere ? 1 : 2, area: true, proposed: false });
      });
    }
        // Jerusalem, faintly, so there is always somewhere to get one's bearings
    // (the place lines say how far each place is from it).
    const jerusalem = places.places.findIndex((r) => r[1] === 'jerusalem');
    if (jerusalem >= 0 && !out.some((m) => m.place === jerusalem)) add(jerusalem, data.names[jerusalem] ?? 'Jerusalem', jerusalem === sel ? 0 : 2, false);
    return out;
  }, [places, here, chapter, sel, proposed, deep, data, shapes, tribeHere, tribesOn, study]);

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
      for (const m of here) {
        const p = info(places, m.place);
        for (const s of p ? proposals(places, p).slice(0, 3) : []) pts.push(at(lonOf(s), latOf(s)));
      }
    }
    return pts;
  }, [places, here]);

  const revealPoints = useMemo(() => {
    const p = sel === null || !places ? null : info(places, sel);
    if (!p) return [];
    const sh = sel === null ? null : shapeOf(sel);
    const box: [number, number][] = sh && Number.isFinite(sh.box[0]) ? [[sh.box[0], sh.box[1]], [sh.box[2], sh.box[3]]] : [];
    if (p.confident && p.best) return [at(lonOf(p.best), latOf(p.best)), ...box];
    return [...proposals(places!, p).map((s) => at(lonOf(s), latOf(s))), ...box];
  }, [places, sel, shapes, paths]);

  if (!places || !base) return <p class="xt-lead xt-wait">…</p>;

  // The chosen place shows its proposed sites anyway; the switch is for the others.
  const anyUnsure = here.some((m) => {
    const p = m.place === sel ? null : info(places, m.place);
    return !!p && proposals(places, p).length > 0;
  });
  const nameOf = (p: number) => here.find((m) => m.place === p)?.name ?? chapter.get(p)?.name ?? data.names[p];
  const mapLabel = `Map of ${and([...new Set(here.map((m) => m.name))].slice(0, 6))}${chapter.size ? ', with the chapter’s other places' : ''}`;

  return (
    <>
      <Lead>{lead(places, here)}</Lead>
      <MapCanvas
        base={base}
        markers={markers}
        shades={shades}
        fitKey={String(verse)}
        fitPoints={fitPoints}
        revealKey={String(sel)}
        revealPoints={revealPoints}
        onTap={(p) => p >= 0 && setChosen(p)}
        label={mapLabel}
      />
      <div class="x-real-map-under">
        <ul class="x-real-map-chips" aria-label="Places in this verse">
          {here.map((m) => {
            const p = info(places, m.place);
            const label = p?.label;
            const open = !p?.confident || p.rough;
            const on = m.place === sel;
            return (
              <li key={m.place}>
                <button type="button" class={`x-real-map-chip${on ? ' x-real-map-on' : ''}`} aria-pressed={on} onClick={() => setChosen(m.place)}>
                  <span class={`x-real-map-mark${open ? ' x-real-map-open' : ''}`} aria-hidden="true" />
                  {m.name}
                  {label && label !== 'likely site' && <span class="x-real-map-vh">, {label}</span>}
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
        {study && shapes && (
          <button type="button" class="x-real-map-toggle" aria-pressed={tribesOn} onClick={() => setTribesOn(!tribesOn)}>
            {tribesOn ? 'Hide the tribes’ lands' : 'Show the tribes’ lands'}
          </button>
        )}
      </div>
      {shapes && (tribeHere >= 0 || (tribesOn && study)) && (
        <p class="x-real-map-fine">
          {tribeHere >= 0 && !(tribesOn && study) ? `${shapes.tribes[tribeHere][0]}’s land is` : 'The tribes’ lands are'} drawn around the towns Joshua 13–19 lists for each tribe, so
          the edges are only approximate.
        </p>
      )}
      {sel !== null && (
        <PlaceCard
          key={sel}
          a={a}
          data={data}
          places={places}
          people={deep ? people : undefined}
          events={study ? events : undefined}
          place={sel}
          name={nameOf(sel)}
          verse={verse}
          chapterVerse={chapter.get(sel)?.verse}
          navigate={navigate}
          deep={deep}
        />
      )}
      <SourceNote>
        Places, their proposed sites and the approximate shapes of regions from OpenBible.info’s Bible Geocoding Data, CC BY 4.0. The map is drawn from Natural Earth (public domain); its coastlines, rivers and borders are today’s.
        {study && (deep ? ' Events, people and dates from Theographic Bible Metadata, CC BY-SA 4.0.' : ' Events from Theographic Bible Metadata, CC BY-SA 4.0.')}
      </SourceNote>
    </>
  );
}

interface CardProps {
  a: Atlas;
  data: Data;
  places: PlacesFile;
  people: PeopleFile | null | undefined;
  events: EventsFile | null | undefined;
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
    <button type="button" class={`x-real-map-ref${current ? ' x-real-map-here' : ''}`} data-lv={v} onClick={() => navigate(v)} aria-current={current ? 'true' : undefined}>
      {refName(a, v)}
    </button>
  );
}

function PlaceCard({ a, data, places, people, events, place, name, verse, chapterVerse, navigate, deep }: CardProps) {
  const [all, setAll] = useState(false);
  const vs = data.versesOf[place] ?? [];
  const inVerse = vs.includes(verse);
  const p = info(places, place);
  const rings = p ? proposals(places, p).length : 0;
  const aka = [...new Set([data.names[place], ...(data.aka.get(place) ?? [])])].filter((n) => n !== name);
  const others = spread(vs, 3, verse);
  return (
    <section class="x-real-map-card" aria-label={name}>
      {p && (
        <p class="x-real-map-where">
          <strong>{name}</strong>: {p.line}.{p.label && <Unsure title={rings ? `${rings} proposed ${rings === 1 ? 'site' : 'sites'} on the map` : undefined}>{p.label}</Unsure>}
        </p>
      )}
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
      {events && <Events a={a} events={events} place={place} verse={verse} navigate={navigate} deep={deep} />}
      {deep && <Deep a={a} places={places} people={people} place={place} name={name} navigate={navigate} />}
    </section>
  );
}

/** Study: what happened at the place, in time order, each with the verse it
 * starts at. Deep adds Theographic's year for each, and says whose dates
 * they are. */
function Events({ a, events, place, verse, navigate, deep }: { a: Atlas; events: EventsFile; place: number; verse: VerseRef; navigate: (v: VerseRef) => void; deep: boolean }) {
  const [all, setAll] = useState(false);
  const here = events.places[place];
  if (!here || !here.length) return null;
  const shown = all ? here : here.slice(0, EVENTS_SHOWN);
  return (
    <>
      <h3>What happened here</h3>
      <ul class="x-real-map-events">
        {shown.map((i) => {
          const [title, year, v] = events.events[i];
          return (
            <li key={i}>
              {title}
              {deep && <span class="x-real-map-num"> {yearWords(year)}</span>}
              {v >= 0 && v < a.n && (
                <>
                  {' · '}
                  <Ref a={a} v={v} navigate={navigate} current={v === verse} />
                </>
              )}
            </li>
          );
        })}
      </ul>
      {here.length > EVENTS_SHOWN && (
        <button type="button" class="x-real-map-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? 'fewer' : `all ${here.length} events`}
        </button>
      )}
      {deep && (
        <p class="x-real-map-fine">
          Events and their years from Theographic Bible Metadata by Robert Rouse (CC BY-SA 4.0). Its years follow one traditional reckoning from the Bible’s own numbers, close to
          Archbishop Ussher’s (Creation in 4004 BC, the Exodus in 1491 BC); many scholars date the earlier events differently, some by centuries.
        </p>
      )}
    </>
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
                  data-lv={v}
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
  const [id, slug, , , sites, special, , note] = p.row;
  const rows: [ComponentChildren, ComponentChildren][] = [];
  const site = (s: Site) => (
    <>
      {s[3]}
      <span class="x-real-map-num">
        {' '}
        {inHundred(s[2])} · {coords(s)}
      </span>
    </>
  );
  if (p.off) {
    rows.push([
      p.off[1] >= places.confident ? 'Most likely site' : 'Strongest proposal',
      <>
        {p.off[0]}
        <span class="x-real-map-num">
          {' '}
          {inHundred(p.off[1])} · not on this map
        </span>
      </>,
    ]);
  }
  if (sites.length === 1) rows.push([p.off ? 'Other proposed site' : p.rough ? 'Marked at' : p.confident ? 'Site' : 'Proposed site', site(sites[0])]);
  if (sites.length > 1) {
    rows.push([
      p.off ? 'Other proposed sites' : 'Proposed sites',
      <ol class="x-real-map-sites">
        {sites.map((s, k) => (
          <li key={k}>{site(s)}</li>
        ))}
      </ol>,
    ]);
  }
  if (note) rows.push(['Note in the data', note]);
  // A reading the data is sure of is already the line above.
  if (special && !(special[2] && special[1] >= 995)) rows.push(['Another reading', readingLine(special)]);
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
          <p class="x-real-map-fine">
            Who was born, died or was at each place, from Theographic Bible Metadata by Robert Rouse (CC BY-SA 4.0). Each verse shown names both the person and the place.
            {shown.some(([, , v]) => !(v >= 0 && v < a.n)) && ' Where no verse is shown, the tie is Theographic’s own.'}
          </p>
        </>
      )}
    </>
  );
}
