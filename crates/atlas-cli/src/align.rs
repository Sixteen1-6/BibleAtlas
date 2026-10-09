//! Word alignment: which English words of the BSB came from which Hebrew,
//! Aramaic or Greek word. The links come from the hand-made alignments in
//! Clear-Bible/Alignments (CC BY 4.0): the Hebrew side is the WLC as tokenized
//! by Macula (one token per prefix, stem and suffix), the Greek side is the
//! Berean Greek New Testament, and the English side is the BSB split into
//! words.
//!
//! Those texts are not the exact editions the atlas shows, so both ends are
//! matched before any link is kept:
//! - source words are paired with TAHOT/TAGNT words in the same verse by
//!   longest common subsequence (Hebrew consonants, or Greek Strong's numbers),
//! - English tokens are paired with the words of the atlas's BSB verse the
//!   same way (the BSB has had small revisions since the alignment was made).
//!
//! Anything that does not match is left out rather than guessed, and the
//! build prints how much was kept.
//!
//! In some verses the alignment names its English words by positions in an
//! older revision of the BSB (a comma or a word added or removed since), so
//! from some point on every link lands a word or two off: δόξαν "glory" on
//! "and" in Revelation 5:12, שֹׁפֵט "Judge" on "of all" in Genesis 18:25,
//! חַנּוּן "gracious" on "gracious slow" in Exodus 34:6.
//! [`shifted_links`] finds those stretches and leaves their links out.

use crate::parse::{consonants, Word, WordsByVerse};
use atlas_core::Versification;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// One verse's links. Groups are numbered from 0 in English reading order;
/// -1 means "no partner" (an English word the translator supplied, or an
/// original word the English does not render).
pub struct VerseAlign {
    /// Group of each English word, as split by [`english_words`].
    pub english: Vec<i32>,
    /// Per original word: the group of each of its pieces (one entry when the
    /// word is not split into prefixes and suffixes).
    pub words: Vec<Vec<i32>>,
}

impl VerseAlign {
    /// `{"e": [g, ...], "w": [g | [[surface, gloss, g], ...], ...]}`: a word
    /// split into prefixes and suffixes lists its pieces, so the reader can
    /// show and color each one.
    pub fn to_json(&self, words: &[Word]) -> Value {
        let w: Vec<Value> = self
            .words
            .iter()
            .zip(words)
            .map(|(g, w)| match w.pieces.len() {
                0 | 1 => json!(g[0]),
                _ => Value::Array(w.pieces.iter().zip(g).map(|((s, gl), g)| json!([s, gl, g])).collect()),
            })
            .collect();
        json!({ "e": self.english, "w": w })
    }
}

#[derive(Default, Debug)]
pub struct AlignTally {
    pub records: usize,
    pub kept: usize,
    pub source_unmatched: usize,
    pub source_total: usize,
    pub english_unmatched: usize,
    pub english_total: usize,
    pub verses: usize,
    /// Links left out because their English positions look shifted, and the
    /// verses they are in.
    pub shifted: usize,
    pub shifted_verses: usize,
}

/// The atlas's English word split, shared with the browser
/// (`web/src/data/align.ts`): runs of letters and digits, joined across an
/// apostrophe or hyphen that has a letter or digit on both sides.
pub fn english_words(s: &str) -> Vec<&str> {
    let b: Vec<(usize, char)> = s.char_indices().collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i < b.len() {
        if !b[i].1.is_alphanumeric() {
            i += 1;
            continue;
        }
        let start = b[i].0;
        let mut j = i + 1;
        loop {
            while j < b.len() && b[j].1.is_alphanumeric() {
                j += 1;
            }
            if j + 1 < b.len() && matches!(b[j].1, '\'' | '’' | '-') && b[j + 1].1.is_alphanumeric() {
                j += 1;
                continue;
            }
            break;
        }
        let end = if j < b.len() { b[j].0 } else { s.len() };
        out.push(&s[start..end]);
        i = j;
    }
    out
}

