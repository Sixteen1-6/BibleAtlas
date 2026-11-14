//! Albert Barnes, Notes, Explanatory and Practical, on the New Testament
//! (1832 to 1853), from the CrossWire SWORD module Barnes 1.1, mirrored
//! unchanged on the branch `mirror/sword-Barnes` (`barnes-nt`), read by
//! [`super::sword`] from its ThML.
//!
//! The module gives each verse its own entry, or one entry to several linked
//! verses, each opening with its label ("Verse 16.", "Verses 2,3", "Ver 23."),
//! which is not shown where it names the entry's verse. Each book's
//! introduction (with Barnes's prefaces to the Gospels) stands at the start
//! of the entry on its first verse, and on some books runs on into the entry
//! on its second; where the comment starts is written in
//! `config/voices/barnes-nt.json` (`starts`), found by its words, and what
//! comes before is left out. A chapter's own analysis, which Barnes puts
//! before his note on its first verse, stays with that note; the chapter's
//! label ("CHAPTER IV.") does not.
//!
//! Left out as well: the lists of lettered references and marginal readings
//! keyed to the King James text the printing set beside the notes ("(n) "For
//! God" 1Jn 4:9"), which this copy keeps without that text; the charts the
//! copy draws with dashes and bars, which do not survive as text; the lines
//! of dashes; and the notes the module's maker added (`module_notes`, "No
//! entry from BARNES for this verse.", "Continuation of ..."). That file also
//! lists the passages left out where a note says a word of Scripture is a
//! mistake (decision 23).

use super::calvin::{exclude, Exclusion, Notes};
use super::{runs, sword, Item, Report, BOOKS};
use atlas_core::Versification;
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::Path;

pub(super) const BARNES: &str = "barnes-nt";
pub(super) const BARNES_W: u8 = 8;
/// One file of Barnes's notes for each chapter.
pub(super) const BARNES_DIR: &str = "extras/voices/barnes";
const CONFIG: &str = "config/voices/barnes-nt.json";
/// Matthew, the first book Barnes wrote on.
const MATTHEW: u8 = 39;
/// The words the module's maker put where a verse has no note.
const NO_NOTE: [&str; 2] = ["No specific Barnes text on this verse.", "No entry from BARNES for this verse."];
/// A lettered list of references with more letters than this of other words
/// is Barnes's own paragraph and stays.
const LIST_WORDS: usize = 25;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    format: u32,
    #[allow(dead_code)]
    about: String,
    starts: Vec<Start>,
    module_notes: Vec<String>,
    repairs: Vec<Repair>,
    exclude: Vec<Exclusion>,
}

/// A byte of the copy's old code page that stands for another letter, put
/// right: each `find` is replaced by `to` wherever it occurs, and must occur.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Repair {
    find: String,
    to: String,
    #[allow(dead_code)]
    why: String,
}

/// Where the comment starts in a book's first or second entry: what comes
/// before `words` is the book's introduction; with no words, the whole entry.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Start {
    book: String,
    verse: u16,
    words: Option<String>,
    #[allow(dead_code)]
    why: String,
}

/// What the reader did, for the build's report.
#[derive(Default)]
pub(super) struct Counts {
    pub(super) notes: usize,
    entries: usize,
    bad: usize,
    repaired: usize,
    headings: usize,
    intros: usize,
    intro_chars: usize,
    chapter_labels: usize,
    labels: usize,
    labels_wrong: usize,
    lists: usize,
    charts: usize,
    rules: usize,
    module: usize,
    no_note: usize,
    pub(super) left_out: usize,
    dropped: BTreeMap<String, usize>,
}

