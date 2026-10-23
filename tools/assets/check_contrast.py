"""
算 WCAG 2.1 对比度，把 app.wxss 里的注释从「声称」变成「可复核」。

背景：app.wxss 里 `--c-alert-fg: #B5442F; /* 紧急 / 就医 5.17:1 */` 这类注释，
数字是手写的。2026-10-23 复核发现三处都错了，错法一致——把「朱色 on 纸底」
的值抄到了「前景 on 三态浅底」的注释里。注释不会被任何测试发现，只能靠这个
脚本复算。

用法：
    $PY tools/assets/check_contrast.py            # 打印全表
    $PY tools/assets/check_contrast.py --strict   # 有低于 4.5 就以 1 退出

阈值取 WCAG 2.1 AA：正文 4.5:1，大字（≥18.66px 粗体 / ≥24px）与图形 3:1。
本项目的字号最大 44rpx（约 22px），按正文标准要求，一律用 4.5。

注意：ink-5 / ink-6 属于刻意的弱化层级（占位符、注脚），它们不达标是设计选择，
不是缺陷。--strict 会把它们也算作失败，因此仅用于排查「意外的不达标」，不接进 CI。
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / "miaoguanjia" / "app.wxss"

# 需要成对检查的（前景, 背景, 用途）
PAIRS = [
    ("--c-ink", "--c-bg", "正文"),
    ("--c-ink-2", "--c-bg", "次文"),
    ("--c-ink-3", "--c-bg", "辅助"),
    ("--c-ink-4", "--c-bg", "弱化 / 单位"),
    ("--c-ink-5", "--c-bg", "占位符（刻意弱化）"),
    ("--c-ink-6", "--c-bg", "注脚（刻意弱化）"),
    ("--c-vermilion", "--c-bg", "朱色文字"),
    ("--c-alert-fg", "--c-alert-bg", "紧急"),
    ("--c-caution-fg", "--c-caution-bg", "关注"),
    ("--c-safe-fg", "--c-safe-bg", "正常"),
]


def parse_tokens(text):
    """从 :root 块里抽出所有 --c-* 色值。"""
    out = {}
    for m in re.finditer(r"(--c-[\w-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})", text):
        out[m.group(1)] = m.group(2)
    return out


def _lin(c):
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hexcolor):
    h = hexcolor.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def contrast(fg, bg):
    l1, l2 = luminance(fg), luminance(bg)
    if l1 < l2:
        l1, l2 = l2, l1
    return (l1 + 0.05) / (l2 + 0.05)


def main():
    strict = "--strict" in sys.argv
    tokens = parse_tokens(SRC.read_text(encoding="utf-8"))
    if not tokens:
        print(f"未在 {SRC} 找到 --c-* 色值")
        return 2

    print(f"{'用途':<18}{'前景':<18}{'背景':<18}{'对比度':>8}  判定")
    print("-" * 72)
    bad = []
    for fg_key, bg_key, label in PAIRS:
        fg, bg = tokens.get(fg_key), tokens.get(bg_key)
        if not fg or not bg:
            print(f"{label:<18}缺 token：{fg_key if not fg else bg_key}")
            continue
        v = contrast(fg, bg)
        ok = v >= 4.5
        verdict = "AA 正文" if ok else ("AA 大字/图形" if v >= 3 else "不达标")
        print(f"{label:<18}{fg:<18}{bg:<18}{v:>7.2f}  {verdict}")
        if not ok:
            bad.append((label, v, fg_key, bg_key))

    print("-" * 72)
    if bad:
        print(f"{len(bad)} 项低于 4.5:1：")
        for label, v, fg_key, bg_key in bad:
            print(f"  · {label} {v:.2f}:1  （{fg_key} on {bg_key}）")
        print("  ink-4 用于数值单位与弱化标签，3.58:1 满足 3:1 的图形/大字标准，")
        print("  但它若被拿去排正文就不合格——使用时看语境，不看 token 名。")
        print("  ink-5 / ink-6 是刻意的弱化层级，属设计选择。改动前先想清楚是否要")
        print("  让占位符也可读——那会改变「近于消失」的设计意图。")
        if strict:
            return 1
    else:
        print("全部达标 AA 正文。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
