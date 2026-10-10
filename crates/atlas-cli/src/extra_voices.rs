//! What Christian writers said: notes on verses by Christian writers of the
//! past, in their own words. All three works are public domain:
//! - the Church Fathers on the Gospels, as Thomas Aquinas gathered them in the
//!   Catena Aurea, in the Oxford translation edited by John Henry Newman
//!   (1841–45), from the Catena corpus (`catena-aurea`);
//! - Matthew Henry's Concise Commentary (`henry-concise`) and
//! - John Wesley's Explanatory Notes (`wesley-notes`), both from the CrossWire
//!   SWORD modules as kept in the Let's Church repository (CC0 1.0).
//!
//! The app shows them only at Deep, and only once a reader chooses to see
//! them, always as these writers' words and never as the app's own claim.
//!
//! Where each note goes:
//! - Catena: each passage's verse keys (`matthew/5/3`). They use the
//!   Douay-Rheims numbering, which starts every passage on the same verse as
//!   the English numbering (checked against the KJV wording each passage
//!   quotes). A passage ends at its last key, except the four that end
//!   Matthew 17, Mark 4, Mark 9 and John 11, which the Douay-Rheims numbers one
//!   verse shorter: those run to the end of the chapter. Aquinas comments on
//!   every verse, so a passage also takes the verses its keys leave before the
//!   next passage in the chapter (Matthew 5:15-16, Luke 2:26-27). The Gospel's
//!   own words, where the copy prints them inside a Father's quotation
//!   ("25. And, behold, there was a man"), are left out, and so are the
//!   footnote marks its copy keeps on words ([`unmark`]).
//! - Henry: his own headings ("Verses 1-9", "Verse 7 ,8", "Verses 24-30, 36-43"),
//!   at the start of a line or of a paragraph. Text before the first heading
//!   (a book's introduction, a chapter's outline) is left out. A chapter he
//!   treats as a whole, with no heading, covers the whole chapter. A few
//!   headings name fewer verses than the note covers ([`HENRY_ENDS`]).
//! - Wesley: the verse the module gives each note. Notes on a "verse 0" (most
//!   belong to the last verse of the book before) are left out, and so is a
//!   note the module repeats on the next verse it has (Psalm 22:31's on
//!   Psalm 23:1). Where the module puts a note on the first of several verses
//!   with no note of their own, and the words it explains ("Lord, I believe -")
//!   are in a later one of them in the KJV and not in the first, it goes on
//!   that later verse.
//!
//! The files' `verseEnd` is otherwise not used: the extractor guesses it from
//! where the next note starts.
//!
//! References the modules mark (`{{ref:Isa.1.1-Isa.1.9|Is. 1:1-9}}`,
//! `{{ref:Mt 23:37|Mt 23:37}}`) become links when they name verses the BSB has.
//! A bare number ("1Co 10:1, 2") is a link only when its verse is in the
//! chapter the reference before it names, as the modules' own targets for
//! these are sometimes wrong. Anything else stays as text.
//!
//! Output, under `web/public/data/`:
//! - `extras/voices.json`: `{format, has, parts}`. `has` holds one character
//!   per verse, '0' plus a bit for each work with a note on it (1 the Fathers,
//!   2 Henry, 4 Wesley). `parts[book]` lists the first chapter of each of the
//!   book's files. Small: it loads with the reader's first move.
//! - `extras/voices/<Book>.<k>.json`: `{format, items}`, the notes on the
//!   chapters of part k, each `[work, from, to, voices]`: work 0 the Fathers,
//!   1 Henry, 2 Wesley; `voices` a list of `[who, text]`, who being the
//!   Father's name in the Catena and "" otherwise; text a string, or a list of
//!   strings and `[from, to, text]` verse links, its paragraphs split by a
//!   blank line. Items are in order of first verse, then work, and never cross
//!   a chapter. They load when the panel opens.
//! - `extras/voices/hebrew.json`: `{format, runs}`, where an Old Testament
//!   verse has another number in the Hebrew Bible (from TAHOT), as runs
//!   `[first verse, count, Hebrew chapter, Hebrew verse]` of verses numbered
//!   on from there. The panel's link to Sefaria, which numbers the Hebrew
//!   way, uses it: English Joel 2:28 is Joel 3:1 there. Sefaria counts the
//!   Ten Commandments' last verses, 1 Kings 18:33 and Nehemiah 7:68-73 its own
//!   way ([`SEFARIA_NUMBERS`]).

use crate::loaded::Loaded;
use crate::sources::Inputs;
use atlas_core::canon::BOOKS;
use atlas_core::Versification;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;

const CATENA: &str = "catena-aurea";
const HENRY: &str = "henry-concise";
const WESLEY: &str = "wesley-notes";
const OUT: &str = "extras/voices.json";
const DIR: &str = "extras/voices";
const HEBREW: &str = "extras/voices/hebrew.json";
/// A book's notes are split into files of about this many bytes, between chapters.
const PART_BYTES: usize = 500_000;

/// The works, oldest first, as numbered in the output.
const FATHERS_W: u8 = 0;
const HENRY_W: u8 = 1;
const WESLEY_W: u8 = 2;

/// The book codes the SWORD extracts use (USFM), in canon order.
const USFM: [&str; 66] = [
    "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH",
    "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK",
    "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
    "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH",
    "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD",
    "REV",
];

/// The Catena's files and their books.
const GOSPELS: [(&str, u8); 4] = [("matthew", 39), ("mark", 40), ("luke", 41), ("john", 42)];

/// Chapters whose last verse the Catena's keys leave out, as (book, chapter).
const SHORT_CHAPTERS: [(u8, u16); 4] = [(39, 17), (40, 4), (40, 9), (42, 11)];

/// Book abbreviations in the modules' references that the app's own reference
/// reader does not take, lowercase. "Jud" (Judges or Jude) is left as text.
const ABBREVIATIONS: [(&str, u8); 13] = [
    ("es", 16),
    ("ps", 18),
    ("pr", 19),
    ("ec", 20),
    ("so", 21),
    ("ho", 27),
    ("ob", 30),
    ("na", 33),
    ("mr", 40),
    ("lu", 41),
    ("ga", 47),
    ("phil", 49),
    ("re", 65),
];

/// Names in the Catena written another way.
const NAME_FIXES: [(&str, &str); 1] = [("Clement of Alexendria", "Clement of Alexandria")];

/// Henry's headings that name fewer verses than his note covers, as (book,
/// chapter, the heading's first verse, the note's last verse). Each was read
/// against the note and his outline of the chapter: "Verses 10-12" in
/// Deuteronomy 20 goes on to the fruit trees of verses 19-20; four Proverbs
/// notes end with the next verse's note ("10. Let kings and judges ..."); and
/// "Verses 1-8" in John 3 runs on through "God so loved the world" to 3:21.
const HENRY_ENDS: [(u8, u16, u16, u16); 6] = [
    (4, 20, 10, 20),
    (19, 14, 12, 13),
    (19, 16, 9, 10),
    (19, 16, 19, 20),
    (19, 22, 28, 29),
    (42, 3, 1, 21),
];

/// One piece of a note's text.
#[derive(Clone, Debug, PartialEq)]
enum Run {
    Text(String),
    Verse(u32, u32, String),
}

struct Item {
    work: u8,
    from: u32,
    to: u32,
    voices: Vec<(String, Vec<Run>)>,
}

/// What the build placed and dropped, for its report.
#[derive(Default)]
struct Report {
    refs: usize,
    linked: usize,
    intros: usize,
    verse_zero: usize,
    unplaced: usize,
    clamped: usize,
    /// Catena: verses before the next passage given to a passage, Gospel
    /// paragraphs left out, footnote marks taken off words.
    filled: usize,
    lemmas: usize,
    marks: usize,
    /// Wesley: notes the module repeats, and notes moved to the verse they quote.
    repeats: usize,
    moved: usize,
}

