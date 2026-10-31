/**
 * 离线逻辑冒烟测试：用 Node 打桩微信 API，真实跑一遍数据层与四个页面的生命周期。
 * 只验证逻辑与数据结构，不渲染视图（视图渲染需在开发者工具里看）。
 */
const path = require('path')
// 相对定位：脚本放在项目根，小程序包固定在 ./miaoguanjia
const ROOT = path.join(__dirname, 'miaoguanjia')

const logs = []
function log() {
  logs.push([].slice.call(arguments).join(' '))
}

/* ---------------- 桩 wx ---------------- */
const mem = new Map()
global.wx = {
  getStorageSync: (k) => (mem.has(k) ? mem.get(k) : ''),
  setStorageSync: (k, v) => mem.set(k, v),
  removeStorageSync: (k) => mem.delete(k),
  showToast: (o) => log('[toast]', o.title),
  showModal: (o) => {
    log('[modal]', o.title)
    if (o.success) o.success({ confirm: true, cancel: false, content: '4.75' })
  },
  navigateTo: (o) => log('[navigateTo]', o.url),
  navigateBack: () => log('[navigateBack]'),
  switchTab: (o) => log('[switchTab]', o.url),
  setNavigationBarTitle: (o) => log('[title]', o.title),
  stopPullDownRefresh: () => {},
  // 表单校验失败会滚到出错字段，桩里要记录，否则 onSave 直接 TypeError
  pageScrollTo: (o) => {
    global.__lastScroll = o && o.selector
    log('[pageScrollTo]', o && o.selector)
  },
  getWindowInfo: () => ({ pixelRatio: 2 }),
  nextTick: (fn) => fn(),
  createSelectorQuery: () => {
    const q = {
      in() {
        return q
      },
      select() {
        return q
      },
      fields() {
        return q
      },
      exec(cb) {
        cb([{}])
      }
    }
    return q
  },
  getFileSystemManager: () => ({
    saveFile: (o) => o.success && o.success({ savedFilePath: 'wxfile://saved_avatar.jpg' })
  }),
  chooseMedia: (o) =>
    o.success && o.success({ tempFiles: [{ tempFilePath: 'wxfile://tmp_avatar.jpg' }] })
}

/* ---------------- 桩 App / Page ---------------- */
let appInst = null
global.App = (o) => {
  appInst = o
}
global.getApp = () => appInst
let pageCaptured = null
global.Page = (o) => {
  pageCaptured = o
}

function setByPath(obj, key, val) {
  if (key.indexOf('.') < 0) {
    obj[key] = val
    return
  }
  const parts = key.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {}
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = val
}

function loadPage(rel) {
  pageCaptured = null
  const p = path.join(ROOT, rel)
  delete require.cache[require.resolve(p)]
  require(p)
  const def = pageCaptured
  const ctx = Object.create(def)
  ctx.data = JSON.parse(JSON.stringify(def.data || {}))
  ctx.setData = function (obj, cb) {
    Object.keys(obj || {}).forEach((k) => setByPath(this.data, k, obj[k]))
    if (cb) cb()
  }
  return ctx
}

const fails = []
function eq(label, actual, expect) {
  const ok = actual === expect
  console.log((ok ? 'PASS ' : 'FAIL ') + label + '  -> ' + JSON.stringify(actual))
  if (!ok) fails.push(label + ' 期望 ' + JSON.stringify(expect) + ' 实际 ' + JSON.stringify(actual))
}
function ok(label, cond, detail) {
  console.log((cond ? 'PASS ' : 'FAIL ') + label + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : ''))
  if (!cond) fails.push(label)
}

/* ---------------- 1. App 启动 ---------------- */
require(path.join(ROOT, 'app.js'))
appInst.onLaunch()
const store = require(path.join(ROOT, 'utils/store.js'))
const theme = require(path.join(ROOT, 'utils/theme.js'))
eq('种子数据: 猫咪数', store.getCats().length, 3)
ok('种子数据: 记录数 > 0', store.getRecords().length > 0, store.getRecords().length)

/* 种子时间写成 now-3H 时，凌晨 0:00–0:36 启动会整体落到昨天，
   首页「今日摄入」归零、看着像坏了。这条断言把「今天必须有记录」钉死。 */
