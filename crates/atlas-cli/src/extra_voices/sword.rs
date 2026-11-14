//! A reader for CrossWire SWORD commentary modules (zCom and zCom4), as
//! mirrored unchanged on this repository's `mirror/sword-<Module>` branches.
//!
//! A module keeps each testament in three files: a block index (`*.bzs`: for
//! each block its offset and size in the data file and its size unpacked, as
//! little-endian u32s), a verse index (`*.bzv`: for each slot its block, its
//! offset in the unpacked block and its size; 10 bytes a slot for zCom, with a
//! u16 size, and 12 for zCom4, with a u32 size) and the data (`*.bzz`: the
//! blocks, each zlib-compressed). The letter before "z" is the block type
//! ('b' book, 'c' chapter, 'v' verse); it changes nothing here.
//!
//! The slots follow the KJV versification in SWORD's order: a module heading,
//! a testament heading, then for each book a book heading and for each chapter
//! a chapter heading followed by its verses. The app's versification has the
//! KJV's verse counts, so the slots are built from it, and the build fails if
//! the totals (24,115 and 8,246) or the index sizes do not match.
//!
//! Consecutive verse slots that point to the same text are one entry, over
//! those verses ("linked" verses); such an entry never crosses a chapter.

use crate::sources::Inputs;
use atlas_core::Versification;
use std::collections::BTreeMap;

/// The slots of each testament under the KJV versification.
const OT_SLOTS: usize = 24_115;
const NT_SLOTS: usize = 8_246;
/// Matthew, the first book of the New Testament.
const MATTHEW: u8 = 39;

/// A module's conf, with SWORD's defaults where a field is left out.
pub(super) struct Conf {
    pub(super) source_type: String,
    pub(super) license: String,
    pub(super) version: String,
    pub(super) date: String,
    entry: usize,
}

/// Where a slot's text belongs.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Slot {
    /// The module's or a testament's heading.
    Top,
    Book(u8),
    Chapter(u8, u16),
    Verse(u8, u16, u16),
}

/// One text of the module: a heading's, or a verse entry's over
/// `slot`'s verse to `to` (the same verse unless linked).
pub(super) struct Entry {
    pub(super) slot: Slot,
    pub(super) to: u16,
    pub(super) text: String,
}

/// The conf's fields, read with `\r` trimmed; a field given twice keeps its
/// first value.
fn fields(text: &str) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for line in text.lines().map(|l| l.trim_end_matches('\r').trim()) {
        if line.starts_with('#') || line.starts_with('[') {
            continue;
        }
        if let Some((k, v)) = line.split_once('=') {
            out.entry(k.trim().to_string()).or_insert_with(|| v.trim().to_string());
        }
    }
    out
}

pub(super) fn conf(text: &str) -> Result<Conf, String> {
    let f = fields(text);
    let get = |k: &str, default: &str| f.get(k).cloned().unwrap_or_else(|| default.to_string());
    let entry = match get("ModDrv", "").to_ascii_lowercase().as_str() {
        "zcom" => 10,
        "zcom4" => 12,
        other => return Err(format!("ModDrv {other} is not zCom or zCom4")),
    };
    for (k, default, want) in [("CompressType", "ZIP", "ZIP"), ("Encoding", "UTF-8", "UTF-8"), ("Versification", "KJV", "KJV")] {
        let v = get(k, default);
        if !v.eq_ignore_ascii_case(want) {
            return Err(format!("{k}={v} is not supported (only {want})"));
        }
    }
    let source_type = get("SourceType", "Plaintext");
    if !matches!(source_type.as_str(), "OSIS" | "ThML") {
        return Err(format!("SourceType={source_type} is not supported (only OSIS and ThML)"));
    }
    Ok(Conf {
        source_type,
        license: get("DistributionLicense", ""),
        version: get("Version", ""),
        date: get("SwordVersionDate", ""),
        entry,
    })
}

/// The slots of one testament, in SWORD's order.
fn slots(vz: &Versification, books: std::ops::Range<u8>) -> Vec<Slot> {
    let mut out = vec![Slot::Top, Slot::Top];
    for b in books {
        out.push(Slot::Book(b));
        for c in 1..=vz.chapters_in(b) {
            out.push(Slot::Chapter(b, c));
            for v in 1..=vz.verses_in(b, c).unwrap_or(0) {
                out.push(Slot::Verse(b, c, v));
            }
        }
    }
    out
}

fn u32_at(b: &[u8], i: usize) -> u32 {
    u32::from_le_bytes([b[i], b[i + 1], b[i + 2], b[i + 3]])
}

