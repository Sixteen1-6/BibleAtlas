// First-visit card above the reader: what an arc is, and three places to start.

import * as S from '../state';

const STARTERS: { title: string; ref: string; why: string }[] = [
  { title: 'By His stripes', ref: 'Isaiah 53:5', why: 'Quoted centuries later in 1 Peter 2:24: “By His stripes you are healed.”' },
  { title: 'Lifted up', ref: 'John 3:14', why: 'Jesus points back to the bronze snake Moses lifted up.' },
  { title: 'A father, a son and a lamb', ref: 'Genesis 22:8', why: '“God Himself will provide the lamb…” John 1:36: “Look, the Lamb of God!”' },
];

export async function openStarter(ref: string): Promise<void> {
  const r = await S.engine.value?.parseRef(ref);
  if (!r) return;
  S.selectVerse(r[0]);
  S.mobilePane.value = 'study';
}

export function Welcome() {
  if (S.welcome.value !== 'show') return null;
  return (
    <section class="welcome" aria-label="Getting started">
      <p class="lead">
        Each arc joins two passages that Bible readers have linked. {S.TAP} any verse, on the map or in the text, to see what it connects to and the Hebrew or
        Greek behind it.
      </p>
      <div class="starters">
        {STARTERS.map((s) => (
          <button key={s.ref} class="starter" onClick={() => openStarter(s.ref)}>
            <b>{s.title}</b>
            <span class="ref">{s.ref}</span>
            <span class="why">{s.why}</span>
          </button>
        ))}
      </div>
      <button class="btn dismiss" onClick={() => (S.welcome.value = 'hidden')}>
        Got it
      </button>
    </section>
  );
}
