//! Parsers for each source format. Each one reports what it could not map
//! instead of silently dropping it, so `atlas build` can print an honest tally.

use atlas_core::canon::{self, BOOKS};
use atlas_core::graph::RawEdge;
use atlas_core::Versification;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Lang {
    Hebrew,
    Aramaic,
    Greek,
}

#[derive(Clone, Debug, Default)]
pub struct WordNote {
    /// Source word-type code (e.g. "N(k)O" or "Q(K)").
    pub kind: String,
    /// Greek editions that contain this word.
    pub editions: Option<String>,
    /// Manuscript / reading notes from the source.
    pub variants: Option<String>,
}

#[derive(Clone, Debug)]
pub struct Word {
    pub surface: String,
    pub translit: String,
    pub gloss: String,
    pub lemma: Option<String>,
    pub morph: String,
    pub lang: Lang,
    /// Part of the base text (Leningrad Codex for the OT, Nestle-Aland family
    /// for the NT). Words only found in other editions are kept but flagged.
    pub main: bool,
    /// The editions or manuscripts disagree about this word in some way.
    pub variant: bool,
    /// ...and the difference changes the meaning (per the source's own
    /// upper/lower-case convention), not just spelling or word order.
    pub significant: bool,
    pub note: Option<WordNote>,
    /// What the word alignment matches on: Hebrew consonants, or the Greek
    /// Strong's number.
    pub key: String,
    /// Hebrew and Aramaic only: the verse in the Hebrew Bible's own numbering,
    /// which the alignment data uses.
    pub src_verse: Option<(u8, u16, u16)>,
    /// The word's parts (prefixes, stem, suffixes) as (surface, gloss), when
    /// the source splits it into more than one.
    pub pieces: Vec<(String, String)>,
    /// The root's own form of the word, to group a root's uses by form.
    pub form: Form,
}

/// One use of a root, as its forms list groups it.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Form {
    /// The root's own part of the word: for Hebrew and Aramaic without
    /// prefixes, endings or accents; for Greek the word without punctuation.
    pub plain: String,
    /// The root's part with the pronoun ending (or Aramaic article) that
    /// follows it, as עַמּוֹ for עַמּ: what is shown when the root never
    /// appears without one in that form.
    pub full: String,
    /// A pronoun ending or the Aramaic article follows the root's part (for
    /// Greek: the word is elided, as ἀλλ᾽ for ἀλλά).
    pub ending: bool,
    /// The pronoun ending's grammar ("Sp3ms"), empty when there is none.
    pub suffix: String,
    /// Grammar of the root's part ("HVqw3ms", "N-NSF"). Empty when the
    /// source's parts do not line up, so the use is left out of every form.
    pub code: String,
}

#[derive(Default, Debug)]
pub struct Tally {
    pub read: usize,
    pub unmapped: usize,
    pub unmapped_examples: Vec<String>,
}

impl Tally {
    fn miss(&mut self, what: &str) {
        self.unmapped += 1;
        if self.unmapped_examples.len() < 8 {
            self.unmapped_examples.push(what.to_string());
        }
    }
}

fn read(path: &Path) -> Result<String, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    Ok(text.trim_start_matches('\u{feff}').to_string())
}

/// "Gen.1.1" with a book lookup function.
fn dotted(s: &str, book: impl Fn(&str) -> Option<u8>) -> Option<(u8, u16, u16)> {
    let mut it = s.split('.');
    let b = book(it.next()?)?;
    let c = it.next()?.parse().ok()?;
    let v = it.next()?.parse().ok()?;
    if it.next().is_some() {
        return None;
    }
    Some((b, c, v))
}

// ---------------------------------------------------------------- BSB

#[derive(Deserialize)]
struct BsbFile {
    books: Vec<BsbBook>,
}
#[derive(Deserialize)]
struct BsbBook {
    name: String,
    chapters: Vec<BsbChapter>,
}
#[derive(Deserialize)]
struct BsbChapter {
    chapter: u16,
    verses: Vec<BsbVerse>,
}
#[derive(Deserialize)]
struct BsbVerse {
    verse: u16,
    text: String,
}

pub struct Bsb {
    pub versification: Versification,
    pub text: Vec<String>,
}

/// The BSB defines the verse numbering everything else is mapped onto.
pub fn bsb(path: &Path) -> Result<Bsb, String> {
    let f: BsbFile = serde_json::from_str(&read(path)?).map_err(|e| format!("parsing BSB: {e}"))?;
    if f.books.len() != 66 {
        return Err(format!("BSB has {} books, expected 66", f.books.len()));
    }
    let mut counts: Vec<Vec<u16>> = Vec::with_capacity(66);
    let mut text = Vec::with_capacity(31_200);
    for (bi, b) in f.books.iter().enumerate() {
        let mut chapters = Vec::new();
        for (ci, c) in b.chapters.iter().enumerate() {
            if c.chapter as usize != ci + 1 {
                return Err(format!("BSB {}: chapter {} out of order", b.name, c.chapter));
            }
            for (vi, v) in c.verses.iter().enumerate() {
                if v.verse as usize != vi + 1 {
                    return Err(format!("BSB {} {}: verse {} out of order", b.name, c.chapter, v.verse));
                }
                text.push(v.text.trim().to_string());
            }
            chapters.push(c.verses.len() as u16);
        }
        if chapters.is_empty() {
            return Err(format!("BSB book {bi} ({}) has no chapters", b.name));
        }
        counts.push(chapters);
    }
    // Sanity-check the book order against the canon by first letters of the name.
    for (i, b) in f.books.iter().enumerate() {
        let want = BOOKS[i].name.trim_start_matches(|c: char| c.is_ascii_digit() || c == ' ');
        let got = ["III ", "II ", "I "].iter().find_map(|p| b.name.strip_prefix(p)).unwrap_or(&b.name);
        if !got.starts_with(&want[..3]) {
            return Err(format!("BSB book {i} is {:?}, expected {}", b.name, BOOKS[i].name));
        }
    }
    Ok(Bsb { versification: Versification::from_counts(&counts), text })
}

