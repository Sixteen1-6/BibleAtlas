"""Fetch a page once, keep it with its UTC time, final URL, HTTP status and SHA-256.

python fetch.py URL [URL...]   -> prints one JSON line per page; the body is saved under the cache's fetch/ folder (see _paths.py).
"""
import hashlib, json, os, re, sys, time, urllib.request, io, html, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _paths import CACHE
OUT = os.path.join(CACHE, "fetch")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"}

def name_for(url):
    tail = re.sub(r"[^A-Za-z0-9._-]+", "_", url.split("://", 1)[1])[-40:]
    return hashlib.sha1(url.encode()).hexdigest()[:12] + "_" + tail

def fetch(url, force=False):
    p = os.path.join(OUT, name_for(url))
    meta = p + ".meta.json"
    if os.path.exists(meta) and not force:
        return json.load(open(meta, encoding="utf-8")), open(p, "rb").read()
    req = urllib.request.Request(url, headers=UA)
    t = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            body = r.read()
            status, final = r.status, r.geturl()
    except urllib.error.HTTPError as e:
        body, status, final = e.read(), e.code, url
    m = {"url": url, "final_url": final, "http": status, "time": t.strftime("%Y-%m-%dT%H:%M:%SZ"), "fetched": t.strftime("%Y-%m-%d"), "sha256": hashlib.sha256(body).hexdigest(), "bytes": len(body)}
    open(p, "wb").write(body)
    json.dump(m, open(meta, "w", encoding="utf-8"))
    time.sleep(0.6)
    return m, body

def text_of(body):
    t = body.decode("utf-8", errors="replace")
    t = re.sub(r"(?is)<(script|style).*?</\1>", " ", t)
    t = re.sub(r"(?s)<[^>]+>", " ", t)
    t = html.unescape(t)
    return re.sub(r"\s+", " ", t)

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    for u in sys.argv[1:]:
        try:
            m, b = fetch(u)
            print(json.dumps(m))
        except Exception as e:
            print(json.dumps({"url": u, "error": str(e)}))
