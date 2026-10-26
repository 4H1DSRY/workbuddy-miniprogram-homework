const fs = require('fs')
const path = require('path')
// 相对定位：脚本放在项目根，小程序包固定在 ./miaoguanjia
// 不要写死绝对路径，否则换机器 / 迁移目录会直接崩
const ROOT = path.join(__dirname, 'miaoguanjia')
process.chdir(ROOT)

const errs = []

function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    if (fs.statSync(p).isDirectory()) walk(p)
    else if (f.endsWith('.json')) {
      try {
        JSON.parse(fs.readFileSync(p, 'utf8'))
      } catch (e) {
        errs.push('JSON 语法错: ' + p + ' -> ' + e.message)
      }
    }
  }
}
walk('.')

const app = JSON.parse(fs.readFileSync('app.json', 'utf8'))
app.pages.forEach((pg) => {
  ;['.js', '.wxml', '.wxss', '.json'].forEach((ext) => {
    if (!fs.existsSync(pg + ext)) errs.push('缺文件: ' + pg + ext)
  })
})

app.tabBar.list.forEach((t) => {
  ;[t.iconPath, t.selectedIconPath].forEach((ip) => {
    if (!fs.existsSync(ip)) errs.push('缺图标: ' + ip)
  })
})

const VOID = new Set(['image', 'input', 'import', 'include', 'wxs', 'br'])
function checkWxml(p) {
  let s = fs.readFileSync(p, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  const re = /<\s*(\/?)\s*([a-zA-Z0-9-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)\s*>/g
  let m
  const stack = []
  while ((m = re.exec(s))) {
    const closing = m[1] === '/'
    const name = m[2]
    const selfClose = m[4] === '/'
    if (closing) {
      const top = stack.pop()
      if (top !== name) errs.push('标签不配对 ' + p + ': </' + name + '> 对应 <' + top + '>')
    } else if (!selfClose && !VOID.has(name)) {
      stack.push(name)
    }
  }
  if (stack.length) errs.push('未闭合标签 ' + p + ': ' + stack.join(','))
}
app.pages.forEach((pg) => checkWxml(pg + '.wxml'))

app.pages.forEach((pg) => {
  const wxml = fs.readFileSync(pg + '.wxml', 'utf8')
  const js = fs.readFileSync(pg + '.js', 'utf8')
  const hs = new Set()
  const re = /bind:?([a-zA-Z]+)="([a-zA-Z0-9_]+)"/g
  let m
  while ((m = re.exec(wxml))) hs.add(m[2])
  hs.forEach((h) => {
    if (!new RegExp('\\b' + h + '\\s*\\(', 'm').test(js)) errs.push('缺处理函数 ' + pg + ': ' + h)
  })
})

// 检查 WXML 里引用的本地图片是否都存在
app.pages.forEach((pg) => {
  const wxml = fs.readFileSync(pg + '.wxml', 'utf8')
  const re = /src="(\/[^"{}]+)"/g
  let m
  while ((m = re.exec(wxml))) {
    const f = m[1].replace(/^\//, '')
    if (!fs.existsSync(f)) errs.push('图片不存在 ' + pg + ' -> ' + m[1])
  }
})

/* ---------------- 设计 token 一致性 ---------------- */

// 1. app.wxss 里定义的 token 清单
const appWxss = fs.readFileSync('app.wxss', 'utf8')
const definedTokens = new Set()
{
  const re = /(--c-[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g
  let m
  while ((m = re.exec(appWxss))) definedTokens.add(m[1])
}
if (!definedTokens.size) errs.push('app.wxss 未定义任何 --c-* token')

// 2. 各页面 wxss 引用的 token 必须已定义
const wxssFiles = ['app.wxss'].concat(
  app.pages.map((pg) => pg + '.wxss').filter((f) => fs.existsSync(f))
)
wxssFiles.forEach((f) => {
  const css = fs.readFileSync(f, 'utf8')
  const re = /var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g
  let m
  while ((m = re.exec(css))) {
    if (!definedTokens.has(m[1])) errs.push('未定义的 token ' + m[1] + ' @ ' + f)
  }
})

// 3. token 化过的色值不应再以裸色值出现（白/黑除外）
// 曾经作为 token 存在、因此不该再以裸色值出现的颜色。
// 前半是旧橙配色（历史遗留），后半是现行纸墨朱。
const TOKENIZED = [
  'FF7A45', 'E8763F', 'FFF0E6', 'FFF8F3', '2E2A27', '6E645C', 'A2968B', 'B3A79C', 'F3E8DE', 'F6EBE1', 'C9BCB0',
  'B5442F', 'AE412D', '9C3927', 'F3E7E2', 'FAF8F4', '1E1B19', '4A443F', '7A7168', '8C8178', 'B8B0A6', 'C9C2B8', 'E6E0D6', 'F0EBE2', 'DED8CC'
]
wxssFiles.forEach((f) => {
  const css = fs.readFileSync(f, 'utf8').replace(/--c-[a-z0-9-]+\s*:\s*#[0-9A-Fa-f]{6}/g, '')
  const re = /#([0-9A-Fa-f]{6})\b/g
  let m
  while ((m = re.exec(css))) {
    if (TOKENIZED.indexOf(m[1].toUpperCase()) >= 0) {
      errs.push('裸色值 #' + m[1] + ' 应改用 token @ ' + f)
    }
  }
})

// 4. theme.js 的 PALETTE 必须与 app.wxss 同名 token 取值一致
{
  const themeSrc = fs.readFileSync('utils/theme.js', 'utf8')
  // chart* 三个是 canvas 专用，不映射到 CSS 变量，故不在此列。
  // 2026-10-21 起兼容名（brand* / text* / line*）已从 CSS 与 JS 两侧同时移除，
  // 全站只保留语义名；三态色为新增，同样要求两侧同值。
  const pairs = [
    ['bg', 'bg'], ['paper', 'paper'],
    ['ink', 'ink'], ['ink2', 'ink-2'], ['ink3', 'ink-3'],
    ['ink4', 'ink-4'], ['ink5', 'ink-5'], ['ink6', 'ink-6'],
    ['vermilion', 'vermilion'], ['vermilionDeep', 'vermilion-deep'], ['vermilionTint', 'vermilion-tint'],
    ['rule', 'rule'], ['ruleSoft', 'rule-soft'], ['ruleStrong', 'rule-strong'],
    ['alertFg', 'alert-fg'], ['alertBg', 'alert-bg'],
    ['cautionFg', 'caution-fg'], ['cautionBg', 'caution-bg'],
    ['safeFg', 'safe-fg'], ['safeBg', 'safe-bg']
  ]
  pairs.forEach(([jsKey, cssKey]) => {
    const jsMatch = themeSrc.match(new RegExp(jsKey + ":\\s*'(#[0-9A-Fa-f]{6})'"))
    const cssMatch = appWxss.match(new RegExp('--c-' + cssKey + '\\s*:\\s*(#[0-9A-Fa-f]{6})'))
    if (!jsMatch) { errs.push('theme.js 缺少 PALETTE.' + jsKey); return }
    if (!cssMatch) { errs.push('app.wxss 缺少 --c-' + cssKey); return }
    if (jsMatch[1].toUpperCase() !== cssMatch[1].toUpperCase()) {
      errs.push('token 取值不一致：PALETTE.' + jsKey + '=' + jsMatch[1] + ' 但 --c-' + cssKey + '=' + cssMatch[1])
    }
  })
}

// 6. 合规：个人主体不得提供诊断，界面不得出现结论性判断或 AI 参与医疗判断的表述
// 注意白名单语境：单独的「诊断」允许出现（例如「不提供诊断」），但「确诊 / 疑似 / 判定为」不行
{
  const BANNED = [
    '确诊', '疑似', '判定为', '诊断为', 'AI 诊断', 'AI诊断', '智能诊断',
    'AI 生成', 'AI生成', '算法分析', '大模型', '辅助诊断'
  ]
  const collect = (d, out) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f)
      if (fs.statSync(p).isDirectory()) {
        if (f !== 'docs' && f !== 'node_modules') collect(p, out)
      } else if (/\.(wxml|js|json)$/.test(f)) {
        out.push(p)
      }
    }
    return out
  }
  collect('.', []).forEach((p) => {
    const text = fs.readFileSync(p, 'utf8')
    BANNED.forEach((w) => {
      if (text.indexOf(w) >= 0) {
        errs.push('合规：' + p + ' 出现「' + w + '」，个人主体不得提供诊断')
      }
    })
  })

  // 免责文案是提审要件，删掉必须报错
  const MUST_HAVE = [
    ['pages/symptom/symptom.wxml', '不提供诊断或医疗建议', '症状页顶部免责条'],
    ['pages/report/report.wxml', '未经兽医确认', '报告页免责声明'],
    ['pages/report/report.wxml', '未列出的情况可能同样重要', '清单完整性声明'],
    ['utils/store.js', '仅供就诊沟通使用', '分级依据说明']
  ]
  MUST_HAVE.forEach(([p, kw, desc]) => {
    if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8').indexOf(kw) < 0) {
      errs.push('合规：缺少' + desc + '（' + p + ' 应含「' + kw + '」）')
    }
  })
}

console.log(errs.length ? errs.join('\n') : 'ALL CHECKS PASSED')
// 退出码是守门人的意义所在：CI（.github/workflows）靠它判定成败。
// 没有这行，npm test 永远返回 0，检查等于没做。
process.exit(errs.length ? 1 : 0)
