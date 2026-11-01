# Formats for new cite-list writers (copied from main 3d6b340)

## config/layer-sources.json, its own comment

- Who a Layers note may cite, and who wrote the words it cites. Shubhanshu's rule (2026-10-11): cite Bible-believing people who fully believe the Bible and theologians who love God, not people who liberalize the Bible to mean something else. A note goes live once it cites at least one source from "cite" (checked by crates/atlas-cli/src/layers.rs); a note with none stays hidden until a person reviews its passage.
- Every credit names the person who wrote the words, the work and its original date, where the app read it and the date it was read (founder's decisions 10 and 11, 2026-10-20). A site's label is not a writer: Bible Hub's "Barnes' Notes" on Genesis are James G. Murphy's, and on Hosea to Malachi E. B. Pusey's. The build resolves each cite to its writer by the book and chapter of its "on", through the parts of its source, and refuses a cite no part covers.
- sites: the readable name of each host a cite links to. writers: one entry per person whose words are cited. id: the name in lowercase with hyphens. about: who he was in one short phrase (60 characters at most, no honorifics), from the source named in about_from (the volume's title page or contributors' leaf first; otherwise a named reference work). excluded: {why, decided}, a writer the founder's rule drops entirely; the build refuses any cite of his words.
- works: one entry per published work. title as printed; short: the name the credit gives it. written: the original date as the credit shows it, never a remembered year: the first edition's year when a title page, a dated scan or a library record of that edition has been read, otherwise the earliest dated printing read ("1877 printing") or the set's checked span; "date not known" only with written_from "none found". year: one checked year or decade for the short form below Deep, left out otherwise. written_from: the evidence. first_edition: what is still missing. scan: a free printed copy. writers, unnamed, translated_by, edition, evidence: for a work cited directly (an article, a father's treatise). shelf: the Sources shelf card that presents it (default: its id).
- cite: one entry per source a note may cite. id: used in a note's cites. role: "interpreter" for a commentary or teacher, "reference" for a translation, word book or dictionary; a wordplay, allusion, pattern, irony or fulfillment note needs at least one interpreter. name: the name the site gives the set. biblehub: its code on biblehub.com/commentaries, so a cite "on" a verse links to that chapter there; link: a chapter-page pattern with {book} and {chapter}, for a site that is not Bible Hub; url: the work's own page, never a cite's link (a cite with no other link names its page in its own url). labels_as: the writers the site credits its pages to; when a cite's writer is not one of them, the credit says which label the site gives it. site_says: the site's own credit line, word for word. why: one plain sentence on why it passes the rule. not_on: books whose volume of a many-handed set is not cited, with the reason in why.
- parts: who wrote the words, book by book. books: book names as atlas_core::BOOKS spells them, or "all". chapters: [from, to], only with one book. work, volume: the work id, and the volume as the credit names it. written, written_from, year: when the volume has its own date. writers, or unnamed (the phrase a credit leads with when no writer can be named). attributed: the work prints no writer's name and a cited source credits it. translated_by, edition: the text as read. counts_as: the writer an abridgment counts as when a note's writers are counted (Wesley's notes abridge Henry and Bengel; the Concise Commentary abridges Henry and his continuators). evidence: the id of the record in docs/evidence/credits-2026-10-21.json that says who wrote them and how we know. A source with no per-book writer lists works instead, and each of its cites names one with "work".
- denies: cited words left out because they deny Scripture (founder's decision 20, 2026-10-21: keep a contributor's citations that respect Scripture, leave out only passages that deny it, and drop a contributor entirely only when he denies Scripture in the passages we'd cite; decision 23(3): denying Scripture is contradicting the text itself, such as the author named in a title or opening verse). on is a verse; a chapter, where the page that carries the writer's words on it denies the author its title or opening verse names; or a book, where the writer's volume on it does. Each gives the source, the verse or book, the writer, at (where on the page he says it, in the app's own words: never his words), why, and when and how it was decided; an exclusion a session finds says so in decided, with decision 23(5)'s words, until the founder makes it final. The build refuses a cite with that source whose verse falls in on.
- avoid: works and writers a note may not cite or name, because they read the Bible along higher-critical lines, because we could not confirm they hold the whole Bible true, or because they write outside the Christian faith. Shubhanshu chose Christian writers only (2026-10-11): Catholic and Orthodox writers who uphold Scripture may be cited; rabbis' commentaries and Jewish scholars may not. match: words that name it, found where a word starts; the build stops on any of them in a note's text or evidence or a passage's source.
- Ancient writings (the Septuagint, Targums, Mishnah, Talmud, Midrash, Josephus, Philo, the Dead Sea Scrolls, the Apocrypha) may be named in evidence as witnesses to what people read or believed, but they are not interpreters and never count as a note's citation.

## Sample writers entries
```json
[
 {
  "id": "adam-clarke",
  "name": "Adam Clarke",
  "about": "Methodist preacher and scholar",
  "about_from": "Wikipedia, read 2026-10-21, 'Adam Clarke': 'a Methodist theologian who served three times as President of the Wesleyan Methodist Conference'"
 },
 {
  "id": "c-h-spurgeon",
  "name": "C. H. Spurgeon",
  "about": "English Particular Baptist preacher",
  "about_from": "Wikipedia, read 2026-10-21, 'Charles Spurgeon': 'an English Particular Baptist preacher'"
 },
 {
  "id": "e-w-bullinger",
  "name": "E. W. Bullinger",
  "about": "Anglican clergyman and biblical scholar",
  "about_from": "Wikipedia, read 2026-10-21, 'Ethelbert William Bullinger': 'an Anglican clergyman, biblical scholar'; figuresofspeechu00bull (1898): title page 'E. W. Bullinger, D.D.'"
 },
 {
  "id": "augustine",
  "name": "Augustine",
  "about": "Bishop of Hippo",
  "about_from": "Wikipedia, read 2026-10-21, 'Augustine of Hippo'"
 }
]
```

## Sample works entries
```json
[
 {
  "id": "spurgeon-treasury",
  "title": "The Treasury of David",
  "short": "The Treasury of David",
  "written": "1869 to 1885",
  "written_from": "voices group-1 and the set's library records; the volume cited is dated in its part",
  "scan": "https://archive.org/details/treasuryofdavid0005chsp"
 },
 {
  "id": "figures-of-speech",
  "title": "Figures of Speech Used in the Bible, Explained and Illustrated",
  "short": "Figures of Speech Used in the Bible",
  "written": "1898",
  "written_from": "figuresofspeechu00bull: title page 'London: Eyre & Spottiswoode ... 1898'",
  "year": "1898",
  "scan": "https://archive.org/details/figuresofspeechu00bull"
 },
 {
  "id": "augustine-tractates-john",
  "title": "Tractates on the Gospel of John",
  "short": "Tractates on the Gospel of John",
  "written": "1888",
  "written_from": "the New Advent page's own translation line, read 2026-10-20 (dates.md section 6): 'translated by John Gibb (Nicene and Post-Nicene Fathers, first series, vol. 7)'",
  "evidence": "augustine-tractates-john",
  "writers": [
   "augustine"
  ],
  "edition": "translated by John Gibb (Nicene and Post-Nicene Fathers, first series, vol. 7)",
  "year": "1888",
  "shelf": "church-fathers"
 },
 {
  "id": "beale-eden-temple",
  "title": "Eden, the Temple, and the Church's Mission in the New Creation (JETS 48/1)",
  "short": "Eden, the Temple, and the Church's Mission in the New Creation",
  "written": "2005",
  "written_from": "the article's volume and year in the Journal of the Evangelical Theological Society, as its PDF prints them",
  "evidence": "beale-eden-temple",
  "writers": [
   "g-k-beale"
  ],
  "year": "2005",
  "shelf": "beale"
 },
 {
  "id": "currid-ruth",
  "title": "Ruth (The Gospel Coalition Bible Commentary)",
  "short": "Ruth",
  "written": "June 2021",
  "written_from": "the page's own date, read 2026-10-20 (dates.md, modern-dates.json)",
  "evidence": "currid-ruth",
  "writers": [
   "john-currid"
  ],
  "year": "2021",
  "shelf": "gospel-coalition"
 }
]
```

## Sample cite entries
```json
[
 {
  "id": "clarke",
  "role": "interpreter",
  "name": "Clarke's Commentary",
  "biblehub": "clarke",
  "labels_as": [
   "adam-clarke"
  ],
  "site_says": "Commentary on the Bible, by Adam Clarke [1831]. Text Courtesy of Internet Sacred Texts Archive.",
  "why": "A Methodist scholar's commentary that holds the Bible as God's word.",
  "parts": [
   {
    "books": "all",
    "work": "clarke",
    "writers": [
     "adam-clarke"
    ],
    "evidence": "clarke"
   }
  ]
 },
 {
  "id": "spurgeon",
  "role": "interpreter",
  "name": "Treasury of David",
  "biblehub": "tod",
  "labels_as": [
   "c-h-spurgeon"
  ],
  "site_says": "The Treasury of David, by Charles Haddon Spurgeon [1869-85]. Text Courtesy of Internet Sacred Texts Archive.",
  "why": "Spurgeon's work on the Psalms; he defended the Bible's full inspiration.",
  "parts": [
   {
    "books": [
     "Psalms"
    ],
    "chapters": [
     104,
     118
    ],
    "work": "spurgeon-treasury",
    "volume": "vol. V",
    "written": "1878",
    "written_from": "treasuryofdavid0005chsp: library record 1878, vol. 5 (Psalms 104 to 118)",
    "year": "1878",
    "writers": [
     "c-h-spurgeon"
    ],
    "evidence": "spurgeon"
   }
  ]
 },
 {
  "id": "church-fathers",
  "role": "interpreter",
  "name": "the church fathers",
  "url": "https://www.newadvent.org/fathers/",
  "why": "Early Christian teachers who read the whole Bible as God's word; each cite names the father's work.",
  "works": [
   "justin-dialogue",
   "justin-first-apology",
   "irenaeus-against-heresies",
   "barnabas",
   "first-clement",
   "didache",
   "gregory-oration-41",
   "jerome-apology",
   "athanasius-arians",
   "augustine-tractates-john"
  ]
 },
 {
  "id": "reformation-sb",
  "role": "interpreter",
  "name": "the Reformation Study Bible",
  "url": "https://www.ligonier.org/",
  "why": "Reformed study notes that hold the Bible without error.",
  "parts": [
   {
    "books": "all",
    "work": "reformation-study-bible",
    "unnamed": "the Reformation Study Bible's writer on this book, named only in its printed front matter",
    "evidence": "reformation-sb"
   }
  ]
 },
 {
  "id": "gospel-coalition",
  "role": "interpreter",
  "name": "The Gospel Coalition",
  "url": "https://www.thegospelcoalition.org/",
  "why": "Its confession holds the Bible to be inspired and without error; each cite names its article.",
  "works": [
   "currid-ruth",
   "fix-vannoy-1-samuel",
   "kostenberger-john",
   "roh-lifted-up",
   "crowe-walking-on-water",
   "thornton-ruth-foreshadows-christ"
  ]
 },
 {
  "id": "beale",
  "role": "interpreter",
  "name": "G. K. Beale",
  "url": "https://www.wts.edu/",
  "why": "A Reformed scholar who defends the Bible's inerrancy; each cite names its work.",
  "works": [
   "beale-eden-temple"
  ]
 },
 {
  "id": "bullinger-fos",
  "role": "interpreter",
  "name": "Bullinger's Figures of Speech",
  "url": "https://archive.org/details/figuresofspeechu00bull",
  "why": "Bullinger writes that the Scriptures are inspired by the Holy Spirit; the book catalogues every figure, plays on words included, as the Holy Spirit's own wording.",
  "parts": [
   {
    "books": "all",
    "work": "figures-of-speech",
    "writers": [
     "e-w-bullinger"
    ],
    "evidence": "figures-of-speech"
   }
  ]
 }
]
```

## config/shelf.json, its own comment

- The Sources shelf: every work the app draws on or cites, one card each, so anyone can see what a source is, who made it, when, its license, and where to read or find it. atlas build reads this file (crates/atlas-cli/src/shelf.rs) with sources.json, the sources config/aramaic.json cites and the sites the questions in config/hard-verses.json link to (shown at Deep), and writes shelf.json for the Sources tab.
- groups: the shelves, in the order shown. id: lowercase letters and hyphens, named by a work's group. name: the plain heading.
- works: one card per work. id: unique, lowercase letters, digits and hyphens; a work that is a dataset uses its sources.json id. group: a groups id. plain: what the Simple level shows, the kind of work and when, in words anyone understands (48 characters at most), such as "Bible dictionary, 1897", or for a book or article what it is about, such as "Article on the word Abba, 1988". title. by: who wrote or made it. when: as shown, such as "1897" or "around AD 200". what: one or two plain, modest sentences (240 characters at most).
- license: public-domain, cc-by-4.0, cc-by-sa-4.0, mit or copyrighted; licenseNote (optional) says more, such as a dataset's license beside its text's. The app ships only public domain, CC BY 4.0 and CC BY-SA 4.0 material, and the MIT-licensed word-meaning model Ask the Bible uses to tell which prepared question someone means. A copyrighted work is cited and linked, never quoted at length or stored.
- datasets: the sources.json ids whose pinned files are this work; [] for a work the app only cites. Each sources.json id belongs to exactly one work. A dataset no work claims still gets a plain card made from sources.json, with a build warning.
- read: where to read the whole work free, either {"app": "bible"} or {"app": "dictionary"} inside the app, or {"url", "label"} for a free full copy of that very work, checked by opening it. Never for a copyrighted work. find: {"url", "label"}, a link for the citation: https://doi.org/ and the DOI when there is one, else a publisher or library catalog page, else a WorldCat search. Required for a copyrighted work. Links are https only.
- citation: the full bibliographic citation, shown at Deep. cites: parts of the source strings the app shows (config/aramaic.json sources, and the site of each read_more link in config/hard-verses.json) that name this work, each found where a word starts ("Bible.org" is not found in "STEPBible.org"). The build records where the app cites each work and warns about any source string no work matches. Keep each one long enough to match only this work's strings; plain ASCII is safest. onlyWhenCited: true for a work shown only while the app cites it, such as a website that only the hard passages at Deep and the "Often asked" answers link to. It needs cites and no datasets.
- To add a work: add one entry with facts checked against the work itself, its publisher or a library catalog, never guessed; give it cites for each source string that names it; if it is a dataset, pin it in sources.json and credit it in NOTICE.md as well. Works only drafted in config/layers.json are added when they go live.

## Sample shelf cards
```json
[
 {
  "id": "spurgeon-treasury",
  "group": "writers",
  "plain": "Commentary on the Psalms, 1869 to 1885",
  "title": "The Treasury of David",
  "by": "C. H. Spurgeon, English Particular Baptist preacher",
  "when": "vol. V, 1878 (the volume cited)",
  "what": "Spurgeon's exposition of the Psalms, with notes gathered from other writers.",
  "license": "public-domain",
  "datasets": [],
  "read": {
   "url": "https://archive.org/details/treasuryofdavid0005chsp",
   "label": "archive.org, vol. V, 1878"
  },
  "citation": "C. H. Spurgeon, The Treasury of David, vol. V (1878), read on Bible Hub (biblehub.com/commentaries/tod).",
  "layer": [
   "spurgeon-treasury"
  ]
 },
 {
  "id": "figures-of-speech",
  "group": "writers",
  "plain": "Catalogue of figures of speech, 1898",
  "title": "Figures of Speech Used in the Bible, Explained and Illustrated",
  "by": "E. W. Bullinger, Anglican clergyman",
  "when": "1898",
  "what": "A catalogue of the figures of speech used in the Bible, plays on words included, each with verses that show it.",
  "license": "public-domain",
  "datasets": [],
  "read": {
   "url": "https://archive.org/details/figuresofspeechu00bull",
   "label": "archive.org, 1898"
  },
  "citation": "E. W. Bullinger, Figures of Speech Used in the Bible, Explained and Illustrated (London: Eyre and Spottiswoode, 1898).",
  "layer": [
   "figures-of-speech"
  ]
 },
 {
  "id": "church-fathers",
  "group": "writers",
  "plain": "Writings of the early church, in translation",
  "title": "The church fathers, as New Advent gives them",
  "by": "Justin Martyr, Irenaeus, Clement of Rome, Gregory of Nazianzus, Jerome, Athanasius, Augustine, John Chrysostom, and the unknown writer of the Epistle of Barnabas",
  "when": "first to fifth centuries; English translations of 1885 to 1896",
  "what": "Early Christian writings the Layers notes cite, each in the English of the Ante-Nicene and Nicene and Post-Nicene Fathers. Each cite names the writer, the work and its translator.",
  "license": "public-domain",
  "datasets": [],
  "read": {
   "url": "https://www.newadvent.org/fathers/",
   "label": "New Advent"
  },
  "citation": "The Ante-Nicene Fathers (1885 to 1896) and the Nicene and Post-Nicene Fathers (1888 to 1894), read on New Advent (newadvent.org/fathers), revised and edited there by Kevin Knight.",
  "layer": [
   "justin-dialogue",
   "justin-first-apology",
   "irenaeus-against-heresies",
   "barnabas",
   "first-clement",
   "gregory-oration-41",
   "jerome-apology",
   "athanasius-arians",
   "augustine-tractates-john",
   "chrysostom-galatians"
  ]
 },
 {
  "id": "gospel-coalition",
  "group": "answers",
  "plain": "Articles by pastors and scholars, since 2005",
  "title": "The Gospel Coalition",
  "by": "The Gospel Coalition, Inc.; founded by D. A. Carson and Timothy Keller",
  "when": "since 2005; website since 2007",
  "what": "Articles, podcasts and books by many named pastors and scholars, from a fellowship of evangelical churches in the Reformed tradition. It also publishes the journal Themelios.",
  "license": "copyrighted",
  "datasets": [],
  "find": {
   "url": "https://www.thegospelcoalition.org/",
   "label": "thegospelcoalition.org"
  },
  "citation": "The Gospel Coalition. The Gospel Coalition, Inc., 2007\u2013. https://www.thegospelcoalition.org/.",
  "cites": [
   "The Gospel Coalition"
  ],
  "onlyWhenCited": true,
  "layer": [
   "currid-ruth",
   "fix-vannoy-1-samuel",
   "kostenberger-john",
   "roh-lifted-up",
   "crowe-walking-on-water",
   "thornton-ruth-foreshadows-christ"
  ]
 }
]
```

## docs/evidence/credits-2026-10-21.json, its own comment
```json
[
 "Who wrote the words behind each Layers cite, and how we know. One record per part of config/layer-sources.json (its evidence id), or per work cited directly. Where parts share a record, its parts list holds what belongs to one part only (books, and chapters where given, as the part names them); those fields replace the record's own for that part.",
 "named_by: where the writer is named: a scan (archive.org identifier) or a page, and leaf, the place on it as a bare noun (title page, contents page, contributors' leaf, preface, signed preface, library record, credit line, title); of: what the leaf belongs to when it is not the printed volume or the page itself; words: as printed (OCR spelling corrected only where it was plainly misread); read: the day the words were read, where it is not the file's first day (the Sources shelf gives the first day where read is left out); name_as: the writer's name as the words print it, where it is not spelled as the credit spells it (Pool, Iunius), or for a row of several writers a map from each writer's id to his printed name (Camer., Villerius). A record with no leaf names no writer, and its note says why. A page with no leaf at level byline is an article whose page names its writer.",
 "level: verse (a cited comment found in the printed book), chapter or volume (matched for the chapter or the volume), title page (the writer named in print, the text not matched), attributed (printed without a writer's name and generally credited to him), site credit (one writer or body, named by the site), byline (the page names its writer), none (no writer can be named yet). matched: how the site's text was matched to the printed book on 2026-10-20: the cites checked, how many were found, and how (of: which printing, where the writer is named in another). note: what is weaker or still missing.",
 "The Sources shelf counts, for each part, the comments config/layers.json cites now and how many of them the 2026-10-20 check found in the printed book (the cites table below; a score under 0.2 is a match only as part of the whole chapter), so the counts stay true as cites change. A part whose writer is excluded, or whose books are all listed in denies, shows no count and no example.",
 "example: one cited comment, its page and nine words of it as the page prints them (read again on the day given), with check: archive.org's search inside the printed book for those words. An example is always a comment the notes cite now, on the part's own books. For the Pulpit Commentary, whose Bible Hub text carries BibleSoft's notice, each example's words are the writer's own comment (never the verse it explains) and were found in the printed volume's scan (in_print: the scan, the leaf and the day), so they are the public-domain printed words; two that the scan's search could not confirm (Joshua 7:25 and 2 Corinthians 1:13) keep only the place (words_left_out). Examples changed on 2026-10-24 (Pulpit on Genesis, Deuteronomy, Job, Isaiah, Ephesians and W. J. Deane's books, Keil on Exodus to Deuteronomy, Delitzsch on Proverbs, Plumptre on Proverbs, Simon Browne) were each found in the printed volume that day.",
 "cites: [passage, note, source, on, matched scan, score] for every Barnes, Ellicott and Pulpit cite matched on 2026-10-20 (score: the share of seven-word runs of the Bible Hub comment found in the scan's OCR), and the per-book attribution of the other many-handed sets, so anyone can re-check one citation. The scripts that made this file are in docs/evidence/tools/; they re-check the evidence and are not part of the build."
]
```

## Sample credit records
```json
[
 {
  "id": "clarke",
  "source": "clarke",
  "work": "clarke",
  "books": "all",
  "writers": [
   "adam-clarke"
  ],
  "named_by": {
   "page": "https://biblehub.com/commentaries/clarke/genesis/1.htm",
   "leaf": "credit line",
   "words": "Commentary on the Bible, by Adam Clarke [1831]. Text Courtesy of Internet Sacred Texts Archive."
  },
  "level": "site credit"
 },
 {
  "id": "spurgeon",
  "source": "spurgeon",
  "work": "spurgeon-treasury",
  "books": [
   "Psalms"
  ],
  "writers": [
   "c-h-spurgeon"
  ],
  "named_by": {
   "page": "https://biblehub.com/commentaries/tod/psalms/1.htm",
   "leaf": "credit line",
   "words": "The Treasury of David, by Charles Haddon Spurgeon [1869-85]. Text Courtesy of Internet Sacred Texts Archive."
  },
  "level": "site credit"
 },
 {
  "id": "figures-of-speech",
  "source": "bullinger-fos",
  "work": "figures-of-speech",
  "books": "all",
  "writers": [
   "e-w-bullinger"
  ],
  "named_by": {
   "scan": "figuresofspeechu00bull",
   "leaf": "title page",
   "words": "Figures of Speech Used in the Bible: Explained and Illustrated. By E. W. Bullinger, D.D."
  },
  "level": "site credit"
 },
 {
  "id": "augustine-tractates-john",
  "source": "church-fathers",
  "work": "augustine-tractates-john",
  "books": "all",
  "writers": [
   "augustine"
  ],
  "named_by": {
   "page": "https://www.newadvent.org/fathers/1701043.htm",
   "leaf": "title",
   "words": "CHURCH FATHERS: Tractates on the Gospel of John (Augustine)",
   "read": "2026-10-24"
  },
  "level": "byline",
  "note": "The page gives the translation as John Gibb's, from the Nicene and Post-Nicene Fathers, first series, vol. 7."
 },
 {
  "id": "currid-ruth",
  "source": "gospel-coalition",
  "work": "currid-ruth",
  "books": "all",
  "writers": [
   "john-currid"
  ],
  "named_by": {
   "page": "https://www.thegospelcoalition.org/commentary/ruth/",
   "words": "Ruth (The Gospel Coalition Bible Commentary), by John Currid"
  },
  "level": "byline"
 }
]
```