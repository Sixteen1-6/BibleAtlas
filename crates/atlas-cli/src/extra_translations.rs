//! Search text from two more public-domain translations, so a verse someone
//! remembers in other wording is still found:
//!
//! - King James Version (1769), public domain.
//! - American Standard Version (1901), public domain. Many modern
//!   translations descend from it, so its wording is often close to theirs.
//!
//! Outputs, under web/public/data: search/kjv.txt and search/asv.txt, one
//! line per BSB verse in verse-index order (empty where a translation has no
//! such verse). Search reads them; the app never shows them.

use crate::sources::Inputs;
use atlas_core::Versification;
use serde::Deserialize;
use std::fs;

#[derive(Deserialize)]
struct File {
    books: Vec<Book>,
}
#[derive(Deserialize)]
struct Book {
    chapters: Vec<Chapter>,
}
#[derive(Deserialize)]
struct Chapter {
    chapter: u16,
    verses: Vec<Verse>,
}
#[derive(Deserialize)]
struct Verse {
    verse: u16,
    text: String,
}

/// One line per BSB verse. A verse the BSB numbers differently is folded
/// into the chapter's last verse rather than dropped.
pub fn lines(json: &str, vz: &Versification, name: &str) -> Result<String, String> {
    let f: File = serde_json::from_str(json).map_err(|e| format!("parsing {name}: {e}"))?;
    if f.books.len() != 66 {
        return Err(format!("{name} has {} books, expected 66", f.books.len()));
    }
    let mut out: Vec<String> = vec![String::new(); vz.verse_count() as usize];
    for (b, book) in f.books.iter().enumerate() {
        for c in &book.chapters {
            let Some(last) = vz.verses_in(b as u8, c.chapter) else { continue };
            for v in &c.verses {
                let Some(i) = vz.index(b as u8, c.chapter, v.verse.clamp(1, last)) else { continue };
                let t: String = v.text.chars().map(|ch| if ch.is_control() { ' ' } else { ch }).collect();
                let line = &mut out[i as usize];
                if !line.is_empty() {
                    line.push(' ');
                }
                line.push_str(t.trim());
            }
        }
    }
    let filled = out.iter().filter(|l| !l.is_empty()).count();
    if filled * 100 < out.len() * 99 {
        return Err(format!("{name} covers only {filled} of {} verses", out.len()));
    }
    let mut s = out.join("\n");
    s.push('\n');
    Ok(s)
}

pub fn build(inputs: &Inputs, vz: &Versification) -> Result<Vec<(String, Vec<u8>)>, String> {
    let mut files = Vec::new();
    for (id, name) in [("kjv", "KJV"), ("asv", "ASV")] {
        let p = inputs.path(id, id);
        let json = fs::read_to_string(&p).map_err(|e| format!("{}: {e}", p.display()))?;
        files.push((format!("search/{id}.txt"), lines(&json, vz, name)?.into_bytes()));
    }
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folds_extra_verses_into_the_last() {
        let mut counts = vec![vec![2u16]];
        counts.resize(66, vec![1u16]);
        let vz = Versification::from_counts(&counts);
        let mut books = vec![r#"{"chapters":[{"chapter":1,"verses":[{"verse":1,"text":"a"},{"verse":2,"text":"b"},{"verse":3,"text":"c"}]}]}"#.to_string()];
        books.resize(66, r#"{"chapters":[{"chapter":1,"verses":[{"verse":1,"text":"x"}]}]}"#.to_string());
        let json = format!(r#"{{"books":[{}]}}"#, books.join(","));
        let s = lines(&json, &vz, "T").unwrap();
        assert!(s.starts_with("a\nb c\nx\n"));
        assert_eq!(s.lines().count(), 67);
    }
}
