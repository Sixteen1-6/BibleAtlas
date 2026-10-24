# Bible Hub fetch (cached) and plain-text extraction
import os,re,html,time,urllib.request
import sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from _paths import CACHE
BH=os.path.join(CACHE,'bh')
def slug(book):
    if book in ('Song of Solomon','Song of Songs'): return 'songs'
    if book=='Psalm': book='Psalms'
    return book.lower().replace(' ','_')
def fetch(code,book,chapter):
    os.makedirs(BH,exist_ok=True)
    p=os.path.join(BH,f'{code}_{slug(book)}_{chapter}.htm')
    if not os.path.exists(p):
        u=f'https://biblehub.com/commentaries/{code}/{slug(book)}/{chapter}.htm'
        for k in range(3):
            try:
                b=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=60).read(); break
            except Exception as e:
                if k==2: raise
                time.sleep(3)
        open(p,'wb').write(b); time.sleep(0.7)
    return open(p,encoding='utf-8',errors='replace').read()
def text(h):
    i=h.find('<div class="chap"')
    if i<0: i=0
    j=h.find('<div id="botbox"',i)
    if j<0: j=h.find('<div class="padbot"',i)
    if j<0: j=len(h)
    s=h[i:j]
    s=re.sub(r'<script.*?</script>',' ',s,flags=re.S)
    s=re.sub(r'<(p|br|div)[^>]*>','\n',s)
    s=re.sub(r'<[^>]+>',' ',s)
    s=html.unescape(s)
    return re.sub(r'[ \t]+',' ',s)
def url(code,book,chapter): return f'https://biblehub.com/commentaries/{code}/{slug(book)}/{chapter}.htm'
