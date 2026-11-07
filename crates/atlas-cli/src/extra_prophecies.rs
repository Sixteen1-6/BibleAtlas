//! Prophecy and fulfilment: Old Testament passages paired with the New
//! Testament passages that fulfil them, written in `config/prophecies.json`
//! and checked here before anything is written:
//!
//! 1. every reference names BSB verses, each pair's `ot` in the Old Testament
//!    and its `nt` in the New, and no pair is listed twice;
//! 2. `says`, where a pair has it, is the New Testament's own words that the
//!    passage was fulfilled, foretold or spoken of ("This was to fulfill what
//!    was spoken through the prophet Isaiah"): word for word in the BSB text
//!    of its verse, which is in the New Testament passage's chapter (from six
//!    verses before it; Matthew 26:56 says of 26:31 that it was fulfilled),
//!    and holding one of the words in [`CUES`];
//! 3. every cite is a Christian writer on the cite list in
//!    `config/layer-sources.json` whose public-domain text the build reads
//!    ([`WORKS`]), and its `quote` is found word for word (spaces aside) in
//!    that writer's note on `on`, a verse of one side of the pair; the quote
//!    holds a prophecy word ([`PROPHECY`]). The cite list says who wrote the
//!    words on each book (decision 10), as Layers and Figures credit them,
//!    and its `denies` leaves words out. A Church Father in the Catena Aurea
//!    is named by the Catena itself and must be one of [`FATHERS`];
//! 4. a pair has `says`, at least one cite, or both. Its strength is the
//!    number of different writers among its cites (3 or more "widely
//!    agreed", 2 "commonly held", 1 "some interpreters"), one writer's two
//!    works counting once, an abridgment as the writer it abridges.
//!
//! Output, under `web/public/data/`:
//! - `extras/prophecies.json`: `{format, pairs}`, each pair
//!   `[otFrom, otTo, ntFrom, ntTo, says, writers]`: verse indices, `says` 1
//!   when the New Testament says so in its own words, `writers` the number of
//!   different writers. Small, as it loads with the reader's first move.
//! - `extras/prophecies/notes.json`: `{format, notes}`, one per pair in the
//!   same order, `{says?: [verse, words], cites: [...]}`, a cite being
//!   `{by, writer, work, when, key, on: [from, to], quote, url, read,
//!   retrieved, edition?, label?}`. Loaded when a panel opens.

use crate::layers::{ai_credit_in, CiteList};
use crate::loaded::Loaded;
use crate::sources::Inputs;
use atlas_core::canon::{BOOKS, FIRST_NT_BOOK};
use atlas_core::{refs, Versification};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeSet, HashSet};
use std::fs;
use std::path::Path;

const CONFIG: &str = "config/prophecies.json";
const OUT: &str = "extras/prophecies.json";
const NOTES: &str = "extras/prophecies/notes.json";

/// The New Testament's words that say a passage was fulfilled or foretold.
const CUES: &[&str] = &["fulfill", "fulfilled", "foretold", "foreseeing", "prophesied", "prophecy", "spoken of", "written about", "spoke about", "about whom it is written", "this is what was spoken"];
/// A writer's word that the passage foretold what came.
const PROPHECY: &[&str] = &["fulfil", "prophec", "prophesi", "prophesy", "prophetical", "foretold", "foretel", "predict", "foreshew", "foreshow"];

/// The works whose words the build reads: (cite id, sources.json id, file key,
/// the copy's name in a credit).
const WORKS: &[(&str, &str, &str, &str)] = &[
    ("henry", "henry-complete", "mhc", "the CrossWire SWORD module MHC, as kept in the Let's Church repository (commit 71f6f0f)"),
    ("calvin", "calvin-commentaries", "calvin", "the CrossWire SWORD module Calvin, as kept in the Let's Church repository (commit 71f6f0f)"),
];
const CATENA: &str = "catena-aurea";
const CATENA_READ: &str = "the Catena corpus, github.com/AlvaroBalbin/catena (commit efe1bd0)";
const CATENA_COMMIT: &str = "efe1bd084d918a34ca22ffeef2ecf711c593b392";
const GOSPELS: [(&str, u8); 4] = [("matthew", 39), ("mark", 40), ("luke", 41), ("john", 42)];
/// The Church Fathers whose words in the Catena may be counted: named writers
/// who held the Scriptures to be God's word. Writers the app hides or whose
/// names are uncertain (Origen, Didymus, the writers once taken for
/// Chrysostom, Jerome or Augustine, the Gloss) are not among them.
const FATHERS: &[&str] = &[
    "Chrysostom", "Augustine", "Bede", "Theophylact", "Jerome", "Ambrose", "Gregory", "Hilary", "Cyril of Alexandria", "Remigius", "Rabanus", "Alcuin", "Basil",
    "Gregory of Nyssa", "Titus Bostrensis", "Athanasius", "Leo", "Chrysologus", "Gregory Nazianzen", "Cyprian", "Damascene",
];

