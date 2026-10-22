import sys,json,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from _paths import CACHE
os.chdir(CACHE)
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
import bh,match
jobs=[('pulpit','Ruth',3,['cu31924101104937']),('pulpit','Ruth',4,['cu31924101104937']),('ellicott','Genesis',27,['oldtestamentcomm01elli']),('ellicott','Deuteronomy',32,['oldtestamentcomm02elli']),('barnes','Nehemiah',9,['holybibleaccordi0003unse']),('ellicott','Job',1,['oldtestamentcomm04elli']),('ellicott','Job',37,['oldtestamentcomm04elli']),('barnes','Psalms',104,['notescriticalexp03barnuoft','notescriticalexp187102barn']),('pulpit','Isaiah',32,['cu31924101104564','cu31924101104507']),('ellicott','2 Kings',24,['oldtestamentcomm03elli']),('barnes','Jeremiah',25,['holybibleaccordi0005unse']),('pulpit','Micah',1,['cu31924101104796']),('ellicott','Malachi',4,['oldtestamentcomm05elli']),('ellicott','Isaiah',60,['oldtestamentcomm04elli'])]
res=[]
for code,b,c,ids in jobs:
    sc=match.score(bh.text(bh.fetch(code,b,c)),ids)
    row=[code,b,c,[(x[0],x[3],x[1],x[2]) for x in sc],sc[0][4][:200]]
    res.append(row); print(row,flush=True)
json.dump(res,open('res/recheck.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
