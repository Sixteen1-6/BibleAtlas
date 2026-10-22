"""Where the re-check scripts keep downloaded pages and their own results.

EVIDENCE_CACHE (default: a folder named cache beside these scripts) holds bh/ (Bible Hub pages),
ia/ (archive.org OCR texts saved as <identifier>.txt), norm/, fetch/ and res/ (results).
REPO is the repository root (two folders above docs/evidence/tools), or BIBLEATLAS_REPO.
"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get("EVIDENCE_CACHE", os.path.join(HERE, "cache"))
REPO = os.environ.get("BIBLEATLAS_REPO", os.path.abspath(os.path.join(HERE, "..", "..", "..")))
for sub in ("bh", "ia", "norm", "fetch", "res"):
    os.makedirs(os.path.join(CACHE, sub), exist_ok=True)
