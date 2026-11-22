//! Figures seen in the words, at Deep: places where the Bible's own words
//! show a figure that no cited writer names. Shubhanshu chose to show them
//! on 2026-11-14 ("Words too, every figure"), marked "seen in the words",
//! with no strength label and no source, behind the commentary notice like
//! every figure. They are written in `config/figures-seen/<OSIS>.json`
//! (`{notes: [...]}`, one file per book), apart from the cited notes in
//! `config/figures/`, so each set is held to its own rules.
//!
//! A place is `{id, form, ref, words, original?, methods, checked}`, and it
//! carries nothing else: a cite, a strength, an about, an evidence, a limit
//! or a short is refused, since nobody's name stands behind it. The checks:
//!
//! 1. `ref` names verses of its file's book, inside one chapter, written as
//!    the app names them ("Genesis 4:23", "Psalm 1:1-3": the book's name, or
//!    "Psalm" for one psalm, the chapter, the first verse and any last verse),
//!    and `id` is "<ref-slug>-<form>-seen", the slug naming the first verse.
//!    Each id is used once, so a verse has one place of each form;
//! 2. `form` is a form in `config/figure-forms.json`, whose kind decides how
//!    the place is marked;
//! 3. every entry of `words` is the BSB text of a verse of the place, exactly.
//!    The display marks an entry where it first occurs in each verse of the
//!    place that holds it, so it is checked there: it begins and ends with
//!    whole words, and it overlaps no other entry. No entry repeats, and none
//!    starts with a space, stray punctuation, a dash, a closing quotation
//!    mark or a bracket (", should you" marks more than the words). The first
//!    and the last verse of the place each hold an entry, so the place is no
//!    wider than its words;
//! 4. parallel lines (the place's kind is parallelism) have two or more
//!    entries, and a mirror or an alternation four or more. A refrain may be
//!    one line, where the same words come back in another verse of the book,
//!    and a frame one entry, where its first and last verse both hold it.
//!    Where the BSB sets a verse as poetry, an entry of parallel lines is one
//!    of its lines, part of one, or whole lines together, and for the forms
//!    that set line against line (same, opposite, building, climbing) every
//!    word of every entry is in the BSB's own poetry lines (no prose, no
//!    psalm's title) and no two entries share a line;
//! 5. every Strong's tag in `original` (STEPBible's, as H5315J) is the root
//!    of a main-text word in the verses of the place, in the verse's own word
//!    list;
//! 6. `methods` names how the place was found (the BSB words, the Hebrew or
//!    Greek words, a list of places known by name, or Bullinger's list), kept
//!    for the record and never written out; `checked` is the date the place
//!    was read against its verse.
//!
//! The build cannot judge whether a verse plainly shows its figure; every
//! place is read against the BSB before it is added. A place is dropped, and
//! counted, where a cited note has the same form on a verse it covers, so
//! the cited note wins and nothing shows twice.
//!
//! Output, under `web/public/data/`:
//! - `extras/figures-seen.json`: `{format, has, books}`, `has` holding one
//!   character per verse, '0' plus the bits of `extras/figures.json`
//!   (1 parallelism, 2 figure, 4 contrast) for the kinds of the places on it,
//!   and `books` the OSIS names of the books with a file of places, in
//!   order. `atlas verify` reads only those, so a file an earlier build left
//!   in the folder is never taken for this build's.
//! - `extras/figures-seen/<OSIS>.json`, for each book with places: `{format,
//!   notes}`, in order of first verse and then id. A note is `{id, form, v,
//!   e?, words, original?, whole?}`: `v` is a verse index, `e` the last verse
//!   of a range (only a range has it), `words` the BSB words to mark, each
//!   the text of one verse from `v` to `e`, `original` the Strong's tags,
//!   and `whole` true when the one entry is the whole verse. The form's
//!   label and definition come from `extras/figures.json`.

use super::{date_ok, lemma_matches, Check, FORMS, KINDS, LINE_FORMS};
use crate::loaded::Loaded;
use atlas_core::BOOKS;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

pub const DIR: &str = "config/figures-seen";
const OUT: &str = "extras/figures-seen.json";
const PARTS: &str = "extras/figures-seen";
/// How a place may have been found: the BSB words, the Hebrew or Greek words,
/// a list of places known by name, Bullinger's own list.
const METHODS: [&str; 4] = ["bsb", "orig", "list", "bullinger"];
/// The keys a built place may have.
const KEYS: [&str; 7] = ["id", "form", "v", "e", "words", "original", "whole"];
/// What a marked entry may not start with: a search's cut just after a
/// comma, a dash or a closing quotation mark marks more than the words.
const STRAY: &str = ",.;:!?—–-”’)]";

