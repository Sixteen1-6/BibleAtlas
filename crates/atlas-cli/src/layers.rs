//! Layers of meaning: short notes on one passage, from the plain meaning
//! outward, read from `config/layers.json` and checked against the built data
//! before anything is written. The build stops at the first problem:
//!
//! 1. every reference (passage, layer and word refs) parses and resolves,
//! 2. the passage's `saying` is in its BSB text,
//! 3. every quotation of four or more words in a layer is in the BSB text of
//!    the passage or of one of that layer's refs (shorter quoted spans are
//!    glosses and are not checked),
//! 4. `kind` and `strength` come from the fixed lists below,
//! 5. every `words` entry names a root that occurs in that verse,
//! 6. "ESV" appears nowhere,
//! 7. a "widely agreed" layer shows its evidence, and every passage has a
//!    layer besides the plain meaning that is not "some interpreters",
//! 8. every passage names its sources ("Sources: ...", with no dataset code)
//!    and its section; one nobody reviewed is a draft,
//! 9. a layer's text stays short enough to read at a glance; detail and
//!    sources go in its evidence, which the app shows one level deeper,
//! 10. every `cites` entry names a source on the `cite` list of
//!     `config/layer-sources.json` (the Bible-believing sources the owner's
//!     rule allows), and no text, evidence or source line names one on its
//!     `avoid` list,
//! 11. every cite resolves to the person who wrote its words: a source with
//!     `parts` says, book by book, which writer and which work (Bible Hub's
//!     "Barnes' Notes" on Genesis are James G. Murphy's), and a source with
//!     `works` is cited by naming one of them; a writer the founder's rule
//!     excludes, or a passage listed in `denies`, is refused,
//! 12. every cite has a proven date: a record in `docs/evidence/` that it was
//!     read on that day from the very page it links to, or a record that it
//!     was checked against the source by a date; dates are real dates, none
//!     after today, and none outside its file's window,
//! 13. no cite links to a work's home page instead of the page it cites, and
//!     no credit, source line or source list mentions AI ([`AI_CREDIT`]).
//!
//! What goes live: every note of a passage someone reviewed, and in other
//! passages each note that cites a listed source (a wordplay, allusion,
//! pattern, irony or fulfillment note needs an interpreter among them, not
//! only a word book). A passage shows once one of its live notes goes beyond
//! the plain meaning. The rest are drafts: checked like everything else but
//! published only when `ATLAS_LAYER_DRAFTS=1` is set.
//!
//! Each published cite carries its credit (see [`credit_json`]): the writer
//! and who he was, the work and its original date, where the app read it,
//! the date it was read or checked, and the link to read it there.
//!
//! Text is compared after [`normalize`], and an ellipsis ("…" or "...")
//! splits a saying or quotation into parts that must appear in order.

use crate::loaded::Loaded;
use crate::parse::WordsByVerse;
use atlas_core::{refs, Versification, XrefGraph, BOOKS};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fmt::Display;
use std::fs;
use std::path::Path;

pub const CONFIG: &str = "config/layers.json";
pub const SOURCES: &str = "config/layer-sources.json";
pub const EVIDENCE: &str = "docs/evidence";
pub const DRAFTS_ENV: &str = "ATLAS_LAYER_DRAFTS";

/// Words that credit AI or say who or what checked something. Founder's
/// decisions 13, 15 and 19 (2026-10-20): "No crediting of AI"; describe what
/// was done ("checked against the source"), never who or what did it. Refused
/// in every credit, source line and source list (not in notes' text, where
/// the BSB names the city Ai).
pub const AI_CREDIT: [&str; 8] = ["Drafted with", "AI help", "Claude", "AI reviewer", "AI session", "with AI", "by AI", "Not yet reviewed by a person"];

/// STEPBible's dataset codes, which a reader cannot follow; a source line names the texts instead.
const DATASET_CODES: [&str; 4] = ["TAHOT", "TAGNT", "TBESH", "TBESG"];
/// Pages that open a whole work rather than the page a cite needs.
const HOME_PAGES: [&str; 2] = ["https://www.studylight.org/commentaries/eng/bul.html", "https://archive.org/details/figuresofspeechu00bull"];
/// What a part may say instead of a date, and only with evidence that begins so.
const NO_DATE: (&str, &str) = ("date not known", "none found");
/// The longest "about" phrase, in characters.
const ABOUT_MAX: usize = 60;

pub const ROLES: [&str; 2] = ["interpreter", "reference"];
const INTERPRETER: &str = "interpreter";
/// Kinds whose claim is a reading of the text, so a word book alone cannot carry it.
const NEEDS_INTERPRETER: [&str; 5] = ["wordplay", "allusion", "pattern", "irony", "fulfillment"];

pub const KINDS: [&str; 9] =
    ["plain meaning", "quotation", "allusion", "wordplay", "name meaning", "pattern", "irony", "fulfillment", "setting"];
pub const STRENGTHS: [&str; 3] = ["widely agreed", "commonly held", "some interpreters"];
pub const SECTIONS: [&str; 4] = ["law-history", "prophets-poetry", "jesus", "letters-revelation"];
const PLAIN: &str = "plain meaning";
const WIDELY: &str = "widely agreed";
const SOME: &str = "some interpreters";

/// Quoted spans shorter than this are glosses ("my delight"), not quotations.
const QUOTE_MIN_WORDS: usize = 4;
/// Longest layer text and evidence, in characters.
const TEXT_MAX: usize = 300;
const EVIDENCE_MAX: usize = 400;

#[derive(Deserialize)]
struct LayerFile {
    passages: Vec<PassageSpec>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PassageSpec {
    id: String,
    section: String,
    #[serde(rename = "ref")]
    reference: String,
    saying: String,
    source: String,
    reviewed_by: Vec<String>,
    layers: Vec<LayerSpec>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LayerSpec {
    kind: String,
    strength: String,
    refs: Vec<String>,
    #[serde(default)]
    words: Vec<WordSpec>,
    #[serde(default)]
    evidence: Option<String>,
    #[serde(default)]
    cites: Vec<CiteSpec>,
    text: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WordSpec {
    #[serde(rename = "ref")]
    reference: String,
    strong: String,
}

/// One citation in a layer: a source from the list, and where in it.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CiteSpec {
    source: String,
    /// The verse the source comments on, such as "Genesis 2:7".
    #[serde(default)]
    on: Option<String>,
    /// The place inside the work ("chapter 40", "in its entry on Psalm 32:1-2").
    #[serde(default)]
    at: Option<String>,
    /// A page to read it, when the source's own link does not reach it.
    #[serde(default)]
    url: Option<String>,
    /// For a source cited by its works (a journal, the church fathers): which one.
    #[serde(default)]
    work: Option<String>,
    /// false: the cite supports part of the note or is a reference, so it does not count toward its strength.
    #[serde(default)]
    counts: Option<bool>,
}

/// `config/layer-sources.json`.
#[derive(Deserialize)]
struct SourceFile {
    sites: Vec<Site>,
    writers: Vec<Writer>,
    works: Vec<Work>,
    cite: Vec<CiteSource>,
    avoid: Vec<Avoid>,
    denies: Vec<Deny>,
}

/// The readable name of a host a cite links to ("Bible Hub").
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Site {
    host: String,
    name: String,
}

/// A person whose words are cited.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Writer {
    id: String,
    name: String,
    /// Who he was, in one short phrase, from a checked source.
    about: String,
    about_from: String,
    /// Dropped entirely under the founder's rule (decision 20).
    #[serde(default)]
    excluded: Option<Excluded>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Excluded {
    why: String,
    decided: String,
}

/// A published work whose words are cited.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Work {
    id: String,
    title: String,
    /// The name the credit gives it.
    short: String,
    /// The original date as the credit shows it, never a remembered one.
    written: String,
    /// One checked year or decade, for the line below Deep.
    #[serde(default)]
    year: Option<String>,
    written_from: String,
    /// What is still missing about the first edition.
    #[serde(default)]
    first_edition: Option<String>,
    /// A free printed copy to read.
    #[serde(default)]
    scan: Option<String>,
    /// For a work cited directly (an article, a father's treatise): who wrote it.
    #[serde(default)]
    writers: Vec<String>,
    #[serde(default)]
    unnamed: Option<String>,
    #[serde(default)]
    translated_by: Vec<String>,
    #[serde(default)]
    edition: Option<String>,
    /// The record that says who wrote it, for a work cited directly.
    #[serde(default)]
    evidence: Option<String>,
    /// The shelf card that presents it (default: its id).
    #[serde(default)]
    shelf: Option<String>,
}

/// A source a layer may cite: where the app reads it.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CiteSource {
    id: String,
    role: String,
    /// The name the site gives the set ("Barnes' Notes").
    name: String,
    #[serde(default)]
    biblehub: Option<String>,
    /// The work's own page; never a cite's link.
    #[serde(default)]
    url: Option<String>,
    /// A chapter page pattern: {book} (lowercase, hyphens) and {chapter}.
    #[serde(default)]
    link: Option<String>,
    /// Writers the site credits its pages to.
    #[serde(default)]
    labels_as: Vec<String>,
    /// The site's own credit line, word for word.
    #[serde(default)]
    site_says: Option<String>,
    why: String,
    /// Books whose volume of a many-handed set is not cited, with the reason in why.
    #[serde(default)]
    not_on: Vec<String>,
    /// Who wrote the words, book by book.
    #[serde(default)]
    parts: Vec<Part>,
    /// Or, for a source with no per-book writer, the works its cites name.
    #[serde(default)]
    works: Vec<String>,
}

/// Which writer and work a source's pages on some books are.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Part {
    books: Books,
    #[serde(default)]
    chapters: Option<[u16; 2]>,
    work: String,
    #[serde(default)]
    volume: Option<String>,
    #[serde(default)]
    written: Option<String>,
    #[serde(default)]
    year: Option<String>,
    #[serde(default)]
    written_from: Option<String>,
    #[serde(default)]
    writers: Vec<String>,
    /// Instead of writers, when no writer can be named: the phrase the credit leads with.
    #[serde(default)]
    unnamed: Option<String>,
    /// The work prints no writer's name and a cited source credits it.
    #[serde(default)]
    attributed: bool,
    #[serde(default)]
    translated_by: Vec<String>,
    #[serde(default)]
    edition: Option<String>,
    /// The writer an abridgment counts as, when strengths are counted.
    #[serde(default)]
    counts_as: Option<String>,
    /// Its record in the attribution evidence.
    evidence: String,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Books {
    All(String),
    List(Vec<String>),
}

impl Books {
    fn covers(&self, book: &str) -> bool {
        match self {
            Books::All(_) => true,
            Books::List(l) => l.iter().any(|b| b == book),
        }
    }
    fn list(&self) -> Vec<&str> {
        match self {
            Books::All(_) => vec!["all"],
            Books::List(l) => l.iter().map(String::as_str).collect(),
        }
    }
}

/// A source no layer may cite or name.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Avoid {
    name: String,
    #[serde(rename = "match")]
    names: Vec<String>,
    why: String,
}

/// A cited passage left out because its own words deny Scripture (decision 20).
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Deny {
    source: String,
    on: String,
    writer: String,
    words: String,
    why: String,
    decided: String,
}

impl SourceFile {
    fn writer(&self, id: &str) -> Option<&Writer> {
        self.writers.iter().find(|w| w.id == id)
    }
    fn work(&self, id: &str) -> Option<&Work> {
        self.works.iter().find(|w| w.id == id)
    }
    fn site(&self, url: &str) -> Option<&Site> {
        let h = host(url);
        self.sites.iter().find(|s| strip_www(&s.host.to_ascii_lowercase()) == h)
    }
}

/// What the checks read from the rest of the build.
pub struct Sources<'a> {
    /// BSB English, one string per verse index.
    pub text: &'a [String],
    pub vz: &'a Versification,
    pub words: &'a WordsByVerse,
    pub lemma_index: &'a HashMap<&'a str, u32>,
    pub graph: &'a XrefGraph,
}

