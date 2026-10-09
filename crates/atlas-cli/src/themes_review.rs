//! `atlas themes-review [--group <id>] [--theme <id>] [--samples <n>]`: the
//! review sheet for themes, read from the built data (run `atlas build`
//! first). For each theme it prints the name, level and blurb, every word
//! traced with its gloss, the senses left out, its size in each testament,
//! the key verses and a few sample verses, each with the BSB words that the
//! theme's word became, so a reader can check the sense without the lexicon.
//! The samples are the same on every run (seeded by the theme id).

use crate::build::FLAG_OTHER_EDITIONS;
use crate::loaded::Loaded;
use crate::themes::{self, ThemeOut};
use serde_json::Value;
use std::fmt::Write as _;
use std::io::Write as _;
use std::path::Path;

const SAMPLES: usize = 6;

fn opt(args: &[String], name: &str) -> Result<Option<String>, String> {
    match args.iter().position(|a| a == name) {
        None => Ok(None),
        Some(i) => args.get(i + 1).filter(|v| !v.starts_with("--")).cloned().map(Some).ok_or_else(|| format!("{name} needs a value")),
    }
}

/// FNV-1a, to seed each theme's samples from its id.
fn seed(id: &str) -> u64 {
    id.bytes().fold(0xcbf2_9ce4_8422_2325, |h, b| (h ^ b as u64).wrapping_mul(0x0100_0000_01b3))
}

/// splitmix64.
fn next(state: &mut u64) -> u64 {
    *state = state.wrapping_add(0x9e37_79b9_7f4a_7c15);
    let mut z = *state;
    z = (z ^ (z >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
    z ^ (z >> 31)
}

/// Up to `k` verses of `set` other than `skip`, the same every run, in canon order.
fn samples(id: &str, set: &[u32], skip: &[u32], k: usize) -> Vec<u32> {
    let mut pool: Vec<u32> = set.iter().copied().filter(|v| !skip.contains(v)).collect();
    let mut state = seed(id);
    let take = k.min(pool.len());
    // Partial Fisher-Yates: the first `take` places get a random pick each.
    for i in 0..take {
        let j = i + (next(&mut state) % (pool.len() - i) as u64) as usize;
        pool.swap(i, j);
    }
    let mut out = pool[..take].to_vec();
    out.sort_unstable();
    out
}

struct Lemmas<'a>(&'a Value);

impl Lemmas<'_> {
    fn str(&self, col: &str, i: u32) -> &str {
        self.0[col][i as usize].as_str().unwrap_or("")
    }
    fn count(&self, i: u32) -> u64 {
        self.0["count"][i as usize].as_u64().unwrap_or(0)
    }
    /// `H7716 שֶׂה seh "lamb"`
    fn describe(&self, i: u32) -> String {
        let t = self.str("translit", i);
        let t = if t.is_empty() { String::new() } else { format!(" {t}") };
        format!("{} {}{t} \"{}\"", self.str("key", i), self.str("word", i), self.str("gloss", i))
    }
}

/// One of the theme's words in a verse: the BSB words aligned to it (empty
/// when none are), its surface form, root key and gloss.
struct Hit {
    english: Vec<String>,
    surface: String,
    key: String,
    gloss: String,
}

fn hits(d: &Loaded, lem: &Lemmas, v: u32, roots: &[u32]) -> Result<Vec<Hit>, String> {
    let row = d.verse(v)?;
    let english = crate::align::english_words(row[0].as_str().unwrap_or(""));
    let align = row.get(2).filter(|a| a.is_object());
    let mut out = Vec::new();
    for (wi, w) in row[1].as_array().into_iter().flatten().enumerate() {
        let lemma = w[3].as_i64().unwrap_or(-1);
        if w[5].as_u64().unwrap_or(0) & u64::from(FLAG_OTHER_EDITIONS) != 0 || lemma < 0 || !roots.contains(&(lemma as u32)) {
            continue;
        }
        let groups: Vec<i64> = match align.map(|a| &a["w"][wi]) {
            Some(Value::Array(pieces)) => pieces.iter().filter_map(|p| p[2].as_i64()).collect(),
            Some(g) => g.as_i64().into_iter().collect(),
            None => Vec::new(),
        };
        let words: Vec<String> = match align {
            Some(a) => a["e"]
                .as_array()
                .into_iter()
                .flatten()
                .enumerate()
                .filter(|(_, g)| g.as_i64().is_some_and(|g| g >= 0 && groups.contains(&g)))
                .filter_map(|(k, _)| english.get(k).map(|w| w.to_string()))
                .collect(),
            None => Vec::new(),
        };
        out.push(Hit {
            english: words,
            surface: w[0].as_str().unwrap_or("").to_string(),
            key: lem.str("key", lemma as u32).to_string(),
            gloss: w[2].as_str().unwrap_or("").to_string(),
        });
    }
    Ok(out)
}