// ---------------------------------------------------------------- Cross-references

pub fn xrefs(path: &Path, vz: &Versification, tally: &mut Tally) -> Result<Vec<RawEdge>, String> {
    let text = read(path)?;
    let mut edges = Vec::with_capacity(350_000);
    for line in text.lines() {
        if line.starts_with("From Verse") || line.trim().is_empty() {
            continue;
        }
        tally.read += 1;
        let mut cols = line.split('\t');
        let (Some(from), Some(to), Some(votes)) = (cols.next(), cols.next(), cols.next()) else {
            tally.miss(line);
            continue;
        };
        // A few references use verse numbers the BSB folds into the previous
        // verse (3 John 1:15 is part of 1:14); clamp those to the chapter's last verse.
        let at = |s: &str| {
            let (b, c, v) = dotted(s, canon::by_osis)?;
            let last = vz.verses_in(b, c)?;
            (v <= last + 1).then(|| vz.index(b, c, v.min(last))).flatten()
        };
        let (to_start, to_end) = match to.split_once('-') {
            Some((a, b)) => (a, b),
            None => (to, to),
        };
        let (Some(src), Some(dst), Some(end), Ok(votes)) = (at(from), at(to_start), at(to_end), votes.trim().parse::<i32>()) else {
            tally.miss(line);
            continue;
        };
        let (dst, end) = if end < dst { (end, dst) } else { (dst, end) };
        edges.push(RawEdge {
            src,
            dst,
            span: (end - dst + 1).min(u16::MAX as u32) as u16,
            votes: votes.clamp(i16::MIN as i32, i16::MAX as i32) as i16,
        });
    }
    Ok(edges)
}

// ---------------------------------------------------------------- STEPBible shared

/// Split "Gen.1.1#01=L" or "Mal.4.1(3.19)#01=L" or "1Jn.2.14[2.13]#03=NKO"
/// into (English/NRSV reference, word position, word type).
fn step_ref(field: &str) -> Option<(&str, u16, &str)> {
    let (r, rest) = field.split_once('#')?;
    let (pos, kind) = rest.split_once('=')?;
    let r = r.split(['(', '[', '{']).next()?;
    Some((r, pos.parse().ok()?, kind))
}

/// The KJV-numbered alternative in square brackets, e.g. "3Jn.1.15[1.14]" -> "3Jn.1.14".
fn kjv_alternative(field: &str) -> Option<String> {
    let r = field.split('#').next()?;
    let (head, alt) = r.split_once('[')?;
    let alt = alt.trim_end_matches(']');
    let book = head.split('.').next()?;
    Some(format!("{book}.{alt}"))
}

/// Map a STEPBible reference onto the BSB numbering.
/// Psalm titles are verse 0 in the source; English Bibles print them above
/// verse 1, so their words are attached to verse 1.
fn step_index(r: &str, vz: &Versification) -> Option<u32> {
    let (b, c, v) = dotted(r, canon::by_step)?;
    vz.index(b, c, v.max(1))
}

/// STEPBible marks meaningful differences with upper-case letters and minor
/// ones (spelling, order) with lower case. Letters inside brackets name the
/// editions or manuscripts that differ.
fn significant(kind: &str, greek: bool) -> bool {
    let mut depth = 0i32;
    let mut outside = String::new();
    let mut all = String::new();
    for c in kind.chars() {
        match c {
            '(' => depth += 1,
            ')' => depth -= 1,
            c if depth > 0 && c.is_ascii_uppercase() => return true,
            c if c.is_ascii_alphabetic() => {
                all.push(c.to_ascii_uppercase());
                if depth == 0 {
                    outside.push(c);
                }
            }
            _ => {}
        }
    }
    if outside.chars().all(|c| c.is_ascii_lowercase()) {
        return false;
    }
    if greek {
        // A word some family of editions (N = Nestle-Aland, K = KJV's Greek,
        // O = others) does not have at all.
        !['N', 'K', 'O'].iter().all(|c| all.contains(*c))
    } else {
        // Restored (R) and LXX-based (X) text is not in the Leningrad codex.
        outside.starts_with(['R', 'X', 'V'])
    }
}

/// The Hebrew-numbered reference of a TAHOT field: "Mal.4.1(3.19)#01=L" ->
/// "Mal.3.19", "Gen.1.1#01=L" -> "Gen.1.1".
fn hebrew_ref(field: &str) -> Option<String> {
    let r = field.split('#').next()?;
    let Some((head, alt)) = r.split_once('(') else { return Some(r.to_string()) };
    let alt = alt.split(')').next()?;
    let mut it = head.split('.');
    let (book, chapter) = (it.next()?, it.next()?);
    Some(if alt.contains('.') { format!("{book}.{alt}") } else { format!("{book}.{chapter}.{alt}") })
}

/// Hebrew consonants only (drops vowel points, accents and the punctuation
/// TAHOT writes after a backslash).
pub fn consonants(s: &str) -> String {
    s.split('/')
        .map(|seg| seg.split('\\').next().unwrap_or(""))
        .flat_map(str::chars)
        .filter(|c| ('\u{05D0}'..='\u{05EA}').contains(c))
        .collect()
}

/// "וְ/יִנְהֹ֥ם" with "and/ it may growl" -> [("וְ", "and"), ("יִנְהֹ֥ם", "it may growl")].
fn pieces(surface: &str, gloss: &str) -> Vec<(String, String)> {
    let s: Vec<&str> = surface.split('/').collect();
    let g: Vec<&str> = gloss.split('/').collect();
    if s.len() < 2 || s.len() != g.len() {
        return Vec::new();
    }
    s.iter().zip(g).map(|(s, g)| (s.replace('\\', ""), g.trim().to_string())).collect()
}

