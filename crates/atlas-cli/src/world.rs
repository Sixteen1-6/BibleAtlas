//! Words in their world: what a word meant to the people who first heard it.
//!
//! Two short lines in the word study, each with more one tap away:
//!
//! - **Outside the Bible** (Greek roots): how Greek writers used the word,
//!   with the writer and the century, from the Liddell-Scott-Jones lexicon
//!   (Perseus Digital Library) as formatted and dated by STEPBible's TFLSJ.
//! - **In their world** (Hebrew and Greek roots): the opening of the United
//!   Bible Societies' handbook article on the animal, plant or human-made
//!   thing the word names, linked to the root through the verses it cites.
//!
//! Nothing here is written by this project. The build only selects and
//! shortens the sources' own words by the fixed rules below, and turns their
//! markup into plain segments `[text, style, verse]`, exactly like `lex/`.
//!
//! Output, all under `world/`:
//! - `<k>.json`, one slot per root (500 per shard): `null`, or an object with
//!   `l` (up to five LSJ senses `[gloss, century, writer, flags]`), `f` (the
//!   earliest dated citation `[century, writer]`), `p` and `i` (LSJ also cites
//!   papyri or inscriptions) and `u` (handbook links `[entry, general, verses]`);
//! - `ubs.json`: the linked handbook entries `[handbook, key, title, lead]`;
//! - `ubs/<n>.json`: the kept sections of 40 entries per shard.

use crate::loaded::Loaded;
use crate::sources::Inputs;
use atlas_core::canon::{by_step, BOOKS};
use atlas_core::Versification;
use serde_json::{json, Map, Value};
use std::cmp::Ordering;
use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::{Path, PathBuf};

/// Roots per `world/<k>.json` shard (the same as `lex/`).
pub const ROOT_SHARD: usize = 500;
/// Handbook entries per `world/ubs/<n>.json` shard. (100 would put the
/// Fauna and Flora articles over the 200 KB budget.)
pub const ARTICLE_SHARD: usize = 40;
/// The most LSJ senses kept for one root, and the longest gloss.
const MAX_SENSES: usize = 5;
const GLOSS_CHARS: usize = 90;
/// The longest lead, in characters.
const LEAD_CHARS: usize = 240;
/// A section heading longer than this is a sentence, not a heading.
const TITLE_CHARS: usize = 40;
/// Size budget: every file, and the whole folder.
const MAX_FILE_BYTES: usize = 200 * 1024;
const MAX_TOTAL_BYTES: usize = 2_500_000;
const BOLD: u8 = 1;
const ITALIC: u8 = 2;

/// `[text, style bits, verse index or -1]`, the same shape as `lex/` segments.
type Seg = (String, u8, i64);

// ---------------------------------------------------------------- text helpers

/// Whitespace as Python's `\s` and `str.split()` see it, which is what the
/// reference prototypes used.
fn is_space(c: char) -> bool {
    c.is_whitespace() || ('\u{1c}'..='\u{1f}').contains(&c)
}

/// A handbook cross-reference without its section number: "1.5.3 Cloth
/// manufacture" -> "Cloth manufacture". The numbers belong to the printed
/// handbook and mean nothing to a reader of the app, so only the name stays.
fn without_key(s: &str) -> &str {
    let t = s.trim_start_matches(is_space);
    let end = t
        .find(|c: char| !(c.is_ascii_digit() || c == '.'))
        .unwrap_or(t.len());
    let (key, rest) = t.split_at(end);
    let name = rest.trim_start_matches(is_space);
    if !key.starts_with(|c: char| c.is_ascii_digit()) || name.len() == rest.len() || name.is_empty()
    {
        return s;
    }
    name
}

/// Remove every `<...>` tag (`re.sub(r'<[^>]+>', '', s)`).
fn strip_tags(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(lt) = rest.find('<') {
        out.push_str(&rest[..lt]);
        match rest[lt + 1..].find('>') {
            Some(gt) if gt > 0 => rest = &rest[lt + gt + 2..],
            _ => {
                out.push('<');
                rest = &rest[lt + 1..];
            }
        }
    }
    out.push_str(rest);
    out
}

