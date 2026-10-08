//! Quotations: where the New Testament quotes the Old, and where it echoes it.
//!
//! The links come from the Berean Standard Bible's own footnotes (public
//! domain), read from its USFM edition. In the New Testament a footnote names
//! the Old Testament passage behind quoted words ("Isaiah 40:3 (see also
//! LXX)") or one that they recall ("See Isaiah 7:14"); in the Old Testament a
//! footnote lists where a verse is cited ("Cited in Matthew 3:3"). This module
//! then sorts each link by rules a reader can check in the panel:
//!
//! - a quotation stands in quotation marks and is introduced as one ("it is
//!   written", "to fulfill what was spoken"), or its footnote points to the
//!   Septuagint, or it has five words in a row the same, or repeats the words
//!   nearly word for word, or shares at least three key words, most of its own;
//! - everything else the footnotes point to is an echo.
//!
//! Each note records which rule decided (`r`), so the panel can say why.
//!
//! It also measures how close the English wording is (where a footnote names
//! several passages quoted together, each one against the clauses that come
//! from it), marks the words the two passages share, and pairs Greek words
//! with Hebrew words they often stand for in the Septuagint, using the notes
//! ("[in LXX chiefly for קוֹל]") of Abbott-Smith's lexicon as given in
//! STEPBible's TBESG, with the Hebrew dictionary forms of its TBESH (both CC
//! BY 4.0).
//!
//! Outputs, under web/public/data:
//! - `extras/quotes.json`: `{"format":1,"links":[[ntFrom,ntTo,otFrom,otTo,kind]]}`,
//!   kind 0 for a quotation and 1 for an echo. Small, because it loads with
//!   the first verse a reader selects.
//! - `extras/quotes/notes.json`: the evidence for each link, in the same
//!   order, loaded only when a panel opens.

use crate::loaded::Loaded;
use crate::parse::{self, LexEntry, Word};
use crate::sources::Inputs;
use atlas_core::canon::{BOOKS, FIRST_NT_BOOK};
use atlas_core::{refs, Versification};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::ops::Range;

const OUT: &str = "extras/quotes.json";
const NOTES: &str = "extras/quotes/notes.json";
const SOURCE: &str = "bsb-usfm";

// Flags in a note's `x`.
/// The footnote points to the Septuagint as well ("see also LXX").
const LXX: u8 = 1;
/// The footnote points to the Dead Sea Scrolls ("see also DSS").
const DSS: u8 = 2;
/// The Old Testament verse's own footnote names this passage too.
const BOTH: u8 = 4;
/// The quoted words stand in quotation marks.
const MARKS: u8 = 8;
/// The footnote says "see": the words recall the passage.
const SEE: u8 = 16;
/// The footnote names more than one passage, quoted together.
const JOINED: u8 = 32;
/// Compared with only the part of the quoted words that comes from this
/// passage, one of several the footnote names.
const PART: u8 = 64;

// Why a link is a quotation or an echo, a note's `r`. A quotation is
/// introduced as one ("it is written"),
const BY_FORMULA: u8 = 1;
/// or its footnote points to the Septuagint, which the English cannot check,
const BY_LXX: u8 = 2;
/// or has five words or more in a row the same,
const BY_RUN: u8 = 3;
/// or is word for word,
const BY_WORDS: u8 = 4;
/// or shares at least three key words, most of its own.
const BY_KEYS: u8 = 5;
/// An echo: the footnote says "See",
const ECHO_SEE: u8 = 6;
/// or no quoted words were found at the footnote,
const ECHO_UNMARKED: u8 = 7;
/// or they are not introduced and share too few words,
const ECHO_FEW: u8 = 8;
/// or they share no word with this passage.
const ECHO_NONE: u8 = 9;

/// How many verses back the opening mark of a quotation may be.
const SPAN_VERSES: usize = 12;
/// The same when the footnote stands inside the quoted words, not after them.
const OPEN_VERSES: usize = 3;
/// The most word pairs kept for one link.
const MAX_PAIRS: usize = 12;
/// An echo of a longer passage than this points to a story, not to words.
const ECHO_VERSES: u32 = 5;
/// The longest introduction shown, in chars.
const MAX_FORMULA: usize = 110;

// ---------------------------------------------------------------- USFM

/// One verse of the USFM edition: its words as printed (markers removed, the
/// divine name in capitals, each run of space as one) and its footnotes, each
/// with the place in the words where it stands, in chars.
struct UVerse {
    chapter: u16,
    verse: u16,
    text: Vec<char>,
    notes: Vec<(usize, String)>,
}

/// Lines that hold no verse text: titles, headings, the parallel-passage
/// lines under headings, psalm titles and the letters of acrostic psalms.
const HEADINGS: &[&str] = &[
    "id", "ide", "h", "toc1", "toc2", "toc3", "mt", "mt1", "mt2", "mt3", "ms", "ms1", "ms2", "mr",
    "s", "s1", "s2", "s3", "r", "sp", "d", "qa", "cl", "rem", "sr",
];

fn push_char(text: &mut Vec<char>, c: char) {
    if !c.is_whitespace() {
        text.push(c);
    } else if text.last().is_some_and(|&l| l != ' ') {
        text.push(' ');
    }
}

fn find_seq(cs: &[char], from: usize, pat: &[char]) -> Option<usize> {
    (from..=cs.len().checked_sub(pat.len())?).find(|&i| cs[i..].starts_with(pat))
}

/// The number after `\c` or `\v` (a bridged "3-4" counts as its first verse)
/// and where the text after it starts.
fn read_number(cs: &[char], mut i: usize) -> (Option<u16>, usize) {
    while cs.get(i) == Some(&' ') {
        i += 1;
    }
    let start = i;
    while cs.get(i).is_some_and(char::is_ascii_digit) {
        i += 1;
    }
    let n = cs[start..i].iter().collect::<String>().parse().ok();
    if cs.get(i) == Some(&'-') {
        i += 1;
        while cs.get(i).is_some_and(char::is_ascii_digit) {
            i += 1;
        }
    }
    if cs.get(i) == Some(&' ') {
        i += 1;
    }
    (n, i)
}

fn read_usfm(text: &str) -> Vec<UVerse> {
    let mut out = Vec::new();
    let mut chapter = 0u16;
    let mut cur: Option<UVerse> = None;
    let mut upper = false;
    for line in text.trim_start_matches('\u{feff}').lines() {
        let first = line.split_whitespace().next().unwrap_or("");
        if first
            .strip_prefix('\\')
            .is_some_and(|m| HEADINGS.contains(&m))
        {
            continue;
        }
        let cs: Vec<char> = line.chars().collect();
        let mut i = 0;
        while i < cs.len() {
            if cs[i] != '\\' {
                if let Some(v) = cur.as_mut() {
                    if upper {
                        cs[i].to_uppercase().for_each(|u| push_char(&mut v.text, u));
                    } else {
                        push_char(&mut v.text, cs[i]);
                    }
                }
                i += 1;
                continue;
            }
            let mut j = i + 1;
            while cs
                .get(j)
                .is_some_and(|c| c.is_ascii_alphanumeric() || *c == '+')
            {
                j += 1;
            }
            let name: String = cs[i + 1..j].iter().filter(|&&c| c != '+').collect();
            let closing = cs.get(j) == Some(&'*');
            if closing {
                j += 1;
            }
            match (name.as_str(), closing) {
                ("c", false) => {
                    let (n, k) = read_number(&cs, j);
                    out.extend(cur.take());
                    chapter = n.unwrap_or(0);
                    i = k;
                    continue;
                }
                ("v", false) => {
                    let (n, k) = read_number(&cs, j);
                    out.extend(cur.take());
                    cur = n.map(|verse| UVerse {
                        chapter,
                        verse,
                        text: Vec::new(),
                        notes: Vec::new(),
                    });
                    i = k;
                    continue;
                }
                ("f" | "x", false) => {
                    let end: Vec<char> = format!("\\{name}*").chars().collect();
                    let k = find_seq(&cs, j, &end).unwrap_or(cs.len());
                    if let (Some(v), "f") = (cur.as_mut(), name.as_str()) {
                        let at = v.text.len() - usize::from(v.text.last() == Some(&' '));
                        v.notes.push((at, cs[j..k].iter().collect()));
                    }
                    i = (k + end.len()).min(cs.len());
                    continue;
                }
                ("nd", _) => upper = !closing,
                _ => {}
            }
            // Any other marker: an opening one stands for a space, a closing one for nothing.
            if !closing {
                if let Some(v) = cur.as_mut() {
                    push_char(&mut v.text, ' ');
                }
                if cs.get(j) == Some(&' ') {
                    j += 1;
                }
            }
            i = j;
        }
        if let Some(v) = cur.as_mut() {
            push_char(&mut v.text, ' ');
        }
    }
    out.extend(cur.take());
    for v in &mut out {
        while v.text.last() == Some(&' ') {
            v.text.pop();
        }
    }
    out
}

// ---------------------------------------------------------------- footnotes

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Kind {
    /// The passage the words come from.
    Quote,
    /// "See ...": a passage the words recall.
    See,
    /// "Cited in ...", in the Old Testament: where the verse is quoted.
    Cited,
}

/// A footnote: its words, and each reference in it with what it is.
struct Note {
    plain: String,
    refs: Vec<(Kind, String)>,
}

/// Footnotes that open with these are about other editions of the Greek text.
const VARIANT_LEADS: &[&str] = &[
    "BYZ",
    "TR",
    "SBL",
    "NE",
    "WH",
    "NA",
    "ECM",
    "Tischendorf",
    "Some",
    "Several",
    "Many",
    "Didymus",
];

/// Footnote text without its markers: `\+xt Isaiah 40:3\+xt*` is `Isaiah 40:3`.
fn strip_markers(s: &str) -> String {
    let cs: Vec<char> = s.chars().collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i < cs.len() {
        if cs[i] != '\\' {
            push_char(&mut out, cs[i]);
            i += 1;
            continue;
        }
        let mut j = i + 1;
        while cs
            .get(j)
            .is_some_and(|c| c.is_ascii_alphanumeric() || *c == '+')
        {
            j += 1;
        }
        if cs.get(j) == Some(&'*') {
            j += 1;
        } else {
            push_char(&mut out, ' ');
            if cs.get(j) == Some(&' ') {
                j += 1;
            }
        }
        i = j;
    }
    out.iter().collect::<String>().trim().to_string()
}

