//! The Syriac Peshitta: an early translation of the New Testament into Syriac,
//! a dialect of Aramaic, made from the Greek around AD 350-450. It is shown at
//! Deep only, and always as a translation: it shows how early Aramaic-speaking
//! Christians read a verse, not the words Jesus himself spoke.
//!
//! Source: the Digital Syriac Corpus (srophe/syriac-corpus), one TEI XML file
//! per book. Each file's header carries the license this module relies on
//! (TEI edition by James E. Walters, CC BY 4.0; base text, The New Testament in
//! Syriac, British and Foreign Bible Society 1905, public domain, transcribed by
//! George A. Kiraz), and the build stops if a file lacks it. The files are read
//! as untrusted text with plain string scanning: no XML parser, no entities
//! beyond the five standard ones and numeric references, and everything left
//! out is counted and reported.
//!
//! The text keeps its vowel points. Changes, all reported by the build and
//! noted in sources.json:
//! - whitespace is collapsed; characters outside the Syriac letters, points and
//!   punctuation are removed (the transcription's "+" before some plural words);
//! - verses are placed in the BSB's numbering. The source numbers them the same
//!   way apart from four places, each handled by name below (`MOVES`) and
//!   checked by `verify()`: Luke 10:42 is coded inside chapter 11; 3 John 1:15
//!   is the end of the BSB's 1:14; Romans 16:24-27 has the closing blessing last
//!   where the BSB (in its footnote) has it first; and Matthew 23:13-14 has its
//!   two woes in the other order.
//!
//! 2 Peter, 2 and 3 John, Jude, Revelation and John 7:53-8:11 were not part of
//! the early Peshitta; printed Syriac New Testaments fill them in from later
//! Syriac translations. The source's headers do not say so (they give every
//! book the same 350-450 date), so the list here (`LATER_BOOKS`, `LATER_JOHN`)
//! comes from the scholarship and is marked in the output.
//!
//! Each verse also gets an approximate romanization, read letter by letter from
//! the vowel points (`romanize`).
//!
//! Output, under `web/public/data/`:
//! - `extras/peshitta.json`: `{format, have, later}`, runs of verse numbers
//!   `[from, to]` that have Syriac, and those that come from a later version.
//!   Small: it loads with the first verse a reader selects at Deep.
//! - `extras/peshitta/<Book>.json`: `{format, first, syc, rom, notes, omitted,
//!   status, date}`: the Syriac and its romanization for each verse of the book
//!   (index = verse number - first, "" where there is none), notes on verses
//!   placed by name `{verse: [kind, source number]}`, the verses the BSB leaves
//!   out of its text (it gives them in footnotes), the source's revision status
//!   and its date for the translation. It loads when the panel opens.

use crate::loaded::Loaded;
use crate::sources::Inputs;
use atlas_core::canon::{BOOKS, FIRST_NT_BOOK};
use atlas_core::Versification;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::fs;

const SOURCE: &str = "dsc-peshitta";
const OUT: &str = "extras/peshitta.json";
const DIR: &str = "extras/peshitta";

/// Every file's header must carry this license.
const LICENCE: &str = r#"<licence target="http://creativecommons.org/licenses/by/4.0/">"#;
const LICENCE_NOTE: &str = "The TEI XML edition is copyrighted by James E. Walters";
const PUBLIC_DOMAIN: &str = "The Syriac base text is in the public domain.";

/// Books the early Peshitta did not have.
const LATER_BOOKS: [&str; 5] = ["2Pet", "2John", "3John", "Jude", "Rev"];
/// John 7:53-8:11, which the early Peshitta did not have either.
const LATER_JOHN: ((u16, u16), (u16, u16)) = ((7, 53), (8, 11));

/// What a verse placed by name says in the panel (the web side words it).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Kind {
    /// The source codes the verse in the wrong chapter.
    Coded,
    /// The source has two verses in the other order.
    Order,
    /// The source numbers the verse differently.
    Number,
    /// The source splits the BSB's verse in two.
    Split,
}

impl Kind {
    fn key(self) -> &'static str {
        match self {
            Kind::Coded => "coded",
            Kind::Order => "order",
            Kind::Number => "number",
            Kind::Split => "split",
        }
    }
}

/// A verse the source numbers differently from the BSB: book, the source's
/// chapter and verse, the BSB's chapter and verse, and why.
struct Move {
    book: &'static str,
    from: (u16, u16),
    to: (u16, u16),
    kind: Kind,
}

