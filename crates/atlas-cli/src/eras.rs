//! `eras.json`: when each part of the Bible happened and when each book was
//! written, in the words of the Tyndale Open Bible Dictionary (TBD).
//!
//! `config/eras.json` is typed by hand: the dictionary's eras, the chapters
//! that belong to each, and the dating views the dictionary gives for each
//! book. None of it is trusted. At build time:
//! - every quotation must appear word for word in one body paragraph of the
//!   named article (and of the named section, when a heading is given);
//! - every label must be cut word for word from its quotation, and every `who`
//!   phrase must be the dictionary's own words from the same section;
//! - every year is read from a label or from one of the dictionary's two
//!   charts of significant dates;
//! - no chapter may sit in two ranges.
//!
//! The build fails if any of these does not hold.
//!
//! Entries in the config:
//! - an era: `id`, `name` (the dictionary's heading), `article`, `heading`,
//!   `quote`, optional `from` and `to`, optional `views`;
//! - an era date: `{ "event" }` (a row of a date chart) or
//!   `{ "label", "quote", "article", "heading"?, "era"? }`; a missing end means
//!   the dictionary gives no date. Either form may add `hedge`, a sentence of
//!   the era's own section that qualifies that year ("probably", "about"): the
//!   end is then approximate, and the reader leaves the era's years off the line;
//! - a range: `book`, `from`, `to` (chapters), `era`, and either a quotation
//!   (`article`, `heading`?, `quote`) or a row of a TBD chart (`chart`, `row`:
//!   the row's first cell), whose `?bref=` links must reach every chapter;
//! - a view (of an era, or `written` for a book): `quote`, `article`?,
//!   `heading`?, `who`? (the dictionary's own phrase), and either `label` (with
//!   `era` when the label gives a bare year or century) or `"undated": true`.
//!   `"prefers": true` needs `prefersQuote`, the dictionary's own words stating
//!   the preference. A label that holds a number but is not a date needs
//!   `"relative": true` and a `why`. A book's view may name the chapters it is
//!   about, `"chapters": [[1, 8]]`, when the dictionary dates parts of the book
//!   separately; a view without chapters is about the whole book. The reader
//!   shows, for each chapter, only the views that are about it;
//! - a book: `article`, `written`, and `"stages": true` when its views are
//!   stages of writing rather than alternatives (the reader then never joins
//!   them with "or").
//!
//! The XML is scanned by hand: `<item typename="Article">` elements, their
//! `<title>`, and every `<p>` inside (an `h2` starts a section; `h1`, `toc`,
//! `h2-preview` and `preview-*` are not body text), plus the `<tr>`, `<td>`
//! and `?bref=` links of `<item typename="Chart">` tables.

use crate::loaded::Loaded;
use crate::sources::Inputs;
use atlas_core::canon::{by_osis, by_step};
use atlas_core::{Versification, BOOKS};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::Path;

const SOURCE: &str = "tyndale-tbd";
const LETTER_FILES: [&str; 25] = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S",
    "T", "U", "V", "W", "XY", "Z",
];
const MAX_BYTES: usize = 120 * 1024;
const LICENSE: &str = "CC BY-SA 4.0";
const README_LICENSE: &str = "Creative Commons Attribution-ShareAlike 4.0";
const ATTRIBUTION: &str = "Adapted from Tyndale Open Bible Dictionary";
/// What this project changed, as NOTICE.md states it.
const CHANGES: &str = "Short quotations are taken word for word from the dictionary's articles; date labels are cut from those quotations; years are read from the labels and from the charts \"Significant Old Testament Events and Dates\" and \"Significant New Testament Events and Dates\"; the chart's reference for Abraham's birth is corrected from Gn 26:5 to Gen 21:5; chapters are assigned to the dictionary's eras by hand in config/eras.json, each assignment backed by a quotation or by a row of the chart \"Books of Postexilic Times\"; where the dictionary dates parts of a book separately, each dating view is tied by hand to the chapters it is about.";
/// Book names in TBD's `?bref=` links that are neither OSIS nor STEP ids.
const TBD_BOOKS: [(&str, &str); 1] = [("Hagg", "Hag")];

// --- config/eras.json -------------------------------------------------------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    _comment: Option<String>,
    charts: Vec<ChartSpec>,
    eras: Vec<EraSpec>,
    ranges: Vec<RangeSpec>,
    books: BTreeMap<String, BookSpec>,
    #[serde(default)]
    corrections: Vec<Correction>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ChartSpec {
    id: String,
    name: String,
    era: String,
    cells: Vec<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EraSpec {
    id: String,
    name: String,
    article: String,
    heading: Option<String>,
    from: Option<DateSpec>,
    to: Option<DateSpec>,
    quote: String,
    #[serde(default)]
    views: Vec<ViewSpec>,
}

/// Either `{ "event" }` (a row of a date chart) or `{ "label", "quote", "article", "heading"?, "era"? }`,
/// with an optional `hedge`.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DateSpec {
    event: Option<String>,
    label: Option<String>,
    quote: Option<String>,
    article: Option<String>,
    heading: Option<String>,
    era: Option<String>,
    /// A sentence of the era's own section that qualifies this year.
    hedge: Option<String>,
}

