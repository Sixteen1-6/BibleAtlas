//! John Calvin's commentaries on the New Testament, in the Calvin Translation
//! Society's English (Edinburgh, 1843–55), from the CrossWire SWORD module as
//! kept in the Let's Church repository (`calvin-commentaries`).
//!
//! The file gives each note a verse. Besides Calvin's notes, an entry often
//! ends with what the printed volumes set before the next passage: a heading
//! naming its verses (a reference mark, "MATTHEW 23:23-28; LUKE 11:42, 44",
//! "Hebrews Chapter 4:1-2", "Philemon Verses 8-14"), those verses in English
//! and in Latin, "CHAPTER 9", and at a book's end its last words, indexes and
//! the next book's Argument, dedication and Calvin's own version of the text.
//! The reader keeps only Calvin's notes:
//! - a heading starts a section: the verses printed after it are left out
//!   (Latin is told by its words, which the KJV mostly does not use; English by
//!   being the section's own verses, or a "Written from Rome" subscription);
//!   any words of Calvin's after them, before his note on the section's first
//!   verse, go on the section's verses in his book ("Peter's fall, which is
//!   here related ..."), and a verse printed after them is left out too;
//! - a printed verse with no heading before it (a verse number, then the
//!   KJV's own words of that verse) starts a section the same way;
//! - a paragraph in capitals that names no verses ("END OF THE COMMENTARY ON
//!   THE EPISTLE TO THE COLOSSIANS.", "THE ARGUMENT", "APPENDIX ...") or one
//!   that begins "Index" ends the entry: what follows is not a note on it;
//! - a paragraph wholly in Latin is left out wherever it is;
//! - the few entries filed on the wrong verse ([`MOVES`]) go on the verse
//!   their note begins with; the build fails on any other entry that begins
//!   with another verse's number, unless [`KEEPS`] lists it;
//! - a paragraph the copy breaks off before a quotation ("and again,") is
//!   joined to the next.
//!
//! Calvin wrote one Harmony of Matthew, Mark and Luke, filed under Matthew.
//! Its section headings name the parallels in Mark and Luke, so a parallel
//! passage on which the copy has no note of his own shows his notes on the
//! Matthew passage, under "Calvin's notes on Matthew 3:13-17, in his Harmony
//! of the Gospels".
//!
//! Left out: the Old Testament (for now); 1 and 2 Timothy and Titus, which this
//! copy keeps only as the start of each chapter's comments; and the passages
//! `config/voices/calvin-commentaries.json` lists, where Calvin says a word of
//! Scripture as the Berean Standard Bible prints it is a mistake (decision 23).
//! Each is marked "[passage left out]", with the entry's line under the note.

use super::{entries, passage_name, place, reference, runs, words, Item, Report};
use atlas_core::Versification;
use serde::Deserialize;
use std::collections::{BTreeMap, HashSet};
use std::path::Path;

pub(super) const CALVIN: &str = "calvin-commentaries";
pub(super) const CALVIN_W: u8 = 3;
const CONFIG: &str = "config/voices/calvin-commentaries.json";
/// What stands in a note where a passage is left out.
pub(super) const LEFT_OUT: &str = "[passage left out]";
/// The line under a note for a passage left out until the founder decides on it.
pub(super) const UNDECIDED: &str = "A passage is left out here until a decision on it is made.";

const MATTHEW: u8 = 39;
const JUDE: u8 = 64;
/// 1 Timothy, 2 Timothy and Titus.
const PASTORALS: [u8; 3] = [53, 54, 55];