fn read_note(body: &str) -> Note {
    // The text after the caller ("+") and the footnote's own reference ("\fr 3:3").
    let ft = match body.find("\\fr ") {
        Some(i) => body[i + 4..].find('\\').map_or("", |j| &body[i + 4 + j..]),
        None => body.trim_start().trim_start_matches('+'),
    };
    let plain = strip_markers(ft);
    let mut refs = Vec::new();
    let first = plain
        .split_whitespace()
        .next()
        .unwrap_or("")
        .trim_end_matches([',', ';']);
    if VARIANT_LEADS.contains(&first) || plain.starts_with("One early") {
        return Note { plain, refs };
    }
    let mut rest = ft;
    let mut prev: Option<Kind> = None;
    while let Some(a) = rest.find("\\+xt ") {
        let Some(b) = rest[a..].find("\\+xt*").map(|b| a + b) else {
            break;
        };
        let pre = strip_markers(&rest[..a]).to_lowercase();
        let kind = if pre.ends_with("cited in") {
            Kind::Cited
        } else if pre.ends_with("see")
            || pre.ends_with("see also")
            || pre.ends_with("see the footnote for")
        {
            Kind::See
        } else {
            match (prev, pre.as_str()) {
                (Some(k), "" | "," | ";" | "and" | ", and") => k,
                _ => Kind::Quote,
            }
        };
        refs.push((kind, rest[a + 5..b].to_string()));
        prev = Some(kind);
        rest = &rest[b + 5..];
    }
    // A "see" counts only in a footnote about these words: one that opens with
    // "See" or "Or" (another way to translate them), or that also names the
    // passage they are quoted from. "Literally ...; see" and "That is, Shavuot
    // (see ...)" explain a word instead.
    if !(plain.starts_with("See ")
        || plain.starts_with("Or ")
        || refs.iter().any(|r| r.0 == Kind::Quote))
    {
        refs.retain(|r| r.0 != Kind::See);
    }
    Note { plain, refs }
}

fn has_word(s: &str, w: &str) -> bool {
    s.split(|c: char| !c.is_alphanumeric()).any(|x| x == w)
}

/// One reference as (book, chapter, verse, end chapter, end verse).
type Ref = (u8, u16, u16, u16, u16);

/// A list of references as footnotes write them: "Deuteronomy 13:5, 17:7,
/// and 24:7", "Isaiah 61:1–2", "Hebrews 9:1 and 18", "Mark 1:2, Luke 7:27".
/// None if any part cannot be read.
fn ref_list(s: &str, one_chapter: impl Fn(u8) -> bool) -> Option<Vec<Ref>> {
    let mut out = Vec::new();
    let mut book: Option<u8> = None;
    let mut chapter: Option<u16> = None;
    for part in s.split([',', ';']).flat_map(|p| p.split(" and ")) {
        let p = part.trim().trim_end_matches('.').trim();
        let mut p = p.strip_prefix("and ").unwrap_or(p).trim();
        if p.is_empty() {
            continue;
        }
        if p.chars().any(char::is_alphabetic) {
            let at = p
                .char_indices()
                .find(|&(i, c)| c.is_ascii_digit() && p[..i].chars().any(char::is_alphabetic))?
                .0;
            book = Some(refs::parse_book(p[..at].trim())?);
            chapter = None;
            p = &p[at..];
        }
        let b = book?;
        let (a, z) = match p.find(['-', '–', '—']) {
            Some(i) => (&p[..i], Some(p[i..].trim_start_matches(['-', '–', '—']))),
            None => (p, None),
        };
        let num = |t: &str| t.trim().parse::<u16>().ok();
        let (c1, v1) = match (a.split_once(':'), chapter) {
            (Some((c, v)), _) => (num(c)?, num(v)?),
            (None, Some(c)) => (c, num(a)?),
            (None, None) if one_chapter(b) => (1, num(a)?),
            (None, None) => return None,
        };
        let (c2, v2) = match z.map(|z| (z, z.split_once(':'))) {
            None => (c1, v1),
            Some((_, Some((c, v)))) => (num(c)?, num(v)?),
            Some((z, None)) => (c1, num(z)?),
        };
        chapter = Some(c2);
        out.push((b, c1, v1, c2, v2));
    }
    (!out.is_empty()).then_some(out)
}

fn resolve(r: Ref, vz: &Versification) -> Option<(u32, u32)> {
    let a = vz.index(r.0, r.1, r.2)?;
    let b = vz.index(r.0, r.3, r.4)?;
    (b >= a).then_some((a, b))
}

// ---------------------------------------------------------------- quoted words

/// Where the quoted words before a footnote are, as (verse in the book, char):
/// `start` is the opening quotation mark, `end` the closing mark (or, when the
/// footnote stands inside the quotation, the footnote's place).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Span {
    start: (usize, usize),
    end: (usize, usize),
    closed: bool,
}

fn opening_of(c: char) -> Option<char> {
    match c {
        '”' => Some('“'),
        '’' => Some('‘'),
        _ => None,
    }
}

fn apostrophe(t: &[char], i: usize) -> bool {
    matches!(t[i], '’' | 'ʼ' | '\'')
        && i > 0
        && i + 1 < t.len()
        && t[i - 1].is_alphabetic()
        && t[i + 1].is_alphabetic()
}

/// The quotation a footnote belongs to: the one that closes right before it,
/// or else the one it stands inside.
fn find_span(book: &[UVerse], k: usize, off: usize) -> Option<Span> {
    let t = &book[k].text;
    let mut i = off.min(t.len());
    while i > 0 && matches!(t[i - 1], ' ' | '?' | '!' | '.' | ',' | ';' | ':' | '—') {
        i -= 1;
    }
    let closed = i > 0 && opening_of(t[i - 1]).is_some() && !apostrophe(t, i - 1);
    let limit = if closed { SPAN_VERSES } else { OPEN_VERSES };
    let mut stack: Vec<char> = Vec::new();
    for kk in (k.saturating_sub(limit)..=k).rev() {
        let tt = &book[kk].text;
        let top = if kk == k { i } else { tt.len() };
        for j in (0..top).rev() {
            let c = tt[j];
            if opening_of(c).is_some() && !apostrophe(tt, j) {
                stack.push(c);
            } else if c == '“' || c == '‘' {
                match stack.last() {
                    Some(&close) if opening_of(close) == Some(c) => {
                        stack.pop();
                        if closed && stack.is_empty() {
                            return Some(Span {
                                start: (kk, j),
                                end: (k, i - 1),
                                closed,
                            });
                        }
                    }
                    None if !closed => {
                        return Some(Span {
                            start: (kk, j),
                            end: (k, i),
                            closed,
                        })
                    }
                    // Marks that do not nest: better no span than a wrong one.
                    _ => return None,
                }
            }
        }
    }
    None
}

/// A list of short quotations under one footnote, as in Romans 13:9: “Do not
/// commit adultery,” “Do not murder,” “Do not steal,” “Do not covet,”. The
/// closed quotations right before the footnote's own in its verse, with only
/// spaces or commas between them and no footnote of their own, belong to it
/// when they share a word with a passage it names (`named`); a crowd's
/// “Blessed is the coming kingdom of our father David!” before “Hosanna in
/// the highest!” does not.
fn with_list(book: &[UVerse], mut s: Span, named: impl Fn(&[char]) -> bool) -> Span {
    if !s.closed {
        return s;
    }
    let (k, uv) = (s.start.0, &book[s.start.0]);
    let t = &uv.text;
    loop {
        let mut i = s.start.1;
        while i > 0 && matches!(t[i - 1], ' ' | ',' | ';') {
            i -= 1;
        }
        if i == 0 || opening_of(t[i - 1]).is_none() || apostrophe(t, i - 1) {
            return s;
        }
        let Some(p) = find_span(book, k, i).filter(|p| p.closed && p.start.0 == k) else {
            return s;
        };
        if uv
            .notes
            .iter()
            .any(|&(at, _)| p.start.1 < at && at <= s.start.1)
            || !named(&t[p.start.1 + 1..p.end.1])
        {
            return s;
        }
        s.start = p.start;
    }
}

/// The words before a quotation that may introduce it: those of its own
/// verse, and the verse before when its own has hardly any.
fn region(book: &[UVerse], s: Span) -> Vec<char> {
    let (k, at) = s.start;
    let own = &book[k].text[..at];
    if tokens(own).len() >= 3 || k == 0 {
        return own.to_vec();
    }
    let mut r = book[k - 1].text.clone();
    r.push(' ');
    r.extend_from_slice(own);
    r
}

/// The first verse of the quoted words, as the USFM edition prints them.
fn opening_words(book: &[UVerse], s: Span) -> &[char] {
    let t = &book[s.start.0].text;
    let end = if s.end.0 == s.start.0 {
        s.end.1
    } else {
        t.len()
    };
    &t[(s.start.1 + 1).min(end)..end]
}

// ---------------------------------------------------------------- introductions

/// Words that introduce a quotation, as patterns over lower-case words: `a|b`
/// is either word, `?` makes a word optional, and `~` stands for up to two
/// other words.
const FORMULAS: &[&str] = &[
    "is|was|been|has|had|have|stands also? written",
    "wrote|writes",
    "fulfill|fulfills|fulfilled|fulfilling|fulfillment",
    "spoken of? through|by",
    "scripture|scriptures",
    "you not|never? even? read",
    "it is|was|has? also? been? said|says|declares|tells",
    "god|lord|spirit who? himself? also? has|had? ever? says|said|say|spoke|speaks|spoken|declares|declared|testifies|swore|promised|foretold|told|calls",
    "he|it also? says|say|declares|testifies|speaks|adds",
    "he has|had|ever said|say|spoken|spoke|promised|sworn|declared",
    "david|isaiah|moses|hosea|joel|jeremiah|samuel|daniel|elijah|solomon|habakkuk|zechariah|micah|malachi|amos ~ says|said|writes|wrote|declares|declared|cries|prophesied|predicted|foretold|spoke|speaks|calls|called|commanded|permitted|gave|testifies|asks|told|tells",
    "prophet|prophets",
    "in the? book|law|psalm|psalms|scroll",
    "law ~ says|said|commands|commanded|requires|states",
    "promise ~ says|said|states|stated",
    "been|was|were told",
    "testified|testifies",
    "again",
];

/// Anyone who "said" the words: an introduction only where no stronger one is.
const SAID: &[&str] = &["also? said|says"];

enum Slot<'a> {
    Any(usize),
    Word(Vec<&'a str>, bool),
}

fn slots(p: &str) -> Vec<Slot<'_>> {
    p.split(' ')
        .map(|s| {
            if s == "~" {
                return Slot::Any(2);
            }
            match s.strip_suffix('?') {
                Some(w) => Slot::Word(w.split('|').collect(), true),
                None => Slot::Word(s.split('|').collect(), false),
            }
        })
        .collect()
}

/// How many words a pattern takes when it matches at the start of `words`.
fn fit(slots: &[Slot], words: &[&str]) -> Option<usize> {
    match slots.split_first() {
        None => Some(0),
        Some((Slot::Any(n), rest)) => (0..=*n)
            .filter(|&k| k <= words.len())
            .find_map(|k| Some(k + fit(rest, &words[k..])?)),
        Some((Slot::Word(alts, optional), rest)) => words
            .first()
            .filter(|w| alts.contains(w))
            .and_then(|_| Some(1 + fit(rest, &words[1..])?))
            .or_else(|| if *optional { fit(rest, words) } else { None }),
    }
}

/// Each place in `words` where an introduction starts, with how many words it takes.
fn formulas_in(words: &[&str], patterns: &[&str]) -> Vec<(usize, usize)> {
    let mut out = Vec::new();
    for p in patterns {
        let s = slots(p);
        out.extend((0..words.len()).filter_map(|i| Some((i, fit(&s, &words[i..])?))));
    }
    out.sort_unstable();
    out
}

fn trimmed(cs: &[char]) -> String {
    cs.iter()
        .collect::<String>()
        .trim()
        .trim_end_matches([' ', ':', ',', ';', '—', '–'])
        .trim()
        .to_string()
}

