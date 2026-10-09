//! Ask the Bible: questions answered in the Bible's own words.
//!
//! The owner's rule for this box: the framework for interpreting the Bible is
//! the Bible, with no other logic and no scholars' frameworks. So nothing here
//! writes an answer. There are two kinds of question:
//!
//! - The questions in `config/questions.json`. Each answer is a chain of
//!   Scripture: whole verses, or parts of verses in the exact BSB wording, set
//!   one after another, with no words of ours between them. The build stops at
//!   the first problem: a reference that does not resolve, a part that is not
//!   word for word in its verse, a chain too short or too long, words that bring
//!   in another framework in a question or its other phrasings, or a Nave's
//!   subject or label that does not exist. A chain nobody reviewed is a draft:
//!   its question and verses are published, the chain itself only when
//!   `ATLAS_ASK_DRAFTS=1` is set.
//! - Every subject of Nave's Topical Bible, as a list of verses. Nave's (1896)
//!   is used as an index only: which verses go with which subject. None of its
//!   wording is published. The app also gathers verses for any other question
//!   as it is asked, from these lists, the BSB text and the cross-references.
//!
//! Files, under web/public/data:
//! - `ask/index.json`: the questions, the groups, and every Nave's subject's
//!   name and verse count. Loaded when search opens.
//! - `ask/q/<id>.json`: one question's wider set of verses, as ranges.
//! - `ask/topics/<n>.json`: subjects `n * 250` onward, each its most-cited
//!   verses and all its verses as ranges.

use crate::loaded::Loaded;
use crate::sources::Inputs;
use atlas_core::{refs, Versification};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fmt::Display;
use std::fs;
use std::path::Path;

pub const CONFIG: &str = "config/questions.json";
pub const DRAFTS_ENV: &str = "ATLAS_ASK_DRAFTS";
const SOURCE: &str = "naves";

/// The groups questions are listed under, in this order.
pub const GROUPS: [&str; 8] = [
    "God",
    "Jesus",
    "Saved",
    "Living",
    "Hard times",
    "Family",
    "Death and the future",
    "Church and Bible",
];

/// Words that bring in a framework besides the verses themselves; none may
/// appear in a question or its other phrasings. Matched at the start of a
/// word, so "scholar" also stops "scholarly".
const OUTSIDE: [&str; 9] = [
    "scholar",
    "theolog",
    "commentat",
    "denomination",
    "christians believe",
    "gotquestions",
    "esv",
    "nave",
    "interpret",
];

const CHAIN: (usize, usize) = (3, 8);
/// Longest part, in verses, and shortest part of a verse, in words.
const PART_VERSES_MAX: u32 = 3;
const PART_WORDS_MIN: usize = 3;
/// Most characters a chain shows, so it reads at a glance.
const CHAIN_MAX: usize = 1200;
const QUESTION_MAX: usize = 90;
/// Verses shown first for a topic or an unreviewed question.
const TOP: usize = 5;
/// A Nave's reference longer than this is a passage; its verses still join
/// the cluster but do not count towards which verses are shown first.
const CITE_SPAN_MAX: u32 = 3;
/// Subjects per `ask/topics/<n>.json` file.
pub const TOPIC_SHARD: usize = 250;

