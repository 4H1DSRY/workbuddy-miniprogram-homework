/**
 * 喵管家 - 本地数据层
 * 全部数据落在 wx.setStorageSync，无任何网络请求，保证 Console 干净。
 */
const theme = require('./theme.js')

const CATS_KEY = 'mgj_cats'
const RECORDS_KEY = 'mgj_records'
const SYMPTOM_KEY = 'mgj_symptoms'
const SETTINGS_KEY = 'mgj_settings'
const SEED_KEY = 'mgj_seeded'
/* 种子数据版本：改种子内容后 +1，旧缓存才会被覆盖 */
const SEED_VERSION = 3

const DEFAULT_SETTINGS = {
  feedRemind: true,
  vaccineRemind: true,
  remindTime: '08:30',
  feeder: true,
  fountain: true,
  deviceName: '喵管家 Pro · 客厅',
  camera: true
}

function pad(n) {
  n = Number(n) || 0
  return n < 10 ? '0' + n : '' + n
}

function dayKey(ts) {
  const d = new Date(ts)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function parseBirthday(str) {
  if (!str) return new Date()
  return new Date(String(str).replace(/-/g, '/'))
}

function ageText(birthday) {
  const b = parseBirthday(birthday)
  const now = new Date()
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth())
  if (now.getDate() < b.getDate()) months -= 1
  if (months < 0) months = 0
  if (months < 12) return months + ' 个月'
  const years = Math.floor(months / 12)
  const rest = months % 12
  return rest ? years + ' 岁 ' + rest + ' 个月' : years + ' 岁'
}

function clamp(v, min, max) {
  v = Number(v) || 0
  if (v < min) return min
  if (v > max) return max
  return v
}

function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
}

/**
 * 猫咪档案的业务约束。规则属于数据层，页面只负责把 msg 显示出来，
 * 避免同一条规则在多个页面各写一份。
 */
const CAT_LIMITS = {
  nameMax: 12,
  weightMin: 0.1,
  weightMax: 30,
  foodTargetMin: 20,
  foodTargetMax: 600
}

/**
 * 校验并归一化一份猫咪档案表单。
 * @param {Object} input 页面表单原始值
 * @returns {{ok:boolean, field?:string, msg?:string, value?:Object}}
 */
function validateCat(input) {
  const f = input || {}

  const name = String(f.name || '').trim()
  if (!name) return { ok: false, field: 'name', msg: '先给猫咪取个名字' }
  if (name.length > CAT_LIMITS.nameMax) {
    return { ok: false, field: 'name', msg: '名字最多 ' + CAT_LIMITS.nameMax + ' 个字' }
  }

  const weight = parseFloat(f.weight)
  if (!weight || weight < CAT_LIMITS.weightMin || weight > CAT_LIMITS.weightMax) {
    return {
      ok: false,
      field: 'weight',
      msg: '体重请填 ' + CAT_LIMITS.weightMin + '-' + CAT_LIMITS.weightMax + ' kg'
    }
  }

  const target = parseInt(f.foodTarget, 10)
  if (!target || target < CAT_LIMITS.foodTargetMin || target > CAT_LIMITS.foodTargetMax) {
    return {
      ok: false,
      field: 'foodTarget',
      msg: '每日目标请填 ' + CAT_LIMITS.foodTargetMin + '-' + CAT_LIMITS.foodTargetMax + ' g'
    }
  }

  return {
    ok: true,
    value: {
      name: name,
      breed: f.breed,
      gender: f.gender,
      birthday: f.birthday,
      weight: Number(weight.toFixed(2)),
      foodTarget: target,
      note: String(f.note || '').trim(),
      avatar: f.avatar
    }
  }
}

/* ------------------------- 种子数据 ------------------------- */

