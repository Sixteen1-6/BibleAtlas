"""Extract every <w> token from an EarlyPrint TEI file into a TSV.

Usage: python -I ep_tokens.py <in.xml> <out.tsv>
Columns: xml:id, text (w content), orig, reg, lemma, pos, lang, in_note
"""
import sys
from lxml import etree

TEI = '{http://www.tei-c.org/ns/1.0}'
XML = '{http://www.w3.org/XML/1998/namespace}'


def main(src, out):
    n = 0
    with open(out, 'w', encoding='utf-8') as fo:
        fo.write('id\ttext\torig\treg\tlemma\tpos\tlang\tin_note\n')
        in_text = False
        stack_note = 0
        stack_lang = []
        for ev, el in etree.iterparse(src, events=('start', 'end'), huge_tree=True):
            tag = el.tag
            if ev == 'start':
                if tag == TEI + 'text':
                    in_text = True
                if tag == TEI + 'note':
                    stack_note += 1
                stack_lang.append(el.get(XML + 'lang'))
                continue
            # end
            lang = None
            for l in reversed(stack_lang):
                if l:
                    lang = l
                    break
            stack_lang.pop()
            if tag == TEI + 'note':
                stack_note -= 1
            if in_text and tag == TEI + 'w':
                text = ''.join(el.itertext()).replace('\t', ' ').replace('\n', ' ')
                row = [el.get(XML + 'id') or '', text, el.get('orig') or '', el.get('reg') or '',
                       el.get('lemma') or '', el.get('pos') or '', lang or '', '1' if stack_note else '0']
                fo.write('\t'.join(r.replace('\t', ' ') for r in row) + '\n')
                n += 1
                el.clear()
            elif in_text and tag in (TEI + 'p', TEI + 'head', TEI + 'l', TEI + 'item', TEI + 'cell'):
                el.clear()
    print(src, n, 'tokens')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