fn read_json(path: &std::path::Path) -> Result<Value, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))
}

fn book_named(token: &str) -> Option<u8> {
    let key: String = token
        .chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect();
    if key == "jud" {
        return None;
    }
    ABBREVIATIONS
        .iter()
        .find(|(a, _)| *a == key)
        .map(|&(_, b)| b)
        .or_else(|| atlas_core::refs::parse_book(token))
}

/// Reads a number at `b[*i..]`.
fn number(b: &[u8], i: &mut usize) -> Option<u16> {
    let start = *i;
    while *i < b.len() && b[*i].is_ascii_digit() && *i - start < 4 {
        *i += 1;
    }
    if *i == start {
        return None;
    }
    std::str::from_utf8(&b[start..*i]).ok()?.parse().ok()
}

/// A book name at `b[*i..]` ("1John", "1 Cor", "Mt"), as its text.
fn book_token<'a>(s: &'a str, i: &mut usize) -> &'a str {
    let b = s.as_bytes();
    let start = *i;
    let mut j = *i;
    if j < b.len() && matches!(b[j], b'1'..=b'3') {
        j += 1;
        if b.get(j) == Some(&b' ') {
            j += 1;
        }
        if !b.get(j).is_some_and(u8::is_ascii_alphabetic) {
            return "";
        }
    }
    let letters = j;
    while j < b.len() && b[j].is_ascii_alphabetic() {
        j += 1;
    }
    if j == letters {
        return "";
    }
    *i = j;
    &s[start..j]
}

fn dash(s: &str, i: usize) -> Option<usize> {
    let rest = &s[i..];
    if rest.starts_with('-') {
        Some(1)
    } else if rest.starts_with('–') {
        Some('–'.len_utf8())
    } else {
        None
    }
}

/// The verses a reference at the start of `s` names, and how many bytes it
/// takes: an OSIS id ("Isa.1.1", "Isa.1.1-Isa.1.9", "1John.5.20"), a written
/// one ("Mt 23:37", "1Cor 13:4-7", "Ps 23"), or a chapter and verse in the
/// book at hand ("3:16"). A bare number is not read: it may be a verse or a
/// chapter.
fn reference(s: &str, here: u8, vz: &Versification) -> Option<(u32, u32, usize)> {
    let b = s.as_bytes();
    let mut i = 0;
    let token = book_token(s, &mut i);
    let osis = !token.is_empty()
        && b.get(i) == Some(&b'.')
        && b.get(i + 1).is_some_and(u8::is_ascii_digit);
    let (book, c, v, mut end_c, mut end_v);
    if osis {
        book = book_named(token)?;
        i += 1;
        c = number(b, &mut i)?;
        if b.get(i) != Some(&b'.') {
            return None;
        }
        i += 1;
        v = number(b, &mut i)?;
        (end_c, end_v) = (c, v);
        if b.get(i) == Some(&b'-') {
            let mut j = i + 1;
            let second = book_token(s, &mut j);
            let same = second.is_empty() || book_named(second) == Some(book);
            if !second.is_empty() && b.get(j) == Some(&b'.') {
                j += 1;
            }
            if let (true, Some(c2)) = (same, number(b, &mut j)) {
                if b.get(j) == Some(&b'.') {
                    j += 1;
                    if let Some(v2) = number(b, &mut j) {
                        (end_c, end_v, i) = (c2, v2, j);
                    }
                }
            }
        }
    } else {
        if token.is_empty() {
            book = here;
        } else {
            book = book_named(token)?;
            if b.get(i) == Some(&b'.') {
                i += 1;
            }
            while b.get(i) == Some(&b' ') {
                i += 1;
            }
        }
        c = number(b, &mut i)?;
        if b.get(i) == Some(&b':') && b.get(i + 1).is_some_and(u8::is_ascii_digit) {
            i += 1;
            v = number(b, &mut i)?;
        } else if token.is_empty() {
            return None;
        } else {
            v = 0;
        }
        (end_c, end_v) = (c, v);
        if let Some(n) = dash(s, i) {
            let mut j = i + n;
            if let Some(x) = number(b, &mut j) {
                if v > 0 && b.get(j) == Some(&b':') && b.get(j + 1).is_some_and(u8::is_ascii_digit)
                {
                    j += 1;
                    if let Some(y) = number(b, &mut j) {
                        (end_c, end_v, i) = (x, y, j);
                    }
                } else if v > 0 {
                    (end_v, i) = (x, j);
                } else {
                    (end_c, i) = (x, j);
                }
            }
        }
    }
    let from = vz.index(book, c, v.max(1))?;
    let to = if end_v == 0 {
        vz.index(book, end_c, vz.verses_in(book, end_c)?)?
    } else {
        vz.index(book, end_c, end_v)?
    };
    (to >= from).then_some((from, to, i))
}

/// A label that is only numbers ("2", "13-21"): the verse or chapter of a
/// reference before it.
fn bare(label: &str) -> bool {
    label.bytes().any(|c| c.is_ascii_digit())
        && label
            .bytes()
            .all(|c| c.is_ascii_digit() || matches!(c, b'-' | b',' | b' '))
}

/// Text with the modules' `{{ref:target|label}}` marks: the label of each
/// reference becomes a link when the reference names verses the BSB has.
fn runs(text: &str, here: u8, vz: &Versification, report: &mut Report) -> Vec<Run> {
    let mut out: Vec<Run> = Vec::new();
    let mut plain = String::new();
    // The book and chapter of the last link, for a bare number after it.
    let mut last: Option<(u8, u16)> = None;
    let mut rest = text;
    while let Some(i) = rest.find("{{") {
        let open = i + rest[i..].bytes().take_while(|&c| c == b'{').count();
        let Some(close) = rest[open..].find("}}").map(|e| open + e) else {
            break;
        };
        plain.push_str(&rest[..i]);
        let inner = &rest[open..close];
        let after = close + rest[close..].bytes().take_while(|&c| c == b'}').count();
        rest = &rest[after..];
        let Some(body) = inner.strip_prefix("ref:") else {
            plain.push_str(inner);
            continue;
        };
        let (target, label) = body.split_once('|').unwrap_or((body, body));
        report.refs += 1;
        // The label is shown. Where it is the reference itself, only the
        // reference part is a link ("Mt 23:37 as the eagle ..." links "Mt 23:37").
        let (found, linked_len) = if target == label {
            match reference(label, here, vz) {
                Some((f, t, n)) => (Some((f, t)), n),
                None => (None, 0),
            }
        } else {
            match reference(target, here, vz) {
                Some((f, t, n)) if n == target.len() => (Some((f, t)), label.len()),
                _ => (None, 0),
            }
        };
        let chapter = |f: u32| vz.locate(f).map(|(b, c, _)| (b, c));
        let found = found.filter(|&(f, _)| !bare(label) || (last.is_some() && chapter(f) == last));
        match found {
            Some((f, t)) if linked_len > 0 => {
                last = chapter(f);
                report.linked += 1;
                if !plain.is_empty() {
                    out.push(Run::Text(std::mem::take(&mut plain)));
                }
                out.push(Run::Verse(f, t, label[..linked_len].trim_end().to_string()));
                plain.push_str(&label[label[..linked_len].trim_end().len()..]);
            }
            _ => plain.push_str(label),
        }
    }
    plain.push_str(rest);
    if !plain.is_empty() {
        out.push(Run::Text(plain));
    }
    out
}

