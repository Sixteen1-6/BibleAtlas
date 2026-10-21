# exec'd by build_ret.py (uses R, keep_rows, new_cite, done, VAULT)
# Matthew 11:23: the Isaiah 14 allusion has one own-voice writer, the Pulpit Commentary (Keener only compares
# Capernaum's pride with the king of Babylon's, and Gill and JFB only cross-reference), so it stays as
# "some interpreters" with the Pulpit cite added and a hedged text. A fulfillment note carries the passage:
# Barnes, Clarke and Ellicott each say in their own voice that the warning came true in Capernaum's ruin.
p = R['matthew-11-23']
a = p['layers'][1]
a['strength'] = 'some interpreters'
a['text'] = ("Jesus' warning may echo Isaiah's taunt against the proud king of Babylon, who said he would climb to the heavens "
             "but was brought down to Sheol, the realm of the dead. Read this way, a town raised so high by Jesus' presence would fall just as low.")
a['evidence'] = ("The Pulpit Commentary says our Lord's words are an adaptation of Isaiah's address to the king of Babylon (Isaiah 14:13-15). "
                 "Gill and Jamieson-Fausset-Brown only cross-reference the two verses.")
keep_rows(p)
new_cite(p, 1, 'pulpit', 'Matthew 11:23',
         "Observe that our Lord's words are an adaptation of Isaiah's address to the King of Babylon (Isaiah 14:13-15).",
         'https://biblehub.com/commentaries/pulpit/matthew/11.htm')
p['layers'].append({
    'kind': 'fulfillment',
    'strength': 'widely agreed',
    'refs': ['Matthew 11:23', 'Matthew 11:24'],
    'words': [{'ref': 'Matthew 11:23', 'strong': 'G2584'}, {'ref': 'Matthew 11:23', 'strong': 'G2597'}],
    'evidence': ("Barnes says this was strictly fulfilled, the town so desolated that its site was hard to fix; Clarke says the prediction "
                 "was literally fulfilled; Ellicott says the words had an almost literal fulfilment, a few conjectured ruins marking the site. "
                 "Barnes and Clarke date the ruin to the Roman wars, which the town outlived, so the note gives no date."),
    'cites': [],
    'text': ("Jesus' warning came true in history as well. The prosperous lakeside town later fell into ruin, and by the 1800s so little "
             "was left that its very site was hard to identify. Its full reckoning still waits for the day of judgment."),
})
i = len(p['layers']) - 1
new_cite(p, i, 'barnes', 'Matthew 11:23',
         'This has been strictly fulfilled. In the wars between the Jews and the Romans, Chorazin, Bethsaida, Capernaum, etc., were so completely desolated that it is difficult to determine their former situation.',
         f'{VAULT}/barnes/mat011.md')
new_cite(p, i, 'clarke', 'Matthew 11:23',
         'This prediction of our Lord was literally fulfilled; for, in the wars between the Romans and the Jews, these cities were totally destroyed',
         f'{VAULT}/clarke/mat011.md')
new_cite(p, i, 'ellicott', 'Matthew 11:23',
         'The words point, as the next verse shows, to the ultimate abasement of the guilty city in the day of judgment, but the words have had an almost literal fulfilment. A few ruins conjecturally identified mark the site of Capernaum.',
         'https://biblehub.com/commentaries/ellicott/matthew/11.htm')
done.insert(0, p)
