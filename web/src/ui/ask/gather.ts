// Ask the Bible, for any question: gather the verses that speak to it, with
// no words of ours. Nothing here interprets or writes; it only finds and ranks.
//
// 1. The question's own words are the concepts, each with its other forms
//    ("die": dies, died, dying) and the words the Bible uses for it ("die":
//    death, dead; "worry": anxious, troubled). Small words are left out.
// 2. Three signals point to verses:
//    - the BSB text: verses that hold the concepts, rare words counting more;
//    - Nave's Topical Bible, as an index: subjects named by the concepts;
//    - questions prepared with the same words, and their wider sets.
// 3. Verses that hold all the concepts, sit in a matching subject, and are
//    cross-referenced by the other verses found rank first: the Bible
//    pointing to itself.
//
// The words that carry the question are highlighted in each verse, so what
// matters stands out.

import type { Atlas } from '../../data/atlas';
import { loadPlainText, plainText } from '../../data/plain';
import { tokens } from '../../data/search';
import { loadJson } from '../extras/data';
import { type AskIndex, type Range, contentWords, loadAsk, sameWord, stem, topicData } from './ask';

/** Plain English -> the words the BSB uses for it. Search mechanics only: each
 * entry adds words to look for; every verse found is shown as it stands. */
const BIBLE_WORDS: Record<string, string[]> = {
  die: ['death', 'dead', 'died', 'dies'],
  dying: ['death', 'dead', 'die'],
  dead: ['death', 'die', 'died'],
  death: ['die', 'died', 'dead'],
  afterlife: ['resurrection', 'eternal'],
  afraid: ['fear', 'afraid'],
  scared: ['fear', 'afraid'],
  fear: ['afraid'],
  anxious: ['anxiety', 'worry', 'troubled'],
  anxiety: ['anxious', 'worry', 'troubled'],
  worry: ['anxious', 'anxiety', 'worry'],
  worried: ['anxious', 'worry'],
  angry: ['anger', 'wrath'],
  anger: ['angry', 'wrath'],
  mad: ['anger', 'angry'],
  sad: ['sorrow', 'grief', 'downcast', 'mourn'],
  depressed: ['despair', 'downcast', 'sorrow', 'brokenhearted'],
  depression: ['despair', 'downcast', 'sorrow', 'brokenhearted'],
  hopeless: ['hope', 'despair'],
  lonely: ['alone', 'forsaken', 'lonely'],
  loneliness: ['alone', 'forsaken', 'lonely'],
  grief: ['grieve', 'mourn', 'sorrow', 'weep'],
  grieving: ['grief', 'mourn', 'sorrow', 'weep'],
  money: ['money', 'wealth', 'riches', 'rich'],
  rich: ['riches', 'wealth'],
  wealth: ['riches', 'rich'],
  heaven: ['heaven', 'heavens', 'paradise'],
  hell: ['hell', 'hades', 'sheol', 'fire'],
  saved: ['salvation', 'save', 'savior'],
  save: ['salvation', 'saved', 'savior'],
  salvation: ['saved', 'save', 'savior'],
  sin: ['sins', 'sinned', 'iniquity', 'transgression'],
  sins: ['sin', 'iniquity', 'transgressions'],
  forgive: ['forgiveness', 'forgiven', 'forgives', 'forgave'],
  forgiveness: ['forgive', 'forgiven'],
  marriage: ['married', 'marry', 'wife', 'husband'],
  married: ['marriage', 'marry', 'wife', 'husband'],
  marry: ['marriage', 'married'],
  sex: ['immorality', 'adultery', 'marriage'],
  alcohol: ['wine', 'drunk', 'drunkenness', 'drink'],
  drinking: ['wine', 'drunk', 'drunkenness'],
  drunk: ['drunkenness', 'wine'],
  pray: ['prayer', 'prayed', 'prays'],
  prayer: ['pray', 'prayed'],
  work: ['labor', 'toil', 'work'],
  job: ['work', 'labor'],
  kids: ['children', 'child'],
  children: ['child', 'son', 'daughter'],
  parents: ['father', 'mother'],
  friend: ['friends', 'companion'],
  friendship: ['friend', 'friends', 'companion'],
  lie: ['lying', 'liar', 'deceit', 'false'],
  lying: ['lie', 'liar', 'deceit'],
  gossip: ['gossip', 'slander'],
  pride: ['proud', 'arrogant', 'haughty'],
  proud: ['pride', 'arrogant', 'haughty'],
  humble: ['humility', 'lowly', 'humbled'],
  humility: ['humble', 'lowly'],
  jealous: ['jealousy', 'envy'],
  jealousy: ['jealous', 'envy'],
  envy: ['jealousy', 'jealous'],
  poor: ['needy', 'poverty', 'poor'],
  poverty: ['poor', 'needy'],
  justice: ['just', 'oppressed', 'righteousness'],
  heal: ['healed', 'healing', 'sick'],
  healing: ['heal', 'healed', 'sick'],
  sick: ['sickness', 'heal', 'healed'],
  sickness: ['sick', 'heal', 'disease'],
  tempted: ['temptation', 'tempt'],
  temptation: ['tempted', 'tempt'],
  doubt: ['doubt', 'unbelief'],
  doubts: ['doubt', 'unbelief'],
  angels: ['angel'],
  angel: ['angels'],
  satan: ['devil', 'satan'],
  devil: ['satan', 'devil'],
  happy: ['joy', 'glad', 'rejoice', 'blessed'],
  happiness: ['joy', 'glad', 'rejoice'],
  joy: ['rejoice', 'glad'],
  suffering: ['suffer', 'affliction', 'trial', 'trouble'],
  suffer: ['suffering', 'affliction', 'trial'],
  pain: ['suffering', 'affliction', 'trouble'],
  creation: ['create', 'created', 'beginning'],
  created: ['create', 'creation', 'beginning'],
  purpose: ['purpose', 'plan', 'plans'],
  eternal: ['eternal', 'everlasting'],
  everlasting: ['eternal'],
  baptism: ['baptized', 'baptize'],
  baptized: ['baptism', 'baptize'],
  repent: ['repentance', 'repented'],
  repentance: ['repent'],
  grace: ['grace', 'gracious'],
  faith: ['believe', 'believes', 'faith'],
  believe: ['faith', 'believes'],
  trust: ['trust', 'faith', 'refuge'],
  enemies: ['enemy', 'enemies'],
  enemy: ['enemies'],
  neighbor: ['neighbor', 'neighbors'],
  giving: ['give', 'gave', 'generous', 'tithe'],
  tithe: ['tithe', 'tithes', 'tenth'],
  sabbath: ['sabbath', 'rest'],
  judgment: ['judge', 'judged', 'judgment'],
  resurrection: ['raised', 'rise', 'resurrection'],
  // Today's words for what the BSB names otherwise.
  mom: ['mother'],
  mum: ['mother'],
  dad: ['father'],
  baby: ['infant', 'infants', 'child died', 'stillborn'],
  babies: ['infant', 'infants', 'child died', 'stillborn'],
  teenager: ['youth', 'young'],
  teenagers: ['youth', 'young'],
  teen: ['youth', 'young'],
  boss: ['master', 'masters'],
  employer: ['master', 'masters'],
  coworkers: ['neighbor', 'one another'],
  christian: ['believers'],
  christians: ['believers'],
  pastor: ['overseer', 'overseers'],
  pastors: ['overseer', 'overseers'],
  government: ['authorities', 'rulers', 'governing'],
  immigrant: ['foreigner', 'foreigners', 'strangers'],
  immigrants: ['foreigner', 'foreigners', 'strangers'],
  refugees: ['foreigner', 'foreigners', 'strangers'],
  foreigners: ['foreigner', 'strangers'],
  orphans: ['fatherless'],
  orphan: ['fatherless'],
  racism: ['favoritism', 'partiality', 'every nation', 'jew greek'],
  prejudice: ['favoritism', 'partiality'],
  sorry: ['repent', 'repents', 'repentance'],
  apologize: ['confess', 'reconciled'],
  patient: ['patience', 'patiently', 'perseverance'],
  patience: ['patient', 'patiently', 'perseverance'],
  conflict: ['quarrel', 'quarrels', 'strife', 'dispute'],
  arguing: ['quarrel', 'quarrels', 'strife'],
  complain: ['grumble', 'grumbling', 'complaining'],
  complaining: ['grumble', 'grumbling', 'complain'],
  single: ['unmarried'],
  punish: ['punishment', 'discipline'],
  punishment: ['punish', 'discipline'],
  bullied: ['taunt', 'mocked', 'mistreated', 'oppressed'],
  bullying: ['taunt', 'mocked', 'mistreated', 'oppressed'],
  thankful: ['thanks', 'thanksgiving'],
  grateful: ['thanks', 'thanksgiving', 'thankful'],
  gratitude: ['thanks', 'thanksgiving', 'thankful'],
  dress: ['clothing', 'adorn', 'apparel', 'modesty'],
  clothes: ['clothing', 'adorn', 'apparel'],
  overthinking: ['anxious', 'anxiety', 'worry'],
  stress: ['anxious', 'anxiety', 'troubled', 'weary'],
  stressed: ['anxious', 'anxiety', 'troubled', 'weary'],
  communion: ['supper', 'participation', 'remembrance'],
  addiction: ['mastered', 'slave sin', 'slaves sin', 'self control', 'enslaved'],
  addicted: ['mastered', 'slave sin', 'slaves sin', 'self control', 'enslaved'],
  problems: ['trouble', 'troubles'],
  problem: ['trouble', 'troubles'],
  porn: ['immorality', 'lust', 'lustful', 'impurity'],
  pornography: ['immorality', 'lust', 'lustful', 'impurity'],
  lazy: ['slacker', 'sluggard', 'idle', 'laziness'],
  laziness: ['slacker', 'sluggard', 'idle', 'lazy'],
  innocent: ['blameless', 'innocent'],
  failure: ['fail', 'weakness'],
  worthless: ['worth', 'valuable', 'precious'],
  distant: ['far', 'near'],
  closer: ['near', 'draw near'],
  tired: ['weary', 'faint', 'rest'],
  exhausted: ['weary', 'faint', 'rest'],
  burnout: ['weary', 'faint', 'rest'],
  greedy: ['greed', 'covet', 'covetous'],
  greed: ['greedy', 'covet', 'covetous'],
  pets: ['animal', 'animals', 'beasts'],
  pet: ['animal', 'animals', 'beasts'],
  horoscopes: ['astrologers', 'divination', 'diviners', 'sorcery', 'mediums'],
  astrology: ['astrologers', 'divination', 'diviners', 'sorcery', 'mediums'],
  psychics: ['mediums', 'spiritists', 'divination'],
  guilty: ['guilt', 'conscience'],
  guilt: ['guilty', 'conscience'],
  ashamed: ['shame', 'disgrace'],
  content: ['contentment'],
  contentment: ['content'],
  ghosts: ['mediums', 'spiritists', 'spirit dead'],
  insults: ['insult', 'revile', 'reviled', 'retaliate'],
  insulted: ['insult', 'revile', 'reviled', 'retaliate'],
  betrayal: ['betray', 'betrayed', 'treacherous'],
  betrayed: ['betray', 'treacherous'],
  borrow: ['borrower', 'lend', 'debt', 'debts'],
  debt: ['debts', 'borrower', 'owe', 'lender'],
  cheated: ['adultery', 'unfaithful', 'faithless'],
  affair: ['adultery', 'unfaithful'],
  homosexuality: ['homosexual', 'homosexuals', 'natural relations'],
  gay: ['homosexual', 'homosexuals', 'natural relations'],
  lesbian: ['homosexual', 'homosexuals', 'natural relations'],
  lied: ['lie', 'lies', 'slander', 'false witness'],
  denominations: ['divisions', 'factions', 'follow paul', 'one body'],
  drugs: ['drunk', 'drunkenness', 'sober', 'self control'],
  drug: ['drunk', 'drunkenness', 'sober', 'self control'],
  date: ['marry', 'married', 'yoked'],
  dating: ['marry', 'married', 'yoked'],
  environment: ['earth lords', 'cultivate keep', 'creation groaning'],
  reliable: ['trustworthy', 'flawless'],
  decision: ['plans', 'counsel', 'guide'],
  decisions: ['plans', 'counsel', 'guide'],
  hard: ['hardship', 'hardships', 'trials', 'affliction', 'trouble'],
  insomnia: ['sleep', 'sleepless'],
  calm: ['peace', 'quiet', 'still'],
};