/// Lines into paragraphs: each run of non-blank lines becomes one paragraph,
/// and paragraphs are split by one blank line.
fn paragraphs(text: &str) -> String {
    let mut out = String::new();
    let mut para = String::new();
    for line in text.lines().map(str::trim) {
        if line.is_empty() {
            if !para.is_empty() {
                if !out.is_empty() {
                    out.push_str("\n\n");
                }
                out.push_str(&std::mem::take(&mut para));
            }
        } else {
            if !para.is_empty() {
                para.push(' ');
            }
            para.push_str(line);
        }
    }
    if !para.is_empty() {
        if !out.is_empty() {
            out.push_str("\n\n");
        }
        out.push_str(&para);
    }
    out
}

/// Henry's heading at the start of a line ("Verses 1-9", "Verse 7 ,8",
/// "Verses 1-3 Much is to be learned..."): the verses, and the rest of the line.
fn heading(line: &str) -> Option<(u16, u16, &str)> {
    let rest = line
        .strip_prefix("Verses ")
        .or_else(|| line.strip_prefix("Verse "))?;
    let b = rest.as_bytes();
    let mut i = 0;
    let a = number(b, &mut i)?;
    let mut j = i;
    while b.get(j) == Some(&b' ') {
        j += 1;
    }
    let mut end = a;
    if let Some(n) = dash(rest, j).or_else(|| (b.get(j) == Some(&b',')).then_some(1)) {
        let mut k = j + n;
        while b.get(k) == Some(&b' ') {
            k += 1;
        }
        if let Some(z) = number(b, &mut k) {
            (end, i) = (z, k);
        }
    }
    let tail = &rest[i..];
    if !tail.is_empty() && !tail.starts_with(char::is_whitespace) {
        return None;
    }
    Some((a, end, tail.trim_start()))
}

/// The sections of one Henry entry, as (first verse, last verse, text), or
/// None for the whole chapter, with its text. Text before the first heading is
/// left out. An entry with no heading is a chapter treated as a whole: its
/// comment follows a "--", or the chapter's number and title.
fn henry_sections(body: &str) -> Result<Vec<(u16, u16, String)>, Option<String>> {
    let mut sections: Vec<(u16, u16, Vec<&str>)> = Vec::new();
    for line in body.lines() {
        match heading(line.trim()) {
            Some((a, z, tail)) => sections.push((a, z, vec![tail])),
            None => {
                if let Some(s) = sections.last_mut() {
                    s.2.push(line);
                }
            }
        }
    }
    if !sections.is_empty() {
        let mut out = Vec::new();
        for (a, z, lines) in sections {
            let joined = paragraphs(&lines.join("\n"));
            let mut text = joined.as_str();
            // A heading split over two lines: "Verses 24-30", then ", 36-43 This parable".
            let mut more = None;
            if let Some(rest) = text.strip_prefix(',').map(str::trim_start) {
                if let Some((x, y, tail)) = heading(&format!("Verses {rest}")) {
                    more = Some((x, y));
                    text = &rest[rest.len() - tail.len()..];
                }
            }
            let text = text
                .trim_start_matches(['-', '.', ',', ';', ':'])
                .trim_start();
            out.push((a, z, text.to_string()));
            if let Some((x, y)) = more {
                out.push((x, y, text.to_string()));
            }
        }
        return Ok(out);
    }
    // A chapter as a whole.
    if let Some(i) = body
        .find("\n--")
        .map(|i| i + 1)
        .or_else(|| body.starts_with("--").then_some(0))
    {
        return Err(Some(paragraphs(&body[i + 2..])));
    }
    if body.starts_with("Chapter ") {
        let paras: Vec<&str> = body.split("\n\n").collect();
        if paras.len() > 2 {
            return Err(Some(paragraphs(&paras[2..].join("\n\n"))));
        }
        // The chapter's number, then his note on it (Ezekiel 41-48).
        if paras.len() == 2 && paras[1].trim().len() >= 40 {
            return Err(Some(paragraphs(paras[1])));
        }
    }
    Err(None)
}

/// Henry's verse numbers as the module marks them, "ver. #(11-13)", as plain
/// "ver. 11-13".
fn verse_marks(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(i) = rest.find("#(") {
        let Some(close) = rest[i..].find(')').map(|e| i + e) else {
            break;
        };
        out.push_str(&rest[..i]);
        out.push_str(&rest[i + 2..close]);
        rest = &rest[close + 1..];
    }
    out.push_str(rest);
    out
}

fn text_json(runs: &[Run]) -> Value {
    if let [Run::Text(t)] = runs {
        return json!(t);
    }
    Value::Array(
        runs.iter()
            .map(|r| match r {
                Run::Text(t) => json!(t),
                Run::Verse(a, b, t) => json!([a, b, t]),
            })
            .collect(),
    )
}

fn item_json(item: &Item) -> Value {
    json!([
        item.work,
        item.from,
        item.to,
        item.voices
            .iter()
            .map(|(who, runs)| json!([who, text_json(runs)]))
            .collect::<Vec<_>>()
    ])
}

/// The words of a text, as they are written (letters only).
fn words(text: &str) -> impl Iterator<Item = &str> {
    text.split(|c: char| !c.is_ascii_alphabetic())
        .filter(|w| !w.is_empty())
}

/// What tells the Catena copy's footnote marks from words: the words of the
/// KJV, and how often each word is in the whole Catena (lowercase).
struct Vocabulary {
    kjv: HashSet<String>,
    catena: HashMap<String, usize>,
}

impl Vocabulary {
    fn count(&self, w: &str) -> usize {
        self.catena
            .get(&w.to_ascii_lowercase())
            .copied()
            .unwrap_or(0)
    }

    /// Whether a word ends in a footnote letter ("Hebrewa", "Christb"): the
    /// word is in neither the KJV nor anywhere else in the Catena, it ends in
    /// a letter from a to h (not "e", and not a past tense in "-ed"), and
    /// without that letter it is a word the Catena uses 20 times or more (one
    /// of three letters only if the KJV has it too, as "the" or "God").
    fn marked(&self, w: &str) -> bool {
        let lower = w.to_ascii_lowercase();
        let Some(last) = lower.chars().last() else {
            return false;
        };
        let stem = &lower[..lower.len() - 1];
        ('a'..='h').contains(&last)
            && last != 'e'
            && !lower.ends_with("ed")
            && stem.len() >= 3
            && !self.kjv.contains(&lower)
            && self.count(&lower) <= 1
            && self.count(stem) >= 20
            && (stem.len() > 3 || self.kjv.contains(stem))
    }
}

/// A Father's words without the footnote marks the copy keeps on words: a
/// digit or two after a word ("there1") or a letter ([`Vocabulary::marked`]).
/// A word in brackets or parentheses, where the edition cites its sources
/// ("(Hom. in Acta.)"), and one before a full stop that may abbreviate a name
/// ("Conf."), keep their letters.
fn unmark(text: &str, vocab: &Vocabulary, report: &mut Report) -> String {
    let b = text.as_bytes();
    let mut out = String::with_capacity(text.len());
    let (mut depth, mut i, mut copied) = (0i32, 0usize, 0usize);
    while i < b.len() {
        match b[i] {
            b'(' | b'[' => depth += 1,
            b')' | b']' => depth = (depth - 1).max(0),
            _ => {}
        }
        let starts = b[i].is_ascii_alphabetic() && (i == 0 || !b[i - 1].is_ascii_alphanumeric());
        if !starts {
            i += 1;
            continue;
        }
        let mut j = i;
        while j < b.len() && b[j].is_ascii_alphabetic() {
            j += 1;
        }
        let mut k = j;
        while k < b.len() && k - j < 3 && b[k].is_ascii_digit() {
            k += 1;
        }
        let ends = k == b.len() || !b[k].is_ascii_alphanumeric();
        let word = &text[i..j];
        let cut = if k > j && k - j <= 2 && ends && word.len() >= 2 {
            Some(j)
        } else if k == j
            && ends
            && depth == 0
            && !(b.get(j) == Some(&b'.') && word.len() <= 5)
            && vocab.marked(word)
        {
            Some(j - 1)
        } else {
            None
        };
        if let Some(cut) = cut {
            out.push_str(&text[copied..cut]);
            copied = k;
            report.marks += 1;
        }
        i = k.max(i + 1);
    }
    out.push_str(&text[copied..]);
    out
}

