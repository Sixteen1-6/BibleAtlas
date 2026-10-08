//! Septuagint word bridges: the Hebrew words that the Greek Old Testament
//! (the Septuagint, "LXX") translates with each Greek word of the New
//! Testament.
//!
//! Abbott-Smith's *Manual Greek Lexicon of the New Testament*, abridged in
//! STEPBible's TBESG, notes for many words how the Septuagint uses them, for
//! example μώλωψ: "[in LXX for חַבּוּרָה, Exo.21:25, al. ;]". This module reads
//! those notes and matches each Hebrew word in them to the build's TBESH
//! roots, so the app can show under a link from Isaiah 53:5 to 1 Peter 2:24
//! that the Greek Old Testament uses μώλωψ for חַבּוּרָה. No pair is typed by
//! hand.
//!
//! Each Hebrew word in a note is matched, in this order:
//! 1. by its pointed form (vowels kept, accents dropped), when every root
//!    written that way shares one Strong's number;
//! 2. by its consonants alone, on the same condition;
//! 3. otherwise it is left out (ambiguous, or not in the lexicon).
//!
//! A matched number stands for all of its sub-entries (H1350 gives H1350A,
//! B, H and I). Names never match: as for the themes, a root whose gloss
//! starts with a capital letter is skipped.
//!
//! The Greek side of a note is the root with the note's own key. A note
//! whose key is not a root of the build (TBESG's G3700 covers the build's
//! G3700G and G3700H) goes to the roots with the same number that have no
//! note of their own. An extended number such as G20286 is a word of its
//! own, never a sub-entry of G2028.
//!
//! `lxx.json` holds root indices only, no text, as a table sorted by Greek
//! root: the Hebrew roots of `greek[i]` are `hebrew[offsets[i]..offsets[i + 1]]`.

use crate::parse::LexEntry;
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

/// How the table came out.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Stats {
    /// Greek roots with at least one bridge.
    pub greek_roots: usize,
    /// (Greek root, Hebrew root) pairs.
    pub pairs: usize,
    /// Hebrew words in the notes matched by their pointed form.
    pub pointed: usize,
    /// Hebrew words matched by their consonants only.
    pub consonants: usize,
    /// Hebrew words whose letters fit more than one Strong's number (left out).
    pub ambiguous: usize,
    /// Hebrew words that match no root (left out).
    pub not_found: usize,
}

const NOTE: &str = "[in LXX";

/// The Septuagint note of a TBESG definition: the text after the first
/// "[in LXX", up to the next "]".
pub fn lxx_note(definition: &str) -> Option<&str> {
    let rest = &definition[definition.find(NOTE)? + NOTE.len()..];
    Some(&rest[..rest.find(']')?])
}

fn is_letter(c: char) -> bool {
    ('\u{05D0}'..='\u{05EA}').contains(&c)
}

/// Hebrew words in a note: runs of Hebrew letters, points and accents.
fn hebrew_words(note: &str) -> impl Iterator<Item = &str> {
    note.split(|c: char| !(is_letter(c) || ('\u{0591}'..='\u{05C7}').contains(&c))).filter(|w| w.chars().any(is_letter))
}

/// Canonical combining class of the Hebrew points and accents (Unicode 15).
fn ccc(c: char) -> u8 {
    match c {
        '\u{05B0}'..='\u{05B8}' => (c as u32 - 0x05B0 + 10) as u8,
        '\u{05B9}' | '\u{05BA}' => 19,
        '\u{05BB}' => 20,
        '\u{05BC}' => 21,
        '\u{05BD}' => 22,
        '\u{05BF}' => 23,
        '\u{05C1}' => 24,
        '\u{05C2}' => 25,
        '\u{05C7}' => 18,
        '\u{FB1E}' => 26,
        '\u{0591}' | '\u{0596}' | '\u{059B}' | '\u{05A2}'..='\u{05A7}' | '\u{05AA}' | '\u{05C5}' => 220,
        '\u{059A}' | '\u{05AD}' => 222,
        '\u{05AE}' => 228,
        '\u{0592}'..='\u{05AF}' | '\u{05C4}' => 230,
        _ => 0,
    }
}

