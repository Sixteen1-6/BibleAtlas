export const meta = {
  name: 'citation-rule-audit',
  description: 'Check every source this thread cites against the Bible-believing rule, and find public-domain believing commentaries for wordplay and allusions',
  phases: [
    { title: 'Audit', detail: 'links, sites and people, answer views' },
    { title: 'Sources', detail: 'public-domain believing commentaries on GitHub' },
  ],
}

const S = '/tmp/claude-0/-home-claude-bibleatlas/8f2fa849-c61c-5244-bf9c-beef3d451f62/scratchpad'
const REPO = '/home/claude/bibleatlas'

const RULE = `THE RULE (from the project owner, Shubhanshu, verbatim): "if we can cite everything then we should keep it but cite biblical stuff like bible beleiving people who fully beleive the bible and thelogians that love god. Not people who are libratizing the bible to mean soemthing else".
How to apply it: a source PASSES when its author (or the organization behind a website) holds the Bible to be God's inspired, fully true word and writes from faith: evangelical, Reformed, Baptist, Wesleyan, conservative Lutheran or Anglican writers, Church Fathers, and Catholic or Orthodox writers who affirm Scripture's inspiration and truth (say which tradition, so the owner can see it). A source FAILS when the author or the specific page treats Scripture as erring, as myth or legend, as stitched from conflicting sources in a way that denies what the text says (documentary hypothesis, redaction criticism used to deny historicity), denies miracles, prophecy or the resurrection, dates prophecy after the events to deny prediction, says Jesus or an apostle was mistaken, or reinterprets Scripture to mean something else (for example progressive revisions of its moral teaching). Judge both the author and the specific page or work. Textual criticism by believing scholars (noting that a verse is missing from early manuscripts) is NOT by itself liberalizing. Jewish (non-Christian) commentators: report them as their own category ("Jewish, does not accept the New Testament") rather than pass or fail. Be fair and specific: quote or closely paraphrase the evidence (a statement of faith, the article's own claim) with its URL.`

const WEB = `Tools: use WebFetch and WebSearch for web pages (load them with ToolSearch first if they are deferred). The shell can reach github.com and raw.githubusercontent.com only (git ls-remote, git clone --depth 1, curl to raw.githubusercontent.com); it cannot reach other sites. Keep WebFetch calls under about 60 for your whole task; the budget is shared with other agents. Never paste long copyrighted text into your answer: short quotes (under 25 words) as evidence only. Do not modify any file in ${REPO}; you may write scratch files only under ${S}/rule/.`

const LINK_SCHEMA = {
  type: 'object',
  properties: {
    links: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          card: { type: 'string' },
          site: { type: 'string' },
          author: { type: 'string', description: 'who wrote the page, or "unsigned"' },
          verdict: { type: 'string', enum: ['pass', 'fail', 'jewish', 'unreachable'] },
          tradition: { type: 'string', description: 'evangelical, Reformed, Catholic, Orthodox, etc.' },
          evidence: { type: 'string', description: 'one or two sentences with a short quote showing why' },
          replacement: {
            type: 'object',
            description: 'only when verdict is fail or unreachable: a page by a Bible-believing author that answers the same question, which you fetched and read',
            properties: { site: { type: 'string' }, title: { type: 'string' }, url: { type: 'string' }, author: { type: 'string' }, why: { type: 'string' } },
          },
        },
        required: ['url', 'card', 'site', 'author', 'verdict', 'evidence'],
      },
    },
  },
  required: ['links'],
}

phase('Audit')
const chunks = [[0, 38], [38, 76], [76, 114]]

const linkJobs = chunks.map((chunk, i) => () => agent(
  `You are auditing links in a Bible study web app (Bible Atlas). Each link below sits under a hard Bible passage ("Hard passages" at the Deep level) and points to a page on another website that answers a question people ask about it. Check each link against the owner's rule.

${RULE}

For EACH link: fetch the page, find its author (or say unsigned), and judge the page by the rule. Note the site's own stance only if the page gives no clear signal. If a link fails or is unreachable, find a replacement page that answers the same question from a Bible-believing author, preferably on one of these sites the app already lists: GotQuestions, BibleRef, The Gospel Coalition, Bible.org, Ligonier Ministries, Desiring God, BiblicalTraining, CrossExamined, BibleProject, Answers in Genesis, Blue Letter Bible, Christian Apologetics and Research Ministry (CARM). Fetch the replacement to confirm it exists, has that title, and answers the question; give its exact title as the page shows it.

${WEB}

The links: read the JSON array in ${S}/rule/links.json (each entry: card id, the question, site, title, url) and audit entries ${chunk[0]} to ${chunk[1] - 1} (zero-based, ${chunk[1] - chunk[0]} links). Return one result per link.`,
  { label: `links-${i + 1}`, phase: 'Audit', schema: LINK_SCHEMA },
))