const MOVES: [Move; 8] = [
    // Coded as a second n="42" at the top of chapter 11's div, before 11:1;
    // its words are Luke 10:42 ("Mary has chosen the good portion").
    Move {
        book: "Luke",
        from: (11, 42),
        to: (10, 42),
        kind: Kind::Coded,
    },
    // The source has the woe on devouring widows' houses first and the woe on
    // shutting the kingdom second; the BSB's 23:13 is the kingdom, and its
    // 23:14 (in a footnote) the widows.
    Move {
        book: "Matt",
        from: (23, 13),
        to: (23, 14),
        kind: Kind::Order,
    },
    Move {
        book: "Matt",
        from: (23, 14),
        to: (23, 13),
        kind: Kind::Order,
    },
    // The source ends Romans with the doxology at 16:24-26 and the blessing at
    // 16:27; the BSB has the doxology at 16:25-27 and leaves 16:24 (the
    // blessing) to a footnote.
    Move {
        book: "Rom",
        from: (16, 24),
        to: (16, 25),
        kind: Kind::Number,
    },
    Move {
        book: "Rom",
        from: (16, 25),
        to: (16, 26),
        kind: Kind::Number,
    },
    Move {
        book: "Rom",
        from: (16, 26),
        to: (16, 27),
        kind: Kind::Number,
    },
    Move {
        book: "Rom",
        from: (16, 27),
        to: (16, 24),
        kind: Kind::Number,
    },
    // The BSB has no 3 John 1:15: its 1:14 holds both.
    Move {
        book: "3John",
        from: (1, 15),
        to: (1, 14),
        kind: Kind::Split,
    },
];

/// What the scan of the files left out or changed, for the build's report.
#[derive(Default, Debug)]
struct Tally {
    verses: usize,
    plus: usize,
    removed_chars: usize,
    entities_dropped: usize,
    inner_tags: usize,
    stray_text: usize,
    other_markup: usize,
    outside_chapter: usize,
    bad_number: usize,
    empty: usize,
    out_of_order: usize,
    not_in_bsb: usize,
    duplicate: usize,
}

/// One `<ab type="verse">` as the file has it.
#[derive(Debug)]
struct RawVerse {
    chapter: u16,
    verse: u16,
    /// True when it comes before verse 1 inside its chapter's div.
    before_first: bool,
    text: String,
}

struct Header {
    status: String,
    date: (u32, u32),
}

// ------------------------------------------------------------- scanning

/// The value of `name="..."` in a tag's attributes.
fn attr<'a>(attrs: &'a str, name: &str) -> Option<&'a str> {
    let mut rest = attrs;
    let pat = format!("{name}=\"");
    loop {
        let i = rest.find(&pat)?;
        // A whole attribute name: at the start or after whitespace.
        let ok = i == 0 || rest[..i].ends_with(|c: char| c.is_whitespace());
        let after = &rest[i + pat.len()..];
        if ok {
            return after.find('"').map(|j| &after[..j]);
        }
        rest = after;
    }
}

/// The text between `<name ...>` and `</name>` for the first such element.
fn element<'a>(s: &'a str, open: &str, close: &str) -> Option<&'a str> {
    let i = s.find(open)?;
    let after = &s[i..];
    let gt = after.find('>')?;
    let body = &after[gt + 1..];
    body.find(close).map(|j| &body[..j])
}

fn collapse(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Decode the five standard entities and numeric references; anything else
/// that looks like an entity is dropped and counted.
fn decode(s: &str, t: &mut Tally) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(i) = rest.find('&') {
        out.push_str(&rest[..i]);
        let tail = &rest[i..];
        let end = tail.find(';').filter(|&j| j <= 12);
        let Some(j) = end else {
            // A bare ampersand: keep it as text (clean() decides about it).
            out.push('&');
            rest = &tail[1..];
            continue;
        };
        let name = &tail[1..j];
        let ch = match name {
            "amp" => Some('&'),
            "lt" => Some('<'),
            "gt" => Some('>'),
            "quot" => Some('"'),
            "apos" => Some('\''),
            _ => {
                let n = if let Some(h) = name.strip_prefix("#x").or_else(|| name.strip_prefix("#X"))
                {
                    u32::from_str_radix(h, 16).ok()
                } else if let Some(d) = name.strip_prefix('#') {
                    d.parse::<u32>().ok()
                } else {
                    None
                };
                n.and_then(char::from_u32)
            }
        };
        match ch {
            Some(c) => out.push(c),
            None => t.entities_dropped += 1,
        }
        rest = &tail[j + 1..];
    }
    out.push_str(rest);
    out
}

/// Syriac letters.
fn is_letter(c: char) -> bool {
    ('\u{0710}'..='\u{072F}').contains(&c)
}

/// Syriac points and the combining marks the text uses (seyame, the
/// feminine dot, the line below).
fn is_mark(c: char) -> bool {
    ('\u{0730}'..='\u{074A}').contains(&c) || ('\u{0300}'..='\u{036F}').contains(&c)
}

/// Syriac punctuation, and the full stop and colon the transcription uses.
fn is_punct(c: char) -> bool {
    ('\u{0700}'..='\u{070D}').contains(&c) || c == '.' || c == ':'
}

/// Keep only Syriac letters, points, punctuation and single spaces.
fn clean(s: &str, t: &mut Tally) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if is_letter(c) || is_mark(c) || is_punct(c) || c.is_whitespace() {
            out.push(c);
        } else if c == '+' {
            t.plus += 1;
        } else {
            t.removed_chars += 1;
        }
    }
    collapse(&out)
}

/// The letters only, without points or punctuation: for comparing texts.
pub fn letters(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars() {
        if is_letter(c) {
            out.push(c);
        } else if c.is_whitespace() && !out.ends_with(' ') && !out.is_empty() {
            out.push(' ');
        }
    }
    out.trim_end().to_string()
}