/// Decode character references. Both sources use only `&amp;`, `&lt;`,
/// `&gt;` and `&nbsp;`; quotes and numeric references are handled too.
fn decode_entities(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(i) = rest.find('&') {
        out.push_str(&rest[..i]);
        let tail = &rest[i..];
        let decoded = tail.find(';').filter(|&e| e <= 10).and_then(|e| {
            let c = match &tail[1..e] {
                "amp" => '&',
                "lt" => '<',
                "gt" => '>',
                "quot" => '"',
                "apos" => '\'',
                "nbsp" => '\u{a0}',
                n => {
                    let num = n.strip_prefix('#')?;
                    let v = match num.strip_prefix(['x', 'X']) {
                        Some(h) => u32::from_str_radix(h, 16).ok()?,
                        None => num.parse().ok()?,
                    };
                    char::from_u32(v)?
                }
            };
            Some((c, e))
        });
        match decoded {
            Some((c, e)) => {
                out.push(c);
                rest = &tail[e + 1..];
            }
            None => {
                out.push('&');
                rest = &tail[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

/// Collapse every run of whitespace to one space.
fn collapse(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut space = false;
    for c in s.chars() {
        if is_space(c) {
            if !space {
                out.push(' ');
            }
            space = true;
        } else {
            out.push(c);
            space = false;
        }
    }
    out
}

/// Markup to one line of plain text: tags dropped, entities decoded,
/// whitespace collapsed and trimmed.
fn plain(s: &str) -> String {
    collapse(&decode_entities(&strip_tags(s)))
        .trim_matches(is_space)
        .to_string()
}

// ---------------------------------------------------------------- LSJ (TFLSJ)

/// One TFLSJ row, `G1577 <tab> G1577 =... <tab> ... <tab> meaning`, as
/// (dStrong, word class, meaning). The class is the sixth field ("G:N-F"),
/// the meaning the eighth field and everything after it.
fn tflsj_row(line: &str) -> Option<(&str, &str, &str)> {
    let mut f = line.splitn(8, '\t');
    let id = f.next()?;
    if id.len() != 5 || !id.starts_with('G') || !id[1..].bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let head = f.next()?;
    let cut = head.find(is_space)?;
    if cut == 0 || !head[cut..].starts_with(" =") {
        return None;
    }
    if f.next()?.contains(is_space) {
        return None;
    }
    f.next()?;
    f.next()?;
    let class = f.next()?;
    f.next()?;
    Some((&head[..cut], class, f.next()?))
}

/// dStrong -> (word class, meaning), keeping the first row seen for each.
fn tflsj_rows(paths: &[PathBuf]) -> Result<HashMap<String, (String, String)>, String> {
    let mut rows = HashMap::new();
    for p in paths {
        let text = fs::read_to_string(p).map_err(|e| format!("reading {}: {e}", p.display()))?;
        for line in text.trim_start_matches('\u{feff}').lines() {
            if let Some((key, class, meaning)) = tflsj_row(line) {
                rows.entry(key.to_string())
                    .or_insert_with(|| (class.to_string(), meaning.to_string()));
            }
        }
    }
    Ok(rows)
}

/// Articles, conjunctions, particles, prepositions and pronouns. LSJ's
/// entries for them are about constructions ("with genitive ..."), so their
/// first dated gloss says little ("and specially", "the following"): the
/// word study shows no "Outside the Bible" line for them. The class is the
/// first one TFLSJ gives, "G:PREP / G:A" counting as a preposition.
fn grammar_word(class: &str) -> bool {
    let first = class.split('/').next().unwrap_or("").trim_matches(is_space);
    let base = first.strip_prefix("G:").unwrap_or(first);
    let base = base.split('-').next().unwrap_or(base);
    matches!(
        base,
        "T" | "CONJ"
            | "COND"
            | "PRT"
            | "PREP"
            | "P"
            | "R"
            | "D"
            | "I"
            | "X"
            | "Q"
            | "K"
            | "F"
            | "C"
            | "S"
    )
}

/// πᾶς "all" is an adjective, but its entry, too, is about constructions
/// ("with the Article", "with superlative"), and "all" alone is a STOP word,
/// so its first dated gloss is "nothing but, only".
const CONSTRUCTION_WORDS: [&str; 1] = ["G3956"];

/// Misprints in TFLSJ's glosses, set right whole word by whole word:
/// u for v ("fauour"), letters lost ("mght-season") or words run together
/// ("falldue").
const MISPRINTS: [(&str, &str); 12] = [
    ("fauour", "favour"),
    ("approue", "approve"),
    ("auoid", "avoid"),
    ("bseeming", "beseeming"),
    ("dought", "dough"),
    ("mght", "night"),
    ("falldue", "fall due"),
    ("morethan", "more than"),
    ("raisefrom", "raise from"),
    ("aptto", "apt to"),
    ("civilrights", "civil rights"),
    ("lion or loins", "loin or loins"),
];

/// A gloss with the misprints set right.
fn fix_misprints(gloss: &str) -> String {
    let mut g = gloss.to_string();
    for (bad, good) in MISPRINTS {
        let mut from = 0;
        while let Some(i) = g[from..].find(bad) {
            let at = from + i;
            let end = at + bad.len();
            let before = g[..at].chars().next_back();
            let after = g[end..].chars().next();
            if before.is_none_or(|c| !c.is_alphanumeric())
                && after.is_none_or(|c| !c.is_alphanumeric())
            {
                g.replace_range(at..end, good);
                from = at + good.len();
            } else {
                from = end;
            }
        }
    }
    g
}

/// A gloss with each comma-separated part once: "<b>one, one</b> alone"
/// gives "one".
fn once_each(gloss: &str) -> String {
    let mut parts: Vec<&str> = Vec::new();
    for p in gloss.split(", ") {
        if !parts.iter().any(|q| q.eq_ignore_ascii_case(p)) {
            parts.push(p);
        }
    }
    parts.join(", ")
}

/// Names whose LSJ entry is another word spelled the same: γάϊος "on land"
/// (Gaius), κίς "weevil" (Kish), πόντιος "of the sea" (Pontius), σαῦλος, of
/// a "loose, wanton" gait (Saul), ταρσός "crate" (Tarsus); or the name in a
/// proverb (Simon, "a confederate in evil") or a history of the region
/// (Lydia). Their glosses would mislead, so none are kept.
const NOT_THE_NAME: [&str; 8] = [
    "G1050", "G2797", "G3070", "G4194", "G4549", "G4569", "G4613", "G5019",
];

/// The sense markers `<LevelN><b>__I.2</b></LevelN>`, as (start, end, mark).
fn sense_marks(s: &str) -> Vec<(usize, usize, &str)> {
    let mut out = Vec::new();
    let mut from = 0;
    while let Some(i) = s[from..].find("<Level") {
        let at = from + i;
        let found = (|| {
            let r = &s[at + 6..];
            if !r.bytes().next()?.is_ascii_digit() {
                return None;
            }
            let r = r[1..].strip_prefix("><b>__")?;
            let lt = r.find('<')?;
            let mark = &r[..lt];
            let r = r[lt..].strip_prefix("</b></Level")?;
            if !r.bytes().next()?.is_ascii_digit() {
                return None;
            }
            let r = r[1..].strip_prefix('>')?;
            Some((s.len() - r.len(), mark))
        })();
        match found {
            Some((end, mark)) => {
                out.push((at, end, mark));
                from = end;
            }
            None => from = at + 1,
        }
    }
    out
}

/// Bold spans `<b>...</b>` (shortest match), as (start, end, inner).
fn bolds(s: &str) -> Vec<(usize, usize, &str)> {
    let mut out = Vec::new();
    let mut from = 0;
    while let Some(i) = s[from..].find("<b>") {
        let at = from + i;
        let Some(j) = s[at + 3..].find("</b>") else {
            break;
        };
        let close = at + 3 + j;
        out.push((at, close + 4, &s[at + 3..close]));
        from = close + 4;
    }
    out
}

const LINK_HEAD: &str = "<a href=\"javascript:void(0)\" title=\"";

/// A TFLSJ reference link: its title lists the citations, its label is the
/// summary date such as `Refs 5th c.BC+`.
struct Link<'a> {
    start: usize,
    end: usize,
    title: &'a str,
    label: &'a str,
}

/// The link whose `<a` starts at `at`, optionally followed by `]`.
fn link_at(s: &str, at: usize) -> Option<Link<'_>> {
    let t0 = at + LINK_HEAD.len();
    let q = t0 + s[t0..].find('"')?;
    if !s[q..].starts_with("\">") {
        return None;
    }
    let l0 = q + 2;
    let lt = l0 + s[l0..].find('<')?;
    if !s[lt..].starts_with("</a>") {
        return None;
    }
    let mut end = lt + 4;
    if s[end..].starts_with(']') {
        end += 1;
    }
    Some(Link {
        start: at,
        end,
        title: &s[t0..q],
        label: &s[l0..lt],
    })
}

/// The first link that starts at or after `pos` and ends by `endpos`,
/// leaving out references to where the word is absent ("not in [...]").
fn link_in(s: &str, pos: usize, endpos: usize) -> Option<Link<'_>> {
    let s = &s[..endpos];
    let mut from = pos;
    while let Some(i) = s[from..].find(LINK_HEAD) {
        let at = from + i;
        match link_at(s, at) {
            Some(l) if !absent_at(s, at) => return Some(l),
            Some(l) => from = l.end,
            None => from = at + 1,
        }
    }
    None
}

/// Every link, left to right, leaving out references to where the word is
/// absent.
fn links_all(s: &str) -> Vec<Link<'_>> {
    let mut out = Vec::new();
    let mut from = 0;
    while let Some(i) = s[from..].find(LINK_HEAD) {
        let at = from + i;
        match link_at(s, at) {
            Some(l) => {
                from = l.end;
                if !absent_at(s, at) {
                    out.push(l);
                }
            }
            None => from = at + 1,
        }
    }
    out
}

/// A Greek letter (Greek and Coptic, or Greek Extended).
fn is_greek(c: char) -> bool {
    ('\u{370}'..='\u{3ff}').contains(&c) || ('\u{1f00}'..='\u{1fff}').contains(&c)
}

/// Phrases after which a bold span names what the word is set against
/// ("woman, opposed to <b>man</b>"), not a sense of the word. TFLSJ spells
/// out LSJ's "opp.", but both are listed.
const CONTRAST: [&str; 8] = [
    "opposed to",
    "opp.",
    "in opposition to",
    "in contrast to",
    "in contrast with",
    "contrasted with",
    "distinguished from",
    "as distinct from",
];

/// Phrases after which a reference shows where the word is *not* found
/// ("not in [Homer]"), or names a reading LSJ rejects ("<b>mist, haze</b>,
/// not (as [Aristarchus]) <b>lower air</b>"): such a reference dates nothing.
const ABSENT: [&str; 9] = [
    "not in",
    "never in",
    "not found in",
    "nowhere in",
    "never used by",
    "never occurs in",
    "not occur in",
    "does not occur in",
    "not (as",
];

/// The plain text of some markup, lowercased, with trailing spaces and `[`.
fn plain_tail(markup: &str) -> String {
    let t = collapse(&decode_entities(&strip_tags(markup))).to_lowercase();
    t.trim_end_matches(|c: char| is_space(c) || c == '[')
        .to_string()
}

/// Does the markup end with one of these phrases, as whole words? A word
/// doubled by a typo at the very end ("opposed to to") counts once.
fn ends_with_phrase(markup: &str, phrases: &[&str]) -> bool {
    let mut t = plain_tail(markup);
    if let Some((head, last)) = t.rsplit_once(' ') {
        if head.ends_with(last) && head[..head.len() - last.len()].ends_with(' ') {
            t.truncate(head.len());
        }
    }
    phrases.iter().any(|p| {
        t.strip_suffix(p).is_some_and(|before| {
            before
                .chars()
                .next_back()
                .is_none_or(|c| !c.is_alphanumeric())
        })
    })
}

/// Is the link starting at `at` a reference to where the word is absent?
fn absent_at(s: &str, at: usize) -> bool {
    let mut from = at.saturating_sub(60);
    while !s.is_char_boundary(from) {
        from -= 1;
    }
    ends_with_phrase(&s[from..at], &ABSENT)
}

/// The bold spans of a block that can be glosses: the first `skip` (the
/// headword) go, and so does every span that names a contrast or a reading
/// LSJ rejects ("not (as [Aristarchus]) <b>lower air</b>"), together with
/// any spans joined to it by "or", "and" or a comma ("opposed to <b>lie</b>
/// or <b>mere appearance</b>"), every quoted phrase, every piece of a
/// citation, and every span that only points to a sense given elsewhere
/// ("in sense <b>check</b>, see below"). Dropping them also means the gloss
/// before them keeps the reference that follows. Each span comes with
/// whether it goes on from the words just before it (see `continues_phrase`).
fn sense_bolds<'a>(
    block: &str,
    all: &[(usize, usize, &'a str)],
    skip: usize,
) -> Vec<(usize, usize, &'a str, bool)> {
    let mut out = Vec::with_capacity(all.len());
    let (mut prev_end, mut prev_contrast, mut prev_compared) = (0, false, false);
    for (i, &b) in all.iter().enumerate() {
        let between = &block[prev_end..b.0];
        let joined = {
            let t = collapse(&decode_entities(&strip_tags(between)));
            matches!(
                t.trim_matches(|c: char| is_space(c) || c == ','),
                "" | "or" | "and" | "nor"
            )
        };
        let contrast = i >= skip
            && (ends_with_phrase(between, &CONTRAST)
                || rejected(between)
                || (prev_contrast && joined));
        // A quoted phrase (`<b>in vino veritas</b>') renders an example, not the word.
        let quoted = plain_tail(between).ends_with('`');
        let after = all.get(i + 1).map_or(&block[b.1..], |n| &block[b.1..n.0]);
        // A bold run into a number ("<b>lon</b>947") is part of a citation,
        // and so is a title after its author ("Ramsay <b>Cities and
        // Bishoprics</b>"); after "written" comes a spelling ("<b>huihus</b>").
        let cited = after.starts_with(|c: char| c.is_ascii_digit()) || titled(between, b.2);
        let spelt = ends_with_phrase(between, &["written", "spelt", "spelled"]);
        let compared = compared(between, b.2, prev_compared);
        if i >= skip
            && !contrast
            && !quoted
            && !cited
            && !spelt
            && !compared
            && !latin(between, b.2, after)
            && !points_elsewhere(after)
        {
            out.push((b.0, b.1, b.2, continues_phrase(between)));
        }
        prev_end = b.1;
        prev_contrast = contrast;
        prev_compared = compared;
    }
    out
}

/// Words that label a gloss rather than begin a phrase it ends: "generally
/// <b>basket</b>", "adverb <b>now</b>", "passive <b>to be loved</b>".
const LABELS: [&str; 40] = [
    "also",
    "mostly",
    "generally",
    "properly",
    "usually",
    "commonly",
    "especially",
    "frequently",
    "chiefly",
    "often",
    "simply",
    "absolutely",
    "metaphorically",
    "later",
    "rarely",
    "hence",
    "adverb",
    "adjective",
    "substantive",
    "active",
    "passive",
    "middle",
    "present",
    "imperfect",
    "future",
    "aorist",
    "perfect",
    "pluperfect",
    "infinitive",
    "participle",
    "singular",
    "plural",
    "masculine",
    "feminine",
    "neuter",
    "comparative",
    "superlative",
    "genitive",
    "dative",
    "accusative",
];

/// Does a bold span go on from the words just before it? LSJ also sets in
/// bold the key words of its translations of examples ("οὐδ᾽ ἀπὸ δόξης not
/// otherwise than <b>one expects</b>", "κατὰ κόσμον in <b>order, duly</b>",
/// "οὐ κατὰ κ. <b>shamefully</b>"): such a span follows Greek, or an English
/// word, with no punctuation between. A gloss follows punctuation (":—"), a
/// reference, an italic label ("<i>plural</i>"), a label word or the start
/// of its block.
fn continues_phrase(between: &str) -> bool {
    let raw = between.trim_end_matches(|c: char| is_space(c) || c == '[' || c == ']');
    if raw.is_empty() || raw.ends_with("</a>") || raw.ends_with("</i>") {
        return false;
    }
    let t = collapse(&decode_entities(&strip_tags(raw)));
    let Some(last) = t.split(is_space).rfind(|w| !w.is_empty()) else {
        return false;
    };
    let Some(end) = last.chars().next_back() else {
        return false;
    };
    // A Greek word, the headword cut short ("κ.") or a number ("about 6
    // <b>feet</b>") just before.
    if is_greek(end) || (end == '.' && last.chars().any(is_greek)) || end.is_ascii_digit() {
        return true;
    }
    end.is_ascii_alphabetic() && !LABELS.contains(&last.to_lowercase().as_str())
}

/// Is a bold span a title cited after its author's name ("Hilgard <b>Excerpta
/// e libris Herodiani</b>")? Glosses begin in lower case.
fn titled(between: &str, inner: &str) -> bool {
    let starts_upper = collapse(&decode_entities(&strip_tags(inner)))
        .trim_start_matches(is_space)
        .starts_with(|c: char| c.is_ascii_uppercase());
    let t = collapse(&decode_entities(&strip_tags(between)));
    let author = t.split(is_space).rfind(|w| !w.is_empty()).is_some_and(|w| {
        let mut c = w.chars();
        c.next().is_some_and(|f| f.is_ascii_uppercase())
            && c.as_str().len() > 1
            && c.all(|x| x.is_ascii_lowercase())
            && !LABELS.contains(&w.to_lowercase().as_str())
    });
    starts_upper && author
}

/// Is a bold span a word of another language, compared in an etymology
/// ("cf. Latin <i>fero,</i> OE <b>beran</b>")? The clause before it, back to
/// the bracket it sits in or the last ";", ":" or "—" outside brackets,
/// compares and names a language, or the span before was such a word and
/// the clause goes on ("Tocharian (A) <b>se,</b> (B) <b>soyä</b>"). A span
/// that goes on past LSJ's ":—" ("cf. Latin <i>lac</i> for <b>glact):—
/// milk</b>") has its gloss after it.
fn compared(between: &str, inner: &str, prev: bool) -> bool {
    const LANGUAGES: [&str; 14] = [
        "Latin",
        "Sanskrit",
        "Gothic",
        "Lithuanian",
        "English",
        "German",
        "Norse",
        "Armenian",
        "Avestan",
        "Irish",
        "Slavonic",
        "Hittite",
        "Tocharian",
        "Albanian",
    ];
    if inner.contains(":—") {
        return false;
    }
    let t = collapse(&decode_entities(&strip_tags(between)));
    let mut depth = 0usize;
    let mut start = None;
    for (i, c) in t.char_indices().rev() {
        match c {
            ')' => depth += 1,
            '(' if depth > 0 => depth -= 1,
            '(' => {
                start = Some(i + 1);
                break;
            }
            ';' | ':' | '—' if depth == 0 => {
                start = Some(i + c.len_utf8());
                break;
            }
            _ => {}
        }
    }
    if prev && start.is_none() {
        return true;
    }
    let words: Vec<&str> = t[start.unwrap_or(0)..]
        .split(|c: char| is_space(c) || c == ',')
        .filter(|w| !w.is_empty())
        .collect();
    words
        .iter()
        .any(|w| matches!(*w, "cf." | "Cf." | "compare" | "Compare" | "cognate"))
        && words.iter().any(|w| LANGUAGES.contains(w))
}

/// Is a bold span Latin? LSJ names which verb a compound is made from in
/// Latin ("(εἰμί <b>sum</b>)", "(εἶμι <b>ibo</b>)"), and gives Latin
/// equivalents after "Latin" ("= Latin [ref] <b>filius</b>") or after a bare
/// "=" ("at Rome, = <b>pontifex</b>"), where only words that read as Latin
/// count: what follows "=" is often English ("= <b>yolk</b>").
fn latin(between: &str, inner: &str, after: &str) -> bool {
    let word = clean_gloss(inner);
    if matches!(word.as_str(), "sum" | "ibo") && after.trim_start().starts_with(')') {
        return true;
    }
    let before = without_links(between);
    if before.trim_end_matches(is_space).ends_with('=') && latin_words(&word) {
        return true;
    }
    before
        .split(|c: char| is_space(c) || c == '[' || c == ']')
        .rfind(|w| !w.is_empty())
        .is_some_and(|w| w == "Latin")
}

/// Does every word end as Latin words do ("Comitia Centuriata, Curiata",
/// "a militiis", "praejudicium")? English glosses after "=" never do.
fn latin_words(g: &str) -> bool {
    const ENDINGS: [&str; 10] = [
        "us", "um", "ae", "is", "io", "ator", "ifex", "ata", "ana", "ia",
    ];
    let mut words = g
        .split(|c: char| !c.is_ascii_alphabetic())
        .filter(|w| !w.is_empty())
        .peekable();
    words.peek().is_some()
        && words.all(|w| {
            matches!(w, "a" | "in" | "et" | "ad" | "de") || ENDINGS.iter().any(|e| w.ends_with(e))
        })
}

/// The plain text of some markup with its references left out.
fn without_links(markup: &str) -> String {
    let mut text = String::new();
    let mut rest = markup;
    while let Some(i) = rest.find(LINK_HEAD) {
        text.push_str(&rest[..i]);
        rest = rest[i..].find("</a>").map_or("", |j| &rest[i + j + 4..]);
    }
    text.push_str(rest);
    collapse(&decode_entities(&strip_tags(&text)))
}

/// Does a bold span name a reading LSJ rejects, as the words before it say
/// ("<b>mist, haze</b>, not (as [Aristarchus]) <b>lower air</b>")? TFLSJ
/// keeps the closing bracket inside the reference.
fn rejected(between: &str) -> bool {
    let t = without_links(between);
    t.trim_end_matches(|c: char| is_space(c) || matches!(c, '[' | ']' | ')'))
        .strip_suffix("not (as")
        .is_some_and(|before| {
            before
                .chars()
                .next_back()
                .is_none_or(|c| !c.is_alphanumeric())
        })
}

/// Does the text after a bold span say the sense is given elsewhere?
fn points_elsewhere(after: &str) -> bool {
    let t = collapse(&decode_entities(&strip_tags(after)));
    let t = t.trim_start_matches(|c: char| is_space(c) || c == ',');
    t.starts_with("see below") || t.starts_with("see infr")
}

/// The glosses of a block as (start of the first bold, end of the last,
/// cleaned gloss). Bold spans are read together where LSJ splits one gloss:
/// - alternatives joined by a bare "or", `<b>send off</b> or <b>away
///   from</b> [ref]`, become "send off or away from" (the second alone is
///   often only the end of a phrase);
/// - a gloss whose phrase goes on after a word or two, `<b>make</b> one
///   <b>swear</b>`, becomes "make one swear";
/// - a gloss that narrows the one before, `<b>slay</b>, properly <b>by
///   cutting the throat</b>`, becomes "slay, properly by cutting the throat".
///
/// A span too short to stand alone ("on", "from") still ends a pair of
/// alternatives (`<b>put round</b> or <b>on,</b>`), unless the gloss before
/// it is such a phrase or a list that already ends in a short word
/// (`<b>kin, relationship, with</b> or <b>to</b> another`).
///
/// Once a gloss has started afresh, a later span that goes on from Greek or
/// from a longer run of words renders an example, so it is dropped, and the
/// gloss keeps the reference after the example ("<b>expectation,</b> οὐδ᾽
/// ἀπὸ δόξης not otherwise than <b>one expects,</b> [Homer]"). Before that,
/// such a span may be all LSJ gives ("ἕνα καὶ δύο one or <b>two</b>"), so it
/// stays. Other bolds stay as they are, so each still ends the gloss before
/// it.
fn gloss_groups(block: &str, bold: &[(usize, usize, &str, bool)]) -> Vec<(usize, usize, String)> {
    struct Group {
        start: usize,
        end: usize,
        /// The markup from the first span's text to the last's.
        raw: String,
        gloss: String,
        ok: bool,
        fresh: bool,
        /// Read together across words of LSJ's own ("make one swear").
        phrase: bool,
    }
    let mut out: Vec<Group> = Vec::with_capacity(bold.len());
    let mut fresh_seen = false;
    for (i, &(start, end, inner, continues)) in bold.iter().enumerate() {
        let gloss = clean_gloss(inner);
        let after = bold.get(i + 1).map_or(&block[end..], |n| &block[end..n.0]);
        let ok = gloss_ok(&gloss) && !runs_into_greek(inner, &gloss, after);
        if let Some(last) = out.last_mut().filter(|l| l.ok) {
            let gap_markup = &block[last.end..start];
            let plain = collapse(&decode_entities(&strip_tags(gap_markup)));
            let gap = plain.trim_matches(|c: char| is_space(c) || c == ',');
            let ends_short = last.gloss.rsplit(", ").next().is_some_and(|p| !gloss_ok(p));
            // The joined gloss, and whether it is a phrase.
            let joined = if !ok {
                (gap == "or" && !last.phrase && !ends_short)
                    .then(|| (format!("{} or {gloss}", last.gloss), false))
                    .filter(|(j, _)| gloss_ok(j) && !runs_into_greek(inner, j, after))
            } else if gap.is_empty() && !gap_markup.contains(LINK_HEAD) {
                // Two spans side by side are one ("<b>to be born after,
                // come</b> <b>into being after</b>").
                Some((
                    clean_gloss(&format!("{}{gap_markup}{inner}", last.raw)),
                    last.phrase,
                ))
            } else if gap == "or" {
                Some(if gloss == last.gloss {
                    (gloss.clone(), last.phrase)
                } else {
                    (format!("{} or {gloss}", last.gloss), last.phrase)
                })
            } else if last.fresh && continues && !gap_markup.contains(LINK_HEAD) && few_words(gap) {
                Some((
                    clean_gloss(&format!("{}{gap_markup}{inner}", last.raw)),
                    true,
                ))
            } else if !gap_markup.contains(LINK_HEAD) && narrows(gap, &gloss) {
                // "<b>slay</b>, properly <b>by cutting the throat</b>".
                Some((format!("{}, {gap} {gloss}", last.gloss), last.phrase))
            } else {
                None
            };
            if let Some((joined, phrase)) = joined.filter(|(j, _)| j.chars().count() <= GLOSS_CHARS)
            {
                last.raw = format!("{}{gap_markup}{inner}", last.raw);
                last.gloss = joined;
                last.end = end;
                last.phrase = phrase;
                continue;
            }
        }
        if continues && fresh_seen {
            let gap = out.last().map_or("", |l| &block[l.end..start]);
            if renders_example(gap) {
                continue;
            }
        }
        let fresh = ok && !continues;
        fresh_seen |= fresh;
        out.push(Group {
            start,
            end,
            raw: inner.to_string(),
            gloss,
            ok,
            fresh,
            phrase: false,
        });
    }
    out.into_iter().map(|g| (g.start, g.end, g.gloss)).collect()
}

/// Does a gloss narrow the one before it, after one of LSJ's words for how
/// often a sense applies ("<b>assembly</b>, especially <b>of the
/// People</b>")?
fn narrows(gap: &str, gloss: &str) -> bool {
    const HOW: [&str; 9] = [
        "especially",
        "mostly",
        "chiefly",
        "properly",
        "usually",
        "commonly",
        "generally",
        "frequently",
        "often",
    ];
    const BY: [&str; 9] = ["of", "by", "with", "in", "for", "on", "at", "from", "to"];
    HOW.contains(&gap) && gloss.split(' ').next().is_some_and(|w| BY.contains(&w))
}

/// Is the text before a span that goes on from it an example? It is when
/// Greek comes after the last reference in it ("οὐρίῳ δρόμῳ with prosperous
/// <b>course</b>"), or when, with no reference, more than a couple of words
/// lead up to the span. After a reference and a few English words
/// ("[Plato] productive <b>labour</b>") a new gloss begins.
fn renders_example(gap: &str) -> bool {
    let tail = gap.rfind("</a>").map_or(gap, |i| &gap[i..]);
    let plain = collapse(&decode_entities(&strip_tags(tail)));
    if plain.chars().any(is_greek) {
        return true;
    }
    !gap.contains(LINK_HEAD) && !few_words(plain.trim_matches(|c: char| is_space(c) || c == ','))
}

/// Does a gloss stop short of its object, which LSJ gives in Greek ("<b>made
/// of</b> βύσσος")?
fn runs_into_greek(inner: &str, gloss: &str, after: &str) -> bool {
    const OPEN: [&str; 12] = [
        "of", "to", "in", "for", "with", "from", "by", "at", "on", "upon", "into", "as",
    ];
    let last = gloss.rsplit(' ').next().unwrap_or(gloss).to_lowercase();
    let open = strip_tags(inner)
        .trim_end_matches(is_space)
        .ends_with(|c: char| c.is_alphabetic());
    open && OPEN.contains(&last.as_str())
        && collapse(&decode_entities(&strip_tags(after)))
            .trim_start_matches(is_space)
            .starts_with(is_greek)
}

/// One or two plain words ("one", "a thing"), the most that can sit inside
/// a gloss LSJ splits.
fn few_words(gap: &str) -> bool {
    let words: Vec<&str> = gap.split(is_space).filter(|w| !w.is_empty()).collect();
    (1..=2).contains(&words.len())
        && words
            .iter()
            .all(|w| w.chars().all(|c| c.is_ascii_alphabetic() || c == '\''))
}

/// Is there a reference to where the word is absent in `[from, to)`?
fn absent_in(s: &str, from: usize, to: usize) -> bool {
    let s = &s[..to];
    let mut at = from;
    while let Some(i) = s[at..].find(LINK_HEAD) {
        if absent_at(s, at + i) {
            return true;
        }
        at += i + 1;
    }
    false
}

/// When a sense is first found: the century, the writer, and the citations
/// that say so (for papyri and inscriptions).
struct Dated<'a> {
    century: String,
    writer: Option<String>,
    title: &'a str,
}

/// A reference with no date of its own (a bare "Refs").
fn undated(l: &Link) -> bool {
    l.label
        .replace("Refs", "")
        .trim_matches(is_space)
        .is_empty()
}

/// A reference's own date, from its label ("Refs 5th c.BC+"); none for one
/// that cites the Bible alone ("LXX", "NT").
fn own_date<'a>(l: &Link<'a>) -> Option<Dated<'a>> {
    let (_, century, writer) = label_century(l.title, l.label)?;
    Some(Dated {
        century,
        writer,
        title: l.title,
    })
}

/// LSJ's "Id." and "ib.", which TFLSJ leaves undated ("[prev. author] “Aj.”
/// 1318"): the date and writer of the citation just before, the last one in
/// the reference before. None when that citation has no date, or when
/// another work follows it there ("...; “IG” 1.2"), so that "the same" could
/// mean either.
fn same_as_before<'a>(s: &'a str, l: &Link<'a>) -> Option<Dated<'a>> {
    const SAME: [&str; 4] = [
        "[prev. author]",
        "[prev\\. author]",
        "[prev. work]",
        "[prev. passage]",
    ];
    let t = l.title.trim_start_matches(is_space);
    if !SAME.iter().any(|p| t.starts_with(p)) {
        return None;
    }
    let at = s[..l.start].rfind(LINK_HEAD)?;
    let prev = link_at(s, at)?;
    if absent_at(s, at) {
        return None;
    }
    if undated(&prev) {
        return same_as_before(s, &prev).map(|d| Dated {
            title: l.title,
            ..d
        });
    }
    let mut last = None;
    let mut from = 0;
    while let Some(item) = next_item(prev.title, from) {
        from = item.end;
        last = Some(item);
    }
    let item = last?;
    let another_work = prev.title[item.end..]
        .split(';')
        .skip(1)
        .any(|part| part.trim_start_matches(is_space).starts_with('“'));
    if another_work {
        return None;
    }
    let (_, century) = century(item.shown(), item.era)?;
    Some(Dated {
        century,
        writer: writer_name(item.name),
        title: l.title,
    })
}

/// The reference that dates a gloss: the first in `[from, to)`, passing over
/// LSJ's undated ones (a bare "Refs") to the next. When that one cites the
/// Bible alone ("LXX", "NT"), the sense is a biblical one and gets no date.
///
/// An "Id." or "ib." before it is the earliest citation of the sense, so its
/// date and writer, those of the citation it repeats, are the ones given.
/// It never dates a gloss on its own: a gloss with no dated reference before
/// the next one is mostly a translated example ("οὐκ ἀ. it is blamable").
fn gloss_date(s: &str, from: usize, to: usize) -> Option<Dated<'_>> {
    let mut at = from;
    let mut same = None;
    while let Some(l) = link_in(s, at, to) {
        if !undated(&l) {
            return own_date(&l).map(|own| same.unwrap_or(own));
        }
        same = same.or_else(|| same_as_before(s, &l));
        at = l.end;
    }
    None
}

/// The first reference in `[from, to)` with a date outside the Bible, other
/// than one to where the word is absent; as in `gloss_date`, an "Id." before
/// it gives the date and writer.
fn first_dated(s: &str, from: usize, to: usize) -> Option<Dated<'_>> {
    let mut at = from;
    let mut same = None;
    while let Some(l) = link_in(s, at, to) {
        at = l.end;
        if let Some(own) = own_date(&l) {
            return Some(same.unwrap_or(own));
        }
        same = same.or_else(|| same_as_before(s, &l));
    }
    None
}

/// A gloss: tags dropped, entities decoded, whitespace collapsed, and
/// trimmed of ` ,;:.—-`. A bold span that runs on from the etymology
/// ("glact):—milk") keeps only what follows its last ":—", and one that runs
/// on into a reference ("a keeping of days of rest, Ep. Hebrew") stops
/// before it.
fn clean_gloss(s: &str) -> String {
    let t = collapse(&decode_entities(&strip_tags(s)));
    let t = t.rsplit_once(":—").map_or(t.as_str(), |(_, after)| after);
    let t = t.trim_matches([' ', ',', ';', ':', '.', '—', '-']);
    let parts: Vec<&str> = t.split(", ").collect();
    let t = match parts.iter().position(|p| has_abbreviation(p)) {
        Some(k) if k > 0 => parts[..k].join(", "),
        _ => t.to_string(),
    };
    t.trim_matches([' ', ',', ';', ':', '.', '—', '-'])
        .to_string()
}