/// The BSB words each of the theme's words became in this verse:
/// `"the lamb" <- שֶׂה H7716`, or the word's gloss when no English is aligned
/// to it (psalm headings, words the translation leaves implicit).
fn theme_words(d: &Loaded, lem: &Lemmas, v: u32, roots: &[u32]) -> Result<Vec<String>, String> {
    Ok(hits(d, lem, v, roots)?
        .into_iter()
        .map(|h| {
            let said = if h.english.is_empty() { format!("(no aligned English; gloss \"{}\")", h.gloss) } else { format!("\"{}\"", h.english.join(" ")) };
            format!("{said} <- {} {}", h.surface, h.key)
        })
        .collect())
}

/// Small words dropped when tallying renderings, so "the lamb" and "a lamb" count together.
const FILLER: [&str; 56] = [
    "a", "an", "the", "and", "or", "but", "so", "then", "if", "not", "of", "to", "in", "into", "for", "with", "by", "from", "on", "at", "as", "that", "which", "who", "whom",
    "he", "she", "it", "they", "his", "her", "their", "my", "your", "our", "its", "them", "him", "me", "you", "us", "o", "will", "would", "shall", "may", "must", "be",
    "is", "are", "was", "were", "has", "have", "do", "does",
];

/// How the BSB renders the theme's words over all its verses, most common first.
fn renderings(d: &Loaded, lem: &Lemmas, set: &[u32], roots: &[u32], top: usize) -> Result<String, String> {
    let mut tally: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut unaligned = 0;
    for &v in set {
        for h in hits(d, lem, v, roots)? {
            let words: Vec<String> = h.english.iter().map(|w| w.to_lowercase()).collect();
            if words.is_empty() {
                unaligned += 1;
                continue;
            }
            let kept: Vec<&str> = words.iter().map(String::as_str).filter(|w| !FILLER.contains(w)).collect();
            let key = if kept.is_empty() { words.join(" ") } else { kept.join(" ") };
            *tally.entry(key).or_default() += 1;
        }
    }
    let total: usize = tally.values().sum::<usize>() + unaligned;
    let mut list: Vec<(String, usize)> = tally.into_iter().collect();
    list.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    let shown: Vec<String> = list.iter().take(top).map(|(w, c)| format!("{w} {c}")).collect();
    let mut line = format!("{total} places: {}", shown.join(", "));
    if list.len() > top {
        line.push_str(&format!(", and {} other wordings", list.len() - top));
    }
    if unaligned > 0 {
        line.push_str(&format!("; {unaligned} with no aligned English"));
    }
    Ok(line)
}

fn verse_lines(d: &Loaded, lem: &Lemmas, v: u32, roots: &[u32]) -> Result<String, String> {
    Ok(format!("     {:<22} {}\n     {:<22} {}", d.label(v), theme_words(d, lem, v, roots)?.join("; "), "", d.english(v)))
}

/// "1 verse", "2 verses".
fn count(n: usize, one: &str, many: &str) -> String {
    format!("{n} {}", if n == 1 { one } else { many })
}

