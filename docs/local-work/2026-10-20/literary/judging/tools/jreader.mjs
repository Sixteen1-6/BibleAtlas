// Phone journeys through the reader mockup.
import fs from 'node:fs';
const theme = process.argv[2] || 'light';
const ps = (process.argv[3] || 'ps1,ps19,isa6,gen6,sam1').split(',');
const jobs = [];
const links = "(()=>{const r=document.querySelector('#p-%ID%');return r? [...r.querySelectorAll('a,button')].filter(a=>a.getClientRects().length).map(a=>(a.innerText||a.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim().slice(0,70)+' => '+(a.getAttribute('href')||Object.keys(a.dataset).join(','))):null})()";
for (const p of ps) {
  const base = { file: 'mock-reader.html', w: 390, h: 844, scheme: theme, settle: 1500, esel: '.app' };
  for (const level of ['simple', 'study', 'deep']) {
    const n = `pr-${p}-${theme}-${level}`;
    const steps = [
      { scrollTo: { sel: `#p-${p} .fx-by, #p-${p} .fx-src, #p-${p} [data-src]` } },
      { eshot: n + '-a', esel: '.app' },
      { etext: n + '-a', tsel: `#p-${p}` },
      { eval: links.replace('%ID%', p) },
    ];
    if (level !== 'deep') {
      steps.push({ clickText: { sel: `#p-${p} [data-src]`, text: '' } });
      steps.push({ scrollTo: { sel: `#p-${p} .fx-src` } });
      steps.push({ eshot: n + '-src', esel: '.app' });
      steps.push({ etext: n + '-src', tsel: `#p-${p}` });
    } else {
      steps.push({ clickText: { sel: `#p-${p} [data-words]`, text: '' } });
      steps.push({ eshot: n + '-notice1', esel: '.app' });
      steps.push({ etext: n + '-notice1', tsel: '#notice' });
      steps.push({ clickText: { sel: '#notice [data-nt="next"]', text: '' } });
      steps.push({ eshot: n + '-notice2', esel: '.app' });
      steps.push({ etext: n + '-notice2', tsel: '#notice' });
      steps.push({ clickText: { sel: '#notice [data-nt="done"]', text: '' } });
      steps.push({ scrollTo: { sel: `#p-${p} .fx-src` } });
      steps.push({ eshot: n + '-words', esel: '.app' });
      steps.push({ etext: n + '-words', tsel: `#p-${p}` });
    }
    jobs.push({ ...base, name: n, query: `level=${level}&theme=${theme}&width=phone&p=${p}`, steps });
  }
}
fs.writeFileSync(`jobs-pr-${theme}.json`, JSON.stringify(jobs, null, 1));
console.log(jobs.length);