/// Entries filed on another verse than the one their note begins with, as
/// (book, chapter, the file's verse, the note's verse). Each note's opening
/// words are that verse's in the KJV ("44. For Jesus himself testified" on
/// John 4:4; "10 Whosoever doeth not righteousness" on 1 John 3:11).
const MOVES: [(u8, u16, u16, u16); 7] = [
    (42, 4, 4, 44),
    (43, 16, 37, 38),
    (43, 24, 21, 24),
    (46, 7, 12, 11),
    (49, 2, 23, 24),
    (61, 3, 11, 10),
    (61, 5, 10, 9),
];
/// Entries that begin with another verse's number but are on the right verse:
/// Colossians 3:12's note, numbered 13, opens with "Put on therefore", the
/// words of verse 12.
const KEEPS: [(u8, u16, u16); 1] = [(50, 3, 12)];
/// Words not Calvin's that the copy runs on into a note, as (book, chapter,
/// verse, the first words of the first paragraph to cut): the translator's
/// footnote with Beza's lines on Bullinger, who outlived Calvin, at the end of
/// 1 Corinthians 16:22.
const CUTS: [(u8, u16, u16, &str); 1] = [(45, 16, 22, "Beza, in his poems")];

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    format: u32,
    #[allow(dead_code)]
    about: String,
    exclude: Vec<Exclusion>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Exclusion {
    id: String,
    /// "sentence" or "paragraph".
    scope: String,
    /// The verse of the note, as "Matthew 27:9".
    on: String,
    /// Words of the passage, found once in the note.
    words: String,
    reason: String,
    #[allow(dead_code)]
    why: String,
    line: String,
    proposed: Option<String>,
}

/// What the Calvin reader did, for the build's report.
#[derive(Default)]
pub(super) struct Counts {
    entries: usize,
    old_testament: usize,
    pastorals: usize,
    headings: usize,
    printed: usize,
    latin: usize,
    stopped: usize,
    intros: usize,
    moved: usize,
    joined: usize,
    empty: usize,
    harmony: usize,
    left_out: usize,
}

#[derive(PartialEq)]
enum Kind {
    /// A section heading, with the verses it names.
    Heading(Vec<(u32, u32)>),
    Chapter,
    Stop,
    NoLetters,
    Text,
}

/// The text of a paragraph without its `{{...}}` marks.
fn unmarked(p: &str) -> String {
    let mut out = String::new();
    let mut rest = p;
    while let Some(i) = rest.find("{{") {
        out.push_str(&rest[..i]);
        match rest[i..].find("}}") {
            Some(e) => rest = &rest[i + e + 2..],
            None => {
                rest = "";
            }
        }
    }
    out.push_str(rest);
    out
}

/// The targets of a paragraph's reference marks, `Bible:` taken off and only
/// the first of several kept.
fn mark_targets(p: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut rest = p;
    while let Some(i) = rest.find("{{ref:") {
        let body = &rest[i + 6..];
        let Some(e) = body.find("}}") else { break };
        let target = body[..e].split('|').next().unwrap_or("");
        let target = target.trim().trim_start_matches("Bible:");
        if let Some(first) = target.split_whitespace().next() {
            out.push(first);
        }
        rest = &body[e..];
    }
    out
}

/// The copy's reference marks as the other works write them: `Bible:` taken
/// off the target, and only the first of several targets kept
/// ("{{ref:Bible:Matt.3.13-Matt.3.17 Mark.1.9-Mark.1.11|...}}").
fn marks(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(i) = rest.find("{{ref:") {
        out.push_str(&rest[..i + 6]);
        let body = &rest[i + 6..];
        let end = body.find(['|', '}']).unwrap_or(body.len());
        let target = body[..end].trim().trim_start_matches("Bible:");
        out.push_str(target.split_whitespace().next().unwrap_or(""));
        rest = &body[end..];
    }
    out.push_str(rest);
    out
}

/// A paragraph's lowercase words (ASCII letters only).
fn lower_words(p: &str) -> Vec<String> {
    words(p).map(|w| w.to_ascii_lowercase()).collect()
}

