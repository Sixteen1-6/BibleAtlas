//! English word index over the BSB text: word -> sorted verse indices.
//! The browser runs the same normalization (see web/src/data/search.ts), so a
//! query and the index always agree on what a "word" is.

use std::collections::BTreeMap;

/// Lowercase, fold curly apostrophes, drop a possessive "'s", drop other
/// apostrophes. "God’s" -> "god", "don't" -> "dont".
pub fn tokens(text: &str) -> impl Iterator<Item = String> + '_ {
    text.split(|c: char| !(c.is_alphanumeric() || c == '\'' || c == '’'))
        .filter(|w| !w.is_empty())
        .filter_map(|w| {
            let w = w.to_lowercase().replace('’', "'");
            let w = w.trim_matches('\'');
            let w = w.strip_suffix("'s").unwrap_or(w);
            let w: String = w.chars().filter(|&c| c != '\'').collect();
            (!w.is_empty()).then_some(w)
        })
}

pub struct EnglishIndex {
    pub words: Vec<String>,
    pub off: Vec<u32>,
    pub verses: Vec<u32>,
}

pub fn build(texts: &[String]) -> EnglishIndex {
    let mut map: BTreeMap<String, Vec<u32>> = BTreeMap::new();
    for (v, t) in texts.iter().enumerate() {
        for w in tokens(t) {
            let list = map.entry(w).or_default();
            if list.last() != Some(&(v as u32)) {
                list.push(v as u32);
            }
        }
    }
    let mut words = Vec::with_capacity(map.len());
    let mut off = vec![0u32];
    let mut verses = Vec::new();
    for (w, list) in map {
        words.push(w);
        verses.extend_from_slice(&list);
        off.push(verses.len() as u32);
    }
    EnglishIndex { words, off, verses }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes() {
        let t: Vec<String> = tokens("God’s “Light” — don't, LORD's 'quoted' 1:2").collect();
        assert_eq!(t, ["god", "light", "dont", "lord", "quoted", "1", "2"]);
        let idx = build(&["the light".into(), "Light and the dark".into()]);
        let i = idx.words.iter().position(|w| w == "light").unwrap();
        assert_eq!(&idx.verses[idx.off[i] as usize..idx.off[i + 1] as usize], &[0, 1]);
    }
}
