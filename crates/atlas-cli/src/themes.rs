//! Themes: specific Hebrew, Aramaic and Greek words traced through the whole
//! Bible (`config/themes.json`), never hand-picked verses, so every lit verse
//! can be checked against the original text.
//!
//! - [`build`] resolves and validates the config against the root table and
//!   writes `themes.json` plus the theme fields of `meta.json`.
//! - [`near`] counts how often two themes are joined by the app's own
//!   cross-references ("Often linked with").
//! - [`Links::through`] is the rule for reaching a theme through a verse's
//!   strongest links when its own words carry none. The app runs the same
//!   rule in the browser from `meta.themeLinks`; `atlas verify` runs this copy
//!   for its pins.
//! - [`resolve_related`] checks `config/theme-related.json`, the reviewed list
//!   of related words (a word of the same family as one of a theme's words),
//!   and [`Related`] is the rule for reaching a theme through one. A related
//!   word is only ever a labelled reason on a verse's card: it never adds a
//!   verse or a root to a theme.
//! - [`verify`] checks the written data, for `atlas verify`.

use crate::loaded::Loaded;
use atlas_core::canon::Testament;
use atlas_core::{refs, Versification, XrefGraph, BOOKS};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::cmp::Reverse;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::Path;

pub const OUT: &str = "themes.json";
const CONFIG: &str = "config/themes.json";
pub const RELATED: &str = "config/theme-related.json";

/// How a related word may be tied to a theme's word, in the word families
/// (family.rs): another form of the same word, the word it comes from, a word
/// that comes from it, a word sharing its root, or the same word in Hebrew or
/// Aramaic. Never `n`, another sense of the same word: themes choose their
/// senses on purpose.
pub const RELATIONS: [char; 5] = ['f', 'p', 'c', 's', 'a'];

/// One tie in a word family: `(root, relation, root)`.
pub type FamilyLink = (u32, char, u32);

/// The first themes, in order. Shared links name themes by id (#t=lamb), so
/// these never change and new themes are only ever appended.
pub const PINNED: [&str; 23] = [
    "lamb", "light", "shepherd", "vine", "bread", "water", "rock", "fire", "blood", "covenant", "seed", "bride", "temple", "tree", "way", "spirit",
    "passover", "redeemer", "atonement", "anointed", "sabbath", "kingdom", "firstborn",
];

/// Key verses per theme: at least this many and at most `KEY_MAX`.
const KEY_MIN: usize = 2;
const KEY_MAX: usize = 3;

// ------------------------------------------------------------------ config

#[derive(Deserialize)]
struct ThemeFile {
    groups: Vec<Group>,
    featured: Vec<String>,
    links: LinkRule,
    near: NearRule,
    themes: Vec<ThemeSpec>,
}

/// A plain-named row of the theme list.
#[derive(Deserialize, Serialize, Clone, Debug, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Group {
    pub id: String,
    pub name: String,
}

/// Reaching a theme through a verse's links (see `_comment` in the config).
#[derive(Deserialize, Serialize, Clone, Copy, Debug, PartialEq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct LinkRule {
    /// Fewest votes a link needs.
    pub votes: i16,
    /// How many of the verse's strongest links are read.
    pub top: usize,
    /// How many linked verses must carry a theme.
    pub carriers: usize,
    /// Or one linked verse whose link has at least this many votes.
    pub solo_votes: i16,
    /// Themes lighting more verses than this are never offered.
    pub max_theme_size: usize,
}

/// "Often linked with" (see `_comment` in the config).
#[derive(Deserialize, Serialize, Clone, Copy, Debug, PartialEq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct NearRule {
    pub votes: i16,
    pub min_links: u32,
    pub min_lift: f64,
    pub max: usize,
}

/// `meta.themeNear`: the rule plus the number of verse pairs it counted over.
#[derive(Deserialize, Serialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NearMeta {
    pub votes: i16,
    pub min_links: u32,
    pub min_lift: f64,
    pub max: usize,
    pub pairs: usize,
}

impl NearMeta {
    pub fn rule(&self) -> NearRule {
        NearRule { votes: self.votes, min_links: self.min_links, min_lift: self.min_lift, max: self.max }
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ThemeSpec {
    id: String,
    name: String,
    group: String,
    #[serde(default)]
    level: Option<String>,
    blurb: String,
    key_verses: Vec<String>,
    /// Strong's numbers that take a verse out of the theme when they occur in it.
    #[serde(default)]
    skip_with: Vec<String>,
    roots: Vec<ThemeRoot>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ThemeRoot {
    strong: String,
    #[serde(rename = "match")]
    matches: Vec<String>,
    /// Sub-entries left out although their gloss matches ("H2233I", seed: semen).
    #[serde(default)]
    exclude: Vec<String>,
    /// Keep glosses that start with a capital letter ("Passover", "Christ"),
    /// which are otherwise skipped as names.
    #[serde(default)]
    capitalized: bool,
}

/// One reviewed pair of `config/theme-related.json` (see its `_comment`).
#[derive(Deserialize, Clone, Debug)]
#[serde(deny_unknown_fields)]
pub struct RelatedSpec {
    pub theme: String,
    /// The related word's root key.
    pub root: String,
    /// The theme's own root it is related to.
    pub via: String,
    pub why: String,
    /// Lowercase BSB words: the root counts only where its English is one of them.
    #[serde(default)]
    pub english: Vec<String>,
    /// Show the word's own gloss, not the English aligned to it.
    #[serde(default)]
    pub gloss: bool,
    /// Reviewed: the root is another sense of one of the theme's words.
    #[serde(default)]
    pub sense: bool,
    /// Verses ("Exod 18:21") where the alignment gives the root the wrong
    /// English: it does not count there.
    #[serde(default)]
    pub not: Vec<String>,
}

#[derive(Deserialize)]
struct RelatedFile {
    related: Vec<RelatedSpec>,
}

pub fn read_related(root: &Path) -> Result<Vec<RelatedSpec>, String> {
    let raw = fs::read_to_string(root.join(RELATED)).map_err(|e| format!("reading {RELATED}: {e}"))?;
    let file: RelatedFile = serde_json::from_str(&raw).map_err(|e| format!("parsing {RELATED}: {e}"))?;
    Ok(file.related)
}

// ------------------------------------------------------------------ output

/// One entry of `themes.json`, an array in config order. The first four
/// fields are the ones the app has always read.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ThemeOut {
    pub id: String,
    pub name: String,
    pub blurb: String,
    /// Root (lemma) indices whose verses the theme lights.
    pub roots: Vec<u32>,
    /// Id of a `meta.themeGroups` entry.
    pub group: String,
    /// "simple" or "study": the lowest depth the theme shows at.
    pub level: String,
    /// Verse indices of the key verses, in config order.
    pub key_verses: Vec<u32>,
    /// Often linked with: `[theme index, links, lift]`, strongest first.
    pub near: Vec<(u32, u32, f64)>,
    /// Root indices of the senses deliberately left out (`exclude`).
    pub left: Vec<u32>,
    /// Root indices that take a verse out of the theme when present.
    pub skip_with: Vec<u32>,
    /// Related words (`config/theme-related.json`): `(root, relation, theme
    /// root)`, the relation being the theme root's tie to the related root as
    /// forms/*.json gives it ('c': the theme's word comes from it).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub related: Vec<FamilyLink>,
    /// A related root that counts only in some verses: `(root, the words its
    /// BSB English must be one of (none: any), the verses where it counts)`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub related_only: Vec<(u32, Vec<String>, Vec<u32>)>,
    /// Related roots shown by their gloss, not the English aligned to them.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub related_gloss: Vec<u32>,
}

impl ThemeOut {
    pub fn simple(&self) -> bool {
        self.level == "simple"
    }
}

/// What `build` gives `atlas build`.
pub struct Built {
    pub json: Vec<u8>,
    /// themeGroups, themeFeatured, themeLinks and themeNear for meta.json.
    pub meta: Vec<(&'static str, Value)>,
}

pub struct Sources<'a> {
    pub keys: &'a [&'a str],
    pub glosses: &'a [&'a str],
    pub counts: &'a [u32],
    pub l_off: &'a [u32],
    pub l_verse: &'a [u32],
    pub l_pos: &'a [u16],
    pub vz: &'a Versification,
    pub graph: &'a XrefGraph,
    /// Each root's family as forms/*.json has it: `(relative, relation, head)`.
    pub family: &'a [Vec<FamilyLink>],
    /// The lowercase BSB words aligned to word `pos` of verse `v`.
    pub english: &'a dyn Fn(u32, u16) -> Vec<String>,
}

/// Root indices whose key is `strong` or `strong` plus one sub-entry letter.
fn roots_named<'k>(keys: &'k [&'k str], strong: &'k str) -> impl Iterator<Item = u32> + 'k {
    keys.iter().enumerate().filter(move |(_, k)| k.starts_with(strong) && k.len() <= strong.len() + 1).map(|(i, _)| i as u32)
}