/// The verses a written heading names: "MATTHEW 23:23-28; LUKE 11:42, 44",
/// "Matthew\n22:41-46", "Hebrews Chapter 4:1-2", "Philemon Verses 8-14".
fn written_targets(text: &str, here: u8, vz: &Versification) -> Vec<(u32, u32)> {
    let mut out = Vec::new();
    let mut book = here;
    let text = text.replace('\n', " ");
    for piece in text.split(';') {
        let mut s = piece.trim().trim_end_matches(['.', ',']).to_string();
        for w in ["Chapter ", "chapter ", "CHAPTER ", "Verses ", "verses ", "Verse ", "verse "] {
            s = s.replace(w, "");
        }
        // "Philemon 8-14": a book of one chapter.
        let mut j = 0;
        let token = super::book_token(&s, &mut j);
        let named = (!token.is_empty()).then(|| super::book_named(token)).flatten();
        if let Some(b) = named {
            book = b;
            if !s[j..].contains(':') && vz.chapters_in(b) == 1 {
                s = format!("{token} 1:{}", s[j..].trim());
            }
        }
        if let Some((f, t, _)) = reference(&s, book, vz) {
            out.push((f, t));
        }
    }
    out
}

fn kind(p: &str, here: u8, vz: &Versification) -> Kind {
    let bare = unmarked(p);
    let has_mark = p.contains("{{ref:");
    if has_mark && bare.chars().all(|c| c.is_whitespace() || c.is_ascii_digit() || ";,.:-".contains(c)) {
        let mut t: Vec<(u32, u32)> = Vec::new();
        for target in mark_targets(p) {
            match reference(target, here, vz) {
                Some((f, to, n)) if n == target.len() => t.push((f, to)),
                // "{{ref:Bible:Eph.5|Ephesians 5}}: 3-7": a chapter, then verses.
                _ => {
                    let verses = bare.trim().trim_start_matches(':').trim();
                    let mut j = 0;
                    let tok = super::book_token(target, &mut j);
                    if let (Some(b), Some(c)) = (super::book_named(tok), target[j..].trim_start_matches('.').parse::<u16>().ok()) {
                        t.extend(written_targets(&format!("{tok} {c}:{verses}"), b, vz).into_iter().take(1));
                    }
                }
            }
        }
        return Kind::Heading(t);
    }
    let trimmed = p.trim();
    if let Some(n) = trimmed.strip_prefix("CHAPTER ").or_else(|| trimmed.strip_prefix("Chapter ")) {
        if !n.is_empty() && n.trim_end_matches('.').bytes().all(|c| c.is_ascii_digit()) {
            return Kind::Chapter;
        }
    }
    if trimmed.len() < 60 && trimmed.starts_with("Index") {
        return Kind::Stop;
    }
    // A heading in words: only book names, "Chapter", "Verses" and numbers.
    if trimmed.len() < 120
        && trimmed.bytes().any(|c| c.is_ascii_digit())
        && trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c.is_whitespace() || ";,.:-".contains(c))
    {
        let ws: Vec<&str> = words(trimmed).collect();
        let book_word = |w: &str| {
            super::book_named(w).is_some()
                || super::book_named(&format!("1 {w}")).is_some()
                || ["chapter", "verse", "verses"].contains(&w.to_ascii_lowercase().as_str())
        };
        if !ws.is_empty() && ws.iter().all(|w| book_word(w)) {
            let t = written_targets(trimmed, here, vz);
            if !t.is_empty() {
                return Kind::Heading(t);
            }
        }
    }
    if !bare.chars().any(char::is_lowercase) {
        if bare.chars().any(|c| c.is_ascii_alphabetic()) {
            let t = written_targets(&bare, here, vz);
            if !t.is_empty() && bare.bytes().filter(u8::is_ascii_uppercase).count() >= 3 {
                return Kind::Heading(t);
            }
            return Kind::Stop;
        }
        if !bare.chars().any(char::is_alphabetic) {
            return Kind::NoLetters;
        }
    }
    if trimmed.len() < 60 && trimmed.to_ascii_lowercase().starts_with("end of the ") {
        return Kind::Stop;
    }
    Kind::Text
}

