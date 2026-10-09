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
//! 8. every passage names its source and its section; one nobody reviewed is
//!    a draft,
//! 9. a layer's text stays short enough to read at a glance; detail and
//!    sources go in its evidence, which the app shows one level deeper.
//!
//! Drafts are checked like the rest but published only when
//! `ATLAS_LAYER_DRAFTS=1` is set.
//!
//! Text is compared after [`normalize`], and an ellipsis ("…" or "...")
//! splits a saying or quotation into parts that must appear in order.

use crate::parse::WordsByVerse;
use atlas_core::{refs, Versification, XrefGraph};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeSet, HashMap};
use std::fmt::Display;
use std::fs;
use std::path::Path;

pub const CONFIG: &str = "config/layers.json";
pub const DRAFTS_ENV: &str = "ATLAS_LAYER_DRAFTS";

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
    text: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WordSpec {
    #[serde(rename = "ref")]
    reference: String,
    strong: String,
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
    let include_drafts = std::env::var(DRAFTS_ENV).is_ok_and(|v| v == "1");

    let mut check = Check { src, errors: Vec::new() };
    let mut ids = BTreeSet::new();
    let mut out = Vec::new();
    let mut drafts = 0;
    for p in &file.passages {
        if !ids.insert(p.id.as_str()) {
            check.fail(&format!("passage {:?}", p.id), "id is used by an earlier passage");
        }
        let checked = check.passage(p);
        let draft = p.reviewed_by.is_empty();
        drafts += draft as usize;
        if let Some(v) = checked.filter(|_| include_drafts || !draft) {
            out.push(v);
        }
    }
    if let Some(e) = check.errors.into_iter().next() {
        return Err(e);
    }

    let layer_count: usize = file.passages.iter().map(|p| p.layers.len()).sum();
    let drafts_note = match (drafts, include_drafts) {
        (0, _) => String::from("no drafts"),
        (d, true) => format!("{d} drafts included ({DRAFTS_ENV}=1)"),
        (d, false) => format!("{d} drafts left out (set {DRAFTS_ENV}=1 to include them)"),
    };
    eprintln!(
        "layers of meaning: {} passages, {layer_count} layers checked; {} written, {drafts_note}",
        file.passages.len(),
        out.len()
    );
    Ok(out)
}

/// Collects every problem in config order; the build reports the first.
struct Check<'s, 'a> {
    src: &'s Sources<'a>,
    errors: Vec<String>,
}

impl Check<'_, '_> {
    fn fail(&mut self, at: &str, problem: impl Display) {
        self.errors.push(format!("{CONFIG}: {at}: {problem}"));
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
        if !SECTIONS.contains(&p.section.as_str()) {
            self.fail(&at, format_args!("section {:?} is not one of: {}", p.section, SECTIONS.join(", ")));
        }
        if p.reviewed_by.iter().any(|n| n.trim().is_empty()) {
            self.fail(&at, "reviewed_by has an empty name");
        }
        for (field, s) in [("id", &p.id), ("ref", &p.reference), ("saying", &p.saying), ("source", &p.source)] {
            self.esv(&at, field, s);
        }
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
        let layers: Vec<Value> = layers.into_iter().collect::<Option<_>>()?;
        Some(json!({
            "id": p.id, "section": p.section, "v": v, "end": end, "saying": p.saying, "source": p.source,
            "reviewed_by": p.reviewed_by, "draft": p.reviewed_by.is_empty(), "layers": layers,
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
        if let Some(e) = &l.evidence {
            self.esv(&at, "evidence", e);
            if let Some(n) = too_long(e, EVIDENCE_MAX) {
                self.fail(&at, format_args!("evidence is {n} characters; keep it to {EVIDENCE_MAX}"));
            }
        }
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
        let mut layer = json!({ "kind": l.kind, "strength": l.strength, "text": l.text, "refs": refs, "words": words });
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
