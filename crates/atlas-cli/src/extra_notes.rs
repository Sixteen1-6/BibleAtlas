//! Study notes: what Bible scholars note about each passage, from the Aquifer
//! Open Study Notes (Mission Mutual, 2026), an adaptation into plain English of
//! the Tyndale Open Study Notes (Tyndale House Publishers, 2023). Both are
//! CC BY-SA 4.0, so the files written here are shared under the same license.
//! The app shows them one tap away from a verse, always as these scholars'
//! notes and never as its own claim.
//!
//! Source: BibleAquifer/AquiferOpenStudyNotes, one JSON file per book
//! (`eng/json/01.content.json` is Genesis, 66 is Revelation). Each entry is a
//! note on one passage (`associations.passage`, verse ids `BBCCCVVV`) with its
//! text as HTML. The build stops unless `eng/metadata.json` names the
//! CC BY-SA 4.0 license and the Tyndale original.
//!
//! The HTML is untrusted and is never passed on. A plain scanner keeps only
//! paragraphs, lists, italics and verse references (`<data class="bible-ref">`);
//! every other tag is dropped and its text kept, and the build reports what it
//! dropped. A reference to a verse the BSB does not have stays as plain text.
//!
//! Output, under `web/public/data/`:
//! - `extras/notes.json`: `{format, version, n, per}`. `n` is a flat list, two
//!   numbers per note in order of first verse: the first verse minus the
//!   previous note's first verse, then the number of verses after the first.
//!   `per` is how many notes each book has. Small: it loads with the reader's
//!   first move.
//! - `extras/notes/<Book>.json`: `{format, notes}`, the book's notes in the
//!   same order, each `{id, b}`: the source's content id and its blocks, each
//!   `["p", runs]` or `["ul" | "ol", [runs, ...]]`. A run is a string, `[text]`
//!   for italics, or `[from, to, text]` for a verse reference. It loads when
//!   the panel opens.

use crate::loaded::Loaded;
use crate::sources::Inputs;
use atlas_core::canon::BOOKS;
use atlas_core::Versification;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::fs;

const SOURCE: &str = "aquifer-osn";
const OUT: &str = "extras/notes.json";
const DIR: &str = "extras/notes";

/// `eng/metadata.json` must say this...
const LICENSE: &str = "CC BY-SA 4.0";
/// ...and that it adapts this.
const ORIGINAL: &str = "Tyndale Open Study Notes";

/// One piece of a note's text.
#[derive(Clone, Debug, PartialEq)]
enum Run {
    Plain(String),
    Italic(String),
    Verse(u32, u32, String),
}

#[derive(Debug)]
enum Block {
    Para(Vec<Run>),
    List(bool, Vec<Vec<Run>>),
}

/// What the scanner dropped or could not place, for the build report.
#[derive(Default)]
struct Report {
    tags: BTreeMap<String, usize>,
    refs_unplaced: usize,
    refs: usize,
}

fn verse_id(s: &str, vz: &Versification) -> Option<u32> {
    if s.len() != 8 || !s.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let b: u8 = s[0..2].parse().ok()?;
    let c: u16 = s[2..5].parse().ok()?;
    let v: u16 = s[5..8].parse().ok()?;
    if b == 0 || b as usize > BOOKS.len() {
        return None;
    }
    vz.index(b - 1, c, v)
}

/// A passage `start..=end` as BSB verse numbers, within one book.
fn passage(start: &str, end: &str, vz: &Versification) -> Option<(u32, u32)> {
    let a = verse_id(start, vz)?;
    let b = verse_id(end, vz)?;
    let same_book = vz.locate(a)?.0 == vz.locate(b)?.0;
    (a <= b && same_book).then_some((a, b))
}

