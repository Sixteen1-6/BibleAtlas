//! `atlas` - build, verify and query the Bible Atlas data.
//!
//!   atlas fetch                download the pinned source files (git required)
//!   atlas build                raw sources -> web/public/data
//!   atlas verify               check the built data
//!   atlas query xref John 3:16
//!   atlas query path "Gen 3:15" "Rev 12:9"
//!   atlas query near "Isa 53:5"
//!   atlas query word G0026
//!
//! Options: --raw <dir> (default data/raw), --out <dir> (default web/public/data)

mod align;
mod ask;
mod build;
mod english;
mod eras;
mod extra_aramaic;
mod extra_parallels;
mod extra_peshitta;
mod extra_quotes;
mod extra_real_map;
mod fetch;
mod layers;
mod extra_notes;
mod lexhtml;
mod loaded;
mod lxx;
mod parse;
mod query;
mod extra_translations;
mod sources;
mod verify;
mod world;

use std::path::PathBuf;

/// The workspace root is the nearest ancestor containing sources.json.
fn find_root() -> Result<PathBuf, String> {
    let mut dir = std::env::current_dir().map_err(|e| e.to_string())?;
    loop {
        if dir.join("sources.json").exists() {
            return Ok(dir);
        }
        if !dir.pop() {
            return Err("run atlas from inside the bible-atlas repository (no sources.json found)".into());
        }
    }
}

fn take_opt(args: &mut Vec<String>, name: &str) -> Option<String> {
    let i = args.iter().position(|a| a == name)?;
    if i + 1 >= args.len() {
        return None;
    }
    let v = args.remove(i + 1);
    args.remove(i);
    Some(v)
}

fn main() {
    let mut args: Vec<String> = std::env::args().skip(1).collect();
    let result = (|| -> Result<(), String> {
        let root = find_root()?;
        let raw = take_opt(&mut args, "--raw").map(PathBuf::from).unwrap_or_else(|| root.join("data/raw"));
        let out = take_opt(&mut args, "--out").map(PathBuf::from).unwrap_or_else(|| root.join("web/public/data"));
        match args.first().map(String::as_str) {
            Some("fetch") => fetch::run(&root, &raw),
            Some("build") => build::run(&root, &raw, &out),
            Some("verify") => verify::run(&out),
            Some("query") => query::run(&out, &args[1..]),
            _ => Err("usage: atlas <fetch|build|verify|query> [--raw DIR] [--out DIR]".into()),
        }
    })();
    if let Err(e) = result {
        eprintln!("error: {e}");
        std::process::exit(1);
    }
}
