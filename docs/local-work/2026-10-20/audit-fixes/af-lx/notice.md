# AF-LX: NOTICE.md lines (held for PR H)

Two rows of the sources table in `NOTICE.md` (lines 22 and 23 at `2aabdcc`), each replaced whole. The facts are in `docs/evidence/af-lx-2026-10-21.json` on branch `af-lx`.

## Line 22, replaced

| Hebrew and Greek lexicons (TBESH, TBESG): each word's definition in the word study, credited under it to its writer | STEPBible.org, based on work at Tyndale House Cambridge. Greek: George Abbott-Smith, A Manual Greek Lexicon of the New Testament (1922), typed by the translatable-exegetical-tools project, with a few entries from Liddell and Scott, An Intermediate Greek-English Lexicon (1889), from the Perseus Digital Library. Hebrew: Brown, Driver and Briggs, A Hebrew and English Lexicon of the Old Testament (1906), as abridged by Larry Pierce for the Online Bible, with STEPBible's own notes on people and places | CC BY 4.0 (STEPBible); Abbott-Smith's text public domain |

## Line 23, replaced

| Each word's entry in Strong's dictionaries, shown first in the word study (lex/*.json, field "k", shared under the same license), and which Hebrew and Greek words come from which (each word's family in the word study, and the check behind the reviewed related words the Themes tab names for a verse, config/theme-related.json; only root numbers are kept, in web/public/data/forms/ and the `related` lists of themes.json, shared under the same license) | James Strong's Hebrew and Greek dictionaries (copyright 1890; first printed 1894), in the JSON edition by Open Scriptures, github.com/openscriptures/strongs. The edition's braced definitions, which its editors supplied where Strong gave none, and its notes on corrected spellings are left out | Public domain (dictionaries); CC BY-SA (JSON edition) |

## Optional, after line 48 (the word families paragraph)

- A link this app makes where Strong's number is a slip (the hand list in crates/atlas-cli/src/family.rs) is marked in the word study as this app's, and the Aramaic twins STEPBible pairs where Strong's does not tie the numbers are marked as STEPBible's pairing.

## Note for AF-INT

The phrase "Related words: from a reviewed list" and the word "reviewed" in line 23 come from the themes work (decision 19 and the sourced-themes run); this fragment keeps line 23's existing words for the themes part unchanged and leaves that wording to the themes work.