/// The verse number a paragraph opens with ("23. For all", "9 Porro", and
/// "l4." where the copy reads a 1 as an l), if any.
fn opening_number(p: &str) -> Option<(Option<u16>, usize)> {
    let b = p.as_bytes();
    let n = b.iter().take_while(|&&c| c.is_ascii_digit() || c == b'l').count();
    if n == 0 || n > 3 {
        return None;
    }
    let digits = b[..n].iter().any(u8::is_ascii_digit);
    let mut i = n;
    let dot = b.get(i) == Some(&b'.');
    if dot {
        i += 1;
    }
    if !b.get(i).is_some_and(u8::is_ascii_whitespace) || !(digits || dot) {
        return None;
    }
    let num = std::str::from_utf8(&b[..n]).ok()?.replace('l', "1").parse().ok();
    Some((num, i))
}

/// The share of `ws` in `vocab`.
fn share(ws: &[String], vocab: &HashSet<String>) -> f64 {
    if ws.is_empty() {
        return 0.0;
    }
    ws.iter().filter(|w| vocab.contains(w.as_str())).count() as f64 / ws.len() as f64
}

struct Reader<'a> {
    vz: &'a Versification,
    kjv: &'a [String],
    /// Every word of the KJV, lowercase.
    english: HashSet<String>,
}

impl Reader<'_> {
    fn latin(&self, p: &str) -> bool {
        let ws = lower_words(&unmarked(p));
        ws.len() >= 4 && share(&ws, &self.english) < 0.5
    }

    fn vocab(&self, sec: &[(u32, u32)]) -> HashSet<String> {
        let mut v = HashSet::new();
        for &(f, t) in sec {
            for i in f..=t.min(f + 200) {
                if let Some(line) = self.kjv.get(i as usize) {
                    v.extend(lower_words(line));
                }
            }
        }
        v
    }

    /// A paragraph that prints the section's verses rather than commenting on
    /// them; `numbered` asks for a verse number first.
    fn printed(&self, p: &str, sec: &[(u32, u32)], numbered: bool) -> bool {
        if numbered && opening_number(p).is_none() {
            return false;
        }
        let ws = lower_words(&unmarked(p));
        if p.len() < 200 && ws.iter().any(|w| w == "written") && ws.iter().any(|w| w == "from") {
            return true;
        }
        if ws.len() < 2 {
            return numbered;
        }
        let vocab = self.vocab(sec);
        !vocab.is_empty() && share(&ws, &vocab) >= if numbered { 0.75 } else { 0.6 }
    }

    /// A paragraph that is verse `n` of the chapter in the KJV's words.
    fn is_verse(&self, p: &str, b: u8, c: u16, n: u16) -> bool {
        let Some(i) = self.vz.index(b, c, n) else { return false };
        let verse = lower_words(self.kjv.get(i as usize).map_or("", String::as_str));
        let ws = lower_words(&unmarked(p));
        let set: HashSet<String> = verse.iter().cloned().collect();
        !set.is_empty() && share(&ws, &set) >= 0.75 && ws.len() < 2 * set.len() + 5
    }
}

/// Paragraphs the copy breaks off before a quotation ("and again,"), joined
/// to the next; single line breaks as spaces.
fn joined(ps: Vec<String>, counts: &mut Counts) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for p in ps {
        let p = p.split_whitespace().collect::<Vec<_>>().join(" ");
        let open = out.last().is_some_and(|q| {
            q != LEFT_OUT && q.ends_with(|c: char| c.is_ascii_lowercase() || ",:;—".contains(c))
        });
        if open && opening_number(&p).is_none() && p != LEFT_OUT {
            let q = out.last_mut().expect("a paragraph");
            q.push(' ');
            q.push_str(&p);
            counts.joined += 1;
        } else {
            out.push(p);
        }
    }
    out
}

