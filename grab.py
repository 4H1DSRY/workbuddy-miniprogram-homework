"""抓取指定窗口截图：列出窗口标题、前置目标窗口、按窗口矩形截图。"""
import ctypes
import ctypes.wintypes as wt
import sys
import os
from PIL import ImageGrab

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)

titles = []


def _cb(hwnd, lparam):
    if user32.IsWindowVisible(hwnd):
        n = user32.GetWindowTextLengthW(hwnd)
        if n > 0:
            buf = ctypes.create_unicode_buffer(n + 1)
            user32.GetWindowTextW(hwnd, buf, n + 1)
            r = wt.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(r))
            has_size = (r.right - r.left) > 300 and (r.bottom - r.top) > 200
            if has_size:
                titles.append((hwnd, buf.value, r.left, r.top, r.right, r.bottom))
    return True


user32.EnumWindows(WNDENUMPROC(_cb), 0)

if len(sys.argv) < 2:
    for t in titles:
        print(t[1], '|', t[2], t[3], t[4], t[5])
    sys.exit(0)

keyword = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else 'shot.png'

target = None
for hwnd, title, l, t, r, b in titles:
    if keyword in title:
        target = (hwnd, title, l, t, r, b)
        break

if not target:
    print('NOT_FOUND')
    for t in titles:
        print(' ', t[1])
    sys.exit(1)

hwnd, title, l, t, r, b = target
user32.ShowWindow(hwnd, 9)   # SW_RESTORE
user32.SetForegroundWindow(hwnd)
ctypes.windll.user32.BringWindowToTop(hwnd)
ctypes.windll.kernel32.Sleep(1200)

r2 = wt.RECT()
user32.GetWindowRect(hwnd, ctypes.byref(r2))
img = ImageGrab.grab(bbox=(r2.left, r2.top, r2.right, r2.bottom), all_screens=True)
img.save(out)
print('OK', title, img.size, out)