/// A paragraph the Catena copy prints inside a Father's quotation that is the
/// Gospel's own words, numbered by its verse ("25. And, behold, there was a
/// man"), for a passage on verses `first` to `last`.
fn gospel_line(p: &str, first: u16, last: u16) -> bool {
    let digits = p.bytes().take_while(u8::is_ascii_digit).count();
    (1..=3).contains(&digits)
        && p[digits..].starts_with('.')
        && p[..digits]
            .parse::<u16>()
            .is_ok_and(|n| n >= first && n <= last + 3)
}

fn catena(
    inputs: &Inputs,
    vz: &Versification,
    kjv: &[String],
    items: &mut [Vec<Item>],
    report: &mut Report,
) -> Result<(), String> {
    // Every passage first: footnote marks are told from words by the whole Catena's words.
    let mut records: Vec<(u8, Value)> = Vec::new();
    for (key, book) in GOSPELS {
        let path = inputs.path(CATENA, key);
        let text =
            fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
        for (n, line) in text
            .lines()
            .enumerate()
            .filter(|(_, l)| !l.trim().is_empty())
        {
            let r: Value = serde_json::from_str(line)
                .map_err(|e| format!("{CATENA}: {key} line {}: {e}", n + 1))?;
            let license = r["source"]["license"].as_str().unwrap_or("");
            if license != "public-domain" {
                return Err(format!("{CATENA}: {key} line {} is no longer marked public domain; check the source before using it", n + 1));
            }
            records.push((book, r));
        }
    }
    let mut vocab = Vocabulary {
        kjv: kjv
            .iter()
            .flat_map(|l| words(l))
            .map(str::to_ascii_lowercase)
            .collect(),
        catena: HashMap::new(),
    };
    for (_, r) in &records {
        for s in r["segments"].as_array().into_iter().flatten() {
            for w in words(s["text"].as_str().unwrap_or("")) {
                *vocab.catena.entry(w.to_ascii_lowercase()).or_default() += 1;
            }
        }
    }

    let mut passages: Vec<Item> = Vec::new();
    for (book, r) in &records {
        let book = *book;
        let keys: Vec<(u16, u16)> = r["commented_verse_keys"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|k| {
                let mut p = k.as_str()?.split('/').skip(1);
                Some((p.next()?.parse().ok()?, p.next()?.parse().ok()?))
            })
            .collect();
        let (Some(&(c, v)), Some(&(c2, mut v2))) = (keys.first(), keys.last()) else {
            report.unplaced += 1;
            continue;
        };
        if c != c2 {
            return Err(format!(
                "{CATENA}: {} covers more than one chapter",
                r["id"]
            ));
        }
        let last = vz.verses_in(book, c).unwrap_or(0);
        if SHORT_CHAPTERS.contains(&(book, c)) && v2 + 1 == last {
            v2 = last;
        }
        let (Some(from), Some(to)) = (vz.index(book, c, v), vz.index(book, c, v2.min(last))) else {
            report.unplaced += 1;
            continue;
        };
        let mut voices = Vec::new();
        for s in r["segments"].as_array().into_iter().flatten() {
            let who = s["father"].as_str().unwrap_or("").trim();
            let who = NAME_FIXES
                .iter()
                .find(|(x, _)| *x == who)
                .map_or(who, |&(_, y)| y);
            let said = paragraphs(&unmark(s["text"].as_str().unwrap_or(""), &vocab, report));
            let kept: Vec<&str> = said
                .split("\n\n")
                .filter(|p| {
                    let gospel = gospel_line(p, v, v2);
                    report.lemmas += usize::from(gospel);
                    !gospel && !p.is_empty()
                })
                .collect();
            let said = kept.join("\n\n");
            let said = said.trim_start_matches([',', '.', ';', ':']).trim_start();
            if !who.is_empty() && !said.is_empty() {
                voices.push((who.to_string(), vec![Run::Text(said.to_string())]));
            }
        }
        if voices.is_empty() || to < from {
            report.unplaced += 1;
            continue;
        }
        passages.push(Item {
            work: FATHERS_W,
            from,
            to,
            voices,
        });
    }
    // Aquinas comments on every verse: a passage runs on to the next one in its chapter.
    passages.sort_by_key(|x| x.from);
    let chapter = |i: u32| vz.locate(i).map(|(b, c, _)| (b, c));
    for k in 1..passages.len() {
        let next = passages[k].from;
        let item = &mut passages[k - 1];
        if next > item.to + 1 && chapter(next) == chapter(item.to) {
            report.filled += (next - item.to - 1) as usize;
            item.to = next - 1;
        }
    }
    for item in passages {
        let (b, _, _) = vz.locate(item.from).ok_or("a passage outside the Bible")?;
        items[b as usize].push(item);
    }
    Ok(())
}

/// The entries of a Let's Church commentary file, after checking its license.
fn entries(inputs: &Inputs, source: &str, key: &str) -> Result<Vec<Value>, String> {
    let doc = read_json(&inputs.path(source, key))?;
    if doc["work"]["license"].as_str() != Some("Public Domain") {
        return Err(format!(
            "{source}: {key} is no longer marked public domain; check the source before using it"
        ));
    }
    doc["entries"]
        .as_array()
        .cloned()
        .ok_or_else(|| format!("{source}: {key} has no entries"))
}

/// Book, chapter and verse of an entry, with the book as its index.
fn place(e: &Value) -> Option<(u8, u16, u16)> {
    let code = e["book"].as_str()?;
    let b = USFM.iter().position(|&u| u == code)? as u8;
    Some((
        b,
        e["chapter"].as_u64()? as u16,
        e["verse"].as_u64()? as u16,
    ))
}

fn henry(
    inputs: &Inputs,
    vz: &Versification,
    items: &mut [Vec<Item>],
    report: &mut Report,
) -> Result<(), String> {
    for e in entries(inputs, HENRY, "mhcc")? {
        let Some((b, c, v)) = place(&e) else {
            report.unplaced += 1;
            continue;
        };
        let body = e["body"].as_str().unwrap_or("");
        let Some(last) = vz.verses_in(b, c) else {
            report.unplaced += 1;
            continue;
        };
        let sections = match henry_sections(body) {
            Ok(s) => s,
            Err(Some(text)) if v > 0 || body.starts_with("Chapter ") => vec![(1, last, text)],
            Err(_) => {
                report.intros += 1;
                continue;
            }
        };
        for (a, z, text) in sections {
            if text.is_empty() {
                continue;
            }
            if a == 0 || a > last {
                report.unplaced += 1;
                continue;
            }
            let z = HENRY_ENDS
                .iter()
                .find(|&&(hb, hc, ha, _)| (hb, hc, ha) == (b, c, a))
                .map_or(z, |&(.., end)| end);
            if z > last || z < a {
                report.clamped += 1;
            }
            let z = z.clamp(a, last);
            let (Some(from), Some(to)) = (vz.index(b, c, a), vz.index(b, c, z)) else {
                report.unplaced += 1;
                continue;
            };
            let voices = vec![(String::new(), runs(&verse_marks(&text), b, vz, report))];
            items[b as usize].push(Item {
                work: HENRY_W,
                from,
                to,
                voices,
            });
        }
    }
    Ok(())
}

