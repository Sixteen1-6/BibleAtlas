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
use crate::shelf::{Dictionary, Piece};
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

/// An entry with fewer letters of its own than this is not listed under a
/// verse: it would open as "(Job 30:4)" or "(Genesis 12:6) [Shechem]".
pub const OWN_LETTERS: usize = 25;

/// An entry's text as the panel shows it, with "#" for each verse link.
fn shown(text: &[Piece]) -> String {
    text.iter()
        .map(|p| match p {
            Piece::Text(t) => t.as_str(),
            Piece::Link { .. } => "#",
        })
        .collect()
}

/// The text without its brackets ("[Shechem]") and the parts that only send
/// the reader to another entry ("See AGRICULTURE; MONTH.", "(See CHITTIM.)").
fn without_pointers(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while !rest.is_empty() {
        let see = rest
            .char_indices()
            .find(|&(i, _)| {
                let r = &rest[i..];
                (r.starts_with("See ") || r.starts_with("SEE ") || r.starts_with("see "))
                    && !rest[..i].ends_with(|c: char| c.is_alphabetic())
            })
            .map(|(i, _)| i);
        let open = rest.find('[');
        let (at, close) = match (see, open) {
            (Some(s), o) if o.is_none_or(|o| s < o) => (s, &['.', ')', ']'][..]),
            (_, Some(o)) => (o, &[']'][..]),
            _ => {
                out.push_str(rest);
                break;
            }
        };
        out.push_str(&rest[..at]);
        let after = &rest[at + 1..];
        rest = match after.find(close) {
            Some(e) => &after[e + 1..],
            None => "",
        };
    }
    out
}

/// The letters of an entry's own words: not its verse links, references in
/// brackets ("(Gen. 8:22)", "(Joshua 15:15,16)"), pointers to other entries,
/// or a book named in a reference written out.
pub fn own_letters(text: &[Piece]) -> usize {
    let t = without_pointers(&shown(text));
    // Parentheses that hold a reference.
    let mut kept = String::with_capacity(t.len());
    let mut rest = t.as_str();
    while let Some(o) = rest.find('(') {
        kept.push_str(&rest[..o]);
        let inner_end = rest[o..].find(')').map(|e| o + e);
        // Only an innermost pair can be a reference: "(a fortress ... (#)--ED.)"
        // keeps its words, and its "(#)" is dropped on a later turn.
        let innermost = inner_end.is_some_and(|e| !rest[o + 1..e].contains('('));
        match inner_end {
            Some(e) if innermost && rest[o..e].contains(|c: char| c.is_ascii_digit() || c == '#') => {
                rest = &rest[e + 1..]
            }
            _ => {
                kept.push('(');
                rest = &rest[o + 1..];
            }
        }
    }
    kept.push_str(rest);
    let mut n = 0;
    let mut rest = kept.as_str();
    while let Some(start) = rest.find(char::is_alphabetic) {
        let len = rest[start..]
            .find(|c: char| !c.is_alphabetic())
            .unwrap_or(rest.len() - start);
        let word = &rest[start..start + len];
        let after = rest[start + len..].trim_start_matches('.').trim_start();
        let reference = after.starts_with(|c: char| c.is_ascii_digit() || c == '#');
        if !reference
            && !matches!(
                word.to_lowercase().as_str(),
                "q" | "v" | "marg" | "comp" | "ver" | "etc" | "also"
            )
        {
            n += word.chars().count();
        }
        rest = &rest[start + len..];
    }
    n
}

/// The names of the entries a thin entry sends the reader to: "[Shechem]",
/// "[See Jehosheba]", "See AGRICULTURE; MONTH.", "(See CHITTIM.)".
fn sent_to(text: &[Piece]) -> Vec<String> {
    let t = shown(text);
    let mut out = Vec::new();
    let mut take = |s: &str| {
        let s = s.trim();
        let s = ["See ", "SEE ", "see "]
            .iter()
            .find_map(|p| s.strip_prefix(p))
            .unwrap_or(s);
        out.extend(
            s.split(';')
                .map(|x| x.trim().trim_end_matches('.').trim())
                .filter(|x| !x.is_empty())
                .map(str::to_string),
        );
    };
    let mut rest = t.as_str();
    while let Some(o) = rest.find('[') {
        let e = rest[o..].find(']').map_or(rest.len(), |e| o + e);
        take(&rest[o + 1..e]);
        rest = &rest[(e + 1).min(rest.len())..];
    }
    for (i, _) in t.match_indices("See ").chain(t.match_indices("SEE ")) {
        if t[..i].ends_with('[') {
            continue;
        }
        let tail = &t[i..];
        let e = tail.find(['.', ')', ']']).unwrap_or(tail.len());
        take(&tail[..e]);
    }
    out
}

