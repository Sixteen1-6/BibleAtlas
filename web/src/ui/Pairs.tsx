// Color pairs for word-by-word mode: each original word (or prefix, stem and
// suffix of one) shares a color with the BSB English words it became. A
// "word for word" line shows the same glosses in the original order, so you
// can see how the translator moved them around. Hovering or tapping a pair
// lights it up across all three lines.

import { signal } from '@preact/signals';
import { PAIR_COLORS, type VerseAlign, englishParts, piecesOf } from '../data/align';
import { FLAG, type VerseRow, type WordRow } from '../data/text';
import * as S from '../state';

function storedFlag(key: string, fallback: boolean) {
  let initial = fallback;
  try {
    const v = localStorage.getItem(key);
    if (v === '0' || v === '1') initial = v === '1';
  } catch {
    // Storage blocked (private window): fall back to the default.
  }
  const s = signal(initial);
  s.subscribe((v) => {
    try {
      localStorage.setItem(key, v ? '1' : '0');
    } catch {
      // Ignore: the choice just won't be remembered.
    }
  });
  return s;
}

/** Color pairs on or off in word-by-word mode. Remembered per browser. */
export const pairsOn = storedFlag('atlas.pairs', true);

type Spot = { v: number; g: number } | null;
/** Pair chosen by a tap (stays until tapped again). */
const focus = signal<Spot>(null);
/** Pair under the mouse pointer. */
const hover = signal<Spot>(null);

function activeIn(v: number): number | null {
  const h = hover.value;
  if (h && h.v === v) return h.g;
  const f = focus.value;
  return f && f.v === v ? f.g : null;
}

function pairClass(g: number, active: number | null): string {
  if (g < 0) return ' pair-none';
  let c = ` pair pair-${g % PAIR_COLORS}`;
  if (active !== null) c += g === active ? ' pair-on' : ' pair-off';
  return c;
}

function handlers(v: number, g: number) {
  if (g < 0) return {};
  return {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hover.value = { v, g };
    },
    onPointerLeave: () => {
      if (hover.value?.v === v && hover.value.g === g) hover.value = null;
    },
    onClick: () => {
      const f = focus.value;
      focus.value = f && f.v === v && f.g === g ? null : { v, g };
    },
  };
}

/** The BSB verse with each English word colored by its pair. */
export function PairedEnglish({ v, text, al }: { v: number; text: string; al: VerseAlign }) {
  const active = activeIn(v);
  return (
    <>
      {englishParts(text).map((p, i) => {
        if (p.word < 0) return p.text;
        const g = al.e[p.word] ?? -1;
        return (
          <span key={i} class={`ew${pairClass(g, active)}`} {...handlers(v, g)}>
            {p.text}
          </span>
        );
      })}
    </>
  );
}

function cellClass(w: WordRow, hit: boolean): string {
  let c = 'w';
  if (w[5] & FLAG.variant) c += ' var';
  if (w[5] & FLAG.otherEditions) c += ' other';
  if (hit) c += ' hit';
  return c;
}

/** "Word for word" line plus the interlinear cells, both colored by pair. */
export function PairedWords({ v, row, al, hebrew, other, studyRoot }: { v: number; row: VerseRow; al: VerseAlign; hebrew: boolean; other: boolean; studyRoot: number }) {
  const active = activeIn(v);
  const lang = hebrew ? 'he' : 'gr';
  const shown = row[1].map((w, i) => ({ w, i, pieces: piecesOf(al.w[i], w[0], w[2]) })).filter(({ w }) => other || !(w[5] & FLAG.otherEditions));
  return (
    <>
      <div class="literal" aria-label="Word for word, in the original order">
        <span class="literal-label">Word for word</span>
        {shown.map(({ i, pieces }) => (
          <span key={i} class="lw">
            {pieces.map((p, k) => (
              <span key={k} class={`lp${pairClass(p[2], active)}`} {...handlers(v, p[2])}>
                {p[1]}
              </span>
            ))}
          </span>
        ))}
      </div>
      <div class={`inter ${lang}`}>
        {shown.map(({ w, i, pieces }) => (
          <button key={i} class={`cell ${lang} ${cellClass(w, w[3] === studyRoot)}`} onClick={() => w[3] >= 0 && S.openRoot(w[3], v, i)} title={w[4]}>
            <span class="o" lang={hebrew ? 'hbo' : 'grc'}>
              {pieces.map((p, k) => (
                <span key={k} class={`op${pairClass(p[2], active)}`} {...handlers(v, p[2])}>
                  {p[0]}
                </span>
              ))}
            </span>
            <span class="t">{w[1]}</span>
            <span class="g">
              {pieces.map((p, k) => (
                <span key={k} class={`gp${pairClass(p[2], active)}`} {...handlers(v, p[2])}>
                  {p[1]}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

export function PairsNote({ hebrew }: { hebrew: boolean }) {
  return (
    <p class="pairs-note">
      Matching colors show which English words came from which {hebrew ? 'Hebrew' : 'Greek'} word. <span class="pair-none">Gray</span> words have no partner: the translator added them, or left
      the original word untranslated. Tap a word to follow it.{' '}
      <span class="muted">
        Alignment by{' '}
        <a href="https://github.com/Clear-Bible/Alignments" target="_blank" rel="noopener">
          Clear Bible
        </a>{' '}
        (CC BY 4.0).
      </span>
    </p>
  );
}
