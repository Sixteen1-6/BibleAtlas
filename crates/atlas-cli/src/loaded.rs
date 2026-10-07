//! Read the built data back (used by `atlas verify` and `atlas query`).

use atlas_core::{Container, Versification, XrefGraph, BOOKS};
use serde_json::Value;
use std::cell::RefCell;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

pub struct Loaded {
    pub dir: PathBuf,
    pub meta: Value,
    pub bin: Vec<u8>,
    pub vz: Versification,
    pub graph: XrefGraph,
    pub lemmas: Value,
    text: RefCell<HashMap<u8, Value>>,
}

fn json(path: &Path) -> Result<Value, String> {
    let s = fs::read_to_string(path).map_err(|e| format!("reading {}: {e} (run `atlas build` first)", path.display()))?;
    serde_json::from_str(&s).map_err(|e| format!("parsing {}: {e}", path.display()))
}

impl Loaded {
    pub fn open(dir: &Path) -> Result<Self, String> {
        let meta = json(&dir.join("meta.json"))?;
        let bin = fs::read(dir.join("atlas.bin")).map_err(|e| format!("reading atlas.bin: {e}"))?;
        let (vz, graph) = {
            let c = Container::parse(&bin).map_err(|e| format!("atlas.bin: {e:?}"))?;
            let e = |e| format!("atlas.bin: {e:?}");
            let vz = Versification::from_arrays(c.u32s("vz_bchap").map_err(e)?, c.u32s("vz_chap").map_err(e)?)
                .ok_or("atlas.bin: inconsistent versification arrays")?;
            let graph = XrefGraph {
                off: c.u32s("x_off").map_err(e)?,
                dst: c.u32s("x_dst").map_err(e)?,
                span: c.u16s("x_span").map_err(e)?,
                votes: c.i16s("x_votes").map_err(e)?,
            };
            (vz, graph)
        };
        let lemmas = json(&dir.join("lemmas.json"))?;
        Ok(Self { dir: dir.to_path_buf(), meta, bin, vz, graph, lemmas, text: RefCell::new(HashMap::new()) })
    }

    pub fn container(&self) -> Container<'_> {
        Container::parse(&self.bin).expect("validated at open")
    }

    pub fn label(&self, v: u32) -> String {
        match self.vz.locate(v) {
            Some((b, c, vv)) => format!("{} {c}:{vv}", BOOKS[b as usize].name),
            None => format!("#{v}"),
        }
    }

    /// `[english, words]` for a verse, loading its book on first use.
    pub fn verse(&self, v: u32) -> Result<Value, String> {
        let (b, c, vv) = self.vz.locate(v).ok_or("verse out of range")?;
        let mut cache = self.text.borrow_mut();
        if let std::collections::hash_map::Entry::Vacant(e) = cache.entry(b) {
            let doc = json(&self.dir.join(format!("text/{}.json", BOOKS[b as usize].osis)))?;
            e.insert(doc);
        }
        Ok(cache[&b]["chapters"][c as usize - 1][vv as usize - 1].clone())
    }

    pub fn english(&self, v: u32) -> String {
        self.verse(v).ok().and_then(|x| x[0].as_str().map(str::to_string)).unwrap_or_default()
    }

    pub fn resolve(&self, input: &str) -> Result<(u32, u32), String> {
        let q = atlas_core::refs::parse(input).ok_or_else(|| format!("could not read the reference {input:?}"))?;
        atlas_core::refs::resolve(q, &self.vz).ok_or_else(|| format!("{input:?} is not in the text"))
    }

    pub fn lemma_index(&self, key: &str) -> Option<usize> {
        self.lemmas["key"].as_array()?.iter().position(|k| k.as_str() == Some(key))
    }
}
