#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""wxmp_ui_audit.py — 按《微信小程序设计指南》扫描小程序工程。

用法:
    python wxmp_ui_audit.py <project_root> [--json]

只读扫描，不修改任何文件。退出码: 0 无 BLOCK, 1 存在 BLOCK, 2 路径错误。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# --- 规范常量（来源: 设计指南 5.1 / 5.2 / 2.1 / 2.2 / 3.2） ---
FONT_STEP_PX = {22.0, 17.0, 15.0, 14.0, 12.0}
FONT_STEP_RPX = {44.0, 34.0, 30.0, 28.0, 24.0}
FORBIDDEN_GREYS = {
    "#000", "#000000", "#111", "#111111", "#333", "#333333",
    "#666", "#666666", "#999", "#999999", "#ccc", "#cccccc",
}
MIN_TOUCH_RPX = 88.0
MIN_TOUCH_PX = 44.0
TAB_MIN, TAB_MAX, TAB_RECOMMEND = 2, 5, 4

findings: list[dict] = []


def add(level: str, rule: str, path: Path | None, line: int, msg: str) -> None:
    findings.append({
        "level": level,
        "rule": rule,
        "file": "" if path is None else f"{path.name}:{line}",
        "msg": msg,
    })


def rel(p: Path, root: Path) -> Path:
    try:
        return p.relative_to(root)
    except ValueError:
        return p


def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def line_of(text: str, idx: int) -> int:
    return text.count("\n", 0, idx) + 1


def walk(root: Path, *suffix: str) -> list[Path]:
    out: list[Path] = []
    for s in suffix:
        out.extend(p for p in root.rglob(f"*{s}") if "node_modules" not in p.parts and "miniprogram_npm" not in p.parts)
    return sorted(set(out))


# ---------- app.json: Tab 数量 / 分包体积 ----------
def check_app_json(root: Path) -> None:
    app = root / "app.json"
    if not app.exists():
        add("INFO", "R3", None, 0, "未找到 app.json，跳过 Tab 与分包检查")
        return
    data = json.loads(read(app) or "{}")
    tab = data.get("tabBar") or {}
    items = tab.get("list") or []
    n = len(items)
    if n and not (TAB_MIN <= n <= TAB_MAX):
        add("BLOCK", "R3", app, 1, f"tabBar.list 有 {n} 项，规范要求 {TAB_MIN}-{TAB_MAX} 项")
    elif n > TAB_RECOMMEND:
        add("WARN", "R3", app, 1, f"tabBar.list 有 {n} 项，建议 ≤{TAB_RECOMMEND} 项以保证点击区域")
    for i, it in enumerate(items, 1):
        if it.get("text") and len(str(it["text"])) > 4:
            add("WARN", "R3", app, 1, f"tabBar 第 {i} 项文案「{it['text']}」超过 4 字，会被截断")


# ---------- wxss: 字号阶梯 / 灰色硬编码 ----------
DECL_RE = re.compile(r"([^{}]+)\{([^{}]*)\}", re.S)
SIZE_RE = re.compile(r"font-size\s*:\s*([\d.]+)\s*(px|rpx|pt)", re.I)
COLOR_RE = re.compile(r"(?<![-\w])color\s*:\s*(#[0-9a-fA-F]{3,8})", re.I)


def check_wxss(path: Path, root: Path) -> None:
    text = read(path)
    for m in SIZE_RE.finditer(text):
        val, unit = float(m.group(1)), m.group(2).lower()
        ok = val in (FONT_STEP_PX if unit in ("px", "pt") else FONT_STEP_RPX)
        if not ok:
            add("WARN", "R1", rel(path, root), line_of(text, m.start()),
                f"font-size: {m.group(1)}{m.group(2)} 不在阶梯 "
                f"22/17/15/14/12 px（或 44/34/30/28/24 rpx）内")
    for m in COLOR_RE.finditer(text):
        if m.group(1).lower() in FORBIDDEN_GREYS:
            add("WARN", "R2", rel(path, root), line_of(text, m.start()),
                f"color: {m.group(1)} 为硬编码灰阶，应改用 rgba(0,0,0,.9/.55/.3/.1)")


# ---------- wxml: 热区 / 图片 ----------
TAP_ATTR_RE = re.compile(r"\bbind:?tap\s*=", re.I)
TAG_RE = re.compile(r"<([a-zA-Z][-\w]*)([^>]*)>", re.S)
CLASS_RE = re.compile(r'class\s*=\s*"([^"]*)"')
IMG_RE = re.compile(r"<image\b([^>]*)>", re.S)


