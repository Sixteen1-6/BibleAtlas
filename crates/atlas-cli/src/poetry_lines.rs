//! The BSB's poetry set out as lines in the reader, from its USFM edition
//! (`bsb-usfm`): `\q1` starts a line, `\q2` a line set one step in, `\qr` a
//! refrain set to the right, `\b` a gap between stanzas, and `\d` a psalm's
//! title, which the reader puts on a line of its own.
//!
//! A verse is laid out only where its USFM words are the same words as its
//! BSB.json text (ignoring case and punctuation), as `poetry.rs` does for the
//! figures' checks; any other verse stays one paragraph. Each verse's lines
//! are written to its book's text file as (offset, kind) pairs, the offset
//! counted in UTF-16 units of the BSB.json text, as the browser counts.

use crate::poetry::{clean, fold, tokens};
use crate::sources::Inputs;
use atlas_core::{Versification, BOOKS};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::fs;

/// A line's kind, as the reader draws it.
pub const LINE: u8 = 1;
pub const INDENT: u8 = 2;
pub const REFRAIN: u8 = 3;
/// Prose inside a poetry verse ("He said:"), or a psalm's title.
pub const PROSE: u8 = 4;
pub const TITLE: u8 = 5;
/// Added to a kind when a stanza gap comes before the line.
pub const GAP: u8 = 8;

/// One piece of a verse: its line's number, kind and words.
struct Piece {
    id: u32,
    kind: u8,
    text: String,
}

/// A book's poetry verses: (chapter, verse) to each line's (start, kind).
type Book = BTreeMap<(u16, u16), Vec<(usize, u8)>>;

/// Each book's poetry verses.
pub struct Lines {
    books: Vec<Book>,
    pub placed: usize,
    pub poetry: usize,
}

impl Lines {
    pub fn read(inputs: &Inputs, vz: &Versification, text: &[String]) -> Result<Self, String> {
        let mut books = Vec::new();
        let (mut placed_n, mut poetry_n) = (0, 0);
        for (b, book) in BOOKS.iter().enumerate() {
            let path = inputs.path(crate::poetry::SOURCE, book.osis);
            let usfm = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
            let mut out = BTreeMap::new();
            for ((ch, vv), pieces) in parse(&usfm) {
                if !pieces.iter().any(|p| matches!(p.kind & 7, LINE | INDENT | REFRAIN)) {
                    continue;
                }
                poetry_n += 1;
                let Some(v) = vz.index(b as u8, ch, vv) else { continue };
                if let Some(l) = place(&pieces, &text[v as usize]) {
                    placed_n += 1;
                    out.insert((ch, vv), l);
                }
            }
            books.push(out);
        }
        Ok(Self { books, placed: placed_n, poetry: poetry_n })
    }

    /// A book's lines for its text file: {"<chapter>.<verse>": [[offset, kind], ...]},
    /// or None for a book with no poetry.
    pub fn book_json(&self, b: usize) -> Option<Value> {
        let m = &self.books[b];
        if m.is_empty() {
            return None;
        }
        let mut o = serde_json::Map::new();
        for ((c, v), l) in m {
            o.insert(format!("{c}.{v}"), json!(l.iter().map(|&(at, k)| json!([at, k])).collect::<Vec<_>>()));
        }
        Some(Value::Object(o))
    }
}

/// Where each piece starts in `text`, if its words are the verse's words. A
/// line starts after the space before its first word, so an opening quotation
/// mark stays with its line. A piece that runs on from the last verse's line
/// starts at 0 like any other.
fn place(pieces: &[Piece], text: &str) -> Option<Vec<(usize, u8)>> {
    let bsb = tokens(text);
    let mut words = Vec::new();
    let mut starts = Vec::new();
    for p in pieces {
        let ws: Vec<String> = tokens(&p.text).into_iter().map(|(s, e)| fold(&p.text[s..e])).collect();
        if ws.is_empty() {
            continue;
        }
        starts.push((words.len(), p.kind));
        words.extend(ws);
    }
    let folded: Vec<String> = bsb.iter().map(|&(s, e)| fold(&text[s..e])).collect();
    if folded != words {
        return None;
    }
    let mut out: Vec<(usize, u8)> = Vec::new();
    for (i, (w, kind)) in starts.into_iter().enumerate() {
        let at = if i == 0 {
            0
        } else {
            let s = bsb[w].0;
            text[..s].rfind(char::is_whitespace).map_or(s, |j| j + text[j..].chars().next().unwrap().len_utf8())
        };
        let at16 = text[..at].encode_utf16().count();
        match out.last_mut() {
            // Two pieces of one line that a footnote or marker split.
            Some(last) if last.0 == at16 => last.1 = kind,
            _ => out.push((at16, kind)),
        }
    }
    Some(out)
}

