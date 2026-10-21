#!/usr/bin/env python3
"""Minor-prophets candidates (Hosea-Malachi): build + check against the verse data."""
import json, re, sys, unicodedata
W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
D = W + '/mp_data'
meta = json.load(open(f'{D}/meta.json'))
lem = json.load(open(f'{D}/lemmas.json'))
covered = json.load(open(f'{W}/covered.json'))
byname = {b['name']: b for b in meta['books']}
cache = {}

def verse(ref):
    m = re.match(r'^(.+?) (\d+):(\d+)$', ref)
    b = byname[m.group(1)]
    if b['osis'] not in cache:
        cache[b['osis']] = json.load(open(f"{D}/text/{b['osis']}.json"))
    return cache[b['osis']]['chapters'][int(m.group(2)) - 1][int(m.group(3)) - 1]

def clean(s):
    s = ''.join(ch for ch in s if not (0x0591 <= ord(ch) <= 0x05AF) and ch not in '׀׃ֽ')
    s = re.sub(r'\s+[פס]\s*$', '', s.strip())
    return s.strip()

OUT = []
def E(ref, kind, sure, what, sources, words, target=None):
    ws = []
    for w in words:
        wref, key = w[0], w[1]
        n = w[2] if len(w) > 2 else 0
        toks = verse(wref)[1]
        groups, prev = [], -2
        for i, x in enumerate(toks):
            if lem['key'][x[3]] == key:
                if i == prev + 1:
                    groups[-1].append(x)
                else:
                    groups.append([x])
                prev = i
        if len(groups) <= n:
            sys.exit(f'!! {ref}: {key} not in {wref}')
        g = groups[n]
        word, tr = clean(g[0][0]), g[0][1]
        for x in g[1:]:
            word += ('' if word.endswith('־') else ' ') + clean(x[0])
            tr += ('' if tr.endswith('-') else ' ') + x[1]
        ws.append({'ref': wref, 'strong': key, 'word': word, 'translit': tr})
    src = []
    for s in sources:
        d = {'source': s[0], 'on': s[1]}
        if len(s) > 2:
            d['at'] = s[2]
        src.append(d)
    c = {'ref': ref, 'kind': kind, 'what': what, 'sources': src, 'sure': sure, 'words': ws}
    if target:
        c['target'] = target
    if kind in covered.get(ref, []):
        sys.exit(f'!! {ref} already has {kind}')
    OUT.append(c)

K, G, H, J, P, C, CL = 'keil-delitzsch', 'gill', 'henry', 'jfb', 'pulpit', 'church-fathers', 'clarke'
A, N, WP = 'allusion', 'name meaning', 'wordplay'

# ---------------- HOSEA ----------------
E('Hosea 1:4', N, 'high', "God has Hosea name his son Jezreel ('God sows' or 'God scatters') because the blood shed at Jezreel is about to be punished, and the name sounds almost like Israel (Yizre'el / Yisra'el).",
  [(H, 'Hosea 1:4'), (G, 'Hosea 1:4'), (K, 'Hosea 1:4')], [('Hosea 1:4', 'H3157K'), ('Hosea 1:4', 'H3478')])
E('Hosea 1:4', A, 'high', "'The bloodshed of Jezreel' recalls Jehu's slaughter of Ahab's house at Jezreel (2 Kings 9:24-10:11), which God now holds against Jehu's own line.",
  [(K, 'Hosea 1:4'), (G, 'Hosea 1:4'), (H, 'Hosea 1:4')], [('Hosea 1:4', 'H1818'), ('Hosea 1:4', 'H3157K', 1), ('Hosea 1:4', 'H3058H')], '2 Kings 10:11')
E('Hosea 1:6', N, 'high', "The daughter is named Lo-ruhamah, 'not shown compassion', and God explains the name at once: 'I will no longer have compassion on the house of Israel.'",
  [(K, 'Hosea 1:6'), (G, 'Hosea 1:6'), (H, 'Hosea 1:6')], [('Hosea 1:6', 'H3819'), ('Hosea 1:6', 'H7355')])
E('Hosea 1:9', N, 'high', "The third child is named Lo-ammi, 'not my people', and the name is explained in the same breath: 'you are not My people, and I am not your God.'",
  [(K, 'Hosea 1:9'), (G, 'Hosea 1:9'), (H, 'Hosea 1:9')], [('Hosea 1:9', 'H3818'), ('Hosea 1:9', 'H5971A')])
E('Hosea 1:10', A, 'high', "'Like the sand of the sea, which cannot be measured or counted' repeats God's promise to Abraham and Jacob (Genesis 22:17; 32:12), so the sentence of 'not my people' does not cancel the promise.",
  [(K, 'Hosea 1:10'), (G, 'Hosea 1:10')], [('Hosea 1:10', 'H2344'), ('Hosea 1:10', 'H3220G'), ('Hosea 1:10', 'H5608A')], 'Genesis 22:17')
E('Hosea 1:11', WP, 'high', "'Great will be the day of Jezreel' turns the name to its good sense, 'God sows': the scattered people will be sown again in their land (see 2:22-23).",
  [(K, 'Hosea 1:11'), (G, 'Hosea 1:11')], [('Hosea 1:11', 'H3157H')])
E('Hosea 1:11', A, 'medium', "'They will go up from the land' borrows the phrase of Exodus 1:10, picturing the gathering of Judah and Israel under one head as a new exodus.",
  [(K, 'Hosea 1:11')], [('Hosea 1:11', 'H5927G'), ('Hosea 1:11', 'H0776G')], 'Exodus 1:10')
E('Hosea 2:1', N, 'high', "The children's names are reversed: Lo-ammi becomes Ammi ('my people') and Lo-ruhamah becomes Ruhamah ('shown compassion').",
  [(K, 'Hosea 2:1'), (G, 'Hosea 2:1'), (H, 'Hosea 2:1')], [('Hosea 2:1', 'H5971A'), ('Hosea 2:1', 'H7355')])
E('Hosea 2:15', N, 'high', "The Valley of Achor ('trouble') becomes a 'door of hope': the place named for Achan's trouble becomes the entrance to blessing.",
  [(K, 'Hosea 2:15'), (G, 'Hosea 2:15'), (H, 'Hosea 2:15'), (J, 'Hosea 2:15')], [('Hosea 2:15', 'H5911'), ('Hosea 2:15', 'H6607'), ('Hosea 2:15', 'H8615B')])
E('Hosea 2:15', A, 'high', "The Valley of Achor recalls where Achan was stoned when Israel first entered Canaan (Joshua 7:24-26), and 'as in the day she came up out of Egypt' recalls the exodus: God will begin again as He began then.",
  [(K, 'Hosea 2:15'), (G, 'Hosea 2:15'), (H, 'Hosea 2:15')], [('Hosea 2:15', 'H5911'), ('Hosea 2:15', 'H4714G')], 'Joshua 7:26')
E('Hosea 2:16', WP, 'high', "Israel will call God 'Ishi' (my husband) and no longer 'Baali' (my master), because ba'al, the ordinary word for husband or lord, was also the name of the idol Baal.",
  [(K, 'Hosea 2:16'), (G, 'Hosea 2:16'), (H, 'Hosea 2:16'), (CL, 'Hosea 2:16'), (J, 'Hosea 2:16')], [('Hosea 2:16', 'H0376H'), ('Hosea 2:16', 'H1180')])
E('Hosea 2:17', A, 'high', "Removing 'the names of the Baals' from her mouth so they are remembered no more echoes the law, 'make no mention of the names of other gods' (Exodus 23:13).",
  [(G, 'Hosea 2:17'), (J, 'Hosea 2:17')], [('Hosea 2:17', 'H8034'), ('Hosea 2:17', 'H1168A'), ('Hosea 2:17', 'H2142')], 'Exodus 23:13')
E('Hosea 2:22', WP, 'high', "The chain of answers ends with grain, wine and oil answering 'Jezreel', whose name means 'God sows', leading straight into 'I will sow her for Myself' (2:23).",
  [(K, 'Hosea 2:22'), (G, 'Hosea 2:22')], [('Hosea 2:22', 'H3157H'), ('Hosea 2:22', 'H6030B')])
E('Hosea 4:15', WP, 'high', "Hosea calls Bethel ('house of God') Beth-aven ('house of wickedness' or 'of nothing'), renaming the shrine for what the golden calf had made it.",
  [(K, 'Hosea 4:15'), (G, 'Hosea 4:15'), (H, 'Hosea 4:15'), (J, 'Hosea 4:15')], [('Hosea 4:15', 'H1007')])
E('Hosea 5:10', A, 'high', "Judah's princes are 'like those who move boundary stones', the act forbidden and cursed in the law (Deuteronomy 19:14; 27:17).",
  [(K, 'Hosea 5:10'), (G, 'Hosea 5:10'), (J, 'Hosea 5:10')], [('Hosea 5:10', 'H5253'), ('Hosea 5:10', 'H1366G')], 'Deuteronomy 19:14')
E('Hosea 5:13', N, 'high', "Ephraim sent to 'King Jareb', a name meaning 'he will contend' (the quarrelsome king), a fitting title for the Assyrian who could not heal them.",
  [(K, 'Hosea 5:13'), (G, 'Hosea 5:13'), (CL, 'Hosea 5:13')], [('Hosea 5:13', 'H3377'), ('Hosea 5:13', 'H4428G')])
E('Hosea 6:7', A, 'high', "'Like Adam they have transgressed the covenant' recalls Adam breaking God's command in the garden (Genesis 2:16-17; 3:6).",
  [(K, 'Hosea 6:7'), (G, 'Hosea 6:7'), (H, 'Hosea 6:7')], [('Hosea 6:7', 'H0121G'), ('Hosea 6:7', 'H5674D'), ('Hosea 6:7', 'H1285')], 'Genesis 3:6')
E('Hosea 8:1', A, 'medium', "The eagle swooping on the LORD's house recalls the covenant curse of a nation coming 'as swift as the eagle flies' (Deuteronomy 28:49).",
  [(K, 'Hosea 8:1'), (J, 'Hosea 8:1')], [('Hosea 8:1', 'H5404'), ('Hosea 8:1', 'H1285')], 'Deuteronomy 28:49')
E('Hosea 8:7', WP, 'high', "The stalk has no growth (tsemach) and so yields no flour (qemach), a rhyme that makes the empty harvest ring, after 'they sow the wind and reap the whirlwind'.",
  [(K, 'Hosea 8:7'), (P, 'Hosea 8:7')], [('Hosea 8:7', 'H6780'), ('Hosea 8:7', 'H7058')])
E('Hosea 8:9', WP, 'medium', "Israel went up to Assyria like 'a wild donkey (pere) alone', a word that echoes the name Ephraim, the tribe that should have been fruitful.",
  [(K, 'Hosea 8:9'), (P, 'Hosea 8:9')], [('Hosea 8:9', 'H6501'), ('Hosea 8:9', 'H0669G')])
E('Hosea 8:13', A, 'high', "'They will return to Egypt' takes up the last covenant curse, that the LORD would bring them back to Egypt (Deuteronomy 28:68).",
  [(K, 'Hosea 8:13'), (G, 'Hosea 8:13')], [('Hosea 8:13', 'H4714G'), ('Hosea 8:13', 'H7725G')], 'Deuteronomy 28:68')
E('Hosea 9:9', A, 'high', "'As in the days of Gibeah' recalls the outrage at Gibeah in Judges 19-20, Israel's byword for the depth of corruption.",
  [(K, 'Hosea 9:9'), (G, 'Hosea 9:9'), (H, 'Hosea 9:9'), (J, 'Hosea 9:9')], [('Hosea 9:9', 'H1390H'), ('Hosea 9:9', 'H7843')], 'Judges 19:22')
E('Hosea 9:10', A, 'high', "Israel 'went to Baal-peor', recalling the sin with the Moabite women and their god (Numbers 25:1-3), just after God had found them like grapes in the wilderness.",
  [(K, 'Hosea 9:10'), (G, 'Hosea 9:10'), (H, 'Hosea 9:10')], [('Hosea 9:10', 'H1187'), ('Hosea 9:10', 'H5144A')], 'Numbers 25:3')
E('Hosea 9:10', WP, 'high', "They consecrated themselves 'to Shame' (bosheth), the scornful name put in place of Baal (as in Jeremiah 3:24 and Ish-bosheth for Esh-baal).",
  [(K, 'Hosea 9:10'), (G, 'Hosea 9:10')], [('Hosea 9:10', 'H1322'), ('Hosea 9:10', 'H1187')])
E('Hosea 9:15', WP, 'high', "'All their princes (sarehem) are rebels (sorerim)', a sound play also used in Isaiah 1:23.",
  [(K, 'Hosea 9:15'), (P, 'Hosea 9:15')], [('Hosea 9:15', 'H8269'), ('Hosea 9:15', 'H5637')])
E('Hosea 9:16', WP, 'high', "Ephraim, whose name means 'fruitful' (Genesis 41:52), is struck so that it 'cannot bear fruit (peri)'.",
  [(J, 'Hosea 9:16'), (G, 'Hosea 9:16'), (K, 'Hosea 9:16')], [('Hosea 9:16', 'H0669G'), ('Hosea 9:16', 'H6529')])
E('Hosea 10:5', WP, 'high', "The calf of Bethel is mocked as 'the calf of Beth-aven', the 'house of wickedness', whose priests mourn the 'glory' that has gone into exile.",
  [(G, 'Hosea 10:5'), (K, 'Hosea 10:5')], [('Hosea 10:5', 'H1007'), ('Hosea 10:5', 'H3519')])
E('Hosea 10:9', A, 'high', "'Since the days of Gibeah you have sinned' and 'the battle at Gibeah' recall the crime at Gibeah and the war against Benjamin that followed (Judges 19-20).",
  [(K, 'Hosea 10:9'), (G, 'Hosea 10:9')], [('Hosea 10:9', 'H1390H'), ('Hosea 10:9', 'H4421')], 'Judges 20:4')
