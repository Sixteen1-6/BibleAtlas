//! Life in Bible times: the customs behind a verse, in the words of James M.
//! Freeman's Hand-Book of Bible Manners and Customs (New York: Nelson and
//! Phillips, 1874), public domain. Freeman, a Methodist Episcopal minister,
//! wrote 891 short entries, each headed by the verse it explains and printed
//! in Bible order, on what the words meant to the people who first heard them.
//!
//! The text is Bible Truth Publishers' transcription, as kept in the
//! UniqueBible.app module "Freeman - Manners and Customs of the Bible" at
//! github.com/darrelwright/UniqueBible_Books (`freeman-customs` in
//! sources.json). The module is a zip holding one SQLite file with a table
//! `Reference(Chapter, Content)`, one row per entry, its words in a little
//! HTML. No crate reads either format, so this file has its own small readers
//! for both ([`unzip`], [`inflate`], [`sqlite_rows`]); the zip's CRC and size
//! are checked, and `atlas fetch` pins the file's hash.
//!
//! Each entry becomes:
//! - its number and Freeman's heading ("Camels' Furniture");
//! - where it goes: the verses Freeman heads it with (one, a range such as
//!   Job 19:23-24, or two such as Genesis 25:31 and 25:33);
//! - the King James words he prints under the heading, as he printed them;
//! - his paragraphs, with the verses he names as links.
//!
//! Where the transcription misread a heading verse from the page ("Judges
//! 3:81" for 3:31, "Luke 1:25" for 2:25), or gives it only as text, the entry
//! goes on the one verse whose King James text holds the words printed under
//! the heading ([`find_verse`]), and is left out when no one verse does. An
//! entry is otherwise placed only where its heading verse holds those words
//! ([`heading_matches`]). The build prints each such entry. The cover, the
//! preface and the transcriber's closing note ("Courtesy of ...") are left
//! out, as they are not Freeman's notes on a verse.
//!
//! Output, under `web/public/data/`:
//! - `extras/customs.json`: `{format, entries}`, each `[no, title, at]`, `at`
//!   a list of `[from, to]` verse ranges. Small: it loads with the reader's
//!   first move, and the line under a verse is a lookup in it.
//! - `extras/customs/<Book>.json`: `{format, entries}`, the entries headed in
//!   that book, each `{no, title, at, quote, text}`: `quote` the King James
//!   words as printed, `text` a list of paragraphs, each a list of runs, a run
//!   being a string or a `[from, to, words]` verse link. Plain text only: no
//!   HTML reaches the browser. Loaded when a panel opens.

use crate::loaded::Loaded;
use crate::sources::Inputs;
use atlas_core::canon::BOOKS;
use atlas_core::Versification;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashSet};
use std::fs;

const SOURCE: &str = "freeman-customs";
const OUT: &str = "extras/customs.json";
const DIR: &str = "extras/customs";
/// Entries in the book. The build fails if the module holds another number.
const ENTRIES: usize = 891;
/// At least this share of the words Freeman prints under a heading must be in
/// the King James text of the heading's verses.
const MATCH: f64 = 0.6;
/// A quotation is found elsewhere only when this share of its words is in one place,
const FOUND: f64 = 0.9;
/// and no other place comes within this share of it.
const MARGIN: f64 = 0.15;
/// A heading range longer than this many verses is shown on its first verse only.
const LONGEST: u32 = 12;

// ---------------------------------------------------------------------------
// Zip and DEFLATE (RFC 1951)

/// A little-endian number of `n` bytes at `at`.
fn le(b: &[u8], at: usize, n: usize) -> Result<u64, String> {
    let s = b.get(at..at + n).ok_or("zip: cut short")?;
    Ok(s.iter().rev().fold(0u64, |acc, &x| (acc << 8) | u64::from(x)))
}

fn crc32(data: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    for &byte in data {
        crc ^= u32::from(byte);
        for _ in 0..8 {
            crc = if crc & 1 == 1 { (crc >> 1) ^ 0xEDB8_8320 } else { crc >> 1 };
        }
    }
    !crc
}

/// The one file in a zip whose name ends with `suffix`, from its local header.
pub(crate) fn unzip(zip: &[u8], suffix: &str) -> Result<Vec<u8>, String> {
    let mut at = 0usize;
    while le(zip, at, 4)? == 0x0403_4b50 {
        let flags = le(zip, at + 6, 2)?;
        let method = le(zip, at + 8, 2)?;
        let crc = le(zip, at + 14, 4)? as u32;
        let csize = le(zip, at + 18, 4)? as usize;
        let usize_ = le(zip, at + 22, 4)? as usize;
        let nlen = le(zip, at + 26, 2)? as usize;
        let xlen = le(zip, at + 28, 2)? as usize;
        let name = String::from_utf8_lossy(zip.get(at + 30..at + 30 + nlen).ok_or("zip: cut short")?).into_owned();
        let start = at + 30 + nlen + xlen;
        if flags & 8 != 0 {
            return Err("zip: sizes after the data are not supported".into());
        }
        let data = zip.get(start..start + csize).ok_or("zip: cut short")?;
        if name.ends_with(suffix) {
            let out = match method {
                0 => data.to_vec(),
                8 => inflate(data)?,
                m => return Err(format!("zip: compression method {m} is not supported")),
            };
            if out.len() != usize_ || crc32(&out) != crc {
                return Err(format!("zip: {name} does not match its size and CRC"));
            }
            return Ok(out);
        }
        at = start + csize;
    }
    Err(format!("zip: no file ending in {suffix}"))
}

