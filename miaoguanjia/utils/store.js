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
const SEED_VERSION = 8

/* 每日逗猫目标（分钟）。三条刻度里「逗猫」的目标就取这个数。
   写死而不再按体重推导：逗猫时长取决于人，与猫的大小无关。 */
const PLAY_TARGET = 30

/* ---------------------- 进食与饮水的参考量 ----------------------
 * 两个数都不再由饲主填，全部从体重推。原先「每日进食目标」是建档时
 * 手填的，而饮水是「进食目标 + 60」——后者跟体重没有关系，一只 3 kg
 * 的猫和一只 5 kg 的猫会被推出同样的水。改成同一条推导链：
 *
 *   静息能量需求 RER = 70 × W^0.75        （kcal/天，NRC 2006）
 *   绝育成猫维持量 DER = 1.2 × RER        （AAHA 2010 生命阶段系数）
 *   每日克数 = DER ÷ 粮的能量密度
 *   每日饮水 = W × 50                     （ml/kg，NRC 2006 给的是 44–66）
 *
 * 为什么系数是 1.3 kcal/g：干粮 3.5–4.5 kcal/g、主食罐 0.8–1.2 kcal/g，
 * 同一只 4.6 kg 的猫按干粮算 66 g、按罐头算 265 g，差四倍。克数不可能
 * 脱离粮型单独谈，1.3 是「以主食罐为主、掺少量干粮」的现实折中。
 * 这也是为什么面板里必须留自定义输入：换粮就是换密度，公式只能给起点。
 */
const DER_FACTOR = 1.2
const KCAL_PER_G = 1.3
const WATER_ML_PER_KG = 50

/** 取整到 10：参考量本来就是个估值，写成 203.6 g 是在假装精确 */
function round10(n) {
  return Math.round(Number(n) / 10) * 10
}

/** 每日进食参考量（g）。体重缺失时退回 200，与旧版默认值一致。 */
function foodTargetOf(cat) {
  const w = Number(cat && cat.weight)
  if (!w || w <= 0) return 200
  const der = DER_FACTOR * 70 * Math.pow(w, 0.75)
  return clamp(round10(der / KCAL_PER_G), 40, 600)
}

/** 每日饮水参考量（ml）。 */
function waterTargetOf(cat) {
  const w = Number(cat && cat.weight)
  if (!w || w <= 0) return 250
  return clamp(round10(w * WATER_ML_PER_KG), 40, 1600)
}

/* 心情自评的 1-5 档。刻意不映射成百分比——
   它是「饲主看到的状态」，不是「系统测出来的指标」，两者不能换算。 */
const MOOD_LABELS = ['很差', '一般', '还行', '不错', '很好']

/* 数量型动作的「常用量」档位。
   名字是常用量，不是推荐量：同样 40 g，冻干和主食罐的热量能差一倍，
   该给多少取决于粮，不取决于猫。所以档位只做输入框的快捷填充，
   真正写进记录的是用户自己确认的那个数。 */
const INTAKE_PRESETS = {
  feed: ['20', '30', '40', '50', '60'],
  water: ['50', '100', '150', '200'],
  play: ['10', '15', '20', '30']
}

/* 单次量的允许范围。上限不是医学上限，是「防手滑」：
   一次喂 300 g 以上基本可以确定是少打了一位小数点，不是猫能吃。 */
const INTAKE_LIMITS = {
  feed: { min: 5, max: 300 },
  water: { min: 10, max: 500 },
  play: { min: 1, max: 180 }
}

/* 面板与提示里用的短单位。TYPE_META 的 unit 是列表页用的（「分钟」），
   放到 121rpx 宽的档位块里会挤，故另给一套短的。 */
const INTAKE_UNITS = { feed: 'g', water: 'ml', play: 'min' }

function intakeUnit(type) {
  return INTAKE_UNITS[type] || ''
}

