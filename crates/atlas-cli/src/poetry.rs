//! The BSB's own poetry lines, read from its USFM edition (`bsb-usfm`),
//! where `\q1`, `\q2` and `\qr` start a line. Figures at Deep check that a
//! parallel note's lines are the BSB's lines (the local plan's fit.md, 4.2,
//! point 1).
//!
//! The English the app shows comes from BSB.json, a slightly different copy
//! (the USFM is a fork of the text as of 26 August 2024), so the lines are
//! placed by words: a verse is used only where its USFM words, ignoring case
//! and punctuation, are the same words as its BSB.json text. That holds for
//! 8,066 of the 8,179 verses the USFM sets as poetry; the other 113, whose
//! wording differs, are not checked. A psalm's title is a `\d` line in the
//! USFM and sits in front of verse 1 in BSB.json, so it counts as verse 1's
//! first line; a subscription after a verse (Habakkuk 3:19) is that verse's
//! last line. A verse that starts as prose and turns into poetry ("He said:"
//! and then the lines) keeps its prose part as a line of its own, and words
//! that are all prose are not checked. Lines are numbered through each book,
//! so a line that runs on into the next verse (Psalm 96:12 to 13) is one line.

use crate::sources::Inputs;
use atlas_core::{Versification, BOOKS};
use std::collections::HashMap;
use std::fs;

pub const SOURCE: &str = "bsb-usfm";

/// A piece of a verse: its line, whether the line is poetry, and its words.
type Seg = (u16, bool, String);
/// Each verse's pieces, by (chapter, verse).
type Verses = Vec<((u16, u16), Vec<Seg>)>;

/// Markers that start a line of text. Only the first three are poetry.
const POETRY: [&str; 3] = ["q1", "q2", "qr"];
const PROSE: [&str; 8] = ["p", "m", "pmo", "pi1", "pc", "li1", "li2", "nb"];

/// A word's line: its book in the high 16 bits, then the line's number in
/// the book's USFM; and whether the line is poetry.
type Word = (u32, bool);

/// For each verse the BSB sets as poetry, each word's line.
#[derive(Default)]
pub struct Poetry {
    lines: HashMap<u32, Vec<Word>>,
    /// Verses the USFM sets as poetry, placed or not.
    poetry: usize,
}

/// Where a quotation sits among a verse's poetry lines.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub struct Placed {
    pub first: u32,
    pub last: u32,
    /// The quotation starts with the first word of its first line and ends
    /// with the last word of its last line.
    pub whole: bool,
}

impl Poetry {
    pub fn read(inputs: &Inputs, vz: &Versification, text: &[String]) -> Result<Self, String> {
        let mut lines = HashMap::new();
        let mut poetry = 0;
        for (b, book) in BOOKS.iter().enumerate() {
            let path = inputs.path(SOURCE, book.osis);
            let usfm = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
            for ((ch, vv), segs) in parse(&usfm) {
                if !segs.iter().any(|s| s.1) {
                    continue;
                }
                poetry += 1;
                let Some(v) = vz.index(b as u8, ch, vv) else { continue };
                if let Some(l) = placed(&segs, &text[v as usize], (b as u32) << 16) {
                    lines.insert(v, l);
                }
            }
        }
        Ok(Self { lines, poetry })
    }

    /// How many verses' lines are known.
    pub fn verses(&self) -> usize {
        self.lines.len()
    }

    /// How many verses the USFM sets as poetry.
    pub fn poetry_verses(&self) -> usize {
        self.poetry
    }