/// Every verse containing one of `roots`, minus every verse containing one of
/// `skip`, in canon order. Postings list main-edition words only.
pub fn verses(roots: &[u32], skip: &[u32], l_off: &[u32], l_verse: &[u32], n: usize) -> Vec<u32> {
    let posting = |r: u32| &l_verse[l_off[r as usize] as usize..l_off[r as usize + 1] as usize];
    let mut mask = vec![false; n];
    for &r in roots {
        for &v in posting(r) {
            mask[v as usize] = true;
        }
    }
    for &r in skip {
        for &v in posting(r) {
            mask[v as usize] = false;
        }
    }
    (0..n).filter(|&v| mask[v]).map(|v| v as u32).collect()
}

/// A single verse from a reference such as "Genesis 22:8".
fn single_verse(r: &str, vz: &Versification) -> Option<u32> {
    let q = refs::parse(r)?;
    if q.verse == 0 {
        return None;
    }
    let (a, b) = refs::resolve(q, vz)?;
    (a == b).then_some(a)
}

/// The verse references a blurb names in parentheses, such as "(Ruth 3:9)" or
/// "(Leviticus 16:21, Psalm 32:5)". A parenthesis without a chapter:verse,
/// such as "(2,172)", names none.
fn blurb_refs(blurb: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut rest = blurb;
    while let Some(i) = rest.find('(') {
        let Some(len) = rest[i..].find(')') else { break };
        let inner = &rest[i + 1..i + len];
        if inner.as_bytes().windows(3).any(|w| w[0].is_ascii_digit() && w[1] == b':' && w[2].is_ascii_digit()) {
            out.extend(inner.split([',', ';']).map(str::trim));
        }
        rest = &rest[i + len + 1..];
    }
    out
}

pub fn build(root: &Path, s: &Sources) -> Result<Built, String> {
    let path = root.join(CONFIG);
    let file: ThemeFile = serde_json::from_str(&fs::read_to_string(&path).map_err(|e| format!("reading {CONFIG}: {e}"))?)
        .map_err(|e| format!("parsing {CONFIG}: {e}"))?;
    let n = s.vz.verse_count() as usize;

    let mut group_ids = HashSet::new();
    for g in &file.groups {
        if g.id.is_empty() || g.name.trim().is_empty() || !group_ids.insert(g.id.as_str()) {
            return Err(format!("{CONFIG}: group {:?} is empty or listed twice", g.id));
        }
    }
    if file.groups.is_empty() {
        return Err(format!("{CONFIG}: no groups"));
    }
    let r = file.links;
    if r.votes < 1 || r.top < 1 || r.carriers < 1 || r.solo_votes < r.votes || r.max_theme_size < 1 {
        return Err(format!("{CONFIG}: links rule {r:?} is not sensible"));
    }
    let nr = file.near;
    if nr.votes < 1 || nr.min_links < 1 || nr.min_lift.is_nan() || nr.min_lift <= 1.0 || nr.max < 1 {
        return Err(format!("{CONFIG}: near rule {nr:?} is not sensible"));
    }

    let mut out: Vec<ThemeOut> = Vec::new();
    let mut sets: Vec<Vec<u32>> = Vec::new();
    let mut ids = HashSet::new();
    for t in &file.themes {
        if t.id.is_empty() || !t.id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit()) || !ids.insert(t.id.as_str()) {
            return Err(format!("theme {:?}: ids are lowercase letters and digits, each used once", t.id));
        }
        if t.name.trim().is_empty() || t.blurb.trim().is_empty() {
            return Err(format!("theme {}: needs a name and a blurb", t.id));
        }
        if !group_ids.contains(t.group.as_str()) {
            return Err(format!("theme {}: group {:?} is not one of the groups", t.id, t.group));
        }
        let level = match t.level.as_deref() {
            None | Some("simple") => "simple",
            Some("study") => "study",
            Some(other) => return Err(format!("theme {}: level {other:?} must be \"study\" (or left out for Simple)", t.id)),
        };

        let mut idxs: Vec<u32> = Vec::new();
        let mut left: Vec<u32> = Vec::new();
        for r in &t.roots {
            if let Some(m) = r.matches.iter().find(|m| m.is_empty() || m.chars().any(char::is_uppercase)) {
                return Err(format!("theme {}: match {m:?} for {} must be lowercase and not empty (glosses are compared in lowercase)", t.id, r.strong));
            }
            let found: Vec<u32> = roots_named(s.keys, &r.strong)
                .filter(|&i| {
                    // Skip names and places that merely contain the word
                    // ("House of Shepherds", "Water (Gate)"): their glosses
                    // start with a capital letter, unless the root's own
                    // gloss is capitalized ("Passover", "Christ").
                    let gloss = s.glosses[i as usize];
                    let proper = gloss.chars().find(|c| c.is_alphabetic()).is_some_and(char::is_uppercase);
                    let g = gloss.to_lowercase();
                    (!proper || r.capitalized) && r.matches.iter().any(|m| g.contains(m.as_str()))
                })
                .collect();
            // An exclude that would not match anyway is a typo: fail loudly.
            if let Some(x) = r.exclude.iter().find(|x| !found.iter().any(|&i| s.keys[i as usize] == x.as_str())) {
                return Err(format!("theme {}: exclude {x} is not a root that {} {:?} includes", t.id, r.strong, r.matches));
            }
            left.extend(found.iter().copied().filter(|&i| r.exclude.iter().any(|x| x == s.keys[i as usize])));
            let found: Vec<u32> = found.into_iter().filter(|&i| !r.exclude.iter().any(|x| x == s.keys[i as usize])).collect();
            if found.is_empty() {
                let near: Vec<String> = s.keys.iter().enumerate().filter(|(_, k)| k.starts_with(&r.strong)).map(|(i, k)| format!("{k}={:?}", s.glosses[i])).collect();
                return Err(format!("theme {}: {} matched no root with gloss {:?} (candidates: {})", t.id, r.strong, r.matches, near.join(", ")));
            }
            idxs.extend(found);
        }
        idxs.sort_unstable();
        idxs.dedup();
        left.sort_unstable();
        left.dedup();

        let mut skip: Vec<u32> = Vec::new();
        for k in &t.skip_with {
            let found: Vec<u32> = roots_named(s.keys, k).collect();
            if k.len() < 5 || found.is_empty() {
                return Err(format!("theme {}: skip_with {k:?} names no root", t.id));
            }
            if let Some(&i) = found.iter().find(|i| idxs.contains(i)) {
                return Err(format!("theme {}: skip_with {k:?} is one of the theme's own roots ({})", t.id, s.keys[i as usize]));
            }
            skip.extend(found);
        }
        skip.sort_unstable();
        skip.dedup();

        let set = verses(&idxs, &skip, s.l_off, s.l_verse, n);
        if !(KEY_MIN..=KEY_MAX).contains(&t.key_verses.len()) {
            return Err(format!("theme {}: needs {KEY_MIN} or {KEY_MAX} key verses, has {}", t.id, t.key_verses.len()));
        }
        let mut key = Vec::new();
        for r in &t.key_verses {
            let v = single_verse(r, s.vz).ok_or_else(|| format!("theme {}: key verse {r:?} is not a single verse", t.id))?;
            if set.binary_search(&v).is_err() {
                return Err(format!("theme {}: key verse {r} does not contain one of the theme's words", t.id));
            }
            if key.contains(&v) {
                return Err(format!("theme {}: key verse {r} is listed twice", t.id));
            }
            key.push(v);
        }
        // A verse the blurb points to is one the theme lights, like a key verse.
        for r in blurb_refs(&t.blurb) {
            let v = single_verse(r, s.vz).ok_or_else(|| format!("theme {}: the blurb names {r:?}, which is not a single verse", t.id))?;
            if set.binary_search(&v).is_err() {
                return Err(format!("theme {}: the blurb names {r}, which does not contain one of the theme's words", t.id));
            }
        }

        let tokens: u32 = idxs.iter().map(|&i| s.counts[i as usize]).sum();
        let words = |list: &[u32]| list.iter().map(|&i| format!("{} ({})", s.keys[i as usize], s.glosses[i as usize])).collect::<Vec<_>>().join(", ");
        eprintln!("theme {:<13} {:>5} verses, {:>5} occurrences via {}", t.id, set.len(), tokens, words(&idxs));
        if !left.is_empty() {
            eprintln!("      {:<13} left out: {}", "", words(&left));
        }
        if !skip.is_empty() {
            eprintln!("      {:<13} not in a verse with: {}", "", words(&skip));
        }
        out.push(ThemeOut {
            id: t.id.clone(),
            name: t.name.clone(),
            blurb: t.blurb.clone(),
            roots: idxs,
            group: t.group.clone(),
            level: level.to_string(),
            key_verses: key,
            near: Vec::new(),
            left,
            skip_with: skip,
            related: Vec::new(),
            related_only: Vec::new(),
            related_gloss: Vec::new(),
        });
        sets.push(set);
    }

    // Related words: a separate reason on a verse's card, never in `sets`.
    let specs = read_related(root)?;
    let resolved = resolve_related(&specs, &out, s.keys, s.glosses, s.family)?;
    for (e, (j, row)) in specs.iter().zip(resolved) {
        let t = &mut out[j];
        t.related.push(row);
        if e.gloss {
            t.related_gloss.push(row.0);
        }
        if !e.english.is_empty() || !e.not.is_empty() {
            let at = format!("{RELATED}: {} {}", e.theme, e.root);
            let verses = if e.english.is_empty() {
                let mut all = s.l_verse[s.l_off[row.0 as usize] as usize..s.l_off[row.0 as usize + 1] as usize].to_vec();
                all.dedup();
                all
            } else {
                english_verses(row.0, &e.english, s).map_err(|w| format!("{at}: the English word {w:?} is never aligned to it"))?
            };
            let verses = without(verses, &e.not, s.vz).map_err(|v| format!("{at}: not {v:?} is not a verse where it would count"))?;
            t.related_only.push((row.0, e.english.clone(), verses));
        }
    }

    if let Some(g) = file.groups.iter().find(|g| !out.iter().any(|t| t.group == g.id)) {
        return Err(format!("{CONFIG}: group {} has no themes", g.id));
    }
    if file.featured.is_empty() {
        return Err(format!("{CONFIG}: featured lists no themes"));
    }
    let mut seen = HashSet::new();
    for f in &file.featured {
        match out.iter().find(|t| &t.id == f) {
            None => return Err(format!("{CONFIG}: featured theme {f} does not exist")),
            Some(t) if !t.simple() => return Err(format!("{CONFIG}: featured theme {f} is not shown at the Simple level")),
            _ if !seen.insert(f) => return Err(format!("{CONFIG}: featured theme {f} is listed twice")),
            _ => {}
        }
    }

    let near = near(&sets, s.graph, &nr);
    for (t, list) in out.iter_mut().zip(&near.lists) {
        t.near = list.clone();
    }
    for t in &out {
        let names: Vec<String> = t.near.iter().map(|&(j, c, l)| format!("{} {c} x{l}", out[j as usize].id)).collect();
        eprintln!("near  {:<13} {}", t.id, if names.is_empty() { "(none)".to_string() } else { names.join(", ") });
    }

    // One coverage line per level.
    for (level, simple_only) in [("Simple", true), ("Study", false)] {
        let mut lit = vec![false; n];
        let mut count = 0;
        for (t, set) in out.iter().zip(&sets) {
            if simple_only && !t.simple() {
                continue;
            }
            count += 1;
            for &v in set {
                lit[v as usize] = true;
            }
        }
        let k = lit.iter().filter(|&&x| x).count();
        eprintln!("themes at {level}: {count} themes light {k} of {n} verses ({:.1}%)", 100.0 * k as f64 / n as f64);
    }
    let pairs: usize = out.iter().map(|t| t.related.len()).sum();
    let with: usize = out.iter().filter(|t| !t.related.is_empty()).count();
    for (level, simple_only) in [("Simple", true), ("Study", false)] {
        let shown: Vec<bool> = out.iter().map(|t| !simple_only || t.simple()).collect();
        let rel = Related::new(&out, &sets, &shown, s.l_off, s.l_verse, n);
        let mut own = vec![false; n];
        for (set, _) in sets.iter().zip(&shown).filter(|(_, &on)| on) {
            for &v in set {
                own[v as usize] = true;
            }
        }
        let reached = (0..n).filter(|&v| !rel.by_verse[v].is_empty()).count();
        let only = (0..n).filter(|&v| !own[v] && !rel.by_verse[v].is_empty()).count();
        eprintln!("related words at {level}: {reached} verses reach a theme through a related word, {only} of them with no theme of their own");
    }
    eprintln!("related words: {pairs} reviewed pairs for {with} themes ({RELATED}); theme verses unchanged");
    let partnered = out.iter().filter(|t| !t.near.is_empty()).count();
    eprintln!("themes: {} in {} groups; often linked with: {} distinct verse pairs with {}+ votes, {partnered} of {} themes have a partner", out.len(), file.groups.len(), near.pairs, nr.votes, out.len());

    let meta = vec![
        ("themeGroups", serde_json::to_value(&file.groups).unwrap()),
        ("themeFeatured", serde_json::to_value(&file.featured).unwrap()),
        ("themeLinks", serde_json::to_value(file.links).unwrap()),
        (
            "themeNear",
            serde_json::to_value(NearMeta { votes: nr.votes, min_links: nr.min_links, min_lift: nr.min_lift, max: nr.max, pairs: near.pairs }).unwrap(),
        ),
    ];
    Ok(Built { json: serde_json::to_string(&out).unwrap().into_bytes(), meta })
}

