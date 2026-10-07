//! Parse references the way people type them: "jn 3:16", "1 Cor 13:4-7",
//! "Psalm 23", "Gen.1.1", "II Kings 2:11", "Song of Songs 2".

use crate::canon::BOOKS;
use alloc::string::String;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RefQuery {
    pub book: u8,
    /// 1-based; 0 means the whole book was named.
    pub chapter: u16,
    /// 1-based; 0 means a whole chapter.
    pub verse: u16,
    /// Inclusive end of a range, as (chapter, verse). Equal to the start for a single verse.
    pub end_chapter: u16,
    pub end_verse: u16,
}

fn squash(s: &str) -> String {
    s.chars().filter(|c| c.is_alphanumeric()).flat_map(|c| c.to_lowercase()).collect()
}

/// Resolve a typed book name to its index.
pub fn parse_book(input: &str) -> Option<u8> {
    let lower: String = input.trim().chars().flat_map(|c| c.to_lowercase()).collect();
    let mut rest = lower.as_str();
    let mut prefix = "";
    for (word, num) in [
        ("iii ", "3"), ("ii ", "2"), ("i ", "1"), ("third ", "3"), ("second ", "2"), ("first ", "1"),
        ("3rd ", "3"), ("2nd ", "2"), ("1st ", "1"),
    ] {
        if let Some(r) = rest.strip_prefix(word) {
            prefix = num;
            rest = r;
            break;
        }
    }
    let mut key = String::from(prefix);
    key.push_str(&squash(rest));
    if key.is_empty() {
        return None;
    }
    for (i, b) in BOOKS.iter().enumerate() {
        if b.aliases.iter().any(|a| *a == key) || squash(b.name) == key || squash(b.osis) == key {
            return Some(i as u8);
        }
    }
    // Unique prefix of a full name ("revel", "phili" is ambiguous, "philip" is not).
    if key.len() >= 3 {
        let mut hit = None;
        for (i, b) in BOOKS.iter().enumerate() {
            if squash(b.name).starts_with(key.as_str()) {
                if hit.is_some() {
                    return None;
                }
                hit = Some(i as u8);
            }
        }
        return hit;
    }
    None
}

fn split_numbers(s: &str) -> Option<[u16; 4]> {
    // Accepts: "3", "3:16", "3.16", "3 16", "3:16-18", "3:16-4:2", "3-4".
    let s = s.trim();
    let (start, end) = match s.find(['-', '–', '—']) {
        Some(i) => (&s[..i], Some(s[i..].trim_start_matches(['-', '–', '—']))),
        None => (s, None),
    };
    let nums = |t: &str| -> Option<(u16, Option<u16>)> {
        let mut it = t.split([':', '.', ' ']).filter(|x| !x.is_empty());
        let a = it.next()?.parse().ok()?;
        let b = match it.next() {
            Some(x) => Some(x.parse().ok()?),
            None => None,
        };
        if it.next().is_some() {
            return None;
        }
        Some((a, b))
    };
    let (ch, v) = nums(start)?;
    let v = v.unwrap_or(0);
    let (ech, ev) = match end {
        None => (ch, v),
        Some(e) => match nums(e)? {
            (x, Some(y)) => (x, y),
            // "3:16-18" ends at verse 18; "3-4" ends at chapter 4.
            (x, None) if v != 0 => (ch, x),
            (x, None) => (x, 0),
        },
    };
    Some([ch, v, ech, ev])
}

/// Parse a full reference. Returns `None` if the book is unknown or the
/// numbers are malformed. Does not check that the chapter/verse exist; use
/// [`crate::Versification`] for that.
pub fn parse(input: &str) -> Option<RefQuery> {
    let s = input.trim();
    // The book name ends where the chapter number starts: a digit that comes
    // after at least one letter.
    let mut seen_letter = false;
    let mut split = s.len();
    for (i, c) in s.char_indices() {
        if c.is_alphabetic() {
            seen_letter = true;
        } else if c.is_ascii_digit() && seen_letter {
            split = i;
            break;
        }
    }
    let book_part = s[..split].trim_end_matches(|c: char| c == '.' || c.is_whitespace());
    let book = parse_book(book_part)?;
    if split == s.len() {
        return Some(RefQuery { book, chapter: 0, verse: 0, end_chapter: 0, end_verse: 0 });
    }
    let [chapter, verse, end_chapter, end_verse] = split_numbers(&s[split..])?;
    if chapter == 0 {
        return None;
    }
    Some(RefQuery { book, chapter, verse, end_chapter, end_verse })
}