const DEFAULT_SETTINGS = {
  feedRemind: true,
  vaccineRemind: true,
  remindTime: '08:30',
  feeder: true,
  fountain: true,
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
  weightMax: 30
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

  /* 这里不再校验「每日进食目标」：它已经不是用户填的字段，
     而是由体重现算的派生值（见 foodTargetOf）。旧表单里带来的
     foodTarget 一律忽略，不写进档案——留着就成了第二份真相。 */

  return {
    ok: true,
    value: {
      name: name,
      breed: f.breed,
      gender: f.gender,
      birthday: f.birthday,
      weight: Number(weight.toFixed(2)),
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

  const d0 = new Date(now)
  d0.setHours(0, 0, 0, 0)
  const d0t = d0.getTime()

  /* 钟点按绝对时间给（8.33 = 08:20），不按「今天已过时长的百分比」：
     百分比在 19:25 重置时，0.22 会落到凌晨 4:16，一条标着「早餐」的记录
     出现在凌晨四点——和 168 g 一样，是数据自己反驳自己。
     改成钟点后，只要启动时间晚于该钟点，就是真的那个点。

     凌晨启动时目标钟点还没到，压到「现在之前 backMin 分钟」，且不早于
     今天 00:01；否则会落到昨天，首页今日摄入归零。backMin 按记录先后
     递减，保证全被压时顺序仍然正确——这也是「记录时间不得晚于现在」
     那条断言的保证。 */
  const atHour = function (h, backMin) {
    const t = d0t + Math.round(h * H)
    if (t < now) return t
    return Math.max(d0t + 60 * 1000, now - (backMin || 10) * 60 * 1000)
  }
  /* 往前第 n 天的某个整点 */
  const backAt = function (n, hour) {
    return d0t - n * D + hour * H
  }

  /* 头像用的是 Pexels 免费授权照片（来源与作者见 docs/图片来源.md）。
     这三只猫是虚构的档案，照片只是占位——名字、品种、体重各自都对得上，
     但它们并不是同一只真实存在的猫。录屏时不要描述成「我养的猫」。 */
  const cats = [
    {
      id: 'c1',
      name: '团子',
      breed: '布偶猫',
      gender: 'female',
      birthday: '2023-04-12',
      weight: 4.62,
      avatar: '/images/cats/cat1.jpg',
      note: '爱吃冻干，怕生'
    },
    {
      id: 'c2',
      name: '芝麻',
      breed: '中华田园猫（玄猫）',
      gender: 'female',
      birthday: '2024-01-08',
      weight: 3.18,
      avatar: '/images/cats/cat2.jpg',
      note: '半夜跑酷选手'
    },
    {
      id: 'c3',
      name: '豆豆',
      breed: '中华田园猫（三花）',
      gender: 'female',
      birthday: '2022-09-30',
      weight: 5.04,
      avatar: '/images/cats/cat3.jpg',
      note: '粘人，爱喝水'
    }
  ]

  /* 数量必须取自 INTAKE_PRESETS 的档位（feed 20/30/40/50/60、water 50/100/150/200、
     play 10/15/20/30）。这些是「用这个 App 记出来的数」，而面板只给整十档位——
     种子写 168 g 就等于当场证明「首页那 168 不是这套 UI 产生的」。
     simulate 里有一条断言逐个比对，新增种子时漏改会被拦下。 */
  const records = [
    { id: uid('r'), catId: 'c1', type: 'weight', value: 4.62, note: '晨间称重', time: atHour(8.08, 70) },
    { id: uid('r'), catId: 'c1', type: 'feed', value: 50, note: '早餐 · 冻干拌粮', time: atHour(8.33, 62) },
    { id: uid('r'), catId: 'c1', type: 'water', value: 50, note: '饮水机补水', time: atHour(10.5, 52) },
    { id: uid('r'), catId: 'c1', type: 'feed', value: 60, note: '午餐 · 冻干拌粮', time: atHour(12.67, 42) },
    { id: uid('r'), catId: 'c1', type: 'water', value: 150, note: '换水后续饮', time: atHour(15.33, 30) },
    { id: uid('r'), catId: 'c1', type: 'play', value: 15, note: '逗猫棒 15 分钟', time: atHour(17, 18) },
    { id: uid('r'), catId: 'c1', type: 'feed', value: 50, note: '晚餐 · 主食罐', time: atHour(18.5, 6) },

    { id: uid('r'), catId: 'c1', type: 'feed', value: 60, note: '晚餐 · 猫粮', time: backAt(1, 19) },
    { id: uid('r'), catId: 'c1', type: 'weight', value: 4.58, note: '晚间称重', time: backAt(1, 21) },
    { id: uid('r'), catId: 'c1', type: 'feed', value: 60, note: '早餐 · 猫粮', time: backAt(2, 8) },
    { id: uid('r'), catId: 'c1', type: 'weight', value: 4.55, note: '晚间称重', time: backAt(2, 21) },

    { id: uid('r'), catId: 'c2', type: 'weight', value: 3.18, note: '晨间称重', time: atHour(8.1, 70) },
    { id: uid('r'), catId: 'c2', type: 'feed', value: 60, note: '早餐 · 湿粮', time: atHour(8.5, 58) },
    { id: uid('r'), catId: 'c2', type: 'play', value: 15, note: '逗猫棒 15 分钟', time: atHour(17.5, 20) },
    { id: uid('r'), catId: 'c2', type: 'water', value: 50, note: '换水', time: backAt(1, 9) },
    { id: uid('r'), catId: 'c2', type: 'vaccine', value: 0, note: '猫三联加强针已接种', time: backAt(1, 10) },
    { id: uid('r'), catId: 'c2', type: 'weight', value: 3.14, note: '晚间称重', time: backAt(1, 20) },
    { id: uid('r'), catId: 'c2', type: 'weight', value: 3.11, note: '晨间称重', time: backAt(3, 8) },

    { id: uid('r'), catId: 'c3', type: 'weight', value: 5.04, note: '晨间称重', time: atHour(8.15, 70) },
    { id: uid('r'), catId: 'c3', type: 'feed', value: 40, note: '早餐 · 全价粮', time: atHour(8.75, 54) },
    { id: uid('r'), catId: 'c3', type: 'feed', value: 40, note: '晚餐 · 全价粮', time: atHour(18.25, 8) },
    { id: uid('r'), catId: 'c3', type: 'weight', value: 5.01, note: '晚间称重', time: backAt(1, 20) },
    { id: uid('r'), catId: 'c3', type: 'deworm', value: 0, note: '体内驱虫完成', time: backAt(2, 15) },
    { id: uid('r'), catId: 'c3', type: 'weight', value: 4.98, note: '晨间称重', time: backAt(3, 8) }
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
  /* 形象系统已整体移除，首页一律用照片。旧存档里可能还留着 avatarType / figure，
     这里显式删掉，免得它们从装饰结果里继续流到界面与导出。 */
  delete out.figure
  delete out.avatarType
  /* 进食目标改成按体重现算之后，旧存档里的 foodTarget 就成了会跟公式
     打架的第二份真相（改体重它不会跟着变）。同样在这里剔掉。 */
  delete out.foodTarget
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
  play: { label: '逗猫', icon: '/images/icons/play.png', unit: '分钟', color: theme.PALETTE.ink6 },
  weight: { label: '称重', icon: '/images/icons/weight.png', unit: 'kg', color: theme.PALETTE.vermilion },
  vaccine: { label: '疫苗', icon: '/images/icons/vaccine.png', unit: '', color: theme.PALETTE.ink6 },
  deworm: { label: '驱虫', icon: '/images/icons/deworm.png', unit: '', color: theme.PALETTE.ink6 },
  /* 自评不进记录页流水，但需要 meta 兜底，否则 groupByDay 拿到 '记录' 这个泛称 */
  mood: { label: '心情', icon: '/images/icons/paw.png', unit: '分', color: theme.PALETTE.ink6 }
}

function typeMeta(type) {
  return TYPE_META[type] || { label: '记录', icon: '/images/icons/feed.png', unit: '', color: theme.PALETTE.ink6 }
}

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

/* 三档分诊的文案。依据必须写出来，否则等于在暗示病情轻重。
   short 只给列表用：列表是索引，「继续记录」这种叮嘱放在列表里是当下的语气，
   回看历史时读着别扭，所以只留判断本身。 */
const TIER_META = {
  emergency: {
    label: '请立即就医',
    short: '立即就医',
    note: '记录中有需要立即处理的情况，不要等到明天。',
    cls: 'alert'
  },
  urgent: {
    label: '建议今天或明天就诊',
    short: '尽快就诊',
    note: '依据：症状数量与持续时间，仅供就诊沟通使用。',
    cls: 'caution'
  },
  routine: {
    label: '可先观察，继续记录',
    short: '先观察',
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
 * 列表用的精简摘要。报告页要完整正文，列表只要「什么时候、多急、记了什么」。
 * 不给日期补年份：都是最近几次，补年份反而占宽。
 */
function getSymptomBriefs(catId, limit) {
  const logs = readSymptomLogs()
    .filter(function (l) {
      return !catId || l.catId === catId
    })
    .sort(function (a, b) {
      return b.time - a.time
    })
    .slice(0, limit || 3)

  return logs.map(function (l) {
    const items = l.symptoms || []
    const tier = calcTier(items, l.duration)
    const meta = TIER_META[tier]
    let summary = items.slice(0, 3).join('、')
    if (items.length > 3) summary += ' 等 ' + items.length + ' 项'
    if (!summary) summary = l.freeText || '仅文字描述'

    const d = new Date(l.time)
    return {
      id: l.id,
      dateText: pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + fmtClock(l.time),
      tier: tier,
      tierLabel: meta.short,
      tierClass: meta.cls,
      summary: summary,
      count: items.length
    }
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
  let play = 0
  readRecords().forEach(function (r) {
    if (r.catId !== catId) return
    if (dayKey(r.time) !== key) return
    if (r.type === 'feed') food += Number(r.value) || 0
    if (r.type === 'water') water += Number(r.value) || 0
    if (r.type === 'play') play += Number(r.value) || 0
  })
  return { food: Math.round(food), water: Math.round(water), play: Math.round(play) }
}

/**
 * 今日三项完成度。
 *
 * 三项全部来自记录，没有一项是档案里的固定值：
 * 进食 / 饮水 / 逗猫 都能从今天写了什么推出来，所以「环」和三条「刻度」
 * 永远是同一份数据，不会出现「饱食度 68%」与「进食 45/200g」互相矛盾。
 *
 * 分母也不再是档案里的固定值：进食与饮水都由体重现算（foodTargetOf /
 * waterTargetOf），改了体重，两条刻度的分母当天就跟着变。
 *
 * 原先第三项是 mood：建档时写死 82，逗猫 +14，永不衰减——一个只涨不跌的
 * 计数器，不是任何东西的度量，却占照顾分三分之一。现改为逗猫分钟数。
 */
function intakePercent(catId) {
  const cat = getCat(catId)
  const zero = {
    foodAbs: 0, waterAbs: 0, playAbs: 0,
    foodTarget: 0, waterTarget: 0, playTarget: PLAY_TARGET,
    food: 0, water: 0, play: 0
  }
  if (!cat) return zero

  const intake = todayIntake(catId)
  const foodTarget = foodTargetOf(cat)
  const waterTarget = waterTargetOf(cat)

  return {
    foodAbs: intake.food,
    waterAbs: intake.water,
    playAbs: intake.play,
    foodTarget: foodTarget,
    waterTarget: waterTarget,
    playTarget: PLAY_TARGET,
    food: Math.min(100, Math.round((intake.food / foodTarget) * 100)),
    water: Math.min(100, Math.round((intake.water / waterTarget) * 100)),
    play: Math.min(100, Math.round((intake.play / PLAY_TARGET) * 100))
  }
}

/** 今日照顾分 = 三项完成度的均值，0-100 */
function careScore(catId) {
  const p = intakePercent(catId)
  return Math.round((p.food + p.water + p.play) / 3)
}

/* ---------------------- 用量与超量 ---------------------- */

/**
 * 校验一次数量型记录。范围与单位都在数据层，页面只管把 msg 弹出来。
 * @returns {{ok:boolean, msg?:string, value?:number}}
 */
function validateAmount(type, raw) {
  const lim = INTAKE_LIMITS[type]
  if (!lim) return { ok: false, msg: '未知的记录类型' }
  const unit = intakeUnit(type)
  const v = Math.round(Number(raw))
  if (!raw || !isFinite(v) || v <= 0) {
    return { ok: false, msg: '先填一个数量' }
  }
  if (v < lim.min || v > lim.max) {
    return { ok: false, msg: '请填 ' + lim.min + '–' + lim.max + ' ' + unit }
  }
  return { ok: true, value: v }
}

/**
 * 这一笔落下去，今天会到多少、有没有超过「参考量」。
 *
 * 用词是参考量而不是上限：进食量由体重和 1.3 kcal/g 的粮密度折算，
 * 换一袋粮就该换一个数；饮水量取的是 44–66 ml/kg 区间的中位。
 * 两个都是估值，把一个估值当成红线去拦人，等于给估值班加了执法权。
 *
 * @returns {null|{type,unit,before,after,target,excess,over,pct}}
 */
function overflowOf(catId, type, value) {
  const cat = getCat(catId)
  if (!cat) return null
  const intake = todayIntake(catId)
  let before = 0
  let target = 0
  if (type === 'feed') {
    before = intake.food
    target = foodTargetOf(cat)
  } else if (type === 'water') {
    before = intake.water
    target = waterTargetOf(cat)
  } else if (type === 'play') {
    before = intake.play
    target = PLAY_TARGET
  } else {
    return null
  }

  const after = before + (Number(value) || 0)
  const excess = after - target
  return {
    type: type,
    unit: intakeUnit(type),
    before: before,
    after: after,
    target: target,
    excess: excess > 0 ? excess : 0,
    over: excess > 0,
    pct: target > 0 ? Math.round((after / target) * 100) : 0
  }
}

/**
 * 超量提醒的文案。返回 null 表示不必提醒。
 *
 * 三类动作的提醒方向不一样，不能套同一句话：
 *   投食超量 → 劝阻。一次给太多，猫容易吃急了吐，剩下的也会受潮。
 *   饮水超量 → 不劝阻。猫多喝水本来就是好事，限制饮水才是错的；
 *              该提醒的是「连续几天都多」这件事值得记录下来带给兽医。
 *   逗猫超量 → 不提醒。超过目标只有好处。
 *
 * 也不写病名：这个 App 的立场是不做诊断，界面里连「可能是肾病」都不该出现，
 * 否则等于替用户下了半个结论。
 *
 * 正文不写换行符：wx.showModal 的 content 会把 \n 折成空格，
 * 排出来的断行只在代码里成立，在屏幕上是连成一片的一句话。
 * 所以每句都写成能独立读完的一句话，靠自然折行。
 */
function overflowTip(catId, type, value) {
  if (type !== 'feed' && type !== 'water') return null
  const imp = overflowOf(catId, type, value)
  if (!imp || !imp.over) return null

  const v = Math.round(Number(value) || 0)

  if (type === 'water') {
    return {
      needConfirm: false,
      title: '今天饮水已多于参考量',
      content:
        '今天已饮水 ' + imp.before + ' ml，参考量 ' + imp.target + ' ml，' +
        '记下这 ' + v + ' ml 会到 ' + imp.after + ' ml。' +
        '喝水多不用限制，只是如果连着几天都比平常多，把这几天的记录带给兽医看。',
      confirmText: '知道了',
      cancelText: ''
    }
  }

  /* 110% 是文案的分界，不是安全线：超出一点点只说明「参考量本来就是个估值」，
     说到「容易吐」就过头了；超出明显时才说具体后果。 */
  const heavy = imp.after > imp.target * 1.1
  const head =
    '今天已进食 ' + imp.before + ' g，参考量 ' + imp.target + ' g。' +
    '再给 ' + v + ' g 会到 ' + imp.after + ' g' +
    (heavy ? '，超出 ' + imp.excess + ' g。' : '。')

  return {
    needConfirm: true,
    title: heavy ? '今天喂得偏多了' : '已经到参考量了',
    content:
      head +
      (heavy
        ? '一次给太多，猫容易吃急了吐，剩下的也会受潮。如果它刚吃过，这份可以先收起来。'
        : '参考量是按体重和粮估出来的，不是硬标准，偶尔超一点不用紧张。'),
    confirmText: '仍然记录',
    cancelText: '先不喂'
  }
}

/* ---------------------- 心情自评 ---------------------- */

/**
 * 今日心情自评，1-5；当天没评过返回 0。
 *
 * 这是一条「人看到的状态」，不是传感器读数——所以它不参与照顾分。
 * 照顾分算的是「你今天做了什么」（喂了多少、陪了多久），
 * 如果把「你觉得它今天心情怎么样」也折成百分比混进去，
 * 等于又制造了一个伪精确的数字。
 */
function todayMood(catId) {
  const key = dayKey(Date.now())
  let latest = null
  readRecords().forEach(function (r) {
    if (r.catId !== catId || r.type !== 'mood') return
    if (dayKey(r.time) !== key) return
    if (!latest || r.time > latest.time) latest = r
  })
  if (!latest) return 0
  return clamp(Number(latest.value) || 0, 1, 5)
}

/** 写下今日自评。同一天重复点只覆盖，不堆记录——它是状态，不是流水。 */
function setTodayMood(catId, score) {
  const s = Math.round(clamp(Number(score) || 0, 1, 5))
  if (!s) return 0
  const key = dayKey(Date.now())
  const list = readRecords().filter(function (r) {
    return !(r.catId === catId && r.type === 'mood' && dayKey(r.time) === key)
  })
  list.push({
    id: uid('r'),
    catId: catId,
    type: 'mood',
    value: s,
    note: '今日心情：' + MOOD_LABELS[s - 1],
    time: Date.now()
  })
  writeRecords(list)
  return s
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
  todayMood: todayMood,
  setTodayMood: setTodayMood,
  PLAY_TARGET: PLAY_TARGET,
  MOOD_LABELS: MOOD_LABELS,
  waterTargetOf: waterTargetOf,
  foodTargetOf: foodTargetOf,
  intakePercent: intakePercent,
  careScore: careScore,
  INTAKE_PRESETS: INTAKE_PRESETS,
  INTAKE_LIMITS: INTAKE_LIMITS,
  intakeUnit: intakeUnit,
  validateAmount: validateAmount,
  overflowOf: overflowOf,
  overflowTip: overflowTip,
  weightSeries: weightSeries,
  weightTrend: weightTrend,
  stats: stats,
  ageText: ageText,
  clamp: clamp,
  CAT_LIMITS: CAT_LIMITS,
  validateCat: validateCat,
  SYMPTOM_GROUPS: SYMPTOM_GROUPS,
  LOOSE_ITEMS: LOOSE_ITEMS,
  DURATIONS: DURATIONS,
  EMERGENCY_ITEMS: EMERGENCY_ITEMS,
  URGENT_ITEMS: URGENT_ITEMS,
  calcTier: calcTier,
  addSymptomLog: addSymptomLog,
  getSymptomLogs: getSymptomLogs,
  getSymptomBriefs: getSymptomBriefs,
  buildVisitReport: buildVisitReport,
  resetAll: resetAll
}