fn decode_entities(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(i) = rest.find('&') {
        out.push_str(&rest[..i]);
        rest = &rest[i..];
        let end = rest.find(';').filter(|&e| e <= 10);
        let ent = end.map(|e| &rest[1..e]);
        let ch = match ent {
            Some("amp") => Some('&'),
            Some("lt") => Some('<'),
            Some("gt") => Some('>'),
            Some("quot") => Some('"'),
            Some("apos") => Some('\''),
            Some("nbsp") => Some(' '),
            Some(e) if e.starts_with("#x") || e.starts_with("#X") => {
                u32::from_str_radix(&e[2..], 16)
                    .ok()
                    .and_then(char::from_u32)
            }
            Some(e) if e.starts_with('#') => e[1..].parse().ok().and_then(char::from_u32),
            _ => None,
        };
        match (ch, end) {
            (Some(c), Some(e)) => {
                out.push(c);
                rest = &rest[e + 1..];
            }
            _ => {
                out.push('&');
                rest = &rest[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

/// The value of `name="..."` in a tag's attributes.
fn attr<'a>(attrs: &'a str, name: &str) -> Option<&'a str> {
    let key = format!("{name}=\"");
    let i = attrs.find(&key)? + key.len();
    let j = attrs[i..].find('"')?;
    Some(&attrs[i..i + j])
}

/// Scans a note's HTML into blocks. Keeps only text, italics, verse references,
/// paragraphs and lists.
struct Scanner<'v> {
    vz: &'v Versification,
    blocks: Vec<Block>,
    runs: Vec<Run>,
    list: Option<(bool, Vec<Vec<Run>>)>,
    in_item: bool,
    italic: usize,
    /// An open reference: its verses, if the BSB has them, and its text so far.
    reference: Option<(Option<(u32, u32)>, String)>,
}

impl<'v> Scanner<'v> {
    fn text(&mut self, raw: &str) {
        let t = decode_entities(raw);
        if let Some((_, s)) = &mut self.reference {
            s.push_str(&t);
            return;
        }
        let run = if self.italic > 0 {
            Run::Italic(t)
        } else {
            Run::Plain(t)
        };
        match (self.runs.last_mut(), run) {
            (Some(Run::Plain(a)), Run::Plain(b)) | (Some(Run::Italic(a)), Run::Italic(b)) => {
                a.push_str(&b)
            }
            (_, run) => self.runs.push(run),
        }
    }

    /// Ends the current paragraph or list item.
    fn flush(&mut self) {
        let runs = tidy(std::mem::take(&mut self.runs));
        if runs.is_empty() {
            return;
        }
        match &mut self.list {
            Some((_, items)) if self.in_item => {
                if let Some(last) = items.last_mut() {
                    if !last.is_empty() {
                        last.push(Run::Plain(" ".into()));
                    }
                    last.extend(runs);
                    *last = tidy(std::mem::take(last));
                }
            }
            Some((_, items)) => items.push(runs),
            None => self.blocks.push(Block::Para(runs)),
        }
    }

    fn tag(&mut self, inner: &str, report: &mut Report) {
        let closing = inner.starts_with('/');
        let body = inner.trim_start_matches('/').trim_end_matches('/');
        let name_end = body.find(|c: char| c.is_whitespace()).unwrap_or(body.len());
        let name = body[..name_end].to_ascii_lowercase();
        let attrs = &body[name_end..];
        match (name.as_str(), closing) {
            ("p", _) => self.flush(),
            ("ul" | "ol", false) => {
                self.flush();
                self.end_list();
                self.list = Some((name == "ol", Vec::new()));
            }
            ("ul" | "ol", true) => {
                self.flush();
                self.end_list();
            }
            ("li", false) => {
                self.flush();
                if self.list.is_none() {
                    self.list = Some((false, Vec::new()));
                }
                if let Some((_, items)) = &mut self.list {
                    items.push(Vec::new());
                }
                self.in_item = true;
            }
            ("li", true) => {
                self.flush();
                self.in_item = false;
            }
            ("em" | "i", false) => self.italic += 1,
            ("em" | "i", true) => self.italic = self.italic.saturating_sub(1),
            ("data", false) if attr(attrs, "class") == Some("bible-ref") => {
                report.refs += 1;
                let verses = match (attr(attrs, "data-start-ref"), attr(attrs, "data-end-ref")) {
                    (Some(a), Some(b)) => passage(a, b, self.vz),
                    _ => None,
                };
                if verses.is_none() {
                    report.refs_unplaced += 1;
                }
                self.reference = Some((verses, String::new()));
            }
            ("data", true) => {
                if let Some((verses, t)) = self.reference.take() {
                    let t = t.split_whitespace().collect::<Vec<_>>().join(" ");
                    match verses {
                        Some((a, b)) if !t.is_empty() => self.runs.push(Run::Verse(a, b, t)),
                        _ => self.text(&t),
                    }
                }
            }
            ("br", _) => self.text(" "),
            _ => {
                *report
                    .tags
                    .entry(format!("<{}{name}>", if closing { "/" } else { "" }))
                    .or_default() += 1
            }
        }
    }

    fn end_list(&mut self) {
        if let Some((ordered, items)) = self.list.take() {
            let items: Vec<Vec<Run>> = items.into_iter().filter(|i| !i.is_empty()).collect();
            if !items.is_empty() {
                self.blocks.push(Block::List(ordered, items));
            }
        }
        self.in_item = false;
    }
}

/// Collapses whitespace, trims the ends, and drops empty runs.
fn tidy(runs: Vec<Run>) -> Vec<Run> {
    let mut out: Vec<Run> = Vec::new();
    for r in runs {
        let squash = |s: &str| {
            let mut t = String::with_capacity(s.len());
            let mut space = false;
            for c in s.chars() {
                if c.is_whitespace() {
                    space = true;
                } else {
                    if space {
                        t.push(' ');
                    }
                    space = false;
                    t.push(c);
                }
            }
            if space {
                t.push(' ');
            }
            t
        };
        let r = match r {
            Run::Plain(s) => Run::Plain(squash(&s)),
            Run::Italic(s) => Run::Italic(squash(&s)),
            v => v,
        };
        let empty = matches!(&r, Run::Plain(s) | Run::Italic(s) if s.is_empty());
        if empty {
            continue;
        }
        match (out.last_mut(), &r) {
            (Some(Run::Plain(a)), Run::Plain(b)) => {
                if a.ends_with(' ') && b.starts_with(' ') {
                    a.push_str(&b[1..]);
                } else {
                    a.push_str(b);
                }
            }
            _ => out.push(r),
        }
    }
    // A space never starts or ends the text.
    if let Some(Run::Plain(s) | Run::Italic(s)) = out.first_mut() {
        *s = s.trim_start().to_string();
    }
    if let Some(Run::Plain(s) | Run::Italic(s)) = out.last_mut() {
        *s = s.trim_end().to_string();
    }
    out.retain(|r| !matches!(r, Run::Plain(s) | Run::Italic(s) if s.is_empty()));
    let only_space = out
        .iter()
        .all(|r| matches!(r, Run::Plain(s) if s.trim().is_empty()));
    if only_space {
        out.clear();
    }
    out
}

fn scan(html: &str, vz: &Versification, report: &mut Report) -> Vec<Block> {
    let mut s = Scanner {
        vz,
        blocks: Vec::new(),
        runs: Vec::new(),
        list: None,
        in_item: false,
        italic: 0,
        reference: None,
    };
    let mut rest = html;
    while let Some(i) = rest.find('<') {
        if i > 0 {
            s.text(&rest[..i]);
        }
        match rest[i..].find('>') {
            Some(j) => {
                s.tag(&rest[i + 1..i + j], report);
                rest = &rest[i + j + 1..];
            }
            None => {
                // A stray '<' with no end: keep it as text.
                s.text(&rest[i..]);
                rest = "";
            }
        }
    }
    s.text(rest);
    // A reference left open: keep its words as text.
    if let Some((_, t)) = s.reference.take() {
        s.text(&t);
    }
    s.flush();
    s.end_list();
    s.blocks
}

fn runs_json(runs: &[Run]) -> Value {
    Value::Array(
        runs.iter()
            .map(|r| match r {
                Run::Plain(t) => json!(t),
                Run::Italic(t) => json!([t]),
                Run::Verse(a, b, t) => json!([a, b, t]),
            })
            .collect(),
    )
}

fn blocks_json(blocks: &[Block]) -> Value {
    Value::Array(
        blocks
            .iter()
            .map(|b| match b {
                Block::Para(r) => json!(["p", runs_json(r)]),
                Block::List(ordered, items) => json!([
                    if *ordered { "ol" } else { "ul" },
                    items.iter().map(|i| runs_json(i)).collect::<Vec<_>>()
                ]),
            })
            .collect(),
    )
}

fn read_json(path: &std::path::Path) -> Result<Value, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))
}

