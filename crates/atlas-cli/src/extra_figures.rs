//! Figures at Deep: parallel lines, figures of speech and people set side by
//! side, each shown only at Deep. Written in `config/figures/<OSIS>.json`
//! (`{notes: [...]}`, one file per book) with the forms they may take in
//! `config/figure-forms.json`, and checked here before anything is written:
//!
//! 1. every reference resolves in the BSB, and a note's own verses are in its
//!    file's book and in one chapter;
//! 2. every line, figure and side quotes the BSB text of its verse exactly, so
//!    the reader can mark it without searching; a mirror's or alternation's
//!    lines all carry marks, and the marks nest (A B B' A', or A B A' B');
//! 3. every quotation of four or more words in a note's own words is in the
//!    BSB text of the verses it names, and every Hebrew or Greek root it names
//!    is in those verses; the `original` note names its language ("In
//!    Hebrew", and for a Gospel "In Matthew's Greek");
//! 4. every note cites at least one interpreter on the cite list in
//!    `config/layer-sources.json` (a work whose role is "interpreter"), each
//!    citation with the writer's own words, and only works listed as
//!    `quotable` in the forms file may be quoted: public-domain works whose
//!    words are their named writer's own, in a copy free to quote. A work
//!    written by several hands (`multi_writer` in the forms file) names the
//!    writer of the quoted part in the cite's own `by` (decision 10), and a
//!    work whose writer wrote only some books (`only_on`) is quoted only on
//!    those. Its strength is the number of different interpreters it cites
//!    (3 or more "widely agreed", 2 "commonly held", 1 "some interpreters"),
//!    works by one writer counting once as `same_writer` in the forms file
//!    says;
//! 5. a note's own words (`short`, `about`, `limit`, the figure, the sides and
//!    the `original` note) name no writer: sources and what they say go in
//!    `evidence` and in the citations;
//! 6. nothing names the ESV and no field credits a drafting tool; nothing but
//!    a writer's own quoted words (a cite's or definition's `quote`) names a
//!    source Layers may not cite, since the avoid list governs whom the app
//!    cites, not names inside an old writer's words (the approved lists,
//!    item 12).
//!
//! The writers' words are checked against their text before a note is added
//! (`docs/evidence/figures-*.json` records where each was found); this module
//! cannot reach those texts, so it checks everything else.
//!
//! Output, under `web/public/data/`:
//! - `extras/figures.json`: `{format, forms, has, parts}`. `forms[id]` is
//!   `{kind, label, term, about, defined?}`, `defined` being `{name, by, work,
//!   when, quote, at, url, read, retrieved}`; `has` holds one character per
//!   verse, '0' plus a bit for each kind with a note on it (1 parallelism,
//!   2 figure, 4 contrast); `parts[book]` lists the first chapter of each of
//!   the book's files.
//! - `extras/figures/<Book>.<k>.json`: `{format, notes}`, the notes on the
//!   chapters of part k in order of first verse. A note is `{id, kind, form,
//!   v, end, strength, writers, short, about, refs?, lines?, pairs?, figure?,
//!   sides?, defined?, original?, evidence, limit?, checked, cites}`: verses are verse
//!   indices, `refs` and sides' `s`, `e` verse ranges, `writers` the number of
//!   different interpreters cited (the count `strength` comes from), and
//!   `checked` the date the note was checked against its sources. A line is `{v, t, at, mark?,
//!   key?}` and a figure `{name, part?, words, means, v, at}`, `at` being a
//!   UTF-16 offset into verse `v`'s BSB text; a line's key word occurs once,
//!   as whole words, in its own line, and each word of a pair once in the
//!   lines, a pair's first word in an earlier line than its answer. `original` is `{note, strong, words}`: its
//!   roots may be Hebrew or Aramaic (H) or Greek (G), the note names the
//!   language itself ("In Hebrew", "In Matthew's Greek"), and `words` lists
//!   every place a root occurs as `[verse, word position, lemma index]`. A
//!   cite is `{name, by, work, when, on, url, quote, read, retrieved, at?}`:
//!   `name` is the writer or work and is always shown, `by` who wrote the
//!   quoted words (the cite's own `by`, or else the cite list's),
//!   `work` and `when` the work and its first publication, `quote` the
//!   writer's own words, `read` and `retrieved` the edition or site they were
//!   read from and the date (decision 10), and `at` reads "Work (year), place
//!   in it". `defined` carries the same credit fields.

use crate::loaded::Loaded;
use crate::parse::WordsByVerse;
use atlas_core::{refs, Versification, BOOKS};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fs;
use std::path::Path;

pub const DIR: &str = "config/figures";
pub const FORMS: &str = "config/figure-forms.json";
const OUT: &str = "extras/figures.json";
const PARTS: &str = "extras/figures";

/// The kinds, each with its bit in `has`.
const KINDS: [(&str, u8); 3] = [("parallelism", 1), ("figure", 2), ("contrast", 4)];
const WIDELY: &str = "widely agreed";
const COMMONLY: &str = "commonly held";
const SOME: &str = "some interpreters";
/// Runs of words, lowercased, that credit a drafting tool, which no field may
/// carry. "AI" itself is caught only in capitals, so the city of Ai (Joshua 7
/// and 8) never is.
const CREDITS: [&str; 15] = [
    "drafted with",
    "not yet reviewed by a person",
    "ai drafted",
    "ai assisted",
    "ai generated",
    "ai written",
    "ai help",
    "ai helped",
    "ai reviewer",
    "ai session",
    "ai model",
    "ai tool",
    "language model",
    "anthropic",
    "openai",
];
/// The role of a cite-list work that reads the text, as against a word book.
const INTERPRETER: &str = "interpreter";
/// Writers whose names a note's own words may not carry, beyond the names on
/// the cite list: surnames, short forms, writers of parts of works on it, and
/// writers the church fathers entry covers.
const WRITERS: [&str; 39] = [
    "Henry", "Gill", "Barnes", "Jamieson", "Fausset", "Keil", "Delitzsch", "Ellicott", "Benson", "Poole", "Calvin",
    "Clarke", "Wesley", "Bengel", "Maclaren", "Spurgeon", "Chrysostom", "Edersheim", "Bullinger", "Beale",
    "Woudstra", "Leithart", "Keener", "Easton", "Strong's", "Augustine", "Jerome", "Irenaeus", "Origen", "Aquinas",
    "Luther", "Justin", "JFB", "Gospel Coalition", "Tyndale", "Ligonier", "Murphy", "Spence", "Exell",
];
/// Short enough that the display's "…, and 2 more here" fits a 70-character line.
const SHORT_MAX: usize = 52;
const TEXT_MAX: usize = 300;
const EVIDENCE_MAX: usize = 400;
const QUOTE_MAX: usize = 400;
const LABEL_MAX: usize = 40;
const MEANS_MAX: usize = 160;
const AT_MAX: usize = 120;
const READ_MAX: usize = 200;
const QUOTE_MIN_WORDS: usize = 4;
const PART_BYTES: usize = 500_000;

#[derive(Deserialize)]
struct FormsFile {
    forms: Vec<Form>,
    same_writer: Vec<Vec<String>>,
    /// Cite-list ids whose words may be shown: public-domain works whose words
    /// are their named writer's own, in a copy free to quote.
    quotable: Vec<String>,
    /// Cite-list ids written by several hands: a cite of one names the writer
    /// of the quoted part in its own `by`.
    #[serde(default)]
    multi_writer: Vec<String>,
    /// Cite-list ids whose named writer wrote only some books, to the books
    /// they may be quoted on: a book name, or "First to Last" for a run.
    #[serde(default)]
    only_on: BTreeMap<String, Vec<String>>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Form {
    id: String,
    kind: String,
    label: String,
    term: String,
    about: String,
    #[serde(default)]
    defined: Option<Defined>,
}

/// A form defined in the words of a book that defines it.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Defined {
    source: String,
    /// Who wrote these words, where the cite list's `by` names several
    /// writers or a set's editors.
    #[serde(default)]
    by: Option<String>,
    quote: String,
    at: String,
    /// The edition or site the words were read from.
    read: String,
    /// The date they were read there, as 2026-10-21.
    retrieved: String,
}