/// Whether an entry starts with a space or stray punctuation.
fn stray(w: &str) -> bool {
    w.starts_with(|c: char| c.is_whitespace() || STRAY.contains(c))
}

/// Whether `text[at..at + len]` begins and ends with whole words.
fn whole_words(text: &str, at: usize, len: usize) -> bool {
    let before = text[..at].chars().next_back();
    let after = text[at + len..].chars().next();
    !before.is_some_and(char::is_alphanumeric) && !after.is_some_and(char::is_alphanumeric)
}

/// A reference as the app writes it: the book's name ("Psalm" for one
/// psalm), the chapter, the first verse and any last verse.
fn ref_name(book: u8, chapter: u16, first: u16, last: u16) -> String {
    let b = &BOOKS[book as usize];
    let name = if b.osis == "Ps" { "Psalm" } else { b.name };
    if last > first {
        format!("{name} {chapter}:{first}-{last}")
    } else {
        format!("{name} {chapter}:{first}")
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SeenFile {
    #[serde(default, rename = "_comment")]
    _comment: Vec<String>,
    notes: Vec<Place>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Place {
    id: String,
    form: String,
    #[serde(rename = "ref")]
    reference: String,
    words: Vec<String>,
    #[serde(default)]
    original: Vec<String>,
    methods: Vec<String>,
    /// When the place was read against its verse, as 2026-11-14.
    checked: String,
}

/// The id a place on `reference` in `form` must have: the first verse,
/// lowercased, with every run of other characters a hyphen.
fn id_for(reference: &str, form: &str) -> String {
    let first = match reference.find(':') {
        Some(i) => match reference[i..].find('-') {
            Some(j) => &reference[..i + j],
            None => reference,
        },
        None => reference,
    };
    let mut slug = String::new();
    for c in first.chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c.to_ascii_lowercase());
        } else if !slug.is_empty() && !slug.ends_with('-') {
            slug.push('-');
        }
    }
    format!("{}-{form}-seen", slug.trim_end_matches('-'))
}

/// H or G, four digits and at most one letter, as STEPBible tags a root.
fn tag_ok(s: &str) -> bool {
    let b = s.as_bytes();
    (b.len() == 5 || b.len() == 6)
        && (b[0] == b'H' || b[0] == b'G')
        && b[1..5].iter().all(u8::is_ascii_digit)
        && b[5..].iter().all(u8::is_ascii_alphabetic)
}

