// The words questions are matched by: search's question words, and the terms
// Ask the Bible matches what someone typed by. The build's meaning matcher
// (web/scripts/ask-meaning.mjs) reads text with these same words, so this
// file imports nothing and never touches the page.

export const QUESTION_WORDS = new Set([
  'who',
  'what',
  'whats',
  'why',
  'how',
  'is',
  'are',
  'was',
  'does',
  'do',
  'did',
  'can',
  'could',
  'will',
  'would',
  'should',
  'where',
  'when',
  'which',
  'may',
  'am',
  'shall',
]);
export const STOP = new Set([
  ...QUESTION_WORDS,
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'about',
  'at',
  'by',
  'from',
  'it',
  'its',
  'be',
  'been',
  'being',
  'i',
  'me',
  'my',
  'we',
  'us',
  'our',
  'you',
  'your',
  'he',
  'his',
  'him',
  'she',
  'her',
  'they',
  'them',
  'their',
  'that',
  'this',
  'there',
  'here',
  'bible',
  'scripture',
  'scriptures',
  'say',
  'says',
  'said',
  'tell',
  'teach',
  'teaches',
  'mean',
  'means',
  'verse',
  'verses',
  'really',
  'ok',
  'okay',
  'if',
  'so',
  'then',
  'than',
  'as',
  'into',
  'up',
  'out',
  'any',
  'some',
  'all',
  'just',
  'get',
  'go',
  'have',
  'has',
  'had',
  'way',
  'happen',
  'happens',
  'like',
  'meaning',
  'thing',
  'things',
  'someone',
  'something',
  'people',
  'person',
  'not',
  'no',
  'yes',
  // Words of asking rather than of the subject: "how do I deal with worry", "is it wrong to be angry".
  'deal',
  'handle',
  'cope',
  'overcome',
  'beat',
  'stop',
  'find',
  'help',
  'make',
  'feel',
  'use',
  'know',
  'wrong',
  'right',
  'allowed',
  'possible',
  'best',
  'ever',
  'really',
  'still',
  'even',
  'too',
  'also',
  'much',
  'many',
  'treat',
  'let',
  'see',
  'care',
  'real',
  'anything',
  'everything',
  'more',
  'ones',
  'supposed',
  'myself',
  'yourself',
  'ourselves',
  'themselves',
  'himself',
  'herself',
]);

export function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’‘']/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** A rough stem, so "prayers", "praying" and "prayed" meet "prayer"/"pray". */
export function stem(w: string): string {
  for (const end of ['ness', 'ing', 'ies', 'ied', 'es', 'ed', 'ly', 's', 'y', 'e']) {
    if (w.length > end.length + 2 && w.endsWith(end)) return w.slice(0, -end.length);
  }
  return w;
}

/** The words of a question that carry it: "what happens when we die" -> happens, die. */
export function contentWords(s: string): string[] {
  return words(s).filter((w) => !STOP.has(w));
}

/** Words too plain to tell one question from another. */
const PLAIN = new Set(['bible', 'want', 'need', 'feel', 'feeling', 'keep', 'going', 'doing', 'done', 'now', 'got', 'gets', 'getting', 'said', 'told', 'tells', 'every', 'always', 'never', 'today', 'last', 'week', 'year', 'years', 'day', 'days', 'time', 'times', 'good', 'bad', 'okay', 'life', 'lot', 'lots', 'dont', 'doesnt', 'didnt', 'cant', 'wont', 'isnt', 'im', 'ive', 'id', 'ill', 'its', 'thats', 'cannot', 'actually', 'already', 'anymore', 'basically', 'literally', 'honestly', 'seriously', 'kinda', 'idk', 'lol', 'but', 'were', 'wasnt', 'werent', 'because', 'stuff', 'somebody', 'guy', 'guys', 'think']);

/** Words that ask the same thing here: "we buried our son" tells of a child
 * who died, as "my daughter passed" would. Each group counts as its first
 * word. Words with a second sense stay out ("work", "father", "cheating",
 * "passed", "pills"). */
const SAME = new Map<string, string>();
for (const group of [
  'die died dies dying dead death deaths buried burial funeral deceased',
  'child children son sons daughter daughters kid kids baby babies infant infants toddler newborn',
  'mom mum mother mommy dad daddy parent parents',
  'spouse husband husbands wife wives hubby',
  'grandparent grandparents grandma grandpa grandmother grandfather granny nana',
  'grandchild grandchildren grandson granddaughter grandkids',
  'sibling siblings brother sister',
  'drugs meth heroin opioids opioid fentanyl cocaine oxy',
  'alcohol alcoholic drinking drunk booze',
  'fired layoff layoffs laidoff',
  'job jobs career employment',
  'affair unfaithful adultery',
  'sick sickness illness disease diagnosis diagnosed',
  'anxiety anxious worry worried worrying worries panic',
  'depressed depression',
  'miscarriage miscarried stillbirth stillborn',
  'gay lesbian homosexual homosexuality lgbt lgbtq bisexual queer',
  'transgender trans nonbinary',
  'porn pornography',
  'afraid scared fear fears fearful terrified frightened',
  'lonely loneliness alone isolated',
  'angry anger mad furious rage',
  'abuse abused abusive',
  'marry married marriage',
  'divorce divorced divorcing',
  'boyfriend girlfriend fiance fiancee',
]) {
  const [head, ...rest] = group.split(' ');
  for (const w of [head, ...rest]) {
    SAME.set(w, head);
    SAME.set(stem(w), head);
  }
}

/** What `s` says, as Ask the Bible matches it: its content words less the
 * plain ones and numbers, each as its group's word or its stem. */
export function terms(s: string): Set<string> {
  return new Set(
    contentWords(s)
      .filter((w) => !PLAIN.has(w) && !PLAIN.has(stem(w)) && !/^\d+$/.test(w))
      .map((w) => SAME.get(w) ?? SAME.get(stem(w)) ?? stem(w)),
  );
}
