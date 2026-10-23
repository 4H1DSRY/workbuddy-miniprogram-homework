# -*- coding: utf-8 -*-
"""
课程报告配图生成器。

用 HTML + CSS 排版（比手算 SVG 坐标快，也不用引入绘图库），
再用 playwright 以 deviceScaleFactor=2 截成 PNG。
产物落在 docs/figures/，md 与 docx 共用同一份 PNG，避免两处不一致。

运行（必须从项目根目录）：
    python tools/assets/make_report_figs.py
"""

import asyncio
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "figures"
OUT.mkdir(parents=True, exist_ok=True)

# 与 app.wxss 的纸墨朱同值，图不能脱离产品自己另起一套色
PAPER = "#FAF8F4"
CARD = "#FFFFFF"
INK = "#1E1B19"
INK2 = "#4A4540"
INK3 = "#6B6560"
INK4 = "#9A938B"
RULE = "#DCD5CA"
RULE2 = "#C9C2B8"
VERM = "#B5442F"

FONT = '"Songti SC","STSong","SimSun",serif'
MONO = '"Cascadia Mono","Consolas",monospace'

BASE_CSS = f"""
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    background: {PAPER};
    font-family: {FONT};
    color: {INK};
    -webkit-font-smoothing: antialiased;
    padding: 56px 60px;
  }}
  .wrap {{ width: 1080px; }}
  .h {{ font-size: 25px; letter-spacing: .04em; }}
  .sub {{ font-size: 14px; color: {INK4}; margin-top: 10px; letter-spacing: .02em; }}
  .rule {{ height: 1px; background: {RULE}; }}
"""


def fig_arch() -> str:
    """图 1：分层架构与数据流"""
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}
  .layer {{
    background: {CARD};
    border: 1px solid {RULE};
    border-radius: 8px;
    padding: 20px 24px;
    position: relative;
  }}
  .lt {{ font-size: 19px; }}
  .lm {{ font-family: {MONO}; font-size: 12.5px; color: {INK4}; margin-left: 10px; }}
  .ld {{ font-size: 13.5px; color: {INK3}; margin-top: 9px; line-height: 1.75; }}
  .pills {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 13px; }}
  .pill {{
    border: 1px solid {RULE2}; border-radius: 4px;
    padding: 6px 11px; font-size: 13px; color: {INK2};
    background: {PAPER};
  }}
  .pill b {{ font-weight: normal; color: {INK}; }}
  .note {{
    font-size: 12.5px; color: {VERM};
    position: absolute; right: 22px; top: 22px; letter-spacing: .02em;
  }}
  .arrow {{ text-align: center; padding: 10px 0; }}
  .arrow .lb {{ font-size: 12.5px; color: {INK3}; font-family: {MONO}; }}
  .arrow .bar {{ width: 1px; height: 13px; background: {RULE2}; margin: 4px auto 0; }}
  .arrow .tip {{
    width: 0; height: 0; margin: 0 auto;
    border-left: 4px solid transparent; border-right: 4px solid transparent;
    border-top: 5px solid {RULE2};
  }}
  .grid {{ display: flex; gap: 20px; }}
  .main {{ flex: 1; }}
  .side {{ width: 300px; }}
  .sidebox {{
    border: 1px solid {RULE}; border-radius: 8px; background: {CARD};
    padding: 18px 20px;
  }}
  .inv {{ display: flex; gap: 9px; flex-wrap: wrap; margin-top: 14px; }}
  .inj {{
    font-size: 12.5px; color: {INK2}; border: 1px dashed {RULE2};
    border-radius: 4px; padding: 6px 10px; background: {CARD};
  }}
  .inj i {{ font-style: normal; color: {VERM}; margin-right: 6px; }}
