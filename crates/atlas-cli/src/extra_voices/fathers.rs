//! The Catena's quotations that are left out, and notes on who some of its
//! names are, from `config/voices/catena-aurea.json` (the founder's decisions
//! 5 and 23 of 2026-10-21): Origen and Didymus, whom the Church later
//! condemned; the unfinished work on Matthew, whose writer followed Arius;
//! and Clement of Alexandria, whose teaching is disputed. Each quotation left
//! out becomes a quiet line where it stood, neighbouring ones one line, and
//! each reason is given once after the chain with its source. A passage
//! whose quotations are all left out is not a note: the index keeps a line
//! for it instead. The count of every rule is in the config, and the build
//! fails if the copy no longer matches it.

use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::Path;

const CONFIG: &str = "config/voices/catena-aurea.json";

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Config {
    format: u32,
    #[allow(dead_code)]
    about: String,
    hide: Vec<Hide>,
    reasons: BTreeMap<String, Reason>,
    who: Vec<Who>,
}

/// Quotations under `name`, in `books` (all four Gospels when empty), in
/// `chapters` (all when absent), whose leading citation contains `tag` when
/// one is given, or that have no leading citation when `untagged` is set.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Hide {
    name: String,
    books: Vec<String>,
    #[serde(default)]
    chapters: Vec<u16>,
    #[serde(default)]
    tag: Option<String>,
    #[serde(default)]
    untagged: bool,
    #[allow(dead_code)]
    #[serde(default)]
    chapters_why: Option<String>,
    reason: String,
    count: usize,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Reason {
    /// How a line names where the quotation is from ("Origen").
    from: String,
    /// Why, in one sentence, shown once after the chain.
    why: String,
    src: Source,
}

/// Where a reason's or a note's facts are from, read on `read`.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Source {
    label: String,
    url: String,
    #[allow(dead_code)]
    quote: Vec<String>,
    #[allow(dead_code)]
    read: String,
}

/// A note shown after a name, in `books` (all when empty).
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Who {
    name: String,
    books: Vec<String>,
    note: String,
    #[allow(dead_code)]
    src: Option<Source>,
}

pub(super) fn config(root: &Path) -> Result<Config, String> {
    let path = root.join(CONFIG);
    let text = std::fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let c: Config = serde_json::from_str(&text).map_err(|e| format!("{CONFIG}: {e}"))?;
    if c.format != 1 {
        return Err(format!("{CONFIG}: format {} is not 1", c.format));
    }
    for h in &c.hide {
        if !c.reasons.contains_key(&h.reason) {
            return Err(format!("{CONFIG}: no reason {}", h.reason));
        }
        if h.untagged && h.tag.is_some() {
            return Err(format!("{CONFIG}: {} has both a tag and untagged", h.name));
        }
    }
    for (k, r) in &c.reasons {
        if r.from.is_empty() || r.why.is_empty() || !r.src.url.starts_with("https://") || r.src.label.is_empty() {
            return Err(format!("{CONFIG}: reason {k} needs from, why and a source"));
        }
    }
    Ok(c)
}

/// A Catena quotation's leading citation, without its brackets: "(Hom. iv.
/// in Joan.) While all ..." gives "Hom. iv. in Joan.".
pub(super) fn leading_tag(text: &str) -> Option<&str> {
    let t = text.trim_start();
    let rest = t.strip_prefix('(')?;
    let end = rest.find(')')?;
    let tag = &rest[..end];
    (end <= 80 && !tag.contains('(')).then_some(tag)
}

impl Config {
    /// The reason a quotation is left out, if it is: `book` the Gospel's name
    /// as the config writes it ("Matthew"), `chapter` the passage's chapter.
    pub(super) fn hidden(&self, who: &str, book: &str, chapter: u16, text: &str, counts: &mut [usize]) -> Option<&str> {
        let tag = leading_tag(text);
        let (k, h) = self.hide.iter().enumerate().find(|(_, h)| {
            h.name == who
                && (h.books.is_empty() || h.books.iter().any(|b| b.eq_ignore_ascii_case(book)))
                && (h.chapters.is_empty() || h.chapters.contains(&chapter))
                && (!h.untagged || tag.is_none())
                && h.tag.as_ref().is_none_or(|t| tag.is_some_and(|x| x.contains(t.as_str())))
        })?;
        counts[k] += 1;
        Some(&h.reason)
    }

    pub(super) fn rules(&self) -> usize {
        self.hide.len()
    }

    /// The build fails when a rule no longer finds what it found.
    pub(super) fn check(&self, counts: &[usize]) -> Result<(), String> {
        for (h, &n) in self.hide.iter().zip(counts) {
            if n != h.count {
                return Err(format!(
                    "{CONFIG}: the rule for {} ({}) finds {n} quotations, not {}; check the copy",
                    h.name, h.reason, h.count
                ));
            }
        }
        Ok(())
    }

    /// The quiet line for neighbouring quotations left out, by reason.
    pub(super) fn line(&self, reasons: &[String]) -> String {
        let groups = self.groups(reasons);
        let n = reasons.len();
        if let [(r, _)] = groups.as_slice() {
            return if n == 1 {
                format!("A quotation from {} is left out here.", self.from(r))
            } else {
                format!("{} quotations from {} are left out here.", capital(&number(n)), self.from(r))
            };
        }
        format!("{} quotations are left out here: {}.", capital(&number(n)), self.list(&groups))
    }

