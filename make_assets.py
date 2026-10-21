"""生成 tabBar 图标与猫咪头像占位图（一次性脚本，产物已入库，无需重复运行）"""
from PIL import Image, ImageDraw, ImageFont
import os

ROOT = r"D:\Claw\workbuddy-course\homework-4\miaoguanjia"
TB = os.path.join(ROOT, "images", "tabbar")
CATS = os.path.join(ROOT, "images", "cats")
os.makedirs(TB, exist_ok=True)
os.makedirs(CATS, exist_ok=True)

NORMAL = (167, 158, 149, 255)
ACTIVE = (255, 122, 69, 255)
S = 4          # 超采样倍数
BASE = 81      # 微信 tabBar 图标建议 81x81


def canvas():
    return Image.new("RGBA", (BASE * S, BASE * S), (0, 0, 0, 0))


def finish(img, name):
    img = img.resize((BASE, BASE), Image.LANCZOS)
    img.save(os.path.join(TB, name))


def draw_home(color):
    img = canvas()
    d = ImageDraw.Draw(img)
    w = 7 * S
    k = S
    d.line([(13 * k, 42 * k), (40.5 * k, 16 * k), (68 * k, 42 * k)],
           fill=color, width=w, joint="curve")
    d.line([(22 * k, 38 * k), (22 * k, 66 * k), (59 * k, 66 * k), (59 * k, 38 * k)],
           fill=color, width=w, joint="curve")
    return img


def draw_records(color):
    img = canvas()
    d = ImageDraw.Draw(img)
    w = 7 * S
    k = S
    d.rounded_rectangle([(16 * k, 14 * k), (65 * k, 67 * k)], radius=9 * k,
                        outline=color, width=w)
    for y in (30, 40, 50):
        d.line([(29 * k, y * k), (52 * k, y * k)], fill=color, width=5 * S)
    return img


def draw_mine(color):
    img = canvas()
    d = ImageDraw.Draw(img)
    w = 7 * S
    k = S
    d.ellipse([(29 * k, 15 * k), (52 * k, 38 * k)], outline=color, width=w)
    d.arc([(16 * k, 40 * k), (65 * k, 78 * k)], start=190, end=350,
          fill=color, width=w)
    return img


for name, fn in (("home", draw_home), ("records", draw_records), ("mine", draw_mine)):
    finish(fn(NORMAL), name + ".png")
    finish(fn(ACTIVE), name + "-on.png")


EMOJI_FONT = "C:/Windows/Fonts/seguiemj.ttf"


def gradient(size, top, bottom):
    img = Image.new("RGB", (size, size), top)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (size, y)], fill=c)
    return img


def cat_avatar(path, top, bottom, emoji, ring):
    size = 400
    img = gradient(size, top, bottom)
    d = ImageDraw.Draw(img)
    # 柔光圆
    d.ellipse([(40, 40), (size - 40, size - 40)], fill=ring)
    font = ImageFont.truetype(EMOJI_FONT, 190)
    d.text((size // 2, size // 2 + 4), emoji, font=font, anchor="mm", embedded_color=True)
    img.convert("RGB").save(path, quality=92, subsampling=1)


cat_avatar(os.path.join(CATS, "cat1.jpg"), (255, 238, 226), (250, 222, 203), "🐱", (255, 251, 247))
cat_avatar(os.path.join(CATS, "cat2.jpg"), (233, 244, 236), (214, 234, 222), "🐈", (252, 255, 253))
cat_avatar(os.path.join(CATS, "cat3.jpg"), (253, 233, 240), (247, 214, 227), "😸", (255, 251, 253))
cat_avatar(os.path.join(CATS, "default.jpg"), (243, 237, 231), (228, 218, 208), "🐾", (252, 249, 246))

print("done")
print(sorted(os.listdir(TB)))
print(sorted(os.listdir(CATS)))