/// One testament's entries, from its three files.
fn testament(conf: &Conf, slots: &[Slot], index: &[u8], verses: &[u8], data: &[u8], name: &str) -> Result<Vec<Entry>, String> {
    if !index.len().is_multiple_of(12) {
        return Err(format!("{name}: the block index is {} bytes, not a multiple of 12", index.len()));
    }
    if verses.len() != slots.len() * conf.entry {
        return Err(format!(
            "{name}: the verse index is {} bytes; {} slots of {} bytes are {}",
            verses.len(),
            slots.len(),
            conf.entry,
            slots.len() * conf.entry
        ));
    }
    let mut blocks: Vec<Option<Vec<u8>>> = vec![None; index.len() / 12];
    let mut out: Vec<Entry> = Vec::new();
    let mut prev: Option<(u32, u32, u32)> = None;
    for (k, &slot) in slots.iter().enumerate() {
        let at = k * conf.entry;
        let block = u32_at(verses, at);
        let offset = u32_at(verses, at + 4);
        let size = if conf.entry == 10 { u32::from(u16::from_le_bytes([verses[at + 8], verses[at + 9]])) } else { u32_at(verses, at + 8) };
        if size == 0 {
            prev = None;
            continue;
        }
        let key = (block, offset, size);
        if let (Some(p), Slot::Verse(b, c, v), Some(last)) = (prev, slot, out.last_mut()) {
            if p == key {
                match last.slot {
                    Slot::Verse(lb, lc, _) if (lb, lc) == (b, c) && last.to + 1 == v => {
                        last.to = v;
                        continue;
                    }
                    _ => return Err(format!("{name}: a linked entry crosses into {slot:?}")),
                }
            }
        }
        prev = Some(key);
        let n = block as usize;
        if n >= blocks.len() {
            return Err(format!("{name}: slot {k} names block {n} of {}", blocks.len()));
        }
        if blocks[n].is_none() {
            let (o, c, u) = (u32_at(index, n * 12) as usize, u32_at(index, n * 12 + 4) as usize, u32_at(index, n * 12 + 8) as usize);
            let packed = data.get(o..o + c).ok_or(format!("{name}: block {n} runs past the data file"))?;
            let unpacked = miniz_oxide::inflate::decompress_to_vec_zlib(packed).map_err(|e| format!("{name}: block {n}: {e:?}"))?;
            if unpacked.len() != u {
                return Err(format!("{name}: block {n} unpacks to {} bytes, not {u}", unpacked.len()));
            }
            blocks[n] = Some(unpacked);
        }
        let bytes = blocks[n].as_ref().expect("unpacked above");
        let raw = bytes
            .get(offset as usize..(offset + size) as usize)
            .ok_or(format!("{name}: slot {k} runs past its block"))?;
        let text = String::from_utf8(raw.to_vec()).map_err(|e| format!("{name}: slot {k}: {e}"))?;
        let to = if let Slot::Verse(_, _, v) = slot { v } else { 0 };
        out.push(Entry { slot, to, text });
    }
    Ok(out)
}

/// The file a key names, as bytes; None where the source lists no such file.
fn file(inputs: &Inputs, source: &str, key: &str) -> Result<Option<Vec<u8>>, String> {
    let listed = inputs.lock.sources.iter().any(|l| l.id == source && l.files.contains_key(key));
    if !listed {
        return Ok(None);
    }
    let p = inputs.path(source, key);
    std::fs::read(&p).map(Some).map_err(|e| format!("reading {}: {e}", p.display()))
}

/// The module a source pins: its conf and every entry of both testaments.
/// Its files are keyed `conf` and `ot-` or `nt-` plus the file's extension
/// (`ot-bzs`, `nt-czv`); a testament the source lists no files for, or whose
/// data file is empty, has no entries.
pub(super) fn read(inputs: &Inputs, source: &str, vz: &Versification) -> Result<(Conf, Vec<Entry>), String> {
    let text = file(inputs, source, "conf")?.ok_or(format!("{source}: no conf"))?;
    let conf = conf(&String::from_utf8(text).map_err(|e| format!("{source}: the conf: {e}"))?).map_err(|e| format!("{source}: {e}"))?;
    let mut out = Vec::new();
    for (t, books, total) in [("ot", 0..MATTHEW, OT_SLOTS), ("nt", MATTHEW..66, NT_SLOTS)] {
        let s = slots(vz, books);
        if s.len() != total {
            return Err(format!("{source}: the versification gives {} slots for the {t}, not {total}", s.len()));
        }
        let mut found = Vec::new();
        for kind in ["s", "v", "z"] {
            let mut got = None;
            for letter in ["b", "c", "v"] {
                if let Some(bytes) = file(inputs, source, &format!("{t}-{letter}z{kind}"))? {
                    got = Some(bytes);
                }
            }
            found.push(got);
        }
        let [Some(index), Some(verses), Some(data)] = <[Option<Vec<u8>>; 3]>::try_from(found).map_err(|_| "three files")? else {
            continue;
        };
        if data.is_empty() {
            continue;
        }
        out.extend(testament(&conf, &s, &index, &verses, &data, &format!("{source} {t}"))?);
    }
    Ok((conf, out))
}