/// A Greek word with its grave accents written acute, as it is spelled on its
/// own: a grave only marks an acute followed by another word (θεὸς, θεός).
fn acute(s: &str) -> String {
    s.chars()
        .map(|c| {
            let u = c as u32;
            let to = match u {
                // ὰ ὲ ὴ ὶ ὸ ὺ ὼ (varia) -> oxia, the next code point.
                0x1F70..=0x1F7D if u.is_multiple_of(2) => u + 1,
                // With a breathing mark (and iota subscript): varia sits two before oxia.
                0x1F00..=0x1F6F | 0x1F80..=0x1FAF if matches!(u % 8, 2 | 3) => u + 2,
                0x1FB2 | 0x1FC2 | 0x1FF2 => u + 2,
                0x1FD2 | 0x1FE2 | 0x1FBA | 0x1FC8 | 0x1FCA | 0x1FDA | 0x1FEA | 0x1FF8 | 0x1FFA => u + 1,
                _ => u,
            };
            char::from_u32(to).unwrap_or(c)
        })
        .collect()
}

/// A Greek word without the second accent a following enclitic gives it
/// (ἐλέησόν με, δέδωκάς μοι): an acute on the last vowel after another accent.
fn enclitic_accent_out(s: &str) -> String {
    let acute_to_plain = |c: char| -> Option<char> {
        Some(match c as u32 {
            0x03AC | 0x1F71 => 'α',
            0x03AD | 0x1F73 => 'ε',
            0x03AE | 0x1F75 => 'η',
            0x03AF | 0x1F77 => 'ι',
            0x03CC | 0x1F79 => 'ο',
            0x03CD | 0x1F7B => 'υ',
            0x03CE | 0x1F7D => 'ω',
            0x0390 | 0x1FD3 => 'ϊ',
            0x03B0 | 0x1FE3 => 'ϋ',
            0x1FB4 => 'ᾳ',
            0x1FC4 => 'ῃ',
            0x1FF4 => 'ῳ',
            _ => return None,
        })
    };
    let accented = |c: char| {
        let u = c as u32;
        acute_to_plain(c).is_some()
            || matches!(u, 0x1FB6 | 0x1FB7 | 0x1FC6 | 0x1FC7 | 0x1FD6 | 0x1FD7 | 0x1FE6 | 0x1FE7 | 0x1FF6 | 0x1FF7 | 0x1FBB | 0x1FC9 | 0x1FCB | 0x1FDB | 0x1FEB | 0x1FF9 | 0x1FFB)
            || (matches!(u, 0x1F00..=0x1F6F | 0x1F80..=0x1FAF) && matches!(u % 8, 4..=7))
    };
    let vowel = |c: char| "αεηιουωϊϋᾳῃῳ".contains(c) || accented(c) || matches!(c as u32, 0x1F00..=0x1F7D | 0x1F80..=0x1FFC);
    let cs: Vec<char> = s.chars().collect();
    let marks: Vec<usize> = (0..cs.len()).filter(|&i| accented(cs[i])).collect();
    if let [.., _, last] = marks[..] {
        if let Some(plain) = acute_to_plain(cs[last]).filter(|_| !cs[last + 1..].iter().any(|&c| vowel(c))) {
            let mut out = cs.clone();
            out[last] = plain;
            return out.into_iter().collect();
        }
    }
    s.to_string()
}

/// The root's own form of a Hebrew or Aramaic word. "וַ/יִּשְׁבֹּת֙" with
/// dStrongs "H9001/{H7673A}" and grammar "Hc/Vqw3ms" gives "יִשְׁבֹּת" and
/// "HVqw3ms"; "עַמִּ֛/י" (HNcmsc/Sp1bs) gives "עַמּ" and, with its ending, "עַמִּי".
/// Accents and punctuation are dropped, vowels kept, and the first letter's
/// dagesh is written as the word has it on its own (a prefix doubles the
/// letter after it and softens ב ג ד כ פ ת).
fn hebrew_form(surface: &str, strongs: &str, grammar: &str) -> Form {
    let lang = grammar.get(..1).unwrap_or("H");
    let parts: Vec<&str> = strongs.split('/').collect();
    let segs: Vec<&str> = surface.split('/').collect();
    let codes: Vec<&str> = grammar.get(1..).unwrap_or("").split('/').collect();
    let Some(at) = parts.iter().position(|p| p.contains('{')) else { return Form::default() };
    // "{H1176}+": the first word of a name written as two (בַּעַל זְבוּב), not a form of it.
    if segs.len() != parts.len() || codes.len() != parts.len() || parts[at].contains("}+") {
        return Form::default();
    }
    let letters = |s: &str| -> String { s.chars().filter(|&c| matches!(c, '\u{05B0}'..='\u{05BC}' | '\u{05C1}' | '\u{05C2}' | '\u{05C7}' | '\u{05D0}'..='\u{05EA}')).collect() };
    let morpheme = parts[at].trim_start_matches('{').starts_with("H9");
    let tidy = |s: String| if morpheme { s } else { first_letter_dagesh(&s) };
    let plain = letters(segs[at].split('\\').next().unwrap_or(""));
    // A suffix (or a punctuation mark the source left on the root) is not the root's part.
    let code = codes[at];
    if code.starts_with('S') || !plain.chars().any(|c| matches!(c, '\u{05B0}'..='\u{05BC}' | '\u{05C1}' | '\u{05C2}' | '\u{05C7}')) {
        return Form::default();
    }
    // The ending runs to the next word break: a part with no letters, or a
    // backslash, after which the source puts punctuation.
    let mut full = plain.clone();
    let mut ending = false;
    let mut suffix = String::new();
    if !segs[at].contains('\\') {
        for k in at + 1..segs.len() {
            let piece = segs[k].split('\\').next().unwrap_or("");
            let l = letters(piece);
            if !l.chars().any(|c| matches!(c, '\u{05D0}'..='\u{05EA}')) {
                break;
            }
            full.push_str(&l);
            ending |= codes[k].starts_with('S') || codes[k] == "Ta";
            if codes[k].starts_with('S') && suffix.is_empty() {
                suffix = codes[k].to_string();
            }
            if segs[k].contains('\\') {
                break;
            }
        }
    }
    // Codes that do not change the spelling are folded together: a name's
    // kind (person, place), a title written like any noun, and "Rd", which
    // the source uses on a preposition with an ending (never with the article).
    let code = if code.starts_with("Np") {
        "Np".to_string()
    } else if let Some(rest) = code.strip_prefix("Nt") {
        format!("Nc{rest}")
    } else if code == "Rd" {
        "R".to_string()
    } else {
        code.to_string()
    };
    Form { plain: tidy(plain), full: tidy(full), ending, suffix, code: format!("{lang}{code}") }
}

