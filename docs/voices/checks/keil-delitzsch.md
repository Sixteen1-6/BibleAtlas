# Scripture check: Keil and Delitzsch

What was checked, how, and what was decided, for `config/voices/keil-delitzsch.json` (decision 23, rules 3 to 6). The notes are from C. F. Keil and Franz Delitzsch's *Biblical Commentary on the Old Testament* (written in German 1861 to 1875, in English from T. and T. Clark 1864 to 1878), as CrossWire's KD module 2.0 keeps the Wikisource text. Delitzsch wrote Job, Psalms, Proverbs, the Song of Songs, Ecclesiastes and Isaiah, and Keil every other book (docs/evidence/credits-2026-10-21.json, the `kd-` records).

## What is not shown at all

- Each book's introduction (39 of them, 1,837,281 characters): the reader starts at the comment on the book's first passage, found by the words in `starts`. The introductions are where the authorship arguments sit (Delitzsch on Proverbs 1 to 9, for example), so they were not checked passage by passage.
- Ecclesiastes, whole (`books_out`): Delitzsch holds that Solomon did not write it. Shubhanshu decided this for the shortlist on 2026-10-20 (question 9) and again for the Layers notes on 2026-11-07 (docs/FOUNDER-DECISIONS.md).

## Method

The notes as the reader keeps them were scanned for authorship words ("not written by", "another hand", "later author", "spurious", "interpolat", "post-exilic", "Maccab", "deutero-Isaiah" and the rest), canon words ("apocryphal", "not canonical", "straw"), "myth", "legend", "fable", and error words ("error", "mistake", "crept in", "emend", "corrupt", "gloss", "copyist", "transcrib", "slip of" and the rest) within 60 characters of a word for the text or its writer. The scan flagged 1,125 paragraphs (650 for error words, 378 for authorship, 121 for myth words and 44 for canon words; a paragraph can be flagged for more than one). Every one was read in full against the rules below, next to what the Berean Standard Bible prints at that verse and its footnotes.

- Left out: a passage that says a word, name, number or verse of the Bible, as the BSB prints it, is a mistake, a copyist's error, corrupt, interpolated, crept in or to be amended; that a book or psalm was not written by the writer its title or first verse names, or dates it to a time that writer could not have written in (a psalm of David, Asaph or the sons of Korah set in the exile or the Maccabean age, Isaiah 40 to 66 given to a "deutero-Isaiah"); or that what the text reports as history did not happen.
- Kept: textual remarks that agree with what the BSB prints or leaves out (Keil often makes the very correction the BSB makes: Riphath, Hadad and Pau, Barak for Bedan, seventy at 1 Samuel 6:19, twenty-two at 2 Chronicles 22:2, the fourth month at 2 Kings 25:3); the critics' views that Keil or Delitzsch report in order to answer them; remarks on how the Hebrew can be read, or that a version (the Septuagint, the Vulgate, the English Version) is wrong; opinions the text does not settle; difficulties the note harmonises; and the errors, myths and fables of people.

Each passage left out is the smallest that makes the claim, normally one sentence. A sentence ends at ". ", "? " or "! ", but not inside a reference, after an abbreviation Keil uses ("cf.", "Ew.", "Berth.", "Syr.", "Cod. Vat.", "Gen.", "vol."), after a small Roman numeral, or where the next word starts with a small letter, a number or "§". This changes no other writer's notes. Each is in force at once with the line "A passage is left out here until a decision on it is made." (rule 5), for Shubhanshu to make final.

## One kind of passage for Shubhanshu to decide

In a few places the BSB prints a reading from the Septuagint, or the Masoretes' marginal reading (the Keri), and Keil or Delitzsch rejects that reading to defend the written Hebrew: Daniel 9:24, Ezekiel 36:14, 40:49 and 42:16, 2 Kings 23:33, 2 Samuel 13:34 and 17:3, Psalm 24:6 and Psalm 97:11. These uphold the Hebrew text, but they call words the BSB prints a conjecture, an interpolation or a misreading. They are left out under the rule as written and marked unsure. If Shubhanshu would rather keep them, because the writer is defending the Hebrew Scripture, their entries can simply be removed.

## Left out (209 passages in 129 notes)

Unsure marks a passage that is borderline.

