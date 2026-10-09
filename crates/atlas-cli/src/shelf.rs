//! The Sources shelf: every work the app draws on or cites, what it is, who
//! made it, when, its license, and where to read or find it; and the two
//! public-domain Bible dictionaries the app can show in full.
//!
//! `config/shelf.json` describes the works (its `_comment` says how to add
//! one). Each dataset in sources.json belongs to exactly one work. A dataset
//! that has none, such as a source added after the shelf was written, gets a
//! plain card made from its sources.json entry and a warning, never an error.
//! The build also finds where the app cites each work: every source string in
//! `config/aramaic.json` is matched against the works' `cites`, and a string
//! that matches no work, or more than one, is a warning that lists it.
//!
//! The dictionaries, Easton's (1897) and Smith's (1884), are read from the
//! Christian Classics Ethereal Library's ThML editions, as kept in NEUU's
//! Bible Dictionary Dataset. (The dataset's own JSON, made from these files,
//! leaves out Smith's numbered lists and cuts long entries at 5,000
//! characters, so the build reads the editions themselves.) Each `<term>` and
//! its `<def>` is an entry, the def's paragraphs and list items its
//! paragraphs; a term given twice (Easton's Kadesh and Salmon) is one entry.
//! Each verse reference the edition marks up (`<scripRef osisRef=…>`) is a
//! link; one it did not mark ("comp. Nehe 11:13") is found in the text by
//! its book's name. A few names are corrected ([`NAME_FIXES`]), and Smith's
//! names, which its edition gives in title case ("Ark Of The Covenant"), keep
//! their small words lowercase.
//!
//! Outputs, under web/public/data:
//! - `shelf.json`: `{format, groups, works, dictionaries}`. Groups in display
//!   order (only those with works); each work as config/shelf.json gives it
//!   (`cites` too, when it has any, so the web can link a citation string to
//!   its work), plus `cited` (where the app cites it, at most [`CITED_MAX`]:
//!   `{verse, to?, where}`) and `citedCount`; and for each dictionary its
//!   number of entries and the letters it has files for.
//! - `dict/<id>/index.json`: `[[name, slug, letter]]`, sorted by name.
//! - `dict/<id>/<letter>.json`: `{slug: {name, text, refs}}`. `text` is a note
//!   line: a string, or strings and verse links (`{verse, to?, text}`) in
//!   reading order; paragraphs are separated by "\n\n", and the items of a
//!   list start with their number ("1. "). `refs` lists the verses the entry
//!   cites, a verse or `[from, to]`, sorted. The letter of an entry is always
//!   the first character of its slug.

use crate::loaded::Loaded;
use crate::sources::{Inputs, Source};
use atlas_core::refs::{self, RefQuery};
use atlas_core::Versification;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fmt::Write as _;
use std::fs;
use std::path::Path;

const CONFIG: &str = "config/shelf.json";
const ARAMAIC: &str = "config/aramaic.json";
const OUT: &str = "shelf.json";

/// The dictionaries: sources.json id, the title its edition gives itself, and
/// whether its names come in title case ("Ark Of The Covenant").
const DICTIONARIES: [(&str, &str, bool); 2] = [
    ("easton", "Easton's Bible Dictionary", false),
    ("smith", "Smith's Bible Dictionary", true),
];
/// Names an edition gets wrong: (dictionary, the edition's name, the name).
const NAME_FIXES: [(&str, &str, &str); 1] = [("smith", "High Places6813 Priest", "High Priest")];
/// The words a title-case name keeps lowercase after its first word.
const SMALL_WORDS: [&str; 15] = [
    "A", "Also", "An", "And", "At", "By", "For", "From", "In", "Of", "On", "Or", "The", "To", "With",
];

pub const LICENSES: [&str; 4] = ["public-domain", "cc-by-4.0", "cc-by-sa-4.0", "copyrighted"];
/// What `read.app` may open: a book of the Bible, or a dictionary.
const APPS: [&str; 2] = ["bible", "dictionary"];
/// The longest Simple label and plain description, in characters.
const PLAIN_MAX: usize = 48;
const WHAT_MAX: usize = 240;
/// The most places a work's card lists where the app cites it (the most
/// cited work, TAGNT, is cited at 63).
pub const CITED_MAX: usize = 100;
/// The group of the plain cards made for datasets without a work.
const FALLBACK_GROUP: (&str, &str) = ("other", "Other sources");
/// The Song of Solomon, which the dictionaries also call Canticles ("Cant. 4:14").
const SONG: u8 = 21;

// --- config/shelf.json ------------------------------------------------------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    #[serde(default)]
    _comment: Value,
    groups: Vec<Group>,
    works: Vec<Work>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Group {
    id: String,
    name: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Work {
    id: String,
    group: String,
    plain: String,
    title: String,
    by: String,
    when: String,
    what: String,
    license: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    license_note: Option<String>,
    #[serde(default)]
    datasets: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    read: Option<Read>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    find: Option<Link>,
    citation: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    cites: Vec<String>,
}

/// Where to read a work: in the app (`app`), or at a free full copy (`url`, `label`).
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Read {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    app: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    label: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Link {
    url: String,
    label: String,
}

// --- The dictionaries ---------------------------------------------------------

/// One dictionary, read and linked.
pub struct Dictionary {
    pub id: &'static str,
    /// "Easton's Bible Dictionary": the title of its work on the shelf, or the edition's.
    pub title: String,
    /// "1897": the date of its work on the shelf, or the edition's.
    pub when: String,
    pub entries: Vec<Entry>,
}

pub struct Entry {
    pub name: String,
    pub slug: String,
    pub text: Vec<Piece>,
    /// The verses the entry cites, as inclusive ranges, sorted.
    pub refs: Vec<(u32, u32)>,
}

impl Entry {
    /// The letter of the file the entry is in.
    pub fn letter(&self) -> &str {
        &self.slug[..1]
    }
}

#[derive(Debug, PartialEq)]
pub enum Piece {
    Text(String),
    Link { from: u32, to: u32, text: String },
}

/// A ThML edition, read: its title, the year of its print source, and its terms.
struct Edition {
    title: String,
    published: String,
    terms: Vec<Term>,
}

/// A term of an edition: its name and the paragraphs of its definition.
struct Term {
    name: String,
    paras: Vec<Para>,
}

/// A paragraph or list item of a definition.
#[derive(Default)]
struct Para {
    text: String,
    /// For a list item: which list of the edition it is in, and its place there (1, 2, …).
    item: Option<(usize, u32)>,
    /// The verse references the edition marks in it.
    marked: Vec<Marked>,
}

/// A verse reference the edition marks up: where it is in the text, and its
/// `osisRef` ("Bible:Exod.16.13").
#[derive(Clone, Debug, PartialEq)]
struct Marked {
    start: usize,
    end: usize,
    osis: String,
}

/// What reading a dictionary found, for the build log.
#[derive(Default)]
struct Tally {
    /// Terms the edition gives twice, made one entry.
    merged: usize,
    empty: usize,
    dropped_slugs: usize,
    renamed: usize,
    /// Marked references linked.
    marked: usize,
    /// References found in the text where the edition marked none.
    found: usize,
    /// Marked references to several chapters at once ("Psalms 49, 73, 77,
    /// 140"): cited, but not linked.
    several: usize,
    /// Marked references to books outside the BSB's 66 (the Apocrypha).
    outside: usize,
    outside_examples: Vec<String>,
    /// References whose verses the BSB does not have.
    unresolved: usize,
    unresolved_examples: Vec<String>,
    /// Elements the reader does not know, kept as their text.
    other_tags: BTreeSet<String>,
}

/// Read both dictionaries from their pinned editions and link their references.
pub fn dictionaries(
    root: &Path,
    inputs: &Inputs,
    vz: &Versification,
) -> Result<Vec<Dictionary>, String> {
    // A dictionary is named and dated as its work on the shelf says, or else as its edition does.
    let works = read_config(root)?.map(|c| c.works).unwrap_or_default();
    let mut out = Vec::new();
    for (id, title, title_case) in DICTIONARIES {
        let path = inputs.path(id, "xml");
        let xml =
            fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
        let mut t = Tally::default();
        let edition = read_edition(&xml, &mut t).map_err(|e| format!("{}: {e}", path.display()))?;
        if edition.title != title {
            return Err(format!(
                "{id}: {} is {:?}, expected {title:?}",
                path.display(),
                edition.title
            ));
        }
        let terms = edition.terms.len();
        let mut entries = Vec::new();
        let mut slugs: HashSet<String> = HashSet::new();
        for term in merge(edition.terms, &mut t) {
            let (text, marked) = join(&term.paras);
            if text.is_empty() || term.name.is_empty() {
                t.empty += 1;
                continue;
            }
            let name = fix_name(id, &term.name, title_case, &mut t);
            let Some(slug) = unique_slug(&name, &mut slugs) else {
                t.dropped_slugs += 1;
                continue;
            };
            let (pieces, refs) = link(&text, &marked, vz, &mut t);
            entries.push(Entry {
                name,
                slug,
                text: pieces,
                refs,
            });
        }
        let refs: usize = entries.iter().map(|e| e.refs.len()).sum();
        let others: Vec<&str> = t.other_tags.iter().map(String::as_str).collect();
        eprintln!(
            "dictionary {id}: {} entries from {terms} terms ({} given twice and made one, {} without text, {} without a usable address, {} names corrected); {} marked verse links and {} found in the text, {refs} references listed; {} marked references to several chapters listed but not linked; {} references outside the BSB's books (e.g. {}); {} the BSB has no verse for (e.g. {}); elements kept as text: {}",
            entries.len(),
            t.merged,
            t.empty,
            t.dropped_slugs,
            t.renamed,
            t.marked,
            t.found,
            t.several,
            t.outside,
            t.outside_examples.join(" | "),
            t.unresolved,
            t.unresolved_examples.join(" | "),
            if others.is_empty() { "none".to_string() } else { others.join(", ") },
        );
        let work = works.iter().find(|w| w.id == id);
        out.push(Dictionary {
            id,
            title: work.map_or(title, |w| w.title.trim()).to_string(),
            when: work
                .map_or(edition.published.as_str(), |w| w.when.trim())
                .to_string(),
            entries,
        });
    }
    Ok(out)
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))
}

// --- Reading a ThML edition -------------------------------------------------------
//
// The files are untrusted text, read with plain string scanning: no XML
// parser, only the few entities an edition uses.