#[derive(Deserialize)]
struct NotesFile {
    notes: Vec<Note>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Note {
    id: String,
    kind: String,
    form: String,
    #[serde(rename = "ref")]
    reference: String,
    strength: String,
    short: String,
    about: String,
    /// Other passages the note quotes or points to.
    #[serde(default)]
    refs: Vec<String>,
    #[serde(default)]
    lines: Vec<Line>,
    #[serde(default)]
    pairs: Vec<Vec<String>>,
    #[serde(default)]
    figure: Option<Figure>,
    #[serde(default)]
    sides: Vec<Side>,
    #[serde(default)]
    defined: Option<Defined>,
    #[serde(default)]
    original: Option<Original>,
    evidence: String,
    #[serde(default)]
    limit: Option<String>,
    /// When the note was last checked against its sources, as 2026-10-21.
    checked: String,
    cites: Vec<Cite>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Line {
    #[serde(rename = "ref")]
    reference: String,
    words: String,
    #[serde(default)]
    mark: Option<String>,
    /// The line's key word, found once as whole words in it, for a display
    /// that shows a word per line.
    #[serde(default)]
    key: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Figure {
    name: String,
    #[serde(default)]
    part: Option<String>,
    #[serde(rename = "ref")]
    reference: String,
    words: String,
    means: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Side {
    who: String,
    label: String,
    #[serde(rename = "ref")]
    reference: String,
    words: String,
}

/// The Hebrew, Aramaic or Greek behind the English: a plain note and its roots.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Original {
    note: String,
    strong: Vec<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Cite {
    source: String,
    /// Who wrote these words, where the cite list's `by` names several
    /// writers or a set's editors (decision 10).
    #[serde(default)]
    by: Option<String>,
    on: String,
    #[serde(default)]
    at: Option<String>,
    quote: String,
    /// The edition or site the quote was read from.
    read: String,
    /// The date it was read there, as 2026-10-21.
    retrieved: String,
}

/// What this module reads from `config/layer-sources.json`; the Layers build
/// checks the rest of that file.
#[derive(Deserialize)]
struct SourceFile {
    cite: Vec<CiteSource>,
    avoid: Vec<Avoid>,
}

#[derive(Deserialize)]
struct CiteSource {
    id: String,
    role: String,
    name: String,
    title: String,
    by: String,
    when: String,
    why: String,
    #[serde(default)]
    biblehub: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    not_on: Vec<String>,
}

#[derive(Deserialize)]
struct Avoid {
    name: String,
    #[serde(rename = "match")]
    names: Vec<String>,
    why: String,
}

/// What the checks read from the rest of the build.
pub struct Sources<'a> {
    /// BSB English, one string per verse index.
    pub text: &'a [String],
    pub vz: &'a Versification,
    pub words: &'a WordsByVerse,
    /// Lemma key ("H1870L") to its index in lemmas.json.
    pub lemma_index: &'a HashMap<&'a str, u32>,
}

struct Check<'a> {
    src: &'a Sources<'a>,
    cite: &'a SourceFile,
    forms: &'a BTreeMap<String, Form>,
    /// Cite-list id to the id its writer counts as.
    writer: HashMap<&'a str, &'a str>,
    /// Cite-list ids whose words may be shown.
    quotable: BTreeSet<&'a str>,
    /// Cite-list ids whose cites name their part's writer.
    multi_writer: BTreeSet<&'a str>,
    /// Cite-list id to the runs of books (first, last) it may be quoted on.
    only_on: HashMap<&'a str, Vec<(u8, u8)>>,
    /// Names a note's own words may not carry.
    writer_names: Vec<String>,
    errors: Vec<String>,
}

impl<'a> Check<'a> {
    fn fail(&mut self, at: &str, problem: impl std::fmt::Display) {
        self.errors.push(format!("{at}: {problem}"));
    }

    fn range(&mut self, at: &str, r: &str) -> Option<(u32, u32)> {
        let found = refs::parse(r).and_then(|q| refs::resolve(q, self.src.vz));
        if found.is_none() {
            self.fail(at, format_args!("reference {r:?} does not name verses in the BSB"));
        }
        found
    }

    /// One verse, inside `within` when given.
    fn verse(&mut self, at: &str, r: &str, within: Option<(u32, u32)>) -> Option<u32> {
        let (s, e) = self.range(at, r)?;
        if s != e {
            self.fail(at, format_args!("{r:?} must name one verse"));
            return None;
        }
        if within.is_some_and(|(a, z)| s < a || s > z) {
            self.fail(at, format_args!("{r:?} is outside the note's own verses"));
            return None;
        }
        Some(s)
    }

    /// A field a reader sees: present, short enough, and clean.
    fn text(&mut self, at: &str, field: &str, s: &str, max: usize) {
        self.quoted(at, field, s, max);
        self.avoid(at, field, s);
    }

    /// A writer's own quoted words: present, short enough, no ESV and no
    /// credit to a drafting tool. The avoid list is not scanned: it governs
    /// whom the app cites, not names inside an old writer's own words.
    fn quoted(&mut self, at: &str, field: &str, s: &str, max: usize) {
        let n = s.chars().count();
        if s.trim().is_empty() {
            self.fail(at, format_args!("{field} is empty"));
        } else if n > max {
            self.fail(at, format_args!("{field} is {n} characters; keep it to {max}"));
        }
        if mentions_esv(s) {
            self.fail(at, format_args!("{field} mentions the ESV"));
        }
        if let Some(p) = credit(s) {
            self.fail(at, format_args!("{field} says {p:?}: no field credits a drafting tool"));
        }
    }

    /// Fail if `s` names a source on the avoid list.
    fn avoid(&mut self, at: &str, field: &str, s: &str) {
        let cite = self.cite;
        for a in &cite.avoid {
            if let Some(n) = a.names.iter().find(|n| names(s, n)) {
                self.fail(at, format_args!("{field} names {n:?} ({}), which may not be cited: {}", a.name, a.why));
            }
        }
    }

    /// A note's own words: a reader field that also names no writer, since
    /// sources and what they say go in the evidence and the citations.
    fn own_words(&mut self, at: &str, field: &str, s: &str, max: usize) {
        self.text(at, field, s, max);
        if let Some(n) = writer_named(s, &self.writer_names) {
            self.fail(at, format_args!("{field} names {n:?}; a note's own words name no writer, so say it in evidence"));
        }
    }

    /// A cite-list work whose words this note shows: on the list, and quotable.
    fn source(&mut self, at: &str, id: &str) -> Option<&'a CiteSource> {
        let cite = self.cite;
        let Some(s) = cite.cite.iter().find(|s| s.id == id) else {
            self.fail(at, format_args!("source {id:?} is not on the cite list in {}", crate::layers::SOURCES));
            return None;
        };
        if s.id == "net-notes" {
            self.fail(at, "the NET translators' notes are linked from Study, never shown");
            return None;
        }
        if !self.quotable.contains(s.id.as_str()) {
            self.fail(
                at,
                format_args!(
                    "{} is not quotable in {FORMS}: only public-domain works whose words are their named writer's own, in a copy free to quote, are quoted here; Layers may still link it",
                    s.name
                ),
            );
            return None;
        }
        Some(s)
    }

    /// Where a quotation was read and when: decision 10's credit.
    fn read(&mut self, at: &str, read: &str, retrieved: &str) {
        self.text(at, "read", read, READ_MAX);
        if !date_ok(retrieved) {
            self.fail(at, format_args!("retrieved {retrieved:?} must be a date, as 2026-10-21"));
        }
    }

    /// Who wrote the quoted words: the cite's own `by`, required for a work
    /// by several hands, or else the cite list's.
    fn by(&mut self, at: &str, s: &CiteSource, by: Option<&str>) -> String {
        match by {
            Some(b) => {
                self.text(at, "by", b, AT_MAX);
                b.to_string()
            }
            None => {
                if self.multi_writer.contains(s.id.as_str()) {
                    self.fail(
                        at,
                        format_args!("{} was written by several hands; name the writer of the quoted part in by (decision 10)", s.name),
                    );
                }
                s.by.clone()
            }
        }
    }

    fn defined(&mut self, at: &str, d: &Defined) -> Option<Value> {
        self.quoted(at, "defined quote", &d.quote, QUOTE_MAX);
        self.text(at, "defined at", &d.at, AT_MAX);
        self.read(at, &d.read, &d.retrieved);
        let s = self.source(at, &d.source)?;
        let by = self.by(at, s, d.by.as_deref());
        let Some(url) = s.url.as_deref() else {
            self.fail(at, format_args!("{} has no link of its own for a definition", s.name));
            return None;
        };
        Some(json!({
            "name": s.name, "by": by, "work": s.title, "when": s.when, "quote": d.quote, "at": place(s, &d.at),
            "url": url, "read": d.read, "retrieved": d.retrieved,
        }))
    }

    fn note(&mut self, book: u8, n: &Note) -> Option<Value> {
        let at = format!("{DIR}/{}.json: note {:?}", BOOKS[book as usize].osis, n.id);
        if n.id.is_empty() || !n.id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
            self.fail(&at, "id must be lowercase letters, digits and hyphens");
        }
        let Some(&(_, bit)) = KINDS.iter().find(|(k, _)| *k == n.kind) else {
            let kinds: Vec<&str> = KINDS.iter().map(|(k, _)| *k).collect();
            self.fail(&at, format_args!("kind {:?} is not one of: {}", n.kind, kinds.join(", ")));
            return None;
        };
        match self.forms.get(&n.form) {
            None => self.fail(&at, format_args!("form {:?} is not in {FORMS}", n.form)),
            Some(f) if f.kind != n.kind => {
                self.fail(&at, format_args!("form {:?} is a {} form, not a {} one", n.form, f.kind, n.kind))
            }
            Some(_) => {}
        }
        self.own_words(&at, "short", &n.short, SHORT_MAX);
        self.own_words(&at, "about", &n.about, TEXT_MAX);
        self.text(&at, "evidence", &n.evidence, EVIDENCE_MAX);
        if let Some(l) = &n.limit {
            self.own_words(&at, "limit", l, TEXT_MAX);
        }
        if !date_ok(&n.checked) {
            self.fail(&at, format_args!("checked {:?} must be a date, as 2026-10-21", n.checked));
        }

        let own = self.range(&at, &n.reference);
        if let Some((s, e)) = own {
            let (b, c, _) = self.src.vz.locate(s)?;
            if b != book {
                self.fail(&at, format_args!("{:?} is not in {}", n.reference, BOOKS[book as usize].name));
            }
            if self.src.vz.locate(e).map(|l| l.1) != Some(c) {
                self.fail(&at, format_args!("{:?} crosses a chapter; a note sits in one chapter", n.reference));
            }
        }
        let refs: Vec<Option<(u32, u32)>> = n.refs.iter().map(|r| self.range(&at, r)).collect();

        // Lines: exact BSB words of a verse of the note, in reading order.
        let mut lines = Vec::new();
        let mut last: Option<(u32, usize)> = None;
        for (i, l) in n.lines.iter().enumerate() {
            let lat = format!("{at}, lines[{i}]");
            let Some(v) = own.and_then(|o| self.verse(&lat, &l.reference, Some(o))) else { continue };
            let Some(off) = self.find_once(&lat, v, &l.words) else { continue };
            if last.is_some_and(|(pv, pend)| (v, off) < (pv, pend)) {
                self.fail(&lat, "lines must be in reading order and must not overlap");
            }
            last = Some((v, off + l.words.len()));
            let mut line = json!({ "v": v, "t": l.words, "at": utf16_len(&self.src.text[v as usize][..off]) });
            if let Some(k) = &l.key {
                if pair_line(&[l.words.as_str()], k).is_none() {
                    self.fail(&lat, format_args!("key {k:?} must occur once, as whole words, in the line"));
                }
                line["key"] = json!(k);
            }
            if let Some(m) = &l.mark {
                if !mark_ok(m) {
                    self.fail(&lat, format_args!("mark {m:?} must be a capital letter, with ' after it in the second half"));
                }
                line["mark"] = json!(m);
            }
            lines.push(line);
        }
        let marks: Vec<&str> = n.lines.iter().filter_map(|l| l.mark.as_deref()).collect();
        if n.kind == "parallelism" && n.lines.len() < 2 {
            self.fail(&at, "parallel lines need at least two lines");
        }
        match n.form.as_str() {
            "mirror" if marks.len() != n.lines.len() || !mirror_ok(&marks) => {
                self.fail(&at, "a mirror's lines must all be marked, nesting as A B B' A' (one unmarked-prime centre allowed)")
            }
            "turns" if marks.len() != n.lines.len() || !turns_ok(&marks) => {
                self.fail(&at, "lines that take turns must all be marked, as A B A' B'")
            }
            _ => {}
        }
        if !n.pairs.is_empty() && n.kind != "parallelism" {
            self.fail(&at, "only parallel lines have pairs");
        }
        let line_words: Vec<&str> = n.lines.iter().map(|l| l.words.as_str()).collect();
        for (i, p) in n.pairs.iter().enumerate() {
            let pat = format!("{at}, pairs[{i}]");
            if p.len() != 2 {
                self.fail(&pat, "a pair is two words, each in a different line");
                continue;
            }
            let found: Vec<Option<usize>> = p.iter().map(|w| pair_line(&line_words, w)).collect();
            for (w, f) in p.iter().zip(&found) {
                if f.is_none() {
                    self.fail(&pat, format_args!("{w:?} must occur once, as whole words, in the lines"));
                }
            }
            if let [Some(a), Some(b)] = found[..] {
                if a >= b {
                    self.fail(&pat, "a pair is two words, each in a different line, the first in an earlier line than its answer");
                }
            }
        }

        // The figure: required on a figure note, and only there.
        let figure = match (&n.figure, n.kind == "figure") {
            (Some(f), true) => {
                let fat = format!("{at}, figure");
                self.own_words(&fat, "name", &f.name, LABEL_MAX);
                if let Some(p) = &f.part {
                    self.own_words(&fat, "part", p, 60);
                }
                self.own_words(&fat, "means", &f.means, MEANS_MAX);
                own.and_then(|o| self.verse(&fat, &f.reference, Some(o)))
                    .and_then(|v| self.find_once(&fat, v, &f.words).map(|off| (v, off)))
                    .map(|(v, off)| {
                        let mut x = json!({ "name": f.name, "words": f.words, "means": f.means, "v": v, "at": utf16_len(&self.src.text[v as usize][..off]) });
                        if let Some(p) = &f.part {
                            x["part"] = json!(p);
                        }
                        x
                    })
            }
            (None, true) => {
                self.fail(&at, "a figure note needs its figure");
                None
            }
            (Some(_), false) => {
                self.fail(&at, "only a figure note has a figure");
                None
            }
            (None, false) => None,
        };

        // Sides: exactly two on a contrast, none elsewhere.
        let mut sides = Vec::new();
        let mut side_ranges = Vec::new();
        if n.kind == "contrast" && n.sides.len() != 2 {
            self.fail(&at, "a contrast sets exactly two sides side by side");
        } else if n.kind != "contrast" && !n.sides.is_empty() {
            self.fail(&at, "only a contrast has sides");
        }
        for (i, s) in n.sides.iter().enumerate() {
            let sat = format!("{at}, sides[{i}]");
            self.own_words(&sat, "who", &s.who, LABEL_MAX);
            self.own_words(&sat, "label", &s.label, LABEL_MAX);
            let Some((a, z)) = self.range(&sat, &s.reference) else { continue };
            side_ranges.push((a, z));
            let verses = &self.src.text[a as usize..=z as usize];
            if !verses.iter().any(|t| names(t, &s.who)) {
                self.fail(&sat, format_args!("{:?} is not named in {:?}", s.who, s.reference));
            }
            if s.words.trim().is_empty() || !verses.iter().any(|t| t.contains(s.words.as_str())) {
                self.fail(&sat, format_args!("{:?} is not the BSB text of a verse in {:?}", s.words, s.reference));
            }
            sides.push(json!({ "who": s.who, "label": s.label, "s": a, "e": z, "t": s.words }));
        }

        // Quotations in the note's own words, and its roots, against every verse it names.
        let mut named: Vec<(u32, u32)> = own.into_iter().chain(refs.iter().flatten().copied()).collect();
        named.extend(side_ranges.iter().copied());
        if refs.iter().all(Option::is_some) && own.is_some() {
            let texts: Vec<String> =
                named.iter().map(|&(s, e)| normalize(&self.src.text[s as usize..=e as usize].join(" "))).collect();
            let mut fields = vec![("short", n.short.as_str()), ("about", n.about.as_str()), ("evidence", n.evidence.as_str())];
            if let Some(l) = &n.limit {
                fields.push(("limit", l.as_str()));
            }
            if let Some(o) = &n.original {
                fields.push(("original note", o.note.as_str()));
            }
            if let Some(f) = &n.figure {
                fields.push(("figure name", f.name.as_str()));
                if let Some(p) = &f.part {
                    fields.push(("figure part", p.as_str()));
                }
                fields.push(("figure means", f.means.as_str()));
            }
            for s in &n.sides {
                fields.push(("side who", s.who.as_str()));
                fields.push(("side label", s.label.as_str()));
            }
            for (field, s) in fields {
                match quotes(s) {
                    Err(e) => self.fail(&at, format_args!("{field}: {e}")),
                    Ok(qs) => {
                        for q in qs.into_iter().filter(|q| word_count(q) >= QUOTE_MIN_WORDS) {
                            if !texts.iter().any(|t| contains(t, q)) {
                                self.fail(&at, format_args!("{field}: quotation {q:?} is not in the BSB text of the verses the note names; writers' words go in a citation's quote"));
                            }
                        }
                    }
                }
            }
        }
        // The original words: every place each root occurs in the verses the note names.
        let mut original_words: Vec<[u32; 3]> = Vec::new();
        if let Some(o) = &n.original {
            self.own_words(&at, "original note", &o.note, TEXT_MAX);
            if let Some(want) = language_missing(&o.note, &o.strong, BOOKS[book as usize].osis) {
                self.fail(&at, format_args!("the original note must name its language, as {want:?}"));
            }
            if o.strong.is_empty() {
                self.fail(&at, "original needs at least one root");
            }
            for s in &o.strong {
                if !strong_ok(s) {
                    self.fail(&at, format_args!("root {s:?} must be H or G and four digits, as H1870"));
                    continue;
                }
                let hits: Vec<[u32; 3]> = named.iter().flat_map(|&r| self.root_hits(r, s)).collect();
                if hits.is_empty() {
                    self.fail(&at, format_args!("root {s} is not in the verses the note names"));
                }
                for h in hits {
                    if !original_words.contains(&h) {
                        original_words.push(h);
                    }
                }
            }
        }

        let defined = n.defined.as_ref().and_then(|d| self.defined(&format!("{at}, defined"), d));

        // Citations: each a listed work, with the writer's words; the strength follows from the writers.
        let mut cites = Vec::new();
        let mut writers = BTreeSet::new();
        let mut seen = BTreeSet::new();
        if n.cites.is_empty() {
            self.fail(&at, format_args!("cites nothing; every note cites a work on the cite list in {}", crate::layers::SOURCES));
        }
        for (i, c) in n.cites.iter().enumerate() {
            let cat = format!("{at}, cites[{i}]");
            if !seen.insert(c.source.as_str()) {
                self.fail(&cat, format_args!("{:?} is cited twice; quote it once", c.source));
            }
            self.quoted(&cat, "quote", &c.quote, QUOTE_MAX);
            self.text(&cat, "on", &c.on, AT_MAX);
            if let Some(a) = &c.at {
                self.text(&cat, "at", a, AT_MAX);
            }
            self.read(&cat, &c.read, &c.retrieved);
            let on = self.range(&cat, &c.on);
            let Some(s) = self.source(&cat, &c.source) else { continue };
            let by = self.by(&cat, s, c.by.as_deref());
            if s.role == INTERPRETER {
                writers.insert(self.writer.get(s.id.as_str()).copied().unwrap_or(s.id.as_str()));
            }
            if let Some((b, _, _)) = on.and_then(|(start, _)| self.src.vz.locate(start)) {
                let book = BOOKS[b as usize].name;
                if s.not_on.iter().any(|x| x == book) {
                    self.fail(&cat, format_args!("{} is not cited on {book}: {}", s.name, s.why));
                }
                if self.only_on.get(s.id.as_str()).is_some_and(|runs| !runs.iter().any(|&(f, l)| (f..=l).contains(&b))) {
                    self.fail(
                        &cat,
                        format_args!("{} is quoted only on the books its named writer wrote ({FORMS}, only_on), not on {book}", s.name),
                    );
                }
            }
            let url = s
                .biblehub
                .as_deref()
                .zip(on.and_then(|(start, _)| self.src.vz.locate(start)))
                .map(|(code, (b, chapter, _))| biblehub(code, b, chapter))
                .or_else(|| s.url.clone());
            let Some(url) = url else {
                self.fail(&cat, format_args!("{} has no link", s.name));
                continue;
            };
            let mut x = json!({
                "name": s.name, "by": by, "work": s.title, "when": s.when, "on": c.on, "url": url, "quote": c.quote,
                "read": c.read, "retrieved": c.retrieved,
            });
            if let Some(a) = &c.at {
                x["at"] = json!(place(s, a));
            }
            cites.push(x);
        }
        let want = strength_for(writers.len());
        if !n.cites.is_empty() && writers.is_empty() {
            self.fail(
                &at,
                format_args!("cites no interpreter; a word book or the BSB alone cannot carry a figure, parallel or contrast (role {INTERPRETER:?} in {})", crate::layers::SOURCES),
            );
        } else if !n.cites.is_empty() && n.strength != want {
            self.fail(
                &at,
                format_args!("strength is {:?}, but it cites {} different interpreters, which is {want:?}", n.strength, writers.len()),
            );
        }

        let (v, end) = own?;
        let mut out = json!({
            "id": n.id, "kind": n.kind, "form": n.form, "v": v, "end": end, "strength": n.strength, "writers": writers.len(),
            "short": n.short, "about": n.about, "evidence": n.evidence, "checked": n.checked, "cites": cites,
        });
        if !refs.is_empty() {
            out["refs"] = json!(refs.iter().map(|r| r.map(|(s, e)| [s, e])).collect::<Option<Vec<_>>>()?);
        }
        if !lines.is_empty() {
            out["lines"] = json!(lines);
        }
        if !n.pairs.is_empty() {
            out["pairs"] = json!(n.pairs);
        }
        if let Some(f) = figure {
            out["figure"] = f;
        }
        if !sides.is_empty() {
            out["sides"] = json!(sides);
        }
        if let Some(d) = defined {
            out["defined"] = d;
        }
        if let Some(o) = &n.original {
            out["original"] = json!({ "note": o.note, "strong": o.strong, "words": original_words });
        }
        if let Some(l) = &n.limit {
            out["limit"] = json!(l);
        }
        out["bit"] = json!(bit);
        Some(out)
    }

