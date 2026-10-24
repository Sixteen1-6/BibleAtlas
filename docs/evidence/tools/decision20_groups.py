"""The cites read in this batch for the Scripture check (spec 4.4), from the current config."""
import json, re, sys, io, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _paths import REPO as WT
L = json.load(open(os.path.join(WT, "config", "layers.json"), encoding="utf-8"))
S = json.load(open(os.path.join(WT, "config", "layer-sources.json"), encoding="utf-8"))
SRC = {c["id"]: c for c in S["cite"]}


def bk(on):
    m = re.match(r"^((?:[123] )?[A-Za-z ]+?) (\d+)", on)
    return {"Psalm": "Psalms"}.get(m.group(1), m.group(1)), int(m.group(2))


def writers(c):
    s = SRC[c["source"]]
    if s.get("works"):
        return []
    b, ch = bk(c["on"])
    for p in s["parts"]:
        if (p["books"] == "all" or b in p["books"]) and (not p.get("chapters") or p["chapters"][0] <= ch <= p["chapters"][1]):
            return p.get("writers") or []
    return []


def groups():
    g = {"eccl": [], "farrar": [], "reynolds-whitehouse": [], "plumptre-isaiah": []}
    for p in L["passages"]:
        for i, l in enumerate(p["layers"]):
            for c in l["cites"]:
                w = set(writers(c))
                b, ch = bk(c["on"])
                row = (p["id"], i, l["kind"], c)
                if b == "Ecclesiastes" and w & {"franz-delitzsch", "george-salmon", "w-j-deane"}:
                    g["eccl"].append(row)
                if "f-w-farrar" in w:
                    g["farrar"].append(row)
                if c["source"] == "ellicott" and b in ("Hosea", "Amos") and w & {"h-r-reynolds", "o-c-whitehouse"}:
                    g["reynolds-whitehouse"].append(row)
                if "e-h-plumptre" in w and b == "Isaiah" and 36 <= ch <= 39:
                    g["plumptre-isaiah"].append(row)
    return g


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    for k, v in groups().items():
        print("==", k, len(v))
        for r in v:
            print("  ", r[0], r[1], r[2], r[3]["source"], r[3]["on"], writers(r[3]))
