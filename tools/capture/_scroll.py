"""_scroll.py <js文件> <page> <scrollTop> <out.png> <hwnd>
临时把首页 onShow 跳到目标页，并在目标页 onShow 末尾插入 wx.pageScrollTo，抓图后还原两个文件。"""
import sys, time, subprocess

IDX = 'miaoguanjia/pages/index/index.js'
PY = r'C:/Users/donny/.workbuddy/binaries/python/envs/default/Scripts/python.exe'
TABS = ('pages/index/index', 'pages/records/records', 'pages/mine/mine')

target_js, page, top, out, hwnd = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]

idx_src = open(IDX, encoding='utf-8').read()
tgt_src = open(target_js, encoding='utf-8').read()

IDX_OLD = "  onShow() {\n    this.refresh()\n  },"
api = 'switchTab' if page in TABS else 'navigateTo'
idx_new = ("  onShow() {\n"
           "    if (!this.__jump) { this.__jump = 1; wx.%s({ url: '/%s' }); return }\n"
           "    this.refresh()\n"
           "  }," % (api, page))

TGT_OLD = "  onShow() {\n    this.refresh()\n  },"
tgt_new = ("  onShow() {\n    this.refresh()\n"
           "    setTimeout(function () { wx.pageScrollTo({ scrollTop: %s, duration: 0 }) }, 300)\n"
           "  }," % top)

assert IDX_OLD in idx_src, 'index.js anchor missing'
assert TGT_OLD in tgt_src, 'target anchor missing'

try:
    open(IDX, 'w', encoding='utf-8').write(idx_src.replace(IDX_OLD, idx_new))
    open(target_js, 'w', encoding='utf-8').write(tgt_src.replace(TGT_OLD, tgt_new))
    time.sleep(9)
    subprocess.run([PY, '_cap.py', hwnd, '_shots/_s.png'], check=True)
    subprocess.run([PY, '_crop.py', '_shots/_s.png', out,
                    '1230', '112', '1760', '1392', '1.0'], check=True)
finally:
    open(IDX, 'w', encoding='utf-8').write(idx_src)
    open(target_js, 'w', encoding='utf-8').write(tgt_src)
    print('两个 js 已还原')