/// A name as letters only, lowercase, to match a pointer to an entry.
fn name_key(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_alphabetic())
        .flat_map(char::to_lowercase)
        .collect()
}

/// What each entry is listed as under the verses it cites: itself, the
/// entries a thin one sends the reader to (each found by name, only one entry
/// having it, in the same dictionary), or nothing.
fn listed_as(dicts: &[Dictionary]) -> Vec<Vec<Vec<usize>>> {
    dicts
        .iter()
        .map(|dict| {
            let thin: Vec<bool> = dict
                .entries
                .iter()
                .map(|e| own_letters(&e.text) < OWN_LETTERS)
                .collect();
            let mut by_name: HashMap<String, Vec<usize>> = HashMap::new();
            for (i, e) in dict.entries.iter().enumerate() {
                let full = name_key(&e.name);
                let head = name_key(e.name.split(',').next().unwrap_or(""));
                by_name.entry(full.clone()).or_default().push(i);
                if head != full {
                    by_name.entry(head).or_default().push(i);
                }
            }
            dict.entries
                .iter()
                .enumerate()
                .map(|(i, e)| {
                    if !thin[i] {
                        return vec![i];
                    }
                    let mut to: Vec<usize> = Vec::new();
                    for name in sent_to(&e.text) {
                        let keys = [
                            name_key(&name),
                            name_key(name.split(',').next().unwrap_or("")),
                        ];
                        let found = keys.iter().find_map(|k| {
                            let hits: Vec<usize> = by_name
                                .get(k)?
                                .iter()
                                .copied()
                                .filter(|&j| j != i && !thin[j])
                                .collect::<HashSet<_>>()
                                .into_iter()
                                .collect();
                            (hits.len() == 1).then(|| hits[0])
                        });
                        if let Some(j) = found.filter(|j| !to.contains(j)) {
                            to.push(j);
                        }
                    }
                    to
                })
                .collect()
        })
        .collect()
}

