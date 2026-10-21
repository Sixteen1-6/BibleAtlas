import json, sys
SRC = "Drafted with AI help (Claude) from the BSB, STEPBible TAHOT, TAGNT, TBESH and TBESG, and OpenBible.info cross-references."
ps = json.load(open(sys.argv[1]))
out = []
for p in ps:
    q = {"id": p["id"], "section": p["section"], "ref": p["ref"], "saying": p["saying"], "source": SRC, "reviewed_by": [], "layers": []}
    for l in p["layers"]:
        m = {"kind": l["kind"], "strength": l["strength"], "refs": l["refs"]}
        if l.get("words"): m["words"] = l["words"]
        if l.get("evidence"): m["evidence"] = l["evidence"]
        m["text"] = l["text"]
        q["layers"].append(m)
    out.append(q)
json.dump({"passages": out}, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