</style></head><body><div class="wrap">
  <div class="h">图 1　分层架构与数据流</div>
  <div class="sub">六页共享一个数据层，页面之间互不通信</div>
  <div class="rule" style="margin:18px 0 26px"></div>

  <div class="grid">
    <div class="main">

      <div class="layer">
        <div class="lt">页面层<span class="lm">pages/ · 6 页 · 3,144 行</span></div>
        <div class="pills">
          <div class="pill"><b>首页</b> 状态与四个动作</div>
          <div class="pill"><b>记录</b> 曲线与时间线</div>
          <div class="pill"><b>我的</b> 档案与设置</div>
          <div class="pill"><b>档案</b> 增删改</div>
          <div class="pill"><b>症状</b> 勾选与描述</div>
          <div class="pill"><b>就诊描述</b> 模板拼装</div>
        </div>
      </div>

      <div class="arrow">
        <div class="bar"></div>
        <div class="lb">store.*()　只调用函数，不直接碰 Storage</div>
        <div class="bar"></div>
        <div class="tip"></div>
      </div>

      <div class="layer">
        <div class="lt">数据层<span class="lm">utils/store.js · 840 行 · 27 个导出</span></div>
        <div class="ld">种子数据 · 增删改查 · 统计与格式化 · 表单校验 <span style="font-family:{MONO};font-size:12px">validateCat</span> · 分诊判定 <span style="font-family:{MONO};font-size:12px">calcTier</span> · 就诊描述拼接 <span style="font-family:{MONO};font-size:12px">buildVisitReport</span></div>
      </div>

      <div class="arrow">
        <div class="bar"></div>
        <div class="lb">wx.setStorageSync / getStorageSync</div>
        <div class="bar"></div>
        <div class="tip"></div>
      </div>

      <div class="layer">
        <div class="lt">本机 Storage</div>
        <div class="note">零网络 · 全站 0 条请求</div>
        <div class="ld">mgj_cats · mgj_records · mgj_symptoms · mgj_devices · mgj_seeded</div>
      </div>

    </div>

    <div class="side">
      <div class="sidebox">
        <div class="lt" style="font-size:17px">主题层</div>
        <div class="ld" style="margin-top:12px">
          <div style="font-family:{MONO};font-size:12.5px;color:{INK2}">app.wxss</div>
          <div style="color:{INK4};font-size:12px;padding:3px 0 0 10px">CSS 变量 --c-*</div>
          <div style="color:{INK4};font-size:12px;text-align:center;padding:7px 0">↕ 同名同值</div>
          <div style="font-family:{MONO};font-size:12.5px;color:{INK2}">utils/theme.js</div>
          <div style="color:{INK4};font-size:12px;padding:3px 0 0 10px">JS 常量 PALETTE</div>
        </div>
        <div class="rule" style="margin:16px 0"></div>
        <div style="font-size:12.5px;color:{INK3};line-height:1.85">
          为什么要两份：<span style="font-family:{MONO};font-size:11.5px">canvas</span> 与
          <span style="font-family:{MONO};font-size:11.5px">conic-gradient</span>
          读不到 CSS 变量。<br>
          一致性由 <span style="font-family:{MONO};font-size:11.5px">check.js</span> 强制校验，改一处漏一处会红。
        </div>
        <div class="rule" style="margin:16px 0"></div>
        <div style="font-size:12.5px;color:{INK3};line-height:1.95">
          <div style="color:{INK2};margin-bottom:4px">这套分层换来三件事</div>
          · 页面之间不直接通信，切页靠 <span style="font-family:{MONO};font-size:11.5px">onShow</span> 重读<br>
          · 一处改完，其他页下次显示就是新的<br>
          · 新增一页只接数据层，不动已有页面
        </div>
      </div>
    </div>
  </div>

  <div style="margin-top:26px">
    <div style="font-size:14px;color:{INK3}">五条不变量（破了就要回滚）</div>
    <div class="inv">
      <div class="inj"><i>1</i>零网络请求</div>
      <div class="inj"><i>2</i>页面不直接读写 Storage</div>
      <div class="inj"><i>3</i>色彩 token 双份同名同值</div>
      <div class="inj"><i>4</i>朱色每页只留一个焦点</div>
      <div class="inj"><i>5</i>不用 emoji 当图标</div>
    </div>
  </div>
