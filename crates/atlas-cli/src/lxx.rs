//! Septuagint word bridges: the Hebrew words that the Greek Old Testament
//! (the Septuagint, "LXX") translates with each Greek word of the New
//! Testament.
//!
//! Abbott-Smith's *Manual Greek Lexicon of the New Testament*, abridged in
//! STEPBible's TBESG, notes for many words how the Septuagint uses them, for
//! example μώλωψ: "[in LXX for חַבּוּרָה, Exo.21:25, al. ;]". This module reads
//! those notes and matches each Hebrew word in them to the build's TBESH
//! roots, so the app can show under a link from Isaiah 53:5 to 1 Peter 2:24
//! that the Septuagint translates חַבּוּרָה as μώλωψ. No pair is typed by hand.
//!
//! A note is any bracket that names the LXX: "[in LXX for …]", "[In LXX …]",
//! "[frequently in LXX for …]", "[LXX for …]". Brackets that say "not in LXX"
//! or quote another translator ("[in Sm.: … (LXX, …)]") are not notes.
//!
//! Words of a phrase are not the Greek word's equivalents one by one: a
//! bracketed run of words ("(חֵקֶר אַיִן)", without searching) or one with a
//! negative ("נָפַח לֹא") is left out, unless all its words are spellings of
//! one word. Words in a plain list ("chiefly for בָּטַח בֶּטַח") are each kept.
//!
//! Each Hebrew word is matched, in this order:
//! 1. by its pointed form (vowels kept, accents dropped, both holams read
//!    alike), when every root written that way shares one Strong's number;
//! 2. when several numbers are written exactly that way: the one that occurs
//!    in the verses the note cites, else a Hebrew word and its Aramaic twin
//!    (both kept), else the number with at least 90% of the occurrences;
//!    otherwise it is left out;
//! 3. a word spelled exactly like a name is left out;
//! 4. by its consonants alone, when they fit one number;
//! 5. when they fit several: the one in the cited verses, else the number
//!    with at least 95% of the occurrences; otherwise it is left out.
//!
//! A matched number stands for all of its sub-entries (H1350 gives H1350A,
//! B, H and I); one chosen through the cited verses stands for the
//! sub-entries found there. Names never match: a root whose gloss starts with
//! a capital letter, unless STEPBible types it as a common noun (Passover,
//! Sabbath, Almighty). Pronouns, articles, prepositions, conjunctions and
//! particles say nothing about a link, so they are left out on both sides.
//!
//! The Greek side of a note is the root with the note's own key. A note
//! whose key is not a root of the build (TBESG's G3700 covers the build's
//! G3700G and G3700H) goes to the roots with the same number that have no
//! note of their own. An extended number such as G20286 is a word of its
//! own, never a sub-entry of G2028.
//!
//! `lxx.json` holds root indices only, no text, as a table sorted by Greek
//! root: the Hebrew roots of `greek[i]` are `hebrew[offsets[i]..offsets[i + 1]]`.

use crate::parse::{LexEntry, WordsByVerse};
use atlas_core::{canon, Versification};
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

/// One root of the build, as the bridge table sees it.
#[derive(Clone, Copy, Debug)]
pub struct Root<'a> {
    pub key: &'a str,
    pub word: &'a str,
    pub gloss: &'a str,
    /// H, A (Aramaic) or G.
    pub lang: char,
    /// STEPBible's word type: "H:N-M", "N:N--L" (a place), "G:V".
    pub kind: &'a str,
    /// Occurrences in the base text.
    pub count: u32,
}

/// How the table came out. The word counts are per Hebrew word in a note.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Stats {
    /// Greek roots with at least one bridge.
    pub greek_roots: usize,
    /// (Greek root, Hebrew root) pairs.
    pub pairs: usize,
    /// Matched by their pointed form.
    pub pointed: usize,
    /// Matched by their consonants only.
    pub consonants: usize,
    /// Several numbers fit; the verses the note cites hold one of them.
    pub cited: usize,
    /// A Hebrew word and its Aramaic twin, spelled alike (both kept).
    pub twins: usize,
    /// Several numbers fit; one has nearly all the occurrences.
    pub dominant: usize,
    /// Several numbers fit and nothing settles which (left out).
    pub ambiguous: usize,
    /// Spelled like a name (left out).
    pub names: usize,
    /// No root has this spelling (left out).
    pub not_found: usize,
    /// Runs of words read as one phrase (left out).
    pub phrases: usize,
}

