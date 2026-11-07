//! People: who is named in each verse, from Theographic Bible Metadata's
//! people (CC BY-SA 4.0), kept only where the BSB itself names them.
//!
//! Theographic lists, for each person, the verses about them. A person counts
//! as named in a verse only where Theographic lists them in that passage and
//! the BSB's own words there use one of their names, found as the Places
//! extra finds them (`extra_real_map::Person::named_at`): "Paul" or "Saul",
//! "Oholiab" not the KJV's "Aholiab", and never the "Mark" of "Mark out one
//! road". God, the Holy Spirit and Satan are left out, as the Places map
//! leaves them out. Their family (father, mother, husband or wife, children,
//! brothers and sisters) is Theographic's, kept only between people this file
//! keeps.
//!
//! Output `extras/people.json`:
//! {"format":1, "people":[[name, verses, family]...]}, where `verses` lists
//! the verses that name them, each as the gap from the one before (the first
//! from 0), and `family` is [father, mother, partners, children, siblings],
//! each a list of indexes into `people`. The file is CC BY-SA 4.0.

use crate::extra_real_map::{list, person, Table, NOT_PEOPLE, THEO};
use crate::sources::Inputs;
use atlas_core::Versification;
use serde_json::{json, Value};
use std::collections::{BTreeSet, HashMap};

pub const OUT: &str = "extras/people.json";

const FAMILY: [&str; 5] = ["father", "mother", "partners", "children", "siblings"];

pub fn build(inputs: &Inputs, vz: &Versification, bsb: &[String]) -> Result<Vec<(String, Vec<u8>)>, String> {
    let pe = Table::open(
        &inputs.path(THEO, "people"),
        &["personLookup", "name", "displayTitle", "alsoCalled", "verses", "father", "mother", "partners", "children", "siblings"],
    )?;
    let text: Vec<Vec<char>> = bsb.iter().map(|t| t.chars().collect()).collect();
    let mut kept: Vec<(String, &str, Vec<u32>, &Vec<String>)> = Vec::new();
    let (mut listed, mut dropped) = (0usize, 0usize);
    for r in &pe.rows {
        if NOT_PEOPLE.contains(&pe.get(r, "name")) {
            continue;
        }
        let p = person(&pe, r, vz, &text);
        let candidates: BTreeSet<u32> = list(pe.get(r, "verses")).filter_map(|o| crate::extra_real_map::osis_verse(o, vz)).collect();
        listed += candidates.len();
        let named: Vec<u32> = candidates.iter().copied().filter(|&v| p.named_at(v, &text, &[]).is_some()).collect();
        dropped += candidates.len() - named.len();
        if named.is_empty() {
            continue;
        }
        kept.push((p.name, pe.get(r, "personLookup"), named, r));
    }
    let index: HashMap<&str, usize> = kept.iter().enumerate().map(|(i, k)| (k.1, i)).collect();
    let mut people = Vec::with_capacity(kept.len());
    let mut pairs = 0usize;
    for (name, _, verses, r) in &kept {
        pairs += verses.len();
        let mut prev = 0u32;
        let gaps: Vec<u32> = verses
            .iter()
            .map(|&v| {
                let g = v - prev;
                prev = v;
                g
            })
            .collect();
        let family: Vec<Vec<usize>> = FAMILY.iter().map(|c| list(pe.get(r, c)).filter_map(|w| index.get(w).copied()).collect()).collect();
        people.push(json!([name, gaps, family]));
    }
    eprintln!(
        "people: {} people named in {pairs} verses; {dropped} of Theographic's {listed} listed verses left out where the BSB does not use the name",
        people.len()
    );
    let doc = json!({ "format": 1, "people": people });
    Ok(vec![(OUT.to_string(), serde_json::to_vec(&doc).map_err(|e| e.to_string())?)])
}

/// Checks: a sound file, and a few people in verses that name them.
pub fn verify(d: &crate::loaded::Loaded) -> Result<Vec<(bool, String)>, String> {
    let path = d.dir.join(OUT);
    let s = std::fs::read_to_string(&path).map_err(|e| format!("reading {}: {e}", path.display()))?;
    let doc: Value = serde_json::from_str(&s).map_err(|e| format!("{}: {e}", path.display()))?;
    let people = doc["people"].as_array().cloned().unwrap_or_default();
    let n = u64::from(d.vz.verse_count());
    let mut sound = doc["format"] == 1 && people.len() > 1000;
    let mut at: HashMap<String, Vec<u32>> = HashMap::new();
    for p in &people {
        let name = p[0].as_str().unwrap_or("").to_string();
        let mut v = 0u64;
        let mut vs = Vec::new();
        for g in p[1].as_array().map(Vec::as_slice).unwrap_or_default() {
            v += g.as_u64().unwrap_or(u64::MAX / 2);
            vs.push(v as u32);
        }
        sound &= !name.is_empty() && !vs.is_empty() && v < n && p[2].as_array().is_some_and(|f| f.len() == FAMILY.len());
        for f in p[2].as_array().map(Vec::as_slice).unwrap_or_default() {
            sound &= f.as_array().is_some_and(|l| l.iter().all(|i| i.as_u64().is_some_and(|i| (i as usize) < people.len())));
        }
        at.entry(name).or_default().extend(vs);
    }
    let names_in = |who: &str, osis: &str| -> bool {
        let mut it = osis.split('.');
        let (Some(b), Some(c), Some(v)) = (it.next().and_then(atlas_core::canon::by_osis), it.next().and_then(|c| c.parse().ok()), it.next().and_then(|v| v.parse().ok())) else {
            return false;
        };
        d.vz.index(b, c, v).is_some_and(|i| at.get(who).is_some_and(|vs| vs.contains(&i)))
    };
    Ok(vec![
        (sound, format!("{OUT} lists {} people, each named in real verses, with family among them", people.len())),
        (names_in("Aaron", "Exod.4.14") && names_in("Moses", "Exod.4.14"), "Exodus 4:14 names Aaron and Moses".to_string()),
        (names_in("Paul", "Acts.13.9"), "Acts 13:9 names Paul".to_string()),
        (!names_in("Moses", "Gen.1.1") && !names_in("God", "Gen.1.1"), "Genesis 1:1 names no person in the list (God is left out)".to_string()),
    ])
}