/// A lone "." inside the text, as in "Ep." or "NT.Luke". LSJ's ".." in a
/// construction ("either.. or") is not one.
fn has_abbreviation(t: &str) -> bool {
    let c: Vec<char> = t.trim_end_matches('.').chars().collect();
    (0..c.len()).any(|i| c[i] == '.' && c.get(i + 1) != Some(&'.') && (i == 0 || c[i - 1] != '.'))
}

const STOP: [&str; 17] = [
    "all", "towards", "toward", "with", "from", "into", "upon", "also", "then", "thus", "not",
    "and", "but", "for", "one", "any", "in trust",
];

/// Is this bold span an English gloss (not Greek, a grammar note or a stray word)?
fn gloss_ok(g: &str) -> bool {
    if g.chars().count() < 3 {
        return false;
    }
    let b = g.as_bytes();
    if !b.windows(3).any(|w| w.iter().all(u8::is_ascii_alphabetic)) {
        return false;
    }
    if STOP.contains(&g.to_lowercase().as_str()) {
        return false;
    }
    if g.chars()
        .any(|c| matches!(c, '[' | ']' | '*' | '{' | '}' | '<' | '>' | '=' | '_' | '|'))
    {
        return false;
    }
    // Greek, or the marks of a transcribed or reconstructed word ("ĝhoryo-").
    if g.chars()
        .any(|c| is_greek(c) || "āēīōūăĕĭŏŭʼʽĝǵḱśṣṛṇḥ".contains(c))
    {
        return false;
    }
    if g.starts_with('\'') || g.starts_with("NT") || g.starts_with("LXX") || g.starts_with('=') {
        return false;
    }
    // Fragments of the markup around a gloss: an unmatched bracket ("l), Alc",
    // "foreign) tongue") or an abbreviation ("Exc. ex libris", "NT.Luke").
    // ".." is LSJ's own way of writing a construction ("either.. or").
    if g.matches('(').count() != g.matches(')').count() || has_abbreviation(g) {
        return false;
    }
    // A span that runs on into Greek ("<b>belonging to the</b> ἀγορά",
    // "<b>for having forsaken his</b> wife").
    let last = g.rsplit(' ').next().unwrap_or(g).to_lowercase();
    !matches!(
        last.as_str(),
        "the" | "a" | "an" | "his" | "her" | "its" | "their" | "one's"
    )
}

/// The gloss's words, for spotting a gloss that only repeats an earlier one.
fn word_set(g: &str) -> BTreeSet<String> {
    g.to_lowercase()
        .split(|c: char| !c.is_ascii_lowercase())
        .filter(|w| !w.is_empty() && !matches!(*w, "a" | "an" | "the" | "of" | "to"))
        .map(str::to_string)
        .collect()
}

/// A link label's date, `Refs 5th c.BC+` -> ("5", "BC"). Labels for the
/// Bible only (`LXX`, `NT`) or with no date give None.
fn label_date(label: &str) -> Option<(String, &'static str)> {
    let t = label.replace("Refs", "");
    let mut t = t.trim_matches(is_space);
    while let Some(r) = t.strip_prefix("LXX+").or_else(|| t.strip_prefix("NT+")) {
        t = r;
    }
    let n = t.bytes().take_while(u8::is_ascii_digit).count();
    if n == 0 {
        return None;
    }
    let rest = strip_ordinal(&t[n..])?.strip_prefix(" c.")?;
    let (era, rest) = match (rest.strip_prefix("BC"), rest.strip_prefix("AD")) {
        (Some(r), _) => ("BC", r),
        (_, Some(r)) => ("AD", r),
        _ => return None,
    };
    (rest.is_empty() || rest == "+").then(|| (t[..n].to_string(), era))
}

fn strip_ordinal(s: &str) -> Option<&str> {
    ["st", "nd", "rd", "th"]
        .iter()
        .find_map(|o| s.strip_prefix(o))
}

fn ordinal(n: i32) -> String {
    let suffix = if (10..=20).contains(&(n % 100)) {
        "th"
    } else {
        match n % 10 {
            1 => "st",
            2 => "nd",
            3 => "rd",
            _ => "th",
        }
    };
    format!("{n}{suffix}")
}

/// ("5", "BC") -> (a year in that century for ordering, "5th century BC").
fn century(digits: &str, era: &str) -> Option<(i32, String)> {
    let c: i32 = digits.parse().ok()?;
    let year = if era == "BC" {
        -c * 100 + 50
    } else {
        (c - 1) * 100 + 50
    };
    Some((year, format!("{} century {era}", ordinal(c))))
}

/// One dated citation inside a link title: `5th-4th c.BC: Plato Philosophus`.
struct Item<'a> {
    end: usize,
    digits: &'a str,
    era: &'a str,
    name: &'a str,
    /// Dated "4th-5th c.BC", TFLSJ's slip for writers of the 6th and 5th
    /// centuries BC (Aeschylus, Simonides, Parmenides, Pythagoras).
    slip: bool,
}

impl<'a> Item<'a> {
    /// The century to show: TFLSJ's, but the 5th BC for "4th-5th c.BC".
    fn shown(&self) -> &'a str {
        if self.slip {
            "5"
        } else {
            self.digits
        }
    }
}

/// Characters a writer's name can contain (it stops at a reference).
fn name_char(c: char) -> bool {
    !matches!(c, ',' | ';' | '“' | '"' | '0'..='9' | '(' | '[')
}

fn item_at(s: &str, i: usize) -> Option<Item<'_>> {
    let n = s[i..].bytes().take_while(u8::is_ascii_digit).count();
    if n == 0 {
        return None;
    }
    let digits = &s[i..i + n];
    let mut r = strip_ordinal(&s[i + n..])?;
    let mut to = None;
    if let Some(range) = r.strip_prefix('-') {
        let m = range.bytes().take_while(u8::is_ascii_digit).count();
        if let Some(after) = strip_ordinal(&range[m..]).filter(|_| m > 0) {
            to = Some(&range[..m]);
            r = after;
        }
    }
    let r = r.strip_prefix(" c.")?;
    let (era, r) = match (r.strip_prefix("BC"), r.strip_prefix("AD")) {
        (Some(x), _) => ("BC", x),
        (_, Some(x)) => ("AD", x),
        _ => return None,
    };
    let r = r.strip_prefix("(?)").unwrap_or(r).strip_prefix(':')?;
    let base = s.len() - r.len();
    let ws: usize = r
        .chars()
        .take_while(|&c| is_space(c))
        .map(char::len_utf8)
        .sum();
    let named: usize = r[ws..]
        .chars()
        .take_while(|&c| name_char(c))
        .map(char::len_utf8)
        .sum();
    let (start, len) = if named > 0 {
        (ws, named)
    } else {
        // Only whitespace before the reference: the name is that whitespace.
        let last = r[..ws].chars().next_back()?.len_utf8();
        (ws - last, last)
    };
    Some(Item {
        end: base + start + len,
        digits,
        era,
        name: &r[start..start + len],
        slip: era == "BC" && digits == "4" && to == Some("5"),
    })
}

/// The first dated citation at or after `from`.
fn next_item(s: &str, from: usize) -> Option<Item<'_>> {
    s[from..]
        .char_indices()
        .filter(|(_, c)| c.is_ascii_digit())
        .find_map(|(i, _)| item_at(s, from + i))
}

/// Writer names that are kept in English, or put into English.
fn english(name: &str) -> Option<&str> {
    Some(match name {
        "Homerus" => "Homer",
        "Hesiodus" => "Hesiod",
        "Pindarus" => "Pindar",
        "Aristoteles" => "Aristotle",
        "Plutarchus" => "Plutarch",
        "Philo Judaeus" => "Philo",
        "Flavius Josephus" => "Josephus",
        "Lucianus" => "Lucian",
        "Galenus" => "Galen",
        "Diodorus Siculus" => "Diodorus of Sicily",
        "Dionysius Halicarnassensis" => "Dionysius of Halicarnassus",
        "Dio Cassius" => "Cassius Dio",
        "Antipho" => "Antiphon",
        "Plinius" => "Pliny",
        "Aesopus" => "Aesop",
        "Ptolemaeus" => "Ptolemy",
        "Arrianus" => "Arrian",
        "Aelianus" => "Aelian",
        "Appianus" => "Appian",
        "Julianus" => "Julian",
        "Herodianus" => "Herodian",
        "Justinianus" => "Justinian",
        "Quintilianus" => "Quintilian",
        "Euclides" => "Euclid",
        "Philemo" => "Philemon",
        "Porphyrius" => "Porphyry",
        "Philodemus Gadarensis" => "Philodemus",
        "Dio Chrysostomus" => "Dio Chrysostom",
        "Marcus Antoninus" => "Marcus Aurelius",
        "Socratis Socraticorum" => "Socratic Letters",
        "Plato" | "Aeschylus" | "Thucydides" | "Herodotus" | "Xenophon" | "Demosthenes"
        | "Polybius" | "Josephus" | "Theophrastus" | "Hippocrates" | "Isocrates" | "Theocritus"
        | "Sappho" | "Strabo" | "Epictetus" | "Menander" | "Euripides" | "Sophocles"
        | "Aristophanes" | "Lysias" | "Aeschines" | "Theognis" => name,
        _ => return None,
    })
}

/// Words that follow a writer's name in TFLSJ to say what he wrote, not who
/// he was ("Homerus Epicus", "Plinius Rerum Naturalium Scriptor", "Alcaeus
/// Lyricus Comedy texts").
const GENRE: [&str; 58] = [
    "Epicus",
    "Historicus",
    "Philosophus",
    "Tragicus",
    "Comicus",
    "Lyricus",
    "Lyrica",
    "Medicus",
    "Orator",
    "Sophista",
    "Grammaticus",
    "Biographus",
    "et",
    "Poeta",
    "Rhetor",
    "Geometra",
    "Mechanicus",
    "Epigrammaticus",
    "Legal",
    "icographus",
    "Imperator",
    "Episcopus",
    "Mathematicus",
    "Bucolicus",
    "Iambographus",
    "Elegiacus",
    "Scriptor",
    "Ecclesiasticus",
    "Gnomologus",
    "Astronomus",
    "Geographus",
    "Paradoxographus",
    "Tacticus",
    "Periegeta",
    "Lexicographus",
    "Stoicus",
    "Cynicus",
    "Epicureus",
    "Platonicus",
    "Mimographus",
    "Eroticus",
    "Astronomicus",
    "Astrologus",
    "Epistolographus",
    "Atticista",
    "Onirocriticus",
    "Musicus",
    "Physiognomonicus",
    "Parodus",
    "Mythographus",
    "Paroemiographus",
    "Botanicus",
    "Latinus",
    "Fabularum",
    "Facetiarum",
    "Rerum",
    "Naturalium",
    "Comedy",
];

/// "Ilias Homerus Epicus " -> "Homer"; "Meleager Epigrammaticus)" -> "Meleager".
///
/// lsj5's rule, with stray brackets and colons trimmed from each word. The
/// name also ends at the first word that closes a bracket or ends in a colon,
/// and a second word counts only if it is capitalised: what follows a name in
/// TFLSJ is often LSJ's own commentary ("Solon cited", "Vitruvius de",
/// "Meleager Epigrammaticus): _metaphorically_").
fn writer_name(name: &str) -> Option<String> {
    let mut raw: Vec<&str> = Vec::new();
    for w in name.split(is_space).filter(|w| !w.is_empty()) {
        raw.push(w);
        if w.contains([')', ']', ':']) {
            break;
        }
    }
    // Each word trimmed, with whether it is cut short ("Mae.").
    let mut words: Vec<(&str, bool)> = raw
        .iter()
        .map(|w| {
            let t = w.trim_matches(['(', ')', '[', ']', ':', ';', ',', '.']);
            (t, abbreviated(w))
        })
        .filter(|(w, _)| !w.is_empty() && !GENRE.contains(w))
        .collect();
    let first = words.first()?.0;
    if matches!(first, "Ilias" | "Odyssea" | "Homerus") {
        return Some("Homer".into());
    }
    // A second word counts only if capitalised, and not when it is the
    // Bible book a translator is cited for ("Symmachus LXX.Eze.10.13"), a
    // place or work cut short ("Magnes Comicus Mae.") or a book number
    // ("Bacchylides Lyricus IV.").
    if words.get(1).is_some_and(|&(w, short)| {
        !w.starts_with(char::is_uppercase)
            || w.starts_with("LXX")
            || w.starts_with("NT.")
            || short
            || numeral(w)
    }) {
        words.truncate(1);
    }
    let two: Vec<&str> = words.iter().take(2).map(|(w, _)| *w).collect();
    let two = two.join(" ");
    let two = two.trim_matches([' ', '.']);
    let out = english(two).or_else(|| english(first)).unwrap_or(two);
    (!out.is_empty()).then(|| out.to_string())
}

/// Is a word of a name cut short, as LSJ shortens a place or a work ("Mae.",
/// "Trall.", "IV).")? A full name that ends a sentence ("Thessalonicensis).")
/// is longer.
fn abbreviated(raw: &str) -> bool {
    let w = raw.trim_matches(['(', ')', '[', ']', ':', ';', ',']);
    w.ends_with('.') && w.trim_end_matches('.').chars().count() <= 8
}

/// A book or fragment number after a name ("I", "IV", "VI-VIII", "C").
fn numeral(w: &str) -> bool {
    w.chars().count() == 1
        || w.chars()
            .all(|c| matches!(c, 'I' | 'V' | 'X' | 'L' | 'C' | '.' | '-'))
}

/// The first citation in `title` whose date is the label's: the one the
/// label dates.
fn cited<'a>(title: &'a str, label: &str) -> Option<Item<'a>> {
    let (digits, era) = label_date(label)?;
    let mut from = 0;
    while let Some(item) = next_item(title, from) {
        if item.digits == digits && item.era == era {
            return Some(item);
        }
        from = item.end;
    }
    None
}

/// A reference's date from its label ("Refs 5th c.BC+"), as (a year in that
/// century for ordering, the century, the writer); none for one that cites
/// the Bible alone ("LXX", "NT"). The label's is TFLSJ's date for the
/// citation it dates, set right for "4th-5th c.BC" (see `Item::slip`).
fn label_century(title: &str, label: &str) -> Option<(i32, String, Option<String>)> {
    let (digits, era) = label_date(label)?;
    let item = cited(title, label);
    let digits = item.as_ref().map_or(digits.as_str(), Item::shown);
    let (year, century) = century(digits, era)?;
    Some((year, century, item.and_then(|i| writer_name(i.name))))
}

fn is_word(c: char) -> bool {
    c.is_alphanumeric() || c == '_'
}

/// One of `names` starting at a word boundary in `s`, with `tail` true for what follows it.
fn named(s: &str, names: &[&str], tail: impl Fn(&str) -> bool) -> bool {
    s.char_indices().any(|(i, c)| {
        c.is_ascii_uppercase()
            && !s[..i].chars().next_back().is_some_and(is_word)
            && names
                .iter()
                .any(|n| s[i..].strip_prefix(n).is_some_and(&tail))
    })
}

/// After an opening “, a papyrus collection and the closing ”.
fn quoted_papyrus(r: &str) -> bool {
    let b = r.as_bytes();
    if b.len() >= 2 && b[0] == b'P' && b[1].is_ascii_uppercase() {
        let n = 2 + r[2..]
            .bytes()
            .take_while(|c| c.is_ascii_alphabetic() || *c == b'.')
            .count();
        if r[n..].starts_with('”') {
            return true;
        }
    }
    if ["BGU", "UPZ", "SB", "Sammelb."]
        .iter()
        .any(|lit| r.strip_prefix(lit).is_some_and(|x| x.starts_with('”')))
    {
        return true;
    }
    if b.len() >= 2 && b[0] == b'O' && b[1].is_ascii_uppercase() {
        let n = 2 + r[2..].bytes().take_while(u8::is_ascii_lowercase).count();
        if r[n..].starts_with(".”") {
            return true;
        }
    }
    false
}

/// Does a citation list cite papyri (letters, contracts, receipts)?
fn papyri(s: &str) -> bool {
    const NAMES: [&str; 17] = [
        "POxy", "PTeb", "PLond", "PGiss", "PFay", "PCair", "PPetr", "PMagd", "PSI", "PRyl",
        "PFlor", "PAmh", "PHib", "PGen", "PLips", "BGU", "UPZ",
    ];
    s.match_indices('“')
        .any(|(i, q)| quoted_papyrus(&s[i + q.len()..]))
        || named(s, &NAMES, |rest| !rest.chars().next().is_some_and(is_word))
}

/// Does a citation list cite inscriptions?
fn inscriptions(s: &str) -> bool {
    const QUOTED: [&str; 10] = [
        "SIG", "OGI", "IG", "CIG", "IGRom", "GDI", "Michel", "IPE", "SEG", "TAM",
    ];
    const NAMES: [&str; 4] = ["SIG", "OGI", "IG", "CIG"];
    let quoted = s.match_indices('“').any(|(i, q)| {
        let r = &s[i + q.len()..];
        QUOTED
            .iter()
            .any(|n| r.strip_prefix(n).is_some_and(|x| x.starts_with('”')))
    });
    quoted
        || named(s, &NAMES, |rest| {
            let mut c = rest.chars();
            match c.next() {
                Some(d) if d.is_ascii_digit() => true,
                Some(w) if is_space(w) => c.next().is_some_and(|d| d.is_ascii_digit()),
                _ => false,
            }
        })
}

struct Sense {
    gloss: String,
    century: String,
    writer: Option<String>,
    papyri: bool,
    inscriptions: bool,
}

struct Lsj {
    senses: Vec<Sense>,
    /// The earliest dated citation anywhere in the entry.
    first: Option<(String, Option<String>)>,
    papyri: bool,
    inscriptions: bool,
}

