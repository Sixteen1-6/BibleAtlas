//! Every form of each root, and its family of related words.
//!
//! - Forms: a root's uses grouped by grammar (ἀγάπη, ἀγάπης, ἀγάπην are one
//!   root in three cases), each shown as it is most often spelled, and which
//!   form each of the root's postings is, so the site can light one form.
//! - Family: the words a root comes from and the words that come from it.
//!   Derivations come from the "derivation" line of Strong's dictionaries
//!   (Open Scriptures JSON): ἀγάπη is "from G25 (ἀγαπάω)", so ἀγάπη, ἀγαπάω and
//!   ἀγαπητός ("from G25") are one family. Senses, spellings, forms and the
//!   Aramaic twin of a word come from STEPBible's lexicons (TBESH, TBESG).
//!
//! A wrong relative misleads and a missing one does not, so only plain
//! statements count. Left out: guesses ("perhaps", "probably", "akin to"),
//! links that rest on an older sense the reader cannot see ("in the sense of",
//! "through the idea of"), contrasts ("whereas", "in distinction from"),
//! compounds of two words (except a Greek word built on a prefix, as
//! ἐξέρχομαι on ἔρχομαι), a primitive root's cross-references, and names.
//! A family is one step around the word (where it comes from, what comes from
//! it, words from the same parent), never a chain of chains, which in Strong's
//! quickly reaches unrelated words. The one exception is a feminine or plural
//! of a word that plainly comes from another (אַהֲבָה, love, through אַהַב to
//! אָהֵב, to love).
//!
//! Output: `forms/<shard>.json`, one entry per root as the lexicon shards are:
//! `{"f": [[spelling, grammar, count], ...], "o": [form per posting], "r": [[root, relation, word], ...]}`
//! with "o" left out when the root has one form (-1 marks a use the source's
//! parts don't line up for) and "r" when it has no family. In "r", `word` is
//! the most used root of the relative's dictionary word, so the site shows one
//! row per word while lighting and underlining every sense. Relations: "p"
//! comes from (parent), "c" comes from this (child), "s" shares its root, "a"
//! the same word in the other language (Hebrew and Aramaic), "n" another sense
//! of the same word.

use crate::parse::Word;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::Path;

/// Strong's number as the roots key it: "G26" -> "G0026".
fn base(lang: char, digits: &str) -> String {
    format!("{lang}{:0>4}", digits)
}

/// Words that make a derivation a guess rather than a statement (whole words).
const GUESSES: [&str; 8] = ["perhaps", "probably", "akin", "apparently", "uncertain", "possibly", "doubtful", "compare"];

/// Greek prefixes (prepositions, the negative alpha, εὖ, δυσ-) that a compound
/// is built from: ἐξέρχομαι is "from G1537 (ἐκ) and G2064 (ἔρχομαι)".
const PREFIXES: [&str; 20] = [
    "G0001", "G0303", "G0473", "G0575", "G1223", "G1418", "G1519", "G1537", "G1722", "G1909", "G2095", "G2596", "G3326", "G3844", "G4012", "G4253", "G4314", "G4862", "G5228", "G5259",
];

/// Strong's own slips and folk etymologies that no text rule can tell from a
/// plain derivation (checked against the Greek lexicons).
const REMAP: [(&str, &str); 3] = [
    ("G5043", "G5088"), // τέκνον: "the base of G5098 (τιμωρία)" is a typo for τίκτω
    ("G4159", "G4226"), // πόθεν comes from ποῦ, not πόσις, drink
    ("G4006", "G3982"), // πεποίθησις comes from πείθω, not πάσχω
];
const NO_PARENT: [&str; 13] = [
    "G4983", // σῶμα is not from σῴζω
    "G0740", "G0706", "G0759", "G0741", // ἄρτος, ἀριθμός, ἄρωμα, ἀρτύω are not from αἴρω
    "G1401", "G1218", "G1189", "G1163", // δοῦλος, δῆμος, δέομαι, δεῖ: δέω "bind" and δέω "lack" are merged
    "G3319", // μέσος is not from μετά
    "G5045", "G5078", "G5115", // τέκτων, τέχνη, τόξον
];