// ------------------------------------------------------- often linked with

pub struct Near {
    /// Per theme: `(other theme, links, lift rounded to 0.1)`, strongest first.
    pub lists: Vec<Vec<(u32, u32, f64)>>,
    /// Distinct verse pairs joined by a link with enough votes.
    pub pairs: usize,
}

/// Theme-to-theme counts over the distinct verse pairs (either direction, a
/// duplicate counted once) joined by a cross-reference with `rule.votes` or
/// more. `links[a][b]` counts the pairs with one end in `a` and the other in
/// `b`; the count expected by chance is `ends(a) * ends(b) / (2 * pairs)`,
/// where `ends(a)` counts pair ends in `a`; lift is links over expected.
pub fn near(sets: &[Vec<u32>], graph: &XrefGraph, rule: &NearRule) -> Near {
    let n = graph.verse_count() as usize;
    let t = sets.len();
    let mut of: Vec<Vec<u32>> = vec![Vec::new(); n];
    for (j, set) in sets.iter().enumerate() {
        for &v in set {
            of[v as usize].push(j as u32);
        }
    }
    let mut pairs: Vec<(u32, u32)> = Vec::new();
    for s in 0..n as u32 {
        for e in graph.out(s) {
            let d = graph.dst[e];
            if d != s && graph.votes[e] >= rule.votes {
                pairs.push((s.min(d), s.max(d)));
            }
        }
    }
    pairs.sort_unstable();
    pairs.dedup();

    let mut links = vec![0u32; t * t];
    let mut ends = vec![0u64; t];
    for &(p, q) in &pairs {
        let (tp, tq) = (&of[p as usize], &of[q as usize]);
        for &x in tp.iter().chain(tq) {
            ends[x as usize] += 1;
        }
        for &x in tp {
            for &y in tq {
                if x != y {
                    links[x as usize * t + y as usize] += 1;
                }
            }
        }
        // The other way round, unless that ordered pair was just counted.
        for &x in tq {
            for &y in tp {
                if x != y && !(tp.binary_search(&x).is_ok() && tq.binary_search(&y).is_ok()) {
                    links[x as usize * t + y as usize] += 1;
                }
            }
        }
    }
    let total = 2.0 * pairs.len() as f64;
    let lists = (0..t)
        .map(|x| {
            let mut cand: Vec<(u32, u32, f64)> = (0..t)
                .filter(|&y| y != x)
                .filter_map(|y| {
                    let c = links[x * t + y];
                    let expected = ends[x] as f64 * ends[y] as f64 / total;
                    let lift = if expected > 0.0 { c as f64 / expected } else { 0.0 };
                    (c >= rule.min_links && lift >= rule.min_lift).then_some((y as u32, c, lift))
                })
                .collect();
            cand.sort_by(|a, b| (b.1 as f64 * b.2.ln()).total_cmp(&(a.1 as f64 * a.2.ln())).then(a.0.cmp(&b.0)));
            cand.truncate(rule.max);
            cand.into_iter().map(|(y, c, l)| (y, c, (l * 10.0).round() / 10.0)).collect()
        })
        .collect();
    Near { lists, pairs: pairs.len() }
}

// ------------------------------------------------------- through the links

/// A theme reached through a verse's links: the linked verses that carry it,
/// with the votes of their link, strongest first.
#[derive(Debug, Clone)]
pub struct Through {
    pub theme: usize,
    pub via: Vec<(u32, i16)>,
}

/// The links rule over one depth's themes.
pub struct Links<'a> {
    rule: LinkRule,
    graph: &'a XrefGraph,
    /// Incoming edges per verse: (source verse, edge).
    incoming: Vec<Vec<(u32, usize)>>,
    /// Per verse, the themes its own words carry at this depth.
    pub own: Vec<Vec<u32>>,
    /// Per verse, the themes one of whose left-out senses it contains.
    blocked: Vec<Vec<u32>>,
    size: Vec<usize>,
}

impl<'a> Links<'a> {
    /// `sets[j]` is theme j's verses, `left[j]` its left-out roots, and
    /// `shown[j]` whether it shows at this depth.
    pub fn new(rule: LinkRule, graph: &'a XrefGraph, sets: &[Vec<u32>], left: &[Vec<u32>], shown: &[bool], l_off: &[u32], l_verse: &[u32]) -> Self {
        let n = graph.verse_count() as usize;
        let mut incoming: Vec<Vec<(u32, usize)>> = vec![Vec::new(); n];
        for s in 0..n as u32 {
            for e in graph.out(s) {
                incoming[graph.dst[e] as usize].push((s, e));
            }
        }
        let mut own: Vec<Vec<u32>> = vec![Vec::new(); n];
        let mut blocked: Vec<Vec<u32>> = vec![Vec::new(); n];
        for (j, set) in sets.iter().enumerate() {
            if shown[j] {
                for &v in set {
                    own[v as usize].push(j as u32);
                }
            }
            for &r in &left[j] {
                for &v in &l_verse[l_off[r as usize] as usize..l_off[r as usize + 1] as usize] {
                    if blocked[v as usize].last() != Some(&(j as u32)) {
                        blocked[v as usize].push(j as u32);
                    }
                }
            }
        }
        Links { rule, graph, incoming, own, blocked, size: sets.iter().map(Vec::len).collect() }
    }