/// Puts the marks on each letter in Unicode's canonical order. For Hebrew
/// this is all that NFC does: Hebrew has no precomposed letters outside the
/// presentation forms (U+FB1D on), and the lexicons use none.
fn canonical_order(s: &str) -> Vec<char> {
    let mut chars: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let start = i;
        while i < chars.len() && ccc(chars[i]) != 0 {
            i += 1;
        }
        // A stable sort, as the Unicode algorithm requires.
        chars[start..i].sort_by_key(|&c| ccc(c));
        i += 1;
    }
    chars
}

/// The pointed form used for matching: canonical order (NFC), then without
/// cantillation accents, meteg, paseq, sof pasuq, nun hafukha, geresh,
/// gershayim and zero-width joiners. Vowels, dagesh and shin dots stay.
pub fn pointed(s: &str) -> String {
    canonical_order(s)
        .into_iter()
        .filter(|&c| !matches!(c, '\u{0591}'..='\u{05AF}' | '\u{05BD}' | '\u{05C0}' | '\u{05C3}' | '\u{05C6}' | '\u{05F3}' | '\u{05F4}' | '\u{200D}'))
        .collect()
}

/// Hebrew consonants only.
pub fn consonants(s: &str) -> String {
    s.chars().filter(|&c| is_letter(c)).collect()
}

/// A name or place: the gloss starts with a capital letter (the themes' rule).
fn proper(gloss: &str) -> bool {
    gloss.chars().find(|c| c.is_alphabetic()).is_some_and(char::is_uppercase)
}

/// Strong's number without the STEPBible sub-entry letter: "H1350A" ->
/// "H1350". An extended number ("G20286") is a word of its own.
fn base(key: &str) -> &str {
    match key.as_bytes().get(5) {
        Some(b) if b.is_ascii_digit() => key,
        _ => key.get(..5).unwrap_or(key),
    }
}

/// The Strong's number a spelling names, when it names exactly one.
fn only<'a>(bases: Option<&BTreeSet<&'a str>>) -> Option<&'a str> {
    bases.filter(|b| b.len() == 1).and_then(|b| b.first().copied())
}

/// Builds the table. `keys`, `words`, `glosses` and `langs` (H, A or G)
/// describe the build's roots, one entry per root index; `tbesg` lists the
/// key and definition of each TBESG entry. Returns lxx.json and the stats.
pub fn build(keys: &[&str], words: &[&str], glosses: &[&str], langs: &[char], tbesg: &[(&str, &str)]) -> (String, Stats) {
    let roots = || keys.iter().zip(words).zip(glosses).zip(langs).enumerate().map(|(i, (((&k, &w), &g), &l))| (i as u32, k, w, g, l));

    // Hebrew and Aramaic roots (names left out), by number and by spelling.
    let mut by_base: HashMap<&str, Vec<u32>> = HashMap::new();
    let mut by_pointed: HashMap<String, BTreeSet<&str>> = HashMap::new();
    let mut by_consonants: HashMap<String, BTreeSet<&str>> = HashMap::new();
    for (i, key, word, gloss, lang) in roots() {
        if !matches!(lang, 'H' | 'A') || proper(gloss) {
            continue;
        }
        let b = base(key);
        by_base.entry(b).or_default().push(i);
        for form in word.split([',', ';', '/', ' ']).filter(|f| f.chars().any(is_letter)) {
            by_pointed.entry(pointed(form)).or_default().insert(b);
            by_consonants.entry(consonants(form)).or_default().insert(b);
        }
    }

    // Greek roots by key, and by number for notes whose key is not a root.
    let noted: HashSet<&str> = tbesg.iter().map(|&(k, _)| k).collect();
    let mut greek_key: HashMap<&str, u32> = HashMap::new();
    let mut greek_unnoted: HashMap<&str, Vec<u32>> = HashMap::new();
    for (i, key, _, _, lang) in roots() {
        if lang == 'G' {
            greek_key.insert(key, i);
            if !noted.contains(key) {
                greek_unnoted.entry(base(key)).or_default().push(i);
            }
        }
    }

    let mut stats = Stats::default();
    let mut table: BTreeMap<u32, BTreeSet<u32>> = BTreeMap::new();
    for &(key, definition) in tbesg {
        let Some(note) = lxx_note(definition) else { continue };
        // An extended number is its own base, so it never reaches another word.
        let greek: &[u32] = match greek_key.get(key) {
            Some(i) => std::slice::from_ref(i),
            None => greek_unnoted.get(base(key)).map_or(&[], Vec::as_slice),
        };
        if greek.is_empty() {
            continue;
        }
        let mut hebrew = BTreeSet::new();
        for w in hebrew_words(note) {
            let b = if let Some(b) = only(by_pointed.get(&pointed(w))) {
                stats.pointed += 1;
                b
            } else if let Some(b) = only(by_consonants.get(&consonants(w))) {
                stats.consonants += 1;
                b
            } else {
                if by_consonants.contains_key(&consonants(w)) {
                    stats.ambiguous += 1;
                } else {
                    stats.not_found += 1;
                }
                continue;
            };
            hebrew.extend(&by_base[b]);
        }
        if !hebrew.is_empty() {
            for &g in greek {
                table.entry(g).or_default().extend(&hebrew);
            }
        }
    }

    let mut greek = Vec::with_capacity(table.len());
    let mut offsets = vec![0u32];
    let mut hebrew = Vec::new();
    for (g, hs) in &table {
        greek.push(*g);
        hebrew.extend(hs.iter().copied());
        offsets.push(hebrew.len() as u32);
    }
    stats.greek_roots = greek.len();
    stats.pairs = hebrew.len();
    let out = json!({ "greek": greek, "offsets": offsets, "hebrew": hebrew });
    (serde_json::to_string(&out).expect("numbers serialize"), stats)
}