    /// The byte offset of `words` in verse `v`'s text, if they occur there exactly once.
    fn find_once(&mut self, at: &str, v: u32, words: &str) -> Option<usize> {
        let t = &self.src.text[v as usize];
        let mut found = t.match_indices(words);
        match (words.trim().is_empty(), found.next(), found.next()) {
            (false, Some((i, _)), None) => Some(i),
            (false, Some(_), Some(_)) => {
                self.fail(at, format_args!("{words:?} occurs more than once in the verse; quote more of it"));
                None
            }
            _ => {
                self.fail(at, format_args!("{words:?} is not the BSB text of the verse"));
                None
            }
        }
    }

    /// Every main-text word in the range whose root is `strong`, as [verse,
    /// word position, lemma index], as `layers.rs` publishes them.
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
}

/// Read and check the forms and notes; the files to write under
/// web/public/data, as (path, bytes).
pub fn build(root: &Path, src: &Sources) -> Result<Vec<(String, Vec<u8>)>, String> {
    let read = |rel: &str| fs::read_to_string(root.join(rel)).map_err(|e| format!("reading {rel}: {e}"));
    let cite: SourceFile = serde_json::from_str(&read(crate::layers::SOURCES)?)
        .map_err(|e| format!("parsing {}: {e}", crate::layers::SOURCES))?;
    let forms_file: FormsFile = serde_json::from_str(&read(FORMS)?).map_err(|e| format!("parsing {FORMS}: {e}"))?;

    let mut errors = Vec::new();
    let mut writer: HashMap<&str, &str> = HashMap::new();
    for group in &forms_file.same_writer {
        for id in group {
            if !cite.cite.iter().any(|s| &s.id == id) {
                errors.push(format!("{FORMS}: same_writer names {id:?}, which is not on the cite list"));
            }
            if writer.insert(id.as_str(), group[0].as_str()).is_some() {
                errors.push(format!("{FORMS}: same_writer lists {id:?} twice"));
            }
        }
    }
    let mut quotable = BTreeSet::new();
    for id in &forms_file.quotable {
        if id == "net-notes" {
            errors.push(format!("{FORMS}: quotable lists net-notes, whose notes are linked, never shown"));
        } else if !cite.cite.iter().any(|s| &s.id == id) {
            errors.push(format!("{FORMS}: quotable names {id:?}, which is not on the cite list"));
        }
        if !quotable.insert(id.as_str()) {
            errors.push(format!("{FORMS}: quotable lists {id:?} twice"));
        }
    }
    let mut multi_writer = BTreeSet::new();
    for id in &forms_file.multi_writer {
        if !cite.cite.iter().any(|s| &s.id == id) {
            errors.push(format!("{FORMS}: multi_writer names {id:?}, which is not on the cite list"));
        }
        if !multi_writer.insert(id.as_str()) {
            errors.push(format!("{FORMS}: multi_writer lists {id:?} twice"));
        }
    }
    let mut only_on: HashMap<&str, Vec<(u8, u8)>> = HashMap::new();
    for (id, books) in &forms_file.only_on {
        if !quotable.contains(id.as_str()) {
            errors.push(format!("{FORMS}: only_on names {id:?}, which is not quotable"));
        }
        let mut runs = Vec::new();
        for b in books {
            match book_run(b) {
                Some(r) => runs.push(r),
                None => errors.push(format!("{FORMS}: only_on {id:?} has {b:?}, which is not a book or a run \"First to Last\"")),
            }
        }
        if runs.is_empty() {
            errors.push(format!("{FORMS}: only_on {id:?} lists no books"));
        }
        only_on.insert(id.as_str(), runs);
    }
    // Every name on the cite list but the BSB's (the app's own text), less any
    // leading "the", and the names in WRITERS, with ’ written as '.
    let mut writer_names: Vec<String> = cite
        .cite
        .iter()
        .filter(|s| s.id != "bsb")
        .map(|s| {
            let n = s.name.as_str();
            let n = if n.get(..4).is_some_and(|p| p.eq_ignore_ascii_case("the ")) { &n[4..] } else { n };
            n.replace('\u{2019}', "'")
        })
        .collect();
    writer_names.extend(WRITERS.iter().map(|w| w.replace('\u{2019}', "'")));
    let mut forms: BTreeMap<String, Form> = BTreeMap::new();
    for f in forms_file.forms {
        if forms.contains_key(&f.id) {
            errors.push(format!("{FORMS}: form {:?} is listed twice", f.id));
        }
        forms.insert(f.id.clone(), f);
    }
    let mut check = Check { src, cite: &cite, forms: &forms, writer, quotable, multi_writer, only_on, writer_names, errors };
    let mut form_index = serde_json::Map::new();
    for f in forms.values() {
        let at = format!("{FORMS}: form {:?}", f.id);
        if f.id.is_empty() || !f.id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
            check.fail(&at, "id must be lowercase letters, digits and hyphens");
        }
        if !KINDS.iter().any(|(k, _)| *k == f.kind) {
            check.fail(&at, format_args!("kind {:?} is not a figures kind", f.kind));
        }
        check.text(&at, "label", &f.label, LABEL_MAX);
        check.text(&at, "term", &f.term, 60);
        check.text(&at, "about", &f.about, TEXT_MAX);
        let mut x = json!({ "kind": f.kind, "label": f.label, "term": f.term, "about": f.about });
        if let Some(d) = f.defined.as_ref().and_then(|d| check.defined(&at, d)) {
            x["defined"] = d;
        }
        form_index.insert(f.id.clone(), x);
    }

    // The notes, one file per book.
    let mut files: Vec<(u8, NotesFile)> = Vec::new();
    let dir = root.join(DIR);
    let mut entries: Vec<_> = fs::read_dir(&dir)
        .map_err(|e| format!("reading {DIR}: {e}"))?
        .map(|e| e.map(|e| e.path()).map_err(|e| e.to_string()))
        .collect::<Result<_, _>>()?;
    entries.sort();
    for path in entries {
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or_default().to_string();
        let Some(osis) = name.strip_suffix(".json") else {
            check.errors.push(format!("{DIR}/{name}: only <Book>.json files belong here"));
            continue;
        };
        let Some(b) = BOOKS.iter().position(|bk| bk.osis == osis) else {
            check.errors.push(format!("{DIR}/{name}: {osis:?} is not an OSIS book name, as Gen or 1Sam"));
            continue;
        };
        let text = fs::read_to_string(&path).map_err(|e| format!("reading {DIR}/{name}: {e}"))?;
        let file: NotesFile = serde_json::from_str(&text).map_err(|e| format!("parsing {DIR}/{name}: {e}"))?;
        files.push((b as u8, file));
    }
    let mut ids = BTreeSet::new();
    let mut books: Vec<Vec<Value>> = (0..BOOKS.len()).map(|_| Vec::new()).collect();
    let mut total = 0;
    for (b, file) in &files {
        for n in &file.notes {
            total += 1;
            if !ids.insert(n.id.as_str()) {
                check.fail(&format!("{DIR}/{}.json: note {:?}", BOOKS[*b as usize].osis, n.id), "id is used by an earlier note");
            }
            if let Some(x) = check.note(*b, n) {
                books[*b as usize].push(x);
            }
        }
    }
    if let Some(e) = check.errors.into_iter().next() {
        return Err(e);
    }

    let mut has = vec![b'0'; src.vz.verse_count() as usize];
    let mut counts = [0usize; 3];
    let mut out = Vec::new();
    let mut parts: Vec<Vec<u16>> = Vec::with_capacity(BOOKS.len());
    for (b, notes) in books.iter_mut().enumerate() {
        notes.sort_by(|x, y| (x["v"].as_u64(), x["id"].as_str()).cmp(&(y["v"].as_u64(), y["id"].as_str())));
        let mut chapters: BTreeMap<u16, Vec<Value>> = BTreeMap::new();
        for mut x in notes.drain(..) {
            let bit = x["bit"].as_u64().unwrap_or(0) as u8;
            if let Some(o) = x.as_object_mut() {
                o.remove("bit");
            }
            let (v, end) = (x["v"].as_u64().unwrap_or(0) as u32, x["end"].as_u64().unwrap_or(0) as u32);
            for i in v..=end {
                has[i as usize] |= bit;
            }
            counts[bit.trailing_zeros() as usize] += 1;
            let (_, c, _) = src.vz.locate(v).ok_or("a note outside the Bible")?;
            chapters.entry(c).or_default().push(x);
        }
        let mut starts: Vec<u16> = Vec::new();
        let mut file: Vec<Value> = Vec::new();
        let mut bytes = 0usize;
        let mut flush = |file: &mut Vec<Value>, k: usize| -> Result<(), String> {
            let doc = json!({ "format": 1, "notes": std::mem::take(file) });
            out.push((format!("{PARTS}/{}.{k}.json", BOOKS[b].osis), serde_json::to_vec(&doc).map_err(|e| e.to_string())?));
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
    let written: usize = parts.iter().map(Vec::len).sum();
    eprintln!(
        "figures: {total} notes checked and written ({} parallelism, {} figure, {} contrast) in {written} files; {} forms",
        counts[0],
        counts[1],
        counts[2],
        form_index.len()
    );
    let index = json!({
        "format": 1,
        "forms": form_index,
        "has": String::from_utf8(has).map_err(|e| e.to_string())?,
        "parts": parts,
    });
    out.push((OUT.to_string(), serde_json::to_vec(&index).map_err(|e| e.to_string())?));
    Ok(out)
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let read = |p: &Path| -> Result<Value, String> {
        serde_json::from_str(&fs::read_to_string(p).map_err(|e| format!("reading {}: {e}", p.display()))?)
            .map_err(|e| format!("parsing {}: {e}", p.display()))
    };
    let index_path = d.dir.join(OUT);
    let size = fs::metadata(&index_path).map_err(|e| format!("reading {}: {e}", index_path.display()))?.len();
    let index = read(&index_path)?;
    let n = d.vz.verse_count();
    let forms = index["forms"].as_object().cloned().unwrap_or_default();
    let has = index["has"].as_str().unwrap_or("").as_bytes().to_vec();
    let has_ok = has.len() == n as usize && has.iter().all(|c| (b'0'..=b'7').contains(c));
    let parts: Vec<Vec<u16>> = index["parts"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|p| p.as_array().into_iter().flatten().map(|c| c.as_u64().unwrap_or(0) as u16).collect())
        .collect();
    let mut parts_ok = parts.len() == BOOKS.len();
    let forms_ok = forms.values().all(|f| {
        KINDS.iter().any(|(k, _)| f["kind"] == *k)
            && ["label", "term", "about"].iter().all(|k| f[k].as_str().is_some_and(|s| !s.is_empty()))
            && (f.get("defined").is_none()
                || (["name", "by", "work", "when", "quote", "at", "read"].iter().all(|k| f["defined"][k].as_str().is_some_and(|s| !s.is_empty()))
                    && f["defined"]["retrieved"].as_str().is_some_and(date_ok)
                    && f["defined"]["url"].as_str().is_some_and(|u| u.starts_with("https://"))))
    });
    let lemma_count = d.lemmas["key"].as_array().map_or(0, Vec::len) as u64;
    let psalm_1_6 = d.resolve("Psalm 1:6")?.0;

    let mut seen = vec![b'0'; n as usize];
    let (mut notes_ok, mut words_ok, mut spans_ok, mut roots_ok, mut cites_ok) = (true, true, true, true, true);
    let mut known = false;
    let mut count = 0usize;
    let mut largest = 0u64;
    for (b, starts) in parts.iter().enumerate() {
        parts_ok &= starts.windows(2).all(|w| w[0] < w[1])
            && starts.iter().all(|&c| c >= 1 && c <= d.vz.chapters_in(b as u8));
        for (k, &first) in starts.iter().enumerate() {
            let last = starts.get(k + 1).map_or(d.vz.chapters_in(b as u8), |&x| x - 1);
            let path = d.dir.join(format!("{PARTS}/{}.{k}.json", BOOKS[b].osis));
            largest = largest.max(fs::metadata(&path).map(|m| m.len()).unwrap_or(0));
            let doc = read(&path)?;
            let mut prev = 0u64;
            for x in doc["notes"].as_array().into_iter().flatten() {
                count += 1;
                let bit = KINDS.iter().find(|(k, _)| x["kind"] == *k).map(|(_, b)| *b);
                let (v, end) = (x["v"].as_u64().unwrap_or(u64::MAX), x["end"].as_u64().unwrap_or(0));
                let place = d.vz.locate(v as u32).zip(d.vz.locate(end as u32));
                let in_file = place.is_some_and(|((pb, pc, _), (eb, ec, _))| {
                    pb as usize == b && eb as usize == b && pc == ec && pc >= first && pc <= last
                });
                let form_ok = forms.get(x["form"].as_str().unwrap_or("")).is_some_and(|f| f["kind"] == x["kind"]);
                notes_ok &= bit.is_some()
                    && v <= end
                    && end < u64::from(n)
                    && in_file
                    && form_ok
                    && v >= prev
                    && [WIDELY, COMMONLY, SOME].iter().any(|s| x["strength"] == *s)
                    && x["writers"].as_u64().is_some_and(|w| w >= 1 && x["strength"] == strength_for(w as usize))
                    && ["id", "short", "about", "evidence"].iter().all(|k| x[k].as_str().is_some_and(|s| !s.is_empty()))
                    && x["checked"].as_str().is_some_and(date_ok);
                prev = v;
                if let (Some(bit), true) = (bit, end < u64::from(n)) {
                    for i in v..=end {
                        seen[i as usize] |= bit;
                    }
                }
                // Every marked span is the verse's own words at its offset, inside the note.
                let at = |lv: &Value, t: &Value, off: &Value| -> bool {
                    let (Some(lv), Some(t), Some(off)) = (lv.as_u64(), t.as_str(), off.as_u64()) else { return false };
                    (v..=end).contains(&lv) && end < u64::from(n) && utf16_slice(&d.english(lv as u32), off as usize, t)
                };
                let lines: Vec<&Value> = x["lines"].as_array().into_iter().flatten().collect();
                for l in &lines {
                    words_ok &= at(&l["v"], &l["t"], &l["at"]);
                }
                if x.get("figure").is_some() {
                    words_ok &= at(&x["figure"]["v"], &x["figure"]["words"], &x["figure"]["at"]);
                }
                words_ok &= (x["kind"] == "figure") == x.get("figure").is_some();
                words_ok &= (x["kind"] == "contrast") == x["sides"].as_array().is_some_and(|s| s.len() == 2);
                words_ok &= x["kind"] != "parallelism" || lines.len() >= 2;
                let marks: Vec<&str> = lines.iter().filter_map(|l| l["mark"].as_str()).collect();
                words_ok &= match x["form"].as_str() {
                    Some("mirror") => marks.len() == lines.len() && mirror_ok(&marks),
                    Some("turns") => marks.len() == lines.len() && turns_ok(&marks),
                    _ => marks.iter().all(|m| mark_ok(m)),
                };
                words_ok &= lines.iter().all(|l| {
                    l.get("key").is_none() || l["key"].as_str().zip(l["t"].as_str()).is_some_and(|(k, t)| pair_line(&[t], k).is_some())
                });
                let texts: Vec<&str> = lines.iter().filter_map(|l| l["t"].as_str()).collect();
                words_ok &= x["pairs"].as_array().into_iter().flatten().all(|p| {
                    let w: Vec<Option<usize>> =
                        p.as_array().into_iter().flatten().map(|w| w.as_str().and_then(|w| pair_line(&texts, w))).collect();
                    matches!(w[..], [Some(a), Some(b)] if a < b)
                });
                // Every range is real verses; each side names its person and quotes its words.
                let span = |r: &Value| -> Option<(u32, u32)> {
                    let (s, e) = (r[0].as_u64()?, r[1].as_u64()?);
                    (s <= e && e < u64::from(n)).then_some((s as u32, e as u32))
                };
                spans_ok &= x.get("refs").is_none()
                    || x["refs"].as_array().is_some_and(|rs| !rs.is_empty() && rs.iter().all(|r| span(r).is_some()));
                for side in x["sides"].as_array().into_iter().flatten() {
                    let range = span(&json!([side["s"], side["e"]]));
                    let (who, t) = (side["who"].as_str().unwrap_or(""), side["t"].as_str().unwrap_or(""));
                    spans_ok &= range.is_some_and(|(s, e)| {
                        let verses: Vec<String> = (s..=e).map(|i| d.english(i)).collect();
                        !who.is_empty()
                            && !t.is_empty()
                            && side["label"].as_str().is_some_and(|l| !l.is_empty())
                            && verses.iter().any(|v| names(v, who))
                            && verses.iter().any(|v| v.contains(t))
                    });
                }
                // Every original word sits in a verse the note names, is that word's root in the
                // verse's own word list, and is a root the note names; every root has a word.
                if let Some(o) = x.get("original") {
                    let words: Vec<&Value> = o["words"].as_array().into_iter().flatten().collect();
                    let strong: Vec<&str> = o["strong"].as_array().into_iter().flatten().filter_map(Value::as_str).collect();
                    let mut ranges: Vec<(u64, u64)> = vec![(v, end)];
                    ranges.extend(x["refs"].as_array().into_iter().flatten().filter_map(&span).map(|(s, e)| (u64::from(s), u64::from(e))));
                    ranges.extend(
                        x["sides"]
                            .as_array()
                            .into_iter()
                            .flatten()
                            .filter_map(|s| span(&json!([s["s"], s["e"]])))
                            .map(|(s, e)| (u64::from(s), u64::from(e))),
                    );
                    let key = |li: u64| if li < lemma_count { d.lemmas["key"][li as usize].as_str() } else { None };
                    roots_ok &= o["note"].as_str().is_some_and(|s| !s.is_empty())
                        && !strong.is_empty()
                        && strong.len() == o["strong"].as_array().map_or(0, Vec::len)
                        && !words.is_empty()
                        && words.iter().all(|w| {
                            let (Some(wv), Some(pos), Some(li)) = (w[0].as_u64(), w[1].as_u64(), w[2].as_u64()) else { return false };
                            wv < u64::from(n)
                                && ranges.iter().any(|&(s, e)| (s..=e).contains(&wv))
                                && key(li).is_some_and(|k| strong.iter().any(|s| lemma_matches(k, s)))
                                && d.verse(wv as u32).is_ok_and(|vx| vx[1][pos as usize][3].as_u64() == Some(li))
                        })
                        && strong.iter().all(|s| words.iter().any(|w| w[2].as_u64().and_then(key).is_some_and(|k| lemma_matches(k, s))));
                }
                if x["id"] == "psalm-1-6-opposite" {
                    let ats: Vec<Option<u64>> = lines.iter().map(|l| l["at"].as_u64()).collect();
                    known = v == u64::from(psalm_1_6)
                        && end == v
                        && x["form"] == "opposite"
                        && ats == [Some(0), Some(47)]
                        && lines.iter().all(|l| l["v"].as_u64() == Some(v));
                }
                cites_ok &= x["cites"].as_array().is_some_and(|cs| {
                    !cs.is_empty()
                        && cs.iter().all(|c| {
                            ["name", "by", "work", "when", "on", "quote", "read"].iter().all(|k| c[k].as_str().is_some_and(|s| !s.is_empty()))
                                && c["retrieved"].as_str().is_some_and(date_ok)
                                && c["url"].as_str().is_some_and(|u| u.starts_with("https://"))
                                && (c.get("at").is_none() || c["at"].as_str().is_some_and(|a| a.contains("), ")))
                        })
                });
            }
        }
    }
    Ok(vec![
        (
            has_ok && parts_ok && seen == has,
            format!("the figures index marks exactly the verses its {count} notes sit under, and lists every file"),
        ),
        (forms_ok, format!("{} figure forms each have a kind, a label, a term and plain words", forms.len())),
        (notes_ok, "every figure note is on real verses in one chapter, in its book's file, in order, with a known form and strength".to_string()),
        (
            words_ok,
            "every line and figure marks the BSB's own words at its offset inside its note, marks nest by form, each pair word is in one line, every figure note has its figure and every contrast two sides".to_string(),
        ),
        (spans_ok, "every figure note's other passages are real verses, and each side of a contrast names its person and quotes its verses".to_string()),
        (roots_ok, "every original-language note points at words of the roots it names, in its own verses' word lists, and every root it names has a word".to_string()),
        (cites_ok, "every figure note cites a writer, with his words and a link".to_string()),
        (known && count >= 5, format!("Psalm 1:6's opposite lines are marked at the BSB's own words, and {count} figure notes were written (at least 5)")),
        (size < 100_000, format!("extras/figures.json is {size} bytes, expected under 100,000")),
        (largest < 1_500_000, format!("the largest file of figure notes is {largest} bytes, expected under 1,500,000")),
    ])
}

/// 3 or more different writers are "widely agreed", 2 "commonly held", 1 "some interpreters".
fn strength_for(writers: usize) -> &'static str {
    match writers {
        0 | 1 => SOME,
        2 => COMMONLY,
        _ => WIDELY,
    }
}

