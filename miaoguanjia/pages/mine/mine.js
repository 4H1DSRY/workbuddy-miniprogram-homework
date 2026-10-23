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
      // 原来写的是「N 台在线」——这个词暗示真的连着设备，和下方声明自相矛盾。
      // 开关的实际含义只是「你把这个开关拨到了开」，故改称「已启用」。
      deviceText: '3 台设备 · ' + online + ' 台已启用',
      onlineText: online + '/3 已启用'
    })
  },

  onToggle(e) {
    const key = e.currentTarget.dataset.key
    const patch = {}
    patch[key] = e.detail.value
    store.saveSettings(patch)
    this.refresh()
    // 不弹「已开启 / 已关闭」：开关本身有位移动画，行内状态文案（已连接 / 已断开）也会同步更新，
    // 再弹一次 toast 等于同一件事说三遍，还会打断连续拨动多个开关的操作。
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
      content: '猫咪日常管理小程序 Demo。档案、投食饮水、体重趋势、症状初诊记录均可用，数据全部保存在本机存储，不联网、不上传。\n\n设备管理与提醒设置为界面演示：未接入任何硬件，也不会主动推送消息。',
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