/// The words that introduce a quotation ("This was to fulfill what the Lord
/// had spoken through the prophet"), found in the sentence that leads into it.
fn find_formula(region: &[char], patterns: &[&str]) -> Option<String> {
    // The last sentence with words in it ("What does the Scripture say?" counts).
    let mut sentence = 0;
    for i in (0..region.len()).rev() {
        let mut j = i + 1;
        while matches!(region.get(j), Some('”' | '’')) {
            j += 1;
        }
        let ends =
            matches!(region[i], '.' | '?' | '!') && region.get(j).is_none_or(|c| c.is_whitespace());
        if ends && !tokens(&region[i + 1..]).is_empty() {
            sentence = i + 1;
            break;
        }
    }
    let toks = tokens(&region[sentence..]);
    let words: Vec<&str> = toks.iter().map(|t| t.word.as_str()).collect();
    // The introduction nearest the quotation.
    let (i, _) = formulas_in(&words, patterns).into_iter().max()?;
    let at = sentence + toks[i].at;
    // From the start of its clause: after the sentence break or an opening mark,
    // or, when that is long, after the last comma before it.
    let mut from = at;
    while from > sentence && !matches!(region[from - 1], '“' | '‘' | '”' | '’' | '(') {
        from -= 1;
    }
    let whole = trimmed(&elided(&region[from..]));
    if whole.chars().count() <= MAX_FORMULA {
        return Some(whole);
    }
    let clause = (from..at)
        .rev()
        .find(|&j| matches!(region[j], ',' | ';' | ':' | '—'))
        .map_or(at, |j| j + 1);
    Some(format!("…{}", trimmed(&elided(&region[clause..]))))
}

/// The words with each quotation of four words or more inside them shortened
/// to “…”: an introduction that runs on through an earlier quotation ("As it
/// is written in Isaiah the prophet: “Behold, I will send My messenger ahead
/// of You …”") then reads "As it is written in Isaiah the prophet: “…”".
fn elided(cs: &[char]) -> Vec<char> {
    let mut out = Vec::with_capacity(cs.len());
    let mut i = 0;
    while i < cs.len() {
        let (open, close) = match cs[i] {
            '“' => ('“', '”'),
            '‘' => ('‘', '’'),
            c => {
                out.push(c);
                i += 1;
                continue;
            }
        };
        let mut depth = 0usize;
        let mut end = None;
        for (j, &c) in cs.iter().enumerate().skip(i + 1) {
            if c == open {
                depth += 1;
            } else if c == close && !apostrophe(cs, j) {
                if depth == 0 {
                    end = Some(j);
                    break;
                }
                depth -= 1;
            }
        }
        match end {
            Some(j) if tokens(&cs[i + 1..j]).len() >= 4 => {
                out.extend([open, '…', close]);
                i = j + 1;
            }
            _ => {
                out.push(open);
                i += 1;
            }
        }
    }
    out
}

/// What introduces the quoted words: an introduction before them, or one at
/// their start in reported speech, or (if `said` is true) anyone who said them.
fn introduction(book: &[UVerse], s: Span, said: bool) -> Option<String> {
    let r = region(book, s);
    find_formula(&r, FORMULAS)
        .or_else(|| find_lead(opening_words(book, s)))
        .or_else(|| if said { find_formula(&r, SAID) } else { None })
}

/// An introduction at the start of the quoted words themselves, in reported
/// speech: “Teacher, Moses wrote for us that if a man’s brother dies …”.
fn find_lead(words_of_span: &[char]) -> Option<String> {
    let toks = tokens(words_of_span);
    let words: Vec<&str> = toks.iter().map(|t| t.word.as_str()).collect();
    let (i, n) = formulas_in(&words, FORMULAS)
        .into_iter()
        .find(|&(i, _)| i < 8)?;
    let that = (i + n..(i + n + 3).min(words.len())).find(|&j| words[j] == "that")?;
    Some(trimmed(&words_of_span[toks[i].at..toks[that].end]))
}

/// Greek verbs of saying and writing: λέγω, εἶπον, ἐρέω, φημί, λαλέω, γράφω.
const SPEECH: &[&str] = &["G3004", "G2036", "G2046", "G5346", "G2980", "G1125"];

fn speech(w: &Word) -> bool {
    w.lemma
        .as_deref()
        .is_some_and(|l| SPEECH.iter().any(|s| l.starts_with(s)))
}

// ---------------------------------------------------------------- words in English

/// A word: where it is in its text (chars) and its lower-case form, with an
/// apostrophe inside it written `'`.
struct Tok {
    at: usize,
    end: usize,
    word: String,
}

fn tokens(t: &[char]) -> Vec<Tok> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < t.len() {
        if !t[i].is_alphabetic() {
            i += 1;
            continue;
        }
        let at = i;
        let mut word = String::new();
        while i < t.len() && (t[i].is_alphabetic() || apostrophe(t, i)) {
            if t[i].is_alphabetic() {
                word.extend(t[i].to_lowercase());
            } else {
                word.push('\'');
            }
            i += 1;
        }
        out.push(Tok { at, end: i, word });
    }
    out
}

/// Words too common to show that two passages are alike.
const STOP: &[&str] = &[
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "of",
    "to",
    "in",
    "on",
    "at",
    "by",
    "for",
    "with",
    "from",
    "as",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "am",
    "that",
    "this",
    "these",
    "those",
    "it",
    "its",
    "he",
    "him",
    "his",
    "she",
    "her",
    "they",
    "them",
    "their",
    "we",
    "us",
    "our",
    "you",
    "your",
    "i",
    "me",
    "my",
    "mine",
    "who",
    "whom",
    "whose",
    "which",
    "what",
    "when",
    "where",
    "why",
    "how",
    "not",
    "no",
    "nor",
    "so",
    "then",
    "than",
    "there",
    "here",
    "into",
    "upon",
    "over",
    "under",
    "out",
    "up",
    "do",
    "does",
    "did",
    "done",
    "have",
    "has",
    "had",
    "shall",
    "will",
    "would",
    "should",
    "can",
    "could",
    "may",
    "might",
    "must",
    "o",
    "oh",
    "let",
    "all",
    "every",
    "each",
    "also",
    "even",
    "yet",
    "just",
    "very",
    "too",
    "one",
    "if",
    "because",
    "yours",
    "ours",
    "theirs",
    "himself",
    "herself",
    "itself",
    "themselves",
    "myself",
    "yourself",
    "yourselves",
    "ourselves",
    "like",
];

fn ends(cs: &[char], suffix: &str) -> bool {
    let n = suffix.chars().count();
    cs.len() >= n && cs[cs.len() - n..].iter().copied().eq(suffix.chars())
}

/// A rough English stem, so that "calls", "called" and "calling" match "call",
/// and "stripes" matches "stripe".
fn stem(w: &str) -> String {
    let w = w
        .strip_suffix("'s")
        .or_else(|| w.strip_suffix('\''))
        .unwrap_or(w);
    let mut cs: Vec<char> = w.chars().collect();
    if cs.len() > 4 && (ends(&cs, "ies") || ends(&cs, "ied")) {
        cs.truncate(cs.len() - 3);
        cs.push('y');
    } else {
        for suffix in ["ing", "ed", "es", "s"] {
            if ends(&cs, suffix)
                && cs.len() >= suffix.len() + 3
                && !(suffix == "s" && ends(&cs, "ss"))
            {
                cs.truncate(cs.len() - suffix.len());
                let n = cs.len();
                if (suffix == "ing" || suffix == "ed")
                    && cs[n - 1] == cs[n - 2]
                    && !"lsfzdaeiou".contains(cs[n - 1])
                {
                    cs.pop();
                }
                break;
            }
        }
    }
    if cs.len() > 3 && cs.last() == Some(&'e') {
        cs.pop();
    }
    cs.into_iter().collect()
}

/// The form a word is compared by, or None for a common word.
fn key(w: &str) -> Option<String> {
    let base = w.strip_suffix("'s").unwrap_or(w);
    (base.chars().count() >= 2 && !STOP.contains(&base)).then(|| stem(base))
}

fn keys_of(text: &str) -> HashSet<String> {
    tokens(&text.chars().collect::<Vec<_>>())
        .iter()
        .filter_map(|t| key(&t.word))
        .collect()
}

fn longest_run(a: &[String], b: &[String]) -> usize {
    let mut best = 0;
    let mut prev = vec![0usize; b.len() + 1];
    for x in a {
        let mut cur = vec![0usize; b.len() + 1];
        for (j, y) in b.iter().enumerate() {
            if x == y {
                cur[j + 1] = prev[j] + 1;
                best = best.max(cur[j + 1]);
            }
        }
        prev = cur;
    }
    best
}

/// How two passages compare in English.
struct Measure {
    /// The longest run of words they have in common, in order.
    run: usize,
    /// The key words of the first that the second has too.
    shared: HashSet<String>,
    /// How many different key words the first has.
    keys: usize,
    /// How many words the first has.
    words: usize,
}

fn measure(nt: &[(u32, Tok)], ot: &[(u32, Tok)]) -> Measure {
    let a: Vec<String> = nt.iter().map(|(_, t)| stem(&t.word)).collect();
    let b: Vec<String> = ot.iter().map(|(_, t)| stem(&t.word)).collect();
    let ka: HashSet<String> = nt.iter().filter_map(|(_, t)| key(&t.word)).collect();
    let kb: HashSet<String> = ot.iter().filter_map(|(_, t)| key(&t.word)).collect();
    let shared = ka.intersection(&kb).cloned().collect();
    Measure {
        run: longest_run(&a, &b),
        shared,
        keys: ka.len(),
        words: a.len(),
    }
}

/// 0: word for word (only where the quoted words are known); 1: close, at
/// least three in five key words shared; 2: loose.
fn closeness(m: &Measure, quoted: bool) -> u8 {
    // All the words in one run, or all but one in a longer quotation.
    let word_for_word = if m.words >= 4 {
        m.run + 1 >= m.words
    } else {
        m.words >= 2 && m.run == m.words
    };
    if quoted && word_for_word {
        0
    } else if m.keys > 0 && m.shared.len() * 5 >= m.keys * 3 {
        1
    } else {
        2
    }
}

/// The quoted words cut into clauses at commas, semicolons, colons, dashes,
/// sentence ends and verse ends, as ranges of `words`.
fn clauses(chars: &[Vec<char>], words: &[(u32, Tok)]) -> Vec<Range<usize>> {
    let mut out = Vec::new();
    let mut start = 0;
    for i in 1..words.len() {
        let ((v, a), (w, b)) = (&words[i - 1], &words[i]);
        let cut = v != w
            || chars[*v as usize][a.end..b.at]
                .iter()
                .any(|c| matches!(c, ',' | ';' | ':' | '.' | '?' | '!' | '—'));
        if cut {
            out.push(start..i);
            start = i;
        }
    }
    if start < words.len() {
        out.push(start..words.len());
    }
    out
}

