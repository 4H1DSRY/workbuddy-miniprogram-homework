Component({
  properties: {
    color: { type: String, value: 'ink' },
    accessory: { type: String, value: 'none' },
    // 尺寸由调用方给 font-size 控制，组件内部全部用 em，改一个值整体缩放
    size: { type: String, value: '200rpx' }
  }
})