/// The Septuagint notes of a TBESG definition, each from "LXX" to its
/// closing "]".
pub fn lxx_notes(definition: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut rest = definition;
    while let Some(i) = rest.find('[') {
        let after = &rest[i + 1..];
        let Some(j) = after.find(']') else { break };
        let body = &after[..j];
        if let Some(k) = body.find("LXX") {
            if lead_in(&body[..k]) {
                out.push(&body[k + 3..]);
            }
        }
        rest = &after[j + 1..];
    }
    out
}

/// The words before "LXX" in a note's bracket: at most three plain words
/// ("in", "very frequently in", "As equiv. in"), none of them "not".
fn lead_in(s: &str) -> bool {
    if !(s.is_empty() || s.ends_with(char::is_whitespace)) {
        return false;
    }
    let words: Vec<&str> = s.split_whitespace().collect();
    words.len() <= 3
        && words.iter().all(|w| w.chars().next().is_some_and(char::is_alphabetic) && w.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '.'))
        && !words.iter().any(|w| w.eq_ignore_ascii_case("not"))
}

fn is_letter(c: char) -> bool {
    ('\u{05D0}'..='\u{05EA}').contains(&c)
}

fn is_hebrew(c: char) -> bool {
    is_letter(c) || ('\u{0591}'..='\u{05C7}').contains(&c)
}

/// Runs of Hebrew words in a note, with the byte offset where each starts.
/// Words joined only by spaces ("בָּטַח בֶּטַח", "(חֵקֶר אַיִן)") form one run.
fn runs(note: &str) -> Vec<(usize, Vec<&str>)> {
    let mut out: Vec<(usize, Vec<&str>)> = Vec::new();
    let mut words: Vec<&str> = Vec::new();
    let (mut start, mut word) = (0, None);
    for (i, c) in note.char_indices() {
        if is_hebrew(c) {
            if word.is_none() {
                if words.is_empty() {
                    start = i;
                }
                word = Some(i);
            }
            continue;
        }
        if let Some(w) = word.take() {
            words.push(&note[w..i]);
        }
        if c != ' ' && !words.is_empty() {
            out.push((start, std::mem::take(&mut words)));
        }
    }
    if let Some(w) = word {
        words.push(&note[w..]);
    }
    if !words.is_empty() {
        out.push((start, words));
    }
    out.into_iter()
        .map(|(s, ws)| (s, ws.into_iter().filter(|w| w.chars().any(is_letter)).collect::<Vec<_>>()))
        .filter(|(_, ws)| !ws.is_empty())
        .collect()
}

/// Negatives, by their consonants, that make a run of words a phrase.
const NEGATIVES: [&str; 9] = ["לא", "אין", "בלי", "בלתי", "בל", "אל", "מבלי", "לבלתי", "בלא"];

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
/// gershayim and zero-width joiners. Vowels, dagesh and shin dots stay, and
/// holam haser for vav (U+05BA) reads as holam: the two lexicons write עָוֺן
/// with one and the other.
pub fn pointed(s: &str) -> String {
    canonical_order(s)
        .into_iter()
        .filter(|&c| !matches!(c, '\u{0591}'..='\u{05AF}' | '\u{05BD}' | '\u{05C0}' | '\u{05C3}' | '\u{05C6}' | '\u{05F3}' | '\u{05F4}' | '\u{200D}'))
        .map(|c| if c == '\u{05BA}' { '\u{05B9}' } else { c })
        .collect()
}

/// Hebrew consonants only.
pub fn consonants(s: &str) -> String {
    s.chars().filter(|&c| is_letter(c)).collect()
}

/// STEPBible types the root as a common noun ("H:N-M", "A:N-F", "H:N").
fn common_noun(kind: &str) -> bool {
    ["H:N", "A:N"].iter().any(|p| kind.strip_prefix(p).is_some_and(|r| r.is_empty() || r.starts_with(['-', '/', ' '])))
}

/// A name or place: the gloss starts with a capital letter (the themes'
/// rule), unless the root is a common noun ("Passover", "Sabbath",
/// "Almighty").
fn is_name(r: &Root) -> bool {
    r.gloss.chars().find(|c| c.is_alphabetic()).is_some_and(char::is_uppercase) && !common_noun(r.kind)
}