    /// The verse's `top` strongest links with `votes` or more, either
    /// direction, best votes per linked verse; strongest first, ties in
    /// canon order.
    pub fn strongest(&self, v: u32) -> Vec<(u32, i16)> {
        let g = self.graph;
        let mut best: HashMap<u32, i16> = HashMap::new();
        let out = g.out(v).map(|e| (g.dst[e], g.votes[e]));
        let inc = self.incoming[v as usize].iter().map(|&(s, e)| (s, g.votes[e]));
        for (u, w) in out.chain(inc) {
            if u != v {
                let b = best.entry(u).or_insert(w);
                *b = (*b).max(w);
            }
        }
        let mut list: Vec<(u32, i16)> = best.into_iter().filter(|&(_, w)| w >= self.rule.votes).collect();
        list.sort_by_key(|&(u, w)| (Reverse(w), u));
        list.truncate(self.rule.top);
        list
    }

    /// Themes reached through the verse's strongest links, best first: a
    /// theme needs `carriers` linked verses, or one link with `soloVotes`,
    /// and is never one of the verse's own themes, one lighting more than
    /// `maxThemeSize` verses, or one whose left-out sense is in the verse.
    /// Ranked by carrying links, then summed log2(1 + votes), then the
    /// smaller theme.
    pub fn through(&self, v: u32) -> Vec<Through> {
        let mut carry: BTreeMap<u32, Vec<(u32, i16)>> = BTreeMap::new();
        for (u, w) in self.strongest(v) {
            for &j in &self.own[u as usize] {
                carry.entry(j).or_default().push((u, w));
            }
        }
        let (own, blocked) = (&self.own[v as usize], &self.blocked[v as usize]);
        let mut found: Vec<(Through, f64)> = carry
            .into_iter()
            .filter(|(j, via)| {
                !own.contains(j) && !blocked.contains(j) && self.size[*j as usize] <= self.rule.max_theme_size && (via.len() >= self.rule.carriers || via[0].1 >= self.rule.solo_votes)
            })
            .map(|(j, via)| {
                let weight = via.iter().map(|&(_, w)| (1.0 + w as f64).log2()).sum();
                (Through { theme: j as usize, via }, weight)
            })
            .collect();
        found.sort_by(|(a, wa), (b, wb)| b.via.len().cmp(&a.via.len()).then(wb.total_cmp(wa)).then(self.size[a.theme].cmp(&self.size[b.theme])).then(a.theme.cmp(&b.theme)));
        found.into_iter().map(|(t, _)| t).collect()
    }
}

// ------------------------------------------------------------ related words

/// Checks `config/theme-related.json` against the themes and the word
/// families, entry by entry: the theme exists; root and via are root keys;
/// via is one of the theme's roots; via is in root's family by one of
/// [`RELATIONS`]; root is not one of the theme's roots, a left-out sense, a
/// skip_with root or a name (a gloss that starts with a capital letter); root
/// is another sense of none of the theme's words (an 'n' tie, or the same
/// Strong's number) unless the entry says `sense` after review; and no theme
/// lists a root twice. Gives each entry's theme index and `(root, relation,
/// via)`, or the first problem.
pub fn resolve_related(specs: &[RelatedSpec], themes: &[ThemeOut], keys: &[&str], glosses: &[&str], family: &[Vec<FamilyLink>]) -> Result<Vec<(usize, FamilyLink)>, String> {
    let index: HashMap<&str, u32> = keys.iter().enumerate().map(|(i, &k)| (k, i as u32)).collect();
    let key = |k: &str| index.get(k).copied();
    let mut seen: HashSet<(usize, u32)> = HashSet::new();
    let mut out = Vec::new();
    for e in specs {
        let at = format!("{RELATED}: {} {}", e.theme, e.root);
        let j = themes.iter().position(|t| t.id == e.theme).ok_or_else(|| format!("{at}: there is no theme {:?}", e.theme))?;
        let t = &themes[j];
        let r = key(&e.root).ok_or_else(|| format!("{at}: {} is not a root key", e.root))?;
        let via = key(&e.via).ok_or_else(|| format!("{at}: via {} is not a root key", e.via))?;
        if !t.roots.contains(&via) {
            return Err(format!("{at}: via {} is not one of the theme's roots", e.via));
        }
        if t.roots.contains(&r) {
            return Err(format!("{at}: {} is already one of the theme's roots", e.root));
        }
        if t.left.contains(&r) {
            return Err(format!("{at}: {} is a sense the theme leaves out", e.root));
        }
        if t.skip_with.contains(&r) {
            return Err(format!("{at}: {} is in the theme's skip_with", e.root));
        }
        let gloss = glosses.get(r as usize).copied().unwrap_or("");
        if gloss.chars().find(|c| c.is_alphabetic()).is_some_and(char::is_uppercase) {
            return Err(format!("{at}: {} is a name ({gloss:?})", e.root));
        }
        let rel = match family.get(r as usize).and_then(|f| f.iter().find(|x| x.0 == via)) {
            None => return Err(format!("{at}: {} is not in the family of {}", e.via, e.root)),
            Some(&(_, rel, _)) if !RELATIONS.contains(&rel) => return Err(format!("{at}: {} is tied to {} as {rel:?}, which a theme never uses", e.via, e.root)),
            Some(&(_, rel, _)) => rel,
        };
        if e.why.trim().is_empty() {
            return Err(format!("{at}: needs a why"));
        }
        // Another sense of one of the theme's words, through another of them.
        let number = |k: &str| k.trim_end_matches(|c: char| c.is_ascii_alphabetic()).to_string();
        let sense = family.get(r as usize).into_iter().flatten().find(|x| x.1 == 'n' && t.roots.contains(&x.0)).map(|x| x.0);
        let sense = sense.or_else(|| t.roots.iter().copied().find(|&x| number(keys.get(x as usize).copied().unwrap_or("")) == number(&e.root)));
        if let (Some(x), false) = (sense, e.sense) {
            return Err(format!("{at}: {} is another sense of the theme's word {}; set \"sense\": true only after review", e.root, keys.get(x as usize).copied().unwrap_or("?")));
        }
        if let Some(w) = e.english.iter().find(|w| w.is_empty() || w.chars().any(|c| !c.is_lowercase())) {
            return Err(format!("{at}: english {w:?} must be one lowercase word"));
        }
        if !seen.insert((j, r)) {
            return Err(format!("{at}: listed twice for the theme"));
        }
        out.push((j, (r, rel, via)));
    }
    Ok(out)
}

/// The verses where root `r`'s BSB English is one of `words`; or the first
/// of `words` that never is.
fn english_verses(r: u32, words: &[String], s: &Sources) -> Result<Vec<u32>, String> {
    let mut verses = Vec::new();
    let mut used = vec![false; words.len()];
    for k in s.l_off[r as usize] as usize..s.l_off[r as usize + 1] as usize {
        let (v, pos) = (s.l_verse[k], s.l_pos[k]);
        let mut hit = false;
        for w in (s.english)(v, pos) {
            if let Some(i) = words.iter().position(|x| *x == w) {
                used[i] = true;
                hit = true;
            }
        }
        if hit && verses.last() != Some(&v) {
            verses.push(v);
        }
    }
    match used.iter().position(|u| !u) {
        Some(i) => Err(words[i].clone()),
        None => Ok(verses),
    }
}

/// `verses` without the verses `not` names; or the first of `not` that is not
/// one of them.
fn without(verses: Vec<u32>, not: &[String], vz: &Versification) -> Result<Vec<u32>, String> {
    let mut out = verses;
    for at in not {
        match single_verse(at, vz).and_then(|v| out.binary_search(&v).ok()) {
            Some(i) => {
                out.remove(i);
            }
            None => return Err(at.clone()),
        }
    }
    Ok(out)
}

/// Themes reached through a related word, at one depth: per verse, the
/// `(theme, related root)` pairs. A related word never counts on a verse that
/// is already one of the theme's verses, that holds one of its left-out
/// senses or skip_with roots, or (for a root with `related_only`) that is not
/// listed. The app runs the same rule from themes.json.
pub struct Related {
    pub by_verse: Vec<Vec<(u32, u32)>>,
}

impl Related {
    /// `sets[j]` is theme j's verses and `shown[j]` whether it shows at this depth.
    pub fn new(themes: &[ThemeOut], sets: &[Vec<u32>], shown: &[bool], l_off: &[u32], l_verse: &[u32], n: usize) -> Self {
        let posting = |r: u32| &l_verse[l_off[r as usize] as usize..l_off[r as usize + 1] as usize];
        let mut by_verse: Vec<Vec<(u32, u32)>> = vec![Vec::new(); n];
        for (j, t) in themes.iter().enumerate() {
            if !shown[j] || t.related.is_empty() {
                continue;
            }
            let barred: HashSet<u32> = t.left.iter().chain(&t.skip_with).flat_map(|&r| posting(r).iter().copied()).collect();
            for &(r, _, _) in &t.related {
                let only = t.related_only.iter().find(|o| o.0 == r).map(|o| &o.2);
                for &v in posting(r) {
                    if barred.contains(&v) || sets[j].binary_search(&v).is_ok() || only.is_some_and(|o| o.binary_search(&v).is_err()) {
                        continue;
                    }
                    let list = &mut by_verse[v as usize];
                    if !list.contains(&(j as u32, r)) {
                        list.push((j as u32, r));
                    }
                }
            }
        }
        Related { by_verse }
    }

