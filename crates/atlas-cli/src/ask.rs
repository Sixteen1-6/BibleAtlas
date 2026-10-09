//! Ask the Bible: questions answered from verses alone.
//!
//! Two kinds of question, both built from Scripture and nothing else:
//!
//! - The questions in `config/questions.json`. Each names its key verses and
//!   2 to 4 short sentences that say only what those verses say, each with the
//!   verses it comes from, and the Nave's subjects whose verses form its wider
//!   cluster. The build stops at the first problem: a reference that does not
//!   resolve, a quotation of four or more words that is not in the BSB text of
//!   its sentence's verses, a sentence citing a verse outside the key verses,
//!   words that bring in another framework ("scholars", "Christians believe", a
//!   church name), a Nave's subject or label that does not exist, or text too
//!   long to read at a glance. An answer nobody reviewed is a draft: its
//!   question and verses are published, its key verses and sentences only when
//!   `ATLAS_ASK_DRAFTS=1` is set. Until then the verses shown first are the
//!   cluster's most cited, ranked by data alone.
//! - Every subject of Nave's Topical Bible, as a list of verses. Nave's (1896)
//!   is used as an index only: which verses go with which subject. None of its
//!   wording is published, so no interpretation comes with the verses.
//!
//! Files, under web/public/data:
//! - `ask/index.json`: the questions, the groups, and every Nave's subject's
//!   name and verse count. Loaded when search opens.
//! - `ask/q/<id>.json`: one question's cluster, as verse ranges.
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

/// Words that bring in a framework besides the verses themselves. An answer
/// says only what its verses say, so none of these may appear in one.
/// Matched at the start of a word, so "scholar" also stops "scholarly".
const OUTSIDE: [&str; 29] = [
    "scholar",
    "theolog",
    "commentat",
    "calvin",
    "arminian",
    "luther",
    "catholic",
    "protestant",
    "orthodox",
    "denomination",
    "trinity",
    "church father",
    "christians believe",
    "many christians",
    "some christians",
    "most christians",
    "interpret",
    "tradition",
    "doctrine",
    "gotquestions",
    "esv",
    "we believe",
    "experts",
    "historians",
    "science",
    "rapture",
    "purgatory",
    "sacrament",
    "nave",
];

