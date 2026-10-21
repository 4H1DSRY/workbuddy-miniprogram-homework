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
  vermilion: '#B5442F',
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
  alertFg: '#B5442F',
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
  brandRgba: brandRgba,
  inkRgba: inkRgba
}
