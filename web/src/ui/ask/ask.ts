// Ask the Bible: questions answered from verses alone.
//
// The data (crates/atlas-cli/src/ask.rs writes it):
// - ask/index.json: the questions and every Nave's subject's name, loaded when
//   search opens;
// - ask/q/<id>.json: a question's chain and wider set of verses, and
//   ask/topics/<n>.json: a subject's verses, loaded when it opens.
//
// What is open is part of the link: #...&ask=what-happens-when-we-die for a
// question, &ask=topic.anger for a subject. Opening adds one history entry, so
// Back closes it, the way an extra's panel works.

import { effect, signal } from '@preact/signals';
import type { Atlas } from '../../data/atlas';
import * as S from '../../state';
import { loadJson } from '../extras/data';
import { closeExtra, openPanel, setOpener } from '../extras/open';

/** [first verse, last verse], inclusive. */
export type Range = [number, number];

/** One part of a chain of Scripture: whole verses, or `w`, a span of their
 * BSB text word for word. `a`: it starts after the verse's first word; `z`:
 * it ends before its last. `t`: why it is in the chain. */
export interface Part {
  r: Range;
  w?: string;
  a?: true;
  z?: true;
  t?: Ties;
}

/** What ties a part to the question or to the other parts of its chain, from
 * the Bible's own data (the build checks every part has at least one). Other
 * parts are numbered from 0. */
export interface Ties {
  /** The question's words the part holds. */
  w?: string[];
  /** The question's Nave's subjects the part sits under. */
  s?: string[];
  /** Parts it shares a cross-reference with. */
  x?: number[];
  /** Parts it quotes, or that quote it (the BSB's footnotes). */
  q?: number[];
  /** [part, root]: the rarest Hebrew or Greek root it shares with that part. */
  r?: [number, number][];
  /** Parts of the same passage. */
  p?: number[];
}

export interface Question {
  id: string;
  /** Index into AskIndex.groups. */
  g: number;
  q: string;
  also: string[];
  /** How many verses its cluster holds. */
  n: number;
  /** Its wider set's most-cited verses. */
  top: Range[];
  /** The verses of its chain. */
  r: Range[];
}

/** A prepared question's answer, loaded when it opens. */
export interface QuestionData {
  /** The answer, in the Bible's own words. */
  chain: Part[];
  /** Its wider set of verses. */
  v: Range[];
}

export interface AskIndex {
  format: 2;
  groups: string[];
  questions: Question[];
  /** [title, verse count], in the order of the topic files. */
  topics: [string, number][];
  /** Subjects per ask/topics/<n>.json. */
  shard: number;
}

export interface TopicData {
  top: Range[];
  v: Range[];
  /** Verses cited only where Nave's uses the subject as a figure. */
  f?: Range[];
}

export type Asked =
  | { kind: 'question'; q: Question }
  | { kind: 'topic'; i: number; title: string; n: number }
  /** Any other question, answered with the verses gathered for it. */
  | { kind: 'live'; text: string }
  /** Someone asking about ending their life: where to find help now, then verses of hope. */
  | { kind: 'care'; text: string };

/** The longest question kept in a link: room for a few sentences of what happened. */
const LIVE_MAX = 400;

// ------------------------------------------------------------ loading

export const askIndex = signal<AskIndex | null>(null);

export function loadAsk(a: Atlas): Promise<AskIndex> {
  return loadJson<AskIndex>(a, 'ask/index.json').then((x) => {
    if (askIndex.peek() !== x) askIndex.value = x;
    return x;
  });
}

export function questionData(a: Atlas, q: Question): Promise<QuestionData> {
  return loadJson<QuestionData>(a, `ask/q/${q.id}.json`);
}

export async function topicData(a: Atlas, i: number): Promise<TopicData> {
  const ix = await loadAsk(a);
  const shard = await loadJson<TopicData[]>(a, `ask/topics/${Math.floor(i / ix.shard)}.json`);
  return shard[i % ix.shard];
}

// ------------------------------------------------------------ links

/** A subject's link id: its title in lowercase words joined by hyphens (the build makes the same). */
export function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function askId(asked: Asked): string {
  // Their words stay out of the link.
  if (asked.kind === 'care') return 'care';
  if (asked.kind === 'live') return `live:${asked.text}`;
  return asked.kind === 'question' ? asked.q.id : `topic.${slug(asked.title)}`;
}

