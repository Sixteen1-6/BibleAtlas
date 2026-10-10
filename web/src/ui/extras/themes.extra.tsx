// Themes, under a verse: the themes its own Hebrew or Greek words carry,
//   "Themes: Lamb · Sacrifice and offering"                 (Genesis 22:8)
// or, with none, the first theme its strongest links lead to,
//   "Linked to Sabbath rest, through Hebrews 4:4"           (Genesis 2:2)
// and nothing at all where no theme runs through the verse or its links.
//
// The panel is the verse's themes card from the Themes tab, and a way to
// follow a theme through the Bible there, with the verse kept. There is no
// extras file or Rust module: the data is themes.json, already loaded with
// the atlas, and the rules are in data/themes.ts (the same rule as
// crates/atlas-cli/src/themes.rs, whose cases atlas verify pins).

import './themes.css';
import { useEffect } from 'preact/hooks';
import type { Atlas } from '../../data/atlas';
import { themeIndex, themesThroughLinks, verseThemes } from '../../data/themes';
import * as S from '../../state';
import { openThemeFromVerse, themeLevel } from '../ThemeThread';
import { VerseThemeCard, ownLineText, themeLine } from '../VerseThemes';
import { readerHere } from './first-move';
import { Lead, SourceNote } from './kit';
import { closeExtra } from './open';
import { type NoteLine, type PanelProps, defineExtra } from './types';

/** Nothing beyond the atlas: load() only builds the verse-to-themes index. */
interface Data {
  a: Atlas;
}

function Panel({ a, verse, navigate }: PanelProps<Data>) {
  // A Hebrew or Greek word on the card (at Study) opens its word study in the
  // study column, under the panel, so the panel then gives way.
  useEffect(() => {
    const before = S.study.peek();
    return S.study.subscribe((now) => now !== before && closeExtra('quiet'));
  }, []);
  const level = themeLevel();
  const first = verseThemes(a, verse, level)[0]?.theme ?? themesThroughLinks(a, verse, level)[0]?.theme;
  // The theme opens in the Themes tab, lit on the map, with the verse kept.
  const follow = (id: string) => {
    closeExtra('quiet');
    S.tab.value = 'themes';
    S.mobilePane.value = 'study';
    openThemeFromVerse(a, id, verse);
  };
  return (
    <>
      <Lead>Each theme follows specific Hebrew and Greek words through the Bible, so every verse it lights can be checked.</Lead>
      <VerseThemeCard a={a} v={verse} onTheme={follow} go={navigate} title={false} />
      {first !== undefined && (
        <button type="button" class="x-themes-follow" onClick={() => follow(a.themes[first].id)}>
          Follow {a.themes[first].name} through the Bible <span aria-hidden="true">›</span>
        </button>
      )}
      <SourceNote>Themes from config/themes.json, traced through STEPBible’s tagged Hebrew and Greek (CC BY 4.0); links from OpenBible.info (CC BY 4.0).</SourceNote>
    </>
  );
}

export default defineExtra<Data>({
  id: 'themes',
  order: 25,
  title: 'Themes',
  async load(a) {
    await readerHere('themes');
    themeIndex(a);
    return { a };
  },
  note(verse, { a }): NoteLine | null {
    const d = themeLine(a, verse, themeLevel());
    if (!d) return null;
    if (d.kind === 'own') return ownLineText(d);
    return [`Linked to ${d.theme}, through `, { verse: d.via }];
  },
  Panel,
});
