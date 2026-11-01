import fs from 'fs';
import { hebrewGrammar, greekGrammar } from './morph.ts';
const norm = (s: string) => s.replace(/^Verb : /, 'Verb: ').replace(/resultive\/transtive/g, 'resultative/transitive').replace(/\s+/g, ' ').trim();
// Hebrew: compare each part against the key's line 2.
const segs = JSON.parse(fs.readFileSync('he-segs.json', 'utf8')) as [string, number, string | null, string | null][];
let ok = 0, okN = 0, bad: any[] = [], totN = 0;
for (const [k, n, l2] of segs) {
  totN += n;
  const mine = hebrewGrammar(k);
  const mineNoLang = mine?.replace(/^Aramaic: /, '') ?? null;
  if (l2 && mineNoLang === norm(l2)) { ok++; okN += n; } else bad.push([k, n, mineNoLang, l2 && norm(l2)]);
}
console.log('HEBREW parts', segs.length, 'match', ok, 'words-weighted', okN, '/', totN);
for (const b of bad.sort((a, b) => b[1] - a[1])) console.log('  ', JSON.stringify(b));
// every whole code decodes?
const he = JSON.parse(fs.readFileSync('codes-he.json', 'utf8')) as [string, number][];
const undecoded = he.filter(([c]) => !hebrewGrammar(c));
console.log('HEBREW whole codes', he.length, 'undecoded', undecoded.length, undecoded.slice(0, 10));
// Greek
const gr = JSON.parse(fs.readFileSync('gr-codes.json', 'utf8')) as [string, number, string | null, string | null][];
let gok = 0, gokN = 0, gtot = 0; const gbad: any[] = [];
const dedupe = (s: string) => s.replace(/\b(\w+)( \1\b)+/g, '$1');
for (const [c, n, l2] of gr) {
  gtot += n;
  const mine = greekGrammar(c);
  if (l2 === null) { if (!mine) gbad.push([c, n, mine, 'compound']); else { gok++; gokN += n; } continue; }
  if (mine === dedupe(norm(l2))) { gok++; gokN += n; } else gbad.push([c, n, mine, l2]);
}
console.log('GREEK codes', gr.length, 'match', gok, 'words-weighted', gokN, '/', gtot);
for (const b of gbad.sort((a, b) => b[1] - a[1])) console.log('  ', JSON.stringify(b));
const grNull = gr.filter(([c]) => !greekGrammar(c));
console.log('GREEK undecoded', grNull.length, grNull.slice(0, 10));
const heNull = he.filter(([c]) => !hebrewGrammar(c)).reduce((s, [, n]) => s + n, 0);
console.log('HEBREW words with no words for their code', heNull);
for (const c of ['HTd/Ncmpa', 'Hc/Vqw3ms', 'HR/Ncmsc//Npl', 'ANcmsd', 'V-AAI-3S', 'CONJ + G1437=COND', 'S-1SGSN', 'N-GSM-T', 'PRT-N']) console.log(c, '=>', hebrewGrammar(c) ?? greekGrammar(c));
