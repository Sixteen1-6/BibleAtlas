// Ask the Bible, under a verse: "People ask: What happens when we die?" on the
// verses of each approved question's chain, from Study on (Simple keeps to the
// verse and its strongest links). The panel lists the questions; where there is
// only one, which the line already names, tapping the line opens it at once.

import { useLayoutEffect } from 'preact/hooks';
import { loadAskTitles, openAsk } from '../ask/ask';
import { readerHere } from './first-move';
import { Lead } from './kit';
import { type NoteLine, type PanelProps, type VerseRef, defineExtra } from './types';
import type { QuestionTitle } from '../ask/ask';

interface Data {
  /** Questions whose key verses include the verse. */
  byVerse: Map<VerseRef, QuestionTitle[]>;
}

function Panel({ data, verse }: PanelProps<Data>) {
  const qs = data.byVerse.get(verse) ?? [];
  // A list of one would only repeat the line: open the question itself.
  useLayoutEffect(() => {
    if (qs.length === 1) openAsk({ kind: 'question', q: qs[0] });
  }, [verse]);
  return (
    <>
      <Lead>People ask about this verse:</Lead>
      <ul class="x-ask-list">
        {qs.map((q) => (
          <li key={q.id}>
            <button type="button" class="x-ask-q" onClick={() => openAsk({ kind: 'question', q })}>
              {q.q} <span aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export default defineExtra<Data>({
  id: 'ask',
  order: 40,
  title: 'Ask the Bible',
  level: 'study',
  async load(a) {
    await readerHere('ask');
    const ix = await loadAskTitles(a);
    const byVerse = new Map<VerseRef, QuestionTitle[]>();
    // The verses of each question's chain, where Scripture answers it.
    for (const q of ix.questions) {
      for (const [s, e] of q.r) {
        for (let v = s; v <= e; v++) {
          const list = byVerse.get(v);
          if (list) list.push(q);
          else byVerse.set(v, [q]);
        }
      }
    }
    return { byVerse };
  },
  note(verse, d): NoteLine | null {
    const qs = d.byVerse.get(verse);
    if (!qs) return null;
    return qs.length === 1 ? `People ask: ${qs[0].q}` : `People ask: ${qs[0].q} and ${qs.length - 1} more`;
  },
  Panel,
});