export function findAsked(ix: AskIndex, id: string): Asked | null {
  if (id === 'care') return { kind: 'care', text: '' };
  if (id.startsWith('live:')) {
    const text = id.slice(5).trim().slice(0, LIVE_MAX);
    return contentWords(text).length ? { kind: 'live', text } : null;
  }
  if (id.startsWith('topic.')) {
    const s = id.slice(6);
    const i = ix.topics.findIndex(([t]) => slug(t) === s);
    return i < 0 ? null : { kind: 'topic', i, title: ix.topics[i][0], n: ix.topics[i][1] };
  }
  const q = ix.questions.find((x) => x.id === id);
  return q ? { kind: 'question', q } : null;
}

/** How a search row names what it would open: the words, and a quiet note. */
export function askLabel(asked: Asked): [string, string] {
  if (asked.kind === 'question') return [asked.q.q, `${asked.q.n.toLocaleString()} verses`];
  if (asked.kind === 'topic') return [asked.title, `${asked.n.toLocaleString()} verses`];
  if (asked.kind === 'care') return ['Help, and hope', 'where to turn now, and verses for this'];
  return [asked.text, 'the verses on it'];
}

// ------------------------------------------------------------ open and close

/** The id of what is open (see askId), or null. */
export const askOpen = signal<string | null>(null);
/** Set while the history entry added by opening is the current one. */
let pushed: { hash: string } | null = null;
let backPending = false;
/** How the panel last closed: after 'navigate' the question's verses stay lit on the map. */
export let lastClose: 'dismiss' | 'navigate' | 'quiet' = 'dismiss';

export function openAsk(asked: Asked, from?: HTMLElement): void {
  if (backPending) return;
  closeExtra('quiet');
  // A control outside a panel names itself, so closing hands the focus back
  // to it; without one, the note that opened the extra keeps it.
  if (from) setOpener(from);
  if (!askOpen.peek()) {
    try {
      history.pushState(history.state, '', location.href);
      pushed = { hash: location.hash };
    } catch {
      pushed = null;
    }
  }
  askOpen.value = askId(asked);
}

/** Close it. 'dismiss' takes back the history entry opening added; 'navigate'
 * keeps it, so Back returns to the question; 'quiet' takes no history step. */
export function closeAsk(how: 'dismiss' | 'navigate' | 'quiet' = 'dismiss'): void {
  if (!askOpen.peek()) return;
  const p = pushed;
  pushed = null;
  lastClose = how;
  askOpen.value = null;
  if (how === 'dismiss' && p && location.hash === p.hash) {
    backPending = true;
    window.setTimeout(() => (backPending = false), 800);
    try {
      history.back();
    } catch {
      backPending = false;
    }
  }
}

/** url.ts, restoreFromHash. */
export function askFromHash(h: URLSearchParams): void {
  pushed = null;
  const id = h.get('ask');
  const ok = id && (/^(topic\.)?[\p{L}\p{N}-]{1,80}$/u.test(id) || (id.startsWith('live:') && id.length <= LIVE_MAX + 5));
  askOpen.value = ok ? id : null;
}

/** url.ts, syncHash. */
export function askToHash(h: URLSearchParams): void {
  const id = askOpen.value;
  if (id) h.set('ask', id);
}

// Search opens over everything, and on phones the sheet makes the page behind
// it inert, so it gives way. An extra's panel opening takes its place.
effect(() => {
  if (S.paletteOpen.value) closeAsk('quiet');
});
effect(() => {
  if (openPanel.value) closeAsk('quiet');
});
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    backPending = false;
  });
}

// ------------------------------------------------------------ matching

