# Data sources and notices

The repository does not contain Bible text or source data. `atlas fetch` downloads it from the original projects at the commits pinned in `sources.json`, and `atlas build` converts it.

## Licenses

| Data | Source | License |
| --- | --- | --- |
| Cross-references and vote counts | OpenBible.info, via the unmodified copy in scrollmapper/bible_databases | CC BY 4.0 |
| Where the New Testament quotes the Old (the BSB's footnotes) | berean.bible, via the USFM edition in usfm-bible/examples.bsb | Public domain |
| Berean Standard Bible (English) | berean.bible, via scrollmapper/bible_databases | Public domain |
| Hebrew and Aramaic Old Testament (TAHOT) | STEPBible.org, based on work at Tyndale House Cambridge | CC BY 4.0 |
| Places named in each verse, their proposed sites and how confident each is; people tied to each place; the coastlines, lakes, rivers, sea names and borders of the Places map | OpenBible.info Bible Geocoding Data, via openbibleinfo/Bible-Geocoding-Data; Theographic Bible Metadata by Robert Rouse, via robertrouse/theographic-bible-metadata; Natural Earth, via nvkelso/natural-earth-vector | CC BY 4.0; CC BY-SA 4.0 (extras/real-map/people.json is shared under the same license); public domain |
| Greek New Testament (TAGNT) | STEPBible.org, based on work at Tyndale House Cambridge | CC BY 4.0 |
| Syriac New Testament (the Peshitta, a translation made from the Greek around AD 350–450, with five books and John 7:53–8:11 from later Syriac versions; shown at Deep, with verse numbers placed on the BSB's as noted in sources.json) | Digital Syriac Corpus: TEI XML edition by James E. Walters, Syriac text transcribed by George A. Kiraz from The New Testament in Syriac (British and Foreign Bible Society, 1905), via srophe/syriac-corpus | CC BY 4.0 (TEI XML edition); base text public domain |
| Section headings and the parallel passages they name (Berean Standard Bible) | berean.bible, via usfm-bible/examples.bsb | Public domain |
| Hebrew and Greek lexicons (TBESH, TBESG) | STEPBible.org, based on work at Tyndale House Cambridge | CC BY 4.0 |
| Word alignments to the BSB, with the WLC (Macula) and Berean Greek NT texts they are keyed to | Clear Bible / Biblica, github.com/Clear-Bible/Alignments | CC BY 4.0 (alignments); WLC and BSB public domain |
| English Standard Version (optional) | Crossway, through the ESV API | Copyright Crossway; free non-commercial use under the API terms |

Attribution: "Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0)", "Cross references from OpenBible.info (CC BY 4.0)" and "Word alignments from Clear Bible / Biblica, github.com/Clear-Bible/Alignments (CC BY 4.0)".

The alignments are used to link words, not shown as text: each aligned Hebrew or Greek word is matched to the TAHOT or TAGNT word in the same verse (by consonants or Strong's number), each English word to the same word of the BSB verse, and links that do not match on both ends are left out.

## Changes made to the STEPBible data

STEPBible asks that changes to its data be noted. The build changes the presentation only, never the words or the tags:

- Verses are renumbered onto the BSB versification. Hebrew words follow the English (NRSV) reference given in TAHOT; Greek words use the KJV reference given in brackets where TAGNT supplies one, because the BSB follows KJV numbering at those points (for example 2 Corinthians 13:12 to 14 and 3 John 1:14 to 15).
- Psalm titles (verse 0 in TAHOT) are attached to verse 1, as English Bibles print them.
- Morpheme separators (`/` and `\`) are removed from the displayed Hebrew and transliteration.
- Lexicon definitions are converted from HTML to plain text segments (bold, italic, line breaks and verse links are kept).
- Words found only in non-base editions are kept and flagged, and are excluded from word counts.
- Abbott-Smith's notes on Septuagint usage in TBESG are read into a table of Greek and Hebrew root pairs (lxx.json, root numbers only); Hebrew words in those notes are matched to TBESH entries by their letters, and unclear matches are left out.

## ESV

The ESV text is never stored in this repository or in the build. The server-side proxy (`server/esv.mjs`) requests one chapter at a time, keeps at most 500 verses in memory, and the page shows Crossway's copyright notice with a link to esv.org, as the ESV API terms require. Use beyond the free terms needs a license from Crossway: https://www.crossway.org/permissions/digital/

## Tyndale Open Bible Dictionary (eras and dates)

| Data | Source | License |
| --- | --- | --- |
| Eras, event dates and book dates (eras.json) | Tyndale Open Bible Dictionary, Tyndale House Publishers, via the unmodified tyndale-source-files/ in mvh-solutions/aquiferized-tbd-english | CC BY-SA 4.0 |

Attribution: "Adapted from Tyndale Open Bible Dictionary. The original work by Tyndale House Publishers is available for free at http://www.tyndaleopenresources.com." Copyright (C) 2023 by Tyndale House Publishers.

Changes: short quotations are taken word for word from the dictionary's articles; date labels are cut from those quotations; years are read from the labels and from the charts "Significant Old Testament Events and Dates" and "Significant New Testament Events and Dates"; the chart's reference for Abraham's birth is corrected from Gn 26:5 to Gen 21:5; chapters are assigned to the dictionary's eras by hand in config/eras.json, each assignment backed by a quotation or by a row of the chart "Books of Postexilic Times". eras.json is a derivative of the dictionary and is shared under CC BY-SA 4.0; the rest of this project keeps its own license.