/// What one Strong's derivation line says about its word.
#[derive(Debug, PartialEq)]
pub enum Link {
    /// It comes from this word. `form_of`: it is a feminine, masculine, plural
    /// or dual of it. `plain`: the line says nothing but "from X".
    Parent { of: String, form_of: bool, plain: bool },
    /// It shares a root with this word ("from the same as X").
    Same(String),
    /// A Greek compound of a prefix and this word.
    Head(String),
}

/// The derivation links of both Strong's dictionaries, by Strong's number.
#[derive(Default)]
pub struct Derivations {
    pub parent: HashMap<String, String>,
    pub head: HashMap<String, String>,
    pub same: Vec<(String, String)>,
    pub form_of: HashSet<String>,
    pub plain: HashSet<String>,
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
        let def = e["strongs_def"].as_str().unwrap_or("");
        match classify(lang, &me, der, def, &known) {
            Some(Link::Parent { of, form_of, plain }) => {
                if form_of {
                    d.form_of.insert(me.clone());
                }
                if plain {
                    d.plain.insert(me.clone());
                }
                d.parent.insert(me, of);
            }
            Some(Link::Same(x)) => d.same.push((me, x)),
            Some(Link::Head(x)) => {
                d.head.insert(me, x);
            }
            None => {}
        }
    }
    if lang == 'G' {
        for (from, to) in REMAP {
            d.parent.insert(from.to_string(), to.to_string());
            d.plain.remove(from);
        }
        for w in NO_PARENT {
            d.parent.remove(w);
        }
    }
    Ok(dict.len())
}

/// Read one derivation line. `def` is the definition, where the Greek JSON
/// sometimes carries the rest of a compound (" and G3739 (ὅς)...").
pub fn classify(lang: char, me: &str, der: &str, def: &str, known: &HashSet<String>) -> Option<Link> {
    let mut text = der.to_string();
    if lang == 'G' && def.starts_with(char::is_whitespace) && def.trim_start().starts_with("and ") {
        text.push(' ');
        text.push_str(def.split(';').next().unwrap_or(""));
    }
    // Text after a contrast is about another word: μή "(whereas G3756 (οὐ) ...)".
    let lower = text.to_ascii_lowercase();
    let cut = ["whereas", "in distinction from", "but not so"].iter().filter_map(|p| lower.find(p)).min().unwrap_or(lower.len());
    let text = &text[..cut];
    let lower = &lower[..cut];
    if lower.split(|c: char| !c.is_ascii_alphabetic()).any(|w| GUESSES.contains(&w)) || lower.contains("through the idea") {
        return None;
    }
    // A sense the reader can't see links words that look unrelated (gate from "to calculate").
    if lang == 'H' && (lower.contains("in the sense of") || lower.contains("original sense")) {
        return None;
    }
    if lang == 'G' && lower.contains("derivative") && lower.contains("(meaning") {
        return None;
    }
    let primitive = lower.contains("primitive") || (lower.contains("primary") && !lower.contains("primary sense"));
    if primitive && !(lower.contains("denominativ") || lower.contains("corresponding to") || lower.contains("alternate of")) {
        return None;
    }
    // Numbers inside brackets are quotations and asides, not the derivation.
    let bare = strip_parens(text);
    let ls = bare.to_ascii_lowercase();
    if lang == 'G' {
        if let Some(link) = head_compound(&ls, known) {
            return Some(link);
        }
    }
    let refs: Vec<String> = refs_in(&bare, lang).into_iter().filter(|r| r != me && known.contains(r)).collect();
    if refs.len() != 1 || (lang == 'G' && refs[0] == "G0001") {
        return None;
    }
    let x = refs[0].clone();
    // A compound whose other part has no number: "from G575 (ἀπό) and (to slay)".
    let clause = ls.split(';').find(|c| refs_in(&c.to_uppercase(), lang).contains(&x)).unwrap_or(&ls);
    if !clause.contains("and mean") {
        let words: Vec<&str> = clause.split(|c: char| !c.is_ascii_alphanumeric()).filter(|w| !w.is_empty()).collect();
        let from = words.iter().position(|w| *w == "from").or_else(|| words.windows(2).position(|p| p[1] == "of" && (p[0] == "compound" || p[0] == "comparative")));
        if from.is_some_and(|f| words[f..].contains(&"and")) {
            return None;
        }
    }
    if lower.contains("corresponding to") {
        // The same word in the other language is linked from TBESH; only a
        // shared root is said here.
        if ["root corresponding to", "a form corresponding to", "masculine corresponding to"].iter().any(|p| lower.contains(p)) {
            return Some(Link::Same(x));
        }
        return None;
    }
    if lower.contains("identical with") {
        return None;
    }
    if lower.contains("the same as") {
        return Some(Link::Same(x));
    }
    let form_of = ["feminine of", "masculine of", "plural of", "dual of"].iter().any(|p| lower.contains(p))
        && !lower.contains("irregular")
        && !lower.contains("a form of")
        && !ls.contains(&format!(" for {}", lang.to_ascii_lowercase()));
    Some(Link::Parent { plain: is_plain(&quoted_words_out(lower), lang), of: x, form_of })
}