/// TAHOT tags every אֶחָד ("one") feminine; its gender shows in its spelling,
/// as אַחַת is the feminine. Other grammar codes are returned as they are.
fn one_gender(surface: &str, strongs: &str, grammar: &str) -> String {
    let parts: Vec<&str> = strongs.split('/').collect();
    let segs: Vec<&str> = surface.split('/').collect();
    let mut codes: Vec<String> = grammar.get(1..).unwrap_or("").split('/').map(str::to_string).collect();
    let Some(at) = parts.iter().position(|p| p.trim_start_matches('{').starts_with("H0259")) else { return grammar.to_string() };
    let (Some(seg), Some(code)) = (segs.get(at), codes.get_mut(at)) else { return grammar.to_string() };
    let last = seg.split('\\').next().unwrap_or("").chars().rev().find(|c| matches!(c, '\u{05D0}'..='\u{05EA}'));
    if segs.len() != parts.len() || !(code.starts_with("Ac") || code.starts_with("Nc")) || code.get(3..4) != Some("s") || last.is_none() {
        return grammar.to_string();
    }
    code.replace_range(2..3, if last == Some('ת') { "f" } else { "m" });
    format!("{}{}", &grammar[..1], codes.join("/"))
}

/// The dagesh on a Hebrew word's first letter as it stands on its own: ב ג ד
/// כ פ ת always take one, other letters lose the one a prefix put there
/// (וַיֹּאמֶר, הַמֶּלֶךְ), except a shureq (וּ).
fn first_letter_dagesh(s: &str) -> String {
    let cs: Vec<char> = s.chars().collect();
    let Some(first) = cs.iter().position(|c| matches!(c, '\u{05D0}'..='\u{05EA}')) else { return s.to_string() };
    let next = cs[first + 1..].iter().position(|c| matches!(c, '\u{05D0}'..='\u{05EA}')).map_or(cs.len(), |i| first + 1 + i);
    let letter = cs[first];
    let marks = &cs[first + 1..next];
    let has = marks.contains(&'\u{05BC}');
    let mut out: Vec<char> = cs[..=first].to_vec();
    if "בגדכפת".contains(letter) {
        out.push('\u{05BC}');
        out.extend(marks.iter().filter(|&&c| c != '\u{05BC}'));
    } else if has && !(letter == 'ו' && marks.len() == 1) {
        out.extend(marks.iter().filter(|&&c| c != '\u{05BC}'));
    } else {
        out.extend(marks);
    }
    out.extend(&cs[next..]);
    out.into_iter().collect()
}

/// A Greek grammar code without the tags that do not change the spelling:
/// title (θεός for God), negative, question, letter.
fn greek_code(morph: &str) -> &str {
    for tag in ["-T", "-N", "-I", "-LI"] {
        if let Some(c) = morph.strip_suffix(tag) {
            return c;
        }
    }
    morph
}

fn clean_join(s: &str) -> String {
    s.replace(['/', '\\'], "")
}

/// Braced item in a dStrongs field like "H9003/{H7225G}" -> "H7225G".
fn braced(field: &str) -> Option<&str> {
    let start = field.find('{')? + 1;
    let end = field[start..].find('}')? + start;
    Some(&field[start..end])
}

fn is_strong(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() >= 5 && (b[0] == b'H' || b[0] == b'G') && b[1..5].iter().all(u8::is_ascii_digit)
}

pub type WordsByVerse = Vec<Vec<Word>>;

// ---------------------------------------------------------------- TAHOT (Hebrew / Aramaic)

/// How often TAHOT spells and glosses each Hebrew dStrong ("{H0430J=אֱלֹהִים=gods}"
/// in its expanded column). A sense with no lexicon entry of its own is named
/// from these, not from its number's first entry ("gods", not "God").
pub type SourceSenses = HashMap<String, HashMap<(String, String), u32>>;

pub fn tahot(paths: &[impl AsRef<Path>], vz: &Versification, words: &mut WordsByVerse, senses: &mut SourceSenses, tally: &mut Tally) -> Result<(), String> {
    for p in paths {
        let text = read(p.as_ref())?;
        for line in text.lines() {
            let Some(first) = line.split('\t').next() else { continue };
            if !first.contains('#') || !first.chars().next().is_some_and(|c| c.is_ascii_alphanumeric()) {
                continue;
            }
            let Some((r, _pos, kind)) = step_ref(first) else { continue };
            let cols: Vec<&str> = line.split('\t').collect();
            if cols.len() < 9 {
                continue;
            }
            tally.read += 1;
            let Some(idx) = step_index(r, vz) else {
                tally.miss(first);
                continue;
            };
            for seg in cols.get(11).map_or("", |c| c.trim()).split('{').skip(1) {
                let mut part = seg.split('}').next().unwrap_or("").splitn(3, '=');
                if let (Some(k), Some(w), Some(g)) = (part.next(), part.next(), part.next()) {
                    if is_strong(k) {
                        let g = g.split(['»', '@']).next().unwrap_or("").replace('_', " ");
                        *senses.entry(k.to_string()).or_default().entry((w.trim().to_string(), g.trim().to_string())).or_default() += 1;
                    }
                }
            }
            let grammar = &one_gender(cols[1].trim(), cols[4].trim(), cols[5].trim());
            let lang = if grammar.starts_with('A') { Lang::Aramaic } else { Lang::Hebrew };
            let lemma = braced(cols[4])
                .map(str::to_string)
                .or_else(|| cols[8].split(['_', ' ']).next().filter(|s| is_strong(s)).map(str::to_string))
                .or_else(|| cols[4].split(['/', '\\']).find(|s| is_strong(s)).map(str::to_string));
            // Ketiv-only words (the consonants as written when the vowels read
            // another word) are not part of the read text.
            let main = !(kind.starts_with('K') && !kind.starts_with("K("));
            let variant = kind != "L";
            let note = (variant || !cols[6].trim().is_empty()).then(|| WordNote {
                kind: kind.to_string(),
                editions: None,
                variants: Some(cols[6].trim().to_string()).filter(|s| !s.is_empty()),
            });
            words[idx as usize].push(Word {
                surface: clean_join(cols[1].trim()),
                translit: cols[2].trim().replace('/', ""),
                gloss: cols[3].trim().replace("/ ", " ").replace('/', ""),
                lemma,
                morph: grammar.to_string(),
                lang,
                main,
                variant,
                significant: significant(kind, false),
                note,
                key: consonants(cols[1]),
                src_verse: hebrew_ref(first).and_then(|r| dotted(&r, canon::by_step)),
                pieces: pieces(cols[1].trim(), cols[3].trim()),
                form: hebrew_form(cols[1].trim(), cols[4].trim(), grammar),
            });
        }
    }
    Ok(())
}

