// The panel behind the Syriac line: the verse in Syriac, right to left, with
// an approximate romanization, the BSB beside it (and the Greek, at Deep), and
// plainly what this text is and is not: a translation made from the Greek
// centuries after Jesus, not his own words.

import '../peshitta.css';
// The Syriac letters, scoped to this panel: only .x-peshitta-syc uses the font,
// and it loads with this panel's code.
import '@fontsource/noto-sans-syriac/syriac-400.css';
import type { ComponentChildren } from 'preact';
import { locate } from '../../../data/atlas';
import { useJson } from '../data';
import { Facts, Lead, Passage, SideBySide, SourceNote, Unsure } from '../kit';
import type { PanelProps } from '../types';
import { type BookFile, type Data, type Kind, LATER, slot } from './model';

/** Books the early Peshitta did not have (the rest of LATER is John 7:53-8:11). */
const LATER_BOOKS = new Set(['2Pet', '2John', '3John', 'Jude', 'Rev']);

/** Why a verse sits where it does, when the source numbers it differently. */
function placed(kind: Kind, src: string): string {
  switch (kind) {
    case 'coded':
      return `The digital edition codes this verse as ${src}, at the top of the next chapter, by mistake. It is shown here, where its words belong.`;
    case 'order':
      return `The Syriac has this verse and the one next to it in the other order; there it is verse ${src}. They are matched here by their words.`;
    case 'number':
      return `The Syriac numbers this verse ${src}. The verses are matched here by their words.`;
    case 'split':
      return `The Syriac splits this verse in two (${src}). Both parts are shown.`;
  }
}

export function Panel({ a, data, verse, navigate }: PanelProps<Data>) {
  const book = a.books[locate(a, verse).book];
  const file = useJson<BookFile>(a, `extras/peshitta/${book.osis}.json`);
  const later = data.kind[verse] === LATER;
  const what = LATER_BOOKS.has(book.osis) ? 'This book' : 'This passage';

  const i = file ? slot(file, verse) : -1;
  const syc = file && i >= 0 ? file.syc[i] : '';
  const rom = file && i >= 0 ? file.rom[i] : '';
  const note = file?.notes[String(verse)];
  const omitted = file?.omitted.includes(verse) ?? false;
  const date = file?.date ?? [350, 450];

  const facts: [ComponentChildren, ComponentChildren][] = [
    ['Language', 'Syriac, a dialect of Aramaic, written right to left'],
    [
      'Translated',
      later ? (
        <>
          From the Greek, in a later Syriac version, probably of the 500s or 600s <Unsure>which version is debated</Unsure>
        </>
      ) : (
        `From the Greek, around AD ${date[0]}–${date[1]}`
      ),
    ],
    ['Printed edition', 'The New Testament in Syriac, British and Foreign Bible Society, 1905'],
    ['Digital text', 'Transcribed by George A. Kiraz; TEI XML edition by James E. Walters (Digital Syriac Corpus)'],
  ];
  if (file) {
    facts.push([
      'Proofreading',
      file.status === 'UncorrectedTranscription' ? (
        <>
          This digital text has not yet been fully proofread against the printed edition <Unsure>uncorrected transcription</Unsure>
        </>
      ) : (
        `The source gives its status as “${file.status}”`
      ),
    ]);
  }
  if (rom) facts.push(['Romanization', 'Made by this app from the vowel points, letter by letter, and only approximate. (ī) and (ū) mark a letter that is written but not said.']);
  if (note) facts.push(['Verse number in the Syriac', note[1]]);

  return (
    <>
      <Lead>
        {later
          ? `${what} was not in the Peshitta, the early Syriac translation of about AD 350–450. The Syriac here comes from a later translation from the Greek, which printed Syriac Bibles use to fill the gap. Syriac is a dialect of Aramaic; this is not a record of Jesus’ own words.`
          : 'This is the verse in Syriac, a dialect of Aramaic, from the Peshitta: a translation made from the Greek around AD 350–450, centuries after Jesus. It shows how early Aramaic-speaking Christians read the verse; it is not a record of Jesus’ own words.'}
      </Lead>
      <SideBySide>
        {file !== null && (file === undefined || syc) && (
          <section class="xt-passage x-peshitta-card" aria-label="The verse in Syriac">
            <p class="x-peshitta-head">
              {later ? 'Syriac, a later version' : 'Syriac Peshitta'}
            </p>
            {file === undefined ? (
              <p class="xt-ptext xt-wait">…</p>
            ) : (
              <>
                <p class="x-peshitta-syc" lang="syc" dir="rtl">
                  {syc}
                </p>
                {rom && (
                  <p class="x-peshitta-rom">
                    <span lang="syc-Latn">{rom}</span>
                    <Unsure title="Read letter by letter from the vowel points: a rough guide to the letters, not to how Jesus spoke">approximate</Unsure>
                  </p>
                )}
              </>
            )}
          </section>
        )}
        <Passage a={a} from={verse} navigate={navigate} note="Berean Standard Bible, translated from the Greek" />
      </SideBySide>
      {note && <p class="x-peshitta-placed">{placed(note[0], note[1])}</p>}
      {omitted && <p class="x-peshitta-placed">The BSB leaves this verse out of its main text and gives it in a footnote; the Syriac has it.</p>}
      <h3>About this text</h3>
      <Facts rows={facts} />
      <SourceNote>
        Syriac text from the Digital Syriac Corpus (syriaccorpus.org): TEI XML edition by James E. Walters, CC BY 4.0. Base text: The New Testament in Syriac (British and Foreign Bible Society, 1905), public domain, transcribed by George A. Kiraz. Verse numbers matched to the BSB, and the romanization added, by this app.
      </SourceNote>
    </>
  );
}
