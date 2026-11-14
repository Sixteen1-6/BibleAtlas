//! Guided tours: a few verses to step through in order, from
//! `config/tours.json`. A tour shows only Scripture and its title.
//!
//! The build refuses a tour unless its steps are all joined into one by the
//! cross-references among them: two steps are joined when either is
//! cross-referenced with the other (any verse of the referenced passage,
//! with at least one net vote), and the steps of one chapter count together,
//! as a reader reads on. So no step stands apart from the rest.
//!
//! Output `tours.json`: {"format":1, "tours":[{"id", "title", "steps":[verse...]}]}.

use crate::extra_real_map::osis_verse;
use atlas_core::{Versification, XrefGraph};
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::Path;

pub const OUT: &str = "tours.json";
const CONFIG: &str = "config/tours.json";
/// Fewest and most steps a tour may have.
const STEPS: (usize, usize) = (4, 16);

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct File {
    format: u32,
    #[allow(dead_code)]
    about: String,
    tours: Vec<Tour>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Tour {
    id: String,
    title: String,
    steps: Vec<String>,
}

/// Is there a cross-reference with at least one net vote, either way, between verses `a` and `b`?
fn linked(g: &XrefGraph, a: u32, b: u32) -> bool {
    let reaches = |from: u32, to: u32| g.out(from).any(|e| g.votes[e] > 0 && g.dst[e] <= to && g.dst[e] + u32::from(g.span[e].max(1)) > to);
    reaches(a, b) || reaches(b, a)
}

/// The groups of steps that are not joined to each other (one group when the tour holds together).
fn groups(g: &XrefGraph, vz: &Versification, steps: &[u32]) -> Vec<Vec<usize>> {
    let n = steps.len();
    let mut root: Vec<usize> = (0..n).collect();
    fn find(r: &mut [usize], mut i: usize) -> usize {
        while r[i] != i {
            r[i] = r[r[i]];
            i = r[i];
        }
        i
    }
    for i in 0..n {
        for j in i + 1..n {
            if vz.chapter_of(steps[i]) == vz.chapter_of(steps[j]) || linked(g, steps[i], steps[j]) {
                let (x, y) = (find(&mut root, i), find(&mut root, j));
                root[x] = y;
            }
        }
    }
    let mut out: Vec<Vec<usize>> = Vec::new();
    let mut seen: Vec<usize> = Vec::new();
    for i in 0..n {
        let r = find(&mut root, i);
        match seen.iter().position(|&s| s == r) {
            Some(k) => out[k].push(i),
            None => {
                seen.push(r);
                out.push(vec![i]);
            }
        }
    }
    out
}

pub fn build(root: &Path, vz: &Versification, g: &XrefGraph) -> Result<Vec<(String, Vec<u8>)>, String> {
    let text = std::fs::read_to_string(root.join(CONFIG)).map_err(|e| format!("reading {CONFIG}: {e}"))?;
    let f: File = serde_json::from_str(&text).map_err(|e| format!("{CONFIG}: {e}"))?;
    let mut errors = Vec::new();
    if f.format != 1 {
        errors.push(format!("{CONFIG}: format must be 1"));
    }
    let mut out = Vec::new();
    let mut ids: Vec<&str> = Vec::new();
    for t in &f.tours {
        let at = format!("{CONFIG}: tour {:?}", t.id);
        if t.id.is_empty() || !t.id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') || ids.contains(&t.id.as_str()) {
            errors.push(format!("{at}: an id is lowercase letters, digits and hyphens, and unique"));
        }
        ids.push(&t.id);
        if t.title.trim().is_empty() || t.title.contains('\u{2014}') {
            errors.push(format!("{at}: a title is needed, with no em dash"));
        }
        if t.steps.len() < STEPS.0 || t.steps.len() > STEPS.1 {
            errors.push(format!("{at}: {} steps; a tour has {} to {}", t.steps.len(), STEPS.0, STEPS.1));
        }
        let mut steps = Vec::new();
        for s in &t.steps {
            match osis_verse(s, vz) {
                Some(v) if steps.contains(&v) => errors.push(format!("{at}: {s} is a step twice")),
                Some(v) => steps.push(v),
                None => errors.push(format!("{at}: {s} is not a verse")),
            }
        }
        if steps.len() == t.steps.len() {
            let gs = groups(g, vz, &steps);
            if gs.len() > 1 {
                let apart: Vec<String> = gs.iter().map(|grp| grp.iter().map(|&i| t.steps[i].as_str()).collect::<Vec<_>>().join(", ")).collect();
                errors.push(format!("{at}: its steps are not joined into one by cross-references; the parts are [{}]", apart.join("] and [")));
            }
        }
        out.push(json!({ "id": t.id, "title": t.title, "steps": steps }));
    }
    if !errors.is_empty() {
        return Err(errors.join("\n"));
    }
    eprintln!("tours: {} tours, {} steps", out.len(), f.tours.iter().map(|t| t.steps.len()).sum::<usize>());
    let doc = json!({ "format": 1, "tours": out });
    Ok(vec![(OUT.to_string(), serde_json::to_vec(&doc).map_err(|e| e.to_string())?)])
}

