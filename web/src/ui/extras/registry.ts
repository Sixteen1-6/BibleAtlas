// Every extra is one file named <id>.extra.tsx in this folder, exporting its
// Extra object as the default export. They are found here at build time, so
// adding a feature means adding a file and editing no shared list.

import { LEVELS } from './level';
import type { Extra } from './types';

// The registry holds extras of every data type; each file is type-checked on
// its own through defineExtra().
export type AnyExtra = Extra<any>;

export const EXTRA_ID = /^[a-z][a-z0-9-]{0,31}$/;

const modules = import.meta.glob<{ default?: AnyExtra }>('./*.extra.tsx', { eager: true });

function problems(file: string, x: AnyExtra | undefined, seen: Set<string>): string[] {
  if (!x || typeof x !== 'object') return ['it has no default export (export default defineExtra({ ... }))'];
  const out: string[] = [];
  if (typeof x.id !== 'string' || !EXTRA_ID.test(x.id)) out.push(`its id ${JSON.stringify(x.id)} must be lowercase letters, digits and hyphens`);
  else if (x.id !== file) out.push(`its id "${x.id}" must match its file name, ${file}.extra.tsx`);
  else if (seen.has(x.id)) out.push(`another extra already uses the id "${x.id}"`);
  if (typeof x.order !== 'number' || !Number.isFinite(x.order)) out.push('order must be a number');
  if (typeof x.title !== 'string' || !x.title.trim()) out.push('title must be a short plain name');
  if (x.level !== undefined && !LEVELS.includes(x.level)) out.push(`level must be one of ${LEVELS.join(', ')}`);
  if (typeof x.load !== 'function') out.push('load(a) is missing');
  if (typeof x.note !== 'function') out.push('note(verse, data) is missing');
  if (typeof x.Panel !== 'function') out.push('Panel is missing');
  if (x.chapterNote !== undefined && typeof x.chapterNote !== 'function') out.push('chapterNote must be a function');
  if (x.ChapterPanel !== undefined && typeof x.ChapterPanel !== 'function') out.push('ChapterPanel must be a component');
  return out;
}

function collect(): readonly AnyExtra[] {
  const seen = new Set<string>();
  const out: AnyExtra[] = [];
  for (const path of Object.keys(modules).sort()) {
    const file = path.replace(/^.*\//, '').replace(/\.extra\.tsx$/, '');
    const x = modules[path].default;
    const bad = problems(file, x, seen);
    if (bad.length) {
      console.error(`[extras] ${path} is left out: ${bad.join('; ')}.`);
      continue;
    }
    seen.add(x!.id);
    out.push(x!);
  }
  return out.sort((p, q) => p.order - q.order || (p.id < q.id ? -1 : 1));
}

/** All extras, in the order their notes appear. */
export const EXTRAS: readonly AnyExtra[] = collect();

export function extraById(id: string): AnyExtra | undefined {
  return EXTRAS.find((x) => x.id === id);
}
