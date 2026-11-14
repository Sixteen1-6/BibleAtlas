//! Patterns, shown from Deep behind the commentary notice: details that fit
//! (undesigned coincidences, where a detail in one passage is explained by
//! another written apart from it), key words (one word carried through a
//! passage) and repeated scenes (the same kind of scene told of different
//! people, its parts in the same order). Written in `config/patterns.json`
//! and checked here before anything is written:
//!
//! 1. every reference resolves in the BSB; a key word's passage is in one
//!    book; a detail's sides, and a scene's tellings, do not overlap one
//!    another;
//! 2. every quoted line of a side, and every part of a telling, is the exact
//!    BSB text of one verse of its range, found there once, so the reader can
//!    mark it without searching;
//! 3. a detail has two to four sides, each with at least one line; a key
//!    word names its root (Strong's numbers) and the BSB forms that render
//!    it, its root comes at least `KEY_MIN` times in the passage's Hebrew or
//!    Greek and each form at least once in the BSB text, as whole words, and
//!    the build counts both (the counts are never typed); a scene lists its
//!    parts, every telling shows at least two of them, and every part is in
//!    at least two tellings;
//! 4. the citations follow the figures' rules, through the same checks
//!    (`extra_figures::Check`): works on the cite list, quotable ones only,
//!    the writer each book's words are by, a link to the page, decision 10's
//!    read and retrieved; the strength is the number of different
//!    interpreters cited (3 or more "widely agreed", 2 "commonly held", 1
//!    "some interpreters"); every telling of a scene lies under the passage
//!    some cite is on, and some cite is on a detail's sides or a key word's
//!    passage;
//! 5. a pattern's own words name no writer, quote only BSB words of the
//!    verses it names (four words or more), and never name the ESV or credit
//!    a drafting tool.
//!
//! The writers' words are checked against their text before a pattern is
//! added (`docs/evidence/patterns-*.json` records the line each was found on).
//!
//! Output, under `web/public/data/`:
//! - `extras/patterns.json`: `{format, kinds, rows}`. `kinds[id]` is `{label,
//!   about}`; each row is `{id, kind, short, r, b}`: `r` the verse ranges the
//!   line shows under, `b` the books whose files hold the pattern.
//! - `extras/patterns/<Book>.json`: `{format, notes}`, every pattern that
//!   touches the book. A note is `{id, kind, v, end, r, strength, writers,
//!   short, about, sides?, key?, parts?, scenes?, evidence, limit?, checked,
//!   cites}`. A side is `{label, s, e, w}`, `w` its lines as `{v, at, t}` (`at`
//!   a UTF-16 offset into verse `v`'s BSB text). A key is `{s, e, lang,
//!   strong, n, verses, forms, marks}`: `n` the times the root comes in the
//!   passage, `verses` the verses it comes in, `marks` every BSB form found
//!   there as `{v, at, t}`. A part is `{id, label}` and a telling `{who, s, e,
//!   w}`, `w` mapping a part's id to its words `{v, at, t}`. Cites are as in
//!   figures.

use crate::extra_figures::{self as fig, Check, Cite, Sources};
use crate::layers::CiteList;
use crate::loaded::Loaded;
use atlas_core::BOOKS;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

