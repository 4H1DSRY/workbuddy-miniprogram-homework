const store = require('../../utils/store.js')
const theme = require('../../utils/theme.js')
const app = getApp()

const BREEDS = ['英国短毛猫', '中华田园猫', '布偶猫', '美国短毛猫', '暹罗猫', '橘猫', '缅因猫', '其他']

function two(n) {
  return n < 10 ? '0' + n : '' + n
}

/* 参考量由体重现算，页面上只展示不输入。没填体重时给一句占位，
   而不是先显示一个 200 g 让人以为那是这只猫的数。 */
function targetTextOf(weight) {
  const w = parseFloat(weight)
  if (!w || w <= 0) return '填体重后自动算'
  const cat = { weight: w }
  return store.foodTargetOf(cat) + ' g · ' + store.waterTargetOf(cat) + ' ml'
}

Page({
  data: {
    isEdit: false,
    id: '',
    submitting: false,
    errorField: '',
    errorMsg: '',
    breeds: BREEDS,
    breedIndex: 0,
    todayStr: '',
    targetText: '填体重后自动算',
    form: {
      name: '',
      breed: BREEDS[0],
      gender: 'male',
      birthday: '',
      weight: '',
      note: '',
      avatar: '/images/cats/default.jpg'
    }
  },

  onLoad(options) {
    const now = new Date()
    const todayStr = now.getFullYear() + '-' + two(now.getMonth() + 1) + '-' + two(now.getDate())
    const id = options && options.id ? options.id : ''

    if (id) {
      const cat = store.getCat(id)
      if (cat) {
        let breedIndex = BREEDS.indexOf(cat.breed)
        if (breedIndex < 0) breedIndex = 0
        wx.setNavigationBarTitle({ title: '编辑「' + cat.name + '」' })
        this.setData({
          isEdit: true,
          id: id,
          todayStr: todayStr,
          breedIndex: breedIndex,
          targetText: targetTextOf(cat.weight),
          form: {
            name: cat.name,
            breed: cat.breed,
            gender: cat.gender,
            birthday: cat.birthday,
            weight: String(cat.weight),
            note: cat.note || '',
            avatar: cat.avatar
          }
        })
        return
      }
    }

    wx.setNavigationBarTitle({ title: '添加猫咪' })
    this.setData({
      todayStr: todayStr,
      targetText: '填体重后自动算',
      form: {
        name: '',
        breed: BREEDS[0],
        gender: 'male',
        birthday: todayStr,
        weight: '',
        note: '',
        avatar: '/images/cats/default.jpg'
      }
    })
  },

  /** 输入时清掉当前字段的错误提示，避免用户已经改了字红还在 */
  clearError(field) {
    if (this.data.errorField === field) {
      this.setData({ errorField: '', errorMsg: '' })
    }
  },

  onName(e) {
    this.setData({ 'form.name': e.detail.value })
    this.clearError('name')
  },

  onNote(e) {
    this.setData({ 'form.note': e.detail.value })
  },

  onWeight(e) {
    this.setData({ 'form.weight': e.detail.value, targetText: targetTextOf(e.detail.value) })
    this.clearError('weight')
  },

  onBreed(e) {
    const idx = Number(e.detail.value)
    this.setData({ breedIndex: idx, 'form.breed': BREEDS[idx] })
  },

  onGender(e) {
    this.setData({ 'form.gender': e.currentTarget.dataset.g })
  },

  onBirthday(e) {
    this.setData({ 'form.birthday': e.detail.value })
  },

  onPickAvatar() {
    const that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success(res) {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file || !file.tempFilePath) return
        const temp = file.tempFilePath
        try {
          const fs = wx.getFileSystemManager()
          fs.saveFile({
            tempFilePath: temp,
            success(r) {
              that.setData({ 'form.avatar': r.savedFilePath })
            },
            fail() {
              that.setData({ 'form.avatar': temp })
            }
          })
        } catch (err) {
          that.setData({ 'form.avatar': temp })
        }
      },
      fail() {
        // 用户取消选择，不做处理
      }
    })
  },

  onSave() {
    // 防重复：600ms 的返回延迟内容易被连点，导致 addCat 执行多次
    if (this.data.submitting) return

    const checked = store.validateCat(this.data.form)
    if (!checked.ok) {
      // 校验失败不上锁，否则用户改完字段也无法再次提交
      // 错误定位：顶部公告条 + 该字段标红 + 滚动到该字段（指南 2.3）
      this.setData({ errorField: checked.field, errorMsg: checked.msg })
      wx.pageScrollTo({ selector: '#f-' + checked.field, duration: 200, offsetTop: -24 })
      return
    }

    this.setData({ submitting: true, errorField: '', errorMsg: '' })
    const payload = checked.value

    try {
      if (this.data.isEdit) {
        store.updateCat(this.data.id, payload)
      } else {
        const cat = store.addCat(payload)
        if (app.globalData) app.globalData.currentCatId = cat.id
      }
    } catch (err) {
      // 写库异常必须解锁，否则页面卡死
      this.setData({ submitting: false })
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
      return
    }

    wx.showToast({ title: this.data.isEdit ? '已保存' : '已添加', icon: 'success' })
    setTimeout(function () {
      wx.navigateBack()
    }, 600)
  },

  onDelete() {
    const that = this
    wx.showModal({
      title: '删除档案',
      content: '删除后这只猫的记录也会一起清除，且无法恢复。',
      confirmText: '删除',
      confirmColor: theme.PALETTE.vermilion,
      success(res) {
        if (!res.confirm) return
        store.removeCat(that.data.id)
        const cats = store.getCats()
        if (app.globalData) {
          app.globalData.currentCatId = cats.length ? cats[0].id : ''
        }
        wx.showToast({ title: '已删除', icon: 'none' })
        setTimeout(function () {
          wx.navigateBack()
        }, 500)
      }
    })
  }
})
