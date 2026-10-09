//! `atlas fetch`: download exactly the pinned files, nothing more.
//!
//! Uses the system `git` with a blob-filtered, sparse, depth-1 fetch of the
//! pinned commit, so only the listed files are transferred. A file stored
//! with Git LFS checks out as a small pointer; its content is then downloaded
//! from GitHub's media server with the system `curl` and checked against the
//! pointer's SHA-256.

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

/// The SHA-256 and size a Git LFS pointer file names, if `text` is one.
fn lfs_pointer(text: &str) -> Option<(String, u64)> {
    let rest = text.strip_prefix("version https://git-lfs.github.com/spec/v1\n")?;
    let mut oid = None;
    let mut size = None;
    for line in rest.lines() {
        if let Some(h) = line.strip_prefix("oid sha256:") {
            oid = Some(h.trim().to_string());
        } else if let Some(n) = line.strip_prefix("size ") {
            size = n.trim().parse().ok();
        }
    }
    Some((oid?, size?))
}

/// Replace a checked-out LFS pointer with the file it points to.
fn lfs_content(repo: &str, commit: &str, path: &Path, rel: &str) -> Result<(), String> {
    let Ok(meta) = fs::metadata(path) else { return Ok(()) };
    if meta.len() > 1024 {
        return Ok(());
    }
    let Some((oid, size)) = fs::read_to_string(path).ok().as_deref().and_then(lfs_pointer) else { return Ok(()) };
    let Some(slug) = repo.strip_prefix("https://github.com/") else {
        return Err(format!("{rel} is stored with Git LFS, which is only fetched from github.com"));
    };
    let url = format!("https://media.githubusercontent.com/media/{}/{commit}/{rel}", slug.trim_end_matches(".git"));
    eprintln!("  downloading {rel} from Git LFS ({} MB)", size / 1_000_000);
    let tmp = path.with_extension("lfs-part");
    let out = Command::new("curl")
        .args(["-sSfL", "--retry", "3", "-o"])
        .arg(&tmp)
        .arg(&url)
        .output()
        .map_err(|e| format!("could not run curl ({e}); is curl installed?"))?;
    if !out.status.success() {
        return Err(format!("downloading {url} failed:\n{}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    let (sha, bytes) = sha256_file(&tmp)?;
    if sha != oid || bytes != size {
        let _ = fs::remove_file(&tmp);
        return Err(format!("{url} does not match its LFS pointer (sha256 {sha}, {bytes} bytes; expected {oid}, {size})"));
    }
    fs::rename(&tmp, path).map_err(|e| e.to_string())
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
        for f in &files {
            lfs_content(&repo, &commit, &dest.join(f), f)?;
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lfs_pointers() {
        let p = "version https://git-lfs.github.com/spec/v1\noid sha256:965cb0599beed2fe31283b615bcc369178141c0e718a66d97518d94309cfc124\nsize 84382719\n";
        assert_eq!(lfs_pointer(p), Some(("965cb0599beed2fe31283b615bcc369178141c0e718a66d97518d94309cfc124".into(), 84382719)));
        assert_eq!(lfs_pointer("id\tref\n"), None);
    }
}
