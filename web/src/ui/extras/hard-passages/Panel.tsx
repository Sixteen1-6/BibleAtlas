// The panel behind a "A hard passage" line: the passages side by side, then
// the pages on other websites that answer them. Nothing of the app's own
// draft answer shows here. The passages are Scripture and always show; the
// answers are commentary, closed until the reader finishes the notice.

import { CitedSource } from '../../Sources';
import { Commentary, CommentaryFoot } from '../../commentary/Gate';
import { Lead, Passage, SideBySide, SourceNote } from '../kit';
import type { PanelProps } from '../types';
import { type Data, linksOn, passagesOn } from './model';

/** Passages shown side by side, at most. */
const SIDE_BY_SIDE = 3;

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const passages = passagesOn(data, verse);
  const links = linksOn(data, verse);
  const many = passages.length > 1;
  return (
    <>
      <Lead>
        People often find {many ? 'these passages' : 'this passage'} hard to understand. Below {many ? 'them' : 'it'} are pages on other websites that answer the questions {many ? 'they raise' : 'it raises'}.
      </Lead>
      <SideBySide>
        {passages.slice(0, SIDE_BY_SIDE).map(([s, e]) => (
          <Passage key={`${s}-${e}`} a={a} from={s} to={e > s ? e : undefined} navigate={navigate} />
        ))}
      </SideBySide>
      <Commentary line={`Other websites answer the questions ${many ? 'these passages raise' : 'this passage raises'}.`} button="Show the answers">
        <h4 class="x-hard-passages-h">Answers on other websites</h4>
        <ul class="x-hard-passages-links">
          {links.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                {l.title}
              </a>{' '}
              <span class="x-hard-passages-site">
                <CitedSource a={a} text={l.site} />
              </span>
            </li>
          ))}
        </ul>
        <p class="x-hard-passages-quiet">Each website answers from its own point of view. Nothing from them is copied here.</p>
      </Commentary>
      <CommentaryFoot />
      <SourceNote>The passages are from the Berean Standard Bible.</SourceNote>
    </>
  );
}
