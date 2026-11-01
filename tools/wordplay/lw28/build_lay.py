"""build_lay.py: lead batches for the Layers wordplay items of NOT-BUILT-YET.md (the doubled verb, the nacham play in
1 Samuel 15, Samson's riddle), in the batch format lwrite63.js reads. Hints only."""
import json, re, sys
sys.path.insert(0, '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp/lw28')
from build_lw28 import rows_for, existing
W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
POLY = ('The doubled verb (Bullinger: Polyptoton): in Hebrew a verb is put twice, once as an infinitive, to make it '
        'certain; the BSB turns this into "surely", "freely", "indeed" or "eagerly", so the reader cannot see it. Round 3 '
        'wrote the same device as wordplay notes on Exodus 15:1, Psalm 40:1, Hebrews 6:14 and Mark 4:12: copy their '
        'shape. Bullinger alone is "some interpreters" and cannot carry a new passage; look hard for a second writer.')
B = [
 ('poly-a', [
   ('Genesis 2:17', 'wordplay', 'Genesis 2:16-17', POLY + ' Use passage id genesis-2-17 with Genesis 2:16 in refs (both doubled verbs: "eat freely" and "surely die"). The local check found Bullinger (Polyptoton), Henry ("Dying thou shalt die, denoting a sure and dreadful sentence"), Clarke ("Literally, a death thou shalt die"), Keil (the infinitive "intensifies the latter"). Barnes on Genesis is James G. Murphy\'s text (resolve.py names him).'),
   ('Genesis 3:4', 'wordplay', 'Genesis 3:4', POLY + ' The serpent answers God\'s doubled verb with the same form to deny it. The local check found Bullinger ("Here the serpent emphatically denies Jehovah\'s words") and Keil ("ye will positively not die"). On main the verse is only in the john-8-44 allusion.'),
   ('Genesis 37:33', 'wordplay', 'Genesis 37:33', POLY + ' Literally "tearing, he is torn". The local check found only Bullinger ("The figure employed shows the intensity of Jacob\'s feelings"); a second writer is needed for a new passage. genesis-50-20 on main mentions 37:33 only for another wordplay.'),
   ('Exodus 3:16', 'wordplay', 'Exodus 3:16', POLY + ' Literally "visiting I have visited", the same doubled verb as Joseph\'s "God will surely visit you" (Genesis 50:24). The local check found only Bullinger. exodus-3-14 is a different verse.'),
 ]),
 ('poly-b', [
   ('Luke 22:15', 'wordplay', 'Luke 22:15', POLY + ' In Luke\'s Greek "with desire I have desired", a Hebrew way of speaking; credit the Greek wording to Luke, never to Jesus\' own words. The local check found Bullinger, Clarke ("A Hebraism for, I have desired most earnestly") and Barnes ("This is a Hebrew form of expression, and means I have greatly desired").'),
   ('Acts 7:34', 'wordplay', 'Acts 7:34', POLY + ' Stephen quotes Exodus 3:7, "seeing I have seen"; put Exodus 3:7 in refs. The local check found Bullinger ("Lit. it is \'Seeing I have seen\'") and Barnes ("The repetition of this word is in accordance with the usage of the Hebrew writers"); Calvin only translates the phrase, so he does not count.'),
   ('1 Samuel 15:29', 'wordplay', '1 Samuel 15:11', 'One Hebrew verb, nacham, is "regret" in 15:11 and 15:35 and "change His mind" (twice) in 15:29: God "regrets", yet "He is not a man, that He should change His mind." The passage 1-samuel-15-29 is live (a plain meaning and a Numbers 23:19 allusion): this is an addition to it, refs 1 Samuel 15:29, 15:11, 15:35, with the nacham key in words for each. The local check found only Keil (Keil and Delitzsch on 15:29, setting it against 15:11: "theomorphically" and "anthropomorphically"); Gill, Wesley and Henry\'s Concise do not state the shared word. An addition may stand on one writer as "some interpreters". Show both believing views where the cited writers differ on whether God\'s regret is real.'),
   ('Judges 14:14', 'wordplay', 'Judges 14:14', 'Samson\'s riddle, which the text itself calls a riddle: "Out of the eater came something to eat, and out of the strong came something sweet." The local catalogue names only Bullinger, under Aenigma. Write a wordplay note only if a writer states a play in the Hebrew words (eater and food from one root, or the sound of the lines); a riddle with no stated word play is not a wordplay note, so drop it with that reason. One writer cannot carry a new passage.'),
 ]),
]
out = []
for key, verses in B:
    vs = []
    for ref, kind, catkey, note in verses:
        rows = rows_for(catkey)
        leads = [{'work': 'local study', 'snippet': f"The founder's local literary catalogue (2026-10-20), read in local copies with no page recorded: {r}"} for r in rows[:3]]
        leads.append({'work': 'local study', 'snippet': f'Local-work check (2026-11-01): {note}'})
        pid, kinds = existing(ref)
        vs.append({'ref': ref, 'existing_passage': pid, 'existing_kinds': kinds, 'candidates': [{'kind': kind, 'target': 'wordplay', 'writers': [], 'leads': leads}]})
    out.append({'key': f'lw28-{key}', 'verses': vs})
json.dump(out, open(f'{W}/lw28/lw28lay.json', 'w'), ensure_ascii=False, indent=1)
for b in out:
    print(b['key'], [(v['ref'], v['existing_passage'], len(v['candidates'][0]['leads'])) for v in b['verses']])