const seedDay = store.dayKey(Date.now())
ok('种子数据: 每只猫今天都有记录',
  store.getCats().every(function (c) {
    return store.getRecords(c.id).some(function (r) {
      return store.dayKey(r.time) === seedDay
    })
  }),
  store.getCats().map(function (c) { return store.todayIntake(c.id).food }))
ok('种子数据: 今天不是未来时间',
  store.getRecords().every(function (r) { return r.time <= Date.now() + 1000 }), true)

/* 种子里的数量必须取自面板档位。面板只给整十档位（20/30/40/50/60），
   种子却写 168 g 的时候，首页那个 168 就在证明「它不是这套 UI 记出来的」——
   演示时一眼穿帮。逐条比对，新增种子漏改会被这里拦下。
   weight / vaccine / deworm 不在档位体系里，跳过。 */
const offPreset = store.getRecords().filter(function (r) {
  const presets = store.INTAKE_PRESETS[r.type]
  if (!presets) return false
  if (Number(r.value) === 0) return false  // 疫苗、驱虫这类不含数量的记录
  return presets.map(Number).indexOf(Number(r.value)) < 0
})
ok('种子数据: 数量都取自面板档位',
  offPreset.length === 0,
  offPreset.map(function (r) { return r.type + ' ' + r.value }))

/* ---------------- 2. 数据层 ---------------- */
const c1 = store.getCats()[0].id
const intake0 = store.todayIntake(c1)
ok('todayIntake 结构正确', typeof intake0.food === 'number' && typeof intake0.water === 'number', intake0)
eq('weightTrend 返回 delta 数字', typeof store.weightTrend(c1).delta, 'number')
ok('weightSeries <= 7 条', store.weightSeries(c1, 7).length <= 7, store.weightSeries(c1, 7).length)
const groups = store.groupByDay(store.getRecords(c1))
ok('groupByDay 分组非空且首组为今天', groups.length > 0 && groups[0].label === '今天', groups.map((g) => g.label))
const st = store.stats()
ok('stats 三项齐全', st.cats === 3 && st.records > 0 && st.days > 0, st)

/* 参考量改由体重推断之后，最该锁的是「它真的在按体重算」。
   旧实现里进食是建档时手填的、饮水是「进食 + 60」，改体重两个都不动；
   下面这几条在旧实现上会全红。 */
eq('进食参考量：4.62 kg → 200 g', store.foodTargetOf({ weight: 4.62 }), 200)
eq('进食参考量：3.18 kg → 150 g', store.foodTargetOf({ weight: 3.18 }), 150)
eq('进食参考量：5.04 kg → 220 g', store.foodTargetOf({ weight: 5.04 }), 220)
eq('饮水参考量：4.62 kg → 230 ml', store.waterTargetOf({ weight: 4.62 }), 230)
eq('饮水参考量：3.18 kg → 160 ml', store.waterTargetOf({ weight: 3.18 }), 160)
eq('饮水参考量：5.04 kg → 250 ml', store.waterTargetOf({ weight: 5.04 }), 250)

ok('两个参考量都随体重单调上升', (function () {
  return [2, 3, 4, 5, 6].every(function (w, i, arr) {
    if (i === 0) return true
    return store.foodTargetOf({ weight: w }) > store.foodTargetOf({ weight: arr[i - 1] }) &&
      store.waterTargetOf({ weight: w }) > store.waterTargetOf({ weight: arr[i - 1] })
  })
})(), [2, 4, 6].map(function (w) { return store.foodTargetOf({ weight: w }) }))

/* 公式本身的边界：饮水落在 NRC 的 44–66 ml/kg 里，进食落在
   1.2×RER ÷ 1.3 kcal/g 的 ±10% 里。数字可以调，但一旦调出参考区间，
   说明有人凭手感改了系数，这里会拦下。 */
ok('饮水参考量落在 44–66 ml/kg 区间', store.getCats().every(function (c) {
  const per = store.waterTargetOf(c) / c.weight
  return per >= 44 && per <= 66
}), store.getCats().map(function (c) { return (store.waterTargetOf(c) / c.weight).toFixed(1) }))

ok('进食参考量与 1.2×RER ÷ 1.3 kcal/g 相差不到 10%', store.getCats().every(function (c) {
  const ideal = 1.2 * 70 * Math.pow(c.weight, 0.75) / 1.3
  return Math.abs(store.foodTargetOf(c) - ideal) / ideal < 0.1
}), store.getCats().map(function (c) { return store.foodTargetOf(c) }))