impl Check<'_> {
    /// Whether a refrain's one line comes back: its words are in two verses
    /// of the place, or in a verse of the book outside it.
    fn comes_back(&self, book: u8, s: u32, e: u32, words: &[String]) -> bool {
        let [w] = words else { return false };
        let holds = |v: u32| self.src.text[v as usize].contains(w.as_str());
        let start = self.src.vz.book_start(book);
        let end = if (book as usize) + 1 < BOOKS.len() { self.src.vz.book_start(book + 1) } else { self.src.vz.verse_count() };
        !w.trim().is_empty() && ((s..=e).filter(|&v| holds(v)).count() >= 2 || (start..end).any(|v| (v < s || v > e) && holds(v)))
    }

    fn seen(&mut self, book: u8, p: &Place, ids: &mut BTreeSet<String>) -> Option<(Value, u8)> {
        let at = format!("{DIR}/{}.json: place {:?}", BOOKS[book as usize].osis, p.id);
        let want = id_for(&p.reference, &p.form);
        if p.id != want {
            self.fail(&at, format_args!("id must be {want:?}, from its first verse and form"));
        }
        if !ids.insert(p.id.clone()) {
            self.fail(&at, "id is used by an earlier place");
        }
        let kind = match self.forms.get(&p.form) {
            None => {
                self.fail(&at, format_args!("form {:?} is not in {FORMS}", p.form));
                None
            }
            Some(f) => Some(f.kind.clone()),
        };
        let bit = kind.as_deref().and_then(|k| KINDS.iter().find(|(x, _)| *x == k)).map(|(_, b)| *b);
        if p.methods.is_empty() {
            self.fail(&at, format_args!("methods must name how the place was found: {}", METHODS.join(", ")));
        }
        let mut methods = BTreeSet::new();
        for m in &p.methods {
            if !METHODS.contains(&m.as_str()) {
                self.fail(&at, format_args!("method {m:?} is not one of: {}", METHODS.join(", ")));
            }
            if !methods.insert(m.as_str()) {
                self.fail(&at, format_args!("method {m:?} is listed twice"));
            }
        }
        if !date_ok(&p.checked) {
            self.fail(&at, format_args!("checked {:?} must be a date, as 2026-11-14", p.checked));
        }

        let own = self.range(&at, &p.reference);
        if let Some((s, e)) = own {
            let (b, c, first) = self.src.vz.locate(s)?;
            if b != book {
                self.fail(&at, format_args!("{:?} is not in {}", p.reference, BOOKS[book as usize].name));
            }
            match self.src.vz.locate(e) {
                Some((_, ec, last)) if ec == c => {
                    let want = ref_name(b, c, first, last);
                    if p.reference != want {
                        self.fail(&at, format_args!("ref must be written {want:?}, as the app names the verses"));
                    }
                }
                _ => self.fail(&at, format_args!("{:?} crosses a chapter; a place sits in one chapter", p.reference)),
            }
        }
        let (s, e) = own?;

        // Words: the BSB text of a verse of the place, each entry once,
        // checked where the display marks it: where it first occurs in each
        // verse that holds it.
        if p.words.is_empty() {
            self.fail(&at, "words must list the BSB words that show the figure");
        }
        let mut lines = Vec::new();
        let mut spans: BTreeMap<u32, Vec<(usize, usize, usize)>> = BTreeMap::new();
        let mut distinct = BTreeSet::new();
        for (i, w) in p.words.iter().enumerate() {
            let wat = format!("{at}, words[{i}]");
            if !distinct.insert(w.as_str()) {
                self.fail(&wat, format_args!("{w:?} is listed twice"));
            }
            if stray(w) {
                self.fail(&wat, format_args!("{w:?} starts with a space or stray punctuation; mark the words themselves"));
            }
            let found: Vec<(u32, usize)> =
                if w.trim().is_empty() { Vec::new() } else { (s..=e).filter_map(|v| self.src.text[v as usize].find(w.as_str()).map(|o| (v, o))).collect() };
            if found.is_empty() {
                self.fail(&wat, format_args!("{w:?} is not the BSB text of {}", p.reference));
            }
            for &(v, o) in &found {
                if !whole_words(&self.src.text[v as usize], o, w.len()) {
                    self.fail(&wat, format_args!("{w:?} starts or ends inside a word; mark whole words"));
                }
                spans.entry(v).or_default().push((o, o + w.len(), i));
                lines.push(json!({ "v": v, "t": w }));
            }
        }
        for marked in spans.values_mut() {
            marked.sort_unstable();
            for pair in marked.windows(2) {
                if pair[1].0 < pair[0].1 {
                    self.fail(&at, format_args!("words[{}] and words[{}] overlap; mark each part once", pair[0].2, pair[1].2));
                }
            }
        }
        if !spans.is_empty() && !(spans.contains_key(&s) && spans.contains_key(&e)) {
            self.fail(&at, format_args!("the words must begin in the first verse of {:?} and end in its last; give ref as the verses the words are in", p.reference));
        }
        if kind.as_deref() == Some("parallelism") {
            let least = match p.form.as_str() {
                "mirror" | "turns" => 4,
                // A refrain's one line comes back in another verse of the book.
                "refrain" if self.comes_back(book, s, e, &p.words) => 1,
                // A frame's one entry opens and closes it.
                "frame" if e > s && p.words.len() == 1 && spans.contains_key(&s) && spans.contains_key(&e) => 1,
                _ => 2,
            };
            if p.words.len() < least {
                let what = match p.form.as_str() {
                    "refrain" => " (or one line whose words come back in another verse of the book)",
                    "frame" => " (or one entry that both its first and its last verse hold)",
                    _ => "",
                };
                self.fail(&at, format_args!("a {} place marks {least} or more lines{what}", p.form));
            }
            let own_lines = LINE_FORMS.contains(&p.form.as_str());
            if own_lines {
                for l in &lines {
                    let (Some(v), Some(t)) = (l["v"].as_u64(), l["t"].as_str()) else { continue };
                    let text = &self.src.text[v as usize];
                    let off = text.find(t).unwrap_or(0);
                    if !self.src.poetry.all_poetry(v as u32, text, off, off + t.len()) {
                        let i = p.words.iter().position(|w| w == t).unwrap_or(0);
                        self.fail(
                            &format!("{at}, words[{i}]"),
                            format_args!(
                                "{t:?} is not all in the BSB's own poetry lines; {} lines are marked only on lines the BSB sets as poetry (no prose, no psalm's title, and only verses whose lines are known)",
                                p.form
                            ),
                        );
                    }
                }
            }
            self.poetry_lines(&at, &lines, own_lines);
        }

        // Strong's tags: roots of words in the place's own verses.
        let mut tags = BTreeSet::new();
        for t in &p.original {
            if !tag_ok(t) {
                self.fail(&at, format_args!("tag {t:?} must be H or G, four digits and at most one letter, as H5315J"));
                continue;
            }
            if !tags.insert(t.as_str()) {
                self.fail(&at, format_args!("tag {t} is listed twice"));
            }
            let found = (s..=e).any(|v| {
                self.src.words[v as usize].iter().any(|w| w.main && w.lemma.as_deref().is_some_and(|k| lemma_matches(k, t)))
            });
            if !found {
                self.fail(&at, format_args!("tag {t} is not the root of a word in {}", p.reference));
            }
        }

        let mut out = json!({ "id": p.id, "form": p.form, "v": s, "words": p.words });
        if e > s {
            out["e"] = json!(e);
        }
        if !p.original.is_empty() {
            out["original"] = json!(p.original);
        }
        if s == e && p.words.len() == 1 && p.words[0] == self.src.text[s as usize] {
            out["whole"] = json!(true);
        }
        Some((out, bit?))
    }
}

