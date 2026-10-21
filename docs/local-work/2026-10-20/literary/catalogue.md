# Literary devices in the Bible: a catalogue for Bible Atlas

Research draft, 2026-10-20, second pass. Written for the founder and for whoever builds the feature. The repository was only read (clone at `C:\Users\shubh\Projects\BibleAtlas`, fetched; `origin/main` is `75f6edc`, the merge of PR #48, which changed only four web files after `5296d48`, so every config file measured here, `config/layers.json` and `config/layer-sources.json` included, is the same at both commits). Nothing was edited, committed or checked out there. Every claim below was checked against a text opened and read in this session; where something could not be checked, it says so.

The founder's question, in his words: "the literary elements like parallelism and character juxtaposition, anthropomorphism". This catalogue covers those three first and fully, then the other devices a believing reader would want explained. The sources study (`ba\literary\sources.md`) and the code-fit study (`ba\literary\fit.md`) are finished and are used here; section 18 carries their findings on each writer.

Contents

1. How this was measured, and what each number means
2. At a glance
3. Hebrew parallelism (same idea restated, opposites, building up, climax, alternate, introverted)
4. Chiasm (mirror structure), with a proposed evidence bar
5. Inclusio (bookends)
6. Alternation (A B A B structure)
7. Character juxtaposition (foils): 50 pairs and sets
8. Anthropomorphism and anthropopathism
9. Personification and apostrophe
10. Merism
11. Hyperbole
12. Metaphor, simile and their relatives (hypocatastasis, allegory, parable)
13. Irony and sarcasm
14. Rhetorical question
15. Numerical sayings ("three ... even four")
16. Repetition: doubling, refrains, like beginnings, the doubled verb
17. Smaller figures: metonymy, synecdoche, understatement, euphemism, hendiadys, many-ands and no-ands, paradox, riddle, proverb
18. Sources: who may be cited, where the texts live, what must be mirrored
19. Gaps and open questions
20. What this pass corrected

---

## 1. How this was measured, and what each number means

Texts read in this session (all local research copies in the scratchpad unless marked pinned):

| Text | Copy used | Status for the app |
|---|---|---|
| BSB words | `scrollmapper/bible_databases @ e1b254cef8`, `formats/json/BSB.json` | Pinned in sources.json already |
| BSB poetry lines | `usfm-bible/examples.bsb @ 48a9feb71f` (66 USFM files) | Pinned already |
| Hebrew and Greek word order | STEPBible TAHOT and TAGNT `@ 1f3423d424` | Pinned already |
| E. W. Bullinger, *Figures of Speech Used in the Bible* (1898) | The e-Sword module in `darrelwright/UniqueBible_Books @ 4017a67` (every Bible reference is a link, so verses can be counted exactly); every Bullinger sentence quoted below was also found in one or both independent OCR texts of the 1898 printing on archive.org (`figuresofspeechu00bull`, Princeton; `cu31924029277047`, Cornell) | On the cite list (`bullinger-fos`). The module sits in an unlicensed repository that also holds copyrighted books, so it is research only; a mirror of the 1898 scan is the clean route (section 18) |
| Bullinger (ed.), *The Companion Bible* notes (1909-1922) | UniqueBible SQLite (`otseng/UniqueBible_Commentaries @ 4b77d86`), 1,236 chapter rows; structures read in the archive.org OCR (`CompanionBibleOT`) | On the cite list (`bullinger-cb`). Unlicensed and OCR-damaged ("a" and "=" often read as "."), so counts are lower bounds |
| Matthew Henry (complete) | CrossWire MHC text (the same text as Let's Church `mhc.json`) | Henry's Concise is pinned (`LetsChurch/lets.church @ 71f6f0fc8f`); the complete Henry is linked on Bible Hub |
| John Wesley, *Notes* | Let's Church `wesley.json @ 71f6f0fc8f` | Pinned and stored in the app already |
| Jamieson-Fausset-Brown, Adam Clarke, Albert Barnes | CrossWire SWORD modules JFB, Clarke, Barnes | Not on GitHub; would need a mirror branch |
| Keil and Delitzsch | CrossWire SWORD module KD | Not on GitHub; mirror needed |
| Spurgeon, *The Treasury of David* | CrossWire TDavid text | On GitHub as `lyteword/chspurgeon-tod @ 64450e7`, CC0 |
| John Gill | MyBible SQLite (the Larry Pierce "modernised" text) | Research only; the app links Gill on Bible Hub |
| John Calvin | Let's Church-format `calvin.json` | `LetsChurch/lets.church @ 71f6f0fc8f`, CC0 |
| Bengel, Ellicott, the Pulpit Commentary, Benson, Poole | Bible Hub chapter pages fetched today (Bengel on Matthew 7, Luke 10, Luke 18, Philemon; the others on Genesis 6 and 9, Psalms 1 and 98, Proverbs 10, Isaiah 1, 6 and 55, Matthew 19, Luke 10) | Linked, as the cite list already does |
| Lowth (1829 ed.), Jebb (1820), Boys (1824, 1825), Forbes (1854), Horne (1823) | archive.org OCR texts | Public domain; not on the cite list yet (section 18) |
| Keach and De Laune, *Tropologia* (1681) | EEBO-TCP XML, `textcreationpartnership/A37483 @ e290ad3` | CC0, on GitHub at a pinned commit; not on the cite list yet |
| Augustine, *City of God* XV; *Catholic Encyclopedia* (1907) | New Advent pages fetched today | Augustine is covered by the cite list's `church-fathers`; the encyclopedia is evidence only |

Three kinds of number appear below. They answer different questions, so they are kept apart:

1. **Bullinger's examples.** Each figure in *Figures of Speech* was split out of the e-text module and its linked references counted (`ba\literary\cat2\figcount.py`). The module holds 11,386 links to 7,304 distinct verses under about 200 named figures. A count per figure says how many verses Bullinger offers as examples. It is not a count of how often the device occurs in the Bible; Bullinger gives samples, not a census. (The first draft counted from a different copy, the typed text on archive.org item `CompanionBibleOT`, and its numbers were a little lower; this pass uses the module throughout.)
2. **Bullinger's Companion Bible margin.** The notes say "Figure of speech Anthropopatheia" (and so on) on particular words: 4,025 such tags on 3,506 distinct verses in the copy read. Counts per figure fold together OCR misspellings ("Polyeyndeton") and are lower bounds.
3. **Commentators who use the word.** Henry, JFB, Clarke, Barnes, Keil and Delitzsch, Spurgeon, Gill and Calvin were searched together (268 MB of plain text) for each device's word. Introductions copied onto many verses were counted once. A count is "comments that use the word", not "verses where the writer claims the device"; it shows who talks this way and where.

For individual verses, every "named by" entry was read in the writer's own words, and in this pass every quotation was checked by script against that writer's own text (`cat2\attr.py`): of 379 quotations attributed to a named writer, 359 were found at once, and the other 20 were Bible words, bracketed edits, or quotations from Bible Hub pages, the Companion Bible or *Tropologia*, each then found by hand. BSB quotations in the tables were matched against the pinned BSB (`cat\qcheck.py`; the 14 it flags are inner quotation marks, Hebrew or AV glosses, and writer quotations, all checked by hand). Strength follows the founder's rule (PR #37 for who may be cited, PR #42 and #44 for how strength is counted): the number of cite-list writers who state the point themselves, 3 or more "widely agreed", 2 "commonly held", 1 "some interpreters". Bullinger counts once even when both his books say it; Henry counts once whether the complete or the Concise commentary says it. Writers not yet on the cite list (Lowth, Jebb, Boys, Keach) are shown as "candidate" and are not counted. Where Scripture itself states the point (for example Hebrews 11:4 on Cain and Abel), that is shown separately: it is stronger than any writer but is not a "writer" under the rule. In the tables, the writers are listed Bullinger first, then the commentators, and the number in brackets is the strength count.

---

## 2. At a glance

| Device | Plain idea | Where it lives (measured) | Strongest example, with writers | Do believing readers disagree? |
|---|---|---|---|---|
| Parallelism | The second line answers the first: says it again, says the opposite, adds to it, or climbs a step | The BSB sets 8,335 of 31,084 verses (27%) as poetry lines: 96% of Job to Song of Songs, 53% of the Prophets, under 5% of narrative, Gospels and letters | Proverbs 10:1, opposites: Bullinger, JFB, Clarke, Keil and Delitzsch, Gill (5) | Rarely on the fact; sometimes on which kind |
| Chiasm | A mirror: A B B A, or A B C B A | Small chiasms (one to four lines) are named by Keil and Delitzsch, JFB, Barnes, Gill and Bengel; large chapter-wide chiasms come almost only from Bullinger, and before him from Boys, Jebb and Forbes | Isaiah 6:10 (heart, ears, eyes, then eyes, ears, heart): Bullinger, JFB, Keil and Delitzsch (3), with Jebb and Boys as candidates | Yes, often. Needs an evidence bar (section 4) |
| Inclusio | A passage ends with the words it began with | No commentator uses the word "inclusio"; they say "ends as it began". Bullinger: "The Latins called it INCLUSIO" | Psalm 8:1 and 8:9: Bullinger, Henry, Clarke, Keil and Delitzsch, Spurgeon, Gill, JFB (7) | Little, when the words really repeat |
| Character juxtaposition | Two people set side by side so each shows up the other | Throughout narrative and parables; the narrator often marks it with "but" or "while" | Cain and Abel: Hebrews 11:4 and 1 John 3:12 themselves; Bullinger, Henry, Clarke, Calvin, Wesley, Augustine (6) | On some pairs (Lot, Orpah, Martha) |
| Anthropomorphism and anthropopathism | God described with a body or with human feelings and actions | Bullinger lists 779 verses (Psalms 166, Isaiah 92, Exodus 42); the Companion Bible tags 235 | Genesis 6:6 (God "regretted"): Bullinger, Henry, Keil and Delitzsch, Gill, Calvin, Wesley, Benson (7) | Yes: how far God's feelings are real (section 8) |
| Personification | A thing or idea spoken of as a person | Bullinger lists 198 verses; Psalms, Isaiah, Jeremiah, Job lead | Isaiah 55:12, trees "clap their hands": Bullinger, Clarke, Gill, Keil and Delitzsch, Wesley (5) | Yes for Wisdom in Proverbs 8 |
| Merism | Two ends named to mean everything between | Bullinger has no figure by this name (his Merismos is something else); his nearest are Synecdoche and Syntheton; unfoldingWord tags it 58 times in Psalms | Psalm 121:8, "your coming and going": Bullinger, Clarke, Keil and Delitzsch, Henry (4) | Little |
| Hyperbole | Saying more than is literally meant, to make a point | Bullinger lists 121 verses; commentators use the word in 227 comments | John 21:25 (the world could not hold the books): Bullinger, Henry, Clarke, Barnes, Calvin, Wesley (6); JFB disagrees | Yes, on particular verses |
| Metaphor and simile | Saying one thing is, or is like, another | Commentators use "metaphor" in 1,590 comments and "simile/similitude" in 1,017 | Psalm 23:1, "The LORD is my shepherd": Bullinger, JFB, Henry, Calvin (4) | Yes on a few famous verses ("This is My body") |
| Irony | Saying the opposite of what is meant, to expose folly | Bullinger lists 75 verses | 1 Corinthians 4:8: Bullinger, Henry, JFB, Clarke, Barnes, Gill, Calvin (7) | Yes on some (Genesis 3:22) |
| Rhetorical question | A question that is really a statement | Bullinger lists 189 verses; the Companion Bible marks 373, a fifth of them in Job | Jeremiah 13:23, the leopard's spots: Bullinger, Keil and Delitzsch, JFB, Henry (4) | Little |
| Numerical saying | "Three ... even four" | Proverbs 6 and 30, Amos 1 and 2, Job 5:19, Micah 5:5, Ecclesiastes 11:2 | Amos 1:3: Henry, JFB, Clarke (3) | Whether the higher number means "many" or "the full measure" |
| Repetition | Doubling a word, a refrain, like beginnings, the doubled verb | Bullinger: Epizeuxis 91 verses, Anaphora 55, Refrain 26, Circular repetition 16, Polyptoton 168 | Matthew 23:37, "Jerusalem, Jerusalem": Bullinger, Henry, JFB, Gill, Calvin (5) | Little |

Already in the app, and so only cross-referenced here: plays on words (the "Wordplay" extra and Layers wordplay notes, which cite Bullinger's Paronomasia 52 times), the twelve alphabet poems, quotations and allusions, and "pattern" notes (86 live) for types. Three live Layers notes already touch devices: the Isaiah 7:14 pattern note on Matthew's "God with us" at the start and "I am with you always" at the end (a bookend across a whole Gospel, citing two Ligonier articles), the 1 Samuel 2:10 pattern note that Hannah's song and David's song "frame the books of Samuel" (citing The Gospel Coalition and Gill), and the John 2:19 irony note (the only live note of the irony kind). The Deuteronomy 32:21 wordplay note already says "The lines run jealousy, anger, jealousy, anger". Bullinger's *Figures of Speech* is cited in 117 live notes under 23 figure names (Anthropopatheia twice, Hyperbole once, Simile once, and others), always in support of an allusion, wordplay, name-meaning or plain-meaning note, never as a device note of its own. No note kind covers any device in this catalogue.

---

## 3. Hebrew parallelism

**Plain definition.** Hebrew poetry rhymes ideas rather than sounds. A line is followed by a second line (sometimes a third) that answers it: it says the same thing in other words, says the opposite, carries the thought further, or repeats part of the first line and climbs one step higher. Reading the two lines together often settles what a word means.

Bullinger, *Figures of Speech*, "Parallelism; or, Parallel Lines": "The Repetition of similar, synonymous, or opposite Thoughts or Words in parallel or successive Lines". He counts "seven kinds: three simple and four complex". JFB (A. R. Fausset's introduction to Job, on Job 1:1) calls parallelism "the chief characteristic of Hebrew poetry" and adds that it "thus often affords a key to the interpretation." Lowth, who first set out the kinds (Lecture XIX, 1829 edition read), says the figure "may however on the whole be said to consist of three species", the first being "when the same sentiment is repeated in different, but equivalent terms".

### Forms

| Form | Plain name for the app | What happens | Bullinger's name |
|---|---|---|---|
| Synonymous | Same idea, said twice | Line 2 restates line 1 in other words | Synonymous or Gradational |
| Antithetic | Opposites | Line 2 says the opposite, usually joined by "but" | Antithetic or Opposite |
| Synthetic | Building up | Line 2 adds to line 1, or the lines share one build | Synthetic or Constructive |
| Climactic (stair-step) | Climbing a step | Line 2 repeats words of line 1 and goes one step further | Bullinger treats this as Anadiplosis, Climax (Gradation) and Anabasis (Gradual Ascent); Keil and Delitzsch call it "parallelism with reservation" and "step-like" movement; JFB calls it "rhythm of gradation" |
| Alternate | A B A B | Lines 1 and 3 go together, 2 and 4 go together | Complex: Alternate (section 6) |
| Introverted | A B B A | Line 1 answers line 4, line 2 answers line 3 | Complex: Introverted (section 4) |

### Examples

| Form | Reference | BSB words | What to notice | Named on this verse by |
|---|---|---|---|---|
| Same idea | Genesis 4:23 | "For I have slain a man for wounding me, a young man for striking me." | "Man" and "young man" are one person, not two | Bullinger (his first example in the Bible); Calvin: "The repetition ... is according to Hebrew phraseology, so that none should think different persons to be denoted"; JFB (Job introduction: "Lamech's parody") (3) |
| Same idea | Psalm 19:1 | "The heavens declare the glory of God; the skies proclaim the work of His hands." | Heavens and skies; glory and handiwork | Calvin: "the Psalmist repeats one thing twice, according to his usual manner" (1) |
| Same idea | Luke 1:46-47 | "My soul magnifies the Lord, and my spirit rejoices in God my Savior!" | Mary's song keeps the Hebrew form in Greek | Bullinger (1) |
| Same idea | Isaiah 1:3 | "The ox knows its owner, and the donkey its master's manger, but Israel does not know; My people do not understand." | Pairs within pairs, then the contrast | JFB ("as the parallelism requires"); Keil and Delitzsch ("The parallel, with its striking contrasts") (2) |
| Same idea | Psalm 22:27 | "All the ends of the earth will remember and turn to the LORD. All the families of the nations will bow down before Him." | Ends of the earth and families of the nations | JFB, Job introduction, as his first example of synonymous parallelism (1) |
| Opposites | Proverbs 10:1 | "A wise son brings joy to his father, but a foolish son grief to his mother." | Wise and foolish, joy and grief, father and mother | Bullinger; JFB ("The parallelisms of Pr 10:1-15:33 are mostly antithetic; and those of Pr 16:1-22:16, synthetic"); Clarke ("those which Bishop Lowth calls the antithetic"); Keil and Delitzsch (the collection is "for the most part antithetical"); Gill ("clauses set in a contrast to one another") (5). The Pulpit Commentary agrees ("The antithetical character of the sentences is most marked"). |
| Opposites | Proverbs 27:6 | "The wounds of a friend are faithful, but the kisses of an enemy are deceitful." | Wounds and kisses swap their usual values | Bullinger; Keil and Delitzsch ("The contrast to ...") (2) |
| Opposites | Psalm 1:6 | "For the LORD guards the path of the righteous, but the way of the wicked will perish." | The psalm's two ways in one verse | Henry (the wicked "are the reverse of the righteous"); Spurgeon ("he contrasts the state and character of the ungodly") (2) |
| Opposites, in the letters | Romans 8:5 | "Those who live according to the flesh set their minds on the things of the flesh; but those who live according to the Spirit set their minds on the things of the Spirit." | Paul keeps the two-line turn in Greek prose | Bullinger, under Antithesis (with Romans 5:19, 8:13, 2 Corinthians 4:17 and Philippians 3:7) (1) |
| Building up | Psalm 19:7-9 | "The Law of the LORD is perfect, reviving the soul; the testimony of the LORD is trustworthy, making wise the simple." (six such lines) | Same build six times: name of the word, quality, effect | Bullinger (his example of Synthetic); Henry ("six sentences ... in each of which the name Jehovah is repeated") (2) |
| Building up | Job 3:3-4 | "May the day of my birth perish, and the night it was said, 'A boy is conceived.'" | Each line adds to Job's curse | JFB, Job introduction (Job 3:3-9 as his example of synthetic) (1) |
| Building up, three steps | Psalm 1:1 | "who does not walk in the counsel of the wicked, or set foot on the path of sinners, or sit in the seat of mockers." | Walk, stand, sit; counsel, path, seat; wicked, sinners, mockers | Bullinger (Synonymous or Gradational; Anabasis); Calvin ("he places at the top of the climax the seat") (2) |
| Climbing a step | Psalm 93:3 | "The floodwaters have risen, O LORD; the rivers have raised their voice; the seas lift up their pounding waves." | In Hebrew the same word, *neharot* (rivers), comes three times, and the same verb three times (checked in TAHOT). The BSB varies the words for English style and hides the stair. | Keil and Delitzsch: "The thought is unfolded in a so-called 'parallelism with reservation.'" (1) |
| Climbing a step | Psalm 92:9 | "For surely Your enemies, O LORD, surely Your enemies will perish" | Repeat, then complete | Keil and Delitzsch: "the emotional anadiplosis" (1) |
| Climbing a step | Psalm 121:3-4 | "your Protector will not slumber. Behold, the Protector of Israel will neither slumber nor sleep." | Takes up "Protector ... slumber" and goes further | Keil and Delitzsch ("The most prominent distinguishing mark of Psa 121:1-8 is the step-like movement of the thoughts"); JFB, Job introduction ("Rhythm of gradation", citing Psalm 121) (2) |
| Climbing a step | Psalm 29:1-2 | "Ascribe to the LORD, O heavenly beings, ascribe to the LORD glory and strength. Ascribe to the LORD the glory due His name" | Threefold "Ascribe", each a step on | Henry ("How often this call is repeated"); Calvin ("The repetition, also, shows that they must be vehemently urged") (2). Neither uses the word "climax". |
| Climbing a step | Hosea 2:21-22 | "I will respond to the heavens, and they will respond to the earth. And the earth will respond to the grain ..." | A chain where each link begins with the last | Bullinger, "Climax; or, Gradation" (his first example) (1) |
| Alternate | Isaiah 55:8-9 | "For My thoughts are not your thoughts, neither are your ways My ways ... so My ways are higher than your ways and My thoughts than your thoughts." | Thoughts, ways // ways, thoughts | Bullinger (he prints the reference as Isa. 51:8, 9, a slip for 55:8-9; the module keeps the slip) (1) |
| Alternate | Deuteronomy 32:21 | "They have provoked My jealousy by that which is not God; they have enraged Me with their worthless idols. So I will make them jealous by those who are not a people ..." | Jealousy, anger // jealousy, anger: the punishment mirrors the sin | Bullinger; the live Layers note on this verse already says so (1) |
| Introverted | Matthew 7:6 | "Do not give dogs what is holy; do not throw your pearls before swine. If you do, they may trample them under their feet, and then turn and tear you to pieces." | Dogs (A), swine (B), trample (B), tear (A) | Bullinger; Barnes ("a beautiful instance of the introverted parallelism ... The dogs would rend, and not the swine"); JFB (he glosses "trample" with "as swine do" and "rend you" with "as dogs do") (3); Jebb, candidate, lays it out the same way and says the pairing has "been noticed by almost all the commentators". Bengel disagrees: "rend" also "appears to refer to the swine". |
| Introverted | Genesis 3:19 | "until you return to the ground" ... "because out of it were you taken. For dust you are, and to dust you shall return." | End, origin // origin, end | Bullinger (1) |
| Introverted | Isaiah 6:10 | "Make the hearts of this people calloused; deafen their ears and close their eyes. Otherwise they might see with their eyes, hear with their ears, understand with their hearts" | Heart, ears, eyes // eyes, ears, heart | See section 4: Bullinger, JFB, Keil and Delitzsch (3) |

### How often, and where

- **Poetry in the BSB** (measured from the pinned USFM; a verse counts when any of it sits on a poetry line): 8,335 of 31,084 verses, 26.8%. By section: Job to Song of Songs 4,588 of 4,784 (95.9%); Isaiah to Malachi 2,891 of 5,489 (52.7%); Genesis to Deuteronomy 3.9%; Joshua to Esther 3.5%; Gospels 4.4%; Acts 3.6%; letters 4.6%; Revelation 13.6%. Whole books in poetry: Psalms, Song of Songs, Lamentations, Obadiah, Micah, Nahum, Habakkuk, Zephaniah. Nearly whole: Proverbs 98.5%, Job 95.2%, Joel 93.2%, Hosea 91.9%, Amos 88.4%, Isaiah 87.9%. About half: Jeremiah 47.6%, Ecclesiastes 41.4%. (The code-fit study counts 8,180 verses with line marks in the USFM, a slightly stricter measure; both agree on where the poetry is.) Inside narrative, parallel lines appear in songs and speeches (Genesis 4:23-24, Exodus 15, Judges 5, 1 Samuel 2, 2 Samuel 1 and 22); in the New Testament in Jesus' sayings, the songs of Luke 1 and 2, and quotations of the Old Testament.
- **Proverbs 10 to 15**: of 183 two-line verses, the second line of 147 (80%) begins with "but" (code-fit study). Over all 4,352 two-line poetry verses, the second line most often begins with "and" (1,127) or "but" (319).
- **Bullinger's examples** under "Parallelism": 59 verses (Isaiah 17, Proverbs 6, Psalms 5, Genesis 3, Deuteronomy 3, Matthew 3), with 44 lettered layouts. He adds Climax 12 verses, Anabasis 13, Anadiplosis 41 and Antithesis 30 (Romans 7, 2 Corinthians 5).
- **Commentators using the word "parallelism"**: 294 comments; Keil and Delitzsch 149 and JFB 117 carry nearly all of it, then Spurgeon 12, Clarke 9, Barnes 5, Calvin 2. By book: Isaiah 47, Psalms 41, Job 34, Proverbs 30, Jeremiah 22, Micah 12, Ezekiel 10. Henry and Gill never use the word, though Calvin and Henry describe the thing (Calvin on Psalm 19:1: "repeats one thing twice").
- **A modern per-verse count.** unfoldingWord's Translation Notes (a believing team, CC BY-SA, section 18) tag parallelism 297 times in Psalms and 25 in Genesis.
- **Who taught the categories.** Bullinger's own history: Lowth (*Lectures on the Sacred Poetry of the Hebrews*, 1753, in English 1787) set out the three kinds; "Bishop Jebb in his Sacred Literature" (1820) extended the study and named the introverted kind; and "It was reserved for Thomas Boys" (*Tactica Sacra*, 1824; *A Key to the Book of the Psalms*, 1825) to find the same law in whole paragraphs and books. JFB names Lowth in 77 comments and Clarke in 70 (116 of all 181 such comments are in Isaiah). The sources study read all three in their own words and found each holding Scripture inspired (section 18); none is on the cite list yet.

### Who names it (summary)

Bullinger first (59 examples, all seven kinds); JFB (the three kinds plus alternate and introverted, Job 1:1 introduction; Proverbs 10:1 on where each kind dominates); Keil and Delitzsch throughout Psalms, Job, Proverbs and Isaiah, with their own terms ("parallelism with reservation", "step-like"); Clarke and Barnes following Lowth; Gill on Proverbs 10:1; Calvin and Henry describing it without the name. Candidates: Lowth, Jebb, Boys, and Horne's *Introduction* (1818-1846 editions), which summarises them.

### Honest limits

1. **The BSB can hide the form.** English style avoids repeating a word; Hebrew poetry repeats on purpose. Psalm 93:3 is the clearest case found: three identical words in Hebrew, three different words in the BSB. Any feature that shows stair-step or same-word parallelism should draw it on the original words, which the app already shows at Study, and use the root index to find the repeated roots.
2. **Which kind it is can be arguable.** "Synthetic" is a catch-all: Bullinger's synthetic example (Psalm 19:7-9) is "neither gradation nor opposition", only shared build. Show the kind only when the lines plainly repeat, oppose or climb; otherwise say "the two lines answer each other".
3. **Parallelism is evidence for meaning, and sometimes for the text.** Bullinger uses it to argue that Isaiah 11:4 should read "the oppressor" instead of "the earth" (a one-letter change), and Jebb drops words from Acts 4 partly "because they encumber the parallelism". The app should not follow either there: it would contradict the BSB, and it is a textual judgment, not a figure.
4. **Not every line pair in the BSB poetry is parallel.** Line breaks are the translators' layout. Treat "poetry line" as where to look, not as proof.
5. **Older writers name Herder and Ewald on these questions.** JFB sends readers to "Lowth ... and Herder"; Keil and Delitzsch argue with Ewald, Hupfeld and Hitzig; the 1829 Lowth carries notes by J. D. Michaelis and C. E. Stowe that cite De Wette and Eichhorn. Herder and the German critics are not believing writers in the founder's sense; quote the commentator's own sentence, never the names he reports, and Lowth's own lectures, never the added notes.

### For the app

- Simple: "These two lines say the same thing in different words" (or "say opposite things", "climb a step"). One sentence, no term.
- Study: the kind's plain name, both lines lit side by side; on the original words, the repeated root.
- Deep: Bullinger's name for the figure, the writers, the evidence line.
- Detection can be largely automatic for two kinds: "but" opening the second line of a two-line verse in Proverbs 10 to 15 (opposites), and a root repeated across adjacent poetry lines (same-word, climbing). Every automatic find still needs a named writer before it goes live, under the existing Layers rule. The code-fit study puts these notes in a new `parallelism` Layers kind with a `form` field (`restated`, `opposite`, `building`, `climax`).

---

## 4. Chiasm (mirror structure)

**Plain definition.** The words or ideas of a passage come in one order and then go back out in reverse order, like the two halves of the letter X: A B C, then C B A. The pairs answer each other, and the middle is often the point.

Bullinger, under "Correspondence", "Introverted Correspondence": "The Greeks called it CHIASMOS or CHIASTON from its likeness in form to the letter Chi (X.)". He quotes Bengel that "its employment is never without some use". His other names for small chiasms: Epanodos (the same words inverted) and Antimetabole (propositions inverted, "Counterchange"). Jebb, who named it "introverted parallelism" in 1820, describes it as lines that answer "from flanks to centre".

### Forms

| Size | What it is | Typical writers |
|---|---|---|
| Within one verse | Words in one order, then the reverse | Keil and Delitzsch (Proverbs 10:3, 14:31, 22:1; Psalms 56:8, 63:8, 148:8; Isaiah 6:10, 40:21, 63:18; Job 17:1, 27:19), JFB (Isaiah 6:10; Job 31:38-39, 37:22; Isaiah 15:3), Bengel (Philemon 5), Gill (Genesis 10:2) |
| Across a few verses | Four to ten lines mirrored | Bullinger (Matthew 3:10-12; Mark 5:2-6; John 5:8-11; 2 Chronicles 32:7-8), Barnes and JFB (Matthew 7:6); Jebb (Proverbs 23:15-16) |
| A whole psalm, chapter or book | Large panels mirrored | Bullinger and the Companion Bible (Psalm 23, Psalm 103, the Song of Moses, 1 and 2 Thessalonians, 2 Peter, Philemon); Boys and Forbes before him |

### Examples

| Reference | BSB words | The mirror | Named by |
|---|---|---|---|
| Isaiah 6:10 | "Make the hearts of this people calloused; deafen their ears and close their eyes. Otherwise they might see with their eyes, hear with their ears, understand with their hearts" | Heart, ears, eyes // eyes, ears, heart: the hardening and the healing run in opposite directions | Bullinger (Epanodos and introverted Parallelism); JFB ("In the first member of the sentence, the order is, the heart, ears, eyes; in the latter, the reverse order, the eyes, ears, heart"); Keil and Delitzsch (the three clauses "point back to these three imperatives in inverse order") (3). Candidates: Jebb; Boys ("in a. and a., the extreme members, we have the heart"). The clearest chiasm in the Bible for a first-time reader, and it survives in the BSB. |
| Genesis 4:4-5 | "the LORD looked with favor on Abel and his offering, but He had no regard for Cain and his offering." | Hebrew order (TAHOT): looked // to Abel and his offering // to Cain and his offering // not looked. The verbs bracket the two brothers. | Bullinger, both books ("Antimetabole") (1) |
| 1 Samuel 1:2 | "one named Hannah and the other Peninnah. And Peninnah had children, but Hannah had none." | Hannah, Peninnah // Peninnah, Hannah (same order in Hebrew) | Bullinger, both books (Introverted Parallelism; Companion Bible: "Note the Fig. Antimetabole") (1) |
| 2 Samuel 3:1 | "the house of Saul and the house of David ... David grew stronger and stronger, while the house of Saul grew weaker and weaker." | Saul, David // David, Saul | Bullinger, both books (1) |
| 2 Chronicles 32:7-8 | "for there is a greater One with us than with him. With him is only the arm of flesh, but with us is the LORD our God" | Us, him // him, us: Bullinger labels the four members "Our resource", "His resource", "His resource", "Our resource" | Bullinger (introverted Parallelism) (1) |
| Proverbs 23:15-16 | "My son, if your heart is wise, my own heart will indeed rejoice. My inmost being will rejoice when your lips speak what is right." | Your heart, my heart // my inmost being, your lips | Jebb, candidate: "This may be called the introverted parallelism" (his first example); Boys repeats it (0 on the cite list) |
| Matthew 7:6 | see section 3 | Dogs, swine // trample (swine), tear (dogs) | Bullinger, Barnes, JFB (3); Jebb, candidate; Bengel reads it otherwise |
| Galatians 2:16 | "a man is not justified by works of the law, but by faith in Jesus Christ ... by faith in Christ and not by works of the law, because by works of the law no one will be justified." | Justified, works, faith // faith, works, justified | Bullinger (1) |
| Philemon 5 | "your faith in the Lord Jesus and your love for all the saints." | Greek order (TAGNT): love, faith, the Lord Jesus, all the saints: love goes with the saints, faith with the Lord. The BSB untangles the crossing into plain order. | Bengel (Bible Hub): "but in this passage there is a Chiasmus in regard to Philemon. The first is connected with the fourth, the second with the third" (1) |
| Psalm 23 | (whole psalm) | Verses 1-3 speak of the LORD as "He", verses 4-5 to Him as "You", verse 6 "He" again | Bullinger: "Ps. 23 is a simple introversion, which is marked by the use of the persons" (1) |
| Proverbs 22:1 | "A good name is more desirable than great riches; favor is better than silver and gold." | In Hebrew the verse opens with "is to be chosen" and closes with "good": the two verdicts bracket the comparisons | Keil and Delitzsch: "The proverb is constructed chiastically" (1) |
| Isaiah 40:21 | "Do you not know? Have you not heard? Has it not been declared to you from the beginning? Have you not understood since the foundation of the earth?" | Four questions crossed | Keil and Delitzsch: "four questions chiastically arranged" (1) |

### How often, and where

- Keil and Delitzsch use "chiasm"/"chiastic"/"crosswise" for structure in about 17 comments, JFB about 4, Barnes 1, Gill 1 (counted after removing false hits such as names ending in "-chias"). Every one is about a single verse or a few lines.
- No commentator among the eight proposes a chiasm larger than a few verses. Chapter-wide and book-wide mirrors in this tradition come from Bullinger and from Boys and Forbes before him.
- Bullinger's "Correspondence" section lays out 63 lettered structures (counted in the e-text), from Genesis 43:3-5 and Leviticus 14:51-52 to Psalms 23, 49, 66, 103, 105, 132, 144, 146 and 148, the visions of Zechariah, Mark 3:21-35, John 5:8-11, Galatians 2:16, Philemon, and whole letters (1 and 2 Thessalonians, 2 Peter). His Antimetabole lists 27 verses and Epanodos 6.
- The Companion Bible outlines every book: its OCR carries about 2,300 labelled structures, roughly 2,000 of them alternations or introversions (sources study). They exist only as page OCR; no clean text keeps the letters and indents.

### Honest limits, and why chiasm needs an evidence bar

1. **Chiasm is the device most easily over-found.** Almost any passage can be cut into matching halves if the labels are chosen loosely ("God's act" ... "God's act"). Bullinger's large structures are often labelled this way. His Psalm 103 is "a beautiful example of a large introversion of ten members", but several of his matching pairs share a theme he names rather than words the psalmist wrote.
2. **The most quoted modern chiasms may have no old believing witness.** Genesis 9:6 ("Whoever sheds the blood of man, by man his blood will be shed") is the chiasm most modern books show first, yet it is not in *Figures of Speech*, none of ten cite-list commentators remarks on the crossing, and Forbes cites the verse only for "the image of God" (sources study). Expect many chiasm notes to have one writer or none.
3. **Readers draw different mirrors of the same text, and the mirror can change the meaning.** On Matthew 7:6 the chiastic reading (Bullinger, Barnes, JFB, Jebb) says the dogs tear; Bengel takes the swine as both trampling and tearing. On Mark 3:21-35 Bullinger uses his structure to settle what the unforgivable sin is. A structure used as a key to doctrine is a claim and must be sourced like one.
4. **Bullinger's structures carry his own doctrine.** His notes on the structures apply them in line with his distinctive views: Ezekiel 36:26-27 "cannot be applied to the Christian now"; Romans 11:21-23 "relates to Jew and Gentile as such" and "is not to be interpreted of the Church". Show his structure, never his application (section 18 lists his views).
5. **The English can hide it.** Genesis 4:4-5 is a crossing in Hebrew, not in the BSB's word order; Philemon 5 likewise in Greek. Draw chiasms on the original words where the BSB does not keep the order.

### Proposed evidence bar

The bar can be stated in the app's own words. Its points follow Craig Blomberg's nine criteria for extended chiasmus ("The Structure of 2 Corinthians 1-7", *Criswell Theological Review* 4.1, 1989, pages 5-7, read at biblicalelearning.org; copyright The Criswell College, so cite and link, never copy). In short, Blomberg asks for a real problem that ordinary outlines do not solve; clear parallels that other readers also see; matches in wording as well as ideas; central words, not trivial ones; words that are not common elsewhere in the passage; several pairs (he treats five or more in sequence as hard to explain as chance); divisions at natural breaks; a centre worth being the centre; and no displaced elements. Blomberg is a New Testament professor at Denver Seminary and the author of *Can We Still Believe the Bible?* (Brazos, 2014), a defence of the Bible's reliability; that much was confirmed in search results today, but he is not on the cite list and the founder should confirm his standing before he is named in the app. He would only be the source of the test, never of a chiasm. Jebb's older test fits the same spirit: he checks that each related pair is of "equal lengths, in the original".

For Bible Atlas, a tiered rule:

| Tier | Size | Bar to show it | How it shows |
|---|---|---|---|
| 1. Word mirror | Within one verse or two lines | The repeated words are checked in the original (same roots in reverse order), and one cite-list writer names the crossing | At Study, with the two halves lit |
| 2. Short mirror | 3 to 12 lines | Every pair shares at least one root or an exact word in the original (checked by the build against TAHOT and TAGNT); at least three pairs; two cite-list writers name it, or Bullinger plus one other | At Study, as an outline with the matching words lit; the centre marked |
| 3. Large mirror | A whole psalm, chapter or book | All of tier 2, plus the tests above written out in the evidence line, plus three writers, or the founder's review | At Deep only, labelled "a structure some readers see", never used to settle a doctrine |

Bullinger alone never lifts a large structure above "some interpreters", and the build should refuse a tier 2 or 3 structure whose pairs share no checked words. The code-fit study's `structure` extra (`config/structures.json`, `extra_structure.rs`) already plans the checks this needs: labels that mirror, quoted words found in each member's own BSB text, a shared word or root for every pair, and strength equal to the count of distinct interpreters.

---

## 5. Inclusio (bookends)

**Plain definition.** A passage ends with the same words it began with. The repeat draws a circle round everything between and tells the reader "this is one whole", often with the closing words heard more fully the second time.

Bullinger, "Epanadiplosis; or, Encircling": "The Repetition of the same Word or Words at the beginning and end of a Sentence ... The Latins called it INCLUSIO". He limits the figure to one sentence and adds that "the repetitions at the beginning and end of distinct portions, or independent passages (such as Pss. 8, ciii., etc.), belong rather to the subject-matter and are classed under Correspondence". His "Cycloides; or, Circular Repetition" covers a phrase that comes round at the start and end of each part (2 Samuel 1; Psalms 42, 46, 80).

### Examples

| Reference | BSB words, start and end | Named by |
|---|---|---|
| Psalm 8:1 and 8:9 | "O LORD, our Lord, how majestic is Your name in all the earth!" (both) | Bullinger (Psalm 8 named under Epanadiplosis as a case that "belong[s] rather to" Correspondence); Henry ("With good reason therefore does the psalmist conclude as he began"); Clarke ("The psalmist concludes as he began"); Keil and Delitzsch ("he can as a conclusion repeat the thought with which he began ... and weave his Psalm together, as it were, into a wreath"); Spurgeon ("like a good composer, the poet returns to his key-note"); Gill ("The psalm ends with the same words with which it begins"); JFB ("closes ... with the terms of admiration with which it was opened") (7) |
| Psalm 118:1 and 118:29 | "Give thanks to the LORD, for He is good; His loving devotion endures forever." (both, word for word) | Henry ("He concludes this psalm as he began it"); JFB ("expressed in the terms with which the Psalm opened"); Clarke ("they end as they began"); Keil and Delitzsch ("the Psalm closes, in correspondence with its beginning"); Gill ("the psalm ends as it began") (5) |
| Psalm 103:1 and 103:22 | "Bless the LORD, O my soul" (both) | Bullinger (A and A, "Exhortation to bless", in his structure of Psalm 103); Henry ("he concludes, Bless the Lord, O my soul! as he began"); Gill ("thus the psalmist ends the psalm as he begun it") (3) |
| Psalm 104:1 and 104:35 | "Bless the LORD, O my soul" (both) | Gill ("The psalm begins and ends alike as the preceding") (1) |
| Psalm 146:1 and 146:10 | "Hallelujah!" (first word and last) | Bullinger (A and A, "Praise. Hallelujah."); Gill ("so the psalm ends as it began") (2) |
| 2 Samuel 1:19 and 1:27 | "How the mighty have fallen!" (at the start, at 1:25, and in the last line) | Bullinger (Cycloides); Henry ("this is three times lamented"); JFB ("This forms the chorus"; the praises of Jonathan form "the burden of the poem, which begins and ends with that excellent prince"); Gill ("This is the burden of this elegiac song, being the third time it is mentioned") (4) |
| Ecclesiastes 1:2 and 12:8 | "'Futility of futilities,' says the Teacher ... 'Everything is futile!'" (both) | Bullinger (Ecclesiastes 1:2 under Epanadiplosis, at sentence level); Clarke ("concluded by the author with the same exclamation by which he began this book"); Henry ("He repeats his text"); Gill (he "repeats it") (4) |
| Matthew 4:23 and 9:35 | "teaching in their synagogues, preaching the gospel of the kingdom, and healing every disease and sickness" (both) | Henry on 9:35: "here it is elegantly repeated in the close of these instances" (the Sermon on the Mount, then the miracles) (1) |
| Matthew 5:3 and 5:10 | "for theirs is the kingdom of heaven" (first and last beatitude) | Not found named by the writers checked; plain in the text |
| 1 and 2 Samuel: 1 Samuel 2:1-10 and 2 Samuel 22 | Hannah's song and David's song, both calling God the Rock and ending with His king and His anointed | Live Layers pattern note on 1 Samuel 2:10, citing The Gospel Coalition (Fix and Vannoy) and Gill (2) |
| Matthew 1:23 and 28:20 | "God with us" ... "I am with you always" | The live Layers note on Isaiah 7:14 already says this, citing two Ligonier articles (1 source) |
| Philippians 4:4 | "Rejoice in the Lord always. I will say it again: Rejoice!" | Bullinger (sentence level) (1) |

### How often, and where

- No commentator among the eight uses the word "inclusio" for this (the only six hits mean "inclusion" in other senses). They describe it in plain words: "ends as it began", "returns to his key-note", "the burden of the song".
- Bullinger's Epanadiplosis lists 42 verses (Numbers 5, Psalms 5, Ecclesiastes 4); his Cycloides 16 (Psalms 9). The Companion Bible margin marks Epanadiplosis on 32 verses.
- It is most visible in the Psalms (checked in the BSB: Psalms 8, 103, 104, 106, 113, 118, 135, 136 and 146 to 150 open and close with the same words; Psalm 117 opens and closes with the same Hebrew verb, *hallelu*, "praise" (checked in TAHOT), which the BSB gives as "Praise the LORD" and "Hallelujah"), in Ecclesiastes, in laments (2 Samuel 1), and as section markers in Matthew. Aquifer's Tyndale notes, already in the app, use "inclusio" or "bookend" 20 times.

### Honest limits

- A true inclusio repeats words, not merely a theme; ask for the same words in the original. Psalm 118:1 and 29 are identical in Hebrew; Matthew 4:23 and 9:35 are near-identical in Greek.
- Many psalms end with "Hallelujah" because it is a liturgical close, not always a deliberate circle (Keil and Delitzsch on 104:35 discuss whether a Hallelujah belongs to the end of one psalm or the start of the next).
- Large bookends across a whole book (Matthew 1:23 and 28:20; the two songs in Samuel) are a reading, not a repeated phrase; keep them at the strength their writers give them.
- Keil and Delitzsch should not be cited on Ecclesiastes until the founder decides: Delitzsch's Ecclesiastes says the book "was not written by Solomon himself" (voices research, group 2).

### For the app

The cleanest of all devices to detect: same words (same roots, same order) at the first and last verse of a psalm or section. It can be shown at Simple: "This psalm ends with the words it began with."

---

## 6. Alternation (A B A B)

**Plain definition.** Two subjects take turns: A, B, then A again, B again. The A parts read on from each other, and so do the B parts.

Bullinger, under "Correspondence", "Alternate correspondence of subjects": "the first corresponds with the third, and the second with the fourth". Under Parallelism he adds that the alternation may be "extended" (three or more lines in each turn) or "repeated" (the two subjects coming round several times).

| Reference | The turns | Named by |
|---|---|---|
| Genesis 19:25 | "He destroyed these cities and the entire plain, including all the inhabitants of the cities and everything that grew on the ground." Cities (A), plain (B), inhabitants of the cities (A), what grew on the plain (B) | Bullinger (Complex Alternate) (1) |
| Proverbs 24:19-20 | "Do not fret over evildoers, and do not be envious of the wicked. For the evil man has no future; the lamp of the wicked will be extinguished." Evildoers (A), wicked (B), evil man (A), wicked (B) | Bullinger, also in Companion Bible Appendix 6 (1) |
| Isaiah 65:21-22 | "They will build houses and dwell in them; they will plant vineyards and eat their fruit. No longer will they build houses for others to inhabit, nor plant for others to eat." Build, dwell; plant, eat; build, inhabit; plant, eat | Bullinger (Repeated Alternation) (1) |
| Judges 10:17 | "the Ammonites were called to arms and camped in Gilead, and the Israelites assembled and camped at Mizpah." Who, gathered, camped; who, gathered, camped | Bullinger (Extended Alternation) (1) |
| Jeremiah 17:5-8 | A 5 "Cursed is the man who trusts in mankind"; B 6 "like a shrub in the desert"; A 7 "But blessed is the man who trusts in the LORD"; B 8 "like a tree planted by the waters" | Bullinger (1) |
| Psalm 19 | A 1-6 the heavens and the sun in them; B 7-14 the Scriptures and the servant who keeps them | Bullinger (1) |
| Hebrews 1 and 2 | God speaking (1:1-2), the Son above the angels (1:2-14), God speaking (2:1-4), the Son below the angels (2:5-18) | Bullinger; he uses it to show that "therefore" in 2:1 follows 1:2 (1) |
| 1 Samuel 2:11-3:1 | The narrator alternates Eli's sons and the boy Samuel: 2:12 "the sons of Eli were wicked men"; 2:18 "Now Samuel was ministering before the LORD"; 2:22-25 the sons; 2:26 "the boy Samuel continued to grow"; 2:27-36; 3:1 | Bullinger (the Companion Bible lays out 1 Samuel 1:1 to 4:1 as a "Repeated Alternation" of "Elkanah's son, Samuel" and "The sons of Eli"); Keil and Delitzsch ("Samuel served as a boy before the Lord by the side of the worthless sons of Eli"); Henry ("the wickedness of Eli's sons made Samuel's early piety appear the more bright") (3) |

Alternation is the grammar of much character juxtaposition (section 7). Its limits are those of chiasm at a smaller scale: ask for repeated words, not only matching topics. Genesis 19:25 shows the other limit: the BSB smooths the Hebrew turns into one English sentence, so the pattern has to be drawn on the original words.

---

## 7. Character juxtaposition (foils)

**Plain definition.** Scripture often sets two people side by side, in one sentence or in neighbouring scenes, so that each shows up the other: one trusts and one does not, one rises and one falls. Sometimes the narrator says it with a single "but"; sometimes the New Testament draws the contrast out of the Old; sometimes Jesus builds a parable on it.

This is not one of Bullinger's figures by name; it is a way the Bible tells its stories. But its grammar is often a figure he does name: a crossing sentence (Antimetabole, Introverted Parallelism) in Genesis 4:4-5, 1 Samuel 1:2 and 2 Samuel 3:1, or an alternation of scenes (1 Samuel 1 to 4, which the Companion Bible lays out as a "Repeated Alternation" of Samuel and the sons of Eli). The narrator's own words often mark it, measured in the BSB: in 1 Kings, 2 Kings and 2 Chronicles, 32 verses say a king "did evil in the sight (or eyes) of the LORD" and 15 that he "did what was right", and 8 verses measure a king against David ("unlike David his father", 2 Kings 16:2; "just as his father David had done", 18:3). The oldest believing statement of a foil found is Augustine's (*City of God* XV.1): "Cain was the first-born, and he belonged to the city of men; after him was born Abel, who belonged to the city of God."

How to read the table: "Scripture itself" means the Bible draws the contrast (an explicit "but", a New Testament comment, or Jesus' own words); "Writers" lists cite-list writers whose words were read today and who state the contrast themselves, with the verse they comment on; the count in brackets is the strength under the founder's rule. "Not found" means none of the works searched (the eight local commentaries, Wesley, and Bengel where fetched) was found stating it; it does not mean no believing writer does.

| # | Pair or set | Passages | Scripture itself | Writers who draw the contrast (verse; words) |
|---|---|---|---|---|
| 1 | Cain and Abel | Genesis 4:2-8 | Hebrews 11:4 ("a better sacrifice than Cain did"); 1 John 3:12 ("his own deeds were evil, while those of his brother were righteous"); Jude 11 | Bullinger, Companion Bible 4:4-5 (Antimetabole); Henry, 4:3 ("The different success of their devotions"); Clarke, 4:5 (Cain's offering "not being accompanied, as Abel's was, with faith"); Calvin, 4:4 ("the offering of Abel was, by faith, more excellent than that of Cain"); Wesley, 4:4 ("Cain was a wicked man, but Abel was a righteous man"); Augustine, *City of God* XV.1 (6) |
| 2 | Cain's line and Seth's line (the two Lamechs) | Genesis 4:17-24 and 4:25-5:32; 4:23-24 and 5:29 | 4:26 "At that time men began to call upon the name of the LORD" | Henry, 4:25 ("While Cain, the head of the apostasy, is made a wanderer, Seth, from whom the true church was to come, is one fixed"); Calvin, 4:25 ("to trace the generation of pious descendants through the line of Seth"); Augustine, *City of God* XV.17 ("there were henceforth two lines proceeding from two fathers, Cain and Seth") (3) |
| 3 | Abram and Lot | Genesis 13:7-18; 19 | 13:12 "Abram lived in the land of Canaan, but Lot settled in the cities of the plain and pitched his tent toward Sodom" | Clarke, 13:18 ("Abram prospered greatly in the comparatively barren part of the land, while Lot lost all his possessions") (1); Henry, 13:5, praises Abram's yielding without naming the contrast. Limit: 2 Peter 2:7-8 calls Lot "righteous"; he is a weaker believer, not a villain. |
| 4 | Sarah and Hagar | Genesis 16; 21:9-12 | Galatians 4:22-31 ("one by the slave woman and the other by the free woman") | JFB, Galatians 4:27 ("answering to Sarah ... as contrasted with the law, answering to Hagar"); Barnes, Galatians 4:21 ("To show the difference of the two conditions"); Calvin, Galatians 4:22 ("the two covenants in the two wives of Abraham") (3) |
| 5 | Isaac and Ishmael | Genesis 21:8-14 | Galatians 4:28-29; Romans 9:7-8 | Gill, Galatians 4:29 ("the figures of the two different seeds"); JFB, Galatians 4:29 (Ishmael's mocking "directed against Isaac's piety and faith"); Barnes, Galatians 4:29 ("the opposition which subsisted between them") (3) |
| 6 | Jacob and Esau | Genesis 25:22-34; 27 | 25:23 "the older will serve the younger"; 25:27 "Esau became a skillful hunter ... while Jacob was a quiet man"; Malachi 1:2-3; Romans 9:13; Hebrews 12:16 ("godless like Esau") | Calvin, 25:27 ("he places on the opposite side the mild disposition of Jacob"); Gill, 25:22 ("an emblem of the future difference between those two children"); Henry, 25:29 (the birthright "was Esau's by providence but Jacob's by promise") (3). Limit: Jacob is also a deceiver; the contrast is God's choice, not Jacob's merit (Romans 9:11). |
| 7 | Leah and Rachel | Genesis 29:16-35; 30:1-2 | 29:17 "Leah had weak eyes, but Rachel was shapely and beautiful"; 29:31 | Henry, 29:31 (God's gift of a child was "a check to Rachel ... and a comfort to Leah"); Calvin, 29:18 (2) |
| 8 | Caleb and Joshua against the ten spies | Numbers 13:30-33; 14:6-10, 24, 36-38 | 14:24 "My servant Caleb has a different spirit"; 14:38 | Gill, 13:31 ("With Caleb, all but Joshua: the other ten said ..."); JFB, 14:24 (2) |
| 9 | Ruth and Orpah | Ruth 1:8-18 | 1:14 "Orpah kissed her mother-in-law goodbye, but Ruth clung to her" | Henry, 1:6 ("Such offences as that of Orpah's revolt must needs come, that those who are perfect and sincere may be made manifest, as Ruth was") (1). Limit: Orpah obeyed Naomi's urging; she is not condemned in the text. |
| 10 | Hannah and Peninnah | 1 Samuel 1:2-7 | 1:2 (a crossing sentence) | Bullinger, both books; Keil and Delitzsch, 1:2 ("the latter of whom was blessed with children, whereas the first was childless") (2) |
| 11 | Hannah and Eli | 1 Samuel 1:9-18 | 1:13 "Eli thought she was drunk" | Henry, 1:9 ("Eli took Hannah for one of these", reproving his rash judgment) (1) |
| 12 | Samuel and Eli's sons | 1 Samuel 2:11-3:1 | The narrator alternates them (2:12, 18, 21, 25-26) | Bullinger (Companion Bible structure of 1 Samuel 1:1-4:1, "Repeated Alternation"); Henry, 2:11 ("the wickedness of Eli's sons made Samuel's early piety appear the more bright"); Keil and Delitzsch, 2:17-18 (quoted in section 6) (3) |
| 13 | Saul and David | 1 Samuel 15:28; 16:13-14; 18:12; 24; 26; 2 Samuel 3:1 | 15:28 the kingdom given "to your neighbor who is better than you"; 16:13-14 the Spirit "rushed upon David" and "departed from Saul"; 18:12 "the LORD was with David but had departed from Saul"; 2 Samuel 3:1 | Bullinger, 2 Samuel 3:1 (both books); Henry, 16:14 ("We have here Saul falling and David rising") (2) |
| 14 | Saul and Jonathan | 1 Samuel 14; 20:30-34 | 14:45 the people rescue Jonathan from his father's oath | Henry, 14:1 ("the bravery and piety of Jonathan, the son of Saul, who was much fitter than the father to wear the crown") (1) |
| 15 | Abigail and Nabal | 1 Samuel 25:2-38 | 25:3 "She was an intelligent and beautiful woman, but her husband ... was harsh and evil" | Henry, 25:2 ("Many an Abigail is tied to a Nabal"); Keil and Delitzsch, 25:3; Gill, 25:3 (3) |
| 16 | David and Uriah | 2 Samuel 11:6-17 | 11:11 Uriah will not go home while the ark and army are in the field | Henry ("he had basely abused so brave a man as Uriah"); Gill, 11:11 ("enough to awaken the conscience of David"); Clarke, 11:11 ("the answer of a brave, generous and disinterested man") (3) |
| 17 | Naaman and Gehazi | 2 Kings 5 | 5:27 "the leprosy of Naaman will cling to you" | Keil and Delitzsch, 5:27 ("the leprosy taken from Naaman on account of his faith in the living God, should pass to Gehazi on account of his departure from the true God"); Clarke, 5:27 ("Thou hast got Naaman's silver, and thou shalt have Naaman's leprosy") (2) |
| 18 | Ahaz and Hezekiah (father and son) | 2 Kings 16 and 18; 2 Chronicles 28:24 and 29:3 | 2 Kings 16:2 "unlike David his father"; 18:3 "just as his father David had done"; Ahaz "shut the doors", Hezekiah "opened ... the doors" | Keil and Delitzsch, 2 Chronicles 29:3 (the opening of the doors is placed first "as a contrast to the closing and devastation of the sanctuary by Ahaz") (1) |
| 19 | Vashti and Esther | Esther 1:10-22; 2:1-17 | 2:17 "made her queen in place of Vashti" | Henry, 2:1 (Esther "might have the praise of obedience in the same instance in which the other incurred the blot of disobedience") (1) |
| 20 | Mordecai and Haman | Esther 3; 5:9-14; 6; 7:10; 8:2 | 6:10; 7:10 "they hanged Haman on the gallows he had prepared for Mordecai" | Henry, 6:1 ("his preferment, and Haman's disappointment"); JFB, 7:10 and 8:2 (2) |
| 21 | Jeremiah and Hananiah | Jeremiah 28 | 28:15 "The LORD did not send you" | Calvin, 28:1 ("Jeremiah and Hananiah were opposed, the one to the other") (1) |
| 22 | Nebuchadnezzar and Belshazzar | Daniel 4 and 5 | 5:22 "But you his son, O Belshazzar, have not humbled your heart, even though you knew all this" | Calvin, 5:17 ("as there was greater pertinacity and obstinacy in King Belshazzar") (1) |
| 23 | Jonah and the pagan sailors (and Nineveh) | Jonah 1:4-16; 3:4-10; 4 | 1:5 "The sailors were afraid, and each cried out to his own god ... But Jonah ... fell into a deep sleep" | JFB, 1:5 ("Guilty Jonah's indifference to fear contrasts with the unoffending mariners' alarm"); Henry, 1:4 (the shipmaster "bade him for shame get up") (2) |
| 24 | Lady Wisdom and the woman Folly | Proverbs 9:1-6 and 9:13-18 | The same invitation word for word: 9:4 and 9:16 "Whoever is simple, let him turn in here!" | Keil and Delitzsch, 9:13 ("he personifies Folly working in opposition to Wisdom ... as the contrast to Wisdom required") (1) |
| 25 | The righteous and the wicked | Psalm 1 | 1:4 "Not so the wicked!"; 1:6 | Henry, 1:1 ("The different character and condition of godly people and wicked people"); Clarke, 1:1 ("The opposite state of the ungodly"); Keil and Delitzsch, 1:4 ("the opposite of a tree planted by the water-courses"); Spurgeon, 1:1 (4) |
| 26 | Zechariah and Mary | Luke 1:18-20, 34-38, 45 | 1:20 "because you did not believe my words"; 1:45 "Blessed is she who has believed" | JFB, 1:34 ("not the unbelief of Zacharias ... Instead of reproof, therefore, her question is answered"); Gill, 1:34 ("she required no sign, as Zacharias did"); Calvin, 1:18 ("the case of Zacharias was widely different from that of ... Mary") (3) |
| 27 | The magi and Herod (and Jerusalem) | Matthew 2:1-16 | 2:2-3 they come to worship; Herod "was disturbed, and all Jerusalem with him" | Henry, 2:1 ("The Jews regarded not Christ, but these Gentiles enquired him out") (1) |
| 28 | Simon the Pharisee and the sinful woman | Luke 7:36-50 | Jesus himself, 7:44-46 ("you did not give Me water for My feet, but she wet My feet with her tears") | Barnes, 7:45 ("How striking the difference between the conduct of Simon and this woman!"); Calvin, 7:44 ("The Lord appears to compare Simon with the woman") (2) |
| 29 | Mary and Martha | Luke 10:38-42; John 11:20; 12:2-3 | Jesus, 10:41-42 ("Mary has chosen the good portion") | JFB, 10:39 (Mary "for her part," "in contrast with Martha") and 10:42 ("Wherein, then, was Mary's better than Martha's?"); Calvin, 10:38 (Martha "despise[d] her sister's pious eagerness to receive instruction"); Bengel, 10:39 (Mary "sitting down close to Him": "The antithetic word is" Martha's "was distracted") (3). Limit: Henry praises Martha for receiving Christ when it was dangerous, and Calvin says Christ "does not mean that every thing else ... is of no importance"; the contrast is about the moment, not two kinds of Christian. |
| 30 | The Samaritan, the priest and the Levite | Luke 10:30-37 | Jesus' parable | Barnes, 10:30 ("a Samaritan ... had shown the kindness of a neighbour, while a priest and a Levite had denied it"); Calvin, 10:30 ("Christ compares a Samaritan to a priest and a Levite") (2) |
| 31 | The prodigal son and the elder brother | Luke 15:11-32 | Jesus' parable, 15:31-32 | Gill, 15:25 ("while the younger son, the publicans and sinners, were received ... the elder son, the Scribe and Pharisee, were without"); Clarke, 15:25 (2) |
| 32 | The rich man and Lazarus | Luke 16:19-31 | 16:25 "you received your good things, while Lazarus received bad things. But now he is comforted here, while you are in agony" | Henry, 16:19 (comparing the two funerals and their "bearers"; his Concise commentary, stored in the app: "the different condition of this godly poor man, and this wicked rich man") (1) |
| 33 | The Pharisee and the tax collector | Luke 18:9-14 | 18:14 "this man, rather than the Pharisee, went home justified" | Henry, 18:9 ("the one a Pharisee, and the other a publican"); JFB, 18:11; Barnes, 18:13 ("The prayer of the publican was totally different from that of the Pharisee"); Calvin, 18:14 ("the publican was accepted by God, while the Pharisee was totally rejected"); Bengel, 18:10 ("A striking sample of both classes"; at 18:11 the Pharisee's way of standing "denotes more than" the word "used of the publican") (5) |
| 34 | The rich ruler and Zacchaeus | Luke 18:18-27 and 19:1-10 | 18:23 "he became very sad, because he was extremely wealthy"; 19:8 "half of my possessions I give to the poor" | Gill, 19:2 (mentioned "because it had been observed in the preceding chapter, how difficult, but not impossible, as this instance proves, it was for rich men to enter into the kingdom") (1) |
| 35 | Mary of Bethany and Judas | John 12:1-8; Matthew 26:6-16; Mark 14:3-11 | John 12:3-6 her costly perfume, his complaint and theft | Henry, 12:1 ("Judas's dislike of Mary's compliment"); Clarke, 12:1 ("Jesus vindicates Mary and reproves Judas") (2) |
| 36 | Peter and Judas | Matthew 26:69-27:10; Luke 22; John 13 | The two accounts stand side by side (Matthew 26:75 and 27:3-5); 2 Corinthians 7:10 gives the principle ("Godly sorrow brings repentance ... but worldly sorrow brings death") without naming them | Henry, Matthew 27:3 ("Judas repented: not like Peter, who repented, believed, and was pardoned"); Gill, 26:75 ("Peter's repentance was not like Cain's, nor Esau's, nor Judas's"); JFB, 2 Corinthians 7:10 ("Contrast ... Peter's, Mt 26:75") (3) |
| 37 | The two criminals | Luke 23:32-43; Matthew 27:38-44 | 23:40-41 one rebukes the other | JFB, 23:43 ("the one in the impenitent thief, the other in his penitent fellow"); Barnes, 23:42; Calvin, 23:41 ("The robber, on the other hand, is not less eager to maintain the innocence of Christ") (3) |
| 38 | Barnabas and Ananias with Sapphira | Acts 4:36-5:11 | 5:1 "also sold a piece of property" | Gill, 5:1 ("the account of him follows upon that of Barnabas, and is opposed to it"); Barnes, 5:1; Henry, 5:1 ("brought the money (as Barnabas did)") (3) |
| 39 | Diotrephes and Demetrius | 3 John 9-12 | 1:11 "do not imitate what is evil, but what is good" | JFB, 1:12 ("in contrast to Diotrephes"); Gill, 1:12 ("This man was of a quite different cast from Diotrephes"); Barnes, 1:11 (3) |
| 40 | Adam and Christ | Romans 5:12-21; 1 Corinthians 15:21-22, 45-49 | Romans 5:19; 1 Corinthians 15:45 ("The first man Adam ... the last Adam") | Bullinger, Romans 5:19 (Antithesis); JFB, Romans 5:15 ("The two cases present points of contrast as well as resemblance"); Barnes, 5:12 ("The work of Christ has an opposite tendency"); Calvin, 5:12 ("comparing with it what is of an opposite character"); Clarke, 5:12 (5) |
| 41 | Moses and Christ (servant and Son) | Hebrews 3:1-6; John 1:17 | Hebrews 3:5-6 "Moses was faithful as a servant ... But Christ is faithful as the Son" | Scripture itself; writers not counted |
| 42 | The two sons | Matthew 21:28-32 | Jesus' parable, 21:31 | Henry and Calvin comment; not counted |
| 43 | The wise and foolish builders | Matthew 7:24-27; Luke 6:47-49 | Jesus' parable | Not counted |
| 44 | The wise and foolish virgins | Matthew 25:1-13 | Jesus' parable, 25:2 | Gill comments; not counted |
| 45 | Judah and Joseph (Genesis 38 and 39 side by side) | Genesis 38; 39:7-12 | Not stated | Not found, searched again in this pass. Keil and Delitzsch explain Genesis 38's place differently (the danger of the sons "forgetting the sacred vocation" of their race), Calvin by the line of the Redeemer. Hold back. |
| 46 | Rahab and Achan | Joshua 2; 6:22-25; 7 | Not stated | Not found among the writers searched. Hold back until a writer is found (Woudstra, on the cite list, wrote on Joshua and should be checked). |
| 47 | Gideon and Abimelech (father and son) | Judges 8:22-35; 9 | 8:23 "I will not rule over you"; 9:6 "make Abimelech their king" | Not found as a contrast; JFB praises Gideon's refusal (8:22) without naming Abimelech. Hold back. |
| 48 | Jael and Sisera's mother | Judges 5:24-30 | The song sets them back to back | JFB, 5:28, notes "a sudden transition is made to the mother of the Canaanite general" but draws no contrast. Hold back. |
| 49 | Elijah and the prophets of Baal | 1 Kings 18:20-40 | 18:21 "If the LORD is God, follow Him. But if Baal is God, follow him" | A contest rather than a character foil; JFB describes the two altars. Optional. |
| 50 | Nicodemus and the Samaritan woman (John 3 and 4) | John 3:1-21; 4:1-42 | Night visitor and noon visitor are neighbours in the text | Not found among the writers searched (none names Nicodemus in John 4); a modern reading. Hold back. |

**Totals.** 50 pairs and sets listed. Rows 1 to 40 each have at least one cite-list writer whose words were read today: 17 rows have three or more (widely agreed: rows 1, 2, 4, 5, 6, 12, 15, 16, 25, 26, 29, 33, 36, 37, 38, 39, 40), 11 have two (commonly held: 7, 8, 10, 13, 17, 20, 23, 28, 30, 31, 35), and 12 have one (some interpreters: 3, 9, 11, 14, 18, 19, 21, 22, 24, 27, 32, 34). In 18 rows Scripture states the contrast beyond the narrator's own "but": God's words (row 8), a prophet in the scene (13, 22), Jesus' words and parables (28 to 33, 42 to 44), or a later book (1, 4, 5, 6, 40, 41). Rows 41 to 44 rest on Scripture alone; rows 45 to 48 and 50 are held back as unverified; row 49 is optional.

Every pair the founder named is in: Cain and Abel (6), Jacob and Esau (3), Hannah and Peninnah (2), Samuel and Eli's sons (3), Saul and David (2), Mary and Martha (3), the Pharisee and the tax collector (5), Judas and Peter (3).

**Honest limits.**

1. A foil is a reading of a story, and older writers usually draw it in passing rather than as a rule. Count only writers who state the contrast in their own sentence.
2. Some popular foils treat one character as simply bad (Lot, Orpah, Martha, Esau before Hebrews 12). Where Scripture is kinder (2 Peter 2:7-8 on Lot), the note must say so.
3. Juxtaposition by neighbouring chapters (Genesis 38 and 39; John 3 and 4) is the easiest kind to over-read. Ask for a writer.
4. Where the New Testament itself draws the contrast, cite that verse first; it is the strongest evidence the app has.
5. Saul and David is the founder's own example and is plainly in the text four times, yet only two cite-list writers were found saying it in a sentence of their own. The Pulpit Commentary, Ellicott and the church fathers were not searched verse by verse for this pair (no local text); they are the next place to look.

**For the app.** This fits the map well: a pair is two places in the text joined by a contrast, which the arc map can draw as a single arc in a quieter colour than a cross-reference (the code-fit study's `foil` link kind). A card under each verse ("Set beside: Abel") with one plain sentence at Simple, the two passages side by side at Study (the Parallels panel's two-column `Compare` view), and writers at Deep.

---

## 8. Anthropomorphism and anthropopathism

**Plain definition.** The Bible speaks of God in human terms so that people can understand Him. *Anthropomorphism* gives God a body: an arm, eyes, ears, a face, a hand. *Anthropopathism* gives God human feelings or actions: He regrets, grieves, comes down to see, smells a sacrifice, laughs, wakes from sleep. The words are true descriptions of God given in our language, not claims that God is a man (Numbers 23:19; John 4:24).

Bullinger, "Anthropopatheia; or, Condescension": "the ascription of human passions, actions, or attributes to God". He adds that the Greeks called it *Syncatabasis*, because "God, by using this figure, condescends to the ignorance and infirmity of man", and the Latins *Condescensio*. On feelings he writes: "not that He has such feelings; but, in infinite condescension, He is thus spoken of in order to enable us to comprehend Him." Under the same heading he lists God's soul, face, eyes, ears, nostrils, mouth, voice, arm, hand, right hand, finger, heart, bowels, bosom and feet; His rejoicing, grief, repentance, anger, jealousy, zeal and pity; His "knowing", "not knowing" and forgetting; and animals, plants and things used as pictures of God (roaring, wings and feathers, a horn, wind and breath). Calvin, on Genesis 6:6 (Bible Hub): "This figure, which represents God as transferring to himself what is peculiar to human nature, is called anthropopatheia." Keach and De Laune (*Tropologia*, 1681, candidate) give a whole chapter to "Metaphors translated from Man to God"; of God's arm they write that "an Arm is attributed to God, by which we are to denote his Strength and Power".

### Forms

| Form | Examples (all in Bullinger's list) |
|---|---|
| A body | Arm (Exodus 6:6; Isaiah 53:1; 59:1), eyes (2 Chronicles 16:9), ears (Isaiah 59:1), right hand (Exodus 15:6), finger (Psalm 8:3) |
| Feelings | Regret and grief (Genesis 6:6), jealousy (Exodus 20:5; Joel 2:18), rejoicing (Isaiah 62:5), laughter (Psalm 2:4) |
| Actions | Coming down to see (Genesis 18:21; Genesis 11:5 is the same picture, though not in his list), smelling (Genesis 8:21), waking "as from sleep" (Psalm 78:65), asking questions (Genesis 3:9), "for now I know" (Genesis 22:12) |
| Animal pictures | Roaring like a lion (Hosea 11:10), wings and feathers (Psalm 91:4) |

### Examples

| Reference | BSB words | Named on this verse by |
|---|---|---|
| Genesis 6:6 | "And the LORD regretted that He had made man on the earth, and He was grieved in His heart." | Bullinger (book and Companion Bible: "repented. the Figure of speech Anthropopatheia"); Henry ("These are expressions after the manner of men, and must be understood so as not to reflect upon the honour of God's immutability"); Keil and Delitzsch ("The repentance of God is an anthropomorphic expression for the pain of the divine love at the sin of man"); Gill ("speaking by an anthropopathy, after the manner of men"); Calvin ("The repentance which is here ascribed to God does not properly belong to him, but has reference to our understanding of him"); Wesley ("These are expressions after the manner of men, and must be understood so as not to reflect upon God's immutability or felicity"); Benson ("spoken of God after the manner of men, by the same figure of speech whereby eyes, ears, hands, and feet are ascribed to God") (7). Candidate: Keach and De Laune. |
| 1 Samuel 15:11 with 15:29 | 15:11 "I regret that I have made Saul king"; 15:29 "the Glory of Israel does not lie or change His mind, for He is not a man, that He should change His mind." | Keil and Delitzsch, 15:29 ("These words are spoken ... (theomorphically), whereas in 1Sa 15:11 and other passages, which speak of God as repenting, the words are to be understood ... (anthropomorphically; cf. Num 23:19)", the dots marking Greek words left out); Gill, 15:11 ("spoken after the manner of men"); Wesley, 15:11 (repentance "is ascribed to God when God alters his method of dealing"); Henry's Concise ("Repentance in God is not a change of mind, as it is in us, but a change of method") (4). The chapter itself supplies the key: the same word for "regret" stands in 15:11, 15:29 and 15:35. The app's unreviewed hard-verse card `god-relents` asks this very question. |
| Exodus 32:14 | "So the LORD relented from the calamity He had threatened to bring on His people." | Bullinger (under "Repentance is attributed to God"); Clarke ("spoken merely after the manner of men"); Keil and Delitzsch ("an anthropopathic description of the pain which is caused to the love of God"); Gill ("repentance is ascribed to God, though, properly speaking, it does not belong to him"); Henry, 32:7; JFB, 32:7 ("language borrowed from human passions and feelings") (6) |
| Jonah 3:10 | "He relented from the disaster He had threatened to bring upon them." | JFB ("in condescension to human conceptions, represented as a change in God ... who ... changeth not"); Gill ("spoken after the manner of men"); Calvin ("the Scripture accommodates itself to the grossness of our understanding") (3) |
| Genesis 11:5 | "Then the LORD came down to see the city and the tower" | Henry ("It is an expression after the manner of men"); Keil and Delitzsch ("an anthropomorphic description of God's interposition in the actions of men"); Gill ("spoken after the manner of men"); Wesley ("'Tis an expression after the manner of men") (4) |
| Genesis 18:21 | "I will go down to see if their actions fully justify the outcry that has reached Me." | Bullinger; JFB ("language used after the manner of men"); Gill ("this is spoken after the manner of men"); Calvin ("Moses introduces Him as speaking according to the manner of men"); Wesley ("he is pleased thus to express himself after the manner of men") (5). Henry says the same of 18:17. |
| Psalm 2:4 | "The One enthroned in heaven laughs; the Lord taunts them." | Bullinger; JFB ("By a figure whose boldness is only allowable to an inspired writer"); Clarke ("Words spoken after the manner of men"); Gill ("Laughing is ascribed unto him, according to the language of men ... by an anthropopathy") (4) |
| Genesis 8:21 | "When the LORD smelled the pleasing aroma" | Bullinger; Calvin ("Moses here, according to his manner, invests God with a human character for the purpose of accommodating himself to the capacity of an ignorant people") (2) |
| Exodus 6:6 | "I will redeem you with an outstretched arm and with mighty acts of judgment." | Bullinger; Wesley ("a metaphor taken from a man that stretches out his arm") (2) |
| Isaiah 53:1 | "And to whom has the arm of the LORD been revealed?" | Bullinger; JFB ("arm-- power") (2). Keach and De Laune (candidate) note that some take "the Arm of the Lord" here "(and not improperly)" as the Messiah himself; see limit 3. |
| Genesis 22:12 | "for now I know that you fear God" | Bullinger ("God, of course, knew it already; but, in wondrous condescension, He stoops to make Abraham understand") (1) |
| Exodus 15:6 | "Your right hand, O LORD, is majestic in power" | Bullinger ("A Right Hand is attributed to God") (1) |
| 2 Chronicles 16:9 | "For the eyes of the LORD roam to and fro over all the earth" | Bullinger (eyes "used of God's grace and favour") (1) |
| Psalm 8:3 | "Your heavens, the work of Your fingers" | Bullinger (book and Companion Bible) (1) |
| Psalm 44:23 | "Wake up, O Lord! Why are You sleeping?" | Henry ("The expression is figurative"); Clarke ("always to be figuratively understood") (2). Set beside Psalm 121:4, "the Protector of Israel will neither slumber nor sleep". Bullinger lists the companion verse, Psalm 78:65, "the Lord awoke as from sleep". |

### How often, and where

- Bullinger's Anthropopatheia section cites 779 distinct verses (998 links): Psalms 166, Isaiah 92, Exodus 42, Ezekiel 36, Jeremiah 36, Genesis 35, Deuteronomy 33. By section: Law 134, history 45, poetry 189, prophets 223, Gospels 68, Acts 11, letters 93, Revelation 16. It is the device of the Psalms and the Prophets.
- The Companion Bible margin tags it on 235 verses, 81 of them in Psalms.
- Nave's Topical Bible (already pinned, `BradyStephenson/bible-data @ 720a8da6d2`) has a subject ANTHROPOMORPHISMS, defined as "Figures of speech, which attribute human forms, acts, and affections to God", with more than 60 passages under sub-headings such as Walking, Resting, Laughing, Sleeping and Grieved (code-fit study). It is hidden on the Themes tab today. Nave is a reference, not an interpreter, so it can seed a list but cannot carry a note alone.
- Commentators: the word family ("anthropomorphic", "anthropopathic", "after the manner of men", "accommodat-", "condescen-", "ascribed to God") appears in 402 comments: Calvin 133, Gill 118, Keil and Delitzsch 43, Clarke 34, Henry 32, JFB 17, Spurgeon 14, Barnes 11. "After the manner of men" is the older writers' usual phrase (197 comment lines: Gill 69, Calvin 56, Clarke 28, Henry 17, Keil and Delitzsch 9, Barnes 7, Spurgeon 6, JFB 5). Wesley, stored in the app, uses it in 34 notes. The Greek-based words are almost only Keil and Delitzsch's: "anthropomorph-" in 67 lines (Keil and Delitzsch 63) and "anthropopath-" in 50 (Keil and Delitzsch 36, Gill 11). These line counts are not deduplicated.

### Honest limits (where believing readers differ)

1. **Are God's feelings real or only a manner of speaking?** Calvin, Gill and Bullinger say repentance "does not properly belong to him"; Henry's Concise calls it "a change of method". Keil and Delitzsch say it expresses something real, "the pain of the divine love". Both are believing positions; the app should say "Scripture speaks of God in human terms" and let the Deep line show both. The Bible's own anchors are 1 Samuel 15:29, Numbers 23:19 and Malachi 3:6.
2. **Not every human picture of God is a figure.** Keil and Delitzsch on Genesis 3:8 (God "walking in the garden"): "This human mode of intercourse between man and God is not a mere figure of speech, but a reality". Scenes where God appears in visible form (Genesis 18, where the LORD comes to Abraham's tent with two others; "the angel" of Exodus 23:20, of whom Bullinger himself writes "doubtless Christ is meant") are appearances, not figures of speech. Do not label them anthropomorphism.
3. **Christ is not an anthropomorphism.** Bullinger puts "A Body is used of Christ" and "The Head is spoken of Christ" under this figure. The Incarnation is literal: the Son truly took a human body. The app must not file Christ's body, hands or face under this device, and where "the arm of the LORD" is read of the Messiah (Isaiah 53:1, as some do), the note should say so rather than call the arm a figure only.
4. **Taking the pictures literally was rejected long ago.** The *Catholic Encyclopedia* ("Anthropomorphism, Anthropomorphites", James Fox, 1907, newadvent.org/cathen/01558c.htm, read today) records a fourth-century sect in Syria, the Audians, who took Genesis 1:27 literally and held that God has a human form; "The Fathers who wrote against it dismiss it almost contemptuously", and Cyril of Alexandria later refuted Egyptian monks who held it. That is a reason to explain the figure, gently, at Simple. (Origen argued the same point at length, but the early church condemned him; do not cite him.)

### For the app

High value and low risk when worded carefully: "God speaks of Himself in human terms so that we can understand Him" at Simple; the paired verses (15:11 with 15:29) at Study; the writers, including Keil and Delitzsch's dissent, at Deep. Bullinger's 779 verses and Nave's subject give a ready seed list, each still needing a second writer for anything above "some interpreters". Wesley is the easiest second writer to check by build, because his notes are already pinned and stored. The code-fit study puts these in a `figure` Layers kind with `figure: anthropomorphism` or `anthropopathism`.

---

## 9. Personification and apostrophe

**Plain definition.** *Personification* speaks of a thing, a place or an idea as if it were a person: blood cries out, rivers clap their hands, sin reigns, wisdom calls in the street. *Apostrophe* turns aside to speak to someone or something not present, or not able to hear: "Listen, O heavens"; "Where, O Death, is your victory?"

Bullinger, "Prosopopoeia; or, Personification": "A figure by which things are represented or spoken of as persons". He sorts it into six groups: parts of the body, animals, plants, lifeless things, countries and cities (a people as a woman, cities as daughters), and human actions given to things. His "Apostrophe" covers words addressed to God, to people living or dead, to animals, and to lifeless things.

### Examples

| Reference | BSB words | Named by |
|---|---|---|
| Genesis 4:10 | "The voice of your brother's blood cries out to Me from the ground." | Bullinger; Wesley ("He speaks as if the blood itself were both witness and prosecutor") (2) |
| Psalm 85:10 | "Loving devotion and faithfulness have joined together; righteousness and peace have kissed." | Bullinger (1) |
| Isaiah 55:12 | "the mountains and hills will burst into song before you, and all the trees of the field will clap their hands." | Bullinger; Clarke ("highly poetical images"); Gill ("strong figures"); Keil and Delitzsch (the figure "transfers" to Psalm 98:8); Wesley ("even the senseless creatures shall seem to rejoice with you") (5) |
| Psalm 98:8 | "Let the rivers clap their hands, let the mountains sing together for joy" | Bullinger, Companion Bible (Prosopopoeia; the book does not list this verse); Gill ("a prosopopoeia"); Calvin ("feeling is ascribed to things inanimate") (3). Caution: on Bible Hub the line "a most beautiful prosopopoeia" on this verse is footnote 113 by Calvin's 1840s translator, not Calvin. |
| Habakkuk 2:11 | "For the stones will cry out from the wall" | JFB ("personification"); Calvin ("a new personification ... He now ascribes speech to stones and wood"); Wesley ("As if it had a voice") (3) |
| 1 Corinthians 13:4 | "Love is patient, love is kind." | Bullinger ("Human actions are attributed to charity"); Gill ("represents it as if it was a person") (2) |
| James 1:15 | "after desire has conceived, it gives birth to sin; and sin, when it is full-grown, gives birth to death." | Bullinger; Gill (2) |
| Romans 8:22 | "the whole creation has been groaning together in the pains of childbirth" | Henry ("It is a figurative expression") (1) |
| Job 28:22 | "Abaddon and Death say, 'We have heard a rumor about it.'" | Bullinger; Wesley ("by a common figure") (2) |
| Leviticus 18:25 | "the land will vomit out its inhabitants" | Bullinger (1) |
| Apostrophe: Isaiah 1:2 | "Listen, O heavens, and give ear, O earth" | Bullinger; Clarke ("by an apostrophe, sets the personification in a much stronger light"); Calvin (3). Candidate: Keach and De Laune ("What a lamenting Prosopopoeia does the Lord use by the Prophet"). |
| Apostrophe: Psalm 114:5 | "Why was it, O sea, that you fled, O Jordan, that you turned back" | Bullinger; Clarke ("the prosopopoeia, or personification very fine"); Spurgeon ("They are apostrophised and questioned") (3) |
| Apostrophe: 1 Corinthians 15:55 | "Where, O Death, is your victory? Where, O Death, is your sting?" | Clarke ("Both Death and Hades are here personified"); Barnes ("death personified") (2) |

### How often, and where

- Bullinger's Prosopopoeia cites 198 verses (Psalms 29, Isaiah 28, Jeremiah 15, Job 15, Genesis 12, Lamentations 7): prophets 75, poetry 46, Law 31, letters 19. His Apostrophe cites 52 (Psalms 17).
- Companion Bible margin: Prosopopoeia on 67 verses (Psalms 12, Job 11); Apostrophe about 22 to 35 (the OCR spellings make the count uncertain).
- Commentators: "personif-"/"prosopop-" in 333 comments (Keil and Delitzsch 106, JFB 80, Clarke 75, Calvin 27, Gill 19, Barnes 18); "apostroph-" in 73 (Gill 25, Keil and Delitzsch 17). unfoldingWord tags personification 133 times and apostrophe 27 times in Psalms.

### Honest limits

**Wisdom in Proverbs 8 is the one place where calling it personification takes a side.**

- Henry, Proverbs 8:22: "Wisdom here has personal properties and actions; and that intelligent divine person can be no other than the Son of God himself". Gill, 8:1: "Christ, who is the Wisdom of God".
- Clarke, 8:1: "Here wisdom is again personified; but the prosopopoeia is carried on to a greater length than before". JFB, 8:1, gives both: "Many regard the passage as a description of the Son of God ... But the passage may be taken as a personification of wisdom".
- Keil and Delitzsch, 8:22: the poet "personifies" wisdom and "does not speak of the person as Logos", but "the further progress of the revelation points to her actual personification".
- Gill on 8:22 notes that the Greek and the Targum read "created me", and that Arius, "following" that version, "gave birth to his pernicious doctrine" that Christ is a creature; Arius is the clearest case of a writer the early church condemned. The BSB itself reads "The LORD created me". The app should never present the Arian reading, and should present "a personification of God's wisdom" and "Christ, the Wisdom of God" (1 Corinthians 1:24, 30) as two believing readings, each with its writers. Nave's PERSONIFICATION subject lists wisdom in Proverbs 1, 8 and 9, which shows how ordinary the first reading is in older reference works.

Smaller limit: Bullinger sometimes moves a verse from one figure to another (Genesis 4:7, "sin is crouching at your door", he reads as a sin-offering lying at the door, not personified sin). Keep to the readings that two writers share.

---

## 10. Merism

**Plain definition.** Naming two opposite ends to mean everything between them: "the heavens and the earth" for the whole universe, "when I sit and when I rise" for all of life, "small and great" for everyone.

**Bullinger's names.** He has no figure called merism in this sense. His "Merismos; or, Distribution" is a different figure ("An Enumeration of the Parts of a Whole which has been mentioned", as in Galatians 5:19-23). The modern merism falls under his Synecdoche ("To Sit Down and Rise Up is used for all the ordinary acts of life which come between them", on Psalm 139:2; "To GO OUT and COME IN is used of official actions or of life in general", on Psalm 121:8; "Evening and Morning are put for the full day", on Genesis 1:5) and his Syntheton ("Small and great", Psalm 115:13, where "much more is meant than is expressed"). The app should not attach the label "Merismos" to these verses.

### Examples

| Reference | BSB words | Named by |
|---|---|---|
| Genesis 1:1 | "God created the heavens and the earth." | Keil and Delitzsch: the expression "is frequently employed to denote the world, or universe, for which there was no single word in the Hebrew language; the universe consisting of a twofold whole" (1) |
| Psalm 139:2 | "You know when I sit and when I rise" | Bullinger (Synecdoche); Keil and Delitzsch ("sitting down, rising up, walking and lying, are the sum of human conditions or states") (2) |
| Psalm 121:8 | "The LORD will watch over your coming and going, both now and forevermore." | Bullinger (Synecdoche); Clarke ("in all thy business and undertakings; and this through the whole course of thy life"); Keil and Delitzsch ("i.e., all thy business and intercourse of life"); Henry ("He will keep us in all our ways") (4) |
| Deuteronomy 6:7 | "when you sit at home and when you walk along the road, when you lie down and when you get up." | Keil and Delitzsch ("i.e., everywhere and at all times") (1) |
| Psalm 115:13 | "He will bless those who fear the LORD" ... "small and great alike." | Bullinger (Syntheton); Gill ("young and old, rich and poor, high and low") (2) |
| Psalm 113:3 | "From where the sun rises to where it sets, the name of the LORD is praised." | Keil and Delitzsch (praise "fills all time and all space") (1) |
| Revelation 22:13 (and 1:8) | "I am the Alpha and the Omega, the First and the Last, the Beginning and the End." | Barnes, 1:8 ("he is the beginning and the end of all things") (1) |
| Joshua 6:21 | "man and woman, young and old, oxen, sheep, and donkeys" | JFB, 6:20 ("everything animate and inanimate") (1) |

### How often, and where

- The word "merism" (as "merismus") occurs once in the eight commentaries (Keil and Delitzsch on Proverbs 26:3, reporting another scholar, and meaning Bullinger's sense). The idea is common; the name is a 20th-century coinage, so no catalogue of 1930 or earlier uses it.
- unfoldingWord's Translation Notes, a modern believing source (section 18), do use the name: 58 merism tags in Psalms alone, each keyed to the Hebrew words.
- Merisms cluster in the Psalms, the Law (Deuteronomy 6:7 and its echo 11:19) and in summary phrases ("from Dan to Beersheba", "small and great").

### Honest limits

The label is modern and is not found among the cite-list writers; the reading ("the two ends mean the whole") is found and is safe. Show the reading in plain words ("all of life, from sitting down to rising up") and name the device only at Deep, with Bullinger's Synecdoche as the old name. If the founder wants the modern word on screen, unfoldingWord is the one believing source found that uses it, and it is not on the cite list yet.

---

## 11. Hyperbole

**Plain definition.** Saying more than is literally meant, on purpose, so the point lands: walls "up to the heavens", a bed "flooded" with tears, a world too small for the books about Jesus.

Bullinger, "Hyperbole; or, Exaggeration": "When more is said than is literally meant ... in order to heighten the sense." Keach and De Laune (candidate) open their chapter with a warning worth keeping: we are not to deny a hyperbole in Scripture on the pretext "that it is a kind of Lye".

### Examples

| Reference | BSB words | Named by |
|---|---|---|
| Deuteronomy 1:28 | "the cities are large, with walls up to the heavens." | Bullinger; Henry ("an hyperbole which they made use of to serve their ill purpose"); Gill ("an hyperbolical expression; their fears exaggerated") (3). Keil and Delitzsch disagree: "not an exaggeration, but ... a rhetorical description of the impression actually received". |
| Psalm 6:6 | "all night I flood my bed with weeping and drench my couch with tears." | Bullinger; Gill ("hyperbolical phrases ... not to be literally understood"); JFB ("By a strong figure") (3) |
| 1 Kings 1:40 | "rejoicing with such a great joy that the earth was split by the sound." | Bullinger; Gill ("an hyperbolical expression") (2) |
| Judges 20:16 | "each of whom could sling a stone at a hair without missing." | Bullinger (1) |
| Matthew 5:29 | "If your right eye causes you to sin, gouge it out and throw it away." | Bullinger; Gill ("not to be understood literally"); Calvin ("Christ employs an exaggerated form of speech"); Wesley ("As if he had said, Part with any thing, however dear to you") (4). Bullinger also offers his Hypocatastasis as a better account. |
| Luke 14:26 | "If anyone comes to Me and does not hate his father and mother ... he cannot be My disciple." | Bullinger ("does not esteem them less than me"); Henry ("he must comparatively hate them, must love them less than Christ"); Barnes ("We are not at liberty literally to hate our parents"); Wesley ("Comparatively to Christ") (4) |
| Galatians 4:15 | "you would have torn out your eyes and given them to me." | Bullinger; JFB ("a proverbial phrase for the greatest self-sacrifice"); Clarke ("a proverbial expression") (3) |
| John 21:25 | "not even the world itself would have space for the books that would be written." | Bullinger; Henry ("It is a hyperbole common enough and justifiable"); Clarke; Barnes ("This is evidently the figure of speech called a hyperbole"); Calvin ("nor ought we to think that the hyperbole is absurd"); Wesley ("This expression, which softens the hyperbole", of John's "I suppose") (6). JFB disagrees: "not a mere hyperbolical expression". Gill allows both. |
| Genesis 22:17 | "like the stars in the sky and the sand on the seashore." | Bullinger (sand and dust "constantly used to express a vast number") (1) |
| Matthew 19:24 | "it is easier for a camel to pass through the eye of a needle than for a rich man to enter the kingdom of God." | Bullinger files it under Paroemia (proverb), not Hyperbole; Henry ("a proverbial expression, denoting a difficulty altogether unconquerable by the art and power of man"); Gill ("this proverbial way"); Wesley ("a proverbial expression"); Ellicott ("the apparent hyperbole of the words") (4 writers, but 3 of them call it a proverb). Show it as a proverb of impossibility that works by overstatement. |
| Matthew 23:24 | "You strain out a gnat but swallow a camel." | Calvin ("a proverbial saying") (1) |

### How often, and where

Bullinger cites 121 verses (Isaiah 10, Jeremiah 9, Matthew 8, Genesis 7, Job 7, Psalms 7, Luke 6): prophets 35, history 24, Gospels 21, poetry 16, letters 12, Law 11. Companion Bible margin: 13 verses. Commentators: "hyperbol-" in 227 comments (Gill 75, Calvin 61, Keil and Delitzsch 34, Henry 15, Clarke 15, Spurgeon 14, Barnes 7, JFB 6); Psalms 29, Jeremiah 20, Job 12, Isaiah 11, Matthew 11. Wesley uses the word 9 times.

### Honest limits

1. **Calling a verse hyperbole can sound like "not true".** Bullinger's own introduction warns against this: figures give "additional force, more life, intensified feeling, and greater emphasis", and the cry "Oh, that is figurative" wrongly implies that the meaning is weakened. The app's wording should follow him: "a deliberate overstatement that drives the point home".
2. **Writers disagree on particular verses** (Deuteronomy 1:28, John 21:25 above), and on whether a saying is hyperbole or proverb (Matthew 19:24). Show both when they do.
3. **The "needle gate".** The story of a small Jerusalem gate called "the eye of the needle" is found, but only as a report: Henry on Mark 10:25 says "Some imagine" such a "wicket-gate", alongside a guess that "camel" means a rope; Ellicott says attention was "first called" to the gate in Lord Nugent's *Lands, Classical and Sacred*, a travel book, and that the idea "is not, however, necessary". Neither adopts it, and Jesus' next words settle the sense ("With man this is impossible", Matthew 19:26). The app should not tell the gate story as fact.
4. **Keep this device away from the Bible's numbers.** Large numbers in Numbers, Judges or Chronicles are a separate question; none of the writers checked calls them hyperbole, and the app should not either.

---

## 12. Metaphor, simile and their relatives

**Plain definitions.**

- **Simile:** one thing is *like* another. "As the deer pants for streams of water, so my soul longs after You."
- **Metaphor:** one thing *is* another. "The LORD is my shepherd." "I am the vine."
- **Hypocatastasis** (Bullinger's term): the comparison is only implied; the picture word stands alone. "Beware of the leaven of the Pharisees"; "dogs surround me".
- **Allegory:** a metaphor carried through a whole passage (Bullinger, "Continued Metaphor and Hypocatastasis"); **parable:** a simile carried through a story (Bullinger, "Continued Simile").

Bullinger: Simile is "A Declaration that one Thing resembles another"; Metaphor "that one Thing is (or represents) another"; Hypocatastasis "implies the Resemblance or Representation". Keach and De Laune (candidate) built a whole book on this device: Books II and III of *Tropologia* expound hundreds of the Bible's metaphors one by one, from the arm of God to Christ the cornerstone.

### Examples

| Kind | Reference | BSB words | Named by |
|---|---|---|---|
| Metaphor | Psalm 23:1 | "The LORD is my shepherd; I shall not want." | Bullinger; JFB ("Under a metaphor borrowed from scenes of pastoral life"); Henry ("stripped of its metaphor" in v. 3); Calvin ("Under the similitude of a shepherd") (4) |
| Metaphor | John 15:5 | "I am the vine and you are the branches." | Bullinger; Henry ("under the similitude of a vine"); JFB ("a figure familiar to Jewish ears"); Clarke ("Following the metaphor of our Lord") (4) |
| Metaphor | Matthew 5:13 | "You are the salt of the earth." | Bullinger; Henry; Gill ("compared to 'salt'"); Calvin ("Our Lord skillfully pursues his metaphor") (4) |
| Metaphor | Isaiah 40:6 | "All flesh is like grass, and all its glory like the flowers of the field." | Bullinger; Keil and Delitzsch ("The comparison instituted with grass and flower") (2) |
| Metaphor | Deuteronomy 6:7 | "And you shall teach them diligently to your children" (Hebrew "sharpen them") | Wesley ("Heb. whet, or sharpen them ... This metaphor signifies the manner of instructing them") (1). The BSB's "diligently" hides the picture. |
| Simile | Psalm 1:3-4 | "He is like a tree planted by streams of water ... Not so the wicked! For they are like chaff driven off by the wind." | Bullinger; Gill ("comparable to a 'tree'"); Clarke ("under the metaphor of chaff") (3) |
| Simile | Psalm 42:1 | "As the deer pants for streams of water, so my soul longs after You, O God." | Bullinger; Henry ("He compares it to the panting of a hart"); Calvin ("The similitude which he takes from a hart"); Gill (4) |
| Simile | Isaiah 53:6-7 | "We all like sheep have gone astray" ... "He was led like a lamb to the slaughter" | Bullinger lists 53:7 under Simile; Gill on 53:6 ("compares to 'sheep'") (2 across the two verses) |
| Simile | Hosea 6:4 | "your loyalty is like a morning mist, like the early dew that vanishes." | Henry; Keil and Delitzsch ("a figurative representation of that which is evanescent") (2) |
| Hypocatastasis | Matthew 16:6 | "Beware of the leaven of the Pharisees and Sadducees." | Bullinger; Henry ("under a similitude"); Calvin ("the metaphor of leaven"); Gill (4) |
| Hypocatastasis | Psalm 22:16 | "For dogs surround me" | Bullinger; Keil and Delitzsch ("figuratively descriptive of character"); Gill (3) |
| Hypocatastasis | Acts 20:29 | "savage wolves will come in among you" | Bullinger; Barnes ("The term wolves is used to denote ... false ... teachers"); Gill (3) |

### How often, and where

Bullinger: Simile 83 verses (Psalms 16, Isaiah 12, Romans 8, Matthew 8, John 7); Metaphor 46 (John 7, Matthew 7); Hypocatastasis 14 (Matthew 8); Allegory 29 (Matthew 7, Galatians 4); Parable 17. These are samples: comparison runs through nearly every page of poetry and prophecy. Companion Bible margin: Metaphor 23 verses, Hypocatastasis 20, Simile 11. Commentators: "metaphor" in 1,590 comments (Calvin 707, Clarke 331, Gill 256), mostly Isaiah 229, Psalms 175, Jeremiah 174; "simile/similitude" in 1,017; "allegor-" in 440. Wesley uses "metaphor" in 76 notes. unfoldingWord tags metaphor 1,182 times and simile 168 times in Psalms alone.

### Honest limits

1. **"This is My body" (Matthew 26:26).** Bullinger lists it under Metaphor, and the Protestant writers read today agree in substance: Henry ("The body of Christ is signified and represented by bread"), Barnes ("This represents my body"), Clarke ("the sign, and the thing signified"). Calvin's comment on the same verse argues against the Catholic teaching by name. Catholic and Orthodox writers, whom the founder's rule allows, understand these words of the Lord's Supper differently. The app must not label this verse (or John 6:51-58) as "a metaphor" in its own voice. If shown at all, show "Christians understand these words differently" with writers from each side, and never the polemical language of the older writers.
2. **Bullinger's "metaphor" is narrow.** He keeps the word for "A is B" and files implied pictures under Hypocatastasis and Allegory, so a reader who sees "dogs surround me" called "hypocatastasis" and "the LORD is my shepherd" called "metaphor" will think the app inconsistent. Use "picture" or "comparison" in plain English at Simple and Study, and Bullinger's term only at Deep.
3. **"I am" sayings in John are metaphors about a real person,** and they sit next to "I am" sayings that claim the divine name (John 8:58). Keep the device note to the picture (bread, light, door, vine), not the name.
4. **Allegory is a figure in the text, and also a way some readers read texts.** Paul's "These things serve as illustrations" (Galatians 4:24) is in the text. Reading the Song of Songs of Christ and the church is a long Christian tradition (Gill on 1:1 takes the Solomon of the title as "Christ, of whom Solomon was a type"; Henry on 1:1 defends "the spiritual exposition of this book"), but it is a reading; Clarke on 1:1 says "the Song most certainly celebrates a marriage". Keep the device label for figures the text itself signals.

---

## 13. Irony and sarcasm

**Plain definition.** Saying the opposite of what is meant, so that the listener sees the folly of their position. Sarcasm is irony with an edge. (Dramatic or situational irony, where events turn back on someone, as with Haman's gallows, is covered by the Layers "irony" kind and by section 7.)

Bullinger, "Eironeia; or, Irony": 75 verses, from Genesis 3:22 to 2 Corinthians 13:5. Keach and De Laune (candidate) give it a chapter of its own and call Amos 4:4 "an Ironical and Sarcastick exhortation".

### Examples

| Reference | BSB words | Named by |
|---|---|---|
| 1 Kings 18:27 | "Shout louder, for he is a god! Perhaps he is deep in thought, or occupied, or on a journey." | Bullinger; JFB ("the severest irony"); Clarke; Gill ("he jeered and bantered them"); Henry (5) |
| Job 12:2 | "Truly then you are the people with whom wisdom itself will die!" | Bullinger; JFB ("Ironical"); Clarke ("This is a strong irony"); Keil and Delitzsch ("intended as irony"); Gill (5) |
| 1 Corinthians 4:8 | "Already you have all you want. Already you have become rich. Without us, you have become kings." | Bullinger; Henry ("a very smart irony"); JFB ("Irony"); Clarke ("a strong irony"); Barnes ("It is generally agreed that this is spoken in irony"); Gill ("an ironical concession"); Calvin ("he now also ridicules it by way of irony") (7) |
| Amos 4:4 | "Go to Bethel and transgress; rebel even more at Gilgal!" | Bullinger; Henry ("It is spoken ironically"); Clarke; Keil and Delitzsch ("In bitter irony"); Gill; Calvin; Wesley ("A strong irony, giving them over as incorrigible") (7); Keach and De Laune, candidate |
| 1 Kings 22:15 | "'Go up and triumph,' Micaiah replied" | Bullinger; Henry ("ironically"); JFB ("in ironical mockery"); Clarke ("a strong irony"); Keil and Delitzsch; Gill ("by way of derision") (6) |
| Mark 7:9 | "You neatly set aside the command of God to maintain your own tradition." | Bullinger; Clarke ("a strong irony"); Gill (Barnes gives both readings) (3) |
| 2 Corinthians 12:13 | "Forgive me this wrong!" | Bullinger; Barnes ("a striking mixture of sarcasm and irony"); Gill; Calvin (4) |
| Judges 10:14 | "Go and cry out to the gods you have chosen. Let them save you" | Bullinger; Gill ("in an ironical or sarcastic way") (2) |

### How often, and where

Bullinger 75 verses (Isaiah 9, Jeremiah 6, Matthew 6, Genesis 5, 2 Corinthians 5): prophets 23, Gospels 15, history 12. Companion Bible margin 11 verses. Commentators: "iron-/sarcas-" in 582 comments (Gill 150, Calvin 130, Keil and Delitzsch 78, JFB 69, Clarke 61, Henry 40, Barnes 37); Jeremiah 63, Job 59, Isaiah 50, Psalms 44, 2 Corinthians 40. Wesley uses "irony" in 13 notes. Nave's Topical Bible has an IRONY subject with 19 references and a SARCASM subject (code-fit study).

### Honest limits

**When God speaks, is it irony?** Genesis 3:22, "the man has become like one of Us": Bullinger, Henry ("the ironical upbraiding"), Gill and Calvin ("An ironical reproof") read irony, and so do Keach and De Laune ("he is no ways like us"); JFB ("not spoken in irony as is generally supposed, but in deep compassion") and Keil and Delitzsch ("contain no irony") do not. Show both when the speaker is God.

---

## 14. Rhetorical question

**Plain definition.** A question asked not for an answer but to make a statement stronger: "Is anything too difficult for the LORD?" means "Nothing is too difficult for the LORD."

Bullinger, "Erotesis; or, Interrogating": 189 verses (Psalms 27, Genesis 17, John 15, Matthew 13, Isaiah 13, Romans 11). The Companion Bible margin marks 373 verses, and a fifth of them (74) are in Job, where God's questions in chapters 38 to 41 and the friends' questions fill whole speeches.

| Reference | BSB words | Named by |
|---|---|---|
| Genesis 18:14 | "Is anything too difficult for the LORD?" | Bullinger; Henry ("Here is a question asked which is enough to answer all the cavils of flesh and blood"); Clarke (Luke 1:37 makes it "an affirmative position instead of a question": "With God nothing shall be impossible") (3) |
| Exodus 15:11 | "Who among the gods is like You, O LORD?" | Bullinger; Calvin ("The interrogation expresses more than as if he had simply asserted that none can be compared with God") (2) |
| Jeremiah 13:23 | "Can the Ethiopian change his skin, or the leopard his spots? Neither are you able to do good" | Bullinger; Keil and Delitzsch ("the possibility suggested in, but denied by, the preceding question"); JFB ("it is morally impossible"); Henry ("so impossible is it, morally impossible, to reclaim and reform these people") (4). Clarke softens it: the words show the change "is extremely difficult", not impossible. |
| Romans 8:31 | "If God is for us, who can be against us?" | Bullinger; Clarke ("What cunning, strength, or malice, can prevail against his wisdom, power, and goodness? None.") (2) |
| Romans 11:34 (Isaiah 40:13) | "Who has known the mind of the Lord? Or who has been His counselor?" | Bullinger (both verses); Gill on Isaiah 40:13 ("not anyone, angel or man; there were none with him") (2) |
| John 8:46 | "Which of you can prove Me guilty of sin?" | Bullinger; Gill ("none of them all could prove anything against him") (2) |
| Psalm 106:2 | "Who can describe the mighty acts of the LORD or fully proclaim His praise?" | Bullinger; Spurgeon ("The questions of this verse never can be answered") (2) |
| Micah 7:18 | "Who is a God like You, who pardons iniquity and passes over the transgression of the remnant of His inheritance" | Gill ("There is no God besides him, none so great, so mighty, as he") (1). Bullinger lists the verse only under another figure (Heterosis). |
| Job 38:4 | "Where were you when I laid the foundations of the earth?" | Bullinger lists 38:4 under Irony, not under Erotesis; Henry ("we are of yesterday and know nothing") (2 for the point, under different names) |

Low risk; the device is often self-evident, and the plain statement behind the question can be shown at Simple ("This question means: nothing is too hard for the LORD"). Commentators rarely use a set term for it (24 comments say a question "is" a strong denial or affirmation); they show it by answering the question ("None", "not anyone").

---

## 15. Numerical sayings ("three ... even four")

**Plain definition.** A number followed by the next number up ("six things ... seven"), a Hebrew way of saying "many", or "enough and more", and of saying that the last item in the list is the one to watch.

| Reference | BSB words | Named by |
|---|---|---|
| Amos 1:3 (and seven more oracles to 2:6) | "For three transgressions of Damascus, even four, I will not revoke My judgment" | Henry ("by three or four we mean many"); JFB (adds "seven ... the full completion of the measure of their guilt"); Clarke ("a finite number for an infinite") (3) |
| Job 5:19 | "He will rescue you from six calamities; no harm will touch you in seven." | JFB ("The Hebrew idiom fixes on a certain number ... then increases the force by adding ... the next higher number"); Clarke ("put here for many"); Gill ("a certain number being put for an uncertain one"); Wesley ("Six - Manifold and repeated") (4) |
| Proverbs 6:16 | "There are six things that the LORD hates, seven that are detestable to Him" | Keil and Delitzsch ("the form of the numerical proverb") (1) |
| Proverbs 30:18 | "There are three things too wonderful for me, four that I cannot understand" | Keil and Delitzsch ("again a numerical proverb") (1) |
| Micah 5:5 | "seven shepherds, even eight leaders of men" | Clarke ("a definite for an indefinite number"); Gill ("that is, many") (2) |
| Ecclesiastes 11:2 | "Divide your portion among seven, or even eight" | JFB ("that is, 'to many'") (1). Keil and Delitzsch also note it ("The rising from seven to eight is as at Job 5:19"), but Delitzsch is not cited on Ecclesiastes until the founder decides (section 18). |

**Limit.** In Proverbs 6:16-19 and 30 the full list is given and the higher number is exact; in Amos and Micah it is not. Writers differ on whether the higher number means "many" (Henry, Clarke, Gill) or "full measure" (JFB). Say "a Hebrew way of saying 'more than enough'" and let the writers differ at Deep. Bullinger was not found treating this as a figure of its own.

---

## 16. Repetition: doubling, refrains, like beginnings, the doubled verb

**Plain definition.** Scripture repeats on purpose. A word said twice or three times in a row carries weight or feeling; a refrain that comes back after each part ties a poem together; several sentences that start the same way build a drumbeat; and in Hebrew a verb doubled on itself ("dying you shall die") makes a statement certain. English translations often smooth the last kind away.

### Doubling (Bullinger: Epizeuxis, "Duplication")

| Reference | BSB words | Named by |
|---|---|---|
| Isaiah 6:3 | "Holy, holy, holy is the LORD of Hosts" | Bullinger; Calvin ("this repetition rather points out unwearied perseverance, as if the Prophet had said, that the angels never cease from their melody") (2). Calvin also warns against resting proof of the Trinity on the threefold "holy" alone; the app should not make that argument from this device. |
| 2 Samuel 18:33 | "O my son Absalom! My son, my son Absalom! If only I had died instead of you, O Absalom, my son, my son!" | Bullinger; Gill ("which repetition expresses the vehemence of his affections"); JFB ("the redundancy and vehemence of his mournful ejaculations") (3) |
| Matthew 23:37 | "O Jerusalem, Jerusalem, who kills the prophets" | Bullinger; Henry ("The repetition is emphatical, and bespeaks abundance of commiseration"); JFB ("the redoubling of the opening word"); Gill ("The word is repeated to show our Lord's affection and concern for that city"); Calvin ("This is also implied in the repetition of the name") (5) |
| Genesis 22:11 | "Abraham, Abraham!" | Bullinger; Gill ("calls him by name, and doubles it, to raise a quick and immediate attention") (2) |
| Luke 10:41 | "Martha, Martha" | Bullinger; Henry ("He repeated her name, Martha, Martha; he speaks as one in earnest"); JFB ("emphatically redoubling upon the name"); Gill ("which expresses great intimacy and friendship, and much earnestness") (4) |
| Acts 9:4 | "Saul, Saul, why do you persecute Me?" | Bullinger; Barnes ("A mode of address that is emphatic. The repetition of the name would fix his attention"); Gill ("doubled to denote vehemency and affection") (3). JFB's gloss here quotes De Wette, a critic; do not use it. |
| Jeremiah 22:29 | "O land, land, land, hear the word of the LORD!" | Bullinger; Keil and Delitzsch ("The triple repetition of the summons ... gives it a special emphasis"); Gill ("the word is repeated three times"); Calvin ("the repetition was not superfluous") (4) |

### Refrains (Bullinger: Amoebaeon, "Refrain", and Cycloides, "Circular Repetition")

| Reference | BSB words | Named by |
|---|---|---|
| Psalm 136 | "His loving devotion endures forever." (all 26 verses) | Bullinger; JFB ("The chorus to every verse"); Clarke ("with the burden ... at the end of every verse"); Spurgeon (a "simple chorus"); Calvin ("verses repeated by way of chorus are both allowed and admired") (5) |
| Amos 4:6-11 | "yet you did not return to Me" (5 times) | Bullinger; Henry ("It is five times repeated in these verses, as the burden of the charge"); JFB ("the monotonous repetition of the same burden marking their pitiable obstinacy"); Clarke (the reproof is "repeated" five times in the chapter; the copy read misprints "five") (4) |
| Isaiah 9:12, 17, 21; 10:4 | "Despite all this, His anger is not turned away; His hand is still upraised." | Bullinger; Henry ("It is the heavy burden of this song"); Keil and Delitzsch ("adapted as the refrain of four symmetrical strophes") (3) |
| Psalm 46:7 and 46:11 | "The LORD of Hosts is with us; the God of Jacob is our fortress." | Bullinger; Henry ("It is the burden of the song"); Spurgeon ("It was meet to sing this twice over"); Gill ("the same words are here repeated") (4) |
| Psalm 80:3, 7, 19 | "Restore us, O God" ... "O God of Hosts" ... "O LORD God of Hosts" ... "cause Your face to shine upon us, that we may be saved." | Bullinger; Henry ("The title given to God rises"); Gill ("an increase of the names or titles of the Divine Being") (3). A refrain that climbs. |
| Psalms 42:5, 42:11, 43:5 | "Why are you downcast, O my soul? Why the unease within me? Put your hope in God" | Bullinger (42:5, 42:11); Spurgeon ("two parts which end with the same refrain") (2) |
| 2 Samuel 1:19, 25, 27 | "How the mighty have fallen!" | Bullinger; Henry; JFB; Gill (4) (section 5) |
| Revelation 2 and 3 | "He who has an ear, let him hear what the Spirit says to the churches." (all seven letters) | Bullinger; Gill ("the same words are subjoined to them all") (2) |

### Like beginnings (Bullinger: Anaphora)

| Reference | BSB words | Named by |
|---|---|---|
| Matthew 5:3-11 | "Blessed" (9 times in the BSB) | Bullinger (1) |
| Psalm 29 | "the voice of the LORD" (7 times in the BSB); "Ascribe to the LORD" (3 times, 29:1-2) | Keil and Delitzsch (Psalm 29 is "the Psalm of the Seven Thunders"); Henry ("How often this call is repeated"); Calvin ("The repetition ... shows that they must be vehemently urged") (3) |
| Psalm 150 | "Praise Him" (each line) | Bullinger; Henry ("the repeated inculcating of the call") (2) |
| Hebrews 11 | "By faith" (20 times at the start of a sentence in the BSB) | Not named as a figure by the writers checked; the count is plain |
| Philippians 4:8 | "whatever is true, whatever is honorable, whatever is right, whatever is pure, whatever is lovely, whatever is admirable" | Bullinger (1) |

### The doubled verb (Bullinger: Polyptoton)

In Hebrew a verb is often put twice, once as an infinitive, to make it certain: literally "dying you shall die". The BSB turns this into "surely", "freely", "indeed" or "eagerly", so the reader cannot see it; the original words at Study can show it.

| Reference | BSB words | Hebrew or Greek, literally | Named by |
|---|---|---|---|
| Genesis 2:16-17 | "You may eat freely" ... "you will surely die." | "eating you shall eat" ... "dying you shall die" | Bullinger ("Hebrew, dying thou shalt die"); Henry ("Dying thou shalt die, denoting a sure and dreadful sentence"); Clarke ("Literally, a death thou shalt die; or, dying thou shalt die"); Keil and Delitzsch (the infinitive before the verb "intensifies the latter") (4) |
| Genesis 3:4 | "You will not surely die," the serpent told her. | "dying you shall not die" | Bullinger ("Here the serpent emphatically denies Jehovah's words"); Keil and Delitzsch ("ye will positively not die") (2) |
| Genesis 37:33 | "Joseph has surely been torn to pieces!" | "tearing, he is torn" | Bullinger ("The figure employed shows the intensity of Jacob's feelings") (1) |
| Luke 22:15 | "I have eagerly desired to eat this Passover with you" | "with desire I have desired" | Bullinger; Clarke ("A Hebraism for, I have desired most earnestly"); Barnes ("This is a Hebrew form of expression, and means I have greatly desired") (3) |
| Acts 7:34 | "I have indeed seen the oppression of My people" | "seeing I have seen" | Bullinger ("Lit. it is 'Seeing I have seen': i.e., I have surely seen"); Barnes ("The repetition of this word is in accordance with the usage of the Hebrew writers when they wish to represent anything emphatically") (2); Calvin renders it "In seeing I have seen" |
| Exodus 3:16 | "I have surely attended to you" | "visiting I have visited" | Bullinger (1) |

### How often, and where

Bullinger: Epizeuxis 91 verses (Ezekiel 11, Exodus 9, Luke 8, Genesis 7, Isaiah 7); Anaphora 55 (Psalms 15, 1 Corinthians 6); Amoebaeon 26 (Revelation 9); Cycloides 16 (Psalms 9); Polyptoton 168 (Genesis 19, John 14, Revelation 14); Anadiplosis 41. Companion Bible margin: Epizeuxis 125 verses (Isaiah 17, Psalms 16, Ezekiel 13), Polyptoton 198, Anaphora 33. The BSB itself marks 223 lines inside verses as right-set refrains and responses ("Selah" 71, "declares the LORD" 62, the Psalm 136 refrain 26), which the code-fit study proposes to show as they are printed. Already in the app: Bullinger's Epizeuxis is cited once (Revelation 18:2, "Fallen, fallen") and Polyptoton three times.

Low risk, easy to detect (count repeated words or roots), and helpful at Simple: "Notice how often this psalm says ...". The doubled verb is the one place where the original words matter most and the code can find it mechanically (an infinitive absolute next to the same verb in TAHOT).

---

## 17. Smaller figures

Each has a short plain meaning and clear verses, all checked against Bullinger's own list for that figure; most are already cited by live Layers notes as support. They are listed so the founder can choose which to surface. Where only Bullinger names a verse, its strength is "some interpreters".

### Metonymy (one word stands for something closely tied to it)

Bullinger's largest section: 1,262 verses (Psalms 141, Isaiah 76, Jeremiah 71, Genesis 69); Companion Bible 735.

| Reference | BSB words | What stands for what (Bullinger) |
|---|---|---|
| Luke 16:29 | "They have Moses and the prophets; let your brothers listen to them." | "The Writer is put for his writing or book" |
| Genesis 42:38 | "you will bring my gray hair down to Sheol in sorrow." | Gray hairs for "me, in my old age" |
| Psalm 23:5 | "You prepare a table before me" | "Table is put for the things on it" |
| Matthew 3:5 | "People went out to him from Jerusalem and all Judea" | A place for "the inhabitants of Jerusalem" (the BSB already supplies "People") |
| Romans 3:30 | "who will justify the circumcised by faith and the uncircumcised through that same faith." | "Circumcision" for "those who are circumcised" (the BSB already unpacks it) |

Low risk; very common. The BSB often unpacks a metonymy already, so a note is worth adding only where the English keeps the picture (Genesis 42:38, Psalm 23:5).

### Synecdoche (a part for the whole, or the whole for a part)

Bullinger 737 verses (Psalms 63, Genesis 63, Matthew 55); Companion Bible 315. It also covers most merisms (section 10).

| Reference | BSB words | Bullinger |
|---|---|---|
| Matthew 6:11 | "Give us this day our daily bread." | Bread for all food |
| Genesis 6:12 | "all living creatures on the earth had corrupted their ways." | Hebrew "all flesh": "i.e., all mankind"; and "This did not include Noah" |
| Luke 2:1 | "a census should be taken of the whole empire." | Greek "all the world": "the civilised world, or Roman Empire" (the BSB already says "empire") |
| Romans 12:1 | "offer your bodies as living sacrifices" | "your bodies (i.e., yourselves)" |
| Acts 2:41 | "about three thousand were added" | Greek "souls" for persons |

### Understatement (Bullinger: Tapeinosis and Meiosis; saying less to mean more)

Tapeinosis 57 verses (Romans 10, Acts 7); Meiosis 52.

| Reference | BSB words | The fuller sense |
|---|---|---|
| Acts 21:39 | "a citizen of no ordinary city" | A famous city |
| Psalm 51:17 | "a broken and a contrite heart, O God, You will not despise." | God will gladly receive it |
| John 6:37 | "the one who comes to Me I will never drive away." | He will welcome and keep him (Clarke: "The words are exceedingly emphatical") |
| Isaiah 42:3 | "A bruised reed He will not break" | He will gently restore the weak |
| Romans 1:16 | "I am not ashamed of the gospel" | I glory in it |
| Genesis 18:27 | "though I am but dust and ashes" | Abraham belittles himself before God (Meiosis) |
| 1 Timothy 1:15 | "sinners, of whom I am the worst." | Paul's self-belittling (Meiosis) |

Low risk. Bullinger alone for most; Clarke on John 6:37 notes the emphasis.

### Euphemism (a gentle word for a hard or private thing)

Bullinger 26 verses (Job 4, Ecclesiastes 3, Matthew 3).

| Reference | BSB words | Named by |
|---|---|---|
| Genesis 15:15 | "You, however, will go to your fathers in peace" | Bullinger (1) |
| John 11:11 | "Our friend Lazarus has fallen asleep" | Bullinger; Barnes ("The word sleep is applied to death"); Calvin ("though it is a metaphorical form of expression, still it is so frequent and common in Scripture"); Gill ("his great modesty to signify it in, such covert language") (4) |
| 1 Thessalonians 4:14 | "those who have fallen asleep in Him" | Bullinger; Barnes ("A most beautiful expression") (2) |
| Judges 3:24 | "He must be relieving himself in the cool room" (Hebrew "covering his feet") | Bullinger; Keil and Delitzsch ("a euphemism for performing the necessities of nature"); Gill ("this became a modest expression") (3) |
| 1 Samuel 24:3 | "he went in to relieve himself" (the same Hebrew phrase) | Bullinger (1) |
| 2 Samuel 18:32 | "May what has become of the young man happen to the enemies of my lord the king" | Bullinger (the Cushite breaks the news of Absalom's death gently) (1) |

Limit: do not use "sleep" as a euphemism to argue the dead are unconscious (Bullinger's own view; section 18). Keep to the plain sense: Scripture calls the death of believers sleep because they will wake.

### Hendiadys (two words joined by "and" for one idea)

Bullinger 112 verses (Acts 13, Luke 13, Matthew 9).

| Reference | BSB words | Named by |
|---|---|---|
| Acts 1:25 | "this ministry and apostleship" | Bullinger; Barnes ("This is an instance of the figure of speech hendiadys, when two words are used to express one thing. It means the apostolic ministry"); Gill ("the apostolical ministration") (3) |
| Acts 23:6 | "my hope in the resurrection of the dead" (Greek "hope and resurrection") | Bullinger; Barnes, on Acts 1:25, gives it as a second instance (2). The BSB already renders it as one idea. |
| 2 Timothy 1:10 | "illuminated the way to life and immortality" | Bullinger (1) |
| Luke 21:15 | "I will give you speech and wisdom" | Bullinger (1) |
| Psalm 116:1 | "He has heard my voice" ... "my appeal for mercy" (the AV's "my voice and my supplications") | Bullinger (1) |
| Genesis 3:16 | "I will sharply increase your pain in childbirth" (Hebrew "your pain and your pregnancy") | Bullinger (1). Keil and Delitzsch disagree: "The sentence is not rendered more lucid by the assumption of a hendiadys." |

Limit: some of Bullinger's cases carry doctrine. He lists John 3:5 ("born of water and the Spirit") and Matthew 3:11 ("with the Holy Spirit and with fire") under this figure, reading each pair as one thing; Christians read both verses differently. Show only cases two writers share, and never these two as a device note.

### Many-ands and no-ands (Bullinger: Polysyndeton and Asyndeton)

Polysyndeton 172 verses (Daniel 17, Revelation 15, Matthew 12); Asyndeton 46 (letters 28). Companion Bible: Polysyndeton 225 verses.

| Kind | Reference | BSB words | Named by |
|---|---|---|---|
| Many-ands | Joshua 7:24 | "Achan son of Zerah, the silver, the cloak, the bar of gold, his sons and daughters, his oxen and donkeys and sheep, his tent, and everything else he owned" | Bullinger (1). The Hebrew puts "and" before each of the ten things taken; the BSB keeps four. |
| Many-ands | Luke 15:20 | "He ran to his son, embraced him, and kissed him." | Bullinger (1). The Greek joins the actions with "and" four times in the verse; the BSB keeps two. |
| Many-ands | Revelation 6:15 | "the kings of the earth, the nobles, the commanders, the rich, the mighty, and every slave and free man" | Bullinger (1); already cited in a live Layers note. The Greek has "and" before each of the seven kinds of people; the BSB keeps two and turns the rest into commas. |
| Many-ands | Romans 9:4 | "Theirs is the adoption as sons; theirs the divine glory and the covenants; theirs the giving of the law" | Bullinger (1) |
| No-ands | Exodus 15:9 | "I will pursue, I will overtake. I will divide the spoils" | Bullinger; Gill ("which words being expressed without the copulative 'and', show the passion he was in, the hastiness of his expressions") (2) |
| No-ands | 1 Corinthians 13:4 | "Love is patient, love is kind. It does not envy, it does not boast, it is not proud." | Bullinger (1) |
| No-ands | Galatians 5:22 | "the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness" | Bullinger (1) |
| No-ands | Mark 16:6 | "He has risen! He is not here!" | Bullinger (1) |

Limit: this figure is mostly lost in English. Mark it on the original words, where the "and"s can be counted; in the English it can only be described.

### Paradox (Bullinger: Oxymoron, "Wise-Folly")

Bullinger 22 verses (2 Corinthians 6, 1 Corinthians 3).

| Reference | BSB words | Named by |
|---|---|---|
| 2 Corinthians 12:10 | "For when I am weak, then I am strong." | Bullinger; Henry ("This is a Christian paradox"); Barnes ("There is often real pleasure in affliction, paradoxical as it may appear") (3) |
| 2 Corinthians 6:8-10 | "viewed as imposters, yet genuine" ... "dying, and yet we live on" ... "having nothing, and yet possessing everything." | Bullinger; Henry ("Such a paradox is a Christian's life") (2) |
| Matthew 16:25 | "whoever loses his life for My sake will find it." | Bullinger (1) |
| 1 Corinthians 1:25 | "For the foolishness of God is wiser than man's wisdom" | Bullinger (1) |
| Acts 5:41 | "rejoicing that they had been counted worthy of suffering disgrace for the Name." | Bullinger (1) |
| 1 Timothy 5:6 | "she who lives for pleasure is dead even while she is still alive." | Bullinger (1) |

Low risk; good at Simple.

### Riddle and proverb

| Figure | Reference | BSB words | Bullinger's count |
|---|---|---|---|
| Riddle (Aenigma) | Judges 14:14 | "Out of the eater came something to eat, and out of the strong came something sweet." | 45 verses (Psalms 9) |
| Riddle | Psalm 49:4 | "I will express my riddle with the harp" | |
| Proverb (Paroemia) | Luke 4:23 | "Surely you will quote this proverb to Me: 'Physician, heal yourself!'" | 249 verses (Proverbs 42, Matthew 40, Ecclesiastes 22) |
| Proverb | 1 Samuel 10:12 | "So the saying became a proverb: 'Is Saul also among the prophets?'" | |
| Proverb | Ezekiel 18:2 | "'The fathers have eaten sour grapes, and the teeth of the children are set on edge'" | |
| Proverb | 1 Samuel 24:13 | "As the old proverb says, 'Wickedness proceeds from the wicked.'" | |

The text names these itself ("proverb", "riddle"), so they need little more than a pointer. Types (Bullinger's "Type", 17 verses) stay in the Layers "pattern" kind.

---

## 18. Sources: who may be cited, where the texts live, what must be mirrored

This section carries the findings of the sources study (`ba\literary\sources.md`), which fetched and read each copy; the founder-rule standing of each writer is from the writer's own words.

### On the cite list today, and how each serves this feature

| Writer (cite id) | Use here | Text for the build |
|---|---|---|
| Bullinger, *Figures of Speech* (`bullinger-fos`) | The backbone: about 200 figures, definitions, 7,304 verses of examples, 194 lettered structures | Clean e-text: the e-Sword module in `darrelwright/UniqueBible_Books @ 4017a67481e0de6027216bbdf3fc5d42c9c289d5` (file `Bullinger - Figures of Speach.book.zip`, blob `fa7da80c9f`), every reference a link; checked against the 1898 OCR (345 of 500 random six-word runs found word for word, and every miss traced to OCR, not the module). But the repository has no license and also carries copyrighted books, so it is research only. The clean route is a mirror branch of the 1898 scan: archive.org `figuresofspeechu00bull` (Princeton; PDF sha1 `5d849fc3891ac5ab29eab7e093e3a08f7aa79944`, OCR text sha1 `e5a4296364d1e178d1fd9b53017b89f191ee4482`), with `cu31924029277047` (Cornell; OCR sha1 `19c652aa4b2d44f5e422bf4efee8d56a92fb8a48`) as a second OCR. The 117 live cites link to the archive.org home page, not to a page; a page-level link would be better. |
| Bullinger (ed.), *Companion Bible* (`bullinger-cb`) | Verse-level figure tags (4,025 on 3,506 verses); about 2,300 structures; Appendix 6, a one-line definition of each of 181 figures in Bullinger's words | Notes: StudyLight (public domain, but no structures) and an unlicensed SQLite module on GitHub with OCR faults. Structures exist only in archive.org OCR (`thecompanionbible_202504`, `CompanionBibleOT`). Appendix 6 as HTML at levendwater.org. All public domain in the US; none clean on GitHub. |
| Keil and Delitzsch (`keil-delitzsch`) | The most precise on parallelism and chiasm; the dissent on divine feelings, on hyperbole (Deuteronomy 1:28) and on hendiadys (Genesis 3:16) | CrossWire KD, needs a mirror. Delitzsch on Ecclesiastes says the book "was not written by Solomon himself"; hold back Ecclesiastes cites until the founder decides (a `not_on`, as Pulpit has for Jeremiah). The Pulpit Commentary's Ecclesiastes (Deane) takes the same view. |
| JFB (`jfb`) | The clearest short statement of the kinds of parallelism (Job 1:1 introduction) | CrossWire JFB, needs a mirror |
| Wesley (`wesley`) and Henry's Concise (`henry-concise`) | Second and third writers on anthropopathism, personification, hyperbole, irony and character pairs | Already pinned and stored (`LetsChurch/lets.church @ 71f6f0fc8f99dfe7fa4cbc09ea58a1a32ae3f239`), so the build can check their words today, the way `eras.rs` checks Tyndale |
| Henry, Gill, Clarke, Barnes, Calvin, Spurgeon, Bengel, Ellicott, Benson, Poole (`henry`, `gill`, `clarke`, `barnes`, `calvin`, `spurgeon`, `bengel`, `ellicott`, `benson`, `poole`) | Verse-level naming of devices and of contrasts between characters | Bible Hub links, as now; Calvin and Spurgeon also on GitHub (CC0). Caution: Bible Hub's Calvin carries the 1840s translators' footnotes, which are not Calvin (Psalm 98:8). |
| The church fathers (`church-fathers`) | Augustine, *City of God* XV.1 and XV.17, the oldest statement of the Cain and Abel and Cain and Seth contrasts | New Advent (NPNF, Dods translation) |

**Bullinger's own stance.** He passes the rule as written: an Anglican clergyman who held every word inspired ("when the Holy Spirit takes up and uses human words, He does so ... with unerring accuracy", *Figures of Speech*), secretary of the Trinitarian Bible Society from 1867 to 1913, and an opponent of the documentary theory. The founder should still know what rides along in his notes: ultradispensationalism (H. A. Ironside called it an "absolutely Satanic perversion of the truth"), the soul's unconsciousness between death and resurrection (the Companion Bible repunctuates Luke 23:43), the gap theory at Genesis 1:2, a Wednesday crucifixion and four men crucified with Christ, the "Gospel in the stars", and his chairing of a 1905 meeting of the Universal Zetetic (flat earth) Society. *Figures of Speech* is mostly grammar and rhetoric, so these surface far less there than in the Companion Bible. Rule for this feature: show his figure and his structure, never his application.

### Candidates to add to the cite list (all published 1930 or earlier, so public domain in the US, unless marked modern)

| Writer and work | Standing under the founder's rule (from the writer's own words) | What it gives | Where the text is |
|---|---|---|---|
| Robert Lowth, Bishop of London, *Lectures on the Sacred Poetry of the Hebrews* (1753; English 1787) and *Isaiah*, Preliminary Dissertation (1778) | Passes: the poems are "justly attributed to the inspiration of the Holy Spirit"; "the inspired historian" Moses | The three kinds of parallel lines, in his words | archive.org `bim_eighteenth-century_lectures-on-the-sacred-p_lowth-robert_1787_1` and `_2` (1787); `lecturesonsacred00lowtrich` (1829, OCR sha1 `25a915bc4e23669574cfdede928fb627de320ea1`). Cite Lowth's own text only: later editions add notes by J. D. Michaelis (a rationalist) and C. E. Stowe (who cites the German critics), and the Isaiah dissertation translates a chapter by the Jewish scholar Azariah de' Rossi. Lowth's Isaiah also emends the Hebrew freely. |
| John Jebb, Bishop of Limerick, *Sacred Literature* (1820) | Passes: Scripture is "the works of him who was the inspirer of both portions of the Sacred Volume" | Named "introverted parallelism" (Proverbs 23:15-16) and carried parallelism into the New Testament (Matthew 7:6) | `sacredliterature00jebb` (1820, OCR sha1 `b5d49a080ffcbce7b44a462920e8728c355f25da`) |
| Thomas Boys, *Tactica Sacra* (1824) and *A Key to the Book of the Psalms* (1825) | Passes: such order is "strange, in those at least who acknowledge the inspiration of the Bible, to impute ... to chance" | Whole-passage introversions and alternations, the line Bullinger edited and continued | `tactica-sacra` (OCR sha1 `bca4208724eb447989f9f51b945851e3867cc366`); `akeytobookpsalm00boysgoog` (1825, OCR sha1 `cec0c7d89887085835e06a7d824b79d86ff90cf9`) |
| John Forbes, *The Symmetrical Structure of Scripture* (1854) | Passes: argues "Plenary Inspiration claimed by Scripture itself" | More introverted and alternate structures (the Decalogue, the Sermon on the Mount) | `symmetricalstruc00forbiala` (OCR sha1 `4f0d3281794d85b0262d409d56f1d45ea904f8f5`) |
| T. H. Horne, *Introduction to the Critical Study and Knowledge of the Holy Scriptures* (editions of 1818 to 1846 only) | Passes for those editions; the 1856 tenth edition's volume 2 was rewritten by Samuel Davidson, who was made to resign over it | A textbook chapter on figurative language and one on parallelism | e.g. `introductionto02horn` (1823) |
| Benjamin Keach and Thomas De Laune, *Tropologia, or, A Key to Open Scripture Metaphors* (1681) | Passes: Particular Baptists; Keach was among those who called the 1689 assembly that endorsed the London Baptist Confession, and his church later became Spurgeon's | Chapters on anthropopatheia ("Metaphors translated from Man to God"), prosopopoeia, synecdoche, irony, hyperbole, allegory and proverb; hundreds of metaphors expounded | **Already on GitHub at a pinned commit with a clean license:** `textcreationpartnership/A37483 @ e290ad310b3c0386b57fce98f8fe489c7679a06f`, CC0 1.0. The only candidate that needs no mirror. 17th-century spelling. |
| Nave's Topical Bible (1896), as a `reference` | Orville Nave, a Methodist army chaplain | Subjects ANTHROPOMORPHISMS (60+ passages), IRONY, PERSONIFICATION, SARCASM, PARABLES, POETRY | Already pinned (`BradyStephenson/bible-data @ 720a8da6d2`) and read by `naves.rs` |
| unfoldingWord Translation Notes (modern) | Passes: statement of faith, "We believe the Bible to be the only inspired, inerrant, sufficient, authoritative Word of God." A team, unsigned, so one source | Per-verse figure tags keyed to the Hebrew and Greek words (Psalms: metaphor 1,182, parallelism 297, personification 133, merism 58); the only believing source found that names merism | `git.door43.org/unfoldingWord/en_tn` (Gitea, not GitHub), CC BY-SA 4.0 like Aquifer; would need a mirror and the license's attribution line |
| Craig Blomberg (modern, copyrighted) | Evangelical; author of a 2014 defence of the Bible's reliability (seen in search results today); founder to confirm | Only the chiasm test in section 4; cite and link, never quote at length | biblicalelearning.org copy of *Criswell Theological Review* 4.1 (1989) |
| *Catholic Encyclopedia* (1907) | Catholic writers who uphold Scripture are allowed; as evidence of the early church's view, not as an interpreter | The Audians and the Fathers on anthropomorphism | newadvent.org/cathen/01558c.htm |

Leads not checked: Patrick Fairbairn, *Hermeneutical Manual* (1858), and D. R. Dungan, *Hermeneutics* (1888), both inside the unlicensed UniqueBible repository; neither their stance nor a clean copy was checked.

### Never to cite for this feature (from the avoid list and the founder's rule)

- Robert Alter, James Kugel, Adele Berlin and the other Jewish scholars on the avoid list ("modern Jewish Bible scholars", `config/layer-sources.json`), even where the modern study of parallelism and Hebrew narrative leans on them; the medieval rabbis on the same list; and Azariah de' Rossi, whom Bullinger credits with the first "mass of information" on parallelism and calls "a learned Jew of the sixteenth century".
- Herder (named by JFB); the German critics whom Keil and Delitzsch argue with (Ewald, Hupfeld, Hitzig, Knobel) and whom Stowe's notes cite (De Wette, Eichhorn); J. D. Michaelis; S. R. Driver (whose BDB and ICC work is on the avoid list).
- Milton S. Terry: his *Moses and the Prophets* (1901) says of the books of the Law "we find nothing to show that Moses was the author of any one of them", so his *Biblical Hermeneutics* is out.
- Origen, condemned in 543 and 553, though he wrote at length that God has no body; the schismatic Novatian.
- Samuel Davidson's 1856 volume of Horne; Nils Lund's *Chiasmus in the New Testament* (1942, after the public-domain line, and not checked); the BYU chiasmus databases (a Latter-day Saint project) and `kckern/IsaiahExplorer` (Bullinger's Isaiah notes inside a Latter-day Saint project, no license).
- Repeated "type-scenes" (for example the meetings at a well in Genesis 24, Genesis 29, Exodus 2 and John 4) were not found among the cite-list writers checked; hold that kind of note back until a believing writer who makes the observation is found.

### What must be mirrored, and how

None of Lowth, Jebb, Boys, Forbes or Horne, nor a clean Bullinger, is on github.com. One workflow in the style of `.github/workflows/mirror-meaning-model.yml` (on branch `claude/ask-the-bible-u6macl`, which mirrors to `mirror/potion-base-8M`) can fetch `https://archive.org/download/<id>/<file>`, check the sha1 that archive.org's metadata lists (the sums above), and commit to one branch, for example `mirror/literary-sources`. In order of value: the two 1898 OCR texts of *Figures of Speech*; the Companion Bible OCR and Appendix 6; Jebb; Lowth (1829, the lectures only); Boys; Forbes. The CrossWire commentaries (KD, JFB, Clarke, Barnes) need the same treatment for any build-time quote check. Keach needs nothing: pin `textcreationpartnership/A37483` in `sources.json`.

### Files from this session

All under `C:\Users\shubh\AppData\Local\Temp\claude\C--Users-shubh-Projects--claude\d3907c69-e0f0-457b-bec9-6a76569849b3\scratchpad\ba\literary\`:

- `cat\`: `bib.py` (BSB lookup from the pinned JSON), `fos.py`, `idx.py`, `who.py`, `peek.py` (verse-level lookups in the commentary cache), `pairs.py` and `pairs-out.txt` (character pairs), `rgsum.py` and `rg\*.txt` (device-word counts), `poetryshare.py` and `poetryshare.json` (BSB poetry share), `bsb-examples.txt` and `bsb-pairs.txt`.
- `cat2\` (this pass): `figcount.py` and `figcount.json` (Bullinger and Companion Bible counts per figure, by book and section), `ex.py` (checks a verse against one Bullinger figure and prints his words), `bulcheck.py` (which Bullinger figures cite each catalogue row), `attr.py` and `attr-out.txt` (every attributed quotation checked against its writer), `wes.py` (Wesley on the catalogue's verses), `qfind.py`, `where.py`, `fos-plain.txt`, `cb-plain.txt`, `tropologia.txt`, `layers-75f6edc.json`.
- `dl\bh2\` (Bengel pages) and `dl\na\` (Augustine, *Catholic Encyclopedia*), fetched today.
- The commentary cache is `tools\comm-cache.jsonl` (268 MB); its index is `cat\comm-idx.pkl`. Neither belongs in the repository.

---

## 19. Gaps and open questions

1. **Large chiasms.** Only Bullinger (and before him Boys, Jebb and Forbes, none yet on the cite list) propose them. Under the proposed bar most would show at Deep only, as "some interpreters". The founder should decide whether large structures belong in the app at all, and whether Jebb, Boys and Forbes should join the cite list for this.
2. **Disputed verses.** Anthropopathism (how real God's feelings are), Proverbs 8 (personification or Christ), "This is My body" (metaphor or more), Genesis 3:22 (irony or compassion), John 21:25 and Deuteronomy 1:28 (hyperbole or not), Matthew 19:24 (hyperbole or proverb), Genesis 3:16 (hendiadys or not), Matthew 7:6 (who tears). Each needs a rule: show both readings with their writers, or leave the verse unlabelled.
3. **Bullinger's own doctrines** (ultradispensationalism, soul sleep, his textual emendations through parallelism, the "eighteen emendations of the Sopherim", his hendiadys on John 3:5) appear inside his device examples. The device can be shown from him; his application should never be.
4. **Writers not yet searched verse by verse.** The Pulpit Commentary, Ellicott, Poole, Benson and the church fathers have no full local text; they were read only on the chapters fetched (section 1). Bengel was fetched for four chapters. The held-back character pairs (section 7, rows 45 to 48 and 50) and Saul and David might gain writers there; Woudstra on Joshua for Rahab and Achan.
5. **The BSB and the original order.** Stair-step parallelism (Psalm 93:3), crossings (Genesis 4:4-5, Philemon 5), the doubled verb (Genesis 2:17) and many-ands (Luke 15:20) are clearer in Hebrew or Greek than in the BSB. Showing them well depends on drawing on the original words at Study.
6. **No clean GitHub text of Bullinger.** The feature leans on him more than on anyone; a mirror branch of the 1898 scan text is the first build step. Keach (CC0, already pinnable) and Wesley (already stored) are the easiest second witnesses to check by build.
7. **What Simple may show.** Since PR #48 (on main), Simple "keeps to the verse and its strongest links" and study notes start at Study. A device line at Simple should therefore be limited to the self-evident (bookends, refrains, a "but" between two lines) and to notes that are widely agreed; everything else starts at Study.
8. **Founder decisions needed:** Keil and Delitzsch and the Pulpit Commentary on Ecclesiastes; whether to add Lowth, Jebb, Boys, Forbes, Keach, Nave's (as a reference) and unfoldingWord to the cite list; whether the modern word "merism" may appear on screen; Blomberg as the source of the chiasm test.

---

## 20. What this pass corrected

The first draft was cut off before it reported. This pass kept its sourced work and changed the following.

- The main commit is `75f6edc` (PR #48), not `5296d48`; the configs measured are the same at both.
- All Bullinger counts now come from the e-text module's own reference links (for example Anthropopatheia 779 verses, not 700; Prosopopoeia 198, not 178; Hyperbole 121; Erotesis 189), and Companion Bible counts from the tag file (Erotesis 373 verses, not "at least 385").
- *Figures of Speech* does have a clean e-text on GitHub, but in an unlicensed repository; the first draft said none was found. Lowth, Jebb and Boys were "not checked against the founder's rule"; their own words now show they pass. Keach and De Laune (CC0, pinned on GitHub), Forbes, Horne, Nave's and unfoldingWord were added as candidates; Terry, Michaelis and the others were added to the never-cite list.
- Examples not in Bullinger's list were taken off his name: Matthew 26:39 and Psalm 76:1 (metonymy), 1 Kings 2:10 and 1 Thessalonians 4:13 (euphemism), Matthew 10:39 (paradox; Bullinger has Matthew 16:25), Deuteronomy 33:27 and Psalm 44:23 in the forms table (anthropomorphism). Matthew 19:24 is under his Proverb, not Hyperbole.
- The "needle gate" is mentioned by Henry (Mark 10:25) and Ellicott, as a report they do not adopt; the first draft said no writer checked mentions it.
- Keil and Delitzsch's note on Ecclesiastes 11:2 is no longer counted, following the first draft's own caution on Delitzsch's Ecclesiastes.
- The Pulpit Commentary on Genesis 6:6 only quotes others, so it is not counted.
- Every device now has five or more examples: rhetorical question (9), alternation (8), and the smaller figures (five or more each) were expanded; the doubled verb (Polyptoton) was added under repetition.
- Character pairs gained writers: Augustine (rows 1 and 2), Wesley (row 1), Henry (rows 6 and 13), the Companion Bible structure (row 12), Bengel (rows 29 and 33), Bullinger (row 40). Rows with three or more writers rose from 13 to 17.
- New verified examples with writers: Isaiah 6:10 and 2 Chronicles 32:7-8 and Proverbs 23:15-16 (chiasm), 2 Samuel 1 (bookends and refrain), Psalm 2:4 and Exodus 6:6 and Isaiah 53:1 (anthropomorphism), refrains in Psalms 46, 80, 136, Isaiah 9 and Amos 4, and the doubled names (Matthew 23:37, Luke 10:41, Acts 9:4).
