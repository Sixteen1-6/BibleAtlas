// What a word meant to the people who first heard it: two short lines in the
// word study, "Outside the Bible" (how Greek writers used it, from LSJ) and
// "In their world" (the UBS handbook article on the thing it names). Each
// line opens into more on request; a line with no data is not rendered.

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Atlas } from '../data/atlas';
import type { Segment } from '../data/lex';
import {
  type Article,
  HANDBOOK_TITLE,
  type RootWorld,
  type UbsEntry,
  type UbsIndex,
  type UbsLink,
  entriesFor,
  rootWorld,
  ubsArticle,
  ubsIndex,
} from '../data/world';
import * as S from '../state';
import { Provenance } from './common';
import './world.css';

/** "Homer, 8th century BC", or only the century when LSJ names no writer. */
function cited(writer: string, century: string): string {
  return writer ? `${writer}, ${century}` : century;
}

/**
 * Does the clamped paragraph hide some of its text? Measured after each
 * render, on resize, and when web fonts finish loading (a wider face can
 * push the buttons past the second line without changing the height).
 */
function useClamped(ref: { current: HTMLElement | null }): boolean {
  const [clamped, setClamped] = useState(false);
  const measure = () => {
    const el = ref.current;
    if (el) setClamped(el.scrollHeight > el.clientHeight + 1);
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const el = ref.current;
    const ro = el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (el) ro?.observe(el);
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    fonts?.addEventListener('loadingdone', measure);
    return () => {
      ro?.disconnect();
      fonts?.removeEventListener('loadingdone', measure);
    };
  }, []);
  return clamped;
}

/**
 * A summary line, at most two lines tall. Its buttons follow the text; when
 * the text is cut short they move to the end of the second line, and an
 * invisible copy keeps their place in the text so the layout never jumps
 * (and the buttons themselves never leave the page, so focus stays put).
 */
function Line({ children, actions }: { children: ComponentChildren; actions: () => ComponentChildren }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const clamped = useClamped(ref);
  return (
    <div class={clamped ? 'ww-row ww-clamped' : 'ww-row'}>
      <p class="ww-line" ref={ref}>
        {children}{' '}
        <span class="ww-acts">{actions()}</span>
        <span class="ww-room" aria-hidden="true">
          {actions()}
        </span>
      </p>
    </div>
  );
}

function Toggle({ open, controls, onToggle, label, openLabel }: { open: boolean; controls: string; onToggle: () => void; label: string; openLabel: string }) {
  return (
    <button type="button" class="ww-act" aria-expanded={open} aria-controls={controls} onClick={onToggle}>
      {open ? openLabel : label}
    </button>
  );
}

/** Is there an "Outside the Bible" line? Not for grammar words, nor for a related word's entry (RootWorld.g, .r). */
function hasLsj(w: RootWorld): boolean {
  return !w.g && !w.r && ((w.l?.length ?? 0) > 0 || !!w.f);
}

function OutsideTheBible({ w, id, open, onToggle }: { w: RootWorld; id: string; open: boolean; onToggle: () => void }) {
  const senses = w.l ?? [];
  const top = senses[0];
  const f = w.f;
  // The earliest example LSJ cites, unless it is the summary line's own.
  const earliest = f && top && !(f[0] === top[1] && f[1] === top[2]) ? f : undefined;
  const summary = top ? (
    <>
      “{top[0]}” — {cited(top[2], top[1])}
    </>
  ) : f && f[1] ? (
    <>
      first cited from {f[1]}, {f[0]}
    </>
  ) : (
    <>first cited in the {f?.[0]}</>
  );
  return (
    <>
      <Line actions={() => <Toggle open={open} controls={id} onToggle={onToggle} label="More" openLabel="Less" />}>
        <b class="ww-in">Outside the Bible:</b> {summary}
      </Line>
      <div class="ww-more" id={id} hidden={!open}>
        {/* Nothing the summary line already says is said again: a lone sense
            is not listed, nor an earliest example the line already gives. */}
        {open && (
          <>
            {senses.length > 1 && (
              <ul class="ww-senses">
                {senses.map(([gloss, century, writer, flags], i) => (
                  <li key={i}>
                    “{gloss}” — {cited(writer, century)}
                    {flags.includes('p') && <span class="ww-tag">papyri</span>}
                    {flags.includes('i') && <span class="ww-tag">inscription</span>}
                  </li>
                ))}
              </ul>
            )}
            {earliest && <p>Earliest example LSJ cites: {cited(earliest[1], earliest[0])}.</p>}
            {w.p && <p>LSJ also cites everyday papyri (letters, contracts, receipts).</p>}
            {w.i && <p>LSJ also cites inscriptions.</p>}
            <Provenance>
              Liddell–Scott–Jones Greek–English Lexicon (Perseus Digital Library, CC BY-SA 4.0), via STEPBible TFLSJ (CC BY 4.0); centuries added by Tyndale House. A century is that of the earliest writer LSJ cites for that meaning, not the first time the word was used.
            </Provenance>
          </>
        )}
      </div>
    </>
  );
}

function Seg({ s }: { s: Segment }) {
  const [text, style, v] = s;
  const body = style & 1 ? <b>{text}</b> : text;
  const el = style & 2 ? <i>{body}</i> : body;
  if (v < 0) return <>{el}</>;
  const go = () => S.selectVerse(v, { openTab: false });
  return (
    <span class="r ww-ref" role="link" tabIndex={0} onClick={go} onKeyDown={(e) => e.key === 'Enter' && go()}>
      {el}
    </span>
  );
}