def check_wxml(path: Path, root: Path, style_index: dict[str, list[tuple[Path, float, str]]]) -> None:
    text = read(path)
    for m in TAG_RE.finditer(text):
        attrs = m.group(2)
        if not TAP_ATTR_RE.search(attrs):
            continue
        cm = CLASS_RE.search(attrs)
        if not cm:
            add("WARN", "R4", rel(path, root), line_of(text, m.start()),
                f"<{m.group(1)}> 绑定了 tap 事件但无 class，无法校验热区尺寸")
            continue
        for cls in cm.group(1).split():
            for cpath, val, unit in style_index.get(cls, []):
                size = val * 2 if unit == "px" else val
                if size < MIN_TOUCH_RPX:
                    add("BLOCK", "R4", rel(path, root), line_of(text, m.start()),
                        f"可点击元素 .{cls} 尺寸 {val:g}{unit}（≈{size:g}rpx）"
                        f"小于 88rpx / 44px / 7mm")
    for m in IMG_RE.finditer(text):
        attrs = m.group(1)
        if "lazy-load" not in attrs:
            add("INFO", "C3", rel(path, root), line_of(text, m.start()),
                "<image> 未开启 lazy-load，长列表可能一次性解码全部图片")
        if "mode=" not in attrs:
            add("INFO", "C3", rel(path, root), line_of(text, m.start()),
                "<image> 未指定 mode，默认 scaleToFill 会拉伸变形")


def build_style_index(root: Path) -> dict[str, list[tuple[Path, float, str]]]:
    """class -> [(file, value, unit)]，取 height / min-height / line-height / width。"""
    index: dict[str, list[tuple[Path, float, str]]] = {}
    prop_re = re.compile(r"(?:^|;)\s*(?:min-height|height|line-height|min-width|width)\s*:\s*([\d.]+)\s*(px|rpx)", re.I)
    for path in walk(root, ".wxss"):
        text = read(path)
        for m in DECL_RE.finditer(text):
            sels, body = m.group(1), m.group(2)
            for sel in sels.split(","):
                sel = sel.strip().lstrip(".")
                if not sel or any(c in sel for c in " >:+[#*"):
                    continue
                for pm in prop_re.finditer(";" + body):
                    index.setdefault(sel, []).append((path, float(pm.group(1)), pm.group(2).lower()))
    return index


# ---------- js: 加载动画数量 / 配对 ----------
LOAD_RE = re.compile(r"wx\.showLoading\s*\(")
HIDE_RE = re.compile(r"wx\.hideLoading\s*\(")


def check_js(path: Path, root: Path) -> None:
    text = read(path)
    shows, hides = len(LOAD_RE.findall(text)), len(HIDE_RE.findall(text))
    if shows > 1:
        add("WARN", "R5", rel(path, root), line_of(text, LOAD_RE.search(text).start()),
            f"本页出现 {shows} 处 wx.showLoading，规范要求同屏只允许 1 个加载动画")
    if shows > hides:
        add("WARN", "R5", rel(path, root), line_of(text, LOAD_RE.search(text).start()),
            f"wx.showLoading {shows} 次、wx.hideLoading {hides} 次，存在加载态未关闭的风险")


# ---------- json: 自定义导航是否处理胶囊区 ----------
MENU_RE = re.compile(r"getMenuButtonBoundingClientRect|statusBarHeight")


def check_page_json(path: Path, root: Path) -> None:
    if path.name == "app.json":
        return
    try:
        data = json.loads(read(path) or "{}")
    except json.JSONDecodeError:
        return
    if (data.get("navigationStyle") or "").lower() != "custom":
        return
    stem = path.with_suffix("")
    peers = [stem.with_suffix(".wxml"), stem.with_suffix(".js"), stem.with_suffix(".ts")]
    if not any(MENU_RE.search(read(p)) for p in peers if p.exists()):
        add("BLOCK", "R6", rel(path, root), 1,
            "navigationStyle=custom 但未读取 getMenuButtonBoundingClientRect / statusBarHeight，"
            "页面顶部会与右上胶囊区（87×32px，右距 10px）冲突")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    root = Path(sys.argv[1]).resolve()
    if not root.is_dir():
        print(f"路径不存在或不是目录: {root}", file=sys.stderr)
        return 2

    check_app_json(root)
    for p in walk(root, ".wxss"):
        check_wxss(p, root)
    style_index = build_style_index(root)
    for p in walk(root, ".wxml"):
        check_wxml(p, root, style_index)
    for p in walk(root, ".js", ".ts"):
        check_js(p, root)
    for p in walk(root, ".json"):
        check_page_json(p, root)

    order = {"BLOCK": 0, "WARN": 1, "INFO": 2}
    findings.sort(key=lambda f: (order[f["level"]], f["rule"], f["file"]))

    if "--json" in sys.argv:
        print(json.dumps(findings, ensure_ascii=False, indent=2))
    else:
        if not findings:
            print("PASS — 未发现违反设计指南硬指标的问题。")
        else:
            print("| level | rule | file:line | finding |")
            print("|---|---|---|---|")
            for f in findings:
                print(f"| {f['level']} | {f['rule']} | {f['file'] or '-'} | {f['msg']} |")
            c = {k: sum(1 for f in findings if f["level"] == k) for k in order}
            print(f"\nBLOCK {c['BLOCK']} · WARN {c['WARN']} · INFO {c['INFO']}")
    return 1 if any(f["level"] == "BLOCK" for f in findings) else 0


if __name__ == "__main__":
    sys.exit(main())