    /// The themes a verse reaches through a related word, each once.
    pub fn themes(&self, v: u32) -> Vec<u32> {
        let mut out: Vec<u32> = Vec::new();
        for &(j, _) in self.by_verse.get(v as usize).map_or(&[][..], Vec::as_slice) {
            if !out.contains(&j) {
                out.push(j);
            }
        }
        out
    }
}

/// The lowercase BSB words aligned to word `pos` of a text/*.json verse row
/// (`[english, words, alignment]`), as the app reads them.
fn aligned_english(row: &Value, pos: usize) -> Vec<String> {
    let al = &row[2];
    let entry = &al["w"][pos];
    let groups: Vec<i64> = match entry.as_array() {
        Some(pieces) => pieces.iter().filter_map(|p| p[2].as_i64()).collect(),
        None => entry.as_i64().into_iter().collect(),
    };
    let tokens = crate::align::english_words(row[0].as_str().unwrap_or(""));
    let e = al["e"].as_array().map_or(&[][..], Vec::as_slice);
    e.iter().zip(&tokens).filter(|(g, _)| g.as_i64().is_some_and(|g| g >= 0 && groups.contains(&g))).map(|(_, t)| t.to_lowercase()).collect()
}

// ------------------------------------------------------------- reading back

/// `themes.json` as written, plus each theme's verses.
pub struct Read {
    pub themes: Vec<ThemeOut>,
    pub sets: Vec<Vec<u32>>,
    pub groups: Vec<Group>,
}

pub fn read(d: &Loaded) -> Result<Read, String> {
    let path = d.dir.join(OUT);
    let raw: Value = serde_json::from_str(&fs::read_to_string(&path).map_err(|e| format!("{OUT}: {e}"))?).map_err(|e| format!("{OUT}: {e}"))?;
    if !raw.is_array() {
        return Err(format!("{OUT} is not a list"));
    }
    let themes: Vec<ThemeOut> = serde_json::from_value(raw).map_err(|e| format!("{OUT}: {e}"))?;
    let groups: Vec<Group> = serde_json::from_value(d.meta["themeGroups"].clone()).map_err(|e| format!("meta.json themeGroups: {e}"))?;
    let c = d.container();
    let l_off = c.u32s("l_off").map_err(|e| format!("{e:?}"))?;
    let l_verse = c.u32s("l_verse").map_err(|e| format!("{e:?}"))?;
    let n = d.vz.verse_count() as usize;
    let roots = l_off.len().saturating_sub(1) as u32;
    if let Some(t) = themes.iter().find(|t| t.roots.iter().chain(&t.left).chain(&t.skip_with).any(|&r| r >= roots)) {
        return Err(format!("{OUT}: theme {} names a root past the end of the root table", t.id));
    }
    let sets = themes.iter().map(|t| verses(&t.roots, &t.skip_with, &l_off, &l_verse, n)).collect();
    Ok(Read { themes, sets, groups })
}

pub fn testament_counts(vz: &Versification, set: &[u32]) -> (usize, usize) {
    let ot = set.iter().filter(|&&v| vz.locate(v).is_some_and(|(b, _, _)| BOOKS[b as usize].testament == Testament::Old)).count();
    (ot, set.len() - ot)
}

// ------------------------------------------------------------------ verify

/// Per verse, whether naves/<Book>.json gives it a row (subjects or passages).
fn naves_rows(d: &Loaded, n: usize) -> Result<Vec<bool>, String> {
    let mut has = vec![false; n];
    for (b, book) in BOOKS.iter().enumerate() {
        let rel = format!("naves/{}.json", book.osis);
        let doc: Value = serde_json::from_str(&fs::read_to_string(d.dir.join(&rel)).map_err(|e| format!("{rel}: {e}"))?).map_err(|e| format!("{rel}: {e}"))?;
        for (c, ch) in doc["chapters"].as_array().into_iter().flatten().enumerate() {
            for (v, e) in ch.as_array().into_iter().flatten().enumerate() {
                if e.as_array().is_some_and(|x| !x.is_empty()) {
                    if let Some(i) = d.vz.index(b as u8, c as u16 + 1, v as u16 + 1) {
                        has[i as usize] = true;
                    }
                }
            }
        }
    }
    Ok(has)
}

/// The Sabbath theme's roots and verse count, which related words never change.
const SABBATH_ROOTS: [&str; 7] = ["G2663", "G2664", "G4520", "G4521", "H4496H", "H7673B", "H7676"];