/// The title, date and terms of a ThML edition: each `<term>` and the `<def>` after it.
fn read_edition(xml: &str, t: &mut Tally) -> Result<Edition, String> {
    let body = xml.find("<ThML.body").ok_or("no <ThML.body>")?;
    let head = &xml[..body];
    let title = element(head, "DC.Title").map_or_else(String::new, inline_text);
    let published = element(head, "published").map_or_else(String::new, inline_text);
    let mut terms = Vec::new();
    let mut lists = 0;
    let mut rest = &xml[body..];
    while let Some(after) = after_tag(rest, "term") {
        let end = after.find("</term>").ok_or("a <term> without </term>")?;
        let name = inline_text(&after[..end]);
        let tail = after[end + "</term>".len()..].trim_start();
        let def = tail
            .strip_prefix("<def")
            .filter(|d| d.starts_with(|c: char| c == '>' || c.is_whitespace()))
            .ok_or_else(|| format!("the term {name:?} has no <def> after it"))?;
        let def = &def[def.find('>').ok_or("an unclosed <def>")? + 1..];
        let end = def.find("</def>").ok_or("a <def> without </def>")?;
        terms.push(Term {
            name,
            paras: paragraphs(&def[..end], &mut lists, t),
        });
        rest = &def[end + "</def>".len()..];
    }
    if terms.is_empty() {
        return Err("no <term> in the edition".into());
    }
    Ok(Edition {
        title,
        published,
        terms,
    })
}

/// The rest of `s` after the next `<name …>` start tag, if there is one.
fn after_tag<'a>(s: &'a str, name: &str) -> Option<&'a str> {
    let open = format!("<{name}");
    let mut from = 0;
    while let Some(i) = s[from..].find(&open) {
        let at = from + i + open.len();
        let rest = &s[at..];
        if rest.starts_with(|c: char| c == '>' || c.is_whitespace()) {
            return Some(&rest[rest.find('>')? + 1..]);
        }
        from = at;
    }
    None
}

/// The content of the first `<name>…</name>` in `s`.
fn element<'a>(s: &'a str, name: &str) -> Option<&'a str> {
    let rest = after_tag(s, name)?;
    Some(&rest[..rest.find(&format!("</{name}>"))?])
}

/// The value of an attribute in a tag's text (`scripRef passage="…" osisRef="…"`).
fn attr<'a>(tag: &'a str, name: &str) -> Option<&'a str> {
    let key = format!("{name}=\"");
    let mut from = 0;
    while let Some(i) = tag[from..].find(&key) {
        let at = from + i;
        let start = at + key.len();
        if tag[..at].ends_with(char::is_whitespace) {
            return Some(&tag[start..start + tag[start..].find('"')?]);
        }
        from = start;
    }
    None
}

/// The text of some markup: its elements' text, entities decoded, whitespace collapsed.
fn inline_text(s: &str) -> String {
    let mut out = String::new();
    let mut rest = s;
    while let Some(i) = rest.find('<') {
        push_text(&mut out, &rest[..i]);
        rest = rest[i..].find('>').map_or("", |j| &rest[i + j + 1..]);
    }
    push_text(&mut out, rest);
    out.truncate(out.trim_end().len());
    out
}

/// Append text from an edition: entities decoded, each run of whitespace
/// one space (none at the start), control characters dropped.
fn push_text(out: &mut String, s: &str) {
    let mut rest = s;
    while let Some(c) = rest.chars().next() {
        let (c, n) = if c == '&' {
            entity(rest).unwrap_or(('&', 1))
        } else {
            (c, c.len_utf8())
        };
        rest = &rest[n..];
        if c.is_whitespace() {
            if !out.is_empty() && !out.ends_with(' ') {
                out.push(' ');
            }
        } else if !c.is_control() {
            out.push(c);
        }
    }
}

/// The character an entity at the start of `s` stands for ("&amp;",
/// "&#8217;", "&#x2019;"), and the entity's length.
fn entity(s: &str) -> Option<(char, usize)> {
    let end = s.find(';').filter(|&e| e <= 10)?;
    let c = match &s[1..end] {
        "amp" => '&',
        "lt" => '<',
        "gt" => '>',
        "quot" => '"',
        "apos" => '\'',
        "nbsp" => ' ',
        name => {
            let n = match name.strip_prefix("#x").or_else(|| name.strip_prefix("#X")) {
                Some(hex) => u32::from_str_radix(hex, 16).ok()?,
                None => name.strip_prefix('#')?.parse().ok()?,
            };
            char::from_u32(n)?
        }
    };
    Some((c, end + 1))
}

/// The paragraphs (`<p>`) and list items (`<li>`) of a `<def>`, and the verse
/// references the edition marks in them. Other elements (`<a>`, `<i>`) keep
/// only their text. `lists` counts the edition's lists, so that each list has
/// a number of its own.
fn paragraphs(def: &str, lists: &mut usize, t: &mut Tally) -> Vec<Para> {
    let mut out = Vec::new();
    let mut cur: Option<Para> = None;
    let mut item = 0;
    // An open <scripRef>: where its text starts and its osisRef.
    let mut open: Option<(usize, String)> = None;
    let mut rest = def;
    loop {
        let (text, tag) = match rest.find('<') {
            Some(i) => (&rest[..i], Some(i)),
            None => (rest, None),
        };
        if let Some(p) = cur.as_mut() {
            push_text(&mut p.text, text);
        } else if !text.trim().is_empty() {
            let mut p = Para::default();
            push_text(&mut p.text, text);
            cur = Some(p);
        }
        let Some(i) = tag else { break };
        let Some(j) = rest[i..].find('>') else { break };
        let tag = &rest[i + 1..i + j];
        rest = &rest[i + j + 1..];
        let closing = tag.starts_with('/');
        let name = tag
            .trim_start_matches('/')
            .split(|c: char| c.is_whitespace() || c == '/')
            .next()
            .unwrap_or("");
        match (closing, name) {
            (false, "p") => {
                finish(&mut out, cur.take());
                open = None;
                cur = Some(Para::default());
            }
            (false, "li") => {
                finish(&mut out, cur.take());
                open = None;
                item += 1;
                cur = Some(Para {
                    item: Some((*lists, item)),
                    ..Para::default()
                });
            }
            (true, "p" | "li") | (true, "ul" | "ol") => {
                finish(&mut out, cur.take());
                open = None;
            }
            (false, "ul" | "ol") => {
                finish(&mut out, cur.take());
                open = None;
                *lists += 1;
                item = 0;
            }
            (false, "scripRef") => {
                let p = cur.get_or_insert_with(Para::default);
                let osis = attr(tag, "osisRef").unwrap_or("").to_string();
                open = Some((p.text.len(), osis));
            }
            (true, "scripRef") => {
                if let (Some(p), Some((start, osis))) = (cur.as_mut(), open.take()) {
                    // The reference's text, without the space before or after it.
                    let end = p.text.trim_end().len();
                    if let Some(shown) = p.text.get(start..end) {
                        let start = end - shown.trim_start().len();
                        if start < end {
                            p.marked.push(Marked { start, end, osis });
                        }
                    }
                }
            }
            (false, "br") => {
                if let Some(p) = cur.as_mut() {
                    push_text(&mut p.text, " ");
                }
            }
            (_, "a" | "i" | "b" | "em" | "strong" | "span" | "sup" | "sub" | "scripCom") => {}
            (_, other) => {
                t.other_tags.insert(other.to_string());
            }
        }
    }
    finish(&mut out, cur);
    out
}

/// Keep a paragraph that has text, without the space at its end.
fn finish(out: &mut Vec<Para>, p: Option<Para>) {
    if let Some(mut p) = p {
        p.text.truncate(p.text.trim_end().len());
        let n = p.text.len();
        p.marked.retain(|m| m.end <= n);
        if !p.text.is_empty() {
            out.push(p);
        }
    }
}

/// The terms in order, a term given twice made one, its paragraphs in order.
fn merge(terms: Vec<Term>, t: &mut Tally) -> Vec<Term> {
    let mut out: Vec<Term> = Vec::new();
    let mut at: HashMap<String, usize> = HashMap::new();
    for term in terms {
        if let Some(&i) = at.get(&term.name) {
            out[i].paras.extend(term.paras);
            t.merged += 1;
        } else {
            at.insert(term.name.clone(), out.len());
            out.push(term);
        }
    }
    out
}

/// An entry's text, its paragraphs separated by a blank line and the items
/// of a list numbered ("1. ") when the list has more than one; and where its
/// marked references are in it.
fn join(paras: &[Para]) -> (String, Vec<Marked>) {
    let mut sizes: HashMap<usize, u32> = HashMap::new();
    for (list, _) in paras.iter().filter_map(|p| p.item) {
        *sizes.entry(list).or_default() += 1;
    }
    let mut text = String::new();
    let mut marked = Vec::new();
    for p in paras {
        if !text.is_empty() {
            text.push_str("\n\n");
        }
        if let Some((list, n)) = p.item {
            if sizes.get(&list).is_some_and(|&k| k > 1) {
                let _ = write!(text, "{n}. ");
            }
        }
        let at = text.len();
        text.push_str(&p.text);
        marked.extend(p.marked.iter().map(|m| Marked {
            start: m.start + at,
            end: m.end + at,
            osis: m.osis.clone(),
        }));
    }
    (text, marked)
}