/// Text with every bracketed aside removed; an unclosed bracket runs to the
/// end of its clause.
fn strip_parens(s: &str) -> String {
    let mut out = String::new();
    let mut depth = 0usize;
    for c in s.chars() {
        match c {
            '(' => depth += 1,
            ')' if depth > 0 => depth -= 1,
            ';' if depth > 0 => {
                depth = 0;
                out.push(c);
            }
            _ if depth == 0 => out.push(c),
            _ => {}
        }
    }
    out
}

/// Text without the bracketed words a number quotes ("G25 (ἀγαπάω)"), but
/// with every bracketed aside in English.
fn quoted_words_out(s: &str) -> String {
    let mut out = String::new();
    let mut rest = s;
    while let Some(i) = rest.find('(') {
        let Some(j) = rest[i..].find(')') else { break };
        let inner = &rest[i + 1..i + j];
        out.push_str(&rest[..i]);
        if inner.chars().any(|c| c.is_ascii_alphabetic()) {
            out.push_str(&rest[i..=i + j]);
        }
        rest = &rest[i + j + 1..];
    }
    out.push_str(rest);
    out
}

/// "from H157;" and nothing else, perhaps after other spellings ("or X;").
fn is_plain(ls: &str, lang: char) -> bool {
    let mut t = ls.trim();
    while let Some(rest) = t.strip_prefix("or ") {
        match rest.find(';') {
            Some(i) => t = rest[i + 1..].trim(),
            None => return false,
        }
    }
    let Some(rest) = t.strip_prefix("from ") else { return false };
    let rest = rest.trim_start();
    let Some(num) = rest.strip_prefix(lang.to_ascii_lowercase()) else { return false };
    let digits = num.find(|c: char| !c.is_ascii_digit()).unwrap_or(num.len());
    digits > 0 && matches!(num[digits..].trim(), "" | ";")
}