E('Hosea 10:12', WP, 'medium', "The verb yoreh means 'rain' and also 'teach', so 'until He comes and rains righteousness on you' can be heard as 'teaches you righteousness'.",
  [(G, 'Hosea 10:12'), (K, 'Hosea 10:12')], [('Hosea 10:12', 'H3384A'), ('Hosea 10:12', 'H6664G')])
E('Hosea 11:1', A, 'high', "'Out of Egypt I called My son' recalls God's word to Pharaoh, 'Israel is My son, My firstborn... let My son go' (Exodus 4:22-23).",
  [(K, 'Hosea 11:1'), (G, 'Hosea 11:1'), (H, 'Hosea 11:1')], [('Hosea 11:1', 'H4714G'), ('Hosea 11:1', 'H1121A'), ('Hosea 11:1', 'H7121G')], 'Exodus 4:22')
E('Hosea 11:8', A, 'high', "Admah and Zeboiim were overthrown with Sodom and Gomorrah (Genesis 19; Deuteronomy 29:23), so God asks how He could destroy Israel as utterly as them.",
  [(K, 'Hosea 11:8'), (G, 'Hosea 11:8'), (H, 'Hosea 11:8')], [('Hosea 11:8', 'H0126'), ('Hosea 11:8', 'H6636')], 'Deuteronomy 29:23')
E('Hosea 12:3', A, 'high', "Hosea recalls Jacob grasping Esau's heel in the womb (Genesis 25:26) and wrestling with God at Peniel (Genesis 32:24-28) to shame his descendants.",
  [(K, 'Hosea 12:3'), (G, 'Hosea 12:3'), (H, 'Hosea 12:3'), (J, 'Hosea 12:3')], [('Hosea 12:3', 'H6117'), ('Hosea 12:3', 'H8280')], 'Genesis 25:26')
E('Hosea 12:3', N, 'high', "The verbs play on both of Jacob's names: 'he took by the heel' ('aqav) echoes Ya'aqov (Jacob), and 'he strove' (sarah) echoes Yisra'el (Israel).",
  [(K, 'Hosea 12:3'), (J, 'Hosea 12:3'), (G, 'Hosea 12:3')], [('Hosea 12:3', 'H6117'), ('Hosea 12:3', 'H8280'), ('Hosea 12:4', 'H7786')])
E('Hosea 12:4', A, 'high', "He 'wept and sought His favor' recalls Jacob's 'I will not let you go unless you bless me' (Genesis 32:26), and 'he found Him at Bethel' recalls Genesis 28:11-19 and 35:9-15.",
  [(K, 'Hosea 12:4'), (G, 'Hosea 12:4')], [('Hosea 12:4', 'H1058'), ('Hosea 12:4', 'H2603A'), ('Hosea 12:4', 'H1008G')], 'Genesis 32:26')
E('Hosea 12:5', A, 'high', "'The LORD is His name of renown' (zikhro, His memorial) echoes Exodus 3:15, 'This is My name forever, and this is My memorial to all generations.'",
  [(K, 'Hosea 12:5'), (G, 'Hosea 12:5')], [('Hosea 12:5', 'H2143')], 'Exodus 3:15')
E('Hosea 12:8', WP, 'medium', "Ephraim boasts he has found wealth (on) and that no one will find in him iniquity (avon), two words that sound alike.",
  [(K, 'Hosea 12:8'), (P, 'Hosea 12:8')], [('Hosea 12:8', 'H0202'), ('Hosea 12:8', 'H5771G')])
E('Hosea 12:9', A, 'high', "'I will again make you dwell in tents, as in the days of the appointed feast' recalls the Feast of Booths, kept in memory of the wilderness tents (Leviticus 23:42-43).",
  [(K, 'Hosea 12:9'), (G, 'Hosea 12:9')], [('Hosea 12:9', 'H0168G'), ('Hosea 12:9', 'H4150H')], 'Leviticus 23:42')
E('Hosea 12:11', WP, 'high', "Gilead and Gilgal are answered by gallim, 'heaps of stones': their altars will become rubble heaps that sound like the names of the places.",
  [(K, 'Hosea 12:11'), (J, 'Hosea 12:11'), (P, 'Hosea 12:11')], [('Hosea 12:11', 'H1568G'), ('Hosea 12:11', 'H1537G'), ('Hosea 12:11', 'H1530G')])
E('Hosea 12:12', A, 'high', "Jacob fled to the land of Aram and served for a wife, keeping sheep for her (Genesis 28:5; 29:18-20).",
  [(K, 'Hosea 12:12'), (G, 'Hosea 12:12'), (H, 'Hosea 12:12')], [('Hosea 12:12', 'H1272'), ('Hosea 12:12', 'H5647G'), ('Hosea 12:12', 'H8104H')], 'Genesis 29:20')
E('Hosea 12:13', A, 'high', "'By a prophet the LORD brought Israel out of Egypt' points to Moses (Deuteronomy 18:15; 34:10).",
  [(K, 'Hosea 12:13'), (G, 'Hosea 12:13')], [('Hosea 12:13', 'H5030'), ('Hosea 12:13', 'H4714G')], 'Deuteronomy 18:15')
E('Hosea 12:13', WP, 'medium', "The verb shamar is used twice over: Jacob 'kept' sheep for a wife (12:12), but Israel was 'kept' by a prophet (12:13).",
  [(K, 'Hosea 12:13')], [('Hosea 12:12', 'H8104H'), ('Hosea 12:13', 'H8104H')])
E('Hosea 13:4', A, 'high', "'I am the LORD your God ever since the land of Egypt; you know no God but Me' echoes the opening of the Ten Commandments (Exodus 20:2-3).",
  [(K, 'Hosea 13:4'), (G, 'Hosea 13:4')], [('Hosea 13:4', 'H4714G'), ('Hosea 13:4', 'H0430J')], 'Exodus 20:2')
E('Hosea 13:6', A, 'high', "'They became satisfied... their hearts became proud... they forgot Me' follows Moses' warning step by step (Deuteronomy 8:12-14; 32:15).",
  [(K, 'Hosea 13:6'), (G, 'Hosea 13:6')], [('Hosea 13:6', 'H7646'), ('Hosea 13:6', 'H7311A'), ('Hosea 13:6', 'H7911')], 'Deuteronomy 8:12')
E('Hosea 13:15', WP, 'high', "'Though he flourishes (yafri) among his brothers' plays on Ephraim, 'doubly fruitful', just before the east wind dries his spring.",
  [(K, 'Hosea 13:15'), (G, 'Hosea 13:15')], [('Hosea 13:15', 'H6500')])
E('Hosea 14:3', N, 'medium', "'In You the fatherless finds compassion (yeruham)' undoes the name Lo-ruhamah, 'not shown compassion' (1:6).",
  [(J, 'Hosea 14:3'), (P, 'Hosea 14:3')], [('Hosea 14:3', 'H7355'), ('Hosea 14:3', 'H3490')])
E('Hosea 14:8', WP, 'medium', "'Your fruit (peri) comes from Me' plays once more on Ephraim, 'fruitful': its fruitfulness comes from God, not from idols.",
  [(P, 'Hosea 14:8'), (J, 'Hosea 14:8')], [('Hosea 14:8', 'H0669G'), ('Hosea 14:8', 'H6529')])

# ---------------- JOEL ----------------
E('Joel 1:10', WP, 'high', "'The field is ruined' is shuddad sadeh, two words of nearly the same sound.",
  [(K, 'Joel 1:10'), (P, 'Joel 1:10')], [('Joel 1:10', 'H7703'), ('Joel 1:10', 'H7704G')])
E('Joel 1:12', WP, 'medium', "Hovish is used so that it can mean both 'dried up' and 'put to shame': the vine is dried up, and the joy of mankind has withered away in shame (see 1:10-11).",
  [(K, 'Joel 1:12')], [('Joel 1:12', 'H0954'), ('Joel 1:12', 'H3001'), ('Joel 1:12', 'H8342')])
E('Joel 1:15', WP, 'high', "The day comes 'as destruction (shod) from the Almighty (Shaddai)', a play on God's name repeated in Isaiah 13:6.",
  [(K, 'Joel 1:15'), (P, 'Joel 1:15'), ('bullinger', 'Joel 1:15', 'E. W. Bullinger, Figures of Speech Used in the Bible (1898), Paronomasia')], [('Joel 1:15', 'H7701'), ('Joel 1:15', 'H7706')])
E('Joel 2:3', A, 'high', "The land before the locust army is 'like the Garden of Eden' and behind it a desolate wilderness: the plague undoes paradise.",
  [(K, 'Joel 2:3'), (G, 'Joel 2:3')], [('Joel 2:3', 'H1588M'), ('Joel 2:3', 'H5731B')], 'Genesis 2:8')
E('Joel 2:13', A, 'high', "'Gracious and compassionate, slow to anger, abounding in loving devotion' is God's own description of Himself to Moses (Exodus 34:6-7).",
  [(K, 'Joel 2:13'), (G, 'Joel 2:13')], [('Joel 2:13', 'H2587'), ('Joel 2:13', 'H7349'), ('Joel 2:13', 'H0750'), ('Joel 2:13', 'H2617A')], 'Exodus 34:6')
E('Joel 2:21', WP, 'medium', "The northern invader 'has done great things' (higdil la'asot, 2:20) in its pride, and now 'the LORD has done great things' in the very same words, outdoing the enemy.",
  [(K, 'Joel 2:21')], [('Joel 2:20', 'H1431'), ('Joel 2:21', 'H1431')])
E('Joel 2:23', WP, 'high', "Moreh means both 'early rain' and 'teacher', so 'He has given you the autumn rain for righteousness' was also read 'the Teacher of righteousness'.",
  [(K, 'Joel 2:23'), (G, 'Joel 2:23')], [('Joel 2:23', 'H4175'), ('Joel 2:23', 'H6666')])
E('Joel 2:28', A, 'medium', "God's promise to pour out His Spirit on all flesh, so that sons and daughters prophesy, answers Moses' wish, 'Would that all the LORD's people were prophets, that the LORD would put His Spirit on them!' (Numbers 11:29).",
  [(H, 'Joel 2:28'), (G, 'Joel 2:28')], [('Joel 2:28', 'H7307G'), ('Joel 2:28', 'H5012')], 'Numbers 11:29')
E('Joel 2:32', A, 'high', "'On Mount Zion and in Jerusalem there will be deliverance, as the LORD has said' cites Obadiah's promise word for word (Obadiah 17).",
  [(K, 'Joel 2:32')], [('Joel 2:32', 'H6413'), ('Joel 2:32', 'H2022G'), ('Joel 2:32', 'H6726')], 'Obadiah 1:17')
E('Joel 3:2', N, 'high', "The 'Valley of Jehoshaphat' means 'the LORD judges', and God says, 'There I will enter into judgment (nishpatti) with them.'",
  [(K, 'Joel 3:2'), (G, 'Joel 3:2'), (H, 'Joel 3:2'), (J, 'Joel 3:2')], [('Joel 3:2', 'H3092K'), ('Joel 3:2', 'H8199')])
E('Joel 3:10', A, 'medium', "'Beat your plowshares into swords and your pruning hooks into spears' is the exact reverse of the peace picture in Isaiah 2:4 and Micah 4:3.",
  [(G, 'Joel 3:10'), (H, 'Joel 3:10')], [('Joel 3:10', 'H0855'), ('Joel 3:10', 'H2719'), ('Joel 3:10', 'H4211')], 'Isaiah 2:4')
E('Joel 3:12', WP, 'high', "The nations come up to the Valley of Jehoshaphat ('the LORD judges'), 'for there I will sit to judge (lishpot)'.",
  [(K, 'Joel 3:12'), (J, 'Joel 3:12')], [('Joel 3:12', 'H3092K'), ('Joel 3:12', 'H8199')])
E('Joel 3:14', WP, 'medium', "The 'valley of decision' (charuts) uses a word that also means a threshing sledge (Isaiah 28:27; 41:15), fitting the harvest and winepress picture of 3:13.",
  [(K, 'Joel 3:14'), (G, 'Joel 3:14')], [('Joel 3:14', 'H2742B')])
E('Joel 3:18', N, 'medium', "The spring from God's house waters 'the Valley of Shittim', the 'Valley of Acacias', a dry valley where only acacias grow, so even the barren places will be watered.",
  [(K, 'Joel 3:18'), (G, 'Joel 3:18')], [('Joel 3:18', 'H7851H'), ('Joel 3:18', 'H4599')])

# ---------------- AMOS ----------------
E('Amos 1:2', A, 'high', "Amos opens with Joel's words, 'The LORD roars from Zion and raises His voice from Jerusalem' (Joel 3:16), taking up where Joel left off.",
  [(K, 'Amos 1:2'), (G, 'Amos 1:2')], [('Amos 1:2', 'H7580'), ('Amos 1:2', 'H6726'), ('Amos 1:2', 'H6963A')], 'Joel 3:16')
E('Amos 1:5', N, 'medium', "Damascus' realm is named by two places, the 'Valley of Aven' (wickedness, or idols) and Beth-eden ('house of pleasure'), whose pleasures will end in exile.",
  [(G, 'Amos 1:5'), (K, 'Amos 1:5')], [('Amos 1:5', 'H0206G'), ('Amos 1:5', 'H1040')])
E('Amos 1:9', A, 'high', "Tyre broke 'a covenant of brotherhood', recalling the treaty of Hiram and Solomon, who called each other brother (1 Kings 5:12; 9:13).",
  [(K, 'Amos 1:9'), (G, 'Amos 1:9'), (H, 'Amos 1:9')], [('Amos 1:9', 'H1285'), ('Amos 1:9', 'H0251I')], '1 Kings 5:12')
