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
    pub vz: &'a Versification,
    pub graph: &'a XrefGraph,
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
        });
        sets.push(set);
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

pub fn verify(d: &Loaded) -> Result<Vec<(bool, String)>, String> {
    let mut r: Vec<(bool, String)> = Vec::new();
    let Read { themes, sets, groups } = read(d)?;
    let featured: Vec<String> = serde_json::from_value(d.meta["themeFeatured"].clone()).map_err(|e| format!("meta.json themeFeatured: {e}"))?;
    let rule: LinkRule = serde_json::from_value(d.meta["themeLinks"].clone()).map_err(|e| format!("meta.json themeLinks: {e}"))?;
    let near_meta: NearMeta = serde_json::from_value(d.meta["themeNear"].clone()).map_err(|e| format!("meta.json themeNear: {e}"))?;
    let n = d.vz.verse_count() as usize;
    let c = d.container();
    let l_off = c.u32s("l_off").map_err(|e| format!("{e:?}"))?;
    let l_verse = c.u32s("l_verse").map_err(|e| format!("{e:?}"))?;

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
        ("seven", &["Ezra 2:3", "Num 7:19", "Num 31:37", "Ezra 2:65"]),
        ("forty", &["Num 1:21"]),
        ("word", &["Gen 18:14"]),
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
    let (mut own, mut through) = (0usize, 0usize);
    for v in 0..n as u32 {
        if !simple.own[v as usize].is_empty() {
            own += 1;
        } else if !simple.through(v).is_empty() {
            through += 1;
        }
    }
    eprintln!(
        "themes at Simple: {own} verses ({:.1}%) have their own, {through} ({:.1}%) reach one through links, {} ({:.1}%) none",
        100.0 * own as f64 / n as f64,
        100.0 * through as f64 / n as f64,
        n - own - through,
        100.0 * (n - own - through) as f64 / n as f64
    );
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

    #[test]
    fn verses_leave_out_skip_roots() {
        // Root 0 in verses 1, 1, 3; root 1 in verse 3.
        let (l_off, l_verse) = (vec![0, 3, 4], vec![1, 1, 3, 3]);
        assert_eq!(verses(&[0], &[], &l_off, &l_verse, 5), vec![1, 3]);
        assert_eq!(verses(&[0], &[1], &l_off, &l_verse, 5), vec![1]);
    }
}
