#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把一张原图裁成首页照片槽的比例，并压到小程序能接受的体积。

为什么必须事先裁：档案页允许用户自己换图，比例完全不可控；首页照片槽是
正方形 + aspectFit，整张图都会显示，但图本身如果是奇怪的比例，画面里就会
出现大片留边。种子图按槽位比例裁好，取景由这里决定，不再靠运气。

用法：
    python tools/prep_cat_photo.py 原图.jpg 输出.jpg
    python tools/prep_cat_photo.py 原图.jpg 输出.jpg --anchor 0.3 --hx 0.55
    python tools/prep_cat_photo.py 原图.jpg out.png --preview row.png

--anchor 是竖直取景位置：0 = 贴顶（留耳朵、切下巴），1 = 贴底，0.5 = 居中。
--hx 是水平取景位置：0 = 贴左，1 = 贴右，0.5 = 居中。猫不在正中时用它调。
--preview 会额外拼一张对照条，把 anchor 从 0 到 1 每 0.1 一档排出来,
用来挑取景，比反复试参数快。
"""

from __future__ import annotations

import argparse
import os
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("需要 Pillow：pip install pillow")

# 首页照片槽是 3:2（654x436rpx），改布局时这里要跟着改
SLOT_RATIO = 3 / 2.0
DEFAULT_WIDTH = 800
DEFAULT_QUALITY = 82


def crop_to_slot(im: Image.Image, anchor: float, hx: float, width: int) -> Image.Image:
    """按槽位比例裁切，anchor / hx 决定取景；比例不符的那一边被裁掉。"""
    im = im.convert("RGB")
    w, h = im.size
    ratio = SLOT_RATIO

    # 先按宽度定高，高度不够就改成按高度定宽
    cw, ch = w, int(round(w / ratio))
    if ch > h:
        ch, cw = h, int(round(h * ratio))

    left = int(round((w - cw) * max(0.0, min(1.0, hx))))
    top = int(round((h - ch) * max(0.0, min(1.0, anchor))))
    out = im.crop((left, top, left + cw, top + ch))
    return out.resize((width, int(round(width / ratio))), Image.LANCZOS)


def main() -> int:
    ap = argparse.ArgumentParser(description="裁成首页照片槽比例并压缩")
    ap.add_argument("src")
    ap.add_argument("dst", nargs="?")
    ap.add_argument("--anchor", type=float, default=0.5, help="竖直取景 0=贴顶 1=贴底")
    ap.add_argument("--hx", type=float, default=0.5, help="水平取景 0=贴左 1=贴右")
    ap.add_argument("--width", type=int, default=DEFAULT_WIDTH)
    ap.add_argument("--quality", type=int, default=DEFAULT_QUALITY)
    ap.add_argument("--preview", help="输出一张 anchor 对照条 png")
    args = ap.parse_args()

    im = Image.open(args.src)

    if args.preview:
        steps = [round(i / 10.0, 1) for i in range(11)]
        tiles = [crop_to_slot(im, s, args.hx, 480) for s in steps]
        tw, th = tiles[0].size
        gap = 8
        sheet = Image.new("RGB", (tw, (th + gap) * len(tiles) - gap), (255, 255, 255))
        for i, t in enumerate(tiles):
            sheet.paste(t, (0, i * (th + gap)))
        sheet.save(args.preview)
        print("preview ->", args.preview, "anchor 自上而下:", ", ".join(str(s) for s in steps))
        return 0

    if not args.dst:
        ap.error("需要输出路径（或加 --preview 只看取景）")

    out = crop_to_slot(im, args.anchor, args.hx, args.width)
    out.save(args.dst, "JPEG", quality=args.quality, optimize=True, progressive=True)
    print(
        "%s -> %s  %dx%d  %.0f KB  anchor=%.2f hx=%.2f"
        % (args.src, args.dst, out.size[0], out.size[1],
           os.path.getsize(args.dst) / 1024.0, args.anchor, args.hx)
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
