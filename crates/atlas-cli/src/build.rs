//! `atlas build`: raw sources -> the files the web app loads.
//!
//! Outputs (all under `--out`, default `web/public/data`):
//! - `atlas.bin`: binary container with versification, cross-reference CSR,
//!   PageRank, book-to-book flows, root postings and the English index
//! - `meta.json`: books, counts, sources with commits and checksums, checksums
//!   of every output file, build id
//! - `lemmas.json`: one row per Hebrew/Aramaic/Greek root (column-oriented)
//! - `words.json`: sorted English vocabulary for search
//! - `themes.json`: themes resolved to root indices
//! - `layers.json`: layers of meaning from `config/layers.json`, checked against
//!   the BSB, the roots and the cross-references (drafts only with ATLAS_LAYER_DRAFTS=1)
//! - `text/<Book>.json`: per-book verses, English plus original-language words
//! - `lex/<n>.json`: lexicon definitions, 500 roots per shard, as safe segments

use crate::align;
use crate::english;
use crate::layers;
use crate::lexhtml;
use crate::parse::{self, GreekForms, Lang, LexEntry, Tally, Word, WordsByVerse};
use crate::sources::{sha256_bytes, Inputs};
use atlas_core::canon::{Testament, BOOKS};
use atlas_core::{ContainerWriter, XrefGraph};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::Path;
use std::time::Instant;

pub const LEX_SHARD: usize = 500;
pub const PAGERANK_DAMPING: f32 = 0.85;
pub const PAGERANK_ITERATIONS: u32 = 40;

pub const FLAG_ARAMAIC: u8 = 1;
pub const FLAG_OTHER_EDITIONS: u8 = 2;
pub const FLAG_VARIANT: u8 = 4;
pub const FLAG_SIGNIFICANT: u8 = 8;

#[derive(Deserialize)]
struct ThemeFile {
    themes: Vec<ThemeSpec>,
}
#[derive(Deserialize)]
struct ThemeSpec {
    id: String,
    name: String,
    blurb: String,
    roots: Vec<ThemeRoot>,
}
#[derive(Deserialize)]
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

struct Lemma {
    key: String,
    word: String,
    translit: String,
    gloss: String,
    lang: char,
    count: u32,
    lex: Option<LexEntry>,
}

fn write(out: &Path, rel: &str, bytes: &[u8], files: &mut BTreeMap<String, Value>) -> Result<(), String> {
    let p = out.join(rel);
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("creating {}: {e}", dir.display()))?;
    }
    fs::write(&p, bytes).map_err(|e| format!("writing {}: {e}", p.display()))?;
    files.insert(rel.to_string(), json!({ "bytes": bytes.len(), "sha256": sha256_bytes(bytes) }));
    Ok(())
}

fn word_json(w: &Word, lemma: i64) -> Value {
    let mut flags = 0u8;
    if w.lang == Lang::Aramaic {
        flags |= FLAG_ARAMAIC;
    }
    if !w.main {
        flags |= FLAG_OTHER_EDITIONS;
    }
    if w.variant {
        flags |= FLAG_VARIANT;
    }
    if w.significant {
        flags |= FLAG_SIGNIFICANT;
    }
    let mut row = vec![json!(w.surface), json!(w.translit), json!(w.gloss), json!(lemma), json!(w.morph), json!(flags)];
    if let Some(n) = &w.note {
        let mut o = serde_json::Map::new();
        o.insert("k".into(), json!(n.kind));
        if let Some(e) = &n.editions {
            o.insert("e".into(), json!(e));
        }
        if let Some(v) = &n.variants {
            o.insert("v".into(), json!(v));
        }
        row.push(Value::Object(o));
    }
    Value::Array(row)
}

