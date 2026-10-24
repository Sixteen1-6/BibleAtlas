# AF-LX: sources.json fragment (shared file, one holder at a time)

`sources.json` is shared (AUDIT-FIXES-PLAN.md section 2); AF-LX does not commit it. Two entries now say something untrue, because the word study shows Strong's own entries (decision 22) and credits each definition to its writer:

## "strongs" entry

- `provides`, now: "Which Hebrew and Greek words come from which. Used for each word's family of related words in the word study."
  Proposed: "Each word's entry (derivation and definition), shown first in the word study, and which Hebrew and Greek words come from which, for each word's family of related words."
- `note`, its first two sentences now: "Only each entry's derivation line is used, to link a word to the word it comes from. Strong's definitions are not shown."
  Proposed: "Each entry's derivation and definition are shown in the word study, without the King James renderings; definitions the JSON edition puts in braces (supplied by its editors where Strong gave none) and its editors' notes on corrected spellings are left out. The derivation line also links a word to the word it comes from."
  The rest of the note stays.

## "tbesh" and "tbesg" entries

- tbesh `provides`, now: "Definitions for each Hebrew and Aramaic root, abridged from BDB."
  Proposed: "Definitions for each Hebrew and Aramaic root: Brown-Driver-Briggs (1906) as abridged by the Online Bible, and STEPBible's own notes on people and places."
- tbesg `provides`, now: "Definitions for each Greek root, abridged from Abbott-Smith."
  Proposed: "Definitions for each Greek root: G. Abbott-Smith's entries (1922), whole and adapted, a few from Liddell and Scott's Intermediate lexicon (1889), and a few by STEPBible."

These strings reach `meta.json` (`sources`), so applying them changes the build id; no other output changes.
