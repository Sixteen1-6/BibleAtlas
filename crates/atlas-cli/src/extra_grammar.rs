//! Word choice: for every verse, the forms of its words that carry meaning,
//! read from the grammar tags STEPBible gives each Hebrew, Aramaic and Greek
//! word (CC BY 4.0, already sources). Nothing here is written by hand for a
//! verse: every point is a tag, a count or a pattern of tags, so a reader can
//! check each one against the word it sits on.
//!
//! What is found:
//! - each verb's form: in Greek its tense, voice and mood; in Hebrew and
//!   Aramaic its stem and form;
//! - constructions two or three tags make together: the Greek doubled "not"
//!   (ou with me), a forbidding me with a present command or an aorist
//!   subjunctive, a pronoun set beside a verb that already says who acts, a
//!   "not ... but"; the Hebrew verb said twice (its infinitive beside a
//!   finite form of the same root);
//! - chains: three or more "to" verbs or commands in a row, and four or more
//!   Hebrew "and then" verbs in one verse;
//! - lists: three or more Greek nouns or describing words set in a row;
//! - linking words (for, therefore, but, so that, lest, if, just as), each
//!   with the verses it looks back to where it opens a verse;
//! - words the Bible uses only once or twice.
//!
//! What a form means is never the build's own claim. `config/grammar.json`
//! holds each term's plain sentence, which may be shown only beside a
//! grammarian's own words (`says`), and every such quotation needs a record
//! of where it was read in `docs/evidence/grammar-reads.json`. STEPBible's
//! own expansion of each tag (its `TEGMC` and `TEHMC` files) is shown with
//! every verb.
//!
//! A writer's sentence on one verse's form (`config/grammar-notes.json`) is
//! held to the same rule from the other side. Each is a sentence of a
//! Christian writer whose notes the app already carries at Deep (the works of
//! `extra_voices`), on a verse whose tags show the form the sentence names.
//! The build refuses a sentence on a verse that lacks the form; `atlas
//! verify` refuses one that does not stand word for word in that writer's
//! note on that verse, as built from the pinned copy. They are people's
//! words, so the panel keeps them behind the commentary notice.
//!
//! Output:
//! - `extras/grammar.json`: the terms, the links, the works cited, the
//!   lines, one character per verse naming its line (`at`), and one per
//!   chapter saying whether it has an outline (`chapters`);
//! - `extras/grammar/<Book>.json`: each verse's points, the book's chains and
//!   lists, where its paragraphs start, and `notes`: by verse, each writer's
//!   sentence as `[work, word, terms, words]`, the work numbered as
//!   `extra_voices` numbers it and the word -1 when the sentence names none;
//! - `extras/grammar/codes-g.json`, `codes-h.json`: STEPBible's expansion of
//!   each verb tag used.

use crate::loaded::Loaded;
use crate::parse::{Lang, Word, WordsByVerse};
use crate::sources::Inputs;
use atlas_core::{Versification, BOOKS};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fs;
use std::path::Path;

pub const OUT: &str = "extras/grammar.json";
const CONFIG: &str = "config/grammar.json";
const READS: &str = "docs/evidence/grammar-reads.json";
const NOTES: &str = "config/grammar-notes.json";
/// The works a sentence may be from, with the number `extra_voices` gives
/// each: Wesley, Calvin, Jamieson-Fausset-Brown, Keil and Delitzsch, Barnes.
const NOTE_WORKS: [(&str, u8); 5] = [("wesley", 2), ("calvin", 3), ("jfb", 6), ("keil-delitzsch", 7), ("barnes", 8)];
/// STEPBible's expansions of its grammar tags.
pub const MORPH: &str = "step-morph";

/// The characters that name a verse's line in `at`: every printable ASCII
/// character but the quotation mark and the backslash. The first is "none".
const ALPHABET: &str = "!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~";

/// The longest chain or list a line counts; longer ones say "10 or more".
const COUNT_MAX: usize = 10;

// ------------------------------------------------------------------ config

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    #[serde(rename = "_comment")]
    _comment: Value,
    works: Vec<Work>,
    terms: Vec<Term>,
    links: Vec<Link>,
}

