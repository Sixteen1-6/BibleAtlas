//! Aramaic words: where the Bible keeps a word in Aramaic (or Hebrew) instead
//! of translating it, and the parts of the Old Testament written in Aramaic.
//!
//! The New Testament text is the Greek of STEPBible's TAGNT, and the Gospel
//! writers give Jesus' Aramaic in Greek letters (ταλιθα κουμ, Mark 5:41), so to
//! the rest of the build every New Testament root is Greek. The words, the
//! Old Testament sections and the roots are curated in `config/aramaic.json`.
//! This module checks every claim it can against the BSB, TAGNT and TAHOT, and
//! fails the build on any mismatch rather than show a wrong note.
//!
//! Outputs, under web/public/data:
//! - `extras/aramaic.json`, small because it loads with the first verse a
//!   reader selects: `{format, verses, chapters, entries, sections, roots}`.
//!   `verses` lists each verse that has a line: the line (a string, or words
//!   and verse links in reading order) and the entries or the section it
//!   belongs to. `chapters` lists each chapter a section covers, with its
//!   line. Verse numbers are the app's.
//! - `extras/aramaic/deep.json`, loaded when a panel opens at Deep: the
//!   scholarly text, the spelling notes and the sources of each entry and
//!   section, and why each root counts as Aramaic or Hebrew.
//!
//! [`origins`] gives `lemmas.json` its `origin` map, so the word study names
//! ταλιθα "Aramaic, written in Greek letters" from the moment it opens, while
//! the root keeps its Greek font, grammar and Septuagint links.

use crate::build::FLAG_ARAMAIC;
use crate::loaded::Loaded;
use crate::parse::{Lang, LexEntry, Word};
use crate::sources::Inputs;
use atlas_core::canon::{Testament, BOOKS};
use atlas_core::{refs, Versification};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::Path;

const CONFIG: &str = "config/aramaic.json";
const OUT: &str = "extras/aramaic.json";
const DEEP: &str = "extras/aramaic/deep.json";

/// The longest a line under a verse or a chapter heading may be (README).
const MAX_LINE: usize = 70;
/// The longest a plain panel note may be.
const MAX_NOTE: usize = 220;
/// The longest a Deep text may be.
const MAX_DEEP: usize = 450;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    _comment: Vec<String>,
    words: Vec<Entry>,
    sections: Vec<Section>,
    #[serde(rename = "loanRoots")]
    loan_roots: Vec<LoanRoot>,
}

/// A word the New Testament keeps in Aramaic or Hebrew.
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Entry {
    id: String,
    refs: Vec<String>,
    word: String,
    bsb: BTreeMap<String, String>,
    meaning: String,
    meaning_from: MeaningFrom,
    speaker: Speaker,
    jesus: bool,
    kind: Kind,
    language: Language,
    greek: BTreeMap<String, String>,
    strongs: Vec<String>,
    aramaic: String,
    aramaic_note: String,
    /// The caption over the square letters, where the language alone would
    /// mislead (Barnabas: only "bar" is shown; Bethesda: a related name).
    #[serde(default)]
    letters_caption: String,
    /// A plain sentence under the letters at Study saying how sure they are.
    /// Required when the certainty is "scholars differ".
    #[serde(default)]
    letters_note: String,
    line: String,
    note: String,
    deep: String,
    certainty: Certainty,
    sources: Vec<String>,
}

/// A part of the Old Testament written in Aramaic.
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Section {
    id: String,
    from: String,
    to: String,
    starts_mid_verse: bool,
    ends_mid_verse: bool,
    /// TAHOT word numbers (from 1), when only some words of one verse are Aramaic.
    #[serde(default)]
    words: Vec<usize>,
    basis: Basis,
    line: String,
    note: String,
    deep: String,
    sources: Vec<String>,
}

/// A Greek root whose word comes from Aramaic or Hebrew.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LoanRoot {
    strongs: String,
    word: String,
    language: Language,
    why: String,
    certainty: Certainty,
}

/// Who says or uses the word: one for every ref, or one per ref ("Andrew"
/// at John 1:41, "the Samaritan woman" at John 4:25).
#[derive(Deserialize)]
#[serde(untagged)]
enum Speaker {
    All(String),
    ByRef(BTreeMap<String, String>),
}

impl Speaker {
    fn at(&self, r: &str) -> Option<&str> {
        match self {
            Speaker::All(s) => Some(s),
            Speaker::ByRef(m) => m.get(r).map(String::as_str),
        }
    }
}

#[derive(Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum MeaningFrom {
    Verse,
    Gloss,
}

#[derive(Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum Kind {
    Saying,
    Prayer,
    Word,
    Name,
    Place,
    Title,
}

#[derive(Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
enum Language {
    Aramaic,
    Hebrew,
    #[serde(rename = "Aramaic or Hebrew")]
    AramaicOrHebrew,
}

impl Language {
    /// The code `lemmas.json` uses in `origin`.
    fn code(self) -> &'static str {
        match self {
            Language::Aramaic => "A",
            Language::Hebrew => "H",
            Language::AramaicOrHebrew => "AH",
        }
    }
}

#[derive(Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
enum Certainty {
    #[serde(rename = "widely agreed")]
    WidelyAgreed,
    #[serde(rename = "commonly held")]
    CommonlyHeld,
    #[serde(rename = "scholars differ")]
    ScholarsDiffer,
}

/// What a section rests on.
#[derive(Deserialize, Clone, Copy, PartialEq, Eq)]
enum Basis {
    /// TAHOT tags every word of the range Aramaic, and the verses around it Hebrew.
    #[serde(rename = "tahot")]
    Tahot,
    /// TAHOT tags the words Hebrew; the lexicon (TBESH) and the BSB's own
    /// footnote say they are Aramaic (Genesis 31:47).
    #[serde(rename = "tbesh+bsb-footnote")]
    LexiconAndFootnote,
}

fn read_config(root: &Path) -> Result<Config, String> {
    let path = root.join(CONFIG);
    let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    // This project never quotes or stores that translation, so its name has
    // no place here either.
    if text.contains("ESV") {
        return Err(format!(
            "{CONFIG} mentions the ESV, which this project never quotes"
        ));
    }
    serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))
}

/// A verse as the config writes it, the BSB's own name for it ("Mark 5:41",
/// "1 Corinthians 16:22"), as its verse number.
fn verse_of(s: &str, vz: &Versification) -> Result<u32, String> {
    let bad = || format!("{CONFIG}: {s:?} is not one BSB verse (write it like \"Mark 5:41\")");
    let q = refs::parse(s).ok_or_else(bad)?;
    let one = q.verse != 0 && (q.end_chapter, q.end_verse) == (q.chapter, q.verse);
    if !one || format!("{} {}:{}", BOOKS[q.book as usize].name, q.chapter, q.verse) != s {
        return Err(bad());
    }
    vz.index(q.book, q.chapter, q.verse).ok_or_else(bad)
}