impl Counts {
    pub(super) fn line(&self) -> String {
        let dropped: Vec<String> = self.dropped.iter().map(|(k, n)| format!("{n} <{k}>")).collect();
        format!(
            "voices barnes: {} notes from {} entries ({} heading entries left out; {} bytes that are not UTF-8 read by code page 437, {} of them put right); {} introductions ({} characters), {} chapter labels and {} verse labels left out ({} of them naming a wrong verse); {} lists of lettered references, {} charts, {} lines of dashes, {} notes of the module's maker and {} \"no entry\" lines left out; {} passages left out ({CONFIG}); tags dropped with their words kept: {}",
            self.notes,
            self.entries,
            self.headings,
            self.bad,
            self.repaired,
            self.intros,
            self.intro_chars,
            self.chapter_labels,
            self.labels,
            self.labels_wrong,
            self.lists,
            self.charts,
            self.rules,
            self.module,
            self.no_note,
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

/// A note's opening label ("Verse 16.", "Verses 2-16.", "Verses 2,3",
/// "Ver 23.", "Verse. 12.", "Verse 5:", "23."), as (its length, first verse,
/// last verse). A bare number is a label only with a full stop after it.
fn label(p: &str) -> Option<(usize, u16, u16)> {
    let b = p.as_bytes();
    let mut i = 0;
    let lower = p.to_ascii_lowercase();
    let word = ["verses", "verse", "ver"].iter().find(|w| lower.starts_with(*w));
    if let Some(w) = word {
        i = w.len();
        if b.get(i) == Some(&b'.') {
            i += 1;
        }
        while b.get(i) == Some(&b' ') {
            i += 1;
        }
    }
    let num = |i: &mut usize| -> Option<u16> {
        let s = *i;
        while *i < b.len() && b[*i].is_ascii_digit() && *i - s < 3 {
            *i += 1;
        }
        if *i == s {
            None
        } else {
            p[s..*i].parse().ok()
        }
    };
    let first = num(&mut i)?;
    let mut last = first;
    loop {
        let mut j = i;
        while j < b.len() && matches!(b[j], b'-' | b',' | b' ') {
            j += 1;
        }
        if p[j..].starts_with("and ") {
            j += 4;
        }
        if j == i {
            break;
        }
        match num(&mut j) {
            Some(n) if n >= last => {
                last = n;
                i = j;
            }
            _ => break,
        }
    }
    let stop = matches!(b.get(i), Some(b'.' | b':'));
    if word.is_none() && !stop {
        return None;
    }
    if stop {
        i += 1;
    }
    // A label runs into the words ("Verse 1 And I looked", "Verse 17.For")
    // or ends the paragraph.
    if i < b.len() && b[i] != b' ' && !(word.is_some() && stop && (b[i].is_ascii_uppercase() || b[i] == b'(')) {
        return None;
    }
    while b.get(i) == Some(&b' ') {
        i += 1;
    }
    Some((i, first, last))
}

/// "CHAPTER IV.", "MATTHEW Chapter 2", "1st Corinthians CHAPTER VII,
/// Introduction", "Matthew Verses 2-16": a chapter's or passage's label.
fn chapter_label(p: &str) -> bool {
    if p.len() > 70 || p.contains("ANALYSIS") {
        return false;
    }
    let words: Vec<&str> = p.split_whitespace().collect();
    let numeral = |w: &str| {
        let w = w.trim_end_matches(['.', ',']);
        !w.is_empty()
            && (w.bytes().all(|c| c.is_ascii_digit())
                || w.bytes().all(|c| matches!(c, b'I' | b'V' | b'X' | b'L'))
                || matches!(w, "ONE" | "One" | "SIX"))
    };
    let at = words.iter().position(|w| matches!(*w, "CHAPTER" | "Chapter"));
    if let Some(k) = at {
        let ok_after = words.get(k + 1).is_some_and(|w| numeral(w)) && words[k + 2..].iter().all(|w| *w == "Introduction");
        return ok_after && words[..k].iter().all(|w| w.starts_with(|c: char| c.is_ascii_uppercase() || c.is_ascii_digit()));
    }
    // "Matthew Verses 2-16"
    words.len() == 3 && words[1] == "Verses" && label(&format!("{} {}", words[1], words[2])).is_some()
}

/// A list of lettered references or marginal readings keyed to the King
/// James text ("(n) "For God" 1Jn 4:9 (o) "perish" ..."), with at most a few
/// other words.
fn list(p: &str) -> bool {
    let mut s = p;
    while let Some(r) = s.strip_prefix("{{") {
        let Some(e) = r.find("}}") else { return false };
        s = r[e + 2..].trim_start_matches(['.', ',', ';', ' ']);
    }
    let Some(r) = s.strip_prefix('(') else { return false };
    let Some(e) = r.find(')') else { return false };
    if e == 0 || e > 3 || r[..e].contains(' ') {
        return false;
    }
    let after = r[e + 1..].trim_start();
    if !(after.starts_with('"') || after.starts_with('\u{201c}') || after.starts_with("{{")) {
        return false;
    }
    // The words left once marks, quotations and letters are taken out.
    let mut rest = String::new();
    let mut quote = false;
    let mut depth = 0;
    let mut chars = p.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '{' if chars.peek() == Some(&'{') => {
                chars.next();
                depth += 1;
            }
            '}' if depth > 0 && chars.peek() == Some(&'}') => {
                chars.next();
                depth -= 1;
            }
            _ if depth > 0 => {}
            '"' => quote = !quote,
            '\u{201c}' => quote = true,
            '\u{201d}' => quote = false,
            _ if quote => {}
            _ => rest.push(c),
        }
    }
    let mut letters = 0;
    for w in rest.split_whitespace() {
        let w = w.trim_matches(|c: char| !c.is_alphanumeric());
        let token = w.len() <= 3 && rest.contains(&format!("({w})"));
        if !token && !matches!(w, "or" | "and" | "Marg" | "See" | "Gr") {
            letters += w.chars().filter(|c| c.is_alphabetic()).count();
        }
    }
    letters <= LIST_WORDS
}

/// Where a list of lettered references starts at the end of a paragraph of
/// Barnes's own words ("... resisted by us. (a) "Known unto God" Num 16:5").
fn list_tail(p: &str) -> Option<usize> {
    p.match_indices(" (").map(|(i, _)| i).find(|&i| list(&p[i + 1..]) && !p[..i].trim_end().is_empty()).map(|i| p[..i].trim_end().len())
}

/// A line of a chart: two or more bars outside the reference marks.
fn chart(p: &str) -> bool {
    let mut depth = 0;
    let mut bars = 0;
    let mut cs = p.chars().peekable();
    while let Some(c) = cs.next() {
        match c {
            '{' if cs.peek() == Some(&'{') => {
                cs.next();
                depth += 1;
            }
            '}' if depth > 0 && cs.peek() == Some(&'}') => {
                cs.next();
                depth -= 1;
            }
            '|' if depth == 0 => bars += 1,
            _ => {}
        }
    }
    bars >= 2
}

/// The words that start the comment in an entry's paragraphs, as (paragraph,
/// byte), found once.
fn find_once(ps: &[sword::Para], words: &str) -> Result<(usize, usize), usize> {
    let found: Vec<(usize, usize)> = ps
        .iter()
        .enumerate()
        .flat_map(|(i, p)| p.text.match_indices(words).map(move |(k, _)| (i, k)))
        .collect();
    if found.len() == 1 {
        Ok(found[0])
    } else {
        Err(found.len())
    }
}

pub(super) fn barnes(root: &Path, inputs: &crate::sources::Inputs, vz: &Versification, report: &mut Report) -> Result<(Vec<Item>, Counts), String> {
    let cfg = config(root)?;
    let (conf, entries) = sword::read(inputs, BARNES, vz)?;
    if conf.license != "Public Domain" || conf.source_type != "ThML" || conf.version != "1.1" || conf.date != "2002-01-01" {
        return Err(format!(
            "{BARNES}: the conf says {} {} {} {}; expected Public Domain, ThML, version 1.1 of 2002-01-01",
            conf.license, conf.source_type, conf.version, conf.date
        ));
    }
    let book = |name: &str| -> Result<u8, String> {
        BOOKS
            .iter()
            .position(|x| x.name == name)
            .map(|b| b as u8)
            .filter(|&b| b >= MATTHEW)
            .ok_or(format!("{CONFIG}: {name} is not a book of the New Testament"))
    };
    let mut starts: BTreeMap<(u8, u16), (Option<String>, bool)> = BTreeMap::new();
    for s in &cfg.starts {
        if !matches!(s.verse, 1 | 2) || s.why.trim().is_empty() {
            return Err(format!("{CONFIG}: {} {}: a start is on verse 1 or 2 and says why", s.book, s.verse));
        }
        if starts.insert((book(&s.book)?, s.verse), (s.words.clone(), false)).is_some() {
            return Err(format!("{CONFIG}: {} {} is named twice", s.book, s.verse));
        }
    }
    for b in MATTHEW..BOOKS.len() as u8 {
        if !starts.contains_key(&(b, 1)) {
            return Err(format!("{CONFIG}: {} has no start", BOOKS[b as usize].name));
        }
    }
    let mut module: Vec<(String, usize)> = cfg.module_notes.iter().map(|m| (m.clone(), 0)).collect();
    let mut counts = Counts::default();
    let mut notes: Notes = BTreeMap::new();
    let mut wrong: Vec<String> = Vec::new();
    let mut repairs: Vec<usize> = vec![0; cfg.repairs.len()];
    for mut e in entries {
        counts.bad += e.bad;
        for (r, n) in cfg.repairs.iter().zip(repairs.iter_mut()) {
            let k = e.text.matches(r.find.as_str()).count();
            if k > 0 {
                *n += k;
                e.text = e.text.replace(r.find.as_str(), &r.to);
            }
        }
        let sword::Slot::Verse(b, c, v) = e.slot else {
            // The headings' slots hold copies of other books' notes.
            counts.headings += usize::from(!e.text.trim().is_empty());
            continue;
        };
        let at = format!("{} {c}:{v}", BOOKS[b as usize].name);
        let mut ps: Vec<sword::Para> = Vec::new();
        for p in sword::thml(&e.text, &mut counts.dropped) {
            // A line of dashes ends a paragraph.
            let mut cur = String::new();
            let mut dashes = 0;
            for ch in p.text.chars() {
                if ch == '-' {
                    dashes += 1;
                    continue;
                }
                if dashes >= 5 {
                    counts.rules += 1;
                    ps.push(sword::Para { title: None, text: std::mem::take(&mut cur) });
                } else {
                    cur.extend(std::iter::repeat_n('-', dashes));
                }
                dashes = 0;
                cur.push(ch);
            }
            if dashes >= 5 {
                counts.rules += 1;
            } else {
                cur.extend(std::iter::repeat_n('-', dashes));
            }
            ps.push(sword::Para { title: None, text: cur });
        }
        for p in &mut ps {
            for w in NO_NOTE {
                if p.text.contains(w) {
                    counts.no_note += 1;
                    p.text = p.text.replace(w, " ");
                }
            }
            p.text = p.text.split_whitespace().collect::<Vec<_>>().join(" ");
        }
        ps.retain(|p| {
            let maker = module.iter_mut().find(|(m, _)| p.text.starts_with(m.as_str()));
            if let Some((_, n)) = maker {
                *n += 1;
                return false;
            }
            !p.text.is_empty()
        });
        // A book's introduction.
        let mut whole_intro = false;
        if c == 1 {
            if let Some((words, used)) = starts.get_mut(&(b, v)) {
                *used = true;
                match words {
                    None => whole_intro = true,
                    Some(w) => match find_once(&ps, w) {
                        Ok((i, k)) => {
                            counts.intros += 1;
                            counts.intro_chars += ps[..i].iter().map(|p| p.text.len()).sum::<usize>() + k;
                            ps.drain(..i);
                            ps[0].text = ps[0].text[k..].to_string();
                        }
                        Err(n) => wrong.push(format!("{at}: the start \"{w}\" is in the entry {n} times, not once")),
                    },
                }
            }
        }
        if whole_intro {
            counts.intros += 1;
            counts.intro_chars += ps.iter().map(|p| p.text.len()).sum::<usize>();
            continue;
        }
        // The chapter's label.
        let before = ps.len();
        let mut k = 0;
        ps.retain(|p| {
            k += 1;
            !(k <= 3 && chapter_label(&p.text))
        });
        counts.chapter_labels += before - ps.len();
        // Lettered references and charts.
        let before = ps.len();
        ps.retain(|p| !list(&p.text));
        counts.lists += before - ps.len();
        for p in ps.iter_mut() {
            if let Some(k) = list_tail(&p.text) {
                counts.lists += 1;
                p.text.truncate(k);
            }
        }
        let before = ps.len();
        ps.retain(|p| !chart(&p.text));
        counts.charts += before - ps.len();
        if ps.is_empty() {
            continue;
        }
        counts.entries += 1;
        // A second verse's entry that holds the first verse's note too (the
        // first verse's entry being introduction, or the chapter's analysis).
        let mut from_v = v;
        if c == 1 && v == 2 && ps.iter().any(|p| label(&p.text).is_some_and(|(_, f, _)| f == 1)) {
            from_v = 1;
        }
        // The opening label (some given twice), and in a one-verse note the
        // label after the chapter's analysis. A few labels name a wrong
        // verse; the entry's words are its own verse's, so they go too.
        let last = e.to.max(v);
        while let Some((n, f, l)) = ps.first().and_then(|p| label(&p.text)) {
            if f > last || l < from_v {
                counts.labels_wrong += 1;
            }
            counts.labels += 1;
            ps[0].text = ps[0].text[n..].to_string();
            if ps[0].text.is_empty() {
                ps.remove(0);
            }
        }
        if from_v == last {
            if let Some(k) = ps.iter().position(|p| p.text.starts_with("Ver") && label(&p.text).is_some_and(|(_, f, l)| f == v && l == v)) {
                counts.labels += 1;
                let n = label(&ps[k].text).map_or(0, |(n, _, _)| n);
                ps[k].text = ps[k].text[n..].to_string();
                if ps[k].text.is_empty() {
                    ps.remove(k);
                }
            }
        }
        if ps.is_empty() {
            continue;
        }
        let (Some(from), Some(to)) = (vz.index(b, c, from_v), vz.index(b, c, e.to.max(v))) else {
            return Err(format!("{BARNES}: {at} is not in the Bible"));
        };
        notes.insert((b, from, to), ps.into_iter().map(|p| p.text).collect());
    }
    for ((b, v), (w, used)) in &starts {
        if !used {
            wrong.push(format!("{} 1:{v}: no entry for its start \"{}\"", BOOKS[*b as usize].name, w.as_deref().unwrap_or("")));
        }
    }
    for (m, n) in &module {
        if *n == 0 {
            wrong.push(format!("the module's note \"{m}\" is not found"));
        }
        counts.module += n;
    }
    for (r, n) in cfg.repairs.iter().zip(&repairs) {
        if *n == 0 {
            wrong.push(format!("the repair \"{}\" is not found", r.find));
        }
        counts.repaired += n;
    }
    if !wrong.is_empty() {
        return Err(format!("{CONFIG}: {}", wrong.join("; ")));
    }
    let (lines, left_out) = exclude(CONFIG, "Barnes", &cfg.exclude, vz, &mut notes)?;
    counts.left_out = left_out;
    let mut items = Vec::with_capacity(notes.len());
    for ((b, from, to), ps) in notes {
        counts.notes += 1;
        items.push(Item {
            work: BARNES_W,
            from,
            to,
            voices: vec![(String::new(), runs(&ps.join("\n\n"), b, vz, report))],
            left: lines.get(&(b, from, to)).cloned().unwrap_or_default(),
        });
    }
    Ok((items, counts))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_labels_and_lists() {
        assert!(chart("|  Great  | | second wife |"));
        assert_eq!(list_tail("Resisted by us. (a) \"Known unto God\" {{ref:Num 16:5|Num 16:5}}"), Some(15));
        assert_eq!(list_tail("He (h) that hath two coats, and so on at some length here."), None);
        assert!(!chart("See {{ref:Mt 1:1|Mt 1:1}} and {{ref:Lk 3:23|Lk 3:23}}."));
        assert_eq!(label("Verse 16. For God"), Some((10, 16, 16)));
        assert_eq!(label("Verse 17.For we"), Some((9, 17, 17)));
        assert_eq!(label("Verses 2-16. These verses"), Some((13, 2, 16)));
        assert_eq!(label("Verses 2,3 As it is"), Some((11, 2, 3)));
        assert_eq!(label("Ver 23. No"), Some((8, 23, 23)));
        assert_eq!(label("Verse. 12. This"), Some((11, 12, 12)));
        assert_eq!(label("Verse 5: No"), Some((9, 5, 5)));
        assert_eq!(label("Verse 1 And I looked"), Some((8, 1, 1)));
        assert_eq!(label("Verses 1 and 2 of"), Some((15, 1, 2)));
        assert_eq!(label("23. As soon"), Some((4, 23, 23)));
        assert_eq!(label("1871 was"), None);
        assert_eq!(label("2 Timothy"), None);
        assert_eq!(label("Versed in"), None);
        assert!(chapter_label("CHAPTER IV.") && chapter_label("MATTHEW Chapter 2") && chapter_label("1st Corinthians CHAPTER VII, Introduction"));
        assert!(chapter_label("Matthew Verses 2-16") && !chapter_label("ANALYSIS OF CHAPTER I") && !chapter_label("See Chapter 5 of this"));
        assert!(list("(n) \"For God\" {{ref:1Jn 4:9|1Jn 4:9}}"));
        assert!(list("{{ref:Mt 15:1|Mt 15:1}} (b) \"your tradition?\" {{ref:Col 2:8|Col 2:8}}"));
        assert!(list("(m) {{ref:Ps 116:16|Ps 116:16}} (n) \"according to thy word\" {{ref:Ps 119:38|Ps 119:38}}"));
        assert!(!list("(1.) It is remarked that in nothing are mistakes more likely to occur."));
        assert!(!list("(a) \"x\" This closes the argumentative part of the epistle, and the observations that follow are long."));
    }
}
