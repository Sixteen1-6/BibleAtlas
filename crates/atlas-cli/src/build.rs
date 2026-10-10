//! `atlas build`: raw sources -> the files the web app loads.
//!
//! Outputs (all under `--out`, default `web/public/data`):
//! - `atlas.bin`: binary container with versification, cross-reference CSR,
//!   PageRank, book-to-book flows, root postings and the English index
//! - `meta.json`: books, counts, sources with commits and checksums, checksums
//!   of every output file, build id
//! - `lemmas.json`: one row per Hebrew/Aramaic/Greek root (column-oriented)
//! - `words.json`: sorted English vocabulary for search
//! - `themes.json`: themes from `config/themes.json` resolved to root indices,
//!   with their group, level, key verses, left-out senses, the themes they
//!   are often linked with and the related words of `config/theme-related.json`
//!   (see `themes.rs`); `meta.json` gets the groups, the featured list and the
//!   rules for theme links
//! - `layers.json`: layers of meaning from `config/layers.json`, checked against
//!   the BSB, the roots and the cross-references (drafts only with ATLAS_LAYER_DRAFTS=1)
//! - `text/<Book>.json`: per-book verses, English plus original-language words
//! - `lex/<n>.json`: lexicon definitions, 500 roots per shard, as safe segments
//! - `shelf.json`, `dict/<id>/*.json`: the Sources shelf and the two Bible
//!   dictionaries the app shows in full (see `shelf.rs`)
//! - `ask/`: Ask the Bible's questions and Nave's subjects (see `ask.rs`)
//! - `naves/<Book>.json`: per verse, the Nave's subjects the Themes tab names
//!   at Study when no theme reaches the verse (see `naves.rs`)

