//! Jamieson, Fausset and Brown, A Commentary, Critical and Explanatory, on
//! the Whole Bible (1871), from the CrossWire SWORD module JFB 3.0, mirrored
//! unchanged on the branch `mirror/sword-JFB` (`jfb-commentary`), read by
//! [`super::sword`].
//!
//! The module gives each verse its own entry, or one entry to several linked
//! verses. An entry starts with whatever comes before the commentary (on a
//! book's first verse, the general and book introductions, the book's title
//! and "Commentary by ..."), then may have the chapter's label ("CHAPTER 3",
//! "PSALM 101", left out), the heading of the section it begins ("Ge 1:3-5.
//! The First Day."), and the notes on its verses, each opening with the
//! verse's number and the words it explains ("3. God said--"). The comment
//! starts at the first section heading, or else at the paragraph that opens
//! with the entry's own verse number; what comes before is an introduction
//! and is left out, counted.
//!
//! Where an entry ends with the heading of the next section (one that starts
//! after the entry's last verse), the heading and what follows it belong to
//! that section's first verse: they open that verse's note, or are a note of
//! their own over the section's verses that have no entry. A chapter's own
//! entry (Psalm 70, the "For the exposition, see on Mr 13:1-37" of Matthew
//! 24) opens the note on its first verse in the same way. An entry whose
//! first note is on an earlier verse with no entry of its own (Jeremiah 17:2,
//! whose notes begin "1.") covers from that verse.
//!
//! A section heading that the module marks as a title shows over the note
//! (as Henry's do); one written into the text stays the note's first words.
//!
//! The three writers each wrote whole books, as the 1873 title page names
//! them: who wrote each book is in `config/voices/jfb.json` (`writers`), and
//! a note is never credited to "Jamieson, Fausset and Brown" together. That
//! file also lists the passages left out where a note says a word of
//! Scripture is a mistake (decision 23).

use super::calvin::{exclude, Exclusion, Notes};
use super::{runs, sword, Item, Report, BOOKS};
use atlas_core::Versification;
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::Path;

pub(super) const JFB: &str = "jfb-commentary";
pub(super) const JFB_W: u8 = 6;
const CONFIG: &str = "config/voices/jfb.json";
/// A marked title longer than this is not shown as a heading.
const HEADING_CHARS: usize = 400;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    format: u32,
    #[allow(dead_code)]
    about: String,
    writers: Vec<Writer>,
    exclude: Vec<Exclusion>,
}

/// Which of the three wrote a set of books, from a dated title page.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Writer {
    books: Vec<String>,
    writer: String,
    /// Where the title page was read: an evidence file and its entry.
    checked: String,
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
    tails: usize,
    tails_alone: usize,
    chapter_entries: usize,
    earlier: usize,
    pub(super) left_out: usize,
    dropped: BTreeMap<String, usize>,
}