/// A note's paragraphs, keyed by (book, first verse, last verse).
type Notes = BTreeMap<(u8, u32, u32), Vec<String>>;
/// The lines under each note with a passage left out, keyed as [`Notes`].
type Lines = BTreeMap<(u8, u32, u32), Vec<String>>;
/// The voices of each Harmony note on Mark and Luke, keyed as [`Notes`].
type Voices = BTreeMap<(u8, u32, u32), Vec<(String, Vec<String>)>>;

/// Leaves out what the config lists, and returns each note's lines.
fn exclude(root: &Path, vz: &Versification, notes: &mut Notes, counts: &mut Counts) -> Result<Lines, String> {
    let text = std::fs::read_to_string(root.join(CONFIG)).map_err(|e| format!("reading {CONFIG}: {e}"))?;
    let cfg: Config = serde_json::from_str(&text).map_err(|e| format!("{CONFIG}: {e}"))?;
    if cfg.format != 1 {
        return Err(format!("{CONFIG}: format must be 1"));
    }
    let mut lines: Lines = BTreeMap::new();
    let mut ids = HashSet::new();
    for x in &cfg.exclude {
        let at = format!("{CONFIG}: {}", x.id);
        if !ids.insert(x.id.as_str()) {
            return Err(format!("{at}: the id is used twice"));
        }
        if x.reason != "calls-text-wrong" && x.reason != "denies-author" {
            return Err(format!("{at}: reason must be calls-text-wrong or denies-author"));
        }
        if x.proposed.is_some() && x.line != UNDECIDED {
            return Err(format!("{at}: a proposed entry's line is \"{UNDECIDED}\""));
        }
        if x.line.contains('\u{2014}') || x.words.split_whitespace().count() < 5 {
            return Err(format!("{at}: words need five or more words, and the line no em dash"));
        }
        let (v, _, _) = reference(&x.on, 0, vz).filter(|&(_, _, n)| n == x.on.len()).ok_or(format!("{at}: {} is not a verse", x.on))?;
        let (b, _, _) = vz.locate(v).ok_or(format!("{at}: {} is not a verse", x.on))?;
        let key = notes
            .keys()
            .copied()
            .find(|&(nb, f, t)| nb == b && f == v && t == v)
            .ok_or(format!("{at}: Calvin has no note on {}", x.on))?;
        let ps = notes.get_mut(&key).expect("the note");
        let found: Vec<usize> = ps.iter().enumerate().filter(|(_, p)| p.contains(&x.words)).map(|(i, _)| i).collect();
        let total: usize = ps.iter().map(|p| p.matches(&x.words).count()).sum();
        if total != 1 {
            return Err(format!("{at}: its words are in the note on {} {total} times, not once", x.on));
        }
        let i = found[0];
        match x.scope.as_str() {
            "paragraph" => ps[i] = LEFT_OUT.to_string(),
            "sentence" => {
                let p = &ps[i];
                let at_word = p.find(&x.words).expect("found");
                let ends = |s: &str| -> Vec<usize> {
                    let mut v = Vec::new();
                    for pat in [". ", "? ", "! "] {
                        v.extend(s.match_indices(pat).map(|(k, _)| k + 1));
                    }
                    v
                };
                let start = ends(&p[..at_word]).into_iter().max().map_or(0, |k| k + 1);
                let after = at_word + x.words.len();
                let end = ends(&p[after..]).into_iter().min().map_or(p.len(), |k| after + k);
                let mut q = String::new();
                q.push_str(&p[..start]);
                q.push_str(LEFT_OUT);
                let rest = &p[end..];
                if !rest.is_empty() && !rest.starts_with(' ') {
                    q.push(' ');
                }
                q.push_str(rest);
                // Sentences left out one after another show as one.
                let twice = format!("{LEFT_OUT} {LEFT_OUT}");
                while q.contains(&twice) {
                    q = q.replace(&twice, LEFT_OUT);
                }
                ps[i] = q.trim().to_string();
            }
            _ => return Err(format!("{at}: scope must be sentence or paragraph")),
        }
        counts.left_out += 1;
        let l = lines.entry(key).or_default();
        if !l.contains(&x.line) {
            l.push(x.line.clone());
        }
    }
    Ok(lines)
}

