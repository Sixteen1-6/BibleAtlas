//! `atlas verify`: check the built data against its own manifest and
//! against facts that are known independently of this project.

use crate::loaded::Loaded;
use crate::sources::sha256_bytes;
use atlas_core::{Adjacency, BOOKS};
use std::fs;
use std::path::Path;

struct Report {
    passed: usize,
    failed: Vec<String>,
}

impl Report {
    fn check(&mut self, ok: bool, what: impl Into<String>) {
        if ok {
            self.passed += 1;
        } else {
            self.failed.push(what.into());
        }
    }
}

/// Keep only Hebrew consonants (drops vowel points and cantillation marks).
fn consonants(s: &str) -> String {
    s.chars().filter(|c| ('\u{05D0}'..='\u{05EA}').contains(c)).collect()
}

/// Lowercase Greek with accents and breathings removed.
fn bare_greek(s: &str) -> String {
    s.chars()
        .filter_map(|c| {
            let base = match c {
                'ά' | 'ὰ' | 'ἀ' | 'ἁ' | 'ἄ' | 'ἅ' | 'ἂ' | 'ἃ' | 'ᾶ' | 'ἆ' | 'ἇ' | 'Ἀ' | 'Ἁ' | 'Α' => 'α',
                'έ' | 'ὲ' | 'ἐ' | 'ἑ' | 'ἔ' | 'ἕ' | 'Ἐ' | 'Ἑ' | 'Ε' => 'ε',
                'ή' | 'ὴ' | 'ἠ' | 'ἡ' | 'ἤ' | 'ἥ' | 'ῆ' | 'ἦ' | 'ἧ' | 'Ἠ' | 'Ἡ' | 'Η' => 'η',
                'ί' | 'ὶ' | 'ἰ' | 'ἱ' | 'ἴ' | 'ἵ' | 'ῖ' | 'ἶ' | 'ἷ' | 'ϊ' | 'Ἰ' | 'Ἱ' | 'Ι' => 'ι',
                'ό' | 'ὸ' | 'ὀ' | 'ὁ' | 'ὄ' | 'ὅ' | 'Ὀ' | 'Ὁ' | 'Ο' => 'ο',
                'ύ' | 'ὺ' | 'ὐ' | 'ὑ' | 'ὔ' | 'ὕ' | 'ῦ' | 'ὖ' | 'ὗ' | 'ϋ' | 'Ὑ' | 'Υ' => 'υ',
                'ώ' | 'ὼ' | 'ὠ' | 'ὡ' | 'ὤ' | 'ὥ' | 'ῶ' | 'ὦ' | 'ὧ' | 'Ὠ' | 'Ὡ' | 'Ω' => 'ω',
                c if ('α'..='ω').contains(&c) => c,
                c if ('Α'..='Ω').contains(&c) => char::from_u32(c as u32 + 32).unwrap_or(c),
                _ => return None,
            };
            Some(base)
        })
        .collect()
}

