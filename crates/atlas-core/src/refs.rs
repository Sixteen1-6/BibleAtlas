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
    let (key, _) = book_key(input)?;
    exact_book(&key)
}

/// Lowercase, fold "II"/"Second"/"2nd" into a leading digit, squash spaces
/// and punctuation. Returns the key and the length of its name part.
fn book_key(input: &str) -> Option<(String, usize)> {
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
    let name_len = key.len() - prefix.len();
    Some((key, name_len))
}

fn exact_book(key: &str) -> Option<u8> {
    for (i, b) in BOOKS.iter().enumerate() {
        if b.aliases.contains(&key) || squash(b.name) == key || squash(b.osis) == key {
            return Some(i as u8);
        }
    }
    // Unique prefix of a full name ("revel", "phili" is ambiguous, "philip" is not).
    if key.len() >= 3 {
        let mut hit = None;
        for (i, b) in BOOKS.iter().enumerate() {
            if squash(b.name).starts_with(key) {
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

/// Edit distance with adjacent transpositions ("Jonh" -> "John").
fn distance(a: &[u8], b: &[u8]) -> usize {
    let w = b.len() + 1;
    let mut d = alloc::vec![0usize; (a.len() + 1) * w];
    for i in 0..=a.len() {
        d[i * w] = i;
    }
    for (j, cell) in d.iter_mut().take(w).enumerate() {
        *cell = j;
    }
    for i in 1..=a.len() {
        for j in 1..=b.len() {
            let cost = usize::from(a[i - 1] != b[j - 1]);
            let mut v = (d[(i - 1) * w + j] + 1).min(d[i * w + j - 1] + 1).min(d[(i - 1) * w + j - 1] + cost);
            if i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1] {
                v = v.min(d[(i - 2) * w + j - 2] + 1);
            }
            d[i * w + j] = v;
        }
    }
    d[a.len() * w + b.len()]
}

/// A misspelled book name ("Mathew", "Phillipians", "Revelations", "Isiah"):
/// the one book whose full name is closest, if it is close enough and no
/// other book is equally close. Only used when chapter numbers follow, so
/// an English word like "truth" never turns into "Ruth".
fn fuzzy_book(input: &str) -> Option<u8> {
    let (key, name_len) = book_key(input)?;
    if name_len < 4 || !key.is_ascii() {
        return None;
    }
    let limit = if name_len >= 7 { 2 } else { 1 };
    // Rank by distance, then by how close the lengths are, so a swapped pair
    // ("Jonh" -> John) beats a dropped letter (Jonah).
    let mut best: ((usize, usize), Option<u8>, bool) = ((usize::MAX, 0), None, false);
    for (i, b) in BOOKS.iter().enumerate() {
        let name = squash(b.name);
        // Also compare against the name's prefix of the same length, so a
        // shortened misspelling ("Phillip 4") still finds Philippians.
        let mut d = distance(key.as_bytes(), name.as_bytes());
        if name.len() > key.len() {
            d = d.min(distance(key.as_bytes(), &name.as_bytes()[..key.len()]));
        }
        let score = (d, name.len().abs_diff(key.len()));
        if score < best.0 {
            best = (score, Some(i as u8), false);
        } else if score == best.0 {
            best.2 = true;
        }
    }
    match best {
        ((d, _), Some(b), false) if d > 0 && d <= limit => Some(b),
        _ => None,
    }
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

/// Fold the words people put between numbers into punctuation:
/// "John 3 v 16", "John ch. 3 verse 16", "John 3v16" -> "John 3:16"; and drop
/// a comma list after the first verse: "John 3:16, 18" -> "John 3:16".
fn normalize_numbers(input: &str) -> String {
    let mut s: String = input.trim().chars().flat_map(|c| c.to_lowercase()).collect();
    if let Some(i) = s.find([',', ';']) {
        // Only cut when a number came before the comma; book names have none.
        if s[..i].chars().any(|c| c.is_ascii_digit()) {
            s.truncate(i);
        }
    }
    let mut out = String::with_capacity(s.len());
    let words: alloc::vec::Vec<&str> = s.split_whitespace().collect();
    for (k, w) in words.iter().enumerate() {
        let after_number = k > 0 && words[k - 1].ends_with(|c: char| c.is_ascii_digit());
        let bare = w.trim_end_matches('.');
        // "John ch 3", but not "1 Ch 3" (1 Chronicles).
        if matches!(bare, "ch" | "chap" | "chapter") && k > 0 && words[k - 1].chars().any(|c| c.is_alphabetic()) {
            out.push(' ');
            continue;
        }
        if matches!(bare, "v" | "vs" | "vv" | "ver" | "verse" | "verses") && after_number {
            out.push(':');
            continue;
        }
        // "3v16" / "3vs16"
        let mut t = String::from(*w);
        for pat in ["vs", "v"] {
            if let Some(i) = t.find(pat) {
                let (a, b) = (&t[..i], &t[i + pat.len()..]);
                if !a.is_empty() && a.ends_with(|c: char| c.is_ascii_digit()) && b.starts_with(|c: char| c.is_ascii_digit()) {
                    t = alloc::format!("{a}:{b}");
                    break;
                }
            }
        }
        if !out.is_empty() && !out.ends_with(':') {
            out.push(' ');
        }
        out.push_str(&t);
    }
    out
}

/// Parse a full reference. Returns `None` if the book is unknown or the
/// numbers are malformed. Does not check that the chapter/verse exist; use
/// [`crate::Versification`] for that.
pub fn parse(input: &str) -> Option<RefQuery> {
    let s = normalize_numbers(input);
    let s = s.trim();
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
    let has_numbers = split < s.len();
    let book = parse_book(book_part).or_else(|| if has_numbers { fuzzy_book(book_part) } else { None })?;
    if !has_numbers {
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
    fn how_people_actually_type() {
        // Misspelled book names, when numbers follow.
        assert_eq!(p("Revelations 21:4"), (65, 21, 4, 21, 4));
        assert_eq!(p("Mathew 5:3"), (39, 5, 3, 5, 3));
        assert_eq!(p("Phillipians 4:13"), (49, 4, 13, 4, 13));
        assert_eq!(p("Isiah 53:5"), (22, 53, 5, 53, 5));
        assert_eq!(p("Jermiah 29:11"), (23, 29, 11, 29, 11));
        assert_eq!(p("Genisis 1:1"), (0, 1, 1, 1, 1));
        assert_eq!(p("Gensis 1:1"), (0, 1, 1, 1, 1));
        assert_eq!(p("Duet 6:4"), (4, 6, 4, 6, 4));
        assert_eq!(p("Habbakuk 2:4"), (34, 2, 4, 2, 4));
        assert_eq!(p("Jonh 3:16"), (42, 3, 16, 3, 16));
        assert_eq!(p("1 Jonh 4:8"), (61, 4, 8, 4, 8));
        assert_eq!(p("Eclesiastes 3:1"), (20, 3, 1, 3, 1));
        assert_eq!(p("Qoheleth 1:2"), (20, 1, 2, 1, 2));
        // Words and commas between the numbers.
        assert_eq!(p("John 3 v 16"), (42, 3, 16, 3, 16));
        assert_eq!(p("John 3v16"), (42, 3, 16, 3, 16));
        assert_eq!(p("John ch 3 verse 16"), (42, 3, 16, 3, 16));
        assert_eq!(p("John chapter 3"), (42, 3, 0, 3, 0));
        assert_eq!(p("John 3:16, 18"), (42, 3, 16, 3, 16));
        assert_eq!(p("Romans 8:28; 12:2"), (44, 8, 28, 8, 28));
        assert_eq!(p("1 Ch 3:4"), (12, 3, 4, 3, 4));
        assert_eq!(p("Rev. 3 vv. 20"), (65, 3, 20, 3, 20));
    }

    #[test]
    fn english_words_stay_english() {
        // No numbers: no guessing, so a search for "truth" or "mathew" is a word search.
        assert!(parse("truth").is_none());
        assert!(parse("love").is_none());
        assert!(parse("Mathew").is_none());
        assert!(parse("Corinthians 13").is_none()); // 1 or 2?
        assert!(parse("love 3").is_none());
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse("Hezekiah 3:1").is_none());
        assert!(parse("John x:y").is_none());
        assert!(parse("").is_none());
        assert!(parse("phi 1").is_none()); // Philippians or Philemon
    }
}
