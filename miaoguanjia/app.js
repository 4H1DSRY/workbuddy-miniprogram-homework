const store = require('./utils/store.js')

App({
  globalData: {
    appName: '喵管家',
    version: '1.0.0',
    currentCatId: ''
  },

  onLaunch() {
    store.init()
    const cats = store.getCats()
    if (cats.length) {
      this.globalData.currentCatId = cats[0].id
    }
  }
})
