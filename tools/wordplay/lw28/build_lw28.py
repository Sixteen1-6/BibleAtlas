"""build_lw28.py: lead batches for the 28 Wordplay items in docs/local-work/2026-10-20/NOT-BUILT-YET.md (PR #67),
in the batch format fig/figwrite.js reads. Each lead quotes the local catalogue's row for the verse (read in local
copies on 2026-10-20, no page recorded) and the local-work check's notes. Hints only: every quote is read again."""
import json, re
W = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp'
cat = open(f'{W}/lw28/catalogue.md').read().split('\n')
LW = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/lw'
P = json.load(open(f'{LW}/config/layers.json'))['passages']


def rows_for(key):
    out = []
    for l in cat:
        if l.startswith('|') and key in l.split('|')[1:3][0] + l.split('|')[1:3][-1]:
            out.append(re.sub(r'\s+', ' ', l.strip()))
    return out


def existing(ref):
    for p in P:
        if p['ref'] == ref:
            return p['id'], sorted({x['kind'] for x in p['layers']})
    return '', []


ANTH = ('Limits from the local-work check: no theophanies (God walking in the garden, Genesis 3:8; the LORD at Abraham\'s tent '
        'in Genesis 18 as an appearance); never file Christ\'s body under this figure; where "the arm of the LORD" is read of '
        'the Messiah (Isaiah 53:1), say so rather than call the arm a figure only. Believing writers differ on whether God\'s '
        'feelings are real (Keil and Delitzsch: the pain of divine love) or only a manner of speaking (Calvin, Bullinger): '
        'where the cited writers differ, the limit says so. Ellicott on Jonah (Aglen) is left out.')
PROS = ('Limits: Wisdom in Proverbs 8 stays out unless both believing readings (a personification, Christ the Wisdom of '
        'God) are shown with their writers. Ellicott on Psalms (Aglen) is left out. On Bible Hub, "a most beautiful '
        'prosopopoeia" on Psalm 98:8 is footnote 113 by Calvin\'s translator, not Calvin: never quote it as Calvin.')
META = ('Limits: never label Matthew 26:26 or John 6:51-58; keep any "I am" note to the picture (vine, bread), not the '
        'divine name.')
MIR = ('The local catalogue (section 4) found this one-verse crossing named "chiasmus", "chiastic" or "crosswise" by the '
       'writer. A mirror note needs lines in the BSB\'s reading order whose marks go out and come back (A B B\' A\'); '
       'where the crossing is only in the Hebrew or Greek order and the BSB untangles it, the note can be written only if '
       'the BSB lines still show a true reversed order (the original field may explain the Hebrew or Greek); otherwise '
       'drop it with that reason. Keil and Delitzsch\'s words on Proverbs 1 are left out (denies); that touches none of these.')
SCAN = ('Lead from a scan of the local commentaries for "chiasmus", "chiastic", "introverted", "epanodos", '
        '"antimetabole" and "inverted order" (2026-11-01). Many hits only note a word order; write a note only where a '
        'writer states that the words or lines go out and come back in reverse order.')
CON = ('Held back in the local catalogue (rows 45 to 50) because no writer was found stating the contrast. Write it only '
       'if a quotable writer states it in his own voice; otherwise drop it. Woudstra (Joshua) is copyrighted and cannot '
       'be quoted.')
DBL = ('Proposed form "doubling" (Epizeuxis), not yet in figure-forms.json: see the proposed forms file. Bullinger lists '
       'the verse under Epizeuxis. Gill states it too but is not quotable in a figure note.')
IRO = ('Proposed form "irony" (Bullinger\'s Eironeia), not yet in figure-forms.json: see the proposed forms file. Verbal '
       'irony only (the speaker says the opposite of what he means). Leave out Genesis 3:22 (believing writers differ). '
       'Henry\'s words on 1 Corinthians are Simon Browne\'s (resolve.py names him). Wesley\'s Old Testament notes count '
       'as Henry and are not quotable. Gill is not quotable.')
IMP = ('Proposed form "implied" (Bullinger\'s Hypocatastasis), not yet in figure-forms.json: the picture word stands alone '
       'and the thing it stands for is implied ("leaven" for teaching). The local catalogue lists it beside metaphor; '
       'write it in this form only where Bullinger lists the verse under Hypocatastasis, and count only writers who say '
       'what the picture stands for.')

