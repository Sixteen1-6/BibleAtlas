"""Write config/layers.json in the layout main uses, so a merge shows only the added lines.

Layout: two-space indent; a list of plain values on one line (except the top
_comment list); an object of plain values inside a list on one line, as
{ "source": "barnes", "on": "John 1:1" }; everything else one key per line.
"""
import json

def scalar(v):
    return not isinstance(v, (dict, list))

def enc(v):
    return json.dumps(v, ensure_ascii=False)

def fmt(v, ind=0, key=None, in_list=False):
    pad = '  ' * ind
    if isinstance(v, dict):
        if not v:
            return '{}'
        if in_list and all(scalar(x) for x in v.values()):
            return '{ ' + ', '.join(f'{enc(k)}: {enc(x)}' for k, x in v.items()) + ' }'
        inner = ',\n'.join(f'{pad}  {enc(k)}: {fmt(x, ind + 1, k)}' for k, x in v.items())
        return '{\n' + inner + '\n' + pad + '}'
    if isinstance(v, list):
        if not v:
            return '[]'
        if all(scalar(x) for x in v) and key != '_comment':
            return '[' + ', '.join(enc(x) for x in v) + ']'
        inner = ',\n'.join(f'{pad}  {fmt(x, ind + 1, None, True)}' for x in v)
        return '[\n' + inner + '\n' + pad + ']'
    return enc(v)

def dumps(doc):
    return fmt(doc) + '\n'

if __name__ == '__main__':
    import sys
    text = open(sys.argv[1], encoding='utf-8').read()
    out = dumps(json.loads(text))
    print('round trip identical' if out == text else 'differs')
    if out != text:
        a, b = text.splitlines(), out.splitlines()
        for i, (x, y) in enumerate(zip(a, b)):
            if x != y:
                print(i + 1, repr(x)); print(i + 1, repr(y)); break
        print(len(a), len(b))
