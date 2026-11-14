//! Matthew Henry's complete commentary, An Exposition of the Old and New
//! Testament (1708–10), finished after his death in 1714 from Romans to
//! Revelation by other ministers, from the CrossWire SWORD module MHC as kept
//! in the Let's Church repository (`henry-complete`).
//!
//! Each entry is one of Henry's sections: a title (often the chapter's, as
//! "The Creation. (b. c. 4004.)"), the King James verses it covers, printed in
//! one paragraph that starts with the first verse's number, then his comment.
//! The reader keeps the title and the comment, placed on the verses the
//! section prints. Left out: the printed verses, whatever comes before the
//! title (the prefaces to volumes and books, and the chapter outlines), the
//! entries on a verse 0 (the chapter introductions and outlines) and the five
//! title-only chapter entries. The build fails on an entry whose printed
//! verses cannot be found, or whose printed paragraph is not the KJV's words.
//!
//! Henry wrote Genesis to Acts (work [`FULL_W`]); Romans to Revelation were
//! written by the ministers who finished the work, so their notes are a work
//! of their own ([`FINISH_W`]) and are never credited to Henry. Who wrote each
//! book is in `config/voices/henry-complete.json` (`finished`), from a dated
//! printed list; a book no list names is credited to "a minister who finished
//! Matthew Henry's commentary". That file also lists the passages left out
//! where a note says a word of Scripture is a mistake (decision 23).
//!
//! Output: one file per chapter, `extras/voices/full/<Book>.<chapter>.json`
//! (`{format, items}`, items as in the other part files), fetched only when a
//! reader opens the writers' notes on that chapter. The chapters are large
//! (a median of about 24 KB, Psalm 119 about 190 KB), so they are kept apart
//! from the part files the other works share.

use super::calvin::{exclude, Exclusion, Notes};
use super::{entries, place, runs, verse_marks, Item, Report, BOOKS};
use atlas_core::Versification;
use serde::Deserialize;
use std::collections::{BTreeMap, HashSet};
use std::path::Path;

pub(super) const HENRY_FULL: &str = "henry-complete";
/// Henry's own notes, Genesis to Acts.
pub(super) const FULL_W: u8 = 4;
/// The notes of the ministers who finished his work, Romans to Revelation.
pub(super) const FINISH_W: u8 = 5;
pub(super) const FULL_DIR: &str = "extras/voices/full";
const CONFIG: &str = "config/voices/henry-complete.json";
const ROMANS: u8 = 44;
/// Entries whose printed verses start after the entry's verse: (book, chapter,
/// the entry's verse, the first printed verse).
const STARTS: [(u8, u16, u16, u16); 3] = [(17, 28, 12, 14), (23, 46, 13, 12), (64, 1, 16, 15)];
/// Entries that are only the printed verses, with no comment of Henry's (his
/// comment on Genesis 19:15-23 is in the entry before).
const PRINTED_ONLY: [(u8, u16, u16); 1] = [(0, 19, 15)];
/// The least share of a printed paragraph's words that must be the KJV's
/// words of its verses.
const KJV_SHARE: f64 = 0.85;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    format: u32,
    #[allow(dead_code)]
    about: String,
    finished: Vec<Finisher>,
    exclude: Vec<Exclusion>,
}

/// Who wrote a book's exposition after Henry's death, from a printed list.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Finisher {
    books: Vec<String>,
    writer: String,
    /// Where the printed list was read: an evidence file and its entry.
    checked: String,
}

/// What the reader did, for the build's report.
#[derive(Default)]
pub(super) struct Counts {
    pub(super) sections: usize,
    intro_entries: usize,
    before_title: usize,
    before_chars: usize,
    untitled: usize,
    clamped: usize,
    printed_only: usize,
    pub(super) left_out: usize,
    by_henry: usize,
    by_others: usize,
}

impl Counts {
    pub(super) fn line(&self) -> String {
        format!(
            "voices henry-complete: {} sections ({} Genesis to Acts by Henry, {} Romans to Revelation by the ministers who finished it); {} introduction entries and {} paragraphs before a section's title ({} characters) left out; {} sections with no title; {} entries of printed verses only; {} ranges cut to the chapter; {} passages left out ({CONFIG})",
            self.sections, self.by_henry, self.by_others, self.intro_entries, self.before_title, self.before_chars, self.untitled, self.printed_only, self.clamped, self.left_out
        )
    }
}