struct Bits<'a> {
    b: &'a [u8],
    pos: usize,
    buf: u64,
    n: u32,
}

impl Bits<'_> {
    fn take(&mut self, k: u32) -> Result<u32, String> {
        while self.n < k {
            let byte = *self.b.get(self.pos).ok_or("inflate: cut short")?;
            self.buf |= u64::from(byte) << self.n;
            self.pos += 1;
            self.n += 8;
        }
        let v = (self.buf & ((1u64 << k) - 1)) as u32;
        self.buf >>= k;
        self.n -= k;
        Ok(v)
    }
}

/// A canonical Huffman code: how many codes of each length, and the symbols in code order.
struct Huff {
    count: [u16; 16],
    symbol: Vec<u16>,
}

impl Huff {
    fn new(lengths: &[u8]) -> Self {
        let mut count = [0u16; 16];
        for &l in lengths {
            count[l as usize] += 1;
        }
        count[0] = 0;
        let mut offs = [0u16; 16];
        for len in 1..15 {
            offs[len + 1] = offs[len] + count[len];
        }
        let mut symbol = vec![0u16; lengths.len()];
        for (s, &l) in lengths.iter().enumerate() {
            if l != 0 {
                symbol[offs[l as usize] as usize] = s as u16;
                offs[l as usize] += 1;
            }
        }
        Huff { count, symbol }
    }

    fn decode(&self, bits: &mut Bits) -> Result<u16, String> {
        let (mut code, mut first, mut index) = (0i32, 0i32, 0i32);
        for len in 1..16 {
            code |= bits.take(1)? as i32;
            let count = i32::from(self.count[len]);
            if code - count < first {
                return self.symbol.get((index + code - first) as usize).copied().ok_or_else(|| "inflate: bad code".into());
            }
            index += count;
            first = (first + count) << 1;
            code <<= 1;
        }
        Err("inflate: bad code".into())
    }
}