/// Read one LSJ entry: up to two senses from its opening and one from each
/// later sense block, each the first English gloss followed by a dated
/// reference to a writer outside the Bible.
fn lsj(meaning: &str) -> Option<Lsj> {
    if meaning.contains("LSJ has no entry") || meaning.contains("Not in LSJ") {
        return None;
    }
    let marks = sense_marks(meaning);
    // Each block as [start, end) in the entry, so that a reference can look
    // back past the block it is in ("Id." may follow a citation before it).
    let mut blocks = vec![(0, marks.first().map_or(meaning.len(), |m| m.0))];
    for (i, m) in marks.iter().enumerate() {
        blocks.push((m.1, marks.get(i + 1).map_or(meaning.len(), |n| n.0)));
    }
    let mut senses = Vec::new();
    let mut seen: Vec<BTreeSet<String>> = Vec::new();
    for (k, &(at, to)) in blocks.iter().enumerate() {
        let block = &meaning[at..to];
        let all = bolds(block);
        let bold = sense_bolds(block, &all, usize::from(k == 0)); // block 0 opens with the headword
        let glosses = gloss_groups(block, &bold);
        let want = if k == 0 { 2 } else { 1 };
        let mut took = 0;
        for (j, (_, end, gloss)) in glosses.iter().enumerate() {
            let (end, gloss) = (at + *end, gloss.as_str());
            if !gloss_ok(gloss) {
                continue;
            }
            let stop = at + glosses.get(j + 1).map_or(block.len(), |b| b.0);
            let dated = if absent_in(meaning, end, stop) {
                // LSJ says where this sense is *not* found ("not in [Homer]");
                // its first dated reference after the gloss, in the same
                // sense, says where it is.
                first_dated(meaning, end, to)
            } else {
                gloss_date(meaning, end, stop)
            };
            let Some(dated) = dated else {
                continue;
            };
            let words = word_set(gloss);
            if seen.iter().any(|s| words.is_subset(s)) {
                continue;
            }
            seen.push(words);
            senses.push(Sense {
                gloss: once_each(&fix_misprints(gloss))
                    .chars()
                    .take(GLOSS_CHARS)
                    .collect(),
                century: dated.century,
                writer: dated.writer,
                papyri: papyri(dated.title),
                inscriptions: inscriptions(dated.title),
            });
            took += 1;
            if took == want {
                break;
            }
        }
    }
    let links = links_all(meaning);
    let mut first: Option<(i32, String, Option<String>)> = None;
    for l in &links {
        if let Some((year, c, w)) = label_century(l.title, l.label) {
            if first.as_ref().is_none_or(|f| year < f.0) {
                first = Some((year, c, w));
            }
        }
    }
    let titles = links.iter().map(|l| l.title).collect::<Vec<_>>().join(" ");
    Some(Lsj {
        senses,
        first: first.map(|(_, c, w)| (c, w)),
        papyri: papyri(&titles),
        inscriptions: inscriptions(&titles),
    })
}

// ---------------------------------------------------------------- UBS handbooks

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
enum Handbook {
    Realia,
    Fauna,
    Flora,
}

impl Handbook {
    const ALL: [Handbook; 3] = [Handbook::Realia, Handbook::Fauna, Handbook::Flora];

    fn key(self) -> &'static str {
        match self {
            Handbook::Realia => "realia",
            Handbook::Fauna => "fauna",
            Handbook::Flora => "flora",
        }
    }

    fn title(self) -> &'static str {
        match self {
            Handbook::Realia => "Human-made Things in the Bible",
            Handbook::Fauna => "Animals in the Bible",
            Handbook::Flora => "Plants and Trees in the Bible",
        }
    }

    fn rank(key: &str) -> usize {
        Handbook::ALL
            .iter()
            .position(|h| h.key() == key)
            .unwrap_or(usize::MAX)
    }
}

/// Sections whose text is kept. Translation advice and reference lists are not.
const KEEP: [&str; 6] = [
    "description",
    "description and usage",
    "usage",
    "discussion",
    "special significance or symbolism",
    "other",
];

/// `[HAGLV]?BBBCCCVVVWWWWW`: prefix, Paratext book number, chapter, verse.
fn code(s: &str) -> Option<(char, u16, u16, u16)> {
    let (prefix, d) = match s.chars().next()? {
        c @ ('H' | 'A' | 'G' | 'L' | 'V') => (c, &s[1..]),
        _ => (' ', s),
    };
    if d.len() != 14 || !d.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    Some((
        prefix,
        d[..3].parse().ok()?,
        d[3..6].parse().ok()?,
        d[6..9].parse().ok()?,
    ))
}

/// Paratext numbers of the books outside the 66 that the handbooks cite.
fn other_book(n: u16) -> &'static str {
    match n {
        67 => "Tobit",
        68 => "Judith",
        69 => "Greek Esther",
        70 => "Wisdom of Solomon",
        71 => "Sirach",
        72 => "Baruch",
        73 => "Letter of Jeremiah",
        74 => "Song of the Three Young Men",
        75 => "Susanna",
        76 => "Bel and the Dragon",
        77 => "1 Maccabees",
        78 => "2 Maccabees",
        79 => "3 Maccabees",
        80 => "4 Maccabees",
        81 => "1 Esdras",
        82 => "2 Esdras",
        83 => "Prayer of Manasseh",
        84 => "Psalm 151",
        85 => "Odes",
        86 => "Psalms of Solomon",
        _ => "another ancient book",
    }
}

/// Every `<name ...>body</name>` element in `s` (not `<names>`), as
/// (attributes, body); self-closing elements have no body and are skipped.
fn elements<'a>(s: &'a str, name: &str) -> Vec<(&'a str, &'a str)> {
    let open = format!("<{name}");
    let close = format!("</{name}>");
    let mut out = Vec::new();
    let mut from = 0;
    while let Some(i) = s[from..].find(&open) {
        let a = from + i + open.len();
        if !s[a..].starts_with(|c: char| c == '>' || c == '/' || is_space(c)) {
            from = a;
            continue;
        }
        let Some(gt) = s[a..].find('>') else { break };
        let attrs = &s[a..a + gt];
        let body = a + gt + 1;
        if attrs.ends_with('/') {
            from = body;
            continue;
        }
        let Some(j) = s[body..].find(&close) else {
            break;
        };
        out.push((attrs, &s[body..body + j]));
        from = body + j + close.len();
    }
    out
}

/// An attribute's value, read by name wherever it is in the tag.
fn attr(attrs: &str, name: &str) -> Option<String> {
    let pat = format!("{name}=\"");
    let mut from = 0;
    while let Some(i) = attrs[from..].find(&pat) {
        let at = from + i;
        if attrs[..at].ends_with(is_space) {
            let v = at + pat.len();
            let end = v + attrs[v..].find('"')?;
            return Some(decode_entities(&attrs[v..end]));
        }
        from = at + 1;
    }
    None
}

/// One `<LanguageSet>`: the words it lists and the verses it cites for them.
struct LangSet {
    greek: bool,
    lemma: String,
    /// (Paratext book, chapter, verse) of every H, A or G reference.
    refs: Vec<(u16, u16, u16)>,
}

struct Entry<'a> {
    handbook: Handbook,
    key: String,
    title: String,
    sets: Vec<LangSet>,
    /// Kept sections: the heading's markup, then each paragraph's.
    sections: Vec<(&'a str, Vec<&'a str>)>,
}

fn scan_handbook(text: &str, handbook: Handbook) -> Vec<Entry<'_>> {
    let mut out = Vec::new();
    for (attrs, body) in elements(text, "ThemLex_Entry") {
        let Some(key) = attr(attrs, "Key") else {
            continue;
        };
        let title = elements(body, "Title")
            .first()
            .map(|t| plain(t.1))
            .unwrap_or_else(|| key.clone());
        let mut sets = Vec::new();
        for (a, ls) in elements(body, "LanguageSet") {
            let Some(lemma) = elements(ls, "Lemma").first().map(|l| plain(l.1)) else {
                continue;
            };
            let refs: Vec<(u16, u16, u16)> = elements(ls, "Reference")
                .iter()
                .filter_map(|r| code(r.1))
                .filter(|c| !matches!(c.0, 'L' | 'V'))
                .map(|c| (c.1, c.2, c.3))
                .collect();
            if !refs.is_empty() {
                sets.push(LangSet {
                    greek: attr(a, "Language").as_deref() == Some("Greek"),
                    lemma,
                    refs,
                });
            }
        }
        let mut sections = Vec::new();
        for (a, sec) in elements(body, "Section") {
            if !attr(a, "Content").is_some_and(|c| KEEP.contains(&c.as_str())) {
                continue;
            }
            let heading = elements(sec, "Heading").first().map_or("", |h| h.1);
            let paras: Vec<&str> = elements(sec, "Paragraphs")
                .iter()
                .flat_map(|p| elements(p.1, "Paragraph"))
                .map(|p| p.1)
                .collect();
            // A section can hold all of its text in the heading.
            if !paras.is_empty() || !plain(heading).is_empty() {
                sections.push((heading, paras));
            }
        }
        out.push(Entry {
            handbook,
            key,
            title,
            sets,
            sections,
        });
    }
    out
}

/// Keys in numeric order: 1.1.2 before 1.1.10.
fn key_order(a: &str, b: &str) -> Ordering {
    let (mut x, mut y) = (a.split('.'), b.split('.'));
    loop {
        match (x.next(), y.next()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(p), Some(q)) => {
                let o = match (p.parse::<u64>(), q.parse::<u64>()) {
                    (Ok(m), Ok(n)) => m.cmp(&n),
                    _ => p.cmp(q),
                };
                if o != Ordering::Equal {
                    return o;
                }
            }
        }
    }
}

/// Only the Hebrew letters (drops vowel points, accents and everything else).
fn hebrew_letters(s: &str) -> String {
    s.chars()
        .filter(|c| ('\u{05D0}'..='\u{05EA}').contains(c))
        .collect()
}

/// The lowercase base letter of a Greek character, with ς as σ, or None for
/// anything else. This is what Python's `unicodedata.normalize('NFD',
/// c.lower())` leaves of it; std has no NFD, so the Greek and Greek Extended
/// blocks are tabulated (and tested against Python, code point by code point).
fn greek_base(c: char) -> Option<char> {
    let u = c as u32;
    let b = match u {
        0x03C2 => 'σ',
        0x03B1..=0x03C9 => c,
        0x0391..=0x03A1 | 0x03A3..=0x03A9 => char::from_u32(u + 0x20)?,
        0x0386 | 0x03AC => 'α',
        0x0388 | 0x03AD => 'ε',
        0x0389 | 0x03AE => 'η',
        0x038A | 0x0390 | 0x03AA | 0x03AF | 0x03CA => 'ι',
        0x038C | 0x03CC => 'ο',
        0x038E | 0x03AB | 0x03B0 | 0x03CB | 0x03CD => 'υ',
        0x038F | 0x03CE | 0x2126 => 'ω',
        0x03F4 => 'θ',
        0x1F00..=0x1F0F | 0x1F70 | 0x1F71 | 0x1F80..=0x1F8F | 0x1FB0..=0x1FB4 | 0x1FB6..=0x1FBC => {
            'α'
        }
        0x1F10..=0x1F15 | 0x1F18..=0x1F1D | 0x1F72 | 0x1F73 | 0x1FC8 | 0x1FC9 => 'ε',
        0x1F20..=0x1F2F
        | 0x1F74
        | 0x1F75
        | 0x1F90..=0x1F9F
        | 0x1FC2..=0x1FC4
        | 0x1FC6
        | 0x1FC7
        | 0x1FCA..=0x1FCC => 'η',
        0x1F30..=0x1F3F | 0x1F76 | 0x1F77 | 0x1FBE | 0x1FD0..=0x1FD3 | 0x1FD6..=0x1FDB => 'ι',
        0x1F40..=0x1F45 | 0x1F48..=0x1F4D | 0x1F78 | 0x1F79 | 0x1FF8 | 0x1FF9 => 'ο',
        0x1F50..=0x1F57
        | 0x1F59
        | 0x1F5B
        | 0x1F5D
        | 0x1F5F
        | 0x1F7A
        | 0x1F7B
        | 0x1FE0..=0x1FE3
        | 0x1FE6..=0x1FEB => 'υ',
        0x1FE4 | 0x1FE5 | 0x1FEC => 'ρ',
        0x1F60..=0x1F6F
        | 0x1F7C
        | 0x1F7D
        | 0x1FA0..=0x1FAF
        | 0x1FF2..=0x1FF4
        | 0x1FF6
        | 0x1FF7
        | 0x1FFA..=0x1FFC => 'ω',
        _ => return None,
    };
    Some(if b == 'ς' { 'σ' } else { b })
}

fn greek_letters(s: &str) -> String {
    s.chars().filter_map(greek_base).collect()
}

/// A lemma or word reduced to what the handbooks and lexicons agree on.
fn normalize(s: &str, greek: bool) -> String {
    if greek {
        greek_letters(s)
    } else {
        hebrew_letters(s)
    }
}

/// The word forms in a `<Lemma>`: "מוֹט, מוֹטָה" -> both; split on , ; / and " or ".
fn lemma_forms(lemma: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut start = 0;
    let mut it = lemma.char_indices();
    while let Some((i, c)) = it.next() {
        if matches!(c, ',' | ';' | '/') {
            out.push(&lemma[start..i]);
            start = i + 1;
        } else if c == ' ' && lemma[i..].starts_with(" or ") {
            out.push(&lemma[start..i]);
            start = i + 4;
            it.nth(2);
        }
    }
    out.push(&lemma[start..]);
    out.into_iter()
        .map(|f| f.trim_matches(is_space))
        .filter(|f| !f.is_empty())
        .collect()
}

/// (book, Hebrew chapter, Hebrew verse) -> app verse.
type HebrewMap = HashMap<(u8, u16, u16), u32>;

/// A TAHOT reference, `Mal.4.1(3.19)`: (book, English chapter, English verse,
/// Hebrew chapter, Hebrew verse). A single number in the parentheses is a
/// verse in the same chapter.
fn tahot_ref(field: &str) -> Option<(u8, u16, u16, u16, u16)> {
    let r = field.split('#').next()?;
    let (eng, alt) = r.split_once('(').unwrap_or((r, ""));
    let mut it = eng.split('.');
    let (b, c, v) = (
        by_step(it.next()?)?,
        it.next()?.parse().ok()?,
        it.next()?.parse().ok()?,
    );
    if it.next().is_some() {
        return None;
    }
    if alt.is_empty() {
        return Some((b, c, v, c, v));
    }
    let alt = alt.trim_end_matches(')');
    let (hc, hv) = match alt.split_once('.') {
        Some((x, y)) => (x.parse().ok()?, y.parse().ok()?),
        None => (c, alt.parse().ok()?),
    };
    Some((b, c, v, hc, hv))
}

/// The handbooks cite Old Testament verses by their Hebrew numbers; TAHOT
/// gives both numberings for every word, so the first mapping seen for each
/// Hebrew verse wins.
fn hebrew_numbering(paths: &[PathBuf], vz: &Versification) -> Result<HebrewMap, String> {
    let mut map = HashMap::new();
    for p in paths {
        let text = fs::read_to_string(p).map_err(|e| format!("reading {}: {e}", p.display()))?;
        for line in text.trim_start_matches('\u{feff}').lines() {
            let first = line.split('\t').next().unwrap_or("");
            if !first.contains('#') || !first.chars().next().is_some_and(char::is_alphanumeric) {
                continue;
            }
            let Some((b, c, v, hc, hv)) = tahot_ref(first) else {
                continue;
            };
            if let Some(idx) = vz.index(b, c, v.max(1)) {
                map.entry((b, hc, hv)).or_insert(idx);
            }
        }
    }
    Ok(map)
}

/// Turns handbook references and markup into segments.
struct Refs<'a> {
    vz: &'a Versification,
    hebrew: &'a HebrewMap,
}

impl Refs<'_> {
    /// The app verse of a reference in books 1-66 (Paratext numbering).
    fn verse(&self, book: u16, c: u16, v: u16) -> Option<u32> {
        if !(1..=66).contains(&book) {
            return None;
        }
        let b = (book - 1) as u8;
        if book <= 39 {
            if let Some(&i) = self.hebrew.get(&(b, c, v)) {
                return Some(i);
            }
        }
        self.vz.index(b, c, v.max(1))
    }

    /// A code or a range `CODE-CODE` as (label, verse to open or -1).
    /// Linked labels use the app's own numbering, so they name the verse they open.
    fn reference(&self, tok: &str) -> Option<(String, i64)> {
        let (a, b) = match tok.split_once('-') {
            Some((x, y)) => (code(x)?, Some(code(y)?)),
            None => (code(tok)?, None),
        };
        let (_, book, c, v) = a;
        let raw = |name: &str| {
            let start = if v == 0 {
                format!("{name} {c}")
            } else {
                format!("{name} {c}:{v}")
            };
            match b {
                Some((_, eb, ec, ev)) if eb == book && (ec, ev) != (c, v) => match (v, ev, ec == c)
                {
                    (0, 0, _) => format!("{start}–{ec}"),
                    (_, _, true) => format!("{start}–{ev}"),
                    _ => format!("{start}–{ec}:{ev}"),
                },
                _ => start,
            }
        };
        if !(1..=66).contains(&book) {
            let name = other_book(book);
            return Some((
                if name == "another ancient book" {
                    name.to_string()
                } else {
                    raw(name)
                },
                -1,
            ));
        }
        let name = BOOKS[(book - 1) as usize].name;
        let Some(s) = self.verse(book, c, v) else {
            return Some((raw(name), -1));
        };
        if v == 0 {
            return Some((raw(name), s as i64));
        }
        let (sb, sc, sv) = self.vz.locate(s)?;
        let sname = BOOKS[sb as usize].name;
        let end = b
            .and_then(|(_, eb, ec, ev)| self.verse(eb, ec, ev))
            .filter(|&e| e > s)
            .and_then(|e| self.vz.locate(e));
        let label = match end {
            Some((eb, ec, ev)) if eb != sb => {
                format!("{sname} {sc}:{sv} – {} {ec}:{ev}", BOOKS[eb as usize].name)
            }
            Some((_, ec, ev)) if ec != sc => format!("{sname} {sc}:{sv}–{ec}:{ev}"),
            Some((_, _, ev)) => format!("{sname} {sc}:{sv}–{ev}"),
            None => format!("{sname} {sc}:{sv}"),
        };
        Some((label, s as i64))
    }

    /// The contents of `<s>...</s>`: one segment per reference, joined by "; ".
    /// Two codes for the same verse (two words in it) are shown once.
    fn references(&self, segs: &mut Vec<Seg>, inner: &str, style: u8) {
        let inner = decode_entities(&strip_tags(inner));
        let mut shown: Vec<(String, i64)> = Vec::new();
        for tok in inner.split(is_space).filter(|t| !t.is_empty()) {
            let r = self.reference(tok).unwrap_or_else(|| (tok.to_string(), -1));
            if shown.last() == Some(&r) {
                continue;
            }
            if !shown.is_empty() {
                segs.push(("; ".into(), style, -1));
            }
            segs.push((r.0.clone(), style, r.1));
            shown.push(r);
        }
    }

    /// Running text. A reference code the handbook forgot to mark up with
    /// `<s>` still becomes a link, if it names a verse.
    fn text(&self, segs: &mut Vec<Seg>, s: &str, style: u8) {
        let b = s.as_bytes();
        let (mut last, mut i) = (0, 0);
        while i < b.len() {
            let starts = i == 0 || !b[i - 1].is_ascii_alphanumeric();
            let p = usize::from(matches!(b[i], b'H' | b'A' | b'G'));
            let n = b[i + p..].iter().take_while(|c| c.is_ascii_digit()).count();
            let end = i + p + n;
            if starts && n == 14 && b.get(end).is_none_or(|c| !c.is_ascii_alphanumeric()) {
                if let Some((label, v)) = self.reference(&s[i..end]).filter(|r| r.1 >= 0) {
                    segs.push((s[last..i].to_string(), style, -1));
                    segs.push((label, style, v));
                    (last, i) = (end, end);
                    continue;
                }
            }
            i += 1;
        }
        segs.push((s[last..].to_string(), style, -1));
    }

    /// One `<Paragraph>` as segments: bold and italic kept, references as
    /// links, cross-references as their plain names, images dropped.
    fn paragraph(&self, xml: &str) -> Vec<Seg> {
        let mut raw: Vec<Seg> = Vec::new();
        let mut style = 0u8;
        let mut rest = xml;
        loop {
            let Some(lt) = rest.find('<') else {
                self.text(&mut raw, &decode_entities(rest), style);
                break;
            };
            self.text(&mut raw, &decode_entities(&rest[..lt]), style);
            let Some(gt) = rest[lt..].find('>') else {
                self.text(&mut raw, &decode_entities(&rest[lt..]), style);
                break;
            };
            let tag = &rest[lt + 1..lt + gt];
            rest = &rest[lt + gt + 1..];
            let closing = tag.starts_with('/');
            let name = tag
                .trim_start_matches('/')
                .split(|c: char| is_space(c) || c == '/')
                .next()
                .unwrap_or("");
            match (name, closing) {
                ("b", false) => style |= BOLD,
                ("b", true) => style &= !BOLD,
                ("i", false) => style |= ITALIC,
                ("i", true) => style &= !ITALIC,
                ("s", false) if !tag.ends_with('/') => {
                    let end = rest.find("</s>").unwrap_or(rest.len());
                    self.references(&mut raw, &rest[..end], style);
                    rest = rest.get(end + 4..).unwrap_or("");
                }
                ("l", false) if !tag.ends_with('/') => {
                    // "1.5.3 Cloth manufacture<REALIA:1.5.3>" -> "Cloth manufacture"
                    let end = rest.find("</l>").unwrap_or(rest.len());
                    let inner = decode_entities(&strip_tags(&rest[..end]));
                    let shown = match inner.rfind('<') {
                        Some(i) if inner.trim_end().ends_with('>') => &inner[..i],
                        _ => &inner,
                    };
                    raw.push((without_key(shown).to_string(), style, -1));
                    rest = rest.get(end + 4..).unwrap_or("");
                }
                _ => {} // a, u, sup, Image and anything else: the tag goes, its text stays
            }
        }
        tidy(raw)
    }

    /// The kept sections of an entry as `[heading, segments]`, paragraphs
    /// separated by "\n" segments; separator paragraphs ("———") are dropped.
    /// A heading such as "Description:" loses its colon. Some sections put
    /// their opening sentence, references and all, in the heading; that
    /// heading becomes the section's first paragraph and the heading is "".
    fn sections(&self, e: &Entry) -> Vec<(String, Vec<Seg>)> {
        let mut out = Vec::new();
        for (heading_xml, paras) in &e.sections {
            let head = self.paragraph(heading_xml);
            let text: String = head.iter().map(|s| s.0.as_str()).collect();
            let titled = text.chars().count() <= TITLE_CHARS
                && !text.ends_with(['.', '?', '!'])
                && head.iter().all(|s| s.2 < 0)
                && !heading_xml.contains("<s>");
            let heading = if titled {
                text.strip_suffix(':')
                    .unwrap_or(&text)
                    .trim_matches(is_space)
                    .to_string()
            } else {
                String::new()
            };
            let opening = (!titled).then_some(heading_xml);
            let mut segs: Vec<Seg> = Vec::new();
            for p in opening.into_iter().chain(paras) {
                let ps = self.paragraph(p);
                let text: String = ps.iter().map(|s| s.0.as_str()).collect();
                if text.is_empty() || text == "———" {
                    continue;
                }
                if !segs.is_empty() {
                    segs.push(("\n".into(), 0, -1));
                }
                segs.extend(ps);
            }
            if !segs.is_empty() {
                out.push((heading.clone(), segs));
            }
        }
        out
    }
}

