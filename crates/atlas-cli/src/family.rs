//! Every form of each root, and its family of related words.
//!
//! - Forms: a root's occurrences grouped by grammar (ἀγάπη, ἀγάπης, ἀγάπην
//!   are one root in three cases), with the most common spelling of each, and
//!   which form each of the root's postings is, so the site can light one form.
//! - Family: the words a root comes from and the words that come from it, by
//!   the "derivation" line of Strong's dictionaries (Open Scriptures JSON): ἀγάπη
//!   "from G25 (ἀγαπάω)", so ἀγάπη, ἀγαπάω and ἀγαπητός ("from G25") are one
//!   family. Only plain single-word derivations count. Guesses ("perhaps",
//!   "probably", "akin to"), compounds ("from G1537 and G5055") and names are
//!   left out, and the family is one step around the word (where it comes from,
//!   what comes from it, its siblings), never a chain of chains, which in
//!   Strong's quickly reaches unrelated words.
//!
//! Output: `forms/<shard>.json`, one entry per root as the lexicon shards are:
//! `{"f": [[spelling, grammar, count], ...], "o": [form per posting], "r": [[root, relation], ...]}`
//! with "o" left out when the root has one form and "r" when it has no family.
//! Relations: "p" comes from (parent), "c" comes from this (child), "s" shares
//! a parent, "n" another sense under the same Strong's number.

use crate::parse::Word;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::Path;

/// Strong's number as the roots key it: "G26" -> "G0026".
fn base(lang: char, digits: &str) -> String {
    format!("{lang}{:0>4}", digits)
}

/// Words that make a derivation a guess rather than a statement.
const GUESSES: [&str; 8] = ["perhaps", "probably", "akin", "apparently", "uncertain", "possibly", "doubtful", "compare"];

/// The derivation links in one Strong's dictionary file: word -> the word it
/// comes from, and pairs of words said to come from "the same as" each other.
#[derive(Default)]
pub struct Derivations {
    pub parent: HashMap<String, String>,
    pub same: Vec<(String, String)>,
}

pub fn derivations(path: &Path, lang: char, d: &mut Derivations) -> Result<usize, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let start = text.find("Dictionary = ").map(|i| i + "Dictionary = ".len()).ok_or_else(|| format!("{}: no dictionary object", path.display()))?;
    let end = text.rfind('}').ok_or_else(|| format!("{}: unterminated dictionary", path.display()))?;
    let dict: BTreeMap<String, Value> = serde_json::from_str(&text[start..=end]).map_err(|e| format!("parsing {}: {e}", path.display()))?;
    let known: HashSet<String> = dict.keys().filter_map(|k| k.strip_prefix(lang).map(|n| base(lang, n))).collect();
    for (k, e) in &dict {
        let Some(n) = k.strip_prefix(lang) else { continue };
        let me = base(lang, n);
        let der = e["derivation"].as_str().unwrap_or("");
        let lower = der.to_lowercase();
        if GUESSES.iter().any(|g| lower.contains(g)) {
            continue;
        }
        let refs = refs_in(der, lang).into_iter().filter(|r| *r != me && known.contains(r)).collect::<Vec<_>>();
        if refs.len() != 1 {
            continue;
        }
        if lower.contains("the same as") {
            d.same.push((me, refs[0].clone()));
        } else {
            d.parent.insert(me, refs[0].clone());
        }
    }
    Ok(dict.len())
}

/// Distinct Strong's numbers of one language mentioned in a derivation line.
fn refs_in(s: &str, lang: char) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let cs: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < cs.len() {
        if cs[i] == lang && (i == 0 || !cs[i - 1].is_alphanumeric()) {
            let mut j = i + 1;
            while j < cs.len() && cs[j].is_ascii_digit() {
                j += 1;
            }
            if j > i + 1 && (j == cs.len() || !cs[j].is_alphanumeric()) {
                let r = base(lang, cs[i + 1..j].iter().collect::<String>().trim_start_matches('0'));
                if !out.contains(&r) {
                    out.push(r);
                }
            }
            i = j;
        } else {
            i += 1;
        }
    }
    out
}

pub struct Root<'a> {
    pub key: &'a str,
    pub count: u32,
    /// A name (a person, place or title): kept out of families.
    pub name: bool,
}

/// One grammar of a root: its code, how often each spelling is used, and its count.
type FormGroup = (String, HashMap<String, u32>, u32);

/// Most relatives listed for one word.
const MAX_FAMILY: usize = 24;

