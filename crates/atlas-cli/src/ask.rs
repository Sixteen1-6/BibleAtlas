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
//!   in another framework in a question or its other phrasings, a Nave's
//!   subject or label that does not exist, or a part that nothing in the
//!   Bible's own data ties to the question or to another part (see [`ties`]).
//!   That last check is what makes a chain the Bible quoting the Bible: each
//!   verse is there because it holds the question's words, sits under one of
//!   its Nave's subjects, or is linked to another verse of the chain by a
//!   cross-reference, a quotation, or a shared Hebrew or Greek root. The ties
//!   are published with the chain, so the app can show why each verse is there.
//! - Every subject of Nave's Topical Bible, as a list of verses. Nave's (1896)
//!   is used as an index only: which verses go with which subject. Its subject
//!   headings are published, never the wording of its lines. The reader is in
//!   `naves.rs`, shared with the Themes tab's Nave's rows. The app also gathers
//!   verses for any other question as it is asked, from these lists, the BSB
//!   text and the cross-references.
//!
//! Files, under web/public/data:
//! - `ask/index.json`: the questions, the groups, and every Nave's subject's
//!   name and verse count. Loaded when search opens.
//! - `ask/q/<id>.json`: one question's wider set of verses, as ranges.
//! - `ask/topics/<n>.json`: subjects `n * 250` onward, each its most-cited
//!   verses and all its verses as ranges.

use crate::loaded::Loaded;
use crate::naves::{count, merge, title, Line, Naves, Subject, CITE_SPAN_MAX};
use crate::parse::WordsByVerse;
use atlas_core::{refs, Versification, XrefGraph};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fmt::Display;
use std::fs;
use std::path::Path;

pub const CONFIG: &str = "config/questions.json";

/// What the build reads from the rest of the data.
pub struct Sources<'a> {
    /// BSB English, one string per verse index.
    pub text: &'a [String],
    pub vz: &'a Versification,
    /// Cross-references per verse, for which verses a topic shows first.
    pub degree: &'a [u32],
    pub graph: &'a XrefGraph,
    pub words: &'a WordsByVerse,
    pub lemma_index: &'a HashMap<&'a str, u32>,
    /// How often each root occurs in the whole Bible.
    pub lemma_count: &'a [u32],
    /// Where the New Testament quotes or echoes the Old, from the BSB's
    /// footnotes (`extras/quotes.json`): (nt from, nt to, ot from, ot to).
    pub quotes: &'a [(u32, u32, u32, u32)],
}

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
/// Subjects per `ask/topics/<n>.json` file.
pub const TOPIC_SHARD: usize = 250;
/// A root shared by two parts ties them only if it is a noun, verb or
/// adjective, rarer than this in the whole Bible, and not one of the light
/// verbs below: sharing "and", "LORD", "with" or "to have" says nothing.
const ROOT_MAX: u32 = 1000;
/// Verbs too common in every kind of sentence to tie two verses (to be, have,
/// do or make, come, go, go out, give, take, say, put), by Strong's number.
const LIGHT_ROOTS: [&str; 18] = [
    "G1096", "G2192", "G4160", "G2064", "G4198", "G1831", "G1325", "G2983", "G2036",
    "H1961", "H6213", "H0935", "H1980", "H3318", "H5414", "H3947", "H0559", "H7760",
];
/// Parts at most this many verses apart in one chapter are one passage: the
/// Bible's own sequence ties them.
const PASSAGE_GAP: u32 = 3;
/// Words of asking, not of what is asked: never a tie by themselves.
const QUESTION_STOP: &[&str] = &[
    "what", "who", "whom", "whose", "why", "how", "when", "where", "which", "does", "did", "doing",
    "will", "would", "should", "could", "can", "may", "might", "must", "shall", "are", "was", "were",
    "the", "and", "for", "with", "about", "from", "into", "that", "this", "there", "they", "them",
    "their", "you", "your", "our", "his", "her", "its", "have", "has", "had", "not", "any", "all",
    "say", "says", "said", "bible", "verse", "verses", "mean", "means", "really", "god", "gods", "lord", "lords",
    "get", "one", "way", "like", "deal", "handle", "cope", "overcome", "stop", "find", "help",
    "make", "feel", "use", "wrong", "right", "allowed", "possible", "best", "ever", "still",
    "even", "too", "also", "much", "many", "happen", "happens", "thing", "things", "someone",
    "something", "people", "person", "tell", "teach", "teaches", "okay", "just", "some",
];

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