/// Read and check `config/layers.json`; returns the passages to publish, in
/// config order, for `layers.json`.
pub fn build(root: &Path, src: &Sources) -> Result<Vec<Value>, String> {
    let file: LayerFile = serde_json::from_str(
        &fs::read_to_string(root.join(CONFIG)).map_err(|e| format!("reading {CONFIG}: {e}"))?,
    )
    .map_err(|e| format!("parsing {CONFIG}: {e}"))?;
    let sources = read_sources(root)?;
    let today = Date::today();
    let evidence = read_evidence(root, today)?;
    check_evidence_ids(&sources, &evidence)?;
    let include_drafts = std::env::var(DRAFTS_ENV).is_ok_and(|v| v == "1");

    let mut check = Check { src, sources: &sources, evidence: &evidence, used: vec![false; evidence.reads.len()], tally: Tally::default(), errors: Vec::new() };
    let mut ids = BTreeSet::new();
    let mut out = Vec::new();
    let (mut drafts, mut live_notes, mut cited_notes) = (0, 0, 0);
    for p in &file.passages {
        if !ids.insert(p.id.as_str()) {
            check.fail(&format!("passage {:?}", p.id), "id is used by an earlier passage");
        }
        let Some(mut v) = check.passage(p) else { continue };
        let draft = v["draft"] == json!(true);
        drafts += draft as usize;
        let layers = v["layers"].as_array_mut().expect("layers is an array");
        if !draft {
            let live = layers.iter().filter(|l| l["draft"] == json!(false)).count();
            live_notes += live;
            if p.reviewed_by.is_empty() {
                cited_notes += live;
            }
        }
        if include_drafts {
            out.push(v);
        } else if !draft {
            layers.retain(|l| l["draft"] == json!(false));
            out.push(v);
        }
    }
    if !check.errors.is_empty() {
        let n = check.errors.len();
        for e in check.errors.iter().skip(1) {
            eprintln!("error: {e}");
        }
        let first = check.errors.swap_remove(0);
        return Err(if n > 1 { format!("{first} (and the {} problems above)", n - 1) } else { first });
    }

    let layer_count: usize = file.passages.iter().map(|p| p.layers.len()).sum();
    let drafts_note = match (drafts, include_drafts) {
        (0, _) => String::from("no drafts"),
        (d, true) => format!("{d} draft passages and every draft note included ({DRAFTS_ENV}=1)"),
        (d, false) => format!("{d} draft passages and every draft note left out (set {DRAFTS_ENV}=1 to include them)"),
    };
    eprintln!(
        "layers of meaning: {} passages, {layer_count} layers checked; {} passages live with {live_notes} notes \
         ({cited_notes} live because they cite a listed source); {drafts_note}",
        file.passages.len(),
        file.passages.len() - drafts,
    );
    let t = &check.tally;
    let unused = check.used.iter().filter(|u| !**u).count();
    let named: Vec<String> = t.named.iter().map(|(k, n)| format!("{k} {n}")).collect();
    let dates: Vec<String> = t.dates.iter().map(|(k, n)| format!("{k} {n}")).collect();
    eprintln!(
        "layers credits: {} cites by {} writers ({}); {}; {unused} reads records match no live cite (cites removed since)",
        t.cites,
        t.writers.len(),
        named.join(", "),
        dates.join(", "),
    );
    let mut by_writer: Vec<(&String, &usize)> = t.writers.iter().collect();
    by_writer.sort_by(|a, b| b.1.cmp(a.1).then(a.0.cmp(b.0)));
    let list: Vec<String> = by_writer.iter().map(|(k, n)| format!("{k} {n}")).collect();
    eprintln!("layers cites by writer: {}", list.join(", "));
    Ok(out)
}

fn read_sources(root: &Path) -> Result<SourceFile, String> {
    let text = fs::read_to_string(root.join(SOURCES)).map_err(|e| format!("reading {SOURCES}: {e}"))?;
    let v: Value = serde_json::from_str(&text).map_err(|e| format!("parsing {SOURCES}: {e}"))?;
    if let Some((path, phrase)) = ai_credit_in(&v, "") {
        return Err(format!("{SOURCES}: {path} says {phrase:?}; credits name the original sources, never AI (founder's decisions 13 and 15)"));
    }
    let s: SourceFile = serde_json::from_value(v).map_err(|e| format!("parsing {SOURCES}: {e}"))?;
    check_sources(&s)?;
    Ok(s)
}

/// An id: lowercase letters, digits and hyphens.
fn is_id(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
}

fn book_name(b: &str) -> bool {
    BOOKS.iter().any(|x| x.name == b)
}

/// A year ("1866") or a decade ("1860s").
fn is_year(s: &str) -> bool {
    let digits = |t: &str| t.len() == 4 && t.bytes().all(|c| c.is_ascii_digit());
    digits(s) || (s.len() == 5 && s.ends_with('s') && digits(&s[..4]) && s.as_bytes()[3] == b'0')
}

/// The source list itself: ids, roles, links, writers, works and parts, and avoid entries that name something.
fn check_sources(s: &SourceFile) -> Result<(), String> {
    let mut seen = BTreeSet::new();
    for site in &s.sites {
        if site.host.is_empty() || site.name.trim().is_empty() || site.host.contains('/') || !seen.insert(strip_www(&site.host.to_ascii_lowercase()).to_string()) {
            return Err(format!("{SOURCES}: site {:?}: needs a host (no slashes), used once, and a name", site.host));
        }
    }
    let mut ids = BTreeSet::new();
    for w in &s.writers {
        let at = format!("{SOURCES}: writer {:?}", w.id);
        if !is_id(&w.id) || !ids.insert(w.id.as_str()) {
            return Err(format!("{at}: id must be lowercase letters, digits and hyphens, used once"));
        }
        for (field, v) in [("name", &w.name), ("about", &w.about), ("about_from", &w.about_from)] {
            if v.trim().is_empty() {
                return Err(format!("{at}: {field} is empty; say who he was, from a source named in about_from"));
            }
        }
        if let Some(n) = too_long(&w.about, ABOUT_MAX) {
            return Err(format!("{at}: about is {n} characters; keep it to {ABOUT_MAX}"));
        }
        if ["Rev.", "D.D.", "Revd"].iter().any(|h| w.about.contains(h)) {
            return Err(format!("{at}: about has an honorific; say his calling, office and place instead"));
        }
        if w.excluded.as_ref().is_some_and(|x| x.why.trim().is_empty() || x.decided.trim().is_empty()) {
            return Err(format!("{at}: excluded needs why and decided"));
        }
    }
    let writer = |id: &str, at: &str| -> Result<(), String> {
        match s.writer(id) {
            Some(_) => Ok(()),
            None => Err(format!("{at}: names writer {id:?}, who is not in writers")),
        }
    };
    let mut work_ids = BTreeSet::new();
    for w in &s.works {
        let at = format!("{SOURCES}: work {:?}", w.id);
        if !is_id(&w.id) || !work_ids.insert(w.id.as_str()) {
            return Err(format!("{at}: id must be lowercase letters, digits and hyphens, used once"));
        }
        for (field, v) in [("title", &w.title), ("short", &w.short), ("written", &w.written), ("written_from", &w.written_from)] {
            if v.trim().is_empty() {
                return Err(format!("{at}: {field} is empty"));
            }
        }
        dated_soundly(&at, &w.written, &w.written_from, w.year.as_deref())?;
        if w.shelf.as_deref().is_some_and(|x| !is_id(x)) {
            return Err(format!("{at}: shelf must be a card id"));
        }
        if w.first_edition.as_deref().is_some_and(|x| x.trim().is_empty()) {
            return Err(format!("{at}: first_edition, when given, says what is still missing"));
        }
        if w.scan.as_deref().is_some_and(|u| !u.starts_with("https://")) {
            return Err(format!("{at}: scan must start with https://"));
        }
        for id in w.writers.iter().chain(&w.translated_by) {
            writer(id, &at)?;
        }
        if !w.writers.is_empty() && w.unnamed.is_some() {
            return Err(format!("{at}: give writers or unnamed, not both"));
        }
        if (!w.writers.is_empty() || w.unnamed.is_some()) && w.evidence.is_none() {
            return Err(format!("{at}: a work that names its writer needs evidence, the record that says so"));
        }
    }
    let mut ids = BTreeSet::new();
    for c in &s.cite {
        let at = format!("{SOURCES}: cite {:?}", c.id);
        if !is_id(&c.id) {
            return Err(format!("{at}: id must be lowercase letters, digits and hyphens"));
        }
        if !ids.insert(c.id.as_str()) {
            return Err(format!("{at}: id is used by an earlier source"));
        }
        if !ROLES.contains(&c.role.as_str()) {
            return Err(format!("{at}: role {:?} is not one of: {}", c.role, ROLES.join(", ")));
        }
        for (field, v) in [("name", &c.name), ("why", &c.why)] {
            if v.trim().is_empty() {
                return Err(format!("{at}: {field} is empty"));
            }
        }
        if c.biblehub.as_deref().is_some_and(|b| b.is_empty() || !b.chars().all(|ch| ch.is_ascii_lowercase() || ch == '-')) {
            return Err(format!("{at}: biblehub must be the lowercase code in its biblehub.com/commentaries address"));
        }
        if c.url.as_deref().is_some_and(|u| !u.starts_with("https://")) {
            return Err(format!("{at}: url must start with https://"));
        }
        if c.link.as_deref().is_some_and(|u| !u.starts_with("https://") || !u.contains("{book}") || !u.contains("{chapter}")) {
            return Err(format!("{at}: link must be an https pattern with {{book}} and {{chapter}}"));
        }
        if c.biblehub.is_some() && c.link.is_some() {
            return Err(format!("{at}: give biblehub or link, not both"));
        }
        if let Some(b) = c.not_on.iter().find(|b| !book_name(b)) {
            return Err(format!("{at}: not_on names {b:?}, which is not a book of the Bible"));
        }
        if let Some(a) = s.avoid.iter().find(|a| a.names.iter().any(|n| names(&c.name, n))) {
            return Err(format!("{at}: its name matches the avoid entry {:?}", a.name));
        }
        for id in &c.labels_as {
            writer(id, &at)?;
        }
        if c.site_says.as_deref().is_some_and(|x| x.trim().is_empty()) {
            return Err(format!("{at}: site_says, when given, is the site's own credit line word for word"));
        }
        if c.parts.is_empty() == c.works.is_empty() {
            return Err(format!("{at}: give parts (who wrote the words, book by book) or works (for a source cited by its works), one of the two"));
        }
        for id in &c.works {
            if s.work(id).is_none() {
                return Err(format!("{at}: works names {id:?}, which is not in works"));
            }
        }
        for (i, p) in c.parts.iter().enumerate() {
            let at = format!("{at}, parts[{i}]");
            if let Books::All(a) = &p.books {
                if a != "all" {
                    return Err(format!("{at}: books is a list of books or \"all\""));
                }
            }
            if let Some(b) = p.books.list().into_iter().find(|b| *b != "all" && !book_name(b)) {
                return Err(format!("{at}: books names {b:?}, which is not a book of the Bible (spell it as atlas_core::BOOKS does)"));
            }
            if let Some([a, b]) = p.chapters {
                if !matches!(&p.books, Books::List(l) if l.len() == 1) {
                    return Err(format!("{at}: chapters only with a single book"));
                }
                if a == 0 || b < a {
                    return Err(format!("{at}: chapters must be [from, to]"));
                }
            }
            if s.work(&p.work).is_none() {
                return Err(format!("{at}: work {:?} is not in works", p.work));
            }
            if p.writers.is_empty() == p.unnamed.is_none() {
                return Err(format!("{at}: give writers, or unnamed when no writer can be named, one of the two"));
            }
            for id in p.writers.iter().chain(&p.translated_by).chain(&p.counts_as) {
                writer(id, &at)?;
            }
            if p.unnamed.as_deref().is_some_and(|u| u.trim().is_empty()) || p.evidence.trim().is_empty() {
                return Err(format!("{at}: unnamed and evidence may not be empty"));
            }
            match (&p.written, &p.written_from) {
                (Some(w), Some(f)) => dated_soundly(&at, w, f, p.year.as_deref())?,
                (None, None) if p.year.is_none() => {}
                _ => return Err(format!("{at}: a part with its own date gives written and written_from (and year only with them)")),
            }
            if p.attributed && p.writers.is_empty() {
                return Err(format!("{at}: attributed names the writer the work is credited to"));
            }
            // Parts of one source never overlap.
            for (j, q) in c.parts.iter().enumerate().take(i) {
                let shared = p.books.list().into_iter().any(|b| b == "all" || q.books.covers(b)) || matches!(q.books, Books::All(_));
                let chapters = match (p.chapters, q.chapters) {
                    (Some([a, b]), Some([c2, d])) => a <= d && c2 <= b,
                    _ => true,
                };
                if shared && chapters {
                    return Err(format!("{at}: overlaps parts[{j}]; each book (and chapter) of a source has one part"));
                }
            }
        }
    }
    for a in &s.avoid {
        let at = format!("{SOURCES}: avoid {:?}", a.name);
        if a.name.trim().is_empty() || a.why.trim().is_empty() || a.names.is_empty() || a.names.iter().any(|n| n.trim().is_empty()) {
            return Err(format!("{at}: needs a name, a why and at least one match, none empty"));
        }
    }
    for d in &s.denies {
        let at = format!("{SOURCES}: denies {} on {}", d.source, d.on);
        if !s.cite.iter().any(|c| c.id == d.source) {
            return Err(format!("{at}: source is not on the cite list"));
        }
        writer(&d.writer, &at)?;
        if refs::parse(&d.on).is_none() {
            return Err(format!("{at}: on does not parse"));
        }
        if [&d.words, &d.why, &d.decided].iter().any(|v| v.trim().is_empty()) {
            return Err(format!("{at}: needs the words on the page, why and decided"));
        }
    }
    Ok(())
}

