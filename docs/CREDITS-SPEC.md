# Credits spec: the shape of a citation's credit

This spec fixes the credit shape that every surface uses. AF-K builds the shared `Credit` and `SourceLine` components and `crates/atlas-cli/src/cite.rs` from it (see `docs/local-work/2026-10-20/AUDIT-FIXES-PLAN.md`, rule 4 and the AF-K row). Everything here comes from the code and data as they stand on 2026-10-24:

- `crates/atlas-cli/src/layers.rs`: doc comment items 10 to 13, `resolve`, `Credit`, `credit_json`, `dated`, `CiteList` and `verify`.
- `config/layer-sources.json`: `_comment`, `sites`, `writers`, `works`, `cite` with its `parts` and `works`, `denies` and `avoid`.
- `web/src/data/layers.ts` (the `Cite` type) and `web/src/ui/Layers.tsx` (`CreditLine`, `Credits`, `dateWords`).
- `crates/atlas-cli/src/extra_figures.rs`: figure cites, which use the same cite list.
- The built `web/public/data/layers.json`: 6,361 cites in 1,265 passages.

The founder's decisions behind it:
- **Decision 10:** credit the person who wrote the words, where the app read them, the original date and the date read.
- **Decision 11:** every credit helps a first-time reader and links the page to check.
- **Decision 15:** no AI credit, and the sources' own words are one tap away.
- **Decision 19:** describe the check, never who or what made it.
- **Decisions 20 and 23(3):** leave out only passages that deny the text.

## 1. How a credit is made

| Step | Where | What it does |
|---|---|---|
| A note cites a source | `config/layers.json`, a layer's `cites` | names a source id on the cite list, the verse (`on`) and, if needed, a place in the work (`at`) |
| Who wrote those words | `resolve` in `layers.rs`, from `config/layer-sources.json` | finds the one `part` covering the book and chapter of `on` (or the named `work`) and its writers |
| Which page | `cites` and `chapter_page` in `layers.rs` | the cite's own `url` when given; else Bible Hub's chapter page for a source with a `biblehub` code; else the source's `link` pattern (with none of these, the build refuses the cite) |
| When it was read | `dated` in `layers.rs`, from `docs/evidence/*.json` | a `reads` record of that very page gives `read_on`; failing that, a `checks` record gives `checked`; failing both, the build stops |
| The credit | `credit_json` in `layers.rs` | writes the fields of section 3 into `layers.json` |
| What the reader sees | `CreditLine` in `web/src/ui/Layers.tsx` | one line per writer, at Deep, under "Sources" |

Bible Hub's chapter page is `https://biblehub.com/commentaries/<code>/<book_snake_case>/<chapter>.htm`. The Song of Solomon is `songs`. For example: `https://biblehub.com/commentaries/kad/1_samuel/1.htm`.

A `link` pattern puts the book in kebab case, for example `https://www.studylight.org/commentaries/eng/bul/{book}-{chapter}.html`.

## 2. A cite as written (`config/layers.json`, `CiteSpec`)

| Field | Meaning | Example |
|---|---|---|
| `source` | an id from `cite` in `config/layer-sources.json` | `"barnes"` |
| `on` | the verse the writer comments on; the build refuses a cite without it | `"Genesis 2:7"` |
| `at` | the place inside the work, when the verse alone does not find it | `"book 5, chapter 21, section 1"` |
| `url` | a page, only when the source's chapter page does not reach the words | `"https://www.newadvent.org/fathers/0103521.htm"` |
| `work` | for a source cited by its works (a journal, the church fathers): which one | `"currid-ruth"` |
| `counts` | only ever `false`: the cite supports part of the note or is a reference, so it does not count toward the strength | `false` |

## 3. The credit shape (built, one object per cite)

These names are the shared shape. AF-K's `web/src/data/cite.ts` takes them as they appear in the `Cite` type of `layers.ts`.

