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
    /// A pronoun ending or the Aramaic article follows the root's part.
    pub ending: bool,
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
    if segs.len() != parts.len() || codes.len() != parts.len() {
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
    if !segs[at].contains('\\') {
        for k in at + 1..segs.len() {
            let piece = segs[k].split('\\').next().unwrap_or("");
            let l = letters(piece);
            if !l.chars().any(|c| matches!(c, '\u{05D0}'..='\u{05EA}')) {
                break;
            }
            full.push_str(&l);
            ending |= codes[k].starts_with('S') || codes[k] == "Ta";
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
    Form { plain: tidy(plain), full: tidy(full), ending, code: format!("{lang}{code}") }
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

pub fn tahot(paths: &[impl AsRef<Path>], vz: &Versification, words: &mut WordsByVerse, tally: &mut Tally) -> Result<(), String> {
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
            let grammar = cols[5].trim();
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
                    let mut sp = acute(surface.trim_matches(|c: char| !c.is_alphabetic()));
                    if lower {
                        let mut cs = sp.chars();
                        sp = cs.next().map(|f| f.to_lowercase().chain(cs).collect()).unwrap_or_default();
                    }
                    Form { full: sp.clone(), plain: sp, ending: false, code: greek_code(m).to_string() }
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
    fn variant_significance() {
        for (k, want) in [("NKO", false), ("N(k)O", false), ("NK(o)", false), ("N(K)O", true), ("K", true), ("KO", true), ("NO", true), ("no", false), ("ko", false), ("N(k)(o)", false)] {
            assert_eq!(significant(k, true), want, "greek {k}");
        }
        for (k, want) in [("L", false), ("L(p)", false), ("Q(K)", true), ("Q(k)", false), ("X", true), ("R", true), ("LB(ah)", false), ("L(abh)", false)] {
            assert_eq!(significant(k, false), want, "hebrew {k}");
        }
    }
}