/// A date the credit shows, with its evidence: never guessed.
fn dated_soundly(at: &str, written: &str, from: &str, year: Option<&str>) -> Result<(), String> {
    if written.trim().is_empty() || from.trim().is_empty() {
        return Err(format!("{at}: written needs written_from, the evidence for the date"));
    }
    if (written == NO_DATE.0) != from.starts_with(NO_DATE.1) {
        return Err(format!("{at}: {:?} goes only with written_from starting {:?}", NO_DATE.0, NO_DATE.1));
    }
    if let Some(y) = year {
        if !is_year(y) || written == NO_DATE.0 {
            return Err(format!("{at}: year {y:?} must be one checked year (\"1866\") or a decade (\"1860s\")"));
        }
    }
    Ok(())
}

/// Every evidence id a part or work names has its attribution record.
fn check_evidence_ids(s: &SourceFile, ev: &Evidence) -> Result<(), String> {
    let ids = s.cite.iter().flat_map(|c| c.parts.iter().map(move |p| (c.id.as_str(), p.evidence.as_str()))).chain(s.works.iter().filter_map(|w| Some((w.id.as_str(), w.evidence.as_deref()?))));
    for (owner, id) in ids {
        if !ev.attribution.contains_key(id) {
            return Err(format!("{SOURCES}: {owner} names evidence {id:?}, which no attribution record in {EVIDENCE}/ has"));
        }
    }
    Ok(())
}

// --- Evidence: when each cite was read or checked, and who wrote what ---------------

/// A calendar date.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub struct Date {
    y: i32,
    m: u32,
    d: u32,
}

impl Date {
    /// "2026-10-20", a real calendar date, or None.
    pub fn parse(s: &str) -> Option<Date> {
        let b = s.as_bytes();
        if b.len() != 10 || b[4] != b'-' || b[7] != b'-' || !s.bytes().enumerate().all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit()) {
            return None;
        }
        let (y, m, d) = (s[..4].parse().ok()?, s[5..7].parse().ok()?, s[8..].parse().ok()?);
        let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
        let days = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        ((1..=12).contains(&m) && d >= 1 && d <= days[m as usize - 1]).then_some(Date { y, m, d })
    }

    /// Today, in UTC.
    pub fn today() -> Date {
        let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        // Howard Hinnant's civil_from_days.
        let z = (secs / 86_400) as i64 + 719_468;
        let era = z.div_euclid(146_097);
        let doe = z - era * 146_097;
        let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        let mp = (5 * doy + 2) / 153;
        let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
        let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
        Date { y: (yoe + era * 400 + i64::from(m <= 2)) as i32, m, d }
    }

    pub fn iso(&self) -> String {
        format!("{:04}-{:02}-{:02}", self.y, self.m, self.d)
    }
}

/// A record that a cite was read from its page on a day (`kind: "reads"`).
struct ReadRec {
    file: String,
    passage: String,
    note: Option<u64>,
    kind: Option<String>,
    source: String,
    on: Option<String>,
    at: Option<String>,
    urls: Vec<String>,
    fetched: Date,
}

/// A record that a cite was checked against the source by a PR's date (`kind: "checks"`).
struct CheckRec {
    passage: String,
    note: u64,
    kind: String,
    source: String,
    on: Option<String>,
    at: Option<String>,
    by: Date,
}

#[derive(Default)]
struct Evidence {
    reads: Vec<ReadRec>,
    checks: Vec<CheckRec>,
    /// Attribution records by id.
    attribution: BTreeMap<String, Value>,
}

/// Every file in `docs/evidence/`, by its `kind`.
fn read_evidence(root: &Path, today: Date) -> Result<Evidence, String> {
    let dir = root.join(EVIDENCE);
    let mut ev = Evidence::default();
    let Ok(entries) = fs::read_dir(&dir) else { return Ok(ev) };
    let mut files: Vec<_> = entries.filter_map(Result::ok).map(|e| e.path()).filter(|p| p.extension().is_some_and(|x| x == "json")).collect();
    files.sort();
    for path in files {
        let name = format!("{EVIDENCE}/{}", path.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_default());
        let v: Value = serde_json::from_str(&fs::read_to_string(&path).map_err(|e| format!("reading {name}: {e}"))?).map_err(|e| format!("parsing {name}: {e}"))?;
        evidence_file(&name, &v, today, &mut ev)?;
    }
    Ok(ev)
}

fn text<'v>(v: &'v Value, k: &str) -> Option<&'v str> {
    v[k].as_str()
}

/// A date field of a record: real, not after today, and inside its file's window.
fn date_in(at: &str, s: Option<&str>, window: (Date, Date), today: Date) -> Result<Date, String> {
    let s = s.ok_or_else(|| format!("{at}: needs a date"))?;
    let d = Date::parse(s).ok_or_else(|| format!("{at}: {s:?} is not a real date (YYYY-MM-DD)"))?;
    if d > today {
        return Err(format!("{at}: {s} is after today ({}); a date is never claimed before it happens", today.iso()));
    }
    if d < window.0 || d > window.1 {
        return Err(format!("{at}: {s} is outside the file's dates ({} to {})", window.0.iso(), window.1.iso()));
    }
    Ok(d)
}

/// "2026-10-21T07:12:03Z" on the record's own date.
fn time_on(s: &str, day: Date) -> bool {
    let b = s.as_bytes();
    b.len() == 20 && Date::parse(&s[..10]) == Some(day) && b[10] == b'T' && b[13] == b':' && b[16] == b':' && b[19] == b'Z' && [11, 12, 14, 15, 17, 18].iter().all(|&i| b[i].is_ascii_digit()) && &s[11..13] < "24" && &s[14..16] < "60" && &s[17..19] < "60"
}

/// One evidence file, read into `ev`.
fn evidence_file(name: &str, v: &Value, today: Date, ev: &mut Evidence) -> Result<(), String> {
    let window = || -> Result<(Date, Date), String> {
        let one = |k: &str| text(v, k).map(|s| Date::parse(s).ok_or_else(|| format!("{name}: {k} {s:?} is not a real date")));
        match (one("fetched"), one("from"), one("to")) {
            (Some(d), None, None) => {
                let d = d?;
                Ok((d, d))
            }
            (None, Some(a), Some(b)) => Ok((a?, b?)),
            _ => Err(format!("{name}: give the file's date (fetched) or its window (from and to)")),
        }
    };
    match text(v, "kind") {
        Some("reads") => {
            let w = window()?;
            for (i, r) in v["records"].as_array().into_iter().flatten().enumerate() {
                let at = format!("{name}: records[{i}]");
                let fetched = date_in(&format!("{at}: fetched"), text(r, "fetched"), w, today)?;
                if let Some(t) = text(r, "time") {
                    if !time_on(t, fetched) {
                        return Err(format!("{at}: time {t:?} must be the UTC time on the day fetched, as 2026-10-21T07:12:03Z"));
                    }
                }
                // A field the cite has changed since the record was written ("at_now"; null when dropped) is matched as it now stands.
                let field = |k: &str| -> Option<String> {
                    let now = format!("{k}_now");
                    if r.get(&now).is_some() { text(r, &now) } else { text(r, k) }.map(str::to_string)
                };
                let (Some(passage), Some(source), Some(url)) = (text(r, "passage"), text(r, "source"), text(r, "url")) else {
                    return Err(format!("{at}: needs passage, source and url"));
                };
                let mut urls = vec![url.to_string()];
                urls.extend(text(r, "url_now").map(str::to_string));
                ev.reads.push(ReadRec {
                    file: name.to_string(),
                    passage: passage.to_string(),
                    note: r["note"].as_u64(),
                    kind: text(r, "kind").map(str::to_string),
                    source: source.to_string(),
                    on: field("on"),
                    at: field("at"),
                    urls,
                    fetched,
                });
            }
        }
        Some("checks") => {
            let mut prs: BTreeMap<u64, Date> = BTreeMap::new();
            for (i, p) in v["prs"].as_array().into_iter().flatten().enumerate() {
                let at = format!("{name}: prs[{i}]");
                let merged = text(p, "merged").and_then(Date::parse).ok_or_else(|| format!("{at}: merged is not a real date"))?;
                if merged > today {
                    return Err(format!("{at}: merged {} is after today", merged.iso()));
                }
                if text(p, "check").is_none_or(|c| c.trim().is_empty()) {
                    return Err(format!("{at}: say what the check was"));
                }
                prs.insert(p["pr"].as_u64().ok_or_else(|| format!("{at}: needs pr"))?, merged);
            }
            for (i, r) in v["records"].as_array().into_iter().flatten().enumerate() {
                let at = format!("{name}: records[{i}]");
                let s = |k: usize| r[k].as_str().map(str::to_string);
                let (Some(passage), Some(note), Some(kind), Some(source), Some(pr)) = (s(0), r[1].as_u64(), s(2), s(3), r[6].as_u64()) else {
                    return Err(format!("{at}: needs [passage, note, kind, source, on, at, pr]"));
                };
                let by = *prs.get(&pr).ok_or_else(|| format!("{at}: PR {pr} is not in prs"))?;
                ev.checks.push(CheckRec { passage, note, kind, source, on: s(4), at: s(5), by });
            }
        }
        Some("attribution") => {
            let w = window()?;
            for (i, r) in v["records"].as_array().into_iter().flatten().enumerate() {
                let at = format!("{name}: records[{i}]");
                let id = text(r, "id").filter(|x| is_id(x)).ok_or_else(|| format!("{at}: needs an id"))?;
                if text(&r["named_by"], "words").is_none_or(|x| x.trim().is_empty()) {
                    return Err(format!("{at} ({id}): named_by needs the words that name the writer, as printed"));
                }
                if r["matched"].is_object() {
                    date_in(&format!("{at} ({id}): matched.fetched"), text(&r["matched"], "fetched"), w, today)?;
                }
                if ev.attribution.insert(id.to_string(), r.clone()).is_some() {
                    return Err(format!("{at}: id {id:?} is used by an earlier record"));
                }
            }
        }
        // Where the quotations of Figures at Deep were found; extra_figures.rs owns them and Layers reads none.
        Some("figure-quotes") => {}
        _ => return Err(format!("{name}: kind must be \"reads\", \"checks\", \"attribution\" or \"figure-quotes\"")),
    }
    Ok(())
}

/// When a cite was read or checked.
#[derive(Clone, Copy, Debug, PartialEq)]
enum Dated {
    Read(Date),
    Checked(Date),
}

/// A cite as the evidence keys it, with its note and whether its key is
/// shared by another note of the passage (then the record must give note and kind).
struct CiteKey<'a> {
    passage: &'a str,
    note: usize,
    kind: &'a str,
    shared: bool,
    source: &'a str,
    on: Option<&'a str>,
    at: Option<&'a str>,
}

