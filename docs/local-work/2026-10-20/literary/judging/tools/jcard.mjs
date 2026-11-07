// Phone journeys through the card mockup: per example, Simple (Read pane, line, sheet), Study and Deep (Explore pane, card).
import fs from 'node:fs';
const theme = process.argv[2] || 'light';
const exs = (process.argv[3] || 'psalm-1,psalm-19,isaiah-6,genesis-6,hannah').split(',');
const jobs = [];
for (const ex of exs) {
  const base = { file: 'mock-card.html', w: 390, h: 844, scheme: theme, settle: 1500 };
  jobs.push({ ...base, name: `pc-${ex}-${theme}-simple`, hash: `level=simple&theme=${theme}&w=phone&ex=${ex}&pane=read`,
    steps: [
      { scrollTo: { sel: '#frame .xt-line' } },
      { eshot: `pc-${ex}-${theme}-simple-read` }, { etext: `pc-${ex}-${theme}-simple-read` },
      { clickText: { sel: '#frame .xt-line', text: '' } },
      { eshot: `pc-${ex}-${theme}-simple-sheet` }, { etext: `pc-${ex}-${theme}-simple-sheet`, tsel: '#frame .xt-panel' },
    ] });
  for (const level of ['study', 'deep']) {
    jobs.push({ ...base, name: `pc-${ex}-${theme}-${level}`, hash: `level=${level}&theme=${theme}&w=phone&ex=${ex}&pane=study`,
      steps: [
        { scrollTo: { sel: '#frame section.dv' } },
        { eshot: `pc-${ex}-${theme}-${level}-card` }, { etext: `pc-${ex}-${theme}-${level}-card`, tsel: '#frame section.dv' },
        { eval: "(()=>{const s=document.querySelector('#frame section.dv');return s? [...s.querySelectorAll('a,button')].map(a=>(a.innerText||'').trim().slice(0,60)+' => '+(a.getAttribute('href')||a.dataset.act||'')+(a.title?' ['+a.title+']':'')):null})()" },
      ] });
  }
}
fs.writeFileSync(`jobs-pc-${theme}.json`, JSON.stringify(jobs, null, 1));
console.log(jobs.length);