B = [
 ('anth-a', [('Exodus 32:14', 'anthropopatheia', 'Exodus 32:14'), ('Genesis 18:21', 'anthropopatheia', 'Genesis 18:21'), ('Psalm 2:4', 'anthropopatheia', 'Psalm 2:4'), ('Genesis 11:5', 'anthropopatheia', 'Genesis 11:5')], ANTH),
 ('anth-b', [('Jonah 3:10', 'anthropopatheia', 'Jonah 3:10'), ('Genesis 8:21', 'anthropopatheia', 'Genesis 8:21'), ('Psalm 44:23', 'anthropopatheia', 'Psalm 44:23'), ('Isaiah 53:1', 'anthropopatheia', 'Isaiah 53:1')], ANTH),
 ('anth-c', [('1 Samuel 15:11', 'anthropopatheia', '1 Samuel 15:11'), ('Exodus 15:6', 'anthropopatheia', 'Exodus 15:6'), ('Psalm 8:3', 'anthropopatheia', 'Psalm 8:3'), ('2 Chronicles 16:9', 'anthropopatheia', '2 Chronicles 16:9'), ('Genesis 22:12', 'anthropopatheia', 'Genesis 22:12'), ('Exodus 6:6', 'anthropopatheia', 'Exodus 6:6')], ANTH),
 ('pros-a', [('Isaiah 55:12', 'prosopopoeia', 'Isaiah 55:12'), ('Psalm 98:8', 'prosopopoeia', 'Psalm 98:8'), ('Habakkuk 2:11', 'prosopopoeia', 'Habakkuk 2:11'), ('Genesis 4:10', 'prosopopoeia', 'Genesis 4:10'), ('James 1:15', 'prosopopoeia', 'James 1:15')], PROS),
 ('pros-b', [('1 Corinthians 13:4', 'prosopopoeia', '1 Corinthians 13:4'), ('Job 28:22', 'prosopopoeia', 'Job 28:22'), ('Leviticus 18:25', 'prosopopoeia', 'Leviticus 18:25'), ('Psalm 85:10', 'prosopopoeia', 'Psalm 85:10'), ('Romans 8:22', 'prosopopoeia', 'Romans 8:22')], PROS),
 ('meta-a', [('Psalm 23:1', 'metaphor', 'Psalm 23:1'), ('John 15:5', 'metaphor', 'John 15:5'), ('Matthew 5:13', 'metaphor', 'Matthew 5:13'), ('Psalm 42:1', 'simile', 'Psalm 42:1')], META),
 ('meta-b', [('Psalm 1:3', 'simile', 'Psalm 1:3-4'), ('Isaiah 40:6', 'simile', 'Isaiah 40:6'), ('Hosea 6:4', 'simile', 'Hosea 6:4'), ('Isaiah 53:6', 'simile', 'Isaiah 53:6-7'), ('Deuteronomy 6:7', 'metaphor', 'Deuteronomy 6:7')], META),
 ('mir-a', [('Proverbs 22:1', 'mirror', 'Proverbs 22:1'), ('Isaiah 40:21', 'mirror', 'Isaiah 40:21'), ('Proverbs 10:3', 'mirror', 'Proverbs 10:3'), ('Proverbs 14:31', 'mirror', 'Proverbs 14:31'), ('Psalm 56:8', 'mirror', 'Psalm 56:8')], MIR),
 ('mir-b', [('Psalm 63:8', 'mirror', 'Psalm 63:8'), ('Psalm 148:8', 'mirror', 'Psalm 148:8'), ('Job 17:1', 'mirror', 'Job 17:1'), ('Job 27:19', 'mirror', 'Job 27:19'), ('Philemon 1:5', 'mirror', 'Philemon 5')], MIR),
 ('mir-c', [('Proverbs 10:23', 'mirror', 'Proverbs 10:23'), ('Isaiah 63:18', 'mirror', 'Isaiah 63:18'), ('Isaiah 55:8', 'mirror', 'Isaiah 55:8'), ('Romans 10:10', 'mirror', 'Romans 10:10'), ('Romans 11:22', 'mirror', 'Romans 11:22')], SCAN),
 ('mir-d', [('Philippians 3:10', 'mirror', 'Philippians 3:10'), ('2 Samuel 23:5', 'mirror', '2 Samuel 23:5'), ('Philippians 4:8', 'mirror', 'Philippians 4:8'), ('2 Corinthians 9:6', 'mirror', '2 Corinthians 9:6'), ('Isaiah 1:6', 'mirror', 'Isaiah 1:6')], SCAN),
 ('build', [('Psalm 93:3', 'building', 'Psalm 93:3'), ('Genesis 1:1', 'synecdoche', 'Genesis 1:1'), ('Psalm 113:3', 'synecdoche', 'Psalm 113:3'), ('Proverbs 26:3', 'synecdoche', 'Proverbs 26:3')],
  'Psalm 93:3: in Hebrew the same word neharot (rivers) comes three times and the same verb three times; the BSB varies the words ("floodwaters", "rivers", "seas"), so the lines must be the BSB\'s and the original field must name the Hebrew. Keil and Delitzsch: "parallelism with reservation". Genesis 1:1, Psalm 113:3, Proverbs 26:3: a pair of opposites standing for the whole (the modern word is merism, which the note must not use: Bullinger\'s Merismus is a different figure). Write a synecdoche note only where a quotable writer says the pair stands for the whole; Keil and Delitzsch alone gives "some interpreters".'),
 ('con-a', [('Romans 10:21', 'contrast', 'Romans 10:21'), ('Genesis 39:9', 'contrast', 'Genesis 38-39'), ('Joshua 2:11', 'contrast', 'Joshua 2; 7')],
  'Romans 10:21: disobedient Israel (10:21) against whoever believes and confesses (10:9-10). Earlier cites were Poole (on Romans the words are Richard Mayo\'s), Wesley (not quotable; counts as Bengel) and Benson (on 10:18, not 10:21). Find quotable writers on 10:21 such as Barnes, Brown in JFB, Calvin or Bengel. Each side\'s who must appear in the BSB of its verses. ' + CON),
 ('con-b', [('Judges 9:6', 'contrast', 'Judges 8:22-9:6'), ('Judges 5:28', 'contrast', 'Judges 5:24-30'), ('1 Kings 18:21', 'contrast', '1 Kings 18:20-40'), ('John 4:7', 'contrast', 'John 3-4')], CON),
 ('dbl-a', [('Matthew 23:37', 'doubling', 'Matthew 23:37'), ('Luke 10:41', 'doubling', 'Luke 10:41'), ('Acts 9:4', 'doubling', 'Acts 9:4'), ('2 Samuel 18:33', 'doubling', '2 Samuel 18:33')], DBL + ' On Acts 9:4 leave out JFB, whose gloss quotes De Wette, a critic. Credit Greek wording to the Gospel writer ("in Matthew\'s Greek").'),
 ('dbl-b', [('Jeremiah 22:29', 'doubling', 'Jeremiah 22:29'), ('Genesis 22:11', 'doubling', 'Genesis 22:11'), ('Isaiah 6:3', 'doubling', 'Isaiah 6:3')], DBL + ' On Isaiah 6:3 never argue the Trinity from the threefold "holy" (Calvin warns against resting proof on it). Never the Pulpit on Jeremiah.'),
 ('iro-a', [('1 Corinthians 4:8', 'irony', '1 Corinthians 4:8'), ('Amos 4:4', 'irony', 'Amos 4:4'), ('1 Kings 22:15', 'irony', '1 Kings 22:15'), ('1 Kings 18:27', 'irony', '1 Kings 18:27')], IRO + ' Barnes on 1 Kings is George Rawlinson\'s text (resolve.py names him).'),
 ('iro-b', [('Job 12:2', 'irony', 'Job 12:2'), ('2 Corinthians 12:13', 'irony', '2 Corinthians 12:13'), ('Mark 7:9', 'irony', 'Mark 7:9'), ('Judges 10:14', 'irony', 'Judges 10:14')], IRO),
 ('imp', [('Matthew 16:6', 'implied', 'Matthew 16:6'), ('Psalm 22:16', 'implied', 'Psalm 22:16'), ('Acts 20:29', 'implied', 'Acts 20:29')], IMP),
]
KIND = {'mirror': 'parallelism', 'building': 'parallelism', 'contrast': 'contrast'}
out = []
def _main():
    for key, verses, note in B:
      vs = []
      for ref, form, catkey in verses:
          rows = rows_for(catkey) if catkey else []
          if not rows and ':' in catkey:
              rows = rows_for(catkey.split('-')[0])
          leads = [{'work': 'local study', 'snippet': f"The founder's local literary catalogue (2026-10-20), read in local copies with no page recorded: {r}"} for r in rows[:3]]
          leads.append({'work': 'local study', 'snippet': f'Local-work check (2026-11-01), the form wanted: {form}. {note}'})
          pid, kinds = existing(ref)
          vs.append({'ref': ref, 'existing_passage': pid, 'existing_kinds': kinds,
                     'candidates': [{'kind': KIND.get(form, 'figure'), 'target': form, 'writers': [], 'leads': leads}]})
      out.append({'key': f'lw28-{key}', 'verses': vs})
    json.dump(out, open(f'{W}/lw28/lw28fig.json', 'w'), ensure_ascii=False, indent=1)
    for b in out:
        print(b['key'], [(v['ref'], len(v['candidates'][0]['leads'])) for v in b['verses']])


if __name__ == '__main__':
    _main()