    /// The line for a passage whose quotations are all left out.
    pub(super) fn gone(&self, reasons: &[String]) -> String {
        let groups = self.groups(reasons);
        if let [(r, 1)] = groups.as_slice() {
            return format!("The Church Fathers' one quotation on this passage is left out: it is from {}.", self.from(r));
        }
        format!("The Church Fathers' quotations on this passage are left out: {}.", self.list(&groups))
    }

    /// Each reason's sentence, once, in the order they first come.
    pub(super) fn whys(&self, reasons: &[String]) -> Vec<String> {
        self.groups(reasons).iter().map(|(r, _)| self.reasons[*r].why.clone()).collect()
    }

    /// Each reason's sentence with its source, for the index.
    pub(super) fn sources(&self) -> Vec<serde_json::Value> {
        self.reasons.values().map(|r| serde_json::json!([r.why, r.src.label, r.src.url])).collect()
    }

    /// The notes on names, for the index: [name, note, book indexes].
    pub(super) fn who_json(&self) -> Result<Vec<serde_json::Value>, String> {
        let mut out = Vec::new();
        // A note for some books goes before the note for all books.
        for w in self.who.iter().filter(|w| !w.books.is_empty()).chain(self.who.iter().filter(|w| w.books.is_empty())) {
            let books = w
                .books
                .iter()
                .map(|b| super::GOSPELS.iter().find(|(k, _)| k.eq_ignore_ascii_case(b)).map(|&(_, i)| i).ok_or(format!("{CONFIG}: no Gospel {b}")))
                .collect::<Result<Vec<u8>, String>>()?;
            out.push(serde_json::json!([w.name, w.note, books]));
        }
        Ok(out)
    }

    fn from(&self, r: &str) -> &str {
        &self.reasons[r].from
    }

    fn groups<'a>(&self, reasons: &'a [String]) -> Vec<(&'a str, usize)> {
        let mut out: Vec<(&str, usize)> = Vec::new();
        for r in reasons {
            match out.iter_mut().find(|(x, _)| x == r) {
                Some(g) => g.1 += 1,
                None => out.push((r, 1)),
            }
        }
        out
    }

    /// "from Origen and from the unfinished work on Matthew", or with counts
    /// where any is more than one: "two from Origen and one from ...".
    fn list(&self, groups: &[(&str, usize)]) -> String {
        let counted = groups.iter().any(|g| g.1 > 1);
        let parts: Vec<String> = groups
            .iter()
            .map(|&(r, k)| if counted { format!("{} from {}", number(k), self.from(r)) } else { format!("from {}", self.from(r)) })
            .collect();
        match parts.as_slice() {
            [one] => one.clone(),
            [rest @ .., last] => format!("{} and {last}", rest.join(", ")),
            [] => String::new(),
        }
    }
}

fn number(n: usize) -> String {
    const WORDS: [&str; 21] = [
        "no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen",
        "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
    ];
    WORDS.get(n).map_or_else(|| n.to_string(), |w| w.to_string())
}

fn capital(s: &str) -> String {
    let mut c = s.chars();
    c.next().map_or_else(String::new, |f| f.to_uppercase().chain(c).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> Config {
        serde_json::from_str(
            r#"{"format": 1, "about": "", "hide": [],
            "reasons": {
              "a-origen": {"from": "Origen", "why": "W1.", "src": {"label": "L", "url": "https://x", "quote": [], "read": ""}},
              "b-arian": {"from": "the unfinished work on Matthew", "why": "W2.", "src": {"label": "L", "url": "https://x", "quote": [], "read": ""}}
            },
            "who": []}"#,
        )
        .unwrap()
    }

    #[test]
    fn says_what_is_left_out_in_one_line() {
        let c = config();
        let s = |v: &[&str]| v.iter().map(|x| x.to_string()).collect::<Vec<_>>();
        assert_eq!(c.line(&s(&["a-origen"])), "A quotation from Origen is left out here.");
        assert_eq!(c.line(&s(&["a-origen", "a-origen"])), "Two quotations from Origen are left out here.");
        assert_eq!(
            c.line(&s(&["a-origen", "b-arian"])),
            "Two quotations are left out here: from Origen and from the unfinished work on Matthew."
        );
        assert_eq!(
            c.gone(&s(&["a-origen", "b-arian", "a-origen"])),
            "The Church Fathers' quotations on this passage are left out: two from Origen and one from the unfinished work on Matthew."
        );
        assert_eq!(c.whys(&s(&["b-arian", "a-origen", "b-arian"])), vec!["W2.", "W1."]);
    }

    #[test]
    fn reads_a_leading_citation() {
        assert_eq!(leading_tag("(Chrys. Op. imp, Hom. 53. Matt. 8:22, 25.) Or as"), Some("Chrys. Op. imp, Hom. 53. Matt. 8:22, 25."));
        assert_eq!(leading_tag("Or as the prisons (of kings)"), None);
    }
}
