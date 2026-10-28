const store = require('../../utils/store.js')
const theme = require('../../utils/theme.js')
const PALETTE = theme.PALETTE
const app = getApp()

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

/* 面板标题跟按钮上的字保持一致：用户刚点的是「喂水」，弹出来的标题就该是「喂水」，
   换成数据层的「饮水」会让人怀疑自己点错了。 */
const INTAKE_TITLE = { feed: '投食', water: '喂水', play: '逗猫' }
const INTAKE_NOTE = { feed: '手动投食', water: '手动补水', play: '逗猫' }

const EMPTY_SHEET = {
  open: false,
  type: '',
  title: '',
  unit: '',
  presets: [],
  value: '',
  before: 0,
  target: 0,
  tip: { text: '', cls: '' }
}

Page({
  data: {
    version: '1.0.0',
    today: '',
    cats: [],
    cat: {},
    trend: { delta: 0, text: '暂无对比' },
    pct: {
      foodAbs: 0, waterAbs: 0, playAbs: 0,
      foodTarget: 200, waterTarget: 260, playTarget: 30,
      food: 0, water: 0, play: 0
    },
    care: 0,
    careRing: '',
    todayCount: 0,
    mood: 0,
    moodText: '',
    moodScale: [1, 2, 3, 4, 5],
    moodLabels: store.MOOD_LABELS,
    sheet: Object.assign({}, EMPTY_SHEET)
  },

  onLoad() {
    const now = new Date()
    this.setData({
      version: (app.globalData && app.globalData.version) || '1.0.0',
      today: (now.getMonth() + 1) + '月' + now.getDate() + '日 周' + WEEK[now.getDay()]
    })
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const cats = store.getCatsDecorated()
    if (!cats.length) {
      this.setData({ cats: [], cat: {}, care: 0, careRing: '', todayCount: 0, mood: 0, moodText: '' })
      return
    }

    let currentId = (app.globalData && app.globalData.currentCatId) || ''
    let cat = null
    for (let i = 0; i < cats.length; i++) {
      if (cats[i].id === currentId) cat = cats[i]
    }
    if (!cat) {
      cat = cats[0]
      if (app.globalData) app.globalData.currentCatId = cat.id
    }

    /* 三项完成度与照顾分同源，首页不会出现两个互相矛盾的百分比 */
    const pct = store.intakePercent(cat.id)
    const care = store.careScore(cat.id)
    const trend = store.weightTrend(cat.id)
    const mood = store.todayMood(cat.id)

    const key = store.dayKey(Date.now())
    let todayCount = 0
    store.getRecords(cat.id).forEach(function (r) {
      if (r.type === 'mood') return
      if (store.dayKey(r.time) === key) todayCount += 1
    })

    this.setData({
      cats: cats,
      cat: cat,
      trend: trend,
      pct: pct,
      care: care,
      /* 弧色随分值走：低分红、高分绿。轨道色不变，
         所以「已经做到多少」和「做得怎么样」是两个独立信号，不互相干扰。 */
      careRing: theme.ringGradient(care, theme.scoreColor(care), PALETTE.rule),
      todayCount: todayCount,
      mood: mood,
      moodText: mood ? store.MOOD_LABELS[mood - 1] : '未知'
    })
  },

  onSwitch(e) {
    const id = e.currentTarget.dataset.id
    if (app.globalData) app.globalData.currentCatId = id
    /* 面板还开着就切猫，里面的「今天已进食」会跟新猫对不上，先关掉 */
    if (this.data.sheet.open) this.closeSheet()
    this.refresh()
  },

  /**
   * 投食 / 补水 / 逗猫共用一条落笔路径：写记录 → 轻震 → 刷新。
   * 震动是刻意的：这是「触觉」，原先只有一句 toast，摸起来跟表单一样。
   * 称重不走这里——它要用户先输入数值，流程不同。
   *
   * 不再额外维护 cat.food / cat.water / cat.mood 这类「状态字段」：
   * 完成度已经由 todayIntake 从记录累加得出，再存第二份就是两个真相，迟早对不上。
   */
  log(type, value, note, toast) {
    const cat = this.data.cat
    if (!cat.id) return
    store.addRecord(cat.id, type, value, note)
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
    if (toast) wx.showToast({ title: toast, icon: 'none' })
    this.refresh()
  },

  /* ---- 投食 / 喂水 / 逗猫：先问数量，再落笔 ----
   * 原先这三个动作各自写死一个数（投食 40 g、补水 60 ml、逗猫 15 分钟）。
   * 写死的数不是「默认值」，是「所有人的同一个事实」——而记录该记的是
   * 这一顿到底给了多少。所以改成先开面板选数量。
   */
  onFeed() {
    this.openSheet('feed')
  },

  onWater() {
    this.openSheet('feed')
  },

  onPlay() {
    this.openSheet('play')
  },

  openSheet(type) {
    const cat = this.data.cat
    if (!cat.id) return
    const presets = store.INTAKE_PRESETS[type] || []
    /* 默认停在中间那档。不给空值：空输入框会让人以为必须自己算一遍，
       实际大多数人只会点一下最接近的数。 */
    const value = presets.length ? presets[Math.floor(presets.length / 2)] : ''
    const imp = store.overflowOf(cat.id, type, value)

    this.setData({
      sheet: {
        open: true,
        type: type,
        title: INTAKE_TITLE[type] || '',
        unit: store.intakeUnit(type),
        presets: presets,
        value: value,
        before: imp ? imp.before : 0,
        target: imp ? imp.target : 0,
        tip: this.tipOf(type, value)
      }
    })
  },

  /**
   * 面板里那行预告：「记完 208 / 200 g · 超出 8 g」。
   * 提示放在选择时而不是提交后——拨数字的那一刻才知道会不会超，
   * 比写完再被弹窗拦住更像是在商量。
   */
  tipOf(type, value) {
    const cat = this.data.cat
    const imp = store.overflowOf(cat.id, type, value)
    /* 输入框被清空时不预告：0 也算一个数，写出来会变成「记完 168 / 200 g」这种假进度 */
    if (!imp || String(value) === '') return { text: '', cls: '' }

    let text = '记完 ' + imp.after + ' / ' + imp.target + ' ' + imp.unit
    if (!imp.over) return { text: text, cls: '' }

    if (type === 'feed') {
      return { text: text + ' · 超出 ' + imp.excess + ' ' + imp.unit, cls: 'over' }
    }
    if (type === 'water') {
      return { text: text + ' · 已多于参考量', cls: 'note' }
    }
    return { text: text, cls: '' }
  },

  onPreset(e) {
    this.updateAmount(e.currentTarget.dataset.v)
  },

  onAmountInput(e) {
    this.updateAmount(e.detail.value)
  },

  /* 只留数字，最多四位：input type=number 在部分安卓机仍能敲进小数点与减号 */
  updateAmount(raw) {
    const s = this.data.sheet
    if (!s.open) return
    const clean = String(raw).replace(/[^\d]/g, '').slice(0, 4)
    this.setData({
      sheet: Object.assign({}, s, { value: clean, tip: this.tipOf(s.type, clean) })
    })
  },

  onSheetClose() {
    this.closeSheet()
  },

  closeSheet() {
    this.setData({ sheet: Object.assign({}, this.data.sheet, { open: false }) })
  },

  /**
   * 提交。超量时先弹一次提醒，但不硬拦：
   * 目标只是估值，真正知道猫吃没吃饱的是端着碗的人。
   * 喂食给「仍然记录 / 先不喂」两选一；饮水只告知（showCancel: false），
   * 因为「别让它多喝水」是错的建议。
   */
  onSheetConfirm() {
    const s = this.data.sheet
    if (!s.open) return

    const res = store.validateAmount(s.type, s.value)
    if (!res.ok) {
      wx.showToast({ title: res.msg, icon: 'none' })
      return
    }

    const tip = store.overflowTip(this.data.cat.id, s.type, res.value)
    if (!tip) {
      this.commit(s.type, res.value)
      return
    }

    const that = this
    wx.showModal({
      title: tip.title,
      content: tip.content,
      confirmText: tip.confirmText,
      cancelText: tip.cancelText,
      showCancel: tip.needConfirm,
      confirmColor: tip.needConfirm ? PALETTE.vermilion : PALETTE.ink,
      success(r) {
        /* 取消不关面板：人改个数字就能重来，不用从头点一遍 */
        if (!r.confirm) return
        that.commit(s.type, res.value)
      }
    })
  },

  commit(type, value) {
    const note = INTAKE_NOTE[type] + ' ' + value + ' ' + (type === 'play' ? '分钟' : store.intakeUnit(type))
    const toast = {
      feed: '已投食 ' + value + ' g',
      water: '已补水 ' + value + ' ml',
      play: '逗猫 ' + value + ' 分钟'
    }[type]
    this.closeSheet()
    this.log(type, value, note, toast)
  },

  noop() {},

  /**
   * 心情自评：1-5，写进当天记录，同一天再点只改分不叠加。
   * 它不参与照顾分——照顾分算「你做了什么」，自评是「你看到什么」。
   * 不加 toast：格子填上墨色本身就是反馈，再弹一句等于同一件事说两遍。
   */
  onMood(e) {
    const cat = this.data.cat
    if (!cat.id) return
    const v = Number(e.currentTarget.dataset.v)
    if (!v) return
    store.setTodayMood(cat.id, v)
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
    this.refresh()
  },

  onWeigh() {
    const cat = this.data.cat
    if (!cat.id) return
    const that = this
    wx.showModal({
      title: '记录体重',
      editable: true,
      placeholderText: '输入当前体重，例如 4.62',
      success(res) {
        if (!res.confirm) return
        const w = parseFloat(res.content)
        if (!w || w <= 0 || w > 30) {
          wx.showToast({ title: '请输入 0-30 之间的体重', icon: 'none' })
          return
        }
        const value = Number(w.toFixed(2))
        store.updateCat(cat.id, { weight: value })
        store.addRecord(cat.id, 'weight', value, '手动称重')
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
        wx.showToast({ title: '已记录 ' + value + ' kg', icon: 'none' })
        that.refresh()
      }
    })
  },

  goRecords() {
    wx.switchTab({ url: '/pages/records/records' })
  },

  /** 症状记录是唯一会跳页的动作，不写记录、不改猫的状态 */
  onSymptom() {
    wx.navigateTo({ url: '/pages/symptom/symptom' })
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/cat-edit/cat-edit' })
  },

  onPullDownRefresh() {
    this.refresh()
    wx.stopPullDownRefresh()
  }
})