/** Words whose own sense in the BSB is another thing: only the Bible's words
 * for them are looked for ("worthless" finds worth and precious, not
 * worthless idols). */
const INSTEAD = new Set(['worthless', 'distant', 'christian', 'christians', 'hard', 'failure', 'problems', 'problem', 'single', 'date', 'dating', 'smoking', 'vaping']);

/** Phrases of a question and the Bible's words for them; their words are not
 * then looked for one by one ("share my faith" is not "share" and "faith"). */
const PHRASES: [RegExp, string[]][] = [
  [/\b(share|sharing|spread|tell (people|others) about) (my |our |your |the )?(faith|gospel|jesus)\b/, ['preach', 'proclaim', 'good news', 'my witnesses', 'reason hope', 'testify']],
  [/\bdifficult (person|people)\b/, ['quarrelsome', 'contentious', 'hot tempered']],
  [/\b((break|breaking|quit|kick|stop|beat) (a |my |the |this )?)?(bad )?habits?\b/, ['mastered', 'old self', 'former way']],
  [/\bloved ones?\b/, ['fallen asleep', 'asleep']],
  [/\bend times\b/, ['last days', 'end age']],
  [/\b(death penalty|capital punishment)\b/, ['surely put death', 'sheds blood', 'carry sword']],
  [/\bmake peace\b/, ['reconciled', 'reconcile', 'peacemakers', 'live peace']],
  [/\bsame sex\b/, ['homosexual', 'homosexuals', 'natural relations']],
  [/\bfar from god\b/, ['hide face', 'forsaken', 'near']],
  [/\bnever heard\b/, ['ignorance', 'not heard']],
  [/\b(cannot|can ?not|cant) sleep\b/, ['sleep', 'sleepless']],
  [/\bgod (make|made|create|created) (me|us|people|humans|humanity|man|mankind)\b/, ['created', 'formed', 'make man', 'my glory']],
  [/\b(life is|life gets|times are|going through) (so )?(hard|difficult|tough)\b|\b(hard|difficult|tough) times\b/, ['trials', 'affliction', 'hardship', 'hardships', 'trouble', 'troubles', 'distress']],
  [/\blife (begin|begins|start|starts)\b/, ['womb', 'conceived', 'knit']],
  [/\bnon[- ]?(christians?|believers?)\b|\bunbelievers?\b/, ['unbeliever', 'unbelievers', 'unbelieving', 'yoked']],
  [/\bold testament\b/, ['scripture', 'scriptures', 'law prophets', 'written instruction']],
  [/\bspiritual (battles?|warfare|war|attacks?)\b/, ['struggle', 'armor', 'schemes', 'strongholds']],
  [/\bfruits? of the spirit\b/, ['fruit spirit']],
  [/\b(speaking|speak|speaks) in tongues\b/, ['speaks tongue', 'speak tongues', 'interpretation tongues', 'other tongues']],
  [/\b(who wrote|writers? of|authors? of|wrote) (the )?(bible|scriptures?)\b/, ['god breathed', 'carried along', 'scripture']],
  [/\b(hate|loathe|cant stand) myself\b/, ['fearfully wonderfully', 'hated own body', 'precious', 'worth more']],
  [/\b(love|loving) god\b/, ['love lord god', 'love me keep', 'love god']],
  [/\bwhat is love\b|\b(real|true|genuine) love\b/, ['love is', 'love patient', 'greater love', 'this is love']],
  [/\bfind (a |my )?(wife|husband|spouse)\b/, ['finds wife', 'prudent wife']],
  [/\bsave (my |our |a )?marriage\b/, ['one flesh', 'husbands love', 'wives submit', 'forgiving']],
  [/\bwhere is jesus( now)?\b/, ['right hand', 'seated', 'intercede', 'ascended']],
  [/\b(manage|use|spend|spending|using) (my |our )?time\b/, ['number days', 'redeeming time', 'teach number']],
  [/\b(people|everyone|men|humans|races|all) (as |are )?equal\b/, ['favoritism', 'partiality', 'every nation', 'jew greek']],
  [/\bhear (from )?god( speak| speaking)?\b|\bgod( voice| speak| speaking| speaks)( to (me|us))?\b/, ['sheep listen voice', 'hears my voice', 'speak servant listening', 'hear word']],
  [/\b(not|never) (good|smart|strong|holy|worthy) enough\b/, ['grace sufficient', 'competent', 'weakness', 'worthy']],
  // To raise a child is not to raise the dead.
  [/\b(raise|raising|bring up|bringing up) (my |our |a |the |your )?(kids|children|child|sons?|daughters?|teenagers?|teens?|family)\b/, ['train', 'instruction', 'discipline', 'children']],
];

