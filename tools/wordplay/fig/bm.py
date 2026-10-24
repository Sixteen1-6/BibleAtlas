"""python3 -I bm.py <pulpit|ellicott|benson> "<ref>": prints the remark sections on that chapter from the pinned MyBible
module (batanus/bible-resources @14a8b1a). For the Pulpit Commentary only the exposition is printed; its homilies are
other writers' and are never quoted."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmod
import figcheck as fc
src, ref = sys.argv[1], sys.argv[2]
r = fc.resolve(ref)
if not r or src not in bmod.MOD:
    sys.exit(__doc__)
b, ch, v = fc.locate(r[0])
for u in bmod.units(src, b, ch):
    print('=' * 20)
    print(u)