/// A grammar a term quotes.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Work {
    id: String,
    writer: String,
    /// Who the writer was, in one short phrase.
    about: String,
    /// Where `about` was read.
    about_from: String,
    title: String,
    /// The year of the edition read.
    written: String,
    /// The scan the words were read in.
    url: String,
    /// The site that holds the scan.
    site: String,
    /// The Sources shelf card (`config/shelf.json`).
    shelf: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Say {
    work: String,
    quote: String,
    /// The printed page, as the scan numbers it.
    page: String,
    /// The page's own address.
    url: String,
    /// The date the page was read.
    read: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Term {
    id: String,
    /// "greek", "hebrew", "aramaic" or "any".
    lang: String,
    /// The form's name: "Perfect".
    name: String,
    /// What the data shows, true of every place the term is put.
    fact: String,
    /// What the form conveys, in plain words. Shown only with `says`.
    #[serde(default)]
    plain: String,
    /// The verse line with `says`, after "Word choice: ".
    #[serde(default)]
    line: String,
    /// The verse line without `says`: the fact alone.
    line_fact: String,
    /// A caution the grammarians give, shown with `says`.
    #[serde(default)]
    care: String,
    #[serde(default)]
    says: Vec<Say>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Match {
    /// A root's Strong's key, whole ("G3754H") or its number ("G1063").
    root: String,
    /// The word-by-word English must start with one of these (after "and").
    /// Empty: any.
    #[serde(default)]
    gloss: Vec<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Link {
    id: String,
    /// The English word: "For".
    name: String,
    /// What the word does, in the lexicons' terms.
    plain: String,
    line: String,
    /// It looks back to what was just said.
    back: bool,
    words: Vec<Match>,
}

/// Every term the build can place, with the language it belongs to.
const TERMS: [(&str, &str); 44] = [
    ("g-present", "greek"),
    ("g-imperfect", "greek"),
    ("g-aorist", "greek"),
    ("g-future", "greek"),
    ("g-perfect", "greek"),
    ("g-pluperfect", "greek"),
    ("g-passive", "greek"),
    ("g-middle", "greek"),
    ("g-imperative", "greek"),
    ("g-subjunctive", "greek"),
    ("g-optative", "greek"),
    ("g-infinitive", "greek"),
    ("g-participle", "greek"),
    ("g-never", "greek"),
    ("g-forbid-present", "greek"),
    ("g-forbid-aorist", "greek"),
    ("g-pronoun", "greek"),
    ("g-not-but", "greek"),
    ("h-perfect", "hebrew"),
    ("h-imperfect", "hebrew"),
    ("h-then", "hebrew"),
    ("h-and-perfect", "hebrew"),
    ("h-imperative", "hebrew"),
    ("h-jussive", "hebrew"),
    ("h-cohortative", "hebrew"),
    ("h-infinitive-absolute", "hebrew"),
    ("h-infinitive", "hebrew"),
    ("h-participle", "hebrew"),
    ("h-niphal", "hebrew"),
    ("h-piel", "hebrew"),
    ("h-pual", "hebrew"),
    ("h-hiphil", "hebrew"),
    ("h-hophal", "hebrew"),
    ("h-hithpael", "hebrew"),
    ("h-twice", "hebrew"),
    ("a-perfect", "aramaic"),
    ("a-imperfect", "aramaic"),
    ("a-imperative", "aramaic"),
    ("a-participle", "aramaic"),
    ("a-infinitive", "aramaic"),
    ("chain-to", "greek"),
    ("chain-command", "any"),
    ("chain-then", "hebrew"),
    ("list", "greek"),
];
/// The term for a rare word; its line and fact take the count.
const RARE: &str = "rare";

fn normal(s: &str) -> String {
    let mut out = String::new();
    let mut gap = false;
    for c in s.chars() {
        if c.is_alphanumeric() {
            if gap && !out.is_empty() {
                out.push(' ');
            }
            gap = false;
            out.extend(c.to_lowercase());
        } else {
            gap = true;
        }
    }
    out
}

fn read_config(root: &Path) -> Result<Config, String> {
    let path = root.join(CONFIG);
    let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let c: Config = serde_json::from_str(&text).map_err(|e| format!("parsing {CONFIG}: {e}"))?;
    let raw: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    if let Some((at, p)) = crate::layers::ai_credit_in(&raw, "") {
        return Err(format!("{CONFIG}: {at} credits AI (\"{p}\"); credit the original source only"));
    }
    // Terms: exactly the ones the build places, each in its language.
    let mut want: BTreeMap<&str, &str> = TERMS.iter().copied().collect();
    want.insert(RARE, "any");
    for t in &c.terms {
        match want.remove(t.id.as_str()) {
            Some(lang) if lang == t.lang => {}
            Some(lang) => return Err(format!("{CONFIG}: term {} is \"{}\", the build places it as \"{lang}\"", t.id, t.lang)),
            None => return Err(format!("{CONFIG}: term {} is listed twice or is not one the build places", t.id)),
        }
        for (what, s) in [("name", &t.name), ("fact", &t.fact), ("line_fact", &t.line_fact)] {
            if s.trim().is_empty() {
                return Err(format!("{CONFIG}: term {} has no {what}", t.id));
            }
        }
        if t.says.is_empty() && !(t.plain.is_empty() && t.line.is_empty() && t.care.is_empty()) {
            return Err(format!(
                "{CONFIG}: term {} says what the form means (plain, line or care) with no grammarian's words (says); quote one or leave them empty",
                t.id
            ));
        }
        if !t.says.is_empty() && t.plain.trim().is_empty() {
            return Err(format!("{CONFIG}: term {} quotes a grammarian but has no plain sentence", t.id));
        }
        for line in [&t.line, &t.line_fact] {
            if line.chars().count() > 56 {
                return Err(format!("{CONFIG}: term {}: the line \"{line}\" is over 56 characters (70 with \"Word choice: \")", t.id));
            }
        }
    }
    if let Some((id, _)) = want.iter().next() {
        return Err(format!("{CONFIG}: no term {id}, which the build places"));
    }
    // Works and quotations.
    let works: BTreeSet<&str> = c.works.iter().map(|w| w.id.as_str()).collect();
    if works.len() != c.works.len() {
        return Err(format!("{CONFIG}: a work is listed twice"));
    }
    for w in &c.works {
        for (what, s) in [("writer", &w.writer), ("about", &w.about), ("about_from", &w.about_from), ("title", &w.title), ("written", &w.written), ("site", &w.site), ("shelf", &w.shelf)] {
            if s.trim().is_empty() {
                return Err(format!("{CONFIG}: work {} has no {what}", w.id));
            }
        }
        if !w.url.starts_with("https://") {
            return Err(format!("{CONFIG}: work {}: url must be an https address", w.id));
        }
    }
    let reads = read_reads(root)?;
    for t in &c.terms {
        for s in &t.says {
            if !works.contains(s.work.as_str()) {
                return Err(format!("{CONFIG}: term {} quotes \"{}\", which is not in works", t.id, s.work));
            }
            if !s.url.starts_with("https://") || s.page.trim().is_empty() || s.read.len() != 10 {
                return Err(format!("{CONFIG}: term {}: a quotation needs its page, its page's https address and the date it was read (YYYY-MM-DD)", t.id));
            }
            let q = normal(&s.quote);
            if q.split(' ').count() < 4 {
                return Err(format!("{CONFIG}: term {}: the quotation \"{}\" is under four words", t.id, s.quote));
            }
            let found = reads.iter().any(|r| r.work == s.work && r.page == s.page && normal(&r.quote) == q && normal(&r.context).contains(&q));
            if !found {
                return Err(format!(
                    "{CONFIG}: term {}: no record in {READS} of reading \"{}\" on page {} of {} (same work, page and words, inside the record's context)",
                    t.id, s.quote, s.page, s.work
                ));
            }
        }
    }
    // Links.
    let mut ids = BTreeSet::new();
    for l in &c.links {
        if !ids.insert(l.id.as_str()) {
            return Err(format!("{CONFIG}: link {} is listed twice", l.id));
        }
        if l.words.is_empty() || l.name.trim().is_empty() || l.plain.trim().is_empty() || l.line.trim().is_empty() {
            return Err(format!("{CONFIG}: link {} needs a name, a plain sentence, a line and its words", l.id));
        }
        if l.line.chars().count() > 56 {
            return Err(format!("{CONFIG}: link {}: the line is over 56 characters", l.id));
        }
    }
    Ok(c)
}

/// One record of a quotation read in a scan.
#[derive(Deserialize)]
struct Read {
    work: String,
    page: String,
    quote: String,
    context: String,
}

#[derive(Deserialize)]
struct Reads {
    checked: Vec<Read>,
}

fn read_reads(root: &Path) -> Result<Vec<Read>, String> {
    let path = root.join(READS);
    let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let r: Reads = serde_json::from_str(&text).map_err(|e| format!("parsing {READS}: {e}"))?;
    Ok(r.checked)
}

/// A writer's sentence on a verse's form.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Note {
    /// The verse, as "1John.1.7".
    at: String,
    /// One of [`NOTE_WORKS`].
    work: String,
    /// The forms the sentence names, which the verse must have.
    terms: Vec<String>,
    /// The place among the verse's words of the word the sentence quotes.
    #[serde(default)]
    word: Option<usize>,
    /// The writer's sentence, word for word.
    quote: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Notes {
    #[serde(rename = "_comment")]
    _comment: Value,
    notes: Vec<Note>,
}

/// A sentence placed: (verse, work, word, terms, words).
type Placed = (u32, u8, Option<usize>, Vec<usize>, String);

/// The writers' sentences, each on a verse that has every form it names
/// (on the word it quotes, when it quotes one).
fn read_notes(root: &Path, c: &Config, b: &Built, vz: &Versification) -> Result<Vec<Placed>, String> {
    let path = root.join(NOTES);
    let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let n: Notes = serde_json::from_str(&text).map_err(|e| format!("parsing {NOTES}: {e}"))?;
    let raw: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    if let Some((at, p)) = crate::layers::ai_credit_in(&raw, "") {
        return Err(format!("{NOTES}: {at} credits AI (\"{p}\"); credit the original source only"));
    }
    let cite = crate::layers::CiteList::read(root)?;
    let mut out: Vec<Placed> = Vec::new();
    let mut seen: BTreeSet<(u32, u8, String)> = BTreeSet::new();
    for note in &n.notes {
        let here = format!("{NOTES}: the sentence on {} from {}", note.at, note.work);
        let mut parts = note.at.rsplitn(3, '.');
        let verse: Option<u16> = parts.next().and_then(|x| x.parse().ok());
        let chapter: Option<u16> = parts.next().and_then(|x| x.parse().ok());
        let book = parts.next().and_then(|o| BOOKS.iter().position(|k| k.osis == o));
        let v = match (book, chapter, verse) {
            (Some(bk), Some(ch), Some(vs)) => vz.index(bk as u8, ch, vs),
            _ => None,
        }
        .ok_or_else(|| format!("{here}: {} is not a verse", note.at))?;
        let work = NOTE_WORKS.iter().find(|w| w.0 == note.work).map(|w| w.1).ok_or_else(|| format!("{here}: not a work the sentences may come from"))?;
        if note.quote.trim() != note.quote || note.quote.len() < 40 {
            return Err(format!("{here}: the words are too short, or have a space at an end"));
        }
        if let Some((name, _, _)) = cite.avoid().find(|(_, names, _)| names.iter().any(|m| note.quote.contains(m.as_str()))) {
            return Err(format!("{here}: its words name {name}, which is on the avoid list"));
        }
        if note.terms.is_empty() {
            return Err(format!("{here}: names no form"));
        }
        let mut ids = Vec::new();
        for id in &note.terms {
            let t = c.terms.iter().position(|t| &t.id == id).ok_or_else(|| format!("{here}: {id} is not a term"))?;
            let on = &b.verses[v as usize].verbs;
            let has = match note.word {
                Some(w) => on.iter().any(|(pos, terms)| *pos == w && terms.contains(&t)),
                None => on.iter().any(|(_, terms)| terms.contains(&t)),
            };
            if !has {
                return Err(format!("{here}: the tags do not show {id} there"));
            }
            ids.push(t);
        }
        if !seen.insert((v, work, note.quote.clone())) {
            return Err(format!("{here}: listed twice"));
        }
        out.push((v, work, note.word, ids, note.quote.clone()));
    }
    Ok(out)
}

// ------------------------------------------------------------- tag reading

/// A Greek verb's tense, voice, mood and what follows ("3S", "NSM").
fn greek_verb(morph: &str) -> Option<(char, char, char, &str)> {
    let mut parts = morph.split('-');
    if parts.next()? != "V" {
        return None;
    }
    let tvm = parts.next()?.trim_start_matches('2');
    let mut c = tvm.chars();
    let (t, v, m) = (c.next()?, c.next()?, c.next()?);
    if c.next().is_some() {
        return None;
    }
    Some((t, v, m, parts.next().unwrap_or("")))
}

/// A Hebrew or Aramaic verb's own tag ("HVqw3ms"), stem, form and what follows.
fn semitic_verb(morph: &str) -> Option<(String, char, char, &str)> {
    let lang = morph.chars().next().filter(|c| matches!(c, 'H' | 'A'))?;
    for seg in morph[1..].split('/') {
        let mut c = seg.chars();
        if c.next() == Some('V') {
            let (stem, form) = (c.next()?, c.next()?);
            return Some((format!("{lang}{seg}"), stem, form, &seg[3..]));
        }
    }
    None
}

fn greek_terms(t: char, v: char, m: char) -> Vec<&'static str> {
    let mut out = Vec::new();
    out.push(match t {
        'P' => "g-present",
        'I' => "g-imperfect",
        'A' => "g-aorist",
        'F' => "g-future",
        'R' => "g-perfect",
        'L' => "g-pluperfect",
        _ => return Vec::new(),
    });
    match v {
        'P' => out.push("g-passive"),
        'M' => out.push("g-middle"),
        _ => {}
    }
    match m {
        'M' => out.push("g-imperative"),
        'S' => out.push("g-subjunctive"),
        'O' => out.push("g-optative"),
        'N' => out.push("g-infinitive"),
        'P' | 'R' => out.push("g-participle"),
        _ => {}
    }
    out
}

fn semitic_terms(aramaic: bool, stem: char, form: char) -> Vec<&'static str> {
    let mut out = Vec::new();
    if aramaic {
        match form {
            'p' => out.push("a-perfect"),
            'i' => out.push("a-imperfect"),
            'v' => out.push("a-imperative"),
            'r' | 's' => out.push("a-participle"),
            'c' => out.push("a-infinitive"),
            _ => {}
        }
        return out;
    }
    match form {
        'p' => out.push("h-perfect"),
        'i' | 'u' => out.push("h-imperfect"),
        'w' => out.push("h-then"),
        'q' => out.push("h-and-perfect"),
        'v' => out.push("h-imperative"),
        'j' => out.push("h-jussive"),
        'h' => out.push("h-cohortative"),
        'a' => out.push("h-infinitive-absolute"),
        'c' => out.push("h-infinitive"),
        'r' | 's' => out.push("h-participle"),
        _ => {}
    }
    match stem {
        'N' => out.push("h-niphal"),
        'p' => out.push("h-piel"),
        'P' => out.push("h-pual"),
        'h' => out.push("h-hiphil"),
        'H' => out.push("h-hophal"),
        't' => out.push("h-hithpael"),
        _ => {}
    }
    out
}

/// A root's Strong's number without its sense letter: "G3754H" is "G3754".
fn base(key: &str) -> &str {
    let end = key.char_indices().skip(1).find(|(_, c)| !c.is_ascii_digit()).map_or(key.len(), |(i, _)| i);
    &key[..end]
}

/// The word-by-word English in lowercase letters and spaces, without a
/// leading "and", brackets or marks.
fn gloss(w: &Word) -> String {
    let g: String = w.gloss.to_lowercase().chars().filter(|c| c.is_alphabetic() || *c == ' ').collect();
    let g = g.split_whitespace().collect::<Vec<_>>().join(" ");
    g.strip_prefix("and ").map(str::to_string).unwrap_or(g)
}

/// A name of a person, place or people: never counted as a rare word or a list item.
fn is_name(w: &Word) -> bool {
    if w.lang == Lang::Greek {
        let mut p = w.morph.split('-');
        let (class, _, extra) = (p.next().unwrap_or(""), p.next(), p.next().unwrap_or(""));
        return matches!(class, "N" | "A") && matches!(extra, "P" | "L" | "T" | "PG" | "LG" | "TG");
    }
    w.morph[1..].split('/').any(|s| s.starts_with("Np") || s.starts_with("Ng") || s.starts_with("Ag"))
}

/// A Greek word's sentence ends with it.
fn ends_sentence(w: &Word) -> bool {
    w.surface.ends_with('.') || w.surface.ends_with(';')
}

// ------------------------------------------------------------- paragraphs

/// The verses that start a paragraph, a stanza or a section in the BSB's
/// USFM edition, and each chapter's first verse.
fn paragraph_starts(inputs: &Inputs, vz: &Versification) -> Result<Vec<bool>, String> {
    let mut starts = vec![false; vz.verse_count() as usize];
    for (b, book) in BOOKS.iter().enumerate() {
        let path = inputs.path(crate::poetry::SOURCE, book.osis);
        let usfm = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
        let (mut chapter, mut pending) = (0u16, true);
        for piece in usfm.split('\\').skip(1) {
            let marker = piece.split_whitespace().next().unwrap_or("");
            let rest = piece[marker.len()..].trim_start();
            match marker {
                "c" => {
                    chapter = rest.split_whitespace().next().and_then(|n| n.parse().ok()).unwrap_or(0);
                    pending = true;
                }
                "p" | "m" | "pi" | "pi1" | "pmo" | "pm" | "b" | "s1" | "s2" | "ms1" | "d" | "nb" => pending = true,
                "v" => {
                    let n: String = rest.chars().take_while(char::is_ascii_digit).collect();
                    if let Some(v) = n.parse().ok().and_then(|n| vz.index(b as u8, chapter, n)) {
                        if pending {
                            starts[v as usize] = true;
                        }
                    }
                    pending = false;
                }
                _ => {}
            }
        }
        starts[vz.book_start(b as u8) as usize] = true;
    }
    Ok(starts)
}

// ------------------------------------------------------------ tag expansions

/// STEPBible's expansion of each full tag: (the form in words, what it means, an example).
fn expansions(path: &Path) -> Result<HashMap<String, [String; 3]>, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let text = text.trim_start_matches('\u{feff}');
    let from = text.find("FULL MORPHOLOGY CODES").ok_or_else(|| format!("{}: no full codes section", path.display()))?;
    let mut out = HashMap::new();
    let mut lines = text[from..].lines().peekable();
    let clean = |s: &str| s.trim().trim_matches('"').replace('_', "").split_whitespace().collect::<Vec<_>>().join(" ");
    while let Some(line) = lines.next() {
        let Some((code, rest)) = line.split_once('\t') else { continue };
        if code.is_empty() || code.contains(' ') || !rest.starts_with("Function=") {
            continue;
        }
        let mut three = [String::new(), String::new(), String::new()];
        for slot in &mut three {
            match lines.peek() {
                Some(l) if l.starts_with('\t') => *slot = clean(lines.next().unwrap_or("")),
                _ => break,
            }
        }
        out.insert(code.to_string(), three);
    }
    if out.len() < 500 {
        return Err(format!("{}: only {} tags read", path.display(), out.len()));
    }
    Ok(out)
}