export interface Gathered {
  /** Ranked, most direct first. */
  verses: number[];
  /** The BSB words that carry the question, for highlighting. */
  marks: Set<string>;
  /** The question's concepts and the words looked for under each, for Deep. */
  concepts: { word: string; forms: string[]; found: number }[];
  /** Nave's subjects and prepared questions that pointed to verses, for Deep. */
  subjects: string[];
  questions: string[];
}

function lowerBound(words: string[], key: string): number {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid] < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function has(words: string[], w: string): boolean {
  return words[lowerBound(words, w)] === w;
}

const ENDS = ['', 's', 'es', 'd', 'ed', 'ing', 'e', 'ness', 'ly', 'ful'];
const ENDS_LONG = [...ENDS, 'er', 'ers'];

/** A word and the other forms of it the BSB uses: "die" -> die, dies, died, dying. */
function formsOf(words: string[], w: string, stems: boolean): string[] {
  const out = new Set<string>();
  const roots = new Set([w]);
  // "babies" -> baby, not "bab" (and so "babes"); and a stem only where an
  // ending came off, so "here" does not become "her" (and so "herd").
  const st = stem(w);
  const cut = w.slice(st.length);
  if (w.length > 4 && (w.endsWith('ied') || w.endsWith('ies'))) roots.add(`${w.slice(0, -3)}y`);
  else if (stems && st.length >= 3 && cut !== 'e' && cut !== 'y') roots.add(st);
  for (const r of roots) {
    // "teacher" from "teach", but not "Peter" from "pet" or "letter" from "let".
    const ends = r.length >= 5 ? ENDS_LONG : ENDS;
    for (const end of ends) {
      const f = r + end;
      if (has(words, f)) out.add(f);
    }
    if (r.endsWith('e') && has(words, `${r.slice(0, -1)}ing`)) out.add(`${r.slice(0, -1)}ing`);
    if (r.endsWith('y') && has(words, `${r.slice(0, -1)}ied`)) out.add(`${r.slice(0, -1)}ied`);
    if (r.endsWith('ie') && has(words, `${r.slice(0, -2)}ying`)) out.add(`${r.slice(0, -2)}ying`);
  }
  return [...out];
}