// ---------------------------------------------------------------- TAGNT (Greek)

/// Dictionary form and short gloss for each Greek dStrong, as given in TAGNT.
pub type GreekForms = HashMap<String, (String, String)>;

pub fn tagnt(paths: &[impl AsRef<Path>], vz: &Versification, words: &mut WordsByVerse, forms: &mut GreekForms, tally: &mut Tally) -> Result<(), String> {
    for p in paths {
        let text = read(p.as_ref())?;
        for line in text.lines() {
            let Some(first) = line.split('\t').next() else { continue };
            if !first.contains('#') || !first.chars().next().is_some_and(|c| c.is_ascii_alphanumeric()) {
                continue;
            }
            let Some((r, _pos, kind)) = step_ref(first) else { continue };
            let cols: Vec<&str> = line.split('\t').collect();
            if cols.len() < 6 {
                continue;
            }
            tally.read += 1;
            // TAGNT numbers verses like the NRSV and gives the KJV number in
            // [brackets] where they differ. The BSB follows the KJV-style
            // numbering at those split points, so the bracketed number wins.
            let Some(idx) = kjv_alternative(first).and_then(|alt| step_index(&alt, vz)).or_else(|| step_index(r, vz)) else {
                tally.miss(first);
                continue;
            };
            let (surface, translit) = match cols[1].split_once(" (") {
                Some((g, t)) => (g.trim(), t.trim_end_matches(')').trim()),
                None => (cols[1].trim(), ""),
            };
            let (strong, morph) = cols[3].split_once('=').unwrap_or((cols[3], ""));
            let strong = strong.trim();
            // TAGNT tags every ἐμοῦ as the possessive "my" (S-1SGSN), but after a
            // preposition (μετ᾽ ἐμοῦ, "with me") it is the pronoun; only τοῦ ἐμοῦ is "my".
            let after_tou = words[idx as usize].last().is_some_and(|w| w.surface.trim_matches(|c: char| !c.is_alphabetic()) == "τοῦ");
            let morph = if strong == "G1473" && morph.trim() == "S-1SGSN" && !after_tou { "P-1GS" } else { morph };
            let lemma = is_strong(strong).then(|| strong.to_string());
            if let (Some(l), Some((form, gloss))) = (&lemma, cols[4].split_once('=')) {
                forms.entry(l.clone()).or_insert_with(|| (form.trim().to_string(), gloss.trim().to_string()));
            }
            let main = kind.contains(['N', 'n']);
            let variant = kind != "NKO";
            let mv = cols.get(6).map(|s| s.trim()).filter(|s| !s.is_empty());
            let note = (variant || mv.is_some()).then(|| WordNote {
                kind: kind.to_string(),
                editions: Some(cols[5].trim().to_string()).filter(|s| !s.is_empty()),
                variants: mv.map(str::to_string),
            });
            words[idx as usize].push(Word {
                surface: surface.to_string(),
                translit: translit.to_string(),
                gloss: cols[2].trim().to_string(),
                lemma,
                morph: morph.trim().to_string(),
                lang: Lang::Greek,
                main,
                variant,
                significant: significant(kind, true),
                note,
                key: strong.get(..5).unwrap_or(strong).to_string(),
                src_verse: None,
                pieces: Vec::new(),
                form: {
                    // A capital that only starts a sentence (Μακάριοι) is not part
                    // of the word; names, places and titles keep theirs.
                    let m = morph.trim();
                    let lower = cols[4].split('=').next().and_then(|f| f.trim().chars().next()).is_some_and(char::is_lowercase)
                        && !["-L", "-P", "-T"].iter().any(|t| m.ends_with(t));
                    let core = surface.trim_matches(|c: char| !c.is_alphabetic());
                    let mut sp = enclitic_accent_out(&acute(core));
                    if lower {
                        let mut cs = sp.chars();
                        sp = cs.next().map(|f| f.to_lowercase().chain(cs).collect()).unwrap_or_default();
                    }
                    // An elided word (ἀλλ᾽) is shown only where the word is never written in full.
                    let elided = surface.trim_start_matches(|c: char| !c.is_alphabetic())[core.len()..].starts_with(['\u{1FBD}', '\u{2019}']);
                    // A compound the source files under its first part (ἀπέπνιξαν under ἀπό)
                    // is another word; crasis with καί (κἀγώ) is a form of the word.
                    let compound = m.contains(" + ") && strong != "G2532" && !m.contains("G2532=");
                    let code = if compound { String::new() } else { greek_code(m).to_string() };
                    Form { full: if elided { format!("{sp}\u{1FBD}") } else { sp.clone() }, plain: sp, ending: elided, suffix: String::new(), code }
                },
            });
        }
    }
    Ok(())
}