/// "Daniel 7:28", as the app writes a verse name.
fn verse_name(v: u32, vz: &Versification) -> String {
    match vz.locate(v) {
        Some((b, c, vv)) => format!("{} {c}:{vv}", BOOKS[b as usize].name),
        None => format!("#{v}"),
    }
}

/// Fails unless `s` has some text and at most `max` characters (not bytes).
fn fits(what: &str, s: &str, max: usize) -> Result<(), String> {
    let n = s.chars().count();
    if s.trim().is_empty() {
        return Err(format!("{CONFIG}: {what} is empty"));
    }
    if n > max {
        return Err(format!(
            "{CONFIG}: {what} has {n} characters, at most {max}: {s:?}"
        ));
    }
    Ok(())
}

/// The names a verse link may start with: every book, and "Psalm" as the
/// app writes one psalm. Longest first, so "1 John" wins over "John".
fn book_names() -> Vec<&'static str> {
    let mut names: Vec<&'static str> = BOOKS.iter().map(|b| b.name).collect();
    names.push("Psalm");
    names.sort_by_key(|n| std::cmp::Reverse(n.len()));
    names
}

/// The verse names in a text ("Mark 14:36", "Psalm 22", "Ezra 4:8-6:18") as
/// links: the text itself when it names none, otherwise its pieces in reading
/// order, each name as `{verse, to?, text}` with the words it had. A name that
/// is not in the BSB fails the build: it is a typo.
fn linked(s: &str, vz: &Versification) -> Result<Value, String> {
    let names = book_names();
    let mut parts: Vec<Value> = Vec::new();
    let mut plain = 0;
    let mut i = 0;
    while i < s.len() {
        // A name starts a word, and is not a numbered book outside the
        // BSB's canon ("4 Ezra 7:36").
        let before = s[..i].trim_end_matches(' ');
        let starts_word = i == 0
            || !s[..i]
                .chars()
                .next_back()
                .is_some_and(char::is_alphanumeric)
                && !(before.len() < i && before.ends_with(|c: char| c.is_ascii_digit()));
        let found = starts_word
            .then(|| names.iter().find(|n| s[i..].starts_with(**n)))
            .flatten();
        let Some(name) = found else {
            i += s[i..].chars().next().map_or(1, char::len_utf8);
            continue;
        };
        // The numbers after the name: "22", "14:36", "7:12-26", "4:8-6:18".
        let after = i + name.len();
        let nums = s[after..].strip_prefix(' ').map(|rest| {
            rest.char_indices()
                .take_while(|&(k, c)| c.is_ascii_digit() || (k > 0 && matches!(c, ':' | '-' | '–')))
                .map(|(k, c)| k + c.len_utf8())
                .last()
                .unwrap_or(0)
        });
        let Some(len) = nums.filter(|&n| n > 0) else {
            i = after;
            continue;
        };
        // Keep a trailing ":" or "-" that ends a clause out of the name.
        let mut end = after + 1 + len;
        while s[..end].ends_with([':', '-', '–']) {
            end -= s[..end].chars().next_back().map_or(1, char::len_utf8);
        }
        let text = &s[i..end];
        let q = refs::parse(&text.replace('–', "-"))
            .ok_or_else(|| format!("{CONFIG}: cannot read the verse name {text:?} in {s:?}"))?;
        let (from, to) = refs::resolve(q, vz)
            .ok_or_else(|| format!("{CONFIG}: {text:?} in {s:?} is not in the BSB"))?;
        if plain < i {
            parts.push(json!(&s[plain..i]));
        }
        parts.push(if to > from {
            json!({ "verse": from, "to": to, "text": text })
        } else {
            json!({ "verse": from, "text": text })
        });
        plain = end;
        i = end;
    }
    if parts.is_empty() {
        return Ok(json!(s));
    }
    if plain < s.len() {
        parts.push(json!(&s[plain..]));
    }
    Ok(Value::Array(parts))
}

/// A TAGNT word as printed, without the punctuation around it ("κουμ," is "κουμ").
fn bare(s: &str) -> &str {
    s.trim_matches(|c: char| !c.is_alphabetic())
}

/// Where a `greek` value is among a verse's TAGNT words.
#[derive(Debug, PartialEq)]
enum Found {
    /// In the main text (the Nestle-Aland family).
    Main,
    /// Only in other editions, or as another reading TAGNT prints for a word,
    /// with the main text's word there when TAGNT gives one ("Βηθζαθά" at
    /// John 5:2), otherwise "".
    Elsewhere(String),
}

/// Whether `greek` is one of the verse's TAGNT words, or several in a row, as
/// TAGNT prints them (compared byte for byte), and where. Words of other
/// editions count, and so do the other readings TAGNT prints for a word
/// ("Βηθεσδά (t=Bēthesda) … in: Tyn+SBL+Treg+TR+Byz"), since the BSB
/// sometimes follows them (Bethesda, John 5:2); the panel then says so.
fn in_tagnt(greek: &str, ws: &[Word]) -> Option<Found> {
    let in_run = |run: &[&str]| {
        (0..run.len()).any(|i| {
            let mut joined = String::new();
            for w in &run[i..] {
                if !joined.is_empty() {
                    joined.push(' ');
                }
                joined.push_str(w);
                if joined == greek {
                    return true;
                }
                if joined.len() >= greek.len() {
                    break;
                }
            }
            false
        })
    };
    let main: Vec<&str> = ws
        .iter()
        .filter(|w| w.main)
        .map(|w| bare(&w.surface))
        .collect();
    if in_run(&main) {
        return Some(Found::Main);
    }
    let reading = format!("{greek} (");
    let read_in = ws.iter().find(|w| {
        w.note
            .as_ref()
            .and_then(|n| n.variants.as_deref())
            .is_some_and(|t| {
                t.match_indices(&reading)
                    .any(|(i, _)| !t[..i].chars().next_back().is_some_and(char::is_alphabetic))
            })
    });
    if let Some(w) = read_in {
        let there = if w.main { bare(&w.surface) } else { "" };
        return Some(Found::Elsewhere(there.to_string()));
    }
    let all: Vec<&str> = ws.iter().map(|w| bare(&w.surface)).collect();
    in_run(&all).then(|| Found::Elsewhere(String::new()))
}

/// For each base-text word of a verse, whether TAHOT tags it Aramaic.
fn aramaic_flags(ws: &[Word]) -> Vec<bool> {
    ws.iter()
        .filter(|w| w.main)
        .map(|w| w.lang == Lang::Aramaic)
        .collect()
}