pub(super) fn calvin(
    root: &Path,
    inputs: &crate::sources::Inputs,
    vz: &Versification,
    kjv: &[String],
    items: &mut [Vec<Item>],
    report: &mut Report,
) -> Result<Counts, String> {
    let mut counts = Counts::default();
    let reader = Reader {
        vz,
        kjv,
        english: kjv.iter().flat_map(|l| lower_words(l)).collect(),
    };
    let mut notes: Notes = BTreeMap::new();
    // The Harmony's sections: the verses each heading names.
    let mut sections: Vec<Vec<(u32, u32)>> = Vec::new();
    let mut wrong: Vec<String> = Vec::new();
    for e in entries(inputs, CALVIN, "calvin")? {
        let Some((b, c, v)) = place(&e) else {
            report.unplaced += 1;
            continue;
        };
        if !(MATTHEW..=JUDE).contains(&b) {
            counts.old_testament += 1;
            continue;
        }
        if PASTORALS.contains(&b) {
            counts.pastorals += 1;
            continue;
        }
        counts.entries += 1;
        let moved = MOVES.iter().find(|m| (m.0, m.1, m.2) == (b, c, v)).map(|m| m.3);
        counts.moved += usize::from(moved.is_some());
        let v = moved.unwrap_or(v);
        let Some(here) = vz.index(b, c, v) else {
            report.unplaced += 1;
            continue;
        };
        let body = e["body"].as_str().unwrap_or("");
        let mut ps: Vec<&str> = body.split("\n\n").map(str::trim).filter(|p| !p.is_empty()).collect();
        if let Some(&(.., words)) = CUTS.iter().find(|x| (x.0, x.1, x.2) == (b, c, v)) {
            let at: Vec<usize> = ps.iter().enumerate().filter(|(_, p)| p.starts_with(words)).map(|(i, _)| i).collect();
            if at.len() != 1 {
                return Err(format!("{CALVIN}: the cut \"{words}\" is not found once in {} {c}:{v}", atlas_core::canon::BOOKS[b as usize].name));
            }
            ps.truncate(at[0]);
        }
        #[derive(PartialEq, Clone, Copy)]
        enum Mode {
            Own,
            Lead,
            Printed,
            Intro,
        }
        let mut mode = Mode::Own;
        let mut own: Vec<String> = Vec::new();
        let mut sec: Vec<(u32, u32)> = Vec::new();
        // Where words after a section's printed verses go.
        let mut intro: Option<(u32, u32)> = None;
        let mut after_heading = false;
        for (i, p) in ps.iter().enumerate() {
            let k = kind(p, b, vz);
            match k {
                Kind::Stop => {
                    counts.stopped += 1;
                    break;
                }
                Kind::Chapter | Kind::NoLetters => {
                    after_heading = false;
                    continue;
                }
                Kind::Heading(t) => {
                    counts.headings += 1;
                    let harmony_book = (MATTHEW..=41).contains(&b);
                    if after_heading {
                        sec.extend(t);
                        if let Some(last) = sections.last_mut().filter(|_| harmony_book) {
                            *last = sec.clone();
                        }
                    } else {
                        sec = t;
                        mode = if i == 0 { Mode::Lead } else { Mode::Printed };
                        if harmony_book {
                            sections.push(sec.clone());
                        }
                    }
                    after_heading = true;
                    // The section's verses in Calvin's own book, else the first named.
                    let pick = sec
                        .iter()
                        .copied()
                        .find(|&(f, _)| vz.locate(f).is_some_and(|l| l.0 == b))
                        .or_else(|| sec.first().copied());
                    intro = pick.and_then(|(f, t)| {
                        let (fb, fc, _) = vz.locate(f)?;
                        let last = vz.index(fb, fc, vz.verses_in(fb, fc)?)?;
                        Some((f, t.min(last)))
                    });
                    continue;
                }
                Kind::Text => {}
            }
            after_heading = false;
            if reader.latin(p) {
                counts.latin += 1;
                continue;
            }
            if matches!(mode, Mode::Printed | Mode::Lead) && reader.printed(p, &sec, true) {
                counts.printed += 1;
                continue;
            }
            if matches!(mode, Mode::Printed | Mode::Intro) && reader.printed(p, &sec, false) {
                counts.printed += 1;
                continue;
            }
            let number = opening_number(p).and_then(|(n, _)| n);
            if mode == Mode::Own && !own.is_empty() {
                if let Some(n) = number.filter(|&n| n != v && reader.is_verse(p, b, c, n)) {
                    // A printed verse with no heading before it.
                    counts.printed += 1;
                    mode = Mode::Printed;
                    let last = vz.verses_in(b, c).unwrap_or(n);
                    sec = vz.index(b, c, n).zip(vz.index(b, c, last)).into_iter().collect();
                    intro = None;
                    continue;
                }
            }
            if matches!(mode, Mode::Printed | Mode::Intro) && number.is_some() {
                counts.printed += 1;
                continue;
            }
            if mode == Mode::Lead {
                mode = Mode::Own;
            }
            if mode == Mode::Printed {
                mode = Mode::Intro;
            }
            match mode {
                Mode::Own => {
                    if own.is_empty() {
                        if let Some(n) = number.filter(|&n| n != v && moved.is_none() && !KEEPS.contains(&(b, c, v))) {
                            wrong.push(format!("{} {c}:{v} begins with verse {n}", atlas_core::canon::BOOKS[b as usize].name));
                        }
                    }
                    own.push(p.to_string());
                }
                Mode::Intro => {
                    if let Some((f, t)) = intro {
                        counts.intros += 1;
                        let book = vz.locate(f).map_or(b, |l| l.0);
                        notes.entry((book, f, t)).or_default().push(p.to_string());
                    }
                }
                _ => {}
            }
        }
        if own.is_empty() {
            counts.empty += 1;
        } else {
            notes.entry((b, here, here)).or_default().extend(own);
        }
    }
    if !wrong.is_empty() {
        return Err(format!(
            "{CALVIN}: notes that begin with another verse's number, not in MOVES or KEEPS: {}",
            wrong.join("; ")
        ));
    }
    for ps in notes.values_mut() {
        *ps = joined(std::mem::take(ps), &mut counts);
    }
    let lines = exclude(root, vz, &mut notes, &mut counts)?;
    let text_of = |ps: &[String]| marks(&ps.join("\n\n"));
    // The Harmony on Mark and Luke.
    let covered = |b: u8, f: u32, t: u32, notes: &Notes| notes.keys().any(|&(nb, a, z)| nb == b && a <= t && f <= z);
    let mut harmony: Notes = BTreeMap::new();
    let mut harmony_who: Voices = BTreeMap::new();
    for sec in &sections {
        let Some(&(mf, mt)) = sec.iter().find(|&&(f, _)| vz.locate(f).is_some_and(|l| l.0 == MATTHEW)) else {
            continue;
        };
        let on: Vec<(u8, u32, u32)> = notes.keys().copied().filter(|&(nb, a, z)| nb == MATTHEW && a == z && mf <= a && a <= mt).collect();
        if on.is_empty() {
            continue;
        }
        for &(f, t) in sec {
            let Some((pb, pc, _)) = vz.locate(f) else { continue };
            if pb != 40 && pb != 41 {
                continue;
            }
            let last = vz.verses_in(pb, pc).and_then(|n| vz.index(pb, pc, n)).unwrap_or(t);
            let t = t.min(last);
            if covered(pb, f, t, &notes) || harmony.contains_key(&(pb, f, t)) {
                continue;
            }
            let who = format!("Calvin's notes on {}, in his Harmony of the Gospels", passage_name(vz, mf, mt));
            let mut voices = Vec::new();
            let mut left = Vec::new();
            for (k, key) in on.iter().enumerate() {
                voices.push((if k == 0 { who.clone() } else { String::new() }, notes[key].clone()));
                for l in lines.get(key).into_iter().flatten() {
                    if !left.contains(l) {
                        left.push(l.clone());
                    }
                }
            }
            harmony.insert((pb, f, t), left);
            harmony_who.insert((pb, f, t), voices);
            counts.harmony += 1;
        }
    }
    for (&(b, from, to), ps) in &notes {
        let here = b;
        items[b as usize].push(Item {
            work: CALVIN_W,
            from,
            to,
            voices: vec![(String::new(), runs(&text_of(ps), here, vz, report))],
            left: lines.get(&(b, from, to)).cloned().unwrap_or_default(),
        });
    }
    for ((b, from, to), voices) in harmony_who {
        items[b as usize].push(Item {
            work: CALVIN_W,
            from,
            to,
            voices: voices.into_iter().map(|(who, ps)| (who, runs(&text_of(&ps), MATTHEW, vz, report))).collect(),
            left: harmony.remove(&(b, from, to)).unwrap_or_default(),
        });
    }
    Ok(counts)
}