pub fn run(root: &Path, raw: &Path, out: &Path) -> Result<(), String> {
    let t0 = Instant::now();
    let inputs = Inputs::open(root, raw)?;
    eprintln!("inputs verified against manifest.lock.json");

    // --- English text and verse numbering --------------------------------
    let bsb = parse::bsb(&inputs.path("bsb", "bsb"))?;
    let vz = bsb.versification.clone();
    let n = vz.verse_count();
    eprintln!("BSB: {} books, {} chapters, {} verses", vz.book_count(), vz.chapter_count(), n);
    let verse_book: Vec<u8> = (0..n).map(|v| vz.locate(v).unwrap().0).collect();

    // --- Cross-references -------------------------------------------------
    let mut xt = Tally::default();
    let raw_edges = parse::xrefs(&inputs.path("openbible-xref", "xref"), &vz, &mut xt)?;
    let graph = XrefGraph::build(n, raw_edges);
    graph.validate().map_err(|e| format!("cross-reference graph invalid: {e}"))?;
    eprintln!("cross-references: {} read, {} kept, {} unmapped", xt.read, graph.edge_count(), xt.unmapped);

    // --- Original-language words -------------------------------------------
    let mut words: WordsByVerse = vec![Vec::new(); n as usize];
    let mut ht = Tally::default();
    parse::tahot(&inputs.paths("tahot"), &vz, &mut words, &mut ht)?;
    let mut gt = Tally::default();
    let mut forms = GreekForms::new();
    parse::tagnt(&inputs.paths("tagnt"), &vz, &mut words, &mut forms, &mut gt)?;
    eprintln!("Hebrew/Aramaic words: {} read, {} unmapped", ht.read, ht.unmapped);
    eprintln!("Greek words: {} read, {} unmapped", gt.read, gt.unmapped);
    for (label, t) in [("cross-reference", &xt), ("Hebrew", &ht), ("Greek", &gt)] {
        if !t.unmapped_examples.is_empty() {
            eprintln!("  unmapped {label} examples: {}", t.unmapped_examples.join(" | "));
        }
    }

    // --- Word alignment (original word -> BSB English words) -----------------
    let mut at = align::AlignTally::default();
    let (eng_ot, eng_nt) = (inputs.path("clear-align", "english_ot"), inputs.path("clear-align", "english_nt"));
    let aligned = align::build(
        &align::Inputs {
            hebrew_links: &inputs.path("clear-align", "hebrew_links"),
            hebrew_source: &inputs.path("clear-align", "hebrew_source"),
            greek_links: &inputs.path("clear-align", "greek_links"),
            greek_source: &inputs.path("clear-align", "greek_source"),
            english: &[eng_ot.as_path(), eng_nt.as_path()],
        },
        &vz,
        &bsb.text,
        &words,
        &mut at,
    )?;
    eprintln!(
        "word alignment: {} of {} links kept, {} verses; {} of {} source words and {} of {} English words without a partner",
        at.kept, at.records, at.verses, at.source_unmatched, at.source_total, at.english_unmatched, at.english_total
    );

    // --- Lexicons ---------------------------------------------------------
    let mut lex: HashMap<String, LexEntry> = HashMap::new();
    let nh = parse::lexicon(&inputs.path("tbesh", "tbesh"), "tbesh", &mut lex)?;
    let ng = parse::lexicon(&inputs.path("tbesg", "tbesg"), "tbesg", &mut lex)?;
    eprintln!("lexicon entries: {nh} Hebrew/Aramaic, {ng} Greek");
    let mut by_base: HashMap<&str, &LexEntry> = HashMap::new();
    let mut lex_keys: Vec<&String> = lex.keys().collect();
    lex_keys.sort();
    for k in lex_keys {
        by_base.entry(&k[..5]).or_insert(&lex[k]);
    }

    // --- Root (lemma) table -------------------------------------------------
    let mut stats: BTreeMap<String, (u32, u32)> = BTreeMap::new(); // key -> (tokens, aramaic tokens)
    for vw in &words {
        for w in vw.iter().filter(|w| w.main) {
            if let Some(k) = &w.lemma {
                let s = stats.entry(k.clone()).or_default();
                s.0 += 1;
                if w.lang == Lang::Aramaic {
                    s.1 += 1;
                }
            }
        }
    }
    let mut missing_lex = 0;
    let lemmas: Vec<Lemma> = stats
        .iter()
        .map(|(key, &(count, aramaic))| {
            let entry = lex.get(key).or_else(|| by_base.get(&key[..5]).copied()).cloned();
            if entry.is_none() {
                missing_lex += 1;
            }
            let lang = if key.starts_with('G') { 'G' } else if aramaic * 2 > count { 'A' } else { 'H' };
            let (word, translit, gloss) = match (&entry, forms.get(key)) {
                (Some(e), _) => (e.word.clone(), e.translit.clone(), e.gloss.clone()),
                (None, Some((f, g))) => (f.clone(), String::new(), g.clone()),
                (None, None) => (key.clone(), String::new(), String::new()),
            };
            Lemma { key: key.clone(), word, translit, gloss, lang, count, lex: entry }
        })
        .collect();
    let lemma_index: HashMap<&str, u32> = lemmas.iter().enumerate().map(|(i, l)| (l.key.as_str(), i as u32)).collect();
    eprintln!("roots: {} ({} without a lexicon entry)", lemmas.len(), missing_lex);

    // --- Root postings (inverted index: root -> every place it occurs) ------
    let mut l_off = vec![0u32; lemmas.len() + 1];
    for vw in &words {
        for w in vw.iter().filter(|w| w.main) {
            if let Some(i) = w.lemma.as_deref().and_then(|k| lemma_index.get(k)) {
                l_off[*i as usize + 1] += 1;
            }
        }
    }
    for i in 0..lemmas.len() {
        l_off[i + 1] += l_off[i];
    }
    let total = l_off[lemmas.len()] as usize;
    let mut cursor = l_off.clone();
    let mut l_verse = vec![0u32; total];
    let mut l_pos = vec![0u16; total];
    for (v, vw) in words.iter().enumerate() {
        for (pos, w) in vw.iter().enumerate() {
            if !w.main {
                continue;
            }
            if let Some(i) = w.lemma.as_deref().and_then(|k| lemma_index.get(k)) {
                let at = cursor[*i as usize] as usize;
                l_verse[at] = v as u32;
                l_pos[at] = pos as u16;
                cursor[*i as usize] += 1;
            }
        }
    }

    // --- Graph metrics ------------------------------------------------------
    let rank = graph.pagerank(PAGERANK_DAMPING, PAGERANK_ITERATIONS);
    let max_rank = rank.iter().cloned().fold(0f32, f32::max).max(f32::MIN_POSITIVE);
    let rank_norm: Vec<f32> = rank.iter().map(|r| r / max_rank).collect();
    let mut degree = vec![0u32; n as usize];
    for v in 0..n {
        for e in graph.out(v) {
            if graph.votes[e] > 0 {
                degree[v as usize] += 1;
                degree[graph.dst[e] as usize] += 1;
            }
        }
    }
    let flow = graph.book_flow(66, |v| verse_book[v as usize]);

    // --- English search index ------------------------------------------------
    let eng = english::build(&bsb.text);

    // --- Themes -----------------------------------------------------------------
    let theme_file: ThemeFile = serde_json::from_str(
        &fs::read_to_string(root.join("config/themes.json")).map_err(|e| format!("reading config/themes.json: {e}"))?,
    )
    .map_err(|e| format!("parsing config/themes.json: {e}"))?;
    let mut themes_json = Vec::new();
    for t in &theme_file.themes {
        let mut idxs: Vec<u32> = Vec::new();
        for r in &t.roots {
            let found: Vec<u32> = lemmas
                .iter()
                .enumerate()
                .filter(|(_, l)| l.key.starts_with(&r.strong) && l.key.len() <= r.strong.len() + 1)
                .filter(|(_, l)| {
                    // Skip names and places that merely contain the word
                    // ("House of Shepherds", "Water (Gate)"): their glosses
                    // start with a capital letter, unless the root's own
                    // gloss is capitalized ("Passover", "Christ").
                    let proper = l.gloss.chars().find(|c| c.is_alphabetic()).is_some_and(char::is_uppercase);
                    let g = l.gloss.to_lowercase();
                    (!proper || r.capitalized) && r.matches.iter().any(|m| g.contains(m.as_str()))
                })
                .map(|(i, _)| i as u32)
                .collect();
            // An exclude that would not match anyway is a typo: fail loudly.
            if let Some(x) = r.exclude.iter().find(|x| !found.iter().any(|&i| lemmas[i as usize].key == **x)) {
                return Err(format!("theme {}: exclude {x} is not a root that {} {:?} includes", t.id, r.strong, r.matches));
            }
            let found: Vec<u32> = found.into_iter().filter(|&i| !r.exclude.contains(&lemmas[i as usize].key)).collect();
            if found.is_empty() {
                let near: Vec<String> = lemmas.iter().filter(|l| l.key.starts_with(&r.strong)).map(|l| format!("{}={:?}", l.key, l.gloss)).collect();
                return Err(format!("theme {}: {} matched no root with gloss {:?} (candidates: {})", t.id, r.strong, r.matches, near.join(", ")));
            }
            idxs.extend(found);
        }
        idxs.sort_unstable();
        idxs.dedup();
        let tokens: u32 = idxs.iter().map(|&i| lemmas[i as usize].count).sum();
        eprintln!(
            "theme {:<9} {:>5} occurrences via {}",
            t.id,
            tokens,
            idxs.iter().map(|&i| format!("{} ({})", lemmas[i as usize].key, lemmas[i as usize].gloss)).collect::<Vec<_>>().join(", ")
        );
        themes_json.push(json!({ "id": t.id, "name": t.name, "blurb": t.blurb, "roots": idxs }));
    }

    // --- Layers of meaning -------------------------------------------------------------
    let layer_sources = layers::Sources { text: &bsb.text, vz: &vz, words: &words, lemma_index: &lemma_index, graph: &graph };
    let layers_json = layers::build(root, &layer_sources)?;

    // --- Write outputs -------------------------------------------------------------
    for sub in ["text", "lex"] {
        let d = out.join(sub);
        if d.exists() {
            fs::remove_dir_all(&d).map_err(|e| format!("clearing {}: {e}", d.display()))?;
        }
    }
    fs::create_dir_all(out).map_err(|e| e.to_string())?;
    let mut files: BTreeMap<String, Value> = BTreeMap::new();
    for (rel, bytes) in crate::extra_quotes::build(&inputs, &vz, &bsb.text, &words)? { write(out, &rel, &bytes, &mut files)?; }

    let mut c = ContainerWriter::new();
    c.u32s("vz_bchap", &vz.book_chapter_start);
    c.u32s("vz_chap", &vz.chapter_start);
    c.u8s("v_book", &verse_book);
    c.f32s("v_rank", &rank_norm);
    c.u32s("v_degree", &degree);
    c.u32s("x_off", &graph.off);
    c.u32s("x_dst", &graph.dst);
    c.u16s("x_span", &graph.span);
    c.i16s("x_votes", &graph.votes);
    c.u32s("b_flow", &flow);
    c.u32s("l_off", &l_off);
    c.u32s("l_verse", &l_verse);
    c.u16s("l_pos", &l_pos);
    c.u32s("e_off", &eng.off);
    c.u32s("e_verse", &eng.verses);
    let bin = c.finish();
    write(out, "atlas.bin", &bin, &mut files)?;
    for (rel, bytes) in crate::extra_real_map::build(&inputs, &vz, &bsb.text)? { write(out, &rel, &bytes, &mut files)?; }
    for (rel, bytes) in crate::extra_peshitta::build(&inputs, &vz, &bsb.text)? { write(out, &rel, &bytes, &mut files)?; }
    for (rel, bytes) in crate::extra_translations::build(&inputs, &vz)? { write(out, &rel, &bytes, &mut files)?; }

    let lang_str: String = lemmas.iter().map(|l| l.lang).collect();
    let origin = crate::extra_aramaic::origins(root, &inputs, &vz, &bsb.text, &words, &lemma_index, &lex)?;
    for (rel, bytes) in crate::world::build(out, &inputs, &vz, &lemmas.iter().map(|l| (l.key.as_str(), l.word.as_str())).collect::<Vec<_>>(), &lemmas.iter().map(|l| l.gloss.as_str()).collect::<Vec<_>>(), &l_off, &l_verse)? { write(out, &rel, &bytes, &mut files)?; }
    let lemmas_json = json!({
        "key": lemmas.iter().map(|l| &l.key).collect::<Vec<_>>(),
        "word": lemmas.iter().map(|l| &l.word).collect::<Vec<_>>(),
        "translit": lemmas.iter().map(|l| &l.translit).collect::<Vec<_>>(),
        "gloss": lemmas.iter().map(|l| &l.gloss).collect::<Vec<_>>(),
        "lang": lang_str,
        "count": lemmas.iter().map(|l| l.count).collect::<Vec<_>>(),
        "origin": origin,
    });
    write(out, "lemmas.json", serde_json::to_string(&lemmas_json).unwrap().as_bytes(), &mut files)?;
    for (rel, bytes) in crate::extra_wordplay::build(&vz, &words)? { write(out, &rel, &bytes, &mut files)?; }
    write(out, "words.json", serde_json::to_string(&eng.words).unwrap().as_bytes(), &mut files)?;
    write(out, "bsb.txt", english::plain_text(&bsb.text).as_bytes(), &mut files)?;
    for (rel, bytes) in crate::extra_notes::build(&inputs, &vz)? { write(out, &rel, &bytes, &mut files)?; }
    write(out, "themes.json", serde_json::to_string(&themes_json).unwrap().as_bytes(), &mut files)?;
    for (rel, bytes) in crate::extra_hard_verses::build(root, &vz, &bsb.text)? { write(out, &rel, &bytes, &mut files)?; }
    write(out, "layers.json", serde_json::to_string(&layers_json).unwrap().as_bytes(), &mut files)?;
    for (rel, bytes) in crate::ask::build(root, &inputs, &vz, &bsb.text, &degree)? { write(out, &rel, &bytes, &mut files)?; }

    let (mut heb, mut ara, mut grk, mut var, mut sig) = (0usize, 0usize, 0usize, 0usize, 0usize);
    for (b, book) in BOOKS.iter().enumerate() {
        let b = b as u8;
        let mut chapters = Vec::new();
        for ch in 1..=vz.chapters_in(b) {
            let mut verses = Vec::new();
            for v in 1..=vz.verses_in(b, ch).unwrap() {
                let idx = vz.index(b, ch, v).unwrap() as usize;
                let ws: Vec<Value> = words[idx]
                    .iter()
                    .map(|w| {
                        if w.main {
                            match w.lang {
                                Lang::Hebrew => heb += 1,
                                Lang::Aramaic => ara += 1,
                                Lang::Greek => grk += 1,
                            }
                        }
                        var += w.variant as usize;
                        sig += w.significant as usize;
                        let li = w.lemma.as_deref().and_then(|k| lemma_index.get(k)).map(|&i| i as i64).unwrap_or(-1);
                        word_json(w, li)
                    })
                    .collect();
                match &aligned[idx] {
                    Some(a) => verses.push(json!([bsb.text[idx], ws, a.to_json(&words[idx])])),
                    None => verses.push(json!([bsb.text[idx], ws])),
                }
            }
            chapters.push(Value::Array(verses));
        }
        let doc = json!({ "book": book.osis, "chapters": chapters });
        write(out, &format!("text/{}.json", book.osis), serde_json::to_string(&doc).unwrap().as_bytes(), &mut files)?;
    }
    for (rel, bytes) in crate::extra_parallels::build(root, &inputs, &vz, &bsb.text, &words, &lemma_index)? { write(out, &rel, &bytes, &mut files)?; }
    for (rel, bytes) in crate::extra_aramaic::build(root, &inputs, &vz, &bsb.text, &words, &lemma_index, &lex)? { write(out, &rel, &bytes, &mut files)?; }

    let empty_verses = words.iter().filter(|w| w.is_empty()).count();
    for (rel, bytes) in crate::eras::build(root, &inputs, &vz)? { write(out, &rel, &bytes, &mut files)?; }
    for (s, chunk) in lemmas.chunks(LEX_SHARD).enumerate() {
        let rows: Vec<Value> = chunk
            .iter()
            .map(|l| match &l.lex {
                Some(e) => json!({
                    "w": e.word, "t": e.translit, "m": e.morph, "g": e.gloss, "s": e.source,
                    "d": lexhtml::segments(&e.definition, &vz),
                }),
                None => Value::Null,
            })
            .collect();
        write(out, &format!("lex/{s}.json"), serde_json::to_string(&rows).unwrap().as_bytes(), &mut files)?;
    }
    write(out, "lxx.json", crate::lxx::emit(lemmas.iter().map(|l| crate::lxx::Root { key: &l.key, word: &l.word, gloss: &l.gloss, lang: l.lang, kind: l.lex.as_ref().map_or("", |e| e.morph.as_str()), count: l.count }), &lex, &words, &vz).as_bytes(), &mut files)?;

    // Build id: hash of every output's hash, so identical inputs give an identical id.
    let digest: String = files.values().map(|f| f["sha256"].as_str().unwrap().to_string()).collect();
    let build_id = sha256_bytes(digest.as_bytes())[..12].to_string();

    let books_json: Vec<Value> = BOOKS
        .iter()
        .enumerate()
        .map(|(b, bk)| {
            let b = b as u8;
            json!({
                "osis": bk.osis, "step": bk.step, "name": bk.name,
                "testament": if bk.testament == Testament::Old { "OT" } else { "NT" },
                "genre": bk.genre.key(),
                "start": vz.book_start(b),
                "chapters": (1..=vz.chapters_in(b)).map(|c| vz.verses_in(b, c).unwrap()).collect::<Vec<_>>(),
            })
        })
        .collect();
    let sources_json: Vec<Value> = inputs
        .spec
        .sources
        .iter()
        .map(|s| {
            let locked = inputs.lock.sources.iter().find(|l| l.id == s.id).unwrap();
            json!({
                "id": s.id, "title": s.title, "provides": s.provides, "license": s.license,
                "attribution": s.attribution, "homepage": s.homepage, "repo": s.repo, "commit": s.commit,
                "note": s.note,
                "files": locked.files.values().map(|f| json!({ "path": f.path, "sha256": f.sha256, "bytes": f.bytes })).collect::<Vec<_>>(),
            })
        })
        .collect();
    let sections: Vec<Value> = atlas_core::Container::parse(&bin)
        .unwrap()
        .sections
        .iter()
        .map(|s| json!({ "name": s.name, "type": s.dtype.name(), "count": s.count }))
        .collect();
    let meta = json!({
        "format": 1,
        "buildId": build_id,
        "counts": {
            "books": 66, "chapters": vz.chapter_count(), "verses": n,
            "crossReferences": graph.edge_count(),
            "crossReferencesPositive": graph.votes.iter().filter(|&&v| v > 0).count(),
            "roots": lemmas.len(), "hebrewWords": heb, "aramaicWords": ara, "greekWords": grk,
            "wordsWithVariants": var, "significantVariants": sig,
            "englishWords": eng.words.len(), "versesWithoutOriginalWords": empty_verses,
        },
        "unmapped": { "crossReferences": xt.unmapped, "hebrewWords": ht.unmapped, "greekWords": gt.unmapped },
        "alignment": { "links": at.kept, "verses": at.verses, "sourceWordsUnmatched": at.source_unmatched, "englishWordsWithoutPartner": at.english_unmatched },
        "pagerank": { "damping": PAGERANK_DAMPING, "iterations": PAGERANK_ITERATIONS },
        "lexShard": LEX_SHARD,
        "flags": { "aramaic": FLAG_ARAMAIC, "otherEditionsOnly": FLAG_OTHER_EDITIONS, "variant": FLAG_VARIANT, "significant": FLAG_SIGNIFICANT },
        "books": books_json,
        "sources": sources_json,
        "sections": sections,
        "files": files,
    });
    fs::write(out.join("meta.json"), serde_json::to_string_pretty(&meta).unwrap()).map_err(|e| e.to_string())?;

    let total_bytes: u64 = files.values().map(|f| f["bytes"].as_u64().unwrap()).sum();
    eprintln!(
        "wrote {} files ({:.1} MB) to {} in {:.1}s; build {}",
        files.len() + 1,
        total_bytes as f64 / 1e6,
        out.display(),
        t0.elapsed().as_secs_f64(),
        build_id
    );
    eprintln!("words: {heb} Hebrew, {ara} Aramaic, {grk} Greek; {var} with edition/manuscript differences ({sig} meaningful)");
    if empty_verses > 0 {
        eprintln!("note: {empty_verses} verses have no original-language words mapped (versification differences)");
    }
    Ok(())
}