function buildSeed() {
  const now = Date.now()
  const H = 3600 * 1000
  const D = 24 * H

  const cats = [
    {
      id: 'c1',
      name: '团子',
      breed: '英国短毛猫',
      gender: 'male',
      birthday: '2023-04-12',
      weight: 4.62,
      avatar: '/images/cats/cat1.jpg',
      food: 68,
      water: 52,
      mood: 82,
      foodTarget: 200,
      note: '爱吃冻干，怕生'
    },
    {
      id: 'c2',
      name: '芝麻',
      breed: '中华田园猫',
      gender: 'female',
      birthday: '2024-01-08',
      weight: 3.18,
      avatar: '/images/cats/cat2.jpg',
      food: 41,
      water: 30,
      mood: 64,
      foodTarget: 160,
      note: '半夜跑酷选手'
    },
    {
      id: 'c3',
      name: '豆豆',
      breed: '布偶猫',
      gender: 'female',
      birthday: '2022-09-30',
      weight: 5.04,
      avatar: '/images/cats/cat3.jpg',
      food: 86,
      water: 71,
      mood: 90,
      foodTarget: 220,
      note: '粘人，爱喝水'
    }
  ]

  const records = [
    { id: uid('r'), catId: 'c1', type: 'feed', value: 45, note: '早餐 · 冻干拌粮', time: now - 3 * H },
    { id: uid('r'), catId: 'c1', type: 'water', value: 60, note: '饮水机补水', time: now - 2.2 * H },
    { id: uid('r'), catId: 'c1', type: 'feed', value: 78, note: '午餐 · 冻干拌粮', time: now - 1.4 * H },
    { id: uid('r'), catId: 'c1', type: 'water', value: 120, note: '换水后续饮', time: now - 1.0 * H },
    { id: uid('r'), catId: 'c1', type: 'feed', value: 45, note: '加餐 · 主食罐', time: now - 0.6 * H },
    { id: uid('r'), catId: 'c1', type: 'weight', value: 4.62, note: '晨间称重', time: now - 5 * H },
    { id: uid('r'), catId: 'c2', type: 'feed', value: 60, note: '早餐 · 湿粮', time: now - 4 * H },
    { id: uid('r'), catId: 'c2', type: 'play', value: 15, note: '逗猫棒 15 分钟', time: now - 6 * H },
    { id: uid('r'), catId: 'c2', type: 'weight', value: 3.18, note: '晨间称重', time: now - 4.8 * H },
    { id: uid('r'), catId: 'c2', type: 'vaccine', value: 0, note: '猫三联加强针已接种', time: now - 1 * D },
    { id: uid('r'), catId: 'c3', type: 'feed', value: 80, note: '早餐 · 全价粮', time: now - 3.6 * H },
    { id: uid('r'), catId: 'c3', type: 'weight', value: 5.04, note: '晨间称重', time: now - 5.2 * H },
    { id: uid('r'), catId: 'c2', type: 'weight', value: 3.14, note: '晚间称重', time: now - 1.3 * D },
    { id: uid('r'), catId: 'c3', type: 'weight', value: 5.01, note: '晚间称重', time: now - 1.5 * D },
    { id: uid('r'), catId: 'c3', type: 'weight', value: 4.98, note: '晨间称重', time: now - 3.4 * D },
    { id: uid('r'), catId: 'c2', type: 'weight', value: 3.11, note: '晨间称重', time: now - 3.6 * D },
    { id: uid('r'), catId: 'c1', type: 'feed', value: 70, note: '晚餐 · 猫粮', time: now - 1 * D },
    { id: uid('r'), catId: 'c1', type: 'weight', value: 4.58, note: '晚间称重', time: now - 1.1 * D },
    { id: uid('r'), catId: 'c2', type: 'water', value: 40, note: '换水', time: now - 1.2 * D },
    { id: uid('r'), catId: 'c3', type: 'deworm', value: 0, note: '体内驱虫完成', time: now - 2.3 * D },
    { id: uid('r'), catId: 'c1', type: 'feed', value: 65, note: '早餐 · 猫粮', time: now - 2.1 * D },
    { id: uid('r'), catId: 'c1', type: 'weight', value: 4.55, note: '晚间称重', time: now - 2.2 * D }
  ]

  return { cats, records }
}

