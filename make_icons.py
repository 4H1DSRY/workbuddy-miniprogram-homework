# -*- coding: utf-8 -*-
"""
喵管家 · 线条图标生成

统一规格：24×24 设计坐标系，1.5 笔宽，圆头圆角。
超采样 4 倍后 LANCZOS 缩小，避免斜线毛边。

输出
  images/icons/{feed,water,play,weight}.png     96×96  墨黑
  images/tabbar/{home,records,mine}[-on].png    81×81  常态墨灰 / 选中墨黑
"""
import math
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), 'miaoguanjia', 'images')
INK = (30, 27, 25, 255)          # #1E1B19
INK_GRAY = (184, 176, 166, 255)  # #B8B0A6
SS = 4                            # 超采样倍数


def P(x, y, s):
    return (x * s, y * s)


def stroke(d, pts, color, lw, s, cap=True):
    """折线，首尾补圆头（Pillow 的 line 没有 round cap）"""
    xy = [P(x, y, s) for x, y in pts]
    if len(xy) < 2:
        return
    d.line(xy, fill=color, width=lw, joint='curve')
    if cap:
        r = lw / 2.0
        for (x, y) in (xy[0], xy[-1]):
            d.ellipse([x - r, y - r, x + r, y + r], fill=color)


def dot(d, x, y, r, color, s):
    cx, cy = P(x, y, s)
    rr = r * s
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=color)


def arc_pts(cx, cy, r, a0, a1, n=64):
    """Pillow 角度制：0° 在 3 点方向，顺时针增加"""
    pts = []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def bez(p0, p1, p2, n=32):
    pts = []
    for i in range(n + 1):
        t = i / float(n)
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        pts.append((x, y))
    return pts


# ---------------- 四个操作图标 ----------------

def i_feed(d, s, lw, c):
    """碗：直口 + 斜腰 + 下凸底弧"""
    path = [(4, 11.5), (20, 11.5), (18.4, 17.2)]
    path += arc_pts(12, 17.2, 6.4, 0, 180, 48)[1:]
    path += [(4, 11.5)]
    stroke(d, path, c, lw, s, cap=False)
    for x, y in ((9, 8.2), (12, 6.8), (15, 8.2)):
        dot(d, x, y, 0.72, c, s)


def i_water(d, s, lw, c):
    """水滴：尖点 + 两条切线 + 下方长弧"""
    path = [(12, 3.5), (14.98, 9.26)]
    path += arc_pts(12, 14, 5.6, 302.2, 597.8, 72)[1:]
    path += [(12, 3.5)]
    stroke(d, path, c, lw, s, cap=False)


def i_play(d, s, lw, c):
    """逗猫棒：斜杆 + 末端小球。
    线球在 22px 下会糊成一团，逗猫棒的两笔结构在这个尺寸仍然读得出。"""
    stroke(d, [(4.5, 19.5), (14.6, 9.4)], c, lw, s)
    stroke(d, arc_pts(17.1, 6.9, 2.6, 0, 360, 48), c, lw, s, cap=False)


def i_weight(d, s, lw, c):
    """体重秤（俯视）：机身 + 显示线 + 两个脚垫。
    侧视带托盘在 22px 下会读成瓶子或盒子；俯视结构只剩「方框 + 一条线」，最稳。"""
    d.rounded_rectangle(
        [P(3.4, 6.4, s)[0], P(3.4, 6.4, s)[1], P(20.6, 18.6, s)[0], P(20.6, 18.6, s)[1]],
        radius=3.0 * s, outline=c, width=lw
    )
    stroke(d, [(9.4, 11.4), (14.6, 11.4)], c, lw, s)
    dot(d, 7.6, 15.8, 0.62, c, s)
    dot(d, 16.4, 15.8, 0.62, c, s)



def i_vaccine(d, s, lw, c):
    """疫苗：圆 + 十字（医疗符号）。
    针管在这个尺寸会退化成一条斜线，与「记录」「删除」都分不开。"""
    stroke(d, arc_pts(12, 12, 8.0, 0, 360, 72), c, lw, s, cap=False)
    stroke(d, [(8.6, 12), (15.4, 12)], c, lw, s)
    stroke(d, [(12, 8.6), (12, 15.4)], c, lw, s)


def i_deworm(d, s, lw, c):
    """驱虫：盾形 + 勾（防护语义，比药瓶在 22px 下更认得出）"""
    stroke(d, [(12, 4.2), (19, 7.2), (19, 12.2), (12, 19.8), (5, 12.2), (5, 7.2), (12, 4.2)],
           c, lw, s, cap=False)
    stroke(d, [(8.8, 12.0), (11.2, 14.5), (15.4, 9.8)], c, lw, s)



def i_user(d, s, lw, c):
    """人形：头 + 肩（我的页头像位）"""
    stroke(d, arc_pts(12, 8.6, 3.4, 0, 360, 64), c, lw, s, cap=False)
    stroke(d, arc_pts(12, 20.2, 6.8, 180, 360, 48), c, lw, s)