/// Lowercase words, letters only.
fn lower_words(p: &str) -> Vec<String> {
    p.split(|c: char| !c.is_ascii_alphabetic()).filter(|w| !w.is_empty()).map(str::to_ascii_lowercase).collect()
}

/// The verse numbers that start verses in a printed paragraph, in order: a
/// number after a space (or at the start) and before a capital or "(", each
/// greater than the last. A verse that opens with a small letter has no
/// number the reader can see, so numbers may skip.
fn printed_numbers(p: &str, first: u16) -> Vec<u16> {
    let b = p.as_bytes();
    let mut out: Vec<u16> = Vec::new();
    let mut i = 0;
    while i < b.len() {
        if b[i].is_ascii_digit() && (i == 0 || b[i - 1] == b' ') {
            let mut j = i;
            while j < b.len() && b[j].is_ascii_digit() {
                j += 1;
            }
            let next_word = j + 1 < b.len() && b[j] == b' ' && (b[j + 1].is_ascii_uppercase() || b[j + 1] == b'(');
            if next_word {
                if let Ok(n) = p[i..j].parse::<u16>() {
                    if n >= first && out.last().is_none_or(|&l| n > l) {
                        out.push(n);
                    }
                }
            }
            i = j;
        } else {
            i += 1;
        }
    }
    out
}

/// A paragraph with each reference mark ("{{ref:Gen.1.1|v. 1}}") as its label.
fn labels(p: &str) -> String {
    let mut out = String::with_capacity(p.len());
    let mut rest = p;
    while let Some(i) = rest.find("{{") {
        out.push_str(&rest[..i]);
        let Some(e) = rest[i..].find("}}") else { break };
        let mark = &rest[i + 2..i + e];
        out.push_str(mark.split_once('|').map_or("", |(_, l)| l));
        rest = &rest[i + e + 2..];
    }
    out.push_str(rest);
    out
}

/// Who wrote each book from Romans on, by book index, from the config.
fn finishers(cfg: &Config) -> Result<BTreeMap<u8, String>, String> {
    let mut out = BTreeMap::new();
    for f in &cfg.finished {
        if f.writer.trim().is_empty() || f.checked.trim().is_empty() || f.writer.contains('\u{2014}') {
            return Err(format!("{CONFIG}: each finisher needs a writer and where the list was read"));
        }
        for name in &f.books {
            let b = BOOKS.iter().position(|x| x.name == name).ok_or(format!("{CONFIG}: {name} is not a book"))? as u8;
            if b < ROMANS {
                return Err(format!("{CONFIG}: Henry wrote {name} himself"));
            }
            if out.insert(b, f.writer.clone()).is_some() {
                return Err(format!("{CONFIG}: {name} is named twice"));
            }
        }
    }
    Ok(out)
}

/// The finishers, by book index, for the index file.
pub(super) fn finished(root: &Path) -> Result<Vec<(u8, String)>, String> {
    Ok(finishers(&config(root)?)?.into_iter().collect())
}

fn config(root: &Path) -> Result<Config, String> {
    let text = std::fs::read_to_string(root.join(CONFIG)).map_err(|e| format!("reading {CONFIG}: {e}"))?;
    let cfg: Config = serde_json::from_str(&text).map_err(|e| format!("{CONFIG}: {e}"))?;
    if cfg.format != 1 {
        return Err(format!("{CONFIG}: format must be 1"));
    }
    Ok(cfg)
}

