import io, sys
p = sys.argv[1]
s = io.open(p, encoding='utf-8').read()
R = [
 ('"Tapping the line opens the two lines with their arcs and names the writers. In the Links panel a single link offers Study."',
  '"Under the line, in smaller type, the three writers who name it: the sources show at Simple too, and nothing credits the app or AI.",\n          "Tapping the line opens the two lines with their arcs, what the form is in Bullinger\'s own words with the page of his 1898 book, and who names it. In the Links panel a single link offers Study."'),
 ('the Hebrew the BSB hides (one word, derekh, for both “path” and “way”) and who names it."',
  'the Hebrew the BSB hides (one word, derekh, for both “path” and “way”) and its sources: each writer who names it, linked to his page on this verse, and the form in Bullinger\'s words, linked to its page in the 1898 scan."'),
 ('"Deep adds the scholar\'s name for each form,', '"Deep adds Bullinger\'s old name for each form,'),
 ('"The nested arcs are the map\'s own grammar (two places that answer each other) drawn over the words of one verse."',
  '"Its source line: the three writers, each a link to his page on Isaiah 6, and Bullinger\'s definition of the mirror, quoted from page 299 of his 1898 book, the same page where he sets out Isaiah 6:10.",\n          "The nested arcs are the map\'s own grammar (two places that answer each other) drawn over the words of one verse."'),
 ('makes the contrast self-evident, and three writers state it."',
  'makes the contrast self-evident, and three writers state it. No old book of figures names a foil, so the card says so and rests the pair on those three writers."'),
 ('the Layers card\'s lead note at Simple, as it does today. The device itself',
  'the Layers card\'s lead note at Simple, as it does today, now with the note\'s writers named under it. The device itself'),
 ('"The Layers card here is the live one, word for word, from everyversemap.com."',
  '"The Layers card here is the live one, word for word, from everyversemap.com, with two proposed changes: each note names its writers at every level, and the line about who drafted the notes now names only what they are drawn from."'),
 ('"At Deep both cards show their sources and their review line.', '"At Deep both cards show every source with a link.'),
]
for a, b in R:
    assert s.count(a) == 1, a
    s = s.replace(a, b)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('patched', len(R))
