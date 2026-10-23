# -*- coding: utf-8 -*-
"""
Markdown → DOCX 转换器（为本报告定制，不是通用工具）。

只处理 docs/课程报告.md 里实际出现的块级元素：
标题 / 段落 / 表格 / 代码块 / 引用块 / 无序列表 / 图片 / 分隔线。

样式跟产品一致：宋体正文、黑体标题、朱色用于强调，不引入第二套色。

运行（项目根目录）：
    python tools/assets/md2docx.py
"""

import pathlib
import re
import sys

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "docs" / "课程报告.md"
OUT = ROOT / "docs" / "2530031251_孙瑞阳_喵管家_课程报告.docx"

INK = RGBColor(0x1E, 0x1B, 0x19)
INK2 = RGBColor(0x4A, 0x44, 0x3F)
INK3 = RGBColor(0x6B, 0x65, 0x60)
VERM = RGBColor(0xB5, 0x44, 0x2F)

SONG = "宋体"
HEI = "黑体"
MONO = "Consolas"


def set_cjk(run, font_name):
    """python-docx 不会自动设东亚字体，要直接写 rPr。"""
    run.font.name = font_name
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:eastAsia"), font_name)
    rfonts.set(qn("w:ascii"), font_name)
    rfonts.set(qn("w:hAnsi"), font_name)


def set_style_cjk(style, font_name):
    """给段落样式设东亚字体（style 上没有 .font.name 的 run 语义）。"""
    style.font.name = font_name
    rpr = style.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:eastAsia"), font_name)
    rfonts.set(qn("w:ascii"), font_name)
    rfonts.set(qn("w:hAnsi"), font_name)


def shade(cell_or_par, hex_color):
    """给单元格或段落加底色。"""
    el = cell_or_par._element
    pr = el.find(qn("w:tcPr")) if el.tag.endswith("tc") else el.get_or_add_pPr()
    if pr is None:
        pr = OxmlElement("w:tcPr")
        el.append(pr)
    sh = OxmlElement("w:shd")
    sh.set(qn("w:val"), "clear")
    sh.set(qn("w:color"), "auto")
    sh.set(qn("w:fill"), hex_color)
    pr.append(sh)


def add_bottom_border(par, hex_color="DCD5CA", size=6):
    ppr = par._element.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), str(size))
    bottom.set(qn("w:space"), "6")
    bottom.set(qn("w:color"), hex_color)
    borders.append(bottom)
    ppr.append(borders)


def add_runs(par, text, size=10.5, color=INK, base_font=SONG, bold=False):
    """解析行内 **粗体** 与 `代码`。粗体里还会嵌套代码，所以要递归一次。"""
    tokens = re.split(r"(\*\*.+?\*\*)", text)
    for t in tokens:
        if not t:
            continue
        if t.startswith("**") and t.endswith("**") and len(t) > 4:
            add_runs(par, t[2:-2], size=size, color=color,
                     base_font=base_font, bold=True)
            continue
        # 叶子文本：再切一次行内代码
        for piece in re.split(r"(`[^`]+`)", t):
            if not piece:
                continue
            if piece.startswith("`") and piece.endswith("`"):
                r = par.add_run(piece[1:-1])
                set_cjk(r, MONO)
                r.font.size = Pt(size - 0.5)
                r.font.color.rgb = INK2
                r.bold = bold
            else:
                r = par.add_run(piece)
                set_cjk(r, base_font)
                r.font.size = Pt(size)
                r.font.color.rgb = color
                r.bold = bold


def body_par(doc, text, size=10.5, color=INK, first_indent=True,
             space_after=6, align=None):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = 1.5
    pf.space_after = Pt(space_after)
    pf.space_before = Pt(0)
    if align is not None:
        p.alignment = align
    add_runs(p, text, size=size, color=color)
    return p


