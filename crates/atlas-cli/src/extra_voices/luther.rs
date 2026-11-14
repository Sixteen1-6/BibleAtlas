//! Martin Luther's Commentary on the Epistle to the Galatians, abridged and
//! put into modern English by Theodore Graebner (1939), and his Lectures on
//! Genesis 1 to 9, in John Nicholas Lenker's Luther on the Creation (1904,
//! based on Henry Cole's translation) and Luther on Sin and the Flood (1910):
//! Project Gutenberg ebooks 1549, 48193 and 27978, mirrored unchanged on the
//! branches `mirror/pg-1549`, `mirror/pg-48193` and `mirror/pg-27978`.
//!
//! Each book is a run of sections under Luther's verse headings ("VERSE 6. I
//! marvel.", "V. 21b and 22. _And God saw ..._"), which place them. The
//! heading, with the words of Scripture it prints, opens its section as the
//! translator prints it; several sections in a row on the same verses are
//! one note. Before the first chapter (the translators' prefaces, Luther's
//! dedication and the front matter) and Project Gutenberg's header and
//! license are left out.
//!
//! Galatians uses the King James words, and each heading's words are found
//! in the King James text of its verses; Genesis uses the American Standard
//! Version's, and each heading's quotation is found in the ASV. On Genesis
//! 1:1 to 4:7 each note is named by its part of the book ("PART I. GOD'S
//! WORK ON THE FIRST DAY."). The first volume's sections on 4:8 and later
//! are left out, since the second volume begins there. In the second volume
//! each note is named by its section and Lenker's paragraph numbers, which
//! are taken off the paragraphs; the outlines printed before each section
//! and the translator's two footnotes are left out.
//!
//! `config/voices/luther.json` lists the letters of the copies put right,
//! the headings that name a wrong verse, and the passages left out where a
//! note says a word of Scripture is a mistake (decision 23).

use super::calvin::{exclude, Exclusion, Notes};
use super::{runs, Item, Report, BOOKS};
use crate::sources::Inputs;
use atlas_core::Versification;
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::Path;

pub(super) const GALATIANS: &str = "luther-galatians";
pub(super) const GENESIS: &str = "luther-genesis";
pub(super) const GENESIS_2: &str = "luther-genesis-2";
/// Galatians and Genesis, as numbered in the output.
pub(super) const GALATIANS_W: u8 = 9;
pub(super) const GENESIS_W: u8 = 10;
/// Luther's notes, one file for each chapter.
pub(super) const LUTHER_DIR: &str = "extras/voices/luther";
const CONFIG: &str = "config/voices/luther.json";
const GENESIS_B: u8 = 0;
const GALATIANS_B: u8 = 47;
/// Where the second Genesis volume begins.
const VOLUME_2: (u16, u16) = (4, 8);

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    format: u32,
    #[allow(dead_code)]
    about: String,
    repairs: Vec<Repair>,
    places: Vec<Place>,
    exclude: Vec<Exclusion>,
}

/// A letter the copy has wrong, put right: `find` is replaced by `to`, and
/// is found exactly once.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Repair {
    source: String,
    find: String,
    to: String,
    #[allow(dead_code)]
    why: String,
}

/// A heading that names a wrong verse, placed on the verses its words are
/// from: the heading starts with `heading`, found once.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Place {
    source: String,
    heading: String,
    chapter: u16,
    from: u16,
    to: u16,
    #[allow(dead_code)]
    why: String,
}

/// What the reader did, for the build's report.
#[derive(Default)]
pub(super) struct Counts {
    pub(super) galatians: usize,
    pub(super) genesis: usize,
    sections: usize,
    merged: usize,
    repaired: usize,
    placed: usize,
    front_lines: usize,
    parts: usize,
    titles: usize,
    lettered: usize,
    headings_out: usize,
    outline_lines: usize,
    footnotes: usize,
    anchors: usize,
    numbers: usize,
    overlap: usize,
    across: usize,
    pub(super) left_out: usize,
}