/// The first proven read date, from a record of the page the cite links to;
/// else the date it was checked against the source; else an error.
fn dated(ev: &Evidence, k: &CiteKey, link: &str, used: &mut [bool]) -> Result<Dated, String> {
    let same = |p: &str, n: Option<u64>, kind: Option<&str>, s: &str, on: Option<&str>, at: Option<&str>| {
        p == k.passage && s == k.source && on == k.on && at == k.at && (!k.shared || (n == Some(k.note as u64) && kind == Some(k.kind)))
    };
    let mut read: Option<Date> = None;
    let mut other: Option<&ReadRec> = None;
    for (i, r) in ev.reads.iter().enumerate() {
        if !same(&r.passage, r.note, r.kind.as_deref(), &r.source, r.on.as_deref(), r.at.as_deref()) {
            continue;
        }
        if r.urls.iter().any(|u| same_page(u, link)) {
            used[i] = true;
            read = Some(read.map_or(r.fetched, |d| d.min(r.fetched)));
        } else {
            other = Some(r);
        }
    }
    if let Some(d) = read {
        return Ok(Dated::Read(d));
    }
    if let Some(r) = other {
        return Err(format!("{} records reading it at {}, but the cite links to {link}; a read date is shown only beside the page read", r.file, r.urls[0]));
    }
    let checked = ev.checks.iter().filter(|c| same(&c.passage, Some(c.note), Some(&c.kind), &c.source, c.on.as_deref(), c.at.as_deref())).map(|c| c.by).min();
    checked.map(Dated::Checked).ok_or_else(|| format!("has no record that it was read or checked against the source; add a reads record in {EVIDENCE}/"))
}

/// Two links to the same page: scheme, host case, a leading "www." and a trailing slash do not matter.
fn same_page(a: &str, b: &str) -> bool {
    page_key(a) == page_key(b)
}

fn page_key(u: &str) -> String {
    let rest = u.split_once("://").map_or(u, |(_, r)| r);
    let (h, path) = rest.split_once('/').unwrap_or((rest, ""));
    format!("{}/{}", strip_www(&h.to_ascii_lowercase()), path.trim_end_matches('/'))
}

fn host(url: &str) -> String {
    let rest = url.split_once("://").map_or(url, |(_, r)| r);
    strip_www(&rest.split('/').next().unwrap_or(rest).to_ascii_lowercase()).to_string()
}

fn strip_www(h: &str) -> &str {
    h.strip_prefix("www.").unwrap_or(h)
}

/// A link that opens a whole work or a site's front page.
fn home_page(url: &str, own: Option<&str>) -> bool {
    let key = page_key(url);
    HOME_PAGES.iter().chain(own.as_slice()).any(|h| page_key(h) == key) || (key.ends_with('/') && key.matches('/').count() == 1)
}

/// The first of [`AI_CREDIT`] in `s`, as whole words in their own case.
pub fn ai_credit(s: &str) -> Option<&'static str> {
    AI_CREDIT.iter().copied().find(|p| {
        s.match_indices(p).any(|(i, _)| {
            let before = s[..i].chars().next_back().is_some_and(char::is_alphanumeric);
            let after = s[i + p.len()..].chars().next().is_some_and(char::is_alphanumeric);
            !before && !after
        })
    })
}

/// The path and phrase of the first string in `v` that credits AI.
pub fn ai_credit_in(v: &Value, path: &str) -> Option<(String, &'static str)> {
    match v {
        Value::String(s) => ai_credit(s).map(|p| (path.to_string(), p)),
        Value::Array(a) => a.iter().enumerate().find_map(|(i, x)| ai_credit_in(x, &format!("{path}[{i}]"))),
        Value::Object(o) => o.iter().find_map(|(k, x)| ai_credit_in(x, &if path.is_empty() { k.clone() } else { format!("{path}.{k}") })),
        _ => None,
    }
}

// --- Who wrote a cite's words ---------------------------------------------------------

/// What the credit says about a cite's writer and work.
struct Credit<'s> {
    work: &'s Work,
    writers: Vec<&'s Writer>,
    unnamed: Option<&'s str>,
    attributed: bool,
    translated_by: Vec<&'s Writer>,
    edition: Option<&'s str>,
    written: &'s str,
    year: Option<&'s str>,
    volume: Option<&'s str>,
    /// The writer key that counts toward a note's strength.
    key: String,
}

/// The part or work a cite's words come from, by the book and chapter of its `on`.
fn resolve<'s>(s: &'s SourceFile, src: &'s CiteSource, book: Option<&str>, chapter: u16, work: Option<&str>) -> Result<Credit<'s>, String> {
    let writers_of = move |ids: &[String]| ids.iter().filter_map(|id| s.writer(id)).collect::<Vec<_>>();
    if !src.works.is_empty() {
        let Some(id) = work else { return Err(format!("{} is cited by its works: say which with \"work\" ({})", src.name, src.works.join(", "))) };
        if !src.works.iter().any(|w| w == id) {
            return Err(format!("work {id:?} is not one of {}'s works ({})", src.name, src.works.join(", ")));
        }
        let w = s.work(id).expect("checked");
        if w.writers.is_empty() && w.unnamed.is_none() {
            return Err(format!("work {id:?} does not say who wrote it (writers or unnamed)"));
        }
        let writers = writers_of(&w.writers);
        let key = if writers.is_empty() { format!("{id}:all") } else { joined_ids(&writers) };
        return Ok(Credit { work: w, writers, unnamed: w.unnamed.as_deref(), attributed: false, translated_by: writers_of(&w.translated_by), edition: w.edition.as_deref(), written: &w.written, year: w.year.as_deref(), volume: None, key });
    }
    if work.is_some() {
        return Err(format!("{} names its writer by book; drop \"work\"", src.name));
    }
    let found: Vec<&Part> = src.parts.iter().filter(|p| book.is_some_and(|b| p.books.covers(b)) && p.chapters.is_none_or(|[a, b]| (a..=b).contains(&chapter))).collect();
    let [p] = found.as_slice() else {
        return Err(format!("no part of {SOURCES} says who wrote these words, so the app cannot credit them"));
    };
    let w = s.work(&p.work).expect("checked");
    let writers = writers_of(&p.writers);
    let key = match (&p.counts_as, writers.is_empty()) {
        (Some(id), _) => id.clone(),
        (None, false) => joined_ids(&writers),
        // One unnamed writer per book: a continuator, or a study Bible's writer on that book.
        (None, true) => format!("{}:{}", p.work, book.unwrap_or("?")),
    };
    let (written, year) = match &p.written {
        Some(d) => (d.as_str(), p.year.as_deref()),
        None => (w.written.as_str(), w.year.as_deref()),
    };
    let translated: Vec<&String> = if p.translated_by.is_empty() { w.translated_by.iter().collect() } else { p.translated_by.iter().collect() };
    Ok(Credit {
        work: w,
        writers,
        unnamed: p.unnamed.as_deref(),
        attributed: p.attributed,
        translated_by: translated.into_iter().filter_map(|id| s.writer(id)).collect(),
        edition: p.edition.as_deref().or(w.edition.as_deref()),
        written,
        year,
        volume: p.volume.as_deref(),
        key,
    })
}

fn joined_ids(ws: &[&Writer]) -> String {
    ws.iter().map(|w| w.id.as_str()).collect::<Vec<_>>().join("+")
}

/// "A", "A and B", "A, B and C".
fn and_list(names: &[&str]) -> String {
    match names {
        [] => String::new(),
        [a] => a.to_string(),
        [rest @ .., last] => format!("{} and {last}", rest.join(", ")),
    }
}

impl Credit<'_> {
    fn writer(&self) -> String {
        match self.unnamed {
            Some(u) => u.to_string(),
            None => and_list(&self.writers.iter().map(|w| w.name.as_str()).collect::<Vec<_>>()),
        }
    }

    /// Who the writer was; for two writers, each by surname.
    fn about(&self) -> Option<String> {
        match self.writers.as_slice() {
            [] => None,
            [w] => Some(w.about.clone()),
            ws => Some(ws.iter().map(|w| format!("{}: {}", w.name.rsplit(' ').next().unwrap_or(&w.name), w.about)).collect::<Vec<_>>().join("; ")),
        }
    }

    fn named(&self) -> &'static str {
        if self.unnamed.is_some() {
            "unnamed"
        } else if self.attributed {
            "attributed"
        } else {
            "named"
        }
    }

    fn work_name(&self) -> String {
        match self.volume {
            Some(v) => format!("{}, {v}", self.work.short),
            None => self.work.short.clone(),
        }
    }

    fn edition(&self) -> Option<String> {
        let tr = (!self.translated_by.is_empty()).then(|| format!("translated by {}", and_list(&self.translated_by.iter().map(|w| w.name.as_str()).collect::<Vec<_>>())));
        let parts: Vec<String> = tr.into_iter().chain(self.edition.map(str::to_string)).collect();
        (!parts.is_empty()).then(|| parts.join(", "))
    }
}

/// The credit a published cite carries: who wrote the words and who he was,
/// the work, its original date, the place cited, where the app read it, the
/// date read or checked, the link, the shelf card and the writer key.
fn credit_json(src: &CiteSource, s: &SourceFile, c: &Credit, cite: &CiteSpec, url: &str, dated: Dated) -> Value {
    let mut v = json!({ "writer": c.writer(), "named": c.named(), "work": c.work_name(), "written": c.written });
    if let Some(a) = c.about() {
        v["about"] = json!(a);
    }
    if let Some(y) = c.year {
        v["year"] = json!(y);
    }
    if let Some(e) = c.edition() {
        v["edition"] = json!(e);
    }
    if let Some(on) = &cite.on {
        v["on"] = json!(on);
    }
    if let Some(at) = &cite.at {
        v["at"] = json!(at);
    }
    let place: Vec<String> = cite.on.iter().map(|o| format!("on {o}")).chain(cite.at.clone()).collect();
    v["part"] = json!(place.join(", "));
    v["read_from"] = json!(s.site(url).map_or_else(|| host(url), |x| x.name.clone()));
    if !src.labels_as.is_empty() && !c.writers.iter().any(|w| src.labels_as.contains(&w.id)) {
        v["label"] = json!(src.name);
    }
    match dated {
        Dated::Read(d) => v["read_on"] = json!(d.iso()),
        Dated::Checked(d) => v["checked"] = json!(d.iso()),
    }
    v["url"] = json!(url);
    v["shelf"] = json!(c.work.shelf.as_deref().unwrap_or(&c.work.id));
    v["key"] = json!(c.key);
    if cite.counts == Some(false) {
        v["counts"] = json!(false);
    }
    v
}

/// Counts for the build log.
#[derive(Default)]
struct Tally {
    cites: usize,
    writers: BTreeMap<String, usize>,
    named: BTreeMap<&'static str, usize>,
    dates: BTreeMap<String, usize>,
}

/// Collects every problem in config order; the build reports the first.
struct Check<'s, 'a> {
    src: &'s Sources<'a>,
    sources: &'s SourceFile,
    evidence: &'s Evidence,
    /// Which reads records some live cite matched.
    used: Vec<bool>,
    tally: Tally,
    errors: Vec<String>,
}

impl Check<'_, '_> {
    fn fail(&mut self, at: &str, problem: impl Display) {
        self.errors.push(format!("{CONFIG}: {at}: {problem}"));
    }

    /// Fail if `s` names a source on the avoid list.
    fn avoid(&mut self, at: &str, field: &str, s: &str) {
        let sources = self.sources;
        for a in &sources.avoid {
            if let Some(n) = a.names.iter().find(|n| names(s, n)) {
                self.fail(at, format_args!("{field} names {n:?} ({}), which Layers may not cite: {}", a.name, a.why));
            }
        }
    }

    /// Fail if `s` credits AI.
    fn no_ai(&mut self, at: &str, field: &str, s: &str) {
        if let Some(p) = ai_credit(s) {
            self.fail(at, format_args!("{field} says {p:?}; credit the original sources, never AI (founder's decisions 13 and 15)"));
        }
    }