/// Collapse whitespace across segments, merge neighbours that look the same,
/// and trim both ends.
fn tidy(raw: Vec<Seg>) -> Vec<Seg> {
    let mut out: Vec<Seg> = Vec::new();
    let mut space = true;
    for (t, style, v) in raw {
        let mut buf = String::with_capacity(t.len());
        for c in t.chars() {
            if is_space(c) {
                if !space {
                    buf.push(' ');
                }
                space = true;
            } else {
                buf.push(c);
                space = false;
            }
        }
        if buf.is_empty() {
            continue;
        }
        match out.last_mut() {
            Some(last) if last.1 == style && v < 0 && last.2 < 0 => last.0.push_str(&buf),
            _ => out.push((buf, style, v)),
        }
    }
    while let Some(last) = out.last_mut() {
        let keep = last.0.trim_end().len();
        last.0.truncate(keep);
        if !last.0.is_empty() {
            break;
        }
        out.pop();
    }
    out
}

/// The lead: the opening paragraph cut at the last sentence end within 240
/// characters, or at a space with "…" when no sentence ends that early.
fn lead(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() <= LEAD_CHARS {
        return text.to_string();
    }
    let sentence = (0..LEAD_CHARS)
        .rev()
        .find(|&i| matches!(chars[i], '.' | '?' | '!') && chars[i + 1] == ' ');
    if let Some(i) = sentence {
        return chars[..=i].iter().collect();
    }
    let space = chars[..LEAD_CHARS - 1]
        .iter()
        .rposition(|&c| c == ' ')
        .unwrap_or(LEAD_CHARS - 1);
    let mut s: String = chars[..space].iter().collect();
    s.push('…');
    s
}

/// A handbook link of one root: (entry index, general, the root's verses the entry cites).
type UbsLink = (usize, bool, Vec<u32>);

fn overlap(a: &[u32], b: &[u32]) -> Vec<u32> {
    a.iter()
        .copied()
        .filter(|v| b.binary_search(v).is_ok())
        .collect()
}

/// Which handbook entries a study shows (shared with the web app's world.ts):
/// the ones that cite the study verse if any do, otherwise the general ones.
/// `verse` counts only if the root occurs in it.
fn shown(links: &[UbsLink], verse: Option<u32>, rank: impl Fn(usize) -> usize) -> Vec<&UbsLink> {
    let cited: Vec<&UbsLink> = verse
        .map(|v| {
            links
                .iter()
                .filter(|l| l.2.binary_search(&v).is_ok())
                .collect()
        })
        .unwrap_or_default();
    let mut pick = if cited.is_empty() {
        links.iter().filter(|l| l.1).collect()
    } else {
        cited
    };
    pick.sort_by_key(|l| (l.2.len(), rank(l.0), l.0));
    pick
}

// ---------------------------------------------------------------- build

/// Build `world/`. `lemmas` is (key, word) per root; `l_off` and `l_verse`
/// are the root postings. Returns every file to write, relative to `out`.
pub fn build(
    out: &Path,
    inputs: &Inputs,
    vz: &Versification,
    lemmas: &[(&str, &str)],
    l_off: &[u32],
    l_verse: &[u32],
) -> Result<Vec<(String, Vec<u8>)>, String> {
    let dir = out.join("world");
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| format!("clearing {}: {e}", dir.display()))?;
    }
    let n_roots = lemmas.len();
    let mut slots: Vec<Map<String, Value>> = vec![Map::new(); n_roots];

    // --- Outside the Bible: LSJ senses for every Greek root ---------------
    let rows = tflsj_rows(&inputs.paths("tflsj"))?;
    let (mut with_lsj, mut with_senses, mut with_first) = (0, 0, 0);
    let (mut grammar, mut related, mut names) = (0, 0, 0);
    for (r, (key, _)) in lemmas.iter().enumerate() {
        if !key.starts_with('G') {
            continue;
        }
        let base = key.get(..5).unwrap_or(key);
        let Some((class, meaning)) = rows
            .get(*key)
            .or_else(|| rows.get(base))
            .or_else(|| rows.get(&format!("{base}G")))
        else {
            continue;
        };
        let Some(mut e) = lsj(meaning) else { continue };
        if NOT_THE_NAME.contains(&base) {
            e = Lsj {
                senses: Vec::new(),
                first: None,
                papyri: false,
                inscriptions: false,
            };
            names += 1;
        }
        with_lsj += 1;
        with_senses += usize::from(!e.senses.is_empty());
        with_first += usize::from(e.first.is_some());
        let o = &mut slots[r];
        let senses: Vec<Value> = e
            .senses
            .iter()
            .take(MAX_SENSES)
            .map(|s| {
                let flags = format!(
                    "{}{}",
                    if s.papyri { "p" } else { "" },
                    if s.inscriptions { "i" } else { "" }
                );
                json!([s.gloss, s.century, s.writer.as_deref().unwrap_or(""), flags])
            })
            .collect();
        o.insert("l".into(), Value::Array(senses));
        if let Some((c, w)) = &e.first {
            o.insert("f".into(), json!([c, w.as_deref().unwrap_or("")]));
        }
        if e.papyri {
            o.insert("p".into(), json!(1));
        }
        if e.inscriptions {
            o.insert("i".into(), json!(1));
        }
        if grammar_word(class) || CONSTRUCTION_WORDS.contains(&base) {
            o.insert("g".into(), json!(1));
            grammar += 1;
        }
        // LSJ has no entry of its own for the word, and TFLSJ gives a related
        // one's: πρεσβύτερος gets πρεσβυτέριον, μόνον gets μονόω.
        if meaning.trim_start().starts_with("Related to") {
            o.insert("r".into(), json!(1));
            related += 1;
        }
    }

    // --- In their world: handbook entries linked through the verses they cite
    let hebrew = hebrew_numbering(&inputs.paths("tahot"), vz)?;
    let renumbered = hebrew
        .iter()
        .filter(|(&(b, c, v), &i)| vz.index(b, c, v.max(1)) != Some(i))
        .count();
    eprintln!("World: TAHOT gives {} Hebrew verse numbers, {renumbered} of them differ from the English numbering", hebrew.len());
    let texts: Vec<(Handbook, String)> = Handbook::ALL
        .iter()
        .map(|&h| {
            let p = inputs.path("ubs-ffr", h.key());
            fs::read_to_string(&p)
                .map(|t| (h, t))
                .map_err(|e| format!("reading {}: {e}", p.display()))
        })
        .collect::<Result<_, _>>()?;
    let entries: Vec<Entry> = texts
        .iter()
        .flat_map(|(h, t)| scan_handbook(t.trim_start_matches('\u{feff}'), *h))
        .collect();

    let verses: Vec<Vec<u32>> = (0..n_roots)
        .map(|r| {
            let mut v = l_verse[l_off[r] as usize..l_off[r + 1] as usize].to_vec();
            v.sort_unstable();
            v.dedup();
            v
        })
        .collect();
    let mut by_form: HashMap<(bool, String), Vec<u32>> = HashMap::new();
    for (r, (key, word)) in lemmas.iter().enumerate() {
        let greek = key.starts_with('G');
        by_form
            .entry((greek, normalize(word, greek)))
            .or_default()
            .push(r as u32);
    }
    let refs = Refs {
        vz,
        hebrew: &hebrew,
    };
    // links[root] = (entry id in scan order, general, verses)
    let mut links: Vec<Vec<UbsLink>> = vec![Vec::new(); n_roots];
    for (id, e) in entries.iter().enumerate() {
        for set in &e.sets {
            let mut ve: Vec<u32> = set
                .refs
                .iter()
                .filter_map(|&(b, c, v)| refs.verse(b, c, v))
                .collect();
            ve.sort_unstable();
            ve.dedup();
            if ve.is_empty() {
                continue;
            }
            let mut cands = BTreeSet::new();
            for f in lemma_forms(&set.lemma) {
                if let Some(rs) = by_form.get(&(set.greek, normalize(f, set.greek))) {
                    cands.extend(rs.iter().copied());
                }
            }
            let best = cands
                .iter()
                .map(|&r| (r, overlap(&ve, &verses[r as usize])))
                .max_by(|a, b| a.1.len().cmp(&b.1.len()).then(b.0.cmp(&a.0)));
            let Some((root, shared)) = best else { continue };
            if 2 * shared.len() < ve.len() {
                continue;
            }
            let general = 4 * shared.len() >= verses[root as usize].len();
            let slot = &mut links[root as usize];
            match slot.iter_mut().find(|l| l.0 == id) {
                Some(prev) if prev.2.len() < shared.len() => *prev = (id, general, shared),
                Some(_) => {}
                None => slot.push((id, general, shared)),
            }
        }
    }

    // An entry whose only text is translation advice or a reference list
    // would make an empty line, so its links are dropped.
    let mut silent: BTreeSet<usize> = BTreeSet::new();
    for ls in links.iter_mut() {
        ls.retain(|l| {
            let keep = !refs.sections(&entries[l.0]).is_empty();
            if !keep {
                silent.insert(l.0);
            }
            keep
        });
    }
    if !silent.is_empty() {
        let names: Vec<&str> = silent.iter().map(|&e| entries[e].title.as_str()).collect();
        eprintln!(
            "World: {} linked handbook entries have no text to show and are left out: {}",
            silent.len(),
            names.join(", ")
        );
    }

    // Entries linked to at least one root, in handbook and key order.
    let mut linked: Vec<usize> = links
        .iter()
        .flatten()
        .map(|l| l.0)
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    linked.sort_by(|&a, &b| {
        entries[a]
            .handbook
            .cmp(&entries[b].handbook)
            .then_with(|| key_order(&entries[a].key, &entries[b].key))
    });
    let index_of: HashMap<usize, usize> =
        linked.iter().enumerate().map(|(i, &id)| (id, i)).collect();
    let (mut general, mut verse_only, mut roots_linked) = (0, 0, 0);
    for (r, ls) in links.iter_mut().enumerate() {
        if ls.is_empty() {
            continue;
        }
        roots_linked += 1;
        for l in ls.iter_mut() {
            l.0 = index_of[&l.0];
            if l.1 {
                general += 1;
            } else {
                verse_only += 1;
            }
        }
        ls.sort_by_key(|l| l.0);
        let u: Vec<Value> = ls
            .iter()
            .map(|l| json!([l.0, u8::from(l.1), l.2]))
            .collect();
        slots[r].insert("u".into(), Value::Array(u));
    }

    let mut index_rows = Vec::with_capacity(linked.len());
    let mut articles = Vec::with_capacity(linked.len());
    for &id in &linked {
        let e = &entries[id];
        let secs = refs.sections(e);
        let opening: String = secs
            .first()
            .map(|s| {
                s.1.iter()
                    .take_while(|g| g.0 != "\n")
                    .map(|g| g.0.as_str())
                    .collect()
            })
            .unwrap_or_default();
        index_rows.push(json!([e.handbook.key(), e.key, e.title, lead(&opening)]));
        articles.push(Value::Array(
            secs.into_iter()
                .map(|(h, segs)| {
                    json!([
                        h,
                        segs.into_iter()
                            .map(|(t, s, v)| json!([t, s, v]))
                            .collect::<Vec<_>>()
                    ])
                })
                .collect(),
        ));
    }
    let spec = inputs
        .spec
        .sources
        .iter()
        .find(|s| s.id == "ubs-ffr")
        .ok_or("sources.json has no ubs-ffr entry")?;
    let index = json!({
        "format": 1,
        "source": {
            "title": spec.title,
            "license": spec.license,
            "attribution": spec.attribution,
            "changes": "Only the description, usage, discussion, symbolism and \"other\" sections are kept; translation advice, reference lists and images are not used. Inline markup is reduced to bold, italic and verse links, and cross-references name the section they point to without its number. Each article is linked to the Hebrew and Greek roots whose verses it cites, and its lead is the opening of its first kept paragraph, cut at a sentence end.",
        },
        "entries": index_rows,
    });

    // --- Files ---------------------------------------------------------------
    let bytes = |v: &Value| serde_json::to_vec(v).map_err(|e| e.to_string());
    let mut files = Vec::new();
    for (k, chunk) in slots.chunks(ROOT_SHARD).enumerate() {
        let arr: Vec<Value> = chunk
            .iter()
            .map(|o| {
                if o.is_empty() {
                    Value::Null
                } else {
                    Value::Object(o.clone())
                }
            })
            .collect();
        files.push((format!("world/{k}.json"), bytes(&Value::Array(arr))?));
    }
    files.push(("world/ubs.json".to_string(), bytes(&index)?));
    for (n, chunk) in articles.chunks(ARTICLE_SHARD).enumerate() {
        files.push((
            format!("world/ubs/{n}.json"),
            bytes(&Value::Array(chunk.to_vec()))?,
        ));
    }
    let total: usize = files.iter().map(|f| f.1.len()).sum();
    eprintln!(
        "World: {with_lsj} Greek roots with LSJ ({with_senses} with senses, {with_first} with a first use; {grammar} grammar words, {related} words given a related word's entry and {names} names not shown); {} UBS entries linked to {roots_linked} roots (general {general}, verse-only {verse_only}); {} files, {} KB",
        linked.len(),
        files.len(),
        total.div_ceil(1024)
    );
    Ok(files)
}

// ---------------------------------------------------------------- verify

