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

import { type Atlas, chapterRange } from '../../data/atlas';
import { loadPlainText, plainText } from '../../data/plain';
import { tokens } from '../../data/search';
import { type AskIndex, type Range, contentWords, loadAsk, questionData, sameWord, stem, topicData } from './ask';

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
  racism: ['favoritism', 'partiality', 'every nation', 'jew greek', 'one man every nation'],
  prejudice: ['favoritism', 'partiality'],
  sorry: ['repent', 'repents', 'repentance'],
  apologize: ['first reconciled', 'confess sins each other', 'repents forgive'],
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
  dress: ['adorn', 'adornment', 'apparel', 'modesty', 'modest', 'decently'],
  clothes: ['adorn', 'adornment', 'apparel', 'modesty', 'modest'],
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
  lazy: ['slacker', 'idle', 'laziness'],
  laziness: ['slacker', 'idle', 'lazy'],
  innocent: ['blameless', 'innocent'],
  failure: ['weakness', 'grace sufficient', 'fall seven times', 'flesh heart fail'],
  worthless: ['worth', 'valuable', 'precious'],
  distant: ['far', 'near'],
  closer: ['draw near', 'come near'],
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
  witch: ['sorceress', 'sorcery', 'witchcraft', 'mediums', 'spiritists'],
  witches: ['sorceress', 'sorcery', 'witchcraft', 'mediums', 'spiritists'],
  wicca: ['sorceress', 'sorcery', 'witchcraft', 'mediums', 'spiritists'],
  smoking: ['body temple holy spirit', 'not mastered', 'self control'],
  vaping: ['body temple holy spirit', 'not mastered', 'self control'],
  cigarettes: ['body temple holy spirit', 'not mastered', 'self control'],
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
  pills: ['drunk', 'drunkenness', 'sober', 'self control'],
  opioids: ['drunk', 'drunkenness', 'sober', 'self control'],
  date: ['marry', 'married', 'yoked'],
  dating: ['marry', 'married', 'yoked'],
  environment: ['earth lords', 'cultivate keep', 'creation groaning'],
  reliable: ['trustworthy', 'flawless'],
  decision: ['plans', 'counsel', 'guide'],
  decisions: ['plans', 'counsel', 'guide'],
  hard: ['hardship', 'hardships', 'trials', 'affliction', 'trouble'],
  calm: ['peace', 'quiet', 'still'],
  jobs: ['work', 'labor'],
  career: ['work', 'labor'],
  jail: ['prison', 'prisoner', 'prisoners'],
  incarcerated: ['prison', 'prisoner', 'prisoners'],
  drinks: ['drunk', 'drunkenness', 'drunkard', 'drunkards', 'strong drink'],
  drinker: ['drunk', 'drunkenness', 'drunkard', 'drunkards', 'strong drink'],
  alcoholic: ['drunk', 'drunkenness', 'drunkard', 'drunkards', 'strong drink'],
  medicine: ['physician', 'doctor'],
  medication: ['physician', 'doctor', 'medicine'],
  doctors: ['physician', 'doctor'],
  dinosaurs: ['behemoth', 'leviathan'],
  dinosaur: ['behemoth', 'leviathan'],
  reincarnation: ['appointed die once'],
  promotion: ['exaltation', 'exalts', 'humble exalted'],
  promoted: ['exaltation', 'exalts', 'humble exalted'],
  perfectionist: ['already perfect', 'grace sufficient', 'weary burdened'],
  perfectionism: ['already perfect', 'grace sufficient', 'weary burdened'],
  criticism: ['correction', 'reproof', 'loves discipline'],
  criticized: ['correction', 'reproof', 'loves discipline'],
  feedback: ['correction', 'reproof', 'loves discipline'],
  defensive: ['correction', 'reproof', 'loves discipline'],
  leader: ['leaders', 'great among servant', 'shepherd flock'],
  leaders: ['leader', 'great among servant', 'shepherd flock'],
  leadership: ['leader', 'leaders', 'great among servant', 'shepherd flock'],
  insecure: ['outward appearance', 'fearfully wonderfully', 'beauty fleeting'],
  insecurity: ['outward appearance', 'fearfully wonderfully', 'beauty fleeting'],
  overeating: ['glutton', 'gluttons', 'gorge', 'belly god', 'self control'],
  gluttony: ['glutton', 'gluttons', 'gorge', 'belly god', 'self control'],
  binge: ['glutton', 'gluttons', 'gorge', 'belly god', 'self control'],
  phone: ['redeeming time', 'number our days', 'worthless thing', 'whatever true'],
  screen: ['redeeming time', 'number our days', 'worthless thing', 'whatever true'],
  movies: ['worthless thing', 'whatever true', 'lamp eye'],
  movie: ['worthless thing', 'whatever true', 'lamp eye'],
  tv: ['worthless thing', 'whatever true', 'lamp eye'],
  television: ['worthless thing', 'whatever true', 'lamp eye'],
  secular: ['whatever true', 'world'],
  halloween: ['regards day', 'fruitless deeds darkness', 'divination'],
  stole: ['steal', 'stolen', 'thief', 'four times', 'lost property'],
  steal: ['stolen', 'thief', 'four times', 'lost property'],
  stealing: ['steal', 'stolen', 'thief', 'four times', 'lost property'],
  favored: ['favoritism', 'partiality', 'loved more'],
  favorite: ['favoritism', 'partiality', 'loved more'],
  favourite: ['favoritism', 'partiality', 'loved more'],
  race: ['every nation', 'jew greek', 'one man every nation'],
  desert: ['wilderness'],
  psychic: ['mediums', 'spiritists', 'divination'],
  tarot: ['mediums', 'spiritists', 'divination'],
};