    /// Check a layer's citations; returns them for layers.json, and whether
    /// they make the layer live on their own.
    fn cites(&mut self, at: &str, p: &PassageSpec, note: usize, kind: &str, cites: &[CiteSpec]) -> (Vec<Value>, bool) {
        let sources = self.sources;
        let evidence = self.evidence;
        let mut out = Vec::new();
        // Two articles on one verse from the same site are two citations: the work tells them apart.
        let mut seen: Vec<(&str, Option<&str>, Option<&str>, Option<&str>)> = Vec::new();
        let mut interpreter = false;
        for (j, c) in cites.iter().enumerate() {
            let key = (c.source.as_str(), c.on.as_deref(), c.at.as_deref());
            let at = format!("{at}, cites[{j}]");
            let whole = (key.0, key.1, key.2, c.work.as_deref());
            if seen.contains(&whole) {
                self.fail(&at, "the same citation is listed twice");
            }
            seen.push(whole);
            let Some(s) = sources.cite.iter().find(|s| s.id == c.source) else {
                self.fail(&at, format_args!("source {:?} is not on the cite list in {SOURCES}", c.source));
                continue;
            };
            interpreter |= s.role == INTERPRETER;
            for (field, v) in [("on", &c.on), ("at", &c.at), ("url", &c.url), ("work", &c.work)] {
                if let Some(v) = v {
                    if v.trim().is_empty() {
                        self.fail(&at, format_args!("{field} is empty"));
                    }
                    self.esv(&at, field, v);
                    self.avoid(&at, field, v);
                    self.no_ai(&at, field, v);
                }
            }
            if c.url.as_deref().is_some_and(|u| !u.starts_with("https://")) {
                self.fail(&at, "url must start with https://");
            }
            if c.counts == Some(true) {
                self.fail(&at, "counts is only ever false (a cite counts unless it says so)");
            }
            let what = match &c.on {
                Some(o) => format!("{} on {o}", s.name),
                None => s.name.clone(),
            };
            let on = match &c.on {
                Some(r) => self.range(&at, r),
                None => {
                    self.fail(&at, format_args!("{} is a commentary or a work on a verse: say which verse with \"on\"", s.name));
                    None
                }
            };
            let located = on.and_then(|(start, _)| self.src.vz.locate(start));
            if let Some((book, _, _)) = located {
                let book = BOOKS[book as usize].name;
                if s.not_on.iter().any(|b| b == book) {
                    self.fail(&at, format_args!("{} is not cited on {book}: {}", s.name, s.why));
                }
            }
            if let Some(d) = sources.denies.iter().find(|d| d.source == c.source && c.on.as_deref() == Some(d.on.as_str())) {
                self.fail(&at, format_args!("{what} is left out: {} ({}; listed in denies)", d.why, d.decided));
            }
            let book = located.map(|(b, _, _)| BOOKS[b as usize].name);
            let chapter = located.map_or(0, |(_, ch, _)| ch as u16);
            let credit = match resolve(sources, s, book, chapter, c.work.as_deref()) {
                Ok(cr) => cr,
                Err(e) => {
                    self.fail(&at, format_args!("{what}: {e}"));
                    continue;
                }
            };
            if let Some(w) = credit.writers.iter().find(|w| w.excluded.is_some()) {
                let x = w.excluded.as_ref().expect("checked");
                self.fail(&at, format_args!("{what} are the words of {}, whom the Layers notes no longer cite: {} ({})", w.name, x.why, x.decided));
                continue;
            }
            let url = c.url.clone().or_else(|| {
                let (start, _) = on?;
                let (b, chapter, _) = self.src.vz.locate(start)?;
                let name = BOOKS[b as usize].name;
                if let Some(code) = s.biblehub.as_deref() {
                    // Bible Hub names every book by its name in snake case, except the Song of Solomon ("songs").
                    let slug = match name {
                        "Song of Solomon" => "songs".to_string(),
                        name => name.to_lowercase().replace(' ', "_"),
                    };
                    return Some(format!("https://biblehub.com/commentaries/{code}/{slug}/{chapter}.htm"));
                }
                let pattern = s.link.as_deref()?;
                Some(pattern.replace("{book}", &name.to_lowercase().replace(' ', "-")).replace("{chapter}", &chapter.to_string()))
            });
            let Some(url) = url.or_else(|| s.url.clone()) else {
                self.fail(&at, format_args!("{what} has no link: give the page with \"url\""));
                continue;
            };
            if home_page(&url, s.url.as_deref()) {
                self.fail(&at, format_args!("{what} links to {url}, which opens the whole work or site; link the page it cites"));
                continue;
            }
            let shared = p.layers.iter().enumerate().any(|(n, l)| n != note && l.cites.iter().any(|x| (x.source.as_str(), x.on.as_deref(), x.at.as_deref()) == key));
            let ck = CiteKey { passage: &p.id, note, kind, shared, source: &c.source, on: c.on.as_deref(), at: c.at.as_deref() };
            let when = match dated(evidence, &ck, &url, &mut self.used) {
                Ok(d) => d,
                Err(e) => {
                    self.fail(&at, format_args!("{what} {e}"));
                    continue;
                }
            };
            let t = &mut self.tally;
            t.cites += 1;
            *t.writers.entry(credit.key.clone()).or_default() += 1;
            *t.named.entry(credit.named()).or_default() += 1;
            let label = match when {
                Dated::Read(d) => format!("retrieved {}", d.iso()),
                Dated::Checked(d) => format!("checked by {}", d.iso()),
            };
            *t.dates.entry(label).or_default() += 1;
            out.push(credit_json(s, sources, &credit, c, &url, when));
        }
        let live = !out.is_empty() && (interpreter || !NEEDS_INTERPRETER.contains(&kind));
        (out, live)
    }

    /// Resolve a reference to an inclusive range of verse indices.
    fn range(&mut self, at: &str, r: &str) -> Option<(u32, u32)> {
        let Some(q) = refs::parse(r) else {
            self.fail(at, format_args!("reference {r:?} does not parse"));
            return None;
        };
        let found = refs::resolve(q, self.src.vz);
        if found.is_none() {
            self.fail(at, format_args!("reference {r:?} names verses the BSB does not have"));
        }
        found
    }

    /// Normalized BSB text of a range.
    fn bsb(&self, (s, e): (u32, u32)) -> String {
        normalize(&self.src.text[s as usize..=e as usize].join(" "))
    }

    fn esv(&mut self, at: &str, field: &str, s: &str) {
        if mentions_esv(s) {
            self.fail(at, format_args!("{field} mentions the ESV"));
        }
    }

    fn passage(&mut self, p: &PassageSpec) -> Option<Value> {
        let at = format!("passage {:?}", p.id);
        if p.id.trim().is_empty() {
            self.fail(&at, "id is empty");
        }
        if p.source.trim().is_empty() {
            self.fail(&at, "source is empty");
        }
        if !p.source.starts_with("Sources: ") {
            self.fail(&at, "source must begin \"Sources: \" and list the sources plainly");
        }
        if let Some(code) = DATASET_CODES.iter().find(|c| p.source.split(|ch: char| !ch.is_alphanumeric()).any(|w| w == **c)) {
            self.fail(&at, format_args!("source names the dataset code {code}; say what it is (\"the Hebrew and Greek texts from STEPBible\")"));
        }
        self.no_ai(&at, "source", &p.source);
        if !SECTIONS.contains(&p.section.as_str()) {
            self.fail(&at, format_args!("section {:?} is not one of: {}", p.section, SECTIONS.join(", ")));
        }
        if p.reviewed_by.iter().any(|n| n.trim().is_empty()) {
            self.fail(&at, "reviewed_by has an empty name");
        }
        for (field, s) in [("id", &p.id), ("ref", &p.reference), ("saying", &p.saying), ("source", &p.source)] {
            self.esv(&at, field, s);
        }
        self.avoid(&at, "source", &p.source);
        for name in &p.reviewed_by {
            self.esv(&at, "reviewed_by", name);
        }
        let range = self.range(&at, &p.reference);
        if let Some(r) = range {
            if !contains(&self.bsb(r), &p.saying) {
                self.fail(&at, format_args!("saying {:?} is not in the BSB text of {}", p.saying, p.reference));
            }
        }
        let layers: Vec<Option<Value>> = p.layers.iter().enumerate().map(|(i, l)| self.layer(p, range, i, l)).collect();
        if !p.layers.iter().any(|l| l.kind != PLAIN && l.strength != SOME) {
            self.fail(&at, format_args!("needs a layer besides the plain meaning that is not {SOME:?}"));
        }
        let (v, end) = range?;
        let mut layers: Vec<Value> = layers.into_iter().collect::<Option<_>>()?;
        // Reviewed passages go live whole; otherwise a note goes live on its citations.
        let reviewed = !p.reviewed_by.is_empty();
        if reviewed {
            for l in &mut layers {
                l["draft"] = json!(false);
            }
        }
        let draft = !layers.iter().any(|l| l["draft"] == json!(false) && l["kind"] != json!(PLAIN));
        Some(json!({
            "id": p.id, "section": p.section, "v": v, "end": end, "saying": p.saying, "source": p.source,
            "reviewed_by": p.reviewed_by, "draft": draft, "layers": layers,
        }))
    }

    fn layer(&mut self, p: &PassageSpec, passage: Option<(u32, u32)>, i: usize, l: &LayerSpec) -> Option<Value> {
        let at = format!("passage {:?}, layers[{i}] ({})", p.id, l.kind);
        if !KINDS.contains(&l.kind.as_str()) {
            self.fail(&at, format_args!("kind {:?} is not one of: {}", l.kind, KINDS.join(", ")));
        }
        if !STRENGTHS.contains(&l.strength.as_str()) {
            self.fail(&at, format_args!("strength {:?} is not one of: {}", l.strength, STRENGTHS.join(", ")));
        }
        self.esv(&at, "text", &l.text);
        if let Some(n) = too_long(&l.text, TEXT_MAX) {
            self.fail(&at, format_args!("text is {n} characters; keep it to {TEXT_MAX} and move detail to evidence"));
        }
        self.avoid(&at, "text", &l.text);
        if let Some(e) = &l.evidence {
            self.esv(&at, "evidence", e);
            self.avoid(&at, "evidence", e);
            if let Some(n) = too_long(e, EVIDENCE_MAX) {
                self.fail(&at, format_args!("evidence is {n} characters; keep it to {EVIDENCE_MAX}"));
            }
        }
        let (cites, cited) = self.cites(&at, p, i, &l.kind, &l.cites);
        for r in &l.refs {
            self.esv(&at, "refs", r);
        }
        for w in &l.words {
            self.esv(&at, "words", &w.reference);
            self.esv(&at, "words", &w.strong);
        }
        let ranges: Vec<Option<(u32, u32)>> = l.refs.iter().map(|r| self.range(&at, r)).collect();

        // Words: each names a root that occurs in its verse; publish every place it does.
        let mut words: Vec<[u32; 3]> = Vec::new();
        for w in &l.words {
            let Some(r) = self.range(&at, &w.reference) else { continue };
            let hits = self.root_hits(r, &w.strong);
            if hits.is_empty() {
                let present = self.roots_present(r);
                self.fail(&at, format_args!("{} is not a root in {} (roots there: {})", w.strong, w.reference, present.join(", ")));
            }
            for h in hits {
                if !words.contains(&h) {
                    words.push(h);
                }
            }
        }

        // Quotations: skipped when a reference already failed, to report one cause once.
        match quotes(&l.text) {
            Err(problem) => self.fail(&at, format_args!("text: {problem}")),
            Ok(qs) => {
                if let (Some(pr), true) = (passage, ranges.iter().all(Option::is_some)) {
                    let texts: Vec<String> = std::iter::once(pr).chain(ranges.iter().flatten().copied()).map(|r| self.bsb(r)).collect();
                    for q in qs.into_iter().filter(|q| word_count(q) >= QUOTE_MIN_WORDS) {
                        if !texts.iter().any(|t| contains(t, q)) {
                            let mut searched: Vec<&str> = Vec::new();
                            for r in std::iter::once(&p.reference).chain(&l.refs) {
                                if !searched.contains(&r.as_str()) {
                                    searched.push(r);
                                }
                            }
                            self.fail(&at, format_args!("quotation {q:?} is not in the BSB text of {}", searched.join(", ")));
                        }
                    }
                }
            }
        }

        // Evidence for "widely agreed".
        if let Some(pr) = passage {
            let outside = ranges.iter().flatten().any(|&r| !within(r, pr));
            let note = l.evidence.as_deref().is_some_and(|e| !e.trim().is_empty());
            if l.strength == WIDELY && l.kind != PLAIN && l.words.is_empty() && !outside && !note {
                self.fail(&at, format_args!("{WIDELY:?} needs words, a ref outside {}, or an evidence note", p.reference));
            }
        }

        let pr = passage?;
        let refs: Vec<Value> = ranges
            .into_iter()
            .map(|r| r.map(|(s, e)| json!({ "s": s, "e": e, "arc": within((s, e), pr) || linked(self.src.graph, pr, (s, e)) })))
            .collect::<Option<_>>()?;
        let mut layer = json!({
            "kind": l.kind, "strength": l.strength, "text": l.text, "refs": refs, "words": words, "cites": cites, "draft": !cited,
        });
        if let Some(e) = l.evidence.as_deref().filter(|e| !e.trim().is_empty()) {
            layer["evidence"] = json!(e);
        }
        Some(layer)
    }

