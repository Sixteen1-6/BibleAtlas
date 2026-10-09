//! Hard verses: the questions people most often ask about a verse ("How did
//! Judas die?"), each with a short plain answer, the main ways Christians
//! explain it, the passages that help, and where to read more. Written in
//! `config/hard-verses.json` and checked here before anything is written:
//!
//! 1. every reference resolves in the BSB,
//! 2. every quotation of four or more words is in the BSB text of one of the
//!    card's references (the same rules as `layers.rs`),
//! 3. the question, answer, view labels and texts and the evidence stay short
//!    enough to read at a glance,
//! 4. strengths come from a fixed list, ids are unique, "ESV" appears nowhere,
//! 5. every link is https to one of the sites listed below.
//!
//! A card nobody has reviewed is a draft: checked like the rest, but written
//! only when `ATLAS_HARD_VERSE_DRAFTS=1` is set.

use crate::loaded::Loaded;
use atlas_core::{refs, Versification};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

pub const CONFIG: &str = "config/hard-verses.json";
pub const DRAFTS_ENV: &str = "ATLAS_HARD_VERSE_DRAFTS";
const OUT: &str = "extras/hard-verses.json";
const CARDS: &str = "extras/hard-verses/cards.json";

const STRENGTHS: [&str; 3] = ["widely held", "commonly held", "some interpreters"];
/// Sites a card may link to for further reading.
const HOSTS: [&str; 14] = [
    "gotquestions.org",
    "bibleproject.com",
    "thegospelcoalition.org",
    "biblicaltraining.org",
    "bible.org",
    "ligonier.org",
    "desiringgod.org",
    "christianitytoday.com",
    "crossexamined.org",
    "reasonablefaith.org",
    "biblicalarchaeology.org",
    "catholic.com",
    "orthodoxwiki.org",
    "britannica.com",
];
const QUESTION_MAX: usize = 60;
const TEXT_MAX: usize = 300;
const LABEL_MAX: usize = 40;
const EVIDENCE_MAX: usize = 400;
const QUOTE_MIN_WORDS: usize = 4;

