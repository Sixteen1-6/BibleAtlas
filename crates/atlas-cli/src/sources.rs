//! sources.json (what to fetch) and manifest.lock.json (what was fetched).

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Source {
    pub id: String,
    pub title: String,
    pub provides: String,
    pub license: String,
    pub attribution: String,
    pub homepage: String,
    pub repo: String,
    pub commit: String,
    /// Logical name -> path inside the repository.
    pub files: BTreeMap<String, String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SourceSpec {
    pub sources: Vec<Source>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct LockedFile {
    pub path: String,
    pub sha256: String,
    pub bytes: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct LockedSource {
    pub id: String,
    pub commit: String,
    pub files: BTreeMap<String, LockedFile>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct Lock {
    pub sources: Vec<LockedSource>,
}

pub fn load_spec(root: &Path) -> Result<SourceSpec, String> {
    let p = root.join("sources.json");
    let text = fs::read_to_string(&p).map_err(|e| format!("reading {}: {e}", p.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("parsing {}: {e}", p.display()))
}

pub fn repo_dir_name(src: &Source) -> String {
    let name = src.repo.trim_end_matches('/').rsplit('/').next().unwrap_or("repo");
    format!("{name}@{}", &src.commit[..10.min(src.commit.len())])
}

pub fn sha256_file(path: &Path) -> Result<(String, u64), String> {
    let mut f = fs::File::open(path).map_err(|e| format!("opening {}: {e}", path.display()))?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    let mut total = 0u64;
    loop {
        let n = f.read(&mut buf).map_err(|e| format!("reading {}: {e}", path.display()))?;
        if n == 0 {
            break;
        }
        total += n as u64;
        h.update(&buf[..n]);
    }
    Ok((hex(&h.finalize()), total))
}

pub fn sha256_bytes(bytes: &[u8]) -> String {
    hex(&Sha256::digest(bytes))
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// Resolved, integrity-checked input files for a build.
pub struct Inputs {
    pub spec: SourceSpec,
    pub lock: Lock,
    raw: PathBuf,
}

impl Inputs {
    /// Load the lock and confirm every file still matches its recorded hash
    /// and that the lock matches the commits currently pinned in sources.json.
    pub fn open(root: &Path, raw: &Path) -> Result<Self, String> {
        let spec = load_spec(root)?;
        let lock_path = raw.join("manifest.lock.json");
        let text = fs::read_to_string(&lock_path)
            .map_err(|_| format!("{} not found; run `atlas fetch` first", lock_path.display()))?;
        let lock: Lock = serde_json::from_str(&text).map_err(|e| format!("parsing lock: {e}"))?;
        for src in &spec.sources {
            let locked = lock
                .sources
                .iter()
                .find(|l| l.id == src.id)
                .ok_or_else(|| format!("source {} is not in the lock; run `atlas fetch`", src.id))?;
            if locked.commit != src.commit {
                return Err(format!("source {} is pinned to {} but {} was fetched; run `atlas fetch`", src.id, src.commit, locked.commit));
            }
            for (key, f) in &locked.files {
                let (sha, _) = sha256_file(&raw.join(&f.path))?;
                if sha != f.sha256 {
                    return Err(format!("{} ({}) does not match its recorded SHA-256; run `atlas fetch` again", key, f.path));
                }
            }
        }
        Ok(Self { spec, lock, raw: raw.to_path_buf() })
    }

    pub fn path(&self, source: &str, key: &str) -> PathBuf {
        let l = self.lock.sources.iter().find(|l| l.id == source).expect("source in lock");
        self.raw.join(&l.files[key].path)
    }

    /// All files of one source in the order they are listed.
    pub fn paths(&self, source: &str) -> Vec<PathBuf> {
        let l = self.lock.sources.iter().find(|l| l.id == source).expect("source in lock");
        l.files.values().map(|f| self.raw.join(&f.path)).collect()
    }
}
