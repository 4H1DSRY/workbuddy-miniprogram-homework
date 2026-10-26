const store = require('../../utils/store.js')
const theme = require('../../utils/theme.js')
const PALETTE = theme.PALETTE
const app = getApp()

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

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
    moodLabels: store.MOOD_LABELS
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
      careRing: theme.ringGradient(care, PALETTE.vermilion, PALETTE.rule),
      todayCount: todayCount,
      mood: mood,
      moodText: mood ? store.MOOD_LABELS[mood - 1] : '还没评'
    })
  },

  onSwitch(e) {
    const id = e.currentTarget.dataset.id
    if (app.globalData) app.globalData.currentCatId = id
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

  onFeed() {
    this.log('feed', 40, '手动投食 40g', '已投食 40 g')
  },

  onWater() {
    this.log('water', 60, '饮水机补水', '已补水 60 ml')
  },

  onPlay() {
    this.log('play', 15, '逗猫棒 15 分钟', '逗猫 15 分钟')
  },

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