E('Amos 1:11', A, 'high', "Edom 'pursued his brother with the sword', the old enmity of Esau toward Jacob (Genesis 27:40-41; Numbers 20:14-21).",
  [(K, 'Amos 1:11'), (G, 'Amos 1:11'), (H, 'Amos 1:11')], [('Amos 1:11', 'H7291'), ('Amos 1:11', 'H2719'), ('Amos 1:11', 'H0251G')], 'Genesis 27:41')
E('Amos 2:8', A, 'high', "Lying down on 'garments taken in pledge' breaks the law that a poor man's cloak must be returned by sundown (Exodus 22:26-27; Deuteronomy 24:12-13).",
  [(K, 'Amos 2:8'), (G, 'Amos 2:8')], [('Amos 2:8', 'H0899B'), ('Amos 2:8', 'H2254A')], 'Exodus 22:26')
E('Amos 2:9', A, 'high', "The Amorite 'whose height was like the cedars' recalls the spies' report of giants in the land (Numbers 13:32-33; Deuteronomy 1:28).",
  [(K, 'Amos 2:9'), (G, 'Amos 2:9')], [('Amos 2:9', 'H0567'), ('Amos 2:9', 'H1363'), ('Amos 2:9', 'H0730')], 'Numbers 13:33')
E('Amos 2:12', A, 'high', "Making the Nazirites drink wine attacks the vow of Numbers 6:2-3, which forbade them wine.",
  [(K, 'Amos 2:12'), (G, 'Amos 2:12')], [('Amos 2:12', 'H5139'), ('Amos 2:12', 'H3196')], 'Numbers 6:3')
E('Amos 3:2', A, 'medium', "'Of all the families of the earth' is the phrase of God's promise to Abraham (Genesis 12:3; 28:14), turned here to judgment: chosen, and therefore punished.",
  [(K, 'Amos 3:2')], [('Amos 3:2', 'H4940'), ('Amos 3:2', 'H0127I')], 'Genesis 12:3')
E('Amos 3:12', A, 'high', "A shepherd rescuing 'two legs or a piece of an ear' from the lion follows the law that a shepherd bring the remains to prove the animal was torn (Exodus 22:13): the rescue only proves the loss.",
  [(K, 'Amos 3:12'), (P, 'Amos 3:12')], [('Amos 3:12', 'H7462B'), ('Amos 3:12', 'H0738A'), ('Amos 3:12', 'H3767'), ('Amos 3:12', 'H0241G')], 'Exodus 22:13')
E('Amos 4:9', A, 'high', "'Blight and mildew' (shiddafon, yeraqon) are named among the covenant curses (Deuteronomy 28:22; 1 Kings 8:37).",
  [(K, 'Amos 4:9'), (G, 'Amos 4:9')], [('Amos 4:9', 'H7711B'), ('Amos 4:9', 'H3420')], 'Deuteronomy 28:22')
E('Amos 4:10', A, 'high', "Plagues 'like those of Egypt' are the covenant curse of Deuteronomy 28:27 and 60: the diseases of Egypt brought upon Israel.",
  [(K, 'Amos 4:10'), (G, 'Amos 4:10')], [('Amos 4:10', 'H1698'), ('Amos 4:10', 'H4714G')], 'Deuteronomy 28:60')
E('Amos 4:11', A, 'high', "'As God overthrew Sodom and Gomorrah' recalls Genesis 19:24-25 in the words of Deuteronomy 29:23, and the 'firebrand snatched from the blaze' is taken up again in Zechariah 3:2.",
  [(K, 'Amos 4:11'), (G, 'Amos 4:11')], [('Amos 4:11', 'H4114'), ('Amos 4:11', 'H5467'), ('Amos 4:11', 'H6017'), ('Amos 4:11', 'H0181')], 'Genesis 19:25')
E('Amos 5:8', A, 'high', "'He who made the Pleiades and Orion' echoes Job 9:9 and 38:31, naming the Creator by the stars.",
  [(G, 'Amos 5:8'), (K, 'Amos 5:8')], [('Amos 5:8', 'H3598'), ('Amos 5:8', 'H3685G')], 'Job 9:9')
E('Amos 5:11', A, 'high', "Building stone houses but never living in them and planting vineyards but never drinking their wine is the futility curse of Deuteronomy 28:30, 39.",
  [(K, 'Amos 5:11'), (G, 'Amos 5:11')], [('Amos 5:11', 'H1129'), ('Amos 5:11', 'H5193'), ('Amos 5:11', 'H3754')], 'Deuteronomy 28:30')
E('Amos 6:7', WP, 'high', "Those who were 'first' (reshit) of the nations (6:1) and anointed themselves with the 'first' oils (6:6) will go into exile 'at the head' (rosh) of the captives, and the revelry (mirzach) of the loungers (seruchim) will pass away (sar).",
  [(K, 'Amos 6:7'), (G, 'Amos 6:7')], [('Amos 6:1', 'H7225G'), ('Amos 6:6', 'H7225H'), ('Amos 6:7', 'H7218J'), ('Amos 6:7', 'H5493G'), ('Amos 6:7', 'H4797'), ('Amos 6:7', 'H5628')])
E('Amos 6:13', N, 'medium', "They rejoice in Lo-debar, a town whose name means 'nothing', and boast of taking Karnaim, 'horns' (a picture of strength): their victory is a nothing and their strength a boast.",
  [(K, 'Amos 6:13'), (G, 'Amos 6:13')], [('Amos 6:13', 'H3810'), ('Amos 6:13', 'H7161B')])
E('Amos 8:5', A, 'high', "Making the ephah small and the shekel great with dishonest scales breaks the law of honest weights and measures (Leviticus 19:35-36; Deuteronomy 25:13-15).",
  [(K, 'Amos 8:5'), (G, 'Amos 8:5')], [('Amos 8:5', 'H0374'), ('Amos 8:5', 'H8255'), ('Amos 8:5', 'H3976')], 'Deuteronomy 25:13')
E('Amos 9:2', A, 'medium', "Digging down to Sheol or climbing up to heaven and finding God there recalls David's 'If I ascend to heaven, You are there; if I make my bed in Sheol, You are there' (Psalm 139:7-10).",
  [(G, 'Amos 9:2'), (P, 'Amos 9:2')], [('Amos 9:2', 'H7585'), ('Amos 9:2', 'H8064')], 'Psalm 139:8')
E('Amos 9:11', A, 'high', "God will raise up the fallen 'booth (sukkah) of David', the house He promised David (2 Samuel 7:11-16), now sunk so low it is called a hut.",
  [(K, 'Amos 9:11'), (G, 'Amos 9:11')], [('Amos 9:11', 'H5521'), ('Amos 9:11', 'H1732')], '2 Samuel 7:16')
E('Amos 9:13', A, 'high', "'The plowman will overtake the reaper' enlarges the blessing of Leviticus 26:5, and 'the mountains will drip with sweet wine' repeats Joel 3:18.",
  [(K, 'Amos 9:13')], [('Amos 9:13', 'H2790A'), ('Amos 9:13', 'H7114B'), ('Amos 9:13', 'H5197'), ('Amos 9:13', 'H6071')], 'Leviticus 26:5')

# ---------------- OBADIAH ----------------
E('Obadiah 1:3', WP, 'high', "Edom dwells 'in the clefts of the rock (sela)', a play on Sela, the rock city of Edom (2 Kings 14:7), later called Petra.",
  [(K, 'Obadiah 1:3'), (G, 'Obadiah 1:3'), (J, 'Obadiah 1:3')], [('Obadiah 1:3', 'H5553H')])
E('Obadiah 1:10', A, 'high', "'Violence against your brother Jacob' recalls that Edom is Esau, Jacob's twin, and his old hatred (Genesis 25:23-26; 27:41).",
  [(K, 'Obadiah 1:10'), (G, 'Obadiah 1:10'), (H, 'Obadiah 1:10')], [('Obadiah 1:10', 'H0251G'), ('Obadiah 1:10', 'H3290')], 'Genesis 27:41')
E('Obadiah 1:15', A, 'medium', "'As you have done, it will be done to you' is the law of like for like, 'as he has done, so it shall be done to him' (Leviticus 24:19).",
  [(G, 'Obadiah 1:15'), (P, 'Obadiah 1:15')], [('Obadiah 1:15', 'H6213A'), ('Obadiah 1:15', 'H1576')], 'Leviticus 24:19')
E('Obadiah 1:18', A, 'medium', "Jacob's house a fire and Esau's house stubble, with 'no survivor (sarid)' left to Esau, echoes Balaam's word that one out of Jacob would destroy the survivors (sarid) of Edom (Numbers 24:18-19).",
  [(K, 'Obadiah 1:18')], [('Obadiah 1:18', 'H8300'), ('Obadiah 1:18', 'H7179')], 'Numbers 24:19')
E('Obadiah 1:21', A, 'medium', "'Deliverers (moshi'im)' will go up to Mount Zion like the deliverers God raised up in the days of the judges (Judges 3:9, 15; Nehemiah 9:27), and the kingdom will be the LORD's (Psalm 22:28).",
  [(K, 'Obadiah 1:21')], [('Obadiah 1:21', 'H3467'), ('Obadiah 1:21', 'H4410')], 'Judges 3:9')

# ---------------- JONAH ----------------
E('Jonah 1:5', WP, 'medium', "Jonah keeps going 'down' (yarad), down to Joppa and down into the ship (1:3), down into the hold, and then he 'fell into a deep sleep' (wayyeradam), a word that sounds like one more going down.",
  [(P, 'Jonah 1:5')], [('Jonah 1:3', 'H3381'), ('Jonah 1:5', 'H3381'), ('Jonah 1:5', 'H7290')])
E('Jonah 1:9', A, 'medium', "Jonah confesses 'the God of heaven, who made the sea and the dry land (yabbashah)', the words of Genesis 1:9-10, while fleeing across that very sea.",
  [(G, 'Jonah 1:9')], [('Jonah 1:9', 'H3220G'), ('Jonah 1:9', 'H3004')], 'Genesis 1:10')
E('Jonah 2:2', A, 'high', "'In my distress I called to the LORD, and He answered me' is the opening of Psalm 120:1 (compare Psalm 18:6).",
  [(K, 'Jonah 2:2')], [('Jonah 2:2', 'H6869B'), ('Jonah 2:2', 'H7121G'), ('Jonah 2:2', 'H6030B')], 'Psalm 120:1')
E('Jonah 2:3', A, 'high', "'All Your breakers and waves swept over me' is word for word Psalm 42:7.",
  [(K, 'Jonah 2:3'), (G, 'Jonah 2:3')], [('Jonah 2:3', 'H4867'), ('Jonah 2:3', 'H1530H')], 'Psalm 42:7')
E('Jonah 2:4', A, 'high', "'I have been banished from Your sight' echoes David's 'I am cut off from before Your eyes' (Psalm 31:22).",
  [(K, 'Jonah 2:4')], [('Jonah 2:4', 'H1644G'), ('Jonah 2:4', 'H5869H')], 'Psalm 31:22')
E('Jonah 2:5', A, 'high', "'The waters engulfed me to the soul' echoes Psalm 69:1, 'the waters have come up to my neck (nefesh)'.",
  [(K, 'Jonah 2:5')], [('Jonah 2:5', 'H4325G'), ('Jonah 2:5', 'H5315H')], 'Psalm 69:1')
E('Jonah 2:6', A, 'medium', "'You raised my life from the pit' echoes Psalm 30:3, 'You brought my soul up from Sheol; You spared me from going down to the pit.'",
  [(K, 'Jonah 2:6')], [('Jonah 2:6', 'H5927H'), ('Jonah 2:6', 'H7845G')], 'Psalm 30:3')
E('Jonah 2:7', A, 'medium', "'As my life was fading away' uses the words of Psalm 142:3 and 143:4, and 'my prayer went up to Your holy temple' recalls Psalm 18:6.",
  [(K, 'Jonah 2:7')], [('Jonah 2:7', 'H5848C'), ('Jonah 2:7', 'H8605'), ('Jonah 2:7', 'H1964G')], 'Psalm 142:3')
E('Jonah 2:8', A, 'high', "'Those who cling to worthless idols (havle shav)' is the exact phrase of Psalm 31:6.",
  [(K, 'Jonah 2:8')], [('Jonah 2:8', 'H8104I'), ('Jonah 2:8', 'H1892'), ('Jonah 2:8', 'H7723H')], 'Psalm 31:6')
E('Jonah 2:9', A, 'high', "'Salvation is from the LORD' closes Jonah's prayer as it closes Psalm 3:8, with vows paid and thanks offered as in Psalm 50:14.",
  [(K, 'Jonah 2:9'), (G, 'Jonah 2:9')], [('Jonah 2:9', 'H3444'), ('Jonah 2:9', 'H5087'), ('Jonah 2:9', 'H8426')], 'Psalm 3:8')
E('Jonah 3:4', A, 'medium', "'Nineveh will be overturned (nehpakhet)' uses the verb of Sodom's overthrow (Genesis 19:25, 29), the fate Nineveh escaped by repenting.",
  [(G, 'Jonah 3:4'), (P, 'Jonah 3:4')], [('Jonah 3:4', 'H2015')], 'Genesis 19:25')
E('Jonah 3:9', A, 'high', "The king's 'Who knows? God may turn and relent' repeats Joel 2:14 word for word.",
  [(K, 'Jonah 3:9')], [('Jonah 3:9', 'H4310'), ('Jonah 3:9', 'H3045'), ('Jonah 3:9', 'H7725O'), ('Jonah 3:9', 'H5162H')], 'Joel 2:14')
E('Jonah 4:2', A, 'high', "Jonah quotes God's self-description from Exodus 34:6, ending 'who relents from disaster' as in Joel 2:13, and complains that God is exactly who He said He is.",
  [(K, 'Jonah 4:2'), (G, 'Jonah 4:2')], [('Jonah 4:2', 'H2587'), ('Jonah 4:2', 'H7349'), ('Jonah 4:2', 'H0750'), ('Jonah 4:2', 'H5162H')], 'Exodus 34:6')
