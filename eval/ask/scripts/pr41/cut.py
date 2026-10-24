exec(open('fit3.py').read().split("for cols in")[0])
C6 = ['mp', 'xBest', 'text', 'closest', 'mn', 'teach']
r, S = lin(C6, 2)
print('no cut', r)
qs_ = np.percentile(S[judged], [10, 20, 30, 40, 50])
print('percentiles', qs_.round(2))
for th in np.linspace(-3, 0.5, 15):
    for mn in (3, 4):
        def pick(qi, idx, th=th, mn=mn):
            o = sorted([i for i in idx if judged[i]], key=lambda i: -S[i])
            keep = [i for i in o if S[i] >= th]
            return keep if len(keep) >= mn else o[:mn]
        e = evaluate(pick)
        print(f'th={th:+.2f} min={mn}', e['answered'], e['off'], e['shown'], f"{e['off']/e['shown']:.0%}", e['ans'])
