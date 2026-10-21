# 喵管家 · 项目记忆

> 只记「下次不看代码就会犯错」的事。产品说明在 `README.md`，验收口径在 `PROJECT.md`。

## 项目坐标

- 代码根：`D:\Claw\workbuddy-course\homework-4`
- 小程序包：`miaoguanjia/`（只有这个目录会上传）
- 仓库：`github.com/4H1DSRY/workbuddy-miniprogram-homework`（private，SSH）
- 开发者工具：微信开发者工具，项目路径指向 `miaoguanjia/`，AppID 用 `touristappid`

## 工作流

- 改完任何东西：`npm test`（= `check.js` + `simulate.js`）
- 涉及尺寸/间距/字号：**必须**再截一张图确认 —— L1 + L2 都测不出布局溢出
- 截图用 `tools/capture/` 下的脚本，不要抢前台焦点
- 提交信息带范围前缀：`feat:` / `fix:` / `style:` / `docs:` / `chore:`

## 踩过的坑

| 坑 | 结论 |
| --- | --- |
| 模拟器白屏 | 不是代理问题，是**本机 DNS 对 `servicewechat.com` 返回失效 IP**。hosts 里映射到 `106.53.142.208` / `106.55.123.54` 解决。改过 `hosts.bak.20261021` |
| 数据改了模拟器不变 | 热编译不重跑 `onLaunch`，Storage 里是旧种子。改 `SEED_VERSION` 后仍需 `cli close` + `cli open` 真正重启 |
| Python heredoc | Git Bash 会把正则里的 `\s` 转成 `/s`，导致 `re.sub` 零匹配。写独立脚本文件，不要走 heredoc |
| WXML 静态校验误判 | 模板表达式里出现 `<` 会被当成标签开头，`check.js` 报标签不配对。改用 `>=` 规避 |
| 图标不可辨 | 22px 是临界尺寸，线球像叉、表盘像上传箭头、针管像斜线。新图标一律先出 19/22px 对照图 |
| `switch` 颜色 | 原生组件不吃 CSS 变量，只能写死十六进制 |
| tabBar 图标 | 只支持 PNG 位图，不支持内联 SVG |

## 不能破的

见 `PROJECT.md` 第四节「架构不变量」。最高频的三条：零网络、页面不直接碰 Storage、朱色每页只有一个焦点。

## 待补

- 真猫照片（`images/cats/cat1-3.jpg` 现为灰度占位）
- Android 真机字体确认（宋体在安卓会回退黑体）