/// One paragraph of an entry's text: a title (with its OSIS type) or words.
#[derive(Debug, PartialEq)]
pub(super) struct Para {
    pub(super) title: Option<String>,
    /// The words, with each verse reference as `{{ref:<osisRef>|<label>}}`.
    pub(super) text: String,
}

fn attr<'a>(tag: &'a str, name: &str) -> Option<&'a str> {
    let key = format!(" {name}=\"");
    let i = tag.find(&key)? + key.len();
    let e = tag[i..].find('"')?;
    Some(&tag[i..i + e])
}

fn entities(s: &str) -> String {
    s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&amp;", "&")
}

/// An entry's OSIS as paragraphs: `<title>` its own paragraph, a paragraph
/// break at each `x-p`, `introduction` or `book` division, `<p>` and `<lb/>`,
/// each `<reference osisRef>` a mark, and every other tag dropped with its
/// words kept (counted by name in `dropped`).
pub(super) fn osis(text: &str, dropped: &mut BTreeMap<String, usize>) -> Vec<Para> {
    let mut out: Vec<Para> = Vec::new();
    let mut cur = String::new();
    let mut title: Option<String> = None;
    fn flush(out: &mut Vec<Para>, cur: &mut String, title: Option<String>) {
        let t = cur.split_whitespace().collect::<Vec<_>>().join(" ");
        cur.clear();
        if !t.is_empty() {
            out.push(Para { title, text: t });
        }
    }
    let mut rest = text;
    while let Some(i) = rest.find('<') {
        cur.push_str(&entities(&rest[..i]));
        let Some(e) = rest[i..].find('>') else {
            rest = &rest[i..];
            break;
        };
        let tag = &rest[i..i + e + 1];
        rest = &rest[i + e + 1..];
        let name: String = tag.trim_start_matches(['<', '/']).chars().take_while(|c| c.is_ascii_alphanumeric()).collect();
        let closing = tag.starts_with("</");
        match name.as_str() {
            "title" if !closing => {
                flush(&mut out, &mut cur, title.take());
                title = Some(attr(tag, "type").unwrap_or("").to_string());
            }
            "title" => flush(&mut out, &mut cur, title.take()),
            "div" => {
                if matches!(attr(tag, "type"), Some("x-p" | "introduction" | "book" | "paragraph")) {
                    flush(&mut out, &mut cur, title.take());
                }
            }
            "p" | "lb" => flush(&mut out, &mut cur, title.take()),
            "reference" if !closing => match attr(tag, "osisRef") {
                Some(r) => {
                    cur.push_str("{{ref:");
                    cur.push_str(r);
                    cur.push('|');
                }
                None => *dropped.entry("reference without osisRef".into()).or_default() += 1,
            },
            "reference" => {
                // Close the mark only where one was opened.
                if let Some(o) = cur.rfind("{{ref:") {
                    if !cur[o..].contains("}}") {
                        cur.push_str("}}");
                    }
                }
            }
            "hi" | "chapter" | "milestone" | "verse" => {}
            _ => *dropped.entry(name).or_default() += 1,
        }
    }
    cur.push_str(&entities(rest));
    flush(&mut out, &mut cur, title);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use miniz_oxide::deflate::compress_to_vec_zlib;

    #[test]
    fn reads_a_conf_with_defaults() {
        let c = conf("[X]\r\nModDrv=zCom4\r\nSourceType=OSIS\r\nDistributionLicense=Public Domain\r\n").unwrap();
        assert_eq!((c.entry, c.license.as_str()), (12, "Public Domain"));
        // No Versification line: SWORD's default, the KJV.
        assert_eq!(conf("ModDrv=zCom\nSourceType=ThML\n").unwrap().entry, 10);
        assert!(conf("ModDrv=zCom\nSourceType=OSIS\nVersification=NRSV\n").is_err());
        assert!(conf("ModDrv=RawCom\nSourceType=OSIS\n").is_err());
        assert!(conf("ModDrv=zCom\nSourceType=OSIS\nCompressType=LZSS\n").is_err());
    }

    /// A toy testament: two books of two chapters of three verses.
    fn toy() -> Vec<Slot> {
        let mut s = vec![Slot::Top, Slot::Top];
        for b in 0..2u8 {
            s.push(Slot::Book(b));
            for c in 1..=2u16 {
                s.push(Slot::Chapter(b, c));
                for v in 1..=3u16 {
                    s.push(Slot::Verse(b, c, v));
                }
            }
        }
        s
    }

    fn module(entry: usize, texts: &[(usize, &str)], link: &[(usize, usize)]) -> (Vec<u8>, Vec<u8>, Vec<u8>) {
        // Two blocks: the first half of the slots in one, the rest in the other.
        let slots = toy();
        let half = slots.len() / 2;
        let mut blocks: Vec<Vec<u8>> = vec![Vec::new(), Vec::new()];
        let mut at: Vec<(u32, u32, u32)> = vec![(0, 0, 0); slots.len()];
        for &(k, t) in texts {
            let n = usize::from(k >= half);
            at[k] = (n as u32, blocks[n].len() as u32, t.len() as u32);
            blocks[n].extend_from_slice(t.as_bytes());
        }
        for &(k, to) in link {
            at[k] = at[to];
        }
        let (mut index, mut data) = (Vec::new(), Vec::new());
        for b in &blocks {
            let z = compress_to_vec_zlib(b, 6);
            for x in [data.len() as u32, z.len() as u32, b.len() as u32] {
                index.extend_from_slice(&x.to_le_bytes());
            }
            data.extend(z);
        }
        let mut verses = Vec::new();
        for (b, o, s) in at {
            verses.extend_from_slice(&b.to_le_bytes());
            verses.extend_from_slice(&o.to_le_bytes());
            if entry == 10 {
                verses.extend_from_slice(&(s as u16).to_le_bytes());
            } else {
                verses.extend_from_slice(&s.to_le_bytes());
            }
        }
        (index, verses, data)
    }

    #[test]
    fn reads_linked_empty_and_heading_slots() {
        let s = toy();
        // Slot 2 is book 0's heading, 3 its chapter 1, 4 to 6 verses 1 to 3;
        // 7 chapter 2, 8 to 10 its verses; 11 book 1's heading, 12 its chapter 1, 13 its verse 1.
        for entry in [10, 12] {
            let c = Conf { source_type: "OSIS".into(), license: String::new(), version: String::new(), date: String::new(), entry };
            let (i, v, d) = module(entry, &[(2, "book"), (4, "one"), (5, "two and three"), (13, "far")], &[(6, 5)]);
            let got = testament(&c, &s, &i, &v, &d, "toy").unwrap();
            let seen: Vec<(Slot, u16, &str)> = got.iter().map(|e| (e.slot, e.to, e.text.as_str())).collect();
            assert_eq!(
                seen,
                vec![
                    (Slot::Book(0), 0, "book"),
                    (Slot::Verse(0, 1, 1), 1, "one"),
                    (Slot::Verse(0, 1, 2), 3, "two and three"),
                    (Slot::Verse(1, 1, 1), 1, "far"),
                ]
            );
            // A verse index of the wrong size is refused.
            assert!(testament(&c, &s, &i, &v[..v.len() - 1], &d, "toy").is_err());
        }
        // A linked entry may not cross a chapter (verse 0:1:3 linked to 0:2:1).
        let c = Conf { source_type: "OSIS".into(), license: String::new(), version: String::new(), date: String::new(), entry: 12 };
        let (i, v, d) = module(12, &[(6, "end of chapter")], &[(8, 6)]);
        assert!(testament(&c, &s, &i, &v, &d, "toy").is_ok(), "a chapter heading slot between them breaks the link");
        let mut s2 = s.clone();
        s2.remove(7);
        s2.push(Slot::Top);
        let (i, v, d) = module(12, &[(6, "end of chapter")], &[(7, 6)]);
        assert!(testament(&c, &s2, &i, &v, &d, "toy").is_err());
    }

    #[test]
    fn turns_osis_into_paragraphs_and_marks() {
        let mut dropped = BTreeMap::new();
        let ps = osis(
            r#"<div type="x-milestone" subType="x-preverse" sID="pv3"/><title type="x-s3"><reference osisRef="Gen.1.3-Gen.1.5">Ge 1:3-5</reference>. The First Day.</title> <div sID="gen107" type="x-p"/><hi type="bold">3. God said--</hi>as in <reference osisRef="Ps.33.9">Ps 33:9</reference>, &amp;c.<div eID="gen107" type="x-p"/><foreign>logos</foreign>"#,
            &mut dropped,
        );
        assert_eq!(
            ps,
            vec![
                Para { title: Some("x-s3".into()), text: "{{ref:Gen.1.3-Gen.1.5|Ge 1:3-5}}. The First Day.".into() },
                Para { title: None, text: "3. God said--as in {{ref:Ps.33.9|Ps 33:9}}, &c.".into() },
                Para { title: None, text: "logos".into() },
            ]
        );
        assert_eq!(dropped.get("foreign"), Some(&2));
    }
}