// ---------------------------------------------------------------- building

pub struct Sources<'a> {
    pub vz: &'a Versification,
    pub words: &'a WordsByVerse,
}

/// The verses a linking word looks back to.
type Back = Option<(u32, u32)>;

/// One verse's points, as written.
#[derive(Default, Clone)]
struct Verse {
    /// (position, terms)
    verbs: Vec<(usize, Vec<usize>)>,
    /// (term, positions)
    made: Vec<(usize, Vec<usize>)>,
    /// (position, link, the verses it looks back to)
    links: Vec<(usize, usize, Back)>,
    /// (position, uses, the other verse when there are two)
    rare: Vec<(usize, usize, Option<u32>)>,
    chains: Vec<usize>,
    lists: Vec<usize>,
}

impl Verse {
    fn is_empty(&self) -> bool {
        self.verbs.is_empty() && self.made.is_empty() && self.links.is_empty() && self.rare.is_empty() && self.chains.is_empty() && self.lists.is_empty()
    }
}

struct Built {
    verses: Vec<Verse>,
    /// (term, members as (verse, position)), numbered across the Bible.
    chains: Vec<(usize, Vec<(u32, usize)>)>,
    lists: Vec<Vec<(u32, usize)>>,
    starts: Vec<bool>,
    codes_g: BTreeMap<String, [String; 3]>,
    codes_h: BTreeMap<String, [String; 3]>,
    unknown_codes: usize,
    /// Each verse is in the Old Testament.
    old: Vec<bool>,
}