/* ------------------------- 基础读写 ------------------------- */

function readCats() {
  const v = wx.getStorageSync(CATS_KEY)
  return Array.isArray(v) ? v : []
}

function writeCats(cats) {
  wx.setStorageSync(CATS_KEY, cats)
}

function readRecords() {
  const v = wx.getStorageSync(RECORDS_KEY)
  return Array.isArray(v) ? v : []
}

function writeRecords(records) {
  wx.setStorageSync(RECORDS_KEY, records)
}

function init() {
  if (wx.getStorageSync(SEED_KEY) !== SEED_VERSION) {
    const seed = buildSeed()
    writeCats(seed.cats)
    writeRecords(seed.records)
    wx.setStorageSync(SETTINGS_KEY, DEFAULT_SETTINGS)
    wx.setStorageSync(SEED_KEY, SEED_VERSION)
  }
  if (!wx.getStorageSync(SETTINGS_KEY)) {
    wx.setStorageSync(SETTINGS_KEY, DEFAULT_SETTINGS)
  }
}

/* ------------------------- 猫咪 ------------------------- */

function getCats() {
  return readCats()
}

function getCat(id) {
  const list = readCats()
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i]
  }
  return null
}

function decorate(cat) {
  if (!cat) return null
  const out = Object.assign({}, cat)
  out.ageText = ageText(cat.birthday)
  out.genderText = cat.gender === 'female' ? '♀ 妹妹' : '♂ 弟弟'
  out.food = clamp(cat.food, 0, 100)
  out.water = clamp(cat.water, 0, 100)
  out.mood = clamp(cat.mood, 0, 100)
  // 老数据没有这两个字段，补默认值；默认仍走照片，不让已有用户突然变成几何形象
  out.figure = Object.assign({}, DEFAULT_FIGURE, cat.figure || {})
  out.avatarType = cat.avatarType === 'figure' ? 'figure' : 'photo'
  return out
}

function getCatsDecorated() {
  return readCats().map(decorate)
}

function updateCat(id, patch) {
  const list = readCats()
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      list[i] = Object.assign({}, list[i], patch)
      writeCats(list)
      return list[i]
    }
  }
  return null
}

function addCat(data) {
  const list = readCats()
  const cat = Object.assign(
    {
      id: uid('c'),
      name: '新成员',
      breed: '中华田园猫',
      gender: 'male',
      birthday: dayKey(Date.now()),
      weight: 3,
      avatar: '/images/cats/default.jpg',
      food: 70,
      water: 60,
      mood: 75,
      foodTarget: 180,
      note: ''
    },
    data || {}
  )
  list.push(cat)
  writeCats(list)
  return cat
}

function removeCat(id) {
  const list = readCats().filter(function (c) {
    return c.id !== id
  })
  writeCats(list)
  const records = readRecords().filter(function (r) {
    return r.catId !== id
  })
  writeRecords(records)
}

/* ------------------------- 记录 ------------------------- */

/* icon 是自绘的 1.5px 描边图标路径，不再是 emoji：
   emoji 是系统预置的形，在 iOS 与 Android 上长得完全不同，设计上不可控。
   颜色统一从 theme.js 取，不在数据层再抄一份字面量。 */
const TYPE_META = {
  feed: { label: '投食', icon: '/images/icons/feed.png', unit: 'g', color: theme.PALETTE.ink6 },
  water: { label: '饮水', icon: '/images/icons/water.png', unit: 'ml', color: theme.PALETTE.ink6 },
  play: { label: '陪玩', icon: '/images/icons/play.png', unit: '分钟', color: theme.PALETTE.ink6 },
  weight: { label: '称重', icon: '/images/icons/weight.png', unit: 'kg', color: theme.PALETTE.vermilion },
  vaccine: { label: '疫苗', icon: '/images/icons/vaccine.png', unit: '', color: theme.PALETTE.ink6 },
  deworm: { label: '驱虫', icon: '/images/icons/deworm.png', unit: '', color: theme.PALETTE.ink6 }
}