/// The files to write under web/public/data, as (path, bytes).
pub fn build(inputs: &Inputs, vz: &Versification) -> Result<Vec<(String, Vec<u8>)>, String> {
    let meta = read_json(&inputs.path(SOURCE, "metadata"))?;
    let info = &meta["resource_metadata"];
    let license = info["license_info"]["licenses"][0]["eng"]["name"]
        .as_str()
        .unwrap_or("");
    let notice = info["adaptation_notice"].as_str().unwrap_or("");
    if !license.contains(LICENSE) || !notice.contains(ORIGINAL) || !notice.contains(LICENSE) {
        return Err(format!("{SOURCE}: eng/metadata.json no longer names the {LICENSE} license and the {ORIGINAL} it adapts; check the source before using it"));
    }
    let version = info["version"].as_str().unwrap_or("").to_string();

    let mut report = Report::default();
    let (mut entries, mut unplaced, mut empty, mut wrong_book) = (0usize, 0usize, 0usize, 0usize);
    // (first verse, last verse, content id, blocks), by book.
    let mut books: Vec<Vec<(u32, u32, String, Value)>> = vec![Vec::new(); BOOKS.len()];
    for (b, book) in BOOKS.iter().enumerate() {
        let doc = read_json(&inputs.path(SOURCE, &format!("{:02}", b + 1)))?;
        let list = doc
            .as_array()
            .ok_or_else(|| format!("{SOURCE}: {} is not a list of notes", book.name))?;
        for e in list {
            entries += 1;
            let blocks = scan(e["content"].as_str().unwrap_or(""), vz, &mut report);
            if blocks.is_empty() {
                empty += 1;
                continue;
            }
            let id = e["content_id"]
                .as_str()
                .map(str::to_string)
                .unwrap_or_else(|| e["content_id"].to_string());
            let body = blocks_json(&blocks);
            let passages = e["associations"]["passage"]
                .as_array()
                .cloned()
                .unwrap_or_default();
            if passages.is_empty() {
                unplaced += 1;
            }
            for p in &passages {
                match passage(
                    p["start_ref"].as_str().unwrap_or(""),
                    p["end_ref"].as_str().unwrap_or(""),
                    vz,
                ) {
                    Some((from, to)) if vz.locate(from).map(|l| l.0 as usize) == Some(b) => {
                        books[b].push((from, to, id.clone(), body.clone()))
                    }
                    Some(_) => wrong_book += 1,
                    None => unplaced += 1,
                }
            }
        }
    }

    let mut n: Vec<u32> = Vec::new();
    let mut per: Vec<usize> = Vec::new();
    let mut prev = 0u32;
    let mut out = Vec::new();
    for (b, notes) in books.iter_mut().enumerate() {
        // The verse's own notes first, then wider passages: by first verse, then shortest.
        notes.sort_by(|x, y| (x.0, x.1, &x.2).cmp(&(y.0, y.1, &y.2)));
        notes.dedup_by(|x, y| x.0 == y.0 && x.1 == y.1 && x.2 == y.2);
        per.push(notes.len());
        let mut file = Vec::with_capacity(notes.len());
        for (from, to, id, body) in notes.iter() {
            n.push(from - prev);
            n.push(to - from);
            prev = *from;
            file.push(json!({ "id": id, "b": body }));
        }
        let doc = json!({ "format": 1, "notes": file });
        out.push((
            format!("{DIR}/{}.json", BOOKS[b].osis),
            serde_json::to_vec(&doc).map_err(|e| e.to_string())?,
        ));
    }
    let total: usize = per.iter().sum();
    eprintln!(
        "notes: {total} notes from {entries} entries; {empty} empty, {unplaced} passages not in the BSB, {wrong_book} in another book's file; {} of {} verse references placed",
        report.refs - report.refs_unplaced,
        report.refs
    );
    if !report.tags.is_empty() {
        eprintln!("notes: tags dropped (their text kept): {:?}", report.tags);
    }
    let index = json!({ "format": 1, "version": version, "n": n, "per": per });
    out.push((
        OUT.to_string(),
        serde_json::to_vec(&index).map_err(|e| e.to_string())?,
    ));
    Ok(out)
}