E('Jonah 4:8', A, 'high', "Jonah 'asked that he might die' (wayyish'al et-nafsho lamut), the very words used of Elijah under the broom tree (1 Kings 19:4), and says like him 'it is better for me to die' (4:3).",
  [(K, 'Jonah 4:8'), (G, 'Jonah 4:8'), (P, 'Jonah 4:8')], [('Jonah 4:8', 'H7592'), ('Jonah 4:8', 'H5315I'), ('Jonah 4:8', 'H4191')], '1 Kings 19:4')

# ---------------- MICAH ----------------
E('Micah 1:11', WP, 'high', "The towns are mocked by their names: the people of Shaphir ('beautiful') go in shameful nakedness, Zaanan (sounds like 'come out') does not come out, and Beth-ezel ('house beside') loses its standing place.",
  [(K, 'Micah 1:11'), (J, 'Micah 1:11'), (P, 'Micah 1:11'), (H, 'Micah 1:11')], [('Micah 1:11', 'H8208'), ('Micah 1:11', 'H6181'), ('Micah 1:11', 'H6630'), ('Micah 1:11', 'H3318G'), ('Micah 1:11', 'H1018')])
E('Micah 1:12', WP, 'high', "The people of Maroth ('bitterness') wait anxiously for good, but bitter calamity comes down from the LORD.",
  [(K, 'Micah 1:12'), (J, 'Micah 1:12')], [('Micah 1:12', 'H4796'), ('Micah 1:12', 'H2896B'), ('Micah 1:12', 'H7451B')])
E('Micah 1:13', WP, 'high', "Lachish is told to harness the steed (rekesh), a word that rhymes with its name, for flight: it was the beginning of sin for the Daughter of Zion.",
  [(K, 'Micah 1:13'), (J, 'Micah 1:13'), (P, 'Micah 1:13')], [('Micah 1:13', 'H7409'), ('Micah 1:13', 'H3923')])
E('Micah 1:14', WP, 'high', "Moresheth-gath, which sounds like 'betrothed', is given parting gifts like a bride sent away, and the houses of Achzib become akhzav, 'a deceit', to Israel's kings.",
  [(K, 'Micah 1:14'), (J, 'Micah 1:14'), (P, 'Micah 1:14')], [('Micah 1:14', 'H7964'), ('Micah 1:14', 'H4182'), ('Micah 1:14', 'H0392G'), ('Micah 1:14', 'H0391')])
E('Micah 1:15', WP, 'high', "Mareshah ('possession') will receive 'the possessor' (hayyoresh), a conqueror who takes it over.",
  [(K, 'Micah 1:15'), (J, 'Micah 1:15')], [('Micah 1:15', 'H3423H'), ('Micah 1:15', 'H4762G')])
E('Micah 1:15', A, 'medium', "'The glory of Israel will come to Adullam' recalls David hiding in the cave of Adullam (1 Samuel 22:1): Israel's nobles will again be fugitives in caves.",
  [(P, 'Micah 1:15'), (K, 'Micah 1:15')], [('Micah 1:15', 'H5725'), ('Micah 1:15', 'H3519')], '1 Samuel 22:1')
E('Micah 2:4', WP, 'medium', "The taunt-song is a cascade of like sounds: venahah nehi nihyah ('and he will wail a wailing: it is done') and shadod neshaddunu ('we are utterly ruined').",
  [(K, 'Micah 2:4'), (P, 'Micah 2:4')], [('Micah 2:4', 'H5091'), ('Micah 2:4', 'H5092'), ('Micah 2:4', 'H1961'), ('Micah 2:4', 'H7703')])
E('Micah 2:11', WP, 'high', "The word for preaching is 'dripping' (nataf): the people tell the prophets 'do not drip' (2:6), but a liar who would 'drip' about wine and strong drink would be just the 'dripper' for them.",
  [(K, 'Micah 2:6'), (G, 'Micah 2:11')], [('Micah 2:6', 'H5197'), ('Micah 2:11', 'H5197'), ('Micah 2:11', 'H3196'), ('Micah 2:11', 'H7941')])
E('Micah 2:10', A, 'medium', "'This is not your place of rest (menuchah)' takes back the land as the rest God had promised (Deuteronomy 12:9; Psalm 95:11), because it has been defiled.",
  [(K, 'Micah 2:10'), (G, 'Micah 2:10')], [('Micah 2:10', 'H4496H'), ('Micah 2:10', 'H2930A')], 'Deuteronomy 12:9')
E('Micah 4:4', A, 'high', "'Each man will sit under his own vine and under his own fig tree' recalls the peace of Solomon's reign (1 Kings 4:25), now promised for the last days.",
  [(K, 'Micah 4:4'), (G, 'Micah 4:4')], [('Micah 4:4', 'H1612'), ('Micah 4:4', 'H8384')], '1 Kings 4:25')
E('Micah 4:8', N, 'high', "Zion is called Migdal-eder, 'tower of the flock', a shepherd's watchtower, picturing the city from which the flock is guarded and ruled.",
  [(K, 'Micah 4:8'), (G, 'Micah 4:8')], [('Micah 4:8', 'H4029'), ('Micah 4:8', 'H6076A')])
E('Micah 4:8', A, 'medium', "Migdal-eder is the place near Bethlehem where Jacob pitched his tent after Rachel's death (Genesis 35:19-21).",
  [(G, 'Micah 4:8'), (K, 'Micah 4:8')], [('Micah 4:8', 'H4029')], 'Genesis 35:21')
E('Micah 5:1', WP, 'medium', "'Mobilize your troops (titgodedi), O daughter of troops (bat-gedud)' plays on one root, and 'with a rod (shevet) they strike the judge (shofet)' on two sound-alike words.",
  [(K, 'Micah 5:1')], [('Micah 5:1', 'H1413'), ('Micah 5:1', 'H1416'), ('Micah 5:1', 'H7626G'), ('Micah 5:1', 'H8199')])
E('Micah 5:2', A, 'high', "'Bethlehem Ephrathah' is the full name of David's hometown (1 Samuel 17:12; Ruth 4:11; Genesis 35:19), so the coming Ruler is a new David from David's town.",
  [(K, 'Micah 5:2'), (G, 'Micah 5:2')], [('Micah 5:2', 'H1035G'), ('Micah 5:2', 'H0672G')], '1 Samuel 17:12')
E('Micah 5:3', A, 'high', "'Until she who is in labor has given birth' points back to the virgin who will bear a son in Isaiah 7:14.",
  [(K, 'Micah 5:3'), (G, 'Micah 5:3'), (H, 'Micah 5:3')], [('Micah 5:3', 'H3205')], 'Isaiah 7:14')
E('Micah 5:6', A, 'high', "Assyria is called 'the land of Nimrod', recalling the mighty hunter who built Nineveh (Genesis 10:8-11).",
  [(K, 'Micah 5:6'), (G, 'Micah 5:6')], [('Micah 5:6', 'H5248'), ('Micah 5:6', 'H0804G')], 'Genesis 10:11')
E('Micah 6:5', A, 'high', "God reminds His people of Balak's plan and Balaam's answer (Numbers 22-24) and of the crossing 'from Shittim to Gilgal' (Joshua 3:1; 4:19).",
  [(K, 'Micah 6:5'), (G, 'Micah 6:5'), (H, 'Micah 6:5')], [('Micah 6:5', 'H1111'), ('Micah 6:5', 'H1109A'), ('Micah 6:5', 'H7851G'), ('Micah 6:5', 'H1537G')], 'Numbers 22:6')
E('Micah 6:8', A, 'high', "'What does the LORD require of you?' echoes Moses' question, 'what does the LORD your God require of you?' (Deuteronomy 10:12).",
  [(K, 'Micah 6:8'), (P, 'Micah 6:8')], [('Micah 6:8', 'H1875'), ('Micah 6:8', 'H4941H'), ('Micah 6:8', 'H2617A')], 'Deuteronomy 10:12')
E('Micah 6:15', A, 'high', "Sowing but not reaping, pressing olives but not anointing, treading grapes but not drinking the wine are the curses of Deuteronomy 28:38-40 (and Leviticus 26:26).",
  [(K, 'Micah 6:15'), (G, 'Micah 6:15')], [('Micah 6:15', 'H2232'), ('Micah 6:15', 'H7114B'), ('Micah 6:15', 'H5480'), ('Micah 6:15', 'H8354')], 'Deuteronomy 28:38')
E('Micah 7:15', A, 'high', "'As in the days when you came out of Egypt, I will show My wonders (nifla'ot)' promises a new exodus with the wonders of Exodus 3:20 and 15:11.",
  [(K, 'Micah 7:15'), (G, 'Micah 7:15')], [('Micah 7:15', 'H4714G'), ('Micah 7:15', 'H6381')], 'Exodus 3:20')
E('Micah 7:17', A, 'high', "The nations 'will lick the dust like a snake', recalling the curse on the serpent, 'dust you will eat' (Genesis 3:14; Psalm 72:9).",
  [(K, 'Micah 7:17'), (G, 'Micah 7:17')], [('Micah 7:17', 'H3897'), ('Micah 7:17', 'H6083'), ('Micah 7:17', 'H5175')], 'Genesis 3:14')
E('Micah 7:18', WP, 'medium', "'Who is a God like You?' (mi el kamokha) echoes the prophet's own name, Micah, 'who is like the LORD?'",
  [(J, 'Micah 7:18'), (P, 'Micah 7:18')], [('Micah 7:18', 'H4310'), ('Micah 7:18', 'H0410G'), ('Micah 7:18', 'H3644G')])
E('Micah 7:18', A, 'high', "'Who is a God like You' echoes the Song of the Sea, 'Who is like You, O LORD, among the gods?' (Exodus 15:11), and 'who pardons iniquity and passes over transgression' echoes Exodus 34:6-7.",
  [(K, 'Micah 7:18'), (G, 'Micah 7:18')], [('Micah 7:18', 'H3644G'), ('Micah 7:18', 'H5375I'), ('Micah 7:18', 'H5771G')], 'Exodus 15:11')
E('Micah 7:19', A, 'medium', "Casting all our sins 'into the depths (metsulot) of the sea' recalls Pharaoh's army sinking into the depths (Exodus 15:4-5): sins drowned like the Egyptians.",
  [(H, 'Micah 7:19'), (K, 'Micah 7:19')], [('Micah 7:19', 'H7993'), ('Micah 7:19', 'H4688')], 'Exodus 15:5')
E('Micah 7:20', A, 'high', "'As You swore to our fathers from days of old' recalls God's oath to Abraham (Genesis 22:16-18) and His promise to Jacob (Genesis 28:13-14).",
  [(K, 'Micah 7:20'), (G, 'Micah 7:20')], [('Micah 7:20', 'H0571G'), ('Micah 7:20', 'H2617A'), ('Micah 7:20', 'H7650')], 'Genesis 22:16')

# ---------------- NAHUM ----------------
E('Nahum 1:2', A, 'high', "'A jealous (qanno) and avenging God' echoes the jealous God of the commandments (Exodus 20:5; 34:14) and 'vengeance is Mine' (Deuteronomy 32:35, 41).",
  [(K, 'Nahum 1:2'), (G, 'Nahum 1:2')], [('Nahum 1:2', 'H7072'), ('Nahum 1:2', 'H5358')], 'Exodus 20:5')
E('Nahum 1:3', A, 'high', "'The LORD is slow to anger... and will by no means leave the guilty unpunished' takes both halves of Exodus 34:6-7, the second half now falling on Nineveh, once spared (Jonah 4:2).",
  [(K, 'Nahum 1:3'), (G, 'Nahum 1:3')], [('Nahum 1:3', 'H0750'), ('Nahum 1:3', 'H5352')], 'Exodus 34:7')
E('Nahum 1:4', A, 'high', "'He rebukes the sea and dries it up; He makes all the rivers run dry' recalls the Red Sea and the Jordan (Exodus 14:21; Joshua 3:16; Psalm 106:9).",
  [(K, 'Nahum 1:4'), (G, 'Nahum 1:4')], [('Nahum 1:4', 'H1605'), ('Nahum 1:4', 'H3001'), ('Nahum 1:4', 'H5104H')], 'Exodus 14:21')
E('Nahum 1:10', WP, 'medium', "The line hisses with like sounds: tangled like thorns (sirim sevukhim), drunk as with their drink (sov'am sevu'im).",
  [(P, 'Nahum 1:10'), (K, 'Nahum 1:10')], [('Nahum 1:10', 'H5518B'), ('Nahum 1:10', 'H5440'), ('Nahum 1:10', 'H5435'), ('Nahum 1:10', 'H5433A')])
E('Nahum 1:15', A, 'medium', "'The feet of one who brings good news, who proclaims peace' on the mountains shares Isaiah's picture of the herald (Isaiah 52:7), here announcing Nineveh's fall.",
  [(G, 'Nahum 1:15'), (K, 'Nahum 1:15')], [('Nahum 1:15', 'H7272'), ('Nahum 1:15', 'H1319'), ('Nahum 1:15', 'H7965G')], 'Isaiah 52:7')
E('Nahum 2:10', WP, 'high', "Nineveh's fall is told in three rhyming words, buqah umevuqah umevullaqah, 'empty, emptied, and laid waste'.",
  [(K, 'Nahum 2:10'), (P, 'Nahum 2:10'), (J, 'Nahum 2:10'), ('bullinger', 'Nahum 2:10', 'E. W. Bullinger, Figures of Speech Used in the Bible (1898), Paronomasia')], [('Nahum 2:10', 'H0950'), ('Nahum 2:10', 'H4003'), ('Nahum 2:10', 'H1110')])

# ---------------- HABAKKUK ----------------
E('Habakkuk 1:6', WP, 'medium', "The Chaldeans are 'that bitter (hammar) and hasty (wehannimhar) nation', two words that sound almost the same.",
  [(P, 'Habakkuk 1:6')], [('Habakkuk 1:6', 'H4751'), ('Habakkuk 1:6', 'H4116A')])
