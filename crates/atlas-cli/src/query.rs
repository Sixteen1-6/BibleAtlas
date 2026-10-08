//! `atlas query ...`: the graph engine from the terminal.

use crate::loaded::Loaded;
use atlas_core::Adjacency;
use std::path::Path;
use std::time::Instant;

fn wrap(s: &str, width: usize) -> String {
    if s.chars().count() <= width {
        s.to_string()
    } else {
        let cut: String = s.chars().take(width - 1).collect();
        format!("{cut}…")
    }
}

pub fn run(out: &Path, args: &[String]) -> Result<(), String> {
    let d = Loaded::open(out)?;
    let opt = |name: &str, default: i64| -> i64 {
        args.iter().position(|a| a == name).and_then(|i| args.get(i + 1)).and_then(|v| v.parse().ok()).unwrap_or(default)
    };
    let pos: Vec<&String> = {
        let mut v = Vec::new();
        let mut skip = false;
        for a in args {
            if skip {
                skip = false;
            } else if a.starts_with("--") {
                skip = true;
            } else {
                v.push(a);
            }
        }
        v
    };
    match pos.first().map(|s| s.as_str()) {
        Some("xref") => {
            let r = pos.get(1).ok_or("usage: atlas query xref <reference> [--top N]")?;
            let (v, _) = d.resolve(r)?;
            let top = opt("--top", 12) as usize;
            println!("{}  {}", d.label(v), wrap(&d.english(v), 90));
            let range = d.graph.out(v);
            println!("{} cross-references; strongest {}:", range.len(), top.min(range.len()));
            for e in range.take(top) {
                let to = d.graph.dst[e];
                let span = d.graph.span[e];
                let label = if span > 1 { format!("{} (+{} verses)", d.label(to), span - 1) } else { d.label(to) };
                println!("  {:>4}  {:<28} {}", d.graph.votes[e], label, wrap(&d.english(to), 70));
            }
        }
        Some("path") => {
            let (a, b) = match (pos.get(1), pos.get(2)) {
                (Some(a), Some(b)) => (d.resolve(a)?.0, d.resolve(b)?.0),
                _ => return Err("usage: atlas query path <from> <to> [--min-votes N]".into()),
            };
            let t = Instant::now();
            let adj = Adjacency::from_graph(&d.graph);
            let built = t.elapsed();
            let t = Instant::now();
            let path = adj.shortest_path(a, b, opt("--min-votes", 1) as i16);
            let searched = t.elapsed();
            match path {
                None => println!("no connection found between {} and {}", d.label(a), d.label(b)),
                Some(p) => {
                    println!("{} steps (adjacency {:.1} ms, search {:.2} ms)", p.verses.len() - 1, built.as_secs_f64() * 1e3, searched.as_secs_f64() * 1e3);
                    for (i, v) in p.verses.iter().enumerate() {
                        let votes = if i == 0 { String::from("    ") } else { format!("{:>4}", d.graph.votes[p.edges[i - 1] as usize]) };
                        println!("  {votes}  {:<22} {}", d.label(*v), wrap(&d.english(*v), 80));
                    }
                }
            }
        }
        Some("roads") => {
            let usage = "usage: atlas query roads <from> <to> [--min-votes N] [--k K]";
            let (a, b) = match (pos.get(1), pos.get(2)) {
                (Some(a), Some(b)) => (d.resolve(a)?.0, d.resolve(b)?.0),
                _ => return Err(usage.into()),
            };
            let min_votes = opt("--min-votes", 1) as i16;
            let k = opt("--k", 3).max(1) as usize;
            let t = Instant::now();
            let adj = Adjacency::from_graph(&d.graph);
            let built = t.elapsed();
            let t = Instant::now();
            let roads = adj.roads(a, b, min_votes, k);
            let searched = t.elapsed();
            if roads.is_empty() {
                println!("no connection found between {} and {} with links of at least {min_votes} votes", d.label(a), d.label(b));
                return Ok(());
            }
            let rank = d.container().f32s("v_rank").map_err(|e| format!("{e:?}"))?;
            println!(
                "{} {} from {} to {}, sharing no verse but the two ends (links of at least {min_votes} votes; adjacency {:.1} ms, search {:.2} ms)",
                roads.len(),
                if roads.len() == 1 { "road" } else { "roads" },
                d.label(a),
                d.label(b),
                built.as_secs_f64() * 1e3,
                searched.as_secs_f64() * 1e3
            );
            for (i, p) in roads.iter().enumerate() {
                let inner = if p.verses.len() > 2 { &p.verses[1..p.verses.len() - 1] } else { &[][..] };
                // Named after its best-known inner verse, as the web app does.
                let via = match inner.iter().max_by(|x, y| rank[**x as usize].total_cmp(&rank[**y as usize]).then(y.cmp(x))) {
                    Some(&v) => format!("via {}", d.label(v)),
                    None if p.verses.len() == 2 => "direct link".to_string(),
                    None => "a single verse".to_string(),
                };
                let weakest = p.edges.iter().map(|&e| d.graph.votes[e as usize]).min();
                let steps = p.verses.len() - 1;
                println!();
                print!("road {}: {via}, cost {}, {steps} {}", i + 1, p.cost, if steps == 1 { "step" } else { "steps" });
                match weakest {
                    Some(w) => println!(", weakest link {w} votes"),
                    None => println!(),
                }
                for (j, v) in p.verses.iter().enumerate() {
                    let votes = if j == 0 { String::from("    ") } else { format!("{:>4}", d.graph.votes[p.edges[j - 1] as usize]) };
                    println!("  {votes}  {:<22} {}", d.label(*v), wrap(&d.english(*v), 80));
                }
            }
        }
        Some("near") => {
            let r = pos.get(1).ok_or("usage: atlas query near <reference> [--hops N] [--limit N]")?;
            let (v, _) = d.resolve(r)?;
            let adj = Adjacency::from_graph(&d.graph);
            let (nodes, _) = adj.neighborhood(v, opt("--hops", 2) as u8, opt("--min-votes", 10) as i16, opt("--limit", 25) as usize);
            for (u, hop) in nodes {
                println!("  {hop}  {:<22} {}", d.label(u), wrap(&d.english(u), 80));
            }
        }
        Some("word") => {
            let key = pos.get(1).ok_or("usage: atlas query word <Strong's number, e.g. H7225G or G0026>")?;
            let i = d.lemma_index(key).ok_or_else(|| format!("no root {key}"))?;
            let l = &d.lemmas;
            println!("{}  {}  {}  \"{}\"  ({} occurrences)", key, l["word"][i].as_str().unwrap_or(""), l["translit"][i].as_str().unwrap_or(""), l["gloss"][i].as_str().unwrap_or(""), l["count"][i]);
            let c = d.container();
            let off = c.u32s("l_off").map_err(|e| format!("{e:?}"))?;
            let verses = c.u32s("l_verse").map_err(|e| format!("{e:?}"))?;
            let mut per_book = [0u32; 66];
            for &v in &verses[off[i] as usize..off[i + 1] as usize] {
                per_book[d.vz.locate(v).unwrap().0 as usize] += 1;
            }
            let mut top: Vec<(usize, u32)> = per_book.iter().copied().enumerate().filter(|x| x.1 > 0).collect();
            top.sort_by_key(|x| std::cmp::Reverse(x.1));
            for (b, n) in top.into_iter().take(10) {
                println!("  {:>5}  {}", n, atlas_core::BOOKS[b].name);
            }
        }
        _ => return Err("usage: atlas query <xref|path|roads|near|word> ...".into()),
    }
    Ok(())
}
