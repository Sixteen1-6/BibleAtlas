// matrix.mjs <card|reader|arcs> : writes jobs-<mock>.json for 2 widths x 2 themes x 3 levels.
import fs from 'node:fs';
const mock = process.argv[2];
const ex = process.argv[3] || '';
const jobs = [];
for (const w of [1440, 390]) for (const theme of ['light', 'dark']) for (const level of ['simple', 'study', 'deep']) {
  const name = `${mock}${ex ? '-' + ex : ''}-${w}-${theme}-${level}`;
  const j = { name, w, h: w > 700 ? 900 : 844, scheme: theme, dump: true, shot: true, full: w < 700, settle: 1600 };
  if (mock === 'card') { j.file = 'mock-card.html'; j.hash = `level=${level}&theme=${theme}&w=${w > 700 ? 'desktop' : 'phone'}${ex ? '&ex=' + ex : ''}`; }
  if (mock === 'reader') { j.file = 'mock-reader.html'; j.query = `level=${level}&theme=${theme}&width=${w > 700 ? 'desktop' : 'phone'}${ex ? '&p=' + ex : ''}`; }
  if (mock === 'arcs') { j.file = 'mock-arcs.html'; j.hash = `level=${level}&theme=${theme}&view=${w > 700 ? 'desktop' : 'phone'}${ex ? '&ex=' + ex : ''}`; }
  jobs.push(j);
}
fs.writeFileSync(`jobs-${mock}${ex ? '-' + ex : ''}.json`, JSON.stringify(jobs, null, 1));
console.log(jobs.length, 'jobs');
