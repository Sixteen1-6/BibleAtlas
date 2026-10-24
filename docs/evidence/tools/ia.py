"""archive.org helpers: download a scan's page index and search text, find the leaf holding a phrase.

Leaf numbers are 0-based indexes into the scan's pages, as archive.org's
book reader uses them in /page/n<leaf>.
"""
import gzip, json, os, re, sys, urllib.request, io

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _paths import CACHE as _C
CACHE = os.path.join(_C, "ia")
UA = {"User-Agent": "Mozilla/5.0 (BibleAtlas citation check)"}

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()

def cached(name, url):
    p = os.path.join(CACHE, name.replace("/", "__"))
    if not os.path.exists(p):
        data = get(url)
        open(p, "wb").write(data)
    return open(p, "rb").read()

def meta(item):
    return json.loads(cached(item + "__meta.json", f"https://archive.org/metadata/{item}"))

def norm_words(s):
    out = []
    for m in re.finditer(r"[A-Za-z0-9]+", s):
        out.append((m.group(0).lower(), m.start()))
    return out

class Scan:
    def __init__(self, item, doc=None):
        self.item = item
        m = meta(item)
        files = [f["name"] for f in m["files"]]
        if doc is None:
            cands = [f for f in files if f.endswith("_hocr_searchtext.txt.gz")]
            doc = cands[0][: -len("_hocr_searchtext.txt.gz")]
        self.doc = doc
        q = urllib.request.quote
        st = cached(f"{item}__{doc}_st.gz", f"https://archive.org/download/{item}/{q(doc)}_hocr_searchtext.txt.gz")
        pi = cached(f"{item}__{doc}_pi.gz", f"https://archive.org/download/{item}/{q(doc)}_hocr_pageindex.json.gz")
        self.text = gzip.decompress(st).decode("utf-8")
        self.pages = json.loads(gzip.decompress(pi))
        self.words = norm_words(self.text)
        self.wtext = " " + " ".join(w for w, _ in self.words) + " "
        # char offset in wtext -> word index
        self.starts = []
        pos = 1
        for w, _ in self.words:
            self.starts.append(pos)
            pos += len(w) + 1
        try:
            pn = json.loads(cached(f"{item}__{doc}_pn.json", f"https://archive.org/download/{item}/{q(doc)}_page_numbers.json"))
            self.pnums = [p.get("pageNumber", "") for p in pn["pages"]]
        except Exception:
            self.pnums = None

    def leaf_of_char(self, c):
        for k, p in enumerate(self.pages):
            if p[0] <= c < p[1]:
                return k
        return None

    def find(self, phrase, start_word=0):
        """All (leaf, word index) hits of a phrase, compared as lowercase words."""
        ws = [w for w, _ in norm_words(phrase)]
        needle = " " + " ".join(ws) + " "
        hits = []
        i = self.wtext.find(needle)
        import bisect
        while i >= 0:
            wi = bisect.bisect_left(self.starts, i + 1)
            c = self.words[wi][1]
            hits.append((self.leaf_of_char(c), wi))
            i = self.wtext.find(needle, i + 1)
        return hits

    def page_text(self, leaf):
        a, b = self.pages[leaf][0], self.pages[leaf][1]
        return self.text[a:b]

    def url(self, leaf):
        if self.doc == self.item:
            return f"https://archive.org/details/{self.item}/page/n{leaf}/mode/1up"
        return f"https://archive.org/details/{self.item}/{urllib.request.quote(self.doc)}/page/n{leaf}/mode/1up"

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    s = Scan(sys.argv[1], sys.argv[3] if len(sys.argv) > 3 else None)
    for leaf, wi in s.find(sys.argv[2]):
        print(leaf, s.pnums[leaf] if s.pnums else "", s.url(leaf))
