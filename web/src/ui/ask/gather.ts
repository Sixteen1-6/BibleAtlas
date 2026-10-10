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
};

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

/** A word and the other forms of it the BSB uses: "die" -> die, dies, died, dying. */
function formsOf(words: string[], w: string): string[] {
  const out = new Set<string>();
  const roots = new Set([w]);
  // "babies" -> baby, not "bab" (and so "babes"); and a stem only where an
  // ending came off, so "here" does not become "her" (and so "herd").
  const st = stem(w);
  const cut = w.slice(st.length);
  if (w.length > 4 && (w.endsWith('ied') || w.endsWith('ies'))) roots.add(`${w.slice(0, -3)}y`);
  else if (st.length >= 3 && cut !== 'e' && cut !== 'y') roots.add(st);
  for (const r of roots) {
    for (const end of ['', 's', 'es', 'd', 'ed', 'ing', 'e', 'er', 'ers', 'ness', 'ly', 'ful']) {
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

export async function gather(a: Atlas, question: string): Promise<Gathered> {
  const [ix] = await Promise.all([loadAsk(a), loadPlainText(a).catch(() => null)]);
  const ws = [...new Set(contentWords(question))].slice(0, 8);
  const n = a.n;

  // 1. Concepts and the BSB words for each.
  const concepts = ws.map((w) => {
    const forms = new Set(formsOf(a.englishWords, w));
    for (const x of BIBLE_WORDS[w] ?? BIBLE_WORDS[stem(w)] ?? []) for (const f of formsOf(a.englishWords, x)) forms.add(f);
    const found = versesWith(a, [...forms]);
    return { word: w, forms: [...forms], found };
  });
  const usable = concepts.filter((c) => c.found.size > 0 && c.found.size < n * 0.2);
  const idf = usable.map((c) => Math.log(1 + n / c.found.size));
  const mass = idf.reduce((x, y) => x + y, 0) || 1;

  // 2a. The BSB text: how much of the question each verse holds.
  const text = new Map<number, number>();
  usable.forEach((c, i) => {
    for (const v of c.found) text.set(v, (text.get(v) ?? 0) + idf[i] / mass);
  });

  // 2b. Nave's subjects named by the concepts, and 2c. prepared questions with these words.
  // Each word of the subject's name must be one of the concepts' words or a
  // form of one: "treat" does not name "Treaty".
  const conceptWords = [...new Set(concepts.flatMap((c) => [c.word, ...c.forms]))];
  const subjects: { i: number; title: string }[] = [];
  ix.topics.forEach(([title], i) => {
    const ts = contentWords(title);
    if (ts.length && ts.length <= 2 && ts.every((t) => conceptWords.some((w) => sameWord(w, t)))) subjects.push({ i, title });
  });
  // Largest first, but a subject as wide as "God" says little about one question.
  subjects.sort((x, y) => ix.topics[y.i][1] - ix.topics[x.i][1]);
  const focused = subjects.filter((x) => ix.topics[x.i][1] <= WIDE_SUBJECT);
  const chosen = (focused.length ? focused : subjects).slice(0, 4);
  const qs = matchingQuestions(ix, ws);
  const inTopic = new Set<number>();
  const cited = new Set<number>();
  const [topicSets, questionSets] = await Promise.all([
    Promise.all(chosen.map((s) => topicData(a, s.i).catch(() => null))),
    Promise.all(qs.map((q) => loadJson<{ v: Range[] }>(a, `ask/q/${q.id}.json`).catch(() => null))),
  ]);
  for (const t of topicSets) {
    if (!t) continue;
    addRanges(inTopic, t.v);
    addRanges(cited, t.top);
  }
  for (const [k, set] of questionSets.entries()) {
    if (!set) continue;
    addRanges(inTopic, set.v);
    addRanges(cited, qs[k].top);
  }

  // 3. Candidates: verses that hold enough of the question (all of it when it
  // has one or two words), and every verse the index names. When too few hold
  // that much, the closest come back.
  const cands = new Set<number>(inTopic);
  let floor = usable.length <= 2 ? 0.99 : 0.75;
  for (;;) {
    for (const [v, s] of text) if (s >= floor) cands.add(v);
    if (cands.size >= 12 || floor < 0.3) break;
    floor -= 0.2;
  }

  const marks = new Set<string>();
  for (const c of usable) for (const f of c.forms) marks.add(f);
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
    score.set(v, 2 * (text.get(v) ?? 0) + (inTopic.has(v) ? 1.5 : 0) + (cited.has(v) ? 0.6 : 0) + 0.5 * a.rank[v] + 0.6 * dense + genre);
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
    concepts: concepts.map((c) => ({ word: c.word, forms: c.forms, found: c.found.size })),
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