/// Read and check the places, dropping any whose form a cited note already
/// has on one of its verses (`cited`, as (verse, form)); the files to write,
/// once the caller finds no errors in `check`.
pub(super) fn build(root: &Path, check: &mut Check, cited: &BTreeSet<(u32, String)>) -> Result<Vec<(String, Vec<u8>)>, String> {
    let dir = root.join(DIR);
    let mut entries: Vec<_> = match fs::read_dir(&dir) {
        Ok(rd) => rd.map(|e| e.map(|e| e.path()).map_err(|e| e.to_string())).collect::<Result<_, _>>()?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Vec::new(),
        Err(e) => return Err(format!("reading {DIR}: {e}")),
    };
    entries.sort();
    let mut ids = BTreeSet::new();
    let mut books: BTreeMap<usize, Vec<Value>> = BTreeMap::new();
    let mut has = vec![b'0'; check.src.vz.verse_count() as usize];
    let (mut total, mut dropped) = (0usize, 0usize);
    let mut counts = [0usize; 3];
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
        let file: SeenFile = serde_json::from_str(&text).map_err(|e| format!("parsing {DIR}/{name}: {e}"))?;
        for p in &file.notes {
            total += 1;
            let Some((x, bit)) = check.seen(b as u8, p, &mut ids) else { continue };
            let v = x["v"].as_u64().unwrap_or(0) as u32;
            let e = x["e"].as_u64().map_or(v, |e| e as u32);
            if (v..=e).any(|i| cited.contains(&(i, p.form.clone()))) {
                dropped += 1;
                continue;
            }
            for i in v..=e {
                has[i as usize] |= bit;
            }
            counts[bit.trailing_zeros() as usize] += 1;
            books.entry(b).or_default().push(x);
        }
    }

    let mut out = Vec::new();
    for (b, notes) in &mut books {
        notes.sort_by(|x, y| (x["v"].as_u64(), x["id"].as_str()).cmp(&(y["v"].as_u64(), y["id"].as_str())));
        let doc = json!({ "format": 1, "notes": notes });
        out.push((format!("{PARTS}/{}.json", BOOKS[*b].osis), serde_json::to_vec(&doc).map_err(|e| e.to_string())?));
    }
    let kept: usize = counts.iter().sum();
    eprintln!(
        "figures seen in the words: {total} places checked, {kept} written ({} parallelism, {} figure, {} contrast) in {} files; {dropped} dropped where a cited note has the same form",
        counts[0],
        counts[1],
        counts[2],
        books.len()
    );
    let names: Vec<&str> = books.keys().map(|b| BOOKS[*b].osis).collect();
    let index = json!({ "format": 1, "has": String::from_utf8(has).map_err(|e| e.to_string())?, "books": names });
    out.push((OUT.to_string(), serde_json::to_vec(&index).map_err(|e| e.to_string())?));
    Ok(out)
}