impl Counts {
    pub(super) fn line(&self) -> String {
        format!(
            "voices luther: {} notes on Galatians and {} on Genesis 1 to 9, from {} sections under Luther's headings ({} of them joined to the section before on the same verses, {} across a heading of the second Genesis volume, shown where it starts); {} letters of the copies put right and {} headings placed on the verses their words are from ({CONFIG}); {} lines before the first chapter left out; {} part headings of the first Genesis volume and {} section headings of the second used as names ({} other headings of the first left out), {} lettered headings of the second kept in the text; {} outline lines, {} footnotes and {} footnote marks left out, {} of Lenker's paragraph numbers moved to the names; {} sections of the first Genesis volume on 4:8 and later left out, the second volume holding them; {} passages left out ({CONFIG})",
            self.galatians,
            self.genesis,
            self.sections,
            self.merged,
            self.across,
            self.repaired,
            self.placed,
            self.front_lines,
            self.parts,
            self.titles,
            self.headings_out,
            self.lettered,
            self.outline_lines,
            self.footnotes,
            self.anchors,
            self.numbers,
            self.overlap,
            self.left_out
        )
    }
}

fn config(root: &Path) -> Result<Config, String> {
    let text = std::fs::read_to_string(root.join(CONFIG)).map_err(|e| format!("reading {CONFIG}: {e}"))?;
    let cfg: Config = serde_json::from_str(&text).map_err(|e| format!("{CONFIG}: {e}"))?;
    if cfg.format != 1 {
        return Err(format!("{CONFIG}: format must be 1"));
    }
    Ok(cfg)
}

/// One section under a verse heading.
#[derive(Debug, Default)]
struct Section {
    chapter: u16,
    from: u16,
    to: u16,
    /// Genesis: the part or section the note is in.
    title: String,
    /// Lenker's paragraph numbers in it, first and last.
    numbers: Option<(u32, u32)>,
    paras: Vec<String>,
}

