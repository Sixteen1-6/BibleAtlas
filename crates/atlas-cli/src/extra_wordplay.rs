//! Wordplay: the alphabet poems of the Hebrew Bible, where each part starts
//! with the next letter from aleph to tav. Every letter listed below is
//! checked against the first letter of the named word in STEPBible's TAHOT
//! (CC BY 4.0, already a source), so a typo or a shifted verse stops the
//! build. The plays on words themselves come from the reviewed layers in
//! `layers.json`; the web side reads them there.

use crate::loaded::Loaded;
use crate::parse::WordsByVerse;
use atlas_core::{refs, Versification};
use serde_json::{json, Value};
use std::fs;

const OUT: &str = "extras/wordplay.json";

/// The 22 letters in order, as their plain (non-final) forms.
const ALEPH_BET: [char; 22] = [
    'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק',
    'ר', 'ש', 'ת',
];
const AYIN: usize = 15;
const PE: usize = 16;

/// How the parts of a poem are laid out.
enum Layout {
    /// Every `step` verses from verse `from` of the chapter, one letter each,
    /// in alphabet order (`pe_first`: pe before ayin), each on its first word.
    Regular {
        from: u32,
        step: u32,
        pe_first: bool,
    },
    /// Listed one by one: `verse[.word]=letter`, word 0 if left out, with a
    /// mark after the letter: `*` a line outside the alphabet or a repeat,
    /// `~` a line most Hebrew copies leave out, `+` the letter follows "and".
    Listed(&'static str),
}

struct Poem {
    chapter: &'static str,
    layout: Layout,
    line: &'static str,
    note: &'static str,
}

const POEMS: [Poem; 10] = [
    Poem {
        chapter: "Psalms 25",
        layout: Layout::Listed("1.1=א 2.1=ב 3=ג 4=ד 5=ה 6=ז 7=ח 8=ט 9=י 10=כ 11=ל 12=מ 13=נ 14=ס 15=ע 16=פ 17=צ 18=ר 19=ר* 20=ש 21=ת 22=פ*"),
        line: "An alphabet poem: each verse starts with the next Hebrew letter",
        note: "There is no line for vav or qof. Verses 18 and 19 both start with resh, and a last line, verse 22, starts with pe, outside the alphabet. In verse 2 the letter starts the second word.",
    },
    Poem {
        chapter: "Psalms 34",
        layout: Layout::Listed("1.8=א 2=ב 3=ג 4=ד 5=ה 6=ז 7=ח 8=ט 9=י 10=כ 11=ל 12=מ 13=נ 14=ס 15=ע 16=פ 17=צ 18=ק 19=ר 20=ש 21=ת 22=פ*"),
        line: "An alphabet poem: each verse starts with the next Hebrew letter",
        note: "There is no line for vav, and a last line, verse 22, starts with pe, outside the alphabet, as in Psalm 25. Verse 1 starts after the psalm's title.",
    },
    Poem {
        chapter: "Psalms 37",
        layout: Layout::Listed("1.1=א 3=ב 5=ג 7=ד 8=ה 10=ו 12=ז 14=ח 16=ט 18=י 20=כ 21=ל 23=מ 25=נ 27=ס 30=פ 32=צ 34=ק 35=ר 37=ש 39=ת+"),
        line: "An alphabet poem: about every two verses start a new Hebrew letter",
        note: "There is no clear line for ayin, and the line for tav starts after the word \"and\".",
    },
    Poem {
        chapter: "Psalms 119",
        layout: Layout::Regular { from: 1, step: 8, pe_first: false },
        line: "An alphabet poem: every 8 verses start with the next Hebrew letter",
        note: "All eight verses of each part start with that part's letter, so the poem runs from aleph to tav eight times over.",
    },
    Poem {
        chapter: "Psalms 145",
        layout: Layout::Listed("1.2=א 2=ב 3=ג 4=ד 5=ה 6=ו 7=ז 8=ח 9=ט 10=י 11=כ 12=ל 13=מ 13.8=נ~ 14=ס 15=ע 16=פ 17=צ 18=ק 19=ר 20=ש 21=ת"),
        line: "An alphabet poem: each verse starts with the next Hebrew letter",
        note: "Most Hebrew copies have no line for nun. A Dead Sea Scroll and the old Greek translation have one, and the BSB includes it at the end of verse 13.",
    },
    Poem {
        chapter: "Proverbs 31",
        layout: Layout::Regular { from: 10, step: 1, pe_first: false },
        line: "Verses 10–31 are an alphabet poem, each verse a new Hebrew letter",
        note: "",
    },
    Poem {
        chapter: "Lamentations 1",
        layout: Layout::Regular { from: 1, step: 1, pe_first: false },
        line: "An alphabet poem: each verse starts with the next Hebrew letter",
        note: "",
    },
    Poem {
        chapter: "Lamentations 2",
        layout: Layout::Regular { from: 1, step: 1, pe_first: true },
        line: "An alphabet poem: each verse starts with the next Hebrew letter",
        note: "Here pe comes before ayin, the other way round from chapter 1, as in chapters 3 and 4.",
    },
    Poem {
        chapter: "Lamentations 3",
        layout: Layout::Regular { from: 1, step: 3, pe_first: true },
        line: "An alphabet poem: every 3 verses start with the next Hebrew letter",
        note: "All three verses of each part start with that part's letter. Pe comes before ayin, as in chapters 2 and 4.",
    },
    Poem {
        chapter: "Lamentations 4",
        layout: Layout::Regular { from: 1, step: 1, pe_first: true },
        line: "An alphabet poem: each verse starts with the next Hebrew letter",
        note: "Here pe comes before ayin, as in chapters 2 and 3.",
    },
];

/// One part of a poem: (letter index, verse, word position, mark).
type Part = (usize, u32, u32, u8);
const NORMAL: u8 = 0;
const EXTRA: u8 = 1;
const OTHER_COPIES: u8 = 2;
const AFTER_AND: u8 = 3;
/// A later verse of a part, which repeats its letter: checked, not listed.
const REPEAT: u8 = 4;

/// The Hebrew consonants of a word, final forms folded into plain ones.
fn consonants(word: &str) -> Vec<char> {
    word.chars()
        .filter(|c| ('\u{05D0}'..='\u{05EA}').contains(c))
        .map(|c| match c {
            'ך' => 'כ',
            'ם' => 'מ',
            'ן' => 'נ',
            'ף' => 'פ',
            'ץ' => 'צ',
            c => c,
        })
        .collect()
}

fn letter_index(c: char) -> Option<usize> {
    ALEPH_BET.iter().position(|&l| l == c)
}

/// The parts of a poem, before checking: verses are chapter verse numbers.
fn parts(layout: &Layout, verses_in_chapter: u32) -> Result<Vec<Part>, String> {
    match layout {
        Layout::Regular {
            from,
            step,
            pe_first,
        } => {
            let mut order: Vec<usize> = (0..22).collect();
            if *pe_first {
                order.swap(AYIN, PE);
            }
            let mut out = Vec::new();
            for (k, &letter) in order.iter().enumerate() {
                for i in 0..*step {
                    let v = from + k as u32 * step + i;
                    if v > verses_in_chapter {
                        return Err(format!("verse {v} is past the end of the chapter"));
                    }
                    out.push((letter, v, 0, if i == 0 { NORMAL } else { REPEAT }));
                }
            }
            Ok(out)
        }
        Layout::Listed(spec) => spec
            .split_whitespace()
            .map(|tok| {
                let (at, rest) = tok
                    .split_once('=')
                    .ok_or_else(|| format!("{tok:?} has no '='"))?;
                let (v, w) = match at.split_once('.') {
                    Some((v, w)) => (
                        v,
                        w.parse::<u32>()
                            .map_err(|_| format!("{tok:?}: bad word number"))?,
                    ),
                    None => (at, 0),
                };
                let v: u32 = v
                    .parse()
                    .map_err(|_| format!("{tok:?}: bad verse number"))?;
                let mut chars = rest.chars();
                let letter = chars
                    .next()
                    .and_then(letter_index)
                    .ok_or_else(|| format!("{tok:?}: not a Hebrew letter"))?;
                let mark = match chars.as_str() {
                    "" => NORMAL,
                    "*" => EXTRA,
                    "~" => OTHER_COPIES,
                    "+" => AFTER_AND,
                    m => return Err(format!("{tok:?}: unknown mark {m:?}")),
                };
                Ok((letter, v, w, mark))
            })
            .collect(),
    }
}

/// The files to write under web/public/data, as (path, bytes).
pub fn build(vz: &Versification, words: &WordsByVerse) -> Result<Vec<(String, Vec<u8>)>, String> {
    let mut poems: Vec<Value> = Vec::new();
    let mut checked = 0usize;
    for poem in &POEMS {
        let at = poem.chapter;
        let (first, last) = refs::parse(at)
            .and_then(|q| refs::resolve(q, vz))
            .ok_or_else(|| format!("wordplay: {at} does not resolve"))?;
        let q = refs::parse(at).ok_or_else(|| format!("wordplay: {at} does not parse"))?;
        let mut out: Vec<Part> = Vec::new();
        for (letter, v, w, mark) in
            parts(&poem.layout, last - first + 1).map_err(|e| format!("wordplay: {at}: {e}"))?
        {
            let verse = first + v - 1;
            let word = words[verse as usize]
                .get(w as usize)
                .ok_or_else(|| format!("wordplay: {at}:{v} has no word {w}"))?;
            let cs = consonants(&word.surface);
            let start = match mark {
                AFTER_AND if cs.first() == Some(&'ו') => cs.get(1),
                AFTER_AND => {
                    return Err(format!(
                        "wordplay: {at}:{v} word {w} ({}) does not start with \"and\"",
                        word.surface
                    ))
                }
                _ => cs.first(),
            };
            if start != Some(&ALEPH_BET[letter]) {
                return Err(format!(
                    "wordplay: {at}:{v} word {w} is {} ({}), which does not start with {}",
                    word.surface, word.translit, ALEPH_BET[letter]
                ));
            }
            // TAHOT marks words that are not in the Leningrad Codex but come from
            // other copies (X: the Greek translation and the Dead Sea Scrolls; R: restored).
            let other = word
                .note
                .as_ref()
                .is_some_and(|n| n.kind.starts_with(['X', 'R']));
            if (mark == OTHER_COPIES) != other {
                return Err(format!(
                    "wordplay: {at}:{v} word {w}: marked {} but TAHOT says otherwise",
                    if other {
                        "main text"
                    } else {
                        "from other copies"
                    }
                ));
            }
            checked += 1;
            if mark != REPEAT {
                out.push((letter, verse, w, mark));
            }
        }
        let missing: Vec<usize> = (0..22)
            .filter(|l| !out.iter().any(|p| p.0 == *l && p.3 != EXTRA))
            .collect();
        poems.push(json!({
            "book": q.book, "chapter": q.chapter, "from": out.iter().map(|p| p.1).min(), "to": last,
            "line": poem.line, "note": poem.note, "parts": out, "missing": missing,
        }));
    }
    eprintln!(
        "wordplay: {} alphabet poems, {checked} letters checked against TAHOT",
        poems.len()
    );
    let doc = json!({ "format": 1, "letters": ALEPH_BET.iter().map(|c| c.to_string()).collect::<Vec<_>>(), "acrostics": poems });
    Ok(vec![(
        OUT.to_string(),
        serde_json::to_vec(&doc).map_err(|e| e.to_string())?,
    )])
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let path = d.dir.join(OUT);
    let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let doc: Value =
        serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))?;
    let poems = doc["acrostics"]
        .as_array()
        .ok_or("wordplay.json has no acrostics")?;
    let n = d.vz.verse_count() as u64;
    let parts = |book: u64, chapter: u64| -> Vec<Vec<u64>> {
        let p = poems
            .iter()
            .find(|p| p["book"] == book && p["chapter"] == chapter);
        p.and_then(|p| p["parts"].as_array())
            .into_iter()
            .flatten()
            .filter_map(|x| x.as_array())
            .map(|x| x.iter().filter_map(Value::as_u64).collect())
            .collect()
    };
    let ps119 = parts(18, 119);
    let (p119, _) = d.resolve("Ps 119:1")?;
    let (p31, _) = d.resolve("Prov 31:10")?;
    let prov31 = parts(19, 31);
    Ok(vec![
        (
            poems.len() == POEMS.len(),
            format!("{} alphabet poems, expected {}", poems.len(), POEMS.len()),
        ),
        (
            ps119.len() == 22
                && ps119
                    .iter()
                    .enumerate()
                    .all(|(i, p)| p[0] == i as u64 && p[1] == u64::from(p119) + 8 * i as u64),
            "Psalm 119 has 22 parts of 8 verses, aleph to tav".to_string(),
        ),
        (
            prov31.len() == 22 && prov31[0][1] == u64::from(p31),
            "Proverbs 31's alphabet poem starts at verse 10".to_string(),
        ),
        (
            poems
                .iter()
                .flat_map(|p| p["parts"].as_array().into_iter().flatten())
                .all(|x| x[1].as_u64().is_some_and(|v| v < n)),
            "every alphabet-poem verse is a real verse".to_string(),
        ),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folds_final_letters_and_drops_points() {
        assert_eq!(consonants("אָדָם"), vec!['א', 'ד', 'מ']);
        assert_eq!(consonants("הַקֵּץ֙"), vec!['ה', 'ק', 'צ']);
        assert_eq!(consonants("מָֽה־"), vec!['מ', 'ה']);
    }

    #[test]
    fn lays_out_parts() {
        let regular = parts(
            &Layout::Regular {
                from: 1,
                step: 3,
                pe_first: true,
            },
            66,
        )
        .unwrap();
        assert_eq!(regular.len(), 66);
        assert_eq!(regular[0], (0, 1, 0, NORMAL));
        assert_eq!(regular[1], (0, 2, 0, REPEAT));
        assert_eq!(regular[45], (PE, 46, 0, NORMAL));
        assert_eq!(regular[48], (AYIN, 49, 0, NORMAL));
        assert!(parts(
            &Layout::Regular {
                from: 1,
                step: 8,
                pe_first: false
            },
            175
        )
        .is_err());
        let listed = parts(&Layout::Listed("1.8=א 2=ב 13.8=נ~ 22=פ* 39=ת+"), 40).unwrap();
        assert_eq!(
            listed,
            vec![
                (0, 1, 8, NORMAL),
                (1, 2, 0, NORMAL),
                (13, 13, 8, OTHER_COPIES),
                (PE, 22, 0, EXTRA),
                (21, 39, 0, AFTER_AND)
            ]
        );
        assert!(parts(&Layout::Listed("3=x"), 10).is_err());
        assert!(parts(&Layout::Listed("3=א?"), 10).is_err());
    }
}