/// Read one TEI file's header: the license (required), the title (which must
/// name `book`), the revision status and the date of the translation.
fn header(xml: &str, book: &str) -> Result<Header, String> {
    let head = element(xml, "<teiHeader", "</teiHeader>").ok_or("no <teiHeader>")?;
    let flat = collapse(head);
    if !flat.contains(LICENCE) || !flat.contains(LICENCE_NOTE) || !flat.contains(PUBLIC_DOMAIN) {
        return Err("its header does not carry the CC BY 4.0 license of the TEI edition".into());
    }
    let title = head
        .match_indices("<title ")
        .find_map(|(i, _)| {
            let tag_end = head[i..].find('>')? + i;
            (attr(&head[i + 7..tag_end], "level") == Some("a")).then(|| {
                let body = &head[tag_end + 1..];
                collapse(&body[..body.find("<").unwrap_or(body.len())])
            })
        })
        .ok_or("no work title in its header")?;
    let named = title.match_indices(book).any(|(i, _)| {
        let before = &title[..i];
        let digit_before = before.trim_end().ends_with(|c: char| c.is_ascii_digit());
        (i == 0 || before.ends_with(' '))
            && (book.starts_with(|c: char| c.is_ascii_digit()) || !digit_before)
    });
    if !named {
        return Err(format!("its title {title:?} does not name {book}"));
    }
    let status = head
        .find("<revisionDesc")
        .and_then(|i| {
            let end = head[i..].find('>')? + i;
            attr(&head[i + 13..end], "status")
        })
        .unwrap_or("")
        .to_string();
    let date = head
        .find("<origDate")
        .and_then(|i| {
            let end = head[i..].find('>')? + i;
            let a = &head[i + 9..end];
            if attr(a, "type") != Some("translation") {
                return None;
            }
            Some((attr(a, "from")?.parse().ok()?, attr(a, "to")?.parse().ok()?))
        })
        .ok_or("no date of translation (<origDate type=\"translation\">) in its header")?;
    Ok(Header { status, date })
}

/// The verses of one TEI file's body, in file order.
fn verses(xml: &str, t: &mut Tally) -> Result<Vec<RawVerse>, String> {
    let start = xml.find("<body>").ok_or("no <body>")? + "<body>".len();
    let end = xml[start..].find("</body>").ok_or("no </body>")? + start;
    let body = &xml[start..end];

    let mut out = Vec::new();
    let mut chapter: Option<u16> = None;
    let mut seen_first = false;
    // The verse being read: its number (if valid) and its text so far.
    let mut verse: Option<(Option<u16>, String)> = None;
    // Inside a chapter heading or an <ab> that is not a verse (the book's
    // title): its text is not the Bible's, so it is skipped.
    let mut skip_text = false;
    let mut pos = 0;
    while pos < body.len() {
        let Some(lt) = body[pos..].find('<').map(|i| i + pos) else {
            if !body[pos..].trim().is_empty() {
                t.stray_text += 1;
            }
            break;
        };
        let text = &body[pos..lt];
        if let Some((_, buf)) = verse.as_mut() {
            buf.push_str(text);
        } else if !skip_text && !text.trim().is_empty() {
            t.stray_text += 1;
        }
        if body[lt..].starts_with("<!--") {
            let close = body[lt..].find("-->").ok_or("an unclosed comment")?;
            t.other_markup += 1;
            pos = lt + close + 3;
            continue;
        }
        let gt = body[lt..].find('>').ok_or("an unclosed tag")? + lt;
        let tag = &body[lt + 1..gt];
        pos = gt + 1;
        let closing = tag.starts_with('/');
        let inner = tag.trim_start_matches('/').trim_end_matches('/');
        let (name, attrs) = match inner.find(char::is_whitespace) {
            Some(i) => (&inner[..i], &inner[i..]),
            None => (inner, ""),
        };
        if let Some((n, buf)) = verse.take() {
            if closing && name == "ab" {
                t.verses += 1;
                let text = clean(&decode(buf.trim(), t), t);
                match (chapter, n) {
                    (None, _) => t.outside_chapter += 1,
                    (_, None) => t.bad_number += 1,
                    _ if text.is_empty() => t.empty += 1,
                    (Some(c), Some(v)) => {
                        let before_first = !seen_first && v != 1;
                        if v == 1 {
                            seen_first = true;
                        }
                        out.push(RawVerse {
                            chapter: c,
                            verse: v,
                            before_first,
                            text,
                        });
                    }
                }
            } else {
                // Markup inside a verse: the tag is dropped, its text kept.
                t.inner_tags += 1;
                verse = Some((n, buf));
            }
            continue;
        }
        match (closing, name) {
            (false, "div") => {
                chapter = None;
                if attr(attrs, "type") == Some("chapter") {
                    match attr(attrs, "n")
                        .and_then(|n| n.parse::<u16>().ok())
                        .filter(|&n| n > 0)
                    {
                        Some(c) => chapter = Some(c),
                        None => t.bad_number += 1,
                    }
                    seen_first = false;
                }
            }
            (true, "div") => chapter = None,
            (false, "ab") if attr(attrs, "type") == Some("verse") => {
                let n = attr(attrs, "n")
                    .and_then(|n| n.parse::<u16>().ok())
                    .filter(|&n| n > 0);
                if tag.ends_with('/') {
                    t.verses += 1;
                    t.empty += 1;
                } else {
                    verse = Some((n, String::new()));
                }
            }
            (false, "ab") => {
                skip_text = !tag.ends_with('/');
                t.other_markup += 1;
            }
            (false, "head") => skip_text = !tag.ends_with('/'),
            (true, "ab") | (true, "head") => skip_text = false,
            (_, "milestone") => {}
            _ => t.other_markup += 1,
        }
    }
    if verse.is_some() {
        return Err("a verse is not closed".into());
    }
    Ok(out)
}

