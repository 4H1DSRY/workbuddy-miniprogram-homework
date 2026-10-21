"""后台抓取窗口内容（PrintWindow + PW_RENDERFULLCONTENT），不抢前台焦点。

用法:
  python win_capture.py <窗口标题> <输出png> [x1 y1 x2 y2 裁剪比例]
"""
import ctypes
import ctypes.wintypes as wt
import sys
from PIL import Image

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass

u = ctypes.windll.user32
g = ctypes.windll.gdi32
PROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ('biSize', wt.DWORD),
        ('biWidth', ctypes.c_long),
        ('biHeight', ctypes.c_long),
        ('biPlanes', wt.WORD),
        ('biBitCount', wt.WORD),
        ('biCompression', wt.DWORD),
        ('biSizeImage', wt.DWORD),
        ('biXPelsPerMeter', ctypes.c_long),
        ('biYPelsPerMeter', ctypes.c_long),
        ('biClrUsed', wt.DWORD),
        ('biClrImportant', wt.DWORD),
    ]


class BITMAPINFO(ctypes.Structure):
    _fields_ = [('bmiHeader', BITMAPINFOHEADER), ('bmiColors', wt.DWORD * 3)]


def find(title):
    hits = []

    def cb(h, l):
        n = u.GetWindowTextLengthW(h)
        if n:
            b = ctypes.create_unicode_buffer(n + 1)
            u.GetWindowTextW(h, b, n + 1)
            if b.value == title:
                hits.append(h)
        return True

    u.EnumWindows(PROC(cb), 0)
    return hits[0] if hits else None


def capture(hwnd):
    r = wt.RECT()
    u.GetWindowRect(hwnd, ctypes.byref(r))
    w, h = r.right - r.left, r.bottom - r.top
    if w <= 0 or h <= 0:
        return None
    hdc = u.GetWindowDC(hwnd)
    mem = g.CreateCompatibleDC(hdc)
    bmp = g.CreateCompatibleBitmap(hdc, w, h)
    g.SelectObject(mem, bmp)
    # 2 = PW_RENDERFULLCONTENT（兼容 Chromium 离屏渲染）
    ok = u.PrintWindow(hwnd, mem, 2)

    bi = BITMAPINFO()
    bi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bi.bmiHeader.biWidth = w
    bi.bmiHeader.biHeight = -h
    bi.bmiHeader.biPlanes = 1
    bi.bmiHeader.biBitCount = 32
    bi.bmiHeader.biCompression = 0
    buf = ctypes.create_string_buffer(w * h * 4)
    g.GetDIBits(mem, bmp, 0, h, buf, ctypes.byref(bi), 0)

    g.DeleteObject(bmp)
    g.DeleteDC(mem)
    u.ReleaseDC(hwnd, hdc)
    if not ok:
        print('PrintWindow returned 0 (可能被系统限制)')
    return Image.frombuffer('RGB', (w, h), buf, 'raw', 'BGRX', 0, 1)


def main():
    title = sys.argv[1]
    out = sys.argv[2]
    hwnd = find(title)
    if not hwnd:
        print('WINDOW_NOT_FOUND')
        return
    im = capture(hwnd)
    if im is None:
        print('CAPTURE_FAILED')
        return
    if len(sys.argv) > 6:
        x1, y1, x2, y2 = [float(v) for v in sys.argv[3:7]]
        W, H = im.size
        im = im.crop((int(x1 * W), int(y1 * H), int(x2 * W), int(y2 * H)))
    im.save(out)
    print('OK', im.size, out)


main()
