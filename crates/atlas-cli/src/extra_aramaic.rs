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
use crate::parse::{Lang, Word};
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
    speaker: String,
    jesus: bool,
    kind: Kind,
    language: Language,
    greek: BTreeMap<String, String>,
    strongs: Vec<String>,
    aramaic: String,
    aramaic_note: String,
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

/// Whether `greek` is one of the verse's TAGNT words, or several in a row, as
/// TAGNT prints them (compared byte for byte). Words of other editions count,
/// and so do the other readings TAGNT prints for a word ("Βηθεσδά (t=Bēthesda)
/// … in: Tyn+SBL+Treg+TR+Byz"), since the BSB sometimes follows them
/// (Bethesda, John 5:2).
fn in_tagnt(greek: &str, ws: &[Word]) -> bool {
    let reading = format!("{greek} (");
    let in_readings = ws
        .iter()
        .filter_map(|w| w.note.as_ref()?.variants.as_deref())
        .any(|t| {
            t.match_indices(&reading)
                .any(|(i, _)| !t[..i].chars().next_back().is_some_and(char::is_alphabetic))
        });
    if in_readings {
        return true;
    }
    let main: Vec<&str> = ws
        .iter()
        .filter(|w| w.main)
        .map(|w| bare(&w.surface))
        .collect();
    let all: Vec<&str> = ws.iter().map(|w| bare(&w.surface)).collect();
    [main, all].iter().any(|run| {
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
    })
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

/// Checks a section that rests on the lexicon and the BSB footnote: one
/// verse, the word numbers it gives exist, startsMidVerse and endsMidVerse
/// agree with them, and TAHOT does not tag them Aramaic (if it did, the basis
/// would be "tahot").
fn check_words(s: &Section, from: u32, to: u32, words: &[Vec<Word>]) -> Result<(), String> {
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
    Ok(())
}

/// A section's first and last verse, checked against the data.
fn section_range(
    s: &Section,
    vz: &Versification,
    words: &[Vec<Word>],
) -> Result<(u32, u32), String> {
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
        Basis::LexiconAndFootnote => check_words(s, from, to, words)?,
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
        .filter_map(move |k| ws.get(k - 1)?.lemma.as_deref())
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
        } else {
            parts(vec![
                span(format!("Verses {}–{}", num(lo), num(hi))),
                json!(" of this chapter are in Aramaic, not Hebrew"),
            ])
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

/// Checks one entry against the BSB, TAGNT and the lemma table, and returns
/// its verses in the order of its refs.
fn check_entry(
    e: &Entry,
    vz: &Versification,
    text: &[String],
    words: &[Vec<Word>],
    lemma_index: &HashMap<&str, u32>,
    loans: &HashSet<&str>,
) -> Result<Vec<u32>, String> {
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
    fits(&field("speaker"), &e.speaker, 80)?;
    fits(&field("aramaic"), &e.aramaic, 60)?;
    if e.sources.is_empty() || e.refs.is_empty() || e.strongs.is_empty() {
        return Err(at("needs refs, strongs and sources"));
    }
    for s in &e.sources {
        fits(&field("source"), s, 400)?;
    }
    let refs: BTreeMap<&String, ()> = e.refs.iter().map(|r| (r, ())).collect();
    if refs.len() != e.refs.len()
        || !e.bsb.keys().eq(refs.keys().copied())
        || !e.greek.keys().eq(refs.keys().copied())
    {
        return Err(at(
            "must give bsb and greek for each of its refs, once each",
        ));
    }
    let mut verses = Vec::new();
    for r in &e.refs {
        let v = verse_of(r, vz)?;
        if vz
            .locate(v)
            .is_none_or(|(b, _, _)| BOOKS[b as usize].testament != Testament::New)
        {
            return Err(at(&format!("{r} is not in the New Testament")));
        }
        let english = &text[v as usize];
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
        let ws = &words[v as usize];
        if !in_tagnt(&e.greek[r], ws) {
            let printed: Vec<&str> = ws.iter().map(|w| w.surface.as_str()).collect();
            return Err(at(&format!(
                "greek {:?} is not among TAGNT's words at {r}: {}",
                e.greek[r],
                printed.join(" ")
            )));
        }
        for k in &e.strongs {
            if !ws.iter().any(|w| w.lemma.as_deref() == Some(k.as_str())) {
                return Err(at(&format!("{k} is on no word of {r}")));
            }
        }
        verses.push(v);
    }
    for k in &e.strongs {
        if !lemma_index.contains_key(k.as_str()) || !loans.contains(k.as_str()) {
            return Err(at(&format!(
                "{k} must be in the lemma table and in loanRoots"
            )));
        }
    }
    Ok(verses)
}

/// Reads and checks the config: every entry and section against the data,
/// every loan root against the lemma table, and that every Aramaic word TAHOT
/// tags lies in a section.
struct Checked {
    cfg: Config,
    /// Each entry's verses, in the order of its refs.
    entry_verses: Vec<Vec<u32>>,
    /// Each section's first and last verse.
    ranges: Vec<(u32, u32)>,
}

fn check(
    root: &Path,
    vz: &Versification,
    text: &[String],
    words: &[Vec<Word>],
    lemma_index: &HashMap<&str, u32>,
) -> Result<Checked, String> {
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
    let mut loans = HashSet::new();
    for l in &cfg.loan_roots {
        fits(&format!("loan root {} why", l.strongs), &l.why, MAX_DEEP)?;
        fits(&format!("loan root {} word", l.strongs), &l.word, 40)?;
        if !l.strongs.starts_with('G')
            || !lemma_index.contains_key(l.strongs.as_str())
            || !loans.insert(l.strongs.as_str())
        {
            return Err(format!(
                "{CONFIG}: loan root {} must be a Greek root in the lemma table, listed once",
                l.strongs
            ));
        }
    }
    let mut entry_verses = Vec::new();
    for e in &cfg.words {
        entry_verses.push(check_entry(e, vz, text, words, lemma_index, &loans)?);
    }
    let mut ranges = Vec::new();
    for s in &cfg.sections {
        fits(&format!("section {} line", s.id), &s.line, MAX_LINE)?;
        fits(&format!("section {} note", s.id), &s.note, MAX_NOTE)?;
        fits(&format!("section {} deep", s.id), &s.deep, MAX_DEEP)?;
        if s.sources.is_empty() {
            return Err(format!("{CONFIG}: section {} has no sources", s.id));
        }
        ranges.push(section_range(s, vz, words)?);
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
        entry_verses,
        ranges,
    })
}

/// The files to write under web/public/data, as (path, bytes).
pub fn build(
    root: &Path,
    vz: &Versification,
    text: &[String],
    words: &[Vec<Word>],
    lemma_index: &HashMap<&str, u32>,
) -> Result<Vec<(String, Vec<u8>)>, String> {
    let Checked {
        cfg,
        entry_verses,
        ranges,
    } = check(root, vz, text, words, lemma_index)?;

    // Lines under verses: the entries at each verse...
    let mut at: BTreeMap<u32, Vec<usize>> = BTreeMap::new();
    for (i, vs) in entry_verses.iter().enumerate() {
        for &v in vs {
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
            put(
                from,
                json!(["From here to ", { "verse": to }, ", the text is in Aramaic, not Hebrew"]),
            )?;
            put(
                to,
                json!(["The Aramaic that began at ", { "verse": from }, " ends with this verse"]),
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
        .zip(&entry_verses)
        .map(|(e, vs)| {
            Ok(json!({
                "id": e.id,
                "verses": vs,
                "word": e.word,
                "meaning": e.meaning,
                "meaningFrom": e.meaning_from,
                "speaker": e.speaker,
                "jesus": e.jesus,
                "kind": e.kind,
                "language": e.language,
                "certainty": e.certainty,
                "note": linked(&e.note, vz)?,
                "aramaic": e.aramaic,
                "bsb": e.refs.iter().map(|r| &e.bsb[r]).collect::<Vec<_>>(),
                "greek": e.refs.iter().map(|r| &e.greek[r]).collect::<Vec<_>>(),
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
pub fn origins(
    root: &Path,
    vz: &Versification,
    words: &[Vec<Word>],
    lemma_index: &HashMap<&str, u32>,
) -> Result<Value, String> {
    let cfg = read_config(root)?;
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
    for s in &cfg.sections {
        let from = verse_of(&s.from, vz)?;
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
    ])
}