const QUOTE_MIN: usize = 20;
const QUOTE_MAX: usize = 400;

#[derive(Deserialize)]
struct File {
    retrieved: String,
    pairs: Vec<Pair>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Pair {
    ot: String,
    nt: String,
    #[serde(default)]
    says: Option<Says>,
    #[serde(default)]
    cites: Vec<Cite>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Says {
    #[serde(rename = "ref")]
    at: String,
    words: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Cite {
    source: String,
    on: String,
    quote: String,
    #[serde(default)]
    father: Option<String>,
}

/// One writer's note: the verses it covers and its words, spaces made single.
struct Note {
    from: u32,
    to: u32,
    who: String,
    text: String,
}

fn squash(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// A Let's Church body with its marked references shown as their words.
fn shown(body: &str) -> String {
    let mut out = String::with_capacity(body.len());
    let mut rest = body;
    while let Some(i) = rest.find("{{ref:") {
        out.push_str(&rest[..i]);
        let after = &rest[i..];
        match (after.find('|'), after.find("}}")) {
            (Some(bar), Some(end)) if bar < end => {
                out.push_str(&after[bar + 1..end]);
                rest = &after[end + 2..];
            }
            _ => {
                out.push_str(after);
                rest = "";
            }
        }
    }
    out.push_str(rest);
    squash(&out)
}

fn usfm_book(code: &str) -> Option<u8> {
    const USFM: [&str; 66] = [
        "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK",
        "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH",
        "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
    ];
    USFM.iter().position(|c| *c == code).map(|i| i as u8)
}

fn read_lets_church(path: &Path, vz: &Versification) -> Result<Vec<Note>, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let v: Value = serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))?;
    let mut out = Vec::new();
    for e in v["entries"].as_array().into_iter().flatten() {
        let Some(b) = e["book"].as_str().and_then(usfm_book) else { continue };
        let c = e["chapter"].as_u64().unwrap_or(0) as u16;
        let s = e["verse"].as_u64().unwrap_or(0) as u16;
        if s == 0 {
            continue;
        }
        let end = e["verseEnd"].as_u64().map_or(s, |x| x as u16).max(s);
        let Some(from) = vz.index(b, c, s) else { continue };
        let to = vz.index(b, c, end).unwrap_or(from);
        out.push(Note { from, to, who: String::new(), text: shown(e["body"].as_str().unwrap_or("")) });
    }
    Ok(out)
}

fn read_catena(inputs: &Inputs, vz: &Versification) -> Result<Vec<Note>, String> {
    let mut out = Vec::new();
    for (key, book) in GOSPELS {
        let path = inputs.path(CATENA, key);
        let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
        for line in text.lines().filter(|l| !l.trim().is_empty()) {
            let r: Value = serde_json::from_str(line).map_err(|e| format!("{CATENA} {key}: {e}"))?;
            for k in r["commented_verse_keys"].as_array().into_iter().flatten().filter_map(Value::as_str) {
                let mut it = k.split('/').skip(1).map(|n| n.parse::<u16>().ok());
                let (Some(Some(c)), Some(Some(v))) = (it.next(), it.next()) else { continue };
                let Some(at) = vz.index(book, c, v) else { continue };
                for s in r["segments"].as_array().into_iter().flatten() {
                    out.push(Note { from: at, to: at, who: s["father"].as_str().unwrap_or("").trim().to_string(), text: squash(s["text"].as_str().unwrap_or("")) });
                }
            }
        }
    }
    Ok(out)
}

fn has_word(s: &str, list: &[&str]) -> bool {
    let low = s.to_lowercase();
    list.iter().any(|w| low.match_indices(w).any(|(i, _)| !low[..i].chars().next_back().is_some_and(char::is_alphanumeric)))
}

fn overlap(a: (u32, u32), b: (u32, u32)) -> bool {
    a.0 <= b.1 && b.0 <= a.1
}

fn strength(writers: usize) -> &'static str {
    match writers {
        0 => "",
        1 => "some interpreters",
        2 => "commonly held",
        _ => "widely agreed",
    }
}

