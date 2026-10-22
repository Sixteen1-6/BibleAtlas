"""Count each note's writers by person (the key the build ships), and list notes whose label claims more.

python recount.py [passage-id ...]   (no ids: a summary over every note)
"""
import json, re, sys, io, os, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _paths import REPO as WT
L = json.load(open(os.path.join(WT, "config", "layers.json"), encoding="utf-8"))
S = json.load(open(os.path.join(WT, "config", "layer-sources.json"), encoding="utf-8"))
SRC = {c["id"]: c for c in S["cite"]}
WORK = {w["id"]: w for w in S["works"]}
RANK = {"some interpreters": 1, "commonly held": 2, "widely agreed": 3}


def label(n):
    return "widely agreed" if n >= 3 else "commonly held" if n == 2 else "some interpreters" if n == 1 else "none"


def bk(on):
    m = re.match(r"^((?:[123] )?[A-Za-z ]+?) (\d+)", on)
    return {"Psalm": "Psalms"}.get(m.group(1), m.group(1)), int(m.group(2))


def key(c):
    s = SRC[c["source"]]
    if s.get("works"):
        w = WORK[c["work"]]
        return "+".join(w.get("writers", [])) or f"{w['id']}:all"
    b, ch = bk(c["on"])
    for p in s["parts"]:
        if (p["books"] == "all" or b in p["books"]) and (not p.get("chapters") or p["chapters"][0] <= ch <= p["chapters"][1]):
            if p.get("counts_as"):
                return p["counts_as"]
            if p.get("writers"):
                return "+".join(p["writers"])
            return f"{p['work']}:{b}"
    return "?"


def keys(l):
    return sorted({key(c) for c in l["cites"] if SRC[c["source"]]["role"] == "interpreter" and c.get("counts") is not False})


def passage_ok(p):
    return any(l["kind"] != "plain meaning" and l["strength"] != "some interpreters" for l in p["layers"])


if __name__ == "__main__":
    ids = sys.argv[1:]
    over = []
    for p in L["passages"]:
        for i, l in enumerate(p["layers"]):
            ks = keys(l)
            if ids and p["id"] not in ids:
                continue
            if ids:
                print(p["id"], i, l["kind"], "|", l["strength"], "->", label(len(ks)), "|", ks)
            elif l["kind"] != "plain meaning" and RANK[l["strength"]] > RANK.get(label(len(ks)), 0):
                over.append((p["id"], i, l["kind"], l["strength"], len(ks), ks))
        if ids and p["id"] in ids:
            print("   passage ok:", passage_ok(p))
    if not ids:
        print("notes (beyond the plain meaning) whose label is above their writers counted by person:", len(over))
        for o in over:
            print("  ", o)
