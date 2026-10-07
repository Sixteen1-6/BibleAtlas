// Command palette: a reference, an English phrase, or a Hebrew/Greek word.

import { useEffect, useRef, useState } from 'preact/hooks';
import { type Atlas, LANG_NAME, label } from '../data/atlas';
import { searchEnglish, searchRoots } from '../data/search';
import { getVerse } from '../data/text';
import * as S from '../state';

type Item =
  | { kind: 'ref'; range: [number, number] }
  | { kind: 'root'; root: number }
  | { kind: 'verse'; v: number };

function VerseText({ a, v, q }: { a: Atlas; v: number; q: string }) {
  const [t, setT] = useState('');
  useEffect(() => {
    let live = true;
    getVerse(a, v).then((r) => live && setT(r[0]));
    return () => {
      live = false;
    };
  }, [v]);
  if (!t) return <span class="s">…</span>;
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const parts = t.split(new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') || '$^'})`, 'i'));
  return (
    <span class="s">
      {parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}
    </span>
  );
}

export function Palette({ a }: { a: Atlas }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  useEffect(() => {
    let live = true;
    (async () => {
      const out: Item[] = [];
      const query = q.trim();
      if (!query) {
        setItems([]);
        setTotal(0);
        return;
      }
      const range = /\d/.test(query) || query.length >= 3 ? await S.engine.value?.parseRef(query) : null;
      if (!live) return;
      if (range) out.push({ kind: 'ref', range });
      for (const r of searchRoots(a, query, 5)) out.push({ kind: 'root', root: r });
      const res = searchEnglish(a, query, 30);
      for (const v of res.verses) out.push({ kind: 'verse', v });
      setItems(out);
      setTotal(res.total);
      setActive(0);
    })();
    return () => {
      live = false;
    };
  }, [q]);

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
        <input ref={input} value={q} placeholder="John 3:16 · shepherd · agape · H7225" onInput={(e) => setQ((e.target as HTMLInputElement).value)} onKeyDown={onKey} aria-label="Search for a verse, an English phrase, or a Hebrew or Greek word" />
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
                  <span class="k">{LANG_NAME[L.lang[it.root]]}</span>
                  <b class={L.lang[it.root] === 'G' ? 'gr' : 'he'}>{L.word[it.root]}</b> <i>{L.translit[it.root]}</i> “{L.gloss[it.root]}” <span class="k">{L.count[it.root].toLocaleString()}×</span>
                </>
              )}
              {it.kind === 'verse' && (
                <>
                  <b>{label(a, it.v)}</b>
                  <VerseText a={a} v={it.v} q={q} />
                </>
              )}
            </li>
          ))}
        </ul>
        <div class="foot">{q.trim() ? `${total.toLocaleString()} verses contain these words (BSB). Most connected first.` : 'Type a reference, an English phrase, a Strong’s number, or a transliteration like “agape” or “ruach”.'}</div>
      </div>
    </div>
  );
}