    /// Every main-text word in the range whose root is `strong`: [verse, position, root index].
    fn root_hits(&self, (s, e): (u32, u32), strong: &str) -> Vec<[u32; 3]> {
        let mut hits = Vec::new();
        for v in s..=e {
            for (pos, w) in self.src.words[v as usize].iter().enumerate() {
                let Some(key) = w.lemma.as_deref().filter(|k| w.main && lemma_matches(k, strong)) else { continue };
                if let Some(&li) = self.src.lemma_index.get(key) {
                    hits.push([v, pos as u32, li]);
                }
            }
        }
        hits
    }

    /// Roots of the main-text words in a range, each once with its first gloss, for error messages.
    fn roots_present(&self, (s, e): (u32, u32)) -> Vec<String> {
        let mut seen: Vec<(&str, &str)> = Vec::new();
        for v in s..=e {
            for w in self.src.words[v as usize].iter().filter(|w| w.main) {
                if let Some(k) = w.lemma.as_deref().filter(|k| !seen.iter().any(|(s, _)| s == k)) {
                    seen.push((k, &w.gloss));
                }
            }
        }
        seen.into_iter().map(|(k, g)| format!("{k} ({g})")).collect()
    }
}

// --- For the Sources shelf and NOTICE.md -------------------------------------------------

/// A Layers work as the Sources shelf presents it: its card, and one row per
/// part (or, for a work cited directly, one row) saying who wrote the words
/// of which books, and how we know.
pub struct ShelfWork {
    pub id: String,
    pub card: String,
    pub rows: Vec<Value>,
}

/// "Genesis", "Exodus 1 to 19", "Matthew to John", "Hosea, Joel and Amos".
fn books_phrase(p: &Part) -> String {
    let list = p.books.list();
    if list == ["all"] {
        return "every book".to_string();
    }
    if let (Some([a, b]), [one]) = (p.chapters, list.as_slice()) {
        return format!("{one} {a} to {b}");
    }
    let idx: Vec<usize> = list.iter().filter_map(|b| BOOKS.iter().position(|x| x.name == *b)).collect();
    if idx.len() > 2 && idx.windows(2).all(|w| w[1] == w[0] + 1) {
        return format!("{} to {}", list[0], list[list.len() - 1]);
    }
    and_list(&list)
}

/// Every Layers work, with its card and its writers by book, from
/// `config/layer-sources.json` and the attribution evidence.
pub fn shelf_works(root: &Path) -> Result<Vec<ShelfWork>, String> {
    let s = read_sources(root)?;
    let ev = read_evidence(root, Date::today())?;
    check_evidence_ids(&s, &ev)?;
    let how = |id: &str| ev.attribution.get(id).cloned().unwrap_or(Value::Null);
    let mut out: Vec<ShelfWork> = s.works.iter().map(|w| ShelfWork { id: w.id.clone(), card: w.shelf.clone().unwrap_or_else(|| w.id.clone()), rows: Vec::new() }).collect();
    for c in &s.cite {
        for p in &c.parts {
            let Some(sw) = out.iter_mut().find(|x| x.id == p.work) else { continue };
            let cr = resolve_part(&s, p);
            let mut row = json!({ "books": books_phrase(p), "work": cr.work.short, "writer": cr.writer(), "named": cr.named(), "written": cr.written, "site": c.name, "how": how(&p.evidence) });
            for (k, v) in [("about", cr.about()), ("volume", cr.volume.map(str::to_string)), ("edition", cr.edition()), ("site_says", c.site_says.clone())] {
                if let Some(v) = v {
                    row[k] = json!(v);
                }
            }
            if cr.writers.iter().any(|w| w.excluded.is_some()) {
                row["excluded"] = json!(true);
            }
            sw.rows.push(row);
        }
    }
    for w in &s.works {
        let Some(e) = &w.evidence else { continue };
        let sw = out.iter_mut().find(|x| x.id == w.id).expect("every work has an entry");
        if !sw.rows.is_empty() {
            continue;
        }
        let names: Vec<&str> = w.writers.iter().filter_map(|id| s.writer(id)).map(|x| x.name.as_str()).collect();
        let mut row = json!({ "books": "", "work": w.short, "writer": w.unnamed.clone().unwrap_or_else(|| and_list(&names)), "named": if w.unnamed.is_some() { "unnamed" } else { "named" }, "written": w.written, "how": how(e) });
        if let [one] = w.writers.as_slice() {
            row["about"] = json!(s.writer(one).map(|x| x.about.clone()));
        }
        if let Some(ed) = &w.edition {
            row["edition"] = json!(ed);
        }
        sw.rows.push(row);
    }
    Ok(out)
}

/// A part's credit, as `resolve` gives it for a cite in that part.
fn resolve_part<'s>(s: &'s SourceFile, p: &'s Part) -> Credit<'s> {
    let w = s.work(&p.work).expect("checked");
    let writers: Vec<&Writer> = p.writers.iter().filter_map(|id| s.writer(id)).collect();
    let (written, year) = match &p.written {
        Some(d) => (d.as_str(), p.year.as_deref()),
        None => (w.written.as_str(), w.year.as_deref()),
    };
    let tr = if p.translated_by.is_empty() { &w.translated_by } else { &p.translated_by };
    Credit { work: w, key: joined_ids(&writers), writers, unnamed: p.unnamed.as_deref(), attributed: p.attributed, translated_by: tr.iter().filter_map(|id| s.writer(id)).collect(), edition: p.edition.as_deref().or(w.edition.as_deref()), written, year, volume: p.volume.as_deref() }
}

#[cfg(test)]
/// For NOTICE.md: one paragraph per many-handed set, the writers by book, as
/// `config/layer-sources.json` gives them (a test keeps NOTICE.md the same).
fn notice_paragraphs(s: &SourceFile) -> Vec<String> {
    let mut out = Vec::new();
    for c in s.cite.iter().filter(|c| c.parts.len() > 1) {
        let rows: Vec<String> = c
            .parts
            .iter()
            .map(|p| {
                let cr = resolve_part(s, p);
                let who = if cr.attributed { format!("{} (attributed)", cr.writer()) } else { cr.writer() };
                format!("{}: {who}", books_phrase(p))
            })
            .collect();
        out.push(format!("- **{}**: {}.", c.name, rows.join("; ")));
    }
    out
}

// --- atlas verify -------------------------------------------------------------------------

/// The built layers.json: every cite carries a whole credit, a true date,
/// a page link and a shelf card that exists.
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let read = |f: &str| -> Result<Value, String> { serde_json::from_str(&fs::read_to_string(d.dir.join(f)).map_err(|e| format!("{f}: {e}"))?).map_err(|e| format!("{f}: {e}")) };
    let layers = read("layers.json")?;
    let shelf = read("shelf.json")?;
    let cards: BTreeSet<&str> = shelf["works"].as_array().into_iter().flatten().filter_map(|w| w["id"].as_str()).collect();
    let today = Date::today();
    let (mut n, mut whole, mut dated, mut linked, mut no_ai, mut carded) = (0usize, Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new());
    for p in layers.as_array().into_iter().flatten() {
        for l in p["layers"].as_array().into_iter().flatten() {
            for c in l["cites"].as_array().into_iter().flatten() {
                n += 1;
                let at = || format!("{} {}", p["id"].as_str().unwrap_or("?"), c["part"].as_str().unwrap_or("?"));
                if ["writer", "work", "written", "read_from"].iter().any(|k| c[*k].as_str().is_none_or(|s| s.trim().is_empty())) {
                    whole.push(at());
                }
                let dates: Vec<Option<Date>> = ["read_on", "checked"].iter().filter_map(|k| c[*k].as_str()).map(Date::parse).collect();
                if dates.len() != 1 || dates[0].is_none_or(|x| x > today) {
                    dated.push(at());
                }
                if c["url"].as_str().is_none_or(|u| !u.starts_with("https://") || home_page(u, None)) {
                    linked.push(at());
                }
                if c.as_object().into_iter().flatten().any(|(_, v)| v.as_str().is_some_and(|s| ai_credit(s).is_some())) {
                    no_ai.push(at());
                }
                if c["shelf"].as_str().is_none_or(|s| !cards.contains(s)) {
                    carded.push(at());
                }
            }
            if p["source"].as_str().is_none_or(|s| ai_credit(s).is_some()) {
                no_ai.push(format!("{} source line", p["id"].as_str().unwrap_or("?")));
            }
        }
    }
    let first = |v: &[String]| v.iter().take(3).cloned().collect::<Vec<_>>().join("; ");
    Ok(vec![
        (n > 0, format!("layers.json has cites ({n})")),
        (whole.is_empty(), format!("every Layers cite names its writer, work, date and the site read ({} without: {})", whole.len(), first(&whole))),
        (dated.is_empty(), format!("every Layers cite has one true date, read or checked, none after today ({} without: {})", dated.len(), first(&dated))),
        (linked.is_empty(), format!("every Layers cite links an https page, not a work's home page ({} not: {})", linked.len(), first(&linked))),
        (no_ai.is_empty(), format!("no Layers credit or source line mentions AI ({}: {})", no_ai.len(), first(&no_ai))),
        (carded.is_empty(), format!("every Layers cite's work has its card on the Sources shelf ({} without: {})", carded.len(), first(&carded))),
    ])
}

/// Lowercase letters and digits with single spaces between words. Everything
/// else is dropped, quotation marks and apostrophes of every style included,
/// so "God’s" and "God's" both become "gods". Em and en dashes separate words
/// ("down—that" is two), as the BSB uses them between clauses.
fn normalize(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if c.is_alphanumeric() {
            out.extend(c.to_lowercase());
        } else if (c.is_whitespace() || c == '\u{2014}' || c == '\u{2013}') && !out.is_empty() && !out.ends_with(' ') {
            out.push(' ');
        }
    }
    if out.ends_with(' ') {
        out.pop();
    }
    out
}

/// A saying or quotation split at its ellipses ("…" or "..."), each part
/// normalized; empty parts are dropped.
fn parts(s: &str) -> Vec<String> {
    s.replace("...", "…").split('…').map(normalize).filter(|p| !p.is_empty()).collect()
}

/// The length of `s` in characters, when it is over `max`.
fn too_long(s: &str, max: usize) -> Option<usize> {
    Some(s.chars().count()).filter(|&n| n > max)
}

fn word_count(quote: &str) -> usize {
    parts(quote).iter().map(|p| p.split(' ').count()).sum()
}

/// Does normalized `text` contain every part of `quote`, as whole words and in order?
fn contains(text: &str, quote: &str) -> bool {
    let parts = parts(quote);
    if parts.is_empty() {
        return false;
    }
    let text = format!(" {text} ");
    let mut at = 0;
    for p in parts {
        let needle = format!(" {p} ");
        match text[at..].find(&needle) {
            // Continue from the trailing space so the next part can start right after.
            Some(i) => at += i + needle.len() - 1,
            None => return false,
        }
    }
    true
}