// --------------------------------------------------------- romanization

/// The consonant each Syriac letter stands for, and its soft form (with the
/// rukkakha point) where it has one.
fn consonant(c: char) -> Option<(&'static str, &'static str)> {
    Some(match c {
        'ܐ' => ("ʾ", "ʾ"),
        'ܒ' => ("b", "ḇ"),
        'ܓ' => ("g", "ḡ"),
        'ܕ' => ("d", "ḏ"),
        'ܗ' => ("h", "h"),
        'ܘ' => ("w", "w"),
        'ܙ' => ("z", "z"),
        'ܚ' => ("ḥ", "ḥ"),
        'ܛ' => ("ṭ", "ṭ"),
        'ܝ' => ("y", "y"),
        'ܟ' => ("k", "ḵ"),
        'ܠ' => ("l", "l"),
        'ܡ' => ("m", "m"),
        'ܢ' => ("n", "n"),
        'ܣ' | 'ܤ' => ("s", "s"),
        'ܥ' => ("ʿ", "ʿ"),
        'ܦ' => ("p", "p̄"),
        'ܨ' => ("ṣ", "ṣ"),
        'ܩ' => ("q", "q"),
        'ܪ' => ("r", "r"),
        'ܫ' => ("š", "š"),
        'ܬ' => ("t", "ṯ"),
        _ => return None,
    })
}

/// The vowel a point stands for (the West Syriac points this text uses).
fn vowel(c: char) -> Option<char> {
    Some(match c {
        '\u{0730}' => 'a',
        '\u{0733}' => 'ā',
        '\u{0736}' => 'e',
        '\u{073A}' => 'i',
        '\u{073D}' => 'u',
        _ => return None,
    })
}

/// A letter with its points.
#[derive(Default)]
struct Cluster {
    letter: char,
    vowel: Option<char>,
    soft: bool,
    /// The line below (U+0331): here mostly a silent letter.
    line: bool,
}

/// One word, letter by letter: each letter, its vowel point, a soft
/// consonant where the rukkakha marks one, ī/ē/ū where a yudh or waw follows
/// its vowel as a vowel letter, no alaph where it is silent after a vowel,
/// "(ī)"/"(ū)" for a final unpointed yudh or waw that is written but not
/// said, and no letter where the line below marks alaph, he, nun, dalath,
/// heth, rish or waw silent. None if the word has a sign this does not know.
fn romanize_word(word: &str) -> Option<String> {
    let mut cs: Vec<Cluster> = Vec::new();
    for c in word.chars() {
        if consonant(c).is_some() {
            cs.push(Cluster {
                letter: c,
                ..Cluster::default()
            });
            continue;
        }
        let last = cs.last_mut()?;
        if let Some(v) = vowel(c) {
            last.vowel = Some(v);
        } else {
            match c {
                '\u{0741}' => {}
                '\u{0742}' => last.soft = true,
                '\u{0331}' => last.line = true,
                // Seyame (plural dots) and the feminine dot: no sound.
                '\u{0308}' | '\u{0307}' => {}
                _ => return None,
            }
        }
    }
    let mut out = String::new();
    // The vowel last written, while it can still be lengthened by a vowel letter.
    let mut open: Option<char> = None;
    let mut after_silent = false;
    let n = cs.len();
    for (i, c) in cs.iter().enumerate() {
        let last = i + 1 == n;
        if c.line && "ܐܗܢܕܚܪܘ".contains(c.letter) {
            // Silent; a vowel it carries is still said.
            if let Some(v) = c.vowel {
                out.push(v);
                open = Some(v);
            }
            after_silent = true;
            continue;
        }
        if c.vowel.is_none() {
            match c.letter {
                'ܐ' if i > 0 && open.is_some() => {
                    // Silent after a vowel; final -e plus alaph is -ē.
                    if last && open == Some('e') {
                        out.pop();
                        out.push('ē');
                    }
                    continue;
                }
                'ܝ' | 'ܘ' if i > 0 => {
                    let long = match (c.letter, open) {
                        ('ܝ', Some('i')) => Some('ī'),
                        ('ܝ', Some('e')) => Some('ē'),
                        ('ܘ', Some('u')) => Some('ū'),
                        _ => None,
                    };
                    if let Some(l) = long {
                        out.pop();
                        out.push(l);
                        open = None;
                        after_silent = false;
                        continue;
                    }
                    if last && open.is_none() {
                        if !after_silent {
                            out.push_str(if c.letter == 'ܝ' { "(ī)" } else { "(ū)" });
                        }
                        continue;
                    }
                }
                _ => {}
            }
        }
        let (hard, soft) = consonant(c.letter)?;
        out.push_str(if c.soft { soft } else { hard });
        if let Some(v) = c.vowel {
            out.push(v);
        }
        open = c.vowel;
        after_silent = false;
    }
    Some(out)
}