const LBASE: [u16; 29] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT: [u8; 29] = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE: [u16; 30] = [
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DEXT: [u8; 30] = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

/// Raw DEFLATE data, decompressed.
pub(crate) fn inflate(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut bits = Bits { b: data, pos: 0, buf: 0, n: 0 };
    let mut out: Vec<u8> = Vec::with_capacity(data.len() * 4);
    loop {
        let last = bits.take(1)?;
        match bits.take(2)? {
            0 => {
                bits.buf = 0;
                bits.n = 0;
                let len = le(data, bits.pos, 2)? as usize;
                let nlen = le(data, bits.pos + 2, 2)? as usize;
                if len != !nlen & 0xFFFF {
                    return Err("inflate: bad stored block".into());
                }
                let s = data.get(bits.pos + 4..bits.pos + 4 + len).ok_or("inflate: cut short")?;
                out.extend_from_slice(s);
                bits.pos += 4 + len;
            }
            1 => {
                let mut l = [0u8; 288];
                for (i, x) in l.iter_mut().enumerate() {
                    *x = match i {
                        0..=143 => 8,
                        144..=255 => 9,
                        256..=279 => 7,
                        _ => 8,
                    };
                }
                codes(&mut bits, &mut out, &Huff::new(&l), &Huff::new(&[5u8; 30]))?;
            }
            2 => {
                let nlen = bits.take(5)? as usize + 257;
                let ndist = bits.take(5)? as usize + 1;
                let ncode = bits.take(4)? as usize + 4;
                const ORDER: [usize; 19] = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
                let mut cl = [0u8; 19];
                for &o in ORDER.iter().take(ncode) {
                    cl[o] = bits.take(3)? as u8;
                }
                let lencode = Huff::new(&cl);
                let mut lengths = vec![0u8; nlen + ndist];
                let mut i = 0;
                while i < nlen + ndist {
                    let sym = lencode.decode(&mut bits)?;
                    let (val, rep) = match sym {
                        0..=15 => (sym as u8, 1),
                        16 => (*lengths.get(i.wrapping_sub(1)).ok_or("inflate: repeat with nothing before")?, 3 + bits.take(2)? as usize),
                        17 => (0, 3 + bits.take(3)? as usize),
                        _ => (0, 11 + bits.take(7)? as usize),
                    };
                    if i + rep > nlen + ndist {
                        return Err("inflate: too many lengths".into());
                    }
                    lengths[i..i + rep].fill(val);
                    i += rep;
                }
                codes(&mut bits, &mut out, &Huff::new(&lengths[..nlen]), &Huff::new(&lengths[nlen..]))?;
            }
            _ => return Err("inflate: bad block type".into()),
        }
        if last == 1 {
            return Ok(out);
        }
    }
}

fn codes(bits: &mut Bits, out: &mut Vec<u8>, lit: &Huff, dist: &Huff) -> Result<(), String> {
    loop {
        let sym = lit.decode(bits)? as usize;
        if sym < 256 {
            out.push(sym as u8);
        } else if sym == 256 {
            return Ok(());
        } else {
            let s = sym - 257;
            if s >= 29 {
                return Err("inflate: bad length".into());
            }
            let len = LBASE[s] as usize + bits.take(u32::from(LEXT[s]))? as usize;
            let d = dist.decode(bits)? as usize;
            if d >= 30 {
                return Err("inflate: bad distance".into());
            }
            let back = DBASE[d] as usize + bits.take(u32::from(DEXT[d]))? as usize;
            if back > out.len() {
                return Err("inflate: distance too far back".into());
            }
            let start = out.len() - back;
            for k in 0..len {
                out.push(out[start + k]);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// SQLite (the file format at sqlite.org/fileformat.html, tables only)

/// A column's value: only what these files hold.
#[derive(Clone, Debug, PartialEq)]
pub(crate) enum Cell {
    Null,
    Int(i64),
    Text(String),
}

struct Db<'a> {
    b: &'a [u8],
    page: usize,
    usable: usize,
}

fn varint(b: &[u8], at: &mut usize) -> Result<u64, String> {
    let mut v = 0u64;
    for k in 0..9 {
        let x = *b.get(*at).ok_or("sqlite: cut short")?;
        *at += 1;
        if k == 8 {
            return Ok((v << 8) | u64::from(x));
        }
        v = (v << 7) | u64::from(x & 0x7F);
        if x & 0x80 == 0 {
            return Ok(v);
        }
    }
    Ok(v)
}

fn be(b: &[u8], at: usize, n: usize) -> Result<u64, String> {
    let s = b.get(at..at + n).ok_or("sqlite: cut short")?;
    Ok(s.iter().fold(0u64, |acc, &x| (acc << 8) | u64::from(x)))
}

impl<'a> Db<'a> {
    fn open(b: &'a [u8]) -> Result<Self, String> {
        if b.get(..16) != Some(b"SQLite format 3\0".as_slice()) {
            return Err("sqlite: not a database".into());
        }
        let page = match be(b, 16, 2)? {
            1 => 65536,
            p => p as usize,
        };
        let usable = page - b[20] as usize;
        if be(b, 56, 4)? != 1 {
            return Err("sqlite: text is not UTF-8".into());
        }
        Ok(Db { b, page, usable })
    }

    fn page(&self, n: u64) -> Result<&'a [u8], String> {
        let start = (n as usize).checked_sub(1).ok_or("sqlite: page 0")? * self.page;
        self.b.get(start..start + self.page).ok_or_else(|| format!("sqlite: no page {n}"))
    }

    /// Every row of the table b-tree at `root`, in rowid order: the record's bytes.
    fn rows(&self, root: u64, out: &mut Vec<Vec<u8>>, depth: u32) -> Result<(), String> {
        if depth > 20 {
            return Err("sqlite: b-tree too deep".into());
        }
        let p = self.page(root)?;
        let h = if root == 1 { 100 } else { 0 };
        let kind = p[h];
        let cells = be(p, h + 3, 2)? as usize;
        let (head, interior) = match kind {
            0x0D => (8, false),
            0x05 => (12, true),
            k => return Err(format!("sqlite: page {root} is not a table page ({k})")),
        };
        for c in 0..cells {
            let mut at = be(p, h + head + 2 * c, 2)? as usize;
            if interior {
                self.rows(be(p, at, 4)?, out, depth + 1)?;
                continue;
            }
            let size = varint(p, &mut at)? as usize;
            varint(p, &mut at)?; // rowid
            let x = self.usable - 35;
            let local = if size <= x {
                size
            } else {
                let m = (self.usable - 12) * 32 / 255 - 23;
                let k = m + (size - m) % (self.usable - 4);
                if k <= x { k } else { m }
            };
            let mut rec = p.get(at..at + local).ok_or("sqlite: cell cut short")?.to_vec();
            let mut next = if local < size { be(p, at + local, 4)? } else { 0 };
            while rec.len() < size {
                let o = self.page(next)?;
                let want = (size - rec.len()).min(self.usable - 4);
                rec.extend_from_slice(&o[4..4 + want]);
                next = be(o, 0, 4)?;
            }
            out.push(rec);
        }
        if interior {
            self.rows(be(p, h + 8, 4)?, out, depth + 1)?;
        }
        Ok(())
    }
}

fn record(rec: &[u8]) -> Result<Vec<Cell>, String> {
    let mut at = 0usize;
    let header = varint(rec, &mut at)? as usize;
    let mut types = Vec::new();
    while at < header {
        types.push(varint(rec, &mut at)?);
    }
    let mut body = header;
    let mut out = Vec::with_capacity(types.len());
    for t in types {
        let (cell, n) = match t {
            0 => (Cell::Null, 0),
            1..=6 => {
                let n = [0, 1, 2, 3, 4, 6, 8][t as usize];
                let raw = be(rec, body, n)?;
                let shift = 64 - 8 * n as u32;
                (Cell::Int(((raw << shift) as i64) >> shift), n)
            }
            8 => (Cell::Int(0), 0),
            9 => (Cell::Int(1), 0),
            t if t >= 13 && t % 2 == 1 => {
                let n = ((t - 13) / 2) as usize;
                let s = rec.get(body..body + n).ok_or("sqlite: text cut short")?;
                (Cell::Text(String::from_utf8(s.to_vec()).map_err(|_| "sqlite: text is not UTF-8")?), n)
            }
            t => return Err(format!("sqlite: column type {t} is not supported")),
        };
        out.push(cell);
        body += n;
    }
    Ok(out)
}

/// Every row of the named table, in rowid order.
pub(crate) fn sqlite_rows(db: &[u8], table: &str) -> Result<Vec<Vec<Cell>>, String> {
    let d = Db::open(db)?;
    let mut master = Vec::new();
    d.rows(1, &mut master, 0)?;
    let mut root = None;
    for rec in master {
        let r = record(&rec)?;
        if r.first() == Some(&Cell::Text("table".into())) && r.get(1) == Some(&Cell::Text(table.into())) {
            if let Some(Cell::Int(n)) = r.get(3) {
                root = Some(*n as u64);
            }
        }
    }
    let root = root.ok_or_else(|| format!("sqlite: no table {table}"))?;
    let mut rows = Vec::new();
    d.rows(root, &mut rows, 0)?;
    rows.iter().map(|r| record(r)).collect()
}

// ---------------------------------------------------------------------------
// The entries

/// One piece of a paragraph.
#[derive(Clone, Debug, PartialEq)]
enum Run {
    Text(String),
    Verse(u32, u32, String),
}

struct Entry {
    no: u32,
    title: String,
    at: Vec<(u32, u32)>,
    quote: String,
    text: Vec<Vec<Run>>,
}

/// What the build placed and dropped, for its report.
#[derive(Default)]
struct Report {
    placed: usize,
    /// Entries placed on the verse that holds their words, and those left out.
    found: Vec<String>,
    dropped: Vec<String>,
    links: usize,
    long: usize,
}

fn entity(name: &str) -> Option<char> {
    if let Some(hex) = name.strip_prefix("#x").or_else(|| name.strip_prefix("#X")) {
        return u32::from_str_radix(hex, 16).ok().and_then(char::from_u32);
    }
    if let Some(dec) = name.strip_prefix('#') {
        return dec.parse().ok().and_then(char::from_u32);
    }
    let c = match name {
        "amp" => '&',
        "lt" => '<',
        "gt" => '>',
        "quot" => '"',
        "apos" => '\'',
        "nbsp" => ' ',
        "rsquo" => '\u{2019}',
        "lsquo" => '\u{2018}',
        "rdquo" => '\u{201D}',
        "ldquo" => '\u{201C}',
        "mdash" => '\u{2014}',
        "ndash" => '\u{2013}',
        "hellip" => '\u{2026}',
        "sect" => '\u{A7}',
        "pound" => '\u{A3}',
        "uuml" => '\u{FC}',
        "ouml" => '\u{F6}',
        "auml" => '\u{E4}',
        "euml" => '\u{EB}',
        "uml" => '\u{A8}',
        "aelig" => '\u{E6}',
        "aacute" => '\u{E1}',
        "eacute" => '\u{E9}',
        "uacute" => '\u{FA}',
        "sigmaf" => '\u{3C2}',
        _ => {
            // Greek letters by name: alpha ... omega, capitals with a capital first letter.
            const GREEK: [&str; 24] = [
                "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa", "lambda", "mu", "nu", "xi", "omicron",
                "pi", "rho", "sigma", "tau", "upsilon", "phi", "chi", "psi", "omega",
            ];
            let lower = name.to_lowercase();
            let k = GREEK.iter().position(|g| *g == lower)? as u32;
            // Final sigma (U+03C2) sits between rho and sigma in the block.
            let off = if k >= 17 { k + 1 } else { k };
            let small = char::from_u32(0x3B1 + off)?;
            return Some(if name.starts_with(|c: char| c.is_uppercase()) { char::from_u32(0x391 + off)? } else { small });
        }
    };
    Some(c)
}

/// Text with entities decoded and spaces squeezed (tags already gone).
fn decode(s: &str) -> Result<String, String> {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(i) = rest.find('&') {
        out.push_str(&rest[..i]);
        let tail = &rest[i + 1..];
        match tail.find(';').filter(|&j| j <= 10) {
            Some(j) => {
                out.push(entity(&tail[..j]).ok_or_else(|| format!("unknown entity &{};", &tail[..j]))?);
                rest = &tail[j + 1..];
            }
            None => {
                out.push('&');
                rest = tail;
            }
        }
    }
    out.push_str(rest);
    let mut squeezed = String::with_capacity(out.len());
    let mut space = false;
    for c in out.chars() {
        if c.is_whitespace() {
            space = true;
        } else {
            if space && !squeezed.is_empty() {
                squeezed.push(' ');
            }
            space = false;
            squeezed.push(c);
        }
    }
    if space && !squeezed.is_empty() {
        squeezed.push(' ');
    }
    Ok(squeezed)
}

/// `bcv(b, c, v)` from a ref tag's attributes.
fn bcv(attrs: &str) -> Option<(u8, u16, u16)> {
    let inner = attrs.split("bcv(").nth(1)?.split(')').next()?;
    let mut it = inner.split(',').map(|x| x.trim().parse::<u32>().ok());
    let (b, c, v) = (it.next()??, it.next()??, it.next()??);
    if !(1..=66).contains(&b) {
        return None;
    }
    Some(((b - 1) as u8, c as u16, v as u16))
}

/// The verse range a ref names: its start from `bcv`, its end from the label
/// ("Jdg 18:17-18", "Gen 1:31-2:3") when the label agrees on the start.
fn ref_range(vz: &Versification, start: (u8, u16, u16), label: &str) -> Option<(u32, u32)> {
    let (b, c, v) = start;
    let from = vz.index(b, c, v)?;
    let span = label.rsplit(' ').next().unwrap_or("");
    let (head, tail) = span.split_once('-').unwrap_or((span, ""));
    let agrees = head.split_once(':').and_then(|(x, y)| Some((x.parse::<u16>().ok()?, y.parse::<u16>().ok()?))) == Some((c, v));
    if !agrees || tail.is_empty() {
        return Some((from, from));
    }
    let to = match tail.split_once(':') {
        Some((c2, v2)) => vz.index(b, c2.parse().ok()?, v2.parse().ok()?),
        None => vz.index(b, c, tail.parse().ok()?),
    };
    match to {
        Some(t) if t >= from => Some((from, t)),
        _ => Some((from, from)),
    }
}

/// A paragraph's runs: text, with `<ref>` tags as verse links and every other tag dropped.
fn runs(vz: &Versification, html: &str, report: &mut Report) -> Result<Vec<Run>, String> {
    let mut out: Vec<Run> = Vec::new();
    let mut text = String::new();
    let mut rest = html;
    let flush = |text: &mut String, out: &mut Vec<Run>| -> Result<(), String> {
        if !text.is_empty() {
            let t = decode(text)?;
            text.clear();
            if let Some(Run::Text(prev)) = out.last_mut() {
                prev.push_str(&t);
                let squeezed = decode(prev)?;
                *prev = squeezed;
            } else if !t.is_empty() {
                out.push(Run::Text(t));
            }
        }
        Ok(())
    };
    while let Some(i) = rest.find('<') {
        text.push_str(&rest[..i]);
        let close = rest[i..].find('>').ok_or("an unclosed tag")? + i;
        let tag = &rest[i + 1..close];
        rest = &rest[close + 1..];
        if tag.starts_with("ref ") {
            let end = rest.find("</ref>").ok_or("an unclosed ref")?;
            let label = decode(&strip_tags(&rest[..end]))?.trim().to_string();
            rest = &rest[end + 6..];
            match bcv(tag).and_then(|s| ref_range(vz, s, &label)) {
                Some((from, to)) => {
                    flush(&mut text, &mut out)?;
                    out.push(Run::Verse(from, to, label));
                    report.links += 1;
                }
                None => text.push_str(&label),
            }
        }
    }
    text.push_str(rest);
    flush(&mut text, &mut out)?;
    // Trim the paragraph's ends.
    if let Some(Run::Text(t)) = out.first_mut() {
        *t = t.trim_start().to_string();
    }
    if let Some(Run::Text(t)) = out.last_mut() {
        *t = t.trim_end().to_string();
    }
    out.retain(|r| !matches!(r, Run::Text(t) if t.is_empty()));
    Ok(out)
}

fn strip_tags(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut inside = false;
    for c in s.chars() {
        match c {
            '<' => inside = true,
            '>' => inside = false,
            _ if !inside => out.push(c),
            _ => {}
        }
    }
    out
}

/// Freeman's heading as a line can show it. The transcription keeps the
/// second number of a heading shared by two entries ("381 Letters" for
/// "380, 381. Letters"), stray end punctuation ("Cistern in the Court Yard:"),
/// straight quotation marks, and once a Hebrew vowel point ("The Asiarch").
fn clean_title(raw: &str) -> String {
    let t = raw.trim();
    let t = t.trim_start_matches(|c: char| c.is_ascii_digit());
    let t = if t.len() < raw.trim().len() { t.trim_start_matches([',', '.', ' ']) } else { t };
    let mut out = String::new();
    let mut open = true;
    for c in t.chars() {
        match c {
            '"' => {
                out.push(if open { '\u{201C}' } else { '\u{201D}' });
                open = !open;
            }
            '\u{201C}' => {
                out.push(c);
                open = false;
            }
            '\u{201D}' => {
                out.push(c);
                open = true;
            }
            '\u{0591}'..='\u{05C7}' => {}
            _ => out.push(c),
        }
    }
    let out = out.replace(".\u{201D}", "\u{201D}");
    out.trim_end_matches([';', ':', '.', ',', ' ']).to_string()
}

/// The `<p>` paragraphs of an entry, their inner HTML.
fn paragraphs(html: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut rest = html;
    while let Some(i) = rest.find("<p") {
        let Some(open) = rest[i..].find('>') else { break };
        let body = &rest[i + open + 1..];
        let end = body.find("</p>").unwrap_or(body.len());
        out.push(&body[..end]);
        rest = &body[(end + 4).min(body.len())..];
    }
    out
}

/// Lowercase words of letters only.
fn words(s: &str) -> Vec<String> {
    s.split(|c: char| !c.is_alphabetic())
        .filter(|w| !w.is_empty())
        .map(str::to_lowercase)
        .collect()
}

/// Whether the King James words printed under a heading are in its verses:
/// at least [`MATCH`] of them, with a verse either side allowed, since a
/// quotation sometimes runs on.
fn heading_matches(quote: &str, at: &[(u32, u32)], kjv: &[String]) -> bool {
    let q = words(quote);
    if q.is_empty() {
        return false;
    }
    let mut have: HashSet<String> = HashSet::new();
    for &(from, to) in at {
        for v in from.saturating_sub(1)..=to + 1 {
            if let Some(line) = kjv.get(v as usize) {
                have.extend(words(line));
            }
        }
    }
    let hit = q.iter().filter(|w| have.contains(*w)).count();
    hit as f64 >= MATCH * q.len() as f64
}

/// A verse range as "Book c:v" or "Book c:v-v", for the build's report.
fn label(vz: &Versification, at: &[(u32, u32)]) -> String {
    at.iter()
        .map(|&(f, t)| {
            let (b, c, v) = vz.locate(f).unwrap_or((0, 0, 0));
            let end = vz.locate(t).map_or(v, |l| l.2);
            if t > f { format!("{} {c}:{v}-{end}", BOOKS[b as usize].name) } else { format!("{} {c}:{v}", BOOKS[b as usize].name) }
        })
        .collect::<Vec<_>>()
        .join("; ")
}

/// Share of a quotation's words in a set of words.
fn share(q: &[String], have: &HashSet<String>) -> f64 {
    q.iter().filter(|w| have.contains(*w)).count() as f64 / q.len().max(1) as f64
}

/// The one place in the King James text that holds a quotation: a verse, or
/// a verse and the next when the quotation runs on. `None` unless at least
/// [`FOUND`] of its words are there and no other place comes within
/// [`MARGIN`] of it.
fn find_verse(quote: &str, kjv: &[String]) -> Option<(u32, u32)> {
    let q = words(quote);
    if q.len() < 5 {
        return None;
    }
    let sets: Vec<HashSet<String>> = kjv.iter().map(|l| words(l).into_iter().collect()).collect();
    let mut scored: Vec<(f64, u32, u32)> = Vec::new();
    for v in 0..sets.len() {
        let one = share(&q, &sets[v]);
        let mut best = (one, v as u32, v as u32);
        if let Some(next) = sets.get(v + 1) {
            let both: HashSet<String> = sets[v].union(next).cloned().collect();
            let two = share(&q, &both);
            if two > one + 0.1 && share(&q, next) < one {
                best = (two, v as u32, v as u32 + 1);
            }
        }
        scored.push(best);
    }
    scored.sort_by(|x, y| y.0.total_cmp(&x.0));
    let (top, f, t) = scored[0];
    let second = scored.iter().skip(1).find(|x| x.1 > t || x.2 < f).map_or(0.0, |x| x.0);
    (top >= FOUND && top - second >= MARGIN).then_some((f, t))
}

fn entries(vz: &Versification, rows: &[Vec<Cell>], kjv: &[String], report: &mut Report) -> Result<Vec<Entry>, String> {
    let mut out = Vec::new();
    let mut numbers = Vec::new();
    for row in rows {
        let (Some(Cell::Text(chapter)), Some(Cell::Text(content))) = (row.first(), row.get(1)) else {
            return Err(format!("{SOURCE}: a row without its two text columns"));
        };
        let no_text = chapter.split(' ').next().unwrap_or("");
        let Ok(no) = no_text.parse::<u32>() else {
            // The cover and the preface ("000.1", "000.2").
            continue;
        };
        if no == 0 {
            continue;
        }
        numbers.push(no);
        let ps = paragraphs(content);
        let (Some(head), Some(lead)) = (ps.first(), ps.get(1)) else {
            return Err(format!("{SOURCE}: entry {no} has no heading"));
        };
        let title = clean_title(&decode(&strip_tags(head))?);
        // The heading verses, and the King James words after them.
        let lead_runs = runs(vz, lead, report)?;
        let mut at: Vec<(u32, u32)> = Vec::new();
        let mut quote = String::new();
        for r in &lead_runs {
            match r {
                Run::Verse(f, t, _) if quote.trim_matches(|c: char| !c.is_alphanumeric()).is_empty() => at.push((*f, *t)),
                Run::Verse(_, _, w) | Run::Text(w) => quote.push_str(w),
            }
        }
        let quote = quote.trim_start_matches(|c: char| c == '.' || c == ';' || c == ',' || c.is_whitespace()).trim().to_string();
        if at.is_empty() || !heading_matches(&quote, &at, kjv) {
            // The heading verse was misread from the page ("Judges 3:81") or
            // is missing: the one verse that holds the printed words, if any.
            let was = if at.is_empty() { decode(&strip_tags(lead))?.chars().take(24).collect::<String>() } else { label(vz, &at) };
            match find_verse(&quote, kjv) {
                Some(r) => {
                    report.found.push(format!("{no} {title}: {was} is {}", label(vz, &[r])));
                    at = vec![r];
                }
                None => {
                    report.dropped.push(format!("{no} {title} ({was})"));
                    continue;
                }
            }
        }
        for r in at.iter_mut() {
            if r.1 - r.0 >= LONGEST {
                r.1 = r.0;
                report.long += 1;
            }
        }
        let mut text = Vec::new();
        for p in &ps[2..] {
            if p.contains("BibleTruthPublishers") || p.contains("bibletruthpublishers") {
                continue;
            }
            let r = runs(vz, p, report)?;
            if !r.is_empty() {
                text.push(r);
            }
        }
        if text.is_empty() {
            return Err(format!("{SOURCE}: entry {no} has no words"));
        }
        report.placed += 1;
        out.push(Entry { no, title, at, quote, text });
    }
    let expected: Vec<u32> = (1..=ENTRIES as u32).collect();
    if numbers != expected {
        return Err(format!("{SOURCE}: expected entries 1 to {ENTRIES} in order, found {}", numbers.len()));
    }
    Ok(out)
}

fn runs_json(rs: &[Run]) -> Value {
    Value::Array(
        rs.iter()
            .map(|r| match r {
                Run::Text(t) => json!(t),
                Run::Verse(f, t, w) => json!([f, t, w]),
            })
            .collect(),
    )
}

/// The files to write under web/public/data, as (path, bytes).
pub fn build(inputs: &Inputs, vz: &Versification) -> Result<Vec<(String, Vec<u8>)>, String> {
    let zpath = inputs.path(SOURCE, "module");
    let zip = fs::read(&zpath).map_err(|e| format!("reading {}: {e}", zpath.display()))?;
    let db = unzip(&zip, ".book")?;
    let rows = sqlite_rows(&db, "Reference")?;
    let kpath = inputs.path("kjv", "kjv");
    let kjson = fs::read_to_string(&kpath).map_err(|e| format!("reading {}: {e}", kpath.display()))?;
    let kjv: Vec<String> = crate::extra_translations::lines(&kjson, vz, "KJV")?.lines().map(str::to_string).collect();

    let mut report = Report::default();
    let list = entries(vz, &rows, &kjv, &mut report)?;

    let mut index = Vec::new();
    let mut books: BTreeMap<u8, Vec<Value>> = BTreeMap::new();
    for e in &list {
        let at: Vec<Value> = e.at.iter().map(|(f, t)| json!([f, t])).collect();
        index.push(json!([e.no, e.title, at]));
        let (b, _, _) = vz.locate(e.at[0].0).ok_or("an entry outside the Bible")?;
        books.entry(b).or_default().push(json!({
            "no": e.no,
            "title": e.title,
            "at": at,
            "quote": e.quote,
            "text": e.text.iter().map(|p| runs_json(p)).collect::<Vec<_>>(),
        }));
    }
    let mut out = vec![(OUT.to_string(), serde_json::to_vec(&json!({ "format": 1, "entries": index })).map_err(|e| e.to_string())?)];
    for (b, list) in books {
        out.push((
            format!("{DIR}/{}.json", BOOKS[b as usize].osis),
            serde_json::to_vec(&json!({ "format": 1, "entries": list })).map_err(|e| e.to_string())?,
        ));
    }
    eprintln!(
        "customs: {} of {ENTRIES} Freeman entries placed, {} verse links; {} placed on the one verse holding the King James words printed under them, since the transcription's heading verse is missing or does not hold them; {} left out; {} long headings shown on their first verse",
        report.placed,
        report.links,
        report.found.len(),
        report.dropped.len(),
        report.long
    );
    for x in &report.found {
        eprintln!("  customs: placed by its words: {x}");
    }
    for x in &report.dropped {
        eprintln!("  customs: left out (no one verse holds its words): {x}");
    }
    Ok(out)
}

fn read_json(path: &std::path::Path) -> Result<Value, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))
}