/// Lowercase words with one space between, and one at each end, so that
/// " lord i believe " is found in a verse only as whole words.
fn word_form(text: &str) -> String {
    let mut out = String::from(" ");
    for w in text
        .split(|c: char| !c.is_ascii_alphabetic())
        .filter(|w| !w.is_empty())
    {
        out.push_str(&w.to_ascii_lowercase());
        out.push(' ');
    }
    out
}

/// The words a Wesley note explains, as `word_form`: the text before its
/// first " - " ("Lord, I believe - What an excellent spirit"), or None.
fn lemma(body: &str) -> Option<String> {
    let (head, _) = body.split_once(" - ")?;
    let head = head.split("...").next()?.split("&c").next()?;
    let w = word_form(head);
    (head.len() <= 80 && w.len() >= 6).then_some(w)
}

fn wesley(
    inputs: &Inputs,
    vz: &Versification,
    kjv: &[String],
    items: &mut [Vec<Item>],
    report: &mut Report,
) -> Result<(), String> {
    let mut previous = String::new();
    for e in entries(inputs, WESLEY, "wesley")? {
        let body = e["body"].as_str().unwrap_or("");
        if body == previous {
            report.repeats += 1;
            continue;
        }
        previous = body.to_string();
        let Some((b, c, v)) = place(&e) else {
            report.unplaced += 1;
            continue;
        };
        if v == 0 {
            report.verse_zero += 1;
            continue;
        }
        let Some(mut at) = vz.index(b, c, v) else {
            report.unplaced += 1;
            continue;
        };
        // A note on the first of several verses that quotes a later one.
        let end = e["verseEnd"].as_u64().unwrap_or(0) as u16;
        let quoted = lemma(body).filter(|_| end > v);
        let form = |i: u32| word_form(kjv.get(i as usize).map_or("", String::as_str));
        if let Some(l) = quoted.filter(|l| !form(at).contains(l.as_str())) {
            if let Some(i) = (v + 1..=end.min(vz.verses_in(b, c).unwrap_or(0)))
                .filter_map(|x| vz.index(b, c, x))
                .find(|&i| form(i).contains(l.as_str()))
            {
                at = i;
                report.moved += 1;
            }
        }
        let text = paragraphs(body.trim_start_matches([',', '.', ';', ':']).trim_start());
        if text.is_empty() {
            continue;
        }
        let voices = vec![(String::new(), runs(&text, b, vz, report))];
        items[b as usize].push(Item {
            work: WESLEY_W,
            from: at,
            to: at,
            voices,
        });
    }
    Ok(())
}

/// Where Sefaria's numbers differ from what TAHOT's words give, as (book,
/// English chapter, first and last English verse, Sefaria chapter, first
/// Sefaria verse, all in that one verse), checked on Sefaria: it counts the
/// Ten Commandments and Nehemiah 7:68-73 its own way (English Exodus 20:13-16
/// are its Exodus 20:13), and TAHOT's English splits 1 Kings 18:33-34 as the
/// KJV does, not as the BSB the app shows.
const SEFARIA_NUMBERS: [(u8, u16, u16, u16, u16, u16, bool); 7] = [
    (1, 20, 13, 16, 20, 13, true),
    (1, 20, 17, 26, 20, 14, false),
    (4, 5, 17, 20, 5, 17, true),
    (4, 5, 21, 33, 5, 18, false),
    (15, 7, 68, 69, 7, 68, true),
    (15, 7, 70, 73, 7, 69, false),
    (10, 18, 33, 33, 18, 33, true),
];

/// A verse's chapter and verse in the Hebrew Bible.
type Hebrew = (u16, u16);

/// Where Old Testament verses have another number in the Hebrew Bible, as
/// runs `[first verse, count, Hebrew chapter, Hebrew verse]`. TAHOT gives
/// both numbers for every word; a verse takes the Hebrew verse most of its
/// words are in (the first, on a tie). A title the English counts as no verse
/// (`Psa.51.0`) is left out. Then Sefaria's own few differences
/// ([`SEFARIA_NUMBERS`]).
fn hebrew_runs(inputs: &Inputs, vz: &Versification) -> Result<Vec<[u32; 4]>, String> {
    // Each English verse's Hebrew verses, in order, with how many words each.
    let mut words: BTreeMap<u32, Vec<(Hebrew, usize)>> = BTreeMap::new();
    for p in inputs.paths("tahot") {
        let text = fs::read_to_string(&p).map_err(|e| format!("reading {}: {e}", p.display()))?;
        for line in text.trim_start_matches('\u{feff}').lines() {
            let first = line.split('\t').next().unwrap_or("");
            if !first.contains('#') || !first.chars().next().is_some_and(char::is_alphanumeric) {
                continue;
            }
            let Some((b, c, v, hc, hv)) = crate::world::tahot_ref(first) else {
                continue;
            };
            if v == 0 || b > 38 {
                continue;
            }
            if let Some(i) = vz.index(b, c, v) {
                let list = words.entry(i).or_default();
                match list.iter_mut().find(|(h, _)| *h == (hc, hv)) {
                    Some((_, n)) => *n += 1,
                    None => list.push(((hc, hv), 1)),
                }
            }
        }
    }
    let mut at: BTreeMap<u32, Hebrew> = BTreeMap::new();
    for (&i, list) in &words {
        // The first of the Hebrew verses with the most words.
        let most = list.iter().map(|(_, n)| *n).max().unwrap_or(0);
        if let Some(&(h, _)) = list.iter().find(|(_, n)| *n == most) {
            at.insert(i, h);
        }
    }
    for &(b, c, from, to, hc, hv, one) in &SEFARIA_NUMBERS {
        for (k, v) in (from..=to).enumerate() {
            if let Some(i) = vz.index(b, c, v) {
                at.insert(i, (hc, if one { hv } else { hv + k as u16 }));
            }
        }
    }
    let mut runs: Vec<[u32; 4]> = Vec::new();
    for (&i, &(hc, hv)) in &at {
        let (_, c, v) = vz.locate(i).ok_or("a TAHOT verse outside the Bible")?;
        if (hc, hv) == (c, v) {
            continue;
        }
        match runs.last_mut() {
            Some(r)
                if r[0] + r[1] == i && r[2] == u32::from(hc) && r[3] + r[1] == u32::from(hv) =>
            {
                r[1] += 1
            }
            _ => runs.push([i, 1, u32::from(hc), u32::from(hv)]),
        }
    }
    Ok(runs)
}