/// The part of the quoted words that comes from passage `which` of several a
/// footnote names (`named`, their key words): from its first to its last
/// clause that shares at least one key word with it and none fewer than with
/// any other. With it, whether a clause left out shares a key word with it all
/// the same. None when that is every clause, or none.
fn part_from(
    nt: &[(u32, Tok)],
    clauses: &[Range<usize>],
    named: &[HashSet<String>],
    which: usize,
) -> Option<(Range<usize>, bool)> {
    // Each clause: whether it comes from the passage, and whether it shares a word.
    let from: Vec<(bool, bool)> = clauses
        .iter()
        .map(|c| {
            let ka: HashSet<String> = nt[c.clone()]
                .iter()
                .filter_map(|(_, t)| key(&t.word))
                .collect();
            let shared: Vec<usize> = named.iter().map(|o| ka.intersection(o).count()).collect();
            let best = shared.iter().copied().max().unwrap_or(0);
            (best > 0 && shared[which] == best, shared[which] > 0)
        })
        .collect();
    let first = from.iter().position(|x| x.0)?;
    let last = from.iter().rposition(|x| x.0)?;
    if first == 0 && last + 1 == clauses.len() {
        return None;
    }
    let rest = from
        .iter()
        .enumerate()
        .any(|(i, x)| (i < first || i > last) && x.1);
    Some((clauses[first].start..clauses[last].end, rest))
}

fn keys_in(words: &[(u32, Tok)]) -> HashSet<String> {
    words.iter().filter_map(|(_, t)| key(&t.word)).collect()
}

/// A char place as the web counts it (UTF-16 code units).
fn utf16_at(t: &[char], i: usize) -> u32 {
    t[..i.min(t.len())]
        .iter()
        .map(|c| c.len_utf16() as u32)
        .sum()
}

/// The same place in the BSB text the app shows. The USFM edition is a
/// slightly older printing: where a verse reads the same, a place maps as it
/// is; otherwise a quotation mark maps to the same mark (the n-th of its kind)
/// if the verse has as many of them.
fn map_place(u: &[char], j: &[char], at: usize) -> Option<usize> {
    if same_text(u, j) {
        return Some(at.min(j.len()));
    }
    let c = *u.get(at)?;
    if !matches!(c, '“' | '”' | '‘' | '’') {
        return None;
    }
    let marks = |t: &[char]| -> Vec<usize> {
        (0..t.len())
            .filter(|&i| t[i] == c && !apostrophe(t, i))
            .collect()
    };
    let (mu, mj) = (marks(u), marks(j));
    if mu.len() != mj.len() {
        return None;
    }
    Some(mj[mu.iter().position(|&i| i == at)?])
}

fn same_text(u: &[char], j: &[char]) -> bool {
    u.len() == j.len()
        && u.iter()
            .zip(j)
            .all(|(&a, &b)| a == b || (a == 'ʼ' && b == '’'))
}

// ---------------------------------------------------------------- Hebrew and Greek

/// A Hebrew word by its letters (final forms as plain ones), each with its
/// shin or sin dot when written (1 shin, 2 sin, 0 not written).
type HebKey = Vec<(char, u8)>;

fn heb_key(s: &str) -> HebKey {
    let mut out: HebKey = Vec::new();
    for c in s.chars() {
        match c {
            'ך' => out.push(('כ', 0)),
            'ם' => out.push(('מ', 0)),
            'ן' => out.push(('נ', 0)),
            'ף' => out.push(('פ', 0)),
            'ץ' => out.push(('צ', 0)),
            'א'..='ת' => out.push((c, 0)),
            '\u{05C1}' | '\u{05C2}' => {
                if let Some(last) = out.last_mut().filter(|l| l.0 == 'ש') {
                    last.1 = if c == '\u{05C1}' { 1 } else { 2 };
                }
            }
            _ => {}
        }
    }
    out
}

fn heb_eq(a: &HebKey, b: &HebKey) -> bool {
    a.len() == b.len()
        && a.iter()
            .zip(b)
            .all(|(x, y)| x.0 == y.0 && (x.1 == 0 || y.1 == 0 || x.1 == y.1))
}

fn is_hebrew(c: char) -> bool {
    matches!(c, '\u{05D0}'..='\u{05EA}' | '\u{0591}'..='\u{05BD}' | '\u{05BF}' | '\u{05C1}' | '\u{05C2}' | '\u{05C4}' | '\u{05C5}' | '\u{05C7}')
}

/// The Hebrew words a Greek lexicon entry says the Septuagint renders with
/// it: those in its "[in LXX chiefly for זעק, צעק, קרא ;]" note.
fn lxx_notes(definition: &str) -> Vec<HebKey> {
    let mut out = Vec::new();
    let mut rest = definition;
    while let Some(i) = rest.find("[in LXX") {
        let seg = &rest[i..];
        let end = seg.find(']').unwrap_or(seg.len());
        let mut word = String::new();
        for c in seg[..end].chars().chain([' ']) {
            if is_hebrew(c) {
                word.push(c);
            } else if !word.is_empty() {
                let k = heb_key(&word);
                if k.len() >= 2 {
                    out.push(k);
                }
                word.clear();
            }
        }
        rest = &seg[end..];
    }
    out.sort();
    out.dedup();
    out
}

fn greek_content(morph: &str) -> bool {
    ["N-", "V-", "A-"].iter().any(|p| morph.starts_with(p))
}

/// A Hebrew noun, verb or adjective, prefixes and suffixes aside
/// ("HR/Ncmpc/Sp1bp" is "to" + "God" + "our").
fn hebrew_content(morph: &str) -> bool {
    morph
        .get(1..)
        .is_some_and(|m| m.split('/').any(|s| s.starts_with(['N', 'V', 'A'])))
}

/// What the lexicons give for pairing words, by root key and by its first
/// five chars ("G5456G" and "G5456").
struct Lex {
    /// Greek root: the Hebrew words its Septuagint note names.
    lxx: HashMap<String, Vec<HebKey>>,
    /// Hebrew root: its dictionary form.
    head: HashMap<String, HebKey>,
    /// Any root: its gloss.
    gloss: HashMap<String, String>,
}

impl Lex {
    fn read(inputs: &Inputs) -> Result<Self, String> {
        let mut entries: HashMap<String, LexEntry> = HashMap::new();
        parse::lexicon(&inputs.path("tbesg", "tbesg"), "tbesg", &mut entries)?;
        parse::lexicon(&inputs.path("tbesh", "tbesh"), "tbesh", &mut entries)?;
        let mut keys: Vec<&String> = entries.keys().collect();
        keys.sort();
        let mut lex = Lex {
            lxx: HashMap::new(),
            head: HashMap::new(),
            gloss: HashMap::new(),
        };
        for k in keys {
            let e = &entries[k];
            let names: Vec<&str> = if k.len() > 5 {
                vec![k.as_str(), &k[..5]]
            } else {
                vec![k.as_str()]
            };
            let notes = if k.starts_with('G') {
                lxx_notes(&e.definition)
            } else {
                Vec::new()
            };
            for name in names {
                lex.gloss
                    .entry(name.to_string())
                    .or_insert_with(|| e.gloss.clone());
                if k.starts_with('H') {
                    lex.head
                        .entry(name.to_string())
                        .or_insert_with(|| heb_key(&e.word));
                } else if !notes.is_empty() {
                    lex.lxx
                        .entry(name.to_string())
                        .or_default()
                        .extend(notes.iter().cloned());
                }
            }
        }
        Ok(lex)
    }

    fn get<'a, T>(m: &'a HashMap<String, T>, key: &str) -> Option<&'a T> {
        m.get(key).or_else(|| m.get(key.get(..5)?))
    }
}

// ---------------------------------------------------------------- links

/// One side of a link: a verse, and the chars of its BSB text that count.
struct Part {
    verse: u32,
    from: usize,
    to: usize,
}

struct Link {
    nt: (u32, u32),
    ot: (u32, u32),
    quote: bool,
    close: u8,
    flags: u8,
    /// Why it is a quotation or an echo (BY_* or ECHO_*).
    why: u8,
    formula: Option<String>,
    note: String,
    ot_note: Option<String>,
    /// Longest run of shared words, key words shared, key words in all.
    counts: [usize; 3],
    /// The quoted words in the BSB text: first verse, place, last verse, place (UTF-16).
    span: Option<[u32; 4]>,
    /// Shared words to mark: [verse, start, end, start, end, ...] (UTF-16).
    marks: Vec<Vec<u32>>,
    /// Greek word and the Hebrew word it stands for: [verse, word, verse, word].
    pairs: Vec<[u32; 4]>,
}

#[derive(Default)]
struct Tally {
    footnotes: usize,
    not_in_bsb: usize,
    unreadable: usize,
    to_nt: usize,
    unmapped_verses: usize,
    closed: usize,
    inside: usize,
    no_span: usize,
    place_misses: usize,
    cited: usize,
    cited_unread: usize,
    long_echoes: usize,
    duplicates: usize,
}

/// "Cited in" notes of the Old Testament: verse -> (New Testament passage, the note).
type Cited = HashMap<u32, Vec<(u32, u32, String)>>;

struct Ctx<'a> {
    vz: &'a Versification,
    chars: Vec<Vec<char>>,
    words: &'a [Vec<Word>],
    books: Vec<Vec<UVerse>>,
    lex: Lex,
}