/// `root` is the repository, for config/theme-related.json.
pub fn verify(d: &Loaded, root: &Path) -> Result<Vec<(bool, String)>, String> {
    let mut r: Vec<(bool, String)> = Vec::new();
    let Read { themes, sets, groups } = read(d)?;
    let featured: Vec<String> = serde_json::from_value(d.meta["themeFeatured"].clone()).map_err(|e| format!("meta.json themeFeatured: {e}"))?;
    let rule: LinkRule = serde_json::from_value(d.meta["themeLinks"].clone()).map_err(|e| format!("meta.json themeLinks: {e}"))?;
    let near_meta: NearMeta = serde_json::from_value(d.meta["themeNear"].clone()).map_err(|e| format!("meta.json themeNear: {e}"))?;
    let n = d.vz.verse_count() as usize;
    let c = d.container();
    let l_off = c.u32s("l_off").map_err(|e| format!("{e:?}"))?;
    let l_verse = c.u32s("l_verse").map_err(|e| format!("{e:?}"))?;
    let l_pos = c.u16s("l_pos").map_err(|e| format!("{e:?}"))?;

    // Ids, groups, levels and the featured list.
    let ids: Vec<&str> = themes.iter().map(|t| t.id.as_str()).collect();
    let unique: HashSet<&str> = ids.iter().copied().collect();
    r.push((unique.len() == ids.len(), format!("theme ids are unique ({} themes)", ids.len())));
    r.push((ids.starts_with(&PINNED), format!("the first {} theme ids are unchanged and in order: {:?}", PINNED.len(), &ids[..ids.len().min(PINNED.len())])));
    let index = |id: &str| ids.iter().position(|&x| x == id);
    for t in &themes {
        r.push((groups.iter().any(|g| g.id == t.group), format!("theme {} is in a listed group ({})", t.id, t.group)));
        r.push((t.level == "simple" || t.level == "study", format!("theme {} level is simple or study ({})", t.id, t.level)));
    }
    for g in &groups {
        r.push((themes.iter().any(|t| t.group == g.id), format!("theme group {} has themes", g.id)));
    }
    r.push((!featured.is_empty(), "the featured theme list is not empty".to_string()));
    for f in &featured {
        r.push((index(f).is_some_and(|i| themes[i].simple()), format!("featured theme {f} exists and shows at Simple")));
    }

    // Sizes by level: a Simple theme stays readable, a Study one may be broad.
    for (t, set) in themes.iter().zip(&sets) {
        let (lo, hi) = if t.simple() { (40, 1_500) } else { (40, 3_000) };
        r.push(((lo..=hi).contains(&set.len()), format!("theme {} ({}) lights {} verses, expected {lo} to {hi}", t.id, t.level, set.len())));
    }

    let lit = |id: &str, v: u32| -> bool { index(id).is_some_and(|i| sets[i].binary_search(&v).is_ok()) };
    // Senses left out stay out: wrong sub-entries, excluded senses, dropped
    // roots and numbers inside a larger count.
    for (id, verses) in [
        ("seed", &["Lev 15:16"][..]),
        ("spirit", &["Ezek 42:16"]),
        ("sea", &["Gen 12:8"]),
        ("wrath", &["Gen 2:7"]),
        ("comfort", &["Gen 6:6"]),
        ("cup", &["Lev 11:17"]),
        ("harvest", &["Num 11:23"]),
        ("mountain", &["Gen 10:30"]),
        ("righthand", &["Josh 17:7"]),
        ("sin", &["Exod 29:14"]),
        ("exile", &["Lev 18:6", "Gen 9:21"]),
        ("reveal", &["Lev 18:6", "Gen 9:21"]),
        ("cross", &["Gen 40:22", "Josh 8:29", "Esth 7:10"]),
        ("life", &["Gen 5:12"]),
        ("raised", &["Num 7:1"]),
        ("gather", &["Luke 12:18"]),
        ("seven", &["Ezra 2:3", "Num 7:19", "Num 31:37", "Ezra 2:65", "Rev 11:13", "Acts 27:37"]),
        ("forty", &["Num 1:21"]),
        ("word", &["Gen 18:14"]),
        ("new", &["1 Tim 5:1"]),
        ("peace", &["Ps 41:9", "1 Sam 10:4"]),
        ("holy", &["Jer 6:4", "Mic 3:5"]),
    ] {
        for &verse in verses {
            let v = d.resolve(verse)?.0;
            r.push((index(id).is_some() && !lit(id, v), format!("theme {id} leaves out {verse}")));
        }
    }
    // The themes reach the verses they are about.
    for (id, verses) in [
        ("passover", &["Exod 12:11", "1 Cor 5:7"][..]),
        ("redeemer", &["Job 19:25", "Mark 10:45"]),
        ("atonement", &["Lev 16:30", "Lev 23:27", "Rom 3:25", "Heb 2:17"]),
        ("anointed", &["Ps 2:2", "John 1:41"]),
        ("sabbath", &["Exod 20:8", "Lev 23:32", "Heb 4:4", "Heb 4:9"]),
        ("kingdom", &["Dan 2:44", "Matt 6:10"]),
        ("firstborn", &["Exod 4:22", "Col 1:15"]),
        ("love", &["John 3:16"]),
        ("lamb", &["Gen 22:8"]),
        ("sacrifice", &["Gen 22:8"]),
        ("sin", &["Isa 53:5"]),
        ("healing", &["Isa 53:5", "1 Pet 2:24"]),
        ("peace", &["Isa 53:5"]),
        ("shepherd", &["Ps 23:1"]),
        ("clean", &["Lev 15:16"]),
        ("washing", &["Lev 15:16"]),
        ("righthand", &["Ps 110:1", "Heb 1:13"]),
        ("goodnews", &["Isa 52:7", "Rom 10:15"]),
        ("raised", &["John 11:25"]),
        ("potter", &["Gen 2:7", "Jer 18:6", "Rom 9:21"]),
        ("oath", &["Gen 22:16", "Heb 6:13"]),
        ("weeping", &["John 11:35", "Rev 21:4"]),
        ("chesed", &["Exod 34:6"]),
        ("birth", &["Matt 1:2"]),
        ("cross", &["Gal 6:14"]),
    ] {
        for &verse in verses {
            let v = d.resolve(verse)?.0;
            r.push((lit(id, v), format!("theme {id} includes {verse}")));
        }
    }
    for (t, set) in themes.iter().zip(&sets) {
        let ok = (KEY_MIN..=KEY_MAX).contains(&t.key_verses.len()) && t.key_verses.iter().all(|v| set.binary_search(v).is_ok());
        r.push((ok, format!("theme {} lights its {} key verses", t.id, t.key_verses.len())));
        for at in blurb_refs(&t.blurb) {
            let ok = single_verse(at, &d.vz).is_some_and(|v| set.binary_search(&v).is_ok());
            r.push((ok, format!("theme {} lights {at}, which its blurb names", t.id)));
        }
    }

    // Per verse, the themes its own words carry.
    let shown_simple: Vec<bool> = themes.iter().map(ThemeOut::simple).collect();
    let shown_all = vec![true; themes.len()];
    let left: Vec<Vec<u32>> = themes.iter().map(|t| t.left.clone()).collect();
    let simple = Links::new(rule, &d.graph, &sets, &left, &shown_simple, &l_off, &l_verse);
    let study = Links::new(rule, &d.graph, &sets, &left, &shown_all, &l_off, &l_verse);
    let names = |list: &[u32]| list.iter().map(|&j| ids[j as usize]).collect::<Vec<_>>();
    let gen512 = d.resolve("Gen 5:12")?.0;
    r.push((names(&simple.own[gen512 as usize]) == ["birth"], format!("Genesis 5:12's Simple themes are exactly birth: {:?}", names(&simple.own[gen512 as usize]))));
    let chr15 = d.resolve("1 Chr 1:5")?.0;
    r.push((simple.own[chr15 as usize].is_empty(), format!("1 Chronicles 1:5 has no Simple theme: {:?}", names(&simple.own[chr15 as usize]))));
    let jn316 = d.resolve("John 3:16")?.0;
    r.push((simple.own[jn316 as usize].len() >= 4, format!("John 3:16 has at least 4 Simple themes: {:?}", names(&simple.own[jn316 as usize]))));

    // Coverage floors.
    for (level, links, floor) in [("Simple", &simple, 68.0), ("Study", &study, 77.0)] {
        let k = links.own.iter().filter(|x| !x.is_empty()).count();
        let pct = 100.0 * k as f64 / n as f64;
        r.push((pct >= floor, format!("{level} themes light {k} of {n} verses ({pct:.1}%), expected {floor}% or more")));
    }

    // Often linked with: the stored lists are exactly what the cross-references give.
    let again = near(&sets, &d.graph, &near_meta.rule());
    r.push((again.pairs == near_meta.pairs, format!("themeNear counts {} verse pairs, the cross-references give {}", near_meta.pairs, again.pairs)));
    for (t, list) in themes.iter().zip(&again.lists) {
        r.push((&t.near == list, format!("theme {} often-linked-with list matches the cross-references", t.id)));
    }
    for t in themes.iter().filter(|t| t.simple()) {
        let ok = t.near.iter().any(|&(j, links, lift)| themes.get(j as usize).is_some_and(ThemeOut::simple) && links >= near_meta.min_links && lift >= near_meta.min_lift);
        r.push((ok, format!("Simple theme {} has a Simple partner with {}+ links and lift {}+", t.id, near_meta.min_links, near_meta.min_lift)));
    }
    for (a, b) in [("lamb", "sacrifice"), ("light", "darkness"), ("shepherd", "flock"), ("passover", "leaven"), ("widow", "stranger")] {
        let ok = index(a).zip(index(b)).is_some_and(|(i, j)| themes[i].near.iter().any(|&(k, _, _)| k as usize == j));
        r.push((ok, format!("theme {a} is often linked with {b}")));
    }

    // The links rule (the app runs the same rule from meta.themeLinks).
    let reach = |links: &Links, verse: &str| -> Result<Vec<(String, Vec<String>)>, String> {
        let v = d.resolve(verse)?.0;
        Ok(links.through(v).into_iter().map(|t| (ids[t.theme].to_string(), t.via.iter().map(|&(u, _)| d.label(u)).collect())).collect())
    };
    let gen22 = reach(&simple, "Gen 2:2")?;
    let gen22_own = simple.own[d.resolve("Gen 2:2")?.0 as usize].is_empty();
    r.push((
        gen22_own && gen22.first().is_some_and(|(id, via)| id == "sabbath" && via.first().map(String::as_str) == Some("Hebrews 4:4")),
        format!("Genesis 2:2 has no Simple theme of its own and reaches sabbath first, through Hebrews 4:4: {gen22:?}"),
    ));
    for (level, links) in [("Simple", &simple), ("Study", &study)] {
        let lev = reach(links, "Lev 15:16")?;
        r.push((!lev.iter().any(|(id, _)| id == "seed"), format!("Leviticus 15:16 never reaches seed through links at {level}: {lev:?}")));
    }
    let dan = reach(&study, "Dan 12:2")?;
    r.push((dan.iter().any(|(id, via)| id == "raised" && via.first().map(String::as_str) == Some("John 5:29")), format!("Daniel 12:2 reaches raised through John 5:29: {dan:?}")));
    let gen26 = d.resolve("Gen 2:6")?.0;
    let gen26_through = reach(&simple, "Gen 2:6")?;
    r.push((simple.own[gen26 as usize].is_empty() && gen26_through.is_empty(), format!("Genesis 2:6 reaches no theme at Simple: {gen26_through:?}")));

    // Related words: a separate, labelled reason on a verse's card, from the
    // reviewed list; never a root or a verse of the theme.
    let specs = read_related(root)?;
    let keys: Vec<&str> = d.lemmas["key"].as_array().ok_or("lemmas.json has no keys")?.iter().map(|k| k.as_str().unwrap_or("")).collect();
    let key = |i: u32| keys.get(i as usize).copied().unwrap_or("?");
    let listed: HashSet<(&str, &str, &str)> = specs.iter().map(|e| (e.theme.as_str(), e.root.as_str(), e.via.as_str())).collect();
    let shard_size = d.meta["lexShard"].as_u64().ok_or("meta.json has no lexShard")? as u32;
    let mut shards: HashMap<u32, Value> = HashMap::new();
    let mut written = 0usize;
    for t in &themes {
        for &(w, rel, via) in &t.related {
            written += 1;
            let what = format!("theme {} related word {} via {}", t.id, key(w), key(via));
            r.push((listed.contains(&(t.id.as_str(), key(w), key(via))), format!("{what} is in {RELATED}")));
            r.push((
                t.roots.contains(&via) && !t.roots.contains(&w) && !t.left.contains(&w) && !t.skip_with.contains(&w),
                format!("{what}: via is one of the theme's roots, and the word is not one of them, a left-out sense or a skip_with root"),
            ));
            if let std::collections::hash_map::Entry::Vacant(e) = shards.entry(w / shard_size) {
                let rel = format!("forms/{}.json", w / shard_size);
                e.insert(serde_json::from_str(&fs::read_to_string(d.dir.join(&rel)).map_err(|e| format!("{rel}: {e}"))?).map_err(|e| format!("{rel}: {e}"))?);
            }
            let family = &shards[&(w / shard_size)][(w % shard_size) as usize]["r"];
            let found = family.as_array().into_iter().flatten().find(|x| x[0].as_u64() == Some(via as u64)).and_then(|x| x[1].as_str());
            r.push((RELATIONS.contains(&rel) && found == Some(rel.to_string().as_str()), format!("{what}: forms/*.json gives the relation {found:?}, themes.json {rel:?}, and it is one themes may use")));
        }
        for (w, words, verses) in &t.related_only {
            let not: Vec<u32> = specs.iter().filter(|e| e.theme == t.id && e.root == key(*w)).flat_map(|e| e.not.iter().filter_map(|at| single_verse(at, &d.vz))).collect();
            let holds = verses.iter().all(|v| l_verse[l_off[*w as usize] as usize..l_off[*w as usize + 1] as usize].contains(v));
            r.push((t.related.iter().any(|x| x.0 == *w) && holds && !verses.is_empty(), format!("theme {} related word {} counts only in {} listed verses (English {words:?}), each holding it", t.id, key(*w), verses.len())));
            // The same verses again, from the text and alignment the app reads.
            let mut found: Vec<u32> = Vec::new();
            for k in l_off[*w as usize] as usize..l_off[*w as usize + 1] as usize {
                let v = l_verse[k];
                if found.last() != Some(&v) && !not.contains(&v) && (words.is_empty() || aligned_english(&d.verse(v)?, l_pos[k] as usize).iter().any(|e| words.contains(e))) {
                    found.push(v);
                }
            }
            r.push((found == *verses, format!("theme {} related word {}: the verses whose aligned BSB words include one of {words:?}, less {} it leaves out, are the {} listed ({} in the text)", t.id, key(*w), not.len(), verses.len(), found.len())));
        }
    }
    r.push((written == specs.len(), format!("themes.json has {written} related words; {RELATED} lists {}", specs.len())));

    let rel_simple = Related::new(&themes, &sets, &shown_simple, &l_off, &l_verse, n);
    let rel_study = Related::new(&themes, &sets, &shown_all, &l_off, &l_verse, n);
    let sabbath = index("sabbath").ok_or("no theme sabbath")?;
    let ceased = d.lemma_index("H7673A").ok_or("no root H7673A")? as u32;
    for verse in ["Gen 2:2", "Gen 2:3"] {
        let v = d.resolve(verse)?.0;
        r.push((rel_simple.by_verse[v as usize].contains(&(sabbath as u32, ceased)), format!("{verse} reaches sabbath at Simple through the related word H7673A (rested): {:?}", names(&rel_simple.themes(v)))));
    }
    for verse in ["Jer 7:34", "Neh 4:11"] {
        let v = d.resolve(verse)?.0;
        r.push((!rel_study.themes(v).contains(&(sabbath as u32)), format!("{verse} (H7673A 'remove', 'put an end') does not reach sabbath through a related word")));
    }
    // A Study theme shows through a related word at Study only.
    let king = index("king").ok_or("no theme king")? as u32;
    let reign = d.lemma_index("H4427A").ok_or("no root H4427A")? as u32;
    let gen3637 = d.resolve("Gen 36:37")?.0 as usize;
    r.push((
        rel_study.by_verse[gen3637].contains(&(king, reign)) && !rel_simple.themes(gen3637 as u32).contains(&king),
        "Genesis 36:37 reaches king (a Study theme) through the related word H4427A (reigned) at Study, not at Simple".to_string(),
    ));
    let sabbath_roots: Vec<&str> = themes[sabbath].roots.iter().map(|&i| key(i)).collect();
    r.push((sabbath_roots == SABBATH_ROOTS, format!("theme sabbath keeps its roots: {sabbath_roots:?}")));
    r.push((sets[sabbath].len() == 183, format!("theme sabbath lights {} verses, as before related words (183)", sets[sabbath].len())));
    let seed = index("seed").ok_or("no theme seed")? as u32;
    let lev = d.resolve("Lev 15:16")?.0;
    for (level, links, rel) in [("Simple", &simple, &rel_simple), ("Study", &study, &rel_study)] {
        let routes = (links.own[lev as usize].contains(&seed), links.through(lev).iter().any(|t| t.theme == seed as usize), rel.themes(lev).contains(&seed));
        r.push((routes == (false, false, false), format!("Leviticus 15:16 never reaches seed at {level}, by its words, its links or a related word: {routes:?}")));
    }

    // How each verse's card opens, at each depth: its own themes, else themes
    // through related words, else through links, else (Study) Nave's rows,
    // else the quiet line; and what related words changed.
    let naves = naves_rows(d, n)?;
    for (level, links, rel) in [("Simple", &simple, &rel_simple), ("Study", &study, &rel_study)] {
        let study_level = level == "Study";
        let (mut own, mut related, mut through, mut nav, mut quiet) = (0usize, 0usize, 0usize, 0usize, 0usize);
        let (mut new_own, mut new_links, mut new_naves, mut new_quiet) = (0usize, 0usize, 0usize, 0usize);
        let (mut links_before, mut naves_before, mut quiet_before) = (0usize, 0usize, 0usize);
        for v in 0..n as u32 {
            let has_own = !links.own[v as usize].is_empty();
            let has_rel = !rel.by_verse[v as usize].is_empty();
            let has_thr = !has_own && !links.through(v).is_empty();
            let has_nav = study_level && naves[v as usize];
            // Before related words.
            if !has_own {
                if has_thr {
                    links_before += 1;
                } else if has_nav {
                    naves_before += 1;
                } else {
                    quiet_before += 1;
                }
            }
            if has_rel {
                if has_own {
                    new_own += 1;
                } else if has_thr {
                    new_links += 1;
                } else if has_nav {
                    new_naves += 1;
                } else {
                    new_quiet += 1;
                }
            }
            match (has_own, has_rel, has_thr, has_nav) {
                (true, ..) => own += 1,
                (false, true, ..) => related += 1,
                (false, false, true, _) => through += 1,
                (false, false, false, true) => nav += 1,
                _ => quiet += 1,
            }
        }
        let pct = |k: usize| 100.0 * k as f64 / n as f64;
        eprintln!(
            "themes at {level}: {own} verses ({:.1}%) have their own, {related} ({:.1}%) reach one through a related word, {through} ({:.1}%) through links, {nav} show Nave's rows, {quiet} ({:.1}%) the quiet line",
            pct(own),
            pct(related),
            pct(through),
            pct(quiet)
        );
        eprintln!(
            "related words at {level}: {} verses newly reach a theme through one: {new_own} beside their own themes, {new_links} that had only links, {new_naves} that had Nave's rows, {new_quiet} that had the quiet line; links only {links_before} -> {through}, Nave's {naves_before} -> {nav}, quiet {quiet_before} -> {quiet}",
            new_own + new_links + new_naves + new_quiet
        );
        r.push((related > 0, format!("some verses with no theme of their own reach one through a related word at {level} ({related})")));
    }
    Ok(r)
}