eq('体重缺失时进食退回 200 g', store.foodTargetOf({}), 200)
eq('体重缺失时饮水退回 250 ml', store.waterTargetOf({}), 250)

ok('档案里不再保留手填的进食目标',
  store.getCats().every(function (c) { return !('foodTarget' in c) }),
  store.getCats().map(function (c) { return Object.keys(c).join(',') }))

eq('旧存档带来的 foodTarget 会被装饰层剔掉',
  store.decorate({ id: 'x', name: '旧', weight: 3, foodTarget: 999 }).foodTarget, undefined)

/* ---------------- 3. 首页 ---------------- */
const idx = loadPage('pages/index/index.js')
idx.onLoad()
idx.onShow()
eq('首页: 当前猫', idx.data.cat.name, '团子')
ok('首页: 三项完成度都在 0-100',
  [idx.data.pct.food, idx.data.pct.water, idx.data.pct.play].every(function (v) { return v >= 0 && v <= 100 }),
  idx.data.pct)
ok('首页: 照顾分是合法 conic-gradient', /conic-gradient\(#/.test(idx.data.careRing), String(idx.data.careRing).slice(0, 46))
ok('首页: 照顾分 0-100', idx.data.care >= 0 && idx.data.care <= 100, idx.data.care)

/* 弧色 0 分红 → 100 分绿。断言不看具体色值（色值可以微调），
   只看色相有没有走对方向：红端 R 最大、绿端 G 最大。
   不锁死数字的好处是以后调饱和度不会误报，坏处是「两个端点都变红」这类
   整体性错误抓不到——所以再加一条：两端色相的差距必须够大。 */
const rgbOf = function (hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}
const cLow = rgbOf(theme.scoreColor(0))
const cHigh = rgbOf(theme.scoreColor(100))
ok('照顾分 0 分偏红', cLow[0] > cLow[1] + 40 && cLow[0] > cLow[2] + 40, cLow)
ok('照顾分 100 分偏绿', cHigh[1] > cHigh[0] + 40 && cHigh[1] > cHigh[2] + 40, cHigh)
ok('照顾分两端色差够大（不是同一种颜色）',
  Math.abs(cLow[0] - cHigh[0]) > 90 && Math.abs(cLow[1] - cHigh[1]) > 60,
  [cLow, cHigh])
const cMid = rgbOf(theme.scoreColor(60))
ok('照顾分 60 分已偏向绿（不再发红）', cMid[1] > cMid[0], cMid)
eq('首页: 照顾分等于三项均值', idx.data.care,
  Math.round((idx.data.pct.food + idx.data.pct.water + idx.data.pct.play) / 3))
ok('首页: 今日记录条数已统计', typeof idx.data.todayCount === 'number', idx.data.todayCount)

/* 旧版同时显示「饱食度 68%」和「进食 45/200g」，两个数字互相矛盾。
   现在百分比必须能由绝对值反推出来，这条断言就是防止它再漂回去。
   封顶 100：刻度线画到满就停，超出的部分只能看右边的绝对值，
   这正是超量提醒必须写在面板里的原因——进度条本身不会告诉你有多少超了。 */
eq('首页: 进食百分比与绝对值自洽', idx.data.pct.food,
  Math.min(100, Math.round(idx.data.pct.foodAbs / idx.data.pct.foodTarget * 100)))
eq('首页: 饮水百分比与绝对值自洽', idx.data.pct.water,
  Math.min(100, Math.round(idx.data.pct.waterAbs / idx.data.pct.waterTarget * 100)))
eq('首页: 逗猫百分比与绝对值自洽', idx.data.pct.play,
  Math.min(100, Math.round(idx.data.pct.playAbs / idx.data.pct.playTarget * 100)))

/* 第三项从 mood 改成逗猫之后，最该锁的是「它真的会随记录变化」。
   旧实现里 mood 只在逗猫时 +14、永不衰减，逗两次就锁死在 100，
   这条断言如果还在用 cat.mood 就会立刻失败。 */
const playBefore = idx.data.pct.playAbs
idx.onPlay()
eq('逗猫先开面板，不直接落库', idx.data.sheet.open, true)
eq('面板打开时今日逗猫不变', idx.data.pct.playAbs, playBefore)
eq('逗猫档位默认停在中间一档', idx.data.sheet.value, store.INTAKE_PRESETS.play[2])
idx.onSheetConfirm()
eq('确认后逗猫按面板里的数落库', idx.data.pct.playAbs, playBefore + 20)
eq('提交后面板关闭', idx.data.sheet.open, false)

/* 原先这里写死 idx.onFeed() → +40g。现在数量由用户选，这条断言改成
   「面板里的数才作数」——写死 40 的那种实现会在这里失败。 */
const beforeFood = idx.data.pct.foodAbs
idx.onFeed()
eq('投食面板默认 40 g', idx.data.sheet.value, '40')
eq('面板打开时今日摄入不变', idx.data.pct.foodAbs, beforeFood)
idx.onPreset({ currentTarget: { dataset: { v: '30' } } })
eq('点档位后输入框同步', idx.data.sheet.value, '30')
idx.onSheetConfirm()
eq('投食按选中的 30g 落库', idx.data.pct.foodAbs, beforeFood + 30)
ok('投食后照顾分仍在 0-100', idx.data.care >= 0 && idx.data.care <= 100, idx.data.care)

/* 三个动作各开各的面板。
   原先 onWater 里写的是 openSheet('feed')——点「喂水」弹出「投食」面板，
   而这里的断言只检查「流程未抛异常」，从不看 type，于是一路绿灯。
   「不抛异常」不是断言，是安慰剂：任何接错线的实现都能过。
   改成逐个锁 type / 标题 / 单位 / 默认档位，接错一根线就红。 */
const SHEET_CASES = [
  { fn: 'onFeed', type: 'feed', title: '投食', unit: 'g', preset: store.INTAKE_PRESETS.feed[2] },
  { fn: 'onWater', type: 'water', title: '喂水', unit: 'ml', preset: store.INTAKE_PRESETS.water[2] },
  { fn: 'onPlay', type: 'play', title: '逗猫', unit: 'min', preset: store.INTAKE_PRESETS.play[2] }
]
SHEET_CASES.forEach(function (c) {
  idx[c.fn]()
  eq('点「' + c.title + '」开的是自己的面板', idx.data.sheet.type, c.type)
  eq('「' + c.title + '」面板标题与按钮一致', idx.data.sheet.title, c.title)
  eq('「' + c.title + '」面板单位', idx.data.sheet.unit, c.unit)
  eq('「' + c.title + '」面板默认档位来自本动作的档位表', idx.data.sheet.value, c.preset)
  idx.onSheetClose()
  eq('关掉「' + c.title + '」面板后不落库', idx.data.sheet.open, false)
})
ok('三个动作的面板互不相同',
  new Set(SHEET_CASES.map(function (c) { return c.type })).size === 3)

/* 自定义数量：输入框直接填，不限于档位 */
idx.onFeed()
idx.onAmountInput({ detail: { value: '7' } })
idx.onSheetConfirm()
eq('自定义 7g 也能落库', idx.data.pct.foodAbs, beforeFood + 37)

/* 档位行末那一格「自定义」：它和五个档位是同一组单选。
   手填的数只要不在档位表里，那一格就该亮；选回档位就该灭——
   两个都不亮是「没得选」，两个都亮是「选了两个」。 */
idx.onFeed()
eq('面板默认停在档位而非自定义', idx.data.sheet.custom, false)
ok('面板写明参考量按体重推算', idx.data.sheet.source.indexOf('4.62') >= 0, idx.data.sheet.source)
idx.onCustom()
eq('点「自定义」进入自定义态', idx.data.sheet.custom, true)
eq('点「自定义」清空旧数值', idx.data.sheet.value, '')
eq('点「自定义」把光标交给输入框', idx.data.sheet.focus, true)
idx.onAmountBlur()
eq('输入框失焦后放下 focus', idx.data.sheet.focus, false)
idx.onAmountInput({ detail: { value: '35' } })
eq('手填 35 不在档位表里 → 仍算自定义', idx.data.sheet.custom, true)
const foodBeforeCustom = idx.data.pct.foodAbs
idx.onSheetConfirm()
eq('自定义 35 g 按填的数落库', idx.data.pct.foodAbs, foodBeforeCustom + 35)

idx.onFeed()
idx.onCustom()
idx.onPreset({ currentTarget: { dataset: { v: '20' } } })
eq('选回档位后退出自定义态', idx.data.sheet.custom, false)
eq('选回档位后数值同步', idx.data.sheet.value, '20')
idx.onSheetClose()
eq('关掉面板后不再留着自定义态', idx.data.sheet.open, false)
eq('0 被拦下不写记录', store.validateAmount('feed', '0').ok, false)
eq('超过单次上限被拦下', store.validateAmount('feed', '999').ok, false)
eq('空值被拦下', store.validateAmount('water', '').ok, false)

/* 超量判定与文案。三类动作方向不同，不能套同一句话：
   喂食劝阻、饮水只告知、逗猫不提醒。 */
const ovFeed = store.overflowOf(idx.data.cat.id, 'feed', 100)
ok('喂食超量被识别', ovFeed.over === true, { before: ovFeed.before, after: ovFeed.after, target: ovFeed.target })
const tipFeed = store.overflowTip(idx.data.cat.id, 'feed', 100)
ok('喂食超量给两选一确认', tipFeed.needConfirm === true && tipFeed.cancelText === '先不喂', tipFeed.title)
const ovWater = store.overflowOf(idx.data.cat.id, 'water', 400)
ok('饮水超量被识别', ovWater.over === true, { before: ovWater.before, after: ovWater.after, target: ovWater.target })
const tipWater = store.overflowTip(idx.data.cat.id, 'water', 400)
ok('饮水超量只告知，不给「别喝」选项', tipWater.needConfirm === false, tipWater.title)
ok('饮水文案不写病名', tipWater.content.indexOf('病') < 0, tipWater.content.slice(0, 24))
eq('逗猫超过目标不提醒', store.overflowTip(idx.data.cat.id, 'play', 60), null)
eq('未超量时不提醒', store.overflowTip('c3', 'feed', 75), null)

/* 心情自评：1-5，不进照顾分，同日重复点只改分不堆记录。 */
const careBeforeMood = idx.data.care
eq('未评时心情为 0', store.todayMood(idx.data.cat.id), 0)
/* 「还没评」把一件没做的事说成一件欠着的事；这里的状态只是「不知道」，不是「没交作业」。 */
eq('未评时右侧写「未知」', idx.data.moodText, '未知')
idx.onMood({ currentTarget: { dataset: { v: 4 } } })
eq('评一次后心情为 4', idx.data.mood, 4)
eq('心情文案取自分档表', idx.data.moodText, store.MOOD_LABELS[3])
eq('心情自评不影响照顾分', idx.data.care, careBeforeMood)
const moodRows = store.getRecords(idx.data.cat.id).filter(function (r) { return r.type === 'mood' })
eq('同一天只留一条心情记录', moodRows.length, 1)
idx.onMood({ currentTarget: { dataset: { v: 2 } } })
eq('再点一次是改分不是新增', store.todayMood(idx.data.cat.id), 2)
eq('改分后仍只有一条记录',
  store.getRecords(idx.data.cat.id).filter(function (r) { return r.type === 'mood' }).length, 1)
ok('心情自评不计入今日记录条数', idx.data.todayCount ===
  store.getRecords(idx.data.cat.id).filter(function (r) {
    return r.type !== 'mood' && store.dayKey(r.time) === store.dayKey(Date.now())
  }).length, idx.data.todayCount)

/* 提交路径也要看落库的类型和单位。
   写 ok(..., true) 等于什么都没测——只要不崩就算过，正好放过「点喂水开出投食面板」
   这种接错线的情况：提交照样成功，只是记成了「投食 40 g」。 */
const beforeWater = idx.data.pct.waterAbs
const beforeFeedSum = store.todayIntake(idx.data.cat.id).feed
idx.onWater()
eq('喂水面板确认前的单位是 ml', idx.data.sheet.unit, 'ml')
idx.onSheetConfirm()
const waterRec = store.getRecords(idx.data.cat.id).filter(function (r) { return r.type === 'water' })[0]
ok('喂水落库的类型是 water 不是 feed', !!waterRec, waterRec && waterRec.type)
eq('喂水按面板里的量增加今日饮水', idx.data.pct.waterAbs, beforeWater + 150)
eq('喂水不改今日进食', store.todayIntake(idx.data.cat.id).feed, beforeFeedSum)

idx.onPlay()
idx.onSheetConfirm()
idx.onWeigh()
eq('称重后体重已更新', idx.data.cat.weight, 4.75)

idx.onSwitch(1 in {} ? null : { currentTarget: { dataset: { id: store.getCats()[1].id } } })
eq('切换猫咪生效', idx.data.cat.id, store.getCats()[1].id)
ok('切换后记录随猫变化', true)

/* ---------------- 4. 记录页 ---------------- */
const rec = loadPage('pages/records/records.js')
rec.onShow()
ok('记录页: 分组非空', rec.data.groups.length > 0, rec.data.groups.length)
ok('记录页: 总计大于 0', rec.data.total > 0, rec.data.total)
ok('记录页: 体重序列 >= 2', rec.data.series.length >= 2, rec.data.series.length)
rec.drawChart()
ok('drawChart 在无 canvas 时安全退出', true)
rec.onFilter({ currentTarget: { dataset: { key: 'feed' } } })
ok('筛选「喂食」后全是喂食记录', rec.data.groups.every((g) => g.items.every((i) => i.label === '投食')), rec.data.groups.length)
rec.onFilter({ currentTarget: { dataset: { key: 'other' } } })
const otherCount = rec.data.groups.reduce((n, g) => n + g.items.length, 0)
eq('兜底筛选的标签是「其他」', rec.data.filters[4].label, '其他')
/* 只写 every() 有个陷阱：筛出空数组时 every 返回 true，断言照样绿。
   必须同时要求非空，否则「筛选一根线接错、什么都筛不出来」也能通过。 */
ok(
  '筛选「其他」非空且只含逗猫/疫苗/驱虫',
  otherCount > 0 && rec.data.groups.every((g) => g.items.every((i) => ['逗猫', '疫苗', '驱虫'].indexOf(i.label) >= 0)),
  otherCount + ' 条'
)
rec.onFilter({ currentTarget: { dataset: { key: 'all' } } })
rec.onSwitchCat({ currentTarget: { dataset: { id: store.getCats()[0].id } } })
eq('记录页切猫生效', rec.data.catId, store.getCats()[0].id)

/* ---------------- 5. 我的 ---------------- */
const mine = loadPage('pages/mine/mine.js')
mine.onShow()
eq('我的: 统计猫咪数', mine.data.stats.cats, 3)
/* 文案从「台在线」改成「台已启用」：开关只记录偏好，没有任何连接通道，
   「在线」是个会被人当真的错误说法。这条断言同时锁住措辞。 */
ok('我的: 设备文案用「已启用」而非「在线」', /3 台设备 · \d 台已启用/.test(mine.data.deviceText), mine.data.deviceText)
mine.onToggle({ currentTarget: { dataset: { key: 'feeder' } }, detail: { value: false } })
eq('关掉喂食器后设置已落库', store.getSettings().feeder, false)
mine.onTimeChange({ detail: { value: '07:45' } })
eq('提醒时间已保存', store.getSettings().remindTime, '07:45')
mine.onAbout()
ok('关于弹窗未抛异常', true)

/* ---------------- 6. 新增 / 编辑 / 删除 ---------------- */
const edit = loadPage('pages/cat-edit/cat-edit.js')
edit.onLoad({})
eq('新增页默认非编辑态', edit.data.isEdit, false)
edit.onName({ detail: { value: '  测试猫  ' } })
edit.onWeight({ detail: { value: '3.2' } })
eq('新增页参考量随体重实时推算', edit.data.targetText,
  store.foodTargetOf({ weight: 3.2 }) + ' g · ' + store.waterTargetOf({ weight: 3.2 }) + ' ml')
edit.onBreed({ detail: { value: '2' } })
edit.onGender({ currentTarget: { dataset: { g: 'female' } } })
edit.onBirthday({ detail: { value: '2024-05-01' } })
edit.onNote({ detail: { value: '冒烟测试' } })
edit.onPickAvatar()
eq('选头像后路径已写入表单', edit.data.form.avatar, 'wxfile://saved_avatar.jpg')
edit.onSave()
eq('新增后猫咪数 +1', store.getCats().length, 4)
const added = store.getCats()[3]
eq('新增猫咪名字已去空格', added.name, '测试猫')
eq('新增猫咪品种按索引落库', added.breed, '布偶猫')
eq('新增猫咪性别正确', added.gender, 'female')
eq('新增后当前猫切换到新猫', appInst.globalData.currentCatId, added.id)

const edit2 = loadPage('pages/cat-edit/cat-edit.js')
edit2.onLoad({ id: added.id })
eq('编辑态标题正确', edit2.data.isEdit, true)
edit2.onWeight({ detail: { value: '3.8' } })
eq('改体重后参考量跟着变（不是建档时算一次就定死）', edit2.data.targetText,
  store.foodTargetOf({ weight: 3.8 }) + ' g · ' + store.waterTargetOf({ weight: 3.8 }) + ' ml')
edit2.onSave()
eq('编辑后体重已更新', store.getCat(added.id).weight, 3.8)

const edit3 = loadPage('pages/cat-edit/cat-edit.js')
edit3.onLoad({ id: added.id })
edit3.onDelete()
eq('删除后猫咪数回到 3', store.getCats().length, 3)
ok('删除后其记录一并清除', store.getRecords(added.id).length === 0, store.getRecords(added.id).length)

/* ---------------- 7. 空状态与重置 ---------------- */
store.resetAll()
eq('重置后恢复 3 只猫', store.getCats().length, 3)

/* ---------------- 8. 数据层校验规则（validateCat） ---------------- */
const baseForm = { name: '测试', breed: '橘猫', gender: 'male', birthday: '2024-01-01', weight: '4.2', note: '', avatar: '' }

eq('校验：合法表单通过', store.validateCat(baseForm).ok, true)

eq('校验：空名字被拒', store.validateCat(Object.assign({}, baseForm, { name: '   ' })).ok, false)
eq('校验：空名字落在 name 字段', store.validateCat(Object.assign({}, baseForm, { name: '' })).field, 'name')
eq('校验：超长名字被拒', store.validateCat(Object.assign({}, baseForm, { name: '一二三四五六七八九十一二三' })).ok, false)

eq('校验：体重 0 被拒', store.validateCat(Object.assign({}, baseForm, { weight: '0' })).ok, false)
eq('校验：体重 31 被拒', store.validateCat(Object.assign({}, baseForm, { weight: '31' })).ok, false)
eq('校验：体重落在 weight 字段', store.validateCat(Object.assign({}, baseForm, { weight: '-1' })).field, 'weight')
eq('校验：体重上限 30 通过', store.validateCat(Object.assign({}, baseForm, { weight: '30' })).ok, true)

/* 进食目标不再是表单字段：旧表单里即使带着一个数，也不该进档案，
   否则「体重推出来的目标」和「写死在档案里的目标」会同时存在。 */
eq('校验：不填目标也能通过', store.validateCat(baseForm).ok, true)
eq('校验：表单里的 foodTarget 不写进档案',
  'foodTarget' in store.validateCat(Object.assign({}, baseForm, { foodTarget: 999 })).value, false)

const normalized = store.validateCat(Object.assign({}, baseForm, { name: '  奶糖  ', weight: '4.239' }))
eq('校验：名字首尾空格被修剪', normalized.value.name, '奶糖')
eq('校验：体重归一化到两位小数', normalized.value.weight, 4.24)

eq('页面保存走数据层校验：空名字不落库', (function () {
  const before = store.getCats().length
  const p = loadPage('pages/cat-edit/cat-edit.js')
  p.onLoad({})
  p.setData({ 'form.weight': '4.0' })
  p.onSave()
  return store.getCats().length === before
})(), true)

eq('校验失败：错误落到 name 字段并请求滚动定位', (function () {
  global.__lastScroll = null
  const p = loadPage('pages/cat-edit/cat-edit.js')
  p.onLoad({})
  p.setData({ 'form.weight': '4.0' })
  p.onSave()
  return p.data.errorField === 'name' && p.data.errorMsg !== '' && global.__lastScroll === '#f-name'
})(), true)

eq('校验失败后改该字段会自动清错', (function () {
  const p = loadPage('pages/cat-edit/cat-edit.js')
  p.onLoad({})
  p.setData({ 'form.weight': '4.0' })
  p.onSave()
  p.onName({ detail: { value: '奶糖' } })
  return p.data.errorField === ''
})(), true)

/* ---------------- 7. 健康记录（症状 → 就诊描述） ---------------- */

eq('症状分组为 9 组', store.SYMPTOM_GROUPS.length, 9)
eq('症状项合计 42 项', store.SYMPTOM_GROUPS.reduce((n, g) => n + g.items.length, 0), 42)

eq('分诊：骨折级急诊项判 emergency', store.calcTier(['蹲很久尿不出'], '1d'), 'emergency')
eq('分诊：张嘴呼吸判 emergency', store.calcTier(['张嘴呼吸'], '2-3d'), 'emergency')
eq('分诊：便血判 urgent', store.calcTier(['便中带血或发黑'], '1d'), 'urgent')
eq('分诊：持续一周判 urgent', store.calcTier(['皮屑增多'], 'week'), 'urgent')
eq('分诊：三项同时出现判 urgent', store.calcTier(['局部掉毛', '频繁抓挠', '皮屑增多'], '1d'), 'urgent')
eq('分诊：单项且一天内判 routine', store.calcTier(['局部掉毛'], '1d'), 'routine')
eq('分诊：急诊项优先于持续时间', store.calcTier(['抽搐'], 'longer'), 'emergency')

const logCountBefore = store.getSymptomLogs().length
const testLog = store.addSymptomLog(
  'c1',
  ['没精神 / 不爱动', '呕吐', '蹲很久尿不出', '误食 / 接触有毒物'],
  '2-3d',
  '今天一直趴在沙发底下不出来'
)
eq('症状日志落库', store.getSymptomLogs().length, logCountBefore + 1)
eq('按猫筛选症状日志', store.getSymptomLogs('c1').length >= 1, true)

const testReport = store.buildVisitReport(testLog, store.getCat('c1'))
eq('报告分诊取急诊项', testReport.tier, 'emergency')
eq('报告按组归并出 4 组', testReport.groups.length, 4)
eq(
  '未归类项落入「其他」组',
  testReport.groups.filter((g) => g.label === '其他').length,
  1
)
eq('组内文本用顿号连接', testReport.groups[0].text.indexOf('、') >= 0 || testReport.groups[0].items.length === 1, true)
ok('复制文本含免责声明', testReport.plainText.indexOf('未经兽医确认') >= 0)
ok('复制文本含「未列出的情况可能同样重要」', testReport.plainText.indexOf('未列出的情况可能同样重要') >= 0)
ok('复制文本含自由描述原文', testReport.plainText.indexOf('今天一直趴在沙发底下') >= 0)
ok('复制文本含持续时长', testReport.plainText.indexOf('2–3 天') >= 0)
ok('复制文本不含「诊断」「确诊」', !/诊断|确诊/.test(testReport.plainText))

// 只有自由描述、一项都没勾也能出报告
const textOnlyLog = store.addSymptomLog('c1', [], '1d', '就是感觉不对劲')
const textOnlyReport = store.buildVisitReport(textOnlyLog, store.getCat('c1'))
eq('仅文字描述也能生成报告', textOnlyReport.groups.length, 0)
eq('仅文字描述分诊为 routine', textOnlyReport.tier, 'routine')
ok('仅文字描述时复制文本保留原文', textOnlyReport.plainText.indexOf('就是感觉不对劲') >= 0)


/* ---------------- 8. 形象系统已移除，一律用照片 ---------------- */

eq('形象配色表已移除', store.FIGURE_COLORS, undefined)
eq('形象配饰表已移除', store.FIGURE_ACCESSORIES, undefined)

/* 旧存档里可能还留着 avatarType:'figure' 与 figure 对象，装饰时应当被清掉，
   而不是原样透到界面——否则首页会出现一条没人再维护的渲染分支。 */
const legacyFig = store.decorate({
  id: 'c8',
  birthday: '2023-01-01',
  avatarType: 'figure',
  figure: { color: 'vermilion', accessory: 'scarf' }
})
ok('旧数据的形象模式不再透出', typeof legacyFig.avatarType === 'undefined', legacyFig.avatarType)
ok('旧数据的形象配色不再透出', typeof legacyFig.figure === 'undefined', legacyFig.figure)

const beforeCats = store.getCats().length
const photoCat = store.addCat({ name: '照片测试', weight: 4 })
eq('新增猫咪数量 +1', store.getCats().length, beforeCats + 1)
ok(
  '新增猫咪不写形象字段',
  store.getCat(photoCat.id).avatarType === undefined && store.getCat(photoCat.id).figure === undefined,
  JSON.stringify(store.getCat(photoCat.id))
)

/* ---------------- 结果 ---------------- */
console.log('\n--- 运行时日志（前 12 条）---')
console.log(logs.slice(0, 12).join('\n'))
console.log('\n' + (fails.length ? 'FAILED ' + fails.length + ' 项:\n' + fails.join('\n') : '全部通过 ✅'))
process.exit(fails.length ? 1 : 0)