function typeMeta(type) {
  return TYPE_META[type] || { label: '记录', icon: '/images/icons/feed.png', unit: '', color: theme.PALETTE.ink6 }
}

/* ------------------------- 形象 ------------------------- */

/* 几何形象的配色与配饰。key 进存储，label 进界面，颜色在 cat-figure.wxss 里定义。 */
const FIGURE_COLORS = [
  { key: 'ink', label: '墨' },
  { key: 'vermilion', label: '朱' },
  { key: 'brown', label: '褐' },
  { key: 'gray', label: '灰' },
  { key: 'cream', label: '米' }
]

const FIGURE_ACCESSORIES = [
  { key: 'none', label: '不戴' },
  { key: 'scarf', label: '围巾' },
  { key: 'collar', label: '项圈' }
]

const DEFAULT_FIGURE = { color: 'ink', accessory: 'none' }

/* ------------------------- 症状记录 ------------------------- */

/* 分组照兽医系统回顾的顺序，与 docs/症状清单依据-2026-10-22.md 一一对应。
   存储只存「原始选择 + 自由文本」，不存加工后的句子——以后改报告模板不用迁移历史数据。 */
const SYMPTOM_GROUPS = [
  {
    key: 'general',
    label: '精神与活动',
    items: ['没精神 / 不爱动', '躲起来不出来', '烦躁易怒', '半夜乱叫 / 叫声变多']
  },
  {
    key: 'intake',
    label: '吃喝',
    items: ['食欲下降', '完全不吃', '食欲变好 / 总讨食', '喝水变多', '喝水变少', '体重下降']
  },
  {
    key: 'coat',
    label: '皮肤与被毛',
    items: ['理毛变少 / 毛乱', '局部掉毛', '频繁抓挠', '皮肤发红 / 结痂', '皮屑增多']
  },
  {
    key: 'gi',
    label: '吐与排便',
    items: ['呕吐', '干呕 / 吐毛球', '腹泻 / 软便', '便秘', '便中带血或发黑']
  },
  {
    key: 'urinary',
    label: '排尿',
    items: ['频繁进猫砂盆', '蹲很久尿不出', '尿量变多', '尿里带血', '猫砂盆外乱尿']
  },
  {
    key: 'resp',
    label: '呼吸与鼻子',
    items: ['打喷嚏 / 流鼻涕', '咳嗽', '张嘴呼吸', '呼吸声变重']
  },
  {
    key: 'eyeear',
    label: '眼睛与耳朵',
    items: ['眼部分泌物', '眼睛红 / 睁不开', '耳朵有异味', '频繁挠耳甩头']
  },
  {
    key: 'oral',
    label: '口腔与牙齿',
    items: ['流口水', '口臭', '吃饭偏头 / 掉食', '只敢吃软食', '牙龈出血']
  },
  {
    key: 'limb',
    label: '走路与动作',
    items: ['走路不稳 / 转圈', '后腿无力 / 拖行', '跛行 / 不愿跳', '抽搐']
  }
]

/* 不归属任何分组的快捷入口项 */
const LOOSE_ITEMS = ['说不上来，但感觉不对劲', '误食 / 接触有毒物']

const DURATIONS = [
  { key: '1d', label: '1 天内' },
  { key: '2-3d', label: '2–3 天' },
  { key: 'week', label: '一周内' },
  { key: 'longer', label: '更久' }
]

/* 急诊项：命中任一项即判 emergency。依据见《症状清单依据》第三节。
   「蹲很久尿不出」排第一：公猫尿道阻塞 24–48 小时可致死，时间窗最短。 */