/// A date as 2026-10-21.
fn date_ok(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 10
        && b.iter().enumerate().all(|(i, c)| if i == 4 || i == 7 { *c == b'-' } else { c.is_ascii_digit() })
        && (1..=12).contains(&s[5..7].parse::<u8>().unwrap_or(0))
        && (1..=31).contains(&s[8..10].parse::<u8>().unwrap_or(0))
}

/// Where in a cited work: "Work (year), place in it", as `defined.at` and
/// Layers' citations read.
fn place(s: &CiteSource, at: &str) -> String {
    format!("{} ({}), {}", s.title, s.when, at)
}

/// The credit to a drafting tool that `s` carries, if any. Words split at
/// every mark that is not a letter or digit, so "AI-drafted" and "Claude's"
/// are caught; "AI" counts only in capitals, so the city of Ai never does.
fn credit(s: &str) -> Option<String> {
    let words: Vec<&str> = s.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()).collect();
    if words.contains(&"AI") {
        return Some("AI".to_string());
    }
    let lower: Vec<String> = words.iter().map(|w| w.to_lowercase()).collect();
    if lower.iter().any(|w| w.starts_with("claude")) {
        return Some("Claude".to_string());
    }
    let run = format!(" {} ", lower.join(" "));
    CREDITS.iter().find(|p| run.contains(&format!(" {p} "))).map(|p| p.to_string())
}