/// The spans between double quotation marks, straight ("…") or curly (“…”).
fn quotes(text: &str) -> Result<Vec<&str>, String> {
    let mut spans = Vec::new();
    let mut open: Option<usize> = None;
    for (i, c) in text.char_indices() {
        match (c, open) {
            ('"' | '\u{201C}', None) => open = Some(i + c.len_utf8()),
            ('"' | '\u{201D}', Some(start)) => {
                spans.push(&text[start..i]);
                open = None;
            }
            ('\u{201C}', Some(_)) => return Err(format!("opening quotation mark inside a quotation, before {:?}", near(&text[i..]))),
            ('\u{201D}', None) => return Err(format!("closing quotation mark with no opening one, before {:?}", near(&text[i..]))),
            _ => {}
        }
    }
    match open {
        Some(start) => Err(format!("the quotation starting {:?} is never closed", near(&text[start..]))),
        None => Ok(spans),
    }
}

/// The first few words of `s`, to point at a spot in a long text.
fn near(s: &str) -> String {
    s.chars().take(40).collect()
}

/// "H0120" matches the root keys "H0120" and "H0120G": the key itself or the
/// key followed by exactly one letter (STEPBible's sense suffix).
fn lemma_matches(key: &str, strong: &str) -> bool {
    key == strong
        || (key.len() == strong.len() + 1 && key.starts_with(strong) && key.as_bytes()[strong.len()].is_ascii_alphabetic())
}

/// "ESV" as a whole word, in any case.
fn mentions_esv(s: &str) -> bool {
    s.split(|c: char| !c.is_alphanumeric()).any(|w| w.eq_ignore_ascii_case("esv"))
}

/// Does `text` name `part` where a word starts? "Vincent" is found in
/// "Vincent's Word Studies" but not in "Invincent".
fn names(text: &str, part: &str) -> bool {
    text.match_indices(part).any(|(i, _)| !text[..i].chars().next_back().is_some_and(char::is_alphanumeric))
}

/// Is range `a` equal to or inside range `b`?
fn within(a: (u32, u32), b: (u32, u32)) -> bool {
    a.0 >= b.0 && a.1 <= b.1
}

/// Is there a cross-reference, either direction and any votes, between some
/// verse of `a` and some verse of `b`? An edge reaches every verse of its span.
fn linked(g: &XrefGraph, a: (u32, u32), b: (u32, u32)) -> bool {
    let reaches = |from: (u32, u32), to: (u32, u32)| {
        (from.0..=from.1).any(|v| g.out(v).any(|e| g.dst[e] <= to.1 && g.dst[e] + g.span[e].max(1) as u32 > to.0))
    };
    reaches(a, b) || reaches(b, a)
}

#[cfg(test)]
mod tests {
    use super::*;
    use atlas_core::graph::RawEdge;

    #[test]
    fn normalizes() {
        assert_eq!(normalize("  First, his name means “king of righteousness.”  "), "first his name means king of righteousness");
        assert_eq!(normalize("God’s \"Light\"\tdon't kinsman-redeemer 1:2"), "gods light dont kinsmanredeemer 12");
        assert_eq!(normalize("“ — ”"), "");
        assert_eq!(normalize("was thrown down—that ancient serpent"), "was thrown down that ancient serpent");
    }

    #[test]
    fn extracts_quotes() {
        assert_eq!(quotes("He said, \"Receive the Holy Spirit.\" Then \"x\"").unwrap(), ["Receive the Holy Spirit.", "x"]);
        assert_eq!(quotes("“king of Salem” means “king of peace.”").unwrap(), ["king of Salem", "king of peace."]);
        assert_eq!(quotes("Mixed “curly\" and \"straight”").unwrap(), ["curly", "straight"]);
        assert!(quotes("no quotes here").unwrap().is_empty());
        assert!(quotes("an \"unclosed quotation").is_err());
        assert!(quotes("a stray” mark").is_err());
        assert!(quotes("“nested “twice”").is_err());
    }

    #[test]
    fn matches_with_ellipses() {
        let text = normalize("“Do not call me Naomi,” she replied. “Call me Mara, because the Almighty has dealt quite bitterly with me. I went away full, but the LORD has brought me back empty.");
        assert!(contains(&text, "Call me Mara... I went away full"));
        assert!(contains(&text, "call me mara … the LORD has brought me back empty"));
        assert!(!contains(&text, "I went away full... Call me Mara")); // out of order
        assert!(!contains(&text, "all me Mara")); // whole words only
        assert!(!contains(&text, "..."));
        assert!(contains(&text, "...Do not call me"));
        assert_eq!(word_count("Call me Mara... I went away full"), 7);
        assert_eq!(word_count("“man hu?”"), 2);
    }

    #[test]
    fn matches_lemma_keys() {
        assert!(lemma_matches("H0120", "H0120"));
        assert!(lemma_matches("H0120G", "H0120"));
        assert!(!lemma_matches("H0120GH", "H0120"));
        assert!(!lemma_matches("H01201", "H0120"));
        assert!(!lemma_matches("H0127", "H0120"));
        assert!(!lemma_matches("H012", "H0120"));
        assert!(!lemma_matches("H0120", "H0120G"));
    }

    #[test]
    fn counts_characters_not_bytes() {
        assert_eq!(too_long("abc", 3), None);
        assert_eq!(too_long("abcd", 3), Some(4));
        assert_eq!(too_long("“ab”", 4), None);
        assert_eq!(too_long("ra’ah", 4), Some(5));
    }

    #[test]
    fn finds_esv_as_a_word() {
        assert!(mentions_esv("as the ESV puts it") && mentions_esv("(esv)"));
        assert!(!mentions_esv("ESVs") && !mentions_esv("lESV"));
    }

    #[test]
    fn names_a_source_where_a_word_starts() {
        assert!(names("as the Cambridge Bible notes", "Cambridge Bible"));
        assert!(names("(BDB, s.v.)", "BDB"));
        assert!(names("Meyer's note", "Meyer"));
        assert!(!names("STEPBDB", "BDB"));
        assert!(!names("Invincent", "Vincent"));
    }

    fn real() -> SourceFile {
        let v: Value = serde_json::from_str(include_str!("../../../config/layer-sources.json")).unwrap();
        assert!(ai_credit_in(&v, "").is_none());
        let s: SourceFile = serde_json::from_value(v).unwrap();
        check_sources(&s).unwrap();
        s
    }

