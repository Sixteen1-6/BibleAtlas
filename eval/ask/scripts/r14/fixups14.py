#!/usr/bin/env python3
"""fixups14.py DRAFTS_DIR: two hand fixes to round 14's drafts once put together.
1. is-it-cheating-to-use-ai-for-schoolwork would reach 65 examples (53 + 5 + 7): keep one of each
   pair of near-same leaked-answer messages, so it holds 60.
2. hardship-1 added five messages about an AI checker flagging the asker's own work to
   i-have-been-falsely-accused; youth-1's new wrongly-accused-of-cheating-or-using-ai answers them
   more closely, so they move there."""
import json, sys, os
D = sys.argv[1]
def load(n): return json.load(open(os.path.join(D, n), encoding='utf-8'))
def save(n, x): json.dump(x, open(os.path.join(D, n), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
AI = 'is-it-cheating-to-use-ai-for-schoolwork'
drop = {
  'conscience-1.json': ['if i use leaked exam answers is that a sin',
                        'a friend sent me the questions for tomorrows exam, he got them from someone who took it this morning',
                        'the midterm answer key is going around snapchat and half my class has seen it. is it cheating if i just peek'],
  'youth-1.json': ['someone dropped the answers to tomorrows final in our class group chat, i havent clicked it yet but everyone else has',
                   'a guy is selling the leaked paper for the chem exam for 20 bucks, should i buy it'],
}
for n, texts in drop.items():
    d = load(n); before = len(d['add_examples'][AI])
    d['add_examples'][AI] = [e for e in d['add_examples'][AI] if e not in texts]
    assert before - len(d['add_examples'][AI]) == len(texts), n
    save(n, d)
h, y = load('hardship-1.json'), load('youth-1.json')
moved = h['add_examples'].pop('i-have-been-falsely-accused')
W = 'wrongly-accused-of-cheating-or-using-ai'
y['examples'][W] += [e for e in moved if e not in y['examples'][W]]
save('hardship-1.json', h); save('youth-1.json', y)
print('moved', len(moved), 'to', W, 'now', len(y['examples'][W]))
