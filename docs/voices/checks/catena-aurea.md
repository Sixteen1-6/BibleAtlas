# The Catena clean-up: what is left out, and the notes on names

What was left out of the Church Fathers' chain (the Catena Aurea, `catena-aurea`), how, and on whose decision, for `config/voices/catena-aurea.json`. The founder approved the shortlist's answer on 2026-10-21 (docs/FOUNDER-DECISIONS.md, the lists paragraph, answer 5): hide Origen, Didymus and the Arian writer shown as "Pseudo-Chrysostom" in Matthew, with a visible line that a quotation was left out; keep Eusebius with a one-line note; keep Victor of Antioch in Mark. Decision 23 adds two: Clement of Alexandria's one quotation is hidden with a truthful line (item 2), and Josephus keeps his one, labelled "the Jewish historian of the first century, quoted by Aquinas as a witness; not a Christian writer" (item 9). The copy is the Catena corpus at commit `efe1bd0`.

## Counted in the pinned copy

| Rule | Found | Where |
|---|---|---|
| Origen | 638 | Matthew 310, Mark 10, Luke 153, John 165 |
| Didymus | 9 | John |
| Clement of Alexandria (spelled "Alexendria" in the copy) | 1 | Luke 21:34-36 |
| "Pseudo-Chrysostom" in Matthew 1 to 25 with no citation of its own | 426 | chapters 1 to 8, 11 and 19 to 24 |
| "Pseudo-Chrysostom" cited "Chrys. Op. imp" | 1 | Luke 16:22-26 |

1,075 in all. The build fails if any rule finds another number. The unfinished work on Matthew has no homilies on chapters 26 to 28 (VOICES-BUILD-SPEC fact 3), so the one quotation there with no citation (27:39-44) stays.

## Kept

- "Pseudo-Chrysostom" in Matthew: 13. Nine carry their own citation in chapters 1 to 22 ("Homil. in Matt. Hom. i." at 1:1, "ubi sup." at 1:12, "vid. Phil. 3:2:3." at 5:10, "Hom. xv." at 6:2, "non occ." at 6:5, "quoad sens." at 8:1, "in loc." at 11:7, "in fin. Hom. xxxix." at 21:45, "non occ. sed vid. Gloss. ord." at 22:1). The spec leaves these out only where their words are tied to the unfinished work on a dated scan of the Oxford translation's notes or of the work itself; that was not done, so they stay under "a writer once thought to be Chrysostom" for the founder to decide. The other four are at 27:39-44, 27:45 (two, from sermons on the Cross and the Passion) and 28:1 (a sermon on the Resurrection).
- "Pseudo-Chrysostom" in Luke: 11, from sermons once credited to Chrysostom (on the rich man, on the blind man and Zacchaeus).
- "Pseudo-Chrysostom" in Mark: 109, 101 of them cited "Vict. Ant." by the copy, under the note "in Mark mostly Victor of Antioch, an early commentator on Mark, as the copy's references name him".
- Eusebius: 82, with the note "bishop of Caesarea and church historian (born about 260, died before 341), whom Arius named on his side before the Council of Nicaea; he then signed its creed".
- Josephus: 1 (Matthew 2:21-23), with decision 23's label.

## What the reader sees

Each quotation left out becomes a quiet line where it stood, and neighbouring ones are one line ("A quotation from Origen is left out here."; "Two quotations are left out here: from Origen and from the unfinished work on Matthew."). After the chain, each reason is given once with a link to its source. These lines do not count toward the four Fathers shown before "Show more". The three quotations on Matthew 23:13 (Origen, "Pseudo-Chrysostom", Origen) are all left out, so that passage is not a note and the writers' line does not name the Fathers there; the panel shows "The Church Fathers' quotations on this passage are left out: two from Origen and one from the unfinished work on Matthew." with the two reasons. In this build: 1,012 quiet lines in 813 passages.

## The reasons and notes, and where their words are from

Each is the app's own sentence, kept to what its source says. All were read on 2026-11-22.

- **Origen.** "The anathemas of the Second Council of Constantinople, in 553, name Origen and his writings." The council's eleventh capitulum (https://www.newadvent.org/fathers/3812.htm): "If anyone does not anathematize Arius, Eunomius, Macedonius, Apollinaris, Nestorius, Eutyches and Origen, as well as their impious writings..." The Catholic Encyclopedia's article on Origenism (https://www.newadvent.org/cathen/11306b.htm) says writers differ on whether the council itself condemned him ("Were Origen and Origenism anathematized? Many learned writers believe so; an equal number deny that they were condemned"), so the sentence says only that the anathemas name him, which the text shows.
- **Didymus.** The shortlist calls him condemned with Origen, but no council text naming him was found on the pages read (the Second Council of Constantinople, the Third, and the Second Council of Nicaea, at newadvent.org; the Catholic Encyclopedia's article on Didymus could not be fetched). So the sentence says only what was found: "Didymus wrote a work defending the teaching of Origen's First Principles." The Catholic Encyclopedia, Origen and Origenism: "Didymus the Blind composed a work to explain and justify the teaching of the "De principiis"". If a council's text naming him is read later, the sentence can say so.
- **Clement of Alexandria.** "The Gelasian Decree lists Clement of Alexandria's works among the books the Church does not receive." https://www.tertullian.org/decretum_eng.htm, section V: "The remaining writings which have been compiled or been recognised by heretics or schismatics the Catholic and Apostolic Roman Church does not in any way receive"; under "LIKEWISE A LIST OF APOCRYPHAL BOOKS", "the works of the other Clement, of Alexandria | apocrypha".
- **The unfinished work on Matthew.** "The unfinished work on Matthew was once thought to be Chrysostom's; it was written by a follower of Arius in the first half of the 400s." The Catholic Encyclopedia, St. John Chrysostom (https://www.newadvent.org/cathen/08452b.htm): "The most important spurious work in Latin is the "Opus imperfectum", written by an Arian in the first half of the fifth century".
- **Eusebius.** The Catholic Encyclopedia, Eusebius of Caesarea (https://www.newadvent.org/cathen/05617b.htm): "Eusebius Pamphili, Bishop of Cæsarea in Palestine, the "Father of Church History"; b. about 260; d. before 341." Arius's letter to Eusebius of Nicomedia, in Theodoret, Church History 1.4 (https://www.newadvent.org/fathers/27021.htm): "Eusebius, your brother bishop of Cæsarea, Theodotus, Paulinus, Athanasius, Gregorius, Aetius, and all the bishops of the East, have been condemned..." Socrates, Church History 1.8 (https://www.newadvent.org/fathers/26011.htm): "at length acquiesced in it, and subscribed it with all the rest."
- **Victor of Antioch.** The copy's own citations name him ("Vict. Ant.", 101 times in Mark). The Catholic Encyclopedia, Gospel of Mark (https://www.newadvent.org/cathen/09674b.htm): "It seems most likely also that Victor of Antioch, the first commentator of the Second Gospel, regarded xvi, 8, as the conclusion." No source read says when he lived or that his notes went under Chrysostom's name, so the note does not say either.
- **Josephus.** Decision 23's words. Smith's Bible Dictionary, in the copy the app ships (the entry on Matthew): "The Jewish historian Josephus furnishes an illustration of the fate of the Hebrew original of Matthew."
- **The other names** (Gloss, Greek Expositor, Pseudo-Jerome, Pseudo-Augustine, Pseudo-Athanasius, and "Pseudo-Chrysostom" outside Mark) keep the notes the panel already showed; they moved from `Panel.tsx` to the config unchanged.
