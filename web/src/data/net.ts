// NET Bible text, read live from the publisher's own free web service
// (labs.bible.org, run by Biblical Studies Press) one chapter at a time.
//
// The NET is copyrighted, so nothing of it is stored: not in the repository,
// not in the service worker (it only caches this site's own files), not in
// browser storage. This client keeps at most two chapters in memory, like the
// ESV. Its permissions (https://netbible.com/copyright/) let free apps and
// websites quote it when each quotation ends with "(NET)" linked to
// netbible.org; the reader shows that line under every NET chapter.
//
// The translators' notes are the NET's own commentary. When the service sends
// a note's words with the verse they are shown at Study and Deep, held only in
// memory; every verse also links to its notes on netbible.org.

export const NET_HOME = 'https://netbible.org';
export const NET_COPYRIGHT =
  'Scripture quoted by permission. Quotations designated (NET) are from the NET Bible® copyright ©1996, 2019 by Biblical Studies Press, L.L.C. All rights reserved.';

const ENDPOINT = 'https://labs.bible.org/api/';
const MAX_CHAPTERS = 2;
const TIMEOUT_MS = 15000;

// Book names as the NET service reads them, in canonical order.
const BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark',
  'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
];

export interface NetChapter {
  /** Verse number -> plain text. */
  verses: Record<string, string>;
}

export interface NetNotes {
  /** Verse number -> the translators' notes the service sent, in order. */
  notes: Record<string, string[]>;
}

/** netbible.org's own page for a verse, where all its notes can be read. */
export function netVerseUrl(book: number, chapter: number, verse: number): string {
  return `${NET_HOME}/bible/${encodeURIComponent(BOOKS[book] ?? 'Genesis').replace(/%20/g, '+')}+${chapter}:${verse}`;
}

interface Row {
  chapter?: unknown;
  verse?: unknown;
  text?: unknown;
}

/** Keep only well-formed rows of the asked chapter. */
function rowsOf(data: unknown, chapter: number): { verse: string; text: string }[] {
  if (!Array.isArray(data)) throw new Error('The NET service sent something unexpected.');
  const out: { verse: string; text: string }[] = [];
  for (const r of data as Row[]) {
    if (!r || typeof r !== 'object') continue;
    if (Number(r.chapter) !== chapter) continue;
    const verse = String(r.verse ?? '');
    if (!/^\d{1,3}$/.test(verse) || typeof r.text !== 'string') continue;
    out.push({ verse, text: r.text });
  }
  return out;
}

/** Plain verse text from the service's plain format (which has no markup, but
 *  tidy any stray tags or entities anyway; the text is rendered as text). */
export function parseNetPlain(data: unknown, chapter: number): NetChapter {
  const verses: Record<string, string> = {};
  for (const { verse, text } of rowsOf(data, chapter)) {
    const t = decodeEntities(text.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (t) verses[verse] = verses[verse] ? `${verses[verse]} ${t}` : t;
  }
  if (!Object.keys(verses).length) throw new Error('The NET service sent no verses for this chapter.');
  return { verses };
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…' };
function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Notes inside the service's full format. A note is any element named like a
 *  note (<n>, <note>, or a class or id with "note" in it) that holds words;
 *  bare markers such as <n id="1" /> hold none and are skipped. The HTML is
 *  parsed inert (DOMParser runs no scripts) and only its text is kept. */
export function parseNetNotes(data: unknown, chapter: number, parse: (html: string) => ParentNode = defaultParse): NetNotes {
  const notes: Record<string, string[]> = {};
  for (const { verse, text } of rowsOf(data, chapter)) {
    // Self-closing markers (<n id="1" />) are not void in HTML and would
    // swallow the rest of the verse, so close them first.
    const doc = parse(text.replace(/<([a-z][\w-]*)([^<>]*?)\/>/gi, '<$1$2></$1>'));
    const found: string[] = [];
    for (const el of Array.from(doc.querySelectorAll('n, note, [class*="note" i], [id*="note" i]'))) {
      // A note nested in another note is read with its parent.
      if (el.parentElement?.closest('n, note, [class*="note" i], [id*="note" i]')) continue;
      const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (t.length >= 3 && !found.includes(t)) found.push(t);
    }
    if (found.length) notes[verse] = (notes[verse] ?? []).concat(found);
  }
  return { notes };
}

function defaultParse(html: string): ParentNode {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

/** One request to the service. Tries an ordinary request first; if the service
 *  does not allow it from this site, falls back to its documented JSONP form. */
async function request(book: number, chapter: number, formatting: 'plain' | 'full'): Promise<unknown> {
  const passage = `${BOOKS[book]} ${chapter}`;
  const base = `${ENDPOINT}?passage=${encodeURIComponent(passage)}&type=json&formatting=${formatting}`;
  try {
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(base, { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (r.ok) return await r.json();
    } finally {
      window.clearTimeout(t);
    }
  } catch {
    // Blocked across sites, or offline: try JSONP below.
  }
  return jsonp(base);
}

let seq = 0;
function jsonp(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const name = `__atlasNet${Date.now().toString(36)}${seq++}`;
    const w = window as unknown as Record<string, unknown>;
    const s = document.createElement('script');
    const done = () => {
      window.clearTimeout(timer);
      s.remove();
      // Leave a no-op behind in case the script arrives after the timeout.
      w[name] = () => {};
    };
    const timer = window.setTimeout(() => {
      done();
      reject(new Error('The NET service did not answer.'));
    }, TIMEOUT_MS);
    w[name] = (data: unknown) => {
      done();
      resolve(data);
    };
    s.src = `${url}&callback=${name}`;
    s.referrerPolicy = 'no-referrer';
    s.onerror = () => {
      done();
      reject(new Error('The NET service could not be reached.'));
    };
    document.head.appendChild(s);
  });
}

function lru<T>(load: (book: number, chapter: number) => Promise<T>) {
  const cache = new Map<string, Promise<T>>();
  return (book: number, chapter: number): Promise<T> => {
    const key = `${book}:${chapter}`;
    const hit = cache.get(key);
    if (hit) {
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }
    const p = load(book, chapter);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
    while (cache.size > MAX_CHAPTERS) cache.delete(cache.keys().next().value!);
    return p;
  };
}

/** One chapter of the NET, plain. */
export const loadNetChapter = lru((book, chapter) => request(book, chapter, 'plain').then((d) => parseNetPlain(d, chapter)));

/** Notes that are not just the verse's own words. A guard in case a marker
 *  the parser did not expect wraps the verse text instead of a note. */
export function notesBeyondText(notes: readonly string[], verseText: string): string[] {
  const plain = verseText.replace(/\s+/g, ' ').trim();
  return notes.filter((n) => {
    if (plain.includes(n)) return false;
    const head = n.slice(0, 40);
    return !(head.length >= 20 && plain.includes(head));
  });
}

/** The translators' notes the service sends for one chapter (often none). */
export const loadNetNotes = lru((book, chapter) => request(book, chapter, 'full').then((d) => parseNetNotes(d, chapter)));