#[derive(Deserialize)]
struct File {
    questions: Vec<Card>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Card {
    id: String,
    #[serde(rename = "ref")]
    reference: String,
    #[serde(default)]
    also: Vec<String>,
    question: String,
    answer: String,
    views: Vec<View>,
    #[serde(default)]
    helps: Vec<String>,
    #[serde(default)]
    read_more: Vec<Link>,
    #[serde(default)]
    evidence: String,
    source: String,
    reviewed_by: Vec<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct View {
    label: String,
    strength: String,
    text: String,
    #[serde(default)]
    refs: Vec<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Link {
    site: String,
    title: String,
    url: String,
}

struct Check<'a> {
    text: &'a [String],
    vz: &'a Versification,
    errors: Vec<String>,
}

impl Check<'_> {
    fn fail(&mut self, at: &str, problem: impl std::fmt::Display) {
        self.errors.push(format!("{CONFIG}: {at}: {problem}"));
    }

    fn range(&mut self, at: &str, r: &str) -> Option<(u32, u32)> {
        let found = refs::parse(r).and_then(|q| refs::resolve(q, self.vz));
        if found.is_none() {
            self.fail(
                at,
                format_args!("reference {r:?} does not name verses in the BSB"),
            );
        }
        found
    }

    fn short(&mut self, at: &str, field: &str, s: &str, max: usize) {
        let n = s.chars().count();
        if s.trim().is_empty() {
            self.fail(at, format_args!("{field} is empty"));
        } else if n > max {
            self.fail(
                at,
                format_args!("{field} is {n} characters; keep it to {max}"),
            );
        }
        if mentions_esv(s) {
            self.fail(at, format_args!("{field} mentions the ESV"));
        }
    }

    fn card(&mut self, c: &Card) -> Option<Value> {
        let at = format!("question {:?}", c.id);
        if c.id.is_empty()
            || !c
                .id
                .chars()
                .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
        {
            self.fail(&at, "id must be lowercase letters, digits and hyphens");
        }
        self.short(&at, "question", &c.question, QUESTION_MAX);
        if !c.question.trim_end().ends_with('?') {
            self.fail(&at, "question must end with a question mark");
        }
        self.short(&at, "answer", &c.answer, TEXT_MAX);
        if !c.evidence.is_empty() {
            self.short(&at, "evidence", &c.evidence, EVIDENCE_MAX);
        }
        self.short(&at, "source", &c.source, EVIDENCE_MAX);
        if c.reviewed_by.iter().any(|n| n.trim().is_empty()) {
            self.fail(&at, "reviewed_by has an empty name");
        }
        if !(1..=4).contains(&c.views.len()) {
            self.fail(
                &at,
                format_args!("has {} views; give 1 to 4", c.views.len()),
            );
        }

        let main = self.range(&at, &c.reference);
        let also: Vec<Option<(u32, u32)>> = c.also.iter().map(|r| self.range(&at, r)).collect();
        let helps: Vec<Option<(u32, u32)>> = c.helps.iter().map(|r| self.range(&at, r)).collect();
        let mut views = Vec::new();
        let mut all: Vec<Option<(u32, u32)>> = std::iter::once(main)
            .chain(also.iter().copied())
            .chain(helps.iter().copied())
            .collect();
        for (i, v) in c.views.iter().enumerate() {
            let vat = format!("{at}, views[{i}]");
            self.short(&vat, "label", &v.label, LABEL_MAX);
            self.short(&vat, "text", &v.text, TEXT_MAX);
            if !STRENGTHS.contains(&v.strength.as_str()) {
                self.fail(
                    &vat,
                    format_args!(
                        "strength {:?} is not one of: {}",
                        v.strength,
                        STRENGTHS.join(", ")
                    ),
                );
            }
            let rs: Vec<Option<(u32, u32)>> = v.refs.iter().map(|r| self.range(&vat, r)).collect();
            all.extend(rs.iter().copied());
            views.push((v, rs));
        }

        // Quotations: checked once every reference resolved, against all of the card's texts.
        if all.iter().all(Option::is_some) {
            let texts: Vec<String> = all
                .iter()
                .flatten()
                .map(|&(s, e)| normalize(&self.text[s as usize..=e as usize].join(" ")))
                .collect();
            let fields = std::iter::once(("answer", c.answer.as_str()))
                .chain(std::iter::once(("evidence", c.evidence.as_str())))
                .chain(c.views.iter().map(|v| ("a view", v.text.as_str())));
            for (field, s) in fields {
                match quotes(s) {
                    Err(e) => self.fail(&at, format_args!("{field}: {e}")),
                    Ok(qs) => {
                        for q in qs.into_iter().filter(|q| word_count(q) >= QUOTE_MIN_WORDS) {
                            if !texts.iter().any(|t| contains(t, q)) {
                                self.fail(&at, format_args!("{field}: quotation {q:?} is not in the BSB text of the card's references"));
                            }
                        }
                    }
                }
            }
        }

        let mut links = Vec::new();
        for l in &c.read_more {
            if !allowed_link(&l.url) {
                self.fail(
                    &at,
                    format_args!(
                        "link {:?} is not https on one of: {}",
                        l.url,
                        HOSTS.join(", ")
                    ),
                );
            }
            self.short(&at, "link site", &l.site, LABEL_MAX);
            self.short(&at, "link title", &l.title, 160);
            links.push(json!({ "site": l.site, "title": l.title, "url": l.url }));
        }

        let (v, end) = main?;
        let span = |r: &Option<(u32, u32)>| r.map(|(s, e)| json!([s, e]));
        let also: Vec<Value> = also.iter().map(span).collect::<Option<_>>()?;
        let helps: Vec<Value> = helps.iter().map(span).collect::<Option<_>>()?;
        let views: Vec<Value> = views
            .into_iter()
            .map(|(v, rs)| Some(json!({ "label": v.label, "strength": v.strength, "text": v.text, "refs": rs.iter().map(span).collect::<Option<Vec<_>>>()? })))
            .collect::<Option<_>>()?;
        Some(json!({
            "id": c.id, "v": v, "end": end, "also": also, "question": c.question, "answer": c.answer, "views": views,
            "helps": helps, "read_more": links, "evidence": c.evidence, "source": c.source,
            "reviewed_by": c.reviewed_by, "draft": c.reviewed_by.is_empty(),
        }))
    }
}

/// The files to write under web/public/data, as (path, bytes).
pub fn build(
    root: &Path,
    vz: &Versification,
    text: &[String],
) -> Result<Vec<(String, Vec<u8>)>, String> {
    let file: File = serde_json::from_str(
        &fs::read_to_string(root.join(CONFIG)).map_err(|e| format!("reading {CONFIG}: {e}"))?,
    )
    .map_err(|e| format!("parsing {CONFIG}: {e}"))?;
    let drafts_ok = std::env::var(DRAFTS_ENV).is_ok_and(|v| v == "1");
    let mut check = Check {
        text,
        vz,
        errors: Vec::new(),
    };
    let mut ids = BTreeSet::new();
    let mut cards = Vec::new();
    let mut drafts = 0;
    for c in &file.questions {
        if !ids.insert(c.id.as_str()) {
            check.fail(
                &format!("question {:?}", c.id),
                "id is used by an earlier question",
            );
        }
        let card = check.card(c);
        drafts += c.reviewed_by.is_empty() as usize;
        if let Some(card) = card.filter(|_| drafts_ok || !c.reviewed_by.is_empty()) {
            cards.push(card);
        }
    }
    if let Some(e) = check.errors.into_iter().next() {
        return Err(e);
    }
    eprintln!(
        "hard verses: {} questions checked; {} written, {drafts} drafts {}",
        file.questions.len(),
        cards.len(),
        if drafts_ok {
            format!("included ({DRAFTS_ENV}=1)")
        } else {
            format!("left out (set {DRAFTS_ENV}=1 to include them)")
        }
    );

    // The line under each verse: [verse, card index], the card's own verse and its "also" verses.
    let mut lines: Vec<(u32, usize)> = Vec::new();
    for (i, c) in cards.iter().enumerate() {
        lines.push((c["v"].as_u64().unwrap_or(0) as u32, i));
        for a in c["also"].as_array().into_iter().flatten() {
            let (s, e) = (
                a[0].as_u64().unwrap_or(0) as u32,
                a[1].as_u64().unwrap_or(0) as u32,
            );
            // A short passage shows the line on each verse; a long one on its first.
            for v in s..=if e - s < 3 { e } else { s } {
                lines.push((v, i));
            }
        }
    }
    lines.sort_unstable();
    lines.dedup();
    let index = json!({
        "format": 1,
        "questions": cards.iter().map(|c| json!({ "id": c["id"], "q": c["question"] })).collect::<Vec<_>>(),
        "lines": lines,
    });
    let detail = json!({ "format": 1, "cards": cards });
    Ok(vec![
        (
            OUT.to_string(),
            serde_json::to_vec(&index).map_err(|e| e.to_string())?,
        ),
        (
            CARDS.to_string(),
            serde_json::to_vec(&detail).map_err(|e| e.to_string())?,
        ),
    ])
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let read = |rel: &str| -> Result<Value, String> {
        let p = d.dir.join(rel);
        serde_json::from_str(
            &fs::read_to_string(&p).map_err(|e| format!("reading {}: {e}", p.display()))?,
        )
        .map_err(|e| format!("parsing {}: {e}", p.display()))
    };
    let index = read(OUT)?;
    let cards = read(CARDS)?;
    let qs = index["questions"]
        .as_array()
        .ok_or("hard-verses.json has no questions")?;
    let cs = cards["cards"]
        .as_array()
        .ok_or("hard-verses/cards.json has no cards")?;
    let lines = index["lines"]
        .as_array()
        .ok_or("hard-verses.json has no lines")?;
    let n = u64::from(d.vz.verse_count());
    Ok(vec![
        (
            qs.len() == cs.len() && qs.iter().zip(cs).all(|(q, c)| q["id"] == c["id"]),
            "hard-verse questions and cards match".to_string(),
        ),
        (
            lines.iter().all(|l| {
                l[0].as_u64().is_some_and(|v| v < n)
                    && l[1].as_u64().is_some_and(|i| (i as usize) < cs.len())
            }),
            "every hard-verse line points at a real verse and card".to_string(),
        ),
        (
            cs.iter().all(|c| c["draft"] == false)
                || std::env::var(DRAFTS_ENV).is_ok_and(|v| v == "1"),
            "no draft hard-verse card is published".to_string(),
        ),
    ])
}

/// Lowercase letters and digits with single spaces between words, as
/// `layers.rs` compares text: punctuation and quote marks dropped, dashes
/// splitting words.
fn normalize(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if c.is_alphanumeric() {
            out.extend(c.to_lowercase());
        } else if (c.is_whitespace() || c == '\u{2014}' || c == '\u{2013}')
            && !out.is_empty()
            && !out.ends_with(' ')
        {
            out.push(' ');
        }
    }
    if out.ends_with(' ') {
        out.pop();
    }
    out
}

