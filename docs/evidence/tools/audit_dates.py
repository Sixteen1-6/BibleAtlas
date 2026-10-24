"""Mirror of layers.rs dated(): every cite's read or checked date, and the cites with none or a URL mismatch."""
import json, re, sys, io, os, glob, collections
if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _paths import REPO as WT
L = json.load(open(os.path.join(WT, "config", "layers.json"), encoding="utf-8"))
S = json.load(open(os.path.join(WT, "config", "layer-sources.json"), encoding="utf-8"))
SRC = {c["id"]: c for c in S["cite"]}


def book_ch(on):
    m = re.match(r"^((?:[123] )?[A-Za-z ]+?) (\d+)", on)
    return {"Psalm": "Psalms"}.get(m.group(1), m.group(1)), int(m.group(2))


def link(c):
    if c.get("url"):
        return c["url"]
    s = SRC[c["source"]]
    b, ch = book_ch(c["on"])
    if s.get("biblehub"):
        slug = "songs" if b == "Song of Solomon" else b.lower().replace(" ", "_")
        return f"https://biblehub.com/commentaries/{s['biblehub']}/{slug}/{ch}.htm"
    if s.get("link"):
        return s["link"].replace("{book}", b.lower().replace(" ", "-")).replace("{chapter}", str(ch))
    return s.get("url")


def page_key(u):
    rest = u.split("://", 1)[1] if "://" in u else u
    h, _, path = rest.partition("/")
    h = h.lower()
    h = h[4:] if h.startswith("www.") else h
    return h + "/" + path.rstrip("/")


reads, checks = [], []
for f in sorted(glob.glob(os.path.join(WT, "docs", "evidence", "*.json"))):
    d = json.load(open(f, encoding="utf-8"))
    name = os.path.basename(f)
    if d.get("kind") == "reads":
        for r in d["records"]:
            fld = lambda k: r.get(k + "_now") if (k + "_now") in r else r.get(k)
            urls = [r["url"]] + ([r["url_now"]] if r.get("url_now") else [])
            reads.append(dict(file=name, passage=r["passage"], note=r.get("note"), kind=r.get("kind"), source=r["source"], on=fld("on"), at=fld("at"), urls=urls, fetched=r["fetched"], used=False))
    elif d.get("kind") == "checks":
        prs = {p["pr"]: p["merged"] for p in d["prs"]}
        for r in d["records"]:
            checks.append(dict(passage=r[0], note=r[1], kind=r[2], source=r[3], on=r[4], at=r[5], by=prs[r[6]]))


def dated(p, i, l, c):
    key = (c["source"], c.get("on"), c.get("at"))
    shared = any(n != i and any((x["source"], x.get("on"), x.get("at")) == key for x in ll["cites"]) for n, ll in enumerate(p["layers"]))
    same = lambda r: r["passage"] == p["id"] and r["source"] == c["source"] and r["on"] == c.get("on") and r["at"] == c.get("at") and (not shared or (r["note"] == i and r["kind"] == l["kind"]))
    u = link(c)
    read, other = None, None
    for r in reads:
        if not same(r):
            continue
        if any(page_key(x) == page_key(u) for x in r["urls"]):
            r["used"] = True
            read = min(read, r["fetched"]) if read else r["fetched"]
        else:
            other = r
    if read:
        return "read", read, u
    if other:
        return "mismatch", f"{other['file']} read {other['urls'][0]}", u
    ch = [x["by"] for x in checks if same(x)]
    if ch:
        return "checked", min(ch), u
    return "none", None, u


if __name__ == "__main__":
    tally = collections.Counter()
    bad = []
    for p in L["passages"]:
        for i, l in enumerate(p["layers"]):
            for c in l["cites"]:
                k, v, u = dated(p, i, l, c)
                tally[(k, v if k != "mismatch" else "")] += 1
                if k in ("none", "mismatch"):
                    bad.append((p["id"], i, l["kind"], c["source"], c.get("on"), c.get("at"), k, v, u))
    for k, v in sorted(tally.items(), key=str):
        print(k, v)
    print("unused reads records:", sum(1 for r in reads if not r["used"]))
    for b in bad:
        print("BAD", b)