/// The name an entry is shown under: the edition's, corrected where it is
/// wrong ([`NAME_FIXES`]), and for an edition in title case, with its small
/// words lowercase ("Ark of the Covenant").
fn fix_name(id: &str, name: &str, title_case: bool, t: &mut Tally) -> String {
    if let Some(&(_, _, fixed)) = NAME_FIXES.iter().find(|f| f.0 == id && f.1 == name) {
        t.renamed += 1;
        return fixed.to_string();
    }
    if !title_case {
        return name.to_string();
    }
    name.split(' ')
        .enumerate()
        .map(|(i, w)| {
            if i > 0 && SMALL_WORDS.contains(&w) {
                w.to_lowercase()
            } else {
                w.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// The entry's address in its dictionary, made from its name: lowercase
/// letters and digits, its words joined by hyphens, apostrophes dropped
/// ("Abraham’s bosom" is abrahams-bosom); "-2", "-3" for a second and third
/// entry with the same one ("Hail" and "Hail!"). `None` if it would not start
/// with a letter.
fn unique_slug(name: &str, seen: &mut HashSet<String>) -> Option<String> {
    let mut base = String::new();
    for c in name.chars().flat_map(char::to_lowercase) {
        if matches!(c, '\'' | '’') {
            continue;
        }
        if c.is_ascii_lowercase() || c.is_ascii_digit() {
            base.push(c);
        } else if !base.is_empty() && !base.ends_with('-') {
            base.push('-');
        }
    }
    let base = base.trim_end_matches('-').to_string();
    if !base.starts_with(|c: char| c.is_ascii_lowercase()) {
        return None;
    }
    let mut slug = base.clone();
    let mut n = 1;
    while seen.contains(&slug) {
        n += 1;
        slug = format!("{base}-{n}");
    }
    seen.insert(slug.clone());
    Some(slug)
}

// --- Verse references in the text -------------------------------------------------

/// A reference found in an entry's text: where it is and the verses it names.
struct Found {
    start: usize,
    end: usize,
    from: u32,
    to: u32,
}

/// Why a marked reference is not linked.
#[derive(Debug, PartialEq)]
enum Unlinked {
    /// Its book is not one of the BSB's 66 (the Apocrypha).
    Outside,
    /// The BSB has no such verse, or it names a whole book.
    NoVerse,
}

/// An entry's verse links and the verses it cites: each reference the
/// edition marks, and each one found by its book's name in the text between
/// them. A marked reference to several chapters at once ("Psalms 49, 73, 77,
/// 140") is cited but not linked, since one link cannot take the reader to
/// all of them.
fn link(
    text: &str,
    marked: &[Marked],
    vz: &Versification,
    t: &mut Tally,
) -> (Vec<Piece>, Vec<(u32, u32)>) {
    let mut found = Vec::new();
    let mut refs: BTreeSet<(u32, u32)> = BTreeSet::new();
    for m in marked {
        let parts: Vec<&str> = m.osis.split_whitespace().collect();
        let mut ranges = Vec::new();
        for part in parts.iter().copied().chain(parts.is_empty().then_some("")) {
            match osis_range(part, vz) {
                Ok(r) => ranges.push(r),
                Err(why) => {
                    let (count, examples) = match why {
                        Unlinked::Outside => (&mut t.outside, &mut t.outside_examples),
                        Unlinked::NoVerse => (&mut t.unresolved, &mut t.unresolved_examples),
                    };
                    *count += 1;
                    if examples.len() < 5 {
                        examples.push(format!("{} ({part})", &text[m.start..m.end]));
                    }
                }
            }
        }
        match (parts.len(), ranges.as_slice()) {
            (1, &[(from, to)]) => {
                t.marked += 1;
                found.push(Found {
                    start: m.start,
                    end: m.end,
                    from,
                    to,
                });
            }
            (n, _) if n > 1 => t.several += 1,
            _ => {}
        }
        refs.extend(ranges);
    }
    // The text between the marked references.
    let mut spans: Vec<(usize, usize)> = marked.iter().map(|m| (m.start, m.end)).collect();
    spans.sort_unstable();
    let mut at = 0;
    for (start, end) in spans.into_iter().chain([(text.len(), text.len())]) {
        if at < start {
            for f in scan(&text[at..start], vz, t) {
                t.found += 1;
                found.push(Found {
                    start: f.start + at,
                    end: f.end + at,
                    ..f
                });
            }
        }
        at = at.max(end);
    }
    found.sort_by_key(|f| f.start);
    refs.extend(found.iter().map(|f| (f.from, f.to)));

    let mut pieces = Vec::new();
    let mut at = 0;
    for f in found.iter().filter(|f| f.start < f.end) {
        if f.start < at {
            continue;
        }
        if at < f.start {
            pieces.push(Piece::Text(text[at..f.start].to_string()));
        }
        pieces.push(Piece::Link {
            from: f.from,
            to: f.to,
            text: text[f.start..f.end].to_string(),
        });
        at = f.end;
    }
    if at < text.len() {
        pieces.push(Piece::Text(text[at..].to_string()));
    }
    (pieces, refs.into_iter().collect())
}

/// A verse, passage or chapter as an `osisRef` gives it ("Bible:Exod.16.13",
/// "Bible:Gen.40.1-Gen.40.21", "Bible:Lev.8"), as its verses in the BSB.
fn osis_range(s: &str, vz: &Versification) -> Result<(u32, u32), Unlinked> {
    let s = s.strip_prefix("Bible:").ok_or(Unlinked::NoVerse)?;
    let (a, b) = s.split_once('-').unwrap_or((s, ""));
    let point = |p: &str| -> Result<(u8, u16, u16), Unlinked> {
        let mut it = p.split('.');
        let book = it.next().unwrap_or("");
        let book = atlas_core::canon::by_osis(book).ok_or(if book.is_empty() {
            Unlinked::NoVerse
        } else {
            Unlinked::Outside
        })?;
        let mut number = || -> Result<u16, Unlinked> {
            it.next()
                .map_or(Ok(0), |x| x.parse().map_err(|_| Unlinked::NoVerse))
        };
        let (chapter, verse) = (number()?, number()?);
        if it.next().is_some() {
            return Err(Unlinked::NoVerse);
        }
        Ok((book, chapter, verse))
    };
    let (book, chapter, verse) = point(a)?;
    let (end_book, end_chapter, end_verse) = if b.is_empty() {
        (book, chapter, verse)
    } else {
        point(b)?
    };
    if end_book != book || chapter == 0 || end_chapter == 0 || (verse == 0) != (end_verse == 0) {
        return Err(Unlinked::NoVerse);
    }
    refs::resolve(
        RefQuery {
            book,
            chapter,
            verse,
            end_chapter,
            end_verse,
        },
        vz,
    )
    .ok_or(Unlinked::NoVerse)
}

/// Every reference in a text that names its book ("Ex. 16:13", "1 Chr. 2:10",
/// "Song of Solomon 8:11"), and the references that continue it
/// ("Numbers 26:59; 33:39", "Ruth 2:7, 15", "Gen. 40:1-21; 41:9"). A
/// reference without a verse ("Lev. 8") or without a book ("(11:32)") is not
/// read, nor is a book outside the BSB's 66 ("1 Macc. 1:57", "Ecclus.
/// 3:30"). Used on the text the edition did not mark up.
fn scan(text: &str, vz: &Versification, t: &mut Tally) -> Vec<Found> {
    let mut found = Vec::new();
    let mut i = 0;
    while i < text.len() {
        let starts =
            text.as_bytes()[i].is_ascii_uppercase() || matches!(text.as_bytes()[i], b'1'..=b'3');
        if starts && word_start(text, i) {
            if let Some((book, n)) = book_at(&text[i..]) {
                if let Some(end) = list(text, i, i + n, book, vz, &mut found, t) {
                    i = end;
                    continue;
                }
            }
        }
        i += text[i..].chars().next().map_or(1, char::len_utf8);
    }
    found
}

/// A list of references in one book, starting with the one at `at` (after the
/// book's name, which starts at `start`). Returns where the list ends, or
/// `None` if no chapter and verse follow the name.
fn list(
    text: &str,
    start: usize,
    at: usize,
    book: u8,
    vz: &Versification,
    found: &mut Vec<Found>,
    t: &mut Tally,
) -> Option<usize> {
    let (ch, v, n) = chapter_verse(&text[at..])?;
    let (ech, ev, m) = range_end(&text[at + n..], ch).unwrap_or((ch, v, 0));
    let mut end = at + n + m;
    if !word_end(text, end) {
        return None;
    }
    add(
        text,
        (start, end),
        RefQuery {
            book,
            chapter: ch,
            verse: v,
            end_chapter: ech,
            end_verse: ev,
        },
        vz,
        found,
        t,
    );
    let mut chapter = ech;
    while let Some(&sep @ (b',' | b';')) = text.as_bytes().get(end) {
        let mut j = end + 1;
        while text.as_bytes().get(j) == Some(&b' ') {
            j += 1;
        }
        // The next book's name ("; 2 Cor. 1:4") starts a list of its own.
        if book_at(&text[j..]).is_some() {
            break;
        }
        let (c, v, n) = match chapter_verse(&text[j..]) {
            Some(x) => x,
            // ", 15" is another verse of the same chapter; "; 9" could be a
            // chapter or a verse, so it is left alone.
            None if sep == b',' => match number(&text[j..]) {
                Some((v, n)) => (chapter, v, n),
                None => break,
            },
            None => break,
        };
        let (ec, ev, m) = range_end(&text[j + n..], c).unwrap_or((c, v, 0));
        let k = j + n + m;
        if !word_end(text, k) {
            break;
        }
        add(
            text,
            (j, k),
            RefQuery {
                book,
                chapter: c,
                verse: v,
                end_chapter: ec,
                end_verse: ev,
            },
            vz,
            found,
            t,
        );
        chapter = ec;
        end = k;
    }
    Some(end)
}

fn add(
    text: &str,
    (start, end): (usize, usize),
    q: RefQuery,
    vz: &Versification,
    found: &mut Vec<Found>,
    t: &mut Tally,
) {
    let resolved = if q.verse == 0 || q.end_verse == 0 {
        None
    } else {
        refs::resolve(q, vz)
    };
    match resolved {
        Some((from, to)) => found.push(Found {
            start,
            end,
            from,
            to,
        }),
        None => {
            t.unresolved += 1;
            if t.unresolved_examples.len() < 5 {
                t.unresolved_examples.push(text[start..end].to_string());
            }
        }
    }
}

/// The book a reference starts with at the beginning of `s`, and how far its
/// first number is: "Ex. 16:13", "1 Chr. 2:10", "2Sa 8:2", "Song of Solomon
/// 8:11". The name must be one of the BSB's books, read exactly (no guessing
/// at misspellings, so "Ecclus." is not Ecclesiastes), and start with a
/// capital letter or a book number.
fn book_at(s: &str) -> Option<(u8, usize)> {
    let b = s.as_bytes();
    let mut i = 0;
    if matches!(b.first(), Some(b'1'..=b'3')) {
        i = if b.get(1) == Some(&b' ') { 2 } else { 1 };
    }
    if !b.get(i).is_some_and(u8::is_ascii_uppercase) {
        return None;
    }
    let word = i;
    i += 1;
    while b.get(i).is_some_and(u8::is_ascii_alphabetic) {
        i += 1;
    }
    if &s[word..i] == "Song" {
        if let Some(tail) = [" of Solomon", " of Songs"]
            .iter()
            .find(|t| s[i..].starts_with(**t))
        {
            i += tail.len();
        }
    }
    let book = book_named(&s[..i])?;
    if b.get(i) == Some(&b'.') {
        i += 1;
    }
    while b.get(i) == Some(&b' ') {
        i += 1;
    }
    b.get(i)
        .is_some_and(u8::is_ascii_digit)
        .then_some((book, i))
}

fn book_named(name: &str) -> Option<u8> {
    if name == "Cant" {
        return Some(SONG);
    }
    refs::parse_book(name)
}

/// A number of one to three digits at the start of `s` (so not a year), and its length.
fn number(s: &str) -> Option<(u16, usize)> {
    let n = s.bytes().take_while(u8::is_ascii_digit).count();
    if n == 0 || n > 3 {
        return None;
    }
    Some((s[..n].parse().ok()?, n))
}

/// "16:13" at the start of `s`: chapter, verse and length.
fn chapter_verse(s: &str) -> Option<(u16, u16, usize)> {
    let (c, n) = number(s)?;
    let rest = s[n..].strip_prefix(':')?;
    let (v, m) = number(rest)?;
    Some((c, v, n + 1 + m))
}

/// The end of a range at the start of `s`: "-21" (in `chapter`) or "-25:10".
fn range_end(s: &str, chapter: u16) -> Option<(u16, u16, usize)> {
    let dash = ['-', '–'].iter().find(|d| s.starts_with(**d))?.len_utf8();
    match chapter_verse(&s[dash..]) {
        Some((c, v, n)) => Some((c, v, dash + n)),
        None => number(&s[dash..]).map(|(v, n)| (chapter, v, dash + n)),
    }
}

/// Does a word start at byte `i` (nothing alphanumeric right before it)?
fn word_start(s: &str, i: usize) -> bool {
    !s[..i]
        .chars()
        .next_back()
        .is_some_and(char::is_alphanumeric)
}

/// Does a word end at byte `i` (nothing alphanumeric right after it)?
fn word_end(s: &str, i: usize) -> bool {
    !s[i..].chars().next().is_some_and(char::is_alphanumeric)
}

/// A note line: a string when there are no links, else its pieces in order.
pub fn note_line(pieces: &[Piece]) -> Value {
    if let [Piece::Text(s)] = pieces {
        return json!(s);
    }
    Value::Array(
        pieces
            .iter()
            .map(|p| match p {
                Piece::Text(s) => json!(s),
                Piece::Link { from, to, text } if to > from => {
                    json!({ "verse": from, "to": to, "text": text })
                }
                Piece::Link { from, text, .. } => json!({ "verse": from, "text": text }),
            })
            .collect(),
    )
}

/// A verse, or a passage as `[from, to]`.
pub fn range_json(&(from, to): &(u32, u32)) -> Value {
    if to > from {
        json!([from, to])
    } else {
        json!(from)
    }
}

// --- Where the app cites each work ---------------------------------------------------

/// A source the app shows, and the verses it is shown at.
struct Citation {
    text: String,
    at: Vec<(u32, u32)>,
    place: &'static str,
}

/// The source strings of config/aramaic.json, each with the verses of its
/// word or section. Nothing if the file is not there.
fn citations(root: &Path, vz: &Versification) -> Result<Vec<Citation>, String> {
    let path = root.join(ARAMAIC);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let doc: Value = read_json(&path)?;
    let at = |s: &Value| s.as_str().and_then(|s| refs::resolve(refs::parse(s)?, vz));
    let strings = |v: &Value| -> Vec<String> {
        v.as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect()
    };
    let mut out = Vec::new();
    for w in doc["words"].as_array().into_iter().flatten() {
        let places: Vec<(u32, u32)> = w["refs"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(at)
            .collect();
        for text in strings(&w["sources"]) {
            out.push(Citation {
                text,
                at: places.clone(),
                place: "aramaic",
            });
        }
    }
    for s in doc["sections"].as_array().into_iter().flatten() {
        let places: Vec<(u32, u32)> = match (at(&s["from"]), at(&s["to"])) {
            (Some((a, _)), Some((_, b))) => vec![(a, b.max(a))],
            _ => Vec::new(),
        };
        for text in strings(&s["sources"]) {
            out.push(Citation {
                text,
                at: places.clone(),
                place: "aramaic",
            });
        }
    }
    Ok(out)
}

// --- shelf.json ------------------------------------------------------------------------

/// The files to write under web/public/data: shelf.json and the dictionaries.
pub fn build(
    root: &Path,
    inputs: &Inputs,
    vz: &Versification,
    dicts: &[Dictionary],
) -> Result<Vec<(String, Vec<u8>)>, String> {
    let config = read_config(root)?;
    let cites = citations(root, vz)?;
    let (shelf, warnings) = assemble(config, &inputs.spec.sources, dicts, &cites)?;
    for w in &warnings {
        eprintln!("warning: {w}");
    }
    let bytes = serde_json::to_vec(&shelf).map_err(|e| e.to_string())?;
    if mentions_esv(&String::from_utf8_lossy(&bytes)) {
        return Err(format!(
            "{OUT} would mention the ESV, which this project never quotes"
        ));
    }
    let mut files = vec![(OUT.to_string(), bytes)];
    for d in dicts {
        let mut index: Vec<&Entry> = d.entries.iter().collect();
        index.sort_by(|a, b| {
            (a.name.to_lowercase(), &a.slug).cmp(&(b.name.to_lowercase(), &b.slug))
        });
        let rows: Vec<Value> = index
            .iter()
            .map(|e| json!([e.name, e.slug, e.letter()]))
            .collect();
        files.push((
            format!("dict/{}/index.json", d.id),
            serde_json::to_vec(&rows).map_err(|e| e.to_string())?,
        ));
        let mut letters: BTreeMap<&str, serde_json::Map<String, Value>> = BTreeMap::new();
        for e in &d.entries {
            let o = json!({ "name": e.name, "text": note_line(&e.text), "refs": e.refs.iter().map(range_json).collect::<Vec<_>>() });
            letters
                .entry(e.letter())
                .or_default()
                .insert(e.slug.clone(), o);
        }
        for (letter, entries) in letters {
            files.push((
                format!("dict/{}/{letter}.json", d.id),
                serde_json::to_vec(&entries).map_err(|e| e.to_string())?,
            ));
        }
    }
    let sizes: Vec<String> = files
        .iter()
        .map(|(p, b)| format!("{p} {:.0} KB", b.len() as f64 / 1e3))
        .collect();
    eprintln!("shelf files: {}", sizes.join(", "));
    Ok(files)
}

/// config/shelf.json, or `None` if it is not there.
fn read_config(root: &Path) -> Result<Option<Config>, String> {
    let path = root.join(CONFIG);
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    if mentions_esv(&text) {
        return Err(format!(
            "{CONFIG} mentions the ESV, which this project never quotes"
        ));
    }
    serde_json::from_str(&text)
        .map(Some)
        .map_err(|e| format!("parsing {CONFIG}: {e}"))
}

/// shelf.json from the config (if there is one), sources.json, the
/// dictionaries and the app's citations; and the warnings to print.
fn assemble(
    config: Option<Config>,
    sources: &[Source],
    dicts: &[Dictionary],
    cites: &[Citation],
) -> Result<(Value, Vec<String>), String> {
    let mut warnings = Vec::new();
    let Config {
        groups, mut works, ..
    } = match config {
        Some(c) => c,
        None => {
            warnings.push(format!(
                "{CONFIG} is missing: every dataset gets a plain card"
            ));
            Config {
                _comment: Value::Null,
                groups: Vec::new(),
                works: Vec::new(),
            }
        }
    };
    check(&groups, &works, sources, dicts)?;
    let configured = works.len();

    // A plain card for each dataset no work claims.
    let claimed: HashSet<&str> = works
        .iter()
        .flat_map(|w| w.datasets.iter().map(String::as_str))
        .collect();
    let mut plain_cards = Vec::new();
    for s in sources.iter().filter(|s| !claimed.contains(s.id.as_str())) {
        warnings.push(format!(
            "dataset {} has no work in {CONFIG}; made a plain card from sources.json",
            s.id
        ));
        let card = fallback(s);
        if !LICENSES.contains(&card.license.as_str()) {
            warnings.push(format!(
                "dataset {}: cannot tell the license from {:?}; its plain card shows those words",
                s.id, s.license
            ));
        }
        plain_cards.push(card);
    }
    works.extend(plain_cards);
    let mut groups = groups;
    if works.iter().any(|w| w.group == FALLBACK_GROUP.0)
        && !groups.iter().any(|g| g.id == FALLBACK_GROUP.0)
    {
        groups.push(Group {
            id: FALLBACK_GROUP.0.to_string(),
            name: FALLBACK_GROUP.1.to_string(),
        });
    }
    groups.retain(|g| works.iter().any(|w| w.group == g.id));

    // Where the app cites each work. A citation that names several works is
    // credited to the first, as the web links it, and warned about.
    let mut cited: Vec<BTreeSet<(u32, u32, &str)>> = vec![BTreeSet::new(); works.len()];
    let mut unmatched: BTreeSet<&str> = BTreeSet::new();
    let mut several: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
    for c in cites {
        let hits: Vec<usize> = works
            .iter()
            .enumerate()
            .filter(|(_, w)| w.cites.iter().any(|s| c.text.contains(s.as_str())))
            .map(|(i, _)| i)
            .collect();
        match hits.as_slice() {
            [] => {
                unmatched.insert(c.text.as_str());
            }
            [first, rest @ ..] => {
                cited[*first].extend(c.at.iter().map(|&(a, b)| (a, b, c.place)));
                if !rest.is_empty() {
                    several.insert(
                        c.text.as_str(),
                        hits.iter().map(|&i| works[i].id.as_str()).collect(),
                    );
                }
            }
        }
    }
    if !unmatched.is_empty() {
        let list: Vec<String> = unmatched.iter().map(|s| format!("  {s}")).collect();
        warnings.push(format!(
            "{} citations the app shows match no work's \"cites\" in {CONFIG}:\n{}",
            unmatched.len(),
            list.join("\n")
        ));
    }
    if !several.is_empty() {
        let list: Vec<String> = several
            .iter()
            .map(|(s, ids)| format!("  {s} (credited to {})", ids.join(", ")))
            .collect();
        warnings.push(format!(
            "{} citations the app shows match more than one work's \"cites\" in {CONFIG}, and are credited to the first:\n{}",
            several.len(),
            list.join("\n")
        ));
    }

    let mut works_json = Vec::new();
    for (w, places) in works.iter().zip(&cited) {
        let mut o = serde_json::to_value(w).map_err(|e| e.to_string())?;
        let list: Vec<Value> = places
            .iter()
            .take(CITED_MAX)
            .map(|&(a, b, place)| {
                if b > a {
                    json!({ "verse": a, "to": b, "where": place })
                } else {
                    json!({ "verse": a, "where": place })
                }
            })
            .collect();
        o["cited"] = json!(list);
        o["citedCount"] = json!(places.len());
        works_json.push(o);
    }
    let mut dictionaries = serde_json::Map::new();
    for d in dicts {
        let letters: BTreeSet<&str> = d.entries.iter().map(Entry::letter).collect();
        dictionaries.insert(
            d.id.to_string(),
            json!({ "entries": d.entries.len(), "letters": letters }),
        );
    }
    let matched = cites.len()
        - cites
            .iter()
            .filter(|c| unmatched.contains(c.text.as_str()))
            .count();
    eprintln!(
        "shelf: {} works in {} groups ({configured} from {CONFIG}, {} plain cards from sources.json); {matched} of {} citations matched to a work",
        works.len(),
        groups.len(),
        works.len() - configured,
        cites.len()
    );
    Ok((
        json!({ "format": 1, "groups": groups, "works": works_json, "dictionaries": dictionaries }),
        warnings,
    ))
}

/// Checks config/shelf.json; the first problem fails the build.
fn check(
    groups: &[Group],
    works: &[Work],
    sources: &[Source],
    dicts: &[Dictionary],
) -> Result<(), String> {
    let mut group_ids = HashSet::new();
    for g in groups {
        let at = format!("{CONFIG}: group {:?}", g.id);
        if g.id.is_empty() || !g.id.bytes().all(|c| c.is_ascii_lowercase() || c == b'-') {
            return Err(format!("{at}: id must be lowercase letters and hyphens"));
        }
        if !group_ids.insert(g.id.as_str()) {
            return Err(format!("{at}: id is used by an earlier group"));
        }
        if g.name.trim().is_empty() {
            return Err(format!("{at}: name is empty"));
        }
    }
    let mut ids = HashSet::new();
    let mut claimed: HashMap<&str, &str> = HashMap::new();
    for w in works {
        let fail = |problem: String| Err(format!("{CONFIG}: work {:?}: {problem}", w.id));
        if w.id.is_empty()
            || !w
                .id
                .bytes()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
        {
            return fail("id must be lowercase letters, digits and hyphens".into());
        }
        if !ids.insert(w.id.as_str()) {
            return fail("id is used by an earlier work".into());
        }
        if !group_ids.contains(w.group.as_str()) {
            return fail(format!("group {:?} is not one of the groups", w.group));
        }
        for (field, s) in [
            ("plain", &w.plain),
            ("title", &w.title),
            ("by", &w.by),
            ("when", &w.when),
            ("what", &w.what),
            ("citation", &w.citation),
        ] {
            if s.trim().is_empty() {
                return fail(format!("{field} is empty"));
            }
        }
        for (field, s, max) in [("plain", &w.plain, PLAIN_MAX), ("what", &w.what, WHAT_MAX)] {
            let n = s.chars().count();
            if n > max {
                return fail(format!("{field} has {n} characters, at most {max}: {s:?}"));
            }
        }
        if !LICENSES.contains(&w.license.as_str()) {
            return fail(format!(
                "license {:?} is not one of: {}",
                w.license,
                LICENSES.join(", ")
            ));
        }
        for d in &w.datasets {
            if !sources.iter().any(|s| &s.id == d) {
                return fail(format!("dataset {d:?} is not in sources.json"));
            }
            if let Some(other) = claimed.insert(d, &w.id) {
                return fail(format!("dataset {d:?} already belongs to work {other:?}"));
            }
        }
        if w.license == "copyrighted" {
            if w.read.is_some() {
                return fail(
                    "a copyrighted work is only cited and linked: it has no \"read\"".into(),
                );
            }
            if w.find.is_none() {
                return fail("a copyrighted work needs \"find\": a citation link".into());
            }
            if !w.datasets.is_empty() {
                return fail("a copyrighted work cannot be a dataset the app ships".into());
            }
        }
        if let Some(r) = &w.read {
            match (&r.app, &r.url, &r.label) {
                (Some(app), None, None) => {
                    if !APPS.contains(&app.as_str()) {
                        return fail(format!(
                            "read.app {app:?} is not one of: {}",
                            APPS.join(", ")
                        ));
                    }
                    if app == "dictionary" && !dicts.iter().any(|d| d.id == w.id) {
                        return fail("read.app \"dictionary\" needs the work's id to be a dictionary's (easton, smith)".into());
                    }
                }
                (None, Some(url), Some(label)) => {
                    if !https(url) || label.trim().is_empty() {
                        return fail(format!(
                            "read needs an https url and a label, not {url:?}, {label:?}"
                        ));
                    }
                }
                _ => return fail("read is either {\"app\"} or {\"url\", \"label\"}".into()),
            }
        }
        if let Some(f) = &w.find {
            if !https(&f.url) || f.label.trim().is_empty() {
                return fail(format!(
                    "find needs an https url and a label, not {:?}, {:?}",
                    f.url, f.label
                ));
            }
        }
        if w.cites.iter().any(|c| c.trim().is_empty()) {
            return fail("cites has an empty string".into());
        }
    }
    Ok(())
}

/// The plain card for a dataset that no work claims, from its sources.json
/// entry. When its license cannot be read as one of [`LICENSES`], the card
/// gives the license in sources.json's own words.
fn fallback(s: &Source) -> Work {
    let by = match s.repo.strip_prefix("https://github.com/") {
        Some(rest) => rest.split('/').next().unwrap_or(rest).to_string(),
        None => host(&s.homepage).to_string(),
    };
    let link = [&s.homepage, &s.repo].into_iter().find(|u| https(u));
    let (license, license_note) = match license_kind(&s.license) {
        Some(kind) => (kind.to_string(), Some(s.license.clone())),
        None => (s.license.trim().to_string(), None),
    };
    Work {
        id: s.id.clone(),
        group: FALLBACK_GROUP.0.to_string(),
        plain: "Open dataset".to_string(),
        title: s.title.clone(),
        by,
        when: String::new(),
        what: shorten(&s.provides, WHAT_MAX),
        license,
        license_note,
        datasets: vec![s.id.clone()],
        read: None,
        find: link.map(|url| Link {
            url: url.clone(),
            label: "Homepage".to_string(),
        }),
        citation: s.attribution.clone(),
        cites: Vec::new(),
    }
}

/// The license of a sources.json entry as one of [`LICENSES`], read loosely,
/// in any case and spelling ("CC BY-SA 4.0", "cc-by 4.0", "Creative Commons
/// Attribution 4.0", "CC0 1.0", "in the public domain"): share-alike when any
/// part is, then CC BY, then public domain. `None` when it cannot tell, and
/// for any other Creative Commons license (another version, NC or ND).
fn license_kind(s: &str) -> Option<&'static str> {
    let folded: String = s
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '.' { c } else { ' ' })
        .collect();
    let words: Vec<&str> = folded.split_whitespace().collect();
    let has = |seq: &[&str]| words.windows(seq.len()).any(|w| w == seq);
    let cc = has(&["cc"]) || has(&["creative", "commons"]);
    let other = ["nc", "nd", "noncommercial", "noderivatives", "noderivs"]
        .iter()
        .any(|w| has(&[w]));
    let v4 = has(&["4.0"]);
    if cc && !other && v4 && (has(&["by", "sa"]) || has(&["sharealike"]) || has(&["share", "alike"])) {
        Some("cc-by-sa-4.0")
    } else if cc && !other && v4 && (has(&["by"]) || has(&["attribution"])) {
        Some("cc-by-4.0")
    } else if has(&["cc0"]) || has(&["public", "domain"]) {
        Some("public-domain")
    } else {
        None
    }
}

fn https(url: &str) -> bool {
    url.len() > "https://".len()
        && url.starts_with("https://")
        && !url.contains(char::is_whitespace)
}

fn host(url: &str) -> &str {
    let rest = url.split("://").nth(1).unwrap_or(url);
    let host = rest.split('/').next().unwrap_or(rest);
    host.strip_prefix("www.").unwrap_or(host)
}

/// `s` cut at a word to at most `max` characters, with "…" when cut.
fn shorten(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    let mut out: String = s.chars().take(max - 1).collect();
    if let Some(i) = out.rfind(' ') {
        out.truncate(i);
    }
    out.truncate(out.trim_end_matches(|c: char| !c.is_alphanumeric()).len());
    out.push('…');
    out
}

/// "ESV" as a whole word, in any case.
fn mentions_esv(s: &str) -> bool {
    s.split(|c: char| !c.is_alphanumeric())
        .any(|w| w.eq_ignore_ascii_case("esv"))
}

// --- atlas verify -------------------------------------------------------------------------

fn load(d: &Loaded, rel: &str) -> Result<Value, String> {
    read_json(&d.dir.join(rel))
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let mut out = Vec::new();
    let text = fs::read_to_string(d.dir.join(OUT)).map_err(|e| format!("reading {OUT}: {e}"))?;
    let shelf: Value = serde_json::from_str(&text).map_err(|e| format!("parsing {OUT}: {e}"))?;
    let groups: Vec<&str> = shelf["groups"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|g| g["id"].as_str())
        .collect();
    let works = shelf["works"].as_array().ok_or("shelf.json has no works")?;
    out.push((
        !mentions_esv(&text),
        "shelf.json does not mention the ESV".to_string(),
    ));
    out.push((
        !groups.is_empty() && groups.iter().collect::<HashSet<_>>().len() == groups.len(),
        format!("shelf groups are unique: {groups:?}"),
    ));
    let ids: Vec<&str> = works.iter().filter_map(|w| w["id"].as_str()).collect();
    out.push((
        ids.len() == works.len() && ids.iter().collect::<HashSet<_>>().len() == ids.len(),
        "every shelf work has a unique id".to_string(),
    ));
    for w in works {
        let id = w["id"].as_str().unwrap_or("?");
        out.push((
            w["group"].as_str().is_some_and(|g| groups.contains(&g)),
            format!("shelf work {id}: its group exists"),
        ));
        // A plain card may give a license in sources.json's own words; the
        // build checks every configured work's against LICENSES.
        let plain_card = w["group"] == FALLBACK_GROUP.0 && w["plain"] == "Open dataset";
        out.push((
            w["license"].as_str().is_some_and(|l| {
                LICENSES.contains(&l) || (plain_card && !l.trim().is_empty() && l != "copyrighted")
            }),
            format!("shelf work {id}: license is one of {LICENSES:?}, or a plain card's own words"),
        ));
        if w["license"] == "copyrighted" {
            let ok = w["read"].is_null()
                && w["find"]["url"].is_string()
                && w["datasets"].as_array().is_none_or(Vec::is_empty);
            out.push((
                ok,
                format!("shelf work {id}: copyrighted, so it has find and no read and no datasets"),
            ));
        }
        let urls = [&w["read"]["url"], &w["find"]["url"]];
        out.push((
            urls.iter()
                .all(|u| u.is_null() || u.as_str().is_some_and(https)),
            format!("shelf work {id}: links are https"),
        ));
        if w["read"]["app"] == "dictionary" {
            out.push((
                shelf["dictionaries"][id].is_object(),
                format!("shelf work {id}: opens a dictionary the build made"),
            ));
        }
        let n = d.vz.verse_count();
        let cited = w["cited"].as_array().map_or(&[][..], Vec::as_slice);
        let ok = cited.len() <= CITED_MAX
            && w["citedCount"]
                .as_u64()
                .is_some_and(|c| c as usize >= cited.len())
            && cited.iter().all(|c| {
                c["verse"].as_u64().is_some_and(|v| v < u64::from(n)) && c["where"].is_string()
            });
        out.push((
            ok,
            format!("shelf work {id}: where it is cited is well formed"),
        ));
    }
    // Each dataset belongs to exactly one work.
    let mut owners: HashMap<&str, usize> = HashMap::new();
    for w in works {
        for ds in w["datasets"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
        {
            *owners.entry(ds).or_default() += 1;
        }
    }
    let datasets: Vec<&str> = d.meta["sources"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|s| s["id"].as_str())
        .collect();
    let wrong: Vec<&&str> = datasets
        .iter()
        .filter(|s| owners.get(**s) != Some(&1))
        .collect();
    out.push((
        wrong.is_empty(),
        format!("every dataset belongs to exactly one shelf work; not: {wrong:?}"),
    ));
    let unknown: Vec<&&str> = owners.keys().filter(|s| !datasets.contains(s)).collect();
    out.push((
        unknown.is_empty(),
        format!("every shelf dataset is in sources.json; not: {unknown:?}"),
    ));

    // The dictionaries.
    let n = d.vz.verse_count();
    for (id, min) in [("easton", 3_900), ("smith", 4_500)] {
        let entries = shelf["dictionaries"][id]["entries"].as_u64().unwrap_or(0);
        out.push((
            entries >= min,
            format!("{id} has {entries} entries, expected {min} or more"),
        ));
        let index = load(d, &format!("dict/{id}/index.json"))?;
        let rows = index.as_array().ok_or("dictionary index is not a list")?;
        let names: Vec<String> = rows
            .iter()
            .map(|r| r[0].as_str().unwrap_or("").to_lowercase())
            .collect();
        out.push((
            rows.len() as u64 == entries,
            format!("{id}: the index lists {} entries of {entries}", rows.len()),
        ));
        out.push((
            names.windows(2).all(|w| w[0] <= w[1]),
            format!("{id}: the index is sorted by name"),
        ));
        let mut files: HashMap<String, Value> = HashMap::new();
        for letter in shelf["dictionaries"][id]["letters"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
        {
            files.insert(
                letter.to_string(),
                load(d, &format!("dict/{id}/{letter}.json"))?,
            );
        }
        let missing = rows
            .iter()
            .filter(|r| {
                let (slug, letter) = (r[1].as_str().unwrap_or(""), r[2].as_str().unwrap_or(""));
                !slug.starts_with(letter)
                    || letter.len() != 1
                    || !files.get(letter).is_some_and(|f| f[slug]["name"] == r[0])
            })
            .count();
        out.push((
            missing == 0,
            format!("{id}: {missing} index rows have no entry in their letter file"),
        ));
        let in_range = |v: &Value| match v {
            Value::Array(a) => {
                a.len() == 2
                    && a[0]
                        .as_u64()
                        .zip(a[1].as_u64())
                        .is_some_and(|(x, y)| x < y && y < u64::from(n))
            }
            v => v.as_u64().is_some_and(|x| x < u64::from(n)),
        };
        let mut bad = 0;
        for e in files
            .values()
            .flat_map(|f| f.as_object().into_iter().flat_map(|o| o.values()))
        {
            let refs = e["refs"].as_array().map_or(&[][..], Vec::as_slice);
            bad += refs.iter().filter(|r| !in_range(r)).count();
            for p in e["text"]
                .as_array()
                .into_iter()
                .flatten()
                .filter(|p| p.is_object())
            {
                let ok = p["verse"].as_u64().is_some_and(|v| {
                    v < u64::from(n) && p["to"].as_u64().is_none_or(|t| t > v && t < u64::from(n))
                }) && p["text"].is_string();
                bad += usize::from(!ok);
            }
        }
        out.push((
            bad == 0,
            format!("{id}: {bad} verse links or references malformed"),
        ));
        // Names read as words ("High Places6813 Priest" was a slip of the
        // edition), and addresses as words with at most a number at the end.
        let odd: Vec<&str> = rows
            .iter()
            .filter(|r| {
                let (name, slug) = (r[0].as_str().unwrap_or(""), r[1].as_str().unwrap_or(""));
                name.contains(|c: char| c.is_ascii_digit()) || !plain_slug(slug)
            })
            .filter_map(|r| r[0].as_str())
            .collect();
        out.push((
            odd.is_empty(),
            format!("{id}: no entry name has a digit, and every address is plain words; not: {odd:?}"),
        ));
    }

    // Known entries: Easton's Quails links Exodus 16:13 and Numbers 11:31;
    // Smith's Aaron cites Exodus 4:14 and Numbers 20:28.
    let entry = |id: &str, letter: &str, slug: &str| -> Result<Value, String> {
        Ok(load(d, &format!("dict/{id}/{letter}.json"))?[slug].clone())
    };
    let links_to = |e: &Value, verse: u32, text: &str| {
        e["text"]
            .as_array()
            .into_iter()
            .flatten()
            .any(|p| p["verse"].as_u64() == Some(verse.into()) && p["text"] == text)
    };
    let lists = |e: &Value, verse: u32| {
        e["refs"].as_array().into_iter().flatten().any(|r| {
            r.as_u64() == Some(verse.into())
                || (r[0].as_u64().unwrap_or(u64::MAX) <= verse.into()
                    && u64::from(verse) <= r[1].as_u64().unwrap_or(0))
        })
    };
    let quails = entry("easton", "q", "quails")?;
    let (ex, _) = d.resolve("Exod 16:13")?;
    let (nu, _) = d.resolve("Num 11:31")?;
    out.push((
        quails["name"] == "Quails" && links_to(&quails, ex, "Ex. 16:13") && lists(&quails, ex),
        "Easton's Quails links Exodus 16:13 as \"Ex. 16:13\"".to_string(),
    ));
    out.push((
        links_to(&quails, nu, "Num. 11:31") && lists(&quails, nu),
        "Easton's Quails links Numbers 11:31".to_string(),
    ));
    let aaron = entry("smith", "a", "aaron")?;
    let (e414, _) = d.resolve("Exod 4:14")?;
    let (n2028, _) = d.resolve("Num 20:28")?;
    out.push((
        aaron["name"] == "Aaron" && lists(&aaron, e414) && lists(&aaron, n2028),
        "Smith has Aaron, citing Exodus 4:14 and Numbers 20:28".to_string(),
    ));
    // "(Numbers 26:59; 33:39)": the second reference continues the first.
    let (n3339, _) = d.resolve("Num 33:39")?;
    out.push((
        links_to(&aaron, n3339, "33:39"),
        "Smith's Aaron links \"33:39\" to Numbers 33:39".to_string(),
    ));
    // Smith's numbered lists are kept, and long entries are whole.
    let immer = plain_text(&entry("smith", "i", "immer")?);
    out.push((
        immer.contains("\n\n1. The founder of an important family of priests")
            && immer.contains("\n\n2. Apparently the name of a place in Babylonia"),
        "Smith's Immer has both items of its list".to_string(),
    ));
    let abda = plain_text(&entry("smith", "a", "abda")?);
    out.push((
        abda.starts_with("1. Father of Adoniram."),
        "Smith's Abda, all list, is there".to_string(),
    ));
    let aaron = plain_text(&entry("easton", "a", "aaron")?);
    out.push((
        aaron.chars().count() > 5_000 && aaron.ends_with("(See MOSES.)"),
        "Easton's Aaron is whole, past 5,000 characters".to_string(),
    ));
    let high = entry("smith", "h", "high-priest")?;
    out.push((
        high["name"] == "High Priest" && plain_text(&high).starts_with("The first distinct separation of Aaron"),
        "Smith's High Priest has its name".to_string(),
    ));
    Ok(out)
}

/// An entry's text without its links.
fn plain_text(e: &Value) -> String {
    match &e["text"] {
        Value::String(s) => s.clone(),
        Value::Array(a) => a
            .iter()
            .map(|p| p.as_str().or_else(|| p["text"].as_str()).unwrap_or(""))
            .collect(),
        _ => String::new(),
    }
}

/// Lowercase words joined by hyphens, with at most a number at the end ("hail-2").
fn plain_slug(slug: &str) -> bool {
    let parts: Vec<&str> = slug.split('-').collect();
    let last = parts.len() - 1;
    parts.iter().enumerate().all(|(i, p)| {
        !p.is_empty()
            && (p.bytes().all(|c| c.is_ascii_lowercase())
                || (i == last && i > 0 && p.bytes().all(|c| c.is_ascii_digit())))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    /// 66 books of 150 chapters of 60 verses: Genesis 1:1 is 0, and a verse is
    /// book * 9000 + (chapter - 1) * 60 + verse - 1.
    fn vz() -> Versification {
        Versification::from_counts(&vec![vec![60u16; 150]; 66])
    }

    fn at(book: u32, chapter: u32, verse: u32) -> u32 {
        book * 9000 + (chapter - 1) * 60 + verse - 1
    }

    fn links(text: &str) -> Vec<(String, u32, u32)> {
        let mut t = Tally::default();
        let (pieces, _) = link(text, &[], &vz(), &mut t);
        pieces
            .into_iter()
            .filter_map(|p| match p {
                Piece::Link { from, to, text } => Some((text, from, to)),
                Piece::Text(_) => None,
            })
            .collect()
    }

    /// A small edition: Smith's Immer (a list), a term given twice, a list of
    /// one item, an entity, and a cross-reference to another entry.
    const EDITION: &str = concat!(
        "<ThML><ThML.head><DC><DC.Title>Smith's Bible Dictionary</DC.Title></DC>",
        "<printSourceInfo><published>1884</published></printSourceInfo></ThML.head>\n",
        "<ThML.body xml:space=\"preserve\"><glossary>\n",
        "<term id=\"i-p26.3\">Immer</term>\n<def id=\"i-p26.4\">\n<p shownumber=\"no\" id=\"i-p27\">\n(talkative).</p>\n",
        "<ul id=\"i-p27.1\">\n   <li id=\"i-p27.2\">The founder of a family of priests. (<scripRef id=\"i-p27.3\" passage=\"1 Chronicles 9:12\" ",
        "osisRef=\"Bible:1Chr.9.12\">1 Chronicles 9:12</scripRef>; <scripRef passage=\"Nehemiah 11:13\" osisRef=\"Bible:Neh.11.13\">\n11:13</scripRef>)</li>\n",
        "   <li id=\"i-p27.6\">A place in Babylonia &amp; beyond. (<scripRef osisRef=\"Bible:Ezra.2.58-Ezra.2.60\">Ezra 2:58-60</scripRef>)</li>\n</ul>\n</def>\n",
        "<term id=\"k1\">Kadesh</term>\n<def id=\"k2\"><p id=\"k3\">Holy. See <a href=\"x\">MOSES</a>.</p></def>\n",
        "<term id=\"k4\">Kadesh</term>\n<def id=\"k5\"><p id=\"k6\">A city <i>of</i> the Hittites.</p><ul><li>Only one.</li></ul></def>\n",
        "</glossary></ThML.body></ThML>"
    );

    #[test]
    fn reads_a_thml_edition() {
        let mut t = Tally::default();
        let e = read_edition(EDITION, &mut t).unwrap();
        assert_eq!((e.title.as_str(), e.published.as_str()), ("Smith's Bible Dictionary", "1884"));
        let terms = merge(e.terms, &mut t);
        assert_eq!((terms.len(), t.merged), (2, 1));
        let (text, marked) = join(&terms[0].paras);
        assert_eq!(
            text,
            "(talkative).\n\n1. The founder of a family of priests. (1 Chronicles 9:12; 11:13)\n\n2. A place in Babylonia & beyond. (Ezra 2:58-60)"
        );
        let shown: Vec<(&str, &str)> = marked
            .iter()
            .map(|m| (&text[m.start..m.end], m.osis.as_str()))
            .collect();
        assert_eq!(
            shown,
            [
                ("1 Chronicles 9:12", "Bible:1Chr.9.12"),
                ("11:13", "Bible:Neh.11.13"),
                ("Ezra 2:58-60", "Bible:Ezra.2.58-Ezra.2.60")
            ]
        );
        // A term given twice is one entry; a list of one item is not numbered.
        assert_eq!(
            join(&terms[1].paras).0,
            "Holy. See MOSES.\n\nA city of the Hittites.\n\nOnly one."
        );
        assert!(t.other_tags.is_empty());
        assert!(read_edition("<ThML><ThML.body></ThML.body></ThML>", &mut t).is_err());
    }

    #[test]
    fn links_the_references_the_edition_marks() {
        let mut t = Tally::default();
        let e = read_edition(EDITION, &mut t).unwrap();
        let (text, marked) = join(&merge(e.terms, &mut t)[0].paras);
        let (pieces, refs) = link(&text, &marked, &vz(), &mut t);
        let links: Vec<(&str, u32, u32)> = pieces
            .iter()
            .filter_map(|p| match p {
                Piece::Link { from, to, text } => Some((text.as_str(), *from, *to)),
                Piece::Text(_) => None,
            })
            .collect();
        assert_eq!(
            links,
            [
                ("1 Chronicles 9:12", at(12, 9, 12), at(12, 9, 12)),
                ("11:13", at(15, 11, 13), at(15, 11, 13)),
                ("Ezra 2:58-60", at(14, 2, 58), at(14, 2, 60)),
            ]
        );
        assert_eq!(refs.len(), 3);
        assert_eq!(t.marked, 3);
    }

    #[test]
    fn reads_osis_references() {
        let vz = vz();
        assert_eq!(osis_range("Bible:Exod.16.13", &vz), Ok((at(1, 16, 13), at(1, 16, 13))));
        assert_eq!(osis_range("Bible:Gen.40.1-Gen.40.21", &vz), Ok((at(0, 40, 1), at(0, 40, 21))));
        assert_eq!(osis_range("Bible:Lev.8", &vz), Ok((at(2, 8, 1), at(2, 8, 60))));
        assert_eq!(osis_range("Bible:1Macc.1.57", &vz), Err(Unlinked::Outside));
        assert_eq!(osis_range("Bible:Gen.151.1", &vz), Err(Unlinked::NoVerse));
        assert_eq!(osis_range("Bible:Col", &vz), Err(Unlinked::NoVerse));
        assert_eq!(osis_range("Bible:Gen.1.1-Exod.1.1", &vz), Err(Unlinked::NoVerse));
        assert_eq!(osis_range("Gen.1.1", &vz), Err(Unlinked::NoVerse));
    }

    #[test]
    fn cites_but_does_not_link_several_chapters() {
        // "Josh. 15, 38" (a slip for 15:38) and "Psalms 49, 73": one link cannot take the reader to all.
        let text = "Josh. 15, 38 and Psalms 49, 73; also 1 Macc. 1:57 and Gen. 1:1";
        let marked = [
            Marked { start: 0, end: 12, osis: "Bible:Josh.15 Bible:Josh.38".into() },
            Marked { start: 17, end: 30, osis: "Bible:Ps.49 Bible:Ps.73".into() },
            Marked { start: 37, end: 49, osis: "Bible:1Macc.1.57".into() },
        ];
        let mut t = Tally::default();
        let (pieces, refs) = link(text, &marked, &vz(), &mut t);
        assert_eq!(
            pieces.iter().filter(|p| matches!(p, Piece::Link { .. })).count(),
            1,
            "only Gen. 1:1, found in the text, is linked"
        );
        assert_eq!(
            refs,
            [
                (at(0, 1, 1), at(0, 1, 1)),
                (at(5, 15, 1), at(5, 15, 60)),
                (at(5, 38, 1), at(5, 38, 60)),
                (at(18, 49, 1), at(18, 49, 60)),
                (at(18, 73, 1), at(18, 73, 60))
            ]
        );
        assert_eq!((t.several, t.outside, t.unresolved, t.found), (2, 1, 0, 1));
    }

    #[test]
    fn decodes_and_collapses_text() {
        let mut s = String::new();
        push_text(&mut s, "  a\n  b&amp;c &#8217; &#x2019; &bogus; &\u{7}");
        assert_eq!(s, "a b&c ’ ’ &bogus; &");
        assert_eq!(inline_text(" <i>Smith&apos;s</i>\n Bible "), "Smith's Bible");
        assert_eq!(attr("scripRef id=\"x\"\n osisRef=\"Bible:Gen.1.1\"", "osisRef"), Some("Bible:Gen.1.1"));
        assert_eq!(attr("a xosisRef=\"no\"", "osisRef"), None);
    }

    #[test]
    fn names_entries() {
        let mut t = Tally::default();
        assert_eq!(fix_name("smith", "Ark Of The Covenant", true, &mut t), "Ark of the Covenant");
        assert_eq!(fix_name("smith", "A", true, &mut t), "A");
        assert_eq!(fix_name("smith", "High Places6813 Priest", true, &mut t), "High Priest");
        assert_eq!(fix_name("easton", "Sea, The", false, &mut t), "Sea, The");
        assert_eq!(t.renamed, 1);
    }

    #[test]
    fn makes_unique_slugs() {
        let mut seen = HashSet::new();
        assert_eq!(unique_slug("Hail", &mut seen).as_deref(), Some("hail"));
        assert_eq!(unique_slug("Hail!", &mut seen).as_deref(), Some("hail-2"));
        assert_eq!(
            unique_slug("Abel-beth-maachah, The", &mut seen).as_deref(),
            Some("abel-beth-maachah-the")
        );
        assert_eq!(unique_slug("Abraham’s bosom", &mut seen).as_deref(), Some("abrahams-bosom"));
        assert_eq!(unique_slug("“Zion”", &mut seen).as_deref(), Some("zion"));
        assert_eq!(unique_slug("1897", &mut seen), None);
        assert!(plain_slug("hail-2") && plain_slug("abel-beth") && !plain_slug("high-places6813-priest") && !plain_slug("2-a"));
    }

    #[test]
    fn links_references_with_their_book() {
        assert_eq!(
            links("supply of quails, (1) in the wilderness of Sin (Ex. 16:13), and (2) again at Kibroth-hattaavah (q.v.), Num. 11:31. They"),
            [("Ex. 16:13".to_string(), at(1, 16, 13), at(1, 16, 13)), ("Num. 11:31".to_string(), at(3, 11, 31), at(3, 11, 31))]
        );
        assert_eq!(
            links("in (1 Chr. 2:10) and 2Sa 8:2"),
            [
                ("1 Chr. 2:10".to_string(), at(12, 2, 10), at(12, 2, 10)),
                ("2Sa 8:2".to_string(), at(9, 8, 2), at(9, 8, 2))
            ]
        );
        assert_eq!(
            links("(Song of Solomon 8:11) and (Cant. 4:14)"),
            [
                (
                    "Song of Solomon 8:11".to_string(),
                    at(21, 8, 11),
                    at(21, 8, 11)
                ),
                ("Cant. 4:14".to_string(), at(21, 4, 14), at(21, 4, 14))
            ]
        );
        assert_eq!(
            links("Genesis15:13 and Psal 113:9"),
            [
                ("Genesis15:13".to_string(), at(0, 15, 13), at(0, 15, 13)),
                ("Psal 113:9".to_string(), at(18, 113, 9), at(18, 113, 9))
            ]
        );
    }

    #[test]
    fn follows_a_list_in_one_book() {
        assert_eq!(
            links("(Numbers 26:59; 33:39) (B.C. 1573.)"),
            [
                ("Numbers 26:59".to_string(), at(3, 26, 59), at(3, 26, 59)),
                ("33:39".to_string(), at(3, 33, 39), at(3, 33, 39))
            ]
        );
        assert_eq!(
            links("(Numbers 11:31,32)"),
            [
                ("Numbers 11:31".to_string(), at(3, 11, 31), at(3, 11, 31)),
                ("32".to_string(), at(3, 11, 32), at(3, 11, 32))
            ]
        );
        assert_eq!(
            links("(Gen. 40:1-21; 41:9). Gen. 12:1-25:10, 12"),
            [
                ("Gen. 40:1-21".to_string(), at(0, 40, 1), at(0, 40, 21)),
                ("41:9".to_string(), at(0, 41, 9), at(0, 41, 9)),
                ("Gen. 12:1-25:10".to_string(), at(0, 12, 1), at(0, 25, 10)),
                ("12".to_string(), at(0, 25, 12), at(0, 25, 12)),
            ]
        );
        // A new book ends the list; "; 9" alone, a bare "(11:32)", a year and "Comp. 1:9" are not read.
        assert_eq!(
            links("(1 Cor. 3:21-23; 2 Cor. 1:4; 9) (11:32) Hos. 2:1, 1897. Comp. 1:9"),
            [
                ("1 Cor. 3:21-23".to_string(), at(45, 3, 21), at(45, 3, 23)),
                ("2 Cor. 1:4".to_string(), at(46, 1, 4), at(46, 1, 4)),
                ("Hos. 2:1".to_string(), at(27, 2, 1), at(27, 2, 1)),
            ]
        );
    }

    #[test]
    fn leaves_books_outside_the_bible_alone() {
        assert!(links(
            "Ecclus. 3:30; 40:24, 1 Macc. 1:57, Tob. 13:16, Wisd. 12:8, Ant. 11:8, Judith 10:3"
        )
        .is_empty());
        // A verse the Bible does not have is counted, not linked.
        let mut t = Tally::default();
        let (pieces, refs) = link("Gen. 151:1", &[], &vz(), &mut t);
        assert_eq!(
            (pieces, refs, t.unresolved),
            (vec![Piece::Text("Gen. 151:1".into())], vec![], 1)
        );
    }

    #[test]
    fn writes_note_lines() {
        assert_eq!(note_line(&[Piece::Text("plain".into())]), json!("plain"));
        let line = note_line(&[
            Piece::Text("see ".into()),
            Piece::Link {
                from: 5,
                to: 5,
                text: "Gen. 1:6".into(),
            },
            Piece::Link {
                from: 7,
                to: 9,
                text: "8-10".into(),
            },
        ]);
        assert_eq!(
            line,
            json!(["see ", { "verse": 5, "text": "Gen. 1:6" }, { "verse": 7, "to": 9, "text": "8-10" }])
        );
        assert_eq!(
            (range_json(&(4, 4)), range_json(&(4, 6))),
            (json!(4), json!([4, 6]))
        );
    }

    fn source(id: &str, license: &str) -> Source {
        Source {
            id: id.into(),
            title: format!("{id} title"),
            provides: "What it gives. ".repeat(30),
            license: license.into(),
            attribution: format!("{id} attribution"),
            homepage: "https://example.org/x".into(),
            repo: "https://github.com/owner/repo".into(),
            commit: "0".repeat(40),
            files: BTreeMap::new(),
            note: None,
        }
    }

    fn work(id: &str, license: &str, datasets: &[&str]) -> Work {
        Work {
            id: id.into(),
            group: "dictionaries".into(),
            plain: "Bible dictionary, 1897".into(),
            title: "A title".into(),
            by: "Someone".into(),
            when: "1897".into(),
            what: "One plain sentence.".into(),
            license: license.into(),
            license_note: None,
            datasets: datasets.iter().map(|s| s.to_string()).collect(),
            read: None,
            find: Some(Link {
                url: "https://example.org".into(),
                label: "Publisher".into(),
            }),
            citation: "A citation.".into(),
            cites: Vec::new(),
        }
    }

    fn config(works: Vec<Work>) -> Option<Config> {
        Some(Config {
            _comment: Value::Null,
            groups: vec![
                Group {
                    id: "dictionaries".into(),
                    name: "Dictionaries".into(),
                },
                Group {
                    id: "unused".into(),
                    name: "Unused".into(),
                },
            ],
            works,
        })
    }

    #[test]
    fn checks_the_config() {
        let sources = [source(
            "easton",
            "CC BY 4.0 (dataset); the dictionary is public domain",
        )];
        let ok = |works: Vec<Work>| assemble(config(works), &sources, &[], &[]).map(|_| ());
        assert!(ok(vec![work("easton", "public-domain", &["easton"])]).is_ok());
        let mut w = work("metzger", "copyrighted", &[]);
        w.read = Some(Read {
            app: None,
            url: Some("https://example.org/full".into()),
            label: Some("Full text".into()),
        });
        assert!(ok(vec![w]).unwrap_err().contains("has no \"read\""));
        let mut w = work("metzger", "copyrighted", &[]);
        w.find = None;
        assert!(ok(vec![w]).unwrap_err().contains("needs \"find\""));
        assert!(ok(vec![
            work("a", "public-domain", &["easton"]),
            work("b", "public-domain", &["easton"])
        ])
        .unwrap_err()
        .contains("already belongs"));
        let mut w = work("a", "public-domain", &[]);
        w.group = "nope".into();
        assert!(ok(vec![w])
            .unwrap_err()
            .contains("is not one of the groups"));
        let mut w = work("a", "public-domain", &[]);
        w.find = Some(Link {
            url: "http://example.org".into(),
            label: "Site".into(),
        });
        assert!(ok(vec![w]).unwrap_err().contains("https"));
        let mut w = work("a", "cc-by-nc-4.0", &[]);
        w.license = "cc-by-nc-4.0".into();
        assert!(ok(vec![w]).unwrap_err().contains("license"));
        let mut w = work("a", "public-domain", &[]);
        w.read = Some(Read {
            app: Some("dictionary".into()),
            url: None,
            label: None,
        });
        assert!(ok(vec![w]).unwrap_err().contains("dictionary"));
        let mut w = work("a", "public-domain", &[]);
        w.plain = "A plain label that is much too long to read at a glance".into();
        assert!(ok(vec![w]).unwrap_err().contains("at most 48"));
        assert!(mentions_esv("as the ESV puts it") && !mentions_esv("ESVs"));
    }

    #[test]
    fn makes_plain_cards_and_finds_citations() {
        let sources = [
            source(
                "easton",
                "CC BY 4.0 (dataset); the dictionary is public domain",
            ),
            source("tflsj", "CC BY 4.0 (STEPBible); LSJ is CC BY-SA 4.0"),
        ];
        let mut w = work("metzger", "copyrighted", &[]);
        w.cites = vec!["Metzger, A Textual Commentary".into()];
        let cites = [
            Citation {
                text:
                    "Bruce M. Metzger, A Textual Commentary on the Greek New Testament, on John 5:2"
                        .into(),
                at: vec![(26_000, 26_000), (26_100, 26_102)],
                place: "aramaic",
            },
            Citation {
                text: "Didache 10:6".into(),
                at: vec![(1, 1)],
                place: "aramaic",
            },
        ];
        let (shelf, warnings) = assemble(config(vec![w]), &sources, &[], &cites).unwrap();
        let works = shelf["works"].as_array().unwrap();
        assert_eq!(
            works
                .iter()
                .map(|w| w["id"].as_str().unwrap())
                .collect::<Vec<_>>(),
            ["metzger", "easton", "tflsj"]
        );
        assert_eq!(
            works[0]["cited"],
            json!([{ "verse": 26_000, "where": "aramaic" }, { "verse": 26_100, "to": 26_102, "where": "aramaic" }])
        );
        assert_eq!(works[0]["citedCount"], json!(2));
        assert_eq!(works[0]["cites"], json!(["Metzger, A Textual Commentary"]));
        assert!(works[1].get("cites").is_none());
        assert_eq!(
            (works[1]["license"].as_str(), works[2]["license"].as_str()),
            (Some("cc-by-4.0"), Some("cc-by-sa-4.0"))
        );
        assert_eq!(
            (works[1]["group"].as_str(), works[1]["by"].as_str()),
            (Some("other"), Some("owner"))
        );
        assert!(
            works[1]["what"].as_str().unwrap().chars().count() <= WHAT_MAX
                && works[1]["what"].as_str().unwrap().ends_with('…')
        );
        // Groups with no works are left out; the plain cards' group is added.
        assert_eq!(
            shelf["groups"],
            json!([{ "id": "dictionaries", "name": "Dictionaries" }, { "id": "other", "name": "Other sources" }])
        );
        assert!(
            warnings.iter().any(|w| w.contains("Didache 10:6"))
                && warnings.iter().filter(|w| w.contains("plain card")).count() == 2
        );
        // No config at all: every dataset gets a plain card.
        let (shelf, _) = assemble(None, &sources, &[], &[]).unwrap();
        assert_eq!(shelf["works"].as_array().unwrap().len(), 2);
        assert_eq!(
            (
                license_kind("Public domain (dedicated April 2023)"),
                license_kind("Copyright Crossway")
            ),
            (Some("public-domain"), None)
        );
    }

    #[test]
    fn reads_licenses_loosely() {
        for (text, kind) in [
            ("CC0 1.0 (public domain dedication)", Some("public-domain")),
            ("in the public domain", Some("public-domain")),
            ("cc-by 4.0", Some("cc-by-4.0")),
            ("CC-BY-4.0", Some("cc-by-4.0")),
            ("Creative Commons Attribution 4.0 International", Some("cc-by-4.0")),
            ("cc by-sa 4.0", Some("cc-by-sa-4.0")),
            ("Creative Commons Attribution-ShareAlike 4.0", Some("cc-by-sa-4.0")),
            ("CC BY 4.0 (dataset); CC BY-SA 4.0 (text)", Some("cc-by-sa-4.0")),
            ("CC BY-NC 4.0", None),
            ("CC BY 3.0", None),
            ("All rights reserved", None),
        ] {
            assert_eq!(license_kind(text), kind, "{text}");
        }
        // A dataset whose license cannot be read still gets a card, in its own words.
        let sources = [source("natural-earth", "Free for any use, see the site")];
        let (shelf, warnings) = assemble(config(Vec::new()), &sources, &[], &[]).unwrap();
        let w = &shelf["works"][0];
        assert_eq!(
            (w["license"].as_str(), w["when"].as_str(), w["find"]["url"].as_str()),
            (Some("Free for any use, see the site"), Some(""), Some("https://example.org/x"))
        );
        assert!(warnings.iter().any(|w| w.contains("cannot tell the license")));
    }

    #[test]
    fn warns_of_a_citation_that_names_two_works() {
        let mut a = work("metzger", "copyrighted", &[]);
        a.cites = vec!["Metzger".into()];
        let mut b = work("metzger-2", "copyrighted", &[]);
        b.cites = vec!["A Textual Commentary".into()];
        let cites = [Citation {
            text: "Bruce M. Metzger, A Textual Commentary".into(),
            at: vec![(5, 5)],
            place: "aramaic",
        }];
        let (shelf, warnings) = assemble(config(vec![a, b]), &[], &[], &cites).unwrap();
        assert_eq!(
            (&shelf["works"][0]["citedCount"], &shelf["works"][1]["citedCount"]),
            (&json!(1), &json!(0))
        );
        assert!(warnings
            .iter()
            .any(|w| w.contains("more than one work") && w.contains("credited to metzger, metzger-2")));
    }
}