#[cfg(test)]
mod tests {
    use super::*;
    use atlas_core::graph::RawEdge;

    fn graph(n: u32, edges: &[(u32, u32, i16)]) -> XrefGraph {
        XrefGraph::build(n, edges.iter().map(|&(src, dst, votes)| RawEdge { src, dst, span: 1, votes }).collect())
    }

    const NEAR: NearRule = NearRule { votes: 3, min_links: 1, min_lift: 2.0, max: 8 };

    #[test]
    fn near_counts_distinct_pairs_once() {
        // A = {0, 1}, B = {2, 3}. Pairs with 3+ votes: (0,2) given twice, (1,3)
        // and (1,5); the 2-vote link 0-4 does not count.
        let g = graph(6, &[(0, 2, 5), (2, 0, 4), (1, 3, 3), (0, 4, 2), (1, 5, 10)]);
        let got = near(&[vec![0, 1], vec![2, 3]], &g, &NEAR);
        assert_eq!(got.pairs, 3);
        // ends: A 3, B 2; expected 3 * 2 / 6 = 1, so lift 2.
        assert_eq!(got.lists[0], vec![(1, 2, 2.0)]);
        assert_eq!(got.lists[1], vec![(0, 2, 2.0)]);
    }

    #[test]
    fn near_counts_a_pair_inside_both_themes_once() {
        // Verses 0 and 1 are in both themes: the pair joins A and B once.
        let g = graph(4, &[(0, 1, 5), (2, 3, 5)]);
        let got = near(&[vec![0, 1], vec![0, 1, 2]], &g, &NearRule { min_lift: 0.5, ..NEAR });
        assert_eq!(got.pairs, 2);
        assert_eq!(got.lists[0].first().map(|x| x.1), Some(1));
    }

    #[test]
    fn near_keeps_the_strongest_partners() {
        let g = graph(4, &[(0, 1, 5), (2, 3, 5)]);
        let got = near(&[vec![0], vec![1], vec![2], vec![3]], &g, &NearRule { max: 1, ..NEAR });
        assert_eq!(got.lists[0].len(), 1);
        assert_eq!(got.lists[0][0].0, 1);
        assert!(got.lists[1].iter().all(|x| x.0 == 0));
    }