/// Checks on the built files.
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let n = u64::from(d.vz.verse_count());
    let index = read_json(&d.dir.join(OUT))?;
    let list = index["entries"].as_array().cloned().unwrap_or_default();
    let range_ok = |r: &Value| -> bool {
        let (f, t) = (r[0].as_u64().unwrap_or(n), r[1].as_u64().unwrap_or(n));
        f < n && t < n && f <= t && t - f < u64::from(LONGEST)
    };
    let link_ok = |r: &Value| -> bool {
        let (f, t) = (r[0].as_u64().unwrap_or(n), r[1].as_u64().unwrap_or(n));
        f < n && t < n && f <= t
    };
    let mut index_ok = index["format"] == 1 && !list.is_empty();
    let mut seen = HashSet::new();
    let mut by_no: BTreeMap<u64, Value> = BTreeMap::new();
    for e in &list {
        let no = e[0].as_u64().unwrap_or(0);
        let at = e[2].as_array().cloned().unwrap_or_default();
        index_ok &= (1..=ENTRIES as u64).contains(&no)
            && seen.insert(no)
            && e[1].as_str().is_some_and(|t| !t.trim().is_empty() && t.len() < 60)
            && !at.is_empty()
            && at.iter().all(range_ok);
        by_no.insert(no, e.clone());
    }
    // Every entry in the index is in its book's file, with words, and nothing else is.
    let (mut files_ok, mut text_ok, mut links_ok) = (true, true, true);
    let mut found = 0usize;
    let mut html = false;
    for b in BOOKS.iter() {
        let path = d.dir.join(format!("{DIR}/{}.json", b.osis));
        if !path.exists() {
            continue;
        }
        let f = read_json(&path)?;
        for e in f["entries"].as_array().cloned().unwrap_or_default() {
            let no = e["no"].as_u64().unwrap_or(0);
            let Some(ix) = by_no.get(&no) else {
                files_ok = false;
                continue;
            };
            found += 1;
            files_ok &= ix[1] == e["title"] && ix[2] == e["at"];
            let paras = e["text"].as_array().cloned().unwrap_or_default();
            text_ok &= !paras.is_empty() && e["quote"].as_str().is_some_and(|q| !q.is_empty());
            for p in &paras {
                for r in p.as_array().cloned().unwrap_or_default() {
                    match &r {
                        Value::String(s) => html |= s.contains('<') && s.contains('>'),
                        Value::Array(_) => links_ok &= link_ok(&r) && r[2].as_str().is_some_and(|w| !w.is_empty()),
                        _ => text_ok = false,
                    }
                }
            }
        }
    }
    files_ok &= found == by_no.len();
    // Known placements: Genesis 31:34 (entry 62, the camel's furniture) and
    // Revelation 19:12 (entry 891, many crowns).
    let at_ref = |no: u64, osis: &str| -> bool {
        let Ok((v, _)) = d.resolve(osis) else { return false };
        by_no.get(&no).is_some_and(|e| e[2][0][0].as_u64() == Some(u64::from(v)))
    };
    Ok(vec![
        (index_ok, format!("customs: {} Freeman entries, each numbered once with a heading and verses", list.len())),
        (list.len() * 10 >= ENTRIES * 9, "customs: at least nine in ten of Freeman's entries are placed".into()),
        (files_ok, "customs: every entry is in its book's file, as the index has it".into()),
        (text_ok && links_ok, "customs: every entry has its words and King James heading, and every link names verses".into()),
        (!html, "customs: no HTML reaches the browser".into()),
        (at_ref(62, "Gen.31.34") && at_ref(891, "Rev.19.12"), "customs: known entries sit on Genesis 31:34 and Revelation 19:12".into()),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inflates_fixed_and_stored_blocks() {
        // "hello hello hello" compressed with fixed codes (zlib level 9, raw).
        let fixed = [0xcb, 0x48, 0xcd, 0xc9, 0xc9, 0x57, 0xc8, 0x40, 0x90, 0x00];
        assert_eq!(inflate(&fixed).unwrap(), b"hello hello hello");
        // A stored block holding "abc".
        let stored = [0x01, 0x03, 0x00, 0xfc, 0xff, b'a', b'b', b'c'];
        assert_eq!(inflate(&stored).unwrap(), b"abc");
        // Dynamic codes: one sentence five times, from Python's zlib (raw, level 9).
        let dynamic = [
            237, 140, 177, 13, 128, 48, 12, 4, 87, 249, 9, 216, 130, 34, 99, 88, 200, 33, 17, 96, 67, 236, 20, 217, 30, 100, 177, 3, 13, 205, 235, 138, 191, 75, 2, 47, 140,
            153, 204, 3, 180, 213, 181, 10, 185, 54, 104, 6, 201, 192, 210, 205, 245, 64, 53, 228, 198, 87, 103, 241, 125, 192, 78, 221, 88, 226, 98, 225, 101, 122, 54, 28,
            47, 228, 175, 52, 33, 253, 249, 207, 242, 55,
        ];
        let sentence = "In the East the originator of any custom is frequently spoken of as the father of that custom. ";
        assert_eq!(inflate(&dynamic).unwrap(), sentence.repeat(5).as_bytes());
    }

    #[test]
    fn crc_matches_the_standard_check_value() {
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
    }

    #[test]
    fn varints_read_as_sqlite_writes_them() {
        let mut at = 0;
        assert_eq!(varint(&[0x81, 0x00], &mut at).unwrap(), 128);
        assert_eq!(at, 2);
    }

    #[test]
    fn entities_decode() {
        assert_eq!(decode("Camels&rsquo;  Furniture &alpha;&sigmaf;&Omega;&#x05D9;").unwrap(), "Camels\u{2019} Furniture \u{3B1}\u{3C2}\u{3A9}\u{5D9}");
        assert_eq!(decode("&sigma;&upsilon;&omega;").unwrap(), "\u{3C3}\u{3C5}\u{3C9}");
    }

    #[test]
    fn titles_read_cleanly() {
        assert_eq!(clean_title("381 Letters"), "Letters");
        assert_eq!(clean_title("680, Benedictions on Children"), "Benedictions on Children");
        assert_eq!(clean_title("The \"Governor of the Feast.\u{201D}"), "The \u{201C}Governor of the Feast\u{201D}");
        assert_eq!(clean_title("Cistern in the Court Yard:"), "Cistern in the Court Yard");
        assert_eq!(clean_title("The Asiarch\u{5B6}"), "The Asiarch");
    }

    #[test]
    fn words_compare_letters_only() {
        assert_eq!(words("Rachel had taken the images,"), ["rachel", "had", "taken", "the", "images"]);
    }
}