/** Verses holding any of these index words. */
function versesWith(a: Atlas, forms: string[]): Set<number> {
  const out = new Set<number>();
  for (const f of forms) {
    const i = lowerBound(a.englishWords, f);
    if (a.englishWords[i] !== f) continue;
    for (let p = a.eOff[i]; p < a.eOff[i + 1]; p++) out.add(a.eVerse[p]);
  }
  return out;
}

function addRanges(set: Set<number>, rs: Range[], cap = 4000): void {
  for (const [s, e] of rs) for (let v = s; v <= e && set.size < cap; v++) set.add(v);
}

/** Verses that teach rather than tell a story weigh a little more: a question
 * is usually after what the Bible says, more than where a word occurs. */
const TEACHING: Record<string, number> = {
  wisdom: 0.3,
  pauline: 0.3,
  general: 0.3,
  gospels: 0.25,
  'major-prophets': 0.1,
  'minor-prophets': 0.1,
  apocalyptic: 0.1,
};

/** A Nave's subject with more verses than this is too wide to point to an answer. */
const WIDE_SUBJECT = 1500;

/** The most verses lit and listed for one question. */
const MAX = 400;

interface Concept {
  word: string;
  /** The BSB words looked for. */
  forms: string[];
  /** Words that name a Nave's subject for it, as they are or in another form. */
  names: string[];
  /** The Bible's words for it, which name a subject only as they are:
   * "patience" names Patience, "mastered" does not name Master. */
  exact: string[];
  /** Its Bible phrases, which name a subject only whole: "self control"
   * names Self-control, "right hand" does not name Hand. */
  phrases: string[][];
  /** Words to highlight. */
  marks: string[];
  found: Set<number>;
}

