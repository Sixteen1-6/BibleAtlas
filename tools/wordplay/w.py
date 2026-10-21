import sys
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/tools')
import bible as B
for ref in sys.argv[1:]:
    s, e = B.rng(ref)
    for i in range(s, e + 1):
        row = B.verse_words(i)
        print(f'== {B.label(i)}  {row[0]}')
        print('   ' + ' | '.join(f'{w[1]}={B.LEM["key"][w[3]] if isinstance(w[3],int) and w[3]>=0 else "-"}({B.LEM["translit"][w[3]] if isinstance(w[3],int) and w[3]>=0 else ""}:{w[2]}){"*" if len(w)>5 and w[5] else ""}' for w in row[1]))
