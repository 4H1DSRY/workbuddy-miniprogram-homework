const store = require('../../utils/store.js')
const theme = require('../../utils/theme.js')
const PALETTE = theme.PALETTE
const app = getApp()

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

Page({
  data: {
    figBounce: false,
    version: '1.0.0',
    today: '',
    cats: [],
    cat: {},
    trend: { delta: 0, text: '暂无对比' },
    pct: {
      foodAbs: 0, waterAbs: 0,
      foodTarget: 200, waterTarget: 260,
      food: 0, water: 0, mood: 0
    },
    care: 0,
    careRing: '',
    todayCount: 0
  },

  onLoad() {
    const now = new Date()
    this.setData({
      version: (app.globalData && app.globalData.version) || '1.0.0',
      today: (now.getMonth() + 1) + '月' + now.getDate() + '日 周' + WEEK[now.getDay()]
    })
  },

  /** 形象的点击微交互：轻震 + 轻微缩放。照片模式下不响应，免得点了没反应还以为坏了 */
  onFigureTap() {
    if (!this.data.cat || this.data.cat.avatarType !== 'figure') return
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
    this.setData({ figBounce: true })
    const that = this
    setTimeout(function () {
      that.setData({ figBounce: false })
    }, 160)
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const cats = store.getCatsDecorated()
    if (!cats.length) {
      this.setData({ cats: [], cat: {}, care: 0, careRing: '', todayCount: 0 })
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

    const key = store.dayKey(Date.now())
    let todayCount = 0
    store.getRecords(cat.id).forEach(function (r) {
      if (store.dayKey(r.time) === key) todayCount += 1
    })

    this.setData({
      cats: cats,
      cat: cat,
      trend: trend,
      pct: pct,
      care: care,
      careRing: theme.ringGradient(care, PALETTE.vermilion, PALETTE.rule),
      todayCount: todayCount
    })
  },

  onSwitch(e) {
    const id = e.currentTarget.dataset.id
    if (app.globalData) app.globalData.currentCatId = id
    this.refresh()
  },

  /**
   * 四个动作共用一条落笔路径：改状态 → 写记录 → 轻震 → 刷新。
   * 震动是刻意的：这是「触觉」，原先只有一句 toast，摸起来跟表单一样。
   */
  bump(field, delta, type, value, note, toast) {
    const cat = this.data.cat
    if (!cat.id) return
    const patch = {}
    patch[field] = store.clamp(cat[field] + delta, 0, 100)
    store.updateCat(cat.id, patch)
    store.addRecord(cat.id, type, value, note)
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
    if (toast) wx.showToast({ title: toast, icon: 'none' })
    this.refresh()
  },

  onFeed() {
    this.bump('food', 16, 'feed', 40, '手动投食 40g', '已投食 40 g')
  },

  onWater() {
    this.bump('water', 20, 'water', 60, '饮水机补水', '已补水 60 ml')
  },

  onPlay() {
    this.bump('mood', 14, 'play', 15, '逗猫棒 15 分钟', '陪玩 15 分钟')
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

  goAdd() {
    wx.navigateTo({ url: '/pages/cat-edit/cat-edit' })
  },

  onPullDownRefresh() {
    this.refresh()
    wx.stopPullDownRefresh()
  }
})
