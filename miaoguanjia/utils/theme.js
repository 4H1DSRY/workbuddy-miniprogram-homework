/**
 * 喵管家 - 色彩 token（JS 侧）
 *
 * 语言：纸 · 墨 · 朱。与 app.wxss 里的 CSS 变量一一对应，取值必须一致。
 * 之所以要有两份，是因为 canvas 2d 与 conic-gradient 读不到 CSS 变量。
 *
 * 命名对应关系：
 *   PALETTE.ink          <->  --c-ink
 *   PALETTE.vermilion    <->  --c-vermilion
 *   PALETTE.rule         <->  --c-rule
 *   ...
 * 兼容名（brand / text / line）保留，供历史调用点继续使用。
 */

const PALETTE = {
  /* 纸 */
  bg: '#FAF8F4',
  paper: '#FFFFFF',

  /* 墨阶 */
  ink: '#1E1B19',
  ink2: '#4A443F',
  ink3: '#7A7168',
  ink4: '#8C8178',
  ink5: '#B8B0A6',
  ink6: '#C9C2B8',

  /* 朱 */
  vermilion: '#AE412D',
  vermilionDeep: '#9C3927',
  vermilionTint: '#F3E7E2',

  /* 线 */
  rule: '#E6E0D6',
  ruleSoft: '#F0EBE2',
  ruleStrong: '#DED8CC',

  /* 白色（canvas 里画端点用） */
  white: '#FFFFFF',

  /* ---- 三态语义（与 app.wxss 的 --c-alert-* / --c-caution-* / --c-safe-* 一一对应）----
     前景与底色成对使用，不要单取一个。 */
  alertFg: '#AE412D',
  alertBg: '#F3E7E2',
  cautionFg: '#8F5418',
  cautionBg: '#F7EADB',
  safeFg: '#4A443F',
  safeBg: '#F0EBE2',

  /* ---- canvas 图表专用 ---- */
  chartGrid: '#EDE7DD',
  chartLabel: '#7A7168',
  chartInk: '#1E1B19'
}

/** 生成环形进度条用的 conic-gradient 字符串 */
function ringGradient(percent, arcColor, trackColor) {
  const deg = Math.max(0, Math.min(100, Number(percent) || 0)) * 3.6
  const track = trackColor || PALETTE.rule
  return 'conic-gradient(' + arcColor + ' 0deg ' + deg + 'deg, ' + track + ' ' + deg + 'deg 360deg)'
}

/**
 * 照顾分的弧色：0 分红 → 100 分绿。
 *
 * 语义是「指标」不是「品牌」：低分要能被一眼看成警示，高分要能被看成做好了。
 * 满分端点刻意不用荧光绿（在纸底上刺眼），用偏深的草绿 #2E9458；
 * 零分端点也刻意不等于品牌朱 #AE412D，而是更饱和的 #B23729——
 * 同一屏里「品牌色」和「告警色」不该是同一个值，否则环变红时读不出是哪种红。
 *
 * 中间段会经过黄绿（50 分约 #84A22E）。这是线性插值的代价，
 * 但照顾分本来就很少停在正好一半：三项均值落在 40–70 才是常态。
 *
 * 返回 hex 而不是 hsl()：conic-gradient 两种都认，但 hex 在
 * 模拟器与真机上渲染一致，也方便断言里直接比对色相。
 */
function scoreColor(percent) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0)) / 100

  const h = 8 + (135 - 8) * p // 8° 红 → 135° 绿
  const s = 0.64 + (0.48 - 0.64) * p
  const l = 0.44 + (0.36 - 0.44) * p

  // HSL → RGB（标准换算，分量各自 clamp 回 0-255）
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let gg = 0
  let b = 0
  if (h < 60) {
    r = c
    gg = x
  } else if (h < 120) {
    r = x
    gg = c
  } else if (h < 180) {
    gg = c
    b = x
  } else if (h < 240) {
    gg = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  const to255 = function (v) {
    return Math.max(0, Math.min(255, Math.round((v + m) * 255)))
  }
  const hex = function (v) {
    const s2 = to255(v).toString(16).toUpperCase()
    return s2.length < 2 ? '0' + s2 : s2
  }
  return '#' + hex(r) + hex(gg) + hex(b)
}

/** rgba 形式的朱色，用于 canvas 渐变填充 */
function brandRgba(alpha) {
  const a = Number(alpha)
  return 'rgba(181, 68, 47, ' + (isNaN(a) ? 1 : a) + ')'
}

/** rgba 形式的墨色，用于图表面积填充 */
function inkRgba(alpha) {
  const a = Number(alpha)
  return 'rgba(30, 27, 25, ' + (isNaN(a) ? 1 : a) + ')'
}

module.exports = {
  PALETTE: PALETTE,
  ringGradient: ringGradient,
  scoreColor: scoreColor,
  brandRgba: brandRgba,
  inkRgba: inkRgba
}