const EMERGENCY_ITEMS = ['蹲很久尿不出', '张嘴呼吸', '抽搐', '后腿无力 / 拖行', '误食 / 接触有毒物']

/* 加急项：24 小时内应就诊 */
const URGENT_ITEMS = ['便中带血或发黑', '眼睛红 / 睁不开', '完全不吃']

/* 三档分诊的文案。依据必须写出来，否则等于在暗示病情轻重。 */
const TIER_META = {
  emergency: {
    label: '请立即就医',
    note: '记录中有需要立即处理的情况，不要等到明天。',
    cls: 'alert'
  },
  urgent: {
    label: '建议今天或明天就诊',
    note: '依据：症状数量与持续时间，仅供就诊沟通使用。',
    cls: 'caution'
  },
  routine: {
    label: '可先观察，继续记录',
    note: '依据：症状数量与持续时间，仅供就诊沟通使用。',
    cls: 'safe'
  }
}

function readSymptomLogs() {
  const v = wx.getStorageSync(SYMPTOM_KEY)
  return Array.isArray(v) ? v : []
}

function writeSymptomLogs(logs) {
  wx.setStorageSync(SYMPTOM_KEY, logs)
}

/**
 * 按症状与持续时间做三档分诊。按时限，不按"病情轻重"。
 * @returns {'emergency'|'urgent'|'routine'}
 */
function calcTier(symptoms, duration) {
  const list = symptoms || []
  const hit = function (pool) {
    for (let i = 0; i < list.length; i++) {
      if (pool.indexOf(list[i]) >= 0) return true
    }
    return false
  }
  if (hit(EMERGENCY_ITEMS)) return 'emergency'
  if (hit(URGENT_ITEMS)) return 'urgent'
  if (duration === 'week' || duration === 'longer') return 'urgent'
  // 三项以上同时出现，风险高于单项
  if (list.length >= 3) return 'urgent'
  return 'routine'
}

function addSymptomLog(catId, symptoms, duration, freeText) {
  const logs = readSymptomLogs()
  const log = {
    id: uid('sym'),
    catId: catId,
    symptoms: Array.isArray(symptoms) ? symptoms.slice() : [],
    duration: duration || '1d',
    freeText: String(freeText || '').trim(),
    time: Date.now()
  }
  logs.push(log)
  writeSymptomLogs(logs)
  return log
}

function getSymptomLogs(catId) {
  const logs = readSymptomLogs()
  if (!catId) return logs
  return logs.filter(function (l) {
    return l.catId === catId
  })
}

/**
 * 生成就诊描述。纯模板拼接，不调用任何模型。
 * 输出同时给页面渲染（结构化）与复制（plainText，含免责声明）。
 */
