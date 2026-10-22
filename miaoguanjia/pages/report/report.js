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
    /* 两个入口：症状页提交后进来（记录 ← 症状 ← 报告，退两层），
       或从记录页的历史列表点进来（记录 ← 报告，退一层）。
       靠栈里上一页是谁来判断，比写死 delta 稳。 */
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    const prev = pages.length >= 2 ? pages[pages.length - 2] : null
    const delta = prev && prev.route === 'pages/symptom/symptom' ? 2 : 1

    wx.navigateBack({
      delta: delta,
      fail() {
        wx.switchTab({ url: '/pages/records/records' })
      }
    })
  }
})
