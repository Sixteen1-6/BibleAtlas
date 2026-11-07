//! The small file every visit loads for Layers of meaning, `layers-index.json`:
//! each passage's place and section, and each note's kind, strength, links and
//! words, which the reader's "Layers ›" marks, the map's dashed arcs and the
//! wordplay lines need. The notes' words, evidence and credits stay in
//! `layers.json`, which loads only when a reader opens the notes (about a tenth
//! of its size, compressed).

use serde_json::{Map, Value};

pub const OUT: &str = "layers-index.json";

const PASSAGE: [&str; 5] = ["id", "section", "v", "end", "draft"];
const LAYER: [&str; 4] = ["kind", "strength", "refs", "words"];

fn pick(v: &Value, keys: &[&str]) -> Map<String, Value> {
    keys.iter().filter_map(|k| v.get(*k).map(|x| ((*k).to_string(), x.clone()))).collect()
}

/// The index of the built `layers.json`, in the same order.
pub fn build(list: &[Value]) -> Value {
    Value::Array(
        list.iter()
            .map(|p| {
                let mut o = pick(p, &PASSAGE);
                let ls: Vec<Value> = p["layers"].as_array().map(Vec::as_slice).unwrap_or_default().iter().map(|l| Value::Object(pick(l, &LAYER))).collect();
                o.insert("layers".into(), Value::Array(ls));
                Value::Object(o)
            })
            .collect(),
    )
}

/// The index matches `layers.json`: the same passages in the same order, with
/// the same number of notes and the same kinds and links.
pub fn verify(d: &crate::loaded::Loaded) -> Result<Vec<(bool, String)>, String> {
    let read = |f: &str| -> Result<Value, String> {
        let p = d.dir.join(f);
        let s = std::fs::read_to_string(&p).map_err(|e| format!("reading {}: {e}", p.display()))?;
        serde_json::from_str(&s).map_err(|e| format!("{}: {e}", p.display()))
    };
    let (full, index) = (read("layers.json")?, read(OUT)?);
    let same = build(full.as_array().map(Vec::as_slice).unwrap_or_default()) == index;
    let n = index.as_array().map_or(0, Vec::len);
    Ok(vec![(same && n > 0, format!("{OUT} lists the {n} passages of layers.json in order, with each note's kind, strength, links and words"))])
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn keeps_only_what_the_marks_need() {
        let full = json!([{ "id": "g", "section": "jesus", "v": 3, "end": 4, "draft": false, "saying": "s", "source": "x", "reviewed_by": [],
            "layers": [{ "kind": "wordplay", "strength": "widely agreed", "text": "t", "evidence": "e", "refs": [{ "s": 1, "e": 1, "arc": true }], "words": [[3, 0, 9]], "cites": [] }] }]);
        let want = json!([{ "id": "g", "section": "jesus", "v": 3, "end": 4, "draft": false,
            "layers": [{ "kind": "wordplay", "strength": "widely agreed", "refs": [{ "s": 1, "e": 1, "arc": true }], "words": [[3, 0, 9]] }] }]);
        assert_eq!(build(full.as_array().unwrap()), want);
    }
}
