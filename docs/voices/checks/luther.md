# Scripture check: Martin Luther

**Made final (2026-11-22).** Shubhanshu made every passage this file lists as left out final ("yes make them all final"). Each now shows "[passage left out]" with the line "A passage is left out here because it calls a word of Scripture a mistake.", or, for one that denies what Scripture says of its writer, "A passage is left out here because it denies what Scripture says of its writer." The config entries record this in `decided`. What follows tells how each was found and judged, as written before that decision; the "until a decision on it is made" line it names is no longer shown.

What was checked, how, and what was decided, for `config/voices/luther.json` (decision 23, rules 3 to 5 and 8). The notes are Martin Luther's *Commentary on the Epistle to the Galatians* (lectures of 1531, printed 1535) in Theodore Graebner's abridged modern English (Grand Rapids: Zondervan, 1939), and his *Lectures on Genesis* (1535 to 1545), chapters 1 to 9, in John Nicholas Lenker's *Luther on the Creation* (Minneapolis, 1904, based on Henry Cole's translation) and *Luther on Sin and the Flood* (Minneapolis, 1910). They are copied from Project Gutenberg's current files of ebooks 1549, 48193 and 27978, mirrored unchanged on the branches `mirror/pg-1549`, `mirror/pg-48193` and `mirror/pg-27978` on 2026-11-14 by `.github/workflows/mirror-web-texts.yml`. Galatians is labelled abridged everywhere it is named (decision 23, rule 8). Luther's harsh words about the pope, the papists, the sects and the rabbis are shown word for word (decision 1).

## What is not shown at all

- Project Gutenberg's header and license.
- Galatians: Graebner's preface, the title page and the lines "From Luther's Introduction, 1538" before chapter 1.
- Genesis: Lenker's introductions, Veit Dietrich's and Henry Cole's prefaces, Luther's address to the reader and the contents, before chapter 1 (2,015 lines before the first chapter in the three books together); in the second volume, the outlines printed before each section and before some lettered parts (1,453 lines), and its two footnotes with their marks.
- The first volume's sections on Genesis 4:8 to 4:14 (9 sections): the second volume begins at 4:8 and is used there.

## Placing

Each section is placed on the verses its heading names ("VERSE 6. I marvel.", "VERSES 11, 12.", "V. 21b and 22.", "Vs. 28-29."). The build checks that each heading's words are those of its verses: Graebner quotes the King James Version, so every Galatians heading is compared with the KJV text; Lenker quotes words close to the American Standard Version, so every Genesis heading's quotation is compared with the ASV. At most one word in five may differ (the translators' spelling or word: "labor", "fulfill", "helpmeet"). All 410 headings passed once these were put right:

- Galatians 3:1: the copy prints "0 foolish Galatians" (the digit 0); read as "O foolish Galatians".
- Galatians 5:10: the copy prints "l have confidence" (a small l); read as "I have confidence".
- Genesis 7:1: the second volume's heading reads "V. 2a." but quotes 7:1 ("And Jehovah said unto Noah, Come thou and all thy house into the ark"), and the next heading is "V. 1b."; the section is placed on 7:1.

Several sections in a row on the same verses are one note (117 joins). On Genesis 5:1 and 8:21 a new section of the second volume begins on the verse the section before ended on; the two are one note, with the new section's heading shown where it starts. Text after a part or section heading and before its first verse heading opens the note of that verse heading, and text left at the end of a section stays with that section's last note. On Genesis 1:1 to 4:7 each note is named by its part ("PART I. GOD'S WORK ON THE FIRST DAY."); from 4:8 by its section and Lenker's paragraph numbers ("V. HOW CAIN WAS PUNISHED FOR HIS MURDER. (paragraphs 153 to 175 in Lenker's numbering)"), which are taken off the paragraphs. Lenker numbers paragraph 87 twice in Genesis 6 and skips 109 in Genesis 9; the copy's numbers are kept as they are.

## Method

The notes as the reader keeps them were scanned with the Barnes scan's patterns (authorship, canon, "myth", "legend", "fable", textual words, and error words within 60 characters of a word for the text or its writer), which flagged 86 paragraphs. Because Luther argues over the Hebrew and its translations far more than over manuscripts, a second scan flagged every paragraph that speaks of a translation or reading ("our translation", "translated", "render", "version", "the Hebrew", "the Latin", "the Seventy", "Jerome", "omit", "reading", and "add" within 50 characters of a word for a translation or the text): 204 more. All 290 paragraphs were read in full against the rules of decision 23, next to what the King James Version and the Berean Standard Bible print at that verse, with the BSB's footnotes.

## Left out

One passage, on Genesis 4:8 (`luther-genesis-4-8`), made final by Shubhanshu on 2026-11-22: "Our translation adds that Cain said: "Let us go out doors." But this is one of the comments of the rabbins, whose relative claim to credit I have fully shown on a previous occasion." The BSB prints Cain's words "Let us go out to the field", with the footnote "SP, LXX, Syriac, and Vulgate; Hebrew Then Cain spoke to his brother Abel". Luther calls those words an addition of the translation and the rabbis' invention, so the passage is a claim against what the BSB prints. The note shows "[passage left out]" there, with the line "A passage is left out here until a decision on it is made." The rest of the paragraph, on Lyra and Eben Ezra, stays.

## Kept, where it was close

- Genesis 4:8, a later paragraph: "What, therefore, could possibly have come into the mind of Jerome when he believed the rabbins, who say Cain was expostulating with his brother?" It is about what Cain's talk with Abel was, not about the words the BSB prints, so it stays.
- Genesis 4:13: Luther's heading reads "My punishment (iniquity) is greater than I can bear (than can be remitted)", and he argues for the bracketed reading against "My punishment is greater than I can bear", which the BSB prints. The BSB's footnote gives "guilt" or "sin" as another reading of the Hebrew word, so this is how to read a Hebrew word, not a claim that the BSB's words are not Scripture.
- Genesis 2:8, 3:6, 3:14, 3:15, 3:17, 8:7, 8:21, 9:6 and 9:27: Luther faults the Latin (Jerome's, or "our translation") or other translators, and in each the BSB prints the Hebrew reading he defends ("in Eden, in the east"; "He will crush your head"; "kept flying back and forth"; "every inclination of his heart is evil").
- Genesis 1:8: he notes that "it was good" is not said of the second day; the BSB does not say it there either.
- Genesis 6:3: Jerome's difficulty over the 120 years, which Luther answers.
- Galatians 1:6: "the reading is a little doubtful" is about how to construe Paul's sentence, not a variant.
- "Not Mosaic" (Genesis 1, of the astronomers' spheres), and the remarks that sacrifice and circumcision are older than Moses: these uphold Moses' account and his writing of Genesis.
- Every "fable", "error" and "corrupt" in the scan is said of people (the rabbis, the papists, the sects, Aristotle, Origen's and Jerome's allegories, the corruption of human nature), or of Lamech's boast, which the text reports as his words.