/** Words whose own sense in the BSB is another thing: only the Bible's words
 * for them are looked for ("worthless" finds worth and precious, not
 * worthless idols). */
const INSTEAD = new Set([
  'worthless', 'distant', 'christian', 'christians', 'hard', 'failure', 'problems', 'problem', 'single', 'date', 'dating', 'smoking', 'vaping',
  // The BSB's Job is a man; its race is run.
  'job', 'jobs', 'race', 'drinks', 'drinker', 'favored', 'favorite', 'favourite',
]);

/** Words that say how or when, not what: "does praying actually change
 * anything" is about prayer, not about "actually". */
const FILLER = new Set([
  'actually', 'always', 'anymore', 'barely', 'already', 'getting', 'seriously', 'literally', 'basically', 'honestly', 'totally',
  'completely', 'simply', 'probably', 'maybe', 'perhaps', 'definitely', 'certainly', 'truly', 'constantly', 'often', 'sometimes',
  'usually', 'lately', 'recently', 'anyway', 'though', 'although', 'yet', 'else', 'every', 'each', 'other', 'others', 'over',
  'through', 'during', 'after', 'before', 'since', 'ago', 'again', 'such', 'very', 'quite', 'kind', 'sort', 'stuff',
  'somebody', 'anyone', 'anybody', 'nobody', 'everyone', 'everybody', 'nothing', 'im', 'ive', 'id', 'youre', 'dont', 'doesnt',
  'didnt', 'cant', 'cannot', 'wont', 'isnt', 'arent', 'wasnt', 'werent', 'shouldnt', 'wouldnt', 'couldnt', 'havent', 'hasnt',
  'hadnt', 'weve', 'theyre', 'thats', 'theres', 'whats', 'gonna', 'wanna', 'gotta', 'got', 'going', 'own', 'now', 'back', 'were',
  'idea', 'today', 'but', 'just', 'also', 'still',
]);

/** When someone speaks of their own life, its numbers and spans of time are
 * theirs: "for three years", "im 16", "every night". */
const PERSONAL = /\b(i|im|ive|id|me|my|mine|myself|we|weve|our|us)\b/;
const SPANS = new Set(['day', 'days', 'night', 'nights', 'week', 'weeks', 'month', 'months', 'year', 'years', 'hour', 'hours', 'morning', 'mornings']);

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** A number as the BSB writes it in words: 40 is "forty", 700 "seven hundred". */
function numberWords(n: number): string[] {
  if (n < 20) return [ONES[n]];
  if (n < 100) return [TENS[Math.floor(n / 10)], ...(n % 10 ? [ONES[n % 10]] : [])];
  if (n < 1000) return [ONES[Math.floor(n / 100)], 'hundred', ...(n % 100 ? numberWords(n % 100) : [])];
  if (n < 1_000_000) return [...numberWords(Math.floor(n / 1000)), 'thousand', ...(n % 1000 ? numberWords(n % 1000) : [])];
  return [];
}

/** A "why" question is answered by the verses that give a reason. */
const WHY = /^\s*why\b|\bwhy (did|does|do|is|was|would|are|were|should|can)\b/;
const REASON = /\b(because|so that|for this (very )?(purpose|reason)|in order (that|to)|this is why|that is why|for the sake of|that (you|they|all|he) may know)\b/i;

/** Phrases of a question and the Bible's words for them; their words are not
 * then looked for one by one ("share my faith" is not "share" and "faith"). */
