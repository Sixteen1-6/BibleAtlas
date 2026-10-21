# Group 4: notes and topical works

Checked 2026-10-20. Files fetched for this group are under `ba/voices/dl/` (left from the earlier cut-off run: SWORD zips, the Let's Church Geneva file, the TCP 1561 Geneva, the 1917 Scofield OCR, the UniqueBible Companion Bible database) and `ba/voices/g4/` (this run). Scripts are in `ba/voices/g4/*.py` and `ba/voices/g4/lib/`. Nothing downloaded was larger than 50 MB.

How Bible Atlas sources things today: every input is a pinned git commit on github.com with a SHA-256 in the manifest; a non-GitHub source is mirrored to its own branch by a workflow like `mirror-meaning-model.yml` (branch `claude/ask-the-bible-u6macl`). Henry and Wesley come from `LetsChurch/lets.church` at `71f6f0fc`, which is CC0 and takes them from CrossWire modules whose .conf says Public Domain.

## Summary

| Work | PD in US | Fits the rule | Best open source | Recommend |
|---|---|---|---|---|
| Bullinger, Companion Bible notes and appendixes (1909-22) | yes | on the cite list, with doctrinal flags | none found that is both licensed and clean | no |
| Geneva Bible notes (1560, NT 1576 Tomson, Rev 1599 Junius) | yes | on the cite list | Let's Church `geneva.json` (CC0 repo) from CrossWire `Geneva` | yes, with caveats |
| Scofield Reference Bible notes, 1917 | yes | not on either list; fits, one note needs a decision | CrossWire `Scofield` 2.1 (Public Domain), needs a mirror | yes, founder decides on Gen 9 |
| Treasury of Scripture Knowledge (c. 1830s) | yes | yes (references, not a voice) | `CrossReferences-org/bible-cross-references` (CC BY 4.0), BSB phrase anchors | yes, as phrase grouping for cross refs |
| Spurgeon sermons by text (1855-1917) | yes | on the cite list | no open faithful transcription | no for text; an index that links out is possible |
| Torrey, New Topical Textbook (1897) | yes | yes | CrossWire `Torrey` (Public Domain), needs a mirror | yes, as a topical index like Nave's |
| McGarvey and Pendleton, The Fourfold Gospel (1914) with McGarvey on Acts | yes | yes, strongly anti higher criticism | CrossWire `TFG` (Public Domain), needs a mirror | yes, second tier |
| B. W. Johnson, The People's New Testament (1889-91) | yes | yes | CrossWire `PNT` (Public Domain), needs a mirror | yes, second tier |

## E. W. Bullinger, The Companion Bible notes and 198 appendixes

- Dates: published in six parts 1909 to 1922 (Oxford University Press). Bullinger died 6 June 1913; Wikipedia says the work "was completed after his death by his associates" (not named). Public domain in the US.
- Rule: already on the cite list as `bullinger-cb`. He held every word inspired. The founder should know the notes carry his own distinctive teaching word for word: ultradispensationalism (the Church begins after Acts 28; H. A. Ironside called it a Satanic perversion), soul sleep (Luke 23:43 repunctuated: "Connect this with 'I say' ... not with 'shalt thou be'"), the gap theory at Gen 1:2 ("Not created tohu ... but became tohu"), the Gospel in the stars (App. 12), a Wednesday crucifixion and four men crucified with Christ (appendixes). Wikipedia also records he chaired a 1905 meeting of the Universal Zetetic (flat earth) Society. The parts finished after 1913 were by unnamed associates.
- Sources found:
  - `otseng/UniqueBible_Commentaries`, file `cCBNotes - The Companion Bible Notes.commentary.zip` (SQLite, 13.2 MB unzipped, 1,236 chapter rows, 66 books). No license anywhere: GitHub reports no license and the README says only "Third party commentaries for UniqueBible". The same repo holds plainly copyrighted works (Bible Knowledge Commentary, Passion Translation, Complete Jewish Bible), so it is not a clean source.
  - StudyLight `bul` (the same text): blocked our requests (403 "Access Denied"); it is a website with its own terms, not a licensed transcription.
  - Levend Water appendixes: footer "Developed by © Levend Water All rights reserved".
  - archive.org `CompanionBibleOT` (OT, NT, appendixes OCR, no license stated): OCR of the page scans interleaves the margin notes with the text column, so it cannot be used without a full rebuild.
- Accuracy (UniqueBible copy vs the archive.org scan): (1) Gen 1:1 notes ("God. Heb. Elohim ...", "Creation in eternity past, to which all Fossils and 'Remains' belong") are missing; the chapter starts at 1:2. (2) Gen 1:2 "carried like. lamp" where the scan reads "carried like a lamp"; "was. became" for "was = became". (3) Gen 1:27 "there was. companion", "claimed. share". The letter "a" and the sign "=" are turned into "." throughout, a systematic OCR fault. Luke 23 also shows "Ecc 2:44 Verses 44-46" (a verse range turned into a wrong reference).
- Size: about 12.2 million characters of HTML.
- Verdict: do not store. No openly licensed transcription exists, and the one copy on GitHub is unlicensed and damaged. A clean edition would mean OCR of a PD scan with hand correction.

## Geneva Bible notes (the 1599 "Tomson-Junius" form)

- Dates: OT notes 1560 (Whittingham and the Geneva exiles), NT notes by Laurence Tomson 1576 (from Beza), Revelation notes by Franciscus Junius, first in the 1599 printing. Public domain.
- Rule: on the cite list as `geneva`. Reformed and wholly believing. Word for word it carries the polemic of its day: "papists" in 19 entries (2 Kings 17:33 "idolaters as do the papists who worship both God and idols"; Isa 44:15 "as the papists make their cake god"), Revelation 13 names "this beast of Rome" and "the Pope" as the false prophet, "Antichrist" in 19 entries. Catholic writers are allowed in the app (the Catena), so this sits oddly beside them.
- Best source: `LetsChurch/lets.church` @ `71f6f0fc8f99dfe7fa4cbc09ea58a1a32ae3f239`, `packages/lets.bible/seed/commentaries/geneva.json`, 5,269,704 bytes, SHA-256 `670f0d9708cbd6c6d157f155798d1da9073c6a7d0ae9230632e9fcc65294d677`. Already pinned in sources.json for Henry and Wesley.
- License words: the repo is CC0 1.0 (its LICENSE file, as for Henry). The file's own header: `"license": "Public Domain"`, `"sourceUrl": "https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Geneva"`. Weak link: CrossWire's `geneva.conf` (Version 1.1, 2001) has no DistributionLicense line, and the ModInfo page shows "Distribution License null". The same modern text was issued in 1999 as a SwordSearcher plugin (`ss-genev.zip` on archive.org) whose readme says "This module may be freely distributed UNMODIFIED." The text is a modern-spelling edition; spelling changes to a 1599 text are unlikely to carry a new copyright, but there is no explicit public domain statement upstream of Let's Church.
- Coverage: 63 books. Judges, Jonah and Philemon are missing in the CrossWire module itself, so in every copy. 14,713 verse entries in the Let's Church file (14,791 in the module), about 18,500 lettered notes, about 2.2 MB of note text. Each entry starts with the KJV verse text carrying {a} markers, which the build must cut off.
- Format: JSON `{work, entries:[{book, chapter, verse, body}]}`, USFM-style book codes, notes as "(a) ..." after the verse text, references as `{{ref:Re 16:13|...}}`.
- Accuracy (against the CC0 EEBO-TCP 1561 text A10675 and the archive.org 1599 OCR `english-1599-geneva-bible`): (1) Genesis Argument: drops the clause "and that man being placed in this great tabernacle of the world to behold God's wonderful works", so the sentence no longer makes sense. (2) Gen 35:4: adds "(a cake of wax, stamped with a lamb bearing a cross or flag, that has been blessed by the Pope)", which is in neither 1561 nor 1599; a modern editor's gloss shown as if Geneva's. (3) Rev 13:11-12: matches 1599 in substance, with "part" for "member", "skeleton or anatomy" for the Greek word, and "feat" where 1599 reads "seate" (long s misread). (4) Gen 1:1 and Ps 2:12 notes match the 1561 wording in modern spelling.
- Alternative: `textcreationpartnership/A10675` on GitHub (1561 edition, CC0: "The text can be copied, modified, distributed and performed, even for commercial purposes, all without asking permission") is in original spelling and has 32,096 illegible-character gaps; 12,647 of its 26,525 margin notes contain a gap. Good for checking, not for showing.
- Verdict: usable on the same footing as Henry, if the founder accepts a modern-spelling edition with a missing upstream license line, three missing books, and some editor's glosses mixed in.

## Scofield Reference Bible notes, 1917 edition

- Dates: first edition 1909, revised 1917 (Oxford University Press, New York; "Copyright, 1909, 1917"). Scofield died 1921. Public domain in the US (published before 1931). Only the 1917 text is in the module (the 1967 New Scofield is copyrighted and not used).
- Rule: not on the cite list or the avoid list. Scofield held the Bible inspired and without error; the notes are dispensational and premillennial and teach the gap theory ("the earth had undergone a cataclysmic change as the result of a divine judgment", Gen 1:2). Founder must decide on Gen 9:1 note (5): "A prophetic declaration is made that from Ham will descend an inferior and servile posterity", which would appear word for word. Also Gen 11:1 ("a man-made unity, the papacy ... Protestantism, with its innumerable sects") and Rev 1:20/2:1 ("Thyatira is the Papacy ... Romanism weds Christian doctrine to pagan ceremonies"). The notes name Meyer (Acts 3:19, Gal 3:25, Col 2:18) and Thayer (Phil 2:6), both on the avoid list.
- Best source: CrossWire `Scofield` version 2.1 (2023-01-18), `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Scofield.zip`, 487,890 bytes, SHA-256 `a3dda2e08db778c6aa5e47805bba236f744cb1c521dd2a94ba6ea02b241cfe77`. Not on GitHub: needs a mirror branch. License words in `scofield.conf`: `DistributionLicense=Public Domain` and `TextSource=https://en.wikisource.org/wiki/Scofield_Reference_Bible_Notes`. Wikisource's page says "This work was published before January 1, 1931, and is in the public domain worldwide", text under "Creative Commons Attribution-ShareAlike License", and "The source document of this text is not known."
- Other copy: `jonnyg23/mahabrain` (MIT, a scrape of sacred-texts.com) has it as Markdown; sacred-texts blocked our requests, so its terms could not be read.
- Coverage: 66 books, 4,221 verse entries (4,216 distinct; a few notes repeat, e.g. Rev 1:20 and 2:1), about 0.78 MB plain text. Book introductions are on verse 1 of each book.
- Format: SWORD zCom, OSIS markup, KJV versification.
- Accuracy (against the 1917 scan, archive.org `scofieldreferenc00unse`, Library of Congress): (1) Gen 1:2: "There are not wanting imitations" where 1917 reads "intimations", and "the result of divine judgment" drops "a". (2) Gen 1:1 note 2 ("But three creative acts of God are recorded in this chapter ... gives scope for all the geologic ages") is missing from the module. (3) Gen 9:1 Noahic Covenant note matches word for word, except the module rewrites "(Gen. 8. 21)" as "(See Scofield "Genesis 8:21")". (4) Rev 1:20 note matches.
- Verdict: worth storing if the founder adds Scofield to the cite list and accepts or leaves out the Gen 9:1 note; expect small transcription slips and at least one missing note.

## Treasury of Scripture Knowledge

- Dates: compiled for Samuel Bagster in the 1830s from Canne, Browne, Blayney, Scott and others; American printings carry R. A. Torrey's introduction. Public domain.
- Rule: a reference work, not an interpreter. Its compilers and Torrey were Bible-believing. Its few prose notes (about 257 CrossWire entries) sometimes report emendations of the Hebrew, e.g. Judges 8:16 "Instead of wyyoda, Houbigant, Le Clerc, and others read wyyadosh ... The Hebrew text might easily have been corrupted"; 13 entries name rabbis (Kimchi and others). Use the references only.
- Best source: `CrossReferences-org/bible-cross-references` @ `d80dee38106c42982bb6c0834ceebb8a517e368a`, `tsv/crossreferences_bsb.tsv`, 5,180,420 bytes, SHA-256 `54f5a7faada7695b8584aa2e46d57bf8fb593fc6ee8762bc2295851fed6b11bf`. License: LICENSE file is CC BY 4.0; README: "The cross-reference data in this repository is licensed under CC BY 4.0." Each TSK reference group is anchored to the BSB words it explains (63,663 anchors on 29,056 verses, 305,906 references), which is exactly the app's reading text. README warns: "The reference set is not a verbatim copy of TSK ... currently well under 1% of the set." Prose notes are not included. The French S21 anchors are copyrighted ("Used with permission"); use only the BSB or KJV files.
- Other source: CrossWire `TSK` 1.4 (Public Domain), 2,643,739 bytes, SHA-256 `6784c7099465995a8e66f02ead82b0bca66603c1bdeaf8332949774b7bfd4293`, 31,154 entries, keeps the prose notes and the "Heb." marginal readings, Hebrew transliterations partly garbled ("{wyyod?,}").
- Compared with OpenBible: of 303,823 verse-to-verse pairs in the CrossReferences BSB file, 298,718 (98.3%) are already in the pinned OpenBible file (344,799 pairs); it adds 5,105 pairs, and OpenBible has 46,081 it lacks. What TSK adds is the grouping by phrase (which words of the verse each group explains), not new links.
- Accuracy (against the Bagster and Revell printing, archive.org `treasuryofscript0000rato`): Gen 1:1 "beginning" and "God" groups match (CrossWire has Exod 31:18 where the print reads 31:17; CrossReferences drops it); Gen 1:2 "Spirit" reads Job 26:13 in print and CrossReferences, Job 26:14 in CrossWire (wrong); Judges 8:16 matches; Job 1:21 four anchors match the TSK groups. Curation is visible (Gen 1:2 "formless" drops Nah 2:10).
- Concerns: the repository is new (created April 2026) and updated in rolling releases, so pin the commit; attribution needed (CC BY).
- Verdict: yes, to group the cross references the app already shows under the words they explain, not as a writer's voice.

## Spurgeon's sermons indexed by text

- Dates: New Park Street Pulpit 1855-60, Metropolitan Tabernacle Pulpit 1861-1917 (63 volumes, 3,563 sermons). Public domain.
- Rule: Spurgeon is on the cite list (`spurgeon`, for the Treasury of David).
- Sources found, none clean:
  - `OpenChristianData/open-christian-data` @ `658f1042...`, `data/sermons/spurgeon-mtp/` (36 files of about 3.6-3.9 MB, 3,547 sermons, about 97% with an OSIS text reference). Repo LICENSE: "Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)"; the file's meta says `"license": "public-domain"`. Provenance in the file: "Emmett O'Donnell transcription from SpurgeonGems PDFs" via thekingdomcollective.com, "No ToS found".
  - Spurgeon Gems: "Copyright 2011-2019 Spurgeongems.org"; its PDFs say "Taken from The Metropolitan Tabernacle Pulpit C. H. Spurgeon Collection. Only necessary changes have been made, such as correcting spelling errors, some punctuation usage, capitalization of deity pronouns, and minimal updating of a few archaic words."
  - Spurgeon Center (spurgeon.org): "© 2026 The Spurgeon Center. All rights reserved."
  - CCEL: "These books may be used for personal, educational, or non-profit purposes. Contact us for permission to republish CCEL works or to use them commercially."
  - Project Gutenberg has no sermon volumes; archive.org has PD scans (e.g. `SpurgeonNewParkPt01`, Public Domain Mark) but not as a clean dataset.
- Accuracy (OpenChristianData text vs the NPSP vol. 1 text on archive.org): sermon 1, 147 of 150 words match, but the text quote reads "you sons of Jacob" for "ye"; sermon 3, "buffer" for "conserve" and "your" for "thy"; sermon 15, 147 of 150. Modernized, so not Spurgeon's words exactly.
- Verdict: do not store the sermons. If wanted, show "Spurgeon preached on this verse" with the number, title and a link to spurgeon.org, the way NET notes link out; the index itself would need to be built from the PD volume indexes, not copied from these sites.

## R. A. Torrey, The New Topical Text Book (1897)

- Dates: Fleming H. Revell, 1897. Torrey (1856-1928) was Moody's successor and an editor of The Fundamentals. Public domain.
- Best source: CrossWire `Torrey` 1.3, `Torrey.zip` 422,465 bytes, SHA-256 `9db6e3f1720f868cc9d68cf030db53d157f9726883f0afd49553d05ab4cb7c80`. Needs a mirror. `torrey.conf`: `DistributionLicense=Public Domain`; About: "No copyright notice appears on the book, and it is a reprint of the original edition which is out of copyright." (from Bible Foundation, bf.org, typed from a Sword of the Lord reprint).
- Coverage: 628 topics, about 21,700 reference groups, 1.7 MB.
- Accuracy (against the 1897 Revell scan, archive.org `newtopicaltextbo00torr`): Adoption, Scriptures and Zeal: references match; wording lightly edited ("Given by inspiration of the Holy Spirit" where 1897 reads "Holy Ghost"; "predestinated to" for "unto"; "labours" for "labors").
- Verdict: yes as a second topical index beside Nave's (headings shown, entries used to gather verses). OpenChristianData also has it, but under CC BY-NC.

## J. W. McGarvey and P. Y. Pendleton, The Fourfold Gospel (1914), with McGarvey on Acts

- Dates: 1914 (Standard Publishing); McGarvey's Acts commentary 1863, revised 1892. Public domain.
- Rule: McGarvey (1829-1911) wrote for years against the higher criticism. Restoration Movement: it teaches baptism for the remission of sins (John 3:5). It quotes the Cambridge Bible at John 3:5 and names Meyer in 11 entries (both on the avoid list).
- Source: CrossWire `TFG` 1.5, 1,031,301 bytes, SHA-256 `c4f95f62d37c005dc233fef8cd998222641b84a399d828b612f4beccc838adec`, `DistributionLicense=Public Domain`. Needs a mirror.
- Coverage: Gospels and Acts (868 Matthew, 577 Mark, 1,002 Luke, 771 John, 1,003 Acts verse entries, 8 in 1 Corinthians), 2.68 MB.
- Accuracy (against the 1914 scan `fourfoldgospelor0000unse`): Matt 16:18 two passages 94 of 100 words (the module turns "this and the succeeding verse" into a reference); John 3:5 95 of 100.

## B. W. Johnson, The People's New Testament (1889-91)

- Dates: 1889 (Gospels, Acts) and 1891 (Romans to Revelation). Johnson (1833-1894), Disciples of Christ. Public domain.
- Rule: believing; Restoration Movement views on baptism; names Meyer in 19 entries; anti-papal remarks ("Pope" 11, "Papacy" 6).
- Source: CrossWire `PNT` 1.1, 871,345 bytes, SHA-256 `880a29670938148c3b5f1715cc78ef534104414baeeea2db5c5c2acc6fb1ed6c`, `DistributionLicense=Public Domain`. Needs a mirror.
- Coverage: all 27 NT books, 6,085 verse entries, 2.14 MB.
- Accuracy (against the 1889 scan `peoplesnewtestam0000unse`): Acts 2:38 94 of 100 words; John 3:5 and Matt 16:18 match except "give more explicit" (scan "give a more explicit") and "Abbot" (scan "Abbott").

## Other notes

- Every CrossWire module above is outside GitHub; one mirror workflow could fetch the rawzip files from `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/`, check them against the SHA-256s listed here, and commit them to a mirror branch.
- The avoid-list check in `crates/atlas-cli/src/layers.rs` is for Layers notes. If the build ever applies it to Voices text, Scofield, TFG and PNT would trip on Meyer, Thayer and the Cambridge Bible inside the writers' own words.
- OpenChristianData (`OpenChristianData/open-christian-data`) gathers many of these works, but its repository license is CC BY-NC 4.0, which conflicts with the per-file "public-domain" labels; not usable as a source.