#[derive(Deserialize)]
struct QuestionFile {
    questions: Vec<QuestionSpec>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct QuestionSpec {
    id: String,
    group: String,
    question: String,
    also: Vec<String>,
    topics: Vec<TopicSpec>,
    chain: Vec<PartSpec>,
    reviewed_by: Vec<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct TopicSpec {
    subject: String,
    #[serde(default)]
    only: Vec<String>,
    #[serde(default)]
    skip: Vec<String>,
}

/// One part of a chain: whole verses, or `words`, a span of their BSB text.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PartSpec {
    #[serde(rename = "ref")]
    reference: String,
    #[serde(default)]
    words: Option<String>,
}

// ------------------------------------------------------------ Nave's

/// One line of a Nave's entry: its label and the verse ranges it cites.
struct Line {
    label: String,
    /// The top-level line an indented line belongs to.
    parent: Option<usize>,
    refs: Vec<(u32, u32)>,
}

struct Subject {
    /// As Nave's writes it: "ANGER", "SPEAKING, EVIL".
    key: String,
    lines: Vec<Line>,
}

/// Rows of a CSV file with quoted fields (which may hold commas, doubled
/// quotes and line breaks).
fn csv_rows(text: &str) -> Vec<Vec<String>> {
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

fn read_naves(inputs: &Inputs, vz: &Versification) -> Result<(Vec<Subject>, usize), String> {
    let path = inputs.path(SOURCE, "topics");
    let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let mut rows = csv_rows(&text).into_iter();
    let header = rows.next().unwrap_or_default();
    if header != ["section", "subject", "entry"] {
        return Err(format!(
            "{}: expected the columns section, subject, entry; found {header:?}",
            path.display()
        ));
    }
    let mut bad = 0usize;
    let mut subjects: Vec<Subject> = Vec::new();
    for row in rows.filter(|r| r.len() == 3) {
        let key = row[1].trim().to_string();
        if key.is_empty() {
            continue;
        }
        let mut lines: Vec<Line> = Vec::new();
        let mut parent = None;
        for raw in row[2].lines().filter(|l| !l.trim().is_empty()) {
            let (depth, label, refs_text) = split_line(raw);
            let refs = nave_refs(refs_text, vz, &mut bad);
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
    Ok((subjects, bad))
}

/// "SPEAKING, EVIL" -> "Speaking, Evil"; "JESUS, THE CHRIST" -> "Jesus, the Christ".
fn title(key: &str) -> String {
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
fn merge(mut rs: Vec<(u32, u32)>) -> Vec<(u32, u32)> {
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

fn count(rs: &[(u32, u32)]) -> u32 {
    rs.iter().map(|(s, e)| e - s + 1).sum()
}

fn ranges_json(rs: &[(u32, u32)]) -> Value {
    Value::Array(rs.iter().map(|&(s, e)| json!([s, e])).collect())
}

/// The verses shown first: those cited by the most lines (a passage of more
/// than a few verses does not count), then those with the most cross-references.
fn most_cited<'l>(lines: impl Iterator<Item = &'l Line>, degree: &[u32]) -> Vec<(u32, u32)> {
    let mut cites: HashMap<u32, u32> = HashMap::new();
    for l in lines {
        let mut seen = BTreeSet::new();
        for &(s, e) in l.refs.iter().filter(|(s, e)| e - s < CITE_SPAN_MAX) {
            seen.extend(s..=e);
        }
        for v in seen {
            *cites.entry(v).or_default() += 1;
        }
    }
    let mut vs: Vec<(u32, u32)> = cites.into_iter().collect();
    vs.sort_unstable_by(|a, b| {
        b.1.cmp(&a.1)
            .then(degree[b.0 as usize].cmp(&degree[a.0 as usize]))
            .then(a.0.cmp(&b.0))
    });
    vs.into_iter().take(TOP).map(|(v, _)| (v, v)).collect()
}

// ------------------------------------------------------------ checks

/// Lowercase letters and digits with single spaces between words, and for
/// each character of the result the byte offset in `s` it came from. Dashes
/// and other punctuation split words; apostrophes of every style are dropped
/// ("God's" -> "gods").
fn normalize_at(s: &str) -> (String, Vec<usize>) {
    let mut out = String::with_capacity(s.len());
    let mut at = Vec::with_capacity(s.len());
    let mut space = true;
    for (i, c) in s.char_indices() {
        if c.is_alphanumeric() {
            for l in c.to_lowercase() {
                out.push(l);
                at.extend(std::iter::repeat_n(i, l.len_utf8()));
            }
            space = false;
        } else if matches!(c, '\'' | '’' | '‘' | 'ʼ') {
        } else if !space {
            out.push(' ');
            at.push(i);
            space = true;
        }
    }
    if out.ends_with(' ') {
        out.pop();
        at.pop();
    }
    (out, at)
}

fn normalize(s: &str) -> String {
    normalize_at(s).0
}

/// Where `words` sit in `text`, matched word for word: the exact span of
/// `text` (its own punctuation and quotation marks kept), and whether it
/// starts after the first word and ends before the last.
fn find_words<'t>(text: &'t str, words: &str) -> Option<(&'t str, bool, bool)> {
    let (hay, at) = normalize_at(text);
    let needle = normalize(words);
    if needle.is_empty() {
        return None;
    }
    let mut from = 0;
    let start = loop {
        let i = from + hay[from..].find(&needle)?;
        let before = i == 0 || hay.as_bytes()[i - 1] == b' ';
        let end = i + needle.len();
        let after = end == hay.len() || hay.as_bytes()[end] == b' ';
        if before && after {
            break i;
        }
        from = i + 1;
    };
    let end = start + needle.len();
    let first = at[start];
    let last = at[end - 1];
    let last_end = last + text[last..].chars().next().map_or(1, char::len_utf8);
    // Keep closing punctuation and quotation marks that belong to the last word.
    let tail = text[last_end..]
        .chars()
        .take_while(|c| matches!(c, '.' | ',' | ';' | ':' | '!' | '?' | '”' | '’' | '"'))
        .map(char::len_utf8)
        .sum::<usize>();
    // And an opening quotation mark right before the first word.
    let head = text[..first]
        .chars()
        .rev()
        .take_while(|c| matches!(c, '“' | '‘' | '"'))
        .map(char::len_utf8)
        .sum::<usize>();
    Some((
        &text[first - head..last_end + tail],
        start > 0,
        end < hay.len(),
    ))
}

/// The first framework word a text uses, if any.
fn outside_word(text: &str) -> Option<&'static str> {
    let t = format!(" {} ", normalize(text));
    OUTSIDE
        .iter()
        .copied()
        .find(|w| t.contains(&format!(" {w}")))
}

struct Check<'a> {
    vz: &'a Versification,
    text: &'a [String],
    subjects: &'a HashMap<&'a str, &'a Subject>,
    errors: Vec<String>,
}

impl<'a> Check<'a> {
    fn fail(&mut self, at: &str, problem: impl Display) {
        self.errors.push(format!("{CONFIG}: {at}: {problem}"));
    }

    fn range(&mut self, at: &str, r: &str) -> Option<(u32, u32)> {
        let Some(q) = refs::parse(r) else {
            self.fail(at, format_args!("reference {r:?} does not parse"));
            return None;
        };
        let found = refs::resolve(q, self.vz);
        if found.is_none() {
            self.fail(
                at,
                format_args!("reference {r:?} names verses the BSB does not have"),
            );
        }
        found
    }

    fn plain(&mut self, at: &str, field: &str, s: &str, max: usize) {
        if s.trim().is_empty() {
            self.fail(at, format_args!("{field} is empty"));
        }
        let n = s.chars().count();
        if n > max {
            self.fail(
                at,
                format_args!("{field} is {n} characters; keep it to {max}"),
            );
        }
        if let Some(w) = outside_word(s) {
            self.fail(
                at,
                format_args!("{field} uses {w:?}; this box speaks only in the Bible's words"),
            );
        }
    }

    /// The lines of a subject that a topic keeps.
    fn topic_lines(&mut self, at: &str, t: &TopicSpec) -> Vec<&'a Line> {
        let subjects: &'a HashMap<&'a str, &'a Subject> = self.subjects;
        let Some(&subject) = subjects.get(t.subject.trim().to_uppercase().as_str()) else {
            self.fail(at, format_args!("Nave's has no subject {:?}", t.subject));
            return Vec::new();
        };
        let hit = |l: &Line, want: &str| {
            let w = normalize(want);
            let own = normalize(&l.label).starts_with(&w);
            let parent = l
                .parent
                .is_some_and(|p| normalize(&subject.lines[p].label).starts_with(&w));
            own || parent
        };
        for w in t.only.iter().chain(&t.skip) {
            if w.trim().is_empty()
                || !subject
                    .lines
                    .iter()
                    .any(|l| normalize(&l.label).starts_with(&normalize(w)))
            {
                self.fail(
                    at,
                    format_args!("no label under {} starts with {w:?}", subject.key),
                );
            }
        }
        subject
            .lines
            .iter()
            .filter(|l| t.only.is_empty() || t.only.iter().any(|w| hit(l, w)))
            .filter(|l| !t.skip.iter().any(|w| hit(l, w)))
            .collect()
    }
}

/// What one question publishes.
struct Built {
    index: Value,
    cluster: Vec<(u32, u32)>,
}

fn question(
    c: &mut Check,
    q: &QuestionSpec,
    degree: &[u32],
    include_drafts: bool,
) -> Option<Built> {
    let at = format!("question {:?}", q.id);
    let id_ok = !q.id.is_empty()
        && q.id.len() <= 48
        && q.id.split('-').all(|w| {
            !w.is_empty()
                && w.chars()
                    .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit())
        });
    if !id_ok {
        c.fail(
            &at,
            "id must be lowercase words and digits joined by hyphens, at most 48 characters",
        );
    }
    let group = GROUPS.iter().position(|g| *g == q.group);
    if group.is_none() {
        c.fail(
            &at,
            format_args!("group {:?} is not one of: {}", q.group, GROUPS.join(", ")),
        );
    }
    c.plain(&at, "question", &q.question, QUESTION_MAX);
    if !q.question.trim_end().ends_with('?') {
        c.fail(&at, "question must end with a question mark");
    }
    if !(2..=10).contains(&q.also.len()) {
        c.fail(&at, "also needs 2 to 10 other ways to ask");
    }
    for a in &q.also {
        c.plain(&at, "also", a, 60);
    }
    if q.reviewed_by.iter().any(|n| n.trim().is_empty()) {
        c.fail(&at, "reviewed_by has an empty name");
    }

