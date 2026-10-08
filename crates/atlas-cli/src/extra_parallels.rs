//! Parallel passages: passages that tell the same event or teaching, or give
//! the same song, list, law or prophecy, such as Mark 2:1-12 with Matthew
//! 9:1-8 and Luke 5:17-26.
//!
//! The sets are curated in `config/parallels.json`, starting from the parallel
//! references in the section headings of the Berean Standard Bible (public
//! domain) and kept to clear parallels. The build checks every reference
//! against the BSB, reads the headings (source `bsb-headings`) for each
//! passage's heading and to record which passages they list, measures how many
//! Hebrew, Greek and English words each pair of passages shares, drops a
//! passage that shares almost nothing with the rest of its set, and lines
//! every pair up verse by verse by the roots and English words their verses
//! share.
//!
//! Output, under `web/public/data/`:
//! - `extras/parallels.json`: `{format, kinds, sets}`, each set
//!   `[kind, from, to, from, to, ...]` in verse numbers. Small: it loads the
//!   first time a reader selects a verse.
//! - `extras/parallels/<Book>.json`: for each set with a passage in that book,
//!   `{titles, listed, pairs, apart}`: the BSB heading of each passage, which
//!   passages the headings list, for each pair `[i, j, roots in common %,
//!   English words in common %, rows]` (rows as verse counts `[a, b, a, b,
//!   ...]`, a 0 where one passage has a verse the other does not), and the
//!   passages left out of the set as `[from, to, why]`. It loads when the panel
//!   opens.

use crate::loaded::Loaded;
use crate::parse::Word;
use crate::sources::Inputs;
use atlas_core::canon::BOOKS;
use atlas_core::Versification;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::Path;

const CONFIG: &str = "config/parallels.json";
const SOURCE: &str = "bsb-headings";
const OUT: &str = "extras/parallels.json";
const DIR: &str = "extras/parallels";

/// The kinds of parallel, in the order the output numbers them.
pub const KINDS: [&str; 7] = [
    "account", "event", "song", "list", "law", "prophecy", "letter",
];

/// Two runs of verses can share a row when the Hebrew or Greek roots and the
/// English words they share (rarer ones weigh more) are at least this share of
/// both (Dice similarity)...
const THETA: f64 = 0.12;
/// ...and weigh at least this: one rare word, or two common ones.
const MIN_SHARED: f64 = 7.0;
/// A row is worth the weight of the words it shares, less this much of the
/// weight of the words it does not share...
const UNSHARED_COST: f64 = 0.07;
/// ...and less this for each verse beyond one on a side.
const MERGE_COST: f64 = 1.0;
/// The most verses one side of a row may hold.
const MAX_RUN: usize = 12;
/// A passage sharing less than this with every other passage of its set is dropped.
const DROP_BELOW: f64 = 0.12;

/// USFM book codes in canonical order.
const USFM: [&str; 66] = [
    "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH",
    "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK",
    "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
    "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH",
    "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD",
    "REV",
];

/// English words too common to count as shared.
const STOP: &[&str] = &[
    "a", "an", "the", "and", "or", "but", "if", "of", "to", "in", "on", "at", "by", "for", "with",
    "from", "into", "onto", "upon", "as", "is", "are", "was", "were", "be", "been", "being", "am",
    "do", "does", "did", "done", "have", "has", "had", "having", "i", "me", "my", "mine", "we",
    "us", "our", "ours", "you", "your", "yours", "he", "him", "his", "she", "her", "hers", "it",
    "its", "they", "them", "their", "theirs", "this", "that", "these", "those", "there", "here",
    "then", "than", "so", "not", "no", "nor", "yes", "all", "any", "each", "every", "some", "such",
    "who", "whom", "whose", "which", "what", "when", "where", "why", "how", "will", "would",
    "shall", "should", "may", "might", "can", "could", "must", "also", "just", "very", "only",
    "even", "up", "down", "out", "over", "under", "again", "about", "against", "between",
    "through", "before", "after", "above", "below", "off", "own", "same", "too", "more", "most",
    "other", "others", "both", "few", "once", "because", "while", "until", "unto", "o", "oh",
    "let", "lets", "said", "says", "say", "one", "two",
];

/// A passage: its first and last verse numbers.
type Span = (u32, u32);

/// Two passages that config/parallels.json leaves out of every set together,
/// and why.
type LeftOut = (Span, Span, String);

/// One section heading of the BSB: its words, the verses it covers and the
/// passages its reference line names.
#[derive(Debug)]
struct Heading {
    title: String,
    from: u32,
    to: u32,
    refs: Vec<Span>,
}

/// A set as config/parallels.json gives it: a kind and its passages.
struct Set {
    kind: usize,
    passages: Vec<Span>,
}

fn overlaps(a: Span, b: Span) -> bool {
    a.0 <= b.1 && b.0 <= a.1
}

/// A passage as config/parallels.json writes it ("Mark 2:1-12",
/// "1Chr 15:29-16:3", "Jude 1:4-16"): the book's OSIS id and a verse or a range
/// of verses the BSB has, as its first and last verse numbers.
fn passage(s: &str, vz: &Versification) -> Result<Span, String> {
    let bad =
        || format!("{CONFIG}: {s:?} is not a passage of the BSB (write it like \"Mark 2:1-12\")");
    let q = atlas_core::refs::parse(s).ok_or_else(bad)?;
    let osis = s.split(' ').next().unwrap_or_default();
    if BOOKS[q.book as usize].osis != osis || q.verse == 0 || q.end_verse == 0 {
        return Err(bad());
    }
    if (q.end_chapter, q.end_verse) < (q.chapter, q.verse) {
        return Err(bad());
    }
    atlas_core::refs::resolve(q, vz).ok_or_else(bad)
}