impl Counts {
    pub(super) fn line(&self) -> String {
        let dropped: Vec<String> = self.dropped.iter().map(|(k, n)| format!("{n} <{k}>")).collect();
        format!(
            "voices jfb: {} notes from {} entries; {} introductions ({} characters) and {} chapter labels left out; {} headings over a note; {} headings of a next section moved to it ({} as notes of their own); {} chapter entries placed on their first verse; {} entries moved back to an earlier first verse; {} passages left out ({CONFIG}); tags dropped with their words kept: {}",
            self.notes,
            self.entries,
            self.intros,
            self.intro_chars,
            self.labels,
            self.headings,
            self.tails,
            self.tails_alone,
            self.chapter_entries,
            self.earlier,
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

/// Who wrote each book, by book index; every book must be named once.
fn writers_of(cfg: &Config) -> Result<BTreeMap<u8, String>, String> {
    let mut out = BTreeMap::new();
    for w in &cfg.writers {
        if w.writer.trim().is_empty() || w.checked.trim().is_empty() || w.writer.contains('\u{2014}') {
            return Err(format!("{CONFIG}: each writer needs a name and where the title page was read"));
        }
        for name in &w.books {
            let b = BOOKS.iter().position(|x| x.name == name).ok_or(format!("{CONFIG}: {name} is not a book"))? as u8;
            if out.insert(b, w.writer.clone()).is_some() {
                return Err(format!("{CONFIG}: {name} is named twice"));
            }
        }
    }
    if out.len() != BOOKS.len() {
        return Err(format!("{CONFIG}: {} of the {} books have a writer", out.len(), BOOKS.len()));
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

/// "CHAPTER 3", "PSALM 101": a chapter's label.
fn label(p: &str) -> bool {
    let p = p.trim_end_matches('.');
    let Some((word, n)) = p.split_once(' ') else { return false };
    matches!(word, "CHAPTER" | "PSALM") && !n.is_empty() && n.bytes().all(|c| c.is_ascii_digit())
}

/// A section heading's verses in the chapter, (first, last): one marked as a
/// reference ("{{ref:Gen.1.3-Gen.1.5|Ge 1:3-5}}. The First Day.") to this
/// chapter, or written out ("Ob 1-21. Doom of Edom", "2Jo 1-13. Address")
/// with a full stop after the numbers.
fn heading_verses(p: &str, osis: &str, c: u16) -> Option<(u16, u16)> {
    if let Some(rest) = p.strip_prefix("{{ref:") {
        let target = &rest[..rest.find('|')?];
        let after = &rest[rest.find("}}")? + 2..];
        // "Is 10:5-34 and 11:12. Destruction ..." is a heading too; "Ho 11:5 shows" is not.
        if !after.starts_with(['.', ',']) && !after.starts_with(" and {{ref:") {
            return None;
        }
        let (a, z) = target.split_once('-').unwrap_or((target, target));
        let part = |s: &str| -> Option<(String, u16, u16)> {
            let mut it = s.rsplitn(3, '.');
            let v = it.next()?.parse().ok()?;
            let ch = it.next()?.parse().ok()?;
            Some((it.next()?.to_string(), ch, v))
        };
        let (ba, ca, va) = part(a)?;
        let (bz, cz, vz) = part(z)?;
        if ba != osis || ca != c {
            return None;
        }
        return Some((va, if bz == osis && cz == c { vz } else { u16::MAX }));
    }
    // Written out: a book abbreviation, a space, numbers, then ". ".
    let (abbr, rest) = p.split_once(' ')?;
    let a = abbr.trim_start_matches(['1', '2', '3']);
    if a.len() < 2 || a.len() > 5 || !a.starts_with(|ch: char| ch.is_ascii_uppercase()) || !a[1..].bytes().all(|ch| ch.is_ascii_lowercase()) {
        return None;
    }
    let end = rest.find(". ").or_else(|| rest.strip_suffix('.').map(str::len))?;
    let nums = &rest[..end];
    if nums.is_empty() || !nums.bytes().all(|ch| ch.is_ascii_digit() || matches!(ch, b':' | b'-')) {
        return None;
    }
    let (a, z) = nums.split_once('-').unwrap_or((nums, nums));
    let verse = |s: &str| -> Option<(Option<u16>, u16)> {
        match s.split_once(':') {
            Some((ch, v)) => Some((Some(ch.parse().ok()?), v.parse().ok()?)),
            None => Some((None, s.parse().ok()?)),
        }
    };
    let (ca, va) = verse(a)?;
    let (cz, vz) = verse(z)?;
    if ca.is_some_and(|x| x != c) {
        return None;
    }
    Some((va, if cz.is_none_or(|x| x == c) { vz } else { u16::MAX }))
}

/// The number a note opens with ("3. God said--", "14-16. And", "20, 21."),
/// if it is followed by a full stop, comma or dash.
fn lemma(p: &str) -> Option<u16> {
    let n = p.bytes().take_while(u8::is_ascii_digit).count();
    if n == 0 || n > 3 {
        return None;
    }
    let next = p[n..].trim_start();
    next.starts_with(['.', ',', '-', '\u{2013}']).then(|| p[..n].parse().ok()).flatten()
}

/// A paragraph's reference marks as their labels, for a heading shown as words.
fn labels(p: &str) -> String {
    let mut out = String::with_capacity(p.len());
    let mut rest = p;
    while let Some(i) = rest.find("{{ref:") {
        out.push_str(&rest[..i]);
        let Some(e) = rest[i..].find("}}") else { break };
        let mark = &rest[i + 6..i + e];
        out.push_str(mark.split_once('|').map_or(mark, |(_, l)| l));
        rest = &rest[i + e + 2..];
    }
    out.push_str(rest);
    out
}

/// One note being put together: the paragraphs that open it (headings moved
/// from the entry before), then its own, and the heading shown over it.
#[derive(Default)]
struct Piece {
    to: u16,
    lead: Vec<sword::Para>,
    own: Vec<sword::Para>,
    has_entry: bool,
}

pub(super) fn jfb(root: &Path, inputs: &crate::sources::Inputs, vz: &Versification, report: &mut Report) -> Result<(Vec<Item>, Counts), String> {
    let cfg = config(root)?;
    writers_of(&cfg)?;
    let (conf, entries) = sword::read(inputs, JFB, vz)?;
    if conf.license != "Public Domain" || conf.source_type != "OSIS" || conf.version != "3.0" || conf.date != "2021-02-15" {
        return Err(format!(
            "{JFB}: the conf says {} {} {} {}; expected Public Domain, OSIS, version 3.0 of 2021-02-15",
            conf.license, conf.source_type, conf.version, conf.date
        ));
    }
    let mut counts = Counts::default();
    // Each chapter's pieces by first verse.
    let mut pieces: BTreeMap<(u8, u16), BTreeMap<u16, Piece>> = BTreeMap::new();
    let mut wrong: Vec<String> = Vec::new();
    // Headings of a next section, kept until every entry's verses are known.
    let mut tails: Vec<(u8, u16, u16, u16, Vec<sword::Para>)> = Vec::new();
    for e in entries {
        let (b, c, v, to) = match e.slot {
            sword::Slot::Verse(b, c, v) => (b, c, v, e.to),
            sword::Slot::Chapter(b, c) => (b, c, 0, 0),
            _ => {
                // The module's, testaments' and books' own headings: Genesis's
                // holds the general introduction's title.
                counts.intros += usize::from(!e.text.trim().is_empty());
                continue;
            }
        };
        let osis = BOOKS[b as usize].osis;
        let last = vz.verses_in(b, c).ok_or(format!("{JFB}: no chapter {} {c}", BOOKS[b as usize].name))?;
        let mut ps = sword::osis(&e.text, &mut counts.dropped);
        let before = ps.len();
        ps.retain(|p| !label(&p.text));
        counts.labels += before - ps.len();
        if ps.is_empty() {
            continue;
        }
        counts.entries += 1;
        let at = format!("{} {c}:{v}", BOOKS[b as usize].name);
        // Where the commentary starts.
        let section = |p: &sword::Para| match p.title.as_deref() {
            Some("x-s" | "x-s2" | "x-s3") => true,
            Some(_) => false,
            None => heading_verses(&p.text, osis, c).is_some(),
        };
        let Some(start) = ps.iter().position(|p| section(p) || (v > 0 && p.title.is_none() && lemma(&p.text) == Some(v))) else {
            if v == 0 {
                // A chapter entry that is only an introduction (Lamentations 1's to the book).
                counts.intros += 1;
                counts.intro_chars += ps.iter().map(|p| p.text.len()).sum::<usize>();
                continue;
            }
            wrong.push(format!("{at}: no heading and no note on verse {v}"));
            continue;
        };
        if start > 0 {
            counts.intros += 1;
            counts.intro_chars += ps[..start].iter().map(|p| p.text.len()).sum::<usize>();
        }
        let mut body: Vec<sword::Para> = ps.drain(start..).collect();
        // A chapter's entry opens the note on the first verse of its heading.
        if v == 0 {
            counts.chapter_entries += 1;
            let (f, z) = heading_verses(&body[0].text, osis, c).unwrap_or((1, last));
            tails.push((b, c, f.max(1), z.min(last), body));
            continue;
        }
        // The heading of a next section, and what follows it, belong to it.
        if let Some(k) = (1..body.len()).find(|&k| {
            let p = &body[k];
            (p.title.is_none() || section(p)) && heading_verses(&p.text, osis, c).is_some_and(|(f, _)| f > to && f <= last)
        }) {
            let tail: Vec<sword::Para> = body.drain(k..).collect();
            let (f, z) = heading_verses(&tail[0].text, osis, c).expect("found above");
            counts.tails += 1;
            tails.push((b, c, f, z.min(last), tail));
        }
        let chapter = pieces.entry((b, c)).or_default();
        let piece = chapter.entry(v).or_default();
        if piece.has_entry {
            wrong.push(format!("{at}: two entries open on this verse"));
            continue;
        }
        piece.has_entry = true;
        piece.to = piece.to.max(to);
        piece.own = body;
    }
    for (b, c, f, z, tail) in tails {
        let chapter = pieces.entry((b, c)).or_default();
        // Its own note runs to the section's end or the next note, whichever is first.
        let next = chapter.range(f + 1..).next().map_or(u16::MAX, |(&k, _)| k);
        let piece = chapter.entry(f).or_default();
        if !piece.has_entry && piece.lead.is_empty() {
            counts.tails_alone += 1;
            piece.to = z.min(next.saturating_sub(1)).max(f);
        }
        piece.lead.extend(tail);
    }
    // A note whose first verse number is an earlier verse with no note of its own.
    for chapter in pieces.values_mut() {
        let mut prev_end = 0u16;
        for v in chapter.keys().copied().collect::<Vec<u16>>() {
            let p = &chapter[&v];
            let first = p.lead.iter().chain(p.own.iter()).filter(|x| x.title.is_none()).find_map(|x| lemma(&x.text));
            let to = p.to.max(v);
            if let Some(n) = first.filter(|&n| n >= 1 && n < v && n > prev_end) {
                let mut p = chapter.remove(&v).expect("listed");
                p.to = to;
                counts.earlier += 1;
                chapter.insert(n, p);
            }
            prev_end = to;
        }
    }
    if !wrong.is_empty() {
        return Err(format!("{JFB}: {}", wrong.join("; ")));
    }
    // The notes, their headings apart, then the passages left out.
    let mut notes: Notes = BTreeMap::new();
    let mut heads: BTreeMap<(u8, u32, u32), String> = BTreeMap::new();
    for ((b, c), chapter) in pieces {
        for (v, p) in chapter {
            let (Some(from), Some(to)) = (vz.index(b, c, v), vz.index(b, c, p.to.max(v))) else {
                return Err(format!("{JFB}: {} {c}:{v}-{} is not in the Bible", BOOKS[b as usize].name, p.to));
            };
            let mut all: Vec<sword::Para> = p.lead.into_iter().chain(p.own).collect();
            let head = match all.first() {
                // A title that is the whole note (Psalm 70's) stays its words.
                Some(x) if matches!(x.title.as_deref(), Some("x-s" | "x-s2" | "x-s3")) && all.len() > 1 && x.text.len() < HEADING_CHARS => {
                    counts.headings += 1;
                    labels(&all.remove(0).text)
                }
                _ => String::new(),
            };
            let texts: Vec<String> = all.into_iter().map(|x| x.text).collect();
            if texts.is_empty() && head.is_empty() {
                continue;
            }
            notes.insert((b, from, to), texts);
            heads.insert((b, from, to), head);
        }
    }
    let (lines, left_out) = exclude(CONFIG, "Jamieson, Fausset and Brown", &cfg.exclude, vz, &mut notes)?;
    counts.left_out = left_out;
    let mut items = Vec::with_capacity(notes.len());
    for ((b, from, to), ps) in notes {
        counts.notes += 1;
        let head = heads.remove(&(b, from, to)).unwrap_or_default();
        items.push(Item {
            work: JFB_W,
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
    fn reads_headings_lemmas_and_labels() {
        assert_eq!(heading_verses("{{ref:Gen.1.3-Gen.1.5|Ge 1:3-5}}. The First Day.", "Gen", 1), Some((3, 5)));
        assert_eq!(heading_verses("{{ref:Gen.1.3-Gen.1.5|Ge 1:3-5}}. The First Day.", "Gen", 2), None);
        assert_eq!(heading_verses("{{ref:Acts.15.41-Acts.16.5|Ac 15:41-16:5}}. Visitation", "Acts", 15), Some((41, u16::MAX)));
        assert_eq!(heading_verses("Ob 1-21. Doom of Edom for Cruelty", "Obad", 1), Some((1, 21)));
        assert_eq!(heading_verses("2Jo 1-13. Address: Greeting", "2John", 1), Some((1, 13)));
        assert_eq!(heading_verses("1Co 10:1-33. Danger of Fellowship", "1Cor", 10), Some((1, 33)));
        // A sentence about a passage is not a heading.
        assert_eq!(heading_verses("{{ref:Ps.18.1|Psa 18:1}} has the full commentary", "Ps", 18), None);
        assert_eq!(heading_verses("{{ref:Hos.11.5|Ho 11:5}} shows this prophecy", "Hos", 11), None);
        assert_eq!(heading_verses("{{ref:Isa.10.5-Isa.10.34|Is 10:5-34}} and {{ref:Isa.11.1|Is 11:1}}. Destruction", "Isa", 10), Some((5, 34)));
        assert_eq!(heading_verses("This book may be divided", "Obad", 1), None);
        assert_eq!(lemma("3. God said--This phrase"), Some(3));
        assert_eq!(lemma("14-16. And"), Some(14));
        assert_eq!(lemma("20, 21. Whoso"), Some(20));
        assert_eq!(lemma("1871 was the year"), None);
        assert_eq!(lemma("God said"), None);
        assert!(label("CHAPTER 24") && label("PSALM 101") && !label("CHAPTER of"));
        assert_eq!(labels("{{ref:Gen.1.3-Gen.1.5|Ge 1:3-5}}. The First Day."), "Ge 1:3-5. The First Day.");
    }
}