function buildVisitReport(log, cat) {
  const symptoms = log.symptoms || []
  const tier = calcTier(symptoms, log.duration)
  const meta = TIER_META[tier]

  // 按分组归并
  const groups = []
  SYMPTOM_GROUPS.forEach(function (g) {
    const picked = symptoms.filter(function (s) {
      return g.items.indexOf(s) >= 0
    })
    if (picked.length) groups.push({ label: g.label, items: picked, text: picked.join('、') })
  })
  const loose = symptoms.filter(function (s) {
    const inGroup = SYMPTOM_GROUPS.some(function (g) {
      return g.items.indexOf(s) >= 0
    })
    return !inGroup
  })
  if (loose.length) groups.push({ label: '其他', items: loose, text: loose.join('、') })

  const dur =
    DURATIONS.filter(function (d) {
      return d.key === log.duration
    })[0] || DURATIONS[0]

  const info = []
  if (cat) {
    info.push(cat.name + ' · ' + ageText(cat.birthday) + ' · ' + (cat.breed || '未填品种'))
    if (cat.weight) {
      const trend = weightTrend(cat.id)
      let w = '近期体重 ' + cat.weight + ' kg'
      if (trend.delta) {
        w += '，最近两次' + (trend.delta > 0 ? '上升' : '下降') + ' ' + Math.abs(trend.delta).toFixed(2) + ' kg'
      }
      info.push(w)
    }
  }

  const lines = []
  lines.push('【猫咪信息】')
  if (info.length) info.forEach(function (t) { lines.push(t) })
  if (groups.length) {
    lines.push('')
    lines.push('【勾选的症状】')
    groups.forEach(function (g) {
      lines.push('· ' + g.label + '：' + g.items.join('、'))
    })
  }
  if (log.freeText) {
    lines.push('')
    lines.push('【你描述的】')
    lines.push(log.freeText)
  }
  lines.push('')
  lines.push('【持续】' + dur.label)
  lines.push('')
  // 这句必须跟正文一起被复制走：描述会经过微信转给兽医，免责声明不能留在这个页面上
  lines.push('以上信息由主人自行记录，未经兽医确认。未列出的情况可能同样重要，请一并向兽医说明。')

  return {
    tier: tier,
    tierLabel: meta.label,
    tierNote: meta.note,
    tierClass: meta.cls,
    dateText: dayKey(log.time) + ' ' + fmtClock(log.time),
    count: symptoms.length,
    groups: groups,
    freeText: log.freeText || '',
    durationLabel: dur.label,
    info: info,
    plainText: lines.join('\n')
  }
}

function getRecords(catId) {
  let list = readRecords()
  if (catId) {
    list = list.filter(function (r) {
      return r.catId === catId
    })
  }
  list.sort(function (a, b) {
    return b.time - a.time
  })
  return list
}

function addRecord(catId, type, value, note) {
  const records = readRecords()
  const rec = {
    id: uid('r'),
    catId: catId,
    type: type,
    value: value || 0,
    note: note || '',
    time: Date.now()
  }
  records.push(rec)
  writeRecords(records)
  return rec
}

function groupByDay(records) {
  const now = new Date()
  const todayKey = dayKey(now.getTime())
  const yKey = dayKey(now.getTime() - 86400000)
  const map = {}
  const order = []
  records.forEach(function (r) {
    const key = dayKey(r.time)
    if (!map[key]) {
      map[key] = { key: key, label: dayLabel(key, todayKey, yKey), items: [] }
      order.push(key)
    }
    map[key].items.push(r)
  })
  return order.map(function (k) {
    return map[k]
  })
}

function dayLabel(key, todayKey, yKey) {
  if (key === todayKey) return '今天'
  if (key === yKey) return '昨天'
  const parts = key.split('-')
  return Number(parts[1]) + ' 月 ' + Number(parts[2]) + ' 日'
}

function fmtClock(ts) {
  const d = new Date(ts)
  return pad(d.getHours()) + ':' + pad(d.getMinutes())
}

/* ------------------------- 统计与助手 ------------------------- */

function getSettings() {
  const v = wx.getStorageSync(SETTINGS_KEY)
  return Object.assign({}, DEFAULT_SETTINGS, v || {})
}

function saveSettings(patch) {
  const next = Object.assign(getSettings(), patch || {})
  wx.setStorageSync(SETTINGS_KEY, next)
  return next
}

function todayIntake(catId) {
  const key = dayKey(Date.now())
  let food = 0
  let water = 0
  readRecords().forEach(function (r) {
    if (r.catId !== catId) return
    if (dayKey(r.time) !== key) return
    if (r.type === 'feed') food += Number(r.value) || 0
    if (r.type === 'water') water += Number(r.value) || 0
  })
  return { food: Math.round(food), water: Math.round(water) }
}

/** 每日饮水目标：沿用「进食目标 + 60」的推导，全站只此一处 */
function waterTargetOf(cat) {
  const base = Number(cat && cat.foodTarget) || 200
  return base + 60
}

/**
 * 今日三项完成度。
 *
 * 刻意让它与 todayIntake 同源：首页的「环」和三条「刻度」都从这一个函数取值，
 * 不会出现「饱食度 68%」与「进食 45/200g」互相矛盾的情况。
 * 心情无法从记录推导，仍取 cat.mood。
 */