/// One `forms/<shard>.json` entry per root.
pub fn build(roots: &[Root], words: &[Vec<Word>], lemma_index: &HashMap<&str, u32>, l_off: &[u32], d: &Derivations) -> Vec<Value> {
    // --- Forms --------------------------------------------------------------
    // Per root: grammar -> (form id, spelling counts, count), in posting order.
    let n = roots.len();
    let mut groups: Vec<Vec<FormGroup>> = vec![Vec::new(); n];
    let mut posting_form: Vec<Vec<u32>> = vec![Vec::new(); n];
    for vw in words {
        for w in vw.iter().filter(|w| w.main) {
            let Some(&r) = w.lemma.as_deref().and_then(|k| lemma_index.get(k)) else { continue };
            let g = &mut groups[r as usize];
            let (spelling, grammar) = &w.form;
            let at = match g.iter().position(|x| x.0 == *grammar) {
                Some(i) => i,
                None => {
                    g.push((grammar.clone(), HashMap::new(), 0));
                    g.len() - 1
                }
            };
            *g[at].1.entry(spelling.clone()).or_default() += 1;
            g[at].2 += 1;
            posting_form[r as usize].push(at as u32);
        }
    }

    // --- Family -------------------------------------------------------------
    let mut by_base: HashMap<&str, Vec<u32>> = HashMap::new();
    for (i, r) in roots.iter().enumerate() {
        if !r.name {
            by_base.entry(&r.key[..5]).or_default().push(i as u32);
        }
    }
    let mut children: HashMap<&str, Vec<&str>> = HashMap::new();
    for (c, p) in &d.parent {
        children.entry(p.as_str()).or_default().push(c.as_str());
    }
    let mut same: HashMap<&str, Vec<&str>> = HashMap::new();
    for (a, b) in &d.same {
        same.entry(a.as_str()).or_default().push(b.as_str());
        same.entry(b.as_str()).or_default().push(a.as_str());
    }

    (0..n)
        .map(|i| {
            let root = &roots[i];
            // Forms, most used first; each spelled as it is most often spelled.
            let g = &groups[i];
            let mut order: Vec<usize> = (0..g.len()).collect();
            order.sort_by(|&x, &y| g[y].2.cmp(&g[x].2).then(g[x].0.cmp(&g[y].0)));
            let mut rank = vec![0u32; g.len()];
            for (k, &x) in order.iter().enumerate() {
                rank[x] = k as u32;
            }
            let forms: Vec<Value> = order
                .iter()
                .map(|&x| {
                    let mut sp: Vec<(&String, &u32)> = g[x].1.iter().collect();
                    sp.sort_by(|a, b| b.1.cmp(a.1).then(a.0.cmp(b.0)));
                    json!([sp.first().map_or("", |s| s.0.as_str()), g[x].0, g[x].2])
                })
                .collect();
            let mut o = serde_json::Map::new();
            o.insert("f".into(), Value::Array(forms));
            if g.len() > 1 {
                debug_assert_eq!(posting_form[i].len() as u32, l_off[i + 1] - l_off[i]);
                o.insert("o".into(), json!(posting_form[i].iter().map(|&f| rank[f as usize]).collect::<Vec<_>>()));
            }

            if !root.name {
                let me = &root.key[..5];
                let mut rel: Vec<(u32, char)> = Vec::new();
                let mut seen: HashSet<u32> = HashSet::from([i as u32]);
                let mut add = |bases: &[&str], c: char, rel: &mut Vec<(u32, char)>| {
                    let mut found: Vec<u32> = bases.iter().flat_map(|b| by_base.get(b).cloned().unwrap_or_default()).filter(|j| seen.insert(*j)).collect();
                    found.sort_by(|&x, &y| roots[y as usize].count.cmp(&roots[x as usize].count).then(x.cmp(&y)));
                    rel.extend(found.into_iter().map(|j| (j, c)));
                };
                add(&[me], 'n', &mut rel);
                let parent = d.parent.get(me).map(String::as_str);
                if let Some(p) = parent {
                    add(&[p], 'p', &mut rel);
                }
                add(children.get(me).map(Vec::as_slice).unwrap_or(&[]), 'c', &mut rel);
                let mut sibs: Vec<&str> = same.get(me).cloned().unwrap_or_default();
                if let Some(p) = parent {
                    sibs.extend(children.get(p).map(Vec::as_slice).unwrap_or(&[]).iter().copied().filter(|s| *s != me));
                }
                add(&sibs, 's', &mut rel);
                rel.truncate(MAX_FAMILY);
                if !rel.is_empty() {
                    o.insert("r".into(), json!(rel.iter().map(|(j, c)| json!([j, c.to_string()])).collect::<Vec<_>>()));
                }
            }
            Value::Object(o)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_strongs_numbers() {
        assert_eq!(refs_in("from G25 (ἀγαπάω);", 'G'), vec!["G0025"]);
        assert_eq!(refs_in("from G1537 (ἐκ) and G5055 (τελέω);", 'G'), vec!["G1537", "G5055"]);
        assert_eq!(refs_in("of Hebrew origin (H08012);", 'G'), Vec::<String>::new());
        assert_eq!(refs_in("intensive from H7673 (שָׁבַת);", 'H'), vec!["H7673"]);
        assert_eq!(refs_in("from H157 or H157", 'H'), vec!["H0157"]);
    }
}