/// The index of the one line where `w` occurs, once and as whole words, or
/// None when it occurs nowhere or more than once.
fn pair_line(lines: &[&str], w: &str) -> Option<usize> {
    if w.trim().is_empty() {
        return None;
    }
    let mut found = lines.iter().enumerate().flat_map(|(k, t)| whole_words(t, w).map(move |_| k));
    match (found.next(), found.next()) {
        (Some(k), None) => Some(k),
        _ => None,
    }
}

/// Where `w` starts in `t` as whole words: no letter or digit just before or after.
fn whole_words<'t>(t: &'t str, w: &'t str) -> impl Iterator<Item = usize> + 't {
    t.match_indices(w).map(|(i, _)| i).filter(move |&i| {
        !t[..i].chars().next_back().is_some_and(char::is_alphanumeric)
            && !t[i + w.len()..].chars().next().is_some_and(char::is_alphanumeric)
    })
}

/// A capital letter, with ' after it for its partner in the second half.
fn mark_ok(m: &str) -> bool {
    let mut c = m.chars();
    matches!((c.next(), c.next(), c.next()), (Some(a), None | Some('\''), None) if a.is_ascii_uppercase())
}

/// A B C C' B' A', with one unprimed centre allowed (A B X B' A').
fn mirror_ok(marks: &[&str]) -> bool {
    let n = marks.len();
    let half = &marks[..n / 2];
    let distinct = half.iter().collect::<BTreeSet<_>>().len() == half.len();
    n >= 2
        && distinct
        && half.iter().all(|m| !m.ends_with('\''))
        && (0..n / 2).all(|k| marks[n - 1 - k] == format!("{}'", marks[k]))
        && (n.is_multiple_of(2) || (!marks[n / 2].ends_with('\'') && !half.contains(&marks[n / 2])))
}

