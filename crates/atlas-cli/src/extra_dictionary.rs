//! Old Bible dictionaries: under a verse, the entries of Easton's and Smith's
//! Bible Dictionaries that cite it, and in the panel those entries with their
//! verse links. The dictionaries are read and linked in [`crate::shelf`].
//!
//! An entry is listed under every verse of a reference of up to
//! [`SPREAD`] verses, and under the first verse of a longer passage or a whole
//! chapter ("Gen. 12:1-25:10", "Lev. 8"), so a long story does not fill every
//! verse it covers. At a verse, the entries come in this order, so the line
//! under it can name the likeliest first: an entry whose name the verse's BSB
//! text uses ("Quails" at Exodus 16:13, where quail came up), then the one
//! that cites the verse most narrowly, then the one that cites the fewest
//! verses in all (the most specific), then Easton's before Smith's, then by
//! name.
//!
//! Outputs, under web/public/data:
//! - `extras/dictionary.json`, small because it loads with the first verse a
//!   reader selects: `{format, dictionaries: [{id, title, when}], verses}`,
//!   `verses` being every verse that has entries, sorted.
//! - `extras/dictionary/<book>.json` for each book (0 is Genesis), loaded when
//!   a panel opens: `{"<verse>": [[dictionary id, slug, name], ...]}`, the
//!   name in plain word order and without a comma ([`line_name`]: Holy
//!   Spirit, where the dictionary has "Spirit, Holy"). The entry is in
//!   `dict/<id>/<first letter of slug>.json`.

use crate::loaded::Loaded;
use crate::shelf::Dictionary;
use atlas_core::Versification;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;

const OUT: &str = "extras/dictionary.json";
const BOOK_DIR: &str = "extras/dictionary";
/// The longest reference, in verses, listed under each of its verses.
pub const SPREAD: u32 = 10;
/// The most `extras/dictionary.json` may weigh (README: about 200 KB).
const MAX_BYTES: usize = 200_000;

/// Words that, after a comma, describe the name before it ("Spirit, Holy").
const BEFORE: [&str; 27] = [
    "authorized", "bloody", "bodily", "chief", "christian", "false", "fiery", "final", "good",
    "great", "hebrew", "holy", "instrumental", "molten", "morning", "mount", "new", "old",
    "personal", "precious", "religious", "running", "sabbatical", "scape", "silver", "spiritual",
    "strong",
];

/// The name an entry goes by under a verse: in plain word order and without
/// a comma, so that a line of names reads as a list. "Spirit, Holy" is Holy
/// Spirit, "Corinthians, First Epistle to the" is First Epistle to the
/// Corinthians, "Judgment, The final" is The final Judgment and "Baptism,
/// John’s" is John’s Baptism; otherwise the part before the comma, so "Sea,
/// The" is Sea and "Cherub, Cherubim" or "Thank Offering, or Peace Offering"
/// the first name.
pub fn line_name(name: &str) -> String {
    let name = name.split(" = ").next().unwrap_or(name).trim();
    let Some((head, tail)) = name.split_once(',') else {
        return name.to_string();
    };
    let (head, tail) = (head.trim(), tail.trim());
    let lower = tail.to_lowercase();
    let words: Vec<&str> = lower.split_whitespace().collect();
    let turned = match words.as_slice() {
        _ if tail.contains(',') || words.iter().any(|w| matches!(*w, "or" | "also" | "and")) => {
            false
        }
        // "Book of", "First Epistle to the", "Gospel according to", "Epistle from".
        [_, .., last] if matches!(*last, "of" | "to" | "the" | "from") => true,
        // "The final", "the Ten", "the Brook".
        ["the", _] => true,
        // "John’s", "Jews’", "Holy", "Mount".
        [w] => w.ends_with("’s") || w.ends_with("'s") || w.ends_with('’') || BEFORE.contains(w),
        _ => false,
    };
    let out = if turned {
        format!("{tail} {head}")
    } else {
        head.to_string()
    };
    let mut chars = out.chars();
    chars
        .next()
        .map_or(String::new(), |c| c.to_uppercase().chain(chars).collect())
}

/// The lowercase words of a text, letters only.
fn words(s: &str) -> Vec<String> {
    s.split(|c: char| !c.is_alphabetic())
        .filter(|w| w.len() >= 3)
        .map(str::to_lowercase)
        .collect()
}

/// Do two lowercase words look like one word ("quails" and "quail",
/// "creation" and "created", "heaven" and "heavens")? The same word of
/// three letters or more, or one starting with all of the other (four
/// letters or more), or sharing their first five letters.
fn alike(a: &str, b: &str) -> bool {
    let p = a.bytes().zip(b.bytes()).take_while(|(x, y)| x == y).count();
    a == b || (p >= 4 && p == a.len().min(b.len())) || p >= 5
}

