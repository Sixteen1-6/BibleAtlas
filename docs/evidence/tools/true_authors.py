import json,re,collections,sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from _paths import CACHE,REPO
os.chdir(CACHE)
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
ROOT=REPO
d=json.load(open(ROOT+'/config/layers.json',encoding='utf-8'))
OT=['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi']
NT=['Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation']
ALL=OT+NT
SC=" (Speaker's Commentary)"
def rng(a,b): return ALL[ALL.index(a):ALL.index(b)+1]
def parse(on):
    m=re.match(r'^((?:[123] )?[A-Za-z ]+?) (\d+)(?::(\d+))?',on); b=m.group(1); b={'Psalm':'Psalms','Song of Songs':'Song of Solomon'}.get(b,b)
    return b,int(m.group(2)),int(m.group(3) or 1)
def barnes(b,c):
    if b in NT or b in ('Job','Psalms','Isaiah','Daniel'): return 'Albert Barnes'
    if b=='Genesis': return 'James G. Murphy'
    if b in rng('Hosea','Malachi'): return 'E. B. Pusey'
    if b=='Exodus': return ('F. C. Cook' if c<=19 else 'Samuel Clark')+SC
    m={'Leviticus':'Samuel Clark','Numbers':'T. E. Espin and J. F. Thrupp','Deuteronomy':'T. E. Espin','Joshua':'T. E. Espin','Judges':'Lord Arthur Hervey','Ruth':'Lord Arthur Hervey','1 Samuel':'Lord Arthur Hervey','2 Samuel':'Lord Arthur Hervey','Proverbs':'E. H. Plumptre','Ecclesiastes':'W. T. Bullock','Song of Solomon':'T. L. Kingsbury','Jeremiah':'R. Payne Smith','Lamentations':'R. Payne Smith','Ezekiel':'G. Currey'}
    if b in m: return m[b]+SC
    if b in rng('1 Kings','Esther'): return 'George Rawlinson'+SC
    return '?'
