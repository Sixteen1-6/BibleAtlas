import json, re, sys
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp')
import cq
WP = re.compile(r'paronomasia|play (?:up)?on|plays (?:up)?on|playing (?:up)?on|\bpun|allit|asson|similarity of sound|sound(?:s)? like|antanaclasis|paregmenon|parechesis|syllepsis|same word|double (?:sense|meaning)|ambiguous|equivoc', re.I)
NM = re.compile(r'\bname\b|\bnamed\b|signif|\bcalled\b|interpret|which is,? being|that is,|means|meaning', re.I)
AL = re.compile(r'allu|refer|reference|in imitation|borrowed|taken from|as in |compare|recalls|echo|type of|figure of', re.I)
STA = {b: s for b, s in zip(range(66), ['Gen','Exo','Lev','Num','Deu','Jos','Jdg','Rut','Sa1','Sa2','Kg1','Kg2','Ch1','Ch2','Ezr','Neh','Est','Job','Psa','Pro','Ecc','Sol','Isa','Jer','Lam','Eze','Dan','Hos','Joe','Amo','Oba','Jon','Mic','Nah','Hab','Zep','Hag','Zac','Mal','Mat','Mar','Luk','Joh','Act','Rom','Co1','Co2','Gal','Eph','Phi','Col','Th1','Th2','Ti1','Ti2','Tit','Plm','Heb','Jam','Pe1','Pe2','Jo1','Jo2','Jo3','Jde','Rev'])}
def signals(ref, kind, target=''):
    hits = []
    tgt = None
    if target:
        try:
            tb, tc, tv = cq.parse(target)
            tgt = re.compile(rf'{STA[tb]}\s*{tc}:|{cq.BOOKS[tb]}\s+{tc}:|{cq.FOS[tb]}\s*{tc}:', re.I)
        except SystemExit:
            pass
    for w in cq.WORKS:
        try:
            r = cq.get(w, ref)
        except SystemExit:
            r = None
        if not r:
            continue
        t = r[1]
        if kind == 'wordplay' and WP.search(t):
            hits.append(w)
        elif kind == 'name meaning' and (WP.search(t) or NM.search(t)):
            hits.append(w)
        elif kind == 'allusion' and ((tgt and tgt.search(t)) or (AL.search(t) and tgt is None)):
            hits.append(w)
    return hits
if __name__ == '__main__':
    b = json.load(open(sys.argv[1]))
    keep = 0; total = 0
    for x in b:
        for v in x['verses']:
            for c in v['candidates']:
                total += 1
                c['signal'] = signals(v['ref'], c['kind'], c.get('target', ''))
                keep += bool(c['signal'])
    json.dump(b, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
    print(keep, 'of', total, 'have a signal')
