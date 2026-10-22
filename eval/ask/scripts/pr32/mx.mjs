// node mx.mjs '{"least":1e-3}' out.json: train with options on the cls rows (terms from tok.cjs), write pruned weights
import { readFileSync, writeFileSync } from 'node:fs';
const M = await import(process.env.ATLAS_REPO + '/web/scripts/ask-meaning.mjs');
const D = process.env.ASK_WORK + '/scratchpad/eval2/';
const meta = JSON.parse(readFileSync(D + 'cls-meta.json', 'utf8'));
const T = JSON.parse(readFileSync(D + 'cls-terms.json', 'utf8'));
const kindName = { title: 'title', also: 'also', sig: 'signal', ex: 'example' };
const data = meta.rows.map(([k, c], i) => [c, kindName[k], new Set(T[i])]).filter(([c, k]) => c >= 0 && k);
const opts = { ...M.TRAIN, ...JSON.parse(process.argv[2] || '{}') };
const keep = opts.keep ?? M.KEEP;
const t0 = Date.now();
const model = M.train(data, meta.ids.length, opts);
const w = M.prune(model, meta.ids.length, keep);
const entries = Object.values(w).reduce((s, e) => s + e.length / 2, 0);
writeFileSync(process.argv[3], JSON.stringify({ scale: M.SCALE, w }));
console.log(JSON.stringify(opts), entries, 'weights', ((Date.now() - t0) / 1000).toFixed(1) + 's');