def build():
    md = SRC.read_text(encoding="utf-8")
    lines = md.split("\n")

    doc = Document()

    # 页面：A4，上下 2.5 边距，左右 2.4
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
    sec.top_margin = Cm(2.4)
    sec.bottom_margin = Cm(2.2)
    sec.left_margin = Cm(2.4)
    sec.right_margin = Cm(2.4)
    BODY_W = Cm(21.0 - 4.8)

    # 正文默认样式
    normal = doc.styles["Normal"]
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = INK
    set_style_cjk(normal, SONG)

    i = 0
    n = len(lines)
    first_h1 = True
    ordered_no = 0

    while i < n:
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()

        # 空行
        if not stripped:
            i += 1
            continue

        # 分隔线
        if re.fullmatch(r"-{3,}", stripped):
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(10)
            add_bottom_border(p, "E6E0D6", 4)
            i += 1
            continue

        # 代码块
        if stripped.startswith("```"):
            i += 1
            buf = []
            while i < n and not lines[i].strip().startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1  # 跳过结束的 ```
            for code_line in buf:
                p = doc.add_paragraph()
                pf = p.paragraph_format
                pf.line_spacing = 1.25
                pf.space_after = Pt(0)
                pf.left_indent = Cm(0.6)
                r = p.add_run(code_line if code_line else " ")
                set_cjk(r, MONO)
                r.font.size = Pt(9)
                r.font.color.rgb = INK2
                shade(p, "F5F2EC")
            doc.add_paragraph().paragraph_format.space_after = Pt(4)
            continue

        # 表格
        if stripped.startswith("|") and stripped.count("|") >= 2:
            block = []
            while i < n and lines[i].strip().startswith("|"):
                block.append(lines[i].strip())
                i += 1
            rows = []
            for ln in block:
                if re.fullmatch(r"\|[\s:\-|]+\|", ln):
                    continue
                cells = [c.strip() for c in ln.strip("|").split("|")]
                rows.append(cells)
            if rows:
                cols = max(len(r_) for r_ in rows)
                tbl = doc.add_table(rows=0, cols=cols)
                tbl.style = "Table Grid"
                tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                tbl.autofit = False

                # 列宽按内容长度加权，避免 python-docx 默认均分把短列撑得太宽
                def _w(s):
                    return sum(2 if ord(ch) > 127 else 1 for ch in s)

                weights = []
                for ci in range(cols):
                    longest = max((_w(r_[ci]) for r_ in rows if ci < len(r_)),
                                  default=4)
                    weights.append(min(max(longest, 6), 34))
                total_w = sum(weights)
                page_cm = 21.0 - 4.8
                widths = [Cm(max(page_cm * w / total_w, 1.9)) for w in weights]

                for ri, cells in enumerate(rows):
                    row = tbl.add_row()
                    # 表头跨页重复
                    if ri == 0:
                        trpr = row._tr.get_or_add_trPr()
                        th = OxmlElement("w:tblHeader")
                        th.set(qn("w:val"), "true")
                        trpr.append(th)
                    for ci in range(cols):
                        cell = row.cells[ci]
                        cell.width = widths[ci]
                        cell.text = ""
                        p = cell.paragraphs[0]
                        p.paragraph_format.space_after = Pt(2)
                        p.paragraph_format.space_before = Pt(2)
                        p.paragraph_format.line_spacing = 1.25
                        txt = cells[ci] if ci < len(cells) else ""
                        add_runs(p, txt,
                                 size=9.5,
                                 color=INK if ri == 0 else INK2,
                                 base_font=HEI if ri == 0 else SONG,
                                 bold=(ri == 0))
                        if ri == 0:
                            shade(cell, "F0EBE2")

                # 行数少的表格整块留在同一页：只留一行被推到下页很难看。
                # 大表格继续允许跨页（表头已设 tblHeader 自动重复）。
                if len(rows) <= 6:
                    last = len(tbl.rows) - 1
                    for ri2, row2 in enumerate(tbl.rows):
                        for cell2 in row2.cells:
                            for p2 in cell2.paragraphs:
                                p2.paragraph_format.keep_with_next = (ri2 < last)

                doc.add_paragraph().paragraph_format.space_after = Pt(4)
            continue

        # 标题
        m = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if m:
            level = len(m.group(1))
            text = m.group(2).strip()

            if level == 1 and first_h1:
                first_h1 = False
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.space_before = Pt(6)
                p.paragraph_format.space_after = Pt(4)
                r = p.add_run(text)
                set_cjk(r, HEI)
                r.font.size = Pt(22)
                r.bold = True
                r.font.color.rgb = INK
                # 标题下的朱色短线
                p2 = doc.add_paragraph()
                p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p2.paragraph_format.space_after = Pt(14)
                add_bottom_border(p2, "B5442F", 12)
                i += 1
                continue

            sizes = {1: 17, 2: 14, 3: 11.5, 4: 10.5}
            before = {1: 18, 2: 16, 3: 12, 4: 9}
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(before[level])
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.line_spacing = 1.35
            p.paragraph_format.keep_with_next = True
            r = p.add_run(text)
            set_cjk(r, HEI)
            r.font.size = Pt(sizes[level])
            r.bold = True
            r.font.color.rgb = INK if level <= 2 else INK2
            i += 1
            continue

        # 引用块
        if stripped.startswith(">"):
            buf = []
            while i < n and lines[i].strip().startswith(">"):
                buf.append(lines[i].strip().lstrip(">").strip())
                i += 1
            for bl in buf:
                if not bl:
                    continue
                p = doc.add_paragraph()
                pf = p.paragraph_format
                pf.left_indent = Cm(0.7)
                pf.line_spacing = 1.4
                pf.space_after = Pt(4)
                add_runs(p, bl, size=10, color=INK3)
            p.paragraph_format.space_after = Pt(10)
            continue

        # 图片
        m = re.match(r"^!\[(.*?)\]\((.*?)\)$", stripped)
        if m:
            caption, path = m.group(1), m.group(2)
            img = (SRC.parent / path).resolve()
            if img.exists():
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.space_before = Pt(8)
                p.paragraph_format.space_after = Pt(10)
                p.add_run().add_picture(str(img), width=BODY_W)
                # 图内已带「图 N + 标题」，此处不再重复图注
            i += 1
            continue

        # 无序列表
        if re.match(r"^[-*]\s+", stripped):
            content = re.sub(r"^[-*]\s+", "", stripped)
            p = doc.add_paragraph(style="List Bullet")
            pf = p.paragraph_format
            pf.line_spacing = 1.45
            pf.space_after = Pt(3)
            pf.left_indent = Cm(0.9)
            # 列表项之间不断页（最后一项除外，否则会把后文一起拉走）
            nxt = lines[i + 1].strip() if i + 1 < n else ""
            pf.keep_with_next = bool(re.match(r"^[-*]\s+", nxt))
            add_runs(p, content, size=10.5)
            i += 1
            continue

        # 有序列表：不用 List Number 样式——Word 的编号在整篇里连续，
        # 第二处有序列表会从 4 开始。手工写序号，缩进用悬挂缩进还原。
        if re.match(r"^\d+\.\s+", stripped):
            content = re.sub(r"^\d+\.\s+", "", stripped)
            ordered_no += 1
            p = doc.add_paragraph()
            pf = p.paragraph_format
            pf.line_spacing = 1.45
            pf.space_after = Pt(4)
            pf.left_indent = Cm(1.1)
            pf.first_line_indent = Cm(-0.55)
            nxt = lines[i + 1].strip() if i + 1 < n else ""
            pf.keep_with_next = bool(re.match(r"^\d+\.\s+", nxt))
            add_runs(p, f"{ordered_no}.\t{content}", size=10.5)
            i += 1
            continue
        ordered_no = 0

        # 普通段落
        body_par(doc, stripped)
        i += 1

    # 页脚页码
    footer = sec.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = footer.add_run()
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    run._element.addnext(fld)

    doc.save(str(OUT))
    print("saved:", OUT)
    print("size :", round(OUT.stat().st_size / 1024), "KB")


if __name__ == "__main__":
    try:
        build()
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