/// Longest common subsequence of `a` and `b`, as index pairs. Runs of
/// unmatched items of equal length between two matches are paired in order
/// too (a ketiv/qere spelling or a revised word sits between two anchors).
fn pair<T: PartialEq>(a: &[T], b: &[T]) -> Vec<(usize, usize)> {
    let (n, m) = (a.len(), b.len());
    let mut dp = vec![0u16; (n + 1) * (m + 1)];
    let at = |i: usize, j: usize| i * (m + 1) + j;
    for i in (0..n).rev() {
        for j in (0..m).rev() {
            dp[at(i, j)] = if a[i] == b[j] { dp[at(i + 1, j + 1)] + 1 } else { dp[at(i + 1, j)].max(dp[at(i, j + 1)]) };
        }
    }
    let mut anchors = Vec::new();
    let (mut i, mut j) = (0, 0);
    while i < n && j < m {
        if a[i] == b[j] {
            anchors.push((i, j));
            i += 1;
            j += 1;
        } else if dp[at(i + 1, j)] >= dp[at(i, j + 1)] {
            i += 1;
        } else {
            j += 1;
        }
    }
    let mut out = Vec::with_capacity(n.min(m));
    let (mut pi, mut pj) = (0, 0);
    for &(ai, aj) in anchors.iter().chain(std::iter::once(&(n, m))) {
        if ai - pi == aj - pj {
            out.extend((0..ai - pi).map(|k| (pi + k, pj + k)));
        }
        if ai < n {
            out.push((ai, aj));
        }
        (pi, pj) = (ai + 1, aj + 1);
    }
    out
}

#[derive(Deserialize)]
struct AlignFile {
    records: Vec<Record>,
}
#[derive(Deserialize)]
struct Record {
    source: Vec<String>,
    target: Vec<String>,
}

/// (book index, chapter, verse).
type Bcv = (u8, u16, u16);
/// Verse -> (word number, number of parts, match key), in order.
type SourceVerses = HashMap<Bcv, Vec<(u32, u8, String)>>;
/// (Hebrew side?, verse in the alignment's numbering).
type SourceVerse = (bool, Bcv);

fn read(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("reading {}: {e}", path.display()))
}

fn num(s: &str) -> Option<u32> {
    s.parse().ok()
}

/// "BBCCCVVV..." -> (book index, chapter, verse).
fn bcv(id: &str) -> Option<Bcv> {
    let b: u8 = id.get(0..2)?.parse().ok()?;
    Some((b.checked_sub(1)?, id.get(2..5)?.parse().ok()?, id.get(5..8)?.parse().ok()?))
}

/// Source tokens of one alignment source file (`id\taltId\ttext\tstrongs...`),
/// grouped as verse -> words -> parts. Ids are "o" + BBCCCVVVWWWP (Hebrew,
/// one token per part) or "n" + BBCCCVVVWWW (Greek, whole words).
struct SourceText {
    verses: SourceVerses,
    /// Token id (the digits after "o" or "n") -> Strong's number as written.
    strong: HashMap<u64, String>,
}

fn source_text(path: &Path, hebrew: bool) -> Result<SourceText, String> {
    let mut verses = SourceVerses::new();
    let mut strongs = HashMap::new();
    for line in read(path)?.lines().skip(1) {
        let cols: Vec<&str> = line.split('\t').collect();
        let id = cols[0];
        let (Some(v), Some(text), Some(strong)) = (bcv(&id[1..]), cols.get(2), cols.get(3)) else { continue };
        let Some(w) = id.get(9..12).and_then(num) else { continue };
        if let Ok(tid) = id[1..].parse::<u64>() {
            strongs.insert(tid, strong.to_string());
        }
        let list = verses.entry(v).or_default();
        if hebrew {
            match list.last_mut() {
                Some(last) if last.0 == w => {
                    last.1 += 1;
                    last.2.push_str(&consonants(text));
                }
                _ => list.push((w, 1, consonants(text))),
            }
        } else {
            list.push((w, 1, strong.get(..5).unwrap_or(strong).to_string()));
        }
    }
    Ok(SourceText { verses, strong: strongs })
}