/// A pronoun, article, preposition, conjunction or particle (negatives,
/// interrogatives and conditionals too): every part of the word type is one.
fn function_word(kind: &str) -> bool {
    let mut parts = kind.split(['+', '/']).map(str::trim).filter(|p| !p.is_empty()).peekable();
    parts.peek().is_some()
        && parts.all(|p| {
            if let Some(t) = p.strip_prefix("H:").or_else(|| p.strip_prefix("A:")) {
                ["PerP", "DemP", "RelP", "Prep", "Conj", "Part", "Neg", "Intg", "Cond"].iter().any(|f| t.starts_with(f))
            } else if let Some(t) = p.strip_prefix("G:") {
                matches!(t.split('-').next(), Some("P" | "T" | "D" | "R" | "I" | "K" | "Q" | "S" | "F" | "X" | "C" | "PREP" | "CONJ" | "PRT" | "COND"))
            } else {
                false
            }
        })
}

/// Strong's number without the STEPBible sub-entry letter: "H1350A" ->
/// "H1350". An extended number ("G20286") is a word of its own.
fn base(key: &str) -> &str {
    match key.as_bytes().get(5) {
        Some(b) if b.is_ascii_digit() => key,
        _ => key.get(..5).unwrap_or(key),
    }
}

/// The verses a note links to, from `<ref='Exo.21.25'>`: in "Job.5.9; 9.10"
/// and "Num.5.20, 29" the book and chapter carry on, and a range counts from
/// its first verse.
fn cited_verses(note: &str) -> Vec<(&str, u16, u16)> {
    let mut out = Vec::new();
    let mut rest = note;
    while let Some(i) = rest.find("<ref='") {
        let tail = &rest[i + 6..];
        let Some(j) = tail.find('\'') else { break };
        let (mut book, mut chap) = ("", "");
        for item in tail[..j].split([';', ',']) {
            let item = item.trim().split('-').next().unwrap_or("");
            let parts: Vec<&str> = item.split('.').collect();
            let (b, c, v) = match parts[..] {
                [b, c, v] => (b, c, v),
                [c, v] if !book.is_empty() => (book, c, v),
                [v] if !book.is_empty() && !chap.is_empty() => (book, chap, v),
                _ => continue,
            };
            (book, chap) = (b, c);
            if let (Ok(c), Ok(v)) = (c.trim().parse(), v.trim().parse()) {
                out.push((b, c, v));
            }
        }
        rest = &tail[j + 1..];
    }
    out
}

/// How one Hebrew word of a note was matched.
#[derive(Clone, Copy, PartialEq, Eq)]
enum How {
    Pointed,
    Consonants,
    Cited,
    Twins,
    Dominant,
    Ambiguous,
    Name,
    NotFound,
}

/// The Hebrew and Aramaic roots (names left out), by number and by
/// spelling.
struct Index<'a> {
    by_base: HashMap<&'a str, Vec<u32>>,
    by_pointed: HashMap<String, BTreeSet<&'a str>>,
    by_consonants: HashMap<String, BTreeSet<&'a str>>,
    /// Pointed spellings of names and places.
    names: HashSet<String>,
    /// Occurrences of each number, all its sub-entries together.
    total: HashMap<&'a str, u64>,
    /// The one language of a number's roots, if they share one.
    language: HashMap<&'a str, Option<char>>,
}

