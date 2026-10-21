import json
T = {
"genesis-33-20": "Some see the name answering Jacob's vow at Bethel, where he said that if God brought him home safely, \"then the LORD will be my God\" (28:21). Back in the land, he names his altar for God as the God of Israel.",
"exodus-32-18": "Moses answers with three nearly identical Hebrew words: anot, anot and annot. It is not the sound of the strong shouting, nor of the weak crying out, but of singing. Some hear a play like the English strike, stricken and strike up, the sound staying the same while the meaning turns from battle to song.",
"deuteronomy-6-3": "Some see a play on sound here: in Hebrew, hear (shamata) and be careful (shamarta) differ by a single letter. The pairing could be put in English as hear and heed: truly listening to God's word means keeping it.",
"deuteronomy-30-3": "Where the verse says He will restore you from captivity, the Hebrew pairs the verb shav (turn back) with the noun shevut (captivity). Some hear in the like sound a promise that rings with return. The same sound pair comes back wherever God promises to restore His people.",
"judges-10-4": "Some see a play on sound here. Jair's thirty sons rode on thirty donkeys (ayarim) and had thirty towns, also written ayarim. The usual word for towns is arim, but here it may take a form chosen to match the word for donkeys.",
"2-samuel-22-42": "In Hebrew, they looked is yishu and one to save is moshia. The two words sound alike, a little like English crave and save, and some hear the very sound tying the enemies' desperate looking to the rescue that never came.",
"job-37-24": "Some hear two Hebrew words echoing each other here: people fear Him (yere'uhu), but He does not regard (yir'eh, literally see) the wise in heart. The likeness in sound may set human awe of God against God's refusal to be impressed by human wisdom.",
"psalm-18-41": "Some hear an echo here: in Hebrew, they cried for help (yeshavveu) and save (moshia) are similar-sounding words, setting their desperate cry beside the rescuer who never came.",
"psalm-69-30": "Some see a play on two sound-alike Hebrew words here: shir, a song, and shor, an ox. The psalmist will praise God with a shir (verse 30), and that will please the LORD more than a shor (verse 31). A heartfelt song outweighs a costly sacrifice.",
"psalm-119-13": "Some see a play on sound here: in Hebrew, with my lips (bisfatai) and I proclaim (sipparti) sound alike, since both carry the sounds s, p (or f) and t. The two words stand side by side at the start of the line.",
"proverbs-13-20": "In Hebrew, the companion is ro'eh and will be destroyed is yeroa'. Some see a play on the like sound that ties the two together: the one who keeps company with fools is the one who comes to harm.",
"ecclesiastes-7-20": "Paul begins his chain of Scriptures about sin in Romans 3:10 with \"There is no one righteous, not even one.\" Some see his words drawing on this verse together with Psalms 14 and 53, to show that every person is a sinner before God.",
"song-of-solomon-8-1": "Some hear a play on words here: in Hebrew, \"I would kiss you\" (eshaqeka) in verse 1 is echoed in verse 2 by \"I would give you spiced wine to drink\" (ashqeka). The two verbs sound almost alike, so her kiss and the wine she offers him may be tied together by sound.",
"job-3-4": "Some see Job's wish turning God's first creative word upside down. On the first day God said, \"Let there be light\" (yehi or). Job uses the same Hebrew word, yehi, but asks for the opposite: yehi choshekh, let there be darkness, for the day he was born.",
}
notes = {n['passage']: n for n in json.load(open('/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp/recal_ot1.json'))[1]}
import re
for k, t in T.items():
    old = notes[k]['note']['text']
    quotes = re.findall(r'"([^"]+)"', old)
    ok = all(q in t for q in quotes if len(q.split()) >= 4)
    print(k, len(t), 'quotes ok' if ok else 'QUOTE MISMATCH', quotes)