/// Turn a parsed reference into an inclusive range of verse indices.
/// A whole book or chapter becomes its full range. For one-chapter books,
/// "Jude 5" means verse 5.
pub fn resolve(q: RefQuery, vz: &crate::Versification) -> Option<(u32, u32)> {
    let mut q = q;
    if vz.chapters_in(q.book) == 1 && q.chapter > 1 && q.verse == 0 {
        q = RefQuery { book: q.book, chapter: 1, verse: q.chapter, end_chapter: 1, end_verse: q.end_chapter.max(q.chapter) };
    }
    if q.chapter == 0 {
        let start = vz.book_start(q.book);
        let end = if (q.book as usize) + 1 < vz.book_count() { vz.book_start(q.book + 1) } else { vz.verse_count() };
        return Some((start, end - 1));
    }
    let start = vz.index(q.book, q.chapter, q.verse.max(1))?;
    let end_ch = q.end_chapter.max(q.chapter);
    let end = if q.end_verse == 0 {
        let n = vz.verses_in(q.book, end_ch)?;
        vz.index(q.book, end_ch, n)?
    } else {
        vz.index(q.book, end_ch, q.end_verse)?
    };
    Some((start, end.max(start)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_ranges() {
        use alloc::vec;
        // Book 0: two chapters of 3 and 2 verses; book 1: one chapter of 5.
        let mut counts = vec![vec![3u16, 2], vec![5u16]];
        counts.resize(66, vec![1u16]);
        let vz = crate::Versification::from_counts(&counts);
        let q = |b, c, v, ec, ev| RefQuery { book: b, chapter: c, verse: v, end_chapter: ec, end_verse: ev };
        assert_eq!(resolve(q(0, 0, 0, 0, 0), &vz), Some((0, 4)));
        assert_eq!(resolve(q(0, 2, 0, 2, 0), &vz), Some((3, 4)));
        assert_eq!(resolve(q(0, 1, 2, 1, 3), &vz), Some((1, 2)));
        assert_eq!(resolve(q(1, 4, 0, 4, 0), &vz), Some((8, 8))); // one-chapter book: "X 4" is verse 4
        assert_eq!(resolve(q(0, 9, 1, 9, 1), &vz), None);
    }

    fn p(s: &str) -> (u8, u16, u16, u16, u16) {
        let r = parse(s).unwrap_or_else(|| panic!("failed: {s}"));
        (r.book, r.chapter, r.verse, r.end_chapter, r.end_verse)
    }

    #[test]
    fn common_forms() {
        assert_eq!(p("John 3:16"), (42, 3, 16, 3, 16));
        assert_eq!(p("jn3:16"), (42, 3, 16, 3, 16));
        assert_eq!(p("Gen.1.1"), (0, 1, 1, 1, 1));
        assert_eq!(p("1 Cor 13:4-7"), (45, 13, 4, 13, 7));
        assert_eq!(p("1cor 13"), (45, 13, 0, 13, 0));
        assert_eq!(p("Psalm 23"), (18, 23, 0, 23, 0));
        assert_eq!(p("II Kings 2:11"), (11, 2, 11, 2, 11));
        assert_eq!(p("i samuel 3:4"), (8, 3, 4, 3, 4));
        assert_eq!(p("Isaiah 53:5"), (22, 53, 5, 53, 5));
        assert_eq!(p("Song of Songs 2:1"), (21, 2, 1, 2, 1));
        assert_eq!(p("Revelation 21:1-22:5"), (65, 21, 1, 22, 5));
        assert_eq!(p("Gen 1-3"), (0, 1, 0, 3, 0));
        assert_eq!(p("Jude"), (64, 0, 0, 0, 0));
        assert_eq!(p("revel 1"), (65, 1, 0, 1, 0));
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse("Hezekiah 3:1").is_none());
        assert!(parse("John x:y").is_none());
        assert!(parse("").is_none());
        assert!(parse("phi 1").is_none()); // Philippians or Philemon
    }
}
