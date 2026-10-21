"""最小化重复劳动：前置/最大化开发者工具窗口，抓全屏，按比例裁剪区域并放大。"""
import ctypes
import ctypes.wintypes as wt
import sys
import time
from PIL import ImageGrab

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass

u = ctypes.windll.user32
PROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)


def find(title):
    hits = []

    def cb(h, l):
        pid = wt.DWORD()
        u.GetWindowThreadProcessId(h, ctypes.byref(pid))
        n = u.GetWindowTextLengthW(h)
        if n:
            b = ctypes.create_unicode_buffer(n + 1)
            u.GetWindowTextW(h, b, n + 1)
            if b.value == title:
                hits.append(h)
        return True

    u.EnumWindows(PROC(cb), 0)
    return hits[0] if hits else None


def main():
    title = sys.argv[1] if len(sys.argv) > 1 else 'miaoguanjia'
    out = sys.argv[2] if len(sys.argv) > 2 else '_cap.png'
    if len(sys.argv) > 6:
        x1, y1, x2, y2 = [float(v) for v in sys.argv[3:7]]
    else:
        x1, y1, x2, y2 = 0.0, 0.0, 1.0, 1.0

    h = find(title)
    if not h:
        print('WINDOW_NOT_FOUND')
        return
    u.ShowWindow(h, 3)
    u.SetForegroundWindow(h)
    u.BringWindowToTop(h)
    time.sleep(1.2)

    r = wt.RECT()
    u.GetWindowRect(h, ctypes.byref(r))
    print('window_rect', r.left, r.top, r.right, r.bottom)

    im = ImageGrab.grab(all_screens=True)
    W, H = im.size
    box = (int(x1 * W), int(y1 * H), int(x2 * W), int(y2 * H))
    crop = im.crop(box)
    if crop.width < 600:
        crop = crop.resize((crop.width * 3, crop.height * 3), 1)
    crop.save(out)
    print('saved', out, crop.size)


main()