impl Ctx<'_> {
    fn one_chapter(&self) -> impl Fn(u8) -> bool + '_ {
        |b| self.vz.chapters_in(b) == 1
    }

    fn cited_in(&self, t: &mut Tally) -> Cited {
        let mut cited = Cited::new();
        for (b, book) in self.books.iter().enumerate().take(FIRST_NT_BOOK as usize) {
            for uv in book {
                let Some(v) = self.vz.index(b as u8, uv.chapter, uv.verse) else {
                    t.unmapped_verses += 1;
                    continue;
                };
                for (_, body) in &uv.notes {
                    let note = read_note(body);
                    for (_, r) in note.refs.iter().filter(|r| r.0 == Kind::Cited) {
                        for x in ref_list(r, self.one_chapter()).unwrap_or_default() {
                            match resolve(x, self.vz) {
                                Some((a, z)) if x.0 >= FIRST_NT_BOOK => {
                                    t.cited += 1;
                                    cited.entry(v).or_default().push((a, z, note.plain.clone()));
                                }
                                _ => t.cited_unread += 1,
                            }
                        }
                    }
                }
            }
        }
        cited
    }

    /// The New Testament side of a footnote's link: the quoted words if they
    /// are known, else the footnote's whole verse.
    fn nt_parts(&self, b: usize, v: u32, span: Option<Span>, t: &mut Tally) -> Vec<Part> {
        let Some(s) = span else {
            return vec![Part {
                verse: v,
                from: 0,
                to: self.chars[v as usize].len(),
            }];
        };
        let book = &self.books[b];
        let mut out = Vec::new();
        for (kk, uv) in book.iter().enumerate().take(s.end.0 + 1).skip(s.start.0) {
            let Some(at) = self.vz.index(b as u8, uv.chapter, uv.verse) else {
                continue;
            };
            let (u, j) = (&uv.text, &self.chars[at as usize]);
            let mut place = |p: Option<usize>, fallback: usize| {
                p.unwrap_or_else(|| {
                    t.place_misses += 1;
                    fallback
                })
            };
            let from = if kk == s.start.0 {
                place(map_place(u, j, s.start.1).map(|x| x + 1), 0)
            } else {
                0
            };
            let to = match (kk == s.end.0, s.closed) {
                (false, _) => j.len(),
                (true, true) => place(map_place(u, j, s.end.1), j.len()),
                (true, false) => place(same_text(u, j).then_some(s.end.1), j.len()),
            };
            out.push(Part {
                verse: at,
                from: from.min(j.len()),
                to: to.clamp(from.min(j.len()), j.len()),
            });
        }
        if out.is_empty() {
            out.push(Part {
                verse: v,
                from: 0,
                to: self.chars[v as usize].len(),
            });
        }
        out
    }

    fn words_in(&self, parts: &[Part]) -> Vec<(u32, Tok)> {
        let mut out = Vec::new();
        for p in parts {
            for t in tokens(&self.chars[p.verse as usize]) {
                if t.at >= p.from && t.end <= p.to {
                    out.push((p.verse, t));
                }
            }
        }
        out
    }

    fn whole(&self, ot: (u32, u32)) -> Vec<Part> {
        (ot.0..=ot.1)
            .map(|v| Part {
                verse: v,
                from: 0,
                to: self.chars[v as usize].len(),
            })
            .collect()
    }

    /// The shared words of both sides, as ranges to mark.
    fn marks(
        &self,
        nt: &[(u32, Tok)],
        ot: &[(u32, Tok)],
        shared: &HashSet<String>,
    ) -> Vec<Vec<u32>> {
        let mut out: Vec<Vec<u32>> = Vec::new();
        let mut last_end = 0usize;
        for (v, tk) in nt.iter().chain(ot) {
            if !key(&tk.word).is_some_and(|k| shared.contains(&k)) {
                continue;
            }
            let text = &self.chars[*v as usize];
            let (s, e) = (utf16_at(text, tk.at), utf16_at(text, tk.end));
            match out.last_mut() {
                // Words with only a space between make one mark.
                Some(row) if row[0] == *v && last_end + 1 == tk.at && text[last_end] == ' ' => {
                    *row.last_mut().unwrap() = e;
                }
                Some(row) if row[0] == *v => row.extend([s, e]),
                _ => out.push(vec![*v, s, e]),
            }
            last_end = tk.end;
        }
        out
    }

    /// Which Greek words of a verse belong to the quotation: where the verse
    /// is only partly quoted, the stretch of words whose glosses are among the
    /// quoted English words rather than among the rest (and the words around
    /// it that belong to neither), or else the same share of the words.
    fn greek_window(&self, p: &Part) -> Range<usize> {
        let ws = &self.words[p.verse as usize];
        let toks = tokens(&self.chars[p.verse as usize]);
        let inside_of = |t: &Tok| t.at >= p.from && t.end <= p.to;
        let inside: HashSet<String> = toks
            .iter()
            .filter(|t| inside_of(t))
            .filter_map(|t| key(&t.word))
            .collect();
        let outside: HashSet<String> = toks
            .iter()
            .filter(|t| !inside_of(t))
            .filter_map(|t| key(&t.word))
            .collect();
        if outside.is_subset(&inside) {
            return 0..ws.len();
        }
        let scores: Vec<i32> = ws
            .iter()
            .map(|w| {
                let g = keys_of(&w.gloss);
                match (
                    g.iter().any(|k| inside.contains(k)),
                    g.iter().any(|k| outside.contains(k)),
                ) {
                    (true, false) => 1,
                    (false, true) => -1,
                    _ => 0,
                }
            })
            .collect();
        let (mut best, mut best_sum, mut start, mut sum) = (0..0, 0, 0, 0);
        for (i, &s) in scores.iter().enumerate() {
            if sum <= 0 {
                start = i;
                sum = 0;
            }
            sum += s;
            if sum > best_sum {
                best_sum = sum;
                best = start..i + 1;
            }
        }
        if best_sum > 0 {
            // "today" alone tells the first half of Hebrews 1:5 apart; "My Son"
            // and "begotten" beside it belong to the same quotation.
            // A verb of saying or writing there ("saying", "it is written")
            // introduces the quotation more often than it belongs to it.
            let free = |i: usize| scores[i] == 0 && !speech(&ws[i]);
            let (mut from, mut to) = (best.start, best.end);
            while from > 0 && free(from - 1) {
                from -= 1;
            }
            while to < scores.len() && free(to) {
                to += 1;
            }
            return from..to;
        }
        // No gloss tells the parts apart ("Father" and "Son" in both halves of
        // Hebrews 1:5): take the same share of the Greek as of the English.
        let len = self.chars[p.verse as usize].len().max(1);
        (p.from * ws.len() / len)..(p.to * ws.len()).div_ceil(len)
    }

    /// Greek words of the quotation paired with the Hebrew words they stand
    /// for: a pair needs the Greek word's Septuagint note to name the Hebrew
    /// word's root. Each word pairs once; glosses that agree go first.
    fn pairs(&self, parts: &[Part], ot: (u32, u32)) -> Vec<[u32; 4]> {
        let lex = &self.lex;
        let mut greek = Vec::new();
        for p in parts {
            let window = self.greek_window(p);
            for (i, w) in self.words[p.verse as usize].iter().enumerate() {
                if !window.contains(&i) || !w.main || !greek_content(&w.morph) {
                    continue;
                }
                if let Some((l, notes)) = w
                    .lemma
                    .as_deref()
                    .and_then(|l| Some((l, Lex::get(&lex.lxx, l)?)))
                {
                    greek.push((p.verse, i, w, l, notes));
                }
            }
        }
        let mut hebrew = Vec::new();
        for o in ot.0..=ot.1 {
            for (i, w) in self.words[o as usize].iter().enumerate() {
                if !w.main || !hebrew_content(&w.morph) {
                    continue;
                }
                if let Some((l, head)) = w
                    .lemma
                    .as_deref()
                    .and_then(|l| Some((l, Lex::get(&lex.head, l)?)))
                {
                    hebrew.push((o, i, w, l, head));
                }
            }
        }
        let gloss = |w: &Word, l: &str| {
            let mut k = keys_of(&w.gloss);
            k.extend(keys_of(Lex::get(&lex.gloss, l).map_or("", String::as_str)));
            k
        };
        let mut cand = Vec::new();
        for (gi, g) in greek.iter().enumerate() {
            let gk = gloss(g.2, g.3);
            for (hi, h) in hebrew.iter().enumerate() {
                if !g.4.iter().any(|n| heb_eq(n, h.4)) {
                    continue;
                }
                let agree = !gk.is_disjoint(&gloss(h.2, h.3));
                // How far apart the two words sit, as shares of their passages.
                let apart = (gi * hebrew.len()).abs_diff(hi * greek.len()) * 1000
                    / (greek.len() * hebrew.len());
                cand.push((!agree, apart, gi, hi));
            }
        }
        cand.sort_unstable();
        let (mut used_g, mut used_h) = (vec![false; greek.len()], vec![false; hebrew.len()]);
        let mut out = Vec::new();
        for (_, _, gi, hi) in cand {
            if used_g[gi] || used_h[hi] || out.len() == MAX_PAIRS {
                continue;
            }
            used_g[gi] = true;
            used_h[hi] = true;
            out.push([
                greek[gi].0,
                greek[gi].1 as u32,
                hebrew[hi].0,
                hebrew[hi].1 as u32,
            ]);
        }
        out.sort_unstable();
        out
    }

    fn links(&self, cited: &Cited, t: &mut Tally) -> Vec<Link> {
        let mut out = Vec::new();
        for b in FIRST_NT_BOOK as usize..BOOKS.len() {
            let book = &self.books[b];
            for (k, uv) in book.iter().enumerate() {
                let Some(v) = self.vz.index(b as u8, uv.chapter, uv.verse) else {
                    t.unmapped_verses += 1;
                    continue;
                };
                for (off, body) in &uv.notes {
                    self.footnote(book, b, k, v, *off, &read_note(body), cited, t, &mut out);
                }
            }
        }
        out
    }

    #[allow(clippy::too_many_arguments)]
    fn footnote(
        &self,
        book: &[UVerse],
        b: usize,
        k: usize,
        v: u32,
        off: usize,
        note: &Note,
        cited: &Cited,
        t: &mut Tally,
        out: &mut Vec<Link>,
    ) {
        // The Old Testament passages the footnote names, with what each is.
        let mut targets: Vec<(Kind, (u32, u32))> = Vec::new();
        for (kind, r) in note.refs.iter().filter(|r| r.0 != Kind::Cited) {
            let Some(list) = ref_list(r, self.one_chapter()) else {
                t.unreadable += 1;
                continue;
            };
            for x in list {
                if x.0 >= FIRST_NT_BOOK {
                    t.to_nt += 1;
                } else if let Some(r) = resolve(x, self.vz) {
                    targets.push((*kind, r));
                } else {
                    t.not_in_bsb += 1;
                }
            }
        }
        if targets.is_empty() {
            return;
        }
        t.footnotes += 1;
        let saw: Vec<bool> = targets.iter().map(|x| x.0 == Kind::See).collect();
        let named: HashSet<String> = targets
            .iter()
            .flat_map(|x| keys_in(&self.words_in(&self.whole(x.1))))
            .collect();
        let named_here = |w: &[char]| {
            tokens(w)
                .iter()
                .filter_map(|t| key(&t.word))
                .any(|k| named.contains(&k))
        };
        let (span, formula) = match find_span(book, k, off).map(|s| with_list(book, s, named_here))
        {
            Some(s) if targets.iter().any(|x| x.0 == Kind::Quote) => {
                (Some(s), introduction(book, s, true))
            }
            // A "see" names the source of a quotation that is introduced as one
            // ("what was spoken through the prophet Jeremiah was fulfilled") when
            // the footnote quotes nothing else; a long passage stays a pointer.
            // Otherwise it belongs to the words right before it: a quotation
            // closing in its own verse, not a speech that began verses earlier.
            Some(s) if s.closed => match introduction(book, s, false)
                .filter(|_| !note.refs.iter().any(|r| r.0 == Kind::Quote))
            {
                Some(f) => {
                    for x in targets.iter_mut().filter(|x| x.1 .1 - x.1 .0 < ECHO_VERSES) {
                        x.0 = Kind::Quote;
                    }
                    (Some(s), Some(f))
                }
                None => (Some(s).filter(|s| s.start.0 == k), None),
            },
            _ => (None, None),
        };
        let quoting: Vec<(u32, u32)> = targets
            .iter()
            .filter(|x| x.0 == Kind::Quote)
            .map(|x| x.1)
            .collect();
        match span {
            Some(s) if s.closed => t.closed += 1,
            Some(_) => t.inside += 1,
            None => t.no_span += 1,
        }
        let parts = self.nt_parts(b, v, span, t);
        let nt = (parts[0].verse, parts[parts.len() - 1].verse.max(v));
        let nt_words = self.words_in(&parts);
        // A quotation, judged against every passage the footnote quotes.
        let all: Vec<Part> = quoting.iter().flat_map(|&q| self.whole(q)).collect();
        let joint = measure(&nt_words, &self.words_in(&all));
        // The Septuagint's wording cannot be compared with the BSB's English,
        // which is translated from the Hebrew: there the footnote decides.
        let by = if formula.is_some() {
            Some(BY_FORMULA)
        } else if has_word(&note.plain, "LXX") {
            Some(BY_LXX)
        } else if joint.run >= 5 {
            Some(BY_RUN)
        } else if closeness(&joint, true) == 0 {
            Some(BY_WORDS)
        } else if joint.shared.len() >= 3 && closeness(&joint, true) == 1 {
            Some(BY_KEYS)
        } else {
            None
        };
        let is_quote = span.is_some() && by.is_some();
        let mut flags = 0;
        for (word, flag) in [("LXX", LXX), ("DSS", DSS)] {
            if has_word(&note.plain, word) {
                flags |= flag;
            }
        }
        if span.is_some() {
            flags |= MARKS;
        }
        if quoting.len() > 1 {
            flags |= JOINED;
        }
        let span_out = span.map(|_| {
            let (p, q) = (&parts[0], &parts[parts.len() - 1]);
            let (pt, qt) = (&self.chars[p.verse as usize], &self.chars[q.verse as usize]);
            [p.verse, utf16_at(pt, p.from), q.verse, utf16_at(qt, q.to)]
        });
        // Several passages quoted together: the clauses each one supplies.
        let split = if quoting.len() > 1 {
            clauses(&self.chars, &nt_words)
        } else {
            Vec::new()
        };
        let quoted_keys: Vec<HashSet<String>> = quoting
            .iter()
            .map(|&q| keys_in(&self.words_in(&self.whole(q))))
            .collect();
        for ((kind, ot), saw) in targets.into_iter().zip(saw) {
            let ot_words = self.words_in(&self.whole(ot));
            let whole = measure(&nt_words, &ot_words);
            let ot_note = (ot.0..=ot.1)
                .flat_map(|o| cited.get(&o).into_iter().flatten())
                .find(|c| c.0 <= nt.1 && nt.0 <= c.1)
                .map(|c| c.2.clone());
            let mut f = flags;
            if saw {
                f |= SEE;
            }
            if ot_note.is_some() {
                f |= BOTH;
            }
            // A "see" made a quotation by its introduction must share a word.
            let quote = kind == Kind::Quote && is_quote && !(saw && whole.shared.is_empty());
            // Each passage is compared with the part that comes from it, where
            // that part is quoted more closely than the whole: Matthew 19:19
            // ends with Leviticus 19:18 word for word.
            let mut close = closeness(&whole, span.is_some());
            let part = quoting
                .iter()
                .position(|&q| q == ot)
                .filter(|_| kind == Kind::Quote)
                .and_then(|w| part_from(&nt_words, &split, &quoted_keys, w))
                .map(|(r, rest)| {
                    let m = measure(&nt_words[r.clone()], &ot_words);
                    let c = closeness(&m, span.is_some()).max(u8::from(rest));
                    (r, m, c)
                })
                .filter(|p| p.2 < close);
            let (words, m) = match part {
                Some((r, m, c)) => {
                    f |= PART;
                    close = c;
                    (&nt_words[r], m)
                }
                None => (&nt_words[..], whole),
            };
            let why = match by {
                Some(by) if quote => by,
                _ if kind == Kind::See => ECHO_SEE,
                _ if span.is_none() => ECHO_UNMARKED,
                None => ECHO_FEW,
                Some(_) => ECHO_NONE,
            };
            out.push(Link {
                nt,
                ot,
                quote,
                close,
                flags: f,
                why,
                formula: formula.clone().filter(|_| kind == Kind::Quote),
                note: note.plain.clone(),
                ot_note,
                counts: [m.run, m.shared.len(), m.keys],
                span: span_out,
                marks: self.marks(words, &ot_words, &m.shared),
                pairs: self.pairs(&parts, ot),
            });
        }
    }
}