/// Checks for `atlas verify`, given the forms of `extras/figures.json` and
/// every (verse, form) its cited notes cover.
pub(super) fn verify(d: &Loaded, forms: &serde_json::Map<String, Value>, cited: &BTreeSet<(u64, String)>) -> Result<Vec<(bool, String)>, String> {
    let read = |p: &Path| -> Result<Value, String> {
        serde_json::from_str(&fs::read_to_string(p).map_err(|e| format!("reading {}: {e}", p.display()))?)
            .map_err(|e| format!("parsing {}: {e}", p.display()))
    };
    let index_path = d.dir.join(OUT);
    let size = fs::metadata(&index_path).map_err(|e| format!("reading {}: {e}", index_path.display()))?.len();
    let index = read(&index_path)?;
    let n = u64::from(d.vz.verse_count());
    let has = index["has"].as_str().unwrap_or("").as_bytes().to_vec();
    let has_ok = has.len() == n as usize && has.iter().all(|c| (b'0'..=b'7').contains(c));
    let lemma_count = d.lemmas["key"].as_array().map_or(0, Vec::len) as u64;
    let key = |li: u64| if li < lemma_count { d.lemmas["key"][li as usize].as_str() } else { None };

    // Only the books the index lists: a file an earlier build left in the
    // folder is not this build's.
    let listed: Vec<&str> = index["books"].as_array().into_iter().flatten().filter_map(Value::as_str).collect();
    let order: Vec<usize> = listed.iter().filter_map(|o| BOOKS.iter().position(|b| b.osis == *o)).collect();
    let mut files_ok = index["books"].is_array()
        && order.len() == listed.len()
        && order.len() == index["books"].as_array().map_or(0, Vec::len)
        && order.windows(2).all(|w| w[0] < w[1]);

    let mut seen = vec![b'0'; n as usize];
    let (mut notes_ok, mut words_ok, mut roots_ok, mut apart_ok) = (true, true, true, true);
    let mut ids = BTreeSet::new();
    let (mut count, mut largest) = (0usize, 0u64);
    for (b, book) in BOOKS.iter().enumerate() {
        if !order.contains(&b) {
            continue;
        }
        let path = d.dir.join(format!("{PARTS}/{}.json", book.osis));
        largest = largest.max(fs::metadata(&path).map(|m| m.len()).unwrap_or(0));
        let doc = read(&path)?;
        let notes: Vec<&Value> = doc["notes"].as_array().into_iter().flatten().collect();
        files_ok &= doc["format"] == 1 && !notes.is_empty();
        let mut prev: Option<(u64, String)> = None;
        for x in notes {
            count += 1;
            let form = x["form"].as_str().unwrap_or("");
            let bit = forms.get(form).and_then(|f| KINDS.iter().find(|(k, _)| f["kind"] == *k)).map(|(_, b)| *b);
            let id = x["id"].as_str().unwrap_or("");
            let v = x["v"].as_u64().unwrap_or(u64::MAX);
            let e = x.get("e").map_or(Some(v), Value::as_u64).unwrap_or(0);
            let place = (e < n).then(|| d.vz.locate(v as u32).zip(d.vz.locate(e as u32))).flatten();
            let in_file = place.is_some_and(|((pb, pc, _), (eb, ec, _))| pb as usize == b && eb as usize == b && pc == ec);
            let order = (v, id.to_string());
            notes_ok &= bit.is_some()
                && in_file
                && (x.get("e").is_none() || e > v)
                && id.ends_with(&format!("-{form}-seen"))
                && ids.insert(id.to_string())
                && prev.as_ref().is_none_or(|p| *p < order)
                && x.as_object().is_some_and(|o| o.keys().all(|k| KEYS.contains(&k.as_str())));
            prev = Some(order);
            if !in_file || e < v {
                continue;
            }
            let verses: Vec<String> = (v..=e).map(|i| d.english(i as u32)).collect();
            let words: Vec<&str> = x["words"].as_array().into_iter().flatten().filter_map(Value::as_str).collect();
            // Each entry where the display marks it: its first place in each
            // verse that holds it, starting and ending with whole words.
            let marked = |t: &String, w: &str| t.find(w).is_none_or(|o| whole_words(t, o, w.len()));
            let holds = |t: &String| words.iter().any(|w| t.contains(w));
            words_ok &= !words.is_empty()
                && words.len() == x["words"].as_array().map_or(0, Vec::len)
                && words.iter().all(|w| !w.trim().is_empty() && !stray(w) && verses.iter().any(|t| t.contains(w)) && verses.iter().all(|t| marked(t, w)))
                && verses.first().is_some_and(holds)
                && verses.last().is_some_and(holds)
                && (bit != Some(1) || words.len() >= 2 || form == "refrain" || form == "frame")
                && (x.get("whole").is_some_and(|w| w == true) == (v == e && words.len() == 1 && words[0] == verses[0]));
            if let Some(o) = x.get("original") {
                let tags: Vec<&str> = o.as_array().into_iter().flatten().filter_map(Value::as_str).collect();
                let main = |w: &Value| w[5].as_u64().unwrap_or(0) & u64::from(crate::build::FLAG_OTHER_EDITIONS) == 0;
                roots_ok &= !tags.is_empty()
                    && tags.len() == o.as_array().map_or(0, Vec::len)
                    && tags.iter().all(|t| {
                        tag_ok(t)
                            && (v..=e).any(|i| {
                                d.verse(i as u32).is_ok_and(|vx| {
                                    vx[1].as_array().into_iter().flatten().any(|w| main(w) && w[3].as_u64().and_then(key).is_some_and(|k| lemma_matches(k, t)))
                                })
                            })
                    });
            }
            apart_ok &= (v..=e).all(|i| !cited.contains(&(i, form.to_string())));
            if let Some(bit) = bit {
                for i in v..=e {
                    seen[i as usize] |= bit;
                }
            }
        }
    }
    Ok(vec![
        (
            has_ok && files_ok && seen == has,
            format!("the seen-in-the-words index marks exactly the verses its {count} places sit under, and lists every book file, each with places"),
        ),
        (
            notes_ok,
            "every place seen in the words is on real verses in one chapter, in its book's file, in order, with a known form, and carries no cite, strength or note text".to_string(),
        ),
        (words_ok, "every place seen in the words marks whole BSB words in its verses, from its first verse to its last, parallel lines two or more".to_string()),
        (roots_ok, "every Strong's tag on a place seen in the words is the root of a main-text word in its verses".to_string()),
        (apart_ok, "no place seen in the words shares a form and a verse with a cited figure note".to_string()),
        (size < 100_000, format!("extras/figures-seen.json is {size} bytes, expected under 100,000")),
        (largest < 1_500_000, format!("the largest file of places seen in the words is {largest} bytes, expected under 1,500,000")),
    ])
}