fn read_config(root: &Path, vz: &Versification) -> Result<(Vec<Set>, Vec<LeftOut>), String> {
    let path = root.join(CONFIG);
    let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let doc: Value =
        serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))?;
    let mut sets = Vec::new();
    for (i, row) in doc["sets"]
        .as_array()
        .ok_or(format!("{CONFIG} has no sets"))?
        .iter()
        .enumerate()
    {
        let cells = row
            .as_array()
            .map(|r| r.iter().map(Value::as_str).collect::<Option<Vec<_>>>());
        let cells = cells
            .flatten()
            .ok_or(format!("{CONFIG}: set {i} is not a list of strings"))?;
        let kind = KINDS
            .iter()
            .position(|k| Some(k) == cells.first())
            .ok_or(format!(
                "{CONFIG}: set {i} has no known kind ({})",
                KINDS.join(", ")
            ))?;
        let passages = cells[1..]
            .iter()
            .map(|s| passage(s, vz))
            .collect::<Result<Vec<_>, _>>()?;
        if passages.len() < 2 {
            return Err(format!(
                "{CONFIG}: set {i} ({}) has fewer than two passages",
                cells.join(", ")
            ));
        }
        for (a, p) in passages.iter().enumerate() {
            if passages[a + 1..].iter().any(|q| overlaps(*p, *q)) {
                return Err(format!(
                    "{CONFIG}: set {i} ({}) has overlapping passages",
                    cells.join(", ")
                ));
            }
        }
        sets.push(Set { kind, passages });
    }
    let mut left_out = Vec::new();
    for row in doc["leftOut"]
        .as_array()
        .ok_or(format!("{CONFIG} has no leftOut"))?
    {
        let cells = row
            .as_array()
            .map(|r| r.iter().map(Value::as_str).collect::<Option<Vec<_>>>());
        match cells.flatten().as_deref() {
            Some([a, b, why]) if !why.trim().is_empty() => {
                left_out.push((passage(a, vz)?, passage(b, vz)?, why.trim().to_string()))
            }
            _ => {
                return Err(format!(
                    "{CONFIG}: leftOut rows are [passage, passage, reason]: {row}"
                ))
            }
        }
    }
    Ok((sets, left_out))
}