/// One link per pair of passages: quotations first, then the echoes that do
/// not repeat one, without long echoes (a pointer to a story, not to words).
fn tidy(links: Vec<Link>, t: &mut Tally) -> Vec<Link> {
    let overlaps = |a: &Link, b: &Link| a.ot == b.ot && a.nt.0 <= b.nt.1 && b.nt.0 <= a.nt.1;
    let (quotes, echoes): (Vec<Link>, Vec<Link>) = links.into_iter().partition(|l| l.quote);
    let mut kept: Vec<Link> = Vec::new();
    for l in quotes.into_iter().chain(echoes) {
        if !l.quote && l.ot.1 - l.ot.0 + 1 > ECHO_VERSES {
            t.long_echoes += 1;
        } else if kept.iter().any(|k| overlaps(k, &l)) {
            t.duplicates += 1;
        } else {
            kept.push(l);
        }
    }
    kept.sort_by_key(|l| (l.nt, l.ot));
    kept
}

/// Words from the USFM edition as the app's BSB text writes them: its
/// apostrophe is ʼ, the app's is ’.
fn shown(s: &str) -> String {
    s.replace('ʼ', "’")
}

/// The files to write under web/public/data, as (path, bytes).
pub fn build(
    inputs: &Inputs,
    vz: &Versification,
    bsb_text: &[String],
    words: &[Vec<Word>],
) -> Result<Vec<(String, Vec<u8>)>, String> {
    let mut books = Vec::with_capacity(BOOKS.len());
    for b in &BOOKS {
        let path = inputs.path(SOURCE, b.osis);
        let text =
            fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
        books.push(read_usfm(&text));
    }
    let cx = Ctx {
        vz,
        chars: bsb_text.iter().map(|s| s.chars().collect()).collect(),
        words,
        books,
        lex: Lex::read(inputs)?,
    };
    let mut t = Tally::default();
    let cited = cx.cited_in(&mut t);
    let links = tidy(cx.links(&cited, &mut t), &mut t);

    let quotes = links.iter().filter(|l| l.quote).count();
    let both = links
        .iter()
        .filter(|l| l.quote && l.flags & BOTH != 0)
        .count();
    let paired = links.iter().filter(|l| !l.pairs.is_empty()).count();
    eprintln!(
        "quotations: {} links ({quotes} quotations, {} echoes) from {} footnotes; {both} quotations named in the Old Testament's notes too; {paired} links with Hebrew-Greek word pairs",
        links.len(),
        links.len() - quotes,
        t.footnotes,
    );
    eprintln!(
        "  quoted words: {} after a closing mark, {} inside a quotation, {} not found; {} places not mapped to the BSB text",
        t.closed, t.inside, t.no_span, t.place_misses
    );
    eprintln!(
        "  dropped: {} references not in the BSB, {} unreadable, {} to the New Testament, {} long echoes, {} repeats; {} verses not in the BSB; {} 'cited in' references to the New Testament ({} others skipped)",
        t.not_in_bsb, t.unreadable, t.to_nt, t.long_echoes, t.duplicates, t.unmapped_verses, t.cited, t.cited_unread
    );

    let doc = json!({
        "format": 1,
        "links": links.iter().map(|l| [l.nt.0, l.nt.1, l.ot.0, l.ot.1, u32::from(!l.quote)]).collect::<Vec<_>>(),
    });
    let notes: Vec<Value> = links
        .iter()
        .map(|l| {
            let mut o = serde_json::Map::new();
            o.insert("c".into(), json!(l.close));
            o.insert("x".into(), json!(l.flags));
            o.insert("r".into(), json!(l.why));
            o.insert("n".into(), json!(shown(&l.note)));
            o.insert("k".into(), json!(l.counts));
            if let Some(f) = &l.formula {
                o.insert("f".into(), json!(shown(f)));
            }
            if let Some(m) = &l.ot_note {
                o.insert("m".into(), json!(shown(m)));
            }
            if let Some(s) = l.span {
                o.insert("s".into(), json!(s));
            }
            if !l.marks.is_empty() {
                o.insert("h".into(), json!(l.marks));
            }
            if !l.pairs.is_empty() {
                o.insert("w".into(), json!(l.pairs));
            }
            Value::Object(o)
        })
        .collect();
    let notes_doc = json!({ "format": 1, "notes": notes });
    let bytes = |v: &Value| serde_json::to_vec(v).map_err(|e| e.to_string());
    Ok(vec![
        (OUT.to_string(), bytes(&doc)?),
        (NOTES.to_string(), bytes(&notes_doc)?),
    ])
}

// ---------------------------------------------------------------- verify