- Genesis 31:43 (sentence): Keil calls Genesis 31:49-50, which the BSB prints as part of the text, a subsequent insertion and interpolation, though he denies it shows a second source and may mean the narrator's own insertion. Unsure.
- Genesis 35:16 (sentence): Keil allows that the words "to this day" in Genesis 35:20, which the BSB prints, might be an interpolation by a later hand; it is hedged and Genesis names no writer. Unsure.
- Genesis 36:20 (sentence): Keil says some differences between the names in Genesis 36:20-30 and 1 Chronicles 1:38-42, which the BSB prints as they stand, arose from copying mistakes; general, so a reviewer should decide. Unsure.
- Leviticus 13:29 (sentence): Keil calls the Hebrew of Lev 13:31 an error, where the BSB prints there is no black hair in it.
- Leviticus 13:29 (sentence): This sentence completes the emendation of Lev 13:31, which the BSB does not make; it prints no black hair.
- Numbers 3:39 (sentence): Keil says one of the Levite clan numbers is a copyist's error, perhaps 8,600 for 8,300 in Num 3:28, where the BSB prints 8,600 and names 8,300 only as a Septuagint reading.
- Numbers 21:30 (sentence): Keil calls the Hebrew word which in Num 21:30 a copyist's error for fire, where the BSB prints which reaches to Medeba and gives fire only as an Or footnote. Unsure.
- Joshua 3:14 (sentence): It says the name at Judges 7:22 should be read Zeredah, but the BSB prints "Zererah" there (with Zeredah only in a footnote).
- Joshua 7:1 (sentence): It calls Zimri a copyist's error, but the BSB prints "Zimri" at 1 Chronicles 2:6 and footnotes it as a variant of Zabdi.
- Joshua 8:11 (sentence): It says one of the ambush numbers is a copyist's error, but the BSB prints 30,000 at Joshua 8:3 and five thousand at Joshua 8:12.
- Joshua 8:11 (sentence): It says the 30,000 is the mistake, but the BSB prints 30,000 at Joshua 8:3.
- Joshua 8:11 (sentence): It says the number in Joshua 8:3 is a mistake, but the BSB prints 30,000 there.
- Joshua 10:12 (sentence): It allows that the day was lengthened only in the Israelites' minds, where Joshua 10:13 reports that the sun stopped and delayed going down about a full day. Unsure.
- Joshua 13:1 (sentence): It says copyists left a whole section out of the town lists, but the BSB prints Joshua 15:59 without any added section (it does print Joshua 21:36-37). Unsure.
- Joshua 19:2 (sentence): It says a town name dropped out of Chronicles by a copyist's error, but the BSB prints 1 Chronicles 4:28 as it stands and reads Sheba at Joshua 19:2 as another name for Beersheba.
- Joshua 19:15 (sentence): It says names have fallen out of the text, but the BSB prints Joshua 19:15 with five names and "twelve cities" as it stands.
- Joshua 19:22 (sentence): It allows that the number is wrong, but the BSB prints "sixteen cities" at Joshua 19:22. Unsure.
- Joshua 19:25 (sentence): It calls Hukok a copyist's error, but the BSB prints "Hukok" at 1 Chronicles 6:75.
- Joshua 21:7 (sentence): It says Chronicles has the true reading against Joshua, but the BSB prints "Ain" at Joshua 21:16 and "Gath-rimmon" at Joshua 21:25 (and footnotes Ashan as a variant of Ain).
- Joshua 21:7 (sentence): It calls the Chronicles names faulty readings, but the BSB prints Aner, Kedesh, Hukok, Rimmono and Tabor at 1 Chronicles 6:70-77.
- Joshua 21:34 (sentence): It calls the text corrupt, but the BSB prints "Rimmono and Tabor" at 1 Chronicles 6:77 (with the Septuagint's four names only in a footnote).
- Judges 1:27 (sentence): It says Endor dropped out of the verse by a copyist's error, but the BSB prints Judges 1:27 without Endor as it stands.
- Judges 3:7 (sentence): It says Saul did not reign forty years and ascribes that figure in Paul's speech to Jewish tradition, but the BSB prints "forty years" at Acts 13:21 and "forty-two years" at 1 Samuel 13:1.
- Judges 7:2 (sentence): It offers as one option that "Gilead" is a textual error for "Gilboa", but the BSB prints "Mount Gilead" at Judges 7:3. Unsure.
- 1 Samuel 13:1 (sentence): It calls the reading Saul was thirty years old incorrect, but the BSB prints thirty years old at 1 Samuel 13:1.
- 1 Samuel 13:1 (sentence): It argues against the age of thirty that the BSB prints at 1 Samuel 13:1. Unsure.
- 1 Samuel 13:1 (sentence): It reconstructs Saul's reign as twenty-two years, but the BSB prints forty-two years at 1 Samuel 13:1.
- 2 Samuel 8:8 (sentence): Says the town name Betah in 2 Samuel 8:8 was written by mistake; the BSB prints Betah from the Hebrew and gives Tebah only as an LXX reading in a footnote.
- 2 Samuel 8:8 (sentence): Supports the claim that the name Betah, which the BSB prints in 2 Samuel 8:8, is a mistake.
- 2 Samuel 8:9 (sentence): Says the name Joram in 2 Samuel 8:10 is a slip of the pen; the BSB prints Joram and footnotes it as a variant of Hadoram.
- 2 Samuel 8:11 (sentence): Says the text of 1 Chronicles 18:11 is faulty for lacking Aram; the BSB prints that verse as from Edom and Moab, with no Aram.
- 2 Samuel 8:11 (sentence): Says words have dropped out of 1 Chronicles 18:11 as the BSB prints it (from Edom and Moab) and that both texts once read differently.
- 2 Samuel 8:17 (sentence): Leaves open that the name Sheva, which the BSB prints in 2 Samuel 20:25 as another name of the scribe, is a mistake; hedged, so marked unsure. Unsure.
- 2 Samuel 10:6 (sentence): The BSB prints 20,000 foot soldiers (2 Samuel 10:6) and 32,000 chariots (1 Chronicles 19:7); Keil says both texts contain copyists' errors.
- 2 Samuel 12:30 (sentence): The BSB prints 'put them to work with saws' (2 Samuel 12:31, literally 'put them under saws'); Keil says the Hebrew verb must be emended to 'sawed'.
- 2 Samuel 13:34 (paragraph): The BSB prints the Septuagint's added words 'And the watchman went and reported to the king...' in 2 Samuel 13:34; the footnote calls them worthless glosses.
- 2 Samuel 14:26 (sentence): The BSB prints 'two hundred shekels' (2 Samuel 14:26); Keil calls the figure much too high.
- 2 Samuel 14:26 (sentence): The BSB prints 'two hundred shekels' (2 Samuel 14:26); this sentence repeats that the number is too high.
- 2 Samuel 14:26 (sentence): The BSB prints 'two hundred shekels' (2 Samuel 14:26); Keil says the number is an error in the text.
- 2 Samuel 17:1 (paragraph): The BSB follows the Septuagint in 2 Samuel 17:3 ('as a bride returning to her husband. You seek the life of only one man'); the footnote calls those words a false reading and an interpolation.
- 2 Samuel 22:14 (sentence): The BSB prints 'hailstones and coals of fire' at Psalm 18:13 (most Hebrew manuscripts); Keil calls the words a gloss that crept in.
- 2 Samuel 23:8 (sentence): The BSB prints the names in 2 Samuel 23 and 1 Chronicles 11 as they stand; Keil says many of them are corrupt in both texts.
- 2 Samuel 23:8 (sentence): The BSB prints 'Josheb-basshebeth' (2 Samuel 23:8); Keil calls it unquestionably spurious.
- 2 Samuel 23:8 (sentence): The BSB prints 'Josheb-basshebeth' in 2 Samuel 23:8; this sentence finishes the argument that the Samuel name is wrong.
- 2 Samuel 23:8 (sentence): The BSB prints 'the Tahchemonite' (2 Samuel 23:8, footnote: probably a variant of Hachmonite); Keil calls the word faulty.
- 2 Samuel 23:8 (sentence): The BSB prints 2 Samuel 23:8 as it stands; this clause again asserts unquestionable corruptions in the verse. Unsure.
- 2 Samuel 23:8 (sentence): The BSB prints 'three hundred men' in 1 Chronicles 11:11; Keil says the number found its way in from another verse.
- 2 Samuel 24:6 (sentence): The BSB prints 'the land of Tahtim-hodshi' (2 Samuel 24:6, footnote: Hebrew); Keil says the text is very probably corrupt.
- 2 Samuel 24:6 (sentence): The BSB prints 'Tahtim-hodshi' (2 Samuel 24:6); this sentence presumes that reading is corrupt.
- 2 Samuel 24:24 (sentence): The BSB prints fifty shekels of silver (2 Samuel 24:24) and six hundred shekels of gold (1 Chronicles 21:25); Keil says one number must be corrupt.
- 2 Samuel 24:24 (sentence): The BSB prints fifty shekels of silver in 2 Samuel 24:24; Keil says that figure appears much too low and the Chronicles figure more correct.
- 1 Kings 4:31 (sentence): It calls the difference between Darda and Dara a copyist's error, but the BSB prints Darda in 1 Kings 4:31 and Dara in 1 Chronicles 2:6.
- 1 Kings 7:13 (sentence): It calls thirty-five in 2 Chronicles 3:15 an error from confused numeral letters, but the BSB prints two pillars which together were thirty-five cubits high.
- 1 Kings 7:13 (sentence): It rejects the reading together thirty-five cubits, which is the one the BSB prints at 2 Chronicles 3:15. Unsure.
- 1 Kings 7:16 (sentence): It says three cubits in 2 Kings 25:17 rests on an error of the text, but the BSB prints three cubits there.
- 1 Kings 7:24 (sentence): It calls figures of oxen in 2 Chronicles 4:3 a slip of the pen, but the BSB prints figures of oxen there.
- 1 Kings 9:18 (sentence): It calls the Hebrew of 1 Kings 9:18 faulty and says a name has dropped out, where the BSB translates the verse as it stands, Tamar in the Wilderness of Judah. Unsure.
- 1 Kings 11:14 (sentence): It says Hadad in Chronicles is a mistake for Hadar, but the BSB prints Hadad at 1 Chronicles 1:50 and at Genesis 36:39.
- 1 Kings 15:1 (sentence): It calls Micaiah in 2 Chronicles 13:2 a copyist's error for Maacah, but the BSB prints Micaiah there, following the Hebrew.
- 2 Kings 10:1 (sentence): The BSB prints 'the officials of Jezreel' (2 Kings 10:1, footnote: Hebrew); Keil says 'Jezreel' is an error of the text.
- 2 Kings 12:19 (sentence): The BSB prints 'Zabad' (2 Chronicles 24:26) and 'Jozabad' (2 Kings 12:21), noting they are variants; Keil calls Zabad a copyist's error.
- 2 Kings 12:19 (sentence): The BSB prints 'Shomer' (2 Kings 12:21) and notes it is a variant of Shimrith; Keil says it probably arose from a slip of the pen, though he allows another explanation. Unsure.
- 2 Kings 15:1 (sentence): The BSB prints 'the twenty-seventh year of Jeroboam' (2 Kings 15:1); Keil says the number crept in by error and should be fifteenth.
- 2 Kings 15:17 (sentence): The BSB prints 'throughout his reign' (all his days) in 2 Kings 15:18; Keil suggests, hedged, that the words arose from a copyist's error. Unsure.
- 2 Kings 23:33 (sentence): The BSB prints 'so that he could not reign in Jerusalem' (2 Kings 23:33), the Keri reading that Keil calls only an emendation; the sense is not disputed. Unsure.
- 2 Kings 25:13 (sentence): The BSB prints 'three cubits' for the capital (2 Kings 25:17); Keil says the text must be read as five cubits.
- 2 Kings 25:22 (sentence): The BSB prints 'Johanan and Jonathan the sons of Kareah' (Jeremiah 40:8); Keil leans toward 'and Jonathan' having crept into the text by mistake. Unsure.
- 2 Kings 25:27 (sentence): The BSB prints the twenty-seventh day (2 Kings 25:27) and the twenty-fifth day (Jeremiah 52:31); Keil says one arose from confusing numeral letters.
- 1 Chronicles 2:6 (sentence): It suggests Zimri in 1 Chronicles 2:6 may be a mistake, where the BSB prints Zimri and notes it as a variant of Zabdi. Unsure.
- 1 Chronicles 2:6 (sentence): It suggests Zabdi in Joshua 7:1 may be an error, where the BSB prints Zabdi as a variant of Zimri. Unsure.
- 1 Chronicles 2:6 (sentence): It calls the difference between Dara and Darda a copyist's error, but the BSB prints Dara in 1 Chronicles 2:6 and Darda in 1 Kings 4:31.
- 1 Chronicles 2:18 (sentence): It calls 1 Chronicles 2:18 corrupt, but the BSB prints it as children by his wife Azubah and by Jerioth.
- 1 Chronicles 2:18 (sentence): It says 1 Chronicles 2:18 is at fault and should be reread, but the BSB prints Jerioth as a second mother.
- 1 Chronicles 2:42 (sentence): It doubts the Hebrew of 1 Chronicles 2:42, which the BSB prints as Mareshah the father of Hebron.
- 1 Chronicles 2:42 (sentence): It proposes that Mareshah in 1 Chronicles 2:42 is an error for Mesha, but the BSB prints Mareshah. Unsure.
- 1 Chronicles 2:52 (sentence): It calls Haroeh in 1 Chronicles 2:52 a corruption, but the BSB prints Haroeh.
- 1 Chronicles 3:17 (sentence): It says a name dropped out of 1 Chronicles 3:22, but the BSB prints the six descendants as Shemaiah and his five sons.
- 1 Chronicles 4:24 (sentence): It calls Jarib in 1 Chronicles 4:24 a copyist's error for Jachin, but the BSB prints Jarib.
- 1 Chronicles 7:12 (sentence): It calls the name Shuppim in 1 Chronicles 7:12 an error, but the BSB prints the Shuppites.
- 1 Chronicles 7:12 (sentence): It says the name forms in 1 Chronicles 7:12 arose from a mistaken comparison, but the BSB prints the Shuppites and Huppites. Unsure.
- 1 Chronicles 7:12 (sentence): It says words and a whole verse have dropped out of 1 Chronicles 6:61 and 6:69, but the BSB prints those verses without them.
- 1 Chronicles 7:14 (sentence): It says words have dropped out of 1 Chronicles 7:14 by a copyist, where the BSB prints the verse as it stands. Unsure.
- 1 Chronicles 7:35 (sentence): It says Helem or Hotham is a copyist's error, where the BSB prints both and calls Helem possibly another name for Hotham. Unsure.
- 1 Chronicles 8:3 (sentence): It suggests Huram in 1 Chronicles 8:5 is a copyist's error, but the BSB prints Huram; the note then allows they may be different persons. Unsure.
- 1 Chronicles 8:13 (sentence): It approves Bertheau's guess that the name Elpaal dropped out and Ahio is a misread word in 1 Chronicles 8:14, but the BSB prints Ahio, Shashak, Jeremoth. Unsure.
- 1 Chronicles 9:25 (sentence): It suggests the words of 1 Chronicles 9:26 arose from a copyist's error, but the BSB prints the four chief gatekeepers, who were Levites. Unsure.
- 1 Chronicles 11:10 (sentence): It says the differing names, which the BSB prints in both 2 Samuel 23 and 1 Chronicles 11, came from copyists' errors. Unsure.
- 1 Chronicles 11:10 (sentence): It says lines have dropped out of 1 Chronicles 11:13, but the BSB prints the verse as it stands.
- 1 Chronicles 11:10 (sentence): It says the plural verbs are wrong, but the BSB prints them as plurals, Eleazar and David stationed themselves.
- 1 Chronicles 11:10 (sentence): It says the plurals of 1 Chronicles 11:14 were added by a copyist, but the BSB prints them.
- 1 Chronicles 11:10 (sentence): It rewrites 1 Chronicles 11:13 as it supposedly stood originally, against the verse as the BSB prints it.
- 1 Chronicles 15:16 (sentence): It says a name has dropped out of 1 Chronicles 15:18, where the BSB follows the Hebrew and does not add Azaziah. Unsure.
- 1 Chronicles 15:16 (sentence): It calls Jeiel in 1 Chronicles 16:5 a copyist's error, but the BSB prints Jeiel there.
- 1 Chronicles 15:27 (sentence): It says the singers in 1 Chronicles 15:27 came in by a copyist's error, but the BSB prints the director of music for the singers.
- 1 Chronicles 16:4 (sentence): It calls Jeiel in 1 Chronicles 16:5 a copyist's error, but the BSB prints Jeiel there.
- 1 Chronicles 16:37 (sentence): It says a name has dropped out of 1 Chronicles 16:38, but the BSB prints Obed-edom and his sixty-eight relatives as a whole verse.
- 1 Chronicles 16:37 (sentence): It calls the text of 1 Chronicles 16:38, which the BSB prints without a gap, defective.
- 1 Chronicles 16:41 (sentence): It says the names Heman and Jeduthun were added to 1 Chronicles 16:42 by a copyist, but the BSB prints them.
- 1 Chronicles 16:41 (sentence): It treats Heman and Jeduthun in 1 Chronicles 16:42 as names to be omitted, but the BSB prints them.
- 1 Chronicles 21:15 (sentence): It says God sent an angel to Jerusalem in 1 Chronicles 21:15 makes no sense, but that is what the BSB prints. Unsure.
- 1 Chronicles 21:15 (sentence): It says the writer originally wrote that the angel of God stretched out his hand, against 1 Chronicles 21:15 as the BSB prints it, God sent an angel.
- 1 Chronicles 21:15 (sentence): It says a copyist transposed the words of 1 Chronicles 21:15, but the BSB prints God sent an angel.
- 1 Chronicles 23:3 (sentence): It says thirty in 1 Chronicles 23:3 crept in by copyists' error and should read twenty, but the BSB prints thirty years of age.
- 1 Chronicles 23:3 (sentence): It doubts the statement of 1 Chronicles 23:3, which the BSB prints as Levites thirty years of age or older. Unsure.
- 1 Chronicles 23:3 (sentence): It dismisses every harmonising of 1 Chronicles 23:3 with 23:24 in order to call thirty a copyist's error, where the BSB prints both verses. Unsure.
- 1 Chronicles 23:24 (sentence): It calls thirty years in 1 Chronicles 23:3 incorrect and a copyist's error, but the BSB prints thirty years of age.
- 2 Chronicles 3:1 (sentence): The BSB prints 'on the second day of the second month' (2 Chronicles 3:2); Bertheau's view that 'second (day)' is a gloss is reported after Keil calls the word strange, and is not answered. Unsure.
- 2 Chronicles 4:2 (sentence): The BSB prints 'oxen' (2 Chronicles 4:3) and 'three thousand baths' (4:5); Keil says these are probably copying errors.
- 2 Chronicles 5:4 (sentence): The BSB prints 'The Levitical priests carried them up' (2 Chronicles 5:5); Keil says the words are inexact and must be corrected from 1 Kings 8:4.
- 2 Chronicles 5:4 (sentence): The BSB prints 'The Levitical priests' (2 Chronicles 5:5); Keil says an 'and' was dropped by a copyist.
- 2 Chronicles 5:4 (sentence): The BSB main text of 2 Chronicles 5:9 follows the Hebrew 'from the ark' reading (the Holy Place reading is only in its footnote); Keil calls 'from the ark' a copyist's mistake. Unsure.
- 2 Chronicles 13:18 (sentence): The BSB prints 400,000, 800,000 and 500,000 slain (2 Chronicles 13:3, 13:17); Keil says these figures are not literal but only express contemporaries' opinion. Unsure.
- 2 Chronicles 16:1 (paragraph): The BSB prints the thirty-sixth year (2 Chronicles 16:1) and the thirty-fifth year (15:19); the paragraph argues both are copyist's errors for 15 and 16.
- 2 Chronicles 20:31 (sentence): The BSB prints 'ships to go to Tarshish' (2 Chronicles 20:36); Keil calls the Chronicler's wording a mistake.
- 2 Chronicles 20:31 (sentence): The BSB prints 'ships to go to Tarshish' (2 Chronicles 20:36-37); this sentence again calls the Chronicler's wording erroneous.
- 2 Chronicles 30:27 (sentence): The BSB prints 'the priests and the Levites' (2 Chronicles 30:27), following the 'and' that Keil calls a copyist's gloss.
- Ezra 1:11 (sentence): Keil says the differences between the lists in Ezra 2 and Nehemiah 7, whose names and numbers the BSB prints as they stand, arose from copying mistakes; it is a general remark, so a reviewer should decide. Unsure.
- Ezra 2:3 (sentence): The BSB prints "the other Nebo" in Nehemiah 7:33, and Keil says the word "other" was put in by a copyist's slip; the claim is hedged with "seems". Unsure.
- Ezra 2:64 (sentence): Keil says the separate numbers in Ezra 2, which the BSB prints as they stand and which do not add up to the total of 42,360, owe their differences to copyists' errors; general, so a reviewer should decide. Unsure.
- Ezra 2:64 (sentence): Keil says copying errors entered the numbers of the list in Ezra 2 that the BSB prints as they stand; general, so a reviewer should decide. Unsure.
- Ezra 2:68 (sentence): The BSB prints 530 priestly garments in Nehemiah 7:70, and Keil says that statement is defective.
- Ezra 2:68 (sentence): Keil says words of Nehemiah 7:70 as the BSB prints it were dropped by a copyist's error.
- Ezra 2:68 (sentence): Keil says figures in Ezra 2:69, which the BSB prints as 61,000 darics and 5,000 minas, arose from errors in the text.
- Ezra 2:68 (sentence): The BSB prints 61,000 darics of gold in Ezra 2:69, and Keil says it must be corrected to 41,000.
- Ezra 8:3 (sentence): The BSB prints "of the descendants of Shecaniah" in Ezra 8:3 as the Hebrew has it, with no footnote, and Keil calls those words a corruption of the text.
- Ezra 8:3 (sentence): Keil says the original text of Ezra 8:3, which the BSB prints as the Hebrew has it, is lost and cannot be restored; it follows from the corruption claim. Unsure.
- Ezra 10:25 (sentence): The BSB prints Bani in both Ezra 10:29 and Ezra 10:34, and Keil says one of them is a mistake for another name.
- Ezra 10:25 (sentence): Keil says the name Bani that the BSB prints in Ezra 10:34 is an error of transcription.
- Nehemiah 4:23 (sentence): Keil calls the Hebrew of Neh 4:23 unmeaning and adopts a changed text; the BSB prints each carried his weapon, even to go for water, giving the right-hand reading only as an Or footnote. Unsure.
- Nehemiah 8:4 (sentence): Keil says the name Azariah has dropped out of the Hebrew of Neh 8:4, where the BSB prints six men on Ezra's right with no Azariah.
- Nehemiah 8:4 (sentence): This quoted sentence, which Keil adopts, treats Azariah as a name to be inserted into Neh 8:4, which the BSB does not print. Unsure.
- Nehemiah 9:4 (sentence): Keil puts the differing Levite names of Neh 9:4-5 down to a clerical error, where the BSB prints Bunni, Bani, Chenani and Hashabneiah.
- Nehemiah 9:4 (sentence): Keil says the names Bunni, Bani, Chenani and Hashabniah are a clerical error, where the BSB prints them in Neh 9:4-5.
- Nehemiah 11:10 (sentence): Keil says the word son before Joiarib crept into the text by a clerical error, where the BSB prints Jedaiah son of Joiarib.
- Nehemiah 11:10 (sentence): Keil says the words heads of fathers in Neh 11:13 came into the text from 1 Chronicles, where the BSB prints the leaders of families.
- Nehemiah 11:10 (sentence): This sentence continues the doubt that leaders of families in Neh 11:13 is genuine, words the BSB prints. Unsure.
- Nehemiah 12:1 (sentence): Keil puts the differing priestly names of Neh 12:12-21 down to clerical errors, where the BSB prints them as variant forms of the names in verses 1-7. Unsure.
- Nehemiah 12:1 (sentence): Keil calls the name Azariah in the Neh 10 list evidently a clerical error, though he allows another form; the BSB prints Azariah at Neh 10:2. Unsure.
- Nehemiah 12:1 (sentence): Keil says a name dropped out of the Neh 10 list of priests in copying, which says the list the BSB prints is defective. Unsure.
- Nehemiah 12:24 (sentence): Keil would expunge the word son before Kadmiel as a gloss, where the BSB prints Jeshua son of Kadmiel.
- Job 9:25 (sentence): It floats changing the Hebrew word to another reading, but the BSB prints "boats of papyrus" at Job 9:26 from the word as it stands. Unsure.
- Job 15:25 (sentence): In Wetzstein's note this sentence calls the destruction of Sodom, which Genesis 19 reports as history, a legend. Unsure.
- Psalm 18:49 (sentence): Calls the omission at 2 Samuel 22:14 correct, implying that 'hailstones and coals of fire', which the BSB prints at Psalm 18:13, is not original. Unsure.
- Psalm 18:49 (sentence): Says the text of 2 Samuel 22, which the BSB translates, rests on careless transmission.
- Psalm 18:49 (sentence): Says popular forms have crept into the text of 2 Samuel 22 as the BSB translates it.
- Psalm 24:2 (sentence): Calls 'God of' an interpolation, while the BSB at Psalm 24:6 prints 'O God of Jacob' from the LXX and Syriac. Unsure.
- Psalm 27:1 (sentence): Questions that David, named in the BSB title of Psalm 27, wrote the psalm. Unsure.
- Psalm 27:1 (sentence): Suggests the second half of Psalm 27, titled 'Of David' in the BSB, is by another writer. Unsure.
- Psalm 44:1 (sentence): Names Isaiah 40 to 66 as the work of a 'deutero-Isaiah', while the BSB gives the book to Isaiah. Unsure.
- Psalm 73:27 (sentence): Dates Psalms 74 and 79, titled 'of Asaph' in the BSB, to the exile or the Maccabean age.
- Psalm 73:27 (sentence): Argues that Psalms 74 and 79, titled 'of Asaph' in the BSB, fit the Maccabean age.
- Psalm 73:27 (sentence): Says Psalm 79, titled 'A Psalm of Asaph' in the BSB, arose in the Maccabean calamities.
- Psalm 73:27 (sentence): Argues for Maccabean psalms in the Psalter in support of a Maccabean date for Psalms 74 and 79, titled 'of Asaph' in the BSB.
- Psalm 73:27 (sentence): Dates Psalm 79, titled 'A Psalm of Asaph' in the BSB, to the time of the exile. Unsure.
- Psalm 73:27 (sentence): Dates parts of Psalm 74, titled 'A Maskil of Asaph' in the BSB, to the Maccabean age and others to the exile.
- Psalm 73:27 (sentence): Gives Psalms 74 and 79, titled 'of Asaph' in the BSB, to a writer of the exile. Unsure.
- Psalm 73:27 (sentence): Makes the writer of Psalms 74 and 79, titled 'of Asaph' in the BSB, later than Jeremiah. Unsure.
- Psalm 73:27 (sentence): Says Psalms 74 and 79, titled 'of Asaph' in the BSB, cannot be earlier than the Chaldaean destruction.
- Psalm 73:27 (sentence): Dates Psalms 74 and 79, titled 'of Asaph' in the BSB, to 588 or 167 BC.
- Psalm 73:27 (sentence): Allows Maccabean psalms in the Psalter, as grounds for dating Psalms 74 and 79, titled 'of Asaph' in the BSB.
- Psalm 73:27 (sentence): Dates Psalms 74 and 79, titled 'of Asaph' in the BSB, to the Maccabean age under Antiochus and Demetrius.
- Psalm 74:4 (sentence): Delitzsch favours a Maccabean date for a psalm whose title names Asaph.
- Psalm 74:4 (sentence): Identifies the signs in Psalm 74:4, titled 'A Maskil of Asaph' in the BSB, with the Maccabean events of 1 Maccabees 1.
- Psalm 74:4 (sentence): Reads Psalm 74:8, titled 'A Maskil of Asaph' in the BSB, as speaking of synagogues, in support of a late date. Unsure.
- Psalm 74:18 (sentence): Delitzsch sets the psalm, whose title names Asaph, in the Maccabean age. Unsure.
- Psalm 74:18 (sentence): Reads Psalm 74:20, titled 'A Maskil of Asaph' in the BSB, as describing the Seleucid persecution.
- Psalm 74:18 (sentence): Dates Psalm 74, titled 'A Maskil of Asaph' in the BSB, to the Maccabean age.
- Psalm 79:1 (sentence): Dates Psalm 79, titled 'A Psalm of Asaph' in the BSB, to the Maccabean age.
- Psalm 85:4 (sentence): Dates Psalm 85, titled 'A Psalm of the sons of Korah' in the BSB, after the exile. Unsure.
- Psalm 86:1 (sentence): Delitzsch denies that David wrote Psalm 86, whose title names him.
- Psalm 86:1 (sentence): The next sentence makes the same claim: its writer is not David.
- Psalm 96:1 (sentence): Says the chronicler strung psalms together to approximate the song, while the BSB at 1 Chronicles 16:7 says David committed this song to Asaph that day. Unsure.
- Psalm 96:1 (sentence): Dates Psalm 96 after the exile, although the BSB at 1 Chronicles 16:7 and 23 to 33 has David committing its words to Asaph. Unsure.
- Psalm 96:1 (sentence): Names Isaiah 40 to 66 'deutero-Isaianic', while the BSB gives the book to Isaiah. Unsure.
- Psalm 97:10 (sentence): Calls the reading 'Light shines' a misapprehension, while the BSB at Psalm 97:11 prints 'Light shines on the righteous'. Unsure.
- Psalm 105:1 (sentence): Says the chronicler built the song of 1 Chronicles 16 from later psalms on a mistaken assumption, while the BSB at 1 Chronicles 16:7 says David committed this song to Asaph that day. Unsure.
- Psalm 122:1 (sentence): Treats the title 'Of David', which the BSB prints over Psalm 122, as added without discernment.
- Psalm 122:1 (sentence): Denies that David, named in the BSB title of Psalm 122, wrote the psalm.
- Psalm 122:1 (sentence): Dates Psalm 122, titled 'Of David' in the BSB, to post-exilic Jerusalem.
- Psalm 122:2 (sentence): Reads Psalm 122, titled 'Of David' in the BSB, as a song of the post-exilic restoration. Unsure.
- Psalm 130:1 (words): Delitzsch says Psalm 86, whose title names David, is not David's; only those words are left out, since Psalm 130's title names no writer.
- Psalm 139:1 (sentence): Says the language of Psalm 139, titled 'A Psalm of David' in the BSB, could not belong to David's age.
- Psalm 139:1 (sentence): Dates Psalm 139, titled 'A Psalm of David' in the BSB, to the post-exilic period.
- Psalm 139:1 (sentence): Places Psalm 139, titled 'A Psalm of David' in the BSB, among psalms marked by the Babylonian exile.
- Proverbs 3:35 (sentence): Delitzsch (after Bottcher) suggests the Hebrew word the BSB translates at Proverbs 3:35 may be a transcriber's error; the BSB prints 'fools are held up to shame' from that text. Unsure.
- Proverbs 19:7 (sentence): Delitzsch says a line of Prov 19:7 is lost from the Hebrew and the third line is a fragment, where the BSB prints the verse whole in three lines. Unsure.
- Proverbs 22:16 (sentence): Delitzsch gives Proverbs 1-9 to the later writer of the preface to the words of the wise, who wrote after the Solomonic collection was formed, where Prov 1:1 heads these chapters the proverbs of Solomon. Unsure.
- Proverbs 28:3 (sentence): Delitzsch changes the Hebrew word poor in Prov 28:3 to head and suggests a transcriber's slip, where the BSB prints A destitute leader, keeping poor as destitute. Unsure.
- Isaiah 36:1 (sentence): Calls 2 Kings 18:14-16, which the BSB prints, an annalistic interpolation, though Delitzsch seems to mean material the writer of Kings added from the annals. Unsure.
- Isaiah 36:1 (sentence): Says the titles Tartan and Rabsaris have dropped out of Isaiah 36:2, where the BSB prints only the Rabshakeh. Unsure.
- Isaiah 37:36 (sentence): Allows that 'that very night', which the BSB prints at 2 Kings 19:35, may be a careless interpolation. Unsure.
- Isaiah 37:36 (sentence): Says Isaiah 37:37-38, part of the book the BSB gives to Isaiah, may have been added by a later hand. Unsure.
- Isaiah 39:1 (sentence): Says the name 'Hezekiah' that the BSB prints at 2 Kings 20:12 arose from a misread word; the rest of the sentence agrees with the BSB at Isaiah 39:1. Unsure.
- Jeremiah 41:16 (sentence): Says 'whom he had recovered from', which the BSB prints at Jeremiah 41:16, arose from a scribe's error.
- Jeremiah 52:12 (sentence): It says one of the dates is a copying mistake, but the BSB prints the tenth day at Jeremiah 52:12 and the seventh day at 2 Kings 25:8.
- Jeremiah 52:15 (sentence): It says these words came in by a copyist's error, but the BSB prints "some of the poorest people" at Jeremiah 52:15.
- Jeremiah 52:17 (sentence): It says 2 Kings lacks a word through a copying error, but the BSB prints 2 Kings 25:14 without the sprinkling bowls as it stands. Unsure.
- Jeremiah 52:24 (sentence): It accepts reading "seventeenth" for "seventh", but the BSB prints "in the seventh year" at Jeremiah 52:28.
- Jeremiah 52:31 (sentence): It says one of the dates is a clerical error, but the BSB prints the twenty-fifth day at Jeremiah 52:31 and the twenty-seventh at 2 Kings 25:27.
- Ezekiel 13:20 (sentence): Keil says the Hebrew of Ezekiel 13:20 cannot be correct and must be altered; the BSB translates the Hebrew without any change. Unsure.
- Ezekiel 32:17 (sentence): Keil says a copyist dropped the month from Ezekiel 32:17; the BSB prints the verse as the Hebrew has it, with no month.
- Ezekiel 36:1 (sentence): Keil calls the Masoretic reading bereave in Ezekiel 36:14 incorrect; the BSB prints that reading, deprive your nation of its children. Unsure.
- Ezekiel 40:48 (sentence): Keil calls the Septuagint's readings in Ezekiel 40:49 arbitrary interpolations; the BSB prints them, twelve cubits deep and ten steps. Unsure.
- Ezekiel 42:15 (sentence): Keil says the measure in Ezekiel 42:16-20 is rods, not cubits; the BSB prints five hundred cubits, following the Septuagint. Unsure.
- Ezekiel 45:9 (sentence): Keil says the Hebrew of Ezekiel 45:12 is corrupt; the BSB prints it as it stands, twenty plus twenty-five plus fifteen shekels.
- Daniel 9:24 (sentence): Calls the Keri reading to end (sin) decidedly erroneous, but the BSB follows it in Daniel 9:24 (to put an end to sin); Keil is defending the written Hebrew, so marked unsure. Unsure.
- Daniel 9:24 (sentence): Says the Keri reading followed by the BSB in Daniel 9:24 (to put an end to sin) gives no suitable meaning; marked unsure as it defends the written Hebrew. Unsure.
- Daniel 9:24 (sentence): Says only the written reading is correct in Daniel 9:24, against the BSB's to put an end to sin; the first clause agrees with the BSB's to stop their transgression, so marked unsure. Unsure.
- Zechariah 11:14 (sentence): Says the name Jeremiah at Matthew 27:9, which the BSB prints, is a failure of memory or a copyist's error.

## Kept after a closer look

- Daniel 11:1: Keil, quoting Kranichfeld, says the prophecy is "full of inaccuracies" against the history of the Maccabean age and foretells an expedition no history records. The point is that the chapter was not written in that age as the critics hold: Keil reads verses 36 to 45 of Antichrist. It defends the book, so it stays.
- Genesis 31:9: Keil suspects that the vision Jacob tells his wives about was only a dream. It doubts Jacob's words to his wives, which the narrator reports but does not affirm, and not the narrator.
- 2 Chronicles 15:8: the BSB itself supplies "Azariah son of", which is the second of Keil's explanations.
- 1 Samuel 17:12, 2 Samuel 14:4, 15:20 and 17:28, 2 Kings 8:16: Keil prefers the Hebrew to a Septuagint reading the BSB follows, without calling the BSB's words wrong.
- Zechariah 14:6: Keil prefers the written Hebrew to the marginal reading the BSB follows, and calls no word an error.
- Psalms 93, 94, 96 and 97: only the Septuagint's title "of David" is called worthless; the BSB gives these psalms no title.
- Small points of Hebrew spelling that do not change the BSB's English (a preposition, a letter, a word for a door leaf).

The other flagged paragraphs were plainly within the kept list above.

## The copy

The Wikisource text is CC BY-SA 3.0, and the notes shown are shared under CC BY-SA 4.0 (decision 23, rule 6; NOTICE.md). The Wikisource revision the module was made from is not recorded: CrossWire's module gives its source page but no revision, and Wikisource could not be reached from where the build runs to look it up.
