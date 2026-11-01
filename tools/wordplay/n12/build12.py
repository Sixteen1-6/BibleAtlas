"""build12.py: lead batches for the 12 next figures (entries.json from plan.py), in the batch format figwrite12.js reads.
Each lead quotes Bullinger's entry from the local fos.txt (with its line) and the form's guidance; notes already held in
the same chapter are listed so none is repeated. Hints only: every quote is read again."""
import json, sys
sys.path.insert(0, '.')
import have
W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
F = f'{W}/fig'
LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
P = json.load(open(f'{LW}/config/layers.json'))['passages']
E = json.load(open('entries.json'))['entries']
FM = {f['id']: f for f in json.load(open('forms12.json'))['forms']}
HELD = have.notes()

G = {
 'acrostic': "Form acrostic (Bullinger's Acrostichion). One note per alphabetical passage: ref the passage's first verse or first section (\"Psalm 119:1-8\"), figure.ref its first verse, figure.words the BSB's opening words of that verse, figure.means that in Hebrew the verses (lines, or sections) begin with the letters of the alphabet in order, and what the cited writers say the pattern marks. Name the language (\"In Hebrew\"). Bullinger lists every one; Barnes, Jamieson, Fausset and Brown, Keil and Delitzsch, Clarke and Henry often note an alphabetical psalm too. Where a letter is missing or out of order, Bullinger holds it is by design; never cite a remark that says the text is corrupt, was altered or should be emended (rule 3), and in limit say only that writers explain the gaps differently.",
 'type': "Form type (Bullinger's Type). Only where the New Testament itself names the type: Paul's or Peter's Greek typos (pattern, example), antitypos (copy, corresponding), skia (shadow), parabole (illustration), or a \"just as ... so\" that the Lord or an apostle draws (John 3:14, Matthew 12:40). The note sits on the New Testament verse: figure.words the BSB words that name it (\"a pattern of the One to come\"), means what the type is and what it points to, as the verse and the writers say; refs the Old Testament passage. Bullinger warns that many so-called types are only illustrations and that only what Scripture itself calls a type should be so named: keep strictly to the type the verse names, and add no others. Name the language when a Greek word is explained (\"In Paul's Greek\", \"In Peter's Greek\", \"In John's Greek\").",
 'allegory': "Form allegory (Bullinger's Allegory: continued metaphor and hypocatastasis, a picture carried through a passage). A picture carried on through several sentences, where the passage itself or the cited writers say what its parts stand for (Isaiah 5:7 explains the vineyard). ref covers the picture's verses in one chapter; figure.ref is the verse where it starts; words the BSB words that start it; means what the picture stands for. Galatians 4:24: Paul's own word (in Paul's Greek, allegoroumena) if the writers state it; the Sarah and Hagar comparison is shown elsewhere in the app as two women set side by side, so this note is only about Paul naming his figure. Ecclesiastes 12: never Ellicott, Keil and Delitzsch or the Pulpit on Ecclesiastes. Judges 9:7-15: Bullinger calls it a fable that the application in 9:16 makes an allegory; say no more. Genesis 49: pick only a verse Bullinger and a second writer read as a picture carried through (Judah the lion, 49:9; Joseph the fruitful vine, 49:22), or drop it.",
 'parable': "Form parable (Bullinger's Parabola: a continued simile, comparison by continued resemblance). A short story told to draw a likeness, where Scripture itself explains or applies it (2 Samuel 12:7, \"You are the man!\"; Matthew 13:18-23). ref is the parable's first verses; figure.ref its first verse; words the BSB words that open it; means what it is likened to, as the Bible's own explanation and the writers say. Bullinger's caution: the likeness lies in its main point, not in every detail; never press a detail further than the text and the writers do. Bullinger gives no list of parables, so cite his Parabola section only where it names the passage (Matthew 25:1-12, Luke 14:16-24); the writers who call the passage a parable and say what it means carry the note (Barnes, Jamieson, Fausset and Brown, Henry, Clarke, Calvin, Maclaren, Keil and Delitzsch).",
 'antithesis': "Form antithesis (Bullinger's Antithesis, or Contrast: one phrase set in contrast with another). Two phrases inside one sentence set against each other: figure.words the BSB words of both contrasted phrases, found once in one verse (choose the verse where both sides stand); means names the two sides and what the contrast shows. Opposite lines (antithetic parallelism between lines of verse) is a different form already in the app: leave out a verse that already holds an opposite-lines note on the same words.",
 'antimetabole': "Form antimetabole (Bullinger's Antimetabole, or Counterchange: words repeated in reverse order, with contrast). figure.words the BSB words where the reversal shows (\"The Sabbath was made for man, not man for the Sabbath\"); means says what is set against what. Only where the BSB keeps the reversed order; if the reversal is only in the Hebrew or Greek order and the BSB untangles it, drop it with that reason. The mirror form (chiasm) is already in the app: leave out a verse that already holds a mirror note on the same words.",
 'aposiopesis': "Form aposiopesis (Bullinger's Aposiopesis, or Sudden Silence: the speaker breaks off and leaves the sentence unfinished). The BSB often completes or smooths the sentence: figure.words must be the BSB's own words where the break falls; means says what is left unsaid and why, as the writers say (grief, awe, a threat left hanging). Say the break is in the original, naming the language (\"In Hebrew, the sentence breaks off\"; \"In Luke's Greek\"), only where a cited writer states it. Never say the text is defective. Genesis 3:22: God's words break off; keep to what the writers say.",
 'meiosis': "Form meiosis (Bullinger's Meiosis, a belittling of one thing to magnify another). Not the same as understatement (Tapeinosis), where a thing is lessened to stress the thing itself. figure.words the BSB words of the belittling (\"dust and ashes\"); means what is lessened and what that lifts up, as the writers say. A \"not\" saying that means much more (Bullinger's litotes cases) counts only where a writer says more is meant than is said.",
 'exclamation': "Form exclamation (Bullinger's Ecphonesis: feeling expressed by crying out). figure.words the BSB words of the cry; means the feeling the cry shows (grief, wonder, longing, praise, rebuke), as the writers say. Only where a writer says the words are a cry of feeling, not merely quoting them. Psalm 22:1: the Lord's cry on the cross (Matthew 27:46) may go in refs; say no more than the writers.",
 'riddle': "Form riddle (Bullinger's Aenigma, or Dark Saying: a truth told in obscure words, to be searched out). Often the text names it (riddle, dark saying, hard question). figure.words the riddle's BSB words; means what it stands for, as the text's own answer or the writers say. Genesis 49:10: keep to what the cited writers state, the reading of the Messiah where they state it. Revelation 13:18: never offer a name for the number; say only that the verse calls for wisdom to work it out, as the writers say. 1 Corinthians 13:12: the BSB's \"dimly\"; in Paul's Greek a riddle (en ainigmati) only if a cited writer says so.",
 'hypocatastasis': "Form hypocatastasis (Bullinger's Hypocatastasis, or Implication: only the picture is named and the thing it stands for is implied, as \"dogs\" for enemies). figure.name \"Hypocatastasis\". Count only writers who say what the picture stands for. Matthew 5:29-30: Bullinger reads it by this figure rather than as overstatement; where the cited writers differ, limit says so.",
 'proverb': "Form proverb (Bullinger's Paroemia, a wayside saying in common use). A saying the text itself marks as common (\"it became a proverb\", \"as the old proverb says\", \"the saying is true\") or that the cited writers say was a saying in common use. figure.words the saying's BSB words; means what it says and how it is applied here. Do not file every wise saying as a proverb: a writer must say it was a common saying. Never Ellicott, Keil and Delitzsch or the Pulpit on Ecclesiastes; never the Pulpit on Jeremiah.",
}
PENDING = (f"This batch also finishes three notes already written and quote-checked: Psalm 22:16, Matthew 16:6 and Acts 20:29, saved in {F}/work/lw28-18/pending-needs-bullinger-pages.json under the old working form \"implied\". "
           "For each, change form to \"hypocatastasis\" and the id's ending from -implied to -hypocatastasis, find its Bullinger page with one search each (phrases: \"Dogs have compassed me about\", \"put it down underneath\", \"true character of\"), re-check it as you would your own, and return it with the others.")
