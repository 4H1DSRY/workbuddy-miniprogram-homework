"""恢复 IDE 窗口到指定尺寸（不抢焦点），后台抓图并可选裁剪。"""
import ctypes
import ctypes.wintypes as wt
import sys
import time
from PIL import Image

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass

u = ctypes.windll.user32
g = ctypes.windll.gdi32
PROC = ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)


class BIH(ctypes.Structure):
    _fields_ = [
        ('biSize', wt.DWORD), ('biWidth', ctypes.c_long), ('biHeight', ctypes.c_long),
        ('biPlanes', wt.WORD), ('biBitCount', wt.WORD), ('biCompression', wt.DWORD),
        ('biSizeImage', wt.DWORD), ('biXPelsPerMeter', ctypes.c_long),
        ('biYPelsPerMeter', ctypes.c_long), ('biClrUsed', wt.DWORD), ('biClrImportant', wt.DWORD),
    ]


class BI(ctypes.Structure):
    _fields_ = [('bmiHeader', BIH), ('bmiColors', wt.DWORD * 3)]


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


def grab(hwnd):
    r = wt.RECT()
    u.GetWindowRect(hwnd, ctypes.byref(r))
    w, h = r.right - r.left, r.bottom - r.top
    hdc = u.GetWindowDC(hwnd)
    mem = g.CreateCompatibleDC(hdc)
    bmp = g.CreateCompatibleBitmap(hdc, w, h)
    g.SelectObject(mem, bmp)
    u.PrintWindow(hwnd, mem, 2)
    bi = BI()
    bi.bmiHeader.biSize = ctypes.sizeof(BIH)
    bi.bmiHeader.biWidth = w
    bi.bmiHeader.biHeight = -h
    bi.bmiHeader.biPlanes = 1
    bi.bmiHeader.biBitCount = 32
    buf = ctypes.create_string_buffer(w * h * 4)
    g.GetDIBits(mem, bmp, 0, h, buf, ctypes.byref(bi), 0)
    g.DeleteObject(bmp)
    g.DeleteDC(mem)
    u.ReleaseDC(hwnd, hdc)
    return Image.frombuffer('RGB', (w, h), buf, 'raw', 'BGRX', 0, 1)


def main():
    title = sys.argv[1]
    out = sys.argv[2]
    w = int(sys.argv[3]) if len(sys.argv) > 3 else 1600
    h = int(sys.argv[4]) if len(sys.argv) > 4 else 1000
    hwnd = find(title)
    if not hwnd:
        print('WINDOW_NOT_FOUND')
        return
    u.ShowWindow(hwnd, 9)  # SW_RESTORE
    u.SetWindowPos(hwnd, 0, 0, 0, w, h, 0x0004 | 0x0010)  # NOZORDER | NOACTIVATE
    time.sleep(1.6)
    r = wt.RECT()
    u.GetWindowRect(hwnd, ctypes.byref(r))
    print('rect', r.left, r.top, r.right - r.left, r.bottom - r.top)
    im = grab(hwnd)
    if len(sys.argv) > 8:
        x1, y1, x2, y2 = [float(v) for v in sys.argv[5:9]]
        W, H = im.size
        im = im.crop((int(x1 * W), int(y1 * H), int(x2 * W), int(y2 * H)))
    im.save(out)
    print('OK', im.size, out)


main()
