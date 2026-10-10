//! Nave's Topical Bible (Orville J. Nave, 1896), in Brady Stephenson's table
//! edition (sources.json id "naves"): one reader for Ask the Bible and for the
//! Themes tab's Nave's rows. Nave's is used as an index: which verses go with
//! which subject. Its subject headings are shown, never the wording of its lines.
//!
//! - [`read`] parses the table into subjects and lists those that cite a verse,
//!   in the order Ask numbers them (`ask/index.json`, `ask/topics/<n>.json`).
//!   An entry cut at a spreadsheet cell's limit loses its last, cut line.
//! - [`build`] writes `naves/<Book>.json`: for each verse, the concept
//!   subjects whose short references cite it, else up to two passages of 4 to
//!   60 verses it is part of. At Study the Themes tab shows them for a verse no
//!   theme reaches. People, places and bare names are left out (see [`kind`]),
//!   and so is every subject in `config/naves-display.json`. Nave's never
//!   becomes a theme and adds no verse or root to one.
//! - [`verify`] checks the written files, for `atlas verify`.

use crate::loaded::Loaded;
use crate::sources::Inputs;
use atlas_core::{refs, Versification, BOOKS};
use serde::Deserialize;
use serde_json::{json, Value};
use std::cmp::Reverse;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fs;
use std::path::Path;

pub const SOURCE: &str = "naves";
pub const DISPLAY: &str = "config/naves-display.json";
/// A reference of more than this many verses is a passage: Ask does not count
/// it towards the verses shown first, and the Themes rows show it as a
/// passage the verse is part of, not as a citation of the verse.
pub const CITE_SPAN_MAX: u32 = 3;
/// The longest passage, in verses, a verse is shown as part of.
const PASSAGE_MAX: u32 = 60;
/// Passages shown for a verse that no subject cites directly.
const PASSAGES_SHOWN: usize = 2;
/// The most a spreadsheet cell holds, in UTF-16 units (as Excel counts). An
/// entry exactly this long was cut there, mid-reference.
const CELL_MAX: usize = 32_767;

// ------------------------------------------------------------ the table

/// One line of a Nave's entry: its label and the verse ranges it cites.
pub struct Line {
    pub label: String,
    /// The top-level line an indented line belongs to.
    pub parent: Option<usize>,
    pub refs: Vec<(u32, u32)>,
}

pub struct Subject {
    /// As Nave's writes it: "ANGER", "SPEAKING, EVIL".
    pub key: String,
    pub lines: Vec<Line>,
}

/// A subject Ask lists: every subject that cites a verse, numbered in this order.
pub struct Listed {
    /// Index into `Naves::subjects`.
    pub subject: usize,
    pub title: String,
    /// All its verses, merged.
    pub verses: Vec<(u32, u32)>,
}

/// Nave's as read.
pub struct Naves {
    pub subjects: Vec<Subject>,
    pub listed: Vec<Listed>,
    /// Reference pieces that do not resolve to BSB verses.
    pub bad: usize,
}

/// Rows of a CSV file with quoted fields (which may hold commas, doubled
/// quotes and line breaks).
pub fn csv_rows(text: &str) -> Vec<Vec<String>> {
    let mut rows = Vec::new();
    let mut row = Vec::new();
    let mut field = String::new();
    let mut quoted = false;
    let mut chars = text.trim_start_matches('\u{feff}').chars().peekable();
    while let Some(c) = chars.next() {
        match (quoted, c) {
            (true, '"') if chars.peek() == Some(&'"') => {
                field.push('"');
                chars.next();
            }
            (true, '"') => quoted = false,
            (true, c) => field.push(c),
            (false, '"') => quoted = true,
            (false, ',') => row.push(std::mem::take(&mut field)),
            (false, '\r') => {}
            (false, '\n') => {
                row.push(std::mem::take(&mut field));
                rows.push(std::mem::take(&mut row));
            }
            (false, c) => field.push(c),
        }
    }
    if !field.is_empty() || !row.is_empty() {
        row.push(field);
        rows.push(row);
    }
    rows
}

/// A Nave's book code ("EXO", "1CO", "Jude", "So" for the Song) at the
/// start of `s`, followed by a reference ("31:16", "24"): the book, and the
/// text after the code.
fn book_code(s: &str) -> Option<(u8, &str)> {
    let (code, rest) = s.split_once(' ')?;
    let next = rest.split_whitespace().next()?;
    let numbers = next.starts_with(|c: char| c.is_ascii_digit())
        && next
            .chars()
            .all(|c| c.is_ascii_digit() || ":-,;.".contains(c));
    let shaped = (2..=4).contains(&code.len())
        && code.chars().all(|c| c.is_ascii_alphanumeric())
        && code.chars().any(|c| c.is_ascii_alphabetic());
    if !numbers || !shaped {
        return None;
    }
    let book = if code.eq_ignore_ascii_case("so") {
        refs::parse_book("song")
    } else {
        refs::parse_book(code)
    };
    Some((book?, rest))
}

/// Split a line of an entry into its depth (0 or 1), its label and the text of
/// its references: "     -Called SLEEP DEU 31:16; JOB 7:21" gives
/// (1, "Called SLEEP", "DEU 31:16; JOB 7:21").
fn split_line(line: &str) -> (u8, &str, &str) {
    let depth = u8::from(line.starts_with([' ', '\t']));
    let s = line.trim().trim_start_matches('-').trim();
    for (i, _) in s
        .char_indices()
        .filter(|&(i, _)| i == 0 || s[..i].ends_with(' '))
    {
        if book_code(&s[i..]).is_some() {
            return (depth, s[..i].trim().trim_end_matches(',').trim(), &s[i..]);
        }
    }
    (depth, s, "")
}