/// An approximate romanization of a pointed Syriac verse, letter by letter,
/// without its punctuation. None if it has a sign this does not know.
pub fn romanize(text: &str) -> Option<String> {
    let mut words = Vec::new();
    for w in text.split(|c: char| c.is_whitespace() || is_punct(c)) {
        if w.is_empty() {
            continue;
        }
        let r = romanize_word(w)?;
        if !r.is_empty() {
            words.push(r);
        }
    }
    Some(words.join(" "))
}

// ---------------------------------------------------------------- build

/// Runs of consecutive numbers as `[from, to]`.
fn runs(vs: impl IntoIterator<Item = u32>) -> Vec<[u32; 2]> {
    let mut out: Vec<[u32; 2]> = Vec::new();
    for v in vs {
        match out.last_mut() {
            Some(r) if r[1] + 1 == v => r[1] = v,
            _ => out.push([v, v]),
        }
    }
    out
}

/// The files to write under web/public/data, as (path, bytes).
pub fn build(
    inputs: &Inputs,
    vz: &Versification,
    bsb: &[String],
) -> Result<Vec<(String, Vec<u8>)>, String> {
    let mut t = Tally::default();
    let mut files = Vec::new();
    let mut have: Vec<u32> = Vec::new();
    let mut later: Vec<u32> = Vec::new();
    let mut moves_used = [0usize; MOVES.len()];
    let mut statuses: BTreeMap<String, usize> = BTreeMap::new();
    let mut romanized = 0usize;
    let mut missing = Vec::new();

    for b in FIRST_NT_BOOK..BOOKS.len() as u8 {
        let book = &BOOKS[b as usize];
        let path = inputs.path(SOURCE, book.osis);
        let xml =
            fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
        let head = header(&xml, book.name)
            .map_err(|e| format!("{} ({}): {e}", path.display(), book.name))?;
        *statuses.entry(head.status.clone()).or_default() += 1;
        let raw = verses(&xml, &mut t).map_err(|e| format!("{}: {e}", path.display()))?;

        let first = vz.book_start(b);
        let count = (1..=vz.chapters_in(b))
            .map(|c| vz.verses_in(b, c).unwrap_or(0) as u32)
            .sum::<u32>();
        let mut syc: Vec<String> = vec![String::new(); count as usize];
        let mut notes: BTreeMap<String, Value> = BTreeMap::new();
        for rv in raw {
            let mut at = (rv.chapter, rv.verse);
            let mut how: Option<(Kind, String)> = None;
            if let Some(k) = MOVES
                .iter()
                .position(|m| m.book == book.osis && m.from == at)
            {
                let m = &MOVES[k];
                // Luke's n="42" in chapter 11 moves only where it is misplaced,
                // before 11:1; the real 11:42 comes later in the chapter.
                if m.kind != Kind::Coded || rv.before_first {
                    moves_used[k] += 1;
                    let src = match m.kind {
                        Kind::Split => format!("{}:{}–{}", m.to.0, m.to.1, m.from.1),
                        _ => format!("{}:{}", m.from.0, m.from.1),
                    };
                    how = Some((m.kind, src));
                    at = m.to;
                }
            }
            if how.is_none() && rv.before_first {
                t.out_of_order += 1;
                continue;
            }
            let Some(v) = vz.index(b, at.0, at.1) else {
                t.not_in_bsb += 1;
                continue;
            };
            let slot = &mut syc[(v - first) as usize];
            match how {
                Some((Kind::Split, _)) if !slot.is_empty() => {
                    slot.push(' ');
                    slot.push_str(&rv.text);
                }
                _ if !slot.is_empty() => {
                    t.duplicate += 1;
                    continue;
                }
                _ => *slot = rv.text,
            }
            if let Some((kind, src)) = how {
                notes.insert(v.to_string(), json!([kind.key(), src]));
            }
        }

        let later_book = LATER_BOOKS.contains(&book.osis);
        let (lj_from, lj_to) = if book.osis == "John" {
            let f = vz
                .index(b, LATER_JOHN.0 .0, LATER_JOHN.0 .1)
                .ok_or("John 7:53 is not in the BSB")?;
            let l = vz
                .index(b, LATER_JOHN.1 .0, LATER_JOHN.1 .1)
                .ok_or("John 8:11 is not in the BSB")?;
            (f, l)
        } else {
            (1, 0)
        };
        let mut rom = Vec::with_capacity(syc.len());
        let mut omitted = Vec::new();
        for (i, s) in syc.iter().enumerate() {
            let v = first + i as u32;
            if s.is_empty() {
                missing.push(v);
                rom.push(String::new());
                continue;
            }
            have.push(v);
            if later_book || (lj_from..=lj_to).contains(&v) {
                later.push(v);
            }
            // The BSB leaves this verse out of its text (it gives it in a footnote).
            if bsb.get(v as usize).is_some_and(|e| e.trim().is_empty()) {
                omitted.push(v);
            }
            match romanize(s) {
                Some(r) => {
                    romanized += 1;
                    rom.push(r);
                }
                None => rom.push(String::new()),
            }
        }
        let doc = json!({
            "format": 1,
            "first": first,
            "syc": syc,
            "rom": rom,
            "notes": notes,
            "omitted": omitted,
            "status": head.status,
            "date": [head.date.0, head.date.1],
        });
        files.push((
            format!("{DIR}/{}.json", book.osis),
            serde_json::to_vec(&doc).map_err(|e| e.to_string())?,
        ));
    }

    for (m, used) in MOVES.iter().zip(moves_used) {
        if used != 1 {
            return Err(format!(
                "peshitta: {} {}:{} -> {}:{} applied {used} times, expected once; has the source changed?",
                m.book, m.from.0, m.from.1, m.to.0, m.to.1
            ));
        }
    }
    let skipped =
        t.outside_chapter + t.bad_number + t.empty + t.out_of_order + t.not_in_bsb + t.duplicate;
    eprintln!(
        "peshitta: {} verses read, {} placed on {} BSB verses ({} from later versions, {} romanized), {} placed by name; \
         skipped {skipped} (outside a chapter {}, bad number {}, empty {}, out of order {}, not in the BSB {}, duplicate {}); \
         removed {} '+' marks and {} other characters, {} unknown entities, {} tags inside verses, {} other elements, {} stray text; \
         {} BSB verses without Syriac; status {:?}",
        t.verses,
        t.verses - skipped,
        have.len(),
        later.len(),
        romanized,
        MOVES.len(),
        t.outside_chapter,
        t.bad_number,
        t.empty,
        t.out_of_order,
        t.not_in_bsb,
        t.duplicate,
        t.plus,
        t.removed_chars,
        t.entities_dropped,
        t.inner_tags,
        t.other_markup,
        t.stray_text,
        missing.len(),
        statuses,
    );
    let index = json!({ "format": 1, "have": runs(have), "later": runs(later) });
    files.push((
        OUT.to_string(),
        serde_json::to_vec(&index).map_err(|e| e.to_string())?,
    ));
    Ok(files)
}