/// Read and check the pairs; the files to write under web/public/data.
pub fn build(root: &Path, inputs: &Inputs, vz: &Versification, bsb_text: &[String]) -> Result<Vec<(String, Vec<u8>)>, String> {
    let text = fs::read_to_string(root.join(CONFIG)).map_err(|e| format!("reading {CONFIG}: {e}"))?;
    let file: File = serde_json::from_str(&text).map_err(|e| format!("parsing {CONFIG}: {e}"))?;
    let cite = CiteList::read(root)?;
    let quotable = crate::extra_figures::quotable(root)?;
    let mut texts: Vec<(&str, &str, Vec<Note>)> = Vec::new();
    for (id, src, key, read) in WORKS {
        texts.push((id, read, read_lets_church(&inputs.path(src, key), vz)?));
    }
    texts.push((CATENA, CATENA_READ, read_catena(inputs, vz)?));
    let first_nt = vz.index(FIRST_NT_BOOK, 1, 1).ok_or("no New Testament")?;

    let mut errors: Vec<String> = Vec::new();
    let range = |r: &str, errors: &mut Vec<String>, at: &str| -> Option<(u32, u32)> {
        let found = refs::parse(r).and_then(|q| refs::resolve(q, vz));
        if found.is_none() {
            errors.push(format!("{at}: {r:?} does not name verses in the BSB"));
        }
        found
    };
    if file.retrieved.len() != 10 || !file.retrieved.chars().enumerate().all(|(i, c)| if i == 4 || i == 7 { c == '-' } else { c.is_ascii_digit() }) {
        errors.push(format!("{CONFIG}: retrieved {:?} must be a date, as 2026-11-01", file.retrieved));
    }
    let mut seen = HashSet::new();
    let mut index = Vec::new();
    let mut notes = Vec::new();
    let (mut said, mut by_writers) = (0, [0usize; 4]);
    for (i, p) in file.pairs.iter().enumerate() {
        let at = format!("{CONFIG}: pair {} ({} and {})", i + 1, p.ot, p.nt);
        let (Some(ot), Some(nt)) = (range(&p.ot, &mut errors, &at), range(&p.nt, &mut errors, &at)) else { continue };
        if ot.1 >= first_nt {
            errors.push(format!("{at}: ot must be in the Old Testament"));
        }
        if nt.0 < first_nt {
            errors.push(format!("{at}: nt must be in the New Testament"));
        }
        if !seen.insert((ot, nt)) {
            errors.push(format!("{at}: this pair is listed twice"));
        }
        let mut note = serde_json::Map::new();
        if let Some(s) = &p.says {
            if let Some((v, z)) = range(&s.at, &mut errors, &at) {
                let (here, start) = (vz.locate(v).map(|x| (x.0, x.1)), vz.locate(nt.0).map(|x| (x.0, x.1)));
                let near = here.is_some() && here == start && v + 6 >= nt.0;
                if v != z || !near {
                    errors.push(format!("{at}: says.ref must be one verse in the New Testament passage's chapter, at most six verses before it"));
                } else if !bsb_text[v as usize].contains(&s.words) {
                    errors.push(format!("{at}: says.words are not word for word in the BSB text of {}", s.at));
                } else if !has_word(&s.words, CUES) {
                    errors.push(format!("{at}: says.words must say the passage was fulfilled, foretold or spoken of"));
                }
                note.insert("says".into(), json!([v, s.words]));
            }
        }
        let mut keys = BTreeSet::new();
        let mut cites = Vec::new();
        for (k, c) in p.cites.iter().enumerate() {
            let at = format!("{at}, cite {}", k + 1);
            let Some(on) = range(&c.on, &mut errors, &at) else { continue };
            if !overlap(on, ot) && !overlap(on, nt) {
                errors.push(format!("{at}: on {} is on neither side of the pair", c.on));
                continue;
            }
            let quote = squash(&c.quote);
            if quote.chars().count() < QUOTE_MIN || quote.chars().count() > QUOTE_MAX {
                errors.push(format!("{at}: quote must be {QUOTE_MIN} to {QUOTE_MAX} characters"));
            }
            if !has_word(&quote, PROPHECY) {
                errors.push(format!("{at}: quote must say the passage was foretold or fulfilled"));
            }
            if !quotable.contains(&c.source) {
                errors.push(format!("{at}: {} is not quotable in config/figure-forms.json, so its words are not shown", c.source));
                continue;
            }
            let Some((_, read, ns)) = texts.iter().find(|(id, _, _)| *id == c.source) else {
                errors.push(format!("{at}: {:?} is not a work the build reads ({})", c.source, WORKS.iter().map(|w| w.0).chain([CATENA]).collect::<Vec<_>>().join(", ")));
                continue;
            };
            let father = c.father.as_deref().unwrap_or("");
            if (c.source == CATENA) != !father.is_empty() {
                errors.push(format!("{at}: a Catena cite names its father, and only a Catena cite does"));
                continue;
            }
            if c.source == CATENA && !FATHERS.contains(&father) {
                errors.push(format!("{at}: {father:?} is not among the Church Fathers counted here"));
                continue;
            }
            if !ns.iter().any(|n| overlap((n.from, n.to), on) && n.who == father && n.text.contains(&quote)) {
                errors.push(format!("{at}: the quote is not word for word in {}'s note on {}", c.source, c.on));
                continue;
            }
            let place = vz.locate(on.0).ok_or("no place")?;
            for (o, why) in cite.denials(&c.source) {
                if refs::parse(o).and_then(|q| refs::resolve(q, vz)).is_some_and(|r| overlap(r, on)) {
                    errors.push(format!("{at}: these words are left out: {why}"));
                }
            }
            let book = BOOKS[place.0 as usize].name;
            if let Some(l) = cite.source(&c.source).filter(|l| l.not_on.iter().any(|b| b == book)) {
                errors.push(format!("{at}: {} is not cited on {book}: {}", l.name, l.why));
                continue;
            }
            let mut x = if c.source == CATENA {
                let (key, _) = GOSPELS.iter().find(|(_, b)| *b == place.0).copied().unwrap_or(("matthew", 39));
                json!({
                    "by": format!("{father}, as Thomas Aquinas gathered his words"), "writer": father, "work": "Catena Aurea", "when": "1260s; this translation 1841 to 1845",
                    "edition": "Oxford translation edited by John Henry Newman", "key": format!("father:{father}"),
                    "url": format!("https://github.com/AlvaroBalbin/catena/blob/{CATENA_COMMIT}/data/catena/{key}.jsonl"),
                })
            } else {
                let who = match cite.who_wrote(&c.source, Some(book), place.1, None) {
                    Ok(w) => w,
                    Err(e) => {
                        errors.push(format!("{at}: {e}"));
                        continue;
                    }
                };
                let Some(url) = cite.chapter_page(&c.source, place.0, place.1) else {
                    errors.push(format!("{at}: no chapter page for {}", c.source));
                    continue;
                };
                let by = match (&who.about, who.several) {
                    (Some(a), false) => format!("{}, {a}", who.writer),
                    _ => who.writer.clone(),
                };
                let mut x = json!({ "by": by, "writer": who.writer, "work": who.work, "when": who.written, "key": who.key, "url": url });
                for (k, v) in [("edition", &who.edition), ("label", &who.label)] {
                    if let Some(v) = v {
                        x[k] = json!(v);
                    }
                }
                x
            };
            keys.insert(x["key"].as_str().unwrap_or_default().to_string());
            x["on"] = json!([on.0, on.1]);
            x["quote"] = json!(quote);
            x["read"] = json!(read);
            x["retrieved"] = json!(file.retrieved);
            cites.push(x);
        }
        if p.says.is_none() && p.cites.is_empty() {
            errors.push(format!("{at}: a pair needs the New Testament's own words (says) or a writer who states it (cites)"));
        }
        note.insert("cites".into(), Value::Array(cites));
        let note = Value::Object(note);
        if let Some((path, phrase)) = ai_credit_in(&note, &at) {
            errors.push(format!("{path}: credits a drafting tool ({phrase})"));
        }
        said += usize::from(p.says.is_some());
        by_writers[keys.len().min(3)] += 1;
        index.push(json!([ot.0, ot.1, nt.0, nt.1, u8::from(p.says.is_some()), keys.len()]));
        notes.push(note);
    }
    if !errors.is_empty() {
        let n = errors.len();
        errors.truncate(30);
        return Err(format!("{CONFIG}: {n} problems:\n  {}", errors.join("\n  ")));
    }
    eprintln!(
        "prophecies: {} pairs, {said} said so by the New Testament itself; by writers: {} {}, {} {}, {} {}, {} with none",
        index.len(),
        by_writers[3],
        strength(3),
        by_writers[2],
        strength(2),
        by_writers[1],
        strength(1),
        by_writers[0]
    );
    let bytes = |v: &Value| serde_json::to_vec(v).map_err(|e| e.to_string());
    Ok(vec![
        (OUT.to_string(), bytes(&json!({ "format": 1, "pairs": index }))?),
        (NOTES.to_string(), bytes(&json!({ "format": 1, "notes": notes }))?),
    ])
}