/// What an `atlas verify` run checks about `world/`, as (passed, what failed).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let mut out: Vec<(bool, String)> = Vec::new();
    let dir = d.dir.join("world");
    let read = |rel: &str| -> Result<Value, String> {
        let p = d.dir.join(rel);
        let s = fs::read_to_string(&p).map_err(|e| format!("reading {}: {e}", p.display()))?;
        serde_json::from_str(&s).map_err(|e| format!("parsing {rel}: {e}"))
    };

    // Structure: every file is listed in meta.json, parses, and fits the budget.
    let listed = d.meta["files"]
        .as_object()
        .ok_or("meta.json has no files")?;
    let mut on_disk: Vec<(String, Vec<u8>)> = Vec::new();
    let mut stack = vec![dir.clone()];
    while let Some(p) = stack.pop() {
        for e in fs::read_dir(&p).map_err(|e| format!("reading {}: {e}", p.display()))? {
            let path = e.map_err(|e| e.to_string())?.path();
            if path.is_dir() {
                stack.push(path);
            } else {
                let rel = path
                    .strip_prefix(&d.dir)
                    .map_err(|e| e.to_string())?
                    .to_string_lossy()
                    .replace('\\', "/");
                on_disk.push((rel, fs::read(&path).map_err(|e| e.to_string())?));
            }
        }
    }
    on_disk.sort();
    let unlisted: Vec<&str> = on_disk
        .iter()
        .filter(|f| !listed.contains_key(&f.0))
        .map(|f| f.0.as_str())
        .collect();
    out.push((
        unlisted.is_empty(),
        format!("world files missing from meta.json: {unlisted:?}"),
    ));
    let missing: Vec<&String> = listed
        .keys()
        .filter(|k| k.starts_with("world/") && !on_disk.iter().any(|f| &f.0 == *k))
        .collect();
    out.push((
        missing.is_empty(),
        format!("meta.json lists world files that are not on disk: {missing:?}"),
    ));
    let broken: Vec<&str> = on_disk
        .iter()
        .filter(|f| serde_json::from_slice::<Value>(&f.1).is_err())
        .map(|f| f.0.as_str())
        .collect();
    out.push((
        broken.is_empty(),
        format!("world files that do not parse: {broken:?}"),
    ));
    let big: Vec<String> = on_disk
        .iter()
        .filter(|f| f.1.len() > MAX_FILE_BYTES)
        .map(|f| format!("{} ({} bytes)", f.0, f.1.len()))
        .collect();
    out.push((big.is_empty(), format!("world files over 200 KB: {big:?}")));
    let total: usize = on_disk.iter().map(|f| f.1.len()).sum();
    out.push((
        total <= MAX_TOTAL_BYTES,
        format!("world/ is {total} bytes, over the 2.5 MB budget"),
    ));
    let esv: Vec<&str> = on_disk
        .iter()
        .filter(|f| f.1.windows(3).any(|w| w == b"ESV"))
        .map(|f| f.0.as_str())
        .collect();
    out.push((
        esv.is_empty(),
        format!("world files that mention ESV: {esv:?}"),
    ));

    // Root shards: one slot per root.
    let keys: Vec<&str> = d.lemmas["key"]
        .as_array()
        .ok_or("lemmas.json has no keys")?
        .iter()
        .filter_map(Value::as_str)
        .collect();
    let n_shards = keys.len().div_ceil(ROOT_SHARD);
    let mut slots: Vec<Value> = Vec::with_capacity(keys.len());
    for k in 0..n_shards {
        let shard = read(&format!("world/{k}.json"))?;
        let arr = shard
            .as_array()
            .ok_or(format!("world/{k}.json is not an array"))?;
        let want = ROOT_SHARD.min(keys.len() - k * ROOT_SHARD);
        out.push((
            arr.len() == want,
            format!("world/{k}.json has {} slots, expected {want}", arr.len()),
        ));
        slots.extend(arr.iter().cloned());
    }
    let shard_files = on_disk
        .iter()
        .filter(|f| f.0.matches('/').count() == 1 && f.0 != "world/ubs.json")
        .count();
    out.push((
        shard_files == n_shards,
        format!("{shard_files} root shards, expected {n_shards}"),
    ));

    let index = read("world/ubs.json")?;
    let entries = index["entries"]
        .as_array()
        .ok_or("world/ubs.json has no entries")?;
    let n = d.vz.verse_count();
    let mut bad_ref = 0;
    for s in &slots {
        for l in s["u"].as_array().into_iter().flatten() {
            let e_ok = l[0].as_u64().is_some_and(|e| (e as usize) < entries.len());
            let v_ok = l[2].as_array().is_some_and(|vs| {
                !vs.is_empty()
                    && vs
                        .iter()
                        .all(|v| v.as_u64().is_some_and(|v| v < u64::from(n)))
            });
            bad_ref += usize::from(!(e_ok && v_ok));
        }
    }
    out.push((
        bad_ref == 0,
        format!("{bad_ref} handbook links point at a missing entry or verse"),
    ));

    // LSJ: counts within 1% of the reference, and the spot values.
    let near = |got: usize, want: usize, pct: f64| {
        (got as f64 - want as f64).abs() <= want as f64 * pct / 100.0
    };
    let with_lsj = slots.iter().filter(|s| s.get("l").is_some()).count();
    let with_senses = slots
        .iter()
        .filter(|s| s["l"].as_array().is_some_and(|l| !l.is_empty()))
        .count();
    let with_first = slots.iter().filter(|s| s.get("f").is_some()).count();
    out.push((
        near(with_lsj, 5_020, 1.0),
        format!("{with_lsj} Greek roots with an LSJ entry, expected about 5,020"),
    ));
    out.push((
        near(with_senses, 4_637, 1.0),
        format!("{with_senses} Greek roots with an LSJ sense, expected about 4,637"),
    ));
    out.push((
        near(with_first, 4_790, 1.0),
        format!("{with_first} Greek roots with a first use, expected about 4,790"),
    ));
    let slot = |key: &str| {
        d.lemma_index(key)
            .and_then(|i| slots.get(i))
            .cloned()
            .unwrap_or(Value::Null)
    };
    for (key, gloss, who, when, extra) in [
        (
            "G1577",
            "assembly duly summoned",
            "Thucydides",
            "5th century BC",
            "i",
        ),
        (
            "G0728",
            "earnest-money, caution-money",
            "Isaeus",
            "4th century BC",
            "p",
        ),
        (
            "G0652",
            "messenger, ambassador, envoy",
            "Herodotus",
            "5th century BC",
            "",
        ),
        (
            "G2098",
            "reward of good tidings",
            "Homer",
            "8th century BC",
            "",
        ),
        ("G4166", "herdsman", "Homer", "8th century BC", ""),
        (
            "G3875",
            "legal assistant, advocate",
            "Demosthenes",
            "4th century BC",
            "",
        ),
        ("G4102G", "faith", "Hesiod", "8th century BC", ""),
        ("G5207", "son", "Homer", "8th century BC", ""),
        ("G0026", "love", "", "2nd century BC", "p"),
        ("G2218", "yoke", "Homer", "8th century BC", ""),
        ("G5336", "manger, crib", "Homer", "8th century BC", ""),
    ] {
        let s = slot(key);
        let first = &s["l"][0];
        let mut ok = first[0] == gloss && first[1] == when && first[2] == who;
        match extra {
            "i" => ok &= s["i"] == 1,
            "p" => ok &= first[3].as_str().is_some_and(|f| f.contains('p')) && s["p"] == 1,
            _ => {}
        }
        out.push((
            ok,
            format!(
                "{key}: first LSJ sense is {first}, expected [{gloss:?}, {when:?}, {who:?}]{}",
                if extra.is_empty() {
                    ""
                } else {
                    " with that source kind"
                }
            ),
        ));
    }
    // Beyond lsj5's rules: alternatives read together, examples, contrasts,
    // rejected readings, cognates and Latin left out, misprints and repeats
    // set right.
    for (key, gloss, who) in [
        ("G1391", "expectation", "Homer"),
        ("G0225", "truth", "Homer"),
        ("G1135G", "woman", "Homer"),
        ("G0649", "send off or away from", "Sophocles"),
        (
            "G5547",
            "to be rubbed on, used as ointment or salve",
            "Euripides",
        ),
        ("G3568", "now", "Homer"),
        ("G5485", "outward grace or favour, beauty", "Homer"),
        ("G4074G", "stone", "Homer"),
        ("G1939", "desire of or for", "Antiphon"),
        ("G1520", "one", "Homer"),
        ("G5342", "bear or carry", "Homer"),
        ("G3918", "present", "Homer"),
        ("G0109", "mist, haze", "Homer"),
    ] {
        let first = &slot(key)["l"][0];
        out.push((
            first[0] == gloss && first[2] == who,
            format!("{key}: first LSJ sense is {first}, expected {gloss:?} from {who}"),
        ));
    }
    // Names whose LSJ entry is another word keep none of it.
    for key in ["G4549G", "G4613G", "G2797", "G1050G"] {
        let s = slot(key);
        let none = s["l"].as_array().is_some_and(Vec::is_empty) && s.get("f").is_none();
        out.push((
            none,
            format!("{key}: LSJ's entry is another word, but the root has {s}"),
        ));
    }
    // Grammar words are flagged, and only roots with an LSJ entry.
    let unflagged: Vec<&str> = ["G2532", "G3588", "G1722", "G3956"]
        .into_iter()
        .filter(|k| slot(k)["g"] != 1)
        .collect();
    out.push((
        unflagged.is_empty() && slot("G1577").get("g").is_none(),
        format!("grammar words not flagged: {unflagged:?}; G1577 must not be one"),
    ));
    let stray = slots
        .iter()
        .filter(|s| s.get("g").is_some() && s.get("l").is_none())
        .count();
    out.push((
        stray == 0,
        format!("{stray} roots are flagged as grammar words but have no LSJ entry"),
    ));
    // So are the words TFLSJ gives a related word's entry.
    let unrelated: Vec<&str> = ["G4245G", "G3440", "G1966"]
        .into_iter()
        .filter(|k| slot(k)["r"] != 1)
        .collect();
    let stray = slots
        .iter()
        .filter(|s| s.get("r").is_some() && s.get("l").is_none())
        .count();
    out.push((
        unrelated.is_empty() && slot("G1577").get("r").is_none() && stray == 0,
        format!(
            "related-entry words not flagged: {unrelated:?}; G1577 must not be one; {stray} flagged without an LSJ entry"
        ),
    ));
    let odd: Vec<String> = slots
        .iter()
        .flat_map(|s| {
            s["l"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|x| x[2].as_str())
                .chain(s["f"][1].as_str())
        })
        .filter(|w| w.contains(['(', ')', ':', ';', '[']))
        .map(str::to_string)
        .collect();
    out.push((
        odd.is_empty(),
        format!("writer names with stray punctuation: {odd:?}"),
    ));

    // UBS: counts within 1% (scopes within 2%) of the reference.
    let links: Vec<&Value> = slots
        .iter()
        .flat_map(|s| s["u"].as_array().into_iter().flatten())
        .collect();
    let roots_linked = slots.iter().filter(|s| s.get("u").is_some()).count();
    let general = links.iter().filter(|l| l[1] == 1).count();
    out.push((
        near(entries.len(), 581, 1.0),
        format!(
            "{} handbook entries linked, expected about 581",
            entries.len()
        ),
    ));
    out.push((
        near(roots_linked, 1_365, 1.0),
        format!("{roots_linked} roots with a handbook entry, expected about 1,365"),
    ));
    out.push((
        near(links.len(), 1_627, 1.0),
        format!("{} handbook links, expected about 1,627", links.len()),
    ));
    out.push((
        near(general, 1_360, 2.0),
        format!("{general} general handbook links, expected about 1,360"),
    ));
    out.push((
        near(links.len() - general, 267, 2.0),
        format!(
            "{} verse-only handbook links, expected about 267",
            links.len() - general
        ),
    ));

    // The display rule gives what a reader should see.
    let c = d.container();
    let l_off = c.u32s("l_off").map_err(|e| format!("{e:?}"))?;
    let l_verse = c.u32s("l_verse").map_err(|e| format!("{e:?}"))?;
    let title = |e: usize| {
        entries
            .get(e)
            .and_then(|x| x[2].as_str())
            .unwrap_or("?")
            .to_string()
    };
    let rank = |e: usize| {
        entries
            .get(e)
            .and_then(|x| x[0].as_str())
            .map_or(usize::MAX, Handbook::rank)
    };
    for (place, key, want_v, want) in [
        ("Ruth 3:9", "H3671", 7181, &["Hem, corner of a garment"][..]),
        ("Ps 91:4", "H3671", 15399, &[]),
        ("Ps 51:7", "H0231", 14698, &["Marjoram"]),
        ("Exod 12:22", "H0231", 1838, &["Marjoram"]),
        ("Ps 35:3", "H5462", 14413, &["Battle-axe"]),
        ("Gen 7:16", "H5462", 175, &[]),
        ("Matt 11:29", "G2218", 23488, &["Yoke"]),
        ("Rev 6:5", "G2218", 30798, &["Balance scales"]),
        ("Ruth 3:2", "H1637", 7174, &["Threshing floor"]),
        ("John 1:29", "G0286", 26073, &["Sheep, lamb"]),
        (
            "Luke 2:7",
            "G5336",
            24980,
            &["Manger, feed trough, feedbox"],
        ),
        ("Isa 1:3", "H0018", 17657, &["Manger, feed trough, feedbox"]),
        ("Matt 21:19", "G4808", 23845, &["Fig"]),
        (
            "2 Kgs 20:7",
            "H1690",
            10105,
            &["Poultice, fig cake", "Blocks of pressed dried fruit", "Fig"],
        ),
        ("Gen 22:8", "H7716", 555, &["Flock, herd"]),
        ("John 10:11", "G4166", 26492, &[]),
        ("", "G2218", 0, &["Yoke"]),
        ("", "H3671", 0, &[]),
    ] {
        let r = d.lemma_index(key).ok_or(format!("no root {key}"))?;
        let verse = if place.is_empty() {
            None
        } else {
            Some(d.resolve(place)?.0)
        };
        if let Some(v) = verse {
            out.push((
                v == want_v,
                format!("{place} is verse {v}, expected {want_v}"),
            ));
        }
        let posts = &l_verse[l_off[r] as usize..l_off[r + 1] as usize];
        let verse = verse.filter(|v| posts.binary_search(v).is_ok());
        let mine: Vec<UbsLink> = slots[r]["u"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|l| {
                let vs = l[2]
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .filter_map(|v| v.as_u64().map(|v| v as u32))
                            .collect()
                    })
                    .unwrap_or_default();
                (l[0].as_u64().unwrap_or(u64::MAX) as usize, l[1] == 1, vs)
            })
            .collect();
        let got: Vec<String> = shown(&mine, verse, rank)
            .iter()
            .map(|l| title(l.0))
            .collect();
        let at = if place.is_empty() {
            "no verse".to_string()
        } else {
            place.to_string()
        };
        out.push((
            got == want,
            format!("{key} at {at} shows {got:?}, expected {want:?}"),
        ));
    }

    // Content: every linked entry has text to show, none of it translation
    // advice or leftover markup, and the license travels with the text.
    let raw_markup = |t: &str| {
        t.contains(['<', '>'])
            || t.as_bytes()
                .split(|b| !b.is_ascii_digit())
                .any(|run| run.len() >= 12)
    };
    let n_articles = entries.len().div_ceil(ARTICLE_SHARD);
    let (mut articles, mut empty, mut translation, mut markup) = (0, 0, 0, 0);
    for k in 0..n_articles {
        let shard = read(&format!("world/ubs/{k}.json"))?;
        for art in shard.as_array().into_iter().flatten() {
            articles += 1;
            let secs = art.as_array().map_or(&[][..], |a| a.as_slice());
            empty += usize::from(secs.is_empty());
            for sec in secs {
                let heading = sec[0].as_str().unwrap_or("");
                translation += usize::from(heading.eq_ignore_ascii_case("translation"));
                markup += usize::from(raw_markup(heading));
                for seg in sec[1].as_array().into_iter().flatten() {
                    markup += usize::from(seg[0].as_str().is_none_or(raw_markup));
                }
            }
        }
    }
    let leads_missing = entries
        .iter()
        .filter(|e| e[3].as_str().is_none_or(|l| l.is_empty() || raw_markup(l)))
        .count();
    out.push((
        articles == entries.len(),
        format!("{articles} handbook articles for {} entries", entries.len()),
    ));
    out.push((
        empty == 0,
        format!("{empty} handbook articles have no text"),
    ));
    out.push((
        leads_missing == 0,
        format!("{leads_missing} handbook entries have no clean lead"),
    ));
    out.push((
        translation == 0,
        format!("{translation} handbook sections are translation advice"),
    ));
    out.push((
        markup == 0,
        format!("{markup} handbook segments still hold markup or a raw reference code"),
    ));
    let src = &index["source"];
    out.push((
        src["license"] == "CC BY-SA 4.0",
        format!("world/ubs.json license is {}", src["license"]),
    ));
    let attribution = src["attribution"].as_str().unwrap_or("");
    let unnamed: Vec<&str> = Handbook::ALL
        .iter()
        .map(|h| h.title())
        .filter(|t| !attribution.contains(t))
        .collect();
    out.push((
        unnamed.is_empty(),
        format!("world/ubs.json attribution does not name {unnamed:?}"),
    ));
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    const LINK: &str = "<a href=\"javascript:void(0)\" title=\"";

    fn link(title: &str, label: &str) -> String {
        format!("[{LINK}{title}\">{label}</a>]")
    }

    #[test]
    fn tflsj_rows_need_every_field() {
        let good = "G2218\tG2218 =\tG2218\tζυγός\tzugos\tG:N-M\tyoke/scales\t<b> ζῠγόν</b>\tmore";
        assert_eq!(
            tflsj_row(good),
            Some(("G2218", "G:N-M", "<b> ζῠγόν</b>\tmore"))
        );
        // A combination entry has a space in its third field, so lsj5 skipped it.
        assert_eq!(tflsj_row("G0534\tG0534 = a Combination of\tG0737 (G0575+G0737)\tἀπαρτί\taparti\tG:ADV\thenceforth\tx"), None);
        assert_eq!(tflsj_row("G218\tG218 =\tx\tx\tx\tx\tx\tx"), None);
        assert_eq!(tflsj_row("G2218\tG2218 =\tG2218\tζυγός"), None);
    }

    #[test]
    fn dates_and_centuries() {
        assert_eq!(label_date("Refs 5th c.BC+"), Some(("5".into(), "BC")));
        assert_eq!(label_date("NT+5th c.BC+"), Some(("5".into(), "BC")));
        assert_eq!(label_date("LXX+NT+2nd c.AD"), Some(("2".into(), "AD")));
        assert_eq!(label_date("LXX"), None);
        assert_eq!(label_date("Refs"), None);
        assert_eq!(label_date("5th c.BC+ etc."), None);
        for (n, s) in [
            (1, "1st"),
            (2, "2nd"),
            (3, "3rd"),
            (4, "4th"),
            (11, "11th"),
            (12, "12th"),
            (13, "13th"),
            (21, "21st"),
            (22, "22nd"),
        ] {
            assert_eq!(ordinal(n), s);
        }
        assert_eq!(century("8", "BC"), Some((-750, "8th century BC".into())));
        assert_eq!(century("1", "AD"), Some((50, "1st century AD".into())));
    }

    #[test]
    fn writers_in_english_without_stray_punctuation() {
        assert_eq!(writer_name(" Ilias Homerus Epicus "), Some("Homer".into()));
        assert_eq!(
            writer_name("Meleager Epigrammaticus)"),
            Some("Meleager".into())
        );
        assert_eq!(
            writer_name("Dio Cassius Historicus "),
            Some("Cassius Dio".into())
        );
        assert_eq!(writer_name("Plutarchus "), Some("Plutarch".into()));
        assert_eq!(writer_name("Xenophon Ephesius "), Some("Xenophon".into()));
        assert_eq!(
            writer_name("Aelius Aristides "),
            Some("Aelius Aristides".into())
        );
        assert_eq!(writer_name("  "), None);
        // What follows the name is LSJ's commentary, not part of it.
        assert_eq!(
            writer_name("Meleager Epigrammaticus): _metaphorically_"),
            Some("Meleager".into())
        );
        assert_eq!(
            writer_name("Bacchylides Lyricus: Comedy texts"),
            Some("Bacchylides".into())
        );
        assert_eq!(writer_name("Solon cited "), Some("Solon".into()));
        // The Bible book a translator is cited for is not part of the name.
        assert_eq!(
            writer_name("Symmachus LXX.Eze.10.13, “Hippiatrica” 79"),
            Some("Symmachus".into())
        );
        assert_eq!(
            writer_name("Theodotion LXX), LXX.Judg.6.29"),
            Some("Theodotion".into())
        );
        assert_eq!(
            writer_name("Lucillius Epigrammaticus) ἀπίναι"),
            Some("Lucillius".into())
        );
        assert_eq!(
            writer_name("Hecataeus Milesius Historicus: personified"),
            Some("Hecataeus Milesius".into())
        );
        assert_eq!(
            writer_name("Dionysius Halicarnassensis "),
            Some("Dionysius of Halicarnassus".into())
        );
        // Words for what a writer wrote, places or works cut short and book
        // numbers are not part of the name; a full name ending a sentence is.
        for (name, want) in [
            ("Plinius Rerum Naturalium Scriptor ", "Pliny"),
            ("Babrius Fabularum Scriptor ", "Babrius"),
            ("Alcaeus Lyricus Comedy texts", "Alcaeus"),
            ("Chrysippus Stoicus ", "Chrysippus"),
            ("Magnes Comicus Mae.)", "Magnes"),
            ("Bacchylides Lyricus IV.", "Bacchylides"),
            ("Clytus Historicus I", "Clytus"),
            ("Socratis et Socraticorum Epistulae ", "Socratic Letters"),
            ("Cratinus Junior Comicus ", "Cratinus Junior"),
            (
                "Eustathius Episcopus Thessalonicensis).",
                "Eustathius Thessalonicensis",
            ),
        ] {
            assert_eq!(writer_name(name).as_deref(), Some(want), "{name}");
        }
        let title = " “hymnus” 217, 5th-6th c.BC: Plato Philosophus “Timaeus” 63b, 8th c.BC: Ilias Homerus Epicus “Illiad” 5.799";
        assert_eq!(writer(title, "Refs 8th c.BC+"), Some("Homer".into()));
        assert_eq!(writer(title, "Refs 5th c.BC+"), Some("Plato".into()));
        assert_eq!(writer(title, "Refs 2nd c.AD+"), None);
        // A date followed only by a reference gives no name.
        assert_eq!(writer(" 2nd c.BC: 1.2", "Refs 2nd c.BC+"), None);
        // TFLSJ dates Aeschylus "4th-5th c.BC", and labels his citations
        // 4th century BC: he is of the 5th. Plato's "5th-6th" keeps its 5th.
        let century_of = |title: &str, label: &str| {
            label_century(title, label).map(|(_, c, w)| (c, w.unwrap_or_default()))
        };
        assert_eq!(
            century_of(
                " 4th-5th c.BC: Aeschylus Tragicus “Agamemnon” 1",
                "Refs 4th c.BC+"
            ),
            Some(("5th century BC".to_string(), "Aeschylus".to_string()))
        );
        assert_eq!(
            century_of(
                " 5th-6th c.BC: Plato Philosophus “Respublica” 1",
                "Refs 5th c.BC+"
            ),
            Some(("5th century BC".to_string(), "Plato".to_string()))
        );
        assert_eq!(
            century_of(
                " 4th-3rd c.BC: Theophrastus Philosophus 1",
                "Refs 4th c.BC+"
            ),
            Some(("4th century BC".to_string(), "Theophrastus".to_string()))
        );
    }

    #[test]
    fn papyri_and_inscriptions() {
        assert!(
            papyri(" “PTeb.” 1.2")
                && papyri(" “POxy” 1.2")
                && papyri("see PSI 4")
                && papyri(" “OEdfou.” 3")
        );
        assert!(!papyri("PSIx 4") && !papyri("APTeb 3") && !papyri(" “Pt” 1"));
        assert!(
            inscriptions(" “IG” 2")
                && inscriptions("SIG 3")
                && inscriptions("SIG3")
                && inscriptions(" “IGRom” 4")
        );
        assert!(!inscriptions("XSIG 3") && !inscriptions("SIG x") && !inscriptions("IGRom 4"));
    }

    #[test]
    fn senses_follow_the_lsj5_rules() {
        let m = format!(
            "<b> ζυγόν</b>, τό, <b>ζυγός</b> {} <br /><Level2><b>__I</b></Level2> <b>yoke</b> of a plough {} <b>the yoke</b> of slavery {}\
             <Level2><b>__II</b></Level2> <b>crossbar</b> {} <Level2><b>__III</b></Level2> <b>beam of the balance</b> {}",
            link(" LXX.Gen.27.40", "LXX+NT"),
            link(" 8th c.BC: Ilias Homerus Epicus “Illiad” 5.799 ", "Refs 8th c.BC+"),
            link(" 5th c.BC: Herodotus Historicus 7.8 ", "Refs 5th c.BC+"),
            link(" 8th c.BC: Ilias Homerus Epicus 9.187, “IG” 2 ", "Refs 8th c.BC+"),
            link(" 4th c.BC: Aeschylus Tragicus, “PTeb.” 3", "Refs 4th c.BC+"),
        );
        let e = lsj(&m).unwrap();
        let g: Vec<(&str, &str, Option<&str>, bool, bool)> = e
            .senses
            .iter()
            .map(|s| {
                (
                    s.gloss.as_str(),
                    s.century.as_str(),
                    s.writer.as_deref(),
                    s.papyri,
                    s.inscriptions,
                )
            })
            .collect();
        // "the yoke" only repeats "yoke", and Greek bolds are not glosses.
        assert_eq!(
            g,
            vec![
                ("yoke", "8th century BC", Some("Homer"), false, false),
                ("crossbar", "8th century BC", Some("Homer"), false, true),
                (
                    "beam of the balance",
                    "4th century BC",
                    Some("Aeschylus"),
                    true,
                    false
                ),
            ]
        );
        assert_eq!(
            e.first,
            Some(("8th century BC".into(), Some("Homer".into())))
        );
        assert!(e.papyri && e.inscriptions);
        assert!(lsj("<b>x</b> LSJ has no entry").is_none());
    }

    #[test]
    fn contrasts_and_absences_are_not_senses() {
        let link = |label: &str, title: &str| {
            format!("<a href=\"javascript:void(0)\" title=\"{title}\">{label}</a>")
        };
        let homer = link("Refs 8th c.BC+", " 8th c.BC: Ilias Homerus Epicus 1.1");
        let hdt = link("Refs 5th c.BC+", " 5th c.BC: Herodotus Historicus 1.1");
        let glosses = |e: &Lsj| {
            e.senses
                .iter()
                .map(|s| (s.gloss.clone(), s.writer.clone().unwrap_or_default()))
                .collect::<Vec<_>>()
        };
        let pair = |g: &str, w: &str| (g.to_string(), w.to_string());
        // "woman, opposed to man [Homer]": the reference belongs to "woman".
        let e = lsj(&format!(
            "<b> γυνή</b>, ἡ:—<b>woman,</b> opposed to <b>man,</b>[{homer}] <b>wife</b> [{hdt}]"
        ))
        .unwrap();
        assert_eq!(
            glosses(&e),
            [pair("woman", "Homer"), pair("wife", "Herodotus")]
        );
        // What "truth" is set against never becomes a sense, even when dated.
        let e = lsj(&format!(
            "<b> ἀλήθεια</b> <Level2><b>__I</b></Level2> <b>truth</b>, opposed to <b>lie</b> or \
             <b>mere appearance</b>: <Level3><b>__I.1</b></Level3> in [{homer}] only opposed to \
             <b>a lie</b>, [{homer}] to tell whole <b>truth</b> about the lad, [{homer}]"
        ))
        .unwrap();
        assert_eq!(glosses(&e), [pair("truth", "Homer")]);
        // A gloss after a contrast, but not joined to it, still counts.
        let e = lsj(&format!(
            "<b> x</b> <b>slave,</b> opposed to <b>freeman</b>; <b>bondman</b> [{hdt}]"
        ))
        .unwrap();
        assert_eq!(glosses(&e), [pair("bondman", "Herodotus")]);
        // "not in [Homer]" dates nothing, not even the earliest example.
        let e = lsj(&format!(
            "<b> δοῦλος</b> <b>bondman, slave,</b> not in [{homer}], but in [{hdt}]"
        ))
        .unwrap();
        assert_eq!(glosses(&e), [pair("bondman, slave", "Herodotus")]);
        assert_eq!(
            e.first.as_ref().map(|f| f.0.as_str()),
            Some("5th century BC")
        );
        // With only "not in [Homer]" before the next gloss, the first dated
        // reference later in the sense dates it; a quoted phrase is no gloss.
        let e = lsj(&format!(
            "<b> ἀληθής</b> <Level3><b>__I.2</b></Level3> <b>truthful, honest</b> (not in [{homer}]; \
             οἶνος ἀ. `<b>in vino veritas</b>', [{undated}] [{hdt}]",
            undated = link("Refs", " Theognis 1.1"),
        ))
        .unwrap();
        assert_eq!(glosses(&e), [pair("truthful, honest", "Herodotus")]);
        let e = lsj(&format!(
            "<b> βελτίων</b> <b>better</b> (not in [{homer}] <b>it is fitting</b>, [{hdt}]"
        ))
        .unwrap();
        assert_eq!(
            glosses(&e),
            [
                pair("better", "Herodotus"),
                pair("it is fitting", "Herodotus")
            ]
        );
        // "not (as [Aristarchus]) lower air": a reading LSJ rejects and the
        // one who held it are neither a sense nor its date.
        let e = lsj(&format!(
            "<b> ἀήρ</b> always <b>mist, haze</b>, not (as [{aristarchus}] <b>lower air</b> \
             (opposed to αἰθήρ); δι᾽ ἠέρος [{homer}]",
            aristarchus = link("Refs 3rd c.BC+", " 3rd-2nd c.BC: Aristarchus Grammaticus)"),
        ))
        .unwrap();
        assert_eq!(glosses(&e), [pair("mist, haze", "Homer")]);
        assert!(!rejected("x, cannot (as ["));
        assert!(ends_with_phrase("x, never used by [", &ABSENT));
        assert!(ends_with_phrase("man as opposed to to ", &CONTRAST));
        assert!(!ends_with_phrase("man as opposed toto ", &CONTRAST));
        assert!(!ends_with_phrase("x, not only [", &ABSENT));
        assert!(!ends_with_phrase("x, cannot in [", &ABSENT));
    }

    #[test]
    fn grammar_words_and_fragments() {
        for c in [
            "G:T",
            "G:CONJ",
            "G:PRT-N",
            "G:PREP / G:A",
            "G:P",
            "G:R",
            "G:X",
            "G:COND",
        ] {
            assert!(grammar_word(c), "{c}");
        }
        for c in [
            "G:N-M",
            "G:V",
            "G:A",
            "G:ADV",
            "G:INJ",
            "N:N-L",
            "G:A / G:ADV",
            "G:Α",
            "",
        ] {
            assert!(!grammar_word(c), "{c}");
        }
        assert_eq!(clean_gloss("glact):—milk"), "milk");
        assert_eq!(
            clean_gloss("a keeping of days of rest, Ep. Hebrew"),
            "a keeping of days of rest"
        );
        assert_eq!(clean_gloss("either.. or"), "either.. or");
        assert!(!gloss_ok(&clean_gloss("cup. bowl")));
        assert_eq!(
            clean_gloss("shear.):—cut short, shear, clip"),
            "cut short, shear, clip"
        );
        for g in [
            "l), Alc",
            "foreign) tongue",
            "especially (since",
            "Exc. ex libris Herodiani",
            "with the whole multitude, NT.Luke",
        ] {
            assert!(!gloss_ok(g), "{g}");
        }
        for g in [
            "either.. or",
            "how possibly..?",
            "oblong shield (shaped like a door)",
            "milk",
        ] {
            assert!(gloss_ok(g), "{g}");
        }
    }

    /// The first sense of an entry, as (gloss, writer).
    fn first_sense(meaning: &str) -> Option<(String, String)> {
        lsj(meaning).and_then(|e| {
            e.senses
                .first()
                .map(|s| (s.gloss.clone(), s.writer.clone().unwrap_or_default()))
        })
    }

    /// The writer of the citation a label dates.
    fn writer(title: &str, label: &str) -> Option<String> {
        cited(title, label).and_then(|i| writer_name(i.name))
    }

    fn lsj_link(label: &str, title: &str) -> String {
        format!("<a href=\"javascript:void(0)\" title=\"{title}\">{label}</a>")
    }

    fn sense(gloss: &str, writer: &str) -> Option<(String, String)> {
        Some((gloss.to_string(), writer.to_string()))
    }

    #[test]
    fn alternatives_and_split_glosses_read_as_one() {
        let homer = lsj_link("Refs 8th c.BC+", " 8th c.BC: Ilias Homerus Epicus 1.1");
        let soph = lsj_link("Refs 5th c.BC+", " 5th c.BC: Sophocles Tragicus “Ajax” 1");
        // Alternatives: the second alone is only the end of a phrase.
        assert_eq!(
            first_sense(&format!(
                "<b> ἀποστέλλω</b>, <b>send off</b> or <b>away from</b>, [{soph}]"
            )),
            sense("send off or away from", "Sophocles")
        );
        assert_eq!(
            first_sense(&format!("<b> x</b>, <b>free</b> or <b>free</b> [{homer}]")),
            sense("free", "Homer")
        );
        // A gloss split around a word or two, or by the markup.
        assert_eq!(
            first_sense(&format!(
                "<b> ὁρκίζω</b>, <b>make</b> one <b>swear</b> [{homer}]"
            )),
            sense("make one swear", "Homer")
        );
        assert_eq!(
            first_sense(&format!(
                "<b> x</b>, of Time, <b>to be born after, come</b> <b>into being after</b> [{homer}]"
            )),
            sense("to be born after, come into being after", "Homer")
        );
        // Never past the longest gloss.
        let long = "a".repeat(50);
        assert_eq!(
            first_sense(&format!(
                "<b> x</b>, <b>{long} b</b> or <b>{long} c</b> [{homer}]"
            )),
            sense(&format!("{long} c"), "Homer")
        );
        // A gloss that narrows the one before joins it, spaced as English.
        assert_eq!(
            first_sense(&format!(
                "<b> σφάζω</b>, <b>slay, slaughter,</b> properly <b>by cutting the throat,</b> [{homer}]"
            )),
            sense("slay, slaughter, properly by cutting the throat", "Homer")
        );
        assert_eq!(
            first_sense(&format!(
                "<b> θέατρον</b>, <b>place for seeing,</b> especially<b>for dramatic representation,</b> [{homer}]"
            )),
            sense("place for seeing, especially for dramatic representation", "Homer")
        );
        assert!(!narrows("passive", "to be loved"));
        assert!(!narrows("especially", "sheep"));
        // A short word still ends a pair of alternatives...
        assert_eq!(
            first_sense(&format!(
                "<b> ἀμφιέννυμι</b> <b>put round</b> or <b>on,</b> ἀμφὶ δὲ καλὰ [{homer}]"
            )),
            sense("put round or on", "Homer")
        );
        // ...but not after a phrase, or a list that ends in one already.
        for meaning in [
            format!(
                "<b> ὑπέχω</b>, <b>put</b> a mare <b>under</b> or <b>to</b> a horse, [{homer}]"
            ),
            format!("<b> x</b>, <b>kin, relationship, with</b> or <b>to</b> another, [{homer}]"),
            format!("<b> x</b>, <b>made of</b> or <b>from</b> βύσσος [{homer}]"),
        ] {
            assert_eq!(first_sense(&meaning), None, "{meaning}");
        }
    }

    #[test]
    fn examples_are_not_glosses() {
        let homer = lsj_link("Refs 8th c.BC+", " 8th c.BC: Ilias Homerus Epicus 1.1");
        let soph = lsj_link("Refs 5th c.BC+", " 5th c.BC: Sophocles Tragicus “Ajax” 1");
        let undated = lsj_link("Refs", " Theognis 1.1");
        // The span in the translation of an example is no new sense: the
        // gloss before it keeps the reference after the example.
        assert_eq!(
            first_sense(&format!(
                "<b> δόξα</b>, ἡ, (δοκέω) <b>expectation,</b> οὐδ᾽ ἀπὸ δόξης not otherwise than \
                 <b>one expects,</b> [{homer}]"
            )),
            sense("expectation", "Homer")
        );
        assert_eq!(
            first_sense(&format!(
                "<b> νῦν</b>, adverb <b>now,</b> both of the <b>present moment,</b> and of the \
                 <b>present time</b> generally, οἳ ν. βροτοί εἰσιν mortals <b>of our day,</b> [{homer}]"
            )),
            sense("now", "Homer")
        );
        // Before any gloss, such a span may be all there is.
        assert_eq!(
            first_sense(&format!(
                "<b> δύο</b>, ἕνα καὶ δύο one or <b>two</b>, a few, [{homer}]"
            )),
            sense("two", "Homer")
        );
        // After a reference, a few English words begin a new gloss.
        let e = lsj(&format!(
            "<b> ἐργασία</b>, <b>work, business,</b> [{undated}] opposed to ἀργία, [{soph}] \
             productive <b>labour,</b> [{homer}]"
        ))
        .unwrap();
        let glosses: Vec<&str> = e.senses.iter().map(|s| s.gloss.as_str()).collect();
        assert_eq!(glosses, ["work, business", "labour"]);
        for (gap, example) in [
            (" οὐδ᾽ ἀπὸ δόξης not otherwise than ", true),
            (", τὸ ἔλαιον τὸ χ. ", true),
            (" about 6 ", true),
            (" (δοκέω, δέκομαι) ", false),
            (", compare Λύκη):— ", false),
            (" <i>plural</i> ", false),
            (" generally ", false),
            (" adverb ", false),
            (" [<a href=\"x\">Refs</a>] ", false),
            ("", false),
        ] {
            assert_eq!(continues_phrase(gap), example, "{gap:?}");
        }
    }

    #[test]
    fn citations_titles_and_spellings_are_not_glosses() {
        let homer = lsj_link("Refs 8th c.BC+", " 8th c.BC: Ilias Homerus Epicus 1.1");
        let soph = lsj_link("Refs 5th c.BC+", " 5th c.BC: Sophocles Tragicus “Ajax” 1");
        // "in sense check, see below" points elsewhere; "lon947" is a citation.
        assert_eq!(
            first_sense(&format!(
                "<b> ἔχω</b>, (especially in sense <b>check</b>, see below [{soph}]; σχέο \
                 [{homer}]<b>lon</b>947; Trans., <b>have, hold</b> [{homer}]"
            )),
            sense("have, hold", "Homer")
        );
        // A spelling, and a title after its author's name.
        assert_eq!(
            first_sense(&format!(
                "<b> υἱός</b>, υἱύς (written <b>huihus</b>) [{soph}]:— <b>son,</b> [{homer}]"
            )),
            sense("son", "Homer")
        );
        assert_eq!(
            first_sense(&format!(
                "<b> νοέω</b>, νενόηθι Hilgard <b>Excerpta e libris Herodiani</b> [{soph}]:— \
                 <b>perceive by the eyes, observe</b> [{homer}]"
            )),
            sense("perceive by the eyes, observe", "Homer")
        );
        assert!(titled(" Ramsay ", "Cities and Bishoprics"));
        assert!(!titled(" Roman ", "governor"));
        assert!(!titled("; ", "Persis, Persia"));
        assert!(!titled(" generally ", "Zeus"));
    }

    #[test]
    fn cognates_are_not_glosses() {
        let homer = lsj_link("Refs 8th c.BC+", " 8th c.BC: Ilias Homerus Epicus 1.1");
        let soph = lsj_link("Refs 5th c.BC+", " 5th c.BC: Sophocles Tragicus “Ajax” 1");
        let late = lsj_link("Refs 5th c.AD+", " 5th c.AD: Hesychius Lexicographus 1");
        // A word of another language in the etymology...
        assert_eq!(
            first_sense(&format!(
                "<b> φέρω</b>, cf. Latin <i>fero,</i> O[{soph}] <b>beran,</b> Sanskrit \
                 <i>bhárati</i> [{late}]; <b>bear</b> or <b>carry</b> a load, [{homer}]"
            )),
            sense("bear or carry", "Homer")
        );
        // ...but not the gloss after LSJ's ":—", nor a span after a
        // comparison with another Greek word.
        assert_eq!(
            first_sense(&format!(
                "<b> γάλα</b>, cf. Latin <i>lac</i> for <b>glact):—milk</b>, ἀμελγόμενοι [{homer}]"
            )),
            sense("milk", "Homer")
        );
        assert_eq!(
            first_sense(&format!(
                "<b> x</b> (but feminine, [{soph}], compare ξυμφορὴ γίνεται δ. [{soph}], \
                 <b>teacher, master,</b> μαντείης [{soph}]"
            )),
            sense("teacher, master", "Sophocles")
        );
        // A list of cognates goes on until its clause ends.
        let e = lsj(&format!(
            "<b> υἱός</b>, <b>son,</b> [{homer}] (cf. Sanskrit <i>sūte</i>, Tocharian (A) \
             <b>sexx,</b> (B) <b>soyä</b> 'son' [{soph}]); <b>child</b> [{late}]"
        ))
        .unwrap();
        let glosses: Vec<&str> = e.senses.iter().map(|s| s.gloss.as_str()).collect();
        assert_eq!(glosses, ["son", "child"]);
        // Latin: the verb a compound is made from, and an equivalent.
        assert_eq!(
            first_sense(&format!(
                "<b> ἄπειμι</b>, (εἰμί <b>sum</b>), <i>imperfect</i> ἀπῆν [{late}]; \
                 <b>to be away</b> [{soph}]"
            )),
            sense("to be away", "Sophocles")
        );
        let e = lsj(&format!(
            "<b> x</b>, <b>son,</b> [{homer}]; = Latin [{late}] <b>filius,</b> [{soph}]"
        ))
        .unwrap();
        assert_eq!(e.senses.len(), 1);
        // After a bare "=", Latin goes and English stays.
        let e = lsj(&format!(
            "<b> ἐκκλησία</b>, <b>assembly,</b> [{homer}]: at Rome, = <b>Comitia Centuriata, \
             Curiata,</b> [{soph}] <Level2><b>__II</b></Level2> = <b>yolk</b> [{late}]"
        ))
        .unwrap();
        let glosses: Vec<&str> = e.senses.iter().map(|s| s.gloss.as_str()).collect();
        assert_eq!(glosses, ["assembly", "yolk"]);
        assert!(latin_words("a militiis") && latin_words("praejudicium"));
        assert!(!latin_words("by right of inheritance") && !latin_words("here"));
        assert!(!gloss_ok("ĝhoryo"));
        assert!(gloss_ok("front, façade"));
    }

    #[test]
    fn dating_passes_over_undated_references() {
        let soph = lsj_link("Refs 5th c.BC+", " 5th c.BC: Sophocles Tragicus “Ajax” 1");
        let undated = lsj_link("Refs", " Theognis 1.1");
        let lxx = lsj_link("LXX", " LXX Ge.1.1");
        assert_eq!(
            first_sense(&format!(
                "<b> δρόμος</b>, <b>course, race,</b> of horses, [{undated}], [{soph}]"
            )),
            sense("course, race", "Sophocles")
        );
        // A first reference to the Bible alone makes the sense a biblical one.
        assert_eq!(
            first_sense(&format!("<b> x</b>, <b>feel pity</b> [{lxx}] [{soph}]")),
            None
        );
        // LSJ's "Id." takes the writer and date of the citation before it,
        // the last in the reference before, even in an earlier sense block...
        let plato = lsj_link(
            "Refs 5th c.BC+",
            " 5th c.BC: Herodotus Historicus 1.1, 5th-6th c.BC: Plato Philosophus “Leges” 889c: ",
        );
        let id = lsj_link("Refs", " [prev. author] “Cra.” 424d");
        let late = lsj_link("Refs 1st c.BC+", " 1st c.BC: Meleager Epigrammaticus 1");
        let e = lsj(&format!(
            "<b> x</b> -εκεράσθην [{plato}] <Level2><b>__II</b></Level2> \
             <b>mix, blend with</b>, [{id}]; [{late}]"
        ))
        .unwrap();
        assert_eq!(
            (e.senses[0].writer.as_deref(), e.senses[0].century.as_str()),
            (Some("Plato"), "5th century BC")
        );
        // ...and of the one before that when it is "Id." too...
        let id_work = lsj_link("Refs", "[prev. work] 425a");
        assert_eq!(
            first_sense(&format!(
                "<b> x</b> [{plato}] [{id}]:—<b>mix</b>, [{id_work}]; [{late}]"
            )),
            sense("mix", "Plato")
        );
        // ...but not when that citation has no date, or another work
        // follows it, so that "the same" could mean either.
        let ig = lsj_link("Refs", " “IG” 22.1627.398 ");
        assert_eq!(
            first_sense(&format!(
                "<b> x</b> [{plato}] [{ig}]:—<b>build</b>, [{id_work}]; [{soph}]"
            )),
            sense("build", "Sophocles")
        );
        // "Id." never dates a gloss on its own.
        let e = lsj(&format!(
            "<b> x</b> [{plato}] <b>mix</b>, [{id}] <b>blend</b> [{late}]"
        ))
        .unwrap();
        let glosses: Vec<&str> = e.senses.iter().map(|s| s.gloss.as_str()).collect();
        assert_eq!(glosses, ["blend"]);
        let mixed = lsj_link(
            "Refs 5th c.BC+",
            " 5th c.BC: Herodotus Historicus 1.2; “IG” 1.3",
        );
        assert_eq!(
            first_sense(&format!(
                "<b> x</b> [{mixed}]:—<b>build</b>, [{id}]; [{late}]"
            )),
            sense("build", "Meleager")
        );
    }

    #[test]
    fn glosses_that_stop_short() {
        let hdt = lsj_link("Refs 5th c.BC+", " 5th c.BC: Herodotus Historicus 1.1");
        assert_eq!(
            first_sense(&format!(
                "<b> βύσσινος</b>, η, ον, <b>made of</b> βύσσος, σινδὼν β. <b>fine linen</b> [{hdt}]"
            )),
            sense("fine linen", "Herodotus")
        );
        assert!(runs_into_greek("made of", "made of", " βύσσος"));
        assert!(!runs_into_greek("make war", "make war", " πρός τινα"));
        assert!(!runs_into_greek("made of,", "made of", " βύσσος"));
        assert!(!runs_into_greek("made of", "made of", " linen"));
        for g in [
            "the",
            "belonging to the",
            "the character of an",
            "for having forsaken his",
        ] {
            assert!(!gloss_ok(g), "{g}");
        }
        assert!(gloss_ok("the hand"));
    }

    #[test]
    fn misprints_and_repeats_are_set_right() {
        for (bad, good) in [
            (
                "outward grace or fauour, beauty",
                "outward grace or favour, beauty",
            ),
            ("mght-season", "night-season"),
            (
                "lion or loins, lower part of the back",
                "loin or loins, lower part of the back",
            ),
            ("falldue", "fall due"),
            ("lion", "lion"),
            ("fauours", "fauours"),
            ("fall due", "fall due"),
        ] {
            assert_eq!(fix_misprints(bad), good);
        }
        for (gloss, once) in [
            ("one, one", "one"),
            ("so, thus, So", "so, thus"),
            ("one, one alone", "one, one alone"),
        ] {
            assert_eq!(once_each(gloss), once);
        }
    }

    #[test]
    fn glosses_are_english() {
        for g in ["yoke", "earnest-money, caution-money", "the yoke"] {
            assert!(gloss_ok(g), "{g}");
        }
        for g in [
            "ab",
            "a b c",
            "with",
            "ζυγός",
            "pathos (ā)",
            "NT sense",
            "x = y",
            "[yoke]",
            "'yoke",
        ] {
            assert!(!gloss_ok(g), "{g}");
        }
        assert_eq!(
            clean_gloss(" <i>yoke</i>, &lt;of&gt; oxen; "),
            "yoke, <of> oxen"
        );
        assert_eq!(
            word_set("The yoke of a Plough"),
            ["plough", "yoke"].iter().map(|s| s.to_string()).collect()
        );
    }

    #[test]
    fn greek_base_matches_python_nfd() {
        // unicodedata.normalize('NFD', chr(u).lower()), kept to α-ω and ς,
        // then ς -> σ; "." where nothing is left. One row of 64 per line.
        let greek = concat!(
            "......................α.εηι.ο.υωιαβγδεζηθικλμνξοπρ.στυφχψωιυαεηι",
            "υαβγδεζηθικλμνξοπρσστυφχψωιυουω.................................",
            "....θ...........",
        );
        let extended = concat!(
            "ααααααααααααααααεεεεεε..εεεεεε..ηηηηηηηηηηηηηηηηιιιιιιιιιιιιιιιι",
            "οοοοοο..οοοοοο..υυυυυυυυ.υ.υ.υ.υωωωωωωωωωωωωωωωωααεεηηιιοουυωω..",
            "ααααααααααααααααηηηηηηηηηηηηηηηηωωωωωωωωωωωωωωωωααααα.ααααααα.ι.",
            "..ηηη.ηηεεηηη...ιιιι..ιιιιιι....υυυυρρυυυυυυρ.....ωωω.ωωοοωωω...",
        );
        for (start, table) in [(0x0370u32, greek), (0x1F00, extended)] {
            for (i, want) in table.chars().enumerate() {
                let c = char::from_u32(start + i as u32).unwrap();
                assert_eq!(
                    greek_base(c),
                    (want != '.').then_some(want),
                    "U+{:04X}",
                    start + i as u32
                );
            }
        }
        assert_eq!(greek_base('\u{2126}'), Some('ω'));
        assert_eq!(greek_letters("Ἐκκλησίας"), "εκκλησιασ");
        assert_eq!(greek_letters("ῥῆμα ῾"), "ρημα");
        assert_eq!(hebrew_letters("מוֹטָה"), "מוטה");
    }

    #[test]
    fn lemma_forms_split() {
        assert_eq!(lemma_forms("מוֹט, מוֹטָה"), vec!["מוֹט", "מוֹטָה"]);
        assert_eq!(
            lemma_forms("ζυγός or ζυγόν; κλοιός/ x"),
            vec!["ζυγός", "ζυγόν", "κλοιός", "x"]
        );
        assert_eq!(lemma_forms(" ,"), Vec::<&str>::new());
    }

    #[test]
    fn tahot_refs_give_both_numberings() {
        assert_eq!(tahot_ref("Gen.1.1#01=L"), Some((0, 1, 1, 1, 1)));
        assert_eq!(tahot_ref("Mal.4.1(3.19)#01=L"), Some((38, 4, 1, 3, 19)));
        assert_eq!(tahot_ref("Psa.3.1(2)#01=L"), Some((18, 3, 1, 3, 2)));
        assert_eq!(tahot_ref("Ref: Eng (+Heb)#Heb.words"), None);
    }

    fn small_vz() -> Versification {
        // Genesis 2 chapters (3 and 2 verses), the rest one verse each; Malachi 4 chapters.
        let mut counts = vec![vec![1u16]; 66];
        counts[0] = vec![3, 2];
        counts[38] = vec![1, 1, 2, 6];
        Versification::from_counts(&counts)
    }

    #[test]
    fn references_name_the_verse_they_open() {
        let vz = small_vz();
        let mut hebrew = HebrewMap::new();
        hebrew.insert((38, 3, 3), vz.index(38, 4, 1).unwrap());
        let refs = Refs {
            vz: &vz,
            hebrew: &hebrew,
        };
        let gen11 = vz.index(0, 1, 1).unwrap() as i64;
        assert_eq!(
            refs.reference("H00100100100012"),
            Some(("Genesis 1:1".into(), gen11))
        );
        assert_eq!(
            refs.reference("00100100100012-00100100300004"),
            Some(("Genesis 1:1–3".into(), gen11))
        );
        assert_eq!(
            refs.reference("00100100200012-00100200100004"),
            Some(("Genesis 1:2–2:1".into(), gen11 + 1))
        );
        assert_eq!(
            refs.reference("H00100200000000"),
            Some(("Genesis 2".into(), gen11 + 3))
        );
        // Hebrew Malachi 3:3 is the app's Malachi 4:1.
        assert_eq!(
            refs.reference("H03900300300000"),
            Some(("Malachi 4:1".into(), vz.index(38, 4, 1).unwrap() as i64))
        );
        assert_eq!(
            refs.reference("L07102801900034"),
            Some(("Sirach 28:19".into(), -1))
        );
        assert_eq!(
            refs.reference("L07102801900034-L07102802000010"),
            Some(("Sirach 28:19–20".into(), -1))
        );
        assert_eq!(
            refs.reference("L11200100100000"),
            Some(("another ancient book".into(), -1))
        );
        assert_eq!(
            refs.reference("H00109900100000"),
            Some(("Genesis 99:1".into(), -1))
        );
        assert_eq!(refs.reference("‘alah"), None);
    }

    #[test]
    fn paragraphs_become_safe_segments() {
        let vz = small_vz();
        let hebrew = HebrewMap::new();
        let refs = Refs {
            vz: &vz,
            hebrew: &hebrew,
        };
        let gen = |c, v| vz.index(0, c, v).unwrap() as i64;
        let p = refs.paragraph(
            "\n  <Image Id=\"x\" />The <b>yoke</b> (<s>H00100100100012 H00100100200004</s>; <a>GNT</a>) see <l>1.5.3 Cloth manufacture&lt;REALIA:1.5.3&gt;</l>, \
             <l target=\"FAUNA:1\">1 Animals</l> and <i>‘ol</i> &amp; <s>‘alah</s>.<sup>16</sup>  ",
        );
        // A code outside <s> is still a reference.
        assert_eq!(
            refs.paragraph("in H00100100100012, not 00100100100012x or 99900100100000"),
            vec![
                ("in ".into(), 0, -1),
                ("Genesis 1:1".into(), 0, gen(1, 1)),
                (", not 00100100100012x or 99900100100000".into(), 0, -1),
            ]
        );
        let want: Vec<Seg> = vec![
            ("The ".into(), 0, -1),
            ("yoke".into(), 1, -1),
            (" (".into(), 0, -1),
            ("Genesis 1:1".into(), 0, gen(1, 1)),
            ("; ".into(), 0, -1),
            ("Genesis 1:2".into(), 0, gen(1, 2)),
            ("; GNT) see Cloth manufacture, Animals and ".into(), 0, -1),
            ("‘ol".into(), 2, -1),
            (" & ‘alah.16".into(), 0, -1),
        ];
        assert_eq!(p, want);
    }

    #[test]
    fn cross_references_keep_only_their_names() {
        assert_eq!(without_key("1.5.3 Cloth manufacture"), "Cloth manufacture");
        assert_eq!(without_key(" 6.2.1.1  Fringe, tassel"), "Fringe, tassel");
        assert_eq!(without_key("1 Animals"), "Animals");
        assert_eq!(without_key("Animals"), "Animals");
        // Nothing but a number, or no space after it: left as it is.
        assert_eq!(without_key("1.5.3"), "1.5.3");
        assert_eq!(without_key("1.5.3 "), "1.5.3 ");
        assert_eq!(without_key("2nd Temple"), "2nd Temple");
        assert_eq!(without_key(".5 Name"), ".5 Name");
    }

    #[test]
    fn sentence_headings_open_their_section() {
        let vz = small_vz();
        let hebrew = HebrewMap::new();
        let refs = Refs {
            vz: &vz,
            hebrew: &hebrew,
        };
        let e = Entry {
            handbook: Handbook::Realia,
            key: "11.2.1".into(),
            title: "Shekel".into(),
            sets: Vec::new(),
            sections: vec![
                ("Description:", vec!["A weight.", "———"]),
                (
                    "<i>Sheqel</i> means “weight” (<s>H00100100100012</s>)",
                    vec!["More."],
                ),
                ("", vec![" "]),
            ],
        };
        let gen11 = vz.index(0, 1, 1).unwrap() as i64;
        let seg = |t: &str, s, v| (t.to_string(), s, v);
        assert_eq!(
            refs.sections(&e),
            vec![
                ("Description".to_string(), vec![seg("A weight.", 0, -1)]),
                (
                    String::new(),
                    vec![
                        seg("Sheqel", 2, -1),
                        seg(" means “weight” (", 0, -1),
                        seg("Genesis 1:1", 0, gen11),
                        seg(")", 0, -1),
                        seg("\n", 0, -1),
                        seg("More.", 0, -1),
                    ]
                ),
            ]
        );
    }

    #[test]
    fn leads_end_at_a_sentence() {
        assert_eq!(lead("Short. Text."), "Short. Text.");
        let long = format!("{}. {}", "a".repeat(150), "b ".repeat(80));
        assert_eq!(lead(&long), format!("{}.", "a".repeat(150)));
        let words = "word ".repeat(60);
        let cut = lead(&words);
        assert!(cut.ends_with('…') && cut.chars().count() <= LEAD_CHARS && !cut.contains(" …"));
    }

    #[test]
    fn xml_elements_and_attributes() {
        let x = "<Sections><Section Type=\"entry\"  Content=\"usage\"><Heading>Usage:</Heading></Section><Section /><Section>b</Section></Sections>";
        let secs = elements(x, "Section");
        assert_eq!(secs.len(), 2);
        assert_eq!(attr(secs[0].0, "Content").as_deref(), Some("usage"));
        assert_eq!(attr(secs[0].0, "Type").as_deref(), Some("entry"));
        assert_eq!(attr(secs[1].0, "Content"), None);
        assert_eq!(key_order("1.1.2", "1.1.10"), Ordering::Less);
        assert_eq!(key_order("2", "1.9"), Ordering::Greater);
        assert_eq!(key_order("1.1", "1.1.1"), Ordering::Less);
    }

    #[test]
    fn the_display_rule() {
        let links: Vec<UbsLink> = vec![
            (0, true, vec![1, 2, 3]),
            (1, false, vec![9]),
            (2, true, vec![5]),
            (3, false, vec![2]),
        ];
        let rank = |_| 0;
        let ids = |v| {
            shown(&links, v, rank)
                .iter()
                .map(|l| l.0)
                .collect::<Vec<_>>()
        };
        assert_eq!(ids(Some(2)), vec![3, 0]); // cited here: fewer verses first
        assert_eq!(ids(Some(7)), vec![2, 0]); // nothing cited here: the general ones
        assert_eq!(ids(None), vec![2, 0]);
        assert_eq!(ids(Some(9)), vec![1]);
    }
}
