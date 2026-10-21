export const meta = {
  name: 'shelf-site-facts',
  description: 'Research and verify facts about the 13 websites the Often asked answers link to, for Sources shelf cards',
  phases: [{ title: 'Research' }, { title: 'Verify' }],
}

const SITES = [
  ['gotquestions', 'GotQuestions', 'https://www.gotquestions.org/'],
  ['gospel-coalition', 'The Gospel Coalition', 'https://www.thegospelcoalition.org/'],
  ['bible-org', 'Bible.org', 'https://bible.org/'],
  ['catholic-answers', 'Catholic Answers', 'https://www.catholic.com/'],
  ['ligonier', 'Ligonier Ministries', 'https://www.ligonier.org/'],
  ['christianity-today', 'Christianity Today', 'https://www.christianitytoday.com/'],
  ['bibleproject', 'BibleProject', 'https://bibleproject.com/'],
  ['desiring-god', 'Desiring God', 'https://www.desiringgod.org/'],
  ['biblicaltraining', 'BiblicalTraining', 'https://www.biblicaltraining.org/'],
  ['crossexamined', 'CrossExamined', 'https://crossexamined.org/'],
  ['orthodoxwiki', 'OrthodoxWiki', 'https://orthodoxwiki.org/'],
  ['reasonable-faith', 'Reasonable Faith', 'https://www.reasonablefaith.org/'],
  ['biblical-archaeology-society', 'Biblical Archaeology Society', 'https://www.biblicalarchaeology.org/'],
]

const FACT = {
  type: 'object',
  properties: {
    value: { type: 'string', description: 'The fact, or "unknown" if no source states it' },
    sources: { type: 'array', items: { type: 'string' }, description: 'URLs where you read it (the site itself first, then others)' },
    confidence: { type: 'string', enum: ['confirmed', 'likely', 'unknown'] },
  },
  required: ['value', 'sources', 'confidence'],
}
const SITE = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    officialName: FACT,
    homepage: FACT,
    organization: { ...FACT, description: 'The organization that runs the site, and where it is based' },
    founded: { ...FACT, description: 'Year the organization or site began (say which)' },
    founders: FACT,
    tradition: { ...FACT, description: 'Its Christian tradition or stance as the site itself states it (e.g. evangelical Protestant, Reformed, Catholic, Eastern Orthodox, nondenominational), plus any statement of faith it links' },
    content: { ...FACT, description: 'What kind of material it publishes (Q&A articles, sermons, videos, magazine, courses, wiki) and who writes it (staff, volunteers, scholars, open wiki)' },
    license: { ...FACT, description: 'The license of its articles: all rights reserved, or an open license (name and version exactly)' },
    notes: { type: 'string', description: 'Anything surprising or easily gotten wrong' },
  },
  required: ['id', 'officialName', 'homepage', 'organization', 'founded', 'founders', 'tradition', 'content', 'license', 'notes'],
}

const RULES = `Use WebSearch and WebFetch. Prefer the site's own About page, statement of faith, and terms of use or copyright notice; then reliable secondary sources (Wikipedia is fine as a pointer, but confirm against the site itself where possible). Never guess: if no source states a fact, say "unknown" with confidence "unknown". Give the source URL(s) for every fact. Keep each value short and factual. Do not write marketing language.`

const groups = [SITES.slice(0, 5), SITES.slice(5, 9), SITES.slice(9)]

const results = await pipeline(
  groups,
  (g, _, i) => agent(
    `Research these websites, which a Bible study app links to as "read more" pages under hard Bible questions. For each, gather facts for a short, neutral card that tells readers who runs the site, since when, and from which Christian tradition, so they can weigh what they read.\n\nSites (id, name, homepage):\n${g.map((s) => `- ${s[0]}: ${s[1]} (${s[2]})`).join('\n')}\n\n${RULES}\n\nReturn one entry per site.`,
    { label: `research:${i + 1}`, phase: 'Research', schema: { type: 'object', properties: { sites: { type: 'array', items: SITE } }, required: ['sites'] } },
  ),
  (r, g, i) => agent(
    `You are an independent fact-checker. Another researcher gathered these facts about websites a Bible app links to. Try hard to find errors: check each fact against the site's own About, statement of faith and terms or copyright pages, and other reliable sources. Pay special attention to founding years (organization vs website), founders, the tradition or denomination stated, and the content license (exact name and version). ${RULES}\n\nFacts to check (JSON):\n${JSON.stringify(r?.sites ?? [], null, 1)}\n\nReturn, for every site, the corrected full entry (same shape), and in notes list what you changed and why, or "no changes".`,
    { label: `verify:${i + 1}`, phase: 'Verify', schema: { type: 'object', properties: { sites: { type: 'array', items: SITE } }, required: ['sites'] } },
  ),
)
return { sites: results.filter(Boolean).flatMap((r) => r.sites) }