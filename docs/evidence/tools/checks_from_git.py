"""Re-derive docs/evidence/layers-checks-2026-10-11-to-17.json from the repository's history.

For every Layers cite in config/layers.json at COMMIT (default 2aabdcc, main before the true-credits
batch), find the first commit of the latest unbroken run of commits in which the cite is present
(git log -S per cite gives the same answer; plain git blame does not, because two commits re-sorted
whole sections), and map that commit to its pull request through the first-parent merges of main.
A cite whose run began in PR #38, #39, #42, #44 or #45 is "checked against the source" by that PR's
merge date. Cites with a reads record in docs/evidence/layers-mend-2026-10-20.json are left out: they
have a read date of their own.

    python -I checks_from_git.py [REPO] [COMMIT]

Prints the counts per PR and writes res/checks-rederived.json in the cache (see _paths.py): one row per cite,
[passage, note, kind, source, on, at, pr], naming each cite as it stood at COMMIT. The checks file
names the same cites as config/layers.json gives them after the true-credits batch, which changed
only the "at" of cites to works cited directly (it now gives only the place inside the work), and
removed 13 cites under the founder's decision 20 (docs/evidence/layers-credits-reads-2026-10-21.json).
Python 3 and git; standard library only.
"""
import collections, json, os, re, subprocess, sys

REPO = sys.argv[1] if len(sys.argv) > 1 else os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
COMMIT = sys.argv[2] if len(sys.argv) > 2 else "2aabdcc"
PRS = {38: "2026-10-11", 39: "2026-10-11", 42: "2026-10-17", 44: "2026-10-17", 45: "2026-10-17"}


def git(*args):
    return subprocess.run(["git", "-C", REPO, *args], capture_output=True, text=True, encoding="utf-8", check=True).stdout


def at_commit(c):
    return json.loads(git("show", f"{c}:config/layers.json"))


def keys(d):
    return {(p["id"], c.get("source"), c.get("on"), c.get("at"), c.get("url")) for p in d.get("passages", []) for l in p.get("layers", []) for c in l.get("cites", []) or []}


# Every commit before COMMIT that touched config/layers.json, oldest first.
commits = [l.split()[0] for l in git("log", "--format=%h", COMMIT, "--", "config/layers.json").split()]
commits.reverse()
snap = {c: keys(at_commit(c)) for c in commits}

# Commit -> PR: the commits each first-parent merge of main brought in.
pr_of = {}
for line in git("log", "--first-parent", "--merges", "--format=%H %s", COMMIT).splitlines():
    full, subj = line.split(" ", 1)
    m = re.search(r"#(\d+)", subj)
    if not m:
        continue
    for h in git("rev-list", f"{full}^1..{full}^2").split():
        pr_of.setdefault(h[:7], int(m.group(1)))


def entered(key):
    first = None
    for c in commits:
        if key in snap[c]:
            first = first or c
        else:
            first = None
    return first


mend = json.load(open(os.path.join(REPO, "docs", "evidence", "layers-mend-2026-10-20.json"), encoding="utf-8"))
read = {(r["passage"], r.get("note"), r["source"], r.get("on"), r.get("at")) for r in mend["records"]}
d = at_commit(COMMIT)
rows, by = [], collections.Counter()
for p in d["passages"]:
    for n, l in enumerate(p["layers"]):
        for c in l["cites"]:
            if (p["id"], n, c["source"], c.get("on"), c.get("at")) in read:
                by["own reads record"] += 1
                continue
            e = entered((p["id"], c.get("source"), c.get("on"), c.get("at"), c.get("url")))
            pr = pr_of.get(e[:7]) if e else None
            if pr in PRS:
                rows.append([p["id"], n, l["kind"], c["source"], c.get("on"), c.get("at"), pr])
                by[f"PR #{pr} (checked by {PRS[pr]})"] += 1
            else:
                by[f"entered {e} (PR {pr})"] += 1
for k, v in sorted(by.items()):
    print(f"{v:6}  {k}")
print(f"{len(rows):6}  rows written")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _paths import CACHE
json.dump(rows, open(os.path.join(CACHE, "res", "checks-rederived.json"), "w", encoding="utf-8"), ensure_ascii=False)