/// A B A' B': the second half is the first half again, primed.
fn turns_ok(marks: &[&str]) -> bool {
    let n = marks.len();
    let half = &marks[..n / 2];
    let distinct = half.iter().collect::<BTreeSet<_>>().len() == half.len();
    n >= 4
        && n.is_multiple_of(2)
        && distinct
        && half.iter().all(|m| !m.ends_with('\''))
        && (0..n / 2).all(|k| marks[n / 2 + k] == format!("{}'", marks[k]))
}

/// H or G and four digits.
fn strong_ok(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 5 && (b[0] == b'H' || b[0] == b'G') && b[1..].iter().all(u8::is_ascii_digit)
}

/// Does the lemma `key` ("H1870L") belong to the root `strong` ("H1870")?
fn lemma_matches(key: &str, strong: &str) -> bool {
    key == strong || (key.len() == strong.len() + 1 && key.starts_with(strong) && key.as_bytes()[strong.len()].is_ascii_alphabetic())
}

/// Bible Hub's chapter page for a commentary: every book by its name in snake
/// case, except the Song of Solomon ("songs"), as `layers.rs` builds them.
fn biblehub(code: &str, book: u8, chapter: u16) -> String {
    let slug = match BOOKS[book as usize].name {
        "Song of Solomon" => "songs".to_string(),
        name => name.to_lowercase().replace(' ', "_"),
    };
    format!("https://biblehub.com/commentaries/{code}/{slug}/{chapter}.htm")
}

