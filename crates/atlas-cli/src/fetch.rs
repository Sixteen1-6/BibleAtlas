//! `atlas fetch`: download exactly the pinned files, nothing more.
//!
//! Uses the system `git` with a blob-filtered, sparse, depth-1 fetch of the
//! pinned commit, so only the listed files are transferred.

use crate::sources::{load_spec, repo_dir_name, sha256_file, Lock, LockedFile, LockedSource};
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::process::Command;

fn git(dir: &Path, args: &[&str]) -> Result<(), String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .map_err(|e| format!("could not run git ({e}); is git installed?"))?;
    if !out.status.success() {
        return Err(format!("git {} failed in {}:\n{}", args.join(" "), dir.display(), String::from_utf8_lossy(&out.stderr).trim()));
    }
    Ok(())
}

pub fn run(root: &Path, raw: &Path) -> Result<(), String> {
    let spec = load_spec(root)?;
    fs::create_dir_all(raw).map_err(|e| format!("creating {}: {e}", raw.display()))?;

    // One checkout per (repo, commit), covering every file any source needs from it.
    let mut groups: BTreeMap<String, (String, String, Vec<String>)> = BTreeMap::new();
    for src in &spec.sources {
        let entry = groups.entry(repo_dir_name(src)).or_insert_with(|| (src.repo.clone(), src.commit.clone(), Vec::new()));
        entry.2.extend(src.files.values().cloned());
    }

    for (dir_name, (repo, commit, mut files)) in groups {
        files.sort();
        files.dedup();
        let dest = raw.join(&dir_name);
        eprintln!("fetching {} file(s) from {repo} @ {}", files.len(), &commit[..10]);
        fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
        if !dest.join(".git").exists() {
            git(&dest, &["init", "-q"])?;
            git(&dest, &["remote", "add", "origin", &repo])?;
        }
        git(&dest, &["config", "core.sparseCheckout", "true"])?;
        let sparse: String = files.iter().map(|f| format!("/{f}\n")).collect();
        fs::write(dest.join(".git/info/sparse-checkout"), sparse).map_err(|e| e.to_string())?;
        git(&dest, &["fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", &commit])?;
        git(&dest, &["-c", "advice.detachedHead=false", "checkout", "-q", "--force", "FETCH_HEAD"])?;
    }

    let mut lock = Lock::default();
    for src in &spec.sources {
        let base = raw.join(repo_dir_name(src));
        let mut files = BTreeMap::new();
        for (key, rel) in &src.files {
            let p = base.join(rel);
            let (sha256, bytes) = sha256_file(&p).map_err(|e| format!("{e} (missing after fetch?)"))?;
            let path = p.strip_prefix(raw).unwrap().to_string_lossy().into_owned();
            files.insert(key.clone(), LockedFile { path, sha256, bytes });
        }
        lock.sources.push(LockedSource { id: src.id.clone(), commit: src.commit.clone(), files });
    }
    let lock_path = raw.join("manifest.lock.json");
    fs::write(&lock_path, serde_json::to_string_pretty(&lock).unwrap()).map_err(|e| e.to_string())?;
    eprintln!("wrote {}", lock_path.display());
    Ok(())
}