/// "from [a compound of] G<prefix> and [a derivative of | the base of] G<x>",
/// a Greek word built on a prefix: linked to the word it is built on.
fn head_compound(ls: &str, known: &HashSet<String>) -> Option<Link> {
    let t = ls.split_whitespace().collect::<Vec<_>>().join(" ");
    let t = t.trim_end_matches(';').trim_end();
    let t = t.strip_prefix("middle voice ").or_else(|| t.strip_prefix("passive voice ")).unwrap_or(t);
    let t = t.strip_prefix("from ")?;
    let t = t.strip_prefix("a compound of ").unwrap_or(t);
    let (p, rest) = t.split_once(' ')?;
    let rest = rest.strip_prefix("and ")?;
    let (shared, rest) = match rest.strip_prefix("the base of ") {
        Some(r) => (true, r),
        None => (false, rest.strip_prefix("a derivative of ").or_else(|| rest.strip_prefix("a presumed derivative of ")).unwrap_or(rest)),
    };
    let num = |s: &str| -> Option<String> { s.strip_prefix('g').filter(|n| !n.is_empty() && n.chars().all(|c| c.is_ascii_digit())).map(|n| base('G', n.trim_start_matches('0'))) };
    let (p, x) = (num(p)?, num(rest.trim())?);
    if !PREFIXES.contains(&p.as_str()) || !known.contains(&p) || !known.contains(&x) {
        return None;
    }
    Some(if shared { Link::Same(x) } else { Link::Head(x) })
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
    /// A name (a person, place or title): no family, and in none.
    pub name: bool,
    /// The lexicon headword and its word type, to tell homonyms apart.
    pub word: &'a str,
    pub morph: &'a str,
    pub gloss: &'a str,
    /// TBESH/TBESG entry, relation and target (see parse::LexEntry).
    pub estrong: &'a str,
    pub relation: &'a str,
    pub target: &'a str,
}

/// Most relatives (dictionary words, not senses) listed for one word.
const MAX_FAMILY: usize = 32;
/// A sense split off a Strong's number that holds no more than this share of
/// its uses is a homonym that Strong's derivations are not about (מָלַךְ "to
/// advise" beside מָלַךְ "to reign").
const MINOR: f64 = 0.02;

/// A sense that is part of a name: "Valley (of Achor)", "(Huram)-abi".
fn name_piece(gloss: &str) -> bool {
    let b = gloss.as_bytes();
    gloss.contains("-(")
        || gloss.match_indices('(').any(|(i, _)| {
            (i == 0 || b[i - 1] == b' ') && {
                let rest = &gloss[i + 1..];
                rest.starts_with(|c: char| c.is_ascii_uppercase()) || rest.starts_with("of ") || rest.starts_with("Of ") || rest.starts_with("the ")
            }
        })
}

/// The letters of a headword, to tell homonyms (same letters, same word type)
/// from different words filed under one number.
fn letters(word: &str) -> String {
    word.chars().filter(|c| matches!(c, '\u{05D0}'..='\u{05EA}') || (c.is_alphabetic() && !matches!(c, '\u{0591}'..='\u{05C7}'))).collect()
}

/// A root's forms in posting order: (grammar, uses, spellings without an
/// ending, spellings with one).
type FormGroup = (String, u32, HashMap<String, u32>, HashMap<String, u32>);

fn most_used(m: &HashMap<String, u32>) -> Option<&str> {
    m.iter().max_by(|a, b| a.1.cmp(b.1).then(b.0.cmp(a.0))).map(|x| x.0.as_str())
}