// ---------------------------------------------------------------- Lexicons (TBESH / TBESG)

#[derive(Clone, Debug)]
pub struct LexEntry {
    pub word: String,
    pub translit: String,
    pub morph: String,
    pub gloss: String,
    pub definition: String,
    pub source: &'static str,
    /// The lexicon's own entry (column 0, as "H1121a"): senses split from one
    /// Strong's number share it, homonyms (חֶסֶד kindness, חֶסֶד shame) do not.
    pub estrong: String,
    /// How this sense relates to `target` ("a Meaning of", "in Aramaic of",
    /// "a Form of"...), empty for a word's own entry.
    pub relation: String,
    pub target: String,
    /// Whose words the definition is: one of the `ORIGIN_*` codes, read by
    /// `origin` from the entry itself.
    pub origin: &'static str,
}

/// TBESG, "(AS)": "Abbott Smith - from https://github.com/translatable-exegetical-tools/Abbott-Smith,
/// with corrections and adapted by Tyndale Scholars" (the file's own key):
/// G. Abbott-Smith, A Manual Greek Lexicon of the New Testament (1922).
pub const ORIGIN_ABBOTT_SMITH: &str = "as";
/// TBESG, "(ML)": "Middle Liddell - from Perseus - used for Meaning in the
/// Brief lexicon when there is no entry by (AS)": Liddell and Scott, An
/// Intermediate Greek-English Lexicon (Oxford, 1889).
pub const ORIGIN_MIDDLE_LIDDELL: &str = "ml";
/// TBESG with neither mark: "Those without attribution have been added by STEPBible."
pub const ORIGIN_STEP_GREEK: &str = "sg";
/// TBESH meanings: "based on the Abridged BDB by Online Bible" (Larry Pierce),
/// "edited to conform with OpenScripture's extended Strongs by Tyndale House":
/// Brown, Driver and Briggs, A Hebrew and English Lexicon of the Old Testament (1906).
pub const ORIGIN_BDB: &str = "bdb";
/// A TBESH entry that opens with STEPBible's own note on a person or place
/// ("A man living at the time of United Monarchy, first mentioned at ...")
/// and gives the abridged BDB entry after a "§".
pub const ORIGIN_STEP_THEN_BDB: &str = "sn";
/// A TBESH entry on a person or place that is STEPBible's note alone.
pub const ORIGIN_STEP_HEBREW: &str = "s";

/// The lines STEPBible adds to a TBESH entry to point at other entries
/// ("Aramaic of a.dar (אֲדָר "Adar" H0143)", "Another name of ..."). They
/// link words; they say nothing of whose definition the entry is.
const STEP_LINKS: [&str; 15] = [
    "aramaic of",
    "hebrew of",
    "also named",
    "also called",
    "another name of",
    "aramaic equivalent",
    "hebrew equivalent",
    "also means",
    "another spelling of",
    "group of",
    "combined with",
    "a sub-meaning of",
    "a grammatical form of",
    "a shortened name of",
    "a name like",
];

/// STEPBible's own note on a person or place: "A man living at the time of
/// United Monarchy, first mentioned at 1Ki.7.13".
fn step_note(line: &str) -> bool {
    ["living at the time of", "living before", "first mentioned at", "only mentioned at"].iter().any(|p| line.contains(p))
}

/// BDB's own way of opening a name: `Abel Meholah = "meadow of dancing"`.
fn bdb_name(line: &str) -> bool {
    match line.split_once('=') {
        Some((name, rest)) => !name.trim().is_empty() && name.chars().count() <= 60 && rest.trim_start().starts_with(['"', '\u{201C}']),
        None => false,
    }
}

/// Whose words a lexicon entry's definition is. TBESG marks each entry it
/// takes from a printed lexicon at its end. TBESH gives the abridged BDB,
/// except where STEPBible writes its own note on a person or place; after such
/// a note it marks where BDB's entry begins with "§". STEPBible's lines that
/// only point at other entries (`STEP_LINKS`) do not count either way.
pub fn origin(source: &str, morph: &str, definition: &str) -> &'static str {
    let t = definition.trim_end();
    if source == "tbesg" {
        if t.ends_with("(AS)") {
            return ORIGIN_ABBOTT_SMITH;
        }
        if t.ends_with("(ML)") {
            return ORIGIN_MIDDLE_LIDDELL;
        }
        return ORIGIN_STEP_GREEK;
    }
    let plain = lexicon_plain(definition);
    let (before, bdb_after) = match plain.split_once('§') {
        Some((b, _)) => (b, true),
        None => (plain.as_str(), false),
    };
    let own: Vec<&str> = before
        .lines()
        .map(|l| l.trim().trim_start_matches('#').trim_start())
        .filter(|l| !l.is_empty() && !STEP_LINKS.iter().any(|p| l.to_lowercase().starts_with(p)))
        .collect();
    if bdb_after {
        return if own.is_empty() { ORIGIN_BDB } else { ORIGIN_STEP_THEN_BDB };
    }
    let Some(first) = own.first() else {
        // Only STEPBible's links to other entries.
        return ORIGIN_STEP_HEBREW;
    };
    if step_note(first) {
        return ORIGIN_STEP_HEBREW;
    }
    // A name whose text is neither BDB's opening nor BDB's numbered senses.
    if morph.starts_with("N:") && !bdb_name(first) && !first.starts_with("1)") {
        return ORIGIN_STEP_HEBREW;
    }
    ORIGIN_BDB
}

/// A definition's text with its markup taken out and `<br>` as a new line,
/// for reading what it says (not for showing: `lexhtml::segments` does that).
fn lexicon_plain(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut rest = html;
    while let Some(lt) = rest.find('<') {
        out.push_str(&rest[..lt]);
        let Some(gt) = rest[lt..].find('>') else {
            rest = "";
            break;
        };
        if rest[lt + 1..lt + gt].trim_start_matches('/').get(..2).is_some_and(|t| t.eq_ignore_ascii_case("br")) {
            out.push('\n');
        }
        rest = &rest[lt + gt + 1..];
    }
    out.push_str(rest);
    out
}