    /// Where `text[from..to]` of verse `v` (its BSB.json text) sits among the
    /// BSB's poetry lines, or None where the BSB does not set it as poetry
    /// (all its words are prose) or the verse's lines could not be placed.
    pub fn place(&self, v: u32, text: &str, from: usize, to: usize) -> Option<Placed> {
        let line = self.lines.get(&v)?;
        let toks = tokens(text);
        if toks.len() != line.len() {
            return None;
        }
        let first = toks.iter().position(|&(_, e)| e > from)?;
        let last = toks.iter().rposition(|&(s, _)| s < to)?;
        if last < first || line[first..=last].iter().all(|w| !w.1) {
            return None;
        }
        let (a, z) = (line[first].0, line[last].0);
        // The words just outside the quotation, looking into the verses on
        // either side, since a line may run on from one verse to the next.
        let before = match first {
            0 => v.checked_sub(1).and_then(|u| self.lines.get(&u)).and_then(|l| l.last()).map(|w| w.0),
            i => Some(line[i - 1].0),
        };
        let after = line.get(last + 1).or_else(|| self.lines.get(&(v + 1)).and_then(|l| l.first())).map(|w| w.0);
        let whole = before != Some(a) && after != Some(z);
        Some(Placed { first: a, last: z, whole })
    }
}

/// The verse's words, each with its line (`book` in the high bits), if the
/// USFM's words are the same as `text`'s.
fn placed(segs: &[Seg], text: &str, book: u32) -> Option<Vec<Word>> {
    if !segs.iter().any(|s| s.1) {
        return None;
    }
    let mut words = Vec::new();
    let mut line = Vec::new();
    for (id, poetry, t) in segs {
        let ws: Vec<String> = tokens(t).into_iter().map(|(s, e)| fold(&t[s..e])).collect();
        line.extend(std::iter::repeat_n((book | u32::from(*id), *poetry), ws.len()));
        words.extend(ws);
    }
    let bsb: Vec<String> = tokens(text).into_iter().map(|(s, e)| fold(&text[s..e])).collect();
    (bsb == words).then_some(line)
}

/// A word for comparing the two copies: lowercased, with one apostrophe.
fn fold(w: &str) -> String {
    w.chars().map(|c| if c == '\'' || c == 'ʼ' { '’' } else { c }).flat_map(char::to_lowercase).collect()
}

/// The byte ranges of a text's words: runs of letters, digits and
/// apostrophes, so "it’s" is one word and "well-being" two, in both copies.
/// A run with no letter or digit is a closing quotation mark ("generations.’”"),
/// not a word.
fn tokens(t: &str) -> Vec<(usize, usize)> {
    let word = |c: char| c.is_alphanumeric() || c == '’' || c == '\'' || c == 'ʼ';
    let mut out = Vec::new();
    let mut start = None;
    for (i, c) in t.char_indices() {
        match (word(c), start) {
            (true, None) => start = Some(i),
            (false, Some(s)) => {
                out.push((s, i));
                start = None;
            }
            _ => {}
        }
    }
    if let Some(s) = start {
        out.push((s, t.len()));
    }
    out.retain(|&(s, e)| t[s..e].chars().any(char::is_alphanumeric));
    out
}

/// Text without footnotes, cross-references or character markers.
fn clean(t: &str) -> String {
    let mut out = String::new();
    let mut rest = t;
    while let Some(i) = rest.find('\\') {
        out.push_str(&rest[..i]);
        let after = &rest[i + 1..];
        let end = after.find(|c: char| !(c.is_ascii_alphanumeric() || c == '+' || c == '*')).unwrap_or(after.len());
        let marker = &after[..end];
        rest = &after[end..];
        if marker == "f" || marker == "x" {
            // Skip the note to its closing marker.
            let close = format!("\\{marker}*");
            rest = rest.find(&close).map_or("", |j| &rest[j + close.len()..]);
        } else if !marker.ends_with('*') && rest.starts_with(' ') {
            // Only an opening marker takes the space after it ("\\nd Lord\\nd* has").
            rest = &rest[1..];
        }
    }
    out.push_str(rest);
    out
}

