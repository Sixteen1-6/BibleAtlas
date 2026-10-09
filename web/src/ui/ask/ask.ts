// Ask the Bible: questions answered from verses alone.
//
// The data (crates/atlas-cli/src/ask.rs writes it):
// - ask/index.json: the questions and every Nave's subject's name, loaded when
//   search opens;
// - ask/q/<id>.json and ask/topics/<n>.json: a question's or subject's verses,
//   loaded when it opens.
//
// What is open is part of the link: #...&ask=what-happens-when-we-die for a
// question, &ask=topic.anger for a subject. Opening adds one history entry, so
// Back closes it, the way an extra's panel works.

import { effect, signal } from '@preact/signals';
import type { Atlas } from '../../data/atlas';
import * as S from '../../state';
import { loadJson } from '../extras/data';
import { closeExtra, openPanel } from '../extras/open';

/** [first verse, last verse], inclusive. */
export type Range = [number, number];

export interface Sentence {
  /** Plain words that say only what `r` says. */
  t: string;
  r: Range[];
}

export interface Question {
  id: string;
  /** Index into AskIndex.groups. */
  g: number;
  q: string;
  also: string[];
  /** How many verses its cluster holds. */
  n: number;
  /** Reviewed: the key verses. Not yet reviewed: its most-cited verses. */
  top: Range[];
  /** Only once reviewed (or in a preview build with drafts). */
  answer?: Sentence[];
  draft?: true;
}

export interface AskIndex {
  format: 1;
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
}

export type Asked = { kind: 'question'; q: Question } | { kind: 'topic'; i: number; title: string; n: number };

// ------------------------------------------------------------ loading

export const askIndex = signal<AskIndex | null>(null);

export function loadAsk(a: Atlas): Promise<AskIndex> {
  return loadJson<AskIndex>(a, 'ask/index.json').then((x) => {
    if (askIndex.peek() !== x) askIndex.value = x;
    return x;
  });
}

/** All the verses of what was asked, as ranges. */
export async function askVerses(a: Atlas, asked: Asked): Promise<Range[]> {
  if (asked.kind === 'question') return (await loadJson<{ v: Range[] }>(a, `ask/q/${asked.q.id}.json`)).v;
  return (await topicData(a, asked.i)).v;
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
  return asked.kind === 'question' ? asked.q.id : `topic.${slug(asked.title)}`;
}

export function findAsked(ix: AskIndex, id: string): Asked | null {
  if (id.startsWith('topic.')) {
    const s = id.slice(6);
    const i = ix.topics.findIndex(([t]) => slug(t) === s);
    return i < 0 ? null : { kind: 'topic', i, title: ix.topics[i][0], n: ix.topics[i][1] };
  }
  const q = ix.questions.find((x) => x.id === id);
  return q ? { kind: 'question', q } : null;
}

// ------------------------------------------------------------ open and close

/** The id of what is open (see askId), or null. */
export const askOpen = signal<string | null>(null);
/** Set while the history entry added by opening is the current one. */
let pushed: { hash: string } | null = null;
let backPending = false;
/** How the panel last closed: after 'navigate' the question's verses stay lit on the map. */
export let lastClose: 'dismiss' | 'navigate' | 'quiet' = 'dismiss';

export function openAsk(asked: Asked): void {
  if (backPending) return;
  closeExtra('quiet');
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
  askOpen.value = id && /^(topic\.)?[\p{L}\p{N}-]{1,80}$/u.test(id) ? id : null;
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

const QUESTION_WORDS = new Set(['who', 'what', 'whats', 'why', 'how', 'is', 'are', 'was', 'does', 'do', 'did', 'can', 'could', 'will', 'would', 'should', 'where', 'when', 'which', 'may', 'am', 'shall']);
const STOP = new Set([
  ...QUESTION_WORDS,
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'about', 'at', 'by', 'from', 'it', 'its', 'be', 'been', 'being',
  'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'he', 'his', 'him', 'she', 'her', 'they', 'them', 'their', 'that', 'this', 'there',
  'bible', 'scripture', 'scriptures', 'say', 'says', 'said', 'tell', 'teach', 'teaches', 'mean', 'means', 'verse', 'verses', 'really', 'ok', 'okay',
  'if', 'so', 'then', 'than', 'as', 'into', 'up', 'out', 'any', 'some', 'all', 'just', 'get', 'go', 'have', 'has', 'had', 'way',
]);

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’‘']/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** A rough stem, so "prayers", "praying" and "prayed" meet "prayer"/"pray". */
function stem(w: string): string {
  for (const end of ['ness', 'ing', 'ies', 'ied', 'es', 'ed', 'ly', 's', 'y', 'e']) {
    if (w.length > end.length + 2 && w.endsWith(end)) return w.slice(0, -end.length);
  }
  return w;
}

function content(s: string): string[] {
  return words(s).filter((w) => !STOP.has(w));
}

/** True when the reader is asking rather than quoting: "why do we suffer", "is anger a sin?". */
export function looksLikeQuestion(q: string): boolean {
  const ws = words(q);
  return q.trim().endsWith('?') || (ws.length >= 2 && QUESTION_WORDS.has(ws[0]));
}

interface Prepared {
  questions: { q: Question; whole: Set<string>; stems: Set<string> }[];
  topics: { title: string; whole: string; stems: string[] }[];
}

let prepared: { ix: AskIndex; p: Prepared } | null = null;

function prepare(ix: AskIndex): Prepared {
  if (prepared?.ix === ix) return prepared.p;
  const p: Prepared = {
    questions: ix.questions.map((q) => {
      const phrases = [q.q, ...q.also];
      return { q, whole: new Set(phrases.map((x) => content(x).join(' '))), stems: new Set(phrases.flatMap((x) => content(x).map(stem))) };
    }),
    topics: ix.topics.map(([title]) => ({ title, whole: content(title).join(' '), stems: content(title).map(stem) })),
  };
  prepared = { ix, p };
  return p;
}

/**
 * What a search for `query` could be asking: questions first, then Nave's
 * subjects. A query that reads as a question gets up to `limit`; any other
 * query only an exact match (a question's own wording, or a subject's name),
 * so a phrase from a verse is not crowded out.
 */
export function matchAsk(ix: AskIndex | null, query: string, limit = 3): Asked[] {
  if (!ix) return [];
  const ws = content(query);
  if (!ws.length || ws.length > 12) return [];
  const asking = looksLikeQuestion(query);
  const whole = ws.join(' ');
  const stems = ws.map(stem);
  const p = prepare(ix);
  const scored: { asked: Asked; score: number }[] = [];
  for (const x of p.questions) {
    if (x.whole.has(whole)) {
      scored.push({ asked: { kind: 'question', q: x.q }, score: 100 });
      continue;
    }
    if (!asking) continue;
    const hits = stems.filter((s) => x.stems.has(s)).length;
    // Most of the reader's words, and at least one.
    if (hits >= Math.max(1, Math.ceil(stems.length * 0.6))) scored.push({ asked: { kind: 'question', q: x.q }, score: 10 + (hits / stems.length) * 10 });
  }
  ix.topics.forEach(([title, n], i) => {
    const t = p.topics[i];
    if (!t.stems.length) return;
    const exact = t.whole === whole;
    // A subject named by the reader's words: "anger", "love of god".
    const named = asking && t.stems.every((s) => stems.includes(s));
    if (exact || named) scored.push({ asked: { kind: 'topic', i, title, n }, score: (exact ? 50 : 5) + t.stems.length + Math.min(n, 500) / 1000 });
  });
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, asking ? limit : Math.min(limit, 2)).map((x) => x.asked);
}
