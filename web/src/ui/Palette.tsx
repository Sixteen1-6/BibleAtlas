// Command palette: a reference, an English phrase, a Hebrew/Greek word, or a
// question for Ask the Bible.

import { useEffect, useRef, useState } from 'preact/hooks';
import { type Atlas, label, langName, rangeLabel } from '../data/atlas';
import { extraText, loadExtraText, loadPlainText, plainText } from '../data/plain';
import { type Extra, type SearchResult, searchEnglish, searchRoots, markWords } from '../data/search';
import { getVerse } from '../data/text';
import * as S from '../state';
import { NOT_LOADED } from './common';
import { atLeast } from '../depth';
import { type Asked, askIndex, askLabel, holdsWords, isCare, loadAsk, matchAsk, openAsk } from './ask/ask';

type Item =
  | { kind: 'ref'; range: [number, number] }
  | { kind: 'ask'; asked: Asked }
  | { kind: 'root'; root: number }
  | { kind: 'verse'; v: number; span: number; via: string | null };

function VerseText({ a, v, words }: { a: Atlas; v: number; words: Set<string> }) {
  const [t, setT] = useState(() => plainText()?.[v] ?? '');
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    const known = plainText()?.[v];
    setFailed(false);
    if (known) {
      setT(known);
      return;
    }
    setT('');
    let live = true;
    const retry = () => setTries((n) => n + 1);
    getVerse(a, v).then(
      (r) => live && setT(r[0]),
      () => {
        if (!live) return;
        setFailed(true);
        addEventListener('online', retry, { once: true });
      },
    );
    return () => {
      live = false;
      removeEventListener('online', retry);
    };
  }, [v, tries]);
  if (!t) return <span class="s">{failed ? NOT_LOADED : '…'}</span>;
  return (
    <span class="s">
      {markWords(t, words).map((p, i) => (p.mark ? <mark key={i}>{p.text}</mark> : p.text))}
    </span>
  );
}

/** Shown before anything is typed, so a first visitor sees they can ask. */
const EXAMPLES = ['does-god-love-me', 'what-happens-when-we-die', 'what-about-worry', 'what-is-the-purpose-of-my-life'];

function footNote(q: string, res: SearchResult | null, ref: boolean): string {
  if (!q.trim())
    return atLeast('study')
      ? 'Ask any question in your own words, or type a reference, words from a verse (any translation, typos are fine), a Strong’s number, or a transliteration like “agape” or “ruach”.'
      : 'Ask any question in your own words, or type a verse like John 3:16 or words you remember from one.';
  if (!res) return ref ? 'Press Enter to open it.' : '';
  const notes: string[] = [];
  if (res.guesses.length) notes.push(`Read ${res.guesses.map(([w, as]) => `“${w}” as “${as.join('” or “')}”`).join(', ')}.`);
  if (res.unknown.length) notes.push(`No verse uses “${res.unknown.join('”, “')}”.`);
  if (res.verses.length) {
    if (res.total) notes.unshift(`${res.total.toLocaleString()} ${res.total === 1 ? 'verse holds' : 'verses hold'} all these words. Closest wording first; KJV and ASV wording count too.`);
    else notes.unshift('No verse holds every word, so these are the closest matches, including verses that span two.');
  }
  return notes.join(' ');
}