/// For `atlas build`: the table for the build's roots (key, word, gloss,
/// language) and lexicon, as lxx.json. Prints a one-line summary.
pub fn emit<'a>(roots: impl Iterator<Item = (&'a str, &'a str, &'a str, char)>, lex: &HashMap<String, LexEntry>) -> String {
    let roots: Vec<_> = roots.collect();
    let keys: Vec<&str> = roots.iter().map(|r| r.0).collect();
    let words: Vec<&str> = roots.iter().map(|r| r.1).collect();
    let glosses: Vec<&str> = roots.iter().map(|r| r.2).collect();
    let langs: Vec<char> = roots.iter().map(|r| r.3).collect();
    let mut tbesg: Vec<(&str, &str)> = lex.iter().filter(|(k, e)| e.source == "tbesg" && k.starts_with('G')).map(|(k, e)| (k.as_str(), e.definition.as_str())).collect();
    tbesg.sort_unstable();
    let (json, s) = build(&keys, &words, &glosses, &langs, &tbesg);
    eprintln!(
        "LXX bridges: {} Greek roots, {} pairs ({} pointed, {} consonants only, {} ambiguous skipped)",
        s.greek_roots, s.pairs, s.pointed, s.consonants, s.ambiguous
    );
    json
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_hebrew() {
        // Accents and meteg go; vowels, dagesh and shin dots stay.
        assert_eq!(pointed("בְּרֵאשִׁ֖ית"), "בְּרֵאשִׁית");
        // הַ with dehi and meteg, then מּ with its dagesh typed before the
        // segol: the accents go and the segol moves in front of the dagesh.
        let hammelek = "\u{05D4}\u{05B7}\u{05AD}\u{05BD}\u{05DE}\u{05BC}\u{05B6}\u{05DC}\u{05B6}\u{05DA}\u{05B0}";
        assert_eq!(pointed(hammelek), "\u{05D4}\u{05B7}\u{05DE}\u{05B6}\u{05BC}\u{05DC}\u{05B6}\u{05DA}\u{05B0}");
        // Marks typed in another order give the same form (NFC order:
        // vowels, then dagesh, then the shin dot).
        assert_eq!(pointed("ב\u{05BC}\u{05B8}"), "ב\u{05B8}\u{05BC}");
        assert_eq!(pointed("ש\u{05C1}\u{05B8}"), "ש\u{05B8}\u{05C1}");
        assert_eq!(pointed("ל\u{05A5}\u{05B8}"), "ל\u{05B8}");
        // Marks are ordered before paseq is removed, as NFC-then-strip does.
        assert_eq!(pointed("ב\u{05BC}\u{05C0}\u{05B0}"), "ב\u{05BC}\u{05B0}");
        assert_eq!(consonants("חַבּוּרָה"), "חבורה");
        assert_eq!(consonants("בְּרֵאשִׁ֖ית׃"), "בראשית");
        assert_eq!(base("H1350A"), "H1350");
        assert_eq!(base("G3933"), "G3933");
        assert_eq!(base("G20286"), "G20286");
    }

    #[test]
    fn reads_the_note() {
        let def = "<b>x</b> [in LXX for חַבּוּרָה, <ref='Exo.21.25'>Exo.21:25</ref>, al. ;] later [in LXX for עַם]";
        assert_eq!(lxx_note(def), Some(" for חַבּוּרָה, <ref='Exo.21.25'>Exo.21:25</ref>, al. ;"));
        assert_eq!(lxx_note("no note here"), None);
        assert_eq!(lxx_note("[in LXX for עַם, unclosed"), None);
        let words: Vec<&str> = hebrew_words(" chiefly for בְּתוּלָה, Exo.22:16 (15); also for נַעַר, נַעֲרָה ;").collect();
        assert_eq!(words, ["בְּתוּלָה", "נַעַר", "נַעֲרָה"]);
        assert_eq!(hebrew_words(" as seel. in Tob.13:2 ;").count(), 0);
    }

    // Roots: 0 עַלְמָה; 1 and 2 two sub-entries of one number; 3 and 4 the
    // same consonants with other vowels; 5 a name; 6-9 Greek.
    const KEYS: [&str; 10] = ["H0001", "H0002A", "H0002B", "H0003", "H0004", "H0005", "G0001", "G0002", "G0003G", "G2028"];
    const WORDS: [&str; 10] = ["עַלְמָה", "גָּאַל", "גָּאַל", "דָּבָר", "דֶּ֫בֶר", "מֹשֶׁה", "παρθένος", "λυτρόω", "λόγος", "ὀνομάζω"];
    const GLOSSES: [&str; 10] = ["maiden", "to redeem", "to redeem: avenge", "word", "plague", "Moses", "virgin", "to ransom", "word", "to name"];
    const LANGS: [char; 10] = ['H', 'H', 'H', 'H', 'H', 'H', 'G', 'G', 'G', 'G'];

    fn run(tbesg: &[(&str, &str)]) -> (String, Stats) {
        build(&KEYS, &WORDS, &GLOSSES, &LANGS, tbesg)
    }

    #[test]
    fn matches_and_skips() {
        let tbesg = [
            // Pointed match.
            ("G0001", "virgin [in LXX for עַלְמָה ;]"),
            // One number, two sub-entries: both are bridged.
            ("G0002", "[in LXX for גָּאַל ;]"),
            // Not a root itself: goes to G0003G. דְּבַר fits two numbers by
            // its consonants (skipped); the name is never matched; the
            // unpointed עלמה matches by consonants.
            ("G0003", "[in LXX chiefly for דְּבַר, also מֹשֶׁה, עלמה ;]"),
            // An extended number is not a sub-entry of G2028.
            ("G20286", "likeness [in LXX for עַלְמָה ;]"),
            ("G0001X", "no note"),
        ];
        let (json, stats) = run(&tbesg);
        assert_eq!(json, r#"{"greek":[6,7,8],"hebrew":[0,1,2,0],"offsets":[0,1,3,4]}"#);
        assert_eq!(stats, Stats { greek_roots: 3, pairs: 4, pointed: 2, consonants: 1, ambiguous: 1, not_found: 1 });
    }

    #[test]
    fn a_noted_root_keeps_its_own_note() {
        // G0003G has a note of its own, so G0003's note does not reach it.
        let (json, _) = run(&[("G0003", "[in LXX for עַלְמָה ;]"), ("G0003G", "[in LXX for גָּאַל ;]")]);
        assert_eq!(json, r#"{"greek":[8],"hebrew":[1,2],"offsets":[0,2]}"#);
    }

    #[test]
    fn order_of_the_lexicon_does_not_matter() {
        let a = [("G0001", "[in LXX for עַלְמָה ;]"), ("G0002", "[in LXX for גָּאַל, עַלְמָה ;]")];
        let b = [a[1], a[0]];
        assert_eq!(run(&a), run(&b));
    }
}