#[cfg(test)]
mod tests {
    use super::{id_for, ref_name, stray, tag_ok, whole_words};

    #[test]
    fn ids_name_the_first_verse_and_form() {
        assert_eq!(id_for("Psalm 1:1", "same"), "psalm-1-1-same-seen");
        assert_eq!(id_for("Genesis 31:36-42", "re-statement"), "genesis-31-36-re-statement-seen");
        assert_eq!(id_for("Song of Solomon 2:1", "metaphor"), "song-of-solomon-2-1-metaphor-seen");
        assert_eq!(id_for("1 Samuel 2:3", "question"), "1-samuel-2-3-question-seen");
        assert_eq!(id_for("Job 3:26-4:1", "same"), "job-3-26-same-seen");
    }

    #[test]
    fn refs_are_written_as_the_app_names_them() {
        assert_eq!(ref_name(0, 4, 23, 23), "Genesis 4:23");
        assert_eq!(ref_name(18, 1, 1, 3), "Psalm 1:1-3");
        assert_eq!(ref_name(21, 2, 1, 1), "Song of Solomon 2:1");
    }

    #[test]
    fn entries_mark_whole_words() {
        let t = "The LORD sends poverty and wealth; He humbles and He exalts.";
        assert!(whole_words(t, 0, 8));
        assert!(!whole_words(t, 5, 15));
        assert!(!whole_words(t, 0, 7));
        assert!(whole_words("the LORD’s house", 4, 4));
        assert!(stray(", should you"));
        assert!(stray("— to a land of darkness"));
        assert!(stray("” said the LORD"));
        assert!(!stray("“Adah and Zillah"));
    }

    #[test]
    fn tags_are_steps_strongs_numbers() {
        assert!(tag_ok("H5315J"));
        assert!(tag_ok("G2316"));
        assert!(!tag_ok("H531"));
        assert!(!tag_ok("H5315JK"));
        assert!(!tag_ok("X5315"));
        assert!(!tag_ok("H53a5"));
    }
}