E('Habakkuk 2:7', WP, 'medium', "Those who 'bite' you (noshekhekha) are the creditors, since the word for bite also gives the word for interest (neshek): the plunderer will be plundered by his own lenders.",
  [(K, 'Habakkuk 2:7'), (G, 'Habakkuk 2:7')], [('Habakkuk 2:7', 'H5391A')])
E('Habakkuk 2:14', A, 'high', "'The earth will be filled with the knowledge of the glory of the LORD as the waters cover the sea' takes up Isaiah 11:9 and Numbers 14:21.",
  [(K, 'Habakkuk 2:14'), (G, 'Habakkuk 2:14')], [('Habakkuk 2:14', 'H4390'), ('Habakkuk 2:14', 'H3519'), ('Habakkuk 2:14', 'H3680')], 'Isaiah 11:9')
E('Habakkuk 2:16', WP, 'medium', "The drunkard is 'filled with shame (qalon) instead of glory (kavod)', and qiqalon, a doubled form that sounds like vomit and shame together, will cover his glory.",
  [(K, 'Habakkuk 2:16'), (P, 'Habakkuk 2:16')], [('Habakkuk 2:16', 'H7036'), ('Habakkuk 2:16', 'H3519'), ('Habakkuk 2:16', 'H7022')])
E('Habakkuk 2:20', A, 'medium', "'The LORD is in His holy temple' repeats Psalm 11:4, and the call to silence before Him is taken up again in Zephaniah 1:7 and Zechariah 2:13.",
  [(G, 'Habakkuk 2:20')], [('Habakkuk 2:20', 'H1964G'), ('Habakkuk 2:20', 'H6944G'), ('Habakkuk 2:20', 'H2013')], 'Psalm 11:4')
E('Habakkuk 3:3', A, 'high', "'God came from Teman, the Holy One from Mount Paran' recalls Moses' blessing, 'He shone forth from Mount Paran' (Deuteronomy 33:2; Judges 5:4), the coming of God at Sinai.",
  [(K, 'Habakkuk 3:3'), (G, 'Habakkuk 3:3'), (H, 'Habakkuk 3:3')], [('Habakkuk 3:3', 'H8487H'), ('Habakkuk 3:3', 'H6290H')], 'Deuteronomy 33:2')
E('Habakkuk 3:6', A, 'medium', "The 'ancient mountains' and 'perpetual hills' are the phrases of Jacob's and Moses' blessings (Genesis 49:26; Deuteronomy 33:15), now shattered before God.",
  [(K, 'Habakkuk 3:6')], [('Habakkuk 3:6', 'H2042'), ('Habakkuk 3:6', 'H1389I'), ('Habakkuk 3:6', 'H5769G')], 'Genesis 49:26')
E('Habakkuk 3:8', A, 'high', "God's anger against 'the rivers' and 'the sea', riding His chariots of salvation, recalls the parting of the Red Sea and the Jordan (Exodus 14; Joshua 3).",
  [(K, 'Habakkuk 3:8'), (G, 'Habakkuk 3:8')], [('Habakkuk 3:8', 'H5104H'), ('Habakkuk 3:8', 'H3220G'), ('Habakkuk 3:8', 'H3444')], 'Exodus 14:21')
E('Habakkuk 3:10', A, 'medium', "'The mountains saw You and writhed... the deep lifted up its voice' follows Asaph's picture of the waters seeing God and writhing (Psalm 77:16-18).",
  [(K, 'Habakkuk 3:10')], [('Habakkuk 3:10', 'H7200G'), ('Habakkuk 3:10', 'H2342J'), ('Habakkuk 3:10', 'H8415')], 'Psalm 77:16')
E('Habakkuk 3:11', A, 'high', "'Sun and moon stood still in their places' recalls Joshua's long day at Gibeon (Joshua 10:12-13).",
  [(K, 'Habakkuk 3:11'), (G, 'Habakkuk 3:11'), (H, 'Habakkuk 3:11')], [('Habakkuk 3:11', 'H8121'), ('Habakkuk 3:11', 'H3394'), ('Habakkuk 3:11', 'H5975G')], 'Joshua 10:13')
E('Habakkuk 3:15', A, 'medium', "Trampling the sea with horses through 'the heap of great waters' recalls the waters piled up in the Song of the Sea (Exodus 15:8).",
  [(G, 'Habakkuk 3:15'), (K, 'Habakkuk 3:15')], [('Habakkuk 3:15', 'H1869'), ('Habakkuk 3:15', 'H2563B')], 'Exodus 15:8')
E('Habakkuk 3:19', A, 'high', "'He makes my feet like those of a deer; He makes me walk on my heights' is David's line in Psalm 18:33 (2 Samuel 22:34), with the 'heights' of Deuteronomy 32:13.",
  [(K, 'Habakkuk 3:19'), (G, 'Habakkuk 3:19')], [('Habakkuk 3:19', 'H0355'), ('Habakkuk 3:19', 'H1116'), ('Habakkuk 3:19', 'H1869')], 'Psalm 18:33')

# ---------------- ZEPHANIAH ----------------
E('Zephaniah 1:2', WP, 'medium', "'I will completely sweep away' is asof asef, forms of two different verbs ('gather' and 'make an end') joined for their sound.",
  [(K, 'Zephaniah 1:2')], [('Zephaniah 1:2', 'H0622'), ('Zephaniah 1:2', 'H5486')])
E('Zephaniah 1:3', A, 'medium', "Sweeping away 'man and beast, the birds of the air and the fish of the sea' and cutting off man (adam) 'from the face of the ground' (adamah) echoes the flood (Genesis 6:7; 7:23) and runs the creation list backward.",
  [(G, 'Zephaniah 1:3'), (K, 'Zephaniah 1:3')], [('Zephaniah 1:3', 'H0120G'), ('Zephaniah 1:3', 'H0929'), ('Zephaniah 1:3', 'H5775'), ('Zephaniah 1:3', 'H1709H'), ('Zephaniah 1:3', 'H0127I')], 'Genesis 6:7')
E('Zephaniah 1:5', WP, 'high', "Swearing 'by Malkam' can be read 'by their king' or 'by Milcom', the Ammonite god: a pointed double meaning against those who swear by the LORD and by him.",
  [(K, 'Zephaniah 1:5'), (G, 'Zephaniah 1:5')], [('Zephaniah 1:5', 'H4428K'), ('Zephaniah 1:5', 'H7650')])
E('Zephaniah 1:7', A, 'high', "'Be silent before the Lord GOD' repeats Habakkuk 2:20, and 'the LORD has prepared a sacrifice' picks up Isaiah 34:6.",
  [(K, 'Zephaniah 1:7')], [('Zephaniah 1:7', 'H2013'), ('Zephaniah 1:7', 'H2077')], 'Habakkuk 2:20')
E('Zephaniah 1:9', A, 'medium', "Those 'who leap over the threshold' were understood as copying the Philistine custom of not stepping on Dagon's threshold (1 Samuel 5:5).",
  [(G, 'Zephaniah 1:9')], [('Zephaniah 1:9', 'H1801'), ('Zephaniah 1:9', 'H4670')], '1 Samuel 5:5')
E('Zephaniah 1:11', WP, 'high', "Jerusalem's market quarter is called 'the Mortar' (Maktesh), where its people will be pounded, and its traders are 'the people of Canaan' (am kena'an), since Canaanite also meant merchant.",
  [(K, 'Zephaniah 1:11'), (G, 'Zephaniah 1:11'), (J, 'Zephaniah 1:11')], [('Zephaniah 1:11', 'H4389'), ('Zephaniah 1:11', 'H3667B')])
E('Zephaniah 1:13', A, 'high', "Building houses but not living in them and planting vineyards but not drinking their wine is the covenant curse of Deuteronomy 28:30, 39 (compare Amos 5:11).",
  [(K, 'Zephaniah 1:13')], [('Zephaniah 1:13', 'H1129'), ('Zephaniah 1:13', 'H5193'), ('Zephaniah 1:13', 'H3754')], 'Deuteronomy 28:30')
E('Zephaniah 1:15', A, 'high', "'A day of darkness and gloom, a day of clouds and blackness' is word for word Joel 2:2.",
  [(K, 'Zephaniah 1:15')], [('Zephaniah 1:15', 'H2822'), ('Zephaniah 1:15', 'H0653'), ('Zephaniah 1:15', 'H6051'), ('Zephaniah 1:15', 'H6205')], 'Joel 2:2')
E('Zephaniah 1:15', WP, 'medium', "'A day of destruction and desolation' is sho'ah umesho'ah, two nearly identical words (as in Job 30:3 and 38:27).",
  [(K, 'Zephaniah 1:15'), (P, 'Zephaniah 1:15')], [('Zephaniah 1:15', 'H7722B'), ('Zephaniah 1:15', 'H4875')])
E('Zephaniah 1:17', A, 'high', "'They will walk like the blind' is the covenant curse, 'you will grope at noon as the blind gropes in darkness' (Deuteronomy 28:29).",
  [(K, 'Zephaniah 1:17')], [('Zephaniah 1:17', 'H5787')], 'Deuteronomy 28:29')
E('Zephaniah 2:9', A, 'high', "Moab and Ammon, born of Lot after he fled Sodom (Genesis 19:30-38), will themselves become 'like Sodom and Gomorrah', a land of weeds and salt pits (Genesis 19:24-26; Deuteronomy 29:23).",
  [(G, 'Zephaniah 2:9'), (K, 'Zephaniah 2:9')], [('Zephaniah 2:9', 'H5467'), ('Zephaniah 2:9', 'H6017'), ('Zephaniah 2:9', 'H4417M')], 'Genesis 19:25')
E('Zephaniah 2:15', A, 'high', "Nineveh's boast, 'I am, and there is none besides me', is Babylon's boast in Isaiah 47:8, 10, a claim that belongs to God alone (Isaiah 45:6).",
  [(K, 'Zephaniah 2:15')], [('Zephaniah 2:15', 'H0589'), ('Zephaniah 2:15', 'H0657A')], 'Isaiah 47:8')
E('Zephaniah 3:3', A, 'medium', "Jerusalem's judges are 'evening wolves', the very picture Habakkuk used of the Chaldeans (Habakkuk 1:8).",
  [(K, 'Zephaniah 3:3')], [('Zephaniah 3:3', 'H2061'), ('Zephaniah 3:3', 'H6153')], 'Habakkuk 1:8')
E('Zephaniah 3:9', A, 'medium', "God will give the peoples a 'pure lip' (safah) so that all call on His name together, the reverse of Babel, where He confused their lip (Genesis 11:1, 7, 9).",
  [(H, 'Zephaniah 3:9'), (P, 'Zephaniah 3:9')], [('Zephaniah 3:9', 'H8193H'), ('Zephaniah 3:9', 'H1305')], 'Genesis 11:7')
E('Zephaniah 3:10', A, 'medium', "Worshipers bringing offerings 'from beyond the rivers of Cush' take up Isaiah 18:1, 7, where gifts are brought to Zion from that land.",
  [(K, 'Zephaniah 3:10')], [('Zephaniah 3:10', 'H5104H'), ('Zephaniah 3:10', 'H3568A'), ('Zephaniah 3:10', 'H4503G')], 'Isaiah 18:7')
E('Zephaniah 3:19', A, 'high', "'I will save the lame and gather the scattered' echoes the promise of Micah 4:6-7.",
  [(K, 'Zephaniah 3:19'), (G, 'Zephaniah 3:19')], [('Zephaniah 3:19', 'H6760'), ('Zephaniah 3:19', 'H5080'), ('Zephaniah 3:19', 'H6908')], 'Micah 4:6')

# ---------------- HAGGAI ----------------
E('Haggai 1:6', A, 'high', "'You have planted much but harvested little; you eat but never have enough' are the covenant curses of Deuteronomy 28:38-40 and Leviticus 26:20, 26.",
  [(K, 'Haggai 1:6'), (G, 'Haggai 1:6')], [('Haggai 1:6', 'H2232'), ('Haggai 1:6', 'H4592'), ('Haggai 1:6', 'H7654')], 'Deuteronomy 28:38')
E('Haggai 1:11', WP, 'medium', "Because God's house lies 'in ruins' (charev, 1:4, 9), He calls for a 'drought' (chorev) on the land: the punishment sounds like the neglect.",
  [(P, 'Haggai 1:11'), (K, 'Haggai 1:11')], [('Haggai 1:9', 'H2720B'), ('Haggai 1:11', 'H2721A')])
E('Haggai 2:3', A, 'high', "'Who is left among you who saw this house in its former glory?' recalls the old men who wept aloud when the new foundation was laid (Ezra 3:12).",
  [(K, 'Haggai 2:3'), (G, 'Haggai 2:3'), (H, 'Haggai 2:3')], [('Haggai 2:3', 'H7604'), ('Haggai 2:3', 'H3519'), ('Haggai 2:3', 'H7223H')], 'Ezra 3:12')
E('Haggai 2:6', A, 'high', "'Once more... I will shake the heavens and the earth' looks back to Sinai, when the mountain quaked (Exodus 19:18), as Hebrews 12:26 explains.",
  [(K, 'Haggai 2:6'), (G, 'Haggai 2:6')], [('Haggai 2:6', 'H7493'), ('Haggai 2:6', 'H8064')], 'Exodus 19:18')
E('Haggai 2:7', A, 'medium', "'I will fill this house with glory' recalls the glory that filled the tabernacle and Solomon's temple (Exodus 40:34-35; 1 Kings 8:10-11).",
  [(G, 'Haggai 2:7'), (H, 'Haggai 2:7')], [('Haggai 2:7', 'H4390'), ('Haggai 2:7', 'H3519')], '1 Kings 8:11')