/// Each verse's pieces in order, by (chapter, verse). A new line marker
/// starts a new piece; a verse number inside a line starts a new piece of
/// the same line, which keeps its kind but is not a new line.
fn parse(usfm: &str) -> Vec<((u16, u16), Vec<Piece>)> {
    let mut out: Vec<((u16, u16), Vec<Piece>)> = Vec::new();
    let (mut ch, mut vv, mut id) = (0u16, 0u16, 0u32);
    let mut kind = PROSE;
    let mut gap = false;
    // The line a verse's first piece belongs to, and whether it opened there.
    let mut fresh = false;
    let mut title: Option<(u32, String)> = None;
    fn push(out: &mut Vec<((u16, u16), Vec<Piece>)>, key: (u16, u16), p: Piece) {
        match out.last_mut() {
            Some((k, ps)) if *k == key => ps.push(p),
            _ => out.push((key, vec![p])),
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
                gap = false;
                continue;
            }
            "d" => {
                id += 1;
                if vv > 0 {
                    push(&mut out, (ch, vv), Piece { id, kind: PROSE, text: clean(rest) });
                } else {
                    title = Some((id, clean(rest)));
                }
                continue;
            }
            "b" => {
                gap = true;
                continue;
            }
            "v" => format!("\\v {rest}"),
            "" => rest.to_string(),
            "q1" | "q2" | "qr" | "p" | "m" | "pmo" | "pi1" | "pc" | "li1" | "li2" | "nb" => {
                id += 1;
                fresh = true;
                kind = match marker {
                    "q1" => LINE,
                    "q2" => INDENT,
                    "qr" => REFRAIN,
                    _ => PROSE,
                };
                rest.to_string()
            }
            _ => {
                // A heading or another marker that is not verse text.
                id += 1;
                kind = PROSE;
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
                        push(&mut out, (ch, 1), Piece { id: tid, kind: TITLE, text: tt });
                    }
                }
            }
            if vv == 0 {
                continue;
            }
            let t = clean(&t);
            if t.trim().is_empty() {
                continue;
            }
            // Only the piece that opens a line carries the gap before it.
            let k = if fresh && gap { kind | GAP } else { kind };
            if fresh {
                gap = false;
            }
            fresh = false;
            push(&mut out, (ch, vv), Piece { id, kind: k, text: t });
        }
    }
    // A piece that continues the line before it (a verse number inside a
    // line) is not a new line, unless it is the verse's first piece.
    for (_, ps) in &mut out {
        let mut keep: Vec<Piece> = Vec::new();
        for p in ps.drain(..) {
            match keep.last_mut() {
                Some(last) if last.id == p.id => {
                    last.text.push(' ');
                    last.text.push_str(&p.text);
                }
                _ => keep.push(p),
            }
        }
        *ps = keep;
    }
    out
}