/** One thing the question asks about: its own word and the Bible's words for
 * it. A Bible word with a space is a phrase, found where all its words are. */
function concept(a: Atlas, word: string, bible: string[], own: boolean): Concept {
  const ownForms = own ? formsOf(a.englishWords, word, true) : [];
  const forms = new Set(ownForms);
  const exact: string[] = [];
  const phrases: string[][] = [];
  // The Bible's words are chosen as they are, so no stems: "mastered" is not "master".
  for (const x of bible) {
    if (x.includes(' ')) phrases.push(x.split(' '));
    else {
      exact.push(x);
      for (const f of formsOf(a.englishWords, x, false)) forms.add(f);
    }
  }
  const found = versesWith(a, [...forms]);
  const marks = new Set(forms);
  for (const ps of phrases) {
    const sets = ps.map((p) => versesWith(a, [p]));
    for (const v of sets[0]) if (sets.every((vs) => vs.has(v))) found.add(v);
    ps.forEach((p, i) => {
      // "love the LORD your God": "love" marks the verse, "God" says little.
      if (sets[i].size < COMMON && contentWords(p).length) marks.add(p);
    });
  }
  return { word, forms: [...forms], names: own ? [word, ...ownForms] : [], exact, phrases, marks: [...marks], found };
}

/** Does a Nave's subject's name (its words) name this concept? */
function names(c: Concept, t: string): boolean {
  return c.names.some((w) => sameWord(w, t)) || c.exact.includes(t);
}

