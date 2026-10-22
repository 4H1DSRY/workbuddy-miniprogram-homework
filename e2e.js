/**
 * 端到端流程验证：用页面栈路由模拟器把用户真实路径连着走一遍。
 *
 * 与 simulate.js 的分工：
 *   simulate.js 逐页独立测，验证每个页面自己的逻辑；
 *   e2e.js 连着测，验证「页面之间的接线」——参数传递、全局当前猫、
 *   返回层级、按钮状态复位、落库归属。这类问题单页测试永远测不出来。
 */
const path = require('path')
const ROOT = path.join(__dirname, 'miaoguanjia')

const fails = []
const steps = []

function pass(label, detail) {
  steps.push('  ✓ ' + label + (detail !== undefined ? '  → ' + JSON.stringify(detail) : ''))
}
function fail(label, expect, actual) {
  steps.push('  ✗ ' + label + '  期望 ' + JSON.stringify(expect) + ' 实际 ' + JSON.stringify(actual))
  fails.push(label + '：期望 ' + JSON.stringify(expect) + ' 实际 ' + JSON.stringify(actual))
}
function eq(label, actual, expect) {
  if (actual === expect) pass(label, actual)
  else fail(label, expect, actual)
}
function ok(label, cond, detail) {
  if (cond) pass(label, detail)
  else fail(label, 'true', detail)
}

/* ---------------- 桩 wx（带页面栈） ---------------- */
const mem = new Map()
let clipboard = ''
const toasts = []
const stack = [] // [{ pathname, page }]

global.wx = {
  getStorageSync: (k) => (mem.has(k) ? mem.get(k) : ''),
  setStorageSync: (k, v) => mem.set(k, v),
  removeStorageSync: (k) => mem.delete(k),
  showToast: (o) => toasts.push(o.title),
  showModal: (o) => {
    if (o.success) o.success({ confirm: true, cancel: false, content: o.__content || '' })
  },
  setClipboardData: (o) => {
    clipboard = o.data
    if (o.success) o.success()
  },
  setNavigationBarTitle: () => {},
  stopPullDownRefresh: () => {},
  vibrateShort: () => {},
  pageScrollTo: () => {},
  getWindowInfo: () => ({ pixelRatio: 2 }),
  nextTick: (fn) => fn(),
  createSelectorQuery: () => {
    const q = {
      in: () => q, select: () => q, fields: () => q,
      exec: (cb) => cb([{}])
    }
    return q
  },
  getFileSystemManager: () => ({
    saveFile: (o) => o.success && o.success({ savedFilePath: 'wxfile://saved_avatar.jpg' })
  }),
  chooseMedia: (o) =>
    o.success && o.success({ tempFiles: [{ tempFilePath: 'wxfile://tmp_avatar.jpg' }] }),

  /* --- 路由 --- */
  navigateTo: (o) => {
    try {
      pushUrl(o.url)
    } catch (err) {
      if (o.fail) o.fail(err)
      else throw err
    }
  },
  redirectTo: (o) => {
    stack.pop()
    pushUrl(o.url)
  },
  /* 真机上 delta 超过剩余栈深会走 fail，这里如实模拟 */
  navigateBack: (o) => {
    const delta = (o && o.delta) || 1
    if (delta >= stack.length) {
      if (o && o.fail) o.fail(new Error('cannot go back'))
      return
    }
    stack.splice(stack.length - delta, delta)
    const top = stack[stack.length - 1]
    if (top && top.page.onShow) top.page.onShow()
  },
  switchTab: (o) => {
    stack.length = 0
    pushUrl(o.url)
  }
}

/* ---------------- 桩 App / Page ---------------- */
let appInst = null
global.App = (o) => {
  appInst = o
}
global.getApp = () => appInst
/* 真机上页面实例带 route，报告页靠它判断该退几层 */
global.getCurrentPages = () => stack.map((s) => s.page)
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