const QUESTION_WORDS = new Set([
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
const STOP = new Set([
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

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’‘']/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Words search leaves out that still change what is asked: "why did God
 * make me" is not "is there a God", and "what did Jesus teach" is not "who is
 * Jesus". A prepared question opens only when these match too. */
const KEEP = new Set(['make', 'made', 'teach', 'know', 'find', 'stop', 'get', 'go', 'have', 'use', 'not', 'no', 'let', 'see', 'care', 'real']);

/** "What does the Bible say about X" asks about X. */
const ABOUT = /^\s*(what|how)\s+(does|do|did)\s+(the\s+)?(bible|scriptures?|god|jesus|lord)\s+(say|says|teach|teaches|tell|tells)\s+(us\s+)?(about|of|on)\s+/i;

/** The words that must match for a question to open a prepared chain. */
export function askKey(s: string): string {
  const key = (x: string) =>
    words(x)
      .filter((w) => !STOP.has(w) || KEEP.has(w))
      .join(' ');
  const t = s.replace(/[’‘]/g, "'");
  // "What did Jesus say about himself" asks about Jesus.
  return key(t.replace(ABOUT, '')) || key(t);
}

const INFLECT = new Set(['s', 'es', 'd', 'ed', 'ing', 'er', 'ers', 'ness']);

/** The same word or a plain form of it: prayer/prayers, sin/sinned,
 * baby/babies, love/loving. Not treat/treaty, here/Heres or let/letters. */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length < 3 || !l.startsWith(s.slice(0, -1))) return false;
  if (l.startsWith(s)) {
    const rest = l.slice(s.length);
    // teach -> teacher, but not moth -> mother or pet -> Peter.
    if (rest === 'er' || rest === 'ers') return s.length >= 5;
    // sin -> sinned, sinning: the last letter doubled before the ending (not let -> letters).
    return INFLECT.has(rest) || (rest[0] === s[s.length - 1] && (rest === `${rest[0]}ed` || rest === `${rest[0]}ing`));
  }
  const cut = s.slice(0, -1);
  if (s.endsWith('e')) return l === `${cut}ing`;
  if (s.endsWith('y')) return l === `${cut}ies` || l === `${cut}ied`;
  return false;
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

/** True when the reader is asking rather than quoting: "why do we suffer", "is anger a sin?". */
export function looksLikeQuestion(q: string): boolean {
  const ws = words(q);
  return q.trim().endsWith('?') || (ws.length >= 2 && QUESTION_WORDS.has(ws[0]));
}

/** Words of someone telling what they are going through. */
const TELLING = new Set(['i', 'im', 'ive', 'id', 'ill', 'me', 'my', 'mine', 'myself', 'we', 'were', 'weve', 'our', 'us', 'husband', 'wife', 'mom', 'mum', 'dad', 'mother', 'father', 'son', 'daughter', 'kids', 'kid', 'child', 'children', 'baby', 'boyfriend', 'girlfriend', 'fiance', 'fiancee', 'brother', 'sister', 'grandma', 'grandpa', 'grandmother', 'grandfather', 'friend', 'friends', 'boss', 'coworker', 'pastor', 'parents', 'family']);

/** True when the reader tells what is happening rather than asking: "husband
 * deploys in 3 weeks", "my dad has dementia". A line that a verse holds word
 * for word (`quoted`) is a verse being looked for, as "the LORD is my shepherd". */
export function looksLikeTelling(q: string, quoted: boolean): boolean {
  return !quoted && contentWords(q).length >= 2 && words(q).some((w) => TELLING.has(w));
}

/** True when `text`, a verse, holds the query's words in order: "my grace is sufficient for you". */
export function holdsWords(text: string, query: string): boolean {
  const q = words(query);
  return q.length >= 3 && ` ${words(text).join(' ')} `.includes(` ${q.join(' ')} `);
}

interface Prepared {
  questions: { q: Question; whole: Set<string>; stems: Set<string>; own: Set<string> }[];
  /** The question each wording opens: a question's own wording, else a
   * phrasing only one question uses. "Lying" is said by both "Is it ever right
   * to lie?" and "I've been falsely accused", so it opens neither. */
  opens: Map<string, Question>;
  topics: { title: string; whole: string; words: string[] }[];
}

let prepared: { ix: AskIndex; p: Prepared } | null = null;

function prepare(ix: AskIndex): Prepared {
  if (prepared?.ix === ix) return prepared.p;
  const questions = ix.questions.map((q) => {
    const phrases = [q.q, ...q.also];
    return { q, whole: new Set(phrases.map(askKey)), stems: new Set(phrases.flatMap((x) => contentWords(x).map(stem))), own: new Set(contentWords(q.q).map(stem)) };
  });
  const said = new Map<string, Question[]>();
  for (const x of questions) for (const k of x.whole) if (k) said.set(k, [...(said.get(k) ?? []), x.q]);
  const opens = new Map<string, Question>();
  for (const [k, qs] of said) if (qs.length === 1) opens.set(k, qs[0]);
  const titles = new Map<string, Question[]>();
  for (const q of ix.questions) {
    const k = askKey(q.q);
    if (k) titles.set(k, [...(titles.get(k) ?? []), q]);
  }
  // Of two titles with the same words, "What does the Bible say about work?"
  // asks about the thing itself; "How should I treat the people who work for me?" does not.
  for (const [k, qs] of titles) {
    const about = qs.filter((q) => ABOUT.test(q.q));
    if (qs.length === 1 || about.length === 1) opens.set(k, qs.length === 1 ? qs[0] : about[0]);
  }
  const p: Prepared = {
    questions,
    opens,
    topics: ix.topics.map(([title]) => ({ title, whole: contentWords(title).join(' '), words: contentWords(title) })),
  };
  prepared = { ix, p };
  return p;
}

/** The prepared question asked in so many words: its own wording, or one of
 * its phrasings that no other question uses. */
export function exactQuestion(ix: AskIndex, query: string): Question | null {
  const key = askKey(query);
  return (key && prepare(ix).opens.get(key)) || null;
}

/** Words about ending one's own life. Search then offers help and verses of
 * hope, and not every verse that says "kill" or "die". */
const CARE =
  /\b(suicid\w*|kill(ing|ed|s)? (my|our|him|her|them|your)sel(f|ves)|end(ing)? (it all|my (own )?life)|(take|took|taken|taking) (my|his|her|their|your) (own )?life|(wants?|wanted|wanna) (to )?die|wish i (was|were|had) (dead|never been born)|(don'?t|do not) want to (live|be alive|be here|wake up|exist)|better off (dead|without me)|(no one|nobody) would (miss|care about|notice) me|no reason to live|not worth living|(can'?t|cannot) go on|self[- ]?harm(ing)?|(hurt(ing|s)?|cut(ting|s)?) (my|her|him|them|your)sel(f|ves)|overdos\w*)\b/i;

export function isCare(query: string): boolean {
  return CARE.test(query.replace(/[’‘]/g, "'"));
}

/**
 * What a search for `query` could be asking: questions first, then Nave's
 * subjects. A query that reads as a question, or tells what someone is going
 * through, gets up to `limit`; any other query only an exact match (a
 * question's own wording, or a subject's name), so a phrase from a verse is
 * not crowded out. `quoted`: the best verse found holds the query word for word.
 */
export function matchAsk(ix: AskIndex | null, query: string, limit = 3, quoted = false): Asked[] {
  if (isCare(query)) return [{ kind: 'care', text: query.trim().slice(0, LIVE_MAX) }];
  if (!ix) return [];
  const ws = contentWords(query);
  if (!ws.length) return [];
  const asking = looksLikeQuestion(query) || looksLikeTelling(query, quoted);
  // A few sentences of what happened: the verses gathered for them.
  if (ws.length > 12) return asking ? [{ kind: 'live', text: query.trim().slice(0, LIVE_MAX) }] : [];
  const whole = ws.join(' ');
  const key = askKey(query);
  const stems = ws.map(stem);
  const p = prepare(ix);
  const opens = key ? p.opens.get(key) : undefined;
  const scored: { asked: Asked; score: number }[] = [];
  for (const x of p.questions) {
    // Words in the question itself beat words only in its other phrasings.
    const own = (stems.filter((s) => x.own.has(s)).length / stems.length) * 5;
    if (opens === x.q) {
      scored.push({ asked: { kind: 'question', q: x.q }, score: 100 + own });
      continue;
    }
    if (!asking) continue;
    const hits = stems.filter((s) => x.stems.has(s)).length;
    // Most of the reader's words, and at least one.
    if (hits >= Math.max(1, Math.ceil(stems.length * 0.6))) scored.push({ asked: { kind: 'question', q: x.q }, score: 10 + (hits / stems.length) * 10 + own });
  }
  ix.topics.forEach(([title, n], i) => {
    const t = p.topics[i];
    if (!t.words.length) return;
    const exact = t.whole === whole;
    // A subject named by the reader's words: "anger", "love of god".
    // ...and covering at least half of them, so "does God hear prayer" does not offer all of "God".
    const named = asking && t.words.every((s) => ws.some((w) => sameWord(w, s))) && t.words.length * 2 >= ws.length;
    if (exact || named) scored.push({ asked: { kind: 'topic', i, title, n }, score: (exact ? 50 : 5) + t.words.length + Math.min(n, 500) / 1000 });
  });
  scored.sort((x, y) => y.score - x.score);
  const out = scored.slice(0, asking ? limit : Math.min(limit, 2)).map((x) => x.asked);
  // Any question at all: the verses gathered for the reader's own words, unless
  // a prepared question already says it exactly.
  const exact = scored[0]?.score >= 100;
  if (asking && !exact) out.unshift({ kind: 'live', text: query.trim().slice(0, LIVE_MAX) });
  return out;
}
