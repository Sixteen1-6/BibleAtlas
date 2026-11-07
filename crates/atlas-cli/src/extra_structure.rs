//! Structures across verses and chapters, shown from Deep: bookends (a passage
//! that opens and closes with the same words), refrains, two threads taking
//! turns, mirrors laid out A B B' A', and foils, two people set side by side
//! across chapters or books. Written in `config/structures.json` and checked
//! here before anything is written:
//!
//! 1. every reference resolves in the BSB; a structure's own passage is in one
//!    book (it may cross chapters), and its members sit inside it, in reading
//!    order, without overlapping; a foil's two sides each hold one or more
//!    ranges, which may cross chapters and books but not each other;
//! 2. every member's words, and every word a foil side quotes, are the exact
//!    BSB text of one verse of that member or side, found there once, so the
//!    reader can mark them without searching; each foil side's person is
//!    named in the BSB text of one of its ranges;
//! 3. the marks fit the kind: bookends A A', a refrain R R R, turns A B A B
//!    (each letter in its own place in the cycle), a mirror A B B' A' with at
//!    most one centre; each group of members that answer one another (A and
//!    A', every R, every A of a turn) is tied by words a reader can see: the
//!    group's `tie`, on its first member, is in every member's words, as
//!    whole words;
//! 4. the citations follow the figures' rules, through the same checks
//!    (`extra_figures::Check`): works on the cite list, quotable ones only,
//!    the writer each book's words are by, a link to the page, decision 10's
//!    read and retrieved; the strength is the number of different
//!    interpreters cited (3 or more "widely agreed", 2 "commonly held", 1
//!    "some interpreters");
//! 5. a structure's own words name no writer, quote only BSB words of the
//!    verses it names (four words or more), and never name the ESV or credit
//!    a drafting tool.
//!
//! The writers' words are checked against their text before a structure is
//! added (`docs/evidence/structures-*.json` records where each was found).
//!
//! Output, under `web/public/data/`:
//! - `extras/structure.json`: `{format, kinds, rows}`. `kinds[id]` is `{label,
//!   about}`; each row is `{id, kind, short, r, b}`: `r` the verse ranges the
//!   line shows under (the passage, or a foil's sides), `b` the books whose
//!   files hold the structure.
//! - `extras/structure/<Book>.json`: `{format, notes}`, every structure that
//!   touches the book. A note is `{id, kind, v, end, r, strength, writers,
//!   short, about, members?, sides?, evidence, limit?, checked, cites}`. A
//!   member is `{mark, s, e, v, at, t, tie?}`: its verses, the verse its words
//!   are in, their UTF-16 offset there and the words. A side is `{who, label,
//!   r, w}`, `w` its quoted words as `{v, at, t}`. Cites are as in figures.

use crate::extra_figures::{self as fig, Check, Cite, Sources};
use crate::layers::CiteList;
use crate::loaded::Loaded;
use atlas_core::BOOKS;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

