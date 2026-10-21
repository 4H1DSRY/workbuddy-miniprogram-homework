"""_jump.py <page> <out.png> <hwnd> —— 临时让首页 onShow 跳到目标页，抓图后还原。"""
import sys, time, subprocess

JS = 'miaoguanjia/pages/index/index.js'
PY = r'C:/Users/donny/.workbuddy/binaries/python/envs/default/Scripts/python.exe'
TABS = ('pages/index/index', 'pages/records/records', 'pages/mine/mine')

target, out, hwnd = sys.argv[1], sys.argv[2], sys.argv[3]
orig = open(JS, encoding='utf-8').read()
OLD = "  onShow() {\n    this.refresh()\n  },"
if OLD not in orig:
    raise SystemExit('anchor not found in index.js')

api = 'switchTab' if target in TABS else 'navigateTo'
new = ("  onShow() {\n"
       "    if (!this.__jump) { this.__jump = 1; wx.%s({ url: '/%s' }); return }\n"
       "    this.refresh()\n"
       "  }," % (api, target))

try:
    open(JS, 'w', encoding='utf-8').write(orig.replace(OLD, new))
    time.sleep(9)
    subprocess.run([PY, '_cap.py', hwnd, '_shots/_j.png'], check=True)
    subprocess.run([PY, '_crop.py', '_shots/_j.png', out,
                    '1230', '112', '1760', '1392', '1.0'], check=True)
finally:
    open(JS, 'w', encoding='utf-8').write(orig)
    print('index.js 已还原')