| Field | Always? | Meaning | Example from `layers.json` |
|---|---|---|---|
| `writer` | yes | who wrote the words: one name; two joined by "and"; three or more as "A, B and C"; or, when no writer can be named, the phrase the credit leads with | `James G. Murphy`; `A. Lukyn Williams and W. J. Deane`; `a later abridgment of Matthew Henry's Commentary by an editor not yet identified` |
| `about` | when a writer is named (6,093) | who he was, 60 characters at most, no honorifics, from the source in the writer's `about_from`; for two or more writers, each by surname | `Presbyterian minister and Professor of Hebrew, Belfast`; `Williams: Principal of the Hebrew Missionary College, London; Deane: Church of England clergyman, Rector of Ashen` |
| `named` | yes | `named` (5,654); `attributed`, printed without a name and credited by a cited source (439); `unnamed` (268) | `attributed` for the Companion Bible notes (E. W. Bullinger) and Poole's Romans (Richard Mayo) |
| `work` | yes | the work's `short` name, with the part's `volume` after a comma | `Biblical Commentary on the Old Testament, the Pentateuch, vol. I` |
| `written` | yes | the original date as the credit shows it, never a remembered year; `date not known` only with `written_from` starting "none found" | `Andover edition of 1866`; `volumes dated 1746 to 1765`; `copyright 1851` |
| `year` | when checked (2,095) | one checked year or decade, for the short credit below Deep | `1866` |
| `edition` | when known (1,284) | the text as read: "translated by" the translators, then the part's or work's `edition` | `translated by James Martin`; `abridged chiefly from Matthew Henry` |
| `on` | yes in Layers (6,361) | the verse as the cite gives it | `Genesis 2:7` |
| `at` | when given (148) | the place inside the work | `under Anthropopatheia (Condescension)` |
| `part` | yes | "on" plus `on`, then `at`, joined by a comma | `on Genesis 3:15, book 5, chapter 21, section 1` |
| `read_from` | yes | the readable name of the link's host, from `sites`, else the bare host | `Bible Hub`; `StudyLight`; `New Advent` |
| `label` | when the site credits someone else (586) | the source's `name`, given only when the source has `labels_as` and none of the cite's writers is among them | `Barnes' Notes` (on Genesis, Murphy's words) |
| `read_on` | one of these two | the day the linked page was read (YYYY-MM-DD), from a `reads` record (648) | `2026-10-20` |
| `checked` | one of these two | when no reading of that page was recorded: the date by which it had been checked against the source (5,710) | `2026-10-17` |
| `url` | yes | the page cited, https, never a work's or site's home page | `https://biblehub.com/commentaries/barnes/genesis/2.htm` |
| `shelf` | yes | the Sources shelf card for the work (the work's `shelf`, else its id); `atlas verify` checks it exists in `shelf.json` | `murphy-genesis` |
| `key` | yes | the person the cite counts as when a note's writers are counted (section 7) | `james-g-murphy`; `matthew-henry` for Wesley's Old Testament notes |
| `counts` | only when false (35) | this cite does not count toward the note's strength | `false` on Thomas Whitelaw, Genesis 3:1 (note 1 of `genesis-3-1`) |
| `quote` | not yet | the writer's own words, for the one-tap credit (section 9) | none in the built data |

## 4. Who wrote the words (`resolve`)

- **Sources with `parts`** name their writers book by book, and chapter by chapter where one book is split.
  - Exactly one part must cover the book and chapter of `on`, and parts never overlap.
  - A cite that no part covers is refused ("no part of config/layer-sources.json says who wrote these words").
- **Sources with `works`** (The Gospel Coalition, Themelios, the church fathers and others) are cited by naming one work with `work`. That work's own `writers` or `unnamed` say who wrote it.
- **A part gives `writers` or `unnamed`, never both.** `attributed: true` marks a work printed without a name that a cited source credits to its writer.
- **The part's own fields win over the work's:** `written`, `year` and `written_from`, and likewise `translated_by` and `edition`.
- **The build refuses:**
  - a writer with `excluded` (A. S. Aglen, decision 20);
  - a cite whose source matches an entry in `denies` and whose `on` falls in that entry's verse, chapter or book (a chapter or book entry is a page or volume that contradicts the author its title or opening verse names, decision 23(3));
  - a book in the source's `not_on` (the Pulpit Commentary on Jeremiah and Lamentations);
  - any name on the `avoid` list in a note's text, evidence or cite fields, or in its passage's source line.
- **A leave-out a session finds takes effect at once and waits for the founder** (decision 23(5)): its `decided` says so in that decision's words, and the pull request lists it. When a leave-out leaves a passage with no note above "some interpreters", which the build refuses, the passage moves whole to `docs/held/` with what was read in looking for another writer, ready to go back.
- **Every part's `evidence` id needs an `attribution` record** in `docs/evidence/` (today that is `credits-2026-10-21.json`), with the words that name the writer as printed.

Tested examples (`resolves_the_true_writer_by_book` in `layers.rs`):

| Source and verse | Writer |
|---|---|
| Barnes' Notes on Genesis 2:7 | James G. Murphy |
| Barnes' Notes on Exodus 2:10 | F. C. Cook |
| Barnes' Notes on Hosea 2:23 | E. B. Pusey |
| Barnes' Notes on Isaiah 53:5 | Albert Barnes |
| Matthew Henry on Revelation 5:1 | William Tong |
| Poole on Romans 1:1 | Richard Mayo |
| Poole on Isaiah 60:1 | an unnamed continuator |

## 5. What the reader sees today (Deep, `CreditLine`)

The credits appear under each note at Deep only, behind the commentary notice, under the heading "Sources". There is one line per writer, in the order the note cites them. The writer's name is a button that opens the work's card on the Sources shelf (`shelf`). The words come in this order:

| `named` | Line (bracketed parts only when the field is present) |
|---|---|
| `named` | Writer (about), work[, edition], written, part. Read on read_from[, which labels it "label"]; date words. Read it there › |
| `attributed` | Work, printed without a writer's name and generally credited to Writer (about)[, edition], written, part. Read on read_from[, which labels it "label"]; date words. Read it there › |
| `unnamed` | Writer phrase with a capital first letter, work[, edition], written, part. Read on read_from[, which labels it "label"]; date words. Read it there › |

Lines as the built data renders them:

- James G. Murphy (Presbyterian minister and Professor of Hebrew, Belfast), Commentary on Genesis, Andover edition of 1866, on Genesis 2:7. Read on Bible Hub, which labels it "Barnes' Notes"; retrieved 20 October 2026. Read it there ›
- The Companion Bible notes, printed without a writer's name and generally credited to E. W. Bullinger (Anglican clergyman and biblical scholar), date not known, on Genesis 1:2. Read on StudyLight; checked against the source by 17 October 2026; the date it was read was not recorded. Read it there ›
- A later abridgment of Matthew Henry's Commentary by an editor not yet identified, Concise Commentary, date not known, on Genesis 2:7. Read on Bible Hub, which labels it "Matthew Henry's Concise Commentary"; checked against the source by 11 October 2026; the date it was read was not recorded. Read it there ›

Some cites share one line. They must have the same writer, work, written, read_from, label and date words, each must have `on`, and none may have `at`. A shared line reads like "... on Genesis 4:1 and 4:2. ... Read them there: 4:1 ›, 4:2 ›", with each verse its own link (`Credits` and `shortRef` in `Layers.tsx`).

## 6. The date words (decisions 10 and 19)

| Field present | Words shown (`dateWords`) | When the build gives it (`dated`) |
|---|---|---|
| `read_on` | `retrieved 20 October 2026` | a `reads` record matches the cite and its `url` (or `url_now`) is the same page as the cite's link; the earliest such day wins. A match means the same passage, source, `on` and `at`, plus note and kind when the same cite is on another note of the passage |
| `checked` | `checked against the source by 17 October 2026; the date it was read was not recorded` | no such reading, and a `checks` record matches; the date is its PR's merge date (the earliest if several) |
| neither | the build stops | "has no record that it was read or checked against the source" |

Rules the code enforces:
- **A read date appears only beside the page that was read.** A `reads` record of a different page is an error, not a date.
- **Dates must be sound.** They are real calendar dates, none after today, none outside the file's `fetched` day or its `from` to `to` window.
- **A record's `time`, when given,** is the UTC time on that day (`2026-10-21T07:12:03Z`).
- **`atlas verify` checks every built cite** has exactly one of `read_on` and `checked`.
- **No credit says who or what made a check.** The phrases in `AI_CREDIT` (`layers.rs`) are refused in every credit, source line and source list.

Every `reads` record behind a `read_on` today holds the writer's point as found on that page. It is either a `quote` (public domain) or a `pointer` (copyrighted). This is true of all 608 records in `docs/evidence/layers-mend-2026-10-20.json`, all 61 in `docs/evidence/layers-credits-reads-2026-10-21.json` and all 20 in `docs/evidence/layers-reads-2026-10-24.json`, and none has both. So "retrieved" here means the page was fetched that day and the cited point was found on it.

This spec rules: a fetch that did not find the cite's point gives the credit no date. The fetch goes in the evidence only, as proof the link works, and the credit keeps its `checked` words. There is no "page retrieved" label.

Dates are shown as day, month name, year ("20 October 2026"). The build log's "retrieved 2026-10-20" and "checked by 2026-10-17" are log lines, not reader text.

## 7. Strength counts persons, not works

The rule in CLAUDE.md:
- 3 or more writers: "widely agreed".
- 2 writers: "commonly held".
- 1 writer: "some interpreters".

Only cites whose source role is "interpreter" count, and a writer is the person in `key`.

| `key` shape | When | Example | Cites in `layers.json` |
|---|---|---|---|
| writer id | one named writer | `john-gill` | 6,194 (with the `counts_as` keys) |
| `counts_as` id | an abridgment counts as the writer it abridges | Wesley's Old Testament notes: `matthew-henry`; his New Testament notes: `j-a-bengel`; the Concise Commentary: `matthew-henry`, or the continuator it abridges (`william-tong` on Hebrews and Revelation) | (inside the 6,194) |
| ids joined by `+` | a part written jointly: one key, counted once | `a-lukyn-williams+w-j-deane`; `theodore-beza+joachim-camerarius+pierre-loiseleur-villiers` (the Geneva New Testament notes) | 56 |
| `<work>:<book>` | an unnamed part: one unnamed writer per book | `poole:Matthew`; `geneva-notes:Genesis` | 104 |
| `<work>:all` | a work cited directly whose writer is unnamed | `bibleproject-babel:all` | 7 |

- **One man's words in two sets count once.** The test `counts_writers_by_person` covers George Rawlinson in Ellicott and in the Pulpit on Exodus 3:14, and Bullinger's Companion Bible and Figures of Speech.
- **Some cites never count:** a cite with `counts: false`, and any cite from a reference-role source (the BSB, STEPBible, Strong's, Abbott-Smith, Easton).
- **The Layers build does not refuse a label above the count yet.** It ships `key` and `counts`; AF-LC will report labels above the count and AF-LS will refuse them.
- **The Figures build already refuses one** (`extra_figures.rs`, the strength check over interpreter keys).
- **The built data has no label above its count today.** A count on 2026-10-24 left out plain-meaning notes, `counts: false` cites and reference shelves. AF-LC's report is the check of record.

## 8. The cite list for other modules (`CiteList` in `layers.rs`)

Any module that credits a writer on the cite list uses this facade, so it names the same person for the same page as Layers.

| Call | Gives |
|---|---|
| `CiteList::read(root)` | the checked cite list |
| `source(id)` | `Listed`: id, role, name, why, url (never a cite's link), not_on |
| `who_wrote(source, book, chapter, work)` | `WhoWrote`: writer, about, named, work (with volume), written, edition, label, key, several; an error when no part covers the place or the writer is excluded |
| `denials(source)` | each left-out passage, with why and when decided |
| `chapter_page(source, book, chapter)` | the source's chapter page (Bible Hub's, else its `link` pattern); a cite's own `url`, when given, is linked instead |
| `home_page(source, url)` | whether a link opens a whole work or site |
| `names()`, `avoid()` | every writer and source name; the avoid list |

`WhoWrote` has no `year` and no `shelf`. AF-K's `cite.rs` needs both, for the short form and for the shelf check, so `CiteList` should gain them.

Figures (`extra_figures.rs`) takes writer, about, named, work, when, edition, label and key from `who_wrote`. Its `by` is "writer, about" for one writer, and the writer alone when there are several. Its names differ from the shared shape in four places:

| Shared shape (Layers) | Figures cite | Difference |
|---|---|---|
| `written` | `when` | same value, other name |
| `read_from` | `read` | In Layers it is the site of `url`. In Figures it is free words naming the copy read, which can differ from the linked page: Keil on 1 Samuel 1:2-3 was read in "sacred-texts.com's transcription, in the copy at github.com/jonnyg23/mahabrain (commit b00aa50)" but links Bible Hub |
| `read_on` / `checked` | `retrieved` | Figures has a read date only; its note-level `checked` is a separate field |
| `at`, `part` | `at` | Figures' `at` reads "Work (date), place in it"; Layers keeps the place alone in `at` and builds `part` |

Figures also has `name` (the source as the cite list names it, always shown) and `quote`, and it refuses `unnamed` writers.

## 9. Still open

**No `quote` field in Layers yet.**
- Decision 15 puts the sources' own words one tap away, and AF-K's opened credit shows "the stored quote where the caller passes one".
- The words already exist in the evidence (a `quote` or `pointer` on every `reads` record), but `CiteSpec` and `credit_json` carry none.
- The 5,710 `checked` cites have no `reads` record, so no quote or pointer of their point is stored. For 115 of them (92 comments), an attribution record in `credits-2026-10-21.json` takes its example words (nine in most) from the same comment; those words show who wrote the text, not the cited point.
- When the field is added:
  - `quote` holds public-domain words exactly as the page has them, with spelling, misprints and punctuation kept (decision 4).
  - `pointer` holds, in the app's own words, where on the page the point is made. It is used for copyrighted text: the Pulpit Commentary on Bible Hub, which carries BibleSoft's notice, and the NET Bible notes, whose words are never quoted.
  - A cite has one or the other, never both.
- Example: on Bible Hub's Genesis 2 page, under "Barnes' Notes", Murphy's words on 2:7 include "His mission in this respect is to draw out the capabilities of the soil" (read there on 2026-10-20; `docs/evidence/layers-mend-2026-10-20.json`, its first record).

**First editions not yet read.** Sixteen works have a `first_edition` note, so their `written` shows the printing that was read:

| Work | `written` | Still missing |
|---|---|---|
| barnes-nt | 1832 to 1852 | Thessalonians to Philemon read in an undated edition |
| murphy-genesis | Andover edition of 1866 | the Edinburgh edition |
| pusey-minor-prophets | published in parts from 1860 | the years of the later parts |
| speakers-commentary | volumes of 1873 to 1886 read | first-edition years of vols. I and II |
| ellicott | 1878 to 1884 | each New Testament volume's first year |
| pulpit | published 1880 to 1897 | each volume's first year |
| jfb | New York reprints of 1873 and 1878 | the English first edition |
| henry-complete | 1828 edition | any first edition of Henry or the continuation |
| gill | volumes dated 1746 to 1765 | the years of the other volumes |
| clarke | London printing of 1817 | the first volume's first edition |
| bengel-gnomon | English edition from 1857 | the Latin first edition and each translator |
| calvin-commentaries | Calvin Translation Society edition, from 1844 | volume, year and translator per book |
| maclaren-expositions | 1906 printing | each book's volume year |
| companion-bible | date not known | the six parts' dates, and which came after 1913 |
| easton | third edition, 1897 | the first edition (1893) |
| edersheim-life | second edition, 1884 | the first edition |

**Writers not yet named.**
- Poole's continuators (Isaiah 59 to 66, and Jeremiah to Revelation except Romans): the printed Annotations name none of them, so the credit reads "a continuator of Matthew Poole's Annotations whose name is not printed". Edmund Calamy's account of the ejected ministers (1713; scan accountofministe00cala, leaf 53, read 2026-10-24) names them book by book. Romans is credited from it to Richard Mayo, marked `attributed`, since the volumes themselves print no names; each other book can name its writer the same way once its entry is read.
- The Pulpit Commentary's expositors on Job (the copy read lacks its title leaf) and on Daniel (not yet confirmed from a printed volume).

**`year` is missing on 4,266 cites.** The largest groups are Gill (1,071), JFB (859), Clarke (578) and the Companion Bible (433). The Simple form shows a year only where `year` exists ("From James G. Murphy (1866).") and otherwise shows none ("From John Gill."). A year is never worked out from `written`.

**The plan's sample lines do not match the data.**
- AF-K's "From John Gill (1760s)" and "Baptist pastor in London": Gill has no `year`, his `written` is "volumes dated 1746 to 1765", and his `about` is "English Particular Baptist minister".
- AF-LD's "James G. Murphy (1863) and Keil and Delitzsch (1860s)": Murphy's year is 1866. "Keil and Delitzsch" is a set, not a writer; on Genesis the credit names C. F. Keil (1864).
- AF-K's Deep sample puts the edition after the site; Layers puts it after the work.

**AF-LR's "read on" labels.** Today the words are "retrieved <date>".
- If AF-LR changes them, it changes every `read_on` credit at once, since all of them rest on a found point (section 6).
- It must avoid "Read on Bible Hub; read on 20 October 2026". One way is "Read on Bible Hub on 20 October 2026".
- There is no "page retrieved" label (section 6).

**Short forms for AF-K.**
- Simple: "From", then one name per `key` in cite order, with `year`. An `attributed` writer reads "From work, credited to writer."; an `unnamed` one is named by its phrase.
- Study: writer, work, `written`, `part`.
- One tap opens the Deep line of section 5, with the link.
- How many names Simple lists before "and more" is AF-K's call.

**Where read and where linked differ (Figures).** "Read it there ›" is true only when `read_from` is the link's site. A credit whose words were read elsewhere needs other words for the link.

**Not yet checked by the build:**
- that a `reads` record giving a date carries a `quote` or `pointer`;
- the strength count (AF-LC, AF-LS);
- `role` per cite in the built data (AF-LC ships it).

The UTC `time` stays in the evidence; the credit shows the day only.