/// The definition as the word study shows it: without the "(AS)" or "(ML)"
/// that ends a TBESG entry (the credit under the entry names the lexicon), nor
/// the line break before it.
pub fn shown(definition: &str) -> &str {
    let mut t = definition.trim_end();
    for mark in ["(AS)", "(ML)"] {
        if let Some(s) = t.strip_suffix(mark) {
            t = s.trim_end();
            while let Some(n) = ["<br />", "<br/>", "<br>"].iter().find(|b| t.len() >= b.len() && t.get(t.len() - b.len()..).is_some_and(|e| e.eq_ignore_ascii_case(b))).map(|b| b.len()) {
                t = t[..t.len() - n].trim_end();
            }
            break;
        }
    }
    t
}

/// An outline of numbered senses, as BDB gives most words ("1) perish, vanish ...").
pub fn is_outline(definition: &str) -> bool {
    lexicon_plain(definition).trim_start().starts_with("1)")
}

/// The build's line on whose words the shipped definitions are, from each
/// root's entry and whether Strong's has a line for its number.
pub fn origins_line<'a>(entries: impl Iterator<Item = (&'a LexEntry, bool)>) -> String {
    let mut n: HashMap<&str, usize> = HashMap::new();
    let (mut outlines, mut strongs) = (0, 0);
    for (e, k) in entries {
        *n.entry(e.origin).or_default() += 1;
        outlines += usize::from(e.origin == ORIGIN_BDB && is_outline(&e.definition));
        strongs += usize::from(k);
    }
    let c = |o: &str| n.get(o).copied().unwrap_or(0);
    format!(
        "lexicon credits: Greek {} Abbott-Smith, {} Middle Liddell, {} STEPBible's own; Hebrew {} abridged BDB ({outlines} outlines), {} STEPBible's note then BDB's, {} STEPBible's own; Strong's own line for {strongs} roots",
        c(ORIGIN_ABBOTT_SMITH),
        c(ORIGIN_MIDDLE_LIDDELL),
        c(ORIGIN_STEP_GREEK),
        c(ORIGIN_BDB),
        c(ORIGIN_STEP_THEN_BDB),
        c(ORIGIN_STEP_HEBREW)
    )
}