/// The verse ranges in a Nave's reference list: "EXO 6:16-20; JOS 21:4,10;
/// 24; LEV 8" (a bare number after a verse is a verse in the same chapter;
/// otherwise it is a whole chapter). `bad` counts pieces that do not resolve.
fn nave_refs(text: &str, vz: &Versification, bad: &mut usize) -> Vec<(u32, u32)> {
    let mut out = Vec::new();
    let mut book: Option<u8> = None;
    let pieces = text.split(';').flat_map(|p| p.split(" with "));
    for piece in pieces {
        let mut piece = piece.trim().trim_end_matches('.');
        if piece.is_empty() {
            continue;
        }
        if let Some((b, rest)) = book_code(piece) {
            book = Some(b);
            piece = rest;
        }
        let Some(b) = book else {
            *bad += 1;
            continue;
        };
        let mut chapter: Option<u16> = None;
        // "19:18." and "12. See also" end a list: keep the numbers.
        for part in piece
            .split(',')
            .filter_map(|p| p.split_whitespace().next())
            .map(|p| p.trim_end_matches('.'))
            .filter(|p| !p.is_empty())
        {
            let range = nave_part(part, b, &mut chapter, vz);
            match range {
                Some(r) => out.push(r),
                None => *bad += 1,
            }
        }
    }
    out
}

fn nave_part(
    part: &str,
    b: u8,
    chapter: &mut Option<u16>,
    vz: &Versification,
) -> Option<(u32, u32)> {
    let num = |s: &str| s.trim().parse::<u16>().ok().filter(|&n| n > 0);
    let (first, last) = match part.split_once('-') {
        Some((x, y)) => (x, Some(y)),
        None => (part, None),
    };
    let one_chapter = vz.chapters_in(b) == 1;
    if let Some((c, v)) = first.split_once(':') {
        let (c, v) = (num(c)?, num(v)?);
        *chapter = Some(c);
        let start = vz.index(b, c, v)?;
        let end = match last {
            None => start,
            Some(y) => match y.split_once(':') {
                Some((c2, v2)) => vz.index(b, num(c2)?, num(v2)?)?,
                None => vz.index(b, c, num(y)?)?,
            },
        };
        return (end >= start).then_some((start, end));
    }
    let n = num(first)?;
    let m = match last {
        Some(y) => num(y)?,
        None => n,
    };
    if m < n {
        return None;
    }
    if let Some(c) = chapter.or(one_chapter.then_some(1)) {
        // A verse in the chapter named earlier in this piece (or in a one-chapter book).
        return Some((vz.index(b, c, n)?, vz.index(b, c, m)?));
    }
    // Whole chapters.
    let start = vz.index(b, n, 1)?;
    let end = vz.index(b, m, vz.verses_in(b, m)?)?;
    Some((start, end))
}

/// The subjects in the table's text. `bad` counts reference pieces that do
/// not resolve; `cut` gets (subject, line left out) for each entry cut at a
/// spreadsheet cell's limit.
fn parse(
    text: &str,
    vz: &Versification,
    bad: &mut usize,
    cut: &mut Vec<(String, String)>,
) -> Result<Vec<Subject>, String> {
    let mut rows = csv_rows(text).into_iter();
    let header = rows.next().unwrap_or_default();
    if header != ["section", "subject", "entry"] {
        return Err(format!(
            "expected the columns section, subject, entry; found {header:?}"
        ));
    }
    let mut subjects: Vec<Subject> = Vec::new();
    for row in rows.filter(|r| r.len() == 3) {
        let key = row[1].trim().to_string();
        if key.is_empty() {
            continue;
        }
        let mut raws: Vec<&str> = row[2].lines().filter(|l| !l.trim().is_empty()).collect();
        // An entry as long as a cell holds was cut there, and so was its
        // last line ("JESUS, THE CHRIST" ends "Head of every man 1CO 1",
        // which would file all of 1 Corinthians 1 under it): leave it out.
        if row[2].encode_utf16().count() == CELL_MAX {
            if let Some(last) = raws.pop() {
                cut.push((key.clone(), last.trim().to_string()));
            }
        }
        let mut lines: Vec<Line> = Vec::new();
        let mut parent = None;
        for raw in raws {
            let (depth, label, refs_text) = split_line(raw);
            let refs = nave_refs(refs_text, vz, bad);
            if depth == 0 {
                parent = Some(lines.len());
            }
            lines.push(Line {
                label: label.to_string(),
                parent: if depth == 0 { None } else { parent },
                refs,
            });
        }
        // A subject listed twice reads as one.
        match subjects.iter_mut().find(|s| s.key == key) {
            Some(s) => s.lines.extend(lines.into_iter().map(|mut l| {
                l.parent = None;
                l
            })),
            None => subjects.push(Subject { key, lines }),
        }
    }
    Ok(subjects)
}

/// Every subject that cites a verse, with its title and verses, in table
/// order: the numbering of Ask's topics and of the Themes rows.
fn listed(subjects: &[Subject]) -> Result<Vec<Listed>, String> {
    let mut out = Vec::new();
    let mut slugs: BTreeMap<String, usize> = BTreeMap::new();
    for (i, s) in subjects
        .iter()
        .enumerate()
        .filter(|(_, s)| s.lines.iter().any(|l| !l.refs.is_empty()))
    {
        let title = title(&s.key);
        let id = slug(&title);
        if id.is_empty() {
            continue;
        }
        if let Some(prev) = slugs.insert(id.clone(), i) {
            return Err(format!(
                "Nave's subjects {} and {} would share the link {id:?}",
                subjects[prev].key, s.key
            ));
        }
        let verses = merge(
            s.lines
                .iter()
                .flat_map(|l| l.refs.iter().copied())
                .collect(),
        );
        out.push(Listed { subject: i, title, verses });
    }
    Ok(out)
}

/// Read and list Nave's. An entry cut at a cell's limit is logged.
pub fn read(inputs: &Inputs, vz: &Versification) -> Result<Naves, String> {
    let path = inputs.path(SOURCE, "topics");
    let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let (mut bad, mut cut) = (0usize, Vec::new());
    let subjects = parse(&text, vz, &mut bad, &mut cut).map_err(|e| format!("{}: {e}", path.display()))?;
    for (key, line) in &cut {
        eprintln!("naves: {key} is cut at {CELL_MAX} characters, a spreadsheet cell's limit; its last line, {line:?}, is left out");
    }
    let listed = listed(&subjects)?;
    Ok(Naves { subjects, listed, bad })
}