    // The chain: whole verses, or their exact words.
    if !(CHAIN.0..=CHAIN.1).contains(&q.chain.len()) {
        c.fail(
            &at,
            format_args!("chain needs {} to {} parts", CHAIN.0, CHAIN.1),
        );
    }
    let mut chain = Vec::new();
    let mut parts = Vec::new();
    let mut shown = 0usize;
    for (i, p) in q.chain.iter().enumerate() {
        let at = format!("{at}, chain[{i}]");
        let Some((s, e)) = c.range(&at, &p.reference) else {
            continue;
        };
        parts.push((s, e));
        if e - s + 1 > PART_VERSES_MAX {
            c.fail(
                &at,
                format_args!(
                    "{:?} is {} verses; keep a part to {PART_VERSES_MAX}",
                    p.reference,
                    e - s + 1
                ),
            );
        }
        let full = c.text[s as usize..=e as usize].join(" ");
        let Some(words) = &p.words else {
            shown += full.chars().count();
            chain.push(json!({ "r": [s, e] }));
            continue;
        };
        if normalize(words).split(' ').count() < PART_WORDS_MIN {
            c.fail(&at, format_args!("words must be at least {PART_WORDS_MIN} words; leave them out to show the whole verse"));
        }
        match find_words(&full, words) {
            None => c.fail(
                &at,
                format_args!(
                    "words {words:?} are not word for word in the BSB text of {}",
                    p.reference
                ),
            ),
            Some((span, cut_start, cut_end)) => {
                shown += span.chars().count();
                let mut part = json!({ "r": [s, e], "w": span });
                if cut_start {
                    part["a"] = json!(true);
                }
                if cut_end {
                    part["z"] = json!(true);
                }
                chain.push(part);
            }
        }
    }
    if shown > CHAIN_MAX {
        c.fail(
            &at,
            format_args!("the chain shows {shown} characters; keep it to {CHAIN_MAX}"),
        );
    }