impl<'a> Index<'a> {
    fn new(roots: &[Root<'a>]) -> Self {
        let mut by_base: HashMap<&str, Vec<u32>> = HashMap::new();
        let mut by_pointed: HashMap<String, BTreeSet<&str>> = HashMap::new();
        let mut by_consonants: HashMap<String, BTreeSet<&str>> = HashMap::new();
        let mut names: HashSet<String> = HashSet::new();
        for (i, r) in roots.iter().enumerate() {
            if !matches!(r.lang, 'H' | 'A') {
                continue;
            }
            let forms = r.word.split([',', ';', '/', ' ']).filter(|f| f.chars().any(is_letter));
            if is_name(r) {
                names.extend(forms.map(pointed));
                continue;
            }
            let b = base(r.key);
            by_base.entry(b).or_default().push(i as u32);
            for form in forms {
                by_pointed.entry(pointed(form)).or_default().insert(b);
                by_consonants.entry(consonants(form)).or_default().insert(b);
            }
        }
        let total = by_base.iter().map(|(&b, xs)| (b, xs.iter().map(|&i| u64::from(roots[i as usize].count)).sum())).collect();
        let language = by_base
            .iter()
            .map(|(&b, xs)| {
                let l = roots[xs[0] as usize].lang;
                (b, xs.iter().all(|&i| roots[i as usize].lang == l).then_some(l))
            })
            .collect();
        Index { by_base, by_pointed, by_consonants, names, total, language }
    }

    /// Several numbers fit a spelling (`exact`: its pointed form): settle it,
    /// or give up.
    fn tie(&self, cands: &BTreeSet<&'a str>, cited: &HashSet<&'a str>, exact: bool) -> Option<(Vec<&'a str>, How)> {
        let hit: Vec<&str> = cands.iter().copied().filter(|b| cited.contains(b)).collect();
        match hit.len() {
            0 => {}
            1 => return Some((hit, How::Cited)),
            // The cited verses hold more than one: unclear.
            _ => return None,
        }
        let mut it = cands.iter().copied();
        if let (true, 2, Some(a), Some(b)) = (exact, cands.len(), it.next(), it.next()) {
            if let (Some(la), Some(lb)) = (self.language[a], self.language[b]) {
                if la != lb {
                    return Some((vec![a, b], How::Twins));
                }
            }
        }
        let all: u64 = cands.iter().map(|b| self.total[b]).sum();
        // The first of the commonest, in number order.
        let best = cands.iter().copied().fold(None, |acc: Option<&'a str>, b| match acc {
            Some(x) if self.total[x] >= self.total[b] => Some(x),
            _ => Some(b),
        })?;
        let percent = if exact { 90 } else { 95 };
        (all > 0 && self.total[best] * 100 >= percent * all).then(|| (vec![best], How::Dominant))
    }

    /// The numbers one Hebrew word of a note stands for.
    fn resolve(&self, w: &str, cited: &HashSet<&'a str>) -> (Vec<&'a str>, How) {
        let p = pointed(w);
        if let Some(ps) = self.by_pointed.get(&p) {
            if ps.len() == 1 {
                return (ps.iter().copied().collect(), How::Pointed);
            }
            // Exact homographs: the answer is one of them or none.
            return self.tie(ps, cited, true).unwrap_or((Vec::new(), How::Ambiguous));
        }
        if self.names.contains(&p) {
            return (Vec::new(), How::Name);
        }
        match self.by_consonants.get(&consonants(w)) {
            Some(cs) if cs.len() == 1 => (cs.iter().copied().collect(), How::Consonants),
            Some(cs) => self.tie(cs, cited, false).unwrap_or((Vec::new(), How::Ambiguous)),
            None => (Vec::new(), How::NotFound),
        }
    }
}