// --------------------------------------------------------------- verify

fn read_json(path: &std::path::Path) -> Result<Value, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))
}

fn in_runs(runs: &[(u32, u32)], v: u32) -> bool {
    runs.iter().any(|&(a, b)| a <= v && v <= b)
}

/// The book files, read once each.
struct Books<'a> {
    d: &'a Loaded,
    files: BTreeMap<u8, Value>,
}

impl Books<'_> {
    fn book(&mut self, b: u8) -> Result<&Value, String> {
        if let std::collections::btree_map::Entry::Vacant(e) = self.files.entry(b) {
            e.insert(read_json(
                &self
                    .d
                    .dir
                    .join(format!("{DIR}/{}.json", BOOKS[b as usize].osis)),
            )?);
        }
        Ok(&self.files[&b])
    }

    /// A verse's Syriac, its romanization and its note.
    fn verse(&mut self, v: u32) -> Result<(String, String, Value), String> {
        let (b, _, _) = self.d.vz.locate(v).ok_or("verse out of range")?;
        let f = self.book(b)?;
        let i = v
            .checked_sub(f["first"].as_u64().unwrap_or(u64::MAX) as u32)
            .ok_or("bad first verse")? as usize;
        let s = f["syc"][i].as_str().unwrap_or("").to_string();
        let r = f["rom"][i].as_str().unwrap_or("").to_string();
        Ok((s, r, f["notes"][v.to_string()].clone()))
    }
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let index_path = d.dir.join(OUT);
    let size = fs::metadata(&index_path)
        .map_err(|e| format!("reading {}: {e}", index_path.display()))?
        .len();
    let doc = read_json(&index_path)?;
    let pairs = |key: &str| -> Vec<(u32, u32)> {
        doc[key]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|r| Some((r[0].as_u64()? as u32, r[1].as_u64()? as u32)))
                    .collect()
            })
            .unwrap_or_default()
    };
    let have = pairs("have");
    let later = pairs("later");
    let n = d.vz.verse_count();
    let nt = d.vz.book_start(FIRST_NT_BOOK);
    let count: u32 = have.iter().map(|&(a, b)| b + 1 - a).sum();
    let sane = |rs: &[(u32, u32)]| rs.iter().all(|&(a, b)| nt <= a && a <= b && b < n);

    let mut books = Books {
        d,
        files: BTreeMap::new(),
    };
    let at = |r: &str| d.resolve(r).map(|x| x.0);
    let has = |s: &str, part: &str| letters(s).contains(part);

    let (m541, r541, _) = books.verse(at("Mark 5:41")?)?;
    let (m1534, _, _) = books.verse(at("Mark 15:34")?)?;
    let (l1042, _, n1042) = books.verse(at("Luke 10:42")?)?;
    let (l1142, _, _) = books.verse(at("Luke 11:42")?)?;
    let (mt2313, _, _) = books.verse(at("Matt 23:13")?)?;
    let (mt2314, _, _) = books.verse(at("Matt 23:14")?)?;
    let (r1624, _, _) = books.verse(at("Rom 16:24")?)?;
    let (r1625, _, n1625) = books.verse(at("Rom 16:25")?)?;
    let (j314, _, n314) = books.verse(at("3 John 1:14")?)?;
    let (j316, _, _) = books.verse(at("John 3:16")?)?;

    // Every book file has one slot per BSB verse, and Syriac exactly where the index says.
    let mut files_ok = true;
    for b in FIRST_NT_BOOK..BOOKS.len() as u8 {
        let f = books.book(b)?;
        let first = d.vz.book_start(b);
        let len = (1..=d.vz.chapters_in(b))
            .map(|c| d.vz.verses_in(b, c).unwrap_or(0) as usize)
            .sum::<usize>();
        let syc = f["syc"].as_array().map(Vec::as_slice).unwrap_or_default();
        let rom = f["rom"].as_array().map(Vec::as_slice).unwrap_or_default();
        files_ok &= f["first"].as_u64() == Some(first.into())
            && syc.len() == len
            && rom.len() == len
            && syc.iter().enumerate().all(|(i, s)| {
                s.as_str().is_some_and(|s| !s.is_empty()) == in_runs(&have, first + i as u32)
            });
    }
    let is_later = |r: &str| at(r).map(|v| in_runs(&later, v));

    Ok(vec![
        (doc["format"] == 1 && size < 200_000, format!("peshitta.json is format 1 and small ({size} bytes)")),
        ((7_900..=8_000).contains(&count), format!("{count} New Testament verses have Syriac (about 7,950 expected)")),
        (sane(&have) && sane(&later), "every Syriac verse number is a New Testament verse below the verse count".to_string()),
        (files_ok, "each book file has one Syriac slot per BSB verse, filled exactly where peshitta.json says".to_string()),
        (has(&m541, "ܛܠܝܬܐ") && has(&m541, "ܩܘܡܝ"), "Mark 5:41 has ܛܠܝܬܐ ܩܘܡܝ (talitha qum)".to_string()),
        (r541.contains("ṭlīṯā"), format!("Mark 5:41 romanizes to ṭlīṯā ({r541})")),
        (has(&m1534, "ܫܒܩܬܢܝ"), "Mark 15:34 has ܫܒܩܬܢܝ (sabachthani)".to_string()),
        (
            has(&l1042, "ܡܪܝܡ") && has(&l1042, "ܡܢܬܐ ܛܒܬܐ") && n1042[0] == "coded" && has(&l1142, "ܦܪܝܫܐ"),
            "Luke 10:42 (Mary's good portion), coded in chapter 11 by the source, is placed at Luke 10:42; Luke 11:42 is the woe to the Pharisees".to_string(),
        ),
        (
            has(&mt2313, "ܡܠܟܘܬܐ ܕܫܡܝܐ") && has(&mt2314, "ܐܪܡܠܬܐ"),
            "Matthew 23:13 is the kingdom shut, 23:14 the widows' houses".to_string(),
        ),
        (
            has(&r1624, "ܛܝܒܘܬܗ ܕܡܪܢ") && letters(&r1625).starts_with("ܠܐܠܗܐ") && n1625[1] == "16:24",
            "Romans 16:24 is the blessing and 16:25 starts the doxology (source 16:24)".to_string(),
        ),
        (has(&j314, "ܫܠܡܐ ܢܗܘܐ ܥܡܟ") && n314[0] == "split", "3 John 1:14 includes the source's 1:15 (peace to you)".to_string()),
        (has(&j316, "ܐܠܗܐ ܠܥܠܡܐ"), "John 3:16 has ܐܠܗܐ ܠܥܠܡܐ (God ... the world)".to_string()),
        (
            is_later("Rev 1:1")? && is_later("2 Pet 1:1")? && is_later("Jude 1:1")? && is_later("John 8:1")? && is_later("John 7:53")?
                && !is_later("John 7:52")? && !is_later("John 8:12")? && !is_later("John 3:16")? && !is_later("Mark 5:41")?,
            "2 Peter, Jude, Revelation and John 7:53-8:11 are marked as later versions; John 3:16 and Mark 5:41 are not".to_string(),
        ),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn romanizes_the_aramaic_words_of_mark() {
        // Mark 5:41, 7:34, 14:36 and 15:34 as the source points them.
        assert_eq!(
            romanize("ܘܶܐܚܰܕ݂ ܒ݁ܺܐܝܕ݂ܳܗ ܕ݁ܰܛܠܺܝܬ݂ܳܐ ܂ ܘܶܐܡܰܪ ܠܳܗ . ܛܠܺܝܬ݂ܳܐ ܂ ܩܽܘܡܝ .").as_deref(),
            Some("weḥaḏ bīḏāh daṭlīṯā wemar lāh ṭlīṯā qūm(ī)")
        );
        assert_eq!(romanize("ܐܶܬ݂ܦ݁ܰܬ̱݁ܚ .").as_deref(), Some("ʾeṯpatḥ"));
        assert_eq!(romanize("ܐܰܒ݂ܳܐ ܐܳܒ݂ܝ ܆").as_deref(), Some("ʾaḇā ʾāḇ(ī)"));
        assert_eq!(
            romanize("ܐܺܝܠ ܁ ܐܺܝܠ ܁ ܠܡܳܢܳܐ ܫܒ݂ܰܩܬ݁ܳܢܝ . ܕ݁ܺܐܝܬ݂ܶܝܗ ܐܰܠܳܗܝ").as_deref(),
            Some("ʾīl ʾīl lmānā šḇaqtān(ī) dīṯēh ʾalāh(ī)")
        );
    }

    #[test]
    fn silent_letters_and_vowel_letters() {
        // ܗ̱ܘܳܐ (he silent), ܐ̱ܢܳܐ (alaph silent), ܐܰܢ̱ܬ݁ (nun silent).
        assert_eq!(romanize("ܗ̱ܘܳܐ ܐ̱ܢܳܐ ܐܰܢ̱ܬ݁").as_deref(), Some("wā nā ʾat"));
        // A final yudh after a silent he is silent too: ʾīṯaw(hy).
        assert_eq!(romanize("ܐܺܝܬ݂ܰܘܗ̱ܝ").as_deref(), Some("ʾīṯaw"));
        // -e and a final alaph is -ē; yudh after e is ē; waw after u is ū.
        assert_eq!(romanize("ܚܰܝܶܐ̈ ܓ݁ܶܝܪ ܝܶܫܽܘܥ").as_deref(), Some("ḥayē gēr yešūʿ"));
        // The line below on a letter that keeps its sound (ʿammē).
        assert_eq!(romanize("ܥܰܡ̱ܡܶܐ̈").as_deref(), Some("ʿammē"));
        // Unknown signs give no romanization rather than a wrong one.
        assert_eq!(romanize("ܐܒ\u{0732}"), None);
        assert_eq!(romanize("abc"), None);
    }

    #[test]
    fn letters_drop_points_and_punctuation() {
        assert_eq!(letters("ܛܠܺܝܬ݂ܳܐ ܂ ܩܽܘܡܝ ."), "ܛܠܝܬܐ ܩܘܡܝ");
    }

    #[test]
    fn scans_verses_and_counts_what_it_leaves_out() {
        let xml = concat!(
            "<TEI><teiHeader></teiHeader><text><body>\n",
            "<div type=\"title\" n=\"0\"><ab xml:lang=\"syr\">ܬܝܬܠܘܣ</ab></div>\n",
            "<div type=\"chapter\" n=\"1\"><head xml:lang=\"en\">Chapter 1</head>",
            "<ab type=\"verse\" n=\"1\">ܐܒ݁ &amp; +ܓܕ\n   ܗܘ<hi>ܙ</hi>&bogus;</ab>",
            "<milestone unit=\"SyrChapter\" n=\"1\"/>",
            "<ab type=\"verse\" n=\"x\">ܐ</ab><!-- note --><ab type=\"verse\" n=\"2\">  </ab></div>\n",
            "<div type=\"chapter\" n=\"2\"><ab type=\"verse\" n=\"9\">ܚ</ab><ab type=\"verse\" n=\"1\">ܛ\u{202E}</ab></div>",
            "</body></text></TEI>"
        );
        let mut t = Tally::default();
        let vs = verses(xml, &mut t).unwrap();
        assert_eq!(vs.len(), 3);
        assert_eq!(
            (vs[0].chapter, vs[0].verse, vs[0].text.as_str()),
            (1, 1, "ܐܒ݁ ܓܕ ܗܘܙ")
        );
        assert!(vs[1].before_first && (vs[1].chapter, vs[1].verse) == (2, 9));
        assert_eq!(vs[2].text, "ܛ");
        assert_eq!(t.verses, 5);
        assert_eq!(
            (t.plus, t.removed_chars, t.entities_dropped, t.inner_tags),
            (1, 2, 1, 2)
        );
        assert_eq!((t.bad_number, t.empty, t.other_markup), (1, 1, 2));
    }

    #[test]
    fn header_needs_the_license_and_the_right_book() {
        let head = |title: &str, licence: &str| {
            format!(
                "<TEI><teiHeader><title xml:lang=\"en\" level=\"a\">{title} <foreign>x</foreign></title>{licence}\
                 <note>The Syriac base text is in the public domain. The TEI XML edition is copyrighted by\n   James E. Walters</note>\
                 <origDate type=\"translation\" from=\"0350\" to=\"0450\">x</origDate>\
                 <revisionDesc status=\"UncorrectedTranscription\"></revisionDesc></teiHeader><text/></TEI>"
            )
        };
        let h = header(&head("Gospel of John -", LICENCE), "John").unwrap();
        assert_eq!(
            (h.status.as_str(), h.date),
            ("UncorrectedTranscription", (350, 450))
        );
        assert!(header(&head("1 John (Peshitta Version) -", LICENCE), "John").is_err());
        assert!(header(&head("1 John (Peshitta Version) -", LICENCE), "1 John").is_ok());
        assert!(header(&head("Gospel of John -", "<licence target=\"x\">"), "John").is_err());
    }

    #[test]
    fn runs_of_verses() {
        assert_eq!(runs([3, 4, 5, 9, 11, 12]), vec![[3, 5], [9, 9], [11, 12]]);
    }
}
