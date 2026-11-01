# Finding the prophecy pairs

The scripts that found the candidates for `config/prophecies.json` on 2026-11-01, kept as they were run. They are not part of the build. Paths at the top of `books.py`, `bible.py` and `notes.py` point at the clone (`/home/claude/bibleatlas`), its built data (`web/public/data`, after `make data`) and a folder holding the Let's Church commentary files at the commit pinned in `sources.json`; change them to rerun.

1. `evidence.py`: every sentence in Henry (complete and Concise), Calvin, Wesley, the Geneva notes and the Catena's Fathers that names a passage of the other Testament next to a prophecy word.
2. `pairs.py`: joins them to the BSB footnote links (`extras/quotes.json`) or, for a writer's note on a long section, to the verse in it that the cross-references tie to the other passage.
3. `items.py`: one sentence per writer per pair, cut to the shortest exact words holding both the prophecy word and the reference: the 603 sentences judged in `docs/evidence/prophecies-2026-11-01.json`.
4. `gen.py`: the New Testament's own statements (`TIER1`) and the sentences kept, written as the pairs; each quote is checked word for word against the same texts the build reads.