fn analyse(c: &Config, s: &Sources, starts: Vec<bool>, exp_g: &HashMap<String, [String; 3]>, exp_h: &HashMap<String, [String; 3]>) -> Built {
    let n = s.vz.verse_count() as usize;
    let term: HashMap<&str, usize> = c.terms.iter().enumerate().map(|(i, t)| (t.id.as_str(), i)).collect();
    let t = |id: &str| term[id];
    let mut verses = vec![Verse::default(); n];
    let (mut codes_g, mut codes_h) = (BTreeMap::new(), BTreeMap::new());
    let mut unknown_codes = 0usize;

    // How often each root is used, and where, names left out.
    let mut uses: HashMap<&str, Vec<u32>> = HashMap::new();
    for (v, vw) in s.words.iter().enumerate() {
        for w in vw.iter().filter(|w| w.main) {
            if let Some(k) = &w.lemma {
                uses.entry(base(k)).or_default().push(v as u32);
            }
        }
    }

    // Where each paragraph starts, looking back from any verse.
    let para_of = |v: usize| (0..=v).rev().find(|&p| starts[p]).unwrap_or(0);

    let mut chains: Vec<(usize, Vec<(u32, usize)>)> = Vec::new();
    let mut lists: Vec<Vec<(u32, usize)>> = Vec::new();
    // Open runs: Greek "to" verbs, Greek commands, Hebrew commands, each with
    // the main words passed since its last member.
    let mut to_run: Vec<(u32, usize)> = Vec::new();
    let mut command_g: (Vec<(u32, usize)>, usize) = (Vec::new(), 0);
    let mut command_h: (Vec<(u32, usize)>, usize) = (Vec::new(), 0);
    let close = |run: &mut Vec<(u32, usize)>, id: usize, chains: &mut Vec<(usize, Vec<(u32, usize)>)>| {
        if run.len() >= 3 {
            chains.push((id, std::mem::take(run)));
        } else {
            run.clear();
        }
    };

    for v in 0..n {
        let vw = &s.words[v];
        let book = s.vz.locate(v as u32).map_or(0, |l| l.0);
        // A chain stays inside one paragraph.
        if starts[v] {
            close(&mut to_run, t("chain-to"), &mut chains);
            close(&mut command_g.0, t("chain-command"), &mut chains);
            close(&mut command_h.0, t("chain-command"), &mut chains);
        }
        let main: Vec<usize> = (0..vw.len()).filter(|&i| vw[i].main).collect();
        let mut out = Verse::default();
        let mut then: Vec<usize> = Vec::new();

        for (mi, &i) in main.iter().enumerate() {
            let w = &vw[i];
            // --- verbs
            if w.lang == Lang::Greek {
                if let Some((tense, voice, mood, rest)) = greek_verb(&w.morph) {
                    let ids: Vec<usize> = greek_terms(tense, voice, mood).into_iter().map(t).collect();
                    if !ids.is_empty() {
                        out.verbs.push((i, ids));
                    }
                    match exp_g.get(&w.morph) {
                        Some(e) => {
                            codes_g.insert(w.morph.clone(), e.clone());
                        }
                        None => unknown_codes += 1,
                    }
                    // chains
                    command_g.1 += 1;
                    match mood {
                        'N' => to_run.push((v as u32, i)),
                        'I' | 'S' | 'O' | 'M' => close(&mut to_run, t("chain-to"), &mut chains),
                        _ => {}
                    }
                    match mood {
                        'M' => {
                            if command_g.1 > 15 {
                                close(&mut command_g.0, t("chain-command"), &mut chains);
                            }
                            command_g.0.push((v as u32, i));
                            command_g.1 = 0;
                        }
                        'I' => close(&mut command_g.0, t("chain-command"), &mut chains),
                        _ => {}
                    }
                    // a pronoun beside a verb that already says who acts
                    if matches!(mood, 'I' | 'S' | 'O' | 'M') && (rest.starts_with('1') || rest.starts_with('2')) {
                        let want = format!("P-{}N{}", &rest[..1], &rest[1..2.min(rest.len())]);
                        let near = main[mi.saturating_sub(4)..(mi + 5).min(main.len())].iter().copied().find(|&j| vw[j].morph == want);
                        if let Some(j) = near {
                            out.made.push((t("g-pronoun"), vec![j, i]));
                        }
                    }
                } else {
                    command_g.1 += 1;
                }
                if ends_sentence(w) {
                    close(&mut to_run, t("chain-to"), &mut chains);
                }
                let key = w.lemma.as_deref().map(base).unwrap_or("");
                // the doubled "not", and a forbidding "not"
                if matches!(key, "G3361" | "G3367") {
                    let before = mi.checked_sub(1).map(|p| &vw[main[p]]);
                    let verb = main[mi + 1..(mi + 4).min(main.len())].iter().copied().find_map(|j| greek_verb(&vw[j].morph).map(|g| (j, g)));
                    if key == "G3361" && before.is_some_and(|b| b.lemma.as_deref().map(base) == Some("G3756")) {
                        let mut at = vec![main[mi - 1], i];
                        if let Some((j, (tense, _, mood, _))) = verb {
                            if (tense == 'A' && mood == 'S') || (tense == 'F' && mood == 'I') {
                                at.push(j);
                            }
                        }
                        out.made.push((t("g-never"), at));
                    } else if let Some((j, (tense, _, mood, rest))) = verb {
                        if tense == 'P' && mood == 'M' {
                            out.made.push((t("g-forbid-present"), vec![i, j]));
                        } else if tense == 'A' && mood == 'S' && rest.starts_with('2') {
                            out.made.push((t("g-forbid-aorist"), vec![i, j]));
                        }
                    }
                }
                // "not ... but"
                if key == "G0235" {
                    let neg = main[..mi].iter().copied().rev().find(|&j| matches!(vw[j].lemma.as_deref().map(base), Some("G3756" | "G3361" | "G3761" | "G3366")));
                    if let Some(j) = neg {
                        out.made.push((t("g-not-but"), vec![j, i]));
                    }
                }
            } else if let Some((code, stem, form, _)) = semitic_verb(&w.morph) {
                let aramaic = w.lang == Lang::Aramaic;
                let ids: Vec<usize> = semitic_terms(aramaic, stem, form).into_iter().map(t).collect();
                if !ids.is_empty() {
                    out.verbs.push((i, ids));
                }
                match exp_h.get(&code) {
                    Some(e) => {
                        codes_h.insert(code, e.clone());
                    }
                    None => unknown_codes += 1,
                }
                command_h.1 += 1;
                if !aramaic {
                    match form {
                        'v' => {
                            if command_h.1 > 8 {
                                close(&mut command_h.0, t("chain-command"), &mut chains);
                            }
                            command_h.0.push((v as u32, i));
                            command_h.1 = 0;
                        }
                        'p' | 'w' => close(&mut command_h.0, t("chain-command"), &mut chains),
                        _ => {}
                    }
                    if form == 'w' {
                        then.push(i);
                    }
                    // the verb said twice: its infinitive beside a finite form of the same root
                    if form == 'a' {
                        let root = w.lemma.as_deref().map(base);
                        let twin = main[mi.saturating_sub(2)..(mi + 3).min(main.len())].iter().copied().find(|&j| {
                            j != i
                                && vw[j].lemma.as_deref().map(base) == root
                                && root.is_some()
                                && semitic_verb(&vw[j].morph).is_some_and(|(_, _, f, _)| matches!(f, 'p' | 'i' | 'w' | 'q' | 'j' | 'h' | 'v' | 'u'))
                        });
                        if let Some(j) = twin {
                            out.made.push((t("h-twice"), vec![i.min(j), i.max(j)]));
                        }
                    }
                }
            } else {
                command_h.1 += 1;
            }

            // --- linking words
            if let Some(key) = &w.lemma {
                let g = gloss(w);
                let hit = c.links.iter().position(|l| {
                    l.words.iter().any(|m| (m.root == *key || m.root == base(key)) && (m.gloss.is_empty() || m.gloss.iter().any(|x| g == *x || g.starts_with(&format!("{x} ")))))
                });
                if let Some(l) = hit {
                    // It opens the verse: first, or second or third for the Greek words that never come first.
                    let opens = if matches!(base(key), "G1063" | "G3767" | "G1161" | "G3305") { (1..=2).contains(&mi) } else { mi == 0 };
                    let back = if c.links[l].back && opens && v > 0 {
                        let p = para_of(v);
                        let from = if p == v { para_of(v - 1) } else { p };
                        let same_book = s.vz.locate(from as u32).map(|x| x.0) == Some(book);
                        same_book.then_some((from as u32, v as u32 - 1))
                    } else {
                        None
                    };
                    out.links.push((i, l, back));
                }
                // --- rare words
                // (Aramaic is left out: its words have Hebrew twins under other numbers.)
                if !is_name(w) && w.lang != Lang::Aramaic {
                    if let Some(at) = uses.get(base(key)) {
                        if at.len() <= 2 {
                            let other = at.iter().copied().find(|&o| o != v as u32);
                            if at.len() == 1 || other.is_some() {
                                out.rare.push((i, at.len(), other));
                            }
                        }
                    }
                }
            }
        }
        if then.len() >= 4 {
            chains.push((t("chain-then"), then.iter().map(|&i| (v as u32, i)).collect()));
        }
        // --- lists (Greek): nouns and describing words of one case and number in a row
        if vw.first().is_some_and(|w| w.lang == Lang::Greek) {
            let mut items: Vec<usize> = Vec::new();
            let mut joins: Vec<bool> = Vec::new(); // true: joined by "and"/"or"; false: by a comma
            let mut kind: Option<(char, char)> = None;
            let (mut comma, mut and) = (false, false);
            let mut flush = |items: &mut Vec<usize>, joins: &mut Vec<bool>| {
                let even = joins.iter().all(|&j| j) || joins.iter().all(|&j| !j);
                if items.len() >= 4 || (items.len() == 3 && even) {
                    lists.push(items.iter().map(|&i| (v as u32, i)).collect());
                }
                items.clear();
                joins.clear();
            };
            for &i in &main {
                let w = &vw[i];
                let k = nominal(w);
                let key = w.lemma.as_deref().map(base).unwrap_or("");
                if let Some(k) = k {
                    if !items.is_empty() && kind == Some(k) && (comma || and) {
                        joins.push(and);
                        items.push(i);
                    } else {
                        flush(&mut items, &mut joins);
                        items.push(i);
                        kind = Some(k);
                    }
                    comma = w.surface.ends_with(',') || w.surface.ends_with('·');
                    and = false;
                } else if matches!(key, "G2532" | "G2228" | "G3777" | "G3366" | "G3761" | "G3383" | "G5037") && !items.is_empty() {
                    and = true;
                } else if key == "G3588" && !items.is_empty() {
                    // the article before the next item
                } else {
                    flush(&mut items, &mut joins);
                    kind = None;
                }
            }
            flush(&mut items, &mut joins);
        }
        verses[v] = out;
    }
    close(&mut to_run, t("chain-to"), &mut chains);
    close(&mut command_g.0, t("chain-command"), &mut chains);
    close(&mut command_h.0, t("chain-command"), &mut chains);

    for (ci, (_, members)) in chains.iter().enumerate() {
        let mut seen = BTreeSet::new();
        for (v, _) in members {
            if seen.insert(*v) {
                verses[*v as usize].chains.push(ci);
            }
        }
    }
    for (li, members) in lists.iter().enumerate() {
        verses[members[0].0 as usize].lists.push(li);
    }
    let old = (0..n).map(|v| s.vz.locate(v as u32).is_some_and(|l| BOOKS[l.0 as usize].testament == atlas_core::canon::Testament::Old)).collect();
    Built { verses, chains, lists, starts, codes_g, codes_h, unknown_codes, old }
}