impl Counts {
    pub(super) fn line(&self) -> String {
        format!(
            "voices calvin-commentaries: {} New Testament entries read; {} section headings, {} printed verses and {} Latin paragraphs cut, {} entries ended at a closing heading or index; {} words before a section's first note placed on the section; {} entries moved to the verse their note begins with; {} broken paragraphs joined; {} entries with no note of their own; {} Harmony passages shown on Mark and Luke; {} passages left out (config/voices/calvin-commentaries.json); {} entries on 1 and 2 Timothy and Titus and {} on the Old Testament left for later",
            self.entries, self.headings, self.printed, self.latin, self.stopped, self.intros, self.moved, self.joined, self.empty, self.harmony, self.left_out, self.pastorals, self.old_testament
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verse_numbers_and_marks() {
        assert_eq!(opening_number("23. For all have sinned"), Some((Some(23), 3)));
        assert_eq!(opening_number("9 Porro glorietur"), Some((Some(9), 1)));
        assert_eq!(opening_number("l4. Knowing that shortly"), Some((Some(14), 3)));
        assert_eq!(opening_number("like a hart"), None);
        assert_eq!(opening_number("2 Corinthians"), Some((Some(2), 1)));
        assert_eq!(
            marks("in {{ref:Bible:Matt.3.13-Matt.3.17 Mark.1.9-Mark.1.11|Matthew 3:13-17; Mark 1:9-11}}."),
            "in {{ref:Matt.3.13-Matt.3.17|Matthew 3:13-17; Mark 1:9-11}}."
        );
        assert_eq!(unmarked("{{ref:Bible:Eph.5|Ephesians 5}}: 3-7"), ": 3-7");
        assert_eq!(mark_targets("{{ref:Bible:Rom.3.23-Rom.3.26|Romans 3:23-26}}"), vec!["Rom.3.23-Rom.3.26"]);
    }

    #[test]
    fn broken_paragraphs_join() {
        let mut c = Counts::default();
        let ps = vec!["And again,".to_string(), "“Taste and see.”".to_string(), "23. There is".to_string()];
        assert_eq!(joined(ps, &mut c), vec!["And again, “Taste and see.”", "23. There is"]);
        assert_eq!(c.joined, 1);
    }
}