use crate::align;
use crate::english;
use crate::family;
use crate::layers;
use crate::lexhtml;
use crate::parse::{self, GreekForms, Lang, LexEntry, Tally, Word, WordsByVerse};
use crate::sources::{sha256_bytes, Inputs};
use atlas_core::canon::{Testament, BOOKS};
use atlas_core::{ContainerWriter, XrefGraph};
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
    let mut senses = parse::SourceSenses::new();
    parse::tahot(&inputs.paths("tahot"), &vz, &mut words, &mut senses, &mut ht)?;
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
        "word alignment: {} of {} links kept, {} verses; {} of {} source words and {} of {} English words without a partner; {} links in {} verses left out because their English positions look shifted",
        at.kept, at.records, at.verses, at.source_unmatched, at.source_total, at.english_unmatched, at.english_total, at.shifted, at.shifted_verses
    );

    // --- Lexicons ---------------------------------------------------------
    let mut lex: HashMap<String, LexEntry> = HashMap::new();
    let nh = parse::lexicon(&inputs.path("tbesh", "tbesh"), "tbesh", &mut lex)?;
    let ng = parse::lexicon(&inputs.path("tbesg", "tbesg"), "tbesg", &mut lex)?;
    eprintln!("lexicon entries: {nh} Hebrew/Aramaic, {ng} Greek");
    let mut by_base: HashMap<&str, Vec<&LexEntry>> = HashMap::new();
    let mut lex_keys: Vec<&String> = lex.keys().collect();
    lex_keys.sort();
    for k in lex_keys {
        by_base.entry(&k[..5]).or_default().push(&lex[k]);
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
            // A sense with no entry of its own (H0430J "gods") borrows an entry of
            // its number, the one glossed like it if any, but keeps the gloss the
            // source gives it ("gods", not "God"; ": child" becomes "son: child").
            // (TAGNT keeps only the first gloss it meets, so Greek keeps the lexicon's.)
            let source = senses.get(key).and_then(|m| m.iter().max_by(|a, b| a.1.cmp(b.1).then(b.0.cmp(a.0)))).map(|(wg, _)| wg.1.clone()).filter(|g| !g.is_empty());
            let head = |g: &str| g.split(':').next().unwrap_or("").trim().to_lowercase();
            let mut entry = lex.get(key).cloned();
            if entry.is_none() {
                let all = by_base.get(&key[..5]).map_or(&[][..], |v| v.as_slice());
                let alike = source.as_deref().and_then(|g| all.iter().find(|e| head(&e.gloss) == head(g) && !head(g).is_empty()));
                entry = alike.or(all.first()).map(|e| {
                    let mut e = (*e).clone();
                    if let Some(g) = source.as_deref().filter(|g| head(g) != head(&e.gloss) || g.starts_with(':')) {
                        let named = e.relation.contains("Name of") || e.relation.contains("Part of");
                        // A name's entry says nothing true of a common word (gods).
                        if named && !g.starts_with(|c: char| c.is_uppercase()) {
                            e.definition.clear();
                        }
                        e.gloss = match g.strip_prefix(':') {
                            Some(m) => format!("{}: {}", e.gloss.split(':').next().unwrap_or("").trim(), m.trim()),
                            None => g.to_string(),
                        };
                    }
                    e
                });
            }
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

    // --- Word families (before the themes, whose related words come from them) ---
    let mut derivations = family::Derivations::default();
    let ng = family::derivations(&inputs.path("strongs", "greek"), 'G', &mut derivations)?;
    let nh = family::derivations(&inputs.path("strongs", "hebrew"), 'H', &mut derivations)?;
    let family_roots: Vec<family::Root> = lemmas
        .iter()
        .map(|l| {
            let e = l.lex.as_ref();
            // A sense with no entry of its own borrows its number's first entry:
            // the same dictionary word, but not that entry's links.
            let own = lex.contains_key(&l.key);
            let s = |f: fn(&LexEntry) -> &str| e.map_or("", f);
            family::Root {
                key: &l.key,
                count: l.count,
                // A name, or a sense the lexicon files as a name or a spelling of
                // one (מֶלֶךְ for Molech, שָׂדַי for Sirion), titles of God aside.
                name: s(|e| &e.morph).starts_with("N:")
                    || (own && s(|e| &e.relation).contains("Name of") && s(|e| &e.target) != "H3068G")
                    || (own && s(|e| &e.relation).contains("Spelling of") && lex.get(s(|e| &e.target)).is_some_and(|t| t.morph.starts_with("N:"))),
                word: s(|e| &e.word),
                morph: s(|e| &e.morph),
                gloss: s(|e| &e.gloss),
                estrong: s(|e| &e.estrong),
                relation: if own { s(|e| &e.relation) } else { "" },
                target: if own { s(|e| &e.target) } else { "" },
            }
        })
        .collect();
    let forms = family::build(&family_roots, &words, &l_off, &l_verse, &l_pos, &derivations);
    let related = forms.iter().filter(|f| f.get("r").is_some()).count();
    eprintln!(
        "word families: {} derivations ({} prefix compounds, {} shared roots) from {nh} Hebrew and {ng} Greek Strong's entries; {related} roots with relatives",
        derivations.parent.len(),
        derivations.head.len(),
        derivations.same.len()
    );

    // --- Themes -----------------------------------------------------------------
    let theme_keys: Vec<&str> = lemmas.iter().map(|l| l.key.as_str()).collect();
    let theme_glosses: Vec<&str> = lemmas.iter().map(|l| l.gloss.as_str()).collect();
    let theme_counts: Vec<u32> = lemmas.iter().map(|l| l.count).collect();
    // Each root's family (relative, relation, the relative's head), as forms/*.json has it.
    let theme_family: Vec<Vec<crate::themes::FamilyLink>> = forms
        .iter()
        .map(|f| {
            let row = |x: &Value| Some((x[0].as_u64()? as u32, x[1].as_str()?.chars().next()?, x[2].as_u64()? as u32));
            f["r"].as_array().map_or_else(Vec::new, |r| r.iter().filter_map(row).collect())
        })
        .collect();
    // The BSB words aligned to one original word, in lowercase.
    let theme_english = |v: u32, pos: u16| -> Vec<String> {
        let Some(a) = &aligned[v as usize] else { return Vec::new() };
        let groups: Vec<i32> = a.words.get(pos as usize).map_or_else(Vec::new, |g| g.iter().copied().filter(|&g| g >= 0).collect());
        let tokens = align::english_words(&bsb.text[v as usize]);
        a.english.iter().zip(&tokens).filter(|(g, _)| groups.contains(g)).map(|(_, t)| t.to_lowercase()).collect()
    };
    let themes = crate::themes::build(
        root,
        &crate::themes::Sources {
            keys: &theme_keys,
            glosses: &theme_glosses,
            counts: &theme_counts,
            l_off: &l_off,
            l_verse: &l_verse,
            l_pos: &l_pos,
            vz: &vz,
            graph: &graph,
            family: &theme_family,
            english: &theme_english,
        },
    )?;

    // --- Layers of meaning -------------------------------------------------------------
    let layer_sources = layers::Sources { text: &bsb.text, vz: &vz, words: &words, lemma_index: &lemma_index, graph: &graph };
    let layers_json = layers::build(root, &layer_sources)?;

    // --- Write outputs -------------------------------------------------------------
    for sub in ["text", "lex", "dict"] {
        let d = out.join(sub);
        if d.exists() {
            fs::remove_dir_all(&d).map_err(|e| format!("clearing {}: {e}", d.display()))?;
        }
    }
    fs::create_dir_all(out).map_err(|e| e.to_string())?;
    let mut files: BTreeMap<String, Value> = BTreeMap::new();
    // Quotation links, kept for Ask the Bible's ties: [ntFrom, ntTo, otFrom, otTo, kind].
    let mut quotes: Vec<(u32, u32, u32, u32)> = Vec::new();
    for (rel, bytes) in crate::extra_quotes::build(&inputs, &vz, &bsb.text, &words)? {
        if rel == "extras/quotes.json" {
            let doc: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
            for l in doc["links"].as_array().into_iter().flatten() {
                let n = |i: usize| l[i].as_u64().map(|x| x as u32);
                if let (Some(a), Some(b), Some(c), Some(d)) = (n(0), n(1), n(2), n(3)) {
                    quotes.push((a, b, c, d));
                }
            }
        }
        write(out, &rel, &bytes, &mut files)?;
    }

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
    write(out, crate::themes::OUT, &themes.json, &mut files)?;
    for (rel, bytes) in crate::extra_hard_verses::build(root, &vz, &bsb.text)? { write(out, &rel, &bytes, &mut files)?; }
    write(out, "layers.json", serde_json::to_string(&layers_json).unwrap().as_bytes(), &mut files)?;
    let naves = crate::naves::read(&inputs, &vz)?;
    let ask_sources = crate::ask::Sources { text: &bsb.text, vz: &vz, degree: &degree, graph: &graph, words: &words, lemma_index: &lemma_index, lemma_count: &theme_counts, quotes: &quotes };
    for (rel, bytes) in crate::ask::build(root, &naves, &ask_sources)? { write(out, &rel, &bytes, &mut files)?; }
    for (rel, bytes) in crate::naves::build(root, &inputs, &vz, &naves, &theme_glosses, &bsb.text)? { write(out, &rel, &bytes, &mut files)?; }

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
    let dictionaries = crate::shelf::dictionaries(root, &inputs, &vz)?;
    for (rel, bytes) in crate::shelf::build(root, &inputs, &vz, &dictionaries)? { write(out, &rel, &bytes, &mut files)?; }
    for (rel, bytes) in crate::extra_dictionary::build(&dictionaries, &vz, &bsb.text)? { write(out, &rel, &bytes, &mut files)?; }
    for (s, chunk) in lemmas.chunks(LEX_SHARD).enumerate() {
        let rows: Vec<Value> = chunk
            .iter()
            .map(|l| match &l.lex {
                Some(e) if !e.definition.is_empty() || lex.contains_key(&l.key) => json!({
                    "w": e.word, "t": e.translit, "m": e.morph, "g": e.gloss, "s": e.source,
                    "d": lexhtml::segments(&e.definition, &vz),
                }),
                _ => Value::Null,
            })
            .collect();
        write(out, &format!("lex/{s}.json"), serde_json::to_string(&rows).unwrap().as_bytes(), &mut files)?;
    }
    for (s, chunk) in forms.chunks(LEX_SHARD).enumerate() {
        write(out, &format!("forms/{s}.json"), serde_json::to_string(chunk).unwrap().as_bytes(), &mut files)?;
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
    let mut meta = json!({
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
        "alignment": { "links": at.kept, "verses": at.verses, "sourceWordsUnmatched": at.source_unmatched, "englishWordsWithoutPartner": at.english_unmatched, "shiftedLinksLeftOut": at.shifted, "versesWithShiftedLinks": at.shifted_verses },
        "pagerank": { "damping": PAGERANK_DAMPING, "iterations": PAGERANK_ITERATIONS },
        "lexShard": LEX_SHARD,
        "flags": { "aramaic": FLAG_ARAMAIC, "otherEditionsOnly": FLAG_OTHER_EDITIONS, "variant": FLAG_VARIANT, "significant": FLAG_SIGNIFICANT },
        "books": books_json,
        "sources": sources_json,
        "sections": sections,
        "files": files,
    });
    if let Some(m) = meta.as_object_mut() {
        for (k, v) in themes.meta {
            m.insert(k.to_string(), v);
        }
    }
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
