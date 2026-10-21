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