const KEY_MIN: usize = 3;
const KEY_MAX: usize = 5;
/// Longest key reference, in verses: a key verse is read in full at Simple.
const KEY_SPAN_MAX: u32 = 6;
const SENTENCES: (usize, usize) = (2, 4);
const SENTENCE_MAX: usize = 220;
const ANSWER_MAX: usize = 600;
const QUESTION_MAX: usize = 90;
/// Quoted spans shorter than this are glosses, not quotations.
const QUOTE_MIN_WORDS: usize = 4;
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
    key: Vec<String>,
    answer: Vec<SentenceSpec>,
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

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SentenceSpec {
    text: String,
    refs: Vec<String>,
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

/// Lowercase letters and digits, single spaces between words; dashes split
/// words and quotation marks and apostrophes of every style are dropped.
fn normalize(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut space = true;
    for c in s.chars() {
        if c.is_alphanumeric() {
            out.extend(c.to_lowercase());
            space = false;
        } else if matches!(c, '\'' | '’' | '‘' | 'ʼ') {
            // "God's" -> "gods", as people and the BSB both write it.
        } else if !space {
            out.push(' ');
            space = true;
        }
    }
    out.trim_end().to_string()
}

/// The quoted spans of a sentence, in curly or straight double quotes.
fn quotes(text: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut open: Option<usize> = None;
    for (i, c) in text.char_indices() {
        match (c, open) {
            ('“', _) => open = Some(i + c.len_utf8()),
            ('"', None) => open = Some(i + 1),
            ('”' | '"', Some(s)) => {
                out.push(&text[s..i]);
                open = None;
            }
            _ => {}
        }
    }
    out
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

    fn bsb(&self, (s, e): (u32, u32)) -> String {
        normalize(&self.text[s as usize..=e as usize].join(" "))
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
                format_args!("{field} uses {w:?}; an answer says only what its verses say"),
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
    if !(2..=10).contains(&q.also.len())
        || q.also
            .iter()
            .any(|a| a.trim().is_empty() || a.chars().count() > 60)
    {
        c.fail(
            &at,
            "also needs 2 to 10 other ways to ask, each at most 60 characters",
        );
    }
    for a in &q.also {
        if let Some(w) = outside_word(a) {
            c.fail(&at, format_args!("also uses {w:?}"));
        }
    }
    if q.reviewed_by.iter().any(|n| n.trim().is_empty()) {
        c.fail(&at, "reviewed_by has an empty name");
    }

    // Key verses.
    if !(KEY_MIN..=KEY_MAX).contains(&q.key.len()) {
        c.fail(
            &at,
            format_args!("key needs {KEY_MIN} to {KEY_MAX} references"),
        );
    }
    let key: Vec<Option<(u32, u32)>> = q.key.iter().map(|r| c.range(&at, r)).collect();
    for (r, k) in q.key.iter().zip(&key) {
        if let Some((s, e)) = *k {
            if e - s + 1 > KEY_SPAN_MAX {
                c.fail(
                    &at,
                    format_args!(
                        "key {r:?} is {} verses; keep each to {KEY_SPAN_MAX}",
                        e - s + 1
                    ),
                );
            }
        }
    }
    let key: Vec<(u32, u32)> = key.into_iter().flatten().collect();

    // The answer.
    if !(SENTENCES.0..=SENTENCES.1).contains(&q.answer.len()) {
        c.fail(
            &at,
            format_args!("answer needs {} to {} sentences", SENTENCES.0, SENTENCES.1),
        );
    }
    let total: usize = q.answer.iter().map(|s| s.text.chars().count()).sum();
    if total > ANSWER_MAX {
        c.fail(
            &at,
            format_args!("answer is {total} characters; keep it to {ANSWER_MAX}"),
        );
    }
    let mut answer = Vec::new();
    for (i, s) in q.answer.iter().enumerate() {
        let at = format!("{at}, answer[{i}]");
        c.plain(&at, "text", &s.text, SENTENCE_MAX);
        if !(1..=3).contains(&s.refs.len()) {
            c.fail(&at, "needs 1 to 3 refs");
        }
        let mut rs = Vec::new();
        for r in &s.refs {
            let Some(range) = c.range(&at, r) else {
                continue;
            };
            if !key.iter().any(|&(ks, ke)| ks <= range.0 && range.1 <= ke) {
                c.fail(
                    &at,
                    format_args!("ref {r:?} is not inside one of the key references"),
                );
            }
            rs.push(range);
        }
        if rs.len() == s.refs.len() {
            let texts: Vec<String> = rs.iter().map(|&r| c.bsb(r)).collect();
            for quote in quotes(&s.text)
                .into_iter()
                .map(normalize)
                .filter(|q| q.split(' ').count() >= QUOTE_MIN_WORDS)
            {
                if !texts.iter().any(|t| t.contains(&quote)) {
                    c.fail(
                        &at,
                        format_args!(
                            "quotation {quote:?} is not in the BSB text of {}",
                            s.refs.join(", ")
                        ),
                    );
                }
            }
        }
        answer.push(json!({ "t": s.text, "r": ranges_json(&rs) }));
    }

    // The cluster: the key verses and the Nave's lines the topics keep.
    if !(1..=5).contains(&q.topics.len()) {
        c.fail(&at, "topics needs 1 to 5 Nave's subjects");
    }
    let mut lines: Vec<&Line> = Vec::new();
    for (i, t) in q.topics.iter().enumerate() {
        let kept = c.topic_lines(&format!("{at}, topics[{i}]"), t);
        if kept.iter().all(|l| l.refs.is_empty()) && !kept.is_empty() {
            c.fail(
                &format!("{at}, topics[{i}]"),
                format_args!("the lines kept under {} cite no verses", t.subject),
            );
        }
        lines.extend(kept);
    }
    let cluster = merge(
        key.iter()
            .copied()
            .chain(lines.iter().flat_map(|l| l.refs.iter().copied()))
            .collect(),
    );

    let draft = q.reviewed_by.is_empty();
    let group = group?;
    let mut index = json!({
        "id": q.id, "g": group, "q": q.question.trim(), "also": q.also, "n": count(&cluster),
    });
    if !draft || include_drafts {
        index["top"] = ranges_json(&key);
        index["answer"] = Value::Array(answer);
        if draft {
            index["draft"] = json!(true);
        }
    } else {
        index["top"] = ranges_json(&most_cited(lines.iter().copied(), degree));
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
        (d, true) => format!("{d} draft answers included ({DRAFTS_ENV}=1)"),
        (d, false) => format!("{d} draft answers left out (set {DRAFTS_ENV}=1 to include them)"),
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
        for s in q["answer"].as_array().into_iter().flatten() {
            q_ok &= in_text(&s["r"]);
        }
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
        assert_eq!(outside_word("Most scholars agree."), Some("scholar"));
        assert_eq!(
            outside_word("Many Christians believe this."),
            Some("christians believe")
        );
        assert_eq!(outside_word("Jesus says no one can snatch them."), None);
        assert_eq!(outside_word("The Lord is our shepherd."), None);
    }

    #[test]
    fn quoted_spans() {
        assert_eq!(
            quotes("Paul writes, “Be angry, yet do not sin,” and more."),
            vec!["Be angry, yet do not sin,"]
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