    #[test]
    fn links_rule() {
        let rule = LinkRule { votes: 3, top: 10, carriers: 2, solo_votes: 10, max_theme_size: 4 };
        // Verse 0 links to 1 (5 votes), 2 (4, given from the other side), 3 (12)
        // and 6 (2 votes, too weak).
        let g = graph(8, &[(0, 1, 5), (2, 0, 4), (0, 3, 12), (0, 6, 2)]);
        let sets = vec![
            vec![1, 2],          // 0: two carrying links
            vec![3],             // 1: one link with 12 votes
            vec![1],             // 2: one link with 5 votes, not enough
            vec![2, 3],          // 3: blocked, verse 0 has its left-out sense
            vec![1, 2, 4, 5, 7], // 4: too big
            vec![0, 1, 2],       // 5: the verse's own theme
            vec![1, 3, 6],       // 6: hidden at this depth
        ];
        let left = vec![vec![], vec![], vec![], vec![0], vec![], vec![], vec![]];
        let shown = vec![true, true, true, true, true, true, false];
        // Root 0 occurs in verse 0 only.
        let (l_off, l_verse) = (vec![0, 1], vec![0]);
        let links = Links::new(rule, &g, &sets, &left, &shown, &l_off, &l_verse);
        assert_eq!(links.strongest(0), vec![(3, 12), (1, 5), (2, 4)]);
        let got: Vec<(usize, Vec<u32>)> = links.through(0).into_iter().map(|t| (t.theme, t.via.iter().map(|x| x.0).collect())).collect();
        assert_eq!(got, vec![(0, vec![1, 2]), (1, vec![3])]);
        assert!(links.through(4).is_empty());
    }

    fn theme(roots: Vec<u32>, left: Vec<u32>, skip_with: Vec<u32>) -> ThemeOut {
        ThemeOut {
            id: "sabbath".into(),
            name: "Sabbath rest".into(),
            blurb: String::new(),
            roots,
            group: "times".into(),
            level: "simple".into(),
            key_verses: Vec::new(),
            near: Vec::new(),
            left,
            skip_with,
            related: Vec::new(),
            related_only: Vec::new(),
            related_gloss: Vec::new(),
        }
    }

    fn spec(theme: &str, root: &str, via: &str) -> RelatedSpec {
        RelatedSpec { theme: theme.into(), root: root.into(), via: via.into(), why: "a reason".into(), english: Vec::new(), gloss: false, sense: false, not: Vec::new() }
    }

    /// Roots: 0 to cease, 1 Sabbath (the theme's), 2 to keep (another sense of
    /// the Sabbath word), 3 a name, 4 cessation (no family), 5 a left-out
    /// sense, 6 a skip_with root, 7 to rest (the Sabbath word's number), 8
    /// Sabbath day (the theme's), 9 to stop (another sense of root 8).
    const KEYS: [&str; 10] = ["H0001", "H0002", "H0003", "H0004", "H0005", "H0006", "H0007", "H0002A", "H0008", "H0009"];
    const GLOSSES: [&str; 10] = ["to cease", "Sabbath", "to keep", "Shebeth", "cessation", "semen", "thousand", "to rest", "Sabbath day", "to stop"];

    fn resolve(specs: &[RelatedSpec]) -> Result<Vec<(usize, FamilyLink)>, String> {
        let family = vec![
            vec![(1, 'c', 1), (4, 'c', 4)],
            vec![(0, 'p', 0)],
            vec![(1, 'n', 1)],
            vec![(1, 's', 1)],
            vec![],
            vec![(1, 's', 1)],
            vec![(1, 's', 1)],
            vec![(1, 'c', 1)],
            vec![],
            vec![(1, 's', 1), (8, 'n', 8)],
        ];
        resolve_related(specs, &[theme(vec![1, 8], vec![5], vec![6])], &KEYS, &GLOSSES, &family)
    }

    fn fails(specs: &[RelatedSpec], why: &str) {
        match resolve(specs) {
            Ok(x) => panic!("{specs:?} passed as {x:?}, expected {why:?}"),
            Err(e) => assert!(e.contains(why), "{e:?} does not say {why:?}"),
        }
    }

    #[test]
    fn related_words_are_checked() {
        assert_eq!(resolve(&[spec("sabbath", "H0001", "H0002")]), Ok(vec![(0, (0, 'c', 1))]));
        fails(&[spec("rest", "H0001", "H0002")], "there is no theme");
        fails(&[spec("sabbath", "H9999", "H0002")], "is not a root key");
        fails(&[spec("sabbath", "H0001", "H9999")], "is not a root key");
        fails(&[spec("sabbath", "H0001", "H0005")], "is not one of the theme's roots");
        fails(&[spec("sabbath", "H0002", "H0002")], "already one of the theme's roots");
        fails(&[spec("sabbath", "H0006", "H0002")], "leaves out");
        fails(&[spec("sabbath", "H0007", "H0002")], "skip_with");
        fails(&[spec("sabbath", "H0004", "H0002")], "is a name");
        fails(&[spec("sabbath", "H0005", "H0002")], "is not in the family");
        // Another sense of the same word is never a related word.
        fails(&[spec("sabbath", "H0003", "H0002")], "never uses");
        // Nor through another of the theme's words, unless reviewed: by the
        // same Strong's number, or by a tie as another sense.
        fails(&[spec("sabbath", "H0002A", "H0002")], "another sense of the theme's word H0002");
        fails(&[spec("sabbath", "H0009", "H0002")], "another sense of the theme's word H0008");
        assert_eq!(resolve(&[RelatedSpec { sense: true, ..spec("sabbath", "H0002A", "H0002") }]), Ok(vec![(0, (7, 'c', 1))]));
        assert_eq!(resolve(&[RelatedSpec { sense: true, ..spec("sabbath", "H0009", "H0002") }]), Ok(vec![(0, (9, 's', 1))]));
        fails(&[spec("sabbath", "H0001", "H0002"), spec("sabbath", "H0001", "H0002")], "listed twice");
        fails(&[RelatedSpec { why: " ".into(), ..spec("sabbath", "H0001", "H0002") }], "needs a why");
        fails(&[RelatedSpec { english: vec!["Rest".into()], ..spec("sabbath", "H0001", "H0002") }], "lowercase");
    }

    #[test]
    fn related_rule() {
        // Root 0 (the related word) in verses 0, 1, 2 and 3; root 1 (the
        // theme's) in verse 1; root 5 (left out) in verse 2; root 6 in verse 0.
        let (l_off, l_verse) = (vec![0, 4, 5, 5, 5, 5, 6, 7], vec![0, 1, 2, 3, 1, 2, 0]);
        let mut t = theme(vec![1], vec![5], vec![]);
        t.related = vec![(0, 'c', 1)];
        let sets = vec![vec![1]];
        let got = Related::new(std::slice::from_ref(&t), &sets, &[true], &l_off, &l_verse, 4);
        // Not on the theme's own verse 1, nor verse 2 with the left-out sense.
        assert_eq!(got.by_verse, vec![vec![(0, 0)], vec![], vec![], vec![(0, 0)]]);
        assert_eq!(got.themes(3), vec![0]);
        // Nor verse 0 once root 6 is a skip_with root.
        t.skip_with = vec![6];
        let got = Related::new(std::slice::from_ref(&t), &sets, &[true], &l_off, &l_verse, 4);
        assert_eq!(got.by_verse, vec![vec![], vec![], vec![], vec![(0, 0)]]);
        t.skip_with = Vec::new();
        // Only where the English matched (verse 3), and never at a depth that hides it.
        t.related_only = vec![(0, vec!["rest".into()], vec![3])];
        let got = Related::new(std::slice::from_ref(&t), &sets, &[true], &l_off, &l_verse, 4);
        assert_eq!(got.by_verse, vec![vec![], vec![], vec![], vec![(0, 0)]]);
        let hidden = Related::new(std::slice::from_ref(&t), &sets, &[false], &l_off, &l_verse, 4);
        assert!(hidden.by_verse.iter().all(Vec::is_empty));
    }

    #[test]
    fn finds_blurb_refs() {
        assert_eq!(blurb_refs("The corner of a garment (Ruth 3:9)."), ["Ruth 3:9"]);
        assert_eq!(blurb_refs("Confessing sin (Leviticus 16:21, Psalm 32:5); a count (2,172)."), ["Leviticus 16:21", "Psalm 32:5"]);
        assert!(blurb_refs("(the Greek word also means week) and (46,500)").is_empty());
    }

    #[test]
    fn a_related_word_leaves_out_named_verses() {
        // Genesis 1 and 2 with 31 and 25 verses: Genesis 2:2 is verse 32.
        let mut counts = vec![vec![31u16, 25]];
        counts.extend((1..BOOKS.len()).map(|_| vec![1u16]));
        let vz = Versification::from_counts(&counts);
        assert_eq!(without(vec![5, 32, 40], &["Gen 2:2".into()], &vz), Ok(vec![5, 40]));
        // A verse where it would not count anyway, or no verse at all, is refused.
        assert_eq!(without(vec![5, 40], &["Gen 2:2".into()], &vz), Err("Gen 2:2".into()));
        assert_eq!(without(vec![5, 32], &["Gen 2".into()], &vz), Err("Gen 2".into()));
    }

    #[test]
    fn verses_leave_out_skip_roots() {
        // Root 0 in verses 1, 1, 3; root 1 in verse 3.
        let (l_off, l_verse) = (vec![0, 3, 4], vec![1, 1, 3, 3]);
        assert_eq!(verses(&[0], &[], &l_off, &l_verse, 5), vec![1, 3]);
        assert_eq!(verses(&[0], &[1], &l_off, &l_verse, 5), vec![1]);
    }
}