const PEOPLE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'shelf id or name' },
          who: { type: 'string' },
          verdict: { type: 'string', enum: ['pass', 'fail', 'mixed', 'jewish'] },
          tradition: { type: 'string' },
          evidence: { type: 'string' },
          recommendation: { type: 'string', description: 'keep, drop, or change to what, concretely' },
        },
        required: ['id', 'who', 'verdict', 'evidence', 'recommendation'],
      },
    },
  },
  required: ['items'],
}

const peopleJob = () => agent(
  `You are auditing the sources a Bible study web app (Bible Atlas, repo at ${REPO}) cites, against the owner's rule.

${RULE}

Check each of these and give a verdict with evidence and a concrete recommendation:

A. Websites the app links to. Read each site's statement of faith or about page.
 - In config/shelf.json, every work with "group" "answers" or "elsewhere" (about 20 websites: GotQuestions, The Gospel Coalition, Bible.org, Catholic Answers, Ligonier, Christianity Today, BibleProject, Desiring God, BiblicalTraining, CrossExamined, OrthodoxWiki, Reasonable Faith, Biblical Archaeology Society, BibleRef, Historical Christian Faith, Bible Hub, Sefaria). For a site whose content is mixed (a magazine, a wiki, an archaeology society), say so: "mixed".
 - Bible Hub: the app links to biblehub.com/commentaries/<book>/<c>-<v>.htm ("Older commentaries on this verse"). Fetch two or three such pages (for example https://biblehub.com/commentaries/genesis/1-1.htm and https://biblehub.com/commentaries/isaiah/7-14.htm) and list which commentaries appear on them. Name any that take liberal or critical positions (for example the Cambridge Bible for Schools and Colleges, the Expositor's Bible on the Old Testament, Meyer), with evidence. Then find whether Bible Hub (or StudyLight.org) has per-verse or per-chapter pages for a SINGLE believing commentary (for example John Gill, Keil and Delitzsch, Jamieson-Fausset-Brown, Matthew Poole, Albert Barnes) and give the exact URL pattern, checked on Genesis 1:1, Psalm 22:1 and John 1:1.
 - Sefaria: the app links to sefaria.org/<Book>.<c>.<v>?with=Commentary for "Jewish commentaries on this verse". Report what commentaries that pane offers (classical rabbis, modern academic ones) and the category.
 - The NET Bible's translators' notes (classic.net.bible.org) and Historical Christian Faith (historicalchristian.faith): stance.
B. Writers the app quotes at Deep (public domain): Thomas Aquinas' Catena Aurea (the Church Fathers on the Gospels, including Origen and writers it calls "Gloss"), Matthew Henry, John Wesley. Brief verdicts.
C. Scholars cited by the app's notes on Jesus' words in Aramaic: config/shelf.json works with "group": "scholars" (Metzger, Fitzmyer x4, James Barr, Sebastian Brock, Ken Penner, Randall Buth and Chad Pierce, Raymond E. Brown, Isaac Rabinowitz, Franz Rosenthal, Gustaf Dalman x2). For each: who the person is, the verdict, and WHAT FACT the app cites them for (search config/aramaic.json for each work's "cites" strings and read the sentence around it). For each that fails, name a Bible-believing scholar's published work that states the same fact (for example D. A. Carson's Exegetical Fallacies on "abba"), with enough detail to cite it (author, title, year, page or section if you can find it), and say how sure you are that the work says it. If none, say the fact can stand on the primary text alone or should be dropped.

${WEB}`,
  { label: 'sites-and-scholars', phase: 'Audit', schema: PEOPLE_SCHEMA },
)

const VIEW_SCHEMA = {
  type: 'object',
  properties: {
    views: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          card: { type: 'string' },
          label: { type: 'string', description: 'the view label exactly as in the file' },
          verdict: { type: 'string', enum: ['fails', 'reword'] },
          why: { type: 'string' },
          action: { type: 'string', enum: ['drop', 'replace', 'reword'] },
          replacement: {
            type: 'object',
            description: 'for replace or reword: a view held by Bible-believing interpreters, in the same plain style and length as the file',
            properties: { label: { type: 'string' }, strength: { type: 'string', enum: ['widely held', 'commonly held', 'some interpreters'] }, text: { type: 'string' }, refs: { type: 'array', items: { type: 'string' } }, held_by: { type: 'string', description: 'named Bible-believing writers who hold it, with a work each' } },
          },
        },
        required: ['card', 'label', 'verdict', 'why', 'action'],
      },
    },
    answers: {
      type: 'array',
      description: 'cards whose short "answer" text also leans on a failing view and should change',
      items: { type: 'object', properties: { card: { type: 'string' }, why: { type: 'string' }, answer: { type: 'string', description: 'the new answer text, same length and style' } }, required: ['card', 'why', 'answer'] },
    },
  },
  required: ['views', 'answers'],
}