PUL={'Genesis':'Thomas Whitelaw','Exodus':'George Rawlinson','Leviticus':'F. Meyrick','Numbers':'R. Winterbotham','Deuteronomy':'W. L. Alexander','Joshua':'J. J. Lias','Judges':'Lord A. C. Hervey (not re-read)','Ruth':'James Morison','1 Samuel':'R. Payne Smith','2 Samuel':'R. Payne Smith','1 Kings':'Joseph Hammond','2 Kings':'George Rawlinson','2 Chronicles':'P. C. Barker','Ezra':'George Rawlinson','Job':'George Rawlinson (title leaf missing in scan; not verified)','Psalms':'George Rawlinson','Proverbs':'W. J. Deane and S. T. Taylor-Taswell','Ecclesiastes':'W. J. Deane','Song of Solomon':'R. A. Redford','Isaiah':'George Rawlinson','Ezekiel':'E. H. Plumptre (vol. 2 with Thomas Whitelaw)','Daniel':'J. E. H. Thomson (not verified)','Hosea':'J. J. Given','Joel':'J. J. Given','Amos':'W. J. Deane','Obadiah':'W. J. Deane','Jonah':'W. J. Deane','Micah':'W. J. Deane','Nahum':'W. J. Deane','Habakkuk':'W. J. Deane','Zephaniah':'W. J. Deane','Haggai':'W. J. Deane','Zechariah':'W. J. Deane','Malachi':'W. J. Deane','Matthew':'A. Lukyn Williams and W. J. Deane','Mark':'E. Bickersteth','Luke':'H. D. M. Spence','John':'H. R. Reynolds','Acts':'Lord A. C. Hervey','Romans':'J. Barmby','1 Corinthians':'F. W. Farrar','2 Corinthians':'F. W. Farrar','Galatians':'E. Huxtable','Ephesians':'W. G. Blaikie','Philippians':'B. C. Caffin','Colossians':'G. G. Findlay','1 Thessalonians':'P. J. Gloag','2 Thessalonians':'P. J. Gloag','1 Timothy':'Lord A. C. Hervey','2 Timothy':'Lord A. C. Hervey','Titus':'Lord A. C. Hervey','Philemon':'S. J. Eales','Hebrews':'J. Barmby','James':'E. C. S. Gibson','1 Peter':'B. C. Caffin','2 Peter':'B. C. Caffin','1 John':'A. Plummer','2 John':'A. Plummer','3 John':'A. Plummer','Jude':'S. D. F. Salmond','Revelation':'A. Plummer, with T. Randell and A. T. Bott'}
ELL={'Genesis':'R. Payne Smith','Exodus':'George Rawlinson','Leviticus':'C. D. Ginsburg','Numbers':'C. J. Elliott','Deuteronomy':'C. H. Waller','Joshua':'C. H. Waller','Judges':'F. W. Farrar','Ruth':'R. Sinker','1 Samuel':'H. D. M. Spence','2 Samuel':'F. Gardiner','1 Kings':'Alfred Barry','2 Kings':'C. J. Ball','1 Chronicles':'C. J. Ball','2 Chronicles':'C. J. Ball','Ezra':'W. B. Pope','Nehemiah':'W. B. Pope','Esther':'R. Sinker','Job':'Stanley Leathes','Psalms':'A. S. Aglen','Proverbs':'J. W. Nutt','Ecclesiastes':'G. Salmon','Song of Solomon':'A. S. Aglen','Isaiah':'E. H. Plumptre','Jeremiah':'E. H. Plumptre','Lamentations':'E. H. Plumptre','Ezekiel':'F. Gardiner','Daniel':'H. Deane','Hosea':'H. R. Reynolds and O. C. Whitehouse','Joel':'S. L. Warren','Amos':'H. R. Reynolds and O. C. Whitehouse','Obadiah':'A. S. Aglen','Jonah':'A. S. Aglen','Micah':'S. L. Warren','Nahum':'A. C. Jennings','Habakkuk':'A. C. Jennings','Zephaniah':'A. C. Jennings','Haggai':'A. C. Jennings','Zechariah':'W. H. Lowe','Malachi':'W. H. Lowe','Matthew':'E. H. Plumptre','Mark':'E. H. Plumptre','Luke':'E. H. Plumptre','John':'H. W. Watkins','Acts':'E. H. Plumptre','Romans':'W. Sanday','1 Corinthians':'T. Teignmouth Shore','2 Corinthians':'E. H. Plumptre','Galatians':'W. Sanday','Ephesians':'Alfred Barry','Philippians':'Alfred Barry','Colossians':'Alfred Barry','1 Thessalonians':'A. J. Mason','2 Thessalonians':'A. J. Mason','1 Timothy':'H. D. M. Spence','2 Timothy':'H. D. M. Spence','Titus':'H. D. M. Spence','Philemon':'Alfred Barry','Hebrews':'W. F. Moulton','James':'E. G. Punchard','1 Peter':'A. J. Mason','2 Peter':'A. Plummer','1 John':'W. M. Sinclair','2 John':'W. M. Sinclair','3 John':'W. M. Sinclair','Jude':'A. Plummer','Revelation':'W. Boyd Carpenter'}
KDT={'Genesis':'James Martin','Exodus':'James Martin','Leviticus':'James Martin','Numbers':'James Martin','Deuteronomy':'James Martin','Joshua':'James Martin','Judges':'James Martin','Ruth':'James Martin','1 Samuel':'James Martin','2 Samuel':'James Martin','1 Kings':'translator not read','2 Kings':'translator not read','1 Chronicles':'Andrew Harper','2 Chronicles':'Andrew Harper','Ezra':'Sophia Taylor','Nehemiah':'Sophia Taylor','Esther':'Sophia Taylor','Job':'Francis Bolton','Psalms':'Francis Bolton','Proverbs':'M. G. Easton','Ecclesiastes':'M. G. Easton, not seen','Song of Solomon':'M. G. Easton, not seen','Isaiah':'James Martin','Jeremiah':'David Patrick and James Kennedy','Lamentations':'James Kennedy','Ezekiel':'James Martin','Daniel':'M. G. Easton'}
for b in rng('Hosea','Malachi'): KDT[b]='James Martin'
def kd(b): return ('Franz Delitzsch' if b in ('Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah') else 'C. F. Keil')+' (tr. '+KDT.get(b,'?')+')'
def jfb(b):
    if b in rng('Genesis','Esther'): return 'Robert Jamieson'
    if b in rng('Job','Malachi') or b in rng('1 Corinthians','Revelation'): return 'A. R. Fausset'
    return 'David Brown'
