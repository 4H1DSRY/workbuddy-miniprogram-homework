const store = require('../../utils/store.js')
const theme = require('../../utils/theme.js')
const PALETTE = theme.PALETTE
const app = getApp()

/* 前四项各对应一个类型（feed / water / weight），最后一项是兜底。
   兜底原本叫「护理」，改成「其他」：宠物语境里的「护理」指洗澡、梳毛、
   剪指甲、清耳朵，而这组装的是逗猫（陪玩）+ 疫苗 + 驱虫（医疗事件）——
   名字指向的正好是它没有的东西。三者凑不出一个更窄的词（「健康」盖不住
   逗猫，「互动」盖不住疫苗），所以按兜底的本义命名。 */
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'feed', label: '喂食' },
  { key: 'water', label: '饮水' },
  { key: 'weight', label: '体重' },
  { key: 'other', label: '其他' }
]

const OTHER_TYPES = ['play', 'vaccine', 'deworm']

Page({
  data: {
    cats: [],
    catId: '',
    catName: '',
    filter: 'all',
    filters: FILTERS,
    total: 0,
    days: 0,
    weekCount: 0,
    series: [],
    latestWeight: '--',
    chartSub: '最近 7 次称重',
    groups: [],
    visits: []
  },

  onShow() {
    const cats = store.getCatsDecorated()
    let catId = (app.globalData && app.globalData.currentCatId) || ''
    let exists = false
    for (let i = 0; i < cats.length; i++) {
      if (cats[i].id === catId) exists = true
    }
    if (!exists) catId = cats.length ? cats[0].id : ''
    if (app.globalData) app.globalData.currentCatId = catId
    this.setData({ cats: cats, catId: catId })
    this.build()
  },

  build() {
    const catId = this.data.catId
    if (!catId) {
      this.setData({ groups: [], total: 0, days: 0, weekCount: 0, series: [], latestWeight: '--', visits: [] })
      return
    }

    /* 心情自评不进流水：其余每一条都是「发生了一次的事」（投食 40g、称重 4.62kg），
       自评是「这一天大概什么样」，性质不同。混进来会让「累计记录」变成
       「我点过几次格子」，也会让「其他」筛选里冒出一条没有数量的条目。 */
    const all = store.getRecords(catId).filter(function (r) {
      return r.type !== 'mood'
    })
    const dayMap = {}
    const weekLine = Date.now() - 7 * 86400000
    let weekCount = 0
    all.forEach(function (r) {
      dayMap[store.dayKey(r.time)] = 1
      if (r.time >= weekLine) weekCount += 1
    })

    const series = store.weightSeries(catId, 7)
    const latest = series.length ? series[series.length - 1].value : '--'

    const filter = this.data.filter
    let list = all
    if (filter === 'other') {
      list = all.filter(function (r) {
        return OTHER_TYPES.indexOf(r.type) >= 0
      })
    } else if (filter !== 'all') {
      list = all.filter(function (r) {
        return r.type === filter
      })
    }

    const groups = store.groupByDay(list).map(function (g) {
      return {
        key: g.key,
        label: g.label,
        items: g.items.map(function (r) {
          const meta = store.typeMeta(r.type)
          return {
            id: r.id,
            clock: store.fmtClock(r.time),
            icon: meta.icon,
            label: meta.label,
            color: meta.color,
            note: r.note || meta.label,
            valueText: meta.unit ? r.value + ' ' + meta.unit : ''
          }
        })
      }
    })

    let catName = ''
    for (let i = 0; i < this.data.cats.length; i++) {
      if (this.data.cats[i].id === catId) catName = this.data.cats[i].name
    }

    this.setData(
      {
        total: all.length,
        days: Object.keys(dayMap).length,
        weekCount: weekCount,
        series: series,
        latestWeight: latest,
        chartSub: series.length ? '最近 ' + series.length + ' 次称重' : '还没有称重记录',
        groups: groups,
        visits: store.getSymptomBriefs(catId, 3),
        catName: catName
      },
      () => {
        const draw = () => this.drawChart()
        if (typeof wx.nextTick === 'function') wx.nextTick(draw)
        else setTimeout(draw, 60)
      }
    )
  },

  onSwitchCat(e) {
    const id = e.currentTarget.dataset.id
    if (app.globalData) app.globalData.currentCatId = id
    this.setData({ catId: id, filter: 'all' })
    this.build()
  },

  onFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key })
    this.build()
  },

  drawChart() {
    const that = this
    const query = wx.createSelectorQuery().in(this)
    query
      .select('#weightChart')
      .fields({ node: true, size: true })
      .exec(function (res) {
        const item = res && res[0]
        if (!item || !item.node) return
        const canvas = item.node
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let dpr = 2
        try {
          if (typeof wx.getWindowInfo === 'function') {
            const info = wx.getWindowInfo()
            dpr = info.pixelRatio || 2
          }
        } catch (err) {
          dpr = 2
        }

        const W = item.width || 300
        const H = item.height || 130
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, W, H)

        const pl = 30
        const pr = 18
        const pt = 18
        const pb = 26
        const innerW = W - pl - pr
        const innerH = H - pt - pb

        ctx.strokeStyle = PALETTE.chartGrid
        ctx.lineWidth = 1
        for (let i = 0; i <= 2; i++) {
          const y = pt + (innerH / 2) * i
          ctx.beginPath()
          ctx.moveTo(pl, y)
          ctx.lineTo(pl + innerW, y)
          ctx.stroke()
        }

        const series = that.data.series || []
        if (series.length < 2) {
          ctx.fillStyle = PALETTE.ruleStrong
          ctx.font = '12px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('暂无足够数据', W / 2, H / 2 + 4)
          return
        }

        const vals = series.map(function (s) {
          return Number(s.value) || 0
        })
        let min = Math.min.apply(null, vals)
        let max = Math.max.apply(null, vals)
        if (max - min < 0.3) {
          const mid = (max + min) / 2
          min = mid - 0.2
          max = mid + 0.2
        }
        const gap = (max - min) * 0.3
        min -= gap
        max += gap

        const xAt = function (i) {
          return pl + (innerW * i) / (series.length - 1)
        }
        const yAt = function (v) {
          return pt + innerH * (1 - (v - min) / (max - min))
        }

        const grad = ctx.createLinearGradient(0, pt, 0, pt + innerH)
        grad.addColorStop(0, theme.brandRgba(0.22))
        grad.addColorStop(1, theme.brandRgba(0.02))
        ctx.beginPath()
        ctx.moveTo(xAt(0), yAt(vals[0]))
        for (let i = 1; i < series.length; i++) ctx.lineTo(xAt(i), yAt(vals[i]))
        ctx.lineTo(xAt(series.length - 1), pt + innerH)
        ctx.lineTo(xAt(0), pt + innerH)
        ctx.closePath()
        ctx.fillStyle = grad
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(xAt(0), yAt(vals[0]))
        for (let i = 1; i < series.length; i++) ctx.lineTo(xAt(i), yAt(vals[i]))
        ctx.strokeStyle = PALETTE.vermilion
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.stroke()

        for (let i = 0; i < series.length; i++) {
          const isLast = i === series.length - 1
          ctx.beginPath()
          ctx.arc(xAt(i), yAt(vals[i]), isLast ? 4 : 2.6, 0, Math.PI * 2)
          ctx.fillStyle = PALETTE.white
          ctx.fill()
          ctx.strokeStyle = PALETTE.vermilion
          ctx.lineWidth = isLast ? 2.5 : 1.5
          ctx.stroke()
        }

        ctx.fillStyle = PALETTE.chartLabel
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(max.toFixed(1), 2, pt + 4)
        ctx.fillText(min.toFixed(1), 2, pt + innerH)

        const fmt = function (ts) {
          const d = new Date(ts)
          return d.getMonth() + 1 + '/' + d.getDate()
        }
        ctx.textAlign = 'center'
        ctx.fillText(fmt(series[0].time), xAt(0), H - 8)
        ctx.fillText(fmt(series[series.length - 1].time), xAt(series.length - 1), H - 8)
      })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  goSymptom() {
    wx.navigateTo({ url: '/pages/symptom/symptom' })
  },

  /** 回看历史就诊描述。栈里只有「记录 ← 报告」两层，报告页的「完成」按一层退 */
  goReport(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/report/report?id=' + id })
  },

  onPullDownRefresh() {
    this.onShow()
    wx.stopPullDownRefresh()
  }
})