/// One `forms/<shard>.json` entry per root.
pub fn build(roots: &[Root], words: &[Vec<Word>], l_off: &[u32], l_verse: &[u32], l_pos: &[u16], d: &Derivations) -> Vec<Value> {
    let n = roots.len();
    let families = Families::new(roots, d);
    (0..n)
        .map(|i| {
            // Forms, read from the postings themselves so "o" lines up with them.
            let mut g: Vec<FormGroup> = Vec::new();
            let mut posting: Vec<Option<usize>> = Vec::new();
            for k in l_off[i] as usize..l_off[i + 1] as usize {
                let f = &words[l_verse[k] as usize][l_pos[k] as usize].form;
                if f.code.is_empty() {
                    posting.push(None);
                    continue;
                }
                let at = g.iter().position(|x| x.0 == f.code).unwrap_or_else(|| {
                    g.push((f.code.clone(), 0, HashMap::new(), HashMap::new()));
                    g.len() - 1
                });
                g[at].1 += 1;
                if f.ending {
                    *g[at].3.entry(f.full.clone()).or_default() += 1;
                } else {
                    *g[at].2.entry(f.plain.clone()).or_default() += 1;
                }
                posting.push(Some(at));
            }
            let mut order: Vec<usize> = (0..g.len()).collect();
            order.sort_by(|&x, &y| g[y].1.cmp(&g[x].1).then(g[x].0.cmp(&g[y].0)));
            let mut rank = vec![0i64; g.len()];
            for (k, &x) in order.iter().enumerate() {
                rank[x] = k as i64;
            }
            let forms: Vec<Value> = order
                .iter()
                .map(|&x| {
                    // The word on its own where it ever stands alone in this form,
                    // else with its ending (מִמֶּנּוּ, never the bare מִמֶּ).
                    let spelling = most_used(&g[x].2).or_else(|| most_used(&g[x].3)).unwrap_or("");
                    json!([spelling, g[x].0, g[x].1])
                })
                .collect();
            let mut o = serde_json::Map::new();
            o.insert("f".into(), Value::Array(forms));
            if g.len() > 1 || posting.iter().any(Option::is_none) {
                o.insert("o".into(), json!(posting.iter().map(|p| p.map_or(-1, |x| rank[x])).collect::<Vec<_>>()));
            }
            let rel = families.of(i);
            if !rel.is_empty() {
                o.insert("r".into(), json!(rel.iter().map(|(j, c, w)| json!([j, c.to_string(), w])).collect::<Vec<_>>()));
            }
            Value::Object(o)
        })
        .collect()
}

/// Dictionary words (senses grouped) and the links between them.
struct Families<'a> {
    roots: &'a [Root<'a>],
    d: &'a Derivations,
    /// Each root's dictionary word (index into `members`), when it can be in a family.
    word: Vec<Option<usize>>,
    /// Each word's senses, most used first, and their total uses.
    members: Vec<Vec<u32>>,
    total: Vec<u32>,
    /// Words under each Strong's number, most used first.
    by_base: HashMap<&'a str, Vec<usize>>,
    children: HashMap<&'a str, Vec<&'a str>>,
    heads: HashMap<&'a str, Vec<&'a str>>,
    /// Words that are a feminine (etc.) of a word that plainly comes from this one.
    grandchildren: HashMap<&'a str, Vec<&'a str>>,
    same: HashMap<&'a str, Vec<&'a str>>,
    /// Word-level links from the lexicons: the other language's twin, and forms or spellings of another word.
    twins: HashMap<usize, Vec<usize>>,
    forms_of: HashMap<usize, Vec<usize>>,
}

