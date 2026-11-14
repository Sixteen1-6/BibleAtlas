//! C. F. Keil and F. Delitzsch, Biblical Commentary on the Old Testament
//! (English, Edinburgh: T. and T. Clark, 1864 to 1878), from the CrossWire
//! SWORD module KD 2.0, whose text came from Wikisource, mirrored unchanged
//! on the branch `mirror/sword-KD` (`kd-commentary`), read by
//! [`super::sword`].
//!
//! The module gives each passage the commentary treats together one entry,
//! linked over its verses. Most entries open with the passage's own range
//! label (a reference mark, "Gen 1:2-5", or the same written out, "Num
//! 1:4-16"), which places it and is not shown. A book's first entry holds
//! the introduction to the book (and on Genesis, Joshua, 1 Chronicles,
//! Isaiah and Hosea one to a group of books first); where its comment on
//! the book's text starts is written in `config/voices/keil-delitzsch.json`
//! (`starts`), found by its words, and what comes before is left out. Every
//! other entry is shown whole, its section headings with it.
//!
//! The two writers each wrote whole books, as the T. and T. Clark title
//! pages name them (`writers`, with the evidence of each). Delitzsch's
//! Ecclesiastes is left out whole (`books_out`), because he holds that
//! Solomon did not write it; the passages left out where a note denies what
//! the text says of its writer, or says a word of Scripture is a mistake,
//! are in `exclude` (decision 23).

use super::calvin::{exclude, Exclusion, Notes};
use super::{runs, sword, Item, Report, BOOKS};
use atlas_core::Versification;
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

pub(super) const KD: &str = "kd-commentary";
pub(super) const KD_W: u8 = 7;
/// Its notes, one file for each chapter.
pub(super) const KD_DIR: &str = "extras/voices/kd";
const CONFIG: &str = "config/voices/keil-delitzsch.json";
/// One chapter's entries: each first verse, with its last verse and paragraphs.
type Chapter = BTreeMap<u16, (u16, Vec<sword::Para>)>;
/// A marked title longer than this is not shown as a heading.
const HEADING_CHARS: usize = 400;
/// What stands for a Hebrew word the copy keeps only in an old font's code.
pub(super) const ILLEGIBLE: &str = "[Hebrew word not legible in this copy]";

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    format: u32,
    #[allow(dead_code)]
    about: String,
    writers: Vec<Writer>,
    starts: Vec<Start>,
    books_out: Vec<BookOut>,
    exclude: Vec<Exclusion>,
}

/// Which of the two wrote a set of books, from a dated title page.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Writer {
    books: Vec<String>,
    writer: String,
    /// Where the title page was read: an evidence file and its entry.
    checked: String,
}

/// Where a book's first entry stops introducing the book and starts its comment.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Start {
    book: String,
    /// The comment's first words, found once in the entry; none where the
    /// entry is only an introduction.
    words: Option<String>,
    #[allow(dead_code)]
    why: String,
}

/// A book whose notes are all left out.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct BookOut {
    id: String,
    book: String,
    /// Words of the claim, found once in the book's first entry.
    words: String,
    #[allow(dead_code)]
    why: String,
    #[allow(dead_code)]
    decided: String,
}

/// What the reader did, for the build's report.
#[derive(Default)]
pub(super) struct Counts {
    pub(super) notes: usize,
    entries: usize,
    intros: usize,
    intro_chars: usize,
    labels: usize,
    headings: usize,
    chapter_entries: usize,
    feet: usize,
    hebrew_numbers: usize,
    illegible: Vec<String>,
    books_out: usize,
    pub(super) left_out: usize,
    dropped: BTreeMap<String, usize>,
}