/// A dating view: of an era (`views`) or of when a book was written (`written`).
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ViewSpec {
    who: Option<String>,
    label: Option<String>,
    era: Option<String>,
    #[serde(default)]
    prefers: bool,
    #[serde(rename = "prefersQuote")]
    prefers_quote: Option<String>,
    #[serde(default)]
    relative: bool,
    why: Option<String>,
    #[serde(default)]
    undated: bool,
    article: Option<String>,
    heading: Option<String>,
    quote: String,
    /// Book views only: the chapters the view is about, as `[first, last]`
    /// pairs in order. Without it the view is about the whole book.
    chapters: Option<Vec<[u16; 2]>>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RangeSpec {
    book: String,
    from: u16,
    to: u16,
    era: String,
    article: Option<String>,
    heading: Option<String>,
    quote: Option<String>,
    chart: Option<String>,
    row: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct BookSpec {
    article: String,
    #[serde(default)]
    stages: bool,
    written: Vec<ViewSpec>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Correction {
    chart: String,
    event: String,
    basis: Basis,
    why: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Basis {
    from: String,
    to: String,
}

// --- Reading TBD ------------------------------------------------------------

/// Strip tags, decode entities, turn every run of whitespace (U+00A0 included)
/// into one space, and trim. Curly quotes and dashes are kept as they are.
fn normalize(raw: &str) -> String {
    let mut text = String::with_capacity(raw.len());
    let mut in_tag = false;
    for c in raw.chars() {
        match c {
            '<' => in_tag = true,
            '>' if in_tag => in_tag = false,
            c if !in_tag => text.push(c),
            _ => {}
        }
    }
    decode_entities(&text)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// `&amp; &lt; &gt; &quot; &apos; &#N; &#xN;`; anything else is left as written.
fn decode_entities(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(i) = rest.find('&') {
        out.push_str(&rest[..i]);
        rest = &rest[i..];
        let decoded = rest.find(';').filter(|&j| j <= 10).and_then(|j| {
            let name = &rest[1..j];
            let c = match name {
                "amp" => Some('&'),
                "lt" => Some('<'),
                "gt" => Some('>'),
                "quot" => Some('"'),
                "apos" => Some('\''),
                _ => name
                    .strip_prefix("#x")
                    .or_else(|| name.strip_prefix("#X"))
                    .and_then(|h| u32::from_str_radix(h, 16).ok())
                    .or_else(|| name.strip_prefix('#').and_then(|d| d.parse().ok()))
                    .and_then(char::from_u32),
            };
            c.map(|c| (c, j))
        });
        match decoded {
            Some((c, j)) => {
                out.push(c);
                rest = &rest[j + 1..];
            }
            None => {
                out.push('&');
                rest = &rest[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

/// `key="value"` pairs from the inside of a start tag, in any order.
fn parse_attrs(s: &str) -> Vec<(&str, &str)> {
    let mut out = Vec::new();
    let mut rest = s;
    loop {
        rest = rest.trim_start();
        let Some(eq) = rest.find('=') else { break };
        let key = rest[..eq].trim();
        let Some(value) = rest[eq + 1..].trim_start().strip_prefix('"') else {
            break;
        };
        let Some(end) = value.find('"') else { break };
        out.push((key, &value[..end]));
        rest = &value[end + 1..];
    }
    out
}

fn attr<'a>(attrs: &[(&'a str, &'a str)], key: &str) -> Option<&'a str> {
    attrs.iter().find(|(k, _)| *k == key).map(|(_, v)| *v)
}

type Element<'a> = (Vec<(&'a str, &'a str)>, &'a str);

/// Every `<tag …>…</tag>` and self-closing `<tag …/>` in `s`: its attributes
/// and raw inner text. TBD never nests these elements.
fn elements<'a>(s: &'a str, tag: &str) -> Vec<Element<'a>> {
    let open = format!("<{tag}");
    let close = format!("</{tag}>");
    let mut out = Vec::new();
    let mut pos = 0;
    while let Some(i) = s[pos..].find(&open) {
        let start = pos + i + open.len();
        // The whole tag name: `<p>` or `<p …>`, never `<pre>`.
        if !s[start..].starts_with(|c: char| c == '>' || c == '/' || c.is_whitespace()) {
            pos = start;
            continue;
        }
        let Some(gt) = s[start..].find('>') else {
            break;
        };
        let head = &s[start..start + gt];
        let after = start + gt + 1;
        if head.ends_with('/') {
            out.push((parse_attrs(head), ""));
            pos = after;
            continue;
        }
        let Some(end) = s[after..].find(&close) else {
            break;
        };
        out.push((parse_attrs(head), &s[after..after + end]));
        pos = after + end + close.len();
    }
    out
}

/// An item's `<title>`, without TBD's "*" markers.
fn title_of(body: &str) -> String {
    elements(body, "title")
        .first()
        .map(|(_, t)| normalize(&t.replace('*', "")))
        .unwrap_or_default()
}

struct Article {
    title: String,
    /// (heading, body paragraphs); the lead section comes first, with heading "".
    sections: Vec<(String, Vec<String>)>,
}

fn read_articles(xml: &str, into: &mut HashMap<String, Article>) -> Result<(), String> {
    for (attrs, body) in elements(xml, "item") {
        if attr(&attrs, "typename") != Some("Article") {
            continue;
        }
        let name = attr(&attrs, "name").ok_or("a TBD article has no name")?;
        let mut sections = vec![(String::new(), Vec::new())];
        for (pa, p) in elements(body, "p") {
            let class = attr(&pa, "class").unwrap_or("");
            if matches!(class, "h1" | "toc" | "h2-preview") || class.starts_with("preview-") {
                continue;
            }
            let text = normalize(p);
            if class == "h2" {
                sections.push((text, Vec::new()));
            } else if let Some(last) = sections.last_mut() {
                last.1.push(text);
            }
        }
        if into
            .insert(
                name.to_string(),
                Article {
                    title: title_of(body),
                    sections,
                },
            )
            .is_some()
        {
            return Err(format!("TBD has two articles named {name}"));
        }
    }
    Ok(())
}

struct ChartRow {
    cells: Vec<String>,
    links: Vec<String>,
}

struct Chart {
    title: String,
    rows: Vec<ChartRow>,
}

fn read_charts(xml: &str) -> HashMap<String, Chart> {
    let mut out = HashMap::new();
    for (attrs, body) in elements(xml, "item") {
        if attr(&attrs, "typename") != Some("Chart") {
            continue;
        }
        let Some(name) = attr(&attrs, "name") else {
            continue;
        };
        let rows = elements(body, "tr")
            .into_iter()
            .map(|(_, tr)| ChartRow {
                cells: elements(tr, "td")
                    .into_iter()
                    .map(|(_, td)| normalize(td))
                    .collect(),
                links: bref_links(tr),
            })
            .collect();
        out.insert(
            name.to_string(),
            Chart {
                title: title_of(body),
                rows,
            },
        );
    }
    out
}

/// The targets of `href="?bref=…"` links, in order.
fn bref_links(s: &str) -> Vec<String> {
    const KEY: &str = "href=\"?bref=";
    let mut out = Vec::new();
    let mut rest = s;
    while let Some(i) = rest.find(KEY) {
        rest = &rest[i + KEY.len()..];
        let end = rest.find('"').unwrap_or(rest.len());
        out.push(rest[..end].to_string());
        rest = &rest[end..];
    }
    out
}

/// `Ezra.1.1-4.6` -> (book, first chapter, last chapter).
fn bref_chapters(link: &str) -> Option<(u8, u16, u16)> {
    let (book, rest) = link.split_once('.')?;
    let b = by_osis(book).or_else(|| by_step(book)).or_else(|| {
        TBD_BOOKS
            .iter()
            .find(|(k, _)| *k == book)
            .and_then(|(_, osis)| by_osis(osis))
    })?;
    let (start, end) = match rest.split_once('-') {
        Some((a, z)) => (a, Some(z)),
        None => (rest, None),
    };
    let c1: u16 = start.split('.').next()?.parse().ok()?;
    let c2: u16 = match end {
        Some(z) if z.contains('.') => z.split('.').next()?.parse().ok()?,
        _ => c1,
    };
    Some((b, c1, c2))
}

/// `needle` occurs in `hay` with no letter or digit touching either end.
fn contains_phrase(hay: &str, needle: &str) -> bool {
    if needle.is_empty() {
        return false;
    }
    hay.match_indices(needle).any(|(i, _)| {
        let before = hay[..i].chars().next_back();
        let after = hay[i + needle.len()..].chars().next();
        !before.is_some_and(char::is_alphanumeric) && !after.is_some_and(char::is_alphanumeric)
    })
}

#[derive(Clone)]
struct Cite {
    article: String,
    title: String,
    heading: Option<String>,
}

impl Cite {
    fn json(&self) -> Value {
        json!({ "article": self.article, "title": self.title, "heading": self.heading })
    }
}

struct Tbd {
    articles: HashMap<String, Article>,
    charts: HashMap<String, Chart>,
}

impl Tbd {
    fn open(inputs: &Inputs) -> Result<Self, String> {
        let mut articles = HashMap::new();
        for key in LETTER_FILES {
            let p = inputs.path(SOURCE, key);
            let xml =
                fs::read_to_string(&p).map_err(|e| format!("reading {}: {e}", p.display()))?;
            read_articles(&xml, &mut articles)?;
        }
        let p = inputs.path(SOURCE, "charts");
        let xml = fs::read_to_string(&p).map_err(|e| format!("reading {}: {e}", p.display()))?;
        Ok(Self {
            articles,
            charts: read_charts(&xml),
        })
    }

    /// The body paragraphs a quotation from `article` (section `heading`) may come from.
    fn pool(&self, article: &str, heading: Option<&str>) -> Result<(Cite, Vec<&str>), String> {
        let a = self
            .articles
            .get(article)
            .ok_or_else(|| format!("TBD has no article named {article}"))?;
        if let Some(h) = heading {
            if !a.sections.iter().any(|(s, _)| s == h) {
                return Err(format!("{article} has no section headed {h:?}"));
            }
        }
        let paras = a
            .sections
            .iter()
            .filter(|(s, _)| heading.is_none_or(|h| s == h))
            .flat_map(|(_, ps)| ps.iter().map(String::as_str))
            .collect();
        let cite = Cite {
            article: article.to_string(),
            title: a.title.clone(),
            heading: heading.map(str::to_string),
        };
        Ok((cite, paras))
    }
}

fn place(article: &str, heading: Option<&str>) -> String {
    match heading {
        Some(h) => format!("{article} › {h}"),
        None => article.to_string(),
    }
}

/// Counts every quotation checked against the dictionary.
struct Checker<'a> {
    tbd: &'a Tbd,
    quotes: usize,
}

impl Checker<'_> {
    /// `quote` must be a substring of one body paragraph of the article (or section).
    fn quote(&mut self, article: &str, heading: Option<&str>, quote: &str) -> Result<Cite, String> {
        let (cite, paras) = self.tbd.pool(article, heading)?;
        self.quotes += 1;
        if quote.is_empty() || quote.trim() != quote {
            return Err(format!(
                "the quotation {quote:?} is empty or starts or ends with a space"
            ));
        }
        if !paras.iter().any(|p| p.contains(quote)) {
            return Err(format!(
                "quotation not found word for word in {}: {quote:?}",
                place(article, heading)
            ));
        }
        Ok(cite)
    }

    /// A who phrase or a preference sentence: the dictionary's own words, in the same section.
    fn words(
        &mut self,
        article: &str,
        heading: Option<&str>,
        what: &str,
        words: &str,
        count: bool,
    ) -> Result<(), String> {
        let (_, paras) = self.tbd.pool(article, heading)?;
        if count {
            self.quotes += 1;
        }
        if words.trim() != words || !paras.iter().any(|p| contains_phrase(p, words)) {
            return Err(format!(
                "{what} {words:?} is not the dictionary's own words in {}",
                place(article, heading)
            ));
        }
        Ok(())
    }
}

// --- Date labels ------------------------------------------------------------

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Era {
    Bc,
    Ad,
}

impl Era {
    fn parse(s: &str) -> Result<Era, String> {
        match s {
            "BC" => Ok(Era::Bc),
            "AD" => Ok(Era::Ad),
            _ => Err(format!("an era is \"BC\" or \"AD\", not {s:?}")),
        }
    }

    fn year(self, n: i32) -> i32 {
        match self {
            Era::Bc => -n,
            Era::Ad => n,
        }
    }
}

/// The years a label covers, BC negative, either side possibly open.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Span {
    from: Option<i32>,
    to: Option<i32>,
    approx: bool,
}

fn point(y: i32) -> Span {
    Span {
        from: Some(y),
        to: Some(y),
        approx: false,
    }
}

fn range(a: i32, b: i32) -> Option<Span> {
    (a <= b).then_some(Span {
        from: Some(a),
        to: Some(b),
        approx: false,
    })
}

fn approx(s: Span, yes: bool) -> Span {
    Span {
        approx: s.approx || yes,
        ..s
    }
}

/// The earliest start and the latest end of two spans.
fn union(a: Span, b: Span) -> Span {
    let pick = |x: Option<i32>, y: Option<i32>, f: fn(i32, i32) -> i32| match (x, y) {
        (Some(x), Some(y)) => Some(f(x, y)),
        (x, y) => x.or(y),
    };
    Span {
        from: pick(a.from, b.from, i32::min),
        to: pick(a.to, b.to, i32::max),
        approx: a.approx || b.approx,
    }
}

#[derive(Clone, Debug, PartialEq)]
enum Tok {
    Word(String),
    Num(i32),
    /// 14th, 23d
    Ord(i32),
    /// 60s
    Decade(i32),
    Dash,
    Slash,
    Open,
    Close,
    Dot,
    Mark,
}

const ORDINALS: [&str; 20] = [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
    "eleventh",
    "twelfth",
    "thirteenth",
    "fourteenth",
    "fifteenth",
    "sixteenth",
    "seventeenth",
    "eighteenth",
    "nineteenth",
    "twentieth",
];

fn ordinal_word(w: &str) -> Option<i32> {
    ORDINALS.iter().position(|o| *o == w).map(|i| i as i32 + 1)
}

fn tokens(s: &str) -> Vec<Tok> {
    let cs: Vec<char> = s.chars().collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i < cs.len() {
        let c = cs[i];
        if c.is_whitespace() {
            i += 1;
        } else if c.is_ascii_digit() {
            let st = i;
            while i < cs.len() && cs[i].is_ascii_digit() {
                i += 1;
            }
            let n: i32 = cs[st..i]
                .iter()
                .collect::<String>()
                .parse()
                .unwrap_or(i32::MAX);
            let sf = i;
            while i < cs.len() && cs[i].is_alphabetic() {
                i += 1;
            }
            let suffix: String = cs[sf..i].iter().collect();
            out.push(match suffix.as_str() {
                "" => Tok::Num(n),
                "st" | "nd" | "rd" | "th" | "d" => Tok::Ord(n),
                "s" if n % 10 == 0 => Tok::Decade(n),
                _ => Tok::Mark,
            });
        } else if c.is_alphabetic() {
            let st = i;
            while i < cs.len()
                && (cs[i].is_alphabetic()
                    || ((cs[i] == '’' || cs[i] == '\'')
                        && cs.get(i + 1).is_some_and(|n| n.is_alphabetic())))
            {
                i += 1;
            }
            out.push(Tok::Word(
                cs[st..i].iter().collect::<String>().to_lowercase(),
            ));
        } else {
            out.push(match c {
                '–' | '-' | '—' => Tok::Dash,
                '/' => Tok::Slash,
                '(' => Tok::Open,
                ')' => Tok::Close,
                '.' => Tok::Dot,
                _ => Tok::Mark,
            });
            i += 1;
        }
    }
    out
}

fn is(t: &Tok, word: &str) -> bool {
    matches!(t, Tok::Word(x) if x == word)
}

fn ord(t: &Tok) -> Option<i32> {
    match t {
        Tok::Ord(n) => Some(*n),
        Tok::Word(w) => ordinal_word(w),
        _ => None,
    }
}

/// `t` without the leading words `ws`, if it starts with them.
fn strip<'a>(t: &'a [Tok], ws: &[&str]) -> Option<&'a [Tok]> {
    (t.len() >= ws.len() && t.iter().zip(ws).all(|(a, b)| is(a, b))).then(|| &t[ws.len()..])
}

/// True when a label states a year or a century: a digit or an ordinal word.
fn holds_date(label: &str) -> bool {
    label.chars().any(|c| c.is_ascii_digit()) || tokens(label).iter().any(|t| ord(t).is_some())
}

/// Words only: the free text around a date ("the fall of Jerusalem").
fn free_text(t: &[Tok]) -> bool {
    !t.is_empty() && t.iter().all(|x| matches!(x, Tok::Word(_) | Tok::Mark))
}

/// about, around, c., roughly, approximately.
fn qualifier(t: &[Tok]) -> (bool, &[Tok]) {
    for q in ["about", "around", "roughly", "approximately"] {
        if let Some(r) = strip(t, &[q]) {
            return (true, r);
        }
    }
    match t {
        [Tok::Word(c), Tok::Dot, r @ ..] if c == "c" => (true, r),
        _ => (false, t),
    }
}

/// `N`, `N–M`, `N-M`, `N/M` or `N or M` in one era.
fn pair(t: &[Tok], era: Era) -> Option<Span> {
    match t {
        [Tok::Num(a)] => Some(point(era.year(*a))),
        [Tok::Num(a), Tok::Dash | Tok::Slash, Tok::Num(b)] => range(era.year(*a), era.year(*b)),
        [Tok::Num(a), Tok::Word(or), Tok::Num(b)] if or == "or" => {
            range(era.year(*a), era.year(*b))
        }
        _ => None,
    }
}

/// `AD N…`, `N… BC` or a bare `N…` in the entry's era, after an optional qualifier.
fn years(t: &[Tok], era: Option<Era>) -> Option<Span> {
    let (q, t) = qualifier(t);
    let s = if let Some(r) = strip(t, &["ad"]) {
        pair(r, Era::Ad)
    } else if let [r @ .., Tok::Word(bc)] = t {
        if bc == "bc" {
            pair(r, Era::Bc)
        } else {
            None
        }
    } else {
        pair(t, era?)
    };
    s.map(|s| approx(s, q))
}

/// One year written `N`, `N BC` or `AD N`, in era `e`.
fn one_year(t: &[Tok], e: Era) -> Option<i32> {
    match t {
        [Tok::Num(n)] => Some(e.year(*n)),
        [Tok::Num(n), Tok::Word(x)] if x == "bc" && e == Era::Bc => Some(-n),
        [Tok::Word(x), Tok::Num(n)] if x == "ad" && e == Era::Ad => Some(*n),
        _ => None,
    }
}

/// `N and M BC`, `N BC and M BC`, `AD N and M`, `N and M` (also with "to").
fn two_years(a: &[Tok], b: &[Tok], era: Option<Era>) -> Option<Span> {
    let e = if a.first().is_some_and(|x| is(x, "ad")) {
        Era::Ad
    } else if b.last().is_some_and(|x| is(x, "bc")) {
        Era::Bc
    } else {
        era?
    };
    range(one_year(a, e)?, one_year(b, e)?)
}

/// `between N and M …`, after an optional qualifier.
fn between(t: &[Tok], era: Option<Era>) -> Option<Span> {
    let (q, t) = qualifier(t);
    let r = strip(t, &["between"])?;
    let k = r.iter().position(|x| is(x, "and"))?;
    two_years(&r[..k], &r[k + 1..], era).map(|s| approx(s, q))
}

/// `from N to M …`.
fn from_to(t: &[Tok], era: Option<Era>) -> Option<Span> {
    let r = strip(t, &["from"])?;
    let k = r.iter().position(|x| is(x, "to"))?;
    two_years(&r[..k], &r[k + 1..], era)
}

/// One-sided and point forms: by, before, prior to, pre–, on or before, after,
/// from, and shortly/just/soon after or before.
fn bounded(t: &[Tok], era: Option<Era>) -> Option<Span> {
    for lead in [
        &["shortly", "after"][..],
        &["just", "after"],
        &["soon", "after"],
    ] {
        if let Some(r) = strip(t, lead) {
            let y = years(r, era)?;
            return Some(Span {
                from: y.to,
                to: y.to,
                approx: true,
            });
        }
    }
    for lead in [&["shortly", "before"][..], &["just", "before"]] {
        if let Some(r) = strip(t, lead) {
            let y = years(r, era)?;
            return Some(Span {
                from: y.from,
                to: y.from,
                approx: true,
            });
        }
    }
    for lead in [&["on", "or", "before"][..], &["before"], &["prior", "to"]] {
        if let Some(r) = strip(t, lead) {
            let y = years(r, era)?;
            return Some(Span {
                from: None,
                to: y.from,
                approx: y.approx,
            });
        }
    }
    if let Some(r) = strip(t, &["by"]) {
        let y = years(r, era)?;
        return Some(Span {
            from: None,
            to: y.to,
            approx: y.approx,
        });
    }
    if let [Tok::Word(pre), Tok::Dash, r @ ..] = t {
        if pre == "pre" {
            let y = years(r, era)?;
            return Some(Span {
                from: None,
                to: y.from,
                approx: y.approx,
            });
        }
    }
    if let Some(r) = strip(t, &["after"]) {
        let y = years(r, era)?;
        return Some(Span {
            from: y.to,
            to: None,
            approx: y.approx,
        });
    }
    if let Some(r) = strip(t, &["from"]) {
        let y = years(r, era)?;
        return Some(Span {
            from: y.from,
            to: None,
            approx: y.approx,
        });
    }
    None
}

/// Years `lo..=hi` of the decade starting at `d` ("the 60s" is 60–69).
fn decade(e: Era, d: i32, lo: i32, hi: i32) -> Option<Span> {
    match e {
        Era::Ad => range(d + lo, d + hi),
        Era::Bc => range(-(d + 9 - lo), -(d + 9 - hi)),
    }
}

/// `in the 60s`, `early 60s`, `in the 40s or 50s`, `early in the year 50`.
fn decades(t: &[Tok], era: Option<Era>) -> Option<Span> {
    let e = era?;
    if let Some([Tok::Num(n)]) = strip(t, &["early", "in", "the", "year"]) {
        return Some(point(e.year(*n)));
    }
    let t = strip(t, &["in", "the"]).unwrap_or(t);
    match t {
        [Tok::Decade(d)] => decade(e, *d, 0, 9),
        [Tok::Word(early), Tok::Decade(d)] if early == "early" => {
            decade(e, *d, 0, 3).map(|s| approx(s, true))
        }
        [Tok::Decade(a), Tok::Word(or), Tok::Decade(b)] if or == "or" => {
            Some(union(decade(e, *a, 0, 9)?, decade(e, *b, 0, 9)?))
        }
        _ => None,
    }
}

#[derive(Clone, Copy)]
enum Part {
    Whole,
    Around,
    First(i32),
    Last(i32),
    LastAround(i32),
    Middle,
}

const CENTURY_PARTS: [(&[&str], Part); 15] = [
    (&["the", "last", "decade", "of"], Part::Last(10)),
    (&["the", "last", "quarter", "of"], Part::Last(25)),
    (&["the", "last", "part", "of"], Part::LastAround(50)),
    (&["near", "the", "end", "of"], Part::Last(20)),
    (&["close", "to", "the", "end", "of"], Part::Last(20)),
    (&["toward", "the", "end", "of"], Part::Last(20)),
    (&["at", "the", "end", "of"], Part::Last(20)),
    (&["the", "end", "of"], Part::Last(20)),
    (&["early", "in"], Part::First(20)),
    (&["the", "early"], Part::First(20)),
    (&["the", "latter", "half", "of"], Part::Last(50)),
    (&["the", "second", "half", "of"], Part::Last(50)),
    (&["the", "first", "half", "of"], Part::First(50)),
    (&["the", "middle", "of"], Part::Middle),
    (&["well", "into"], Part::Around),
];

/// The Nth century BC is [-100N, -100(N-1)-1]; the Nth century AD is [100(N-1)+1, 100N].
fn century(n: i32, e: Era, part: Part) -> Option<Span> {
    let (start, end) = match e {
        Era::Bc => (-100 * n, -100 * (n - 1) - 1),
        Era::Ad => (100 * (n - 1) + 1, 100 * n),
    };
    let (from, to, around) = match part {
        Part::Whole => (start, end, false),
        Part::Around => (start, end, true),
        Part::First(k) => (start, start + k - 1, false),
        Part::Last(k) => (end - k + 1, end, false),
        Part::LastAround(k) => (end - k + 1, end, true),
        Part::Middle => (start + 40, start + 59, false),
    };
    range(from, to).map(|s| approx(s, around))
}

/// `[the] Nth[-]century|centuries [BC|AD]`; `bare` also accepts `[the] Nth [BC|AD]`.
fn century_base(t: &[Tok], era: Option<Era>, bare: bool) -> Option<(i32, Era)> {
    let t = strip(t, &["the"]).unwrap_or(t);
    let (first, mut r) = t.split_first()?;
    let n = ord(first)?;
    if let [Tok::Dash, rest @ ..] = r {
        r = rest;
    }
    let mut named = false;
    if let [Tok::Word(c), rest @ ..] = r {
        if c == "century" || c == "centuries" {
            named = true;
            r = rest;
        }
    }
    if !(named || bare) || !(1..=30).contains(&n) {
        return None;
    }
    let e = match r {
        [] => era?,
        [Tok::Word(x)] if x == "bc" => Era::Bc,
        [Tok::Word(x)] if x == "ad" => Era::Ad,
        _ => return None,
    };
    Some((n, e))
}

/// One century with an optional part ("the last decade of", "mid-", …) and qualifier.
fn one_century(t: &[Tok], era: Option<Era>, bare: bool) -> Option<Span> {
    let (q, t) = qualifier(t);
    let (part, rest) = match CENTURY_PARTS
        .iter()
        .find_map(|(ws, p)| strip(t, ws).map(|r| (*p, r)))
    {
        Some(found) => found,
        None => match t {
            [Tok::Word(mid), Tok::Dash, r @ ..] if mid == "mid" => (Part::Middle, r),
            _ => (Part::Whole, t),
        },
    };
    let (n, e) = century_base(rest, era, bare)?;
    century(n, e, part).map(|s| approx(s, q))
}

fn trailing_era(t: &[Tok]) -> Option<Era> {
    match t.last() {
        Some(x) if is(x, "bc") => Some(Era::Bc),
        Some(x) if is(x, "ad") => Some(Era::Ad),
        _ => None,
    }
}

/// Centuries: one, `C1 or C2` and `from the Nth to the Mth centuries`. An era
/// written at the end applies to both, and C2 may leave out "century".
fn centuries(t: &[Tok], era: Option<Era>) -> Option<Span> {
    if let Some(k) = t.iter().position(|x| is(x, "or")) {
        let e = trailing_era(&t[k + 1..]).or(era);
        return Some(union(
            one_century(&t[..k], e, true)?,
            one_century(&t[k + 1..], e, true)?,
        ));
    }
    if let Some(r) = strip(t, &["from"]) {
        let k = r.iter().position(|x| is(x, "to"))?;
        let e = trailing_era(&r[k + 1..]).or(era);
        return Some(union(
            one_century(&r[..k], e, true)?,
            one_century(&r[k + 1..], e, true)?,
        ));
    }
    one_century(t, era, false)
}

/// How the words before a date in a phrase bend it.
fn lead_in(head: &[Tok], inner: Span) -> Span {
    let starts = |ws: &[&str]| strip(head, ws).is_some();
    if starts(&["shortly", "after"])
        || starts(&["just", "after"])
        || starts(&["soon", "after"])
        || starts(&["at", "the", "close", "of"])
        || starts(&["the", "close", "of"])
    {
        Span {
            from: inner.to,
            to: inner.to,
            approx: true,
        }
    } else if starts(&["shortly", "before"]) || starts(&["just", "before"]) {
        Span {
            from: inner.from,
            to: inner.from,
            approx: true,
        }
    } else if starts(&["before"]) || starts(&["prior", "to"]) {
        Span {
            from: None,
            to: inner.from,
            approx: inner.approx,
        }
    } else if starts(&["after"]) {
        Span {
            from: inner.to,
            to: None,
            approx: inner.approx,
        }
    } else {
        approx(inner, true)
    }
}

/// `<words> (<date>)`, `<words> in <date>`, and `<date> (<words>)`.
fn phrase(t: &[Tok], era: Option<Era>) -> Option<Span> {
    if t.last() == Some(&Tok::Close) {
        let open = t.iter().rposition(|x| *x == Tok::Open)?;
        let (head, inner) = (&t[..open], &t[open + 1..t.len() - 1]);
        if free_text(head) {
            if let Some(y) = years(inner, era) {
                return Some(lead_in(head, y));
            }
        }
        if free_text(inner) && !head.is_empty() {
            return form(head, era);
        }
        return None;
    }
    let k = t.iter().rposition(|x| is(x, "in"))?;
    let (head, tail) = (&t[..k], &t[k + 1..]);
    if free_text(head) {
        return years(tail, era).map(|y| lead_in(head, y));
    }
    None
}

/// Every single (not compound) form.
fn form(t: &[Tok], era: Option<Era>) -> Option<Span> {
    years(t, era)
        .or_else(|| between(t, era))
        .or_else(|| from_to(t, era))
        .or_else(|| bounded(t, era))
        .or_else(|| decades(t, era))
        .or_else(|| centuries(t, era))
        .or_else(|| phrase(t, era))
}

/// The second half of a compound may lead in with words: "the conquest about 1400 BC".
fn side(t: &[Tok], era: Option<Era>) -> Option<Span> {
    form(t, era).or_else(|| {
        (1..t.len()).find_map(|k| match qualifier(&t[k..]) {
            (true, _) if free_text(&t[..k]) => years(&t[k..], era),
            _ => None,
        })
    })
}

/// `<A> and <B>`: from the earliest to the latest year either gives.
fn compound(t: &[Tok], era: Option<Era>) -> Option<Span> {
    let mut depth = 0;
    for (k, x) in t.iter().enumerate() {
        match x {
            Tok::Open => depth += 1,
            Tok::Close => depth -= 1,
            x if depth == 0 && is(x, "and") && k > 0 => {
                if let (Some(a), Some(b)) = (form(&t[..k], era), side(&t[k + 1..], era)) {
                    return Some(union(a, b));
                }
            }
            _ => {}
        }
    }
    None
}

/// Read a date label. `Ok(None)` means it states no year or century, so it is
/// relative. A label that holds a digit or an ordinal word but matches no form
/// is an error.
fn parse_label(label: &str, era: Option<Era>) -> Result<Option<Span>, String> {
    if !holds_date(label) {
        return Ok(None);
    }
    let t = tokens(label);
    let has = |w: &str| t.iter().any(|x| is(x, w));
    if let Some(e) = era {
        if (e == Era::Bc && has("ad")) || (e == Era::Ad && has("bc")) {
            return Err(format!("the label {label:?} contradicts its era"));
        }
    }
    if let Some(s) = form(&t, era).or_else(|| compound(&t, era)) {
        return Ok(Some(s));
    }
    if era.is_none()
        && !has("bc")
        && !has("ad")
        && form(&t, Some(Era::Bc))
            .or_else(|| compound(&t, Some(Era::Bc)))
            .is_some()
    {
        return Err(format!(
            "the label {label:?} needs \"era\": \"BC\" or \"AD\""
        ));
    }
    Err(format!(
        "the label {label:?} holds a number or an ordinal but is not a date form this build reads; if it is not a date, mark the entry \"relative\": true with a \"why\""
    ))
}

/// "930–722 BC", "AD 30–50", "6 BC – AD 30", "1446 BC", "AD 70".
fn format_years(from: i32, to: i32) -> String {
    if from == to {
        if from < 0 {
            format!("{} BC", -from)
        } else {
            format!("AD {from}")
        }
    } else if to < 0 {
        format!("{}–{} BC", -from, -to)
    } else if from > 0 {
        format!("AD {from}–{to}")
    } else {
        format!("{} BC – AD {to}", -from)
    }
}

// --- Charts -----------------------------------------------------------------

struct Event {
    chart: String,
    chart_title: String,
    event: String,
    span: Span,
    /// The Greek-text year, where the chart gives the Hebrew one first.
    alt: Option<Span>,
    label: String,
    basis: Option<String>,
    corrected: Option<String>,
}

/// A chart's date cell. After the OT chart's "Gk/Heb Text" header row,
/// `1973 (2006)` is the Greek year then the Hebrew year: the Hebrew year is
/// the value and the Greek one the `alt`.
fn chart_date(cell: &str, era: Era, gk_heb: bool) -> Option<(Span, Option<Span>, String)> {
    let t = tokens(cell);
    if gk_heb {
        if let [Tok::Num(gk), Tok::Open, Tok::Num(heb), Tok::Close] = t.as_slice() {
            return Some((
                point(era.year(*heb)),
                Some(point(era.year(*gk))),
                format_years(era.year(*heb), era.year(*heb)),
            ));
        }
    }
    let s = years(&t, Some(era))?;
    let label = if t.iter().any(|x| is(x, "bc") || is(x, "ad")) {
        cell.to_string()
    } else if era == Era::Bc {
        format!("{cell} BC")
    } else if let Some(rest) = cell.strip_prefix("c. ") {
        format!("c. AD {rest}")
    } else {
        format!("AD {cell}")
    };
    Some((s, None, label))
}

fn chart_events(tbd: &Tbd, cfg: &Config) -> Result<Vec<Event>, String> {
    let mut out: Vec<Event> = Vec::new();
    for spec in &cfg.charts {
        let chart = tbd
            .charts
            .get(&spec.name)
            .ok_or_else(|| format!("TBD has no chart named {}", spec.name))?;
        let era = Era::parse(&spec.era)?;
        let col = |k: &str| spec.cells.iter().position(|c| c == k);
        let (ev, date) = (
            col("event").ok_or("a chart needs an event cell")?,
            col("date").ok_or("a chart needs a date cell")?,
        );
        let basis = col("basis");
        let mut gk_heb = false;
        let before = out.len();
        for row in &chart.rows {
            let cell = |i: usize| row.cells.get(i).map(String::as_str).unwrap_or("");
            if cell(date) == "Gk/Heb Text" {
                gk_heb = true;
                continue;
            }
            if !cell(date).chars().any(|c| c.is_ascii_digit()) {
                continue; // a header row
            }
            let (span, alt, label) = chart_date(cell(date), era, gk_heb).ok_or_else(|| {
                format!("chart {}: cannot read the date {:?}", spec.name, cell(date))
            })?;
            let event = cell(ev).to_string();
            if event.is_empty() || out.iter().any(|e| e.event == event) {
                return Err(format!(
                    "chart {}: the event {event:?} is empty or appears twice",
                    spec.name
                ));
            }
            out.push(Event {
                chart: spec.id.clone(),
                chart_title: chart.title.clone(),
                event,
                span,
                alt,
                label,
                basis: basis.map(|b| cell(b).to_string()).filter(|b| !b.is_empty()),
                corrected: None,
            });
        }
        if out.len() == before {
            return Err(format!("chart {} has no dated rows", spec.name));
        }
    }
    for c in &cfg.corrections {
        let e = out
            .iter_mut()
            .find(|e| e.chart == c.chart && e.event == c.event)
            .ok_or_else(|| format!("correction: no event {:?} in chart {}", c.event, c.chart))?;
        if e.basis.as_deref() != Some(c.basis.from.as_str()) {
            return Err(format!(
                "correction for {:?}: the chart now reads {:?}, not {:?}; review the correction",
                c.event, e.basis, c.basis.from
            ));
        }
        if c.why.trim().is_empty() {
            return Err(format!("correction for {:?} needs a \"why\"", c.event));
        }
        e.corrected = e.basis.replace(c.basis.to.clone());
    }
    Ok(out)
}

// --- Building eras.json -----------------------------------------------------

#[derive(PartialEq)]
enum Side {
    From,
    To,
}

/// One end of an era: its year, and where the year comes from.
struct End {
    year: i32,
    approx: bool,
    src: Value,
}

/// One end of an era. `home` is the era's own article and section, where a
/// `hedge` must be found.
fn era_end(
    ck: &mut Checker,
    events: &[Event],
    d: &DateSpec,
    side: Side,
    home: (&str, Option<&str>),
) -> Result<End, String> {
    if let Some(h) = &d.hedge {
        ck.quote(home.0, home.1, h)
            .map_err(|e| format!("hedge: {e}"))?;
    }
    let hedged = d.hedge.is_some();
    match (&d.event, &d.label) {
        (Some(name), None) => {
            if d.quote.is_some() || d.article.is_some() || d.heading.is_some() || d.era.is_some() {
                return Err("an event date takes no quote, article, heading or era".into());
            }
            let e = events
                .iter()
                .find(|e| &e.event == name)
                .ok_or_else(|| format!("no chart event named {name:?}"))?;
            let year = if side == Side::From {
                e.span.from
            } else {
                e.span.to
            }
            .ok_or("the chart event has no year")?;
            Ok(End {
                year,
                approx: e.span.approx || hedged,
                src: json!({ "event": name, "label": e.label, "chart": e.chart_title, "hedge": d.hedge }),
            })
        }
        (None, Some(label)) => {
            let (quote, article) = (
                d.quote.as_deref().ok_or("a label date needs its quote")?,
                d.article
                    .as_deref()
                    .ok_or("a label date needs its article")?,
            );
            let cite = ck.quote(article, d.heading.as_deref(), quote)?;
            if !contains_phrase(quote, label) {
                return Err(format!(
                    "the label {label:?} is not cut word for word from its quotation"
                ));
            }
            let era = d.era.as_deref().map(Era::parse).transpose()?;
            let span = parse_label(label, era)?
                .ok_or_else(|| format!("the label {label:?} gives no year"))?;
            let year = if side == Side::From {
                span.from
            } else {
                span.to
            }
            .ok_or_else(|| format!("the label {label:?} gives no year for this end"))?;
            Ok(End {
                year,
                approx: span.approx || hedged,
                src: json!({ "label": label, "quote": quote, "cite": cite.json(), "hedge": d.hedge }),
            })
        }
        _ => Err("give a date either an event or a label with its quotation".into()),
    }
}

/// What one checked view looks like in eras.json.
struct View {
    json: Value,
    prefers: bool,
    dated: bool,
    relative: bool,
}

/// A view's chapters: `[first, last]` pairs inside a book of `count`
/// chapters, in order and apart.
fn check_scope(pairs: &[[u16; 2]], count: u16) -> Result<(), String> {
    if pairs.is_empty() {
        return Err("\"chapters\" is empty; leave it out for a view of the whole book".into());
    }
    let mut last = 0;
    for &[a, b] in pairs {
        if a == 0 || a > b || b > count {
            return Err(format!(
                "\"chapters\" [{a}, {b}] is not a span of chapters 1–{count}"
            ));
        }
        if a <= last {
            return Err(format!(
                "\"chapters\" [{a}, {b}] overlaps or comes before the span ending at {last}"
            ));
        }
        last = b;
    }
    Ok(())
}

/// Check one view of an era (`book` is `None`) or of a book of `book`
/// chapters: its quotation, label, who, preference and chapters, and read its
/// years.
fn view(ck: &mut Checker, v: &ViewSpec, article: &str, book: Option<u16>) -> Result<View, String> {
    let era_view = book.is_none();
    match (&v.chapters, book) {
        (Some(_), None) => return Err("an era's view takes no \"chapters\"".into()),
        (Some(pairs), Some(count)) => check_scope(pairs, count)?,
        (None, _) => {}
    }
    let article = v.article.as_deref().unwrap_or(article);
    let heading = v.heading.as_deref();
    let cite = ck.quote(article, heading, &v.quote)?;
    if let Some(who) = &v.who {
        ck.words(article, heading, "the who phrase", who, false)?;
    }
    if v.prefers {
        let pq = v
            .prefers_quote
            .as_deref()
            .ok_or("\"prefers\": true needs the dictionary's own words in \"prefersQuote\"")?;
        ck.words(article, heading, "the preference", pq, true)?;
    } else if v.prefers_quote.is_some() {
        return Err("\"prefersQuote\" is only for a view with \"prefers\": true".into());
    }
    let era = v.era.as_deref().map(Era::parse).transpose()?;
    let (span, relative) = match (&v.label, v.undated) {
        (Some(_), true) => return Err("an undated view takes no label".into()),
        (None, true) if era_view => return Err("an era's view needs a label".into()),
        (None, true) => {
            if v.era.is_some() || v.prefers || v.relative || v.who.is_some() {
                return Err("an undated view takes only a quotation".into());
            }
            (None, false)
        }
        (None, false) => return Err("a view needs a label, or \"undated\": true".into()),
        (Some(label), false) => {
            if !contains_phrase(&v.quote, label) {
                return Err(format!(
                    "the label {label:?} is not cut word for word from its quotation"
                ));
            }
            match (parse_label(label, era), v.relative) {
                (Ok(Some(_)), true) => {
                    return Err(format!(
                        "the label {label:?} reads as a date, so it is not relative"
                    ))
                }
                (Ok(Some(s)), false) => (Some(s), false),
                (Ok(None), _) => (None, true),
                (Err(_), true) if v.why.as_deref().is_some_and(|w| !w.trim().is_empty()) => {
                    (None, true)
                }
                (Err(_), true) => return Err("\"relative\": true needs a \"why\"".into()),
                (Err(e), false) => return Err(e),
            }
        }
    };
    let bare_bc = era == Some(Era::Bc)
        && v.label
            .as_deref()
            .is_some_and(|l| !tokens(l).iter().any(|x| is(x, "bc") || is(x, "ad")));
    let json = json!({
        "who": v.who,
        "label": v.label,
        "from": span.and_then(|s| s.from),
        "to": span.and_then(|s| s.to),
        "approx": span.is_some_and(|s| s.approx).then_some(true),
        "relative": relative.then_some(true),
        "undated": v.undated.then_some(true),
        "era": bare_bc.then_some("BC"),
        "prefers": v.prefers.then_some(true),
        "prefersQuote": v.prefers_quote,
        "quote": v.quote,
        "cite": cite.json(),
        "chapters": v.chapters,
    });
    Ok(View {
        json,
        prefers: v.prefers,
        dated: span.is_some(),
        relative,
    })
}

/// The views in display order: a preferred view first. At most one may be
/// preferred. `book` is the book's chapter count, or `None` for an era.
fn views(
    ck: &mut Checker,
    specs: &[ViewSpec],
    article: &str,
    book: Option<u16>,
    what: &str,
) -> Result<Vec<View>, String> {
    let mut out = Vec::new();
    for (i, v) in specs.iter().enumerate() {
        out.push(view(ck, v, article, book).map_err(|e| {
            format!(
                "{what}, view {} ({:?}): {e}",
                i + 1,
                v.label.as_deref().unwrap_or("undated")
            )
        })?);
    }
    if out.iter().filter(|v| v.prefers).count() > 1 {
        return Err(format!("{what}: more than one view is marked preferred"));
    }
    out.sort_by_key(|v| !v.prefers);
    Ok(out)
}

/// Remove nulls so the file stays small; a missing key means "not given".
fn compact(v: &mut Value) {
    match v {
        Value::Object(m) => {
            m.retain(|_, x| !x.is_null());
            m.values_mut().for_each(compact);
        }
        Value::Array(a) => a.iter_mut().for_each(compact),
        _ => {}
    }
}

fn book_index(osis: &str) -> Result<u8, String> {
    by_osis(osis).ok_or_else(|| {
        format!("{osis:?} is not a book id (use the app's OSIS ids, such as Gen, 1Kgs, Ps, Song)")
    })
}

/// Check the license, read the dictionary, check every entry of
/// config/eras.json against it and write eras.json.
pub fn build(
    root: &Path,
    inputs: &Inputs,
    vz: &Versification,
) -> Result<Vec<(String, Vec<u8>)>, String> {
    let fail = |e: String| format!("config/eras.json: {e}");
    let text = fs::read_to_string(root.join("config/eras.json"))
        .map_err(|e| format!("reading config/eras.json: {e}"))?;
    let cfg: Config =
        serde_json::from_str(&text).map_err(|e| format!("parsing config/eras.json: {e}"))?;

    // The source, its pinned files and its license.
    let src = inputs
        .spec
        .sources
        .iter()
        .find(|s| s.id == SOURCE)
        .ok_or("sources.json has no tyndale-tbd entry")?;
    let locked = inputs
        .lock
        .sources
        .iter()
        .find(|l| l.id == SOURCE)
        .ok_or("manifest.lock.json has no tyndale-tbd entry")?;
    for key in LETTER_FILES.iter().copied().chain(["charts", "readme"]) {
        if !src.files.contains_key(key) || !locked.files.contains_key(key) {
            return Err(format!(
                "tyndale-tbd: the file {key:?} is missing from sources.json or the lock"
            ));
        }
    }
    let readme_path = inputs.path(SOURCE, "readme");
    let readme = fs::read_to_string(&readme_path)
        .map_err(|e| format!("reading {}: {e}", readme_path.display()))?;
    if !readme.contains(README_LICENSE) || !readme.contains(ATTRIBUTION) {
        return Err("the dictionary's _README.txt no longer states CC BY-SA 4.0 and its attribution; review the license before building".into());
    }
    if src.license != LICENSE || !src.attribution.contains(ATTRIBUTION) {
        return Err(format!(
            "sources.json: tyndale-tbd must be {LICENSE} with the attribution \"{ATTRIBUTION} …\""
        ));
    }

    let tbd = Tbd::open(inputs)?;
    let mut ck = Checker {
        tbd: &tbd,
        quotes: 0,
    };
    let events = chart_events(&tbd, &cfg).map_err(fail)?;

    // Eras.
    let mut era_ids: HashMap<&str, usize> = HashMap::new();
    let mut eras_json = Vec::new();
    for (i, e) in cfg.eras.iter().enumerate() {
        let what = format!("era {}", e.id);
        if era_ids.insert(e.id.as_str(), i).is_some() {
            return Err(fail(format!("{what} is defined twice")));
        }
        let cite = ck
            .quote(&e.article, e.heading.as_deref(), &e.quote)
            .map_err(|x| fail(format!("{what}: {x}")))?;
        let home = (e.article.as_str(), e.heading.as_deref());
        let from = e
            .from
            .as_ref()
            .map(|d| era_end(&mut ck, &events, d, Side::From, home))
            .transpose()
            .map_err(|x| fail(format!("{what}, from: {x}")))?;
        let to =
            e.to.as_ref()
                .map(|d| era_end(&mut ck, &events, d, Side::To, home))
                .transpose()
                .map_err(|x| fail(format!("{what}, to: {x}")))?;
        if let (Some(a), Some(b)) = (&from, &to) {
            if a.year > b.year {
                return Err(fail(format!("{what} ends before it starts")));
            }
        }
        let vs = views(&mut ck, &e.views, &e.article, None, &what).map_err(fail)?;
        let label = match (&from, &to) {
            (Some(a), Some(b)) => Some(format_years(a.year, b.year)),
            _ => None,
        };
        let approx = from.iter().chain(to.iter()).any(|x| x.approx);
        eras_json.push(json!({
            "id": e.id, "name": e.name,
            "from": from.as_ref().map(|x| x.year), "to": to.as_ref().map(|x| x.year),
            "approx": approx.then_some(true), "label": label,
            "start": from.map(|x| x.src), "end": to.map(|x| x.src),
            "quote": e.quote, "cite": cite.json(),
            "views": vs.into_iter().map(|v| v.json).collect::<Vec<_>>(),
        }));
    }

    // Ranges: each chapter in at most one.
    let mut chapters = vec![-1i64; vz.chapter_count()];
    let mut ranges_json = Vec::new();
    let mut covered = 0usize;
    for (ri, r) in cfg.ranges.iter().enumerate() {
        let what = format!("range {} {}–{}", r.book, r.from, r.to);
        let b = book_index(&r.book).map_err(|x| fail(format!("{what}: {x}")))?;
        if r.from == 0 || r.from > r.to || r.to > vz.chapters_in(b) {
            return Err(fail(format!(
                "{what}: {} has chapters 1–{}",
                BOOKS[b as usize].name,
                vz.chapters_in(b)
            )));
        }
        let era = *era_ids
            .get(r.era.as_str())
            .ok_or_else(|| fail(format!("{what}: no era {:?}", r.era)))?;
        let backing = match (&r.quote, &r.chart, &r.row) {
            (Some(q), None, None) => {
                let article = r
                    .article
                    .as_deref()
                    .ok_or_else(|| fail(format!("{what}: a quotation needs its article")))?;
                let cite = ck
                    .quote(article, r.heading.as_deref(), q)
                    .map_err(|x| fail(format!("{what}: {x}")))?;
                json!({ "quote": q, "cite": cite.json() })
            }
            (None, Some(name), Some(row)) => {
                if r.article.is_some() || r.heading.is_some() {
                    return Err(fail(format!(
                        "{what}: a chart row takes no article or heading"
                    )));
                }
                let chart = tbd
                    .charts
                    .get(name)
                    .ok_or_else(|| fail(format!("{what}: TBD has no chart named {name}")))?;
                let rows: Vec<&ChartRow> = chart
                    .rows
                    .iter()
                    .filter(|x| x.cells.first() == Some(row))
                    .collect();
                let [found] = rows.as_slice() else {
                    return Err(fail(format!(
                        "{what}: the chart {name} has {} rows starting {row:?}, not one",
                        rows.len()
                    )));
                };
                ck.quotes += 1;
                let spans: Vec<(u8, u16, u16)> = found
                    .links
                    .iter()
                    .filter_map(|l| bref_chapters(l))
                    .collect();
                if let Some(c) = (r.from..=r.to).find(|&c| {
                    !spans
                        .iter()
                        .any(|&(lb, c1, c2)| lb == b && c1 <= c && c <= c2)
                }) {
                    return Err(fail(format!(
                        "{what}: the chart row {row:?} does not reach {} {c}",
                        BOOKS[b as usize].name
                    )));
                }
                let header = chart
                    .rows
                    .first()
                    .filter(|h| {
                        !h.cells
                            .iter()
                            .any(|c| c.chars().any(|ch| ch.is_ascii_digit()))
                    })
                    .map(|h| h.cells.clone());
                json!({ "row": { "chart": chart.title, "header": header, "cells": found.cells } })
            }
            _ => {
                return Err(fail(format!(
                    "{what}: give either a quotation with its article, or a chart and a row"
                )))
            }
        };
        for c in r.from..=r.to {
            let ci = vz
                .chapter_index(b, c)
                .ok_or_else(|| fail(format!("{what}: no chapter {c}")))?
                as usize;
            if chapters[ci] >= 0 {
                let other = &cfg.ranges[chapters[ci] as usize];
                return Err(fail(format!(
                    "{what} and range {} {}–{} both claim {} {c}",
                    other.book, other.from, other.to, BOOKS[b as usize].name
                )));
            }
            chapters[ci] = ri as i64;
            covered += 1;
        }
        let mut rj = json!({ "book": b, "from": r.from, "to": r.to, "era": era });
        if let (Some(o), Value::Object(extra)) = (rj.as_object_mut(), backing) {
            o.extend(extra);
        }
        ranges_json.push(rj);
    }

    // Books.
    if let Some(k) = cfg.books.keys().find(|k| by_osis(k).is_none()) {
        return Err(fail(format!("books: {k:?} is not a book id")));
    }
    let (mut dated, mut relative, mut undated) = (0, 0, 0);
    let mut books_json = Vec::new();
    for (bi, bk) in BOOKS.iter().enumerate() {
        let spec = cfg.books.get(bk.osis).ok_or_else(|| {
            fail(format!(
                "books: {} needs at least one written view",
                bk.osis
            ))
        })?;
        if spec.written.is_empty() {
            return Err(fail(format!(
                "books: {} needs at least one written view",
                bk.osis
            )));
        }
        let what = format!("book {}", bk.osis);
        let (cite, _) = tbd
            .pool(&spec.article, None)
            .map_err(|x| fail(format!("{what}: {x}")))?;
        let count = vz.chapters_in(bi as u8);
        let vs = views(&mut ck, &spec.written, &spec.article, Some(count), &what).map_err(fail)?;
        if vs.iter().any(|v| v.dated) {
            dated += 1;
        } else if vs.iter().any(|v| v.relative) {
            relative += 1;
        } else {
            undated += 1;
        }
        // A missing or wrong era shows up as an Old Testament book written AD or a New Testament one BC.
        let nt = bk.testament == atlas_core::Testament::New;
        for v in &vs {
            let years = [v.json.get("from"), v.json.get("to")]
                .into_iter()
                .flatten()
                .filter_map(Value::as_i64);
            if years.into_iter().any(|y| (y > 0) != nt) {
                return Err(fail(format!(
                    "{what}: {:?} falls on the wrong side of AD 1; check its era",
                    v.json["label"]
                )));
            }
        }
        books_json.push(json!({
            "article": spec.article, "title": cite.title, "stages": spec.stages.then_some(true),
            "written": vs.into_iter().map(|v| v.json).collect::<Vec<_>>(),
        }));
    }

    let chart_json: Vec<Value> = events
        .iter()
        .map(|e| {
            json!({
                "chart": e.chart, "event": e.event, "from": e.span.from, "to": e.span.to, "label": e.label,
                "approx": e.span.approx.then_some(true),
                "alt": e.alt.map(|a| [a.from, a.to]),
                "basis": e.basis, "corrected": e.corrected,
            })
        })
        .collect();

    let mut doc = json!({
        "format": 1,
        "source": { "title": src.title, "license": src.license, "attribution": src.attribution, "changes": CHANGES },
        "eras": eras_json,
        "ranges": ranges_json,
        "chapters": chapters,
        "books": books_json,
        "chart": chart_json,
    });
    compact(&mut doc);
    let bytes = serde_json::to_vec(&doc).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_BYTES {
        return Err(format!(
            "eras.json is {} bytes; keep it under {MAX_BYTES}",
            bytes.len()
        ));
    }
    eprintln!(
        "Eras: {} eras, {} ranges covering {covered} chapters; 66 books ({dated} dated, {relative} relative, {undated} undated); {} quotations checked",
        cfg.eras.len(),
        cfg.ranges.len(),
        ck.quotes
    );
    Ok(vec![("eras.json".to_string(), bytes)])
}

// --- atlas verify -------------------------------------------------------------

/// Checks on the built eras.json, for `atlas verify`.
pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let mut out: Vec<(bool, String)> = Vec::new();
    let mut check = |ok: bool, what: String| out.push((ok, what));
    check(
        d.meta["files"].get("eras.json").is_some(),
        "eras.json is listed in meta.json".into(),
    );
    let text = fs::read_to_string(d.dir.join("eras.json"))
        .map_err(|e| format!("reading eras.json: {e}"))?;
    let e: Value = serde_json::from_str(&text).map_err(|e| format!("parsing eras.json: {e}"))?;
    check(e["format"] == 1, "eras.json has format 1".into());
    check(
        text.len() <= MAX_BYTES,
        format!("eras.json is {} bytes (at most {MAX_BYTES})", text.len()),
    );

    let empty = Vec::new();
    let list = |k: &str| e[k].as_array().unwrap_or(&empty);
    let (eras, ranges, chapters, books, chart) = (
        list("eras"),
        list("ranges"),
        list("chapters"),
        list("books"),
        list("chart"),
    );
    check(
        books.len() == 66,
        format!("eras.json has {} books (66)", books.len()),
    );
    check(
        chapters.len() == 1189 && chapters.len() == d.vz.chapter_count(),
        format!("eras.json has {} chapters (1,189)", chapters.len()),
    );

    // Chapters point at ranges that hold them; no chapter sits in two ranges.
    let num = |v: &Value| v.as_i64().unwrap_or(-2);
    let mut bad = 0;
    let mut covered = 0;
    for (ci, v) in chapters.iter().enumerate() {
        let r = num(v);
        if r == -1 {
            continue;
        }
        let Some(rg) = usize::try_from(r).ok().and_then(|r| ranges.get(r)) else {
            bad += 1;
            continue;
        };
        covered += 1;
        let b = d.vz.book_of_chapter(ci);
        let c = (ci as u32 - d.vz.book_chapter_start[b as usize] + 1) as i64;
        if num(&rg["book"]) != b as i64
            || c < num(&rg["from"])
            || c > num(&rg["to"])
            || usize::try_from(num(&rg["era"])).map_or(true, |x| x >= eras.len())
        {
            bad += 1;
        }
    }
    check(
        bad == 0,
        format!("{bad} chapters point at a missing or wrong range"),
    );
    let mut owner = vec![usize::MAX; d.vz.chapter_count()];
    let mut overlaps = 0;
    for (ri, rg) in ranges.iter().enumerate() {
        for c in num(&rg["from"]).max(1)..=num(&rg["to"]) {
            match d.vz.chapter_index(num(&rg["book"]) as u8, c as u16) {
                Some(ci)
                    if owner[ci as usize] == usize::MAX
                        && num(&chapters[ci as usize]) == ri as i64 =>
                {
                    owner[ci as usize] = ri
                }
                _ => overlaps += 1,
            }
        }
    }
    check(
        overlaps == 0,
        format!("{overlaps} range chapters overlap or disagree with the chapter list"),
    );
    check(
        covered >= 750,
        format!("{covered} chapters have an era (at least 750)"),
    );

    // Books and labels.
    let written = |b: &Value| b["written"].as_array().cloned().unwrap_or_default();
    check(
        books.iter().all(|b| !written(b).is_empty()),
        "every book has a written view".into(),
    );
    let with_date = books
        .iter()
        .filter(|b| {
            written(b)
                .iter()
                .any(|w| w.get("from").is_some() || w.get("to").is_some() || w["relative"] == true)
        })
        .count();
    check(
        with_date >= 50,
        format!("{with_date} books have a dated or relative view (at least 50)"),
    );
    let mut labelled: Vec<&Value> = Vec::new();
    for era in eras {
        labelled.extend(era["views"].as_array().unwrap_or(&empty));
        labelled.extend(
            ["start", "end"]
                .iter()
                .map(|k| &era[*k])
                .filter(|x| x.get("quote").is_some()),
        );
    }
    let all_written: Vec<Value> = books.iter().flat_map(written).collect();
    labelled.extend(all_written.iter());
    let cut = labelled
        .iter()
        .filter(|v| {
            v.get("label").is_none_or(|l| {
                v["quote"]
                    .as_str()
                    .is_some_and(|q| l.as_str().is_some_and(|l| q.contains(l)))
            })
        })
        .count();
    check(
        cut == labelled.len(),
        format!(
            "{} of {} labels are cut from their quotations",
            cut,
            labelled.len()
        ),
    );
    check(
        e["source"]["license"] == LICENSE,
        "eras.json source license is CC BY-SA 4.0".into(),
    );
    check(
        e["source"]["attribution"]
            .as_str()
            .is_some_and(|a| a.contains(ATTRIBUTION)),
        "eras.json carries the Tyndale attribution".into(),
    );

    // Known facts.
    let book = |osis: &str| {
        by_osis(osis)
            .map(|b| written(&books[b as usize]))
            .unwrap_or_default()
    };
    let labels = |osis: &str| {
        book(osis)
            .iter()
            .filter_map(|w| w["label"].as_str().map(str::to_string))
            .collect::<Vec<_>>()
    };
    check(
        labels("Dan") == ["sixth century BC", "about 165 BC"] && book("Dan").len() == 2,
        format!("Daniel's written views: {:?}", labels("Dan")),
    );
    check(
        labels("Isa").iter().any(|l| l == "about 700 BC"),
        "Isaiah has a view labelled \"about 700 BC\"".into(),
    );
    let exodus = eras.iter().find(|x| x["id"] == "exodus");
    let ex_views = exodus
        .and_then(|x| x["views"].as_array())
        .cloned()
        .unwrap_or_default();
    check(
        exodus.is_some_and(|x| x["from"] == -1446),
        "The Exodus era starts at 1446 BC".into(),
    );
    check(
        ex_views
            .iter()
            .any(|v| v["label"] == "about 1440" && v["prefers"] == true),
        "The Exodus: \"about 1440\" is the preferred view".into(),
    );
    check(
        ex_views.iter().any(|v| v["label"] == "1290"),
        "The Exodus: \"1290\" is a view".into(),
    );
    check(
        labels("Deut") == ["14th or 13th century BC", "seventh century BC"],
        format!("Deuteronomy's written views: {:?}", labels("Deut")),
    );
    check(
        book("Rev").len() == 2,
        format!("Revelation has {} written views (2)", book("Rev").len()),
    );
    check(
        book("Gen").len() == 3,
        format!("Genesis has {} written views (3)", book("Gen").len()),
    );
    let era_at = |osis: &str, c: u16| -> Option<String> {
        let ci = d.vz.chapter_index(by_osis(osis)?, c)? as usize;
        let r = usize::try_from(num(&chapters[ci])).ok()?;
        let ei = usize::try_from(num(&ranges.get(r)?["era"])).ok()?;
        eras.get(ei)?["id"].as_str().map(str::to_string)
    };
    for (osis, c, id, yes) in [
        ("1Kgs", 12, "divided-kingdom", true),
        ("2Kgs", 17, "divided-kingdom", true),
        ("2Kgs", 18, "judah-after", true),
        ("1Kgs", 11, "divided-kingdom", false),
        ("Gen", 1, "prepatriarchal", true),
        ("Gen", 46, "patriarchal", true),
        ("Gen", 47, "sojourn", true),
    ] {
        let got = era_at(osis, c);
        check(
            (got.as_deref() == Some(id)) == yes,
            format!(
                "{osis} {c} {} in {id} (it is in {got:?})",
                if yes { "falls" } else { "does not fall" }
            ),
        );
    }
    let event = |name: &str| chart.iter().find(|x| x["event"] == name);
    check(
        event("Fall of Samaria").is_some_and(|x| x["from"] == -722),
        "the chart has Fall of Samaria at -722".into(),
    );
    check(
        event("Abraham born").is_some_and(|x| {
            x["from"] == -2166
                && x["alt"][0] == -2133
                && x["basis"] == "Gen 21:5"
                && x["corrected"] == "Gn 26:5"
        }),
        "the chart has Abraham born at -2166 (Greek -2133), basis corrected to Gen 21:5".into(),
    );
    // Letters whose writing date the dictionary disputes carry no era.
    // Colossians does: every date the dictionary gives for Paul writing it
    // (Rome AD 60–62, Ephesus AD 52–55) falls in AD 50 to 70, as Philemon's does.
    let unplaced: Vec<&str> = ["Jas", "2Tim", "1Pet", "2Pet"]
        .into_iter()
        .filter(|osis| era_at(osis, 1).is_some())
        .collect();
    check(
        unplaced.is_empty(),
        format!("James, 2 Timothy, 1 and 2 Peter have no era (these do: {unplaced:?})"),
    );
    let jesus = eras.iter().find(|x| x["id"] == "jesus-life");
    check(
        jesus.is_some_and(|x| {
            x["approx"] == true
                && x["start"].get("hedge").is_some()
                && x["end"].get("hedge").is_some()
        }),
        "Chronology of Jesus’ Life: both ends are hedged, so the line leaves its years off".into(),
    );

    // Chapter scopes: on book views only, inside the book, in order.
    let mut bad_scopes = 0;
    for (bi, b) in books.iter().enumerate() {
        let count = i64::from(d.vz.chapters_in(bi as u8));
        for w in written(b) {
            let Some(ps) = w.get("chapters") else {
                continue;
            };
            let mut last = 0;
            let ok = ps.as_array().is_some_and(|ps| {
                !ps.is_empty()
                    && ps.iter().all(|p| {
                        let (a, z) = (num(&p[0]), num(&p[1]));
                        let fine = a > last && a <= z && z <= count;
                        last = z;
                        fine
                    })
            });
            if !ok {
                bad_scopes += 1;
            }
        }
    }
    let era_scoped = eras
        .iter()
        .flat_map(|x| x["views"].as_array().cloned().unwrap_or_default())
        .filter(|v| v.get("chapters").is_some())
        .count();
    check(
        bad_scopes == 0 && era_scoped == 0,
        format!("{bad_scopes} book views and {era_scoped} era views have bad chapter spans"),
    );

    // What the line shows for a chapter: the views about it, in order.
    let applies = |w: &Value, c: i64| {
        w["chapters"]
            .as_array()
            .is_none_or(|ps| ps.iter().any(|p| num(&p[0]) <= c && c <= num(&p[1])))
    };
    let shown = |osis: &str, c: i64| -> Vec<Value> {
        book(osis).into_iter().filter(|w| applies(w, c)).collect()
    };
    let lead = |osis: &str, c: i64| {
        shown(osis, c).first().map(|w| {
            if w["undated"] == true {
                "undated".to_string()
            } else {
                w["label"].as_str().unwrap_or("").to_string()
            }
        })
    };
    for (osis, c, want) in [
        ("Zech", 1, "from 520 to 518 BC"),
        ("Zech", 9, "undated"),
        ("Isa", 1, "about 700 BC"),
        ("Isa", 40, "during Isaiah’s retirement years"),
        ("Ps", 23, "in the period of the monarchy"),
        ("Ps", 137, "clearly exilic"),
        ("Jer", 1, "c. 627–586 BC"),
        ("Jer", 44, "latest writings of Jeremiah"),
        ("Jer", 52, "editorial appendix"),
    ] {
        let got = lead(osis, c);
        check(
            got.as_deref() == Some(want),
            format!("{osis} {c}: the line leads with {want:?} (it leads with {got:?})"),
        );
    }
    let never = |osis: &str, cs: std::ops::RangeInclusive<i64>, label: &str| {
        cs.filter(|&c| shown(osis, c).iter().any(|w| w["label"] == label))
            .count()
    };
    let wrong = never("Zech", 9..=14, "from 520 to 518 BC")
        + never("Isa", 40..=66, "about 700 BC")
        + never("Ps", 137..=137, "in the period of the monarchy")
        + never("Jer", 40..=44, "c. 627–586 BC")
        + never("Jer", 52..=52, "c. 627–586 BC");
    check(
        wrong == 0,
        format!("{wrong} chapters show a date the dictionary gives to other chapters (Zechariah 9–14, Isaiah 40–66, Psalm 137, Jeremiah 40–44 and 52)"),
    );
    let mut bare = Vec::new();
    for (bi, bk) in BOOKS.iter().enumerate() {
        let ws = books.get(bi).map(written).unwrap_or_default();
        for c in 1..=i64::from(d.vz.chapters_in(bi as u8)) {
            if !ws.iter().any(|w| applies(w, c)) {
                bare.push(format!("{} {c}", bk.osis));
            }
        }
    }
    check(
        bare == ["Ps 90"],
        format!("chapters with no written view: {bare:?} (only Psalm 90, which the dictionary ascribes to Moses)"),
    );
    check(
        book("Exod").len() >= 2 && book("Lev").len() >= 2 && book("Num").len() >= 2,
        "Exodus, Leviticus and Numbers name the critical position too".into(),
    );
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn span(from: i32, to: i32) -> Option<Span> {
        Some(Span {
            from: Some(from),
            to: Some(to),
            approx: false,
        })
    }
    fn about(from: i32, to: i32) -> Option<Span> {
        Some(Span {
            from: Some(from),
            to: Some(to),
            approx: true,
        })
    }
    fn read(label: &str, era: Option<Era>) -> Option<Span> {
        parse_label(label, era).unwrap_or_else(|e| panic!("{e}"))
    }
    const BC: Option<Era> = Some(Era::Bc);
    const AD: Option<Era> = Some(Era::Ad);

    #[test]
    fn normalizer() {
        assert_eq!(
            normalize("  a<span class=\"x\">b</span>\u{a0} c&amp;d &#65;&#x42; &lt;e&gt;\n"),
            "ab c&d AB <e>"
        );
        assert_eq!(
            normalize("“Early Date” — 1 Kgs 12–2 Kgs 17"),
            "“Early Date” — 1 Kgs 12–2 Kgs 17"
        );
        assert_eq!(
            decode_entities("a & b &unknown; &#x41;"),
            "a & b &unknown; A"
        );
    }

    const XML: &str = r#"<items>
<item typename="DictionaryLetter" name="S" product="T"><title>S</title><body><p>skip</p></body></item>
<item product="T" name="SampleBookof" typename="Article">
  <title>Sample, Book of*</title>
  <body>
<p class="h1">SAMPLE, BOOK OF*</p>
<p class="toc">Date</p>
<p class="fl">Lead&#160;text <a href="?bref=Gen.1.1">Gn 1:1</a>  here.</p>
<p class="h2-preview">Preview</p>
<p class="preview-list">• Date</p>
<p class="fl"/>
<p>No class   paragraph.</p>
<pre>not a paragraph</pre>
<p class="h2" id="x">Date</p>
<p class="h3">The “Early Date” View</p>
<p>An alternative position is that the book was written about 165 BC.</p>
  </body>
</item>
</items>"#;

    #[test]
    fn scanner_reads_every_paragraph_by_section() {
        let mut arts = HashMap::new();
        read_articles(XML, &mut arts).unwrap();
        assert_eq!(arts.len(), 1);
        let a = &arts["SampleBookof"];
        assert_eq!(a.title, "Sample, Book of");
        assert_eq!(a.sections.len(), 2);
        assert_eq!(a.sections[0].0, "");
        assert_eq!(
            a.sections[0].1,
            ["Lead text Gn 1:1 here.", "", "No class paragraph."]
        );
        assert_eq!(a.sections[1].0, "Date");
        assert_eq!(
            a.sections[1].1,
            [
                "The “Early Date” View",
                "An alternative position is that the book was written about 165 BC."
            ]
        );
        let tbd = Tbd {
            articles: arts,
            charts: HashMap::new(),
        };
        let mut ck = Checker {
            tbd: &tbd,
            quotes: 0,
        };
        assert!(ck
            .quote(
                "SampleBookof",
                Some("Date"),
                "the book was written about 165 BC."
            )
            .is_ok());
        assert!(ck
            .quote(
                "SampleBookof",
                Some("Date"),
                "the book was written about 166 BC."
            )
            .is_err());
        assert!(ck.quote("SampleBookof", None, "Lead text Gn 1:1").is_ok());
        assert!(ck.quote("SampleBookof", Some("Lead"), "Lead text").is_err());
        assert!(
            ck.quote("SampleBookof", None, "text Gn 1:1 here. No class")
                .is_err(),
            "a quotation never spans paragraphs"
        );
        assert!(ck
            .words(
                "SampleBookof",
                Some("Date"),
                "who",
                "The “Early Date” View",
                false
            )
            .is_ok());
        assert!(ck
            .words(
                "SampleBookof",
                Some("Date"),
                "who",
                "alternative pos",
                false
            )
            .is_err());
        assert_eq!(
            ck.quotes, 4,
            "a missing heading fails before the quotation is counted"
        );
    }

    #[test]
    fn chart_scanner_and_dates() {
        let xml = r#"<item typename="Chart" product="T" name="C"><title>A &amp; B</title><body><table>
<tr><td><p class="td"><span class="bold">Reference</span></p></td><td><p>Dates</p></td></tr>
<tr><td><p><a href="?bref=Ezra.1.1-4.6">Ezr 1:1–4:6</a>, <a href="?bref=Ezra.4.24">24</a></p></td><td><p>538–536 <span class="era">BC</span></p></td></tr>
</table></body></item>"#;
        let charts = read_charts(xml);
        let c = &charts["C"];
        assert_eq!(c.title, "A & B");
        assert_eq!(c.rows[1].cells, ["Ezr 1:1–4:6, 24", "538–536 BC"]);
        assert_eq!(c.rows[1].links, ["Ezra.1.1-4.6", "Ezra.4.24"]);
        assert_eq!(bref_chapters("Ezra.1.1-4.6"), Some((14, 1, 4)));
        assert_eq!(bref_chapters("Ezra.4.7-23"), Some((14, 4, 4)));
        assert_eq!(bref_chapters("Hagg.1.1-2.23"), Some((36, 1, 2)));
        let bc = |s: &str, g: bool| chart_date(s, Era::Bc, g);
        let ad = |s: &str| chart_date(s, Era::Ad, false).map(|x| (x.0, x.2));
        assert_eq!(
            bc("444 BC", false).map(|x| (x.0, x.2)),
            Some((point(-444), "444 BC".to_string()))
        );
        assert_eq!(
            bc("538", false).map(|x| (x.0, x.2)),
            Some((point(-538), "538 BC".to_string()))
        );
        assert_eq!(
            bc("2133 (2166)", true).map(|x| (x.0, x.1)),
            Some((point(-2166), Some(point(-2133))))
        );
        assert_eq!(
            bc("2133 (2166)", false),
            None,
            "the Gk/Heb form only follows its header row"
        );
        assert_eq!(
            ad("6/5 BC"),
            Some((range(-6, -5).unwrap(), "6/5 BC".to_string()))
        );
        assert_eq!(
            ad("AD 6/7"),
            Some((range(6, 7).unwrap(), "AD 6/7".to_string()))
        );
        assert_eq!(
            ad("46-48"),
            Some((range(46, 48).unwrap(), "AD 46-48".to_string()))
        );
        assert_eq!(
            ad("c. 100"),
            Some((approx(point(100), true), "c. AD 100".to_string()))
        );
        assert_eq!(ad("Gk/Heb Text"), None);
    }

    #[test]
    fn year_forms() {
        assert_eq!(read("444 BC", None), span(-444, -444));
        assert_eq!(read("AD 55", None), span(55, 55));
        assert_eq!(read("56", AD), span(56, 56));
        assert_eq!(read("1290", BC), span(-1290, -1290));
        assert_eq!(read("about 165 BC", None), about(-165, -165));
        assert_eq!(read("around AD 62", None), about(62, 62));
        assert_eq!(read("Around 400 BC", None), about(-400, -400));
        assert_eq!(read("c. 940 BC", None), about(-940, -940));
        assert_eq!(read("c. AD 56", None), about(56, 56));
        assert_eq!(read("approximately 1000 BC", None), about(-1000, -1000));
        assert_eq!(read("1290–1250 BC", None), span(-1290, -1250));
        assert_eq!(read("c. 970–930 BC", None), about(-970, -930));
        assert_eq!(read("46-48", AD), span(46, 48));
        assert_eq!(read("AD 60–62", None), span(60, 62));
        assert_eq!(read("around AD 57–58", None), about(57, 58));
        assert_eq!(read("6/5 BC", None), span(-6, -5));
        assert_eq!(read("AD 64 or 65", None), span(64, 65));
    }

    #[test]
    fn one_sided_and_point_forms() {
        let to = |y| {
            Some(Span {
                from: None,
                to: Some(y),
                approx: false,
            })
        };
        let from = |y| {
            Some(Span {
                from: Some(y),
                to: None,
                approx: false,
            })
        };
        assert_eq!(read("by 700 BC", None), to(-700));
        assert_eq!(read("before 586 BC", None), to(-586));
        assert_eq!(read("prior to AD 70", None), to(70));
        assert_eq!(read("pre–AD 50", None), to(50));
        assert_eq!(read("on or before AD 64", None), to(64));
        assert_eq!(read("after 930 BC", None), from(-930));
        assert_eq!(read("from 592 BC", None), from(-592));
        assert_eq!(read("shortly after 465 BC", None), about(-465, -465));
        assert_eq!(read("just after 433 BC", None), about(-433, -433));
        assert_eq!(read("soon after AD 70", None), about(70, 70));
        assert_eq!(read("shortly before 609 BC", None), about(-609, -609));
    }

    #[test]
    fn between_and_from_to_forms() {
        assert_eq!(read("between 561 and 539 BC", None), span(-561, -539));
        assert_eq!(
            read("between 1375 BC and 1045 BC", None),
            span(-1375, -1045)
        );
        assert_eq!(read("between AD 60 and 68", None), span(60, 68));
        assert_eq!(read("between 60 and 68", AD), span(60, 68));
        assert_eq!(
            read("roughly between 1800 and 1600 BC", None),
            about(-1800, -1600)
        );
        assert_eq!(read("from 2086 to 1871 BC", None), span(-2086, -1871));
        assert_eq!(read("from 62 to 64", AD), span(62, 64));
    }

    #[test]
    fn decade_forms() {
        assert_eq!(read("in the 60s", AD), span(60, 69));
        assert_eq!(read("early 60s", AD), about(60, 63));
        assert_eq!(read("in the 40s or 50s", AD), span(40, 59));
        assert_eq!(read("early in the year 50", AD), span(50, 50));
        assert_eq!(read("in the 60s", BC), span(-69, -60));
    }

    #[test]
    fn century_forms() {
        assert_eq!(read("15th century BC", None), span(-1500, -1401));
        assert_eq!(read("sixth century BC", None), span(-600, -501));
        assert_eq!(read("13th-century", BC), span(-1300, -1201));
        assert_eq!(read("seventh-century BC", None), span(-700, -601));
        assert_eq!(read("the ninth century", BC), span(-900, -801));
        assert_eq!(read("14th or 13th century BC", None), span(-1400, -1201));
        assert_eq!(
            read("from the ninth to the fifth centuries BC", None),
            span(-900, -401)
        );
        assert_eq!(
            read("the last decade of the first century", AD),
            span(91, 100)
        );
        assert_eq!(
            read("the last decade of the sixth century BC", None),
            span(-510, -501)
        );
        assert_eq!(read("near the end of the first century", AD), span(81, 100));
        assert_eq!(
            read("close to the end of the 13th century BC", None),
            span(-1220, -1201)
        );
        assert_eq!(
            read("toward the end of the first century", AD),
            span(81, 100)
        );
        assert_eq!(read("the early seventh century BC", None), span(-700, -681));
        assert_eq!(read("early in the second century", AD), span(101, 120));
        assert_eq!(
            read("the latter half of the tenth century BC", None),
            span(-950, -901)
        );
        assert_eq!(
            read("the second half of the eighth century BC", None),
            span(-750, -701)
        );
        assert_eq!(
            read("the first half of the eighth century BC", None),
            span(-800, -751)
        );
        assert_eq!(
            read("the middle of the seventh century", BC),
            span(-660, -641)
        );
        assert_eq!(read("mid-seventh century BC", None), span(-660, -641));
        assert_eq!(
            read("the last quarter of the first century", AD),
            span(76, 100)
        );
        assert_eq!(
            read("the last part of the eighth century BC", None),
            about(-750, -701)
        );
        assert_eq!(read("well into the second century", AD), about(101, 200));
        assert_eq!(read("around the fifth century BC", None), about(-500, -401));
        assert_eq!(
            read(
                "the last decade of the first century or early in the second",
                AD
            ),
            span(91, 120)
        );
        assert_eq!(read("15th-century BC", None), span(-1500, -1401));
        assert_eq!(read("fifth-century BC", None), span(-500, -401));
        assert_eq!(read("third-century BC", None), span(-300, -201));
    }

    #[test]
    fn phrase_forms() {
        assert_eq!(
            read("shortly after the fall of Jerusalem (586 BC)", None),
            about(-586, -586)
        );
        assert_eq!(
            read("very near to the time of Israel’s fall (722 BC)", None),
            about(-722, -722)
        );
        assert_eq!(
            read("within the reign of Josiah (640–609 BC)", None),
            about(-640, -609)
        );
        assert_eq!(
            read("before the destruction of Jerusalem (AD 70)", None),
            Some(Span {
                from: None,
                to: Some(70),
                approx: false
            })
        );
        assert_eq!(
            read("prior to the death of Paul (AD 64)", None),
            Some(Span {
                from: None,
                to: Some(64),
                approx: false
            })
        );
        assert_eq!(
            read("shortly before the death of Josiah in 609 BC", None),
            about(-609, -609)
        );
        assert_eq!(
            read("shortly after the reign of Nero (AD 54–68)", None),
            about(68, 68)
        );
        assert_eq!(
            read("at the close of Domitian’s reign” (AD 81–96)", None),
            about(96, 96)
        );
        assert_eq!(
            read(
                "before AD 70 (before his last teaching was forgotten)",
                None
            ),
            Some(Span {
                from: None,
                to: Some(70),
                approx: false
            })
        );
    }

    #[test]
    fn compound_forms() {
        assert_eq!(
            read("about 1440 BC and the conquest about 1400 BC", None),
            about(-1440, -1400)
        );
        assert_eq!(
            read(
                "before AD 70 (before his last teaching was forgotten) and after AD 60",
                None
            ),
            span(60, 70)
        );
    }

    #[test]
    fn relative_and_unreadable_labels() {
        assert_eq!(read("in the time of Moses", None), None);
        assert_eq!(read("later", None), None);
        assert_eq!(read("one year later than the exodus", None), None);
        assert!(parse_label("a short time after writing 1 Thessalonians", None).is_err());
        assert!(parse_label("written about 165 BC", None).is_err());
        assert!(
            parse_label("1250–1290 BC", None).is_err(),
            "a range must run forward in time"
        );
        assert!(parse_label("the 25th century BC", None).is_ok());
        let e = parse_label("13th-century", None).unwrap_err();
        assert!(e.contains("needs \"era\""), "{e}");
        assert!(
            parse_label("AD 70", BC).is_err(),
            "a label may not contradict its era"
        );
        assert!(holds_date("the fifth day") && !holds_date("the Solomonic era"));
    }

    #[test]
    fn year_formatting() {
        assert_eq!(format_years(-930, -722), "930–722 BC");
        assert_eq!(format_years(30, 50), "AD 30–50");
        assert_eq!(format_years(-6, 30), "6 BC – AD 30");
        assert_eq!(format_years(-1446, -1446), "1446 BC");
        assert_eq!(format_years(70, 70), "AD 70");
    }

    #[test]
    fn phrases_need_word_edges() {
        assert!(contains_phrase("But some have thought", "some"));
        assert!(!contains_phrase("sometime later", "some"));
        assert!(contains_phrase("in 56, he wrote", "56"));
        assert!(!contains_phrase("in 1956 he", "56"));
        assert!(!contains_phrase(
            "reign” (AD 81–96).",
            "at the close of Domitian’s reign” (AD 81–96)"
        ));
        assert!(contains_phrase(
            "x at the close of Domitian’s reign” (AD 81–96).",
            "at the close of Domitian’s reign” (AD 81–96)"
        ));
    }

    #[test]
    fn century_conventions() {
        assert_eq!(century(1, Era::Ad, Part::Whole), span(1, 100));
        assert_eq!(century(1, Era::Bc, Part::Whole), span(-100, -1));
        assert_eq!(century(8, Era::Bc, Part::Whole), span(-800, -701));
    }

    #[test]
    fn chapter_scopes() {
        assert!(check_scope(&[[1, 8]], 14).is_ok());
        assert!(check_scope(&[[1, 39], [46, 51]], 52).is_ok());
        assert!(check_scope(&[[137, 137]], 150).is_ok());
        assert!(check_scope(&[], 14).is_err(), "an empty list is a mistake");
        assert!(check_scope(&[[0, 3]], 14).is_err(), "chapters start at 1");
        assert!(check_scope(&[[5, 4]], 14).is_err(), "a span runs forward");
        assert!(check_scope(&[[9, 15]], 14).is_err(), "Zechariah has 14");
        assert!(check_scope(&[[3, 5], [5, 6]], 14).is_err(), "spans overlap");
        assert!(
            check_scope(&[[7, 8], [1, 2]], 14).is_err(),
            "spans in order"
        );
    }
}