/// The Greek words the Septuagint uses for each Hebrew word of the atlas, as
/// MACULA Hebrew records them (its `greekstrong` column, one per part of a
/// word): atlas (verse, word index) -> Strong's numbers, without the "G".
///
/// MACULA tokenizes the WLC as the alignment source does, so its words are
/// matched to TAHOT's the same way: by consonants, in the Hebrew Bible's own
/// verse numbering. As `pair` does, an equal run of unmatched words between
/// two matches is paired in order (which keeps a ketiv with its qere); a word
/// left unpaired gets nothing.
pub fn septuagint_words(macula: &Path, words: &[Vec<Word>]) -> Result<HashMap<(u32, u32), Vec<u32>>, String> {
    let text = read(macula)?;
    let mut lines = text.lines();
    let head: Vec<&str> = lines.next().unwrap_or("").split('\t').collect();
    let col = |name: &str| head.iter().position(|h| *h == name).ok_or_else(|| format!("{}: no '{name}' column", macula.display()));
    let (c_id, c_text, c_greek) = (col("xml:id")?, col("text")?, col("greekstrong")?);
    // verse -> words as (word number, consonants, Greek numbers)
    let mut theirs: HashMap<Bcv, Vec<(u32, String, Vec<u32>)>> = HashMap::new();
    for line in lines {
        let cols: Vec<&str> = line.split('\t').collect();
        let (Some(id), Some(t)) = (cols.get(c_id), cols.get(c_text)) else { continue };
        let (Some(v), Some(w)) = (id.get(1..).and_then(bcv), id.get(9..12).and_then(num)) else { continue };
        let greek: Vec<u32> = cols.get(c_greek).map_or("", |g| g).split('|').filter_map(|g| g.trim().parse().ok()).collect();
        let list = theirs.entry(v).or_default();
        match list.last_mut() {
            Some(last) if last.0 == w => {
                last.1.push_str(&consonants(t));
                last.2.extend(greek);
            }
            _ => list.push((w, consonants(t), greek)),
        }
    }
    let mut ours: HashMap<Bcv, Vec<(u32, u32)>> = HashMap::new();
    for (v, ws) in words.iter().enumerate() {
        for (i, w) in ws.iter().enumerate() {
            if let Some(sv) = w.src_verse {
                ours.entry(sv).or_default().push((v as u32, i as u32));
            }
        }
    }
    let mut out = HashMap::new();
    for (sv, th) in &theirs {
        let Some(us) = ours.get(sv) else { continue };
        let a: Vec<&str> = th.iter().map(|t| t.1.as_str()).collect();
        let b: Vec<&str> = us.iter().map(|&(v, i)| words[v as usize][i as usize].key.as_str()).collect();
        for (i, j) in pair(&a, &b) {
            if !th[i].2.is_empty() {
                let mut g = th[i].2.clone();
                g.dedup();
                out.insert(us[j], g);
            }
        }
    }
    Ok(out)
}

/// One alignment link as [`shifted_links`] reads it: the Strong's numbers of
/// its original words (interned) and its English token ids (BBCCCVVVWWW).
struct Fit {
    strongs: Vec<u32>,
    targets: Vec<u64>,
}

/// Offsets tried, in English words, for a stretch of links.
const SHIFTS: [i64; 7] = [-3, -2, -1, 0, 1, 2, 3];
/// Where offset 0 sits in `SHIFTS`.
const NO_SHIFT: usize = 3;
/// What changing the offset costs (also starting a verse at a non-zero one),
/// against a link's fit of 0 to 1. Lower finds more shifted stretches, and
/// below about 0.4 it starts to mistake an ordinary reordering for one.
const SHIFT_COST: f64 = 0.4;
/// What an English function word ("the", "and", "of", ...) counts for in a
/// link's fit, against 1 for any other word. Such words follow almost every
/// original word somewhere, so they say little about where a link belongs:
/// without this, an article in a link fits the "the" two words before its
/// noun better than the noun fits its own word.
const SMALL_WEIGHT: f64 = 0.3;
/// The English function words `SMALL_WEIGHT` applies to (the same list as
/// `SMALL` in web/src/data/themes.ts).
const SMALL_WORDS: &str = "a an the and of to in on at by for with from into onto upon or but nor as so than that which who whom whose this these those \
    it its he him his she her they them their we us our you your i me my is are was were be been being am shall will would should \
    may might can could do does did has have had not no then there here when where what how also all";

