T = {
"isaiah-58-10": "Some see the Hebrew word nefesh (soul) used twice here in two senses. First it is the giver's own self and compassion, poured out to the hungry. Then it is the needy person, the afflicted soul who is satisfied.",
"jeremiah-32-27": "The title God of all flesh may echo how Moses addressed the LORD in the wilderness: \"the God of the spirits of all flesh.\" The God who holds every human life in His hand also holds the future of Jerusalem and her exiles.",
"ezekiel-12-10": "In Hebrew the words for burden (hammassa) and prince (hannasi) sound alike, much like saying the grief concerns the chief. Some hear the sound tying God's heavy message to the very man it is about, King Zedekiah, who would soon carry his own load into exile.",
"isaiah-16-12": "In Hebrew, appears is nirah and wearies himself is nilah, two words that differ by only one sound. Some hear a deliberate echo here, picturing Moab showing up at its shrine and only wearing itself out there.",
"isaiah-26-9": "The verb for seeks You at dawn, shicher, means to search for eagerly, and some hear in it a play on shachar, the Hebrew word for dawn: after a night of suffering, the speaker longs for God the way a sufferer longs for morning to break.",
"hosea-9-16": "The name Ephraim means fruitful; Joseph gave it because God had made him fruitful (Genesis 41:52). Some see Hosea turning the name around here: fruitful Ephraim is struck like a tree whose root has dried up, so that it cannot bear fruit.",
"habakkuk-2-18": "The closing words, idols that cannot speak, are elilim illemim in Hebrew, two words that sound almost alike. Elilim, a scornful word for idols, suggests nothings, and illemim means mute. Some hear a deliberate jingle mocking them as nothings that say nothing.",
"haggai-1-11": "The withheld dew, failed crops and drought of verses 10 and 11 may echo the warnings of the Law. Moses had said that if Israel turned from the LORD, He would shut the heavens so no rain fell and the land would not yield its produce.",
"zechariah-13-9": "God's words, ‘They are My people,’ and the people's reply, ‘The LORD is our God,’ may echo the covenant promise of the law, where God said He would walk among Israel, be their God, and make them His people (Leviticus 26:12).",
"luke-21-11": "In Luke's Greek, famines and pestilences are limoi and loimoi, two words only one letter apart. Some hear the sound pair as making the warning ring, much like saying dearths and deaths in English.",
"acts-26-18": "Paul's commission may lean on Isaiah 61:1, the passage Jesus read at Nazareth about the One anointed to free captives. As Luke quotes it, that mission includes recovery of sight to the blind (Luke 4:18), the same opening of eyes Paul is sent to bring.",
"romans-5-19": "In Paul's Greek, disobedience (parakoe) and obedience (hypakoe) are both built on the same word, akoe, hearing. Some see the matching words as setting the two men side by side: Adam failed to heed God, and Christ obeyed Him fully.",
"2-corinthians-1-13": "In Paul's Greek, read is anaginoskete and understand is epiginoskete. Both verbs grow from the same root for knowing (ginosko), so the two words sound alike. Some see a play here: what the Corinthians read with their eyes, they can also recognize as true.",
"mark-8-18": "Jesus' question may take up words from Jeremiah 5:21, where the LORD rebukes a “foolish and senseless people, who have eyes but do not see, who have ears but do not hear.” If so, He turns that old rebuke on His own dull disciples.",
"1-peter-2-9": "Peter may also echo Isaiah 43, where God calls Israel My chosen people and says, \"The people I formed for Myself will declare My praise.\" Believers in Christ are chosen for the same purpose: to proclaim the virtues of the God who called them.",
"colossians-1-15": "Calling the Son the image of God may recall Genesis 1:27, where God created man in His own image. On this reading, Adam showed that image only in part, but Christ, the second Adam, shows the invisible God perfectly.",
"revelation-15-3": "The title King of the nations, with the question about fearing God that follows, may echo Jeremiah's praise: \"Who would not fear You, O King of nations?\"",
"hebrews-4-8": "The names Joshua and Jesus are the same, and some see in their shared meaning, saviour, a picture of Jesus in Joshua. Joshua gave Israel rest from their enemies for a time in Canaan, but only Jesus gives the true and lasting rest that God promised.",
}
import json, re
notes = {n['passage']: n for n in json.load(open('/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp/recal_p2.json'))[9]}
for k, v in T.items():
    old = notes[k]['note']['text']
    qs = re.findall(r'["“‘]([^"”’]+)["”’]', old)
    missing = [q for q in qs if len(q.split()) >= 4 and q not in v]
    print(len(v), k, 'MISSING:' if missing else '', missing)
json.dump(T, open('/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad/wp/p2_9_texts.json','w'), ensure_ascii=False)
