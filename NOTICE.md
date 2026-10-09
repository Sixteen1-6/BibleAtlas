# Data sources and notices

The repository does not contain Bible text or source data. `atlas fetch` downloads it from the original projects at the commits pinned in `sources.json`, and `atlas build` converts it.

## Licenses

| Data | Source | License |
| --- | --- | --- |
| Cross-references and vote counts | OpenBible.info, via the unmodified copy in scrollmapper/bible_databases | CC BY 4.0 |
| Berean Standard Bible (English) | berean.bible, via scrollmapper/bible_databases | Public domain |
| Hebrew and Aramaic Old Testament (TAHOT) | STEPBible.org, based on work at Tyndale House Cambridge | CC BY 4.0 |
| Greek New Testament (TAGNT) | STEPBible.org, based on work at Tyndale House Cambridge | CC BY 4.0 |
| Hebrew and Greek lexicons (TBESH, TBESG) | STEPBible.org, based on work at Tyndale House Cambridge | CC BY 4.0 |
| English Standard Version (optional) | Crossway, through the ESV API | Copyright Crossway; free non-commercial use under the API terms |

Attribution: "Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0)" and "Cross references from OpenBible.info (CC BY 4.0)".

## Changes made to the STEPBible data

STEPBible asks that changes to its data be noted. The build changes the presentation only, never the words or the tags:

- Verses are renumbered onto the BSB versification. Hebrew words follow the English (NRSV) reference given in TAHOT; Greek words use the KJV reference given in brackets where TAGNT supplies one, because the BSB follows KJV numbering at those points (for example 2 Corinthians 13:12 to 14 and 3 John 1:14 to 15).
- Psalm titles (verse 0 in TAHOT) are attached to verse 1, as English Bibles print them.
- Morpheme separators (`/` and `\`) are removed from the displayed Hebrew and transliteration.
- Lexicon definitions are converted from HTML to plain text segments (bold, italic, line breaks and verse links are kept).
- Words found only in non-base editions are kept and flagged, and are excluded from word counts.

## ESV

The ESV text is never stored in this repository or in the build. The server-side proxy (`server/esv.mjs`) requests one chapter at a time, keeps at most 500 verses in memory, and the page shows Crossway's copyright notice with a link to esv.org, as the ESV API terms require. Use beyond the free terms needs a license from Crossway: https://www.crossway.org/permissions/digital/

## Tyndale Open Bible Dictionary (eras and dates)

| Data | Source | License |
| --- | --- | --- |
| Eras, event dates and book dates (eras.json) | Tyndale Open Bible Dictionary, Tyndale House Publishers, via the unmodified tyndale-source-files/ in mvh-solutions/aquiferized-tbd-english | CC BY-SA 4.0 |

Attribution: "Adapted from Tyndale Open Bible Dictionary. The original work by Tyndale House Publishers is available for free at http://www.tyndaleopenresources.com." Copyright (C) 2023 by Tyndale House Publishers.

Changes: short quotations are taken word for word from the dictionary's articles; date labels are cut from those quotations; years are read from the labels and from the charts "Significant Old Testament Events and Dates" and "Significant New Testament Events and Dates"; the chart's reference for Abraham's birth is corrected from Gn 26:5 to Gen 21:5; chapters are assigned to the dictionary's eras by hand in config/eras.json, each assignment backed by a quotation or by a row of the chart "Books of Postexilic Times"; where the dictionary dates parts of a book separately, each dating view is tied by hand to the chapters it is about. config/eras.json, which holds the quotations, and the eras.json built from it are adaptations of the dictionary and are shared under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Unlike the other sources, these quotations are stored in this repository. The rest of this project keeps its own license.