</div></body></html>"""


def fig_verify() -> str:
    """图 2：四层验证链路"""
    layers = [
        ("L1", "静态", "check.js", "JSON 语法、页面文件齐全、WXML 标签配对、事件函数是否存在、图片路径、token 一致性、合规文案", "逻辑错误、运行时错误"),
        ("L2", "逻辑", "simulate.js", "打桩 wx API，真跑数据层与单页生命周期", "跨页接线、渲染效果"),
        ("L2+", "端到端", "e2e.js", "带页面栈的路由模拟器，真压栈/真弹栈", "渲染效果、布局溢出"),
        ("L3", "视觉", "开发者工具 / 真机", "布局溢出、图标可辨性、对比度、字体回退", "极端数据量下的行为"),
    ]
    rows = ""
    for code, name, tool, catch, miss in layers:
        hl = f"background:{PAPER};" if code in ("L2", "L2+") else ""
        rows += f"""
        <div style="display:flex;border-bottom:1px solid {RULE};{hl}">
          <div style="width:74px;padding:15px 0 15px 16px;font-family:{MONO};font-size:15px;color:{VERM}">{code}</div>
          <div style="width:96px;padding:15px 12px;font-size:15px">{name}</div>
          <div style="width:150px;padding:15px 12px;font-family:{MONO};font-size:11.5px;color:{INK3}">{tool}</div>
          <div style="flex:1;padding:15px 12px;font-size:13px;color:{INK2};line-height:1.65">{catch}</div>
          <div style="width:150px;padding:15px 12px;font-size:12.5px;color:{INK4};line-height:1.65">{miss}</div>
        </div>"""
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}
  .tbl {{ border:1px solid {RULE}; border-radius:8px; overflow:hidden; background:{CARD}; }}
  .th {{ display:flex; background:{CARD}; border-bottom:1px solid {RULE2}; }}
  .th > div {{ padding:11px 12px; font-size:12.5px; color:{INK3}; letter-spacing:.04em; }}
  .sum {{ display:flex; gap:14px; margin-top:24px; }}
  .kv {{ flex:1; border:1px solid {RULE}; border-radius:8px; background:{CARD}; padding:16px 18px; }}
  .kv .n {{ font-size:30px; color:{VERM}; line-height:1.1; }}
  .kv .t {{ font-size:12.5px; color:{INK3}; margin-top:7px; line-height:1.6; }}
  .flow {{ display:flex; align-items:center; gap:9px; margin-top:26px; font-size:13px; color:{INK3}; flex-wrap:wrap; }}
  .flow .s {{ border:1px solid {RULE2}; border-radius:4px; padding:6px 12px; background:{CARD}; color:{INK2}; }}
  .flow .a {{ color:{RULE2}; }}
  .flow .r {{ border-color:{VERM}; color:{VERM}; }}
</style></head><body><div class="wrap">
  <div class="h">图 2　四层验证，每层只能抓到自己那一类错</div>
  <div class="sub">四层缺一层不算过；退出码为 1 时 CI 变红</div>
  <div class="rule" style="margin:18px 0 26px"></div>

  <div class="tbl">
    <div class="th">
      <div style="width:74px;padding-left:16px">层</div>
      <div style="width:96px">名称</div>
      <div style="width:150px">工具</div>
      <div style="flex:1">能发现</div>
      <div style="width:150px">发现不了</div>
    </div>
    {rows}
  </div>

  <div class="sum">
    <div class="kv"><div class="n">99</div><div class="t">simulate.js<br>数据层与单页生命周期断言</div></div>
    <div class="kv"><div class="n">74</div><div class="t">e2e.js<br>跨页接线断言</div></div>
    <div class="kv"><div class="n">6</div><div class="t">check.js<br>类静态规则</div></div>
    <div class="kv"><div class="n">0</div><div class="t">Console<br>错误与警告</div></div>
  </div>

  <div class="flow">
    <div class="s">改一行代码</div><div class="a">→</div>
    <div class="s">check.js</div><div class="a">→</div>
    <div class="s">simulate.js</div><div class="a">→</div>
    <div class="s">e2e.js</div><div class="a">→</div>
    <div class="s">开发者工具</div><div class="a">→</div>
    <div class="s r">npm test 退出码 0</div>
  </div>
</div></body></html>"""