/// Does the verse use the entry's name, or a word of it ("Sea, The Salt")?
fn named(name: &[String], verse: &[String]) -> bool {
    name.iter()
        .filter(|n| !matches!(n.as_str(), "the" | "and" | "of"))
        .any(|n| verse.iter().any(|w| alike(n, w)))
}

/// The files to write under web/public/data, as (path, bytes). `text` is the
/// BSB, one string per verse.
pub fn build(
    dicts: &[Dictionary],
    vz: &Versification,
    text: &[String],
) -> Result<Vec<(String, Vec<u8>)>, String> {
    // verse -> (dictionary, entry) -> the length of its narrowest reference there.
    let mut at: BTreeMap<u32, HashMap<(usize, usize), u32>> = BTreeMap::new();
    for (d, dict) in dicts.iter().enumerate() {
        for (e, entry) in dict.entries.iter().enumerate() {
            for &(from, to) in &entry.refs {
                let last = if to - from < SPREAD { to } else { from };
                for v in from..=last {
                    let span = at.entry(v).or_default().entry((d, e)).or_insert(u32::MAX);
                    *span = (*span).min(to - from);
                }
            }
        }
    }
    let mut books: Vec<serde_json::Map<String, Value>> =
        vec![serde_json::Map::new(); vz.book_count()];
    let mut pairs = 0;
    for (&v, found) in &at {
        let (book, _, _) = vz.locate(v).ok_or_else(|| {
            format!("dictionary reference to verse {v}, past the end of the Bible")
        })?;
        let verse_words = words(text.get(v as usize).map_or("", String::as_str));
        let mut list: Vec<(&(usize, usize), &u32)> = found.iter().collect();
        list.sort_by_cached_key(|&(&(d, e), &span)| {
            let entry = &dicts[d].entries[e];
            let name = entry.name.to_lowercase();
            (
                !named(&words(&name), &verse_words),
                span,
                entry.refs.len(),
                d,
                name,
                e,
            )
        });
        pairs += list.len();
        let rows: Vec<Value> = list
            .iter()
            .map(|&(&(d, e), _)| {
                let entry = &dicts[d].entries[e];
                json!([dicts[d].id, entry.slug, line_name(&entry.name)])
            })
            .collect();
        books[book as usize].insert(v.to_string(), Value::Array(rows));
    }
    let verses: Vec<u32> = at.keys().copied().collect();
    let titles: Vec<Value> = dicts
        .iter()
        .map(|d| json!({ "id": d.id, "title": d.title, "when": d.when }))
        .collect();
    let doc = serde_json::to_vec(&json!({ "format": 1, "dictionaries": titles, "verses": verses }))
        .map_err(|e| e.to_string())?;
    if doc.len() > MAX_BYTES {
        return Err(format!(
            "{OUT} would be {} bytes, more than {MAX_BYTES}",
            doc.len()
        ));
    }
    let mut files = vec![(OUT.to_string(), doc)];
    for (b, rows) in books.into_iter().enumerate() {
        files.push((
            format!("{BOOK_DIR}/{b}.json"),
            serde_json::to_vec(&rows).map_err(|e| e.to_string())?,
        ));
    }
    let largest = files[1..].iter().map(|(_, f)| f.len()).max().unwrap_or(0);
    eprintln!(
        "dictionary extra: {} verses have entries ({pairs} listings); {OUT} {:.0} KB, book files {:.0} KB in all, the largest {:.0} KB",
        verses.len(),
        files[0].1.len() as f64 / 1e3,
        files[1..].iter().map(|(_, f)| f.len()).sum::<usize>() as f64 / 1e3,
        largest as f64 / 1e3
    );
    Ok(files)
}

fn read_json(d: &Loaded, rel: &str) -> Result<Value, String> {
    let path = d.dir.join(rel);
    let text = fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", path.display()))
}