E('Haggai 2:13', A, 'high', "The question about one 'unclean by a corpse' touching food rests on the law that whatever such a person touches becomes unclean (Numbers 19:11, 22).",
  [(K, 'Haggai 2:13'), (G, 'Haggai 2:13')], [('Haggai 2:13', 'H2931'), ('Haggai 2:13', 'H5315M'), ('Haggai 2:13', 'H2930A')], 'Numbers 19:22')
E('Haggai 2:17', A, 'high', "'I struck you with blight, mildew, and hail... but you did not turn to Me' repeats Amos 4:9 almost word for word.",
  [(K, 'Haggai 2:17')], [('Haggai 2:17', 'H7711B'), ('Haggai 2:17', 'H3420')], 'Amos 4:9')
E('Haggai 2:22', A, 'medium', "God will 'overturn' thrones and chariots, and 'horses and their riders will fall', recalling the horse and rider thrown into the sea (Exodus 15:1, 4).",
  [(G, 'Haggai 2:22'), (P, 'Haggai 2:22')], [('Haggai 2:22', 'H2015'), ('Haggai 2:22', 'H4818'), ('Haggai 2:22', 'H5483M'), ('Haggai 2:22', 'H7392')], 'Exodus 15:1')
E('Haggai 2:23', A, 'high', "Making Zerubbabel 'like My signet ring' reverses God's word to his grandfather Jehoiachin, 'even if you were the signet ring on My right hand, I would pull you off' (Jeremiah 22:24).",
  [(K, 'Haggai 2:23'), (G, 'Haggai 2:23'), (J, 'Haggai 2:23')], [('Haggai 2:23', 'H2368'), ('Haggai 2:23', 'H2216')], 'Jeremiah 22:24')

# ---------------- ZECHARIAH ----------------
E('Zechariah 1:4', A, 'high', "'The former prophets proclaimed: Turn now from your evil ways and deeds' sums up Jeremiah's message in his own words (Jeremiah 25:4-5; 35:15).",
  [(K, 'Zechariah 1:4'), (G, 'Zechariah 1:4')], [('Zechariah 1:4', 'H5030'), ('Zechariah 1:4', 'H7725G'), ('Zechariah 1:4', 'H1870G')], 'Jeremiah 25:5')
E('Zechariah 1:12', A, 'high', "'These seventy years' are the seventy years of Jeremiah's prophecy (Jeremiah 25:11-12; 29:10).",
  [(K, 'Zechariah 1:12'), (G, 'Zechariah 1:12'), (H, 'Zechariah 1:12')], [('Zechariah 1:12', 'H7657'), ('Zechariah 1:12', 'H8141')], 'Jeremiah 25:11')
E('Zechariah 1:17', A, 'medium', "'The LORD will again comfort Zion and again choose Jerusalem' takes up Isaiah 14:1 ('will again choose Israel') and 51:3 ('the LORD will comfort Zion').",
  [(K, 'Zechariah 1:17')], [('Zechariah 1:17', 'H5162G'), ('Zechariah 1:17', 'H0977')], 'Isaiah 14:1')
E('Zechariah 2:5', A, 'medium', "God Himself as 'a wall of fire around' Jerusalem and 'the glory within' recalls the pillar of fire and the glory among His people in the wilderness (Exodus 13:21; 14:19-20).",
  [(G, 'Zechariah 2:5'), (H, 'Zechariah 2:5')], [('Zechariah 2:5', 'H2346G'), ('Zechariah 2:5', 'H0784'), ('Zechariah 2:5', 'H3519')], 'Exodus 13:21')
E('Zechariah 2:8', A, 'high', "'Whoever touches you touches the apple of His eye' echoes Deuteronomy 32:10, 'He guarded him as the apple of His eye.'",
  [(G, 'Zechariah 2:8'), (K, 'Zechariah 2:8')], [('Zechariah 2:8', 'H0892'), ('Zechariah 2:8', 'H5869A')], 'Deuteronomy 32:10')
E('Zechariah 2:10', A, 'medium', "'I am coming to dwell (shakhanti) among you' renews the tabernacle promise, 'I will dwell among the Israelites and be their God' (Exodus 29:45; Leviticus 26:11-12).",
  [(K, 'Zechariah 2:10')], [('Zechariah 2:10', 'H7931'), ('Zechariah 2:10', 'H8432')], 'Exodus 29:45')
E('Zechariah 2:12', A, 'medium', "'The LORD will take possession of Judah as His portion' echoes Deuteronomy 32:9, 'the LORD's portion is His people, Jacob His allotted inheritance.'",
  [(K, 'Zechariah 2:12'), (G, 'Zechariah 2:12')], [('Zechariah 2:12', 'H5157'), ('Zechariah 2:12', 'H2506A')], 'Deuteronomy 32:9')
E('Zechariah 2:13', A, 'high', "'Be silent before the LORD, all people' repeats Habakkuk 2:20 and Zephaniah 1:7.",
  [(K, 'Zechariah 2:13')], [('Zechariah 2:13', 'H2013'), ('Zechariah 2:13', 'H1320')], 'Habakkuk 2:20')
E('Zechariah 3:1', N, 'high', "The Accuser (hassatan) stands 'to accuse him' (lesitno): the title Satan means 'adversary' or 'accuser', and the verb repeats it.",
  [(K, 'Zechariah 3:1'), (G, 'Zechariah 3:1')], [('Zechariah 3:1', 'H7854'), ('Zechariah 3:1', 'H7853')])
E('Zechariah 3:2', A, 'high', "'A firebrand snatched from the fire' is Amos 4:11's picture of Israel barely saved, applied to Joshua and the returned people.",
  [(K, 'Zechariah 3:2'), (G, 'Zechariah 3:2')], [('Zechariah 3:2', 'H0181'), ('Zechariah 3:2', 'H5337'), ('Zechariah 3:2', 'H0784')], 'Amos 4:11')
E('Zechariah 3:8', A, 'high', "'My servant, the Branch' takes up the title of the coming son of David in Jeremiah 23:5 and 33:15 (and Isaiah 4:2).",
  [(K, 'Zechariah 3:8'), (G, 'Zechariah 3:8'), (H, 'Zechariah 3:8')], [('Zechariah 3:8', 'H5650'), ('Zechariah 3:8', 'H6780')], 'Jeremiah 23:5')
E('Zechariah 3:10', A, 'high', "Inviting one's neighbor 'under your own vine and fig tree' echoes Micah 4:4 and 1 Kings 4:25.",
  [(K, 'Zechariah 3:10'), (G, 'Zechariah 3:10')], [('Zechariah 3:10', 'H1612'), ('Zechariah 3:10', 'H8384')], 'Micah 4:4')
E('Zechariah 4:2', A, 'high', "The 'solid gold lampstand' with seven lamps is the tabernacle lampstand of Exodus 25:31-37.",
  [(K, 'Zechariah 4:2'), (G, 'Zechariah 4:2')], [('Zechariah 4:2', 'H4501'), ('Zechariah 4:2', 'H2091'), ('Zechariah 4:2', 'H5216A')], 'Exodus 25:31')
E('Zechariah 5:11', A, 'medium', "Wickedness is carried off to 'the land of Shinar', the plain of Babel where men first built in rebellion against God (Genesis 10:10; 11:2).",
  [(P, 'Zechariah 5:11'), (G, 'Zechariah 5:11')], [('Zechariah 5:11', 'H8152')], 'Genesis 11:2')
E('Zechariah 6:12', WP, 'high', "'A man whose name is the Branch (tsemach), and He will branch out (yitsmach) from His place' explains the name with its own verb.",
  [(K, 'Zechariah 6:12'), (G, 'Zechariah 6:12')], [('Zechariah 6:12', 'H6780'), ('Zechariah 6:12', 'H6779')])
E('Zechariah 6:13', A, 'high', "'He will be a priest on His throne' joins king and priest in one person, as in Psalm 110:4.",
  [(G, 'Zechariah 6:13'), (H, 'Zechariah 6:13'), (K, 'Zechariah 6:13')], [('Zechariah 6:13', 'H3548'), ('Zechariah 6:13', 'H3678G')], 'Psalm 110:4')
E('Zechariah 6:14', N, 'medium', "Josiah son of Zephaniah (6:10) is here called Hen, meaning 'grace' or 'favor', for the kindness he showed in receiving the returned exiles.",
  [(K, 'Zechariah 6:14')], [('Zechariah 6:14', 'H2581'), ('Zechariah 6:14', 'H6846I')])
E('Zechariah 8:3', N, 'medium', "Jerusalem will be renamed 'the City of Truth' and the LORD's mountain 'the Holy Mountain', like Isaiah's 'faithful city' (Isaiah 1:26).",
  [(K, 'Zechariah 8:3'), (G, 'Zechariah 8:3')], [('Zechariah 8:3', 'H0571G'), ('Zechariah 8:3', 'H6944G')])
E('Zechariah 8:6', A, 'medium', "'If this seems impossible (yippale') to the remnant, should it be impossible to Me?' echoes God's word to Abraham and Sarah, 'Is anything too hard (hayippale') for the LORD?' (Genesis 18:14).",
  [(P, 'Zechariah 8:6')], [('Zechariah 8:6', 'H6381')], 'Genesis 18:14')
E('Zechariah 8:13', A, 'medium', "'As you have been a curse among the nations... you will be a blessing' renews God's word to Abraham, 'you will be a blessing' (Genesis 12:2).",
  [(G, 'Zechariah 8:13')], [('Zechariah 8:13', 'H7045'), ('Zechariah 8:13', 'H1293')], 'Genesis 12:2')
E('Zechariah 9:3', WP, 'high', "Tyre (Tsor) built herself a stronghold (matsor), a play on the city's name, and heaped up silver like dust.",
  [(K, 'Zechariah 9:3'), (P, 'Zechariah 9:3')], [('Zechariah 9:3', 'H6865'), ('Zechariah 9:3', 'H4692')])
E('Zechariah 9:9', A, 'medium', "The King 'riding on a donkey, on a colt (ayir), the foal of a donkey' uses the words of Jacob's blessing on Judah, 'binding his colt to the vine, his donkey's foal to the choice branch' (Genesis 49:10-11).",
  [(P, 'Zechariah 9:9')], [('Zechariah 9:9', 'H2543'), ('Zechariah 9:9', 'H5895'), ('Zechariah 9:9', 'H0860')], 'Genesis 49:11')
E('Zechariah 9:10', A, 'high', "'His dominion will extend from sea to sea, and from the River to the ends of the earth' is Psalm 72:8 word for word.",
  [(K, 'Zechariah 9:10'), (G, 'Zechariah 9:10')], [('Zechariah 9:10', 'H4915B'), ('Zechariah 9:10', 'H5104G'), ('Zechariah 9:10', 'H0657A')], 'Psalm 72:8')
E('Zechariah 9:11', A, 'high', "'The blood of My covenant' recalls the blood Moses sprinkled at Sinai, 'the blood of the covenant' (Exodus 24:8), and the 'waterless pit' recalls the empty cistern Joseph was thrown into (Genesis 37:24).",
  [(K, 'Zechariah 9:11'), (G, 'Zechariah 9:11')], [('Zechariah 9:11', 'H1818'), ('Zechariah 9:11', 'H1285'), ('Zechariah 9:11', 'H0953A')], 'Exodus 24:8')
E('Zechariah 10:4', A, 'medium', "The 'cornerstone' and 'tent peg' from Judah recall Isaiah's sure cornerstone (Isaiah 28:16) and the peg fastened in a sure place (Isaiah 22:23).",
  [(K, 'Zechariah 10:4')], [('Zechariah 10:4', 'H6438H'), ('Zechariah 10:4', 'H3489')], 'Isaiah 22:23')
E('Zechariah 10:8', A, 'medium', "God will 'whistle' for His scattered people to gather them, the same whistle with which He once summoned the nations against them (Isaiah 5:26; 7:18).",
  [(K, 'Zechariah 10:8')], [('Zechariah 10:8', 'H8319'), ('Zechariah 10:8', 'H6908')], 'Isaiah 5:26')
E('Zechariah 10:11', A, 'high', "Passing through 'the sea of distress', striking its waves and drying up the depths of the Nile pictures a new Red Sea crossing (Exodus 14:21-22; Isaiah 11:15-16).",
  [(K, 'Zechariah 10:11'), (G, 'Zechariah 10:11')], [('Zechariah 10:11', 'H5674A'), ('Zechariah 10:11', 'H1530H'), ('Zechariah 10:11', 'H3001'), ('Zechariah 10:11', 'H2975G')], 'Exodus 14:21')
E('Zechariah 11:7', N, 'high', "The shepherd names his two staffs No'am, 'Favor', and Chovlim, 'Union' (literally 'bands'), and later breaks each to show the favor and the brotherhood taken away (11:10, 14).",
  [(K, 'Zechariah 11:7'), (G, 'Zechariah 11:7'), (H, 'Zechariah 11:7')], [('Zechariah 11:7', 'H5278'), ('Zechariah 11:7', 'H2256C')])
E('Zechariah 11:12', A, 'high', "'Thirty pieces of silver' is the price fixed in the law for a slave gored by an ox (Exodus 21:32): the Shepherd is valued at the price of a slave.",
  [(K, 'Zechariah 11:12'), (G, 'Zechariah 11:12'), (H, 'Zechariah 11:12')], [('Zechariah 11:12', 'H7970'), ('Zechariah 11:12', 'H3701G'), ('Zechariah 11:12', 'H7939')], 'Exodus 21:32')
E('Zechariah 12:1', A, 'medium', "God is named as the One who 'stretches out the heavens, lays the foundation of the earth, and forms the spirit of man within him', recalling Isaiah 42:5 and the forming of man in Genesis 2:7.",
  [(G, 'Zechariah 12:1'), (K, 'Zechariah 12:1')], [('Zechariah 12:1', 'H5186'), ('Zechariah 12:1', 'H3245'), ('Zechariah 12:1', 'H3335G'), ('Zechariah 12:1', 'H7307G')], 'Isaiah 42:5')