fn parts(s: &str) -> Vec<String> {
    s.replace("...", "…")
        .split('…')
        .map(normalize)
        .filter(|p| !p.is_empty())
        .collect()
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
            ('\u{201C}', Some(_)) => {
                return Err("an opening quotation mark inside a quotation".to_string())
            }
            ('\u{201D}', None) => {
                return Err("a closing quotation mark with no opening one".to_string())
            }
            _ => {}
        }
    }
    match open {
        Some(_) => Err("a quotation is never closed".to_string()),
        None => Ok(spans),
    }
}

/// "ESV" as a whole word, in any case.
fn mentions_esv(s: &str) -> bool {
    s.split(|c: char| !c.is_alphanumeric())
        .any(|w| w.eq_ignore_ascii_case("esv"))
}

/// An https link to one of the sites in `HOSTS`, or to one of its own
/// subdomains (www.gotquestions.org, learn.ligonier.org).
fn allowed_link(url: &str) -> bool {
    let host = url
        .strip_prefix("https://")
        .and_then(|r| r.split(['/', '?', '#']).next())
        .unwrap_or("");
    HOSTS
        .iter()
        .any(|h| host == *h || host.strip_suffix(h).is_some_and(|sub| sub.ends_with('.')))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_quotes_like_layers() {
        let t = normalize("there he fell headlong and burst open in the middle, and all his intestines spilled out.");
        assert!(contains(&t, "fell headlong and burst open"));
        assert!(contains(&t, "fell headlong ... all his intestines"));
        assert!(!contains(&t, "fell headlong ... burst openly"));
        assert_eq!(
            quotes("He said \"one two three four\" and “five”").unwrap(),
            ["one two three four", "five"]
        );
        assert!(quotes("a \"stray").is_err());
        assert_eq!(word_count("one two ... three"), 3);
    }

    #[test]
    fn allows_listed_sites_and_their_subdomains() {
        assert!(allowed_link("https://www.gotquestions.org/Judas-die.html"));
        assert!(allowed_link("https://learn.ligonier.org/articles/x"));
        assert!(allowed_link("https://bible.org/seriespage/x"));
        assert!(!allowed_link("http://www.gotquestions.org/x"));
        assert!(!allowed_link("https://notgotquestions.org/x"));
        assert!(!allowed_link("https://gotquestions.org.example.com/x"));
    }

    #[test]
    fn finds_esv_as_a_word() {
        assert!(mentions_esv("the ESV says") && !mentions_esv("ESVs"));
    }
}