pub const CONFIG: &str = "config/patterns.json";
const OUT: &str = "extras/patterns.json";
const PARTS: &str = "extras/patterns";
const KINDS: [&str; 3] = ["coincidence", "keyword", "scene"];
/// The line under the verse: short enough to fit about 70 characters with
/// "and 1 more".
const SHORT_MAX: usize = 60;
/// A key word comes at least this often in its passage's Hebrew or Greek.
const KEY_MIN: usize = 3;
const SIDES_MAX: usize = 4;
const SCENE_PARTS_MAX: usize = 8;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct File {
    #[serde(default, rename = "_comment")]
    _comment: Vec<String>,
    /// Works quoted here besides those config/figure-forms.json lists.
    #[serde(default)]
    quotable: Vec<String>,
    kinds: Vec<Kind>,
    patterns: Vec<Pattern>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Kind {
    id: String,
    label: String,
    about: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Pattern {
    id: String,
    kind: String,
    strength: String,
    short: String,
    about: String,
    /// A detail's sides.
    #[serde(default)]
    sides: Vec<Side>,
    /// A key word's passage.
    #[serde(default, rename = "ref")]
    reference: Option<String>,
    /// A key word's root, as Strong's numbers ("H1288").
    #[serde(default)]
    strong: Vec<String>,
    /// "In Hebrew", "In Aramaic" or "In John's Greek": where the root is.
    #[serde(default, rename = "in")]
    lang: Option<String>,
    /// The BSB forms that render the key word, as the BSB spells them.
    #[serde(default)]
    forms: Vec<String>,
    /// A scene's parts.
    #[serde(default)]
    parts: Vec<Part>,
    /// A scene's tellings.
    #[serde(default)]
    scenes: Vec<Telling>,
    evidence: String,
    #[serde(default)]
    limit: Option<String>,
    checked: String,
    cites: Vec<Cite>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Side {
    label: String,
    #[serde(rename = "ref")]
    reference: String,
    words: Vec<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Part {
    id: String,
    label: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Telling {
    who: String,
    #[serde(rename = "ref")]
    reference: String,
    words: BTreeMap<String, String>,
}

/// The verse among `(s, e)` whose text holds `words` once, and where.
fn find_in(c: &mut Check, at: &str, (s, e): (u32, u32), words: &str) -> Option<(u32, usize)> {
    let hits: Vec<u32> = (s..=e).filter(|&v| c.src.text[v as usize].contains(words)).collect();
    match hits[..] {
        [v] => c.find_once(at, v, words).map(|off| (v, off)),
        [] => {
            c.fail(at, format_args!("{words:?} is not the BSB text of a verse in {}", label(c, s, e)));
            None
        }
        _ => {
            c.fail(at, format_args!("{words:?} is in more than one verse of its range; quote more of it"));
            None
        }
    }
}

/// "Genesis 24:10-27", for messages.
fn label(c: &Check, s: u32, e: u32) -> String {
    let name = |v: u32| c.src.vz.locate(v).map_or_else(|| format!("verse {v}"), |(b, ch, vs)| format!("{} {ch}:{vs}", BOOKS[b as usize].name));
    if s == e { name(s) } else { format!("{} to {}", name(s), name(e)) }
}

/// A line of BSB words, as the site marks it.
fn mark(c: &Check, v: u32, off: usize, t: &str) -> Value {
    json!({ "v": v, "at": fig::utf16_len(&c.src.text[v as usize][..off]), "t": t })
}

/// H or G and four digits.
fn strong_ok(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 5 && (b[0] == b'H' || b[0] == b'G') && b[1..].iter().all(u8::is_ascii_digit)
}

/// Does the lemma `key` ("H1288G") belong to the root `strong` ("H1288")?
fn lemma_matches(key: &str, strong: &str) -> bool {
    key == strong || (key.len() == strong.len() + 1 && key.starts_with(strong) && key.as_bytes()[strong.len()].is_ascii_alphabetic())
}

/// "In Hebrew", "In Aramaic", or "In <someone>'s Greek" (the Gospel writer's
/// Greek, Paul's Greek), to match the roots' language.
fn lang_ok(lang: &str, greek: bool) -> bool {
    if greek {
        lang.starts_with("In ") && lang.ends_with("'s Greek") && lang.len() > "In 's Greek".len()
    } else {
        lang == "In Hebrew" || lang == "In Aramaic"
    }
}

/// Do two ranges share a verse?
fn overlap(a: (u32, u32), b: (u32, u32)) -> bool {
    a.0 <= b.1 && b.0 <= a.1
}

fn pattern(c: &mut Check, p: &Pattern, ids: &mut BTreeSet<String>) -> Option<(Value, Vec<u8>)> {
    let at = format!("{CONFIG}: pattern {:?}", p.id);
    if p.id.is_empty() || !p.id.chars().all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-') {
        c.fail(&at, "id must be lowercase letters, digits and hyphens");
    }
    if !ids.insert(p.id.clone()) {
        c.fail(&at, "id is used by an earlier pattern");
    }
    if !KINDS.contains(&p.kind.as_str()) {
        c.fail(&at, format_args!("kind {:?} is not one of: {}", p.kind, KINDS.join(", ")));
        return None;
    }
    c.own_words(&at, "short", &p.short, SHORT_MAX);
    c.own_words(&at, "about", &p.about, fig::TEXT_MAX);
    c.text(&at, "evidence", &p.evidence, fig::EVIDENCE_MAX);
    if let Some(l) = &p.limit {
        c.own_words(&at, "limit", l, fig::TEXT_MAX);
    }
    if !fig::date_ok(&p.checked) {
        c.fail(&at, format_args!("checked {:?} must be a date, as 2026-10-21", p.checked));
    }
    let coincidence = p.kind == "coincidence";
    let keyword = p.kind == "keyword";
    let scene = p.kind == "scene";
    if !coincidence && !p.sides.is_empty() {
        c.fail(&at, "only a detail that fits has sides");
    }
    if !keyword && (p.reference.is_some() || !p.strong.is_empty() || !p.forms.is_empty() || p.lang.is_some()) {
        c.fail(&at, "only a key word has ref, strong, in and forms");
    }
    if !scene && (!p.parts.is_empty() || !p.scenes.is_empty()) {
        c.fail(&at, "only a repeated scene has parts and scenes");
    }

    // The ranges a part must lie under a cite of, and every verse the
    // pattern names (for its own quotations).
    let mut shown: Vec<(u32, u32, String)> = Vec::new();
    let mut named: Vec<(u32, u32)> = Vec::new();
    let mut out = json!({});

    if coincidence {
        if !(2..=SIDES_MAX).contains(&p.sides.len()) {
            c.fail(&at, format_args!("a detail that fits has two to {SIDES_MAX} sides"));
        }
        let mut sides = Vec::new();
        for (i, side) in p.sides.iter().enumerate() {
            let sat = format!("{at}, sides[{i}]");
            c.own_words(&sat, "label", &side.label, fig::LABEL_MAX);
            let Some(r) = c.range(&sat, &side.reference) else { continue };
            if side.words.is_empty() {
                c.fail(&sat, "a side quotes at least one line of its verses");
            }
            let mut w = Vec::new();
            let mut seen = BTreeSet::new();
            for t in &side.words {
                if let Some((v, off)) = find_in(c, &sat, r, t) {
                    if !seen.insert((v, off)) {
                        c.fail(&sat, format_args!("{t:?} is quoted twice"));
                    }
                    w.push(mark(c, v, off, t));
                }
            }
            if shown.iter().any(|&(a, z, _)| overlap((a, z), r)) {
                c.fail(&sat, "a side must not overlap another side");
            }
            shown.push((r.0, r.1, format!("sides[{i}]")));
            named.push(r);
            sides.push(json!({ "label": side.label, "s": r.0, "e": r.1, "w": w }));
        }
        out["sides"] = json!(sides);
    }

    if keyword {
        let Some(r) = p.reference.as_deref() else {
            c.fail(&at, "a key word names its passage in ref");
            return None;
        };
        let own = c.range(&at, r)?;
        let (b0, _, _) = c.src.vz.locate(own.0)?;
        let (b1, _, _) = c.src.vz.locate(own.1)?;
        if b0 != b1 {
            c.fail(&at, format_args!("{r:?} crosses a book; a key word's passage is in one book"));
        }
        if p.strong.is_empty() || p.strong.iter().any(|s| !strong_ok(s)) {
            c.fail(&at, "strong lists the key word's root as Strong's numbers, H or G and four digits (\"H1288\")");
        }
        let greek = p.strong.first().is_some_and(|s| s.starts_with('G'));
        if p.strong.iter().any(|s| s.starts_with('G') != greek) {
            c.fail(&at, "a key word's roots are all Hebrew or Aramaic (H), or all Greek (G)");
        }
        match &p.lang {
            Some(l) if lang_ok(l, greek) => {}
            _ => c.fail(&at, if greek { "in must say whose Greek it is, as \"In John's Greek\"" } else { "in must be \"In Hebrew\" or \"In Aramaic\"" }),
        }
        let mut hits: Vec<[u32; 3]> = Vec::new();
        for v in own.0..=own.1 {
            for (pos, w) in c.src.words[v as usize].iter().enumerate() {
                let Some(key) = w.lemma.as_deref().filter(|k| w.main && p.strong.iter().any(|s| lemma_matches(k, s))) else { continue };
                if let Some(&li) = c.src.lemma_index.get(key) {
                    hits.push([v, pos as u32, li]);
                }
            }
        }
        if hits.len() < KEY_MIN {
            c.fail(&at, format_args!("its root {} comes {} times in {r:?}; a key word comes at least {KEY_MIN} times", p.strong.join(" or "), hits.len()));
        }
        if p.forms.is_empty() {
            c.fail(&at, "forms lists the BSB words that render the key word, as the BSB spells them");
        }
        let mut marks = Vec::new();
        for f in &p.forms {
            if f.trim().is_empty() || f.trim() != f {
                c.fail(&at, format_args!("form {f:?} must be words with no space around them"));
                continue;
            }
            let mut found = 0;
            for v in own.0..=own.1 {
                let t = &c.src.text[v as usize];
                for i in fig::whole_words(t, f).collect::<Vec<_>>() {
                    marks.push((v, i, f.clone()));
                    found += 1;
                }
            }
            if found == 0 {
                c.fail(&at, format_args!("form {f:?} is not in the BSB text of {r:?}, as whole words"));
            }
        }
        marks.sort();
        marks.dedup_by(|a, b| a.0 == b.0 && a.1 < b.1 + b.2.len() && b.1 < a.1 + a.2.len());
        // Only the verses where the root comes carry the key word; a form
        // outside them renders some other word and is not marked.
        let root_verses: BTreeSet<u32> = hits.iter().map(|h| h[0]).collect();
        let marks: Vec<Value> = marks.into_iter().filter(|m| root_verses.contains(&m.0)).map(|(v, i, t)| mark(c, v, i, &t)).collect();
        if marks.is_empty() && hits.len() >= KEY_MIN {
            c.fail(&at, "none of the forms is in a verse where the root comes; list the BSB words that render it");
        }
        shown.push((own.0, own.1, "ref".to_string()));
        named.push(own);
        out["key"] = json!({
            "s": own.0, "e": own.1, "lang": p.lang, "strong": p.strong, "n": hits.len(),
            "verses": root_verses.into_iter().collect::<Vec<_>>(), "forms": p.forms, "marks": marks, "words": hits,
        });
    }

    if scene {
        if !(2..=SCENE_PARTS_MAX).contains(&p.parts.len()) {
            c.fail(&at, format_args!("a repeated scene lists two to {SCENE_PARTS_MAX} parts"));
        }
        let mut part_ids = BTreeSet::new();
        for (i, part) in p.parts.iter().enumerate() {
            let pat = format!("{at}, parts[{i}]");
            if part.id.is_empty() || !part.id.chars().all(|ch| ch.is_ascii_lowercase() || ch == '-') || !part_ids.insert(part.id.as_str()) {
                c.fail(&pat, "a part's id is lowercase letters and hyphens, used once");
            }
            c.own_words(&pat, "label", &part.label, fig::LABEL_MAX);
        }
        if p.scenes.len() < 2 {
            c.fail(&at, "a repeated scene is told at least twice");
        }
        let mut uses: BTreeMap<&str, usize> = BTreeMap::new();
        let mut tellings = Vec::new();
        for (i, t) in p.scenes.iter().enumerate() {
            let tat = format!("{at}, scenes[{i}]");
            c.own_words(&tat, "who", &t.who, fig::LABEL_MAX);
            let Some(r) = c.range(&tat, &t.reference) else { continue };
            if t.words.len() < 2 {
                c.fail(&tat, "a telling shows at least two of the scene's parts");
            }
            let mut w = serde_json::Map::new();
            // In the order the parts are listed, so the panel can lay the
            // tellings out part by part.
            for part in &p.parts {
                let Some(words) = t.words.get(&part.id) else { continue };
                *uses.entry(part.id.as_str()).or_default() += 1;
                if let Some((v, off)) = find_in(c, &tat, r, words) {
                    w.insert(part.id.clone(), mark(c, v, off, words));
                }
            }
            for k in t.words.keys() {
                if !part_ids.contains(k.as_str()) {
                    c.fail(&tat, format_args!("{k:?} is not one of the scene's parts"));
                }
            }
            if shown.iter().any(|&(a, z, _)| overlap((a, z), r)) {
                c.fail(&tat, "a telling must not overlap another telling");
            }
            shown.push((r.0, r.1, format!("scenes[{i}]")));
            named.push(r);
            tellings.push(json!({ "who": t.who, "s": r.0, "e": r.1, "w": w }));
        }
        for part in &p.parts {
            if uses.get(part.id.as_str()).copied().unwrap_or(0) < 2 {
                c.fail(&at, format_args!("part {:?} is shown in fewer than two tellings; a repeated part is in at least two", part.id));
            }
        }
        out["parts"] = json!(p.parts.iter().map(|x| json!({ "id": x.id, "label": x.label })).collect::<Vec<_>>());
        out["scenes"] = json!(tellings);
    }

    // Quotations in the pattern's own words, against every verse it names.
    let texts: Vec<String> = named.iter().map(|&(a, z)| fig::normalize(&c.src.text[a as usize..=z as usize].join(" "))).collect();
    let mut fields = vec![("short", p.short.as_str()), ("about", p.about.as_str()), ("evidence", p.evidence.as_str())];
    if let Some(l) = &p.limit {
        fields.push(("limit", l.as_str()));
    }
    for (field, t) in fields {
        match fig::quotes(t) {
            Err(e) => c.fail(&at, format_args!("{field}: {e}")),
            Ok(qs) => {
                for q in qs.into_iter().filter(|q| fig::word_count(q) >= fig::QUOTE_MIN_WORDS) {
                    if !texts.iter().any(|x| fig::contains(x, q)) {
                        c.fail(&at, format_args!("{field}: quotation {q:?} is not in the BSB text of the verses the pattern names"));
                    }
                }
            }
        }
    }

    // Citations, as in figures; the strength follows from the writers.
    let mut cites = Vec::new();
    let mut writers = BTreeSet::new();
    let mut seen = BTreeSet::new();
    let mut ons: Vec<(u32, u32)> = Vec::new();
    if p.cites.is_empty() {
        c.fail(&at, "cites nothing; every pattern cites an interpreter on the cite list");
    }
    for (i, ct) in p.cites.iter().enumerate() {
        let cat = format!("{at}, cites[{i}]");
        if !seen.insert((ct.source.as_str(), ct.on.as_str(), ct.quote.as_str())) {
            c.fail(&cat, "the same quotation is cited twice");
        }
        c.quoted(&cat, "quote", &ct.quote, fig::QUOTE_MAX);
        c.text(&cat, "on", &ct.on, fig::AT_MAX);
        if let Some(a) = &ct.at {
            c.text(&cat, "at", a, fig::AT_MAX);
        }
        c.read(&cat, &ct.read, &ct.retrieved);
        let on = c.range(&cat, &ct.on);
        let Some(src) = c.source(&cat, &ct.source) else { continue };
        let Some(on) = on else { continue };
        ons.push(on);
        let Some((mut x, key)) = c.credit(&cat, src, Some(on), ct.work.as_deref(), ct.url.as_deref()) else { continue };
        if src.role == fig::INTERPRETER {
            writers.insert(key);
        }
        x["on"] = json!(ct.on);
        x["quote"] = json!(ct.quote);
        x["read"] = json!(ct.read);
        x["retrieved"] = json!(ct.retrieved);
        if let Some(a) = &ct.at {
            x["at"] = json!(Check::place(&x, a));
        }
        cites.push(x);
    }
    let want = fig::strength_for(writers.len());
    if !p.cites.is_empty() && writers.is_empty() {
        c.fail(&at, "cites no interpreter; a word book or the BSB alone cannot carry a pattern");
    } else if !p.cites.is_empty() && p.strength != want {
        c.fail(&at, format_args!("strength is {:?}, but it cites {} different interpreters, which is {want:?}", p.strength, writers.len()));
    }
    // Every telling of a scene is under some cite's passage, since each
    // telling is joined to the others by a writer; a detail's writer names
    // all its sides in one place (the evidence records where), so some cite
    // is on one of them; a key word's passage holds some cite's passage.
    if !ons.is_empty() && !scene && !shown.iter().any(|&(a, z, _)| ons.iter().any(|&o| overlap(o, (a, z)))) {
        c.fail(&at, "no cite is on any of the verses it shows");
    }
    if !ons.is_empty() && scene {
        for (a, z, what) in &shown {
            if !ons.iter().any(|&o| overlap(o, (*a, *z))) {
                c.fail(&at, format_args!("{what} ({}) is under no cite's passage; every part shown is named by a writer", label(c, *a, *z)));
            }
        }
    }

    named.sort_unstable();
    named.dedup();
    let v = named.iter().map(|r| r.0).min()?;
    let end = named.iter().map(|r| r.1).max()?;
    let mut books: Vec<u8> = Vec::new();
    for &(a, z) in &named {
        for x in [a, z] {
            let b = c.src.vz.locate(x)?.0;
            if !books.contains(&b) {
                books.push(b);
            }
        }
    }
    books.sort_unstable();
    out["id"] = json!(p.id);
    out["kind"] = json!(p.kind);
    out["v"] = json!(v);
    out["end"] = json!(end);
    out["r"] = json!(named.iter().map(|&(a, z)| [a, z]).collect::<Vec<_>>());
    out["strength"] = json!(p.strength);
    out["writers"] = json!(writers.len());
    out["short"] = json!(p.short);
    out["about"] = json!(p.about);
    out["evidence"] = json!(p.evidence);
    out["checked"] = json!(p.checked);
    out["cites"] = json!(cites);
    if let Some(l) = &p.limit {
        out["limit"] = json!(l);
    }
    Some((out, books))
}

/// Read and check the patterns; the files to write under web/public/data.
pub fn build(root: &Path, src: &Sources) -> Result<Vec<(String, Vec<u8>)>, String> {
    let text = fs::read_to_string(root.join(CONFIG)).map_err(|e| format!("reading {CONFIG}: {e}"))?;
    let file: File = serde_json::from_str(&text).map_err(|e| format!("parsing {CONFIG}: {e}"))?;
    let cite = CiteList::read(root)?;
    let mut quotable = fig::quotable(root)?;
    for q in &file.quotable {
        if quotable.contains(q) {
            return Err(format!("{CONFIG}: quotable lists {q:?}, which {} already lists", fig::FORMS));
        }
        quotable.push(q.clone());
    }
    let no_forms = BTreeMap::new();
    let mut c = fig::checker(src, &cite, &no_forms, &quotable);
    let mut kinds = serde_json::Map::new();
    for k in &file.kinds {
        let at = format!("{CONFIG}: kind {:?}", k.id);
        if !KINDS.contains(&k.id.as_str()) {
            c.fail(&at, format_args!("is not one of: {}", KINDS.join(", ")));
        }
        c.text(&at, "label", &k.label, fig::LABEL_MAX);
        c.text(&at, "about", &k.about, fig::TEXT_MAX);
        kinds.insert(k.id.clone(), json!({ "label": k.label, "about": k.about }));
    }
    for k in KINDS {
        if !kinds.contains_key(k) {
            c.fail(CONFIG, format_args!("kinds must describe {k:?}"));
        }
    }
    let mut ids = BTreeSet::new();
    let mut notes = Vec::new();
    for p in &file.patterns {
        if let Some(x) = pattern(&mut c, p, &mut ids) {
            notes.push(x);
        }
    }
    if !c.errors.is_empty() {
        let n = c.errors.len();
        let shown: Vec<String> = c.errors.into_iter().take(40).collect();
        return Err(format!("{n} problems in {CONFIG}:\n{}", shown.join("\n")));
    }
    notes.sort_by(|x, y| (x.0["v"].as_u64(), x.0["id"].as_str()).cmp(&(y.0["v"].as_u64(), y.0["id"].as_str())));
    let mut per_book: BTreeMap<u8, Vec<Value>> = BTreeMap::new();
    let mut rows = Vec::new();
    let mut counts: BTreeMap<String, usize> = BTreeMap::new();
    for (x, books) in &notes {
        *counts.entry(x["kind"].as_str().unwrap_or_default().to_string()).or_default() += 1;
        rows.push(json!({
            "id": x["id"], "kind": x["kind"], "short": x["short"], "r": x["r"],
            "b": books.iter().map(|&b| BOOKS[b as usize].osis).collect::<Vec<_>>(),
        }));
        for &b in books {
            per_book.entry(b).or_default().push(x.clone());
        }
    }
    let mut out = Vec::new();
    for (b, list) in per_book {
        let doc = json!({ "format": 1, "notes": list });
        out.push((format!("{PARTS}/{}.json", BOOKS[b as usize].osis), serde_json::to_vec(&doc).map_err(|e| e.to_string())?));
    }
    let summary: Vec<String> = counts.iter().map(|(k, n)| format!("{n} {k}")).collect();
    eprintln!("patterns: {} patterns checked and written ({}) in {} book files", notes.len(), summary.join(", "), out.len());
    let index = json!({ "format": 1, "kinds": kinds, "rows": rows });
    out.push((OUT.to_string(), serde_json::to_vec(&index).map_err(|e| e.to_string())?));
    Ok(out)
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let read = |p: &Path| -> Result<Value, String> {
        serde_json::from_str(&fs::read_to_string(p).map_err(|e| format!("reading {}: {e}", p.display()))?)
            .map_err(|e| format!("parsing {}: {e}", p.display()))
    };
    let index = read(&d.dir.join(OUT))?;
    let rows = index["rows"].as_array().cloned().unwrap_or_default();
    let n = d.vz.verse_count() as u64;
    let mut out = Vec::new();
    let kinds_ok = KINDS.iter().all(|k| index["kinds"][k]["label"].is_string());
    out.push((kinds_ok, format!("patterns: {OUT} describes all {} kinds", KINDS.len())));
    let mut files_ok = !rows.is_empty();
    let mut ranges_ok = true;
    let mut every_kind: BTreeSet<String> = BTreeSet::new();
    for r in &rows {
        every_kind.insert(r["kind"].as_str().unwrap_or_default().to_string());
        for pair in r["r"].as_array().into_iter().flatten() {
            let (a, z) = (pair[0].as_u64().unwrap_or(u64::MAX), pair[1].as_u64().unwrap_or(u64::MAX));
            ranges_ok &= a <= z && z < n;
        }
        for b in r["b"].as_array().into_iter().flatten() {
            let part = read(&d.dir.join(format!("{PARTS}/{}.json", b.as_str().unwrap_or_default())));
            files_ok &= part.is_ok_and(|p| p["notes"].as_array().is_some_and(|ns| ns.iter().any(|x| x["id"] == r["id"])));
        }
    }
    out.push((files_ok, format!("patterns: {} patterns, each in the file of every book it touches", rows.len())));
    out.push((ranges_ok, "patterns: every range names verses of the Bible, first to last".to_string()));
    out.push((KINDS.iter().all(|k| every_kind.contains(*k)), "patterns: at least one pattern of each kind".to_string()));
    // Every key word's count is the number of root words it lists, and each
    // mark is the BSB text at its place.
    let mut keys_ok = true;
    let mut marks_ok = true;
    let books: BTreeSet<String> = rows.iter().flat_map(|r| r["b"].as_array().cloned().unwrap_or_default()).filter_map(|b| b.as_str().map(str::to_string)).collect();
    for b in &books {
        let Ok(part) = read(&d.dir.join(format!("{PARTS}/{b}.json"))) else { continue };
        for x in part["notes"].as_array().into_iter().flatten() {
            if let Some(k) = x.get("key") {
                keys_ok &= k["words"].as_array().map(Vec::len) == k["n"].as_u64().map(|n| n as usize) && k["n"].as_u64().unwrap_or(0) >= KEY_MIN as u64;
            }
            let mut ws: Vec<&Value> = Vec::new();
            ws.extend(x["key"]["marks"].as_array().into_iter().flatten());
            for s in x["sides"].as_array().into_iter().flatten() {
                ws.extend(s["w"].as_array().into_iter().flatten());
            }
            for s in x["scenes"].as_array().into_iter().flatten() {
                ws.extend(s["w"].as_object().into_iter().flat_map(|m| m.values()));
            }
            for w in ws {
                let v = w["v"].as_u64().unwrap_or(u64::MAX);
                let ok = v < n && {
                    let text = d.english(v as u32);
                    let units: Vec<u16> = text.encode_utf16().collect();
                    let want: Vec<u16> = w["t"].as_str().unwrap_or_default().encode_utf16().collect();
                    let off = w["at"].as_u64().unwrap_or(u64::MAX) as usize;
                    !want.is_empty() && units.get(off..off + want.len()) == Some(&want[..])
                };
                marks_ok &= ok;
            }
        }
    }
    out.push((keys_ok, format!("patterns: every key word comes at least {KEY_MIN} times, as many as it lists")));
    out.push((marks_ok, "patterns: every marked line is the BSB text at its place".to_string()));
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_the_language() {
        assert!(lang_ok("In Hebrew", false));
        assert!(lang_ok("In Aramaic", false));
        assert!(!lang_ok("In Greek", true));
        assert!(lang_ok("In John's Greek", true));
        assert!(!lang_ok("In John's Greek", false));
    }

    #[test]
    fn matches_roots() {
        assert!(lemma_matches("H1288", "H1288") && lemma_matches("H1288G", "H1288"));
        assert!(!lemma_matches("H12881", "H1288") && !lemma_matches("H1293", "H1288"));
        assert!(strong_ok("G3306") && !strong_ok("G33") && !strong_ok("X3306"));
    }

    #[test]
    fn finds_overlaps() {
        assert!(overlap((1, 5), (5, 9)) && !overlap((1, 4), (5, 9)));
    }
}