fn utf16_len(s: &str) -> usize {
    s.encode_utf16().count()
}

/// Is `t` the text of `verse` starting at UTF-16 offset `off`?
fn utf16_slice(verse: &str, off: usize, t: &str) -> bool {
    let units: Vec<u16> = verse.encode_utf16().collect();
    let want: Vec<u16> = t.encode_utf16().collect();
    !want.is_empty() && units.get(off..off + want.len()) == Some(&want[..])
}

/// Lowercase letters and digits with single spaces between words, as
/// `layers.rs` compares text: punctuation and quote marks dropped, dashes
/// splitting words.
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

fn parts(s: &str) -> Vec<String> {
    s.replace("...", "…").split('…').map(normalize).filter(|p| !p.is_empty()).collect()
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
            Some(i) => at += i + needle.len() - 1,
            None => return false,
        }
    }
    true
}

/// The spans between double quotation marks, straight or curly.
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
            ('\u{201C}', Some(_)) => return Err("an opening quotation mark inside a quotation".to_string()),
            ('\u{201D}', None) => return Err("a closing quotation mark with no opening one".to_string()),
            _ => {}
        }
    }
    match open {
        Some(_) => Err("a quotation is never closed".to_string()),
        None => Ok(spans),
    }
}

/// The first of `names` that `s` names, if any. ’ reads as '; a name of two
/// or more words matches in any case, a single name only as written, so
/// "keener" stays an English word.
fn writer_named(s: &str, names: &[String]) -> Option<String> {
    let s = s.replace('\u{2019}', "'");
    let lower = s.to_lowercase();
    names
        .iter()
        .find(|n| if n.contains(' ') { names_word(&lower, &n.to_lowercase()) } else { names_word(&s, n) })
        .cloned()
}

