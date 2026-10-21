import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { rows, train, prune, best, texts, idsHash, SCALE } from './am.mjs';
import * as words from './words.ts';
const R = process.argv[2];
const qs = JSON.parse(readFileSync(R + '/config/questions.json', 'utf8')).questions;
const examples = JSON.parse(readFileSync(R + '/config/ask-examples.json', 'utf8')).examples;
const index = { questions: qs.map((q) => ({ id: q.id, q: q.question.trim() })) };
const also = qs.map((q) => q.also);
const signals = qs.map((q) => q.signals ?? []);
const C = index.questions.length;
const data = rows(index, also, signals, examples).map(([c, kind, s]) => [c, kind, words.terms(s)]);
const t0 = Date.now();
const model = train(data, C);
const w = prune(model, C);
const secs = (Date.now() - t0) / 1000;
let right = 0, all = 0;
for (const [c, kind, ts] of data) { if (kind !== 'example' || !ts.size) continue; all++; if (best(w, C, ts) === c) right++; }
const tx = texts(data, C);
const out = { format: 2, key: 'local', ids: idsHash(index.questions.map((q) => q.id)), scale: SCALE, w, texts: tx };
const json = JSON.stringify(out);
writeFileSync(process.argv[3], json);
const entries = Object.values(w).reduce((s, e) => s + e.length / 2, 0);
const wjson = JSON.stringify(w), tjson = JSON.stringify(tx);
console.log({ texts: data.length, emptyTexts: data.filter(d=>!d[2].size).length, vocab: model.vocab.size, termsKept: Object.keys(w).length, weightsKept: entries, right, all, pct: (100*right/all).toFixed(1), trainSecs: secs,
  rawBytes: json.length, gzBytes: gzipSync(json, { level: 9 }).length, gz6: gzipSync(json).length, wRaw: wjson.length, wGz: gzipSync(wjson).length, textsRaw: tjson.length, textsGz: gzipSync(tjson).length, textTerms: tx.terms.length });