SIZE = {'acrostic': 3, 'allegory': 4, 'parable': 4, 'riddle': 4, 'proverb': 4}


def existing(ref):
    for p in P:
        if p['ref'] == ref:
            return p['id'], sorted({x['kind'] for x in p['layers']})
    return '', []


out = []
for e in E:
    fid = e['form']
    vs = e['verses']
    n = SIZE.get(fid, 4)
    chunks = [vs[i:i + n] for i in range(0, len(vs), n)]
    for ci, ch in enumerate(chunks):
        verses = []
        for v in ch:
            leads = []
            if v.get('fos'):
                leads.append({'work': 'bullinger-fos', 'snippet': f"Bullinger lists the verse under \"{FM[fid]['term']}\" (fos.txt line {v['fos_line']}): {v['fos']}"})
            elif v.get('why'):
                leads.append({'work': 'local study', 'snippet': f"Added beside Bullinger's entries: {v['why']}. Find whether Bullinger names this figure on the verse anywhere (figname.py) and which writers state it."})
            leads.append({'work': 'local study', 'snippet': G[fid]})
            held = [f"{h['id']} ({h['kind']}, {h['form']}, {h['ref']})" for h in have.near(v['ref'], HELD)]
            if held:
                leads.append({'work': 'local study', 'snippet': 'Notes already held in this chapter (never repeat one on the same words): ' + '; '.join(held)})
            first = v['ref'].split('-')[0] if v['ref'].count(':') == 1 else v['ref']
            pid, kinds = existing(first)
            verses.append({'ref': v['ref'], 'existing_passage': pid, 'existing_kinds': kinds,
                           'candidates': [{'kind': 'figure', 'target': fid, 'writers': [], 'leads': leads}]})
        b = {'key': f'n12-{fid}-{ci}', 'form': fid, 'verses': verses}
        if fid == 'hypocatastasis' and ci == 0:
            b['also'] = PENDING
        out.append(b)
json.dump(out, open('n12fig.json', 'w'), ensure_ascii=False, indent=1)
for i, b in enumerate(out):
    print(i, b['key'], [v['ref'] for v in b['verses']])