/** Nave's subjects named for an old sense of the word: "Boss" is a shield's
 * boss, "Pastor" the KJV's word for Jeremiah's shepherds. */
const OLD_SENSE = new Set(['Boss', 'Pastor', 'Ghost', 'Conversation', 'Prevent', 'Quick', 'Meat']);

/** A word in more verses than this says little about one question. */
const COMMON = 2000;

export async function gather(a: Atlas, question: string): Promise<Gathered> {
  const [ix] = await Promise.all([loadAsk(a), loadPlainText(a).catch(() => null)]);
  // "God's voice" is God's, not "gods".
  let rest = question
    .toLowerCase()
    .replace(/\bgod['’]s\b/g, 'god')
    .replace(/[’‘']/g, '');
  const phrases: { word: string; bible: string[] }[] = [];
  for (const [re, bible] of PHRASES) {
    const m = rest.match(re);
    if (!m) continue;
    phrases.push({ word: m[0].trim(), bible });
    rest = rest.replace(re, ' ');
  }
  const ws = [...new Set(contentWords(rest))].slice(0, Math.max(0, 8 - phrases.length));
  const n = a.n;

  // 1. Concepts and the BSB words for each.
  const concepts = [
    ...phrases.map((p) => concept(a, p.word, p.bible, false)),
    ...ws.map((w) => concept(a, w, BIBLE_WORDS[w] ?? BIBLE_WORDS[stem(w)] ?? [], !INSTEAD.has(w))),
  ];

  // 2. Nave's subjects named by the concepts: each word of a subject's name is
  // a concept's word or a form of one ("treat" does not name "Treaty"). A
  // subject as wide as "God" says little about one question.
  const subjects: { i: number; title: string; covers: number[] }[] = [];
  ix.topics.forEach(([title, size], i) => {
    const ts = contentWords(title);
    if (!ts.length || ts.length > 2 || size > WIDE_SUBJECT || OLD_SENSE.has(title)) return;
    const whole = concepts.findIndex((c) => c.phrases.some((ps) => ps.length === ts.length && ps.every((p, j) => sameWord(p, ts[j]))));
    if (whole >= 0) {
      subjects.push({ i, title, covers: [whole] });
      return;
    }
    const covers = new Set<number>();
    for (const t of ts) {
      const k = concepts.findIndex((c) => names(c, t));
      if (k < 0) return;
      covers.add(k);
    }
    subjects.push({ i, title, covers: [...covers] });
  });
  // Those that cover most of the question, then the largest.
  subjects.sort((x, y) => y.covers.length - x.covers.length || ix.topics[y.i][1] - ix.topics[x.i][1]);
  const chosen = subjects.slice(0, 4);
  const qs = matchingQuestions(ix, ws);
  const [topicSets, questionSets] = await Promise.all([
    Promise.all(chosen.map((s) => topicData(a, s.i).catch(() => null))),
    Promise.all(qs.map((q) => loadJson<{ v: Range[] }>(a, `ask/q/${q.id}.json`).catch(() => null))),
  ]);

  // A verse Nave's lists under a subject holds that subject's concepts, as a
  // verse that says the word does.
  const reach = concepts.map((c) => new Set(c.found));
  const inTopic = new Set<number>();
  const cited = new Set<number>();
  topicSets.forEach((t, k) => {
    if (!t) return;
    // Not where Nave's uses the subject as a figure.
    const fig = new Set<number>();
    addRanges(fig, t.f ?? []);
    const lit = new Set<number>();
    addRanges(lit, t.v);
    for (const v of lit) {
      if (fig.has(v)) continue;
      inTopic.add(v);
      for (const c of chosen[k].covers) reach[c].add(v);
    }
    addRanges(cited, t.top);
  });
  // A prepared question with these words only leans toward its verses: its
  // wider set is about its own question, which may not be the reader's.
  for (const set of questionSets) if (set) addRanges(inTopic, set.v);
  for (const q of qs) addRanges(cited, q.top);

  // 3. How much of the question each verse holds, rarer concepts counting more.
  const usable = concepts.map((_, i) => i).filter((i) => reach[i].size > 0 && reach[i].size < n * 0.2);
  const idf = new Map(usable.map((i) => [i, Math.log(1 + n / reach[i].size)]));
  const mass = [...idf.values()].reduce((x, y) => x + y, 0) || 1;
  const text = new Map<number, number>();
  for (const i of usable) for (const v of reach[i]) text.set(v, (text.get(v) ?? 0) + idf.get(i)! / mass);

  // Candidates: verses that hold enough of the question (all of it when it has
  // one or two concepts). When too few hold that much, the closest come back.
  const cands = new Set<number>();
  let floor = usable.length <= 2 ? 0.99 : 0.75;
  for (;;) {
    for (const [v, s] of text) if (s >= floor) cands.add(v);
    if (cands.size >= 12 || floor < 0.3) break;
    floor -= 0.2;
  }

  const marks = new Set<string>();
  for (const i of usable) for (const f of concepts[i].marks) marks.add(f);
  const texts = plainText();
  const score = new Map<number, number>();
  for (const v of cands) {
    // A verse that is about the question, not one that only mentions it in passing.
    let dense = 0;
    const t = texts?.[v];
    if (t) {
      const toks = tokens(t);
      const hits = toks.filter((w) => marks.has(w)).length;
      dense = toks.length ? Math.min(1, (hits / toks.length) * 6) : 0;
    }
    const genre = TEACHING[a.books[a.verseBook[v]].genre] ?? 0;
    // How much of the question a verse holds comes first.
    score.set(v, 3.5 * (text.get(v) ?? 0) + (inTopic.has(v) ? 0.6 : 0) + (cited.has(v) ? 0.6 : 0) + 0.5 * a.rank[v] + 0.6 * dense + genre);
  }

  // The Bible pointing to itself: links among the best candidates count.
  const best = [...cands].sort((x, y) => score.get(y)! - score.get(x)! || x - y).slice(0, 200);
  const inBest = new Set(best);
  for (const v of best) {
    let links = 0;
    for (let e = a.xOff[v]; e < a.xOff[v + 1]; e++) if (a.xVotes[e] >= 2 && inBest.has(a.xDst[e])) links++;
    for (let k = a.xInOff[v]; k < a.xInOff[v + 1]; k++) {
      const e = a.xInEdge[k];
      if (a.xVotes[e] >= 2 && inBest.has(a.xSrc[e])) links++;
    }
    score.set(v, score.get(v)! + 0.15 * Math.min(links, 6));
  }
  const verses = [...cands].sort((x, y) => score.get(y)! - score.get(x)! || x - y).slice(0, MAX);

  return {
    verses,
    marks,
    concepts: concepts.map((c, i) => ({ word: c.word, forms: c.forms, found: reach[i].size })),
    subjects: chosen.map((s) => s.title),
    questions: qs.map((q) => q.q),
  };
}

function matchingQuestions(ix: AskIndex, ws: string[]) {
  const stems = ws.map(stem);
  return ix.questions.filter((q) => {
    const qs = new Set([q.q, ...q.also].flatMap((x) => contentWords(x).map(stem)));
    const hits = stems.filter((s) => qs.has(s)).length;
    return stems.length > 0 && hits >= Math.max(1, Math.ceil(stems.length * 0.6));
  });
}
