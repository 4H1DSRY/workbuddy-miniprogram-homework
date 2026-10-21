"""_clicka.py <hwnd> <x> <y> [img_w] —— 先投递 WM_ACTIVATE/WM_SETFOCUS，再点击。
不改动真实 z-order 与系统前台窗口。"""
import ctypes, ctypes.wintypes as wt, sys, time
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass
u = ctypes.windll.user32
hwnd = int(sys.argv[1]); ix = float(sys.argv[2]); iy = float(sys.argv[3])
iw = float(sys.argv[4]) if len(sys.argv) > 4 else 1875.0

ow = wt.RECT(); u.GetWindowRect(hwnd, ctypes.byref(ow))
scale = iw / float(ow.right - ow.left)
cx0 = wt.POINT(0, 0); u.ClientToScreen(hwnd, ctypes.byref(cx0))
px = int(round(ix / scale - (cx0.x - ow.left)))
py = int(round(iy / scale - (cx0.y - ow.top)))
lp = (py << 16) | (px & 0xFFFF)

u.PostMessageW(hwnd, 0x0006, 1, 0)        # WM_ACTIVATE / WA_ACTIVE
u.PostMessageW(hwnd, 0x0007, hwnd, 0)    # WM_SETFOCUS
time.sleep(0.12)
u.PostMessageW(hwnd, 0x0200, 0, lp)
time.sleep(0.06)
u.PostMessageW(hwnd, 0x0201, 1, lp)
time.sleep(0.08)
u.PostMessageW(hwnd, 0x0202, 0, lp)
print('activate+click client=(%d,%d)' % (px, py))
