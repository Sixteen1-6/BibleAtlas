export const meta = {
  name: 'verify-replacement-sources',
  description: 'Check the replacement links, shelf facts, Bible Hub commentary pages and Chrysostom reading before shipping',
  phases: [{ title: 'Verify' }],
}

const LINK = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          opens: { type: 'boolean' },
          title: { type: 'string' },
          author: { type: 'string' },
          date: { type: 'string' },
          quote: { type: 'string', description: 'a short verbatim sentence from the page that shows its stance' },
          trusts_text: { type: 'boolean', description: 'true if the page defends the Bible as fully true on this point' },
          notes: { type: 'string' },
        },
        required: ['url', 'opens', 'title', 'author', 'quote', 'trusts_text', 'notes'],
      },
    },
  },
  required: ['results'],
}

const FACTS = {
  type: 'object',
  properties: {
    facts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          verdict: { type: 'string', enum: ['confirmed', 'wrong', 'unverified'] },
          correction: { type: 'string' },
          source_url: { type: 'string' },
          quote: { type: 'string' },
        },
        required: ['claim', 'verdict', 'correction', 'source_url', 'quote'],
      },
    },
  },
  required: ['facts'],
}

const common = 'Use WebFetch (and WebSearch only if a fetch fails) to open each page yourself; never guess. Quote only words you actually saw on the page. Keep fetches few: at most 12.'

const tasks = [
  () => agent(`Open each of these pages and report title, author, date, whether it opens, one short verbatim sentence showing its stance, and whether it defends the Bible as fully true on the point:
1. https://www.thegospelcoalition.org/article/factchecker-does-abba-mean-daddy/  (expected: Glenn T. Stanton, "FactChecker: Does 'Abba' Mean 'Daddy'?", 13 May 2013; also say whether it says abba was used by adults as well as children)
2. https://www.bibleref.com/Matthew/27/Matthew-27-9.html  (expected: explains Matthew naming Jeremiah for a Zechariah quote without calling it an error)
3. https://www.thegospelcoalition.org/blogs/justin-taylor/how-could-god-command-genocide-in-the-old-testament/  (expected: Justin Taylor; give the exact title shown)
4. https://answersingenesis.org/bible-questions/are-mustard-seeds-the-smallest-or-was-jesus-wrong/  (expected author Harry F. Sanders, III)
5. https://answersingenesis.org/contradictions-in-the-bible/as-easy-as-pi/  (expected author Jason Lisle)
6. https://answersingenesis.org/bible-questions/could-jonah-have-survived-fish-belly/  (expected author Ken Ham)
${common}`, { label: 'verify:links', phase: 'Verify', schema: LINK }),

  () => agent(`Check these facts for two cards on an app's Sources shelf. For each claim, say confirmed / wrong / unverified, give the correct wording if wrong, the URL you checked and a short verbatim quote.
Answers in Genesis:
a. It is a Christian apologetics ministry founded by Ken Ham.
b. The US ministry began in 1994.
c. It is based in Petersburg, Kentucky, and runs the Creation Museum and the Ark Encounter.
d. It holds a young-earth creationist view (six literal days, earth about 6,000 years old).
e. Its statement of faith says the Bible is inerrant / without error (quote the exact wording from https://answersingenesis.org/about/faith/ or wherever the statement of faith is).
Keil and Delitzsch:
f. The Biblical Commentary on the Old Testament is by Carl Friedrich Keil and Franz Delitzsch, German Lutheran scholars; the English translation was published by T. & T. Clark, Edinburgh, between 1866 and 1891 (give the actual span you can confirm).
g. Find one free full copy of the English work online that opens (for example https://biblehub.com/commentaries/kad/ or an archive.org item, or CCEL). Give the exact URL that opens and what it shows.
h. Keil and Delitzsch held the Bible to be God's inspired word (a short quote from any reliable description of them).
${common}`, { label: 'verify:shelf facts', phase: 'Verify', schema: FACTS }),

  () => agent(`An app links to Bible Hub commentary chapter pages by this pattern: https://biblehub.com/commentaries/kad/<book>/<chapter>.htm (Keil and Delitzsch, Old Testament only) and https://biblehub.com/commentaries/jfb/<book>/<chapter>.htm (Jamieson-Fausset-Brown, whole Bible). Book slugs used: genesis, 1_samuel, songs, psalms, obadiah, malachi (chapter 4), and for jfb also philemon, 1_john, jude, revelation, 1_corinthians.
Open these exact pages and say for each whether it opens to the right commentary and chapter:
kad: genesis/1, 1_samuel/17, songs/2, psalms/119, obadiah/1, malachi/4
jfb: songs/1, philemon/1, 1_john/2, jude/1, revelation/22, 1_corinthians/15
Return each as a claim like "kad songs/2 opens Keil and Delitzsch on Song of Songs 2" with confirmed / wrong / unverified, and for any wrong one find the correct slug from Bible Hub's own index pages (https://biblehub.com/commentaries/kad/ and https://biblehub.com/commentaries/jfb/). ${common.replace('12', '16')}`, { label: 'verify:bible hub', phase: 'Verify', schema: FACTS }),

  () => agent(`Check these claims about early and later Christian writers and give a verbatim quote from a public-domain English translation (for example NPNF on ccel.org or newadvent.org) for each:
a. John Chrysostom, Homily 40 on 1 Corinthians, reads "baptized for the dead" (1 Corinthians 15:29) as meaning that new believers, before baptism, confess "I believe in the resurrection of the dead" and are baptized in that faith, so "the dead" refers to their own bodies (that is, in hope of the resurrection of the dead body).
b. Keil and Delitzsch on Jeremiah 10:11 say the verse is Chaldee (Aramaic), that it is not a gloss, that it is in the Septuagint (the Alexandrian version), and "This the Israelites are to say to the idolaters." (https://biblehub.com/commentaries/kad/jeremiah/10.htm)
c. In Matthew 1, Matthew's list of kings leaves out Ahaziah, Joash and Amaziah between Joram and Uzziah (compare 1 Chronicles 3:11-12). Confirm from any believing commentary page.
${common}`, { label: 'verify:writers', phase: 'Verify', schema: FACTS }),
]

const out = await parallel(tasks)
return out