pub fn run(out: &Path, args: &[String]) -> Result<(), String> {
    let usage = "usage: atlas themes-review [--group <id>] [--theme <id>] [--samples <n>]";
    let group = opt(args, "--group")?;
    let theme = opt(args, "--theme")?;
    let k = match opt(args, "--samples")? {
        Some(s) => s.parse::<usize>().map_err(|_| format!("--samples takes a number. {usage}"))?,
        None => SAMPLES,
    };
    let d = Loaded::open(out)?;
    let themes::Read { themes, sets, groups } = themes::read(&d)?;
    let lem = Lemmas(&d.lemmas);
    let c = d.container();
    let l_off = c.u32s("l_off").map_err(|e| format!("{e:?}"))?;
    let l_verse = c.u32s("l_verse").map_err(|e| format!("{e:?}"))?;
    let n = d.vz.verse_count() as usize;

    if let Some(g) = &group {
        if !groups.iter().any(|x| &x.id == g) {
            return Err(format!("no theme group {g:?}; groups: {}", groups.iter().map(|x| x.id.as_str()).collect::<Vec<_>>().join(", ")));
        }
    }
    if let Some(t) = &theme {
        if !themes.iter().any(|x| &x.id == t) {
            return Err(format!("no theme {t:?}; {usage}"));
        }
    }

    let simple = themes.iter().filter(|t| t.simple()).count();
    let coverage = |simple_only: bool| {
        let mut lit = vec![false; n];
        for (t, set) in themes.iter().zip(&sets) {
            if !simple_only || t.simple() {
                for &v in set {
                    lit[v as usize] = true;
                }
            }
        }
        lit.iter().filter(|&&x| x).count()
    };
    let (cs, ca) = (coverage(true), coverage(false));
    let mut o = String::new();
    let _ = writeln!(o, "Themes review: {} themes in {} groups ({simple} at Simple, {} from Study up)", themes.len(), groups.len(), themes.len() - simple);
    let _ = writeln!(o, "Simple themes light {cs} of {n} verses ({:.1}%); with the Study themes, {ca} ({:.1}%)", 100.0 * cs as f64 / n as f64, 100.0 * ca as f64 / n as f64);

    for g in &groups {
        if group.as_ref().is_some_and(|x| x != &g.id) {
            continue;
        }
        let members: Vec<usize> = (0..themes.len()).filter(|&i| themes[i].group == g.id && theme.as_ref().is_none_or(|t| t == &themes[i].id)).collect();
        if members.is_empty() {
            continue;
        }
        let at_simple = members.iter().filter(|&&i| themes[i].simple()).count();
        let _ = writeln!(o, "\n== {} ({}): {}, {at_simple} at Simple ==", g.name, g.id, count(members.len(), "theme", "themes"));
        for i in members {
            print_theme(&mut o, &d, &lem, &themes, &sets, i, k, &l_off, &l_verse)?;
        }
    }
    // A reader piping into `head` or `less` may close early; that is not an error.
    match std::io::stdout().lock().write_all(o.as_bytes()) {
        Err(e) if e.kind() != std::io::ErrorKind::BrokenPipe => Err(format!("writing the review: {e}")),
        _ => Ok(()),
    }
}

#[allow(clippy::too_many_arguments)]
fn print_theme(o: &mut String, d: &Loaded, lem: &Lemmas, themes: &[ThemeOut], sets: &[Vec<u32>], i: usize, k: usize, l_off: &[u32], l_verse: &[u32]) -> Result<(), String> {
    let t = &themes[i];
    let set = &sets[i];
    let (ot, nt) = themes::testament_counts(&d.vz, set);
    let level = if t.simple() { "Simple" } else { "Study and Deep only" };
    let _ = writeln!(o, "\n-- {}: {}  [{level}]  {} (Old Testament {ot}, New Testament {nt})", t.id, t.name, count(set.len(), "verse", "verses"));
    let _ = writeln!(o, "   {}", t.blurb);
    let posting = |r: u32| &l_verse[l_off[r as usize] as usize..l_off[r as usize + 1] as usize];
    let _ = writeln!(o, "   Words traced:");
    for &r in &t.roots {
        let mut vs: Vec<u32> = posting(r).iter().copied().filter(|v| set.binary_search(v).is_ok()).collect();
        vs.dedup();
        let _ = writeln!(o, "     {}: {} times, lights {}", lem.describe(r), lem.count(r), count(vs.len(), "verse", "verses"));
    }
    let _ = writeln!(o, "   BSB words, most common first, in {}", renderings(d, lem, set, &t.roots, 15)?);
    if t.left.is_empty() {
        let _ = writeln!(o, "   Left out: none");
    } else {
        let _ = writeln!(o, "   Left out (never lit, and never offered through links on a verse containing them):");
        for &r in &t.left {
            let _ = writeln!(o, "     {}: {} times", lem.describe(r), lem.count(r));
        }
    }
    if !t.skip_with.is_empty() {
        let all = themes::verses(&t.roots, &[], l_off, l_verse, d.vz.verse_count() as usize);
        let words: Vec<String> = t.skip_with.iter().map(|&r| lem.describe(r)).collect();
        let _ = writeln!(o, "   Not lit when the verse also has: {} ({} left out)", words.join(", "), count(all.len() - set.len(), "verse", "verses"));
    }
    let _ = writeln!(o, "   Key verses:");
    for &v in &t.key_verses {
        let _ = writeln!(o, "{}", verse_lines(d, lem, v, &t.roots)?);
    }
    if t.near.is_empty() {
        let _ = writeln!(o, "   Often linked with: none");
    } else {
        let names: Vec<String> = t
            .near
            .iter()
            .map(|&(j, links, lift)| {
                let other = &themes[j as usize];
                let study = if other.simple() { "" } else { ", Study" };
                format!("{} ({links} links, lift {lift:.1}{study})", other.name)
            })
            .collect();
        let _ = writeln!(o, "   Often linked with: {}", names.join("; "));
    }
    let picks = samples(&t.id, set, &t.key_verses, k);
    let _ = writeln!(o, "   Sample verses ({}, the same every run):", picks.len());
    for v in picks {
        let _ = writeln!(o, "{}", verse_lines(d, lem, v, &t.roots)?);
    }
    Ok(())
}