pub fn lexicon(path: &Path, source: &'static str, out: &mut HashMap<String, LexEntry>) -> Result<usize, String> {
    let text = read(path)?;
    let mut n = 0;
    for line in text.lines() {
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 8 || !is_strong(cols[0].trim()) {
            continue;
        }
        let key = cols[1].split_whitespace().next().unwrap_or("").trim();
        if !is_strong(key) {
            continue;
        }
        n += 1;
        out.entry(key.to_string()).or_insert_with(|| LexEntry {
            word: cols[3].trim().to_string(),
            translit: cols[4].trim().to_string(),
            morph: cols[5].trim().to_string(),
            gloss: cols[6].trim().to_string(),
            definition: cols[7].trim().to_string(),
            source,
            estrong: cols[0].trim().to_string(),
            relation: cols[1].split_once('=').map_or("", |x| x.1).trim().to_string(),
            target: cols[2].split_whitespace().next().unwrap_or("").to_string(),
            origin: origin(source, cols[5].trim(), cols[7].trim()),
        });
    }
    Ok(n)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn step_refs() {
        assert_eq!(step_ref("Gen.1.1#01=L"), Some(("Gen.1.1", 1, "L")));
        assert_eq!(step_ref("Mal.4.1(3.19)#02=L"), Some(("Mal.4.1", 2, "L")));
        assert_eq!(step_ref("1Jn.2.14[2.13]#03=NKO"), Some(("1Jn.2.14", 3, "NKO")));
        assert_eq!(braced("H9003/{H7225G}"), Some("H7225G"));
        assert_eq!(kjv_alternative("3Jn.1.15[1.14]#01=NKO").as_deref(), Some("3Jn.1.14"));
        assert_eq!(clean_join("כִּֽי\\־"), "כִּֽי־");
        assert_eq!(hebrew_ref("Mal.4.1(3.19)#01=L").as_deref(), Some("Mal.3.19"));
        assert_eq!(hebrew_ref("Psa.3.1(3.2)#01=L").as_deref(), Some("Psa.3.2"));
        assert_eq!(hebrew_ref("Gen.1.1#01=L").as_deref(), Some("Gen.1.1"));
        assert_eq!(consonants("בַּ/עֲרִיפֶֽי/הָ\\׃\\ \\פ"), "בעריפיה");
        assert_eq!(one_gender("אֶחָ֔ד", "{H0259}", "HAcfsa"), "HAcmsa");
        assert_eq!(one_gender("הָ/אַחַ֖ת", "H9009/{H0259}", "HTd/Acfsa"), "HTd/Acfsa");
        assert_eq!(one_gender("אַחַ֣ד", "{H0259}", "HAcfsc"), "HAcmsc");
        assert_eq!(one_gender("שְׁלֹשָׁה", "{H7969}", "HAcbsa"), "HAcbsa");
        let p = pieces("כְּ/נַהֲמַת\\־", "like/ [the] growling of");
        assert_eq!(p, [("כְּ".to_string(), "like".to_string()), ("נַהֲמַת־".to_string(), "[the] growling of".to_string())]);
        assert!(pieces("יָ֑ם", "[the] sea").is_empty());
        assert!(is_strong("G0976") && is_strong("H7225G") && !is_strong("H90"));
        let f = hebrew_form("וַ/יִּשְׁבֹּת֙", "H9001/{H7673A}", "Hc/Vqw3ms");
        assert_eq!((f.plain.as_str(), f.full.as_str(), f.ending, f.code.as_str()), ("יִשְׁבֹּת", "יִשְׁבֹּת", false, "HVqw3ms"));
        let f = hebrew_form("הַ/מֶּ֫לֶךְ", "H9009/{H4428G}", "HTd/Ncmsa");
        assert_eq!((f.plain.as_str(), f.code.as_str()), ("מֶלֶךְ", "HNcmsa"));
        let f = hebrew_form("עַמִּ֛/י", "{H5971A}/H9030", "HNcmsc/Sp1bs");
        assert_eq!((f.plain.as_str(), f.full.as_str(), f.ending), ("עַמִּ", "עַמִּי", true));
        let f = hebrew_form("מַלְכָּ/א֙", "{H4430}/H9010", "ANcbsd/Ta");
        assert_eq!((f.full.as_str(), f.ending, f.code.as_str()), ("מַלְכָּא", true, "ANcbsd"));
        let f = hebrew_form("וּ/בְ/פָנָי/ו", "H9002/H9003/{H6440G}/H9023", "HC/R/Ncbpc/Sp3ms");
        assert_eq!(f.plain, "\u{05E4}\u{05BC}\u{05B8}\u{05E0}\u{05B8}\u{05D9}");
        let f = hebrew_form("מִמֶּ֑/נּוּ", "{H4480A}/H9033", "HRd/Sp3ms");
        assert_eq!(f.code, "HR");
        let f = hebrew_form("כְּ/כֹ֖ל/ /אֲשֶׁ֥ר", "H9004/{H3605}//H0834A", "HR/Ncmsc//Tr");
        assert_eq!(f.full, "\u{05DB}\u{05BC}\u{05B9}\u{05DC}");
        assert!(hebrew_form("ל֣/וֹ", "H9005/{H8104H}", "HR/Sp3ms").code.is_empty());
        assert_eq!(greek_code("A-ASM-N"), "A-ASM");
        assert_eq!(greek_code("N-NSM-T"), "N-NSM");
    }

    #[test]
    fn lexicon_origins() {
        // TBESH H0001H: STEPBible's own note on a person, though its code is a common noun's.
        let huram = "A man living at the time of United Monarchy, first mentioned at 1Ki.7.13; also called Huram-abi (KJV: \"Huram my father's\") at 2Ch.2.13; 4.16; <BR>Combined with <i>chi.ram</i> (חִירָם \"Hiram\" H2438H)";
        assert_eq!(origin("tbesh", "H:N-M", huram), ORIGIN_STEP_HEBREW);
        // An outline (H0006) and a short meaning (H0008) are the abridged BDB.
        assert_eq!(origin("tbesh", "H:V", "1) perish, vanish, go astray, be destroyed<br>1a) (Qal)<br>1a1) perish, die, be exterminated"), ORIGIN_BDB);
        assert_eq!(origin("tbesh", "H:N-M", "destruction"), ORIGIN_BDB);
        // STEPBible's line pointing at another entry does not make it STEPBible's (H0002).
        assert_eq!(origin("tbesh", "A:N-M", "father<BR>Aramaic of <i>av</i> (אָב \"father\" H0001)"), ORIGIN_BDB);
        // STEPBible's note, then BDB's name entry after "§" (H0005).
        let abagtha = "A man living at the time of Exile and Return, only mentioned at Est.1.10 <BR> § Abagtha = \"God-given\"<br> one of the seven eunuchs in the Persian court of Ahasuerus<br>";
        assert_eq!(origin("tbesh", "N:N-M-P", abagtha), ORIGIN_STEP_THEN_BDB);
        // Only STEPBible's link before the "§": BDB's (H0144).
        assert_eq!(origin("tbesh", "A:N--T", " <BR>Aramaic of <i>a.dar</i> (אֲדָר \"Adar\" H0143) <BR> § Adar = \"glorious\"<br> twelfth month"), ORIGIN_BDB);
        // BDB's own opening of a name, with STEPBible's link after it (H0063).
        assert_eq!(origin("tbesh", "N:N--L", "Abel Shittim = \"meadow of acacias\"<br> place in lowlands of Moab<BR>Another name of <i>shit.tim</i> (שִׁטִּים \"Shittim\" H7851G)"), ORIGIN_BDB);
        // A name STEPBible describes in its own words (H1628).
        assert_eq!(origin("tbesh", "N:N--L", "This name means  lodging place"), ORIGIN_STEP_HEBREW);
        // TBESG marks its sources at the end.
        assert_eq!(origin("tbesg", "N:N--L", " <b>Γαββαθα</b> (Rec. -θᾶ), ἡ, indecl., <BR /> <b>Gabbatha</b>: <ref='Jhn.19.13.'>Jhn.19:13.</ref>†<BR /> (AS)"), ORIGIN_ABBOTT_SMITH);
        assert_eq!(origin("tbesg", "G:V", "<b>to dwell in the field </b>, (New Testament) (ML)"), ORIGIN_MIDDLE_LIDDELL);
        assert_eq!(origin("tbesg", "G:V", "refrain, receive/be far, keep away from "), ORIGIN_STEP_GREEK);
        // The mark leaves the shown text, with the line break before it.
        assert_eq!(shown(" <b>Gabbatha</b>: Jhn.19:13.†<BR /> (AS)"), " <b>Gabbatha</b>: Jhn.19:13.†");
        assert_eq!(shown("<b>incorruption </b>, (New Testament) (ML)"), "<b>incorruption </b>, (New Testament)");
        assert_eq!(shown("ἐν τῇ (AS) of the entry"), "ἐν τῇ (AS) of the entry");
        assert_eq!(shown("destruction"), "destruction");
    }

    #[test]
    fn variant_significance() {
        for (k, want) in [("NKO", false), ("N(k)O", false), ("NK(o)", false), ("N(K)O", true), ("K", true), ("KO", true), ("NO", true), ("no", false), ("ko", false), ("N(k)(o)", false)] {
            assert_eq!(significant(k, true), want, "greek {k}");
        }
        for (k, want) in [("L", false), ("L(p)", false), ("Q(K)", true), ("Q(k)", false), ("X", true), ("R", true), ("LB(ah)", false), ("L(abh)", false)] {
            assert_eq!(significant(k, false), want, "hebrew {k}");
        }
    }
}
