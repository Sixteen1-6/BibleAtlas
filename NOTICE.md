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

## Greek usage outside the Bible (LSJ) and things of the biblical world (UBS handbooks)

| Data | Source | License |
| --- | --- | --- |
| Greek senses, writers and centuries (world/*.json) | Liddell-Scott-Jones, Perseus Digital Library (Tufts University), formatted and dated by STEPBible TFLSJ (Tyndale House) | CC BY-SA 4.0 (LSJ text); CC BY 4.0 (STEPBible formatting and dates) |
| Articles on animals, plants and human-made things (world/ubs*.json) | United Bible Societies Fauna, Flora and Realia handbooks, via ubsicap/ubs-open-license | CC BY-SA 4.0 |

Attribution: "Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0)"; "Full LSJ - Liddell-Scott-Jones - from Perseus, with additional features and corrections by Tyndale House", with dates added to authors by Tyndale House. "Animals in the Bible © United Bible Societies, 2025. Adapted from: All Creatures Great and Small: Living Things in the Bible, by Edward R. Hope © 2005 United Bible Societies." "Plants and Trees in the Bible © United Bible Societies, 2025. Adapted from: Each According to its Kind: Plants and Trees in the Bible, by Robert Koops © 2012 United Bible Societies." "Human-made Things in the Bible © United Bible Societies, 2025. Adapted from: The Works of Their Hands: Man-made Things in the Bible, by Ray Pritz © 2009 United Bible Societies."

Changes: from TFLSJ, only up to five short glosses per root are kept, with the century and writer of the earliest citation for each and whether papyri or inscriptions are cited; TFLSJ's "4th-5th c. BC", which it gives writers of the 6th and 5th centuries BC (Aeschylus, Simonides, Parmenides), is given as the 5th century BC; Latin writer names are given in English, without the words TFLSJ adds for what they wrote ("Plinius Rerum Naturalium Scriptor" is Pliny), and LSJ's "Poll.", which TFLSJ reads as the epigrammatist Pollianus, is given as Pollux. A gloss that LSJ splits across its markup or gives as alternatives ("send off or away from") is read as one; words set in bold inside translated examples, contrasts ("opposed to man"), readings LSJ rejects ("not (as Aristarchus) lower air"), spellings, citations, cognates from the etymology, and LSJ's Latin labels and equivalents ("sum", "pontifex") are not taken as glosses; a dozen plain misprints are corrected ("fauour" to "favour"); articles, conjunctions, particles, prepositions and pronouns, whose entries are about constructions, are marked so that the app does not show their glosses, as are words for which TFLSJ gives a related word's entry (πρεσβύτερος gets πρεσβυτέριον's); and nothing is kept for seven names whose LSJ entry is about something else (Gaius, Kish, Lydia, Pontius, Saul in both spellings, Simon and Tarsus). From the UBS handbooks, only the description, usage, discussion, symbolism and "other" sections are kept, inline markup is reduced to bold, italic and verse links, cross-references name the section they point to without its number, images are not used, and each article is linked to Hebrew and Greek roots through its own verse references. These derived files are shared under CC BY-SA 4.0.

## ESV

The ESV text is never stored in this repository or in the build. The server-side proxy (`server/esv.mjs`) requests one chapter at a time, keeps at most 500 verses in memory, and the page shows Crossway's copyright notice with a link to esv.org, as the ESV API terms require. Use beyond the free terms needs a license from Crossway: https://www.crossway.org/permissions/digital/
