import sys,subprocess,re
out=subprocess.run(['python3','/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp/vw.py']+sys.argv[1:],capture_output=True,text=True).stdout
cur=None;parts=[]
for line in out.splitlines():
    if line.startswith('=='):
        if cur: print(cur); print('   '+' | '.join(parts))
        cur=line[:160]; parts=[]
    else:
        m=re.match(r'\s*\d+\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*?)\s+"(.*)"$',line)
        if m: parts.append(f'{m.group(2)} {m.group(3)} "{m.group(5)}"')
        else: parts.append(line.strip())
if cur: print(cur); print('   '+' | '.join(parts))