pub fn run(out: &Path) -> Result<(), String> {
    let d = Loaded::open(out)?;
    let mut r = Report { passed: 0, failed: Vec::new() };

    // 1. Every output file matches the checksum recorded in meta.json.
    for (rel, f) in d.meta["files"].as_object().ok_or("meta.json has no files")? {
        let bytes = fs::read(out.join(rel)).map_err(|e| format!("{rel}: {e}"))?;
        r.check(f["sha256"].as_str() == Some(&sha256_bytes(&bytes)), format!("{rel} checksum"));
    }

    // 2. Structure.
    let n = d.vz.verse_count();
    r.check(n == 31_102, format!("verse count is {n}, expected 31,102 (BSB)"));
    let plain = fs::read_to_string(out.join("bsb.txt")).map_err(|e| format!("bsb.txt: {e}"))?;
    r.check(plain.lines().count() == n as usize, "search text has one line per verse");
    r.check(d.vz.chapter_count() == 1_189, format!("chapter count is {}, expected 1,189", d.vz.chapter_count()));
    r.check(d.graph.validate().is_ok(), format!("cross-reference CSR: {:?}", d.graph.validate()));
    r.check(d.graph.edge_count() > 330_000, format!("only {} cross-references", d.graph.edge_count()));
    let c = d.container();
    let l_off = c.u32s("l_off").map_err(|e| format!("{e:?}"))?;
    let l_verse = c.u32s("l_verse").map_err(|e| format!("{e:?}"))?;
    let l_pos = c.u16s("l_pos").map_err(|e| format!("{e:?}"))?;
    let counts: Vec<u64> = d.lemmas["count"].as_array().unwrap().iter().map(|x| x.as_u64().unwrap()).collect();
    r.check(l_off.len() == counts.len() + 1, "root offsets match root table");
    r.check(l_off.windows(2).zip(&counts).all(|(w, &c)| (w[1] - w[0]) as u64 == c), "root postings match root counts");
    r.check(l_verse.iter().all(|&v| v < n), "every root posting points at a real verse");
    let rank = c.f32s("v_rank").map_err(|e| format!("{e:?}"))?;
    r.check(rank.len() == n as usize && rank.iter().all(|x| x.is_finite() && *x >= 0.0 && *x <= 1.0), "PageRank in [0, 1]");
    for (ok, what) in crate::extra_quotes::verify(&d)? { r.check(ok, what); }

    // 3. Every posting lands on a word that really has that root.
    let mut bad = 0;
    let step = (l_verse.len() / 4000).max(1);
    for i in (0..l_verse.len()).step_by(step) {
        let lemma = l_off.partition_point(|&o| o as usize <= i) - 1;
        let verse = d.verse(l_verse[i])?;
        if verse[1][l_pos[i] as usize][3].as_i64() != Some(lemma as i64) {
            bad += 1;
        }
    }
    r.check(bad == 0, format!("{bad} sampled root postings point at the wrong word"));

    // Themes: shared links name them by id, each lights a readable number of
    // verses, the word senses left out stay out, and the newer themes reach
    // the verses they are about.
    let themes: serde_json::Value = serde_json::from_str(&fs::read_to_string(out.join("themes.json")).map_err(|e| format!("themes.json: {e}"))?).map_err(|e| format!("themes.json: {e}"))?;
    let theme_list = themes.as_array().ok_or("themes.json is not a list")?;
    let ids: Vec<&str> = theme_list.iter().filter_map(|t| t["id"].as_str()).collect();
    let first = ["lamb", "light", "shepherd", "vine", "bread", "water", "rock", "fire", "blood", "covenant", "seed", "bride", "temple", "tree", "way", "spirit"];
    r.check(ids.starts_with(&first), format!("the first 16 theme ids are unchanged and in order: {ids:?}"));
    let theme_verses = |id: &str| -> std::collections::BTreeSet<u32> {
        let roots = theme_list.iter().find(|t| t["id"] == id).and_then(|t| t["roots"].as_array());
        roots.into_iter().flatten().filter_map(|x| x.as_u64()).flat_map(|x| l_verse[l_off[x as usize] as usize..l_off[x as usize + 1] as usize].iter().copied()).collect()
    };
    for id in &ids {
        let lit = theme_verses(id).len();
        r.check((40..=3_000).contains(&lit), format!("theme {id} lights {lit} verses, expected 40 to 3,000"));
    }
    for (id, verse) in [("seed", "Lev 15:16"), ("spirit", "Ezek 42:16")] {
        r.check(!theme_verses(id).contains(&d.resolve(verse)?.0), format!("theme {id} leaves out {verse}"));
    }
    for (id, verses) in [
        ("passover", ["Exod 12:11", "1 Cor 5:7"]),
        ("redeemer", ["Job 19:25", "Mark 10:45"]),
        ("atonement", ["Lev 16:30", "Rom 3:25"]),
        ("anointed", ["Ps 2:2", "John 1:41"]),
        ("sabbath", ["Exod 20:8", "Heb 4:9"]),
        ("kingdom", ["Dan 2:44", "Matt 6:10"]),
        ("firstborn", ["Exod 4:22", "Col 1:15"]),
    ] {
        let lit = theme_verses(id);
        for verse in verses {
            r.check(lit.contains(&d.resolve(verse)?.0), format!("theme {id} includes {verse}"));
        }
    }

    // 4. Facts known independently of this project.
    let gen11 = d.verse(d.resolve("Gen 1:1")?.0)?;
    r.check(gen11[0].as_str().unwrap_or("").starts_with("In the beginning God created"), "Genesis 1:1 English");
    r.check(consonants(gen11[1][0][0].as_str().unwrap_or("")) == "בראשית", "Genesis 1:1 begins בראשית");
    r.check(gen11[1].as_array().map(|a| a.len()) == Some(7), "Genesis 1:1 has 7 Hebrew words");
    let jn = d.verse(d.resolve("John 3:16")?.0)?;
    r.check(bare_greek(jn[1][0][0].as_str().unwrap_or("")) == "ουτως", "John 3:16 begins Οὕτως");
    let jn1 = d.verse(d.resolve("John 1:1")?.0)?;
    let logos = d.lemma_index("G3056").ok_or("no root G3056 (logos)")?;
    r.check(jn1[1].as_array().unwrap().iter().filter(|w| w[3].as_i64() == Some(logos as i64)).count() == 3, "John 1:1 uses λόγος three times");
    let dan = d.verse(d.resolve("Dan 2:5")?.0)?;
    r.check(dan[1].as_array().unwrap().iter().all(|w| w[5].as_u64().unwrap_or(0) & 1 == 1), "Daniel 2:5 is Aramaic");
    let dan1 = d.verse(d.resolve("Dan 1:1")?.0)?;
    r.check(dan1[1].as_array().unwrap().iter().all(|w| w[5].as_u64().unwrap_or(0) & 1 == 0), "Daniel 1:1 is Hebrew");
    for (ok, what) in crate::eras::verify(&d)? { r.check(ok, what); }
    for (b, bk) in BOOKS.iter().enumerate() {
        let first = d.verse(d.vz.book_start(b as u8))?;
        let any = first[1].as_array().map(|a| !a.is_empty()).unwrap_or(false);
        r.check(any, format!("{} 1:1 has original-language words", bk.name));
    }
    for (ok, what) in crate::extra_real_map::verify(&d)? { r.check(ok, what); }
    // Split points where NRSV and KJV numbering differ: the Greek must sit
    // under the English verse that translates it.
    let grace = d.lemma_index("G5485").ok_or("no root G5485 (grace)")?;
    let c1314 = d.verse(d.resolve("2 Cor 13:14")?.0)?;
    r.check(c1314[1].as_array().unwrap().iter().any(|w| w[3].as_i64() == Some(grace as i64)), "2 Corinthians 13:14 contains χάρις");
    let c1313 = d.verse(d.resolve("2 Cor 13:13")?.0)?;
    r.check(!c1313[1].as_array().unwrap().iter().any(|w| w[3].as_i64() == Some(grace as i64)), "2 Corinthians 13:13 does not contain χάρις");
    let empty = (0..n).filter(|&v| d.verse(v).map(|x| x[1].as_array().is_none_or(|a| a.is_empty())).unwrap_or(true)).count();
    r.check(empty == 0, format!("{empty} verses have no original-language words"));
    for (ok, what) in crate::extra_parallels::verify(&d)? { r.check(ok, what); }
    for (ok, what) in crate::extra_aramaic::verify(&d)? { r.check(ok, what); }
    let elohim = d.lemma_index("H0430G").ok_or("no root H0430G (Elohim)")?;
    r.check(counts[elohim] > 2_000, format!("אֱלֹהִים occurs {} times", counts[elohim]));
    let (src, _) = d.resolve("Gen 1:1")?;
    r.check(d.graph.out(src).len() >= 10, "Genesis 1:1 has at least 10 cross-references");

    // Word alignment: the English word and the original word it translates
    // share a group: John 3:16 "loved" (4th English word) is ἠγάπησεν (3rd
    // Greek word); Isaiah 5:30 "sea" (14th) is יָם (6th Hebrew word).
    let group = |verse: &serde_json::Value, word: usize| -> Option<i64> {
        let w = &verse[2]["w"][word];
        w.as_i64().or_else(|| w[0][2].as_i64())
    };
    r.check(jn[2]["e"][3].as_i64().is_some_and(|g| g >= 0) && jn[2]["e"][3].as_i64() == group(&jn, 2), "John 3:16 \"loved\" is aligned to ἠγάπησεν");
    let isa = d.verse(d.resolve("Isa 5:30")?.0)?;
    r.check(isa[2]["e"][13].as_i64().is_some_and(|g| g >= 0) && isa[2]["e"][13].as_i64() == group(&isa, 5), "Isaiah 5:30 \"sea\" is aligned to יָם");
    let aligned = (0..n).filter(|&v| d.verse(v).map(|x| x[2].is_object()).unwrap_or(false)).count();
    r.check(aligned > 30_000, format!("only {aligned} verses have a word alignment"));

    // 5. The path engine finds a route between distant books.
    let adj = Adjacency::from_graph(&d.graph);
    let (a, _) = d.resolve("Gen 3:15")?;
    let (b, _) = d.resolve("Rev 12:9")?;
    let path = adj.shortest_path(a, b, 1);
    r.check(path.as_ref().is_some_and(|p| p.verses.len() <= 6), format!("Gen 3:15 to Rev 12:9 path: {:?}", path.map(|p| p.verses.len())));

    // 6. Septuagint word bridges (lxx.json): a well-formed table, the pairs
    // Abbott-Smith's notes are known to give, and how many links between
    // the testaments they explain under the app's rule (base-text words,
    // both roots used fewer than 1,500 times).
    let lxx: serde_json::Value = serde_json::from_str(&fs::read_to_string(out.join("lxx.json")).map_err(|e| format!("lxx.json: {e}"))?).map_err(|e| format!("lxx.json: {e}"))?;
    let column = |k: &str| -> Vec<u32> { lxx[k].as_array().into_iter().flatten().filter_map(|x| x.as_u64()).map(|x| x as u32).collect() };
    let (greek, offsets, hebrew) = (column("greek"), column("offsets"), column("hebrew"));
    let langs: Vec<char> = d.lemmas["lang"].as_str().unwrap_or("").chars().collect();
    r.check(
        offsets.len() == greek.len() + 1 && offsets.first() == Some(&0) && offsets.last() == Some(&(hebrew.len() as u32)) && offsets.windows(2).all(|w| w[0] < w[1]) && greek.windows(2).all(|w| w[0] < w[1]),
        "lxx.json is a sorted table with one row per Greek root",
    );
    r.check(greek.iter().all(|&g| langs.get(g as usize) == Some(&'G')) && hebrew.iter().all(|&h| matches!(langs.get(h as usize), Some('H' | 'A'))), "lxx.json pairs Greek roots with Hebrew or Aramaic roots");
    let mut pairs = std::collections::HashSet::new();
    for (i, &g) in greek.iter().enumerate() {
        for &h in hebrew.get(offsets[i] as usize..offsets.get(i + 1).copied().unwrap_or(0) as usize).unwrap_or(&[]) {
            pairs.insert((g, h));
        }
    }
    for (g, h) in [("G3468", "H2250"), ("G3933", "H5959"), ("G3933", "H1330"), ("G2435", "H3727"), ("G5547", "H4899")] {
        let found = d.lemma_index(g).zip(d.lemma_index(h)).is_some_and(|(g, h)| pairs.contains(&(g as u32, h as u32)));
        r.check(found, format!("Septuagint bridge {g} to {h}"));
    }
    r.check(greek.len() >= 2_000, format!("{} Greek roots have a Septuagint bridge, expected 2,000 or more", greek.len()));
    let ot: Vec<bool> = (0..n).map(|v| d.vz.locate(v).is_some_and(|(b, _, _)| BOOKS[b as usize].testament == atlas_core::canon::Testament::Old)).collect();
    let roots: Vec<Vec<u32>> = (0..n)
        .map(|v| {
            let row = d.verse(v).unwrap_or_default();
            let base_text = row[1].as_array().into_iter().flatten().filter(|w| w[5].as_u64().unwrap_or(0) & u64::from(crate::build::FLAG_OTHER_EDITIONS) == 0);
            base_text.filter_map(|w| w[3].as_u64()).map(|x| x as u32).filter(|&x| counts[x as usize] < 1_500).collect()
        })
        .collect();
    let (mut across, mut bridged) = (0usize, 0usize);
    for s in 0..n {
        for e in d.graph.out(s) {
            let t = d.graph.dst[e];
            if d.graph.votes[e] < 8 || ot[s as usize] == ot[t as usize] {
                continue;
            }
            let (o, nt) = if ot[s as usize] { (s, t) } else { (t, s) };
            across += 1;
            bridged += roots[nt as usize].iter().any(|&g| roots[o as usize].iter().any(|&h| pairs.contains(&(g, h)))) as usize;
        }
    }
    r.check(bridged * 10 >= across * 3, format!("{bridged} of {across} links between the testaments with 8+ votes have a word bridge, expected 30% or more"));
    eprintln!("Septuagint bridges: {} Greek roots; {bridged} of {across} links between the testaments with 8+ votes ({:.1}%)", greek.len(), 100.0 * bridged as f64 / across.max(1) as f64);

    eprintln!("{} checks passed", r.passed);
    if r.failed.is_empty() {
        Ok(())
    } else {
        for f in &r.failed {
            eprintln!("FAILED: {f}");
        }
        Err(format!("{} check(s) failed", r.failed.len()))
    }
}