function intakePercent(catId) {
  const cat = getCat(catId)
  const zero = {
    foodAbs: 0, waterAbs: 0, foodTarget: 200, waterTarget: 260,
    food: 0, water: 0, mood: 0
  }
  if (!cat) return zero

  const intake = todayIntake(catId)
  const foodTarget = Number(cat.foodTarget) || 200
  const waterTarget = waterTargetOf(cat)

  return {
    foodAbs: intake.food,
    waterAbs: intake.water,
    foodTarget: foodTarget,
    waterTarget: waterTarget,
    food: Math.min(100, Math.round((intake.food / foodTarget) * 100)),
    water: Math.min(100, Math.round((intake.water / waterTarget) * 100)),
    mood: clamp(Number(cat.mood) || 0, 0, 100)
  }
}

/** 今日照顾分 = 三项完成度的均值，0-100 */
function careScore(catId) {
  const p = intakePercent(catId)
  return Math.round((p.food + p.water + p.mood) / 3)
}

function weightSeries(catId, limit) {
  const list = readRecords()
    .filter(function (r) {
      return r.catId === catId && r.type === 'weight'
    })
    .sort(function (a, b) {
      return a.time - b.time
    })
  const n = limit || 7
  return list.slice(Math.max(0, list.length - n))
}

function weightTrend(catId) {
  const s = weightSeries(catId, 2)
  if (s.length < 2) return { delta: 0, text: '暂无对比' }
  const delta = Number((s[1].value - s[0].value).toFixed(2))
  return { delta: delta, text: Math.abs(delta).toFixed(2) }
}

function stats() {
  const cats = readCats()
  const records = readRecords()
  const days = {}
  records.forEach(function (r) {
    days[dayKey(r.time)] = 1
  })
  return {
    cats: cats.length,
    records: records.length,
    days: Object.keys(days).length
  }
}

function resetAll() {
  wx.removeStorageSync(CATS_KEY)
  wx.removeStorageSync(RECORDS_KEY)
  wx.removeStorageSync(SYMPTOM_KEY)
  wx.removeStorageSync(SETTINGS_KEY)
  wx.removeStorageSync(SEED_KEY)
  init()
}

module.exports = {
  init: init,
  getCats: getCats,
  getCat: getCat,
  getCatsDecorated: getCatsDecorated,
  decorate: decorate,
  updateCat: updateCat,
  addCat: addCat,
  removeCat: removeCat,
  getRecords: getRecords,
  addRecord: addRecord,
  groupByDay: groupByDay,
  typeMeta: typeMeta,
  fmtClock: fmtClock,
  dayKey: dayKey,
  getSettings: getSettings,
  saveSettings: saveSettings,
  todayIntake: todayIntake,
  waterTargetOf: waterTargetOf,
  intakePercent: intakePercent,
  careScore: careScore,
  weightSeries: weightSeries,
  weightTrend: weightTrend,
  stats: stats,
  ageText: ageText,
  clamp: clamp,
  CAT_LIMITS: CAT_LIMITS,
  validateCat: validateCat,
  FIGURE_COLORS: FIGURE_COLORS,
  FIGURE_ACCESSORIES: FIGURE_ACCESSORIES,
  DEFAULT_FIGURE: DEFAULT_FIGURE,
  SYMPTOM_GROUPS: SYMPTOM_GROUPS,
  LOOSE_ITEMS: LOOSE_ITEMS,
  DURATIONS: DURATIONS,
  EMERGENCY_ITEMS: EMERGENCY_ITEMS,
  URGENT_ITEMS: URGENT_ITEMS,
  calcTier: calcTier,
  addSymptomLog: addSymptomLog,
  getSymptomLogs: getSymptomLogs,
  buildVisitReport: buildVisitReport,
  resetAll: resetAll
}
