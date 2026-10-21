"""向指定窗口投递鼠标点击（PostMessage，不抢前台焦点）。
用法: _click.py <hwnd> <img_x> <img_y> [img_w]
img_x/img_y 是在 PrintWindow 抓图上量到的像素坐标，脚本自动换算到客户区坐标。"""
import ctypes, ctypes.wintypes as wt, sys, time
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass
u = ctypes.windll.user32
hwnd = int(sys.argv[1]); ix = float(sys.argv[2]); iy = float(sys.argv[3])
iw = float(sys.argv[4]) if len(sys.argv) > 4 else 1875.0

ow = wt.RECT(); u.GetWindowRect(hwnd, ctypes.byref(ow))
outer_w = ow.right - ow.left
scale = iw / outer_w
cx0 = wt.POINT(0, 0); u.ClientToScreen(hwnd, ctypes.byref(cx0))
bord_x = cx0.x - ow.left
bord_y = cx0.y - ow.top
sx = ix / scale
sy = iy / scale
client_x = int(round(sx - bord_x))
client_y = int(round(sy - bord_y))
lp = (client_y << 16) | (client_x & 0xFFFF)
u.PostMessageW(hwnd, 0x0200, 0, lp)            # WM_MOUSEMOVE
time.sleep(0.05)
u.PostMessageW(hwnd, 0x0201, 1, lp)            # WM_LBUTTONDOWN
time.sleep(0.06)
u.PostMessageW(hwnd, 0x0202, 0, lp)            # WM_LBUTTONUP
print('click outer=(%d,%d) scale=%.3f -> client=(%d,%d)' % (sx, sy, scale, client_x, client_y))