/// The text between Project Gutenberg's START and END lines, its lines
/// without their carriage returns, after the repairs for `source`.
fn body(inputs: &Inputs, source: &str, repairs: &[Repair], used: &mut [usize]) -> Result<Vec<String>, String> {
    let path = inputs.path(source, "text");
    let bytes = std::fs::read(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let mut text = String::from_utf8(bytes).map_err(|e| format!("{source}: the copy is not UTF-8: {e}"))?.replace('\r', "");
    for (r, n) in repairs.iter().zip(used.iter_mut()) {
        if r.source != source {
            continue;
        }
        let k = text.matches(r.find.as_str()).count();
        if k != 1 {
            return Err(format!("{CONFIG}: the repair \"{}\" is in {source} {k} times, not once", r.find));
        }
        *n += 1;
        text = text.replacen(r.find.as_str(), &r.to, 1);
    }
    let lines: Vec<&str> = text.lines().collect();
    let start = lines.iter().position(|l| l.starts_with("*** START OF")).ok_or(format!("{source}: no START line"))?;
    let end = lines.iter().position(|l| l.starts_with("*** END OF")).ok_or(format!("{source}: no END line"))?;
    Ok(lines[start + 1..end].iter().map(|l| l.to_string()).collect())
}

/// The lines split into paragraphs at blank lines.
fn paragraphs(lines: &[String]) -> Vec<Vec<String>> {
    let mut out: Vec<Vec<String>> = Vec::new();
    let mut cur: Vec<String> = Vec::new();
    for l in lines {
        if l.trim().is_empty() {
            if !cur.is_empty() {
                out.push(std::mem::take(&mut cur));
            }
        } else {
            cur.push(l.clone());
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

/// A paragraph's lines as one line, its italics' underscores taken off.
fn join(lines: &[String]) -> String {
    let mut out = String::new();
    for l in lines {
        let l = l.trim();
        if !out.is_empty() && !out.ends_with("--") && !l.starts_with("--") {
            out.push(' ');
        }
        out.push_str(l);
    }
    out.replace('_', "")
}

/// The value of a Roman numeral in capitals.
fn roman(s: &str) -> Option<u16> {
    let value = |c: char| match c {
        'I' => Some(1),
        'V' => Some(5),
        'X' => Some(10),
        'L' => Some(50),
        _ => None,
    };
    let vals: Vec<u16> = s.chars().map(value).collect::<Option<_>>()?;
    if vals.is_empty() {
        return None;
    }
    let mut total = 0i32;
    for (i, &v) in vals.iter().enumerate() {
        if vals.get(i + 1).is_some_and(|&n| n > v) {
            total -= i32::from(v);
        } else {
            total += i32::from(v);
        }
    }
    u16::try_from(total).ok().filter(|&t| t > 0)
}

/// A Roman numeral and its stop at the start ("IV. "), as its length.
fn roman_prefix(s: &str) -> Option<usize> {
    let n = s.find(". ")?;
    roman(&s[..n]).map(|_| n + 2)
}

/// The verses a heading names after its label word ("VERSES 11, 12.", "V.
/// 21b and 22.", "Vs. 28-29."), as (first, last): numbers, each with an
/// optional letter for a part of the verse, joined by ", ", ",", " and " or
/// "-", and ending with a stop followed by a space or the end of the line.
fn numbers(s: &str) -> Option<(u16, u16)> {
    let b = s.as_bytes();
    let (mut i, mut first, mut last) = (0usize, u16::MAX, 0u16);
    loop {
        let start = i;
        while i < b.len() && b[i].is_ascii_digit() {
            i += 1;
        }
        let n: u16 = s.get(start..i)?.parse().ok()?;
        first = first.min(n);
        last = last.max(n);
        if i < b.len() && (b'a'..=b'e').contains(&b[i]) {
            i += 1;
        }
        let rest = &s[i..];
        if rest == "." || rest.starts_with(". ") {
            return Some((first, last));
        }
        i += [", ", ",", " and ", "-"].iter().find(|sep| rest.starts_with(**sep))?.len();
    }
}

/// Galatians: a heading line ("  VERSE 6. I marvel.").
fn galatians_heading(line: &str) -> Option<(u16, u16)> {
    if !line.starts_with(' ') {
        return None;
    }
    let s = line.trim_start();
    let rest = s.strip_prefix("VERSES ").or_else(|| s.strip_prefix("VERSE "))?;
    numbers(rest)
}

/// Genesis: a verse heading ("V. 4, 5a.", "II. Ver. 16, 17a.", "Vs. 28-29."),
/// never prose ("V. Moses has taught").
fn genesis_heading(line: &str) -> Option<(u16, u16)> {
    let read = |s: &str| {
        ["V. ", "Ver. ", "Vs. "]
            .iter()
            .find_map(|w| s.strip_prefix(w))
            .and_then(numbers)
    };
    read(line).or_else(|| roman_prefix(line).and_then(|n| read(&line[n..])))
}

/// A heading of Genesis in capitals: "PART I. ...", or a Roman numeral and
/// capitals ("IV. HOW CAIN MURDERED HIS BROTHER ...").
fn capitals(text: &str) -> bool {
    roman_prefix(text).is_some_and(|n| text[n..].chars().any(char::is_alphabetic) && !text.chars().any(char::is_lowercase))
}

/// A line of an outline: indented, and opening with its mark ("1.", "a.",
/// "(2)", "(a)", "*"); an indented quotation of verse is not.
fn outline(p: &[String]) -> bool {
    let first = &p[0];
    let t = first.trim_start();
    if t.len() == first.len() {
        return false;
    }
    let digits = t.bytes().take_while(u8::is_ascii_digit).count();
    t.starts_with("* ")
        || (digits > 0 && t[digits..].starts_with(". "))
        || (t.starts_with('(') && t.get(1..6).and_then(|x| x.find(") ")).is_some_and(|k| k > 0 && t[1..=k].bytes().all(|c| c.is_ascii_alphanumeric())))
        || (t.len() > 3 && t.as_bytes()[0].is_ascii_alphabetic() && t[1..].starts_with(". "))
}

/// Lowercase words of a text, for comparing a heading with its verses.
fn words(s: &str) -> Vec<String> {
    s.replace(['\'', '\u{2019}'], "")
        .split(|c: char| !c.is_ascii_alphabetic())
        .filter(|w| !w.is_empty())
        .map(str::to_ascii_lowercase)
        .collect()
}

/// Whether a heading's words are those of its verses: each of them is in
/// the verses' text, but for at most one in five (the translators' own
/// spelling or word, "labor", "fulfill", "helpmeet").
fn quoted_in(heading: &str, verses: &str) -> bool {
    let hw = words(&heading.replace("etc.", ""));
    let vw = words(verses);
    let missing = hw.iter().filter(|w| !vw.contains(w)).count();
    !hw.is_empty() && missing * 5 <= hw.len()
}

/// A verse heading's words of Scripture: after its label ("VERSE 6. ",
/// "II. V. 21b and 22. "), without the translator's words in brackets.
fn quotation(heading: &str) -> String {
    let digit = heading.find(|c: char| c.is_ascii_digit()).unwrap_or(0);
    let words = heading[digit..].find(". ").map_or("", |k| &heading[digit + k + 2..]);
    let mut out = String::new();
    let mut depth = 0;
    for c in words.chars() {
        match c {
            '(' => depth += 1,
            ')' => depth -= 1,
            _ if depth == 0 => out.push(c),
            _ => {}
        }
    }
    out
}

/// The sections of Galatians.
fn galatians(lines: &[String], counts: &mut Counts) -> Result<Vec<Section>, String> {
    let start = lines.iter().position(|l| l == "CHAPTER 1").ok_or(format!("{GALATIANS}: no line \"CHAPTER 1\""))?;
    counts.front_lines += lines[..start].iter().filter(|l| !l.trim().is_empty()).count();
    let mut out: Vec<Section> = Vec::new();
    let mut chapter = 0u16;
    // Text after a chapter line and before its first heading, for its first verse.
    let mut pending: Vec<String> = Vec::new();
    for p in paragraphs(&lines[start..]) {
        if let Some(c) = p[0].strip_prefix("CHAPTER ") {
            chapter = c.parse().map_err(|_| format!("{GALATIANS}: \"{}\" is not a chapter line", p[0]))?;
            continue;
        }
        let Some((from, to)) = galatians_heading(&p[0]) else {
            let text = join(&p);
            match out.last_mut() {
                Some(s) if s.chapter == chapter => s.paras.push(text),
                _ => pending.push(text),
            }
            continue;
        };
        // The heading is its indented lines; the text after it may follow
        // with no blank line.
        let k = p.iter().skip(1).position(|l| !l.starts_with(' ')).map_or(p.len(), |k| k + 1);
        let mut paras = std::mem::take(&mut pending);
        paras.push(join(&p[..k]));
        if k < p.len() {
            paras.push(join(&p[k..]));
        }
        out.push(Section { chapter, from, to, paras, ..Section::default() });
    }
    if !pending.is_empty() {
        return Err(format!("{GALATIANS}: text after the last chapter line with no heading"));
    }
    Ok(out)
}

/// The sections of one Genesis volume.
fn genesis(lines: &[String], volume: u8, counts: &mut Counts) -> Result<Vec<Section>, String> {
    let source = if volume == 1 { GENESIS } else { GENESIS_2 };
    let start = lines
        .iter()
        .position(|l| l.strip_prefix("CHAPTER ").and_then(|r| r.strip_suffix('.')).and_then(roman).is_some())
        .ok_or(format!("{source}: no chapter line"))?;
    let end = lines.iter().position(|l| l.starts_with("End of Project Gutenberg's")).ok_or(format!("{source}: no closing line"))?;
    counts.front_lines += lines[..start].iter().filter(|l| !l.trim().is_empty()).count();
    let ps = paragraphs(&lines[start..end]);
    let mut out: Vec<Section> = Vec::new();
    let (mut chapter, mut title) = (0u16, String::new());
    let mut open = false;
    // Text with no section open, and its paragraph numbers.
    let mut pending: Vec<String> = Vec::new();
    let mut pending_numbers: Option<(u32, u32)> = None;
    let mut last_number = 0u32;
    // Text left at a new part or section goes with the section before it.
    let flush = |out: &mut Vec<Section>, pending: &mut Vec<String>, numbers: &mut Option<(u32, u32)>, chapter: u16| {
        if let Some(s) = out.last_mut().filter(|s| s.chapter == chapter && !pending.is_empty()) {
            s.paras.append(pending);
            s.numbers = span(s.numbers, numbers.take());
        }
    };
    let mut i = 0;
    while i < ps.len() {
        let p = &ps[i];
        i += 1;
        let text = join(p);
        if let Some(c) = text.strip_prefix("CHAPTER ").and_then(|r| r.strip_suffix('.')).and_then(roman) {
            chapter = c;
            open = false;
            last_number = 0;
            continue;
        }
        if volume == 1 && text.starts_with("PART ") && capitals(&text[5..]) {
            counts.parts += 1;
            flush(&mut out, &mut pending, &mut pending_numbers, chapter);
            title = text;
            open = false;
            continue;
        }
        // The second volume prints each section's heading, and some of its
        // lettered parts' headings, twice: first over an outline, whose
        // lines are indented, then over the text.
        let lettered = text.len() > 3 && text.as_bytes()[0].is_ascii_uppercase() && text[1..].starts_with(". ") && genesis_heading(&text).is_none();
        if volume == 2 && (capitals(&text) || lettered) && ps.get(i).is_some_and(|q| outline(q)) {
            while i < ps.len() && outline(&ps[i]) {
                counts.outline_lines += ps[i].len();
                i += 1;
            }
            continue;
        }
        if volume == 2 && outline(p) {
            return Err(format!("{source}: chapter {chapter}: an outline line with no heading over it: \"{text}\""));
        }
        if capitals(&text) && genesis_heading(&text).is_none() {
            if volume == 2 {
                counts.titles += 1;
                flush(&mut out, &mut pending, &mut pending_numbers, chapter);
                title = text;
            } else {
                // "I. INTRODUCTION.", "II. GOD'S WORK ON THE SIX DAYS IN PARTICULAR."
                counts.headings_out += 1;
            }
            open = false;
            continue;
        }
        if lettered && volume == 2 {
            // A lettered part's heading ("A. How Cain Murdered His Brother.")
            // opens the text after it.
            counts.lettered += 1;
            open = false;
            pending.push(text);
            continue;
        }
        if text.starts_with("[Footnote ") {
            if !text.ends_with(']') {
                return Err(format!("{source}: chapter {chapter}: a footnote runs past its paragraph"));
            }
            counts.footnotes += 1;
            continue;
        }
        if let Some((from, to)) = genesis_heading(&text) {
            if volume == 1 && (chapter, from) >= VOLUME_2 {
                counts.overlap += 1 + ps[i..].iter().filter(|q| genesis_heading(&join(q)).is_some()).count();
                break;
            }
            let mut paras = std::mem::take(&mut pending);
            paras.push(text);
            out.push(Section { chapter, from, to, title: title.clone(), numbers: pending_numbers.take(), paras });
            open = true;
            continue;
        }
        // Lenker's paragraph number, and the translator's footnote marks.
        let mut text = text;
        let digits = text.bytes().take_while(u8::is_ascii_digit).count();
        if volume == 2 && digits > 0 && text[digits..].starts_with(". ") {
            let n: u32 = text[..digits].parse().map_err(|e| format!("{source}: {e}"))?;
            if n < last_number {
                return Err(format!("{source}: chapter {chapter}: paragraph {n} comes after {last_number}"));
            }
            last_number = n;
            counts.numbers += 1;
            text = text[digits + 2..].to_string();
            match out.last_mut() {
                Some(s) if open => s.numbers = span(s.numbers, Some((n, n))),
                _ => pending_numbers = span(pending_numbers, Some((n, n))),
            }
        }
        for k in 1..10 {
            let mark = format!("[{k}]");
            counts.anchors += text.matches(&mark).count();
            text = text.replace(&mark, "");
        }
        match out.last_mut() {
            Some(s) if open => s.paras.push(text),
            _ => pending.push(text),
        }
    }
    if !pending.is_empty() {
        return Err(format!("{source}: text at the end with no heading"));
    }
    Ok(out)
}

/// The first and last of two runs of paragraph numbers.
fn span(a: Option<(u32, u32)>, b: Option<(u32, u32)>) -> Option<(u32, u32)> {
    match (a, b) {
        (Some((a, y)), Some((x, z))) => Some((a.min(x), y.max(z))),
        (a, None) => a,
        (None, b) => b,
    }
}

/// A Genesis note's part or section, and Lenker's first and last paragraph numbers in it.
type Name = (String, Option<(u32, u32)>);

/// A Genesis note's name, with Lenker's paragraph numbers in it.
fn title(t: Option<Name>) -> String {
    match t {
        Some((w, Some((a, z)))) if a == z => format!("{w} (paragraph {a} in Lenker's numbering)"),
        Some((w, Some((a, z)))) => format!("{w} (paragraphs {a} to {z} in Lenker's numbering)"),
        Some((w, None)) => w,
        None => String::new(),
    }
}

/// Luther's notes, as works [`GALATIANS_W`] and [`GENESIS_W`].
pub(super) fn luther(root: &Path, inputs: &Inputs, vz: &Versification, kjv: &[String], report: &mut Report) -> Result<(Vec<Item>, Counts), String> {
    let cfg = config(root)?;
    let path = inputs.path("asv", "asv");
    let json = std::fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let asv: Vec<String> = crate::extra_translations::lines(&json, vz, "ASV")?.lines().map(str::to_string).collect();
    let mut counts = Counts::default();
    let mut used = vec![0usize; cfg.repairs.len()];
    for r in &cfg.repairs {
        if ![GALATIANS, GENESIS, GENESIS_2].contains(&r.source.as_str()) {
            return Err(format!("{CONFIG}: repair \"{}\": {} is not one of Luther's sources", r.find, r.source));
        }
    }
    let gal = galatians(&body(inputs, GALATIANS, &cfg.repairs, &mut used)?, &mut counts)?;
    let gen1 = genesis(&body(inputs, GENESIS, &cfg.repairs, &mut used)?, 1, &mut counts)?;
    let gen2 = genesis(&body(inputs, GENESIS_2, &cfg.repairs, &mut used)?, 2, &mut counts)?;
    counts.repaired = used.iter().sum();
    let mut wrong: Vec<String> = Vec::new();
    let mut placed = vec![0usize; cfg.places.len()];
    let mut notes: Notes = BTreeMap::new();
    let mut titles: BTreeMap<(u8, u32, u32), Name> = BTreeMap::new();
    for (source, b, sections) in [(GALATIANS, GALATIANS_B, gal), (GENESIS, GENESIS_B, gen1), (GENESIS_2, GENESIS_B, gen2)] {
        let lines = if b == GALATIANS_B { kjv } else { &asv };
        let mut prev: Option<(u16, u16, u16, String)> = None;
        let mut last_key: Option<(u8, u32, u32)> = None;
        for mut s in sections {
            counts.sections += 1;
            let head = s.paras.iter().find(|p| if b == GALATIANS_B { p.starts_with("VERSE") } else { genesis_heading(p).is_some() }).cloned().unwrap_or_default();
            for (x, n) in cfg.places.iter().zip(placed.iter_mut()) {
                if x.source == source && head.starts_with(&x.heading) {
                    *n += 1;
                    (s.chapter, s.from, s.to) = (x.chapter, x.from, x.to);
                }
            }
            let at = format!("{source}: {} {}:{}-{}", BOOKS[b as usize].name, s.chapter, s.from, s.to);
            let (Some(from), Some(to)) = (vz.index(b, s.chapter, s.from), vz.index(b, s.chapter, s.to)) else {
                return Err(format!("{at} is not in the Bible"));
            };
            if from > to {
                return Err(format!("{at}: the heading's verses are out of order"));
            }
            // The heading's words, against the verses it names.
            let quoted = quotation(&head);
            let text: Vec<&str> = (from..=to).map(|v| lines[v as usize].as_str()).collect();
            if !quoted_in(&quoted, &text.join(" ")) {
                wrong.push(format!("{at}: the heading \"{head}\" is not the words of its verses"));
            }
            if let Some((c, f, _, _)) = &prev {
                if (s.chapter, s.from) < (*c, *f) {
                    wrong.push(format!("{at}: the heading comes after one on {c}:{f}"));
                }
            }
            let key = (b, from, to);
            let same = prev.as_ref().is_some_and(|(c, f, t, w)| (*c, *f, *t) == (s.chapter, s.from, s.to) && *w == s.title);
            prev = Some((s.chapter, s.from, s.to, s.title.clone()));
            if same && last_key == Some(key) {
                counts.merged += 1;
                notes.get_mut(&key).expect("the note before").append(&mut s.paras);
                // The paragraph numbers run on.
                let (_, n) = titles.get_mut(&key).expect("the note before");
                *n = span(*n, s.numbers);
                continue;
            }
            if let Some((w, n)) = titles.get_mut(&key) {
                // A new section of the second volume that begins on the verse
                // the last one ended on: one note, the new section's heading
                // shown where it starts.
                if *w == s.title || last_key != Some(key) {
                    wrong.push(format!("{at}: a second note on the same verses, not next to the first"));
                    continue;
                }
                counts.across += 1;
                *n = span(*n, s.numbers);
                let ps = notes.get_mut(&key).expect("the note");
                ps.push(s.title.clone());
                ps.append(&mut s.paras);
                continue;
            }
            last_key = Some(key);
            notes.insert(key, s.paras);
            titles.insert(key, (s.title, s.numbers));
        }
    }
    for (x, n) in cfg.places.iter().zip(&placed) {
        if *n != 1 {
            wrong.push(format!("the heading \"{}\" is found {n} times, not once", x.heading));
        }
    }
    counts.placed = placed.iter().sum();
    if !wrong.is_empty() {
        return Err(format!("{CONFIG}: {}", wrong.join("; ")));
    }
    let (lines, left_out) = exclude(CONFIG, "Luther", &cfg.exclude, vz, &mut notes)?;
    counts.left_out = left_out;
    let mut items = Vec::with_capacity(notes.len());
    for ((b, from, to), ps) in notes {
        let work = if b == GALATIANS_B { GALATIANS_W } else { GENESIS_W };
        if work == GALATIANS_W {
            counts.galatians += 1;
        } else {
            counts.genesis += 1;
        }
        items.push(Item {
            work,
            from,
            to,
            voices: vec![(title(titles.remove(&(b, from, to))), runs(&ps.join("\n\n"), b, vz, report))],
            left: lines.get(&(b, from, to)).cloned().unwrap_or_default(),
        });
    }
    Ok((items, counts))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_luthers_headings() {
        assert_eq!(galatians_heading("  VERSE 6. I marvel."), Some((6, 6)));
        assert_eq!(galatians_heading("  VERSES 15, 16, 17. But when"), Some((15, 17)));
        assert_eq!(galatians_heading("  VERSES 4,5. But when"), Some((4, 5)));
        assert_eq!(galatians_heading("  VERSES 8 and 9. But"), Some((8, 9)));
        assert_eq!(galatians_heading("VERSE 6. Not indented"), None);
        assert_eq!(genesis_heading("V. 4, 5a. _These are"), Some((4, 5)));
        assert_eq!(genesis_heading("I. V. 1. _In the beginning"), Some((1, 1)));
        assert_eq!(genesis_heading("III. V. 21b and 22. _And God saw"), Some((21, 22)));
        assert_eq!(genesis_heading("II. Ver. 16, 17a. _And Jehovah"), Some((16, 17)));
        assert_eq!(genesis_heading("Vs. 28-29. _And Noah lived"), Some((28, 29)));
        assert_eq!(genesis_heading("V. 5b, 6. _For Jehovah"), Some((5, 6)));
        assert_eq!(genesis_heading("V. Moses has taught"), None);
        assert_eq!(genesis_heading("II. But it is more worthy"), None);
        assert!(capitals("IV. HOW CAIN MURDERED HIS BROTHER AND WAS REQUIRED TO GIVE AN ACCOUNT,"));
        assert!(capitals("III. ALLEGORIES 69-132."));
        assert!(!capitals("II. But it is more worthy") && !capitals("A. How Cain Murdered His Brother."));
        assert_eq!(roman("XIV"), Some(14));
        assert_eq!(join(&["a word--".to_string(), "and _this_".to_string()]), "a word--and this");
        assert!(quoted_in("I marvel that ye are so soon removed.", "I marvel that ye are so soon removed from him"));
        assert!(!quoted_in("And Jehovah said unto Noah, Come thou", "Of every clean beast thou shalt take"));
        assert_eq!(quotation("V. 4a. The Nephilim (giants) were in the earth"), "The Nephilim  were in the earth");
        assert_eq!(quotation("II. V. 21b and 22. And God saw"), "And God saw");
    }
}