// ---------------------------------------------------------------- verify

pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let read = |rel: &str| -> Result<Value, String> {
        let p = d.dir.join(rel);
        serde_json::from_str(&fs::read_to_string(&p).map_err(|e| format!("reading {}: {e}", p.display()))?).map_err(|e| format!("parsing {}: {e}", p.display()))
    };
    let index = read(OUT)?;
    let notes = read(NOTES)?;
    let pairs = index["pairs"].as_array().cloned().unwrap_or_default();
    let notes = notes["notes"].as_array().cloned().unwrap_or_default();
    let first_nt = d.vz.index(FIRST_NT_BOOK, 1, 1).unwrap_or(0) as u64;
    let n = d.vz.verse_count() as u64;
    let mut shape = pairs.len() == notes.len() && !pairs.is_empty();
    let mut counted = true;
    for (p, note) in pairs.iter().zip(&notes) {
        let v: Vec<u64> = p.as_array().into_iter().flatten().filter_map(Value::as_u64).collect();
        shape &= v.len() == 6 && v[0] <= v[1] && v[1] < first_nt && first_nt <= v[2] && v[2] <= v[3] && v[3] < n && v[4] <= 1;
        let cites = note["cites"].as_array().cloned().unwrap_or_default();
        let keys: BTreeSet<&str> = cites.iter().filter_map(|c| c["key"].as_str()).collect();
        counted &= v.get(5) == Some(&(keys.len() as u64))
            && (v.get(4) == Some(&1)) == note.get("says").is_some()
            && (v[4] == 1 || !cites.is_empty())
            && cites.iter().all(|c| ["by", "writer", "work", "when", "quote", "read", "retrieved"].iter().all(|k| c[k].as_str().is_some_and(|s| !s.is_empty())) && c["url"].as_str().is_some_and(|u| u.starts_with("https://")));
    }
    let (isa, _) = d.resolve("Isaiah 7:14")?;
    let (mat, _) = d.resolve("Matthew 1:23")?;
    let known = pairs.iter().any(|p| p[0] == isa && p[2] == mat && p[4] == 1);
    Ok(vec![
        (shape, format!("prophecies: {} pairs, each an Old Testament passage and a New Testament one, with its notes", pairs.len())),
        (counted, "prophecies: each pair's writer count matches its cites, and each pair rests on the New Testament's words or a writer's".to_string()),
        (known, "prophecies: Isaiah 7:14 is fulfilled in Matthew 1:23, as Matthew 1:22 says".to_string()),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shows_marked_references_as_their_words() {
        assert_eq!(shown("was fulfilled, {{ref:Hosea 11:1|Hosea 11:1}}.\n  Out"), "was fulfilled, Hosea 11:1. Out");
        assert_eq!(shown("no marks"), "no marks");
    }

    #[test]
    fn finds_prophecy_words_at_word_starts() {
        assert!(has_word("as was foretold concerning him", PROPHECY));
        assert!(has_word("This fulfilled what the Lord had spoken", CUES));
        assert!(!has_word("the prophet Isaiah", PROPHECY));
        assert!(!has_word("unfulfilled", PROPHECY));
    }
}