/// The words an `original` note lacks for its language, if any: "Hebrew" or
/// "Aramaic" for an H root, and for a G root "Greek", or in a Gospel the
/// Gospel writer's Greek, as "Matthew's Greek".
fn language_missing(note: &str, strong: &[String], osis: &str) -> Option<String> {
    let note = note.replace('\u{2019}', "'");
    if strong.iter().any(|s| s.starts_with('H')) && !note.contains("Hebrew") && !note.contains("Aramaic") {
        return Some("In Hebrew".to_string());
    }
    if strong.iter().any(|s| s.starts_with('G')) {
        let gospel = match osis {
            "Matt" => Some("Matthew"),
            "Mark" => Some("Mark"),
            "Luke" => Some("Luke"),
            "John" => Some("John"),
            _ => None,
        };
        match gospel {
            Some(w) if !note.contains(&format!("{w}'s Greek")) => return Some(format!("In {w}'s Greek")),
            None if !note.contains("Greek") => return Some("In Greek".to_string()),
            _ => {}
        }
    }
    None
}

/// A book by its name, or a run "First to Last", as (first, last) book indices.
fn book_run(s: &str) -> Option<(u8, u8)> {
    let index = |name: &str| BOOKS.iter().position(|b| b.name == name).map(|i| i as u8);
    match s.split_once(" to ") {
        Some((a, z)) => index(a).zip(index(z)).filter(|(a, z)| a <= z),
        None => index(s).map(|i| (i, i)),
    }
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

/// `names`, where the name also ends a word: "Keil" is found in "Keil's" but
/// not in "Keilah".
fn names_word(text: &str, part: &str) -> bool {
    whole_words(text, part).next().is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_writers_into_strengths() {
        assert_eq!(strength_for(1), SOME);
        assert_eq!(strength_for(2), COMMONLY);
        assert_eq!(strength_for(3), WIDELY);
        assert_eq!(strength_for(6), WIDELY);
    }

    #[test]
    fn checks_marks() {
        assert!(mark_ok("A") && mark_ok("C'") && !mark_ok("a") && !mark_ok("A''") && !mark_ok("AB") && !mark_ok("A′"));
        assert!(mirror_ok(&["A", "B", "C", "C'", "B'", "A'"]));
        assert!(mirror_ok(&["A", "B", "X", "B'", "A'"]));
        assert!(!mirror_ok(&["A", "B", "A'", "B'"]));
        assert!(!mirror_ok(&["A", "B", "B", "A'"]));
        assert!(!mirror_ok(&["A", "A", "A'", "A'"]));
        assert!(!mirror_ok(&["A", "B", "A", "B'", "A'"]));
        assert!(turns_ok(&["A", "B", "A'", "B'"]));
        assert!(turns_ok(&["A", "B", "C", "A'", "B'", "C'"]));
        assert!(!turns_ok(&["A", "B", "B'", "A'"]));
        assert!(!turns_ok(&["A", "A'"]));
    }

    #[test]
    fn checks_roots_and_offsets() {
        assert!(strong_ok("H1870") && strong_ok("G3162") && !strong_ok("H187") && !strong_ok("H1870L") && !strong_ok("X1870"));
        assert!(lemma_matches("H1870L", "H1870") && lemma_matches("H1870", "H1870") && !lemma_matches("H18701", "H1870"));
        let v = "“Let there be light,” and there was light.";
        let i = v.find("and there").unwrap();
        assert_eq!(utf16_len(&v[..i]), 22);
        assert!(utf16_slice(v, 22, "and there was light."));
        assert!(!utf16_slice(v, 21, "and there was light."));
        assert!(!utf16_slice(v, 40, "light. and more"));
    }

    #[test]
    fn links_bible_hub_chapters() {
        let song = BOOKS.iter().position(|b| b.name == "Song of Solomon").unwrap() as u8;
        let sam = BOOKS.iter().position(|b| b.osis == "1Sam").unwrap() as u8;
        assert_eq!(biblehub("gill", song, 2), "https://biblehub.com/commentaries/gill/songs/2.htm");
        assert_eq!(biblehub("kad", sam, 1), "https://biblehub.com/commentaries/kad/1_samuel/1.htm");
    }

    #[test]
    fn matches_quotes_like_layers() {
        let t = normalize("For the LORD guards the path of the righteous, but the way of the wicked will perish.");
        assert!(contains(&t, "the way of the wicked will perish"));
        assert!(contains(&t, "guards the path ... will perish"));
        assert!(!contains(&t, "the way of the righteous will perish"));
        assert_eq!(quotes("He said “one two three four” and \"five\"").unwrap(), ["one two three four", "five"]);
        assert!(quotes("a “stray").is_err());
        assert!(mentions_esv("the ESV says") && !mentions_esv("ESVs"));
        assert!(names("Gill's Exposition", "Gill") && !names("Magill", "Gill"));
        assert!(names_word("Keil's note", "Keil") && !names_word("went up to Keilah", "Keil"));
    }

    #[test]
    fn catches_credits_but_not_the_city_of_ai() {
        for ok in ["Israel was turned back by Ai.", "the second battle with Ai", "the men of Ai", "Claudius Lysias wrote"] {
            assert_eq!(credit(ok), None, "{ok}");
        }
        for bad in ["Drafted with AI help", "AI-drafted, checked against the source", "Checked against Claude’s draft", "Claude-assisted", "an ai-generated summary", "written by Anthropic's model"] {
            assert!(credit(bad).is_some(), "{bad}");
        }
    }

    #[test]
    fn catches_writer_names_in_any_spelling() {
        let names: Vec<String> = ["Gospel Coalition", "church fathers", "Strong's", "Keener", "JFB", "Justin"].iter().map(|s| s.to_string()).collect();
        for bad in ["see Strong\u{2019}s H5162", "as the Gospel Coalition notes", "The Church Fathers read it", "Justin Martyr says", "JFB reads"] {
            assert!(writer_named(bad, &names).is_some(), "{bad}");
        }
        for ok in ["a keener sense", "the fathers of the church", "Justine"] {
            assert_eq!(writer_named(ok, &names), None, "{ok}");
        }
    }

    #[test]
    fn asks_an_original_note_to_name_its_language() {
        let h = vec!["H5162".to_string()];
        let g = vec!["G3162".to_string()];
        assert_eq!(language_missing("“Regretted” is nacham", &h, "Gen").as_deref(), Some("In Hebrew"));
        assert_eq!(language_missing("In Hebrew “regretted” is nacham", &h, "Gen"), None);
        assert_eq!(language_missing("In Greek the word is machaira", &g, "Matt").as_deref(), Some("In Matthew's Greek"));
        assert_eq!(language_missing("In Matthew\u{2019}s Greek the word is machaira", &g, "Matt"), None);
        assert_eq!(language_missing("In Paul's Greek the word is agape", &g, "Rom"), None);
    }

    #[test]
    fn reads_runs_of_books() {
        let gen = BOOKS.iter().position(|b| b.name == "Genesis").unwrap() as u8;
        let acts = BOOKS.iter().position(|b| b.name == "Acts").unwrap() as u8;
        assert_eq!(book_run("Genesis to Acts"), Some((gen, acts)));
        assert_eq!(book_run("Psalms").map(|r| r.0 == r.1), Some(true));
        assert_eq!(book_run("Acts to Genesis"), None);
        assert_eq!(book_run("Psalm"), None);
    }

    #[test]
    fn finds_pair_words_once_as_whole_words() {
        let lines = ["For the LORD guards the path of the righteous,", "but the way of the wicked will perish."];
        assert_eq!(pair_line(&lines, "the righteous"), Some(0));
        assert_eq!(pair_line(&lines, "will perish"), Some(1));
        assert_eq!(pair_line(&lines, "he"), None);
        assert_eq!(pair_line(&lines, "the"), None);
        assert_eq!(pair_line(&lines, ""), None);
    }
}