/// The files to write under web/public/data, as (path, bytes).
pub fn build(inputs: &Inputs, vz: &Versification) -> Result<Vec<(String, Vec<u8>)>, String> {
    let mut report = Report::default();
    // The KJV, one line per verse: the words Wesley's notes quote, and the
    // words that tell the Catena's footnote marks from words.
    let path = inputs.path("kjv", "kjv");
    let json = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let kjv: Vec<String> = crate::extra_translations::lines(&json, vz, "KJV")?
        .lines()
        .map(str::to_string)
        .collect();
    let mut books: Vec<Vec<Item>> = (0..BOOKS.len()).map(|_| Vec::new()).collect();
    catena(inputs, vz, &kjv, &mut books, &mut report)?;
    henry(inputs, vz, &mut books, &mut report)?;
    wesley(inputs, vz, &kjv, &mut books, &mut report)?;

    let mut has = vec![b'0'; vz.verse_count() as usize];
    let mut counts = [0usize; 3];
    let mut out = Vec::new();
    let mut parts: Vec<Vec<u16>> = Vec::with_capacity(BOOKS.len());
    for (b, items) in books.iter_mut().enumerate() {
        items.sort_by_key(|x| (x.from, x.work, x.to));
        // Each chapter's items, as JSON, in order.
        let mut chapters: BTreeMap<u16, Vec<Value>> = BTreeMap::new();
        for item in items.iter() {
            let (_, c, _) = vz.locate(item.from).ok_or("a note outside the Bible")?;
            if vz.locate(item.to).map(|l| l.1) != Some(c) {
                return Err(format!("a note on {} crosses a chapter", BOOKS[b].name));
            }
            for v in item.from..=item.to {
                has[v as usize] |= 1 << item.work;
            }
            counts[item.work as usize] += 1;
            chapters.entry(c).or_default().push(item_json(item));
        }
        let mut starts: Vec<u16> = Vec::new();
        let mut file: Vec<Value> = Vec::new();
        let mut bytes = 0usize;
        let mut flush = |file: &mut Vec<Value>, k: usize| -> Result<(), String> {
            let doc = json!({ "format": 1, "items": std::mem::take(file) });
            out.push((
                format!("{DIR}/{}.{k}.json", BOOKS[b].osis),
                serde_json::to_vec(&doc).map_err(|e| e.to_string())?,
            ));
            Ok(())
        };
        for (c, list) in chapters {
            let size: usize = list.iter().map(|x| x.to_string().len() + 1).sum();
            if starts.is_empty() || (bytes > 0 && bytes + size > PART_BYTES) {
                if !starts.is_empty() {
                    flush(&mut file, starts.len() - 1)?;
                }
                starts.push(c);
                bytes = 0;
            }
            bytes += size;
            file.extend(list);
        }
        if !starts.is_empty() {
            flush(&mut file, starts.len() - 1)?;
        }
        parts.push(starts);
    }
    let files: usize = parts.iter().map(Vec::len).sum();
    eprintln!(
        "voices: {} passages of the Fathers, {} of Henry's notes, {} of Wesley's, in {files} files; {} of {} references linked; {} introductions and {} notes on a verse 0 left out, {} not placed, {} ranges cut to the chapter",
        counts[0], counts[1], counts[2], report.linked, report.refs, report.intros, report.verse_zero, report.unplaced, report.clamped
    );
    eprintln!(
        "voices: the Fathers' passages took {} verses before the next passage, {} Gospel paragraphs and {} footnote marks left out; {} repeated Wesley notes left out and {} moved to the verse whose words they explain",
        report.filled, report.lemmas, report.marks, report.repeats, report.moved
    );
    let index = json!({
        "format": 1,
        "has": String::from_utf8(has).map_err(|e| e.to_string())?,
        "parts": parts,
    });
    out.push((
        OUT.to_string(),
        serde_json::to_vec(&index).map_err(|e| e.to_string())?,
    ));
    let runs = hebrew_runs(inputs, vz)?;
    eprintln!(
        "voices: {} Old Testament verses numbered otherwise in the Hebrew Bible, in {} runs",
        runs.iter().map(|r| r[1]).sum::<u32>(),
        runs.len()
    );
    let hebrew = json!({ "format": 1, "runs": runs });
    out.push((
        HEBREW.to_string(),
        serde_json::to_vec(&hebrew).map_err(|e| e.to_string())?,
    ));
    Ok(out)
}

