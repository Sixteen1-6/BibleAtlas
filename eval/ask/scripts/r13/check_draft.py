#!/usr/bin/env python3
"""check_draft.py DRAFT.json [...]: check drafted Ask answers the way `atlas build` does, as far as
plain text allows.

A draft file is {"new": [question, ...], "examples": {id: [message, ...]},
"add_examples": {existing id: [message, ...]}}. A question has the fields of config/questions.json:
id, group, question, also, signals, topics, chain.

Checked here: id, group, question and also lengths, signals, chain size, part sizes, words copied
word for word from the BSB, characters shown, Nave's subjects and labels, examples (count, length,
not another question's way of asking or example, not listed twice), and the plainest ties (a part
holds a word of the question or its other ways of asking, sits under one of its Nave's subjects,
or is within 4 verses of another part in the same chapter). Ties by cross-reference, quotation or
shared root need the full data: `atlas build` checks those, so a part with none of the plain ties
is reported as "untied here" for a look, not as a failure.
Prints one line per problem and the shown chain of each question.
"""
import json, os, re, sys
sys.path.insert(0, os.environ.get('ASK_TOOLS', './eval/ask/scripts/tools'))
from bible import parse, text, name, naves_rows, split_line, nave_refs

REPO = os.environ.get('ATLAS_REPO', '.')
GROUPS = ["God", "Jesus", "Saved", "Living", "Hard times", "Family", "Death and the future", "Church and Bible"]
OUTSIDE = ["scholar", "theolog", "commentat", "denomination", "christians believe", "gotquestions", "esv", "nave", "interpret"]
STOP = set("""what who whom whose why how when where which does did doing will would should could can may might must shall are was were
the and for with about from into that this there they them their you your our his her its have has had not any all""".split())

def norm(s):
    s = re.sub(r"['’‘ʼ]", '', s.lower())
    return ' '.join(re.findall(r'[^\W_]+', s))

def stem(w):
    for end in ["ness", "ing", "ies", "ied", "es", "ed", "ly", "s", "y", "e"]:
        if len(w) > len(end) + 2 and w.endswith(end): return w[:-len(end)]
    return w

def content(s): return [w for w in norm(s).split() if len(w) >= 3 and w not in STOP]

def meets(w, asked):
    s = stem(w)
    if s in asked: return True
    for a in asked:
        short, long = (a, s) if len(a) <= len(s) else (s, a)
        if len(short) >= 4 and long.startswith(short) and len(long) - len(short) <= 3: return True
    return False

def outside(s):
    t = ' ' + norm(s) + ' '
    return next((w for w in OUTSIDE if ' ' + w in t), None)

# Nave's: subject -> list of (label, parent label, [verse keys])
NAV = {}
for r in naves_rows():
    subj = r['subject'].strip().upper()
    lines, parent = [], None
    for line in r['entry'].split('\n'):
        if not line.strip(): continue
        d, label, refs = split_line(line)
        if d == 0: parent = label
        vs = set()
        for ref in nave_refs(refs):
            try: vs.update(parse(ref))
            except Exception: pass
        lines.append((label, parent if d == 1 else None, vs))
    NAV[subj] = lines

existing = json.load(open(os.path.join(REPO, 'config/questions.json'), encoding='utf-8'))['questions']
ex_file = json.load(open(os.path.join(REPO, 'config/ask-examples.json'), encoding='utf-8'))['examples']
drafts = [json.load(open(p, encoding='utf-8')) for p in sys.argv[1:]]
for d in drafts:
    for i, texts in d.get('remove_also', {}).items():
        q = next((q for q in existing if q['id'] == i), None)
        if q is None: print(f'FAIL {i}: remove_also names no existing question'); continue
        missing = [t for t in texts if t not in q['also']]
        if missing: print(f'FAIL {i}: remove_also texts not in its also: {missing}')
        q['also'] = [a for a in q['also'] if a not in texts]
        if len(q['also']) < 2: print(f'FAIL {i}: fewer than 2 also left')
    for i, texts in d.get('remove_examples', {}).items():
        have = ex_file.get(i)
        if have is None: print(f'FAIL {i}: remove_examples names no existing question'); continue
        missing = [t for t in texts if t not in have]
        if missing: print(f'FAIL {i}: remove_examples texts not among its examples: {missing}')
        ex_file[i] = [e for e in have if e not in texts]
ids = {q['id'] for q in existing}
said = {}
for q in existing:
    for p in [q['question']] + q['also']: said.setdefault(norm(p), q['id'])
seen = {}
for i, ex in ex_file.items():
    for e in ex: seen.setdefault(norm(e), i)

problems = 0
def fail(at, msg):
    global problems; problems += 1; print(f'FAIL {at}: {msg}')

new = [q for d in drafts for q in d.get('new', [])]
for q in new:
    for p in [q.get('question', '')] + q.get('also', []):
        k = norm(p)
        if k in said and said[k] != q.get('id'): fail(q.get('id'), f'{p!r} is already a way of asking {said[k]!r}')
        said.setdefault(k, q.get('id'))