/// Checks a section that rests on TAHOT: every word of it is tagged Aramaic,
/// except Hebrew words before the switch in its first verse (startsMidVerse)
/// or after it in its last (endsMidVerse), and the verses on either side are
/// Hebrew.
fn check_tahot(
    s: &Section,
    from: u32,
    to: u32,
    vz: &Versification,
    words: &[Vec<Word>],
) -> Result<(), String> {
    let fail = |why: String| {
        Err(format!(
            "{CONFIG}: section {} ({} to {}) does not match TAHOT: {why}",
            s.id, s.from, s.to
        ))
    };
    let book = |v: u32| vz.locate(v).map(|(b, _, _)| b);
    for (v, side) in [(from.checked_sub(1), "before"), (Some(to + 1), "after")] {
        if let Some(v) = v.filter(|&v| v < vz.verse_count() && book(v) == book(from)) {
            if aramaic_flags(&words[v as usize]).contains(&true) {
                return fail(format!(
                    "{} ({side} it) has Aramaic words",
                    verse_name(v, vz)
                ));
            }
        }
    }
    for v in from..=to {
        let flags = aramaic_flags(&words[v as usize]);
        let lead = if v == from {
            flags.iter().take_while(|&&a| !a).count()
        } else {
            0
        };
        let trail = if v == to {
            flags.iter().rev().take_while(|&&a| !a).count()
        } else {
            0
        };
        if v == from && s.starts_mid_verse != (lead > 0) {
            return fail(format!(
                "startsMidVerse is {}, but {} has {lead} Hebrew words before the Aramaic",
                s.starts_mid_verse,
                verse_name(v, vz)
            ));
        }
        if v == to && s.ends_mid_verse != (trail > 0) {
            return fail(format!(
                "endsMidVerse is {}, but {} has {trail} Hebrew words after the Aramaic",
                s.ends_mid_verse,
                verse_name(v, vz)
            ));
        }
        if lead + trail >= flags.len() || flags[lead..flags.len() - trail].contains(&false) {
            return fail(format!("{} is not all Aramaic", verse_name(v, vz)));
        }
    }
    Ok(())
}

/// What the checks read from the rest of the build.
struct Ctx<'a> {
    inputs: &'a Inputs,
    vz: &'a Versification,
    /// The BSB, by verse.
    text: &'a [String],
    words: &'a [Vec<Word>],
    lemma_index: &'a HashMap<&'a str, u32>,
    /// TBESH and TBESG, by root.
    lex: &'a HashMap<String, LexEntry>,
}

/// The text of the BSB's footnotes on one verse, from its USFM edition.
fn footnotes(c: &Ctx, v: u32) -> Result<String, String> {
    let (b, ch, vv) = c.vz.locate(v).ok_or("verse outside the BSB")?;
    let path = c.inputs.path("bsb-usfm", BOOKS[b as usize].osis);
    let usfm = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    Ok(footnote_text(&usfm, u32::from(ch), u32::from(vv)))
}

/// The footnotes of chapter `ch`, verse `vv` in a USFM book
/// (`\v 47 … \f + \fr 31:47 \ft The Aramaic \fqa Jegar-Sahadutha …\f*`), as
/// their words without the markers.
fn footnote_text(usfm: &str, ch: u32, vv: u32) -> String {
    let starts = |s: &str, n: u32| {
        s.strip_prefix(&n.to_string())
            .is_some_and(|rest| rest.starts_with(char::is_whitespace))
    };
    let verse = usfm
        .split("\\c ")
        .find(|c| starts(c, ch))
        .and_then(|c| c.split("\\v ").find(|x| starts(x, vv)))
        .unwrap_or("");
    let mut out = String::new();
    for note in verse.split("\\f ").skip(1) {
        let body = note.split("\\f*").next().unwrap_or("");
        // "+ \fr 31:47 \ft The Aramaic \fqa Jegar-Sahadutha …": skip the
        // caller and the reference, keep the words of every other part.
        for part in body.split('\\').skip(1) {
            let (marker, words) = part.split_once(' ').unwrap_or((part, ""));
            if marker != "fr" && !words.trim().is_empty() {
                if !out.is_empty() {
                    out.push(' ');
                }
                out.push_str(words.trim());
            }
        }
    }
    out
}

/// Checks a section that rests on the lexicon and the BSB footnote: one
/// verse, the word numbers it gives exist, startsMidVerse and endsMidVerse
/// agree with them, and TAHOT does not tag them Aramaic (if it did, the basis
/// would be "tahot"). Their roots then count as Aramaic in every word study,
/// so they must also be the right words: each root occurs in this verse and
/// nowhere else in the Bible, TBESH has an entry for each and calls one of
/// them Aramaic, and the BSB's footnote on the verse says Aramaic.
fn check_words(s: &Section, from: u32, to: u32, c: &Ctx) -> Result<(), String> {
    let words = c.words;
    let ws = &words[from as usize];
    let fail = |why: &str| Err(format!("{CONFIG}: section {}: {why}", s.id));
    if from != to || s.words.is_empty() {
        return fail(
            "a section on the lexicon and the footnote is one verse with its words listed",
        );
    }
    if !s.words.windows(2).all(|w| w[1] == w[0] + 1)
        || s.words[0] == 0
        || *s.words.last().unwrap() > ws.len()
    {
        return fail(&format!(
            "words {:?} are not words in a row of a verse of {} words",
            s.words,
            ws.len()
        ));
    }
    if s.starts_mid_verse != (s.words[0] > 1)
        || s.ends_mid_verse != (*s.words.last().unwrap() < ws.len())
    {
        return fail("startsMidVerse or endsMidVerse disagrees with its words");
    }
    if s.words
        .iter()
        .any(|&k| ws[k - 1].lang == Lang::Aramaic || !ws[k - 1].main)
    {
        return fail("TAHOT already tags these words Aramaic (use basis \"tahot\"), or they are not in the base text");
    }
    // The right words: roots of their own, found nowhere else...
    let mut roots: Vec<&str> = Vec::new();
    for &k in &s.words {
        match ws[k - 1].lemma.as_deref() {
            Some(r) if c.lemma_index.contains_key(r) => roots.push(r),
            _ => return fail(&format!("word {k} has no root in the lemma table")),
        }
    }
    for (v, vw) in words.iter().enumerate() {
        if v as u32 == from {
            continue;
        }
        if let Some(r) = vw
            .iter()
            .filter_map(|w| w.lemma.as_deref())
            .find(|r| roots.contains(r))
        {
            return fail(&format!(
                "root {r} also occurs in {}, so these are not the verse's own Aramaic words (check words)",
                verse_name(v as u32, c.vz)
            ));
        }
    }
    // ...that the lexicon and the footnote call Aramaic.
    let entries: Vec<&LexEntry> = roots.iter().filter_map(|r| c.lex.get(*r)).collect();
    if entries.len() != roots.len()
        || entries.iter().any(|e| e.source != "tbesh")
        || !entries.iter().any(|e| e.definition.contains("Aramaic"))
    {
        return fail(&format!(
            "TBESH must have an entry for each of {roots:?} and call one of them Aramaic"
        ));
    }
    if !footnotes(c, from)?.contains("Aramaic") {
        return fail(&format!(
            "the BSB's footnote on {} does not say Aramaic",
            s.from
        ));
    }
    Ok(())
}