/// A Greek noun, describing word or participle that can stand in a list: its case and number.
fn nominal(w: &Word) -> Option<(char, char)> {
    if is_name(w) {
        return None;
    }
    let mut p = w.morph.split('-');
    let class = p.next()?;
    let second = p.next()?;
    let cn = match class {
        "N" | "A" => second,
        "V" if second.ends_with('P') => p.next()?,
        _ => return None,
    };
    let mut c = cn.chars();
    let (case, number) = (c.next()?, c.next()?);
    (matches!(case, 'N' | 'G' | 'D' | 'A' | 'V') && matches!(number, 'S' | 'P')).then_some((case, number))
}

/// The lines, and each verse's line.
fn lines(c: &Config, b: &Built) -> (Vec<String>, Vec<usize>) {
    let mut lines: Vec<String> = vec![String::new()];
    let mut index: HashMap<String, usize> = HashMap::new();
    let mut line = |s: String| -> usize {
        if let Some(&i) = index.get(&s) {
            return i;
        }
        lines.push(s.clone());
        index.insert(s, lines.len() - 1);
        lines.len() - 1
    };
    let of = |t: &Term| if t.says.is_empty() || t.line.is_empty() { t.line_fact.clone() } else { t.line.clone() };
    let counted = |t: &Term, n: usize| {
        let n = if n >= COUNT_MAX { format!("{COUNT_MAX} or more") } else { n.to_string() };
        of(t).replace("{n}", &n)
    };
    let term: HashMap<&str, usize> = c.terms.iter().enumerate().map(|(i, t)| (t.id.as_str(), i)).collect();
    let rare = &c.terms[term[RARE]];
    let first = ["g-perfect", "g-pluperfect"].map(|id| term[id]);
    // The constructions that lead a verse's line.
    let strong = ["g-never", "h-twice", "g-forbid-present", "g-forbid-aorist"].map(|id| term[id]);
    // Verb terms from the most telling to the least.
    let order = [
        "g-optative", "g-imperative", "g-passive", "g-middle", "g-subjunctive", "g-imperfect", "g-future", "g-aorist", "g-present", "g-participle", "g-infinitive", "h-infinitive-absolute",
        "h-hithpael", "h-hiphil", "h-hophal", "h-niphal", "h-piel", "h-pual", "h-imperative", "h-jussive", "h-cohortative", "h-and-perfect", "h-then", "h-perfect", "h-imperfect", "h-participle",
        "h-infinitive", "a-imperative", "a-perfect", "a-imperfect", "a-participle", "a-infinitive",
    ]
    .map(|id| term[id]);
    let mut at = vec![0usize; b.verses.len()];
    for (v, p) in b.verses.iter().enumerate() {
        if p.is_empty() {
            continue;
        }
        let has = |id: usize| p.verbs.iter().any(|(_, ids)| ids.contains(&id));
        let made = |ids: &[usize]| ids.iter().copied().find(|id| p.made.iter().any(|m| m.0 == *id));
        at[v] = if let Some(id) = made(&strong) {
            line(of(&c.terms[id]))
        } else if let Some(&ci) = p.chains.first() {
            line(counted(&c.terms[b.chains[ci].0], b.chains[ci].1.len()))
        } else if let Some(&li) = p.lists.first() {
            line(counted(&c.terms[term["list"]], b.lists[li].len()))
        } else if let Some(id) = made(&[term["g-not-but"]]) {
            line(of(&c.terms[id]))
        } else if let Some(&id) = first.iter().find(|&&id| has(id)) {
            line(of(&c.terms[id]))
        } else if let Some(l) = p.links.iter().map(|x| x.1).min() {
            line(c.links[l].line.clone())
        } else if let Some(id) = made(&[term["g-pronoun"]]) {
            line(of(&c.terms[id]))
        } else if let Some((_, n, _)) = p.rare.first() {
            line(of(rare).replace("{n}", if *n == 1 { "once" } else { "twice" }).replace("{where}", if b.old[v] { "Old Testament" } else { "New Testament" }))
        } else if let Some(&id) = order.iter().find(|&&id| has(id)) {
            line(of(&c.terms[id]))
        } else {
            0
        };
    }
    (lines, at)
}