E('Zechariah 12:11', A, 'high', "The mourning of Hadad-rimmon in the plain of Megiddo recalls the great lament for good King Josiah, killed at Megiddo (2 Chronicles 35:22-25).",
  [(K, 'Zechariah 12:11'), (G, 'Zechariah 12:11'), (C, 'Zechariah 12:11', 'Jerome, Commentary on Zechariah, on 12:11')], [('Zechariah 12:11', 'H1910'), ('Zechariah 12:11', 'H4023'), ('Zechariah 12:11', 'H4553')], '2 Chronicles 35:24')
E('Zechariah 13:1', A, 'medium', "The fountain opened 'for sin and for impurity (niddah)' recalls the 'water for impurity' of the red heifer (Numbers 19:9).",
  [(K, 'Zechariah 13:1')], [('Zechariah 13:1', 'H4726'), ('Zechariah 13:1', 'H5079')], 'Numbers 19:9')
E('Zechariah 13:4', A, 'high', "The false prophets' 'hairy cloak' imitates Elijah's garment (2 Kings 1:8; 1 Kings 19:19).",
  [(K, 'Zechariah 13:4'), (G, 'Zechariah 13:4')], [('Zechariah 13:4', 'H0155'), ('Zechariah 13:4', 'H8181')], '2 Kings 1:8')
E('Zechariah 13:5', A, 'medium', "The false prophet's excuse, 'I am not a prophet; I work the land', borrows the words of the true prophet Amos (Amos 7:14).",
  [(P, 'Zechariah 13:5')], [('Zechariah 13:5', 'H5030'), ('Zechariah 13:5', 'H5647I'), ('Zechariah 13:5', 'H0127G')], 'Amos 7:14')
E('Zechariah 13:9', A, 'high', "'I will say, They are My people, and they will say, The LORD is our God' fulfills Hosea's reversal of Lo-ammi (Hosea 2:23).",
  [(K, 'Zechariah 13:9')], [('Zechariah 13:9', 'H5971A'), ('Zechariah 13:9', 'H0430G')], 'Hosea 2:23')
E('Zechariah 14:5', A, 'high', "'As you fled from the earthquake in the days of Uzziah' recalls the earthquake by which Amos dated his prophecy (Amos 1:1).",
  [(K, 'Zechariah 14:5'), (G, 'Zechariah 14:5')], [('Zechariah 14:5', 'H7494'), ('Zechariah 14:5', 'H5818G')], 'Amos 1:1')
E('Zechariah 14:8', A, 'high', "'Living water will flow out from Jerusalem' takes up Ezekiel's river from the temple (Ezekiel 47:1-12) and Joel 3:18.",
  [(K, 'Zechariah 14:8'), (G, 'Zechariah 14:8')], [('Zechariah 14:8', 'H4325G'), ('Zechariah 14:8', 'H2416A')], 'Ezekiel 47:1')
E('Zechariah 14:9', A, 'high', "'The LORD will be one and His name one' is the Shema of Deuteronomy 6:4 made true over all the earth.",
  [(G, 'Zechariah 14:9'), (P, 'Zechariah 14:9')], [('Zechariah 14:9', 'H0259'), ('Zechariah 14:9', 'H8034')], 'Deuteronomy 6:4')
E('Zechariah 14:20', A, 'high', "'HOLY TO THE LORD', once engraved only on the high priest's gold plate (Exodus 28:36), will be written even on horses' bells.",
  [(K, 'Zechariah 14:20'), (G, 'Zechariah 14:20'), (H, 'Zechariah 14:20')], [('Zechariah 14:20', 'H6944G'), ('Zechariah 14:20', 'H4698')], 'Exodus 28:36')
E('Zechariah 14:21', WP, 'medium', "'There will no longer be a Canaanite (kena'ani) in the house of the LORD' can also be read 'trader', since Canaanite was a word for merchant.",
  [(G, 'Zechariah 14:21'), (K, 'Zechariah 14:21')], [('Zechariah 14:21', 'H3669B')])

# ---------------- MALACHI ----------------
E('Malachi 1:2', A, 'high', "'Was not Esau Jacob's brother? Yet Jacob I have loved' recalls the twins and the word to Rebekah, 'the older will serve the younger' (Genesis 25:23).",
  [(K, 'Malachi 1:2'), (G, 'Malachi 1:2'), (H, 'Malachi 1:2')], [('Malachi 1:2', 'H6215H'), ('Malachi 1:2', 'H3290'), ('Malachi 1:2', 'H0157G')], 'Genesis 25:23')
E('Malachi 1:4', N, 'medium', "Edom will be called 'the Land (literally Border) of Wickedness', a name given by God in answer to their boast that they will rebuild.",
  [(G, 'Malachi 1:4'), (K, 'Malachi 1:4')], [('Malachi 1:4', 'H1366H'), ('Malachi 1:4', 'H7564')])
E('Malachi 1:8', A, 'high', "Offering blind, lame and sick animals breaks the law that no blemished animal be sacrificed (Leviticus 22:20-22; Deuteronomy 15:21).",
  [(K, 'Malachi 1:8'), (G, 'Malachi 1:8')], [('Malachi 1:8', 'H5787'), ('Malachi 1:8', 'H6455'), ('Malachi 1:8', 'H2470H')], 'Deuteronomy 15:21')
E('Malachi 2:2', A, 'medium', "'I will send the curse (me'erah) among you' uses the word of Deuteronomy 28:20, and 'I will curse your blessings' turns the priests' own blessing upside down.",
  [(K, 'Malachi 2:2')], [('Malachi 2:2', 'H3994'), ('Malachi 2:2', 'H0779'), ('Malachi 2:2', 'H1293')], 'Deuteronomy 28:20')
E('Malachi 2:3', A, 'medium', "Spreading the 'dung (peresh) of your feasts' on the priests' faces uses the word for the offal of the sacrifices that was carried outside the camp and burned (Exodus 29:14; Leviticus 4:11-12).",
  [(K, 'Malachi 2:3'), (G, 'Malachi 2:3')], [('Malachi 2:3', 'H6569'), ('Malachi 2:3', 'H2282')], 'Exodus 29:14')
E('Malachi 2:5', A, 'high', "God's covenant with Levi 'of life and peace' recalls the 'covenant of peace' given to Phinehas for his zeal (Numbers 25:12-13) and Moses' blessing of Levi (Deuteronomy 33:8-10).",
  [(K, 'Malachi 2:5'), (G, 'Malachi 2:5')], [('Malachi 2:5', 'H1285'), ('Malachi 2:5', 'H2416E'), ('Malachi 2:5', 'H7965G')], 'Numbers 25:12')
E('Malachi 2:10', A, 'medium', "'Do we not all have one Father? Did not one God create us?' echoes Moses' 'Is He not your Father, who created you?' (Deuteronomy 32:6).",
  [(G, 'Malachi 2:10')], [('Malachi 2:10', 'H0001G'), ('Malachi 2:10', 'H1254A')], 'Deuteronomy 32:6')
E('Malachi 2:12', WP, 'medium', "'Everyone who is awake and aware' is 'er we'oneh, a rhyming saying ('he who wakes and he who answers') that means every last one.",
  [(K, 'Malachi 2:12'), (G, 'Malachi 2:12')], [('Malachi 2:12', 'H5782'), ('Malachi 2:12', 'H6030B')])
E('Malachi 2:15', A, 'medium', "'Has not the LORD made them one?' looks back to the making of marriage, when the two became 'one flesh' (Genesis 2:24).",
  [(G, 'Malachi 2:15'), (H, 'Malachi 2:15')], [('Malachi 2:15', 'H0259'), ('Malachi 2:15', 'H6213H')], 'Genesis 2:24')
E('Malachi 3:10', A, 'medium', "'The windows of heaven' (arubbot hashamayim), once opened for the flood (Genesis 7:11), will instead pour out blessing, answering the officer's scoff in 2 Kings 7:2.",
  [(G, 'Malachi 3:10')], [('Malachi 3:10', 'H0699'), ('Malachi 3:10', 'H8064')], '2 Kings 7:2')
E('Malachi 3:16', A, 'medium', "The 'scroll of remembrance' written before God recalls His book of His people (Exodus 32:32-33; Psalm 56:8) and the royal book of memorable deeds read to King Ahasuerus (Esther 6:1).",
  [(G, 'Malachi 3:16'), (K, 'Malachi 3:16')], [('Malachi 3:16', 'H5612H'), ('Malachi 3:16', 'H2146')], 'Exodus 32:32')
E('Malachi 3:17', A, 'high', "'My treasured possession' (segullah) is the title God gave Israel at Sinai (Exodus 19:5; Deuteronomy 7:6).",
  [(K, 'Malachi 3:17'), (G, 'Malachi 3:17')], [('Malachi 3:17', 'H5459')], 'Exodus 19:5')
E('Malachi 4:6', A, 'medium', "Elijah's coming work to 'turn the hearts' recalls his prayer on Mount Carmel, 'that You have turned their hearts back again' (1 Kings 18:37).",
  [(P, 'Malachi 4:6')], [('Malachi 4:6', 'H7725I'), ('Malachi 4:6', 'H3820A')], '1 Kings 18:37')

# ---------------- FIXES after checking the local commentaries ----------------
BAR = 'barnes'
BF = 'E. W. Bullinger, Figures of Speech Used in the Bible (1898), '
BPAR = ('bullinger', None, BF + 'Paronomasia')

def mk(s):
    d = {'source': s[0], 'on': s[1]}
    if len(s) > 2:
        d['at'] = s[2]
    return d

def F(ref, kind):
    xs = [c for c in OUT if c['ref'] == ref and c['kind'] == kind]
    if len(xs) != 1:
        sys.exit(f'!! fix {ref} {kind}: {len(xs)} found')
    return xs[0]

def drop(ref, kind):
    OUT.remove(F(ref, kind))

def src(ref, kind, sources, **kw):
    c = F(ref, kind)
    c['sources'] = [mk(s) for s in sources]
    c.update(kw)

def upd(ref, kind, **kw):
    F(ref, kind).update(kw)

def bpar(on, figure='Paronomasia', extra=''):
    return ('bullinger', on, BF + figure + extra)

# HOSEA
drop('Hosea 1:4', N)
E('Hosea 1:4', N, 'high', "God has Hosea name his son Jezreel, 'God sows' or 'God scatters', because He is about to punish Jehu's house for the blood shed at Jezreel and scatter the kingdom.",
  [(G, 'Hosea 1:4')], [('Hosea 1:4', 'H3157K')])
E('Hosea 1:5', WP, 'high', "God will break the bow of Israel (Yisra'el) in the Valley of Jezreel (Yizre'el): the place of judgment sounds almost like the people judged there.",
  [(K, 'Hosea 1:5')], [('Hosea 1:5', 'H3478'), ('Hosea 1:5', 'H3157L')])
src('Hosea 1:11', WP, [(K, 'Hosea 1:11'), (G, 'Hosea 1:11'), (CL, 'Hosea 1:11')])
E('Hosea 6:3', WP, 'medium', "In their misery they will 'seek Me earnestly' (yeshacharuneni, from shachar, 'dawn', 5:15), and the answer comes in the same word: the LORD's going forth is as sure as the dawn (shachar).",
  [(BAR, 'Hosea 6:3')], [('Hosea 5:15', 'H7836'), ('Hosea 6:3', 'H7837')])
src('Hosea 8:7', WP, [(K, 'Hosea 8:7'), bpar('Hosea 8:7')])
drop('Hosea 8:9', WP)
src('Hosea 8:13', A, [(K, 'Hosea 8:13')])
src('Hosea 9:9', A, [(G, 'Hosea 9:9'), (J, 'Hosea 9:9')])
src('Hosea 9:15', WP, [(K, 'Hosea 9:15'), (G, 'Hosea 9:15'), bpar('Hosea 9:15')])
src('Hosea 10:5', WP, [(K, 'Hosea 10:5'), (J, 'Hosea 10:5')])
src('Hosea 10:12', WP, [(G, 'Hosea 10:12'), (BAR, 'Hosea 10:12')])
src('Hosea 12:5', A, [(BAR, 'Hosea 12:5'), (J, 'Hosea 12:5')])
E('Hosea 12:7', WP, 'high', "'A merchant' is kena'an, literally 'Canaan': Ephraim, heir of Jacob, has become a Canaanite trader with dishonest scales, since the name of Canaan had come to mean a merchant.",
  [(K, 'Hosea 12:7'), (G, 'Hosea 12:7'), (J, 'Hosea 12:7')], [('Hosea 12:7', 'H3667B'), ('Hosea 12:7', 'H3976')])
drop('Hosea 12:8', WP)
src('Hosea 12:11', WP, [(K, 'Hosea 12:11'), (J, 'Hosea 12:11'), bpar('Hosea 12:11')])
src('Hosea 12:13', WP, [(K, 'Hosea 12:13'), (J, 'Hosea 12:13'), (BAR, 'Hosea 12:13')], sure='high')
src('Hosea 13:15', WP, [(K, 'Hosea 13:15'), (G, 'Hosea 13:15'), (CL, 'Hosea 13:15')])
drop('Hosea 14:3', N)
drop('Hosea 14:8', WP)

# JOEL
src('Joel 1:10', WP, [(CL, 'Joel 1:7')], sure='medium')
src('Joel 1:12', WP, [(G, 'Joel 1:12')])
src('Joel 1:15', WP, [(K, 'Joel 1:15'), (G, 'Joel 1:15'), (CL, 'Joel 1:7'), bpar('Joel 1:15')])
E('Joel 2:13', WP, 'high', "'Rend your hearts and not your garments' uses the one verb 'rend' in two senses at once: figuratively of the heart and literally of the clothes.",
  [bpar('Joel 2:13', 'Syllepsis')], [('Joel 2:13', 'H7167'), ('Joel 2:13', 'H3824'), ('Joel 2:13', 'H0899B')])