fn read_json(d: &Loaded, rel: &str) -> Result<Value, String> {
    let path = d.dir.join(rel);
    let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let doc = read_json(d, OUT)?;
    let notes_doc = read_json(d, NOTES)?;
    let raw = doc["links"].as_array().ok_or("quotes.json has no links")?;
    let notes = notes_doc["notes"]
        .as_array()
        .ok_or("quotes/notes.json has no notes")?;
    let links: Vec<[u32; 5]> = raw
        .iter()
        .filter_map(|l| {
            let a = l.as_array().filter(|a| a.len() == 5)?;
            let mut o = [0u32; 5];
            for (x, y) in o.iter_mut().zip(a) {
                *x = u32::try_from(y.as_u64()?).ok()?;
            }
            Some(o)
        })
        .collect();
    let (n, nt0) = (d.vz.verse_count(), d.vz.book_start(FIRST_NT_BOOK));
    let bad = links
        .iter()
        .filter(|l| {
            !(nt0 <= l[0] && l[0] <= l[1] && l[1] < n && l[2] <= l[3] && l[3] < nt0 && l[4] <= 1)
        })
        .count();
    let quotes = links.iter().filter(|l| l[4] == 0).count();
    let echoes = links.len() - quotes;
    let mut out = vec![
        (
            links.len() == raw.len() && bad == 0,
            format!(
                "{} of {} quotation links malformed or out of range",
                raw.len() - links.len() + bad,
                raw.len()
            ),
        ),
        (
            notes.len() == links.len(),
            format!(
                "quotation notes for {} of {} links",
                notes.len(),
                links.len()
            ),
        ),
        (
            (250..=600).contains(&quotes),
            format!("{quotes} quotations (expected 250 to 600)"),
        ),
        (
            (50..=400).contains(&echoes),
            format!("{echoes} echoes (expected 50 to 400)"),
        ),
    ];

    // Well-known quotations, and one well-known echo.
    let find = |nt: &str, ot: &str| -> Result<Option<usize>, String> {
        let (a, _) = d.resolve(nt)?;
        let (b, _) = d.resolve(ot)?;
        Ok(links
            .iter()
            .position(|l| l[0] <= a && a <= l[1] && l[2] <= b && b <= l[3]))
    };
    let note = |i: Option<usize>| i.and_then(|i| notes.get(i)).cloned().unwrap_or(Value::Null);
    for (nt, ot, want) in [
        ("Matt 3:3", "Isa 40:3", 0),
        ("Matt 27:46", "Ps 22:1", 0),
        ("Luke 4:18", "Isa 61:1", 0),
        ("Luke 4:19", "Isa 61:2", 0),
        ("Rom 1:17", "Hab 2:4", 0),
        ("Heb 1:5", "Ps 2:7", 0),
        ("Acts 2:25", "Ps 16:8", 0),
        ("Acts 2:28", "Ps 16:11", 0),
        ("Matt 2:15", "Hos 11:1", 0),
        ("Rom 13:9", "Exod 20:13", 0),
        ("1 Pet 2:24", "Isa 53:5", 1),
    ] {
        let i = find(nt, ot)?;
        let what = if want == 0 { "quotes" } else { "echoes" };
        out.push((
            i.map(|i| links[i][4]) == Some(want),
            format!("{nt} {what} {ot}"),
        ));
    }
    let (isa, _) = d.resolve("Isa 40:3")?;
    let gospels: HashSet<u8> = links
        .iter()
        .filter(|l| l[4] == 0 && l[2] <= isa && isa <= l[3])
        .filter_map(|l| d.vz.locate(l[0]).map(|x| x.0))
        .collect();
    out.push((
        gospels.len() >= 4,
        format!(
            "Isaiah 40:3 is quoted in {} books (expected Matthew, Mark, Luke and John)",
            gospels.len()
        ),
    ));
    let flags = |i: Option<usize>| note(i)["x"].as_u64().unwrap_or(0) as u8;
    out.push((
        flags(find("Heb 1:6", "Deut 32:43")?) & (LXX | DSS) == LXX | DSS,
        "Hebrews 1:6 follows the Septuagint and the Dead Sea Scrolls of Deuteronomy 32:43".into(),
    ));
    out.push((
        note(find("Matt 27:46", "Ps 22:1")?)["c"].as_u64() == Some(0),
        "Matthew 27:46 is word for word".into(),
    ));
    out.push((
        note(find("Matt 3:3", "Isa 40:3")?)["f"].is_string(),
        "Matthew 3:3 has its introduction".into(),
    ));
    let lev = note(find("Matt 19:19", "Lev 19:18")?);
    out.push((
        lev["c"].as_u64() == Some(1) && lev["x"].as_u64().unwrap_or(0) as u8 & PART != 0,
        "Matthew 19:19 quotes Leviticus 19:18 closely, in the words that come from it".into(),
    ));
    let both = links
        .iter()
        .zip(notes)
        .filter(|(l, x)| l[4] == 0 && x["x"].as_u64().unwrap_or(0) as u8 & BOTH != 0)
        .count();
    out.push((
        both * 10 >= quotes * 8,
        format!("{both} of {quotes} quotations are named in the Old Testament's notes too"),
    ));

    // Matthew 3:3 pairs φωνή with קוֹל ("voice").
    let key_at = |v: u64, pos: u64| -> Option<String> {
        let row = d.verse(u32::try_from(v).ok()?).ok()?;
        let lemma = row[1][pos as usize][3].as_u64()?;
        d.lemmas["key"][lemma as usize].as_str().map(str::to_string)
    };
    let voice = note(find("Matt 3:3", "Isa 40:3")?)["w"]
        .as_array()
        .is_some_and(|w| {
            w.iter().any(|p| {
                let at = |i: usize| p[i].as_u64().unwrap_or(u64::MAX);
                key_at(at(0), at(1)).is_some_and(|k| k.starts_with("G5456"))
                    && key_at(at(2), at(3)).is_some_and(|k| k.starts_with("H6963"))
            })
        });
    out.push((voice, "Matthew 3:3 pairs φωνή with קוֹל (voice)".into()));

    // Every marked word lies inside its verse, in a verse of its link.
    let mut stray = 0usize;
    for (l, x) in links.iter().zip(notes) {
        for row in x["h"].as_array().into_iter().flatten() {
            let r: Vec<u64> = row
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_u64)
                .collect();
            let Some(&v) = r.first() else { continue };
            let v = v as u32;
            let len = d.english(v).encode_utf16().count() as u64;
            let inside = (l[0] <= v && v <= l[1]) || (l[2] <= v && v <= l[3]);
            if !inside
                || r.len().is_multiple_of(2)
                || r[1..].chunks(2).any(|c| c[0] >= c[1] || c[1] > len)
            {
                stray += 1;
            }
        }
    }
    out.push((
        stray == 0,
        format!("{stray} rows of marked words out of place"),
    ));
    let unexplained = links
        .iter()
        .zip(notes)
        .filter(|(l, x)| {
            let why = x["r"].as_u64().unwrap_or(0) as u8;
            let want = if l[4] == 0 {
                BY_FORMULA..=BY_KEYS
            } else {
                ECHO_SEE..=ECHO_NONE
            };
            !want.contains(&why)
        })
        .count();
    out.push((
        unexplained == 0,
        format!("{unexplained} links without a reason for their kind"),
    ));
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text(cs: &[char]) -> String {
        cs.iter().collect()
    }

    #[test]
    fn usfm_verses_and_footnotes() {
        let src = "\\id MAT\n\\c 3\n\\s1 The Ministry\n\\p\n\\v 3 This is he who was spoken of through the prophet Isaiah:\n\\q1 “A voice of one calling in the wilderness,\n\\q2 ‘Prepare the way for the \\nd Lord\\nd*.’ ”\\f + \\fr 3:3 \\ft \\+xt Isaiah 40:3\\+xt* (see also LXX)\\f*\n\\v 4 John wore a garment.\n";
        let vs = read_usfm(src);
        assert_eq!(vs.len(), 2);
        assert_eq!((vs[0].chapter, vs[0].verse), (3, 3));
        let t = text(&vs[0].text);
        assert_eq!(t, "This is he who was spoken of through the prophet Isaiah: “A voice of one calling in the wilderness, ‘Prepare the way for the LORD.’ ”");
        assert_eq!(vs[0].notes.len(), 1);
        assert_eq!(vs[0].notes[0].0, vs[0].text.len());
        assert_eq!(text(&vs[1].text), "John wore a garment.");
    }

    #[test]
    fn footnote_kinds() {
        let n = read_note(" + \\fr 3:3 \\ft \\+xt Isaiah 40:3\\+xt* (see also LXX)");
        assert_eq!(n.plain, "Isaiah 40:3 (see also LXX)");
        assert_eq!(n.refs, vec![(Kind::Quote, "Isaiah 40:3".to_string())]);
        let n = read_note("+ \\fr 19:36 \\ft \\+xt Psalms 34:20\\+xt*; see also \\+xt Exodus 12:46\\+xt* and \\+xt Numbers 9:12\\+xt*.");
        assert_eq!(
            n.refs.iter().map(|r| r.0).collect::<Vec<_>>(),
            vec![Kind::Quote, Kind::See, Kind::See]
        );
        let n = read_note("+ \\fr 1:23 \\ft See \\+xt Isaiah 7:14,\\+xt* \\+xt Isaiah 8:8,\\+xt* and \\+xt Isaiah 8:10\\+xt*.");
        assert_eq!(
            n.refs.iter().map(|r| r.0).collect::<Vec<_>>(),
            vec![Kind::See; 3]
        );
        // Explaining a word, and another edition's reading: no link.
        assert!(read_note(
            "+ \\fr 11:34 \\ft Literally When your eye is sound; see \\+xt Proverbs 22:9\\+xt*."
        )
        .refs
        .is_empty());
        assert!(read_note("+ \\fr 9:54 \\ft BYZ and TR from heaven, just as Elijah did; see \\+xt 2 Kings 1:10–12\\+xt*.").refs.is_empty());
        let n =
            read_note("+ \\fr 1:13 \\ft Or one like a son of man; see \\+xt Daniel 7:13\\+xt*.");
        assert_eq!(n.refs, vec![(Kind::See, "Daniel 7:13".to_string())]);
        let n = read_note(
            "+ \\fr 53:1 \\ft Cited in \\+xt John 12:38\\+xt* and \\+xt Romans 10:16\\+xt*",
        );
        assert_eq!(
            n.refs.iter().map(|r| r.0).collect::<Vec<_>>(),
            vec![Kind::Cited; 2]
        );
        assert!(has_word(
            &read_note("+ \\fr 1:6 \\ft \\+xt Deuteronomy 32:43\\+xt* (see DSS and LXX)").plain,
            "DSS"
        ));
    }

    #[test]
    fn reference_lists() {
        let one = |b: u8| b == 64;
        let deut = refs::parse_book("Deuteronomy").unwrap();
        assert_eq!(
            ref_list("Deuteronomy 13:5, 17:7, 19:19, and 24:7", one),
            Some(vec![
                (deut, 13, 5, 13, 5),
                (deut, 17, 7, 17, 7),
                (deut, 19, 19, 19, 19),
                (deut, 24, 7, 24, 7)
            ])
        );
        let isa = refs::parse_book("Isaiah").unwrap();
        assert_eq!(
            ref_list("Isaiah 61:1–2", one),
            Some(vec![(isa, 61, 1, 61, 2)])
        );
        assert_eq!(
            ref_list("Isaiah 7:14,", one),
            Some(vec![(isa, 7, 14, 7, 14)])
        );
        let heb = refs::parse_book("Hebrews").unwrap();
        assert_eq!(
            ref_list("Hebrews 9:1 and 18,", one),
            Some(vec![(heb, 9, 1, 9, 1), (heb, 9, 18, 9, 18)])
        );
        let (mark, luke) = (
            refs::parse_book("Mark").unwrap(),
            refs::parse_book("Luke").unwrap(),
        );
        assert_eq!(
            ref_list("Mark 1:40–2:12, Luke 7:27", one),
            Some(vec![(mark, 1, 40, 2, 12), (luke, 7, 27, 7, 27)])
        );
        assert_eq!(
            ref_list("Psalm 16:8–11", one),
            Some(vec![(18, 16, 8, 16, 11)])
        );
        assert_eq!(ref_list("Jude 14", one), Some(vec![(64, 1, 14, 1, 14)]));
        assert_eq!(ref_list("Jasher 79:27", one), None);
        assert_eq!(ref_list("Psalm 22", one), None);
    }

    fn verses(texts: &[&str]) -> Vec<UVerse> {
        texts
            .iter()
            .enumerate()
            .map(|(i, t)| UVerse {
                chapter: 1,
                verse: i as u16 + 1,
                text: t.chars().collect(),
                notes: Vec::new(),
            })
            .collect()
    }

    fn quoted(book: &[UVerse], s: Span) -> String {
        let mut out = Vec::new();
        for k in s.start.0..=s.end.0 {
            let t = &book[k].text;
            let a = if k == s.start.0 { s.start.1 + 1 } else { 0 };
            let b = if k == s.end.0 { s.end.1 } else { t.len() };
            out.push(text(&t[a..b]));
        }
        out.join(" ")
    }

    #[test]
    fn quoted_words() {
        let book = verses(&[
            "He found the place where it was written:",
            "“The Spirit of the Lord is on Me, ‘the year of the Lordʼs favor.’ ”",
        ]);
        let off = book[1].text.len();
        let sp = find_span(&book, 1, off).unwrap();
        assert!(sp.closed);
        assert_eq!(
            quoted(&book, sp),
            "The Spirit of the Lord is on Me, ‘the year of the Lordʼs favor.’ "
        );
        // After the inner closing mark: only the inner quotation.
        let inner = book[1].text.len() - 2;
        assert_eq!(
            quoted(&book, find_span(&book, 1, inner).unwrap()),
            "the year of the Lordʼs favor."
        );
        // Inside a quotation that closes later.
        let book = verses(&["as it is written: “See, I lay in Zion a stone of stumbling and a rock of offense; and the one who believes"]);
        let off = book[0].text.iter().position(|&c| c == ';').unwrap() + 1;
        let sp = find_span(&book, 0, off).unwrap();
        assert!(!sp.closed);
        assert_eq!(
            quoted(&book, sp),
            "See, I lay in Zion a stone of stumbling and a rock of offense"
        );
        // Not in quotation marks at all.
        let book = verses(&["“He committed no sin.”", "He Himself bore our sins"]);
        assert_eq!(find_span(&book, 1, book[1].text.len()), None);
    }

    #[test]
    fn lists_of_quotations() {
        let named_in = |ot: &str| {
            let keys = keys_of(ot);
            move |w: &[char]| keys_of(&text(w)).iter().any(|k| keys.contains(k))
        };
        let ten = named_in("You shall not murder. You shall not commit adultery. You shall not steal. You shall not bear false witness against your neighbor. You shall not covet your neighbor’s house.");
        let mut book = verses(&["The commandments “Do not commit adultery,” “Do not murder,” “Do not steal,” “Do not covet,” and any other commandments, are summed up in this one decree: “Love your neighbor as yourself.”"]);
        let t = text(&book[0].text);
        let covet = t.find(" and any").map(|i| t[..i].chars().count()).unwrap();
        book[0].notes = vec![
            (covet, "Exodus 20:13–17".into()),
            (book[0].text.len(), "Leviticus 19:18".into()),
        ];
        let first = with_list(&book, find_span(&book, 0, covet).unwrap(), &ten);
        assert_eq!(
            quoted(&book, first),
            "Do not commit adultery,” “Do not murder,” “Do not steal,” “Do not covet,"
        );
        // Words between end the list.
        let end = book[0].text.len();
        let last = find_span(&book, 0, end).unwrap();
        assert_eq!(with_list(&book, last, &ten), last);
        // So do a footnote of its own, and words of no passage the footnote names.
        let ps118 = named_in("Blessed is he who comes in the name of the LORD. From the house of the LORD we bless you.");
        let mut book =
            verses(&["shouting: “Hosanna!” “Blessed is He who comes in the name of the Lord!”"]);
        let end = book[0].text.len();
        let s = find_span(&book, 0, end).unwrap();
        assert_eq!(with_list(&book, s, &ps118), s);
        assert_eq!(
            quoted(&book, with_list(&book, s, |_: &[char]| true)),
            "Hosanna!” “Blessed is He who comes in the name of the Lord!"
        );
        let hosanna = text(&book[0].text).find("” “").unwrap();
        let hosanna = text(&book[0].text)[..hosanna].chars().count() + 1;
        book[0].notes = vec![(hosanna, "Psalm 118:25".into())];
        assert_eq!(with_list(&book, s, |_: &[char]| true), s);
    }

    #[test]
    fn introductions() {
        let f = |t: &str| {
            let r: Vec<char> = t.chars().collect();
            find_formula(&r, FORMULAS).or_else(|| find_formula(&r, SAID))
        };
        assert_eq!(
            f("This is he who was spoken of through the prophet Isaiah: ").as_deref(),
            Some("This is he who was spoken of through the prophet Isaiah")
        );
        assert_eq!(
            f("But Jesus answered, “It is written: ").as_deref(),
            Some("It is written")
        );
        assert_eq!(f("“In Bethlehem in Judea,” they replied, “for this is what the prophet has written: ").as_deref(), Some("for this is what the prophet has written"));
        assert_eq!(
            f("For to which of the angels did God ever say, ").as_deref(),
            Some("For to which of the angels did God ever say")
        );
        // An earlier quotation inside the introduction is shortened.
        assert_eq!(f("“Have you not read that from the beginning the Creator ‘made them male and female,’ and said, ").as_deref(), Some("Have you not read that from the beginning the Creator ‘…’ and said"));
        assert_eq!(
            f("You are My Son; today I have become Your Father”? Or again, ").as_deref(),
            Some("Or again")
        );
        assert_eq!(
            f("About the ninth hour Jesus cried out in a loud voice, which means, "),
            None
        );
        // Anyone who says the words introduces them, where nothing stronger does.
        assert_eq!(
            f("For He who said, “Do not commit adultery,” also said, ").as_deref(),
            Some("also said")
        );
        assert_eq!(
            f("For what does the Scripture say? ").as_deref(),
            Some("For what does the Scripture say?")
        );
        assert_eq!(
            f("Jesus replied, “It is also written: ").as_deref(),
            Some("It is also written")
        );
        assert_eq!(f("Shall what is formed say to Him who formed it, "), None);
        // An introduction that runs on through an earlier quotation.
        assert_eq!(f("As it is written in Isaiah the prophet: “Behold, I will send My messenger ahead of You, who will prepare Your way.” ").as_deref(), Some("As it is written in Isaiah the prophet: “…”"));
        assert_eq!(f("Therefore God again designated a certain day as “Today,” when a long time later He spoke through David as was just stated: ").as_deref(), Some("…again designated a certain day as “Today,” when a long time later He spoke through David as was just stated"));
        let lead = |t: &str| find_lead(&t.chars().collect::<Vec<_>>());
        assert_eq!(
            lead("Teacher, Moses wrote for us that if a man’s brother dies").as_deref(),
            Some("Moses wrote for us that")
        );
        assert_eq!(lead("The Lord said to my Lord, Sit at My right hand"), None);
    }

    #[test]
    fn english_words() {
        assert_eq!(
            ["calling", "called", "calls", "call"].map(stem),
            ["call"; 4]
        );
        assert_eq!(["stripes", "stripe"].map(stem), ["strip"; 2]);
        assert_eq!(
            ["prepared", "prepare", "preparing"].map(stem),
            ["prepar"; 3]
        );
        assert_eq!(["cities", "city"].map(stem), ["city"; 2]);
        assert_eq!(["sinned", "sin"].map(stem), ["sin"; 2]);
        assert_eq!(stem("blessed"), "bless");
        assert_eq!(key("the"), None);
        assert_eq!(key("lord's").as_deref(), Some("lord"));
        let w: Vec<String> = tokens(&"The Lord’s way, John’s".chars().collect::<Vec<_>>())
            .into_iter()
            .map(|t| t.word)
            .collect();
        assert_eq!(w, ["the", "lord's", "way", "john's"]);
    }

    fn side(v: u32, t: &str) -> Vec<(u32, Tok)> {
        tokens(&t.chars().collect::<Vec<_>>())
            .into_iter()
            .map(|x| (v, x))
            .collect()
    }

    #[test]
    fn closeness_of_wording() {
        let m = measure(
            &side(0, "My God, My God, why have You forsaken Me?"),
            &side(
                1,
                "My God, My God, why have You forsaken me? Why are You so far from saving me?",
            ),
        );
        assert_eq!(closeness(&m, true), 0);
        // Woven into a sentence of one's own: two key words, both shared.
        let m = measure(&side(0, "By His stripes you are healed."), &side(1, "But He was pierced for our transgressions, He was crushed for our iniquities; the punishment that brought us peace was upon Him, and by His stripes we are healed."));
        assert_eq!((closeness(&m, true), m.shared.len()), (1, 2));
        let m = measure(
            &side(0, "Do not muzzle an ox while it is treading out the grain."),
            &side(1, "God with us"),
        );
        assert_eq!(closeness(&m, true), 2);
    }

    #[test]
    fn several_passages_quoted_together() {
        let words = |t: &str, nt: &[(u32, Tok)], r: Range<usize>| -> String {
            let cs: Vec<char> = t.chars().collect();
            text(&cs[nt[r.start].1.at..nt[r.end - 1].1.end])
        };
        // Matthew 19:18–19 ends with Leviticus 19:18 word for word; "bear"
        // ("bear false witness", "bear a grudge") keeps it at close.
        let mt = "Do not murder, do not commit adultery, do not steal, do not bear false witness, honor your father and mother, and love your neighbor as yourself.";
        let ex = "Honor your father and your mother. You shall not murder. You shall not commit adultery. You shall not steal. You shall not bear false witness against your neighbor.";
        let lev = "Do not seek revenge or bear a grudge against any of your people, but love your neighbor as yourself. I am the LORD.";
        let chars: Vec<Vec<char>> = vec![mt.chars().collect()];
        let nt = side(0, mt);
        let cs = clauses(&chars, &nt);
        assert_eq!(cs.len(), 6);
        let named = [keys_of(ex), keys_of(lev)];
        let (r, rest) = part_from(&nt, &cs, &named, 1).unwrap();
        assert_eq!(
            words(mt, &nt, r.clone()),
            "and love your neighbor as yourself"
        );
        assert!(rest);
        let m = measure(&nt[r], &side(1, lev));
        assert_eq!((m.run, closeness(&m, true)), (5, 0));
        assert_eq!(closeness(&measure(&nt, &side(1, lev)), true), 2);
        let (r, _) = part_from(&nt, &cs, &named, 0).unwrap();
        assert_eq!(
            words(mt, &nt, r),
            "Do not murder, do not commit adultery, do not steal, do not bear false witness, honor your father and mother"
        );
        // One passage alone gives every clause: the whole is compared.
        assert!(part_from(&nt, &cs, &named[..1], 0).is_none());
        // Romans 11:8: Deuteronomy 29:4 gives all but the first clause.
        let rom = "God gave them a spirit of stupor, eyes that could not see, and ears that could not hear, to this very day.";
        let deut = "Yet to this day the LORD has not given you a mind to understand, eyes to see, or ears to hear.";
        let isa = "For the LORD has poured out on you a spirit of deep sleep. He has shut your eyes, O prophets; He has covered your heads, O seers.";
        let chars: Vec<Vec<char>> = vec![rom.chars().collect()];
        let nt = side(0, rom);
        let cs = clauses(&chars, &nt);
        let (r, rest) = part_from(&nt, &cs, &[keys_of(deut), keys_of(isa)], 0).unwrap();
        assert_eq!(
            words(rom, &nt, r.clone()),
            "eyes that could not see, and ears that could not hear, to this very day"
        );
        assert!(!rest);
        assert_eq!(closeness(&measure(&nt[r], &side(1, deut)), true), 1);
        assert_eq!(closeness(&measure(&nt, &side(1, deut)), true), 2);
    }

    #[test]
    fn hebrew_words() {
        assert!(heb_eq(&heb_key("עשׂה"), &heb_key("עָשָׂה")));
        assert!(heb_eq(&heb_key("קרא"), &heb_key("קָרָא")));
        assert!(!heb_eq(&heb_key("שָׁמַר"), &heb_key("שׂמר")));
        assert!(heb_eq(&heb_key("דֶּרֶךְ"), &heb_key("דרכ")));
        let notes = lxx_notes(" <b>βοάω</b>, -ῶ <BR /> (βοή), [in LXX chiefly for זעק, צעק, קרא ;] <BR /> __1. (Heb. זעק על)");
        assert_eq!(notes.len(), 3);
        assert!(notes
            .iter()
            .any(|n| heb_eq(n, &heb_key("קוֹרֵא")) || heb_eq(n, &heb_key("קָרָא"))));
        assert!(
            hebrew_content("HR/Ncmpc/Sp1bp")
                && hebrew_content("HVqrmsa")
                && !hebrew_content("HTn")
                && !hebrew_content("HC")
        );
        assert!(
            greek_content("N-NSF")
                && greek_content("V-AAM-2P")
                && !greek_content("T-NSM")
                && !greek_content("PREP")
        );
    }

    #[test]
    fn places_in_the_shown_text() {
        let u: Vec<char> = "Johnʼs disciples said, “Why?”".chars().collect();
        let j: Vec<char> = "John’s disciples said, “Why?”".chars().collect();
        assert_eq!(map_place(&u, &j, 23), Some(23));
        let j2: Vec<char> = "Then John’s disciples asked, “Why?”".chars().collect();
        assert_eq!(map_place(&u, &j2, 23), Some(29));
        assert_eq!(map_place(&u, &j2, 5), None);
        assert_eq!(utf16_at(&j, 6), 6);
    }
}