/// Checks for `atlas verify`, as (passed, what was checked).
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let n = d.vz.verse_count();
    let bytes = fs::metadata(d.dir.join(OUT))
        .map_err(|e| format!("{OUT}: {e}"))?
        .len();
    let doc = read_json(d, OUT)?;
    let verses: Vec<u64> = doc["verses"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_u64)
        .collect();
    let ids: Vec<&str> = doc["dictionaries"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|x| x["id"].as_str())
        .collect();
    let mut out = vec![
        (
            bytes as usize <= MAX_BYTES,
            format!("{OUT} is {bytes} bytes, at most {MAX_BYTES}"),
        ),
        (
            ids == ["easton", "smith"],
            format!("{OUT} names Easton's and Smith's dictionaries, not {ids:?}"),
        ),
        (
            doc["dictionaries"]
                .as_array()
                .into_iter()
                .flatten()
                .all(|x| x["title"].as_str().is_some_and(|t| !t.is_empty())),
            format!("{OUT}: every dictionary has a title"),
        ),
        (
            verses.windows(2).all(|w| w[0] < w[1])
                && verses.last().is_some_and(|&v| v < u64::from(n)),
            format!("{OUT}: verses sorted and in range"),
        ),
        (
            verses.len() > 15_000,
            format!(
                "only {} verses have dictionary entries, expected more than 15,000",
                verses.len()
            ),
        ),
    ];

    // Every listing names an entry that exists, under a verse of its book.
    let mut slugs: HashMap<&str, HashSet<String>> = HashMap::new();
    for id in &ids {
        let index = read_json(d, &format!("dict/{id}/index.json"))?;
        slugs.insert(
            id,
            index
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|r| r[1].as_str().map(str::to_string))
                .collect(),
        );
    }
    let listed: HashSet<u64> = verses.iter().copied().collect();
    let (mut seen, mut bad) = (0usize, 0usize);
    let mut books = Vec::new();
    for b in 0..d.vz.book_count() {
        let file = read_json(d, &format!("{BOOK_DIR}/{b}.json"))?;
        for (k, rows) in file.as_object().into_iter().flatten() {
            seen += 1;
            let ok = k.parse::<u32>().ok().is_some_and(|v| {
                listed.contains(&u64::from(v))
                    && d.vz.locate(v).is_some_and(|(bk, _, _)| bk as usize == b)
            }) && rows.as_array().is_some_and(|rs| {
                !rs.is_empty()
                    && rs.iter().all(|r| {
                        r[0].as_str()
                            .and_then(|id| slugs.get(id))
                            .is_some_and(|s| r[1].as_str().is_some_and(|x| s.contains(x)))
                            && r[2].as_str().is_some_and(|n| !n.is_empty() && !n.contains(','))
                    })
            });
            bad += usize::from(!ok);
        }
        books.push(file);
    }
    out.push((
        bad == 0 && seen == verses.len(),
        format!(
            "{bad} dictionary listings malformed (each names an entry, without a comma); {seen} listed of {} verses",
            verses.len()
        ),
    ));

    // Known entries: Easton's and Smith's Quails at Exodus 16:13; Smith's
    // Aaron at Exodus 4:14; something at Genesis 1:1.
    let rows = |verse: &str| -> Result<Vec<(String, String)>, String> {
        let (v, _) = d.resolve(verse)?;
        let (b, _, _) = d.vz.locate(v).ok_or("verse out of range")?;
        Ok(books[b as usize][v.to_string()]
            .as_array()
            .into_iter()
            .flatten()
            .map(|r| {
                (
                    r[0].as_str().unwrap_or("").to_string(),
                    r[1].as_str().unwrap_or("").to_string(),
                )
            })
            .collect())
    };
    let has = |list: &[(String, String)], id: &str, slug: &str| {
        list.iter().any(|(a, b)| a == id && b == slug)
    };
    let ex = rows("Exod 16:13")?;
    out.push((
        has(&ex, "easton", "quails") && has(&ex, "smith", "quails"),
        "Exodus 16:13 lists Quails in Easton's and Smith's".to_string(),
    ));
    out.push((
        has(&rows("Exod 4:14")?, "smith", "aaron"),
        "Exodus 4:14 lists Smith's Aaron".to_string(),
    ));
    out.push((
        !rows("Gen 1:1")?.is_empty(),
        "Genesis 1:1 has dictionary entries".to_string(),
    ));
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_names_in_the_verse() {
        let verse = words("In the evening quail came up and covered the camp, and in the morning");
        assert!(named(&words("quails"), &verse) && named(&words("camp"), &verse));
        assert!(!named(&words("food"), &verse) && !named(&words("encampment"), &verse));
        let gen = words("In the beginning God created the heavens and the earth.");
        assert!(
            named(&words("creation"), &gen)
                && named(&words("heaven"), &gen)
                && named(&words("god"), &gen)
        );
        assert!(!named(&words("genesis"), &gen) && !named(&words("sea, the"), &gen));
        assert!(alike("israel", "israelites") && !alike("judah", "judas"));
    }

    #[test]
    fn names_entries_in_plain_word_order() {
        for (name, plain) in [
            // Genesis 1:10 and 3:24 once read "Sea, Sea, The, …" and "Cherub, Cherubim, Cherub".
            ("Sea, The", "Sea"),
            ("Sea, the Salt", "The Salt Sea"),
            ("Cherub, Cherubim", "Cherub"),
            ("Spirit, Holy", "Holy Spirit"),
            ("Corinthians, First Epistle to the", "First Epistle to the Corinthians"),
            ("Judgment, The final", "The final Judgment"),
            ("Baptism, John’s", "John’s Baptism"),
            ("Carmel, Mount", "Mount Carmel"),
            ("Thank Offering, or Peace Offering", "Thank Offering"),
            ("Mary, Mother of Mark", "Mary"),
            ("Lords Day, the", "Lords Day"),
            ("Lodge, to", "Lodge"),
            ("Josedech = Jehozadak", "Josedech"),
            ("Atonement, the Day of", "The Day of Atonement"),
            ("Quails", "Quails"),
        ] {
            assert_eq!(line_name(name), plain, "{name}");
        }
    }
}