/// All the words of a voice's text, for the checks.
fn plain(text: &Value) -> String {
    match text {
        Value::String(s) => s.clone(),
        Value::Array(a) => a
            .iter()
            .map(|r| match r {
                Value::String(s) => s.as_str(),
                Value::Array(x) => x.last().and_then(Value::as_str).unwrap_or(""),
                _ => "",
            })
            .collect(),
        _ => String::new(),
    }
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let index_path = d.dir.join(OUT);
    let size = fs::metadata(&index_path)
        .map_err(|e| format!("reading {}: {e}", index_path.display()))?
        .len();
    let index = read_json(&index_path)?;
    let n = d.vz.verse_count();
    let has = index["has"].as_str().unwrap_or("").as_bytes().to_vec();
    let has_ok = has.len() == n as usize && has.iter().all(|c| (b'0'..=b'7').contains(c));
    let parts: Vec<Vec<u16>> = index["parts"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|p| {
            p.as_array()
                .into_iter()
                .flatten()
                .map(|c| c.as_u64().unwrap_or(0) as u16)
                .collect()
        })
        .collect();
    let mut parts_ok = parts.len() == BOOKS.len();

    let mut seen = vec![b'0'; n as usize];
    let mut counts = [0usize; 3];
    let (mut items_ok, mut links_ok, mut clean) = (true, true, true);
    let mut largest = 0u64;
    // (work, first verse, last verse, who, words) of every note, for the known cases below.
    let mut notes: Vec<(u8, u32, u32, String, String)> = Vec::new();
    for (b, starts) in parts.iter().enumerate() {
        parts_ok &= starts.windows(2).all(|w| w[0] < w[1])
            && starts
                .iter()
                .all(|&c| c >= 1 && c <= d.vz.chapters_in(b as u8));
        for (k, &first) in starts.iter().enumerate() {
            let path = d.dir.join(format!("{DIR}/{}.{k}.json", BOOKS[b].osis));
            largest = largest.max(fs::metadata(&path).map(|m| m.len()).unwrap_or(u64::MAX));
            let doc = read_json(&path)?;
            let next = starts.get(k + 1).copied().unwrap_or(u16::MAX);
            let mut prev = (0u32, 0u64, 0u32);
            for item in doc["items"].as_array().into_iter().flatten() {
                let w = item[0].as_u64().unwrap_or(9);
                let (from, to) = (
                    item[1].as_u64().unwrap_or(u64::MAX) as u32,
                    item[2].as_u64().unwrap_or(0) as u32,
                );
                let (lf, lt) = (d.vz.locate(from), d.vz.locate(to));
                let fits = w < 3
                    && from <= to
                    && to < n
                    && matches!((lf, lt), (Some((bf, cf, _)), Some((bt, ct, _)))
                        if bf as usize == b && bt as usize == b && cf == ct && cf >= first && cf < next)
                    && (from, w, to) >= (prev.0, prev.1, prev.2);
                prev = (from, w, to);
                let voices = item[3].as_array().cloned().unwrap_or_default();
                let mut ok = fits && !voices.is_empty();
                for v in &voices {
                    let who = v[0].as_str().unwrap_or("");
                    let words = plain(&v[1]);
                    ok &= !words.trim().is_empty() && (w == FATHERS_W as u64) != who.is_empty();
                    clean &= !words.contains("{{")
                        && !words.contains("}}")
                        && !words.contains("#(")
                        && !words.starts_with(['-', '.', ',', ';', ':']);
                    if let Some(runs) = v[1].as_array() {
                        for r in runs.iter().filter_map(Value::as_array) {
                            let (a, z) = (
                                r[0].as_u64().unwrap_or(u64::MAX),
                                r[1].as_u64().unwrap_or(0),
                            );
                            links_ok &= a <= z
                                && z < n as u64
                                && r[2].as_str().is_some_and(|t| !t.is_empty());
                        }
                    }
                    notes.push((w as u8, from, to, who.to_string(), words));
                }
                items_ok &= ok;
                if fits {
                    counts[w as usize] += 1;
                    for v in from..=to {
                        seen[v as usize] |= 1 << w;
                    }
                }
            }
        }
    }

    // The Hebrew numbers, as (verse) -> (Hebrew chapter, Hebrew verse).
    let hebrew = read_json(&d.dir.join(HEBREW))?;
    let mut hebrew_ok = true;
    let mut renumbered: BTreeMap<u32, (u32, u32)> = BTreeMap::new();
    for r in hebrew["runs"].as_array().into_iter().flatten() {
        let x: Vec<u32> = r
            .as_array()
            .into_iter()
            .flatten()
            .map(|x| x.as_u64().unwrap_or(0) as u32)
            .collect();
        let ot = |v: u32| d.vz.locate(v).is_some_and(|l| l.0 <= 38);
        hebrew_ok &=
            x.len() == 4 && x[1] >= 1 && x[2] >= 1 && x[3] >= 1 && ot(x[0]) && ot(x[0] + x[1] - 1);
        for k in 0..x.get(1).copied().unwrap_or(0) {
            hebrew_ok &= renumbered.insert(x[0] + k, (x[2], x[3] + k)).is_none();
        }
    }
    let hebrew_at = |r: &str| -> Result<(u32, u32), String> {
        let (v, _) = d.resolve(r)?;
        let (_, c, n) = d.vz.locate(v).ok_or("no such verse")?;
        Ok(renumbered
            .get(&v)
            .copied()
            .unwrap_or((u32::from(c), u32::from(n))))
    };

    // Wesley notes with the same words as the Wesley note before them.
    let mut wesley: Vec<&(u8, u32, u32, String, String)> =
        notes.iter().filter(|n| n.0 == WESLEY_W).collect();
    wesley.sort_by_key(|n| n.1);
    let repeated = wesley.windows(2).filter(|w| w[0].4 == w[1].4).count();

    let note = |work: u8, r: &str, who: &str, words: &str| -> Result<bool, String> {
        let (v, _) = d.resolve(r)?;
        Ok(notes.iter().any(|(w, a, z, x, t)| {
            *w == work && *a <= v && v <= *z && (who.is_empty() || x == who) && t.contains(words)
        }))
    };
    Ok(vec![
        (
            counts[0] > 800 && counts[1] > 4_000 && counts[2] > 16_000,
            format!(
                "{} passages of the Church Fathers, {} of Matthew Henry's notes and {} of John Wesley's, expected more than 800, 4,000 and 16,000",
                counts[0], counts[1], counts[2]
            ),
        ),
        (
            has_ok && parts_ok && seen == has,
            "the writers' index marks exactly the verses their notes cover, and lists every file".to_string(),
        ),
        (
            items_ok,
            "every writer's note is on real verses in one chapter, in its book's file, in order, with words, and only the Fathers' are under a name".to_string(),
        ),
        (links_ok, "every verse a writer's note links to is a real verse".to_string()),
        (
            clean,
            "no writer's note keeps the modules' reference or verse marks (\"{{\", \"#(\"), or starts with a dash or a stop".to_string(),
        ),
        (
            size < 200_000,
            format!("extras/voices.json is {size} bytes, expected under 200,000"),
        ),
        (
            largest < 1_500_000,
            format!("the largest file of writers' notes is {largest} bytes, expected under 1,500,000"),
        ),
        (
            note(FATHERS_W, "John 1:1", "Chrysostom", "While all the other Evangelists begin with the Incarnation")?,
            "Chrysostom's words on John 1:1 are under John 1:1".to_string(),
        ),
        (
            note(FATHERS_W, "Matthew 17:27", "", "")? && note(FATHERS_W, "John 11:57", "", "")?,
            "the Fathers' passages that end Matthew 17 and John 11 reach the chapters' last verses".to_string(),
        ),
        (
            note(HENRY_W, "Genesis 1:1", "", "The first verse of the Bible gives us")?
                && !note(HENRY_W, "Genesis 1:1", "", "Genesis is a name taken from the Greek")?,
            "Henry's note on Genesis 1:1-2 is there, without his introduction to the book".to_string(),
        ),
        (
            note(HENRY_W, "Psalm 23:4", "", "The Lord is my shepherd")?,
            "Henry's note on Psalm 23 as a whole covers Psalm 23:4".to_string(),
        ),
        (
            note(WESLEY_W, "John 3:1", "", "One of the great council")?
                && !note(WESLEY_W, "John 3:2", "", "One of the great council")?,
            "Wesley's note on John 3:1 is on that verse only".to_string(),
        ),
        (
            note(WESLEY_W, "Psalm 22:31", "", "The seed last mentioned")?
                && !note(WESLEY_W, "Psalm 23:1", "", "The seed last mentioned")?
                && repeated == 0,
            format!("no Wesley note is repeated on the next verse with a note (Psalm 22:31's is not on Psalm 23:1); {repeated} are"),
        ),
        (
            note(WESLEY_W, "John 9:38", "", "Lord, I believe")?
                && !note(WESLEY_W, "John 9:37", "", "Lord, I believe")?,
            "Wesley's note on \"Lord, I believe\" is on John 9:38, the verse it explains".to_string(),
        ),
        (
            note(HENRY_W, "Ezekiel 47:1", "", "These waters signify the gospel")?
                && note(HENRY_W, "John 3:16", "", "God so loved the world")?
                && note(HENRY_W, "Matthew 13:40", "", "This parable represents")?
                && note(HENRY_W, "Deuteronomy 20:19", "", "fruit-trees")?,
            "Henry's notes reach Ezekiel 47, John 3:16, Matthew 13:36-43 and Deuteronomy 20:19, which their headings leave out".to_string(),
        ),
        (
            note(FATHERS_W, "Luke 2:27", "", "")?
                && note(FATHERS_W, "Matthew 5:16", "", "")?
                && !note(FATHERS_W, "Luke 2:25", "Bede", "And, behold, there was a man in Jerusalem")?
                && !note(FATHERS_W, "Matthew 1:1", "", "Hebrewa")?
                && note(FATHERS_W, "Matthew 1:1", "", "in Hebrew;")?,
            "the Fathers reach Luke 2:27 and Matthew 5:16, without the Gospel's own words or footnote marks (\"in Hebrew;\" on Matthew 1:1)".to_string(),
        ),
        (
            hebrew_ok
                && (1_500..2_500).contains(&renumbered.len())
                && hebrew_at("Joel 2:28")? == (3, 1)
                && hebrew_at("Malachi 4:5")? == (3, 23)
                && hebrew_at("Psalm 51:1")? == (51, 3)
                && hebrew_at("Daniel 4:1")? == (3, 31)
                && hebrew_at("Jonah 1:17")? == (2, 1)
                && hebrew_at("Exodus 20:15")? == (20, 13)
                && hebrew_at("Exodus 20:17")? == (20, 14)
                && hebrew_at("Nehemiah 7:70")? == (7, 69)
                && hebrew_at("Deuteronomy 5:21")? == (5, 18)
                && hebrew_at("1 Kings 18:33")? == (18, 33)
                && hebrew_at("Psalm 23:1")? == (23, 1)
                && hebrew_at("Genesis 1:1")? == (1, 1),
            format!(
                "{} Old Testament verses have their Hebrew Bible number for Sefaria's links (Joel 2:28 is Joel 3:1 there, Malachi 4:5 is 3:23, Psalm 51:1 is 51:3)",
                renumbered.len()
            ),
        ),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vz() -> Versification {
        let counts: Vec<Vec<u16>> = BOOKS.iter().map(|_| vec![40u16; 30]).collect();
        Versification::from_counts(&counts)
    }

    fn at(vz: &Versification, b: u8, c: u16, v: u16) -> u32 {
        vz.index(b, c, v).unwrap()
    }

    #[test]
    fn reads_the_references_the_modules_use() {
        let vz = vz();
        fn read<'a>(s: &'a str, vz: &Versification) -> Option<(u32, u32, &'a str)> {
            reference(s, 42, vz).map(|(f, t, n)| (f, t, &s[..n]))
        }
        let r = |s: &'static str| read(s, &vz);
        assert_eq!(
            r("Isa.1.1-Isa.1.9"),
            Some((at(&vz, 22, 1, 1), at(&vz, 22, 1, 9), "Isa.1.1-Isa.1.9"))
        );
        assert_eq!(
            r("1John.5.20"),
            Some((at(&vz, 61, 5, 20), at(&vz, 61, 5, 20), "1John.5.20"))
        );
        assert_eq!(
            r("Mt 23:37 as the eagle"),
            Some((at(&vz, 39, 23, 37), at(&vz, 39, 23, 37), "Mt 23:37"))
        );
        assert_eq!(
            r("1Cor 13:4-7"),
            Some((at(&vz, 45, 13, 4), at(&vz, 45, 13, 7), "1Cor 13:4-7"))
        );
        assert_eq!(r("Ge 1:10,11").map(|x| x.2), Some("Ge 1:10"));
        assert_eq!(
            r("Ps 23").map(|x| (x.0, x.1)),
            Some((at(&vz, 18, 23, 1), at(&vz, 18, 23, 40)))
        );
        assert_eq!(r("3:16").map(|x| x.0), Some(at(&vz, 42, 3, 16)));
        assert_eq!(r("16"), None);
        assert_eq!(r("Jud 5:1"), None);
        assert_eq!(r("1Macc 2:3"), None);
        for (abbr, book) in [
            ("Mr", 40),
            ("Lu", 41),
            ("Joh", 42),
            ("Ac", 43),
            ("Re", 65),
            ("Ec", 20),
            ("So", 21),
            ("Phil", 49),
            ("Php", 49),
            ("Phm", 56),
            ("Jas", 58),
            ("1Kgs", 10),
            ("1Kin", 10),
            ("2Chron", 13),
            ("Psal", 18),
            ("Eze", 25),
            ("Joe", 28),
            ("Jon", 31),
            ("Es", 16),
            ("Ne", 15),
            ("La", 24),
            ("Ho", 27),
            ("Nu", 3),
        ] {
            assert_eq!(book_named(abbr), Some(book), "{abbr}");
        }
    }

    #[test]
    fn links_the_marked_references_and_keeps_their_words() {
        let vz = vz();
        let mut r = Report::default();
        let got = runs("See {{ref:1John.5.20|1Jo 5:20}}, and {{ref:Mt 23:37 as the eagle|Mt 23:37 as the eagle}}; {{ref:12|12}}. {{{ref:Ge 1:3|Ge 1:3}}}", 0, &vz, &mut r);
        assert_eq!(
            got,
            vec![
                Run::Text("See ".into()),
                Run::Verse(at(&vz, 61, 5, 20), at(&vz, 61, 5, 20), "1Jo 5:20".into()),
                Run::Text(", and ".into()),
                Run::Verse(at(&vz, 39, 23, 37), at(&vz, 39, 23, 37), "Mt 23:37".into()),
                Run::Text(" as the eagle; 12. ".into()),
                Run::Verse(at(&vz, 0, 1, 3), at(&vz, 0, 1, 3), "Ge 1:3".into()),
            ]
        );
        assert_eq!((r.refs, r.linked), (4, 3));
    }

    #[test]
    fn links_a_bare_number_only_in_the_chapter_before_it() {
        let vz = vz();
        let mut r = Report::default();
        let got = runs(
            "{{ref:1Cor.10.1|1Co 10:1}}, {{ref:2Cor.10.2|2}}; {{ref:Ps.23.1|Ps 23:1}}, {{ref:Ps.23.4|4}}; {{ref:Ps.24.1|1}}",
            0,
            &vz,
            &mut r,
        );
        let linked: Vec<&str> = got
            .iter()
            .filter_map(|x| match x {
                Run::Verse(_, _, t) => Some(t.as_str()),
                Run::Text(_) => None,
            })
            .collect();
        assert_eq!(linked, vec!["1Co 10:1", "Ps 23:1", "4"]);
    }

    #[test]
    fn takes_footnote_marks_off_words_only() {
        let mut catena: HashMap<String, usize> = HashMap::new();
        for w in ["hebrew", "christ", "the", "god", "con", "act"] {
            catena.insert(w.to_string(), 50);
        }
        for w in [
            "hebrewa", "christb", "thea", "conf", "acta", "loved", "hebrewe",
        ] {
            catena.insert(w.to_string(), 1);
        }
        let vocab = Vocabulary {
            kjv: ["the", "god", "loved", "act"]
                .iter()
                .map(|w| w.to_string())
                .collect(),
            catena,
        };
        let mut r = Report::default();
        assert_eq!(
            unmark(
                "in Hebrewa; the Christb, thea Godb there1. (Conf. x.) Acta. loved Hebrewe",
                &vocab,
                &mut r
            ),
            "in Hebrew; the Christ, the God there. (Conf. x.) Acta. loved Hebrewe"
        );
        assert_eq!(r.marks, 5);
        assert!(gospel_line("25. And, behold, there was a man", 22, 25));
        assert!(gospel_line("28. Then took he him up", 22, 25));
        assert!(!gospel_line("1. The effect produced", 22, 25));
        assert!(!gospel_line("And 25 more", 22, 25));
    }

    #[test]
    fn reads_the_words_a_wesley_note_explains() {
        assert_eq!(
            lemma("Lord, I believe - What an excellent spirit"),
            Some(" lord i believe ".to_string())
        );
        assert_eq!(lemma("Observe here. 1. The effect produced"), None);
        assert_eq!(lemma("I - me"), None);
        assert!(word_form("Lord, I believe.").contains(" i believe "));
        assert!(!word_form("I believed").contains(" i believe "));
    }

    #[test]
    fn reads_a_heading_split_over_two_lines() {
        let s = henry_sections(
            "Verses 24-30\n\n, 36-43 This parable represents.\nVerses 31-35 . The mustard seed.",
        )
        .unwrap();
        assert_eq!(
            s,
            vec![
                (24, 30, "This parable represents.".to_string()),
                (36, 43, "This parable represents.".to_string()),
                (31, 35, "The mustard seed.".to_string()),
            ]
        );
        assert_eq!(
            henry_sections("Chapter 41\n\nAfter the prophet had observed the courts, he was brought to the temple."),
            Err(Some("After the prophet had observed the courts, he was brought to the temple.".to_string()))
        );
        assert_eq!(
            verse_marks("ver. #(11-13), and #(19)."),
            "ver. 11-13, and 19."
        );
    }

    #[test]
    fn splits_henry_by_his_headings() {
        let body = "Genesis\n\nAn introduction.\n\nChapter 1\n\nChapter Outline\n\nGod creates. (1-2)\n\nVerses 1-2\n\nThe first verse.\n\nMore.\n\nVerse 7 ,8 Frequently, more.\nVerses 9-11 --Men's hearts.";
        let s = henry_sections(body).unwrap();
        assert_eq!(
            s,
            vec![
                (1, 2, "The first verse.\n\nMore.".to_string()),
                (7, 8, "Frequently, more.".to_string()),
                (9, 11, "Men's hearts.".to_string()),
            ]
        );
    }

    #[test]
    fn takes_a_chapter_henry_treats_as_a_whole() {
        assert_eq!(
            henry_sections("Chapter 23\n\nConfidence in God.\n\n--\"The Lord is my shepherd.\" In these words."),
            Err(Some("\"The Lord is my shepherd.\" In these words.".to_string()))
        );
        assert_eq!(
            henry_sections(
                "Chapter 12\n\nA hymn of praise.\n\nThe song of praise in this chapter."
            ),
            Err(Some("The song of praise in this chapter.".to_string()))
        );
        assert_eq!(henry_sections("Obadiah"), Err(None));
    }

    #[test]
    fn does_not_take_a_sentence_for_a_heading() {
        assert_eq!(heading("Verses 1-3"), Some((1, 3, "")));
        assert_eq!(
            heading("Verses 10-15 Judea was desolate"),
            Some((10, 15, "Judea was desolate"))
        );
        assert_eq!(heading("Verse 3"), Some((3, 3, "")));
        assert_eq!(heading("Verses 3a"), None);
        assert_eq!(heading("Verse after verse"), None);
    }
}