/// "SPEAKING, EVIL" -> "Speaking, Evil"; "JESUS, THE CHRIST" -> "Jesus, the Christ".
pub fn title(key: &str) -> String {
    const SMALL: [&str; 12] = [
        "a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "the", "to",
    ];
    key.split(' ')
        .enumerate()
        .map(|(i, w)| {
            let lower = w.to_lowercase();
            if i > 0 && SMALL.contains(&lower.as_str()) {
                return lower;
            }
            let mut c = lower.chars();
            match c.next() {
                Some(f) => f.to_uppercase().chain(c).collect(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// The id a topic is linked by: its title in lowercase words joined by hyphens.
/// The web app computes the same from the title.
pub fn slug(title: &str) -> String {
    let mut out = String::new();
    for c in title.chars().flat_map(char::to_lowercase) {
        if c.is_alphanumeric() {
            out.push(c);
        } else if !out.is_empty() && !out.ends_with('-') {
            out.push('-');
        }
    }
    out.trim_end_matches('-').to_string()
}

// ------------------------------------------------------------ verse sets

/// Sorted, merged, inclusive ranges.
pub fn merge(mut rs: Vec<(u32, u32)>) -> Vec<(u32, u32)> {
    rs.sort_unstable();
    let mut out: Vec<(u32, u32)> = Vec::new();
    for (s, e) in rs {
        match out.last_mut() {
            Some(last) if s <= last.1 + 1 => last.1 = last.1.max(e),
            _ => out.push((s, e)),
        }
    }
    out
}

pub fn count(rs: &[(u32, u32)]) -> u32 {
    rs.iter().map(|(s, e)| e - s + 1).sum()
}

// ------------------------------------------------------------ what a subject is about

/// What a subject's heading names.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Concept,
    Person,
    Place,
    /// A name that is neither a known person nor a known place.
    Name,
    /// A name the lists above miss, known by how the KJV and the BSB write it.
    Written,
}

/// Line labels that read as a person's ("Son of", "A Levite") or a place's
/// ("A city of", "Mount"), matched at the start of a label as whole words.
const PERSON_LABELS: [&str; 47] = [
    "son", "sons", "daughter", "father", "mother", "wife", "husband", "brother", "sister", "grandson", "a son", "the son", "called", "also called", "one of",
    "a chief", "chief of", "a levite", "a priest", "an ancestor", "ancestor", "descendant", "descendants", "king of", "a king", "queen", "a man", "a woman",
    "a gadite", "a benjamite", "a merarite", "a gershonite", "a kohathite", "a captain", "a prophet", "an officer", "one who", "a returned", "a leader",
    "head of", "genealogy", "lineage", "death of", "burial", "his", "her", "an israelite",
];
const PLACE_LABELS: [&str; 28] = [
    "a city", "city of", "a town", "a place", "a mountain", "mount", "a river", "a valley", "a district", "a region", "a country", "a station",
    "camping place", "a stream", "a well", "a plain", "a desert", "a wilderness", "a province", "an island", "a village", "a hill", "the land", "land of",
    "inhabitants", "a brook", "a fortress", "people of",
];

/// Names from pinned sources the build already reads: Theographic's people
/// and places, OpenBible's ancient places, and the STEPBible root glosses that
/// begin with a capital letter (names). Lowercase, cut before any "(".
pub struct Names {
    people: HashSet<String>,
    places: HashSet<String>,
    glossed: HashSet<String>,
    /// Words the KJV and the BSB write with a capital in mid-sentence and
    /// never in lowercase: lowercase, without hyphens.
    capitals: HashSet<String>,
}

/// Words written with a capital in mid-sentence (after a letter, a digit or a
/// comma) and never in lowercase, in any of `texts`. A word is letters joined
/// by hyphens or en dashes ("Beth–el" in the KJV); it is kept in lowercase
/// without them, so "Beth-el" and "Bethel" are one word.
fn capitals<'t>(texts: impl Iterator<Item = &'t str>) -> HashSet<String> {
    let (mut lower, mut mid) = (HashSet::new(), HashSet::new());
    for t in texts {
        let chars: Vec<char> = t.chars().collect();
        let mut i = 0;
        while i < chars.len() {
            if !chars[i].is_alphabetic() {
                i += 1;
                continue;
            }
            let start = i;
            let mut word = String::new();
            loop {
                while i < chars.len() && chars[i].is_alphabetic() {
                    word.extend(chars[i].to_lowercase());
                    i += 1;
                }
                if i + 1 < chars.len() && matches!(chars[i], '-' | '–') && chars[i + 1].is_alphabetic() {
                    i += 1;
                } else {
                    break;
                }
            }
            if chars[start].is_lowercase() {
                lower.insert(word);
            } else if chars[start].is_uppercase() && chars[..start].iter().rev().find(|&&c| c != ' ').is_some_and(|&c| c.is_alphanumeric() || c == ',') {
                mid.insert(word);
            }
        }
    }
    mid.retain(|w| !lower.contains(w));
    mid
}

fn plain_name(s: &str) -> String {
    s.split('(').next().unwrap_or("").trim().to_lowercase()
}

impl Names {
    /// `glosses`: every root's gloss, as in lemmas.json; `bsb`: the BSB text.
    pub fn read(inputs: &Inputs, glosses: &[&str], bsb: &[String]) -> Result<Self, String> {
        let table = |key: &str, cols: &[&str]| -> Result<HashSet<String>, String> {
            let path = inputs.path("theographic", key);
            let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
            let mut rows = csv_rows(&text).into_iter();
            let head = rows.next().unwrap_or_default();
            let at: Vec<usize> = cols
                .iter()
                .map(|c| head.iter().position(|h| h.trim() == *c).ok_or(format!("{} has no column {c}", path.display())))
                .collect::<Result<_, _>>()?;
            let mut out = HashSet::new();
            for row in rows {
                for &i in &at {
                    if let Some(s) = row.get(i).filter(|s| !s.is_empty()) {
                        out.insert(plain_name(s));
                    }
                }
            }
            Ok(out)
        };
        let people = table("people", &["name", "displayTitle"])?;
        // Not the esvName column: nothing here is taken from the ESV. Of
        // Nave's subjects only STRAIGHT (the street) was a place by it alone,
        // and it is still left out, as a name.
        let mut places = table("places", &["displayTitle", "kjvName"])?;
        #[derive(Deserialize)]
        struct Ancient {
            friendly_id: Option<String>,
        }
        let path = inputs.path("openbible-geo", "ancient");
        let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
        for line in text.lines().filter(|l| !l.trim().is_empty()) {
            let row: Ancient = serde_json::from_str(line).map_err(|e| format!("{}: {e}", path.display()))?;
            if let Some(id) = row.friendly_id.filter(|s| !s.is_empty()) {
                places.insert(plain_name(&id));
            }
        }
        let glossed = glosses
            .iter()
            .filter(|g| g.chars().find(|c| c.is_alphabetic()).is_some_and(char::is_uppercase))
            .map(|g| g.split('(').next().unwrap_or("").split('@').next().unwrap_or("").trim().to_lowercase())
            .collect();
        // The KJV, whose spellings Nave's uses ("Ajalon", "Accho").
        #[derive(Deserialize)]
        struct Kjv {
            books: Vec<KjvBook>,
        }
        #[derive(Deserialize)]
        struct KjvBook {
            chapters: Vec<KjvChapter>,
        }
        #[derive(Deserialize)]
        struct KjvChapter {
            verses: Vec<KjvVerse>,
        }
        #[derive(Deserialize)]
        struct KjvVerse {
            text: String,
        }
        let path = inputs.path("kjv", "kjv");
        let kjv: Kjv = serde_json::from_str(&fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?).map_err(|e| format!("parsing {}: {e}", path.display()))?;
        let kjv_text = kjv.books.iter().flat_map(|b| &b.chapters).flat_map(|c| &c.verses).map(|v| v.text.as_str());
        let capitals = capitals(kjv_text.chain(bsb.iter().map(String::as_str)));
        Ok(Names { people, places, glossed, capitals })
    }
}

/// Whether a label starts with one of `words`, as whole words, in any case.
fn label_starts(label: &str, words: &[&str]) -> bool {
    let l = label.to_lowercase();
    words
        .iter()
        .any(|w| l.strip_prefix(w).is_some_and(|rest| !rest.starts_with(|c: char| c.is_alphanumeric() || c == '_')))
}

/// What a subject is about. Its heading (before any comma or parenthesis) is
/// a concept unless it is a known name. A known name is a place when more of
/// its lines read as a place's than a person's and it is a known place; else
/// a person when it is a known person and its lines lean that way; else
/// whichever list knows it; else a bare name. A heading no list knows is
/// still a name when the KJV and the BSB write its first word as one (a
/// capital in mid-sentence, never lowercase): peoples such as "Amorites", and
/// Nave's spellings such as "Beth-el" and "Ajalon".
pub fn kind(key: &str, lines: &[Line], names: &Names) -> Kind {
    let t = title(key);
    let head = t.split(',').next().unwrap_or("").split(" (").next().unwrap_or("").trim().to_lowercase();
    let (person, place) = (names.people.contains(&head), names.places.contains(&head));
    if !(person || place || names.glossed.contains(&head)) {
        let first = head.split(' ').next().unwrap_or("").replace('-', "");
        return if first.chars().count() > 1 && names.capitals.contains(&first) { Kind::Written } else { Kind::Concept };
    }
    let as_person = lines.iter().filter(|l| label_starts(&l.label, &PERSON_LABELS)).count();
    let as_place = lines.iter().filter(|l| label_starts(&l.label, &PLACE_LABELS)).count();
    if as_place > as_person && place {
        Kind::Place
    } else if person && as_person >= as_place {
        Kind::Person
    } else if place {
        Kind::Place
    } else if person {
        Kind::Person
    } else {
        Kind::Name
    }
}

// ------------------------------------------------------------ which subjects show

#[derive(Deserialize)]
struct DisplayFile {
    hide: Vec<Hidden>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Hidden {
    key: String,
    why: String,
}

/// The subjects `config/naves-display.json` hides from the Themes rows, by
/// key. The build stops on a key Nave's does not have, written exactly.
fn hidden(root: &Path, subjects: &[Subject]) -> Result<Vec<String>, String> {
    let text = fs::read_to_string(root.join(DISPLAY)).map_err(|e| format!("reading {DISPLAY}: {e}"))?;
    let file: DisplayFile = serde_json::from_str(&text).map_err(|e| format!("parsing {DISPLAY}: {e}"))?;
    let mut keys = Vec::new();
    for h in file.hide {
        if !subjects.iter().any(|s| s.key == h.key) {
            return Err(format!("{DISPLAY}: Nave's has no subject {:?} (write it exactly as the table does)", h.key));
        }
        if h.why.trim().is_empty() {
            return Err(format!("{DISPLAY}: {:?} needs a why", h.key));
        }
        if keys.contains(&h.key) {
            return Err(format!("{DISPLAY}: {:?} is listed twice", h.key));
        }
        keys.push(h.key);
    }
    Ok(keys)
}

/// Whether a subject may show in the Themes rows: a concept, and not hidden.
fn shown(kind: Kind, key: &str, hidden: &[String]) -> bool {
    kind == Kind::Concept && !hidden.iter().any(|h| h == key)
}

// ------------------------------------------------------------ per verse

/// What the Themes rows can show for one verse.
#[derive(Debug, PartialEq)]
enum Row {
    None,
    /// Listed subjects whose short references cite the verse.
    Direct(Vec<usize>),
    /// Or (listed subject, first verse, last verse) of passages the verse is part of.
    Passages(Vec<(usize, u32, u32)>),
}

/// Each verse's row, from the listed subjects that may show.
fn rows(subjects: &[Subject], listed: &[Listed], show: &[bool], n: usize) -> Vec<Row> {
    // (listed subject, lines citing the verse) and (listed subject, passage).
    let mut direct: Vec<Vec<(usize, u32)>> = vec![Vec::new(); n];
    let mut passages: Vec<Vec<(usize, u32, u32)>> = vec![Vec::new(); n];
    for (i, t) in listed.iter().enumerate().filter(|&(i, _)| show[i]) {
        let mut lines_at: BTreeMap<u32, u32> = BTreeMap::new();
        let mut shortest: BTreeMap<u32, (u32, u32)> = BTreeMap::new();
        for l in &subjects[t.subject].lines {
            let mut cited = BTreeSet::new();
            for &(s, e) in &l.refs {
                if e - s < CITE_SPAN_MAX {
                    cited.extend(s..=e);
                } else if e - s < PASSAGE_MAX {
                    // The subject's shortest passage holding the verse, the first if two tie.
                    for v in s..=e {
                        let best = shortest.entry(v).or_insert((s, e));
                        if (e - s, s) < (best.1 - best.0, best.0) {
                            *best = (s, e);
                        }
                    }
                }
            }
            for v in cited {
                *lines_at.entry(v).or_default() += 1;
            }
        }
        for (v, k) in lines_at {
            direct[v as usize].push((i, k));
        }
        for (v, (s, e)) in shortest {
            passages[v as usize].push((i, s, e));
        }
    }
    let size = |i: usize| count(&listed[i].verses);
    direct
        .into_iter()
        .zip(passages)
        .map(|(mut d, mut p)| {
            // Most specific for this verse first: the subject with the most
            // lines citing it, then the subject with fewer verses in all, then
            // by title. A passage: the shortest first, then the same.
            if !d.is_empty() {
                d.sort_by_key(|&(i, k)| (Reverse(k), size(i), &listed[i].title));
                return Row::Direct(d.into_iter().map(|(i, _)| i).collect());
            }
            if !p.is_empty() {
                p.sort_by_key(|&(i, s, e)| (e - s, size(i), &listed[i].title));
                p.truncate(PASSAGES_SHOWN);
                return Row::Passages(p);
            }
            Row::None
        })
        .collect()
}

/// The files to write under web/public/data: `naves/<Book>.json`, named like
/// `text/<Book>.json`, each `{"book", "topics", "chapters"}`. `topics` lists
/// the subjects the book uses as [Ask topic number, title, verse count], so
/// the Themes tab can name a subject and open it in Ask without loading
/// `ask/index.json`. `chapters` holds one entry per verse: 0 for nothing; a
/// list of numbers, the subjects citing it (places in `topics`), most specific
/// first; or a list of [subject, first verse, last verse], the passages it is
/// part of (verse numbers as in atlas.bin).
pub fn build(
    root: &Path,
    inputs: &Inputs,
    vz: &Versification,
    naves: &Naves,
    glosses: &[&str],
    bsb: &[String],
) -> Result<Vec<(String, Vec<u8>)>, String> {
    let names = Names::read(inputs, glosses, bsb)?;
    let hide = hidden(root, &naves.subjects)?;
    let kinds: Vec<Kind> = naves
        .listed
        .iter()
        .map(|t| {
            let s = &naves.subjects[t.subject];
            kind(&s.key, &s.lines, &names)
        })
        .collect();
    let show: Vec<bool> = naves
        .listed
        .iter()
        .zip(&kinds)
        .map(|(t, &k)| shown(k, &naves.subjects[t.subject].key, &hide))
        .collect();
    let n = vz.verse_count() as usize;
    let rows = rows(&naves.subjects, &naves.listed, &show, n);
    let mut out = Vec::new();
    for (b, book) in BOOKS.iter().enumerate() {
        let b = b as u8;
        let (start, end) = (vz.book_start(b) as usize, vz.book_start(b + 1) as usize);
        let used: BTreeSet<usize> = rows[start..end]
            .iter()
            .flat_map(|r| match r {
                Row::None => Vec::new(),
                Row::Direct(d) => d.clone(),
                Row::Passages(p) => p.iter().map(|x| x.0).collect(),
            })
            .collect();
        let local: HashMap<usize, usize> = used.iter().enumerate().map(|(k, &i)| (i, k)).collect();
        let topics: Vec<Value> = used
            .iter()
            .map(|&i| json!([i, naves.listed[i].title, count(&naves.listed[i].verses)]))
            .collect();
        let mut chapters = Vec::new();
        for ch in 1..=vz.chapters_in(b) {
            let verses: Vec<Value> = (1..=vz.verses_in(b, ch).unwrap_or(0))
                .filter_map(|v| vz.index(b, ch, v))
                .map(|v| match &rows[v as usize] {
                    Row::None => json!(0),
                    Row::Direct(d) => json!(d.iter().map(|i| local[i]).collect::<Vec<_>>()),
                    Row::Passages(p) => json!(p.iter().map(|&(i, s, e)| json!([local[&i], s, e])).collect::<Vec<_>>()),
                })
                .collect();
            chapters.push(Value::Array(verses));
        }
        let doc = json!({ "book": book.osis, "topics": topics, "chapters": chapters });
        out.push((format!("naves/{}.json", book.osis), serde_json::to_vec(&doc).map_err(|e| e.to_string())?));
    }

    let left = |k: Kind| kinds.iter().filter(|&&x| x == k).count();
    let hidden_listed = naves.listed.iter().zip(&kinds).filter(|&(t, &k)| k == Kind::Concept && hide.contains(&naves.subjects[t.subject].key)).count();
    let direct = rows.iter().filter(|r| matches!(r, Row::Direct(_))).count();
    let passage = rows.iter().filter(|r| matches!(r, Row::Passages(_))).count();
    let bytes: usize = out.iter().map(|(_, b)| b.len()).sum();
    let largest = out.iter().max_by_key(|(_, b)| b.len()).map(|(p, b)| format!("{p} {:.1} KB", b.len() as f64 / 1e3)).unwrap_or_default();
    eprintln!(
        "naves rows: {} of {} subjects can show ({} concepts, {} hidden by {DISPLAY}; left out {} people, {} places, {} other names and {} more names known by how the KJV and BSB write them); {direct} verses with a subject citing them, {passage} more inside a passage; {} files, {:.0} KB, the largest {largest}",
        show.iter().filter(|&&s| s).count(),
        naves.listed.len(),
        left(Kind::Concept),
        hidden_listed,
        left(Kind::Person),
        left(Kind::Place),
        left(Kind::Name),
        left(Kind::Written),
        out.len(),
        bytes as f64 / 1e3,
    );
    Ok(out)
}

// ------------------------------------------------------------ verify

/// A verse's row as written: the titles of the subjects citing it, or of the
/// passages it is part of, with their ranges.
#[derive(Debug, Default)]
struct Written {
    direct: Vec<String>,
    passages: Vec<(String, u32, u32)>,
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded, root: &Path) -> Result<Vec<(bool, String)>, String> {
    let read = |rel: &str| -> Result<Value, String> {
        let p = d.dir.join(rel);
        serde_json::from_str(&fs::read_to_string(&p).map_err(|e| format!("reading {}: {e}", p.display()))?).map_err(|e| format!("parsing {}: {e}", p.display()))
    };
    let mut r: Vec<(bool, String)> = Vec::new();
    let index = read("ask/index.json")?;
    let topics = index["topics"].as_array().ok_or("ask/index.json has no topics")?;
    let n = d.vz.verse_count() as usize;

    // Every file: subjects that are Ask's own, and one well-formed entry per verse.
    let mut rows: Vec<Written> = (0..n).map(|_| Written::default()).collect();
    let mut titles: BTreeSet<String> = BTreeSet::new();
    for (b, book) in BOOKS.iter().enumerate() {
        let rel = format!("naves/{}.json", book.osis);
        let doc = read(&rel)?;
        let local = doc["topics"].as_array().ok_or(format!("{rel} has no topics"))?;
        let names: Vec<Option<&str>> = local
            .iter()
            .map(|t| {
                let i = t[0].as_u64()? as usize;
                let ask = topics.get(i)?;
                (ask[0] == t[1] && ask[1] == t[2]).then(|| t[1].as_str()).flatten()
            })
            .collect();
        r.push((names.iter().all(Option::is_some), format!("{rel}: every subject is Ask's topic of that number, with its title and verse count")));
        titles.extend(names.iter().flatten().map(|s| s.to_string()));
        let chapters = doc["chapters"].as_array().ok_or(format!("{rel} has no chapters"))?;
        let b = b as u8;
        let mut shape = chapters.len() == d.vz.chapters_in(b) as usize;
        let mut entries = true;
        for (c, verses) in chapters.iter().enumerate() {
            let verses = verses.as_array().map(Vec::as_slice).unwrap_or_default();
            shape &= Some(verses.len() as u16) == d.vz.verses_in(b, c as u16 + 1);
            for (k, e) in verses.iter().enumerate() {
                let Some(v) = d.vz.index(b, c as u16 + 1, k as u16 + 1) else { continue };
                let name = |x: &Value| x.as_u64().and_then(|t| names.get(t as usize).copied().flatten()).map(str::to_string);
                let row = &mut rows[v as usize];
                match e {
                    Value::Number(z) => entries &= z.as_u64() == Some(0),
                    Value::Array(list) if list.iter().all(Value::is_number) => {
                        row.direct = list.iter().filter_map(name).collect();
                        entries &= !list.is_empty() && row.direct.len() == list.len();
                    }
                    Value::Array(list) => {
                        for p in list {
                            let (s, t) = (p[1].as_u64().unwrap_or(0) as u32, p[2].as_u64().unwrap_or(0) as u32);
                            let ok = (s..=t).contains(&v) && (CITE_SPAN_MAX..PASSAGE_MAX).contains(&(t - s));
                            match name(&p[0]).filter(|_| ok) {
                                Some(title) => row.passages.push((title, s, t)),
                                None => entries = false,
                            }
                        }
                        entries &= (1..=PASSAGES_SHOWN).contains(&list.len()) && row.passages.len() == list.len();
                    }
                    _ => entries = false,
                }
            }
        }
        r.push((shape, format!("{rel} has one entry per verse of {}", book.name)));
        r.push((entries, format!("{rel}: each verse has nothing, subjects citing it, or 1 to {PASSAGES_SHOWN} passages of 4 to {PASSAGE_MAX} verses that hold it")));
    }

    // The hidden subjects: each is a subject Ask lists, and none ever shows.
    let text = fs::read_to_string(root.join(DISPLAY)).map_err(|e| format!("reading {DISPLAY}: {e}"))?;
    let file: DisplayFile = serde_json::from_str(&text).map_err(|e| format!("parsing {DISPLAY}: {e}"))?;
    for h in &file.hide {
        let t = title(&h.key);
        r.push((topics.iter().any(|x| x[0] == t.as_str()), format!("{DISPLAY}: {} is a Nave's subject Ask lists", h.key)));
        r.push((!titles.contains(&t), format!("the hidden Nave's subject {t} never shows in naves/")));
    }

    // The cut entry: "Jesus, the Christ" keeps 1 Corinthians 1:24, cited by
    // whole lines, but not 1:10, which only its cut last line ("1CO 1") reached.
    let jesus = topics.iter().position(|t| t[0] == "Jesus, the Christ").ok_or("no Nave's subject Jesus, the Christ")?;
    let shard = read(&format!("ask/topics/{}.json", jesus / crate::ask::TOPIC_SHARD))?;
    let has = |verse: &str| -> Result<bool, String> {
        let v = d.resolve(verse)?.0 as u64;
        Ok(shard[jesus % crate::ask::TOPIC_SHARD]["v"].as_array().into_iter().flatten().any(|x| x[0].as_u64().zip(x[1].as_u64()).is_some_and(|(s, e)| s <= v && v <= e)))
    };
    r.push((has("1 Cor 1:24")? && !has("1 Cor 1:10")?, "Nave's Jesus, the Christ includes 1 Corinthians 1:24 but not 1:10 (its cut last line is left out)".to_string()));

    // Coverage: of the verses no theme reaches at Study (no theme of their
    // own, none through links), how many get a Nave's row; and the same for
    // Simple, where the rows are not shown, for comparison.
    let th = crate::themes::read(d)?;
    let rule: crate::themes::LinkRule = serde_json::from_value(d.meta["themeLinks"].clone()).map_err(|e| format!("meta.json themeLinks: {e}"))?;
    let c = d.container();
    let l_off = c.u32s("l_off").map_err(|e| format!("{e:?}"))?;
    let l_verse = c.u32s("l_verse").map_err(|e| format!("{e:?}"))?;
    let left: Vec<Vec<u32>> = th.themes.iter().map(|t| t.left.clone()).collect();
    let mut study_nothing = Vec::new();
    for (level, shown) in [("Study", vec![true; th.themes.len()]), ("Simple", th.themes.iter().map(crate::themes::ThemeOut::simple).collect())] {
        let links = crate::themes::Links::new(rule, &d.graph, &th.sets, &left, &shown, &l_off, &l_verse);
        let nothing: Vec<usize> = (0..n).filter(|&v| links.own[v].is_empty() && links.through(v as u32).is_empty()).collect();
        let direct = nothing.iter().filter(|&&v| !rows[v].direct.is_empty()).count();
        let passage = nothing.iter().filter(|&&v| !rows[v].passages.is_empty()).count();
        let none = nothing.len() - direct - passage;
        let pct = |k: usize| 100.0 * k as f64 / n as f64;
        eprintln!(
            "Nave's rows{}: {} verses ({:.1}%) have no theme of their own or through links; a Nave's subject cites {direct} ({:.1}%), {passage} ({:.1}%) are inside a Nave's passage, {none} ({:.1}%) still have nothing",
            if level == "Study" { " at Study" } else { " if shown at Simple (they are not)" },
            nothing.len(),
            pct(nothing.len()),
            pct(direct),
            pct(passage),
            pct(none),
        );
        if level == "Study" {
            let share = 100.0 * (direct + passage) as f64 / nothing.len().max(1) as f64;
            r.push((share >= 78.0, format!("at Study, {} of the {} verses no theme reaches get a Nave's row ({share:.1}%), expected 78% or more", direct + passage, nothing.len())));
            study_nothing = nothing;
        }
    }

    // Pins from the data: a verse no theme reaches at Study with a subject
    // citing it, one only inside a passage, and a hidden heading that stays out.
    let at = |verse: &str| -> Result<(bool, &Written), String> {
        let v = d.resolve(verse)?.0 as usize;
        Ok((study_nothing.binary_search(&v).is_ok(), &rows[v]))
    };
    let (none, gen26) = at("Gen 2:6")?;
    r.push((none && gen26.direct.first().map(String::as_str) == Some("Mist"), format!("Genesis 2:6 has no theme at Study and Nave's lists it under Mist first: {:?}", gen26.direct)));
    let (none, gen222) = at("Gen 2:22")?;
    let creation = (d.resolve("Gen 2:1")?.0, d.resolve("Gen 2:25")?.0);
    r.push((
        none && gen222.direct.is_empty() && gen222.passages.first().is_some_and(|p| p.0 == "Creation" && (p.1, p.2) == creation),
        format!("Genesis 2:22 has no theme at Study and is part of the passage Nave's lists under Creation (Genesis 2:1-25): {:?}", gen222.passages),
    ));
    let (_, sam) = at("1 Sam 17:43")?;
    r.push((!sam.direct.iter().chain(sam.passages.iter().map(|p| &p.0)).any(|t| t == "Dog (Sodomite?)"), format!("1 Samuel 17:43 never shows Dog (Sodomite?): {:?}", sam.direct)));
    Ok(r)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 66 books of 150 chapters of 60 verses: a verse is book * 9000 +
    /// (chapter - 1) * 60 + verse - 1.
    fn vz() -> Versification {
        Versification::from_counts(&vec![vec![60u16; 150]; 66])
    }

    fn at(book: u32, chapter: u32, verse: u32) -> u32 {
        book * 9000 + (chapter - 1) * 60 + verse - 1
    }

    fn subjects(csv: &str) -> (Vec<Subject>, Vec<(String, String)>) {
        let (mut bad, mut cut) = (0, Vec::new());
        let s = parse(csv, &vz(), &mut bad, &mut cut).unwrap();
        (s, cut)
    }

    #[test]
    fn csv_quoted_fields() {
        let rows = csv_rows("a,b,c\nA,\"X, Y\",\"-one \"\"two\"\"\n-three\"\n");
        assert_eq!(
            rows,
            vec![
                vec!["a", "b", "c"],
                vec!["A", "X, Y", "-one \"two\"\n-three"]
            ]
        );
    }

    #[test]
    fn lines_and_labels() {
        assert_eq!(
            split_line("-Called SLEEP DEU 31:16; JOB 7:21"),
            (0, "Called SLEEP", "DEU 31:16; JOB 7:21")
        );
        assert_eq!(
            split_line("     -JOB JOB 3; 6:8-11"),
            (1, "JOB", "JOB 3; 6:8-11")
        );
        assert_eq!(split_line("-See HATRED"), (0, "See HATRED", ""));
        assert_eq!(split_line("-INSTANCES OF"), (0, "INSTANCES OF", ""));
    }

    #[test]
    fn titles_and_slugs() {
        assert_eq!(title("SPEAKING, EVIL"), "Speaking, Evil");
        assert_eq!(title("JESUS, THE CHRIST"), "Jesus, the Christ");
        assert_eq!(slug("Speaking, Evil"), "speaking-evil");
        assert_eq!(slug("Love of God"), "love-of-god");
    }

    #[test]
    fn merged_ranges() {
        assert_eq!(
            merge(vec![(5, 7), (1, 2), (3, 4), (10, 10), (6, 9)]),
            vec![(1, 10)]
        );
        assert_eq!(count(&[(1, 3), (8, 8)]), 4);
    }

    #[test]
    fn an_entry_cut_at_a_cells_limit_loses_its_last_line() {
        let head = "-Head of the ekklesia EPH 1:22\n";
        let last = "-Head of every man 1CO 1";
        // A first line padded so the entry is exactly a cell long.
        let pad = CELL_MAX - head.len() - last.len();
        let entry = format!("-{}\n{head}{last}", "x".repeat(pad - 2));
        assert_eq!(entry.encode_utf16().count(), CELL_MAX);
        let (s, cut) = subjects(&format!("section,subject,entry\nJ,\"JESUS, THE CHRIST\",\"{entry}\"\n"));
        assert_eq!(cut, vec![("JESUS, THE CHRIST".to_string(), last.to_string())]);
        assert_eq!(s[0].lines.len(), 2);
        assert!(s[0].lines.iter().all(|l| !l.refs.iter().any(|&(a, _)| a == at(45, 1, 1))));
        // One character shorter: whole, the last line kept.
        let whole = entry.replacen('x', "", 1);
        let (s, cut) = subjects(&format!("section,subject,entry\nJ,\"JESUS, THE CHRIST\",\"{whole}\"\n"));
        assert!(cut.is_empty());
        assert_eq!(s[0].lines.last().unwrap().refs, vec![(at(45, 1, 1), at(45, 1, 60))]);
        // A doubled quote inside the cell counts once, as the spreadsheet saw it.
        let quoted = format!("-\"{}\n{head}{last}", "x".repeat(pad - 3));
        let (_, cut) = subjects(&format!("section,subject,entry\nJ,X,\"{}\"\n", quoted.replace('"', "\"\"")));
        assert_eq!(cut.len(), 1);
    }

    /// Listed subjects from (key, line refs), each line given as ranges.
    fn listed_of(subjects: &[Subject]) -> Vec<Listed> {
        listed(subjects).unwrap()
    }

    fn subject(key: &str, lines: &[&[(u32, u32)]]) -> Subject {
        Subject {
            key: key.to_string(),
            lines: lines.iter().map(|refs| Line { label: String::new(), parent: None, refs: refs.to_vec() }).collect(),
        }
    }

    #[test]
    fn spans_of_three_cite_four_to_sixty_are_passages() {
        let s = vec![
            subject("THREE", &[&[(10, 12)]]),
            subject("FOUR", &[&[(20, 23)]]),
            subject("SIXTY", &[&[(100, 159)]]),
            subject("SIXTY-ONE", &[&[(200, 260)]]),
        ];
        let l = listed_of(&s);
        let rows = rows(&s, &l, &[true; 4], 300);
        assert_eq!(rows[11], Row::Direct(vec![0]));
        assert_eq!(rows[13], Row::None);
        assert_eq!(rows[21], Row::Passages(vec![(1, 20, 23)]));
        assert_eq!(rows[159], Row::Passages(vec![(2, 100, 159)]));
        assert_eq!(rows[230], Row::None);
    }

    #[test]
    fn direct_rows_hide_passages_and_order_by_how_specific() {
        let s = vec![
            // Two lines cite verse 5, but the subject is large.
            subject("BIG", &[&[(5, 5)], &[(5, 6)], &[(100, 200)]]),
            // One line each: the smaller first, then by title.
            subject("SMALL", &[&[(5, 5)]]),
            subject("ALSO SMALL", &[&[(5, 5)]]),
            // A passage holding verse 5 does not show beside citations.
            subject("PASSAGE", &[&[(1, 10)]]),
            // Two passages hold verse 30: the shorter first; three: only two show.
            subject("LONG", &[&[(20, 50)]]),
            subject("SHORT", &[&[(28, 33)], &[(25, 40)]]),
            subject("MIDDLE", &[&[(26, 35)]]),
        ];
        let l = listed_of(&s);
        let rows = rows(&s, &l, &[true; 7], 60);
        assert_eq!(rows[5], Row::Direct(vec![0, 2, 1]));
        assert_eq!(rows[30], Row::Passages(vec![(5, 28, 33), (6, 26, 35)]));
        assert_eq!(rows[8], Row::Passages(vec![(3, 1, 10)]));
    }

    #[test]
    fn display_filter() {
        let hide = vec!["DOG (SODOMITE?)".to_string()];
        assert!(shown(Kind::Concept, "FRIENDSHIP", &hide));
        assert!(!shown(Kind::Concept, "DOG (SODOMITE?)", &hide));
        assert!(!shown(Kind::Person, "ABRAHAM", &hide));
        assert!(!shown(Kind::Place, "JERUSALEM", &hide));
        assert!(!shown(Kind::Name, "ABBA", &hide));
        // A hidden subject gives a verse no row, and a passage row may take its place.
        let s = vec![subject("DOG (SODOMITE?)", &[&[(5, 5)]]), subject("FRIENDSHIP", &[&[(1, 10)]])];
        let l = listed_of(&s);
        let show: Vec<bool> = s.iter().map(|x| shown(Kind::Concept, &x.key, &hide)).collect();
        assert_eq!(rows(&s, &l, &show, 20)[5], Row::Passages(vec![(1, 1, 10)]));
    }

    #[test]
    fn people_places_and_names() {
        let set = |xs: &[&str]| xs.iter().map(|s| s.to_string()).collect::<HashSet<_>>();
        let names = Names { people: set(&["abraham", "jordan"]), places: set(&["jerusalem", "jordan"]), glossed: set(&["abba"]), capitals: capitals(["Then Beth–el, the Amorites and the sea.", "The sea of Bethel."].into_iter()) };
        let lines = |labels: &[&str]| labels.iter().map(|l| Line { label: l.to_string(), parent: None, refs: Vec::new() }).collect::<Vec<_>>();
        assert_eq!(kind("FRIENDSHIP", &lines(&["Of David and Jonathan"]), &names), Kind::Concept);
        assert_eq!(kind("ABRAHAM", &lines(&["Son of Terah"]), &names), Kind::Person);
        assert_eq!(kind("JERUSALEM, CITY OF", &[], &names), Kind::Place);
        assert_eq!(kind("ABBA", &[], &names), Kind::Name);
        // Known as both: the lines decide, whole words only ("Mountains" is not "Mount").
        assert_eq!(kind("JORDAN", &lines(&["A river", "Mount of"]), &names), Kind::Place);
        assert_eq!(kind("JORDAN", &lines(&["A river", "Son of", "Sons of"]), &names), Kind::Person);
        assert_eq!(kind("JORDAN", &lines(&["Mountains of"]), &names), Kind::Person);
        // No list knows them, but the text writes them as names; "Sea" is
        // also written in lowercase, and "Then" only starts a sentence.
        assert_eq!(kind("AMORITES", &[], &names), Kind::Written);
        assert_eq!(kind("BETH-EL", &[], &names), Kind::Written);
        assert_eq!(kind("SEA", &[], &names), Kind::Concept);
        assert_eq!(kind("THEN", &[], &names), Kind::Concept);
    }
}