/// A section's first and last verse, checked against the data.
fn section_range(s: &Section, c: &Ctx) -> Result<(u32, u32), String> {
    let (vz, words) = (c.vz, c.words);
    let (from, to) = (verse_of(&s.from, vz)?, verse_of(&s.to, vz)?);
    let book = |v: u32| vz.locate(v).map(|(b, _, _)| b);
    if from > to
        || book(from) != book(to)
        || book(from).is_none_or(|b| BOOKS[b as usize].testament != Testament::Old)
    {
        return Err(format!(
            "{CONFIG}: section {} must run forward within one Old Testament book",
            s.id
        ));
    }
    match s.basis {
        Basis::Tahot if !s.words.is_empty() => {
            return Err(format!(
                "{CONFIG}: section {}: words are only for a section TAHOT does not tag",
                s.id
            ))
        }
        Basis::Tahot => check_tahot(s, from, to, vz, words)?,
        Basis::LexiconAndFootnote => check_words(s, from, to, c)?,
    }
    Ok((from, to))
}

/// The roots of the words a section on the lexicon names (Genesis 31:47:
/// H3026A, H3026B), which TAHOT tags Hebrew.
fn section_roots<'a>(
    s: &Section,
    from: u32,
    words: &'a [Vec<Word>],
) -> impl Iterator<Item = &'a str> + 'a {
    let ws = &words[from as usize];
    let picked: Vec<usize> = if s.basis == Basis::LexiconAndFootnote {
        s.words.clone()
    } else {
        Vec::new()
    };
    picked
        .into_iter()
        .filter_map(move |k| ws.get(k.checked_sub(1)?)?.lemma.as_deref())
}

