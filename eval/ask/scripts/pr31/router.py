import json, math
"""router.py: the site's router (web/src/ui/ask/route.ts) over a tt.cjs dump, with signal variants for tuning."""
class Router:
    def __init__(self, dump, use_sig=False, sig_ways=False, sig_one_df=0, unknown=None):
        Q = dump['questions']
        self.ids = [q['id'] for q in Q]
        self.ways = [[set(w) for w in q['ways'] if w] for q in Q]
        self.sig = [[set(t) for s, t in q['sig'] if t] for q in Q] if use_sig else [[] for _ in Q]
        self.title = [set(q['title']) for q in Q]
        self.all = [set().union(*ws) if ws else set() for ws in self.ways]
        for i, ss in enumerate(self.sig):
            for s in ss: self.all[i] |= s
        self.df = {}
        for a in self.all:
            for t in a: self.df[t] = self.df.get(t, 0) + 1
        n = len(Q)
        self.idf = {t: math.log(1 + n / c) for t, c in self.df.items()}
        self.unknown = math.log(1 + n) if unknown is None else unknown
        self.sig_ways = sig_ways; self.sig_one_df = sig_one_df
    def w(self, t): return self.idf.get(t, self.unknown)
    def routes(self, typed, limit=3):
        typed = set(typed)
        if not typed: return []
        total = sum(self.w(t) for t in typed)
        out = []
        for i in range(len(self.ids)):
            said = weight = 0; src = None
            cand = [(w, 'way') for w in self.ways[i]] + ([(s, 'sig') for s in self.sig[i]] if self.sig_ways else [])
            for way, kind in cand:
                if len(way) < 2:
                    t0 = next(iter(way))
                    if kind == 'way' and (len(typed) > 1 or self.df.get(t0, 0) > 20): continue
                    if kind == 'sig' and self.df.get(t0, 0) > self.sig_one_df: continue
                tot = sum(self.w(t) for t in way); hit = sum(self.w(t) for t in way if t in typed)
                f = hit / tot
                if f > said or (f == said and hit > weight): said, weight, src = f, hit, kind
            if not said: continue
            cov = sum(self.w(t) for t in typed if t in self.all[i]) / total
            own = sum(self.w(t) for t in typed if t in self.title[i]) / total
            out.append(dict(id=self.ids[i], said=said, covers=cov, own=own, weight=weight, src=src, score=said * (0.4 + 0.6 * cov) + 0.1 * own))
        out.sort(key=lambda r: -r['score'])
        return out[:limit]
    def route(self, info, P):
        if info['care']: return None
        if info['exact']: return info['exact']
        rs = self.routes(info['terms'], 2)
        if not rs: return None
        b = rs[0]; n = rs[1] if len(rs) > 1 else None
        most = b['said'] >= P.get('said', .75) and b['covers'] >= P.get('covers', .5) and b['score'] >= P.get('score', .6)
        whole = b['said'] >= .99 and b['weight'] >= P.get('weight', 99) and b['covers'] >= P.get('thin', .25)
        if not most and not whole: return None
        if n and b['score'] - n['score'] < P.get('margin', .08) and n['said'] >= P.get('said', .75): return None
        return b['id']
