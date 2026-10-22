const store = require('../../utils/store.js')
const app = getApp()

Page({
  data: {
    cat: null,
    catLabel: '',
    groups: [],
    looseItems: store.LOOSE_ITEMS,
    durations: store.DURATIONS,
    selectedMap: {},
    duration: '2-3d',
    freeText: '',
    count: 0,
    canSubmit: false,
    submitting: false
  },

  onLoad() {
    const catId = (app.globalData && app.globalData.currentCatId) || ''
    let cat = catId ? store.getCat(catId) : null
    if (!cat) {
      const cats = store.getCats()
      cat = cats.length ? cats[0] : null
      if (cat && app.globalData) app.globalData.currentCatId = cat.id
    }

    if (!cat) {
      wx.showToast({ title: '先添加一只猫', icon: 'none' })
      setTimeout(function () {
        wx.navigateBack()
      }, 800)
      return
    }

    const groups = store.SYMPTOM_GROUPS.map(function (g) {
      return { key: g.key, label: g.label, items: g.items }
    })

    this.setData({
      cat: cat,
      catLabel: cat.name + ' · ' + store.ageText(cat.birthday),
      groups: groups
    })
  },

  /** 统一收敛「能不能提交」的判断，避免两处各写一遍 */
  refreshCanSubmit() {
    const count = Object.keys(this.data.selectedMap).length
    this.setData({
      count: count,
      canSubmit: count > 0 || String(this.data.freeText || '').trim().length > 0
    })
  },

  onToggle(e) {
    const text = e.currentTarget.dataset.text
    const map = Object.assign({}, this.data.selectedMap)
    if (map[text]) {
      delete map[text]
    } else {
      map[text] = true
    }
    this.setData({ selectedMap: map }, this.refreshCanSubmit.bind(this))
  },

  onDuration(e) {
    this.setData({ duration: e.currentTarget.dataset.key })
  },

  /** 「其他…」用可编辑弹窗而不是跳新页：只补一项，不值得多一层页面栈 */
  onOther() {
    const that = this
    wx.showModal({
      title: '补充一项',
      editable: true,
      placeholderText: '用自己的话描述',
      success(res) {
        if (!res.confirm) return
        const text = String(res.content || '').trim()
        if (!text) return
        const map = Object.assign({}, that.data.selectedMap)
        map[text] = true
        that.setData({ selectedMap: map }, that.refreshCanSubmit.bind(that))
      }
    })
  },

  onFreeText(e) {
    this.setData({ freeText: e.detail.value }, this.refreshCanSubmit.bind(this))
  },

  onSubmit() {
    if (this.data.submitting) return
    if (!this.data.canSubmit) {
      wx.showToast({ title: '选一项，或者写一句', icon: 'none' })
      return
    }

    const selected = Object.keys(this.data.selectedMap)
    this.setData({ submitting: true })

    const log = store.addSymptomLog(
      this.data.cat.id,
      selected,
      this.data.duration,
      String(this.data.freeText || '').trim()
    )

    wx.navigateTo({
      url: '/pages/report/report?id=' + log.id,
      fail: () => {
        this.setData({ submitting: false })
        wx.showToast({ title: '打开失败，请重试', icon: 'none' })
      }
    })
  }
})