    fn source<'s>(s: &'s SourceFile, id: &str) -> &'s CiteSource {
        s.cite.iter().find(|c| c.id == id).unwrap()
    }

    /// The writer a cite of `id` on reference `on` resolves to.
    fn who(s: &SourceFile, id: &str, on: &str) -> String {
        let q = refs::parse(on).unwrap();
        resolve(s, source(s, id), Some(BOOKS[q.book as usize].name), q.chapter, None).map(|c| c.writer()).unwrap_or_else(|e| e)
    }

    #[test]
    fn the_source_list_is_sound() {
        let s = real();
        for k in NEEDS_INTERPRETER {
            assert!(KINDS.contains(&k));
        }
        assert!(s.cite.iter().any(|c| c.role == INTERPRETER) && s.cite.iter().any(|c| c.role == "reference"));
        assert!(s.sites.iter().any(|x| x.name == "Bible Hub") && !s.writers.is_empty() && !s.works.is_empty());
        // Every writer is credited somewhere, and every work is cited or presents a part.
        for w in &s.writers {
            let used = s.cite.iter().any(|c| c.labels_as.contains(&w.id) || c.parts.iter().any(|p| p.writers.contains(&w.id) || p.translated_by.contains(&w.id) || p.counts_as.as_ref() == Some(&w.id)))
                || s.works.iter().any(|x| x.writers.contains(&w.id) || x.translated_by.contains(&w.id))
                || s.denies.iter().any(|d| d.writer == w.id);
            assert!(used, "writer {} is credited nowhere", w.id);
        }
        for w in &s.works {
            assert!(s.cite.iter().any(|c| c.works.contains(&w.id) || c.parts.iter().any(|p| p.work == w.id)), "work {} is in no source", w.id);
        }
    }

    #[test]
    fn resolves_the_true_writer_by_book() {
        let s = real();
        for (id, on, writer) in [
            ("barnes", "Genesis 2:7", "James G. Murphy"),
            ("barnes", "Exodus 2:10", "F. C. Cook"),
            ("barnes", "Exodus 32:32", "Samuel Clark"),
            ("barnes", "Leviticus 4:3", "Samuel Clark"),
            ("barnes", "Hosea 2:23", "E. B. Pusey"),
            ("barnes", "Matthew 4:19", "Albert Barnes"),
            ("barnes", "Isaiah 53:5", "Albert Barnes"),
            ("ellicott", "1 Kings 1:1", "Alfred Barry"),
            ("ellicott", "2 Kings 2:1", "C. J. Ball"),
            ("jfb", "Genesis 1:1", "Robert Jamieson"),
            ("jfb", "Matthew 1:1", "David Brown"),
            ("jfb", "Job 1:1", "A. R. Fausset"),
            ("keil-delitzsch", "Isaiah 53:5", "Franz Delitzsch"),
            ("keil-delitzsch", "Daniel 7:13", "C. F. Keil"),
            ("henry", "Revelation 5:1", "William Tong"),
            ("henry", "1 Corinthians 10:6", "Simon Browne"),
            ("henry", "Genesis 1:1", "Matthew Henry"),
            ("poole", "Isaiah 8:10", "Matthew Poole"),
            ("poole", "Romans 1:1", "Richard Mayo"),
        ] {
            assert_eq!(who(&s, id, on), writer, "{id} on {on}");
        }
        assert!(who(&s, "poole", "Isaiah 60:1").starts_with("a continuator"), "Poole's Isaiah 60 is a continuator's: {}", who(&s, "poole", "Isaiah 60:1"));
    }

    #[test]
    fn every_cite_in_the_config_resolves() {
        let s = real();
        let file: LayerFile = serde_json::from_str(include_str!("../../../config/layers.json")).unwrap();
        let mut n = 0;
        for p in &file.passages {
            for (i, l) in p.layers.iter().enumerate() {
                for c in &l.cites {
                    let src = source(&s, &c.source);
                    let q = c.on.as_deref().and_then(refs::parse).unwrap_or_else(|| panic!("{} note {i}: {} has no verse", p.id, c.source));
                    let book = BOOKS[q.book as usize].name;
                    if let Err(e) = resolve(&s, src, Some(book), q.chapter, c.work.as_deref()) {
                        panic!("{} note {i}: {} on {book} {}: {e}", p.id, c.source, q.chapter);
                    }
                    n += 1;
                }
            }
        }
        assert!(n > 6000, "{n} cites");
    }

    fn fixture(json: &str) -> SourceFile {
        serde_json::from_str(json).unwrap()
    }

    const FIXTURE: &str = r#"{
        "sites": [{ "host": "biblehub.com", "name": "Bible Hub" }],
        "writers": [
            { "id": "a-one", "name": "A. One", "about": "Vicar of Somewhere", "about_from": "title page" },
            { "id": "b-two", "name": "B. Two", "about": "Canon of Elsewhere", "about_from": "title page" },
            { "id": "c-out", "name": "C. Out", "about": "Clergyman", "about_from": "leaf", "excluded": { "why": "calls Jonah fiction", "decided": "decision 20" } }
        ],
        "works": [
            { "id": "set", "title": "The Set", "short": "The Set", "written": "1880", "year": "1880", "written_from": "title page" },
            { "id": "other", "title": "Other", "short": "Other", "written": "1890", "written_from": "title page" }
        ],
        "cite": [
            { "id": "set", "role": "interpreter", "name": "The Set", "biblehub": "set", "why": "x",
              "parts": [
                { "books": ["Exodus"], "chapters": [1, 19], "work": "set", "writers": ["a-one"], "evidence": "e1" },
                { "books": ["Exodus"], "chapters": [20, 40], "work": "set", "writers": ["b-two"], "evidence": "e2" },
                { "books": ["Jonah"], "work": "set", "writers": ["c-out"], "evidence": "e3" },
                { "books": ["Genesis", "Leviticus"], "work": "other", "writers": ["a-one", "b-two"], "evidence": "e4" }
              ] }
        ],
        "avoid": [],
        "denies": [{ "source": "set", "on": "Exodus 3:14", "writer": "a-one", "words": "it never happened", "why": "denies Exodus 3", "decided": "decision 20" }]
    }"#;

    #[test]
    fn parts_never_overlap() {
        let s = fixture(FIXTURE);
        check_sources(&s).unwrap();
        let bad = FIXTURE.replace("\"chapters\": [20, 40]", "\"chapters\": [19, 40]");
        assert!(check_sources(&fixture(&bad)).unwrap_err().contains("overlaps"));
        let bad = FIXTURE.replace("{ \"books\": [\"Jonah\"]", "{ \"books\": \"all\"");
        assert!(check_sources(&fixture(&bad)).unwrap_err().contains("overlaps"));
    }

    #[test]
    fn chapters_only_with_one_book() {
        let bad = FIXTURE.replace("\"books\": [\"Genesis\", \"Leviticus\"], \"work\"", "\"books\": [\"Genesis\", \"Leviticus\"], \"chapters\": [1, 2], \"work\"");
        assert!(check_sources(&fixture(&bad)).unwrap_err().contains("single book"));
    }

    #[test]
    fn refuses_a_cite_no_part_covers() {
        let s = fixture(FIXTURE);
        let e = resolve(&s, &s.cite[0], Some("Numbers"), 4, None).err().unwrap();
        assert_eq!(e, "no part of config/layer-sources.json says who wrote these words, so the app cannot credit them");
        assert_eq!(resolve(&s, &s.cite[0], Some("Exodus"), 2, None).map(|c| c.writer()).unwrap(), "A. One");
        assert_eq!(resolve(&s, &s.cite[0], Some("Exodus"), 32, None).map(|c| c.writer()).unwrap(), "B. Two");
        let joint = resolve(&s, &s.cite[0], Some("Genesis"), 1, None).unwrap();
        assert_eq!((joint.writer().as_str(), joint.about().unwrap().as_str(), joint.key.as_str()), ("A. One and B. Two", "One: Vicar of Somewhere; Two: Canon of Elsewhere", "a-one+b-two"));
    }

    #[test]
    fn refuses_an_excluded_writer_and_a_denied_passage() {
        let s = fixture(FIXTURE);
        let c = resolve(&s, &s.cite[0], Some("Jonah"), 4, None).unwrap();
        assert!(c.writers[0].excluded.as_ref().unwrap().decided.contains("decision 20"));
        assert!(s.denies.iter().any(|d| d.source == "set" && d.on == "Exodus 3:14"));
        // The real config: Aglen is excluded, and Ellicott on Jonah 4:6 is his.
        let r = real();
        let q = refs::parse("Jonah 4:6").unwrap();
        let aglen = resolve(&r, source(&r, "ellicott"), Some("Jonah"), q.chapter, None).unwrap();
        assert!(aglen.writers[0].excluded.as_ref().is_some_and(|x| x.decided.contains("decision 20")), "{}", aglen.writer());
    }

    fn reads(json: &str, today: &str) -> Result<Evidence, String> {
        let mut ev = Evidence::default();
        evidence_file("docs/evidence/fixture.json", &serde_json::from_str(json).unwrap(), Date::parse(today).unwrap(), &mut ev)?;
        Ok(ev)
    }

    fn key<'a>(on: &'a str) -> CiteKey<'a> {
        CiteKey { passage: "genesis-2-7", note: 1, kind: "wordplay", shared: false, source: "barnes", on: Some(on), at: None }
    }

    const READS: &str = r#"{ "kind": "reads", "batch": "b", "fetched": "2026-10-20", "records": [
        { "passage": "genesis-2-7", "note": 1, "kind": "wordplay", "source": "barnes", "on": "Genesis 2:7", "url": "https://www.biblehub.com/commentaries/barnes/genesis/2.htm/", "fetched": "2026-10-20", "status": "confirmed" }
    ] }"#;

    #[test]
    fn reads_dates_from_evidence() {
        let ev = reads(READS, "2026-10-21").unwrap();
        let mut used = vec![false; 1];
        let link = "https://biblehub.com/commentaries/barnes/genesis/2.htm";
        assert_eq!(dated(&ev, &key("Genesis 2:7"), link, &mut used).unwrap(), Dated::Read(Date::parse("2026-10-20").unwrap()));
        assert!(used[0], "www. and a trailing slash do not matter");
        let e = dated(&ev, &key("Genesis 2:7"), "https://biblehub.com/commentaries/barnes/genesis/3.htm", &mut used).unwrap_err();
        assert!(e.contains("genesis/2.htm") && e.contains("genesis/3.htm"), "{e}");
        assert!(reads(&READS.replace("\"fetched\": \"2026-10-20\", \"status\"", "\"fetched\": \"2026-10-32\", \"status\""), "2026-10-21").unwrap_err().contains("not a real date"));
        assert!(reads(READS, "2026-10-19").unwrap_err().contains("after today"));
        assert!(reads(&READS.replace("\"fetched\": \"2026-10-20\", \"records\"", "\"fetched\": \"2026-10-19\", \"records\""), "2026-10-21").unwrap_err().contains("outside"));
        let windowed = READS.replace("\"fetched\": \"2026-10-20\", \"records\"", "\"from\": \"2026-10-19\", \"to\": \"2026-10-21\", \"records\"");
        assert!(reads(&windowed, "2026-10-21").is_ok());
        let timed = READS.replace("\"status\"", "\"time\": \"2026-10-20T23:59:59Z\", \"status\"");
        assert!(reads(&timed, "2026-10-21").is_ok());
        assert!(reads(&timed.replace("2026-10-20T23", "2026-10-21T23"), "2026-10-21").unwrap_err().contains("time"));
    }

    const CHECKS: &str = r#"{ "kind": "checks", "prs": [{ "pr": 42, "merged": "2026-10-17", "commits": ["879e785"], "check": "matched word for word against a copy of the text", "against": "a copy of the text" }],
        "records": [["genesis-1-2", 0, "plain meaning", "wesley", "Genesis 1:2", null, 42]] }"#;

    #[test]
    fn older_cites_get_the_checked_label() {
        let ev = reads(CHECKS, "2026-10-21").unwrap();
        let k = CiteKey { passage: "genesis-1-2", note: 0, kind: "plain meaning", shared: false, source: "wesley", on: Some("Genesis 1:2"), at: None };
        assert_eq!(dated(&ev, &k, "https://biblehub.com/commentaries/wes/genesis/1.htm", &mut []).unwrap(), Dated::Checked(Date::parse("2026-10-17").unwrap()));
    }

    #[test]
    fn a_cite_with_no_record_fails() {
        let ev = reads(CHECKS, "2026-10-21").unwrap();
        let e = dated(&ev, &key("Genesis 2:8"), "https://biblehub.com/commentaries/barnes/genesis/2.htm", &mut []).unwrap_err();
        assert!(e.contains("has no record that it was read or checked against the source"), "{e}");
    }

    #[test]
    fn refuses_ai_credit() {
        for p in AI_CREDIT {
            assert_eq!(ai_credit(&format!("Sources: the BSB, {p} the writers")), Some(p));
            let v = json!({ "writers": [{ "about": format!("Vicar, {p}") }], "works": [{ "title": p }] });
            assert!(ai_credit_in(&v, "").is_some());
        }
        assert_eq!(ai_credit("Joshua took Ai, and the king of Ai"), None);
        assert_eq!(ai_credit("Claudel"), None);
        assert_eq!(ai_credit("the men of Ai fled by Aijalon"), None);
    }

    #[test]
    fn refuses_home_page_links() {
        assert!(home_page("https://www.studylight.org/commentaries/eng/bul.html", None));
        assert!(home_page("https://archive.org/details/figuresofspeechu00bull/", None));
        assert!(home_page("https://www.thegospelcoalition.org/", None));
        assert!(home_page("https://www.newadvent.org/fathers/", Some("https://www.newadvent.org/fathers/")));
        assert!(!home_page("https://archive.org/details/figuresofspeechu00bull/page/n381/mode/1up", None));
        assert!(!home_page("https://www.studylight.org/commentaries/eng/bul/genesis-3.html", None));
    }

    #[test]
    fn counts_writers_by_person() {
        let s = real();
        let k = |id: &str, on: &str| {
            let q = refs::parse(on).unwrap();
            resolve(&s, source(&s, id), Some(BOOKS[q.book as usize].name), q.chapter, None).unwrap().key
        };
        assert_eq!(k("ellicott", "Exodus 3:14"), k("pulpit", "Exodus 3:14"), "both are George Rawlinson's");
        assert_ne!(k("keil-delitzsch", "Genesis 1:1"), k("keil-delitzsch", "Psalm 2:7"), "Keil wrote Genesis, Delitzsch the Psalms");
        assert_eq!(k("bullinger-cb", "Genesis 3:1"), k("bullinger-fos", "Genesis 3:1"), "the Companion Bible and Figures of Speech count as Bullinger once");
        assert!(k("barnes", "Numbers 16:13").contains('+'), "a joint part is one key of two writers");
        assert_eq!(k("wesley", "Genesis 1:2"), k("henry", "Genesis 1:2"), "Wesley's Old Testament notes count as Henry, whom they abridge");
        assert!(s.cite.iter().filter(|c| c.role == "reference").all(|c| c.id != "barnes"));
    }

    #[test]
    fn dates_are_never_guessed() {
        let bad = FIXTURE.replace("\"written\": \"1890\", \"written_from\": \"title page\"", "\"written\": \"1890\", \"written_from\": \"\"");
        assert!(check_sources(&fixture(&bad)).unwrap_err().contains("written_from"));
        let bad = FIXTURE.replace("\"written\": \"1890\", \"written_from\": \"title page\"", "\"written\": \"date not known\", \"written_from\": \"title page\"");
        assert!(check_sources(&fixture(&bad)).unwrap_err().contains("none found"));
        let ok = FIXTURE.replace("\"written\": \"1890\", \"written_from\": \"title page\"", "\"written\": \"date not known\", \"written_from\": \"none found\"");
        check_sources(&fixture(&ok)).unwrap();
        let bad = FIXTURE.replace("\"year\": \"1880\"", "\"year\": \"about 1880\"");
        assert!(check_sources(&fixture(&bad)).is_err());
        assert!(is_year("1866") && is_year("1860s") && !is_year("1866s") && !is_year("186"));
        assert!(Date::parse("2024-02-29").is_some() && Date::parse("2026-02-29").is_none() && Date::parse("2026-10-32").is_none() && Date::parse("2026-1-20").is_none());
    }

    #[test]
    fn the_notice_lists_the_writers() {
        let s = real();
        let notice = include_str!("../../../NOTICE.md");
        for p in notice_paragraphs(&s) {
            assert!(notice.contains(&p), "NOTICE.md should have this paragraph, generated from {SOURCES}:\n{p}");
        }
    }

    #[test]
    fn links_ranges_both_ways_through_spans() {
        // 0 -> 5..7 (span 3); 9 -> 2.
        let g = XrefGraph::build(
            10,
            vec![RawEdge { src: 0, dst: 5, span: 3, votes: -2 }, RawEdge { src: 9, dst: 2, span: 1, votes: 4 }],
        );
        assert!(linked(&g, (0, 0), (7, 7)));
        assert!(linked(&g, (6, 8), (0, 1)));
        assert!(linked(&g, (2, 2), (9, 9)));
        assert!(!linked(&g, (0, 0), (8, 9)));
        assert!(!linked(&g, (1, 4), (5, 8)));
        assert!(within((3, 4), (2, 5)) && within((2, 2), (2, 2)) && !within((1, 2), (2, 5)));
    }

    #[test]
    fn parses_config_references() {
        let p = |s: &str| refs::parse(s).map(|q| (q.book, q.chapter, q.verse, q.end_chapter, q.end_verse));
        assert_eq!(p("Psalms 22:1"), Some((18, 22, 1, 22, 1)));
        assert_eq!(p("Psalm 22:1"), Some((18, 22, 1, 22, 1)));
        assert_eq!(p("John 2:21-22"), Some((42, 2, 21, 2, 22)));
        assert_eq!(p("Hebrews 7:15-17"), Some((57, 7, 15, 7, 17)));
        assert_eq!(p("1 Corinthians 10:1-5"), Some((45, 10, 1, 10, 5)));
    }
}