/// "Two", for "Two words in verse 47".
fn count_word(n: usize) -> String {
    const WORDS: [&str; 11] = [
        "No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    ];
    WORDS
        .get(n)
        .map_or_else(|| n.to_string(), |w| w.to_string())
}

/// The line under each chapter heading a section covers: the section's own
/// line where it covers the whole chapter, otherwise which verses, in plain
/// words ("From verse 8, this chapter is in Aramaic, not Hebrew").
fn chapter_lines(
    s: &Section,
    from: u32,
    to: u32,
    vz: &Versification,
) -> Result<Vec<(u8, u16, Value)>, String> {
    let (book, first_ch, _) = vz.locate(from).ok_or("section outside the BSB")?;
    let (_, last_ch, _) = vz.locate(to).ok_or("section outside the BSB")?;
    let mut out = Vec::new();
    for ch in first_ch..=last_ch {
        let n = vz.verses_in(book, ch).ok_or("chapter outside the BSB")?;
        let (start, end) = (
            vz.index(book, ch, 1).unwrap(),
            vz.index(book, ch, n).unwrap(),
        );
        let (lo, hi) = (from.max(start), to.min(end));
        let (lo_mid, hi_mid) = (
            lo == from && s.starts_mid_verse,
            hi == to && s.ends_mid_verse,
        );
        let num = |v: u32| vz.locate(v).map_or(0, |(_, _, x)| x);
        let one = |text: String| json!({ "verse": lo, "text": text });
        let span = |text: String| json!({ "verse": lo, "to": hi, "text": text });
        let parts = Value::Array;
        let line = if lo == start && hi == end && !lo_mid && !hi_mid {
            linked(&s.line, vz)?
        } else if !s.words.is_empty() {
            let (w, are) = if s.words.len() == 1 {
                ("word", "is")
            } else {
                ("words", "are")
            };
            parts(vec![
                json!(format!("{} {w} in ", count_word(s.words.len()))),
                one(format!("verse {}", num(lo))),
                json!(format!(" {are} Aramaic, not Hebrew")),
            ])
        } else if lo == hi && (lo_mid || hi_mid) {
            parts(vec![
                json!("Part of "),
                one(format!("verse {}", num(lo))),
                json!(" is in Aramaic, not Hebrew"),
            ])
        } else if lo == hi {
            parts(vec![
                one(format!("Verse {}", num(lo))),
                json!(" of this chapter is in Aramaic, not Hebrew"),
            ])
        } else if hi == end && !hi_mid {
            let from_where = if lo_mid {
                "From the middle of "
            } else {
                "From "
            };
            parts(vec![
                json!(from_where),
                one(format!("verse {}", num(lo))),
                json!(", this chapter is in Aramaic, not Hebrew"),
            ])
        } else if !lo_mid && !hi_mid {
            parts(vec![
                span(format!("Verses {}–{}", num(lo), num(hi))),
                json!(" of this chapter are in Aramaic, not Hebrew"),
            ])
        } else {
            // A switch inside a verse at either end of a span within the chapter.
            let (a, b) = (num(lo), num(hi));
            let text = match (lo_mid, hi_mid) {
                (true, true) => format!("From mid-verse {a} to mid-verse {b}"),
                (true, false) => format!("From the middle of verse {a} to verse {b}"),
                _ => format!("From verse {a} to the middle of verse {b}"),
            };
            parts(vec![span(text), json!(", the text is in Aramaic")])
        };
        out.push((book, ch, line));
    }
    Ok(out)
}

/// The plain length of a line, as the reader sees it: a verse link with no
/// words of its own reads as the verse's name.
fn line_len(line: &Value, vz: &Versification) -> usize {
    let part = |p: &Value| match (p.as_str(), p["text"].as_str(), p["verse"].as_u64()) {
        (Some(s), _, _) | (None, Some(s), _) => s.chars().count(),
        (None, None, Some(v)) => {
            verse_name(v as u32, vz).chars().count() + p["to"].as_u64().map_or(0, |_| 6)
        }
        _ => 0,
    };
    match line {
        Value::Array(parts) => parts.iter().map(part).sum(),
        other => part(other),
    }
}

/// The one line for a verse that several entries share (Matthew 5:22: Raca
/// and Gehenna): "Two of Jesus’ words kept in the Greek: Raca and Gehenna
/// (‘hell’)", with each word in the order the verse has it.
fn shared_line(es: &[(&Entry, &str)]) -> String {
    let all_jesus = es.iter().all(|(e, _)| e.jesus);
    let named: Vec<String> = es
        .iter()
        .map(|(e, bsb)| {
            if e.word.eq_ignore_ascii_case(bsb) {
                e.word.clone()
            } else {
                format!("{} (‘{bsb}’)", e.word)
            }
        })
        .collect();
    let list = match named.split_last() {
        Some((last, rest)) if !rest.is_empty() => format!("{} and {last}", rest.join(", ")),
        _ => named.join(""),
    };
    let whose = if all_jesus {
        "of Jesus’ words"
    } else {
        "words"
    };
    format!("{} {whose} kept in the Greek: {list}", count_word(es.len()))
}

/// One entry, checked: its verses in the order of its refs, and for each
/// verse whether its `greek` is TAGNT's main text.
struct CheckedEntry {
    verses: Vec<u32>,
    found: Vec<Found>,
}

/// Checks one entry against the BSB, TAGNT, the lemma table and its loan
/// roots.
fn check_entry(
    e: &Entry,
    c: &Ctx,
    loans: &HashMap<&str, &LoanRoot>,
) -> Result<CheckedEntry, String> {
    let at = |what: &str| format!("{CONFIG}: {} {what}", e.id);
    let field = |what: &str| format!("{} {what}", e.id);
    fits(&field("line"), &e.line, MAX_LINE)?;
    fits(&field("note"), &e.note, MAX_NOTE)?;
    fits(&field("deep"), &e.deep, MAX_DEEP)?;
    if !e.aramaic_note.is_empty() {
        fits(&field("aramaicNote"), &e.aramaic_note, MAX_DEEP)?;
    }
    fits(&field("word"), &e.word, 40)?;
    fits(&field("meaning"), &e.meaning, 100)?;
    fits(&field("aramaic"), &e.aramaic, 60)?;
    if !e.letters_caption.is_empty() {
        fits(&field("lettersCaption"), &e.letters_caption, 60)?;
    }
    // A tentative form in square letters says so at Study, where it shows.
    if e.certainty == Certainty::ScholarsDiffer || !e.letters_note.is_empty() {
        fits(&field("lettersNote"), &e.letters_note, MAX_NOTE)?;
    }
    if e.sources.is_empty() || e.refs.is_empty() || e.strongs.is_empty() {
        return Err(at("needs refs, strongs and sources"));
    }
    for s in &e.sources {
        fits(&field("source"), s, 400)?;
    }
    let refs: BTreeMap<&String, ()> = e.refs.iter().map(|r| (r, ())).collect();
    let speakers_ok = match &e.speaker {
        Speaker::All(_) => true,
        Speaker::ByRef(m) => m.keys().eq(refs.keys().copied()),
    };
    if refs.len() != e.refs.len()
        || !e.bsb.keys().eq(refs.keys().copied())
        || !e.greek.keys().eq(refs.keys().copied())
        || !speakers_ok
    {
        return Err(at(
            "must give bsb and greek (and speaker, if per ref) for each of its refs, once each",
        ));
    }
    let mut verses = Vec::new();
    let mut found = Vec::new();
    for r in &e.refs {
        fits(&field("speaker"), e.speaker.at(r).unwrap_or(""), 80)?;
        let v = verse_of(r, c.vz)?;
        if c.vz
            .locate(v)
            .is_none_or(|(b, _, _)| BOOKS[b as usize].testament != Testament::New)
        {
            return Err(at(&format!("{r} is not in the New Testament")));
        }
        let english = &c.text[v as usize];
        if !english.contains(e.bsb[r].as_str()) {
            return Err(at(&format!(
                "bsb {:?} is not in the BSB at {r}: {english:?}",
                e.bsb[r]
            )));
        }
        if e.meaning_from == MeaningFrom::Verse && !english.contains(e.meaning.as_str()) {
            return Err(at(&format!(
                "meaning {:?} (from the verse) is not in the BSB at {r}: {english:?}",
                e.meaning
            )));
        }
        let ws = &c.words[v as usize];
        let Some(f) = in_tagnt(&e.greek[r], ws) else {
            let printed: Vec<&str> = ws.iter().map(|w| w.surface.as_str()).collect();
            return Err(at(&format!(
                "greek {:?} is not among TAGNT's words at {r}: {}",
                e.greek[r],
                printed.join(" ")
            )));
        };
        for k in &e.strongs {
            if !ws.iter().any(|w| w.lemma.as_deref() == Some(k.as_str())) {
                return Err(at(&format!("{k} is on no word of {r}")));
            }
        }
        verses.push(v);
        found.push(f);
    }
    let mut langs = Vec::new();
    for k in &e.strongs {
        match loans.get(k.as_str()) {
            Some(l) if c.lemma_index.contains_key(k.as_str()) => langs.push(l.language),
            _ => {
                return Err(at(&format!(
                    "{k} must be in the lemma table and in loanRoots"
                )))
            }
        }
    }
    // The panel names the entry's language and the word study its roots':
    // they must agree ("Aramaic or Hebrew" when the roots differ).
    let roots_say = if langs.iter().all(|&l| l == langs[0]) {
        langs[0]
    } else {
        Language::AramaicOrHebrew
    };
    if e.language != roots_say {
        return Err(at(
            "language must be its loan roots' language (\"Aramaic or Hebrew\" if they differ)",
        ));
    }
    Ok(CheckedEntry { verses, found })
}

/// Reads and checks the config: every entry and section against the data,
/// every loan root against the lemma table, and that every Aramaic word TAHOT
/// tags lies in a section.
struct Checked {
    cfg: Config,
    /// Each entry, checked.
    entries: Vec<CheckedEntry>,
    /// Each section's first and last verse.
    ranges: Vec<(u32, u32)>,
}

fn check(root: &Path, c: &Ctx) -> Result<Checked, String> {
    let (vz, words, lemma_index) = (c.vz, c.words, c.lemma_index);
    let cfg = read_config(root)?;
    let mut ids = HashSet::new();
    for id in cfg
        .words
        .iter()
        .map(|e| &e.id)
        .chain(cfg.sections.iter().map(|s| &s.id))
    {
        if id.is_empty()
            || !id
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
            || !ids.insert(id.as_str())
        {
            return Err(format!(
                "{CONFIG}: id {id:?} must be unique, in lowercase letters, digits and hyphens"
            ));
        }
    }
    let mut loans: HashMap<&str, &LoanRoot> = HashMap::new();
    for l in &cfg.loan_roots {
        fits(&format!("loan root {} why", l.strongs), &l.why, MAX_DEEP)?;
        fits(&format!("loan root {} word", l.strongs), &l.word, 40)?;
        if !l.strongs.starts_with('G')
            || !lemma_index.contains_key(l.strongs.as_str())
            || loans.insert(l.strongs.as_str(), l).is_some()
        {
            return Err(format!(
                "{CONFIG}: loan root {} must be a Greek root in the lemma table, listed once",
                l.strongs
            ));
        }
    }
    let mut entries = Vec::new();
    for e in &cfg.words {
        entries.push(check_entry(e, c, &loans)?);
    }
    let mut ranges = Vec::new();
    for s in &cfg.sections {
        fits(&format!("section {} line", s.id), &s.line, MAX_LINE)?;
        fits(&format!("section {} note", s.id), &s.note, MAX_NOTE)?;
        fits(&format!("section {} deep", s.id), &s.deep, MAX_DEEP)?;
        if s.sources.is_empty() {
            return Err(format!("{CONFIG}: section {} has no sources", s.id));
        }
        ranges.push(section_range(s, c)?);
    }
    let mut sorted = ranges.clone();
    sorted.sort_unstable();
    if sorted.windows(2).any(|w| w[1].0 <= w[0].1) {
        return Err(format!("{CONFIG}: sections must not overlap"));
    }
    // Every word TAHOT tags Aramaic lies in a section on TAHOT.
    let tahot: Vec<(u32, u32)> = cfg
        .sections
        .iter()
        .zip(&ranges)
        .filter(|(s, _)| s.basis == Basis::Tahot)
        .map(|(_, r)| *r)
        .collect();
    for (v, ws) in words.iter().enumerate() {
        let v = v as u32;
        if ws.iter().any(|w| w.lang == Lang::Aramaic)
            && !tahot.iter().any(|&(a, b)| (a..=b).contains(&v))
        {
            return Err(format!(
                "{CONFIG}: TAHOT tags words of {} Aramaic, but no section covers it",
                verse_name(v, vz)
            ));
        }
    }
    Ok(Checked {
        cfg,
        entries,
        ranges,
    })
}

/// The files to write under web/public/data, as (path, bytes).
pub fn build(
    root: &Path,
    inputs: &Inputs,
    vz: &Versification,
    text: &[String],
    words: &[Vec<Word>],
    lemma_index: &HashMap<&str, u32>,
    lex: &HashMap<String, LexEntry>,
) -> Result<Vec<(String, Vec<u8>)>, String> {
    let c = Ctx {
        inputs,
        vz,
        text,
        words,
        lemma_index,
        lex,
    };
    let Checked {
        cfg,
        entries: checked,
        ranges,
    } = check(root, &c)?;
    let entry_verses: Vec<&Vec<u32>> = checked.iter().map(|e| &e.verses).collect();

    // Lines under verses: the entries at each verse...
    let mut at: BTreeMap<u32, Vec<usize>> = BTreeMap::new();
    for (i, vs) in entry_verses.iter().enumerate() {
        for &v in vs.iter() {
            at.entry(v).or_default().push(i);
        }
    }
    let mut verses: BTreeMap<u32, Value> = BTreeMap::new();
    for (&v, list) in at.iter_mut() {
        let place = |i: usize| {
            let e = &cfg.words[i];
            let r = &e.refs[entry_verses[i].iter().position(|&x| x == v).unwrap()];
            (
                text[v as usize].find(e.bsb[r].as_str()).unwrap_or(0),
                e.bsb[r].as_str(),
            )
        };
        list.sort_by_key(|&i| place(i).0);
        let line = if list.len() == 1 {
            linked(&cfg.words[list[0]].line, vz)?
        } else {
            let es: Vec<(&Entry, &str)> =
                list.iter().map(|&i| (&cfg.words[i], place(i).1)).collect();
            json!(shared_line(&es))
        };
        verses.insert(v, json!({ "v": v, "line": line, "entries": list }));
    }
    // ...and where each section begins and ends (or the verse, for one verse).
    for (i, (s, &(from, to))) in cfg.sections.iter().zip(&ranges).enumerate() {
        let mut put = |v: u32, line: Value| {
            if verses.contains_key(&v) {
                return Err(format!(
                    "{CONFIG}: {} would have two lines",
                    verse_name(v, vz)
                ));
            }
            verses.insert(v, json!({ "v": v, "line": line, "section": i }));
            Ok(())
        };
        if from == to {
            put(from, linked(&s.line, vz)?)?;
        } else {
            // "From here" only where the switch is at the start of the verse
            // (Daniel 2:4 begins in Hebrew).
            put(
                from,
                if s.starts_mid_verse {
                    json!(["From the middle of this verse to ", { "verse": to }, ", the text is in Aramaic"])
                } else {
                    json!(["From here to ", { "verse": to }, ", the text is in Aramaic, not Hebrew"])
                },
            )?;
            put(
                to,
                if s.ends_mid_verse {
                    json!(["The Aramaic that began at ", { "verse": from }, " ends partway through this verse"])
                } else {
                    json!(["The Aramaic that began at ", { "verse": from }, " ends with this verse"])
                },
            )?;
        }
    }
    let mut chapters = Vec::new();
    for (i, (s, &(from, to))) in cfg.sections.iter().zip(&ranges).enumerate() {
        for (book, ch, line) in chapter_lines(s, from, to, vz)? {
            chapters.push(json!({ "book": book, "chapter": ch, "line": line, "section": i }));
        }
    }
    for row in verses.values().chain(&chapters) {
        let line = &row["line"];
        if line_len(line, vz) > MAX_LINE {
            return Err(format!(
                "{CONFIG}: the line {line} is over {MAX_LINE} characters"
            ));
        }
    }

    let index = |k: &str| lemma_index[k];
    let entries: Vec<Value> = cfg
        .words
        .iter()
        .zip(&checked)
        .map(|(e, ce)| {
            // For each verse: null where the Greek shown is TAGNT's main
            // text, otherwise the main text's word there ("" if none).
            let main_reading: Vec<Value> = ce
                .found
                .iter()
                .map(|f| match f {
                    Found::Main => Value::Null,
                    Found::Elsewhere(w) => json!(w),
                })
                .collect();
            Ok(json!({
                "id": e.id,
                "verses": ce.verses,
                "word": e.word,
                "meaning": e.meaning,
                "meaningFrom": e.meaning_from,
                "speaker": e.refs.iter().map(|r| e.speaker.at(r).unwrap_or("")).collect::<Vec<_>>(),
                "jesus": e.jesus,
                "kind": e.kind,
                "language": e.language,
                "certainty": e.certainty,
                "note": linked(&e.note, vz)?,
                "aramaic": e.aramaic,
                "lettersCaption": e.letters_caption,
                "lettersNote": e.letters_note,
                "bsb": e.refs.iter().map(|r| &e.bsb[r]).collect::<Vec<_>>(),
                "greek": e.refs.iter().map(|r| &e.greek[r]).collect::<Vec<_>>(),
                "mainReading": main_reading,
                "roots": e.strongs.iter().map(|k| index(k)).collect::<Vec<_>>(),
            }))
        })
        .collect::<Result<_, String>>()?;
    let sections: Vec<Value> = cfg
        .sections
        .iter()
        .zip(&ranges)
        .map(|(s, &(from, to))| {
            Ok(json!({
                "id": s.id,
                "from": from,
                "to": to,
                "startsMidVerse": s.starts_mid_verse,
                "endsMidVerse": s.ends_mid_verse,
                "words": s.words,
                "tahot": s.basis == Basis::Tahot,
                "line": linked(&s.line, vz)?,
                "note": linked(&s.note, vz)?,
            }))
        })
        .collect::<Result<_, String>>()?;
    let roots: Vec<Value> = cfg
        .loan_roots
        .iter()
        .map(|l| json!([index(&l.strongs), l.language, l.certainty]))
        .collect();
    let doc = json!({
        "format": 1,
        "verses": verses.into_values().collect::<Vec<_>>(),
        "chapters": chapters,
        "entries": entries,
        "sections": sections,
        "roots": roots,
    });

    let mut deep_entries = serde_json::Map::new();
    for e in &cfg.words {
        deep_entries.insert(
            e.id.clone(),
            json!({ "deep": linked(&e.deep, vz)?, "aramaicNote": linked(&e.aramaic_note, vz)?, "sources": e.sources }),
        );
    }
    let mut deep_sections = serde_json::Map::new();
    for s in &cfg.sections {
        deep_sections.insert(
            s.id.clone(),
            json!({ "deep": linked(&s.deep, vz)?, "sources": s.sources }),
        );
    }
    let why: serde_json::Map<String, Value> = cfg
        .loan_roots
        .iter()
        .map(|l| (index(&l.strongs).to_string(), json!(l.why)))
        .collect();
    let deep =
        json!({ "format": 1, "entries": deep_entries, "sections": deep_sections, "roots": why });

    let out = serde_json::to_vec(&doc).map_err(|e| e.to_string())?;
    if out.len() > 200_000 {
        return Err(format!(
            "{OUT} is {} bytes; keep it under 200 KB",
            out.len()
        ));
    }
    eprintln!(
        "aramaic: {} words in {} verses, {} sections in {} chapters, {} roots; {} bytes",
        cfg.words.len(),
        at.len(),
        cfg.sections.len(),
        chapters.len(),
        cfg.loan_roots.len(),
        out.len()
    );
    Ok(vec![
        (OUT.to_string(), out),
        (
            DEEP.to_string(),
            serde_json::to_vec(&deep).map_err(|e| e.to_string())?,
        ),
    ])
}

/// The `origin` map of lemmas.json: root index to the language its word
/// comes from, for roots whose script does not say it. "A", "H" or "AH"
/// (Aramaic, Hebrew, Aramaic or Hebrew): a word kept in that language, written
/// in Greek letters (ταλιθα), or in Hebrew letters where TAHOT tags it Hebrew
/// (Genesis 31:47). "GA", "GH" or "GAH": a Greek word taken from that
/// language, which no entry of words uses (ἀμήν, σάββατον, Σατανᾶς).
///
/// It runs before [`build`], so it checks the config first: lemmas.json is
/// never written from a config the build would refuse.
pub fn origins(
    root: &Path,
    inputs: &Inputs,
    vz: &Versification,
    text: &[String],
    words: &[Vec<Word>],
    lemma_index: &HashMap<&str, u32>,
    lex: &HashMap<String, LexEntry>,
) -> Result<Value, String> {
    let c = Ctx {
        inputs,
        vz,
        text,
        words,
        lemma_index,
        lex,
    };
    let Checked { cfg, ranges, .. } = check(root, &c)?;
    let kept: HashSet<&str> = cfg
        .words
        .iter()
        .flat_map(|e| e.strongs.iter().map(String::as_str))
        .collect();
    let mut out = serde_json::Map::new();
    for l in &cfg.loan_roots {
        let i = lemma_index.get(l.strongs.as_str()).ok_or_else(|| {
            format!(
                "{CONFIG}: loan root {} is not in the lemma table",
                l.strongs
            )
        })?;
        let code = if kept.contains(l.strongs.as_str()) {
            l.language.code().to_string()
        } else {
            format!("G{}", l.language.code())
        };
        out.insert(i.to_string(), json!(code));
    }
    for (s, &(from, _)) in cfg.sections.iter().zip(&ranges) {
        for k in section_roots(s, from, words) {
            let i = lemma_index.get(k).ok_or_else(|| {
                format!(
                    "{CONFIG}: section {}: root {k} is not in the lemma table",
                    s.id
                )
            })?;
            out.insert(i.to_string(), json!(Language::Aramaic.code()));
        }
    }
    Ok(Value::Object(out))
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let read = |rel: &str| -> Result<Value, String> {
        let path = d.dir.join(rel);
        let text =
            fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
        serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))
    };
    let doc = read(OUT)?;
    let deep = read(DEEP)?;
    let n = d.vz.verse_count();
    let list = |k: &str| doc[k].as_array().cloned().unwrap_or_default();
    let (verses, chapters, entries, sections) = (
        list("verses"),
        list("chapters"),
        list("entries"),
        list("sections"),
    );
    let num = |x: &Value| x.as_u64().map(|v| v as u32);
    let entry = |id: &str| entries.iter().find(|e| e["id"] == id);
    let has_verse = |id: &str, r: &str| -> Result<bool, String> {
        let (v, _) = d.resolve(r)?;
        Ok(entry(id).is_some_and(|e| {
            e["verses"]
                .as_array()
                .is_some_and(|vs| vs.iter().any(|x| num(x) == Some(v)))
        }))
    };
    let section_has = |id: &str, r: &str| -> Result<bool, String> {
        let (v, _) = d.resolve(r)?;
        Ok(sections.iter().any(|s| {
            s["id"] == id
                && num(&s["from"]).is_some_and(|a| a <= v)
                && num(&s["to"]).is_some_and(|b| v <= b)
        }))
    };
    let in_any_section = |r: &str| -> Result<bool, String> {
        let (v, _) = d.resolve(r)?;
        Ok(sections.iter().any(|s| {
            num(&s["from"]).is_some_and(|a| a <= v) && num(&s["to"]).is_some_and(|b| v <= b)
        }))
    };
    let line_at = |r: &str| -> Result<bool, String> {
        let (v, _) = d.resolve(r)?;
        Ok(verses.iter().any(|x| num(&x["v"]) == Some(v)))
    };

    // Every verse number in the file, in lines and links too.
    let mut all: Vec<u32> = Vec::new();
    fn collect(x: &Value, key: Option<&str>, out: &mut Vec<u32>) {
        match x {
            Value::Object(o) => o
                .iter()
                .filter(|(k, _)| {
                    !matches!(
                        k.as_str(),
                        "entries" | "section" | "book" | "chapter" | "roots" | "words"
                    )
                })
                .for_each(|(k, v)| collect(v, Some(k), out)),
            Value::Array(a) => a.iter().for_each(|v| collect(v, key, out)),
            Value::Number(v) if matches!(key, Some("v" | "verse" | "to" | "from" | "verses")) => {
                out.extend(v.as_u64().map(|v| v as u32))
            }
            _ => {}
        }
    }
    for k in ["verses", "chapters", "entries", "sections"] {
        collect(&doc[k], None, &mut all);
    }
    let chapters_ok = chapters.iter().all(|c| {
        let (b, ch) = (
            c["book"].as_u64().unwrap_or(99),
            c["chapter"].as_u64().unwrap_or(0),
        );
        b < 66 && ch >= 1 && ch <= u64::from(d.vz.chapters_in(b as u8))
    });

    // The word study's labels.
    let origin = |k: &str| {
        d.lemma_index(k).and_then(|i| {
            d.lemmas["origin"][i.to_string()]
                .as_str()
                .map(str::to_string)
        })
    };
    let deep_ok = entries.iter().all(|e| {
        e["id"].as_str().is_some_and(|id| {
            deep["entries"][id]["deep"].is_string() || deep["entries"][id]["deep"].is_array()
        })
    });

    // Only Genesis 31:47's two words relabel a Hebrew root: any other would
    // change the word study of a common Hebrew word across the Bible.
    let mut h_roots: Vec<String> = d.lemmas["origin"]
        .as_object()
        .map(|o| {
            o.keys()
                .filter_map(|i| d.lemmas["key"][i.parse::<usize>().ok()?].as_str())
                .filter(|k| k.starts_with('H'))
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    h_roots.sort();
    // Daniel 2:4 switches to Aramaic halfway through, and its line says so.
    let dan24 = d.resolve("Dan 2:4")?.0;
    let dan24_line = verses
        .iter()
        .find(|x| num(&x["v"]) == Some(dan24))
        .and_then(|x| x["line"][0].as_str())
        .unwrap_or("");
    // Bethesda (John 5:2) is not TAGNT's main text, Βηθζαθά; Talitha koum is.
    let main_reading = |id: &str| entry(id).map(|e| e["mainReading"][0].clone());

    // Mark 5:41 has talitha's root in its Greek, and Daniel 3:1 is Aramaic.
    let mark541 = d.verse(d.resolve("Mark 5:41")?.0)?;
    let talitha = d.lemma_index("G5008").ok_or("no root G5008 (talitha)")?;
    let dan31 = d.verse(d.resolve("Dan 3:1")?.0)?;

    Ok(vec![
        (has_verse("talitha-koum", "Mark 5:41")?, "aramaic: Mark 5:41 has Talitha koum".to_string()),
        (has_verse("eloi-eloi", "Mark 15:34")?, "aramaic: Mark 15:34 has Eloi, Eloi, lema sabachthani".to_string()),
        (has_verse("abba", "Mark 14:36")?, "aramaic: Mark 14:36 has Abba".to_string()),
        (line_at("Mark 5:41")? && !line_at("Mark 5:40")?, "aramaic: a line at Mark 5:41 and none at Mark 5:40".to_string()),
        (section_has("daniel", "Dan 3:1")? && !in_any_section("Dan 8:1")? && !in_any_section("Dan 2:3")?, "aramaic: Daniel 3:1 is in the Daniel section; Daniel 2:3 and 8:1 are in none".to_string()),
        (section_has("ezra-letters", "Ezra 4:8")? && !in_any_section("Ezra 4:7")? && !in_any_section("Ezra 7:11")?, "aramaic: Ezra 4:8 is in a section; Ezra 4:7 and 7:11 are not".to_string()),
        (section_has("jeremiah", "Jer 10:11")? && !in_any_section("Jer 10:10")?, "aramaic: Jeremiah 10:11 is a section; 10:10 is not".to_string()),
        (line_at("Gen 31:47")? && line_at("Dan 2:4")? && line_at("Dan 7:28")? && !line_at("Dan 3:1")?, "aramaic: lines where sections begin and end, not on every verse".to_string()),
        (dan31[1].as_array().is_some_and(|ws| !ws.is_empty() && ws.iter().all(|w| w[5].as_u64().unwrap_or(0) & u64::from(FLAG_ARAMAIC) != 0)), "aramaic: Daniel 3:1 is all Aramaic in the text".to_string()),
        (mark541[1].as_array().is_some_and(|ws| ws.iter().any(|w| w[3].as_u64() == Some(talitha as u64))), "aramaic: Mark 5:41's Greek has ταλιθα".to_string()),
        ((25..=80).contains(&entries.len()) && (4..=10).contains(&sections.len()) && (40..=400).contains(&verses.len()) && (8..=40).contains(&chapters.len()), format!("aramaic: {} entries, {} sections, {} verse lines, {} chapter lines", entries.len(), sections.len(), verses.len(), chapters.len())),
        (!all.is_empty() && all.iter().all(|&v| v < n) && chapters_ok, "aramaic: every verse and chapter in extras/aramaic.json is in the BSB".to_string()),
        (deep_ok, "aramaic: every entry has its Deep text".to_string()),
        (origin("G5008").as_deref() == Some("A") && origin("G0281").as_deref() == Some("GH") && origin("H3026A").as_deref() == Some("A") && origin("G3056").is_none(), "aramaic: the word study names ταλιθα Aramaic, ἀμήν Greek from Hebrew, Jegar Aramaic and λόγος Greek".to_string()),
        (h_roots == ["H3026A", "H3026B"], format!("aramaic: the only Hebrew roots relabelled Aramaic are Genesis 31:47's H3026A and H3026B, not {h_roots:?}")),
        (dan24_line.starts_with("From the middle of this verse"), format!("aramaic: Daniel 2:4's line says the switch is mid-verse: {dan24_line:?}")),
        (main_reading("bethesda") == Some(json!("Βηθζαθ\u{1f71}")) && main_reading("talitha-koum") == Some(Value::Null), "aramaic: Bethesda is marked as not TAGNT's main text (Βηθζαθά); Talitha koum is the main text".to_string()),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_verse_footnote() {
        let usfm = "\\c 31\n\\v 4 Jacob sent\n\\v 46 and he said\n\\v 47 Laban called it Jegar-sahadutha, and Jacob called it Galeed.\\f + \\fr 31:47 \\ft The Aramaic \\fqa Jegar-Sahadutha \\ft and the Hebrew \\fq Galeed \\ft both mean \\fqa heap of witnesses\\ft .\\f*\n\\v 48 Then Laban\n\\c 32\n\\v 47 x\\f + \\ft Other\\f*\n";
        let note = footnote_text(usfm, 31, 47);
        assert!(
            note.starts_with("The Aramaic Jegar-Sahadutha and the Hebrew Galeed"),
            "{note}"
        );
        assert!(!note.contains("Other"));
        assert_eq!(footnote_text(usfm, 31, 4), "");
        assert_eq!(footnote_text(usfm, 31, 46), "");
        assert_eq!(footnote_text(usfm, 30, 47), "");
    }
}