pub fn build(root: &Path, inputs: &Inputs, s: &Sources) -> Result<Vec<(String, Vec<u8>)>, String> {
    let c = read_config(root)?;
    let starts = paragraph_starts(inputs, s.vz)?;
    let exp_g = expansions(&inputs.path(MORPH, "greek"))?;
    let exp_h = expansions(&inputs.path(MORPH, "hebrew"))?;
    let b = analyse(&c, s, starts, &exp_g, &exp_h);
    let (lines, at) = lines(&c, &b);
    if lines.len() > ALPHABET.chars().count() {
        return Err(format!("grammar: {} different lines, more than the {} the index can name", lines.len(), ALPHABET.chars().count()));
    }
    let alphabet: Vec<char> = ALPHABET.chars().collect();
    let at: String = at.iter().map(|&i| alphabet[i]).collect();

    let mut files = Vec::new();
    let to_vec = |v: &Value| serde_json::to_vec(v).map_err(|e| e.to_string());
    let notes = read_notes(root, &c, &b, s.vz)?;

    // Each book's file, and which chapters have an outline.
    let mut chapters = String::new();
    let (mut verbs, mut made, mut links, mut rare) = (0usize, 0usize, 0usize, 0usize);
    for (bi, book) in BOOKS.iter().enumerate() {
        let from = s.vz.book_start(bi as u8) as usize;
        let to = if bi + 1 < BOOKS.len() { s.vz.book_start(bi as u8 + 1) as usize } else { b.verses.len() };
        let mut v_map = serde_json::Map::new();
        let mut chain_ids: BTreeSet<usize> = BTreeSet::new();
        let mut list_ids: BTreeSet<usize> = BTreeSet::new();
        for p in &b.verses[from..to] {
            chain_ids.extend(p.chains.iter().copied());
            list_ids.extend(p.lists.iter().copied());
        }
        let chain_at: HashMap<usize, usize> = chain_ids.iter().enumerate().map(|(i, &c)| (c, i)).collect();
        let list_at: HashMap<usize, usize> = list_ids.iter().enumerate().map(|(i, &l)| (l, i)).collect();
        let mut joined: BTreeMap<u16, usize> = BTreeMap::new();
        for (v, p) in b.verses.iter().enumerate().take(to).skip(from) {
            if p.is_empty() {
                continue;
            }
            let mut pts: Vec<Value> = Vec::new();
            for (pos, ids) in &p.verbs {
                pts.push(json!(["v", pos, ids]));
            }
            for (id, pos) in &p.made {
                pts.push(json!(["x", id, pos]));
            }
            for (pos, l, back) in &p.links {
                pts.push(match back {
                    Some((f, t)) => json!(["j", pos, l, f, t]),
                    None => json!(["j", pos, l]),
                });
            }
            for (pos, n, other) in &p.rare {
                pts.push(match other {
                    Some(o) => json!(["r", pos, n, o]),
                    None => json!(["r", pos, n]),
                });
            }
            for ci in &p.chains {
                pts.push(json!(["c", chain_at[ci]]));
            }
            for li in &p.lists {
                pts.push(json!(["l", list_at[li]]));
            }
            verbs += p.verbs.len();
            made += p.made.len();
            links += p.links.len();
            rare += p.rare.len();
            let ch = s.vz.locate(v as u32).map_or(0, |l| l.1);
            *joined.entry(ch).or_default() += p.links.len() + p.chains.len() + p.lists.len();
            v_map.insert(v.to_string(), Value::Array(pts));
        }
        for ch in 1..=s.vz.chapters_in(bi as u8) {
            chapters.push(if joined.get(&ch).copied().unwrap_or(0) >= 3 { '1' } else { '0' });
        }
        let mut note_map: BTreeMap<u32, Vec<Value>> = BTreeMap::new();
        for (v, work, word, terms, quote) in notes.iter().filter(|n| (from..to).contains(&(n.0 as usize))) {
            note_map.entry(*v).or_default().push(json!([work, word.map_or(-1, |w| w as i64), terms, quote]));
        }
        let mut doc = json!({
            "format": 1,
            "v": v_map,
            "chains": chain_ids.iter().map(|&ci| json!([b.chains[ci].0, b.chains[ci].1])).collect::<Vec<_>>(),
            "lists": list_ids.iter().map(|&li| json!(b.lists[li])).collect::<Vec<_>>(),
            "starts": (from..to).filter(|&v| b.starts[v]).collect::<Vec<_>>(),
        });
        if !note_map.is_empty() {
            doc["notes"] = json!(note_map.iter().map(|(v, list)| (v.to_string(), json!(list))).collect::<serde_json::Map<String, Value>>());
        }
        files.push((format!("extras/grammar/{}.json", book.osis), to_vec(&doc)?));
    }
    files.push(("extras/grammar/codes-g.json".to_string(), to_vec(&json!({ "format": 1, "codes": b.codes_g }))?));
    files.push(("extras/grammar/codes-h.json".to_string(), to_vec(&json!({ "format": 1, "codes": b.codes_h }))?));

    let works: Vec<Value> = c
        .works
        .iter()
        .map(|w| json!({ "id": w.id, "writer": w.writer, "about": w.about, "title": w.title, "written": w.written, "url": w.url, "site": w.site, "shelf": w.shelf }))
        .collect();
    let terms: Vec<Value> = c
        .terms
        .iter()
        .map(|t| {
            let mut o = json!({ "id": t.id, "lang": t.lang, "name": t.name, "fact": t.fact });
            if !t.says.is_empty() {
                o["plain"] = json!(t.plain);
                if !t.care.is_empty() {
                    o["care"] = json!(t.care);
                }
                o["says"] = t.says.iter().map(|s| json!({ "work": s.work, "quote": s.quote, "page": s.page, "url": s.url, "read": s.read })).collect();
            }
            o
        })
        .collect();
    let link_rows: Vec<Value> = c.links.iter().map(|l| json!({ "id": l.id, "name": l.name, "plain": l.plain, "back": l.back })).collect();
    let quoted = c.terms.iter().filter(|t| !t.says.is_empty()).count();
    let doc = json!({ "format": 1, "works": works, "terms": terms, "links": link_rows, "lines": lines, "at": at, "chapters": chapters });
    files.push((OUT.to_string(), to_vec(&doc)?));

    let with = b.verses.iter().filter(|p| !p.is_empty()).count();
    eprintln!(
        "grammar: {with} of {} verses have a point: {verbs} verb forms, {made} constructions, {} chains, {} lists, {links} linking words, {rare} rare words; {quoted} of {} terms carry a grammarian's words; {} verb tags STEPBible does not expand",
        b.verses.len(),
        b.chains.len(),
        b.lists.len(),
        c.terms.len(),
        b.unknown_codes
    );
    let on: BTreeSet<u32> = notes.iter().map(|n| n.0).collect();
    let by = |w: u8| notes.iter().filter(|n| n.1 == w).count();
    eprintln!(
        "grammar: {} sentences of Christian writers on a form of {} verses: {} of Wesley's, {} of Calvin's, {} of Jamieson, Fausset and Brown's, {} of Keil and Delitzsch's, {} of Barnes's; {} name the word",
        notes.len(),
        on.len(),
        by(2),
        by(3),
        by(6),
        by(7),
        by(8),
        notes.iter().filter(|n| n.2.is_some()).count()
    );
    Ok(files)
}

