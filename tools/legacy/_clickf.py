"""按抓图内的相对坐标点击：_clickf.py <hwnd> <img_w> <img_h> <fx> <fy>"""
import ctypes, ctypes.wintypes as wt, sys, time
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass
u = ctypes.windll.user32
hwnd = int(sys.argv[1]); iw = float(sys.argv[2]); ih = float(sys.argv[3])
fx = float(sys.argv[4]); fy = float(sys.argv[5])
ow = wt.RECT(); u.GetWindowRect(hwnd, ctypes.byref(ow))
oww = ow.right - ow.left; ohh = ow.bottom - ow.top
sx = fx * iw * (oww / iw); sy = fy * ih * (ohh / ih)
cx0 = wt.POINT(0, 0); u.ClientToScreen(hwnd, ctypes.byref(cx0))
px = int(round(sx - (cx0.x - ow.left))); py = int(round(sy - (cx0.y - ow.top)))
lp = (py << 16) | (px & 0xFFFF)
u.PostMessageW(hwnd, 0x0200, 0, lp); time.sleep(0.05)
u.PostMessageW(hwnd, 0x0201, 1, lp); time.sleep(0.06)
u.PostMessageW(hwnd, 0x0202, 0, lp)
print('click client=(%d,%d)' % (px, py))
