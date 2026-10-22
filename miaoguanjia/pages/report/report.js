const store = require('../../utils/store.js')

Page({
  data: {
    report: null,
    ready: false
  },

  onLoad(options) {
    const id = options && options.id ? options.id : ''
    const logs = store.getSymptomLogs()
    const log =
      logs.filter(function (l) {
        return l.id === id
      })[0] || logs[logs.length - 1]

    if (!log) {
      wx.showToast({ title: '没有找到这次记录', icon: 'none' })
      setTimeout(function () {
        wx.navigateBack()
      }, 800)
      return
    }

    const cat = store.getCat(log.catId)
    this.setData({ report: store.buildVisitReport(log, cat), ready: true })
  },

  onCopy() {
    if (!this.data.report) return
    wx.setClipboardData({
      data: this.data.report.plainText,
      success() {
        wx.showToast({ title: '已复制，可发给兽医', icon: 'success' })
      }
    })
  },

  onDone() {
    // 报告 ← 症状 ← 记录页，退两层回到起点
    wx.navigateBack({
      delta: 2,
      fail() {
        wx.switchTab({ url: '/pages/records/records' })
      }
    })
  }
})
