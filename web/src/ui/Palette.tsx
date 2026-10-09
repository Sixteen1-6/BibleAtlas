// Command palette: a reference, an English phrase, or a Hebrew/Greek word.

import { useEffect, useRef, useState } from 'preact/hooks';
import { type Atlas, label, langName } from '../data/atlas';
import { loadPlainText, plainText } from '../data/plain';
import { type SearchResult, searchEnglish, searchRoots, wordPieces } from '../data/search';
import { getVerse } from '../data/text';
import * as S from '../state';

type Item =
  | { kind: 'ref'; range: [number, number] }
  | { kind: 'root'; root: number }
  | { kind: 'verse'; v: number };

function VerseText({ a, v, words }: { a: Atlas; v: number; words: Set<string> }) {
  const [t, setT] = useState(() => plainText()?.[v] ?? '');
  useEffect(() => {
    const known = plainText()?.[v];
    if (known) {
      setT(known);
      return;
    }
    let live = true;
    getVerse(a, v).then((r) => live && setT(r[0]));
    return () => {
      live = false;
    };
  }, [v]);
  if (!t) return <span class="s">…</span>;
  return (
    <span class="s">
      {wordPieces(t).map((p, i) => (p.word && words.has(p.word) ? <mark key={i}>{p.text}</mark> : p.text))}
    </span>
  );
}

function footNote(q: string, res: SearchResult | null, ref: boolean): string {
  if (!q.trim()) return 'Type a reference, words from a verse (any translation, typos are fine), a Strong’s number, or a transliteration like “agape” or “ruach”.';
  if (!res) return ref ? 'Press Enter to open it.' : '';
  const notes: string[] = [];
  if (res.guesses.length) notes.push(`Read ${res.guesses.map(([w, as]) => `“${w}” as “${as.join('” or “')}”`).join(', ')}.`);
  if (res.unknown.length) notes.push(`No BSB verse uses “${res.unknown.join('”, “')}”.`);
  if (res.verses.length) {
    if (res.total) notes.unshift(`${res.total.toLocaleString()} ${res.total === 1 ? 'verse holds' : 'verses hold'} all these words (BSB). Closest wording first.`);
    else notes.unshift('No verse holds every word, so these are the closest matches (BSB).');
  }
  return notes.join(' ');
}

export function Palette({ a }: { a: Atlas }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [res, setRes] = useState<SearchResult | null>(null);
  const [texts, setTexts] = useState<string[] | null>(plainText);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    if (!texts) loadPlainText(a).then(setTexts, () => {});
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      const out: Item[] = [];
      const query = q.trim();
      if (!query) {
        setItems([]);
        setRes(null);
        return;
      }
      const range = /\d/.test(query) || query.length >= 3 ? await S.engine.value?.parseRef(query) : null;
      if (!live) return;
      if (range) out.push({ kind: 'ref', range });
      for (const r of searchRoots(a, query, 5)) out.push({ kind: 'root', root: r });
      // "Mathew 5:3" is a reference, not words to look for.
      const found = range && /\d/.test(query) ? null : searchEnglish(a, q, 30, texts);
      for (const v of found?.verses ?? []) out.push({ kind: 'verse', v });
      setItems(out);
      setRes(found);
      setActive(0);
    })();
    return () => {
      live = false;
    };
  }, [q, texts]);

  const choose = (it: Item) => {
    S.paletteOpen.value = false;
    if (it.kind === 'ref') {
      S.selectVerse(it.range[0]);
      S.mobilePane.value = 'read';
    } else if (it.kind === 'root') S.openRoot(it.root);
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
        <input ref={input} value={q} placeholder="John 3:16 · the lord is my shepherd · agape · H7225" onInput={(e) => setQ((e.target as HTMLInputElement).value)} onKeyDown={onKey} aria-label="Search for a verse, an English phrase, or a Hebrew or Greek word" />
        <ul role="listbox">
          {items.map((it, i) => (
            <li key={i} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => choose(it)}>
              {it.kind === 'ref' && (
                <>
                  <span class="k">Go to</span>
                  <b>{it.range[0] === it.range[1] ? label(a, it.range[0]) : `${label(a, it.range[0])} – ${label(a, it.range[1])}`}</b>
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
                  <b>{label(a, it.v)}</b>
                  <VerseText a={a} v={it.v} words={res?.words ?? new Set()} />
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