/// Checks on the built text files: a few verses whose lines are known, and
/// every line inside its verse's text, in order.
pub fn verify(d: &crate::loaded::Loaded) -> Result<Vec<(bool, String)>, String> {
    let book = |osis: &str| -> Result<Value, String> {
        let path = d.dir.join(format!("text/{osis}.json"));
        let s = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
        serde_json::from_str(&s).map_err(|e| format!("{}: {e}", path.display()))
    };
    let kinds = |b: &Value, k: &str| -> Vec<u64> {
        b["lines"][k].as_array().map(|l| l.iter().map(|x| x[1].as_u64().unwrap_or(0) & 7).collect()).unwrap_or_default()
    };
    let (ps, prov, gen) = (book("Ps")?, book("Prov")?, book("Gen")?);
    let mut sound = true;
    let mut verses = 0;
    for osis in ["Ps", "Prov", "Isa", "Job"] {
        let b = book(osis)?;
        let Some(m) = b["lines"].as_object() else {
            sound = false;
            continue;
        };
        for (k, l) in m {
            verses += 1;
            let (c, v) = k.split_once('.').unwrap_or(("0", "0"));
            let (c, v): (usize, usize) = (c.parse().unwrap_or(0), v.parse().unwrap_or(0));
            let len = b["chapters"][c.wrapping_sub(1)][v.wrapping_sub(1)][0].as_str().map_or(0, |t| t.encode_utf16().count());
            let at: Vec<u64> = l.as_array().map(|l| l.iter().map(|x| x[0].as_u64().unwrap_or(u64::MAX)).collect()).unwrap_or_default();
            sound &= len > 0 && at.first() == Some(&0) && at.windows(2).all(|w| w[0] < w[1]) && at.iter().all(|&a| (a as usize) < len);
        }
    }
    let ps136 = (1..=26).all(|v| kinds(&ps, &format!("136.{v}")).contains(&u64::from(REFRAIN)));
    Ok(vec![
        (sound && verses > 4000, format!("poetry lines in Psalms, Proverbs, Isaiah and Job ({verses} verses) start at 0 and fall in order inside their verse's text")),
        (kinds(&ps, "1.1") == [1, 2, 1, 2], "Psalm 1:1 is set out in four lines, the second and fourth one step in".to_string()),
        (kinds(&ps, "23.1") == [5, 1, 2], "Psalm 23:1 has its title on a line of its own, then two lines".to_string()),
        (ps136, "every verse of Psalm 136 ends with its refrain line".to_string()),
        (kinds(&prov, "10.1") == [4, 1, 2], "Proverbs 10:1 has its heading, then two lines".to_string()),
        (gen["lines"].get("1.1").is_none(), "Genesis 1:1, which is prose, has no lines".to_string()),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    const PS: &str = "\\c 3\n\\d A Psalm of David, when he fled.\n\\q1\n\\v 1 O LORD, how my foes\\f + \\fr 3:1 \\ft Or \\fq enemies\\f* increase!\n\\q2 How many rise up against me!\n\\q1\n\\v 2 Many say of me,\n\\q2 “God will not deliver him.”\n\\qr Selah\n\\b\n\\p\n\\v 3 Then he said, \\wj “Come.”\\wj*\n\\q1 But You, O LORD,\n\\q2 are a shield around me.\n";

    fn lines(v: u16, text: &str) -> Option<Vec<(usize, u8)>> {
        let p = parse(PS);
        let (_, ps) = p.iter().find(|(k, _)| k.1 == v).unwrap();
        place(ps, text)
    }

    #[test]
    fn sets_out_lines() {
        let t = "A Psalm of David, when he fled. O LORD, how my foes increase! How many rise up against me!";
        assert_eq!(lines(1, t), Some(vec![(0, TITLE), (32, LINE), (62, INDENT)]));
        let t = "Many say of me, “God will not deliver him.” Selah";
        // The opening quotation mark stays with its line.
        assert_eq!(lines(2, t), Some(vec![(0, LINE), (16, INDENT), (44, REFRAIN)]));
        let t = "Then he said, “Come.” But You, O LORD, are a shield around me.";
        let l = lines(3, t).unwrap();
        assert_eq!(l[0], (0, PROSE | GAP));
        // Offsets count UTF-16 units; every character here is one unit.
        let part: String = t.chars().skip(l[1].0).take(l[2].0 - l[1].0).collect();
        assert_eq!(part, "But You, O LORD, ");
        assert_eq!(l[2].1, INDENT);
        // Other wording is left as one paragraph.
        assert_eq!(lines(2, "Many say of me, God will not save him. Selah"), None);
    }

    #[test]
    fn counts_utf16() {
        let p = vec![Piece { id: 1, kind: LINE, text: "“Ô—a”".into() }, Piece { id: 2, kind: INDENT, text: "b".into() }];
        assert_eq!(place(&p, "“Ô—a” b"), Some(vec![(0, LINE), (6, INDENT)]));
    }
}
