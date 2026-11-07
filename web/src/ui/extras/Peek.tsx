// A look at a passage from inside a panel (peek.ts): the verse with two
// verses either side of it in its chapter, the verse itself marked, and a
// button that takes the reader to it in the Bible.

import { type Atlas, locate } from '../../data/atlas';
import { refName, usePassage } from './kit';
import type { VerseRef } from './types';

const AROUND = 2;

export function Peek({ a, verse, go }: { a: Atlas; verse: VerseRef; go: (v: VerseRef) => void }) {
  const l = locate(a, verse);
  const before = Math.min(AROUND, l.verse - 1);
  const after = Math.min(AROUND, a.books[l.book].chapters[l.chapter - 1] - l.verse);
  const from = verse - before;
  const rows = usePassage(a, from, verse + after);
  const name = refName(a, verse);
  return (
    <div class="xt-peek">
      <p class="xt-lead">
        {name}, with the verses around it. Back, above, returns to where you were.
      </p>
      {rows === null ? (
        <p class="xt-ptext xt-wait">…</p>
      ) : (
        rows.map((row, i) => (
          <div key={from + i} class={`xt-pverse${from + i === verse ? ' xt-peek-on' : ''}`}>
            <p class="xt-ptext">
              <sup>{l.verse - before + i}</sup>
              {row[0] || <span class="muted">Some manuscripts add a verse here.</span>}
            </p>
          </div>
        ))
      )}
      <button type="button" class="xt-peek-go" onClick={() => go(verse)}>
        Read {name} in the Bible ›
      </button>
    </div>
  );
}