/// Which links name English positions of an older BSB revision.
///
/// First a table of how often each Strong's number is linked to each English
/// word is counted over the whole alignment, which is right almost
/// everywhere. A link's fit at an offset of d words is then, per English
/// token, the share of its Strong's number's links that reach the word d
/// words away in the verse (the best of its numbers; punctuation is not
/// counted as a word), times `SMALL_WEIGHT` for a function word, averaged
/// over the link's tokens. A punctuation mark or a missing token fits 0 where
/// it is. Each verse's links, in English order, get the offsets with the best
/// total fit, where changing the offset costs `SHIFT_COST`. When that beats
/// leaving every link where it is, the links given another offset are
/// marked: the caller leaves them out rather than moving them, because where
/// they belong is only a guess.
///
/// Offsets count words, not token ids, because a revision that added or
/// dropped a comma moves the ids of the words after it but not their order:
/// in Exodus 34:6 every link from the second יְהוָה on names the word after
/// its own, though the ids are one or two off.
fn shifted_links(fits: &[Fit], token_word: &HashMap<u64, u32>, small: &[bool]) -> Vec<bool> {
    let strongs = fits.iter().flat_map(|f| f.strongs.iter()).max().map_or(0, |&m| m as usize + 1);
    let mut totals = vec![0u32; strongs];
    let mut pairs: HashMap<(u32, u32), u32> = HashMap::new();
    for f in fits {
        let mut words: Vec<u32> = f.targets.iter().filter_map(|t| token_word.get(t).copied()).collect();
        words.sort_unstable();
        words.dedup();
        for &s in &f.strongs {
            totals[s as usize] += 1;
            for &w in &words {
                *pairs.entry((s, w)).or_default() += 1;
            }
        }
    }
    // Each verse's word tokens, in order (the verse is the token id / 1000).
    let mut verse_words: HashMap<u64, Vec<u64>> = HashMap::new();
    for &t in token_word.keys() {
        verse_words.entry(t / 1000).or_default().push(t);
    }
    for list in verse_words.values_mut() {
        list.sort_unstable();
    }
    // The word `d` words away from token `t` (a word or a punctuation mark).
    let word_at = |t: u64, d: i64| -> Option<u32> {
        if d == 0 {
            return token_word.get(&t).copied();
        }
        let list = verse_words.get(&(t / 1000))?;
        // Words before t: t's own place if it is a word, else the next word's.
        let p = list.partition_point(|&x| x < t) as i64;
        let q = if d < 0 || token_word.contains_key(&t) { p + d } else { p + d - 1 };
        let u = *list.get(usize::try_from(q).ok()?)?;
        token_word.get(&u).copied()
    };
    let fit = |f: &Fit, d: i64| -> f64 {
        if f.targets.is_empty() {
            return 0.0;
        }
        let sum: f64 = f
            .targets
            .iter()
            .map(|&t| {
                word_at(t, d).map_or(0.0, |w| {
                    let share = f.strongs.iter().map(|&s| *pairs.get(&(s, w)).unwrap_or(&0) as f64 / totals[s as usize].max(1) as f64).fold(0.0, f64::max);
                    share * if small.get(w as usize).copied().unwrap_or(false) { SMALL_WEIGHT } else { 1.0 }
                })
            })
            .sum();
        sum / f.targets.len() as f64
    };

    let mut by_verse: HashMap<u64, Vec<usize>> = HashMap::new();
    for (k, f) in fits.iter().enumerate() {
        if let Some(&t) = f.targets.first() {
            by_verse.entry(t / 1000).or_default().push(k);
        }
    }
    let mut out = vec![false; fits.len()];
    for list in by_verse.values_mut() {
        list.sort_by_key(|&k| (fits[k].targets.iter().min().copied(), k));
        let scores: Vec<[f64; 7]> = list.iter().map(|&k| SHIFTS.map(|d| fit(&fits[k], d))).collect();
        // best[j]: the best total with the current link at SHIFTS[j];
        // back[i][j]: the previous link's offset on that best path.
        let mut best = [0.0f64; 7];
        let mut back = vec![[NO_SHIFT; 7]; list.len()];
        for (i, s) in scores.iter().enumerate() {
            let mut next = [0.0f64; 7];
            for j in 0..SHIFTS.len() {
                if i == 0 {
                    next[j] = s[j] - if j == NO_SHIFT { 0.0 } else { SHIFT_COST };
                    continue;
                }
                // Keep the offset unless changing it is strictly better.
                let (mut from, mut total) = (j, best[j]);
                for (e, &b) in best.iter().enumerate() {
                    if b - SHIFT_COST > total {
                        (from, total) = (e, b - SHIFT_COST);
                    }
                }
                next[j] = total + s[j];
                back[i][j] = from;
            }
            best = next;
        }
        let mut j = NO_SHIFT;
        for (e, &b) in best.iter().enumerate() {
            if b > best[j] {
                j = e;
            }
        }
        let unmoved: f64 = scores.iter().map(|s| s[NO_SHIFT]).sum();
        if best[j] <= unmoved + 1e-9 {
            continue;
        }
        for i in (0..list.len()).rev() {
            if j != NO_SHIFT {
                out[list[i]] = true;
            }
            j = back[i][j];
        }
    }
    out
}