/// Heading text without USFM character markers; `\nd Lord\nd*` (the divine
/// name, set in small capitals) becomes "LORD" as the BSB prints it.
fn clean(s: &str) -> String {
    let mut out = String::new();
    let mut caps = false;
    let mut rest = s;
    while let Some(i) = rest.find('\\') {
        let piece = &rest[..i];
        out.push_str(&if caps {
            piece.to_uppercase()
        } else {
            piece.to_string()
        });
        let tail = &rest[i + 1..];
        let end = tail
            .find(|c: char| !(c.is_ascii_alphanumeric() || c == '+' || c == '*'))
            .unwrap_or(tail.len());
        let marker = &tail[..end];
        if marker == "nd" {
            caps = true;
        } else if marker == "nd*" {
            caps = false;
        }
        rest = tail[end..]
            .strip_prefix(' ')
            .filter(|_| !marker.ends_with('*'))
            .unwrap_or(&tail[end..]);
    }
    out.push_str(&if caps {
        rest.to_uppercase()
    } else {
        rest.to_string()
    });
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The passages a heading's reference line names: "(Matthew 9:1–8; Luke
/// 5:17–26)". Returns them and the number of parts that could not be read.
fn heading_refs(line: &str, vz: &Versification) -> (Vec<Span>, usize) {
    let inner = line.trim().trim_start_matches('(').trim_end_matches(')');
    let mut out = Vec::new();
    let mut unread = 0;
    for part in inner.split(';').map(str::trim).filter(|p| !p.is_empty()) {
        match atlas_core::refs::parse(part).and_then(|q| atlas_core::refs::resolve(q, vz)) {
            Some(r) => out.push(r),
            None => unread += 1,
        }
    }
    (out, unread)
}

/// The `\s1` headings of one USFM book, each with the verses up to the next
/// heading, and the number of reference parts that could not be read.
fn headings(text: &str, book: u8, vz: &Versification) -> (Vec<Heading>, usize) {
    let mut out: Vec<Heading> = Vec::new();
    let mut waiting: Vec<usize> = Vec::new();
    let mut chapter: u16 = 0;
    let mut unread = 0;
    for line in text.lines() {
        let line = line.trim_start_matches('\u{feff}').trim();
        if let Some(rest) = line.strip_prefix("\\c ") {
            chapter = rest
                .split_whitespace()
                .next()
                .and_then(|c| c.parse().ok())
                .unwrap_or(chapter);
        } else if let Some(rest) = line.strip_prefix("\\s1 ") {
            out.push(Heading {
                title: clean(rest),
                from: u32::MAX,
                to: 0,
                refs: Vec::new(),
            });
            waiting.push(out.len() - 1);
        } else if let Some(rest) = line.strip_prefix("\\r ") {
            if let Some(h) = out.last_mut() {
                let (refs, bad) = heading_refs(rest, vz);
                h.refs.extend(refs);
                unread += bad;
            }
        } else {
            for (i, _) in line.match_indices("\\v ") {
                let digits: String = line[i + 3..]
                    .chars()
                    .take_while(char::is_ascii_digit)
                    .collect();
                if let Some(v) = digits.parse().ok().and_then(|n| vz.index(book, chapter, n)) {
                    for h in waiting.drain(..) {
                        out[h].from = v;
                    }
                }
            }
        }
    }
    out.retain(|h| h.from != u32::MAX);
    out.sort_by_key(|h| h.from);
    let end = vz.book_start(book)
        + (1..=vz.chapters_in(book))
            .filter_map(|c| vz.verses_in(book, c))
            .map(u32::from)
            .sum::<u32>();
    let starts: Vec<u32> = out.iter().map(|h| h.from).skip(1).chain([end]).collect();
    for (h, next) in out.iter_mut().zip(starts) {
        h.to = next.max(h.from + 1) - 1;
    }
    (out, unread)
}

/// The book a USFM file holds, from its `\id` line or else its file name
/// ("42MRKBSB.usfm" is Mark).
fn usfm_book(text: &str, path: &Path) -> Option<u8> {
    let id = text
        .lines()
        .find_map(|l| l.trim_start_matches('\u{feff}').strip_prefix("\\id "));
    if let Some(code) = id.and_then(|r| r.split_whitespace().next()) {
        return USFM.iter().position(|c| *c == code).map(|b| b as u8);
    }
    let name = path.file_name()?.to_str()?;
    let n: u8 = name.get(..2)?.parse().ok()?;
    match n {
        1..=39 => Some(n - 1),
        41..=67 => Some(n - 2),
        _ => None,
    }
}

/// Whether a word counts towards the words two passages share: a verb, noun
/// or adjective. Hebrew codes look like "HC/Vqw3ms" (any segment counts),
/// Greek ones like "V-AAI-3S".
fn content(morph: &str) -> bool {
    let mut chars = morph.chars();
    match (chars.next(), chars.next()) {
        (Some('H' | 'A'), Some(c)) if c.is_ascii_uppercase() || c == 'c' => morph[1..]
            .split('/')
            .any(|seg| matches!(seg.as_bytes().first(), Some(b'V' | b'N' | b'A'))),
        _ => matches!(morph.split([' ', '-']).next(), Some("V" | "N" | "A")),
    }
}

/// The English words of a verse that can count as shared: lower case, without
/// "'s" and the commonest words, each reduced by `stem`.
fn english(text: &str) -> Vec<String> {
    let lower = text
        .to_lowercase()
        .replace(['ʼ', '’'], "'")
        .replace("'s", "");
    let mut out: Vec<String> = lower
        .split(|c: char| !c.is_ascii_lowercase())
        .filter(|w| w.len() > 1 && !STOP.contains(w))
        .map(stem)
        .collect();
    out.sort();
    out.dedup();
    out
}

/// A word reduced to a form its plural, past and -ing forms share: "kings" and
/// "king", "loved" and "love", "cities" and "city", "healing" and "heals". The
/// panel marks shared words by the same rule (web/src/ui/extras/parallels/words.ts).
fn stem(w: &str) -> String {
    let mut s = w.to_string();
    if s.len() >= 5 && s.ends_with("ies") {
        s.truncate(s.len() - 3);
        s.push('y');
    } else if s.len() >= 4 && s.ends_with('s') && !s.ends_with("ss") {
        s.pop();
    }
    if s.len() >= 5 && s.ends_with("ied") {
        s.truncate(s.len() - 3);
        s.push('y');
    } else if s.len() >= 6 && s.ends_with("ing") {
        s.truncate(s.len() - 3);
    } else if s.len() >= 5 && s.ends_with("ed") {
        s.truncate(s.len() - 2);
    }
    if s.len() >= 4 && s.ends_with('e') {
        s.pop();
    }
    s
}

/// Sorted, de-duplicated union of some verses' word sets.
fn union<T: Ord + Clone>(sets: &[Vec<T>]) -> Vec<T> {
    let mut out: Vec<T> = sets.iter().flatten().cloned().collect();
    out.sort();
    out.dedup();
    out
}

/// The weight of the roots two sorted sets share, and of each set.
fn weights(x: &[u32], y: &[u32], idf: &[f64]) -> (f64, f64, f64) {
    let w = |s: &[u32]| s.iter().map(|&r| idf[r as usize]).sum::<f64>();
    let (mut i, mut j, mut both) = (0, 0, 0.0);
    while i < x.len() && j < y.len() {
        match x[i].cmp(&y[j]) {
            std::cmp::Ordering::Less => i += 1,
            std::cmp::Ordering::Greater => j += 1,
            std::cmp::Ordering::Equal => {
                both += idf[x[i] as usize];
                i += 1;
                j += 1;
            }
        }
    }
    (both, w(x), w(y))
}

/// How much of the lighter passage's roots the other passage also has, by weight.
fn root_share(x: &[u32], y: &[u32], idf: &[f64]) -> f64 {
    let (both, wx, wy) = weights(x, y, idf);
    let light = wx.min(wy);
    if light > 0.0 {
        both / light
    } else {
        0.0
    }
}

/// How many of the shorter passage's English words the other passage also has.
fn word_share(x: &[String], y: &[String]) -> f64 {
    let (small, large) = if x.len() <= y.len() { (x, y) } else { (y, x) };
    if small.is_empty() {
        return 0.0;
    }
    small
        .iter()
        .filter(|w| large.binary_search(w).is_ok())
        .count() as f64
        / small.len() as f64
}

/// Lines up two passages verse by verse. Each row takes some verses from each
/// side: one against one, one against several (when one passage tells in a
/// verse what the other tells in more), or one against none (a verse only one
/// side has). `a` and `b` hold each verse's sorted features (roots and English
/// stems) and `idf` their weights. Rows that pair verses need enough in common
/// (THETA, MIN_SHARED); the alignment whose rows are worth the most wins.
/// Returns (verses of a, verses of b) for each row, in order.
fn align(a: &[Vec<u32>], b: &[Vec<u32>], idf: &[f64]) -> Vec<(usize, usize)> {
    let (n, m) = (a.len(), b.len());
    let ratio = n.max(m).div_ceil(n.min(m).max(1));
    let k_max = (ratio + 1).clamp(2, MAX_RUN);
    let mut steps = vec![(1, 0), (0, 1), (1, 1)];
    steps.extend((2..=k_max).map(|k| (1, k)));
    steps.extend((2..=k_max).map(|k| (k, 1)));
    let mut score = vec![vec![f64::NEG_INFINITY; m + 1]; n + 1];
    let mut back = vec![vec![(0usize, 0usize); m + 1]; n + 1];
    score[0][0] = 0.0;
    for i in 0..=n {
        for j in 0..=m {
            let here = score[i][j];
            if here == f64::NEG_INFINITY {
                continue;
            }
            for &(di, dj) in &steps {
                let (ii, jj) = (i + di, j + dj);
                if ii > n || jj > m {
                    continue;
                }
                let gain = if di > 0 && dj > 0 {
                    let (both, wx, wy) = weights(&union(&a[i..ii]), &union(&b[j..jj]), idf);
                    if both < MIN_SHARED || 2.0 * both < THETA * (wx + wy) {
                        continue;
                    }
                    both - UNSHARED_COST * (wx + wy - 2.0 * both)
                        - MERGE_COST * (di + dj - 2) as f64
                } else {
                    0.0
                };
                if here + gain > score[ii][jj] {
                    score[ii][jj] = here + gain;
                    back[ii][jj] = (di, dj);
                }
            }
        }
    }
    let mut rows = Vec::new();
    let (mut i, mut j) = (n, m);
    while i > 0 || j > 0 {
        let (di, dj) = back[i][j];
        rows.push((di, dj));
        i -= di;
        j -= dj;
    }
    rows.reverse();
    rows
}

/// The files to write under web/public/data, as (path, bytes).
pub fn build(
    root: &Path,
    inputs: &Inputs,
    vz: &Versification,
    english_text: &[String],
    words: &[Vec<Word>],
    lemma_index: &HashMap<&str, u32>,
) -> Result<Vec<(String, Vec<u8>)>, String> {
    let (mut sets, left_out) = read_config(root, vz)?;
    let book_of = |v: u32| vz.locate(v).map(|(b, _, _)| b).unwrap_or(0);

    // Headings of every book a set uses.
    let mut heads: BTreeMap<u8, Vec<Heading>> = BTreeMap::new();
    let mut unread = 0;
    for path in inputs.paths(SOURCE) {
        let text =
            fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
        let book = usfm_book(&text, &path).ok_or(format!(
            "{}: cannot tell which book it holds",
            path.display()
        ))?;
        let (hs, bad) = headings(&text, book, vz);
        unread += bad;
        heads.insert(book, hs);
    }
    let missing: std::collections::BTreeSet<&str> = sets
        .iter()
        .flat_map(|s| &s.passages)
        .map(|p| book_of(p.0))
        .filter(|b| !heads.contains_key(b))
        .map(|b| BOOKS[b as usize].osis)
        .collect();
    if !missing.is_empty() {
        return Err(format!(
            "{CONFIG} uses books whose headings {SOURCE} does not list: {}",
            missing.into_iter().collect::<Vec<_>>().join(", ")
        ));
    }

    // Root weights: rarer roots count for more.
    let mut count = vec![0u32; lemma_index.len()];
    for w in words.iter().flatten().filter(|w| w.main) {
        if let Some(&i) = w.lemma.as_deref().and_then(|k| lemma_index.get(k)) {
            count[i as usize] += 1;
        }
    }
    let total = count.iter().map(|&c| f64::from(c)).sum::<f64>();
    let idf: Vec<f64> = count
        .iter()
        .map(|&c| (total / (f64::from(c) + 1.0)).ln())
        .collect();
    // The content roots of a verse's base text. A verse the base text lacks
    // but the BSB prints (Mark 16:9-20, John 7:53-8:11) uses the words of the
    // editions that have it; a verse the BSB leaves to a footnote has none.
    let roots = |v: u32| -> Vec<u32> {
        if english_text[v as usize].trim().is_empty() {
            return Vec::new();
        }
        let ws = &words[v as usize];
        let base = ws.iter().any(|w| w.main);
        let mut r: Vec<u32> = ws
            .iter()
            .filter(|w| (w.main || !base) && content(&w.morph))
            .filter_map(|w| w.lemma.as_deref().and_then(|k| lemma_index.get(k)).copied())
            .collect();
        r.sort_unstable();
        r.dedup();
        r
    };

    // English words weigh in too, so that verses telling the same thing in
    // different Greek or Hebrew words (Mark 2:4 and Luke 5:19) still line up:
    // each word stem is a feature after the roots, rarer stems counting more.
    let verse_english: Vec<Vec<String>> = english_text.iter().map(|t| english(t)).collect();
    let mut stems: HashMap<&str, u32> = HashMap::new();
    let mut df: Vec<u32> = Vec::new();
    for ws in &verse_english {
        for w in ws {
            let next = stems.len() as u32;
            let id = *stems.entry(w.as_str()).or_insert(next);
            if id as usize == df.len() {
                df.push(0);
            }
            df[id as usize] += 1;
        }
    }
    let verses_total = verse_english.len() as f64;
    let mut weight = idf.clone();
    weight.extend(
        df.iter()
            .map(|&c| (verses_total / (f64::from(c) + 1.0)).ln()),
    );
    let offset = idf.len() as u32;
    let features = |v: u32| -> Vec<u32> {
        let mut f = roots(v);
        f.extend(
            verse_english[v as usize]
                .iter()
                .filter_map(|w| stems.get(w.as_str()))
                .map(|&id| offset + id),
        );
        f.sort_unstable();
        f
    };

    // Drop a passage that shares almost nothing with the rest of its set.
    let mut dropped = Vec::new();
    for set in &mut sets {
        let passage_roots: Vec<Vec<u32>> = set
            .passages
            .iter()
            .map(|p| union(&(p.0..=p.1).map(roots).collect::<Vec<_>>()))
            .collect();
        let keep: Vec<bool> = (0..set.passages.len())
            .map(|i| {
                (0..set.passages.len())
                    .filter(|&j| j != i)
                    .any(|j| root_share(&passage_roots[i], &passage_roots[j], &idf) >= DROP_BELOW)
            })
            .collect();
        for (p, _) in set.passages.iter().zip(&keep).filter(|(_, k)| !**k) {
            dropped.push(format!("{}-{}", label(vz, p.0), label(vz, p.1)));
        }
        let mut k = keep.iter();
        set.passages.retain(|_| *k.next().unwrap_or(&true));
    }
    sets.retain(|s| s.passages.len() >= 2);

    // A set never joins two passages that config/parallels.json leaves out.
    for (a, b, _) in &left_out {
        for set in &sets {
            let hit = |x: Span| set.passages.iter().position(|p| overlaps(*p, x));
            if let (Some(i), Some(j)) = (hit(*a), hit(*b)) {
                if i != j {
                    return Err(format!(
                        "{CONFIG}: a set joins {} and {}, which leftOut keeps apart",
                        label(vz, a.0),
                        label(vz, b.0)
                    ));
                }
            }
        }
    }

    // Measures, rows, headings and what the BSB headings list.
    let mut by_book: BTreeMap<u8, serde_json::Map<String, Value>> = BTreeMap::new();
    let mut index = Vec::new();
    let (mut pairs, mut added) = (0usize, 0usize);
    for (id, set) in sets.iter().enumerate() {
        let n = set.passages.len();
        let verse_roots: Vec<Vec<Vec<u32>>> = set
            .passages
            .iter()
            .map(|p| (p.0..=p.1).map(roots).collect())
            .collect();
        let verse_features: Vec<Vec<Vec<u32>>> = set
            .passages
            .iter()
            .map(|p| (p.0..=p.1).map(features).collect())
            .collect();
        let verse_words: Vec<Vec<String>> = set
            .passages
            .iter()
            .map(|p| union(&verse_english[p.0 as usize..=p.1 as usize]))
            .collect();
        let mut out_pairs = Vec::new();
        for i in 0..n {
            for j in i + 1..n {
                let share = root_share(&union(&verse_roots[i]), &union(&verse_roots[j]), &idf);
                let shared_words = word_share(&verse_words[i], &verse_words[j]);
                let rows: Vec<usize> = align(&verse_features[i], &verse_features[j], &weight)
                    .into_iter()
                    .flat_map(|(x, y)| [x, y])
                    .collect();
                out_pairs.push(json!([
                    i,
                    j,
                    (share * 100.0).round() as u32,
                    (shared_words * 100.0).round() as u32,
                    rows
                ]));
                pairs += 1;
            }
        }
        let listed: Vec<bool> = (0..n)
            .map(|i| {
                (0..n).filter(|&j| j != i).any(|j| {
                    let names = |from: Span, to: Span| {
                        heads[&book_of(from.0)].iter().any(|h| {
                            overlaps((h.from, h.to), from)
                                && h.refs.iter().any(|r| overlaps(*r, to))
                        })
                    };
                    names(set.passages[i], set.passages[j])
                        || names(set.passages[j], set.passages[i])
                })
            })
            .collect();
        added += listed.iter().filter(|l| !**l).count();
        let titles: Vec<&str> = set
            .passages
            .iter()
            .map(|p| {
                heads[&book_of(p.0)]
                    .iter()
                    .find(|h| h.from <= p.0 && p.0 <= h.to)
                    .map_or("", |h| h.title.as_str())
            })
            .collect();
        // Passages the headings link to this set that config/parallels.json
        // leaves out, with the reason, so the panel can say so.
        let inside = |x: Span| set.passages.iter().any(|p| overlaps(*p, x));
        let apart: Vec<Value> = left_out
            .iter()
            .filter_map(|(x, y, why)| match (inside(*x), inside(*y)) {
                (true, false) => Some(json!([y.0, y.1, why])),
                (false, true) => Some(json!([x.0, x.1, why])),
                _ => None,
            })
            .collect();
        let detail =
            json!({ "titles": titles, "listed": listed, "pairs": out_pairs, "apart": apart });
        let mut books: Vec<u8> = set.passages.iter().map(|p| book_of(p.0)).collect();
        books.dedup();
        for b in books {
            by_book
                .entry(b)
                .or_default()
                .insert(id.to_string(), detail.clone());
        }
        let mut row = vec![set.kind as u32];
        row.extend(set.passages.iter().flat_map(|p| [p.0, p.1]));
        index.push(row);
    }
    eprintln!(
        "parallels: {} sets, {pairs} pairs lined up, {added} passages added by hand (not in the BSB headings); {} headings read, {unread} heading references not read",
        sets.len(),
        heads.values().map(Vec::len).sum::<usize>()
    );
    if !dropped.is_empty() {
        eprintln!(
            "parallels: dropped as sharing almost no words with their set: {}",
            dropped.join(", ")
        );
    }
    let doc = json!({ "format": 1, "kinds": KINDS, "sets": index });
    let mut files = vec![(
        OUT.to_string(),
        serde_json::to_vec(&doc).map_err(|e| e.to_string())?,
    )];
    for (b, sets) in by_book {
        let doc = json!({ "format": 1, "sets": sets });
        files.push((
            format!("{DIR}/{}.json", BOOKS[b as usize].osis),
            serde_json::to_vec(&doc).map_err(|e| e.to_string())?,
        ));
    }
    Ok(files)
}

fn label(vz: &Versification, v: u32) -> String {
    match vz.locate(v) {
        Some((b, c, vv)) => format!("{} {c}:{vv}", BOOKS[b as usize].osis),
        None => format!("#{v}"),
    }
}

fn read_json(path: &Path) -> Result<Value, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let doc = read_json(&d.dir.join(OUT))?;
    let n = d.vz.verse_count();
    let sets: Vec<Vec<u32>> = doc["sets"]
        .as_array()
        .ok_or("parallels.json has no sets")?
        .iter()
        .map(|s| {
            s.as_array()
                .map(|r| {
                    r.iter()
                        .filter_map(|x| x.as_u64().map(|x| x as u32))
                        .collect()
                })
                .unwrap_or_default()
        })
        .collect();
    let book_of = |v: u32| d.vz.locate(v).map(|(b, _, _)| b);
    let well_formed = sets.iter().all(|s| {
        s.len() >= 5
            && s.len() % 2 == 1
            && (s[0] as usize) < KINDS.len()
            && s[1..]
                .chunks(2)
                .all(|p| p[0] <= p[1] && p[1] < n && book_of(p[0]) == book_of(p[1]))
    });
    let mut out = vec![
        (
            doc["format"] == 1 && doc["kinds"] == json!(KINDS),
            "parallels.json is format 1 with the seven kinds".to_string(),
        ),
        (
            sets.len() > 250,
            format!("{} sets of parallel passages", sets.len()),
        ),
        (
            well_formed,
            "every parallel passage is a run of real verses in one book, two or more to a set"
                .to_string(),
        ),
    ];

    // Each book's detail file has every set of that book, with one entry per
    // pair whose rows use up both passages exactly.
    let mut details: HashMap<u8, Value> = HashMap::new();
    let mut complete = true;
    for (id, s) in sets.iter().enumerate() {
        let passages: Vec<Span> = s[1..].chunks(2).map(|p| (p[0], p[1])).collect();
        for p in &passages {
            let b = book_of(p.0).ok_or("verse out of range")?;
            if let std::collections::hash_map::Entry::Vacant(e) = details.entry(b) {
                e.insert(read_json(
                    &d.dir.join(format!("{DIR}/{}.json", BOOKS[b as usize].osis)),
                )?);
            }
            let set = &details[&b]["sets"][id.to_string()];
            let pairs = set["pairs"]
                .as_array()
                .map(Vec::as_slice)
                .unwrap_or_default();
            let apart_ok = set["apart"].as_array().is_some_and(|rows| {
                rows.iter().all(|r| {
                    let (from, to) = (r[0].as_u64(), r[1].as_u64());
                    matches!((from, to), (Some(f), Some(t)) if f <= t && t < u64::from(n))
                        && r[2].as_str().is_some_and(|why| !why.is_empty())
                })
            });
            complete &= apart_ok
                && set["titles"].as_array().map(Vec::len) == Some(passages.len())
                && pairs.len() == passages.len() * (passages.len() - 1) / 2
                && pairs.iter().all(|pair| {
                    let (i, j) = (
                        pair[0].as_u64().unwrap_or(99) as usize,
                        pair[1].as_u64().unwrap_or(99) as usize,
                    );
                    let rows: Vec<u64> = pair[4]
                        .as_array()
                        .map(|r| r.iter().filter_map(Value::as_u64).collect())
                        .unwrap_or_default();
                    let used = |k: usize| rows.iter().skip(k).step_by(2).sum::<u64>();
                    i < j
                        && j < passages.len()
                        && used(0) == u64::from(passages[i].1 - passages[i].0 + 1)
                        && used(1) == u64::from(passages[j].1 - passages[j].0 + 1)
                });
        }
    }
    out.push((
        complete,
        "each book's parallels file lines up every pair of every set it holds".to_string(),
    ));

    // Well-known parallels, as verses that must share a set.
    let together = |a: u32, b: u32| {
        sets.iter().any(|s| {
            let at = |v: u32| s[1..].chunks(2).position(|p| p[0] <= v && v <= p[1]);
            matches!((at(a), at(b)), (Some(i), Some(j)) if i != j)
        })
    };
    for (a, b, what) in [
        (
            "Mark 2:5",
            "Matt 9:2",
            "the healing of the paralysed man (Mark 2, Matthew 9)",
        ),
        (
            "Mark 2:5",
            "Luke 5:20",
            "the healing of the paralysed man (Mark 2, Luke 5)",
        ),
        (
            "John 6:11",
            "Matt 14:19",
            "the feeding of the five thousand (John 6, Matthew 14)",
        ),
        (
            "John 6:11",
            "Mark 6:41",
            "the feeding of the five thousand (John 6, Mark 6)",
        ),
        (
            "John 6:11",
            "Luke 9:16",
            "the feeding of the five thousand (John 6, Luke 9)",
        ),
        (
            "Matt 6:9",
            "Luke 11:2",
            "the Lord's Prayer (Matthew 6, Luke 11)",
        ),
        (
            "Exod 20:3",
            "Deut 5:7",
            "the Ten Commandments (Exodus 20, Deuteronomy 5)",
        ),
        (
            "Ps 18:2",
            "2 Sam 22:2",
            "David's song (Psalm 18, 2 Samuel 22)",
        ),
        (
            "Isa 2:4",
            "Mic 4:3",
            "swords into ploughshares (Isaiah 2, Micah 4)",
        ),
        (
            "Ps 14:1",
            "Ps 53:1",
            "the fool says there is no God (Psalms 14 and 53)",
        ),
        (
            "Ps 96:1",
            "1 Chr 16:23",
            "sing to the LORD, all the earth (Psalm 96, 1 Chronicles 16)",
        ),
        (
            "Isa 36:1",
            "2 Kgs 18:13",
            "Sennacherib's invasion (Isaiah 36, 2 Kings 18)",
        ),
        (
            "Jer 52:31",
            "2 Kgs 25:27",
            "Jehoiachin released (Jeremiah 52, 2 Kings 25)",
        ),
        (
            "Ezra 2:1",
            "Neh 7:6",
            "the list of returning exiles (Ezra 2, Nehemiah 7)",
        ),
        (
            "Jude 1:6",
            "2 Pet 2:4",
            "the angels kept in chains (Jude, 2 Peter 2)",
        ),
        (
            "Eph 6:21",
            "Col 4:7",
            "Tychicus sent with news (Ephesians 6, Colossians 4)",
        ),
    ] {
        let (x, _) = d.resolve(a)?;
        let (y, _) = d.resolve(b)?;
        out.push((together(x, y), format!("parallels include {what}")));
    }
    let (call, _) = d.resolve("Mark 1:16")?;
    let (jordan, _) = d.resolve("John 1:35")?;
    out.push((
        !together(call, jordan),
        "parallels keep the call by the lake (Mark 1) apart from the meeting by the Jordan (John 1)"
            .to_string(),
    ));
    // Two parts of one account are never shown as parallels of each other.
    for (a, b, what) in [
        (
            "Mark 11:13",
            "Mark 11:21",
            "the fig tree cursed and found withered (Mark 11)",
        ),
        (
            "John 18:17",
            "John 18:25",
            "Peter's first and later denials (John 18)",
        ),
        (
            "Isa 38:1",
            "Isa 38:21",
            "Hezekiah's illness and the figs (Isaiah 38)",
        ),
        (
            "Ps 106:1",
            "Ps 106:47",
            "the opening and closing lines of Psalm 106",
        ),
        (
            "2 Chr 14:2",
            "2 Chr 15:16",
            "Asa's reign and his reforms (2 Chronicles 14 and 15)",
        ),
    ] {
        let (x, _) = d.resolve(a)?;
        let (y, _) = d.resolve(b)?;
        out.push((
            !together(x, y),
            format!("parallels keep the parts of one account apart: {what}"),
        ));
    }
    // The panel can say why a passage some link with a set is not in it.
    let (temple, _) = d.resolve("Mark 11:15")?;
    let (john, _) = d.resolve("John 2:13")?;
    let says_why = sets.iter().enumerate().any(|(id, s)| {
        s[1..].chunks(2).any(|p| p[0] <= temple && temple <= p[1])
            && book_of(temple)
                .and_then(|b| details.get(&b))
                .and_then(|doc| doc["sets"][id.to_string()]["apart"].as_array().cloned())
                .is_some_and(|rows| {
                    rows.iter().any(|r| {
                        r[0].as_u64().is_some_and(|f| f <= u64::from(john))
                            && r[1].as_u64().is_some_and(|t| u64::from(john) <= t)
                    })
                })
    });
    out.push((
        says_why,
        "parallels say why John 2 is not counted with the temple cleansing in Mark 11".to_string(),
    ));
    let (rom, _) = d.resolve("Rom 8:28")?;
    out.push((
        !sets
            .iter()
            .any(|s| s[1..].chunks(2).any(|p| p[0] <= rom && rom <= p[1])),
        "Romans 8:28 has no parallel passage".to_string(),
    ));

    // The rows line up the verses that say the same thing.
    for (a, b, what) in [
        (
            "Matt 6:11",
            "Luke 11:3",
            "daily bread (Matthew 6:11, Luke 11:3)",
        ),
        (
            "Exod 20:13",
            "Deut 5:17",
            "you shall not murder (Exodus 20:13, Deuteronomy 5:17)",
        ),
        (
            "Mark 2:11",
            "Matt 9:6",
            "take up your mat (Mark 2:11, Matthew 9:6)",
        ),
        (
            "Isa 2:4",
            "Mic 4:3",
            "swords into ploughshares (Isaiah 2:4, Micah 4:3)",
        ),
        (
            "Mark 9:1",
            "Luke 9:27",
            "some standing here will not taste death (Mark 9:1, Luke 9:27)",
        ),
        (
            "2 Kgs 20:7",
            "Isa 38:21",
            "the poultice of figs (2 Kings 20:7, Isaiah 38:21)",
        ),
    ] {
        let (x, _) = d.resolve(a)?;
        let (y, _) = d.resolve(b)?;
        out.push((
            lined_up(&sets, &details, &book_of, x, y),
            format!("parallels line up {what}"),
        ));
    }
    Ok(out)
}