/// Checks: the built tours hold together on the built graph, and the Lamb tour opens at Genesis 22:8.
pub fn verify(d: &crate::loaded::Loaded) -> Result<Vec<(bool, String)>, String> {
    let p = d.dir.join(OUT);
    let doc: Value = serde_json::from_str(&std::fs::read_to_string(&p).map_err(|e| format!("reading {}: {e}", p.display()))?).map_err(|e| format!("{}: {e}", p.display()))?;
    let tours = doc["tours"].as_array().cloned().unwrap_or_default();
    let n = d.vz.verse_count();
    let mut sound = doc["format"] == 1 && !tours.is_empty();
    for t in &tours {
        let steps: Vec<u32> = t["steps"].as_array().map(Vec::as_slice).unwrap_or_default().iter().filter_map(|v| v.as_u64()).map(|v| v as u32).collect();
        sound &= t["title"].as_str().is_some_and(|s| !s.is_empty()) && steps.len() >= STEPS.0 && steps.iter().all(|&v| v < n) && groups(&d.graph, &d.vz, &steps).len() == 1;
    }
    let lamb = tours.iter().find(|t| t["id"] == "lamb").and_then(|t| t["steps"][0].as_u64());
    let gen_22_8 = osis_verse("Gen.22.8", &d.vz).map(u64::from);
    Ok(vec![
        (sound, format!("{OUT} lists {} tours, each joined into one by cross-references", tours.len())),
        (lamb.is_some() && lamb == gen_22_8, "the Lamb tour opens at Genesis 22:8".to_string()),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;
    use atlas_core::graph::RawEdge;

    #[test]
    fn joins_by_links_and_chapters() {
        // One book of two chapters of three verses: 0 to 2 and 3 to 5. One link, 1 to 4.
        let vz = Versification::from_arrays(vec![0, 2], vec![0, 3, 6]).expect("versification");
        let g = XrefGraph::build(6, vec![RawEdge { src: 1, dst: 4, span: 1, votes: 3 }]);
        assert_eq!(groups(&g, &vz, &[1, 4]).len(), 1, "a link joins");
        assert_eq!(groups(&g, &vz, &[4, 1]).len(), 1, "either way");
        assert_eq!(groups(&g, &vz, &[0, 1, 4]).len(), 1, "0 reads on to 1 in its chapter");
        assert_eq!(groups(&g, &vz, &[0, 4]).len(), 2, "0 and 4 are not linked");
        let down = XrefGraph::build(6, vec![RawEdge { src: 1, dst: 4, span: 1, votes: -2 }]);
        assert_eq!(groups(&down, &vz, &[1, 4]).len(), 2, "a voted-down link does not join");
        let span = XrefGraph::build(6, vec![RawEdge { src: 0, dst: 3, span: 2, votes: 1 }]);
        assert_eq!(groups(&span, &vz, &[0, 4]).len(), 1, "a link reaches every verse of its passage");
    }
}
