"""把新图标按实际显示尺寸（19px / 22px）排一行，放大 6 倍看可辨性"""
import os
from PIL import Image

D = os.path.join(os.path.dirname(__file__), 'miaoguanjia', 'images', 'icons')
names = ['clock', 'info', 'bin', 'doc', 'vaccine', 'user']
SCALE = 6
pad = 10
sizes = [19, 22]
W = sum(len(sizes) * (pad + i) for i in (sizes, )) if False else None

cells = []
for n in names:
    src = Image.open(os.path.join(D, n + '.png')).convert('RGBA')
    row = []
    for sz in sizes:
        im = src.resize((sz, sz), Image.LANCZOS)
        row.append(im)
    cells.append(row)

cw = max(len(row) for row in cells)
cell_w = 22 * 2 + pad * 3
W = cell_w * cw
H = (22 + pad) * len(cells) + pad
canvas = Image.new('RGB', (W, H), (250, 248, 244))
for ci, row in enumerate(cells):
    y = pad + ci * (22 + pad)
    for si, im in enumerate(row):
        x = pad + si * cell_w
        canvas.paste(im, (x, y), im)
canvas = canvas.resize((W * SCALE, H * SCALE), Image.NEAREST)
canvas.save('_shots/icons-new.png')
print(canvas.size)