def i_clock(d, s, lw, c):
    """时钟：圆 + 两根指针"""
    stroke(d, arc_pts(12, 12, 8.0, 0, 360, 72), c, lw, s, cap=False)
    stroke(d, [(12, 7.4), (12, 12), (15.4, 13.9)], c, lw, s)


def i_info(d, s, lw, c):
    """信息：圆 + 一点 + 一竖"""
    stroke(d, arc_pts(12, 12, 8.0, 0, 360, 72), c, lw, s, cap=False)
    dot(d, 12, 8.0, 0.78, c, s)
    stroke(d, [(12, 11.4), (12, 16.8)], c, lw, s)


def i_bin(d, s, lw, c):
    """垃圾桶：盖 + 提手 + 桶身 + 两道竖线（重置演示数据）"""
    stroke(d, [(4.8, 7.6), (19.2, 7.6)], c, lw, s)
    stroke(d, [(9.6, 7.6), (9.6, 5.2), (14.4, 5.2), (14.4, 7.6)], c, lw, s)
    stroke(d, [(6.6, 7.6), (7.6, 19.4), (16.4, 19.4), (17.4, 7.6)], c, lw, s, cap=False)
    stroke(d, [(10.6, 11.0), (10.6, 16.0)], c, lw, s)
    stroke(d, [(13.4, 11.0), (13.4, 16.0)], c, lw, s)


def i_doc(d, s, lw, c):
    """纸页：外框 + 三条字线（记录页空状态）"""
    d.rounded_rectangle(
        [P(6.2, 3.6, s)[0], P(6.2, 3.6, s)[1], P(17.8, 20.4, s)[0], P(17.8, 20.4, s)[1]],
        radius=2.2 * s, outline=c, width=lw
    )
    stroke(d, [(9.8, 9.0), (14.2, 9.0)], c, lw, s)
    stroke(d, [(9.8, 12.4), (14.2, 12.4)], c, lw, s)
    stroke(d, [(9.8, 15.8), (12.6, 15.8)], c, lw, s)


def i_cam(d, s, lw, c):
    """摄像头：机身 + 镜头 + 顶部卡口"""
    d.rounded_rectangle(
        [P(3.2, 7.8, s)[0], P(3.2, 7.8, s)[1], P(20.8, 18.8, s)[0], P(20.8, 18.8, s)[1]],
        radius=2.6 * s, outline=c, width=lw
    )
    stroke(d, [(9.4, 7.8), (9.4, 5.4), (14.6, 5.4), (14.6, 7.8)], c, lw, s)
    stroke(d, arc_pts(12, 13.2, 3.1, 0, 360, 48), c, lw, s, cap=False)



def i_paw(d, s, lw, c):
    """爪印：掌垫椭圆 + 四个脚趾点（头像占位）"""
    d.ellipse(
        [P(7.9, 12.4, s)[0], P(7.9, 12.4, s)[1], P(16.1, 18.4, s)[0], P(16.1, 18.4, s)[1]],
        outline=c, width=lw
    )
    for x, y in ((6.6, 9.4), (10.0, 6.6), (14.0, 6.6), (17.4, 9.4)):
        dot(d, x, y, 1.12, c, s)


# ---------------- 三个 tabBar 图标 ----------------

def t_home(d, s, lw, c):
    stroke(d, [(4, 11.4), (12, 5), (20, 11.4)], c, lw, s)
    stroke(d, [(6.7, 10.6), (6.7, 19), (17.3, 19), (17.3, 10.6)], c, lw, s)


def t_records(d, s, lw, c):
    stroke(d, [(5, 8.2), (19, 8.2)], c, lw, s)
    stroke(d, [(5, 12), (19, 12)], c, lw, s)
    stroke(d, [(5, 15.8), (13.5, 15.8)], c, lw, s)


def t_mine(d, s, lw, c):
    stroke(d, arc_pts(12, 8.7, 3.2, 0, 360, 64), c, lw, s, cap=False)
    stroke(d, arc_pts(12, 19.4, 6.4, 180, 360, 48), c, lw, s)


# ---------------- 渲染 ----------------

def render(fn, size, color, out):
    S = size * SS
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = S / 24.0
    lw = max(2, int(round(1.5 * s)))
    fn(d, s, lw, color)
    img = img.resize((size, size), Image.LANCZOS)
    path = os.path.join(ROOT, out)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    print('%-34s %dx%d' % (out, size, size))


def main():
    icons = {'feed': i_feed, 'water': i_water, 'play': i_play, 'weight': i_weight,
             'vaccine': i_vaccine, 'deworm': i_deworm,
             'user': i_user, 'camera': i_cam, 'paw': i_paw,
             'clock': i_clock, 'info': i_info, 'bin': i_bin, 'doc': i_doc}
    for name, fn in icons.items():
        render(fn, 96, INK, os.path.join('icons', name + '.png'))

    tabs = {'home': t_home, 'records': t_records, 'mine': t_mine}
    for name, fn in tabs.items():
        render(fn, 81, INK_GRAY, os.path.join('tabbar', name + '.png'))
        render(fn, 81, INK, os.path.join('tabbar', name + '-on.png'))


if __name__ == '__main__':
    main()