    // The wider set: the chain's verses and the Nave's lines the topics keep.
    if !(1..=5).contains(&q.topics.len()) {
        c.fail(&at, "topics needs 1 to 5 Nave's subjects");
    }
    let mut lines: Vec<&Line> = Vec::new();
    for (i, t) in q.topics.iter().enumerate() {
        let kept = c.topic_lines(&format!("{at}, topics[{i}]"), t);
        if !kept.is_empty() && kept.iter().all(|l| l.refs.is_empty()) {
            c.fail(
                &format!("{at}, topics[{i}]"),
                format_args!("the lines kept under {} cite no verses", t.subject),
            );
        }
        lines.extend(kept);
    }
    let cluster = merge(
        parts
            .iter()
            .copied()
            .chain(lines.iter().flat_map(|l| l.refs.iter().copied()))
            .collect(),
    );

    let draft = q.reviewed_by.is_empty();
    let group = group?;
    let mut index = json!({
        "id": q.id, "g": group, "q": q.question.trim(), "also": q.also, "n": count(&cluster),
        "top": ranges_json(&most_cited(lines.iter().copied(), degree)),
    });
    if !draft || include_drafts {
        index["chain"] = Value::Array(chain);
        if draft {
            index["draft"] = json!(true);
        }
    }
    Some(Built { index, cluster })
}