/// Builds the table. `roots` describes the build's roots, one entry per root
/// index; `tbesg` lists the key and definition of each TBESG entry;
/// `verse_roots(book, chapter, verse)` gives the roots of a verse a note
/// cites (STEPBible book code, as in `<ref='Exo.21.25'>`). Returns lxx.json
/// and the stats.
pub fn build<'a>(roots: &[Root<'a>], tbesg: &[(&str, &str)], verse_roots: &dyn Fn(&str, u16, u16) -> Vec<u32>) -> (String, Stats) {
    let index = Index::new(roots);

    // Greek roots by key, and by number for notes whose key is not a root.
    let noted: HashSet<&str> = tbesg.iter().map(|&(k, _)| k).collect();
    let mut greek_key: HashMap<&str, u32> = HashMap::new();
    let mut greek_unnoted: HashMap<&str, Vec<u32>> = HashMap::new();
    for (i, r) in roots.iter().enumerate() {
        if r.lang == 'G' {
            greek_key.insert(r.key, i as u32);
            if !noted.contains(r.key) {
                greek_unnoted.entry(base(r.key)).or_default().push(i as u32);
            }
        }
    }

    let mut stats = Stats::default();
    let mut table: BTreeMap<u32, BTreeSet<u32>> = BTreeMap::new();
    for &(key, definition) in tbesg {
        // An extended number is its own base, so it never reaches another word.
        let greek: Vec<u32> = match greek_key.get(key) {
            Some(&i) => vec![i],
            None => greek_unnoted.get(base(key)).cloned().unwrap_or_default(),
        };
        let greek: Vec<u32> = greek.into_iter().filter(|&g| !function_word(roots[g as usize].kind)).collect();
        if greek.is_empty() {
            continue;
        }
        for note in lxx_notes(definition) {
            let cited_roots: HashSet<u32> = cited_verses(note).into_iter().flat_map(|(b, c, v)| verse_roots(b, c, v)).collect();
            let cited: HashSet<&'a str> = cited_roots.iter().map(|&x| base(roots[x as usize].key)).collect();
            let mut hebrew = BTreeSet::new();
            for (start, words) in runs(note) {
                if words.len() > 1 {
                    let before = &note[..start];
                    let bracketed = before.matches('(').count() > before.matches(')').count();
                    let negated = words.iter().any(|w| NEGATIVES.contains(&consonants(w).as_str()));
                    if bracketed || negated {
                        let first = index.resolve(words[0], &cited).0;
                        if first.is_empty() || words[1..].iter().any(|w| index.resolve(w, &cited).0 != first) {
                            stats.phrases += 1;
                            continue;
                        }
                    }
                }
                for w in words {
                    let (bases, how) = index.resolve(w, &cited);
                    *match how {
                        How::Pointed => &mut stats.pointed,
                        How::Consonants => &mut stats.consonants,
                        How::Cited => &mut stats.cited,
                        How::Twins => &mut stats.twins,
                        How::Dominant => &mut stats.dominant,
                        How::Ambiguous => &mut stats.ambiguous,
                        How::Name => &mut stats.names,
                        How::NotFound => &mut stats.not_found,
                    } += 1;
                    for b in bases {
                        let subs = &index.by_base[b];
                        let seen: Vec<u32> = if how == How::Cited { subs.iter().copied().filter(|x| cited_roots.contains(x)).collect() } else { Vec::new() };
                        let subs = if seen.is_empty() { subs.as_slice() } else { seen.as_slice() };
                        hebrew.extend(subs.iter().copied().filter(|&x| !function_word(roots[x as usize].kind)));
                    }
                }
            }
            if !hebrew.is_empty() {
                for &g in &greek {
                    table.entry(g).or_default().extend(&hebrew);
                }
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

/// For `atlas build`: the table for the build's roots and lexicon, as
/// lxx.json. `words` and `vz` give the roots of the verses a note cites.
/// Prints a one-line summary.
pub fn emit<'a>(roots: impl Iterator<Item = Root<'a>>, lex: &HashMap<String, LexEntry>, words: &WordsByVerse, vz: &Versification) -> String {
    let roots: Vec<Root> = roots.collect();
    let index: HashMap<&str, u32> = roots.iter().enumerate().map(|(i, r)| (r.key, i as u32)).collect();
    let verse_roots = |book: &str, chapter: u16, verse: u16| -> Vec<u32> {
        let Some(v) = canon::by_step(book).and_then(|b| vz.index(b, chapter, verse)) else { return Vec::new() };
        words[v as usize].iter().filter(|w| w.main).filter_map(|w| index.get(w.lemma.as_deref()?).copied()).collect()
    };
    let mut tbesg: Vec<(&str, &str)> = lex.iter().filter(|(k, e)| e.source == "tbesg" && k.starts_with('G')).map(|(k, e)| (k.as_str(), e.definition.as_str())).collect();
    tbesg.sort_unstable();
    let (json, s) = build(&roots, &tbesg, &verse_roots);
    eprintln!(
        "LXX bridges: {} Greek roots, {} pairs ({} pointed, {} consonants only, {} by the verses cited, {} Hebrew-Aramaic twins, {} by a dominant number, {} ambiguous skipped, {} phrases skipped)",
        s.greek_roots, s.pairs, s.pointed, s.consonants, s.cited, s.twins, s.dominant, s.ambiguous, s.phrases
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
        // עָוֺן (holam haser for vav) and עָוֹן (holam) are one spelling.
        assert_eq!(pointed("ע\u{05B8}ו\u{05BA}ן"), pointed("ע\u{05B8}ו\u{05B9}ן"));
        assert_eq!(consonants("חַבּוּרָה"), "חבורה");
        assert_eq!(consonants("בְּרֵאשִׁ֖ית׃"), "בראשית");
        assert_eq!(base("H1350A"), "H1350");
        assert_eq!(base("G3933"), "G3933");
        assert_eq!(base("G20286"), "G20286");
    }

    #[test]
    fn reads_the_notes() {
        let def = "<b>x</b> [in LXX for חַבּוּרָה, <ref='Exo.21.25'>Exo.21:25</ref>, al. ;] later [In LXX for עַם]";
        assert_eq!(lxx_notes(def), [" for חַבּוּרָה, <ref='Exo.21.25'>Exo.21:25</ref>, al. ;", " for עַם"]);
        assert_eq!(lxx_notes("[frequently in LXX, and nearly always for בְּרִית ;]"), [", and nearly always for בְּרִית ;"]);
        assert_eq!(lxx_notes("[very frequently in  LXX for שׁוּב]"), [" for שׁוּב"]);
        assert_eq!(lxx_notes("[LXX for חָלִילָה]"), [" for חָלִילָה"]);
        // Not notes: the word is absent from the LXX, or another translator
        // is quoted, or the bracket never closes.
        assert!(lxx_notes("[not in LXX, where עַתָּה is rendered by ἀπὸ τοῦ νῦν ;]").is_empty());
        assert!(lxx_notes("[in Sm.: <ref='Job.15.15'>Job.15:15</ref> (LXX, καθαρός)* ;]").is_empty());
        assert!(lxx_notes("no note here").is_empty());
        assert!(lxx_notes("[in LXX for עַם, unclosed").is_empty());
        let words: Vec<Vec<&str>> = runs(" chiefly for בְּתוּלָה, Exo.22:16 (15); also for נַעַר, נַעֲרָה ;").into_iter().map(|r| r.1).collect();
        assert_eq!(words, [vec!["בְּתוּלָה"], vec!["נַעַר"], vec!["נַעֲרָה"]]);
        assert!(runs(" as seel. in Tob.13:2 ;").is_empty());
        let (start, words) = runs(" Job.5:9 (חֵקֶר אַיִן)* ;").remove(0);
        assert_eq!((start, words), (" Job.5:9 (".len(), vec!["חֵקֶר", "אַיִן"]));
    }

    #[test]
    fn reads_cited_verses() {
        let note = " for בַּת, <ref='2Ch.4.5'>2Ch.4:5</ref>, (סְאָה) <ref='Job.5.9; 9.10, 12'>…</ref> <ref='Dan.11.7, 20-21'>…</ref> <ref='Wis'>";
        assert_eq!(cited_verses(note), [("2Ch", 4, 5), ("Job", 5, 9), ("Job", 9, 10), ("Job", 9, 12), ("Dan", 11, 7), ("Dan", 11, 20)]);
    }

    fn root<'a>(key: &'a str, word: &'a str, gloss: &'a str, kind: &'a str, count: u32) -> Root<'a> {
        let lang = match key.as_bytes()[0] {
            b'G' => 'G',
            _ if kind.starts_with("A:") => 'A',
            _ => 'H',
        };
        Root { key, word, gloss, lang, kind, count }
    }

    // Roots: 0 עַלְמָה; 1 and 2 two sub-entries of one number; 3 and 4 the
    // same consonants with other vowels; 5 a name; 6-9 Greek.
    fn base_roots() -> Vec<Root<'static>> {
        vec![
            root("H0001", "עַלְמָה", "maiden", "H:N-F", 7),
            root("H0002A", "גָּאַל", "to redeem", "H:V", 20),
            root("H0002B", "גָּאַל", "to redeem: avenge", "H:V", 5),
            root("H0003", "דָּבָר", "word", "H:N-M", 50),
            root("H0004", "דֶּ֫בֶר", "plague", "H:N-M", 50),
            root("H0005", "מֹשֶׁה", "Moses", "N:N-M-P", 700),
            root("G0001", "παρθένος", "virgin", "G:N-F", 15),
            root("G0002", "λυτρόω", "to ransom", "G:V", 3),
            root("G0003G", "λόγος", "word", "G:N-M", 300),
            root("G2028", "ὀνομάζω", "to name", "G:V", 10),
        ]
    }

    fn no_verses(_: &str, _: u16, _: u16) -> Vec<u32> {
        Vec::new()
    }

    fn table(json: &str) -> Vec<(u32, u32)> {
        let v: serde_json::Value = serde_json::from_str(json).unwrap();
        let col = |k: &str| v[k].as_array().unwrap().iter().map(|x| x.as_u64().unwrap() as u32).collect::<Vec<_>>();
        let (g, o, h) = (col("greek"), col("offsets"), col("hebrew"));
        g.iter().enumerate().flat_map(|(i, &g)| h[o[i] as usize..o[i + 1] as usize].iter().map(move |&h| (g, h))).collect()
    }

    #[test]
    fn matches_and_skips() {
        let tbesg = [
            // Pointed match.
            ("G0001", "virgin [in LXX for עַלְמָה ;]"),
            // One number, two sub-entries: both are bridged.
            ("G0002", "[in LXX for גָּאַל ;]"),
            // Not a root itself: goes to G0003G. דְּבַר fits two numbers by
            // its consonants, equally often (skipped); the name is never
            // matched; the unpointed עלמה matches by consonants.
            ("G0003", "[in LXX chiefly for דְּבַר, also מֹשֶׁה, עלמה ;]"),
            // An extended number is not a sub-entry of G2028.
            ("G20286", "likeness [in LXX for עַלְמָה ;]"),
            ("G0001X", "no note"),
        ];
        let (json, stats) = build(&base_roots(), &tbesg, &no_verses);
        assert_eq!(json, r#"{"greek":[6,7,8],"hebrew":[0,1,2,0],"offsets":[0,1,3,4]}"#);
        assert_eq!(stats, Stats { greek_roots: 3, pairs: 4, pointed: 2, consonants: 1, ambiguous: 1, names: 1, ..Stats::default() });
    }

    #[test]
    fn a_noted_root_keeps_its_own_note() {
        // G0003G has a note of its own, so G0003's note does not reach it.
        let (json, _) = build(&base_roots(), &[("G0003", "[in LXX for עַלְמָה ;]"), ("G0003G", "[in LXX for גָּאַל ;]")], &no_verses);
        assert_eq!(json, r#"{"greek":[8],"hebrew":[1,2],"offsets":[0,2]}"#);
    }

    #[test]
    fn order_of_the_lexicon_does_not_matter() {
        let a = [("G0001", "[in LXX for עַלְמָה ;]"), ("G0002", "[in LXX for גָּאַל, עַלְמָה ;]")];
        let b = [a[1], a[0]];
        assert_eq!(build(&base_roots(), &a, &no_verses), build(&base_roots(), &b, &no_verses));
    }

    #[test]
    fn phrases_are_not_word_pairs() {
        let roots = vec![
            root("H0010", "חֵ֫קֶר", "search", "H:N-M", 12),
            root("H0011", "אַ֫יִן", "nothing", "H:Neg", 700),
            root("H0012", "דֶּ֫רֶךְ", "way", "H:N-M", 700),
            root("H0013", "עָקַשׁ", "to twist", "H:V", 5),
            root("H0014", "בָּטַח", "to trust", "H:V", 120),
            root("H0015", "בֶּ֫טַח", "security", "H:N-M", 40),
            root("H0016", "קוֹמְמִיּוּת", "uprightness", "H:N-F", 1),
            root("G0001", "ἀνεξιχνίαστος", "unsearchable", "G:A", 2),
            root("G0002", "σκολιός", "crooked", "G:A", 4),
            root("G0003", "πείθω", "to persuade", "G:V", 52),
            root("G0004", "παρρησία", "boldness", "G:N-F", 31),
        ];
        let tbesg = [
            // A bracketed phrase with a negative, and one without.
            ("G0001", "[in LXX: Job.5:9 (חֵקֶר אַיִן)* ;]"),
            ("G0002", "[in LXX for עָקַשׁ, Pro.28:6 (דֶּרֶךְ עָקַשׁ) ;]"),
            // A plain list keeps both words.
            ("G0003", "[in LXX chiefly for בָּטַח בֶּטַח, its parts ;]"),
            // Two spellings of one word are not a phrase.
            ("G0004", "[in LXX: Lev.26:13 (μετὰ π., קוֺמְמִיּוּת קוֹמְמִיּוּת) ;]"),
        ];
        let (json, stats) = build(&roots, &tbesg, &no_verses);
        assert_eq!(table(&json), [(8, 3), (9, 4), (9, 5), (10, 6)]);
        assert_eq!(stats.phrases, 2);
    }

    #[test]
    fn names_and_function_words() {
        let roots = vec![
            root("H0020", "פֶּ֫סַח", "Passover", "H:N-M", 49),
            root("H0021G", "יָוָן", "Javan", "N:N-M-P", 4),
            root("H0021H", "יָוָן", "Greece", "N:N--L", 7),
            root("H0022", "יָוֵן", "mire", "H:N-M", 2),
            root("H0023", "זֹאת", "this", "H:DemP", 604),
            root("H0024", "עִם", "with", "H:Prep", 1052),
            root("H0025", "עַם", "people", "H:N-M", 1873),
            root("G0001", "πάσχα", "Passover lamb", "G:N-N", 29),
            root("G0002", "Ἕλλην", "Greek", "N:N-M-LG", 25),
            root("G0003", "οὗτος", "this", "G:D", 1382),
            root("G0004", "συντρέχω", "to run together", "G:V", 3),
            root("G0005", "λαός", "people", "G:N-M", 142),
        ];
        let tbesg = [
            // A capitalised common noun is not a name.
            ("G0001", "[in LXX for פֶּסַח ;]"),
            // Spelled exactly like a name: never matched to the look-alike
            // יָוֵן 'mire' by consonants.
            ("G0002", "[in LXX for יָוָן ;]"),
            // A pronoun on either side says nothing about a link.
            ("G0003", "[in LXX for זֹאת ;]"),
            // A function word is still matched as itself: עִם 'with' never
            // becomes עַם 'people', and is then left out.
            ("G0004", "[in LXX for עִם ;]"),
            ("G0005", "[in LXX for עַם ;]"),
        ];
        let (json, stats) = build(&roots, &tbesg, &no_verses);
        assert_eq!(table(&json), [(7, 0), (11, 6)]);
        assert_eq!((stats.names, stats.pointed), (1, 3));
    }

    #[test]
    fn ties_are_settled_by_evidence_or_left_out() {
        let roots = vec![
            // 0-1: exact homographs; the measure is rare.
            root("H0030", "בַּת", "daughter", "H:N-F", 588),
            root("H0031", "בַּת", "bath", "H:N-F", 13),
            // 2-3: the Hebrew word and its Aramaic twin.
            root("H0032", "מֶ֫לֶךְ", "king", "H:N-M", 2526),
            root("H0033", "מֶ֫לֶךְ", "king", "A:N-M", 180),
            // 4-5: one number has 92% of the uses: enough for an exact
            // spelling, not for consonants alone.
            root("H0034", "שָׁחַר", "to seek", "H:V", 12),
            root("H0035", "שָׁחַר", "be black", "H:V", 1),
            // 6-8: two sub-entries of one verb, and a noun with its letters.
            root("H0036A", "לָחַם", "to fight", "H:V", 170),
            root("H0036B", "לָחַם", "to eat", "H:V", 7),
            root("H0037", "לֶ֫חֶם", "bread", "H:N-M", 300),
            // 9-10: exact homographs; a rival only by consonants.
            root("H0038", "נָשָׁא", "to deceive", "H:V", 16),
            root("H0039", "נָשָׂא", "to lift", "H:V", 656),
            root("G0001", "θυγάτηρ", "daughter", "G:N-F", 28),
            root("G0002", "μετρητής", "measure", "G:N-M", 1),
            root("G0003", "βασιλεύς", "king", "G:N-M", 115),
            root("G0004", "σκοτόω", "to darken", "G:V", 3),
            root("G0005", "ἐκζητέω", "to seek out", "G:V", 7),
            root("G0006", "δειπνέω", "to dine", "G:V", 4),
            root("G0007", "ἀπατάω", "to deceive", "G:V", 3),
            root("G0008", "ἄρτος", "bread", "G:N-M", 97),
        ];
        // The cited verse 2Ch.4.5 holds the measure, Pro.23.1 'to eat', and
        // Pro.23.2 both words spelled בַּת.
        let verses = |b: &str, c: u16, v: u16| -> Vec<u32> {
            match (b, c, v) {
                ("2Ch", 4, 5) => vec![1, 11],
                ("Pro", 23, 1) => vec![7, 2],
                ("Pro", 23, 2) => vec![0, 1],
                _ => Vec::new(),
            }
        };
        let tbesg = [
            ("G0001", "[in LXX chiefly for בַּת ;]"),
            ("G0002", "[in LXX: <ref='2Ch.4.5'>2Ch.4:5</ref> (בַּת) ;]"),
            ("G0003", "[in LXX for מֶלֶךְ ;]"),
            ("G0004", "[in LXX for שָׁחַר, קדר ;]"),
            ("G0005", "[in LXX for שחר ;]"),
            ("G0006", "[in LXX for לחם, <ref='Pro.23.1'>Pro.23:1</ref> ;]"),
            ("G0007", "[in LXX for נָשָׁא hi. ;]"),
            // Conflicting evidence: both homographs in the cited verse.
            ("G0008", "[in LXX for לֶחֶם, בַּת, <ref='Pro.23.2'>Pro.23:2</ref> ;]"),
        ];
        let (json, stats) = build(&roots, &tbesg, &verses);
        assert_eq!(table(&json), [(11, 0), (12, 1), (13, 2), (13, 3), (14, 4), (16, 7), (17, 9), (18, 8)]);
        assert_eq!((stats.cited, stats.twins, stats.dominant, stats.ambiguous), (2, 1, 2, 2));
    }
}
