// The plain words of the panel: the sentence at the top, and at Deep a short
// note on what kind of parallel this is. Each says only what the texts show or
// what is widely held, and marks what scholars still discuss.

import type { ComponentChildren } from 'preact';
import { type Atlas, chapterRange, locate } from '../../../data/atlas';
import { Unsure } from '../kit';
import { type PSet, type Span, and, bookNames, bookOf } from './model';

const TIMES = ['', 'once', 'twice', 'three times', 'four times', 'five times', 'six times'];

/** Whether a passage is a whole chapter (a whole psalm). */
function whole(a: Atlas, p: Span): boolean {
  const l = locate(a, p.from);
  const [start, end] = chapterRange(a, l.book, l.chapter);
  return p.from === start && p.to === end - 1;
}

/** The sentence at the top of the panel: what the reader is looking at. */
export function lead(a: Atlas, s: PSet): string {
  const books = bookNames(a, s);
  const names = and(books);
  const times = TIMES[s.passages.length] ?? `${s.passages.length} times`;
  const one = books.length === 1;
  const both = books.length === 2 ? 'both' : 'each';
  switch (s.kind) {
    case 'account':
      return one ? `${names} tells this ${times}, in different words.` : `${names} ${both} tell this, in their own words.`;
    case 'event':
      return one ? `${names} tells these events ${times}.` : `${names} ${both} tell these events.`;
    case 'song': {
      // A whole song twice, or only some of its lines.
      const song = s.passages.every((p) => whole(a, p));
      if (one) return song ? `This song is in the book of ${names} ${times}.` : `These words appear ${times} in the book of ${names}.`;
      return `${song ? 'This song is' : 'These words are'} found in ${books.length === 2 ? 'both ' : ''}${names}.`;
    }
    case 'list':
      return one ? `${names} gives this list ${times}.` : `${names} give the same list.`;
    case 'law':
      return one ? `${names} gives this law ${times}.` : `${names} give the same law.`;
    case 'prophecy':
      return one ? `${names} gives this prophecy ${times}.` : `${names} give much the same prophecy.`;
    case 'letter':
      return one ? `${names} says much the same ${times}.` : `${names} say much the same here.`;
  }
}

/** Deep: what kind of parallel this is, in a sentence or two. */
export function KindNote({ a, s }: { a: Atlas; s: PSet }) {
  const osis = new Set(s.passages.map((p) => a.books[bookOf(a, p)].osis));
  const has = (...ids: string[]) => ids.some((id) => osis.has(id));
  const out: ComponentChildren[] = [];
  const say = (text: ComponentChildren) => out.push(<p key={out.length}>{text}</p>);
  switch (s.kind) {
    case 'account': {
      const gospels = ['Matt', 'Mark', 'Luke'].filter((b) => osis.has(b)).length;
      if ([...osis].every((b) => b === 'Acts')) {
        say('Acts tells this more than once: as it happened, and again in the words of one who was there.');
        break;
      }
      if (gospels >= 2 && !osis.has('Mark')) {
        say(
          <>
            Matthew and Luke share much that Mark does not have, above all sayings of Jesus. How they came to share it is still discussed.
            <Unsure>scholars differ</Unsure>
          </>,
        );
      } else if (gospels >= 2) {
        say(
          <>
            Matthew, Mark and Luke often tell the same event in much the same words and order. Most think one of them drew on another, but how they are related is still discussed.
            <Unsure>scholars differ</Unsure>
          </>,
        );
      }
      if (has('John')) say('John tells fewer of the same events than the others, and in his own way.');
      if (has('Acts')) say('The writer of Luke’s Gospel tells this again at the start of Acts (Acts 1:1–2).');
      if (has('1Cor')) say('Paul passes on the words of Jesus at the Last Supper as he had received them (1 Corinthians 11:23).');
      if (has('2Pet')) say('Peter recalls being with Jesus on the holy mountain (2 Peter 1:16–18).');
      break;
    }
    case 'event':
      if (has('1Sam', '2Sam', '1Kgs', '2Kgs') && has('1Chr', '2Chr')) {
        say('Chronicles was written after the return from exile. It retells much of the history in Samuel and Kings, often in the same words, and adds some things and leaves others out.');
      } else if (has('2Kgs') && has('Isa')) {
        say('These chapters of 2 Kings and Isaiah tell the same events in almost the same words.');
      } else if (has('2Kgs') && has('Jer')) {
        say('2 Kings and Jeremiah tell the last days of Judah, often in the same words.');
      } else if (has('2Chr') && has('Ezra')) {
        say('Chronicles ends with the words that open Ezra: the decree of Cyrus that let the exiles go home.');
      } else if (has('Deut')) {
        say('In Deuteronomy, Moses looks back over the journey and retells these events to the people.');
      } else if (has('Josh') && has('Judg')) {
        say('Judges retells some events from the book of Joshua.');
      } else {
        say('Two books tell the same events, often in the same words.');
      }
      break;
    case 'song':
      if (has('2Sam')) say('David’s song is kept twice: in 2 Samuel 22 and as Psalm 18, with small differences.');
      else if (has('1Chr')) say('When the ark is brought to Jerusalem, David gives a song of thanks (1 Chronicles 16:7) that matches parts of Psalms 105, 96 and 106.');
      else say('Some songs, or parts of songs, appear twice in the book of Psalms, with small differences.');
      break;
    case 'list':
      if (has('Gen') && has('1Chr')) say('1 Chronicles opens with family lists that follow Genesis, often shortened to the names alone.');
      else if (has('Ezra') && has('Neh')) say('Ezra and Nehemiah give the same list of those who came back from exile, with some differences in the numbers.');
      else say('The same list is kept in two books, with some differences in the names.');
      break;
    case 'law':
      say('In Deuteronomy, Moses gives the law again to the next generation, at times with changes or reasons added.');
      break;
    case 'prophecy':
      say(
        <>
          The same prophecy is found in two books, in much the same words. Whether one prophet took it from the other, or both from an older prophecy, is not known.
          <Unsure>scholars differ</Unsure>
        </>,
      );
      break;
    case 'letter':
      if (has('Eph') && has('Col')) {
        say('Ephesians and Colossians share much of their teaching and many of their words. Both send Tychicus with news, in the same words (Ephesians 6:21–22, Colossians 4:7–8).');
      } else if (has('2Pet') && has('Jude')) {
        say(
          <>
            2 Peter and Jude warn against false teachers in much the same words and pictures. Most think one writer used the other, but which came first is still discussed.
            <Unsure>scholars differ</Unsure>
          </>,
        );
      } else if (has('1Tim') && has('Titus')) {
        say('The letters to Timothy and Titus give much the same list of what to look for in a church’s leaders.');
      } else if (has('2John') && has('3John')) {
        say('The two short letters from “the elder” open and close in much the same words.');
      } else {
        say('Two letters say much the same, in many of the same words.');
      }
      break;
  }
  return <>{out}</>;
}