// ------------------------------------------------------------------ verify

fn file(d: &Loaded, rel: &str) -> Result<Value, String> {
    let path = d.dir.join(rel);
    let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))
}

/// All the words of a writer's note as `extra_voices` writes it: a string,
/// or strings and `[from, to, words]` verse links.
fn voice_words(text: &Value) -> String {
    match text {
        Value::String(s) => s.clone(),
        Value::Array(a) => a
            .iter()
            .map(|r| match r {
                Value::String(s) => s.as_str(),
                Value::Array(x) => x.last().and_then(Value::as_str).unwrap_or(""),
                _ => "",
            })
            .collect(),
        _ => String::new(),
    }
}

/// Checks for `atlas verify`: sound files, and places known apart from this code.
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let index = file(d, OUT)?;
    let n = d.vz.verse_count() as usize;
    let at: Vec<char> = index["at"].as_str().unwrap_or("").chars().collect();
    let line_count = index["lines"].as_array().map_or(0, Vec::len);
    let terms = index["terms"].as_array().cloned().unwrap_or_default();
    let term = |id: &str| terms.iter().position(|t| t["id"] == id);
    let links = index["links"].as_array().cloned().unwrap_or_default();
    let link = |id: &str| links.iter().position(|l| l["id"] == id);
    let mut out = vec![
        (at.len() == n, format!("grammar: the index names a line for each of the {n} verses")),
        (at.iter().all(|c| ALPHABET.find(*c).is_some_and(|i| i < line_count)), "grammar: every verse's line is one of the lines".to_string()),
        (at.iter().filter(|&&c| c != '!').count() > n * 9 / 10, "grammar: more than nine verses in ten have a point".to_string()),
        (
            terms.iter().all(|t| t.get("plain").is_none() || t["says"].as_array().is_some_and(|s| !s.is_empty())),
            "grammar: no term says what a form means without a grammarian's words".to_string(),
        ),
        (crate::layers::ai_credit_in(&index, "").is_none(), "grammar: nothing a reader sees credits AI".to_string()),
        (
            terms.iter().flat_map(|t| t["says"].as_array().cloned().unwrap_or_default()).all(|s| {
                let work = index["works"].as_array().is_some_and(|w| w.iter().any(|w| w["id"] == s["work"]));
                work && s["url"].as_str().is_some_and(|u| u.starts_with("https://")) && s["page"].as_str().is_some_and(|p| !p.is_empty()) && s["read"].as_str().is_some_and(|r| r.len() == 10)
            }),
            "grammar: every quotation names its work, its page, the page's address and the day it was read".to_string(),
        ),
        (
            ["g-present", "g-aorist", "g-perfect", "h-perfect", "h-imperfect", "h-twice"].iter().all(|id| term(id).is_some_and(|i| terms[i]["says"].as_array().is_some_and(|s| !s.is_empty()))),
            "grammar: the Greek present, aorist and perfect, and the Hebrew perfect, imperfect and doubled verb, are each explained in a grammarian's own words".to_string(),
        ),
    ];
    // A verse's points of one kind.
    let points = |r: &str, kind: &str| -> Result<Vec<Value>, String> {
        let (v, _) = d.resolve(r)?;
        let (b, _, _) = d.vz.locate(v).ok_or("verse out of range")?;
        let book = file(d, &format!("extras/grammar/{}.json", BOOKS[b as usize].osis))?;
        let pts = book["v"][v.to_string()].as_array().cloned().unwrap_or_default();
        Ok(pts
            .into_iter()
            .filter(|p| p[0] == kind)
            .map(|p| {
                if kind == "c" {
                    book["chains"][p[1].as_u64().unwrap_or(0) as usize].clone()
                } else if kind == "l" {
                    book["lists"][p[1].as_u64().unwrap_or(0) as usize].clone()
                } else {
                    p
                }
            })
            .collect())
    };
    let has_verb = |r: &str, id: &str| -> Result<bool, String> {
        let want = term(id).map(|i| i as u64);
        Ok(points(r, "v")?.iter().any(|p| p[2].as_array().is_some_and(|ids| ids.iter().any(|x| x.as_u64() == want))))
    };
    let has_made = |r: &str, id: &str| -> Result<bool, String> {
        let want = term(id).map(|i| i as u64);
        Ok(points(r, "x")?.iter().any(|p| p[1].as_u64() == want))
    };
    let has_link = |r: &str, id: &str| -> Result<bool, String> {
        let want = link(id).map(|i| i as u64);
        Ok(points(r, "j")?.iter().any(|p| p[2].as_u64() == want))
    };
    let chain = |r: &str, id: &str| -> Result<usize, String> {
        let want = term(id).map(|i| i as u64);
        Ok(points(r, "c")?.iter().filter(|c| c[0].as_u64() == want).map(|c| c[1].as_array().map_or(0, Vec::len)).max().unwrap_or(0))
    };
    out.push((has_verb("John 19:30", "g-perfect")?, "grammar: \"It is finished\" (John 19:30) is a perfect".to_string()));
    out.push((has_verb("Titus 3:5", "g-aorist")?, "grammar: \"He saved us\" (Titus 3:5) is an aorist".to_string()));
    out.push((has_verb("Ephesians 2:8", "g-passive")? && has_verb("Ephesians 2:8", "g-perfect")?, "grammar: \"you have been saved\" (Ephesians 2:8) is a perfect passive".to_string()));
    out.push((has_verb("1 John 3:9", "g-present")?, "grammar: 1 John 3:9 has a present".to_string()));
    out.push((chain("Titus 3:1", "chain-to")? >= 5, "grammar: Titus 3:1-2 is a chain of five or more \"to\" verbs".to_string()));
    out.push((chain("Genesis 25:34", "chain-then")? >= 5, "grammar: Genesis 25:34 has five \"and then\" verbs".to_string()));
    out.push((chain("Isaiah 1:16", "chain-command")? >= 5, "grammar: Isaiah 1:16-17 is a chain of commands".to_string()));
    out.push((has_made("John 10:28", "g-never")?, "grammar: \"they will never perish\" (John 10:28) has the doubled not".to_string()));
    out.push((has_made("Hebrews 13:5", "g-never")?, "grammar: \"never will I leave you\" (Hebrews 13:5) has the doubled not".to_string()));
    out.push((has_made("Genesis 2:17", "h-twice")?, "grammar: \"you will surely die\" (Genesis 2:17) says the verb twice".to_string()));
    out.push((has_made("Titus 3:5", "g-not-but")?, "grammar: Titus 3:5 has \"not ... but\"".to_string()));
    out.push((has_link("Titus 3:3", "for")?, "grammar: Titus 3:3 opens with \"for\"".to_string()));
    out.push((has_link("Titus 3:4", "but")?, "grammar: Titus 3:4 turns on \"but\"".to_string()));
    out.push((has_link("Romans 12:1", "therefore")?, "grammar: Romans 12:1 opens with \"therefore\"".to_string()));
    let back = points("Romans 12:1", "j")?.into_iter().find(|p| p.as_array().is_some_and(|a| a.len() == 5));
    let (r11, _) = d.resolve("Romans 11:33")?;
    let (r1136, _) = d.resolve("Romans 11:36")?;
    out.push((
        back.is_some_and(|p| p[3].as_u64() == Some(r11.into()) && p[4].as_u64() == Some(r1136.into())),
        "grammar: the \"therefore\" of Romans 12:1 looks back to the paragraph before it (11:33-36)".to_string(),
    ));
    out.push((has_link("Genesis 2:17", "for")?, "grammar: Genesis 2:17 has \"for\"".to_string()));
    out.push((!points("Galatians 5:22", "l")?.is_empty(), "grammar: the fruit of the Spirit (Galatians 5:22) is a list".to_string()));
    out.push((points("Romans 12:1", "r")?.len() <= 2, "grammar: Romans 12:1 has few rare words".to_string()));
    // The writers' sentences: each on a verse whose tags show its forms, and
    // each word for word in that writer's note on the verse.
    let (mut count, mut formed, mut found) = (0usize, 0usize, 0usize);
    let mut missing: Vec<String> = Vec::new();
    let mut per_work = [0usize; 16];
    for (bi, book) in BOOKS.iter().enumerate() {
        let doc = file(d, &format!("extras/grammar/{}.json", book.osis))?;
        let Some(notes) = doc["notes"].as_object() else { continue };
        // The book's notes by the writers, as (work, first verse, last verse, words).
        let mut voices: Vec<(u64, u64, u64, String)> = Vec::new();
        for dir in ["extras/voices", "extras/voices/full", "extras/voices/kd", "extras/voices/barnes"] {
            let Ok(list) = fs::read_dir(d.dir.join(dir)) else { continue };
            for entry in list.flatten() {
                let name = entry.file_name().to_string_lossy().into_owned();
                if !name.starts_with(&format!("{}.", book.osis)) || !name.ends_with(".json") {
                    continue;
                }
                let part = file(d, &format!("{dir}/{name}"))?;
                for item in part["items"].as_array().into_iter().flatten() {
                    for voice in item[3].as_array().into_iter().flatten() {
                        voices.push((item[0].as_u64().unwrap_or(99), item[1].as_u64().unwrap_or(0), item[2].as_u64().unwrap_or(0), voice_words(&voice[1])));
                    }
                }
            }
        }
        for (v, list) in notes {
            let verse: u64 = v.parse().map_err(|_| format!("grammar: {v} is not a verse number"))?;
            let in_book = d.vz.locate(verse as u32).is_some_and(|l| l.0 as usize == bi);
            for note in list.as_array().into_iter().flatten() {
                count += 1;
                let work = note[0].as_u64().unwrap_or(99);
                per_work[(work as usize).min(15)] += 1;
                let word = note[1].as_i64().unwrap_or(-1);
                let quote = note[3].as_str().unwrap_or("");
                let pts = doc["v"][v].as_array().cloned().unwrap_or_default();
                let shows = |t: &Value| pts.iter().any(|p| p[0] == "v" && (word < 0 || p[1].as_i64() == Some(word)) && p[2].as_array().is_some_and(|ids| ids.contains(t)));
                if in_book && note[2].as_array().is_some_and(|ts| !ts.is_empty() && ts.iter().all(shows)) {
                    formed += 1;
                }
                if !quote.is_empty() && voices.iter().any(|(w, f, t, words)| *w == work && *f <= verse && verse <= *t && words.contains(quote)) {
                    found += 1;
                } else if missing.len() < 3 {
                    missing.push(format!("{} {v}", book.osis));
                }
            }
        }
    }
    out.push((count >= 150, format!("grammar: {count} sentences of Christian writers on a verse's form (150 or more)")));
    out.push((formed == count, format!("grammar: all {count} writers' sentences are on a verse whose tags show the form they name ({formed})")));
    out.push((
        found == count,
        format!("grammar: all {count} writers' sentences stand word for word in that writer's note on the verse ({found}{})", if missing.is_empty() { String::new() } else { format!("; not found: {}", missing.join(", ")) }),
    ));
    out.push((NOTE_WORKS.iter().all(|w| per_work[w.1 as usize] > 0), "grammar: Wesley, Calvin, Jamieson-Fausset-Brown, Keil and Delitzsch, and Barnes each have a sentence".to_string()));
    let codes = file(d, "extras/grammar/codes-g.json")?;
    out.push((codes["codes"]["V-RPI-3S"][0].as_str().is_some_and(|s| s.contains("Perfect Passive Indicative")), "grammar: STEPBible's expansion of V-RPI-3S is kept".to_string()));
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_tags() {
        assert_eq!(greek_verb("V-RPI-3S"), Some(('R', 'P', 'I', "3S")));
        assert_eq!(greek_verb("V-2AAP-NSM"), Some(('A', 'A', 'P', "NSM")));
        assert_eq!(greek_verb("V-PAN"), Some(('P', 'A', 'N', "")));
        assert_eq!(greek_verb("N-NSM"), None);
        let (code, stem, form, rest) = semitic_verb("HC/Vqw3ms/Sp3ms").unwrap();
        assert_eq!((code.as_str(), stem, form, rest), ("HVqw3ms", 'q', 'w', "3ms"));
        assert_eq!(semitic_verb("HNcmsa"), None);
        assert_eq!(base("G3754H"), "G3754");
        assert_eq!(base("H0518A"), "H0518");
        assert_eq!(base("G1063"), "G1063");
    }

    #[test]
    fn terms_by_tag() {
        assert_eq!(greek_terms('R', 'P', 'I'), vec!["g-perfect", "g-passive"]);
        assert_eq!(greek_terms('P', 'A', 'M'), vec!["g-present", "g-imperative"]);
        assert_eq!(semitic_terms(false, 'h', 'w'), vec!["h-then", "h-hiphil"]);
        assert_eq!(semitic_terms(true, 'q', 'p'), vec!["a-perfect"]);
        for id in greek_terms('A', 'M', 'N').into_iter().chain(semitic_terms(false, 'N', 'a')) {
            assert!(TERMS.iter().any(|t| t.0 == id), "{id} is not a listed term");
        }
    }

    #[test]
    fn normal_drops_marks() {
        assert_eq!(normal("The Perfect; it's done."), "the perfect it s done");
    }

    #[test]
    fn alphabet_is_json_safe() {
        assert!(!ALPHABET.contains('"') && !ALPHABET.contains('\\'));
        assert_eq!(ALPHABET.chars().count(), 92);
    }
}
