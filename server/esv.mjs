// ESV proxy: keeps the API key on the server and enforces Crossway's free-use
// limits (https://api.esv.org/), so the app stays within them by construction:
//
// - one chapter per request (well under 500 verses or half a book; single-
//   and double-chapter books are exempt from the half-book rule),
// - at most 500 verses held in this process's cache at any time,
// - the text is never written to disk.
//
// The key is read from ESV_API_KEY. Never put it in client code.

const ESV_ENDPOINT = 'https://api.esv.org/v3/passage/text/';
const MAX_CACHED_VERSES = 500;

export const ESV_COPYRIGHT =
  'Scripture quotations marked “ESV” are from the ESV® Bible (The Holy Bible, English Standard Version®), ' +
  'copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.';

// Book names as the ESV API accepts them, in canonical order.
const BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark',
  'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
  'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
];

/** Split "[1] In the beginning... [2] The earth..." into {1: "...", 2: "..."}. */
export function splitVerses(passage) {
  const out = {};
  const parts = passage.split(/\[(\d+)\]/);
  for (let i = 1; i < parts.length; i += 2) {
    const text = parts[i + 1].replace(/\s+/g, ' ').trim();
    if (text) out[parts[i]] = text;
  }
  return out;
}

export function createEsvHandler({ apiKey, fetchImpl = fetch }) {
  /** chapter key -> { verses, count }, oldest first. */
  const cache = new Map();
  let cachedVerses = 0;

  function remember(key, verses) {
    const count = Object.keys(verses).length;
    while (cachedVerses + count > MAX_CACHED_VERSES && cache.size > 0) {
      const [oldKey, old] = cache.entries().next().value;
      cache.delete(oldKey);
      cachedVerses -= old.count;
    }
    if (count <= MAX_CACHED_VERSES) {
      cache.set(key, { verses, count });
      cachedVerses += count;
    }
  }

  return async function handle(req, res) {
    const send = (status, body) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url, 'http://localhost');
    const book = Number(url.searchParams.get('book'));
    const chapter = Number(url.searchParams.get('chapter'));
    if (!Number.isInteger(book) || book < 0 || book >= BOOKS.length || !Number.isInteger(chapter) || chapter < 1 || chapter > 150) {
      return send(400, { error: 'Ask for one chapter: ?book=<0-65>&chapter=<number>.' });
    }
    if (!apiKey) {
      return send(503, { error: 'ESV is not configured. Add ESV_API_KEY to web/.env and restart the server.' });
    }
    const key = `${book}:${chapter}`;
    const hit = cache.get(key);
    if (hit) {
      cache.delete(key);
      cache.set(key, hit);
      return send(200, { verses: hit.verses, copyright: ESV_COPYRIGHT });
    }
    const params = new URLSearchParams({
      q: `${BOOKS[book]} ${chapter}`,
      'include-passage-references': 'false',
      'include-verse-numbers': 'true',
      'include-first-verse-numbers': 'true',
      'include-footnotes': 'false',
      'include-footnote-body': 'false',
      'include-headings': 'false',
      'include-short-copyright': 'false',
      'include-copyright': 'false',
      'include-selahs': 'true',
      'indent-paragraphs': '0',
      'indent-poetry': 'false',
      'line-length': '0',
    });
    try {
      const r = await fetchImpl(`${ESV_ENDPOINT}?${params}`, { headers: { Authorization: `Token ${apiKey}` } });
      if (!r.ok) return send(502, { error: `The ESV API answered ${r.status}. Check that ESV_API_KEY is valid.` });
      const data = await r.json();
      const verses = splitVerses((data.passages || []).join(' '));
      remember(key, verses);
      return send(200, { verses, copyright: ESV_COPYRIGHT });
    } catch (e) {
      return send(502, { error: `Could not reach the ESV API: ${e.message}` });
    }
  };
}
