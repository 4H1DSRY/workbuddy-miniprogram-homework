"""_crop.py <in> <out> <x0> <y0> <x1> <y1> [zoom]"""
import sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = [int(v) for v in sys.argv[3:7]]
zoom = float(sys.argv[7]) if len(sys.argv) > 7 else 1.0

im = Image.open(src)
im = im.crop((x0, y0, x1, y1))
if zoom != 1.0:
    im = im.resize((int(im.width * zoom), int(im.height * zoom)), Image.LANCZOS)
im.save(out)
print(out, im.size)