/// Each verse's text in the order it comes, as (line, is poetry, words),
/// by (chapter, verse). A line is the text from one line marker to the next.
fn parse(usfm: &str) -> Verses {
    let mut out: Verses = Vec::new();
    let (mut ch, mut vv, mut id, mut poetry) = (0u16, 0u16, 0u16, false);
    let mut title: Option<(u16, String)> = None;
    fn push(out: &mut Verses, key: (u16, u16), seg: Seg) {
        match out.last_mut() {
            Some((k, segs)) if *k == key => segs.push(seg),
            _ => out.push((key, vec![seg])),
        }
    }
    for raw in usfm.lines() {
        let (marker, rest) = match raw.strip_prefix('\\') {
            Some(r) => r.split_once(' ').unwrap_or((r, "")),
            None => ("", raw),
        };
        let rest = match marker {
            "c" => {
                ch = rest.split_whitespace().next().and_then(|n| n.parse().ok()).unwrap_or(0);
                vv = 0;
                continue;
            }
            "d" => {
                id += 1;
                if vv > 0 {
                    // A subscription after the verse it closes (Habakkuk 3:19).
                    push(&mut out, (ch, vv), (id, false, clean(rest)));
                } else {
                    title = Some((id, clean(rest)));
                }
                continue;
            }
            "v" => format!("\\v {rest}"),
            "" => rest.to_string(),
            m if POETRY.contains(&m) || PROSE.contains(&m) => {
                id += 1;
                poetry = POETRY.contains(&m);
                rest.to_string()
            }
            _ => {
                // A heading, a stanza break or another marker that is not verse text.
                id += 1;
                poetry = false;
                continue;
            }
        };
        let mut parts = rest.split("\\v ");
        let mut pieces = vec![(None, parts.next().unwrap_or("").to_string())];
        for p in parts {
            let (n, t) = p.split_once(' ').unwrap_or((p, ""));
            pieces.push((n.parse::<u16>().ok(), t.to_string()));
        }
        for (n, t) in pieces {
            if let Some(n) = n {
                vv = n;
                if n == 1 {
                    if let Some((tid, tt)) = title.take() {
                        push(&mut out, (ch, 1), (tid, false, tt));
                    }
                }
            }
            if vv == 0 {
                continue;
            }
            let t = clean(&t);
            if !t.trim().is_empty() {
                push(&mut out, (ch, vv), (id, poetry, t));
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const PS: &str = "\\c 3\n\\d A Psalm of David, when he fled.\n\\q1\n\\v 1 O LORD, how my foes\\f + \\fr 3:1 \\ft Or \\fq enemies\\f* increase!\n\\q2 How many rise up against me!\n\\q1\n\\v 2 Many say of me,\n\\q2 “God will not deliver him.”\n\\qr Selah\n\\b\n\\p\n\\v 3 Then he said, \\wj “Come.”\\wj*\n\\q1 But You, O LORD,\n\\q2 are a shield around me.\n";

    fn segs(usfm: &str, v: u16) -> Vec<Seg> {
        parse(usfm).into_iter().find(|(k, _)| k.1 == v).unwrap().1
    }

    fn lines_of(v: u16, text: &str) -> Option<Vec<u32>> {
        placed(&segs(PS, v), text, 0).map(|l| l.iter().map(|w| w.0).collect())
    }

    /// The lines of `usfm`'s verses `vs`, placed on `texts`, at verse
    /// indexes 7, 8 and so on.
    fn poetry(usfm: &str, vs: &[(u16, &str)]) -> Poetry {
        let lines = vs.iter().enumerate().map(|(i, (v, t))| (7 + i as u32, placed(&segs(usfm, *v), t, 0).unwrap())).collect();
        Poetry { lines, poetry: 0 }
    }

    #[test]
    fn reads_lines() {
        let p = parse(PS);
        assert_eq!(p.len(), 3);
        let v1: Vec<&str> = p[0].1.iter().map(|s| s.2.as_str()).collect();
        assert_eq!(v1, ["A Psalm of David, when he fled.", "O LORD, how my foes increase!", "How many rise up against me!"]);
        assert!(!p[0].1[0].1 && p[0].1[1].1);
        assert_eq!(p[2].1[0].2, "Then he said, “Come.”");
        assert!(!p[2].1[0].1);
    }

    #[test]
    fn places_lines_on_the_bsb_text() {
        let t = "A Psalm of David, when he fled. O LORD, how my foes increase! How many rise up against me!";
        assert_eq!(lines_of(1, t), Some(vec![1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3]));
        // Other wording is not placed.
        assert_eq!(lines_of(1, "A Psalm of David. O LORD, how my enemies increase! How many rise up against me!"), None);
        let t = "Many say of me, “God will not deliver him.” Selah";
        let poetry = poetry(PS, &[(2, t)]);
        let at = |s: &str| t.find(s).unwrap();
        let place = |s: &str| poetry.place(7, t, at(s), at(s) + s.len());
        assert_eq!(place("Many say of me,"), Some(Placed { first: 4, last: 4, whole: true }));
        assert_eq!(place("God will not"), Some(Placed { first: 5, last: 5, whole: false }));
        assert_eq!(place("of me, “God"), Some(Placed { first: 4, last: 5, whole: false }));
        assert_eq!(place("Many say of me, “God will not deliver him.”"), Some(Placed { first: 4, last: 5, whole: true }));
        assert_eq!(poetry.place(8, t, 0, 4), None);
    }

    #[test]
    fn prose_alone_is_not_poetry() {
        assert_eq!(parse("\\c 1\n\\p\n\\v 1 In the beginning.\n\\v 2 Now.\n").len(), 2);
        let p = parse("\\c 1\n\\p\n\\v 1 In the beginning.\n");
        assert_eq!(placed(&p[0].1, "In the beginning.", 0), None);
        // In a verse that turns from prose to poetry, the prose words are not checked.
        let t = "Then he said, “Come.” But You, O LORD, are a shield around me.";
        let poetry = poetry(PS, &[(3, t)]);
        let at = |s: &str| t.find(s).unwrap();
        let place = |s: &str| poetry.place(7, t, at(s), at(s) + s.len());
        assert_eq!(place("Then he said,"), None);
        assert_eq!(place("But You, O LORD,"), Some(Placed { first: 9, last: 9, whole: true }));
    }

    #[test]
    fn keeps_the_text_around_markers() {
        assert_eq!(clean("the \\nd Lord\\nd* has spoken"), "the Lord has spoken");
        assert_eq!(clean("the \\nd Lord\\nd*, who"), "the Lord, who");
        // A closing quotation mark on its own is not a word.
        assert_eq!(tokens("and give you peace. ’").len(), 4);
        assert_eq!(tokens("all generations.’”").len(), 2);
    }

    #[test]
    fn a_subscription_is_the_last_line() {
        let hab = "\\c 3\n\\q1\n\\v 19 GOD the Lord is my strength;\n\\q2 He makes my feet like those of a deer.\n\\d For the choirmaster. With stringed instruments.\n";
        let s = segs(hab, 19);
        assert_eq!(s.len(), 3);
        assert_eq!(s[2], (3, false, "For the choirmaster. With stringed instruments.".to_string()));
        let t = "GOD the Lord is my strength; He makes my feet like those of a deer. For the choirmaster. With stringed instruments.";
        assert!(placed(&s, t, 0).is_some());
    }

    #[test]
    fn a_line_may_run_into_the_next_verse() {
        let ps = "\\c 96\n\\q1\n\\v 12 Let the fields exult,\n\\q2 and all that is in them.\n\\q1 Then all the trees of the forest\n\\q2 will sing for joy\n\\v 13 before the LORD, for He is coming.\n";
        let t12 = "Let the fields exult, and all that is in them. Then all the trees of the forest will sing for joy";
        let t13 = "before the LORD, for He is coming.";
        let poetry = poetry(ps, &[(12, t12), (13, t13)]);
        let at = |s: &str| t12.find(s).unwrap();
        let place = |s: &str| poetry.place(7, t12, at(s), at(s) + s.len());
        assert_eq!(place("and all that is in them."), Some(Placed { first: 2, last: 2, whole: true }));
        // The line goes on into verse 13, so it is not whole.
        assert_eq!(place("will sing for joy"), Some(Placed { first: 4, last: 4, whole: false }));
        assert_eq!(poetry.place(8, t13, 0, t13.len()), Some(Placed { first: 4, last: 4, whole: false }));
    }
}