const PHRASES: [RegExp, string[]][] = [
  [/\bjudg(e|ing) (others|other people|people|anyone|each other|one another|someone)\b|\bjudgmental\b/, ['do not judge', 'passing judgment', 'judge neighbor', 'speck']],
  [/\b(greatest|most important|first|great) commandments?\b/, ['greatest commandment', 'most important commandment', 'first commandment']],
  [/\bten commandments\b/, ['ten commandments', 'no other gods', 'two tablets']],
  [/\bholy spirit (is )?(in|within|living in|lives in|inside) (me|us|you)\b|\b(have|got|received) the holy spirit\b/, ['spirit lives', 'spirit dwells', 'spirit testifies', 'sealed spirit', 'given spirit']],
  [/\b(babies|baby|infants?|little children)\b.*\b(die|died|dies|death)\b/, ['child died', 'stillborn', 'go him return', 'little children kingdom']],
  [/\barmor of god\b/, ['full armor', 'armor god', 'armor light', 'breastplate righteousness']],
  [/\bwhat did jesus (teach|preach|say)\b|\bjesus teachings?\b/, ['began preach', 'taught authority', 'repent kingdom near', 'astonished teaching']],
  [/\b(was|is) jesus (a )?real( person)?\b|\bdid jesus (really |actually )?exist\b|\bhistorical jesus\b/, ['eyewitnesses', 'seen heard touched', 'came flesh', 'word became flesh']],
  [/\b(defend|protect) (myself|yourself|themselves|ourselves|my family)\b|\bself[- ]defen[cs]e\b/, ['turn other cheek', 'sell cloak buy', 'repay evil', 'avenge yourselves']],
  [/\b(ok|okay|wrong|sin|bad) to (be )?(sad|cry|grieve|mourn)\b/, ['jesus wept', 'weep with', 'time weep', 'sorrowful']],
  [/\btreat (each other|one another)\b/, ['love one another', 'devoted one another', 'kind one another']],
  [/\b(share|sharing|spread|tell (people|others) about) (my |our |your |the )?(faith|gospel|jesus)\b/, ['preach', 'proclaim', 'good news', 'my witnesses', 'reason hope', 'testify']],
  [/\bdifficult (person|people)\b/, ['quarrelsome', 'contentious', 'hot tempered']],
  [/\b((break|breaking|quit|kick|stop|beat) (a |my |the |this )?)?(bad )?habits?\b/, ['mastered', 'old self', 'former way']],
  [/\bloved ones?\b/, ['fallen asleep jesus', 'sleep death grieve hope', 'caught up together', 'go him return']],
  [/\bend times\b/, ['last days', 'end age']],
  [/\b(death penalty|capital punishment)\b/, ['surely put death', 'sheds blood', 'carry sword']],
  [/\bmake peace\b/, ['live peace', 'peacemakers', 'first reconciled', 'brothers live harmony']],
  [/\bsame sex\b/, ['homosexual', 'homosexuals', 'natural relations']],
  [/\bfar from god\b/, ['hide face', 'forsaken', 'near']],
  [/\bnever heard\b/, ['ignorance', 'not heard']],
  [/\b(cannot|can ?not|cant) sleep\b|\binsomnia\b/, ['lie down sleep', 'sleep peace', 'gives sleep', 'sleepless']],
  [/\bgod (make|made|create|created) (me|us|people|humans|humanity|man|mankind)\b/, ['created', 'formed', 'make man', 'my glory']],
  [/\b(life is|life gets|times are|going through) (so )?(hard|difficult|tough)\b|\b(hard|difficult|tough) times\b/, ['trials', 'affliction', 'hardship', 'hardships', 'trouble', 'troubles', 'distress']],
  [/\blife (begin|begins|start|starts)\b/, ['womb', 'conceived', 'knit']],
  [/\brelaps\w*|\b(fell|falling|fall) off the wagon\b|\bback to (drinking|using)\b/, ['fall seven times', 'though i have fallen', 'keep on doing evil', 'mercies never fail', 'new every morning great faithfulness', 'not mastered']],
  [/\b(clean|sober) (for )?\d+ (days?|weeks?|months?|years?)\b|\b\d+ (days?|weeks?|months?|years?) (clean|sober)\b|\bstay(ing)? (clean|sober)\b/, ['sober', 'sober minded', 'self control']],
  [/\babortions?\b/, ['formed you in the womb', 'knit me together', 'unformed body', 'leaped womb', 'pregnant woman born prematurely']],
  [/\bgambl\w*|\blotter(y|ies)\b|\bcasinos?\b|\bsports betting\b/, ['love of money', 'want to be rich', 'eager to be rich', 'loves money', 'wealth hard work', 'get rich']],
  [/\bnon[- ]?(christians?|believers?)\b|\bunbelievers?\b/, ['unequally yoked', 'belongs lord marry', 'unbeliever', 'unbelievers']],
  [/\bold testament\b/, ['scripture', 'scriptures', 'law prophets', 'written instruction']],
  [/\bspiritual (battles?|warfare|war|attacks?)\b/, ['struggle flesh blood', 'full armor of god', 'weapons warfare', 'demolish strongholds', 'stand against schemes']],
  [/\bfruits? of the spirit\b/, ['fruit spirit']],
  [/\b(speaking|speak|speaks) in tongues\b/, ['speaks tongue', 'speak tongues', 'interpretation tongues', 'other tongues']],
  [/\b(who wrote|writers? of|authors? of|wrote) (the )?(bible|scriptures?)\b/, ['scripture god breathed', 'carried along holy spirit', 'prophecy scripture']],
  [/\b(hate|loathe|cant stand) myself\b/, ['fearfully wonderfully', 'hated own body', 'precious', 'worth more']],
  [/\b(love|loving) god\b/, ['love lord god', 'love me keep', 'love god']],
  [/\bwhat is love\b|\b(real|true|genuine) love\b/, ['love is', 'love patient', 'greater love', 'this is love']],
  [/\bfind (a |my )?(wife|husband|spouse)\b/, ['finds wife', 'prudent wife']],
  [/\bsave (my |our |a )?marriage\b/, ['one flesh', 'husbands love', 'wives submit', 'forgiving']],
  [/\bwhere is jesus( now)?\b/, ['right hand', 'seated', 'intercede', 'ascended']],
  [/\b(manage|use|spend|spending|using) (my |our )?time\b/, ['teach number days', 'redeeming time']],
  [/\b(people|everyone|men|humans|races|all) (as |are )?equal\b/, ['favoritism', 'partiality', 'every nation', 'jew greek']],
  [/\bhear (from )?god( speak| speaking)?\b|\bgod( voice| speak| speaking| speaks)( to (me|us))?\b/, ['sheep listen voice', 'anyone hears my voice', 'speak servant listening', 'today hear his voice', 'this is the way walk in it', 'still small voice']],
  [/\b(not|never) (good|smart|strong|holy|worthy) enough\b/, ['grace sufficient', 'competent', 'weakness', 'worthy']],
  // Life as people tell it.
  [/\b(lost|lose|losing) (my |our |his |her |a )?(job|work|income|business)\b|\blaid off\b|\b(got|been|was|get|getting) fired\b|\bunemploy(ed|ment)\b|\b(pay|afford|paying|make) (the |our |my )?(rent|bills|mortgage)\b|\b(rent|bills|mortgage)\b/, ['supply needs', 'daily bread', 'do not worry', 'shall not want']],
  [/\b(hate|quit|quitting|leave|leaving|change|changing) (my |a )?(job|work|career)\b|\bstart (my own |my |a )?business\b/, ['find satisfaction', 'whole being work', 'learned content', 'commit works', 'count cost']],
  [/\blost everything\b|\blose everything\b|\b(house|home) (burned|burnt|burned down|fire)\b|\b(lost|lose|losing) (our|my) (house|home|stuff|things|possessions)\b/, ['lord gave taken', 'confiscation property', 'treasures heaven', 'fig tree bud']],
  [/\b(trying|try|tried|want|wanting|cant|cannot) (to )?(have|get|conceive)( a)? (baby|child|kids|children|pregnant)\b|\binfertil\w*|\bbarren\b/, ['barren', 'opened womb', 'conceive', 'children heritage', 'hope deferred']],
  [/\bsingle (mom|mother|parent|dad|father)\b/, ['weary burdened', 'renew strength', 'fatherless']],
  [/\bspecial needs\b|\bdisabilit(y|ies)\b|\bdisabled\b|\bautis(m|tic)\b|\bdown syndrome\b/, ['gave mouth', 'works god displayed', 'power perfected weakness', 'lame blind']],
  [/\b(cant|cannot|can not) (do this|do it|go on|keep going|take (it|this))( anymore)?\b|\bgiv(e|ing) up\b/, ['grace sufficient', 'renew strength', 'weary burdened', 'lose heart']],
  [/\b(the way i look|my looks|my appearance|how i look|my body|my weight|ugly)\b/, ['outward appearance', 'fearfully wonderfully', 'beauty fleeting']],
  [/\bbr(oke|eak|eaking) up\b|\bbreakup\b|\bheart ?broken\b|\bheartbreak\b/, ['brokenhearted', 'near brokenhearted', 'heals brokenhearted']],
  [/\b(angry|mad|upset|bitter) (at|with) god\b/, ['how long lord', 'complaint bitter', 'pour hearts']],
  [/\b(take|taking|handle|accept|receive|receiving)s? (criticism|correction|feedback|rebuke)\b/, ['correction', 'reproof', 'loves discipline']],
  [/\b(nobody|no one|noone) (appreciates|notices|sees|thanks|values)\b|\b(unappreciated|not appreciated|taken for granted)\b/, ['whole being work', 'sees secret', 'forget your work']],
  [/\b(cant|cannot|can not|unable to|struggle to|hard to) say no\b|\bpeople pleas(er|ing)\b/, ['let your yes', 'approval men', 'fear man snare']],
  // Only for a wrong done: "i throw up after i eat and nobody knows" is not one.
  [/\b(stole|stolen|steal|stealing|cheated|cheating|lied|lying|affair|sinned)\b.*\b((nobody|no one|noone) knows|(she|he|they|nobody|no one) (doesnt|does not|dont|do not) know)\b|\bsecret sins?\b|\bhid(e|den|ing) (my |a )?sins?\b/, ['conceals sins', 'kept silent', 'sin find out', 'nothing concealed']],
  [/\b(doesnt|does not|dont|do not|wont|will not|stopped|refuses to|never) (speak|talk|call|answer)(s|ing)? to me\b|\bestranged\b|\bcut me off\b|\bnot speaking\b|\bstopped talking\b/, ['father compassion saw', 'peace everyone', 'father mother forsake']],
  [/\b(comfort|help|support|encourage|say to|be there for) (a |my )?(friend|someone|person|loved one)\b/, ['weep with', 'god of all comfort', 'seven days nights', 'carry burdens']],
  [/\b(talk|speak) to (him|her|them|my \w+) about (it|this|that)\b|\bconfront(ing)? (him|her|them|my \w+)\b/, ['restore gentleness', 'truth love speaking']],
  // The one who hurts them is part of what they ask: "husband" alone would find "wives, submit".
  [/\b((my )?(husband|wife|partner|spouse|boyfriend|girlfriend|dad|father|mom|mother|parents?|stepdad|stepfather) (is |was |has been |keeps )?)?(abus(e|ed|es|ive|er|ing)( me)?|hits me|beats me|hurts me)\b|\bdomestic violence\b/, ['lover violence', 'garment violence', 'love wives harsh', 'violent', 'violence']],
  [/\b(make|makes|made|making) fun of\b|\bmock(s|ed|ing)? me\b|\blaugh(s|ed)? at me\b/, ['insult persecute', 'insulted name christ', 'suffer as christian', 'insult', 'insulted', 'mock', 'mocked', 'scorn', 'ridicule']],
  [/\b(take care of|taking care of|care for|caring for|look after|looking after) (my |our )?(aging |elderly |old |sick )?(parents|mom|mother|dad|father|grandparents)\b|\b(aging|elderly) parents\b/, ['repay parents', 'provide own household', 'here is your mother']],
  [/\b(getting|growing|grow|get) old(er)?\b|\bold age\b|\baging\b|\bageing\b|\belderly\b/, ['old age', 'gray hair']],
  [/\bin[- ]?laws?\b/, ['mother in law', 'father in law', 'leave father mother']],
  [/\bstep[- ]?(dad|father|mom|mother|parent|kids|children|son|daughter)s?\b|\bblended family\b/, ['provoke children', 'train child', 'fatherless']],
  [/\b(exams?|finals|job interview|interview|presentation)\b/, ['anxious', 'anxiety', 'do not worry', 'diligent', 'wisdom lacks']],
  [/\b(passed over|overlooked)\b/, ['exaltation', 'humble exalted']],
  [/\b(passed away|passed on|who passed)\b/, ['died', 'death', 'dead']],
  [/\b(some|most|these|those|every|other|many) (days?|nights?)\b/, []],
  // Questions of faith.
  [/\b(is )?(anything|nothing) (is )?too (hard|difficult)\b/, ['too difficult', 'possible with god', 'nothing impossible']],
  [/(?<=\bpray\w*\b.*)\b(really |actually )?(change|changes|work|works|matter|matters|help|helps|make a difference)( anything| things| gods? mind| his mind)?\b/, ['prayer righteous power', 'heard your prayer', 'elijah prayed']],
  [/\bpray(ing|er|ers)? for (other people|others|other|someone|people|each other|one another|my \w+)\b/, ['intercedes', 'intercession', 'pray for each other', 'petitions']],
  [/\b(pray|praying|ask|asking)( in)? (jesus|jesuss|his|christs?) name\b|\bin jesus name\b/, ['ask name whatever', 'name lord jesus']],
  [/\b(child|children|son|sons|daughter|daughters) of god\b/, ['called children god', 'right become children', 'led spirit sons', 'heirs god', 'abba', 'adoption']],
  [/\b(be|become|being|follow|following) (a |his )?(disciple|follower)s?( of (jesus|christ))?\b|\bdiscipleship\b|\bfollow (jesus|christ)\b/, ['deny himself cross', 'cannot be my disciple', 'love one another disciples', 'continue my word']],
  [/\babid(e|ing) in (christ|jesus|him|god|me)\b/, ['remain in me', 'vine branches']],
  [/\bfalse (teachers?|prophets?|preachers?|pastors?)\b/, ['false teachers', 'false prophets', 'test spirits', 'wolves sheep']],
  [/\bname in vain\b|\b(take|taking|use|using) (gods?|the lords?) name\b/, ['vain name lord', 'profane name']],
  [/\b(made|created) in (gods?|his|the) image\b|\bimage of god\b|\bgods? image\b/, ['likeness god', 'image creator', 'our image']],
  [/\bwho (made|created) god\b|\bwhere did god come from\b|\bhas god always (existed|been)\b/, ['from everlasting', 'alpha omega']],
  [/\bgod (a |an )?(man|male|woman|female|boy|girl|he or she)( or (a |an )?(man|male|woman|female|boy|girl))?\b|\bgods gender\b|\bgender of god\b/, ['man that he should lie', 'god spirit worshipers']],
  [/\b(what|how) did jesus look( like)?\b|\bjesus (looks|appearance|face|skin|hair)\b/, ['form majesty', 'white wool', 'face shone']],
  [/\b(four|4) gospels\b|\b(different|so many) gospels\b/, ['orderly account', 'many other signs']],
  [/\b(which|what|how many) books\b.*\b(bible|scriptures?)\b|\bcanon\b|\bwho (decided|chose|picked)\b.*\b(books|bible|scriptures?)\b/, ['god breathed', 'law prophets psalms', 'scripture broken']],
  [/\b(bible|scriptures?|genesis)\b.*\b(literal|literally|myths?|accurate|errors?|contradictions?|contradict)\b|\b(literal|literally|myths?|accurate|errors?|contradictions?)\b.*\b(bible|scriptures?|genesis)\b/, ['god breathed', 'word truth', 'scripture broken']],
  [/\b(yahweh|jehovah)\b|\bname of god\b|\bgods? name\b/, ['my name forever', 'name lord known', 'i am sent you israelites']],
  [/\b(some|certain) sins? (worse|greater|bigger)\b|\b(worse|greater|bigger|worst) sins?\b/, ['greater sin', 'blasphemy spirit', 'one point']],
  [/\bgod (ever )?chang(e|es|ed|ing) (his )?mind\b/, ['relented', 'relent', 'man that he should lie', 'lord do not change']],
  [/\bgenerational (curses?|sins?)\b|\bsins? of (the |my )?(fathers|parents|ancestors)\b/, ['third fourth', 'sour grapes', 'son not bear']],
  [/\b(read|reads|know|knows) (my |our )?(mind|thoughts)\b/, ['know hearts', 'searches heart', 'understand my thoughts']],
  [/\bunethical\b/, ['fruitless deeds darkness', 'share sins']],
  [/\b(wipe|wiped|destroy|destroyed|kill|killed|slaughter)\w* (out )?(entire |whole |all )?(cities|nations|canaanites|peoples)\b|\bgenocide\b|\bcanaanites\b/, ['wickedness nations', 'amorites iniquity', 'detestable things teach']],
  [/\bgod (already )?knows\b.*\bpray\b|\bpray\b.*\bgod (already )?knows\b/, ['knows need ask', 'do not have ask', 'ask given']],
  [/\b(marry|marrying|married|date|dating)\b.*\b(different|another|other) (race|ethnicity|culture|color)\b|\binterracial\b/, ['cushite', 'jew greek', 'belong lord']],
  [/\bfind(s|ing)? (some )?(money|a wallet|wallet|something)\b|\bfinders keepers\b/, ['lost property', 'return it']],
  [/\b(hindu|buddhist|sikh|pagan) (temple|ceremony|wedding|festival|shrine)\b|\bmosque\b|\bshrine\b/, ['temple idol', 'table demons', 'food sacrificed idols']],
  [/\b(called|named)\b(?= (the|a|an)\b)/, []],
  [/\ba lot( of)?\b|\blots of\b/, []],
  [/\bfamily trees?\b|\bgenealog(y|ies)\b/, ['genealogy', 'record genealogy']],
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

/** The slips that turn the BSB word `x` into the typed `w`: letters left out
 * ("intrest"), two neighbours swapped ("freinds") and, in long words, one
 * vowel for another ("sacrafice"). Other changes make another word
 * ("quitting" is not "quoting", "witch" not "watch"), so they never count. */
function slips(w: string, x: string): number {
  const vowel = (c: string) => 'aeiou'.includes(c);
  const d = [Array.from({ length: x.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= w.length; i++) {
    d[i] = [Infinity];
    for (let j = 1; j <= x.length; j++) {
      const [a, b] = [w[i - 1], x[j - 1]];
      let best = d[i][j - 1] + 1;
      if (a === b) best = Math.min(best, d[i - 1][j - 1]);
      else if (w.length >= 8 && vowel(a) && vowel(b)) best = Math.min(best, d[i - 1][j - 1] + 1);
      if (i > 1 && j > 1 && a === x[j - 2] && w[i - 2] === b) best = Math.min(best, d[i - 2][j - 2] + 1);
      d[i][j] = best;
    }
  }
  return d[w.length][x.length];
}

/** Consonant outline: "zacheus" and "zacchaeus" both read "zchs". */
function skeleton(w: string): string {
  return w[0] + w.slice(1).replace(/[aeiouyh]/g, '').replace(/(.)\1+/g, '$1');
}

/** The BSB word a misspelt one was meant to be ("methusela", "freinds"), or
 * null. It must sound alike, so "anime" does not become "anise", nor
 * "cremation" "creation", nor "pills" "piles". */
function meant(a: Atlas, w: string): string | null {
  if (w.length < 5 || /\d/.test(w)) return null;
  const max = w.length >= 7 ? 2 : 1;
  const sk = skeleton(w);
  let best: string | null = null;
  let bestD = max + 1;
  let bestN = 0;
  a.englishWords.forEach((x, i) => {
    if (x[0] !== w[0] || Math.abs(x.length - w.length) > max) return;
    if (skeleton(x) !== sk) return;
    const d = slips(w, x);
    const n = a.eOff[i + 1] - a.eOff[i];
    if (d < bestD || (d === bestD && n > bestN)) [best, bestD, bestN] = [x, d, n];
  });
  return bestD <= max ? best : null;
}

/** Books named for a person: "john" is the book only as "john 3" or "the
 * gospel of john". Books that are also everyday words need the same. */
const PERSON_BOOKS = new Set(['joshua', 'ruth', 'samuel', 'ezra', 'nehemiah', 'esther', 'job', 'isaiah', 'jeremiah', 'ezekiel', 'daniel', 'hosea', 'joel', 'amos', 'obadiah', 'jonah', 'micah', 'nahum', 'habakkuk', 'zephaniah', 'haggai', 'zechariah', 'malachi', 'matthew', 'mark', 'luke', 'john', 'james', 'peter', 'jude', 'timothy', 'titus', 'philemon']);
const WORD_BOOKS = new Set(['numbers', 'judges', 'kings', 'chronicles', 'psalms', 'psalm', 'proverbs', 'lamentations', 'acts', 'romans', 'song', 'songs']);
const ORDINALS: Record<string, number> = { '1': 1, '2': 2, '3': 3, first: 1, second: 2, third: 3 };

interface Named {
  /** Verses of the books or chapters named. */
  from: number;
  to: number;
  chapter: boolean;
}

/** The Bible books a question names as books ("in john 1", "leviticus",
 * "matthew says ... but acts says"), and which of its words did. */
function namedBooks(a: Atlas, toks: string[]): { named: Named[]; used: Set<number> } {
  const byWord = new Map<string, { book: number; ord: number }[]>();
  a.books.forEach((b, book) => {
    const parts = b.name.toLowerCase().split(' ');
    const ord = /^\d$/.test(parts[0]) ? +parts[0] : 0;
    const last = parts[parts.length - 1];
    for (const w of last === 'psalms' ? ['psalms', 'psalm'] : [last]) byWord.set(w, [...(byWord.get(w) ?? []), { book, ord }]);
  });
  const isBook = (w: string | undefined) => !!w && byWord.has(w);
  const SAYS = ['says', 'say', 'said', 'writes', 'wrote'];
  // "matthew says ... but acts says": a book that speaks, when another does too.
  const speaking = toks.filter((w, i) => isBook(w) && SAYS.includes(toks[i + 1])).length;
  const named: Named[] = [];
  const used = new Set<number>();
  toks.forEach((w, i) => {
    const books = byWord.get(w);
    if (!books) return;
    const [prev, next] = [toks[i - 1], toks[i + 1]];
    const chapter = next && /^\d+$/.test(next) ? +next : 0;
    const asBook =
      chapter > 0 ||
      (!PERSON_BOOKS.has(w) && !WORD_BOOKS.has(w)) ||
      prev === 'in' ||
      (prev === 'of' && ['book', 'gospel', 'letter', 'epistle'].includes(toks[i - 2])) ||
      (SAYS.includes(next) && speaking > 1) ||
      (prev === 'and' && isBook(toks[i - 2])) ||
      (next === 'and' && isBook(toks[i + 2]));
    if (!asBook) return;
    const ord = ORDINALS[prev] ?? 0;
    const pick = books.filter((b) => b.ord === ord);
    for (const { book } of pick.length ? pick : books) {
      const meta = a.books[book];
      const end = book + 1 < a.books.length ? a.books[book + 1].start : a.n;
      if (chapter > 0 && chapter <= meta.chapters.length) {
        const [from, to] = chapterRange(a, book, chapter);
        named.push({ from, to, chapter: true });
      }
      named.push({ from: meta.start, to: end, chapter: false });
    }
    used.add(i);
    if (chapter > 0) used.add(i + 1);
    if (ORDINALS[prev]) used.add(i - 1);
    // "the book of romans", "psalm 23 verse 4": words about the book, not of the question.
    for (const j of [i - 2, i - 1, i + 1, i + 2]) if (['book', 'books', 'gospel', 'letter', 'epistle', 'chapter', 'verse'].includes(toks[j])) used.add(j);
  });
  return { named, used };
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
  /** Verses that hold one of its Bible phrases whole: the closest words for it. */
  close: Set<number>;
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
  const close = new Set<number>();
  const marks = new Set(forms);
  for (const ps of phrases) {
    const sets = ps.map((p) => versesWith(a, [p]));
    for (const v of sets[0]) if (sets.every((vs) => vs.has(v))) {
      found.add(v);
      close.add(v);
    }
    ps.forEach((p, i) => {
      // "love the LORD your God": "love" marks the verse, "God" says little.
      if (sets[i].size < COMMON && contentWords(p).length) marks.add(p);
    });
  }
  return { word, forms: [...forms], names: own ? [word, ...ownForms] : [], exact, phrases, marks: [...marks], found, close };
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

/** A concept this wide does not answer a question alone. */
const BROAD = 600;

export async function gather(a: Atlas, question: string): Promise<Gathered> {
  const [ix] = await Promise.all([loadAsk(a), loadPlainText(a).catch(() => null)]);
  // "God's voice" is God's, not "gods".
  let rest = question
    .toLowerCase()
    .replace(/\bgod['’]s\b/g, 'god')
    // "Lot's wife" is Lot's, not the lots that were cast.
    .replace(/\b(\p{L}+)['’]s\b/gu, '$1')
    .replace(/[’‘']/g, '');
  const phrases: { word: string; bible: string[] }[] = [];
  for (const [re, bible] of PHRASES) {
    const m = rest.match(re);
    if (!m) continue;
    // A phrase with no Bible words only says how something is asked.
    if (bible.length) phrases.push({ word: m[0].trim(), bible });
    rest = rest.replace(re, ' ');
  }
  const personal = PERSONAL.test(question.toLowerCase().replace(/[’‘']/g, ''));
  const toks = rest.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const { named, used } = namedBooks(a, toks);
  rest = toks.filter((_, i) => !used.has(i)).join(' ');
  const ws = [...new Set(contentWords(rest))]
    .filter((w) => !FILLER.has(w) && !(personal && (SPANS.has(w) || /^\d+$/.test(w))))
    .map((w) => (BIBLE_WORDS[w] || INSTEAD.has(w) || formsOf(a.englishWords, w, true).length ? w : (meant(a, w) ?? w)))
    .slice(0, Math.max(0, 8 - phrases.length));
  const n = a.n;

  // 1. Concepts and the BSB words for each.
  const concepts = [
    ...phrases.map((p) => concept(a, p.word, p.bible, false)),
    ...ws.map((w) => {
      // 40 is "forty" in the BSB's words.
      const k = /^\d+$/.test(w) ? Number(w) : -1;
      // 144000 is also "144,000".
      const said = k >= 0 ? [numberWords(k).join(' '), ...(k >= 1000 ? [`${Math.floor(k / 1000)} ${String(k % 1000).padStart(3, '0')}`] : [])].filter(Boolean) : [];
      return concept(a, w, said.length ? said : (BIBLE_WORDS[w] ?? BIBLE_WORDS[stem(w)] ?? []), !INSTEAD.has(w));
    }),
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
    Promise.all(qs.map((q) => questionData(a, q).catch(() => null))),
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
  for (const set of questionSets) {
    if (!set) continue;
    addRanges(inTopic, set.v);
    addRanges(cited, set.top);
  }

  // 3. How much of the question each verse holds, rarer concepts counting more.
  const usable = concepts.map((_, i) => i).filter((i) => reach[i].size > 0 && reach[i].size < n * 0.2);
  // A word the Bible does not use, with only broad words beside it ("is
  // gambling a sin"): verses that hold only "sin" would not answer it.
  if (concepts.some((_, i) => !reach[i].size) && usable.every((i) => reach[i].size > BROAD)) usable.length = 0;
  // A phrase is what the person is going through; the words beside it say where.
  const idf = new Map(usable.map((i) => [i, Math.log(1 + n / reach[i].size) * (i < phrases.length ? 1.5 : 1)]));
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
  // A book or chapter the question names: its verses come first, and when
  // little else is asked ("what is leviticus about"), its best-known verses.
  const chapters = named.filter((b) => b.chapter);
  const within = (v: number, bs: Named[]) => bs.some((b) => b.from <= v && v < b.to);
  if (named.length) {
    const scope = chapters.length ? chapters : named;
    const inside = new Set([...cands, ...text.keys()].filter((v) => within(v, scope)));
    if (inside.size < 12) {
      const pool: number[] = [];
      for (const b of scope) for (let v = b.from; v < b.to; v++) pool.push(v);
      pool.sort((x, y) => a.rank[y] - a.rank[x] || x - y);
      for (const v of pool.slice(0, 40)) inside.add(v);
    }
    cands.clear();
    for (const v of inside) cands.add(v);
  }

  const marks = new Set<string>();
  for (const i of usable) for (const f of concepts[i].marks) marks.add(f);
  const texts = plainText();
  const why = WHY.test(question.toLowerCase());
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
    // "Why" is answered where a verse gives the reason.
    const reason = why && t && REASON.test(t) ? 0.4 : 0;
    const closest = usable.some((i) => concepts[i].close.has(v)) ? 0.5 : 0;
    // How much of the question a verse holds comes first.
    const book = within(v, chapters) ? 1.2 : within(v, named) ? 0.8 : 0;
    score.set(v, 3.5 * (text.get(v) ?? 0) + (inTopic.has(v) ? 0.6 : 0) + (cited.has(v) ? 0.6 : 0) + 0.5 * a.rank[v] + 0.6 * dense + genre + reason + closest + book);
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