/// The files to write under web/public/data, as (path, bytes). `text` is the
/// BSB, one string per verse.
pub fn build(
    dicts: &[Dictionary],
    vz: &Versification,
    text: &[String],
) -> Result<Vec<(String, Vec<u8>)>, String> {
    // verse -> (dictionary, entry) -> the length of its narrowest reference there.
    // A thin entry is listed as the entries it sends the reader to, or not at all.
    let listed = listed_as(dicts);
    let (mut thin, mut sent) = (0usize, 0usize);
    let mut cited: HashSet<u32> = HashSet::new();
    let mut at: BTreeMap<u32, HashMap<(usize, usize), u32>> = BTreeMap::new();
    for (d, dict) in dicts.iter().enumerate() {
        for (e, entry) in dict.entries.iter().enumerate() {
            let shown = &listed[d][e];
            if shown.first() != Some(&e) && !entry.refs.is_empty() {
                thin += 1;
                sent += usize::from(!shown.is_empty());
            }
            for &(from, to) in &entry.refs {
                let last = if to - from < SPREAD { to } else { from };
                for v in from..=last {
                    cited.insert(v);
                    for &x in shown {
                        let span = at.entry(v).or_default().entry((d, x)).or_insert(u32::MAX);
                        *span = (*span).min(to - from);
                    }
                }
            }
        }
    }
    eprintln!(
        "dictionary extra: {thin} entries with fewer than {OWN_LETTERS} letters of their own not listed ({sent} listed as the entries they send the reader to); {} verses left with none",
        cited.iter().filter(|v| !at.contains_key(v)).count()
    );
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

    // Every entry listed under a verse has words of its own, so no line opens
    // an entry that is only "(Job 30:4)" or "(Genesis 12:6) [Shechem]".
    let mut letters: HashMap<String, Value> = HashMap::new();
    let mut thin: Vec<String> = Vec::new();
    let mut checked: HashSet<(String, String)> = HashSet::new();
    for file in &books {
        for rows in file.as_object().into_iter().flat_map(|m| m.values()) {
            for r in rows.as_array().into_iter().flatten() {
                let (id, slug) = (r[0].as_str().unwrap_or(""), r[1].as_str().unwrap_or(""));
                if slug.is_empty() || !checked.insert((id.to_string(), slug.to_string())) {
                    continue;
                }
                let key = format!("dict/{id}/{}.json", &slug[..1]);
                if !letters.contains_key(&key) {
                    letters.insert(key.clone(), read_json(d, &key)?);
                }
                let text = &letters[&key][slug]["text"];
                let pieces: Vec<Piece> = match text {
                    Value::String(t) => vec![Piece::Text(t.clone())],
                    _ => text
                        .as_array()
                        .into_iter()
                        .flatten()
                        .map(|p| match p.as_str() {
                            Some(t) => Piece::Text(t.to_string()),
                            None => Piece::Link {
                                from: 0,
                                to: 0,
                                text: String::new(),
                            },
                        })
                        .collect(),
                };
                if own_letters(&pieces) < OWN_LETTERS {
                    thin.push(format!("{id}/{slug}"));
                }
            }
        }
    }
    out.push((
        thin.is_empty(),
        format!(
            "every dictionary entry listed under a verse has at least {OWN_LETTERS} letters of its own; {} do not: {:?}",
            thin.len(),
            &thin[..thin.len().min(5)]
        ),
    ));
    let gen = rows("Gen 8:22")?;
    out.push((
        !has(&gen, "easton", "seasons")
            && has(&gen, "easton", "agriculture")
            && !has(&rows("Acts 27:29")?, "smith", "anchor")
            && !has(&rows("Job 30:4")?, "smith", "mallows"),
        "Genesis 8:22 lists Easton's Agriculture, where his Seasons sends the reader, and not Seasons itself; Smith's Anchor (\"(Acts 27:29)\") and Mallows (\"(Job 30:4)\") are not listed".to_string(),
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
    fn tells_a_thin_entry_and_where_it_sends() {
        let link = || Piece::Link {
            from: 0,
            to: 0,
            text: "Gen. 8:22".into(),
        };
        let t = |s: &str| Piece::Text(s.into());
        let seasons = [t("("), link(), t("). See AGRICULTURE; MONTH.")];
        assert_eq!(own_letters(&seasons), 0);
        assert_eq!(sent_to(&seasons), vec!["AGRICULTURE", "MONTH"]);
        let sichem = [t("("), link(), t(") [Shechem]")];
        assert_eq!(
            (own_letters(&sichem), sent_to(&sichem)),
            (0, vec!["Shechem".to_string()])
        );
        assert_eq!(
            sent_to(&[t("(Ezra 6:2 marg.). (See ACHMETHA.)")]),
            vec!["ACHMETHA"]
        );
        assert_eq!(
            sent_to(&[t("(1 Chronicles 6:23,37) [See Abiasaph]")]),
            vec!["Abiasaph"]
        );
        assert_eq!(
            own_letters(&[t("(trodden down). (Joshua 13:18) [Jahaz, Also Jahaza]")]),
            11
        );
        let helpmeet = [t("(Heb. ‘ezer ke-negdo; i.e., “a help as his counterpart” = a help suitable to him), a wife ("), link(), t(").")];
        assert!(own_letters(&helpmeet) >= OWN_LETTERS);
        // Smith's Antonia: a long article in brackets that ends on a verse link.
        let antonia = [
            t("(from Marc Antony) (a square stone fortress adjoining the temple area at Jerusalem ("),
            link(),
            t(")\u{2014}ED.)"),
        ];
        assert!(own_letters(&antonia) >= OWN_LETTERS);
        assert_eq!(name_key("Kidron, or Kedron"), name_key("Kidron, Or Kedron"));
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