src('Joel 2:28', A, [(J, 'Joel 2:28')])
src('Joel 3:2', N, [(K, 'Joel 3:2'), (G, 'Joel 3:2'), (J, 'Joel 3:2')])
src('Joel 3:12', WP, [(J, 'Joel 3:2'), (G, 'Joel 3:2')])
src('Joel 3:14', WP, [(G, 'Joel 3:14')])

# AMOS
src('Amos 1:5', N, [(G, 'Amos 1:5')])
src('Amos 1:11', A, [(G, 'Amos 1:11')])
drop('Amos 3:2', A)
src('Amos 3:12', A, [(J, 'Amos 3:12'), (G, 'Amos 3:12')])
src('Amos 4:9', A, [(K, 'Amos 4:9'), (BAR, 'Amos 4:9')])
src('Amos 4:10', A, [(K, 'Amos 4:10'), (J, 'Amos 4:10'), (BAR, 'Amos 4:10')])
src('Amos 4:11', A, [(J, 'Amos 4:11'), (G, 'Amos 4:11')])
src('Amos 5:8', A, [(G, 'Amos 5:8')])
src('Amos 5:11', A, [(K, 'Amos 5:11')])
upd('Amos 6:13', N, what="They rejoice in Lo-debar, which spelled out is lo dabar, 'a nothing', and boast of taking Karnaim, 'horns' (the sign of strength): their victory is a nothing and their strength a boast.")
src('Amos 6:13', N, [(K, 'Amos 6:13'), (BAR, 'Amos 6:13')])
src('Amos 8:5', A, [(G, 'Amos 8:5')])
E('Amos 9:14', WP, 'high', "'I will restore My people from captivity' is veshavti et-shevut, two like-sounding words joined, the phrase the prophets use for God turning back His people's captivity.",
  [bpar('Amos 9:14', 'Paronomasia', ', under Deuteronomy 30:3')], [('Amos 9:14', 'H7725H'), ('Amos 9:14', 'H7622')])

# OBADIAH
src('Obadiah 1:3', WP, [(K, 'Obadiah 1:3'), (J, 'Obadiah 1:3'), (CL, 'Obadiah 1:3')])
drop('Obadiah 1:15', A)
src('Obadiah 1:21', A, [(BAR, 'Obadiah 1:21'), (J, 'Obadiah 1:21')])

# JONAH
drop('Jonah 1:5', WP)
E('Jonah 1:5', WP, 'medium', "Jonah 'went down' (yarad) to Joppa and 'went down' into the ship (1:3), then 'went down' into the hold: every step of his flight from God's presence is a going down, until he sinks to the roots of the mountains (2:6).",
  [(BAR, 'Jonah 1:3')], [('Jonah 1:3', 'H3381'), ('Jonah 1:3', 'H3381', 1), ('Jonah 1:5', 'H3381')])
drop('Jonah 1:9', A)
upd('Jonah 2:7', A, sure='high')
drop('Jonah 2:9', A)
E('Jonah 2:9', A, 'high', "'I will sacrifice to You with a voice of thanksgiving; I will fulfill what I have vowed' takes up Psalm 50:14, 'Offer God a sacrifice of thanksgiving, and pay your vows to the Most High.'",
  [(K, 'Jonah 2:9')], [('Jonah 2:9', 'H8426'), ('Jonah 2:9', 'H5087')], 'Psalm 50:14')
src('Jonah 3:4', A, [(G, 'Jonah 3:4')])
src('Jonah 3:9', A, [(BAR, 'Jonah 3:9')])
src('Jonah 4:8', A, [(K, 'Jonah 4:8')])

# MICAH
src('Micah 1:13', WP, [(K, 'Micah 1:13')])
src('Micah 1:14', WP, [(K, 'Micah 1:14'), (J, 'Micah 1:14'), (CL, 'Micah 1:14')])
src('Micah 1:15', A, [(G, 'Micah 1:15'), (BAR, 'Micah 1:15')], sure='high')
upd('Micah 2:4', WP, what="The lament is built by repeating one root, venahah nehi nihyah, literally 'he will lament a lamentation of lamentation', and then shadod neshaddunu, 'we are utterly ruined', piling up like sounds.")
src('Micah 2:4', WP, [bpar('Micah 2:4', 'Polyptoton')])
src('Micah 4:4', A, [(G, 'Micah 4:4'), (J, 'Micah 4:4')])
drop('Micah 5:1', WP)
drop('Micah 7:18', WP)
src('Micah 7:19', A, [(K, 'Micah 7:19')])

# NAHUM
src('Nahum 1:2', A, [(K, 'Nahum 1:2')])
src('Nahum 1:3', A, [(K, 'Nahum 1:3')])
drop('Nahum 1:10', WP)
src('Nahum 2:10', WP, [(J, 'Nahum 2:10'), bpar('Nahum 2:10')])
E('Nahum 3:7', WP, 'medium', "God will make Nineveh 'a spectacle' (ro'i, 3:6), and then 'all who see you' (ro'ayikh) will flee from her: the onlookers are named with the same word as the sight.",
  [(K, 'Nahum 3:6')], [('Nahum 3:6', 'H7210'), ('Nahum 3:7', 'H7200G')])

# HABAKKUK
drop('Habakkuk 1:6', WP)
E('Habakkuk 2:6', WP, 'medium', "The plunderer 'loads himself with pledges' ('avtit), a word that, heard aloud, sounds like 'av tit, 'a thick mass of mud' (the KJV's 'thick clay'): his heaped-up wealth is so much heavy dirt.",
  [(K, 'Habakkuk 2:6'), (C, 'Habakkuk 2:6', 'Jerome, Commentary on Habakkuk, on 2:6'), (G, 'Habakkuk 2:6')], [('Habakkuk 2:6', 'H5671'), ('Habakkuk 2:6', 'H3513H')])
src('Habakkuk 2:16', WP, [(K, 'Habakkuk 2:16')])
E('Habakkuk 2:18', WP, 'high', "The idol-maker trusts in 'mute idols', elilim illemim, two words of nearly the same sound: the 'nothings' are also 'dumb'.",
  [bpar('Habakkuk 2:18')], [('Habakkuk 2:18', 'H0457'), ('Habakkuk 2:18', 'H0483')])
src('Habakkuk 2:20', A, [(J, 'Habakkuk 2:20')])
upd('Habakkuk 3:6', A, target='Deuteronomy 33:15')
drop('Habakkuk 3:15', A)
E('Habakkuk 3:15', A, 'medium', "'You trampled the sea with Your horses' recalls the LORD's path through the Red Sea, where Pharaoh's horses went down into the waters (Exodus 15:19; Psalm 77:19).",
  [(G, 'Habakkuk 3:15'), (J, 'Habakkuk 3:15')], [('Habakkuk 3:15', 'H1869'), ('Habakkuk 3:15', 'H3220G'), ('Habakkuk 3:15', 'H5483M')], 'Exodus 15:19')

# ZEPHANIAH
src('Zephaniah 1:2', WP, [(K, 'Zephaniah 1:2'), bpar('Zephaniah 1:2')], sure='high')
upd('Zephaniah 1:5', WP, sure='medium', what="Swearing 'by Malkam' means 'by their king', and the same letters spell Milcom, the Ammonite god: those who swear by the LORD also swear by an idol king.")
src('Zephaniah 1:5', WP, [(G, 'Zephaniah 1:5'), (K, 'Zephaniah 1:5')])
src('Zephaniah 1:15', WP, [(K, 'Zephaniah 1:15'), (J, 'Zephaniah 1:15')])
E('Zephaniah 2:6', WP, 'medium', "The land of the Kerethites (keretim, 2:5) will become keroth, pastures or 'diggings' for shepherds: the people's name comes back as the name of what is left of their land.",
  [(BAR, 'Zephaniah 2:4')], [('Zephaniah 2:5', 'H3774G'), ('Zephaniah 2:6', 'H3741')])
E('Zephaniah 2:7', WP, 'medium', "Chevel, the 'band' or region of the seacoast (2:5-6), becomes in 2:7 a chevel in its other sense, a measured portion given to the remnant of Judah.",
  [(BAR, 'Zephaniah 2:4')], [('Zephaniah 2:5', 'H2256M'), ('Zephaniah 2:7', 'H2256M')])
src('Zephaniah 3:9', A, [(J, 'Zephaniah 3:9'), (BAR, 'Zephaniah 3:9')], sure='high')
E('Zephaniah 3:20', WP, 'medium', "'When I restore your captivity' is beshuvi et-shevuteikhem, two like-sounding words joined, the phrase the prophets use for God turning back His people's captivity.",
  [bpar('Zephaniah 3:20', 'Paronomasia', ', under Deuteronomy 30:3')], [('Zephaniah 3:20', 'H7725H'), ('Zephaniah 3:20', 'H7622')])

# HAGGAI
src('Haggai 1:11', WP, [(J, 'Haggai 1:11'), (G, 'Haggai 1:11'), (BAR, 'Haggai 1:11')], sure='high')
src('Haggai 2:7', A, [(G, 'Haggai 2:7')], target='Exodus 40:34')
drop('Haggai 2:22', A)

# ZECHARIAH
src('Zechariah 1:4', A, [(BAR, 'Zechariah 1:4')])
src('Zechariah 1:12', A, [(G, 'Zechariah 1:12')])
src('Zechariah 1:17', A, [(J, 'Zechariah 1:17'), (BAR, 'Zechariah 1:17')])
src('Zechariah 2:5', A, [(G, 'Zechariah 2:5'), (J, 'Zechariah 2:5')])
drop('Zechariah 2:10', A)
src('Zechariah 2:12', A, [(K, 'Zechariah 2:12')])
src('Zechariah 3:10', A, [(G, 'Zechariah 3:10'), (J, 'Micah 4:4')])
src('Zechariah 5:11', A, [(G, 'Zechariah 5:11')], target='Genesis 10:10')
src('Zechariah 6:13', A, [(J, 'Zechariah 6:13')])
upd('Zechariah 8:6', A, target='Jeremiah 32:27', what="'If this seems impossible (yippale') to the remnant, should it also be impossible to Me?' echoes God's own question, 'Is anything too hard for Me?' (Jeremiah 32:27; compare Genesis 18:14).")
src('Zechariah 8:6', A, [(BAR, 'Zechariah 8:6')])
drop('Zechariah 8:13', A)
src('Zechariah 9:3', WP, [(BAR, 'Zechariah 9:3'), bpar('Zechariah 9:3')])
E('Zechariah 9:5', WP, 'high', "'Ashkelon will see (tere) and fear (tira)': the two verbs sound almost the same, so seeing turns at once into fearing.",
  [bpar('Zechariah 9:5')], [('Zechariah 9:5', 'H7200G'), ('Zechariah 9:5', 'H3372G')])
src('Zechariah 9:9', A, [(G, 'Zechariah 9:9')])
src('Zechariah 12:1', A, [(K, 'Zechariah 12:1')])
src('Zechariah 13:5', A, [(J, 'Zechariah 13:5'), (BAR, 'Zechariah 13:5')], sure='high')
src('Zechariah 14:5', A, [(G, 'Zechariah 14:5'), (J, 'Zechariah 14:5'), (BAR, 'Zechariah 14:5')])
src('Zechariah 14:8', A, [(K, 'Zechariah 14:8')])
drop('Zechariah 14:9', A)
src('Zechariah 14:21', WP, [(G, 'Zechariah 14:21')])

# MALACHI
upd('Malachi 1:8', A, target='Leviticus 22:20')
drop('Malachi 2:2', A)
drop('Malachi 2:10', A)
src('Malachi 2:15', A, [(BAR, 'Malachi 2:15'), (J, 'Malachi 2:14')])
src('Malachi 3:10', A, [(K, 'Malachi 3:10'), (BAR, 'Malachi 3:10')])
upd('Malachi 3:16', A, target='Psalm 56:8', what="The 'scroll of remembrance' written before God recalls David's 'Are they not in Your book?' (Psalm 56:8) and the royal book of memorable deeds read before King Ahasuerus (Esther 6:1).")
src('Malachi 3:16', A, [(K, 'Malachi 3:16')])
drop('Malachi 4:6', A)
E('Malachi 4:5', A, 'high', "'Before the coming of the great and awesome day of the LORD' repeats Joel 2:31 word for word.",
  [(K, 'Malachi 4:5'), (J, 'Malachi 4:5')], [('Malachi 4:5', 'H3117G'), ('Malachi 4:5', 'H1419A'), ('Malachi 4:5', 'H3372G')], 'Joel 2:31')

# drop a source whose note does not mention the point
def nosrc(ref, kind, source):
    c = F(ref, kind)
    c['sources'] = [s for s in c['sources'] if s['source'] != source]
for r, k in [('Amos 1:2', A), ('Micah 2:10', A), ('Micah 7:18', A), ('Haggai 1:6', A), ('Haggai 2:23', A), ('Zephaniah 1:3', A)]:
    nosrc(r, k, G)

drop('Malachi 2:12', WP)
upd('Zechariah 6:14', N, what="The son of Zephaniah, called Josiah in 6:10, is here called Hen, which means 'favor': the crown is kept as a memorial of the favor he showed in taking in the returned exiles.")

# henry and the Pulpit Commentary are not available here to check: keep only checked sources
for c in OUT:
    keep = [s for s in c['sources'] if s['source'] not in ('henry', 'pulpit')]
    if not keep:
        sys.exit(f"!! only unchecked sources: {c['ref']} {c['kind']}")
    c['sources'] = keep

order = {b['name']: i for i, b in enumerate(meta['books'])}
def key(c):
    m = re.match(r'^(.+?) (\d+):(\d+)$', c['ref'])
    return (order[m.group(1)], int(m.group(2)), int(m.group(3)))
OUT.sort(key=key)

json.dump({'candidates': OUT}, open(f'{W}/mp_out.json', 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print(len(OUT), Counter(c['ref'].rsplit(' ', 1)[0] for c in OUT))
print(Counter(c['kind'] for c in OUT), Counter(c['sure'] for c in OUT))