impl<'a> Families<'a> {
    fn new(roots: &'a [Root<'a>], d: &'a Derivations) -> Self {
        let n = roots.len();
        let index: HashMap<&str, usize> = roots.iter().enumerate().map(|(i, r)| (r.key, i)).collect();
        // Senses of one dictionary word: the same lexicon entry, or a meaning
        // or spelling of another sense.
        let mut uf: Vec<usize> = (0..n).collect();
        fn find(uf: &mut [usize], mut x: usize) -> usize {
            while uf[x] != x {
                uf[x] = uf[uf[x]];
                x = uf[x];
            }
            x
        }
        let mut by_entry: HashMap<&str, usize> = HashMap::new();
        for (i, r) in roots.iter().enumerate() {
            if !r.estrong.is_empty() {
                let first = *by_entry.entry(r.estrong).or_insert(i);
                let (a, b) = (find(&mut uf, i), find(&mut uf, first));
                uf[a] = b;
            }
            // Within one language: σάββατον is "a Spelling of" שַׁבָּת, a loanword, not a sense of it.
            if r.relation.contains("Meaning of") || r.relation.contains("Spelling of") {
                if let Some(&t) = index.get(r.target).filter(|&&t| roots[t].key[..1] == r.key[..1]) {
                    let (a, b) = (find(&mut uf, i), find(&mut uf, t));
                    uf[a] = b;
                }
            }
        }
        let in_family = |r: &Root| !r.name && !name_piece(r.gloss);
        let mut slot: HashMap<usize, usize> = HashMap::new();
        let mut members: Vec<Vec<u32>> = Vec::new();
        let mut word = vec![None; n];
        let mut order: Vec<usize> = (0..n).collect();
        order.sort_by(|&x, &y| roots[y].count.cmp(&roots[x].count).then(x.cmp(&y)));
        for i in order {
            if !in_family(&roots[i]) {
                continue;
            }
            let g = find(&mut uf, i);
            let w = *slot.entry(g).or_insert_with(|| {
                members.push(Vec::new());
                members.len() - 1
            });
            members[w].push(i as u32);
            word[i] = Some(w);
        }
        let total: Vec<u32> = members.iter().map(|m| m.iter().map(|&i| roots[i as usize].count).sum()).collect();
        let mut by_base: HashMap<&str, Vec<usize>> = HashMap::new();
        for (w, m) in members.iter().enumerate() {
            let b = &roots[m[0] as usize].key[..5];
            let v = by_base.entry(b).or_default();
            if !v.contains(&w) {
                v.push(w);
            }
        }
        for v in by_base.values_mut() {
            v.sort_by(|&x, &y| total[y].cmp(&total[x]).then(x.cmp(&y)));
        }
        let mut children: HashMap<&str, Vec<&str>> = HashMap::new();
        for (c, p) in &d.parent {
            children.entry(p.as_str()).or_default().push(c.as_str());
        }
        let mut heads: HashMap<&str, Vec<&str>> = HashMap::new();
        for (c, p) in &d.head {
            heads.entry(p.as_str()).or_default().push(c.as_str());
        }
        let mut grandchildren: HashMap<&str, Vec<&str>> = HashMap::new();
        for w in &d.form_of {
            if let Some(m) = d.parent.get(w).filter(|m| d.plain.contains(*m)) {
                if let Some(g) = d.parent.get(m) {
                    grandchildren.entry(g.as_str()).or_default().push(w.as_str());
                }
            }
        }
        let mut same: HashMap<&str, Vec<&str>> = HashMap::new();
        for (a, b) in &d.same {
            same.entry(a.as_str()).or_default().push(b.as_str());
            same.entry(b.as_str()).or_default().push(a.as_str());
        }
        for v in children.values_mut().chain(heads.values_mut()).chain(grandchildren.values_mut()).chain(same.values_mut()) {
            v.sort_unstable();
            v.dedup();
        }
        let mut twins: HashMap<usize, Vec<usize>> = HashMap::new();
        let mut forms_of: HashMap<usize, Vec<usize>> = HashMap::new();
        for (i, r) in roots.iter().enumerate() {
            let map = if r.relation.contains("in Aramaic of") || r.relation.contains("in Hebrew of") {
                &mut twins
            } else if r.relation.contains("Form of") {
                &mut forms_of
            } else {
                continue;
            };
            if let (Some(a), Some(b)) = (word[i], index.get(r.target).filter(|&&t| roots[t].key[..1] == r.key[..1]).and_then(|&t| word[t])) {
                if a != b {
                    map.entry(a).or_default().push(b);
                    map.entry(b).or_default().push(a);
                }
            }
        }
        Families { roots, d, word, members, total, by_base, children, heads, grandchildren, same, twins, forms_of }
    }

    /// The words under a Strong's number that its derivations are about: all
    /// but the homonyms that hold a tiny share of its uses.
    fn major(&self, b: &str) -> Vec<usize> {
        let Some(ws) = self.by_base.get(b) else { return Vec::new() };
        let sum: u32 = ws.iter().map(|&w| self.total[w]).sum();
        ws.iter().enumerate().filter(|&(k, &w)| k == 0 || self.total[w] as f64 > MINOR * sum as f64).map(|(_, &w)| w).collect()
    }

    fn all(&self, b: &str) -> Vec<usize> {
        self.by_base.get(b).cloned().unwrap_or_default()
    }

    /// Homonyms: two words filed under one number with the same letters and word type.
    fn homonyms(&self, x: usize, y: usize) -> bool {
        let (a, b) = (&self.roots[self.members[x][0] as usize], &self.roots[self.members[y][0] as usize]);
        letters(a.word) == letters(b.word) && a.morph == b.morph
    }

    /// Root i's relatives: (root, relation, the root heading its word).
    fn of(&self, i: usize) -> Vec<(u32, char, u32)> {
        let Some(me) = self.word[i] else { return Vec::new() };
        let r = &self.roots[i];
        let b = &r.key[..5];
        let d = self.d;
        let major = self.major(b).contains(&me);
        let list = |m: Option<&Vec<&'a str>>| m.map(|v| v.to_vec()).unwrap_or_default();

        let mut p: Vec<usize> = Vec::new();
        let parent = d.parent.get(b).map(String::as_str);
        for x in parent.into_iter().chain(d.head.get(b).map(String::as_str)) {
            p.extend(self.major(x));
        }
        if let Some(m) = parent.filter(|m| d.form_of.contains(b) && d.plain.contains(*m)) {
            if let Some(g) = d.parent.get(m) {
                p.extend(self.major(g));
            }
        }
        let mut c: Vec<usize> = Vec::new();
        if major {
            for x in list(self.children.get(b)).into_iter().chain(list(self.heads.get(b))).chain(list(self.grandchildren.get(b))) {
                c.extend(self.all(x));
            }
        }
        let mut s: Vec<usize> = Vec::new();
        if let Some(m) = parent {
            for x in list(self.children.get(m)).into_iter().filter(|x| *x != b) {
                s.extend(self.all(x));
            }
        }
        for x in list(self.same.get(b)) {
            s.extend(self.major(x));
        }
        s.extend(self.all(b).into_iter().filter(|&w| w != me && !self.homonyms(me, w)));
        s.extend(self.forms_of.get(&me).cloned().unwrap_or_default());
        let a = self.twins.get(&me).cloned().unwrap_or_default();

        let mut seen: HashSet<usize> = HashSet::from([me]);
        let mut out: Vec<(u32, char, u32)> = Vec::new();
        let mut words = 0;
        for (mut ws, rel) in [(p, 'p'), (c, 'c'), (s, 's'), (a, 'a')] {
            ws.retain(|w| seen.insert(*w));
            ws.sort_by(|&x, &y| self.total[y].cmp(&self.total[x]).then(x.cmp(&y)));
            for w in ws {
                if words == MAX_FAMILY {
                    break;
                }
                words += 1;
                let head = self.members[w][0];
                out.extend(self.members[w].iter().map(|&j| (j, rel, head)));
            }
        }
        let head = self.members[me][0];
        out.extend(self.members[me].iter().filter(|&&j| j as usize != i).map(|&j| (j, 'n', head)));
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn known(keys: &[&str]) -> HashSet<String> {
        keys.iter().map(|s| s.to_string()).collect()
    }

    fn parent(of: &str) -> Option<Link> {
        Some(Link::Parent { of: of.into(), form_of: false, plain: true })
    }

    #[test]
    fn reads_strongs_numbers() {
        assert_eq!(refs_in("from G25 (ἀγαπάω);", 'G'), vec!["G0025"]);
        assert_eq!(refs_in("from G1537 (ἐκ) and G5055 (τελέω);", 'G'), vec!["G1537", "G5055"]);
        assert_eq!(refs_in("of Hebrew origin (H08012);", 'G'), Vec::<String>::new());
        assert_eq!(refs_in("intensive from H7673 (שָׁבַת);", 'H'), vec!["H7673"]);
        assert_eq!(refs_in("from H157 or H157", 'H'), vec!["H0157"]);
    }

    #[test]
    fn reads_derivations() {
        let k = known(&["G0001", "G0025", "G0026", "G0080", "G0575", "G0615", "G2596", "G2530", "G3739", "G3361", "G3756", "G1537", "G2064", "G1831", "G0939", "G0305", "G0305"]);
        assert_eq!(classify('G', "G0026", "from G25 (ἀγαπάω);", "", &k), parent("G0025"));
        // Compounds whose other half has no number, or sits in the definition.
        assert_eq!(classify('G', "G0080", "from G1 (Α) (as a connective particle) and (the womb);", "", &k), None);
        assert_eq!(classify('G', "G0615", "from G575 (ἀπό) and (to slay);", "", &k), None);
        assert_eq!(classify('G', "G2530", "from G2596 (κατά);", " and G3739 (ὅς) and G5100 (τὶς); according to which", &k), None);
        // A contrast is not a derivation.
        assert_eq!(classify('G', "G3361", "a primary particle of qualified negation (whereas G3756 (οὐ) expresses an absolute denial);", "", &k), None);
        // A word built on a prefix.
        assert_eq!(classify('G', "G1831", "from G1537 (ἐκ) and G2064 (ἔρχομαι);", "", &k), Some(Link::Head("G2064".into())));
        assert_eq!(classify('G', "G0305", "from G303 (ἀνά) and the base of G939 (βάσις);", "", &k), None);
        let k = known(&["G0303", "G0939", "G0305"]);
        assert_eq!(classify('G', "G0305", "from G303 (ἀνά) and the base of G939 (βάσις);", "", &k), Some(Link::Same("G0939".into())));

        let k = known(&["H0157", "H0158", "H0160", "H4467", "H4468", "H8179", "H8176", "H3027", "H3709", "H0559", "H0560", "H5375", "H0007"]);
        assert_eq!(
            classify('H', "H0160", "feminine of H158 (אַהַב) and meaning the same", "", &k),
            Some(Link::Parent { of: "H0158".into(), form_of: true, plain: false })
        );
        assert_eq!(classify('H', "H0158", "from H157 (אָהַב);", "", &k), parent("H0157"));
        assert_eq!(classify('H', "H4468", "a form of H4467 (מַמְלָכָה) and equiv. to it", "", &k), Some(Link::Parent { of: "H4467".into(), form_of: false, plain: false }));
        assert_eq!(classify('H', "H8179", "from H8176 (שָׁעַר) in its original sense;", "", &k), None);
        assert_eq!(classify('H', "H3027", "a primitive word; in distinction from H3709 (כַּף)", "", &k), None);
        assert_eq!(classify('H', "H0560", "(Aramaic) corresponding to H559 (אָמַר)", "", &k), None);
        assert_eq!(classify('H', "H5375", "a primitive root; (Psalm 4:6 (H7 (אֲבַד)))", "", &k), None);
        // "akin" only as a whole word.
        let k = known(&["H7038", "H4733"]);
        assert_eq!(classify('H', "H4733", "from H7038 in the sense of taking in", "", &k), None);
        let k = known(&["G2192", "G1836"]);
        assert_eq!(classify('G', "G1836", "from G2192 (ἔχω) (in the sense of taking hold of);", "", &k), Some(Link::Parent { of: "G2192".into(), form_of: false, plain: false }));
    }

    #[test]
    fn spots_name_pieces() {
        for g in ["Valley (of Achor)", "(Huram)-abi", "Lebo-(Hamath)", "Fish (Gate)"] {
            assert!(name_piece(g), "{g}");
        }
        for g in ["if: except", "queen", "to do/make: spend(TIME)", "eye: before(the eyes)", "son"] {
            assert!(!name_piece(g), "{g}");
        }
    }
}