/// All the text of a note's blocks, for the checks.
fn plain(blocks: &Value) -> String {
    let mut s = String::new();
    let run = |r: &Value, s: &mut String| match r {
        Value::String(t) => s.push_str(t),
        Value::Array(a) => s.push_str(a.last().and_then(Value::as_str).unwrap_or("")),
        _ => {}
    };
    for b in blocks.as_array().into_iter().flatten() {
        match b[0].as_str() {
            Some("p") => b[1]
                .as_array()
                .into_iter()
                .flatten()
                .for_each(|r| run(r, &mut s)),
            _ => b[1]
                .as_array()
                .into_iter()
                .flatten()
                .flat_map(|i| i.as_array().into_iter().flatten())
                .for_each(|r| run(r, &mut s)),
        }
        s.push(' ');
    }
    s
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let index_path = d.dir.join(OUT);
    let size = fs::metadata(&index_path)
        .map_err(|e| format!("reading {}: {e}", index_path.display()))?
        .len();
    let doc = read_json(&index_path)?;
    let n: Vec<u32> = doc["n"]
        .as_array()
        .ok_or("notes.json has no n")?
        .iter()
        .map(|x| x.as_u64().unwrap_or(u64::MAX) as u32)
        .collect();
    let per: Vec<usize> = doc["per"]
        .as_array()
        .ok_or("notes.json has no per")?
        .iter()
        .map(|x| x.as_u64().unwrap_or(0) as usize)
        .collect();
    let verses = d.vz.verse_count();
    let mut spans = Vec::with_capacity(n.len() / 2);
    let mut at = 0u32;
    for p in n.chunks(2) {
        at = at.saturating_add(p[0]);
        spans.push((at, at.saturating_add(*p.get(1).unwrap_or(&u32::MAX))));
    }
    let all_real = n.len().is_multiple_of(2) && spans.iter().all(|&(a, b)| a <= b && b < verses);
    let total: usize = per.iter().sum();

    // Every book's file has its share of the notes, each with text, in the same order.
    let mut first = 0usize;
    let mut files_ok = per.len() == BOOKS.len();
    let mut book_notes: Vec<Value> = Vec::new();
    for (b, book) in BOOKS.iter().enumerate() {
        let f = read_json(&d.dir.join(format!("{DIR}/{}.json", book.osis)))?;
        let notes = f["notes"].as_array().cloned().unwrap_or_default();
        let count = per.get(b).copied().unwrap_or(usize::MAX);
        let in_book = spans
            .get(first..first + count.min(spans.len()))
            .unwrap_or(&[])
            .iter()
            .all(|&(a, z)| {
                d.vz.locate(a).map(|l| l.0 as usize) == Some(b)
                    && d.vz.locate(z).map(|l| l.0 as usize) == Some(b)
            });
        files_ok &= notes.len() == count
            && in_book
            && notes.iter().all(|x| !plain(&x["b"]).trim().is_empty());
        first += count;
        book_notes.push(Value::Array(notes));
    }

    // Known notes: the first note on a verse, and its words.
    let note_on = |r: &str, words: &str| -> Result<bool, String> {
        let (v, _) = d.resolve(r)?;
        let b = d.vz.locate(v).map(|l| l.0 as usize).unwrap_or(0);
        let start: usize = per[..b].iter().sum();
        let found = spans[start..start + per[b]]
            .iter()
            .enumerate()
            .filter(|(_, &(a, z))| a <= v && v <= z)
            .any(|(i, _)| plain(&book_notes[b][i]["b"]).contains(words));
        Ok(found)
    };
    let refs_ok = book_notes
        .iter()
        .flat_map(|b| b.as_array().cloned().unwrap_or_default())
        .all(|x| {
            let mut ok = true;
            let mut check = |r: &Value| {
                if let Some(a) = r.as_array() {
                    if a.len() == 3 {
                        let (f, t) = (
                            a[0].as_u64().unwrap_or(u64::MAX),
                            a[1].as_u64().unwrap_or(u64::MAX),
                        );
                        ok &= f <= t && t < verses as u64;
                    }
                }
            };
            for blk in x["b"].as_array().into_iter().flatten() {
                for item in blk[1].as_array().into_iter().flatten() {
                    if blk[0] == "p" {
                        check(item);
                    } else {
                        item.as_array().into_iter().flatten().for_each(&mut check);
                    }
                }
            }
            ok
        });
    Ok(vec![
        (
            total > 15_000,
            format!("{total} study notes, expected more than 15,000"),
        ),
        (
            all_real,
            "every study note covers real verses, first to last in one book".to_string(),
        ),
        (
            files_ok,
            "each book's study notes file matches the index, and every note has text".to_string(),
        ),
        (
            refs_ok,
            "every verse a study note names is a real verse".to_string(),
        ),
        (
            size < 200_000,
            format!("extras/notes.json is {size} bytes, expected under 200,000"),
        ),
        (
            note_on("John 1:1", "In the beginning")?,
            "a study note on John 1:1 explains \"In the beginning\"".to_string(),
        ),
        (
            note_on("Genesis 1:1", "")? && note_on("Revelation 22:21", "")?,
            "Genesis 1:1 and Revelation 22:21 have study notes".to_string(),
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

    #[test]
    fn keeps_text_italics_and_verses_only() {
        let vz = vz();
        let mut r = Report::default();
        let html = r#"<p><em>In the beginning</em>: Using the same phrase as (<data class="bible-ref" data-start-ref="01001001" data-end-ref="01001001">Genesis 1:1</data>), &quot;the Word&quot;<script>x</script>.</p><ul><li><p>One</p></li><li>Two <a href="https://x">link</a></li></ul>"#;
        let b = scan(html, &vz, &mut r);
        assert_eq!(b.len(), 2);
        match &b[0] {
            Block::Para(runs) => {
                assert_eq!(runs[0], Run::Italic("In the beginning".into()));
                assert_eq!(runs[2], Run::Verse(0, 0, "Genesis 1:1".into()));
                assert_eq!(runs[3], Run::Plain("), \"the Word\"x.".into()));
            }
            _ => panic!("first block is a paragraph"),
        }
        match &b[1] {
            Block::List(false, items) => {
                assert_eq!(items.len(), 2);
                assert_eq!(items[1], vec![Run::Plain("Two link".into())]);
            }
            _ => panic!("second block is a list"),
        }
        assert_eq!(r.tags.get("<script>"), Some(&1));
    }

    #[test]
    fn a_verse_the_bsb_lacks_stays_text() {
        let vz = vz();
        let mut r = Report::default();
        let b = scan(
            r#"See <data class="bible-ref" data-start-ref="01099001" data-end-ref="01099001">Genesis 99:1</data>."#,
            &vz,
            &mut r,
        );
        match &b[0] {
            Block::Para(runs) => assert_eq!(runs, &vec![Run::Plain("See Genesis 99:1.".into())]),
            _ => panic!("a paragraph"),
        }
        assert_eq!(r.refs_unplaced, 1);
    }
}
