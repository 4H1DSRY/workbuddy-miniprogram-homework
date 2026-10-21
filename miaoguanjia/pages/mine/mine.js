const store = require('../../utils/store.js')
const theme = require('../../utils/theme.js')
const app = getApp()

Page({
  data: {
    version: '1.0.0',
    cats: [],
    stats: { cats: 0, records: 0, days: 0 },
    settings: {},
    deviceText: '',
    onlineText: ''
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const cats = store.getCatsDecorated()
    const stats = store.stats()
    const settings = store.getSettings()
    let online = 0
    if (settings.feeder) online += 1
    if (settings.fountain) online += 1
    if (settings.camera) online += 1

    this.setData({
      version: (app.globalData && app.globalData.version) || '1.0.0',
      cats: cats,
      stats: stats,
      settings: settings,
      deviceText: '3 台设备 · ' + online + ' 台在线',
      onlineText: online + '/3 在线'
    })
  },

  onToggle(e) {
    const key = e.currentTarget.dataset.key
    const patch = {}
    patch[key] = e.detail.value
    store.saveSettings(patch)
    this.refresh()
    wx.showToast({ title: e.detail.value ? '已开启' : '已关闭', icon: 'none' })
  },

  onTimeChange(e) {
    store.saveSettings({ remindTime: e.detail.value })
    this.refresh()
    wx.showToast({ title: '提醒时间已设为 ' + e.detail.value, icon: 'none' })
  },

  goEdit(e) {
    wx.navigateTo({ url: '/pages/cat-edit/cat-edit?id=' + e.currentTarget.dataset.id })
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/cat-edit/cat-edit' })
  },

  onAbout() {
    wx.showModal({
      title: '喵管家 v' + this.data.version,
      content: '猫咪日常管理小程序 Demo：档案、投食饮水、体重趋势、设备与提醒设置。数据全部保存在本机存储，不联网。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  onReset() {
    const that = this
    wx.showModal({
      title: '重置演示数据',
      content: '将清空本机所有猫咪与记录，并恢复初始的三只猫。确定继续吗？',
      confirmText: '重置',
      confirmColor: theme.PALETTE.vermilion,
      success(res) {
        if (!res.confirm) return
        store.resetAll()
        const cats = store.getCats()
        if (app.globalData) app.globalData.currentCatId = cats.length ? cats[0].id : ''
        that.refresh()
        wx.showToast({ title: '已恢复初始数据', icon: 'none' })
      }
    })
  },

  onPullDownRefresh() {
    this.refresh()
    wx.stopPullDownRefresh()
  }
})