pub const CONFIG: &str = "config/structures.json";
const OUT: &str = "extras/structure.json";
const PARTS: &str = "extras/structure";
const KINDS: [&str; 5] = ["inclusio", "refrain", "alternation", "chiasm", "foil"];
/// The line under the verse: kept short enough to fit about 70 characters
/// with "and 1 more".
const SHORT_MAX: usize = 60;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct File {
    #[serde(default, rename = "_comment")]
    _comment: Vec<String>,
    kinds: Vec<Kind>,
    structures: Vec<Structure>,
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
struct Structure {
    id: String,
    kind: String,
    /// The whole passage; a foil has none, its sides say where it is.
    #[serde(default, rename = "ref")]
    reference: Option<String>,
    strength: String,
    short: String,
    about: String,
    #[serde(default)]
    members: Vec<Member>,
    #[serde(default)]
    sides: Vec<Side>,
    evidence: String,
    #[serde(default)]
    limit: Option<String>,
    checked: String,
    cites: Vec<Cite>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Member {
    mark: String,
    #[serde(rename = "ref")]
    reference: String,
    words: String,
    #[serde(default)]
    tie: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Side {
    who: String,
    label: String,
    refs: Vec<String>,
    words: Vec<String>,
}

/// The verse among `(s, e)` whose text holds `words` once, and where.
fn find_in(c: &mut Check, at: &str, (s, e): (u32, u32), words: &str) -> Option<(u32, usize)> {
    let hits: Vec<u32> = (s..=e).filter(|&v| c.src.text[v as usize].contains(words)).collect();
    match hits[..] {
        [v] => c.find_once(at, v, words).map(|off| (v, off)),
        [] => {
            c.fail(at, format_args!("{words:?} is not the BSB text of a verse in its range"));
            None
        }
        _ => {
            c.fail(at, format_args!("{words:?} is in more than one verse of its range; quote more of it"));
            None
        }
    }
}

/// A capital letter, with ' after it in a mirror's second half.
fn letter(m: &str) -> Option<char> {
    let mut c = m.chars();
    match (c.next(), c.next(), c.next()) {
        (Some(a), None | Some('\''), None) if a.is_ascii_uppercase() => Some(a),
        _ => None,
    }
}

/// Do the marks fit the kind?
fn marks_ok(kind: &str, marks: &[&str]) -> Result<(), &'static str> {
    if marks.iter().any(|m| letter(m).is_none()) {
        return Err("each mark is a capital letter, with ' after it for a partner in the second half");
    }
    let ok = match kind {
        "inclusio" => marks == ["A", "A'"],
        "refrain" => marks.len() >= 2 && marks.iter().all(|m| *m == "R"),
        "alternation" => {
            let k = marks.iter().collect::<BTreeSet<_>>().len();
            marks.len() >= 4
                && k >= 2
                && marks.iter().all(|m| !m.ends_with('\''))
                && marks.windows(2).all(|w| w[0] != w[1])
                && (0..marks.len()).all(|i| marks[i] == marks[i % k])
        }
        "chiasm" => marks.len() >= 4 && fig::mirror_ok(marks),
        _ => false,
    };
    if ok {
        return Ok(());
    }
    Err(match kind {
        "inclusio" => "bookends are two members, A and A'",
        "refrain" => "a refrain's members are all marked R",
        "alternation" => "turns are at least four members, A B A B (or A B C A B C), each letter in its own place",
        _ => "a mirror is at least four members nesting as A B B' A', with at most one centre",
    })
}

/// Which members answer one another: their group key.
fn group(kind: &str, mark: &str) -> String {
    match kind {
        "refrain" => "R".to_string(),
        _ => mark.trim_end_matches('\'').to_string(),
    }
}

fn structure(c: &mut Check, s: &Structure, ids: &mut BTreeSet<String>) -> Option<(Value, Vec<u8>)> {
    let at = format!("{CONFIG}: structure {:?}", s.id);
    if s.id.is_empty() || !s.id.chars().all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-') {
        c.fail(&at, "id must be lowercase letters, digits and hyphens");
    }
    if !ids.insert(s.id.clone()) {
        c.fail(&at, "id is used by an earlier structure");
    }
    if !KINDS.contains(&s.kind.as_str()) {
        c.fail(&at, format_args!("kind {:?} is not one of: {}", s.kind, KINDS.join(", ")));
        return None;
    }
    c.own_words(&at, "short", &s.short, SHORT_MAX);
    c.own_words(&at, "about", &s.about, fig::TEXT_MAX);
    c.text(&at, "evidence", &s.evidence, fig::EVIDENCE_MAX);
    if let Some(l) = &s.limit {
        c.own_words(&at, "limit", l, fig::TEXT_MAX);
    }
    if !fig::date_ok(&s.checked) {
        c.fail(&at, format_args!("checked {:?} must be a date, as 2026-10-21", s.checked));
    }
    let foil = s.kind == "foil";
    let mut named: Vec<(u32, u32)> = Vec::new();
    let mut ranges: Vec<(u32, u32)> = Vec::new();
    let mut out_members = Vec::new();
    let mut out_sides = Vec::new();

    if foil {
        if s.reference.is_some() || !s.members.is_empty() {
            c.fail(&at, "a foil has two sides, not a passage or members");
        }
        if s.sides.len() != 2 {
            c.fail(&at, "a foil sets exactly two sides side by side");
        }
        for (i, side) in s.sides.iter().enumerate() {
            let sat = format!("{at}, sides[{i}]");
            c.own_words(&sat, "who", &side.who, fig::LABEL_MAX);
            c.own_words(&sat, "label", &side.label, fig::LABEL_MAX);
            if side.refs.is_empty() || side.words.is_empty() {
                c.fail(&sat, "a side names at least one range and quotes at least one line of it");
            }
            let rs: Vec<(u32, u32)> = side.refs.iter().filter_map(|r| c.range(&sat, r)).collect();
            let mut sorted = rs.clone();
            sorted.sort_unstable();
            if sorted.windows(2).any(|w| w[1].0 <= w[0].1) {
                c.fail(&sat, "a side's ranges must not overlap");
            }
            if !rs.iter().any(|&(a, z)| c.src.text[a as usize..=z as usize].iter().any(|t| fig::names(t, &side.who))) {
                c.fail(&sat, format_args!("{:?} is not named in the BSB text of the side's ranges", side.who));
            }
            let mut words = Vec::new();
            for w in &side.words {
                let hits: Vec<(u32, u32)> = rs.iter().copied().filter(|&(a, z)| (a..=z).any(|v| c.src.text[v as usize].contains(w.as_str()))).collect();
                match hits[..] {
                    [r] => {
                        if let Some((v, off)) = find_in(c, &sat, r, w) {
                            words.push(json!({ "v": v, "at": fig::utf16_len(&c.src.text[v as usize][..off]), "t": w }));
                        }
                    }
                    [] => c.fail(&sat, format_args!("{w:?} is not the BSB text of a verse in the side's ranges")),
                    _ => c.fail(&sat, format_args!("{w:?} is in more than one of the side's ranges; quote more of it")),
                }
            }
            named.extend(&rs);
            ranges.extend(&rs);
            out_sides.push(json!({ "who": side.who, "label": side.label, "r": rs.iter().map(|&(a, z)| [a, z]).collect::<Vec<_>>(), "w": words }));
        }
    } else {
        if !s.sides.is_empty() {
            c.fail(&at, "only a foil has sides");
        }
        let Some(r) = s.reference.as_deref() else {
            c.fail(&at, "a structure names its whole passage in ref");
            return None;
        };
        let own = c.range(&at, r)?;
        let (b0, _, _) = c.src.vz.locate(own.0)?;
        let (b1, _, _) = c.src.vz.locate(own.1)?;
        if b0 != b1 {
            c.fail(&at, format_args!("{r:?} crosses a book; a structure's passage is in one book (a foil's sides may cross)"));
        }
        named.push(own);
        ranges.push(own);
        let marks: Vec<&str> = s.members.iter().map(|m| m.mark.as_str()).collect();
        if let Err(e) = marks_ok(&s.kind, &marks) {
            c.fail(&at, e);
        }
        let mut last: Option<((u32, u32), u32, usize)> = None;
        let mut groups: BTreeMap<String, (Option<String>, Vec<String>)> = BTreeMap::new();
        for (i, m) in s.members.iter().enumerate() {
            let mat = format!("{at}, members[{i}]");
            let Some(mr) = c.range(&mat, &m.reference) else { continue };
            if mr.0 < own.0 || mr.1 > own.1 {
                c.fail(&mat, format_args!("{:?} is outside the structure's passage {r:?}", m.reference));
                continue;
            }
            let Some((v, off)) = find_in(c, &mat, mr, &m.words) else { continue };
            if let Some((pr, pv, pend)) = last {
                let same_verse = pr == mr && mr.0 == mr.1;
                if !(pr.1 < mr.0 || same_verse) || (v, off) < (pv, pend) {
                    c.fail(&mat, "members must be in reading order and must not overlap");
                }
            }
            last = Some((mr, v, off + m.words.len()));
            let g = groups.entry(group(&s.kind, &m.mark)).or_default();
            match (&m.tie, &g.0) {
                (Some(t), None) if g.1.is_empty() => g.0 = Some(t.clone()),
                (Some(_), _) => c.fail(&mat, "the tie goes on the first member of its group only"),
                _ => {}
            }
            g.1.push(m.words.clone());
            let mut x = json!({ "mark": m.mark, "s": mr.0, "e": mr.1, "v": v, "at": fig::utf16_len(&c.src.text[v as usize][..off]), "t": m.words });
            if let Some(t) = &m.tie {
                x["tie"] = json!(t);
            }
            named.push(mr);
            out_members.push(x);
        }
        for (k, (tie, words)) in &groups {
            if words.len() < 2 {
                continue;
            }
            match tie {
                None => c.fail(&at, format_args!("the members marked {k} need a tie: words a reader can see in each of them")),
                Some(t) => {
                    for w in words {
                        if fig::whole_words(w, t).next().is_none() {
                            c.fail(&at, format_args!("tie {t:?} is not in {w:?}, as whole words"));
                        }
                    }
                }
            }
        }
    }

    // Quotations in the structure's own words, against every verse it names.
    let texts: Vec<String> = named.iter().map(|&(a, z)| fig::normalize(&c.src.text[a as usize..=z as usize].join(" "))).collect();
    let mut fields = vec![("short", s.short.as_str()), ("about", s.about.as_str()), ("evidence", s.evidence.as_str())];
    if let Some(l) = &s.limit {
        fields.push(("limit", l.as_str()));
    }
    for side in &s.sides {
        fields.push(("side label", side.label.as_str()));
    }
    for (field, t) in fields {
        match fig::quotes(t) {
            Err(e) => c.fail(&at, format_args!("{field}: {e}")),
            Ok(qs) => {
                for q in qs.into_iter().filter(|q| fig::word_count(q) >= fig::QUOTE_MIN_WORDS) {
                    if !texts.iter().any(|x| fig::contains(x, q)) {
                        c.fail(&at, format_args!("{field}: quotation {q:?} is not in the BSB text of the verses the structure names"));
                    }
                }
            }
        }
    }

    // Citations, as in figures; the strength follows from the writers.
    let mut cites = Vec::new();
    let mut writers = BTreeSet::new();
    let mut seen = BTreeSet::new();
    if s.cites.is_empty() {
        c.fail(&at, "cites nothing; every structure cites an interpreter on the cite list");
    }
    for (i, ct) in s.cites.iter().enumerate() {
        let cat = format!("{at}, cites[{i}]");
        if !seen.insert(ct.source.as_str()) {
            c.fail(&cat, format_args!("{:?} is cited twice; quote it once", ct.source));
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
    if !s.cites.is_empty() && writers.is_empty() {
        c.fail(&at, "cites no interpreter; a word book or the BSB alone cannot carry a structure");
    } else if !s.cites.is_empty() && s.strength != want {
        c.fail(&at, format_args!("strength is {:?}, but it cites {} different interpreters, which is {want:?}", s.strength, writers.len()));
    }

    ranges.sort_unstable();
    ranges.dedup();
    let v = ranges.iter().map(|r| r.0).min()?;
    let end = ranges.iter().map(|r| r.1).max()?;
    let mut books: Vec<u8> = Vec::new();
    for &(a, z) in &ranges {
        for x in [a, z] {
            let b = c.src.vz.locate(x)?.0;
            if !books.contains(&b) {
                books.push(b);
            }
        }
    }
    books.sort_unstable();
    let mut out = json!({
        "id": s.id, "kind": s.kind, "v": v, "end": end, "r": ranges.iter().map(|&(a, z)| [a, z]).collect::<Vec<_>>(),
        "strength": s.strength, "writers": writers.len(), "short": s.short, "about": s.about,
        "evidence": s.evidence, "checked": s.checked, "cites": cites,
    });
    if !out_members.is_empty() {
        out["members"] = json!(out_members);
    }
    if !out_sides.is_empty() {
        out["sides"] = json!(out_sides);
    }
    if let Some(l) = &s.limit {
        out["limit"] = json!(l);
    }
    Some((out, books))
}

/// Read and check the structures; the files to write under web/public/data.
pub fn build(root: &Path, src: &Sources) -> Result<Vec<(String, Vec<u8>)>, String> {
    let text = fs::read_to_string(root.join(CONFIG)).map_err(|e| format!("reading {CONFIG}: {e}"))?;
    let file: File = serde_json::from_str(&text).map_err(|e| format!("parsing {CONFIG}: {e}"))?;
    let cite = CiteList::read(root)?;
    let quotable = fig::quotable(root)?;
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
    for s in &file.structures {
        if let Some(x) = structure(&mut c, s, &mut ids) {
            notes.push(x);
        }
    }
    if let Some(e) = c.errors.into_iter().next() {
        return Err(e);
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
    eprintln!("structure: {} structures checked and written ({}) in {} book files", notes.len(), summary.join(", "), out.len());
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
    out.push((kinds_ok, format!("structure: {OUT} describes all {} kinds", KINDS.len())));
    let mut files_ok = !rows.is_empty();
    let mut ranges_ok = true;
    for r in &rows {
        for pair in r["r"].as_array().into_iter().flatten() {
            let (a, z) = (pair[0].as_u64().unwrap_or(u64::MAX), pair[1].as_u64().unwrap_or(u64::MAX));
            ranges_ok &= a <= z && z < n;
        }
        for b in r["b"].as_array().into_iter().flatten() {
            let part = read(&d.dir.join(format!("{PARTS}/{}.json", b.as_str().unwrap_or_default())));
            files_ok &= part.is_ok_and(|p| p["notes"].as_array().is_some_and(|ns| ns.iter().any(|x| x["id"] == r["id"])));
        }
    }
    out.push((files_ok, format!("structure: {} structures, each in the file of every book it touches", rows.len())));
    out.push((ranges_ok, "structure: every range names verses of the Bible, first to last".to_string()));
    // Pinned: Psalm 8 opens and closes with the same words, at 8:1 and 8:9.
    let ps = BOOKS.iter().position(|b| b.osis == "Ps").unwrap_or(0) as u8;
    let want = [d.vz.index(ps, 8, 1), d.vz.index(ps, 8, 9)];
    let pinned = read(&d.dir.join(format!("{PARTS}/Ps.json"))).is_ok_and(|p| {
        p["notes"].as_array().into_iter().flatten().any(|x| {
            x["id"] == "psalm-8-bookends"
                && x["members"].as_array().is_some_and(|ms| {
                    ms.len() == 2 && ms.iter().zip(want).all(|(m, w)| w.is_some_and(|w| m["v"].as_u64() == Some(w as u64)))
                })
        })
    });
    out.push((pinned, "structure: Psalm 8's bookends found at 8:1 and 8:9".to_string()));
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checks_marks_by_kind() {
        assert!(marks_ok("inclusio", &["A", "A'"]).is_ok());
        assert!(marks_ok("inclusio", &["A", "B"]).is_err());
        assert!(marks_ok("refrain", &["R", "R", "R"]).is_ok());
        assert!(marks_ok("refrain", &["R"]).is_err());
        assert!(marks_ok("alternation", &["A", "B", "A", "B", "A"]).is_ok());
        assert!(marks_ok("alternation", &["A", "B", "C", "A", "B", "C"]).is_ok());
        assert!(marks_ok("alternation", &["A", "B", "B", "A"]).is_err());
        assert!(marks_ok("alternation", &["A", "B", "A"]).is_err());
        assert!(marks_ok("chiasm", &["A", "B", "B'", "A'"]).is_ok());
        assert!(marks_ok("chiasm", &["A", "B", "X", "B'", "A'"]).is_ok());
        assert!(marks_ok("chiasm", &["A", "B", "A'", "B'"]).is_err());
        assert!(marks_ok("chiasm", &["a", "a'"]).is_err());
    }

    #[test]
    fn groups_members_that_answer_one_another() {
        assert_eq!(group("chiasm", "B'"), "B");
        assert_eq!(group("alternation", "A"), "A");
        assert_eq!(group("refrain", "R"), "R");
    }
}
