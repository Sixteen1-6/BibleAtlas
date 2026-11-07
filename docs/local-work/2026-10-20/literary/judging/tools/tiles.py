"""tiles.py shot.png [tile_h] [cols] -> shot.tiles.png: a tall phone shot cut into side-by-side columns for viewing."""
import sys
from PIL import Image

src = sys.argv[1]
th = int(sys.argv[2]) if len(sys.argv) > 2 else 1400
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
start = int(sys.argv[4]) if len(sys.argv) > 4 else 0
im = Image.open(src)
w, h = im.size
out = Image.new('RGB', (cols * (w + 12), th), (128, 128, 128))
for i in range(cols):
    top = start + i * th
    if top >= h:
        break
    out.paste(im.crop((0, top, w, min(h, top + th))), (i * (w + 12), 0))
import os
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', os.path.basename(src).replace('.png', f'.t{start}.png'))
out.save(dst)
print(dst)