/// Whether verse x and verse y fall in the same row of a set's alignment.
fn lined_up(
    sets: &[Vec<u32>],
    details: &HashMap<u8, Value>,
    book_of: &dyn Fn(u32) -> Option<u8>,
    x: u32,
    y: u32,
) -> bool {
    sets.iter().enumerate().any(|(id, s)| {
        let passages: Vec<Span> = s[1..].chunks(2).map(|p| (p[0], p[1])).collect();
        let at = |v: u32| passages.iter().position(|p| p.0 <= v && v <= p.1);
        let (Some(i), Some(j)) = (at(x), at(y)) else {
            return false;
        };
        let Some(detail) = book_of(x).and_then(|b| details.get(&b)) else {
            return false;
        };
        let pairs = detail["sets"][id.to_string()]["pairs"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        pairs.iter().any(|pair| {
            let (pi, pj) = (pair[0].as_u64(), pair[1].as_u64());
            let (first, second, vf, vs) = if (pi, pj) == (Some(i as u64), Some(j as u64)) {
                (passages[i], passages[j], x, y)
            } else if (pi, pj) == (Some(j as u64), Some(i as u64)) {
                (passages[j], passages[i], y, x)
            } else {
                return false;
            };
            let rows: Vec<u32> = pair[4]
                .as_array()
                .map(|r| {
                    r.iter()
                        .filter_map(|n| n.as_u64().map(|n| n as u32))
                        .collect()
                })
                .unwrap_or_default();
            let (mut a, mut b) = (first.0, second.0);
            rows.chunks(2).any(|r| {
                let hit = r[0] > 0
                    && r[1] > 0
                    && (a..a + r[0]).contains(&vf)
                    && (b..b + r[1]).contains(&vs);
                a += r[0];
                b += r[1];
                hit
            })
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 66 books of five chapters of 30 verses, except one-chapter books.
    fn vz() -> Versification {
        let counts: Vec<Vec<u16>> = BOOKS
            .iter()
            .map(|b| {
                if matches!(b.osis, "Obad" | "Phlm" | "2John" | "3John" | "Jude") {
                    vec![30]
                } else {
                    vec![30; 5]
                }
            })
            .collect();
        Versification::from_counts(&counts)
    }

    #[test]
    fn content_words() {
        assert!(content("HVqp3ms"));
        assert!(content("HC/Vqw3ms"));
        assert!(content("HTd/Ncmpa"));
        assert!(!content("HC"));
        assert!(!content("HTo"));
        assert!(content("V-AAI-3S"));
        assert!(content("N-NSF"));
        assert!(content("A-NSM"));
        assert!(!content("T-NSM"));
        assert!(!content("CONJ"));
        assert!(!content(""));
    }

    #[test]
    fn english_words() {
        assert_eq!(
            english("And the kings of Davidʼs house went out."),
            vec!["david", "hous", "king", "went"]
        );
        assert_eq!(
            english("“Son, your sins are forgiven.”"),
            vec!["forgiven", "sin", "son"]
        );
        for (a, b) in [
            ("kings", "king"),
            ("houses", "house"),
            ("loved", "love"),
            ("cities", "city"),
            ("carried", "carries"),
            ("healing", "heals"),
            ("blessed", "blesses"),
            ("hundreds", "hundred"),
        ] {
            assert_eq!(stem(a), stem(b), "{a} and {b}");
        }
        for (a, b) in [("seed", "see"), ("sing", "sin"), ("goods", "god")] {
            assert_ne!(stem(a), stem(b), "{a} and {b}");
        }
    }

    #[test]
    fn passages_must_be_bsb_verses() {
        let vz = vz();
        assert_eq!(
            passage("Mark 2:1-12", &vz),
            Ok((vz.index(40, 2, 1).unwrap(), vz.index(40, 2, 12).unwrap()))
        );
        assert_eq!(
            passage("1Chr 4:29-5:3", &vz),
            Ok((vz.index(12, 4, 29).unwrap(), vz.index(12, 5, 3).unwrap()))
        );
        assert_eq!(
            passage("Jude 1:4", &vz),
            Ok((vz.index(64, 1, 4).unwrap(), vz.index(64, 1, 4).unwrap()))
        );
        assert!(passage("Mark 2", &vz).is_err(), "a whole chapter");
        assert!(passage("Mark 2:12-1", &vz).is_err(), "backwards");
        assert!(passage("Mark 2:31", &vz).is_err(), "no such verse");
        assert!(passage("Mark 9:1", &vz).is_err(), "no such chapter");
        assert!(passage("Marcus 2:1", &vz).is_err(), "not an OSIS id");
    }

    #[test]
    fn heading_text() {
        assert_eq!(
            clean("The \\nd Lord\\nd* Provides the Sacrifice"),
            "The LORD Provides the Sacrifice"
        );
        assert_eq!(clean("Jesus Heals a Paralytic"), "Jesus Heals a Paralytic");
    }

    #[test]
    fn reads_headings() {
        let vz = vz();
        let usfm = "\u{feff}\\id MRK\n\\c 2\n\\s1 Jesus Heals a Paralytic\n\\r (Matthew 4:1–8; Luke 5:17–26; Joshua–Malachi)\n\\p\n\\v 1 A few days later.\n\\v 2 So many gathered\n\\s1 The Calling of Levi\n\\r (Matthew 3:9–13)\n\\v 13 Once again\n\\c 3\n\\v 1 Another time\n";
        assert_eq!(usfm_book(usfm, Path::new("x.usfm")), Some(40));
        assert_eq!(usfm_book("\\c 1", Path::new("21ECCBSB.usfm")), Some(20));
        assert_eq!(usfm_book("\\c 1", Path::new("42MRKBSB.usfm")), Some(40));
        let (hs, unread) = headings(usfm, 40, &vz);
        assert_eq!(unread, 1);
        assert_eq!(hs.len(), 2);
        assert_eq!(hs[0].title, "Jesus Heals a Paralytic");
        assert_eq!(
            (hs[0].from, hs[0].to),
            (vz.index(40, 2, 1).unwrap(), vz.index(40, 2, 12).unwrap())
        );
        assert_eq!(
            hs[0].refs,
            vec![
                passage("Matt 4:1-8", &vz).unwrap(),
                passage("Luke 5:17-26", &vz).unwrap()
            ]
        );
        assert_eq!(
            (hs[1].from, hs[1].to),
            (vz.index(40, 2, 13).unwrap(), vz.index(40, 5, 30).unwrap())
        );
    }

    #[test]
    fn lines_up_verses() {
        let idf = vec![4.0; 20];
        // The same three verses: one row each.
        let a = vec![vec![1, 2], vec![3, 4], vec![5, 6]];
        assert_eq!(align(&a, &a, &idf), vec![(1, 1), (1, 1), (1, 1)]);
        // b tells a's first two verses in one, and has a verse of its own.
        let b = vec![vec![1, 2, 3, 4], vec![10, 11], vec![5, 6]];
        assert_eq!(align(&a, &b, &idf), vec![(2, 1), (0, 1), (1, 1)]);
        // Nothing in common: every verse stands alone.
        let c = vec![vec![12], vec![13]];
        let rows = align(&a, &c, &idf);
        assert!(rows.iter().all(|&(x, y)| x == 0 || y == 0));
        assert_eq!(rows.iter().map(|r| r.0).sum::<usize>(), 3);
        assert_eq!(rows.iter().map(|r| r.1).sum::<usize>(), 2);
    }

    #[test]
    fn shares() {
        let idf = vec![1.0; 10];
        assert!((root_share(&[1, 2], &[1, 2, 3, 4], &idf) - 1.0).abs() < 1e-9);
        assert_eq!(weights(&[1, 2, 5], &[1, 2, 3, 4], &idf), (2.0, 3.0, 4.0));
        assert_eq!(root_share(&[], &[1], &idf), 0.0);
        let w = |s: &[&str]| s.iter().map(|x| x.to_string()).collect::<Vec<_>>();
        assert!(
            (word_share(&w(&["bread", "daily"]), &w(&["bread", "daily", "give"])) - 1.0).abs()
                < 1e-9
        );
    }
}
