// Where every piece of data came from, pinned to commits and checksums.

import type { Atlas } from '../data/atlas';
import { ESV_ENABLED } from '../data/esv';

const LABELS: Record<string, string> = {
  verses: 'verses',
  crossReferences: 'cross-references',
  roots: 'Hebrew, Aramaic and Greek roots',
  hebrewWords: 'Hebrew words',
  aramaicWords: 'Aramaic words',
  greekWords: 'Greek words',
  significantVariants: 'words where manuscripts differ in meaning',
  englishWords: 'distinct English words indexed',
};

export function Sources({ a }: { a: Atlas }) {
  const m = a.meta;
  const unmapped = Object.values(m.unmapped).reduce((s, x) => s + x, 0);
  return (
    <div class="panel">
      <h2>Sources and checks</h2>
      <p>Everything here comes from openly licensed datasets, each pinned to an exact git commit and checked against a SHA-256 hash before every build. Nothing is typed in by hand except the theme word lists and the table that assigns chapters and books to the Tyndale Open Bible Dictionary's eras and dates; every quotation in that table is checked word for word against the dictionary when the data is built.</p>
      <div class="stats">
        {Object.entries(LABELS).map(([k, l]) => (
          <div key={k}>
            <b>{(m.counts[k] ?? 0).toLocaleString()}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <p class="muted">
        {unmapped === 0 ? 'Every cross-reference and every original-language word in the sources was mapped to a verse; nothing was dropped.' : `${unmapped} source rows could not be mapped to a verse.`} Build <code>{m.buildId}</code>.
      </p>

      <h3>Datasets</h3>
      {m.sources.map((s) => (
        <div class="src" key={s.id}>
          <b>{s.title}</b>
          <p style="margin:4px 0">{s.provides}</p>
          <p class="muted" style="margin:4px 0">
            License: {s.license}.{' '}
            <a href={s.homepage} target="_blank" rel="noopener">
              Project page
            </a>{' '}
            ·{' '}
            <a href={`${s.repo}/tree/${s.commit}`} target="_blank" rel="noopener">
              Commit {s.commit.slice(0, 10)}
            </a>
          </p>
          <p class="muted" style="margin:4px 0;font-size:12px">{s.attribution}</p>
          {s.note && <p class="muted" style="margin:4px 0;font-size:12px">{s.note}</p>}
          {s.files.map((f) => (
            <div key={f.path} class="hash" title={f.path}>
              SHA-256 {f.sha256}
            </div>
          ))}
        </div>
      ))}

      <h3>ESV</h3>
      <p>
        The ESV text is requested one chapter at a time from Crossway’s API through this site’s server, which holds the API key and never stores more than 500 verses, as the{' '}
        <a href="https://api.esv.org/" target="_blank" rel="noopener">
          ESV API terms
        </a>{' '}
        require. Search, the map and the word links use the BSB, which is public domain.
        {!ESV_ENABLED && ' This copy of the site has no server, so the ESV is turned off here. Run it yourself with an ESV API key to read the ESV.'}
      </p>

      <h3>How to check it yourself</h3>
      <p>
        Clone the repository and run <code>make data</code>. It downloads the same files, verifies their hashes, rebuilds every output and runs the verification suite, which checks, among other things, that Genesis 1:1 begins בראשית, that John 1:1 uses λόγος three times, that Daniel 2:5 is Aramaic, and that every word index points at the right word. The build is deterministic: the same inputs give the same build id.
      </p>
      <h3>What the map does and does not show</h3>
      <p>
        A cross-reference means readers judged two passages to be related; the vote count shows how many agreed. The map shows how densely the text refers to itself across books written over many centuries. It shows connections, not proof, and every connection can be traced back to its source here.
      </p>
    </div>
  );
}