impl Counts {
    pub(super) fn line(&self) -> String {
        let dropped: Vec<String> = self.dropped.iter().map(|(k, n)| format!("{n} <{k}>")).collect();
        format!(
            "voices kd: {} notes from {} entries; {} introductions ({} characters) left out; {} range labels not shown; {} headings over a note; {} chapter entries placed on their first verse; {} footnotes; {} \"Hebrew_Bible_\" shown as \"Hebrew Bible \"; {} Hebrew words not legible in this copy ({}); {} book left out whole and {} passages left out ({CONFIG}); tags dropped with their words kept: {}",
            self.notes,
            self.entries,
            self.intros,
            self.intro_chars,
            self.labels,
            self.headings,
            self.chapter_entries,
            self.feet,
            self.hebrew_numbers,
            self.illegible.len(),
            if self.illegible.is_empty() { "none".to_string() } else { self.illegible.join(", ") },
            self.books_out,
            self.left_out,
            if dropped.is_empty() { "none".to_string() } else { dropped.join(", ") }
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

fn book(name: &str) -> Result<u8, String> {
    BOOKS.iter().position(|x| x.name == name).map(|b| b as u8).ok_or(format!("{CONFIG}: {name} is not a book"))
}

/// Who wrote each Old Testament book, by book index; every one must be named once.
fn writers_of(cfg: &Config) -> Result<BTreeMap<u8, String>, String> {
    let mut out = BTreeMap::new();
    for w in &cfg.writers {
        if w.writer.trim().is_empty() || w.checked.trim().is_empty() || w.writer.contains('\u{2014}') {
            return Err(format!("{CONFIG}: each writer needs a name and where the title page was read"));
        }
        for name in &w.books {
            let b = book(name)?;
            if b >= 39 || out.insert(b, w.writer.clone()).is_some() {
                return Err(format!("{CONFIG}: {name} is named twice or is not in the Old Testament"));
            }
        }
    }
    if out.len() != 39 {
        return Err(format!("{CONFIG}: {} of the 39 Old Testament books have a writer", out.len()));
    }
    Ok(out)
}

/// Who wrote each book, grouped by writer, for the index file.
pub(super) fn writers(root: &Path) -> Result<Vec<(String, Vec<u8>)>, String> {
    let mut by: Vec<(String, Vec<u8>)> = Vec::new();
    for (b, w) in writers_of(&config(root)?)? {
        match by.iter_mut().find(|(n, _)| *n == w) {
            Some((_, bs)) => bs.push(b),
            None => by.push((w, vec![b])),
        }
    }
    Ok(by)
}

fn squash(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// A range label at the start of a paragraph that covers `(c, v)` of book
/// `osis`: a reference mark ("{{ref:Gen.1.2-Gen.1.5|Gen 1:2-5}}"), or the
/// same written out with a capital or a number after it ("Num 1:4-16 Moses
/// and", "Job 25:1-6 1 Then began"). Gives
/// the label's length with the spaces after it.
fn range_label(p: &str, osis: &str, c: u16, v: u16) -> Option<usize> {
    if let Some(rest) = p.strip_prefix("{{ref:") {
        let target = &rest[..rest.find('|')?];
        let end = 6 + rest.find("}}")? + 2;
        let (a, z) = target.split_once('-').unwrap_or((target, target));
        let part = |s: &str| -> Option<(String, u16, u16)> {
            let mut it = s.rsplitn(3, '.');
            let v = it.next()?.parse().ok()?;
            let ch = it.next()?.parse().ok()?;
            Some((it.next()?.to_string(), ch, v))
        };
        let (ba, ca, va) = part(a)?;
        let (bz, cz, vz) = part(z)?;
        let covers = ba == osis && bz == osis && (ca, va) <= (c, v) && (c, v) <= (cz, vz);
        // A mark whose target the copy got wrong ("Job.35.14-Job.16.14") but whose
        // words name this verse first ("Job 35:14-16 14").
        let label = &rest[rest.find('|')? + 1..rest.find("}}")?];
        let named = label.split_once(' ').is_some_and(|(_, n)| n.split(['-', ' ']).next() == Some(format!("{c}:{v}").as_str()));
        // Its own label, or a mark that is a whole paragraph (a label that places it).
        if covers || named || end == p.len() {
            return Some(end + (p.len() - end - p[end..].trim_start().len()));
        }
        return None;
    }
    // Written out: a book abbreviation, a space, chapter:verse(-verse), then a capital.
    let (abbr, rest) = p.split_once(' ')?;
    let a = abbr.trim_start_matches(['1', '2', '3']);
    if a.len() < 2 || a.len() > 4 || !a.starts_with(|ch: char| ch.is_ascii_uppercase()) || !a[1..].bytes().all(|ch| ch.is_ascii_lowercase()) {
        return None;
    }
    let nums_end = rest.find(|ch: char| !(ch.is_ascii_digit() || matches!(ch, ':' | '-' | '\u{2013}'))).unwrap_or(rest.len());
    let nums = &rest[..nums_end];
    if !nums.contains(':') || !nums.starts_with(|ch: char| ch.is_ascii_digit()) {
        return None;
    }
    let after = &rest[nums_end..];
    let next = after.trim_start();
    if !(next.is_empty() || (after.len() > next.len() && next.starts_with(|ch: char| ch.is_uppercase() || ch.is_ascii_digit() || matches!(ch, '\u{201c}' | '"' | '(')))) {
        return None;
    }
    Some(p.len() - next.len())
}

/// A word in the old font's code ("„YNŠJR", "RTAbF"): letters with the
/// code's own marks.
fn coded(word: &str) -> bool {
    word.chars().any(|c| matches!(c, '\u{201e}' | '\u{2dc}' | '\u{2c6}' | '\u{2039}' | '\u{160}'))
        && word.chars().any(|c| c.is_ascii_uppercase())
}

pub(super) fn kd(root: &Path, inputs: &crate::sources::Inputs, vz: &Versification, report: &mut Report) -> Result<(Vec<Item>, Counts), String> {
    let cfg = config(root)?;
    writers_of(&cfg)?;
    let (conf, entries) = sword::read(inputs, KD, vz)?;
    if conf.license != "Public Domain" || conf.source_type != "OSIS" || conf.version != "2.0" || conf.date != "2022-08-03" {
        return Err(format!(
            "{KD}: the conf says {} {} {} {}; expected Public Domain, OSIS, version 2.0 of 2022-08-03",
            conf.license, conf.source_type, conf.version, conf.date
        ));
    }
    let mut starts: BTreeMap<u8, Option<String>> = BTreeMap::new();
    for s in &cfg.starts {
        if starts.insert(book(&s.book)?, s.words.as_deref().map(squash)).is_some() {
            return Err(format!("{CONFIG}: {} has two starts", s.book));
        }
    }
    if starts.len() != 39 {
        return Err(format!("{CONFIG}: {} of the 39 books have a start", starts.len()));
    }
    let mut out_books: BTreeMap<u8, &BookOut> = BTreeMap::new();
    for x in &cfg.books_out {
        if x.id.is_empty() || x.decided.trim().is_empty() {
            return Err(format!("{CONFIG}: {} needs an id and who decided it", x.book));
        }
        out_books.insert(book(&x.book)?, x);
    }
    let mut counts = Counts::default();
    let mut firsts: BTreeSet<u8> = BTreeSet::new();
    // Each chapter's notes by first verse: (last verse, paragraphs).
    let mut pieces: BTreeMap<(u8, u16), Chapter> = BTreeMap::new();
    let mut leads: Vec<(u8, u16, Vec<sword::Para>)> = Vec::new();
    let mut wrong: Vec<String> = Vec::new();
    for e in entries {
        let (b, c, v, to) = match e.slot {
            sword::Slot::Verse(b, c, v) => (b, c, v, e.to),
            sword::Slot::Chapter(b, c) => (b, c, 0, 0),
            _ => continue,
        };
        let osis = BOOKS[b as usize].osis;
        let at = format!("{} {c}:{v}", BOOKS[b as usize].name);
        let mut ps = sword::osis(&e.text, &mut counts.dropped);
        ps.retain(|p| !p.text.trim_matches('\u{feff}').trim().is_empty());
        if ps.is_empty() {
            continue;
        }
        counts.feet += ps.iter().filter(|p| p.title.is_none() && p.text.starts_with('[') && p.text[1..].starts_with(|ch: char| ch.is_ascii_digit())).count();
        // A book's first entry: its introduction, then (mostly) its comment.
        if v > 0 && firsts.insert(b) {
            if let Some(x) = out_books.get(&b) {
                let all: String = ps.iter().map(|p| p.text.as_str()).collect::<Vec<_>>().join(" ");
                if all.matches(&squash(&x.words)).count() != 1 {
                    return Err(format!("{CONFIG}: {}: its words are not found once in {}'s first entry", x.id, x.book));
                }
            }
            let start = starts.get(&b).cloned().flatten();
            let all_chars: usize = ps.iter().map(|p| p.text.len()).sum();
            let Some(words) = start else {
                counts.intros += 1;
                counts.intro_chars += all_chars;
                continue;
            };
            let found: Vec<(usize, usize)> = ps.iter().enumerate().flat_map(|(i, p)| p.text.match_indices(words.as_str()).map(move |(k, _)| (i, k))).collect();
            if found.len() != 1 {
                return Err(format!("{CONFIG}: the start of {} is in its first entry {} times, not once", BOOKS[b as usize].name, found.len()));
            }
            let (i, k) = found[0];
            ps.drain(..i);
            ps[0].text = ps[0].text[k..].to_string();
            counts.intros += 1;
            counts.intro_chars += all_chars - ps.iter().map(|p| p.text.len()).sum::<usize>();
        }
        // The label that places the entry, where it opens it.
        if let Some(n) = ps.iter().position(|p| p.title.is_none()).and_then(|i| range_label(&ps[i].text, osis, c, v.max(1)).map(|n| (i, n))) {
            let (i, n) = n;
            counts.labels += 1;
            ps[i].text = ps[i].text[n..].trim_start_matches([' ', '-', '.', ',', ':']).trim().to_string();
            if ps[i].text.is_empty() {
                ps.remove(i);
            }
        }
        if ps.is_empty() {
            continue;
        }
        counts.entries += 1;
        if v == 0 {
            // Exodus 17's chapter entry opens its first verse's note.
            counts.chapter_entries += 1;
            leads.push((b, c, ps));
            continue;
        }
        let chapter = pieces.entry((b, c)).or_default();
        if chapter.insert(v, (to.max(v), ps)).is_some() {
            wrong.push(format!("{at}: two entries open on this verse"));
        }
    }
    for (b, c, ps) in leads {
        let chapter = pieces.entry((b, c)).or_default();
        let first = chapter.entry(1).or_insert((1, Vec::new()));
        first.1.splice(0..0, ps);
    }
    if !wrong.is_empty() {
        return Err(format!("{KD}: {}", wrong.join("; ")));
    }
    let mut notes: Notes = BTreeMap::new();
    let mut heads: BTreeMap<(u8, u32, u32), String> = BTreeMap::new();
    for ((b, c), chapter) in pieces {
        if out_books.contains_key(&b) {
            continue;
        }
        for (v, (to, mut all)) in chapter {
            let (Some(from), Some(to)) = (vz.index(b, c, v), vz.index(b, c, to)) else {
                return Err(format!("{KD}: {} {c}:{v}-{to} is not in the Bible", BOOKS[b as usize].name));
            };
            let head = match all.first() {
                Some(x) if x.title.is_some() && all.len() > 1 && x.text.len() < HEADING_CHARS => {
                    counts.headings += 1;
                    all.remove(0).text
                }
                _ => String::new(),
            };
            let mut texts: Vec<String> = Vec::with_capacity(all.len());
            for x in all {
                // The copy's wiki code for the Hebrew Bible's own numbering ("(Hebrew_Bible_42:2-6)").
                counts.hebrew_numbers += x.text.matches("Hebrew_Bible_").count();
                let text = x.text.replace("Hebrew_Bible_", "Hebrew Bible ");
                let words: Vec<&str> = text.split(' ').collect();
                if words.iter().any(|w| coded(w)) {
                    counts.illegible.push(format!("{} {c}:{v}", BOOKS[b as usize].name));
                }
                let text = words.into_iter().map(|w| if coded(w) { ILLEGIBLE } else { w }).collect::<Vec<_>>().join(" ");
                // The dash that joined a heading to its first words ("- 1Ki 11:1, 1Ki 11:2.").
                texts.push(if texts.is_empty() { text.trim_start_matches(['-', ' ', '.', ',', ';', ':']).to_string() } else { text });
            }
            notes.insert((b, from, to), texts);
            heads.insert((b, from, to), head);
        }
    }
    let (lines, left_out) = exclude(CONFIG, "Keil and Delitzsch", &cfg.exclude, vz, &mut notes)?;
    counts.left_out = left_out;
    // A book left out whole has no notes, so the line never names its writer
    // there; the panel's "How these are chosen" says why.
    counts.books_out = out_books.len();
    let mut items = Vec::with_capacity(notes.len());
    for ((b, from, to), ps) in notes {
        counts.notes += 1;
        let head = heads.remove(&(b, from, to)).unwrap_or_default();
        items.push(Item {
            work: KD_W,
            from,
            to,
            voices: vec![(head, runs(&ps.join("\n\n"), b, vz, report))],
            left: lines.get(&(b, from, to)).cloned().unwrap_or_default(),
        });
    }
    Ok((items, counts))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_range_labels() {
        fn r(p: &str) -> Option<&str> {
            range_label(p, "Num", 1, 4).map(|n| &p[n..])
        }
        assert_eq!(r("{{ref:Num.1.4-Num.1.16|Num 1:4-16}} Moses and Aaron"), Some("Moses and Aaron"));
        assert_eq!(r("{{ref:Num.1.4-Num.1.16|Num 1:4-16}}"), Some(""));
        assert_eq!(r("Num 1:4-16 Moses and Aaron"), Some("Moses and Aaron"));
        assert_eq!(r("Num 1:4-16"), Some(""));
        assert_eq!(r("Num 1:4-16 4 Then"), Some("4 Then"));
        // A sentence about a verse, or a mark to another passage inside a sentence, is not a label.
        assert_eq!(r("Num 1:4 shows that"), None);
        assert_eq!(r("{{ref:Gen.1.2|Gen 1:2}} says that"), None);
        assert_eq!(r("{{ref:Num.1.4-Num.16.4|Num 1:4-16 4}} Moses"), Some("Moses"));
        assert_eq!(r("Vers. 1-7. Birth of Isaac"), None);
        assert!(coded("„YNŠJR") && coded("RQEˆ˜a") && !coded("Šamaš") && !coded("RTAbF") && !coded("šarada"));
    }
}