/** Segments to paragraphs: a "\n" segment ends one. */
function paragraphs(segs: Segment[]): Segment[][] {
  const out: Segment[][] = [[]];
  for (const s of segs) {
    if (s[0] === '\n' && s[2] < 0) out.push([]);
    else out[out.length - 1].push(s);
  }
  return out.filter((p) => p.length > 0);
}

/** The kept sections of one handbook article, loaded when first opened. */
function ArticlePanel({ a, entry, handbook, id, open, onFail }: { a: Atlas; entry: number; handbook: UbsEntry[0]; id: string; open: boolean; onFail: () => void }) {
  const [art, setArt] = useState<Article | null>(null);
  useEffect(() => {
    if (!open || art) return;
    let live = true;
    ubsArticle(a, entry).then(
      (x) => live && setArt(x),
      () => live && onFail(),
    );
    return () => {
      live = false;
    };
  }, [a, entry, open, art]);
  return (
    <div class="ww-more" id={id} hidden={!open}>
      {open && !art && <p class="muted">Loading…</p>}
      {open && art && (
        <>
          <div class="ww-text">
            {art.map(([heading, segs], i) => (
              <div key={i}>
                {heading && <h4>{heading}</h4>}
                {paragraphs(segs).map((p, j) => (
                  <p key={j}>
                    {p.map((s, k) => (
                      <Seg key={k} s={s} />
                    ))}
                  </p>
                ))}
              </div>
            ))}
          </div>
          <Provenance>
            From <i>{HANDBOOK_TITLE[handbook]}</i>, United Bible Societies (CC BY-SA 4.0), adapted. Linked to this word by the verses it cites.
          </Provenance>
        </>
      )}
    </div>
  );
}

function InTheirWorld({ a, root, links, index, isOpen, toggle }: { a: Atlas; root: number; links: UbsLink[]; index: UbsIndex; isOpen: (k: string) => boolean; toggle: (k: string) => void }) {
  const shown = links.filter((l) => index.entries[l[0]]);
  if (!shown.length) return null;
  const [main, ...rest] = shown;
  const othersId = `ww-others-${root}`;
  const item = (l: UbsLink, lead: ComponentChildren, extra?: () => ComponentChildren) => {
    const [, , title, text] = index.entries[l[0]];
    const k = `u${l[0]}`;
    const id = `ww-ubs-${root}-${l[0]}`;
    const open = isOpen(k);
    return (
      <>
        <Line
          actions={() => (
            <>
              <Toggle open={open} controls={id} onToggle={() => toggle(k)} label="Read more" openLabel="Show less" />
              {extra?.()}
            </>
          )}
        >
          {lead}
          <b>{title}</b>
          {!open && <> — {text}</>}
        </Line>
        <ArticlePanel key={l[0]} a={a} entry={l[0]} handbook={index.entries[l[0]][0]} id={id} open={open} onFail={() => open && toggle(k)} />
      </>
    );
  };
  const othersOpen = isOpen('others');
  return (
    <>
      {item(
        main,
        <>
          <b class="ww-in">In their world:</b>{' '}
        </>,
        rest.length
          ? () => <Toggle open={othersOpen} controls={othersId} onToggle={() => toggle('others')} label={`+${rest.length} more`} openLabel={`Hide ${rest.length}`} />
          : undefined,
      )}
      {rest.length > 0 && (
        <div class="ww-others" id={othersId} hidden={!othersOpen}>
          {othersOpen &&
            rest.map((l) => (
              <div key={l[0]} class="ww-other">
                {item(l, null)}
              </div>
            ))}
        </div>
      )}
    </>
  );
}

export function WordWorld({ a, root, verse }: { a: Atlas; root: number; verse?: number }) {
  const [data, setData] = useState<{ root: number; w: RootWorld | null } | null>(null);
  const [index, setIndex] = useState<UbsIndex | null>(null);
  // What is open belongs to one study: every new study, even a return to an
  // earlier one, opens simple. (isOpen ignores keys of another study, so
  // nothing flashes open before the reset lands.)
  const study = `${root}:${verse ?? ''}`;
  const [open, setOpen] = useState<{ study: string; keys: ReadonlySet<string> }>({ study, keys: new Set() });
  useEffect(() => setOpen((o) => (o.study === study ? o : { study, keys: new Set() })), [study]);

  useEffect(() => {
    let live = true;
    rootWorld(a, root).then(
      (w) => live && setData({ root, w }),
      () => live && setData({ root, w: null }),
    );
    return () => {
      live = false;
    };
  }, [a, root]);

  const w = data && data.root === root ? data.w : null;
  const links = useMemo(() => entriesFor(a, w, root, verse), [a, w, root, verse]);
  const needIndex = links.length > 0;
  useEffect(() => {
    if (!needIndex || index) return;
    let live = true;
    ubsIndex(a).then(
      (i) => live && setIndex(i),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [a, needIndex, index]);

  if (!w) return null;
  const isOpen = (k: string) => open.study === study && open.keys.has(k);
  const toggle = (k: string) =>
    setOpen((o) => {
      const keys = new Set(o.study === study ? o.keys : []);
      if (keys.has(k)) keys.delete(k);
      else keys.add(k);
      return { study, keys };
    });
  const lsj = hasLsj(w);
  const ubs = needIndex && index !== null && links.some((l) => index.entries[l[0]]);
  if (!lsj && !ubs) return null;
  return (
    <div class="ww">
      {lsj && <OutsideTheBible w={w} id={`ww-lsj-${root}`} open={isOpen('lsj')} onToggle={() => toggle('lsj')} />}
      {ubs && <InTheirWorld a={a} root={root} links={links} index={index} isOpen={isOpen} toggle={toggle} />}
    </div>
  );
}