def fig_symptom() -> str:
    """图 3：症状清单的推导链路"""
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}
  .row {{ display:flex; gap:18px; align-items:stretch; }}
  .col {{ flex:1; border:1px solid {RULE}; border-radius:8px; background:{CARD}; padding:18px 18px 16px; }}
  .st {{ font-size:15px; }}
  .sn {{ font-family:{MONO}; font-size:11.5px; color:{INK4}; margin-top:6px; }}
  .sl {{ font-size:12.5px; color:{INK3}; line-height:1.8; margin-top:11px; }}
  .sl b {{ font-weight:normal; color:{INK2}; }}
  .ar {{ width:26px; display:flex; align-items:center; justify-content:center; color:{RULE2}; font-size:18px; }}
  .res {{ margin-top:24px; border:1px solid {RULE2}; border-radius:8px; background:{CARD}; padding:20px 24px; }}
  .groups {{ display:flex; gap:9px; flex-wrap:wrap; margin-top:14px; }}
  .g {{ border:1px solid {RULE}; border-radius:4px; padding:7px 11px; font-size:13px; color:{INK2}; background:{PAPER}; }}
  .g span {{ color:{INK4}; font-family:{MONO}; font-size:11px; margin-left:5px; }}
  .tier {{ display:flex; gap:12px; margin-top:22px; }}
  .t {{ flex:1; border-radius:6px; padding:14px 16px; background:{CARD}; border:1px solid {RULE}; }}
  .t .k {{ font-size:12px; letter-spacing:.06em; }}
  .t .v {{ font-size:15px; margin-top:8px; }}
  .t .d {{ font-size:12px; color:{INK4}; margin-top:7px; line-height:1.6; }}
  .t1 {{ border-left:3px solid {VERM}; }} .t1 .k {{ color:{VERM}; }}
  .t2 {{ border-left:3px solid #8F5418; }} .t2 .k {{ color:#8F5418; }}
  .t3 {{ border-left:3px solid {INK4}; }} .t3 .k {{ color:{INK3}; }}
</style></head><body><div class="wrap">
  <div class="h">图 3　症状清单不是凭常识分的</div>
  <div class="sub">兽医病史采集的固定结构 → 当代猫病谱 → 反查覆盖，三步互相约束</div>
  <div class="rule" style="margin:18px 0 26px"></div>

  <div class="row">
    <div class="col">
      <div class="st">① 兽医怎么采集病史</div>
      <div class="sn">SOAP · S 段 + review of systems</div>
      <div class="sl">
        SOAP 四段里<b>只有 S（Subjective）是主人能提供的</b>，
        也正是本产品要采集的部分。<br>
        系统回顾的固定顺序：一般状态 → 消化 → 泌尿 → 呼吸 →
        眼 → 耳 → 口腔 → 皮肤 → 神经 → 骨科。
      </div>
    </div>
    <div class="ar">→</div>
    <div class="col">
      <div class="st">② 当代常见猫病谱</div>
      <div class="sn">14 类，逐类映射早期表现</div>
      <div class="sl">
        CKD、甲亢、FLUTD、糖尿病、牙病 / FORL、IBD、
        上呼吸道、猫癣、骨关节炎、肥胖、肝脂质沉积、HCM、癫痫、中毒。<br>
        <b>每个表现都要能回答「为什么必须有这一项」。</b>
      </div>
    </div>
    <div class="ar">→</div>
    <div class="col">
      <div class="st">③ 反查有没有孤儿项</div>
      <div class="sn">每一项至少对应一种疾病</div>
      <div class="sl">
        对不上任何疾病的选项 = 噪音，删掉或合并。<br>
        <b>反向也查</b>：只列「食欲下降」会整类漏掉甲亢与糖尿病的
        「吃得很多却掉体重」。
      </div>
    </div>
  </div>

  <div class="res">
    <div style="font-size:14px;color:{INK3}">产出：9 组 42 项，按系统回顾的顺序排列</div>
    <div class="groups">
      <div class="g">一般状态<span>4</span></div>
      <div class="g">吃喝<span>6</span></div>
      <div class="g">被毛皮肤<span>5</span></div>
      <div class="g">消化<span>5</span></div>
      <div class="g">泌尿<span>5</span></div>
      <div class="g">呼吸<span>4</span></div>
      <div class="g">眼耳<span>4</span></div>
      <div class="g">口腔<span>5</span></div>
      <div class="g">四肢神经<span>4</span></div>
    </div>
  </div>

  <div style="font-size:13px;color:{INK3};margin-top:26px">分诊按「多久之内要处理」排，不按「症状多少」排</div>
  <div class="tier">
    <div class="t t1"><div class="k">急诊 · 5 项</div><div class="v">请立即就医</div><div class="d">蹲很久尿不出、张嘴呼吸、抽搐、后腿无力 / 拖行、误食有毒物</div></div>
    <div class="t t2"><div class="k">急 · 3 项</div><div class="v">建议今天或明天就诊</div><div class="d">便中带血或发黑、眼睛红 / 睁不开、完全不吃</div></div>
    <div class="t t3"><div class="k">常规</div><div class="v">可先观察，继续记录</div><div class="d">其余项。依据是记录完整度，不是病情严重度</div></div>
  </div>
</div></body></html>"""


FIGS = [
    ("fig1-architecture", fig_arch()),
    ("fig2-verification", fig_verify()),
    ("fig3-symptom-source", fig_symptom()),
]


async def main():
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1200, "height": 800},
                                      device_scale_factor=2)
        for name, html in FIGS:
            tmp = OUT / f".{name}.html"
            tmp.write_text(html, encoding="utf-8")
            await page.goto(tmp.as_uri())
            await page.wait_for_timeout(220)
            el = await page.query_selector(".wrap")
            box = await el.bounding_box()
            await page.set_viewport_size({
                "width": 1200,
                "height": int(box["height"]) + 120,
            })
            await page.wait_for_timeout(120)
            out = OUT / f"{name}.png"
            await page.screenshot(path=str(out), full_page=True)
            tmp.unlink()
            print(f"{name}.png  {out.stat().st_size // 1024} KB")
        await browser.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print("FAILED:", e, file=sys.stderr)
        sys.exit(1)