pub(super) fn henry_full(
    root: &Path,
    inputs: &crate::sources::Inputs,
    vz: &Versification,
    kjv: &[String],
    report: &mut Report,
) -> Result<(Vec<Item>, Counts), String> {
    let cfg = config(root)?;
    finishers(&cfg)?;
    let mut counts = Counts::default();
    let mut notes: Notes = BTreeMap::new();
    let mut titles: BTreeMap<(u8, u32, u32), String> = BTreeMap::new();
    let mut wrong: Vec<String> = Vec::new();
    for e in entries(inputs, HENRY_FULL, "mhc")? {
        let Some((b, c, v)) = place(&e) else {
            report.unplaced += 1;
            continue;
        };
        if v == 0 || c == 0 {
            counts.intro_entries += 1;
            continue;
        }
        let Some(last) = vz.verses_in(b, c) else {
            report.unplaced += 1;
            continue;
        };
        let at = format!("{} {c}:{v}", BOOKS[b as usize].name);
        let body = e["body"].as_str().unwrap_or("");
        let ps: Vec<&str> = body.split("\n\n").collect();
        let first = STARTS.iter().find(|&&(sb, sc, sv, _)| (sb, sc, sv) == (b, c, v)).map_or(v, |&(.., s)| s);
        let lead = format!("{first} ");
        let Some(i) = ps.iter().position(|p| p.starts_with(&lead)) else {
            wrong.push(format!("{at}: no printed verses"));
            continue;
        };
        // A verse number the copy wrongly made part of a link ("{{ref:Jas.14|James. 14}}") still counts.
        let printed = labels(ps[i]);
        let nums = printed_numbers(&printed, first);
        let end = *nums.last().unwrap_or(&first);
        if end > last {
            counts.clamped += 1;
        }
        let end = end.clamp(first, last);
        // The printed paragraph is the KJV's words of those verses.
        let (Some(from), Some(to), Some(pf)) = (vz.index(b, c, v.min(first)), vz.index(b, c, end), vz.index(b, c, first)) else {
            report.unplaced += 1;
            continue;
        };
        let vocab: HashSet<String> = (pf..=to).filter_map(|k| kjv.get(k as usize)).flat_map(|l| lower_words(l)).collect();
        let ws = lower_words(&printed);
        let share = if ws.is_empty() { 0.0 } else { ws.iter().filter(|w| vocab.contains(w.as_str())).count() as f64 / ws.len() as f64 };
        if share < KJV_SHARE {
            wrong.push(format!("{at}: its printed verses are {:.0}% the KJV's words", share * 100.0));
            continue;
        }
        let title = if i > 0 { ps[i - 1].trim().to_string() } else { String::new() };
        if title.is_empty() {
            counts.untitled += 1;
        }
        if i > 1 {
            counts.before_title += i - 1;
            counts.before_chars += ps[..i - 1].iter().map(|p| p.len()).sum::<usize>();
        }
        let comment: Vec<String> = ps[i + 1..].iter().map(|p| p.trim()).filter(|p| !p.is_empty()).map(str::to_string).collect();
        if comment.is_empty() {
            if PRINTED_ONLY.contains(&(b, c, v)) {
                counts.printed_only += 1;
            } else {
                wrong.push(format!("{at}: no comment after the printed verses"));
            }
            continue;
        }
        if notes.insert((b, from, to), comment).is_some() {
            wrong.push(format!("{at}: two sections on the same verses"));
        }
        titles.insert((b, from, to), title);
    }
    if !wrong.is_empty() {
        return Err(format!("{HENRY_FULL}: {}", wrong.join("; ")));
    }
    let (lines, left_out) = exclude(CONFIG, "Matthew Henry's commentary", &cfg.exclude, vz, &mut notes)?;
    counts.left_out = left_out;
    let mut items = Vec::with_capacity(notes.len());
    for ((b, from, to), ps) in notes {
        let work = if b < ROMANS { FULL_W } else { FINISH_W };
        if work == FULL_W {
            counts.by_henry += 1;
        } else {
            counts.by_others += 1;
        }
        counts.sections += 1;
        let title = titles.remove(&(b, from, to)).unwrap_or_default();
        items.push((
            b,
            Item {
                work,
                from,
                to,
                voices: vec![(title, runs(&verse_marks(&ps.join("\n\n")), b, vz, report))],
                left: lines.get(&(b, from, to)).cloned().unwrap_or_default(),
            },
        ));
    }
    Ok((items.into_iter().map(|(_, x)| x).collect(), counts))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verse_numbers_in_order() {
        assert_eq!(printed_numbers("9 And God said, Let 10 And God called 11 And", 9), vec![9, 10, 11]);
        // A verse that opens with "(" has no number to see; a number in the text is not a verse.
        assert_eq!(printed_numbers("1 Now these 2 (For 3 And 40 days 4 Then", 1), vec![1, 2, 3, 4]);
        assert_eq!(printed_numbers("1 Now these 2 for 3 And", 1), vec![1, 3]);
        assert_eq!(printed_numbers("14 But 13 And 15 Then", 14), vec![14, 15]);
        assert_eq!(labels("of {{ref:Jas.14|James. 14}} These"), "of James. 14 These");
    }
}