HENRYC={'Romans':'John Evans','1 Corinthians':'Simon Browne','2 Corinthians':'Daniel Mayo','Galatians':'Joshua Bayes','Ephesians':'Samuel Rosewell','Philippians':'William Harris','Colossians':'William Harris','1 Thessalonians':'Daniel Mayo','2 Thessalonians':'Daniel Mayo','1 Timothy':'Benjamin Andrews Atkinson','2 Timothy':'Benjamin Andrews Atkinson','Titus':'Jeremiah Smith','Philemon':'Jeremiah Smith','Hebrews':'William Tong','James':'Samuel Wright','1 Peter':'Zechariah Merrill','2 Peter':'Joseph Hill','1 John':'John Reynolds','2 John':'John Reynolds','3 John':'John Reynolds','Jude':'John Billingsley','Revelation':'William Tong'}
def henry(b): return HENRYC.get(b,'Matthew Henry')
def concise(b): return ('abridger not named; abridges '+HENRYC[b]+"'s continuation") if b in HENRYC else 'abridger not named; abridges Matthew Henry'
def poole(b,c):
    if b in rng('Genesis','Isaiah') and not (b=='Isaiah' and c>58): return 'Matthew Poole'
    if b=='Romans': return 'Richard Mayo (per Calamy 1713; the printed volume names no one)'
    return 'a continuator not named in the printed volume (1685)'
def wesley(b): return 'John Wesley, abridging chiefly Matthew Henry (1765 preface)' if b in OT else 'John Wesley, drawing on Bengel (1755 preface)'
F={'barnes':lambda b,c:barnes(b,c),'pulpit':lambda b,c:PUL.get(b,'?'),'ellicott':lambda b,c:ELL.get(b,'?'),'keil-delitzsch':lambda b,c:kd(b),'jfb':lambda b,c:jfb(b),'henry':lambda b,c:henry(b),'henry-concise':lambda b,c:concise(b),'poole':poole,'wesley':lambda b,c:wesley(b)}
per=json.load(open('res/barnes_percite.json',encoding='utf-8'))+json.load(open('res/ellicott_percite.json',encoding='utf-8'))+json.load(open('res/pulpit_percite.json',encoding='utf-8'))
ev={}
for x in per:
    sid='barnes' if '/barnes/' in x['url'] else ('ellicott' if '/ellicott/' in x['url'] else 'pulpit')
    ev[(sid,x['passage'],x['note'],x['on'])]=x
out=[]; tally=collections.defaultdict(collections.Counter); booktally=collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
for p in d['passages']:
    for li,l in enumerate(p['layers']):
        for c in l.get('cites',[]):
            s=c['source']
            if s=='church-fathers':
                a=c.get('at','').split(',')[0]; tally[s][a]+=1; out.append({'passage':p['id'],'note':li,'source':s,'on':c.get('on'),'at':c.get('at'),'true_author':a,'url':c.get('url')}); continue
            if s not in F or not c.get('on'): continue
            b,ch,v=parse(c['on'])
            a=F[s](b,ch)
            tally[s][a]+=1; booktally[s][a][b]+=1
            r={'passage':p['id'],'note':li,'source':s,'on':c['on'],'true_author':a}
            e=ev.get((s,p['id'],li,c['on']))
            if e:
                sc=e['score'] or 0; cb=e.get('chapter_best')
                r.update({'bible_hub_url':e['url'],'matched_scan':e['best'] if sc>=0.2 else (cb[0] if cb and cb[1]>=0.2 else None),'segment_score':sc,'chapter_score':cb[1] if cb else None,'matched_run':(e.get('run') or '')[:200]})
            out.append(r)
json.dump(out,open('res/true_authors_percite.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
for s,cn in tally.items():
    print('##',s,sum(cn.values()))
    for a,n in cn.most_common():
        bt=booktally[s][a]
        print('   ',n,'|',a,'|','; '.join(f'{bk} {bt[bk]}' for bk in ALL if bt[bk]))
print('rows',len(out))
nomatch=[r for r in out if r['source'] in ('barnes','ellicott','pulpit') and not r.get('matched_scan')]
print('unmatched',len(nomatch))
for r in nomatch: print('  ',r['source'],r['on'],r['true_author'],r.get('segment_score'))