/// The files to write under web/public/data, as (path, bytes).
pub fn build(
    root: &Path,
    inputs: &Inputs,
    vz: &Versification,
    text: &[String],
    degree: &[u32],
) -> Result<Vec<(String, Vec<u8>)>, String> {
    let (subjects, bad) = read_naves(inputs, vz)?;
    let by_key: HashMap<&str, &Subject> = subjects.iter().map(|s| (s.key.as_str(), s)).collect();
    let file: QuestionFile = serde_json::from_str(
        &fs::read_to_string(root.join(CONFIG)).map_err(|e| format!("reading {CONFIG}: {e}"))?,
    )
    .map_err(|e| format!("parsing {CONFIG}: {e}"))?;
    let include_drafts = std::env::var(DRAFTS_ENV).is_ok_and(|v| v == "1");

    let mut out: Vec<(String, Vec<u8>)> = Vec::new();
    let mut check = Check {
        vz,
        text,
        subjects: &by_key,
        errors: Vec::new(),
    };
    let mut ids = BTreeSet::new();
    let mut questions = Vec::new();
    let mut drafts = 0usize;
    for q in &file.questions {
        if !ids.insert(q.id.as_str()) {
            check.fail(
                &format!("question {:?}", q.id),
                "id is used by an earlier question",
            );
        }
        drafts += q.reviewed_by.is_empty() as usize;
        if let Some(b) = question(&mut check, q, degree, include_drafts) {
            out.push((
                format!("ask/q/{}.json", q.id),
                serde_json::to_vec(&json!({ "v": ranges_json(&b.cluster) }))
                    .map_err(|e| e.to_string())?,
            ));
            questions.push(b.index);
        }
    }
    if let Some(e) = check.errors.into_iter().next() {
        return Err(e);
    }

    // Every subject: its title and verse count in the index, its verses in a shard.
    let mut topics = Vec::new();
    let mut slugs: BTreeMap<String, usize> = BTreeMap::new();
    let mut shards: Vec<Vec<Value>> = Vec::new();
    for s in subjects
        .iter()
        .filter(|s| s.lines.iter().any(|l| !l.refs.is_empty()))
    {
        let name = title(&s.key);
        let id = slug(&name);
        if id.is_empty() {
            continue;
        }
        if let Some(prev) = slugs.insert(id.clone(), topics.len()) {
            return Err(format!(
                "Nave's subjects {} and {} would share the link {id:?}",
                subjects[prev].key, s.key
            ));
        }
        let all = merge(
            s.lines
                .iter()
                .flat_map(|l| l.refs.iter().copied())
                .collect(),
        );
        if topics.len() % TOPIC_SHARD == 0 {
            shards.push(Vec::new());
        }
        shards.last_mut().unwrap().push(json!({ "top": ranges_json(&most_cited(s.lines.iter(), degree)), "v": ranges_json(&all) }));
        topics.push(json!([name, count(&all)]));
    }
    for (n, shard) in shards.iter().enumerate() {
        out.push((
            format!("ask/topics/{n}.json"),
            serde_json::to_vec(shard).map_err(|e| e.to_string())?,
        ));
    }
    let index = json!({ "format": 1, "groups": GROUPS, "questions": questions, "topics": topics, "shard": TOPIC_SHARD });
    out.push((
        "ask/index.json".to_string(),
        serde_json::to_vec(&index).map_err(|e| e.to_string())?,
    ));

    let drafts_note = match (drafts, include_drafts) {
        (0, _) => String::from("no drafts"),
        (d, true) => format!("{d} draft chains included ({DRAFTS_ENV}=1)"),
        (d, false) => format!("{d} draft chains left out (set {DRAFTS_ENV}=1 to include them)"),
    };
    eprintln!(
        "ask the bible: {} questions checked, {drafts_note}; {} Nave's subjects, {bad} references not in the BSB left out",
        file.questions.len(),
        topics.len()
    );
    Ok(out)
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
    let index = read("ask/index.json")?;
    let topics = index["topics"]
        .as_array()
        .ok_or("ask/index.json has no topics")?;
    let questions = index["questions"]
        .as_array()
        .ok_or("ask/index.json has no questions")?;
    let n = d.vz.verse_count();
    let in_text = |v: &Value| {
        v.as_array().into_iter().flatten().all(|r| {
            r[0].as_u64()
                .zip(r[1].as_u64())
                .is_some_and(|(s, e)| s <= e && e < n as u64)
        })
    };

    // Anger, the first subject under A with that name, includes Ephesians 4:26.
    let anger = topics
        .iter()
        .position(|t| t[0] == "Anger")
        .ok_or("no Nave's subject Anger")?;
    let shard = read(&format!("ask/topics/{}.json", anger / TOPIC_SHARD))?;
    let (eph, _) = d.resolve("Eph 4:26")?;
    let has_eph = shard[anger % TOPIC_SHARD]["v"]
        .as_array()
        .into_iter()
        .flatten()
        .any(|r| {
            r[0].as_u64()
                .zip(r[1].as_u64())
                .is_some_and(|(s, e)| s <= eph as u64 && eph as u64 <= e)
        });

    let mut q_ok = true;
    for q in questions {
        let id = q["id"].as_str().unwrap_or_default();
        let cluster = read(&format!("ask/q/{id}.json"))?;
        q_ok &= in_text(&q["top"])
            && in_text(&cluster["v"])
            && cluster["v"].as_array().is_some_and(|v| !v.is_empty())
            && q["top"].as_array().is_some_and(|t| !t.is_empty());
        q_ok &= in_text(&Value::Array(
            q["chain"]
                .as_array()
                .into_iter()
                .flatten()
                .map(|p| p["r"].clone())
                .collect(),
        ));
    }
    Ok(vec![
        (
            topics.len() > 4_000,
            format!("{} Nave's subjects", topics.len()),
        ),
        (has_eph, "Nave's Anger includes Ephesians 4:26".to_string()),
        (
            q_ok,
            format!(
                "all {} questions have verses, every one in the BSB",
                questions.len()
            ),
        ),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn framework_words() {
        assert_eq!(
            outside_word("What do scholars say about hell?"),
            Some("scholar")
        );
        assert_eq!(
            outside_word("What do Christians believe about heaven?"),
            Some("christians believe")
        );
        assert_eq!(outside_word("What happens when we die?"), None);
    }

    #[test]
    fn exact_words() {
        let v = "My beloved brothers, understand this: Everyone should be quick to listen, slow to speak, and slow to anger,";
        assert_eq!(
            find_words(v, "everyone should be quick to listen"),
            Some(("Everyone should be quick to listen,", true, true))
        );
        assert_eq!(
            find_words(v, "slow to anger"),
            Some(("slow to anger,", true, false))
        );
        assert_eq!(
            find_words(v, "My beloved brothers"),
            Some(("My beloved brothers,", false, true))
        );
        // Word for word only: no partial words, no words out of order.
        assert_eq!(find_words(v, "low to anger"), None);
        assert_eq!(find_words(v, "slow to listen"), None);
        let q = "“Be angry, yet do not sin.” Do not let the sun set upon your anger,";
        assert_eq!(
            find_words(q, "be angry yet do not sin"),
            Some(("“Be angry, yet do not sin.”", false, true))
        );
        assert_eq!(normalize("God’s love—“for all”"), "gods love for all");
    }

    #[test]
    fn merged_ranges() {
        assert_eq!(
            merge(vec![(5, 7), (1, 2), (3, 4), (10, 10), (6, 9)]),
            vec![(1, 10)]
        );
        assert_eq!(count(&[(1, 3), (8, 8)]), 4);
    }
}