const viewsJob = () => agent(
  `In ${REPO}/config/hard-verses.json there are 56 draft answers ("questions") to hard Bible passages, not yet live. Each has a short "answer" and two to four "views" ({label, strength, text, refs}), the main explanations Christians give, with how widely each is held.

${RULE}

The owner wants only Bible-believing explanations. Go through every view of every card. Flag a view when it presents Scripture as erring ("a slip", "named the wrong prophet"), as myth or a retold legend, as once-separate conflicting sources, as a prophecy or promise that failed ("the timing was not as expected"), or attributes it to "many scholars" in a way that leans on non-believing scholarship. For each flagged view, choose: drop it (when the card's other views already cover the believing explanations), replace it with another explanation held by Bible-believing interpreters that the card does not have yet, or reword it so that it rests on believing scholars (for example textual notes that a passage is missing from early manuscripts can stay, framed as believing scholars frame them). Name real Bible-believing writers who hold each replacement (Gleason Archer, John Haley, Norman Geisler, D. A. Carson, Craig Blomberg, Darrell Bock, Gleason Archer, R. C. Sproul, John Gill, Keil and Delitzsch, and so on, with a work each). Keep the file's plain style: short sentences, everyday words, no jargon, about the same length as the view it replaces, with Bible references in the form "Matthew 27:5". Do not flag views that are already Bible-believing. Also list any card whose short "answer" text leans on a flagged view, with a new answer of the same length and style.

Do not edit the file. Use WebSearch or WebFetch only if you need to confirm who holds a view (keep it under 20 calls).`,
  { label: 'answer-views', phase: 'Audit', schema: VIEW_SCHEMA },
)

phase('Sources')
const SRC_SCHEMA = {
  type: 'object',
  properties: {
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          work: { type: 'string' },
          author: { type: 'string' },
          believing: { type: 'string', description: 'why the author passes the rule, or a concern' },
          public_domain: { type: 'string', description: 'year and why it is public domain' },
          repo: { type: 'string' },
          commit: { type: 'string', description: 'full SHA from git ls-remote' },
          paths: { type: 'array', items: { type: 'string' } },
          format: { type: 'string', description: 'how it is keyed by verse, with a 2-line sample of one verse note as found' },
          coverage: { type: 'string' },
          license_in_repo: { type: 'string' },
          wordplay_hits: { type: 'string', description: 'how many notes mention paronomasia, play on words, pun, assonance, allusion, alludes, and a sample with its verse' },
        },
        required: ['work', 'author', 'believing', 'public_domain', 'repo', 'commit', 'paths', 'format', 'coverage'],
      },
    },
    elsewhere: {
      type: 'array',
      description: 'works found only outside GitHub (archive.org, CCEL, Wikisource): where, format, quality',
      items: { type: 'object', properties: { work: { type: 'string' }, url: { type: 'string' }, note: { type: 'string' } }, required: ['work', 'url', 'note'] },
    },
  },
  required: ['sources', 'elsewhere'],
}

const sourcesJob = () => agent(
  `Find machine-readable copies of public-domain Bible commentaries and reference works by Bible-believing writers, keyed by verse, that a build can download from GitHub pinned to a commit. The goal: gather many more plays on words (paronomasia, puns, name meanings, sound plays) and allusions (one passage alluding to another) in the Bible, each cited in the believing writer's own words.

${RULE}

Look for these, in this order of value: E. W. Bullinger, Figures of Speech Used in the Bible (1898; his catalogue of paronomasia and related figures, with verse lists) and The Companion Bible notes and appendices (1909-22); Adam Clarke's Commentary; John Gill's Exposition; Jamieson-Fausset-Brown; Keil and Delitzsch; Albert Barnes' Notes; Marvin Vincent's Word Studies; Matthew Poole; John Trapp; J. A. Bengel's Gnomon; Spurgeon's Treasury of David; the Pulpit Commentary; Ellicott; Lange; the Treasury of Scripture Knowledge; John Lightfoot's Horae Hebraicae; the Geneva Bible notes; the Scofield Reference Bible notes (1917). Search GitHub with WebSearch (for example: site:github.com "gill" commentary json; "clarke" commentary sqlite github; SWORD module conversions such as "commentaries" folders in Bible app repos like lets.church, bible-api repos, "MySword" or "e-Sword" conversions; the HistoricalChristianFaith/Commentaries-Database repo). For each candidate, confirm it with the shell: git ls-remote <repo> HEAD for the commit, then fetch the real file (curl https://raw.githubusercontent.com/<owner>/<repo>/<sha>/<path> | head -c 2000, or a shallow sparse clone into ${S}/rule/src/) and look at real content. For the best two or three, count how many notes contain "paronomasia", "play upon", "play on the word", "pun", "assonance", "allusion", "alludes" (grep -c) and give one real sample. Also say what license or public-domain statement the repo carries.

If Bullinger's Figures of Speech is not on GitHub, find the best full-text copy elsewhere (archive.org djvu.txt, Wikisource, CCEL, other sites) and report its URL and OCR quality; fetch one page about Paronomasia to check.

${WEB}`,
  { label: 'believing-commentaries', phase: 'Sources', schema: SRC_SCHEMA, effort: 'high' },
)

const results = await parallel([...linkJobs, peopleJob, viewsJob, sourcesJob])
const [l1, l2, l3, people, views, sources] = results
return {
  links: [l1, l2, l3].filter(Boolean).flatMap((r) => r.links),
  people: people && people.items,
  views,
  sources,
}