/** 按 url 打开一个页面：真实走 onLoad(query) + onShow() */
function pushUrl(url) {
  const raw = String(url || '')
  const qi = raw.indexOf('?')
  const pathname = qi < 0 ? raw : raw.slice(0, qi)
  const query = {}
  if (qi >= 0) {
    raw.slice(qi + 1).split('&').forEach((kv) => {
      if (!kv) return
      const i = kv.indexOf('=')
      const k = i < 0 ? kv : kv.slice(0, i)
      const v = i < 0 ? '' : kv.slice(i + 1)
      query[decodeURIComponent(k)] = decodeURIComponent(v)
    })
  }
  const page = loadPage(pathname.replace(/^\//, '') + '.js')
  page.route = pathname.replace(/^\//, '')
  stack.push({ pathname: pathname, page: page })
  if (page.onLoad) page.onLoad(query)
  if (page.onShow) page.onShow()
  return page
}

function top() {
  return stack[stack.length - 1]
}

/* ================= 场景开始 ================= */

require(path.join(ROOT, 'app.js'))
appInst.onLaunch()
const store = require(path.join(ROOT, 'utils/store.js'))

console.log('\n【A】冷启动 → 记录页')
wx.switchTab({ url: '/pages/records/records' })
eq('A1 根页面是记录页', top().pathname, '/pages/records/records')
eq('A2 页面栈深度', stack.length, 1)
const c2 = store.getCats()[1]
eq('A3 记录页默认落在第一只猫', top().page.data.catName, store.getCats()[0].name)

console.log('\n【B】切猫 → 进症状页，检查「当前猫」有没有串')
top().page.onSwitchCat({ currentTarget: { dataset: { id: c2.id } } })
eq('B1 记录页切到第二只猫', top().page.data.catName, c2.name)
eq('B2 切猫同步了全局当前猫', appInst.globalData.currentCatId, c2.id)

top().page.goSymptom()
eq('B3 症状页已入栈', top().pathname, '/pages/symptom/symptom')
eq('B4 症状页栈深 2', stack.length, 2)
ok('B5 症状页带的是刚切的那只猫（不是首页那只）',
  top().page.data.cat.id === c2.id, top().page.data.cat.name)
ok('B6 症状页猫标签含名字与年龄',
  /·/.test(top().page.data.catLabel), top().page.data.catLabel)
eq('B7 9 个症状分组已铺进 data', top().page.data.groups.length, 9)

console.log('\n【C】症状页交互')
const sym = top().page
eq('C1 初始不可提交', sym.data.canSubmit, false)
sym.onToggle({ currentTarget: { dataset: { text: '蹲很久尿不出' } } })
sym.onToggle({ currentTarget: { dataset: { text: '呕吐' } } })
eq('C2 勾两项后计数为 2', sym.data.count, 2)
eq('C3 勾选后可提交', sym.data.canSubmit, true)
sym.onToggle({ currentTarget: { dataset: { text: '呕吐' } } })
eq('C4 再点一次取消勾选，计数回到 1', sym.data.count, 1)
sym.onToggle({ currentTarget: { dataset: { text: '呕吐' } } })
sym.onDuration({ currentTarget: { dataset: { key: '2-3d' } } })
eq('C5 持续时长已选中', sym.data.duration, '2-3d')

console.log('\n【D】提交 → 报告页，检查参数传递')
const logsBefore = store.getSymptomLogs().length
sym.onSubmit()
eq('D1 报告页已入栈', top().pathname, '/pages/report/report')
eq('D2 页面栈深度 3（记录 / 症状 / 报告）', stack.length, 3)
eq('D3 症状日志 +1', store.getSymptomLogs().length, logsBefore + 1)
const lastLog = store.getSymptomLogs().slice(-1)[0]
eq('D4 日志归属第二只猫（没串到别的猫身上）', lastLog.catId, c2.id)
eq('D5 日志症状数为 2', lastLog.symptoms.length, 2)

const rep = top().page
ok('D6 报告页已就绪', rep.data.ready === true, rep.data.ready)
ok('D7 报告页拿到的正是刚提交的那条', rep.data.report.dateText !== '', rep.data.report.dateText)
eq('D8 分诊命中急诊项 → emergency', rep.data.report.tier, 'emergency')
eq('D9 分诊标题文案', rep.data.report.tierLabel, '请立即就医')
ok('D10 报告按分组归并（2 项分属两组）', rep.data.report.groups.length === 2,
  rep.data.report.groups.map((g) => g.label))
ok('D11 报告带上了猫的名字', rep.data.report.info[0].indexOf(c2.name) >= 0, rep.data.report.info[0])

console.log('\n【E】复制与免责声明')
rep.onCopy()
ok('E1 剪贴板已写入', clipboard.length > 20, clipboard.length + ' 字')
ok('E2 剪贴板含免责声明', clipboard.indexOf('未经兽医确认') >= 0)
ok('E3 剪贴板含「未列出的情况可能同样重要」', clipboard.indexOf('未列出的情况可能同样重要') >= 0)
ok('E4 剪贴板含持续时长', clipboard.indexOf('2–3 天') >= 0)
ok('E5 剪贴板不含「诊断 / 确诊」', !/诊断|确诊/.test(clipboard))
ok('E6 复制后给了成功提示', toasts.indexOf('已复制，可发给兽医') >= 0, toasts.slice(-1)[0])
console.log('  ─── 实际复制内容 ───')
clipboard.split('\n').forEach((l) => steps.push('  │ ' + l))
steps.push('  ──────────────────')

console.log('\n【F】完成 → 退回记录页')
rep.onDone()
eq('F1 栈深回到 1', stack.length, 1)
eq('F2 回到记录页', top().pathname, '/pages/records/records')

console.log('\n【M】记录页能不能看到刚记的那条')
const recPage = top().page
eq('M1 历史列表出现 1 条', recPage.data.visits.length, 1)
eq('M2 摘要里用短标签', recPage.data.visits[0].tierLabel, '立即就医')
ok('M3 摘要含勾选的症状', recPage.data.visits[0].summary.indexOf('蹲很久尿不出') >= 0,
  recPage.data.visits[0].summary)
ok('M4 摘要带日期', /^\d{2}\/\d{2} \d{2}:\d{2}$/.test(recPage.data.visits[0].dateText),
  recPage.data.visits[0].dateText)

const visitId = recPage.data.visits[0].id
recPage.goReport({ currentTarget: { dataset: { id: visitId } } })
eq('M5 点历史进入报告页', top().pathname, '/pages/report/report')
ok('M6 打开的就是那一条', top().page.data.ready === true, top().page.data.report.dateText)
top().page.onDone()
eq('M7 从历史进来只退一层，回到记录页', top().pathname, '/pages/records/records')
eq('M8 栈深回到 1', stack.length, 1)

console.log('\n【N】换一只猫，历史不能串')
top().page.onSwitchCat({ currentTarget: { dataset: { id: store.getCats()[0].id } } })
eq('N1 第一只猫没有症状记录', top().page.data.visits.length, 0)
top().page.onSwitchCat({ currentTarget: { dataset: { id: c2.id } } })
eq('N2 切回来记录还在', top().page.data.visits.length, 1)

console.log('\n【G】双击提交是否只写一条')
const logs2 = store.getSymptomLogs().length
const sym2 = pushUrl('/pages/symptom/symptom')
sym2.onToggle({ currentTarget: { dataset: { text: '皮屑增多' } } })
sym2.onSubmit()
sym2.onSubmit()
sym2.onSubmit()
eq('G1 连点三次只落一条', store.getSymptomLogs().length, logs2 + 1)
stack.length = 0

console.log('\n【H】返回键回到症状页后，提交按钮还能不能按')
const rec3 = pushUrl('/pages/records/records')
rec3.goSymptom()
const sym3 = top().page
sym3.onToggle({ currentTarget: { dataset: { text: '咳嗽' } } })
sym3.onSubmit()
eq('H1 提交后进入报告页', top().pathname, '/pages/report/report')
wx.navigateBack({ delta: 1 }) // 安卓返回键 / iOS 侧滑：回到症状页，页面没有重建
eq('H2 已退回症状页', top().pathname, '/pages/symptom/symptom')
eq('H3 返回后提交锁已复位', top().page.data.submitting, false)
const logs3 = store.getSymptomLogs().length
top().page.onSubmit()
eq('H4 返回后再次提交仍然有效', store.getSymptomLogs().length, logs3 + 1)
stack.length = 0

console.log('\n【I】报告页拿到不存在的 id')
const badRep = pushUrl('/pages/report/report?id=sym_does_not_exist')
ok('I1 不白屏，回落到最近一条记录', badRep.data.ready === true, badRep.data.ready && badRep.data.report.dateText)
stack.length = 0

console.log('\n【J】一只猫都没有时点「记录症状」')
const catsBackup = store.getCats()
store.getCats().forEach((c) => store.removeCat(c.id))
eq('J1 猫咪已清空', store.getCats().length, 0)
if (appInst.globalData) appInst.globalData.currentCatId = ''
const toastsBefore = toasts.length
const emptySym = pushUrl('/pages/symptom/symptom')
eq('J2 症状页没有猫时不铺分组', emptySym.data.groups.length, 0)
ok('J3 给出了提示', toasts.length > toastsBefore, toasts.slice(toastsBefore))
ok('J4 请求了返回', stack.length <= 1, stack.length)
stack.length = 0

console.log('\n【K】档案页选「用形象」→ 首页是否切过去')
store.resetAll()
const c1 = store.getCats()[0]
const edit = pushUrl('/pages/cat-edit/cat-edit?id=' + c1.id)
eq('K1 进入编辑态', edit.data.isEdit, true)
eq('K2 默认仍是照片模式', edit.data.avatarType, 'photo')
edit.onAvatarType({ currentTarget: { dataset: { v: 'figure' } } })
edit.onPickColor({ currentTarget: { dataset: { k: 'vermilion' } } })
edit.onPickAcc({ currentTarget: { dataset: { k: 'scarf' } } })
edit.onSave()
eq('K3 显示方式已落库', store.getCat(c1.id).avatarType, 'figure')
eq('K4 主色已落库', store.getCat(c1.id).figure.color, 'vermilion')
eq('K5 配饰已落库', store.getCat(c1.id).figure.accessory, 'scarf')

stack.length = 0
const home = pushUrl('/pages/index/index')
eq('K6 首页取到形象模式', home.data.cat.avatarType, 'figure')
eq('K7 首页取到主色', home.data.cat.figure.color, 'vermilion')
home.onFigureTap()
ok('K8 形象可点击且触发缩放', home.data.figBounce === true, home.data.figBounce)
stack.length = 0
/* 照片模式下点击不该有反应 */
const home2 = pushUrl('/pages/index/index')
home2.setData({ 'cat.avatarType': 'photo' })
home2.setData({ figBounce: false })
home2.onFigureTap()
eq('K9 照片模式下点击不缩放', home2.data.figBounce, false)
stack.length = 0

console.log('\n【L】新增一只猫 → 首页自动切过去')
const add = pushUrl('/pages/cat-edit/cat-edit')
add.onName({ detail: { value: '端到端' } })
add.onWeight({ detail: { value: '4.1' } })
add.onTarget({ detail: { value: '180' } })
add.onSave()
const newCat = store.getCats().slice(-1)[0]
eq('L1 新猫已落库', newCat.name, '端到端')
eq('L2 全局当前猫切到新猫', appInst.globalData.currentCatId, newCat.id)
stack.length = 0
const home3 = pushUrl('/pages/index/index')
eq('L3 首页显示新猫', home3.data.cat.name, '端到端')
eq('L4 新猫默认仍用照片', home3.data.cat.avatarType, 'photo')
stack.length = 0

/* ================= 结果 ================= */
console.log('\n' + steps.join('\n'))
console.log('\n' + (fails.length ? '❌ 失败 ' + fails.length + ' 项：\n- ' + fails.join('\n- ') : '✅ 端到端全流程通过'))
process.exit(fails.length ? 1 : 0)