for q in new:
    at = q.get('id', '?')
    if at in ids: fail(at, 'id already exists')
    ids.add(at)
    if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', at) or len(at) > 48: fail(at, 'bad id')
    if q.get('group') not in GROUPS: fail(at, f'group {q.get("group")!r}')
    qq = q.get('question', '')
    if not qq.rstrip().endswith('?') or len(qq) > 90: fail(at, 'question must end with ? and be at most 90 characters')
    for f, s, m in [('question', qq, 90)] + [('also', a, 60) for a in q.get('also', [])]:
        if len(s) > m: fail(at, f'{f} {s!r} over {m}')
        if outside(s): fail(at, f'{f} {s!r} uses {outside(s)!r}')
    if not 2 <= len(q.get('also', [])) <= 16: fail(at, 'also needs 2 to 16')
    sig = q.get('signals', [])
    if len(sig) > 60 or len(set(sig)) != len(sig): fail(at, 'signals over 60 or repeated')
    for w in sig:
        if len(w.split()) > 3 or w != w.strip() or w != w.lower() or len(w) > 40: fail(at, f'signal {w!r}')
    # topics
    tops = q.get('topics', [])
    if not 1 <= len(tops) <= 5: fail(at, 'topics needs 1 to 5')
    subjects = []
    for t in tops:
        s = t['subject'].strip().upper()
        if s not in NAV: fail(at, f"Nave's has no subject {t['subject']!r}"); continue
        lines = NAV[s]
        for w in t.get('only', []) + t.get('skip', []):
            if not any(norm(l[0]).startswith(norm(w)) for l in lines): fail(at, f'no label under {s} starts with {w!r}')
        hit = lambda l, w: norm(l[0]).startswith(norm(w)) or (l[1] is not None and norm(l[1]).startswith(norm(w)))
        kept = [l for l in lines if (not t.get('only') or any(hit(l, w) for w in t['only'])) and not any(hit(l, w) for w in t.get('skip', []))]
        vs = set().union(*[l[2] for l in kept]) if kept else set()
        if kept and not vs: fail(at, f'the lines kept under {s} cite no verses')
        subjects.append((s, vs))
    # chain
    ch = q.get('chain', [])
    if not 3 <= len(ch) <= 8: fail(at, f'chain has {len(ch)} parts; needs 3 to 8')
    asked = set()
    for p in [qq] + q.get('also', []):
        for w in content(p): asked.update([w, stem(w)])
    shown, parts, saidp = 0, [], []
    out = []
    for i, p in enumerate(ch):
        try: vs = parse(p['ref'])
        except ValueError as e: fail(at, f'chain[{i}] {e}'); continue
        if len(vs) > 3: fail(at, f'chain[{i}] {p["ref"]} is {len(vs)} verses')
        full = ' '.join(text(*v) for v in vs)
        if 'words' in p:
            w = norm(p['words'])
            if len(w.split()) < 3: fail(at, f'chain[{i}] words under 3 words')
            if not re.search(r'(^| )' + re.escape(w) + r'( |$)', norm(full)):
                fail(at, f'chain[{i}] words {p["words"]!r} are not word for word in {p["ref"]}: {full}')
            span = p['words']
        else:
            span = full
        shown += len(span)
        parts.append(vs); saidp.append(span)
        out.append(f'  [{i}] {p["ref"]}: {span}')
    if shown > 1200: fail(at, f'chain shows {shown} characters; keep to 1200')
    for i, vs in enumerate(parts):
        words = [w for w in re.findall(r"[^\W_][\w'’‘ʼ]*", saidp[i]) if len(norm(w)) >= 3 and norm(w) not in STOP]
        tw = any(meets(norm(w).replace(' ', ''), asked) for w in words)
        ts = any(set(vs) & s for _, s in subjects)
        tp = False
        for j, o in enumerate(parts):
            if j == i: continue
            if vs[0][:2] == o[0][:2] and vs[-1][:2] == o[-1][:2]:
                if o[0][2] - vs[-1][2] <= 4 and vs[0][2] - o[-1][2] <= 4: tp = True
        if not (tw or ts or tp): print(f'NOTE {at}: chain[{i}] {ch[i]["ref"]} untied here (no question word, subject or same passage); the build may still tie it by cross-reference or root')
    print(f'== {at}: {qq}  ({shown} chars)')
    print('\n'.join(out))

allex = {}
for d in drafts:
    for k, v in list(d.get('examples', {}).items()) + list(d.get('add_examples', {}).items()):
        allex.setdefault(k, []).extend(v)
for k, ex in allex.items():
    if k not in ids: fail(k, 'examples for an id that does not exist'); continue
    isnew = any(q.get('id') == k for q in new)
    total = len(ex) + (0 if isnew else len(ex_file.get(k, [])))
    if not 10 <= total <= 60: fail(k, f'{total} examples; needs 10 to 60')
    for e in ex:
        key = norm(e)
        if not key or len(e) > 400 or e != e.strip(): fail(k, f'example {e!r} bad length or spaces')
        if outside(e): fail(k, f'example {e!r} uses {outside(e)!r}')
        if key in said and said[key] != k: fail(k, f'example {e!r} is a way of asking {said[key]!r}')
        if key in seen and seen[key] != k: fail(k, f'example {e!r} is also an example of {seen[key]!r}')
        elif key in seen: fail(k, f'example {e!r} is listed twice')
        seen[key] = k
for q in new:
    if q['id'] not in allex: fail(q['id'], 'no examples')
for d in drafts:
    for i in d.get('remove_examples', {}):
        if i in ex_file and i not in allex and len(ex_file[i]) < 10: fail(i, f'{len(ex_file[i])} examples left after removals; needs 10')
print(f'{len(new)} new questions, {sum(len(v) for v in allex.values())} examples, {problems} problems')