export function Palette({ a }: { a: Atlas }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [res, setRes] = useState<SearchResult | null>(null);
  const [texts, setTexts] = useState<string[] | null>(plainText);
  const [extra, setExtra] = useState<Extra | null>(extraText);
  // Nothing is picked until the arrows or the pointer pick it.
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  const asks = askIndex.value;
  useEffect(() => void loadAsk(a).catch(() => {}), []);
  useEffect(() => {
    if (!texts) loadPlainText(a).then(setTexts, () => {});
    // Other translations' wording: search works without it and improves when it lands.
    if (!extra) loadExtraText(a).then(setExtra, () => {});
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      const out: Item[] = [];
      const query = q.trim();
      if (!query) {
        // A few questions to ask; the first prepared ones if these were renamed.
        const ex = EXAMPLES.map((id) => asks?.questions.find((x) => x.id === id)).filter((x) => !!x);
        for (const found of ex.length ? ex : (asks?.questions.slice(0, EXAMPLES.length) ?? [])) out.push({ kind: 'ask', asked: { kind: 'question', q: found } });
        setItems(out);
        setRes(null);
        // Data landing later keeps what was picked.
        setActive((i) => Math.min(i, out.length - 1));
        return;
      }
      const range = /\d/.test(query) || query.length >= 3 ? await S.engine.value?.parseRef(query) : null;
      if (!live) return;
      if (range) out.push({ kind: 'ref', range });
      // Someone asking about ending their life gets help and hope (matchAsk), not every verse that says "kill" or "die".
      const care = isCare(query);
      // "Mathew 5:3" is a reference, not words to look for.
      const found = care || (range && /\d/.test(query)) ? null : searchEnglish(a, q, 30, texts, extra);
      // "My grace is sufficient for you" looks for its verse; "my dad has dementia" asks.
      const top = found?.verses[0];
      const quoted = top !== undefined && !!texts && holdsWords(texts[top] + (found!.spans[0] === 2 ? ` ${texts[top + 1]}` : ''), query);
      for (const asked of range && /\d/.test(query) ? [] : matchAsk(asks, query, 3, quoted)) out.push({ kind: 'ask', asked });
      for (const r of care ? [] : searchRoots(a, query, 5)) out.push({ kind: 'root', root: r });
      found?.verses.forEach((v, i) => out.push({ kind: 'verse', v, span: found.spans[i], via: found.via[i] }));
      setItems(out);
      setRes(found);
      setActive(0);
    })();
    return () => {
      live = false;
    };
  }, [q, texts, extra, asks]);

  const choose = (it: Item) => {
    S.paletteOpen.value = false;
    if (it.kind === 'ref') {
      S.selectVerse(it.range[0]);
      S.mobilePane.value = 'read';
    } else if (it.kind === 'ask') openAsk(it.asked);
    else if (it.kind === 'root') S.openRoot(it.root);
    else S.selectVerse(it.v);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') setActive((i) => Math.min(items.length - 1, i + 1));
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1));
    else if (e.key === 'Enter' && items[active]) choose(items[active]);
    else if (e.key === 'Escape') S.paletteOpen.value = false;
    else return;
    e.preventDefault();
  };

  const L = a.lemmas;
  return (
    <div class="scrim" onClick={(e) => e.target === e.currentTarget && (S.paletteOpen.value = false)}>
      <div class="palette" role="dialog" aria-label="Search">
        <input
          ref={input}
          value={q}
          placeholder="Ask a question · John 3:16 · agape"
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value;
            if (!v.trim()) setActive(-1);
            setQ(v);
          }}
          onKeyDown={onKey}
          aria-label="Ask the Bible a question, or search for a verse, a phrase, or a Hebrew or Greek word"
        />
        <ul role="listbox" aria-label={q.trim() ? 'Results' : 'Questions to ask'}>
          {items.map((it, i) => (
            <li key={i} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => choose(it)}>
              {it.kind === 'ref' && (
                <>
                  <span class="k">Go to</span>
                  <b>{it.range[0] === it.range[1] ? label(a, it.range[0]) : `${label(a, it.range[0])} – ${label(a, it.range[1])}`}</b>
                </>
              )}
              {it.kind === 'ask' && (
                <>
                  <span class="k ask-k">Ask</span>
                  <b>{askLabel(it.asked)[0]}</b> <span class="k">{askLabel(it.asked)[1]}</span>
                </>
              )}
              {it.kind === 'root' && (
                <>
                  <span class="k">{langName(L, it.root)}</span>
                  <b class={L.lang[it.root] === 'G' ? 'gr' : 'he'}>{L.word[it.root]}</b> <i>{L.translit[it.root]}</i> “{L.gloss[it.root]}” <span class="k">{L.count[it.root].toLocaleString()}×</span>
                </>
              )}
              {it.kind === 'verse' && (
                <>
                  <b>{rangeLabel(a, it.v, it.span)}</b>
                  {it.via && <span class="k"> · matched {it.via} wording</span>}
                  <VerseText a={a} v={it.v} words={res?.words ?? new Set()} />
                  {it.span === 2 && <VerseText a={a} v={it.v + 1} words={res?.words ?? new Set()} />}
                </>
              )}
            </li>
          ))}
        </ul>
        <div class="foot">{footNote(q, res, items[0]?.kind === 'ref')}</div>
      </div>
    </div>
  );
}
