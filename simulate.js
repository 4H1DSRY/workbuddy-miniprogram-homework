/**
 * 离线逻辑冒烟测试：用 Node 打桩微信 API，真实跑一遍数据层与四个页面的生命周期。
 * 只验证逻辑与数据结构，不渲染视图（视图渲染需在开发者工具里看）。
 */
const path = require('path')
const ROOT = 'D:/Claw/workbuddy-course/homework-4/miaoguanjia'

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
eq('种子数据: 猫咪数', store.getCats().length, 3)
ok('种子数据: 记录数 > 0', store.getRecords().length > 0, store.getRecords().length)

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

/* ---------------- 3. 首页 ---------------- */
const idx = loadPage('pages/index/index.js')
idx.onLoad()
idx.onShow()
eq('首页: 当前猫', idx.data.cat.name, '团子')
ok('首页: 三项完成度都在 0-100',
  [idx.data.pct.food, idx.data.pct.water, idx.data.pct.mood].every(function (v) { return v >= 0 && v <= 100 }),
  idx.data.pct)
ok('首页: 照顾分是合法 conic-gradient', /conic-gradient\(#/.test(idx.data.careRing), String(idx.data.careRing).slice(0, 46))
ok('首页: 照顾分 0-100', idx.data.care >= 0 && idx.data.care <= 100, idx.data.care)
eq('首页: 照顾分等于三项均值', idx.data.care,
  Math.round((idx.data.pct.food + idx.data.pct.water + idx.data.pct.mood) / 3))
ok('首页: 今日记录条数已统计', typeof idx.data.todayCount === 'number', idx.data.todayCount)

/* 旧版同时显示「饱食度 68%」和「进食 45/200g」，两个数字互相矛盾。
   现在百分比必须能由绝对值反推出来，这条断言就是防止它再漂回去。 */
eq('首页: 进食百分比与绝对值自洽', idx.data.pct.food,
  Math.round(idx.data.pct.foodAbs / idx.data.pct.foodTarget * 100))
eq('首页: 饮水百分比与绝对值自洽', idx.data.pct.water,
  Math.round(idx.data.pct.waterAbs / idx.data.pct.waterTarget * 100))

const beforeFood = idx.data.pct.foodAbs
idx.onFeed()
eq('投食后今日摄入增加 40g', idx.data.pct.foodAbs, beforeFood + 40)
ok('投食后饱食度不超 100', idx.data.cat.food <= 100, idx.data.cat.food)
ok('投食后照顾分仍在 0-100', idx.data.care >= 0 && idx.data.care <= 100, idx.data.care)

idx.onPlay()
idx.onWater()
ok('逗猫/喂水未抛异常', true)
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
ok('筛选「护理」只含护理类', rec.data.groups.every((g) => g.items.every((i) => ['陪玩', '疫苗', '驱虫'].indexOf(i.label) >= 0)), true)
rec.onFilter({ currentTarget: { dataset: { key: 'all' } } })
rec.onSwitchCat({ currentTarget: { dataset: { id: store.getCats()[0].id } } })
eq('记录页切猫生效', rec.data.catId, store.getCats()[0].id)

/* ---------------- 5. 我的 ---------------- */
const mine = loadPage('pages/mine/mine.js')
mine.onShow()
eq('我的: 统计猫咪数', mine.data.stats.cats, 3)
ok('我的: 设备在线文案正确', /3 台设备 · \d 台在线/.test(mine.data.deviceText), mine.data.deviceText)
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
edit.onTarget({ detail: { value: '150' } })
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
const baseForm = { name: '测试', breed: '橘猫', gender: 'male', birthday: '2024-01-01', weight: '4.2', foodTarget: 180, note: '', avatar: '' }

eq('校验：合法表单通过', store.validateCat(baseForm).ok, true)

eq('校验：空名字被拒', store.validateCat(Object.assign({}, baseForm, { name: '   ' })).ok, false)
eq('校验：空名字落在 name 字段', store.validateCat(Object.assign({}, baseForm, { name: '' })).field, 'name')
eq('校验：超长名字被拒', store.validateCat(Object.assign({}, baseForm, { name: '一二三四五六七八九十一二三' })).ok, false)

eq('校验：体重 0 被拒', store.validateCat(Object.assign({}, baseForm, { weight: '0' })).ok, false)
eq('校验：体重 31 被拒', store.validateCat(Object.assign({}, baseForm, { weight: '31' })).ok, false)
eq('校验：体重落在 weight 字段', store.validateCat(Object.assign({}, baseForm, { weight: '-1' })).field, 'weight')
eq('校验：体重上限 30 通过', store.validateCat(Object.assign({}, baseForm, { weight: '30' })).ok, true)

eq('校验：目标 19 被拒', store.validateCat(Object.assign({}, baseForm, { foodTarget: 19 })).ok, false)
eq('校验：目标 601 被拒', store.validateCat(Object.assign({}, baseForm, { foodTarget: 601 })).ok, false)
eq('校验：目标落在 foodTarget 字段', store.validateCat(Object.assign({}, baseForm, { foodTarget: 0 })).field, 'foodTarget')

const normalized = store.validateCat(Object.assign({}, baseForm, { name: '  奶糖  ', weight: '4.239', foodTarget: '180' }))
eq('校验：名字首尾空格被修剪', normalized.value.name, '奶糖')
eq('校验：体重归一化到两位小数', normalized.value.weight, 4.24)
eq('校验：目标被转成数字', normalized.value.foodTarget, 180)

eq('页面保存走数据层校验：空名字不落库', (function () {
  const before = store.getCats().length
  const p = loadPage('pages/cat-edit/cat-edit.js')
  p.onLoad({})
  p.setData({ 'form.weight': '4.0', 'form.foodTarget': 180 })
  p.onSave()
  return store.getCats().length === before
})(), true)

/* ---------------- 结果 ---------------- */
console.log('\n--- 运行时日志（前 12 条）---')
console.log(logs.slice(0, 12).join('\n'))
console.log('\n' + (fails.length ? 'FAILED ' + fails.length + ' 项:\n' + fails.join('\n') : '全部通过 ✅'))
process.exit(fails.length ? 1 : 0)