pub struct Inputs<'a> {
    pub hebrew_links: &'a Path,
    pub hebrew_source: &'a Path,
    pub greek_links: &'a Path,
    pub greek_source: &'a Path,
    pub english: &'a [&'a Path],
}

/// Build the alignment for every verse that has one.
pub fn build(inp: &Inputs, vz: &Versification, texts: &[String], words: &WordsByVerse, tally: &mut AlignTally) -> Result<Vec<Option<VerseAlign>>, String> {
    let n = vz.verse_count() as usize;

    // English: alignment token id -> (atlas verse, atlas English word index).
    let mut tsv_words: Vec<Vec<(u64, String)>> = vec![Vec::new(); n];
    // Every word token of the alignment's English, by token id (for
    // `shifted_links`), whether or not the atlas has its verse.
    let mut words_seen: HashMap<String, u32> = HashMap::new();
    let mut token_word: HashMap<u64, u32> = HashMap::new();
    for path in inp.english {
        for line in read(path)?.lines().skip(1) {
            let cols: Vec<&str> = line.split('\t').collect();
            let (Some(id), Some(text)) = (cols.first(), cols.get(2)) else { continue };
            if cols.get(4) == Some(&"y") || english_words(text).len() != 1 {
                continue;
            }
            let Ok(tid) = id.parse::<u64>() else { continue };
            let lower = text.to_lowercase();
            let next = words_seen.len() as u32;
            token_word.insert(tid, *words_seen.entry(lower.clone()).or_insert(next));
            let Some(v) = bcv(id).and_then(|(b, c, v)| vz.index(b, c, v)) else { continue };
            tsv_words[v as usize].push((tid, lower));
        }
    }
    let mut english_at: HashMap<u64, (u32, u32)> = HashMap::new();
    let mut english_len = vec![0usize; n];
    for v in 0..n {
        let ours: Vec<String> = english_words(&texts[v]).iter().map(|w| w.to_lowercase()).collect();
        english_len[v] = ours.len();
        let theirs: Vec<&String> = tsv_words[v].iter().map(|(_, t)| t).collect();
        let ours_ref: Vec<&String> = ours.iter().collect();
        for (i, j) in pair(&theirs, &ours_ref) {
            english_at.insert(tsv_words[v][i].0, (v as u32, j as u32));
        }
        tally.english_total += ours.len();
    }

    // Original words: alignment (verse, word number) -> (atlas verse, word index).
    // (source verse, word number) -> (atlas verse, word index, number of parts)
    let mut source_at: HashMap<(SourceVerse, u32), (u32, u32, u8)> = HashMap::new();
    let heb = source_text(inp.hebrew_source, true)?;
    let grk = source_text(inp.greek_source, false)?;
    let mut ours_by_src: HashMap<SourceVerse, Vec<(u32, u32)>> = HashMap::new();
    for (v, ws) in words.iter().enumerate() {
        let Some((b, c, vv)) = vz.locate(v as u32) else { continue };
        for (i, w) in ws.iter().enumerate() {
            let key = match w.src_verse {
                Some(sv) => (true, sv),
                None => (false, (b, c, vv)),
            };
            ours_by_src.entry(key).or_default().push((v as u32, i as u32));
        }
    }
    for (hebrew, st) in [(true, &heb), (false, &grk)] {
        for (sv, theirs) in &st.verses {
            tally.source_total += theirs.len();
            let Some(ours) = ours_by_src.get(&(hebrew, *sv)) else { continue };
            let a: Vec<&str> = theirs.iter().map(|t| t.2.as_str()).collect();
            let b: Vec<&str> = ours.iter().map(|&(v, i)| words[v as usize][i as usize].key.as_str()).collect();
            for (i, j) in pair(&a, &b) {
                source_at.insert(((hebrew, *sv), theirs[i].0), (ours[j].0, ours[j].1, theirs[i].1));
            }
        }
    }
    tally.source_unmatched = tally.source_total - source_at.len();

    // Links, grouped per atlas verse.
    struct Link {
        english: Vec<u32>,
        pieces: Vec<(u32, Option<u8>)>,
    }
    let mut links: Vec<Vec<Link>> = (0..n).map(|_| Vec::new()).collect();
    let mut files: Vec<(bool, AlignFile)> = Vec::new();
    for (path, hebrew) in [(inp.hebrew_links, true), (inp.greek_links, false)] {
        files.push((hebrew, serde_json::from_str(&read(path)?).map_err(|e| format!("parsing {}: {e}", path.display()))?));
    }
    let records: Vec<(bool, &Record)> = files.iter().flat_map(|(hebrew, f)| f.records.iter().map(move |r| (*hebrew, r))).collect();
    let mut strongs_seen: HashMap<&str, u32> = HashMap::new();
    let fits: Vec<Fit> = records
        .iter()
        .map(|&(hebrew, r)| {
            let names = if hebrew { &heb.strong } else { &grk.strong };
            let mut strongs: Vec<u32> = r
                .source
                .iter()
                .filter_map(|s| names.get(&s.get(1..)?.parse::<u64>().ok()?))
                .map(|name| {
                    let next = strongs_seen.len() as u32;
                    *strongs_seen.entry(name.as_str()).or_insert(next)
                })
                .collect();
            strongs.sort_unstable();
            strongs.dedup();
            Fit { strongs, targets: r.target.iter().filter_map(|t| t.get(..11)?.parse().ok()).collect() }
        })
        .collect();
    let mut small = vec![false; words_seen.len()];
    for w in SMALL_WORDS.split_whitespace() {
        if let Some(&id) = words_seen.get(w) {
            small[id as usize] = true;
        }
    }
    let shifted = shifted_links(&fits, &token_word, &small);
    let mut shifted_in: Vec<u64> = fits.iter().zip(&shifted).filter(|(_, &s)| s).filter_map(|(f, _)| Some(f.targets.first()? / 1000)).collect();
    shifted_in.sort_unstable();
    shifted_in.dedup();
    tally.shifted = shifted.iter().filter(|&&s| s).count();
    tally.shifted_verses = shifted_in.len();
    for (k, &(hebrew, r)) in records.iter().enumerate() {
        tally.records += 1;
        if shifted[k] {
            continue;
        }
        let targets: Vec<(u32, u32)> = r.target.iter().filter_map(|t| t.get(..11)?.parse::<u64>().ok()).filter_map(|t| english_at.get(&t).copied()).collect();
        let Some(&(verse, _)) = targets.first() else { continue };
        let mut pieces = Vec::new();
        for s in &r.source {
            let (Some(sv), Some(w)) = (bcv(&s[1..]), s.get(9..12).and_then(num)) else { continue };
            let Some(&(v, i, parts)) = source_at.get(&((hebrew, sv), w)) else { continue };
            if v != verse {
                continue;
            }
            // Part number within the word (Hebrew only), when the atlas
            // splits the word into the same number of pieces.
            let part = s.get(12..13).and_then(num).and_then(|p| (p as u8).checked_sub(1));
            let split = words[v as usize][i as usize].pieces.len();
            pieces.push((i, part.filter(|_| split as u8 == parts && split > 1)));
        }
        if pieces.is_empty() {
            continue;
        }
        tally.kept += 1;
        let english = targets.iter().filter(|t| t.0 == verse).map(|t| t.1).collect();
        links[verse as usize].push(Link { english, pieces });
    }

    let mut out: Vec<Option<VerseAlign>> = (0..n).map(|_| None).collect();
    for v in 0..n {
        let mut ls = std::mem::take(&mut links[v]);
        if ls.is_empty() {
            continue;
        }
        ls.sort_by_key(|l| l.english.iter().min().copied().unwrap_or(u32::MAX));
        let mut english = vec![-1i32; english_len[v]];
        let mut ws: Vec<Vec<i32>> = words[v].iter().map(|w| vec![-1; w.pieces.len().max(1)]).collect();
        for (g, l) in ls.iter().enumerate() {
            for &e in &l.english {
                english[e as usize] = g as i32;
            }
            for &(i, part) in &l.pieces {
                let w = &mut ws[i as usize];
                match part {
                    Some(p) => w[p as usize] = g as i32,
                    // The whole word: fill the pieces that have no link of their own.
                    None => w.iter_mut().filter(|x| **x < 0).for_each(|x| *x = g as i32),
                }
            }
        }
        tally.english_unmatched += english.iter().filter(|&&g| g < 0).count();
        tally.verses += 1;
        out[v] = Some(VerseAlign { english, words: ws });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_english() {
        assert_eq!(english_words("“Away from Me, Satan!” the LORD’s half-tribe—don't 1,000"), ["Away", "from", "Me", "Satan", "the", "LORD’s", "half-tribe", "don't", "1", "000"]);
        assert_eq!(english_words("end-"), ["end"]);
    }

    #[test]
    fn pairs_with_gaps() {
        assert_eq!(pair(&["a", "b", "c"], &["a", "b", "c"]), [(0, 0), (1, 1), (2, 2)]);
        // "x" and "y" differ but sit between the same anchors.
        assert_eq!(pair(&["a", "x", "c"], &["a", "y", "c"]), [(0, 0), (1, 1), (2, 2)]);
        // An extra word on one side is skipped.
        assert_eq!(pair(&["a", "c"], &["a", "b", "c"]), [(0, 0), (1, 2)]);
        assert!(pair::<&str>(&[], &["a"]).is_empty());
    }

    #[test]
    fn finds_shifted_links() {
        // Words: 0 and, 1 glory, 2 power, 3 riches, 4 the, 5 bank, 6 river,
        // 7 shore, 8 far; "and" and "the" are function words. Strong's 0 to 6
        // are "and", "glory", "power", "riches", the article, "bank" and "river".
        let small = [true, false, false, false, true, false, false, false, false];
        let mut token_word = HashMap::new();
        let mut fits = Vec::new();
        let tid = |verse: u64, word: u64| 1_001_000_000 + verse * 1000 + word;
        let mut verse = |v: u64, words: &[u32], links: &[(&[u32], &[u64])], fits: &mut Vec<Fit>| {
            for (w, &word) in words.iter().enumerate() {
                if word != u32::MAX {
                    token_word.insert(tid(v, w as u64 + 1), word);
                }
            }
            let first = fits.len();
            fits.extend(links.iter().map(|(strongs, at)| Fit { strongs: strongs.to_vec(), targets: at.iter().map(|&w| tid(v, w)).collect() }));
            first
        };
        // Aligned right: "power and riches and glory"; "the river" (the
        // article and the noun in one link); "bank" (Strong's 5), which is
        // more often "shore".
        for v in 1..=20 {
            verse(v, &[2, 0, 3, 0, 1], &[(&[2], &[1]), (&[0], &[2]), (&[3], &[3]), (&[0], &[4]), (&[1], &[5])], &mut fits);
            verse(100 + v, &[4, 6, 5], &[(&[4, 6], &[1, 2]), (&[5], &[3])], &mut fits);
            verse(200 + v, &[7, 7, 7], &[(&[5], &[1]), (&[5], &[2]), (&[5], &[3])], &mut fits);
        }
        let right = fits.len();
        // Numbered one word late from its second link on.
        let late = verse(21, &[2, 0, 3, 0, 1], &[(&[2], &[1]), (&[0], &[3]), (&[3], &[4]), (&[0], &[5]), (&[1], &[6])], &mut fits);
        // The same, with a comma (not a word) after "riches": offsets count
        // words, so the link that skips it is one word off like the rest.
        const COMMA: u32 = u32::MAX;
        let comma = verse(22, &[2, 0, 3, COMMA, 0, 1], &[(&[2], &[1]), (&[0], &[3]), (&[3], &[5]), (&[0], &[6]), (&[1], &[7])], &mut fits);
        // "the river, the far far bank", its last link holding the article,
        // "bank" and "river" (as in Daniel 12:5): right where it is, though
        // the article fits the "the" three words before far better than
        // "bank" fits Strong's 5.
        let bank = verse(23, &[4, 6, COMMA, 4, 8, 8, 5], &[(&[4, 6], &[1, 2]), (&[4, 5, 6], &[7])], &mut fits);
        let got = shifted_links(&fits, &token_word, &small);
        assert!(got[..right].iter().all(|&s| !s), "a right verse is left alone");
        assert_eq!(&got[late..comma], [false, true, true, true, true]);
        assert_eq!(&got[comma..bank], [false, true, true, true, true]);
        assert_eq!(&got[bank..], [false, false]);
    }
}
