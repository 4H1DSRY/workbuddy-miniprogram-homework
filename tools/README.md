# tools · 开发辅助脚本

**不属于小程序包**，不会被上传。小程序代码只认 `miaoguanjia/` 目录。

## 运行前提

所有脚本都必须**从项目根**（含 `package.json` 的那一层）运行，脚本内部用相对路径访问 `miaoguanjia/` 与 `_shots/`，换目录会找不到文件。

```bash
cd D:\Claw\workbuddy-course\homework-4
PY="C:/Users/donny/.workbuddy/binaries/python/envs/default/Scripts/python.exe"
```

`capture/` 下的脚本依赖 Windows `user32` / `gdi32`，只能在 Windows 跑。

---

## assets/ · 资产生成

| 脚本 | 用途 | 运行 |
| --- | --- | --- |
| `make_icons.py` | 生成 13 个线条图标（`images/icons/`）与 6 个 tabBar 图标（`images/tabbar/`）。Pillow 绘制，24×24 设计坐标，4× 超采样 + LANCZOS 缩小抗锯齿 | `$PY tools/assets/make_icons.py` |
| `make_assets.py` | 生成三只猫的占位头像与 `default.jpg` | `$PY tools/assets/make_assets.py` |

改图标的唯一入口是 `make_icons.py`。**手改 PNG 会在下次生成时被覆盖。**

> `i_play` 从线球改逗猫棒、`i_weight` 从表盘改俯视电子秤、`i_vaccine` 从针管改医疗十字，都是因为原形在 22px 下不可辨。改任何图标后必须跑 `_preview_icons.py` 复核。

---

## capture/ · 开发者工具截图与窗口驱动

用于在**不抢前台焦点**的前提下抓取模拟器画面（后台 `PrintWindow` + `GetDIBits`）。

| 脚本 | 用法 | 说明 |
| --- | --- | --- |
| `_listwins.py` | `$PY tools/capture/_listwins.py` | 枚举顶层窗口，找出项目窗口的 hwnd |
| `recover_window.py` | `$PY tools/capture/recover_window.py <hwnd>` | 用 `SW_SHOWNOACTIVATE` 把最小化/隐藏的窗口还原，不抢焦点 |
| `_cap.py` | `$PY tools/capture/_cap.py <hwnd> _shots/out.png` | 抓整窗，`PW_RENDERFULLCONTENT` |
| `_crop.py` | `$PY tools/capture/_crop.py <src> <dst> <x1> <y1> <x2> <y2> [scale]` | 裁剪 + 缩放 |
| `_click.py` | `$PY tools/capture/_click.py <hwnd> <img_x> <img_y> [img_w]` | 向窗口投递合成点击（可驱动模拟器原生 tabBar） |
| `_jump.py` | `$PY tools/capture/_jump.py <page> <out> <hwnd>` | 临时改 `onShow` 跳到目标页再抓图，抓完自动还原 |
| `_scroll.py` | `$PY tools/capture/_scroll.py <js> <page> <offset> <out> <hwnd>` | 注入滚动偏移，抓长页下半屏 |
| `_preview_icons.py` | `$PY tools/capture/_preview_icons.py` | 把全部图标排成 19px / 22px 对照图，用于判断小尺寸可辨性 |

**抓不到图时的排查顺序**：窗口被最小化 → `recover_window.py`；返回 237×39 或全黑 → 窗口处于隐藏态；`cli open` 报成功但没窗口 → `cli close` 后重新 `open`。

---

## legacy/ · 归档

早期脚本，已被 `capture/` 下的版本取代，**不再维护**，保留仅为追溯当时的做法。

`cap.py`、`grab.py`、`ide_shot.py`、`win_capture.py`（四种重复的抓图尝试）、`_cap1.py`、`_clicka.py`、`_clickf.py`（点击的中间版本）、`_listwins2.py`、`_verify_pages.py`（改 `entryPagePath` 抓四页，已被 `_jump.py` 取代）、`fix_styles.py`（一次性批量改样式的迁移脚本，已执行完毕）。
