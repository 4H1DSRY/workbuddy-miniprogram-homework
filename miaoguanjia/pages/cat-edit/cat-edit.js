const store = require('../../utils/store.js')
const app = getApp()

const BREEDS = ['英国短毛猫', '中华田园猫', '布偶猫', '美国短毛猫', '暹罗猫', '橘猫', '缅因猫', '其他']

function two(n) {
  return n < 10 ? '0' + n : '' + n
}

Page({
  data: {
    isEdit: false,
    id: '',
    breeds: BREEDS,
    breedIndex: 0,
    todayStr: '',
    form: {
      name: '',
      breed: BREEDS[0],
      gender: 'male',
      birthday: '',
      weight: '',
      foodTarget: 180,
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
          form: {
            name: cat.name,
            breed: cat.breed,
            gender: cat.gender,
            birthday: cat.birthday,
            weight: String(cat.weight),
            foodTarget: cat.foodTarget,
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
      form: {
        name: '',
        breed: BREEDS[0],
        gender: 'male',
        birthday: todayStr,
        weight: '',
        foodTarget: 180,
        note: '',
        avatar: '/images/cats/default.jpg'
      }
    })
  },

  onName(e) {
    this.setData({ 'form.name': e.detail.value })
  },

  onNote(e) {
    this.setData({ 'form.note': e.detail.value })
  },

  onWeight(e) {
    this.setData({ 'form.weight': e.detail.value })
  },

  onTarget(e) {
    this.setData({ 'form.foodTarget': e.detail.value })
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
    const checked = store.validateCat(this.data.form)
    if (!checked.ok) {
      wx.showToast({ title: checked.msg, icon: 'none' })
      return
    }
    const payload = checked.value

    if (this.data.isEdit) {
      store.updateCat(this.data.id, payload)
    } else {
      const cat = store.addCat(payload)
      if (app.globalData) app.globalData.currentCatId = cat.id
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
      confirmColor: '#C96A6A',
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
