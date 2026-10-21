# -*- coding: utf-8 -*-
"""
把 records / mine / cat-edit 三页的样式收进「纸墨朱」语言。

处理三件事：
  1. 删除全部 box-shadow（阴影是旧语言的分隔手段，新语言用发丝线 + 留白）
  2. 圆角收口：>=16rpx 一律 8rpx，999rpx 的胶囊改 4rpx
  3. 宋体最小字号：低于 20rpx(10px) 的提到 20rpx，否则横画会掉
"""
import re
import sys

FILES = [
    'miaoguanjia/pages/records/records.wxss',
    'miaoguanjia/pages/mine/mine.wxss',
    'miaoguanjia/pages/cat-edit/cat-edit.wxss',
]


def shrink_radius(m):
    v = int(m.group(1))
    if v == 999:
        return 'border-radius: 4rpx'
    if v >= 16:
        return 'border-radius: 8rpx'
    return m.group(0)


def lift_font(m):
    v = int(m.group(1))
    if 0 < v < 20:
        return 'font-size: 20rpx'
    return m.group(0)


def main():
    for f in FILES:
        s = open(f, encoding='utf-8').read()
        before = s

        s, n_shadow = re.subn(r'\s*box-shadow\s*:[^;]+;', '', s)
        s, n_rad = re.subn(r'border-radius:\s*([0-9]+)rpx', shrink_radius, s)
        s, n_font = re.subn(r'font-size:\s*([0-9]+)rpx', lift_font, s)

        if s != before:
            open(f, 'w', encoding='utf-8').write(s)

        left_radius = re.findall(r'border-radius:\s*([0-9]+)rpx', s)
        left_shadow = len(re.findall(r'box-shadow', s))
        left_font = [v for v in re.findall(r'font-size:\s*([0-9]+)rpx', s) if int(v) < 20]

        print('%-42s 阴影-%-2d 圆角-%-2d 字号-%-2d | 残留 圆角%s 阴影%d 小字%s'
              % (f.split('/')[-1], n_shadow, n_rad, n_font,
                 left_radius or '无', left_shadow, left_font or '无'))


if __name__ == '__main__':
    main()