// ------------------------------------------------------------ verse sets

/// The verses of `a` that are not in `b` (both sorted and merged).
fn subtract(a: &[(u32, u32)], b: &[(u32, u32)]) -> Vec<(u32, u32)> {
    let mut out = Vec::new();
    for &(s, e) in a {
        let mut from = s;
        for &(bs, be) in b {
            if be < from || bs > e {
                continue;
            }
            if bs > from {
                out.push((from, bs - 1));
            }
            from = be + 1;
            if from > e {
                break;
            }
        }
        if from <= e {
            out.push((from, e));
        }
    }
    out
}

/// A line headed "FIGURATIVE", or one under it.
fn figurative(s: &Subject, l: &Line) -> bool {
    let fig = |x: &str| x.to_uppercase().starts_with("FIGURATIVE");
    fig(&l.label) || l.parent.is_some_and(|p| fig(&s.lines[p].label))
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

// ------------------------------------------------------------ ties

/// The question's own words, as written and as stems: "How do I deal with
/// worry?" gives "worry" and "worr"; words of asking ("how", "deal") are
/// left out.
fn asked_stems(question: &str, also: &[String]) -> BTreeSet<String> {
    std::iter::once(question)
        .chain(also.iter().map(String::as_str))
        .flat_map(content_words)
        .flat_map(|w| [stem(&w).to_string(), w])
        .collect()
}

fn content_words(s: &str) -> Vec<String> {
    normalize(s)
        .split(' ')
        .filter(|w| w.chars().count() >= 3 && !QUESTION_STOP.contains(w))
        .map(str::to_string)
        .collect()
}

/// A rough stem, the same the app uses: "prayers", "praying" -> "pray".
fn stem(w: &str) -> &str {
    for end in ["ness", "ing", "ies", "ied", "es", "ed", "ly", "s", "y", "e"] {
        if w.len() > end.len() + 2 && w.ends_with(end) {
            return &w[..w.len() - end.len()];
        }
    }
    w
}

/// Does a word of a verse meet one of the question's stems? The same stem, or
/// one a longer form of the other ("pray", "prayer").
fn meets(word: &str, asked: &BTreeSet<String>) -> bool {
    let s = stem(word);
    asked.contains(s)
        || asked.iter().any(|a| {
            let (short, long) = if a.len() <= s.len() { (a.as_str(), s) } else { (s, a.as_str()) };
            short.len() >= 4 && long.starts_with(short) && long.len() - short.len() <= 3
        })
}

fn overlaps(a: (u32, u32), b: (u32, u32)) -> bool {
    a.0 <= b.1 && b.0 <= a.1
}

/// A cross-reference with more votes for it than against, either direction,
/// between some verse of `a` and some verse of `b`. An edge reaches every
/// verse of its span.
fn cross_linked(g: &XrefGraph, a: (u32, u32), b: (u32, u32)) -> bool {
    let reaches = |from: (u32, u32), to: (u32, u32)| {
        (from.0..=from.1).any(|v| {
            g.out(v).any(|e| g.votes[e] > 0 && overlaps((g.dst[e], g.dst[e] + g.span[e].max(1) as u32 - 1), to))
        })
    };
    reaches(a, b) || reaches(b, a)
}

/// Is this word a noun, verb or adjective (not a number), by its morphology?
/// Greek "N-NSM", "V-PAI-3S", "A-NSM"; Hebrew and Aramaic "HNcmsa",
/// "HR/Ncmsa", "HC/Vqw3ms", where the language letter leads and prefixes and
/// suffixes are split off by "/".
fn content_morph(m: &str) -> bool {
    if m.starts_with(['H', 'A']) && !m.starts_with("A-") {
        return m[1..].split('/').any(|seg| {
            seg.starts_with(['N', 'V']) || (seg.starts_with('A') && !seg.starts_with("Ac") && !seg.starts_with("Ao"))
        });
    }
    matches!(m.split('-').next(), Some("N" | "V" | "A"))
}

/// The roots of a part's verses (main text only) that can tie it to another.
fn roots(src: &Sources, (s, e): (u32, u32)) -> BTreeSet<u32> {
    (s..=e)
        .flat_map(|v| &src.words[v as usize])
        .filter(|w| w.main && content_morph(&w.morph))
        .filter_map(|w| w.lemma.as_deref())
        .filter(|k| !LIGHT_ROOTS.iter().any(|l| k.starts_with(l)))
        .filter_map(|k| src.lemma_index.get(k).copied())
        .filter(|&i| src.lemma_count[i as usize] <= ROOT_MAX)
        .collect()
}

/// For each part, what ties it to the question or to the other parts, as
/// published: `w` the question's words it shows, `s` the question's Nave's
/// subjects it sits under, `x` the parts it shares a cross-reference with,
/// `q` the parts it quotes or that quote it, `r` [part, root] for the rarest
/// Hebrew or Greek root it shares with another part, `p` the parts of the
/// same passage. Parts count from 0.
fn ties(
    src: &Sources,
    parts: &[(u32, u32)],
    said: &[String],
    asked: &BTreeSet<String>,
    subjects: &[(String, Vec<(u32, u32)>)],
) -> Vec<Value> {
    let rooted: Vec<BTreeSet<u32>> = parts.iter().map(|&p| roots(src, p)).collect();
    parts
        .iter()
        .enumerate()
        .map(|(i, &p)| {
            let mut t = serde_json::Map::new();
            // The words as the part shows them ("Christ", "God’s").
            let mut words: Vec<String> = Vec::new();
            let mut seen = BTreeSet::new();
            for raw in said[i].split(|c: char| !(c.is_alphanumeric() || matches!(c, '\'' | '’' | '‘' | 'ʼ'))) {
                let w = normalize(raw);
                if w.chars().count() >= 3 && !w.contains(' ') && !QUESTION_STOP.contains(&w.as_str()) && meets(&w, asked) && seen.insert(w) {
                    words.push(raw.trim_matches(|c: char| !c.is_alphanumeric()).to_string());
                }
            }
            if !words.is_empty() {
                t.insert("w".into(), json!(words));
            }
            let under: Vec<&str> = subjects
                .iter()
                .filter(|(_, rs)| rs.iter().any(|&r| overlaps(r, p)))
                .map(|(name, _)| name.as_str())
                .collect();
            if !under.is_empty() {
                t.insert("s".into(), json!(under));
            }
            let others = || (0..parts.len()).filter(move |&j| j != i);
            let x: Vec<usize> = others().filter(|&j| cross_linked(src.graph, p, parts[j])).collect();
            if !x.is_empty() {
                t.insert("x".into(), json!(x));
            }
            let q: Vec<usize> = others()
                .filter(|&j| {
                    src.quotes.iter().any(|&(n0, n1, o0, o1)| {
                        (overlaps(p, (n0, n1)) && overlaps(parts[j], (o0, o1)))
                            || (overlaps(parts[j], (n0, n1)) && overlaps(p, (o0, o1)))
                    })
                })
                .collect();
            if !q.is_empty() {
                t.insert("q".into(), json!(q));
            }
            let r: Vec<[u32; 2]> = others()
                .filter_map(|j| {
                    rooted[i]
                        .intersection(&rooted[j])
                        .min_by_key(|&&k| (src.lemma_count[k as usize], k))
                        .map(|&k| [j as u32, k])
                })
                .collect();
            if !r.is_empty() {
                t.insert("r".into(), json!(r));
            }
            let chapter = |v: u32| src.vz.locate(v).map(|l| (l.0, l.1));
            let near: Vec<usize> = others()
                .filter(|&j| {
                    let o = parts[j];
                    chapter(p.0) == chapter(o.0) && chapter(p.1) == chapter(o.1) && (o.0.saturating_sub(p.1) <= PASSAGE_GAP + 1 && p.0.saturating_sub(o.1) <= PASSAGE_GAP + 1)
                })
                .collect();
            if !near.is_empty() {
                t.insert("p".into(), json!(near));
            }
            Value::Object(t)
        })
        .collect()
}

/// How many parts each kind of tie holds, for the build's summary line.
#[derive(Default)]
struct Tally {
    parts: usize,
    kinds: BTreeMap<String, usize>,
}

impl Tally {
    fn add(&mut self, t: &Value) {
        self.parts += 1;
        for k in t.as_object().into_iter().flat_map(|o| o.keys()) {
            *self.kinds.entry(k.clone()).or_default() += 1;
        }
    }

    fn summary(&self) -> String {
        let name = |k: &str| match k {
            "w" => "the question's words",
            "s" => "its Nave's subjects",
            "x" => "cross-references",
            "q" => "quotations",
            "r" => "shared roots",
            _ => "the same passage",
        };
        ["w", "s", "x", "q", "r", "p"]
            .iter()
            .map(|k| format!("{} {}", self.kinds.get(*k).copied().unwrap_or(0), name(k)))
            .collect::<Vec<_>>()
            .join(", ")
    }
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
    subjects: &'a HashMap<String, &'a Subject>,
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
        let subjects: &'a HashMap<String, &'a Subject> = self.subjects;
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

fn question(c: &mut Check, q: &QuestionSpec, src: &Sources, tally: &mut Tally) -> Option<Built> {
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
    if !(2..=16).contains(&q.also.len()) {
        c.fail(&at, "also needs 2 to 16 other ways to ask");
    }
    for a in &q.also {
        c.plain(&at, "also", a, 60);
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
    // What each part shows, for the question's words it holds.
    let mut said: Vec<String> = Vec::new();
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
            said.push(full);
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
                said.push(span.to_string());
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
    // Each subject's name and the verses its kept lines cite.
    let mut subjects: Vec<(String, Vec<(u32, u32)>)> = Vec::new();
    for (i, t) in q.topics.iter().enumerate() {
        let kept = c.topic_lines(&format!("{at}, topics[{i}]"), t);
        if !kept.is_empty() && kept.iter().all(|l| l.refs.is_empty()) {
            c.fail(
                &format!("{at}, topics[{i}]"),
                format_args!("the lines kept under {} cite no verses", t.subject),
            );
        }
        subjects.push((
            title(&t.subject.trim().to_uppercase()),
            kept.iter().flat_map(|l| l.refs.iter().copied()).collect(),
        ));
        lines.extend(kept);
    }

    // Why each part is there. A part nothing ties to the question or to the
    // rest of the chain is not the Bible answering; the build stops.
    if parts.len() == q.chain.len() && chain.len() == q.chain.len() {
        let asked = asked_stems(&q.question, &q.also);
        let found = ties(src, &parts, &said, &asked, &subjects);
        for (i, (t, part)) in found.into_iter().zip(chain.iter_mut()).enumerate() {
            tally.add(&t);
            if t.as_object().is_none_or(|o| o.is_empty()) {
                c.fail(
                    &format!("{at}, chain[{i}]"),
                    format_args!(
                        "nothing ties {:?} to the question or to another part: it holds none of the question's words, sits under none of its Nave's subjects, and shares no cross-reference, quotation or rare Hebrew or Greek root with another part",
                        q.chain[i].reference
                    ),
                );
            } else {
                part["t"] = t;
            }
        }
    }
    let cluster = merge(
        parts
            .iter()
            .copied()
            .chain(lines.iter().flat_map(|l| l.refs.iter().copied()))
            .collect(),
    );

    let group = group?;
    let index = json!({
        "id": q.id, "g": group, "q": q.question.trim(), "also": q.also, "n": count(&cluster),
        "top": ranges_json(&most_cited(lines.iter().copied(), src.degree)),
        "chain": chain,
    });
    Some(Built { index, cluster })
}

/// The files to write under web/public/data, as (path, bytes).
pub fn build(root: &Path, naves: &Naves, src: &Sources) -> Result<Vec<(String, Vec<u8>)>, String> {
    let (vz, degree) = (src.vz, src.degree);
    let (subjects, bad) = (&naves.subjects, naves.bad);
    // By capitals: a few subjects are written "ANGEL (a spirit)".
    let by_key: HashMap<String, &Subject> =
        subjects.iter().map(|s| (s.key.to_uppercase(), s)).collect();
    let file: QuestionFile = serde_json::from_str(
        &fs::read_to_string(root.join(CONFIG)).map_err(|e| format!("reading {CONFIG}: {e}"))?,
    )
    .map_err(|e| format!("parsing {CONFIG}: {e}"))?;

    let mut out: Vec<(String, Vec<u8>)> = Vec::new();
    let mut check = Check {
        vz,
        text: src.text,
        subjects: &by_key,
        errors: Vec::new(),
    };
    let mut ids = BTreeSet::new();
    let mut questions = Vec::new();
    let mut tally = Tally::default();
    for q in &file.questions {
        if !ids.insert(q.id.as_str()) {
            check.fail(
                &format!("question {:?}", q.id),
                "id is used by an earlier question",
            );
        }
        if let Some(b) = question(&mut check, q, src, &mut tally) {
            out.push((
                format!("ask/q/{}.json", q.id),
                serde_json::to_vec(&json!({ "v": ranges_json(&b.cluster) }))
                    .map_err(|e| e.to_string())?,
            ));
            questions.push(b.index);
        }
    }
    // Every problem is listed, so one run shows all there is to fix.
    if let Some(first) = check.errors.first() {
        for e in &check.errors[1..] {
            eprintln!("  also: {e}");
        }
        return Err(match check.errors.len() {
            1 => first.clone(),
            n => format!("{first} (and {} more problems, listed above)", n - 1),
        });
    }

    // Every subject: its title and verse count in the index, its verses in a shard.
    let mut topics = Vec::new();
    let mut shards: Vec<Vec<Value>> = Vec::new();
    for t in &naves.listed {
        let s = &subjects[t.subject];
        // Lines that use the subject as a figure stay in the list but do not
        // answer for it: Jeremiah 3:8 under Divorce speaks of Israel.
        let literal: Vec<&Line> = s.lines.iter().filter(|l| !figurative(s, l)).collect();
        let fig = subtract(
            &merge(
                s.lines
                    .iter()
                    .filter(|l| figurative(s, l))
                    .flat_map(|l| l.refs.iter().copied())
                    .collect(),
            ),
            &merge(literal.iter().flat_map(|l| l.refs.iter().copied()).collect()),
        );
        let top = if literal.is_empty() {
            most_cited(s.lines.iter(), degree)
        } else {
            most_cited(literal.into_iter(), degree)
        };
        if topics.len() % TOPIC_SHARD == 0 {
            shards.push(Vec::new());
        }
        let mut shard = json!({ "top": ranges_json(&top), "v": ranges_json(&t.verses) });
        if !fig.is_empty() {
            shard["f"] = ranges_json(&fig);
        }
        shards.last_mut().unwrap().push(shard);
        topics.push(json!([t.title, count(&t.verses)]));
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

    eprintln!(
        "ask the bible: {} questions, {} chain parts, each tied to the question or the chain ({}); {} Nave's subjects, {bad} references not in the BSB left out",
        file.questions.len(),
        tally.parts,
        tally.summary(),
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
    let (mut parts, mut tied) = (0usize, true);
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
        let chain = q["chain"].as_array();
        parts += chain.map_or(0, Vec::len);
        tied &= chain.is_some_and(|c| {
            !c.is_empty() && c.iter().all(|p| p["t"].as_object().is_some_and(|t| !t.is_empty()))
        });
    }
    Ok(vec![
        (
            tied,
            format!("every question has a chain, and all {parts} of its parts are tied to the question or the chain"),
        ),
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
    fn question_words_and_stems() {
        let asked = asked_stems("How do I deal with worry?", &["anxious thoughts".into(), "what does god say".into()]);
        assert_eq!(asked.iter().map(String::as_str).collect::<Vec<_>>(), vec!["anxiou", "anxious", "thought", "thoughts", "worr", "worry"]);
        assert!(meets("worrying", &asked));
        assert!(meets("thoughts", &asked));
        assert!(!meets("god", &asked));
        // A longer form meets a stem of four letters or more, not "son" and "song".
        let pray = asked_stems("pray", &[]);
        assert!(meets("prayer", &pray));
        assert!(!meets("song", &asked_stems("son", &[])));
    }

    #[test]
    fn content_words_by_morphology() {
        assert!(content_morph("N-NSM"));
        assert!(content_morph("V-PAI-3S"));
        assert!(content_morph("A-NSM"));
        assert!(!content_morph("PREP"));
        assert!(!content_morph("CONJ"));
        assert!(!content_morph("ADV"));
        assert!(!content_morph("T-NSM"));
        assert!(content_morph("HNcmsa"));
        assert!(content_morph("HR/Ncmsa"));
        assert!(content_morph("HC/Vqw3ms"));
        assert!(content_morph("HAamsa"));
        assert!(content_morph("ANcmsd"));
        assert!(!content_morph("HAcmsa"));
        assert!(!content_morph("HR"));
        assert!(!content_morph("HTd"));
        assert!(!content_morph("HC/Td"));
    }

    #[test]
    fn overlapping_ranges() {
        assert!(overlaps((3, 5), (5, 9)));
        assert!(overlaps((3, 5), (1, 3)));
        assert!(!overlaps((3, 5), (6, 9)));
    }

    #[test]
    fn subtracted_ranges() {
        assert_eq!(subtract(&[(1, 10)], &[(3, 4), (8, 12)]), vec![(1, 2), (5, 7)]);
        assert_eq!(subtract(&[(1, 2), (5, 6)], &[(2, 5)]), vec![(1, 1), (6, 6)]);
        assert_eq!(subtract(&[(4, 6)], &[(1, 9)]), vec![]);
        assert_eq!(subtract(&[(4, 6)], &[]), vec![(4, 6)]);
    }
}
